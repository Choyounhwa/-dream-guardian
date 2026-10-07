/**
 * motion-note-profile.config.ts - 통합 모션 리듬 노트 비주얼 프로필 및 기본 매핑 설정
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§7 비주얼 프로필)
 * @see Issue #476 [MRN-02]
 */

import {
  isFloorPart,
  type MotionInteractionType,
  type MotionNote,
} from '../src/types/motion-note.js';
import { DEFAULT_STAR_NOTE_VISUAL_CONFIG } from './beat-motion.config.js';
import {
  DEFAULT_STOMP_NOTE_RADIUS,
  DEFAULT_STOMP_NOTE_MIN_SCALE,
  DEFAULT_STOMP_NOTE_MAX_SCALE,
  RUNNING_MAT_CONFIG,
} from './running-mat.config.js';

export interface NoteFlightProfile {
  /** 소실점 출발 배율 */
  readonly minScale: number;
  /** 착지 판정 시점 배율 */
  readonly maxScale: number;
  /** 원근 가속 지수 (t^n). 현행: 별 2.0, 발 1.4, 장판 1.5 */
  readonly easingExponent: number;
}

export interface NoteRingProfile {
  /** Ring Painter 레지스트리 키: 'circle'|'rect'|'ellipseWide'|'hexagon'|'spiral'|'image' */
  readonly painter: string;
  /** painter='image'일 때 이미지 식별 키 */
  readonly imageKey?: string;
  /** 링 색상 또는 4색 커서 색상 ('byPart') */
  readonly color: string | 'byPart';
  /** 어프로치 링 시작 배율 */
  readonly startScale: number;
  /** 어프로치 링 종료 배율 (수축 완료: 1.0) */
  readonly endScale: number;
  /** 링 선 굵기 */
  readonly strokeWidth: number;
  /** 글로우 블러 반경 */
  readonly glowBlur: number;
  /** 링 불투명도 */
  readonly alpha: number;
  /** Perfect 윈도우 진입 시 펄스 여부 */
  readonly landingPulse: boolean;
}

export interface NoteBodyProfile {
  /** Body Painter 키: 'orb'|'image'|'symbol'|'hazardSkull'|'shield' */
  readonly painter: string;
  /** 이미지 바디 식별 키 */
  readonly imageKey?: string;
  /** 이미지 로드 실패 시 또는 심볼 렌더러용 폴백 텍스트 ('★','♪','⚠','🛡') */
  readonly symbol?: string;
  /** 기준 반지름 (px) */
  readonly baseRadius: number;
  /** 본체 채우기 색상 */
  readonly fillColor: string;
  /** 테두리 색상 또는 4색 커서/레인 색상 ('byPart') */
  readonly borderColor: string | 'byPart';
  /** 자전 회전 속도 (선택적) */
  readonly spinSpeed?: number;
  /** 발 노트의 L/C/R 레인 표시 여부 (기존 동작 보존) */
  readonly showLaneLabel?: boolean;
}

export interface NoteTrailProfile {
  /** Trail Painter 키: 'beam' | 'gradient' | 'stream' | 'none' */
  readonly painter: 'beam' | 'gradient' | 'stream' | 'none';
  /** 트레일 길이 비율 (0.0 ~ 1.0) */
  readonly lengthRatio: number;
  /** 트레일 불투명도 */
  readonly alpha: number;
}

export interface NoteOverlayProfile {
  /** 상태별 오버레이 키 (hold 게이지, evade 경고 점멸 등) */
  readonly painter: string;
  /** 오버레이 파라미터 */
  readonly params?: Record<string, number | string>;
}

export interface NoteFeedbackProfile {
  /** 성공 이펙트 키 */
  readonly hitVfx: string;
  /** 실패 이펙트 키 */
  readonly missVfx: string;
  /** 성공 사운드 키 */
  readonly hitSfx?: string;
  /** 실패 사운드 키 */
  readonly missSfx?: string;
}

/**
 * 모션 노트 외형 및 비행 연출 정의 프로필
 */
export interface NoteVisualProfile {
  readonly profileId: string;
  readonly flight: NoteFlightProfile;
  readonly ring: NoteRingProfile | null;
  readonly body: NoteBodyProfile;
  readonly trail: NoteTrailProfile;
  readonly overlay?: NoteOverlayProfile;
  readonly feedback: NoteFeedbackProfile;
}

/**
 * 기본 fallback 프로필 ID
 */
export const DEFAULT_FALLBACK_PROFILE_ID = 'star_hand';

