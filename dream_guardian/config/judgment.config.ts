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

/**
 * 피트니스 존 판정 소프트 경계 (히스테리시스, 자석 존, 체격 정규화 마진) 설정 인터페이스
 *
 * @see Issue #250 [INPUT-TOLERANCE-002]
 */
export interface ZoneSoftBoundaryConfig {
  /** 존 이탈 히스테리시스 보너스 마진 (기본 0.04) */
  exitMarginBonus: number;
  /** 자석 존 스냅 유효 반경 (기본 0.06) */
  snapRadius: number;
  /** 체격 정규화 기준 어깨 너비 (기본 0.25) */
  referenceShoulderWidth: number;
  /** 손 기본 마진 비율 (handBaseMargin = 0.15 * shoulderWidth) */
  handBaseMarginRatio: number;
  /** 불안정(낮은 신뢰도/고분산) 마진 확장 배수 (기본 1.5) */
  unstableMarginMultiplier: number;
  /** 최근 분산 계산용 프레임 이력 길이 (기본 6) */
  varianceHistoryLength: number;
  /** 분산 임계치 (기본 0.0005) */
  varianceThreshold: number;
}

/**
 * 피트니스 존 판정 소프트 경계 기본 설정값
 */
export const DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG: ZoneSoftBoundaryConfig = {
  exitMarginBonus: 0.04,
  snapRadius: 0.06,
  referenceShoulderWidth: 0.25,
  handBaseMarginRatio: 0.15,
  unstableMarginMultiplier: 1.5,
  varianceHistoryLength: 6,
  varianceThreshold: 0.0005,
};

/**
 * 타이밍 관용 레이어 설정 인터페이스
 *
 * @see Issue #251 [INPUT-TOLERANCE-003]
 */
export interface TimingLeniencyConfig {
  /** 선행 입력 버퍼 윈도우 (초, 기본 0.20) */
  preBufferWindow: number;
  /** 후행 유예(Coyote Time) 윈도우 (초, 기본 0.15) */
  postGraceWindow: number;
  /** 존 이탈 진행도 감쇠 보류 시간 (초, 기본 0.15) */
  decayHoldTime: number;
  /** 선행 입력 버퍼 활성화 여부 */
  enablePreBuffer: boolean;
  /** 후행 유예 활성화 여부 */
  enablePostGrace: boolean;
  /** 감쇠 홀드 활성화 여부 */
  enableDecayHold: boolean;
  /** 랜드마크 추적 유실 시 진행도 동결 활성화 여부 */
  enableTrackingLossFreeze: boolean;
}

/**
 * 타이밍 관용 기본 설정값
 */
export const DEFAULT_TIMING_LENIENCY_CONFIG: TimingLeniencyConfig = {
  preBufferWindow: 0.20,
  postGraceWindow: 0.15,
  decayHoldTime: 0.15,
  enablePreBuffer: true,
  enablePostGrace: true,
  enableDecayHold: true,
  enableTrackingLossFreeze: true,
};

