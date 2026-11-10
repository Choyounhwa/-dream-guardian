/**
 * ChallengePairValidator.ts - 챌린지 쌍 독립 정답 유일성 검증기
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.4, 5, 11.2, 11.3)
 * @see Issue #657 [ASSAULT-CHALLENGE-CH-12]
 *
 * 책임 레이어: Question
 * 1. 생성기(CH-08~11)와 독립적으로 모든 챌린지 라운드 보기 쌍을 재계산하여 검증한다.
 * 2. 정답 유일성, 라벨 길이, 연속 같은 쪽 제한, 음수/NaN/Infinity, 계열별 술어/규칙 부합 여부를 검증.
 * 3. ChallengeExpression(parseExpressionLabel, calculateLabelLength, Rational)을 활용한 독립 재계산.
 * 4. 예외를 던지지 않고 순수 검증 결과 객체 { isValid, errors }를 deepFreeze하여 반환.
 * 5. 순수 함수 모듈: Math.random/Date.now/DOM/Canvas/localStorage 배제, 문자열 eval/safeEval 절대 금지.
 */

import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../data/assault/challengeCatalog.js';
import type { AssaultChallengeFamily, AssaultChallengeVariantId } from '../../types/assaultChallenge.js';
import type { AssaultAnswerPair, AssaultChoiceItem } from '../AssaultAnswerPairFactory.js';
import {
  parseExpressionLabel,
  calculateLabelLength,
  type ChallengeExpressionResult,
} from './ChallengeExpression.js';
import { Rational } from '../../utils/Rational.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

// ─── 1. 오류 코드 및 인터페이스 계약 ───

export type ChallengePairValidationErrorCode =
  | 'LABEL_TOO_LONG'
  | 'NO_UNIQUE_CORRECT'
  | 'CONSECUTIVE_SAME_SIDE_EXCEEDED'
  | 'NEGATIVE_OR_NAN'
  | 'DUPLICATE_CHOICES'
  | 'DUPLICATE_ROUND_ANSWERS'
  | 'RULE_VIOLATION';

export interface ChallengePairValidationError {
  readonly code: ChallengePairValidationErrorCode;
  readonly message: string;
  readonly pairIndex?: number;
  readonly side?: 'left' | 'right';
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ChallengePairValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ChallengePairValidationError[];
}

export interface ValidateChallengeRoundOptions {
  readonly maxLabelChars?: number;
  readonly maxConsecutiveSameSide?: number;
}

export interface ValidateChallengeRoundParams {
  readonly variantId: string;
  readonly family: AssaultChallengeFamily;
  readonly questionText?: string;
  readonly pairPrompts?: readonly (string | null)[];
  readonly params?: Readonly<Record<string, number>>;
  readonly pairs: readonly AssaultAnswerPair[];
  readonly options?: ValidateChallengeRoundOptions;
}

// ─── 2. 내부 보조 파서 함수 (순수) ───

