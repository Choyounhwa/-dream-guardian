/**
 * EditorState.ts - 피트니스 안무 & 비트 타임라인 에디터 상태 및 비즈니스 로직
 */

import {
  DancePatternRegistry,
  EXTENDED_CAT_CHOREO_PATTERNS,
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
} from './ChoreoPoseSimulator.js';

export type PhaseType = 'RUN_QUESTION' | 'ANSWER_SELECT' | 'STAR_COLLECT' | 'FEVER_PHASE_B';
export type ActiveEditTool = 'inspect' | 'leftHand' | 'rightHand' | 'head' | 'hip' | 'foot';

export type CreatePatternInput = Omit<CatChoreoPattern, 'partZoneMap'> & {
  partZoneMap?: Partial<Record<BodyPart, number>>;
};

export interface EditorPhaseRoutineInfo {
  phase: PhaseType;
  beats: number;
  prompt: string;
  routine: QuestionPhaseRoutine | AnswerPhaseRoutine | StarCollectRoutine | FeverPhaseRoutine;
}

export interface EditorListener {
  onStateChange?: () => void;
  onPatternChange?: (pattern: CatChoreoPattern | null) => void;
  onPhaseChange?: (phase: PhaseType) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onBeatUpdate?: (beat: number) => void;
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
  private _draftEdits: Partial<CatChoreoPattern> = {};
  private readonly _registry: DancePatternRegistry;
  private readonly _sequenceEditor: PhaseSequenceEditor;
  private readonly _simulator: ChoreoPoseSimulator = choreoPoseSimulator;
  private readonly _listeners: Set<EditorListener> = new Set();

  constructor(initialRegistry?: DancePatternRegistry, initialSequenceEditor?: PhaseSequenceEditor) {
    this._registry = initialRegistry ?? new DancePatternRegistry(EXTENDED_CAT_CHOREO_PATTERNS);
    this._sequenceEditor = initialSequenceEditor ?? new PhaseSequenceEditor();
    const initPattern = this._registry.get(this._selectedPatternId);
    if (initPattern) {
      this._sequenceEditor.syncWithPattern(initPattern);
    }
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

  computeCurrentPoseFrame(): SimulatedPoseFrame {
    return this._simulator.computeLiveFrame({
      phase: this._selectedPhase,
      currentBeat: this._currentBeat,
      selectedPattern: this.getSelectedPattern(),
      notes: this.getCurrentPhaseNotes(),
      registry: this._registry,
    });
  }

  getCurrentPhaseNotes(): TimelineTrackNote[] {
    return this._sequenceEditor.getNotesForPhase(this._selectedPhase);
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
    return {
      ...base,
      ...this._draftEdits,
      footZones: this._draftEdits.footZones ?? base.footZones,
    };
  }

  getValidationStatus(): PatternValidationResult {
    const selected = this.getSelectedPattern();
    if (!selected) {
      return { valid: true, errors: [] };
    }
    return this._registry.validate(selected);
  }

  setSelectedPattern(id: string): boolean {
    const pattern = this._registry.get(id);
    if (!pattern) {
      return false;
    }
    this._selectedPatternId = id;
    this._draftEdits = {};
    this._sequenceEditor.syncWithPattern(pattern);
    this.notifyPatternChange(pattern);
    this.notifyStateChange();
    return true;
  }

  updateCurrentPattern(partial: Partial<CatChoreoPattern>): PatternValidationResult {
    const current = this.getSelectedPattern();
    if (!current) {
      return { valid: false, errors: ['선택된 패턴이 없습니다.'] };
    }
    const candidate: CatChoreoPattern = {
      ...current,
      ...partial,
      footZones: partial.footZones ? [...partial.footZones] : current.footZones,
    };
    const val = this._registry.validate(candidate);
    this._draftEdits = { ...this._draftEdits, ...partial };

    if (val.valid) {
      this._registry.update(this._selectedPatternId, partial);
    }
    // 수정된 패턴 정보로 타임라인 키노트 시퀀스 실시간 갱신
    this._sequenceEditor.syncWithPattern(candidate);
    this.notifyPatternChange(this.getSelectedPattern());
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

    const partZoneMap: Partial<Record<BodyPart, number>> = { ...(input.partZoneMap ?? {}) };
    if (input.leftHand !== null) partZoneMap.leftHand = input.leftHand;
    if (input.rightHand !== null) partZoneMap.rightHand = input.rightHand;
    if (input.head !== null) partZoneMap.head = input.head;
    if (input.hip !== null) partZoneMap.hip = input.hip;

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
    this.notifyStateChange();
    return true;
  }

  getDetailedValidation(): DetailedPoseValidationResult {
    const selected = this.getSelectedPattern();
    return poseConstraintValidator.validateDetailed(selected ?? {});
  }

  setBpm(bpm: number): void {
    const clamped = Math.max(40, Math.min(240, Math.round(bpm)));
    this._bpm = clamped;
    this.notifyStateChange();
  }

  setSelectedPhase(phase: PhaseType): void {
    this._selectedPhase = phase;
    const routine = this.getCurrentPhaseRoutine();
    if (this._currentBeat > routine.beats) {
      this._currentBeat = routine.beats;
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
        };
      case 'ANSWER_SELECT':
        return {
          phase: 'ANSWER_SELECT',
          beats: ANSWER_PHASE_ROUTINE.maxBeats,
          prompt: ANSWER_PHASE_ROUTINE.prompt,
          routine: ANSWER_PHASE_ROUTINE,
        };
      case 'STAR_COLLECT':
        return {
          phase: 'STAR_COLLECT',
          beats: STAR_COLLECT_ROUTINE.beats,
          prompt: STAR_COLLECT_ROUTINE.prompt,
          routine: STAR_COLLECT_ROUTINE,
        };
      case 'FEVER_PHASE_B':
        return {
          phase: 'FEVER_PHASE_B',
          beats: FEVER_PHASE_B_ROUTINE.totalBeats,
          prompt: '16박 풀루프 안무 루틴 (4가지 핵심 안무 순환)',
          routine: FEVER_PHASE_B_ROUTINE,
        };
    }
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
    const maxBeats = this.getCurrentPhaseRoutine().beats;
    const clamped = Math.max(0, Math.min(maxBeats, beat));
    this._currentBeat = clamped;
    this.notifyBeatUpdate(clamped);
    this.notifyStateChange();
  }

  addListener(listener: EditorListener): void {
    this._listeners.add(listener);
  }

  removeListener(listener: EditorListener): void {
    this._listeners.delete(listener);
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
}
