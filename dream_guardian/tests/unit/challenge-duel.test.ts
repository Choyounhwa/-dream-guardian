/**
 * challenge-duel.test.ts - B 대결 계열 쌍 생성기 단위 테스트
 *
 * @see Issue #654 [ASSAULT-CHALLENGE-CH-09]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 5, 11.2)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  generateDuelRound,
  type DuelGenerateParams,
  type DuelRoundResult,
  type DuelVariantId,
} from '../../src/question/challenge/DuelGenerator.js';
import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../config/assault-challenge.config.js';
import { parseExpressionLabel } from '../../src/question/challenge/ChallengeExpression.js';

describe('[ASSAULT-CHALLENGE-CH-09 / #654] B 대결 계열 쌍 생성기', () => {
  describe('0. 타입 계약 검증', () => {
    it('DuelGenerateParams 및 DuelRoundResult 타입 적합성', () => {
      const params: DuelGenerateParams = {
        variantId: 'B1_addsub_duel',
        pairCount: 2,
        seed: 123,
      };
      const result: DuelRoundResult = generateDuelRound(params);
      expectTypeOf(result).toMatchTypeOf<DuelRoundResult>();
      expectTypeOf(params).toMatchTypeOf<DuelGenerateParams>();
      expect(result.family).toBe('duel');
    });
  });

  describe('1. 입력 유효성 검증 (Validation)', () => {
    it('지원되지 않는 variantId인 경우 예외를 던진다', () => {
      expect(() => {
        generateDuelRound({
          variantId: 'A1_times_table' as unknown as DuelVariantId,
          pairCount: 3,
          seed: 42,
        });
      }).toThrow(/unsupported variantId/i);
    });

    it('pairCount가 2 미만인 경우 예외를 던진다', () => {
      expect(() => {
        generateDuelRound({
          variantId: 'B1_addsub_duel',
          pairCount: 1,
          seed: 42,
        });
      }).toThrow(/pairCount must be at least 2/i);
    });

    it('seed가 정수가 아닌 경우 예외를 던진다', () => {
      expect(() => {
        generateDuelRound({
          variantId: 'B1_addsub_duel',
          pairCount: 2,
          seed: 1.5,
        });
      }).toThrow(/seed must be an integer/i);
    });

    it('direction이 유효하지 않은 값인 경우 예외를 던진다', () => {
      expect(() => {
        generateDuelRound({
          variantId: 'B1_addsub_duel',
          pairCount: 2,
          seed: 12,
          direction: 'middle' as any,
        });
      }).toThrow(/invalid direction/i);
    });
  });

  describe('2. 결정론적 재현성 (Determinism)', () => {
    it('동일한 seed와 params에 대해 100% 동일한 결과를 반환한다', () => {
      const p1: DuelGenerateParams = {
        variantId: 'B1_addsub_duel',
        pairCount: 4,
        seed: 7777,
        direction: 'max',
      };
      const p2: DuelGenerateParams = { ...p1 };

      const r1 = generateDuelRound(p1);
      const r2 = generateDuelRound(p2);

      expect(r1).toEqual(r2);
    });

    it('다른 seed인 경우 상이한 결과(다른 식/배치)가 생성된다', () => {
      const r1 = generateDuelRound({
        variantId: 'B2_mul_duel',
        pairCount: 3,
        seed: 101,
      });
      const r2 = generateDuelRound({
        variantId: 'B2_mul_duel',
        pairCount: 3,
        seed: 9999,
      });

      const r1Labels = r1.pairs.map((p) => `${p.left.text}|${p.right.text}`).join(';');
      const r2Labels = r2.pairs.map((p) => `${p.left.text}|${p.right.text}`).join(';');
      expect(r1Labels).not.toBe(r2Labels);
    });
  });

  describe('3. 방향(direction: max vs min) 및 문제 문구(questionText)', () => {
    it('direction 미지정 시 기본값은 max이며 문구는 "더 큰 쪽을 쳐라!" 이다', () => {
      const res = generateDuelRound({
        variantId: 'B1_addsub_duel',
        pairCount: 2,
        seed: 42,
      });
      expect(res.direction).toBe('max');
      expect(res.questionText).toBe('더 큰 쪽을 쳐라!');
    });

    it('direction이 min인 경우 문구는 "더 작은 쪽을 쳐라!" 이다', () => {
      const res = generateDuelRound({
        variantId: 'B1_addsub_duel',
        pairCount: 2,
        seed: 42,
        direction: 'min',
      });
      expect(res.direction).toBe('min');
      expect(res.questionText).toBe('더 작은 쪽을 쳐라!');
    });
  });

  describe('4. B 계열 4개 유형별 생성 및 정답 정합성 검증', () => {
    const variants: DuelVariantId[] = [
      'B1_addsub_duel',
      'B2_mul_duel',
      'B3_fraction_duel',
      'B4_decimal_duel',
    ];

    variants.forEach((variantId) => {
      it(`${variantId}: 모든 쌍에서 두 값은 서로 다르고 정답 쪽이 방향(max/min)과 정확히 일치`, () => {
        for (const dir of ['max', 'min'] as const) {
          const res = generateDuelRound({
            variantId,
            pairCount: 5,
            seed: 12345,
            direction: dir,
          });

          expect(res.pairs.length).toBe(5);

          for (const pair of res.pairs) {
            // 라벨 파싱하여 정확한 Rational 값 산출
            const leftResult = parseExpressionLabel(pair.left.text);
            const rightResult = parseExpressionLabel(pair.right.text);
            const leftParsed = leftResult.value;
            const rightParsed = rightResult.value;

            // 두 값은 서로 달라야 함
            expect(leftParsed.equals(rightParsed)).toBe(false);

            const cmp = leftParsed.compare(rightParsed);
            const leftIsLarger = cmp > 0;

            const expectedCorrectSide =
              dir === 'max'
                ? leftIsLarger ? 'left' : 'right'
                : leftIsLarger ? 'right' : 'left';

            expect(pair.correctSide).toBe(expectedCorrectSide);

            if (pair.correctSide === 'left') {
              expect(pair.left.isCorrect).toBe(true);
              expect(pair.right.isCorrect).toBe(false);
            } else {
              expect(pair.left.isCorrect).toBe(false);
              expect(pair.right.isCorrect).toBe(true);
            }

            // 라벨 길이 검증 (<= maxLabelChars)
            expect(pair.left.text.length).toBeLessThanOrEqual(
              DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars,
            );
            expect(pair.right.text.length).toBeLessThanOrEqual(
              DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars,
            );
          }
        }
      });
    });
  });

  describe('5. 함정 규칙 및 특수 케이스 검증', () => {
    it('B4_decimal_duel: 소수점 자릿수 함정(decimalPrecisionTrap: 0.5 vs 0.45 등)이 발생할 수 있어야 함', () => {
      // 여러 시드로 실행하여 자릿수가 더 긴 쪽이 더 작은 함정 케이스 확인
      let foundPrecisionTrap = false;
      for (let s = 1; s <= 50; s++) {
        const res = generateDuelRound({
          variantId: 'B4_decimal_duel',
          pairCount: 3,
          seed: s,
        });
        for (const pair of res.pairs) {
          const lStr = pair.left.text;
          const rStr = pair.right.text;
          const lDec = lStr.includes('.') ? lStr.split('.')[1].length : 0;
          const rDec = rStr.includes('.') ? rStr.split('.')[1].length : 0;
          const lVal = parseExpressionLabel(lStr).value;
          const rVal = parseExpressionLabel(rStr).value;

          // 더 많은 자릿수를 가진 쪽이 더 작은 케이스
          if ((lDec > rDec && lVal.compare(rVal) < 0) || (rDec > lDec && rVal.compare(lVal) < 0)) {
            foundPrecisionTrap = true;
            break;
          }
        }
        if (foundPrecisionTrap) break;
      }
      expect(foundPrecisionTrap).toBe(true);
    });

    it('B3_fraction_duel: 분모 함정(fractionDenominatorTrap: 1/2 vs 2/5 등 분모가 더 크지만 값이 더 작은 경우) 발생', () => {
      let foundDenomTrap = false;
      for (let s = 1; s <= 50; s++) {
        const res = generateDuelRound({
          variantId: 'B3_fraction_duel',
          pairCount: 3,
          seed: s,
        });
        for (const pair of res.pairs) {
          const l = parseExpressionLabel(pair.left.text).value;
          const r = parseExpressionLabel(pair.right.text).value;

          // 한쪽 분모가 다른 쪽 분모보다 크지만 값은 더 작은 케이스
          if ((l.denominator > r.denominator && l.compare(r) < 0) ||
              (r.denominator > l.denominator && r.compare(l) < 0)) {
            foundDenomTrap = true;
            break;
          }
        }
        if (foundDenomTrap) break;
      }
      expect(foundDenomTrap).toBe(true);
    });

    it('모든 쌍의 diff는 diffRange [0.01, 10] 이내여야 함', () => {
      const cfg = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.duel;
      const [minDiff, maxDiff] = cfg.diffRange;

      const variants: DuelVariantId[] = [
        'B1_addsub_duel',
        'B2_mul_duel',
        'B3_fraction_duel',
        'B4_decimal_duel',
      ];

      for (const variantId of variants) {
        for (let s = 1; s <= 10; s++) {
          const res = generateDuelRound({
            variantId,
            pairCount: 3,
            seed: s,
          });

          for (const pair of res.pairs) {
            const l = parseExpressionLabel(pair.left.text).value;
            const r = parseExpressionLabel(pair.right.text).value;
            const diff = Math.abs(l.numerator / l.denominator - r.numerator / r.denominator);
            expect(diff).toBeGreaterThanOrEqual(minDiff - 1e-9);
            expect(diff).toBeLessThanOrEqual(maxDiff + 1e-9);
          }
        }
      }
    });
  });

  describe('6. 제약 조건 검증', () => {
    it('maxConsecutiveSameSide(최대 3회 연속 같은 쪽) 제약을 준수한다', () => {
      for (let seed = 100; seed < 150; seed++) {
        const res = generateDuelRound({
          variantId: 'B1_addsub_duel',
          pairCount: 10,
          seed,
        });

        let consecutive = 1;
        for (let i = 1; i < res.pairs.length; i++) {
          if (res.pairs[i].correctSide === res.pairs[i - 1].correctSide) {
            consecutive++;
            expect(consecutive).toBeLessThanOrEqual(
              DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide,
            );
          } else {
            consecutive = 1;
          }
        }
      }
    });

    it('반환된 객체는 deepFreeze 되어 수정할 수 없다', () => {
      const res = generateDuelRound({
        variantId: 'B1_addsub_duel',
        pairCount: 2,
        seed: 42,
      });

      expect(Object.isFrozen(res)).toBe(true);
      expect(Object.isFrozen(res.pairs)).toBe(true);
      expect(Object.isFrozen(res.pairs[0])).toBe(true);
      expect(Object.isFrozen(res.pairs[0].left)).toBe(true);

      expect(() => {
        (res as any).questionText = '해킹 시도';
      }).toThrow();
    });
  });
});
