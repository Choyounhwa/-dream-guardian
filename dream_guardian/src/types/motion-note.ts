/**
 * motion-note.ts - 통합 모션 리듬 노트 타입 계약 및 가드 정의
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (MRN-01 / Issue #475)
 */

import type { BodyPart } from './posture.js';

/**
 * 커서가 없는 하체/전신 부위 (판정은 MotionIntent / FootKeynoteEvent 기반)
 */
export type FloorPart = 'leftFoot' | 'rightFoot' | 'centerFoot' | 'bothFeet' | 'fullBody';

/**
 * 모션 노트 판정 대상 전체 부위 (커서 보유 BodyPart + 바닥/전신 FloorPart)
 */
export type MotionPart = BodyPart | FloorPart;

/**
 * 인터랙션 조작 유형 (전략 패턴 판정기 식별자)
 */
export type MotionInteractionType = 'tap' | 'evade' | 'hold' | 'rub' | 'guard' | 'jump';

/**
 * 단일 부위 요구 조건. 다중 요구 = Double/Triple/Quad 패턴 (fitness pattern.csv 호환)
 */
export interface PartRequirement {
  readonly part: MotionPart;
  readonly zoneId: number; // 1~11. 'bothFeet' | 'fullBody'는 대표 존 (예: 10)
}

/**
 * 모션 노트 불변 정의 데이터
 */
export interface MotionNote {
  readonly id: string;
  readonly patternId: string; // 원본 패턴 ID (Keynote/StarTarget 호환)
  readonly beat: number; // 시퀀스 상대 비트 (1-based)
  readonly requirements: readonly PartRequirement[]; // 요구 부위/존 (길이 >= 1)
  readonly interaction: MotionInteractionType;
  readonly profileId?: string; // 미지정 시 config의 기본 매핑으로 결정
  readonly leadBeats?: number; // 비행 박 수 override (미지정 시 기본값)
  readonly holdBeats?: number; // hold/rub 전용: 착지 후 유지 박 수
  readonly source?: 'star' | 'stomp' | 'hazard' | 'boss' | 'fever'; // 출처 태그
}

/**
 * 모션 노트 런타임 생명주기 상태
 */
export type MotionNoteState = 'pending' | 'inFlight' | 'judging' | 'holding' | 'resolved';

/**
 * 모션 판정 등급
 */
export type MotionRating = 'Perfect' | 'Good' | 'Late' | 'Miss';

/**
 * 판정 결과
 */
export interface MotionNoteResult {
  readonly noteId: string;
  readonly interaction: MotionInteractionType;
  readonly rating: MotionRating;
  readonly success: boolean; // evade: 회피 성공 = true
  readonly timingError: number; // 초 (+ 늦음 / - 빠름)
  readonly matchedParts: readonly MotionPart[];
}

/**
 * 모션 노트 런타임 상태 (game 레이어 관리)
 */
export interface MotionNoteRuntime {
  readonly note: MotionNote;
  readonly landingTime: number; // 절대 시각(초) = sequenceStart + (beat - 1) * spb
  readonly displayStart: number; // landingTime - leadBeats * spb
  state: MotionNoteState;
  holdProgress?: number; // 0~1 (hold/rub)
  result?: MotionNoteResult;
}

/**
 * 렌더러 전달용 읽기 전용 스냅샷 (render 입력)
 */
export interface MotionNoteRenderItem {
  readonly id: string;
  readonly requirements: readonly PartRequirement[];
  readonly interaction: MotionInteractionType;
  readonly profileId: string;
  readonly progress: number; // 0(소실점) ~ 1(착지), 착지 후 >1 가능
  readonly timeToLanding: number; // 초 (펄스 판단용)
  readonly holdProgress?: number;
  readonly outcome?: 'hit' | 'miss';
}

const FLOOR_PARTS = new Set<FloorPart>([
  'leftFoot',
  'rightFoot',
  'centerFoot',
  'bothFeet',
  'fullBody',
]);

const CURSOR_PARTS = new Set<BodyPart>([
  'leftHand',
  'rightHand',
  'head',
  'hip',
]);

const FOOT_ZONE_MAP: Record<FloorPart, number> = {
  leftFoot: 9,
  centerFoot: 10,
  rightFoot: 11,
  bothFeet: 10,
  fullBody: 10,
};

/**
 * 입력값이 FloorPart인지 확인하는 타입 가드
 */
export function isFloorPart(part: unknown): part is FloorPart {
  return typeof part === 'string' && FLOOR_PARTS.has(part as FloorPart);
}

/**
 * 입력값이 BodyPart(커서 보유 부위)인지 확인하는 타입 가드
 */
export function isCursorPart(part: unknown): part is BodyPart {
  return typeof part === 'string' && CURSOR_PARTS.has(part as BodyPart);
}

/**
 * FloorPart를 해당 대표 피트니스 존 ID(9, 10, 11)로 매핑
 */
export function footToZone(part: FloorPart): number {
  return FOOT_ZONE_MAP[part];
}
