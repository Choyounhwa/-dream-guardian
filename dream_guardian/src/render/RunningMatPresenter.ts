/**
 * RunningMatPresenter.ts - 러닝 매트 제안 패턴 순수 표시 모델 (Presentation Mapper)
 *
 * DOM 및 Canvas 2D 컨텍스트에 직접 접근하지 않는 순수 프레젠테이션 모델.
 * 읽기 전용 RunTimingSnapshot과 LocomotionMode를 기반으로 뷰모델을 즉시 계산합니다.
 *
 * @see Issue #371 [RUN-MAT-002]
 * @see Issue #370 [RUN-MAT-001]
 */

import type { RunTimingSnapshot } from '../game/BeatRunCoordinator.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import {
  type MatArrowDirection,
  type MatFootSlot,
  type MatCue,
  type RunningMatPattern,
  getRunningMatPattern,
} from '../data/runningMatPatterns.js';
import { DEFAULT_RETURN_PHASE_RATIO } from '../../config/running-mat.config.js';

export type { MatArrowDirection, MatFootSlot, MatCue };
export type CuePhase = 'lift' | 'return' | 'hold';

export interface UpcomingCueViewModel {
  readonly cue: MatCue;
  readonly targetBeat: number;
  readonly remainingBeats: number;
  readonly progress: number;
  readonly phase: CuePhase;
  readonly isReturnPhase?: boolean;
}

export interface MatCueViewModel {
  readonly beatIndex: number;
  readonly actionId: string;
  readonly actionText: string;
  readonly directionText: string;
  readonly cueText: string;
  readonly arrowDirection: MatArrowDirection;
  readonly leftFootSlot: MatFootSlot;
  readonly rightFootSlot: MatFootSlot;
  readonly isPrepare: boolean;
  readonly isReturnPhase?: boolean;
  readonly phase?: CuePhase;
}

export interface RunningMatViewModel {
  readonly visible: boolean;
  readonly paused: boolean;
  readonly currentCue: MatCueViewModel | null;
  readonly nextCue: MatCueViewModel | null;
  readonly upcomingCues: readonly UpcomingCueViewModel[];
  readonly actionText: string;
  readonly directionText: string;
  readonly cueText: string;
  readonly arrowDirection: MatArrowDirection;
  readonly nextRingRatio: number;
  readonly elapsedBeats: number;
  readonly acceptedExerciseCount: number;
  readonly requiredExerciseCount: number;
  readonly isShortage: boolean;
  readonly isPreparing: boolean;
  readonly isReturnPhase?: boolean;
  readonly phase?: CuePhase;
}

/**
 * 다음 박까지 남은 비율 (1.0 -> 0.0 단조 감소, 정수 박 경계에서 1.0 리셋)
 */
function computeNextRingRatio(elapsedBeats: number): number {
  if (elapsedBeats < 0) return 1.0;
  const fraction = elapsedBeats - Math.floor(elapsedBeats);
  const ratio = 1.0 - fraction;
  return Math.max(0, Math.min(1, Math.round(ratio * 10000) / 10000));
}

/**
 * 특정 정수 박 인덱스에 해당하는 순수 MatCue 해석
 */
function resolveRawCueForBeat(
  beatIndex: number,
  pattern: RunningMatPattern,
  prepareStartBeat: number | null,
  transitionBeat: number | null
): MatCue | null {
  if (beatIndex < 0) return null;
  if (transitionBeat !== null && beatIndex >= transitionBeat) {
    return null;
  }

  // 1. 준비 구간 판정 (실제 예약 시작 박자 도달 시)
  if (prepareStartBeat !== null && beatIndex >= prepareStartBeat) {
    const prepareOffset = beatIndex - prepareStartBeat;
    return prepareOffset < pattern.prepareCues.length
      ? pattern.prepareCues[prepareOffset]
      : pattern.prepareCues[pattern.prepareCues.length - 1];
  }

  // 2. 명목 운동 큐 구간
  const nominalCount = pattern.exerciseCues.length;
  if (beatIndex < nominalCount) {
    return pattern.exerciseCues[beatIndex];
  }

  // 3. 미달 연장 큐 구간 (준비 미예약 시 중앙 운동 교대 반복)
  const extOffset = beatIndex - nominalCount;
  return pattern.extensionCues[extOffset % pattern.extensionCues.length];
}

/**
 * 특정 정수 박 인덱스에 해당하는 큐 뷰모델 해석
 */
function resolveCueForBeat(
  beatIndex: number,
  pattern: RunningMatPattern,
  prepareStartBeat: number | null,
  transitionBeat: number | null
): MatCueViewModel | null {
  const cue = resolveRawCueForBeat(beatIndex, pattern, prepareStartBeat, transitionBeat);
  if (!cue) return null;

  return {
    beatIndex,
    actionId: cue.id,
    actionText: cue.actionText,
    directionText: cue.directionText,
    cueText: cue.cueText,
    arrowDirection: cue.arrowDirection,
    leftFootSlot: cue.leftFootSlot,
    rightFootSlot: cue.rightFootSlot,
    isPrepare: Boolean(cue.isPrepare),
  };
}

/**
 * 순수 매핑 함수: RunTimingSnapshot -> RunningMatViewModel
 */