/**
 * 기본 프로필 1: star_hand (tap × 손/머리/골반 커서 노트 현행 재현)
 * StarNoteRenderer (t^2, 0.3 -> 1.2, 원형 링, byPart 4색)
 */
export const STAR_HAND_PROFILE: NoteVisualProfile = Object.freeze({
  profileId: 'star_hand',
  flight: Object.freeze({
    minScale: 0.3,
    maxScale: 1.2,
    easingExponent: 2.0,
  }),
  ring: Object.freeze({
    painter: 'circle',
    color: 'byPart' as const,
    startScale: 2.5,
    endScale: 1.0,
    strokeWidth: DEFAULT_STAR_NOTE_VISUAL_CONFIG.strokeWidthFactor ?? 4,
    glowBlur: DEFAULT_STAR_NOTE_VISUAL_CONFIG.glowBlurFactor ?? 18,
    alpha: DEFAULT_STAR_NOTE_VISUAL_CONFIG.approachRingAlpha ?? 0.8,
    landingPulse: true,
  }),
  body: Object.freeze({
    painter: 'image',
    symbol: DEFAULT_STAR_NOTE_VISUAL_CONFIG.instrumentSymbols?.hand ?? '★',
    baseRadius: DEFAULT_STAR_NOTE_VISUAL_CONFIG.baseRadius,
    fillColor: DEFAULT_STAR_NOTE_VISUAL_CONFIG.bodyFillColor,
    borderColor: 'byPart' as const,
    spinSpeed: 0,
    showLaneLabel: false,
  }),
  trail: Object.freeze({
    painter: 'none' as const,
    lengthRatio: 0,
    alpha: 0,
  }),
  feedback: Object.freeze({
    hitVfx: 'starHit',
    missVfx: 'starMiss',
    hitSfx: 'starHit',
    missSfx: 'starMiss',
  }),
});

/**
 * 기본 프로필 2: stomp_foot (tap × 발 노트 현행 재현)
 * RunningMatRenderer._renderFlyingStompNotes (p^1.4, 0.3 -> 1.25, ♪, L/C/R, 레인 색)
 */
export const STOMP_FOOT_PROFILE: NoteVisualProfile = Object.freeze({
  profileId: 'stomp_foot',
  flight: Object.freeze({
    minScale: DEFAULT_STOMP_NOTE_MIN_SCALE,
    maxScale: DEFAULT_STOMP_NOTE_MAX_SCALE,
    easingExponent: 1.4,
  }),
  ring: Object.freeze({
    painter: 'circle',
    color: 'byPart' as const,
    startScale: 2.2,
    endScale: 1.0,
    strokeWidth: 3.5,
    glowBlur: 22,
    alpha: 0.8,
    landingPulse: true,
  }),
  body: Object.freeze({
    painter: 'orb',
    symbol: RUNNING_MAT_CONFIG.stompNoteSymbol ?? '♪',
    baseRadius: DEFAULT_STOMP_NOTE_RADIUS,
    fillColor: 'rgba(12, 20, 36, 0.92)',
    borderColor: 'byPart' as const,
    spinSpeed: 0,
    showLaneLabel: true,
  }),
  trail: Object.freeze({
    painter: 'beam' as const,
    lengthRatio: 0.25,
    alpha: 0.45,
  }),
  feedback: Object.freeze({
    hitVfx: 'stompHit',
    missVfx: 'stompMiss',
    hitSfx: 'stompHit',
    missSfx: 'stompMiss',
  }),
});

/**
 * 기본 프로필 3: hazard_floor (evade × 바닥/전신 위험 장판 비행 현행 재현)
 * HazardZoneRenderer (p^1.5, 0.2 -> 1.0, 링 없음)
 */
export const HAZARD_FLOOR_PROFILE: NoteVisualProfile = Object.freeze({
  profileId: 'hazard_floor',
  flight: Object.freeze({
    minScale: 0.2,
    maxScale: 1.0,
    easingExponent: 1.5,
  }),
  ring: null,
  body: Object.freeze({
    painter: 'hazardSkull',
    symbol: '⚠',
    baseRadius: 36,
    fillColor: 'rgba(255, 30, 60, 0.35)',
    borderColor: '#FF1E3C',
    spinSpeed: 0,
    showLaneLabel: false,
  }),
  trail: Object.freeze({
    painter: 'none' as const,
    lengthRatio: 0,
    alpha: 0,
  }),
  feedback: Object.freeze({
    hitVfx: 'hazardHit',
    missVfx: 'hazardEvade',
    hitSfx: 'hazardHit',
    missSfx: 'hazardEvade',
  }),
});

