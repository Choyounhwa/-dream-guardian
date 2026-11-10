/**
 * ChallengeCsvValidator.ts - 챌린지 CSV 행 독립 검증기
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 5, 11.2)
 * @see Issue #667 [ASSAULT-CHALLENGE-CH-21]
 *
 * 책임 레이어: Question
 * 1. DOC-18 §11.2 CSV 스키마에 정의된 CSV 행(26개 열, CH-23 / #680) 및 텍스트를 독립적으로 파싱/검증.
 * 2. ID 형식/중복, 카탈로그 14유형 및 계열/챕터 정합성, params 구문 분석.
 * 3. 보기 쌍(n=1..pairsPerRow) 라벨 길이, 식 안전 파싱, 음수/NaN 배제, 좌우 상이성, D 계열 pairPrompt 검증.
 * 4. ChallengePairValidator(CH-12)를 통한 계열별 불변식 및 정답 유일성 재계산.
 * 5. reviewStatus('draft'|'approved'|'rejected'), seed, rulesVersion 검증.
 * 6. 순수 모듈: Math.random/Date.now/DOM/Canvas/localStorage 일체 금지. eval/safeEval 절대 금지.
 * 7. 모든 반환 객체는 deepFreeze를 통해 불변성 보장.
 */

import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../../../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../data/assault/challengeCatalog.js';
import type { AssaultChallengeVariantId } from '../../types/assaultChallenge.js';
import type { AssaultAnswerPair } from '../AssaultAnswerPairFactory.js';
import {
  parseExpressionLabel,
  calculateLabelLength,
  type ChallengeExpressionResult,
} from './ChallengeExpression.js';
import {
  validateChallengeRound,
  type ChallengePairValidationErrorCode,
} from './ChallengePairValidator.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

// ─── 1. CSV 스키마 상수 정의 ───

/** CSV 한 행당 보기 쌍 수 (SSOT: DEFAULT_ASSAULT_CHALLENGE_CONFIG.pairsPerRow, CH-23 / #680) */
export const CHALLENGE_CSV_PAIRS_PER_ROW: number = DEFAULT_ASSAULT_CHALLENGE_CONFIG.pairsPerRow;

/** 1-based 쌍 번호 배열 [1..pairsPerRow] */
export const CHALLENGE_CSV_PAIR_NUMBERS: readonly number[] = deepFreeze(
  Array.from({ length: CHALLENGE_CSV_PAIRS_PER_ROW }, (_, i) => i + 1),
);

/** 쌍별 열 접미사 순서 */
const PAIR_COLUMN_SUFFIXES = ['left', 'right', 'correct', 'prompt'] as const;

export const CHALLENGE_CSV_HEADER_COLUMNS: readonly string[] = deepFreeze([
  'id',
  'variantId',
  'family',
  'chapter',
  'level',
  'questionText',
  'params',
  ...CHALLENGE_CSV_PAIR_NUMBERS.flatMap((n) => PAIR_COLUMN_SUFFIXES.map((s) => `p${n}_${s}`)),
  'seed',
  'rulesVersion',
  'reviewStatus',
]);

export const CHALLENGE_CSV_HEADER: string = CHALLENGE_CSV_HEADER_COLUMNS.join(',');

export const VALID_REVIEW_STATUSES = deepFreeze(['draft', 'approved', 'rejected'] as const);
export type ChallengeReviewStatus = (typeof VALID_REVIEW_STATUSES)[number];

// ─── 2. 타입 및 인터페이스 계약 ───

export interface ChallengeCsvRow {
  readonly id: string;
  readonly variantId: string;
  readonly family: string;
  readonly chapter: string | number;
  readonly level: string | number;
  readonly questionText: string;
  readonly params: string;
  readonly p1_left: string;
  readonly p1_right: string;
  readonly p1_correct: string;
  readonly p1_prompt: string;
  readonly p2_left: string;
  readonly p2_right: string;
  readonly p2_correct: string;
  readonly p2_prompt: string;
  readonly p3_left: string;
  readonly p3_right: string;
  readonly p3_correct: string;
  readonly p3_prompt: string;
  readonly p4_left: string;
  readonly p4_right: string;
  readonly p4_correct: string;
  readonly p4_prompt: string;
  readonly seed: string | number;
  readonly rulesVersion: string;
  readonly reviewStatus: string;
}

