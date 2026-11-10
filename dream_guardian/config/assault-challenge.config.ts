/**
 * assault-challenge.config.ts - 보스 접근전 챌린지 출제 조정값 설정
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (DOC-18 §§4.1, 4.3, 11.2)
 * @see Issue #649 [ASSAULT-CHALLENGE-CH-04]
 *
 * 절대 규칙:
 * 1. 순수 설정 데이터만 정의한다.
 * 2. deepFreeze를 통해 불변성을 보장한다.
 * 3. Math.random / Date.now 일체 사용 금지.
 * 4. maxLabelChars는 DEFAULT_ASSAULT_QUESTION_CONFIG.maxLabelChars를 직접 참조한다(재정의 금지).
 */

import { deepFreeze } from '../src/utils/deepFreeze.js';
import { DEFAULT_ASSAULT_QUESTION_CONFIG } from './assault-question.config.js';
import type { AssaultChallengeFamily } from '../src/types/assaultChallenge.js';

/** A 계열 (규칙 사냥) 함정 규칙 */
export interface RuleHuntTrapRules {
  readonly deltaOffsets: readonly number[];
  readonly reverseDigits: boolean;
  readonly neighborOutOfRange: boolean;
}

/** B 계열 (대결) 함정 규칙 */
export interface DuelTrapRules {
  readonly diffRange: readonly [number, number];
  readonly decimalPrecisionTrap: boolean;
  readonly fractionDenominatorTrap: boolean;
}

/** C 계열 (같은 값) 함정 규칙 */
export interface EquivalenceTrapRules {
  readonly operandTrapOffsets: readonly number[];
}

/** D 계열 (진행) 함정 규칙 */
export interface ProgressionTrapRules {
  readonly deltaOffsets: readonly number[];
  readonly skipStepOffsets: readonly number[];
}

/** 계열별 함정 규칙표 */
export interface AssaultChallengeFamilyTrapRules {
  readonly rule_hunt: RuleHuntTrapRules;
  readonly duel: DuelTrapRules;
  readonly equivalence: EquivalenceTrapRules;
  readonly progression: ProgressionTrapRules;
}

/** 챌린지 출제 전체 설정 인터페이스 */
export interface AssaultChallengeConfig {
  /** 보기 라벨 최대 글자 수 상한 (DEFAULT_ASSAULT_QUESTION_CONFIG 참조) */
  readonly maxLabelChars: number;
  /** 한 세션 최소 계열 수 (기본: 3) */
  readonly minSessionFamilies: number;
  /** 한 세션 최대 계열 수 (기본: 4) */
  readonly maxSessionFamilies: number;
  /** 같은 계열 최대 연속 라운드 수 (기본: 2) */
  readonly maxConsecutiveSameFamily: number;
  /** 같은 쪽 정답 최대 연속 수 (기본: 3) */
  readonly maxConsecutiveSameSide: number;
  /** 계열 첫 등장 라운드 가산 읽기 시간 (초, 기본: 1.0) */
  readonly firstAppearanceExtraReadSeconds: number;
  /** 쌍 인덱스별 범위 난도 스케일 배율 */
  readonly pairIndexDifficultyScale: readonly number[];
  /** 오프라인 유형당 기본 생성 행 수 (기본: 20, 총 280행 검수 규격) */
  readonly rowsPerVariant: number;
  /** CSV 한 행(라운드)당 보기 쌍 수 = 문제 1개당 펀치 횟수 (CH-23 / #680) */
  readonly pairsPerRow: number;
  /** 챕터별 계열 출제 가중치표 (DOC-18 §4.1 매핑) */
  readonly chapterFamilyWeights: Readonly<
    Record<1 | 2 | 3 | 4 | 5, Readonly<Record<AssaultChallengeFamily, number>>>
  >;
  /** 계열별 함정 규칙표 */
  readonly familyTrapRules: AssaultChallengeFamilyTrapRules;
}

/** 챌린지 출제 기본 불변 설정 객체 */
export const DEFAULT_ASSAULT_CHALLENGE_CONFIG: Readonly<AssaultChallengeConfig> = deepFreeze({
  maxLabelChars: DEFAULT_ASSAULT_QUESTION_CONFIG.maxLabelChars,
  minSessionFamilies: 3,
  maxSessionFamilies: 4,
  maxConsecutiveSameFamily: 2,
  maxConsecutiveSameSide: 3,
  firstAppearanceExtraReadSeconds: 1.0,
  pairIndexDifficultyScale: [1.0, 1.15, 1.3, 1.5],
  rowsPerVariant: 20,
  pairsPerRow: 4,
  chapterFamilyWeights: {
    1: {
      rule_hunt: 1,
      duel: 0,
      equivalence: 1,
      progression: 1,
    },
    2: {
      rule_hunt: 1,
      duel: 1,
      equivalence: 1,
      progression: 1,
    },
    3: {
      rule_hunt: 0,
      duel: 1,
      equivalence: 1,
      progression: 0,
    },
    4: {
      rule_hunt: 0,
      duel: 1,
      equivalence: 1,
      progression: 0,
    },
    5: {
      rule_hunt: 1,
      duel: 1,
      equivalence: 0,
      progression: 1,
    },
  },
  familyTrapRules: {
    rule_hunt: {
      deltaOffsets: [-2, -1, 1, 2],
      reverseDigits: true,
      neighborOutOfRange: true,
    },
    duel: {
      diffRange: [0.01, 10],
      decimalPrecisionTrap: true,
      fractionDenominatorTrap: true,
    },
    equivalence: {
      operandTrapOffsets: [-2, -1, 1, 2],
    },
    progression: {
      deltaOffsets: [-1, 1],
      skipStepOffsets: [-1, 1],
    },
  },
});
