/**
 * AssaultQuestionEligibility - 접근전(Boss Assault) 문항 적격성 필터 및 읽기 시간 분류기
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§5.1, 15.1-A6, 15.3-C1, C9)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-39 / Issue #542)
 *
 * 책임 레이어: Question (순수 함수 필터)
 * 1. 숫자형 반복 보기에 부적합한 문항(비교 기호, 도형 shapeCode, 분수, 비유한 수, 6자 초과 라벨 등)을 진입 전에 제외한다.
 * 2. 승인된 챕터/레벨(Ch.1~2 / allowedLevels) 범위 외 문항을 제외한다.
 * 3. 텍스트 길이 임계치 및 레벨 가산 규칙표 기반으로 최소 읽기 시간(minReadSeconds)을 산출한다.
 * 4. 적격 문항 0개인 경우 명시적 오류({ eligibleCount: 0, error: 'no_eligible_questions' })를 반환한다.
 * 5. Math.random 미사용 및 불변성(deepFreeze) 보장.
 */

import {
  DEFAULT_ASSAULT_QUESTION_CONFIG,
  type AssaultQuestionConfig,
} from '../../config/assault-question.config.js';

// ─── 1. 타입 정의 ───

/** 부적격 제외 사유 */
export type AssaultIneligibilityReason =
  | 'out_of_chapter_range'
  | 'shape_code_present'
  | 'comparison_symbol'
  | 'fraction_answer'
  | 'non_numeric_answer'
  | 'label_length_exceeded';

/** 단순 분수 라벨 정규식 (분자/분모 자연수 형태, 예: 1/2, 5/14) */
export const SIMPLE_FRACTION_REGEX = /^\d+\/\d+$/;

/** 입력 대상 문항 후보 (QuestionRecord 또는 GeneratedQuestion 등) */
export interface QuestionCandidate {
  readonly level?: number;
  readonly subLevel?: number;
  readonly levelTitle?: string;
  readonly subLevelTitle?: string;
  readonly questionText?: string;
  readonly questionTemplate?: string;
  readonly correctAnswer?: number | string;
  readonly wrongAnswer?: number | string;
  readonly choices?: readonly (number | string)[];
  readonly answerEval?: string;
  readonly wrongEval?: string;
  readonly varA?: string;
  readonly varB?: string;
  readonly varC?: string;
  readonly varD?: string;
  readonly shapeCode?: string;
  readonly [key: string]: any;
}

/** 적격 판정 결과 */
export interface EligibleQuestionResult {
  readonly eligible: true;
  readonly question: Readonly<QuestionCandidate>;
  readonly minReadSeconds: number;
  readonly reason?: undefined;
}

/** 부적격 판정 결과 */
export interface IneligibleQuestionResult {
  readonly eligible: false;
  readonly question: Readonly<QuestionCandidate>;
  readonly reason: AssaultIneligibilityReason;
  readonly minReadSeconds?: undefined;
}

/** 단일 문항 적격성 판정 결과 */
export type QuestionEligibilityResult = EligibleQuestionResult | IneligibleQuestionResult;

/** 문항 풀 필터링 결과 */
export interface FilterEligibleQuestionsResult {
  readonly eligibleCount: number;
  readonly eligibleQuestions: readonly (Readonly<QuestionCandidate> & {
    readonly minReadSeconds: number;
    readonly question: Readonly<QuestionCandidate>;
  })[];
  readonly rejectedQuestions: readonly {
    readonly question: Readonly<QuestionCandidate>;
    readonly reason: AssaultIneligibilityReason;
  }[];
  readonly error?: 'no_eligible_questions';
}

// ─── 2. 보조 함수 ───

const COMPARISON_SYMBOLS = new Set(['>', '<', '=', '==', '===', '!=', '!==', '≤', '≥', '≠']);

function isComparisonSymbol(val: string): boolean {
  const trimmed = val.trim();
  if (COMPARISON_SYMBOLS.has(trimmed)) return true;
  return /^[><=≤≥≠]+$/.test(trimmed);
}

// ─── 3. 읽기 시간 계산 (순수 함수) ───

/**
 * 문항 텍스트 길이 및 레벨 기반 최소 읽기 시간(minReadSeconds) 산출 (DEC-C1)
 *
 * @param questionText 문제 지문
 * @param level 문제 레벨
 * @param config 규칙 설정 (생략 시 DEFAULT_ASSAULT_QUESTION_CONFIG)
 * @returns 초 단위 최소 읽기 시간 (기본 4.0초 + 임계치 초과 가산 + 레벨 가산)
 */
