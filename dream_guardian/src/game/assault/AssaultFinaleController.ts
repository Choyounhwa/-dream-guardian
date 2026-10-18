/**
 * AssaultFinaleController.ts - 보스 접근전(Boss Assault) 근접 결전 패턴 진행 및 정산 컨트롤러
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.5, 10.2, 11.1, 14, A14, A22)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-29 / Issue #531)
 *
 * 절대 규칙:
 * 1. Game 순수 런타임 제어 단일 책임:
 *    - 결전 패턴(DEFAULT_FINALE_PATTERN)과 인계 snapshot을 받아 조우를 순수 시간순(예고->창->복귀)으로 진행한다.
 *    - UI 렌더링, effects 직접 실행, DOM 조작, Web Audio, timer(setTimeout/rAF/setInterval) 일체 배제.
 * 2. 멱등 정산 명령(Settlement Command) 단일 경로:
 *    - HP를 컨트롤러 내부에서 직접 조작하지 않고, 피해/회피 의도를 정산 명령으로 발행한다.
 *    - 정산 영수증(AssaultSettlementReceipt) 수신을 통해서만 권위 체력을 갱신한다.
 *    - 동일 조우나 중복 입력에 대한 피해 재요청을 원천 차단한다.
 * 3. 동시 HP 0 시 플레이어 사망(Defeat) 최우선 정책 (A14, A22):
 *    - 동일 시점/배치에서 플레이어 HP 0과 보스 HP 0이 동시에 발생할 경우 반드시 플레이어 패배(defeat)를 우선한다.
 * 4. 입력 엄격성 및 모션 검증:
 *    - 현재 진행 중인 조우의 승인 동작(punch, squat, jump, rush)만 수용하며 다른 동작 종류는 거부한다.
 *    - 판정창 전(예고) 및 판정창 후(복귀)의 입력은 거부한다.
 */

import type {
  SessionId,
  AssaultEncounterKind,
  AssaultHitResult,
  AssaultSettlementCommand,
} from '../../types/assault.js';
import type {
  AssaultCompiledPlan,
  AssaultCompiledEncounter,
} from './AssaultPlanCompiler.js';
import {
  compileAssaultPlan,
  DEFAULT_ASSAULT_BPM,
} from './AssaultPlanCompiler.js';
import type {
  AssaultFinalePattern,
} from '../../data/assault/finalePatterns.js';
import {
  DEFAULT_FINALE_PATTERN,
} from '../../data/assault/finalePatterns.js';
import type {
  AssaultApproachPattern,
} from '../../data/assault/approachPatterns.js';
import {
  DEFAULT_ASSAULT_FINALE_CONFIG,
  type AssaultFinaleConfig,
  type AssaultFinaleActionTiming,
} from '../../../config/assault-finale.config.js';
import type {
  AssaultSettlementReceipt,
} from './AssaultSettlement.js';
import type {
  AssaultSquatPosture,
  AssaultSquatResult,
} from '../../motion/AssaultSquatAdapter.js';
import type {
  AssaultJumpPosture,
  AssaultJumpResult,
} from '../../motion/AssaultJumpAdapter.js';

// ─── 1. 결전 페이즈 및 인계/스냅샷 계약 ───

export type AssaultFinalePhase = 'ready' | 'active' | 'encounter' | 'victory' | 'defeat';

/** 결전 인계 스냅샷 */
export interface AssaultFinaleHandoffSnapshot {
  readonly sessionId: string;
  readonly playerHp: number;
  readonly bossHp: number;
  readonly rulesVersion: string;
  readonly timingProfileId: string;
}

/** 결전 런타임 읽기 전용 스냅샷 */
export interface AssaultFinaleSnapshot {
  readonly sessionId: string;
  readonly rulesVersion: string;
  readonly timingProfileId: string;
  readonly phase: AssaultFinalePhase;
  readonly playerHp: number;
  readonly bossHp: number;
  readonly activeSeconds: number;
  readonly timestampMs: number;
  readonly currentEncounterIndex: number;
  readonly totalEncounters: number;
  readonly currentEncounter: AssaultCompiledEncounter | null;
  readonly currentEncounterKind: AssaultEncounterKind | null;
  readonly currentStage: 'anticipation' | 'window' | 'recovery' | 'none';
  readonly isResolved: boolean;
  readonly isVictory: boolean;
  readonly isDefeat: boolean;
  readonly rushHitCount: number;
  readonly pendingCommandCount: number;
}

