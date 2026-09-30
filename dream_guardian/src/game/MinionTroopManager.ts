/**
 * MinionTroopManager.ts - Phase A 아군 미니언 군단(3~13체) 수량 증원 및 Phase B 화력·자원소비·피격탈락 관리자
 *
 * 1. Phase A 자원 보존 및 증원:
 *    - 초기 군단: 기본 미니언 3마리 + 수호신 1마리 (총 4체)
 *    - Phase A 정답 정산당 미니언 +1 증원 (최대 13마리 상한)
 *    - 오답(wrong) 및 타임아웃(timeout) 시 미니언 증원 0 (기존 군단 및 수호신 100% 보존)
 *    - 동일 roundId에 대한 중복 정산 시 증원 0 (멱등성 보장)
 *
 * 2. Phase B 인계 및 무리셋 (Zero-Reset Guard):
 *    - Phase A 스냅샷으로부터 미니언 수(3~13)와 별가루 자원을 인계받음
 *    - Phase B 진입 시 자원이 0 또는 기본값으로 리셋되지 않음
 *
 * 3. Phase B 군단 화력 공식 (Troop DPS Calculation):
 *    - DPS / 단일 발사 피해 = (baseDamage + minionCount * damagePerMinion + bonusDamage) * gaugeMultiplier
 *    - 기본 화력: baseDamage = 10, damagePerMinion = 2, maxGaugeMultiplier = 1.5
 *    - 미니언 전멸(0마리) 시에도 수호신 단독 대치로 baseDamage(10) 발휘
 *
 * 4. 마법 게이지 충전 및 판정 실패 딜레이:
 *    - Zone 1~5 상체 별빛 수집 성공 시 게이지 배율 +0.1 충전 (최대 1.5배)
 *    - Miss(판정 실패) 시 발사 쿨다운 지연(missPenaltyDelay, 0.5초) 가산 및 게이지 감쇠
 *
 * 5. 별가루 소비 (Enhanced Barrage):
 *    - 보유 별가루 >= stardustCost(5) 시 별가루 소비 및 강화 화력(stardustBonusDamage: 10) 적용
 *    - 잔량 부족 시 오버드래프트 거부, 비정상 수치 거부, 멱등키 중복 차감 방지
 *
 * 6. 피격 탈락 연결 (#193 연동):
 *    - 보스 공격 실패 시 미니언 1체 탈락 (0마리 하한 클램프, 수호신 보존)
 *    - 미니언 수량 변동에 따른 화력 즉각 갱신
 *
 * 7. 보스 치명 피해 및 처치 시 중단:
 *    - 탄막 발사 시 bossController.takeDamage(damage) 호출
 *    - 보스 체력 0 도달(isDefeated) 시 추가 탄막 발사 즉시 중단
 *
 * @see Issue #242 [GAME-PHASE-A-RESOURCES-001]
 * @see Issue #194 [MINION-TROOP-001]
 * @see Issue #193 [BATTLE-BOSS-001]
 * @see Issue #213 [BOSS-FEVER-001]
 * @see GDD 3.1 전투 시스템 및 미니언 스펙
 */

import {
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_TROOP_COMBAT_CONFIG,
  type TroopCombatConfig,
} from '../../config/battle.config.js';
import type { RoundAnswerStatus, PhaseAResourceSnapshot } from '../types/result.js';
import type { StarRating } from '../input/StarCollectionInput.js';
import type { BossController } from './BossController.js';
import type { PhaseAResourceManager } from './PhaseAResourceManager.js';
import type { EventBus } from '../core/EventBus.js';

export interface MinionTroopConfig {
  initialMinions?: number;
  maxMinions?: number;
  minionsPerCorrect?: number;
}

export interface BarrageInfo {
  damage: number;
  minionCount: number;
  gaugeMultiplier: number;
  isEnhanced: boolean;
}

export interface MinionTroopOptions extends MinionTroopConfig {
  troopConfig?: MinionTroopConfig;
  combatConfig?: Partial<TroopCombatConfig>;
  bossController?: BossController;
  resourceManager?: PhaseAResourceManager;
  eventBus?: EventBus;
  onBarrageFired?: (info: BarrageInfo) => void;
  onCasualty?: (remainingMinions: number) => void;
}

export class MinionTroopManager {
  private readonly _initialMinions: number;
  private readonly _maxMinions: number;
  private readonly _minionsPerCorrect: number;
  private readonly _combatConfig: TroopCombatConfig;

