import {
  GAME_APPLY_VERIFIED,
  IFRAME_IS_SECURITY_SANDBOX,
  PREVIEW_CONTEXT_ID,
  RENDERER_FINGERPRINT,
  createPreviewSession,
  type PreviewSession,
} from "./UIPreviewAdapter";
import {
  mountPreviewCanvas,
  type PreviewCanvasMountInstance,
} from "./UIPageAdapters";
import { ChildBridge } from "./UIVisualBridge";
import {
  UISelectionOverlay,
  type UISelectionOverlayOptions,
} from "./UISelectionOverlay";

const noopStorage = {
  getItem: (_key: string) => null as string | null,
  setItem: (_key: string, _value: string) => undefined,
  keys: () => [] as string[],
};

const noopNetwork = { send: (_payload: unknown) => undefined };
const noopCamera = { start: () => undefined };
const noopBoot = () => undefined;

export interface PreviewEntryOptions {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement;
  bridge?: ChildBridge;
  dpr?: number;
  overlayOptions?: Partial<UISelectionOverlayOptions>;
}

export function createPreviewEntry(options?: PreviewEntryOptions): {
  PREVIEW_CONTEXT_ID: string;
  IFRAME_IS_SECURITY_SANDBOX: false;
  GAME_APPLY_VERIFIED: false;
  session: PreviewSession;
  mount?: PreviewCanvasMountInstance;
  overlay?: UISelectionOverlay;
} {
  const session = createPreviewSession({
    fingerprint: RENDERER_FINGERPRINT,
    storage: noopStorage,
    network: noopNetwork,
    camera: noopCamera,
    boot: noopBoot,
    cache: new Map(),
    canvas: options?.canvas,
  });

  let mount: PreviewCanvasMountInstance | undefined = undefined;
  let overlay: UISelectionOverlay | undefined = undefined;
  if (options?.container) {
    mount = mountPreviewCanvas({
      container: options.container,
      canvas: options.canvas,
      bridge: options.bridge,
      dpr: options.dpr,
    });

    overlay = new UISelectionOverlay({
      container: options.container,
      renderCanvas: mount.canvas,
      bridge: options.bridge,
      getLayout: () => mount?.getLayout(),
      ...options.overlayOptions,
    });
  }

  return {
    PREVIEW_CONTEXT_ID,
    IFRAME_IS_SECURITY_SANDBOX,
    GAME_APPLY_VERIFIED,
    session,
    mount,
    overlay,
  };
}

export interface InitPreviewAppOptions {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement;
  parentOrigin?: string;
  bridge?: ChildBridge;
  docId?: string;
  pageId?: string;
  sessionId?: string;
  dpr?: number;
}

function resolveParentOrigin(overrideOrigin?: string, win?: any): string {
  if (overrideOrigin && overrideOrigin !== "*") {
    return overrideOrigin;
  }
  const currentWin =
    win ?? (typeof window !== "undefined" ? window : (globalThis as any).window);
  if (currentWin) {
    try {
      if (currentWin.location?.search) {
        const params = new URLSearchParams(currentWin.location.search);
        const qOrigin = params.get("parentOrigin") || params.get("origin");
        if (qOrigin && qOrigin !== "*") {
          return qOrigin;
        }
      }
    } catch {
      // ignore
    }
    try {
      const doc = currentWin.document;
      if (doc?.referrer) {
        const refOrigin = new URL(doc.referrer).origin;
        if (refOrigin && refOrigin !== "null" && refOrigin !== "*") {
          return refOrigin;
        }
      }
    } catch {
      // ignore
    }
    try {
      if (
        currentWin.location?.origin &&
        currentWin.location.origin !== "null" &&
        currentWin.location.origin !== "*"
      ) {
        return currentWin.location.origin;
      }
    } catch {
      // ignore
    }
  }
  return "http://localhost:3000";
}

/**
 * 브라우저 환경에서 ui-preview.html 로드 시 DOM 마운트 초기화 및 ChildBridge 연결
 */
export function initPreviewApp(
  containerOrOptions?: HTMLElement | InitPreviewAppOptions
): PreviewCanvasMountInstance | null {
  const isOptionsObject =
    containerOrOptions &&
    typeof containerOrOptions === "object" &&
    ("container" in containerOrOptions ||
      "bridge" in containerOrOptions ||
      "parentOrigin" in containerOrOptions);

  const opts: InitPreviewAppOptions = isOptionsObject
    ? (containerOrOptions as InitPreviewAppOptions)
    : { container: containerOrOptions as HTMLElement | undefined };

  const doc =
    opts.container?.ownerDocument ??
    (typeof document !== "undefined" ? document : (globalThis as any).document);

  if (!doc) {
    return null;
  }

  const target = opts.container ?? doc.getElementById?.("preview");
  if (!target) {
    return null;
  }

  const win =
    (doc.defaultView as any) ??
    (typeof window !== "undefined" ? window : (globalThis as any).window);

  if (win && !win.document && doc) {
    win.document = doc;
  }

  let bridge = opts.bridge;
  if (!bridge && win && typeof win.addEventListener === "function") {
    try {
      const parentOrigin = resolveParentOrigin(opts.parentOrigin, win);
      bridge = new ChildBridge({
        window: win,
        parentOrigin,
        docId: opts.docId ?? "menu-main",
        pageId: opts.pageId ?? "main_home",
        sessionId: opts.sessionId ?? `sess-child-${Date.now()}`,
        generation: 1,
        revision: 0,
      });
    } catch {
      // ignore bridge creation error in non-standard test stubs
    }
  }

  return mountPreviewCanvas({
    container: target,
    bridge,
    canvas: opts.canvas,
    window: win,
    dpr: opts.dpr,
  });
}

// 자동 브라우저 DOM 마운트 (DOMContentLoaded 또는 스크립트 실행 시점)
if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPreviewApp();
    });
  } else {
    initPreviewApp();
  }
}
