/**
 * EditorHistoryManager.ts - 피트니스 안무 & 비트 타임라인 에디터 히스토리(Undo/Redo) 및 직렬화 전담 매니저
 */

import {
  DancePatternRegistry,
  EXTENDED_CAT_CHOREO_PATTERNS,
  type CatChoreoPattern,
} from '../data/danceRoutineData.js';
import type { BodyCursorPart } from './PoseConstraintValidator.js';
import {
  PhaseSequenceEditor,
  type TimelineTrackNote,
} from './PhaseSequenceEditor.js';
import {
  ProjectCommandManager,
  ReplaceProjectCommand,
  deepClone,
  type CommandExecutionResult,
} from './ProjectCommands.js';
import type {
  EditorProject,
  EditorPattern,
  EditorSequence,
  EditorBinding,
  StarNoteEvent,
  FeverNoteEvent,
  MotionCueEvent,
  PhaseAHazardEvent,
  PhaseBHazardEvent,
  EditorProjectMetadata,
} from '../data/EditorProject.js';
import {
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';
import {
  PHASE_B_PUBLISHABLE_ATTACKS,
  getRequiredActionForPhaseBAttack,
  type PhaseBPublishableAttack,
} from '../data/ContentCapabilities.js';

export type PhaseType =
  | 'RUN_QUESTION'
  | 'ANSWER_SELECT'
  | 'STAR_COLLECT'
  | 'FEVER_PHASE_B'
  | 'FEVER_NOTES'
  | 'HAZARD_EVADE'
  | 'BOSS_HAZARD';

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

export interface PhaseBHazardAttackItem {
  id: string;
  attackType: string;
  requiredAction?: string;
  label?: string;
  startTick?: number;
  durationTicks?: number;
}

export type StageCoverageStatusKind = 'bound' | 'builtin' | 'missing' | 'partial';

export interface StageCoverageItem {
  chapterId: string;
  status: StageCoverageStatusKind;
  isComplete: boolean;
  builtinProfile: string | null;
  boundPhases: string[];
  bindingCount: number;
}

export interface StageCoverageReport {
  isComplete: boolean;
  stages: StageCoverageItem[];
  boundStages: string[];
  builtinStages: string[];
  missingStages: string[];
  partialStages: string[];
}

export interface ProjectPublicationStatus {
  isDraft: boolean;
  savedRevision: number;
  currentRevision: number;
  isPublished: boolean;
  isClean: boolean;
}

export interface BindingValidationResult {
  valid: boolean;
  errors: string[];
  diagnosticCode?: string;
  compoundKey?: string;
}

export interface BossClimaxDiagnosisResult {
  chapterId: string;
  isComplete: boolean;
  hasFeverNotes: boolean;
  hasHazard: boolean;
  missingRoles: string[];
}

export interface EditorHistoryHost {
  currentProjectId: string;
  bpm: number;
  rulesetId: string;
  metadata: EditorProjectMetadata;
  revision: number;
  lastSavedRevision: number;
  isPublished: boolean;
  publishedRevision: number | null;
  starSequenceId: string;
  hazardSequenceId: string;
  hazardEventId: string;
  phaseAHazardPattern: PhaseAHazardPattern;
  feverSequenceId: string;
  feverSlots: FeverSlotItem[];
  phaseBHazardSequenceId: string;
  phaseBHazardAttacks: PhaseBHazardAttackItem[];
  phaseBHazardAttackCounter: number;
  bindings: EditorBinding[];
  customSequences: EditorSequence[];
  stageBuiltinProfiles: Record<string, string>;
  registry: DancePatternRegistry;
  sequenceEditor: PhaseSequenceEditor;
  selectedPatternId: string;
  selectedPhase: PhaseType;

  setCurrentProjectId(id: string): void;
  setRawBpm(bpm: number): void;
  setRulesetId(id: string): void;
  setMetadata(meta: EditorProjectMetadata): void;
  setRevision(rev: number): void;
  setLastSavedRevision(rev: number): void;
  setIsPublished(pub: boolean): void;
  setPublishedRevision(rev: number | null): void;
  setStarSequenceId(id: string): void;
  setHazardSequenceId(id: string): void;
  setHazardEventId(id: string): void;
  setRawPhaseAHazardPattern(pattern: PhaseAHazardPattern): void;
  setFeverSequenceId(id: string): void;
  setFeverSlots(slots: FeverSlotItem[]): void;
  setRawPhaseBHazardSequenceId(id: string): void;
  setRawPhaseBHazardAttacks(attacks: PhaseBHazardAttackItem[]): void;
  setPhaseBHazardAttackCounter(cnt: number): void;
  setRawBindings(bindings: EditorBinding[]): void;
  setCustomSequences(sequences: EditorSequence[]): void;
  setStageBuiltinProfiles(profiles: Record<string, string>): void;
  setSelectedPattern(id: string): void;
  setSelectedPhase(phase: PhaseType): void;
  setIsApplyingProject(applying: boolean): void;
  clearFormBuffers(): void;
  initDefaultFeverSlots(): void;
  initDefaultPhaseBHazardAttacks(): void;
  getFeverSlots(): FeverSlotItem[];
  getSelectedPattern(): CatChoreoPattern | null;
  notifyDocumentChange(): void;
  notifyStateChange(): void;
  notifyPatternChange(pat: CatChoreoPattern | null): void;
  notifyPhaseChange(phase: PhaseType): void;
}

export const DEFAULT_EDITOR_BINDINGS: EditorBinding[] = [
  { chapterId: 'ch1', subLevelId: 'star_collect', phase: 'phaseA', sequenceId: 'seq_phaseA_star', role: 'starNotes' },
  { chapterId: 'ch1', subLevelId: 'run_question', phase: 'phaseA', sequenceId: 'seq_phaseA_motion', role: 'motionGuide' },
  { chapterId: 'ch1', subLevelId: 'answer_select', phase: 'phaseA', sequenceId: 'seq_phaseA_answer', role: 'motionGuide' },
  { chapterId: 'ch1', subLevelId: 'fever_phase_b', phase: 'phaseB', sequenceId: 'seq_phaseB_motion', role: 'motionGuide' },
  { chapterId: 'ch1', subLevelId: 'fever_phase_b', phase: 'phaseB', sequenceId: 'seq_phaseB_fever', role: 'feverNotes' },
  { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_hazard', role: 'hazard' },
  { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_hazard', role: 'hazard' },
];

function parseMotionCueNote(ev: MotionCueEvent, idx: number, isAnswer: boolean, isFever: boolean): TimelineTrackNote {
  const startTick = ev.startTick ?? ev.tick ?? 0;
  const startBeat = Math.round(((startTick / 480) + 1) * 100) / 100;
  const durTicks = ev.durationTicks ?? ev.duration ?? 480;
  const durationBeats = Math.round((durTicks / 480) * 100) / 100;
  const targetZones: number[] = [];
  if (ev.target?.leftHand) targetZones.push(ev.target.leftHand);
  if (ev.target?.rightHand) targetZones.push(ev.target.rightHand);
  if (ev.target?.hip) targetZones.push(ev.target.hip);
  if (ev.target?.head) targetZones.push(ev.target.head);

  return {
    id: ev.id || `${isAnswer ? 'ans' : isFever ? 'mot_fever' : 'mot'}_evt_${idx + 1}`,
    lane: isAnswer ? 'answer' : 'motion',
    startBeat,
    durationBeats,
    label: isAnswer ? '답안 선택' : isFever ? '피버 모션' : '모션 가이드',
    color: isAnswer ? '#FFCB4D' : isFever ? '#C889FF' : '#28E6FF',
    targetZones,
    payload: { ...ev.target, patternId: ev.sourcePatternId },
  };
}

function mapMotionCueEvent(n: TimelineTrackNote, prefix: string, idx: number): MotionCueEvent {
  const startTick = Math.max(0, Math.round((n.startBeat - 1) * 480));
  const durationTicks = Math.max(480, Math.round((n.durationBeats || 1) * 480));
  return {
    id: (n.id && !n.id.startsWith('NOTE_F_')) ? n.id : `${prefix}_${idx + 1}`,
    startTick,
    durationTicks,
    target: {
      leftHand: n.payload?.leftHand ?? null,
      rightHand: n.payload?.rightHand ?? null,
      head: n.payload?.head ?? null,
      hip: n.payload?.hip ?? null,
    },
    sourcePatternId: n.payload?.patternId,
  };
}

export class EditorHistoryManager {
  private readonly _host: EditorHistoryHost;
  private _commandManager?: ProjectCommandManager;

  constructor(host: EditorHistoryHost, commandManager?: ProjectCommandManager) {
    this._host = host;
    if (commandManager) {
      this._commandManager = commandManager;
      this._commandManager.addListener((newProj) => {
        this.applyProject(newProj, { skipCommand: true });
        this._host.notifyDocumentChange();
        this._host.notifyStateChange();
      });
    }
  }

  get hasCommandManager(): boolean {
    return this._commandManager !== undefined;
  }

  get commandManager(): ProjectCommandManager {
    if (!this._commandManager) {
      this._commandManager = this.createDefaultCommandManager();
    }
    return this._commandManager;
  }

  createDefaultCommandManager(): ProjectCommandManager {
    const proj = this.toEditorProject();
    return new ProjectCommandManager(proj, {
      onDocumentChange: (newProj) => {
        this.applyProject(newProj, { skipCommand: true });
        this._host.notifyDocumentChange();
        this._host.notifyStateChange();
      },
    });
  }

  get revision(): number {
    return this.commandManager.revision;
  }

  canUndo(): boolean {
    return this.commandManager.canUndo();
  }

  canRedo(): boolean {
    return this.commandManager.canRedo();
  }

  undo(): CommandExecutionResult {
    return this.commandManager.undo();
  }

  redo(): CommandExecutionResult {
    return this.commandManager.redo();
  }

  getProjectPublicationStatus(): ProjectPublicationStatus {
    const currentRevision = this.commandManager.revision;
    const savedRevision = this._host.lastSavedRevision;
    const isClean = savedRevision === currentRevision;
    const isPublished =
      this._host.isPublished &&
      this._host.publishedRevision !== null &&
      this._host.publishedRevision >= currentRevision;
    return {
      isDraft: !isClean || !isPublished,
      savedRevision,
      currentRevision,
      isPublished,
      isClean,
    };
  }

  markSaved(revision?: number): void {
    this._host.setLastSavedRevision(revision ?? this.commandManager.revision);
  }

  markPublished(revision?: number): void {
    const rev = revision ?? this.commandManager.revision;
    this._host.setIsPublished(true);
    this._host.setPublishedRevision(rev);
  }

  markUnpublished(): void {
    this._host.setIsPublished(false);
    this._host.setPublishedRevision(null);
  }

  getBindings(): EditorBinding[] {
    return this._host.bindings.map((b) => ({ ...b }));
  }

  setBindings(bindings: EditorBinding[]): void {
    this._host.setRawBindings(bindings.map((b) => ({ ...b })));
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
  }

  getSequences(): EditorSequence[] {
    return this.toEditorProject().sequences;
  }

  addCustomSequence(seq: EditorSequence): void {
    const seqs = [...this._host.customSequences];
    const existingIdx = seqs.findIndex((s) => s.id === seq.id);
    if (existingIdx >= 0) {
      seqs[existingIdx] = deepClone(seq);
    } else {
      seqs.push(deepClone(seq));
    }
    this._host.setCustomSequences(seqs);
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
  }

  buildExportProject(): EditorProject {
    return this.toEditorProject();
  }

  validateBinding(binding: EditorBinding, options?: { excludeIndex?: number }): BindingValidationResult {
    if (!binding || typeof binding !== 'object') {
      return { valid: false, errors: ['Binding must be an object'], diagnosticCode: 'invalid-binding' };
    }
    if (typeof binding.chapterId !== 'string' || binding.chapterId.trim().length === 0) {
      return { valid: false, errors: ['chapterId must be a non-empty string'], diagnosticCode: 'invalid-binding-chapter' };
    }
    if (binding.subLevelId !== null && binding.subLevelId !== undefined && typeof binding.subLevelId !== 'string') {
      return { valid: false, errors: ['subLevelId must be a string or null'], diagnosticCode: 'invalid-binding-sublevel' };
    }
    if (binding.phase !== 'phaseA' && binding.phase !== 'phaseB') {
      return { valid: false, errors: ['phase must be "phaseA" or "phaseB"'], diagnosticCode: 'invalid-binding-phase' };
    }
    if (typeof binding.sequenceId !== 'string' || binding.sequenceId.trim().length === 0) {
      return { valid: false, errors: ['sequenceId must be a non-empty string'], diagnosticCode: 'invalid-binding-sequence-id' };
    }

    const allSequences = this.getSequences();
    const targetSeq = allSequences.find((s) => s.id === binding.sequenceId);
    if (!targetSeq) {
      return {
        valid: false,
        errors: [`Binding references unknown sequence "${binding.sequenceId}"`],
        diagnosticCode: 'broken-sequence-reference',
      };
    }
    if (targetSeq.phase !== binding.phase) {
      return {
        valid: false,
        errors: [
          `Sequence phase mismatch: sequence "${targetSeq.id}" is "${targetSeq.phase}" but binding specifies "${binding.phase}"`,
        ],
        diagnosticCode: 'phase-mismatch',
      };
    }
    if (binding.role && typeof binding.role === 'string' && binding.role.trim().length > 0) {
      if (binding.role !== targetSeq.kind) {
        return {
          valid: false,
          errors: [
            `Role mismatch: sequence kind is "${targetSeq.kind}" but binding specifies role "${binding.role}"`,
          ],
          diagnosticCode: 'role-mismatch',
        };
      }
    }

    const role =
      typeof binding.role === 'string' && binding.role.trim().length > 0
        ? binding.role
        : targetSeq.kind;
    const subLevel = binding.subLevelId ?? 'all';
    const compoundKey = `${binding.chapterId}::${subLevel}::${binding.phase}::${role}`;

    const bindings = this._host.bindings;
    for (let i = 0; i < bindings.length; i++) {
      if (options?.excludeIndex !== undefined && options.excludeIndex === i) {
        continue;
      }
      const existing = bindings[i];
      const existingSeq = allSequences.find((s) => s.id === existing.sequenceId);
      const existingRole =
        typeof existing.role === 'string' && existing.role.trim().length > 0
          ? existing.role
          : existingSeq?.kind || 'motionGuide';
      const existingSubLevel = existing.subLevelId ?? 'all';
      const existingKey = `${existing.chapterId}::${existingSubLevel}::${existing.phase}::${existingRole}`;

      if (existingKey === compoundKey) {
        return {
          valid: false,
          errors: [`Duplicate binding for compound key "${compoundKey}"`],
          diagnosticCode: 'duplicate-binding',
          compoundKey,
        };
      }
    }

    return { valid: true, errors: [], compoundKey };
  }

  addBinding(binding: EditorBinding): { success: boolean; error?: string; errors?: string[]; diagnosticCode?: string } {
    const result = this.validateBinding(binding);
    if (!result.valid) return { success: false, error: result.errors[0], errors: result.errors, diagnosticCode: result.diagnosticCode };

    this._host.setRawBindings([...this._host.bindings, {
      chapterId: binding.chapterId,
      subLevelId: binding.subLevelId ?? null,
      phase: binding.phase,
      sequenceId: binding.sequenceId,
      role: binding.role,
    }]);

    this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    return { success: true };
  }

  updateBinding(index: number, updated: EditorBinding): { success: boolean; error?: string; errors?: string[]; diagnosticCode?: string } {
    const bindings = this._host.bindings;
    if (index < 0 || index >= bindings.length) return { success: false, error: `Invalid binding index ${index}` };
    const result = this.validateBinding(updated, { excludeIndex: index });
    if (!result.valid) return { success: false, error: result.errors[0], errors: result.errors, diagnosticCode: result.diagnosticCode };

    const nextBindings = [...bindings];
    nextBindings[index] = {
      chapterId: updated.chapterId,
      subLevelId: updated.subLevelId ?? null,
      phase: updated.phase,
      sequenceId: updated.sequenceId,
      role: updated.role,
    };
    this._host.setRawBindings(nextBindings);

    this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    return { success: true };
  }

  removeBinding(target: number | string | Partial<EditorBinding>): boolean {
    const bindings = this._host.bindings;
    const allSequences = this.getSequences();
    let removeIndex = -1;
    if (typeof target === 'number') {
      removeIndex = target;
    } else if (typeof target === 'string') {
      removeIndex = bindings.findIndex((b) => b.sequenceId === target || allSequences.find((s) => s.id === b.sequenceId)?.id === target);
    } else if (typeof target === 'object' && target !== null) {
      removeIndex = bindings.findIndex((b) => {
        if (target.chapterId && b.chapterId !== target.chapterId) return false;
        if (target.subLevelId !== undefined && b.subLevelId !== target.subLevelId) return false;
        if (target.phase && b.phase !== target.phase) return false;
        if (target.sequenceId && b.sequenceId !== target.sequenceId) return false;
        if (target.role && b.role !== target.role) return false;
        return true;
      });
    }

    if (removeIndex >= 0 && removeIndex < bindings.length) {
      this._host.setRawBindings(bindings.filter((_, idx) => idx !== removeIndex));
      this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
      return true;
    }
    return false;
  }

  getStageBuiltinProfiles(): Record<string, string> {
    return { ...this._host.stageBuiltinProfiles };
  }

  setStageBuiltinProfile(chapterId: string, profileId: string | null): void {
    const profiles = { ...this._host.stageBuiltinProfiles };
    if (!profileId?.trim()) {
      delete profiles[chapterId];
    } else {
      profiles[chapterId] = profileId.trim();
    }
    this._host.setStageBuiltinProfiles(profiles);
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
  }

  diagnoseBossClimaxBindings(chapterId: string): BossClimaxDiagnosisResult {
    const stageBindings = this._host.bindings.filter(
      (b) => b.chapterId === chapterId && b.phase === 'phaseB' &&
        (b.subLevelId === 'boss_climax' || b.subLevelId === null || b.subLevelId === 'fever_phase_b')
    );
    const hasFeverNotes = stageBindings.some((b) => b.role === 'feverNotes');
    const hasHazard = stageBindings.some((b) => b.role === 'hazard');
    const missingRoles: string[] = [];
    if (!hasFeverNotes) missingRoles.push('feverNotes');
    if (!hasHazard) missingRoles.push('hazard');

    return { chapterId, isComplete: hasFeverNotes && hasHazard, hasFeverNotes, hasHazard, missingRoles };
  }

  getStageCoverageReport(requiredStages: string[] = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']): StageCoverageReport {
    return this.getStageCoverageStatus(requiredStages);
  }

  getStageCoverageStatus(requiredStages: string[] = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']): StageCoverageReport {
    const stages: StageCoverageItem[] = [];
    const boundStages: string[] = [];
    const builtinStages: string[] = [];
    const missingStages: string[] = [];
    const partialStages: string[] = [];

    for (const ch of requiredStages) {
      const stageBindings = this._host.bindings.filter((b) => b.chapterId === ch);
      const builtinProfile = this._host.stageBuiltinProfiles[ch] ?? null;
      const hasBuiltin = typeof builtinProfile === 'string' && builtinProfile.trim().length > 0;
      const boundPhases = Array.from(new Set(stageBindings.map((b) => b.phase)));
      const hasPhaseA = boundPhases.includes('phaseA');
      const hasPhaseB = boundPhases.includes('phaseB');

      let status: StageCoverageStatusKind;
      let isComplete = false;

      if (stageBindings.length > 0) {
        if (hasPhaseA && hasPhaseB) {
          status = 'bound';
          isComplete = true;
          boundStages.push(ch);
        } else if (hasBuiltin) {
          status = 'builtin';
          isComplete = true;
          builtinStages.push(ch);
        } else {
          status = 'partial';
          partialStages.push(ch);
        }
      } else if (hasBuiltin) {
        status = 'builtin';
        isComplete = true;
        builtinStages.push(ch);
      } else {
        status = 'missing';
        missingStages.push(ch);
      }

      stages.push({ chapterId: ch, status, isComplete, builtinProfile, boundPhases, bindingCount: stageBindings.length });
    }

    return {
      isComplete: stages.every((s) => s.isComplete),
      stages,
      boundStages,
      builtinStages,
      missingStages,
      partialStages,
    };
  }

  toEditorProject(): EditorProject {
    const host = this._host;
    const starNotes = host.sequenceEditor.getNotesForPhase('STAR_COLLECT');
    const runNotes = host.sequenceEditor.getNotesForPhase('RUN_QUESTION');
    const ansNotes = host.sequenceEditor.getNotesForPhase('ANSWER_SELECT');
    const feverNotes = host.sequenceEditor.getNotesForPhase('FEVER_PHASE_B');

    const patterns: EditorPattern[] = host.registry.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      target: { leftHand: p.leftHand ?? null, rightHand: p.rightHand ?? null, head: p.head ?? null, hip: p.hip ?? null },
      description: p.description,
    }));

    const starEvents: StarNoteEvent[] = starNotes.map((n, idx) => {
      const landingTick = Math.max(0, Math.round((n.startBeat - 1) * 480));
      const rawPart = n.payload?.part;
      const isFoot = rawPart === 'foot' || n.payload?.targetType === 'foot' || (rawPart === 'hip' && n.targetZones[0] !== undefined && n.targetZones[0] >= 9);
      const cursorPart: BodyCursorPart = rawPart === 'leftHand' || rawPart === 'rightHand' || rawPart === 'head' || rawPart === 'hip' ? rawPart : n.targetZones[0] >= 6 ? 'hip' : 'leftHand';
      const zoneId = n.targetZones[0] ?? 4;
      const footKind = zoneId === 9 ? 'leftFoot' : zoneId === 11 ? 'rightFoot' : 'centerFoot';
      const footZone = (zoneId >= 9 && zoneId <= 11 ? zoneId : 10) as 9 | 10 | 11;

      return {
        id: n.id || `star_evt_${idx + 1}`,
        landingTick,
        target: isFoot ? { type: 'foot' as const, foot: footKind, zoneId: footZone } : { type: 'cursor' as const, part: cursorPart, zoneId },
        sourcePatternId: n.payload?.patternId,
      };
    });

    const runEvents: MotionCueEvent[] = runNotes.map((n, idx) => {
      const startTick = Math.max(0, Math.round((n.startBeat - 1) * 480));
      const durationTicks = Math.max(480, Math.round((n.durationBeats || 1) * 480));
      return {
        id: n.id || `mot_run_${idx + 1}`,
        startTick,
        durationTicks,
        target: {
          leftHand: n.payload?.leftHand ?? (n.targetZones[0] <= 5 ? n.targetZones[0] : null),
          rightHand: n.payload?.rightHand ?? null,
          head: n.payload?.head ?? null,
          hip: n.payload?.hip ?? (n.payload?.action === 'dip' ? (n.targetZones[0] ?? 8) : null),
        },
        sourcePatternId: n.payload?.patternId,
      };
    });
    const ansEvents: MotionCueEvent[] = ansNotes.map((n, idx) => ({
      id: n.id || `mot_ans_${idx + 1}`,
      startTick: Math.max(0, Math.round((n.startBeat - 1) * 480)),
      durationTicks: Math.max(480, Math.round((n.durationBeats || 1) * 480)),
      target: { leftHand: n.targetZones[0] === 4 ? 4 : null, rightHand: n.targetZones[0] === 5 ? 5 : null, head: null, hip: null },
      sourcePatternId: n.payload?.patternId,
    }));
    const feverEvents = feverNotes.map((n, idx) => mapMotionCueEvent(n, 'mot_fever', idx));

    const feverNoteEvents: FeverNoteEvent[] = host.getFeverSlots().map((s, idx) => {
      const isFoot = s.part === 'foot';
      const footKind = s.zoneId === 9 ? 'leftFoot' : (s.zoneId === 11 ? 'rightFoot' : 'centerFoot');
      const footZone = (s.zoneId >= 9 && s.zoneId <= 11 ? s.zoneId : 10) as 9 | 10 | 11;
      return {
        id: s.noteId || `evt_fever_${idx + 1}`,
        kind: 'feverNote',
        landingTick: s.tick,
        target: isFoot ? { type: 'foot' as const, foot: footKind, zoneId: footZone } : { type: 'cursor' as const, part: s.part as BodyCursorPart, zoneId: s.zoneId },
        sourcePatternId: s.patternId,
      };
    });

    const sequences: EditorSequence[] = [
      { id: host.starSequenceId || 'seq_phaseA_star', phase: 'phaseA', kind: 'starNotes', events: starEvents },
      { id: 'seq_phaseA_motion', phase: 'phaseA', kind: 'motionGuide', events: runEvents },
      { id: 'seq_phaseA_answer', phase: 'phaseA', kind: 'motionGuide', events: ansEvents },
      { id: 'seq_phaseB_motion', phase: 'phaseB', kind: 'motionGuide', events: feverEvents },
      { id: host.feverSequenceId || 'seq_phaseB_fever', phase: 'phaseB', kind: 'feverNotes', events: feverNoteEvents },
      { id: host.hazardSequenceId || 'seq_phaseA_hazard', phase: 'phaseA', kind: 'hazard', events: [{ id: host.hazardEventId || 'evt_phaseA_hazard_1', kind: 'hazard', hazardType: host.phaseAHazardPattern }] },
      { id: host.phaseBHazardSequenceId || 'seq_phaseB_hazard', phase: 'phaseB', kind: 'hazard', events: host.phaseBHazardAttacks.map((item) => ({ id: item.id, kind: 'phaseBHazard', attackType: item.attackType })) },
      ...host.customSequences,
    ];

    const bindings = host.bindings.map((b) => ({ ...b }));
    if (!bindings.some((b) => b.phase === 'phaseA' && (b.sequenceId === (host.hazardSequenceId || 'seq_phaseA_hazard') || b.role === 'hazard'))) {
      bindings.push({ chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: host.hazardSequenceId || 'seq_phaseA_hazard', role: 'hazard' });
    }
    if (!bindings.some((b) => b.phase === 'phaseB' && (b.sequenceId === (host.feverSequenceId || 'seq_phaseB_fever') || b.role === 'feverNotes'))) {
      bindings.push({ chapterId: 'ch1', subLevelId: 'fever_phase_b', phase: 'phaseB', sequenceId: host.feverSequenceId || 'seq_phaseB_fever', role: 'feverNotes' });
    }
    if (!bindings.some((b) => b.phase === 'phaseB' && (b.sequenceId === (host.phaseBHazardSequenceId || 'seq_phaseB_hazard') || b.role === 'hazard'))) {
      bindings.push({ chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: host.phaseBHazardSequenceId || 'seq_phaseB_hazard', role: 'hazard' });
    }

    return {
      kind: 'dream-guardian-authoring-project',
      schemaVersion: 2,
      projectId: host.currentProjectId,
      revision: this._commandManager ? this._commandManager.revision : 1,
      rulesetId: host.rulesetId || 'dg-ruleset-v2',
      metadata: { ...host.metadata, updatedAt: new Date().toISOString() },
      previewTempo: { bpm: host.bpm, beatsPerBar: 4 },
      patterns,
      sequences,
      bindings,
    };
  }

  applyProject(project: EditorProject, options?: { skipCommand?: boolean }): void {
    const host = this._host;
    host.setIsApplyingProject(true);
    try {
      host.setCurrentProjectId(project.projectId);
      host.setRawBpm(project.previewTempo?.bpm ?? 95);
      if (project.rulesetId) host.setRulesetId(project.rulesetId);
      if (project.metadata) {
        host.setMetadata({
          title: project.metadata.title || 'Dream Guardian Dance Editor',
          description: project.metadata.description,
          author: project.metadata.author,
          createdAt: project.metadata.createdAt || new Date().toISOString(),
          updatedAt: project.metadata.updatedAt || new Date().toISOString(),
        });
      }
      if (project.bindings && Array.isArray(project.bindings)) {
        host.setRawBindings(project.bindings.map((b) => ({ ...b })));
      }
      const handledSeqIds = new Set<string>([
        'seq_phaseA_star', host.starSequenceId, 'seq_phaseA_motion', 'seq_phaseA_answer',
        'seq_phaseB_motion', 'seq_phaseB_fever', host.feverSequenceId, 'seq_phaseA_hazard',
        host.hazardSequenceId, 'seq_phaseB_hazard', host.phaseBHazardSequenceId,
      ]);
      for (const seq of project.sequences || []) {
        if ((seq.phase === 'phaseA' && (seq.kind === 'starNotes' || seq.kind === 'motionGuide' || seq.kind === 'hazard')) ||
            (seq.phase === 'phaseB' && (seq.kind === 'motionGuide' || seq.kind === 'feverNotes' || seq.kind === 'hazard'))) {
          handledSeqIds.add(seq.id);
        }
      }
      host.setCustomSequences((project.sequences || []).filter((s) => !handledSeqIds.has(s.id)).map((s) => deepClone(s)));

      host.registry.clear();
      for (const p of project.patterns) {
        const choreo: CatChoreoPattern = {
          id: p.id, name: p.name || p.id, description: p.description || '', motionType: 'center_clasp',
          leftHand: p.target.leftHand ?? null, rightHand: p.target.rightHand ?? null,
          head: p.target.head ?? null, hip: p.target.hip ?? null, footZones: [], partZoneMap: {},
        };
        host.registry.register(choreo);
      }

      const newStarNotes: TimelineTrackNote[] = [];
      const newRunNotes: TimelineTrackNote[] = [];
      const newAnsNotes: TimelineTrackNote[] = [];
      const newFeverNotes: TimelineTrackNote[] = [];

      for (const seq of project.sequences || []) {
        if (seq.phase === 'phaseA' && seq.kind === 'starNotes') {
          if (seq.id) host.setStarSequenceId(seq.id);
          for (let idx = 0; idx < seq.events.length; idx++) {
            const ev = seq.events[idx] as StarNoteEvent;
            const landingTick = ev.landingTick ?? ev.tick ?? 0;
            const startBeat = Math.round(((landingTick / 480) + 1) * 100) / 100;
            const isFoot = ev.target.type === 'foot';
            const part = isFoot ? 'foot' : (ev.target as any).part || 'leftHand';
            newStarNotes.push({
              id: ev.id || `star_evt_${idx + 1}`,
              lane: 'keynote',
              startBeat,
              durationBeats: 1,
              label: isFoot ? '발 스텝 노트' : '스타 노트',
              color: isFoot ? '#10B981' : (part === 'hip' ? '#FF865E' : (part === 'rightHand' ? '#FFCB4D' : '#28E6FF')),
              targetZones: [ev.target.zoneId],
              payload: { part: isFoot ? 'foot' : part, targetType: isFoot ? 'foot' : 'cursor', patternId: ev.sourcePatternId },
            });
          }
        } else if (seq.phase === 'phaseA' && seq.kind === 'motionGuide') {
          const isAnswer = seq.id.toLowerCase().includes('answer');
          for (let idx = 0; idx < seq.events.length; idx++) {
            const noteItem = parseMotionCueNote(seq.events[idx] as MotionCueEvent, idx, isAnswer, false);
            if (isAnswer) newAnsNotes.push(noteItem);
            else newRunNotes.push(noteItem);
          }
        } else if (seq.phase === 'phaseB' && seq.kind === 'motionGuide') {
          for (let idx = 0; idx < seq.events.length; idx++) {
            newFeverNotes.push(parseMotionCueNote(seq.events[idx] as MotionCueEvent, idx, false, true));
          }
        } else if (seq.phase === 'phaseA' && seq.kind === 'hazard') {
          if (seq.id) host.setHazardSequenceId(seq.id);
          if (seq.events?.[0]) {
            const ev = seq.events[0] as PhaseAHazardEvent;
            if (ev.id) host.setHazardEventId(ev.id);
            if (ev.hazardType && (PHASE_A_ACTIVE_HAZARD_PATTERNS as readonly string[]).includes(ev.hazardType)) {
              host.setRawPhaseAHazardPattern(ev.hazardType as PhaseAHazardPattern);
            }
          }
        } else if (seq.phase === 'phaseB' && seq.kind === 'feverNotes') {
          if (seq.id) host.setFeverSequenceId(seq.id);
          const loadedSlots: FeverSlotItem[] = [];
          for (let idx = 0; idx < seq.events.length; idx++) {
            const ev = seq.events[idx] as FeverNoteEvent;
            const landingTick = ev.landingTick ?? ev.tick ?? ((idx + 1) * 480);
            const rawPart = (ev.target as any).part;
            const rawFoot = (ev.target as any).foot;
            const isFoot = ev.target.type === 'foot' || rawFoot !== undefined;
            const zoneId = ev.target.zoneId;
            const slotItem: FeverSlotItem = {
              slotIndex: idx,
              slotNumber: idx + 1,
              beat: Math.round((landingTick / 480) * 1000) / 1000,
              tick: landingTick,
              noteId: ev.id || `NOTE_F_${idx + 1}`,
              part: isFoot ? 'foot' : (rawPart || 'leftHand'),
              zoneId,
              label: isFoot ? '피버 발 스텝' : (rawPart === 'rightHand' ? '피버 우도달' : '피버 좌도달'),
              color: isFoot ? '#10B981' : (rawPart === 'hip' ? '#FF865E' : (rawPart === 'rightHand' ? '#FFCB4D' : '#28E6FF')),
              isStandard: landingTick === (idx + 1) * 480,
            };
            if (isFoot) {
              slotItem.foot = rawFoot || (zoneId === 9 ? 'leftFoot' : (zoneId === 11 ? 'rightFoot' : 'centerFoot'));
            }
            if (ev.sourcePatternId) {
              slotItem.patternId = ev.sourcePatternId;
            }
            loadedSlots.push(slotItem);
          }
          if (loadedSlots.length > 0) host.setFeverSlots(loadedSlots);
        } else if (seq.phase === 'phaseB' && seq.kind === 'hazard') {
          if (seq.id) host.setRawPhaseBHazardSequenceId(seq.id);
          if (seq.events?.length) {
            const attacks: PhaseBHazardAttackItem[] = [];
            for (let idx = 0; idx < seq.events.length; idx++) {
              const ev = seq.events[idx] as PhaseBHazardEvent;
              const attack = (ev.attackType ?? (ev as any).hazardType ?? '') as PhaseBPublishableAttack;
              if ((PHASE_B_PUBLISHABLE_ATTACKS as readonly string[]).includes(attack)) {
                attacks.push({
                  id: ev.id || `evt_phaseB_hz_${idx + 1}`,
                  attackType: attack,
                  requiredAction: getRequiredActionForPhaseBAttack(attack),
                  startTick: (ev as any).startTick ?? (ev as any).tick,
                  durationTicks: (ev as any).durationTicks ?? (ev as any).duration,
                });
              }
            }
            host.setRawPhaseBHazardAttacks(attacks);
            host.setPhaseBHazardAttackCounter(attacks.length + 1);
          }
        }
      }

      host.sequenceEditor.replaceNotesForPhase('STAR_COLLECT', newStarNotes);
      host.sequenceEditor.replaceNotesForPhase('RUN_QUESTION', newRunNotes);
      host.sequenceEditor.replaceNotesForPhase('ANSWER_SELECT', newAnsNotes);
      host.sequenceEditor.replaceNotesForPhase('FEVER_PHASE_B', newFeverNotes);
      host.clearFormBuffers();

      const allPatterns = host.registry.getAll();
      if (allPatterns.length > 0 && !allPatterns.some((p) => p.id === host.selectedPatternId)) {
        host.setSelectedPattern(allPatterns[0].id);
      }

      host.notifyPatternChange(host.getSelectedPattern());

      if (!options?.skipCommand && this._commandManager) {
        this._commandManager.executeCommand(new ReplaceProjectCommand(project));
      }
    } finally {
      host.setIsApplyingProject(false);
    }
  }

  cloneProject(newProjectId?: string): EditorProject {
    const baseProject = this.buildExportProject();
    const nextProjectId = newProjectId || `${baseProject.projectId}_copy_${Date.now()}`;

    const patternIdMap = new Map<string, string>();
    const clonedPatterns: EditorPattern[] = baseProject.patterns.map((p, idx) => {
      const newId = `pat_${nextProjectId}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
      patternIdMap.set(p.id, newId);
      return { ...deepClone(p), id: newId };
    });

    const seqIdMap = new Map<string, string>();
    const clonedSequences: EditorSequence[] = baseProject.sequences.map((s, idx) => {
      const newSeqId = `seq_${nextProjectId}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
      seqIdMap.set(s.id, newSeqId);

      const remappedEvents = s.events.map((ev, evIdx) => {
        const clonedEv = deepClone(ev) as any;
        if (clonedEv.id) clonedEv.id = `ev_${nextProjectId}_${evIdx + 1}_${Math.random().toString(36).slice(2, 5)}`;
        if (clonedEv.sourcePatternId && patternIdMap.has(clonedEv.sourcePatternId)) {
          clonedEv.sourcePatternId = patternIdMap.get(clonedEv.sourcePatternId)!;
        }
        return clonedEv;
      });

      return { ...deepClone(s), id: newSeqId, events: remappedEvents };
    });

    const clonedBindings: EditorBinding[] = baseProject.bindings.map((b) => ({
      ...deepClone(b),
      sequenceId: seqIdMap.get(b.sequenceId) || b.sequenceId,
    }));

    return {
      ...deepClone(baseProject),
      projectId: nextProjectId,
      revision: 1,
      metadata: {
        ...deepClone(baseProject.metadata),
        title: `${baseProject.metadata.title} (복제본)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      patterns: clonedPatterns,
      sequences: clonedSequences,
      bindings: clonedBindings,
    };
  }

  newProject(options?: { title?: string; projectId?: string }): EditorProject {
    const now = new Date().toISOString();
    const host = this._host;
    host.setCurrentProjectId(options?.projectId || `proj_${Date.now()}`);
    host.setMetadata({ title: options?.title || 'New Dance Project', createdAt: now, updatedAt: now });
    host.setRawBpm(95);
    host.registry.clear();
    for (const pat of EXTENDED_CAT_CHOREO_PATTERNS) host.registry.register(pat);
    host.sequenceEditor.resetPhase('RUN_QUESTION');
    host.sequenceEditor.resetPhase('ANSWER_SELECT');
    host.sequenceEditor.resetPhase('STAR_COLLECT');
    host.sequenceEditor.resetPhase('FEVER_PHASE_B');
    host.setCustomSequences([]);
    host.setRawBindings(DEFAULT_EDITOR_BINDINGS.map((b) => ({ ...b })));
    host.setHazardSequenceId('seq_phaseA_hazard');
    host.setHazardEventId('evt_phaseA_hazard_1');
    host.setRawPhaseAHazardPattern('left_step');
    host.setFeverSequenceId('seq_phaseB_fever');
    host.initDefaultFeverSlots();
    host.setRawPhaseBHazardSequenceId('seq_phaseB_hazard');
    host.initDefaultPhaseBHazardAttacks();
    host.setStageBuiltinProfiles({});
    host.setLastSavedRevision(0);
    host.setIsPublished(false);
    host.setPublishedRevision(null);
    host.setRevision(1);

    const freshProject = this.toEditorProject();
    freshProject.revision = 1;
    this._commandManager = this.createDefaultCommandManager();
    host.notifyDocumentChange();
    host.notifyStateChange();
    return freshProject;
  }
}
