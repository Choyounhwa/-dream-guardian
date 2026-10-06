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
import {
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';

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

  // Execution ID generation methods
  getRoundExecutionId(roundNumber: number): string;
  getRoundNoteExecutionId(roundNumber: number, slotIndex: number): string;
  getPhaseBLoopExecutionId(loopIndex: number): string;
  getPhaseBNoteExecutionId(loopIndex: number, noteIndex: number): string;
  getPhaseBHazardExecutionId(loopIndex: number, hazardIndex: number): string;
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

    getPhaseBHazardExecutionId(loopIndex: number, hazardIndex: number): string {
      return `${this.executionId}_loop${loopIndex}_h${hazardIndex}`;
    },
  };

  return deepFreeze(bundle);
}
