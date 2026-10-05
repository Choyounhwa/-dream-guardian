/**
 * ContentCapabilities.ts - V2 피트니스 안무 및 타임라인 게시 가능 역량·규칙 프로필
 *
 * Issue #376 / EDITOR-CAPABILITY:
 * - 480 ticks/beat, 8박(3840 ticks), 별 7착지 슬롯(2..8박)
 * - 게시 가능 입력: 손(1..5), 발(9..11)
 * - 밸런스 동작, 머리/골반 커서 별, 자유박자, 파티클은 초기 게시 불가(Non-publishable)
 * - 지원 BPM: 110, 115, 120, 125, 135, 140
 * - 크로스바디 및 안전 전이 검증 (런타임 fallback과 분리)
 * - rulesetId ('dg-ruleset-v2') 및 런타임 버전 정의
 */

import { isCrossBodyViolation } from '../../config/zone.config.js';

export const DEFAULT_RULESET_ID = 'dg-ruleset-v2' as const;
export const SUPPORTED_RULESET_IDS = ['dg-ruleset-v2'] as const;
export const SUPPORTED_RUNTIME_VERSIONS = ['2.0.0'] as const;

export const TICKS_PER_BEAT = 480 as const;
export const PHASE_A_TOTAL_BEATS = 8 as const;
export const PHASE_A_TOTAL_TICKS = 3840 as const; // 8 * 480

export const PHASE_A_STAR_SLOT_COUNT = 7 as const;
export const PHASE_A_STAR_LANDING_BEATS = [2, 3, 4, 5, 6, 7, 8] as const;
export const PHASE_A_STAR_LANDING_TICKS = [960, 1440, 1920, 2400, 2880, 3360, 3840] as const;

export const SUPPORTED_BPMS = [110, 115, 120, 125, 135, 140] as const;
export type SupportedBpm = (typeof SUPPORTED_BPMS)[number];

export const PUBLISHABLE_HAND_ZONES = [1, 2, 3, 4, 5] as const;
export const PUBLISHABLE_FOOT_ZONES = [9, 10, 11] as const;

export const PHASE_A_PUBLISHABLE_HAZARD_PATTERNS = ['left_step', 'right_step', 'jump'] as const;
export const NON_PUBLISHABLE_HAZARD_PATTERNS = ['balance_left', 'balance_right'] as const;

export const PHASE_B_PUBLISHABLE_ATTACKS = [
  'dual_slam',
  'alternating_stomp_left',
  'alternating_stomp_right',
] as const;

export const PHASE_B_ATTACK_REQUIRED_ACTIONS = {
  dual_slam: 'jump',
  alternating_stomp_left: 'left_step',
  alternating_stomp_right: 'right_step',
} as const;

export type PhaseBPublishableAttack = (typeof PHASE_B_PUBLISHABLE_ATTACKS)[number];
export type PhaseBRequiredAction = (typeof PHASE_B_ATTACK_REQUIRED_ACTIONS)[PhaseBPublishableAttack];

export interface CapabilityFeatures {
  balanceHazards: boolean;
  headStarNotes: boolean;
  hipCursorStarNotes: boolean;
  arbitraryFreeTimeBeats: boolean;
  particles: boolean;
}

export interface PublishableCapabilityProfile {
  rulesetId: string;
  supportedRuntimeVersions: readonly string[];
  ticksPerBeat: number;
  totalBranchBeats: number;
  totalBranchTicks: number;
  starSlotCount: number;
  starLandingBeats: readonly number[];
  starLandingTicks: readonly number[];
  supportedBpms: readonly number[];
  publishableHandZones: readonly number[];
  publishableFootZones: readonly number[];
  publishablePhaseAHazards: readonly string[];
  publishablePhaseBAttacks: readonly string[];
  features: CapabilityFeatures;
}

