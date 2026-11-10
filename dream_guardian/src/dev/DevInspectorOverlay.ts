/**
 * [DEVUI-007] (Issue #567) 인스펙터 오버레이 (DevInspectorOverlay)
 *
 * 개발 모드(?dev=ui)에서 게임 캔버스 위에 반투명 오버레이를 오버레이하여:
 * 1. 마우스 Hover 감지 및 점선 테두리 + 요소 라벨 표시
 * 2. 마우스 클릭 시 요소 선택 (겹친 요소는 Alt+클릭 또는 연속 클릭 순환)
 * 3. 마우스 드래그를 통한 x/y 실시간 이동 (화면 픽셀 → 1080x2160 가상 좌표 변환)
 * 4. Shift 키 누름 시 수평/수직 축 고정
 * 5. 판정 연동 좌표(isProtected === true)는 🔒 잠금 표시 및 드래그 거부(Reject)
 * 6. Tweakpane 패널 및 DevLayoutHistory undo/redo 연계
 */

import {
  getInspectableElements,
  findAllInspectableAt,
  findInspectableAt,
  cycleInspectable,
  getLayoutCoordinates,
  setLayoutCoordinates,
  findElementByPath,
  type InspectableElement,
} from './LayoutRegistry.js';
import type { DevLayoutHistory } from './DevLayoutHistory.js';

export const DEV_INSPECTOR_OVERLAY_ID = 'dg-dev-inspector-overlay';

let activeInspectorOverlay: DevInspectorOverlay | null = null;

export function getActiveInspectorOverlay(): DevInspectorOverlay | null {
  if (activeInspectorOverlay) return activeInspectorOverlay;
  if (typeof window !== 'undefined' && (window as any).__dg_inspector_overlay) {
    return (window as any).__dg_inspector_overlay;
  }
  if (typeof document !== 'undefined') {
    const canvas = document.getElementById(DEV_INSPECTOR_OVERLAY_ID) as any;
    if (canvas?.__dg_inspector_overlay) {
      return canvas.__dg_inspector_overlay;
    }
  }
  return null;
}

export interface PaneLike {
  refresh(): void;
}

export interface DevInspectorOverlayOptions {
  app?: any;
  doc?: Document;
  container?: HTMLElement;
  history?: DevLayoutHistory;
  pane?: PaneLike;
  snapGrid?: number;
  onSelect?: (element: InspectableElement | null) => void;
  onChange?: (element: InspectableElement, newCoords: { x: number; y: number }) => void;
}

export class DevInspectorOverlay {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null = null;
  private readonly app: any;
  private readonly doc: Document;
  private readonly history?: DevLayoutHistory;
  private readonly pane?: PaneLike;
  private readonly snapGrid: number;
  private readonly onSelect?: (element: InspectableElement | null) => void;
  private readonly onChange?: (element: InspectableElement, newCoords: { x: number; y: number }) => void;

  private selectedElement: InspectableElement | null = null;
  private hoveredElement: InspectableElement | null = null;
  private highlightedPath: string | null = null;
  private highlightedElement: InspectableElement | null = null;
  private isDragging = false;
  private dragRejected = false;
  private dragStart: {
    mouseX: number;
    mouseY: number;
    originalX: number;
    originalY: number;
  } | null = null;
  private lastShiftKey = false;
  private enabled = true;

  // DOM 이벤트 핸들러 레퍼런스 (정리용)
  private readonly boundPointerDown: (e: any) => void;
  private readonly boundPointerMove: (e: any) => void;
  private readonly boundPointerUp: (e: any) => void;
  private readonly boundKeyDown: (e: any) => void;
  private readonly boundKeyUp: (e: any) => void;

  constructor(options: DevInspectorOverlayOptions = {}) {
    this.app = options.app;
    this.doc = options.doc ?? (typeof document !== 'undefined' ? document : (null as any));
    this.history = options.history;
    this.pane = options.pane;
    this.snapGrid = options.snapGrid ?? 1;
    this.onSelect = options.onSelect;
    this.onChange = options.onChange;

    if (!this.doc) {
      throw new Error('[DEV UI] Document 객체가 제공되지 않았습니다.');
    }

    // 기존 오버레이가 있다면 제거
    const existing = this.doc.getElementById(DEV_INSPECTOR_OVERLAY_ID);
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }

