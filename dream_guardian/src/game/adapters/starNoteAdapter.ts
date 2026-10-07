/**
 * starNoteAdapter.ts - 별 노트 어댑터 (Keynote/StarTarget <-> MotionNote <-> RenderItem)
 *
 * 기존 별모으기(StarTarget/Keynote) 및 보스 피버(DEFAULT_FEVER_PATTERNS) 데이터를
 * 손실 없이 차세대 MotionNote 및 MotionNoteRenderItem으로 상호 변환한다.
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§4 데이터 모델, §9 MRN-06)
 * @see Issue #480 [MRN-06]
 */

import type { Keynote, KeynoteInstrument, KeynotePart } from '../../types/keynote.js';
import type { StarTarget } from '../../types/star.js';
import type { CursorType } from '../../../config/cursor.config.js';
import type { BodyPart } from '../../types/posture.js';
import {
  isFloorPart,
  type MotionNote,
  type MotionNoteRuntime,
  type MotionNoteRenderItem,
  type MotionPart,
} from '../../types/motion-note.js';
import { resolveProfile } from '../../../config/motion-note-profile.config.js';

export interface KeynoteToMotionNoteOptions {
  id?: string;
  source?: 'star' | 'fever';
  leadBeats?: number;
  profileId?: string;
}

export interface StarTargetToMotionNoteOptions {
  id?: string;
  source?: 'star' | 'fever';
  leadBeats?: number;
  profileId?: string;
}

export interface CreateMotionNoteRuntimeOptions {
  spb: number;
  sequenceStart?: number;
  landingTime?: number;
  leadBeats?: number;
}

export interface StarTargetRenderContext {
  now: number;
  spb: number;
  leadBeats?: number;
  sequenceStart?: number;
  profileId?: string;
}

/**
 * 요구 부위(MotionPart)로부터 KeynoteInstrument ('hand' | 'foot')를 유도한다.
 * 골반(hip) 및 모든 바닥/발 부위(leftFoot, rightFoot 등)는 'foot'으로 역유도된다.
 */
export function deriveInstrument(part: MotionPart): KeynoteInstrument {
  if (part === 'hip' || isFloorPart(part)) {
    return 'foot';
  }
  return 'hand';
}

/**
 * Keynote 단일 레코드를 통합 MotionNote로 변환한다.
 */
export function keynoteToMotionNote(
  keynote: Keynote,
  options?: KeynoteToMotionNoteOptions,
): MotionNote {
  const id = options?.id ?? `${keynote.patternId}_b${keynote.beat}`;
  const source = options?.source ?? 'star';

  return {
    id,
    patternId: keynote.patternId,
    beat: keynote.beat,
    requirements: [{ part: keynote.part, zoneId: keynote.zoneId }],
    interaction: 'tap',
    source,
    ...(options?.leadBeats !== undefined ? { leadBeats: options.leadBeats } : {}),
    ...(options?.profileId !== undefined ? { profileId: options.profileId } : {}),
  };
}

/**
 * Keynote 배열을 MotionNote 배열로 일괄 변환한다.
 */
export function keynotesToMotionNotes(
  keynotes: readonly Keynote[],
  options?: KeynoteToMotionNoteOptions,
): MotionNote[] {
  return keynotes.map((kn) => keynoteToMotionNote(kn, options));
}

/**
 * MotionNote를 기존 Keynote 모델로 역변환한다. (손실 없는 왕복 보장)
 */
export function motionNoteToKeynote(note: MotionNote): Keynote {
  const primaryReq = note.requirements[0];
  const part = (primaryReq?.part ?? 'leftHand') as KeynotePart;
  const zoneId = primaryReq?.zoneId ?? 1;

  return {
    patternId: note.patternId,
    beat: note.beat,
    part,
    zoneId,
    instrument: deriveInstrument(part),
  };
}

/**
 * StarTarget (또는 ActiveStarTarget)을 MotionNote로 변환한다.
 * beatIndex를 일관된 beat로 매핑한다.
 */
