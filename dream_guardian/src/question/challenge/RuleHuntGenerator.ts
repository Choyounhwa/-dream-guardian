/**
 * RuleHuntGenerator.ts - A 규칙 사냥 계열 쌍 생성기
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.2, 5, 11.2)
 * @see Issue #653 [ASSAULT-CHALLENGE-CH-08]
 *
 * 책임 레이어: Question
 * 1. A 계열 4개 유형(A1_times_table, A2_parity, A3_range, A4_multiple)의 보기 쌍 생성 순수 함수.
 * 2. 각 쌍마다 술어 P를 만족하는 정답(P=true, 쌍 간 중복 금지)과 함정 오답(P=false)을 생성.
 * 3. Seed 기반 결정론적 난수(createSeededRng) 사용, Math.random / Date.now 일체 배제.
 * 4. maxConsecutiveSameSide (최대 3회 연속 같은 쪽) 제약 준수.
 * 5. 반환 결과 deepFreeze 동결.
 */

import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../data/assault/challengeCatalog.js';
import type { AssaultAnswerSide } from '../../types/assault.js';
import type { AssaultAnswerPair, AssaultChoiceItem } from '../AssaultAnswerPairFactory.js';
import { deepFreeze } from '../../utils/deepFreeze.js';
import { createSeededRng, nextInt, pickOne } from '../../utils/seededRng.js';

/** A 계열 유형 식별자 */
export type RuleHuntVariantId =
  | 'A1_times_table'
  | 'A2_parity'
  | 'A3_range'
  | 'A4_multiple';

/** A 계열 생성 요청 파라미터 */
export interface RuleHuntGenerateParams {
  readonly variantId: RuleHuntVariantId;
  readonly pairCount: number; // 2 이상
  readonly seed: number;
  /** 선택적 규칙 파라미터 (지정되지 않으면 seed 기반 카탈로그 params 범위 내에서 결정론적 샘플링) */
  readonly params?: Readonly<Record<string, number>>;
}

/** A 계열 라운드 생성 결과 */
export interface RuleHuntRoundResult {
  readonly variantId: string;
  readonly family: 'rule_hunt';
  readonly questionText: string;
  readonly params: Readonly<Record<string, number>>;
  readonly pairs: readonly AssaultAnswerPair[];
}

/** 지원되는 A 계열 유형 집합 */
const SUPPORTED_VARIANT_IDS = new Set<string>([
  'A1_times_table',
  'A2_parity',
  'A3_range',
  'A4_multiple',
]);

/** 자릿수 뒤집기 유틸 */
function reverseDigits(num: number): number {
  const str = String(Math.abs(num));
  const rev = str.split('').reverse().join('');
  return parseInt(rev, 10);
}

/**
 * A 규칙 사냥 계열 문제 및 보기 쌍들을 결정론적으로 생성한다.
 */