  private _minionCount: number;
  private readonly _guardianCount = 1;
  private readonly _settledRoundIds = new Set<string | number>();

  private _bossController?: BossController;
  private _resourceManager?: PhaseAResourceManager;
  private _eventBus?: EventBus;
  private readonly _options: MinionTroopOptions;

  private _isActive = false;
  private _isPaused = false;
  private _gaugeMultiplier = 1.0;
  private _cooldownTimer = 0;
  private _stardust = 0;
  private _totalBarrageDamage = 0;
  private _barrageCount = 0;
  private readonly _consumedKeys = new Set<string>();

  constructor(optionsOrConfig?: MinionTroopOptions | MinionTroopConfig) {
    const opts = (optionsOrConfig ?? {}) as MinionTroopOptions;
    this._options = opts;

    this._initialMinions =
      opts.troopConfig?.initialMinions ??
      opts.initialMinions ??
      DEFAULT_BATTLE_CONFIG.initialMinions;
    this._maxMinions =
      opts.troopConfig?.maxMinions ??
      opts.maxMinions ??
      DEFAULT_BATTLE_CONFIG.maxMinions;
    this._minionsPerCorrect =
      opts.troopConfig?.minionsPerCorrect ??
      opts.minionsPerCorrect ??
      DEFAULT_BATTLE_CONFIG.minionsPerCorrect;

    this._combatConfig = {
      ...DEFAULT_TROOP_COMBAT_CONFIG,
      ...(opts.combatConfig ?? {}),
    };

    this._minionCount = this._initialMinions;
    this._gaugeMultiplier = this._combatConfig.baseGaugeMultiplier;
    this._cooldownTimer = this._combatConfig.cooldown;

    this._bossController = opts.bossController;
    this._resourceManager = opts.resourceManager;
    this._eventBus = opts.eventBus;
  }

  // ─── Getters ───

  /** 현재 보유한 미니언 수 (기본 3, 최대 13, Phase B 하한 0) */
  get minionCount(): number {
    return this._minionCount;
  }

  /** 수호신 개체 수 (1체 고정) */
  get guardianCount(): number {
    return this._guardianCount;
  }

  /** 전체 아군 군단 총합 (미니언 + 수호신) */
  get totalTroopCount(): number {
    return this._minionCount + this._guardianCount;
  }

  /** 최대 군단 상한 도달 여부 */
  get isMaxed(): boolean {
    return this._minionCount >= this._maxMinions;
  }

  /** 최대 미니언 상한선 (13) */
  get maxMinions(): number {
    return this._maxMinions;
  }

  /** 초기 미니언 수 (3) */
  get initialMinions(): number {
    return this._initialMinions;
  }

  /** Phase B 전투 활성화 여부 */
  get isActive(): boolean {
    return this._isActive;
  }

  /** 일시정지 상태 여부 */
  get isPaused(): boolean {
    return this._isPaused;
  }

  /** 현재 게이지 화력 배율 (기본 1.0 ~ 최대 1.5) */
  get gaugeMultiplier(): number {
    return this._gaugeMultiplier;
  }

  /** 현재 탄막 쿨다운 잔여 시간 (초) */
  get cooldownTimer(): number {
    return this._cooldownTimer;
  }

  /** 보유 별가루 수량 (자원 지갑 연결 시 지갑 잔량, 독립 시 로컬 잔량) */
  get stardust(): number {
    return this._resourceManager ? this._resourceManager.stardust : this._stardust;
  }

  /** 누적 탄막 피해량 */
  get totalBarrageDamage(): number {
    return this._totalBarrageDamage;
  }

  /** 발사된 탄막 횟수 */
  get barrageCount(): number {
    return this._barrageCount;
  }

  /** 전투 밸런스 설정 */
  get combatConfig(): TroopCombatConfig {
    return this._combatConfig;
  }

  // ─── 의존성 주입 (Dependency Injection) ───

  setBossController(boss: BossController): void {
    this._bossController = boss;
  }

  setResourceManager(rm: PhaseAResourceManager): void {
    this._resourceManager = rm;
  }

  setEventBus(eventBus: EventBus): void {
    this._eventBus = eventBus;
  }

  // ─── Phase A 자원 관리 ───

