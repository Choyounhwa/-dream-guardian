/**
 * EditorState.ts - 피트니스 안무 & 비트 타임라인 에디터 상태 및 비즈니스 로직
 */

import {
  DancePatternRegistry,
  EXTENDED_CAT_CHOREO_PATTERNS,
  buildPartZoneMap,
  type CatChoreoPattern,
  type PatternValidationResult,
  type QuestionPhaseRoutine,
  type AnswerPhaseRoutine,
  type StarCollectRoutine,
  type FeverPhaseRoutine,
  QUESTION_PHASE_ROUTINE,
  ANSWER_PHASE_ROUTINE,
  STAR_COLLECT_ROUTINE,
  FEVER_PHASE_B_ROUTINE,
} from '../data/danceRoutineData.js';
import type { BodyPart } from '../types/posture.js';
import {
  poseConstraintValidator,
  type BodyCursorPart,
  type DetailedPoseValidationResult,
} from './PoseConstraintValidator.js';
import {
  PhaseSequenceEditor,
  type TimelineTrackNote,
} from './PhaseSequenceEditor.js';
import {
  choreoPoseSimulator,
  ChoreoPoseSimulator,
  type SimulatedPoseFrame,
  type CompiledPreviewState,
} from './ChoreoPoseSimulator.js';
import {
  ProjectCommandManager,
  ReplaceProjectCommand,
  UpdateMetadataCommand,
  deepClone,
} from './ProjectCommands.js';
import type {
  EditorProject,
  EditorPattern,
  EditorSequence,
  EditorBinding,
  StarNoteEvent,
  MotionCueEvent,
  EditorProjectMetadata,
} from '../data/EditorProject.js';

export type PhaseType = 'RUN_QUESTION' | 'ANSWER_SELECT' | 'STAR_COLLECT' | 'FEVER_PHASE_B';
export type ActiveEditTool = 'inspect' | 'leftHand' | 'rightHand' | 'head' | 'hip' | 'foot';

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
  severity: 'error' | 'warning';
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
  diagnostics?: StarSlotValidationDiagnostic[];
  isDirty?: boolean;
}

export interface PatternApplicationDiff {
  targetPhase: PhaseType;
  changed: boolean;
  diffCount: number;
  currentNotes: TimelineTrackNote[];
  previewNotes: TimelineTrackNote[];
}

export type CreatePatternInput = Omit<CatChoreoPattern, 'partZoneMap'> & {
  partZoneMap?: Partial<Record<BodyPart, number>>;
};

export interface EditorPhaseRoutineInfo {
  phase: PhaseType;
  beats: number;
  prompt: string;
  routine: QuestionPhaseRoutine | AnswerPhaseRoutine | StarCollectRoutine | FeverPhaseRoutine;
  branchDuration?: number;
  noteCount?: number;
}

export interface EditorListener {
  onStateChange?: () => void;
  onPatternChange?: (pattern: CatChoreoPattern | null) => void;
  onPhaseChange?: (phase: PhaseType) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onBeatUpdate?: (beat: number) => void;
  onDocumentChange?: () => void;
}

