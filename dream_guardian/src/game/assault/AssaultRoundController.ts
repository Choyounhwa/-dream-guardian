/**
 * AssaultRoundController.ts - 투척·생각·교대 라운드 순수 진행 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§4, 5, 6.2, 13.1, 15.2-B3, 15.2-B8)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-15 / Issue #517)
 */

import type {
  SessionId, RoundId, AssaultRoundPhase, AssaultRoundPresentation,
  AssaultEncounterDef, AssaultAnswerSide, AssaultSettlementCommand,
} from '../../types/assault.js';
import { AssaultRoundPresentationBuilder } from './AssaultRoundPresentationBuilder.js';
import { AssaultPairJudge } from './AssaultPairJudge.js';
import { AssaultSquatJudge } from './AssaultSquatJudge.js';
import type { AssaultSquatPosture, AssaultSquatResult } from '../../motion/AssaultSquatAdapter.js';
import { DEFAULT_ASSAULT_CONFIG, DEFAULT_ASSAULT_BPM } from '../../../config/assault.config.js';
import { AssaultRoundSummaryAggregator, type AssaultRoundSummaryData } from './AssaultRoundSummary.js';
import type { AssaultSettlementReceipt } from './AssaultSettlement.js';
import type {
  AssaultRoundQuestionData, RuntimeEncounter, AssaultRoundConfig,
  AssaultSquatStandState, PendingInput, TimelineEvent, AssaultRoundControllerOptions,
} from './AssaultRoundTypes.js';
import { normalizeAssaultRoundQuestion } from './AssaultRoundTypes.js';
export type {
  AssaultRoundQuestionData, AssaultRoundConfig, AssaultSquatStandState, AssaultRoundControllerOptions,
};
import { calculateReadingDurationSeconds } from './AssaultReadingCalculator.js';
import { AssaultLoopTimeline } from './AssaultLoopTimeline.js';
import type { AssaultLoopSegmentDef } from '../../types/assault-loop.js';

// ─── 3. 메인 컨트롤러 클래스 ───

export class AssaultRoundController {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  private readonly _question: AssaultRoundQuestionData;
  private readonly _config: AssaultRoundConfig;
  private readonly _options: AssaultRoundControllerOptions;
  private readonly _timeline: AssaultLoopTimeline | null;

  private readonly _bpm: number;
  private readonly _secondsPerBeat: number;
  private readonly _throwDurationSeconds: number;
  private readonly _readingDurationSeconds: number;
  private readonly _readingEndTime: number;

  private _phase: AssaultRoundPhase;
  private _lastActiveSeconds: number = 0;
  private _readingProgress: number = 0.0;
  private _currentEncounterIndex: number = 0;
  private _isPaused: boolean = false;
  private _isCompleted: boolean = false;
  private _ttsRequested: boolean = false;
  private _roundCompletedSignalEmitted: boolean = false;
  private _completedSuccess: boolean = false;
  private readonly _summary: AssaultRoundSummaryAggregator;
  private _finalizedSummary: AssaultRoundSummaryData | null = null;

  private readonly _encounters: RuntimeEncounter[] = [];
  private readonly _settlementCommands: AssaultSettlementCommand[] = [];
  private readonly _pendingInputs: PendingInput[] = [];

  /** 직립 세대 및 복귀 상태 영속 저장소 (REC-26 / #614) */
  private _squatStandState: AssaultSquatStandState;

  private _readableFired: boolean = false;
  private _readingEndFired: boolean = false;

