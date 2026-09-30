/**
 * BossHazardController.ts - Phase B 보스 패턴 공격(충격파·교대 짓밟기) 및 광폭화 제어 엔진
 *
 * 10문제 러닝(Phase A) 완료 후 Phase B(BOSS_CLIMAX)에 진입했을 때만 공격 타이머가 가동되며,
 * Phase A에서는 0회 공격을 철저히 보장한다.
 *
 * 1. 보스 불협화음 장판 2대 공격 패턴:
 *    - 'dual_slam' (양손 쿵 - 바닥 충격파): 점프(jump)로만 회피 가능.
 *    - 'alternating_stomp_left' / 'alternating_stomp_right' (한손 콩콩 - 적 미니언 침투):
 *      왼발(step_left / zone 9) 또는 오른발(step_right / zone 11) 교대 짓밟기로 격퇴/회피.
 *
 * 2. 회피 및 피격 정산:
 *    - 회피 성공(Evaded): 플레이어 피해 0, 아군 미니언 손실 0, 회피 이벤트 발행.
 *    - 회피 실패(Hit): 플레이어 체력 피해(-15), 피버 콤보 0 리셋 (BossFeverController.onPlayerHit),
 *      아군 미니언 1체 탈락 (MinionTroopManager.removeMinion, 0마리 하한 클램프), MINION_CASUALTY 이벤트 발행.
 *    - 단일 공격에 대한 판정은 멱등(Idempotent)하게 정확히 1회만 실행.
 *
 * 3. 보스 광폭화 (Enrage):
 *    - 보스 체력이 최대 체력의 30% 이하(hp/maxHp <= 0.3) 도달 시 광폭화가 단 1회 발동.
 *    - 공격 주기가 1.5배 단축 (config.attackInterval / config.enrageSpeedMultiplier).
 *
 * 4. 생명주기 및 안전성:
 *    - 일시정지 시 타이머 동결 (pause / resume).
 *    - 보스 격파(isDefeated) 또는 플레이어 사망 시 즉시 공격 정지(stop), 0회 공격 보장.
 *
 * @see Issue #193 [BATTLE-BOSS-001]
 * @see Issue #213 [BOSS-FEVER-001]
 * @see Issue #194 [MINION-TROOP-001]
 */

import {
  DEFAULT_BOSS_HAZARD_CONFIG,
  type BossHazardConfig,
} from '../../config/battle.config.js';
import type { BattleState } from './BattleState.js';
import type { BossController } from './BossController.js';
import type { BossFeverController } from './BossFeverController.js';
import type { MinionTroopManager } from './MinionTroopManager.js';
import type { EventBus } from '../core/EventBus.js';

export type BossHazardAttackType =
  | 'dual_slam'
  | 'alternating_stomp_left'
  | 'alternating_stomp_right';

export type BossHazardState = 'idle' | 'warning' | 'active' | 'resolved';

export interface BossHazardResult {
  readonly attackId: string;
  readonly attackType: BossHazardAttackType;
  readonly evaded: boolean;
  readonly damage: number;
  readonly remainingHp: number;
  readonly remainingMinions: number;
  readonly isEnraged: boolean;
}

export interface BossHazardStartOptions {
  initialDelay?: number;
}

export interface BossHazardControllerOptions {
  battleState?: BattleState;
  bossController?: BossController;
  bossFeverController?: BossFeverController;
  minionTroopManager?: MinionTroopManager;
  eventBus?: EventBus;
  config?: Partial<BossHazardConfig>;
  patternPool?: readonly BossHazardAttackType[];
  autoSchedule?: boolean;
  onAttackStart?: (attackType: BossHazardAttackType, warningDuration: number) => void;
  onHazardResolved?: (result: BossHazardResult) => void;
  onHit?: (result: BossHazardResult) => void;
  onEvaded?: (result: BossHazardResult) => void;
  onMinionCasualty?: (remainingMinions: number) => void;
  onEnrage?: () => void;
}

export const DEFAULT_BOSS_HAZARD_PATTERNS: readonly BossHazardAttackType[] = Object.freeze([
  'dual_slam',
  'alternating_stomp_left',
  'alternating_stomp_right',
]);