function extractNumber(text: string | undefined, regex: RegExp): number | undefined {
  if (!text) return undefined;
  const match = text.match(regex);
  if (!match || !match[1]) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parseChoiceRational(
  choice: AssaultChoiceItem,
  pairIndex: number,
  side: 'left' | 'right',
  errors: ChallengePairValidationError[],
): ChallengeExpressionResult | null {
  if (typeof choice.value !== 'number' || Number.isNaN(choice.value) || !Number.isFinite(choice.value) || choice.value < 0) {
    errors.push({
      code: 'NEGATIVE_OR_NAN',
      message: `Choice value must be a non-negative finite number (got ${choice.value})`,
      pairIndex,
      side,
    });
  }

  if (typeof choice.text !== 'string') {
    errors.push({
      code: 'NEGATIVE_OR_NAN',
      message: `Choice text must be a string (got ${typeof choice.text})`,
      pairIndex,
      side,
    });
    return null;
  }

  try {
    const parsed = parseExpressionLabel(choice.text);
    const num = parsed.value.numerator / parsed.value.denominator;
    if (parsed.value.numerator < 0 || parsed.value.denominator <= 0 || Number.isNaN(num) || !Number.isFinite(num)) {
      errors.push({
        code: 'NEGATIVE_OR_NAN',
        message: `Parsed expression value is negative or non-finite: "${choice.text}"`,
        pairIndex,
        side,
      });
    }
    return parsed;
  } catch (err) {
    errors.push({
      code: 'NEGATIVE_OR_NAN',
      message: `Failed to parse choice expression: "${choice.text}" (${err instanceof Error ? err.message : String(err)})`,
      pairIndex,
      side,
    });
    return null;
  }
}

// ─── 3. 메인 검증기 함수 ───

export function validateChallengeRound(input: ValidateChallengeRoundParams): ChallengePairValidationResult {
  const errors: ChallengePairValidationError[] = [];

  // 1. 기본 인자 검증
  if (!input || typeof input !== 'object') {
    errors.push({
      code: 'RULE_VIOLATION',
      message: 'Input parameters must be an object',
    });
    return deepFreeze({ isValid: false, errors });
  }

  const maxLabelChars = input.options?.maxLabelChars ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars;
  const maxConsecutiveSameSide =
    input.options?.maxConsecutiveSameSide ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide;

  const { variantId, family, pairs } = input;

  if (!Array.isArray(pairs) || pairs.length === 0) {
    errors.push({
      code: 'RULE_VIOLATION',
      message: 'pairs must be a non-empty array',
    });
    return deepFreeze({ isValid: false, errors });
  }

  // 2. 카탈로그 정합성 검증
  const catalogDef = ASSAULT_CHALLENGE_CATALOG[variantId as AssaultChallengeVariantId];
  if (catalogDef) {
    if (catalogDef.family !== family) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `variantId "${variantId}" belongs to family "${catalogDef.family}", but received family "${family}"`,
      });
    }
    if (pairs.length < catalogDef.minPairs) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Pair count (${pairs.length}) is less than minPairs (${catalogDef.minPairs}) for variant "${variantId}"`,
      });
    }
  }

  // 3. 라운드 차원 상태 추적
  const seenCorrectLabels = new Set<string>();
  let consecutiveSameSideCount = 0;
  let lastSide: 'left' | 'right' | null = null;

  // 4. 쌍별(Pair-level) 기본 검증
  const parsedPairs: Array<{
    leftParsed: ChallengeExpressionResult | null;
    rightParsed: ChallengeExpressionResult | null;
  }> = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (!pair || !pair.left || !pair.right) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Missing pair or choices at index ${i}`,
        pairIndex: i,
      });
      parsedPairs.push({ leftParsed: null, rightParsed: null });
      continue;
    }

    // 4.1 라벨 길이 검증 (LABEL_TOO_LONG)
    if (typeof pair.left.text === 'string' && calculateLabelLength(pair.left.text) > maxLabelChars) {
      errors.push({
        code: 'LABEL_TOO_LONG',
        message: `Left label "${pair.left.text}" length (${calculateLabelLength(pair.left.text)}) exceeds maxLabelChars (${maxLabelChars})`,
        pairIndex: i,
        side: 'left',
      });
    }
    if (typeof pair.right.text === 'string' && calculateLabelLength(pair.right.text) > maxLabelChars) {
      errors.push({
        code: 'LABEL_TOO_LONG',
        message: `Right label "${pair.right.text}" length (${calculateLabelLength(pair.right.text)}) exceeds maxLabelChars (${maxLabelChars})`,
        pairIndex: i,
        side: 'right',
      });
    }

    // 4.2 수치 파싱 및 음수/NaN 검증 (NEGATIVE_OR_NAN)
    const leftParsed = parseChoiceRational(pair.left, i, 'left', errors);
    const rightParsed = parseChoiceRational(pair.right, i, 'right', errors);
    parsedPairs.push({ leftParsed, rightParsed });

    // 4.3 좌우 중복 검증 (DUPLICATE_CHOICES)
    if (pair.left.text === pair.right.text) {
      errors.push({
        code: 'DUPLICATE_CHOICES',
        message: `Left and right choices have identical text "${pair.left.text}" at pair ${i}`,
        pairIndex: i,
      });
    } else if (leftParsed && rightParsed && leftParsed.value.equals(rightParsed.value)) {
      errors.push({
        code: 'DUPLICATE_CHOICES',
        message: `Left ("${pair.left.text}") and right ("${pair.right.text}") have identical mathematical value at pair ${i}`,
        pairIndex: i,
      });
    }

    // 4.4 정답 플래그 및 correctSide 일치 검증 (NO_UNIQUE_CORRECT)
    const numCorrectFlags = (pair.left.isCorrect ? 1 : 0) + (pair.right.isCorrect ? 1 : 0);
    if (numCorrectFlags !== 1) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Expected exactly 1 correct choice in pair ${i}, but found ${numCorrectFlags}`,
        pairIndex: i,
      });
    }

    if (pair.correctSide !== 'left' && pair.correctSide !== 'right') {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Invalid correctSide "${String(pair.correctSide)}" at pair ${i}`,
        pairIndex: i,
      });
    } else {
      const activeChoice = pair.correctSide === 'left' ? pair.left : pair.right;
      if (!activeChoice.isCorrect) {
        errors.push({
          code: 'NO_UNIQUE_CORRECT',
          message: `correctSide is "${pair.correctSide}" but choice isCorrect is false at pair ${i}`,
          pairIndex: i,
          side: pair.correctSide,
        });
      }

      // 4.5 연속 같은 쪽 제한 검증 (CONSECUTIVE_SAME_SIDE_EXCEEDED)
      if (pair.correctSide === lastSide) {
        consecutiveSameSideCount++;
      } else {
        consecutiveSameSideCount = 1;
        lastSide = pair.correctSide;
      }

      if (consecutiveSameSideCount > maxConsecutiveSameSide) {
        errors.push({
          code: 'CONSECUTIVE_SAME_SIDE_EXCEEDED',
          message: `Consecutive "${pair.correctSide}" answers reached ${consecutiveSameSideCount}, exceeding limit (${maxConsecutiveSameSide}) at pair ${i}`,
          pairIndex: i,
          side: pair.correctSide,
          details: { consecutiveCount: consecutiveSameSideCount, maxConsecutiveSameSide },
        });
      }

      // 4.6 라운드 내 정답 표현 중복 검증 (DUPLICATE_ROUND_ANSWERS)
      if (seenCorrectLabels.has(activeChoice.text)) {
        errors.push({
          code: 'DUPLICATE_ROUND_ANSWERS',
          message: `Duplicate correct answer expression "${activeChoice.text}" found in round at pair ${i}`,
          pairIndex: i,
          side: pair.correctSide,
        });
      }
      seenCorrectLabels.add(activeChoice.text);
    }
  }

  // 5. 계열별 수학적 술어 및 규칙 독립 재검증 (RULE_VIOLATION / NO_UNIQUE_CORRECT)
  validateFamilyRules(input, parsedPairs, errors);

  return deepFreeze({
    isValid: errors.length === 0,
    errors,
  });
}

