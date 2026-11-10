/**
 * EditorElementTransformer.ts - 에디터 레이아웃 요소 변환 및 트리 순회 모듈 (슬롯/폼버퍼/해저드 전담 매니저)
 */

import {
  type BodyCursorPart,
} from './PoseConstraintValidator.js';
import {
  type TimelineTrackNote,
} from './PhaseSequenceEditor.js';
import { ReplaceProjectCommand } from './ProjectCommands.js';
import {
  isPublishableHandZone,
  isPublishableFootZone,
  checkCrossBodyConstraint,
} from '../data/ContentCapabilities.js';
import { EditorHazardManager } from './EditorHazardManager.js';

export * from './EditorElementTypes.js';
import type {
  PhaseType,
  PhaseBHazardAttackItem,
  PhaseBHazardValidationResult,
  PhaseBHazardLockedConfig,
  PhaseAHazardScheduleDisplay,
  PhaseAHazardStep,
  StarSlotValidationDiagnostic,
  StarSlotValidationResult,
  StarSlotItem,
  FormBufferEntry,
  FeverSlotValidationResult,
  FeverSlotItem,
  FeverPreviewResult,
  PatternApplicationDiff,
  EditorElementHost,
} from './EditorElementTypes.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { PhaseBPublishableAttack, PhaseBRequiredAction } from '../data/ContentCapabilities.js';

function makeLockResult<T extends string>(
  code: T,
  lockReason: string,
  path: string,
  entityId: string,
  message: string
) {
  return {
    valid: false,
    lockCode: code as any,
    lockReason,
    diagnostics: [{ code, path, entityId, message, severity: 'error' as const }],
  };
}

export class EditorElementTransformer {
  private _host: EditorElementHost;
  private _hazardManager: EditorHazardManager;
  private _starSequenceId: string = 'seq_phaseA_star';
  private _feverSequenceId: string = 'seq_phaseB_fever';
  private _feverSlots: FeverSlotItem[] = [];
  private _feverFormBuffer: Map<number, FormBufferEntry> = new Map();
  private _formBuffer: Map<number, FormBufferEntry> = new Map();

  constructor(host: EditorElementHost) {
    this._host = host;
    this._hazardManager = new EditorHazardManager(host);
    this.initDefaultFeverSlots();
  }

  // --- Getters / Setters for Host Integration ---
  get starSequenceId(): string { return this._starSequenceId; }
  setStarSequenceId(id: string): void { this._starSequenceId = id; }

  get hazardSequenceId(): string { return this._hazardManager.hazardSequenceId; }
  setHazardSequenceId(id: string): void { this._hazardManager.setHazardSequenceId(id); }

  get hazardEventId(): string { return this._hazardManager.hazardEventId; }
  setHazardEventId(id: string): void { this._hazardManager.setHazardEventId(id); }

  get phaseAHazardPattern(): PhaseAHazardPattern { return this._hazardManager.phaseAHazardPattern; }
  setRawPhaseAHazardPattern(pattern: PhaseAHazardPattern): void { this._hazardManager.setRawPhaseAHazardPattern(pattern); }

  get feverSequenceId(): string { return this._feverSequenceId; }
  setFeverSequenceId(id: string): void { this._feverSequenceId = id; }

  get feverSlots(): FeverSlotItem[] { return this._feverSlots; }
  setFeverSlots(slots: FeverSlotItem[]): void { this._feverSlots = slots.map((s) => ({ ...s })); }

  get phaseBHazardSequenceId(): string { return this._hazardManager.phaseBHazardSequenceId; }
  setRawPhaseBHazardSequenceId(id: string): void { this._hazardManager.setRawPhaseBHazardSequenceId(id); }

  get phaseBHazardAttacks(): PhaseBHazardAttackItem[] { return this._hazardManager.phaseBHazardAttacks; }
  setRawPhaseBHazardAttacks(attacks: PhaseBHazardAttackItem[]): void { this._hazardManager.setRawPhaseBHazardAttacks(attacks); }

