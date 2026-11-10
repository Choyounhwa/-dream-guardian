/**
 * challenge-expression.test.ts - 챌린지 구조식 라벨·정확값 산출기 및 안전 파서 단위 테스트
 *
 * @see Issue #652 [ASSAULT-CHALLENGE-CH-07]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4~8, 11.3)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  expressionToLabel,
  expressionToValue,
  calculateLabelLength,
  evaluateExpression,
  parseExpressionLabel,
  toLabel,
  toValue,
  labelLength,
  type BinaryExpressionDef,
  type LiteralExpressionDef,
  type ChallengeExpressionDef,
  type ExpressionEvaluationOptions,
  type ChallengeExpressionResult,
} from '../../src/question/challenge/ChallengeExpression.js';
import { Rational } from '../../src/utils/Rational.js';

describe('[ASSAULT-CHALLENGE-CH-07 / #652] 챌린지 구조식 라벨·정확값 산출기', () => {
  describe('0. 타입 계약 및 인터페이스 검증', () => {
    it('BinaryExpressionDef 및 LiteralExpressionDef 타입 적합성', () => {
      const binaryDef: BinaryExpressionDef = {
        kind: 'binary',
        left: 3,
        op: '×',
        right: 4,
      };
      const literalDef: LiteralExpressionDef = {
        kind: 'literal',
        value: Rational.of(2, 4),
        label: '2/4',
      };
      const opt: ExpressionEvaluationOptions = {
        requireExactDivision: true,
      };

      expectTypeOf(binaryDef).toMatchTypeOf<ChallengeExpressionDef>();
      expectTypeOf(literalDef).toMatchTypeOf<ChallengeExpressionDef>();
      expectTypeOf(opt).toMatchTypeOf<ExpressionEvaluationOptions>();

      const evalRes: ChallengeExpressionResult = evaluateExpression(binaryDef);
      expectTypeOf(evalRes).toMatchTypeOf<ChallengeExpressionResult>();
      expect(evalRes.label).toBe('3×4');
    });

    it('별칭(alias) 함수 동일성 검증', () => {
      expect(toLabel).toBe(expressionToLabel);
      expect(toValue).toBe(expressionToValue);
      expect(labelLength).toBe(calculateLabelLength);
    });
  });

  // ─── 1. expressionToLabel 라벨 생성 검증 ───
  describe('1. expressionToLabel 라벨 포맷 검증', () => {
    it('기본 4칙 연산 라벨 생성 (×, ÷ 정규화 기호 사용)', () => {
      expect(expressionToLabel({ kind: 'binary', left: 7, op: '+', right: 8 })).toBe('7+8');
      expect(expressionToLabel({ kind: 'binary', left: 9, op: '-', right: 2 })).toBe('9-2');
      expect(expressionToLabel({ kind: 'binary', left: 3, op: '×', right: 4 })).toBe('3×4');
      expect(expressionToLabel({ kind: 'binary', left: 3, op: '*', right: 4 })).toBe('3×4');
      expect(expressionToLabel({ kind: 'binary', left: 8, op: '÷', right: 2 })).toBe('8÷2');
      expect(expressionToLabel({ kind: 'binary', left: 8, op: '/', right: 2 })).toBe('8÷2');
    });

    it('Rational 피연산자가 포함된 이항식 라벨 생성', () => {
      expect(
        expressionToLabel({
          kind: 'binary',
          left: Rational.of(1, 2),
          op: '+',
          right: Rational.of(1, 4),
        }),
      ).toBe('1/2+1/4');
    });

    it('Literal 수식 라벨 (라벨 명시 시 우선 유지)', () => {
      expect(
        expressionToLabel({
          kind: 'literal',
          value: Rational.of(2, 4),
          label: '2/4',
        }),
      ).toBe('2/4');

      expect(
        expressionToLabel({
          kind: 'literal',
          value: Rational.of(1, 2),
        }),
      ).toBe('1/2');

      expect(
        expressionToLabel({
          kind: 'literal',
          value: 12,
        }),
      ).toBe('12');

      expect(
        expressionToLabel({
          kind: 'literal',
          value: 0.5,
          label: '0.5',
        }),
      ).toBe('0.5');
    });
  });

  // ─── 2. expressionToValue 정확값 산출 검증 ───
  describe('2. expressionToValue 정확값(Rational) 산출 검증', () => {
    it('3×4 -> 12 정확값 산출 [완료 조건 1]', () => {
      const def: ChallengeExpressionDef = { kind: 'binary', left: 3, op: '×', right: 4 };
      const val = expressionToValue(def);
      expect(val.equals(Rational.of(12, 1))).toBe(true);
      expect(val.numerator).toBe(12);
      expect(val.denominator).toBe(1);
    });

    it('2/4 -> 1/2 정확값 산출 [완료 조건 2]', () => {
      const def: ChallengeExpressionDef = {
        kind: 'literal',
        value: Rational.of(2, 4),
        label: '2/4',
      };
      const val = expressionToValue(def);
      expect(val.equals(Rational.of(1, 2))).toBe(true);
      expect(val.numerator).toBe(1);
      expect(val.denominator).toBe(2);
    });

    it('덧셈/뺄셈/나눗셈 정확값 산출', () => {
      expect(expressionToValue({ kind: 'binary', left: 7, op: '+', right: 8 }).equals(Rational.of(15))).toBe(true);
      expect(expressionToValue({ kind: 'binary', left: 9, op: '-', right: 2 }).equals(Rational.of(7))).toBe(true);
      expect(expressionToValue({ kind: 'binary', left: 8, op: '÷', right: 2 }).equals(Rational.of(4))).toBe(true);
    });

    it('0으로 나누기 거부 (throw Error) [완료 조건 3]', () => {
      expect(() => {
        expressionToValue({ kind: 'binary', left: 8, op: '÷', right: 0 });
      }).toThrow(/division by zero/i);

      expect(() => {
        expressionToValue({ kind: 'binary', left: 8, op: '/', right: 0 });
      }).toThrow(/division by zero/i);
    });

    it('나눗셈은 나누어떨어지는 경우만 허용 옵션 (requireExactDivision)', () => {
      // 8 ÷ 2 = 4 (나누어 떨어짐 -> 허용)
      const allowed = expressionToValue(
        { kind: 'binary', left: 8, op: '÷', right: 2 },
        { requireExactDivision: true },
      );
      expect(allowed.equals(Rational.of(4))).toBe(true);

      // 7 ÷ 2 = 3.5 (분모 2, 정수 아님 -> 거부)
      expect(() => {
        expressionToValue(
          { kind: 'binary', left: 7, op: '÷', right: 2 },
          { requireExactDivision: true },
        );
      }).toThrow(/divide evenly/i);
    });
  });

  // ─── 3. calculateLabelLength 라벨 길이 계산 검증 ───
  describe('3. calculateLabelLength 라벨 길이 계산 검증 [완료 조건 4]', () => {
    it('일반 기호 및 유니코드 문자열 길이 정확 산출', () => {
      expect(calculateLabelLength('3×4')).toBe(3);
      expect(calculateLabelLength('2/4')).toBe(3);
      expect(calculateLabelLength('12÷4')).toBe(4);
      expect(calculateLabelLength('0.45')).toBe(4);
      expect(calculateLabelLength('-5')).toBe(2);
    });

    it('문자열이 아닌 입력에 대한 유효성 예외', () => {
      expect(() => calculateLabelLength(null as unknown as string)).toThrow();
      expect(() => calculateLabelLength(undefined as unknown as string)).toThrow();
    });
  });

  // ─── 4. evaluateExpression 통합 산출 및 불변성 검증 ───
  describe('4. evaluateExpression 통합 산출 및 불변성 검증', () => {
    it('구조식에서 label, value, labelLength 동시 반환 및 deepFreeze 검증', () => {
      const def: ChallengeExpressionDef = { kind: 'binary', left: 3, op: '×', right: 4 };
      const res = evaluateExpression(def);

      expect(res.label).toBe('3×4');
      expect(res.value.equals(Rational.of(12))).toBe(true);
      expect(res.labelLength).toBe(3);
      expect(Object.isFrozen(res)).toBe(true);
      expect(Object.isFrozen(res.value)).toBe(true);
    });
  });

  // ─── 5. parseExpressionLabel 안전 파서 검증 ───
  describe('5. parseExpressionLabel 라벨 문자열 안전 파서 [DOC-18 §11.3]', () => {
    describe('5.1 정수 파싱', () => {
      it('"12" -> "12" / 12', () => {
        const res = parseExpressionLabel('12');
        expect(res.label).toBe('12');
        expect(res.value.equals(Rational.of(12))).toBe(true);
        expect(res.labelLength).toBe(2);
        expect(Object.isFrozen(res)).toBe(true);
      });

      it('"-5" -> "-5" / -5', () => {
        const res = parseExpressionLabel('-5');
        expect(res.label).toBe('-5');
        expect(res.value.equals(Rational.of(-5))).toBe(true);
      });
    });

    describe('5.2 소수 파싱', () => {
      it('"0.5" -> "0.5" / 1/2', () => {
        const res = parseExpressionLabel('0.5');
        expect(res.label).toBe('0.5');
        expect(res.value.equals(Rational.of(1, 2))).toBe(true);
      });

      it('"0.45" -> "0.45" / 9/20', () => {
        const res = parseExpressionLabel('0.45');
        expect(res.label).toBe('0.45');
        expect(res.value.equals(Rational.of(9, 20))).toBe(true);
      });

      it('".25" -> ".25" / 1/4', () => {
        const res = parseExpressionLabel('.25');
        expect(res.label).toBe('.25');
        expect(res.value.equals(Rational.of(1, 4))).toBe(true);
      });
    });

    describe('5.3 분수 파싱', () => {
      it('"1/2" -> "1/2" / 1/2', () => {
        const res = parseExpressionLabel('1/2');
        expect(res.label).toBe('1/2');
        expect(res.value.equals(Rational.of(1, 2))).toBe(true);
      });

      it('"2/4" -> "2/4" / 1/2 [완료 조건 2]', () => {
        const res = parseExpressionLabel('2/4');
        expect(res.label).toBe('2/4');
        expect(res.value.equals(Rational.of(1, 2))).toBe(true);
      });

      it('"3/8" -> "3/8" / 3/8', () => {
        const res = parseExpressionLabel('3/8');
        expect(res.label).toBe('3/8');
        expect(res.value.equals(Rational.of(3, 8))).toBe(true);
      });
    });

    describe('5.4 이항식 파싱 (공백 무시)', () => {
      it('" 7 + 8 " -> "7+8" / 15', () => {
        const res = parseExpressionLabel(' 7 + 8 ');
        expect(res.label).toBe('7+8');
        expect(res.value.equals(Rational.of(15))).toBe(true);
      });

      it('"9-2" -> "9-2" / 7', () => {
        const res = parseExpressionLabel('9-2');
        expect(res.label).toBe('9-2');
        expect(res.value.equals(Rational.of(7))).toBe(true);
      });

      it('"4×6" -> "4×6" / 24', () => {
        const res = parseExpressionLabel('4×6');
        expect(res.label).toBe('4×6');
        expect(res.value.equals(Rational.of(24))).toBe(true);
      });

      it('"4*6" -> "4×6" / 24 (* 기호가 ×로 정규화)', () => {
        const res = parseExpressionLabel('4*6');
        expect(res.label).toBe('4×6');
        expect(res.value.equals(Rational.of(24))).toBe(true);
      });

      it('"8÷2" -> "8÷2" / 4', () => {
        const res = parseExpressionLabel('8÷2');
        expect(res.label).toBe('8÷2');
        expect(res.value.equals(Rational.of(4))).toBe(true);
      });

      it('"8/2" -> "8/2" / 4', () => {
        const res = parseExpressionLabel('8/2');
        expect(res.label).toBe('8/2');
        expect(res.value.equals(Rational.of(4))).toBe(true);
      });

      it('소수/음수 피연산자 이항식 지원 ("0.5+0.25", "-3+5")', () => {
        expect(parseExpressionLabel('0.5+0.25').value.equals(Rational.of(3, 4))).toBe(true);
        expect(parseExpressionLabel('-3+5').value.equals(Rational.of(2))).toBe(true);
      });
    });

    describe('5.5 오류 및 보안 거부 검증 (eval/safeEval/0나누기 차단)', () => {
      it('0으로 나누기 예외 발생', () => {
        expect(() => parseExpressionLabel('8÷0')).toThrow(/division by zero/i);
        expect(() => parseExpressionLabel('8/0')).toThrow(/division by zero/i);
        expect(() => parseExpressionLabel('1/0')).toThrow(/division by zero/i);
      });

      it('requireExactDivision 옵션 적용 시 나누어떨어지지 않으면 예외 발생', () => {
        expect(() => parseExpressionLabel('7÷2', { requireExactDivision: true })).toThrow(/divide evenly/i);
        expect(() => parseExpressionLabel('2/4', { requireExactDivision: true })).toThrow(/divide evenly/i);
        expect(parseExpressionLabel('8÷2', { requireExactDivision: true }).value.equals(Rational.of(4))).toBe(true);
      });

      it('빈 문자열 및 공백만 있는 경우 예외', () => {
        expect(() => parseExpressionLabel('')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('   ')).toThrow(/invalid expression label/i);
      });

      it('허용되지 않는 문자열 및 코드 주입 차단 (eval, Function 등)', () => {
        expect(() => parseExpressionLabel('eval("3+4")')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('Function("return 1")()')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('window.alert(1)')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('3++4')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('3+4+5')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('3*')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('*4')).toThrow(/invalid expression label/i);
        expect(() => parseExpressionLabel('foo')).toThrow(/invalid expression label/i);
      });
    });
  });
});
