/**
 * BeatRunCoordinator - 8박 문제 준비 라운드 및 정답존 전환 코디네이터
 *
 * 실제 운동 8회 루프:
 * - RUN_QUESTION (0/8~8/8): 문제 출제, 비블로킹 TTS 낭독, 실제 locomotion 입력마다 1박 기록
 * - ANSWER_SELECT (기본 2박, 미응답 시 같은 창 +2박, 최대 4박): 선택 즉시 8박 분기
 * - STAR_COLLECT (2~8박/3.5s): 정답 시 7개 키노트 순차 진행
 * - HAZARD_EVADE (2~8박/3.5s): 오답/타임아웃 시 바닥 충격파 회피 진행
 * - ROUND_RESOLVE: 분기 루틴 완료 후 단 1회 정산
 *
 * @see Issue #180 [BEAT-RUN-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #210 [BEAT-KEYNOTE-ENGINE-001]
 * @see Issue #224 [INPUT-ARM-ANSWER-001]
 * @see Issue #225 [BATTLE-ANSWER-PENALTY-001]
 * @see Issue #204 [BEAT-TRACK-001]
 */

import { RhythmEngine, type BeatEvent } from '../core/RhythmEngine.js';
import { CenterReturnGate } from '../motion/CenterReturnGate.js';
import { ArmReachAnswerSelector } from '../input/ArmReachAnswerSelector.js';
import { QuestionBank } from '../question/QuestionBank.js';
import { BattleState } from './BattleState.js';
import { generateQuestion, type GeneratedQuestion } from '../question/QuestionEvaluator.js';
import type { NormalizedLandmark } from '../types/index.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import type { RoundAnswerStatus } from '../types/result.js';
import type { Keynote } from '../types/keynote.js';
import type { MusicTrackConfig } from '../types/track.js';
import {
  DEFAULT_TRACK_CONFIG,
  DEFAULT_DIFFICULTY_BEAT_PROFILE,
  getDifficultyBeatProfile,
  type DifficultyBeatProfile,
} from '../../config/beat-motion.config.js';
import { DEFAULT_ARM_DIRECTION_ANSWER_CONFIG } from '../../config/judgment.config.js';
import {
  BeatTimelineSynchronizer,
  type AnswerWindowPhase,
  type AnswerTimeSnapshot,
  type BranchClock,
  type RunTimingSnapshot,
} from './beat/BeatTimelineSynchronizer.js';

export type {
  AnswerWindowPhase,
  AnswerTimeSnapshot,
  BranchClock,
  RunTimingSnapshot,
};

export type BeatRoutineMode = 'arm_reach' | 'legacy';

export type BeatPhase =
  | 'COUNT_IN'
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
  trackConfig?: MusicTrackConfig;
  difficultyProfile?: DifficultyBeatProfile;
  sfx?: { play: (type: 'metronome_strong' | 'metronome_weak' | any) => void | boolean };
  playMetronome?: boolean;
  onQuestionGenerated?: (question: GeneratedQuestion) => void;
  onPhaseChange?: (phase: BeatPhase) => void;
  onAnswerConfirmed?: (choiceIndex: number, correct: boolean, status: RoundAnswerStatus) => void;
  onAnswerSelected?: (choiceIndex: number) => void;
  onCountInBeat?: (currentBeat: number, totalBeats: number) => void;
  onBeat?: (event: BeatEvent) => void;
  onTimeout?: () => void;
  answerRestBeats?: number;
}

export class BeatRunCoordinator {
  private readonly _rhythmEngine: RhythmEngine;
  private readonly _centerReturnGate: CenterReturnGate;
  private readonly _armReachAnswerSelector: ArmReachAnswerSelector;
  private readonly _questionBank: QuestionBank;
  private readonly _options: BeatRunCoordinatorOptions;
  private readonly _routineMode: BeatRoutineMode;
  private readonly _answerRestBeats: number;
  private readonly _timeline: BeatTimelineSynchronizer;
  private _trackConfig: MusicTrackConfig;
  private _difficultyProfile: DifficultyBeatProfile;
  private _playMetronome = true;

  private _phase: BeatPhase = 'RUN_QUESTION';
  private _currentQuestion: GeneratedQuestion | null = null;
  private _questionGeneratedCount = 0;
  private _totalSteps = 0;
  private _isTimedOut = false;
  private _selectedChoiceIndex: number | null = null;
  private _roundResolveCount = 0;
  private _keynotes: readonly Keynote[] = [];