  get phaseBHazardAttackCounter(): number { return this._hazardManager.phaseBHazardAttackCounter; }
  setPhaseBHazardAttackCounter(cnt: number): void { this._hazardManager.setPhaseBHazardAttackCounter(cnt); }

  get hazardManager(): EditorHazardManager { return this._hazardManager; }

  clearAllFormBuffers(): void {
    this._formBuffer.clear();
    this._feverFormBuffer.clear();
  }

  private normalizeSlot(slotIndex: number, maxSlot: number): number {
    return Math.max(0, Math.min(maxSlot, slotIndex));
  }

  private executeReplaceCommand(): void {
    const hasCmd = typeof this._host.hasCommandManager === 'function'
      ? this._host.hasCommandManager()
      : Boolean(this._host.hasCommandManager);
    if (hasCmd && this._host.getCommandManager) {
      const cmdManager = this._host.getCommandManager();
      if (cmdManager) {
        cmdManager.executeCommand(new ReplaceProjectCommand(this._host.toEditorProject()));
      }
    }
  }

  // ==========================================
  // Star Slot Logic (Issue #384: STAR_COLLECT)
  // ==========================================

  getStarSlots(): StarSlotItem[] {
    const starNotes = this._host.getSequenceEditor().getNotesForPhase('STAR_COLLECT');
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
    return makeLockResult(
      'COUNT_LOCKED',
      'STAR_COLLECT 시퀀스는 정확히 7개의 고정 슬롯 노트(2~8박)만 허용되며 노트 수 추가/삭제가 잠겨 있습니다. (COUNT_LOCKED)',
      'notes.count',
      'STAR_COLLECT',
      'STAR_COLLECT requires exactly 7 fixed slot notes; note count is locked.'
    );
  }

