/**
 * EditorState.ts - 피트니스 안무 & 비트 타임라인 에디터 상태 및 비즈니스 로직
 */

import {
  DancePatternRegistry,
  EXTENDED_CAT_CHOREO_PATTERNS,
  buildPartZoneMap,
  type CatChoreoPattern,
  type PatternValidationResult,
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
import { EditorTimeModel, type EditorPhaseRoutineInfo } from './EditorTimeModel.js';
export type { EditorPhaseRoutineInfo };
export * from './EditorElementTypes.js';
import {
  type PhaseType,
  type ActiveEditTool,
  type PhaseBHazardAttackItem,
  type PhaseBHazardValidationResult,
  type PhaseBHazardLockedConfig,
  type PhaseAHazardScheduleDisplay,
  type PhaseAHazardStep,
  type StarSlotValidationDiagnostic,
  type StarSlotValidationResult,
  type StarSlotItem,
  type FormBufferEntry,
  type FeverSlotValidationResult,
  type FeverSlotItem,
  type FeverPreviewResult,
  type PatternApplicationDiff,
  type EditorElementHost,
} from './EditorElementTypes.js';
import { EditorElementTransformer } from './EditorElementTransformer.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { PhaseBPublishableAttack, PhaseBRequiredAction } from '../data/ContentCapabilities.js';

export type {
  StageCoverageStatusKind,
  StageCoverageItem,
  StageCoverageReport,
  ProjectPublicationStatus,
  BindingValidationResult,
  BossClimaxDiagnosisResult,
};



export type CreatePatternInput = Omit<CatChoreoPattern, 'partZoneMap'> & {
  partZoneMap?: Partial<Record<BodyPart, number>>;
};

export interface EditorListener {
  onStateChange?: () => void;
  onPatternChange?: (pattern: CatChoreoPattern | null) => void;
  onPhaseChange?: (phase: PhaseType) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onBeatUpdate?: (beat: number) => void;
  onDocumentChange?: () => void;
}

export class EditorState implements EditorHistoryHost, EditorElementHost {
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
  private _focusedEntityId: string | null = null;
  private _focusedErrorPath: string | null = null;
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
  private readonly _elementTransformer: EditorElementTransformer;

  constructor(
    initialRegistry?: DancePatternRegistry,
    initialSequenceEditor?: PhaseSequenceEditor,
    commandManager?: ProjectCommandManager
  ) {
    this._registry = initialRegistry ?? new DancePatternRegistry(EXTENDED_CAT_CHOREO_PATTERNS);
    this._sequenceEditor = initialSequenceEditor ?? new PhaseSequenceEditor();
    this._elementTransformer = new EditorElementTransformer(this);
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

  get starSequenceId(): string { return this._elementTransformer.starSequenceId; }
  get hazardSequenceId(): string { return this._elementTransformer.hazardSequenceId; }
  get hazardEventId(): string { return this._elementTransformer.hazardEventId; }
  get phaseAHazardPattern(): PhaseAHazardPattern { return this._elementTransformer.phaseAHazardPattern; }
  get feverSequenceId(): string { return this._elementTransformer.feverSequenceId; }
  get feverSlots(): FeverSlotItem[] { return this._elementTransformer.feverSlots; }
  get phaseBHazardSequenceId(): string { return this._elementTransformer.phaseBHazardSequenceId; }
  get phaseBHazardAttacks(): PhaseBHazardAttackItem[] { return this._elementTransformer.phaseBHazardAttacks; }
  get phaseBHazardAttackCounter(): number { return this._elementTransformer.phaseBHazardAttackCounter; }
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
  setStarSequenceId(id: string): void { this._elementTransformer.setStarSequenceId(id); }
  setHazardSequenceId(id: string): void { this._elementTransformer.setHazardSequenceId(id); }
  setHazardEventId(id: string): void { this._elementTransformer.setHazardEventId(id); }
  setRawPhaseAHazardPattern(pattern: PhaseAHazardPattern): void { this._elementTransformer.setRawPhaseAHazardPattern(pattern); }
  setFeverSequenceId(id: string): void { this._elementTransformer.setFeverSequenceId(id); }
  setFeverSlots(slots: FeverSlotItem[]): void { this._elementTransformer.setFeverSlots(slots); }
  setRawPhaseBHazardSequenceId(id: string): void { this._elementTransformer.setRawPhaseBHazardSequenceId(id); }
  setRawPhaseBHazardAttacks(attacks: PhaseBHazardAttackItem[]): void { this._elementTransformer.setRawPhaseBHazardAttacks(attacks); }
  setPhaseBHazardAttackCounter(cnt: number): void { this._elementTransformer.setPhaseBHazardAttackCounter(cnt); }
  setRawBindings(bindings: EditorBinding[]): void { this._bindings = bindings; }
  setCustomSequences(sequences: EditorSequence[]): void { this._customSequences = sequences; }
  setStageBuiltinProfiles(profiles: Record<string, string>): void { this._stageBuiltinProfiles = profiles; }
  setIsApplyingProject(applying: boolean): void { this._isApplyingProject = applying; }
  clearFormBuffers(): void { this._elementTransformer.clearAllFormBuffers(); }

  get elementTransformer(): EditorElementTransformer { return this._elementTransformer; }
  getSequenceEditor(): PhaseSequenceEditor { return this._sequenceEditor; }
  getCommandManager(): ProjectCommandManager { return this.commandManager; }
  getDancePattern(id: string): CatChoreoPattern | undefined { return this._registry.get(id); }
  getBpm(): number { return this._bpm; }

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
  // Star & Fever Slot API (Delegated)
  // ==========================================

  getStarSlots(): StarSlotItem[] { return this._elementTransformer.getStarSlots(); }
  canModifyStarNoteCount(): boolean { return this._elementTransformer.canModifyStarNoteCount(); }
  addStarSlotNote(note?: any): StarSlotValidationResult { return this._elementTransformer.addStarSlotNote(note); }
  validateStarSlot(slotIndex: number, patch: any): StarSlotValidationResult { return this._elementTransformer.validateStarSlot(slotIndex, patch); }
  updateStarSlot(slotIndex: number, patch: any): StarSlotValidationResult { return this._elementTransformer.updateStarSlot(slotIndex, patch); }
  getFormBuffer(slotIndex?: number): FormBufferEntry | undefined { return this._elementTransformer.getFormBuffer(slotIndex); }
  setFormBuffer(slotIndex: number, entry: Partial<FormBufferEntry>): void { this._elementTransformer.setFormBuffer(slotIndex, entry); }
  clearFormBuffer(slotIndex?: number): void { this._elementTransformer.clearFormBuffer(slotIndex); }
  applyFormBuffer(slotIndex: number): StarSlotValidationResult { return this._elementTransformer.applyFormBuffer(slotIndex); }

  initDefaultFeverSlots(): void { this._elementTransformer?.initDefaultFeverSlots(); }
  getFeverSlots(): FeverSlotItem[] { return this._elementTransformer.getFeverSlots(); }
  canModifyFeverNoteCount(): boolean { return this._elementTransformer.canModifyFeverNoteCount(); }
  validateFeverSlot(slotIndex: number, patch: any): FeverSlotValidationResult { return this._elementTransformer.validateFeverSlot(slotIndex, patch); }
  updateFeverSlot(slotIndex: number, patch: any): FeverSlotValidationResult { return this._elementTransformer.updateFeverSlot(slotIndex, patch); }
  getFeverFormBuffer(slotIndex?: number): FormBufferEntry | undefined { return this._elementTransformer.getFeverFormBuffer(slotIndex); }
  setFeverFormBuffer(slotIndex: number, entry: Partial<FormBufferEntry>): void { this._elementTransformer.setFeverFormBuffer(slotIndex, entry); }
  clearFeverFormBuffer(slotIndex?: number): void { this._elementTransformer.clearFeverFormBuffer(slotIndex); }
  applyFeverFormBuffer(slotIndex: number): FeverSlotValidationResult { return this._elementTransformer.applyFeverFormBuffer(slotIndex); }
  getFeverContentPreview(targetPhase: 'FEVER_1' | 'FEVER_2', patternId: string): FeverPreviewResult { return this._elementTransformer.getFeverContentPreview(targetPhase, patternId); }
  getPatternApplicationDiff(patternId?: string, phase?: PhaseType): PatternApplicationDiff { return this._elementTransformer.getPatternApplicationDiff(patternId, phase); }

  focusError(entityId: string, path: string): void {
    this._focusedEntityId = entityId;
    this._focusedErrorPath = path;
    this._selectedNoteId = entityId;
    this.notifyStateChange();
  }

  // --- Phase A Hazard Methods (Issue #395 / EDITOR-HAZARD-A) ---

  getPhaseAHazardPattern(): PhaseAHazardPattern { return this._elementTransformer.getPhaseAHazardPattern(); }
  setPhaseAHazardPattern(pattern: string): { success: boolean; error?: string } { return this._elementTransformer.setPhaseAHazardPattern(pattern); }
  getActivePhaseAHazardPatterns(): readonly PhaseAHazardPattern[] { return this._elementTransformer.getActivePhaseAHazardPatterns(); }
  getLockedPhaseAHazardPatterns(): readonly string[] { return this._elementTransformer.getLockedPhaseAHazardPatterns(); }
  getPhaseAHazardDamage(): number { return this._elementTransformer.getPhaseAHazardDamage(); }
  getPhaseAHazardSchedule(): PhaseAHazardScheduleDisplay { return this._elementTransformer.getPhaseAHazardSchedule(); }
  getPhaseAHazardTimelineBeats(): number { return this._elementTransformer.getPhaseAHazardTimelineBeats(); }
  getPhaseAHazardRoutine(): readonly PhaseAHazardStep[] { return this._elementTransformer.getPhaseAHazardRoutine(); }
  validatePhaseAHazard(): PhaseBHazardValidationResult { return this._elementTransformer.validatePhaseAHazard(); }
  getPhaseAHazardLockedConfig(): { damage: number; warningBeats: number; activeBeats: number } { return this._elementTransformer.getPhaseAHazardLockedConfig(); }

  getPhaseAHazardBinding(): EditorBinding | undefined {
    return this._bindings.find(
      (b) => b.phase === 'phaseA' && (b.sequenceId === this.hazardSequenceId || b.role === 'hazard'),
    );
  }

  setPhaseAHazardBinding(chapterId: string, subLevelId?: string | null): void {
    const existingIdx = this._bindings.findIndex(
      (b) => b.phase === 'phaseA' && (b.sequenceId === this.hazardSequenceId || b.role === 'hazard'),
    );
    const newBinding: EditorBinding = {
      chapterId,
      subLevelId: subLevelId ?? null,
      phase: 'phaseA',
      sequenceId: this.hazardSequenceId,
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

  initDefaultPhaseBHazard(): void { this._elementTransformer?.initDefaultPhaseBHazard(); }
  initDefaultPhaseBHazardAttacks(): void { this._elementTransformer?.initDefaultPhaseBHazardAttacks(); }
  getPhaseBHazardAttacks(): PhaseBHazardAttackItem[] { return this._elementTransformer.getPhaseBHazardAttacks(); }
  getPhaseBHazardSequenceId(): string { return this._elementTransformer.getPhaseBHazardSequenceId(); }
  setPhaseBHazardSequenceId(id: string): void { this._elementTransformer.setPhaseBHazardSequenceId(id); }
  getSupportedPhaseBAttacks(): readonly PhaseBPublishableAttack[] { return this._elementTransformer.getSupportedPhaseBAttacks(); }
  getRequiredActionForPhaseBAttack(attack: string): PhaseBRequiredAction | null { return this._elementTransformer.getRequiredActionForPhaseBAttack(attack); }
  addPhaseBHazardAttack(attackType: PhaseBPublishableAttack, index?: number) { return this._elementTransformer.addPhaseBHazardAttack(attackType, index); }
  removePhaseBHazardAttack(index: number) { return this._elementTransformer.removePhaseBHazardAttack(index); }
  movePhaseBHazardAttack(fromIndex: number, toIndex: number) { return this._elementTransformer.movePhaseBHazardAttack(fromIndex, toIndex); }
  reorderPhaseBHazardAttacks(fromIndex: number, toIndex: number) { return this._elementTransformer.reorderPhaseBHazardAttacks(fromIndex, toIndex); }
  duplicatePhaseBHazardAttack(index: number) { return this._elementTransformer.duplicatePhaseBHazardAttack(index); }
  setPhaseBHazardAttacks(attacks: any) { return this._elementTransformer.setPhaseBHazardAttacks(attacks); }
  replacePhaseBHazardAttacks(attacks: any) { return this._elementTransformer.replacePhaseBHazardAttacks(attacks); }
  validatePhaseBHazard(): PhaseBHazardValidationResult { return this._elementTransformer.validatePhaseBHazard(); }
  getPhaseBHazardLockedConfig(): PhaseBHazardLockedConfig { return this._elementTransformer.getPhaseBHazardLockedConfig(); }

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
    return this._elementTransformer.validateStarSlots();
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
    return EditorTimeModel.getCurrentPhaseRoutine(this._selectedPhase, this._elementTransformer.phaseBHazardAttacks.length);
  }

  getTimelineTotalBeats(phase?: PhaseType): number {
    return EditorTimeModel.getTimelineTotalBeats(phase ?? this._selectedPhase);
  }

  beatToTick(beat: number, ticksPerBeat = 480): number {
    return EditorTimeModel.beatToTick(beat, ticksPerBeat);
  }

  tickToBeat(tick: number, ticksPerBeat = 480): number {
    return EditorTimeModel.tickToBeat(tick, ticksPerBeat);
  }

  displayBeatToAudioBeat(displayBeat: number): number {
    return EditorTimeModel.displayBeatToAudioBeat(displayBeat);
  }

  audioBeatToDisplayBeat(audioBeat: number): number {
    return EditorTimeModel.audioBeatToDisplayBeat(audioBeat);
  }

  audioBeatToTick(audioBeat: number, ticksPerBeat = 480): number {
    return EditorTimeModel.audioBeatToTick(audioBeat, ticksPerBeat);
  }

  tickToAudioBeat(tick: number, ticksPerBeat = 480): number {
    return EditorTimeModel.tickToAudioBeat(tick, ticksPerBeat);
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
