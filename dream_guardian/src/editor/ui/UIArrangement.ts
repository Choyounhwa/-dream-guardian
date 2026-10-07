/**
 * UIArrangement.ts - 다중 선택 정렬·그룹 이동·스냅 수학 (Issue #435 / UI-VIS-005)
 *
 * 개발 규칙 및 준수 사항:
 * 1. 6방향(left, hcenter, right, top, vcenter, bottom) × 3기준(selection, artboard, key-object)
 *    정렬 계산을 담당하는 순수 함수 모듈.
 * 2. 개별 정렬(Individual Align)과 묶음 정렬(Group/En-bloc Align)을 분리하여 제공.
 *    묶음 정렬 시 자식 요소 간 상대 offset(상대 거리)은 100% 불변 보존.
 * 3. 그룹 이동(Group Translation) 시 단일 공통 delta 적용, 드래그 스냅 시 그룹 anchor에
 *    단 1회 적용하여 개별 요소 간 상대 간격 보존. 소수점 및 숫자 직접 입력 보존.
 * 4. 유효성 검사 및 원자적 거부(Atomic Rejection):
 *    잠긴 요소(isLocked), 보호 영역 침범, 캔버스 범위 초과 시 명확한 reason과 함께
 *    문서 변경 0건(이전 상태 불변) 처리.
 * 5. Viewport ↔ Canvas ↔ Screen 좌표계 가역적 변환(Zoom, Pan, DPR).
 */

import type { UIRect } from "./data/UIVisualDocument";

export const ARTBOARD_WIDTH = 1080;
export const ARTBOARD_HEIGHT = 2160;

export const DEFAULT_ARTBOARD_BOUNDS: Readonly<UIRect> = Object.freeze({
  x: 0,
  y: 0,
  width: ARTBOARD_WIDTH,
  height: ARTBOARD_HEIGHT,
});

export const DEFAULT_SNAP_GRID = 10;

export type AlignDirection =
  | "left"
  | "hcenter"
  | "center-h"
  | "right"
  | "top"
  | "vcenter"
  | "center-v"
  | "bottom";

export type AlignReference = "selection" | "artboard" | "key-object";

export interface Point {
  x: number;
  y: number;
}

export interface Delta {
  dx: number;
  dy: number;
}

export interface ArrangementElement {
  id: string;
  name?: string;
  bounds: UIRect;
  isLocked?: boolean;
  lockReason?: string;
  isProtected?: boolean;
  [key: string]: unknown;
}

export interface ArrangementProtectedZone {
  id?: string;
  name?: string;
  bounds: UIRect;
  pageId?: string;
}

export interface AlignOptions {
  direction: AlignDirection;
  reference: AlignReference;
  keyObjectId?: string;
  artboardBounds?: UIRect;
  protectedZones?: readonly ArrangementProtectedZone[];
  enforceCanvasBounds?: boolean;
}

export interface TranslateOptions {
  snap?: boolean;
  snapGrid?: number;
  isDirectEntry?: boolean;
  artboardBounds?: UIRect;
  protectedZones?: readonly ArrangementProtectedZone[];
  enforceCanvasBounds?: boolean;
}

export type ArrangementRejectionReason =
  | "empty-selection"
  | "locked-element"
  | "key-object-not-found"
  | "protected-zone-violation"
  | "canvas-bounds-exceeded"
  | "invalid-bounds";

export interface ArrangementSuccess<T> {
  ok: true;
  elements: T[];
  deltaMap: Record<string, Delta>;
  groupDelta: Point | null;
  bounds: UIRect;
}

export interface ArrangementFailure<T> {
  ok: false;
  reason: ArrangementRejectionReason;
  message: string;
  elements: T[]; // 이전 상태 100% 보존 (0건 변경)
  violatedElementId?: string;
  violatedZoneId?: string;
}

export type ArrangementResult<T> = ArrangementSuccess<T> | ArrangementFailure<T>;

export interface CoordinateTransform {
  zoom: number; // 1.0 = 100%
  panX: number; // viewport pixels
  panY: number; // viewport pixels
  dpr: number;  // device pixel ratio (e.g. 1.0, 2.0)
}