  constructor(options: AssaultRoundControllerOptions) {
    this._options = options;
    this.sessionId = options.sessionId;
    this.roundId = options.roundId;
    this._summary = new AssaultRoundSummaryAggregator({ sessionId: options.sessionId, roundId: options.roundId });
    this._squatStandState = Object.freeze({
      consumedGenerations: Object.freeze(options.initialSquatStandState?.consumedGenerations ? [...options.initialSquatStandState.consumedGenerations] : []),
      hasStoodUpSinceLastEvade: options.initialSquatStandState?.hasStoodUpSinceLastEvade ?? true,
      currentStandGeneration: options.initialSquatStandState?.currentStandGeneration ?? 0,
    });

    // 1. 문제 데이터 정규화
    this._question = normalizeAssaultRoundQuestion(options.question, options.roundId);

    // 2. 설정 정규화
    this._config = Object.freeze({
      ...DEFAULT_ASSAULT_CONFIG,
      ...options.config,
      lateGraceMs: options.config?.lateGraceMs ?? 170,
      minDuckingDurationMs: options.config?.minDuckingDurationMs ?? 100,
      trackingLossGraceSeconds: options.config?.trackingLossGraceSeconds ?? 1.0,
      simultaneousPunchGraceMs: options.config?.simultaneousPunchGraceMs ?? 50,
    });

    // 3. 타이밍 및 루프 타임라인 산출
    const planBpm = options.plan && 'bpm' in options.plan && typeof options.plan.bpm === 'number'
      ? options.plan.bpm
      : options.loopPlan?.bpm;
    this._bpm = options.bpm ?? planBpm ?? DEFAULT_ASSAULT_BPM;
    this._secondsPerBeat = 60 / this._bpm;

    if (options.loopPlan) {
      this._timeline = new AssaultLoopTimeline(options.loopPlan, this._bpm);
      this._throwDurationSeconds = 0;
      this._readingDurationSeconds = this._timeline.segments[0]?.durationSeconds ?? 8 * this._secondsPerBeat;
      this._readingEndTime = this._readingDurationSeconds;
    } else {
      this._timeline = null;
      this._throwDurationSeconds = options.throwDurationSeconds ?? 1.0;
      this._readingDurationSeconds = calculateReadingDurationSeconds(this._question, this._config, this._secondsPerBeat);
      this._readingEndTime = this._throwDurationSeconds + this._readingDurationSeconds;
    }

    // 4. 초기 상태
    this._phase = this._throwDurationSeconds > 0 ? 'throw_in' : 'question_reading';
    this._readableFired = this._throwDurationSeconds <= 0;

    // 5. 조우 런타임 초기화
    const encounterDefs = options.loopPlan ? options.loopPlan.encounters : (options.plan?.encounters ?? []);
    const lateGraceSeconds = this._timeline ? 0 : this._config.lateGraceMs / 1000;

    for (let i = 0; i < encounterDefs.length; i++) {
      const def = encounterDefs[i];
      let startSeconds: number;
      let arrivalSeconds: number;
      let deadlineSeconds: number;
      let endSeconds: number;
      let readyUntilSeconds: number | undefined;

      if (this._timeline) {
        startSeconds = def.startBeat * this._secondsPerBeat;
        if (def.kind === 'squat') {
          const sq = this._timeline.calculateSquatWindows(def.startBeat, def.durationBeats);
          startSeconds = sq.startSeconds;
          readyUntilSeconds = sq.dodgeStartSeconds;
          arrivalSeconds = sq.dodgeEndSeconds;
          deadlineSeconds = sq.dodgeEndSeconds;
          endSeconds = sq.standEndSeconds;
        } else {
          arrivalSeconds = startSeconds + def.durationBeats * this._secondsPerBeat;
          deadlineSeconds = arrivalSeconds;
          endSeconds = arrivalSeconds;
          readyUntilSeconds = startSeconds;
        }
      } else {
        startSeconds = this._readingEndTime + def.startBeat * this._secondsPerBeat;
        arrivalSeconds = startSeconds + def.durationBeats * this._secondsPerBeat;
        deadlineSeconds = arrivalSeconds + lateGraceSeconds;
        endSeconds = deadlineSeconds;
        readyUntilSeconds = startSeconds;
      }

      const runtimeEnc: RuntimeEncounter = {
        def,
        index: i,
        startSeconds,
        ...(readyUntilSeconds !== undefined ? { readyUntilSeconds } : {}),
        arrivalSeconds,
        deadlineSeconds,
        endSeconds,
        lateGraceSeconds: this._timeline ? 0 : lateGraceSeconds,
        startFired: false,
        arrivalFired: false,
        deadlineFired: false,
        endFired: false,
        isResolved: false,
      };

      this._initJudgesForEncounter(runtimeEnc);
      this._encounters.push(runtimeEnc);
    }

    // 6. 노트 어댑터가 주입된 경우 자동 로드
    if (options.noteAdapter) {
      options.noteAdapter.loadEncounters(encounterDefs);
    }
  }

  // ─── 4. 상태 접근자 (Getters) ───

  get phase(): AssaultRoundPhase { return this._phase; }
  get bpm(): number { return this._bpm; }
  get secondsPerBeat(): number { return this._secondsPerBeat; }
  get question(): AssaultRoundQuestionData { return this._question; }
  get questionText(): string { return this._question.text; }
  get currentEncounterIndex(): number { return this._currentEncounterIndex; }
  get totalEncounters(): number { return this._encounters.length; }
  get readingProgress(): number { return this._readingProgress; }
  get isPaused(): boolean { return this._isPaused; }
  get isCompleted(): boolean { return this._isCompleted; }
  get completedSuccess(): boolean { return this._completedSuccess; }
  get readingDurationSeconds(): number { return this._readingDurationSeconds; }
  get readingEndTime(): number { return this._readingEndTime; }
  get throwDurationSeconds(): number { return this._throwDurationSeconds; }
  get timeline(): AssaultLoopTimeline | null { return this._timeline; }
  get currentLoopSegment(): AssaultLoopSegmentDef | null { return this._timeline?.getCurrentSegment(this._lastActiveSeconds) ?? null; }
  get encounters(): readonly AssaultEncounterDef[] { return Object.freeze(this._encounters.map((e) => e.def)); }
  get settlementCommands(): readonly AssaultSettlementCommand[] { return Object.freeze([...this._settlementCommands]); }
  getSettlementCommands(): readonly AssaultSettlementCommand[] { return this.settlementCommands; }

