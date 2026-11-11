/**
 * BeatTimelineSynchronizer - 8박자 비트 사이클, 카운트다운 타이머, BPM 스케일링 동기화 관리자
 *
 * @see Issue #640 [REFACTOR-SRP-009]
 * @see Issue #180 [BEAT-RUN-001]
 * @see Issue #212 & #230 [BEAT-APPROACH-001]
 * @see Issue #279 [BEAT-DIFFICULTY-001]
 * @see Issue #309 [FEAT-ANSWER-GRACE-001]
 * @see Issue #310 [BEAT-BRANCH-001]
 */

import { DEFAULT_QUESTION_APPROACH_CONFIG } from '../../../config/beat-motion.config.js';

export type AnswerWindowPhase = 'primary' | 'extension' | 'closed';

export interface AnswerTimeSnapshot {
  windowId: number;
  phase: AnswerWindowPhase;
  primaryBeats: number;
  extensionBeats: number;
  maxBeats: number;
  elapsedBeats: number;
  remainingBeats: number;
  inputOpen: boolean;
}

export interface BranchClock {
  bpm: number;
  secondsPerBeat: number;
  startElapsed: number;
  elapsed: number;
  endElapsed: number;
  durationBeats: 8;
}

export interface RunTimingSnapshot {
  runId: number;
  active: boolean;
  paused: boolean;
  elapsedBeats: number;
  exerciseBeats: number;
  requiredExerciseCount: number;
  acceptedExerciseCount: number;
  prepareStartBeat: number | null;
  transitionBeat: number | null;
}

export interface AnswerSnapshotPolicy {
  answerPrimaryBeats: number;
  answerExtensionBeats: number;
  answerMaxBeats: number;
}

export interface AnswerSnapshotParams {
  windowId: number;
  isAnswerSelectPhase: boolean;
  selectedChoiceIndex: number | null;
  isPaused: boolean;
  spb: number;
  policy: AnswerSnapshotPolicy;
}

export interface RunTimingParams {
  runId: number;
  active: boolean;
  paused: boolean;
  spb: number;
  exerciseBeats: number;
  requiredExerciseCount: number;
  acceptedExerciseCount: number;
}

export interface BeatIndexAndBar {
  beatIndex: number;
  barIndex: number;
  beatInBar: number;
  beatProgress: number;
}

export interface CountInUpdateResult {
  completed: boolean;
  remainingDt: number;
}

export interface RunStepResult {
  step: number;
  reachedTarget: boolean;
  remainingDt: number;
}

export interface RestStepResult {
  step: number;
  finished: boolean;
  remainingDt: number;
}

export class BeatTimelineSynchronizer {
  public runElapsed = 0;
  public readyElapsed = 0;
  public performanceElapsed = 0;
  public answerSelectElapsed = 0;
  public answerRestElapsed = 0;
  public isAnswerResting = false;
  public branchElapsed = 0;
  public branchStartElapsed = 0;
  public targetSlotEndElapsed: number | null = null;
  public lastExercisedSlot = -1;
  public completedExerciseBeats = 0;
  public countInElapsed = 0;
  public countInCurrentBeat = 0;

  // ==========================================
  // 정적 시간 & BPM 유틸리티
  // ==========================================

  /**
   * BPM으로부터 1비트 소요 시간(초)을 계산한다.
   * BPM이 0 이하이거나 유효하지 않으면 기본 0.5초(120 BPM)를 반환한다.
   */
  static calculateSecondsPerBeat(bpm: number): number {
    if (!Number.isFinite(bpm) || bpm <= 0) {
      return 0.5;
    }
    return 60 / bpm;
  }

  /**
   * 비트 수를 초 단위 시간으로 변환한다.
   */
  static beatsToSeconds(beats: number, bpm: number): number {
    return beats * BeatTimelineSynchronizer.calculateSecondsPerBeat(bpm);
  }

  /**
   * 초 단위 시간을 비트 수로 변환한다.
   */
  static secondsToBeats(seconds: number, bpm: number): number {
    const spb = BeatTimelineSynchronizer.calculateSecondsPerBeat(bpm);
    return spb > 0 ? seconds / spb : 0;
  }

  /**
   * 박자표(기본 4/4) 기준 해당 비트 인덱스가 첫 박(강박)인지 확인한다.
   */
  static isStrongBeat(beatIndex: number, beatsPerBar = 4): boolean {
    if (beatsPerBar <= 0) {
      return beatIndex === 0;
    }
    return beatIndex % beatsPerBar === 0;
  }

