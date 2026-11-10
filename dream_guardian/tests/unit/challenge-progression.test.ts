/**
 * challenge-progression.test.ts - D 진행 계열 쌍 생성기 단위 테스트
 *
 * @see Issue #656 [ASSAULT-CHALLENGE-CH-11]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 4.4, 5, 8, 11.2)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  generateProgressionRound,
  type ProgressionGenerateParams,
  type ProgressionRoundResult,
  type ProgressionVariantId,
} from '../../src/question/challenge/ProgressionGenerator.js';
import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../config/assault-challenge.config.js';

describe('[ASSAULT-CHALLENGE-CH-11 / #656] D 진행 계열 쌍 생성기', () => {
  describe('0. 타입 계약 검증', () => {
    it('ProgressionGenerateParams 및 ProgressionRoundResult 타입 적합성', () => {
      const params: ProgressionGenerateParams = {
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 12345,
      };
      const result: ProgressionRoundResult = generateProgressionRound(params);
      expectTypeOf(result).toMatchTypeOf<ProgressionRoundResult>();
      expectTypeOf(params).toMatchTypeOf<ProgressionGenerateParams>();
      expect(result.family).toBe('progression');
      expect(Array.isArray(result.pairPrompts)).toBe(true);
      expect(result.pairPrompts.length).toBe(3);
      expect(result.pairs.length).toBe(3);
    });
  });

  describe('1. 입력 유효성 검증 (Validation)', () => {
    it('지원되지 않는 variantId인 경우 예외를 던진다', () => {
      expect(() => {
        generateProgressionRound({
          variantId: 'D4_fibonacci' as unknown as ProgressionVariantId,
          pairCount: 3,
          seed: 42,
        });
      }).toThrow(/unsupported variantId/i);
    });

    it('pairCount가 3 미만인 경우 예외를 던진다 (minPairs = 3)', () => {
      expect(() => {
        generateProgressionRound({
          variantId: 'D1_skip_count',
          pairCount: 2,
          seed: 42,
        });
      }).toThrow(/pairCount/i);

      expect(() => {
        generateProgressionRound({
          variantId: 'D2_countdown',
          pairCount: 0,
          seed: 42,
        });
      }).toThrow(/pairCount/i);
    });

    it('pairCount가 정수가 아니면 예외를 던진다', () => {
      expect(() => {
        generateProgressionRound({
          variantId: 'D1_skip_count',
          pairCount: 3.5,
          seed: 42,
        });
      }).toThrow(/pairCount/i);
    });

    it('seed가 유효한 정수가 아니면 예외를 던진다', () => {
      expect(() => {
        generateProgressionRound({
          variantId: 'D1_skip_count',
          pairCount: 3,
          seed: NaN,
        });
      }).toThrow(/seed/i);
    });

    it('D2_countdown에서 start - step * pairCount < 0이 되는 customParams 입력 시 예외를 던진다', () => {
      expect(() => {
        generateProgressionRound({
          variantId: 'D2_countdown',
          pairCount: 5,
          seed: 42,
          params: { start: 10, step: 3 }, // 10 - 3*5 = -5 (< 0)
        });
      }).toThrow(/non-negative/i);
    });

    it('라벨 길이가 maxLabelChars를 초과하게 되는 파라미터 입력 시 예외를 던진다', () => {
      expect(() => {
        generateProgressionRound({
          variantId: 'D3_doubling',
          pairCount: 25, // 1 * 2^25 = 33,554,432 (8 chars > 6)
          seed: 42,
          params: { start: 1 },
        });
      }).toThrow(/maxLabelChars/i);
    });
  });

  describe('2. D1_skip_count (뛰어 세기) 생성 검증', () => {
    it('지정된 start, step에 따라 정답 수열과 pairPrompts를 정확히 생성한다', () => {
      const result = generateProgressionRound({
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 777,
        params: { start: 3, step: 4 },
      });

      expect(result.questionText).toBe('3부터 4씩 뛰어라!');
      expect(result.params).toEqual({ start: 3, step: 4 });

      // 정답 수열: 3 + 4 = 7, 7 + 4 = 11, 11 + 4 = 15
      expect(result.pairPrompts[0]).toBe('3 → ?');
      expect(result.pairPrompts[1]).toBe('3 → 7 → ?');
      expect(result.pairPrompts[2]).toBe('3 → 7 → 11 → ?');

      const expectedAnswers = [7, 11, 15];
      result.pairs.forEach((pair, idx) => {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        expect(correctChoice.value).toBe(expectedAnswers[idx]);
        expect(correctChoice.text).toBe(String(expectedAnswers[idx]));
        expect(correctChoice.isCorrect).toBe(true);

        expect(wrongChoice.value).not.toBe(expectedAnswers[idx]);
        expect(wrongChoice.value).toBeGreaterThanOrEqual(0);
        expect(wrongChoice.isCorrect).toBe(false);
        expect(wrongChoice.text.length).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars);
      });
    });

    it('자동 파라미터 샘플링 시 카탈로그 범위 내에서 정상 생성된다', () => {
      const result = generateProgressionRound({
        variantId: 'D1_skip_count',
        pairCount: 4,
        seed: 1001,
      });

      expect(result.params.start).toBeGreaterThanOrEqual(1);
      expect(result.params.start).toBeLessThanOrEqual(20);
      expect(result.params.step).toBeGreaterThanOrEqual(2);
      expect(result.params.step).toBeLessThanOrEqual(7);

      expect(result.questionText).toBe(`${result.params.start}부터 ${result.params.step}씩 뛰어라!`);
      expect(result.pairs.length).toBe(4);
      expect(result.pairPrompts.length).toBe(4);
    });
  });

  describe('3. D2_countdown (카운트다운) 생성 검증', () => {
    it('모든 정답 및 오답이 0 이상(>= 0)임을 보장한다', () => {
      const result = generateProgressionRound({
        variantId: 'D2_countdown',
        pairCount: 3,
        seed: 888,
        params: { start: 50, step: 7 },
      });

      expect(result.questionText).toBe('50에서 7씩 빼라!');
      expect(result.params).toEqual({ start: 50, step: 7 });

      // 정답 수열: 50 - 7 = 43, 43 - 7 = 36, 36 - 7 = 29
      expect(result.pairPrompts[0]).toBe('50 → ?');
      expect(result.pairPrompts[1]).toBe('50 → 43 → ?');
      expect(result.pairPrompts[2]).toBe('50 → 43 → 36 → ?');

      const expectedAnswers = [43, 36, 29];
      result.pairs.forEach((pair, idx) => {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        expect(correctChoice.value).toBe(expectedAnswers[idx]);
        expect(correctChoice.isCorrect).toBe(true);
        expect(correctChoice.value).toBeGreaterThanOrEqual(0);

        expect(wrongChoice.value).not.toBe(expectedAnswers[idx]);
        expect(wrongChoice.value).toBeGreaterThanOrEqual(0);
        expect(wrongChoice.isCorrect).toBe(false);
      });
    });

    it('자동 샘플링 시에도 100회 시드 테스트에서 모든 값이 0 이상이어야 한다', () => {
      for (let s = 1; s <= 100; s++) {
        const result = generateProgressionRound({
          variantId: 'D2_countdown',
          pairCount: 3,
          seed: s,
        });

        result.pairs.forEach((pair) => {
          expect(pair.left.value).toBeGreaterThanOrEqual(0);
          expect(pair.right.value).toBeGreaterThanOrEqual(0);
        });
      }
    });
  });

  describe('4. D3_doubling (두 배 늘리기) 생성 검증', () => {
    it('지정된 start에 따라 정답 수열과 pairPrompts를 정확히 생성한다', () => {
      const result = generateProgressionRound({
        variantId: 'D3_doubling',
        pairCount: 3,
        seed: 999,
        params: { start: 3 },
      });

      expect(result.questionText).toBe('3에서 두 배씩!');
      expect(result.params).toEqual({ start: 3 });

      // 정답 수열: 3 * 2 = 6, 6 * 2 = 12, 12 * 2 = 24
      expect(result.pairPrompts[0]).toBe('3 → ?');
      expect(result.pairPrompts[1]).toBe('3 → 6 → ?');
      expect(result.pairPrompts[2]).toBe('3 → 6 → 12 → ?');

      const expectedAnswers = [6, 12, 24];
      result.pairs.forEach((pair, idx) => {
        const correctChoice = pair.correctSide === 'left' ? pair.left : pair.right;
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;

        expect(correctChoice.value).toBe(expectedAnswers[idx]);
        expect(correctChoice.isCorrect).toBe(true);

        expect(wrongChoice.value).not.toBe(expectedAnswers[idx]);
        expect(wrongChoice.value).toBeGreaterThanOrEqual(0);
        expect(wrongChoice.isCorrect).toBe(false);
      });
    });

    it('라벨 글자 수가 maxLabelChars(6자) 이하로 유지된다', () => {
      for (let s = 1; s <= 50; s++) {
        const result = generateProgressionRound({
          variantId: 'D3_doubling',
          pairCount: 4,
          seed: s,
        });

        result.pairs.forEach((pair) => {
          expect(pair.left.text.length).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars);
          expect(pair.right.text.length).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars);
        });
      }
    });
  });

  describe('5. DOC-18 §4.4 및 A34 인수 기준 (오답 전파 방지)', () => {
    it('pairPrompts는 플레이어의 정오와 무관하게 사전 생성된 결정론적 정답 수열을 안내한다', () => {
      const result = generateProgressionRound({
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 42,
        params: { start: 5, step: 3 },
      });

      // 수열: 5 -> 8 -> 11 -> 14
      expect(result.pairPrompts[0]).toBe('5 → ?');
      expect(result.pairPrompts[1]).toBe('5 → 8 → ?');
      expect(result.pairPrompts[2]).toBe('5 → 8 → 11 → ?');

      // 쌍 1의 정답은 첫 쌍의 정오와 상관없이 항상 11
      const pair1Correct = result.pairs[1].correctSide === 'left' ? result.pairs[1].left : result.pairs[1].right;
      expect(pair1Correct.value).toBe(11);

      // 쌍 2의 정답은 항상 14
      const pair2Correct = result.pairs[2].correctSide === 'left' ? result.pairs[2].left : result.pairs[2].right;
      expect(pair2Correct.value).toBe(14);
    });
  });

  describe('6. 제약 조건 및 불변성 (Quality & Invariants)', () => {
    it('동일한 seed와 variantId는 100% 동일한 결과를 생성한다 (결정론적)', () => {
      const params: ProgressionGenerateParams = {
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 1234,
      };

      const res1 = generateProgressionRound(params);
      const res2 = generateProgressionRound(params);

      expect(res1).toEqual(res2);
    });

    it('서로 다른 seed는 다른 결과를 생성한다', () => {
      const res1 = generateProgressionRound({
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 1111,
      });
      const res2 = generateProgressionRound({
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 2222,
      });

      expect(res1.pairs[0].left.value !== res2.pairs[0].left.value || res1.pairs[0].right.value !== res2.pairs[0].right.value).toBe(true);
    });

    it('반환된 결과 객체는 deepFreeze에 의해 완전 동결된다', () => {
      const result = generateProgressionRound({
        variantId: 'D1_skip_count',
        pairCount: 3,
        seed: 555,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.pairPrompts)).toBe(true);
      expect(Object.isFrozen(result.pairs)).toBe(true);
      expect(Object.isFrozen(result.pairs[0])).toBe(true);
      expect(Object.isFrozen(result.pairs[0].left)).toBe(true);
      expect(Object.isFrozen(result.pairs[0].right)).toBe(true);
    });

    it('연속 같은 쪽 정답은 최대 maxConsecutiveSameSide(3)회를 초과하지 않는다', () => {
      // 긴 수열 (pairCount = 10) 20개 시드로 검증
      for (let s = 1; s <= 20; s++) {
        const result = generateProgressionRound({
          variantId: 'D1_skip_count',
          pairCount: 10,
          seed: s * 100,
        });

        let consecutive = 1;
        for (let i = 1; i < result.pairs.length; i++) {
          if (result.pairs[i].correctSide === result.pairs[i - 1].correctSide) {
            consecutive++;
            expect(consecutive).toBeLessThanOrEqual(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide);
          } else {
            consecutive = 1;
          }
        }
      }
    });

    it('각 쌍마다 오답 선택지는 유일하고(isCorrect: false) 정답과 값이 다르다', () => {
      const result = generateProgressionRound({
        variantId: 'D2_countdown',
        pairCount: 4,
        seed: 333,
      });

      for (const pair of result.pairs) {
        expect(pair.left.isCorrect !== pair.right.isCorrect).toBe(true);
        expect(pair.left.value).not.toBe(pair.right.value);
        expect(pair.choices[0]).toBe(pair.left);
        expect(pair.choices[1]).toBe(pair.right);
      }
    });
  });
});
