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
