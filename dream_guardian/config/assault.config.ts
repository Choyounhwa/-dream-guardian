/**
 * assault.config.ts - 보스 접근전(Boss Assault) 타이밍 및 밸런스 프로필 설정
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§5, 6.4, 6.7, 14)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-03 / Issue #505)
 *
 * 절대 규칙:
 * 1. Config 레이어 단일 책임: 순수 설정 데이터만 정의한다.
 * 2. 콘텐츠 순서, 런타임 분기, 실행 함수, 타이머, 문제 텍스트 일체 배제.
 * 3. Deep freeze를 통해 불변성 보장.
 */

import type { ProfileId, RulesVersion } from '../src/types/assault.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';

export interface AssaultReadingMinSeconds {
  readonly addition: number;
  readonly subtraction: number;
  readonly multiplication: number;
  readonly division: number;
  readonly default: number;
}

export interface AssaultRhythmWindows {
  readonly Perfect: number;
  readonly Good: number;
  readonly Late: number;
  /**
   * 조기 미스 기준 (ms, 양수). deltaMs < -EarlyMiss 인 펀치는 잠금/피해 없이 Early Miss로만 기록.
   * undefined 또는 null이면 비활성(기본). (FEAT-ASSAULT-RHYTHM-001)
   */
  readonly EarlyMiss?: number | null;
}

export interface AssaultDifficultyFlightBeats {
  readonly easy: number;
  readonly normal: number;
  readonly hard: number;
}

/**
 * 기본 난이도별 답안 체공/원근 확대 박자 프로필 (SSOT)
 */
export const DEFAULT_ASSAULT_ANSWER_FLIGHT_BEATS: Readonly<AssaultDifficultyFlightBeats> = deepFreeze({
  easy: 3,
  normal: 2,
  hard: 1.5,
});

/**
 * 보스 접근전 표준 기본 진행 BPM (DOC-14 §5.2 SSOT, #503 승인 사양: 120 BPM)
 */
export const DEFAULT_ASSAULT_BPM = 120;

export interface AssaultTimingAndBalanceConfig {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
  /** 기본 표준 진행 BPM (DOC-14 §5.2 SSOT, #503 승인 사양: 120) */
  readonly defaultBpm: number;
  /** 라운드 최소 박자 (A03: 최소 8박 보장) */
  readonly minRoundBeats: number;
  /** 연산 유형별 읽기 시간 하한 (초, DEC-C1) */
  readonly readingMinSeconds: AssaultReadingMinSeconds;
  /** 글자 수당 추정 낭독 시간 (ms, DEC-B3) */
  readonly readingCharRateMs: number;
  /** TTS 최대 허용 상한 (초, DEC-B3, A20) */
  readonly ttsMaxSeconds: number;
  /** 일시정지 복귀 유예 준비 박자 (DEC-B8, A19, A23) */
  readonly resumeReadyBeats: number;
  /** 플레이어 최대 HP (DEC-A8: 기존 100 불변) */
  readonly playerMaxHp: number;
  /** 오답 시 피해량 (DEC-C10) */
  readonly wrongDamage: number;
  /** 스쿼트 회피 실패 시 피해량 (DEC-C10) */
  readonly squatFailDamage: number;
  /** 미선택(타임아웃) 시 피해량 (DEC-C10) */
  readonly missDamage: number;
  /** 답안 선택 구간 기본 지속 박자 (기본값: 2박) */
  readonly answerBeats: number;
  /** 난이도별 답안 체공/원근 박자 (기본값: easy 3박, normal 2박, hard 1.5박) */
  readonly answerFlightBeatsByDifficulty?: AssaultDifficultyFlightBeats;
  /** 스쿼트 회피 구간 기본 지속 박자 */
  readonly squatBeats: number;
  /** 리듬 판정 등급 유예창 (ms, DEC-C4, DEC-B6) */
  readonly rhythmWindows: AssaultRhythmWindows;
  /** 보기 라벨 최대 글자 수 (DEC-C9) */
  readonly labelMaxLength: number;
  /** 보기 라벨 최소 폰트 크기 (px, DEC-C9) */
  readonly labelMinFontSizePx: number;
  /** 접근전 목표 라운드 수 (REC-00 / #588 승인값, DEC-A11) */
  readonly targetRounds: number;
}

export const DEFAULT_ASSAULT_CONFIG: Readonly<AssaultTimingAndBalanceConfig> = deepFreeze({
  profileId: 'assault_mvp_v1',
  rulesVersion: 'v0.3',
  defaultBpm: DEFAULT_ASSAULT_BPM,
  minRoundBeats: 8,
  readingMinSeconds: {
    addition: 3.0,
    subtraction: 3.0,
    multiplication: 4.0,
    division: 4.0,
    default: 3.5,
  },
  readingCharRateMs: 150,
  ttsMaxSeconds: 3.0,
  resumeReadyBeats: 1,
  playerMaxHp: 100,
  wrongDamage: 10,
  squatFailDamage: 5,
  missDamage: 10,
  answerBeats: 2,
  answerFlightBeatsByDifficulty: DEFAULT_ASSAULT_ANSWER_FLIGHT_BEATS,
  squatBeats: 4,
  rhythmWindows: {
    Perfect: 50,
    Good: 120,
    Late: 170,
    /** #745: 정박 170ms 이전 타격은 정답 여부 무관 MISS(잠금/피해 없음, 재선택 허용) */
    EarlyMiss: 170,
  },
  labelMaxLength: 6,
  labelMinFontSizePx: 20,
  targetRounds: 10,
});

/**
 * 난이도(GameDifficulty)에 따른 답안 비행/원근 박자 계산 헬퍼
 *
 * @param difficulty 난이도 문자열 ('easy' | 'normal' | 'hard')
 * @param config 타이밍 설정 (생략 시 DEFAULT_ASSAULT_CONFIG)
 * @returns 답안 체공 박자 수 (기본값: 2)
 */
export function getAssaultAnswerBeats(
  difficulty?: string,
  config?: AssaultTimingAndBalanceConfig,
): number {
  const cfg = config ?? DEFAULT_ASSAULT_CONFIG;
  if (difficulty && cfg.answerFlightBeatsByDifficulty) {
    const key = difficulty.toLowerCase() as keyof AssaultDifficultyFlightBeats;
    if (typeof cfg.answerFlightBeatsByDifficulty[key] === 'number') {
      return cfg.answerFlightBeatsByDifficulty[key];
    }
  }
  return cfg.answerBeats ?? 2;
}
