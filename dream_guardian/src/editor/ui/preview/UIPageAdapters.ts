/**
 * UIPageAdapters.ts - 실제 Canvas 마운트 및 페이지 렌더 디스패처 (Issue #438 / UI-VIS-008)
 *
 * 개발 규칙 및 명세 준수:
 * 1. 실제 1080x2160 Artboard Canvas 마운트 및 DPR/Letterbox 레이아웃
 * 2. 10개 화면 대상 페이지별 렌더 어댑터 레지스트리 (PageAdapterRegistry)
 * 3. 결정론적 fixture (clockMs, seed, assetResolver) 주입
 * 4. 미지원 페이지 렌더 요청 시 거짓 성공(drew: true) 방지 -> { ok: false, drew: false, reason: "unsupported-page" }
 * 5. 지연된 stale revision 스냅샷 요청 시 렌더 거부 -> { ok: false, drew: false, reason: "stale-revision" }
 * 6. ChildBridge 연동 및 양방향 preview:snapshot / preview:result 메시지 처리
 * 7. 보안 및 격리: 게임 루프, AppBootstrap, 카메라, TTS 등 게임 런타임 호출 0건 보장
 */

import type { ChildBridge, UIVisualBridgeEnvelope } from './UIVisualBridge';
import {
  homePageAdapter,
  MAIN_HOME_PAGE_ID,
  registerHomePageAdapter,
} from './screens/UIHomePage';
import {
  submenuPageAdapter,
  SUBMENU_PAGE_ID,
  MENU_SUB_PAGE_ID,
  registerSubmenuPageAdapter,
} from './screens/UISubmenuPage';
import {
  optionsPageAdapter,
  settingsPageAdapter,
  OPTIONS_PAGE_ID,
  SETTINGS_PAGE_ID,
  registerOptionsPageAdapter,
} from './screens/UISettingsPage';
import {
  pausePageAdapter,
  PAUSE_PAGE_ID,
  registerPausePageAdapter,
} from './screens/UIPausePage';

export const ARTBOARD_WIDTH = 1080;
export const ARTBOARD_HEIGHT = 2160;
export const ARTBOARD_ASPECT_RATIO = ARTBOARD_WIDTH / ARTBOARD_HEIGHT; // 0.5

export interface LetterboxLayout {
  valid: boolean;
  scale: number;
  renderWidth: number;
  renderHeight: number;
  offsetX: number;
  offsetY: number;
  dpr: number;
  canvasPixelWidth: number;
  canvasPixelHeight: number;
}

/**
 * 컨테이너 종횡비에 맞춘 1080x2160 Artboard Letterbox/Pillarbox 레이아웃 계산
 */
export function computeLetterboxLayout(
  containerWidth: number,
  containerHeight: number,
  dpr = 1
): LetterboxLayout {
  const effectiveDpr = dpr > 0 ? dpr : 1;
  if (containerWidth <= 0 || containerHeight <= 0) {
    return {
      valid: false,
      scale: 0,
      renderWidth: 0,
      renderHeight: 0,
      offsetX: 0,
      offsetY: 0,
      dpr: effectiveDpr,
      canvasPixelWidth: 0,
      canvasPixelHeight: 0,
    };
  }

  const containerAspect = containerWidth / containerHeight;
  const targetAspect = ARTBOARD_ASPECT_RATIO;
  let scale = 1;
  let renderWidth = 0;
  let renderHeight = 0;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > targetAspect) {
    // 컨테이너가 더 넓음 -> Pillarbox (좌우 여백)
    scale = containerHeight / ARTBOARD_HEIGHT;
    renderWidth = Math.round(ARTBOARD_WIDTH * scale);
    renderHeight = Math.round(containerHeight);
    offsetX = Math.round((containerWidth - renderWidth) / 2);
    offsetY = 0;
  } else {
    // 컨테이너가 더 좁거나 김 -> Letterbox (상하 여백)
    scale = containerWidth / ARTBOARD_WIDTH;
    renderWidth = Math.round(containerWidth);
    renderHeight = Math.round(ARTBOARD_HEIGHT * scale);
    offsetX = 0;
    offsetY = Math.round((containerHeight - renderHeight) / 2);
  }

  const canvasPixelWidth = Math.round(ARTBOARD_WIDTH * effectiveDpr);
  const canvasPixelHeight = Math.round(ARTBOARD_HEIGHT * effectiveDpr);

  return {
    valid: true,
    scale,
    renderWidth,
    renderHeight,
    offsetX,
    offsetY,
    dpr: effectiveDpr,
    canvasPixelWidth,
    canvasPixelHeight,
  };
}

