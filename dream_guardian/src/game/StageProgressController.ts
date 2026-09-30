/**
 * StageProgressController.ts - Phase A 라운드 진행 카운터 및 Phase B 단일 자원 인계 컨트롤러
 *
 * 10문제의 라운드 정산 완료 후 Phase A를 종료하고,
 * 10번째 라운드 최종 판정 및 정산 완료 시점에 Phase B(BOSS_CLIMAX)로 정확히 1회 전환하며,
 * 축적된 Phase A 불변 자원 스냅샷(PhaseAResourceSnapshot)을 단일 인계한다.
 *
 * - 1~9번째 라운드 정산 완료 시: 다음 문제(RUN_QUESTION) 진행 예약/통지
 * - 10번째 라운드 정산 완료 시:
 *   - 플레이어 HP <= 0 (오답/타임아웃/장판 피격 누적 등): GAMEOVER 최우선 처리 (Phase B 인계 0회)
 *   - 플레이어 생존 시: BOSS_CLIMAX(Phase B) 단 1회 전이 및 불변 자원 스냅샷 단일 인계
 *   - 11번째 문제 스케줄링 차단 (정확히 0회)
 *   - Phase B 진입 시 플레이어 자원 reset 절대 금지
 * - 멱등성 및 세션 안전성:
 *   - 중복 완료 콜백, 프레임 지연, 비동기 완료 타이밍에서도 인계 1회 보장
 *   - 세션 취소/메뉴 복귀 시 SessionLifecycle 연동을 통한 고아 예약 차단
 *   - reset()을 통한 깨끗한 세션 초기화 지원
 *
 * @see Issue #241 [GAME-STAGE-HANDOFF-001]
 * @see Issue #240 [BATTLE-PHASE-A-SETTLEMENT-001]
 * @see Issue #242 [GAME-PHASE-A-RESOURCES-001]
 */

import { DEFAULT_CONFIG } from '../core/Config.js';
import type { StateMachine } from '../core/StateMachine.js';
import type { SessionLifecycle } from '../core/SessionLifecycle.js';
import {
  type PhaseAResourceSnapshot,
  type RoundResolveResult,
  createDefaultRhythmStats,
} from '../types/result.js';

export interface StageResourceProvider {
  getResourceSnapshot(): PhaseAResourceSnapshot;
}

export interface StageProgressControllerOptions {
  /** Phase A 총 문제 라운드 수 (기본: Config의 phaseAQuestionCount = 10) */
  maxRounds?: number;
  /** 상태 머신 인스턴스 (주입 시 BOSS_CLIMAX / RUN_QUESTION / GAMEOVER 상태 전이 수행) */
  stateMachine?: StateMachine;
  /** 세션 수명 관리자 (주입 시 세션 바인딩 비동기 예약 및 중복 차단) */
  sessionLifecycle?: SessionLifecycle;
  /** Phase A 자원 및 통계 스냅샷 제공자 (예: BeatRoundResolver 또는 PhaseAResourceManager) */
  resourceProvider?: StageResourceProvider;
  /** 다음 라운드 진행 콜백 (1~9번째 라운드 완료 시) */
  onAdvanceToNextRound?: (nextRoundIndex: number) => void;
  /** Phase B 진입 및 단일 자원 인계 콜백 (10번째 라운드 완료 시 정확히 1회 호출) */
  onEnterBossClimax?: (snapshot: PhaseAResourceSnapshot) => void;
  /** 플레이어 패배(HP 0) 콜백 */
  onGameOver?: (snapshot: PhaseAResourceSnapshot) => void;
  /** 라운드 전환 / Phase B 전환 대기 지연(ms) (기본 800ms) */
  advanceDelayMs?: number;
}

export interface HandleRoundSettledOptions {
  /** 지연 없이 즉시 전이/콜백 실행 여부 (테스트 및 즉시 모드) */
  immediate?: boolean;
  /** 커스텀 지연 시간(ms) */
  delayMs?: number;
  /** 명시적 자원 스냅샷 (미제공 시 resourceProvider에서 취득) */
  snapshot?: PhaseAResourceSnapshot;
  /** 라운드 식별자 (미제공 시 resolveResult.roundIndex 사용) */
  roundId?: string | number;
}

export type StageProgressDecision =
  | {
      type: 'NEXT_ROUND';
      nextRoundIndex: number;
      settledRoundCount: number;
    }
  | {
      type: 'BOSS_CLIMAX';
      snapshot: PhaseAResourceSnapshot;
      settledRoundCount: number;
    }
  | {
      type: 'GAMEOVER';
      snapshot: PhaseAResourceSnapshot;
      settledRoundCount: number;
    }
  | {
      type: 'IGNORED';
      reason: 'ALREADY_SETTLED_ROUND' | 'ALREADY_HANDED_OFF' | 'PLAYER_DEFEATED_EARLIER';
      settledRoundCount: number;
    };

