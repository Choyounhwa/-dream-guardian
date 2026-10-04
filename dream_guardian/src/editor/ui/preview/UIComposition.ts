import { DESIGN_SIZE, LIMITS } from "../data/UIContracts";
import { rejectDuplicateKeys } from "../data/UICanonicalJSON";
import { PROTECTED_REGIONS } from "../data/UIValidator";

export const CHROME_READONLY = true;
export const GAME_APPLY_VERIFIED = false;
export const IFRAME_IS_SECURITY_SANDBOX = false;

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export type Rect = { id: string; x: number; y: number; width: number; height: number };
export type Clock = { nowMs: number };
export type FakeState = { showBottomBar: boolean; priority: string[] };

export type CompositionFrame = {
  design: { width: number; height: number };
  chrome: Rect[];
  protectedRegions: Rect[];
  hits: Array<Rect & { expectedAction: string }>;
  priority: string[];
  clock: Clock;
};

const BOTTOM_BAR: Rect = Object.freeze({
  id: "bottom-bar",
  x: 0,
  y: 2000,
  width: DESIGN_SIZE.width,
  height: 160,
});

function copyRect(rect: Rect): Rect {
  return { id: rect.id, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function actionFor(id: string): string {
  if (id.startsWith("card-")) return "select-card";
  return "none";
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

export function composeFrame(
  snapshot: {
    cards?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    fakeState?: FakeState;
    clock?: Clock;
  },
  clock: Clock,
): CompositionFrame {
  const fakeState = snapshot.fakeState ?? { showBottomBar: true, priority: [] };
  const chrome: Rect[] = [];
  if (fakeState.showBottomBar) chrome.push(copyRect(BOTTOM_BAR));
  const protectedRegions = PROTECTED_REGIONS.map((region) => copyRect(region));
  const hits: Array<Rect & { expectedAction: string }> = [];
  for (const region of protectedRegions) {
    hits.push({ ...region, expectedAction: actionFor(region.id) });
  }
  for (const card of snapshot.cards ?? []) {
    hits.push({
      id: card.id,
      x: card.x,
      y: card.y,
      width: card.width,
      height: card.height,
      expectedAction: actionFor(card.id),
    });
  }
  if (fakeState.showBottomBar) {
    hits.push({ ...copyRect(BOTTOM_BAR), expectedAction: actionFor(BOTTOM_BAR.id) });
  }
  return {
    design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
    chrome,
    protectedRegions,
    hits,
    priority: [...fakeState.priority],
    clock: { nowMs: clock.nowMs },
  };
}

export function hitTest(frame: CompositionFrame, x: number, y: number): { id: string; expectedAction: string } {
  const priority = new Map<string, number>();
  frame.priority.forEach((id, index) => priority.set(id, index));
  const matched = frame.hits.filter((hit) => contains(hit, x, y));
  matched.sort((a, b) => {
    const ai = priority.has(a.id) ? (priority.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
    const bi = priority.has(b.id) ? (priority.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  const winner = matched[0];
  if (!winner) return { id: "none", expectedAction: "none" };
  return { id: winner.id, expectedAction: winner.expectedAction };
}

function walk(value: unknown, depth: number): string | null {
  if (depth > LIMITS.maxDepth) return "max depth exceeded";
  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && value.length > LIMITS.maxNameLength) return "name length exceeded";
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = walk(item, depth + 1);
      if (reason) return reason;
    }
    return null;
  }
  for (const key of Object.keys(value as object)) {
    if (FORBIDDEN.has(key)) return "forbidden key";
    if (key.length > LIMITS.maxNameLength) return "name length exceeded";
    const reason = walk((value as Record<string, unknown>)[key], depth + 1);
    if (reason) return reason;
  }
  return null;
}

export function composeFromRaw(raw: string): { ok: boolean; reason?: string; frame?: CompositionFrame } {
  if (typeof raw !== "string") return { ok: false, reason: "raw string required" };
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) return { ok: false, reason: "max bytes exceeded" };
  const dup = rejectDuplicateKeys(raw);
  if (!dup.ok) return { ok: false, reason: dup.reason ?? "duplicate key" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid json" };
  }
  const danger = walk(parsed, 0);
  if (danger) return { ok: false, reason: danger };
  const record = (parsed && typeof parsed === "object" ? parsed : {}) as {
    cards?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    fakeState?: FakeState;
    clock?: Clock;
  };
  return { ok: true, frame: composeFrame(record, record.clock ?? { nowMs: 0 }) };
}
