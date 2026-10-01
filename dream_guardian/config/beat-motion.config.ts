/**
 * beat-motion.config.ts - BEAT MOTION 8박 라운드 루프 설정
 *
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #178 [CENTER-RETURN-001]
 * @see Issue #204 [BEAT-TRACK-001]
 */

import type { LoopPattern, MusicTrackConfig } from '../src/types/track.js';

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
  /** 점프 판정 수직 속도 상한 (정규화 단위/초, 기본 0.22) @see JUMP_VERTICAL_SPEED_THRESHOLD in judgment.config.ts (SSOT) */
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

// ─── Music Track & Variable Loop Pattern (Issue #204 / BEAT-TRACK-001) ───

export const DEFAULT_LOOP_PATTERN: LoopPattern = {
  exerciseBeats: 8,
  readyBeats: 2,
  performanceBeats: 8,
};

export const DEFAULT_TRACK_CONFIG: MusicTrackConfig = {
  id: 'track-default',
  name: 'Default Track',
  bpm: 120,
  timeSignature: [4, 4],
  intro: {
    countInBeats: 3,
    soundType: 'metronome',
  },
  loopPattern: DEFAULT_LOOP_PATTERN,
};

export const CHAPTER_TRACK_PRESETS: Readonly<Record<number, MusicTrackConfig>> = Object.freeze({
  1: {
    id: 'track-ch1',
    name: '하얘시니 - Hard Rock',
    bpm: 110,
    timeSignature: [4, 4],
    intro: {
      countInBeats: 3,
      soundType: 'metronome',
    },
    loopPattern: {
      exerciseBeats: 8,
      readyBeats: 2,
      performanceBeats: 8,
    },
  },
  2: {
    id: 'track-ch2',
    name: '재촉새 - Uptempo EDM',
    bpm: 135,
    timeSignature: [4, 4],
    intro: {
      countInBeats: 3,
      soundType: 'metronome',
    },
    loopPattern: {
      exerciseBeats: 8,
      readyBeats: 2,
      performanceBeats: 8,
    },
  },
  3: {
    id: 'track-ch3',
    name: '따돌시니 - Neo Classical',
    bpm: 115,
    timeSignature: [4, 4],
    intro: {
      countInBeats: 3,
      soundType: 'metronome',
    },
    loopPattern: {
      exerciseBeats: 8,
      readyBeats: 2,
      performanceBeats: 8,
    },
  },
  4: {
    id: 'track-ch4',
    name: '풀죽새 - Disco Funk',
    bpm: 125,
    timeSignature: [4, 4],
    intro: {
      countInBeats: 3,
      soundType: 'metronome',
    },
    loopPattern: {
      exerciseBeats: 8,
      readyBeats: 2,
      performanceBeats: 8,
    },
  },
  5: {
    id: 'track-ch5',
    name: '캄캄대왕 - Epic Metal',
    bpm: 140,
    timeSignature: [4, 4],
    intro: {
      countInBeats: 3,
      soundType: 'metronome',
    },
    loopPattern: {
      exerciseBeats: 8,
      readyBeats: 2,
      performanceBeats: 8,
    },
  },
});

// ─── Difficulty Beat Profile & Variable Loop (Issue #279 / BEAT-DIFFICULTY-001) ───

export interface DifficultyBeatProfile {
  /** 러닝/운동 총 박자 수 (8, 12, 16) */
  exerciseBeats: number;
  /** 답안 원근 접근 시작 박자 (exerciseBeats - 2 = 6, 10, 14) */
  approachStartBeat: number;
  /** 답안 선택 유효 박자 수 (기본 2박, 심화 4박) */
  answerSelectBeats: number;
  /** 분기 루틴(별가루 8노트 / 보스 장판 회피) 박자 수 (기본 8박) */
  branchRoutineBeats: number;
}

export const DEFAULT_DIFFICULTY_BEAT_PROFILE: DifficultyBeatProfile = {
  exerciseBeats: 8,
  approachStartBeat: 6,
  answerSelectBeats: 2,
  branchRoutineBeats: 8,
};

export const CHAPTER_SUBLEVEL_BEAT_PROFILES: Readonly<
  Record<number, { default: DifficultyBeatProfile; subLevels?: Record<number, DifficultyBeatProfile> }>
> = Object.freeze({
  1: {
    default: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
    subLevels: {
      1: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
      2: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
      3: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
    },
  },
  2: {
    default: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
    subLevels: {
      1: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
      2: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
      3: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 2, branchRoutineBeats: 8 },
      4: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 2, branchRoutineBeats: 8 },
    },
  },
  3: {
    default: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 2, branchRoutineBeats: 8 },
    subLevels: {
      1: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
      2: { exerciseBeats: 8, approachStartBeat: 6, answerSelectBeats: 2, branchRoutineBeats: 8 },
      3: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
      4: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
    },
  },
  4: {
    default: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 2, branchRoutineBeats: 8 },
    subLevels: {
      1: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 2, branchRoutineBeats: 8 },
      2: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 2, branchRoutineBeats: 8 },
      3: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
      4: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
    },
  },
  5: {
    default: { exerciseBeats: 16, approachStartBeat: 14, answerSelectBeats: 4, branchRoutineBeats: 8 },
    subLevels: {
      1: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
      2: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
      3: { exerciseBeats: 16, approachStartBeat: 14, answerSelectBeats: 4, branchRoutineBeats: 8 },
      4: { exerciseBeats: 12, approachStartBeat: 10, answerSelectBeats: 4, branchRoutineBeats: 8 },
      5: { exerciseBeats: 16, approachStartBeat: 14, answerSelectBeats: 4, branchRoutineBeats: 8 },
      6: { exerciseBeats: 16, approachStartBeat: 14, answerSelectBeats: 4, branchRoutineBeats: 8 },
    },
  },
});

export function getDifficultyBeatProfile(chapter: number, subLevel?: number): DifficultyBeatProfile {
  const chapterConfig = CHAPTER_SUBLEVEL_BEAT_PROFILES[chapter];
  if (!chapterConfig) {
    return { ...DEFAULT_DIFFICULTY_BEAT_PROFILE };
  }
  if (subLevel !== undefined && subLevel > 0 && chapterConfig.subLevels?.[subLevel]) {
    return { ...chapterConfig.subLevels[subLevel] };
  }
  return { ...chapterConfig.default };
}