  drainSettlementCommands(): readonly AssaultSettlementCommand[] {
    const drained = [...this._settlementCommands];
    this._settlementCommands.length = 0;
    return Object.freeze(drained);
  }

  getPresentationSnapshot(): AssaultRoundPresentation {
    const enc = this._encounters[this._currentEncounterIndex] ?? this._encounters[this._encounters.length - 1];
    return AssaultRoundPresentationBuilder.build({
      sessionId: this.sessionId,
      roundId: this.roundId,
      phase: this._phase,
      question: this._question,
      optionsPairs: (this._options as { pairs?: Record<string | number, unknown> }).pairs,
      currentEncounter: enc,
      encounters: this._encounters,
      currentEncounterIndex: this._currentEncounterIndex,
      totalEncounters: this._encounters.length,
      activeSeconds: this._lastActiveSeconds,
      readingProgress: this._readingProgress,
      isPaused: this._isPaused,
      throwDurationSeconds: this._throwDurationSeconds,
      readingEndTime: this._readingEndTime,
      timeline: this._timeline,
    });
  }

  // ─── 5. 생명주기 및 시간 전진 ───

  update(activeSeconds: number, _dt?: number): void {
    // 0. 완료 또는 abort 후 후속 실행 일체 차단
    if (this._isCompleted) {
      return;
    }

    // 1. TTS 낭독 요청 신호: 최초 업데이트 시 정확히 1회 발행 (DEC-B3)
    if (!this._ttsRequested) {
      this._ttsRequested = true;
      try {
        this._options.onTtsSpeak?.(this.questionText);
      } catch (_e) {
        // 비동기 안전: TTS 에러가 라운드 진행을 블로킹하지 않음
      }
    }

    // 2. 정지 중 시간 진행 차단
    if (this._isPaused) {
      return;
    }

    // 3. 단조 시간 축 보장 (역행 차단)
    if (activeSeconds < this._lastActiveSeconds) {
      return;
    }

    const fromT = this._lastActiveSeconds;
    const toT = activeSeconds;
    const wasCompleted = this._isCompleted;

    // 4. 시간순 경계 및 입력 처리
    this._processTimelineEvents(fromT, toT);

    // 5. 시각 갱신 및 진행률 계산
    this._commitActiveTime(toT, wasCompleted);
  }

  pause(_reason?: string): void {
    this._isPaused = true;
    this._pendingInputs.length = 0;
    if (this._phase === 'encounters' && this._currentEncounterIndex < this._encounters.length) {
      const curr = this._encounters[this._currentEncounterIndex];
      if (curr && curr.pairJudge?.state.status === 'wrong_locked') {
        curr.isResolved = true;
      }
    }
  }

  resume(): void {
    if (!this._isPaused) {
      return;
    }
    this._isPaused = false;

    // DEC-B8 (공격 중 재개 정책 / REC-08):
    // 조우(공격) 진행 도중 일시정지 발생 후 해제 시:
    // 진행 중이던 미해결 공격 예고부터 재시작 + 1박 카운트 유예(resumeReadyBeats: 1) 제공.
    // 이미 결과가 확정되었거나 피해가 적용된 공격은 재시작·재정산하지 않음.
    if (this._phase === 'encounters' && this._currentEncounterIndex < this._encounters.length) {
      const curr = this._encounters[this._currentEncounterIndex];
      const isSettledOrDamaged =
        !curr ||
        curr.isResolved ||
        (curr.pairJudge && curr.pairJudge.state.status !== 'pending') ||
        (curr.squatJudge && curr.squatJudge.state.status !== 'pending');

      if (curr && !isSettledOrDamaged && (curr.startFired || this._lastActiveSeconds >= curr.startSeconds)) {
        const readyGraceSeconds = this._config.resumeReadyBeats * this._secondsPerBeat;
        const oldEndSeconds = curr.endSeconds;

        curr.startSeconds = this._lastActiveSeconds;
        curr.readyUntilSeconds = this._lastActiveSeconds + readyGraceSeconds;
        curr.arrivalSeconds = curr.startSeconds + curr.def.durationBeats * this._secondsPerBeat + readyGraceSeconds;
        curr.deadlineSeconds = curr.arrivalSeconds + curr.lateGraceSeconds;
        curr.endSeconds = curr.deadlineSeconds;
        curr.startFired = true;
        curr.arrivalFired = false;
        curr.deadlineFired = false;
        curr.endFired = false;

        this._initJudgesForEncounter(curr);

        // 후속 조우들 시간 시프트
        const shiftDelta = curr.endSeconds - oldEndSeconds;
        if (shiftDelta > 0) {
          for (let j = this._currentEncounterIndex + 1; j < this._encounters.length; j++) {
            const nextEnc = this._encounters[j];
            nextEnc.startSeconds += shiftDelta;
            if (nextEnc.readyUntilSeconds !== undefined) {
              nextEnc.readyUntilSeconds += shiftDelta;
            }
            nextEnc.arrivalSeconds += shiftDelta;
            nextEnc.deadlineSeconds += shiftDelta;
            nextEnc.endSeconds += shiftDelta;
            this._initJudgesForEncounter(nextEnc);
          }
          if (this._timeline) {
            this._timeline.applyShift({ attackId: curr.def.id, deltaSeconds: shiftDelta });
          }
        }
      }
    }
  }

