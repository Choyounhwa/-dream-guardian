/**
 * hazardAdapter.ts - Phase A 위험 회피(Hazard) 어댑터
 *
 * PhaseAHazardPattern <-> MotionNote <-> MotionNoteRenderItem 변환을 담당한다.
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§4 데이터 모델, §9 MRN-10)
 * @see Issue #484 [MRN-10]
 */

import type { PhaseAHazardPattern } from '../../../config/phase-a-hazard.config.js';
import type {
  MotionNote,
  MotionNoteRenderItem,
  PartRequirement,
} from '../../types/motion-note.js';
import type { MotionIntentType } from '../../types/motion-intent.js';

export interface HazardToMotionNoteOptions {
  id?: string;
  patternId?: string;
  beat?: number;
  source?: 'hazard';
  leadBeats?: number;
  profileId?: string;
  zoneId?: number;
}

export interface HazardRenderItemOptions {
  id?: string;
  profileId?: string;
  isResolved?: boolean;
  isEvaded?: boolean;
  timeToLanding?: number;
}

/**
 * Phase A 회피 패턴별 위험 부위 및 피트니스 존 요구사항 매핑
 * - jump: 전 레인/양발 (Zone 10)
 * - left_step: 좌측 레인/왼발 (Zone 9)
 * - right_step: 우측 레인/오른발 (Zone 11)
 * - balance_left: 우측 레인이 위험 (Zone 11)
 * - balance_right: 좌측 레인이 위험 (Zone 9)
 */
export function hazardPatternToRequirements(
  pattern: PhaseAHazardPattern,
): readonly PartRequirement[] {
  switch (pattern) {
    case 'jump':
      return [{ part: 'bothFeet', zoneId: 10 }];
    case 'left_step':
      return [{ part: 'leftFoot', zoneId: 9 }];
    case 'right_step':
      return [{ part: 'rightFoot', zoneId: 11 }];
    case 'balance_left':
      return [{ part: 'rightFoot', zoneId: 11 }];
    case 'balance_right':
      return [{ part: 'leftFoot', zoneId: 9 }];
    default:
      return [{ part: 'bothFeet', zoneId: 10 }];
  }
}

/**
 * 회피 패턴별 대응되는 회피 모션 인텐트 반환
 */
export function getHazardExpectedIntent(
  pattern: PhaseAHazardPattern,
): MotionIntentType {
  switch (pattern) {
    case 'jump':
      return 'jump';
    case 'left_step':
    case 'balance_left':
      return 'stepLeft';
    case 'right_step':
    case 'balance_right':
      return 'stepRight';
    default:
      return 'jump';
  }
}

/**
 * 인텐트가 해당 패턴의 유효한 회피 동작인지 검사
 */
export function isHazardEvadedByIntent(
  pattern: PhaseAHazardPattern,
  intentType: MotionIntentType,
): boolean {
  return getHazardExpectedIntent(pattern) === intentType;
}

/**
 * PhaseAHazardPattern을 통합 MotionNote로 변환
 */
export function hazardPatternToMotionNote(
  pattern: PhaseAHazardPattern,
  options?: HazardToMotionNoteOptions,
): MotionNote {
  const beat = options?.beat ?? 1;
  const id = options?.id ?? `hazard_${pattern}_b${beat}`;
  const patternId = options?.patternId ?? pattern;
  const profileId = options?.profileId ?? 'hazard_floor';
  const source = options?.source ?? 'hazard';
  const requirements = options?.zoneId !== undefined
    ? [{ part: hazardPatternToRequirements(pattern)[0]?.part ?? 'bothFeet', zoneId: options.zoneId }]
    : hazardPatternToRequirements(pattern);

  return {
    id,
    patternId,
    beat,
    requirements,
    interaction: 'evade',
    source,
    profileId,
    ...(options?.leadBeats !== undefined ? { leadBeats: options.leadBeats } : {}),
  };
}

/**
 * PhaseAHazardPattern 목록을 MotionNote 배열로 일괄 변환
 */
export function hazardPatternsToMotionNotes(
  patterns: readonly PhaseAHazardPattern[],
  options?: Omit<HazardToMotionNoteOptions, 'beat'>,
): MotionNote[] {
  return patterns.map((pat, index) =>
    hazardPatternToMotionNote(pat, {
      ...options,
      beat: index + 1,
      id: options?.id ? `${options.id}_${index + 1}` : undefined,
    }),
  );
}

/**
 * MotionNote로부터 PhaseAHazardPattern 역변환
 */
export function motionNoteToHazardPattern(
  note: MotionNote,
): PhaseAHazardPattern | null {
  const knownPatterns: readonly PhaseAHazardPattern[] = [
    'jump',
    'left_step',
    'right_step',
    'balance_left',
    'balance_right',
  ];

  if (knownPatterns.includes(note.patternId as PhaseAHazardPattern)) {
    return note.patternId as PhaseAHazardPattern;
  }

  const primary = note.requirements[0];
  if (!primary) return null;

  if (primary.part === 'bothFeet' || primary.zoneId === 10) return 'jump';
  if (primary.part === 'leftFoot' || primary.zoneId === 9) return 'left_step';
  if (primary.part === 'rightFoot' || primary.zoneId === 11) return 'right_step';

  return null;
}

/**
 * PhaseAHazardPattern을 소실점 비행 렌더 아이템(MotionNoteRenderItem)으로 변환
 */
export function hazardPatternToRenderItem(
  pattern: PhaseAHazardPattern,
  beatProgress: number,
  options?: HazardRenderItemOptions,
): MotionNoteRenderItem {
  const note = hazardPatternToMotionNote(pattern, {
    id: options?.id,
    profileId: options?.profileId,
  });

  const progress = Math.max(0, Math.min(1.0, beatProgress));

  // hazard_floor 피드백: hitVfx: 'hazardHit', missVfx: 'hazardEvade'
  // 회피 성공 시: 'miss' (장판이 빗나감 -> hazardEvade VFX 유발)
  // 피격 시: 'hit' (장판에 맞음 -> hazardHit VFX 유발)
  let outcome: 'hit' | 'miss' | undefined;
  if (options?.isResolved) {
    outcome = options.isEvaded ? 'miss' : 'hit';
  }

  return {
    id: note.id,
    requirements: note.requirements,
    interaction: 'evade',
    profileId: note.profileId ?? 'hazard_floor',
    progress,
    timeToLanding: options?.timeToLanding ?? 0,
    outcome,
  };
}
