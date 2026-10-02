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
 * @see Issue #204 [BEAT-TRACK-001]
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
import type { MusicTrackConfig } from '../types/track.js';
import {
  DEFAULT_TRACK_CONFIG,
  DEFAULT_DIFFICULTY_BEAT_PROFILE,
  getDifficultyBeatProfile,
  type DifficultyBeatProfile,
} from '../../config/beat-motion.config.js';

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
  onQuestionGenerated?: (question: GeneratedQuestion) => void;
  onPhaseChange?: (phase: BeatPhase) => void;
  onAnswerConfirmed?: (choiceIndex: number, correct: boolean, status: RoundAnswerStatus) => void;
  onAnswerSelected?: (choiceIndex: number) => void;
  onCountInBeat?: (currentBeat: number, totalBeats: number) => void;
  onTimeout?: () => void;
}

export class BeatRunCoordinator {
  private readonly _rhythmEngine: RhythmEngine;
  private readonly _centerReturnGate: CenterReturnGate;
  private readonly _armReachAnswerSelector: ArmReachAnswerSelector;
  private readonly _questionBank: QuestionBank;
  private readonly _options: BeatRunCoordinatorOptions;
  private readonly _routineMode: BeatRoutineMode;
  private _trackConfig: MusicTrackConfig;
  private _difficultyProfile: DifficultyBeatProfile;

  private _phase: BeatPhase = 'RUN_QUESTION';
  private _currentQuestion: GeneratedQuestion | null = null;
  private _questionGeneratedCount = 0;
  private _totalSteps = 0;
  private _completedExerciseBeats = 0;
  private _lastExercisedSlot = -1;
  private _targetSlotEndElapsed: number | null = null;
  private _runElapsed = 0;
  private _readyElapsed = 0;
  private _performanceElapsed = 0;
  private _answerSelectElapsed = 0;
  private _branchElapsed = 0;
  private _isTimedOut = false;
  private _countInElapsed = 0;
  private _countInCurrentBeat = 0;
  private _selectedChoiceIndex: number | null = null;
  private _roundResolveCount = 0;
  private _keynotes: readonly Keynote[] = [];

  constructor(options?: BeatRunCoordinatorOptions) {
    this._options = options ?? {};
    this._routineMode = options?.routineMode ?? (options?.armReachAnswerSelector ? 'arm_reach' : 'legacy');
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

    if (options?.rhythmEngine) {
      this._rhythmEngine = options.rhythmEngine;
      if (options.trackConfig) {
        this._rhythmEngine.setTrackConfig(options.trackConfig);
      }
      this._rhythmEngine.setBeatsPerRound(this._difficultyProfile.exerciseBeats);
    } else {
      this._rhythmEngine = new RhythmEngine({
        trackConfig: this._trackConfig,
        beatsPerRound: this._difficultyProfile.exerciseBeats,
      });
    }
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
    return this._difficultyProfile.branchRoutineBeats;
  }

  get countInBeats(): number {
    return this._trackConfig.intro?.countInBeats ?? 3;
  }

  get countInCurrentBeat(): number {
    return this._countInCurrentBeat;
  }

  get countInElapsed(): number {
    return this._countInElapsed;
  }

  get countInProgress(): number {
    const totalBeats = this.countInBeats;
    if (totalBeats <= 0) return 1.0;
    const totalDuration = totalBeats * this._rhythmEngine.secondsPerBeat;
    if (totalDuration <= 0) return 1.0;
    return Math.min(1.0, Math.max(0, this._countInElapsed / totalDuration));
  }

