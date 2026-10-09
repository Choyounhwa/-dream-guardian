import { LIMITS } from "./data/UIContracts";
import { rejectDuplicateKeys } from "./data/UICanonicalJSON";
import type { UIRect } from "./data/UIVisualDocument";

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

export interface MultiDragElement {
  id: string;
  origin: Point;
  position: Point;
  bounds: UIRect;
  isLocked?: boolean;
  lockReason?: string;
  isProtected?: boolean;
}

export interface MultiDragSession {
  selectedIds: string[];
  elements: MultiDragElement[];
  startPoint: Point;
  currentPoint: Point;
  snapEnabled: boolean;
  snapGrid: number;
  isResize?: boolean;
  resizeHandle?: string;
  active: boolean;
}

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

import type { CoordinateTransform } from "./UIArrangement";
export type { CoordinateTransform };
export {
  canvasToViewport,
  viewportToCanvas,
  viewportToScreen,
  screenToViewport,
  canvasToScreen,
  screenToCanvas,
  canvasRectToScreen,
  screenRectToCanvas,
  computeGroupDragSnap,
} from "./UIArrangement";

export function viewTransformToCoordinateTransform(
  view: ViewTransform,
  pan?: Point
): CoordinateTransform {
  return {
    zoom: zoomScale(view),
    panX: pan?.x ?? 0,
    panY: pan?.y ?? 0,
    dpr: view.dpr,
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

export function startMultiDrag(options: {
  elements: Array<{
    id: string;
    bounds: UIRect;
    isLocked?: boolean;
    lockReason?: string;
    isProtected?: boolean;
  }>;
  startPoint: Point;
  snapEnabled?: boolean;
  snapGrid?: number;
  isResize?: boolean;
  resizeHandle?: string;
}): MultiDragSession | { ok: false; reason: string; lockReason?: string; lockedElementId?: string } {
  const locked = options.elements.find((e) => e.isLocked || e.isProtected);
  if (locked) {
    return {
      ok: false,
      reason: "locked-element",
      lockReason: locked.lockReason ?? `Cannot modify locked element "${locked.id}"`,
      lockedElementId: locked.id,
    };
  }

  const dragElements: MultiDragElement[] = options.elements.map((e) => ({
    id: e.id,
    origin: copyPoint({ x: e.bounds.x, y: e.bounds.y }),
    position: copyPoint({ x: e.bounds.x, y: e.bounds.y }),
    bounds: { ...e.bounds },
    isLocked: e.isLocked,
    lockReason: e.lockReason,
    isProtected: e.isProtected,
  }));

  return {
    selectedIds: options.elements.map((e) => e.id),
    elements: dragElements,
    startPoint: copyPoint(options.startPoint),
    currentPoint: copyPoint(options.startPoint),
    snapEnabled: options.snapEnabled ?? false,
    snapGrid: options.snapGrid ?? SNAP_PX,
    isResize: options.isResize,
    resizeHandle: options.resizeHandle,
    active: true,
  };
}

export function updateMultiDrag(
  session: MultiDragSession,
  nextPoint: Point
): {
  groupDelta: Point;
  elements: Array<{ id: string; position: Point; bounds: UIRect }>;
} {
  if (!session.active) {
    return {
      groupDelta: { x: 0, y: 0 },
      elements: session.elements.map((e) => ({
        id: e.id,
        position: copyPoint(e.position),
        bounds: { ...e.bounds },
      })),
    };
  }

  session.currentPoint = copyPoint(nextPoint);
  const rawDx = nextPoint.x - session.startPoint.x;
  const rawDy = nextPoint.y - session.startPoint.y;

  let deltaX = rawDx;
  let deltaY = rawDy;

  if (session.snapEnabled && session.elements.length > 0) {
    const anchor = session.elements[0].origin;
    const grid = session.snapGrid > 0 ? session.snapGrid : SNAP_PX;
    const targetAnchorX = anchor.x + rawDx;
    const targetAnchorY = anchor.y + rawDy;
    const snappedAnchorX = Math.round(targetAnchorX / grid) * grid;
    const snappedAnchorY = Math.round(targetAnchorY / grid) * grid;
    deltaX = snappedAnchorX - anchor.x;
    deltaY = snappedAnchorY - anchor.y;
  }

  const updatedElements = session.elements.map((e) => {
    const nextPos: Point = {
      x: e.origin.x + deltaX,
      y: e.origin.y + deltaY,
    };
    e.position = nextPos;
    e.bounds = {
      ...e.bounds,
      x: nextPos.x,
      y: nextPos.y,
    };
    return {
      id: e.id,
      position: copyPoint(nextPos),
      bounds: { ...e.bounds },
    };
  });

  return {
    groupDelta: { x: deltaX, y: deltaY },
    elements: updatedElements,
  };
}

export function commitMultiDrag(session: MultiDragSession): {
  groupDelta: Point;
  elements: Array<{ id: string; position: Point; bounds: UIRect }>;
} {
  session.active = false;
  const rawDx = session.currentPoint.x - session.startPoint.x;
  const rawDy = session.currentPoint.y - session.startPoint.y;
  let deltaX = rawDx;
  let deltaY = rawDy;
  if (session.snapEnabled && session.elements.length > 0) {
    const anchor = session.elements[0].origin;
    const grid = session.snapGrid > 0 ? session.snapGrid : SNAP_PX;
    const targetAnchorX = anchor.x + rawDx;
    const targetAnchorY = anchor.y + rawDy;
    deltaX = Math.round(targetAnchorX / grid) * grid - anchor.x;
    deltaY = Math.round(targetAnchorY / grid) * grid - anchor.y;
  }
  return {
    groupDelta: { x: deltaX, y: deltaY },
    elements: session.elements.map((e) => ({
      id: e.id,
      position: copyPoint(e.position),
      bounds: { ...e.bounds },
    })),
  };
}

export function cancelMultiDrag(
  session: MultiDragSession,
  _reason?: DragReason | string
): {
  groupDelta: Point;
  elements: Array<{ id: string; position: Point; bounds: UIRect }>;
} {
  session.active = false;
  session.elements.forEach((e) => {
    e.position = copyPoint(e.origin);
    e.bounds = { ...e.bounds, x: e.origin.x, y: e.origin.y };
  });
  return {
    groupDelta: { x: 0, y: 0 },
    elements: session.elements.map((e) => ({
      id: e.id,
      position: copyPoint(e.origin),
      bounds: { ...e.bounds },
    })),
  };
}

export function computeBoxSelection(
  marquee: UIRect,
  elements: Array<{ id: string; bounds: UIRect; isLocked?: boolean }>,
  options?: {
    currentSelection?: string[];
    isShift?: boolean;
  }
): string[] {
  const normMarquee: UIRect = {
    x: marquee.width >= 0 ? marquee.x : marquee.x + marquee.width,
    y: marquee.height >= 0 ? marquee.y : marquee.y + marquee.height,
    width: Math.abs(marquee.width),
    height: Math.abs(marquee.height),
  };

  const intersecting = elements
    .filter((el) => {
      const b = el.bounds;
      return (
        normMarquee.x < b.x + b.width &&
        normMarquee.x + normMarquee.width > b.x &&
        normMarquee.y < b.y + b.height &&
        normMarquee.y + normMarquee.height > b.y
      );
    })
    .map((el) => el.id);

  if (options?.isShift && options.currentSelection) {
    const set = new Set(options.currentSelection);
    intersecting.forEach((id) => set.add(id));
    return Array.from(set);
  }

  return intersecting;
}

export function toggleGridVisible(current: boolean): boolean {
  return !current;
}

export function applyDirectInput(_currentValue: number, input: number): number {
  return input;
}
