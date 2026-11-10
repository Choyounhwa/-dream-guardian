/**
 * AssaultSettlement.ts - 보스 접근전(Boss Assault) 멱등 피해 정산 단일 경로
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.6, 9.1~9.3)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-16 / Issue #518)
 *
 * 절대 규칙:
 * 1. 단일 진실 공급원(Single Source of Truth):
 *    - 별도의 독자적인 HP 사본을 유지하지 않고 BattleState 및 BossController 포트를 단일 진실 공급원으로 재사용한다.
 * 2. 멱등성(Idempotency):
 *    - (sessionId, attackId, effectType) 키를 기반으로 중복 정산을 원천 차단한다.
 * 3. 세션 무결성(Session Integrity):
 *    - 활성 세션(activeSessionId)과 일치하지 않는 이전/stale 세션의 요청을 거부한다.
 * 4. 자원 격리(Resource Isolation):
 *    - 본 정산기는 오직 HP 피해 정산만 담당하며, 콤보, 점수, 마나, 별가루 등의 타 자원을 임의로 변경하지 않는다.
 * 5. 영수증(Receipt) 반환:
 *    - 정산 적용 전후 실제 HP 차이(actualDamage), 요청 피해량(requestedDamage)을 불변 영수증으로 반환한다.
 */

import type {
  AssaultSettlementCommand,
  AssaultSettlementTarget,
  AssaultHitResult,
  SessionId,
  RoundId,
  AttackId,
} from '../../types/assault.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../../config/assault.config.js';

// ─── 1. 외부 자원 대상 포트 인터페이스 ───

/** 플레이어 체력 권위 포트 (BattleState 호환) */
export interface PlayerResourceTarget {
  hp: number;
  applyHazardDamage(amount?: number): void;
}

/** 보스 체력 권위 포트 (BossController 호환) */
export interface BossResourceTarget {
  hp: number;
  takeDamage(amount: number, options?: { minHp?: number }): void;
}

// ─── 2. 설정 및 영수증 계약 ───

/** 정산 피해량 밸런스 프로필 설정 */
export interface AssaultSettlementBalanceConfig {
  readonly wrongDamage?: number;
  readonly squatFailDamage?: number;
  readonly missDamage?: number;
  readonly bossDamage?: number;
}

/** 정산 결과 영수증 (Receipt) */
export interface AssaultSettlementReceipt {
  readonly receiptId: string;
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly attackId: AttackId;
  readonly target: AssaultSettlementTarget;
  readonly effectType: string;
  readonly resultKind: AssaultHitResult;
  readonly idempotencyKey: string;
  readonly requestedDamage: number;
  readonly actualDamage: number;
  readonly oldHp: number;
  readonly previousHp: number;
  readonly newHp: number;
  readonly currentHp: number;
  readonly applied: boolean;
  readonly rejectionReason?: 'duplicate' | 'stale_session' | 'invalid_command';
}

/** 정산기 생성 옵션 */
export interface AssaultSettlementOptions {
  readonly activeSessionId: SessionId;
  readonly battleState: PlayerResourceTarget;
  readonly bossController?: BossResourceTarget;
  readonly config?: AssaultSettlementBalanceConfig;
}

// ─── 3. 피해량 수치 해석 순수 함수 ───

/**
 * 정산 명령을 받아 balance config에 따라 적용해야 할 순수 피해량을 계산한다.
 */
export function resolveSettlementDamage(
  command: AssaultSettlementCommand,
  config?: AssaultSettlementBalanceConfig,
): number {
  const wrongDamage = config?.wrongDamage ?? DEFAULT_ASSAULT_CONFIG.wrongDamage;
  const squatFailDamage = config?.squatFailDamage ?? DEFAULT_ASSAULT_CONFIG.squatFailDamage;
  const missDamage = config?.missDamage ?? DEFAULT_ASSAULT_CONFIG.missDamage;
  const bossDamage = config?.bossDamage ?? 0;

  // 1. 무효화 / 회피 성공 / 정답 타격 (피해 0)
  const effect = command.effectType as string;
  if (
    effect === 'boss_negate' ||
    effect === 'evade_success' ||
    command.resultKind === 'evaded'
  ) {
    return 0;
  }

  // 2. 보스 대상 정산
  if (command.target === 'boss') {
    if (effect === 'boss_damage' || (command as any).damage !== undefined) {
      return (command as any).damage ?? bossDamage;
    }
    return 0; // MVP 단계 DEC-A7: boss_negate 시 보스 HP 불변
  }

  // 3. 플레이어 대상 정산
  // 3-1. 타임아웃
  if (command.resultKind === 'timeout' || effect === 'timeout') {
    return missDamage;
  }

  // 3-2. 스쿼트 실패
  const isSquat =
    (command as any).encounterKind === 'squat' ||
    effect === 'squat_fail' ||
    command.attackId.toLowerCase().includes('squat');
  if (isSquat) {
    if (command.resultKind === 'miss' || effect === 'squat_fail' || effect === 'player_damage') {
      return squatFailDamage;
    }
  }

  // 3-3. 오답 / 미스
  if (
    command.resultKind === 'miss' ||
    effect === 'wrong_damage' ||
    effect === 'player_damage'
  ) {
    return wrongDamage;
  }

  return 0;
}

// ─── 4. AssaultSettlement 클래스 ───

export class AssaultSettlement {
  private _activeSessionId: SessionId;
  private readonly _battleState: PlayerResourceTarget;
  private readonly _bossController?: BossResourceTarget;
  private readonly _config: AssaultSettlementBalanceConfig;
  private readonly _receipts: Map<string, AssaultSettlementReceipt> = new Map();

