/**
 * assault-loop.config.ts - 보스 접근전 러닝·선택·휴식 루프 프로필 및 타이밍 설정
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-01.md (ASSAULT-LOOP-01 / Issue #694)
 *
 * 절대 규칙:
 * 1. Config 레이어 단일 책임: 순수 설정 데이터 및 도메인 계산 공식만 정의한다.
 * 2. 런타임 분기, 상태 조작, 타이머, 실행 함수 일체 배제.
 * 3. deepFreeze를 통해 불변성 보장.
 * 4. DRY 원칙 준수: HP, 피해량, 기본 BPM, 라운드 목표 등은 기존 DEFAULT_ASSAULT_CONFIG를 참조한다 (값 복제 금지).
 */

import { DEFAULT_ASSAULT_CONFIG } from './assault.config.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';
import type {
  AssaultLoopProfile,
  AssaultLoopSquatSubBeats,
} from '../src/types/assault-loop.js';

// ─── 1. 루프 SSOT 박자 및 기회 상수 ───

/** 첫 문제 러닝 및 낭독 박자 (DOC-19 §1 SSOT: 8박 1회) */
export const ASSAULT_LOOP_RUN_BEATS = 8;

/** 답안 인식 및 선택 박자 (DOC-19 §1 SSOT: 4박) */
export const ASSAULT_LOOP_ANSWER_BEATS = 4;

/** 무공격·무피해 휴식 박자 (0박: 쉬는 박자 삭제 / ASSAULT-BEAT-001) */
export const ASSAULT_LOOP_REST_BEATS = 0;

/** 문제당 답안 선택 기회 총수 (DOC-19 §1 SSOT: 4회) */
export const ASSAULT_LOOP_ANSWER_OPPORTUNITIES = 4;

/** 스쿼트 전체 박자 (DOC-19 §1 SSOT: 4박) */
export const ASSAULT_LOOP_SQUAT_BEATS = 4;

/** 스쿼트 세부 하위 박자: 예고 (DOC-19 §1 권장안: 1박) */
export const ASSAULT_LOOP_SQUAT_NOTICE_BEATS = 1;

/** 스쿼트 세부 하위 박자: 회피 판정 (DOC-19 §1 권장안: 2박) */
export const ASSAULT_LOOP_SQUAT_DODGE_BEATS = 2;

/** 스쿼트 세부 하위 박자: 직립 복귀 (DOC-19 §1 권장안: 1박) */
export const ASSAULT_LOOP_SQUAT_STAND_BEATS = 1;

/** 스쿼트 삽입 가능 후보 gap (선택 1~2, 2~3, 3~4 사이 3곳) */
export const ASSAULT_LOOP_CANDIDATE_GAPS: readonly number[] = [1, 2, 3];

/**
 * 기본 루프 총 박자 (스쿼트 제외 기준)
 * 8 + (4 + 0) * 4 = 24박
 */
export const ASSAULT_LOOP_BASE_BEATS =
  ASSAULT_LOOP_RUN_BEATS +
  (ASSAULT_LOOP_ANSWER_BEATS + ASSAULT_LOOP_REST_BEATS) * ASSAULT_LOOP_ANSWER_OPPORTUNITIES;

// ─── 2. 설정 인터페이스 및 기본 설정 객체 ───

export type AssaultLoopConfig = AssaultLoopProfile;

/**
 * 보스 접근전 러닝·선택·휴식 루프 기본 설정 (SSOT)
 */
export const DEFAULT_ASSAULT_LOOP_CONFIG: Readonly<AssaultLoopConfig> = deepFreeze({
  profileId: 'assault_loop_v1',
  rulesVersion: '1.0.0',

  // DRY 원칙: 기존 DEFAULT_ASSAULT_CONFIG 참조
  defaultBpm: DEFAULT_ASSAULT_CONFIG.defaultBpm,
  playerMaxHp: DEFAULT_ASSAULT_CONFIG.playerMaxHp,
  wrongDamage: DEFAULT_ASSAULT_CONFIG.wrongDamage,
  missDamage: DEFAULT_ASSAULT_CONFIG.missDamage,
  squatFailDamage: DEFAULT_ASSAULT_CONFIG.squatFailDamage,
  targetRounds: DEFAULT_ASSAULT_CONFIG.targetRounds,

  // 루프 전용 박자 및 구조
  runBeats: ASSAULT_LOOP_RUN_BEATS,
  answerBeats: ASSAULT_LOOP_ANSWER_BEATS,
  restBeats: ASSAULT_LOOP_REST_BEATS,
  answerOpportunities: ASSAULT_LOOP_ANSWER_OPPORTUNITIES,
  squatBeats: ASSAULT_LOOP_SQUAT_BEATS,
  squatSubBeats: {
    notice: ASSAULT_LOOP_SQUAT_NOTICE_BEATS,
    dodge: ASSAULT_LOOP_SQUAT_DODGE_BEATS,
    stand: ASSAULT_LOOP_SQUAT_STAND_BEATS,
  } as AssaultLoopSquatSubBeats,
  candidateGaps: ASSAULT_LOOP_CANDIDATE_GAPS,
  // [FEAT-ASSAULT-LOOP-019 / Issue #744]
  // #734(오답·Miss 시 동적 스쿼트) 보류 기간 동안 사전 배치 스쿼트 임시 제거: 0회 (run 8 + answer 4*4 = 24박)
  // #734 동적 스쿼트 재개 시 복원 또는 동적 정책으로 대체
  minSquatsPerRound: 0,
  maxSquatsPerRound: 0,
  baseBeats: ASSAULT_LOOP_BASE_BEATS,
});

// ─── 3. 루프 박자 및 시간 계산 헬퍼 함수 ───

/**
 * 스쿼트 개수(N)에 따른 라운드 전체 박자 계산
 * 공식: baseBeats(24) + 4N (N=1일 때 28박, N=2일 때 32박)
 *
 * @param squatCount 삽입된 스쿼트 개수 (기본 1~2개)
 * @param config 루프 프로필 (기본값: DEFAULT_ASSAULT_LOOP_CONFIG)
 * @returns 라운드 전체 박자 수
 */
export function calculateLoopTotalBeats(
  squatCount: number,
  config: Pick<AssaultLoopProfile, 'baseBeats' | 'squatBeats'> = DEFAULT_ASSAULT_LOOP_CONFIG,
): number {
  return config.baseBeats + squatCount * config.squatBeats;
}

/**
 * 박자 수와 BPM에 따른 총 소요 시간(초) 계산
 * 공식: (beats / BPM) * 60
 * (예: 120 BPM 기준 36박은 18초, 40박은 20초)
 *
 * @param beats 박자 수
 * @param bpm 분당 박자 수 (생략 시 config 기본 BPM인 120 사용)
 * @returns 소요 시간 (초)
 */
export function calculateLoopTotalSeconds(
  beats: number,
  bpm: number = DEFAULT_ASSAULT_LOOP_CONFIG.defaultBpm,
): number {
  if (bpm <= 0) return 0;
  return (beats / bpm) * 60;
}
