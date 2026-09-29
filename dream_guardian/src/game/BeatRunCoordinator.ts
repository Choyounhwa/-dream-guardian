/**
 * BeatRunCoordinator - 8박 문제 준비 라운드 및 정답존 전환 코디네이터
 *
 * 실제 운동 8회 루프:
 * - RUN_QUESTION (0/8~8/8): 문제 출제, 비블로킹 TTS 낭독, 실제 locomotion 입력마다 1박 기록
 * - REST_READY (2박): 중앙 복귀 및 "READY... SET!" 준비
 * - KEYNOTE_PERFORMANCE (8박): 첫 박 정답 선택 및 후속 키노트 퍼포먼스
 * - ROUND_RESOLVE: 성패 결과를 한 번만 정산
 *
 * @see Issue #180 [BEAT-RUN-001]
 * @see Issue #176 [BEAT-SPEC-001]
 */

import { RhythmEngine } from '../core/RhythmEngine.js';
import { CenterReturnGate } from '../motion/CenterReturnGate.js';
import { AnswerZoneSelector } from '../input/AnswerZoneSelector.js';
import { QuestionBank } from '../question/QuestionBank.js';
import { BattleState } from './BattleState.js';
import { generateQuestion, type GeneratedQuestion } from '../question/QuestionEvaluator.js';
import type { NormalizedLandmark } from '../types/index.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import type { RoundAnswerStatus } from '../types/result.js';
import type { Keynote } from '../types/keynote.js';

export type BeatPhase =
  | 'RUN_QUESTION'
  | 'REST_READY'
  | 'KEYNOTE_PERFORMANCE'
  | 'ROUND_RESOLVE';

export interface BeatRunCoordinatorOptions {
  questionBank?: QuestionBank;
  battle?: BattleState;
  speakFn?: (text: string) => void;
  rhythmEngine?: RhythmEngine;
  centerReturnGate?: CenterReturnGate;
  answerZoneSelector?: AnswerZoneSelector;
  keynotes?: readonly Keynote[];
  onQuestionGenerated?: (question: GeneratedQuestion) => void;
  onPhaseChange?: (phase: BeatPhase) => void;
  onAnswerConfirmed?: (choiceIndex: number, correct: boolean, status: RoundAnswerStatus) => void;
  onAnswerSelected?: (choiceIndex: number) => void;
}

const EXERCISE_BEATS_PER_ROUND = 8;
const READY_BEATS = 2;
const PERFORMANCE_BEATS = 8;

export class BeatRunCoordinator {
  private readonly _rhythmEngine: RhythmEngine;
  private readonly _centerReturnGate: CenterReturnGate;
  private readonly _answerZoneSelector: AnswerZoneSelector;
  private readonly _questionBank: QuestionBank;
  private readonly _options: BeatRunCoordinatorOptions;

  private _phase: BeatPhase = 'RUN_QUESTION';
  private _currentQuestion: GeneratedQuestion | null = null;
  private _questionGeneratedCount = 0;
  private _totalSteps = 0;
  private _completedExerciseBeats = 0;
  private _readyElapsed = 0;
  private _performanceElapsed = 0;
  private _selectedChoiceIndex: number | null = null;
  private _roundResolveCount = 0;
  private _keynotes: readonly Keynote[] = [];

  constructor(options?: BeatRunCoordinatorOptions) {
    this._options = options ?? {};
    this._rhythmEngine = options?.rhythmEngine ?? new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
    this._centerReturnGate = options?.centerReturnGate ?? new CenterReturnGate();
    this._answerZoneSelector = options?.answerZoneSelector ?? new AnswerZoneSelector();
    this._questionBank = options?.questionBank ?? new QuestionBank();
    this._keynotes = options?.keynotes ? [...options.keynotes] : [];
  }

  get phase(): BeatPhase {
    return this._phase;
  }

  get isAnswerOpen(): boolean {
    return (
      this._phase === 'KEYNOTE_PERFORMANCE' &&
      this.performanceBeat === 1 &&
      this._selectedChoiceIndex === null
    );
  }

  /** 현재 선택된 답안 인덱스 (0: 좌, 1: 우, 미선택 시 null) */
  get selectedChoiceIndex(): number | null {
    return this._selectedChoiceIndex;
  }

  get currentQuestion(): GeneratedQuestion | null {
    return this._currentQuestion;
  }

