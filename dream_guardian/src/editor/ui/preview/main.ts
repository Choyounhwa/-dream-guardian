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
import type { ChildBridge } from "./UIVisualBridge";
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

/**
 * 브라우저 환경에서 ui-preview.html 로드 시 DOM 마운트 초기화
 */
export function initPreviewApp(containerElement?: HTMLElement): PreviewCanvasMountInstance | null {
  if (typeof document === "undefined") {
    return null;
  }
  const target = containerElement ?? document.getElementById("preview");
  if (!target) {
    return null;
  }
  return mountPreviewCanvas({
    container: target,
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
