/**
 * EquivalenceGenerator.ts - C 같은 값 찾기 계열 쌍 생성기
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 5, 11.2)
 * @see Issue #655 [ASSAULT-CHALLENGE-CH-10]
 *
 * 책임 레이어: Question
 * 1. C 계열 3개 유형(C1_make_target, C2_equivalent, C3_make_ten)의 보기 쌍 생성 순수 함수.
 * 2. 목표값 T에 맞춰 정답(값 == T)과 함정 오답(값 != T) 판정.
 * 3. ChallengeExpression (Rational, parseExpressionLabel 등)을 활용한 안전한 라벨 및 정확값 산출.
 * 4. 함정 규칙(같은 연산 종류로 T±1·±2, 분자/분모 하나만 변경한 분수 등) 반영.
 * 5. Seed 기반 결정론적 난수(createSeededRng) 사용, Math.random / Date.now 일체 배제.
 * 6. maxConsecutiveSameSide (최대 3회 연속 같은 쪽) 제약 준수.
 * 7. 반환 결과 deepFreeze 동결.
 */

import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../data/assault/challengeCatalog.js';
import type { AssaultAnswerSide } from '../../types/assault.js';
import type { AssaultAnswerPair, AssaultChoiceItem } from '../AssaultAnswerPairFactory.js';
import {
  parseExpressionLabel,
  type ChallengeExpressionResult,
} from './ChallengeExpression.js';
import { Rational } from '../../utils/Rational.js';
import { deepFreeze } from '../../utils/deepFreeze.js';
import { createSeededRng, nextInt, pickOne, type SeededRng } from '../../utils/seededRng.js';

/** C 계열 유형 식별자 */
export type EquivalenceVariantId =
  | 'C1_make_target'
  | 'C2_equivalent'
  | 'C3_make_ten';

/** C 계열 생성 요청 파라미터 */
export interface EquivalenceGenerateParams {
  readonly variantId: EquivalenceVariantId;
  readonly pairCount: number; // 2 이상
  readonly seed: number;
  /** 선택적 규칙 파라미터 */
  readonly params?: Readonly<Record<string, number>>;
}

/** C 계열 라운드 생성 결과 */
export interface EquivalenceRoundResult {
  readonly variantId: string;
  readonly family: 'equivalence';
  readonly questionText: string;
  readonly target: string; // 목표값 문자열 표현 (예: "12", "1/2", "10")
  readonly params: Readonly<Record<string, number>>;
  readonly pairs: readonly AssaultAnswerPair[];
}

/** 지원되는 C 계열 유형 집합 */
const SUPPORTED_VARIANTS: ReadonlySet<string> = new Set<EquivalenceVariantId>([
  'C1_make_target',
  'C2_equivalent',
  'C3_make_ten',
]);

/**
 * 한국어 목적격 조사(을/를) 결정 헬퍼
 * 숫자의 마지막 자릿수 발음 받침 유무에 따라 결정
 */
function getKoreanObjectParticle(n: number): string {
  const lastDigit = Math.abs(n) % 10;
  // 0(영), 1(일), 3(삼), 6(육), 7(칠), 8(팔)은 받침 있음 -> '을'
  // 2(이), 4(사), 5(오), 9(구)는 받침 없음 -> '를'
  const hasBatchim = [0, 1, 3, 6, 7, 8].includes(lastDigit);
  return hasBatchim ? '을' : '를';
}

/** 단일 보기 생성 후보 쌍 */
interface CandidatePair {
  readonly correctExpr: ChallengeExpressionResult;
  readonly wrongExpr: ChallengeExpressionResult;
}

/**
 * C1_make_target 후보 쌍 생성기
 * 목표값 T(정수)에 대해 동일한 연산 종류의 정답 식(값 == T)과 오답 식(값 in T±1, T±2)을 생성한다.
 */
