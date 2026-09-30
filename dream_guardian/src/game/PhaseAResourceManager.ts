/**
 * PhaseAResourceManager.ts - Phase A 미니언 군단 및 별가루 자원 통합 관리자
 *
 * - MinionTroopManager(초기 3+1, 정답당 +1, 최대 13)와 별가루 자원 모델(소비 가능 잔량 및 통계 분리) 통합
 * - 별 판정별 승인 적립 규격 (Perfect 4, Good 3, Late 2, Miss 0)
 * - roundId 및 noteId 기준 중복 적립 원천 차단 (Idempotency Guard)
 * - 소비 API (consumeStardust): 잔량 초과 거부, 음수/비정상 수치 거부, idempotencyKey 기반 중복 차감 방지
 * - Phase B 인계 불변 스냅샷(PhaseAResourceSnapshot) 계약 제공 (스냅샷 취득 시 내부 상태 리셋 없음)
 *
 * @see Issue #242 [GAME-PHASE-A-RESOURCES-001]
 * @see Issue #240 [BATTLE-PHASE-A-SETTLEMENT-001]
 * @see Issue #241 [GAME-STAGE-HANDOFF-001]
 * @see Issue #194 [MINION-TROOP-001]
 */

import { DEFAULT_BATTLE_CONFIG, type StardustRewardConfig } from '../../config/battle.config.js';
import { MinionTroopManager, type MinionTroopConfig } from './MinionTroopManager.js';
import type { BattleState } from './BattleState.js';
import type { BossController } from './BossController.js';
import type { GuardianSystem } from './GuardianSystem.js';
import {
  type PhaseAResourceSnapshot,
  type RoundAnswerStatus,
  createDefaultRhythmStats,
} from '../types/result.js';
import type { StarRating } from '../input/StarCollectionInput.js';

export interface PhaseAResourceManagerOptions {
  troopConfig?: MinionTroopConfig;
  troopManager?: MinionTroopManager;
  stardustReward?: StardustRewardConfig;
  battle?: BattleState;
  boss?: BossController;
  guardian?: GuardianSystem;
}

export class PhaseAResourceManager {
  private readonly _troopManager: MinionTroopManager;
  private readonly _stardustReward: StardustRewardConfig;
  private readonly _battle?: BattleState;
  private readonly _boss?: BossController;
  private readonly _guardian?: GuardianSystem;

  private _stardust = 0;
  private _totalStardustEarned = 0;
  private readonly _recordedNoteIds = new Set<string | number>();
  private readonly _consumedKeys = new Set<string>();

  constructor(options?: PhaseAResourceManagerOptions) {
    this._troopManager =
      options?.troopManager ?? new MinionTroopManager(options?.troopConfig);
    this._stardustReward =
      options?.stardustReward ?? DEFAULT_BATTLE_CONFIG.stardustReward;
    this._battle = options?.battle;
    this._boss = options?.boss;
    this._guardian = options?.guardian;
  }

  /** 미니언 군단 매니저 */
  get troopManager(): MinionTroopManager {
    return this._troopManager;
  }

  /** 현재 보유한 미니언 수 (기본 3, 최대 13) */
  get minionCount(): number {
    return this._troopManager.minionCount;
  }

  /** 수호신 개체 수 (1체 고정) */
  get guardianCount(): number {
    return this._troopManager.guardianCount;
  }

  /** 전체 아군 군단 총합 (미니언 + 수호신) */
  get totalTroopCount(): number {
    return this._troopManager.totalTroopCount;
  }

  /** 최대 군단 상한 도달 여부 */
  get isMaxed(): boolean {
    return this._troopManager.isMaxed;
  }

  /** 현재 소비 가능한 별가루 잔량 */
  get stardust(): number {
    return this._stardust;
  }

  /** 누적 획득한 총 별가루 수량 (통계용) */
  get totalStardustEarned(): number {
    return this._totalStardustEarned;
  }

  /**
   * 별 노트 판정에 따른 별가루 적립 (Idempotent per noteId)
   * @param rating 별 판정 등급 ('Perfect' | 'Good' | 'Late' | 'Miss')
   * @param noteId 선택적 노트 고유 식별자 (중복 평가 시 추가 적립 0)
   * @returns 이번 평가로 획득한 별가루 수치
   */
  recordStarRating(rating: StarRating, noteId?: string | number): number {
    if (noteId !== undefined) {
      if (this._recordedNoteIds.has(noteId)) {
        return 0;
      }
      this._recordedNoteIds.add(noteId);
    }

    const points = this._stardustReward[rating] ?? 0;
    this._stardust += points;
    this._totalStardustEarned += points;
    return points;
  }

