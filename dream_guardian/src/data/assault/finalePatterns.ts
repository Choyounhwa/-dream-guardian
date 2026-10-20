/**
 * finalePatterns.ts - 근접 결전(Boss Assault Finale) 선언형 패턴 콘텐츠
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §10.2, §6.5)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-27 / Issue #529)
 *
 * 절대 규칙:
 * 1. Content 데이터 레이어 단일 책임: 순수 정적 결전 조우 순서 및 박자 배치만 선언한다.
 * 2. 런타임 분기, 실행 함수, 콜백, 타이머, 정답/HP 계산 일체 배제.
 * 3. Question 레이어의 정답/수식/텍스트를 복제하지 않는다.
 * 4. 피해량(damage)/HP 수치를 내장하지 않으며 assault_finale_v1 프로필 참조로 위임한다.
 * 5. deepFreeze를 통한 불변성(Immutability) 보장.
 */

import type {
  AssaultEncounterDef,
  ProfileId,
} from '../../types/assault.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/**
 * 근접 결전 패턴 인터페이스 (Assault Approach Pattern 호환)
 */
export interface AssaultFinalePattern {
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
 * 근접 결전 표준 패턴 (Default Finale Pattern)
 *
 * DOC-14 §10.2 결전 시퀀스:
 * 약점 펀치 -> 가로 공격 스쿼트 -> 약점 펀치 -> 바닥 충격파 점프 -> 큰 빈틈 연타
 *
 * 박자 구조 (총 32박, 0-based):
 * 1) 0~4박 (4박): 약점 펀치 (answer_pair)
 * 2) 4~10박 (6박): 가로 공격 스쿼트 회피 (squat)
 * 3) 10~14박 (4박): 약점 펀치 (answer_pair)
 * 4) 14~20박 (6박): 바닥 충격파 점프 (jump)
 * 5) 20~28박 (8박): 큰 빈틈 연타 (answer_pair)
 * (28~32박: 4박 복귀 및 마무리 버퍼)
 */
export const DEFAULT_FINALE_PATTERN: Readonly<AssaultFinalePattern> = deepFreeze({
  schemaVersion: '1.0.0',
  patternId: 'pattern_finale_standard',
  name: '근접 결전 표준 패턴',
  description: '약점 펀치 -> 스쿼트 회피 -> 약점 펀치 -> 충격파 점프 -> 빈틈 연타로 이어지는 결전 사이클',
  timingProfileId: 'assault_finale_v1',
  balanceProfileId: 'assault_finale_v1',
  totalBeats: 32,
  encounters: [
    {
      id: 'enc_finale_punch_1',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'assault_finale_v1',
      visualProfileId: 'visual_finale_punch',
      pairId: 'pair_finale_weakness_1',
      answerPolicyId: 'answer_policy_standard',
    },
    {
      id: 'enc_finale_squat_1',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 6,
      interactionProfileId: 'assault_finale_v1',
      visualProfileId: 'visual_finale_horizontal_swipe',
    },
    {
      id: 'enc_finale_punch_2',
      kind: 'answer_pair',
      startBeat: 10,
      durationBeats: 4,
      interactionProfileId: 'assault_finale_v1',
      visualProfileId: 'visual_finale_punch',
      pairId: 'pair_finale_weakness_2',
      answerPolicyId: 'answer_policy_standard',
    },
    {
      id: 'enc_finale_jump_1',
      kind: 'jump',
      startBeat: 14,
      durationBeats: 6,
      interactionProfileId: 'assault_finale_v1',
      visualProfileId: 'visual_finale_shockwave',
    },
    {
      id: 'enc_finale_rush_1',
      kind: 'answer_pair',
      startBeat: 20,
      durationBeats: 8,
      interactionProfileId: 'assault_finale_v1',
      visualProfileId: 'visual_finale_vulnerable_rush',
      pairId: 'pair_finale_rush_1',
      answerPolicyId: 'answer_policy_rapid',
    },
  ],
});

/**
 * 결전 패턴 레코드 맵
 */
export const FINALE_PATTERNS: Readonly<Record<string, Readonly<AssaultFinalePattern>>> = deepFreeze({
  pattern_finale_standard: DEFAULT_FINALE_PATTERN,
});
