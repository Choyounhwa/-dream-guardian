/**
 * EditorHazardManager.ts - 에디터 Phase A/B 장판 회피 및 보스 공격 해저드 전담 매니저
 */

import { ReplaceProjectCommand } from './ProjectCommands.js';
import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  scaleHazardSchedule,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';
import { DEFAULT_BOSS_HAZARD_CONFIG } from '../../config/battle.config.js';
import {
  PHASE_B_PUBLISHABLE_ATTACKS,
  PHASE_B_ATTACK_REQUIRED_ACTIONS,
  getRequiredActionForPhaseBAttack,
  type PhaseBPublishableAttack,
  type PhaseBRequiredAction,
} from '../data/ContentCapabilities.js';
import type {
  EditorElementHost,
  PhaseBHazardAttackItem,
  PhaseBHazardValidationResult,
  PhaseBHazardLockedConfig,
  PhaseAHazardScheduleDisplay,
  PhaseAHazardStep,
} from './EditorElementTypes.js';

export class EditorHazardManager {
  private _host: EditorElementHost;
  private _hazardSequenceId: string = 'seq_phaseA_hazard';
  private _hazardEventId: string = 'evt_phaseA_hazard_1';
  private _phaseAHazardPattern: PhaseAHazardPattern = 'left_step';
  private _phaseBHazardSequenceId: string = 'seq_phaseB_hazard';
  private _phaseBHazardAttacks: PhaseBHazardAttackItem[] = [];
  private _phaseBHazardAttackCounter: number = 1;

  constructor(host: EditorElementHost) {
    this._host = host;
    this.initDefaultPhaseBHazard();
  }

  // --- Getters / Setters ---
  get hazardSequenceId(): string { return this._hazardSequenceId; }
  setHazardSequenceId(id: string): void { this._hazardSequenceId = id; }

  get hazardEventId(): string { return this._hazardEventId; }
  setHazardEventId(id: string): void { this._hazardEventId = id; }

  get phaseAHazardPattern(): PhaseAHazardPattern { return this._phaseAHazardPattern; }
  setRawPhaseAHazardPattern(pattern: PhaseAHazardPattern): void { this._phaseAHazardPattern = pattern; }

  get phaseBHazardSequenceId(): string { return this._phaseBHazardSequenceId; }
  setRawPhaseBHazardSequenceId(id: string): void { this._phaseBHazardSequenceId = id; }

  get phaseBHazardAttacks(): PhaseBHazardAttackItem[] { return this._phaseBHazardAttacks; }
  setRawPhaseBHazardAttacks(attacks: PhaseBHazardAttackItem[]): void {
    this._phaseBHazardAttacks = attacks.map((a) => ({
      id: a.id,
      attackType: a.attackType as PhaseBPublishableAttack,
      requiredAction: a.requiredAction as PhaseBRequiredAction,
      label: a.label,
    }));
  }

