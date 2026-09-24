/**
 * FitnessPatternLoader - 피트니스 패턴 원본(fitness pattern.csv) 로더 및 유효성 검증기
 *
 * fitness pattern.csv(360건: Single 60, Double 100, Triple 100, Quad 100) 데이터를 파싱하고,
 * 게임 엔진 및 포즈 제너레이터에서 활용 가능한 타입화된 피트니스 패턴 풀로 로드 및 검증.
 *
 * @see Issue #122 (DATA-001)
 */

import type { BodyPart, FitnessPatternRecord, PatternType } from '../types/posture.js';
import { isCrossBodyViolation, HEAD_ZONES, HIP_ZONES } from '../../config/zone.config.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * CSV 텍스트를 파싱하여 FitnessPatternRecord 배열로 변환
 * @param csvText fitness pattern.csv 원본 내용
 */
export function parseFitnessPatternCSV(csvText: string): FitnessPatternRecord[] {
  // UTF-8 BOM 제거
  const cleaned = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  const records: FitnessPatternRecord[] = [];

  // line[0]은 헤더: ID,사용 부위,왼손,오른손,머리,골반,판정 부위 수
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const fields = parseCSVLine(rawLine);
    if (fields.length < 7) continue;

    const id = fields[0].trim();
    const prefix = id.charAt(0).toUpperCase();
    if (!['S', 'D', 'T', 'Q'].includes(prefix)) continue;

    const patternType = prefix as PatternType;
    const name = fields[1].trim();

    const parseZone = (val: string): number | null => {
      const v = val.trim();
      if (v === 'X' || v === 'x' || v === '') return null;
      const num = parseInt(v, 10);
      return isNaN(num) ? null : num;
    };

    const leftHand = parseZone(fields[2]);
    const rightHand = parseZone(fields[3]);
    const head = parseZone(fields[4]);
    const hip = parseZone(fields[5]);
    const partCount = parseInt(fields[6].trim(), 10) || 0;

    const parts: BodyPart[] = [];
    const zoneIds: number[] = [];
    const partZoneMap: Partial<Record<BodyPart, number>> = {};

    if (leftHand !== null) {
      parts.push('leftHand');
      zoneIds.push(leftHand);
      partZoneMap.leftHand = leftHand;
    }
    if (rightHand !== null) {
      parts.push('rightHand');
      zoneIds.push(rightHand);
      partZoneMap.rightHand = rightHand;
    }
    if (head !== null) {
      parts.push('head');
      zoneIds.push(head);
      partZoneMap.head = head;
    }
    if (hip !== null) {
      parts.push('hip');
      zoneIds.push(hip);
      partZoneMap.hip = hip;
    }

    const distinctZoneIds = Array.from(new Set(zoneIds));

    records.push({
      id,
      patternType,
      name,
      leftHand,
      rightHand,
      head,
      hip,
      partCount,
      parts,
      zoneIds,
      distinctZoneIds,
      partZoneMap,
    });
  }

  return records;
}

/**
 * 단일 피트니스 패턴 레코드의 유효성을 검증
 */
