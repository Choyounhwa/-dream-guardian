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
T001,왼손 + 오른손 + 머리,1,3,4,X,3
Q001,"전신 (두 손 모아 하늘 + 바른자세 정면)",2,2,4,7,4`;

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
    expect(records[2].head).toBe(4);
    expect(records[2].parts).toEqual(['leftHand', 'rightHand', 'head']);

    // Q001 검증 (따옴표 포함 설명 및 동일 존 중복 포함)
    expect(records[3].id).toBe('Q001');
    expect(records[3].patternType).toBe('Q');
    expect(records[3].name).toBe('전신 (두 손 모아 하늘 + 바른자세 정면)');
    expect(records[3].leftHand).toBe(2);
    expect(records[3].rightHand).toBe(2);
    expect(records[3].head).toBe(4);
    expect(records[3].hip).toBe(7);
    expect(records[3].parts).toHaveLength(4);
    expect(records[3].distinctZoneIds).toEqual([2, 4, 7]);
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

  describe('Issue #157 (Card #87) - DATA-002: HEAD_ZONES {4,5} 및 Cross-Body 전수 검증', () => {
    it('validateFitnessPattern은 머리 존이 1, 2, 3, 7 등 {4, 5} 이외일 때 유효하지 않다고 판정한다', () => {
      const invalidHeadZones = [1, 2, 3, 6, 7, 8, 9, 10, 11];
      for (const z of invalidHeadZones) {
        const record = {
          id: 'T_INVALID_HEAD',
          patternType: 'T' as const,
          name: `머리 존 ${z} 테스트`,
          leftHand: 4,
          rightHand: 5,
          head: z,
          hip: null,
          partCount: 3,
          parts: ['leftHand', 'rightHand', 'head'] as any[],
          zoneIds: [4, 5, z],
          distinctZoneIds: [4, 5, z],
          partZoneMap: { leftHand: 4, rightHand: 5, head: z },
        };
        const res = validateFitnessPattern(record);
        expect(res.valid).toBe(false);
        expect(res.errors.some((e) => e.includes('HEAD_ZONES: 4, 5'))).toBe(true);
      }
    });

    it('validateFitnessPattern은 머리 존이 4 또는 5일 때 정상 통과한다', () => {
      for (const z of [4, 5]) {
        const record = {
          id: `T_VALID_HEAD_${z}`,
          patternType: 'T' as const,
          name: `머리 존 ${z} 정상 테스트`,
          leftHand: 1,
          rightHand: 3,
          head: z,
          hip: null,
          partCount: 3,
          parts: ['leftHand', 'rightHand', 'head'] as any[],
          zoneIds: [1, 3, z],
          distinctZoneIds: [1, 3, z],
          partZoneMap: { leftHand: 1, rightHand: 3, head: z },
        };
        const res = validateFitnessPattern(record);
        expect(res.valid).toBe(true);
        expect(res.errors).toHaveLength(0);
      }
    });

    it('실제 fitness pattern.csv 360건 전체에서 머리 존 1, 2, 3이 0건이고 오직 4 또는 5만 존재한다', () => {
      const csvPath = path.resolve(__dirname, '../../../fitness pattern.csv');
      const rawContent = fs.readFileSync(csvPath, 'utf-8');
      const records = parseFitnessPatternCSV(rawContent);

      expect(records).toHaveLength(360);

      const headRecords = records.filter((r) => r.head !== null);
      expect(headRecords.length).toBeGreaterThan(0);

      // 1, 2, 3 존 머리 패턴 0건 확인
      const forbiddenHeadRecords = headRecords.filter(
        (r) => r.head === 1 || r.head === 2 || r.head === 3
      );
      expect(forbiddenHeadRecords).toHaveLength(0);

      // 모든 머리 패턴이 4 또는 5에만 속하는지 확인
      for (const r of headRecords) {
        expect([4, 5]).toContain(r.head);
      }
    });

    it('실제 fitness pattern.csv 360건 전체에서 골반 9~11일 때 양손 1~3인 Cross-Body 위반이 0건이다', () => {
      const csvPath = path.resolve(__dirname, '../../../fitness pattern.csv');
      const rawContent = fs.readFileSync(csvPath, 'utf-8');
      const records = parseFitnessPatternCSV(rawContent);

      const crossBodyViolations = records.filter((r) => {
        if (r.hip === null || ![9, 10, 11].includes(r.hip)) return false;
        const leftViolates = r.leftHand !== null && [1, 2, 3].includes(r.leftHand);
        const rightViolates = r.rightHand !== null && [1, 2, 3].includes(r.rightHand);
        return leftViolates || rightViolates;
      });

      expect(crossBodyViolations).toHaveLength(0);
    });

    it('3개 위치의 fitness pattern.csv 파일이 모두 존재하고 360건 무오류 및 내용이 완전히 일치한다', () => {
      const paths = [
        path.resolve(__dirname, '../../../fitness pattern.csv'),
        path.resolve(__dirname, '../../public/fitness pattern.csv'),
        path.resolve(__dirname, '../../src/data/fitness pattern.csv'),
      ];

      const contents: string[] = [];

      for (const p of paths) {
        expect(fs.existsSync(p)).toBe(true);
        const content = fs.readFileSync(p, 'utf-8');
        contents.push(content);

        const records = parseFitnessPatternCSV(content);
        expect(records).toHaveLength(360);

        const validation = validateAllFitnessPatterns(records);
        expect(validation.invalidCount).toBe(0);
        expect(validation.validCount).toBe(360);
      }

      // 3개 파일 내용 100% 동일 확인
      expect(contents[0]).toBe(contents[1]);
      expect(contents[0]).toBe(contents[2]);
    });
  });
});
