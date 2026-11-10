/**
 * angleMath - 순수 각도 연산 유틸리티 (Issue #725 / FEAT-SKEL-LIMIT-001)
 *
 * 순환 참조 방지를 위해 다른 모듈을 import 하지 않는다.
 */

/**
 * 두 각도 간의 최소 회전 차이 계산 (-PI ~ PI 정규화)
 */
export function diffAngle(target: number, current: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * angle을 reference에 가장 가까운 동치 각도로 펼친다 (±π 경계 연속성 유지)
 */
export function unwrapNear(angle: number, reference: number): number {
  return reference + diffAngle(angle, reference);
}

/**
 * |angle| <= maxAbs - softZone 이면 그대로, 그 이상은 tanh로 압축하여 maxAbs를 넘지 않음.
 * softZone <= 0 이면 하드 클램프
 */
export function softLimitSymmetric(angle: number, maxAbs: number, softZone: number): number {
  const sign = angle < 0 ? -1 : 1;
  const a = Math.abs(angle);
  if (softZone <= 0) return sign * Math.min(a, maxAbs);
  const knee = maxAbs - softZone;
  if (a <= knee) return angle;
  return sign * (knee + softZone * Math.tanh((a - knee) / softZone));
}