// ─── 2. 모션 입력 및 판정 결과 계약 ───

export interface AssaultFinalePunchInput {
  readonly hand?: 'left' | 'right';
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly inputId?: string;
}

export interface AssaultFinaleSquatInput {
  readonly posture?: AssaultSquatPosture | 'squatting';
  readonly isDucking?: boolean;
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly standGeneration?: number;
  readonly inputId?: string;
}

export interface AssaultFinaleJumpInput {
  readonly posture?: AssaultJumpPosture | 'jumping';
  readonly isJumping?: boolean;
  readonly isLowImpact?: boolean;
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly landGeneration?: number;
  readonly inputId?: string;
}

export type AssaultFinaleMotionInput =
  | ({ readonly kind: 'punch' } & AssaultFinalePunchInput)
  | ({ readonly kind: 'squat' } & AssaultFinaleSquatInput)
  | ({ readonly kind: 'jump' } & AssaultFinaleJumpInput);

export interface AssaultFinaleInputResult {
  readonly accepted: boolean;
  readonly encounterId?: string;
  readonly encounterKind?: AssaultEncounterKind;
  readonly reason:
    | 'SUCCESS'
    | 'BEFORE_WINDOW'
    | 'AFTER_WINDOW'
    | 'MISMATCHED_MOTION_KIND'
    | 'ALREADY_RESOLVED'
    | 'ALREADY_HIT'
    | 'GAME_OVER'
    | 'NO_ACTIVE_ENCOUNTER';
  readonly settlementCommand?: AssaultSettlementCommand;
}

// ─── 3. 내부 조우 런타임 엔트리 ───

interface RuntimeFinaleEncounter {
  readonly compiled: AssaultCompiledEncounter;
  readonly index: number;
  readonly kind: AssaultEncounterKind;
  readonly isRush: boolean;
  readonly startSeconds: number;
  readonly windowStartSeconds: number;
  readonly windowEndSeconds: number;
  readonly endSeconds: number;
  isResolved: boolean;
  isEvaded: boolean;
  isHit: boolean;
  commandIssued: boolean;
}

// ─── 4. AssaultFinaleController 클래스 ───

export class AssaultFinaleController {
  private readonly _sessionId: SessionId;
  private readonly _rulesVersion: string;
  private readonly _timingProfileId: string;
  private readonly _config: AssaultFinaleConfig;
  private readonly _encounters: readonly RuntimeFinaleEncounter[];
  private readonly _totalDurationSeconds: number;

  private _phase: AssaultFinalePhase = 'ready';
  private _playerHp: number;
  private _bossHp: number;
  private _activeSeconds = 0;
  private _timestampMs = 0;
  private _currentEncounterIndex = 0;
  private _rushHitCount = 0;
  private _isVictory = false;
  private _isDefeat = false;

  private readonly _pendingCommands: AssaultSettlementCommand[] = [];
  private readonly _issuedIdempotencyKeys = new Set<string>();
  private readonly _appliedReceiptKeys = new Set<string>();

