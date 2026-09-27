import {
  DEFAULT_FOOT_KEYNOTE_CONFIG,
  type FootKeynoteConfig,
} from '../../config/motion.config.js';
import type { FootKeynoteEvent } from '../types/keynote.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';

export interface FootKeynoteDetectorOptions extends Partial<FootKeynoteConfig> {
  isMirrored?: boolean;
}

export interface FootKeynoteUpdateOptions {
  isSafetyGuarded?: boolean;
  isPoseInputAllowed?: boolean;
}

interface KneeState {
  baseline: number | null;
  previous: number | null;
  peak: number | null;
  descending: boolean;
  armed: boolean;
}

function createKneeState(): KneeState {
  return { baseline: null, previous: null, peak: null, descending: false, armed: true };
}

export class FootKeynoteDetector {
  private readonly _config: FootKeynoteConfig;
  private _left = createKneeState();
  private _right = createKneeState();
  private _cooldownUntil = 0;
  private _resynchronizeNextFrame = false;

  constructor(options?: FootKeynoteDetectorOptions) {
    this._config = { ...DEFAULT_FOOT_KEYNOTE_CONFIG, ...options };
  }

  update(
    _dt: number,
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    timestamp: number,
    options?: FootKeynoteUpdateOptions,
  ): FootKeynoteEvent[] {
    if (options?.isSafetyGuarded || options?.isPoseInputAllowed === false) {
      this.reset();
      this._resynchronizeNextFrame = true;
      return [];
    }

    const left = landmarks?.[POSE_LANDMARKS.LEFT_KNEE];
    const right = landmarks?.[POSE_LANDMARKS.RIGHT_KNEE];
    if (!left || !right || left.visibility < this._config.minVisibility || right.visibility < this._config.minVisibility) {
      this.reset();
      this._resynchronizeNextFrame = true;
      return [];
    }

    if (this._resynchronizeNextFrame || this._left.baseline === null || this._right.baseline === null) {
      this._initialize(left.y, right.y);
      this._resynchronizeNextFrame = false;
      return [];
    }

    const leftTriggered = this._updateKnee(this._left, left.y, timestamp);
    const rightTriggered = this._updateKnee(this._right, right.y, timestamp);
    if (!leftTriggered && !rightTriggered) return [];

    this._cooldownUntil = timestamp + this._config.cooldownDuration;
    const confidence = Math.min(left.visibility, right.visibility);
    if (leftTriggered && rightTriggered) {
      return [this._event('centerFoot', 10, timestamp, confidence)];
    }

    return leftTriggered
      ? [this._event('leftFoot', 9, timestamp, left.visibility)]
      : [this._event('rightFoot', 11, timestamp, right.visibility)];
  }

  reset(): void {
    this._left = createKneeState();
    this._right = createKneeState();
    this._cooldownUntil = 0;
  }

  private _initialize(leftY: number, rightY: number): void {
    this._left = { ...createKneeState(), baseline: leftY, previous: leftY };
    this._right = { ...createKneeState(), baseline: rightY, previous: rightY };
  }

  private _updateKnee(state: KneeState, y: number, timestamp: number): boolean {
    const baseline = state.baseline!;
    const previous = state.previous!;
    const neutralDistance = Math.abs(y - baseline);
    const neutralThreshold = this._config.movementThreshold * this._config.rearmNeutralRatio;
    if (!state.armed && timestamp >= this._cooldownUntil && neutralDistance <= neutralThreshold) {
      state.armed = true;
      state.peak = null;
      state.descending = false;
    }

    const delta = y - previous;
    let triggered = false;
    if (state.armed && timestamp >= this._cooldownUntil) {
      if (delta > 0) {
        state.descending = true;
        state.peak = Math.max(state.peak ?? y, y);
      } else if (state.descending && delta < 0 && state.peak !== null && state.peak - y >= this._config.movementThreshold) {
        triggered = true;
        state.armed = false;
        state.descending = false;
      }
    }

    state.previous = y;
    return triggered;
  }

  private _event(
    foot: FootKeynoteEvent['foot'],
    zoneId: FootKeynoteEvent['zoneId'],
    timestamp: number,
    confidence: number,
  ): FootKeynoteEvent {
    return { foot, zoneId, source: 'knee-proxy', timestamp, confidence };
  }
}
