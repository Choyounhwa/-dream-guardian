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
  type CommandExecutionResult,
} from './ProjectCommands.js';
import {
  EditorHistoryManager,
  type EditorHistoryHost,
  type StageCoverageStatusKind,
  type StageCoverageItem,
  type StageCoverageReport,
  type ProjectPublicationStatus,
  type BindingValidationResult,
  type BossClimaxDiagnosisResult,
  DEFAULT_EDITOR_BINDINGS,
} from './EditorHistoryManager.js';
import type {
  EditorProject,
  EditorSequence,
  EditorBinding,
  EditorProjectMetadata,
} from '../data/EditorProject.js';
import {
  scaleHazardSchedule,
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';
import {
  DEFAULT_BOSS_HAZARD_CONFIG,
} from '../../config/battle.config.js';
import {
  isPublishableHandZone,
  isPublishableFootZone,
  checkCrossBodyConstraint,
  PHASE_B_PUBLISHABLE_ATTACKS,
  PHASE_B_ATTACK_REQUIRED_ACTIONS,
  getRequiredActionForPhaseBAttack,
  type PhaseBPublishableAttack,
  type PhaseBRequiredAction,
} from '../data/ContentCapabilities.js';

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

export type {
  StageCoverageStatusKind,
  StageCoverageItem,
  StageCoverageReport,
  ProjectPublicationStatus,
  BindingValidationResult,
  BossClimaxDiagnosisResult,
};

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
  diagnostics?: StarSlotValidationDiagnostic[] | FeverSlotValidationDiagnostic[];
  isDirty?: boolean;
}

export type FeverSlotLockCode =
  | 'LOCKED_INPUT_CAPABILITY'
  | 'FIXED_SLOT_LANDING'
  | 'COUNT_LOCKED'
  | 'CROSS_BODY_VIOLATION'
  | 'INVALID_ZONE';

export interface FeverSlotValidationDiagnostic {
  code: FeverSlotLockCode | string;
  message: string;
  path?: string;
  entityId?: string;
  severity: 'error' | 'warning';
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
  totalBeats?: number;
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

export class EditorState implements EditorHistoryHost {
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
  private _hazardSequenceId: string = 'seq_phaseA_hazard';
  private _hazardEventId: string = 'evt_phaseA_hazard_1';
  private _phaseAHazardPattern: PhaseAHazardPattern = 'left_step';
  private _feverSequenceId: string = 'seq_phaseB_fever';
  private _feverSlots: FeverSlotItem[] = [];
  private _feverFormBuffer: Map<number, FormBufferEntry> = new Map();
  private _phaseBHazardSequenceId: string = 'seq_phaseB_hazard';
  private _phaseBHazardAttacks: PhaseBHazardAttackItem[] = [];
  private _phaseBHazardAttackCounter: number = 1;
  private _bindings: EditorBinding[] = DEFAULT_EDITOR_BINDINGS.map((b) => ({ ...b }));
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
  private readonly _historyManager: EditorHistoryManager;

  constructor(
    initialRegistry?: DancePatternRegistry,
    initialSequenceEditor?: PhaseSequenceEditor,
    commandManager?: ProjectCommandManager
  ) {
    this._registry = initialRegistry ?? new DancePatternRegistry(EXTENDED_CAT_CHOREO_PATTERNS);
    this._sequenceEditor = initialSequenceEditor ?? new PhaseSequenceEditor();
    this.initDefaultFeverSlots();
    this.initDefaultPhaseBHazardAttacks();
    this._historyManager = new EditorHistoryManager(this, commandManager);
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
    return this.hasCommandManager ? this.commandManager.revision : this._revision;
  }

  get currentRevision(): number {
    return this.commandManager.revision;
  }

  get metadata(): EditorProjectMetadata {
    return deepClone(this._metadata);
  }

