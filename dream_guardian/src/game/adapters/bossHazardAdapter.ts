/**
 * bossHazardAdapter.ts - Phase B 보스 장판/공격 어댑터
 *
 * BossHazardAttackType <-> MotionNote <-> MotionNoteRenderItem 상호 변환을 담당한다.
 *
 * - dual_slam -> interaction: 'jump', requirements: [{ part: 'bothFeet', zoneId: 10 }], profileId: 'boss_slam'
 * - alternating_stomp_left -> interaction: 'evade', requirements: [{ part: 'leftFoot', zoneId: 9 }], profileId: 'boss_slam'
 * - alternating_stomp_right -> interaction: 'evade', requirements: [{ part: 'rightFoot', zoneId: 11 }], profileId: 'boss_slam'
 * - sweep -> interaction: 'jump', requirements: [{ part: 'bothFeet', zoneId: 10 }], profileId: 'boss_slam'
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§4 데이터 모델, §9 MRN-11)
 * @see Issue #485 [MRN-11]
 */

import type {
  MotionNote,
  MotionNoteRenderItem,
  MotionInteractionType,
  PartRequirement,
} from '../../types/motion-note.js';
import type { MotionIntentType } from '../../types/motion-intent.js';
import type { BossHazardAttackType } from '../BossHazardController.js';

export type BossHazardType = BossHazardAttackType | 'sweep';

export interface BossHazardToMotionNoteOptions {
  id?: string;
  patternId?: string;
  beat?: number;
  source?: 'boss' | 'hazard';
  leadBeats?: number;
  profileId?: string;
  zoneId?: number;
  interaction?: MotionInteractionType;
}

export interface BossHazardRenderItemOptions {
  id?: string;
  profileId?: string;
  isResolved?: boolean;
  isEvaded?: boolean;
  timeToLanding?: number;
}

/**
 * 보스 패턴별 요구 신체 부위 및 피트니스 존 매핑
 * - dual_slam: 양발 전 레인 (Zone 10)
 * - alternating_stomp_left: 왼발 좌측 레인 (Zone 9)
 * - alternating_stomp_right: 오른발 우측 레인 (Zone 11)
 * - sweep: 양발 전 레인 (Zone 10)
 */
export function bossHazardToRequirements(
  pattern: BossHazardType | string,
): readonly PartRequirement[] {
  switch (pattern) {
    case 'dual_slam':
      return [{ part: 'bothFeet', zoneId: 10 }];
    case 'alternating_stomp_left':
      return [{ part: 'leftFoot', zoneId: 9 }];
    case 'alternating_stomp_right':
      return [{ part: 'rightFoot', zoneId: 11 }];
    case 'sweep':
      return [{ part: 'bothFeet', zoneId: 10 }];
    default:
      return [{ part: 'bothFeet', zoneId: 10 }];
  }
}

/**
 * 보스 패턴별 인터랙션 유형 매핑
 * - dual_slam / sweep: 점프(jump) 회피
 * - alternating_stomp_left / right: 스텝(evade) 회피
 */
export function bossHazardToInteraction(
  pattern: BossHazardType | string,
): MotionInteractionType {
  switch (pattern) {
    case 'dual_slam':
    case 'sweep':
      return 'jump';
    case 'alternating_stomp_left':
    case 'alternating_stomp_right':
      return 'evade';
    default:
      return 'jump';
  }
}

/**
 * 보스 패턴별 대응되는 회피 모션 인텐트 반환
 */
export function getBossHazardExpectedIntent(
  pattern: BossHazardType | string,
): MotionIntentType {
  switch (pattern) {
    case 'dual_slam':
    case 'sweep':
      return 'jump';
    case 'alternating_stomp_left':
      return 'stepLeft';
    case 'alternating_stomp_right':
      return 'stepRight';
    default:
      return 'jump';
  }
}

/**
 * 인텐트가 해당 보스 공격 패턴의 유효한 회피 동작인지 검사
 */