export type CsvRowValidationErrorCode =
  | ChallengePairValidationErrorCode
  | 'INVALID_ID_FORMAT'
  | 'DUPLICATE_ID'
  | 'UNKNOWN_VARIANT_ID'
  | 'FAMILY_MISMATCH'
  | 'INVALID_CHAPTER'
  | 'CHAPTER_MISMATCH'
  | 'INVALID_LEVEL'
  | 'MISSING_QUESTION_TEXT'
  | 'INVALID_PARAMS'
  | 'INVALID_CORRECT_SIDE'
  | 'MISSING_PAIR_PROMPT'
  | 'UNEXPECTED_PAIR_PROMPT'
  | 'INVALID_REVIEW_STATUS'
  | 'INVALID_SEED'
  | 'INVALID_RULES_VERSION'
  | 'INVALID_COLUMN_COUNT'
  | 'INVALID_CSV_HEADER'
  | 'INVALID_EXPRESSION';

export interface CsvRowValidationError {
  readonly rowIndex?: number;
  readonly id?: string;
  readonly code: CsvRowValidationErrorCode | string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CsvValidationResult {
  readonly isValid: boolean;
  readonly rowCount: number;
  readonly errors: readonly CsvRowValidationError[];
}

export interface ValidateChallengeCsvOptions {
  readonly maxLabelChars?: number;
  readonly maxConsecutiveSameSide?: number;
  readonly checkSequenceConsecutive?: boolean;
}

// ─── 3. 내부 순수 유틸리티 ───

/**
 * 따옴표 인식 CSV 라인 파서 (순수 함수)
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * params 문자열 파싱 (예: "k=6" 또는 "start=2;step=3")
 */
function parseParamsString(rawParams: unknown): {
  paramsMap: Record<string, number>;
  isValid: boolean;
  error?: string;
} {
  if (typeof rawParams !== 'string') {
    return { paramsMap: {}, isValid: false, error: 'params must be a string' };
  }

  const trimmed = rawParams.trim();
  if (trimmed === '') {
    return { paramsMap: {}, isValid: false, error: 'params cannot be empty' };
  }

  const tokens = trimmed.split(';');
  const paramsMap: Record<string, number> = {};

  for (const token of tokens) {
    const part = token.trim();
    if (part === '') continue;

    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0 || eqIndex === part.length - 1) {
      return {
        paramsMap: {},
        isValid: false,
        error: `Invalid param token "${part}" (must be key=value)`,
      };
    }

    const key = part.slice(0, eqIndex).trim();
    const valStr = part.slice(eqIndex + 1).trim();
    const valNum = Number(valStr);

    if (Number.isNaN(valNum) || !Number.isFinite(valNum)) {
      return {
        paramsMap: {},
        isValid: false,
        error: `Param value for "${key}" is not a finite number ("${valStr}")`,
      };
    }

    paramsMap[key] = valNum;
  }

  if (Object.keys(paramsMap).length === 0) {
    return { paramsMap: {}, isValid: false, error: 'No valid key=value pairs found in params' };
  }

  return { paramsMap, isValid: true };
}

/**
 * 보기 수식 라벨 안전 파싱 및 음수/NaN 검증 헬퍼 (순수)
 */
function parseAndValidateChoice(
  text: string,
  pairIndex: number,
  side: 'left' | 'right',
  rowIndex: number | undefined,
  idStr: string,
  errors: CsvRowValidationError[],
): ChallengeExpressionResult | null {
  try {
    const res = parseExpressionLabel(text);
    if (
      res.value.numerator < 0 ||
      res.value.denominator <= 0 ||
      !Number.isFinite(res.value.numerator / res.value.denominator)
    ) {
      errors.push({
        rowIndex,
        id: idStr || undefined,
        code: 'NEGATIVE_OR_NAN',
        message: `p${pairIndex}_${side} resulted in negative or non-finite value`,
        details: { pairIndex, side, text },
      });
      return null;
    }
    return res;
  } catch (e) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_EXPRESSION',
      message: `p${pairIndex}_${side} "${text}" is not a valid expression: ${(e as Error).message}`,
      details: { pairIndex, side, text },
    });
    return null;
  }
}

// ─── 4. 단일 CSV 행 검증 함수 ───