  constructor(
    handoff: AssaultFinaleHandoffSnapshot,
    plan?: AssaultCompiledPlan | AssaultApproachPattern | AssaultFinalePattern,
    config?: AssaultFinaleConfig
  ) {
    this._sessionId = handoff.sessionId;
    this._playerHp = handoff.playerHp;
    this._bossHp = handoff.bossHp;
    this._rulesVersion = handoff.rulesVersion;
    this._timingProfileId = handoff.timingProfileId;
    this._config = config ?? DEFAULT_ASSAULT_FINALE_CONFIG;

    // 결전 패턴 컴파일 및 런타임 조우 빌드
    const compiledPlan = this._resolveCompiledPlan(plan);
    const spb = compiledPlan.secondsPerBeat;
    this._totalDurationSeconds = compiledPlan.totalDurationSeconds;

    this._encounters = compiledPlan.encounters.map((enc, idx) => {
      const isRush =
        enc.kind === 'answer_pair' &&
        ((enc as any).answerPolicyId === 'answer_policy_rapid' || enc.id.includes('rush'));

      const timing = this._getActionTiming(enc.kind, isRush);
      const startSec = enc.startBeat * spb;
      const windowStartSec = startSec + timing.anticipation * spb;
      const windowEndSec = windowStartSec + timing.window * spb;
      const endSec = startSec + enc.durationBeats * spb;

      return {
        compiled: enc,
        index: idx,
        kind: enc.kind,
        isRush,
        startSeconds: startSec,
        windowStartSeconds: windowStartSec,
        windowEndSeconds: windowEndSec,
        endSeconds: endSec,
        isResolved: false,
        isEvaded: false,
        isHit: false,
        commandIssued: false,
      };
    });

    // 초기 상태 평가 (A14, A22: 플레이어 사망 우선)
    if (this._playerHp <= 0) {
      this._phase = 'defeat';
      this._isDefeat = true;
    } else if (this._bossHp <= 0) {
      this._phase = 'victory';
      this._isVictory = true;
    }
  }

  // ─── 공개 쿼리 ───

  get rulesVersion(): string {
    return this._rulesVersion;
  }

  get timingProfileId(): string {
    return this._timingProfileId;
  }

  get phase(): AssaultFinalePhase {
    return this._phase;
  }

  get playerHp(): number {
    return this._playerHp;
  }

  get bossHp(): number {
    return this._bossHp;
  }

  get activeSeconds(): number {
    return this._activeSeconds;
  }

  getPendingSettlementCommands(): readonly AssaultSettlementCommand[] {
    return Object.freeze([...this._pendingCommands]);
  }

  getSnapshot(): AssaultFinaleSnapshot {
    const activeEnc = this._findActiveEncounter(this._activeSeconds);
    const stage = this._getEncounterStage(activeEnc, this._activeSeconds);

    return Object.freeze({
      sessionId: this._sessionId,
      rulesVersion: this._rulesVersion,
      timingProfileId: this._timingProfileId,
      phase: this._phase,
      playerHp: this._playerHp,
      bossHp: this._bossHp,
      activeSeconds: this._activeSeconds,
      timestampMs: this._timestampMs,
      currentEncounterIndex: activeEnc ? activeEnc.index : this._currentEncounterIndex,
      totalEncounters: this._encounters.length,
      currentEncounter: activeEnc ? activeEnc.compiled : (this._encounters[this._currentEncounterIndex]?.compiled ?? null),
      currentEncounterKind: activeEnc ? activeEnc.kind : null,
      currentStage: stage,
      isResolved: activeEnc ? activeEnc.isResolved : false,
      isVictory: this._isVictory,
      isDefeat: this._isDefeat,
      rushHitCount: this._rushHitCount,
      pendingCommandCount: this._pendingCommands.length,
    });
  }

  // ─── 런타임 갱신 (update) ───