  get phaseBHazardAttackCounter(): number { return this._phaseBHazardAttackCounter; }
  setPhaseBHazardAttackCounter(cnt: number): void { this._phaseBHazardAttackCounter = cnt; }

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
  // Phase A Hazard Logic
  // ==========================================

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
    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
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
    const bpm = this._host.getBpm ? this._host.getBpm() : 95;
    const spb = 60 / bpm;
    const scaled = scaleHazardSchedule(DEFAULT_PHASE_A_HAZARD_CONFIG, spb);
    return {
      bpm,
      secondsPerBeat: spb,
      damage: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss,
      warningDuration: scaled.warningDuration ?? 2.6,
      inputWindowEnd: scaled.inputWindowEnd ?? 3.4,
      judgmentTime: scaled.judgmentTime ?? 3.5,
      totalDuration: scaled.totalDuration ?? 4.0,
      warningDurationBeats: (scaled.warningDuration ?? 2.6) / spb,
      inputWindowEndBeats: (scaled.inputWindowEnd ?? 3.4) / spb,
      judgmentTimeBeats: (scaled.judgmentTime ?? 3.5) / spb,
      totalDurationBeats: (scaled.totalDuration ?? 4.0) / spb,
    };
  }

  getPhaseAHazardTimelineBeats(): number {
    return this._host.getTimelineTotalBeats('HAZARD_EVADE');
  }

  getPhaseAHazardRoutine(): readonly PhaseAHazardStep[] {
    const totalBeats = this.getPhaseAHazardTimelineBeats();
    const half = Math.floor(totalBeats / 2);
    const stepDuration = 2;
    const pattern = this._phaseAHazardPattern;
    const requiredAction = pattern === 'jump' ? 'jump' : pattern === 'left_step' ? 'left_step' : 'right_step';
    const label = pattern === 'jump' ? '도약 회피' : pattern === 'left_step' ? '좌측 스텝 회피' : '우측 스텝 회피';
    const color = pattern === 'jump' ? '#EAB308' : pattern === 'left_step' ? '#3B82F6' : '#EF4444';

    return [
      {
        beat: Math.max(1, half - 3),
        durationBeats: stepDuration,
        type: pattern,
        requiredAction,
        label: `${label} 1차`,
        color,
      },
      {
        beat: Math.max(1, half + 1),
        durationBeats: stepDuration,
        type: pattern,
        requiredAction,
        label: `${label} 2차`,
        color,
      },
    ];
  }

  validatePhaseAHazard(): PhaseBHazardValidationResult {
    if (!PHASE_A_ACTIVE_HAZARD_PATTERNS.includes(this._phaseAHazardPattern)) {
      return {
        valid: false,
        errors: [`유효하지 않거나 잠긴 장판 패턴입니다: ${this._phaseAHazardPattern}`],
        diagnosticCode: 'invalid-hazard-pattern',
      };
    }
    return { valid: true, errors: [] };
  }

  getPhaseAHazardLockedConfig(): { damage: number; warningBeats: number; activeBeats: number } {
    return {
      damage: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss,
      warningBeats: 5.2,
      activeBeats: 2.8,
    };
  }

  // ==========================================
  // Phase B Boss Hazard Logic
  // ==========================================

  initDefaultPhaseBHazard(): void {
    this._phaseBHazardSequenceId = 'seq_phaseB_hazard';
    this._phaseBHazardAttacks = [
      { id: 'evt_phaseB_hz_1', attackType: 'dual_slam', requiredAction: 'jump' },
      { id: 'evt_phaseB_hz_2', attackType: 'alternating_stomp_left', requiredAction: 'left_step' },
      { id: 'evt_phaseB_hz_3', attackType: 'alternating_stomp_right', requiredAction: 'right_step' },
    ];
    this._phaseBHazardAttackCounter = 4;
  }

  initDefaultPhaseBHazardAttacks(): void {
    this.initDefaultPhaseBHazard();
  }

  getPhaseBHazardAttacks(): PhaseBHazardAttackItem[] {
    return this._phaseBHazardAttacks.map((a) => ({ ...a }));
  }

  getPhaseBHazardSequenceId(): string {
    return this._phaseBHazardSequenceId;
  }

  setPhaseBHazardSequenceId(id: string): void {
    this._phaseBHazardSequenceId = id;
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
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

    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
    return { success: true };
  }

  removePhaseBHazardAttack(index: number): { success: boolean; error?: string } {
    if (index < 0 || index >= this._phaseBHazardAttacks.length) {
      return { success: false, error: `유효하지 않은 인덱스입니다: ${index}` };
    }
    this._phaseBHazardAttacks.splice(index, 1);
    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
    return { success: true };
  }

  reorderPhaseBHazardAttacks(fromIndex: number, toIndex: number): { success: boolean; error?: string } {
    const len = this._phaseBHazardAttacks.length;
    if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) {
      return { success: false, error: `유효하지 않은 재배치 인덱스: from=${fromIndex}, to=${toIndex}` };
    }
    const [item] = this._phaseBHazardAttacks.splice(fromIndex, 1);
    this._phaseBHazardAttacks.splice(toIndex, 0, item);
    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
    return { success: true };
  }

  movePhaseBHazardAttack(fromIndex: number, toIndex: number): { success: boolean; error?: string } {
    return this.reorderPhaseBHazardAttacks(fromIndex, toIndex);
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
    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
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
    this.executeReplaceCommand();
    this._host.notifyDocumentChange();
    this._host.notifyStateChange();
    return { success: true };
  }

  replacePhaseBHazardAttacks(attacks: Array<{ attackType: string } | string>): { success: boolean; error?: string } {
    return this.setPhaseBHazardAttacks(attacks as any);
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
}
