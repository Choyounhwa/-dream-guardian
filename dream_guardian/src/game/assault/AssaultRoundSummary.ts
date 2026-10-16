/**
 * AssaultRoundSummary.ts - 보스 접근전(Boss Assault) 불변 라운드 요약 집계
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.2, 9.2~9.3, 11.2)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-17 / Issue #519)
 *
 * 절대 규칙:
 * 1. 문제 수와 타격 수의 엄격한 분리:
 *    - 1개 라운드(1문제) 내의 복수 조우(답 쌍, 스쿼트 등)의 타격 지표와 문제 완료 여부를 명확히 분리한다.
 *    - 정상 종료 시 completedQuestions: 1, 중간 사망(HP 0) 또는 강제 중단 시 completedQuestions: 0 (isAborted: true).
 * 2. 멱등성 및 중복 배제:
 *    - 동일 attackId의 결과나 receipt 중복 유입 시 중복 집계를 원천 차단한다.
 * 3. 실제 피해량 및 활성 시간 기록:
 *    - 요청 피해량이 아닌 AssaultSettlementReceipt의 actualDamage를 합산한다.
 *    - 일시정지 시간을 제외한 순수 활성 시간(activeDurationSeconds)만 기록한다.
 * 4. 불변성(Immutability):
 *    - 생성된 DTO는 deepFreeze되어 완전히 불변이다.
 *    - 요약 발행 이후 추가 이벤트가 유입되어도 이미 발행된 요약은 일체 변경되지 않는다.
 * 5. 자원 및 부작용 무영향:
 *    - HP 직접 변경 0회, effects/자원 적용 0회 (순수 집계 도메인).
 */

import type {
  SessionId,
  RoundId,
  AttackId,
  AssaultHitResult,
  AssaultRhythmRating,
  AssaultEncounterKind,
} from '../../types/assault.js';
import type { AssaultSettlementReceipt } from './AssaultSettlement.js';

// ─── 1. 타입 및 인터페이스 정의 ───

/** 리듬 판정 등급별 집계 카운트 */
export interface AssaultRatingCounts {
  readonly Perfect: number;
  readonly Good: number;
  readonly Late: number;
  readonly Miss: number;
}

/** 조우/타격 기록 입력 인터페이스 */
export interface AssaultRoundEncounterRecord {
  readonly attackId: AttackId;
  readonly kind?: AssaultEncounterKind;
  readonly resultKind?: AssaultHitResult;
  readonly isCorrect?: boolean;
  readonly evaded?: boolean;
  readonly isTimeout?: boolean;
  readonly rating?: AssaultRhythmRating | null;
  readonly timestampMs?: number;
}

/** 불변 라운드 요약 DTO 인터페이스 */
export interface AssaultRoundSummaryData {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  /** 완료된 문제 수 (정상 완료: 1, 중간 중단/사망: 0) */
  readonly completedQuestions: number;
  /** 중단 여부 (사망 또는 강제 중단 시 true) */
  readonly isAborted: boolean;
  /** 사망으로 인한 중단 여부 */
  readonly isDefeated: boolean;
  /** 정답 타격 수 */
  readonly correctCount: number;
  /** 오답 타격 수 */
  readonly wrongCount: number;
  /** 미선택(타임아웃) 수 */
  readonly timeoutCount: number;
  /** 스쿼트 회피 성공 수 */
  readonly evadeSuccessCount: number;
  /** 스쿼트 회피 실패(피격) 수 */
  readonly squatFailCount: number;
  /** 총 시도한 조우 수 */
  readonly totalEncounters: number;
  /** 시도한 답 공격 수 (correct + wrong + timeout) */
  readonly attemptedAnswerHits: number;
  /** 리듬 판정 등급별 집계 */
  readonly ratingCounts: AssaultRatingCounts;
  /** 라운드 내 최대 연속 콤보 */
  readonly maxCombo: number;
  /** 라운드 종료 시점 콤보 */
  readonly endCombo: number;
  /** 플레이어 대상 실제 누적 피해량 (actualDamage 합산) */
  readonly totalPlayerDamage: number;
  /** 보스 대상 실제 누적 피해량 (actualDamage 합산) */
  readonly totalBossDamage: number;
  /** 총 실제 누적 피해량 (totalPlayerDamage + totalBossDamage) */
  readonly totalActualDamage: number;
  /** actualDamage 호환 필드 (totalPlayerDamage) */
  readonly actualDamage: number;
  /** 총 요청 피해량 합산 */
  readonly totalRequestedDamage: number;
  /** 일시정지 제외 순수 활성 시간 (초) */
  readonly activeDurationSeconds: number;
  /** 집계된 고유 attackId 목록 */
  readonly processedAttackIds: readonly AttackId[];
  /** 집계된 고유 receiptId 목록 */
  readonly processedReceiptIds: readonly string[];
}

