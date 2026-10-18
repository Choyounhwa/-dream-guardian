/**
 * [DEVUI-006] (Issue #566) Tweakpane 레이아웃 패널 (개발 전용)
 *
 * DevBootstrap 에서만 동적 import 된다. tweakpane 도 이 파일 안에서만 동적 import 한다.
 * - UI_LAYOUT 을 재귀 순회해 숫자 필드 바인딩을 자동 생성한다 (가로 0~1080, 세로 0~2160).
 * - 값 변경은 대상 객체를 제자리에서 수정한다 (하위 객체 교체 금지).
 * - 기준값(부팅 시 값 = 기본값 + public/ui-layout.json) 대비 변경분 + 기존 파일 항목을
 *   ui-layout.json 으로 내보낸다. 내보내기 전에 DEVUI-002 검증기로 사전 검증한다.
 * - 세션 변경분은 localStorage 에 저장해 새로고침 후 복원한다. "전체 초기화"로 되돌린다.
 * - 판정 연동 좌표(존 1~11, 바닥 판정선, 회피 레인)는 읽기 전용으로만 표시한다.
 */

import { UI_LAYOUT } from '../../config/ui.config.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import {
  DEV_UI_SECTION_MAP,
  DEV_UI_LOCKED_LAYOUT_PATHS,
  getDevUiLockedSources,
} from '../../config/dev-ui.config.js';
import {
  applyLayoutOverride,
  applyMultiLayoutOverride,
  getLayoutKeyRule,
  UI_LAYOUT_OVERRIDE_URL,
  type LayoutOverrideResult,
} from '../core/UILayoutOverride.js';
import {
  DevLayoutHistory,
  type LayoutChangeItem,
} from './DevLayoutHistory.js';
import { getActiveInspectorOverlay } from './DevInspectorOverlay.js';

/**
 * [DEVUI-008] (Issue #577) 보스 접근전(Boss Assault) 변경 가능한 레이아웃 싱글턴
 */
export const ASSAULT_VISUAL: Record<string, any> = JSON.parse(
  JSON.stringify(DEFAULT_ASSAULT_VISUAL_CONFIG),
);

export const DEV_LAYOUT_PANEL_ID = 'dg-dev-layout-panel';
export const DEV_LAYOUT_STORAGE_KEY = 'dg-dev-ui-layout-diff';
export const DEV_LAYOUT_EXPORT_DIR = 'public/layouts/';
export const DEV_LAYOUT_EXPORT_FILENAME = 'ui-layout.json';
export const DEV_LAYOUT_LOAD_URL = UI_LAYOUT_OVERRIDE_URL;

export const DEV_ACTION_MENU_ID = 'dg-dev-action-menu';
export const DEV_UNDO_BTN_ID = 'dg-dev-undo-btn';
export const DEV_REDO_BTN_ID = 'dg-dev-redo-btn';
export const DEV_EXPORT_BTN_ID = 'dg-dev-export-btn';
export const DEV_RESET_BTN_ID = 'dg-dev-reset-btn';

type Obj = Record<string, unknown>;

function isContainer(v: unknown): v is Obj | unknown[] {
  return typeof v === 'object' && v !== null;
}

export interface LayoutBinding {
  path: string;
  target: Record<string, number>;
  key: string;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  readonly: boolean;
}

/** '*' 는 한 단계 와일드카드. 패턴이 경로의 접두(세그먼트 단위)와 일치하면 잠금 */
export function isLockedPath(path: string, patterns: readonly string[]): boolean {
  const segs = path.split('.');
  return patterns.some((pattern) => {
    const ps = pattern.split('.');
    if (ps.length > segs.length) return false;
    return ps.every((p, i) => p === '*' || p === segs[i]);
  });
}

/** UI_LAYOUT 의 모든 숫자 필드를 바인딩 목록으로 평탄화한다 (target 은 원본 객체 참조) */
export function flattenLayoutBindings(root: object, locked: readonly string[]): LayoutBinding[] {
  const out: LayoutBinding[] = [];
  const walk = (node: Obj | unknown[], path: string) => {
    for (const key of Object.keys(node)) {
      const p = path ? `${path}.${key}` : key;
      const v = (node as Obj)[key];
      if (typeof v === 'number') {
        const rule = getLayoutKeyRule(key);
        out.push({
          path: p,
          target: node as Record<string, number>,
          key,
          min: rule.min,
          max: rule.max,
          step: rule.step,
          integer: rule.integer,
          readonly: isLockedPath(p, locked),
        });
      } else if (isContainer(v)) {
        walk(v, p);
      }
    }
  };
  walk(root as Obj, '');
  return out;
}