  update(timestampMs: number, activeSeconds: number): AssaultFinaleSnapshot {
    this._timestampMs = timestampMs;
    this._activeSeconds = activeSeconds;

    if (this._phase === 'victory' || this._phase === 'defeat') {
      return this.getSnapshot();
    }

    if (this._phase === 'ready') {
      this._phase = 'active';
    }

    // 시간 경과에 따른 조우 마감/실패 검증 (순수 시간순 처리)
    for (const enc of this._encounters) {
      if (enc.isResolved) {
        continue;
      }

      // 판정창 종료 시점 통과 시 미해결 방어 조우 실패 처리
      if (activeSeconds >= enc.windowEndSeconds) {
        if (enc.kind === 'squat' && !enc.isEvaded && !enc.commandIssued) {
          this._issuePlayerDamageCommand(
            enc.compiled.id,
            'miss',
            this._config.bossAttackDamage
          );
          enc.commandIssued = true;
          enc.isResolved = true;
        } else if (enc.kind === 'jump' && !enc.isEvaded && !enc.commandIssued) {
          this._issuePlayerDamageCommand(
            enc.compiled.id,
            'miss',
            this._config.hazardDamage
          );
          enc.commandIssued = true;
          enc.isResolved = true;
        } else if (enc.kind === 'answer_pair' && !enc.isRush) {
          enc.isResolved = true;
        }
      }

      // 조우 전체 종료 시점 통과 시 완료 마킹
      if (activeSeconds >= enc.endSeconds) {
        enc.isResolved = true;
      }
    }

    // 현재 활성 조우 및 페이즈 갱신
    const currentEnc = this._findActiveEncounter(activeSeconds);
    if (currentEnc) {
      this._currentEncounterIndex = currentEnc.index;
      this._phase = 'encounter';
    } else {
      this._phase = 'active';
      if (activeSeconds >= this._totalDurationSeconds && this._bossHp > 0) {
        // 전체 결전 시간 만료 시 미처치 상태면 defeat
        this._phase = 'defeat';
        this._isDefeat = true;
      }
    }

    return this.getSnapshot();
  }

  // ─── 모션 입력 처리 ───

  handlePunch(input: AssaultFinalePunchInput): AssaultFinaleInputResult {
    return this.handleMotionInput({ kind: 'punch', ...input });
  }

  handleSquat(input: AssaultFinaleSquatInput | AssaultSquatResult): AssaultFinaleInputResult {
    const isDucking =
      (input as any).isDucking === true ||
      (input as any).posture === 'squatting' ||
      (input as any).posture === 'holding';

    return this.handleMotionInput({
      kind: 'squat',
      isDucking,
      posture: (input as any).posture,
      timestampMs: input.timestampMs,
      activeSeconds: (input as any).activeSeconds,
      standGeneration: (input as any).standGeneration,
      inputId: (input as any).inputId,
    });
  }

  handleJump(input: AssaultFinaleJumpInput | AssaultJumpResult): AssaultFinaleInputResult {
    const isJumping =
      (input as any).isJumping === true ||
      (input as any).posture === 'jumping';
    const isLowImpact = (input as any).isLowImpact === true;

    return this.handleMotionInput({
      kind: 'jump',
      isJumping,
      isLowImpact,
      posture: (input as any).posture,
      timestampMs: input.timestampMs,
      activeSeconds: (input as any).activeSeconds,
      landGeneration: (input as any).landGeneration,
      inputId: (input as any).inputId,
    });
  }