/**
 * 결정론적 Fixture 인터페이스 (고정 클록, 고정 시드, 자산 리졸버)
 */
export interface DeterministicFixture {
  readonly clockMs: number;
  readonly seed: number;
  readonly assetResolver: (assetId: string) => string | HTMLImageElement | null;
}

export function createDeterministicFixture(
  overrides?: Partial<DeterministicFixture>
): DeterministicFixture {
  return Object.freeze({
    clockMs: overrides?.clockMs ?? 0,
    seed: overrides?.seed ?? 12345,
    assetResolver: overrides?.assetResolver ?? ((assetId: string) => `asset://${assetId}`),
    ...(overrides as any),
  });
}

export interface PageRenderBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pageId: string;
  snapshot: unknown;
  selectedElementIds?: readonly string[];
  fixture: DeterministicFixture;
  dpr: number;
  artboardWidth: number;
  artboardHeight: number;
  layout: LetterboxLayout;
}

export interface PageRenderResult {
  ok: boolean;
  drew: boolean;
  pageId: string;
  renderedElementCount?: number;
  renderedBounds?: PageRenderBounds[];
  reason?: string;
  timestamp?: number;
  revision?: number;
  generation?: number;
}

export type PageAdapter = (ctx: PageRenderContext) => PageRenderResult;

/**
 * 10개 화면 대상 페이지별 렌더 어댑터 레지스트리
 */
export class PageAdapterRegistry {
  private readonly _adapters = new Map<string, PageAdapter>();

  register(pageId: string, adapter: PageAdapter): void {
    if (!pageId || typeof pageId !== 'string') {
      throw new Error('Invalid pageId for page adapter registration');
    }
    if (typeof adapter !== 'function') {
      throw new Error(`Invalid adapter function for pageId: ${pageId}`);
    }
    this._adapters.set(pageId, adapter);
  }

  unregister(pageId: string): boolean {
    return this._adapters.delete(pageId);
  }

  get(pageId: string): PageAdapter | undefined {
    return this._adapters.get(pageId);
  }

  has(pageId: string): boolean {
    return this._adapters.has(pageId);
  }

  clear(): void {
    this._adapters.clear();
  }

  listPages(): string[] {
    return Array.from(this._adapters.keys());
  }
}

export const defaultPageAdapterRegistry = new PageAdapterRegistry();
registerHomePageAdapter(defaultPageAdapterRegistry);
registerSubmenuPageAdapter(defaultPageAdapterRegistry);
registerOptionsPageAdapter(defaultPageAdapterRegistry);
registerPausePageAdapter(defaultPageAdapterRegistry);

export { homePageAdapter, MAIN_HOME_PAGE_ID, registerHomePageAdapter };
export {
  submenuPageAdapter,
  SUBMENU_PAGE_ID,
  MENU_SUB_PAGE_ID,
  registerSubmenuPageAdapter,
};
export {
  optionsPageAdapter,
  settingsPageAdapter,
  OPTIONS_PAGE_ID,
  SETTINGS_PAGE_ID,
  registerOptionsPageAdapter,
};
export {
  pausePageAdapter,
  PAUSE_PAGE_ID,
  registerPausePageAdapter,
};

