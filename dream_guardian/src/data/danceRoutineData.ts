/**
 * danceRoutineData.ts - 고양이 그루브 안무 기반 피트니스존 노트 및 동적 루틴 데이터 레지스트리
 *
 * Groove Pop / Jazzhop 음악 안무 분석 기반 4대 핵심 동작 및 페이즈별 루틴:
 * 1. 로우바운스 & 오픈스텝 (Low Bounce & Open Step: Zone 6, 8, 10 / 발 9, 11)
 * 2. 우측 스카이포인트 & 크로스탭 (Right Sky Point: Zone 3, 6, 8 / 발 9)
 * 3. 냥냥 가슴모으기 & 힙스웨이 (Center Clasp: Zone 4, 5, 8 / 발 10)
 * 4. 좌측 스카이포인트 & 크로스탭 (Left Sky Point: Zone 1, 6, 8 / 발 11)
 *
 * 동적 데이터화 기능:
 * - DancePatternRegistry: 패턴 추가(register), 수정(update), 삭제(unregister), 조회(get/getAll)
 * - 유효성 검증: 신체 물리 제약(isCrossBodyViolation) 및 피트니스 존 유효성(isValidZoneForCursor) 자동 검증
 * - 데이터 직렬화: JSON (toJSON/loadFromJSON) 및 CSV (toCSV/loadFromCSV) 동적 입출력 지원
 */

import type { Keynote, KeynotePart, KeynoteInstrument } from '../types/keynote.js';
import type { BodyPart, FitnessPatternRecord } from '../types/posture.js';
import { isCrossBodyViolation, isValidZoneForCursor } from '../../config/zone.config.js';

export type DanceMotionType =
  | 'low_bounce'
  | 'sky_point_right'
  | 'center_clasp'
  | 'sky_point_left';

export interface CatChoreoPattern {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly motionType: DanceMotionType;
  readonly leftHand: number | null;
  readonly rightHand: number | null;
  readonly head: number | null;
  readonly hip: number | null;
  readonly footZones: readonly number[];
  readonly partZoneMap: Partial<Record<BodyPart, number>>;
}

/** 4대 핵심 고양이 안무 기본 패턴 원본 데이터 */
export const DEFAULT_CAT_CHOREO_PATTERNS: readonly CatChoreoPattern[] = Object.freeze([
  Object.freeze({
    id: 'CAT_LOW_BOUNCE',
    name: '로우바운스 & 오픈스텝 (Low Bounce)',
    description: '양손을 하단으로 뻗고 무릎을 굽혀 골반을 낮추는 탄력 바운스',
    motionType: 'low_bounce' as DanceMotionType,
    leftHand: 6,
    rightHand: 8,
    head: null,
    hip: 10,
    footZones: Object.freeze([9, 11]),
    partZoneMap: Object.freeze({ leftHand: 6, rightHand: 8, hip: 10 }),
  }),
  Object.freeze({
    id: 'CAT_SKY_POINT_RIGHT',
    name: '우측 스카이포인트 & 크로스탭 (Right Sky Point)',
    description: '오른손을 하늘 높이 찌르고 왼손은 허리 지지, 반대쪽 발 교차 탭',
    motionType: 'sky_point_right' as DanceMotionType,
    leftHand: 6,
    rightHand: 3,
    head: null,
    hip: 8,
    footZones: Object.freeze([9]),
    partZoneMap: Object.freeze({ leftHand: 6, rightHand: 3, hip: 8 }),
  }),
  Object.freeze({
    id: 'CAT_CENTER_CLASP',
    name: '냥냥 가슴모으기 & 힙스웨이 (Center Clasp & Sway)',
    description: '양손을 가슴 앞으로 모으고 골반을 부드럽게 튕기는 힙 스웨이',
    motionType: 'center_clasp' as DanceMotionType,
    leftHand: 4,
    rightHand: 5,
    head: 4,
    hip: 8,
    footZones: Object.freeze([10]),
    partZoneMap: Object.freeze({ leftHand: 4, rightHand: 5, head: 4, hip: 8 }),
  }),
  Object.freeze({
    id: 'CAT_SKY_POINT_LEFT',
    name: '좌측 스카이포인트 & 크로스탭 (Left Sky Point)',
    description: '왼손을 하늘 높이 찌르고 오른손은 허리 지지, 반대쪽 발 교차 탭',
    motionType: 'sky_point_left' as DanceMotionType,
    leftHand: 1,
    rightHand: 8,
    head: null,
    hip: 6,
    footZones: Object.freeze([11]),
    partZoneMap: Object.freeze({ leftHand: 1, rightHand: 8, hip: 6 }),
  }),
]);