    // 오버레이 캔버스 생성 및 스타일 설정
    this.canvas = this.doc.createElement('canvas') as HTMLCanvasElement;
    this.canvas.id = DEV_INSPECTOR_OVERLAY_ID;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'auto';
    this.canvas.style.zIndex = '9999';

    this.ctx = (this.canvas.getContext?.('2d') as CanvasRenderingContext2D) ?? null;

    // 마운트 대상 컨테이너 탐색
    const container =
      options.container ??
      this.doc.getElementById('container') ??
      this.doc.getElementById('game-canvas')?.parentElement ??
      this.doc.body;

    if (container && container.appendChild) {
      container.appendChild(this.canvas);
      if (!(this.canvas as any).parentElement && !(this.canvas as any).parentNode) {
        (this.canvas as any).parentNode = container;
      }
    }

    this.syncCanvasSize();

    // DOM 이벤트 리스너 바인딩
    this.boundPointerDown = (ev: MouseEvent) => this.onDomPointerDown(ev);
    this.boundPointerMove = (ev: MouseEvent) => this.onDomPointerMove(ev);
    this.boundPointerUp = () => this.onDomPointerUp();
    this.boundKeyDown = (ev: KeyboardEvent) => this.onDomKeyDown(ev);
    this.boundKeyUp = (ev: KeyboardEvent) => this.onDomKeyUp(ev);

    this.canvas.addEventListener?.('mousedown', this.boundPointerDown);
    this.canvas.addEventListener?.('pointerdown', this.boundPointerDown);
    if (typeof window !== 'undefined') {
      window.addEventListener?.('mousemove', this.boundPointerMove);
      window.addEventListener?.('pointermove', this.boundPointerMove);
      window.addEventListener?.('mouseup', this.boundPointerUp);
      window.addEventListener?.('pointerup', this.boundPointerUp);
      window.addEventListener?.('keydown', this.boundKeyDown);
      window.addEventListener?.('keyup', this.boundKeyUp);
    } else {
      this.doc.addEventListener?.('mousemove', this.boundPointerMove);
      this.doc.addEventListener?.('pointermove', this.boundPointerMove);
      this.doc.addEventListener?.('mouseup', this.boundPointerUp);
      this.doc.addEventListener?.('pointerup', this.boundPointerUp);
      this.doc.addEventListener?.('keydown', this.boundKeyDown);
      this.doc.addEventListener?.('keyup', this.boundKeyUp);
    }