  constructor(options?: BeatRunCoordinatorOptions) {
    this._options = options ?? {};
    this._routineMode = options?.routineMode ?? (options?.armReachAnswerSelector ? 'arm_reach' : 'legacy');
    this._timeline = new BeatTimelineSynchronizer();
    this._trackConfig = options?.trackConfig ?? DEFAULT_TRACK_CONFIG;
    if (options?.difficultyProfile) {
      this._difficultyProfile = { ...options.difficultyProfile };
    } else if (this._trackConfig.loopPattern) {
      this._difficultyProfile = {
        exerciseBeats: this._trackConfig.loopPattern.exerciseBeats,
        approachStartBeat: Math.max(0, this._trackConfig.loopPattern.exerciseBeats - 2),
        answerSelectBeats: this._trackConfig.loopPattern.readyBeats,
        branchRoutineBeats: this._trackConfig.loopPattern.performanceBeats,
      };
    } else {
      this._difficultyProfile = { ...DEFAULT_DIFFICULTY_BEAT_PROFILE };
    }

    this._rhythmEngine = options?.rhythmEngine
      ?? new RhythmEngine({
        trackConfig: this._trackConfig,
        beatsPerRound: this._difficultyProfile.exerciseBeats,
      });
    if (options?.rhythmEngine && options.trackConfig) {
      this._rhythmEngine.setTrackConfig(options.trackConfig);
      this._rhythmEngine.setBeatsPerRound(this._difficultyProfile.exerciseBeats);
    }
    this._answerRestBeats = Math.max(0, options?.answerRestBeats ?? 0);
    this._centerReturnGate = options?.centerReturnGate ?? new CenterReturnGate();
    this._armReachAnswerSelector =
      options?.armReachAnswerSelector ?? new ArmReachAnswerSelector({ isMirrored: false });
    this._questionBank = options?.questionBank ?? new QuestionBank();
    this._keynotes = options?.keynotes ? [...options.keynotes] : [];
    this._playMetronome = options?.playMetronome ?? true;

    this._rhythmEngine.onBeat((event) => {
      this._handleBeat(event);
    });
  }

  get playMetronome(): boolean {
    return this._playMetronome;
  }

  setPlayMetronome(enabled: boolean): void {
    this._playMetronome = enabled;
  }

  /**
   * 해당 비트 인덱스가 4/4 또는 트랙 박자표 기준 강박(첫 박)인지 여부 반환
   * - 기본 4/4 박자: 0 (1박), 4 (5박/2마디 1박) -> true
   * - 그 외: false
   */
  isStrongBeat(beatIndex: number): boolean {
    const beatsPerBar = this._trackConfig.timeSignature?.[0] ?? 4;
    return BeatTimelineSynchronizer.isStrongBeat(beatIndex, beatsPerBar);
  }

  private _handleBeat(event: BeatEvent): void {
    if (this.isPaused) return;

    if (this._options.sfx && this._playMetronome) {
      const isStrong = this.isStrongBeat(event.beatIndex);
      this._options.sfx.play(isStrong ? 'metronome_strong' : 'metronome_weak');
    }

    this._options.onBeat?.(event);
  }

  get routineMode(): BeatRoutineMode {
    return this._routineMode;
  }

  get answerRestBeats(): number {
    return this._answerRestBeats;
  }

  get isAnswerResting(): boolean {
    return this._timeline.isAnswerResting;
  }

  get answerRestElapsed(): number {
    return this._timeline.answerRestElapsed;
  }

  get timeline(): BeatTimelineSynchronizer {
    return this._timeline;
  }

  get phase(): BeatPhase {
    return this._phase;
  }

  get trackConfig(): MusicTrackConfig {
    return this._trackConfig;
  }

  get difficultyProfile(): DifficultyBeatProfile {
    return { ...this._difficultyProfile };
  }

  setDifficultyProfile(profile: DifficultyBeatProfile): void {
    this._difficultyProfile = { ...profile };
    this._rhythmEngine.setBeatsPerRound(this._difficultyProfile.exerciseBeats);
  }

