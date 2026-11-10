/**
 * assaultChallenge - 보스 접근전 챌린지 출제 타입 계약 (타입 전용, 런타임 코드 없음)
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (DOC-18 §4~§5)
 * @see Issue #648 [ASSAULT-CHALLENGE-CH-03]
 *
 * - 채택 계열: A(규칙 사냥)·B(대결)·C(같은 값)·D(진행). E(참인 식 판정) 제외.
 * - 보기 쌍은 기존 Question 레이어 `AssaultAnswerPair`를 재사용한다(재정의 금지).
 */

import type { AssaultAnswerPair } from '../question/AssaultAnswerPairFactory.js';

/** 챌린지 계열 (A: rule_hunt, B: duel, C: equivalence, D: progression) */
export type AssaultChallengeFamily = 'rule_hunt' | 'duel' | 'equivalence' | 'progression';

/** 라운드 보기 공급 방식 (기본: numeric_repeat) */
export type AssaultRoundSourceKind = 'numeric_repeat' | 'challenge';

/** DOC-18 §4.1 유형 카탈로그 14유형 식별자 */
export type AssaultChallengeVariantId =
  | 'A1_times_table'
  | 'A2_parity'
  | 'A3_range'
  | 'A4_multiple'
  | 'B1_addsub_duel'
  | 'B2_mul_duel'
  | 'B3_fraction_duel'
  | 'B4_decimal_duel'
  | 'C1_make_target'
  | 'C2_equivalent'
  | 'C3_make_ten'
  | 'D1_skip_count'
  | 'D2_countdown'
  | 'D3_doubling';

/** 유형 정의 (data, 불변) */
export interface AssaultChallengeVariantDef {
  readonly variantId: string;
  readonly family: AssaultChallengeFamily;
  readonly chapters: readonly number[];
  /** 예: '{k}단 숫자를 쳐라!' */
  readonly promptTemplate: string;
  /** 규칙 파라미터 범위 [min, max] */
  readonly params: Readonly<Record<string, readonly [number, number]>>;
  readonly minPairs: number;
}

/** 라운드 생성 결과 (동결) */
export interface AssaultChallengeRound {
  readonly variantId: string;
  readonly family: AssaultChallengeFamily;
  readonly questionText: string;
  /** 쌍별 보조 문구 (D 계열 등, 없으면 null) */
  readonly pairPrompts: readonly (string | null)[];
  /** 기존 Question 레이어 타입 재사용 */
  readonly pairs: readonly AssaultAnswerPair[];
  readonly extraReadSeconds: number;
  readonly seed: number;
  readonly rulesVersion: string;
}
