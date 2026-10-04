import { LIMITS, RENDERER_FINGERPRINT } from "../data/UIBaselines";

export { LIMITS, RENDERER_FINGERPRINT };

export const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";
export const GAME_CONTEXT_ID = "dream-guardian-game";
export const IFRAME_IS_SECURITY_SANDBOX = false;
export const GAME_APPLY_VERIFIED = false;

export const GAME_KEYS_FORBIDDEN = Object.freeze([
  "dream-guardian-save",
  "accessibility",
  "choreography",
  "ui-config",
]);

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type PreviewPorts = {
  fingerprint: string;
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    keys: () => string[];
  };
  network?: { send: (payload: unknown) => void };
  camera?: { start: () => void };
  bootGame?: () => void;
  boot?: () => void;
  cache: Map<string, unknown> | Record<string, unknown>;
};

export type PreviewContext = {
  contextId: string;
  generation: number;
  snapshot?: unknown;
};

export type PreviewSession = {
  locked: boolean;
  supportLocked: string | null;
  context: PreviewContext;
  update: (snapshot: unknown) => { ok: boolean; reason?: string };
  draw: () => { drew: boolean; contextId: string; reason?: string };
  recreate: () => PreviewContext;
};

export function rejectUnsafeSnapshot(raw: string): { ok: boolean; reason?: string; value?: unknown } {
  if (typeof raw !== "string") return { ok: false, reason: "raw string required" };
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) {
    return { ok: false, reason: "max bytes exceeded" };
  }
  const dup = rejectDuplicateKeys(raw);
  if (!dup.ok) return dup;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid json" };
  }
  const danger = findForbidden(parsed, 0);
  if (danger) return { ok: false, reason: danger };
  return { ok: true, value: parsed };
}

export function assertNoSideEffects(spies: {
  bootGame: { mock: { calls: unknown[] } };
  cameraStart: { mock: { calls: unknown[] } };
  networkSend: { mock: { calls: unknown[] } };
  storageSetItem: { mock: { calls: unknown[] } };
  cacheSize: number;
  cacheSizeBefore: number;
}): void {
  if (spies.bootGame.mock.calls.length !== 0) throw new Error("bootGame called");
  if (spies.cameraStart.mock.calls.length !== 0) throw new Error("camera.start called");
  if (spies.networkSend.mock.calls.length !== 0) throw new Error("network.send called");
  if (spies.storageSetItem.mock.calls.length !== 0) throw new Error("storage.setItem called");
  if (spies.cacheSize !== spies.cacheSizeBefore) throw new Error("cache mutated");
}

export function createPreviewSession(deps: PreviewPorts): PreviewSession {
  const locked = deps.fingerprint !== RENDERER_FINGERPRINT;
  const supportLocked = locked ? "fingerprint-mismatch" : null;
  let generation = 0;
  let context = freshContext(generation);

  const session: PreviewSession = {
    locked,
    supportLocked,
    context,
    update(snapshot: unknown) {
      if (session.locked) {
        const dropped = session.context;
        session.context = freshContext(++generation);
        void dropped;
        return { ok: false, reason: session.supportLocked ?? "locked" };
      }
      let value = snapshot;
      if (typeof snapshot === "string") {
        const checked = rejectUnsafeSnapshot(snapshot);
        if (!checked.ok) return { ok: false, reason: checked.reason };
        value = checked.value;
      } else {
        const danger = findForbidden(snapshot, 0);
        if (danger) return { ok: false, reason: danger };
      }
      const next = freshContext(generation);
      Object.defineProperty(next, "snapshot", {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      session.context = next;
      return { ok: true };
    },
    draw() {
      if (session.locked) {
        const dropped = session.context;
        session.context = freshContext(++generation);
        void dropped;
        return { drew: false, contextId: PREVIEW_CONTEXT_ID, reason: session.supportLocked ?? "locked" };
      }
      return { drew: true, contextId: session.context.contextId };
    },
    recreate() {
      const next = freshContext(++generation);
      session.context = next;
      return next;
    },
  };

  return session;
}

function freshContext(generation: number): PreviewContext {
  return { contextId: PREVIEW_CONTEXT_ID, generation };
}

function findForbidden(value: unknown, depth: number): string | null {
  if (depth > LIMITS.maxDepth) return "max depth exceeded";
  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && value.length > LIMITS.maxNameLength && depth > 0) {
      return "name length exceeded";
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = findForbidden(item, depth + 1);
      if (reason) return reason;
    }
    return null;
  }
  for (const key of Object.keys(value as object)) {
    if (FORBIDDEN_KEYS.has(key)) return "forbidden key";
    if (key.length > LIMITS.maxNameLength) return "name length exceeded";
    if (GAME_KEYS_FORBIDDEN.includes(key as (typeof GAME_KEYS_FORBIDDEN)[number])) {
      return "forbidden game key";
    }
    const reason = findForbidden((value as Record<string, unknown>)[key], depth + 1);
    if (reason) return reason;
  }
  return null;
}

function rejectDuplicateKeys(raw: string): { ok: boolean; reason?: string } {
  let i = 0;
  while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t")) i += 1;
  if (raw[i] !== "{" && raw[i] !== "[") return { ok: true };
  const scanned = raw[i] === "{" ? scanObject(raw, i) : scanArray(raw, i);
  return scanned.ok ? { ok: true } : { ok: false, reason: scanned.reason };
}

function scanObject(raw: string, start: number): { ok: boolean; reason?: string; end: number } {
  const seen = new Set<string>();
  let i = start + 1;
  while (i < raw.length) {
    while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t" || raw[i] === ",")) i += 1;
    if (raw[i] === "}") return { ok: true, end: i + 1 };
    if (raw[i] !== '"') return { ok: false, reason: "invalid json", end: i };
    const keyEnd = skipString(raw, i);
    const key = JSON.parse(raw.slice(i, keyEnd)) as string;
    if (seen.has(key)) return { ok: false, reason: "duplicate key", end: keyEnd };
    seen.add(key);
    i = keyEnd;
    while (i < raw.length && raw[i] !== ":") i += 1;
    i += 1;
    while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t")) i += 1;
    if (raw[i] === "{") {
      const nested = scanObject(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (raw[i] === "[") {
      const nested = scanArray(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (raw[i] === '"') {
      i = skipString(raw, i);
      continue;
    }
    while (i < raw.length && raw[i] !== "," && raw[i] !== "}") i += 1;
  }
  return { ok: false, reason: "invalid json", end: raw.length };
}

function scanArray(raw: string, start: number): { ok: boolean; reason?: string; end: number } {
  let i = start + 1;
  while (i < raw.length) {
    while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t" || raw[i] === ",")) i += 1;
    if (raw[i] === "]") return { ok: true, end: i + 1 };
    if (raw[i] === "{") {
      const nested = scanObject(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (raw[i] === "[") {
      const nested = scanArray(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (raw[i] === '"') {
      i = skipString(raw, i);
      continue;
    }
    while (i < raw.length && raw[i] !== "," && raw[i] !== "]") i += 1;
  }
  return { ok: false, reason: "invalid json", end: raw.length };
}

function skipString(raw: string, start: number): number {
  let i = start + 1;
  while (i < raw.length) {
    if (raw[i] === "\\") {
      i += 2;
      continue;
    }
    if (raw[i] === '"') return i + 1;
    i += 1;
  }
  return raw.length;
}