  handleMotionInput(input: AssaultFinaleMotionInput): AssaultFinaleInputResult {
    if (this._isVictory || this._isDefeat || this._phase === 'victory' || this._phase === 'defeat') {
      return { accepted: false, reason: 'GAME_OVER' };
    }

    const activeSec = input.activeSeconds ?? this._activeSeconds;
    const currentEnc = this._findActiveEncounter(activeSec);

    if (!currentEnc) {
      return { accepted: false, reason: 'NO_ACTIVE_ENCOUNTER' };
    }

    // 모션 종류 일치 검증
    const expectedKind = currentEnc.kind === 'answer_pair' ? 'punch' : currentEnc.kind;
    if (input.kind !== expectedKind) {
      return {
        accepted: false,
        encounterId: currentEnc.compiled.id,
        encounterKind: currentEnc.kind,
        reason: 'MISMATCHED_MOTION_KIND',
      };
    }

    // 창 경계 확인 (예고 / 판정창 / 복귀)
    if (activeSec < currentEnc.windowStartSeconds) {
      return {
        accepted: false,
        encounterId: currentEnc.compiled.id,
        encounterKind: currentEnc.kind,
        reason: 'BEFORE_WINDOW',
      };
    }
    if (activeSec > currentEnc.windowEndSeconds) {
      return {
        accepted: false,
        encounterId: currentEnc.compiled.id,
        encounterKind: currentEnc.kind,
        reason: 'AFTER_WINDOW',
      };
    }

    // 일치하는 모션별 판정 처리
    if (currentEnc.kind === 'answer_pair') {
      if (currentEnc.isRush) {
        // 연타 조우: 유효창 내 여러 번 타격 허용
        this._rushHitCount++;
        const attackId = `${currentEnc.compiled.id}_hit_${this._rushHitCount}`;
        const cmd = this._issueBossDamageCommand(attackId, this._config.punchDamage);

        return {
          accepted: true,
          encounterId: currentEnc.compiled.id,
          encounterKind: currentEnc.kind,
          reason: 'SUCCESS',
          settlementCommand: cmd,
        };
      } else {
        // 단일 약점 펀치 조우: 1회만 타격 허용
        if (currentEnc.isHit) {
          return {
            accepted: false,
            encounterId: currentEnc.compiled.id,
            encounterKind: currentEnc.kind,
            reason: 'ALREADY_HIT',
          };
        }

        currentEnc.isHit = true;
        currentEnc.isResolved = true;
        const cmd = this._issueBossDamageCommand(currentEnc.compiled.id, this._config.punchDamage);

        return {
          accepted: true,
          encounterId: currentEnc.compiled.id,
          encounterKind: currentEnc.kind,
          reason: 'SUCCESS',
          settlementCommand: cmd,
        };
      }
    } else if (currentEnc.kind === 'squat') {
      if (currentEnc.isEvaded || currentEnc.isResolved) {
        return {
          accepted: false,
          encounterId: currentEnc.compiled.id,
          encounterKind: currentEnc.kind,
          reason: 'ALREADY_RESOLVED',
        };
      }

      if (input.kind === 'squat' && input.isDucking) {
        currentEnc.isEvaded = true;
        currentEnc.isResolved = true;
        currentEnc.commandIssued = true;
        const cmd = this._issueEvadeSuccessCommand(currentEnc.compiled.id);

        return {
          accepted: true,
          encounterId: currentEnc.compiled.id,
          encounterKind: currentEnc.kind,
          reason: 'SUCCESS',
          settlementCommand: cmd,
        };
      }
    } else if (currentEnc.kind === 'jump') {
      if (currentEnc.isEvaded || currentEnc.isResolved) {
        return {
          accepted: false,
          encounterId: currentEnc.compiled.id,
          encounterKind: currentEnc.kind,
          reason: 'ALREADY_RESOLVED',
        };
      }

      if (input.kind === 'jump' && (input.isJumping || input.isLowImpact)) {
        currentEnc.isEvaded = true;
        currentEnc.isResolved = true;
        currentEnc.commandIssued = true;
        const cmd = this._issueEvadeSuccessCommand(currentEnc.compiled.id);

        return {
          accepted: true,
          encounterId: currentEnc.compiled.id,
          encounterKind: currentEnc.kind,
          reason: 'SUCCESS',
          settlementCommand: cmd,
        };
      }
    }

    return { accepted: false, reason: 'NO_ACTIVE_ENCOUNTER' };
  }

  // ─── 정산 영수증 반영 ───

  applySettlementReceipt(receipt: AssaultSettlementReceipt): void {
    if (!receipt || !receipt.applied) {
      return;
    }

    const receiptKey = receipt.idempotencyKey || receipt.receiptId;
    if (this._appliedReceiptKeys.has(receiptKey)) {
      return;
    }
    this._appliedReceiptKeys.add(receiptKey);

    // 단일 진실 공급원 체력 갱신
    if (receipt.target === 'player') {
      this._playerHp = receipt.newHp;
    } else if (receipt.target === 'boss') {
      this._bossHp = receipt.newHp;
    }

    // 대기 중인 정산 명령 제거
    const cmdIndex = this._pendingCommands.findIndex(
      (c) => c.idempotencyKey === receipt.idempotencyKey || c.attackId === receipt.attackId
    );
    if (cmdIndex !== -1) {
      this._pendingCommands.splice(cmdIndex, 1);
    }

    // 동시 HP 0 우선순위 검증 (A14, A22: 플레이어 사망 절대 최우선)
    if (this._playerHp <= 0) {
      this._phase = 'defeat';
      this._isDefeat = true;
      this._isVictory = false;
    } else if (this._bossHp <= 0) {
      this._phase = 'victory';
      this._isVictory = true;
      this._isDefeat = false;
    }
  }