  abort(reason: string = 'aborted'): void {
    this._completeRound(false, reason);
  }

  // ─── 5-1. 라운드 요약 포트 (REC-11 / #596) ───

  /** 확정된 불변 라운드 요약 (finalize 전에는 null) */
  getRoundSummary(): AssaultRoundSummaryData | null {
    return this._finalizedSummary;
  }

  /**
   * Core가 실제 정산기에서 받은 영수증을 기록한다.
   * applied:true + 동일 세션/라운드 영수증만 수락하며, 거부 영수증은 멱등 키를 소비하지 않는다.
   */
  recordSettlementReceipt(receipt: AssaultSettlementReceipt | null): boolean {
    if (!receipt || this._finalizedSummary || receipt.applied !== true) {
      return false;
    }
    if (receipt.sessionId !== this.sessionId || receipt.roundId !== this.roundId) {
      return false;
    }
    return this._summary.recordReceipt(receipt);
  }

  /**
   * 영수증 반영 및 권위 HP 0 확인 후 Core가 호출하여 요약을 1회 확정한다.
   * 라운드 완료(onRoundComplete) 또는 abort 이전에는 null을 반환한다.
   */
  finalizeRoundSummary(options: { isDefeated: boolean }): AssaultRoundSummaryData | null {
    if (this._finalizedSummary) {
      return this._finalizedSummary;
    }
    if (!this._isCompleted) {
      return null;
    }
    const summary = this._summary.finalize({
      ...(this._completedSuccess ? {} : { isAborted: true }),
      ...(options.isDefeated ? { isDefeated: true } : {}),
    });
    this._finalizedSummary = summary;
    this._options.onSummaryFinalized?.(summary);
    return summary;
  }

  // ─── 5-2. 직립 세대 소비 상태 포트 (REC-26 / #614) ───

  /**
   * 라운드 경계를 넘어 직립 복귀 및 세대 소비 상태를 Core가 보관하고
   * 다음 라운드에 재주입할 수 있도록 읽기 전용 상태를 반환한다.
   */
  exportSquatStandState(): AssaultSquatStandState {
    return this._squatStandState;
  }

  // ─── 6. 입력 주입 인터페이스 ───

  submitPunch(
    hand: 'left' | 'right',
    timestampMs: number,
    options?: { activeSeconds?: number; inputId?: string },
  ): void {
    if (this._isPaused || this._isCompleted) {
      return;
    }
    const activeSeconds = options?.activeSeconds ?? this._lastActiveSeconds;
    this._pendingInputs.push({
      type: 'punch',
      hand,
      timestampMs,
      activeSeconds,
      inputId: options?.inputId ?? `punch_${this.sessionId}_${this._pendingInputs.length}_${timestampMs}`,
    });

    if (activeSeconds >= this._lastActiveSeconds) {
      const wasCompleted = this._isCompleted;
      this._processTimelineEvents(this._lastActiveSeconds, activeSeconds);
      this._commitActiveTime(activeSeconds, wasCompleted);
    } else {
      this._processTimelineEvents(this._lastActiveSeconds, this._lastActiveSeconds);
    }
  }

  submitSquat(
    posture: AssaultSquatPosture | 'squatting',
    timestampMs: number,
    options?: { activeSeconds?: number; standGeneration?: number },
  ): void {
    if (this._isPaused || this._isCompleted) {
      return;
    }
    const activeSeconds = options?.activeSeconds ?? this._lastActiveSeconds;
    this._pendingInputs.push({
      type: 'squat',
      posture,
      timestampMs,
      activeSeconds,
      standGeneration: options?.standGeneration,
    });

    if (activeSeconds >= this._lastActiveSeconds) {
      const wasCompleted = this._isCompleted;
      this._processTimelineEvents(this._lastActiveSeconds, activeSeconds);
      this._commitActiveTime(activeSeconds, wasCompleted);
    } else {
      this._processTimelineEvents(this._lastActiveSeconds, this._lastActiveSeconds);
    }
  }