// ==========================================
// 순수 기하학 보조 함수 (Pure Geometry Helpers)
// ==========================================

export function isFiniteRect(r: UIRect): boolean {
  return (
    Number.isFinite(r.x) &&
    Number.isFinite(r.y) &&
    Number.isFinite(r.width) &&
    Number.isFinite(r.height) &&
    r.width >= 0 &&
    r.height >= 0
  );
}

export function computeBoundingBox(elements: readonly { bounds: UIRect }[]): UIRect | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const { x, y, width, height } = el.bounds;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + width > maxX) maxX = x + width;
    if (y + height > maxY) maxY = y + height;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function rectsIntersect(r1: UIRect, r2: UIRect): boolean {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

export function isWithinBounds(rect: UIRect, container: UIRect): boolean {
  return (
    rect.x >= container.x &&
    rect.y >= container.y &&
    rect.x + rect.width <= container.x + container.width &&
    rect.y + rect.height <= container.y + container.height
  );
}

function validateCandidates<T extends ArrangementElement>(
  elements: readonly T[],
  candidateBoundsMap: Map<string, UIRect>,
  options: {
    artboardBounds?: UIRect;
    protectedZones?: readonly ArrangementProtectedZone[];
    enforceCanvasBounds?: boolean;
  }
): ArrangementFailure<T> | null {
  const artboard = options.artboardBounds ?? DEFAULT_ARTBOARD_BOUNDS;
  const protectedZones = options.protectedZones ?? [];
  const enforceCanvas = options.enforceCanvasBounds ?? false;

  // 1. 잠금 요소 존재 검증 (하나라도 잠겨있으면 원자적 거부)
  for (const el of elements) {
    if (el.isLocked) {
      return {
        ok: false,
        reason: "locked-element",
        message: `Cannot modify locked element "${el.id}"`,
        violatedElementId: el.id,
        elements: [...elements],
      };
    }
  }

  // 2. 개별 후보 좌표 검증
  for (const el of elements) {
    const nextBounds = candidateBoundsMap.get(el.id) ?? el.bounds;

    if (!isFiniteRect(nextBounds)) {
      return {
        ok: false,
        reason: "invalid-bounds",
        message: `Element "${el.id}" has invalid or non-finite bounds`,
        violatedElementId: el.id,
        elements: [...elements],
      };
    }

    if (enforceCanvas && !isWithinBounds(nextBounds, artboard)) {
      return {
        ok: false,
        reason: "canvas-bounds-exceeded",
        message: `Element "${el.id}" exceeds canvas bounds`,
        violatedElementId: el.id,
        elements: [...elements],
      };
    }

    for (const zone of protectedZones) {
      if (rectsIntersect(nextBounds, zone.bounds)) {
        return {
          ok: false,
          reason: "protected-zone-violation",
          message: `Element "${el.id}" invades protected zone "${zone.id ?? zone.name ?? 'unknown'}"`,
          violatedElementId: el.id,
          violatedZoneId: zone.id,
          elements: [...elements],
        };
      }
    }
  }

  return null;
}

// ==========================================
// 1. 개별 정렬 (Individual Alignment)
// ==========================================

export function computeIndividualAlign<T extends ArrangementElement>(
  elements: readonly T[],
  options: AlignOptions
): ArrangementResult<T> {
  if (elements.length === 0) {
    return {
      ok: false,
      reason: "empty-selection",
      message: "No elements selected for alignment",
      elements: [],
    };
  }

  let keyEl: T | undefined;
  if (options.reference === "key-object") {
    if (!options.keyObjectId) {
      return {
        ok: false,
        reason: "key-object-not-found",
        message: "Key object ID was not specified",
        elements: [...elements],
      };
    }
    keyEl = elements.find((e) => e.id === options.keyObjectId);
    if (!keyEl) {
      return {
        ok: false,
        reason: "key-object-not-found",
        message: `Key object "${options.keyObjectId}" not found in selection`,
        elements: [...elements],
      };
    }
  }

  const artboard = options.artboardBounds ?? DEFAULT_ARTBOARD_BOUNDS;
  let refRect: UIRect;
  if (options.reference === "artboard") {
    refRect = artboard;
  } else if (options.reference === "key-object") {
    refRect = keyEl!.bounds;
  } else {
    const selBox = computeBoundingBox(elements);
    if (!selBox) {
      return {
        ok: false,
        reason: "empty-selection",
        message: "Could not compute selection bounding box",
        elements: [...elements],
      };
    }
    refRect = selBox;
  }

  const candidateBoundsMap = new Map<string, UIRect>();
  const deltaMap: Record<string, Delta> = {};

  for (const el of elements) {
    if (options.reference === "key-object" && el.id === options.keyObjectId) {
      // 기준 키 객체는 완전히 고정됨
      candidateBoundsMap.set(el.id, { ...el.bounds });
      deltaMap[el.id] = { dx: 0, dy: 0 };
      continue;
    }

    let nextX = el.bounds.x;
    let nextY = el.bounds.y;

    switch (options.direction) {
      case "left":
        nextX = refRect.x;
        break;
      case "hcenter":
      case "center-h":
        nextX = refRect.x + (refRect.width - el.bounds.width) / 2;
        break;
      case "right":
        nextX = refRect.x + refRect.width - el.bounds.width;
        break;
      case "top":
        nextY = refRect.y;
        break;
      case "vcenter":
      case "center-v":
        nextY = refRect.y + (refRect.height - el.bounds.height) / 2;
        break;
      case "bottom":
        nextY = refRect.y + refRect.height - el.bounds.height;
        break;
    }

    candidateBoundsMap.set(el.id, {
      ...el.bounds,
      x: nextX,
      y: nextY,
    });
    deltaMap[el.id] = {
      dx: nextX - el.bounds.x,
      dy: nextY - el.bounds.y,
    };
  }

  const failure = validateCandidates(elements, candidateBoundsMap, {
    artboardBounds: artboard,
    protectedZones: options.protectedZones,
    enforceCanvasBounds: options.enforceCanvasBounds,
  });
  if (failure) return failure;

  const updatedElements = elements.map((el) => ({
    ...el,
    bounds: candidateBoundsMap.get(el.id)!,
  }));

  const finalBounds = computeBoundingBox(updatedElements) ?? refRect;

  return {
    ok: true,
    elements: updatedElements,
    deltaMap,
    groupDelta: null,
    bounds: finalBounds,
  };
}

// ==========================================
// 2. 묶음 정렬 (Group / En-bloc Alignment)
// ==========================================

export function computeGroupAlign<T extends ArrangementElement>(
  elements: readonly T[],
  options: AlignOptions
): ArrangementResult<T> {
  if (elements.length === 0) {
    return {
      ok: false,
      reason: "empty-selection",
      message: "No elements selected for group alignment",
      elements: [],
    };
  }

  let keyEl: T | undefined;
  if (options.reference === "key-object") {
    if (!options.keyObjectId) {
      return {
        ok: false,
        reason: "key-object-not-found",
        message: "Key object ID was not specified",
        elements: [...elements],
      };
    }
    keyEl = elements.find((e) => e.id === options.keyObjectId);
    if (!keyEl) {
      return {
        ok: false,
        reason: "key-object-not-found",
        message: `Key object "${options.keyObjectId}" not found in selection`,
        elements: [...elements],
      };
    }
  }

  const artboard = options.artboardBounds ?? DEFAULT_ARTBOARD_BOUNDS;

  // key-object 기준일 경우: 키 객체를 제외한 나머지 요소들이 한 덩어리로 키 객체에 정렬
  const movingElements =
    options.reference === "key-object"
      ? elements.filter((e) => e.id !== options.keyObjectId)
      : elements;

  if (movingElements.length === 0) {
    return {
      ok: true,
      elements: [...elements],
      deltaMap: { [keyEl!.id]: { dx: 0, dy: 0 } },
      groupDelta: { x: 0, y: 0 },
      bounds: keyEl!.bounds,
    };
  }

  const movingBox = computeBoundingBox(movingElements);
  if (!movingBox) {
    return {
      ok: false,
      reason: "empty-selection",
      message: "Could not compute bounding box for moving elements",
      elements: [...elements],
    };
  }

  let refRect: UIRect;
  if (options.reference === "artboard") {
    refRect = artboard;
  } else if (options.reference === "key-object") {
    refRect = keyEl!.bounds;
  } else {
    refRect = computeBoundingBox(elements)!;
  }

  let targetBoxX = movingBox.x;
  let targetBoxY = movingBox.y;

  switch (options.direction) {
    case "left":
      targetBoxX = refRect.x;
      break;
    case "hcenter":
    case "center-h":
      targetBoxX = refRect.x + (refRect.width - movingBox.width) / 2;
      break;
    case "right":
      targetBoxX = refRect.x + refRect.width - movingBox.width;
      break;
    case "top":
      targetBoxY = refRect.y;
      break;
    case "vcenter":
    case "center-v":
      targetBoxY = refRect.y + (refRect.height - movingBox.height) / 2;
      break;
    case "bottom":
      targetBoxY = refRect.y + refRect.height - movingBox.height;
      break;
  }

  const deltaX = targetBoxX - movingBox.x;
  const deltaY = targetBoxY - movingBox.y;

  const candidateBoundsMap = new Map<string, UIRect>();
  const deltaMap: Record<string, Delta> = {};

  for (const el of elements) {
    if (options.reference === "key-object" && el.id === options.keyObjectId) {
      candidateBoundsMap.set(el.id, { ...el.bounds });
      deltaMap[el.id] = { dx: 0, dy: 0 };
    } else {
      candidateBoundsMap.set(el.id, {
        ...el.bounds,
        x: el.bounds.x + deltaX,
        y: el.bounds.y + deltaY,
      });
      deltaMap[el.id] = { dx: deltaX, dy: deltaY };
    }
  }

  const failure = validateCandidates(elements, candidateBoundsMap, {
    artboardBounds: artboard,
    protectedZones: options.protectedZones,
    enforceCanvasBounds: options.enforceCanvasBounds,
  });
  if (failure) return failure;

  const updatedElements = elements.map((el) => ({
    ...el,
    bounds: candidateBoundsMap.get(el.id)!,
  }));

  const finalBounds = computeBoundingBox(updatedElements) ?? refRect;

  return {
    ok: true,
    elements: updatedElements,
    deltaMap,
    groupDelta: { x: deltaX, y: deltaY },
    bounds: finalBounds,
  };
}

// ==========================================
// 3. 그룹 이동 & 드래그 스냅 수학 (Group Translation & Drag Snap Math)
// ==========================================

export function computeGroupDragSnap(
  anchor: Point,
  rawDelta: Point,
  snapGrid: number = DEFAULT_SNAP_GRID
): { snappedDelta: Point; snappedAnchor: Point } {
  const targetX = anchor.x + rawDelta.x;
  const targetY = anchor.y + rawDelta.y;

  const snappedAnchorX = Math.round(targetX / snapGrid) * snapGrid;
  const snappedAnchorY = Math.round(targetY / snapGrid) * snapGrid;

  return {
    snappedDelta: {
      x: snappedAnchorX - anchor.x,
      y: snappedAnchorY - anchor.y,
    },
    snappedAnchor: {
      x: snappedAnchorX,
      y: snappedAnchorY,
    },
  };
}

export function translateGroup<T extends ArrangementElement>(
  elements: readonly T[],
  delta: { x?: number; y?: number; dx?: number; dy?: number },
  options?: TranslateOptions
): ArrangementResult<T> {
  if (elements.length === 0) {
    return {
      ok: false,
      reason: "empty-selection",
      message: "No elements to translate",
      elements: [],
    };
  }

  const rawDx = delta.x ?? delta.dx ?? 0;
  const rawDy = delta.y ?? delta.dy ?? 0;

  let effectiveDx = rawDx;
  let effectiveDy = rawDy;

  if (options?.snap && !options?.isDirectEntry) {
    const snapGrid = options?.snapGrid ?? DEFAULT_SNAP_GRID;
    const selBox = computeBoundingBox(elements);
    if (selBox) {
      const anchor = { x: selBox.x, y: selBox.y };
      const snapCalc = computeGroupDragSnap(anchor, { x: rawDx, y: rawDy }, snapGrid);
      effectiveDx = snapCalc.snappedDelta.x;
      effectiveDy = snapCalc.snappedDelta.y;
    }
  }

  const candidateBoundsMap = new Map<string, UIRect>();
  const deltaMap: Record<string, Delta> = {};

  for (const el of elements) {
    candidateBoundsMap.set(el.id, {
      ...el.bounds,
      x: el.bounds.x + effectiveDx,
      y: el.bounds.y + effectiveDy,
    });
    deltaMap[el.id] = { dx: effectiveDx, dy: effectiveDy };
  }

  const failure = validateCandidates(elements, candidateBoundsMap, {
    artboardBounds: options?.artboardBounds,
    protectedZones: options?.protectedZones,
    enforceCanvasBounds: options?.enforceCanvasBounds,
  });
  if (failure) return failure;

  const updatedElements = elements.map((el) => ({
    ...el,
    bounds: candidateBoundsMap.get(el.id)!,
  }));

  const finalBounds = computeBoundingBox(updatedElements) ?? { x: 0, y: 0, width: 0, height: 0 };

  return {
    ok: true,
    elements: updatedElements,
    deltaMap,
    groupDelta: { x: effectiveDx, y: effectiveDy },
    bounds: finalBounds,
  };
}

// ==========================================
// 4. Viewport ↔ Canvas ↔ Screen 가역 변환 (Coordinate Transforms)
// ==========================================

export function canvasToViewport(point: Point, transform: CoordinateTransform): Point {
  return {
    x: point.x * transform.zoom + transform.panX,
    y: point.y * transform.zoom + transform.panY,
  };
}

export function viewportToCanvas(point: Point, transform: CoordinateTransform): Point {
  return {
    x: (point.x - transform.panX) / transform.zoom,
    y: (point.y - transform.panY) / transform.zoom,
  };
}

export function viewportToScreen(point: Point, transform: CoordinateTransform): Point {
  return {
    x: point.x * transform.dpr,
    y: point.y * transform.dpr,
  };
}

export function screenToViewport(point: Point, transform: CoordinateTransform): Point {
  return {
    x: point.x / transform.dpr,
    y: point.y / transform.dpr,
  };
}

export function canvasToScreen(point: Point, transform: CoordinateTransform): Point {
  const vp = canvasToViewport(point, transform);
  return viewportToScreen(vp, transform);
}

export function screenToCanvas(point: Point, transform: CoordinateTransform): Point {
  const vp = screenToViewport(point, transform);
  return viewportToCanvas(vp, transform);
}

export function canvasRectToScreen(rect: UIRect, transform: CoordinateTransform): UIRect {
  const origin = canvasToScreen({ x: rect.x, y: rect.y }, transform);
  return {
    x: origin.x,
    y: origin.y,
    width: rect.width * transform.zoom * transform.dpr,
    height: rect.height * transform.zoom * transform.dpr,
  };
}

export function screenRectToCanvas(rect: UIRect, transform: CoordinateTransform): UIRect {
  const origin = screenToCanvas({ x: rect.x, y: rect.y }, transform);
  return {
    x: origin.x,
    y: origin.y,
    width: rect.width / (transform.zoom * transform.dpr),
    height: rect.height / (transform.zoom * transform.dpr),
  };
}

export function canvasRectToViewport(rect: UIRect, transform: CoordinateTransform): UIRect {
  const origin = canvasToViewport({ x: rect.x, y: rect.y }, transform);
  return {
    x: origin.x,
    y: origin.y,
    width: rect.width * transform.zoom,
    height: rect.height * transform.zoom,
  };
}

export function viewportRectToCanvas(rect: UIRect, transform: CoordinateTransform): UIRect {
  const origin = viewportToCanvas({ x: rect.x, y: rect.y }, transform);
  return {
    x: origin.x,
    y: origin.y,
    width: rect.width / transform.zoom,
    height: rect.height / transform.zoom,
  };
}
