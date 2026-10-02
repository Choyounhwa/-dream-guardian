/**
 * PoseGeometry - 모션·포즈 공통 순수 기하학 연산 유틸리티
 *
 * MediaPipe 포즈 랜드마크 기반의 좌표계 변환, 정규화, 거리 및 비율 계산을
 * 사이드 이펙트 없는 순수 함수로 제공합니다.
 *
 * @see Issue #297 [REFACTOR-GEOM-001]
 * @see Issue #287 [INPUT-ARM-DIRECTION-001]
 */

export interface Point2D {
  x: number;
  y: number;
  z?: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GEOM_EPSILON = 1e-5;
export const DEFAULT_SHOULDER_WIDTH_FALLBACK = 0.20;

/**
 * 정규화 좌표 x를 반전(미러링: 1 - x)하고 [0, 1] 범위로 클램핑
 */
export function mirrorX(x: number): number {
  return Math.max(0, Math.min(1, 1 - x));
}

/**
 * 2D 좌표 점을 미러링 옵션에 따라 변환 (y좌표 보존, clamp 기본값 true)
 */
export function mirrorPoint(pt: Point2D, isMirrored = true, clamp = true): Point2D {
  return {
    x: isMirrored ? (clamp ? mirrorX(pt.x) : 1 - pt.x) : (clamp ? clamp01(pt.x) : pt.x),
    y: pt.y,
  };
}

/**
 * 두 2D 점 간의 유클리드 거리 계산
 */
export function calcDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * 좌우 어깨 랜드마크 간의 너비 거리 계산 (0/근접 시 fallback 적용)
 */
export function calcShoulderWidth(
  leftShoulder: Point2D,
  rightShoulder: Point2D,
  fallback = DEFAULT_SHOULDER_WIDTH_FALLBACK,
): number {
  const dist = calcDistance(leftShoulder, rightShoulder);
  return dist > GEOM_EPSILON ? dist : fallback;
}

/**
 * 어깨 너비를 기준으로 입력 값을 정규화
 * leftShoulderOrWidth로 너비 숫자 또는 어깨 좌표 객체 수용
 */
export function normalizeByShoulder(
  val: number,
  leftShoulderOrWidth: Point2D | number,
  rightShoulder?: Point2D,
  fallback = DEFAULT_SHOULDER_WIDTH_FALLBACK,
): number {
  let width: number;
  if (typeof leftShoulderOrWidth === 'number') {
    width = leftShoulderOrWidth;
  } else if (rightShoulder) {
    width = calcDistance(leftShoulderOrWidth, rightShoulder);
  } else {
    width = 0;
  }

  const effectiveWidth = width > GEOM_EPSILON ? width : fallback;
  if (effectiveWidth <= GEOM_EPSILON) {
    return 0;
  }
  return val / effectiveWidth;
}

/**
 * 몸 중심(어깨X) 대비 손목의 가로 뻗음 비율 계산
 * - 좌측 뻗음: (어깨X - 손목X) > 0 (양수)
 * - 우측 뻗음: (어깨X - 손목X) < 0 (음수)
 */
export function calcLateralReach(
  wristX: number,
  shoulderX: number,
  shoulderWidth: number,
  fallback = DEFAULT_SHOULDER_WIDTH_FALLBACK,
): number {
  const effectiveWidth = shoulderWidth > GEOM_EPSILON ? shoulderWidth : fallback;
  if (effectiveWidth <= GEOM_EPSILON) {
    return 0;
  }
  return (shoulderX - wristX) / effectiveWidth;
}

/**
 * 수평/수직 우세 비율 계산 (|dx| / (|dy| + epsilon))
 */
export function calcDominanceRatio(dx: number, dy: number, epsilon = GEOM_EPSILON): number {
  return Math.abs(dx) / (Math.abs(dy) + epsilon);
}

/**
 * 어깨 위치 대비 손목의 팔 연장 비율 계산
 */
export function calcArmExtensionRatio(
  wristPos: Point2D,
  shoulderPos: Point2D,
  shoulderWidth: number,
  fallback = DEFAULT_SHOULDER_WIDTH_FALLBACK,
): number {
  const dist = calcDistance(wristPos, shoulderPos);
  return normalizeByShoulder(dist, shoulderWidth, undefined, fallback);
}

/**
 * 시간 변화량(dt)에 따른 속도 벡터 계산
 */
export function calcVelocity(
  currentPos: Point2D,
  prevPos: Point2D | null | undefined,
  dt: number,
): { vx: number; vy: number } {
  if (!prevPos || dt <= GEOM_EPSILON) {
    return { vx: 0, vy: 0 };
  }
  return {
    vx: (currentPos.x - prevPos.x) / dt,
    vy: (currentPos.y - prevPos.y) / dt,
  };
}

/**
 * 사각형 존 중심 대비 정규화된 최대 변위 거리 계산
 */
export function calcNormalizedZoneDistance(
  pos: Point2D,
  zone: Rect2D,
  fallbackHalfW = 0.13,
  fallbackHalfH = 0.08,
): number {
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;
  const halfW = zone.width / 2;
  const halfH = zone.height / 2;
  const effectiveHalfW = halfW > GEOM_EPSILON ? halfW : fallbackHalfW;
  const effectiveHalfH = halfH > GEOM_EPSILON ? halfH : fallbackHalfH;
  const dx = Math.abs(pos.x - cx) / effectiveHalfW;
  const dy = Math.abs(pos.y - cy) / effectiveHalfH;
  return Math.max(dx, dy);
}

/**
 * 피트니스 존 내 중심 대비 정규화된 유클리드(방사형) 거리 계산
 * dx = |x - cx| / (width / 2), dy = |y - cy| / (height / 2)
 * return hypot(dx, dy)
 */
export function calcNormalizedRadialDistance(pos: Point2D, zone: Rect2D): number {
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;
  const halfW = zone.width / 2;
  const halfH = zone.height / 2;
  if (halfW <= GEOM_EPSILON || halfH <= GEOM_EPSILON) return 0;
  const dx = Math.abs(pos.x - cx) / halfW;
  const dy = Math.abs(pos.y - cy) / halfH;
  return Math.hypot(dx, dy);
}

/**
 * 값을 [min, max] 범위로 클램핑
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * 값을 [0, 1] 범위로 클램핑
 */
export function clamp01(val: number): number {
  return clamp(val, 0, 1);
}

/**
 * 두 스칼라 값 간의 선형 보간 (Lerp)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 두 2D 점 간의 선형 보간 점 (Lerp)
 */
export function lerpPoint(p1: Point2D, p2: Point2D, t: number): Point2D {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
}

/**
 * 두 점의 중점 좌표 계산
 */
export function calcMidpoint(p1: Point2D, p2: Point2D): Point2D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * p1에서 p2로 향하는 2D 벡터 계산
 */
export function calcVector(p1: Point2D, p2: Point2D): Point2D {
  return {
    x: p2.x - p1.x,
    y: p2.y - p1.y,
  };
}

/**
 * 세 점으로 이루어진 관절 각도 계산 (p2가 관절 정점)
 * @param p1 첫 번째 점 (예: 어깨)
 * @param p2 관절 정점 (예: 팔꿈치)
 * @param p3 세 번째 점 (예: 손목)
 * @param inDegrees true이면 도(0~180), false이면 라디안(0~PI) 반환 (기본값: true)
 */
export function calcJointAngle(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  inDegrees = true,
): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v1z = (p1.z ?? 0) - (p2.z ?? 0);

  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  const v2z = (p3.z ?? 0) - (p2.z ?? 0);

