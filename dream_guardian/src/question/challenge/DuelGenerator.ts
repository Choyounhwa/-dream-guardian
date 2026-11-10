/**
 * DuelGenerator.ts - B 대결 계열 쌍 생성기
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 5, 11.2)
 * @see Issue #654 [ASSAULT-CHALLENGE-CH-09]
 *
 * 책임 레이어: Question
 * 1. B 계열 4개 유형(B1_addsub_duel, B2_mul_duel, B3_fraction_duel, B4_decimal_duel)의 보기 쌍 생성 순수 함수.
 * 2. 방향(direction: 'max' | 'min')에 맞춰 정답 판정.
 * 3. ChallengeExpression (Rational, evaluateExpression 등)을 활용한 안전한 라벨 및 정확값 산출.
 * 4. 함정 규칙(소수 자릿수 길이 함정, 분모 크기 함정, 작은 값 차이) 반영.
 * 5. Seed 기반 결정론적 난수(createSeededRng) 사용, Math.random / Date.now 일체 배제.
 * 6. maxConsecutiveSameSide (최대 3회 연속 같은 쪽) 제약 준수.
 * 7. 반환 결과 deepFreeze 동결.
 */

import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../data/assault/challengeCatalog.js';
import type { AssaultAnswerSide } from '../../types/assault.js';
import type { AssaultAnswerPair, AssaultChoiceItem } from '../AssaultAnswerPairFactory.js';
import {
  evaluateExpression,
  type ChallengeExpressionResult,
} from './ChallengeExpression.js';
import { Rational } from '../../utils/Rational.js';
import { deepFreeze } from '../../utils/deepFreeze.js';
import { createSeededRng, nextInt, pickOne, type SeededRng } from '../../utils/seededRng.js';

/** B 계열 유형 식별자 */
export type DuelVariantId =
  | 'B1_addsub_duel'
  | 'B2_mul_duel'
  | 'B3_fraction_duel'
  | 'B4_decimal_duel';

/** B 계열 생성 요청 파라미터 */
export interface DuelGenerateParams {
  readonly variantId: DuelVariantId;
  readonly pairCount: number; // 2 이상
  readonly seed: number;
  readonly direction?: 'max' | 'min'; // 기본값 'max'
  /** 선택적 규칙 파라미터 */
  readonly params?: Readonly<Record<string, number>>;
}

/** B 계열 라운드 생성 결과 */
export interface DuelRoundResult {
  readonly variantId: string;
  readonly family: 'duel';
  readonly questionText: string;
  readonly direction: 'max' | 'min';
  readonly params: Readonly<Record<string, number>>;
  readonly pairs: readonly AssaultAnswerPair[];
}

/** 지원되는 B 계열 유형 집합 */
const SUPPORTED_VARIANT_IDS = new Set<string>([
  'B1_addsub_duel',
  'B2_mul_duel',
  'B3_fraction_duel',
  'B4_decimal_duel',
]);

/**
 * B1 덧셈/뺄셈 식 생성 헬퍼
 */
function generateAddSubExpr(
  rng: SeededRng,
  maxVal: number,
  scale: number,
): ChallengeExpressionResult {
  const scaledMax = Math.max(10, Math.floor(maxVal * scale));
  const isAdd = rng() < 0.6; // 60% 덧셈, 40% 뺄셈

  if (isAdd) {
    const sum = nextInt(rng, 5, scaledMax);
    const left = nextInt(rng, 1, sum - 1);
    const right = sum - left;
    return evaluateExpression({
      kind: 'binary',
      left,
      op: '+',
      right,
    });
  } else {
    const left = nextInt(rng, 5, scaledMax);
    const right = nextInt(rng, 1, left - 1);
    return evaluateExpression({
      kind: 'binary',
      left,
      op: '-',
      right,
    });
  }
}

/**
 * B2 곱셈 식 생성 헬퍼
 */
function generateMulExpr(
  rng: SeededRng,
  maxFactor: number,
  scale: number,
): ChallengeExpressionResult {
  const scaledFactor = Math.max(3, Math.floor(maxFactor * scale));
  const left = nextInt(rng, 2, scaledFactor);
  const right = nextInt(rng, 2, scaledFactor);
  return evaluateExpression({
    kind: 'binary',
    left,
    op: '×',
    right,
  });
}

/**
 * B3 분수 리터럴 생성 헬퍼
 */
