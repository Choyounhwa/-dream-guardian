/**
 * [REFACTOR-DEV-001] (Issue #623) DevLayoutPanel 전담 인터랙션 핸들러
 *
 * DevLayoutPanel 내의 넛지(Nudge) 컨트롤, 연속 증감(Long-press repeat), 키보드 단축키,
 * 패널 마우스 드래그/리사이즈, 요소 호버 하이라이트 이벤트 바인딩을 격리 관리한다.
 */

import { UI_LAYOUT } from '../../config/ui.config.js';
import { DevLayoutHistory } from './DevLayoutHistory.js';
import {
  DEV_LAYOUT_STORAGE_KEY,
  buildLayoutDiff,
} from './DevLayoutPanel.js';

export const NUDGE_LONG_PRESS_DELAY_MS = 400;
export const NUDGE_REPEAT_INTERVAL_MS = 60;

/**
 * [DEVUI-011] 숫자 미세 조정 순수 함수
 */
export function nudgeValue(
  value: number,
  dir: 1 | -1,
  shift: boolean,
  step = 1,
  min?: number,
  max?: number,
): number {
  const mult = shift ? 10 : 1;
  const delta = dir * step * mult;

  const getDecimals = (n: number) => {
    const s = n.toString();
    const e = s.indexOf('e-');
    if (e !== -1) return parseInt(s.slice(e + 2), 10);
    const d = s.indexOf('.');
    return d === -1 ? 0 : s.length - d - 1;
  };

  const decimals = Math.max(getDecimals(value), getDecimals(step));
  let result = Number((value + delta).toFixed(Math.min(decimals, 10)));

  if (min !== undefined && result < min) {
    result = min;
  }
  if (max !== undefined && result > max) {
    result = max;
  }
  return result;
}