  /**
   * 경과 시간(초)으로부터 현재 비트 인덱스, 마디 번호, 마디 내 비트, 비트 내 진행률을 계산한다.
   */
  static getBeatIndexAndBar(elapsedSeconds: number, bpm: number, beatsPerBar = 4): BeatIndexAndBar {
    const spb = BeatTimelineSynchronizer.calculateSecondsPerBeat(bpm);
    const totalBeatsFloat = Math.max(0, elapsedSeconds) / spb;
    const beatIndex = Math.floor(totalBeatsFloat);
    const beatProgress = totalBeatsFloat - beatIndex;
    const barIndex = beatsPerBar > 0 ? Math.floor(beatIndex / beatsPerBar) : 0;
    const beatInBar = beatsPerBar > 0 ? beatIndex % beatsPerBar : beatIndex;

    return { beatIndex, barIndex, beatInBar, beatProgress };
  }

  /**
   * 8박(또는 지정된 비트) 사이클 진행률(0.0~1.0)을 계산한다.
   */
  static calculateCycleProgress(elapsed: number, totalBeats: number, secondsPerBeat: number): number {
    const duration = totalBeats * secondsPerBeat;
    if (duration <= 0) return 1.0;
    return Math.min(1.0, Math.max(0, elapsed / duration));
  }

  /**
   * 문제 소실점 원근 접근 진행도 (기본 4박 동안 0.0 -> 1.0 선형 진행, Issue #711)
   */
  static calculateQuestionApproachProgress(
    runElapsed: number,
    secondsPerBeat: number,
    approachBeats: number = DEFAULT_QUESTION_APPROACH_CONFIG.approachBeats,
  ): number {
    const spb = secondsPerBeat || 0.5;
    const beats = approachBeats > 0 ? approachBeats : DEFAULT_QUESTION_APPROACH_CONFIG.approachBeats;
    const approachDuration = beats * spb;
    if (approachDuration <= 0) return 1.0;
    const timeProgress = runElapsed / approachDuration;
    if (!Number.isFinite(timeProgress)) return 0;
    return Math.min(1.0, Math.max(0, timeProgress));
  }

  /**
   * 답안 소실점 원근 접근 진행도 (approachStartBeat ~ exerciseBeats 동안 0.0 -> 1.0 quadratic ease-out)
   */
  static calculateAnswerApproachProgress(
    runElapsed: number,
    approachStartBeat: number,
    exerciseBeats: number,
    secondsPerBeat: number,
  ): number {
    const spb = secondsPerBeat || 0.5;
    const startElapsed = approachStartBeat * spb;
    const endElapsed = exerciseBeats * spb;

    if (runElapsed <= startElapsed) {
      return 0.0;
    }
    if (runElapsed >= endElapsed) {
      return 1.0;
    }

    const duration = endElapsed - startElapsed;
    if (duration <= 0) return 1.0;

    const linear = Math.max(0, Math.min(1.0, (runElapsed - startElapsed) / duration));
    return 1 - (1 - linear) * (1 - linear);
  }

  // ==========================================
  // 카운트인 관리
  // ==========================================

  startCountIn(initialBeat = 1): void {
    this.countInElapsed = 0;
    this.countInCurrentBeat = initialBeat;
    this.resetRound();
  }

  getCountInProgress(totalBeats: number, secondsPerBeat: number): number {
    const totalDuration = totalBeats * secondsPerBeat;
    if (totalDuration <= 0) return 1.0;
    return Math.min(1.0, Math.max(0, this.countInElapsed / totalDuration));
  }

  updateCountIn(
    dt: number,
    spb: number,
    totalBeats: number,
    onBeat?: (currentBeat: number, totalBeats: number) => void,
  ): CountInUpdateResult {
    let remainingDt = dt;
    const totalDuration = totalBeats * spb;

    while (remainingDt > 0) {
      if (this.countInCurrentBeat < totalBeats) {
        const nextBeatTime = this.countInCurrentBeat * spb;
        const timeUntilNextBeat = nextBeatTime - this.countInElapsed;
        if (remainingDt >= timeUntilNextBeat - 1e-9) {
          const step = Math.max(0, timeUntilNextBeat);
          this.countInElapsed += step;
          remainingDt -= step;
          this.countInCurrentBeat++;
          onBeat?.(this.countInCurrentBeat, totalBeats);
        } else {
          this.countInElapsed += remainingDt;
          remainingDt = 0;
        }
      } else {
        const timeUntilEnd = totalDuration - this.countInElapsed;
        if (remainingDt >= timeUntilEnd - 1e-9) {
          const step = Math.max(0, timeUntilEnd);
          this.countInElapsed += step;
          remainingDt -= step;
          return { completed: true, remainingDt };
        } else {
          this.countInElapsed += remainingDt;
          remainingDt = 0;
        }
      }
    }

    return { completed: false, remainingDt: 0 };
  }

  // ==========================================
  // 라운드 타이머 관리
  // ==========================================

