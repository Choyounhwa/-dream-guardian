/**
 * HipBounceDetector - 무소음 골반 상하 바운스 감지기
 *
 * 층간소음 없이 제자리에서 무릎을 굽혔다 펴며 골반을 상하로 바운스하는 동작을 감지.
 * LEFT_HIP, RIGHT_HIP Y 좌표의 변위 및 방향 전환(상 ↔ 하)으로 스텝을 카운트한다.
 *
 * @see Issue #153 (FEAT-MOTION-001)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_CONFIG } from '../core/Config.js';
import type { ILocomotionDetector, LocomotionMode } from './LocomotionDetector.js';

export class HipBounceDetector implements ILocomotionDetector {
  readonly mode: LocomotionMode = 'hip_bounce';

  private _isRunning = false;
  private _stepCount = 0;
  private _lastStepTime = 0;
  private _lastBounceTime = 0;
  private _prevHipY = -1;
  private _baselineY = 0;
  private _direction: 'up' | 'down' | 'none' = 'none';

  private _bounceMin: number;
  private _stepInterval: number;
  private _stopTimeout: number;

  constructor(
    bounceMin = DEFAULT_CONFIG.motion.hipBounceMin ?? 0.010,
    stepInterval = DEFAULT_CONFIG.motion.stepInterval,
    stopTimeout = 0.5,
  ) {
    this._bounceMin = bounceMin;
    this._stepInterval = stepInterval;
    this._stopTimeout = stopTimeout;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get stepCount(): number {
    return this._stepCount;
  }

  get baselineY(): number {
    return this._baselineY;
  }

  /**
   * 매 프레임 호출
   * @param landmarks 가상 좌표 랜드마크
   * @param baselineY 보정된 골반/어깨 기준선 Y
   * @param time 현재 시간 (초)
   * @param _virtualHeight 가상 뷰포트 높이
   * @returns 이번 프레임에서 바운스 스텝 감지 여부
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    baselineY: number,
    time: number,
    _virtualHeight?: number,
  ): boolean {
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    if (!lHip || !rHip) {
      this._isRunning = false;
      return false;
    }

    if (lHip.visibility < 0.5 || rHip.visibility < 0.5) {
      this._isRunning = false;
      return false;
    }

    if (baselineY > 0) {
      this._baselineY = baselineY;
    }

    const currentY = (lHip.y + rHip.y) / 2;

    if (this._prevHipY < 0) {
      this._prevHipY = currentY;
      return false;
    }

    const deltaY = currentY - this._prevHipY;
    this._prevHipY = currentY;

    let stepped = false;
    const absDelta = Math.abs(deltaY);

    if (absDelta > this._bounceMin) {
      this._lastBounceTime = time;
      this._isRunning = true;

      const newDir: 'up' | 'down' = deltaY < 0 ? 'up' : 'down';

      if (this._direction !== 'none' && this._direction !== newDir) {
        const interval = time - this._lastStepTime;
        if (interval >= this._stepInterval) {
          this._stepCount++;
          this._lastStepTime = time;
          stepped = true;
        }
      }
      this._direction = newDir;
    } else {
      if (time - this._lastBounceTime >= this._stopTimeout) {
        this._isRunning = false;
        this._direction = 'none';
      }
    }

    return stepped;
  }

  /** 초기화 */
  reset(): void {
    this._isRunning = false;
    this._stepCount = 0;
    this._lastStepTime = 0;
    this._lastBounceTime = 0;
    this._prevHipY = -1;
    this._direction = 'none';
    this._baselineY = 0;
  }
}
