import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseFitnessPatternCSV,
  validateFitnessPattern,
  validateAllFitnessPatterns,
  filterPatternsByType,
  filterPatternsByPartCount,
  filterPatternsByPart,
  filterCrossBodyPatterns,
} from '../../src/data/FitnessPatternLoader.js';

describe('FitnessPatternLoader (Issue #122 - DATA-001)', () => {
  const SAMPLE_CSV = `ID,사용 부위,왼손,오른손,머리,골반,판정 부위 수
S001,왼손,1,X,X,X,1
D001,왼손 + 오른손,1,3,X,X,2
T001,왼손 + 오른손 + 머리,1,3,2,X,3
Q001,"전신 (두 손 모아 하늘 + 바른자세 정면)",2,2,2,7,4`;

  it('샘플 CSV를 정상 파싱하여 레코드를 생성한다', () => {
    const records = parseFitnessPatternCSV(SAMPLE_CSV);
    expect(records).toHaveLength(4);

    // S001 검증
    expect(records[0].id).toBe('S001');
    expect(records[0].patternType).toBe('S');
    expect(records[0].leftHand).toBe(1);
    expect(records[0].rightHand).toBeNull();
    expect(records[0].parts).toEqual(['leftHand']);
    expect(records[0].zoneIds).toEqual([1]);
    expect(records[0].partCount).toBe(1);

    // D001 검증
    expect(records[1].id).toBe('D001');
    expect(records[1].patternType).toBe('D');
    expect(records[1].leftHand).toBe(1);
    expect(records[1].rightHand).toBe(3);
    expect(records[1].parts).toEqual(['leftHand', 'rightHand']);
    expect(records[1].distinctZoneIds).toEqual([1, 3]);

    // T001 검증
    expect(records[2].id).toBe('T001');
    expect(records[2].patternType).toBe('T');
    expect(records[2].head).toBe(2);
    expect(records[2].parts).toEqual(['leftHand', 'rightHand', 'head']);

    // Q001 검증 (따옴표 포함 설명 및 동일 존 중복 포함)
    expect(records[3].id).toBe('Q001');
    expect(records[3].patternType).toBe('Q');
    expect(records[3].name).toBe('전신 (두 손 모아 하늘 + 바른자세 정면)');
    expect(records[3].leftHand).toBe(2);
    expect(records[3].rightHand).toBe(2);
    expect(records[3].head).toBe(2);
    expect(records[3].hip).toBe(7);
    expect(records[3].parts).toHaveLength(4);
    expect(records[3].distinctZoneIds).toEqual([2, 7]);
  });

  it('빈 문자열이나 헤더만 있는 경우 빈 배열을 반환한다', () => {
    expect(parseFitnessPatternCSV('')).toHaveLength(0);
    expect(parseFitnessPatternCSV('ID,사용 부위,왼손,오른손,머리,골반,판정 부위 수')).toHaveLength(0);
  });

  it('실제 fitness pattern.csv 360건 전수를 무오류로 파싱하고 검증 통과한다', () => {
    const csvPath = path.resolve(__dirname, '../../../fitness pattern.csv');
    const rawContent = fs.readFileSync(csvPath, 'utf-8');

    const records = parseFitnessPatternCSV(rawContent);
    expect(records).toHaveLength(360);

    const sList = filterPatternsByType(records, 'S');
    const dList = filterPatternsByType(records, 'D');
    const tList = filterPatternsByType(records, 'T');
    const qList = filterPatternsByType(records, 'Q');

    expect(sList).toHaveLength(60);
    expect(dList).toHaveLength(100);
    expect(tList).toHaveLength(100);
    expect(qList).toHaveLength(100);

    // 전수 유효성 검증
    const validation = validateAllFitnessPatterns(records);
    expect(validation.invalidCount).toBe(0);
    expect(validation.validCount).toBe(360);
  });

  it('필터 함수(부위 수, 특정 부위)가 올바르게 작동한다', () => {
    const records = parseFitnessPatternCSV(SAMPLE_CSV);

    const singles = filterPatternsByPartCount(records, 1);
    expect(singles).toHaveLength(1);
    expect(singles[0].id).toBe('S001');

    const headPatterns = filterPatternsByPart(records, 'head');
    expect(headPatterns).toHaveLength(2); // T001, Q001
  });

  it('비정상 데이터에 대해 유효성 검증 실패를 보고한다', () => {
    // 1. 부위 수 불일치
    const invalidRecord1 = {
      id: 'S999',
      patternType: 'S' as const,
      name: '오류 테스트',
      leftHand: 1,
      rightHand: 2, // 2개 부위인데 S
      head: null,
      hip: null,
      partCount: 1, // partCount 1 불일치
      parts: ['leftHand', 'rightHand'] as any[],
      zoneIds: [1, 2],
      distinctZoneIds: [1, 2],
      partZoneMap: { leftHand: 1, rightHand: 2 },
    };

    const res1 = validateFitnessPattern(invalidRecord1);
    expect(res1.valid).toBe(false);
    expect(res1.errors.length).toBeGreaterThan(0);

    // 2. 존 번호 범위 초과
    const invalidRecord2 = {
      id: 'S998',
      patternType: 'S' as const,
      name: '존 초과',
      leftHand: 99,
      rightHand: null,
      head: null,
      hip: null,
      partCount: 1,
      parts: ['leftHand'] as any[],
      zoneIds: [99],
      distinctZoneIds: [99],
      partZoneMap: { leftHand: 99 },
    };

    const res2 = validateFitnessPattern(invalidRecord2);
    expect(res2.valid).toBe(false);

    // 3. C8 Cross-Body 위반 레코드 (골반 10, 왼손 1)
    const invalidRecord3 = {
      id: 'D999',
      patternType: 'D' as const,
      name: 'Cross-Body 오류 테스트',
      leftHand: 1, // 최상단
      rightHand: null,
      head: null,
      hip: 10, // 최하단
      partCount: 2,
      parts: ['leftHand', 'hip'] as any[],
      zoneIds: [1, 10],
      distinctZoneIds: [1, 10],
      partZoneMap: { leftHand: 1, hip: 10 },
    };
    const res3 = validateFitnessPattern(invalidRecord3);
    expect(res3.valid).toBe(false);
    expect(res3.errors.some((e) => e.includes('Cross-Body'))).toBe(true);
  });

  it('filterCrossBodyPatterns가 Cross-Body 위반 패턴을 완벽히 필터링한다 (Issue #158)', () => {
    const mixedRecords = [
      {
        id: 'D_OK',
        patternType: 'D' as const,
        name: '정상',
        leftHand: 4,
        rightHand: null,
        head: null,
        hip: 10,
        partCount: 2,
        parts: ['leftHand', 'hip'] as any[],
        zoneIds: [4, 10],
        distinctZoneIds: [4, 10],
        partZoneMap: { leftHand: 4, hip: 10 },
      },
      {
        id: 'D_VIOLATION',
        patternType: 'D' as const,
        name: '위반',
        leftHand: 2, // 1~3 손
        rightHand: null,
        head: null,
        hip: 9, // 9~11 골반
        partCount: 2,
        parts: ['leftHand', 'hip'] as any[],
        zoneIds: [2, 9],
        distinctZoneIds: [2, 9],
        partZoneMap: { leftHand: 2, hip: 9 },
      },
    ];

    const safeList = filterCrossBodyPatterns(mixedRecords);
    expect(safeList).toHaveLength(1);
    expect(safeList[0].id).toBe('D_OK');
  });
});