function generateFractionExpr(
  rng: SeededRng,
  maxDenom: number,
  scale: number,
): ChallengeExpressionResult {
  const scaledDenom = Math.min(12, Math.max(2, Math.floor(maxDenom * scale)));
  const denom = nextInt(rng, 2, scaledDenom);
  const numer = nextInt(rng, 1, denom - 1); // 진분수
  const r = Rational.of(numer, denom);
  return evaluateExpression({
    kind: 'literal',
    value: r,
    label: `${numer}/${denom}`,
  });
}

/**
 * B4 소수 리터럴 생성 헬퍼
 */
function generateDecimalExpr(
  rng: SeededRng,
  precision: number,
  scale: number,
): ChallengeExpressionResult {
  // 소수점 1~2자리
  const prec = precision === 1 && rng() < 0.5 ? 1 : 2;
  const intPart = nextInt(rng, 0, Math.floor(5 * scale));
  let fracPart: number;
  let label: string;

  if (prec === 1) {
    fracPart = nextInt(rng, 1, 9);
    label = `${intPart}.${fracPart}`;
  } else {
    fracPart = nextInt(rng, 1, 99);
    const fracStr = fracPart < 10 ? `0${fracPart}` : `${fracPart}`;
    label = `${intPart}.${fracStr}`;
  }

  const r = Rational.fromDecimalString(label);
  return evaluateExpression({
    kind: 'literal',
    value: r,
    label,
  });
}

/**
 * 두 값의 차이가 diffRange 이내인지 검사
 */
function isDiffInRange(val1: Rational, val2: Rational, minDiff: number, maxDiff: number): boolean {
  const diff = Math.abs(val1.numerator / val1.denominator - val2.numerator / val2.denominator);
  return diff >= minDiff - 1e-9 && diff <= maxDiff + 1e-9;
}

/**
 * B 대결 계열 문제 및 보기 쌍들을 결정론적으로 생성한다.
 */
