/**
 * judgment.config.ts - 판정 유연화(Tolerance) 가중치 및 임계치 설정
 *
 * 팔 뻗기 답안 선택, 존 소프트 경계, 타이밍 관용 등의 단일 수치 출처(SSOT)
 *
 * @see Issue #249 [INPUT-TOLERANCE-001]
 */

import { DEFAULT_ARM_REACH_ANSWER_CONFIG } from './beat-motion.config.js';

export interface ArmReachScoreWeights {
  /** 존 침투 깊이 가중치 (기본 0.30) */
  zonePenetration: number;
  /** 팔 뻗음 비율 가중치 (기본 0.25) */
  armExtension: number;
  /** 수평 우세비 가중치 (기본 0.15) */
  horizontalDominance: number;
  /** 이동 속도 가중치 (기본 0.15) */
  velocity: number;
  /** 가시성 가중치 (기본 0.15) */
  visibility: number;
}

export interface ArmReachJudgmentBaselines {
  /** 팔 뻗음 비율 기준 (기본 0.25) */
  armExtensionRatio: number;
  /** 수평 이동 속도 기준 (기본 0.25) */
  horizontalSpeed: number;
  /** 수평 우세비 기준 (기본 1.2) */
  horizontalDominanceRatio: number;
  /** 가시성 기준 (기본 0.5) */
  visibility: number;
}

export interface ArmReachJudgmentConfig {
  /** 5개 게이트 가중치 */
  weights: ArmReachScoreWeights;
  /** 답안 즉시 확정 최소 종합 점수 임계치 (기본 0.70) */
  confirmThreshold: number;
  /** 양팔 경합 시 우세 손 채택 배율 임계치 (기본 1.25배) */
  dominanceRatio: number;
  /** 가시성 절대 하드 컷오프 가드 (기본 0.30, 이 미만은 무조건 0점/무효) */
  hardMinVisibility: number;
  /** 게이트 정규화 기준값 (0.5 산출 기준점) */
  baselines: ArmReachJudgmentBaselines;
}

export const DEFAULT_ARM_REACH_JUDGMENT_CONFIG: ArmReachJudgmentConfig = {
  weights: {
    zonePenetration: 0.30,
    armExtension: 0.25,
    horizontalDominance: 0.15,
    velocity: 0.15,
    visibility: 0.15,
  },
  confirmThreshold: 0.70,
  dominanceRatio: 1.25,
  hardMinVisibility: 0.30,
  baselines: {
    armExtensionRatio: DEFAULT_ARM_REACH_ANSWER_CONFIG.minArmExtensionRatio,
    horizontalSpeed: DEFAULT_ARM_REACH_ANSWER_CONFIG.dynamicMinHorizontalSpeed,
    horizontalDominanceRatio: DEFAULT_ARM_REACH_ANSWER_CONFIG.horizontalDominanceRatio,
    visibility: DEFAULT_ARM_REACH_ANSWER_CONFIG.minVisibility,
  },
};

export interface ArmReachGateScores {
  zonePenetration: number;
  armExtension: number;
  horizontalDominance: number;
  velocity: number;
  visibility: number;
}

/**
 * 5개 게이트 점수와 가중치로부터 0~1 가중 종합 신뢰도 스코어를 계산
 */
export function computeWeightedArmScore(
  gates: ArmReachGateScores,
  weights: ArmReachScoreWeights = DEFAULT_ARM_REACH_JUDGMENT_CONFIG.weights,
): number {
  return (
    gates.zonePenetration * weights.zonePenetration +
    gates.armExtension * weights.armExtension +
    gates.horizontalDominance * weights.horizontalDominance +
    gates.velocity * weights.velocity +
    gates.visibility * weights.visibility
  );
}
