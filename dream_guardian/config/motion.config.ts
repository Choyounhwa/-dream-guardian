/**
 * motion.config.ts - 모션 감지 및 제스처 관련 설정
 *
 * @see Issue #171 (FEAT-MOTION-002)
 */

export interface XGestureConfig {
  /** 대각 어깨 교차 판정 거리 비율 (어깨 너비 기준, 기본 0.55) */
  crossThreshold: number;
  /** 트리거를 위한 최소 체류 시간 (초, 기본 0.4) */
  dwellTime: number;
  /** 연속 트리거 방지 쿨다운 시간 (초, 기본 1.0) */
  cooldownTime: number;
  /** 랜드마크 최소 가시성 (기본 0.5) */
  minVisibility: number;
}

export const DEFAULT_X_GESTURE_CONFIG: XGestureConfig = {
  crossThreshold: 0.55,
  dwellTime: 0.4,
  cooldownTime: 1.0,
  minVisibility: 0.5,
};

export interface KneeFramingConfig {
  minVisibility: number;
  stabilityDuration: number;
  horizontalSafeMargin: number;
  topSafeMargin: number;
  bottomSafeMargin: number;
  minShoulderWidthRatio: number;
  maxShoulderWidthRatio: number;
}

export const DEFAULT_KNEE_FRAMING_CONFIG: KneeFramingConfig = {
  minVisibility: 0.5,
  stabilityDuration: 0.75,
  horizontalSafeMargin: 0.06,
  topSafeMargin: 0.06,
  bottomSafeMargin: 0.08,
  minShoulderWidthRatio: 0.12,
  maxShoulderWidthRatio: 0.45,
};

export interface FootKeynoteConfig {
  minVisibility: number;
  movementThreshold: number;
  cooldownDuration: number;
  rearmNeutralRatio: number;
  virtualHeight?: number;
}

export const DEFAULT_FOOT_KEYNOTE_CONFIG: FootKeynoteConfig = {
  minVisibility: 0.5,
  movementThreshold: 0.04,
  cooldownDuration: 0.3,
  rearmNeutralRatio: 0.25,
};

export interface JumpConfig {
  threshold: number;
  speedMin: number;
  minVisibility: number;
}

export const DEFAULT_JUMP_CONFIG: JumpConfig = {
  threshold: 0.065,
  speedMin: 0.22,
  minVisibility: 0.5,
};
