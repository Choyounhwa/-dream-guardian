import { LIMITS } from "./data/UIContracts";
import { rejectDuplicateKeys } from "./data/UICanonicalJSON";

export const DESIGN_WIDTH = 1080;
export const DESIGN_HEIGHT = 2160;
export const GAME_APPLY_VERIFIED = false;
export const STORAGE_TOUCHED = false;
export const NUDGE_PX = 1;
export const SHIFT_NUDGE_PX = 10;
export const SNAP_PX = 10;

export type ViewTransform = {
  dpr: number;
  zoomPercent: number;
};

export type Point = {
  x: number;
  y: number;
};

export type DragReason = "pointercancel" | "lostpointercapture" | "Escape";

export type DragSession = {
  cardId: string;
  origin: Point;
  position: Point;
  formHasFocus: boolean;
};

export type NudgeOptions = {
  shift: boolean;
  snapEnabled: boolean;
  formHasFocus: boolean;
};

export type AcceptResult = {
  ok: boolean;
  code?: string;
  reason?: string;
  value?: unknown;
};

const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export function zoomScale(view: ViewTransform): number {
  return view.zoomPercent / 100;
}

export function cssToDesign(cssX: number, cssY: number, view: ViewTransform): Point {
  const scale = zoomScale(view);
  return {
    x: (cssX * view.dpr) / (view.dpr * scale),
    y: (cssY * view.dpr) / (view.dpr * scale),
  };
}

export function designToCss(designX: number, designY: number, view: ViewTransform): Point {
  const scale = zoomScale(view);
  return {
    x: (designX * view.dpr * scale) / view.dpr,
    y: (designY * view.dpr * scale) / view.dpr,
  };
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

export function beginDrag(origin: Point, cardId: string, options?: { formHasFocus?: boolean }): DragSession {
  return {
    cardId,
    origin: copyPoint(origin),
    position: copyPoint(origin),
    formHasFocus: options?.formHasFocus === true,
  };
}

export function updateDrag(session: DragSession, next: Point): DragSession {
  if (session.formHasFocus) return session;
  return {
    ...session,
    origin: copyPoint(session.origin),
    position: copyPoint(next),
  };
}

export function cancelDrag(session: DragSession, _reason: DragReason): DragSession {
  return {
    ...session,
    origin: copyPoint(session.origin),
    position: copyPoint(session.origin),
  };
}

export function commitDrag(session: DragSession): DragSession {
  return {
    ...session,
    origin: copyPoint(session.origin),
    position: copyPoint(session.position),
  };
}

function snap(value: number): number {
  return Math.round(value / SNAP_PX) * SNAP_PX;
}

export function applyNudge(position: Point, key: string, options: NudgeOptions): Point {
  if (options.formHasFocus) return copyPoint(position);
  const delta = ARROWS[key];
  if (!delta) return copyPoint(position);
  const step = options.shift ? SHIFT_NUDGE_PX : NUDGE_PX;
  const next = {
    x: position.x + delta.x * step,
    y: position.y + delta.y * step,
  };
  if (!options.snapEnabled) return next;
  return {
    x: delta.x === 0 ? next.x : snap(next.x),
    y: delta.y === 0 ? next.y : snap(next.y),
  };
}

function depthOf(value: unknown, depth: number): number {
  if (value === null || typeof value !== "object") return depth;
  let max = depth;
  for (const child of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, depthOf(child, depth + 1));
  }
  return max;
}

function nameTooLong(value: unknown): boolean {
  if (typeof value === "string") return value.length > LIMITS.maxNameLength;
  if (value === null || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.length > LIMITS.maxNameLength || nameTooLong(child)) return true;
  }
  return false;
}

export function acceptRaw(raw: string): AcceptResult {
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) {
    return { ok: false, code: "max-bytes", reason: "1MiB" };
  }
  const duplicates = rejectDuplicateKeys(raw);
  if (!duplicates.ok) {
    return { ok: false, code: "duplicate-key", reason: duplicates.reason ?? "duplicate key" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid-json", reason: "invalid json" };
  }
  if (parsed !== null && typeof parsed === "object") {
    for (const key of Object.keys(parsed as object)) {
      if (DANGEROUS.has(key)) return { ok: false, code: "dangerous-key", reason: key };
    }
  }
  if (depthOf(parsed, 1) > LIMITS.maxDepth) {
    return { ok: false, code: "max-depth", reason: "depth 16" };
  }
  if (nameTooLong(parsed)) {
    return { ok: false, code: "max-name", reason: "name 80" };
  }
  return { ok: true, value: parsed };
}