// ─── 4. 계열별 수학적 술어 검증 디스패처 ───

function validateFamilyRules(
  input: ValidateChallengeRoundParams,
  parsedPairs: Array<{
    leftParsed: ChallengeExpressionResult | null;
    rightParsed: ChallengeExpressionResult | null;
  }>,
  errors: ChallengePairValidationError[],
): void {
  const { family, variantId } = input;

  switch (family) {
    case 'rule_hunt':
      validateRuleHunt(input, parsedPairs, errors);
      break;
    case 'duel':
      validateDuel(input, parsedPairs, errors);
      break;
    case 'equivalence':
      validateEquivalence(input, parsedPairs, errors);
      break;
    case 'progression':
      validateProgression(input, parsedPairs, errors);
      break;
    default:
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Unsupported challenge family "${family}" for variant "${variantId}"`,
      });
      break;
  }
}

// ─── 5. 계열별 상세 검증 로직 ───

/** A 계열: 규칙 사냥 */
function validateRuleHunt(
  input: ValidateChallengeRoundParams,
  parsedPairs: Array<{
    leftParsed: ChallengeExpressionResult | null;
    rightParsed: ChallengeExpressionResult | null;
  }>,
  errors: ChallengePairValidationError[],
): void {
  const { variantId, questionText, params, pairs } = input;
  let predicate: ((val: number) => boolean) | null = null;
  let ruleName = '';

  if (variantId === 'A1_times_table') {
    const k = params?.k ?? extractNumber(questionText, /(\d+)단/);
    if (!k || !Number.isInteger(k) || k < 2 || k > 9) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing parameter k for A1_times_table: ${k}`,
      });
      return;
    }
    ruleName = `${k}단 배수`;
    predicate = (v: number) => Number.isInteger(v) && v > 0 && v % k === 0;
  } else if (variantId === 'A2_parity') {
    let parity = params?.parity;
    if (parity === undefined && questionText) {
      parity = questionText.includes('짝수') ? 0 : questionText.includes('홀수') ? 1 : undefined;
    }
    if (parity !== 0 && parity !== 1) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing parameter parity for A2_parity: ${parity}`,
      });
      return;
    }
    ruleName = parity === 0 ? '짝수' : '홀수';
    predicate = (v: number) => Number.isInteger(v) && v > 0 && (v % 2 === 0 ? 0 : 1) === parity;
  } else if (variantId === 'A3_range') {
    const lo = params?.lo ?? params?.rangeLo ?? extractNumber(questionText, /(\d+)\s*와/);
    const hi =
      params?.hi ??
      (params?.rangeLo !== undefined && params?.rangeSpan !== undefined
        ? params.rangeLo + params.rangeSpan
        : extractNumber(questionText, /와\s*(\d+)\s*사이/));
    if (lo === undefined || hi === undefined || !Number.isInteger(lo) || !Number.isInteger(hi) || lo >= hi - 1) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing range parameters for A3_range: [lo: ${lo}, hi: ${hi}]`,
      });
      return;
    }
    ruleName = `${lo}와 ${hi} 사이`;
    predicate = (v: number) => Number.isInteger(v) && v > lo && v < hi;
  } else if (variantId === 'A4_multiple') {
    const k = params?.k ?? extractNumber(questionText, /(\d+)의\s*배수/);
    if (!k || !Number.isInteger(k) || k < 2) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing parameter k for A4_multiple: ${k}`,
      });
      return;
    }
    ruleName = `${k}의 배수`;
    predicate = (v: number) => Number.isInteger(v) && v > 0 && v % k === 0;
  } else {
    errors.push({
      code: 'RULE_VIOLATION',
      message: `Unsupported variantId "${variantId}" in family "rule_hunt"`,
    });
    return;
  }

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const { leftParsed, rightParsed } = parsedPairs[i];
    if (!leftParsed || !rightParsed) continue;

    const leftNum =
      leftParsed.value.denominator === 1
        ? leftParsed.value.numerator
        : leftParsed.value.numerator / leftParsed.value.denominator;
    const rightNum =
      rightParsed.value.denominator === 1
        ? rightParsed.value.numerator
        : rightParsed.value.numerator / rightParsed.value.denominator;

    const leftSatisfies = predicate(leftNum);
    const rightSatisfies = predicate(rightNum);

    if (leftSatisfies && rightSatisfies) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Both left (${leftNum}) and right (${rightNum}) satisfy predicate "${ruleName}" at pair ${i}`,
        pairIndex: i,
      });
    } else if (!leftSatisfies && !rightSatisfies) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Neither left (${leftNum}) nor right (${rightNum}) satisfies predicate "${ruleName}" at pair ${i}`,
        pairIndex: i,
      });
    } else {
      const expectedSide: 'left' | 'right' = leftSatisfies ? 'left' : 'right';
      if (pair.correctSide !== expectedSide) {
        errors.push({
          code: 'RULE_VIOLATION',
          message: `Predicate violation at pair ${i}: designated correctSide is "${pair.correctSide}", but only "${expectedSide}" satisfies "${ruleName}"`,
          pairIndex: i,
          side: pair.correctSide,
        });
      }
    }
  }
}

/** B 계열: 대결 */
function validateDuel(
  input: ValidateChallengeRoundParams,
  parsedPairs: Array<{
    leftParsed: ChallengeExpressionResult | null;
    rightParsed: ChallengeExpressionResult | null;
  }>,
  errors: ChallengePairValidationError[],
): void {
  const { questionText, pairs } = input;
  const direction: 'max' | 'min' = questionText?.includes('작은') ? 'min' : 'max';

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const { leftParsed, rightParsed } = parsedPairs[i];
    if (!leftParsed || !rightParsed) continue;

    const cmp = leftParsed.value.compare(rightParsed.value);
    if (cmp === 0) {
      // 좌우 동일 값은 DUPLICATE_CHOICES에서 이미 보고되었거나 여기서 추가
      continue;
    }

    const expectedSide: 'left' | 'right' = direction === 'max' ? (cmp > 0 ? 'left' : 'right') : (cmp < 0 ? 'left' : 'right');

    if (pair.correctSide !== expectedSide) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Duel direction violation at pair ${i}: expected "${expectedSide}" (${direction}), but got "${pair.correctSide}"`,
        pairIndex: i,
        side: pair.correctSide,
      });
    }
  }
}