export function registerPageAdapter(pageId: string, adapter: PageAdapter): void {
  defaultPageAdapterRegistry.register(pageId, adapter);
}

export function unregisterPageAdapter(pageId: string): boolean {
  return defaultPageAdapterRegistry.unregister(pageId);
}

export function getPageAdapter(pageId: string): PageAdapter | undefined {
  return defaultPageAdapterRegistry.get(pageId);
}

export function hasPageAdapter(pageId: string): boolean {
  return defaultPageAdapterRegistry.has(pageId);
}

export function clearPageAdapters(): void {
  defaultPageAdapterRegistry.clear();
}

export function listRegisteredPageAdapters(): string[] {
  return defaultPageAdapterRegistry.listPages();
}

export interface DispatchPageRenderOptions {
  canvas: HTMLCanvasElement;
  pageId: string;
  snapshot: unknown;
  selectedElementIds?: readonly string[];
  fixture?: Partial<DeterministicFixture>;
  currentRevision?: number;
  snapshotRevision?: number;
  currentGeneration?: number;
  snapshotGeneration?: number;
  registry?: PageAdapterRegistry;
  dpr?: number;
  layout?: LetterboxLayout;
}

/**
 * 대상 페이지 어댑터를 찾아 Canvas에 렌더링을 디스패치
 */
export function dispatchPageRender(options: DispatchPageRenderOptions): PageRenderResult {
  const { pageId } = options;

  // 1. Generation 검증
  if (
    options.snapshotGeneration !== undefined &&
    options.currentGeneration !== undefined &&
    options.snapshotGeneration < options.currentGeneration
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-generation',
      timestamp: Date.now(),
      revision: options.snapshotRevision,
      generation: options.snapshotGeneration,
    };
  }

  // 2. Revision 검증 (지연된/과거 스냅샷 렌더 거부)
  if (
    options.snapshotRevision !== undefined &&
    options.currentRevision !== undefined &&
    options.snapshotRevision < options.currentRevision
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-revision',
      timestamp: Date.now(),
      revision: options.snapshotRevision,
      generation: options.snapshotGeneration,
    };
  }

  // 3. 어댑터 등록 확인 (미등록 페이지는 거짓 성공 drew: true를 보고하지 않고 명시적 거부)
  const registry = options.registry ?? defaultPageAdapterRegistry;
  const adapter = registry.get(pageId);

  if (!adapter) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
      revision: options.snapshotRevision,
      generation: options.snapshotGeneration,
    };
  }

  // 4. Canvas 2D 컨텍스트 획득
  const ctx = options.canvas.getContext('2d');
  if (!ctx) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'canvas-context-unavailable',
      timestamp: Date.now(),
      revision: options.snapshotRevision,
      generation: options.snapshotGeneration,
    };
  }

  // 5. 이전 렌더링 영역 클리어 (아트보드 논리 좌표계)
  ctx.clearRect(0, 0, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 6. 결정론적 fixture 및 레이아웃 컨텍스트 조립
  const fixture = createDeterministicFixture(options.fixture);
  const layout =
    options.layout ??
    computeLetterboxLayout(
      options.canvas.clientWidth || ARTBOARD_WIDTH,
      options.canvas.clientHeight || ARTBOARD_HEIGHT,
      options.dpr ?? 1
    );

  const renderContext: PageRenderContext = {
    canvas: options.canvas,
    ctx,
    pageId,
    snapshot: options.snapshot,
    selectedElementIds: options.selectedElementIds,
    fixture,
    dpr: options.dpr ?? 1,
    artboardWidth: ARTBOARD_WIDTH,
    artboardHeight: ARTBOARD_HEIGHT,
    layout,
  };

  try {
    const result = adapter(renderContext);
    return {
      ...result,
      pageId,
      timestamp: Date.now(),
      revision: options.snapshotRevision,
      generation: options.snapshotGeneration,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      drew: false,
      pageId,
      reason: `adapter-error: ${message}`,
      timestamp: Date.now(),
      revision: options.snapshotRevision,
      generation: options.snapshotGeneration,
    };
  }
}