/** 깊은 동결 헬퍼 함수 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj as Readonly<T>;
}

// ─── 2. 불변 라운드 요약 클래스 ───

export class AssaultRoundSummary implements AssaultRoundSummaryData {
  public readonly sessionId: SessionId;
  public readonly roundId: RoundId;
  public readonly completedQuestions: number;
  public readonly isAborted: boolean;
  public readonly isDefeated: boolean;
  public readonly correctCount: number;
  public readonly wrongCount: number;
  public readonly timeoutCount: number;
  public readonly evadeSuccessCount: number;
  public readonly squatFailCount: number;
  public readonly totalEncounters: number;
  public readonly attemptedAnswerHits: number;
  public readonly ratingCounts: AssaultRatingCounts;
  public readonly maxCombo: number;
  public readonly endCombo: number;
  public readonly totalPlayerDamage: number;
  public readonly totalBossDamage: number;
  public readonly totalActualDamage: number;
  public readonly actualDamage: number;
  public readonly totalRequestedDamage: number;
  public readonly activeDurationSeconds: number;
  public readonly processedAttackIds: readonly AttackId[];
  public readonly processedReceiptIds: readonly string[];

  constructor(data: AssaultRoundSummaryData) {
    this.sessionId = data.sessionId;
    this.roundId = data.roundId;
    this.completedQuestions = data.completedQuestions;
    this.isAborted = data.isAborted;
    this.isDefeated = data.isDefeated;
    this.correctCount = data.correctCount;
    this.wrongCount = data.wrongCount;
    this.timeoutCount = data.timeoutCount;
    this.evadeSuccessCount = data.evadeSuccessCount;
    this.squatFailCount = data.squatFailCount;
    this.totalEncounters = data.totalEncounters;
    this.attemptedAnswerHits = data.attemptedAnswerHits;
    this.ratingCounts = { ...data.ratingCounts };
    this.maxCombo = data.maxCombo;
    this.endCombo = data.endCombo;
    this.totalPlayerDamage = data.totalPlayerDamage;
    this.totalBossDamage = data.totalBossDamage;
    this.totalActualDamage = data.totalActualDamage;
    this.actualDamage = data.actualDamage;
    this.totalRequestedDamage = data.totalRequestedDamage;
    this.activeDurationSeconds = data.activeDurationSeconds;
    this.processedAttackIds = [...data.processedAttackIds];
    this.processedReceiptIds = [...data.processedReceiptIds];

    deepFreeze(this);
  }
}

// ─── 3. 라운드 요약 집계기 (Aggregator) ───

export interface AssaultRoundSummaryOptions {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly initialCombo?: number;
  readonly activeDurationSeconds?: number;
}

export class AssaultRoundSummaryAggregator {
  private readonly _sessionId: SessionId;
  private readonly _roundId: RoundId;

  private _isAborted = false;
  private _isDefeated = false;
  private _correctCount = 0;
  private _wrongCount = 0;
  private _timeoutCount = 0;
  private _evadeSuccessCount = 0;
  private _squatFailCount = 0;

  private _ratingCounts = {
    Perfect: 0,
    Good: 0,
    Late: 0,
    Miss: 0,
  };

  private _currentCombo = 0;
  private _maxCombo = 0;

  private _totalPlayerDamage = 0;
  private _totalBossDamage = 0;
  private _totalRequestedDamage = 0;
  private _activeDurationSeconds = 0;

  private readonly _processedAttackIds = new Set<AttackId>();
  private readonly _processedReceiptIds = new Set<string>();
  private readonly _processedReceiptAttackIds = new Set<AttackId>();
  private readonly _processedIdempotencyKeys = new Set<string>();

  private _isFinalized = false;
  private _cachedSummary: AssaultRoundSummary | null = null;

  constructor(options: AssaultRoundSummaryOptions) {
    this._sessionId = options.sessionId;
    this._roundId = options.roundId;
    this._currentCombo = options.initialCombo ?? 0;
    this._maxCombo = this._currentCombo;
    this._activeDurationSeconds = options.activeDurationSeconds ?? 0;
  }

  public get isFinalized(): boolean {
    return this._isFinalized;
  }

  public setActiveDuration(seconds: number): void {
    if (this._isFinalized) return;
    this._activeDurationSeconds = Math.max(0, seconds);
  }

  public recordActiveDuration(seconds: number): void {
    this.setActiveDuration(seconds);
  }

  public advanceActiveDuration(deltaSeconds: number): void {
    if (this._isFinalized) return;
    if (deltaSeconds > 0) {
      this._activeDurationSeconds += deltaSeconds;
    }
  }

  public abort(options?: { isDefeated?: boolean; reason?: string }): void {
    if (this._isFinalized) return;
    this._isAborted = true;
    if (options?.isDefeated) {
      this._isDefeated = true;
    }
  }

  public recordDefeat(): void {
    this.abort({ isDefeated: true });
  }

  /**
   * 단일 조우 결과 기록 (멱등성 보장)
   */
  public recordEncounter(record: AssaultRoundEncounterRecord): boolean {
    if (this._isFinalized) return false;
    if (!record.attackId) return false;

    if (this._processedAttackIds.has(record.attackId)) {
      return false; // 중복 attackId 차단
    }
    this._processedAttackIds.add(record.attackId);

    // 리듬 판정 등급 집계
    if (record.rating && record.rating in this._ratingCounts) {
      this._ratingCounts[record.rating]++;
    }

    // 종류 추론 및 결과 분기
    const isSquat =
      record.kind === 'squat' ||
      record.evaded !== undefined ||
      record.resultKind === 'evaded';

    if (isSquat) {
      const isEvadeSuccess =
        record.evaded === true ||
        record.resultKind === 'evaded';

      if (isEvadeSuccess) {
        this._evadeSuccessCount++;
        this._onSuccess();
      } else {
        this._squatFailCount++;
        this._onFail();
      }
    } else {
      // answer_pair
      const isTimeout =
        record.isTimeout === true ||
        record.resultKind === 'timeout';

      if (isTimeout) {
        this._timeoutCount++;
        this._onFail();
      } else {
        const isCorrect =
          record.isCorrect === true ||
          record.resultKind === 'hit';

        if (isCorrect) {
          this._correctCount++;
          this._onSuccess();
        } else {
          this._wrongCount++;
          this._onFail();
        }
      }
    }

    return true;
  }

  public recordAnswerHit(
    attackId: AttackId,
    options?: {
      isCorrect?: boolean;
      rating?: AssaultRhythmRating | null;
      timestampMs?: number;
    },
  ): boolean {
    return this.recordEncounter({
      attackId,
      kind: 'answer_pair',
      resultKind: options?.isCorrect === false ? 'miss' : 'hit',
      isCorrect: options?.isCorrect !== false,
      rating: options?.rating,
      timestampMs: options?.timestampMs,
    });
  }

  public recordAnswerTimeout(
    attackId: AttackId,
    options?: {
      rating?: AssaultRhythmRating | null;
      timestampMs?: number;
    },
  ): boolean {
    return this.recordEncounter({
      attackId,
      kind: 'answer_pair',
      resultKind: 'timeout',
      isTimeout: true,
      rating: options?.rating,
      timestampMs: options?.timestampMs,
    });
  }

  public recordSquatEvade(
    attackId: AttackId,
    options?: {
      rating?: AssaultRhythmRating | null;
      timestampMs?: number;
    },
  ): boolean {
    return this.recordEncounter({
      attackId,
      kind: 'squat',
      resultKind: 'evaded',
      evaded: true,
      rating: options?.rating,
      timestampMs: options?.timestampMs,
    });
  }

  public recordSquatFail(
    attackId: AttackId,
    options?: {
      rating?: AssaultRhythmRating | null;
      timestampMs?: number;
    },
  ): boolean {
    return this.recordEncounter({
      attackId,
      kind: 'squat',
      resultKind: 'miss',
      evaded: false,
      rating: options?.rating,
      timestampMs: options?.timestampMs,
    });
  }

  /**
   * 정산 영수증(Receipt) 기록 (멱등성 보장 및 실제 피해량 합산)
   */
  public recordReceipt(receipt: AssaultSettlementReceipt): boolean {
    if (this._isFinalized) return false;
    if (!receipt) return false;

    // 중복 체크: receiptId, idempotencyKey, attackId
    if (receipt.receiptId && this._processedReceiptIds.has(receipt.receiptId)) {
      return false;
    }
    if (receipt.idempotencyKey && this._processedIdempotencyKeys.has(receipt.idempotencyKey)) {
      return false;
    }
    if (receipt.attackId && this._processedReceiptAttackIds.has(receipt.attackId)) {
      return false;
    }

    if (receipt.receiptId) {
      this._processedReceiptIds.add(receipt.receiptId);
    }
    if (receipt.idempotencyKey) {
      this._processedIdempotencyKeys.add(receipt.idempotencyKey);
    }
    if (receipt.attackId) {
      this._processedReceiptAttackIds.add(receipt.attackId);
    }

    const actualDmg = Math.max(0, receipt.actualDamage ?? 0);
    const reqDmg = Math.max(0, receipt.requestedDamage ?? actualDmg);

    this._totalRequestedDamage += reqDmg;

    if (receipt.target === 'boss') {
      this._totalBossDamage += actualDmg;
    } else {
      // player
      this._totalPlayerDamage += actualDmg;
      if (receipt.newHp === 0 || receipt.currentHp === 0) {
        this._isDefeated = true;
        this._isAborted = true;
      }
    }

    return true;
  }

  public recordReceipts(receipts: readonly AssaultSettlementReceipt[]): number {
    let count = 0;
    for (const r of receipts) {
      if (this.recordReceipt(r)) {
        count++;
      }
    }
    return count;
  }

  private _onSuccess(): void {
    this._currentCombo++;
    if (this._currentCombo > this._maxCombo) {
      this._maxCombo = this._currentCombo;
    }
  }

  private _onFail(): void {
    this._currentCombo = 0;
  }

  /**
   * 최종 불변 요약 DTO 발행 (1회 생성 및 deepFreeze)
   */
  public finalize(options?: { isAborted?: boolean; isDefeated?: boolean }): AssaultRoundSummary {
    if (this._isFinalized && this._cachedSummary) {
      return this._cachedSummary;
    }

    if (options?.isAborted !== undefined) {
      this._isAborted = options.isAborted;
    }
    if (options?.isDefeated !== undefined) {
      this._isDefeated = options.isDefeated;
      if (this._isDefeated) {
        this._isAborted = true;
      }
    }

    const isAborted = this._isAborted || this._isDefeated;
    const completedQuestions = isAborted ? 0 : 1;
    const totalEncounters =
      this._correctCount +
      this._wrongCount +
      this._timeoutCount +
      this._evadeSuccessCount +
      this._squatFailCount;
    const attemptedAnswerHits =
      this._correctCount +
      this._wrongCount +
      this._timeoutCount;
    const totalActualDamage = this._totalPlayerDamage + this._totalBossDamage;

    const summaryData: AssaultRoundSummaryData = {
      sessionId: this._sessionId,
      roundId: this._roundId,
      completedQuestions,
      isAborted,
      isDefeated: this._isDefeated,
      correctCount: this._correctCount,
      wrongCount: this._wrongCount,
      timeoutCount: this._timeoutCount,
      evadeSuccessCount: this._evadeSuccessCount,
      squatFailCount: this._squatFailCount,
      totalEncounters,
      attemptedAnswerHits,
      ratingCounts: { ...this._ratingCounts },
      maxCombo: this._maxCombo,
      endCombo: this._currentCombo,
      totalPlayerDamage: this._totalPlayerDamage,
      totalBossDamage: this._totalBossDamage,
      totalActualDamage,
      actualDamage: this._totalPlayerDamage,
      totalRequestedDamage: this._totalRequestedDamage,
      activeDurationSeconds: this._activeDurationSeconds,
      processedAttackIds: Array.from(this._processedAttackIds),
      processedReceiptIds: Array.from(this._processedReceiptIds),
    };

    const summary = new AssaultRoundSummary(summaryData);
    this._cachedSummary = summary;
    this._isFinalized = true;

    return summary;
  }

  public build(options?: { isAborted?: boolean; isDefeated?: boolean }): AssaultRoundSummary {
    return this.finalize(options);
  }

  public getSummary(): AssaultRoundSummary | null {
    return this._cachedSummary;
  }
}

// ─── 4. 일괄 생성 팩토리 함수 ───

export interface CreateAssaultRoundSummaryParams {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly encounters?: readonly AssaultRoundEncounterRecord[];
  readonly receipts?: readonly AssaultSettlementReceipt[];
  readonly activeDurationSeconds?: number;
  readonly isAborted?: boolean;
  readonly isDefeated?: boolean;
  readonly initialCombo?: number;
}

export function createAssaultRoundSummary(
  params: CreateAssaultRoundSummaryParams,
): AssaultRoundSummary {
  const aggregator = new AssaultRoundSummaryAggregator({
    sessionId: params.sessionId,
    roundId: params.roundId,
    initialCombo: params.initialCombo,
    activeDurationSeconds: params.activeDurationSeconds,
  });

  if (params.encounters) {
    for (const enc of params.encounters) {
      aggregator.recordEncounter(enc);
    }
  }

  if (params.receipts) {
    for (const r of params.receipts) {
      aggregator.recordReceipt(r);
    }
  }

  if (params.isDefeated) {
    aggregator.recordDefeat();
  } else if (params.isAborted) {
    aggregator.abort();
  }

  return aggregator.finalize({
    isAborted: params.isAborted,
    isDefeated: params.isDefeated,
  });
}
