/**
 * BeatRunCoordinator - 8박 문제 준비 라운드 및 정답존 전환 코디네이터
 *
 * 실제 운동 8회 루프:
 * - RUN_QUESTION (0/8~8/8): 문제 출제, 비블로킹 TTS 낭독, 실제 locomotion 입력마다 1박 기록
 * - ANSWER_SELECT (최대 2박/1.0s): ArmReachAnswerSelector 0s 무체류 한 팔 도달 즉시 선택
 * - STAR_COLLECT (2~8박/3.5s): 정답 시 7개 키노트 순차 진행
 * - HAZARD_EVADE (2~8박/3.5s): 오답/타임아웃 시 바닥 충격파 회피 진행
 * - ROUND_RESOLVE: 분기 루틴 완료 후 단 1회 정산
 *
 * @see Issue #180 [BEAT-RUN-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #210 [BEAT-KEYNOTE-ENGINE-001]
 * @see Issue #224 [INPUT-ARM-ANSWER-001]
 * @see Issue #225 [BATTLE-ANSWER-PENALTY-001]
 */

import { RhythmEngine } from '../core/RhythmEngine.js';
import { CenterReturnGate } from '../motion/CenterReturnGate.js';
import { ArmReachAnswerSelector } from '../input/ArmReachAnswerSelector.js';
import { QuestionBank } from '../question/QuestionBank.js';
import { BattleState } from './BattleState.js';
import { generateQuestion, type GeneratedQuestion } from '../question/QuestionEvaluator.js';
import type { NormalizedLandmark } from '../types/index.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import type { RoundAnswerStatus } from '../types/result.js';
import type { Keynote } from '../types/keynote.js';

export type BeatRoutineMode = 'arm_reach' | 'legacy';

export type BeatPhase =
  | 'RUN_QUESTION'
  | 'ANSWER_SELECT'
  | 'STAR_COLLECT'
  | 'HAZARD_EVADE'
  | 'ROUND_RESOLVE'
  | 'REST_READY'
  | 'KEYNOTE_PERFORMANCE';

export interface BeatRunCoordinatorOptions {
  questionBank?: QuestionBank;
  battle?: BattleState;
  speakFn?: (text: string) => void;
  rhythmEngine?: RhythmEngine;
  centerReturnGate?: CenterReturnGate;
  armReachAnswerSelector?: ArmReachAnswerSelector;
  keynotes?: readonly Keynote[];
  routineMode?: BeatRoutineMode;
  onQuestionGenerated?: (question: GeneratedQuestion) => void;
  onPhaseChange?: (phase: BeatPhase) => void;
  onAnswerConfirmed?: (choiceIndex: number, correct: boolean, status: RoundAnswerStatus) => void;
  onAnswerSelected?: (choiceIndex: number) => void;
}

const EXERCISE_BEATS_PER_ROUND = 8;
const ANSWER_SELECT_BEATS = 2; // Issue #210: 최대 2박 (1.0s)
const BRANCH_ROUTINE_BEATS = 7; // Issue #210: 2~8박 (3.5s)
const READY_BEATS = 2;
const PERFORMANCE_BEATS = 8;

export class BeatRunCoordinator {
  private readonly _rhythmEngine: RhythmEngine;
  private readonly _centerReturnGate: CenterReturnGate;
  private readonly _armReachAnswerSelector: ArmReachAnswerSelector;
  private readonly _questionBank: QuestionBank;
  private readonly _options: BeatRunCoordinatorOptions;
  private readonly _routineMode: BeatRoutineMode;

  private _phase: BeatPhase = 'RUN_QUESTION';
  private _currentQuestion: GeneratedQuestion | null = null;
  private _questionGeneratedCount = 0;
  private _totalSteps = 0;
  private _completedExerciseBeats = 0;
  private _readyElapsed = 0;
  private _performanceElapsed = 0;
  private _answerSelectElapsed = 0;
  private _branchElapsed = 0;
  private _selectedChoiceIndex: number | null = null;
  private _roundResolveCount = 0;
  private _keynotes: readonly Keynote[] = [];

  constructor(options?: BeatRunCoordinatorOptions) {
    this._options = options ?? {};
    this._routineMode = options?.routineMode ?? (options?.armReachAnswerSelector ? 'arm_reach' : 'legacy');
    this._rhythmEngine = options?.rhythmEngine ?? new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
    this._centerReturnGate = options?.centerReturnGate ?? new CenterReturnGate();
    this._armReachAnswerSelector =
      options?.armReachAnswerSelector ?? new ArmReachAnswerSelector({ isMirrored: false });
    this._questionBank = options?.questionBank ?? new QuestionBank();
    this._keynotes = options?.keynotes ? [...options.keynotes] : [];
  }

  get routineMode(): BeatRoutineMode {
    return this._routineMode;
  }

  get phase(): BeatPhase {
    return this._phase;
  }