export interface ApiLike {
  element?: HTMLElement;
  on?(event: string, fn: (ev?: unknown) => void): unknown;
  disabled?: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LayoutBindingLike {
  path?: string;
  target?: object;
  key?: string;
  readonly?: boolean;
  step?: number;
  min?: number;
  max?: number;
}

export interface PaneLike {
  refresh(): void;
  dispose?(): void;
  addFolder?(params: { title: string; expanded?: boolean }): any;
  addBinding?(obj: object, key: string, params?: Record<string, unknown>): any;
  addButton?(params: { title: string; disabled?: boolean }): any;
}

export interface AttachNudgeOptions {
  path: string;
  node: Record<string, unknown>;
  key: string;
  meta: LayoutBindingLike;
  history: DevLayoutHistory;
  pane: PaneLike;
  storage: StorageLike | null;
  base: object;
  doc?: Document;
  updateButtons?: () => void;
  saveDiff?: (storage: StorageLike | null, current: object, base: object) => void;
  onNudge?: (path: string, nextValue: number) => void;
}

export interface GlobalKeyboardNudgeOptions {
  metas: Map<string, LayoutBindingLike>;
  history: DevLayoutHistory;
  pane: PaneLike;
  storage: StorageLike | null;
  base: object;
  baseAssault: object;
  updateButtons?: () => void;
  getValue?: (path: string) => unknown;
  setValue?: (path: string, val: number) => void;
  onNudge?: (path: string, nextValue: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export interface DragOptions {
  onDragStart?: (startPos: { x: number; y: number }) => void;
  onDrag?: (pos: { x: number; y: number; dx: number; dy: number }) => void;
  onDragEnd?: (finalPos: { x: number; y: number }) => void;
  bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number };
}

export interface ResizeOptions {
  onResizeStart?: (startSize: { width: number; height: number }) => void;
  onResize?: (size: { width: number; height: number; dw: number; dh: number }) => void;
  onResizeEnd?: (finalSize: { width: number; height: number }) => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export function saveLayoutDiff(
  storage: StorageLike | null,
  current: object,
  base: object,
  key: string = DEV_LAYOUT_STORAGE_KEY,
): void {
  if (!storage) return;
  try {
    const diff = buildLayoutDiff(current, base);
    if (Object.keys(diff).length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(diff));
  } catch {
    // quota exceeded 등 무시
  }
}

/**
 * [DEVUI-011] 편집 가능한 숫자 바인딩 행에 ▲ / ▼ 버튼을 주입하고, 클릭/롱프레스 및 키보드 이벤트를 바인딩한다.
 */
export function attachNudgeControls(
  api: ApiLike,
  opts: AttachNudgeOptions,
): { upBtn: HTMLElement; downBtn: HTMLElement; container: HTMLElement } | null {
  if (!api || !api.element || opts.meta.readonly) {
    return null;
  }

  const el = api.element;
  const existingContainer = el.querySelector?.('.dg-nudge-container') as HTMLElement | null;
  if (existingContainer) {
    const upBtn = existingContainer.querySelector?.('.dg-nudge-up') as HTMLElement | null;
    const downBtn = existingContainer.querySelector?.('.dg-nudge-down') as HTMLElement | null;
    if (upBtn && downBtn) return { upBtn, downBtn, container: existingContainer };
  }

  const doc = opts.doc ?? el.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const container = doc.createElement('div');
  container.className = 'dg-nudge-container dg-nudge-group';
  container.setAttribute('data-dg-nudge-path', opts.path);
  el.setAttribute?.('data-dg-nudge-path', opts.path);

  Object.assign(container.style, {
    display: 'inline-flex',
    flexDirection: 'column',
    marginLeft: '4px',
    verticalAlign: 'middle',
    gap: '1px',
  });

  const upBtn = doc.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'dg-nudge-btn dg-nudge-up';
  upBtn.textContent = '▲';
  upBtn.setAttribute('data-dir', 'up');
  upBtn.setAttribute('data-path', opts.path);
  upBtn.setAttribute('aria-label', `${opts.path} 증가`);
  Object.assign(upBtn.style, {
    height: '10px',
    lineHeight: '8px',
    fontSize: '8px',
    padding: '0 4px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    borderRadius: '2px',
  });

  const downBtn = doc.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'dg-nudge-btn dg-nudge-down';
  downBtn.textContent = '▼';
  downBtn.setAttribute('data-dir', 'down');
  downBtn.setAttribute('data-path', opts.path);
  downBtn.setAttribute('aria-label', `${opts.path} 감소`);
  Object.assign(downBtn.style, {
    height: '10px',
    lineHeight: '8px',
    fontSize: '8px',
    padding: '0 4px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    borderRadius: '2px',
  });

  container.appendChild(upBtn);
  container.appendChild(downBtn);

  const valEl = el.querySelector?.('.tp-lblv_v') ?? el;
  valEl.appendChild(container);

  const step = opts.meta.step ?? 1;

  const saveCurrentDiff = () => {
    if (opts.saveDiff) {
      opts.saveDiff(opts.storage, UI_LAYOUT, opts.base);
    } else {
      saveLayoutDiff(opts.storage, UI_LAYOUT, opts.base);
    }
  };

  const bindButton = (btn: HTMLElement, dir: 1 | -1) => {
    let delayTimer: any = null;
    let intervalTimer: any = null;
    let isPressed = false;
    let justFinishedMousedown = false;
    let lastShift = false;

    const stepOnce = (shift: boolean) => {
      const cur = (opts.node as Record<string, any>)[opts.key] as number;
      const next = nudgeValue(cur, dir, shift, step, opts.meta.min, opts.meta.max);
      if (next !== cur) {
        (opts.node as Record<string, any>)[opts.key] = next;
        opts.history.setValue(opts.path, next);
        opts.pane.refresh();
        saveCurrentDiff();
        opts.updateButtons?.();
        opts.onNudge?.(opts.path, next);
      }
    };

    const cleanup = () => {
      if (delayTimer !== null) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
      if (intervalTimer !== null) {
        clearInterval(intervalTimer);
        intervalTimer = null;
      }
      if (isPressed) {
        isPressed = false;
        justFinishedMousedown = true;
        const endVal = (opts.node as Record<string, any>)[opts.key] as number;
        opts.history.endDrag(opts.path, endVal);
        opts.updateButtons?.();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener?.('mouseup', handleGlobalMouseUp);
        window.removeEventListener?.('pointerup', handleGlobalMouseUp);
      }
      if (doc) {
        doc.removeEventListener?.('mouseup', handleGlobalMouseUp);
        doc.removeEventListener?.('pointerup', handleGlobalMouseUp);
      }
    };

    const handleGlobalMouseUp = () => {
      cleanup();
    };

    btn.addEventListener('mousedown', (ev: any) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault?.();
      ev.stopPropagation?.();

      cleanup();

      isPressed = true;
      lastShift = !!ev.shiftKey;
      const startVal = (opts.node as Record<string, any>)[opts.key] as number;
      opts.history.beginDrag(opts.path, startVal);

      stepOnce(lastShift);

      if (typeof window !== 'undefined') {
        window.addEventListener?.('mouseup', handleGlobalMouseUp);
        window.addEventListener?.('pointerup', handleGlobalMouseUp);
      }
      if (doc) {
        doc.addEventListener?.('mouseup', handleGlobalMouseUp);
        doc.addEventListener?.('pointerup', handleGlobalMouseUp);
      }

      delayTimer = setTimeout(() => {
        intervalTimer = setInterval(() => {
          stepOnce(lastShift);
        }, NUDGE_REPEAT_INTERVAL_MS);
      }, NUDGE_LONG_PRESS_DELAY_MS);
    });

    btn.addEventListener('mouseup', (ev: any) => {
      if (isPressed) {
        ev.preventDefault?.();
        cleanup();
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (isPressed) {
        cleanup();
      }
    });

    btn.addEventListener('click', (ev: any) => {
      ev.preventDefault?.();
      ev.stopPropagation?.();
      if (justFinishedMousedown) {
        justFinishedMousedown = false;
        return;
      }
      const cur = (opts.node as Record<string, any>)[opts.key] as number;
      const next = nudgeValue(cur, dir, !!ev.shiftKey, step, opts.meta.min, opts.meta.max);
      if (next !== cur) {
        opts.history.beginDrag(opts.path, cur);
        (opts.node as Record<string, any>)[opts.key] = next;
        opts.history.endDrag(opts.path, next);
        opts.pane.refresh();
        saveCurrentDiff();
        opts.updateButtons?.();
        opts.onNudge?.(opts.path, next);
      }
    });
  };

  bindButton(upBtn, 1);
  bindButton(downBtn, -1);

  const inputEl = el.querySelector?.('input') as HTMLInputElement | null;
  if (inputEl) {
    inputEl.setAttribute?.('data-dg-layout-path', opts.path);
    inputEl.addEventListener('keydown', (ev: any) => {
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        if ((ev as any).__dgNudgeHandled) return;
        (ev as any).__dgNudgeHandled = true;
        ev.preventDefault?.();
        ev.stopPropagation?.();
        const dir: 1 | -1 = ev.key === 'ArrowUp' ? 1 : -1;
        const cur = (opts.node as Record<string, any>)[opts.key] as number;
        const next = nudgeValue(cur, dir, !!ev.shiftKey, step, opts.meta.min, opts.meta.max);
        if (next !== cur) {
          opts.history.beginDrag(opts.path, cur);
          (opts.node as Record<string, any>)[opts.key] = next;
          opts.history.endDrag(opts.path, next);
          opts.pane.refresh();
          saveCurrentDiff();
          opts.updateButtons?.();
          opts.onNudge?.(opts.path, next);
          if ('value' in inputEl) {
            inputEl.value = String(next);
          }
        }
      }
    });
  }

