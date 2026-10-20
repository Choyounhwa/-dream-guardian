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
 * 박자 구조 (총 8박):
 * - 0~4박 (4박): answer_pair (답안 선택 펀치/터치)
 * - 4~8박 (4박): squat (보스 돌진/공격 스쿼트 회피)
 *
 * 0-based startBeat 적용 및 프로필 참조 기반 선언.
 */
export const DEFAULT_APPROACH_PATTERN: Readonly<AssaultApproachPattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_approach_standard_mvp',
  name: 'MVP 표준 교대 접근전 패턴',
  description: '답안 선택(4박)과 스쿼트 회피(4박)가 번갈아 진행되는 8박 기본 사이클',
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
 * 등록된 접근 공격 패턴 레코드 (Pattern Registry)
 */
export const APPROACH_PATTERNS: Readonly<Record<string, Readonly<AssaultApproachPattern>>> = deepFreeze({
  pattern_approach_standard_mvp: DEFAULT_APPROACH_PATTERN,
});