  // ─── 내부 헬퍼 ───

  private _resolveCompiledPlan(
    plan?: AssaultCompiledPlan | AssaultApproachPattern | AssaultFinalePattern
  ): AssaultCompiledPlan {
    if (plan && 'bpm' in plan && 'secondsPerBeat' in plan && Array.isArray((plan as any).encounters)) {
      return plan as AssaultCompiledPlan;
    }

    const patternToCompile = (plan as any) ?? DEFAULT_FINALE_PATTERN;
    return compileAssaultPlan(patternToCompile, { bpm: DEFAULT_ASSAULT_BPM });
  }

  private _getActionTiming(kind: AssaultEncounterKind, isRush: boolean): AssaultFinaleActionTiming {
    if (isRush) {
      return this._config.beats.rush;
    }
    if (kind === 'answer_pair') {
      return this._config.beats.punch;
    }
    if (kind === 'squat') {
      return this._config.beats.squat;
    }
    if (kind === 'jump') {
      return this._config.beats.jump;
    }
    return { anticipation: 0, window: 2, recovery: 0 };
  }

  private _findActiveEncounter(activeSeconds: number): RuntimeFinaleEncounter | null {
    for (const enc of this._encounters) {
      if (activeSeconds >= enc.startSeconds && activeSeconds <= enc.endSeconds) {
        return enc;
      }
    }
    return null;
  }

  private _getEncounterStage(
    enc: RuntimeFinaleEncounter | null,
    activeSeconds: number
  ): 'anticipation' | 'window' | 'recovery' | 'none' {
    if (!enc) {
      return 'none';
    }
    if (activeSeconds < enc.windowStartSeconds) {
      return 'anticipation';
    }
    if (activeSeconds <= enc.windowEndSeconds) {
      return 'window';
    }
    return 'recovery';
  }

  private _issueBossDamageCommand(attackId: string, damage: number): AssaultSettlementCommand {
    const idempotencyKey = `${this._sessionId}:${attackId}:boss_damage`;
    const command: AssaultSettlementCommand & { damage: number } = {
      sessionId: this._sessionId,
      roundId: 'round_finale',
      attackId,
      target: 'boss',
      resultKind: 'hit',
      effectType: 'boss_damage' as any,
      idempotencyKey,
      damage,
    };

    if (!this._issuedIdempotencyKeys.has(idempotencyKey)) {
      this._issuedIdempotencyKeys.add(idempotencyKey);
      this._pendingCommands.push(command);
    }

    return command;
  }

  private _issuePlayerDamageCommand(
    attackId: string,
    resultKind: AssaultHitResult,
    damage: number
  ): AssaultSettlementCommand {
    const idempotencyKey = `${this._sessionId}:${attackId}:player_damage`;
    const command: AssaultSettlementCommand & { damage: number } = {
      sessionId: this._sessionId,
      roundId: 'round_finale',
      attackId,
      target: 'player',
      resultKind,
      effectType: 'player_damage',
      idempotencyKey,
      damage,
    };

    if (!this._issuedIdempotencyKeys.has(idempotencyKey)) {
      this._issuedIdempotencyKeys.add(idempotencyKey);
      this._pendingCommands.push(command);
    }

    return command;
  }

  private _issueEvadeSuccessCommand(attackId: string): AssaultSettlementCommand {
    const idempotencyKey = `${this._sessionId}:${attackId}:evade_success`;
    const command: AssaultSettlementCommand & { damage: number } = {
      sessionId: this._sessionId,
      roundId: 'round_finale',
      attackId,
      target: 'player',
      resultKind: 'evaded',
      effectType: 'evade_success',
      idempotencyKey,
      damage: 0,
    };

    if (!this._issuedIdempotencyKeys.has(idempotencyKey)) {
      this._issuedIdempotencyKeys.add(idempotencyKey);
      this._pendingCommands.push(command);
    }

    return command;
  }
}