export class StageProgressController {
  private readonly _maxRounds: number;
  private readonly _stateMachine?: StateMachine;
  private readonly _sessionLifecycle?: SessionLifecycle;
  private _resourceProvider?: StageResourceProvider;
  private _onAdvanceToNextRound?: (nextRoundIndex: number) => void;
  private _onEnterBossClimax?: (snapshot: PhaseAResourceSnapshot) => void;
  private _onGameOver?: (snapshot: PhaseAResourceSnapshot) => void;
  private readonly _advanceDelayMs: number;

  private readonly _phaseBReceivers = new Set<(snapshot: PhaseAResourceSnapshot) => void>();
  private readonly _settledRoundIds = new Set<string | number>();

  private _hasEnteredBossClimax = false;
  private _handoffCount = 0;
  private _scheduledNextRoundCount = 0;
  private _phaseBSnapshot: PhaseAResourceSnapshot | null = null;
  private _isGameOver = false;
  private _pendingTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(options?: StageProgressControllerOptions) {
    this._maxRounds = options?.maxRounds ?? (DEFAULT_CONFIG.battle.phaseAQuestionCount ?? 10);
    this._stateMachine = options?.stateMachine;
    this._sessionLifecycle = options?.sessionLifecycle;
    this._resourceProvider = options?.resourceProvider;
    this._onAdvanceToNextRound = options?.onAdvanceToNextRound;
    this._onEnterBossClimax = options?.onEnterBossClimax;
    this._onGameOver = options?.onGameOver;
    this._advanceDelayMs = options?.advanceDelayMs ?? 800;
  }

  /** Phase A 총 목표 라운드 수 */
  get maxRounds(): number {
    return this._maxRounds;
  }

  /** 정산 완료된 총 라운드 수 */
  get settledRoundCount(): number {
    return this._settledRoundIds.size;
  }

  /** Phase A 총 10문제 정산 완료 여부 */
  get isPhaseAComplete(): boolean {
    return this._settledRoundIds.size >= this._maxRounds;
  }

  /** Phase B(BOSS_CLIMAX) 진입 여부 */
  get hasEnteredBossClimax(): boolean {
    return this._hasEnteredBossClimax;
  }

  /** Phase B 자원 인계 횟수 (최대 1회) */
  get handoffCount(): number {
    return this._handoffCount;
  }

  /** 다음 문제 스케줄링된 횟수 (최대 9회, 11번째 문제 스케줄링 0회) */
  get scheduledNextRoundCount(): number {
    return this._scheduledNextRoundCount;
  }

  /** 인계된 Phase B 불변 자원 스냅샷 */
  get phaseBSnapshot(): PhaseAResourceSnapshot | null {
    return this._phaseBSnapshot;
  }

  /** 게임오버 상태 여부 */
  get isGameOver(): boolean {
    return this._isGameOver;
  }

  /** Phase B 자원 수신자 등록 (구독 해제 함수 반환) */
  registerPhaseBReceiver(receiver: (snapshot: PhaseAResourceSnapshot) => void): () => void {
    this._phaseBReceivers.add(receiver);
    return () => {
      this._phaseBReceivers.delete(receiver);
    };
  }

  /** 자원 제공자 주입/교체 */
  setResourceProvider(provider: StageResourceProvider): void {
    this._resourceProvider = provider;
  }

