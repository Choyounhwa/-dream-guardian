/**
 * tutorialPatterns.ts - 보스 접근전(Boss Assault) 3단계 튜토리얼 정적 공격 패턴
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §15.3-C8)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-45 / Issue #548)
 *
 * 절대 규칙:
 * 1. Content 데이터 레이어 단일 책임: 튜토리얼용 정적 공격 순서 및 박자 배치 선언.
 * 2. 1단계(펀치, 피해 0), 2단계(스쿼트/가드, 피해 0), 3단계(느린 60~75 BPM 실전 1라운드).
 * 3. 런타임 상태(HP, 점수 등) 및 계산 로직 배제, deepFreeze를 통한 불변성 보장.
 */

import type { AssaultApproachPattern } from './approachPatterns.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/** 3단계 느린 실전 라운드 기준 BPM */
export const TUTORIAL_SLOW_ROUND_BPM = 60;

/** 3단계 느린 라운드 권장 BPM 범위 (60~75 BPM) */
export const TUTORIAL_SLOW_ROUND_BPM_RANGE = Object.freeze({
  min: 60,
  max: 75,
});

/**
 * 튜토리얼 1단계: 펀치 연습 패턴 (피해 0)
 * 좌/우 펀치 타격을 안전하게 연습할 수 있도록 4박 단위 2회의 answer_pair 조우로 구성
 */
export const TUTORIAL_PUNCH_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_tutorial_step1_punch',
  name: '튜토리얼 1단계: 펀치 타격 연습',
  description: '피해 없이 좌우 펀치 타격을 안전하게 연습합니다.',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_tutorial_zero_damage',
  totalBeats: 8,
  encounters: [
    {
      id: 'atk_tut_punch_01',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_tut_punch_01',
      answerPolicyId: 'policy_single_choice',
    },
    {
      id: 'atk_tut_punch_02',
      kind: 'answer_pair',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_tut_punch_02',
      answerPolicyId: 'policy_single_choice',
    },
  ],
});

/**
 * 튜토리얼 2단계: 스쿼트/가드 회피 연습 패턴 (피해 0)
 * 스쿼트 및 양팔 가드 동작을 연습할 수 있도록 4박 단위 2회의 squat 조우로 구성
 */
export const TUTORIAL_SQUAT_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_tutorial_step2_squat',
  name: '튜토리얼 2단계: 스쿼트/가드 회피 연습',
  description: '피해 없이 스쿼트 및 가드 동작으로 보스 공격을 회피하는 연습을 합니다.',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_tutorial_zero_damage',
  totalBeats: 8,
  encounters: [
    {
      id: 'atk_tut_squat_01',
      kind: 'squat',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      squatProfileId: 'squat_approach_standard',
    },
    {
      id: 'atk_tut_squat_02',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      squatProfileId: 'squat_approach_standard',
    },
  ],
});

/**
 * 튜토리얼 3단계: 느린 실전 모의 1라운드 패턴
 * 펀치(4박) → 스쿼트(4박)가 교대되는 8박 기본 실전 루프를 느린 템포(60~75 BPM)로 진행
 */
export const TUTORIAL_SLOW_ROUND_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_tutorial_step3_slow_round',
  name: '튜토리얼 3단계: 느린 실전 1라운드',
  description: '느린 BPM(60~75)으로 펀치 타격과 스쿼트 회피가 교대되는 실전 모의 1라운드를 진행합니다.',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_tutorial_zero_damage',
  totalBeats: 8,
  encounters: [
    {
      id: 'atk_tut_slow_punch',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_tut_slow_01',
      answerPolicyId: 'policy_single_choice',
    },
    {
      id: 'atk_tut_slow_squat',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      squatProfileId: 'squat_approach_standard',
    },
  ],
});

/**
 * 튜토리얼 전체 패턴 모음
 */
export const TUTORIAL_PATTERNS = deepFreeze({
  punch_practice: TUTORIAL_PUNCH_PATTERN,
  squat_practice: TUTORIAL_SQUAT_PATTERN,
  slow_round: TUTORIAL_SLOW_ROUND_PATTERN,
});