/** 하위 호환성을 위한 CAT_CHOREO_PATTERNS 별칭 */
export const CAT_CHOREO_PATTERNS: readonly CatChoreoPattern[] = DEFAULT_CAT_CHOREO_PATTERNS;

/** 에디터 및 확장 모드용 12대 안무 패턴 프리셋 */
export const EXTENDED_CAT_CHOREO_PATTERNS: readonly CatChoreoPattern[] = Object.freeze([
  ...DEFAULT_CAT_CHOREO_PATTERNS,
  Object.freeze({
    id: 'CAT_DOUBLE_PUNCH',
    name: '더블 펀치 & 와이드 스쿼트 (Double Punch)',
    description: '양손으로 가슴 앞을 강하게 타격하며 하단으로 스쿼트 착지',
    motionType: 'low_bounce' as DanceMotionType,
    leftHand: 4,
    rightHand: 5,
    head: null,
    hip: 10,
    footZones: Object.freeze([9, 11]),
    partZoneMap: Object.freeze({ leftHand: 4, rightHand: 5, hip: 10 }),
  }),
  Object.freeze({
    id: 'CAT_WAVE_RIGHT',
    name: '우측 고양이 웨이브 (Right Cat Wave)',
    description: '오른손을 부드럽게 상단으로 띄우며 골반을 우측으로 부드럽게 튕김',
    motionType: 'sky_point_right' as DanceMotionType,
    leftHand: 4,
    rightHand: 2,
    head: null,
    hip: 8,
    footZones: Object.freeze([9]),
    partZoneMap: Object.freeze({ leftHand: 4, rightHand: 2, hip: 8 }),
  }),
  Object.freeze({
    id: 'CAT_WAVE_LEFT',
    name: '좌측 고양이 웨이브 (Left Cat Wave)',
    description: '왼손을 부드럽게 상단으로 띄우며 골반을 좌측으로 부드럽게 튕김',
    motionType: 'sky_point_left' as DanceMotionType,
    leftHand: 2,
    rightHand: 5,
    head: null,
    hip: 6,
    footZones: Object.freeze([11]),
    partZoneMap: Object.freeze({ leftHand: 2, rightHand: 5, hip: 6 }),
  }),
  Object.freeze({
    id: 'CAT_HIGH_CLAP',
    name: '하이 점핑 냥냥 클랩 (High Jump Clap)',
    description: '머리 위 상단으로 양손을 모아 박수를 치고 고양이 귀 쫑긋 포즈',
    motionType: 'center_clasp' as DanceMotionType,
    leftHand: 2,
    rightHand: 2,
    head: 4,
    hip: 8,
    footZones: Object.freeze([10]),
    partZoneMap: Object.freeze({ leftHand: 2, rightHand: 2, head: 4, hip: 8 }),
  }),
  Object.freeze({
    id: 'CAT_CROSS_DEFENSE',
    name: '크로스 가드 & 딥 스쿼트 (Cross Guard & Squat)',
    description: '양팔을 교차하여 가슴을 방어하고 무릎을 깊게 굽혀 탄력 유지',
    motionType: 'low_bounce' as DanceMotionType,
    leftHand: 5,
    rightHand: 4,
    head: null,
    hip: 10,
    footZones: Object.freeze([9, 11]),
    partZoneMap: Object.freeze({ leftHand: 5, rightHand: 4, hip: 10 }),
  }),
  Object.freeze({
    id: 'CAT_DIAGONAL_STRIKE_R',
    name: '대각 대시 스트라이크 우 (Diagonal Strike R)',
    description: '왼손은 허리를 받치고 오른손을 대각 우상단으로 강하게 찌르기',
    motionType: 'sky_point_right' as DanceMotionType,
    leftHand: 8,
    rightHand: 3,
    hip: 6,
    head: null,
    footZones: Object.freeze([9]),
    partZoneMap: Object.freeze({ leftHand: 8, rightHand: 3, hip: 6 }),
  }),
  Object.freeze({
    id: 'CAT_DIAGONAL_STRIKE_L',
    name: '대각 대시 스트라이크 좌 (Diagonal Strike L)',
    description: '오른손은 허리를 받치고 왼손을 대각 좌상단으로 강하게 찌르기',
    motionType: 'sky_point_left' as DanceMotionType,
    leftHand: 1,
    rightHand: 6,
    hip: 8,
    head: null,
    footZones: Object.freeze([11]),
    partZoneMap: Object.freeze({ leftHand: 1, rightHand: 6, hip: 8 }),
  }),
  Object.freeze({
    id: 'CAT_FEVER_FINISH',
    name: '골드 피버 파워 앤섬 (Gold Fever Anthem)',
    description: '피버 클라이맥스를 장식하는 화려한 양손 상단 펼침 앤섬 포즈',
    motionType: 'center_clasp' as DanceMotionType,
    leftHand: 3,
    rightHand: 1,
    head: 5,
    hip: 8,
    footZones: Object.freeze([9, 11]),
    partZoneMap: Object.freeze({ leftHand: 3, rightHand: 1, head: 5, hip: 8 }),
  }),
]);

