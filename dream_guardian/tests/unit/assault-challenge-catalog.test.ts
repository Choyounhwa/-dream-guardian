/**
 * assault-challenge-catalog.test.ts - 보스 접근전 챌린지 14유형 카탈로그 정적 데이터 단위 테스트
 *
 * @see Issue #650 [ASSAULT-CHALLENGE-CH-05]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.3, 5, 11.2)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  ASSAULT_CHALLENGE_CATALOG,
  ASSAULT_CHALLENGE_VARIANTS,
} from '../../src/data/assault/challengeCatalog.js';
import type {
  AssaultChallengeFamily,
  AssaultChallengeVariantId,
  AssaultChallengeVariantDef,
} from '../../src/types/assaultChallenge.js';

describe('[ASSAULT-CHALLENGE-CH-05 / #650] 챌린지 14유형 카탈로그 정적 데이터', () => {
  const EXPECTED_VARIANT_IDS: readonly AssaultChallengeVariantId[] = [
    'A1_times_table',
    'A2_parity',
    'A3_range',
    'A4_multiple',
    'B1_addsub_duel',
    'B2_mul_duel',
    'B3_fraction_duel',
    'B4_decimal_duel',
    'C1_make_target',
    'C2_equivalent',
    'C3_make_ten',
    'D1_skip_count',
    'D2_countdown',
    'D3_doubling',
  ];

  describe('1. 기본 객체 및 불변성 (deepFreeze)', () => {
    it('타입 계약: ASSAULT_CHALLENGE_CATALOG 및 ASSAULT_CHALLENGE_VARIANTS 타입 일치', () => {
      expectTypeOf(ASSAULT_CHALLENGE_CATALOG).toMatchTypeOf<
        Readonly<Record<AssaultChallengeVariantId, AssaultChallengeVariantDef>>
      >();
      expectTypeOf(ASSAULT_CHALLENGE_VARIANTS).toMatchTypeOf<
        readonly AssaultChallengeVariantDef[]
      >();
    });

    it('카탈로그 및 배열이 정의되어 있고 Object.isFrozen 상태이다', () => {
      expect(ASSAULT_CHALLENGE_CATALOG).toBeDefined();
      expect(ASSAULT_CHALLENGE_VARIANTS).toBeDefined();
      expect(Object.isFrozen(ASSAULT_CHALLENGE_CATALOG)).toBe(true);
      expect(Object.isFrozen(ASSAULT_CHALLENGE_VARIANTS)).toBe(true);
    });

    it('모든 variantDef 및 하위 객체(chapters, params, tuple)가 완전 동결(deepFreeze)되어 있다', () => {
      for (const def of ASSAULT_CHALLENGE_VARIANTS) {
        expect(Object.isFrozen(def)).toBe(true);
        expect(Object.isFrozen(def.chapters)).toBe(true);
        expect(Object.isFrozen(def.params)).toBe(true);
        for (const [paramKey, rangeTuple] of Object.entries(def.params)) {
          expect(
            Object.isFrozen(rangeTuple),
            `Variant ${def.variantId} param ${paramKey} must be frozen`,
          ).toBe(true);
        }
      }
    });

    it('런타임 변조 시도시 에러가 발생하거나 변경되지 않는다', () => {
      expect(() => {
        // @ts-expect-error mutating frozen object
        ASSAULT_CHALLENGE_CATALOG.A1_times_table = null;
      }).toThrow();

      expect(() => {
        // @ts-expect-error mutating frozen array
        ASSAULT_CHALLENGE_VARIANTS.push({} as AssaultChallengeVariantDef);
      }).toThrow();
    });
  });

  describe('2. 14개 유형 식별자 및 유일성', () => {
    it('정확히 14개의 variantId가 존재하며 중복이 없다', () => {
      const keys = Object.keys(ASSAULT_CHALLENGE_CATALOG);
      expect(keys).toHaveLength(14);
      expect(ASSAULT_CHALLENGE_VARIANTS).toHaveLength(14);

      const uniqueVariantIds = new Set(ASSAULT_CHALLENGE_VARIANTS.map((v) => v.variantId));
      expect(uniqueVariantIds.size).toBe(14);
    });

    it('14개 식별자가 DOC-18 §4.1 전체 목록과 일치한다', () => {
      const actualIds = ASSAULT_CHALLENGE_VARIANTS.map((v) => v.variantId);
      for (const expectedId of EXPECTED_VARIANT_IDS) {
        expect(actualIds).toContain(expectedId);
        expect(ASSAULT_CHALLENGE_CATALOG[expectedId]).toBeDefined();
        expect(ASSAULT_CHALLENGE_CATALOG[expectedId].variantId).toBe(expectedId);
      }
    });
  });

  describe('3. 계열(Family) 및 minPairs 규칙', () => {
    it('각 유형의 계열이 DOC-18 §4.1 표와 일치한다', () => {
      const familyCounts: Record<AssaultChallengeFamily, number> = {
        rule_hunt: 0,
        duel: 0,
        equivalence: 0,
        progression: 0,
      };

      for (const def of ASSAULT_CHALLENGE_VARIANTS) {
        familyCounts[def.family]++;
      }

      // A 계열 4종
      expect(familyCounts.rule_hunt).toBe(4);
      // B 계열 4종
      expect(familyCounts.duel).toBe(4);
      // C 계열 3종
      expect(familyCounts.equivalence).toBe(3);
      // D 계열 3종
      expect(familyCounts.progression).toBe(3);
    });

    it('D 계열(progression)은 minPairs 3, 나머지(A, B, C)는 minPairs 2이다', () => {
      for (const def of ASSAULT_CHALLENGE_VARIANTS) {
        if (def.family === 'progression') {
          expect(def.minPairs, `Variant ${def.variantId} (D 계열) minPairs`).toBe(3);
        } else {
          expect(def.minPairs, `Variant ${def.variantId} (${def.family}) minPairs`).toBe(2);
        }
      }
    });
  });

  describe('4. 개별 유형 상세 정의 검증 (DOC-18 §4.1)', () => {
    it('A1_times_table: family rule_hunt, chapters [2], {k}단 숫자를 쳐라!, k: [2, 9]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.A1_times_table;
      expect(def.family).toBe('rule_hunt');
      expect(def.chapters).toEqual([2]);
      expect(def.promptTemplate).toBe('{k}단 숫자를 쳐라!');
      expect(def.params.k).toEqual([2, 9]);
      expect(def.minPairs).toBe(2);
    });

    it('A2_parity: family rule_hunt, chapters [1], {parity}를 쳐라!, parity: [0, 1]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.A2_parity;
      expect(def.family).toBe('rule_hunt');
      expect(def.chapters).toEqual([1]);
      expect(def.promptTemplate).toBe('{parity}를 쳐라!');
      expect(def.params.parity).toEqual([0, 1]);
      expect(def.minPairs).toBe(2);
    });

    it('A3_range: family rule_hunt, chapters [1], {lo}와 {hi} 사이를 쳐라!, rangeLo: [10, 80], rangeSpan: [10, 20]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.A3_range;
      expect(def.family).toBe('rule_hunt');
      expect(def.chapters).toEqual([1]);
      expect(def.promptTemplate).toBe('{lo}와 {hi} 사이를 쳐라!');
      expect(def.params.rangeLo).toEqual([10, 80]);
      expect(def.params.rangeSpan).toEqual([10, 20]);
      expect(def.minPairs).toBe(2);
    });

    it('A4_multiple: family rule_hunt, chapters [2, 5], {k}의 배수를 쳐라!, k: [3, 9]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.A4_multiple;
      expect(def.family).toBe('rule_hunt');
      expect(def.chapters).toEqual([2, 5]);
      expect(def.promptTemplate).toBe('{k}의 배수를 쳐라!');
      expect(def.params.k).toEqual([3, 9]);
      expect(def.minPairs).toBe(2);
    });

    it('B1_addsub_duel: family duel, chapters [1], 더 큰 쪽을 쳐라!, maxVal: [10, 50]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.B1_addsub_duel;
      expect(def.family).toBe('duel');
      expect(def.chapters).toEqual([1]);
      expect(def.promptTemplate).toBe('더 큰 쪽을 쳐라!');
      expect(def.params.maxVal).toEqual([10, 50]);
      expect(def.minPairs).toBe(2);
    });

    it('B2_mul_duel: family duel, chapters [2], 더 큰 쪽을 쳐라!, maxFactor: [3, 9]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.B2_mul_duel;
      expect(def.family).toBe('duel');
      expect(def.chapters).toEqual([2]);
      expect(def.promptTemplate).toBe('더 큰 쪽을 쳐라!');
      expect(def.params.maxFactor).toEqual([3, 9]);
      expect(def.minPairs).toBe(2);
    });

    it('B3_fraction_duel: family duel, chapters [3], 더 큰 쪽을 쳐라!, maxDenom: [2, 10]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.B3_fraction_duel;
      expect(def.family).toBe('duel');
      expect(def.chapters).toEqual([3]);
      expect(def.promptTemplate).toBe('더 큰 쪽을 쳐라!');
      expect(def.params.maxDenom).toEqual([2, 10]);
      expect(def.minPairs).toBe(2);
    });

    it('B4_decimal_duel: family duel, chapters [4], 더 큰 쪽을 쳐라!, precision: [1, 2]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.B4_decimal_duel;
      expect(def.family).toBe('duel');
      expect(def.chapters).toEqual([4]);
      expect(def.promptTemplate).toBe('더 큰 쪽을 쳐라!');
      expect(def.params.precision).toEqual([1, 2]);
      expect(def.minPairs).toBe(2);
    });

    it('C1_make_target: family equivalence, chapters [1, 2], {target}을 만들어라!, target: [10, 50]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.C1_make_target;
      expect(def.family).toBe('equivalence');
      expect(def.chapters).toEqual([1, 2]);
      expect(def.promptTemplate).toBe('{target}을 만들어라!');
      expect(def.params.target).toEqual([10, 50]);
      expect(def.minPairs).toBe(2);
    });

    it('C2_equivalent: family equivalence, chapters [3, 4], {target}과 같은 것!, targetKind: [1, 3]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.C2_equivalent;
      expect(def.family).toBe('equivalence');
      expect(def.chapters).toEqual([3, 4]);
      expect(def.promptTemplate).toBe('{target}과 같은 것!');
      expect(def.params.targetKind).toEqual([1, 3]);
      expect(def.minPairs).toBe(2);
    });

    it('C3_make_ten: family equivalence, chapters [1], 합이 10!, target: [10, 10]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.C3_make_ten;
      expect(def.family).toBe('equivalence');
      expect(def.chapters).toEqual([1]);
      expect(def.promptTemplate).toBe('합이 10!');
      expect(def.params.target).toEqual([10, 10]);
      expect(def.minPairs).toBe(2);
    });

    it('D1_skip_count: family progression, chapters [1, 2], {start}부터 {step}씩 뛰어라!, start: [1, 20], step: [2, 7]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.D1_skip_count;
      expect(def.family).toBe('progression');
      expect(def.chapters).toEqual([1, 2]);
      expect(def.promptTemplate).toBe('{start}부터 {step}씩 뛰어라!');
      expect(def.params.start).toEqual([1, 20]);
      expect(def.params.step).toEqual([2, 7]);
      expect(def.minPairs).toBe(3);
    });

    it('D2_countdown: family progression, chapters [1, 5], {start}에서 {step}씩 빼라!, start: [30, 99], step: [3, 9]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.D2_countdown;
      expect(def.family).toBe('progression');
      expect(def.chapters).toEqual([1, 5]);
      expect(def.promptTemplate).toBe('{start}에서 {step}씩 빼라!');
      expect(def.params.start).toEqual([30, 99]);
      expect(def.params.step).toEqual([3, 9]);
      expect(def.minPairs).toBe(3);
    });

    it('D3_doubling: family progression, chapters [2, 5], {start}에서 두 배씩!, start: [1, 5]', () => {
      const def = ASSAULT_CHALLENGE_CATALOG.D3_doubling;
      expect(def.family).toBe('progression');
      expect(def.chapters).toEqual([2, 5]);
      expect(def.promptTemplate).toBe('{start}에서 두 배씩!');
      expect(def.params.start).toEqual([1, 5]);
      expect(def.minPairs).toBe(3);
    });
  });

  describe('5. 챕터 매핑 검증', () => {
    it('모든 챕터 1~5가 유효한 범위 내에 있으며 최소 2개 이상(Ch.1·2·5는 3개 이상) 유형이 매핑된다', () => {
      const variantsByChapter: Record<number, AssaultChallengeVariantId[]> = {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
      };

      for (const def of ASSAULT_CHALLENGE_VARIANTS) {
        expect(def.chapters.length).toBeGreaterThan(0);
        for (const ch of def.chapters) {
          expect(ch).toBeGreaterThanOrEqual(1);
          expect(ch).toBeLessThanOrEqual(5);
          variantsByChapter[ch].push(def.variantId as AssaultChallengeVariantId);
        }
      }

      // Ch.1: A2, A3, B1, C1, C3, D1, D2 (7종)
      expect(variantsByChapter[1]).toHaveLength(7);
      expect(variantsByChapter[1]).toEqual(
        expect.arrayContaining(['A2_parity', 'A3_range', 'B1_addsub_duel', 'C1_make_target', 'C3_make_ten', 'D1_skip_count', 'D2_countdown']),
      );

      // Ch.2: A1, A4, B2, C1, D1, D3 (6종)
      expect(variantsByChapter[2]).toHaveLength(6);
      expect(variantsByChapter[2]).toEqual(
        expect.arrayContaining(['A1_times_table', 'A4_multiple', 'B2_mul_duel', 'C1_make_target', 'D1_skip_count', 'D3_doubling']),
      );

      // Ch.3: B3, C2 (2종, 분수 도메인 전용)
      expect(variantsByChapter[3]).toHaveLength(2);
      expect(variantsByChapter[3]).toEqual(
        expect.arrayContaining(['B3_fraction_duel', 'C2_equivalent']),
      );

      // Ch.4: B4, C2 (2종, 소수 도메인 전용)
      expect(variantsByChapter[4]).toHaveLength(2);
      expect(variantsByChapter[4]).toEqual(
        expect.arrayContaining(['B4_decimal_duel', 'C2_equivalent']),
      );

      // Ch.5: A4, D2, D3 (3종)
      expect(variantsByChapter[5]).toHaveLength(3);
      expect(variantsByChapter[5]).toEqual(
        expect.arrayContaining(['A4_multiple', 'D2_countdown', 'D3_doubling']),
      );
    });
  });

  describe('6. 순수 정적 데이터 무결성 (함수/상태 배제)', () => {
    it('카탈로그 및 항목에 함수, 콜백, 심볼, undefined 필드가 존재하지 않는다', () => {
      for (const def of ASSAULT_CHALLENGE_VARIANTS) {
        for (const [key, value] of Object.entries(def)) {
          expect(typeof value, `Variant ${def.variantId} property ${key}`).not.toBe('function');
          expect(typeof value, `Variant ${def.variantId} property ${key}`).not.toBe('symbol');
          expect(value, `Variant ${def.variantId} property ${key}`).not.toBeUndefined();
        }
      }
    });

    it('모든 파라미터 튜플은 [min, max] 형태로 min <= max 조건을 만족한다', () => {
      for (const def of ASSAULT_CHALLENGE_VARIANTS) {
        for (const [paramName, range] of Object.entries(def.params)) {
          expect(Array.isArray(range), `${def.variantId}.${paramName} must be array`).toBe(true);
          expect(range, `${def.variantId}.${paramName} length`).toHaveLength(2);
          const [min, max] = range;
          expect(typeof min, `${def.variantId}.${paramName}[0] must be number`).toBe('number');
          expect(typeof max, `${def.variantId}.${paramName}[1] must be number`).toBe('number');
          expect(min, `${def.variantId}.${paramName} min <= max`).toBeLessThanOrEqual(max);
        }
      }
    });
  });
});
