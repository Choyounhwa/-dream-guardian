/**
 * AssaultRoundController.ts - 투척·생각·교대 라운드 순수 진행 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§4, 5, 6.2, 13.1, 15.2-B3, 15.2-B8)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-15 / Issue #517)
 *
 * 절대 규칙:
 * 1. Game 순수 런타임 제어 단일 책임:
 *    - 단일 문제(라운드)의 생명주기(throw_in -> question_reading -> encounters -> round_resolve/round_clear)를 소유한다.
 *    - readable 시점부터 max(8박 * spb, readingMinSeconds)를 다음 박자에 정렬(DEC-B3).
 * 2. DEC-B3 시간 기반 비대기 TTS 정책:
 *    - 문제 진입 시 TTS 낭독 요청 신호를 1회 발행하되, 비대기(non-blocking)로 시간 계약에 따라 자동 전이.
 * 3. DEC-B8 공격 중 재개 정책:
 *    - 조우 진행 도중 일시정지 발생 후 해제 시: 진행 중이던 공격 예고부터 재시작 + 1박 카운트 유예(resumeReadyBeats: 1).
 *    - 이전 완료된 공격은 중복 실행/정산하지 않음.
 * 4. 활성 시각(#510) 기반 시간 전진 및 시간순 병합:
 *    - 입력과 지나간 논리 경계를 시간순 병합하고 동일 시각(t == deadline)에서만 입력 우선 처리(A08, A17).
 *    - 일시정지 중 경과 시간은 반영되지 않으며 복귀 시 읽기 시간이 소급 삭감되지 않음(A23).
 * 5. 정산 명령 수집 및 단일 완료 신호:
 *    - 조우들(#514, #515)에서 발생한 정산 명령을 수집하여 상위(#518)로 전달할 수 있는 snapshot/큐 제공.
 *    - 라운드 완료/종료 신호 1회 발행.
 * 6. 아키텍처 제약:
 *    - setTimeout, setInterval, rAF, DOM 이벤트 리스너 일체 배제 (순수 시뮬레이션/컨트롤러 클래스).
 *    - HP 직접 변경 0회 (정산 명령 발행만 담당).
 */

import type {
  SessionId,
  RoundId,
  AssaultRoundPhase,
  AssaultRoundPresentation,
  AssaultEncounterDef,
  AssaultAnswerSide,
  AssaultSettlementCommand,
} from '../../types/assault.js';
import type {
  AssaultCompiledPlan,
  AssaultCompiledEncounter,
} from './AssaultPlanCompiler.js';
import {
  AssaultPairJudge,
} from './AssaultPairJudge.js';
import {
  AssaultSquatJudge,
} from './AssaultSquatJudge.js';
import type {
  AssaultSquatPosture,
} from '../../motion/AssaultSquatAdapter.js';
import {
  DEFAULT_ASSAULT_CONFIG,
  type AssaultTimingAndBalanceConfig,
} from '../../../config/assault.config.js';
import type { AssaultNoteAdapter } from './AssaultNoteAdapter.js';

// ─── 1. 입력 및 옵션 타입 계약 ───

/** 문제 데이터 계약 */
export interface AssaultRoundQuestionData {
  readonly id: string;
  readonly text: string;
  readonly type?: string;
  readonly [key: string]: unknown;
}

/** 조우 런타임 상태 */
interface RuntimeEncounter {
  readonly def: AssaultEncounterDef;
  readonly index: number;
  startSeconds: number;
  arrivalSeconds: number;
  deadlineSeconds: number;
  endSeconds: number;
  readonly lateGraceSeconds: number;
  pairJudge?: AssaultPairJudge;
  squatJudge?: AssaultSquatJudge;
  startFired: boolean;
  arrivalFired: boolean;
  deadlineFired: boolean;
  endFired: boolean;
  isResolved: boolean;
}

/** 라운드 컨트롤러 확장 설정 계약 */
export interface AssaultRoundConfig extends AssaultTimingAndBalanceConfig {
  readonly lateGraceMs: number;
  readonly minDuckingDurationMs: number;
  readonly trackingLossGraceSeconds: number;
  readonly simultaneousPunchGraceMs: number;
}

/** 타임라인 내부 이벤트 */
type TimelineEventType =
  | 'readable'
  | 'reading_end'
  | 'encounter_start'
  | 'user_input'
  | 'encounter_arrival'
  | 'encounter_deadline'
  | 'encounter_end';

