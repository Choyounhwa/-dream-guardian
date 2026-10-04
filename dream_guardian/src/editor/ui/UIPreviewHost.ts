export const IFRAME_IS_SECURITY_SANDBOX = false;
export const PREVIEW_SOURCE = "dream-guardian-ui-preview";
export const PREVIEW_KINDS = ["preview:update", "preview:result"] as const;

export type PreviewKind = (typeof PREVIEW_KINDS)[number];

export type PreviewEnvelope = {
  origin?: unknown;
  source?: unknown;
  kind?: unknown;
  requestId?: unknown;
  payload?: unknown;
};

export type PreviewHost = {
  docId: string;
  origin: string;
  requestId: string;
  issuedForDocId: string;
  readonly: boolean;
  readonlyToken: string | null;
  previousReadonly: boolean | null;
};

export type AcceptDecision = {
  applied: boolean;
  reason?: string;
};

let serial = 0;

function nextId(prefix: string): string {
  serial += 1;
  return `${prefix}-${serial}`;
}

export function issueRequest(input: { docId: string; origin: string; readonly?: boolean }): PreviewHost {
  const requestId = nextId("req");
  return {
    docId: input.docId,
    origin: input.origin,
    requestId,
    issuedForDocId: input.docId,
    readonly: input.readonly === true,
    readonlyToken: null,
    previousReadonly: null,
  };
}

export function replaceDocument(host: PreviewHost, docId: string): PreviewHost {
  return {
    ...host,
    docId,
    requestId: nextId("req"),
    issuedForDocId: docId,
  };
}

function rejected(reason: string): AcceptDecision {
  return { applied: false, reason };
}

export function acceptPreviewMessage(
  host: PreviewHost,
  message: PreviewEnvelope,
  allowlist: readonly string[],
): AcceptDecision {
  if (typeof message.origin !== "string" || !allowlist.includes(message.origin)) {
    return rejected("origin");
  }
  if (message.source !== PREVIEW_SOURCE) return rejected("source");
  if (message.kind !== "preview:update" && message.kind !== "preview:result") {
    return rejected("kind");
  }
  if (typeof message.requestId !== "string" || message.requestId.length === 0) {
    return rejected("requestId");
  }
  if (!Object.prototype.hasOwnProperty.call(message, "payload")) return rejected("payload");
  if (message.requestId !== host.requestId || host.issuedForDocId !== host.docId) {
    return rejected("stale-document");
  }
  return { applied: true };
}

export function enterReadonlyInspection(session: { readonly: boolean; docId: string }): {
  session: PreviewHost;
  token: string;
} {
  const token = nextId("inspect");
  return {
    token,
    session: {
      docId: session.docId,
      origin: "",
      requestId: "",
      issuedForDocId: session.docId,
      readonly: true,
      readonlyToken: token,
      previousReadonly: session.readonly,
    },
  };
}

export function exitReadonlyInspection(session: PreviewHost, token: string): PreviewHost {
  if (session.readonlyToken !== token || session.previousReadonly === null) return session;
  return {
    ...session,
    readonly: session.previousReadonly,
    readonlyToken: null,
    previousReadonly: null,
  };
}