export function calculateMinReadSeconds(
  questionText: string = '',
  level: number = 1,
  config: AssaultQuestionConfig = DEFAULT_ASSAULT_QUESTION_CONFIG
): number {
  const text = (questionText || '').trim();
  const textLength = text.length;

  let lengthBonus = 0;
  if (config.readingLengthThresholds && Array.isArray(config.readingLengthThresholds)) {
    for (const threshold of config.readingLengthThresholds) {
      if (textLength > threshold.thresholdChars) {
        lengthBonus += threshold.additionalSeconds;
      }
    }
  }

  const levelBonus =
    config.levelAdditionalSeconds && typeof config.levelAdditionalSeconds[level] === 'number'
      ? config.levelAdditionalSeconds[level]
      : 0;

  const total = (config.baseReadingSeconds ?? 4.0) + lengthBonus + levelBonus;
  return Math.round(total * 100) / 100;
}

// ─── 4. 단일 문항 적격성 판정 (순수 함수) ───

/**
 * 단일 문항의 접근전 적격 여부 및 제외 사유를 판정
 *
 * @param question 판정 대상 문항
 * @param config 규칙 설정
 * @returns 적격 여부 및 사유 또는 minReadSeconds
 */
export function checkQuestionEligibility(
  question: QuestionCandidate,
  config: AssaultQuestionConfig = DEFAULT_ASSAULT_QUESTION_CONFIG
): QuestionEligibilityResult {
  // 1. 도형 shapeCode 존재 검사 (DEC-A6)
  if (config.disallowShapeCode !== false) {
    if (typeof question.shapeCode === 'string' && question.shapeCode.trim().length > 0) {
      return Object.freeze({
        eligible: false,
        question,
        reason: 'shape_code_present',
      });
    }
  }

  // 2. 정답 형태 검사 (비교 기호, 분수, 비유한 수, 라벨 길이)
  if (question.correctAnswer !== undefined) {
    const ans = question.correctAnswer;

    // (1) 비교 기호 검사
    if (typeof ans === 'string' && isComparisonSymbol(ans)) {
      return Object.freeze({
        eligible: false,
        question,
        reason: 'comparison_symbol',
      });
    }

    // (2) 분수 문자열 검사 ('1/2', '3/4' 등)
    const isFractionStr = typeof ans === 'string' && ans.includes('/');
    if (isFractionStr) {
      const trimmedAns = ans.trim();
      const isSimpleFraction = SIMPLE_FRACTION_REGEX.test(trimmedAns);

      if (config.allowSimpleFraction !== false && isSimpleFraction) {
        const [, denStr] = trimmedAns.split('/');
        const den = parseInt(denStr, 10);
        if (den === 0) {
          return Object.freeze({
            eligible: false,
            question,
            reason: 'fraction_answer',
          });
        }
        if (trimmedAns.length > config.maxLabelChars) {
          return Object.freeze({
            eligible: false,
            question,
            reason: 'label_length_exceeded',
          });
        }
        // 단순 분수 적격 통과
      } else {
        return Object.freeze({
          eligible: false,
          question,
          reason: 'fraction_answer',
        });
      }
    } else {
      // (3) 유한 숫자 검사 (분수가 아닌 경우에만)
      if (typeof ans === 'number') {
        if (!Number.isFinite(ans)) {
          return Object.freeze({
            eligible: false,
            question,
            reason: 'non_numeric_answer',
          });
        }
      } else if (typeof ans === 'string') {
        const trimmed = ans.trim();
        if (
          trimmed === '' ||
          trimmed.toLowerCase() === 'nan' ||
          trimmed.toLowerCase() === 'infinity' ||
          trimmed.toLowerCase() === '-infinity'
        ) {
          return Object.freeze({
            eligible: false,
            question,
            reason: 'non_numeric_answer',
          });
        }
        const num = Number(trimmed);
        if (isNaN(num) || !Number.isFinite(num)) {
          return Object.freeze({
            eligible: false,
            question,
            reason: 'non_numeric_answer',
          });
        }
      } else {
        return Object.freeze({
          eligible: false,
          question,
          reason: 'non_numeric_answer',
        });
      }

      // (4) 라벨 길이 상한 검사 (DEC-C9: 6자 이내)
      const label = typeof ans === 'number' ? String(ans) : String(ans).trim();
      if (label.length > config.maxLabelChars) {
        return Object.freeze({
          eligible: false,
          question,
          reason: 'label_length_exceeded',
        });
      }
    }
  } else if (typeof question.answerEval === 'string') {
    // raw QuestionRecord 정적 분석
    const evalStr = question.answerEval;

    // 비교 기호 수식 검사
    if (
      evalStr.includes("'>'") ||
      evalStr.includes("'<'") ||
      evalStr.includes("'='") ||
      evalStr.includes("'≠'") ||
      (evalStr.includes("'") && /[><=]/.test(evalStr) && /'([><=≠])'/.test(evalStr))
    ) {
      return Object.freeze({
        eligible: false,
        question,
        reason: 'comparison_symbol',
      });
    }

    // 분수 수식 검사
    if (
      evalStr.includes("'/'") ||
      evalStr.includes('"/"') ||
      /\+'\/'\+/.test(evalStr) ||
      /'\d+\/\d+'/.test(evalStr)
    ) {
      if (config.allowSimpleFraction === false) {
        return Object.freeze({
          eligible: false,
          question,
          reason: 'fraction_answer',
        });
      }

      // config.allowSimpleFraction: true인 경우
      // 비단순 분수식(예: 대분수 '과', 음수 분수 '-', 복합 텍스트)은 제외
      if (evalStr.includes("'과'") || evalStr.includes("'-'") || /'[가-힣a-zA-Z]{2,}'/.test(evalStr)) {
        return Object.freeze({
          eligible: false,
          question,
          reason: 'fraction_answer',
        });
      }
    } else if (/'[가-힣a-zA-Z]{2,}'/.test(evalStr)) {
      // 한글 등 비숫자 텍스트 검사 (분수 수식이 아닌 경우)
      return Object.freeze({
        eligible: false,
        question,
        reason: 'non_numeric_answer',
      });
    }

    // 상수 숫자 라벨 길이 검사
    const trimmedEval = evalStr.trim();
    const staticNum = Number(trimmedEval);
    if (!isNaN(staticNum) && trimmedEval.length > config.maxLabelChars) {
      return Object.freeze({
        eligible: false,
        question,
        reason: 'label_length_exceeded',
      });
    }
  }

  // 3. 레벨 범위 검사 (Ch.1~2 / allowedLevels)
  const level = question.level;
  if (
    typeof level !== 'number' ||
    !config.allowedLevels ||
    !config.allowedLevels.includes(level)
  ) {
    return Object.freeze({
      eligible: false,
      question,
      reason: 'out_of_chapter_range',
    });
  }

  // 4. 모든 적격 조건 통과 -> 최소 읽기 시간 계산 후 결과 반환
  const text = question.questionText ?? question.questionTemplate ?? '';
  const minReadSeconds = calculateMinReadSeconds(text, level, config);

  return Object.freeze({
    eligible: true,
    question,
    minReadSeconds,
  });
}