  validateStarSlot(
    slotIndex: number,
    patch: Partial<{
      part: BodyCursorPart | 'foot';
      zoneId: number;
      beat: number;
      startBeat: number;
      tick: number;
      landingBeat: number;
      landingTick: number;
      freeLanding: boolean;
      reward: any;
      rewardMultiplier: any;
      patternId: string;
    }>
  ): StarSlotValidationResult {
    const normalizedIndex = this.normalizeSlot(slotIndex, 6);
    const expectedBeat = normalizedIndex + 2;
    const expectedTick = (normalizedIndex + 1) * 480;

    if (
      (patch.landingTick !== undefined && patch.landingTick !== expectedTick) ||
      (patch.tick !== undefined && patch.tick !== expectedTick) ||
      (patch.landingBeat !== undefined && Math.abs(patch.landingBeat - expectedBeat) > 0.001) ||
      (patch.beat !== undefined && Math.abs(patch.beat - expectedBeat) > 0.001) ||
      (patch.startBeat !== undefined && Math.abs(patch.startBeat - expectedBeat) > 0.001)
    ) {
      return makeLockResult(
        'FIXED_SLOT_LANDING',
        `별 착지 타이밍은 슬롯 ${normalizedIndex + 1}의 ${expectedBeat}박(${expectedTick} tick)으로 고정되어 있습니다. (FIXED_SLOT_LANDING)`,
        'landingTick',
        `NOTE_S_${normalizedIndex + 1}`,
        `Star landing timing is fixed to beat ${expectedBeat} (${expectedTick} ticks).`
      );
    }

    if (patch.rewardMultiplier !== undefined || patch.reward !== undefined) {
      return makeLockResult(
        'LOCKED_REWARD_MODIFICATION',
        '별 수집 슬롯 보상 배율은 고정되어 있으며 수정이 잠겨 있습니다. (LOCKED_REWARD_MODIFICATION)',
        'reward',
        `NOTE_S_${normalizedIndex + 1}`,
        'Star reward modification is locked for fixed star slots.'
      );
    }

    if (patch.freeLanding !== undefined) {
      return makeLockResult(
        'LOCKED_FREE_LANDING',
        '자유 착지 타이밍 수정이 잠겨 있습니다. 7개 고정 슬롯 착지만 허용됩니다. (LOCKED_FREE_LANDING)',
        'freeLanding',
        `NOTE_S_${normalizedIndex + 1}`,
        'Free landing mode is locked for star collection.'
      );
    }

    if (patch.part === 'head') {
      return makeLockResult(
        'LOCKED_INPUT_CAPABILITY',
        '머리 커서는 초기 V2 프로필에서 별 수집에 지원되지 않습니다 (LOCKED_INPUT_CAPABILITY). 손(1~5) 또는 발(9~11)을 사용하세요.',
        'target.part',
        `NOTE_S_${normalizedIndex + 1}`,
        'Head cursor is locked from star collection in initial V2 profile.'
      );
    }

    if (patch.part === 'hip') {
      return makeLockResult(
        'LOCKED_INPUT_CAPABILITY',
        '골반 커서는 초기 V2 프로필에서 별 수집에 지원되지 않습니다 (LOCKED_INPUT_CAPABILITY). 손(1~5) 또는 발(9~11)을 사용하세요.',
        'target.part',
        `NOTE_S_${normalizedIndex + 1}`,
        'Hip cursor is locked from star collection in initial V2 profile.'
      );
    }

    const currentSlots = this.getStarSlots();
    const currentSlot = currentSlots[normalizedIndex];
    const targetPart = patch.part ?? currentSlot?.part ?? 'leftHand';
    const targetZone = patch.zoneId ?? currentSlot?.zoneId ?? 3;

    if (targetPart === 'leftHand' || targetPart === 'rightHand') {
      if (targetZone < 1 || targetZone > 5) {
        return makeLockResult(
          'LOCKED_INPUT_CAPABILITY',
          '손(hand) 타겟 존은 초기 V2 프로필에서 1~5 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          'target.zoneId',
          `NOTE_S_${normalizedIndex + 1}`,
          'Hand target zone must be between 1 and 5 in initial V2 profile.'
        );
      }
    }

    if (targetPart === 'foot') {
      if (targetZone < 9 || targetZone > 11) {
        return makeLockResult(
          'LOCKED_INPUT_CAPABILITY',
          '발(foot) 타겟 존은 초기 V2 프로필에서 9~11 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          'target.zoneId',
          `NOTE_S_${normalizedIndex + 1}`,
          'Foot target zone must be between 9 and 11 in initial V2 profile.'
        );
      }
    }

    return { valid: true, diagnostics: [] };
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

    const normalizedIndex = this.normalizeSlot(slotIndex, 6);
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

    this._host.getSequenceEditor().updateNote('STAR_COLLECT', slot.noteId, {
      targetZones: [nextZone],
      color,
      label,
      payload: {
        part: nextPart,
        targetType: nextPart === 'foot' ? 'foot' : 'cursor',
        patternId: nextPatternId,
      },
    });

    this.executeReplaceCommand();
    this.clearFormBuffer(normalizedIndex);
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();

    return { valid: true, diagnostics: [] };
  }

  getFormBuffer(slotIndex?: number): FormBufferEntry | undefined {
    if (slotIndex !== undefined) {
      return this._formBuffer.get(this.normalizeSlot(slotIndex, 6));
    }
    return undefined;
  }

  setFormBuffer(slotIndex: number, entry: Partial<FormBufferEntry>): void {
    const normalizedIndex = this.normalizeSlot(slotIndex, 6);
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
    this._host.notifyStateChange();
  }

  clearFormBuffer(slotIndex?: number): void {
    if (slotIndex !== undefined) {
      this._formBuffer.delete(this.normalizeSlot(slotIndex, 6));
    } else {
      this._formBuffer.clear();
    }
    this._host.notifyStateChange();
  }