  /**
   * 라운드 8박 정산 완료 이벤트 수신 및 진행 판정/전환
   */
  handleRoundSettled(
    resolveResult: RoundResolveResult | { playerDefeated?: boolean; playerHp?: number; roundIndex?: number },
    options?: HandleRoundSettledOptions
  ): StageProgressDecision {
    const roundKey = options?.roundId ?? resolveResult.roundIndex ?? (this._settledRoundIds.size + 1);

    // 1. 중복 정산 및 종료 상태 가드 (Idempotency Guard)
    if (this._settledRoundIds.has(roundKey)) {
      return {
        type: 'IGNORED',
        reason: 'ALREADY_SETTLED_ROUND',
        settledRoundCount: this._settledRoundIds.size,
      };
    }
    if (this._hasEnteredBossClimax) {
      return {
        type: 'IGNORED',
        reason: 'ALREADY_HANDED_OFF',
        settledRoundCount: this._settledRoundIds.size,
      };
    }
    if (this._isGameOver) {
      return {
        type: 'IGNORED',
        reason: 'PLAYER_DEFEATED_EARLIER',
        settledRoundCount: this._settledRoundIds.size,
      };
    }

    this._settledRoundIds.add(roundKey);
    const currentCount = this._settledRoundIds.size;
    const isPlayerDefeated =
      Boolean(resolveResult.playerDefeated) ||
      (typeof resolveResult.playerHp === 'number' && resolveResult.playerHp <= 0);

    // 2. 플레이어 패배 우선순위 (HP <= 0 시 Phase B 인계 0회 및 GAMEOVER)
    if (isPlayerDefeated) {
      this._isGameOver = true;
      const snapshot = options?.snapshot ?? this._obtainSnapshot(resolveResult);

      const executeGameOver = () => {
        if (this._stateMachine) {
          this._stateMachine.changeState('GAMEOVER');
        }
        this._onGameOver?.(snapshot);
      };

      if (options?.immediate || options?.delayMs === 0) {
        executeGameOver();
      } else {
        this._schedule(executeGameOver, options?.delayMs);
      }

      return {
        type: 'GAMEOVER',
        snapshot,
        settledRoundCount: currentCount,
      };
    }

    // 3. 1~9번째 라운드: 다음 문제(RUN_QUESTION) 진행
    if (currentCount < this._maxRounds) {
      const nextRoundIndex = currentCount + 1;
      this._scheduledNextRoundCount++;

      const executeNextRound = () => {
        if (this._hasEnteredBossClimax || this._isGameOver) return;
        this._onAdvanceToNextRound?.(nextRoundIndex);
      };

      if (options?.immediate || options?.delayMs === 0) {
        executeNextRound();
      } else {
        this._schedule(executeNextRound, options?.delayMs);
      }

      return {
        type: 'NEXT_ROUND',
        nextRoundIndex,
        settledRoundCount: currentCount,
      };
    }

    // 4. 10번째 라운드 정산 완료: BOSS_CLIMAX 단 1회 전이 및 자원 단일 인계
    const snapshot = options?.snapshot ?? this._obtainSnapshot(resolveResult);

    const executeClimaxHandoff = () => {
      if (this._hasEnteredBossClimax || this._isGameOver) return;

      this._hasEnteredBossClimax = true;
      this._handoffCount++;
      this._phaseBSnapshot = snapshot;

      if (this._stateMachine) {
        this._stateMachine.changeState('BOSS_CLIMAX');
      }

      this._onEnterBossClimax?.(snapshot);
      for (const receiver of this._phaseBReceivers) {
        receiver(snapshot);
      }
    };

    if (options?.immediate || options?.delayMs === 0) {
      executeClimaxHandoff();
    } else {
      this._schedule(executeClimaxHandoff, options?.delayMs);
    }

    return {
      type: 'BOSS_CLIMAX',
      snapshot,
      settledRoundCount: currentCount,
    };
  }

  /**
   * 세션 초기화
   */
  reset(): void {
    if (this._pendingTimeoutId) {
      clearTimeout(this._pendingTimeoutId);
      this._pendingTimeoutId = undefined;
    }
    this._settledRoundIds.clear();
    this._hasEnteredBossClimax = false;
    this._handoffCount = 0;
    this._scheduledNextRoundCount = 0;
    this._phaseBSnapshot = null;
    this._isGameOver = false;
  }

  private _schedule(action: () => void, customDelayMs?: number): void {
    const delay = customDelayMs ?? this._advanceDelayMs;
    if (delay <= 0) {
      action();
      return;
    }
    if (this._sessionLifecycle) {
      this._sessionLifecycle.schedule(action, delay);
    } else {
      this._pendingTimeoutId = setTimeout(action, delay);
    }
  }

  private _obtainSnapshot(
    resolveResult: RoundResolveResult | { playerDefeated?: boolean; playerHp?: number }
  ): PhaseAResourceSnapshot {
    if (this._resourceProvider) {
      return this._resourceProvider.getResourceSnapshot();
    }

    const rhythmStats =
      'rhythmStats' in resolveResult && resolveResult.rhythmStats
        ? resolveResult.rhythmStats
        : createDefaultRhythmStats();

    return Object.freeze({
      playerHp: resolveResult.playerHp ?? 100,
      maxPlayerHp: 100,
      playerMana:
        'playerMana' in resolveResult && typeof resolveResult.playerMana === 'number'
          ? resolveResult.playerMana
          : 0,
      bossHp:
        'bossHp' in resolveResult && typeof resolveResult.bossHp === 'number'
          ? resolveResult.bossHp
          : 10,
      maxBossHp: 10,
      bossChapter: 1,
      combo:
        'combo' in resolveResult && typeof resolveResult.combo === 'number'
          ? resolveResult.combo
          : 0,
      maxCombo:
        'combo' in resolveResult && typeof resolveResult.combo === 'number'
          ? resolveResult.combo
          : 0,
      correctCount: 0,
      wrongCount: rhythmStats.wrongAnswerCount,
      timeoutCount: rhythmStats.timeoutCount,
      totalSettledQuestions: this._settledRoundIds.size,
      guardianStage: 1,
      guardianCastCount: 0,
      minionCount: 3,
      guardianCount: 1,
      stardust: 0,
      totalStardustEarned: 0,
      rhythmStats: Object.freeze({ ...rhythmStats }),
      isPhaseAComplete: this.isPhaseAComplete,
      isPlayerDefeated: Boolean(
        resolveResult.playerDefeated ||
          (resolveResult.playerHp !== undefined && resolveResult.playerHp <= 0)
      ),
      isBossDefeated: false,
      timestamp: Date.now(),
    });
  }
}