  return { upBtn, downBtn, container };
}

/**
 * [REFACTOR-DEV-001] DevPanel 전담 인터랙션 핸들러 클래스
 */
export class DevPanelInteractionHandler {
  private readonly disposers: Array<() => void> = [];

  /**
   * 개별 바인딩 행에 넛지 버튼 및 인터랙션을 바인딩한다.
   */
  public attachNudgeControls(
    api: ApiLike,
    opts: AttachNudgeOptions,
  ): { upBtn: HTMLElement; downBtn: HTMLElement; container: HTMLElement } | null {
    return attachNudgeControls(api, opts);
  }

  /**
   * 문서 전역의 키보드 방향키 조작 이벤트를 바인딩한다.
   */
  public attachGlobalKeyboard(
    doc: Document,
    opts: GlobalKeyboardNudgeOptions,
  ): () => void {
    const handleKeyDown = (ev: any) => {
      const active = (doc as any).activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName?.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (active as any).isContentEditable) {
          if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
            if (ev.__dgNudgeHandled) return;

            const path =
              active.getAttribute?.('data-dg-layout-path') ??
              active.closest?.('[data-dg-nudge-path]')?.getAttribute?.('data-dg-nudge-path') ??
              active.closest?.('.tp-lblv')?.querySelector?.('[data-dg-nudge-path]')?.getAttribute?.('data-dg-nudge-path');

            if (path && opts.metas.has(path) && !opts.metas.get(path)!.readonly) {
              ev.__dgNudgeHandled = true;
              ev.preventDefault?.();
              ev.stopPropagation?.();

              const dir: 1 | -1 = ev.key === 'ArrowUp' ? 1 : -1;
              const meta = opts.metas.get(path)!;
              const step = meta.step ?? 1;

              const cur = opts.getValue?.(path);
              if (typeof cur === 'number') {
                const next = nudgeValue(cur, dir, !!ev.shiftKey, step, meta.min, meta.max);
                if (next !== cur) {
                  opts.history.beginDrag(path, cur);
                  opts.setValue?.(path, next);
                  opts.history.endDrag(path, next);
                  opts.pane.refresh();
                  if (!opts.setValue) {
                    saveLayoutDiff(opts.storage, UI_LAYOUT, opts.base, DEV_LAYOUT_STORAGE_KEY);
                  }
                  opts.updateButtons?.();
                  opts.onNudge?.(path, next);
                  if ('value' in active) {
                    (active as HTMLInputElement).value = String(next);
                  }
                }
              }
            }
          }
          return;
        }
      }

