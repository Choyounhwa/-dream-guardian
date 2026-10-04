import {
  GAME_APPLY_VERIFIED,
  IFRAME_IS_SECURITY_SANDBOX,
  PREVIEW_CONTEXT_ID,
  RENDERER_FINGERPRINT,
  createPreviewSession,
  type PreviewSession,
} from "./UIPreviewAdapter";

const noopStorage = {
  getItem: (_key: string) => null as string | null,
  setItem: (_key: string, _value: string) => undefined,
  keys: () => [] as string[],
};

const noopNetwork = { send: (_payload: unknown) => undefined };
const noopCamera = { start: () => undefined };
const noopBoot = () => undefined;

export function createPreviewEntry(): {
  PREVIEW_CONTEXT_ID: string;
  IFRAME_IS_SECURITY_SANDBOX: false;
  GAME_APPLY_VERIFIED: false;
  session: PreviewSession;
} {
  const session = createPreviewSession({
    fingerprint: RENDERER_FINGERPRINT,
    storage: noopStorage,
    network: noopNetwork,
    camera: noopCamera,
    boot: noopBoot,
    cache: new Map(),
  });
  return {
    PREVIEW_CONTEXT_ID,
    IFRAME_IS_SECURITY_SANDBOX,
    GAME_APPLY_VERIFIED,
    session,
  };
}
