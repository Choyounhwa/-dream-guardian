/**
 * ChallengeCsvWriter.ts - 챌린지 CSV 직렬화 순수 모듈
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 5, 11.2)
 * @see Issue #666 [ASSAULT-CHALLENGE-CH-20]
 *
 * 책임 레이어: Question
 * 1. DOC-18 §11.2 CSV 스키마(CH-23 / #680: 26열, p1~p4)에 정의된 고정 헤더 순서로 행 데이터를 CSV 문자열로 직렬화.
 * 2. 라벨(p{n}_left, p{n}_right)에 쉼표(,) 포함 시 즉시 에러 발생 (DOC-18 §11.2 제약: 라벨 내 쉼표 절대 금지).
 * 3. 텍스트 필드(질문 문구, 보조 문구 등) 내 특수문자(쉼표, 큰따옴표, 개행) 표준 CSV 이스케이프.
 * 4. 라운드 생성 결과(RuleHunt, Duel, Equivalence, Progression)를 ChallengeCsvRow로 변환하는 순수 헬퍼 제공.
 * 5. 기본 reviewStatus는 'draft', rulesVersion은 '1.0.0'.
 * 6. 순수 함수 모듈: Math.random/Date.now/DOM/Canvas/localStorage 일체 금지. eval/safeEval 절대 금지.
 */

import {
  CHALLENGE_CSV_HEADER,
  CHALLENGE_CSV_HEADER_COLUMNS,
  CHALLENGE_CSV_PAIR_NUMBERS,
  CHALLENGE_CSV_PAIRS_PER_ROW,
  type ChallengeCsvRow,
  type ChallengeReviewStatus,
} from './ChallengeCsvValidator.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/** 라운드 객체에서 CSV 행으로 변환 시 필요한 메타 옵션 */
export interface RoundToCsvRowOptions {
  readonly id: string;
  readonly chapter: number;
  readonly level: number;
  readonly seed: number;
  readonly rulesVersion?: string;
  readonly reviewStatus?: ChallengeReviewStatus;
}

/** 보기 쌍의 최소 인터페이스 요건 */
export interface GenericChallengePair {
  readonly left: { readonly text: string };
  readonly right: { readonly text: string };
  readonly correctSide: 'left' | 'right';
}

/** 4개 계열 라운드 결과의 공통 표현 */
export interface GenericChallengeRound<TPair extends GenericChallengePair = GenericChallengePair> {
  readonly variantId: string;
  readonly family: string;
  readonly questionText: string;
  readonly params: Readonly<Record<string, number>>;
  readonly pairs: readonly TPair[];
  readonly pairPrompts?: readonly (string | null)[];
}

/**
 * 보기 라벨 쉼표 포함 여부 검증 (순수 함수)
 * DOC-18 §11.2: 보기 라벨에 쉼표(,)는 절대 허용되지 않음
 */
function assertNoCommaInLabel(label: string, fieldName: string, rowId: string): void {
  if (label.includes(',')) {
    throw new Error(
      `[ChallengeCsvWriter] Label contains comma (DOC-18 §11.2 forbidden): "${label}" in ${fieldName} for row "${rowId}"`,
    );
  }
}

/**
 * 개별 CSV 셀 값 이스케이프 (순수 함수)
 * 쉼표, 큰따옴표, 개행 문자가 포함되어 있으면 큰따옴표로 감싸고 내부 따옴표를 이중화("")한다.
 */
function escapeCsvCell(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 단일 ChallengeCsvRow 객체를 CHALLENGE_CSV_HEADER_COLUMNS(26열, CH-23 / #680) 순서의 CSV 행 문자열로 변환한다.
 */
export function formatChallengeCsvRow(row: ChallengeCsvRow): string {
  const rowId = String(row.id ?? '').trim();
  const record = row as unknown as Record<string, unknown>;

  // 1. 라벨 쉼표 포함 금지 제약 검증
  for (const n of CHALLENGE_CSV_PAIR_NUMBERS) {
    for (const side of ['left', 'right'] as const) {
      const field = `p${n}_${side}`;
      assertNoCommaInLabel(String(record[field] ?? ''), field, rowId);
    }
  }

  // 2. 기본값 보정
  const reviewStatus = (
    row.reviewStatus && String(row.reviewStatus).trim() !== ''
      ? String(row.reviewStatus).trim()
      : 'draft'
  ) as ChallengeReviewStatus;

  const rulesVersion =
    row.rulesVersion && String(row.rulesVersion).trim() !== ''
      ? String(row.rulesVersion).trim()
      : '1.0.0';

  // 3. 헤더 열 순서(SSOT) 엄격 매핑
  const overrides: Record<string, unknown> = { rulesVersion, reviewStatus };
  const cells: string[] = CHALLENGE_CSV_HEADER_COLUMNS.map((col) => {
    const value = col in overrides ? overrides[col] : record[col];
    return escapeCsvCell(col.endsWith('_prompt') ? (value ?? '') : value);
  });

  return cells.join(',');
}

/**
 * ChallengeCsvRow 배열 전체를 유효한 CSV 문자열(헤더 포함)로 직렬화한다.
 */
export function writeChallengeCsv(rows: readonly ChallengeCsvRow[]): string {
  if (rows.length === 0) {
    return `${CHALLENGE_CSV_HEADER}\n`;
  }

  const lines = [CHALLENGE_CSV_HEADER];
  for (const row of rows) {
    lines.push(formatChallengeCsvRow(row));
  }

  return `${lines.join('\n')}\n`;
}

/**
 * 라운드 결과 객체와 메타데이터를 기반으로 불변 ChallengeCsvRow 객체를 생성한다.
 */
export function roundToChallengeCsvRow(
  round: GenericChallengeRound,
  options: RoundToCsvRowOptions,
): ChallengeCsvRow {
  if (!round.pairs || round.pairs.length < CHALLENGE_CSV_PAIRS_PER_ROW) {
    throw new Error(
      `[ChallengeCsvWriter] Challenge round must have at least ${CHALLENGE_CSV_PAIRS_PER_ROW} pairs, got ${round.pairs?.length ?? 0}`,
    );
  }

  // params 맵을 key 기준 오름차순 정렬하여 결정론적 'k=v;k=v' 형식으로 변환
  const paramEntries = Object.entries(round.params ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const paramsStr = paramEntries.map(([k, v]) => `${k}=${v}`).join(';');

  // 쌍 열(p1~pN) 매핑
  const pairColumns: Record<string, string> = {};
  for (const n of CHALLENGE_CSV_PAIR_NUMBERS) {
    const pair = round.pairs[n - 1];
    pairColumns[`p${n}_left`] = pair.left.text;
    pairColumns[`p${n}_right`] = pair.right.text;
    pairColumns[`p${n}_correct`] = pair.correctSide === 'left' ? 'L' : 'R';
    pairColumns[`p${n}_prompt`] = round.pairPrompts?.[n - 1] ?? '';
  }

  const row = {
    id: options.id,
    variantId: round.variantId,
    family: round.family,
    chapter: options.chapter,
    level: options.level,
    questionText: round.questionText,
    params: paramsStr,
    ...pairColumns,
    seed: options.seed,
    rulesVersion: options.rulesVersion ?? '1.0.0',
    reviewStatus: options.reviewStatus ?? 'draft',
  } as unknown as ChallengeCsvRow;

  return deepFreeze(row);
}
