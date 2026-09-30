/**
 * MinionTroopManager.ts - Phase A 아군 미니언 군단(3~13체) 수량 및 증원 관리자
 *
 * - 초기 군단: 기본 미니언 3마리 + 수호신 1마리 (총 4체)
 * - Phase A 정답 정산당 미니언 +1 증원 (최대 13마리 상한)
 * - 오답(wrong) 및 타임아웃(timeout) 시 미니언 증원 0 (기존 군단 및 수호신 100% 보존)
 * - 동일 roundId에 대한 중복 정산 시 증원 0 (멱등성 보장)
 * - Phase B 탈락 및 화력 엔진(#194)과의 책임 분리를 위해 Phase A 자원 모델로 독립 관리
 *
 * @see Issue #242 [GAME-PHASE-A-RESOURCES-001]
 * @see Issue #194 [MINION-TROOP-001]
 * @see GDD 3.1 전투 시스템 및 미니언 스펙
 */

import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';
import type { RoundAnswerStatus } from '../types/result.js';

export interface MinionTroopConfig {
  initialMinions?: number;
  maxMinions?: number;
  minionsPerCorrect?: number;
}

export class MinionTroopManager {
  private readonly _initialMinions: number;
  private readonly _maxMinions: number;
  private readonly _minionsPerCorrect: number;

  private _minionCount: number;
  private readonly _guardianCount = 1;
  private readonly _settledRoundIds = new Set<string | number>();

  constructor(config?: MinionTroopConfig) {
    this._initialMinions = config?.initialMinions ?? DEFAULT_BATTLE_CONFIG.initialMinions;
    this._maxMinions = config?.maxMinions ?? DEFAULT_BATTLE_CONFIG.maxMinions;
    this._minionsPerCorrect = config?.minionsPerCorrect ?? DEFAULT_BATTLE_CONFIG.minionsPerCorrect;
    this._minionCount = this._initialMinions;
  }

  /** 현재 보유한 미니언 수 (기본 3, 최대 13) */
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
    return this._minionCount;
  }

  /**
   * 상태 초기화 (초기 3마리로 복원 및 정산 기록 초기화)
   */
  reset(): void {
    this._minionCount = this._initialMinions;
    this._settledRoundIds.clear();
  }
}
