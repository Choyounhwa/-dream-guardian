/**
 * challenge-csv-writer.test.ts - 챌린지 CSV 직렬화 및 오프라인 내보내기 단위 테스트
 *
 * @see Issue #666 [ASSAULT-CHALLENGE-CH-20]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 5, 11.2)
 */

import { describe, it, expect } from 'vitest';
import {
  writeChallengeCsv,
  formatChallengeCsvRow,
  roundToChallengeCsvRow,
} from '../../src/question/challenge/ChallengeCsvWriter.js';
import {
  exportAssaultChallenges,
  parseCliArgs,
} from '../../scripts/export-assault-challenges.js';
import {
  CHALLENGE_CSV_HEADER,
  CHALLENGE_CSV_HEADER_COLUMNS,
  validateChallengeCsvRow,
  validateChallengeCsvText,
  type ChallengeCsvRow,
} from '../../src/question/challenge/ChallengeCsvValidator.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../../src/data/assault/challengeCatalog.js';

describe('[ASSAULT-CHALLENGE-CH-20 / #666] ChallengeCsvWriter 순수 직렬화 모듈', () => {
  const createSampleRow = (overrides: Partial<ChallengeCsvRow> = {}): ChallengeCsvRow => ({
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
    seed: 1007,
    rulesVersion: '1.0.0',
    reviewStatus: 'draft',
    ...overrides,
  });

  it('빈 행 배열 전달 시 헤더만 포함된 CSV 문자열을 반환한다', () => {
    const csv = writeChallengeCsv([]);
    expect(csv.trim()).toBe(CHALLENGE_CSV_HEADER);
  });

  it('[CH-23 / #680] 26개 열 순서 및 스키마에 맞추어 정확하게 직렬화한다', () => {
    const sample = createSampleRow();
    const csv = writeChallengeCsv([sample]);
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(CHALLENGE_CSV_HEADER);

    const cols = lines[1].split(',');
    expect(cols).toHaveLength(CHALLENGE_CSV_HEADER_COLUMNS.length);
    expect(cols[0]).toBe('A1-0001');
    expect(cols[1]).toBe('A1_times_table');
    expect(cols[2]).toBe('rule_hunt');
    expect(cols[3]).toBe('2');
    expect(cols[4]).toBe('2');
    expect(cols[5]).toBe('6단 숫자를 쳐라!');
    expect(cols[6]).toBe('k=6');
    expect(cols[7]).toBe('42');
    expect(cols[8]).toBe('44');
    expect(cols[9]).toBe('L');
    expect(cols[10]).toBe('');
    expect(cols[19]).toBe('35');
    expect(cols[20]).toBe('36');
    expect(cols[21]).toBe('R');
    expect(cols[22]).toBe('');
    expect(cols[23]).toBe('1007');
    expect(cols[24]).toBe('1.0.0');
    expect(cols[25]).toBe('draft');
  });

  it('DOC-18 §11.2 제약: 보기 라벨에 쉼표(,)가 포함된 경우 에러를 던진다', () => {
    const invalidLabelRow1 = createSampleRow({ p1_left: '1,2' });
    expect(() => writeChallengeCsv([invalidLabelRow1])).toThrow(/comma/i);

    const invalidLabelRow2 = createSampleRow({ p2_right: 'a,b' });
    expect(() => writeChallengeCsv([invalidLabelRow2])).toThrow(/comma/i);

    const invalidLabelRow3 = createSampleRow({ p3_left: 'x,y' });
    expect(() => writeChallengeCsv([invalidLabelRow3])).toThrow(/comma/i);

    const invalidLabelRow4 = createSampleRow({ p4_right: 'p,q' });
    expect(() => writeChallengeCsv([invalidLabelRow4])).toThrow(/comma/i);
  });

  it('질문 문구나 보조 문구 등에 쉼표/따옴표가 포함될 경우 표준 CSV 이스케이프 처리한다', () => {
    const rowWithCommas = createSampleRow({
      questionText: '10, 20 사이를 "조심해서" 쳐라!',
    });
    const formatted = formatChallengeCsvRow(rowWithCommas);
    expect(formatted).toContain('"10, 20 사이를 ""조심해서"" 쳐라!"');
  });

  it('reviewStatus가 비어있으면 기본값 "draft"로 직렬화한다', () => {
    const sample = createSampleRow({ reviewStatus: '' });
    const formatted = formatChallengeCsvRow(sample);
    const cols = formatted.split(',');
    expect(cols[25]).toBe('draft');
  });

  it('roundToChallengeCsvRow를 통해 라운드 결과 객체를 유효한 ChallengeCsvRow로 변환한다', () => {
    const dummyRound = {
      variantId: 'D1_skip_count',
      family: 'progression',
      questionText: '2부터 3씩 뛰어라!',
      params: { start: 2, step: 3 },
      pairPrompts: ['2 → ?', '2 → 5 → ?', '2 → 5 → 8 → ?', '2 → 5 → 8 → 11 → ?'],
      pairs: [
        {
          pairId: 'p1',
          left: { value: 5, text: '5', isCorrect: true },
          right: { value: 6, text: '6', isCorrect: false },
          correctSide: 'left' as const,
          choices: [
            { value: 5, text: '5', isCorrect: true },
            { value: 6, text: '6', isCorrect: false },
          ],
        },
        {
          pairId: 'p2',
          left: { value: 7, text: '7', isCorrect: false },
          right: { value: 8, text: '8', isCorrect: true },
          correctSide: 'right' as const,
          choices: [
            { value: 7, text: '7', isCorrect: false },
            { value: 8, text: '8', isCorrect: true },
          ],
        },
        {
          pairId: 'p3',
          left: { value: 11, text: '11', isCorrect: true },
          right: { value: 12, text: '12', isCorrect: false },
          correctSide: 'left' as const,
          choices: [
            { value: 11, text: '11', isCorrect: true },
            { value: 12, text: '12', isCorrect: false },
          ],
        },
        {
          pairId: 'p4',
          left: { value: 13, text: '13', isCorrect: false },
          right: { value: 14, text: '14', isCorrect: true },
          correctSide: 'right' as const,
          choices: [
            { value: 13, text: '13', isCorrect: false },
            { value: 14, text: '14', isCorrect: true },
          ],
        },
      ],
    };

    const row = roundToChallengeCsvRow(dummyRound, {
      id: 'D1-0001',
      chapter: 1,
      level: 1,
      seed: 1007,
    });

    expect(row.id).toBe('D1-0001');
    expect(row.variantId).toBe('D1_skip_count');
    expect(row.family).toBe('progression');
    expect(row.params).toBe('start=2;step=3');
    expect(row.p1_left).toBe('5');
    expect(row.p1_right).toBe('6');
    expect(row.p1_correct).toBe('L');
    expect(row.p1_prompt).toBe('2 → ?');
    expect(row.p2_correct).toBe('R');
    expect(row.p3_correct).toBe('L');
    expect(row.p4_left).toBe('13');
    expect(row.p4_right).toBe('14');
    expect(row.p4_correct).toBe('R');
    expect(row.p4_prompt).toBe('2 → 5 → 8 → 11 → ?');
    expect(row.seed).toBe(1007);
    expect(row.reviewStatus).toBe('draft');

    const validationErrors = validateChallengeCsvRow(row);
    expect(validationErrors).toHaveLength(0);
  });

  it('[CH-23 / #680] roundToChallengeCsvRow에 pairsPerRow(4)개 미만의 쌍이 주어지면 에러를 던진다', () => {
    const invalidRound = {
      variantId: 'A1_times_table',
      family: 'rule_hunt',
      questionText: '6단 숫자를 쳐라!',
      params: { k: 6 },
      pairs: [
        {
          pairId: 'p1',
          left: { value: 12, text: '12', isCorrect: true },
          right: { value: 13, text: '13', isCorrect: false },
          correctSide: 'left' as const,
          choices: [
            { value: 12, text: '12', isCorrect: true },
            { value: 13, text: '13', isCorrect: false },
          ],
        },
      ],
    };

    expect(() =>
      roundToChallengeCsvRow(invalidRound, {
        id: 'A1-0001',
        chapter: 2,
        level: 2,
        seed: 1007,
      }),
    ).toThrow(/at least 4 pairs/i);
  });
});

