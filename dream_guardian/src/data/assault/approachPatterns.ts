/**
 * approachPatterns.ts - 보스 접근전(Boss Assault) MVP 교대 공격 정적 콘텐츠
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.4, 6.5, 6.7)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-04 / Issue #506)
 *
 * 절대 규칙:
 * 1. Content 데이터 레이어 단일 책임: 순수 정적 공격 순서 및 박자 배치만 선언한다.
 * 2. 함수, 실행 콜백, 조건문, 런타임 상태(HP, 점수, 페이즈 등) 일체 배제.
 * 3. Question 레이어의 정답/수식/텍스트를 복제하지 않는다.
 * 4. 피해량(damage) 수치를 포함하지 않으며 config/밸런스 프로필 참조로 위임한다.
 * 5. deepFreeze를 통한 불변성(Immutability) 보장.
 */

import type {
  AssaultEncounterDef,
  ProfileId,
} from '../../types/assault.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/**
 * 보스 접근전 패턴 정의 (Assault Approach Pattern)
 */
export interface AssaultApproachPattern {
  readonly schemaVersion: string;
  readonly patternId: string;
  readonly name?: string;
  readonly description?: string;
  readonly timingProfileId: ProfileId;
  readonly balanceProfileId?: ProfileId;
  readonly totalBeats: number;
  readonly encounters: readonly AssaultEncounterDef[];
}

/**
 * MVP 표준 교대 공격 패턴 (Default Approach Pattern)
 *
 * 박자 구조 (총 8박, #503 승인 사양):
 * - 0~4박 (4박): answer_pair (답안 선택 펀치/터치)
 * - 4~8박 (4박): squat (보스 돌진/공격 스쿼트 회피)
 *
 * 0-based startBeat 적용 및 프로필 참조 기반 선언.
 */
export const DEFAULT_APPROACH_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_approach_standard_mvp',
  name: 'MVP 표준 교대 접근전 패턴',
  description: '답안 선택(4박)과 스쿼트 회피(4박)가 번갈아 진행되는 8박 기본 사이클 (DOC-15 #503 승인)',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_mvp_v1',
  totalBeats: 8,
  encounters: [
    {
      id: 'attack_01_answer',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_01',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_02_squat',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
  ],
});

/**
 * 확장 16박 교대 공격 패턴 (Extended 16-beat Approach Pattern)
 *
 * 16박 확장 라운드용 보조 패턴 (답안 2쌍 + 스쿼트 2회 교대 구성).
 */
export const EXTENDED_16_APPROACH_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_approach_extended_16',
  name: '확장 16박 교대 접근전 패턴',
  description: '답안 선택(4박)과 스쿼트 회피(4박) 2회 반복 (총 16박)',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_mvp_v1',
  totalBeats: 16,
  encounters: [
    {
      id: 'attack_01_answer',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_01',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_02_squat',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
    {
      id: 'attack_03_answer',
      kind: 'answer_pair',
      startBeat: 8,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_02',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_04_squat',
      kind: 'squat',
      startBeat: 12,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
  ],
});

/**
 * 3쌍 20박 교대 공격 패턴 (Multi-pair 20-beat Approach Pattern)
 *
 * 답안 선택 3쌍과 스쿼트 2회가 교대로 진행되는 20박 패턴 (DOC-18 §10 / #651).
 * 박자 구조:
 * - 0~4박 (4박): answer_pair (pair_01)
 * - 4~8박 (4박): squat
 * - 8~12박 (4박): answer_pair (pair_02)
 * - 12~16박 (4박): squat
 * - 16~20박 (4박): answer_pair (pair_03)
 */
export const MULTI_PAIR_20_APPROACH_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_approach_multi_pair_20',
  name: '3쌍 20박 교대 접근전 패턴',
  description: '답안 선택 3쌍과 스쿼트 2회가 교대로 진행되는 20박 패턴',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_mvp_v1',
  totalBeats: 20,
  encounters: [
    {
      id: 'attack_01_answer',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_01',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_02_squat',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
    {
      id: 'attack_03_answer',
      kind: 'answer_pair',
      startBeat: 8,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_02',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_04_squat',
      kind: 'squat',
      startBeat: 12,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
    {
      id: 'attack_05_answer',
      kind: 'answer_pair',
      startBeat: 16,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_03',
      answerPolicyId: 'policy_dual_choice',
    },
  ],
});

/**
 * 4쌍 32박 교대 공격 패턴 (Multi-pair 32-beat Approach Pattern)
 *
 * 답안 선택 4쌍과 스쿼트 4회가 교대로 진행되는 32박 패턴 (#680 4쌍 챌린지 CSV 체계 지원).
 * 박자 구조:
 * - 0~4박: answer_pair (pair_01)
 * - 4~8박: squat
 * - 8~12박: answer_pair (pair_02)
 * - 12~16박: squat
 * - 16~20박: answer_pair (pair_03)
 * - 20~24박: squat
 * - 24~28박: answer_pair (pair_04)
 * - 28~32박: squat
 */
export const MULTI_PAIR_32_APPROACH_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_approach_multi_pair_32',
  name: '4쌍 32박 교대 접근전 패턴',
  description: '답안 선택 4쌍과 스쿼트 4회가 교대로 진행되는 32박 패턴',
  timingProfileId: 'profile_assault_standard',
  balanceProfileId: 'assault_mvp_v1',
  totalBeats: 32,
  encounters: [
    {
      id: 'attack_01_answer',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_01',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_02_squat',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
    {
      id: 'attack_03_answer',
      kind: 'answer_pair',
      startBeat: 8,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_02',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_04_squat',
      kind: 'squat',
      startBeat: 12,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
    {
      id: 'attack_05_answer',
      kind: 'answer_pair',
      startBeat: 16,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_03',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_06_squat',
      kind: 'squat',
      startBeat: 20,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
    {
      id: 'attack_07_answer',
      kind: 'answer_pair',
      startBeat: 24,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId: 'pair_04',
      answerPolicyId: 'policy_dual_choice',
    },
    {
      id: 'attack_08_squat',
      kind: 'squat',
      startBeat: 28,
      durationBeats: 4,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
    },
  ],
});

/**
 * 등록된 접근 공격 패턴 레코드 (Pattern Registry)
 */
export const APPROACH_PATTERNS: Readonly<Record<string, Readonly<AssaultApproachPattern>>> = deepFreeze({
  pattern_approach_standard_mvp: DEFAULT_APPROACH_PATTERN,
  pattern_approach_extended_16: EXTENDED_16_APPROACH_PATTERN,
  pattern_approach_multi_pair_20: MULTI_PAIR_20_APPROACH_PATTERN,
  pattern_approach_multi_pair_3: MULTI_PAIR_20_APPROACH_PATTERN,
  pattern_approach_multi_pair_32: MULTI_PAIR_32_APPROACH_PATTERN,
  pattern_approach_multi_pair_4: MULTI_PAIR_32_APPROACH_PATTERN,
});
