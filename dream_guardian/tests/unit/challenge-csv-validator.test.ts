/**
 * challenge-csv-validator.test.ts - 챌린지 CSV 행 독립 검증기 단위 테스트
 *
 * @see Issue #667 [ASSAULT-CHALLENGE-CH-21]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 5, 11.2)
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  validateChallengeCsvRow,
  validateChallengeCsvText,
  CHALLENGE_CSV_HEADER,
  CHALLENGE_CSV_HEADER_COLUMNS,
  type ChallengeCsvRow,
  type CsvValidationResult,
  type CsvRowValidationError,
} from '../../src/question/challenge/ChallengeCsvValidator.js';

describe('[ASSAULT-CHALLENGE-CH-21 / #667] 챌린지 CSV 행 독립 검증기', () => {
  // ─── 0. 유효한 기본 행 픽스처 ───
  const createValidA1Row = (overrides: Partial<ChallengeCsvRow> = {}): ChallengeCsvRow => ({
    id: 'A1-0001',
    variantId: 'A1_times_table',
    family: 'rule_hunt',
    chapter: 2,
    level: 2,
    questionText: '6단 숫자를 쳐라!',
    params: 'k=6',
    p1_left: '42',
    p1_right: '44',
    p1_correct: 'L',
    p1_prompt: '',
    p2_left: '25',
    p2_right: '24',
    p2_correct: 'R',
    p2_prompt: '',
    p3_left: '18',
    p3_right: '19',
    p3_correct: 'L',
    p3_prompt: '',
    p4_left: '35',
    p4_right: '36',
    p4_correct: 'R',
    p4_prompt: '',
    seed: 1001,
    rulesVersion: '1.0.0',
    reviewStatus: 'draft',
    ...overrides,
  });

  const createValidD1Row = (overrides: Partial<ChallengeCsvRow> = {}): ChallengeCsvRow => ({
    id: 'D1-0001',
    variantId: 'D1_skip_count',
    family: 'progression',
    chapter: 1,
    level: 1,
    questionText: '2부터 3씩 뛰어라!',
    params: 'start=2;step=3',
    p1_left: '5',
    p1_right: '6',
    p1_correct: 'L',
    p1_prompt: '2 → ?',
    p2_left: '7',
    p2_right: '8',
    p2_correct: 'R',
    p2_prompt: '2 → 5 → ?',
    p3_left: '11',
    p3_right: '12',
    p3_correct: 'L',
    p3_prompt: '2 → 5 → 8 → ?',
    p4_left: '14',
    p4_right: '13',
    p4_correct: 'L',
    p4_prompt: '2 → 5 → 8 → 11 → ?',
    seed: 1002,
    rulesVersion: '1.0.0',
    reviewStatus: 'approved',
    ...overrides,
  });

  // ─── 1. 기본 통과 및 불변성 ───
  describe('1. 기본 정상 행 통과 및 deepFreeze 불변성', () => {
    it('인터페이스 및 반환 타입 계약이 올바르게 정의되어 있다', () => {
      const mockResult: CsvValidationResult = {
        isValid: true,
        rowCount: 0,
        errors: [],
      };
      const mockError: CsvRowValidationError = {
        code: 'INVALID_ID_FORMAT',
        message: 'test error',
      };
      expectTypeOf(mockResult).toMatchTypeOf<CsvValidationResult>();
      expectTypeOf(mockError).toMatchTypeOf<CsvRowValidationError>();
      expect(mockResult.isValid).toBe(true);
      expect(mockError.code).toBe('INVALID_ID_FORMAT');
    });

    it('정상 A1 (규칙 사냥) 행은 오류 없이 검증 통과한다', () => {
      const row = createValidA1Row();
      const errors = validateChallengeCsvRow(row, 1);
      expect(errors).toHaveLength(0);
      expect(Object.isFrozen(errors)).toBe(true);
    });

    it('정상 D1 (진행) 행(pairPrompt 포함)은 오류 없이 검증 통과한다', () => {
      const row = createValidD1Row();
      const errors = validateChallengeCsvRow(row, 1);
      expect(errors).toHaveLength(0);
    });

    it('정상 B1 (대결: 덧셈/뺄셈 식) 행은 오류 없이 검증 통과한다', () => {
      const row: ChallengeCsvRow = {
        id: 'B1-0001',
        variantId: 'B1_addsub_duel',
        family: 'duel',
        chapter: 1,
        level: 1,
        questionText: '더 큰 수를 쳐라!',
        params: 'direction=1;minDiff=1',
        p1_left: '7+5',
        p1_right: '6+3',
        p1_correct: 'L',
        p1_prompt: '',
        p2_left: '10-4',
        p2_right: '15-2',
        p2_correct: 'R',
        p2_prompt: '',
        p3_left: '9+8',
        p3_right: '7+7',
        p3_correct: 'L',
        p3_prompt: '',
        p4_left: '5+3',
        p4_right: '6+4',
        p4_correct: 'R',
        p4_prompt: '',
        seed: 1003,
        rulesVersion: '1.0.0',
        reviewStatus: 'draft',
      };
      const errors = validateChallengeCsvRow(row, 1);
      expect(errors).toHaveLength(0);
    });

    it('정상 C1 (같은 값 만들기) 행은 오류 없이 검증 통과한다', () => {
      const row: ChallengeCsvRow = {
        id: 'C1-0001',
        variantId: 'C1_make_target',
        family: 'equivalence',
        chapter: 1,
        level: 1,
        questionText: '10을 만들어라!',
        params: 'targetVal=10',
        p1_left: '3+7',
        p1_right: '4+5',
        p1_correct: 'L',
        p1_prompt: '',
        p2_left: '6+2',
        p2_right: '8+2',
        p2_correct: 'R',
        p2_prompt: '',
        p3_left: '12-2',
        p3_right: '9-1',
        p3_correct: 'L',
        p3_prompt: '',
        p4_left: '15-4',
        p4_right: '15-5',
        p4_correct: 'R',
        p4_prompt: '',
        seed: 1004,
        rulesVersion: '1.0.0',
        reviewStatus: 'approved',
      };
      const errors = validateChallengeCsvRow(row, 1);
      expect(errors).toHaveLength(0);
    });

    it('CSV 텍스트 검증 결과는 deepFreeze되어 반환된다', () => {
      const csv = [
        CHALLENGE_CSV_HEADER,
        'A1-0001,A1_times_table,rule_hunt,2,2,6단 숫자를 쳐라!,k=6,42,44,L,,25,24,R,,18,19,L,,35,36,R,,1001,1.0.0,draft',
      ].join('\n');
      const result: CsvValidationResult = validateChallengeCsvText(csv);
      expect(result.isValid).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.errors)).toBe(true);
    });
  });

  // ─── 2. ID 형식 및 중복 검증 ───
  describe('2. id 형식 및 중복 검증', () => {
    it('id가 {variant접두}-{4자리} 형식이 아니면 INVALID_ID_FORMAT 오류를 반환한다', () => {
      const row1 = createValidA1Row({ id: 'A1-1' });
      const row2 = createValidA1Row({ id: 'invalid-id' });
      const row3 = createValidA1Row({ id: 'a1-0001' });

      expect(validateChallengeCsvRow(row1)[0].code).toBe('INVALID_ID_FORMAT');
      expect(validateChallengeCsvRow(row2)[0].code).toBe('INVALID_ID_FORMAT');
      expect(validateChallengeCsvRow(row3)[0].code).toBe('INVALID_ID_FORMAT');
    });

    it('id의 접두사가 variantId의 접두사와 불일치하면 INVALID_ID_FORMAT 오류를 반환한다', () => {
      const row = createValidA1Row({ id: 'B1-0001', variantId: 'A1_times_table' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_ID_FORMAT')).toBe(true);
    });

    it('CSV 텍스트 내에서 중복된 id가 존재하면 DUPLICATE_ID 오류를 반환한다', () => {
      const csv = [
        CHALLENGE_CSV_HEADER,
        'A1-0001,A1_times_table,rule_hunt,2,2,6단 숫자를 쳐라!,k=6,42,44,L,,25,24,R,,18,19,L,,35,36,R,,1001,1.0.0,draft',
        'A1-0001,A1_times_table,rule_hunt,2,2,6단 숫자를 쳐라!,k=6,42,44,L,,25,24,R,,18,19,L,,35,36,R,,1002,1.0.0,draft',
      ].join('\n');
      const result = validateChallengeCsvText(csv);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
    });
  });

  // ─── 3. 카탈로그 및 메타데이터 정합성 검증 ───
  describe('3. 카탈로그 및 메타데이터 정합성 검증', () => {
    it('14유형 카탈로그에 없는 variantId이면 UNKNOWN_VARIANT_ID 오류를 반환한다', () => {
      const row = createValidA1Row({ variantId: 'Z9_nonexistent' as any });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'UNKNOWN_VARIANT_ID')).toBe(true);
    });

    it('family가 카탈로그 정의와 불일치하면 FAMILY_MISMATCH 오류를 반환한다', () => {
      const row = createValidA1Row({ family: 'duel' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'FAMILY_MISMATCH')).toBe(true);
    });

    it('chapter가 카탈로그 허용 chapters에 포함되지 않으면 CHAPTER_MISMATCH 오류를 반환한다', () => {
      // A1_times_table은 chapters: [2]
      const row = createValidA1Row({ chapter: 1 });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'CHAPTER_MISMATCH')).toBe(true);
    });

    it('chapter가 1~5 정수가 아니면 INVALID_CHAPTER 오류를 반환한다', () => {
      const row = createValidA1Row({ chapter: 0 });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_CHAPTER')).toBe(true);
    });

    it('level이 1 미만이거나 정수가 아니면 INVALID_LEVEL 오류를 반환한다', () => {
      const row = createValidA1Row({ level: 0 });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_LEVEL')).toBe(true);
    });

    it('questionText가 비어 있으면 MISSING_QUESTION_TEXT 오류를 반환한다', () => {
      const row = createValidA1Row({ questionText: '   ' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'MISSING_QUESTION_TEXT')).toBe(true);
    });

    it('params 구문이 잘못되었으면 INVALID_PARAMS 오류를 반환한다', () => {
      const row1 = createValidA1Row({ params: '' });
      const row2 = createValidA1Row({ params: 'k=' });
      const row3 = createValidA1Row({ params: 'k=abc' });
      expect(validateChallengeCsvRow(row1).some((e) => e.code === 'INVALID_PARAMS')).toBe(true);
      expect(validateChallengeCsvRow(row2).some((e) => e.code === 'INVALID_PARAMS')).toBe(true);
      expect(validateChallengeCsvRow(row3).some((e) => e.code === 'INVALID_PARAMS')).toBe(true);
    });
  });

  // ─── 4. 보기 쌍(n=1..3) 및 라벨/식 검증 ───
  describe('4. 보기 쌍(n=1..3) 및 라벨/식 검증', () => {
    it('라벨 길이가 maxLabelChars(6)를 초과하면 LABEL_TOO_LONG 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_left: '1234567' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'LABEL_TOO_LONG')).toBe(true);
    });

    it('라벨이 유효한 수식/숫자가 아니면 INVALID_EXPRESSION 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_right: 'abc' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_EXPRESSION')).toBe(true);
    });

    it('라벨 계산 결과가 음수이면 NEGATIVE_OR_NAN 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_right: '2-5' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'NEGATIVE_OR_NAN')).toBe(true);
    });

    it('좌우 보기가 동일한 텍스트이면 DUPLICATE_CHOICES 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_left: '42', p1_right: '42' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'DUPLICATE_CHOICES')).toBe(true);
    });

    it('좌우 보기가 동일한 값으로 평가되면 DUPLICATE_CHOICES 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_left: '6×7', p1_right: '42' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'DUPLICATE_CHOICES')).toBe(true);
    });

    it('pn_correct가 L 또는 R이 아니면 INVALID_CORRECT_SIDE 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_correct: 'M' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_CORRECT_SIDE')).toBe(true);
    });
  });

  // ─── 5. D 계열 vs 비D 계열 pairPrompt 검증 ───
  describe('5. D 계열 vs 비D 계열 pairPrompt 검증', () => {
    it('D 계열(progression)에서 pairPrompt가 누락되면 MISSING_PAIR_PROMPT 오류를 반환한다', () => {
      const row = createValidD1Row({ p1_prompt: '' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'MISSING_PAIR_PROMPT')).toBe(true);
    });

    it('비D 계열에서 pairPrompt가 존재하면 UNEXPECTED_PAIR_PROMPT 오류를 반환한다', () => {
      const row = createValidA1Row({ p1_prompt: 'something' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'UNEXPECTED_PAIR_PROMPT')).toBe(true);
    });
  });

  // ─── 6. 수동 수정 행 재계산 및 규칙 검증 (불변식 위반 탐지) ───
  describe('6. 수동 수정 행 재계산 및 규칙 검증', () => {
    it('A1: 오답 보기가 6단 배수인 경우(정답 유일성 위반) NO_UNIQUE_CORRECT 오류를 반환한다', () => {
      // p1_left: 42 (정답), p1_right를 48(6*8)로 수동 수정 -> 둘 다 6단 배수
      const row = createValidA1Row({ p1_right: '48' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);
    });

    it('A1: 정답 보기가 6단 배수가 아니고 오답도 아닌 경우 NO_UNIQUE_CORRECT 오류를 반환한다', () => {
      // p1_left를 43으로 수동 수정 -> 둘 다 6단 배수가 아님
      const row = createValidA1Row({ p1_left: '43' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);
    });

    it('A1: 정답 쪽 지정이 반대로 된 경우 RULE_VIOLATION 오류를 반환한다', () => {
      // p1_left: 42 (6단 배수), p1_right: 44인데 p1_correct를 'R'로 지정
      const row = createValidA1Row({ p1_correct: 'R' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });

    it('D1: 수열 다음 항이 아닌 숫자를 정답으로 지정한 경우 NO_UNIQUE_CORRECT 오류를 반환한다', () => {
      // start=2, step=3: 2 다음은 5여야 하는데 4로 수정 (4, 6 둘 다 5가 아님)
      const row = createValidD1Row({ p1_left: '4' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'NO_UNIQUE_CORRECT')).toBe(true);
    });

    it('D1: 정답 쪽 지정이 반대로 된 경우 RULE_VIOLATION 오류를 반환한다', () => {
      // p1_left: 5, p1_right: 6인데 p1_correct를 'R'로 지정
      const row = createValidD1Row({ p1_correct: 'R' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'RULE_VIOLATION')).toBe(true);
    });
  });

  // ─── 7. reviewStatus, seed, rulesVersion 검증 ───
  describe('7. reviewStatus, seed, rulesVersion 검증', () => {
    it('reviewStatus가 draft, approved, rejected 중 하나가 아니면 INVALID_REVIEW_STATUS 오류를 반환한다', () => {
      const row = createValidA1Row({ reviewStatus: 'pending' as any });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_REVIEW_STATUS')).toBe(true);
    });

    it('seed가 정수가 아니면 INVALID_SEED 오류를 반환한다', () => {
      const row = createValidA1Row({ seed: 'not-a-number' as any });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_SEED')).toBe(true);
    });

    it('rulesVersion이 빈 문자열이면 INVALID_RULES_VERSION 오류를 반환한다', () => {
      const row = createValidA1Row({ rulesVersion: '' });
      const errors = validateChallengeCsvRow(row);
      expect(errors.some((e) => e.code === 'INVALID_RULES_VERSION')).toBe(true);
    });
  });

  // ─── 8. 연속 같은 쪽 정답(pn_correct) 제한 검증 ───
  describe('8. 연속 같은 쪽 정답 제한 검증', () => {
    it('행 내 maxConsecutiveSameSide가 2로 설정되었을 때 3회 연속 같은 쪽이면 오류를 반환한다', () => {
      // L, L, L
      const row = createValidA1Row({
        p1_correct: 'L',
        p2_correct: 'L',
        p3_correct: 'L',
      });
      const errors = validateChallengeCsvRow(row, 1, { maxConsecutiveSameSide: 2 });
      expect(errors.some((e) => e.code === 'CONSECUTIVE_SAME_SIDE_EXCEEDED')).toBe(true);
    });

    it('CSV 텍스트 시퀀스 검증(checkSequenceConsecutive) 활성화 시 전역 연속 4회 발생 시 오류를 반환한다', () => {
      // row1 ends with L, L; row2 starts with L, L -> 4 consecutive L
      const row1Str = 'A1-0001,A1_times_table,rule_hunt,2,2,6단 숫자를 쳐라!,k=6,44,42,R,,35,36,R,,24,25,L,,18,19,L,,1001,1.0.0,draft';
      const row2Str = 'A1-0002,A1_times_table,rule_hunt,2,2,6단 숫자를 쳐라!,k=6,42,44,L,,24,25,L,,19,18,R,,37,36,R,,1002,1.0.0,draft';
      const csv = [CHALLENGE_CSV_HEADER, row1Str, row2Str].join('\n');

      const result = validateChallengeCsvText(csv, { checkSequenceConsecutive: true, maxConsecutiveSameSide: 3 });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CONSECUTIVE_SAME_SIDE_EXCEEDED')).toBe(true);
    });
  });

  // ─── 9. CSV 파일 단위 텍스트 검증 및 헤더/열 개수 오류 ───
  describe('9. CSV 파일 단위 텍스트 검증', () => {
    it('헤더가 스키마와 불일치하면 INVALID_CSV_HEADER 오류를 반환한다', () => {
      const csv = 'col1,col2,col3\nA1-0001,A1_times_table...';
      const result = validateChallengeCsvText(csv);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_CSV_HEADER')).toBe(true);
    });

    it('행의 열 개수가 26개가 아니면 INVALID_COLUMN_COUNT 오류를 반환한다', () => {
      const csv = [
        CHALLENGE_CSV_HEADER,
        'A1-0001,A1_times_table,rule_hunt', // 부족한 열
      ].join('\n');
      const result = validateChallengeCsvText(csv);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_COLUMN_COUNT')).toBe(true);
    });

    it('빈 CSV 텍스트는 rowCount 0, isValid true를 반환한다', () => {
      const result = validateChallengeCsvText('');
      expect(result.isValid).toBe(true);
      expect(result.rowCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('[CH-23 / #680] CHALLENGE_CSV_HEADER_COLUMNS는 26개의 열 이름(p1~p4)을 정확히 포함한다', () => {
      expect(CHALLENGE_CSV_HEADER_COLUMNS).toHaveLength(26);
      expect(CHALLENGE_CSV_HEADER.split(',')).toHaveLength(26);
      expect(CHALLENGE_CSV_HEADER_COLUMNS.slice(19, 23)).toEqual([
        'p4_left',
        'p4_right',
        'p4_correct',
        'p4_prompt',
      ]);
    });

    it('[CH-23 / #680] 3쌍(22열) 구 스키마 행은 INVALID_COLUMN_COUNT로 거부한다', () => {
      const legacyRow =
        'A1-0001,A1_times_table,rule_hunt,2,2,6단 숫자를 쳐라!,k=6,42,44,L,,25,24,R,,18,19,L,,1001,1.0.0,draft';
      const result = validateChallengeCsvText([CHALLENGE_CSV_HEADER, legacyRow].join('\n'));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_COLUMN_COUNT')).toBe(true);
    });

    it('[CH-23 / #680] p4 쌍의 정답 방향이 잘못되면 INVALID_CORRECT_SIDE(pairIndex 4)를 반환한다', () => {
      const errors = validateChallengeCsvRow(createValidA1Row({ p4_correct: 'X' }));
      expect(
        errors.some(
          (e) => e.code === 'INVALID_CORRECT_SIDE' && (e.details as { pairIndex?: number })?.pairIndex === 4,
        ),
      ).toBe(true);
    });

    it('[CH-23 / #680] p4 쌍이 규칙을 위반하면(정답 아닌 쪽이 정답) 계열 재검증 오류를 반환한다', () => {
      // 6단: 36이 정답인데 정답 방향을 L(35)로 지정
      const errors = validateChallengeCsvRow(createValidA1Row({ p4_correct: 'L' }));
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ─── 10. [CH-22 / #668] 실제 생성된 assault_challenges.csv 파일 검증 ───
  describe('10. [CH-22 / #668] 실제 생성된 assault_challenges.csv 데이터 검증', () => {
    const rootCsvPath = path.resolve(__dirname, '../../../assault_challenges.csv');

    it('assault_challenges.csv 파일이 저장소 루트에 존재해야 한다', () => {
      expect(fs.existsSync(rootCsvPath)).toBe(true);
    });

    it('assault_challenges.csv는 26개 헤더 1줄 + 데이터 280행 = 총 281줄이어야 한다', () => {
      const content = fs.readFileSync(rootCsvPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      expect(lines).toHaveLength(281);
      expect(lines[0]).toBe(CHALLENGE_CSV_HEADER);
    });

    it('전체 280행에 대해 validateChallengeCsvText 실행 시 오류 0건과 isValid true를 만족한다', () => {
      const content = fs.readFileSync(rootCsvPath, 'utf8');
      const validation = validateChallengeCsvText(content);
      expect(validation.isValid).toBe(true);
      expect(validation.rowCount).toBe(280);
      expect(validation.errors).toHaveLength(0);
    });

    it('14개 유형(A1~A4, B1~B4, C1~C3, D1~D3) 각각 정확히 20행씩 존재하고 ID 체계가 올바르다', () => {
      const content = fs.readFileSync(rootCsvPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const dataLines = lines.slice(1);

      const expectedPrefixes = [
        'A1', 'A2', 'A3', 'A4',
        'B1', 'B2', 'B3', 'B4',
        'C1', 'C2', 'C3',
        'D1', 'D2', 'D3',
      ];

      const prefixCountMap = new Map<string, number>();
      for (const prefix of expectedPrefixes) {
        prefixCountMap.set(prefix, 0);
      }

      for (const line of dataLines) {
        const id = line.split(',')[0];
        const prefix = id.split('-')[0];
        const count = prefixCountMap.get(prefix) ?? 0;
        prefixCountMap.set(prefix, count + 1);
      }

      for (const prefix of expectedPrefixes) {
        expect(prefixCountMap.get(prefix)).toBe(20);
      }
    });

    it('14개 유형별 3행 이상(총 42행 이상) 표본 검수에서 지문 및 정답 정합성을 검증한다', () => {
      const content = fs.readFileSync(rootCsvPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const dataLines = lines.slice(1);

      // 각 prefix별 첫 3개 행(0001, 0002, 0003) 추출
      const sampleRows = dataLines.filter((line) => {
        const id = line.split(',')[0];
        return id.endsWith('-0001') || id.endsWith('-0002') || id.endsWith('-0003');
      });

      expect(sampleRows).toHaveLength(42);

      for (const rowText of sampleRows) {
        const cols = rowText.split(',');
        const questionText = cols[5];
        const p1_left = cols[7];
        const p1_right = cols[8];
        const p1_correct = cols[9];
        const p2_left = cols[11];
        const p2_right = cols[12];
        const p2_correct = cols[13];
        const p3_left = cols[15];
        const p3_right = cols[16];
        const p3_correct = cols[17];
        const p4_left = cols[19];
        const p4_right = cols[20];
        const p4_correct = cols[21];

        // 지문 확인
        expect(questionText.length).toBeGreaterThan(0);
        // 정답 방향 확인
        expect(['L', 'R']).toContain(p1_correct);
        expect(['L', 'R']).toContain(p2_correct);
        expect(['L', 'R']).toContain(p3_correct);
        expect(['L', 'R']).toContain(p4_correct);
        // 보기 값 존재 확인
        expect(p1_left.length).toBeGreaterThan(0);
        expect(p1_right.length).toBeGreaterThan(0);
        expect(p2_left.length).toBeGreaterThan(0);
        expect(p2_right.length).toBeGreaterThan(0);
        expect(p3_left.length).toBeGreaterThan(0);
        expect(p3_right.length).toBeGreaterThan(0);
        expect(p4_left.length).toBeGreaterThan(0);
        expect(p4_right.length).toBeGreaterThan(0);
      }
    });

    it('[CH-23 / #680] 검수 완료: 전체 280행의 reviewStatus가 approved여야 한다', () => {
      const content = fs.readFileSync(rootCsvPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const statusIdx = CHALLENGE_CSV_HEADER_COLUMNS.indexOf('reviewStatus');
      const statuses = lines.slice(1).map((line) => line.split(',')[statusIdx]);
      expect(statuses).toHaveLength(280);
      expect(statuses.every((s) => s === 'approved')).toBe(true);
    });
  });
});