  setTrackConfig(config: MusicTrackConfig): void {
    this._trackConfig = config;
    this._rhythmEngine.setTrackConfig(config);
    if (config.loopPattern) {
      this._difficultyProfile = {
        exerciseBeats: config.loopPattern.exerciseBeats,
        approachStartBeat: Math.max(0, config.loopPattern.exerciseBeats - 2),
        answerSelectBeats: config.loopPattern.readyBeats,
        branchRoutineBeats: config.loopPattern.performanceBeats,
      };
    }
  }

  get exerciseBeats(): number {
    return this._difficultyProfile.exerciseBeats;
  }

  get approachStartBeat(): number {
    return this._difficultyProfile.approachStartBeat;
  }

  get readyBeats(): number {
    return this._difficultyProfile.answerSelectBeats;
  }

  get performanceBeats(): number {
    return this.branchRoutineBeats;
  }

  get branchRoutineBeats(): number {
    return this._difficultyProfile.branchRoutineBeats;
  }

  get countInBeats(): number {
    return this._trackConfig.intro?.countInBeats ?? 3;
  }

  get countInCurrentBeat(): number {
    return this._timeline.countInCurrentBeat;
  }

  get countInElapsed(): number {
    return this._timeline.countInElapsed;
  }

  get countInProgress(): number {
    return this._timeline.getCountInProgress(this.countInBeats, this._rhythmEngine.secondsPerBeat);
  }