export const V2_PUBLISHABLE_CAPABILITY_PROFILE: PublishableCapabilityProfile = {
  rulesetId: DEFAULT_RULESET_ID,
  supportedRuntimeVersions: SUPPORTED_RUNTIME_VERSIONS,
  ticksPerBeat: TICKS_PER_BEAT,
  totalBranchBeats: PHASE_A_TOTAL_BEATS,
  totalBranchTicks: PHASE_A_TOTAL_TICKS,
  starSlotCount: PHASE_A_STAR_SLOT_COUNT,
  starLandingBeats: PHASE_A_STAR_LANDING_BEATS,
  starLandingTicks: PHASE_A_STAR_LANDING_TICKS,
  supportedBpms: SUPPORTED_BPMS,
  publishableHandZones: PUBLISHABLE_HAND_ZONES,
  publishableFootZones: PUBLISHABLE_FOOT_ZONES,
  publishablePhaseAHazards: PHASE_A_PUBLISHABLE_HAZARD_PATTERNS,
  publishablePhaseBAttacks: PHASE_B_PUBLISHABLE_ATTACKS,
  features: {
    balanceHazards: false,
    headStarNotes: false,
    hipCursorStarNotes: false,
    arbitraryFreeTimeBeats: false,
    particles: false,
  },
};

/**
 * BPM 지원 여부 확인
 */
export function isSupportedBpm(bpm: number): boolean {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    return false;
  }
  return (SUPPORTED_BPMS as readonly number[]).includes(bpm);
}

/**
 * BPM 기반 초당 박자 시간(secondsPerBeat) 계산
 */
export function secondsPerBeat(bpm: number, strict = true): number {
  if (strict && !isSupportedBpm(bpm)) {
    throw new RangeError(
      `Unsupported BPM: ${bpm}. Supported BPMs: ${SUPPORTED_BPMS.join(', ')}`,
    );
  }
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError(`Invalid BPM: ${bpm}`);
  }
  return 60 / bpm;
}

/**
 * Tick -> Beat 환산
 */
export function tickToBeat(tick: number, ticksPerBeat = TICKS_PER_BEAT): number {
  return tick / ticksPerBeat;
}

/**
 * Beat -> Tick 환산
 */
export function beatToTick(beat: number, ticksPerBeat = TICKS_PER_BEAT): number {
  return Math.round(beat * ticksPerBeat);
}

/**
 * 분기 내 정규 틱 유효성 검사 (0 <= tick <= 3840, 정수)
 */
export function isValidTick(tick: number): boolean {
  return (
    typeof tick === 'number' &&
    Number.isInteger(tick) &&
    tick >= 0 &&
    tick <= PHASE_A_TOTAL_TICKS
  );
}

/**
 * 별 7착지 슬롯 틱 유효성 검사 (960, 1440, 1920, 2400, 2880, 3360, 3840)
 */
export function isValidSlotTick(tick: number): boolean {
  return (PHASE_A_STAR_LANDING_TICKS as readonly number[]).includes(tick);
}

/**
 * 신체 부위 목표 객체로부터 순수 partZoneMap 도출
 */
export function derivePartZoneMap(pattern: {
  leftHand?: number | null;
  rightHand?: number | null;
  head?: number | null;
  hip?: number | null;
}): Record<string, number> {
  const map: Record<string, number> = {};
  if (pattern.leftHand != null && Number.isInteger(pattern.leftHand) && pattern.leftHand > 0) {
    map.leftHand = pattern.leftHand;
  }
  if (pattern.rightHand != null && Number.isInteger(pattern.rightHand) && pattern.rightHand > 0) {
    map.rightHand = pattern.rightHand;
  }
  if (pattern.head != null && Number.isInteger(pattern.head) && pattern.head > 0) {
    map.head = pattern.head;
  }
  if (pattern.hip != null && Number.isInteger(pattern.hip) && pattern.hip > 0) {
    map.hip = pattern.hip;
  }
  return map;
}

/**
 * 게시 가능 손 존 여부 판정
 * - leftHand: 1, 2, 4 (좌측/상단)
 * - rightHand: 2, 3, 5 (우측/상단)
 */
export function isPublishableHandZone(part: 'leftHand' | 'rightHand', zoneId: number): boolean {
  if (part === 'leftHand') {
    return [1, 2, 4].includes(zoneId);
  }
  if (part === 'rightHand') {
    return [2, 3, 5].includes(zoneId);
  }
  return false;
}

/**
 * 게시 가능 발 디딤 존 여부 판정 (9, 10, 11)
 */
export function isPublishableFootZone(zoneId: number): boolean {
  return (PUBLISHABLE_FOOT_ZONES as readonly number[]).includes(zoneId as any);
}

/**
 * 게시 가능 별 타깃 판정 (커서 손 1..5, 발 9..11만 허용; 머리/골반 커서 별 배제)
 */
