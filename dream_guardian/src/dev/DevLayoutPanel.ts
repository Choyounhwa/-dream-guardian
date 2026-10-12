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
import {
  DEV_UI_SECTION_MAP,
  DEV_UI_LOCKED_LAYOUT_PATHS,
  getDevUiLockedSources,
} from '../../config/dev-ui.config.js';
import {
  applyLayoutOverride,
  UI_LAYOUT_OVERRIDE_URL,
  type LayoutOverrideResult,
} from '../core/UILayoutOverride.js';
import {
  DevLayoutHistory,
  type LayoutChangeItem,
} from './DevLayoutHistory.js';

export const DEV_LAYOUT_PANEL_ID = 'dg-dev-layout-panel';
export const DEV_LAYOUT_STORAGE_KEY = 'dg-dev-ui-layout-diff';
export const DEV_LAYOUT_EXPORT_DIR = 'public/layouts/';
export const DEV_LAYOUT_EXPORT_FILENAME = 'ui-layout.json';
export const DEV_LAYOUT_LOAD_URL = UI_LAYOUT_OVERRIDE_URL;

const VIRTUAL_WIDTH = 1080;
const VIRTUAL_HEIGHT = 2160;
// UILayoutOverride 검증 규칙과 동일한 키 분류
const HORIZONTAL_KEYS = new Set(['x', 'w', 'width', 'startX', 'gapX', 'cardWidth', 'marginRight']);
const SIZE_KEYS = new Set(['w', 'h', 'width', 'height', 'cardWidth', 'cardHeight', 'cols']);

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

function bindingRange(key: string): { min: number; max: number } {
  return {
    min: SIZE_KEYS.has(key) ? 1 : 0,
    max: HORIZONTAL_KEYS.has(key) ? VIRTUAL_WIDTH : VIRTUAL_HEIGHT,
  };
}

