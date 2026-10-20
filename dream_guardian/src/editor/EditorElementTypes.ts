/**
 * EditorElementTypes.ts - 에디터 요소(슬롯, 폼버퍼, 해저드) 관련 타입 정의
 */

import type { BodyCursorPart } from './PoseConstraintValidator.js';
import type { PhaseSequenceEditor, TimelineTrackNote } from './PhaseSequenceEditor.js';
import type { ProjectCommandManager } from './ProjectCommands.js';
import type { EditorProject } from '../data/EditorProject.js';
import type { CatChoreoPattern } from '../data/danceRoutineData.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { PhaseBPublishableAttack, PhaseBRequiredAction } from '../data/ContentCapabilities.js';

export type PhaseType =
  | 'RUN_QUESTION'
  | 'ANSWER_SELECT'
  | 'STAR_COLLECT'
  | 'FEVER_PHASE_B'
  | 'HAZARD_EVADE'
  | 'FEVER_NOTES'
  | 'BOSS_HAZARD';

export type ActiveEditTool = 'inspect' | 'leftHand' | 'rightHand' | 'head' | 'hip' | 'foot';

export interface PhaseBHazardAttackItem {
  id: string;
  attackType: PhaseBPublishableAttack;
  requiredAction: PhaseBRequiredAction;
  label?: string;
}

export interface PhaseBHazardValidationResult {
  valid: boolean;
  errors: string[];
  diagnosticCode?: string;
}

export interface PhaseBHazardLockedConfig {
  attackInterval: number;
  warningDuration: number;
  activeDuration: number;
  damage: number;
  enrageHpRatio: number;
  enrageSpeedMultiplier: number;
  minionCasualtyCount: number;
}

export interface PhaseAHazardScheduleDisplay {
  bpm: number;
  secondsPerBeat: number;
  damage: number;
  warningDuration: number;
  inputWindowEnd: number;
  judgmentTime: number;
  totalDuration: number;
  warningDurationBeats: number;
  inputWindowEndBeats: number;
  judgmentTimeBeats: number;
  totalDurationBeats: number;
}

export interface PhaseAHazardStep {
  beat: number;
  durationBeats: number;
  type: PhaseAHazardPattern;
  requiredAction: string;
  label: string;
  color: string;
}

export type StarSlotLockCode =
  | 'LOCKED_INPUT_CAPABILITY'
  | 'FIXED_SLOT_LANDING'
  | 'COUNT_LOCKED'
  | 'LOCKED_REWARD_MODIFICATION'
  | 'LOCKED_FREE_LANDING'
  | 'INVALID_ZONE';

export interface StarSlotValidationDiagnostic {
  code: StarSlotLockCode | string;
  message: string;
  path?: string;
  entityId?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface StarSlotValidationResult {
  valid: boolean;
  lockCode?: StarSlotLockCode;
  lockReason?: string;
  diagnostics: StarSlotValidationDiagnostic[];
}

export interface StarSlotItem {
  slotIndex: number;
  slotNumber: number;
  beat: number;
  tick: number;
  noteId: string;
  part: BodyCursorPart | 'foot';
  zoneId: number;
  patternId?: string;
  label?: string;
  color?: string;
  isStandard?: boolean;
  locked?: boolean;
  lockReasons?: string[];
}

export interface FormBufferEntry {
  slotIndex: number;
  part?: BodyCursorPart | 'foot';
  zoneId?: number;
  patternId?: string;
  rawInput?: Record<string, any>;
  errors?: string[];
  diagnostics?: Array<StarSlotValidationDiagnostic | FeverSlotValidationDiagnostic>;
  isDirty?: boolean;
}

export type FeverSlotLockCode =
  | 'LOCKED_INPUT_CAPABILITY'
  | 'FIXED_SLOT_LANDING'
  | 'CROSS_BODY_VIOLATION'
  | 'COUNT_LOCKED'
  | 'LOCKED_REWARD_MODIFICATION'
  | 'LOCKED_FREE_LANDING'
  | 'INVALID_ZONE';

export interface FeverSlotValidationDiagnostic {
  code: FeverSlotLockCode | string;
  message: string;
  path?: string;
  entityId?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface FeverSlotValidationResult {
  valid: boolean;
  lockCode?: FeverSlotLockCode;
  lockReason?: string;
  diagnostics: FeverSlotValidationDiagnostic[];
}

export interface FeverSlotItem {
  slotIndex: number;
  slotNumber: number;
  beat: number;
  tick: number;
  noteId: string;
  part: BodyCursorPart | 'foot';
  zoneId: number;
  foot?: 'leftFoot' | 'rightFoot' | 'centerFoot';
  patternId?: string;
  label?: string;
  color?: string;
  isStandard?: boolean;
}

export interface FeverPreviewResult {
  targetPhase: 'FEVER_1' | 'FEVER_2';
  changed: boolean;
  diffCount: number;
  currentNotes: TimelineTrackNote[];
  previewNotes: TimelineTrackNote[];
}

export interface PatternApplicationDiff {
  targetPhase: PhaseType;
  changed: boolean;
  diffCount: number;
  currentNotes: TimelineTrackNote[];
  previewNotes: TimelineTrackNote[];
}

export interface EditorElementHost {
  getSequenceEditor(): PhaseSequenceEditor;
  getCommandManager?(): ProjectCommandManager;
  hasCommandManager?: boolean | (() => boolean);
  toEditorProject(): EditorProject;
  notifyDocumentChange(): void;
  notifyStateChange(): void;
  getTimelineTotalBeats(phase: PhaseType): number;
  getDancePattern?(patternId: string): CatChoreoPattern | undefined;
  getBpm?(): number;
  getSelectedPatternId?(): string;
  getSelectedPhase?(): PhaseType;
}
