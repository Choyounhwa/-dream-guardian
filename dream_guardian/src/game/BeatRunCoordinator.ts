/**
 * BeatRunCoordinator - 8박 문제 준비 라운드 및 정답존 전환 코디네이터
 *
 * BPM 120 8박 루프:
 * - RUN_QUESTION (1~5박): 문제 출제, 비블로킹 TTS 낭독, locomotion 입력 기록
 * - CENTER_RETURN (6~7박): 중앙 복귀 네온 게이트 표시, 플레이어 중심 유도
 * - CENTER_LOCK (8박): 안정 프레임 중앙값으로 RoundCenterReference 잠금
 * - ANSWER_OPEN (답안 1~k박): AnswerZoneSelector로 좌/우 선택 확정
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

export type BeatPhase = 'RUN_QUESTION' | 'CENTER_RETURN' | 'ANSWER_OPEN';

export interface BeatRunCoordinatorOptions {
  questionBank?: QuestionBank;
  battle?: BattleState;
  speakFn?: (text: string) => void;
  rhythmEngine?: RhythmEngine;
  centerReturnGate?: CenterReturnGate;
  answerZoneSelector?: AnswerZoneSelector;
  onQuestionGenerated?: (question: GeneratedQuestion) => void;
  onPhaseChange?: (phase: BeatPhase) => void;
  onAnswerConfirmed?: (choiceIndex: number, correct: boolean) => void;
}

const SECONDS_TO_BEAT_6 = 2.5;

export class BeatRunCoordinator {
  private readonly _rhythmEngine: RhythmEngine;
  private readonly _centerReturnGate: CenterReturnGate;
  private readonly _answerZoneSelector: AnswerZoneSelector;
  private readonly _questionBank: QuestionBank;
  private readonly _battle?: BattleState;
  private readonly _options: BeatRunCoordinatorOptions;

  private _phase: BeatPhase = 'RUN_QUESTION';
  private _isAnswerOpen = false;
  private _currentQuestion: GeneratedQuestion | null = null;
  private _questionGeneratedCount = 0;
  private _totalSteps = 0;

  constructor(options?: BeatRunCoordinatorOptions) {
    this._options = options ?? {};
    this._rhythmEngine = options?.rhythmEngine ?? new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
    this._centerReturnGate = options?.centerReturnGate ?? new CenterReturnGate();
    this._answerZoneSelector = options?.answerZoneSelector ?? new AnswerZoneSelector();
    this._questionBank = options?.questionBank ?? new QuestionBank();
    this._battle = options?.battle;
  }

  get phase(): BeatPhase {
    return this._phase;
  }

  get isAnswerOpen(): boolean {
    return this._isAnswerOpen;
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

  get totalSteps(): number {
    return this._totalSteps;
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
    this._isAnswerOpen = false;

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

    const prevElapsed = this._rhythmEngine.elapsedTime;
    this._rhythmEngine.update(dt);
    const currentElapsed = this._rhythmEngine.elapsedTime;

    // 1. 달리기 1~5박 (0.0s ~ 2.5s)
    if (this._phase === 'RUN_QUESTION') {
      this._isAnswerOpen = false;
      if (this._rhythmEngine.totalBeats >= 5 || currentElapsed >= SECONDS_TO_BEAT_6) {
        // 6박 진입: 중앙 복귀 네온 게이트 오픈
        this._phase = 'CENTER_RETURN';
        this._centerReturnGate.open({ roundIndex: this._rhythmEngine.roundIndex });
        this._options.onPhaseChange?.('CENTER_RETURN');

        // 이번 틱에서 2.5초를 초과하여 경과한 시간이 있다면 게이트에 즉시 전달
        const timeBeforeBeat6 = Math.max(0, SECONDS_TO_BEAT_6 - prevElapsed);
        const dtForGate = Math.max(0, dt - timeBeforeBeat6);
        if (dtForGate > 0) {
          this._centerReturnGate.update(dtForGate, landmarks);
        }
      }
    } else if (this._phase === 'CENTER_RETURN') {
      this._isAnswerOpen = false;
      this._centerReturnGate.update(dt, landmarks);
    }

    // 8박 도달 검증: totalBeats >= 7 (t >= 3.5s)
    if (this._phase === 'CENTER_RETURN') {
      const isAtLeastBeat8 =
        this._rhythmEngine.totalBeats >= 7 ||
        this._centerReturnGate.isLocked ||
        this._centerReturnGate.isTimedOut;

      if (isAtLeastBeat8) {
        // 8박 도달 시 안정 상태이면 잠금 시도
        if (!this._centerReturnGate.isLocked && this._centerReturnGate.isStable) {
          this._centerReturnGate.lock();
        }

        if (this._centerReturnGate.isLocked) {
          // 기준점 정상 잠금 완료 -> answer phase 개방
          this._phase = 'ANSWER_OPEN';
          this._isAnswerOpen = true;
          this._answerZoneSelector.setReference(this._centerReturnGate.reference);
          this._options.onPhaseChange?.('ANSWER_OPEN');
        }
        // 미잠금 시: centerReturnGate의 retry/timeout이 자동 작동하며
        // 오답 처리나 HP 차감 없이 연장 대기함
      }
    }

    // 3. 답안 선택 단계 (ANSWER_OPEN)
    if (this._phase === 'ANSWER_OPEN') {
      this._isAnswerOpen = true;
      if (!this._answerZoneSelector.isConfirmed) {
        const state = this._answerZoneSelector.update(dt, landmarks);
        if (state.isConfirmed) {
          const choiceIndex = state.confirmedZone === 'left' ? 0 : 1;
          this._handleAnswer(choiceIndex);
        }
      }
    }
  }

  /**
   * 스텝 발생 기록
   */
  recordStep(_mode?: LocomotionMode): void {
    this._totalSteps++;
  }

  /**
   * 키보드/터치/클릭 비상 fallback 전이 (웹캠 미사용 환경)
   */
  triggerFallbackAdvance(): void {
    if (this._phase === 'RUN_QUESTION' || this._phase === 'CENTER_RETURN') {
      const ref = this._centerReturnGate.forceFallbackLock();
      this._answerZoneSelector.setReference(ref);
      this._phase = 'ANSWER_OPEN';
      this._isAnswerOpen = true;
      this._options.onPhaseChange?.('ANSWER_OPEN');
    }
  }

  /**
   * 답안 선택 fallback 즉시 확정
   */
  confirmAnswerByFallback(choiceIndex: number): void {
    if (this._phase === 'ANSWER_OPEN') {
      this._answerZoneSelector.selectByFallback(choiceIndex === 0 ? 'left' : 'right');
      this._handleAnswer(choiceIndex);
    }
  }

  /**
   * 정답/오답 판정 처리
   */
  private _handleAnswer(choiceIndex: number): void {
    if (!this._currentQuestion) return;
    const correct = choiceIndex === this._currentQuestion.correctIndex;
    if (correct) {
      this._battle?.onCorrect();
    } else {
      this._battle?.onWrong();
    }
    this._options.onAnswerConfirmed?.(choiceIndex, correct);
  }
}