export function snapshotLayout<T>(layout: T): T {
  return JSON.parse(JSON.stringify(layout)) as T;
}

/** 기준값 대비 바뀐 숫자(및 pinned 경로)만 담은 같은 모양의 객체. 배열은 {} 자리표시로 인덱스 유지 */
export function buildLayoutDiff(current: object, base: object, pinned: ReadonlySet<string> = new Set()): Obj {
  const walk = (cur: unknown, b: unknown, path: string): unknown => {
    if (typeof cur === 'number') {
      return cur !== b || pinned.has(path) ? cur : undefined;
    }
    if (Array.isArray(cur)) {
      const arr: unknown[] = [];
      let last = -1;
      cur.forEach((item, i) => {
        const d = walk(item, Array.isArray(b) ? b[i] : undefined, `${path}.${i}`);
        arr.push(d === undefined ? {} : d);
        if (d !== undefined) last = i;
      });
      return last < 0 ? undefined : arr.slice(0, last + 1);
    }
    if (isContainer(cur)) {
      const out: Obj = {};
      for (const key of Object.keys(cur)) {
        const p = path ? `${path}.${key}` : key;
        const d = walk((cur as Obj)[key], isContainer(b) ? (b as Obj)[key] : undefined, p);
        if (d !== undefined) out[key] = d;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    }
    return undefined;
  };
  return (walk(current, base, '') as Obj | undefined) ?? {};
}

export interface LayoutExport {
  json: string;
  filename: string;
  warnings: string[];
}

/**
 * [DEVUI-008] (Issue #577) 다중 소스 네임스페이스 JSON ({ version: 1, ui: ..., assault: ... }) 을 생성하고 검증한다.
 */
export function buildMultiLayoutExport(sources: {
  ui: { current: object; base: object; pinned?: ReadonlySet<string> };
  assault: { current: object; base: object; pinned?: ReadonlySet<string> };
}): LayoutExport {
  const diffUi = buildLayoutDiff(sources.ui.current, sources.ui.base, sources.ui.pinned);
  const diffAssault = buildLayoutDiff(
    sources.assault.current,
    sources.assault.base,
    sources.assault.pinned,
  );
  const payload = {
    version: 1,
    ui: diffUi,
    assault: diffAssault,
  };
  const json = JSON.stringify(payload, null, 2);
  const { warnings } = applyMultiLayoutOverride(
    {
      ui: snapshotLayout(sources.ui.base),
      assault: snapshotLayout(sources.assault.base),
    },
    JSON.parse(json),
  );
  return { json, filename: DEV_LAYOUT_EXPORT_FILENAME, warnings };
}

/** 내보낼 JSON 을 만들고 DEVUI-002 검증기로 사전 검증한다 (단일 및 다중 소스 지원) */
export function buildLayoutExport(
  currentOrSources: any,
  base?: object,
  pinned?: ReadonlySet<string>,
): LayoutExport {
  if (
    base === undefined &&
    currentOrSources &&
    typeof currentOrSources === 'object' &&
    'ui' in currentOrSources
  ) {
    return buildMultiLayoutExport(currentOrSources);
  }
  const diff = buildLayoutDiff(currentOrSources, base!, pinned);
  const json = JSON.stringify(diff, null, 2);
  const { warnings } = applyLayoutOverride(snapshotLayout(base!), JSON.parse(json));
  return { json, filename: DEV_LAYOUT_EXPORT_FILENAME, warnings };
}

/** 객체 참조를 유지한 채 숫자 값만 기준값으로 되돌린다 */
export function resetLayoutTo(target: object, base: object): void {
  const walk = (t: Obj | unknown[], b: Obj | unknown[]) => {
    for (const key of Object.keys(t)) {
      const tv = (t as Obj)[key];
      const bv = (b as Obj)[key];
      if (typeof tv === 'number' && typeof bv === 'number') (t as Obj)[key] = bv;
      else if (isContainer(tv) && isContainer(bv)) walk(tv, bv);
    }
  };
  walk(target as Obj, base as Obj);
}

/** 점(.) 경로를 따라 값을 읽는다 */
export function getPathValue(root: unknown, path: string): unknown {
  if (!root || typeof root !== 'object') return undefined;
  const segs = path.split('.');
  let cur: any = root;
  for (const seg of segs) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/** 점(.) 경로를 따라 값을 in-place 로 설정한다 (상위 객체 참조 유지) */
export function applyPathValue(root: unknown, path: string, value: number): boolean {
  if (!root || typeof root !== 'object') return false;
  const segs = path.split('.');
  let cur: any = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return false;
    cur = cur[seg];
  }
  const lastKey = segs[segs.length - 1];
  if (cur && typeof cur === 'object' && lastKey in cur) {
    cur[lastKey] = value;
    return true;
  }
  return false;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveLayoutDiff(storage: StorageLike | null, current: object, base: object): void {
  if (!storage) return;
  try {
    const diff = buildLayoutDiff(current, base);
    if (Object.keys(diff).length === 0) storage.removeItem(DEV_LAYOUT_STORAGE_KEY);
    else storage.setItem(DEV_LAYOUT_STORAGE_KEY, JSON.stringify(diff));
  } catch (err) {
    console.warn('[DEV UI] 레이아웃 변경분 저장 실패:', err);
  }
}

export function restoreLayoutDiff(storage: StorageLike | null, target: object): LayoutOverrideResult {
  const empty: LayoutOverrideResult = { applied: [], warnings: [] };
  if (!storage) return empty;
  let raw: string | null;
  try {
    raw = storage.getItem(DEV_LAYOUT_STORAGE_KEY);
  } catch {
    return empty;
  }
  if (!raw) return empty;
  try {
    return applyLayoutOverride(target, JSON.parse(raw));
  } catch {
    console.warn('[DEV UI] 저장된 레이아웃 변경분이 손상되어 무시합니다.');
    return empty;
  }
}

export function getSectionsForState(state: string): string[] {
  const base = [...(DEV_UI_SECTION_MAP[state] ?? [])];
  if (
    state === 'ASSAULT_ROUND' ||
    state === 'boss_assault' ||
    state === 'boss_assault_low_hp' ||
    state === 'boss_assault_result'
  ) {
    return ['assault', ...base];
  }
  return base;
}

// ─── 패널 마운트 ───

export const NUDGE_LONG_PRESS_DELAY_MS = 400;
export const NUDGE_REPEAT_INTERVAL_MS = 60;

/**
 * [DEVUI-011] 숫자 미세 조정 순수 함수 (export)
 * @param value 현재 숫자 값
 * @param dir 증감 방향 (1: 증가, -1: 감소)
 * @param shift Shift 키 활성화 여부 (true 이면 기본 단위의 10배)
 * @param step 기본 증감 단위 (기본값 1)
 * @param min 최솟값 (지정 시 클램프)
 * @param max 최댓값 (지정 시 클램프)
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

interface ApiLike {
  element?: HTMLElement;
  on(event: string, fn: (ev?: unknown) => void): unknown;
  disabled?: boolean;
}

export interface FolderLike {
  expanded?: boolean;
  element?: HTMLElement;
  addFolder(params: { title: string; expanded?: boolean }): FolderLike;
  addBinding(obj: object, key: string, params: Record<string, unknown>): ApiLike;
  addButton(params: { title: string; disabled?: boolean }): ApiLike;
}

export interface FileSystemWritableFileStreamLike {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

export interface SaveFilePickerOptionsLike {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  startIn?: unknown;
}

let cachedSaveFileHandle: FileSystemFileHandleLike | null = null;

export function getCachedSaveFileHandle(): FileSystemFileHandleLike | null {
  return cachedSaveFileHandle;
}

export function clearCachedSaveFileHandle(): void {
  cachedSaveFileHandle = null;
}

export interface SaveLayoutExportOptions {
  download?: (text: string, filename: string) => void;
  showSaveFilePicker?: (opts?: SaveFilePickerOptionsLike) => Promise<FileSystemFileHandleLike>;
}

export async function saveLayoutExport(
  exportData: { json: string; filename: string },
  options?: SaveLayoutExportOptions,
): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const download = options?.download ?? defaultDownload;
  const picker =
    options?.showSaveFilePicker ??
    (typeof window !== 'undefined'
      ? (window as unknown as { showSaveFilePicker?: (opts?: SaveFilePickerOptionsLike) => Promise<FileSystemFileHandleLike> })
          .showSaveFilePicker
      : undefined);

  if (typeof picker === 'function') {
    try {
      const pickerOptions: SaveFilePickerOptionsLike = {
        suggestedName: exportData.filename,
        types: [
          {
            description: 'JSON Files',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      };
      if (cachedSaveFileHandle) {
        pickerOptions.startIn = cachedSaveFileHandle;
      }
      const handle = await picker(pickerOptions);
      cachedSaveFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(exportData.json);
      await writable.close();
      return 'saved';
    } catch (err: unknown) {
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        return 'cancelled';
      }
      console.warn('[DEV UI] 파일 저장 실패:', err);
      return 'cancelled';
    }
  }

  console.info('[DEV UI] showSaveFilePicker 미지원 환경 - 다운로드로 대체합니다 (저장 후 public/layouts/ 에 복사하세요).');
  download(exportData.json, exportData.filename);
  return 'downloaded';
}

export interface PaneLike extends FolderLike {
  refresh(): void;
  dispose(): void;
}

export interface MountLayoutPanelOptions {
  createPane?: (container: HTMLElement) => PaneLike | Promise<PaneLike>;
  storage?: StorageLike | null;
  download?: (text: string, filename: string) => void;
  showSaveFilePicker?: (opts?: SaveFilePickerOptionsLike) => Promise<FileSystemFileHandleLike>;
  /** 부팅 시 적용된 ui-layout.json 내용. undefined 면 다시 읽어 온다, null 이면 없음 */
  fileOverride?: unknown;
  /** 화면 전환을 감지해 섹션 펼침을 갱신 (기본 true) */
  watchState?: boolean;
  /** 외부에서 주입할 이력 관리자 (미지정 시 신규 생성) */
  history?: DevLayoutHistory;
  /** [DEVUI-008] 다중 소스 네임스페이스 내보내기 강제 활성화 */
  multiSource?: boolean;
  /** [DEVUI-012] 메뉴 항목 마우스 오버 시 경로 전달 콜백 (미지정 시 활성 인스펙터 오버레이에 자동 연동) */
  onHoverPath?: (path: string | null) => void;
}

export interface DevLayoutPanelHandle {
  pane: PaneLike;
  history?: DevLayoutHistory;
  undo?: () => void;
  redo?: () => void;
  actionMenu?: HTMLElement;
  buttons?: {
    undo: any;
    redo: any;
    export: any;
    reset: any;
  };
  dispose(): void;
}

interface AppLike {
  stateMachine?: { currentState: string };
}

async function defaultCreatePane(container: HTMLElement): Promise<PaneLike> {
  const { Pane } = await import('tweakpane');
  return new Pane({ container, title: 'UI_LAYOUT' }) as unknown as PaneLike;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function defaultDownload(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchFileOverride(): Promise<unknown> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(UI_LAYOUT_OVERRIDE_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.trimStart().startsWith('<')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface AttachNudgeOptions {
  path: string;
  node: Obj;
  key: string;
  meta: LayoutBinding;
  history: DevLayoutHistory;
  pane: PaneLike;
  storage: StorageLike | null;
  base: object;
  doc?: Document;
  updateButtons?: () => void;
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

  const bindButton = (btn: HTMLElement, dir: 1 | -1) => {
    let delayTimer: any = null;
    let intervalTimer: any = null;
    let isPressed = false;
    let justFinishedMousedown = false;
    let lastShift = false;

    const stepOnce = (shift: boolean) => {
      const cur = (opts.node as Obj)[opts.key] as number;
      const next = nudgeValue(cur, dir, shift, step, opts.meta.min, opts.meta.max);
      if (next !== cur) {
        (opts.node as Obj)[opts.key] = next;
        opts.history.setValue(opts.path, next);
        opts.pane.refresh();
        saveLayoutDiff(opts.storage, UI_LAYOUT, opts.base);
        opts.updateButtons?.();
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
        const endVal = (opts.node as Obj)[opts.key] as number;
        opts.history.endDrag(opts.path, endVal);
        opts.updateButtons?.();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('pointerup', handleGlobalMouseUp);
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
      const startVal = (opts.node as Obj)[opts.key] as number;
      opts.history.beginDrag(opts.path, startVal);

      stepOnce(lastShift);

      if (typeof window !== 'undefined') {
        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('pointerup', handleGlobalMouseUp);
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
      const cur = (opts.node as Obj)[opts.key] as number;
      const next = nudgeValue(cur, dir, !!ev.shiftKey, step, opts.meta.min, opts.meta.max);
      if (next !== cur) {
        opts.history.beginDrag(opts.path, cur);
        (opts.node as Obj)[opts.key] = next;
        opts.history.endDrag(opts.path, next);
        opts.pane.refresh();
        saveLayoutDiff(opts.storage, UI_LAYOUT, opts.base);
        opts.updateButtons?.();
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
        const cur = (opts.node as Obj)[opts.key] as number;
        const next = nudgeValue(cur, dir, !!ev.shiftKey, step, opts.meta.min, opts.meta.max);
        if (next !== cur) {
          opts.history.beginDrag(opts.path, cur);
          (opts.node as Obj)[opts.key] = next;
          opts.history.endDrag(opts.path, next);
          opts.pane.refresh();
          saveLayoutDiff(opts.storage, UI_LAYOUT, opts.base);
          opts.updateButtons?.();
          if ('value' in inputEl) {
            inputEl.value = String(next);
          }
        }
      }
    });
  }

  return { upBtn, downBtn, container };
}

function addLayoutFolder(
  parent: FolderLike,
  node: Obj | unknown[],
  path: string,
  metas: Map<string, LayoutBinding>,
  onChange: (path: string, val: number, isLast: boolean) => void,
  nudgeContext?: {
    history: DevLayoutHistory;
    pane: PaneLike;
    storage: StorageLike | null;
    base: object;
    doc?: Document;
    updateButtons?: () => void;
  },
  onHoverPath?: (path: string | null) => void,
): void {
  for (const key of Object.keys(node)) {
    const p = path ? `${path}.${key}` : key;
    const v = (node as Obj)[key];
    if (typeof v === 'number') {
      const m = metas.get(p)!;
      const params: Record<string, unknown> = { label: key, readonly: m.readonly };
      if (!m.readonly) Object.assign(params, { min: m.min, max: m.max, step: m.step ?? 1 });
      const api = parent.addBinding(node as object, key, params);
      if (api?.element && typeof api.element.addEventListener === 'function' && onHoverPath) {
        api.element.addEventListener('mouseenter', () => onHoverPath(p));
        api.element.addEventListener('mouseleave', () => onHoverPath(null));
      }
      if (!m.readonly) {
        api.on('change', (ev?: any) => {
          const isLast = ev ? (ev.last !== false) : true;
          onChange(p, (node as Obj)[key] as number, isLast);
        });
        if (nudgeContext) {
          attachNudgeControls(api, {
            path: p,
            node: node as Obj,
            key,
            meta: m,
            history: nudgeContext.history,
            pane: nudgeContext.pane,
            storage: nudgeContext.storage,
            base: nudgeContext.base,
            doc: nudgeContext.doc,
            updateButtons: nudgeContext.updateButtons,
          });
        }
      }
    } else if (isContainer(v)) {
      const folder = parent.addFolder({ title: key, expanded: false });
      const folderEl = (folder as any)?.element;
      if (folderEl && typeof folderEl.addEventListener === 'function' && onHoverPath) {
        const titleBtn = folderEl.querySelector?.('.tp-fldv_t') || folderEl.querySelector?.('button') || folderEl;
        titleBtn.addEventListener?.('mouseenter', () => onHoverPath(p));
        titleBtn.addEventListener?.('mouseleave', () => onHoverPath(null));
      }
      addLayoutFolder(folder, v, p, metas, onChange, nudgeContext, onHoverPath);
    }
  }
}

/**
 * Tweakpane 레이아웃 패널을 화면 우측에 붙인다. 이미 있으면 null.
 * 장면 이동 패널(#dg-dev-scene-jumper, 좌상단)과 겹치지 않는다.
 */
export async function mountDevLayoutPanel(
  app: unknown,
  doc: Document = document,
  opts: MountLayoutPanelOptions = {},
): Promise<DevLayoutPanelHandle | null> {
  if (doc.getElementById(DEV_LAYOUT_PANEL_ID)) return null;
  const container = doc.createElement('div');
  container.id = DEV_LAYOUT_PANEL_ID;
  Object.assign(container.style, {
    position: 'fixed',
    top: '0px',
    right: '0px',
    width: '320px',
    maxHeight: '100vh',
    overflowY: 'auto',
    zIndex: '99999',
  });
  doc.body.appendChild(container);

  const pane = await (opts.createPane ?? defaultCreatePane)(container);
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const download = opts.download ?? defaultDownload;
  const fileOverride = opts.fileOverride === undefined ? await fetchFileOverride() : opts.fileOverride;
  const history = opts.history ?? new DevLayoutHistory();

  // 기준값 = 부팅 시 값(기본값 + ui-layout.json). 기존 파일 항목은 내보내기에 항상 포함한다.
  const base = snapshotLayout(UI_LAYOUT);
  const baseAssault = snapshotLayout(ASSAULT_VISUAL);

  let pinned: Set<string>;
  let pinnedAssault: Set<string>;

  if (fileOverride && typeof fileOverride === 'object') {
    const fo = fileOverride as Record<string, unknown>;
    if ('ui' in fo || 'assault' in fo) {
      const res = applyMultiLayoutOverride(
        { ui: snapshotLayout(base), assault: snapshotLayout(baseAssault) },
        fileOverride,
      );
      pinned = new Set(res.applied.filter((p) => p.startsWith('ui.')).map((p) => p.slice(3)));
      pinnedAssault = new Set(
        res.applied.filter((p) => p.startsWith('assault.')).map((p) => p.slice(8)),
      );
    } else {
      pinned = new Set(applyLayoutOverride(snapshotLayout(base), fileOverride).applied);
      pinnedAssault = new Set();
    }
  } else {
    pinned = new Set();
    pinnedAssault = new Set();
  }

  // 저장된 diff 복원
  if (storage) {
    const raw = storage.getItem(DEV_LAYOUT_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && ('ui' in parsed || 'assault' in parsed)) {
          applyMultiLayoutOverride({ ui: UI_LAYOUT, assault: ASSAULT_VISUAL }, parsed);
        } else {
          applyLayoutOverride(UI_LAYOUT, parsed);
        }
      } catch {
        console.warn('[DEV UI] 저장된 레이아웃 변경분이 손상되어 무시합니다.');
      }
    }
  }

  const sm = (app as AppLike | null)?.stateMachine;
  const sections = new Set(getSectionsForState(sm?.currentState ?? ''));

  const uiMetas = flattenLayoutBindings(UI_LAYOUT, DEV_UI_LOCKED_LAYOUT_PATHS);
  const assaultMetas = flattenLayoutBindings(ASSAULT_VISUAL, []).map((b) => ({
    ...b,
    path: `assault.${b.path}`,
  }));

  const metas = new Map<string, LayoutBinding>([
    ...uiMetas.map((b) => [b.path, b] as [string, LayoutBinding]),
    ...assaultMetas.map((b) => [b.path, b] as [string, LayoutBinding]),
  ]);

  for (const [path, m] of metas) {
    if (!m.readonly) {
      history.setValue(path, (m.target as Record<string, number>)[m.key]);
    }
  }

  let actionMenu = doc.getElementById(DEV_ACTION_MENU_ID);
  if (!actionMenu) {
    const jumper = doc.getElementById('dg-dev-scene-jumper');
    if (jumper) {
      actionMenu = doc.createElement('div');
      actionMenu.id = DEV_ACTION_MENU_ID;
      Object.assign(actionMenu.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '4px',
        marginTop: '6px',
      });
      jumper.appendChild(actionMenu);
    } else {
      actionMenu = doc.createElement('div');
      actionMenu.id = DEV_ACTION_MENU_ID;
      Object.assign(actionMenu.style, {
        position: 'fixed',
        top: '72px',
        left: '0px',
        zIndex: '99999',
        padding: '4px 6px',
        background: 'rgba(20,20,40,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '4px',
      });
      doc.body.appendChild(actionMenu);
    }
  }

  const createActionButton = (title: string, id: string, disabled = false) => {
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
    actionMenu!.appendChild(btn);
    return btn;
  };

  const undoBtn = createActionButton('↶ Undo', DEV_UNDO_BTN_ID, true);
  const redoBtn = createActionButton('↷ Redo', DEV_REDO_BTN_ID, true);
  const exportBtn = createActionButton(
    `내보내기 (${DEV_LAYOUT_EXPORT_DIR}${DEV_LAYOUT_EXPORT_FILENAME})`,
    DEV_EXPORT_BTN_ID,
    false,
  );
  const resetBtn = createActionButton('전체 초기화', DEV_RESET_BTN_ID, false);

  const updateButtons = () => {
    const canUndo = history.canUndo();
    const canRedo = history.canRedo();
    undoBtn.disabled = !canUndo;
    undoBtn.style.opacity = canUndo ? '1.0' : '0.45';
    undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';

    redoBtn.disabled = !canRedo;
    redoBtn.style.opacity = canRedo ? '1.0' : '0.45';
    redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
  };

  const saveDiff = () => {
    if (!storage) return;
    const uiDiff = buildLayoutDiff(UI_LAYOUT, base);
    const assaultDiff = buildLayoutDiff(ASSAULT_VISUAL, baseAssault);
    const hasAssault = Object.keys(assaultDiff).length > 0;
    const hasUi = Object.keys(uiDiff).length > 0;

    if (opts.multiSource || hasAssault) {
      if (!hasUi && !hasAssault) {
        storage.removeItem(DEV_LAYOUT_STORAGE_KEY);
      } else {
        storage.setItem(
          DEV_LAYOUT_STORAGE_KEY,
          JSON.stringify({ version: 1, ui: uiDiff, assault: assaultDiff }),
        );
      }
    } else {
      if (!hasUi) {
        storage.removeItem(DEV_LAYOUT_STORAGE_KEY);
      } else {
        storage.setItem(DEV_LAYOUT_STORAGE_KEY, JSON.stringify(uiDiff));
      }
    }
  };

  const applyPath = (path: string, val: number) => {
    if (path.startsWith('assault.')) {
      applyPathValue(ASSAULT_VISUAL, path.slice('assault.'.length), val);
    } else if (path.startsWith('ui.')) {
      applyPathValue(UI_LAYOUT, path.slice('ui.'.length), val);
    } else {
      applyPathValue(UI_LAYOUT, path, val);
    }
  };

  const performUndo = () => {
    const entry = history.undo();
    if (!entry) return;
    const items = DevLayoutHistory.toItems(entry);
    for (const item of items) {
      applyPath(item.path, item.before);
    }
    pane.refresh();
    saveDiff();
    updateButtons();
  };

  const performRedo = () => {
    const entry = history.redo();
    if (!entry) return;
    const items = DevLayoutHistory.toItems(entry);
    for (const item of items) {
      applyPath(item.path, item.after);
    }
    pane.refresh();
    saveDiff();
    updateButtons();
  };

  undoBtn.on('click', () => {
    if (history.canUndo()) {
      performUndo();
    }
  });

  redoBtn.on('click', () => {
    if (history.canRedo()) {
      performRedo();
    }
  });

  const onChange = (path: string, val: number, isLast: boolean) => {
    history.recordChange(path, val, isLast);
    if (isLast) {
      saveDiff();
      updateButtons();
    }
  };

  exportBtn.on('click', async () => {
    const isMulti =
      opts.multiSource || Object.keys(buildLayoutDiff(ASSAULT_VISUAL, baseAssault)).length > 0;
    const out = isMulti
      ? buildMultiLayoutExport({
          ui: { current: UI_LAYOUT, base, pinned },
          assault: { current: ASSAULT_VISUAL, base: baseAssault, pinned: pinnedAssault },
        })
      : buildLayoutExport(UI_LAYOUT, base, pinned);
    if (out.warnings.length > 0) console.warn('[DEV UI] 내보내기 검증 경고:', out.warnings);
    await saveLayoutExport(out, {
      download,
      showSaveFilePicker: opts.showSaveFilePicker,
    });
  });

  resetBtn.on('click', () => {
    const batch: LayoutChangeItem[] = [];
    for (const [path, m] of metas) {
      if (!m.readonly) {
        const curVal = (m.target as Record<string, number>)[m.key];
        const baseVal = path.startsWith('assault.')
          ? (getPathValue(baseAssault, path.slice('assault.'.length)) as number)
          : (getPathValue(base, path) as number);
        if (typeof baseVal === 'number' && curVal !== baseVal) {
          batch.push({ path, before: curVal, after: baseVal });
        }
      }
    }
    if (batch.length > 0) {
      history.push(batch);
    }
    resetLayoutTo(UI_LAYOUT, base);
    resetLayoutTo(ASSAULT_VISUAL, baseAssault);
    saveDiff();
    pane.refresh();
    updateButtons();
  });

  const nudgeContext = {
    history,
    pane,
    storage,
    base,
    doc,
    updateButtons,
  };

  const notifyHover = (p: string | null) => {
    opts.onHoverPath?.(p);
    getActiveInspectorOverlay()?.setHighlightedPath(p);
  };

  const sectionFolders = new Map<string, FolderLike>();
  for (const section of Object.keys(UI_LAYOUT)) {
    const folder = pane.addFolder({ title: section, expanded: sections.has(section) });
    sectionFolders.set(section, folder);
    addLayoutFolder(
      folder,
      (UI_LAYOUT as unknown as Obj)[section] as Obj,
      section,
      metas,
      onChange,
      nudgeContext,
      notifyHover,
    );
  }

  // [DEVUI-008] ASSAULT_VISUAL 다중 소스 폴더 바인딩
  const assaultFolder = pane.addFolder({
    title: 'assault',
    expanded: sections.has('assault') || sections.has('ASSAULT_VISUAL'),
  });
  sectionFolders.set('assault', assaultFolder);
  addLayoutFolder(
    assaultFolder,
    ASSAULT_VISUAL as Obj,
    'assault',
    metas,
    onChange,
    nudgeContext,
    notifyHover,
  );

  const lockedRoot = pane.addFolder({ title: '판정 연동 좌표 (읽기 전용)', expanded: false });
  for (const source of getDevUiLockedSources()) {
    const folder = lockedRoot.addFolder({ title: source.title, expanded: false });
    for (const key of Object.keys(source.values)) {
      const api = folder.addBinding(source.values, key, { label: key, readonly: true });
      if (api?.element && typeof api.element.addEventListener === 'function') {
        const lockedPath = `${source.id}.${key}`;
        api.element.addEventListener('mouseenter', () => notifyHover(lockedPath));
        api.element.addEventListener('mouseleave', () => notifyHover(null));
      }
    }
  }

  const handleKeyDown = (ev: KeyboardEvent) => {
    const active = doc.activeElement as HTMLElement | null;
    if (active) {
      const tag = active.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable) {
        if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
          if ((ev as any).__dgNudgeHandled) return;
          const path =
            active.getAttribute?.('data-dg-layout-path') ??
            active.closest?.('[data-dg-nudge-path]')?.getAttribute?.('data-dg-nudge-path') ??
            active.closest?.('.tp-lblv')?.querySelector?.('[data-dg-nudge-path]')?.getAttribute?.('data-dg-nudge-path');
          if (path && metas.has(path) && !metas.get(path)!.readonly) {
            (ev as any).__dgNudgeHandled = true;
            ev.preventDefault?.();
            ev.stopPropagation?.();
            const m = metas.get(path)!;
            const dir: 1 | -1 = ev.key === 'ArrowUp' ? 1 : -1;
            const cur = (m.target as Record<string, number>)[m.key];
            const next = nudgeValue(cur, dir, !!ev.shiftKey, 1, m.min, m.max);
            if (next !== cur) {
              history.beginDrag(path, cur);
              (m.target as Record<string, number>)[m.key] = next;
              history.endDrag(path, next);
              pane.refresh();
              saveDiff();
              updateButtons();
              if ('value' in active) {
                (active as any).value = String(next);
              }
            }
            return;
          }
        }
        return;
      }
    }

    const isCtrlOrMeta = ev.ctrlKey || ev.metaKey;
    if (!isCtrlOrMeta) return;

    const key = ev.key ? ev.key.toLowerCase() : '';
    if (key === 'z' && !ev.shiftKey) {
      if (history.canUndo()) {
        ev.preventDefault?.();
        performUndo();
      }
      return;
    }

    if (key === 'y' || (key === 'z' && ev.shiftKey)) {
      if (history.canRedo()) {
        ev.preventDefault?.();
        performRedo();
      }
      return;
    }
  };

  if (typeof doc?.addEventListener === 'function') {
    doc.addEventListener('keydown', handleKeyDown);
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  if (opts.watchState !== false && sm) {
    let last = sm.currentState;
    timer = setInterval(() => {
      if (sm.currentState === last) return;
      last = sm.currentState;
      const open = new Set(getSectionsForState(last));
      for (const [name, folder] of sectionFolders) folder.expanded = open.has(name);
    }, 300);
  }

  return {
    pane,
    history,
    undo: performUndo,
    redo: performRedo,
    actionMenu,
    buttons: {
      undo: undoBtn,
      redo: redoBtn,
      export: exportBtn,
      reset: resetBtn,
    },
    dispose() {
      notifyHover(null);
      if (typeof doc?.removeEventListener === 'function') {
        doc.removeEventListener('keydown', handleKeyDown);
      }
      if (timer) clearInterval(timer);
      actionMenu?.remove?.();
      pane.dispose();
    },
  };
}