export interface PatternValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PatternLoadResult {
  loadedCount: number;
  errors: string[];
}

/**
 * DancePatternRegistry - 안무 패턴 동적 등록/수정/삭제/직렬화 관리 클래스
 */
export class DancePatternRegistry {
  private readonly _patterns = new Map<string, CatChoreoPattern>();

  constructor(initialPatterns: readonly CatChoreoPattern[] = DEFAULT_CAT_CHOREO_PATTERNS) {
    for (const pattern of initialPatterns) {
      this._patterns.set(pattern.id, { ...pattern });
    }
  }

  /**
   * 패턴의 유효성(신체 물리 제약 및 허용 피트니스 존) 검증
   */
  validate(pattern: Partial<CatChoreoPattern>): PatternValidationResult {
    const errors: string[] = [];

    if (!pattern.id || pattern.id.trim() === '') {
      errors.push('패턴 ID는 필수이며 비어있을 수 없습니다.');
    }

    const lh = pattern.leftHand ?? null;
    const rh = pattern.rightHand ?? null;
    const head = pattern.head ?? null;
    const hip = pattern.hip ?? null;

    if (lh === null && rh === null && head === null && hip === null) {
      errors.push('최소 1개 이상의 신체 부위 존이 지정되어야 합니다.');
    }

    if (lh !== null && !isValidZoneForCursor('leftHand', lh)) {
      errors.push(`왼손 존 ${lh}은(는) 유효하지 않은 존입니다.`);
    }
    if (rh !== null && !isValidZoneForCursor('rightHand', rh)) {
      errors.push(`오른손 존 ${rh}은(는) 유효하지 않은 존입니다.`);
    }
    if (head !== null && !isValidZoneForCursor('head', head)) {
      errors.push(`머리 존 ${head}은(는) 유효하지 않은 존입니다.`);
    }
    if (hip !== null && !isValidZoneForCursor('hip', hip)) {
      errors.push(`골반 존 ${hip}은(는) 유효하지 않은 존입니다.`);
    }

    if (hip !== null) {
      if (lh !== null && isCrossBodyViolation(lh, hip)) {
        errors.push(`신체 물리 제약 위반 (Cross-Body): 왼손(Zone ${lh})과 골반(Zone ${hip}) 조합은 불가능합니다.`);
      }
      if (rh !== null && isCrossBodyViolation(rh, hip)) {
        errors.push(`신체 물리 제약 위반 (Cross-Body): 오른손(Zone ${rh})과 골반(Zone ${hip}) 조합은 불가능합니다.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 신규 안무 패턴 등록 또는 교체
   */
  register(pattern: CatChoreoPattern): PatternValidationResult {
    const val = this.validate(pattern);
    if (!val.valid) {
      return val;
    }

    const partZoneMap: Partial<Record<BodyPart, number>> = { ...(pattern.partZoneMap ?? {}) };
    if (pattern.leftHand !== null) partZoneMap.leftHand = pattern.leftHand;
    if (pattern.rightHand !== null) partZoneMap.rightHand = pattern.rightHand;
    if (pattern.head !== null) partZoneMap.head = pattern.head;
    if (pattern.hip !== null) partZoneMap.hip = pattern.hip;

    this._patterns.set(pattern.id, {
      ...pattern,
      footZones: pattern.footZones ? [...pattern.footZones] : [],
      partZoneMap,
    });

    return { valid: true, errors: [] };
  }

  /**
   * 기존 안무 패턴 속성 동적 수정
   */
  update(id: string, partial: Partial<CatChoreoPattern>): PatternValidationResult {
    const existing = this._patterns.get(id);
    if (!existing) {
      return { valid: false, errors: [`패턴 ID "${id}"을(를) 찾을 수 없습니다.`] };
    }

    const merged: CatChoreoPattern = {
      ...existing,
      ...partial,
      id: existing.id,
      footZones: partial.footZones ? [...partial.footZones] : existing.footZones,
      partZoneMap: partial.partZoneMap ? { ...partial.partZoneMap } : { ...existing.partZoneMap },
    };

    if (merged.leftHand !== null) merged.partZoneMap.leftHand = merged.leftHand;
    if (merged.rightHand !== null) merged.partZoneMap.rightHand = merged.rightHand;
    if (merged.head !== null) merged.partZoneMap.head = merged.head;
    if (merged.hip !== null) merged.partZoneMap.hip = merged.hip;

    const val = this.validate(merged);
    if (!val.valid) {
      return val;
    }

    this._patterns.set(id, merged);
    return { valid: true, errors: [] };
  }

  /**
   * 안무 패턴 삭제
   */
  unregister(id: string): boolean {
    return this._patterns.delete(id);
  }

  /**
   * 특정 안무 패턴 조회
   */
  get(id: string): CatChoreoPattern | undefined {
    const p = this._patterns.get(id);
    return p ? { ...p } : undefined;
  }

  /**
   * 등록된 모든 안무 패턴 배열 반환
   */
  getAll(): CatChoreoPattern[] {
    return Array.from(this._patterns.values()).map((p) => ({ ...p }));
  }

  /**
   * 특정 패턴 존재 여부 확인
   */
  has(id: string): boolean {
    return this._patterns.has(id);
  }

  /**
   * 모든 패턴 비우기
   */
  clear(): void {
    this._patterns.clear();
  }

  /**
   * 기본 4대 안무 패턴으로 초기화
   */
  reset(): void {
    this._patterns.clear();
    for (const pattern of DEFAULT_CAT_CHOREO_PATTERNS) {
      this._patterns.set(pattern.id, { ...pattern });
    }
  }

  /**
   * JSON 문자열로 직렬화 내보내기
   */
  toJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * JSON 문자열로부터 패턴 배열을 파싱하여 동적 등록
   */
  loadFromJSON(jsonString: string): PatternLoadResult {
    const errors: string[] = [];
    let loadedCount = 0;
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        return { loadedCount: 0, errors: ['JSON 데이터는 배열 형태여야 합니다.'] };
      }
      for (const item of parsed) {
        const res = this.register(item);
        if (res.valid) {
          loadedCount++;
        } else {
          errors.push(`패턴 "${item.id ?? 'unknown'}": ${res.errors.join(', ')}`);
        }
      }
    } catch (e: any) {
      errors.push(`JSON 파싱 실패: ${e?.message ?? String(e)}`);
    }
    return { loadedCount, errors };
  }

  /**
   * CSV 포맷으로 직렬화 내보내기
   */
  toCSV(): string {
    const header = 'ID,NAME,DESCRIPTION,MOTION_TYPE,LEFT_HAND,RIGHT_HAND,HEAD,HIP,FOOT_ZONES';
    const lines = [header];
    for (const p of this.getAll()) {
      const lh = p.leftHand ?? 'X';
      const rh = p.rightHand ?? 'X';
      const hd = p.head ?? 'X';
      const hp = p.hip ?? 'X';
      const fz = p.footZones && p.footZones.length > 0 ? p.footZones.join('|') : 'X';
      const cleanName = `"${p.name.replace(/"/g, '""')}"`;
      const cleanDesc = `"${p.description.replace(/"/g, '""')}"`;
      lines.push(`${p.id},${cleanName},${cleanDesc},${p.motionType},${lh},${rh},${hd},${hp},${fz}`);
    }
    return lines.join('\n');
  }

