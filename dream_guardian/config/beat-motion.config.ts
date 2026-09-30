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

export interface ArmReachAnswerConfig {
  /** 랜드마크 최소 가시성 (기본 0.5) */
  minVisibility: number;
  /** 어깨 대비 최소 뻗음 거리 비율 (기본 0.25) */
  minArmExtensionRatio: number;
  /** 동적 뻗기 최소 수평 속도 (정규화 단위/초, 기본 0.25) */
  dynamicMinHorizontalSpeed: number;
  /** 수평/수직 우세 비율 (기본 1.2) */
  horizontalDominanceRatio: number;
  /** 점프 판정 수직 속도 상한 (정규화 단위/초, 기본 0.22) */
  jumpVerticalSpeedThreshold: number;
  /** 카메라 미러링 여부 (기본 false) */
  isMirrored: boolean;
}

export const DEFAULT_ARM_REACH_ANSWER_CONFIG: ArmReachAnswerConfig = {
  minVisibility: 0.5,
  minArmExtensionRatio: 0.25,
  dynamicMinHorizontalSpeed: 0.25,
  horizontalDominanceRatio: 1.2,
  jumpVerticalSpeedThreshold: 0.22,
  isMirrored: false,
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

export interface RunQuestionConfig {
  /** 라운드당 필요한 유효 운동 박자 수 (기본 8) */
  exerciseBeats: number;
  /** 문제 접근에 소요되는 계약 박자 수 (기본 2) */
  approachBeats: number;
}

export const DEFAULT_RUN_QUESTION_CONFIG: RunQuestionConfig = {
  exerciseBeats: 8,
  approachBeats: 2,
};

export interface BeatMotionConfig {
  bpm: number;
  beatsPerRound: number;
  centerReturn: CenterReturnConfig;
  armReachAnswer: ArmReachAnswerConfig;
  starCollection: StarCollectionConfig;
  questionApproach: QuestionApproachConfig;
  runQuestion: RunQuestionConfig;
}

export interface QuestionApproachConfig {
  /** 문제 원근 접근에 소요되는 박자 수 (기본 2박) */
  approachBeats: number;
  /** 소실점 시작 최소 크기 배율 (기본 0.15) */
  minScale: number;
  /** 소실점 시작 최소 불투명도 (기본 0.10) */
  startAlpha: number;
  /** 접근 감속 ease-out 차수 (기본 2.0 = quadratic ease out) */
  easePower: number;
}

export const DEFAULT_QUESTION_APPROACH_CONFIG: QuestionApproachConfig = {
  approachBeats: 2,
  minScale: 0.15,
  startAlpha: 0.10,
  easePower: 2.0,
};

export const DEFAULT_BEAT_MOTION_CONFIG: BeatMotionConfig = {
  bpm: 120,
  beatsPerRound: 8,
  centerReturn: DEFAULT_CENTER_RETURN_CONFIG,
  armReachAnswer: DEFAULT_ARM_REACH_ANSWER_CONFIG,
  starCollection: DEFAULT_STAR_COLLECTION_CONFIG,
  questionApproach: DEFAULT_QUESTION_APPROACH_CONFIG,
  runQuestion: DEFAULT_RUN_QUESTION_CONFIG,
};