  get isAnswerOpen(): boolean {
    if (this._phase === 'ANSWER_SELECT') {
      return (
        this._selectedChoiceIndex === null &&
        this._answerSelectElapsed < this.readyBeats * this._rhythmEngine.secondsPerBeat
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
    return this._completedExerciseBeats;
  }

  /** REST_READY 내 완료된 준비 박 수 (0~readyBeats) */
  get readyBeat(): number {
    return Math.min(this.readyBeats, Math.floor(this._readyElapsed / this._rhythmEngine.secondsPerBeat));
  }

  /** KEYNOTE_PERFORMANCE 또는 분기 루틴 내 현재 박 (1~performanceBeats, 비활성 시 0) */
  get performanceBeat(): number {
    if (this._phase === 'KEYNOTE_PERFORMANCE') {
      return Math.min(this.performanceBeats, Math.floor(this._performanceElapsed / this._rhythmEngine.secondsPerBeat) + 1);
    }
    if (this._phase === 'STAR_COLLECT' || this._phase === 'HAZARD_EVADE') {
      return Math.min(this.performanceBeats, Math.floor(this._branchElapsed / this._rhythmEngine.secondsPerBeat) + 2);
    }
    return 0;
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
    const spb = this._rhythmEngine.secondsPerBeat || 0.5;
    const approachDuration = 2 * spb;
    if (approachDuration <= 0) return 1.0;
    const timeProgress = this._runElapsed / approachDuration;
    if (!Number.isFinite(timeProgress)) return 0;
    return Math.min(1.0, Math.max(0, timeProgress));
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
    const spb = this._rhythmEngine.secondsPerBeat || 0.5;
    const startElapsed = this.approachStartBeat * spb;
    const endElapsed = this.exerciseBeats * spb;
    if (this._runElapsed <= startElapsed) {
      return 0.0;
    }
    if (this._runElapsed >= endElapsed) {
      return 1.0;
    }
    const duration = endElapsed - startElapsed;
    if (duration <= 0) return 1.0;
    const linear = Math.max(0, Math.min(1.0, (this._runElapsed - startElapsed) / duration));
    return 1.0 - Math.pow(1.0 - linear, 2);
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
    this._countInElapsed = 0;
    this._countInCurrentBeat = 1;
    this._completedExerciseBeats = 0;
    this._lastExercisedSlot = -1;
    this._targetSlotEndElapsed = null;
    this._runElapsed = 0;
    this._readyElapsed = 0;
    this._performanceElapsed = 0;
    this._answerSelectElapsed = 0;
    this._branchElapsed = 0;
    this._selectedChoiceIndex = null;
    this._roundResolveCount = 0;

    this._options.onPhaseChange?.(this._phase);
    this._options.onCountInBeat?.(1, totalBeats);
  }

  private _startRunQuestion(): void {
    this._isTimedOut = false;
    this._rhythmEngine.reset();
    this._rhythmEngine.start();
    this._phase = 'RUN_QUESTION';
    this._completedExerciseBeats = 0;
    this._lastExercisedSlot = -1;
    this._targetSlotEndElapsed = null;
    this._runElapsed = 0;
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
    if (!this._rhythmEngine.running || this._rhythmEngine.paused) return;

    const validDt = Math.max(0, dt);
    let remainingDt = validDt;

    // COUNT_IN 페이즈 처리
    if (this._phase === 'COUNT_IN') {
      const spb = this._rhythmEngine.secondsPerBeat;
      const totalBeats = this.countInBeats;
      const totalDuration = totalBeats * spb;

      while (this._phase === 'COUNT_IN' && remainingDt > 0) {
        if (this._countInCurrentBeat < totalBeats) {
          const nextBeatTime = this._countInCurrentBeat * spb;
          const timeUntilNextBeat = nextBeatTime - this._countInElapsed;
          if (remainingDt >= timeUntilNextBeat - 1e-9) {
            const step = Math.max(0, timeUntilNextBeat);
            this._countInElapsed += step;
            remainingDt -= step;
            this._countInCurrentBeat++;
            this._options.onCountInBeat?.(this._countInCurrentBeat, totalBeats);
          } else {
            this._countInElapsed += remainingDt;
            remainingDt = 0;
          }
        } else {
          const timeUntilEnd = totalDuration - this._countInElapsed;
          if (remainingDt >= timeUntilEnd - 1e-9) {
            const step = Math.max(0, timeUntilEnd);
            this._countInElapsed += step;
            remainingDt -= step;
            this._startRunQuestion();
          } else {
            this._countInElapsed += remainingDt;
            remainingDt = 0;
          }
        }
      }

      if (this._phase === 'COUNT_IN') {
        return;
      }
    }

    this._rhythmEngine.update(remainingDt);

    // 0. RUN_QUESTION 페이즈 처리
    if (this._phase === 'RUN_QUESTION') {
      if (this._targetSlotEndElapsed !== null) {
        const timeUntilEnd = this._targetSlotEndElapsed - this._runElapsed;
        if (timeUntilEnd <= remainingDt + 1e-9) {
          const step = Math.max(0, timeUntilEnd);
          this._runElapsed += step;
          remainingDt -= step;
          this._transitionFromRunQuestion();
        } else {
          this._runElapsed += remainingDt;
          remainingDt = 0;
        }
      } else {
        this._runElapsed += remainingDt;
        remainingDt = 0;
      }
    }

    if (this._routineMode === 'arm_reach') {
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

        const maxAnswerTime = this.readyBeats * this._rhythmEngine.secondsPerBeat;
        const remainingAnswerTime = maxAnswerTime - this._answerSelectElapsed;
        const step = Math.min(remainingDt, remainingAnswerTime);
        this._answerSelectElapsed += step;
        remainingDt -= step;

        if (this._answerSelectElapsed >= maxAnswerTime - 1e-9 && this._selectedChoiceIndex === null) {
          // 4박 타임아웃 만료 -> HAZARD_EVADE 즉시 전이 (Issue #283)
          this._isTimedOut = true;
          this._options.onTimeout?.();
          this._armReachAnswerSelector.closeWindow();
          this._selectedChoiceIndex = null;
          this._phase = 'HAZARD_EVADE';
          this._branchElapsed = 0;
          this._options.onPhaseChange?.(this._phase);
        }
      }

      // 2. 분기 루틴 처리 (STAR_COLLECT 또는 HAZARD_EVADE)
      if (this._phase === 'STAR_COLLECT' || this._phase === 'HAZARD_EVADE') {
        const branchMaxTime = this.performanceBeats * this._rhythmEngine.secondsPerBeat;
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
    while (remainingDt > 0 && this._phase !== 'RUN_QUESTION' && this._phase !== 'ROUND_RESOLVE') {
      if (this._phase === 'REST_READY') {
        const remainingReady = this.readyBeats * this._rhythmEngine.secondsPerBeat - this._readyElapsed;
        const stepDt = Math.min(remainingDt, remainingReady);
        this._readyElapsed += stepDt;
        this._centerReturnGate.update(stepDt, landmarks);
        remainingDt -= stepDt;

        if (this._readyElapsed >= this.readyBeats * this._rhythmEngine.secondsPerBeat - 1e-9) {
          if (!this._centerReturnGate.isLocked) this._centerReturnGate.forceFallbackLock();
          this._phase = 'KEYNOTE_PERFORMANCE';
          this._options.onPhaseChange?.(this._phase);
        }
      } else if (this._phase === 'KEYNOTE_PERFORMANCE') {
        const remainingPerformance = this.performanceBeats * this._rhythmEngine.secondsPerBeat - this._performanceElapsed;
        const stepDt = Math.min(remainingDt, remainingPerformance);
        this._performanceElapsed += stepDt;
        remainingDt -= stepDt;

        if (this._performanceElapsed >= this.performanceBeats * this._rhythmEngine.secondsPerBeat - 1e-9) {
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

    if (this._phase !== 'RUN_QUESTION' || this._completedExerciseBeats >= this.exerciseBeats) {
      return;
    }

    const spb = this._rhythmEngine.secondsPerBeat || 0.5;
    const currentSlot = Math.floor(this._runElapsed / spb);

    if (this._lastExercisedSlot === currentSlot) {
      // 동일 슬롯 중복 입력 차단 (totalSteps만 증가하고 유효 박수는 유지)
      return;
    }

    this._lastExercisedSlot = currentSlot;
    this._completedExerciseBeats++;

    // Issue #279 [BEAT-DIFFICULTY-001 / 사전 위험 1번 해결]:
    // N박 중 N-2박(approachStartBeat) 필수 운동 스텝 완료 인정
    // 마지막 2박은 선택 준비 구간으로 전환 목표 시점(exerciseBeats 슬롯 경계) 설정
    if (this._completedExerciseBeats >= this.approachStartBeat && this._targetSlotEndElapsed === null) {
      const remainingBeats = Math.max(0, this.exerciseBeats - this._completedExerciseBeats);
      this._targetSlotEndElapsed = (currentSlot + 1 + remainingBeats) * spb;
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
      this._branchElapsed = 0;
      this._options.onPhaseChange?.(this._phase);
      return;
    }
    if (this._phase === 'REST_READY') {
      this._centerReturnGate.forceFallbackLock();
      this._readyElapsed = this.readyBeats * this._rhythmEngine.secondsPerBeat;
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
    this._isTimedOut = false;
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