  get projectTitle(): string {
    return this._metadata.title;
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

  get historyManager(): EditorHistoryManager {
    return this._historyManager;
  }

  get hasCommandManager(): boolean {
    return this._historyManager.hasCommandManager;
  }

  get commandManager(): ProjectCommandManager {
    return this._historyManager.commandManager;
  }

  undo(): CommandExecutionResult {
    return this._historyManager.undo();
  }

  redo(): CommandExecutionResult {
    return this._historyManager.redo();
  }

  canUndo(): boolean {
    return this._historyManager.canUndo();
  }

  canRedo(): boolean {
    return this._historyManager.canRedo();
  }

  getBindings(): EditorBinding[] {
    return this._historyManager.getBindings();
  }

  setBindings(bindings: EditorBinding[]): void {
    this._historyManager.setBindings(bindings);
  }

  getSequences(): EditorSequence[] {
    return this._historyManager.getSequences();
  }

  addCustomSequence(seq: EditorSequence): void {
    this._historyManager.addCustomSequence(seq);
  }

  buildExportProject(): EditorProject {
    return this._historyManager.buildExportProject();
  }

  validateBinding(
    binding: EditorBinding,
    options?: { excludeIndex?: number }
  ): BindingValidationResult {
    return this._historyManager.validateBinding(binding, options);
  }

  addBinding(binding: EditorBinding): { success: boolean; error?: string; errors?: string[]; diagnosticCode?: string } {
    return this._historyManager.addBinding(binding);
  }

  updateBinding(
    index: number,
    updated: EditorBinding
  ): { success: boolean; error?: string; errors?: string[]; diagnosticCode?: string } {
    return this._historyManager.updateBinding(index, updated);
  }

  removeBinding(target: number | string | Partial<EditorBinding>): boolean {
    return this._historyManager.removeBinding(target);
  }

  cloneProject(newProjectId?: string): EditorProject {
    return this._historyManager.cloneProject(newProjectId);
  }

  newProject(options?: { title?: string; projectId?: string }): EditorProject {
    return this._historyManager.newProject(options);
  }

  getProjectPublicationStatus(): ProjectPublicationStatus {
    return this._historyManager.getProjectPublicationStatus();
  }

  markSaved(revision?: number): void {
    this._historyManager.markSaved(revision);
  }

  markPublished(revision?: number): void {
    this._historyManager.markPublished(revision);
  }

  markUnpublished(): void {
    this._historyManager.markUnpublished();
  }

  getStageBuiltinProfiles(): Record<string, string> {
    return this._historyManager.getStageBuiltinProfiles();
  }

  setStageBuiltinProfile(chapterId: string, profileId: string | null): void {
    this._historyManager.setStageBuiltinProfile(chapterId, profileId);
  }

  diagnoseBossClimaxBindings(chapterId: string): BossClimaxDiagnosisResult {
    return this._historyManager.diagnoseBossClimaxBindings(chapterId);
  }

  getStageCoverageReport(requiredStages?: string[]): StageCoverageReport {
    return this._historyManager.getStageCoverageReport(requiredStages);
  }

  getStageCoverageStatus(requiredStages?: string[]): StageCoverageReport {
    return this._historyManager.getStageCoverageStatus(requiredStages);
  }

  get starSequenceId(): string { return this._starSequenceId; }
  get hazardSequenceId(): string { return this._hazardSequenceId; }
  get hazardEventId(): string { return this._hazardEventId; }
  get phaseAHazardPattern(): PhaseAHazardPattern { return this._phaseAHazardPattern; }
  get feverSequenceId(): string { return this._feverSequenceId; }
  get feverSlots(): FeverSlotItem[] { return this._feverSlots; }
  get phaseBHazardSequenceId(): string { return this._phaseBHazardSequenceId; }
  get phaseBHazardAttacks(): PhaseBHazardAttackItem[] { return this._phaseBHazardAttacks; }
  get phaseBHazardAttackCounter(): number { return this._phaseBHazardAttackCounter; }
  get bindings(): EditorBinding[] { return this._bindings; }
  get customSequences(): EditorSequence[] { return this._customSequences; }
  get stageBuiltinProfiles(): Record<string, string> { return this._stageBuiltinProfiles; }
  get lastSavedRevision(): number { return this._lastSavedRevision; }
  get isPublished(): boolean { return this._isPublished; }
  get publishedRevision(): number | null { return this._publishedRevision; }
  get rulesetId(): string { return this._rulesetId; }

  setCurrentProjectId(id: string): void { this._currentProjectId = id; }
  setRawBpm(bpm: number): void { this._bpm = bpm; }
  setRulesetId(id: string): void { this._rulesetId = id; }
  setMetadata(meta: EditorProjectMetadata): void { this._metadata = meta; }
  setRevision(rev: number): void { this._revision = rev; }
  setLastSavedRevision(rev: number): void { this._lastSavedRevision = rev; }
  setIsPublished(pub: boolean): void { this._isPublished = pub; }
  setPublishedRevision(rev: number | null): void { this._publishedRevision = rev; }
  setStarSequenceId(id: string): void { this._starSequenceId = id; }
  setHazardSequenceId(id: string): void { this._hazardSequenceId = id; }
  setHazardEventId(id: string): void { this._hazardEventId = id; }
  setRawPhaseAHazardPattern(pattern: PhaseAHazardPattern): void { this._phaseAHazardPattern = pattern; }
  setFeverSequenceId(id: string): void { this._feverSequenceId = id; }
  setFeverSlots(slots: FeverSlotItem[]): void { this._feverSlots = slots; }
  setRawPhaseBHazardSequenceId(id: string): void { this._phaseBHazardSequenceId = id; }
  setRawPhaseBHazardAttacks(attacks: PhaseBHazardAttackItem[]): void { this._phaseBHazardAttacks = attacks; }
  setPhaseBHazardAttackCounter(cnt: number): void { this._phaseBHazardAttackCounter = cnt; }
  setRawBindings(bindings: EditorBinding[]): void { this._bindings = bindings; }
  setCustomSequences(sequences: EditorSequence[]): void { this._customSequences = sequences; }
  setStageBuiltinProfiles(profiles: Record<string, string>): void { this._stageBuiltinProfiles = profiles; }
  setIsApplyingProject(applying: boolean): void { this._isApplyingProject = applying; }
  clearFormBuffers(): void { this._formBuffer.clear(); this._feverFormBuffer.clear(); }

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

  // ==========================================
  // Issue #398: FEVER_NOTES 8-Slot Editor API
  // ==========================================

  initDefaultFeverSlots(): void {
    const slots: FeverSlotItem[] = [];
    for (let idx = 0; idx < 8; idx++) {
      const slotNumber = idx + 1;
      const beat = idx + 1;
      const tick = (idx + 1) * 480;
      const isEven = idx % 2 === 0;
      slots.push({
        slotIndex: idx,
        slotNumber,
        beat,
        tick,
        noteId: `NOTE_F_${slotNumber}`,
        part: isEven ? 'leftHand' : 'rightHand',
        zoneId: isEven ? 4 : 5,
        label: isEven ? '피버 좌도달' : '피버 우도달',
        color: isEven ? '#28E6FF' : '#FFCB4D',
        isStandard: true,
      });
    }
    this._feverSlots = slots;
  }

  getFeverSlots(): FeverSlotItem[] {
    if (this._feverSlots.length === 0) {
      this.initDefaultFeverSlots();
    }
    return this._feverSlots.map((s) => ({ ...s }));
  }

  canModifyFeverNoteCount(): boolean {
    return false;
  }

  validateFeverSlot(
    slotIndex: number,
    patch: {
      part?: BodyCursorPart | 'foot';
      zoneId?: number;
      patternId?: string;
      beat?: number;
      tick?: number;
      landingTick?: number;
    }
  ): FeverSlotValidationResult {
    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 8
        ? slotIndex
        : Math.max(0, Math.min(7, slotIndex));
    const expectedBeat = normalizedIndex + 1;
    const expectedTick = (normalizedIndex + 1) * 480;

    // 1. Timing Lock (고정 480틱 간격)
    if (
      (patch.landingTick !== undefined && patch.landingTick !== expectedTick) ||
      (patch.beat !== undefined && Math.abs(patch.beat - expectedBeat) > 0.001) ||
      (patch.tick !== undefined && patch.tick !== expectedTick)
    ) {
      return {
        valid: false,
        lockCode: 'FIXED_SLOT_LANDING',
        lockReason: `피버 노트 착지 타이밍은 슬롯 ${normalizedIndex + 1}의 ${expectedBeat}박(${expectedTick} tick)으로 고정되어 있습니다. (FIXED_SLOT_LANDING)`,
        diagnostics: [
          {
            code: 'FIXED_SLOT_LANDING',
            path: 'landingTick',
            entityId: `NOTE_F_${normalizedIndex + 1}`,
            message: `Fever note timing is fixed to beat ${expectedBeat} (${expectedTick} ticks).`,
            severity: 'error',
          },
        ],
      };
    }

    // 2. Head & Hip Lock
    if (patch.part === 'head' || patch.part === 'hip') {
      return {
        valid: false,
        lockCode: 'LOCKED_INPUT_CAPABILITY',
        lockReason: '피버 노트는 머리(head) 및 골반(hip) 커서가 잠겨 있습니다. 손(leftHand/rightHand 1~5) 또는 발(foot 9~11)만 지원됩니다. (LOCKED_INPUT_CAPABILITY)',
        diagnostics: [
          {
            code: 'LOCKED_INPUT_CAPABILITY',
            path: 'target.part',
            entityId: `NOTE_F_${normalizedIndex + 1}`,
            message: `Fever target part "${patch.part}" is locked in initial V2 profile.`,
            severity: 'error',
          },
        ],
      };
    }

    const currentSlots = this.getFeverSlots();
    const currentSlot = currentSlots[normalizedIndex];
    const targetPart = patch.part ?? currentSlot?.part ?? 'leftHand';
    const targetZone = patch.zoneId ?? currentSlot?.zoneId ?? 4;

    // 3. Hand Zone Capability
    if (targetPart === 'leftHand' || targetPart === 'rightHand') {
      if (targetZone < 1 || targetZone > 5) {
        return {
          valid: false,
          lockCode: 'LOCKED_INPUT_CAPABILITY',
          lockReason: '손(hand) 타겟 존은 초기 V2 프로필에서 1~5 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          diagnostics: [
            {
              code: 'LOCKED_INPUT_CAPABILITY',
              path: 'target.zoneId',
              entityId: `NOTE_F_${normalizedIndex + 1}`,
              message: 'Hand target zone must be between 1 and 5 in initial V2 profile.',
              severity: 'error',
            },
          ],
        };
      }

      // 4. Cross-Body constraint
      const crossCheck = checkCrossBodyConstraint(targetPart, targetZone, null);
      if (!crossCheck.valid) {
        return {
          valid: false,
          lockCode: 'CROSS_BODY_VIOLATION',
          lockReason: crossCheck.reason || '신체 물리 제약 위반 (Cross-Body)',
          diagnostics: [
            {
              code: 'CROSS_BODY_VIOLATION',
              path: 'target.zoneId',
              entityId: `NOTE_F_${normalizedIndex + 1}`,
              message: crossCheck.reason || 'Cross-body constraint violation',
              severity: 'error',
            },
          ],
        };
      }

      if (!isPublishableHandZone(targetPart, targetZone)) {
        return {
          valid: false,
          lockCode: 'LOCKED_INPUT_CAPABILITY',
          lockReason: `손(${targetPart}) 타겟 존은 초기 V2 프로필에서 지원되는 손 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)`,
          diagnostics: [
            {
              code: 'LOCKED_INPUT_CAPABILITY',
              path: 'target.zoneId',
              entityId: `NOTE_F_${normalizedIndex + 1}`,
              message: `Hand target zone ${targetZone} is not publishable for ${targetPart} in initial V2 profile.`,
              severity: 'error',
            },
          ],
        };
      }
    } else if (targetPart === 'foot') {
      if (!isPublishableFootZone(targetZone) || targetZone < 9 || targetZone > 11) {
        return {
          valid: false,
          lockCode: 'LOCKED_INPUT_CAPABILITY',
          lockReason: '발(foot) 타겟 존은 초기 V2 프로필에서 9~11 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          diagnostics: [
            {
              code: 'LOCKED_INPUT_CAPABILITY',
              path: 'target.zoneId',
              entityId: `NOTE_F_${normalizedIndex + 1}`,
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

  updateFeverSlot(
    slotIndex: number,
    patch: { part?: BodyCursorPart | 'foot'; zoneId?: number; patternId?: string }
  ): FeverSlotValidationResult {
    const valRes = this.validateFeverSlot(slotIndex, patch);
    if (!valRes.valid) {
      this.setFeverFormBuffer(slotIndex, {
        ...patch,
        errors: valRes.diagnostics.map((d) => d.message),
        diagnostics: valRes.diagnostics,
      });
      return valRes;
    }

    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 8
        ? slotIndex
        : Math.max(0, Math.min(7, slotIndex));
    const slots = this.getFeverSlots();
    const slot = slots[normalizedIndex];
    if (!slot) {
      return { valid: false, diagnostics: [] };
    }

    const newPart = patch.part ?? slot.part;
    const newZone = patch.zoneId ?? slot.zoneId;
    const isFoot = newPart === 'foot';
    let foot: 'leftFoot' | 'rightFoot' | 'centerFoot' | undefined;
    if (isFoot) {
      foot = newZone === 9 ? 'leftFoot' : (newZone === 11 ? 'rightFoot' : 'centerFoot');
    }

    this._feverSlots[normalizedIndex] = {
      ...slot,
      part: newPart,
      zoneId: newZone,
      foot,
      patternId: patch.patternId ?? slot.patternId,
      color: isFoot ? '#10B981' : (newPart === 'rightHand' ? '#FFCB4D' : '#28E6FF'),
    };

    this.clearFeverFormBuffer(normalizedIndex);
    this.notifyDocumentChange();
    this.notifyStateChange();

    return {
      valid: true,
      diagnostics: [],
    };
  }

  getFeverFormBuffer(slotIndex?: number): FormBufferEntry | undefined {
    if (slotIndex !== undefined) {
      const normalizedIndex =
        slotIndex >= 0 && slotIndex < 8
          ? slotIndex
          : Math.max(0, Math.min(7, slotIndex));
      return this._feverFormBuffer.get(normalizedIndex);
    }
    return undefined;
  }

  setFeverFormBuffer(slotIndex: number, entry: Partial<FormBufferEntry>): void {
    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 8
        ? slotIndex
        : Math.max(0, Math.min(7, slotIndex));
    const valRes = this.validateFeverSlot(normalizedIndex, entry as any);
    const existing = this._feverFormBuffer.get(normalizedIndex) ?? { slotIndex: normalizedIndex };
    const merged: FormBufferEntry = {
      ...existing,
      ...entry,
      slotIndex: normalizedIndex,
      errors: valRes.valid ? [] : valRes.diagnostics.map((d) => d.message),
      diagnostics: valRes.diagnostics,
      isDirty: true,
    };
    this._feverFormBuffer.set(normalizedIndex, merged);
    this.notifyStateChange();
  }

  clearFeverFormBuffer(slotIndex?: number): void {
    if (slotIndex !== undefined) {
      const normalizedIndex =
        slotIndex >= 0 && slotIndex < 8
          ? slotIndex
          : Math.max(0, Math.min(7, slotIndex));
      this._feverFormBuffer.delete(normalizedIndex);
    } else {
      this._feverFormBuffer.clear();
    }
    this.notifyStateChange();
  }

  applyFeverFormBuffer(slotIndex: number): FeverSlotValidationResult {
    const normalizedIndex =
      slotIndex >= 0 && slotIndex < 8
        ? slotIndex
        : Math.max(0, Math.min(7, slotIndex));
    const entry = this._feverFormBuffer.get(normalizedIndex);
    if (!entry) {
      return { valid: true, diagnostics: [] };
    }
    const valRes = this.validateFeverSlot(normalizedIndex, entry as any);
    if (!valRes.valid) {
      return valRes;
    }
    return this.updateFeverSlot(normalizedIndex, {
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

  // --- Phase A Hazard Methods (Issue #395 / EDITOR-HAZARD-A) ---

  getPhaseAHazardPattern(): PhaseAHazardPattern {
    return this._phaseAHazardPattern;
  }

  setPhaseAHazardPattern(pattern: string): { success: boolean; error?: string } {
    if (!PHASE_A_ACTIVE_HAZARD_PATTERNS.includes(pattern as PhaseAHazardPattern)) {
      if (pattern === 'balance_left' || pattern === 'balance_right') {
        return { success: false, error: '비활성 패턴(balance)은 잠겨 있어 선택할 수 없습니다.' };
      }
      return { success: false, error: `유효하지 않은 장판 회피 패턴입니다: ${pattern}` };
    }
    this._phaseAHazardPattern = pattern as PhaseAHazardPattern;
    const proj = this.toEditorProject();
    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(proj));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
    return { success: true };
  }

  getActivePhaseAHazardPatterns(): readonly PhaseAHazardPattern[] {
    return PHASE_A_ACTIVE_HAZARD_PATTERNS;
  }

  getLockedPhaseAHazardPatterns(): readonly string[] {
    return ['balance_left', 'balance_right'];
  }

  getPhaseAHazardDamage(): number {
    return DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss;
  }

  getPhaseAHazardSchedule(): PhaseAHazardScheduleDisplay {
    const spb = 60 / this._bpm;
    const scaled = scaleHazardSchedule(DEFAULT_PHASE_A_HAZARD_CONFIG, spb);
    return {
      bpm: this._bpm,
      secondsPerBeat: spb,
      damage: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss,
      warningDuration: scaled.warningDuration ?? 2.6,
      inputWindowEnd: scaled.inputWindowEnd ?? 3.4,
      judgmentTime: scaled.judgmentTime ?? 3.5,
      totalDuration: scaled.totalDuration ?? 4.0,
      warningDurationBeats: 5.2,
      inputWindowEndBeats: 6.8,
      judgmentTimeBeats: 7.0,
      totalDurationBeats: 8.0,
    };
  }

  getPhaseAHazardBinding(): EditorBinding | undefined {
    return this._bindings.find(
      (b) => b.phase === 'phaseA' && (b.sequenceId === this._hazardSequenceId || b.role === 'hazard'),
    );
  }

  setPhaseAHazardBinding(chapterId: string, subLevelId?: string | null): void {
    const existingIdx = this._bindings.findIndex(
      (b) => b.phase === 'phaseA' && (b.sequenceId === this._hazardSequenceId || b.role === 'hazard'),
    );
    const newBinding: EditorBinding = {
      chapterId,
      subLevelId: subLevelId ?? null,
      phase: 'phaseA',
      sequenceId: this._hazardSequenceId,
      role: 'hazard',
    };
    if (existingIdx >= 0) {
      this._bindings[existingIdx] = newBinding;
    } else {
      this._bindings.push(newBinding);
    }
    const proj = this.toEditorProject();
    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(proj));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
  }

  // --- Phase B Boss Hazard Methods (Issue #400 / EDITOR-HAZARD-B) ---

  initDefaultPhaseBHazardAttacks(): void {
    this._phaseBHazardAttacks = [
      { id: 'evt_phaseB_hz_1', attackType: 'dual_slam', requiredAction: 'jump' },
      { id: 'evt_phaseB_hz_2', attackType: 'alternating_stomp_left', requiredAction: 'left_step' },
      { id: 'evt_phaseB_hz_3', attackType: 'alternating_stomp_right', requiredAction: 'right_step' },
    ];
    this._phaseBHazardAttackCounter = 4;
  }

  getPhaseBHazardAttacks(): PhaseBHazardAttackItem[] {
    return this._phaseBHazardAttacks.map((a) => ({ ...a }));
  }

  getPhaseBHazardSequenceId(): string {
    return this._phaseBHazardSequenceId;
  }

  setPhaseBHazardSequenceId(id: string): void {
    this._phaseBHazardSequenceId = id;
    this.notifyDocumentChange();
    this.notifyStateChange();
  }

  getSupportedPhaseBAttacks(): readonly PhaseBPublishableAttack[] {
    return PHASE_B_PUBLISHABLE_ATTACKS;
  }

  getRequiredActionForPhaseBAttack(attack: string): PhaseBRequiredAction | null {
    if ((PHASE_B_PUBLISHABLE_ATTACKS as readonly string[]).includes(attack)) {
      return PHASE_B_ATTACK_REQUIRED_ACTIONS[attack as PhaseBPublishableAttack];
    }
    return null;
  }

  addPhaseBHazardAttack(
    attackType: PhaseBPublishableAttack,
    index?: number
  ): { success: boolean; error?: string } {
    if (!(PHASE_B_PUBLISHABLE_ATTACKS as readonly string[]).includes(attackType)) {
      return { success: false, error: `미지원 보스 공격 패턴입니다: ${attackType}` };
    }
    const requiredAction = getRequiredActionForPhaseBAttack(attackType);
    const id = `evt_phaseB_hz_${this._phaseBHazardAttackCounter++}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: PhaseBHazardAttackItem = { id, attackType, requiredAction };

    if (index !== undefined && index >= 0 && index <= this._phaseBHazardAttacks.length) {
      this._phaseBHazardAttacks.splice(index, 0, newItem);
    } else {
      this._phaseBHazardAttacks.push(newItem);
    }

    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
    return { success: true };
  }

  removePhaseBHazardAttack(index: number): { success: boolean; error?: string } {
    if (index < 0 || index >= this._phaseBHazardAttacks.length) {
      return { success: false, error: `유효하지 않은 공격 인덱스입니다: ${index}` };
    }
    this._phaseBHazardAttacks.splice(index, 1);
    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
    return { success: true };
  }

  movePhaseBHazardAttack(fromIndex: number, toIndex: number): { success: boolean; error?: string } {
    if (
      fromIndex < 0 ||
      fromIndex >= this._phaseBHazardAttacks.length ||
      toIndex < 0 ||
      toIndex >= this._phaseBHazardAttacks.length
    ) {
      return { success: false, error: '유효하지 않은 인덱스입니다.' };
    }
    const [moved] = this._phaseBHazardAttacks.splice(fromIndex, 1);
    this._phaseBHazardAttacks.splice(toIndex, 0, moved);
    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
    return { success: true };
  }

  duplicatePhaseBHazardAttack(index: number): { success: boolean; error?: string } {
    if (index < 0 || index >= this._phaseBHazardAttacks.length) {
      return { success: false, error: `유효하지 않은 인덱스입니다: ${index}` };
    }
    const src = this._phaseBHazardAttacks[index];
    const id = `evt_phaseB_hz_${this._phaseBHazardAttackCounter++}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: PhaseBHazardAttackItem = {
      id,
      attackType: src.attackType,
      requiredAction: src.requiredAction,
    };
    this._phaseBHazardAttacks.splice(index + 1, 0, newItem);
    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
    return { success: true };
  }

  setPhaseBHazardAttacks(
    attacks: Array<{ attackType: PhaseBPublishableAttack; requiredAction?: PhaseBRequiredAction } | PhaseBPublishableAttack>
  ): { success: boolean; error?: string } {
    for (const item of attacks) {
      const att = typeof item === 'string' ? item : item.attackType;
      if (!(PHASE_B_PUBLISHABLE_ATTACKS as readonly string[]).includes(att)) {
        return { success: false, error: `미지원 보스 공격 패턴입니다: ${att}` };
      }
    }
    const newAttacks: PhaseBHazardAttackItem[] = [];
    for (let i = 0; i < attacks.length; i++) {
      const item = attacks[i];
      const att = (typeof item === 'string' ? item : item.attackType) as PhaseBPublishableAttack;
      const requiredAction = getRequiredActionForPhaseBAttack(att);
      newAttacks.push({
        id: `evt_phaseB_hz_${this._phaseBHazardAttackCounter++}_${i + 1}`,
        attackType: att,
        requiredAction,
      });
    }
    this._phaseBHazardAttacks = newAttacks;
    if (this._historyManager.hasCommandManager) {
      this.commandManager.executeCommand(new ReplaceProjectCommand(this.toEditorProject()));
    }
    this.notifyDocumentChange();
    this.notifyStateChange();
    return { success: true };
  }

  validatePhaseBHazard(): PhaseBHazardValidationResult {
    if (this._phaseBHazardAttacks.length === 0) {
      return {
        valid: false,
        errors: ['Phase B 보스 공격 목록이 비어 있습니다. 최소 1개 이상의 공격 패턴이 필요합니다.'],
        diagnosticCode: 'empty-hazard-sequence',
      };
    }
    for (const item of this._phaseBHazardAttacks) {
      if (!(PHASE_B_PUBLISHABLE_ATTACKS as readonly string[]).includes(item.attackType)) {
        return {
          valid: false,
          errors: [`미지원 보스 공격 패턴이 포함되어 있습니다: ${item.attackType}`],
          diagnosticCode: 'non-publishable-attack-type',
        };
      }
    }
    return { valid: true, errors: [] };
  }

  getPhaseBHazardLockedConfig(): PhaseBHazardLockedConfig {
    return {
      attackInterval: DEFAULT_BOSS_HAZARD_CONFIG.attackInterval,
      warningDuration: DEFAULT_BOSS_HAZARD_CONFIG.warningDuration,
      activeDuration: DEFAULT_BOSS_HAZARD_CONFIG.activeDuration,
      damage: DEFAULT_BOSS_HAZARD_CONFIG.damage,
      enrageHpRatio: DEFAULT_BOSS_HAZARD_CONFIG.enrageHpRatio,
      enrageSpeedMultiplier: DEFAULT_BOSS_HAZARD_CONFIG.enrageSpeedMultiplier,
      minionCasualtyCount: DEFAULT_BOSS_HAZARD_CONFIG.minionCasualtyCount,
    };
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
          totalBeats: FEVER_PHASE_B_ROUTINE.totalBeats,
          prompt: '16박 풀루프 안무 루틴 (4가지 핵심 안무 순환)',
          routine: FEVER_PHASE_B_ROUTINE,
          branchDuration: FEVER_PHASE_B_ROUTINE.totalBeats,
          noteCount: FEVER_PHASE_B_ROUTINE.patterns.length,
        };
      case 'FEVER_NOTES':
        return {
          phase: 'FEVER_NOTES',
          beats: 8,
          totalBeats: 8,
          prompt: 'Phase B 피버 결전 8노트 실행 편집 (8박)',
          routine: null as any,
          branchDuration: 8,
          noteCount: 8,
        };
      case 'HAZARD_EVADE':
        return {
          phase: 'HAZARD_EVADE',
          beats: 8,
          prompt: 'Phase A 오답 장판 회피 (8박)',
          routine: null as any,
          branchDuration: 8,
          noteCount: 1,
        };
      case 'BOSS_HAZARD':
        return {
          phase: 'BOSS_HAZARD',
          beats: 16,
          totalBeats: 16,
          prompt: 'Phase B 보스 장판/공격 순서 및 회피 편집',
          routine: null as any,
          branchDuration: 16,
          noteCount: this._phaseBHazardAttacks.length,
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
      case 'FEVER_NOTES':
        return 8;
      case 'HAZARD_EVADE':
        return 8;
      case 'BOSS_HAZARD':
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

  notifyDocumentChange(): void {
    for (const listener of this._listeners) {
      listener.onDocumentChange?.();
    }
  }

  notifyStateChange(): void {
    for (const listener of this._listeners) {
      listener.onStateChange?.();
    }
  }

  notifyPatternChange(pattern: CatChoreoPattern | null): void {
    for (const listener of this._listeners) {
      listener.onPatternChange?.(pattern);
    }
  }

  notifyPhaseChange(phase: PhaseType): void {
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
    return this._historyManager.toEditorProject();
  }

  applyProject(project: EditorProject, options?: { skipCommand?: boolean }): void {
    this._historyManager.applyProject(project, options);
  }


}