/**
 * 챌린지 CSV 행 1개를 독립적으로 검증한다.
 *
 * @param row 챌린지 CSV 행 데이터 (객체 형태)
 * @param rowIndex 행 번호 (1-based, 선택)
 * @param options 검증 옵션
 * @returns 발생한 오류 목록 (오류 없으면 빈 배열)
 */
export function validateChallengeCsvRow(
  row: ChallengeCsvRow | Record<string, string | number>,
  rowIndex?: number,
  options?: ValidateChallengeCsvOptions,
): readonly CsvRowValidationError[] {
  const errors: CsvRowValidationError[] = [];
  const maxLabelChars = options?.maxLabelChars ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars;
  const maxConsecutiveSameSide =
    options?.maxConsecutiveSameSide ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide;

  const idStr = typeof row.id === 'string' ? row.id.trim() : String(row.id ?? '');
  const variantIdStr =
    typeof row.variantId === 'string' ? row.variantId.trim() : String(row.variantId ?? '');
  const familyStr = typeof row.family === 'string' ? row.family.trim() : String(row.family ?? '');

  // 1. variantId 카탈로그 존재 확인
  const isKnownVariant = variantIdStr in ASSAULT_CHALLENGE_CATALOG;
  const catalogDef = isKnownVariant
    ? ASSAULT_CHALLENGE_CATALOG[variantIdStr as AssaultChallengeVariantId]
    : undefined;

  if (!isKnownVariant || !catalogDef) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'UNKNOWN_VARIANT_ID',
      message: `Unknown variantId "${variantIdStr}"`,
      details: { variantId: variantIdStr },
    });
  }

  // 2. id 형식 확인: {variant접두}-{4자리} (예: A1-0007)
  const expectedPrefix = catalogDef ? catalogDef.variantId.split('_')[0] : null;
  const genericIdMatch = idStr.match(/^([A-Z][0-9])-(\d{4})$/);

  if (!genericIdMatch) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_ID_FORMAT',
      message: `id "${idStr}" does not match required format "{variantPrefix}-XXXX" (e.g. A1-0001)`,
      details: { id: idStr },
    });
  } else if (expectedPrefix && genericIdMatch[1] !== expectedPrefix) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_ID_FORMAT',
      message: `id prefix "${genericIdMatch[1]}" does not match variant prefix "${expectedPrefix}"`,
      details: { id: idStr, expectedPrefix },
    });
  }

  // 3. family 정합성 확인
  if (catalogDef && familyStr !== catalogDef.family) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'FAMILY_MISMATCH',
      message: `family "${familyStr}" does not match expected "${catalogDef.family}" for variantId "${variantIdStr}"`,
      details: { family: familyStr, expected: catalogDef.family },
    });
  }

  // 4. chapter 확인 (1~5 정수 & 카탈로그 허용 챕터 포함 여부)
  const chapterNum = Number(row.chapter);
  if (
    row.chapter === undefined ||
    row.chapter === null ||
    row.chapter === '' ||
    !Number.isInteger(chapterNum) ||
    chapterNum < 1 ||
    chapterNum > 5
  ) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_CHAPTER',
      message: `chapter must be an integer between 1 and 5 (got "${row.chapter}")`,
      details: { chapter: row.chapter },
    });
  } else if (catalogDef && !catalogDef.chapters.includes(chapterNum)) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'CHAPTER_MISMATCH',
      message: `chapter ${chapterNum} is not allowed for variantId "${variantIdStr}" (allowed: ${catalogDef.chapters.join(', ')})`,
      details: { chapter: chapterNum, allowed: catalogDef.chapters },
    });
  }

  // 5. level 확인 (정수 >= 1)
  const levelNum = Number(row.level);
  if (
    row.level === undefined ||
    row.level === null ||
    row.level === '' ||
    !Number.isInteger(levelNum) ||
    levelNum < 1
  ) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_LEVEL',
      message: `level must be an integer >= 1 (got "${row.level}")`,
      details: { level: row.level },
    });
  }

  // 6. questionText 확인
  const questionTextStr =
    typeof row.questionText === 'string'
      ? row.questionText.trim()
      : String(row.questionText ?? '').trim();
  if (questionTextStr === '') {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'MISSING_QUESTION_TEXT',
      message: 'questionText must be a non-empty string',
    });
  }

  // 7. params 구문 파싱 및 검증
  const parsedParams = parseParamsString(row.params);
  if (!parsedParams.isValid) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_PARAMS',
      message: `Invalid params: ${parsedParams.error}`,
      details: { params: row.params },
    });
  }

  // 8. reviewStatus 확인 ('draft' | 'approved' | 'rejected')
  const reviewStatusStr = String(row.reviewStatus ?? '').trim();
  if (!VALID_REVIEW_STATUSES.includes(reviewStatusStr as ChallengeReviewStatus)) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_REVIEW_STATUS',
      message: `reviewStatus must be "draft", "approved", or "rejected" (got "${row.reviewStatus}")`,
      details: { reviewStatus: row.reviewStatus },
    });
  }

  // 9. seed 확인 (정수)
  const seedNum = Number(row.seed);
  if (
    row.seed === undefined ||
    row.seed === null ||
    row.seed === '' ||
    !Number.isInteger(seedNum)
  ) {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_SEED',
      message: `seed must be an integer (got "${row.seed}")`,
      details: { seed: row.seed },
    });
  }

  // 10. rulesVersion 확인 (비어있지 않은 문자열)
  const rulesVersionStr = String(row.rulesVersion ?? '').trim();
  if (rulesVersionStr === '') {
    errors.push({
      rowIndex,
      id: idStr || undefined,
      code: 'INVALID_RULES_VERSION',
      message: 'rulesVersion must be a non-empty string',
      details: { rulesVersion: row.rulesVersion },
    });
  }

  // 11. 보기 쌍(n=1..pairsPerRow) 개별 검증 및 파싱
  const isProgression =
    catalogDef?.family === 'progression' || familyStr === 'progression';

  const record = row as unknown as Record<string, unknown>;
  const parsedLeftChoices: (ChallengeExpressionResult | null)[] = [];
  const parsedRightChoices: (ChallengeExpressionResult | null)[] = [];
  const correctSides: ('L' | 'R')[] = [];
  let allChoicesParsedSuccessfully = true;

  for (const n of CHALLENGE_CSV_PAIR_NUMBERS) {
    const leftText = String(record[`p${n}_left`] ?? '').trim();
    const rightText = String(record[`p${n}_right`] ?? '').trim();
    const correctSide = String(record[`p${n}_correct`] ?? '').trim().toUpperCase();
    const promptText = String(record[`p${n}_prompt`] ?? '').trim();

    // 11.1 correctSide 확인
    if (correctSide !== 'L' && correctSide !== 'R') {
      errors.push({
        rowIndex,
        id: idStr || undefined,
        code: 'INVALID_CORRECT_SIDE',
        message: `p${n}_correct must be "L" or "R" (got "${record[`p${n}_correct`]}")`,
        details: { pairIndex: n, correctSide: record[`p${n}_correct`] },
      });
    } else {
      correctSides.push(correctSide as 'L' | 'R');
    }

    // 11.2 prompt 확인 (D 계열은 필수, 비D 계열은 빈 문자열)
    if (isProgression) {
      if (promptText === '') {
        errors.push({
          rowIndex,
          id: idStr || undefined,
          code: 'MISSING_PAIR_PROMPT',
          message: `p${n}_prompt must be present for progression family`,
          details: { pairIndex: n },
        });
      }
    } else {
      if (promptText !== '') {
        errors.push({
          rowIndex,
          id: idStr || undefined,
          code: 'UNEXPECTED_PAIR_PROMPT',
          message: `p${n}_prompt must be empty for non-progression family (got "${promptText}")`,
          details: { pairIndex: n, prompt: promptText },
        });
      }
    }

    // 11.3 라벨 길이 검증 (LABEL_TOO_LONG)
    if (calculateLabelLength(leftText) > maxLabelChars) {
      errors.push({
        rowIndex,
        id: idStr || undefined,
        code: 'LABEL_TOO_LONG',
        message: `p${n}_left label "${leftText}" length (${calculateLabelLength(leftText)}) exceeds maxLabelChars (${maxLabelChars})`,
        details: { pairIndex: n, side: 'left', text: leftText, maxLabelChars },
      });
    }
    if (calculateLabelLength(rightText) > maxLabelChars) {
      errors.push({
        rowIndex,
        id: idStr || undefined,
        code: 'LABEL_TOO_LONG',
        message: `p${n}_right label "${rightText}" length (${calculateLabelLength(rightText)}) exceeds maxLabelChars (${maxLabelChars})`,
        details: { pairIndex: n, side: 'right', text: rightText, maxLabelChars },
      });
    }

    // 11.4 텍스트 동일성 검증 (DUPLICATE_CHOICES)
    if (leftText === rightText && leftText !== '') {
      errors.push({
        rowIndex,
        id: idStr || undefined,
        code: 'DUPLICATE_CHOICES',
        message: `p${n}_left and p${n}_right have identical text "${leftText}"`,
        details: { pairIndex: n },
      });
    }

    // 11.5 수식 파싱
    const leftResult = parseAndValidateChoice(leftText, n, 'left', rowIndex, idStr, errors);
    const rightResult = parseAndValidateChoice(rightText, n, 'right', rowIndex, idStr, errors);

    if (!leftResult || !rightResult) {
      allChoicesParsedSuccessfully = false;
    } else {
      // 11.6 계산된 수치 동등성 검증 (DUPLICATE_CHOICES)
      if (leftResult.value.equals(rightResult.value) && leftText !== rightText) {
        errors.push({
          rowIndex,
          id: idStr || undefined,
          code: 'DUPLICATE_CHOICES',
          message: `p${n}_left ("${leftText}") and p${n}_right ("${rightText}") evaluate to the same value`,
          details: { pairIndex: n },
        });
      }
    }

    parsedLeftChoices.push(leftResult);
    parsedRightChoices.push(rightResult);
  }

  // 12. 전체 쌍이 성공적으로 파싱되고 카탈로그/params가 유효한 경우, ChallengePairValidator를 통한 계열 규칙 및 불변식 재계산
  if (
    allChoicesParsedSuccessfully &&
    catalogDef &&
    parsedParams.isValid &&
    correctSides.length === CHALLENGE_CSV_PAIRS_PER_ROW
  ) {
    const pairs: AssaultAnswerPair[] = CHALLENGE_CSV_PAIR_NUMBERS.map((n) => {
      const idx = n - 1;
      const leftParsed = parsedLeftChoices[idx]!;
      const rightParsed = parsedRightChoices[idx]!;
      const leftVal = leftParsed.value.numerator / leftParsed.value.denominator;
      const rightVal = rightParsed.value.numerator / rightParsed.value.denominator;
      const isLeft = correctSides[idx] === 'L';

      return {
        pairId: `${idStr}-p${n}`,
        left: {
          value: leftVal,
          text: String(record[`p${n}_left`]),
          isCorrect: isLeft,
        },
        right: {
          value: rightVal,
          text: String(record[`p${n}_right`]),
          isCorrect: !isLeft,
        },
        correctSide: isLeft ? 'left' : 'right',
        choices: [
          { value: leftVal, text: String(record[`p${n}_left`]), isCorrect: isLeft },
          { value: rightVal, text: String(record[`p${n}_right`]), isCorrect: !isLeft },
        ],
      };
    });

    const pairPrompts = CHALLENGE_CSV_PAIR_NUMBERS.map((n) => {
      const p = String(record[`p${n}_prompt`] ?? '').trim();
      return p !== '' ? p : null;
    });

    const roundValidation = validateChallengeRound({
      variantId: catalogDef.variantId,
      family: catalogDef.family,
      questionText: questionTextStr,
      pairPrompts,
      params: parsedParams.paramsMap,
      pairs,
      options: {
        maxLabelChars,
        maxConsecutiveSameSide,
      },
    });

    for (const roundErr of roundValidation.errors) {
      // 이미 발생한 LABEL_TOO_LONG / NEGATIVE_OR_NAN / DUPLICATE_CHOICES 중복 방지
      const alreadyReported = errors.some(
        (e) =>
          e.code === roundErr.code &&
          (roundErr.pairIndex === undefined ||
            (e.details?.pairIndex !== undefined &&
              e.details.pairIndex === roundErr.pairIndex + 1)),
      );

      if (!alreadyReported) {
        errors.push({
          rowIndex,
          id: idStr || undefined,
          code: roundErr.code,
          message: roundErr.message,
          details: {
            ...roundErr.details,
            pairIndex:
              roundErr.pairIndex !== undefined ? roundErr.pairIndex + 1 : undefined,
            side: roundErr.side,
          },
        });
      }
    }
  }

  return deepFreeze(errors);
}

