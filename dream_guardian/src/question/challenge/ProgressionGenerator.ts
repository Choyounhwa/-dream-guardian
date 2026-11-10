/**
 * ProgressionGenerator.ts - D 진행 계열 쌍 생성기 및 쌍 보조 문구
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 4.4, 5, 8, 11.2)
 * @see Issue #656 [ASSAULT-CHALLENGE-CH-11]
 *
 * 책임 레이어: Question
 * 1. D 계열 3개 유형(D1_skip_count, D2_countdown, D3_doubling)의 보기 쌍 생성 순수 함수.
 * 2. 각 쌍별 보조 문구(pairPrompts) 사전 생성: DOC-18 §4.4 오답 전파 방지 (예: '3 → ?', '3 → 7 → ?').
 * 3. Seed 기반 결정론적 난수(createSeededRng) 사용, Math.random / Date.now 일체 배제.
 * 4. maxConsecutiveSameSide (최대 3회 연속 같은 쪽) 제약 준수.
 * 5. 모든 정답 및 오답 값은 0 이상(>= 0), 글자 수 <= maxLabelChars(6자).
 * 6. 반환 결과 deepFreeze 동결.
 */

import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../data/assault/challengeCatalog.js';
import type { AssaultAnswerSide } from '../../types/assault.js';
import type { AssaultAnswerPair, AssaultChoiceItem } from '../AssaultAnswerPairFactory.js';
import { deepFreeze } from '../../utils/deepFreeze.js';
import { createSeededRng, nextInt, pickOne, type SeededRng } from '../../utils/seededRng.js';

/** D 계열 유형 식별자 */
export type ProgressionVariantId =
  | 'D1_skip_count'
  | 'D2_countdown'
  | 'D3_doubling';

/** D 계열 생성 요청 파라미터 */
export interface ProgressionGenerateParams {
  readonly variantId: ProgressionVariantId;
  readonly pairCount: number; // minPairs 3 이상
  readonly seed: number;
  /** 선택적 규칙 파라미터 (지정되지 않으면 seed 기반 카탈로그 params 범위 내에서 결정론적 샘플링) */
  readonly params?: Readonly<Record<string, number>>;
}

/** D 계열 라운드 생성 결과 */
export interface ProgressionRoundResult {
  readonly variantId: string;
  readonly family: 'progression';
  readonly questionText: string;
  readonly pairPrompts: readonly string[]; // 각 쌍별 보조 문구 (예: '3 → ?', '3 → 7 → ?')
  readonly params: Readonly<Record<string, number>>;
  readonly pairs: readonly AssaultAnswerPair[];
}

/** 지원되는 D 계열 유형 집합 */
const SUPPORTED_VARIANTS: ReadonlySet<string> = new Set<ProgressionVariantId>([
  'D1_skip_count',
  'D2_countdown',
  'D3_doubling',
]);

/**
 * D 계열 라운드 문제 및 보기 쌍 생성 함수
 *
 * @param params 생성 요청 파라미터
 * @returns 결정론적으로 생성되고 완전히 동결된 ProgressionRoundResult
 */