export class EditorState {
  private _bpm: number = 95;
  private _selectedPatternId: string = 'CAT_LOW_BOUNCE';
  private _selectedPhase: PhaseType = 'RUN_QUESTION';
  private _isPlaying: boolean = false;
  private _currentBeat: number = 0;
  private _activeTool: ActiveEditTool = 'inspect';
  private _selectedNoteId: string | null = null;
  private _showSimulation: boolean = true;
  private _previewMode: 'compiled_runtime' | 'guide_simulation' = 'compiled_runtime';
  private _draftEdits: Partial<CatChoreoPattern> = {};
  private _currentProjectId: string = 'proj_dance_editor';
  private _isApplyingProject: boolean = false;
  private _formBuffer: Map<number, FormBufferEntry> = new Map();
  private _focusedEntityId: string | null = null;
  private _focusedErrorPath: string | null = null;
  private _starSequenceId: string = 'seq_phaseA_star';
  private _bindings: EditorBinding[] = [
    {
      chapterId: 'ch1',
      subLevelId: 'star_collect',
      phase: 'phaseA',
      sequenceId: 'seq_phaseA_star',
      role: 'starNotes',
    },
    {
      chapterId: 'ch1',
      subLevelId: 'run_question',
      phase: 'phaseA',
      sequenceId: 'seq_phaseA_motion',
      role: 'motionGuide',
    },
    {
      chapterId: 'ch1',
      subLevelId: 'answer_select',
      phase: 'phaseA',
      sequenceId: 'seq_phaseA_answer',
      role: 'motionGuide',
    },
    {
      chapterId: 'ch1',
      subLevelId: 'fever_phase_b',
      phase: 'phaseB',
      sequenceId: 'seq_phaseB_motion',
      role: 'motionGuide',
    },
  ];
  private _customSequences: EditorSequence[] = [];
  private _stageBuiltinProfiles: Record<string, string> = {};
  private _rulesetId: string = 'dg-ruleset-v2';
  private _metadata: EditorProjectMetadata = {
    title: 'Dream Guardian Dance Editor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  private _revision: number = 1;
  private _lastSavedRevision: number = 0;
  private _isPublished: boolean = false;
  private _publishedRevision: number | null = null;
  private readonly _registry: DancePatternRegistry;
  private readonly _sequenceEditor: PhaseSequenceEditor;
  private readonly _simulator: ChoreoPoseSimulator = choreoPoseSimulator;
  private readonly _listeners: Set<EditorListener> = new Set();
  private _commandManager?: ProjectCommandManager;

  constructor(
    initialRegistry?: DancePatternRegistry,
    initialSequenceEditor?: PhaseSequenceEditor,
    commandManager?: ProjectCommandManager
  ) {
    this._registry = initialRegistry ?? new DancePatternRegistry(EXTENDED_CAT_CHOREO_PATTERNS);
    this._sequenceEditor = initialSequenceEditor ?? new PhaseSequenceEditor();
    if (commandManager) {
      this._commandManager = commandManager;
      this._commandManager.addListener((newProj) => {
        this.applyProject(newProj, { skipCommand: true });
        this.notifyDocumentChange();
        this.notifyStateChange();
      });
    }
    this._sequenceEditor.addListener(() => {
      if (this._isApplyingProject) return;
      this.notifyDocumentChange();
      this.notifyStateChange();
    });
  }

  get currentProjectId(): string {
    return this._currentProjectId;
  }

  set currentProjectId(id: string) {
    this._currentProjectId = id;
  }

  get revision(): number {
    return this.commandManager.revision;
  }

  get currentRevision(): number {
    return this.commandManager.revision;
  }

  get metadata(): EditorProjectMetadata {
    return deepClone(this._metadata);
  }

  setProjectTitle(title: string): void {
    this._metadata.title = title;
    this._metadata.updatedAt = new Date().toISOString();
    this.commandManager.executeCommand(new UpdateMetadataCommand({ title }));
  }

  updateMetadata(meta: Partial<EditorProjectMetadata>): void {
    this._metadata = {
      ...this._metadata,
      ...deepClone(meta),
      updatedAt: new Date().toISOString(),
    };
    this.commandManager.executeCommand(new UpdateMetadataCommand(meta));
  }

  getBindings(): EditorBinding[] {
    return this._bindings.map((b) => ({ ...b }));
  }

  setBindings(bindings: EditorBinding[]): void {
    this._bindings = bindings.map((b) => ({ ...b }));
    this.notifyDocumentChange();
    this.notifyStateChange();
  }

  getSequences(): EditorSequence[] {
    return this.toEditorProject().sequences;
  }

  buildExportProject(): EditorProject {
    return this.toEditorProject();
  }

  validateBinding(
    binding: EditorBinding,
    options?: { excludeIndex?: number }
  ): BindingValidationResult {
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

    for (let i = 0; i < this._bindings.length; i++) {
      if (options?.excludeIndex !== undefined && options.excludeIndex === i) {
        continue;
      }
      const existing = this._bindings[i];
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

    return {
      valid: true,
      errors: [],
      compoundKey,
    };
  }

  addBinding(binding: EditorBinding): { success: boolean; error?: string; errors?: string[]; diagnosticCode?: string } {
    const result = this.validateBinding(binding);
    if (!result.valid) {
      return {
        success: false,
        error: result.errors[0],
        errors: result.errors,
        diagnosticCode: result.diagnosticCode,
      };
    }

    this._bindings.push({
      chapterId: binding.chapterId,
      subLevelId: binding.subLevelId ?? null,
      phase: binding.phase,
      sequenceId: binding.sequenceId,
      role: binding.role,
    });

    const proj = this.toEditorProject();
    this.commandManager.executeCommand(new ReplaceProjectCommand(proj));

    return { success: true };
  }

  updateBinding(
    index: number,
    updated: EditorBinding
  ): { success: boolean; error?: string; errors?: string[]; diagnosticCode?: string } {
    if (index < 0 || index >= this._bindings.length) {
      return { success: false, error: `Invalid binding index ${index}` };
    }
    const result = this.validateBinding(updated, { excludeIndex: index });
    if (!result.valid) {
      return {
        success: false,
        error: result.errors[0],
        errors: result.errors,
        diagnosticCode: result.diagnosticCode,
      };
    }

    this._bindings[index] = {
      chapterId: updated.chapterId,
      subLevelId: updated.subLevelId ?? null,
      phase: updated.phase,
      sequenceId: updated.sequenceId,
      role: updated.role,
    };

    const proj = this.toEditorProject();
    this.commandManager.executeCommand(new ReplaceProjectCommand(proj));

    return { success: true };
  }

  removeBinding(target: number | string | Partial<EditorBinding>): boolean {
    let removeIndex = -1;
    if (typeof target === 'number') {
      removeIndex = target;
    } else if (typeof target === 'string') {
      const allSequences = this.getSequences();
      removeIndex = this._bindings.findIndex((b) => {
        const seq = allSequences.find((s) => s.id === b.sequenceId);
        const role = b.role || seq?.kind || 'motionGuide';
        const key = `${b.chapterId}::${b.subLevelId ?? 'all'}::${b.phase}::${role}`;
        return key === target || b.sequenceId === target;
      });
    } else if (typeof target === 'object' && target !== null) {
      removeIndex = this._bindings.findIndex((b) => {
        return (
          (!target.chapterId || b.chapterId === target.chapterId) &&
          (target.subLevelId === undefined || b.subLevelId === target.subLevelId) &&
          (!target.phase || b.phase === target.phase) &&
          (!target.sequenceId || b.sequenceId === target.sequenceId)
        );
      });
    }

    if (removeIndex >= 0 && removeIndex < this._bindings.length) {
      this._bindings.splice(removeIndex, 1);
      const proj = this.toEditorProject();
      this.commandManager.executeCommand(new ReplaceProjectCommand(proj));
      return true;
    }
    return false;
  }

  cloneProject(newProjectId?: string): EditorProject {
    const baseProject = this.buildExportProject();
    const nextProjectId = newProjectId || `${baseProject.projectId}_copy_${Date.now()}`;

    // Remap patterns
    const patternIdMap = new Map<string, string>();
    const clonedPatterns: EditorPattern[] = baseProject.patterns.map((p, idx) => {
      const newId = `pat_${nextProjectId}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
      patternIdMap.set(p.id, newId);
      return {
        ...deepClone(p),
        id: newId,
      };
    });

    // Remap sequences
    const seqIdMap = new Map<string, string>();
    const clonedSequences: EditorSequence[] = baseProject.sequences.map((s, idx) => {
      const newSeqId = `seq_${nextProjectId}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
      seqIdMap.set(s.id, newSeqId);

      const remappedEvents = s.events.map((ev, evIdx) => {
        const clonedEv = deepClone(ev) as any;
        if (clonedEv.id) {
          clonedEv.id = `ev_${nextProjectId}_${evIdx + 1}_${Math.random().toString(36).slice(2, 5)}`;
        }
        if (clonedEv.sourcePatternId && patternIdMap.has(clonedEv.sourcePatternId)) {
          clonedEv.sourcePatternId = patternIdMap.get(clonedEv.sourcePatternId)!;
        }
        return clonedEv;
      });

      return {
        ...deepClone(s),
        id: newSeqId,
        events: remappedEvents,
      };
    });

    // Remap bindings
    const clonedBindings: EditorBinding[] = baseProject.bindings.map((b) => {
      const remappedSeqId = seqIdMap.get(b.sequenceId) ?? b.sequenceId;
      return {
        ...deepClone(b),
        sequenceId: remappedSeqId,
      };
    });

    const now = new Date().toISOString();
    const clonedProject: EditorProject = {
      ...deepClone(baseProject),
      projectId: nextProjectId,
      revision: 1,
      metadata: {
        ...deepClone(baseProject.metadata),
        title: `${baseProject.metadata.title} (복제본)`,
        createdAt: now,
        updatedAt: now,
      },
      patterns: clonedPatterns,
      sequences: clonedSequences,
      bindings: clonedBindings,
    };

    return clonedProject;
  }

  newProject(options?: { title?: string; projectId?: string }): EditorProject {
    const now = new Date().toISOString();
    this._currentProjectId = options?.projectId || `proj_${Date.now()}`;
    this._metadata = {
      title: options?.title || 'New Dance Project',
      createdAt: now,
      updatedAt: now,
    };
    this._bpm = 95;
    this._registry.clear();
    for (const pat of EXTENDED_CAT_CHOREO_PATTERNS) {
      this._registry.register(pat);
    }
    this._sequenceEditor.resetPhase('RUN_QUESTION');
    this._sequenceEditor.resetPhase('ANSWER_SELECT');
    this._sequenceEditor.resetPhase('STAR_COLLECT');
    this._sequenceEditor.resetPhase('FEVER_PHASE_B');
    this._customSequences = [];
    this._bindings = [
      {
        chapterId: 'ch1',
        subLevelId: 'star_collect',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
        role: 'starNotes',
      },
      {
        chapterId: 'ch1',
        subLevelId: 'run_question',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_motion',
        role: 'motionGuide',
      },
      {
        chapterId: 'ch1',
        subLevelId: 'answer_select',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_answer',
        role: 'motionGuide',
      },
      {
        chapterId: 'ch1',
        subLevelId: 'fever_phase_b',
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_motion',
        role: 'motionGuide',
      },
    ];
    this._stageBuiltinProfiles = {};
    this._lastSavedRevision = 0;
    this._isPublished = false;
    this._publishedRevision = null;
    this._revision = 1;

    const freshProject = this.toEditorProject();
    freshProject.revision = 1;
    this._commandManager = this.createDefaultCommandManager();
    this.notifyDocumentChange();
    this.notifyStateChange();
    return freshProject;
  }

  getProjectPublicationStatus(): ProjectPublicationStatus {
    const currentRevision = this.commandManager.revision;
    const savedRevision = this._lastSavedRevision;
    const isClean = savedRevision === currentRevision;
    const isPublished =
      this._isPublished &&
      this._publishedRevision !== null &&
      this._publishedRevision >= currentRevision;
    const isDraft = !isClean || !isPublished;
    return {
      isDraft,
      savedRevision,
      currentRevision,
      isPublished,
      isClean,
    };
  }

  markSaved(revision?: number): void {
    const rev = revision ?? this.commandManager.revision;
    this._lastSavedRevision = rev;
  }

  markPublished(revision?: number): void {
    const rev = revision ?? this.commandManager.revision;
    this._isPublished = true;
    this._publishedRevision = rev;
  }

  markUnpublished(): void {
    this._isPublished = false;
    this._publishedRevision = null;
  }

  getStageBuiltinProfiles(): Record<string, string> {
    return { ...this._stageBuiltinProfiles };
  }

  setStageBuiltinProfile(chapterId: string, profileId: string | null): void {
    if (profileId === null || profileId.trim().length === 0) {
      delete this._stageBuiltinProfiles[chapterId];
    } else {
      this._stageBuiltinProfiles[chapterId] = profileId.trim();
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
  }

  getStageCoverageStatus(
    requiredStages: string[] = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']
  ): StageCoverageReport {
    const stages: StageCoverageItem[] = [];
    const boundStages: string[] = [];
    const builtinStages: string[] = [];
    const missingStages: string[] = [];
    const partialStages: string[] = [];

    for (const ch of requiredStages) {
      const stageBindings = this._bindings.filter((b) => b.chapterId === ch);
      const builtinProfile = this._stageBuiltinProfiles[ch] ?? null;
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
          isComplete = false;
          partialStages.push(ch);
        }
      } else {
        if (hasBuiltin) {
          status = 'builtin';
          isComplete = true;
          builtinStages.push(ch);
        } else {
          status = 'missing';
          isComplete = false;
          missingStages.push(ch);
        }
      }

      stages.push({
        chapterId: ch,
        status,
        isComplete,
        builtinProfile,
        boundPhases,
        bindingCount: stageBindings.length,
      });
    }

    const isComplete = stages.every((s) => s.isComplete);

    return {
      isComplete,
      stages,
      boundStages,
      builtinStages,
      missingStages,
      partialStages,
    };
  }

  get commandManager(): ProjectCommandManager {
    if (!this._commandManager) {
      this._commandManager = this.createDefaultCommandManager();
    }
    return this._commandManager;
  }

  private createDefaultCommandManager(): ProjectCommandManager {
    const proj = this.toEditorProject();
    return new ProjectCommandManager(proj, {
      onDocumentChange: (newProj) => {
        this.applyProject(newProj, { skipCommand: true });
        this.notifyDocumentChange();
        this.notifyStateChange();
      },
    });
  }

  get sequenceEditor(): PhaseSequenceEditor {
    return this._sequenceEditor;
  }

  get selectedNoteId(): string | null {
    return this._selectedNoteId;
  }

  setSelectedNoteId(id: string | null): void {
    this._selectedNoteId = id;
    this.notifyStateChange();
  }

  get showSimulation(): boolean {
    return this._showSimulation;
  }

  setShowSimulation(show: boolean): void {
    this._showSimulation = show;
    this.notifyStateChange();
  }

  toggleSimulation(): void {
    this._showSimulation = !this._showSimulation;
    this.notifyStateChange();
  }

  get previewMode(): 'compiled_runtime' | 'guide_simulation' {
    return this._previewMode;
  }

  setPreviewMode(mode: 'compiled_runtime' | 'guide_simulation'): void {
    this._previewMode = mode;
    this.notifyStateChange();
  }

  togglePreviewMode(): void {
    this.setPreviewMode(
      this._previewMode === 'compiled_runtime' ? 'guide_simulation' : 'compiled_runtime'
    );
  }

  getCurrentTimeSeconds(): number {
    const audioBeat = this.displayBeatToAudioBeat(this._currentBeat);
    return Math.max(0, audioBeat * (60 / this._bpm));
  }

  seekSeconds(seconds: number): void {
    const audioBeat = seconds / (60 / this._bpm);
    const displayBeat = this.audioBeatToDisplayBeat(audioBeat);
    this.seekBeat(displayBeat);
  }

  getCompiledPreviewState(phase?: PhaseType): CompiledPreviewState {
    const proj = this.getCurrentProject();
    const projectWithBpm: EditorProject = {
      ...proj,
      previewTempo: {
        bpm: this._bpm,
        beatsPerBar: proj.previewTempo?.beatsPerBar ?? 4,
      },
    };

    const targetPhase =
      phase ??
      (this._selectedPhase === 'RUN_QUESTION' &&
      this.getNotesForPhase('STAR_COLLECT').length > 0 &&
      this.getCurrentPhaseNotes().length === 0
        ? 'STAR_COLLECT'
        : this._selectedPhase);

    return this._simulator.buildCompiledPreviewState({
      project: projectWithBpm,
      phase: targetPhase,
      bpm: this._bpm,
      currentBeat: this._currentBeat,
      currentTimeSeconds: this.getCurrentTimeSeconds(),
    });
  }

  computeCurrentPoseFrame(): SimulatedPoseFrame {
    if (this._previewMode === 'guide_simulation') {
      const frame = this._simulator.computeLiveFrame({
        phase: this._selectedPhase,
        currentBeat: this._currentBeat,
        selectedPattern: this.getSelectedPattern(),
        notes: this.getCurrentPhaseNotes(),
        registry: this._registry,
      });
      return {
        ...frame,
        currentTimeSeconds: this.getCurrentTimeSeconds(),
        previewMode: 'guide_simulation',
      };
    }

    const compiledState = this.getCompiledPreviewState();
    return this._simulator.computeCompiledFrame({
      phase: this._selectedPhase,
      currentBeat: this._currentBeat,
      currentTimeSeconds: this.getCurrentTimeSeconds(),
      bpm: this._bpm,
      selectedPattern: this.getSelectedPattern(),
      notes: this.getCurrentPhaseNotes(),
      registry: this._registry,
      compiledState,
    });
  }

  getCurrentPhaseNotes(): TimelineTrackNote[] {
    return this._sequenceEditor.getNotesForPhase(this._selectedPhase);
  }

  getNotesForPhase(phase: PhaseType): TimelineTrackNote[] {
    return this._sequenceEditor.getNotesForPhase(phase);
  }

  get activeTool(): ActiveEditTool {
    return this._activeTool;
  }

  setActiveTool(tool: ActiveEditTool): void {
    this._activeTool = tool;
    this.notifyStateChange();
  }

  get bpm(): number {
    return this._bpm;
  }

  get selectedPatternId(): string {
    return this._selectedPatternId;
  }

  get selectedPhase(): PhaseType {
    return this._selectedPhase;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get currentBeat(): number {
    return this._currentBeat;
  }

  get registry(): DancePatternRegistry {
    return this._registry;
  }

  getPatterns(): CatChoreoPattern[] {
    return this._registry.getAll();
  }

  getSelectedPattern(): CatChoreoPattern | null {
    const base = this._registry.get(this._selectedPatternId);
    if (!base) return null;
    const merged = {
      ...base,
      ...this._draftEdits,
      footZones: this._draftEdits.footZones ?? base.footZones,
    };
    return {
      ...merged,
      partZoneMap: buildPartZoneMap(merged),
    };
  }

  getValidationStatus(): PatternValidationResult {
    const selected = this.getSelectedPattern();
    if (!selected) {
      return { valid: true, errors: [] };
    }
    return this._registry.validate(selected);
  }

  setSelectedPattern(id: string, options?: { applyToSequence?: boolean }): boolean {
    const pattern = this._registry.get(id);
    if (!pattern) {
      return false;
    }
    this._selectedPatternId = id;
    this._draftEdits = {};
    if (options?.applyToSequence) {
      this._sequenceEditor.syncWithPattern(pattern);
      this.notifyDocumentChange();
    }
    this.notifyPatternChange(pattern);
    this.notifyStateChange();
    return true;
  }

  applyPatternToSequence(patternId?: string): boolean {
    const id = patternId ?? this._selectedPatternId;
    const pattern = this._registry.get(id);
    if (!pattern) {
      return false;
    }
    this._selectedPatternId = id;
    this._draftEdits = {};
    this._sequenceEditor.syncWithPattern(pattern);
    this.notifyPatternChange(pattern);
    this.notifyDocumentChange();
    this.notifyStateChange();
    return true;
  }

  updateCurrentPattern(partial: Partial<CatChoreoPattern>): PatternValidationResult {
    const current = this.getSelectedPattern();
    if (!current) {
      return { valid: false, errors: ['선택된 패턴이 없습니다.'] };
    }
    if ((partial as any).id !== undefined && (partial as any).id !== this._selectedPatternId) {
      return { valid: false, errors: ['패턴 ID는 일반 수정으로 변경할 수 없습니다.'] };
    }
    const candidateBase = {
      ...current,
      ...partial,
      footZones: partial.footZones ? [...partial.footZones] : current.footZones,
    };
    const candidate: CatChoreoPattern = {
      ...candidateBase,
      partZoneMap: buildPartZoneMap(candidateBase),
    };
    const val = this._registry.validate(candidate);
    this._draftEdits = { ...this._draftEdits, ...partial };

    if (val.valid) {
      this._registry.update(this._selectedPatternId, partial);
    }
    this.notifyPatternChange(this.getSelectedPattern());
    this.notifyDocumentChange();
    this.notifyStateChange();
    return val;
  }

  createNewPattern(input: CreatePatternInput): PatternValidationResult {
    if (this._registry.get(input.id)) {
      return {
        valid: false,
        errors: [`패턴 ID "${input.id}"은(는) 이미 존재합니다.`],
      };
    }

    const partZoneMap = buildPartZoneMap(input);

    const fullPattern: CatChoreoPattern = {
      ...input,
      footZones: input.footZones ? [...input.footZones] : [],
      partZoneMap,
    };

    const res = this._registry.register(fullPattern);
    if (res.valid) {
      this._selectedPatternId = fullPattern.id;
      this._draftEdits = {};
      this.notifyPatternChange(fullPattern);
      this.notifyDocumentChange();
      this.notifyStateChange();
    }
    return res;
  }

  assignPartToZone(part: BodyCursorPart | 'foot', zoneId: number): PatternValidationResult {
    const current = this.getSelectedPattern();
    if (!current) {
      return { valid: false, errors: ['선택된 패턴이 없습니다.'] };
    }

    if (part === 'foot') {
      const existing = current.footZones ? [...current.footZones] : [];
      const nextFootZones = existing.includes(zoneId)
        ? existing.filter((z) => z !== zoneId)
        : [...existing, zoneId];
      return this.updateCurrentPattern({ footZones: nextFootZones });
    }

    const currentVal = current[part];
    const nextVal = currentVal === zoneId ? null : zoneId;
    return this.updateCurrentPattern({ [part]: nextVal });
  }

  duplicateCurrentPattern(): CatChoreoPattern | null {
    const current = this.getSelectedPattern();
    if (!current) return null;

    let candidateId = `${current.id}_COPY`;
    let count = 1;
    while (this._registry.get(candidateId)) {
      count++;
      candidateId = `${current.id}_COPY_${count}`;
    }

    const res = this.createNewPattern({
      id: candidateId,
      name: `${current.name} (복제본)`,
      description: current.description,
      motionType: current.motionType,
      leftHand: current.leftHand,
      rightHand: current.rightHand,
      head: current.head,
      hip: current.hip,
      footZones: current.footZones ? [...current.footZones] : [],
      partZoneMap: current.partZoneMap ? { ...current.partZoneMap } : {},
    });

    if (res.valid) {
      return this.getSelectedPattern();
    }
    return null;
  }

  deleteCurrentPattern(): boolean {
    const all = this.getPatterns();
    if (all.length <= 1) {
      return false; // 최소 1개는 유지
    }

    const idToDelete = this._selectedPatternId;
    const unregistered = this._registry.unregister(idToDelete);
    if (!unregistered) return false;

    const remaining = this.getPatterns();
    this._selectedPatternId = remaining[0].id;
    this._draftEdits = {};
    this.notifyPatternChange(this.getSelectedPattern());
    this.notifyDocumentChange();
    this.notifyStateChange();
    return true;
  }

  getDetailedValidation(): DetailedPoseValidationResult {
    const selected = this.getSelectedPattern();
    return poseConstraintValidator.validateDetailed(selected ?? {});
  }

  // ==========================================
  // Issue #384: STAR_COLLECT 7-Slot Editor API
  // ==========================================

  getStarSlots(): StarSlotItem[] {
    const starNotes = this._sequenceEditor.getNotesForPhase('STAR_COLLECT');
    const slots: StarSlotItem[] = [];

    for (let idx = 0; idx < 7; idx++) {
      const slotNumber = idx + 1;
      const expectedBeat = idx + 2;
      const expectedTick = (idx + 1) * 480;
      const note = starNotes[idx];

      const noteId = note?.id || `NOTE_S_${slotNumber}`;
      const beat = note?.startBeat ?? expectedBeat;
      const tick = note ? Math.round((note.startBeat - 1) * 480) : expectedTick;
      const rawPart = note?.payload?.part;
      const rawZone = note?.targetZones?.[0];
      const isFoot =
        rawPart === 'foot' ||
        note?.payload?.targetType === 'foot' ||
        (rawPart === 'hip' && rawZone !== undefined && rawZone >= 9);
      const part: BodyCursorPart | 'foot' = isFoot
        ? 'foot'
        : ((rawPart as BodyCursorPart) || (rawZone && rawZone >= 6 ? 'hip' : 'leftHand'));
      const zoneId = rawZone ?? (part === 'foot' ? 10 : 3);
      const isStandard = Math.abs(beat - expectedBeat) < 0.001;

      slots.push({
        slotIndex: idx,
        slotNumber,
        beat,
        tick,
        noteId,
        part,
        zoneId,
        patternId: note?.payload?.patternId,
        label: note?.label,
        color: note?.color,
        isStandard,
      });
    }

    return slots;
  }

  canModifyStarNoteCount(): boolean {
    return false;
  }

  addStarSlotNote(_note?: any): StarSlotValidationResult {
    return {
      valid: false,
      lockCode: 'COUNT_LOCKED',
      lockReason:
        'STAR_COLLECT 시퀀스는 정확히 7개의 고정 슬롯 노트(2~8박)만 허용되며 노트 수 추가/삭제가 잠겨 있습니다. (COUNT_LOCKED)',
      diagnostics: [
        {
          code: 'COUNT_LOCKED',
          message: 'STAR_COLLECT requires exactly 7 fixed slot notes; note count is locked.',
          severity: 'error',
        },
      ],
    };
  }

  validateStarSlot(
    slotIndex: number,
    patch: Partial<{
      part: BodyCursorPart | 'foot';
      zoneId: number;
      beat: number;
      tick: number;
      freeLanding: boolean;
      rewardMultiplier: number;
    }>
  ): StarSlotValidationResult {
    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 7
        ? slotIndex
        : slotIndex === 7
        ? 6
        : Math.max(0, Math.min(6, slotIndex));
    const expectedBeat = normalizedIndex + 2;
    const expectedTick = (normalizedIndex + 1) * 480;

    // 1. Beat & Tick Fixed Lock
    if (
      (patch.beat !== undefined && Math.abs(patch.beat - expectedBeat) > 0.001) ||
      (patch.tick !== undefined && patch.tick !== expectedTick)
    ) {
      return {
        valid: false,
        lockCode: 'FIXED_SLOT_LANDING',
        lockReason: `별 착지 타이밍은 슬롯 ${normalizedIndex + 1}의 ${expectedBeat}박(${expectedTick} tick)으로 고정되어 있습니다. (FIXED_SLOT_LANDING)`,
        diagnostics: [
          {
            code: 'FIXED_SLOT_LANDING',
            path: 'landingTick',
            entityId: `NOTE_S_${normalizedIndex + 1}`,
            message: `Star landing timing is fixed to beat ${expectedBeat} (${expectedTick} ticks).`,
            severity: 'error',
          },
        ],
      };
    }

    // 2. Reward modification lock
    if ((patch as any).rewardMultiplier !== undefined || (patch as any).reward !== undefined) {
      return {
        valid: false,
        lockCode: 'LOCKED_REWARD_MODIFICATION',
        lockReason: '별 수집 슬롯 보상 배율은 고정되어 있으며 수정이 잠겨 있습니다. (LOCKED_REWARD_MODIFICATION)',
        diagnostics: [
          {
            code: 'LOCKED_REWARD_MODIFICATION',
            path: 'reward',
            entityId: `NOTE_S_${normalizedIndex + 1}`,
            message: 'Star reward modification is locked for fixed star slots.',
            severity: 'error',
          },
        ],
      };
    }

    // 3. Free landing modification lock
    if ((patch as any).freeLanding !== undefined) {
      return {
        valid: false,
        lockCode: 'LOCKED_FREE_LANDING',
        lockReason: '자유 착지 타이밍 수정이 잠겨 있습니다. 7개 고정 슬롯 착지만 허용됩니다. (LOCKED_FREE_LANDING)',
        diagnostics: [
          {
            code: 'LOCKED_FREE_LANDING',
            path: 'freeLanding',
            entityId: `NOTE_S_${normalizedIndex + 1}`,
            message: 'Free landing mode is locked for star collection.',
            severity: 'error',
          },
        ],
      };
    }

    // 4. Head & Hip Cursor Lock
    if (patch.part === 'head') {
      return {
        valid: false,
        lockCode: 'LOCKED_INPUT_CAPABILITY',
        lockReason:
          '머리 커서는 초기 V2 프로필에서 별 수집에 지원되지 않습니다 (LOCKED_INPUT_CAPABILITY). 손(1~5) 또는 발(9~11)을 사용하세요.',
        diagnostics: [
          {
            code: 'LOCKED_INPUT_CAPABILITY',
            path: 'target.part',
            entityId: `NOTE_S_${normalizedIndex + 1}`,
            message: 'Head cursor is locked for star collection in initial V2 profile.',
            severity: 'error',
          },
        ],
      };
    }

    if (patch.part === 'hip') {
      return {
        valid: false,
        lockCode: 'LOCKED_INPUT_CAPABILITY',
        lockReason:
          '골반 커서는 초기 V2 프로필에서 별 수집에 지원되지 않습니다 (LOCKED_INPUT_CAPABILITY). 손(1~5) 또는 발(9~11)을 사용하세요.',
        diagnostics: [
          {
            code: 'LOCKED_INPUT_CAPABILITY',
            path: 'target.part',
            entityId: `NOTE_S_${normalizedIndex + 1}`,
            message: 'Hip cursor is locked for star collection in initial V2 profile.',
            severity: 'error',
          },
        ],
      };
    }

    const currentSlots = this.getStarSlots();
    const currentSlot = currentSlots[normalizedIndex];
    const targetPart = patch.part ?? currentSlot?.part ?? 'leftHand';
    const targetZone = patch.zoneId ?? currentSlot?.zoneId ?? 3;

    // 5. Zone bounds for Hand (1..5)
    if (targetPart === 'leftHand' || targetPart === 'rightHand') {
      if (targetZone < 1 || targetZone > 5) {
        return {
          valid: false,
          lockCode: 'LOCKED_INPUT_CAPABILITY',
          lockReason: '손(leftHand/rightHand) 타겟 존은 초기 V2 프로필에서 1~5 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          diagnostics: [
            {
              code: 'LOCKED_INPUT_CAPABILITY',
              path: 'target.zoneId',
              entityId: `NOTE_S_${normalizedIndex + 1}`,
              message: 'Hand target zone must be between 1 and 5 in initial V2 profile.',
              severity: 'error',
            },
          ],
        };
      }
    }

    // 6. Zone bounds for Foot (9..11)
    if (targetPart === 'foot') {
      if (targetZone < 9 || targetZone > 11) {
        return {
          valid: false,
          lockCode: 'LOCKED_INPUT_CAPABILITY',
          lockReason: '발(foot) 타겟 존은 초기 V2 프로필에서 9~11 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          diagnostics: [
            {
              code: 'LOCKED_INPUT_CAPABILITY',
              path: 'target.zoneId',
              entityId: `NOTE_S_${normalizedIndex + 1}`,
              message: 'Foot target zone must be between 9 and 11 in initial V2 profile.',
              severity: 'error',
            },
          ],
        };
      }
    }

    return {
      valid: true,
      diagnostics: [],
    };
  }