export class BossHazardController {
  private readonly _config: BossHazardConfig;
  private readonly _battleState?: BattleState;
  private readonly _bossController?: BossController;
  private readonly _bossFeverController?: BossFeverController;
  private readonly _minionTroopManager?: MinionTroopManager;
  private readonly _eventBus?: EventBus;
  private readonly _patternPool: readonly BossHazardAttackType[];
  private readonly _autoSchedule: boolean;

  private readonly _onAttackStart?: (attackType: BossHazardAttackType, warningDuration: number) => void;
  private readonly _onHazardResolved?: (result: BossHazardResult) => void;
  private readonly _onHit?: (result: BossHazardResult) => void;
  private readonly _onEvaded?: (result: BossHazardResult) => void;
  private readonly _onMinionCasualty?: (remainingMinions: number) => void;
  private readonly _onEnrage?: () => void;

  private _isActive = false;
  private _isPaused = false;
  private _isEnraged = false;
  private _attackState: BossHazardState = 'idle';
  private _currentAttack: BossHazardAttackType | null = null;
  private _attackId: string | null = null;
  private _attackElapsed = 0;
  private _cooldownTimer = 0;
  private _isEvaded = false;
  private _isResolved = false;
  private _patternIndex = 0;

  private _totalAttacks = 0;
  private _evadedCount = 0;
  private _hitCount = 0;
  private _lastResult: BossHazardResult | null = null;

  constructor(options?: BossHazardControllerOptions) {
    this._config = {
      ...DEFAULT_BOSS_HAZARD_CONFIG,
      ...options?.config,
    };
    this._battleState = options?.battleState;
    this._bossController = options?.bossController;
    this._bossFeverController = options?.bossFeverController;
    this._minionTroopManager = options?.minionTroopManager;
    this._eventBus = options?.eventBus;
    this._patternPool =
      options?.patternPool && options.patternPool.length > 0
        ? options.patternPool
        : DEFAULT_BOSS_HAZARD_PATTERNS;
    this._autoSchedule = options?.autoSchedule ?? true;

    this._onAttackStart = options?.onAttackStart;
    this._onHazardResolved = options?.onHazardResolved;
    this._onHit = options?.onHit;
    this._onEvaded = options?.onEvaded;
    this._onMinionCasualty = options?.onMinionCasualty;
    this._onEnrage = options?.onEnrage;
  }

  // ─── Getters ───