  /**
   * 라운드 정산 결과에 따른 미니언 증원 처리 (Idempotent per roundId)
   * @param status 라운드 결과 ('correct' | 'wrong' | 'timeout')
   * @param roundId 선택적 라운드 식별자 (중복 가산 방지용)
   * @returns 갱신된 미니언 수
   */
  onRoundSettled(status: RoundAnswerStatus, roundId?: string | number): number {
    if (roundId !== undefined) {
      if (this._settledRoundIds.has(roundId)) {
        return this._minionCount;
      }
      this._settledRoundIds.add(roundId);
    }

    if (status === 'correct') {
      this._minionCount = Math.min(this._maxMinions, this._minionCount + this._minionsPerCorrect);
    }
    // 'wrong' 및 'timeout'은 Phase A에서 미니언 수 변동 없음 (탈락은 Phase B에서만 발생)

    return this._minionCount;
  }

  /**
   * 수동 미니언 증원 (상한 클램프)
   */
  addMinion(count = 1): number {
    if (count <= 0) return this._minionCount;
    this._minionCount = Math.min(this._maxMinions, this._minionCount + count);
    return this._minionCount;
  }

  /**
   * 미니언 탈락/감소 (0마리 하한 클램프, Issue #193, #194)
   * @param count 탈락할 미니언 수 (기본 1)
   * @returns 갱신된 미니언 수
   */
  removeMinion(count = 1): number {
    if (count <= 0) return this._minionCount;
    this._minionCount = Math.max(0, this._minionCount - count);
    this._options.onCasualty?.(this._minionCount);
    return this._minionCount;
  }

  // ─── Phase B 전투 및 화력 제어 ───

  /**
   * Phase B 진입 및 군단 화력 엔진 가동 (Zero-Reset Guard)
   * @param snapshot Phase A에서 인계된 불변 자원 스냅샷
   */
  startPhaseB(snapshot?: PhaseAResourceSnapshot): void {
    this._isActive = true;
    this._isPaused = false;

    if (snapshot) {
      if (typeof snapshot.minionCount === 'number') {
        this._minionCount = snapshot.minionCount;
      }
      if (typeof snapshot.stardust === 'number' && !this._resourceManager) {
        this._stardust = snapshot.stardust;
      }
    }

    this._gaugeMultiplier = this._combatConfig.baseGaugeMultiplier;
    this._cooldownTimer = this._combatConfig.cooldown;
    this._totalBarrageDamage = 0;
    this._barrageCount = 0;
  }

  /**
   * 전투 정지
   */
  stop(): void {
    this._isActive = false;
  }

  /**
   * 일시정지 (타이머 동결)
   */
  pause(): void {
    this._isPaused = true;
  }

  /**
   * 재개
   */
  resume(): void {
    this._isPaused = false;
  }

  /**
   * 군단 화력 공식에 따른 단일 발사 피해량 계산
   * @param gaugeMultiplier 게이지 화력 배율 (기본: 현재 배율)
   * @param isEnhanced 별가루 소비 강화 여부
   */
  computeDamage(gaugeMultiplier = this._gaugeMultiplier, isEnhanced = false): number {
    const base =
      this._combatConfig.baseDamage + this._minionCount * this._combatConfig.damagePerMinion;
    const bonus = isEnhanced ? this._combatConfig.stardustBonusDamage : 0;
    return (base + bonus) * gaugeMultiplier;
  }

  /**
   * 별빛 수집 판정 수신: 게이지 충전 및 판정 실패 딜레이
   * @param rating 별 판정 등급 ('Perfect' | 'Good' | 'Late' | 'Miss')
   * @param zoneId 신체 피트니스 존 (1~5: 상체 손 커서 영역)
   */
  recordStarRating(
    rating: StarRating,
    zoneId?: number,
  ): { success: boolean; gaugeMultiplier: number; delayAdded: number } {
    if (!this._isActive) {
      return { success: false, gaugeMultiplier: this._gaugeMultiplier, delayAdded: 0 };
    }

    if (rating === 'Miss') {
      const delay = this._combatConfig.missPenaltyDelay;
      this._cooldownTimer += delay;
      // 게이지 감쇠 (기본 1.0 하한)
      this._gaugeMultiplier = Math.max(
        this._combatConfig.baseGaugeMultiplier,
        this._gaugeMultiplier - 0.2,
      );
      return {
        success: false,
        gaugeMultiplier: this._gaugeMultiplier,
        delayAdded: delay,
      };
    }

    // Zone 1~5 (상체 손 커서 영역) 또는 zoneId 미지정 시 게이지 충전
    if (zoneId === undefined || (zoneId >= 1 && zoneId <= 5)) {
      this._gaugeMultiplier = Math.min(
        this._combatConfig.maxGaugeMultiplier,
        this._gaugeMultiplier + this._combatConfig.gaugePerStar,
      );
      return {
        success: true,
        gaugeMultiplier: this._gaugeMultiplier,
        delayAdded: 0,
      };
    }

    return {
      success: true,
      gaugeMultiplier: this._gaugeMultiplier,
      delayAdded: 0,
    };
  }