  get isAnswerOpen(): boolean {
    if (this._phase === 'ANSWER_SELECT') {
      return (
        this._selectedChoiceIndex === null &&
        this._answerSelectElapsed < ANSWER_SELECT_BEATS * this._rhythmEngine.secondsPerBeat
      );
    }
    if (this._phase === 'KEYNOTE_PERFORMANCE') {
      return this.performanceBeat === 1 && this._selectedChoiceIndex === null;
    }
    return false;
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

  get armReachAnswerSelector(): ArmReachAnswerSelector {
    return this._armReachAnswerSelector;
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

  /** KEYNOTE_PERFORMANCE 또는 분기 루틴 내 현재 박 (1~8, 비활성 시 0) */
  get performanceBeat(): number {
    if (this._phase === 'KEYNOTE_PERFORMANCE') {
      return Math.min(PERFORMANCE_BEATS, Math.floor(this._performanceElapsed / this._rhythmEngine.secondsPerBeat) + 1);
    }
    if (this._phase === 'STAR_COLLECT' || this._phase === 'HAZARD_EVADE') {
      return Math.min(8, Math.floor(this._branchElapsed / this._rhythmEngine.secondsPerBeat) + 2);
    }
    return 0;
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
    this._answerSelectElapsed = 0;
    this._branchElapsed = 0;
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
    this._armReachAnswerSelector.reset();

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

    if (this._routineMode === 'arm_reach') {
      let remainingDt = Math.max(0, dt);

      // 1. ANSWER_SELECT 페이즈 처리
      if (this._phase === 'ANSWER_SELECT') {
        if (this.isAnswerOpen) {
          if (!this._armReachAnswerSelector.isConfirmed) {
            this._armReachAnswerSelector.update(remainingDt, landmarks);
            if (this._armReachAnswerSelector.isConfirmed) {
              const choiceIndex = this._armReachAnswerSelector.confirmedChoiceIndex;
              if (choiceIndex !== null) {
                this._handleAnswer(choiceIndex);
                return;
              }
            }
          }
        }

        const maxAnswerTime = ANSWER_SELECT_BEATS * this._rhythmEngine.secondsPerBeat;
        const remainingAnswerTime = maxAnswerTime - this._answerSelectElapsed;
        const step = Math.min(remainingDt, remainingAnswerTime);
        this._answerSelectElapsed += step;
        remainingDt -= step;

        if (this._answerSelectElapsed >= maxAnswerTime - 1e-9 && this._selectedChoiceIndex === null) {
          // 2박 타임아웃 만료 -> HAZARD_EVADE 즉시 전이
          this._armReachAnswerSelector.closeWindow();
          this._selectedChoiceIndex = null;
          this._phase = 'HAZARD_EVADE';
          this._branchElapsed = 0;
          this._options.onPhaseChange?.(this._phase);
        }
      }

      // 2. 분기 루틴 처리 (STAR_COLLECT 또는 HAZARD_EVADE)
      if (this._phase === 'STAR_COLLECT' || this._phase === 'HAZARD_EVADE') {
        const branchMaxTime = BRANCH_ROUTINE_BEATS * this._rhythmEngine.secondsPerBeat;
        const remainingBranch = branchMaxTime - this._branchElapsed;
        const step = Math.min(remainingDt, remainingBranch);
        this._branchElapsed += step;
        remainingDt -= step;

        if (this._branchElapsed >= branchMaxTime - 1e-9) {
          this._resolveRound();
        }
      }
      return;
    }

    // ─── LEGACY ROUTINE (하위 호환 전용 시간 진행 루틴) ───
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
      if (this._routineMode === 'arm_reach') {
        this._phase = 'ANSWER_SELECT';
        this._answerSelectElapsed = 0;
        this._armReachAnswerSelector.openWindow();
        this._options.onPhaseChange?.(this._phase);
      } else {
        this._phase = 'REST_READY';
        this._readyElapsed = 0;
        this._centerReturnGate.open({ roundIndex: this._rhythmEngine.roundIndex });
        this._options.onPhaseChange?.(this._phase);
      }
    }
  }

  /**
   * 키보드/터치/클릭 비상 fallback 전이 (웹캠 미사용 환경)
   */
  triggerFallbackAdvance(): void {
    if (this._phase === 'RUN_QUESTION' && this._completedExerciseBeats < EXERCISE_BEATS_PER_ROUND) {
      while (this._completedExerciseBeats < EXERCISE_BEATS_PER_ROUND) {
        this.recordStep();
      }
      return;
    }
    if (this._phase === 'REST_READY') {
      this._centerReturnGate.forceFallbackLock();
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
      const armChoice: 0 | 1 = choiceIndex === 0 ? 0 : 1;
      this._armReachAnswerSelector.selectByFallback(armChoice);
      this._handleAnswer(choiceIndex);
    }
  }

  /**
   * 정답/오답 판정 처리
   */
  private _handleAnswer(choiceIndex: number): void {
    if (!this._currentQuestion) return;
    this._selectedChoiceIndex = choiceIndex;
    this._armReachAnswerSelector.closeWindow();
    this._options.onAnswerSelected?.(choiceIndex);

    if (this._routineMode === 'arm_reach') {
      const correct = choiceIndex === this._currentQuestion.correctIndex;
      this._phase = correct ? 'STAR_COLLECT' : 'HAZARD_EVADE';
      this._branchElapsed = 0;
      this._options.onPhaseChange?.(this._phase);
    }
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
