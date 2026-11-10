/**
 * PoseBlender - 베이스 포즈 각도와 오버레이 애니메이션 클립 각도 블렌더
 * Issue #687 / FEAT-ANIM-001
 */

import { diffAngle } from '../pose/PoseAngleSolver.js';

/**
 * 두 각도를 최단 회전 경로(diffAngle)를 통해 가중치(0~1)로 보간
 */
export function blendAngles(baseAngle: number, overlayAngle: number, weight: number): number {
  const w = Math.max(0, Math.min(1, weight));
  return baseAngle + diffAngle(overlayAngle, baseAngle) * w;
}

/**
 * 베이스 본 각도 맵에 오버레이 본 각도 맵을 가중치 및 본 마스크를 적용하여 합성
 */
export function blend(
  baseAngles: Record<string, number>,
  overlayAngles: Record<string, number>,
  weight: number,
  boneMask?: Set<string> | string[]
): Record<string, number> {
  const result: Record<string, number> = { ...baseAngles };
  const w = Math.max(0, Math.min(1, weight));
  if (w <= 0) {
    return result;
  }

  const mask = boneMask
    ? boneMask instanceof Set
      ? boneMask
      : new Set(boneMask)
    : undefined;

  for (const [boneId, overlayAngle] of Object.entries(overlayAngles)) {
    if (mask && !mask.has(boneId)) {
      continue;
    }
    const baseAngle = baseAngles[boneId] ?? 0;
    result[boneId] = blendAngles(baseAngle, overlayAngle, w);
  }

  return result;
}

export class PoseBlender {
  static blendAngles(baseAngle: number, overlayAngle: number, weight: number): number {
    return blendAngles(baseAngle, overlayAngle, weight);
  }

  static blend(
    baseAngles: Record<string, number>,
    overlayAngles: Record<string, number>,
    weight: number,
    boneMask?: Set<string> | string[]
  ): Record<string, number> {
    return blend(baseAngles, overlayAngles, weight, boneMask);
  }

  blendAngles(baseAngle: number, overlayAngle: number, weight: number): number {
    return blendAngles(baseAngle, overlayAngle, weight);
  }

  blend(
    baseAngles: Record<string, number>,
    overlayAngles: Record<string, number>,
    weight: number,
    boneMask?: Set<string> | string[]
  ): Record<string, number> {
    return blend(baseAngles, overlayAngles, weight, boneMask);
  }
}