      if (opts.onUndo || opts.onRedo) {
        const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modKey = isMac ? ev.metaKey : ev.ctrlKey;
        if (modKey && (ev.key === 'z' || ev.key === 'Z')) {
          ev.preventDefault?.();
          ev.stopPropagation?.();
          if (ev.shiftKey) {
            opts.onRedo?.();
          } else {
            opts.onUndo?.();
          }
          return;
        }
        if (modKey && (ev.key === 'y' || ev.key === 'Y')) {
          ev.preventDefault?.();
          ev.stopPropagation?.();
          opts.onRedo?.();
          return;
        }
      }
    };

    doc.addEventListener('keydown', handleKeyDown);
    const unbind = () => {
      doc.removeEventListener('keydown', handleKeyDown);
    };
    this.disposers.push(unbind);
    return unbind;
  }

  /**
   * 패널 또는 엘리먼트의 드래그 이동을 바인딩한다.
   */
  public attachDraggable(
    panel: HTMLElement,
    handle: HTMLElement = panel,
    options: DragOptions = {},
  ): () => void {
    let isDragging = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startPanelX = 0;
    let startPanelY = 0;

    const parsePx = (val: string): number => {
      const n = parseFloat(val);
      return Number.isFinite(n) ? n : 0;
    };

    const onPointerMove = (ev: any) => {
      if (!isDragging) return;
      const clientX = ev.clientX ?? 0;
      const clientY = ev.clientY ?? 0;
      const dx = clientX - startMouseX;
      const dy = clientY - startMouseY;

      let newX = startPanelX + dx;
      let newY = startPanelY + dy;

      if (options.bounds) {
        if (options.bounds.minX !== undefined) newX = Math.max(options.bounds.minX, newX);
        if (options.bounds.maxX !== undefined) newX = Math.min(options.bounds.maxX, newX);
        if (options.bounds.minY !== undefined) newY = Math.max(options.bounds.minY, newY);
        if (options.bounds.maxY !== undefined) newY = Math.min(options.bounds.maxY, newY);
      }

      panel.style.left = `${newX}px`;
      panel.style.top = `${newY}px`;
      options.onDrag?.({ x: newX, y: newY, dx, dy });
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      const finalX = parsePx(panel.style.left);
      const finalY = parsePx(panel.style.top);
      options.onDragEnd?.({ x: finalX, y: finalY });
      removeMoveListeners();
    };

    const removeMoveListeners = () => {
      handle.removeEventListener('mousemove', onPointerMove);
      handle.removeEventListener('mouseup', onPointerUp);
      if (typeof window !== 'undefined') {
        window.removeEventListener?.('mousemove', onPointerMove);
        window.removeEventListener?.('mouseup', onPointerUp);
      }
    };

    const onPointerDown = (ev: any) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault?.();
      isDragging = true;
      startMouseX = ev.clientX ?? 0;
      startMouseY = ev.clientY ?? 0;
      startPanelX = parsePx(panel.style.left);
      startPanelY = parsePx(panel.style.top);

      options.onDragStart?.({ x: startPanelX, y: startPanelY });

      handle.addEventListener('mousemove', onPointerMove);
      handle.addEventListener('mouseup', onPointerUp);
      if (typeof window !== 'undefined') {
        window.addEventListener?.('mousemove', onPointerMove);
        window.addEventListener?.('mouseup', onPointerUp);
      }
    };

    handle.addEventListener('mousedown', onPointerDown);

    const unbind = () => {
      handle.removeEventListener('mousedown', onPointerDown);
      removeMoveListeners();
    };
    this.disposers.push(unbind);
    return unbind;
  }

  /**
   * 패널 리사이즈를 바인딩한다.
   */
  public attachResizable(
    panel: HTMLElement,
    handle: HTMLElement,
    options: ResizeOptions = {},
  ): () => void {
    let isResizing = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startW = 0;
    let startH = 0;

    const parsePx = (val: string): number => {
      const n = parseFloat(val);
      return Number.isFinite(n) ? n : 0;
    };

    const onPointerMove = (ev: any) => {
      if (!isResizing) return;
      const clientX = ev.clientX ?? 0;
      const clientY = ev.clientY ?? 0;
      const dw = clientX - startMouseX;
      const dh = clientY - startMouseY;

      let newW = startW + dw;
      let newH = startH + dh;

      if (options.minWidth !== undefined) newW = Math.max(options.minWidth, newW);
      if (options.maxWidth !== undefined) newW = Math.min(options.maxWidth, newW);
      if (options.minHeight !== undefined) newH = Math.max(options.minHeight, newH);
      if (options.maxHeight !== undefined) newH = Math.min(options.maxHeight, newH);

      panel.style.width = `${newW}px`;
      panel.style.height = `${newH}px`;
      options.onResize?.({ width: newW, height: newH, dw, dh });
    };

    const onPointerUp = () => {
      if (!isResizing) return;
      isResizing = false;
      const finalW = parsePx(panel.style.width);
      const finalH = parsePx(panel.style.height);
      options.onResizeEnd?.({ width: finalW, height: finalH });
      removeMoveListeners();
    };

    const removeMoveListeners = () => {
      handle.removeEventListener('mousemove', onPointerMove);
      handle.removeEventListener('mouseup', onPointerUp);
      if (typeof window !== 'undefined') {
        window.removeEventListener?.('mousemove', onPointerMove);
        window.removeEventListener?.('mouseup', onPointerUp);
      }
    };

    const onPointerDown = (ev: any) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault?.();
      isResizing = true;
      startMouseX = ev.clientX ?? 0;
      startMouseY = ev.clientY ?? 0;
      startW = parsePx(panel.style.width);
      startH = parsePx(panel.style.height);

      options.onResizeStart?.({ width: startW, height: startH });

      handle.addEventListener('mousemove', onPointerMove);
      handle.addEventListener('mouseup', onPointerUp);
      if (typeof window !== 'undefined') {
        window.addEventListener?.('mousemove', onPointerMove);
        window.addEventListener?.('mouseup', onPointerUp);
      }
    };

    handle.addEventListener('mousedown', onPointerDown);

    const unbind = () => {
      handle.removeEventListener('mousedown', onPointerDown);
      removeMoveListeners();
    };
    this.disposers.push(unbind);
    return unbind;
  }

  /**
   * 요소의 mouseenter / mouseleave 에 인스펙터 하이라이트 연동을 바인딩한다.
   */
  public attachHoverHighlight(
    element: HTMLElement,
    path: string,
    onHover?: (path: string | null) => void,
  ): () => void {
    if (!element || typeof element.addEventListener !== 'function') {
      return () => {};
    }

    const onEnter = () => onHover?.(path);
    const onLeave = () => onHover?.(null);

    element.addEventListener('mouseenter', onEnter);
    element.addEventListener('mouseleave', onLeave);

    const unbind = () => {
      element.removeEventListener('mouseenter', onEnter);
      element.removeEventListener('mouseleave', onLeave);
    };
    this.disposers.push(unbind);
    return unbind;
  }

  /**
   * 폴더 요소의 헤더/버튼/텍스트에 인스펙터 하이라이트 연동을 바인딩한다.
   */
  public attachFolderHover(
    folderEl: HTMLElement | undefined,
    path: string,
    onHover?: (path: string | null) => void,
  ): () => void {
    if (!folderEl) return () => {};
    const btn = folderEl.querySelector?.('.tp-fldv_b') || folderEl.querySelector?.('button');
    const txt = folderEl.querySelector?.('.tp-fldv_t');
    const unbinds: Array<() => void> = [];
    if (btn) unbinds.push(this.attachHoverHighlight(btn as HTMLElement, path, onHover));
    if (txt) unbinds.push(this.attachHoverHighlight(txt as HTMLElement, path, onHover));
    if (!btn && !txt) unbinds.push(this.attachHoverHighlight(folderEl, path, onHover));
    return () => {
      unbinds.forEach((u) => u());
    };
  }

  /**
   * 액션 메뉴 버튼 생성 및 스타일링 헬퍼
   */
  public static createActionButton(
    doc: Document,
    container: HTMLElement,
    title: string,
    id: string,
    disabled = false,
  ): HTMLElement {
    const btn = doc.createElement('button') as any;
    btn.id = id;
    btn.textContent = title;
    btn.title = title;
    btn.disabled = disabled;
    btn.handlers = {} as Record<string, Function>;
    Object.assign(btn.style, {
      background: '#2A2A48',
      color: '#FFFFFF',
      border: '1px solid #4A4A70',
      borderRadius: '3px',
      padding: '3px 8px',
      font: '11px monospace',
      textAlign: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? '0.45' : '1.0',
    });
    btn.on = (ev: string, fn: Function) => {
      btn.handlers[ev] = fn;
      return btn;
    };
    const onClick = (e?: any) => {
      if (!btn.disabled && btn.handlers.click) {
        btn.handlers.click(e);
      }
    };
    btn.onclick = onClick;
    btn.click = onClick;
    btn.addEventListener?.('click', onClick);
    container.appendChild(btn);
    return btn;
  }

  /**
   * 등록된 모든 리스너 및 리소스 해제
   */
  public dispose(): void {
    while (this.disposers.length > 0) {
      const fn = this.disposers.pop();
      try {
        fn?.();
      } catch {
        // 무시
      }
    }
  }
}