export function presentRunningMat(
  snapshot: RunTimingSnapshot | null,
  mode: LocomotionMode = 'run'
): RunningMatViewModel {
  if (!snapshot || !snapshot.active) {
    return Object.freeze({
      visible: false,
      paused: snapshot?.paused ?? false,
      currentCue: null,
      nextCue: null,
      upcomingCues: Object.freeze([]),
      actionText: '',
      directionText: '',
      cueText: '',
      arrowDirection: 'none',
      nextRingRatio: 0,
      elapsedBeats: snapshot?.elapsedBeats ?? 0,
      acceptedExerciseCount: snapshot?.acceptedExerciseCount ?? 0,
      requiredExerciseCount: snapshot?.requiredExerciseCount ?? 0,
      isShortage: false,
      isPreparing: false,
      isReturnPhase: false,
      phase: 'hold',
    });
  }

  const exerciseBeats = snapshot.exerciseBeats || 8;
  const pattern = getRunningMatPattern(mode, exerciseBeats);

  const b = snapshot.elapsedBeats;
  const currentBeat = Math.floor(b);
  const fraction = b >= 0 ? b - Math.floor(b) : 0;
  const returnPhaseRatio = DEFAULT_RETURN_PHASE_RATIO;

  const rawCurrentCue = resolveCueForBeat(
    currentBeat,
    pattern,
    snapshot.prepareStartBeat,
    snapshot.transitionBeat
  );

  let currentCue: MatCueViewModel | null = rawCurrentCue;
  let isReturnPhase = false;
  let currentPhase: CuePhase = 'hold';

  if (rawCurrentCue) {
    const isKnee =
      rawCurrentCue.actionId === 'knee_left' ||
      rawCurrentCue.actionId === 'knee_right';

    if (isKnee) {
      isReturnPhase = fraction >= returnPhaseRatio;
      currentPhase = isReturnPhase ? 'return' : 'lift';
      const actionText = isReturnPhase
        ? (rawCurrentCue.actionId === 'knee_left' ? '왼무릎 복귀' : '오른무릎 복귀')
        : (rawCurrentCue.actionId === 'knee_left' ? '왼무릎 들기' : '오른무릎 들기');

      currentCue = {
        ...rawCurrentCue,
        actionText,
        isReturnPhase,
        phase: currentPhase,
      };
    } else {
      isReturnPhase = false;
      currentPhase = 'hold';
      currentCue = {
        ...rawCurrentCue,
        isReturnPhase: false,
        phase: 'hold',
      };
    }
  }

  const nextCue = resolveCueForBeat(
    currentBeat + 1,
    pattern,
    snapshot.prepareStartBeat,
    snapshot.transitionBeat
  );

  // upcomingCues: 최대 2개 배열 (1박 후, 2박 후)
  const upcomingCuesList: UpcomingCueViewModel[] = [];
  const candidateBeats = [currentBeat + 1, currentBeat + 2];

  for (const targetBeat of candidateBeats) {
    if (targetBeat < 0) continue;
    if (snapshot.transitionBeat !== null && targetBeat >= snapshot.transitionBeat) {
      continue;
    }
    const rawCue = resolveRawCueForBeat(
      targetBeat,
      pattern,
      snapshot.prepareStartBeat,
      snapshot.transitionBeat
    );
    if (!rawCue) continue;

    const remainingBeats = Math.max(0, targetBeat - b);
    const progress = Math.max(0, Math.min(1.0, fraction));
    const isKnee = rawCue.id === 'knee_left' || rawCue.id === 'knee_right';
    const phase: CuePhase = isKnee ? 'lift' : 'hold';

    upcomingCuesList.push({
      cue: rawCue,
      targetBeat,
      remainingBeats: Number(remainingBeats.toFixed(4)),
      progress: Number(progress.toFixed(4)),
      phase,
      isReturnPhase: false,
    });
  }

  const isPreparing = Boolean(
    snapshot.prepareStartBeat !== null &&
    snapshot.elapsedBeats >= snapshot.prepareStartBeat
  );

  const isShortage = Boolean(
    snapshot.acceptedExerciseCount < snapshot.requiredExerciseCount
  );

  const nextRingRatio = computeNextRingRatio(snapshot.elapsedBeats);

  return Object.freeze({
    visible: true,
    paused: snapshot.paused,
    currentCue,
    nextCue,
    upcomingCues: Object.freeze(upcomingCuesList),
    actionText: currentCue?.actionText ?? '',
    directionText: currentCue?.directionText ?? '',
    cueText: currentCue?.cueText ?? '',
    arrowDirection: currentCue?.arrowDirection ?? 'none',
    nextRingRatio,
    elapsedBeats: snapshot.elapsedBeats,
    acceptedExerciseCount: snapshot.acceptedExerciseCount,
    requiredExerciseCount: snapshot.requiredExerciseCount,
    isShortage,
    isPreparing,
    isReturnPhase,
    phase: currentPhase,
  });
}

/**
 * 러닝 매트 프레젠터 클래스
 */
export class RunningMatPresenter {
  private _mode: LocomotionMode;

  constructor(mode: LocomotionMode = 'run') {
    this._mode = mode;
  }

  getMode(): LocomotionMode {
    return this._mode;
  }

  setMode(mode: LocomotionMode): void {
    this._mode = mode;
  }

  present(
    snapshot: RunTimingSnapshot | null,
    overrideMode?: LocomotionMode
  ): RunningMatViewModel {
    return presentRunningMat(snapshot, overrideMode ?? this._mode);
  }
}