/** UI_LAYOUT 의 모든 숫자 필드를 바인딩 목록으로 평탄화한다 (target 은 원본 객체 참조) */
export function flattenLayoutBindings(root: object, locked: readonly string[]): LayoutBinding[] {
  const out: LayoutBinding[] = [];
  const walk = (node: Obj | unknown[], path: string) => {
    for (const key of Object.keys(node)) {
      const p = path ? `${path}.${key}` : key;
      const v = (node as Obj)[key];
      if (typeof v === 'number') {
        out.push({
          path: p,
          target: node as Record<string, number>,
          key,
          ...bindingRange(key),
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

/** 내보낼 JSON 을 만들고 DEVUI-002 검증기로 사전 검증한다 */
export function buildLayoutExport(current: object, base: object, pinned?: ReadonlySet<string>): LayoutExport {
  const diff = buildLayoutDiff(current, base, pinned);
  const json = JSON.stringify(diff, null, 2);
  const { warnings } = applyLayoutOverride(snapshotLayout(base), JSON.parse(json));
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
  return [...(DEV_UI_SECTION_MAP[state] ?? [])];
}

// ─── 패널 마운트 ───

interface ApiLike {
  on(event: string, fn: (ev?: unknown) => void): unknown;
  disabled?: boolean;
}

export interface FolderLike {
  expanded?: boolean;
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
}

export interface DevLayoutPanelHandle {
  pane: PaneLike;
  history?: DevLayoutHistory;
  undo?: () => void;
  redo?: () => void;
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

function addLayoutFolder(
  parent: FolderLike,
  node: Obj | unknown[],
  path: string,
  metas: Map<string, LayoutBinding>,
  onChange: (path: string, val: number, isLast: boolean) => void,
): void {
  for (const key of Object.keys(node)) {
    const p = path ? `${path}.${key}` : key;
    const v = (node as Obj)[key];
    if (typeof v === 'number') {
      const m = metas.get(p)!;
      const params: Record<string, unknown> = { label: key, readonly: m.readonly };
      if (!m.readonly) Object.assign(params, { min: m.min, max: m.max, step: 1 });
      const api = parent.addBinding(node as object, key, params);
      if (!m.readonly) {
        api.on('change', (ev?: any) => {
          const isLast = ev ? (ev.last !== false) : true;
          onChange(p, (node as Obj)[key] as number, isLast);
        });
      }
    } else if (isContainer(v)) {
      addLayoutFolder(parent.addFolder({ title: key, expanded: false }), v, p, metas, onChange);
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
  const pinned = new Set(fileOverride ? applyLayoutOverride(snapshotLayout(base), fileOverride).applied : []);
  restoreLayoutDiff(storage, UI_LAYOUT);

  const sm = (app as AppLike | null)?.stateMachine;
  const sections = new Set(getSectionsForState(sm?.currentState ?? ''));
  const metas = new Map(flattenLayoutBindings(UI_LAYOUT, DEV_UI_LOCKED_LAYOUT_PATHS).map((b) => [b.path, b]));

  for (const [path, m] of metas) {
    if (!m.readonly) {
      history.setValue(path, (m.target as Record<string, number>)[m.key]);
    }
  }

  const undoBtn = pane.addButton({ title: '↶ Undo', disabled: true });
  const redoBtn = pane.addButton({ title: '↷ Redo', disabled: true });

  const updateButtons = () => {
    undoBtn.disabled = !history.canUndo();
    redoBtn.disabled = !history.canRedo();
  };

  const performUndo = () => {
    const entry = history.undo();
    if (!entry) return;
    const items = DevLayoutHistory.toItems(entry);
    for (const item of items) {
      applyPathValue(UI_LAYOUT, item.path, item.before);
    }
    pane.refresh();
    saveLayoutDiff(storage, UI_LAYOUT, base);
    updateButtons();
  };

  const performRedo = () => {
    const entry = history.redo();
    if (!entry) return;
    const items = DevLayoutHistory.toItems(entry);
    for (const item of items) {
      applyPathValue(UI_LAYOUT, item.path, item.after);
    }
    pane.refresh();
    saveLayoutDiff(storage, UI_LAYOUT, base);
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
      saveLayoutDiff(storage, UI_LAYOUT, base);
      updateButtons();
    }
  };

  pane
    .addButton({ title: `내보내기 (${DEV_LAYOUT_EXPORT_DIR}${DEV_LAYOUT_EXPORT_FILENAME})` })
    .on('click', async () => {
      const out = buildLayoutExport(UI_LAYOUT, base, pinned);
      if (out.warnings.length > 0) console.warn('[DEV UI] 내보내기 검증 경고:', out.warnings);
      await saveLayoutExport(out, {
        download,
        showSaveFilePicker: opts.showSaveFilePicker,
      });
    });

  pane.addButton({ title: '전체 초기화' }).on('click', () => {
    const batch: LayoutChangeItem[] = [];
    for (const [path, m] of metas) {
      if (!m.readonly) {
        const curVal = (m.target as Record<string, number>)[m.key];
        const baseVal = getPathValue(base, path);
        if (typeof baseVal === 'number' && curVal !== baseVal) {
          batch.push({ path, before: curVal, after: baseVal });
        }
      }
    }
    if (batch.length > 0) {
      history.push(batch);
    }
    resetLayoutTo(UI_LAYOUT, base);
    saveLayoutDiff(storage, UI_LAYOUT, base);
    pane.refresh();
    updateButtons();
  });

  const sectionFolders = new Map<string, FolderLike>();
  for (const section of Object.keys(UI_LAYOUT)) {
    const folder = pane.addFolder({ title: section, expanded: sections.has(section) });
    sectionFolders.set(section, folder);
    addLayoutFolder(folder, (UI_LAYOUT as unknown as Obj)[section] as Obj, section, metas, onChange);
  }

  const lockedRoot = pane.addFolder({ title: '판정 연동 좌표 (읽기 전용)', expanded: false });
  for (const source of getDevUiLockedSources()) {
    const folder = lockedRoot.addFolder({ title: source.title, expanded: false });
    for (const key of Object.keys(source.values)) {
      folder.addBinding(source.values, key, { label: key, readonly: true });
    }
  }

  const handleKeyDown = (ev: KeyboardEvent) => {
    const active = doc.activeElement as HTMLElement | null;
    if (active) {
      const tag = active.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable) {
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
    dispose() {
      if (typeof doc?.removeEventListener === 'function') {
        doc.removeEventListener('keydown', handleKeyDown);
      }
      if (timer) clearInterval(timer);
      pane.dispose();
    },
  };
}