// ─── 5. 전체 CSV 텍스트 검증 함수 ───

/**
 * CSV 파일 텍스트 전체를 파싱 및 독립 검증한다.
 *
 * @param csvText CSV 전체 텍스트
 * @param options 검증 옵션 (전역 연속 제한, 최대 라벨 길이 등)
 * @returns 종합 검증 결과
 */
export function validateChallengeCsvText(
  csvText: string,
  options?: ValidateChallengeCsvOptions,
): CsvValidationResult {
  const allErrors: CsvRowValidationError[] = [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return deepFreeze({
      isValid: true,
      rowCount: 0,
      errors: [],
    });
  }

  // 1. 헤더 검증
  const headerFields = parseCsvLine(lines[0]);
  let isHeaderValid = true;

  if (headerFields.length !== CHALLENGE_CSV_HEADER_COLUMNS.length) {
    isHeaderValid = false;
  } else {
    for (let i = 0; i < CHALLENGE_CSV_HEADER_COLUMNS.length; i++) {
      if (headerFields[i] !== CHALLENGE_CSV_HEADER_COLUMNS[i]) {
        isHeaderValid = false;
        break;
      }
    }
  }

  if (!isHeaderValid) {
    allErrors.push({
      rowIndex: 1,
      code: 'INVALID_CSV_HEADER',
      message: `CSV header does not match expected schema. Expected: "${CHALLENGE_CSV_HEADER}"`,
      details: { expected: CHALLENGE_CSV_HEADER_COLUMNS, actual: headerFields },
    });
  }

  // 2. 데이터 행 파싱 및 검증
  const seenIds = new Set<string>();
  const maxConsecutiveSameSide =
    options?.maxConsecutiveSameSide ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxConsecutiveSameSide;
  let sequenceLastSide: 'L' | 'R' | null = null;
  let sequenceConsecutiveCount = 0;
  let dataRowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const rowIndex = i + 1; // 1-based line number
    const fields = parseCsvLine(rawLine);

    if (fields.length !== CHALLENGE_CSV_HEADER_COLUMNS.length) {
      allErrors.push({
        rowIndex,
        id: fields[0] || undefined,
        code: 'INVALID_COLUMN_COUNT',
        message: `Expected ${CHALLENGE_CSV_HEADER_COLUMNS.length} columns but found ${fields.length}`,
        details: { expected: CHALLENGE_CSV_HEADER_COLUMNS.length, actual: fields.length },
      });
      continue;
    }

    dataRowCount++;

    // 헤더 열 이름 순서(SSOT)로 필드 매핑
    const mapped: Record<string, string> = {};
    CHALLENGE_CSV_HEADER_COLUMNS.forEach((col, idx) => {
      mapped[col] = fields[idx];
    });
    const row = mapped as unknown as ChallengeCsvRow;

    // ID 중복 검증
    if (row.id) {
      if (seenIds.has(row.id)) {
        allErrors.push({
          rowIndex,
          id: row.id,
          code: 'DUPLICATE_ID',
          message: `Duplicate id "${row.id}" found at line ${rowIndex}`,
          details: { id: row.id },
        });
      }
      seenIds.add(row.id);
    }

    // 전역/시퀀스 연속 같은 쪽 정답 검증 (옵션 지정 시)
    if (options?.checkSequenceConsecutive) {
      for (const n of CHALLENGE_CSV_PAIR_NUMBERS) {
        const side = mapped[`p${n}_correct`]?.trim().toUpperCase();
        if (side === 'L' || side === 'R') {
          if (side === sequenceLastSide) {
            sequenceConsecutiveCount++;
          } else {
            sequenceConsecutiveCount = 1;
            sequenceLastSide = side;
          }

          if (sequenceConsecutiveCount > maxConsecutiveSameSide) {
            allErrors.push({
              rowIndex,
              id: row.id,
              code: 'CONSECUTIVE_SAME_SIDE_EXCEEDED',
              message: `Sequence consecutive "${side}" answers reached ${sequenceConsecutiveCount}, exceeding limit (${maxConsecutiveSameSide}) at line ${rowIndex}`,
              details: {
                consecutiveCount: sequenceConsecutiveCount,
                maxConsecutiveSameSide,
              },
            });
          }
        }
      }
    }

    // 행 단위 정밀 검증
    const rowErrors = validateChallengeCsvRow(row, rowIndex, options);
    for (const err of rowErrors) {
      allErrors.push(err);
    }
  }

  return deepFreeze({
    isValid: allErrors.length === 0,
    rowCount: dataRowCount,
    errors: allErrors,
  });
}
