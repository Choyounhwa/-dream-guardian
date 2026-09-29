/**
 * BeatRoundResolver.ts - BEAT MOTION 8박 종료 전투 및 리듬 통계 단일 정산기
 *
 * 답 확정 즉시 처리되던 전투 결과를 답안 8박 종료 시점에 단 1회(Single Point of Settlement) 일괄 처리하고,
 * 별/리듬 통계를 전투 자원(HP/마나/콤보)과 완전히 분리하는 정산 컨트롤러.
 *
 * - 정답 라운드 종료 시 마나 +25, 콤보 +1, 기존 보스 피해(1) 및 마나 100 도달 시 스펠 시전(4) 1회 적용
 * - 오답/미응답(타임아웃) 라운드 종료 시 HP -25 및 콤보 0 리셋 1회 적용
 * - 중복 resolve 차단 (동일 라운드 중복 호출 시 이전 결과 반환 및 전투 자원 변경 없음)
 * - 별 판정(Perfect/Good/Late/Miss) 및 회복 스웨이 통계를 전투 자원과 격리하여 누적 관리
 * - timeout은 오답 전투 결과(HP -25)를 공유하되 통계상 timeoutCount로 독립 분리 기록
 *
 * @see Issue #184 [GAME-ROUND-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #182 [INPUT-STAR-001]
 */

import { DEFAULT_CONFIG } from '../core/Config.js';
import { BattleState } from './BattleState.js';
import { BossController } from './BossController.js';
import { GuardianSystem } from './GuardianSystem.js';
import {
  type BeatRhythmStats,
  type RoundAnswerStatus,
  type RoundResolveResult,
  createDefaultRhythmStats,
} from '../types/result.js';
import type { StarRating } from '../input/StarCollectionInput.js';

export interface BeatRoundResolverOptions {
  battle?: BattleState;
  boss?: BossController;
  guardian?: GuardianSystem;
  onSpellCast?: (damage: number) => void;
  onBossDefeated?: () => void;
  onPlayerDefeated?: () => void;
}

export class BeatRoundResolver {
  private readonly _battle: BattleState;
  private readonly _boss: BossController;
  private readonly _guardian: GuardianSystem;
  private readonly _options: BeatRoundResolverOptions;

  private _rhythmStats: BeatRhythmStats = createDefaultRhythmStats();
  private _currentRoundIndex = 1;
  private _isRoundSettled = false;
  private _lastResolveResult: RoundResolveResult | null = null;

  constructor(options?: BeatRoundResolverOptions) {
    this._options = options ?? {};
    this._battle = this._options.battle ?? new BattleState();
    this._boss = this._options.boss ?? new BossController();
    this._guardian = this._options.guardian ?? new GuardianSystem();
  }

  get battle(): BattleState {
    return this._battle;
  }

  get boss(): BossController {
    return this._boss;
  }

  get guardian(): GuardianSystem {
    return this._guardian;
  }

  get rhythmStats(): Readonly<BeatRhythmStats> {
    return this._rhythmStats;
  }

  get currentRoundIndex(): number {
    return this._currentRoundIndex;
  }

  get isRoundSettled(): boolean {
    return this._isRoundSettled;
  }

  get lastResolveResult(): RoundResolveResult | null {
    return this._lastResolveResult;
  }

  /**
   * 새 라운드 시작 (정산 잠금 해제 및 라운드 번호 갱신)
   */
  startNewRound(roundIndex?: number): void {
    this._currentRoundIndex = roundIndex ?? this._currentRoundIndex + 1;
    this._isRoundSettled = false;
    this._lastResolveResult = null;
  }

  /**
   * 별 리듬 판정 등급 누적 (전투 자원과 완전 분리)
   */
  recordStarRating(rating: StarRating): void {
    switch (rating) {
      case 'Perfect':
        this._rhythmStats.perfectHits++;
        this._rhythmStats.beatStarsCollected++;
        break;
      case 'Good':
        this._rhythmStats.goodHits++;
        this._rhythmStats.beatStarsCollected++;
        break;
      case 'Late':
        this._rhythmStats.lateHits++;
        this._rhythmStats.beatStarsCollected++;
        break;
      case 'Miss':
        this._rhythmStats.missedStars++;
        break;
    }
  }

  /**
   * 오답/미응답 후 스웨이 회복 운동 횟수 누적
   */
  recordRecoverySway(count = 1): void {
    this._rhythmStats.recoverySwayCount += count;
  }

  /**
   * 라운드 8박 종료 시점 단일 정산 수행
   * @param status 정답('correct'), 오답('wrong'), 또는 미응답 타임아웃('timeout')
   */
  resolveRound(status: RoundAnswerStatus): RoundResolveResult {
    // 1. 중복 정산 차단 (Idempotency Guard: 동일 라운드 중복 호출 시 이전 결과 반환)
    if (this._isRoundSettled && this._lastResolveResult) {
      return this._lastResolveResult;
    }

    let manaGained = 0;
    let damageDealt = 0;
    let damageTaken = 0;
    let spellCast = false;

    if (status === 'correct') {
      // 정답: 마나 +25, 콤보 +1
      this._battle.onCorrect();
      manaGained = DEFAULT_CONFIG.mana.correctReward;

      // 보스 기본 피해 (correctDamage: 1)
      const baseDamage = DEFAULT_CONFIG.battle.correctDamage;
      damageDealt += baseDamage;
      this._boss.takeDamage(baseDamage);

      // 마나 100 도달 시 수호신 스펠 자동 시전 (spellDamage: 4)
      if (this._battle.trySpendMana()) {
        spellCast = true;
        const spellDmg = this._guardian.cast();
        damageDealt += spellDmg;
        this._boss.takeDamage(spellDmg);
        this._options.onSpellCast?.(spellDmg);
      }

      if (this._boss.isDefeated) {
        this._options.onBossDefeated?.();
      }
    } else if (status === 'wrong') {
      // 오답: 콤보 0 리셋, wrongAnswerCount 누적 (Issue #225: 직접 피해 및 보스 반격 제거)
      this._rhythmStats.wrongAnswerCount++;
      this._battle.recordWrongAnswer();
      damageTaken = 0;

      if (!this._battle.isAlive) {
        this._options.onPlayerDefeated?.();
      }
    } else if (status === 'timeout') {
      // 타임아웃(미응답): 콤보 0 리셋, timeoutCount 누적 (Issue #225: 직접 피해 및 보스 반격 제거)
      this._rhythmStats.timeoutCount++;
      this._battle.recordWrongAnswer();
      damageTaken = 0;

      if (!this._battle.isAlive) {
        this._options.onPlayerDefeated?.();
      }
    }

    this._isRoundSettled = true;

    const result: RoundResolveResult = {
      roundIndex: this._currentRoundIndex,
      status,
      manaGained,
      damageDealt,
      damageTaken,
      combo: this._battle.combo,
      spellCast,
      bossDefeated: this._boss.isDefeated,
      playerDefeated: !this._battle.isAlive,
      playerHp: this._battle.hp,
      bossHp: this._boss.hp,
      playerMana: this._battle.mana,
      rhythmStats: { ...this._rhythmStats },
    };

    this._lastResolveResult = result;
    return result;
  }

  /**
   * 세션 및 라운드 상태 초기화
   */
  reset(): void {
    this._battle.reset();
    this._boss.reset();
    this._guardian.reset();
    this._rhythmStats = createDefaultRhythmStats();
    this._currentRoundIndex = 1;
    this._isRoundSettled = false;
    this._lastResolveResult = null;
  }
}