interface PendingInput {
  type: 'punch' | 'squat';
  hand?: 'left' | 'right';
  posture?: AssaultSquatPosture | 'squatting';
  timestampMs: number;
  activeSeconds: number;
  inputId?: string;
  standGeneration?: number;
}

interface TimelineEvent {
  type: TimelineEventType;
  time: number;
  priority: number;
  encounterIndex?: number;
  input?: PendingInput;
}

/** 라운드 컨트롤러 생성 옵션 */
export interface AssaultRoundControllerOptions {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly question: AssaultRoundQuestionData | string;
  readonly plan:
    | AssaultCompiledPlan
    | { readonly encounters: readonly (AssaultEncounterDef | AssaultCompiledEncounter)[] };
  readonly bpm?: number;
  readonly config?: Partial<AssaultRoundConfig>;
  readonly throwDurationSeconds?: number;
  readonly noteAdapter?: AssaultNoteAdapter;
  readonly onTtsSpeak?: (questionText: string) => void;
  readonly onPhaseChange?: (phase: AssaultRoundPhase, prevPhase: AssaultRoundPhase) => void;
  readonly onEncounterStart?: (encounter: AssaultEncounterDef, index: number) => void;
  readonly onEncounterEnd?: (encounter: AssaultEncounterDef, index: number) => void;
  readonly onRoundComplete?: (result: {
    sessionId: SessionId;
    roundId: RoundId;
    success: boolean;
  }) => void;
  readonly onSettlementCommand?: (command: AssaultSettlementCommand) => void;
}

// ─── 2. 헬퍼 함수 ───

function resolveReadingMinSeconds(
  question: AssaultRoundQuestionData,
  config: Partial<AssaultTimingAndBalanceConfig>,
): number {
  const readingMin = config.readingMinSeconds ?? DEFAULT_ASSAULT_CONFIG.readingMinSeconds;
  if (typeof readingMin === 'number') {
    return readingMin;
  }
  let opType = question.type;
  if (!opType && question.text) {
    if (question.text.includes('+')) opType = 'addition';
    else if (question.text.includes('-')) opType = 'subtraction';
    else if (question.text.includes('*') || question.text.includes('×')) opType = 'multiplication';
    else if (question.text.includes('/') || question.text.includes('÷')) opType = 'division';
  }
  const key = (opType ?? 'default') as keyof typeof readingMin;
  return readingMin[key] ?? readingMin.default ?? 3.5;
}

// ─── 3. 메인 컨트롤러 클래스 ───

export class AssaultRoundController {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  private readonly _question: AssaultRoundQuestionData;
  private readonly _config: AssaultRoundConfig;
  private readonly _options: AssaultRoundControllerOptions;

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

  private readonly _encounters: RuntimeEncounter[] = [];
  private readonly _settlementCommands: AssaultSettlementCommand[] = [];
  private readonly _pendingInputs: PendingInput[] = [];

  private _readableFired: boolean = false;
  private _readingEndFired: boolean = false;

