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
}

export interface AssaultTimingAndBalanceConfig {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
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
  /** 답안 선택 구간 기본 지속 박자 */
  readonly answerBeats: number;
  /** 스쿼트 회피 구간 기본 지속 박자 */
  readonly squatBeats: number;
  /** 리듬 판정 등급 유예창 (ms, DEC-C4, DEC-B6) */
  readonly rhythmWindows: AssaultRhythmWindows;
  /** 보기 라벨 최대 글자 수 (DEC-C9) */
  readonly labelMaxLength: number;
  /** 보기 라벨 최소 폰트 크기 (px, DEC-C9) */
  readonly labelMinFontSizePx: number;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export const DEFAULT_ASSAULT_CONFIG: Readonly<AssaultTimingAndBalanceConfig> = deepFreeze({
  profileId: 'assault_mvp_v1',
  rulesVersion: 'v0.3',
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
  answerBeats: 4,
  squatBeats: 4,
  rhythmWindows: {
    Perfect: 50,
    Good: 120,
    Late: 170,
  },
  labelMaxLength: 6,
  labelMinFontSizePx: 20,
});
