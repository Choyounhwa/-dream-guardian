/**
 * SessionContent.ts - 게임 런타임 세션 전용 불변 스테이지 콘텐츠 스냅샷 및 실행 ID 모델
 *
 * Issue #388 / CONTENT-SESSION:
 * - 책임 레이어: Game (src/game/)
 * - editor 모듈 절대 import 금지 (src/data/ 등 공용 타입만 참조)
 * - 10문제(Phase A) 및 Phase B 동안 contentHash/rulesetId/rulesetHash/활성 BPM 고정
 * - 깊은 불변(deepFreeze & 방어적 복사본)으로 게임 플레이 중 외부 발행/롤백 무영향 보장
 * - round / loop 별 충돌 없는 고유 실행 ID 생성 (roundExecutionId, loopExecutionId)
 * - 동일 seed/stageId/hash에 대한 결정론적(Deterministic) 실행 보장
 */

import type {
  CompiledFeverNote,
  CompiledMotionCue,
  CompiledPhaseAHazard,
  CompiledPhaseBHazard,
  CompiledStarNote,
} from '../data/PublishedContentPack.js';
import type { Keynote, KeynotePart, KeynoteInstrument } from '../types/keynote.js';
import type { BossHazardAttackType } from './BossHazardController.js';
import {
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';

export const DEFAULT_BOSS_HAZARD_PATTERNS: readonly BossHazardAttackType[] = Object.freeze([
  'dual_slam',
  'alternating_stomp_left',
  'alternating_stomp_right',
]);

const PATTERN_1: readonly Keynote[] = Object.freeze([
  { beat: 1, patternId: 'FEVER_1_1', part: 'leftHand', zoneId: 1, instrument: 'hand' },
  { beat: 2, patternId: 'FEVER_1_2', part: 'rightHand', zoneId: 3, instrument: 'hand' },
  { beat: 3, patternId: 'FEVER_1_3', part: 'leftHand', zoneId: 4, instrument: 'hand' },
  { beat: 4, patternId: 'FEVER_1_4', part: 'rightHand', zoneId: 5, instrument: 'hand' },
  { beat: 5, patternId: 'FEVER_1_5', part: 'hip', zoneId: 9, instrument: 'foot' },
  { beat: 6, patternId: 'FEVER_1_6', part: 'hip', zoneId: 11, instrument: 'foot' },
  { beat: 7, patternId: 'FEVER_1_7', part: 'rightHand', zoneId: 2, instrument: 'hand' },
  { beat: 8, patternId: 'FEVER_1_8', part: 'hip', zoneId: 10, instrument: 'foot' },
]);

const PATTERN_2: readonly Keynote[] = Object.freeze([
  { beat: 1, patternId: 'FEVER_2_1', part: 'rightHand', zoneId: 3, instrument: 'hand' },
  { beat: 2, patternId: 'FEVER_2_2', part: 'leftHand', zoneId: 1, instrument: 'hand' },
  { beat: 3, patternId: 'FEVER_2_3', part: 'rightHand', zoneId: 5, instrument: 'hand' },
  { beat: 4, patternId: 'FEVER_2_4', part: 'leftHand', zoneId: 4, instrument: 'hand' },
  { beat: 5, patternId: 'FEVER_2_5', part: 'hip', zoneId: 11, instrument: 'foot' },
  { beat: 6, patternId: 'FEVER_2_6', part: 'hip', zoneId: 9, instrument: 'foot' },
  { beat: 7, patternId: 'FEVER_2_7', part: 'leftHand', zoneId: 2, instrument: 'hand' },
  { beat: 8, patternId: 'FEVER_2_8', part: 'hip', zoneId: 10, instrument: 'foot' },
]);

/** 기본 피버 시퀀스 프리셋 */
export const DEFAULT_SESSION_FEVER_PATTERNS: readonly (readonly Keynote[])[] = Object.freeze([
  PATTERN_1,
  PATTERN_2,
]);

export type SessionPhaseRole = 'STAR_COLLECT' | 'BOSS_HAZARD' | 'MOTION_GUIDE';

export interface SessionRoleBinding {
  readonly chapterId: string;
  readonly subLevelId: string;
  readonly phase: 'phaseA' | 'phaseB';
  readonly role: SessionPhaseRole;
  readonly targetId: string;
}

export interface SessionPhaseAContent {
  readonly starNotes: readonly CompiledStarNote[];
  readonly hazard: CompiledPhaseAHazard | null;
  readonly motionGuide: readonly CompiledMotionCue[];
}

export interface SessionPhaseBContent {
  readonly feverNotes: readonly CompiledFeverNote[];
  readonly hazards: readonly CompiledPhaseBHazard[];
  readonly motionGuide: readonly CompiledMotionCue[];
}

export interface SessionStageBundle {
  readonly stageId: string;
  readonly sourcePackHash: string;
  readonly contentHash: string;
  readonly rulesetId: string;
  readonly rulesetHash: string;
  readonly runtimeContractVersion: string;
  readonly bpm: number;
  readonly secondsPerBeat: number;
  readonly beatsPerBar: number;
  readonly isBuiltin: boolean;
  readonly isFallback: boolean;
  readonly fallbackReason?: string;
  readonly builtinProfileId?: string | null;
  readonly executionId: string;
  readonly seed: number;

  readonly phaseA: SessionPhaseAContent;
  readonly phaseB: SessionPhaseBContent;
  readonly bindings: readonly SessionRoleBinding[];

  // Phase A Hazard Pattern resolution helper
  getPhaseAHazardPattern(roundIndex?: number): PhaseAHazardPattern;

  // Phase B Fever Keynotes generation helper
  getPhaseBFeverKeynotes(loopIndex: number): readonly Keynote[];

  // Phase B Hazard Patterns resolution helper
  getPhaseBHazardPatterns(): readonly BossHazardAttackType[];

  // Execution ID generation methods
  getRoundExecutionId(roundNumber: number): string;
  getRoundNoteExecutionId(roundNumber: number, slotIndex: number): string;
  getPhaseBLoopExecutionId(loopIndex: number): string;
  getPhaseBNoteExecutionId(loopIndex: number, noteIndex: number): string;
  getPhaseBHazardExecutionId(loopIndex: number, attackIndex: number): string;
}

export interface CreateSessionStageParams {
  stageId: string;
  sourcePackHash: string;
  rulesetId: string;
  rulesetHash: string;
  runtimeContractVersion: string;
  bpm: number;
  beatsPerBar?: number;
  isBuiltin: boolean;
  isFallback: boolean;
  fallbackReason?: string;
  builtinProfileId?: string | null;
  seed: number;
  phaseA?: {
    starNotes?: readonly CompiledStarNote[];
    hazard?: CompiledPhaseAHazard | null;
    motionGuide?: readonly CompiledMotionCue[];
  } | null;
  phaseB?: {
    feverNotes?: readonly CompiledFeverNote[];
    hazards?: readonly CompiledPhaseBHazard[];
    motionGuide?: readonly CompiledMotionCue[];
  } | null;
  bindings?: readonly SessionRoleBinding[];
}

/**
 * 객체 및 내부 중첩 속성을 재귀적으로 Object.freeze하는 순수 불변화 유틸리티
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }

  return obj;
}

/**
 * 외부 객체와 완전히 단절된 방어적 깊은 복사본(Deep Clone)을 생성합니다.
 */
function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    copy[key] = cloneValue((value as Record<string, unknown>)[key]);
  }
  return copy as T;
}

