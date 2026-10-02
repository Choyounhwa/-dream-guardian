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
 * 2D 좌표 점을 미러링 옵션에 따라 변환 (y좌표 보존)
 */
export function mirrorPoint(pt: Point2D, isMirrored = true): Point2D {
  return {
    x: isMirrored ? mirrorX(pt.x) : pt.x,
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
};