  updateStarSlot(
    slotIndex: number,
    patch: { part?: BodyCursorPart | 'foot'; zoneId?: number; patternId?: string }
  ): StarSlotValidationResult {
    const valRes = this.validateStarSlot(slotIndex, patch);
    if (!valRes.valid) {
      this.setFormBuffer(slotIndex, {
        ...patch,
        errors: valRes.diagnostics.map((d) => d.message),
        diagnostics: valRes.diagnostics,
      });
      return valRes;
    }

    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 7
        ? slotIndex
        : slotIndex === 7
        ? 6
        : Math.max(0, Math.min(6, slotIndex));
    const slots = this.getStarSlots();
    const slot = slots[normalizedIndex];
    if (!slot) {
      return {
        valid: false,
        diagnostics: [{ code: 'SLOT_NOT_FOUND', message: `슬롯 ${slotIndex}을 찾을 수 없습니다.`, severity: 'error' }],
      };
    }

    const nextPart = patch.part ?? slot.part;
    const nextZone = patch.zoneId ?? slot.zoneId;
    const nextPatternId = patch.patternId ?? slot.patternId;
    const color = nextPart === 'foot' ? '#10B981' : (nextPart === 'rightHand' ? '#FFCB4D' : '#28E6FF');
    const label = nextPart === 'foot' ? 'Star (발)' : (nextPart === 'rightHand' ? 'Star (오른손)' : 'Star (왼손)');

    this._sequenceEditor.updateNote('STAR_COLLECT', slot.noteId, {
      targetZones: [nextZone],
      color,
      label,
      payload: {
        part: nextPart,
        targetType: nextPart === 'foot' ? 'foot' : 'cursor',
        patternId: nextPatternId,
      },
    });

    this._formBuffer.delete(normalizedIndex);
    this.notifyDocumentChange();
    this.notifyStateChange();

    return {
      valid: true,
      diagnostics: [],
    };
  }