/** C 계열: 같은 값 찾기 */
function validateEquivalence(
  input: ValidateChallengeRoundParams,
  parsedPairs: Array<{
    leftParsed: ChallengeExpressionResult | null;
    rightParsed: ChallengeExpressionResult | null;
  }>,
  errors: ChallengePairValidationError[],
): void {
  const { variantId, questionText, params, pairs } = input;
  let targetRational: Rational | null = null;
  let targetLabel = '';

  if (variantId === 'C1_make_target') {
    const t = params?.target ?? extractNumber(questionText, /(\d+)(?:을|를)\s*만들어라/);
    if (!t || !Number.isInteger(t) || t < 2) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing target for C1_make_target: ${t}`,
      });
      return;
    }
    targetLabel = String(t);
    targetRational = Rational.of(t, 1);
  } else if (variantId === 'C2_equivalent') {
    const kind = params?.targetKind;
    if (kind === 1) {
      targetLabel = '1/2';
      targetRational = Rational.of(1, 2);
    } else if (kind === 2) {
      targetLabel = '1/4';
      targetRational = Rational.of(1, 4);
    } else if (kind === 3) {
      targetLabel = '3/4';
      targetRational = Rational.of(3, 4);
    } else if (questionText) {
      const match = questionText.match(/([0-9/.]+)\s*과\s*같은/);
      if (match && match[1]) {
        targetLabel = match[1];
        try {
          targetRational = parseExpressionLabel(targetLabel).value;
        } catch {
          targetRational = null;
        }
      }
    }
    if (!targetRational) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing target for C2_equivalent (kind: ${kind}, text: "${questionText}")`,
      });
      return;
    }
  } else if (variantId === 'C3_make_ten') {
    targetLabel = '10';
    targetRational = Rational.of(10, 1);
  } else {
    errors.push({
      code: 'RULE_VIOLATION',
      message: `Unsupported variantId "${variantId}" in family "equivalence"`,
    });
    return;
  }

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const { leftParsed, rightParsed } = parsedPairs[i];
    if (!leftParsed || !rightParsed) continue;

    const leftMatches = leftParsed.value.equals(targetRational);
    const rightMatches = rightParsed.value.equals(targetRational);

    if (leftMatches && rightMatches) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Both left and right equal target value "${targetLabel}" at pair ${i}`,
        pairIndex: i,
      });
    } else if (!leftMatches && !rightMatches) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Neither left nor right equals target value "${targetLabel}" at pair ${i}`,
        pairIndex: i,
      });
    } else {
      const expectedSide: 'left' | 'right' = leftMatches ? 'left' : 'right';
      if (pair.correctSide !== expectedSide) {
        errors.push({
          code: 'RULE_VIOLATION',
          message: `Target equivalence violation at pair ${i}: correctSide is "${pair.correctSide}", but only "${expectedSide}" equals target "${targetLabel}"`,
          pairIndex: i,
          side: pair.correctSide,
        });
      }
    }
  }
}