  /**
   * CSV 포맷 문자열로부터 파싱하여 동적 등록
   */
  loadFromCSV(csvText: string): PatternLoadResult {
    const errors: string[] = [];
    let loadedCount = 0;
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { loadedCount: 0, errors: ['CSV 내용이 비어있거나 헤더만 있습니다.'] };
    }

    for (let i = 1; i < lines.length; i++) {
      const row = parseSimpleCSVLine(lines[i]);
      if (row.length < 9) {
        errors.push(`Line ${i + 1}: 필드 수 부족 (최소 9개 필요)`);
        continue;
      }
      const [id, name, description, motionType, lhStr, rhStr, hdStr, hpStr, fzStr] = row;
      const parseZ = (s: string) => (s === 'X' || s === 'x' || s.trim() === '' ? null : parseInt(s.trim(), 10));
      const footZones =
        fzStr === 'X' || fzStr === 'x' || fzStr.trim() === ''
          ? []
          : fzStr
              .split('|')
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !isNaN(n));

      const pattern: CatChoreoPattern = {
        id: id.trim(),
        name: name.trim(),
        description: description.trim(),
        motionType: motionType.trim() as DanceMotionType,
        leftHand: parseZ(lhStr),
        rightHand: parseZ(rhStr),
        head: parseZ(hdStr),
        hip: parseZ(hpStr),
        footZones,
        partZoneMap: {},
      };