  get isActive(): boolean {
    return this._isActive;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isAttacking(): boolean {
    return this._isActive && this._currentAttack !== null;
  }

  get isWarning(): boolean {
    return this.isAttacking && this._attackState === 'warning';
  }

  get isActivePhase(): boolean {
    return this.isAttacking && this._attackState === 'active';
  }

  get isEnraged(): boolean {
    return this._isEnraged;
  }

  get currentAttack(): BossHazardAttackType | null {
    return this._currentAttack;
  }

  get attackState(): BossHazardState {
    return this._attackState;
  }

  get isEvaded(): boolean {
    return this._isEvaded;
  }

  get attackElapsed(): number {
    return this._attackElapsed;
  }

  get effectiveAttackInterval(): number {
    return this._isEnraged
      ? this._config.attackInterval / this._config.enrageSpeedMultiplier
      : this._config.attackInterval;
  }

  get warningProgress(): number {
    if (!this.isAttacking || this._config.warningDuration <= 0) return 0;
    return Math.min(1.0, Math.max(0, this._attackElapsed / this._config.warningDuration));
  }

  get attackProgress(): number {
    const total = this._config.warningDuration + this._config.activeDuration;
    if (!this.isAttacking || total <= 0) return 0;
    return Math.min(1.0, Math.max(0, this._attackElapsed / total));
  }

  get cooldownRemaining(): number {
    if (!this._isActive || this.isAttacking) return 0;
    return Math.max(0, this.effectiveAttackInterval - this._cooldownTimer);
  }

  get lastResult(): BossHazardResult | null {
    return this._lastResult;
  }

  get totalAttacks(): number {
    return this._totalAttacks;
  }

  get evadedCount(): number {
    return this._evadedCount;
  }

  get hitCount(): number {
    return this._hitCount;
  }

  // ─── Lifecycle Methods ───

  start(options?: BossHazardStartOptions | number): void {
    this._isActive = true;
    this._isPaused = false;
    this._attackState = 'idle';
    this._currentAttack = null;
    this._attackElapsed = 0;
    this._isEvaded = false;
    this._isResolved = false;

    if (typeof options === 'number') {
      this._cooldownTimer = Math.max(0, this.effectiveAttackInterval - options);
    } else if (options && options.initialDelay !== undefined) {
      this._cooldownTimer = Math.max(0, this.effectiveAttackInterval - options.initialDelay);
    } else {
      this._cooldownTimer = 0;
    }
  }

  stop(): void {
    this._isActive = false;
    this._isPaused = false;
    this._currentAttack = null;
    this._attackState = 'idle';
    this._attackElapsed = 0;
    this._cooldownTimer = 0;
    this._isResolved = false;
    this._isEvaded = false;
    this._attackId = null;
  }

  pause(): void {
    this._isPaused = true;
  }

  resume(): void {
    this._isPaused = false;
  }

  reset(): void {
    this.stop();
    this._isEnraged = false;
    this._patternIndex = 0;
    this._totalAttacks = 0;
    this._evadedCount = 0;
    this._hitCount = 0;
    this._lastResult = null;
  }

  // ─── Attack Control ───

  triggerAttack(type?: BossHazardAttackType): void {
    if (!this._isActive) {
      this._isActive = true;
    }
    const attackPattern = type ?? this._nextPattern();
    this._currentAttack = attackPattern;
    this._totalAttacks++;
    this._attackId = `boss_atk_${Date.now()}_${this._totalAttacks}`;
    this._attackState = 'warning';
    this._attackElapsed = 0;
    this._cooldownTimer = 0;
    this._isEvaded = false;
    this._isResolved = false;

    if (this._bossController && !this._bossController.isDefeated) {
      this._bossController.triggerMagicAttack(
        this._config.warningDuration + this._config.activeDuration,
      );
    }

    this._onAttackStart?.(attackPattern, this._config.warningDuration);
    this._eventBus?.emit('boss:hazard_start', {
      attackType: attackPattern,
      warningDuration: this._config.warningDuration,
    });
  }

  /**
   * 유저 회피 동작 기록 (점프, 왼발, 오른발, 발 키노트 존 ID)
   * @param action 수행한 동작 ('jump' | 'step_left' | 'step_right' | 'left_step' | 'right_step' | 9 | 11 | 'leftFoot' | 'rightFoot')
   * @returns 회피 성공 여부
   */
  recordAction(action: string | number): boolean {
    if (!this._isActive || !this._currentAttack || this._isResolved) {
      return false;
    }

    let isMatch = false;

    switch (this._currentAttack) {
      case 'dual_slam':
        isMatch = action === 'jump';
        break;

      case 'alternating_stomp_left':
        isMatch =
          action === 'step_left' ||
          action === 'left_step' ||
          action === 'leftFoot' ||
          action === 9 ||
          action === '9';
        break;

      case 'alternating_stomp_right':
        isMatch =
          action === 'step_right' ||
          action === 'right_step' ||
          action === 'rightFoot' ||
          action === 11 ||
          action === '11';
        break;
    }

    if (isMatch) {
      this._isEvaded = true;
      return true;
    }

    return false;
  }

  /**
   * 보스 광폭화 수동 또는 자동 발동
   */
  triggerEnrage(): void {
    if (this._isEnraged) return;
    this._isEnraged = true;
    this._onEnrage?.();

    const hp = this._bossController ? this._bossController.hp : 0;
    const maxHp = this._bossController ? this._bossController.maxHp : 0;
    this._eventBus?.emit('boss:enrage', { hp, maxHp });
  }

  /**
   * 매 프레임 업데이트: 보스/플레이어 생존 검사, 광폭화 트리거, 공격 타이머 및 판정 진행
   */
  update(dt: number): void {
    if (!this._isActive || this._isPaused) return;

    // 1. 종료 검사: 보스 격파 시 즉시 종료 (0 attacks 보장)
    if (this._bossController && this._bossController.isDefeated) {
      this.stop();
      return;
    }

    // 2. 종료 검사: 플레이어 사망 시 즉시 종료
    if (this._battleState && !this._battleState.isAlive) {
      this.stop();
      return;
    }

    const step = Math.max(0, dt);

    // 3. 광폭화 조건 검사: 보스 체력 30% 이하 시 단 1회 발동
    if (!this._isEnraged && this._bossController) {
      const hpRatio = this._bossController.hp / this._bossController.maxHp;
      if (hpRatio <= this._config.enrageHpRatio + 1e-9) {
        this.triggerEnrage();
      }
    }

    // 4. 현재 진행 중인 공격 처리
    if (this._currentAttack !== null) {
      this._attackElapsed += step;

      // 경고 상태 -> 활성(타격) 상태 전이
      if (
        this._attackState === 'warning' &&
        this._attackElapsed >= this._config.warningDuration - 1e-9
      ) {
        this._attackState = 'active';
      }

      const totalDuration = this._config.warningDuration + this._config.activeDuration;

      // 공격 지속 시간 도달 시 판정 처리 (단 1회)
      if (!this._isResolved && this._attackElapsed >= totalDuration - 1e-9) {
        this._resolveAttack();
      }

      // 판정 완료 후 전체 시간 종료 시 idle 복귀
      if (this._attackElapsed >= totalDuration) {
        this._currentAttack = null;
        this._attackState = 'idle';
        this._attackElapsed = 0;
        this._cooldownTimer = 0;
      }
    } else if (this._autoSchedule) {
      // 5. 대기(쿨다운) 처리 및 다음 공격 스케줄링
      this._cooldownTimer += step;
      if (this._cooldownTimer >= this.effectiveAttackInterval - 1e-9) {
        this._cooldownTimer = 0;
        this.triggerAttack();
      }
    }
  }

  /**
   * 공격 즉시 판정 (외부 호출 또는 update 시간 만료 시 호출)
   */
  resolve(): BossHazardResult | null {
    if (!this._currentAttack || this._isResolved) {
      return this._lastResult;
    }
    return this._resolveAttack();
  }

  // ─── Private Helpers ───

  private _nextPattern(): BossHazardAttackType {
    const pattern = this._patternPool[this._patternIndex % this._patternPool.length];
    this._patternIndex++;
    return pattern;
  }

  private _resolveAttack(): BossHazardResult {
    this._isResolved = true;
    this._attackState = 'resolved';

    const attackType = this._currentAttack!;
    const evaded = this._isEvaded;
    let damage = 0;
    let remainingMinions = this._minionTroopManager?.minionCount ?? 0;

    if (evaded) {
      this._evadedCount++;
      damage = 0;
    } else {
      this._hitCount++;
      damage = this._config.damage;

      // 플레이어 체력 피해 적용
      if (this._battleState) {
        this._battleState.applyBossMagicDamage(damage);
      }

      // 피버 콤보 0 리셋 (#193 연동 규약)
      if (this._bossFeverController) {
        this._bossFeverController.onPlayerHit();
      } else if (this._battleState) {
        this._battleState.resetFeverCombo();
      }

      // 아군 미니언 1체 탈락 (0마리 하한 클램프)
      if (this._minionTroopManager) {
        remainingMinions = this._minionTroopManager.removeMinion(
          this._config.minionCasualtyCount,
        );
        this._onMinionCasualty?.(remainingMinions);
        this._eventBus?.emit('MINION_CASUALTY', {
          remainingMinions,
          attackType,
        });
        this._eventBus?.emit('minion:casualty', {
          remainingMinions,
          attackType,
        });
      }

      if (this._battleState) {
        this._eventBus?.emit('player:hurt', { hp: this._battleState.hp });
      }
    }

    const result: BossHazardResult = {
      attackId: this._attackId ?? `boss_atk_${Date.now()}`,
      attackType,
      evaded,
      damage,
      remainingHp: this._battleState?.hp ?? 0,
      remainingMinions,
      isEnraged: this._isEnraged,
    };

    this._lastResult = result;

    if (evaded) {
      this._onEvaded?.(result);
    } else {
      this._onHit?.(result);
    }

    this._onHazardResolved?.(result);
    this._eventBus?.emit('boss:hazard_resolved', {
      attackType,
      evaded,
      damage,
    });

    if (this._battleState && !this._battleState.isAlive) {
      this._eventBus?.emit('player:dead');
      this.stop();
    }

    return result;
  }
}
