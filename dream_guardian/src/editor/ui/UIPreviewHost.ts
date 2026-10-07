import {
  containsDangerousKey,
  FORBIDDEN_BRIDGE_KINDS,
  SAFE_BRIDGE_KINDS,
} from "./preview/UIVisualBridge";

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
  generation?: unknown;
  revision?: unknown;
  docId?: unknown;
  pageId?: unknown;
  sessionId?: unknown;
  protocolVersion?: unknown;
};

export type PreviewHost = {
  docId: string;
  origin: string;
  requestId: string;
  issuedForDocId: string;
  readonly: boolean;
  readonlyToken: string | null;
  previousReadonly: boolean | null;
  generation?: number;
  latestRevision?: number;
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

export function issueRequest(input: {
  docId: string;
  origin: string;
  readonly?: boolean;
  generation?: number;
  revision?: number;
}): PreviewHost {
  const requestId = nextId("req");
  return {
    docId: input.docId,
    origin: input.origin,
    requestId,
    issuedForDocId: input.docId,
    readonly: input.readonly === true,
    readonlyToken: null,
    previousReadonly: null,
    generation: input.generation,
    latestRevision: input.revision,
  };
}

export function replaceDocument(
  host: PreviewHost,
  docId: string,
  newGeneration?: number
): PreviewHost {
  return {
    ...host,
    docId,
    requestId: nextId("req"),
    issuedForDocId: docId,
    generation:
      newGeneration ??
      (host.generation !== undefined ? host.generation + 1 : undefined),
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

  // Generation check
  if (
    typeof message.generation === "number" &&
    typeof host.generation === "number"
  ) {
    if (message.generation !== host.generation) {
      return rejected("stale-generation");
    }
  }

  // Revision check
  if (
    typeof message.revision === "number" &&
    typeof host.latestRevision === "number"
  ) {
    if (message.revision < host.latestRevision) {
      return rejected("stale-revision");
    }
  }

  // Dangerous key check
  if (
    containsDangerousKey(message.payload) ||
    containsDangerousKey(message)
  ) {
    return rejected("dangerous-key");
  }

  // Forbidden operation check
  if (
    typeof message.kind === "string" &&
    (FORBIDDEN_BRIDGE_KINDS as readonly string[]).includes(message.kind)
  ) {
    return rejected("forbidden-operation");
  }

  // Source check
  if (message.source !== undefined && message.source !== PREVIEW_SOURCE) {
    return rejected("source");
  }

  // Kind check
  if (
    typeof message.kind !== "string" ||
    (message.kind !== "preview:update" &&
      message.kind !== "preview:result" &&
      !(SAFE_BRIDGE_KINDS as readonly string[]).includes(message.kind))
  ) {
    return rejected("kind");
  }

  // Request ID check
  if (typeof message.requestId !== "string" || message.requestId.length === 0) {
    return rejected("requestId");
  }

  // Payload check
  if (
    message.kind === "preview:update" &&
    !Object.prototype.hasOwnProperty.call(message, "payload")
  ) {
    return rejected("payload");
  }

  // Document consistency check when generation is not explicitly tracked
  if (host.generation === undefined) {
    if (message.requestId !== host.requestId || host.issuedForDocId !== host.docId) {
      return rejected("stale-document");
    }
  }

  // Advance latest revision if newer
  if (typeof message.revision === "number") {
    host.latestRevision = Math.max(host.latestRevision ?? 0, message.revision);
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
