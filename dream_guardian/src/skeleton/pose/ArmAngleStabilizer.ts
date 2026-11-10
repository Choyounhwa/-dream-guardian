/**
 * ArmAngleStabilizer - 졸라맨 팔 관절 스냅 방지 (Issue #725 / FEAT-SKEL-LIMIT-001)
 *
 * - 길이·가시성 신뢰도 가중(w)으로 각도 갱신량을 연속적으로 감쇠
 * - 위팔: 몸통 하방(torso + π) 기준 상대각, 팔꿈치: 안정화된 위팔 기준 상대각
 * - unwrapNear로 굽힘 방향 유지, softLimitSymmetric으로 소프트 가동 범위 적용
 */

import { smoothstep } from '../../utils/PoseGeometry.js';
import { diffAngle, unwrapNear, softLimitSymmetric } from './angleMath.js';
import type { StickmanArmStabilizerConfig } from '../../../config/skeleton.config.js';

export interface ArmStabilizerInput {
  readonly rawUpperArm: number;        // 이번 프레임 atan2 위팔 절대각 (rad)
  readonly rawForearm: number;         // 이번 프레임 atan2 전완 절대각 (rad)
  readonly torso: number;              // 이번 프레임 스무딩 완료 몸통각 (smoothedAngles.torso)
  readonly prevUpperArm: number;       // 직전 프레임 출력 위팔 절대각
  readonly prevForearm: number;        // 직전 프레임 출력 전완 절대각
  readonly prevTorso: number;          // 직전 프레임 출력 몸통각
  readonly upperLengthRatio: number;   // |어깨-팔꿈치| / 어깨너비
  readonly forearmLengthRatio: number; // |팔꿈치-손목| / 어깨너비
  readonly upperVisibility: number;    // min(어깨.vis, 팔꿈치.vis)
  readonly forearmVisibility: number;  // min(팔꿈치.vis, 손목.vis)
  readonly angleSmoothing: number;     // config.angleSmoothing (기본 0.35)
}

export interface ArmStabilizerOutput {
  readonly upperArm: number;
  readonly forearm: number;
  readonly upperWeight: number;   // 0~1
  readonly forearmWeight: number; // 0~1
}

const DEG_TO_RAD = Math.PI / 180;

export function calcSegmentWeight(
  lengthRatio: number,
  visibility: number,
  cfg: StickmanArmStabilizerConfig,
): number {
  return smoothstep(cfg.minLengthRatio, cfg.fullLengthRatio, lengthRatio)
    * smoothstep(cfg.minVisibility, cfg.fullVisibility, visibility);
}

export function stabilizeArm(
  input: ArmStabilizerInput,
  cfg: StickmanArmStabilizerConfig,
): ArmStabilizerOutput {
  const softZone = cfg.softZoneDeg * DEG_TO_RAD;
  const down = input.torso + Math.PI;
  const prevDown = input.prevTorso + Math.PI;

  // 위팔 (몸통 하방 기준 상대각)
  const upperRelTarget = softLimitSymmetric(
    unwrapNear(diffAngle(input.rawUpperArm, down), diffAngle(input.prevUpperArm, prevDown)),
    cfg.upperArmMaxDeg * DEG_TO_RAD,
    softZone,
  );
  const targetUpper = down + upperRelTarget;
  const wU = calcSegmentWeight(input.upperLengthRatio, input.upperVisibility, cfg);
  const upperArm =
    input.prevUpperArm + diffAngle(targetUpper, input.prevUpperArm) * input.angleSmoothing * wU;

  // 팔꿈치 (안정화된 upperArm 기준 상대각 — rawUpperArm 사용 금지)
  const prevElbowRel = diffAngle(input.prevForearm, input.prevUpperArm);
  const elbowRelTarget = softLimitSymmetric(
    unwrapNear(diffAngle(input.rawForearm, upperArm), prevElbowRel),
    cfg.elbowMaxFlexDeg * DEG_TO_RAD,
    softZone,
  );
  const wF = calcSegmentWeight(input.forearmLengthRatio, input.forearmVisibility, cfg);
  const elbowRel = prevElbowRel + (elbowRelTarget - prevElbowRel) * input.angleSmoothing * wF;
  const forearm = upperArm + elbowRel;

  return { upperArm, forearm, upperWeight: wU, forearmWeight: wF };
}