  get questionGeneratedCount(): number {
    return this._questionGeneratedCount;
  }

  get beatIndex(): number {
    return this._rhythmEngine.beatIndex;
  }

  get totalBeats(): number {
    return this._rhythmEngine.totalBeats;
  }

  get rhythmEngine(): RhythmEngine {
    return this._rhythmEngine;
  }

  get centerReturnGate(): CenterReturnGate {
    return this._centerReturnGate;
  }

  get answerZoneSelector(): AnswerZoneSelector {
    return this._answerZoneSelector;
  }

  get keynotes(): readonly Keynote[] {
    return this._keynotes;
  }

  setKeynotes(keynotes: readonly Keynote[]): void {
    this._keynotes = [...keynotes];
  }

  get totalSteps(): number {
    return this._totalSteps;
  }

  /** 현재 라운드에서 실제 운동으로 완료한 비트 수 (0~8) */
  get completedExerciseBeats(): number {
    return this._completedExerciseBeats;
  }

  /** REST_READY 내 완료된 준비 박 수 (0~2) */
  get readyBeat(): number {
    return Math.min(READY_BEATS, Math.floor(this._readyElapsed / this._rhythmEngine.secondsPerBeat));
  }

  /** KEYNOTE_PERFORMANCE 내 현재 박 (1~8, 비활성 시 0) */
  get performanceBeat(): number {
    if (this._phase !== 'KEYNOTE_PERFORMANCE') return 0;
    return Math.min(PERFORMANCE_BEATS, Math.floor(this._performanceElapsed / this._rhythmEngine.secondsPerBeat) + 1);
  }

  /** ROUND_RESOLVE가 실행된 횟수 (라운드당 정확히 1회) */
  get roundResolveCount(): number {
    return this._roundResolveCount;
  }

  /**
   * 새 라운드 시작 (달리기 1박부터 시작)
   * 문제 생성 및 비블로킹 TTS는 매 run phase 시작 시 정확히 1회 실행됨
   */
  startRound(options?: { chapter?: number; subLevel?: number }): void {
    if (options?.chapter !== undefined) {
      this._questionBank.setLevel(options.chapter, options.subLevel);
    }

    this._rhythmEngine.reset();
    this._rhythmEngine.start();
    this._phase = 'RUN_QUESTION';
    this._completedExerciseBeats = 0;
    this._readyElapsed = 0;
    this._performanceElapsed = 0;
    this._selectedChoiceIndex = null;
    this._roundResolveCount = 0;

    // 문제 생성 (정확히 1회)
    const record = this._questionBank.next();
    let q = generateQuestion(record);
    if (!q) q = generateQuestion(this._questionBank.next());
    if (!q) {
      q = {
        questionText: '3 + 5 = ?',
        correctAnswer: 8,
        wrongAnswer: 9,
        choices: [8, 9],
        correctIndex: 0,
      };
    }

    this._currentQuestion = q;
    this._questionGeneratedCount++;
    this._options.speakFn?.(q.questionText);
    this._options.onQuestionGenerated?.(q);

    // 하위 게이트/선택기 초기화
    this._centerReturnGate.reset();
    this._answerZoneSelector.reset();
    this._answerZoneSelector.setReference(null);

    this._options.onPhaseChange?.(this._phase);
  }