  getFormBuffer(slotIndex?: number): FormBufferEntry | undefined {
    if (slotIndex !== undefined) {
      const normalizedIndex =
        slotIndex >= 0 && slotIndex < 7
          ? slotIndex
          : slotIndex === 7
          ? 6
          : slotIndex;
      return this._formBuffer.get(normalizedIndex);
    }
    return undefined;
  }

  setFormBuffer(slotIndex: number, entry: Partial<FormBufferEntry>): void {
    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 7
        ? slotIndex
        : slotIndex === 7
        ? 6
        : Math.max(0, Math.min(6, slotIndex));
    const valRes = this.validateStarSlot(normalizedIndex, entry as any);
    const existing = this._formBuffer.get(normalizedIndex) ?? { slotIndex: normalizedIndex };
    const merged: FormBufferEntry = {
      ...existing,
      ...entry,
      slotIndex: normalizedIndex,
      errors: valRes.valid ? [] : valRes.diagnostics.map((d) => d.message),
      diagnostics: valRes.diagnostics,
      isDirty: true,
    };
    this._formBuffer.set(normalizedIndex, merged);
    this.notifyStateChange();
  }

  clearFormBuffer(slotIndex?: number): void {
    if (slotIndex !== undefined) {
      const normalizedIndex =
        slotIndex >= 0 && slotIndex < 7
          ? slotIndex
          : slotIndex === 7
          ? 6
          : slotIndex;
      this._formBuffer.delete(normalizedIndex);
    } else {
      this._formBuffer.clear();
    }
    this.notifyStateChange();
  }

