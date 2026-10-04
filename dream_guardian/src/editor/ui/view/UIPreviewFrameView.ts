import {
  IFRAME_IS_SECURITY_SANDBOX,
  type AcceptDecision,
  type PreviewEnvelope,
  type PreviewHost,
  acceptPreviewMessage,
  issueRequest,
  replaceDocument,
} from "../UIPreviewHost";
import { previewAssetPath } from "../UIEditorShell";

export { IFRAME_IS_SECURITY_SANDBOX };

export const PREVIEW_FILE_NAME = "ui-preview.html";
export const SANDBOX_DISCLAIMER_TEXT =
  "iframe은 모듈 분리용이며 보안 샌드박스 보장이 아닙니다 (IFRAME_IS_SECURITY_SANDBOX=false)";

const DISALLOWED_GAME_PATTERNS = [
  "index.html",
  "camera.html",
  "game.html",
  "main.ts",
];

export function resolvePreviewSrc(
  basePath = "",
  fileName = PREVIEW_FILE_NAME
): string | null {
  // Strictly enforce only ui-preview.html
  if (fileName !== PREVIEW_FILE_NAME) {
    return null;
  }

  // Reject external protocols and schemes
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(basePath) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(fileName)
  ) {
    return null;
  }

  // Reject directory traversal
  if (basePath.includes("..") || fileName.includes("..")) {
    return null;
  }

  // Reject game runtime entries
  for (const pattern of DISALLOWED_GAME_PATTERNS) {
    if (basePath.includes(pattern) || fileName.includes(pattern)) {
      return null;
    }
  }

  return previewAssetPath(basePath, fileName);
}

export interface MountPreviewFrameOptions {
  docId?: string;
  origin?: string;
  allowedOrigins?: readonly string[];
  basePath?: string;
  assetFile?: string;
  onStatus?: (message: string) => void;
  onDecision?: (decision: AcceptDecision) => void;
}

export interface PreviewFrameInstance {
  readonly root: HTMLElement;
  readonly iframe: HTMLIFrameElement;
  readonly notice: HTMLElement;
  readonly status: HTMLElement;
  getHost(): PreviewHost;
  updateDocument(docId: string): void;
  handlePreviewMessage(message: PreviewEnvelope): AcceptDecision;
  getLastStatus(): string;
  unmount(): void;
  dispose(): void;
}

export function mountPreviewFrame(
  container: HTMLElement,
  options?: MountPreviewFrameOptions
): PreviewFrameInstance {
  const doc = container.ownerDocument ?? (globalThis as any).document;
  const initialDocId = options?.docId ?? "menu-main";

  const defaultOrigin =
    typeof (globalThis as any).window !== "undefined" &&
    (globalThis as any).window?.location?.origin
      ? (globalThis as any).window.location.origin
      : "http://localhost:3000";

  const origin = options?.origin ?? defaultOrigin;
  const allowedOrigins: readonly string[] = options?.allowedOrigins ?? [
    origin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "null",
    "",
  ];

  let host: PreviewHost = issueRequest({
    docId: initialDocId,
    origin,
  });

  const root = doc.createElement("div");
  root.className = "ui-preview-frame-container";
  root.setAttribute("data-panel", "preview-frame-container");

  // Disclaimer notice
  const notice = doc.createElement("aside");
  notice.className = "preview-sandbox-notice";
  notice.setAttribute("role", "note");
  notice.textContent = SANDBOX_DISCLAIMER_TEXT;
  root.appendChild(notice);

  // Status indicator
  const statusEl = doc.createElement("div");
  statusEl.className = "preview-frame-status";
  statusEl.setAttribute("aria-live", "polite");
  let lastStatus = `미리보기 요청 발급: doc=${host.docId} req=${host.requestId}`;
  statusEl.textContent = lastStatus;
  root.appendChild(statusEl);

  function setStatus(msg: string): void {
    lastStatus = msg;
    statusEl.textContent = msg;
    options?.onStatus?.(msg);
  }

  // Iframe creation
  const resolvedSrc = resolvePreviewSrc(
    options?.basePath ?? "",
    options?.assetFile ?? PREVIEW_FILE_NAME
  );

  const iframe = doc.createElement("iframe") as HTMLIFrameElement;
  iframe.className = "ui-preview-iframe";
  iframe.setAttribute("title", "Dream Guardian UI Preview");
  iframe.setAttribute("data-panel", "preview-frame");

  if (resolvedSrc !== null) {
    iframe.setAttribute("src", resolvedSrc);
  } else {
    setStatus("미리보기 URL 거부: 허용되지 않은 파일 또는 URL");
  }
  root.appendChild(iframe);

  function handlePreviewMessage(message: PreviewEnvelope): AcceptDecision {
    const decision = acceptPreviewMessage(host, message, allowedOrigins);
    options?.onDecision?.(decision);

    if (decision.applied) {
      setStatus(
        `미리보기 반영 완료: doc=${host.docId} req=${String(message.requestId)}`
      );
    } else {
      setStatus(`미리보기 거부: ${decision.reason ?? "unknown"}`);
      // NOTE: 실패 시에도 편집 원본을 롤백하지 않고 상태줄/콜백에 사유만 전달
    }

    return decision;
  }

  function updateDocument(newDocId: string): void {
    host = replaceDocument(host, newDocId);
    setStatus(`미리보기 문서 갱신: doc=${host.docId} req=${host.requestId}`);
  }

  // Global window postMessage listener
  const win = (globalThis as any).window;
  const onWindowMessage = (event: any) => {
    if (!event || typeof event !== "object") return;
    const envelope: PreviewEnvelope = {
      origin: event.origin,
      source: event.data?.source,
      kind: event.data?.kind,
      requestId: event.data?.requestId,
      payload: event.data?.payload,
    };
    handlePreviewMessage(envelope);
  };

  if (win && typeof win.addEventListener === "function") {
    win.addEventListener("message", onWindowMessage);
  }

  let unmounted = false;
  function unmount(): void {
    if (unmounted) return;
    unmounted = true;
    if (win && typeof win.removeEventListener === "function") {
      win.removeEventListener("message", onWindowMessage);
    }
    if (root.parentNode) {
      root.parentNode.removeChild(root);
    }
  }

  container.appendChild(root);

  return {
    root,
    iframe,
    notice,
    status: statusEl,
    getHost: () => host,
    updateDocument,
    handlePreviewMessage,
    getLastStatus: () => lastStatus,
    unmount,
    dispose: unmount,
  };
}
