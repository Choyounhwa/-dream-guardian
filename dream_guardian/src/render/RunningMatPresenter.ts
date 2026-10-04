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
  type RunningMatPattern,
  getRunningMatPattern,
} from '../data/runningMatPatterns.js';

export type { MatArrowDirection, MatFootSlot };

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
}

export interface RunningMatViewModel {
  readonly visible: boolean;
  readonly paused: boolean;
  readonly currentCue: MatCueViewModel | null;
  readonly nextCue: MatCueViewModel | null;
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
 * 특정 정수 박 인덱스에 해당하는 큐 뷰모델 해석
 */
function resolveCueForBeat(
  beatIndex: number,
  pattern: RunningMatPattern,
  prepareStartBeat: number | null,
  transitionBeat: number | null
): MatCueViewModel | null {
  if (beatIndex < 0) return null;
  if (transitionBeat !== null && beatIndex >= transitionBeat) {
    return null;
  }

  // 1. 준비 구간 판정 (실제 예약 시작 박자 도달 시)
  if (prepareStartBeat !== null && beatIndex >= prepareStartBeat) {
    const prepareOffset = beatIndex - prepareStartBeat;
    const prepareCue =
      prepareOffset < pattern.prepareCues.length
        ? pattern.prepareCues[prepareOffset]
        : pattern.prepareCues[pattern.prepareCues.length - 1];

    return {
      beatIndex,
      actionId: prepareCue.id,
      actionText: prepareCue.actionText,
      directionText: prepareCue.directionText,
      cueText: prepareCue.cueText,
      arrowDirection: prepareCue.arrowDirection,
      leftFootSlot: prepareCue.leftFootSlot,
      rightFootSlot: prepareCue.rightFootSlot,
      isPrepare: true,
    };
  }

  // 2. 명목 운동 큐 구간
  const nominalCount = pattern.exerciseCues.length;
  if (beatIndex < nominalCount) {
    const cue = pattern.exerciseCues[beatIndex];
    return {
      beatIndex,
      actionId: cue.id,
      actionText: cue.actionText,
      directionText: cue.directionText,
      cueText: cue.cueText,
      arrowDirection: cue.arrowDirection,
      leftFootSlot: cue.leftFootSlot,
      rightFootSlot: cue.rightFootSlot,
      isPrepare: false,
    };
  }

  // 3. 미달 연장 큐 구간 (준비 미예약 시 중앙 운동 교대 반복)
  const extOffset = beatIndex - nominalCount;
  const extCue = pattern.extensionCues[extOffset % pattern.extensionCues.length];
  return {
    beatIndex,
    actionId: extCue.id,
    actionText: extCue.actionText,
    directionText: extCue.directionText,
    cueText: extCue.cueText,
    arrowDirection: extCue.arrowDirection,
    leftFootSlot: extCue.leftFootSlot,
    rightFootSlot: extCue.rightFootSlot,
    isPrepare: false,
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
    });
  }

  const exerciseBeats = snapshot.exerciseBeats || 8;
  const pattern = getRunningMatPattern(mode, exerciseBeats);

  const currentBeat = Math.floor(snapshot.elapsedBeats);
  const currentCue = resolveCueForBeat(
    currentBeat,
    pattern,
    snapshot.prepareStartBeat,
    snapshot.transitionBeat
  );

  const nextCue = resolveCueForBeat(
    currentBeat + 1,
    pattern,
    snapshot.prepareStartBeat,
    snapshot.transitionBeat
  );

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
