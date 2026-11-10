/**
 * ChallengeExpression.ts - 챌린지 구조식 라벨·정확값 산출기 및 안전 파서
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4~8, 11.3)
 * @see Issue #652 [ASSAULT-CHALLENGE-CH-07]
 *
 * 책임 레이어: Question
 * 1. 구조식 { left, op, right } / Literal(분수, 소수, 정수)에서 화면 라벨과 Rational 정확값 동시 산출.
 * 2. 화면 표시 라벨은 곱셈(×), 나눗셈(÷), 분수(a/b) 표준 기호 사용.
 * 3. 라벨 문자열 안전 파서: 정수, 소수, 분수, 이항식(+, -, ×, ÷, *, /)을 eval/Function/safeEval 일체 없이 안전 파싱.
 * 4. 0으로 나누기 차단, requireExactDivision(나누어떨어짐) 옵션 지원.
 * 5. 유니코드 및 기호 고려 라벨 길이 산출.
 * 6. 결과 객체 deepFreeze 불변성 보장, 순수 함수(Math.random/Date.now/DOM/Canvas/localStorage 배제).
 */

import { Rational } from '../../utils/Rational.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/** 허용되는 이항 연산자 타입 */
export type ChallengeBinaryOp = '+' | '-' | '×' | '÷' | '*' | '/';

/** 정규화된 표준 이항 연산자 타입 */
export type CanonicalBinaryOp = '+' | '-' | '×' | '÷';

/** 이항식 구조식 정의 */
export interface BinaryExpressionDef {
  readonly kind: 'binary';
  readonly left: number | Rational;
  readonly op: ChallengeBinaryOp;
  readonly right: number | Rational;
}

/** 리터럴(단일 값) 구조식 정의 */
export interface LiteralExpressionDef {
  readonly kind: 'literal';
  readonly value: number | Rational;
  /** 명시적 표시 포맷 (소수 자릿수, 분수 형태 유지 등) */
  readonly label?: string;
}

/** 챌린지 수식 정의 유니온 */
export type ChallengeExpressionDef = BinaryExpressionDef | LiteralExpressionDef;

/** 수식 평가 옵션 */
export interface ExpressionEvaluationOptions {
  /** 나눗셈 결과가 정수(분모 1)여야만 하는지 여부 (기본값: false) */
  readonly requireExactDivision?: boolean;
}

/** 수식 산출 결과 인터페이스 */
export interface ChallengeExpressionResult {
  readonly label: string;
  readonly value: Rational;
  readonly labelLength: number;
}

/**
 * 이항 연산자를 표준 기호('+', '-', '×', '÷')로 정규화
 */
function canonicalizeOp(op: ChallengeBinaryOp): CanonicalBinaryOp {
  switch (op) {
    case '+':
      return '+';
    case '-':
      return '-';
    case '*':
    case '×':
      return '×';
    case '/':
    case '÷':
      return '÷';
    default:
      throw new Error(`Unsupported binary operator: ${String(op)}`);
  }
}

/**
 * 피연산자를 문자열 라벨로 변환
 */
function operandToLabel(val: number | Rational): string {
  if (val instanceof Rational) {
    return val.toFractionLabel();
  }
  return String(val);
}

/**
 * 피연산자를 불변 Rational 인스턴스로 변환
 */
function operandToRational(val: number | Rational): Rational {
  if (val instanceof Rational) {
    return val;
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new RangeError(`Rational: operand must be a finite number (got ${String(val)})`);
    }
    if (Number.isInteger(val)) {
      return Rational.of(val, 1);
    }
    return Rational.fromDecimalString(String(val));
  }
  throw new TypeError(`Invalid operand type: ${typeof val}`);
}

/**
 * 수식 구조식에서 화면 표시 라벨을 생성
 * - 곱셈은 ×, 나눗셈은 ÷ 기호 사용
 * - Literal 수식에 label이 제공된 경우 우선 보존
 */