  applyFormBuffer(slotIndex: number): StarSlotValidationResult {
    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 7
        ? slotIndex
        : slotIndex === 7
        ? 6
        : Math.max(0, Math.min(6, slotIndex));
    const entry = this._formBuffer.get(normalizedIndex);
    if (!entry) {
      return { valid: true, diagnostics: [] };
    }
    const valRes = this.validateStarSlot(normalizedIndex, entry as any);
    if (!valRes.valid) {
      return valRes;
    }
    return this.updateStarSlot(normalizedIndex, {
      part: entry.part,
      zoneId: entry.zoneId,
      patternId: entry.patternId,
    });
  }

  getPatternApplicationDiff(patternId?: string, phase?: PhaseType): PatternApplicationDiff {
    const targetPhase = phase ?? this._selectedPhase;
    const targetPatId = patternId ?? this._selectedPatternId;
    const pattern = this._registry.get(targetPatId);
    const currentNotes = this._sequenceEditor.getNotesForPhase(targetPhase);

    if (!pattern || targetPhase !== 'STAR_COLLECT') {
      return {
        targetPhase,
        changed: false,
        diffCount: 0,
        currentNotes,
        previewNotes: currentNotes,
      };
    }

    const lh = pattern.leftHand ?? 4;
    const rh = pattern.rightHand ?? 5;
    const hp = pattern.hip ?? 10;
    const previewNotes: TimelineTrackNote[] = [];

    if (pattern.motionType === 'sky_point_right') {
      previewNotes.push(
        { id: 'NOTE_S_1', lane: 'keynote', startBeat: 2, durationBeats: 1, label: `${pattern.name} 힙 셋업`, color: '#FF865E', targetZones: [hp], payload: { part: 'hip', patternId: pattern.id } },
        { id: 'NOTE_S_2', lane: 'keynote', startBeat: 3, durationBeats: 1, label: `${pattern.name} 왼손 지지`, color: '#28E6FF', targetZones: [lh], payload: { part: 'leftHand', patternId: pattern.id } },
        { id: 'NOTE_S_3', lane: 'keynote', startBeat: 4, durationBeats: 1, label: `${pattern.name} 오른손 스카이`, color: '#FFCB4D', targetZones: [rh], payload: { part: 'rightHand', patternId: pattern.id } },
        { id: 'NOTE_S_4', lane: 'keynote', startBeat: 5, durationBeats: 1, label: `${pattern.name} 우상단 키노트`, color: '#FFCB4D', targetZones: [rh], payload: { part: 'rightHand', patternId: pattern.id } },
        { id: 'NOTE_S_5', lane: 'keynote', startBeat: 6, durationBeats: 1, label: `${pattern.name} 힙 복귀`, color: '#FF865E', targetZones: [hp], payload: { part: 'hip', patternId: pattern.id } },
        { id: 'NOTE_S_6', lane: 'keynote', startBeat: 7, durationBeats: 1, label: `${pattern.name} 양손 수렴`, color: '#28E6FF', targetZones: [lh], payload: { part: 'leftHand', patternId: pattern.id } },
        { id: 'NOTE_S_7', lane: 'keynote', startBeat: 8, durationBeats: 1, label: `${pattern.name} 피니시`, color: '#28E6FF', targetZones: [4], payload: { part: 'leftHand', patternId: pattern.id } },
      );
    } else {
      for (let i = 0; i < 7; i++) {
        const beat = i + 2;
        const isOdd = i % 2 === 0;
        previewNotes.push({
          id: `NOTE_S_${i + 1}`,
          lane: 'keynote',
          startBeat: beat,
          durationBeats: 1,
          label: `${pattern.name} ${isOdd ? '왼손' : '오른손'}`,
          color: isOdd ? '#28E6FF' : '#FFCB4D',
          targetZones: [isOdd ? lh : rh],
          payload: { part: isOdd ? 'leftHand' : 'rightHand', patternId: pattern.id },
        });
      }
    }

    let diffCount = 0;
    for (let i = 0; i < Math.max(currentNotes.length, previewNotes.length); i++) {
      const c = currentNotes[i];
      const p = previewNotes[i];
      if (!c || !p || c.targetZones[0] !== p.targetZones[0] || c.payload?.part !== p.payload?.part) {
        diffCount++;
      }
    }

    return {
      targetPhase,
      changed: diffCount > 0,
      diffCount,
      currentNotes,
      previewNotes,
    };
  }

