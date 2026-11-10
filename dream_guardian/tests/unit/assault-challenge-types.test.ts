/**
 * [ASSAULT-CHALLENGE-CH-03] #648 — 챌린지 출제 타입 계약 (DOC-18 §5)
 *
 * expectTypeOf 단언은 tsc(`npm run build`, tsconfig include: tests)로 타입 검증된다.
 * 런타임 관찰용으로 모듈이 런타임 export를 갖지 않는지(type-only) 확인한다.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  AssaultChallengeFamily,
  AssaultRoundSourceKind,
  AssaultChallengeVariantId,
  AssaultChallengeVariantDef,
  AssaultChallengeRound,
} from '../../src/types/assaultChallenge';
import type { AssaultAnswerPair } from '../../src/question/AssaultAnswerPairFactory';

describe('#648 assaultChallenge 타입 계약', () => {
  it('모듈은 타입 전용이며 런타임 export가 없다', async () => {
    const mod = await import('../../src/types/assaultChallenge');
    expect(Object.keys(mod)).toHaveLength(0);
  });

  it('AssaultChallengeFamily는 A·B·C·D 4계열이다 (E 제외)', () => {
    expectTypeOf<AssaultChallengeFamily>().toEqualTypeOf<
      'rule_hunt' | 'duel' | 'equivalence' | 'progression'
    >();
  });

  it('AssaultRoundSourceKind는 numeric_repeat | challenge 이다', () => {
    expectTypeOf<AssaultRoundSourceKind>().toEqualTypeOf<'numeric_repeat' | 'challenge'>();
  });

  it('AssaultChallengeVariantId는 DOC-18 §4.1 14유형 유니온이다', () => {
    expectTypeOf<AssaultChallengeVariantId>().toEqualTypeOf<
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
      | 'D3_doubling'
    >();
    expectTypeOf<AssaultChallengeVariantId>().toMatchTypeOf<string>();
  });

  it('AssaultChallengeVariantDef 필드 계약 (§5)', () => {
    expectTypeOf<AssaultChallengeVariantDef>().toEqualTypeOf<{
      readonly variantId: string;
      readonly family: AssaultChallengeFamily;
      readonly chapters: readonly number[];
      readonly promptTemplate: string;
      readonly params: Readonly<Record<string, readonly [number, number]>>;
      readonly minPairs: number;
    }>();
  });

  it('AssaultChallengeRound 필드 계약 (§5) 및 AssaultAnswerPair 재사용', () => {
    expectTypeOf<AssaultChallengeRound>().toEqualTypeOf<{
      readonly variantId: string;
      readonly family: AssaultChallengeFamily;
      readonly questionText: string;
      readonly pairPrompts: readonly (string | null)[];
      readonly pairs: readonly AssaultAnswerPair[];
      readonly extraReadSeconds: number;
      readonly seed: number;
      readonly rulesVersion: string;
    }>();
    expectTypeOf<AssaultChallengeRound['pairs'][number]>().toEqualTypeOf<AssaultAnswerPair>();
  });
});