  applyFormBuffer(slotIndex: number): StarSlotValidationResult {
    const normalizedIndex = this.normalizeSlot(slotIndex, 6);
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

  validateStarSlots(): {
    valid: boolean;
    ok: boolean;
    diagnostics: StarSlotValidationDiagnostic[];
    errors: StarSlotValidationDiagnostic[];
    warnings: StarSlotValidationDiagnostic[];
  } {
    const starNotes = this._host.getSequenceEditor().getNotesForPhase('STAR_COLLECT');
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

      const rawPart = note.payload?.part;
      const zoneId = note.targetZones?.[0] ?? 0;
      const isFoot =
        rawPart === 'foot' ||
        note.payload?.targetType === 'foot' ||
        (rawPart === 'hip' && zoneId >= 9);
      const part = isFoot ? 'foot' : (rawPart || (zoneId >= 6 ? 'hip' : 'leftHand'));

      if (part === 'head') {
        errors.push({
          code: 'LOCKED_INPUT_CAPABILITY',
          entityId: note.id,
          path: 'target.part',
          message: `노트 ${note.id}에 머리(head) 커서가 지정되어 있습니다. 별 수집에는 손(1~5) 또는 발(9~11)만 허용됩니다.`,
          severity: 'error',
        });
      } else if (part === 'hip') {
        warnings.push({
          code: 'NON_STANDARD_STAR_TARGET',
          entityId: note.id,
          path: 'target.part',
          message: `노트 ${note.id}에 골반(hip) 커서가 지정되어 있습니다.`,
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

  // ==========================================
  // Fever Slot Logic (Issue #398: FEVER_NOTES)
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
    const normalizedIndex = this.normalizeSlot(slotIndex, 7);
    const expectedBeat = normalizedIndex + 1;
    const expectedTick = (normalizedIndex + 1) * 480;

    if (
      (patch.landingTick !== undefined && patch.landingTick !== expectedTick) ||
      (patch.beat !== undefined && Math.abs(patch.beat - expectedBeat) > 0.001) ||
      (patch.tick !== undefined && patch.tick !== expectedTick)
    ) {
      return makeLockResult(
        'FIXED_SLOT_LANDING',
        `피버 착지 타이밍은 480 틱 간격으로 고정되어 있습니다. 슬롯 ${normalizedIndex + 1}: ${expectedBeat}박 (${expectedTick} tick) (FIXED_SLOT_LANDING)`,
        'landingTick',
        `NOTE_F_${normalizedIndex + 1}`,
        `Fever landing timing is fixed to beat ${expectedBeat} (${expectedTick} ticks).`
      );
    }

    if ((patch as any).rewardMultiplier !== undefined || (patch as any).reward !== undefined) {
      return makeLockResult(
        'LOCKED_REWARD_MODIFICATION',
        '피버 노트 보상 배율은 고정되어 있으며 수정이 잠겨 있습니다. (LOCKED_REWARD_MODIFICATION)',
        'reward',
        `NOTE_F_${normalizedIndex + 1}`,
        'Fever reward modification is locked for fixed fever slots.'
      );
    }

    if ((patch as any).freeLanding !== undefined) {
      return makeLockResult(
        'LOCKED_FREE_LANDING',
        '자유 착지 타이밍 수정이 잠겨 있습니다. 8개 고정 슬롯 착지만 허용됩니다. (LOCKED_FREE_LANDING)',
        'freeLanding',
        `NOTE_F_${normalizedIndex + 1}`,
        'Free landing mode is locked for fever notes.'
      );
    }

    if (patch.part === 'head' || patch.part === 'hip') {
      return makeLockResult(
        'LOCKED_INPUT_CAPABILITY',
        '피버 노트는 머리(head) 및 골반(hip) 커서가 잠겨 있습니다. 손(leftHand/rightHand 1~5) 또는 발(foot 9~11)만 지원됩니다. (LOCKED_INPUT_CAPABILITY)',
        'target.part',
        `NOTE_F_${normalizedIndex + 1}`,
        `Fever target part "${patch.part}" is locked in initial V2 profile.`
      );
    }

    const currentSlots = this.getFeverSlots();
    const currentSlot = currentSlots[normalizedIndex];
    const targetPart = patch.part ?? currentSlot?.part ?? 'leftHand';
    const targetZone = patch.zoneId ?? currentSlot?.zoneId ?? 4;

    if (targetPart === 'leftHand' || targetPart === 'rightHand') {
      if (targetZone < 1 || targetZone > 5) {
        return makeLockResult(
          'LOCKED_INPUT_CAPABILITY',
          '손(hand) 타겟 존은 초기 V2 프로필에서 1~5 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          'target.zoneId',
          `NOTE_F_${normalizedIndex + 1}`,
          'Hand target zone must be between 1 and 5 in initial V2 profile.'
        );
      }

      const crossCheck = checkCrossBodyConstraint(targetPart, targetZone, null);
      if (!crossCheck.valid) {
        return makeLockResult(
          'CROSS_BODY_VIOLATION',
          crossCheck.reason || '신체 물리 제약 위반 (Cross-Body)',
          'target.zoneId',
          `NOTE_F_${normalizedIndex + 1}`,
          crossCheck.reason || 'Cross-body constraint violation'
        );
      }

      if (!isPublishableHandZone(targetPart, targetZone)) {
        return makeLockResult(
          'LOCKED_INPUT_CAPABILITY',
          `손(${targetPart}) 타겟 존 ${targetZone}은 초기 V2 프로필에서 지원되지 않습니다. (LOCKED_INPUT_CAPABILITY)`,
          'target.zoneId',
          `NOTE_F_${normalizedIndex + 1}`,
          `Hand target zone ${targetZone} is not publishable for ${targetPart} in initial V2 profile.`
        );
      }
    } else if (targetPart === 'foot') {
      if (!isPublishableFootZone(targetZone) || targetZone < 9 || targetZone > 11) {
        return makeLockResult(
          'LOCKED_INPUT_CAPABILITY',
          '발(foot) 타겟 존은 초기 V2 프로필에서 9~11 존만 허용됩니다. (LOCKED_INPUT_CAPABILITY)',
          'target.zoneId',
          `NOTE_F_${normalizedIndex + 1}`,
          'Foot target zone must be between 9 and 11 in initial V2 profile.'
        );
      }
    }

    return { valid: true, diagnostics: [] };
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

    const normalizedIndex = this.normalizeSlot(slotIndex, 7);
    const slots = this.getFeverSlots();
    const slot = slots[normalizedIndex];
    if (!slot) {
      return {
        valid: false,
        diagnostics: [{ code: 'SLOT_NOT_FOUND', message: `슬롯 ${slotIndex}을 찾을 수 없습니다.`, severity: 'error' }],
      };
    }

    const newPart = patch.part ?? slot.part;
    const newZone = patch.zoneId ?? slot.zoneId;
    const isFoot = newPart === 'foot' || newZone >= 9;
    const foot: 'leftFoot' | 'rightFoot' | 'centerFoot' | undefined = isFoot
      ? newZone === 9 ? 'leftFoot' : newZone === 11 ? 'rightFoot' : 'centerFoot'
      : undefined;

    this._feverSlots[normalizedIndex] = {
      ...slot,
      part: newPart,
      zoneId: newZone,
      foot,
      patternId: patch.patternId ?? slot.patternId,
      color: isFoot ? '#10B981' : (newPart === 'rightHand' ? '#FFCB4D' : '#28E6FF'),
    };

    this.clearFeverFormBuffer(normalizedIndex);
    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();

    return { valid: true, diagnostics: [] };
  }

  getFeverFormBuffer(slotIndex?: number): FormBufferEntry | undefined {
    if (slotIndex !== undefined) {
      return this._feverFormBuffer.get(this.normalizeSlot(slotIndex, 7));
    }
    return undefined;
  }

  setFeverFormBuffer(slotIndex: number, entry: Partial<FormBufferEntry>): void {
    const normalizedIndex = this.normalizeSlot(slotIndex, 7);
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
    this._host.notifyStateChange();
  }

  clearFeverFormBuffer(slotIndex?: number): void {
    if (slotIndex !== undefined) {
      this._feverFormBuffer.delete(this.normalizeSlot(slotIndex, 7));
    } else {
      this._feverFormBuffer.clear();
    }
    this._host.notifyStateChange();
  }

  applyFeverFormBuffer(slotIndex: number): FeverSlotValidationResult {
    const normalizedIndex = this.normalizeSlot(slotIndex, 7);
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

  getFeverContentPreview(targetPhase: 'FEVER_1' | 'FEVER_2', patternId: string): FeverPreviewResult {
    const currentNotes = this._host.getSequenceEditor().getNotesForPhase(targetPhase as any);
    const pattern = this._host.getDancePattern ? this._host.getDancePattern(patternId) : undefined;

    if (!pattern) {
      return {
        targetPhase,
        changed: false,
        diffCount: 0,
        currentNotes,
        previewNotes: [...currentNotes],
      };
    }

    const previewNotes: TimelineTrackNote[] = [];
    const lh = pattern.partZoneMap?.leftHand ?? 4;
    const rh = pattern.partZoneMap?.rightHand ?? 5;

    if (targetPhase === 'FEVER_2') {
      for (let i = 0; i < 8; i++) {
        const beat = i + 1;
        const isOdd = i % 2 === 0;
        previewNotes.push({
          id: `NOTE_F_${i + 1}`,
          lane: 'keynote',
          startBeat: beat,
          durationBeats: 1,
          label: `${pattern.name} ${isOdd ? '왼손' : '오른손'}`,
          color: isOdd ? '#28E6FF' : '#FFCB4D',
          targetZones: [isOdd ? lh : rh],
          payload: { part: isOdd ? 'leftHand' : 'rightHand', patternId: pattern.id },
        });
      }
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

  getPatternApplicationDiff(patternId?: string, phase?: PhaseType): PatternApplicationDiff {
    const targetPhase = phase ?? (this._host.getSelectedPhase ? this._host.getSelectedPhase() : 'STAR_COLLECT');
    const targetPatId = patternId ?? (this._host.getSelectedPatternId ? this._host.getSelectedPatternId() : '');
    const pattern = this._host.getDancePattern ? this._host.getDancePattern(targetPatId) : undefined;
    const currentNotes = this._host.getSequenceEditor().getNotesForPhase(targetPhase);

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
        { id: 'NOTE_S_6', lane: 'keynote', startBeat: 7, durationBeats: 1, label: `${pattern.name} 왼손 준비`, color: '#28E6FF', targetZones: [lh], payload: { part: 'leftHand', patternId: pattern.id } },
        { id: 'NOTE_S_7', lane: 'keynote', startBeat: 8, durationBeats: 1, label: `${pattern.name} 오른손 스카이 피니시`, color: '#FFCB4D', targetZones: [rh], payload: { part: 'rightHand', patternId: pattern.id } },
      );
    } else {
      for (let i = 0; i < 7; i++) {
        const beat = i + 2;
        const isOdd = i % 2 === 0;
        const part: BodyCursorPart = isOdd ? 'leftHand' : 'rightHand';
        const zone = isOdd ? lh : rh;
        previewNotes.push({
          id: `NOTE_S_${i + 1}`,
          lane: 'keynote',
          startBeat: beat,
          durationBeats: 1,
          label: `${pattern.name} ${isOdd ? '왼손' : '오른손'}`,
          color: isOdd ? '#28E6FF' : '#FFCB4D',
          targetZones: [zone],
          payload: { part, patternId: pattern.id },
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

  // ==========================================
  // Hazard Evade & Boss Hazard Delegation
  // ==========================================

  getPhaseAHazardPattern(): PhaseAHazardPattern { return this._hazardManager.getPhaseAHazardPattern(); }
  setPhaseAHazardPattern(pattern: string): { success: boolean; error?: string } { return this._hazardManager.setPhaseAHazardPattern(pattern); }
  getActivePhaseAHazardPatterns(): readonly PhaseAHazardPattern[] { return this._hazardManager.getActivePhaseAHazardPatterns(); }
  getLockedPhaseAHazardPatterns(): readonly string[] { return this._hazardManager.getLockedPhaseAHazardPatterns(); }
  getPhaseAHazardDamage(): number { return this._hazardManager.getPhaseAHazardDamage(); }
  getPhaseAHazardSchedule(): PhaseAHazardScheduleDisplay { return this._hazardManager.getPhaseAHazardSchedule(); }
  getPhaseAHazardTimelineBeats(): number { return this._hazardManager.getPhaseAHazardTimelineBeats(); }
  getPhaseAHazardRoutine(): readonly PhaseAHazardStep[] { return this._hazardManager.getPhaseAHazardRoutine(); }
  validatePhaseAHazard(): PhaseBHazardValidationResult { return this._hazardManager.validatePhaseAHazard(); }
  getPhaseAHazardLockedConfig(): { damage: number; warningBeats: number; activeBeats: number } { return this._hazardManager.getPhaseAHazardLockedConfig(); }

  initDefaultPhaseBHazard(): void { this._hazardManager.initDefaultPhaseBHazard(); }
  initDefaultPhaseBHazardAttacks(): void { this._hazardManager.initDefaultPhaseBHazardAttacks(); }
  getPhaseBHazardAttacks(): PhaseBHazardAttackItem[] { return this._hazardManager.getPhaseBHazardAttacks(); }
  getPhaseBHazardSequenceId(): string { return this._hazardManager.getPhaseBHazardSequenceId(); }
  setPhaseBHazardSequenceId(id: string): void { this._hazardManager.setPhaseBHazardSequenceId(id); }
  getSupportedPhaseBAttacks(): readonly PhaseBPublishableAttack[] { return this._hazardManager.getSupportedPhaseBAttacks(); }
  getRequiredActionForPhaseBAttack(attack: string): PhaseBRequiredAction | null { return this._hazardManager.getRequiredActionForPhaseBAttack(attack); }
  addPhaseBHazardAttack(attackType: PhaseBPublishableAttack, index?: number): { success: boolean; error?: string } { return this._hazardManager.addPhaseBHazardAttack(attackType, index); }
  removePhaseBHazardAttack(index: number): { success: boolean; error?: string } { return this._hazardManager.removePhaseBHazardAttack(index); }
  reorderPhaseBHazardAttacks(fromIndex: number, toIndex: number): { success: boolean; error?: string } { return this._hazardManager.reorderPhaseBHazardAttacks(fromIndex, toIndex); }
  movePhaseBHazardAttack(fromIndex: number, toIndex: number): { success: boolean; error?: string } { return this._hazardManager.movePhaseBHazardAttack(fromIndex, toIndex); }
  duplicatePhaseBHazardAttack(index: number): { success: boolean; error?: string } { return this._hazardManager.duplicatePhaseBHazardAttack(index); }
  setPhaseBHazardAttacks(attacks: Array<{ attackType: PhaseBPublishableAttack; requiredAction?: PhaseBRequiredAction } | PhaseBPublishableAttack>): { success: boolean; error?: string } { return this._hazardManager.setPhaseBHazardAttacks(attacks); }
  replacePhaseBHazardAttacks(attacks: Array<{ attackType: string } | string>): { success: boolean; error?: string } { return this._hazardManager.replacePhaseBHazardAttacks(attacks); }
  validatePhaseBHazard(): PhaseBHazardValidationResult { return this._hazardManager.validatePhaseBHazard(); }
  getPhaseBHazardLockedConfig(): PhaseBHazardLockedConfig { return this._hazardManager.getPhaseBHazardLockedConfig(); }
}
