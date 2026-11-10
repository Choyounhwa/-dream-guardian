/**
 * assault-finale.config.ts - 근접 결전(Boss Assault Finale) 조정 프로필 설정
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §10.2, §14)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-26 / Issue #528)
 *
 * 절대 규칙:
 * 1. Config 레이어 단일 책임: 순수 설정 데이터만 정의한다.
 * 2. 콘텐츠 순서, 런타임 분기, 실행 함수, 타이머, validator 함수 일체 배제.
 * 3. Deep freeze를 통해 불변성 보장.
 */

import type { ProfileId, RulesVersion } from '../src/types/assault.js';

/** 결전 단일 동작 박자 정의 (예고, 판정창, 복귀) */
export interface AssaultFinaleActionTiming {
  /** 예고 박자 */
  readonly anticipation: number;
  /** 입력 유효 판정창 박자 */
  readonly window: number;
  /** 판정 후 복귀 박자 */
  readonly recovery: number;
}

/** 결전 동작별 박자 구성 (punch, squat, jump, rush) */
export interface AssaultFinaleTimingBeats {
  readonly punch: AssaultFinaleActionTiming;
  readonly squat: AssaultFinaleActionTiming;
  readonly jump: AssaultFinaleActionTiming;
  readonly rush: AssaultFinaleActionTiming;
}

/** 저충격(Low-Impact) 대체 동작 설정 */
export interface AssaultFinaleLowImpactConfig {
  readonly squatSubstitute: 'both_arm_guard';
  readonly jumpSubstitute: 'heel_raise';
}

/** 리듬 판정 등급 유예창 (ms 단위) */
export interface AssaultFinaleRhythmWindows {
  readonly Perfect: number;
  readonly Good: number;
  readonly Late: number;
}

/** 근접 결전 통합 밸런스 및 타이밍 프로필 설정 */
export interface AssaultFinaleConfig {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
  /** 결전 보스 초기 체력 (#539 주입 계약 참조) */
  readonly bossInitialHp: number;
  /** 약점 펀치 1회당 보스 피해량 */
  readonly punchDamage: number;
  /** 보스 공격 피격 시 플레이어 피해량 */
  readonly bossAttackDamage: number;
  /** 장판/환경 공격 피격 시 플레이어 피해량 */
  readonly hazardDamage: number;
  /** 결전 허용 최대 실패 횟수 */
  readonly maxFailures: number;
  /** 목표 결전 전체 박자 길이 */
  readonly targetBeats: number;
  /** 각 동작별 예고/판정창/복귀 박자 */
  readonly beats: AssaultFinaleTimingBeats;
  /** 저충격 대체 동작 설정 */
  readonly lowImpact: AssaultFinaleLowImpactConfig;
  /** 리듬 판정 오차 허용창 (ms) */
  readonly rhythmWindows: AssaultFinaleRhythmWindows;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * 기본 근접 결전 조정 프로필 불변 상수 (DEFAULT_ASSAULT_FINALE_CONFIG)
 * DOC-14 §10.2, §14 및 Issue #528 승인 수치 기준
 */
export const DEFAULT_ASSAULT_FINALE_CONFIG: Readonly<AssaultFinaleConfig> = deepFreeze({
  profileId: 'assault_finale_v1',
  rulesVersion: 'v0.3',
  bossInitialHp: 20,
  punchDamage: 2,
  bossAttackDamage: 10,
  hazardDamage: 5,
  maxFailures: 5,
  targetBeats: 64,
  beats: {
    punch: {
      anticipation: 2,
      window: 2,
      recovery: 2,
    },
    squat: {
      anticipation: 2,
      window: 4,
      recovery: 2,
    },
    jump: {
      anticipation: 2,
      window: 3,
      recovery: 2,
    },
    rush: {
      anticipation: 1,
      window: 4,
      recovery: 2,
    },
  },
  lowImpact: {
    squatSubstitute: 'both_arm_guard',
    jumpSubstitute: 'heel_raise',
  },
  rhythmWindows: {
    Perfect: 50,
    Good: 120,
    Late: 170,
  },
});