export function validateFitnessPattern(record: FitnessPatternRecord): ValidationResult {
  const errors: string[] = [];

  // 1. ID 접두사와 패턴 타입 일치 확인
  const expectedPrefix = record.patternType;
  if (!record.id.startsWith(expectedPrefix)) {
    errors.push(`ID '${record.id}'가 패턴 타입 '${expectedPrefix}'와 불일치합니다.`);
  }

  // 2. 부위 수 일치 검증
  if (record.parts.length !== record.partCount) {
    errors.push(
      `활성 부위 수(${record.parts.length})와 명시된 판정 부위 수(${record.partCount})가 다릅니다.`
    );
  }

  // 3. 패턴 유형별 부위 수 검증
  const expectedCounts: Record<PatternType, number> = {
    S: 1,
    D: 2,
    T: 3,
    Q: 4,
  };
  if (record.parts.length !== expectedCounts[record.patternType]) {
    errors.push(
      `패턴 유형 ${record.patternType}의 요구 부위 수는 ${expectedCounts[record.patternType]}개이나, ${record.parts.length}개입니다.`
    );
  }

  // 4. 존 번호 범위 검증 (1~11)
  for (const [part, zone] of Object.entries(record.partZoneMap) as [BodyPart, number][]) {
    if (zone < 1 || zone > 11) {
      errors.push(`부위 '${part}'의 존 번호(${zone})가 유효 범위(1~11)를 벗어납니다.`);
    }
  }

  // 5. C6 제약조건 검증 (부위 수 >= 존 수)
  if (record.parts.length < record.distinctZoneIds.length) {
    errors.push(
      `부위 수(${record.parts.length})가 고유 존 수(${record.distinctZoneIds.length})보다 적어 집합 덮기가 불가능합니다.`
    );
  }

  // 6. C5 부위별 허용 구역 검증 (머리: {4,5}, 골반: {6~11})
  if (record.head !== null && !HEAD_ZONES.has(record.head)) {
    errors.push(`머리 존(${record.head})이 허용 구역(HEAD_ZONES: 4, 5)을 벗어납니다.`);
  }
  if (record.hip !== null && !HIP_ZONES.has(record.hip)) {
    errors.push(`골반 존(${record.hip})이 허용 구역(HIP_ZONES: 6~11)을 벗어납니다.`);
  }

  // 7. C8 Cross-Body 물리 연동 제약 검증 (골반 9~11 시 손 1~3 차단)
  if (record.hip !== null) {
    if (record.leftHand !== null && isCrossBodyViolation(record.leftHand, record.hip)) {
      errors.push(
        `Cross-Body 제약 위반: 골반 존 ${record.hip}(최하단)일 때 왼손 존 ${record.leftHand}(최상단) 불가`
      );
    }
    if (record.rightHand !== null && isCrossBodyViolation(record.rightHand, record.hip)) {
      errors.push(
        `Cross-Body 제약 위반: 골반 존 ${record.hip}(최하단)일 때 오른손 존 ${record.rightHand}(최상단) 불가`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 전체 패턴 배열의 유효성을 검증하고 집계 결과 반환
 */
export function validateAllFitnessPatterns(records: FitnessPatternRecord[]): {
  total: number;
  validCount: number;
  invalidCount: number;
  invalidRecords: { id: string; errors: string[] }[];
} {
  const invalidRecords: { id: string; errors: string[] }[] = [];

  for (const record of records) {
    const res = validateFitnessPattern(record);
    if (!res.valid) {
      invalidRecords.push({ id: record.id, errors: res.errors });
    }
  }

  return {
    total: records.length,
    validCount: records.length - invalidRecords.length,
    invalidCount: invalidRecords.length,
    invalidRecords,
  };
}

/**
 * 패턴 유형(S, D, T, Q)별 필터링
 */
export function filterPatternsByType(
  records: FitnessPatternRecord[],
  type: PatternType
): FitnessPatternRecord[] {
  return records.filter((r) => r.patternType === type);
}

/**
 * 판정 부위 수(1~4)별 필터링
 */
export function filterPatternsByPartCount(
  records: FitnessPatternRecord[],
  count: number
): FitnessPatternRecord[] {
  return records.filter((r) => r.partCount === count);
}

/**
 * 특정 신체 부위를 포함하는 패턴 필터링
 */
export function filterPatternsByPart(
  records: FitnessPatternRecord[],
  part: BodyPart
): FitnessPatternRecord[] {
  return records.filter((r) => r.parts.includes(part));
}

/**
 * Cross-Body 제약(골반 9~11 & 손 1~3)을 위반하지 않는 안전 패턴만 필터링 (Issue #158 / FEAT-ZONE-004)
 */
export function filterCrossBodyPatterns(
  records: FitnessPatternRecord[]
): FitnessPatternRecord[] {
  return records.filter((r) => {
    if (r.hip === null) return true;
    if (r.leftHand !== null && isCrossBodyViolation(r.leftHand, r.hip)) return false;
    if (r.rightHand !== null && isCrossBodyViolation(r.rightHand, r.hip)) return false;
    return true;
  });
}

/**
 * CSV 한 줄을 콤마 및 따옴표 인식하여 필드 배열로 파싱
 */
function parseCSVLine(line: string): string[] {
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
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}