/**
 * 세션 번들의 Phase A 장판 패턴을 해석하여 반환합니다.
 * - 커스텀 팩(!isBuiltin)에 유효한 활성 장판(left_step, right_step, jump)이 정의된 경우 해당 패턴 반환
 * - builtin 팩이거나 비활성/유효하지 않은 패턴인 경우 seed 결정적 패턴 또는 기본 활성 패턴 반환
 * - 비활성 패턴(balance_left, balance_right 등)은 원천 차단되고 활성 3종만 반환됨
 */
export function resolvePhaseAHazardPattern(
  bundle: Pick<SessionStageBundle, 'isBuiltin' | 'seed' | 'phaseA'>,
  roundIndex?: number,
): PhaseAHazardPattern {
  if (!bundle.isBuiltin && bundle.phaseA?.hazard) {
    const rawPattern = bundle.phaseA.hazard.requiredAction ?? bundle.phaseA.hazard.hazardType;
    if (rawPattern && (PHASE_A_ACTIVE_HAZARD_PATTERNS as readonly string[]).includes(rawPattern)) {
      return rawPattern as PhaseAHazardPattern;
    }
  }

  const pool = PHASE_A_ACTIVE_HAZARD_PATTERNS;
  const seed = Number.isFinite(bundle.seed) ? Math.floor(Math.abs(bundle.seed)) : 0;
  const offset =
    roundIndex !== undefined && Number.isFinite(roundIndex)
      ? Math.floor(Math.abs(roundIndex - 1))
      : 0;
  const idx = (seed + offset) % pool.length;
  return pool[idx];
}

