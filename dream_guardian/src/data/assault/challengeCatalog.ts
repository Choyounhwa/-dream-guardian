/**
 * challengeCatalog.ts - 보스 접근전 챌린지 14유형 카탈로그 정적 데이터
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (DOC-18 §§4.1, 4.3, 5, 11.2)
 * @see Issue #650 [ASSAULT-CHALLENGE-CH-05]
 *
 * 절대 규칙:
 * 1. DOC-18 §4.1 표에 정의된 14개 유형(A1~A4, B1~B4, C1~C3, D1~D3)을 정적 데이터로 정의한다.
 * 2. D 계열 minPairs 3, 나머지(A, B, C) minPairs 2.
 * 3. deepFreeze를 통해 불변성을 보장한다.
 * 4. 함수, 콜백, 런타임 상태, Math.random, Date.now 일체 포함 금지.
 */

import { deepFreeze } from '../../utils/deepFreeze.js';
import type {
  AssaultChallengeVariantId,
  AssaultChallengeVariantDef,
} from '../../types/assaultChallenge.js';

/** DOC-18 §4.1 카탈로그 14유형 정적 원본 데이터 */
const RAW_ASSAULT_CHALLENGE_CATALOG: Record<
  AssaultChallengeVariantId,
  AssaultChallengeVariantDef
> = {
  // A 계열: 규칙 사냥 (rule_hunt)
  A1_times_table: {
    variantId: 'A1_times_table',
    family: 'rule_hunt',
    chapters: [2],
    promptTemplate: '{k}단 숫자를 쳐라!',
    params: {
      k: [2, 9],
    },
    minPairs: 2,
  },
  A2_parity: {
    variantId: 'A2_parity',
    family: 'rule_hunt',
    chapters: [1],
    promptTemplate: '{parity}를 쳐라!',
    params: {
      parity: [0, 1],
    },
    minPairs: 2,
  },
  A3_range: {
    variantId: 'A3_range',
    family: 'rule_hunt',
    chapters: [1],
    promptTemplate: '{lo}와 {hi} 사이를 쳐라!',
    params: {
      rangeLo: [10, 80],
      rangeSpan: [10, 20],
    },
    minPairs: 2,
  },
  A4_multiple: {
    variantId: 'A4_multiple',
    family: 'rule_hunt',
    chapters: [2, 5],
    promptTemplate: '{k}의 배수를 쳐라!',
    params: {
      k: [3, 9],
    },
    minPairs: 2,
  },

  // B 계열: 대결 (duel)
  B1_addsub_duel: {
    variantId: 'B1_addsub_duel',
    family: 'duel',
    chapters: [1],
    promptTemplate: '더 큰 쪽을 쳐라!',
    params: {
      maxVal: [10, 50],
    },
    minPairs: 2,
  },
  B2_mul_duel: {
    variantId: 'B2_mul_duel',
    family: 'duel',
    chapters: [2],
    promptTemplate: '더 큰 쪽을 쳐라!',
    params: {
      maxFactor: [3, 9],
    },
    minPairs: 2,
  },
  B3_fraction_duel: {
    variantId: 'B3_fraction_duel',
    family: 'duel',
    chapters: [3],
    promptTemplate: '더 큰 쪽을 쳐라!',
    params: {
      maxDenom: [2, 10],
    },
    minPairs: 2,
  },
  B4_decimal_duel: {
    variantId: 'B4_decimal_duel',
    family: 'duel',
    chapters: [4],
    promptTemplate: '더 큰 쪽을 쳐라!',
    params: {
      precision: [1, 2],
    },
    minPairs: 2,
  },

  // C 계열: 같은 값 (equivalence)
  C1_make_target: {
    variantId: 'C1_make_target',
    family: 'equivalence',
    chapters: [1, 2],
    promptTemplate: '{target}을 만들어라!',
    params: {
      target: [10, 50],
    },
    minPairs: 2,
  },
  C2_equivalent: {
    variantId: 'C2_equivalent',
    family: 'equivalence',
    chapters: [3, 4],
    promptTemplate: '{target}과 같은 것!',
    params: {
      targetKind: [1, 3],
    },
    minPairs: 2,
  },
  C3_make_ten: {
    variantId: 'C3_make_ten',
    family: 'equivalence',
    chapters: [1],
    promptTemplate: '합이 10!',
    params: {
      target: [10, 10],
    },
    minPairs: 2,
  },

  // D 계열: 진행 (progression)
  D1_skip_count: {
    variantId: 'D1_skip_count',
    family: 'progression',
    chapters: [1, 2],
    promptTemplate: '{start}부터 {step}씩 뛰어라!',
    params: {
      start: [1, 20],
      step: [2, 7],
    },
    minPairs: 3,
  },
  D2_countdown: {
    variantId: 'D2_countdown',
    family: 'progression',
    chapters: [1, 5],
    promptTemplate: '{start}에서 {step}씩 빼라!',
    params: {
      start: [30, 99],
      step: [3, 9],
    },
    minPairs: 3,
  },
  D3_doubling: {
    variantId: 'D3_doubling',
    family: 'progression',
    chapters: [2, 5],
    promptTemplate: '{start}에서 두 배씩!',
    params: {
      start: [1, 5],
    },
    minPairs: 3,
  },
};

/**
 * 챌린지 14유형 카탈로그 맵 (동결, 불변)
 */
export const ASSAULT_CHALLENGE_CATALOG: Readonly<
  Record<AssaultChallengeVariantId, AssaultChallengeVariantDef>
> = deepFreeze(RAW_ASSAULT_CHALLENGE_CATALOG);

/**
 * 챌린지 14유형 배열 목록 (동결, 불변)
 */
export const ASSAULT_CHALLENGE_VARIANTS: readonly AssaultChallengeVariantDef[] =
  deepFreeze(Object.values(RAW_ASSAULT_CHALLENGE_CATALOG));