      const res = this.register(pattern);
      if (res.valid) {
        loadedCount++;
      } else {
        errors.push(`Line ${i + 1} (${id}): ${res.errors.join(', ')}`);
      }
    }

    return { loadedCount, errors };
  }
}

/** 기본 싱글톤 레지스트리 인스턴스 */
export const dancePatternRegistry = new DancePatternRegistry(DEFAULT_CAT_CHOREO_PATTERNS);

function parseSimpleCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export interface QuestionPhaseNote {
  beat: number;
  action: 'dip' | 'rebound';
  description: string;
  targetZones: readonly number[];
  primaryPart: BodyPart;
}

export interface QuestionPhaseRoutine {
  readonly beats: number;
  readonly motionType: DanceMotionType;
  readonly prompt: string;
  readonly notes: readonly QuestionPhaseNote[];
}

/** 1. 문제 페이즈: 8박 로우바운스 모션 루틴 */
const QUESTION_NOTES: readonly QuestionPhaseNote[] = [
  { beat: 1, action: 'rebound', description: '바운스 리바운드 (Up)', targetZones: [6, 8], primaryPart: 'hip' },
  { beat: 2, action: 'dip', description: '바운스 딥 (Down 스쿼트)', targetZones: [6, 8, 10], primaryPart: 'hip' },
  { beat: 3, action: 'rebound', description: '바운스 리바운드 (Up)', targetZones: [6, 8], primaryPart: 'hip' },
  { beat: 4, action: 'dip', description: '바운스 딥 (Down 스쿼트)', targetZones: [6, 8, 10], primaryPart: 'hip' },
  { beat: 5, action: 'rebound', description: '바운스 리바운드 (Up)', targetZones: [6, 8], primaryPart: 'hip' },
  { beat: 6, action: 'dip', description: '바운스 딥 (Down 스쿼트)', targetZones: [6, 8, 10], primaryPart: 'hip' },
  { beat: 7, action: 'rebound', description: '바운스 리바운드 (Up)', targetZones: [6, 8], primaryPart: 'hip' },
  { beat: 8, action: 'dip', description: '바운스 딥 (Down 스쿼트)', targetZones: [6, 8, 10], primaryPart: 'hip' },
];