  /**
   * 모션 어댑터의 실제 평가 결과(AssaultSquatResult)를 직접 수신하는 가산(additive) 포트 (REC-26 / #614)
   * isValid, deltaY, standGeneration 등 실제 자세 증거를 손실 없이 전달한다.
   */
  submitSquatResult(
    result: AssaultSquatResult,
    options?: { activeSeconds?: number },
  ): void {
    if (this._isPaused) {
      return;
    }
    const activeSeconds = options?.activeSeconds ?? this._lastActiveSeconds;
    this._pendingInputs.push({
      type: 'squat',
      posture: result.posture,
      timestampMs: result.timestampMs,
      activeSeconds,
      standGeneration: result.standGeneration,
      squatResult: result,
    });

    if (activeSeconds >= this._lastActiveSeconds) {
      const wasCompleted = this._isCompleted;
      this._processTimelineEvents(this._lastActiveSeconds, activeSeconds);
      this._commitActiveTime(activeSeconds, wasCompleted);
    } else {
      this._processTimelineEvents(this._lastActiveSeconds, this._lastActiveSeconds);
    }
  }

  // ─── 7. 내부 시뮬레이션 및 판정 ───

  private _initJudgesForEncounter(enc: RuntimeEncounter): void {
    const def = enc.def as AssaultEncounterDef & {
      readonly correctAnswerSide?: AssaultAnswerSide;
      readonly correctSide?: AssaultAnswerSide;
      readonly pairId?: string;
    };
    const windowStartMs = Math.round((enc.readyUntilSeconds ?? enc.startSeconds) * 1000);

    if (def.kind === 'answer_pair') {
      const explicitSide =
        def.correctSide ??
        def.correctAnswerSide ??
        (this._options as any).pairs?.[def.pairId ?? def.id]?.correctSide ??
        (this._question as any).correctSide ??
        (this._question as any).correctAnswerSide;

      if (!explicitSide && (this._options as any).strictCorrectSide) {
        throw new Error(
          `Encounter ${def.id} of kind 'answer_pair' requires explicit correctSide ('left' | 'right'). Blind left fallback is prohibited.`
        );
      }

      enc.pairJudge = new AssaultPairJudge(
        { sessionId: this.sessionId, roundId: this.roundId, attackId: def.id, pairId: def.pairId ?? def.id, correctSide: explicitSide ?? 'left', arrivalMs: Math.round(enc.arrivalSeconds * 1000), windowStartMs },
        {
          lateGraceMs: Math.round(enc.lateGraceSeconds * 1000),
          simultaneousToleranceMs: this._config.simultaneousPunchGraceMs,
          rhythmWindows: this._config.rhythmWindows,
        },
      );
    } else if (def.kind === 'squat') {
      enc.squatJudge = new AssaultSquatJudge(
        { sessionId: this.sessionId, roundId: this.roundId, attackId: def.id, windowStartMs, arrivalMs: Math.round(enc.arrivalSeconds * 1000), startBeat: def.startBeat, durationBeats: def.durationBeats },
        { lateGraceMs: Math.round(enc.lateGraceSeconds * 1000), minDuckingDurationMs: this._config.minDuckingDurationMs, emitEvadeSuccessCommand: true },
        { consumedGenerations: this._squatStandState.consumedGenerations, hasStoodUpSinceLastEvade: this._squatStandState.hasStoodUpSinceLastEvade, currentStandGeneration: this._squatStandState.currentStandGeneration },
      );
    }
  }