  focusError(entityId: string, path: string): void {
    this._focusedEntityId = entityId;
    this._focusedErrorPath = path;
    this._selectedNoteId = entityId;
    this.notifyStateChange();
  }

  getFocusedError(): { entityId: string; path: string } | null {
    if (!this._focusedEntityId || !this._focusedErrorPath) {
      return null;
    }
    return {
      entityId: this._focusedEntityId,
      path: this._focusedErrorPath,
    };
  }

  clearFocusedError(): void {
    this._focusedEntityId = null;
    this._focusedErrorPath = null;
    this.notifyStateChange();
  }

  validateStarSlots(): {
    valid: boolean;
    ok: boolean;
    diagnostics: StarSlotValidationDiagnostic[];
    errors: StarSlotValidationDiagnostic[];
    warnings: StarSlotValidationDiagnostic[];
  } {
    const starNotes = this._sequenceEditor.getNotesForPhase('STAR_COLLECT');
    const errors: StarSlotValidationDiagnostic[] = [];
    const warnings: StarSlotValidationDiagnostic[] = [];

    if (starNotes.length !== 7) {
      errors.push({
        code: 'COUNT_LOCKED',
        message: `STAR_COLLECT 시퀀스는 정확히 7개 노트를 가져야 하지만 현재 ${starNotes.length}개입니다.`,
        severity: 'error',
      });
    }

    for (let idx = 0; idx < starNotes.length; idx++) {
      const note = starNotes[idx];
      const expectedBeat = idx + 2;
      const expectedTick = (idx + 1) * 480;
      const actualTick = Math.round((note.startBeat - 1) * 480);

      if (Math.abs(note.startBeat - expectedBeat) > 0.001 || actualTick !== expectedTick) {
        warnings.push({
          code: 'NON_STANDARD_SLOT_TIMING',
          entityId: note.id,
          path: 'landingTick',
          message: `노트 ${note.id}의 착지 박자(${note.startBeat}박, tick ${actualTick})는 표준 고정 슬롯 ${idx + 1}(${expectedBeat}박, tick ${expectedTick})과 일치하지 않습니다. (보존됨)`,
          severity: 'warning',
        });
      }

      const part = note.payload?.part;
      const zoneId = note.targetZones[0];
      if (part === 'head' || part === 'hip') {
        warnings.push({
          code: 'NON_STANDARD_STAR_TARGET',
          entityId: note.id,
          path: 'target.part',
          message: `노트 ${note.id}의 타겟 ${part}은 초기 V2 프로필에서 지원되지 않는 레거시 커서입니다.`,
          severity: 'warning',
        });
      } else if (part === 'leftHand' || part === 'rightHand') {
        if (zoneId < 1 || zoneId > 5) {
          warnings.push({
            code: 'NON_STANDARD_STAR_TARGET',
            entityId: note.id,
            path: 'target.zoneId',
            message: `노트 ${note.id}의 손 타겟 존(${zoneId})이 1~5 범위를 벗어납니다.`,
            severity: 'warning',
          });
        }
      } else if (part === 'foot') {
        if (zoneId < 9 || zoneId > 11) {
          warnings.push({
            code: 'NON_STANDARD_STAR_TARGET',
            entityId: note.id,
            path: 'target.zoneId',
            message: `노트 ${note.id}의 발 타겟 존(${zoneId})이 9~11 범위를 벗어납니다.`,
            severity: 'warning',
          });
        }
      }
    }

    const diagnostics = [...errors, ...warnings];
    return {
      valid: errors.length === 0,
      ok: errors.length === 0,
      diagnostics,
      errors,
      warnings,
    };
  }

  setBpm(bpm: number): void {
    const clamped = Math.max(40, Math.min(240, Math.round(bpm)));
    this._bpm = clamped;
    this.notifyDocumentChange();
    this.notifyStateChange();
  }

  setSelectedPhase(phase: PhaseType): void {
    this._selectedPhase = phase;
    const maxBeats = this.getTimelineTotalBeats(phase);
    if (this._currentBeat > maxBeats) {
      this._currentBeat = maxBeats;
      this.notifyBeatUpdate(this._currentBeat);
    }
    this.notifyPhaseChange(phase);
    this.notifyStateChange();
  }