/**
 * 기본 프로필 4: boss_slam (jump/evade × bothFeet 보스 장판/강타 현행 재현)
 * BossClimaxRenderer (p^1.4, 0.3 -> 1.2, 링 없음)
 */
export const BOSS_SLAM_PROFILE: NoteVisualProfile = Object.freeze({
  profileId: 'boss_slam',
  flight: Object.freeze({
    minScale: 0.3,
    maxScale: 1.2,
    easingExponent: 1.4,
  }),
  ring: null,
  body: Object.freeze({
    painter: 'hazardSkull',
    symbol: '⚠',
    baseRadius: 40,
    fillColor: 'rgba(120, 20, 140, 0.7)',
    borderColor: '#78148C',
    spinSpeed: 0,
    showLaneLabel: false,
  }),
  trail: Object.freeze({
    painter: 'none' as const,
    lengthRatio: 0,
    alpha: 0,
  }),
  feedback: Object.freeze({
    hitVfx: 'bossSlamHit',
    missVfx: 'bossSlamEvade',
    hitSfx: 'bossSlamHit',
    missSfx: 'bossSlamEvade',
  }),
});

/**
 * 기본 등록 비주얼 프로필 딕셔너리
 */
export const DEFAULT_NOTE_PROFILES: Readonly<Record<string, NoteVisualProfile>> = Object.freeze({
  star_hand: STAR_HAND_PROFILE,
  stomp_foot: STOMP_FOOT_PROFILE,
  hazard_floor: HAZARD_FLOOR_PROFILE,
  boss_slam: BOSS_SLAM_PROFILE,
});

export const NOTE_VISUAL_PROFILES = DEFAULT_NOTE_PROFILES;

/**
 * profileId 미지정 노트의 기본 결정 규칙 테이블
 * (인터랙션 타입 × 부위 범주 매핑)
 */
export const DEFAULT_PROFILE_MAP: Readonly<
  Record<MotionInteractionType, Readonly<Partial<Record<'hand' | 'floor', string>>>>
> = Object.freeze({
  tap: Object.freeze({ hand: 'star_hand', floor: 'stomp_foot' }),
  evade: Object.freeze({ floor: 'hazard_floor' }),
  jump: Object.freeze({ floor: 'boss_slam' }),
  hold: Object.freeze({ hand: 'hold_nebula' }),
  rub: Object.freeze({ hand: 'rub_vortex' }),
  guard: Object.freeze({ hand: 'guard_shield' }),
});

/**
 * 주어진 모션 노트에 적용할 비주얼 프로필을 해석하여 반환한다.
 *
 * 1. note.profileId가 명시되어 있고 등록되어 있으면 해당 프로필 반환 (override 최우선)
 * 2. note.requirements 중 FloorPart가 존재하면 'floor', 아니면 'hand' 범주로 분류
 * 3. profileMap에서 interaction + 범주에 해당하는 profileId 검색
 * 4. 매핑된 profileId가 존재하면 해당 프로필 반환
 * 5. 미매핑 또는 미등록 시 기본 안전 폴백 프로필 ('star_hand') 반환
 */
export function resolveProfile(
  note: MotionNote,
  profiles: Record<string, NoteVisualProfile> = DEFAULT_NOTE_PROFILES,
  profileMap: Record<MotionInteractionType, Partial<Record<'hand' | 'floor', string>>> = DEFAULT_PROFILE_MAP,
): NoteVisualProfile {
  // 1. note.profileId override 명시 시
  if (note.profileId && profiles[note.profileId]) {
    return profiles[note.profileId];
  }

  // 2. 부위 범주 판정 ('floor' vs 'hand')
  const isFloor =
    Array.isArray(note.requirements) &&
    note.requirements.length > 0 &&
    note.requirements.some((req) => isFloorPart(req.part));
  const category: 'hand' | 'floor' = isFloor ? 'floor' : 'hand';

  // 3. interaction + category 기반 기본 프로필 결정
  const mappedProfileId = profileMap[note.interaction]?.[category];
  if (mappedProfileId && profiles[mappedProfileId]) {
    return profiles[mappedProfileId];
  }

  // 4. 안전 기본 폴백 (star_hand)
  return profiles[DEFAULT_FALLBACK_PROFILE_ID] ?? STAR_HAND_PROFILE;
}