  private _processTimelineEvents(_fromT: number, toT: number): void {
    const events: TimelineEvent[] = [];

    // 1. readable 경계
    if (!this._readableFired && toT >= this._throwDurationSeconds) {
      events.push({ type: 'readable', time: this._throwDurationSeconds, priority: 1 });
    }

    // 2. reading_end 경계
    if (!this._readingEndFired && toT >= this._readingEndTime) {
      events.push({ type: 'reading_end', time: this._readingEndTime, priority: 1 });
    }

    // 3. 조우 경계들
    for (let i = 0; i < this._encounters.length; i++) {
      const enc = this._encounters[i];
      if (!enc.startFired && toT >= enc.startSeconds) {
        events.push({ type: 'encounter_start', time: enc.startSeconds, priority: 1, encounterIndex: i });
      }
      if (!enc.arrivalFired && toT >= enc.arrivalSeconds) {
        events.push({ type: 'encounter_arrival', time: enc.arrivalSeconds, priority: 3, encounterIndex: i });
      }
      if (!enc.deadlineFired && toT >= enc.deadlineSeconds) {
        events.push({ type: 'encounter_deadline', time: enc.deadlineSeconds, priority: 3, encounterIndex: i });
      }
      // 조우 종료 시점: 루프 경로에서는 전체 슬롯(endSeconds) 유지, 레거시에서는 arrivalSeconds 또는 deadlineSeconds
      const endTime = this._timeline ? enc.endSeconds : (enc.isResolved ? enc.arrivalSeconds : enc.deadlineSeconds);
      if (!enc.endFired && toT >= endTime) {
        events.push({ type: 'encounter_end', time: endTime, priority: 3, encounterIndex: i });
      }
    }

    // 3.5. 루프 구간 전이 및 타임라인 완료 경계 (ASSAULT-LOOP-04, LOOP-05)
    if (this._timeline) {
      const transitions = this._timeline.getPendingTransitions(toT);
      for (const tr of transitions) {
        events.push({
          type: 'loop_segment',
          time: tr.time,
          priority: this._timeline.getTransitionPriority(tr.segment),
          loopSegment: tr.segment,
          prevLoopSegment: tr.prevSegment,
        });
      }
      if (this._timeline.isCompleted(toT)) {
        events.push({
          type: 'timeline_complete',
          time: this._timeline.totalSeconds,
          priority: 10,
        });
      }
    }

    // 4. 대기 중인 사용자 입력들
    const remainingInputs: PendingInput[] = [];
    for (const input of this._pendingInputs) {
      if (input.activeSeconds <= toT) {
        events.push({
          type: 'user_input',
          time: input.activeSeconds,
          priority: 2, // A08: 마감(priority 3)과 동일 시각(t == deadline)일 때 입력이 우선 처리됨
          input,
        });
      } else {
        remainingInputs.push(input);
      }
    }
    this._pendingInputs.length = 0;
    this._pendingInputs.push(...remainingInputs);

    // 5. 시간순 정렬 (A08, A17)
    events.sort((a, b) => {
      if (Math.abs(a.time - b.time) > 1e-6) {
        return a.time - b.time;
      }
      return a.priority - b.priority;
    });

    // 6. 이벤트 순차 실행
    for (const event of events) {
      if (this._isCompleted) {
        break;
      }
      switch (event.type) {
        case 'loop_segment': {
          if (event.prevLoopSegment?.kind === 'run_question') {
            this._options.onRunEnd?.();
          }
          if (event.loopSegment) {
            this._options.onLoopSegmentChange?.(event.loopSegment, event.prevLoopSegment);
          }
          break;
        }

        case 'timeline_complete': {
          this._completeRound(true);
          break;
        }

        case 'readable': {
          this._readableFired = true;
          if (this._phase === 'throw_in') {
            this._setPhase('question_reading');
          }
          break;
        }

        case 'reading_end': {
          this._readingEndFired = true;
          if (this._encounters.length > 0) {
            this._setPhase('encounters');
            this._currentEncounterIndex = 0;
          } else {
            this._completeRound(true);
          }
          break;
        }

        case 'encounter_start': {
          const enc = this._encounters[event.encounterIndex!];
          if (enc) {
            enc.startFired = true;
            this._currentEncounterIndex = event.encounterIndex!;
            if (enc.def.kind === 'squat' && enc.squatJudge) {
              this._initJudgesForEncounter(enc);
            }
            this._options.onEncounterStart?.(enc.def, enc.index);
          }
          break;
        }

        case 'user_input': {
          const input = event.input!;

          // 스쿼트 프레임 입력(특히 standing 복귀 등)인 경우, 판정창 외부(휴식 구간)에서도
          // 직립 상태 및 세대 갱신(_squatStandState)을 추적해야 한다.
          const makeSquatFeed = (inp: PendingInput, gen: number): AssaultSquatResult => {
            const isDuck = inp.posture === 'ducking' || (inp.posture as string) === 'squatting';
            return inp.squatResult ?? {
              timestampMs: inp.timestampMs, posture: isDuck ? 'ducking' : ((inp.posture as AssaultSquatPosture) ?? 'ducking'),
              isDucking: isDuck, isStanding: inp.posture === 'standing', isValid: true, standGeneration: gen,
              deltaY: isDuck ? 0.2 : 0.0, normalizedCurrentY: isDuck ? 0.7 : 0.5, normalizedBaselineY: 0.5,
            };
          };

          if (input.type === 'squat') {
            const feedResult = makeSquatFeed(input, input.standGeneration ?? 0);

            // 직립 상태 및 세대 소비 상태 전역 동기화
            let hasStoodUp = this._squatStandState.hasStoodUpSinceLastEvade;
            let currentGen = this._squatStandState.currentStandGeneration;
            let newConsumed = this._squatStandState.consumedGenerations;
            if (feedResult.standGeneration !== undefined) {
              currentGen = feedResult.standGeneration;
            }
            if (feedResult.isStanding || feedResult.posture === 'standing') {
              hasStoodUp = true;
            } else if (!input.squatResult && input.standGeneration === undefined) {
              // 축약 입력(submitSquat)의 경우 프레임 간격마다 암묵적 새 세대 진입 허용
              currentGen = currentGen + 1;
              hasStoodUp = true;
              // 이미 소비된 세대 목록에 현재 generation이 포함되어 있다면 해제하여 통과 허용
              if (newConsumed.includes(currentGen)) {
                newConsumed = Object.freeze(newConsumed.filter((g) => g !== currentGen));
              }
            }
            this._squatStandState = Object.freeze({
              consumedGenerations: newConsumed,
              hasStoodUpSinceLastEvade: hasStoodUp,
              currentStandGeneration: currentGen,
            });
          }

          // 단일 활성 전투 조우 검색 (ASSAULT-LOOP-05)
          // 4박 선택 및 스쿼트 회피창 내부의 미정산 조우 검색 (정각 포함, 종료 후 ε 제외)
          let enc = this._encounters.find(
            (e) =>
              !e.isResolved &&
              event.time >= e.startSeconds - 1e-6 &&
              event.time <= e.deadlineSeconds,
          );
          if (!enc && !this._timeline) {
            enc = this._encounters[this._currentEncounterIndex];
          }

          if (enc && !enc.isResolved) {
            // 준비박(resumeReadyBeats) 동안 입력 차단: 준비박 중에는 판정 불가 (REC-08)
            // 루프 스쿼트의 경우 notice(예고) 구간의 조기 웅크림은 SquatJudge가 상태를 기록하므로 허용
            const judgeWindowStart = (this._timeline && enc.def.kind === 'squat')
              ? enc.startSeconds
              : (enc.readyUntilSeconds ?? enc.startSeconds);
            if (event.time < judgeWindowStart) {
              break;
            }

            if (input.type === 'punch' && enc.def.kind === 'answer_pair' && enc.pairJudge) {
              const cmds = enc.pairJudge.punch({
                hand: input.hand!,
                timestampMs: input.timestampMs,
                inputId: input.inputId ?? `input_${input.timestampMs}`,
              });
              this._collectCommands(cmds);
              this._recordJudgeResult(enc, false);
              if (enc.pairJudge.state.status === 'correct') {
                enc.isResolved = true;
              }
            } else if (input.type === 'squat' && enc.def.kind === 'squat' && enc.squatJudge) {
              const defaultGen = input.standGeneration !== undefined
                ? input.standGeneration
                : (this._squatStandState.currentStandGeneration > 0 ? this._squatStandState.currentStandGeneration : 1);
              const feedResult = makeSquatFeed(input, defaultGen);
              if (!input.squatResult && input.standGeneration === undefined && enc.squatJudge.state.consumedGenerations.includes(feedResult.standGeneration)) {
                enc.squatJudge = new AssaultSquatJudge(enc.squatJudge.plan, enc.squatJudge.config, {
                  consumedGenerations: this._squatStandState.consumedGenerations,
                  hasStoodUpSinceLastEvade: true,
                  currentStandGeneration: this._squatStandState.currentStandGeneration,
                });
              }
              const cmds = enc.squatJudge.feed(feedResult);
              this._syncSquatStandStateFromJudge(enc.squatJudge);
              this._collectCommands(cmds);
              this._recordJudgeResult(enc, false);
              if (enc.squatJudge.state.status === 'evaded') {
                enc.isResolved = true;
              }
            }
          }
          break;
        }

        case 'encounter_arrival': {
          const enc = this._encounters[event.encounterIndex!];
          if (enc) {
            enc.arrivalFired = true;
            if (enc.def.kind === 'answer_pair' && enc.pairJudge) {
              const cmds = enc.pairJudge.arrival(Math.round(enc.arrivalSeconds * 1000));
              if (cmds.length > 0) {
                this._collectCommands(cmds);
                enc.isResolved = true;
                this._recordJudgeResult(enc, true);
              }
            }
          }
          break;
        }

        case 'encounter_deadline': {
          const enc = this._encounters[event.encounterIndex!];
          if (enc) {
            enc.deadlineFired = true;
            if (!enc.isResolved) {
              const tickMs = Math.round(enc.deadlineSeconds * 1000) + 1;
              const judge = enc.pairJudge ?? enc.squatJudge;
              if (judge) {
                this._collectCommands(judge.tick(tickMs));
                enc.isResolved = true;
              }
              this._recordJudgeResult(enc, true);
            }
          }
          break;
        }

        case 'encounter_end': {
          const enc = this._encounters[event.encounterIndex!];
          if (enc) {
            enc.endFired = true;
            this._options.onEncounterEnd?.(enc.def, enc.index);

            const nextIndex = event.encounterIndex! + 1;
            if (nextIndex < this._encounters.length) {
              this._currentEncounterIndex = Math.max(this._currentEncounterIndex, nextIndex);
            }

            if (!this._timeline) {
              const allDone = this._encounters.every((e) => e.endFired);
              if (allDone) {
                this._completeRound(true);
              }
            }
          }
          break;
        }
      }
    }

    if (!this._timeline && !this._isCompleted && this._encounters.length > 0) {
      const allDone = this._encounters.every(
        (e) => e.endFired || (e.isResolved && toT >= e.arrivalSeconds),
      );
      if (allDone) {
        this._completeRound(true);
      }
    } else if (this._timeline && !this._isCompleted && this._timeline.isCompleted(toT)) {
      this._completeRound(true);
    }
  }

