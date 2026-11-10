/**
 * AssaultProgressController.ts - 보스 접근전(Boss Assault) 접근 진행 및 종료 의도 판정 컨트롤러
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.2, 10.1, 11.2, 13.1, 15.2-B1, 15.3-C3)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-18 / Issue #520)
 *
 * 절대 규칙:
 * 1. 진행도(Progress) 계산 (A14):
 *    - 정상 완료된 요약(completedQuestions: 1)만 중복 없이 집계하여 완료 라운드/목표 라운드(targetRounds) 비율을 계산한다.
 *    - 오답이 많더라도 생존하여 라운드를 마쳤다면 전진한다(A14).
 *    - 중단/사망 라운드(completedQuestions: 0, isAborted: true)나 중복 요약 유입 시 진행도 증가 0회.
 * 2. 사망 최우선 정책 (A15, A22):
 *    - HP === 0 (또는 사망 상태) 발생 시, 목표 달성 여부나 다음 라운드 의도보다 항상 game_over(플레이어 패배) 의도가 절대적 최우선.
 * 3. 목표 달성 및 결전 인계(Handover) 스냅샷 (A22):
 *    - 목표 라운드에 정상 도달하고 생존한 경우: handover_climax 의도와 함께 불변 인계 스냅샷(AssaultHandoverSnapshot)을 최대 1회 발행.
 *    - 마지막 라운드 도달 시 추가 next_round 발행 0회.
 *    - MVP에서는 인계 스냅샷만 생성하고 직접 승리 처리나 미구현 결전 모드 강제 실행을 배제한다.
 * 4. 아키텍처 제약:
 *    - StateMachine 직접 전환 0회, HP 직접 변경 0회, 다음 문제 생성 0회 (순수 의도 산출 컨트롤러).
 *    - 입력 summary/HP 원본 불변, 반환 객체 완전 불변(deepFreeze).
 */

import type {
  SessionId,
  RoundId,
  RulesVersion,
  AssaultGameMode,
} from '../../types/assault.js';
import {
  type AssaultRoundSummaryData,
  type AssaultRatingCounts,
  deepFreeze,
} from './AssaultRoundSummary.js';

// ─── 1. 의도 및 스냅샷 타입 정의 ───

/** 진행 판정 결과 의도(Intent) */
export type AssaultProgressIntentKind =
  | 'next_round'
  | 'handover_climax'
  | 'game_over'
  | 'none';

/** 누적 요약 통계 인터페이스 */
export interface AssaultCumulativeStats {
  readonly totalCompletedQuestions: number;
  readonly totalCorrectHits: number;
  readonly totalWrongHits: number;
  readonly totalTimeoutHits: number;
  readonly totalEvadeSuccessCount: number;
  readonly totalSquatFailCount: number;
  readonly totalEncounters: number;
  readonly totalAttemptedAnswerHits: number;
  readonly ratingCounts: AssaultRatingCounts;
  readonly maxCombo: number;
  readonly totalPlayerDamage: number;
  readonly totalBossDamage: number;
  readonly totalActualDamage: number;
  readonly totalRequestedDamage: number;
  readonly totalActiveDurationSeconds: number;
  readonly processedRoundIds: readonly RoundId[];
}

/** 결전 인계 불변 스냅샷 인터페이스 (DOC-14 §10.1, A22) */
export interface AssaultHandoverSnapshot {
  readonly sessionId: SessionId;
  readonly mode: AssaultGameMode;
  readonly rulesVersion: RulesVersion;
  readonly finalHp: number;
  readonly targetRounds: number;
  readonly completedRounds: number;
  readonly stats: AssaultCumulativeStats;
  readonly timestampMs: number;
}

/** 진행 판정 결과 인터페이스 */
export interface AssaultProgressEvaluation {
  readonly intent: AssaultProgressIntentKind;
  readonly progress: number;
  readonly completedRounds: number;
  readonly targetRounds: number;
  readonly isTargetReached: boolean;
  readonly isGameOver: boolean;
  readonly handoverSnapshot: AssaultHandoverSnapshot | null;
  readonly reason?: string;
}

/** 컨트롤러 생성 옵션 */
export interface AssaultProgressControllerOptions {
  /** 세션 식별자 */
  sessionId?: SessionId;
  /** 목표 라운드 수 (기본: 10, DOC-14 §10.1) */
  targetRounds?: number;
  /** 게임 모드 (기본: 'boss_assault') */
  mode?: AssaultGameMode;
  /** 규칙 계약 버전 (기본: '0.3.0') */
  rulesVersion?: RulesVersion;
}

// ─── 2. AssaultProgressController 클래스 구현 ───

export class AssaultProgressController {
  private readonly _targetRounds: number;
  private readonly _mode: AssaultGameMode;
  private readonly _rulesVersion: RulesVersion;
  private _sessionId: SessionId | null;