export function generateDuelRound(options: DuelGenerateParams): DuelRoundResult {
  if (!options || typeof options !== 'object') {
    throw new Error('[DuelGenerator] options must be a valid object');
  }

  const { variantId, pairCount, seed, direction = 'max', params } = options;

  // 1. variantId 검증
  if (!SUPPORTED_VARIANT_IDS.has(variantId)) {
    throw new Error(`[DuelGenerator] Unsupported variantId: "${variantId}"`);
  }

  // 2. pairCount 검증
  if (typeof pairCount !== 'number' || !Number.isInteger(pairCount)) {
    throw new Error(`[DuelGenerator] pairCount must be an integer: ${pairCount}`);
  }
  if (pairCount < 2) {
    throw new Error(`[DuelGenerator] pairCount must be at least 2: ${pairCount}`);
  }

  // 3. seed 검증
  if (typeof seed !== 'number' || !Number.isInteger(seed)) {
    throw new Error(`[DuelGenerator] seed must be an integer: ${seed}`);
  }

  // 4. direction 검증
  if (direction !== 'max' && direction !== 'min') {
    throw new Error(`[DuelGenerator] Invalid direction: "${String(direction)}". Expected 'max' | 'min'.`);
  }

  const rng = createSeededRng(seed);
  const cfg = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
  const trapRules = cfg.familyTrapRules.duel;
  const [minDiff, maxDiff] = trapRules.diffRange;
  const { maxConsecutiveSameSide, maxLabelChars, pairIndexDifficultyScale } = cfg;

  // 5. 유형별 파라미터 결정 및 검증
  let resolvedParams: Record<string, number> = {};

  switch (variantId) {
    case 'B1_addsub_duel': {
      let maxVal: number;
      if (params && params.maxVal !== undefined) {
        maxVal = params.maxVal;
        if (!Number.isInteger(maxVal) || maxVal < 10 || maxVal > 50) {
          throw new Error(`[DuelGenerator] Invalid maxVal for B1_addsub_duel: ${maxVal}. Expected integer in [10, 50].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.B1_addsub_duel.params.maxVal;
        maxVal = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { maxVal };
      break;
    }

    case 'B2_mul_duel': {
      let maxFactor: number;
      if (params && params.maxFactor !== undefined) {
        maxFactor = params.maxFactor;
        if (!Number.isInteger(maxFactor) || maxFactor < 3 || maxFactor > 9) {
          throw new Error(`[DuelGenerator] Invalid maxFactor for B2_mul_duel: ${maxFactor}. Expected integer in [3, 9].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.B2_mul_duel.params.maxFactor;
        maxFactor = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { maxFactor };
      break;
    }

    case 'B3_fraction_duel': {
      let maxDenom: number;
      if (params && params.maxDenom !== undefined) {
        maxDenom = params.maxDenom;
        if (!Number.isInteger(maxDenom) || maxDenom < 2 || maxDenom > 10) {
          throw new Error(`[DuelGenerator] Invalid maxDenom for B3_fraction_duel: ${maxDenom}. Expected integer in [2, 10].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.B3_fraction_duel.params.maxDenom;
        maxDenom = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { maxDenom };
      break;
    }

    case 'B4_decimal_duel': {
      let precision: number;
      if (params && params.precision !== undefined) {
        precision = params.precision;
        if (!Number.isInteger(precision) || precision < 1 || precision > 2) {
          throw new Error(`[DuelGenerator] Invalid precision for B4_decimal_duel: ${precision}. Expected integer in [1, 2].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.B4_decimal_duel.params.precision;
        precision = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { precision };
      break;
    }
  }

  const questionText = direction === 'min' ? '더 작은 쪽을 쳐라!' : '더 큰 쪽을 쳐라!';

  // 6. 보기 쌍 생성
  const pairs: AssaultAnswerPair[] = [];
  const sideHistory: AssaultAnswerSide[] = [];
  const usedPairSignatures = new Set<string>();

  for (let i = 0; i < pairCount; i++) {
    const scale =
      i < pairIndexDifficultyScale.length
        ? pairIndexDifficultyScale[i]
        : pairIndexDifficultyScale[pairIndexDifficultyScale.length - 1];

    let expr1: ChallengeExpressionResult | null = null;
    let expr2: ChallengeExpressionResult | null = null;
    let attempts = 0;

    // 함정 유도 플래그 (일부 쌍에서 의도적 오개념 함정 유도)
    const preferPrecisionTrap = trapRules.decimalPrecisionTrap && variantId === 'B4_decimal_duel' && rng() < 0.6;
    const preferDenomTrap = trapRules.fractionDenominatorTrap && variantId === 'B3_fraction_duel' && rng() < 0.6;

    while (attempts < 1000) {
      attempts++;

      if (variantId === 'B1_addsub_duel') {
        expr1 = generateAddSubExpr(rng, resolvedParams.maxVal, scale);
        // expr2는 expr1 값과 가까운 값으로 생성 유도
        if (rng() < 0.7) {
          const delta = pickOne(rng, [-3, -2, -1, 1, 2, 3]);
          const target = Math.max(1, expr1.value.numerator + delta);
          const isAdd = rng() < 0.5;
          if (isAdd) {
            const left = nextInt(rng, 1, Math.max(1, target - 1));
            const right = target - left;
            expr2 = evaluateExpression({ kind: 'binary', left, op: '+', right });
          } else {
            const left = target + nextInt(rng, 1, 10);
            const right = left - target;
            expr2 = evaluateExpression({ kind: 'binary', left, op: '-', right });
          }
        } else {
          expr2 = generateAddSubExpr(rng, resolvedParams.maxVal, scale);
        }
      } else if (variantId === 'B2_mul_duel') {
        expr1 = generateMulExpr(rng, resolvedParams.maxFactor, scale);
        // 곱셈 쌍도 결과가 비슷한 곱셈 생성 유도
        expr2 = generateMulExpr(rng, resolvedParams.maxFactor, scale);
      } else if (variantId === 'B3_fraction_duel') {
        if (preferDenomTrap) {
          // 분모 함정: 분모가 더 크지만 값은 더 작은 케이스 (예: 1/2 vs 2/5)
          const baseDenom = nextInt(rng, 2, 5);
          const baseNumer = nextInt(rng, 1, baseDenom - 1);
          expr1 = evaluateExpression({
            kind: 'literal',
            value: Rational.of(baseNumer, baseDenom),
            label: `${baseNumer}/${baseDenom}`,
          });

          // 큰 분모
          const largerDenom = nextInt(rng, baseDenom + 1, Math.min(10, baseDenom + 4));
          // 값은 더 작아야 하므로: numer / largerDenom < baseNumer / baseDenom
          // 즉 numer < baseNumer * largerDenom / baseDenom
          const maxNumer = Math.floor((baseNumer * largerDenom) / baseDenom - 0.01);
          if (maxNumer >= 1) {
            const trapNumer = nextInt(rng, Math.max(1, maxNumer - 1), maxNumer);
            expr2 = evaluateExpression({
              kind: 'literal',
              value: Rational.of(trapNumer, largerDenom),
              label: `${trapNumer}/${largerDenom}`,
            });
          } else {
            expr2 = generateFractionExpr(rng, resolvedParams.maxDenom, scale);
          }
        } else {
          expr1 = generateFractionExpr(rng, resolvedParams.maxDenom, scale);
          expr2 = generateFractionExpr(rng, resolvedParams.maxDenom, scale);
        }
      } else {
        // B4_decimal_duel
        if (preferPrecisionTrap) {
          // 소수 자릿수 함정: 소수점 1자리 vs 2자리인데 1자리가 더 큰 경우 (예: 0.5 vs 0.45)
          const intPart = nextInt(rng, 0, Math.floor(3 * scale));
          const digit = nextInt(rng, 2, 8);
          const shortLabel = `${intPart}.${digit}`;
          const shortVal = Rational.fromDecimalString(shortLabel);

          // 2자리 수는 앞자리가 digit-1 이거나 같으면서 뒤에 붙는 숫자가 작아 전체적으로 더 작게
          const longDigit2 = nextInt(rng, (digit - 1) * 10 + 1, digit * 10 - 1);
          const longStr = longDigit2 < 10 ? `0${longDigit2}` : `${longDigit2}`;
          const longLabel = `${intPart}.${longStr}`;
          const longVal = Rational.fromDecimalString(longLabel);

          expr1 = evaluateExpression({
            kind: 'literal',
            value: shortVal,
            label: shortLabel,
          });
          expr2 = evaluateExpression({
            kind: 'literal',
            value: longVal,
            label: longLabel,
          });
        } else {
          expr1 = generateDecimalExpr(rng, resolvedParams.precision, scale);
          expr2 = generateDecimalExpr(rng, resolvedParams.precision, scale);
        }
      }

      // 두 식이 유효하고, 서로 다르고, diffRange 이내이며, 라벨 길이가 제약 이하인지 검사
      if (!expr1 || !expr2) continue;
      if (expr1.value.equals(expr2.value)) continue;
      if (expr1.label === expr2.label) continue;
      if (expr1.labelLength > maxLabelChars || expr2.labelLength > maxLabelChars) continue;

      if (!isDiffInRange(expr1.value, expr2.value, minDiff, maxDiff)) continue;

      const sig = [expr1.label, expr2.label].sort().join('|');
      if (usedPairSignatures.has(sig)) continue;

      usedPairSignatures.add(sig);
      break;
    }

    if (!expr1 || !expr2 || expr1.value.equals(expr2.value)) {
      throw new Error(`[DuelGenerator] Failed to generate valid pair for variant ${variantId} at index ${i}`);
    }

    // 7. 정답 결정 및 좌우 배치
    const cmp = expr1.value.compare(expr2.value);
    const expr1IsLarger = cmp > 0;
    const expr1IsCorrect = direction === 'max' ? expr1IsLarger : !expr1IsLarger;

    // 연속 같은 쪽 제한(maxConsecutiveSameSide) 고려
    let correctSide: AssaultAnswerSide;
    const lastSide = sideHistory.length > 0 ? sideHistory[sideHistory.length - 1] : null;
    let consecutiveCount = 0;
    for (let j = sideHistory.length - 1; j >= 0; j--) {
      if (sideHistory[j] === lastSide) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    if (consecutiveCount >= maxConsecutiveSameSide && lastSide !== null) {
      correctSide = lastSide === 'left' ? 'right' : 'left';
    } else {
      correctSide = rng() < 0.5 ? 'left' : 'right';
    }

    sideHistory.push(correctSide);

    // correctSide에 정답 식 배치
    const correctExpr = expr1IsCorrect ? expr1 : expr2;
    const wrongExpr = expr1IsCorrect ? expr2 : expr1;

    const leftExpr = correctSide === 'left' ? correctExpr : wrongExpr;
    const rightExpr = correctSide === 'right' ? correctExpr : wrongExpr;

    const leftChoice: AssaultChoiceItem = {
      value: leftExpr.value.numerator / leftExpr.value.denominator,
      text: leftExpr.label,
      isCorrect: correctSide === 'left',
    };

    const rightChoice: AssaultChoiceItem = {
      value: rightExpr.value.numerator / rightExpr.value.denominator,
      text: rightExpr.label,
      isCorrect: correctSide === 'right',
    };

    pairs.push({
      pairId: `pair-${i + 1}`,
      left: leftChoice,
      right: rightChoice,
      correctSide,
      choices: [leftChoice, rightChoice],
    });
  }

  const result: DuelRoundResult = {
    variantId,
    family: 'duel',
    questionText,
    direction,
    params: resolvedParams,
    pairs,
  };

  return deepFreeze(result);
}
