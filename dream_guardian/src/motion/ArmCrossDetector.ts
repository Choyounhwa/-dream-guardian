/**
 * ArmCrossDetector - 양손 상하 교차 / 휠 펌핑 / 드라이빙 감지기
 *
 * 하체를 사용할 수 없거나 휠체어/착석 상태에서 상체만을 이용해 플레이할 수 있도록
 * 양손 손목(LEFT_WRIST, RIGHT_WRIST)의 상하 높낮이 교차 역전 동작을 감지.
 *
 * @see Issue #153 (FEAT-MOTION-001)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_CONFIG } from '../core/Config.js';
import type { ILocomotionDetector, LocomotionMode } from './LocomotionDetector.js';

export class ArmCrossDetector implements ILocomotionDetector {
  readonly mode: LocomotionMode = 'arm_cross';

  private _isRunning = false;
  private _stepCount = 0;
  private _lastStepTime = 0;
  private _lastActionTime = 0;
  private _state: 'left_high' | 'right_high' | 'none' = 'none';

  private _threshold: number;
  private _stepInterval: number;
  private _stopTimeout: number;

  constructor(
    threshold = DEFAULT_CONFIG.motion.armCrossMin ?? 0.030,
    stepInterval = DEFAULT_CONFIG.motion.stepInterval,
    stopTimeout = 0.5,
  ) {
    this._threshold = threshold;
    this._stepInterval = stepInterval;
    this._stopTimeout = stopTimeout;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get stepCount(): number {
    return this._stepCount;
  }

  /**
   * 매 프레임 호출
   * @param landmarks 가상 좌표 랜드마크
   * @param _baselineY 보정된 기준선 Y
   * @param time 현재 시간 (초)
   * @param _virtualHeight 가상 뷰포트 높이
   * @returns 이번 프레임에서 양손 교차 스텝 감지 여부
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    _baselineY: number,
    time: number,
    _virtualHeight?: number,
  ): boolean {
    const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    if (!lWrist || !rWrist) {
      this._isRunning = false;
      return false;
    }

    if (lWrist.visibility < 0.5 || rWrist.visibility < 0.5) {
      this._isRunning = false;
      return false;
    }

    // Y 좌표계는 아래로 갈수록 커지므로:
    // leftWrist.y < rightWrist.y 이면 왼손이 오른손보다 높음
    const diffY = lWrist.y - rWrist.y;
    let stepped = false;

    if (Math.abs(diffY) >= this._threshold) {
      this._lastActionTime = time;
      this._isRunning = true;

      const newState: 'left_high' | 'right_high' = diffY < 0 ? 'left_high' : 'right_high';

      if (this._state !== 'none' && this._state !== newState) {
        const interval = time - this._lastStepTime;
        if (interval >= this._stepInterval) {
          this._stepCount++;
          this._lastStepTime = time;
          stepped = true;
        }
      }
      this._state = newState;
    } else {
      if (time - this._lastActionTime >= this._stopTimeout) {
        this._isRunning = false;
        this._state = 'none';
      }
    }

    return stepped;
  }

  /** 초기화 */
  reset(): void {
    this._isRunning = false;
    this._stepCount = 0;
    this._lastStepTime = 0;
    this._lastActionTime = 0;
    this._state = 'none';
  }
}