export function isBossHazardEvadedByIntent(
  pattern: BossHazardType | string,
  intentType: MotionIntentType,
): boolean {
  return getBossHazardExpectedIntent(pattern) === intentType;
}

/**
 * 보스 공격 패턴을 통합 MotionNote로 변환
 */
export function bossHazardToMotionNote(
  pattern: BossHazardType | string,
  options?: BossHazardToMotionNoteOptions,
): MotionNote {
  const beat = options?.beat ?? 1;
  const id = options?.id ?? `boss_hazard_${pattern}_b${beat}`;
  const patternId = options?.patternId ?? pattern;
  const profileId = options?.profileId ?? 'boss_slam';
  const source = options?.source ?? 'boss';
  const interaction = options?.interaction ?? bossHazardToInteraction(pattern);
  const requirements = options?.zoneId !== undefined
    ? [{ part: bossHazardToRequirements(pattern)[0]?.part ?? 'bothFeet', zoneId: options.zoneId }]
    : bossHazardToRequirements(pattern);

  return {
    id,
    patternId,
    beat,
    requirements,
    interaction,
    profileId,
    source,
    leadBeats: options?.leadBeats,
  };
}

/**
 * 다중 보스 공격 패턴 배열을 연속된 비트 시퀀스의 MotionNote 배열로 일괄 변환
 */
export function bossHazardsToMotionNotes(
  patterns: readonly (BossHazardType | string)[],
  startBeat: number = 1,
  beatInterval: number = 2,
): MotionNote[] {
  return patterns.map((p, index) =>
    bossHazardToMotionNote(p, {
      beat: startBeat + index * beatInterval,
      id: `boss_hazard_${p}_seq${index + 1}`,
    }),
  );
}

/**
 * MotionNote로부터 원본 보스 공격 패턴 역해석
 */
export function motionNoteToBossHazard(
  note: MotionNote,
): BossHazardType | string | null {
  const knownPatterns: BossHazardType[] = [
    'dual_slam',
    'alternating_stomp_left',
    'alternating_stomp_right',
    'sweep',
  ];

  if (knownPatterns.includes(note.patternId as BossHazardType)) {
    return note.patternId as BossHazardType;
  }

  const primary = note.requirements[0];
  if (!primary) return null;

  if (primary.part === 'bothFeet' || primary.zoneId === 10) {
    return note.interaction === 'jump' ? 'dual_slam' : 'dual_slam';
  }
  if (primary.part === 'leftFoot' || primary.zoneId === 9) {
    return 'alternating_stomp_left';
  }
  if (primary.part === 'rightFoot' || primary.zoneId === 11) {
    return 'alternating_stomp_right';
  }

  return null;
}

/**
 * 보스 공격 패턴을 소실점 비행 렌더 아이템(MotionNoteRenderItem)으로 변환
 */
export function bossHazardToRenderItem(
  pattern: BossHazardType | string,
  progress: number,
  options?: BossHazardRenderItemOptions,
): MotionNoteRenderItem {
  const note = bossHazardToMotionNote(pattern, {
    id: options?.id,
    profileId: options?.profileId,
  });

  const clampedProgress = Math.max(0, Math.min(1.0, progress));

  // boss_slam 피드백: hitVfx: 'bossSlamHit', missVfx: 'bossSlamEvade'
  // 회피 성공 시: 'miss' (장판이 빗나감 -> bossSlamEvade VFX 유발)
  // 피격 시: 'hit' (장판에 맞음 -> bossSlamHit VFX 유발)
  let outcome: 'hit' | 'miss' | undefined;
  if (options?.isResolved) {
    outcome = options.isEvaded ? 'miss' : 'hit';
  }

  return {
    id: note.id,
    requirements: note.requirements,
    interaction: note.interaction,
    profileId: note.profileId ?? 'boss_slam',
    progress: clampedProgress,
    timeToLanding: options?.timeToLanding ?? 0,
    outcome,
  };
}