  private _syncSquatStandStateFromJudge(judge: AssaultSquatJudge): void {
    const exported = judge.exportStandState();
    this._squatStandState = Object.freeze({
      consumedGenerations: exported.consumedGenerations,
      hasStoodUpSinceLastEvade: exported.hasStoodUpSinceLastEvade,
      currentStandGeneration: exported.currentStandGeneration,
    });
  }

  private _collectCommands(cmds: readonly AssaultSettlementCommand[]): void {
    for (const cmd of cmds) {
      this._settlementCommands.push(cmd);
      this._options.onSettlementCommand?.(cmd);
    }
  }

  private _updateReadingProgress(toT: number): void {
    if (this._phase === 'throw_in') {
      this._readingProgress = 0.0;
    } else if (this._phase === 'question_reading') {
      const elapsed = toT - this._throwDurationSeconds;
      this._readingProgress = Math.min(
        1.0,
        Math.max(0.0, elapsed / this._readingDurationSeconds),
      );
    } else {
      this._readingProgress = 1.0;
    }
  }

  private _setPhase(nextPhase: AssaultRoundPhase): void {
    if (this._phase === nextPhase) return;
    const prevPhase = this._phase;
    this._phase = nextPhase;
    this._options.onPhaseChange?.(nextPhase, prevPhase);
  }

