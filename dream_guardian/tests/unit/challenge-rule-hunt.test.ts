/**
 * challenge-rule-hunt.test.ts - A 규칙 사냥 계열 쌍 생성기 단위 테스트
 *
 * @see Issue #653 [ASSAULT-CHALLENGE-CH-08]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 5, 11.2)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  generateRuleHuntRound,
  type RuleHuntGenerateParams,
  type RuleHuntRoundResult,
  type RuleHuntVariantId,
} from '../../src/question/challenge/RuleHuntGenerator.js';
import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../config/assault-challenge.config.js';

describe('[ASSAULT-CHALLENGE-CH-08 / #653] A 규칙 사냥 계열 쌍 생성기', () => {
  describe('0. 타입 계약 검증', () => {
    it('RuleHuntGenerateParams 및 RuleHuntRoundResult 타입 적합성', () => {
      const params: RuleHuntGenerateParams = {
        variantId: 'A1_times_table',
        pairCount: 2,
        seed: 123,
      };
      const result: RuleHuntRoundResult = generateRuleHuntRound(params);
      expectTypeOf(result).toMatchTypeOf<RuleHuntRoundResult>();
      expectTypeOf(params).toMatchTypeOf<RuleHuntGenerateParams>();
    });
  });

  // ─── 1. 입력 유효성 검증 ───
  describe('1. 입력 유효성 검증 (Validation)', () => {
    it('지원되지 않는 variantId인 경우 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'B1_addsub_duel' as unknown as RuleHuntVariantId,
          pairCount: 3,
          seed: 42,
        });
      }).toThrow(/unsupported variantId/i);
    });

    it('pairCount가 2 미만인 경우 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A1_times_table',
          pairCount: 1,
          seed: 42,
        });
      }).toThrow(/pairCount must be at least 2/i);
    });

    it('pairCount가 정수가 아닌 경우 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A1_times_table',
          pairCount: 2.5,
          seed: 42,
        });
      }).toThrow(/pairCount must be an integer/i);
    });

    it('seed가 정수가 아닌 경우 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A1_times_table',
          pairCount: 3,
          seed: 3.14,
        });
      }).toThrow(/seed must be an integer/i);
    });

    it('A1에서 유효하지 않은 k 파라미터 전달 시 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A1_times_table',
          pairCount: 3,
          seed: 42,
          params: { k: 1 }, // 2..9 범위 밖
        });
      }).toThrow(/invalid k parameter/i);
    });

    it('A2에서 유효하지 않은 parity 파라미터 전달 시 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A2_parity',
          pairCount: 3,
          seed: 42,
          params: { parity: 2 }, // 0 또는 1이어야 함
        });
      }).toThrow(/invalid parity parameter/i);
    });

    it('A3에서 lo >= hi 파라미터 전달 시 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A3_range',
          pairCount: 3,
          seed: 42,
          params: { lo: 50, hi: 40 },
        });
      }).toThrow(/invalid range/i);
    });

    it('A4에서 유효하지 않은 k 파라미터 전달 시 예외를 던진다', () => {
      expect(() => {
        generateRuleHuntRound({
          variantId: 'A4_multiple',
          pairCount: 3,
          seed: 42,
          params: { k: 2 }, // 3..9 범위 밖
        });
      }).toThrow(/invalid k parameter/i);
    });
  });

  // ─── 2. 결정론성 및 불변성 ───
  describe('2. 결정론성 및 불변성 (Determinism & Immutability)', () => {
    it('동일한 seed와 variantId로 호출 시 100% 동일한 결과를 반환한다', () => {
      const run1 = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 3,
        seed: 12345,
      });
      const run2 = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 3,
        seed: 12345,
      });

      expect(run1).toEqual(run2);
    });

    it('서로 다른 seed는 다른 결과를 생성한다', () => {
      const run1 = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 3,
        seed: 12345,
      });
      const run2 = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 3,
        seed: 67890,
      });

      expect(run1).not.toEqual(run2);
    });

    it('반환된 결과와 하위 객체는 deepFreeze로 동결되어 변경이 불가능하다', () => {
      const result = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 3,
        seed: 999,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.params)).toBe(true);
      expect(Object.isFrozen(result.pairs)).toBe(true);
      for (const pair of result.pairs) {
        expect(Object.isFrozen(pair)).toBe(true);
        expect(Object.isFrozen(pair.left)).toBe(true);
        expect(Object.isFrozen(pair.right)).toBe(true);
        expect(Object.isFrozen(pair.choices)).toBe(true);
      }

      expect(() => {
        (result as unknown as Record<string, unknown>).questionText = 'hacked';
      }).toThrow();
    });
  });

  // ─── 3. A1_times_table 구구단 ───
  describe('3. A1_times_table (k단 숫자를 쳐라!)', () => {
    it('k가 파라미터로 주어졌을 때 문제 문구와 정답/오답 술어를 만족한다', () => {
      const k = 6;
      const result = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 3,
        seed: 777,
        params: { k },
      });

      expect(result.variantId).toBe('A1_times_table');
      expect(result.family).toBe('rule_hunt');
      expect(result.questionText).toBe('6단 숫자를 쳐라!');
      expect(result.params.k).toBe(6);
      expect(result.pairs.length).toBe(3);

      const correctValues: number[] = [];

      for (let i = 0; i < result.pairs.length; i++) {
        const pair = result.pairs[i];
        expect(pair.pairId).toBe(`pair-${i + 1}`);

        // left/right 유효성
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        expect(correctChoice.isCorrect).toBe(true);
        expect(wrongChoice.isCorrect).toBe(false);

        // 술어 P 검증: 정답은 k의 배수이고 양의 정수
        expect(correctChoice.value % k).toBe(0);
        expect(correctChoice.value).toBeGreaterThan(0);

        // 술어 P 검증: 오답은 k의 배수가 아님
        expect(wrongChoice.value % k).not.toBe(0);
        expect(wrongChoice.value).toBeGreaterThan(0);

        // 라벨 길이 검증 (<= 6)
        expect(correctChoice.text.length).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars);
        expect(wrongChoice.text.length).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars);

        correctValues.push(correctChoice.value);
      }

      // 쌍 간 정답 중복 금지
      const uniqueCorrects = new Set(correctValues);
      expect(uniqueCorrects.size).toBe(result.pairs.length);
    });

    it('k가 주어지지 않으면 catalog 범위 [2, 9] 내에서 결정론적으로 샘플링된다', () => {
      const result = generateRuleHuntRound({
        variantId: 'A1_times_table',
        pairCount: 2,
        seed: 2026,
      });

      expect(result.params.k).toBeGreaterThanOrEqual(2);
      expect(result.params.k).toBeLessThanOrEqual(9);
      expect(result.questionText).toBe(`${result.params.k}단 숫자를 쳐라!`);
    });
  });

  // ─── 4. A2_parity 짝수/홀수 ───
  describe('4. A2_parity (짝수/홀수를 쳐라!)', () => {
    it('parity=0 (짝수)일 때 "짝수를 쳐라!" 및 술어를 만족한다', () => {
      const result = generateRuleHuntRound({
        variantId: 'A2_parity',
        pairCount: 4,
        seed: 101,
        params: { parity: 0 },
      });

      expect(result.questionText).toBe('짝수를 쳐라!');
      expect(result.params.parity).toBe(0);

      const correctValues: number[] = [];
      for (const pair of result.pairs) {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        expect(correctChoice.isCorrect).toBe(true);
        expect(wrongChoice.isCorrect).toBe(false);

        // 짝수 검증
        expect(correctChoice.value % 2).toBe(0);
        expect(correctChoice.value).toBeGreaterThan(0);

        // 오답은 홀수
        expect(wrongChoice.value % 2).not.toBe(0);
        expect(wrongChoice.value).toBeGreaterThan(0);

        correctValues.push(correctChoice.value);
      }

      // 쌍 간 정답 중복 금지
      expect(new Set(correctValues).size).toBe(4);
    });

    it('parity=1 (홀수)일 때 "홀수를 쳐라!" 및 술어를 만족한다', () => {
      const result = generateRuleHuntRound({
        variantId: 'A2_parity',
        pairCount: 3,
        seed: 202,
        params: { parity: 1 },
      });

      expect(result.questionText).toBe('홀수를 쳐라!');
      expect(result.params.parity).toBe(1);

      const correctValues: number[] = [];
      for (const pair of result.pairs) {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        // 홀수 검증
        expect(correctChoice.value % 2).not.toBe(0);
        expect(correctChoice.value).toBeGreaterThan(0);

        // 오답은 짝수
        expect(wrongChoice.value % 2).toBe(0);
        expect(wrongChoice.value).toBeGreaterThan(0);

        correctValues.push(correctChoice.value);
      }

      expect(new Set(correctValues).size).toBe(3);
    });
  });

  // ─── 5. A3_range 범위 ───
  describe('5. A3_range ({lo}와 {hi} 사이를 쳐라!)', () => {
    it('주어진 lo, hi 범위에 대해 정답은 엄격히 사이(lo < x < hi), 오답은 범위 밖을 만족한다', () => {
      const lo = 30;
      const hi = 40;
      const result = generateRuleHuntRound({
        variantId: 'A3_range',
        pairCount: 3,
        seed: 303,
        params: { lo, hi },
      });

      expect(result.questionText).toBe('30와 40 사이를 쳐라!');
      expect(result.params.lo).toBe(30);
      expect(result.params.hi).toBe(40);

      const correctValues: number[] = [];
      for (const pair of result.pairs) {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        // 정답은 엄격히 lo < x < hi
        expect(correctChoice.value).toBeGreaterThan(lo);
        expect(correctChoice.value).toBeLessThan(hi);

        // 오답은 lo 이하이거나 hi 이상
        const isOutOfRange = wrongChoice.value <= lo || wrongChoice.value >= hi;
        expect(isOutOfRange).toBe(true);

        correctValues.push(correctChoice.value);
      }

      // 쌍 간 정답 중복 금지
      expect(new Set(correctValues).size).toBe(3);
    });

    it('lo, hi가 제공되지 않았을 때 catalog rangeLo, rangeSpan 범위로 자동 생성된다', () => {
      const result = generateRuleHuntRound({
        variantId: 'A3_range',
        pairCount: 2,
        seed: 404,
      });

      expect(result.params.lo).toBeGreaterThanOrEqual(10);
      expect(result.params.lo).toBeLessThanOrEqual(80);
      expect(result.params.hi).toBeGreaterThan(result.params.lo);
      expect(result.questionText).toBe(`${result.params.lo}와 ${result.params.hi} 사이를 쳐라!`);
    });
  });

  // ─── 6. A4_multiple 배수 ───
  describe('6. A4_multiple ({k}의 배수를 쳐라!)', () => {
    it('k의 배수 정답과 비배수 오답을 올바르게 생성한다', () => {
      const k = 7;
      const result = generateRuleHuntRound({
        variantId: 'A4_multiple',
        pairCount: 4,
        seed: 505,
        params: { k },
      });

      expect(result.questionText).toBe('7의 배수를 쳐라!');
      expect(result.params.k).toBe(7);

      const correctValues: number[] = [];
      for (const pair of result.pairs) {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        // 정답은 k의 배수
        expect(correctChoice.value % k).toBe(0);
        expect(correctChoice.value).toBeGreaterThan(0);

        // 오답은 k의 배수가 아님
        expect(wrongChoice.value % k).not.toBe(0);
        expect(wrongChoice.value).toBeGreaterThan(0);

        correctValues.push(correctChoice.value);
      }

      // 쌍 간 정답 중복 금지
      expect(new Set(correctValues).size).toBe(4);
    });
  });

  // ─── 7. 연속 같은 방향(maxConsecutiveSameSide) 제약 ───
  describe('7. 연속 같은 방향 제약 (maxConsecutiveSameSide)', () => {
    it('많은 쌍(8쌍)을 생성할 때 연속 같은 방향이 config 상한(3)을 초과하지 않는다', () => {
      // 여러 시드로 검증
      for (const seed of [1001, 2002, 3003, 4004, 5005]) {
        const result = generateRuleHuntRound({
          variantId: 'A1_times_table',
          pairCount: 8,
          seed,
        });

        let consecutiveCount = 1;
        let lastSide = result.pairs[0].correctSide;

        for (let i = 1; i < result.pairs.length; i++) {
          const side = result.pairs[i].correctSide;
          if (side === lastSide) {
            consecutiveCount++;
            expect(consecutiveCount).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide);
          } else {
            consecutiveCount = 1;
            lastSide = side;
          }
        }
      }
    });
  });
});