export const getPhaseAHazardPattern = resolvePhaseAHazardPattern;

const VALID_PHASE_B_ATTACKS: readonly BossHazardAttackType[] = Object.freeze([
  'dual_slam',
  'alternating_stomp_left',
  'alternating_stomp_right',
]);

const PHASE_B_VALID_ACTIONS: Record<BossHazardAttackType, readonly string[]> = Object.freeze({
  dual_slam: ['jump'],
  alternating_stomp_left: ['left_step', 'step_left', 'leftFoot', '9'],
  alternating_stomp_right: ['right_step', 'step_right', 'rightFoot', '11'],
});

/**
 * 세션 번들의 Phase B 보스 장판 패턴 목록을 해석하여 반환합니다.
 * - 커스텀 팩(!isBuiltin)에 유효한 활성 장판 목록(dual_slam, alternating_stomp_left, alternating_stomp_right)이 정의된 경우 순서대로 반환
 * - builtin 팩이거나 비활성/비어있는 목록인 경우 DEFAULT_BOSS_HAZARD_PATTERNS로 fallback
 * - 공격 종류와 요구 입력의 모순을 거부
 */
export function resolvePhaseBHazardPatterns(
  bundle: Pick<SessionStageBundle, 'isBuiltin' | 'phaseB'>,
): readonly BossHazardAttackType[] {
  if (
    bundle.isBuiltin ||
    !bundle.phaseB ||
    !Array.isArray(bundle.phaseB.hazards) ||
    bundle.phaseB.hazards.length === 0
  ) {
    return DEFAULT_BOSS_HAZARD_PATTERNS;
  }

  const validPatterns: BossHazardAttackType[] = [];
  for (const hz of bundle.phaseB.hazards) {
    const attack = hz?.attackType as BossHazardAttackType;
    if (!VALID_PHASE_B_ATTACKS.includes(attack)) {
      continue;
    }
    if (hz.requiredAction) {
      const validActions = PHASE_B_VALID_ACTIONS[attack];
      if (!validActions || !validActions.includes(hz.requiredAction)) {
        continue;
      }
    }
    validPatterns.push(attack);
  }

  if (validPatterns.length === 0) {
    return DEFAULT_BOSS_HAZARD_PATTERNS;
  }

  return Object.freeze(validPatterns);
}

export const getPhaseBHazardPatterns = resolvePhaseBHazardPatterns;

/**
 * 결정론적이고 완전히 고정된 SessionStageBundle 스냅샷을 생성합니다.
 */