  resetRound(): void {
    this.runElapsed = 0;
    this.readyElapsed = 0;
    this.performanceElapsed = 0;
    this.answerSelectElapsed = 0;
    this.isAnswerResting = false;
    this.answerRestElapsed = 0;
    this.branchElapsed = 0;
    this.branchStartElapsed = 0;
    this.targetSlotEndElapsed = null;
    this.lastExercisedSlot = -1;
    this.completedExerciseBeats = 0;
  }

  resetRunQuestion(): void {
    this.resetRound();
  }

  stepRun(dt: number): RunStepResult {
    if (this.targetSlotEndElapsed !== null) {
      const timeUntilEnd = this.targetSlotEndElapsed - this.runElapsed;
      if (timeUntilEnd <= dt + 1e-9) {
        const step = Math.max(0, timeUntilEnd);
        this.runElapsed += step;
        const remainingDt = dt - step;
        return { step, reachedTarget: true, remainingDt };
      } else {
        this.runElapsed += dt;
        return { step: dt, reachedTarget: false, remainingDt: 0 };
      }
    } else {
      this.runElapsed += dt;
      return { step: dt, reachedTarget: false, remainingDt: 0 };
    }
  }

  stepAnswerRest(dt: number, restDuration: number): RestStepResult {
    const remainingRest = restDuration - this.answerRestElapsed;
    const step = Math.min(dt, Math.max(0, remainingRest));
    this.answerRestElapsed += step;
    const remainingDt = dt - step;
    const finished = this.answerRestElapsed >= restDuration - 1e-9;
    return { step, finished, remainingDt };
  }

  calculateReadyBeat(readyBeats: number, spb: number): number {
    if (spb <= 0) return readyBeats;
    return Math.min(readyBeats, Math.floor(this.readyElapsed / spb));
  }

  calculatePerformanceBeat(performanceBeats: number, spb: number, isBranch = false): number {
    if (spb <= 0) return performanceBeats;
    if (isBranch) {
      return Math.min(performanceBeats, Math.floor(this.branchElapsed / spb) + 2);
    }
    return Math.min(performanceBeats, Math.floor(this.performanceElapsed / spb) + 1);
  }

  // ==========================================
  // 스냅샷 생성기
  // ==========================================

  createAnswerSnapshot(params: AnswerSnapshotParams): Readonly<AnswerTimeSnapshot> {
    const { windowId, isAnswerSelectPhase, selectedChoiceIndex, isPaused, spb, policy } = params;
    const validSpb = spb || 0.5;
    const elapsedBeats = this.answerSelectElapsed / validSpb;
    const maxBeats = policy.answerMaxBeats;

    const phase: AnswerWindowPhase =
      !isAnswerSelectPhase || selectedChoiceIndex !== null || elapsedBeats >= maxBeats - 1e-9
        ? 'closed'
        : policy.answerExtensionBeats > 0 && elapsedBeats >= policy.answerPrimaryBeats - 1e-9
          ? 'extension'
          : 'primary';

    const remainingBeats = phase === 'closed' ? 0 : Math.max(0, maxBeats - elapsedBeats);

    return {
      windowId,
      phase,
      primaryBeats: policy.answerPrimaryBeats,
      extensionBeats: policy.answerExtensionBeats,
      maxBeats,
      elapsedBeats: phase === 'closed' ? Math.min(elapsedBeats, maxBeats) : elapsedBeats,
      remainingBeats,
      inputOpen: phase !== 'closed' && !isPaused,
    };
  }

  createBranchClock(phase: string, bpm: number, spb: number, durationBeats: number): Readonly<BranchClock> | null {
    if (phase !== 'STAR_COLLECT' && phase !== 'HAZARD_EVADE' && phase !== 'ROUND_RESOLVE') {
      return null;
    }
    return {
      bpm,
      secondsPerBeat: spb,
      startElapsed: this.branchStartElapsed,
      elapsed: this.branchElapsed,
      endElapsed: this.branchStartElapsed + durationBeats * spb,
      durationBeats: durationBeats as 8,
    };
  }

  createRunTimingSnapshot(params: RunTimingParams): RunTimingSnapshot {
    const { runId, active, paused, spb, exerciseBeats, requiredExerciseCount, acceptedExerciseCount } = params;
    const validSpb = spb || 0.5;
    const elapsedBeats = validSpb > 0 ? this.runElapsed / validSpb : 0;

    let prepareStartBeat: number | null = null;
    let transitionBeat: number | null = null;

    if (active && this.targetSlotEndElapsed !== null && validSpb > 0) {
      transitionBeat = this.targetSlotEndElapsed / validSpb;
      const prepareLength = Math.max(0, exerciseBeats - requiredExerciseCount);
      prepareStartBeat = transitionBeat - prepareLength;
    }

    return Object.freeze({
      runId,
      active,
      paused,
      elapsedBeats,
      exerciseBeats,
      requiredExerciseCount,
      acceptedExerciseCount,
      prepareStartBeat,
      transitionBeat,
    });
  }
}
