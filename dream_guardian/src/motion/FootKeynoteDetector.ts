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
  virtualHeight?: number;
}

interface KneeState {
  baseline: number | null;
  previous: number | null;
  peak: number | null;
  armed: boolean;
}

function createKneeState(): KneeState {
  return { baseline: null, previous: null, peak: null, armed: true };
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

    const vh = options?.virtualHeight ?? this._config.virtualHeight;
    let leftY = left.y;
    let rightY = right.y;

    if (vh && vh > 0) {
      if (leftY > 1.5 || rightY > 1.5) {
        leftY = leftY / vh;
        rightY = rightY / vh;
      }
    } else if (leftY > 1.5 || rightY > 1.5) {
      // 픽셀 좌표가 주어졌으나 가상 높이가 없어 정규화할 수 없는 경우 노이즈 오인식 차단
      this.reset();
      this._resynchronizeNextFrame = true;
      return [];
    }

    if (this._resynchronizeNextFrame || this._left.baseline === null || this._right.baseline === null) {
      this._initialize(leftY, rightY);
      this._resynchronizeNextFrame = false;
      return [];
    }

    const leftTriggered = this._updateKnee(this._left, leftY, timestamp);
    const rightTriggered = this._updateKnee(this._right, rightY, timestamp);
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
    this._left = { baseline: leftY, previous: leftY, peak: null, armed: true };
    this._right = { baseline: rightY, previous: rightY, peak: null, armed: true };
  }

  private _updateKnee(state: KneeState, y: number, timestamp: number): boolean {
    const baseline = state.baseline!;
    const neutralThreshold = this._config.movementThreshold * this._config.rearmNeutralRatio;
    const distanceToBaseline = Math.abs(y - baseline);

    // 1. 중립 복귀 시 재무장 (발을 바닥에 내리고 쿨다운 경과 후)
    if (!state.armed && timestamp >= this._cooldownUntil && distanceToBaseline <= neutralThreshold) {
      state.armed = true;
      state.peak = null;
    }

    // 2. 중립 상태에서 기저선 적응 필터
    if (state.armed && distanceToBaseline <= neutralThreshold) {
      state.baseline = baseline * 0.9 + y * 0.1;
    }

    // 3. 발들기(Knee Lift UP) 판정: 화면 상단 방향(y 감소)으로 movementThreshold 이상 상승
    const lift = state.baseline! - y;
    let triggered = false;

    if (state.armed && timestamp >= this._cooldownUntil) {
      if (lift >= this._config.movementThreshold) {
        triggered = true;
        state.armed = false;
        state.peak = y;
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