export function isPublishableStarTarget(target: {
  type: 'cursor' | 'foot';
  part?: string;
  zoneId: number;
}): boolean {
  if (target.type === 'cursor') {
    if (target.part === 'leftHand') {
      return isPublishableHandZone('leftHand', target.zoneId);
    }
    if (target.part === 'rightHand') {
      return isPublishableHandZone('rightHand', target.zoneId);
    }
    // head/hip 커서는 별노트로 게시 불가
    return false;
  }
  if (target.type === 'foot') {
    // 발 타깃은 9, 10, 11만 허용
    return isPublishableFootZone(target.zoneId);
  }
  return false;
}

/**
 * Phase A 게시 가능 장판 패턴 여부 판정 (left_step, right_step, jump)
 */
export function isPublishablePhaseAHazard(pattern: string): boolean {
  return (PHASE_A_PUBLISHABLE_HAZARD_PATTERNS as readonly string[]).includes(pattern);
}

/**
 * Phase B 공격에 대응하는 필수 회피 동작 획득
 */
export function getRequiredActionForPhaseBAttack(attack: PhaseBPublishableAttack): PhaseBRequiredAction {
  const action = PHASE_B_ATTACK_REQUIRED_ACTIONS[attack];
  if (!action) {
    throw new Error(`Unsupported Phase B attack: ${attack}`);
  }
  return action;
}

/**
 * Cross-Body 물리 제약 검증
 * - 골반이 9..11일 때 손 1..3 도달 불가
 * - 왼손의 우측 끝(Zone 3) 또는 골반 9 상태에서의 Zone 2 도달 차단
 * - 오른손의 좌측 끝(Zone 1) 또는 골반 11 상태에서의 Zone 2 도달 차단
 */
export function checkCrossBodyConstraint(
  handPart: 'leftHand' | 'rightHand',
  handZone: number,
  hipZone?: number | null,
): { valid: boolean; reason?: string } {
  if (hipZone != null && isCrossBodyViolation(handZone, hipZone)) {
    return {
      valid: false,
      reason: `신체 물리 제약 위반 (Cross-Body): 골반이 Zone ${hipZone}에 위치할 때 손은 상단 Zone ${handZone}에 도달할 수 없습니다.`,
    };
  }

  // 측면 도달 한계(Lateral reach limit) 검증
  if (handPart === 'leftHand') {
    if (handZone === 3) {
      return {
        valid: false,
        reason: '왼손은 우측 끝단인 Zone 3에 도달할 수 없습니다.',
      };
    }
    if (handZone === 2 && hipZone === 9) {
      return {
        valid: false,
        reason: '골반이 좌측 하단(Zone 9)에 고정된 상태에서 왼손은 중앙 상단(Zone 2)에 도달할 수 없습니다.',
      };
    }
  }

  if (handPart === 'rightHand') {
    if (handZone === 1) {
      return {
        valid: false,
        reason: '오른손은 좌측 끝단인 Zone 1에 도달할 수 없습니다.',
      };
    }
    if (handZone === 2 && hipZone === 11) {
      return {
        valid: false,
        reason: '골반이 우측 하단(Zone 11)에 고정된 상태에서 오른손은 중앙 상단(Zone 2)에 도달할 수 없습니다.',
      };
    }
  }

  return { valid: true };
}

/**
 * 안전 전이 검증 (연속된 동일 존 반복 및 무리한 장거리 반전 이동 차단)
 */
export function checkSafeTransition(
  previous: { part: string; zoneId: number },
  next: { part: string; zoneId: number },
): { safe: boolean; reason?: string } {
  if (previous.part !== next.part) {
    return { safe: true };
  }

  if (previous.zoneId === next.zoneId) {
    return {
      safe: false,
      reason: `동일 부위(${previous.part})가 연속으로 동일 존(${previous.zoneId})에 중복 지정되었습니다.`,
    };
  }

  const isLongDistanceReversal =
    (previous.zoneId === 1 && next.zoneId === 3) ||
    (previous.zoneId === 3 && next.zoneId === 1) ||
    (previous.zoneId === 4 && next.zoneId === 5) ||
    (previous.zoneId === 5 && next.zoneId === 4) ||
    (previous.zoneId === 9 && next.zoneId === 11) ||
    (previous.zoneId === 11 && next.zoneId === 9);

  if (isLongDistanceReversal) {
    return {
      safe: false,
      reason: `Zone ${previous.zoneId}에서 Zone ${next.zoneId}로의 급격한 장거리 반전 이동은 안전하지 않습니다.`,
    };
  }

  return { safe: true };
}