  private _completedRoundIds = new Set<RoundId>();
  private _processedSummaries: AssaultRoundSummaryData[] = [];
  private _isGameOver = false;
  private _handoverSnapshot: AssaultHandoverSnapshot | null = null;
  private _handoverCount = 0;
  private _scheduledNextRoundCount = 0;

  constructor(options?: AssaultProgressControllerOptions) {
    const target = options?.targetRounds ?? 10;
    if (
      typeof target !== 'number' ||
      !Number.isInteger(target) ||
      target <= 0 ||
      Number.isNaN(target)
    ) {
      throw new Error(`Invalid targetRounds: must be a positive integer, got ${target}`);
    }

    this._targetRounds = target;
    this._sessionId = options?.sessionId ?? null;
    this._mode = options?.mode ?? 'boss_assault';
    this._rulesVersion = options?.rulesVersion ?? '0.3.0';
  }

  // ─── Getters ───

  /** 설정된 목표 라운드 수 */
  public get targetRounds(): number {
    return this._targetRounds;
  }

  /** 완료된 고유 라운드 수 */
  public get completedRounds(): number {
    return this._completedRoundIds.size;
  }

  /** 현재 접근 진행도 (0.0 ~ 1.0) */
  public get progress(): number {
    return Math.min(1.0, this._completedRoundIds.size / this._targetRounds);
  }

  /** 목표 라운드 도달 여부 */
  public get isTargetReached(): boolean {
    return this._completedRoundIds.size >= this._targetRounds;
  }

  /** 플레이어 사망(게임오버) 상태 여부 */
  public get isGameOver(): boolean {
    return this._isGameOver;
  }

  /** 결전 인계 스냅샷 발행 횟수 (최대 1회) */
  public get handoverCount(): number {
    return this._handoverCount;
  }

  /** 다음 문제 스케줄링 횟수 */
  public get scheduledNextRoundCount(): number {
    return this._scheduledNextRoundCount;
  }

  /** 발행된 결전 인계 스냅샷 */
  public get handoverSnapshot(): AssaultHandoverSnapshot | null {
    return this._handoverSnapshot;
  }

  /** 처리 완료된 고유 라운드 ID 목록 */
  public get processedRoundIds(): readonly RoundId[] {
    return Array.from(this._completedRoundIds);
  }

  // ─── 의도 산출 메서드 ───

  /**
   * 라운드 요약과 잔여 HP를 입력받아 접근 진행도와 전이 의도를 순수 산출한다.
   *
   * @param summary 불변 라운드 요약 DTO
   * @param playerHp 현재 플레이어 잔여 HP
   * @param options 추가 타임스탬프 등 메타 옵션
   */
  public evaluate(
    summary: AssaultRoundSummaryData,
    playerHp: number,
    options?: { timestampMs?: number }
  ): AssaultProgressEvaluation {
    if (!this._sessionId && summary.sessionId) {
      this._sessionId = summary.sessionId;
    }

    // 1. 사망 최우선 정책 (A15, A22)
    // HP <= 0 이거나 이미 게임오버 상태, 또는 요약상 사망인 경우 즉시 game_over 반환
    if (this._isGameOver || playerHp <= 0 || summary.isDefeated) {
      this._isGameOver = true;
      return deepFreeze({
        intent: 'game_over',
        progress: this.progress,
        completedRounds: this._completedRoundIds.size,
        targetRounds: this._targetRounds,
        isTargetReached: this.isTargetReached,
        isGameOver: true,
        handoverSnapshot: null,
        reason: 'Player defeated (HP <= 0)',
      });
    }

    // 2. 이미 결전 인계가 완료된 경우 추가 전이 차단
    if (this._handoverCount >= 1) {
      return deepFreeze({
        intent: 'none',
        progress: this.progress,
        completedRounds: this._completedRoundIds.size,
        targetRounds: this._targetRounds,
        isTargetReached: true,
        isGameOver: false,
        handoverSnapshot: this._handoverSnapshot,
        reason: 'Target already reached and handover completed',
      });
    }

    // 3. 중단(aborted) 또는 미완료 라운드 체크 (진행도 증가 0회)
    if (summary.isAborted || summary.completedQuestions === 0) {
      return deepFreeze({
        intent: 'none',
        progress: this.progress,
        completedRounds: this._completedRoundIds.size,
        targetRounds: this._targetRounds,
        isTargetReached: this.isTargetReached,
        isGameOver: false,
        handoverSnapshot: null,
        reason: 'Round was aborted or incomplete',
      });
    }

    // 4. 동일 라운드 중복 요약 체크 (A14 멱등성: 진행도 증가 0회)
    if (this._completedRoundIds.has(summary.roundId)) {
      return deepFreeze({
        intent: 'none',
        progress: this.progress,
        completedRounds: this._completedRoundIds.size,
        targetRounds: this._targetRounds,
        isTargetReached: this.isTargetReached,
        isGameOver: false,
        handoverSnapshot: null,
        reason: 'Duplicate round summary retransmission',
      });
    }

    // 5. 정상 완료 라운드 등록 (A14: 전부 오답이어도 생존 완료 시 전진)
    this._completedRoundIds.add(summary.roundId);
    this._processedSummaries.push(summary);

    const completedCount = this._completedRoundIds.size;
    const progress = Math.min(1.0, completedCount / this._targetRounds);
    const isTargetReached = completedCount >= this._targetRounds;

    // 6. 목표 도달 판정 (A22)
    if (isTargetReached) {
      // 결전 인계 스냅샷 1회 생성
      const stats = this._computeCumulativeStats();
      const snapshot: AssaultHandoverSnapshot = deepFreeze({
        sessionId: this._sessionId ?? summary.sessionId,
        mode: this._mode,
        rulesVersion: this._rulesVersion,
        finalHp: playerHp,
        targetRounds: this._targetRounds,
        completedRounds: completedCount,
        stats,
        timestampMs: options?.timestampMs ?? Date.now(),
      });

      this._handoverSnapshot = snapshot;
      this._handoverCount = 1;

      return deepFreeze({
        intent: 'handover_climax',
        progress,
        completedRounds: completedCount,
        targetRounds: this._targetRounds,
        isTargetReached: true,
        isGameOver: false,
        handoverSnapshot: snapshot,
        reason: 'Target rounds reached',
      });
    }

    // 7. 다음 라운드 전이 의도 (목표 미도달 & 생존)
    this._scheduledNextRoundCount++;
    return deepFreeze({
      intent: 'next_round',
      progress,
      completedRounds: completedCount,
      targetRounds: this._targetRounds,
      isTargetReached: false,
      isGameOver: false,
      handoverSnapshot: null,
      reason: 'Advancing to next round',
    });
  }