function generateC1Candidates(
  rng: SeededRng,
  target: number,
  trapOffsets: readonly number[],
  maxLabelChars: number,
): readonly CandidatePair[] {
  const targetVal = Rational.of(target);
  const candidates: CandidatePair[] = [];
  const usedCorrectLabels = new Set<string>();

  // 1. 곱셈 후보 (T가 2 이상의 두 수로 인수분해 가능한 경우)
  const factorPairs: Array<[number, number]> = [];
  for (let a = 2; a * a <= target; a++) {
    if (target % a === 0) {
      const b = target / a;
      factorPairs.push([a, b]);
      if (a !== b) {
        factorPairs.push([b, a]);
      }
    }
  }

  for (const [a, b] of factorPairs) {
    const cLabel = `${a}×${b}`;
    if (cLabel.length > maxLabelChars || usedCorrectLabels.has(cLabel)) continue;

    // 오답 곱셈 식: T + offset (offset in trapOffsets)
    for (const offset of trapOffsets) {
      const wTarget = target + offset;
      if (wTarget < 4) continue;
      // wTarget의 인수분해 쌍 탐색
      const wFactors: Array<[number, number]> = [];
      for (let wa = 2; wa * wa <= wTarget; wa++) {
        if (wTarget % wa === 0) {
          const wb = wTarget / wa;
          wFactors.push([wa, wb]);
          if (wa !== wb) wFactors.push([wb, wa]);
        }
      }
      if (wFactors.length > 0) {
        const [wa, wb] = pickOne(rng, wFactors);
        const wLabel = `${wa}×${wb}`;
        if (wLabel.length <= maxLabelChars && wLabel !== cLabel) {
          try {
            const cExpr = parseExpressionLabel(cLabel);
            const wExpr = parseExpressionLabel(wLabel);
            if (cExpr.value.equals(targetVal) && !wExpr.value.equals(targetVal)) {
              candidates.push({ correctExpr: cExpr, wrongExpr: wExpr });
              usedCorrectLabels.add(cLabel);
              break;
            }
          } catch {
            // 파싱 실패 무시
          }
        }
      }
    }
  }

  // 2. 덧셈 후보 (a + b = target)
  const addSplits: Array<[number, number]> = [];
  for (let a = 1; a < target; a++) {
    addSplits.push([a, target - a]);
  }
  // 결정론적 셔플을 위한 역순/혼합 순회
  for (let i = 0; i < addSplits.length; i++) {
    const [a, b] = addSplits[i];
    const cLabel = `${a}+${b}`;
    if (cLabel.length > maxLabelChars || usedCorrectLabels.has(cLabel)) continue;

    for (const offset of trapOffsets) {
      // 함정 식 1: b에 offset 적용
      const wb = b + offset;
      if (wb >= 1) {
        const wLabel = `${a}+${wb}`;
        if (wLabel.length <= maxLabelChars && wLabel !== cLabel) {
          try {
            const cExpr = parseExpressionLabel(cLabel);
            const wExpr = parseExpressionLabel(wLabel);
            if (cExpr.value.equals(targetVal) && !wExpr.value.equals(targetVal)) {
              candidates.push({ correctExpr: cExpr, wrongExpr: wExpr });
              usedCorrectLabels.add(cLabel);
              break;
            }
          } catch {
            // 무시
          }
        }
      }
    }
  }

  // 3. 뺄셈 후보 (a - b = target)
  for (let b = 1; b <= 20; b++) {
    const a = target + b;
    const cLabel = `${a}-${b}`;
    if (cLabel.length > maxLabelChars || usedCorrectLabels.has(cLabel)) continue;

    for (const offset of trapOffsets) {
      const wa = a + offset;
      if (wa > b) {
        const wLabel = `${wa}-${b}`;
        if (wLabel.length <= maxLabelChars && wLabel !== cLabel) {
          try {
            const cExpr = parseExpressionLabel(cLabel);
            const wExpr = parseExpressionLabel(wLabel);
            if (cExpr.value.equals(targetVal) && !wExpr.value.equals(targetVal)) {
              candidates.push({ correctExpr: cExpr, wrongExpr: wExpr });
              usedCorrectLabels.add(cLabel);
              break;
            }
          } catch {
            // 무시
          }
        }
      }
    }
  }

  // 4. 나눗셈 후보 (a ÷ b = target)
  for (let b = 2; b <= 4; b++) {
    const a = target * b;
    const cLabel = `${a}÷${b}`;
    if (cLabel.length > maxLabelChars || usedCorrectLabels.has(cLabel)) continue;

    for (const offset of trapOffsets) {
      const wa = (target + offset) * b;
      if (wa > 0) {
        const wLabel = `${wa}÷${b}`;
        if (wLabel.length <= maxLabelChars && wLabel !== cLabel) {
          try {
            const cExpr = parseExpressionLabel(cLabel);
            const wExpr = parseExpressionLabel(wLabel);
            if (cExpr.value.equals(targetVal) && !wExpr.value.equals(targetVal)) {
              candidates.push({ correctExpr: cExpr, wrongExpr: wExpr });
              usedCorrectLabels.add(cLabel);
              break;
            }
          } catch {
            // 무시
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * C2_equivalent 후보 풀 정의
 */
interface C2Def {
  readonly targetLabel: string;
  readonly targetVal: Rational;
  readonly correctFractions: readonly string[];
  readonly correctDecimals: readonly string[];
  readonly wrongFractions: readonly string[];
  readonly wrongDecimals: readonly string[];
}

const C2_DEFINITIONS: Readonly<Record<number, C2Def>> = deepFreeze({
  1: {
    targetLabel: '1/2',
    targetVal: Rational.of(1, 2),
    correctFractions: [
      '2/4', '3/6', '4/8', '5/10', '6/12', '7/14',
      '8/16', '9/18', '10/20', '11/22', '12/24', '15/30',
    ],
    correctDecimals: ['0.5'],
    wrongFractions: [
      '2/3', '2/5', '3/5', '3/7', '4/7', '1/3', '1/4', '3/4',
      '4/9', '5/9', '5/11', '6/11', '6/13', '7/13', '7/15',
    ],
    wrongDecimals: ['0.25', '0.75', '0.2', '0.3', '0.4', '0.6', '0.7', '0.8'],
  },
  2: {
    targetLabel: '1/4',
    targetVal: Rational.of(1, 4),
    correctFractions: [
      '2/8', '3/12', '4/16', '5/20', '6/24', '7/28',
      '8/32', '9/36', '10/40', '11/44', '12/48', '15/60',
    ],
    correctDecimals: ['0.25'],
    wrongFractions: [
      '2/7', '2/9', '3/10', '3/11', '4/15', '4/17', '5/19', '5/21',
      '6/23', '6/25', '1/3', '1/5', '2/5', '3/4',
    ],
    wrongDecimals: ['0.5', '0.75', '0.2', '0.3', '0.15', '0.35', '0.4', '0.6'],
  },
  3: {
    targetLabel: '3/4',
    targetVal: Rational.of(3, 4),
    correctFractions: [
      '6/8', '9/12', '12/16', '15/20', '18/24', '21/28',
      '24/32', '27/36', '30/40', '33/44', '36/48', '45/60',
    ],
    correctDecimals: ['0.75'],
    wrongFractions: [
      '6/7', '6/9', '9/11', '9/13', '12/15', '12/17', '15/19', '15/21',
      '18/23', '18/25', '2/4', '1/2', '2/3', '3/5', '4/5',
    ],
    wrongDecimals: ['0.5', '0.25', '0.7', '0.8', '0.65', '0.85', '0.3', '0.4'],
  },
});

/** 결정론적 셔플 (Fisher-Yates) */
function shuffleList<T>(rng: SeededRng, list: readonly T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * C2_equivalent 후보 쌍 생성
 */
function generateC2Candidates(
  rng: SeededRng,
  def: C2Def,
  maxLabelChars: number,
): readonly CandidatePair[] {
  const candidates: CandidatePair[] = [];
  const usedCorrectLabels = new Set<string>();
  const usedWrongLabels = new Set<string>();

  // 정답 풀 구성 (소수 1건 포함, 나머지는 분수)
  const allCorrect: string[] = [];
  if (def.correctDecimals.length > 0) {
    allCorrect.push(...def.correctDecimals);
  }
  allCorrect.push(...def.correctFractions);

  for (const cLabel of allCorrect) {
    if (cLabel.length > maxLabelChars || usedCorrectLabels.has(cLabel)) continue;

    const isDecimal = cLabel.includes('.');
    // 오답은 동일한 형태(소수에는 소수, 분수에는 분수) 우선 매칭
    const wPool = isDecimal ? def.wrongDecimals : def.wrongFractions;
    let chosenWrong: string | null = null;

    // 미사용 오답 탐색
    for (let attempts = 0; attempts < wPool.length * 2; attempts++) {
      const candidate = pickOne(rng, wPool);
      if (candidate.length <= maxLabelChars && candidate !== cLabel && !usedWrongLabels.has(candidate)) {
        chosenWrong = candidate;
        break;
      }
    }

    if (!chosenWrong) {
      // 대체 오답 탐색
      const altPool = isDecimal ? def.wrongFractions : def.wrongDecimals;
      for (const candidate of altPool) {
        if (candidate.length <= maxLabelChars && candidate !== cLabel) {
          chosenWrong = candidate;
          break;
        }
      }
    }

    if (chosenWrong) {
      try {
        const cExpr = parseExpressionLabel(cLabel);
        const wExpr = parseExpressionLabel(chosenWrong);
        if (cExpr.value.equals(def.targetVal) && !wExpr.value.equals(def.targetVal)) {
          candidates.push({ correctExpr: cExpr, wrongExpr: wExpr });
          usedCorrectLabels.add(cLabel);
          usedWrongLabels.add(chosenWrong);
        }
      } catch {
        // 무시
      }
    }
  }

  return candidates;
}

/**
 * C3_make_ten 후보 쌍 생성 (합이 10)
 */
function generateC3Candidates(
  rng: SeededRng,
  trapOffsets: readonly number[],
  maxLabelChars: number,
): readonly CandidatePair[] {
  const tenVal = Rational.of(10);
  const candidates: CandidatePair[] = [];
  const usedCorrectLabels = new Set<string>();

  // 1+9 ~ 9+1 정답 풀
  const correctSplits: Array<[number, number]> = [
    [1, 9], [2, 8], [3, 7], [4, 6], [5, 5],
    [6, 4], [7, 3], [8, 2], [9, 1], [0, 10], [10, 0],
  ];

  for (const [a, b] of correctSplits) {
    const cLabel = `${a}+${b}`;
    if (cLabel.length > maxLabelChars || usedCorrectLabels.has(cLabel)) continue;

    // 오답 식: 합이 10 + offset (offset in [-2, -1, 1, 2], 즉 8, 9, 11, 12)
    const offset = pickOne(rng, trapOffsets);
    const wb = b + offset;
    let wLabel = '';
    if (wb >= 0) {
      wLabel = `${a}+${wb}`;
    } else {
      const wa = a + offset;
      wLabel = `${wa}+${b}`;
    }

    if (wLabel.length <= maxLabelChars && wLabel !== cLabel) {
      try {
        const cExpr = parseExpressionLabel(cLabel);
        const wExpr = parseExpressionLabel(wLabel);
        if (cExpr.value.equals(tenVal) && !wExpr.value.equals(tenVal)) {
          candidates.push({ correctExpr: cExpr, wrongExpr: wExpr });
          usedCorrectLabels.add(cLabel);
        }
      } catch {
        // 무시
      }
    }
  }

  return candidates;
}

/**
 * C 계열 라운드 보기 쌍 생성 순수 함수
 *
 * @param params 생성 요청 파라미터 (variantId, pairCount, seed, params)
 * @returns EquivalenceRoundResult 생성 결과 (deepFreeze 동결)
 */
export function generateEquivalenceRound(
  params: EquivalenceGenerateParams,
): EquivalenceRoundResult {
  // 1. 기본 유효성 검증
  if (!params || typeof params !== 'object') {
    throw new Error('[EquivalenceGenerator] options must be a valid object');
  }

  const { variantId, pairCount, seed, params: customParams } = params;

  if (!SUPPORTED_VARIANTS.has(variantId)) {
    throw new Error(`[EquivalenceGenerator] Unsupported variantId: "${variantId}"`);
  }

  if (!Number.isInteger(pairCount)) {
    throw new Error(`[EquivalenceGenerator] pairCount must be an integer: ${pairCount}`);
  }

  if (pairCount < 2) {
    throw new Error(`[EquivalenceGenerator] pairCount must be at least 2: ${pairCount}`);
  }

  if (!Number.isInteger(seed)) {
    throw new Error(`[EquivalenceGenerator] seed must be an integer: ${seed}`);
  }

  const rng = createSeededRng(seed);
  const trapOffsets = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.equivalence.operandTrapOffsets;
  const maxLabelChars = DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars;
  const maxConsecutiveSameSide = DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide;

  let questionText = '';
  let target = '';
  let resolvedParams: Record<string, number> = {};
  let candidatePool: readonly CandidatePair[] = [];

  // 2. 유형별 목표값 및 후보 풀 구성
  switch (variantId) {
    case 'C1_make_target': {
      let t: number;
      if (customParams && customParams.target !== undefined) {
        t = customParams.target;
        if (!Number.isInteger(t) || t < 2 || t > 100) {
          throw new Error(`[EquivalenceGenerator] Invalid target for C1_make_target: ${t}. Expected integer in [2, 100].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.C1_make_target.params.target;
        t = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { target: t };
      target = String(t);
      questionText = `${t}${getKoreanObjectParticle(t)} 만들어라!`;
      candidatePool = generateC1Candidates(rng, t, trapOffsets, maxLabelChars);
      break;
    }

    case 'C2_equivalent': {
      let kind: number;
      if (customParams && customParams.targetKind !== undefined) {
        kind = customParams.targetKind;
        if (!Number.isInteger(kind) || kind < 1 || kind > 3) {
          throw new Error(`[EquivalenceGenerator] Invalid targetKind for C2_equivalent: ${kind}. Expected integer in [1, 3].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.C2_equivalent.params.targetKind;
        kind = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { targetKind: kind };
      const def = C2_DEFINITIONS[kind];
      target = def.targetLabel;
      questionText = `${target}과 같은 것!`;
      candidatePool = generateC2Candidates(rng, def, maxLabelChars);
      break;
    }

    case 'C3_make_ten': {
      if (customParams && customParams.target !== undefined && customParams.target !== 10) {
        throw new Error(`[EquivalenceGenerator] Invalid target for C3_make_ten: ${customParams.target}. Expected 10.`);
      }
      resolvedParams = { target: 10 };
      target = '10';
      questionText = '합이 10!';
      candidatePool = generateC3Candidates(rng, trapOffsets, maxLabelChars);
      break;
    }
  }

  const shuffledPool = shuffleList(rng, candidatePool);

  // 3. 보기 쌍 생성 및 좌우 배치
  const pairs: AssaultAnswerPair[] = [];
  const sideHistory: AssaultAnswerSide[] = [];
  const usedCorrectLabels = new Set<string>();
  const usedPairSignatures = new Set<string>();

  for (const candidate of shuffledPool) {
    if (pairs.length >= pairCount) break;

    const { correctExpr, wrongExpr } = candidate;
    if (usedCorrectLabels.has(correctExpr.label)) continue;

    const sig = [correctExpr.label, wrongExpr.label].sort().join('|');
    if (usedPairSignatures.has(sig)) continue;

    usedCorrectLabels.add(correctExpr.label);
    usedPairSignatures.add(sig);

    // 연속 같은 쪽 제한(maxConsecutiveSameSide) 고려한 correctSide 결정
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

    const pairIndex = pairs.length;
    const pairId = `${variantId}-${seed}-${pairIndex}`;
    const pair: AssaultAnswerPair = {
      pairId,
      left: leftChoice,
      right: rightChoice,
      correctSide,
      choices: [leftChoice, rightChoice],
    };

    pairs.push(pair);
  }

  if (pairs.length < pairCount) {
    throw new Error(
      `[EquivalenceGenerator] Insufficient candidate pairs for ${variantId}: generated ${pairs.length}, required ${pairCount}`,
    );
  }

  const result: EquivalenceRoundResult = {
    variantId,
    family: 'equivalence',
    questionText,
    target,
    params: resolvedParams,
    pairs,
  };

  return deepFreeze(result);
}
