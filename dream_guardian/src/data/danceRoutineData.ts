/**
 * danceRoutineData.ts - 고양이 그루브 안무 기반 피트니스존 노트 및 루틴 데이터
 *
 * Groove Pop / Jazzhop 음악 안무 분석 기반 4대 핵심 동작 및 페이즈별 루틴:
 * 1. 로우바운스 & 오픈스텝 (Low Bounce & Open Step: Zone 6, 8, 10 / 발 9, 11)
 * 2. 우측 스카이포인트 & 크로스탭 (Right Sky Point: Zone 3, 6, 8 / 발 9)
 * 3. 냥냥 가슴모으기 & 힙스웨이 (Center Clasp: Zone 4, 5, 8 / 발 10)
 * 4. 좌측 스카이포인트 & 크로스탭 (Left Sky Point: Zone 1, 6, 8 / 발 11)
 *
 * 페이즈 매핑:
 * - 문제 페이즈: 8박 로우바운스 리듬 모션 (Dip & Rebound)
 * - 답선택 페이즈: 2박 좌우 선택 (Zone 4 - 0번, Zone 5 - 1번)
 * - 별모으기 페이즈: 2~8박 로우바운스 + 우측 스카이포인트 키노트 시퀀스
 * - 피버/페이즈B: 4개 안무 패턴 순환 16박 풀루프 안무 루틴
 */

import type { Keynote, KeynotePart, KeynoteInstrument } from '../types/keynote.js';
import type { BodyPart, FitnessPatternRecord } from '../types/posture.js';

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

/** 4대 핵심 고양이 안무 패턴 원본 정의 */
export const CAT_CHOREO_PATTERNS: readonly CatChoreoPattern[] = Object.freeze([
  Object.freeze({
    id: 'CAT_LOW_BOUNCE',
    name: '로우바운스 & 오픈스텝 (Low Bounce)',
    description: '양손을 하단으로 뻗고 무릎을 굽혀 골반을 낮추는 탄력 바운스',
    motionType: 'low_bounce',
    leftHand: 6,
    rightHand: 8,
    head: null,
    hip: 10,
    footZones: [9, 11],
    partZoneMap: { leftHand: 6, rightHand: 8, hip: 10 },
  }),
  Object.freeze({
    id: 'CAT_SKY_POINT_RIGHT',
    name: '우측 스카이포인트 & 크로스탭 (Right Sky Point)',
    description: '오른손을 하늘 높이 찌르고 왼손은 허리 지지, 반대쪽 발 교차 탭',
    motionType: 'sky_point_right',
    leftHand: 6,
    rightHand: 3,
    head: null,
    hip: 8,
    footZones: [9],
    partZoneMap: { leftHand: 6, rightHand: 3, hip: 8 },
  }),
  Object.freeze({
    id: 'CAT_CENTER_CLASP',
    name: '냥냥 가슴모으기 & 힙스웨이 (Center Clasp & Sway)',
    description: '양손을 가슴 앞으로 모으고 골반을 부드럽게 튕기는 힙 스웨이',
    motionType: 'center_clasp',
    leftHand: 4,
    rightHand: 5,
    head: 4,
    hip: 8,
    footZones: [10],
    partZoneMap: { leftHand: 4, rightHand: 5, head: 4, hip: 8 },
  }),
  Object.freeze({
    id: 'CAT_SKY_POINT_LEFT',
    name: '좌측 스카이포인트 & 크로스탭 (Left Sky Point)',
    description: '왼손을 하늘 높이 찌르고 오른손은 허리 지지, 반대쪽 발 교차 탭',
    motionType: 'sky_point_left',
    leftHand: 1,
    rightHand: 8,
    head: null,
    hip: 6,
    footZones: [11],
    partZoneMap: { leftHand: 1, rightHand: 8, hip: 6 },
  }),
]);

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
 * 4대 패턴을 FitnessPatternRecord 규격으로 변환
 */
export function getDancePatternRecords(): FitnessPatternRecord[] {
  return CAT_CHOREO_PATTERNS.map((pattern) => {
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