export interface MountPreviewCanvasOptions {
  container: HTMLElement;
  canvas?: HTMLCanvasElement;
  dpr?: number;
  registry?: PageAdapterRegistry;
  bridge?: ChildBridge;
  fixture?: Partial<DeterministicFixture>;
  onRenderResult?: (result: PageRenderResult) => void;
  window?: Window;
}

export interface PreviewCanvasMountInstance {
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly registry: PageAdapterRegistry;
  getLayout(): LetterboxLayout;
  updateLayout(): LetterboxLayout;
  dispatch(
    pageId: string,
    snapshot: unknown,
    options?: {
      revision?: number;
      generation?: number;
      selectedElementIds?: readonly string[];
    }
  ): PageRenderResult;
  getRevision(): number;
  getGeneration(): number;
  setRevision(rev: number): void;
  setGeneration(gen: number): void;
  dispose(): void;
  isDisposed(): boolean;
}

/**
 * Preview Frame 내에 1080x2160 Artboard Canvas 마운트 및 Bridge/Dispatcher 연동
 */
export function mountPreviewCanvas(options: MountPreviewCanvasOptions): PreviewCanvasMountInstance {
  const win = options.window ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = win?.document ?? (typeof document !== 'undefined' ? document : undefined);

  let canvas = options.canvas;
  if (!canvas) {
    if (doc && typeof doc.createElement === 'function') {
      canvas = doc.createElement('canvas');
    } else {
      // Fallback dummy canvas for headless/node test without DOM
      const dummyStyle: Record<string, string> = {};
      canvas = {
        clientWidth: 0,
        clientHeight: 0,
        width: 0,
        height: 0,
        style: dummyStyle,
        getContext: () => null,
      } as unknown as HTMLCanvasElement;
    }
  }

  if (options.container && !options.container.contains?.(canvas)) {
    options.container.appendChild(canvas);
  }

  const dpr = options.dpr ?? (win?.devicePixelRatio || 1);
  const registry = options.registry ?? defaultPageAdapterRegistry;

  let currentGeneration = 1;
  let currentRevision = 1;
  let lastPageId: string | null = null;
  let lastSnapshot: unknown = null;
  let lastSelectedElementIds: readonly string[] = [];
  let disposed = false;

  let layout = computeLetterboxLayout(options.container.clientWidth, options.container.clientHeight, dpr);

  function applyLayout(nextLayout: LetterboxLayout) {
    layout = nextLayout;
    if (layout.valid && canvas) {
      canvas.style.position = 'absolute';
      canvas.style.left = `${layout.offsetX}px`;
      canvas.style.top = `${layout.offsetY}px`;
      canvas.style.width = `${layout.renderWidth}px`;
      canvas.style.height = `${layout.renderHeight}px`;
      canvas.width = layout.canvasPixelWidth;
      canvas.height = layout.canvasPixelHeight;

      const ctx = canvas.getContext('2d');
      if (ctx && typeof ctx.setTransform === 'function') {
        ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
      }
    }
  }

  applyLayout(layout);

  function dispatch(
    pageId: string,
    snapshot: unknown,
    dispatchOpts?: {
      revision?: number;
      generation?: number;
      selectedElementIds?: readonly string[];
    }
  ): PageRenderResult {
    if (disposed) {
      return { ok: false, drew: false, pageId, reason: 'disposed' };
    }

    const reqGen = dispatchOpts?.generation ?? currentGeneration;
    const reqRev = dispatchOpts?.revision ?? currentRevision;
    const selectedIds = dispatchOpts?.selectedElementIds ?? lastSelectedElementIds;

    const result = dispatchPageRender({
      canvas: canvas!,
      pageId,
      snapshot,
      selectedElementIds: selectedIds,
      fixture: options.fixture,
      currentRevision,
      snapshotRevision: reqRev,
      currentGeneration,
      snapshotGeneration: reqGen,
      registry,
      dpr,
      layout,
    });

    if (result.ok && result.drew) {
      currentRevision = Math.max(currentRevision, reqRev);
      currentGeneration = Math.max(currentGeneration, reqGen);
      lastPageId = pageId;
      lastSnapshot = snapshot;
      lastSelectedElementIds = selectedIds;
    }

    options.onRenderResult?.(result);
    return result;
  }

  function updateLayout(): LetterboxLayout {
    if (disposed) return layout;
    const nextLayout = computeLetterboxLayout(
      options.container.clientWidth,
      options.container.clientHeight,
      dpr
    );
    applyLayout(nextLayout);
    if (lastPageId && lastSnapshot !== null) {
      dispatch(lastPageId, lastSnapshot, {
        revision: currentRevision,
        generation: currentGeneration,
        selectedElementIds: lastSelectedElementIds,
      });
    }
    return layout;
  }

  let resizeObserver: any = null;
  if (typeof ResizeObserver !== 'undefined' && options.container) {
    try {
      resizeObserver = new ResizeObserver(() => {
        if (!disposed) {
          updateLayout();
        }
      });
      resizeObserver.observe(options.container);
    } catch {
      // Ignore if ResizeObserver is not supported
    }
  }

  const onWindowResize = () => {
    if (!disposed) {
      updateLayout();
    }
  };
  win?.addEventListener?.('resize', onWindowResize);

  // ChildBridge 연동
  let originalBridgeOnMessage: ((envelope: UIVisualBridgeEnvelope) => void) | undefined = undefined;
  if (options.bridge) {
    const bridgeAny = options.bridge as any;
    originalBridgeOnMessage = bridgeAny._onMessage;

    bridgeAny._onMessage = (envelope: UIVisualBridgeEnvelope) => {
      originalBridgeOnMessage?.(envelope);
      if (disposed) return;

      if (envelope.kind === 'preview:snapshot') {
        const pageId = envelope.pageId;
        const res = dispatch(pageId, envelope.payload, {
          revision: envelope.revision,
          generation: envelope.generation,
        });
        options.bridge?.send('preview:result', res, envelope.requestId);
      } else if (envelope.kind === 'preview:selection') {
        const payload = envelope.payload as { selectedElementIds?: string[] } | undefined;
        lastSelectedElementIds = payload?.selectedElementIds ?? [];
        if (lastPageId && lastSnapshot !== null) {
          const res = dispatch(lastPageId, lastSnapshot, {
            revision: currentRevision,
            generation: currentGeneration,
            selectedElementIds: lastSelectedElementIds,
          });
          options.bridge?.send('preview:result', res, envelope.requestId);
        }
      }
    };

    options.bridge.send('preview:ready', {
      artboardWidth: ARTBOARD_WIDTH,
      artboardHeight: ARTBOARD_HEIGHT,
    });
  }

  const instance: PreviewCanvasMountInstance = {
    get canvas() {
      return canvas!;
    },
    get container() {
      return options.container;
    },
    get registry() {
      return registry;
    },
    getLayout() {
      return layout;
    },
    updateLayout,
    dispatch,
    getRevision() {
      return currentRevision;
    },
    getGeneration() {
      return currentGeneration;
    },
    setRevision(rev: number) {
      currentRevision = rev;
    },
    setGeneration(gen: number) {
      currentGeneration = gen;
    },
    isDisposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      win?.removeEventListener?.('resize', onWindowResize);

      if (options.bridge) {
        const bridgeAny = options.bridge as any;
        bridgeAny._onMessage = originalBridgeOnMessage;
      }

      if (canvas) {
        if (typeof (canvas as any).remove === 'function') {
          (canvas as any).remove();
        } else if (options.container && typeof options.container.removeChild === 'function') {
          try {
            options.container.removeChild(canvas);
          } catch {
            // Container may already have removed it
          }
        }
      }
    },
  };

  return instance;
}