  constructor(options: AssaultRoundControllerOptions) {
    this._options = options;
    this.sessionId = options.sessionId;
    this.roundId = options.roundId;

    // 1. 문제 데이터 정규화
    if (typeof options.question === 'string') {
      this._question = Object.freeze({
        id: `q_${options.roundId}`,
        text: options.question,
      });
    } else {
      this._question = Object.freeze({ ...options.question });
    }

    // 2. 설정 정규화
    this._config = Object.freeze({
      ...DEFAULT_ASSAULT_CONFIG,
      ...options.config,
      lateGraceMs: options.config?.lateGraceMs ?? 170,
      minDuckingDurationMs: options.config?.minDuckingDurationMs ?? 100,
      trackingLossGraceSeconds: options.config?.trackingLossGraceSeconds ?? 1.0,
      simultaneousPunchGraceMs: options.config?.simultaneousPunchGraceMs ?? 50,
    });

    // 3. 타이밍 산출
    const planBpm = 'bpm' in options.plan && typeof options.plan.bpm === 'number' ? options.plan.bpm : undefined;
    this._bpm = options.bpm ?? planBpm ?? 120;
    this._secondsPerBeat = 60 / this._bpm;
    this._throwDurationSeconds = options.throwDurationSeconds ?? 1.0;

    // 생각 시간 산출: max(8박 * spb, readingMinSeconds)를 다음 박자에 정렬 (DEC-B3, A03)
    const minBeats = this._config.minRoundBeats;
    const minSeconds = resolveReadingMinSeconds(this._question, this._config);
    const targetBeats = Math.max(minBeats, Math.ceil(minSeconds / this._secondsPerBeat));
    this._readingDurationSeconds = targetBeats * this._secondsPerBeat;
    this._readingEndTime = this._throwDurationSeconds + this._readingDurationSeconds;

    // 4. 초기 상태
    this._phase = this._throwDurationSeconds > 0 ? 'throw_in' : 'question_reading';
    this._readableFired = this._throwDurationSeconds <= 0;

    // 5. 조우 런타임 초기화
    const encounterDefs = options.plan.encounters;
    const lateGraceSeconds = this._config.lateGraceMs / 1000;

    for (let i = 0; i < encounterDefs.length; i++) {
      const def = encounterDefs[i];
      const startSeconds = this._readingEndTime + def.startBeat * this._secondsPerBeat;
      const arrivalSeconds = startSeconds + def.durationBeats * this._secondsPerBeat;
      const deadlineSeconds = arrivalSeconds + lateGraceSeconds;
      const endSeconds = deadlineSeconds;

      const runtimeEnc: RuntimeEncounter = {
        def,
        index: i,
        startSeconds,
        arrivalSeconds,
        deadlineSeconds,
        endSeconds,
        lateGraceSeconds,
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

  get phase(): AssaultRoundPhase {
    return this._phase;
  }

  get question(): AssaultRoundQuestionData {
    return this._question;
  }

  get questionText(): string {
    return this._question.text;
  }

  get currentEncounterIndex(): number {
    return this._currentEncounterIndex;
  }

  get totalEncounters(): number {
    return this._encounters.length;
  }

  get readingProgress(): number {
    return this._readingProgress;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isCompleted(): boolean {
    return this._isCompleted;
  }

  get readingDurationSeconds(): number {
    return this._readingDurationSeconds;
  }

  get readingEndTime(): number {
    return this._readingEndTime;
  }

  get throwDurationSeconds(): number {
    return this._throwDurationSeconds;
  }

  get encounters(): readonly AssaultEncounterDef[] {
    return Object.freeze(this._encounters.map((e) => e.def));
  }

  get settlementCommands(): readonly AssaultSettlementCommand[] {
    return Object.freeze([...this._settlementCommands]);
  }

  getSettlementCommands(): readonly AssaultSettlementCommand[] {
    return Object.freeze([...this._settlementCommands]);
  }

  drainSettlementCommands(): readonly AssaultSettlementCommand[] {
    const drained = [...this._settlementCommands];
    this._settlementCommands.length = 0;
    return Object.freeze(drained);
  }

  getPresentationSnapshot(): AssaultRoundPresentation {
    return Object.freeze({
      sessionId: this.sessionId,
      roundId: this.roundId,
      phase: this._phase,
      questionText: this._question.text,
      currentEncounterIndex: this._currentEncounterIndex,
      totalEncounters: this._encounters.length,
      activeSeconds: this._lastActiveSeconds,
      readingProgress: this._readingProgress,
      isPaused: this._isPaused,
    });
  }

  // ─── 5. 생명주기 및 시간 전진 ───

  update(activeSeconds: number, _dt?: number): void {
    // 1. TTS 낭독 요청 신호: 최초 업데이트 시 정확히 1회 발행 (DEC-B3)
    if (!this._ttsRequested) {
      this._ttsRequested = true;
      this._options.onTtsSpeak?.(this.questionText);
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

    // 4. 시간순 경계 및 입력 처리
    this._processTimelineEvents(fromT, toT);

    // 5. 시각 갱신 및 진행률 계산
    this._lastActiveSeconds = toT;
    this._updateReadingProgress(toT);
  }

  pause(_reason?: string): void {
    this._isPaused = true;
  }

  resume(): void {
    if (!this._isPaused) {
      return;
    }
    this._isPaused = false;

    // DEC-B8 (공격 중 재개 정책):
    // 조우(공격) 진행 도중 일시정지 발생 후 해제 시:
    // 진행 중이던 공격 예고부터 재시작 + 1박 카운트 유예(resumeReadyBeats: 1) 제공.
    if (this._phase === 'encounters' && this._currentEncounterIndex < this._encounters.length) {
      const curr = this._encounters[this._currentEncounterIndex];
      if (curr && !curr.isResolved) {
        const readyGraceSeconds = this._config.resumeReadyBeats * this._secondsPerBeat;
        const oldEndSeconds = curr.endSeconds;

        curr.startSeconds = this._lastActiveSeconds;
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
            nextEnc.arrivalSeconds += shiftDelta;
            nextEnc.deadlineSeconds += shiftDelta;
            nextEnc.endSeconds += shiftDelta;
            this._initJudgesForEncounter(nextEnc);
          }
        }
      }
    }
  }

  abort(reason: string = 'aborted'): void {
    this._completeRound(false, reason);
  }

  // ─── 6. 입력 주입 인터페이스 ───

  submitPunch(
    hand: 'left' | 'right',
    timestampMs: number,
    options?: { activeSeconds?: number; inputId?: string },
  ): void {
    const activeSeconds = options?.activeSeconds ?? this._lastActiveSeconds;
    this._pendingInputs.push({
      type: 'punch',
      hand,
      timestampMs,
      activeSeconds,
      inputId: options?.inputId ?? `punch_${this.sessionId}_${this._pendingInputs.length}_${timestampMs}`,
    });

    if (activeSeconds >= this._lastActiveSeconds) {
      this._processTimelineEvents(this._lastActiveSeconds, activeSeconds);
      this._lastActiveSeconds = activeSeconds;
      this._updateReadingProgress(activeSeconds);
    } else {
      this._processTimelineEvents(this._lastActiveSeconds, this._lastActiveSeconds);
    }
  }

  submitSquat(
    posture: AssaultSquatPosture | 'squatting',
    timestampMs: number,
    options?: { activeSeconds?: number; standGeneration?: number },
  ): void {
    const activeSeconds = options?.activeSeconds ?? this._lastActiveSeconds;
    this._pendingInputs.push({
      type: 'squat',
      posture,
      timestampMs,
      activeSeconds,
      standGeneration: options?.standGeneration,
    });

    if (activeSeconds >= this._lastActiveSeconds) {
      this._processTimelineEvents(this._lastActiveSeconds, activeSeconds);
      this._lastActiveSeconds = activeSeconds;
      this._updateReadingProgress(activeSeconds);
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

    if (def.kind === 'answer_pair') {
      enc.pairJudge = new AssaultPairJudge(
        {
          sessionId: this.sessionId,
          roundId: this.roundId,
          attackId: def.id,
          pairId: def.pairId ?? def.id,
          correctSide: def.correctSide ?? def.correctAnswerSide ?? 'left',
          arrivalMs: Math.round(enc.arrivalSeconds * 1000),
        },
        {
          lateGraceMs: Math.round(enc.lateGraceSeconds * 1000),
        },
      );
    } else if (def.kind === 'squat') {
      enc.squatJudge = new AssaultSquatJudge(
        {
          sessionId: this.sessionId,
          roundId: this.roundId,
          attackId: def.id,
          windowStartMs: Math.round(enc.startSeconds * 1000),
          arrivalMs: Math.round(enc.arrivalSeconds * 1000),
          startBeat: def.startBeat,
          durationBeats: def.durationBeats,
        },
        {
          lateGraceMs: Math.round(enc.lateGraceSeconds * 1000),
          minDuckingDurationMs: this._config.minDuckingDurationMs,
          emitEvadeSuccessCommand: true,
        },
      );
    }
  }

  private _processTimelineEvents(_fromT: number, toT: number): void {
    const events: TimelineEvent[] = [];

    // 1. readable 경계
    if (!this._readableFired && toT >= this._throwDurationSeconds) {
      events.push({
        type: 'readable',
        time: this._throwDurationSeconds,
        priority: 1,
      });
    }

    // 2. reading_end 경계
    if (!this._readingEndFired && toT >= this._readingEndTime) {
      events.push({
        type: 'reading_end',
        time: this._readingEndTime,
        priority: 1,
      });
    }

    // 3. 조우 경계들
    for (let i = 0; i < this._encounters.length; i++) {
      const enc = this._encounters[i];

      if (!enc.startFired && toT >= enc.startSeconds) {
        events.push({
          type: 'encounter_start',
          time: enc.startSeconds,
          priority: 1,
          encounterIndex: i,
        });
      }

      if (!enc.arrivalFired && toT >= enc.arrivalSeconds) {
        events.push({
          type: 'encounter_arrival',
          time: enc.arrivalSeconds,
          priority: 3,
          encounterIndex: i,
        });
      }

      if (!enc.deadlineFired && toT >= enc.deadlineSeconds) {
        events.push({
          type: 'encounter_deadline',
          time: enc.deadlineSeconds,
          priority: 3,
          encounterIndex: i,
        });
      }

      // 조우 종료 시점: 이미 정산 완료된 경우 arrivalSeconds에 종료, 미정산 시 lateGrace를 포함한 deadlineSeconds에 종료
      const endTime = enc.isResolved ? enc.arrivalSeconds : enc.deadlineSeconds;
      if (!enc.endFired && toT >= endTime) {
        events.push({
          type: 'encounter_end',
          time: endTime,
          priority: 3,
          encounterIndex: i,
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
      switch (event.type) {
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
            this._options.onEncounterStart?.(enc.def, enc.index);
          }
          break;
        }

        case 'user_input': {
          const input = event.input!;
          // 입력 시점과 일치하는 미정산 조우 검색 (창 내부 조우 우선)
          let enc = this._encounters.find(
            (e) =>
              !e.isResolved &&
              event.time >= e.startSeconds &&
              event.time <= e.deadlineSeconds,
          );
          if (!enc) {
            enc = this._encounters[this._currentEncounterIndex];
          }

          if (enc && !enc.isResolved) {
            if (input.type === 'punch' && enc.def.kind === 'answer_pair' && enc.pairJudge) {
              const cmds = enc.pairJudge.punch({
                hand: input.hand!,
                timestampMs: input.timestampMs,
                inputId: input.inputId ?? `input_${input.timestampMs}`,
              });
              this._collectCommands(cmds);
              if (
                enc.pairJudge.state.status === 'correct' ||
                enc.pairJudge.state.status === 'wrong_locked'
              ) {
                enc.isResolved = true;
              }
            } else if (input.type === 'squat' && enc.def.kind === 'squat' && enc.squatJudge) {
              const isDucking =
                input.posture === 'ducking' || (input.posture as string) === 'squatting';
              const isStanding = input.posture === 'standing';
              const normalizedPosture: AssaultSquatPosture =
                (input.posture as string) === 'squatting'
                  ? 'ducking'
                  : ((input.posture as AssaultSquatPosture) ?? 'ducking');
              const cmds = enc.squatJudge.feed({
                timestampMs: input.timestampMs,
                posture: normalizedPosture,
                isDucking,
                isStanding,
                isValid: true,
                standGeneration: input.standGeneration ?? 0,
                deltaY: isDucking ? 0.2 : 0.0,
                normalizedCurrentY: isDucking ? 0.7 : 0.5,
                normalizedBaselineY: 0.5,
              });
              this._collectCommands(cmds);
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
          }
          break;
        }

        case 'encounter_deadline': {
          const enc = this._encounters[event.encounterIndex!];
          if (enc) {
            enc.deadlineFired = true;
            if (!enc.isResolved) {
              if (enc.def.kind === 'answer_pair' && enc.pairJudge) {
                const cmds = enc.pairJudge.tick(Math.round(enc.deadlineSeconds * 1000) + 1);
                this._collectCommands(cmds);
                enc.isResolved = true;
              } else if (enc.def.kind === 'squat' && enc.squatJudge) {
                const cmds = enc.squatJudge.tick(Math.round(enc.deadlineSeconds * 1000) + 1);
                this._collectCommands(cmds);
                enc.isResolved = true;
              }
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

            const allDone = this._encounters.every((e) => e.endFired);
            if (allDone) {
              this._completeRound(true);
            }
          }
          break;
        }
      }
    }

    if (!this._isCompleted && this._encounters.length > 0) {
      const allDone = this._encounters.every(
        (e) => e.endFired || (e.isResolved && toT >= e.arrivalSeconds),
      );
      if (allDone) {
        this._completeRound(true);
      }
    }
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
    if (this._phase === nextPhase) {
      return;
    }
    const prevPhase = this._phase;
    this._phase = nextPhase;
    this._options.onPhaseChange?.(nextPhase, prevPhase);
  }

  private _completeRound(success: boolean, _reason?: string): void {
    if (this._isCompleted) {
      return;
    }
    this._setPhase('round_resolve');
    this._setPhase(success ? 'round_clear' : 'round_failed');
    this._isCompleted = true;

    if (!this._roundCompletedSignalEmitted) {
      this._roundCompletedSignalEmitted = true;
      this._options.onRoundComplete?.({
        sessionId: this.sessionId,
        roundId: this.roundId,
        success,
      });
    }
  }
}