/** D 계열: 진행 */
function validateProgression(
  input: ValidateChallengeRoundParams,
  parsedPairs: Array<{
    leftParsed: ChallengeExpressionResult | null;
    rightParsed: ChallengeExpressionResult | null;
  }>,
  errors: ChallengePairValidationError[],
): void {
  const { variantId, questionText, pairPrompts, params, pairs } = input;
  let start: number | undefined;
  let step: number | undefined;
  const sequence: number[] = [];

  if (variantId === 'D1_skip_count') {
    start = params?.start ?? extractNumber(questionText, /(\d+)부터/);
    step = params?.step ?? extractNumber(questionText, /(\d+)씩\s*뛰어라/);
    if (start === undefined || step === undefined || !Number.isInteger(start) || !Number.isInteger(step) || start < 1 || step < 1) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing parameters for D1_skip_count: start=${start}, step=${step}`,
      });
      return;
    }
    for (let i = 0; i < pairs.length; i++) {
      sequence.push(start + step * (i + 1));
    }
  } else if (variantId === 'D2_countdown') {
    start = params?.start ?? extractNumber(questionText, /(\d+)(?:에서|부터)/);
    step = params?.step ?? extractNumber(questionText, /(\d+)씩\s*(?:빼라|내려라)/);
    if (start === undefined || step === undefined || !Number.isInteger(start) || !Number.isInteger(step) || start < 1 || step < 1) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing parameters for D2_countdown: start=${start}, step=${step}`,
      });
      return;
    }
    for (let i = 0; i < pairs.length; i++) {
      const val = start - step * (i + 1);
      sequence.push(val);
    }
  } else if (variantId === 'D3_doubling') {
    start = params?.start ?? extractNumber(questionText, /(\d+)(?:부터|에서)/);
    if (start === undefined || !Number.isInteger(start) || start < 1) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `Invalid or missing start parameter for D3_doubling: start=${start}`,
      });
      return;
    }
    for (let i = 0; i < pairs.length; i++) {
      sequence.push(start * Math.pow(2, i + 1));
    }
  } else {
    errors.push({
      code: 'RULE_VIOLATION',
      message: `Unsupported variantId "${variantId}" in family "progression"`,
    });
    return;
  }

  // 1. 수열 값 일치 검증
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const { leftParsed, rightParsed } = parsedPairs[i];
    if (!leftParsed || !rightParsed) continue;

    const expectedVal = sequence[i];
    const expectedRational = Rational.of(expectedVal, 1);

    const leftMatches = leftParsed.value.equals(expectedRational);
    const rightMatches = rightParsed.value.equals(expectedRational);

    if (leftMatches && rightMatches) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Both left and right equal expected sequence term ${expectedVal} at pair ${i}`,
        pairIndex: i,
      });
    } else if (!leftMatches && !rightMatches) {
      errors.push({
        code: 'NO_UNIQUE_CORRECT',
        message: `Neither left nor right equals expected sequence term ${expectedVal} at pair ${i}`,
        pairIndex: i,
      });
    } else {
      const expectedSide: 'left' | 'right' = leftMatches ? 'left' : 'right';
      if (pair.correctSide !== expectedSide) {
        errors.push({
          code: 'RULE_VIOLATION',
          message: `Progression sequence violation at pair ${i}: expected term ${expectedVal} on "${expectedSide}", but got correctSide "${pair.correctSide}"`,
          pairIndex: i,
          side: pair.correctSide,
        });
      }
    }
  }

  // 2. pairPrompts 검증 (제공된 경우)
  if (pairPrompts !== undefined) {
    if (pairPrompts.length !== pairs.length) {
      errors.push({
        code: 'RULE_VIOLATION',
        message: `pairPrompts length (${pairPrompts.length}) does not match pairs length (${pairs.length})`,
      });
    } else {
      for (let i = 0; i < pairs.length; i++) {
        const prompt = pairPrompts[i];
        if (prompt === null || prompt === undefined) continue;
        const prefix = [start, ...sequence.slice(0, i)];
        const expectedPrompt = `${prefix.join(' → ')} → ?`;
        if (prompt !== expectedPrompt) {
          errors.push({
            code: 'RULE_VIOLATION',
            message: `pairPrompts mismatch at pair ${i}: expected "${expectedPrompt}", but got "${prompt}"`,
            pairIndex: i,
          });
        }
      }
    }
  }
}