  constructor(options: AssaultSettlementOptions) {
    this._activeSessionId = options.activeSessionId;
    this._battleState = options.battleState;
    this._bossController = options.bossController;
    this._config = Object.freeze({
      wrongDamage: options.config?.wrongDamage ?? DEFAULT_ASSAULT_CONFIG.wrongDamage,
      squatFailDamage: options.config?.squatFailDamage ?? DEFAULT_ASSAULT_CONFIG.squatFailDamage,
      missDamage: options.config?.missDamage ?? DEFAULT_ASSAULT_CONFIG.missDamage,
      bossDamage: options.config?.bossDamage ?? 0,
    });
  }

  /** 현재 활성 세션 ID 반환 */
  get activeSessionId(): SessionId {
    return this._activeSessionId;
  }

  /** 활성 세션 ID 변경 */
  setActiveSession(sessionId: SessionId): void {
    this._activeSessionId = sessionId;
  }

  /** 특정 키의 정산 완료 여부 */
  hasSettled(idempotencyKey: string): boolean {
    return this._receipts.has(idempotencyKey);
  }

  /** 완료된 정산 영수증 조회 */
  getReceipt(idempotencyKey: string): AssaultSettlementReceipt | undefined {
    return this._receipts.get(idempotencyKey);
  }

  /** 모든 발행된 영수증 목록 조회 */
  getReceipts(): readonly AssaultSettlementReceipt[] {
    return Object.freeze([...this._receipts.values()]);
  }

  /**
   * 단일 정산 명령을 멱등하게 처리한다.
   *
   * @param command 정산 명령
   * @param configOverride 선택적 밸런스 설정 오버라이드
   */
  settle(
    command: AssaultSettlementCommand,
    configOverride?: AssaultSettlementBalanceConfig,
  ): AssaultSettlementReceipt {
    const key =
      command.idempotencyKey ||
      `${command.sessionId}:${command.attackId}:${command.effectType}`;

    const isBoss = command.target === 'boss';
    const targetResource = isBoss ? this._bossController : this._battleState;
    const currentHp = targetResource?.hp ?? 0;

    const requestedDamage = resolveSettlementDamage(
      command,
      configOverride ?? this._config,
    );

    // 1. 활성 세션 검증 (Stale Session 거부)
    if (command.sessionId !== this._activeSessionId) {
      return Object.freeze({
        receiptId: `rcpt_stale_${key}`,
        sessionId: command.sessionId,
        roundId: command.roundId,
        attackId: command.attackId,
        target: command.target,
        effectType: command.effectType,
        resultKind: command.resultKind,
        idempotencyKey: key,
        requestedDamage,
        actualDamage: 0,
        oldHp: currentHp,
        previousHp: currentHp,
        newHp: currentHp,
        currentHp: currentHp,
        applied: false,
        rejectionReason: 'stale_session',
      });
    }

    // 2. 멱등성 검증 (동일 키 중복 거부)
    if (this._receipts.has(key)) {
      return Object.freeze({
        receiptId: `rcpt_dup_${key}`,
        sessionId: command.sessionId,
        roundId: command.roundId,
        attackId: command.attackId,
        target: command.target,
        effectType: command.effectType,
        resultKind: command.resultKind,
        idempotencyKey: key,
        requestedDamage,
        actualDamage: 0,
        oldHp: currentHp,
        previousHp: currentHp,
        newHp: currentHp,
        currentHp: currentHp,
        applied: false,
        rejectionReason: 'duplicate',
      });
    }

    // 3. 대상별 피해 적용
    let oldHp = 0;
    let newHp = 0;

    if (isBoss) {
      if (!this._bossController) {
        return Object.freeze({
          receiptId: `rcpt_invalid_${key}`,
          sessionId: command.sessionId,
          roundId: command.roundId,
          attackId: command.attackId,
          target: command.target,
          effectType: command.effectType,
          resultKind: command.resultKind,
          idempotencyKey: key,
          requestedDamage,
          actualDamage: 0,
          oldHp: 0,
          previousHp: 0,
          newHp: 0,
          currentHp: 0,
          applied: false,
          rejectionReason: 'invalid_command',
        });
      }

      oldHp = this._bossController.hp;
      if (requestedDamage > 0) {
        this._bossController.takeDamage(requestedDamage);
      }
      newHp = this._bossController.hp;
    } else {
      oldHp = this._battleState.hp;
      if (requestedDamage > 0) {
        this._battleState.applyHazardDamage(requestedDamage);
      }
      newHp = this._battleState.hp;
    }

    const actualDamage = Math.max(0, oldHp - newHp);

    const receipt: AssaultSettlementReceipt = Object.freeze({
      receiptId: `rcpt_${key}`,
      sessionId: command.sessionId,
      roundId: command.roundId,
      attackId: command.attackId,
      target: command.target,
      effectType: command.effectType,
      resultKind: command.resultKind,
      idempotencyKey: key,
      requestedDamage,
      actualDamage,
      oldHp,
      previousHp: oldHp,
      newHp,
      currentHp: newHp,
      applied: true,
    });

    this._receipts.set(key, receipt);
    return receipt;
  }

  /**
   * 여러 정산 명령을 순차적으로 멱등 정산한다.
   */
  settleBatch(
    commands: readonly AssaultSettlementCommand[],
    configOverride?: AssaultSettlementBalanceConfig,
  ): readonly AssaultSettlementReceipt[] {
    const receipts: AssaultSettlementReceipt[] = [];
    for (const cmd of commands) {
      receipts.push(this.settle(cmd, configOverride));
    }
    return Object.freeze(receipts);
  }

  /**
   * 정산기 내부 이력을 초기화한다 (세션 리셋용).
   */
  reset(): void {
    this._receipts.clear();
  }
}