  /**
   * 별가루 소비 처리 (지갑 연동 시 PhaseAResourceManager 위임, 미연동 시 로컬 지갑 차감)
   * @param amount 소비할 별가루 수량
   * @param idempotencyKey 중복 차감 방지 키
   */
  consumeStardust(amount: number, idempotencyKey?: string): boolean {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return false;
    }

    if (this._resourceManager) {
      return this._resourceManager.consumeStardust(amount, idempotencyKey);
    }

    if (this._stardust < amount) {
      return false;
    }

    if (idempotencyKey !== undefined) {
      if (this._consumedKeys.has(idempotencyKey)) {
        return false;
      }
      this._consumedKeys.add(idempotencyKey);
    }

    this._stardust -= amount;
    return true;
  }

  /**
   * 강화 탄막 1회에 필요한 별가루 소비 (기본: 5)
   */
  consumeStardustForEnhancedBarrage(idempotencyKey?: string): boolean {
    return this.consumeStardust(this._combatConfig.stardustCost, idempotencyKey);
  }

  /**
   * 보스를 향한 집중 마법 탄막 1회 발사
   * @param options consumeStardust(별가루 강화 소비 시도), idempotencyKey
   */
  fireBarrage(options?: {
    consumeStardust?: boolean;
    idempotencyKey?: string;
  }): { fired: boolean; damage: number; isEnhanced: boolean } {
    if (!this._isActive) {
      return { fired: false, damage: 0, isEnhanced: false };
    }

    if (this._bossController && this._bossController.isDefeated) {
      return { fired: false, damage: 0, isEnhanced: false };
    }

    let isEnhanced = false;
    if (options?.consumeStardust) {
      isEnhanced = this.consumeStardust(
        this._combatConfig.stardustCost,
        options?.idempotencyKey,
      );
    }

    const damage = this.computeDamage(this._gaugeMultiplier, isEnhanced);

    if (this._bossController) {
      this._bossController.takeDamage(damage);
    }

    this._totalBarrageDamage += damage;
    this._barrageCount++;
    this._cooldownTimer = this._combatConfig.cooldown;

    const info: BarrageInfo = {
      damage,
      minionCount: this._minionCount,
      gaugeMultiplier: this._gaugeMultiplier,
      isEnhanced,
    };

    this._options.onBarrageFired?.(info);
    this._eventBus?.emit('troop:barrage', info);

    return { fired: true, damage, isEnhanced };
  }

  /**
   * 매 프레임 업데이트 루프: 쿨다운 감쇠 및 자동 탄막 발사
   * @param dt 델타타임 (초)
   * @param options autoConsumeStardust (별가루 충분 시 자동 강화 사격 여부)
   */
  update(
    dt: number,
    options?: { autoConsumeStardust?: boolean },
  ): { fired: boolean; damage: number; isEnhanced: boolean } | null {
    if (!this._isActive || this._isPaused) return null;

    if (this._bossController && this._bossController.isDefeated) {
      return null;
    }

    this._cooldownTimer -= dt;
    if (this._cooldownTimer <= 0) {
      const consumeStardust =
        options?.autoConsumeStardust === true &&
        this.stardust >= this._combatConfig.stardustCost;
      return this.fireBarrage({ consumeStardust });
    }

    return null;
  }

  /**
   * 전체 상태 초기화 (세션 시작 및 메뉴 복귀용)
   */
  reset(): void {
    this._minionCount = this._initialMinions;
    this._settledRoundIds.clear();
    this._isActive = false;
    this._isPaused = false;
    this._gaugeMultiplier = this._combatConfig.baseGaugeMultiplier;
    this._cooldownTimer = this._combatConfig.cooldown;
    this._stardust = 0;
    this._totalBarrageDamage = 0;
    this._barrageCount = 0;
    this._consumedKeys.clear();
  }
}