describe('[ASSAULT-CHALLENGE-CH-20 / #666] exportAssaultChallenges 오프라인 내보내기 스크립트', () => {
  it('CLI 인자 파서를 통해 --seed, --rows, --out 플래그를 정확히 해석한다', () => {
    const parsed = parseCliArgs([
      '--seed',
      '2026',
      '--rows',
      '5',
      '--out',
      'custom_challenges.csv',
    ]);
    expect(parsed.seed).toBe(2026);
    expect(parsed.rows).toBe(5);
    expect(parsed.out).toBe('custom_challenges.csv');
  });

  it('기본 옵션 또는 지정된 rows 수에 따라 14유형 카탈로그 전체를 생성한다', () => {
    const rowsPerVariant = 2;
    const result = exportAssaultChallenges({
      seed: 1007,
      rows: rowsPerVariant,
      writeToFile: false,
    });

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(14 * rowsPerVariant);
    expect(result.report.variants).toHaveLength(14);
    expect(result.report.validationErrors).toBe(0);

    // 14개 카탈로그 유형이 모두 2행씩 생성되었는지 확인
    for (const vDef of Object.values(ASSAULT_CHALLENGE_CATALOG)) {
      const vReport = result.report.variants.find((v) => v.variantId === vDef.variantId);
      expect(vReport).toBeDefined();
      expect(vReport?.generatedCount).toBe(rowsPerVariant);
      expect(vReport?.errors).toHaveLength(0);
    }
  });

  it('생성된 모든 행이 ChallengeCsvValidator 검증을 100% 통과한다', () => {
    const result = exportAssaultChallenges({
      seed: 1007,
      rows: 2,
      writeToFile: false,
    });

    const validation = validateChallengeCsvText(result.csvText);
    expect(validation.isValid).toBe(true);
    expect(validation.rowCount).toBe(28);
    expect(validation.errors).toHaveLength(0);
  });

  it('[CH-23 / #680] 생성된 모든 행은 4개 쌍(p1~p4)을 모두 채운다', () => {
    const result = exportAssaultChallenges({ seed: 1007, rows: 2, writeToFile: false });
    const lines = result.csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const idx = (c: string) => CHALLENGE_CSV_HEADER_COLUMNS.indexOf(c);
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      expect(cols).toHaveLength(26);
      expect(cols[idx('p4_left')].length).toBeGreaterThan(0);
      expect(cols[idx('p4_right')].length).toBeGreaterThan(0);
      expect(['L', 'R']).toContain(cols[idx('p4_correct')]);
    }
  });

  it('동일한 seed와 rows 설정 시 100% 바이트 동일한 CSV를 출력한다 (결정론적 불변성)', () => {
    const resultA = exportAssaultChallenges({
      seed: 1007,
      rows: 3,
      writeToFile: false,
    });
    const resultB = exportAssaultChallenges({
      seed: 1007,
      rows: 3,
      writeToFile: false,
    });

    expect(resultA.csvText).toBe(resultB.csvText);
  });

  it('seed가 다르면 다른 문제/파라미터가 생성된다', () => {
    const resultA = exportAssaultChallenges({
      seed: 1007,
      rows: 2,
      writeToFile: false,
    });
    const resultB = exportAssaultChallenges({
      seed: 9999,
      rows: 2,
      writeToFile: false,
    });

    expect(resultA.csvText).not.toBe(resultB.csvText);
  });

  it('ID가 {variantPrefix}-{0001~0020} 포맷을 엄격히 준수한다', () => {
    const result = exportAssaultChallenges({
      seed: 1007,
      rows: 2,
      writeToFile: false,
    });

    const lines = result.csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    // line 0은 헤더, 1부터 28까지 데이터 행
    const ids = lines.slice(1).map((line) => line.split(',')[0]);

    expect(ids[0]).toBe('A1-0001');
    expect(ids[1]).toBe('A1-0002');
    expect(ids[2]).toBe('A2-0001');
    expect(ids[3]).toBe('A2-0002');
  });

  it('기본 설정(유형당 20행, 총 280행) 전체 생성 시 검증 에러 0건을 달성한다', () => {
    const result = exportAssaultChallenges({
      seed: 1007,
      rows: 20,
      writeToFile: false,
    });

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(280);
    expect(result.report.validationErrors).toBe(0);

    const validation = validateChallengeCsvText(result.csvText);
    expect(validation.isValid).toBe(true);
    expect(validation.rowCount).toBe(280);
    expect(validation.errors).toHaveLength(0);
  });

  it('writeToFile 옵션 활성화 시 실제 파일로 안전하게 기록된다', async () => {
    const fs = await import('node:fs');
    const testOutPath = 'tests/export_test_output.csv';
    const result = exportAssaultChallenges({
      seed: 1007,
      rows: 1,
      out: testOutPath,
      writeToFile: true,
    });

    expect(result.success).toBe(true);
    expect(result.outputPath).toBeDefined();
    expect(fs.existsSync(result.outputPath!)).toBe(true);

    const content = fs.readFileSync(result.outputPath!, 'utf-8');
    expect(content).toBe(result.csvText);

    // 정리
    fs.unlinkSync(result.outputPath!);
  });
});
