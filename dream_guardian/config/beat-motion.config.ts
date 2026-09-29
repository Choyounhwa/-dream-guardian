/**
 * beat-motion.config.ts - BEAT MOTION 8박 라운드 루프 설정
 *
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #178 [CENTER-RETURN-001]
 */

export interface CenterReturnConfig {
  /** 중앙 게이트 중심 X 좌표 (정규화 0~1, 기본 0.5) */
  targetX: number;
  /** 중앙 게이트 허용폭 (정규화 ±, 기본 0.08 즉 [0.42, 0.58]) */
  toleranceX: number;
  /** 안정 판정을 위한 최소 체류 시간 (초, 기본 0.4s) */
  stabilityDuration: number;
  /** 안정 프레임 중앙값 산출을 위한 최소 샘플 수 (기본 5) */
  minSamples: number;
  /** 랜드마크 최소 가시성 (기본 0.5) */
  minVisibility: number;
  /** 표준 복귀 대기 시간 (초, 2박 = 1.0s) */
  standardDuration: number;
  /** 최대 연장 박자 수 (기본 2박) */
  maxExtensionBeats: number;
  /** 비트당 소요 시간 (초, BPM 120 기준 0.5s) */
  secondsPerBeat: number;
  /** 최대 연장 시간 (초, maxExtensionBeats * secondsPerBeat = 1.0s) */
  maxExtensionDuration: number;
  /** 안정 조건 달성 시 자동 잠금 여부 (기본 true) */
  autoLock: boolean;
  /** 타임아웃 시 적용할 기본 기준점 */
  defaultFallbackReference: {
    hipX: number;
    headX: number;
    shoulderWidth: number;
  };
}

export const DEFAULT_CENTER_RETURN_CONFIG: CenterReturnConfig = {
  targetX: 0.5,
  toleranceX: 0.08,
  stabilityDuration: 0.4,
  minSamples: 5,
  minVisibility: 0.5,
  standardDuration: 1.0,
  maxExtensionBeats: 2,
  secondsPerBeat: 0.5,
  maxExtensionDuration: 1.0,
  autoLock: true,
  defaultFallbackReference: {
    hipX: 0.5,
    headX: 0.5,
    shoulderWidth: 0.20,
  },
};

export interface AnswerZoneConfig {
  /** 정답존 진입 변위 비율 (어깨 너비 기준, 기본 0.42) */
  entryRatio: number;
  /** 정답존 취소 변위 비율 (히스테리시스, 어깨 너비 기준, 기본 0.30) */
  cancelRatio: number;
  /** 정답 확정을 위한 최소 체류 시간 (초, BPM 120 기준 1박 = 0.5s) */
  dwellDuration: number;
  /** 랜드마크 최소 가시성 (기본 0.5) */
  minVisibility: number;
  /** 미러(좌우 반전) 좌표계 적용 여부 (기본 true) */
  isMirrored: boolean;
}

export const DEFAULT_ANSWER_ZONE_CONFIG: AnswerZoneConfig = {
  entryRatio: 0.42,
  cancelRatio: 0.30,
  dwellDuration: 0.5,
  minVisibility: 0.5,
  isMirrored: true,
};

export interface StarTimingWindows {
  /** Perfect 판정 허용 오차 (초, ±0.12) */
  perfect: number;
  /** Good 판정 허용 오차 (초, ±0.25) */
  good: number;
  /** Late 판정 허용 오차 (초, ±0.40) */
  late: number;
}

export const DEFAULT_STAR_TIMING_WINDOWS: StarTimingWindows = {
  perfect: 0.12,
  good: 0.25,
  late: 0.40,
};

export interface StarCollectionConfig {
  /** 타이밍 윈도우 설정 (Perfect, Good, Late) */
  timingWindows: StarTimingWindows;
  /** 기본 뷰포트 가상 너비 (기본 1080) */
  virtualWidth: number;
  /** 기본 뷰포트 가상 높이 (기본 2160) */
  virtualHeight: number;
  /** 미러(좌우 반전) 좌표계 적용 여부 (기본 false) */
  isMirrored: boolean;
  /** 진입 마진 허용 여부/크기 (정규화 단위, 기본 0) */
  entryMargin: number;
}

export const DEFAULT_STAR_COLLECTION_CONFIG: StarCollectionConfig = {
  timingWindows: DEFAULT_STAR_TIMING_WINDOWS,
  virtualWidth: 1080,
  virtualHeight: 2160,
  isMirrored: false,
  entryMargin: 0,
};

export interface BeatMotionConfig {
  bpm: number;
  beatsPerRound: number;
  centerReturn: CenterReturnConfig;
  answerZone: AnswerZoneConfig;
  starCollection: StarCollectionConfig;
}

export const DEFAULT_BEAT_MOTION_CONFIG: BeatMotionConfig = {
  bpm: 120,
  beatsPerRound: 8,
  centerReturn: DEFAULT_CENTER_RETURN_CONFIG,
  answerZone: DEFAULT_ANSWER_ZONE_CONFIG,
  starCollection: DEFAULT_STAR_COLLECTION_CONFIG,
};