  getCurrentPhaseRoutine(): EditorPhaseRoutineInfo {
    switch (this._selectedPhase) {
      case 'RUN_QUESTION':
        return {
          phase: 'RUN_QUESTION',
          beats: QUESTION_PHASE_ROUTINE.beats,
          prompt: QUESTION_PHASE_ROUTINE.prompt,
          routine: QUESTION_PHASE_ROUTINE,
          branchDuration: QUESTION_PHASE_ROUTINE.beats,
          noteCount: QUESTION_PHASE_ROUTINE.notes.length,
        };
      case 'ANSWER_SELECT':
        return {
          phase: 'ANSWER_SELECT',
          beats: ANSWER_PHASE_ROUTINE.maxBeats,
          prompt: ANSWER_PHASE_ROUTINE.prompt,
          routine: ANSWER_PHASE_ROUTINE,
          branchDuration: ANSWER_PHASE_ROUTINE.maxBeats,
          noteCount: ANSWER_PHASE_ROUTINE.choices.length,
        };
      case 'STAR_COLLECT':
        return {
          phase: 'STAR_COLLECT',
          beats: 8, // #382: 노트 수 7과 분기 전체 길이 8박 명확한 분리
          prompt: STAR_COLLECT_ROUTINE.prompt,
          routine: STAR_COLLECT_ROUTINE,
          branchDuration: 8,
          noteCount: STAR_COLLECT_ROUTINE.notes.length,
        };
      case 'FEVER_PHASE_B':
        return {
          phase: 'FEVER_PHASE_B',
          beats: FEVER_PHASE_B_ROUTINE.totalBeats,
          prompt: '16박 풀루프 안무 루틴 (4가지 핵심 안무 순환)',
          routine: FEVER_PHASE_B_ROUTINE,
          branchDuration: FEVER_PHASE_B_ROUTINE.totalBeats,
          noteCount: FEVER_PHASE_B_ROUTINE.patterns.length,
        };
    }
  }

  /**
   * 지정된 페이즈의 타임라인 총 비트 수 반환 (#382)
   */
  getTimelineTotalBeats(phase?: PhaseType): number {
    const target = phase ?? this._selectedPhase;
    switch (target) {
      case 'RUN_QUESTION':
        return 8;
      case 'ANSWER_SELECT':
        return 2;
      case 'STAR_COLLECT':
        return 8;
      case 'FEVER_PHASE_B':
        return 16;
    }
  }

  /**
   * 1-based 표시 박자 -> 0-based 상대 틱(480 ticks/beat) 변환 (#382)
   */
  beatToTick(beat: number, ticksPerBeat = 480): number {
    return Math.max(0, Math.round((beat - 1) * ticksPerBeat));
  }

  /**
   * 0-based 상대 틱 -> 1-based 표시 박자 변환 (#382)
   */
  tickToBeat(tick: number, ticksPerBeat = 480): number {
    return Math.round(((tick / ticksPerBeat) + 1) * 1000) / 1000;
  }

  /**
   * 1-based 표시 박자 -> 0-based 오디오 비트 변환 (#382)
   */
  displayBeatToAudioBeat(displayBeat: number): number {
    return Math.round((displayBeat - 1) * 1000) / 1000;
  }

  /**
   * 0-based 오디오 비트 -> 1-based 표시 박자 변환 (#382)
   */
  audioBeatToDisplayBeat(audioBeat: number): number {
    return Math.round((audioBeat + 1) * 1000) / 1000;
  }

  /**
   * 0-based 오디오 비트 -> 0-based 상대 틱 변환 (#382)
   */
  audioBeatToTick(audioBeat: number, ticksPerBeat = 480): number {
    return Math.max(0, Math.round(audioBeat * ticksPerBeat));
  }

  /**
   * 0-based 상대 틱 -> 0-based 오디오 비트 변환 (#382)
   */
  tickToAudioBeat(tick: number, ticksPerBeat = 480): number {
    return Math.round((tick / ticksPerBeat) * 1000) / 1000;
  }

  play(): void {
    if (!this._isPlaying) {
      this._isPlaying = true;
      this.notifyPlayStateChange(true);
      this.notifyStateChange();
    }
  }

  pause(): void {
    if (this._isPlaying) {
      this._isPlaying = false;
      this.notifyPlayStateChange(false);
      this.notifyStateChange();
    }
  }