  const m1 = Math.hypot(v1x, v1y, v1z);
  const m2 = Math.hypot(v2x, v2y, v2z);

  if (m1 <= GEOM_EPSILON || m2 <= GEOM_EPSILON) {
    return 0;
  }

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const cosTheta = clamp(dot / (m1 * m2), -1, 1);
  const angleRad = Math.acos(cosTheta);

  return inDegrees ? (angleRad * 180) / Math.PI : angleRad;
}

/**
 * 2D 점이 사각형 내부에 위치하는지 판정 (마진 적용 지원)
 */
export function isPointInRect(
  pos: Point2D,
  rect: Rect2D,
  margin = 0,
): boolean {
  return (
    pos.x >= rect.x - margin &&
    pos.x <= rect.x + rect.width + margin &&
    pos.y >= rect.y - margin &&
    pos.y <= rect.y + rect.height + margin
  );
}

/**
 * 2D 점에서 사각형 외곽 경계까지의 유클리드 거리 계산 (내부일 경우 0)
 */
export function calcRectOutsideDistance(pos: Point2D, rect: Rect2D): number {
  const distX = Math.max(0, rect.x - pos.x, pos.x - (rect.x + rect.width));
  const distY = Math.max(0, rect.y - pos.y, pos.y - (rect.y + rect.height));
  return Math.hypot(distX, distY);
}

/**
 * 좌표 점 목록으로부터 2차원 분산 계산 (2개 미만일 경우 0)
 */
export function calcPointsVariance(positions: Point2D[]): number {
  if (!positions || positions.length < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  for (const p of positions) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / positions.length;
  const meanY = sumY / positions.length;
  let sumSqDist = 0;
  for (const p of positions) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sumSqDist += dx * dx + dy * dy;
  }
  return sumSqDist / positions.length;
}

/**
 * 2D 점을 사각형 경계 내부로 클램핑
 */
export function clampPointToRect(pos: Point2D, rect: Rect2D): Point2D {
  return {
    x: clamp(pos.x, rect.x, rect.x + rect.width),
    y: clamp(pos.y, rect.y, rect.y + rect.height),
  };
}

/**
 * PoseGeometry 네임스페이스 객체 묶음
 */
export const PoseGeometry = {
  mirrorX,
  mirrorPoint,
  calcDistance,
  calcShoulderWidth,
  normalizeByShoulder,
  calcLateralReach,
  calcDominanceRatio,
  calcArmExtensionRatio,
  calcVelocity,
  calcNormalizedZoneDistance,
  calcNormalizedRadialDistance,
  clamp,
  clamp01,
  lerp,
  lerpPoint,
  calcMidpoint,
  calcVector,
  calcJointAngle,
  isPointInRect,
  calcRectOutsideDistance,
  calcPointsVariance,
  clampPointToRect,
};