export function starTargetToMotionNote(
  target: StarTarget,
  options?: StarTargetToMotionNoteOptions,
): MotionNote {
  const id = options?.id ?? `${target.patternId}_b${target.beatIndex}`;
  const source = options?.source ?? 'star';

  return {
    id,
    patternId: target.patternId,
    beat: target.beatIndex,
    requirements: [{ part: target.part, zoneId: target.zoneId }],
    interaction: 'tap',
    source,
    ...(options?.leadBeats !== undefined ? { leadBeats: options.leadBeats } : {}),
    ...(options?.profileId !== undefined ? { profileId: options.profileId } : {}),
  };
}

/**
 * StarTarget 배열을 MotionNote 배열로 일괄 변환한다.
 */
export function starTargetsToMotionNotes(
  targets: readonly StarTarget[],
  options?: StarTargetToMotionNoteOptions,
): MotionNote[] {
  return targets.map((t) => starTargetToMotionNote(t, options));
}

/**
 * MotionNote를 기존 StarTarget 모델로 역변환한다. (왕복 보장)
 */
export function motionNoteToStarTarget(
  note: MotionNote,
  options?: { landingTime?: number; cursorType?: CursorType },
): StarTarget {
  const primaryReq = note.requirements[0];
  const part = (primaryReq?.part ?? 'leftHand') as BodyPart;
  const zoneId = primaryReq?.zoneId ?? 1;
  const cursorType = options?.cursorType ?? (part as CursorType);

  return {
    patternId: note.patternId,
    beatIndex: note.beat,
    part,
    zoneId,
    ...(cursorType !== undefined ? { cursorType } : {}),
    ...(options?.landingTime !== undefined ? { landingTime: options.landingTime } : {}),
  };
}

/**
 * MotionNote 및 시퀀스 시간 정보로부터 런타임 상태 객체를 생성한다.
 */
export function createMotionNoteRuntime(
  note: MotionNote,
  options: CreateMotionNoteRuntimeOptions,
): MotionNoteRuntime {
  const leadBeats = options.leadBeats ?? note.leadBeats ?? 4;
  const landingTime =
    options.landingTime ??
    (options.sequenceStart ?? 0) + (note.beat - 1) * options.spb;
  const displayStart = landingTime - leadBeats * options.spb;

  return {
    note,
    landingTime,
    displayStart,
    state: 'pending',
  };
}

/**
 * MotionNoteRuntime과 현재 시각(now)으로부터 렌더러 입력용 MotionNoteRenderItem 스냅샷을 생성한다.
 */
export function toRenderItem(
  runtime: MotionNoteRuntime,
  now: number,
  options?: { profileId?: string },
): MotionNoteRenderItem {
  const note = runtime.note;
  const profileId =
    options?.profileId ??
    note.profileId ??
    resolveProfile(note).profileId;

  const duration = runtime.landingTime - runtime.displayStart;
  const progress = duration > 0 ? (now - runtime.displayStart) / duration : 1.0;
  const timeToLanding = runtime.landingTime - now;

  let outcome: 'hit' | 'miss' | undefined;
  if (runtime.result) {
    outcome = runtime.result.success ? 'hit' : 'miss';
  }

  return {
    id: note.id,
    requirements: note.requirements,
    interaction: note.interaction,
    profileId,
    progress,
    timeToLanding,
    ...(runtime.holdProgress !== undefined ? { holdProgress: runtime.holdProgress } : {}),
    ...(outcome !== undefined ? { outcome } : {}),
  };
}

/**
 * StarTarget 또는 ActiveStarTarget으로부터 MotionNoteRenderItem 스냅샷을 직접 생성하는 편의 함수.
 */
export function starTargetToRenderItem(
  target: StarTarget,
  context: StarTargetRenderContext,
): MotionNoteRenderItem {
  const note = starTargetToMotionNote(target, {
    leadBeats: context.leadBeats,
    profileId: context.profileId,
  });

  const runtime = createMotionNoteRuntime(note, {
    spb: context.spb,
    sequenceStart: context.sequenceStart,
    landingTime: target.landingTime,
    leadBeats: context.leadBeats,
  });

  return toRenderItem(runtime, context.now, { profileId: context.profileId });
}