  /**
   * 라운드 정산 결과 수신 (정답 시 미니언 +1, 오답/타임아웃 시 보존)
   */
  onRoundSettled(status: RoundAnswerStatus, roundId?: string | number): number {
    return this._troopManager.onRoundSettled(status, roundId);
  }

  /**
   * 별가루 소비 API 계약 (Phase B 전용, #194 및 #241 연동)
   * @param amount 소비할 별가루 수량 (양의 유한 정수)
   * @param idempotencyKey 중복 차감 방지용 고유 키 (동일 키 재요청 시 거부)
   * @returns 소비 성공 여부 (잔량 초과, 음수/NaN, 또는 중복 키 사용 시 false)
   */
  consumeStardust(amount: number, idempotencyKey?: string): boolean {
    // 1. 유효 수치 검증: 양의 유한수여야 함
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return false;
    }

    // 2. 잔량 초과 검증
    if (this._stardust < amount) {
      return false;
    }

    // 3. 멱등성 검증: 동일 키 중복 차감 방지
    if (idempotencyKey !== undefined) {
      if (this._consumedKeys.has(idempotencyKey)) {
        return false;
      }
      this._consumedKeys.add(idempotencyKey);
    }

    // 4. 잔량 차감 (누적 통계는 보존)
    this._stardust -= amount;
    return true;
  }

  /**
   * Phase A 현재 자원 및 세션 상태의 불변 스냅샷 생성
   * (읽기/인계 준비가 내부 상태의 변경이나 리셋을 유발하지 않음)
   */
  createSnapshot(extra?: Partial<PhaseAResourceSnapshot>): PhaseAResourceSnapshot {
    const battle = this._battle;
    const boss = this._boss;
    const guardian = this._guardian;

    return Object.freeze({
      playerHp: extra?.playerHp ?? battle?.hp ?? 100,
      maxPlayerHp: extra?.maxPlayerHp ?? battle?.maxHp ?? 100,
      playerMana: extra?.playerMana ?? battle?.mana ?? 0,
      bossHp: extra?.bossHp ?? boss?.hp ?? 10,
      maxBossHp: extra?.maxBossHp ?? boss?.maxHp ?? 10,
      bossChapter: extra?.bossChapter ?? boss?.chapter ?? 1,
      combo: extra?.combo ?? battle?.combo ?? 0,
      maxCombo: extra?.maxCombo ?? battle?.maxCombo ?? 0,
      correctCount: extra?.correctCount ?? battle?.correctCount ?? 0,
      wrongCount: extra?.wrongCount ?? 0,
      timeoutCount: extra?.timeoutCount ?? 0,
      totalSettledQuestions: extra?.totalSettledQuestions ?? (battle?.correctCount ?? 0),
      guardianStage: extra?.guardianStage ?? guardian?.stage ?? 1,
      guardianCastCount: extra?.guardianCastCount ?? guardian?.castCount ?? 0,
      minionCount: this._troopManager.minionCount,
      guardianCount: this._troopManager.guardianCount,
      stardust: this._stardust,
      totalStardustEarned: this._totalStardustEarned,
      rhythmStats: extra?.rhythmStats ?? Object.freeze(createDefaultRhythmStats()),
      isPhaseAComplete: extra?.isPhaseAComplete ?? false,
      isPlayerDefeated: extra?.isPlayerDefeated ?? (battle ? !battle.isAlive : false),
      isBossDefeated: extra?.isBossDefeated ?? (boss ? boss.isDefeated : false),
      timestamp: extra?.timestamp ?? Date.now(),
    });
  }

  /**
   * createSnapshot의 별칭
   */
  getResourceSnapshot(extra?: Partial<PhaseAResourceSnapshot>): PhaseAResourceSnapshot {
    return this.createSnapshot(extra);
  }

  /**
   * 자원 상태 초기화
   */
  reset(): void {
    this._troopManager.reset();
    this._stardust = 0;
    this._totalStardustEarned = 0;
    this._recordedNoteIds.clear();
    this._consumedKeys.clear();
  }
}