export function expressionToLabel(def: ChallengeExpressionDef): string {
  if (def.kind === 'literal') {
    if (def.label !== undefined) {
      return def.label;
    }
    return operandToLabel(def.value);
  }

  const leftLabel = operandToLabel(def.left);
  const op = canonicalizeOp(def.op);
  const rightLabel = operandToLabel(def.right);
  return `${leftLabel}${op}${rightLabel}`;
}

/**
 * 수식 구조식에서 정확한 Rational 값을 계산
 * - 0으로 나누기 거부 (throw RangeError)
 * - requireExactDivision 활성화 시 나누어 떨어지지 않으면 거부
 */
export function expressionToValue(
  def: ChallengeExpressionDef,
  options?: ExpressionEvaluationOptions,
): Rational {
  if (def.kind === 'literal') {
    return operandToRational(def.value);
  }

  const left = operandToRational(def.left);
  const right = operandToRational(def.right);
  const op = canonicalizeOp(def.op);

  switch (op) {
    case '+':
      return left.add(right);
    case '-':
      return left.sub(right);
    case '×':
      return left.mul(right);
    case '÷': {
      if (right.numerator === 0) {
        throw new RangeError('Division by zero');
      }
      const result = left.div(right);
      if (options?.requireExactDivision && result.denominator !== 1) {
        throw new RangeError('Division must divide evenly (non-integer result)');
      }
      return result;
    }
  }
}

/**
 * 라벨 문자열의 유니코드 고려 길이 계산
 */
export function calculateLabelLength(label: string): number {
  if (typeof label !== 'string') {
    throw new TypeError(`calculateLabelLength: label must be a string (got ${typeof label})`);
  }
  return [...label].length;
}

/**
 * 구조식으로부터 라벨, 값, 라벨 길이를 일괄 계산하고 불변 객체로 반환
 */
export function evaluateExpression(
  def: ChallengeExpressionDef,
  options?: ExpressionEvaluationOptions,
): ChallengeExpressionResult {
  const label = expressionToLabel(def);
  const value = expressionToValue(def, options);
  const labelLength = calculateLabelLength(label);

  return deepFreeze({
    label,
    value,
    labelLength,
  });
}

// ─── 안전 라벨 파서 (문자열 파싱, eval 일체 금지) ───

/** 단일 피연산자 정규식 */
const INTEGER_REGEX = /^[+-]?\d+$/;
const DECIMAL_REGEX = /^[+-]?(?:\d+\.\d+|\.\d+|\d+\.)$/;
const FRACTION_REGEX = /^[+-]?\d+\/\d+$/;

interface ParsedSingleOperand {
  readonly label: string;
  readonly value: Rational;
  readonly isFraction: boolean;
}

/**
 * 단일 숫자 리터럴(정수, 소수, 단순 분수 a/b) 파싱
 */
function parseSingleOperand(str: string): ParsedSingleOperand | null {
  if (INTEGER_REGEX.test(str)) {
    const num = Number(str);
    return {
      label: str,
      value: Rational.of(num, 1),
      isFraction: false,
    };
  }

  if (DECIMAL_REGEX.test(str)) {
    let normalized = str;
    if (normalized.startsWith('.')) {
      normalized = `0${normalized}`;
    } else if (normalized.startsWith('+.')) {
      normalized = `+0${normalized.slice(1)}`;
    } else if (normalized.startsWith('-.')) {
      normalized = `-0${normalized.slice(1)}`;
    }
    const val = Rational.fromDecimalString(normalized);
    return {
      label: str,
      value: val,
      isFraction: false,
    };
  }

  if (FRACTION_REGEX.test(str)) {
    const [numStr, denStr] = str.split('/');
    const den = Number(denStr);
    if (den === 0) {
      throw new RangeError('Invalid expression label: division by zero');
    }
    const val = Rational.of(Number(numStr), den);
    return {
      label: str,
      value: val,
      isFraction: true,
    };
  }

  return null;
}