export const QUESTION_PHASE_ROUTINE: QuestionPhaseRoutine = Object.freeze({
  beats: 8,
  motionType: 'low_bounce',
  prompt: '음악에 맞춰 무릎을 가볍게 굽혔다 펴며 로우바운스 리듬을 타세요!',
  notes: Object.freeze(QUESTION_NOTES),
});

export interface AnswerChoiceNote {
  choiceIndex: number;
  zoneId: number;
  label: string;
  targetPart: BodyPart;
}

export interface AnswerPhaseRoutine {
  readonly maxBeats: number;
  readonly prompt: string;
  readonly choices: readonly AnswerChoiceNote[];
}

/** 2. 답선택 페이즈: 2박 좌우 즉시 선택 루틴 */
const ANSWER_CHOICES: readonly AnswerChoiceNote[] = [
  { choiceIndex: 0, zoneId: 4, label: '0번 (좌측 답안)', targetPart: 'leftHand' },
  { choiceIndex: 1, zoneId: 5, label: '1번 (우측 답안)', targetPart: 'rightHand' },
];

export const ANSWER_PHASE_ROUTINE: AnswerPhaseRoutine = Object.freeze({
  maxBeats: 2,
  prompt: '가슴에서 원하는 정답 방향(좌측 Zone 4 또는 우측 Zone 5)으로 한 팔을 뻗으세요!',
  choices: Object.freeze(ANSWER_CHOICES),
});

export interface StarCollectNote {
  beat: number;
  patternId: string;
  part: KeynotePart;
  zoneId: number;
  instrument: KeynoteInstrument;
  actionName: string;
}

export interface StarCollectRoutine {
  readonly beats: number;
  readonly prompt: string;
  readonly notes: readonly StarCollectNote[];
}

/** 3. 별모으기 페이즈: 2~8박(7비트) 로우바운스 & 우측스카이포인트 루틴 */
const STAR_NOTES: readonly StarCollectNote[] = [
  {
    beat: 2,
    patternId: 'CAT_LOW_BOUNCE',
    part: 'hip',
    zoneId: 10,
    instrument: 'foot',
    actionName: '로우바운스 딥 (스쿼트 드럼 킥)',
  },
  {
    beat: 3,
    patternId: 'CAT_LOW_BOUNCE',
    part: 'leftHand',
    zoneId: 6,
    instrument: 'hand',
    actionName: '로우바운스 좌측 핸즈 (기타 E3)',
  },
  {
    beat: 4,
    patternId: 'CAT_LOW_BOUNCE',
    part: 'rightHand',
    zoneId: 8,
    instrument: 'hand',
    actionName: '로우바운스 우측 핸즈 (기타 G3)',
  },
  {
    beat: 5,
    patternId: 'CAT_SKY_POINT_RIGHT',
    part: 'rightHand',
    zoneId: 3,
    instrument: 'hand',
    actionName: '우측 스카이포인트 찌르기 (기타 A3)',
  },
  {
    beat: 6,
    patternId: 'CAT_SKY_POINT_RIGHT',
    part: 'leftHand',
    zoneId: 6,
    instrument: 'hand',
    actionName: '우측 스카이 왼손 허리 지지 (기타 C4)',
  },
  {
    beat: 7,
    patternId: 'CAT_LOW_BOUNCE',
    part: 'hip',
    zoneId: 10,
    instrument: 'foot',
    actionName: '로우바운스 딥 킥 (드럼 킥)',
  },
  {
    beat: 8,
    patternId: 'CAT_SKY_POINT_RIGHT',
    part: 'rightHand',
    zoneId: 3,
    instrument: 'hand',
    actionName: '스카이포인트 피니시 스트라이크 (기타 D4 파워코드)',
  },
];

export const STAR_COLLECT_ROUTINE: StarCollectRoutine = Object.freeze({
  beats: 7,
  prompt: '로우바운스와 우측 스카이포인트로 별빛 노트를 완벽하게 연주하세요!',
  notes: Object.freeze(STAR_NOTES),
});