  togglePlay(): void {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seekBeat(beat: number): void {
    const maxBeats = this.getTimelineTotalBeats(this._selectedPhase);
    const clamped = Math.max(0, Math.min(maxBeats, beat));
    this._currentBeat = clamped;
    this.notifyBeatUpdate(clamped);
  }

  addListener(listener: EditorListener): void {
    this._listeners.add(listener);
  }

  removeListener(listener: EditorListener): void {
    this._listeners.delete(listener);
  }

  private notifyDocumentChange(): void {
    for (const listener of this._listeners) {
      listener.onDocumentChange?.();
    }
  }

  private notifyStateChange(): void {
    for (const listener of this._listeners) {
      listener.onStateChange?.();
    }
  }

  private notifyPatternChange(pattern: CatChoreoPattern | null): void {
    for (const listener of this._listeners) {
      listener.onPatternChange?.(pattern);
    }
  }

  private notifyPhaseChange(phase: PhaseType): void {
    for (const listener of this._listeners) {
      listener.onPhaseChange?.(phase);
    }
  }

  private notifyPlayStateChange(isPlaying: boolean): void {
    for (const listener of this._listeners) {
      listener.onPlayStateChange?.(isPlaying);
    }
  }

  private notifyBeatUpdate(beat: number): void {
    for (const listener of this._listeners) {
      listener.onBeatUpdate?.(beat);
    }
  }

  getCurrentProject(): EditorProject {
    return this.commandManager.project;
  }

  toEditorProject(): EditorProject {
    const starNotes = this._sequenceEditor.getNotesForPhase('STAR_COLLECT');
    const runNotes = this._sequenceEditor.getNotesForPhase('RUN_QUESTION');
    const ansNotes = this._sequenceEditor.getNotesForPhase('ANSWER_SELECT');
    const feverNotes = this._sequenceEditor.getNotesForPhase('FEVER_PHASE_B');

    const patterns: EditorPattern[] = this._registry.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      target: {
        leftHand: p.leftHand ?? null,
        rightHand: p.rightHand ?? null,
        head: p.head ?? null,
        hip: p.hip ?? null,
      },
      description: p.description,
    }));

    const starEvents: StarNoteEvent[] = starNotes.map((n, idx) => {
      const landingTick = Math.max(0, Math.round((n.startBeat - 1) * 480));
      const rawPart = n.payload?.part;
      const isFoot =
        rawPart === 'foot' ||
        n.payload?.targetType === 'foot' ||
        (rawPart === 'hip' && n.targetZones[0] !== undefined && n.targetZones[0] >= 9);
      const cursorPart: BodyCursorPart =
        rawPart === 'leftHand' || rawPart === 'rightHand' || rawPart === 'head' || rawPart === 'hip'
          ? rawPart
          : n.targetZones[0] >= 6
          ? 'hip'
          : 'leftHand';
      const zoneId = n.targetZones[0] ?? 4;
      const footKind = zoneId === 9 ? 'leftFoot' : zoneId === 11 ? 'rightFoot' : 'centerFoot';
      const footZone = (zoneId >= 9 && zoneId <= 11 ? zoneId : 10) as 9 | 10 | 11;

      return {
        id: n.id || `star_evt_${idx + 1}`,
        landingTick,
        target: isFoot
          ? {
              type: 'foot' as const,
              foot: footKind,
              zoneId: footZone,
            }
          : {
              type: 'cursor' as const,
              part: cursorPart,
              zoneId,
            },
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

    const ansEvents: MotionCueEvent[] = ansNotes.map((n, idx) => {
      const startTick = Math.max(0, Math.round((n.startBeat - 1) * 480));
      const durationTicks = Math.max(480, Math.round((n.durationBeats || 1) * 480));
      return {
        id: n.id || `mot_ans_${idx + 1}`,
        startTick,
        durationTicks,
        target: {
          leftHand: n.targetZones[0] === 4 ? 4 : null,
          rightHand: n.targetZones[0] === 5 ? 5 : null,
          head: null,
          hip: null,
        },
        sourcePatternId: n.payload?.patternId,
      };
    });

    const feverEvents: MotionCueEvent[] = feverNotes.map((n, idx) => {
      const startTick = Math.max(0, Math.round((n.startBeat - 1) * 480));
      const durationTicks = Math.max(480, Math.round((n.durationBeats || 1) * 480));
      return {
        id: n.id || `mot_fever_${idx + 1}`,
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
    });

    const sequences: EditorSequence[] = [
      {
        id: this._starSequenceId || 'seq_phaseA_star',
        phase: 'phaseA',
        kind: 'starNotes',
        events: starEvents,
      },
      {
        id: 'seq_phaseA_motion',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: runEvents,
      },
      {
        id: 'seq_phaseA_answer',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: ansEvents,
      },
      {
        id: 'seq_phaseB_motion',
        phase: 'phaseB',
        kind: 'motionGuide',
        events: feverEvents,
      },
      ...this._customSequences,
    ];

    const bindings: EditorBinding[] = this._bindings.map((b) => ({ ...b }));

    const now = new Date().toISOString();
    return {
      kind: 'dream-guardian-authoring-project',
      schemaVersion: 2,
      projectId: this._currentProjectId,
      revision: this._commandManager ? this._commandManager.revision : this._revision,
      rulesetId: this._rulesetId || 'dg-ruleset-v2',
      metadata: {
        ...this._metadata,
        updatedAt: now,
      },
      previewTempo: {
        bpm: this._bpm,
        beatsPerBar: 4,
      },
      patterns,
      sequences,
      bindings,
    };
  }

  applyProject(project: EditorProject, options?: { skipCommand?: boolean }): void {
    this._isApplyingProject = true;
    try {
      this._currentProjectId = project.projectId;
      this._bpm = project.previewTempo?.bpm ?? 95;
      if (project.rulesetId) {
        this._rulesetId = project.rulesetId;
      }
      if (project.metadata) {
        this._metadata = {
          title: project.metadata.title || 'Dream Guardian Dance Editor',
          description: project.metadata.description,
          author: project.metadata.author,
          createdAt: project.metadata.createdAt || new Date().toISOString(),
          updatedAt: project.metadata.updatedAt || new Date().toISOString(),
        };
      }
      if (project.bindings && Array.isArray(project.bindings)) {
        this._bindings = project.bindings.map((b) => ({ ...b }));
      }
      const handledSeqIds = new Set<string>([
        'seq_phaseA_star',
        this._starSequenceId,
        'seq_phaseA_motion',
        'seq_phaseA_answer',
        'seq_phaseB_motion',
      ]);
      for (const seq of project.sequences || []) {
        if (
          (seq.phase === 'phaseA' && (seq.kind === 'starNotes' || seq.kind === 'motionGuide')) ||
          (seq.phase === 'phaseB' && seq.kind === 'motionGuide')
        ) {
          handledSeqIds.add(seq.id);
        }
      }
      this._customSequences = (project.sequences || [])
        .filter((s) => !handledSeqIds.has(s.id))
        .map((s) => deepClone(s));

      // 1. Patterns replacement
      this._registry.clear();
      for (const p of project.patterns) {
        const choreo: CatChoreoPattern = {
          id: p.id,
          name: p.name || p.id,
          description: p.description || '',
          motionType: 'center_clasp',
          leftHand: p.target.leftHand ?? null,
          rightHand: p.target.rightHand ?? null,
          head: p.target.head ?? null,
          hip: p.target.hip ?? null,
          footZones: [],
          partZoneMap: {},
        };
        this._registry.register(choreo);
      }
      if (project.patterns.length > 0) {
        this._selectedPatternId = project.patterns[0].id;
      } else {
        this._selectedPatternId = '';
      }
      this._draftEdits = {};

      // 2. Sequences replacement
      const newStarNotes: TimelineTrackNote[] = [];
      const newRunNotes: TimelineTrackNote[] = [];
      const newAnsNotes: TimelineTrackNote[] = [];
      const newFeverNotes: TimelineTrackNote[] = [];

      for (const seq of project.sequences) {
        if (seq.phase === 'phaseA' && seq.kind === 'starNotes') {
          if (seq.id) {
            this._starSequenceId = seq.id;
          }
          for (let idx = 0; idx < seq.events.length; idx++) {
            const ev = seq.events[idx] as StarNoteEvent;
            const landingTick = ev.landingTick ?? ev.tick ?? 480;
            const startBeat = Math.round(((landingTick / 480) + 1) * 1000) / 1000;
            const isFoot = ev.target?.type === 'foot';
            const part = isFoot ? 'foot' : (ev.target?.type === 'cursor' ? ev.target.part : undefined);
            const rawZone = (ev.target as any)?.zoneId ?? (ev.target as any)?.zone;
            const targetZones = rawZone !== undefined && rawZone !== null ? [rawZone] : [];
            newStarNotes.push({
              id: ev.id || `star_evt_${idx + 1}`,
              lane: 'keynote',
              startBeat,
              durationBeats: 1,
              label: isFoot ? 'Star (발)' : `Star (${part ?? 'note'})`,
              color: isFoot ? '#10B981' : (part === 'hip' ? '#FF865E' : (part === 'rightHand' ? '#FFCB4D' : '#28E6FF')),
              targetZones,
              payload: {
                part: isFoot ? 'foot' : part,
                targetType: isFoot ? 'foot' : 'cursor',
                patternId: ev.sourcePatternId,
              },
            });
          }
        } else if (seq.phase === 'phaseA' && seq.kind === 'motionGuide') {
          const isAnswer = seq.id.toLowerCase().includes('answer');
          for (let idx = 0; idx < seq.events.length; idx++) {
            const ev = seq.events[idx] as MotionCueEvent;
            const startTick = ev.startTick ?? ev.tick ?? 0;
            const startBeat = Math.round(((startTick / 480) + 1) * 100) / 100;
            const durTicks = ev.durationTicks ?? ev.duration ?? 480;
            const durationBeats = Math.round((durTicks / 480) * 100) / 100;
            const targetZones: number[] = [];
            if (ev.target?.leftHand) targetZones.push(ev.target.leftHand);
            if (ev.target?.rightHand) targetZones.push(ev.target.rightHand);
            if (ev.target?.hip) targetZones.push(ev.target.hip);
            if (ev.target?.head) targetZones.push(ev.target.head);

            const noteItem: TimelineTrackNote = {
              id: ev.id || `${isAnswer ? 'ans' : 'mot'}_evt_${idx + 1}`,
              lane: isAnswer ? 'answer' : 'motion',
              startBeat,
              durationBeats,
              label: isAnswer ? '답안 선택' : '모션 가이드',
              color: isAnswer ? '#FFCB4D' : '#28E6FF',
              targetZones,
              payload: {
                ...ev.target,
                patternId: ev.sourcePatternId,
              },
            };
            if (isAnswer) {
              newAnsNotes.push(noteItem);
            } else {
              newRunNotes.push(noteItem);
            }
          }
        } else if (seq.phase === 'phaseB' && seq.kind === 'motionGuide') {
          for (let idx = 0; idx < seq.events.length; idx++) {
            const ev = seq.events[idx] as MotionCueEvent;
            const startTick = ev.startTick ?? ev.tick ?? 0;
            const startBeat = Math.round(((startTick / 480) + 1) * 100) / 100;
            const durTicks = ev.durationTicks ?? ev.duration ?? 480;
            const durationBeats = Math.round((durTicks / 480) * 100) / 100;
            const targetZones: number[] = [];
            if (ev.target?.leftHand) targetZones.push(ev.target.leftHand);
            if (ev.target?.rightHand) targetZones.push(ev.target.rightHand);
            if (ev.target?.hip) targetZones.push(ev.target.hip);
            if (ev.target?.head) targetZones.push(ev.target.head);

            newFeverNotes.push({
              id: ev.id || `fever_evt_${idx + 1}`,
              lane: 'motion',
              startBeat,
              durationBeats,
              label: '피버 모션',
              color: '#C889FF',
              targetZones,
              payload: {
                ...ev.target,
                patternId: ev.sourcePatternId,
              },
            });
          }
        }
      }

      this._sequenceEditor.replaceNotesForPhase('RUN_QUESTION', newRunNotes);
      this._sequenceEditor.replaceNotesForPhase('ANSWER_SELECT', newAnsNotes);
      this._sequenceEditor.replaceNotesForPhase('STAR_COLLECT', newStarNotes);
      this._sequenceEditor.replaceNotesForPhase('FEVER_PHASE_B', newFeverNotes);

      this.notifyPatternChange(this.getSelectedPattern());

      if (!options?.skipCommand && this._commandManager) {
        this._commandManager.executeCommand(new ReplaceProjectCommand(project));
      }
    } finally {
      this._isApplyingProject = false;
    }
  }
}