  /**
   * 판정기 실제 상태를 요약에 attackId당 1회 기록한다 (REC-11 / #596).
   * wrong_locked는 동시 타격 롤백 가능성이 있어 확정 시점(isFinal: 마감/라운드 종료)에만 기록한다.
   */
  private _recordJudgeResult(enc: RuntimeEncounter, isFinal: boolean): void {
    const attackId = enc.def.id;
    if (enc.pairJudge) {
      const { status, rhythmRating } = enc.pairJudge.state;
      if (status === 'correct') {
        this._summary.recordAnswerHit(attackId, { isCorrect: true, rating: rhythmRating });
      } else if (status === 'timeout') {
        this._summary.recordAnswerTimeout(attackId, { rating: rhythmRating });
      } else if (status === 'wrong_locked' && isFinal) {
        this._summary.recordAnswerHit(attackId, { isCorrect: false, rating: rhythmRating });
      }
    } else if (enc.squatJudge) {
      const { status } = enc.squatJudge.state;
      if (status === 'evaded') {
        this._summary.recordSquatEvade(attackId);
      } else if (status === 'miss') {
        this._summary.recordSquatFail(attackId);
      }
    }
  }

  /** 활성 시간 축 전진: 라운드 완료 이전 구간만 활성 시간으로 측정 (일시정지 구간은 update에서 차단됨) */
  private _commitActiveTime(toT: number, wasCompleted: boolean): void {
    const clampedT = this._timeline ? Math.min(toT, this._timeline.totalSeconds) : toT;
    this._lastActiveSeconds = clampedT;
    this._updateReadingProgress(clampedT);
    if (!wasCompleted) {
      if (this._timeline) {
        if (!this._isCompleted) {
          this._summary.setActiveDuration(clampedT);
        }
      } else {
        this._summary.setActiveDuration(toT);
      }
    }
  }

  private _completeRound(success: boolean, reason?: string): void {
    if (this._isCompleted) {
      return;
    }
    if (this._timeline && success) {
      this._summary.setActiveDuration(this._timeline.totalSeconds);
      this._lastActiveSeconds = this._timeline.totalSeconds;
    }
    for (const enc of this._encounters) {
      this._recordJudgeResult(enc, true);
    }
    this._completedSuccess = success;
    this._setPhase('round_resolve');
    this._setPhase(success ? 'round_clear' : 'round_failed');
    this._isCompleted = true;

    if (!this._roundCompletedSignalEmitted) {
      this._roundCompletedSignalEmitted = true;
      this._options.onRoundComplete?.({
        sessionId: this.sessionId,
        roundId: this.roundId,
        success,
        ...(reason !== undefined ? { reason } : {}),
      });
    }
  }
}
