import {
  DEFAULT_KNEE_FRAMING_CONFIG,
  type KneeFramingConfig,
} from '../../config/motion.config.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';

export type KneeFramingStatus = 'unframed' | 'stabilizing' | 'ready' | 'degraded';
export type KneeFramingIssue =
  | 'low-visibility'
  | 'outside-safe-frame'
  | 'body-too-small'
  | 'body-too-large'
  | null;

export interface KneeFramingResult {
  status: KneeFramingStatus;
  issue: KneeFramingIssue;
  progress: number;
  isFootKeynotePoseInputAllowed: boolean;
}

const REQUIRED_LANDMARKS = [
  POSE_LANDMARKS.NOSE,
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
] as const;

export class KneeFramingValidator {
  private readonly _config: KneeFramingConfig;
  private _status: KneeFramingStatus = 'unframed';
  private _issue: KneeFramingIssue = null;
  private _stableTime = 0;

  constructor(config?: Partial<KneeFramingConfig>) {
    this._config = { ...DEFAULT_KNEE_FRAMING_CONFIG, ...config };
  }

  get status(): KneeFramingStatus {
    return this._status;
  }

  get issue(): KneeFramingIssue {
    return this._issue;
  }

  get progress(): number {
    return this._status === 'ready'
      ? 1
      : Math.min(this._stableTime / this._config.stabilityDuration, 1);
  }

  get isFootKeynotePoseInputAllowed(): boolean {
    return this._status === 'ready';
  }

  update(
    dt: number,
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    virtualWidth: number,
    virtualHeight: number,
  ): KneeFramingResult {
    const issue = this._evaluate(landmarks, virtualWidth, virtualHeight);
    if (issue !== null) {
      const hasStartedFraming = this._status !== 'unframed';
      this._status = hasStartedFraming ? 'degraded' : 'unframed';
      this._issue = issue;
      this._stableTime = 0;
      return this._result();
    }

    this._issue = null;
    this._stableTime += Math.max(0, dt);
    this._status = this._stableTime >= this._config.stabilityDuration ? 'ready' : 'stabilizing';
    return this._result();
  }

  reset(): void {
    this._status = 'unframed';
    this._issue = null;
    this._stableTime = 0;
  }

  private _result(): KneeFramingResult {
    return {
      status: this._status,
      issue: this._issue,
      progress: this.progress,
      isFootKeynotePoseInputAllowed: this.isFootKeynotePoseInputAllowed,
    };
  }

  private _evaluate(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    width: number,
    height: number,
  ): KneeFramingIssue {
    if (!landmarks || width <= 0 || height <= 0) return 'low-visibility';

    const required = REQUIRED_LANDMARKS.map((index) => landmarks[index]);
    if (required.some((landmark) => !landmark || landmark.visibility < this._config.minVisibility)) {
      return 'low-visibility';
    }

    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]!;
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]!;
    const shoulderWidthRatio = Math.abs(rightShoulder.x - leftShoulder.x) / width;
    if (shoulderWidthRatio < this._config.minShoulderWidthRatio) return 'body-too-small';
    if (shoulderWidthRatio > this._config.maxShoulderWidthRatio) return 'body-too-large';

    const minX = width * this._config.horizontalSafeMargin;
    const maxX = width - minX;
    const minY = height * this._config.topSafeMargin;
    const maxY = height * (1 - this._config.bottomSafeMargin);
    if (required.some((landmark) => landmark!.x < minX || landmark!.x > maxX || landmark!.y < minY || landmark!.y > maxY)) {
      return 'outside-safe-frame';
    }

    return null;
  }
}
