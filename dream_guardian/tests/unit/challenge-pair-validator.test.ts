/**
 * challenge-pair-validator.test.ts - 챌린지 쌍 독립 정답 유일성 검증기 단위 테스트
 *
 * @see Issue #657 [ASSAULT-CHALLENGE-CH-12]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.4, 5, 11.2, 11.3)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  validateChallengeRound,
  type ValidateChallengeRoundParams,
  type ChallengePairValidationResult,
} from '../../src/question/challenge/ChallengePairValidator.js';
import { generateRuleHuntRound } from '../../src/question/challenge/RuleHuntGenerator.js';
import { generateDuelRound } from '../../src/question/challenge/DuelGenerator.js';
import { generateEquivalenceRound } from '../../src/question/challenge/EquivalenceGenerator.js';
import { generateProgressionRound } from '../../src/question/challenge/ProgressionGenerator.js';
import type { AssaultAnswerPair } from '../../src/question/AssaultAnswerPairFactory.js';

describe('[ASSAULT-CHALLENGE-CH-12 / #657] 챌린지 쌍 독립 정답 유일성 검증기', () => {
  // ─── 0. 타입 계약 및 불변성 ───
  describe('0. 타입 계약 및 불변성', () => {
    it('ValidateChallengeRoundParams 및 ChallengePairValidationResult 타입 적합성', () => {
      const dummyPair: AssaultAnswerPair = {
        pairId: 'test-0',
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 13, text: '13', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 13, text: '13', isCorrect: false },
        ],
      };
      const params: ValidateChallengeRoundParams = {
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs: [dummyPair],
      };

      expectTypeOf(params).toMatchTypeOf<ValidateChallengeRoundParams>();
      const result: ChallengePairValidationResult = validateChallengeRound(params);
      expectTypeOf(result).toMatchTypeOf<ChallengePairValidationResult>();
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('결과 객체 및 errors 배열은 deepFreeze 동결되어야 한다', () => {
      const dummyPair: AssaultAnswerPair = {
        pairId: 'test-0',
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 13, text: '13', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 13, text: '13', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs: [dummyPair],
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.errors)).toBe(true);
    });
  });

  // ─── 1. 정상 라운드(CH-08~11 생성기 출력물) 검증 통과 ───
  describe('1. 정상 라운드(CH-08~11) 검증 통과', () => {
    it('A 규칙 사냥 계열 (A1~A4) 100개 시드 생성 결과 100% 통과', () => {
      const variants = ['A1_times_table', 'A2_parity', 'A3_range', 'A4_multiple'] as const;
      for (const variantId of variants) {
        for (let seed = 100; seed < 110; seed++) {
          const round = generateRuleHuntRound({ variantId, pairCount: 3, seed });
          const result = validateChallengeRound(round);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      }
    });

    it('B 대결 계열 (B1~B4) max 및 min 100% 통과', () => {
      const variants = ['B1_addsub_duel', 'B2_mul_duel', 'B3_fraction_duel', 'B4_decimal_duel'] as const;
      for (const variantId of variants) {
        for (const direction of ['max', 'min'] as const) {
          const round = generateDuelRound({ variantId, pairCount: 3, seed: 777, direction });
          const result = validateChallengeRound(round);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      }
    });

    it('C 같은 값 찾기 계열 (C1~C3) 100% 통과', () => {
      const variants = ['C1_make_target', 'C2_equivalent', 'C3_make_ten'] as const;
      for (const variantId of variants) {
        for (let seed = 200; seed < 210; seed++) {
          const round = generateEquivalenceRound({ variantId, pairCount: 3, seed });
          const result = validateChallengeRound(round);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      }
    });

    it('D 진행 계열 (D1~D3) 및 pairPrompts 100% 통과', () => {
      const variants = ['D1_skip_count', 'D2_countdown', 'D3_doubling'] as const;
      for (const variantId of variants) {
        for (let seed = 300; seed < 310; seed++) {
          const round = generateProgressionRound({ variantId, pairCount: 3, seed });
          const result = validateChallengeRound(round);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      }
    });
  });

  // ─── 2. 오류 코드별 세부 검증 ───
  describe('2. 오류 코드별 세부 검증', () => {
    // 2.1 LABEL_TOO_LONG
    it('라벨 길이가 maxLabelChars(6)를 초과할 경우 LABEL_TOO_LONG 오류를 반환한다', () => {
      const longPair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 1234567, text: '1234567', isCorrect: true }, // 7자
        right: { value: 10, text: '10', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 1234567, text: '1234567', isCorrect: true },
          { value: 10, text: '10', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '홀수를 쳐라!',
        params: { parity: 1 },
        pairs: [longPair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'LABEL_TOO_LONG')).toBe(true);
      const err = result.errors.find((e) => e.code === 'LABEL_TOO_LONG');
      expect(err?.side).toBe('left');
      expect(err?.pairIndex).toBe(0);
    });

    // 2.2 NO_UNIQUE_CORRECT
    it('정답 플래그가 둘 다 true이거나 둘 다 false인 경우 NO_UNIQUE_CORRECT 오류를 반환한다', () => {
      const bothTruePair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 14, text: '14', isCorrect: true }, // 둘 다 true
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 14, text: '14', isCorrect: true },
        ],
      };
      const result1 = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs: [bothTruePair],
      });

      expect(result1.isValid).toBe(false);
      expect(result1.errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);

      const bothFalsePair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12, text: '12', isCorrect: false },
        right: { value: 13, text: '13', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: false },
          { value: 13, text: '13', isCorrect: false },
        ],
      };
      const result2 = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs: [bothFalsePair],
      });
      expect(result2.isValid).toBe(false);
      expect(result2.errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);
    });

    it('correctSide와 isCorrect 플래그가 불일치할 경우 NO_UNIQUE_CORRECT 오류를 반환한다', () => {
      const mismatchPair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 13, text: '13', isCorrect: false },
        correctSide: 'right', // left가 true인데 correctSide는 right
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 13, text: '13', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs: [mismatchPair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);
    });

    it('좌우 보기가 둘 다 술어를 만족하거나 둘 다 불만족할 때 NO_UNIQUE_CORRECT 오류를 반환한다', () => {
      // 둘 다 6단 배수인 경우 (36, 42)
      const bothSatisfyPair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 36, text: '36', isCorrect: true },
        right: { value: 42, text: '42', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 36, text: '36', isCorrect: true },
          { value: 42, text: '42', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs: [bothSatisfyPair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);
    });

    // 2.3 CONSECUTIVE_SAME_SIDE_EXCEEDED
    it('같은 쪽(L/R)이 4회 이상 연속될 경우 CONSECUTIVE_SAME_SIDE_EXCEEDED 오류를 반환한다', () => {
      const makePair = (id: string, side: 'left' | 'right', val: number): AssaultAnswerPair => ({
        pairId: id,
        left: { value: side === 'left' ? val : 13, text: String(side === 'left' ? val : 13), isCorrect: side === 'left' },
        right: { value: side === 'right' ? val : 13, text: String(side === 'right' ? val : 13), isCorrect: side === 'right' },
        correctSide: side,
        choices: [
          { value: side === 'left' ? val : 13, text: String(side === 'left' ? val : 13), isCorrect: side === 'left' },
          { value: side === 'right' ? val : 13, text: String(side === 'right' ? val : 13), isCorrect: side === 'right' },
        ],
      });

      // 4회 연속 left (maxConsecutiveSameSide: 3 초과)
      const pairs = [
        makePair('p-0', 'left', 12),
        makePair('p-1', 'left', 14),
        makePair('p-2', 'left', 16),
        makePair('p-3', 'left', 18),
      ];

      const result = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CONSECUTIVE_SAME_SIDE_EXCEEDED')).toBe(true);
      const err = result.errors.find((e) => e.code === 'CONSECUTIVE_SAME_SIDE_EXCEEDED');
      expect(err?.pairIndex).toBe(3);
      expect(err?.side).toBe('left');
    });

    // 2.4 NEGATIVE_OR_NAN
    it('음수(< 0) 또는 NaN/Infinity 수치나 0으로 나누기 식 발견 시 NEGATIVE_OR_NAN 오류를 반환한다', () => {
      const negativePair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: -5, text: '-5', isCorrect: false },
        right: { value: 6, text: '6', isCorrect: true },
        correctSide: 'right',
        choices: [
          { value: -5, text: '-5', isCorrect: false },
          { value: 6, text: '6', isCorrect: true },
        ],
      };
      const resultNeg = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs: [negativePair],
      });
      expect(resultNeg.isValid).toBe(false);
      expect(resultNeg.errors.some((e) => e.code === 'NEGATIVE_OR_NAN')).toBe(true);

      const divZeroPair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12, text: '6÷0', isCorrect: true },
        right: { value: 7, text: '7', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '6÷0', isCorrect: true },
          { value: 7, text: '7', isCorrect: false },
        ],
      };
      const resultDivZero = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs: [divZeroPair],
      });
      expect(resultDivZero.isValid).toBe(false);
      expect(resultDivZero.errors.some((e) => e.code === 'NEGATIVE_OR_NAN')).toBe(true);
    });

    // 2.5 DUPLICATE_CHOICES
    it('좌우 보기가 서로 동일한 라벨이거나 동치인 값일 경우 DUPLICATE_CHOICES 오류를 반환한다', () => {
      const dupPair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 12, text: '12', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 12, text: '12', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs: [dupPair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_CHOICES')).toBe(true);
    });

    // 2.6 DUPLICATE_ROUND_ANSWERS
    it('한 라운드 내 정답 표현이 중복될 경우 DUPLICATE_ROUND_ANSWERS 오류를 반환한다', () => {
      const pairs: AssaultAnswerPair[] = [
        {
          pairId: 'p-0',
          left: { value: 18, text: '18', isCorrect: true },
          right: { value: 19, text: '19', isCorrect: false },
          correctSide: 'left',
          choices: [
            { value: 18, text: '18', isCorrect: true },
            { value: 19, text: '19', isCorrect: false },
          ],
        },
        {
          pairId: 'p-1',
          left: { value: 20, text: '20', isCorrect: false },
          right: { value: 18, text: '18', isCorrect: true }, // '18' 중복 정답!
          correctSide: 'right',
          choices: [
            { value: 20, text: '20', isCorrect: false },
            { value: 18, text: '18', isCorrect: true },
          ],
        },
      ];
      const result = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        questionText: '6단 숫자를 쳐라!',
        params: { k: 6 },
        pairs,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_ROUND_ANSWERS')).toBe(true);
    });

    // 2.7 RULE_VIOLATION (A, B, C, D)
    it('A 규칙 사냥: 정답으로 지정된 쪽이 술어를 위반한 경우 RULE_VIOLATION 오류를 반환한다', () => {
      // 짝수를 쳐라인데 홀수(15)가 정답으로 지정됨
      const pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 15, text: '15', isCorrect: true },
        right: { value: 14, text: '14', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 15, text: '15', isCorrect: true },
          { value: 14, text: '14', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs: [pair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('B 대결 계열: 방향 대결 위반(max인데 작은 쪽 선택) 시 RULE_VIOLATION 오류를 반환한다', () => {
      // 더 큰 쪽을 쳐라! 인데 7+8(=15) 대신 6+7(=13)이 정답으로 지정됨
      const pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 13, text: '6+7', isCorrect: true },
        right: { value: 15, text: '7+8', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 13, text: '6+7', isCorrect: true },
          { value: 15, text: '7+8', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'B1_addsub_duel',
        family: 'duel',
        questionText: '더 큰 쪽을 쳐라!',
        pairs: [pair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('C 같은 값 계열: 목표값 불일치 시 RULE_VIOLATION 오류를 반환한다', () => {
      // 12를 만들어라! 인데 7+4(=11)가 정답으로 지정됨
      const pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 11, text: '7+4', isCorrect: true },
        right: { value: 10, text: '2×5', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 11, text: '7+4', isCorrect: true },
          { value: 10, text: '2×5', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'C1_make_target',
        family: 'equivalence',
        questionText: '12를 만들어라!',
        params: { target: 12 },
        pairs: [pair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('D 진행 계열: 수열 규칙 불일치 시 RULE_VIOLATION 오류를 반환한다', () => {
      // 3부터 4씩 뛰어라! -> 첫 정답은 7이어야 하는데 8로 지정됨
      const pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 8, text: '8', isCorrect: true },
        right: { value: 9, text: '9', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 8, text: '8', isCorrect: true },
          { value: 9, text: '9', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'D1_skip_count',
        family: 'progression',
        questionText: '3부터 4씩 뛰어라!',
        params: { start: 3, step: 4 },
        pairPrompts: ['3 → ?'],
        pairs: [pair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('D 진행 계열: pairPrompts가 수열 상태와 불일치 시 RULE_VIOLATION 오류를 반환한다', () => {
      const pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 7, text: '7', isCorrect: true },
        right: { value: 8, text: '8', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 7, text: '7', isCorrect: true },
          { value: 8, text: '8', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'D1_skip_count',
        family: 'progression',
        questionText: '3부터 4씩 뛰어라!',
        params: { start: 3, step: 4 },
        pairPrompts: ['5 → ?'], // 3 → ? 이어야 함
        pairs: [pair],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('D2 카운트다운 및 D3 더블링 수열 위반을 올바르게 감지한다', () => {
      // D2: 20에서 3씩 내려라! -> i=0: 17이어야 하는데 18 지정
      const d2Pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 18, text: '18', isCorrect: true },
        right: { value: 17, text: '17', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 18, text: '18', isCorrect: true },
          { value: 17, text: '17', isCorrect: false },
        ],
      };
      const resD2 = validateChallengeRound({
        variantId: 'D2_countdown',
        family: 'progression',
        questionText: '20에서 3씩 빼라!',
        params: { start: 20, step: 3 },
        pairs: [d2Pair],
      });
      expect(resD2.isValid).toBe(false);
      expect(resD2.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);

      // D3: 3부터 2배씩 뛰어라! -> i=0: 6이어야 하는데 5 지정
      const d3Pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 5, text: '5', isCorrect: true },
        right: { value: 6, text: '6', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 5, text: '5', isCorrect: true },
          { value: 6, text: '6', isCorrect: false },
        ],
      };
      const resD3 = validateChallengeRound({
        variantId: 'D3_doubling',
        family: 'progression',
        questionText: '3부터 2배씩 뛰어라!',
        params: { start: 3 },
        pairs: [d3Pair],
      });
      expect(resD3.isValid).toBe(false);
      expect(resD3.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });
  });

  // ─── 3. 옵션 오버라이드 및 경계 케이스 ───
  describe('3. 옵션 오버라이드 및 입력 방어', () => {
    it('options.maxLabelChars 오버라이드가 올바르게 적용된다', () => {
      const pair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12345, text: '12345', isCorrect: true }, // 5자
        right: { value: 10, text: '10', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12345, text: '12345', isCorrect: true },
          { value: 10, text: '10', isCorrect: false },
        ],
      };
      // 기본 상한 6자 -> 통과
      const resDefault = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '홀수를 쳐라!',
        params: { parity: 1 },
        pairs: [pair],
      });
      expect(resDefault.errors.some((e) => e.code === 'LABEL_TOO_LONG')).toBe(false);

      // 옵션 4자 오버라이드 -> LABEL_TOO_LONG 실패
      const resCustom = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '홀수를 쳐라!',
        params: { parity: 1 },
        pairs: [pair],
        options: { maxLabelChars: 4 },
      });
      expect(resCustom.isValid).toBe(false);
      expect(resCustom.errors.some((e) => e.code === 'LABEL_TOO_LONG')).toBe(true);
    });

    it('options.maxConsecutiveSameSide 오버라이드가 올바르게 적용된다', () => {
      const makePair = (id: string): AssaultAnswerPair => ({
        pairId: id,
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 13, text: '13', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 13, text: '13', isCorrect: false },
        ],
      });
      const pairs = [makePair('p-0'), makePair('p-1'), makePair('p-2')]; // 3회 연속 left

      // 기본 상한 3회 -> 통과
      const resDefault = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs,
      });
      expect(resDefault.errors.some((e) => e.code === 'CONSECUTIVE_SAME_SIDE_EXCEEDED')).toBe(false);

      // 옵션 2회 오버라이드 -> CONSECUTIVE_SAME_SIDE_EXCEEDED 실패
      const resCustom = validateChallengeRound({
        variantId: 'A2_parity',
        family: 'rule_hunt',
        questionText: '짝수를 쳐라!',
        params: { parity: 0 },
        pairs,
        options: { maxConsecutiveSameSide: 2 },
      });
      expect(resCustom.isValid).toBe(false);
      expect(resCustom.errors.some((e) => e.code === 'CONSECUTIVE_SAME_SIDE_EXCEEDED')).toBe(true);
    });

    it('빈 pairs 배열이거나 pairs가 아닌 경우 RULE_VIOLATION 오류를 반환한다', () => {
      const resEmpty = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'rule_hunt',
        pairs: [],
      });
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);

      const resInvalid = validateChallengeRound(null as unknown as ValidateChallengeRoundParams);
      expect(resInvalid.isValid).toBe(false);
      expect(resInvalid.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('카탈로그 family와 일치하지 않는 variantId인 경우 RULE_VIOLATION 오류를 반환한다', () => {
      const dummyPair: AssaultAnswerPair = {
        pairId: 'p-0',
        left: { value: 12, text: '12', isCorrect: true },
        right: { value: 13, text: '13', isCorrect: false },
        correctSide: 'left',
        choices: [
          { value: 12, text: '12', isCorrect: true },
          { value: 13, text: '13', isCorrect: false },
        ],
      };
      const result = validateChallengeRound({
        variantId: 'A1_times_table',
        family: 'duel' as unknown as 'rule_hunt', // 불일치!
        pairs: [dummyPair],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });
  });

  // ─── 4. 순수 함수성 검증 ───
  describe('4. 순수 함수성 검증 (Purity)', () => {
    it('동일한 입력을 여러 번 검증해도 동일한 결과를 반환하고 원본 입력을 변형하지 않는다', () => {
      const round = generateRuleHuntRound({ variantId: 'A1_times_table', pairCount: 3, seed: 999 });
      const serializedBefore = JSON.stringify(round);

      const res1 = validateChallengeRound(round);
      const res2 = validateChallengeRound(round);

      expect(res1).toEqual(res2);
      expect(JSON.stringify(round)).toBe(serializedBefore);
    });
  });
});