  /**
   * 매 프레임 업데이트 호출
   */
  update(
    dt: number,
    landmarks?: readonly NormalizedLandmark[] | null,
  ): void {
    if (!this._rhythmEngine.running) return;

    // 1. 1박째 정답 선택 업데이트 (KEYNOTE_PERFORMANCE 진입 상태에서 1박 경과 전 dt 반영)
    if (this._phase === 'KEYNOTE_PERFORMANCE' && this.isAnswerOpen) {
      if (!this._answerZoneSelector.isConfirmed) {
        const beat1Remaining = this._rhythmEngine.secondsPerBeat - this._performanceElapsed;
        const beat1Step = Math.min(Math.max(0, dt), Math.max(0, beat1Remaining));
        const state = this._answerZoneSelector.update(beat1Step, landmarks);
        if (state.isConfirmed) {
          const choiceIndex = state.confirmedZone === 'left' ? 0 : 1;
          this._handleAnswer(choiceIndex);
        }
      }
    }

    // 2. 페이즈 시간원 전진
    let remainingDt = Math.max(0, dt);
    while (remainingDt > 0 && this._phase !== 'RUN_QUESTION' && this._phase !== 'ROUND_RESOLVE') {
      if (this._phase === 'REST_READY') {
        const remainingReady = READY_BEATS * this._rhythmEngine.secondsPerBeat - this._readyElapsed;
        const stepDt = Math.min(remainingDt, remainingReady);
        this._readyElapsed += stepDt;
        this._centerReturnGate.update(stepDt, landmarks);
        remainingDt -= stepDt;

        if (this._readyElapsed >= READY_BEATS * this._rhythmEngine.secondsPerBeat - 1e-9) {
          if (!this._centerReturnGate.isLocked) this._centerReturnGate.forceFallbackLock();
          this._answerZoneSelector.setReference(this._centerReturnGate.reference);
          this._phase = 'KEYNOTE_PERFORMANCE';
          this._options.onPhaseChange?.(this._phase);
        }
      } else if (this._phase === 'KEYNOTE_PERFORMANCE') {
        const remainingPerformance = PERFORMANCE_BEATS * this._rhythmEngine.secondsPerBeat - this._performanceElapsed;
        const stepDt = Math.min(remainingDt, remainingPerformance);
        this._performanceElapsed += stepDt;
        remainingDt -= stepDt;

        if (this._performanceElapsed >= PERFORMANCE_BEATS * this._rhythmEngine.secondsPerBeat - 1e-9) {
          this._resolveRound();
        }
      }
    }

    // 3. REST_READY에서 방금 KEYNOTE_PERFORMANCE로 전이된 직후 프레임: 현재 랜드마크 상태 1회 동기화 (dt=0)
    if (this._phase === 'KEYNOTE_PERFORMANCE' && this.isAnswerOpen && this._performanceElapsed === 0) {
      if (!this._answerZoneSelector.isConfirmed) {
        this._answerZoneSelector.update(0, landmarks);
      }
    }
  }

  /**
   * 스텝 발생 기록
   */
  recordStep(_mode?: LocomotionMode): void {
    this._totalSteps++;

    if (this._phase !== 'RUN_QUESTION' || this._completedExerciseBeats >= EXERCISE_BEATS_PER_ROUND) {
      return;
    }

    this._completedExerciseBeats++;
    if (this._completedExerciseBeats === EXERCISE_BEATS_PER_ROUND) {
      this._phase = 'REST_READY';
      this._readyElapsed = 0;
      this._centerReturnGate.open({ roundIndex: this._rhythmEngine.roundIndex });
      this._options.onPhaseChange?.(this._phase);
    }
  }

  /**
   * 키보드/터치/클릭 비상 fallback 전이 (웹캠 미사용 환경)
   */
  triggerFallbackAdvance(): void {
    if (this._phase === 'REST_READY') {
      const ref = this._centerReturnGate.forceFallbackLock();
      this._answerZoneSelector.setReference(ref);
      this._readyElapsed = READY_BEATS * this._rhythmEngine.secondsPerBeat;
      this._phase = 'KEYNOTE_PERFORMANCE';
      this._options.onPhaseChange?.(this._phase);
    }
  }

  /**
   * 답안 선택 fallback 즉시 확정
   */
  confirmAnswerByFallback(choiceIndex: number): void {
    if (this.isAnswerOpen) {
      this._answerZoneSelector.selectByFallback(choiceIndex === 0 ? 'left' : 'right');
      this._handleAnswer(choiceIndex);
    }
  }

  /**
   * 정답/오답 판정 처리
   */
  private _handleAnswer(choiceIndex: number): void {
    if (!this.isAnswerOpen || !this._currentQuestion) return;
    this._selectedChoiceIndex = choiceIndex;
    this._options.onAnswerSelected?.(choiceIndex);
  }

  private _resolveRound(): void {
    if (this._phase === 'ROUND_RESOLVE' || !this._currentQuestion) return;

    const choiceIndex = this._selectedChoiceIndex;
    const correct = choiceIndex !== null && choiceIndex === this._currentQuestion.correctIndex;
    const status: RoundAnswerStatus = correct
      ? 'correct'
      : (choiceIndex === null ? 'timeout' : 'wrong');

    this._phase = 'ROUND_RESOLVE';
    this._roundResolveCount++;
    this._options.onAnswerConfirmed?.(choiceIndex ?? -1, correct, status);
    this._options.onPhaseChange?.(this._phase);
  }
}