    this.render();
    activeInspectorOverlay = this;
    if (typeof window !== 'undefined') {
      (window as any).__dg_inspector_overlay = this;
    }
    if (this.canvas) {
      (this.canvas as any).__dg_inspector_overlay = this;
    }
  }

  private getCurrentState(): string {
    return this.app?.stateMachine?.currentState ?? 'MENU_MAIN';
  }

  private getViewportSize(): { vw: number; vh: number } {
    const w = this.canvas.clientWidth || this.canvas.width || 1080;
    const h = this.canvas.clientHeight || this.canvas.height || 2160;
    return { vw: w, vh: h };
  }

  private syncCanvasSize(): void {
    const { vw, vh } = this.getViewportSize();
    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
    }
  }

  private getElements(): InspectableElement[] {
    const state = this.getCurrentState();
    const { vw, vh } = this.getViewportSize();
    return getInspectableElements(state, this.app, vw, vh);
  }

  /**
   * 마우스 포인터 좌표 변환 (CSS 픽셀 → 캔버스 좌표)
   */
  private getCanvasPoint(ev: MouseEvent): { px: number; py: number } {
    if (this.canvas.getBoundingClientRect) {
      const rect = this.canvas.getBoundingClientRect();
      const rw = rect.width || this.canvas.clientWidth || this.canvas.width || 1;
      const rh = rect.height || this.canvas.clientHeight || this.canvas.height || 1;
      const px = ((ev.clientX - rect.left) / rw) * this.canvas.width;
      const py = ((ev.clientY - rect.top) / rh) * this.canvas.height;
      return { px, py };
    }
    return { px: ev.clientX, py: ev.clientY };
  }

  private onDomPointerDown(ev: MouseEvent): void {
    if (!this.enabled) return;
    if (ev.button !== undefined && ev.button !== 0) return;
    const { px, py } = this.getCanvasPoint(ev);
    this.handlePointerDown(px, py, { altKey: ev.altKey, shiftKey: ev.shiftKey });
  }

  private onDomPointerMove(ev: MouseEvent): void {
    if (!this.enabled) return;
    const { px, py } = this.getCanvasPoint(ev);
    this.handlePointerMove(px, py, { shiftKey: ev.shiftKey });
  }

  private onDomPointerUp(): void {
    if (!this.enabled) return;
    this.handlePointerUp();
  }

  private onDomKeyDown(ev: KeyboardEvent): void {
    if (!this.enabled) return;
    if (ev.key === 'Shift') {
      this.lastShiftKey = true;
      this.render();
    } else if (ev.key === 'Escape') {
      this.selectElement(null);
    }
  }

  private onDomKeyUp(ev: KeyboardEvent): void {
    if (!this.enabled) return;
    if (ev.key === 'Shift') {
      this.lastShiftKey = false;
      this.render();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 공개 인터랙션 핸들러 (단위 테스트에서 직접 호출 가능)
  // ─────────────────────────────────────────────────────────────

  public handlePointerDown(
    px: number,
    py: number,
    opts: { altKey?: boolean; shiftKey?: boolean } = {},
  ): void {
    const { vw, vh } = this.getViewportSize();
    const elements = this.getElements();
    const hits = findAllInspectableAt(elements, px, py, vw, vh);

    if (hits.length === 0) {
      this.selectElement(null);
      this.isDragging = false;
      this.dragStart = null;
      this.dragRejected = false;
      this.render();
      return;
    }

    let target: InspectableElement | null = null;

    // Alt 키가 눌려있거나 현재 선택된 요소 위에 다시 클릭했을 때 순환 선택
    if (opts.altKey || (this.selectedElement && hits.some((h) => h.id === this.selectedElement?.id))) {
      target = cycleInspectable(hits, this.selectedElement?.id);
    } else {
      target = hits[hits.length - 1]; // 최상위 요소
    }

    this.selectElement(target ? target.id : null);

    if (this.selectedElement) {
      if (this.selectedElement.isProtected) {
        this.dragRejected = true;
        this.isDragging = false;
        this.dragStart = null;
      } else {
        this.dragRejected = false;
        const coords = getLayoutCoordinates(this.selectedElement.path);
        if (coords) {
          this.isDragging = true;
          this.dragStart = {
            mouseX: px,
            mouseY: py,
            originalX: coords.x,
            originalY: coords.y,
          };
        }
      }
    }

    this.render();
  }

  public handlePointerMove(
    px: number,
    py: number,
    opts: { shiftKey?: boolean } = {},
  ): void {
    this.lastShiftKey = !!opts.shiftKey;
    const { vw, vh } = this.getViewportSize();

    if (this.isDragging && this.selectedElement && this.dragStart && !this.selectedElement.isProtected) {
      let dx = px - this.dragStart.mouseX;
      let dy = py - this.dragStart.mouseY;

      // Shift 키 축 고정 (수평 또는 수직 중 변위가 더 큰 축 유지)
      if (this.lastShiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }

      // 화면 픽셀 변화량 → 1080x2160 가상 좌표 변화량 변환
      const deltaVx = (dx * 1080) / vw;
      const deltaVy = (dy * 2160) / vh;

      let newX = this.dragStart.originalX + deltaVx;
      let newY = this.dragStart.originalY + deltaVy;

      if (this.snapGrid > 1) {
        newX = Math.round(newX / this.snapGrid) * this.snapGrid;
        newY = Math.round(newY / this.snapGrid) * this.snapGrid;
      } else {
        newX = Math.round(newX);
        newY = Math.round(newY);
      }

      const changed = setLayoutCoordinates(this.selectedElement.path, { x: newX, y: newY });
      if (changed) {
        this.onChange?.(this.selectedElement, { x: newX, y: newY });
        this.pane?.refresh?.();
      }
    } else {
      // 드래그 중이 아닐 때 Hover 요소 업데이트
      const elements = this.getElements();
      const top = findInspectableAt(elements, px, py, vw, vh);
      this.hoveredElement = top;

      if (this.canvas.style) {
        if (this.hoveredElement?.isProtected) {
          this.canvas.style.cursor = 'not-allowed';
        } else if (this.hoveredElement) {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = 'default';
        }
      }
    }

    this.render();
  }

  public handlePointerUp(): void {
    if (this.isDragging && this.selectedElement && this.dragStart) {
      const coords = getLayoutCoordinates(this.selectedElement.path);
      if (coords && (coords.x !== this.dragStart.originalX || coords.y !== this.dragStart.originalY)) {
        if (this.history) {
          this.history.push([
            {
              path: `${this.selectedElement.path}.x`,
              before: this.dragStart.originalX,
              after: coords.x,
            },
            {
              path: `${this.selectedElement.path}.y`,
              before: this.dragStart.originalY,
              after: coords.y,
            },
          ]);
        }
      }
    }

    this.isDragging = false;
    this.dragStart = null;
    this.dragRejected = false;
    this.render();
  }

  public selectElement(id: string | null): void {
    if (!id) {
      this.selectedElement = null;
      this.onSelect?.(null);
      this.render();
      return;
    }
    const elements = this.getElements();
    const found = elements.find((e) => e.id === id) ?? null;
    this.selectedElement = found;
    this.onSelect?.(found);
    this.render();
  }

  public getSelectedElement(): InspectableElement | null {
    return this.selectedElement;
  }

  public getHoveredElement(): InspectableElement | null {
    return this.hoveredElement;
  }

  /**
   * [DEVUI-012] 레이아웃 패널 등 외부에서 특정 경로 호버 시 해당 UI 요소를 하이라이트한다.
   */
  public setHighlightedPath(path: string | null): void {
    this.highlightedPath = path;
    if (!path) {
      this.highlightedElement = null;
    } else {
      const elements = this.getElements();
      this.highlightedElement = findElementByPath(elements, path);
      if (typeof console !== 'undefined' && console.log) {
        console.log('[DEV UI] Hover highlight:', path, '->', this.highlightedElement?.label);
      }
    }
    this.render();
  }

  public getHighlightedPath(): string | null {
    return this.highlightedPath;
  }

  public getHighlightedElement(): InspectableElement | null {
    return this.highlightedElement;
  }

  public isDragRejected(): boolean {
    return this.dragRejected;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.canvas.style) {
      this.canvas.style.display = enabled ? 'block' : 'none';
      this.canvas.style.pointerEvents = enabled ? 'auto' : 'none';
    }
    if (!enabled) {
      this.selectElement(null);
      this.hoveredElement = null;
    }
    this.render();
  }

  // ─────────────────────────────────────────────────────────────
  // 오버레이 캔버스 시각적 렌더링
  // ─────────────────────────────────────────────────────────────

  public render(): void {
    if (!this.ctx || !this.enabled) return;

    const { vw, vh } = this.getViewportSize();
    this.syncCanvasSize();

    this.ctx.clearRect(0, 0, vw, vh);

    // 1. Hover 요소 렌더링 (선택되지 않은 경우에만 점선 테두리)
    if (this.hoveredElement && this.hoveredElement.id !== this.selectedElement?.id) {
      const b = this.hoveredElement.getBounds(vw, vh);
      this.ctx.save();
      this.ctx.setLineDash([4, 4]);
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = this.hoveredElement.isProtected ? '#ff4d4f' : '#28e6ff';
      this.ctx.strokeRect(b.x, b.y, b.w, b.h);

      // 상단 라벨
      this.drawBadge(
        this.ctx,
        this.hoveredElement.isProtected ? `🔒 ${this.hoveredElement.label}` : this.hoveredElement.label,
        b.x,
        b.y - 18,
        this.hoveredElement.isProtected ? 'rgba(255, 77, 79, 0.85)' : 'rgba(40, 230, 255, 0.85)',
        '#000000',
      );
      this.ctx.restore();
    }

    // 1.5 외부 패널 호버 하이라이트 렌더링
    if (this.highlightedElement && this.highlightedElement.id !== this.selectedElement?.id) {
      const b = this.highlightedElement.getBounds(vw, vh);
      const isProt = !!this.highlightedElement.isProtected;
      this.ctx.save();
      this.ctx.setLineDash([6, 3]);
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = isProt ? '#ff4d4f' : '#00f5d4';
      this.ctx.fillStyle = isProt ? 'rgba(255, 77, 79, 0.15)' : 'rgba(0, 245, 212, 0.15)';
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
      this.ctx.strokeRect(b.x, b.y, b.w, b.h);

      const label = isProt ? `🔒 ${this.highlightedElement.label}` : `🔍 ${this.highlightedElement.label}`;
      this.drawBadge(
        this.ctx,
        label,
        b.x,
        b.y - 18,
        isProt ? 'rgba(255, 77, 79, 0.9)' : 'rgba(0, 245, 212, 0.9)',
        '#000000',
      );
      this.ctx.restore();
    }

    // 2. 선택된 요소 렌더링 (실선 테두리 및 상세 정보)
    if (this.selectedElement) {
      const b = this.selectedElement.getBounds(vw, vh);
      const isProt = !!this.selectedElement.isProtected;

      this.ctx.save();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = isProt ? '#ff4d4f' : '#ffcb4d';
      this.ctx.fillStyle = isProt ? 'rgba(255, 77, 79, 0.12)' : 'rgba(255, 203, 77, 0.12)';
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
      this.ctx.strokeRect(b.x, b.y, b.w, b.h);

      const coords = getLayoutCoordinates(this.selectedElement.path);
      const coordText = coords ? ` (${Math.round(coords.x)}, ${Math.round(coords.y)})` : '';
      const labelText = isProt
        ? `🔒 ${this.selectedElement.label} [잠금]`
        : `${this.selectedElement.label}${coordText}`;

      this.drawBadge(
        this.ctx,
        labelText,
        b.x,
        b.y - 20,
        isProt ? '#ff4d4f' : '#ffcb4d',
        '#000000',
      );

      // 드래그 중 가이드라인 렌더링
      if (this.isDragging && !isProt) {
        this.ctx.strokeStyle = 'rgba(255, 203, 77, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        // 수평선 및 수직선 가이드
        this.ctx.beginPath();
        this.ctx.moveTo(0, b.y);
        this.ctx.lineTo(vw, b.y);
        this.ctx.moveTo(b.x, 0);
        this.ctx.lineTo(b.x, vh);
        this.ctx.stroke();

        if (this.lastShiftKey) {
          this.drawBadge(this.ctx, 'Shift: 축 고정', b.x + b.w - 80, b.y - 20, '#52c41a', '#ffffff');
        }
      }

      this.ctx.restore();
    }
  }

  private drawBadge(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    bgColor: string,
    textColor: string,
  ): void {
    const padX = 6;
    const h = 18;
    const clampY = Math.max(0, y);

    ctx.font = '11px sans-serif';
    const textW = (ctx.measureText?.(text)?.width ?? text.length * 6) + padX * 2;

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, clampY, textW, h);

    ctx.fillStyle = textColor;
    ctx.fillText(text, x + padX, clampY + 13);
  }

  public dispose(): void {
    this.canvas.removeEventListener?.('mousedown', this.boundPointerDown);
    this.canvas.removeEventListener?.('pointerdown', this.boundPointerDown);
    if (typeof window !== 'undefined') {
      window.removeEventListener?.('mousemove', this.boundPointerMove);
      window.removeEventListener?.('pointermove', this.boundPointerMove);
      window.removeEventListener?.('mouseup', this.boundPointerUp);
      window.removeEventListener?.('pointerup', this.boundPointerUp);
      window.removeEventListener?.('keydown', this.boundKeyDown);
      window.removeEventListener?.('keyup', this.boundKeyUp);
    } else {
      this.doc.removeEventListener?.('mousemove', this.boundPointerMove);
      this.doc.removeEventListener?.('pointermove', this.boundPointerMove);
      this.doc.removeEventListener?.('mouseup', this.boundPointerUp);
      this.doc.removeEventListener?.('pointerup', this.boundPointerUp);
      this.doc.removeEventListener?.('keydown', this.boundKeyDown);
      this.doc.removeEventListener?.('keyup', this.boundKeyUp);
    }

    const parent = this.canvas.parentElement ?? (this.canvas as any).parentNode;
    if (parent && parent.removeChild) {
      parent.removeChild(this.canvas);
    } else if (typeof (this.canvas as any).remove === 'function') {
      (this.canvas as any).remove();
    }

    if (activeInspectorOverlay === this) {
      activeInspectorOverlay = null;
    }
    if (typeof window !== 'undefined' && (window as any).__dg_inspector_overlay === this) {
      (window as any).__dg_inspector_overlay = null;
    }
  }
}

/**
 * 개발 모드용 인스펙터 오버레이 마운트 헬퍼
 */
export function mountDevInspectorOverlay(
  app: unknown,
  doc: Document = document,
  options: DevInspectorOverlayOptions = {},
): DevInspectorOverlay {
  return new DevInspectorOverlay({
    app,
    doc,
    ...options,
  });
}