export interface FeverPatternBlock {
  patternId: string;
  name: string;
  startBeat: number;
  endBeat: number;
  motionType: DanceMotionType;
  primaryZones: readonly number[];
}

export interface FeverPhaseRoutine {
  readonly totalBeats: number;
  readonly patterns: readonly FeverPatternBlock[];
}

/** 4. 피버, 페이즈B: 4가지 안무 패턴 순환 루틴 (16박 풀루프) */
const FEVER_PATTERNS: readonly FeverPatternBlock[] = [
  {
    patternId: 'CAT_LOW_BOUNCE',
    name: '패턴 1: 로우바운스 & 오픈스텝',
    startBeat: 1,
    endBeat: 4,
    motionType: 'low_bounce',
    primaryZones: [6, 8, 10],
  },
  {
    patternId: 'CAT_SKY_POINT_RIGHT',
    name: '패턴 2: 우측 스카이포인트 & 크로스탭',
    startBeat: 5,
    endBeat: 8,
    motionType: 'sky_point_right',
    primaryZones: [3, 6, 8],
  },
  {
    patternId: 'CAT_CENTER_CLASP',
    name: '패턴 3: 냥냥 가슴모으기 & 힙스웨이',
    startBeat: 9,
    endBeat: 12,
    motionType: 'center_clasp',
    primaryZones: [4, 5, 8],
  },
  {
    patternId: 'CAT_SKY_POINT_LEFT',
    name: '패턴 4: 좌측 스카이포인트 & 크로스탭',
    startBeat: 13,
    endBeat: 16,
    motionType: 'sky_point_left',
    primaryZones: [1, 6, 8],
  },
];

export const FEVER_PHASE_B_ROUTINE: FeverPhaseRoutine = Object.freeze({
  totalBeats: 16,
  patterns: Object.freeze(FEVER_PATTERNS),
});

/**
 * 별모으기 페이즈를 위한 Keynote[] 배열 생성
 */
export function getDanceKeynotesForStarCollection(): Keynote[] {
  return STAR_COLLECT_ROUTINE.notes.map((note) => ({
    beat: note.beat,
    patternId: note.patternId,
    part: note.part,
    zoneId: note.zoneId,
    instrument: note.instrument,
  }));
}

/**
 * 등록된 패턴들을 FitnessPatternRecord 규격으로 변환
 */
export function getDancePatternRecords(
  registry: DancePatternRegistry = dancePatternRegistry,
): FitnessPatternRecord[] {
  return registry.getAll().map((pattern) => {
    const parts: BodyPart[] = [];
    const zoneIds: number[] = [];

    if (pattern.leftHand !== null) {
      parts.push('leftHand');
      zoneIds.push(pattern.leftHand);
    }
    if (pattern.rightHand !== null) {
      parts.push('rightHand');
      zoneIds.push(pattern.rightHand);
    }
    if (pattern.head !== null) {
      parts.push('head');
      zoneIds.push(pattern.head);
    }
    if (pattern.hip !== null) {
      parts.push('hip');
      zoneIds.push(pattern.hip);
    }

    return {
      id: pattern.id,
      patternType: 'Q',
      name: pattern.name,
      leftHand: pattern.leftHand,
      rightHand: pattern.rightHand,
      head: pattern.head,
      hip: pattern.hip,
      partCount: parts.length,
      parts,
      zoneIds,
      distinctZoneIds: Array.from(new Set(zoneIds)),
      partZoneMap: { ...pattern.partZoneMap },
    };
  });
}

/**
 * 페이즈명에 따른 루틴 데이터 반환
 */
export function getDanceRoutineForPhase(phase: string): unknown {
  switch (phase) {
    case 'RUN_QUESTION':
      return QUESTION_PHASE_ROUTINE;
    case 'ANSWER_SELECT':
      return ANSWER_PHASE_ROUTINE;
    case 'STAR_COLLECT':
    case 'KEYNOTE_PERFORMANCE':
      return STAR_COLLECT_ROUTINE;
    case 'FEVER_PHASE_B':
      return FEVER_PHASE_B_ROUTINE;
    default:
      return null;
  }
}
