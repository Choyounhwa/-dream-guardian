/**
 * challenge-equivalence.test.ts - C 같은 값 찾기 계열 쌍 생성기 단위 테스트
 *
 * @see Issue #655 [ASSAULT-CHALLENGE-CH-10]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 5, 11.2)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  generateEquivalenceRound,
  type EquivalenceGenerateParams,
  type EquivalenceRoundResult,
  type EquivalenceVariantId,
} from '../../src/question/challenge/EquivalenceGenerator.js';
import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../config/assault-challenge.config.js';
import { parseExpressionLabel } from '../../src/question/challenge/ChallengeExpression.js';
import { Rational } from '../../src/utils/Rational.js';

describe('[ASSAULT-CHALLENGE-CH-10 / #655] C 같은 값 찾기 계열 쌍 생성기', () => {
  describe('0. 타입 계약 검증', () => {
    it('EquivalenceGenerateParams 및 EquivalenceRoundResult 타입 적합성', () => {
      const params: EquivalenceGenerateParams = {
        variantId: 'C1_make_target',
        pairCount: 2,
        seed: 123,
      };
      const result: EquivalenceRoundResult = generateEquivalenceRound(params);
      expectTypeOf(result).toMatchTypeOf<EquivalenceRoundResult>();
      expectTypeOf(params).toMatchTypeOf<EquivalenceGenerateParams>();
      expect(result.family).toBe('equivalence');
    });
  });

  describe('1. 입력 유효성 검증 (Validation)', () => {
    it('지원되지 않는 variantId인 경우 예외를 던진다', () => {
      expect(() => {
        generateEquivalenceRound({
          variantId: 'A1_times_table' as unknown as EquivalenceVariantId,
          pairCount: 3,
          seed: 42,
        });
      }).toThrow(/unsupported variantId/i);
    });

    it('pairCount가 2 미만인 경우 예외를 던진다', () => {
      expect(() => {
        generateEquivalenceRound({
          variantId: 'C1_make_target',
          pairCount: 1,
          seed: 42,
        });
      }).toThrow(/pairCount must be at least 2/i);
    });

    it('pairCount가 정수가 아닌 경우 예외를 던진다', () => {
      expect(() => {
        generateEquivalenceRound({
          variantId: 'C1_make_target',
          pairCount: 2.5,
          seed: 42,
        });
      }).toThrow(/pairCount must be an integer/i);
    });

    it('seed가 정수가 아닌 경우 예외를 던진다', () => {
      expect(() => {
        generateEquivalenceRound({
          variantId: 'C1_make_target',
          pairCount: 2,
          seed: 1.5,
        });
      }).toThrow(/seed must be an integer/i);
    });

    it('C1_make_target: target이 유효하지 않은 정수인 경우 예외를 던진다', () => {
      expect(() => {
        generateEquivalenceRound({
          variantId: 'C1_make_target',
          pairCount: 2,
          seed: 42,
          params: { target: 1 }, // 너무 작음 (< 2)
        });
      }).toThrow(/invalid target/i);
    });

    it('C2_equivalent: targetKind가 범위를 벗어난 경우 예외를 던진다', () => {
      expect(() => {
        generateEquivalenceRound({
          variantId: 'C2_equivalent',
          pairCount: 2,
          seed: 42,
          params: { targetKind: 99 },
        });
      }).toThrow(/invalid targetKind/i);
    });
  });

  describe('2. 결정론적 재현성 (Determinism)', () => {
    it('동일한 seed와 params에 대해 100% 동일한 결과를 반환한다', () => {
      const p1: EquivalenceGenerateParams = {
        variantId: 'C1_make_target',
        pairCount: 4,
        seed: 7777,
        params: { target: 12 },
      };
      const p2: EquivalenceGenerateParams = { ...p1 };

      const r1 = generateEquivalenceRound(p1);
      const r2 = generateEquivalenceRound(p2);

      expect(r1).toEqual(r2);
    });

    it('다른 seed인 경우 상이한 결과가 생성된다', () => {
      const r1 = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 3,
        seed: 101,
      });
      const r2 = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 3,
        seed: 9999,
      });

      const r1Labels = r1.pairs.map((p) => `${p.left.text}|${p.right.text}`).join(';');
      const r2Labels = r2.pairs.map((p) => `${p.left.text}|${p.right.text}`).join(';');
      expect(r1Labels).not.toBe(r2Labels);
    });
  });

  describe('3. C1_make_target 유형 규칙 검증', () => {
    it('지정된 target(예: 12)에 대해 문제 문구와 target 필드가 올바르다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 3,
        seed: 42,
        params: { target: 12 },
      });

      expect(res.target).toBe('12');
      expect(res.questionText).toMatch(/12[을를] 만들어라!/);
      expect(res.pairs.length).toBe(3);
    });

    it('모든 쌍에서 정답은 T와 일치하고 오답은 T와 불일치하며 같은 연산 종류이다', () => {
      const target = 12;
      const targetVal = Rational.of(target);
      const res = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 4,
        seed: 12345,
        params: { target },
      });

      const correctLabels = new Set<string>();

      for (const pair of res.pairs) {
        const leftParsed = parseExpressionLabel(pair.left.text);
        const rightParsed = parseExpressionLabel(pair.right.text);

        const correctParsed = pair.correctSide === 'left' ? leftParsed : rightParsed;
        const wrongParsed = pair.correctSide === 'left' ? rightParsed : leftParsed;

        // 정답은 목표값과 일치
        expect(correctParsed.value.equals(targetVal)).toBe(true);
        // 오답은 목표값과 불일치
        expect(wrongParsed.value.equals(targetVal)).toBe(false);

        // 정답 수식 라벨 한 라운드 내 중복 금지
        expect(correctLabels.has(correctParsed.label)).toBe(false);
        correctLabels.add(correctParsed.label);

        // 오답의 연산 종류가 정답과 일치하는지 검증 (+, -, ×, ÷)
        const getOp = (label: string) => {
          if (label.includes('+')) return '+';
          if (label.includes('-')) return '-';
          if (label.includes('×') || label.includes('*')) return '×';
          if (label.includes('÷') || label.includes('/')) return '÷';
          return null;
        };
        const correctOp = getOp(correctParsed.label);
        const wrongOp = getOp(wrongParsed.label);
        expect(correctOp).not.toBeNull();
        expect(wrongOp).toBe(correctOp);

        // 오답의 값 오차는 config의 operandTrapOffsets 범위에 속함
        const diff = wrongParsed.value.sub(targetVal);
        expect(diff.denominator).toBe(1);
        const diffInt = diff.numerator;
        expect([-2, -1, 1, 2]).toContain(diffInt);
      }
    });

    it('target 미지정 시 카탈로그 기본 범위 [10, 50] 내에서 생성된다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 2,
        seed: 777,
      });

      const targetNum = Number(res.target);
      expect(Number.isInteger(targetNum)).toBe(true);
      expect(targetNum).toBeGreaterThanOrEqual(10);
      expect(targetNum).toBeLessThanOrEqual(50);
    });

    it('한국어 목적격 조사(을/를)가 받침 유무에 맞게 정확히 선택된다', () => {
      // 10: 받침 있음 -> 을
      const r10 = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 2,
        seed: 1,
        params: { target: 10 },
      });
      expect(r10.questionText).toBe('10을 만들어라!');

      // 12: 받침 없음 -> 를
      const r12 = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 2,
        seed: 1,
        params: { target: 12 },
      });
      expect(r12.questionText).toBe('12를 만들어라!');
    });

    it('소수(prime) target(예: 13) 및 큰 합성수 target(예: 24)에서도 정상 생성된다', () => {
      for (const t of [13, 24, 50]) {
        const res = generateEquivalenceRound({
          variantId: 'C1_make_target',
          pairCount: 3,
          seed: 42 + t,
          params: { target: t },
        });

        expect(res.pairs.length).toBe(3);
        const tVal = Rational.of(t);
        for (const pair of res.pairs) {
          const correctText = pair.correctSide === 'left' ? pair.left.text : pair.right.text;
          const parsed = parseExpressionLabel(correctText);
          expect(parsed.value.equals(tVal)).toBe(true);
        }
      }
    });
  });

  describe('4. C2_equivalent 유형 규칙 검증', () => {
    it('target이 1/2인 경우 문제 문구는 "1/2과 같은 것!" 이고 정답은 모두 1/2과 같은 분수/소수이다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C2_equivalent',
        pairCount: 4,
        seed: 42,
        params: { targetKind: 1 }, // 1/2
      });

      expect(res.target).toBe('1/2');
      expect(res.questionText).toBe('1/2과 같은 것!');

      const half = Rational.of(1, 2);
      const correctLabels = new Set<string>();

      for (const pair of res.pairs) {
        const leftParsed = parseExpressionLabel(pair.left.text);
        const rightParsed = parseExpressionLabel(pair.right.text);

        const correctParsed = pair.correctSide === 'left' ? leftParsed : rightParsed;
        const wrongParsed = pair.correctSide === 'left' ? rightParsed : leftParsed;

        // 정답은 목표값 1/2과 일치
        expect(correctParsed.value.equals(half)).toBe(true);
        // 정답은 target 문자열 자체와 구별되는 동치 표현
        expect(correctParsed.label).not.toBe('1/2');
        // 오답은 목표값과 불일치
        expect(wrongParsed.value.equals(half)).toBe(false);

        // 라운드 내 정답 라벨 중복 금지
        expect(correctLabels.has(correctParsed.label)).toBe(false);
        correctLabels.add(correctParsed.label);
      }
    });

    it('targetKind 2 (1/4) 및 3 (3/4)에서도 정확한 동치쌍이 생성된다', () => {
      for (const kind of [2, 3]) {
        const res = generateEquivalenceRound({
          variantId: 'C2_equivalent',
          pairCount: 3,
          seed: 99 + kind,
          params: { targetKind: kind },
        });

        const expectedTargetRational = kind === 2 ? Rational.of(1, 4) : Rational.of(3, 4);

        for (const pair of res.pairs) {
          const leftParsed = parseExpressionLabel(pair.left.text);
          const rightParsed = parseExpressionLabel(pair.right.text);
          const correctParsed = pair.correctSide === 'left' ? leftParsed : rightParsed;
          const wrongParsed = pair.correctSide === 'left' ? rightParsed : leftParsed;

          expect(correctParsed.value.equals(expectedTargetRational)).toBe(true);
          expect(wrongParsed.value.equals(expectedTargetRational)).toBe(false);
        }
      }
    });
  });

  describe('5. C3_make_ten 유형 규칙 검증', () => {
    it('target은 "10" 이고 questionText는 "합이 10!" 이다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C3_make_ten',
        pairCount: 4,
        seed: 123,
      });

      expect(res.target).toBe('10');
      expect(res.questionText).toBe('합이 10!');
      expect(res.params.target).toBe(10);
    });

    it('모든 쌍에서 정답은 합이 10인 덧셈 식이며 오답은 합이 10이 아닌 식이다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C3_make_ten',
        pairCount: 5,
        seed: 555,
      });

      const ten = Rational.of(10);
      const correctLabels = new Set<string>();

      for (const pair of res.pairs) {
        const leftParsed = parseExpressionLabel(pair.left.text);
        const rightParsed = parseExpressionLabel(pair.right.text);

        const correctParsed = pair.correctSide === 'left' ? leftParsed : rightParsed;
        const wrongParsed = pair.correctSide === 'left' ? rightParsed : leftParsed;

        // 정답은 덧셈 식이고 합이 10
        expect(correctParsed.label).toContain('+');
        expect(correctParsed.value.equals(ten)).toBe(true);

        // 오답은 덧셈 식이고 합이 10이 아님
        expect(wrongParsed.label).toContain('+');
        expect(wrongParsed.value.equals(ten)).toBe(false);

        // 정답 중복 금지
        expect(correctLabels.has(correctParsed.label)).toBe(false);
        correctLabels.add(correctParsed.label);

        // 오답 합은 10 ± 1 또는 10 ± 2
        const diff = Math.abs(wrongParsed.value.numerator - 10);
        expect([1, 2]).toContain(diff);
      }
    });
  });

  describe('6. 공통 가드레일 제약 검증', () => {
    const variants: EquivalenceVariantId[] = ['C1_make_target', 'C2_equivalent', 'C3_make_ten'];

    it('라벨 길이는 항상 DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars (6) 이하이다', () => {
      const maxLen = DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars;
      for (const variantId of variants) {
        for (let seed = 1; seed <= 5; seed++) {
          const res = generateEquivalenceRound({
            variantId,
            pairCount: 4,
            seed: seed * 100,
          });

          for (const pair of res.pairs) {
            expect(pair.left.text.length).toBeLessThanOrEqual(maxLen);
            expect(pair.right.text.length).toBeLessThanOrEqual(maxLen);
          }
        }
      }
    });

    it('maxConsecutiveSameSide (3) 제약을 엄격히 준수한다', () => {
      for (const variantId of variants) {
        for (let seed = 1; seed <= 10; seed++) {
          const res = generateEquivalenceRound({
            variantId,
            pairCount: 8,
            seed: seed * 777,
          });

          let maxConsecutive = 1;
          let currentConsecutive = 1;
          for (let i = 1; i < res.pairs.length; i++) {
            if (res.pairs[i].correctSide === res.pairs[i - 1].correctSide) {
              currentConsecutive++;
              if (currentConsecutive > maxConsecutive) {
                maxConsecutive = currentConsecutive;
              }
            } else {
              currentConsecutive = 1;
            }
          }

          expect(maxConsecutive).toBeLessThanOrEqual(
            DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide,
          );
        }
      }
    });

    it('반환 결과 객체는 deepFreeze로 동결되어 있다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C1_make_target',
        pairCount: 2,
        seed: 42,
      });

      expect(Object.isFrozen(res)).toBe(true);
      expect(Object.isFrozen(res.pairs)).toBe(true);
      expect(Object.isFrozen(res.pairs[0])).toBe(true);
      expect(Object.isFrozen(res.pairs[0].left)).toBe(true);
      expect(Object.isFrozen(res.pairs[0].right)).toBe(true);
      expect(Object.isFrozen(res.pairs[0].choices)).toBe(true);
    });

    it('AssaultChoiceItem의 value는 숫자로, text는 문자열로, isCorrect는 correctSide와 일치한다', () => {
      const res = generateEquivalenceRound({
        variantId: 'C3_make_ten',
        pairCount: 3,
        seed: 888,
      });

      for (const pair of res.pairs) {
        expect(typeof pair.left.value).toBe('number');
        expect(typeof pair.right.value).toBe('number');
        expect(typeof pair.left.text).toBe('string');
        expect(typeof pair.right.text).toBe('string');
        expect(pair.left.isCorrect).toBe(pair.correctSide === 'left');
        expect(pair.right.isCorrect).toBe(pair.correctSide === 'right');
      }
    });
  });
});