  get isAnswerOpen(): boolean {
    if (this._phase === 'ANSWER_SELECT') {
      return (
        !this._timeline.isAnswerResting &&
        this._selectedChoiceIndex === null &&
        this._timeline.answerSelectElapsed < this._answerMaxSeconds() - 1e-9
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

  /** #309 읽기 전용 답안 시간. 매 호출 새 객체. */
  getAnswerSnapshot(): Readonly<AnswerTimeSnapshot> {
    return this._timeline.createAnswerSnapshot({
      windowId: this._questionGeneratedCount,
      isAnswerSelectPhase: this._phase === 'ANSWER_SELECT',
      selectedChoiceIndex: this._selectedChoiceIndex,
      isPaused: this.isPaused,
      spb: this._rhythmEngine.secondsPerBeat,
      policy: DEFAULT_ARM_DIRECTION_ANSWER_CONFIG,
    });
  }

  /** #310용 읽기 전용 분기 시계. 분기 시작 전 null. */
  getBranchClock(): Readonly<BranchClock> | null {
    return this._timeline.createBranchClock(
      this._phase,
      this._rhythmEngine.bpm,
      this._rhythmEngine.secondsPerBeat,
      this.branchRoutineBeats,
    );
  }

  /**
   * 러닝 실제 예약 시점 기반 읽기 전용 타이밍 스냅샷 반환
   * @see Issue #370 [RUN-MAT-001]
   */
  getRunTimingSnapshot(): RunTimingSnapshot {
    return this._timeline.createRunTimingSnapshot({
      runId: this._questionGeneratedCount,
      active: Boolean(this._rhythmEngine.running && this._phase === 'RUN_QUESTION'),
      paused: this.isPaused,
      spb: this._rhythmEngine.secondsPerBeat,
      exerciseBeats: this.exerciseBeats,
      requiredExerciseCount: this.approachStartBeat,
      acceptedExerciseCount: this._timeline.completedExerciseBeats,
    });
  }

  /** 한 비트당 소요 시간 (초) */
  get secondsPerBeat(): number {
    return this._rhythmEngine.secondsPerBeat;
  }

  /** 실행 중 여부 */
  get isRunning(): boolean {
    return this._rhythmEngine.running;
  }

  private _answerMaxSeconds(): number {
    return DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerMaxBeats * this._rhythmEngine.secondsPerBeat;
  }

  get isTimedOut(): boolean {
    return this._isTimedOut;
  }

  get keynotes(): readonly Keynote[] {
    return this._keynotes;
  }

  setKeynotes(keynotes: readonly Keynote[]): void {
    this._keynotes = [...keynotes];
  }

  /** 일시정지 (시간 진행 및 박자 일시 정지) */
  pause(): void {
    this._rhythmEngine.pause();
  }

  /** 일시정지 해제 */
  resume(): void {
    this._rhythmEngine.resume();
  }

  /** 일시정지 여부 */
  get isPaused(): boolean {
    return this._rhythmEngine.paused;
  }

  get totalSteps(): number {
    return this._totalSteps;
  }

  /** 현재 라운드에서 실제 운동으로 완료한 비트 수 (0~8) */
  get completedExerciseBeats(): number {
    return this._timeline.completedExerciseBeats;
  }

  /** REST_READY 내 완료된 준비 박 수 (0~readyBeats) */
  get readyBeat(): number {
    return this._timeline.calculateReadyBeat(this.readyBeats, this._rhythmEngine.secondsPerBeat);
  }

  /** KEYNOTE_PERFORMANCE 또는 분기 루틴 내 현재 박 (1~performanceBeats, 비활성 시 0) */
  get performanceBeat(): number {
    const isBranch = this._phase === 'STAR_COLLECT' || this._phase === 'HAZARD_EVADE';
    return this._timeline.calculatePerformanceBeat(
      this.performanceBeats,
      this._rhythmEngine.secondsPerBeat,
      isBranch,
    );
  }

  /** ROUND_RESOLVE가 실행된 횟수 (라운드당 정확히 1회) */
  get roundResolveCount(): number {
    return this._roundResolveCount;
  }

  /**
   * 문제 소실점 원근 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 도달)
   * Issue #212 & #230: RUN_QUESTION 첫 2박(1.0s) 동안 0에서 1로 진행, 완료 후 1.0 유지
   * - 실제 활성 경과 시간(_runElapsed) 기반으로 진행 (빠른 운동으로 조기 완료 불가)
   * - 일시정지(pause) 시간 제외
   */
  get questionApproachProgress(): number {
    if (this._phase === 'COUNT_IN') {
      return 0.0;
    }
    if (this._phase !== 'RUN_QUESTION') {
      return 1.0;
    }
    return BeatTimelineSynchronizer.calculateQuestionApproachProgress(
      this._timeline.runElapsed,
      this._rhythmEngine.secondsPerBeat,
    );
  }

  /**
   * 답안 소실점 원근 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 도달)
   * Issue #279 [BEAT-DIFFICULTY-001]:
   * - COUNT_IN 중에는 0.0
   * - RUN_QUESTION 중 경과 박자 < approachStartBeat 이면 0.0
   * - approachStartBeat 부터 exerciseBeats 까지 0.0 -> 1.0 ease-out quadratic 보간
   * - ANSWER_SELECT 및 이후 페이즈에서는 1.0 유지
   */
  get answerApproachProgress(): number {
    if (this._phase === 'COUNT_IN') {
      return 0.0;
    }
    if (this._phase !== 'RUN_QUESTION') {
      return 1.0;
    }
    return BeatTimelineSynchronizer.calculateAnswerApproachProgress(
      this._timeline.runElapsed,
      this.approachStartBeat,
      this.exerciseBeats,
      this._rhythmEngine.secondsPerBeat,
    );
  }

  /**
   * 새 라운드 시작 (달리기 1박부터 시작 또는 카운트인 예비박 동반)
   * @param options.withCountIn true 시 트랙 BPM에 동기화된 예비박(Count-in) 시동 후 1라운드 전이
   * @param options.difficultyProfile 라운드 전용 난이도 박자 프로필 (지정 시 적용)
   */
  startRound(options?: {
    chapter?: number;
    subLevel?: number;
    withCountIn?: boolean;
    difficultyProfile?: DifficultyBeatProfile;
  }): void {
    this._isTimedOut = false;
    if (options?.difficultyProfile) {
      this.setDifficultyProfile(options.difficultyProfile);
    } else if (options?.chapter !== undefined) {
      this.setDifficultyProfile(getDifficultyBeatProfile(options.chapter, options.subLevel));
    }

    if (options?.chapter !== undefined) {
      this._questionBank.setLevel(options.chapter, options.subLevel);
    }

    if (options?.withCountIn) {
      this.startCountIn(options);
      return;
    }

    this._startRunQuestion();
  }

  /**
   * 트랙 BPM에 동기화된 예비박(Count-in 3박자 메트로놈) 시동
   */
  startCountIn(options?: {
    chapter?: number;
    subLevel?: number;
    difficultyProfile?: DifficultyBeatProfile;
  }): void {
    this._isTimedOut = false;
    if (options?.difficultyProfile) {
      this.setDifficultyProfile(options.difficultyProfile);
    } else if (options?.chapter !== undefined) {
      this.setDifficultyProfile(getDifficultyBeatProfile(options.chapter, options.subLevel));
    }

    if (options?.chapter !== undefined) {
      this._questionBank.setLevel(options.chapter, options.subLevel);
    }

    const totalBeats = this.countInBeats;
    if (totalBeats <= 0) {
      this._startRunQuestion();
      return;
    }

    this._rhythmEngine.reset();
    this._rhythmEngine.start({ emitFirstBeat: false });
    this._phase = 'COUNT_IN';
    this._timeline.startCountIn(1);
    this._selectedChoiceIndex = null;
    this._roundResolveCount = 0;

    this._options.onPhaseChange?.(this._phase);
    this._options.onCountInBeat?.(1, totalBeats);
    if (this._options.sfx && this._playMetronome && !this.isPaused) {
      this._options.sfx.play('metronome_strong');
    }
  }

  private _startRunQuestion(): void {
    this._isTimedOut = false;
    this._rhythmEngine.reset();
    this._rhythmEngine.start();
    this._phase = 'RUN_QUESTION';
    this._timeline.resetRunQuestion();
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
    if (!this._rhythmEngine.running || this._rhythmEngine.paused) return;

    const validDt = Math.max(0, dt);
    let remainingDt = validDt;

    // COUNT_IN 페이즈 처리
    if (this._phase === 'COUNT_IN') {
      const spb = this._rhythmEngine.secondsPerBeat;
      const totalBeats = this.countInBeats;

      const res = this._timeline.updateCountIn(remainingDt, spb, totalBeats, (currentBeat, total) => {
        this._options.onCountInBeat?.(currentBeat, total);
        if (this._options.sfx && this._playMetronome && !this.isPaused) {
          const isStrong = currentBeat === 1;
          this._options.sfx.play(isStrong ? 'metronome_strong' : 'metronome_weak');
        }
      });

      remainingDt = res.remainingDt;
      if (res.completed) {
        this._startRunQuestion();
      }

      if (this._phase === 'COUNT_IN') {
        return;
      }
    }

    this._rhythmEngine.update(remainingDt);

    // 0. RUN_QUESTION 페이즈 처리
    if (this._phase === 'RUN_QUESTION') {
      const res = this._timeline.stepRun(remainingDt);
      remainingDt = res.remainingDt;
      if (res.reachedTarget) {
        this._transitionFromRunQuestion();
      }
    }

    if (this._routineMode === 'arm_reach') {
      // 1. ANSWER_SELECT 페이즈 처리
      if (this._phase === 'ANSWER_SELECT') {
        if (this._timeline.isAnswerResting) {
          if (this.isPaused) {
            return;
          }
          const restDuration = this._answerRestBeats * this._rhythmEngine.secondsPerBeat;
          const res = this._timeline.stepAnswerRest(remainingDt, restDuration);
          remainingDt = res.remainingDt;

          if (res.finished) {
            this._timeline.isAnswerResting = false;
            const correct =
              this._selectedChoiceIndex !== null &&
              this._selectedChoiceIndex === this._currentQuestion?.correctIndex;
            this._phase = correct ? 'STAR_COLLECT' : 'HAZARD_EVADE';
            this._timeline.branchStartElapsed = this._timeline.answerSelectElapsed + this._timeline.answerRestElapsed;
            this._timeline.branchElapsed = 0;
            this._options.onPhaseChange?.(this._phase);
          }
        } else {
          // #309: primary 2 + 미응답 연장 1회(총 4). readyBeats(4)와 구 max-2는 창 길이가 아니다.
          const maxAnswerTime = this._answerMaxSeconds();
          const samplePastDeadline = this._timeline.answerSelectElapsed + remainingDt > maxAnswerTime + 1e-9;
          const windowAcceptsInput =
            this._selectedChoiceIndex === null &&
            this._timeline.answerSelectElapsed <= maxAnswerTime + 1e-9 &&
            !this.isPaused;

          if (windowAcceptsInput) {
            const consume = (choiceIndex: number | null): boolean => {
              if (choiceIndex === null) return false;
              this._handleAnswer(choiceIndex);
              return true;
            };
            if (this._armReachAnswerSelector.isConfirmed) {
              if (consume(this._armReachAnswerSelector.confirmedChoiceIndex)) return;
            } else if (!samplePastDeadline && remainingDt > 0) {
              this._armReachAnswerSelector.updateDelta(remainingDt, landmarks);
              if (consume(this._armReachAnswerSelector.confirmedChoiceIndex)) return;
            }
          }

          if (this.isPaused) {
            return;
          }

          const remainingAnswerTime = maxAnswerTime - this._timeline.answerSelectElapsed;
          const step = Math.min(remainingDt, Math.max(0, remainingAnswerTime));
          this._timeline.answerSelectElapsed += step;
          remainingDt -= step;

          if (this._timeline.answerSelectElapsed >= maxAnswerTime - 1e-9 && this._selectedChoiceIndex === null) {
            this._isTimedOut = true;
            this._options.onTimeout?.();
            this._armReachAnswerSelector.closeWindow();
            this._selectedChoiceIndex = null;
            if (this._answerRestBeats > 0) {
              this._timeline.isAnswerResting = true;
              this._timeline.answerRestElapsed = 0;
            } else {
              this._phase = 'HAZARD_EVADE';
              this._timeline.branchElapsed = 0;
              this._timeline.branchStartElapsed = this._timeline.answerSelectElapsed;
              this._options.onPhaseChange?.(this._phase);
            }
          }
        }
      }

      // 2. 분기 루틴 처리 (STAR_COLLECT 또는 HAZARD_EVADE)
      if (this._phase === 'STAR_COLLECT' || this._phase === 'HAZARD_EVADE') {
        const branchMaxTime = this.performanceBeats * this._rhythmEngine.secondsPerBeat;
        const remainingBranch = branchMaxTime - this._timeline.branchElapsed;
        const step = Math.min(remainingDt, remainingBranch);
        this._timeline.branchElapsed += step;
        remainingDt -= step;

        if (this._timeline.branchElapsed >= branchMaxTime - 1e-9) {
          this._resolveRound();
        }
      }
      return;
    }

    // ─── LEGACY ROUTINE (하위 호환 전용 시간 진행 루틴) ───
    while (remainingDt > 0 && this._phase !== 'RUN_QUESTION' && this._phase !== 'ROUND_RESOLVE') {
      if (this._phase === 'REST_READY') {
        const remainingReady = this.readyBeats * this._rhythmEngine.secondsPerBeat - this._timeline.readyElapsed;
        const stepDt = Math.min(remainingDt, remainingReady);
        this._timeline.readyElapsed += stepDt;
        this._centerReturnGate.update(stepDt, landmarks);
        remainingDt -= stepDt;

        if (this._timeline.readyElapsed >= this.readyBeats * this._rhythmEngine.secondsPerBeat - 1e-9) {
          if (!this._centerReturnGate.isLocked) this._centerReturnGate.forceFallbackLock();
          this._phase = 'KEYNOTE_PERFORMANCE';
          this._options.onPhaseChange?.(this._phase);
        }
      } else if (this._phase === 'KEYNOTE_PERFORMANCE') {
        const remainingPerformance = this.performanceBeats * this._rhythmEngine.secondsPerBeat - this._timeline.performanceElapsed;
        const stepDt = Math.min(remainingDt, remainingPerformance);
        this._timeline.performanceElapsed += stepDt;
        remainingDt -= stepDt;

        if (this._timeline.performanceElapsed >= this.performanceBeats * this._rhythmEngine.secondsPerBeat - 1e-9) {
          this._resolveRound();
        }
      }
    }
  }

  /**
   * 8개 유효 운동 슬롯 완료 후 다음 페이즈로 전이
   */
  private _transitionFromRunQuestion(): void {
    if (this._routineMode === 'arm_reach') {
      this._phase = 'ANSWER_SELECT';
      this._timeline.answerSelectElapsed = 0;
      this._timeline.isAnswerResting = false;
      this._timeline.answerRestElapsed = 0;
      this._timeline.branchElapsed = 0;
      this._timeline.branchStartElapsed = 0;
      this._timeline.targetSlotEndElapsed = null;
      this._armReachAnswerSelector.openWindow();
      this._options.onPhaseChange?.(this._phase);
    } else {
      this._phase = 'REST_READY';
      this._timeline.readyElapsed = 0;
      this._timeline.targetSlotEndElapsed = null;
      this._centerReturnGate.open({ roundIndex: this._rhythmEngine.roundIndex });
      this._options.onPhaseChange?.(this._phase);
    }
  }

  /**
   * 스텝 발생 기록
   *
   * Issue #230 [BUG-BEAT-CLOCK-001]:
   * - 실제 활성 게임 시계 기반 비트 슬롯 진행
   * - 한 슬롯당 유효 운동 최대 1회 인정, 동일 슬롯 중복 입력 불인정
   * - totalSteps(원시 입력 누적)와 completedExerciseBeats(유효 슬롯 박자) 분리
   * - 8번째 유효 운동 인정 후 즉시 전환하지 않고, 8번째 슬롯의 종료 경계에서 전환
   */
  recordStep(_mode?: LocomotionMode): void {
    if (!this._rhythmEngine.running || this._rhythmEngine.paused) {
      return;
    }

    this._totalSteps++;

    if (this._phase !== 'RUN_QUESTION' || this._timeline.completedExerciseBeats >= this.exerciseBeats) {
      return;
    }

    const spb = this._rhythmEngine.secondsPerBeat || 0.5;
    const currentSlot = Math.floor(this._timeline.runElapsed / spb);

    if (this._timeline.lastExercisedSlot === currentSlot) {
      // 동일 슬롯 중복 입력 차단 (totalSteps만 증가하고 유효 박수는 유지)
      return;
    }

    this._timeline.lastExercisedSlot = currentSlot;
    this._timeline.completedExerciseBeats++;

    // Issue #279 [BEAT-DIFFICULTY-001 / 사전 위험 1번 해결]:
    // N박 중 N-2박(approachStartBeat) 필수 운동 스텝 완료 인정
    // 마지막 2박은 선택 준비 구간으로 전환 목표 시점(exerciseBeats 슬롯 경계) 설정
    if (this._timeline.completedExerciseBeats >= this.approachStartBeat && this._timeline.targetSlotEndElapsed === null) {
      const remainingBeats = Math.max(0, this.exerciseBeats - this._timeline.completedExerciseBeats);
      this._timeline.targetSlotEndElapsed = (currentSlot + 1 + remainingBeats) * spb;
    }
  }

  /**
   * 키보드/터치/클릭 비상 fallback 전이 (웹캠 미사용 환경)
   * Issue #230: while 루프 우회 차단. 단일 recordStep 호출로 슬롯 규칙 준수
   */
  triggerFallbackAdvance(): void {
    if (this._phase === 'COUNT_IN') {
      this._startRunQuestion();
      return;
    }
    if (this._phase === 'RUN_QUESTION') {
      this.recordStep();
      return;
    }
    if (this._phase === 'ANSWER_SELECT') {
      this._isTimedOut = true;
      this._options.onTimeout?.();
      this._armReachAnswerSelector.closeWindow();
      this._selectedChoiceIndex = null;
      this._phase = 'HAZARD_EVADE';
      this._timeline.branchElapsed = 0;
      this._options.onPhaseChange?.(this._phase);
      return;
    }
    if (this._phase === 'REST_READY') {
      this._centerReturnGate.forceFallbackLock();
      this._timeline.readyElapsed = this.readyBeats * this._rhythmEngine.secondsPerBeat;
      this._phase = 'KEYNOTE_PERFORMANCE';
      this._options.onPhaseChange?.(this._phase);
    }
  }

  /**
   * 답안 선택 fallback 즉시 확정
   */
  confirmAnswerByFallback(choiceIndex: number): void {
    if (this.isPaused || this._rhythmEngine.paused) return;
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
    this._isTimedOut = false;
    this._selectedChoiceIndex = choiceIndex;
    this._armReachAnswerSelector.closeWindow();
    this._options.onAnswerSelected?.(choiceIndex);

    if (this._routineMode === 'arm_reach') {
      if (this._answerRestBeats > 0) {
        this._timeline.isAnswerResting = true;
        this._timeline.answerRestElapsed = 0;
        return;
      }
      const correct = choiceIndex === this._currentQuestion.correctIndex;
      this._phase = correct ? 'STAR_COLLECT' : 'HAZARD_EVADE';
      this._timeline.branchStartElapsed = this._timeline.answerSelectElapsed;
      this._timeline.branchElapsed = 0;
      this._options.onPhaseChange?.(this._phase);
      return;
    }

    // legacy
    if (this.performanceBeat === 1) {
      this._phase = 'KEYNOTE_PERFORMANCE';
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