export function generateProgressionRound(
  params: ProgressionGenerateParams,
): ProgressionRoundResult {
  const { variantId, pairCount, seed, params: customParams } = params;

  // 1. 유효성 검증
  if (!SUPPORTED_VARIANTS.has(variantId)) {
    throw new Error(`[ProgressionGenerator] Unsupported variantId: ${variantId}`);
  }

  const catalogDef = ASSAULT_CHALLENGE_CATALOG[variantId];
  const minPairs = catalogDef.minPairs ?? 3;
  if (!Number.isInteger(pairCount) || pairCount < minPairs) {
    throw new Error(
      `[ProgressionGenerator] Invalid pairCount: ${pairCount}. Minimum is ${minPairs} for ${variantId}.`,
    );
  }

  if (!Number.isInteger(seed)) {
    throw new Error(`[ProgressionGenerator] seed must be an integer: ${seed}`);
  }

  const rng: SeededRng = createSeededRng(seed);
  const maxLabelChars = DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars;
  const trapRules = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.progression;
  const deltaOffsets = trapRules.deltaOffsets;
  const skipStepOffsets = trapRules.skipStepOffsets;

  let start: number;
  let step: number = 0;
  let resolvedParams: Record<string, number>;
  let questionText: string;
  const correctSequence: number[] = [];

  // 2. 유형별 파라미터 및 정답 수열 결정
  switch (variantId) {
    case 'D1_skip_count': {
      const catStart = catalogDef.params.start ?? [1, 20];
      const catStep = catalogDef.params.step ?? [2, 7];

      if (customParams && customParams.start !== undefined) {
        start = customParams.start;
        if (!Number.isInteger(start) || start < 1) {
          throw new Error(`[ProgressionGenerator] Invalid start for D1_skip_count: ${start}. Expected integer >= 1.`);
        }
      } else {
        start = nextInt(rng, catStart[0], catStart[1]);
      }

      if (customParams && customParams.step !== undefined) {
        step = customParams.step;
        if (!Number.isInteger(step) || step < 1) {
          throw new Error(`[ProgressionGenerator] Invalid step for D1_skip_count: ${step}. Expected integer >= 1.`);
        }
      } else {
        step = nextInt(rng, catStep[0], catStep[1]);
      }

      resolvedParams = { start, step };
      questionText = catalogDef.promptTemplate
        .replace('{start}', String(start))
        .replace('{step}', String(step));

      // 수열: start + step * (i + 1)
      for (let i = 0; i < pairCount; i++) {
        const correctVal = start + step * (i + 1);
        if (String(correctVal).length > maxLabelChars) {
          throw new Error(
            `[ProgressionGenerator] Value ${correctVal} exceeds maxLabelChars (${maxLabelChars}) for D1_skip_count.`,
          );
        }
        correctSequence.push(correctVal);
      }
      break;
    }

    case 'D2_countdown': {
      const catStart = catalogDef.params.start ?? [30, 99];
      const catStep = catalogDef.params.step ?? [3, 9];

      if (customParams && customParams.step !== undefined) {
        step = customParams.step;
        if (!Number.isInteger(step) || step < 1) {
          throw new Error(`[ProgressionGenerator] Invalid step for D2_countdown: ${step}. Expected integer >= 1.`);
        }
      } else {
        step = nextInt(rng, catStep[0], catStep[1]);
      }

      const minStartNeeded = step * pairCount;

      if (customParams && customParams.start !== undefined) {
        start = customParams.start;
        if (!Number.isInteger(start) || start < 1) {
          throw new Error(`[ProgressionGenerator] Invalid start for D2_countdown: ${start}. Expected integer >= 1.`);
        }
        if (start - minStartNeeded < 0) {
          throw new Error(
            `[ProgressionGenerator] Invalid start=${start} for D2_countdown: start must be >= step * pairCount (${minStartNeeded}) to ensure all values are non-negative.`,
          );
        }
      } else {
        const startMin = Math.max(catStart[0], minStartNeeded);
        const startMax = Math.max(catStart[1], startMin + 20);
        start = nextInt(rng, startMin, startMax);
      }

      resolvedParams = { start, step };
      questionText = catalogDef.promptTemplate
        .replace('{start}', String(start))
        .replace('{step}', String(step));

      // 수열: start - step * (i + 1)
      for (let i = 0; i < pairCount; i++) {
        const correctVal = start - step * (i + 1);
        if (correctVal < 0) {
          throw new Error(
            `[ProgressionGenerator] Negative correct value ${correctVal} encountered in D2_countdown.`,
          );
        }
        if (String(correctVal).length > maxLabelChars) {
          throw new Error(
            `[ProgressionGenerator] Value ${correctVal} exceeds maxLabelChars (${maxLabelChars}) for D2_countdown.`,
          );
        }
        correctSequence.push(correctVal);
      }
      break;
    }

    case 'D3_doubling': {
      const catStart = catalogDef.params.start ?? [1, 5];

      if (customParams && customParams.start !== undefined) {
        start = customParams.start;
        if (!Number.isInteger(start) || start < 1) {
          throw new Error(`[ProgressionGenerator] Invalid start for D3_doubling: ${start}. Expected integer >= 1.`);
        }
      } else {
        start = nextInt(rng, catStart[0], catStart[1]);
      }

      resolvedParams = { start };
      questionText = catalogDef.promptTemplate.replace('{start}', String(start));

      // 수열: start * (2 ** (i + 1))
      for (let i = 0; i < pairCount; i++) {
        const correctVal = start * Math.pow(2, i + 1);
        if (String(correctVal).length > maxLabelChars) {
          throw new Error(
            `[ProgressionGenerator] Value ${correctVal} exceeds maxLabelChars (${maxLabelChars}) for D3_doubling.`,
          );
        }
        correctSequence.push(correctVal);
      }
      break;
    }
  }

  // 3. pairPrompts 생성 (DOC-18 §4.4 오답 전파 방지: 사전에 결정론적 정답 수열 기반 안내)
  const pairPrompts: string[] = [];
  for (let i = 0; i < pairCount; i++) {
    const prefix = [start, ...correctSequence.slice(0, i)];
    pairPrompts.push(`${prefix.join(' → ')} → ?`);
  }

  // 4. 쌍별 함정 오답 생성 및 좌우 배치
  const pairs: AssaultAnswerPair[] = [];
  const sideHistory: AssaultAnswerSide[] = [];
  const maxConsecutiveSameSide = DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide;

  for (let i = 0; i < pairCount; i++) {
    const correctVal = correctSequence[i];
    const prevVal = i === 0 ? start : correctSequence[i - 1];

    // 함정 오답 후보군 수집
    const rawCandidates: number[] = [];

    // 공통: deltaOffsets (정답 ± 1)
    for (const d of deltaOffsets) {
      rawCandidates.push(correctVal + d);
    }

    if (variantId === 'D1_skip_count') {
      // step ± 1 적용한 값
      for (const s of skipStepOffsets) {
        rawCandidates.push(prevVal + (step + s));
        rawCandidates.push(start + (step + s) * (i + 1));
      }
      // f를 한 번 덜 적용한 값(이전 정답/시작값)
      rawCandidates.push(prevVal);
      // f를 한 번 더 적용한 값
      rawCandidates.push(correctVal + step);
      // 추가 delta
      rawCandidates.push(correctVal + 2);
      rawCandidates.push(correctVal - 2);
    } else if (variantId === 'D2_countdown') {
      // step ± 1 적용한 값
      for (const s of skipStepOffsets) {
        rawCandidates.push(prevVal - (step + s));
        rawCandidates.push(start - (step + s) * (i + 1));
      }
      // f를 한 번 덜 적용한 값
      rawCandidates.push(prevVal);
      // f를 한 번 더 적용한 값
      rawCandidates.push(correctVal - step);
      // 추가 delta
      rawCandidates.push(correctVal + 2);
      rawCandidates.push(correctVal - 2);
    } else if (variantId === 'D3_doubling') {
      // 3배 적용한 값
      rawCandidates.push(prevVal * 3);
      // 1배 적용한 값 (prevVal)
      rawCandidates.push(prevVal);
      // 덧셈 착각
      rawCandidates.push(prevVal + 2);
      rawCandidates.push(prevVal + start);
      // f를 한 번 더 적용한 값
      rawCandidates.push(correctVal * 2);
      // 추가 delta
      rawCandidates.push(correctVal + 2);
      rawCandidates.push(correctVal - 2);
    }

    // 유효한 오답 후보 필터링: >= 0, !== correctVal, 라벨 길이 <= maxLabelChars
    const validCandidates = Array.from(
      new Set(
        rawCandidates.filter(
          (val) =>
            Number.isInteger(val) &&
            val >= 0 &&
            val !== correctVal &&
            String(val).length <= maxLabelChars,
        ),
      ),
    );

    // 후보군이 비어있을 경우의 안전 fallback
    let wrongVal: number;
    if (validCandidates.length > 0) {
      wrongVal = pickOne(rng, validCandidates);
    } else {
      wrongVal = correctVal === 0 ? 1 : correctVal + 1;
      if (String(wrongVal).length > maxLabelChars) {
        wrongVal = Math.max(0, correctVal - 1);
      }
    }

    // 좌우 배치 결정 (maxConsecutiveSameSide 제약 반영)
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

    const leftVal = correctSide === 'left' ? correctVal : wrongVal;
    const rightVal = correctSide === 'right' ? correctVal : wrongVal;

    const leftChoice: AssaultChoiceItem = {
      value: leftVal,
      text: String(leftVal),
      isCorrect: correctSide === 'left',
    };

    const rightChoice: AssaultChoiceItem = {
      value: rightVal,
      text: String(rightVal),
      isCorrect: correctSide === 'right',
    };

    const pairId = `${variantId}-${seed}-${i}`;
    const pair: AssaultAnswerPair = {
      pairId,
      left: leftChoice,
      right: rightChoice,
      correctSide,
      choices: [leftChoice, rightChoice],
    };

    pairs.push(pair);
  }

  const result: ProgressionRoundResult = {
    variantId,
    family: 'progression',
    questionText,
    pairPrompts,
    params: resolvedParams,
    pairs,
  };

  return deepFreeze(result);
}