export function createSessionStageSnapshot(params: CreateSessionStageParams): SessionStageBundle {
  const bpm = params.bpm;
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = params.beatsPerBar ?? 4;
  const shortHash = params.sourcePackHash ? params.sourcePackHash.slice(0, 8) : 'builtin';
  const executionId = `exec_${params.stageId}_${shortHash}_s${params.seed}`;

  const phaseACloned: SessionPhaseAContent = {
    starNotes: cloneValue(params.phaseA?.starNotes ?? []),
    hazard: params.phaseA?.hazard ? cloneValue(params.phaseA.hazard) : null,
    motionGuide: cloneValue(params.phaseA?.motionGuide ?? []),
  };

  const phaseBCloned: SessionPhaseBContent = {
    feverNotes: cloneValue(params.phaseB?.feverNotes ?? []),
    hazards: cloneValue(params.phaseB?.hazards ?? []),
    motionGuide: cloneValue(params.phaseB?.motionGuide ?? []),
  };

  const bindingsCloned = cloneValue(params.bindings ?? []);

  const bundle: SessionStageBundle = {
    stageId: params.stageId,
    sourcePackHash: params.sourcePackHash,
    contentHash: params.sourcePackHash,
    rulesetId: params.rulesetId,
    rulesetHash: params.rulesetHash,
    runtimeContractVersion: params.runtimeContractVersion,
    bpm,
    secondsPerBeat,
    beatsPerBar,
    isBuiltin: params.isBuiltin,
    isFallback: params.isFallback,
    fallbackReason: params.fallbackReason,
    builtinProfileId: params.builtinProfileId ?? null,
    executionId,
    seed: params.seed,

    phaseA: phaseACloned,
    phaseB: phaseBCloned,
    bindings: bindingsCloned,

    getPhaseAHazardPattern(roundIndex?: number): PhaseAHazardPattern {
      return resolvePhaseAHazardPattern(this, roundIndex);
    },

    getPhaseBFeverKeynotes(loopIndex: number): readonly Keynote[] {
      const feverNotes = this.phaseB.feverNotes;
      const shouldUseCustom =
        !this.isBuiltin && Array.isArray(feverNotes) && feverNotes.length > 0;

      if (shouldUseCustom) {
        return feverNotes.map((note, noteIndex) => {
          const noteId = this.getPhaseBNoteExecutionId(loopIndex, noteIndex);
          const beat =
            note.landingTick > 0 ? note.landingTick / 480 : noteIndex + 1;
          const target = note.target;
          const isFoot = target.type === 'foot' || target.instrument === 'foot';
          const part: KeynotePart = isFoot
            ? 'hip'
            : target.part === 'rightHand'
              ? 'rightHand'
              : target.part === 'hip'
                ? 'hip'
                : 'leftHand';
          const instrument: KeynoteInstrument = isFoot
            ? 'foot'
            : (target.instrument ?? 'hand');

          return Object.freeze({
            patternId: noteId,
            id: noteId,
            beat,
            part,
            zoneId: target.zoneId,
            instrument,
          });
        });
      }

      // Fallback: 기본 패턴(DEFAULT_SESSION_FEVER_PATTERNS) 사용
      const patternIdx =
        Math.abs(loopIndex) % DEFAULT_SESSION_FEVER_PATTERNS.length;
      const basePattern = DEFAULT_SESSION_FEVER_PATTERNS[patternIdx];
      return basePattern.map((note, noteIndex) => {
        const noteId = this.getPhaseBNoteExecutionId(loopIndex, noteIndex);
        return Object.freeze({
          ...note,
          patternId: noteId,
          id: noteId,
        });
      });
    },

    getRoundExecutionId(roundNumber: number): string {
      return `${this.executionId}_r${roundNumber}`;
    },

    getRoundNoteExecutionId(roundNumber: number, slotIndex: number): string {
      return `${this.executionId}_r${roundNumber}_s${slotIndex}`;
    },

    getPhaseBLoopExecutionId(loopIndex: number): string {
      return `${this.executionId}_loop${loopIndex}`;
    },

    getPhaseBNoteExecutionId(loopIndex: number, noteIndex: number): string {
      return `${this.executionId}_loop${loopIndex}_n${noteIndex}`;
    },

    getPhaseBHazardExecutionId(loopIndex: number, attackIndex: number): string {
      return `${this.executionId}_loop${loopIndex}_h${attackIndex}`;
    },

    getPhaseBHazardPatterns(): readonly BossHazardAttackType[] {
      return resolvePhaseBHazardPatterns(this);
    },
  };

  return deepFreeze(bundle);
}

export const createSessionStageBundle = createSessionStageSnapshot;