/**
 * 라벨 문자열을 안전하게 파싱하여 라벨과 Rational 정확값을 산출
 * - 정수: "12", "-5"
 * - 소수: "0.5", "0.45", ".25"
 * - 분수: "1/2", "2/4", "3/8"
 * - 이항식: "7+8", "9-2", "4×6", "4*6", "8÷2", "8/2" (공백 무시)
 * - eval, Function, safeEval 절대 금지 (순수 문자열 검증 및 토큰 분할)
 */
export function parseExpressionLabel(
  rawLabel: string,
  options?: ExpressionEvaluationOptions,
): ChallengeExpressionResult {
  if (typeof rawLabel !== 'string') {
    throw new Error('Invalid expression label: input must be a string');
  }

  const trimmed = rawLabel.replace(/\s+/g, '');
  if (trimmed === '') {
    throw new Error('Invalid expression label: empty input');
  }

  // 1. 단일 리터럴(정수 / 소수 / 분수 a/b) 검사
  const single = parseSingleOperand(trimmed);
  if (single !== null) {
    if (single.isFraction && options?.requireExactDivision && single.value.denominator !== 1) {
      throw new RangeError('Division must divide evenly (non-integer result)');
    }
    return deepFreeze({
      label: single.label,
      value: single.value,
      labelLength: calculateLabelLength(single.label),
    });
  }

  // 2. 이항식 (<left> <op> <right>) 파싱
  // 유효한 이항 연산자 탐색 (인덱스 1부터 시작하여 선행 부호 보호)
  let foundSplit: {
    leftStr: string;
    op: CanonicalBinaryOp;
    rightStr: string;
    normalizedLabel: string;
    val: Rational;
  } | null = null;

  for (let i = 1; i < trimmed.length; i++) {
    const char = trimmed[i];
    let candidateOp: CanonicalBinaryOp | null = null;

    if (char === '+') candidateOp = '+';
    else if (char === '-') candidateOp = '-';
    else if (char === '×' || char === '*') candidateOp = '×';
    else if (char === '÷' || char === '/') candidateOp = '÷';

    if (!candidateOp) continue;

    const leftPart = trimmed.slice(0, i);
    const rightPart = trimmed.slice(i + 1);

    if (leftPart === '' || rightPart === '') continue;
    // 이항식 우측 피연산자는 연속 연산자 방지를 위해 선행 부호 (+, -) 불허
    if (rightPart.startsWith('+') || rightPart.startsWith('-')) continue;

    const leftParsed = parseSingleOperand(leftPart);
    const rightParsed = parseSingleOperand(rightPart);

    if (leftParsed !== null && rightParsed !== null) {
      if (foundSplit !== null) {
        // 다중 연산자 (예: 1+2+3) 등은 허용되지 않음
        throw new Error(`Invalid expression label: multiple operations in "${rawLabel}"`);
      }

      let val: Rational;
      switch (candidateOp) {
        case '+':
          val = leftParsed.value.add(rightParsed.value);
          break;
        case '-':
          val = leftParsed.value.sub(rightParsed.value);
          break;
        case '×':
          val = leftParsed.value.mul(rightParsed.value);
          break;
        case '÷': {
          if (rightParsed.value.numerator === 0) {
            throw new RangeError('Invalid expression label: division by zero');
          }
          val = leftParsed.value.div(rightParsed.value);
          if (options?.requireExactDivision && val.denominator !== 1) {
            throw new RangeError('Division must divide evenly (non-integer result)');
          }
          break;
        }
      }

      const normalizedLabel = `${leftParsed.label}${candidateOp}${rightParsed.label}`;
      foundSplit = {
        leftStr: leftParsed.label,
        op: candidateOp,
        rightStr: rightParsed.label,
        normalizedLabel,
        val,
      };
    }
  }

  if (foundSplit !== null) {
    return deepFreeze({
      label: foundSplit.normalizedLabel,
      value: foundSplit.val,
      labelLength: calculateLabelLength(foundSplit.normalizedLabel),
    });
  }

  throw new Error(`Invalid expression label: "${rawLabel}"`);
}

// ─── 별칭 함수 (Issue #652 계약 일치) ───
export const toLabel = expressionToLabel;
export const toValue = expressionToValue;
export const labelLength = calculateLabelLength;