export function generateRuleHuntRound(options: RuleHuntGenerateParams): RuleHuntRoundResult {
  if (!options || typeof options !== 'object') {
    throw new Error('[RuleHuntGenerator] options must be a valid object');
  }

  const { variantId, pairCount, seed, params } = options;

  // 1. variantId 검증
  if (!SUPPORTED_VARIANT_IDS.has(variantId)) {
    throw new Error(`[RuleHuntGenerator] Unsupported variantId: "${variantId}"`);
  }

  // 2. pairCount 검증
  if (typeof pairCount !== 'number' || !Number.isInteger(pairCount)) {
    throw new Error(`[RuleHuntGenerator] pairCount must be an integer: ${pairCount}`);
  }
  if (pairCount < 2) {
    throw new Error(`[RuleHuntGenerator] pairCount must be at least 2: ${pairCount}`);
  }

  // 3. seed 검증
  if (typeof seed !== 'number' || !Number.isInteger(seed)) {
    throw new Error(`[RuleHuntGenerator] seed must be an integer: ${seed}`);
  }

  const rng = createSeededRng(seed);
  const cfg = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
  const trapRules = cfg.familyTrapRules.rule_hunt;
  const { maxConsecutiveSameSide, maxLabelChars, pairIndexDifficultyScale } = cfg;

  // 4. 유형별 파라미터 결정 및 검증
  let resolvedParams: Record<string, number> = {};
  let questionText = '';
  let predicate: (val: number) => boolean;

  switch (variantId) {
    case 'A1_times_table': {
      let k: number;
      if (params && params.k !== undefined) {
        k = params.k;
        if (!Number.isInteger(k) || k < 2 || k > 9) {
          throw new Error(`[RuleHuntGenerator] Invalid k parameter for A1_times_table: ${k}. Expected integer in [2, 9].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.A1_times_table.params.k;
        k = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { k };
      questionText = `${k}단 숫자를 쳐라!`;
      predicate = (val: number) => Number.isInteger(val) && val > 0 && val % k === 0;
      break;
    }

    case 'A2_parity': {
      let parity: number;
      if (params && params.parity !== undefined) {
        parity = params.parity;
        if (parity !== 0 && parity !== 1) {
          throw new Error(`[RuleHuntGenerator] Invalid parity parameter for A2_parity: ${parity}. Expected 0 or 1.`);
        }
      } else {
        parity = nextInt(rng, 0, 1);
      }
      resolvedParams = { parity };
      questionText = parity === 0 ? '짝수를 쳐라!' : '홀수를 쳐라!';
      predicate = (val: number) =>
        Number.isInteger(val) && val > 0 && (parity === 0 ? val % 2 === 0 : val % 2 !== 0);
      break;
    }

    case 'A3_range': {
      let lo: number;
      let hi: number;
      if (params && params.lo !== undefined && params.hi !== undefined) {
        lo = params.lo;
        hi = params.hi;
        if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo >= hi - 1) {
          throw new Error(
            `[RuleHuntGenerator] Invalid range parameters [lo: ${lo}, hi: ${hi}]. Expected integers with lo < hi - 1.`
          );
        }
      } else if (params && params.rangeLo !== undefined && params.rangeSpan !== undefined) {
        lo = params.rangeLo;
        const span = params.rangeSpan;
        if (!Number.isInteger(lo) || !Number.isInteger(span) || span < 2) {
          throw new Error('[RuleHuntGenerator] Invalid rangeLo/rangeSpan parameters.');
        }
        hi = lo + span;
      } else {
        const catLo = ASSAULT_CHALLENGE_CATALOG.A3_range.params.rangeLo;
        const catSpan = ASSAULT_CHALLENGE_CATALOG.A3_range.params.rangeSpan;
        lo = nextInt(rng, catLo[0], catLo[1]);
        const span = nextInt(rng, catSpan[0], catSpan[1]);
        hi = lo + span;
      }
      resolvedParams = { lo, hi };
      questionText = `${lo}와 ${hi} 사이를 쳐라!`;
      predicate = (val: number) => Number.isInteger(val) && val > lo && val < hi;
      break;
    }

    case 'A4_multiple': {
      let k: number;
      if (params && params.k !== undefined) {
        k = params.k;
        if (!Number.isInteger(k) || k < 3 || k > 9) {
          throw new Error(`[RuleHuntGenerator] Invalid k parameter for A4_multiple: ${k}. Expected integer in [3, 9].`);
        }
      } else {
        const cat = ASSAULT_CHALLENGE_CATALOG.A4_multiple.params.k;
        k = nextInt(rng, cat[0], cat[1]);
      }
      resolvedParams = { k };
      questionText = `${k}의 배수를 쳐라!`;
      predicate = (val: number) => Number.isInteger(val) && val > 0 && val % k === 0;
      break;
    }
  }

  // 5. 보기 쌍 생성
  const pairs: AssaultAnswerPair[] = [];
  const usedCorrectValues = new Set<number>();
  const sideHistory: AssaultAnswerSide[] = [];

  for (let i = 0; i < pairCount; i++) {
    const scale =
      i < pairIndexDifficultyScale.length
        ? pairIndexDifficultyScale[i]
        : pairIndexDifficultyScale[pairIndexDifficultyScale.length - 1];

    // 5.1 정답 생성 (P=true, 중복 금지)
    let correctValue = 0;

    if (variantId === 'A1_times_table') {
      const k = resolvedParams.k;
      const maxMultiplier = Math.max(9, Math.floor(9 * scale));
      const pool: number[] = [];
      for (let m = 2; m <= maxMultiplier; m++) {
        const cand = k * m;
        if (!usedCorrectValues.has(cand) && String(cand).length <= maxLabelChars) {
          pool.push(cand);
        }
      }
      if (pool.length > 0) {
        correctValue = pickOne(rng, pool);
      } else {
      let m = maxMultiplier + 1;
      while (usedCorrectValues.has(k * m) || String(k * m).length > maxLabelChars) {
        if (String(k * m).length > maxLabelChars) {
          throw new Error(`[RuleHuntGenerator] Cannot generate more distinct correct answers within maxLabelChars (${maxLabelChars})`);
        }
        m++;
      }
      correctValue = k * m;
      }
    } else if (variantId === 'A2_parity') {
      const baseMin = 10;
      const baseMax = Math.max(50, Math.floor(60 * scale));
      const pool: number[] = [];
      for (let v = baseMin; v <= baseMax; v++) {
        if (predicate(v) && !usedCorrectValues.has(v) && String(v).length <= maxLabelChars) {
          pool.push(v);
        }
      }
      if (pool.length > 0) {
        correctValue = pickOne(rng, pool);
      } else {
      let v = baseMax + 1;
      while (!predicate(v) || usedCorrectValues.has(v) || String(v).length > maxLabelChars) {
        if (String(v).length > maxLabelChars) {
          throw new Error(`[RuleHuntGenerator] Cannot generate more distinct correct answers within maxLabelChars (${maxLabelChars})`);
        }
        v++;
      }
      correctValue = v;
      }
    } else if (variantId === 'A3_range') {
      const { lo, hi } = resolvedParams;
      const pool: number[] = [];
      for (let v = lo + 1; v < hi; v++) {
        if (!usedCorrectValues.has(v) && String(v).length <= maxLabelChars) {
          pool.push(v);
        }
      }
      if (pool.length > 0) {
        correctValue = pickOne(rng, pool);
      } else {
        throw new Error(
          `[RuleHuntGenerator] Range [${lo}, ${hi}] does not have enough distinct integers for ${pairCount} pairs`
        );
      }
    } else if (variantId === 'A4_multiple') {
      const k = resolvedParams.k;
      const minM = 3;
      const maxM = Math.max(12, Math.floor(12 * scale));
      const pool: number[] = [];
      for (let m = minM; m <= maxM; m++) {
        const cand = k * m;
        if (!usedCorrectValues.has(cand) && String(cand).length <= maxLabelChars) {
          pool.push(cand);
        }
      }
      if (pool.length > 0) {
        correctValue = pickOne(rng, pool);
      } else {
      let m = maxM + 1;
      while (usedCorrectValues.has(k * m) || String(k * m).length > maxLabelChars) {
        if (String(k * m).length > maxLabelChars) {
          throw new Error(`[RuleHuntGenerator] Cannot generate more distinct correct answers within maxLabelChars (${maxLabelChars})`);
        }
        m++;
      }
      correctValue = k * m;
      }
    }

    usedCorrectValues.add(correctValue);

    // 5.2 함정 오답 생성 (P=false, correctValue와 상이, > 0, 라벨 길이 준수)
    const trapCandidates: number[] = [];

    // 공통 함정 1: deltaOffsets
    for (const d of trapRules.deltaOffsets) {
      const cand = correctValue + d;
      if (cand > 0 && !predicate(cand) && cand !== correctValue && String(cand).length <= maxLabelChars) {
        trapCandidates.push(cand);
      }
    }

    // 공통 함정 2: 자릿수 뒤집기 (reverseDigits)
    if (trapRules.reverseDigits && correctValue >= 10) {
      const rev = reverseDigits(correctValue);
      if (rev > 0 && !predicate(rev) && rev !== correctValue && String(rev).length <= maxLabelChars) {
        trapCandidates.push(rev);
      }
    }

    // 유형별 추가 함정
    if (variantId === 'A1_times_table' || variantId === 'A4_multiple') {
      const k = resolvedParams.k;
      const moreTraps = [
        correctValue + k - 1,
        correctValue + k + 1,
        correctValue - k - 1,
        correctValue - k + 1,
      ];
      for (const cand of moreTraps) {
        if (cand > 0 && !predicate(cand) && cand !== correctValue && String(cand).length <= maxLabelChars) {
          trapCandidates.push(cand);
        }
      }
    } else if (variantId === 'A2_parity') {
      const oddOffsets = [-3, 3, -5, 5, -7, 7, -9, 9];
      for (const d of oddOffsets) {
        const cand = correctValue + d;
        if (cand > 0 && !predicate(cand) && cand !== correctValue && String(cand).length <= maxLabelChars) {
          trapCandidates.push(cand);
        }
      }
    } else if (variantId === 'A3_range') {
      if (trapRules.neighborOutOfRange) {
        const { lo, hi } = resolvedParams;
        const boundaryNeighbors = [lo, lo - 1, lo - 2, hi, hi + 1, hi + 2];
        for (const cand of boundaryNeighbors) {
          if (cand > 0 && !predicate(cand) && cand !== correctValue && String(cand).length <= maxLabelChars) {
            trapCandidates.push(cand);
          }
        }
      }
    }

    // 폴백 오답 풀 (후보가 부족할 때 대비)
    if (trapCandidates.length === 0) {
      let offset = 1;
      while (trapCandidates.length === 0) {
        const cand1 = correctValue + offset;
        const cand2 = correctValue - offset;
        if (cand1 > 0 && !predicate(cand1) && String(cand1).length <= maxLabelChars) {
          trapCandidates.push(cand1);
        }
        if (cand2 > 0 && !predicate(cand2) && String(cand2).length <= maxLabelChars) {
          trapCandidates.push(cand2);
        }
        offset++;
      }
    }

    const wrongValue = pickOne(rng, trapCandidates);

    // 5.3 좌우 배치 (maxConsecutiveSameSide 제약 적용)
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

    // 5.4 보기 항목 및 쌍 구성
    const correctChoice: AssaultChoiceItem = {
      value: correctValue,
      text: String(correctValue),
      isCorrect: true,
    };

    const wrongChoice: AssaultChoiceItem = {
      value: wrongValue,
      text: String(wrongValue),
      isCorrect: false,
    };

    const left = correctSide === 'left' ? correctChoice : wrongChoice;
    const right = correctSide === 'right' ? correctChoice : wrongChoice;

    pairs.push({
      pairId: `pair-${i + 1}`,
      left,
      right,
      correctSide,
      choices: [left, right],
    });
  }

  const result: RuleHuntRoundResult = {
    variantId,
    family: 'rule_hunt',
    questionText,
    params: resolvedParams,
    pairs,
  };

  return deepFreeze(result);
}