// ─── 5. 문항 풀 필터링 (순수 함수) ───

/**
 * 문항 배열에서 접근전 적격 문항만 필터링하고 읽기 시간을 부여
 *
 * @param questions 입력 문항 목록
 * @param config 규칙 설정
 * @returns 적격 문항 목록 및 부적격 문항 목록, 0개 시 error 반환
 */
export function filterEligibleQuestions(
  questions: readonly QuestionCandidate[],
  config: AssaultQuestionConfig = DEFAULT_ASSAULT_QUESTION_CONFIG
): FilterEligibleQuestionsResult {
  const eligibleQuestions: (Readonly<QuestionCandidate> & {
    readonly minReadSeconds: number;
    readonly question: Readonly<QuestionCandidate>;
  })[] = [];

  const rejectedQuestions: {
    readonly question: Readonly<QuestionCandidate>;
    readonly reason: AssaultIneligibilityReason;
  }[] = [];

  for (const q of questions) {
    const check = checkQuestionEligibility(q, config);
    if (check.eligible) {
      eligibleQuestions.push(
        Object.freeze({
          ...q,
          minReadSeconds: check.minReadSeconds,
          question: Object.freeze({ ...q }),
        })
      );
    } else {
      rejectedQuestions.push(
        Object.freeze({
          question: Object.freeze({ ...q }),
          reason: check.reason,
        })
      );
    }
  }

  if (eligibleQuestions.length === 0) {
    return Object.freeze({
      eligibleCount: 0,
      eligibleQuestions: Object.freeze([]),
      rejectedQuestions: Object.freeze(rejectedQuestions),
      error: 'no_eligible_questions',
    });
  }

  return Object.freeze({
    eligibleCount: eligibleQuestions.length,
    eligibleQuestions: Object.freeze(eligibleQuestions),
    rejectedQuestions: Object.freeze(rejectedQuestions),
  });
}