  /** 호환용 별칭 메서드 */
  public processRoundSummary(
    summary: AssaultRoundSummaryData,
    playerHp: number,
    options?: { timestampMs?: number }
  ): AssaultProgressEvaluation {
    return this.evaluate(summary, playerHp, options);
  }

  /**
   * 컨트롤러 상태를 세션 시작 시점으로 초기화한다.
   */
  public reset(): void {
    this._completedRoundIds.clear();
    this._processedSummaries = [];
    this._isGameOver = false;
    this._handoverSnapshot = null;
    this._handoverCount = 0;
    this._scheduledNextRoundCount = 0;
  }

  // ─── 내부 집계 헬퍼 ───

  private _computeCumulativeStats(): AssaultCumulativeStats {
    let totalCompletedQuestions = 0;
    let totalCorrectHits = 0;
    let totalWrongHits = 0;
    let totalTimeoutHits = 0;
    let totalEvadeSuccessCount = 0;
    let totalSquatFailCount = 0;
    let totalEncounters = 0;
    let totalAttemptedAnswerHits = 0;
    let maxCombo = 0;
    let totalPlayerDamage = 0;
    let totalBossDamage = 0;
    let totalActualDamage = 0;
    let totalRequestedDamage = 0;
    let totalActiveDurationSeconds = 0;
    const ratingCounts = { Perfect: 0, Good: 0, Late: 0, Miss: 0 };
    const processedRoundIds: RoundId[] = [];

    for (const s of this._processedSummaries) {
      totalCompletedQuestions += s.completedQuestions;
      totalCorrectHits += s.correctCount;
      totalWrongHits += s.wrongCount;
      totalTimeoutHits += s.timeoutCount;
      totalEvadeSuccessCount += s.evadeSuccessCount;
      totalSquatFailCount += s.squatFailCount;
      totalEncounters += s.totalEncounters;
      totalAttemptedAnswerHits += s.attemptedAnswerHits;
      maxCombo = Math.max(maxCombo, s.maxCombo);
      totalPlayerDamage += s.totalPlayerDamage ?? s.actualDamage ?? 0;
      totalBossDamage += s.totalBossDamage ?? 0;
      totalActualDamage += s.totalActualDamage ?? 0;
      totalRequestedDamage += s.totalRequestedDamage ?? 0;
      totalActiveDurationSeconds += s.activeDurationSeconds;

      if (s.ratingCounts) {
        ratingCounts.Perfect += s.ratingCounts.Perfect ?? 0;
        ratingCounts.Good += s.ratingCounts.Good ?? 0;
        ratingCounts.Late += s.ratingCounts.Late ?? 0;
        ratingCounts.Miss += s.ratingCounts.Miss ?? 0;
      }

      processedRoundIds.push(s.roundId);
    }

    return deepFreeze({
      totalCompletedQuestions,
      totalCorrectHits,
      totalWrongHits,
      totalTimeoutHits,
      totalEvadeSuccessCount,
      totalSquatFailCount,
      totalEncounters,
      totalAttemptedAnswerHits,
      ratingCounts,
      maxCombo,
      totalPlayerDamage,
      totalBossDamage,
      totalActualDamage,
      totalRequestedDamage,
      totalActiveDurationSeconds,
      processedRoundIds,
    });
  }
}
