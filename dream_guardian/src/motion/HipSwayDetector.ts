/**
 * HipSwayDetector - 골반 좌우 스웨이 / 트월킹 감지기
 *
 * 뛸 수 없거나 좁은 공간에서 골반을 좌우로 흔들거나 회전하는 코어 운동 동작을 감지.
 * LEFT_HIP, RIGHT_HIP X 좌표의 중심 변위 및 좌우 반전(좌 ↔ 우)으로 스텝을 카운트한다.
 *
 * @see Issue #153 (FEAT-MOTION-001)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_CONFIG } from '../core/Config.js';
import type { ILocomotionDetector, LocomotionMode } from './LocomotionDetector.js';

export class HipSwayDetector implements ILocomotionDetector {
  readonly mode: LocomotionMode = 'hip_sway';

  private _isRunning = false;
  private _stepCount = 0;
  private _lastStepTime = 0;
  private _lastSwayTime = 0;
  private _prevHipX = -1;
  private _direction: 'left' | 'right' | 'none' = 'none';

  private _swayMin: number;
  private _stepInterval: number;
  private _stopTimeout: number;

  constructor(
    swayMin = DEFAULT_CONFIG.motion.hipSwayMin ?? 0.012,
    stepInterval = DEFAULT_CONFIG.motion.stepInterval,
    stopTimeout = 0.5,
  ) {
    this._swayMin = swayMin;
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
   * @param _baselineY 보정된 기준선 Y (스웨이에서는 X 중심 추적)
   * @param time 현재 시간 (초)
   * @param _virtualHeight 가상 뷰포트 높이
   * @returns 이번 프레임에서 스웨이 스텝 감지 여부
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    _baselineY: number,
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

    const currentX = (lHip.x + rHip.x) / 2;

    if (this._prevHipX < 0) {
      this._prevHipX = currentX;
      return false;
    }

    const deltaX = currentX - this._prevHipX;
    this._prevHipX = currentX;

    let stepped = false;
    const absDelta = Math.abs(deltaX);

    if (absDelta > this._swayMin) {
      this._lastSwayTime = time;
      this._isRunning = true;

      const newDir: 'left' | 'right' = deltaX < 0 ? 'left' : 'right';

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
      if (time - this._lastSwayTime >= this._stopTimeout) {
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
    this._lastSwayTime = 0;
    this._prevHipX = -1;
    this._direction = 'none';
  }
}
