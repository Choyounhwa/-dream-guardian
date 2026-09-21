/**
 * RunDetector - 제자리 달리기 감지
 *
 * 어깨 상하 바운스 + 좌우 흔들림 감지
 * 걸음 수 카운트: 어깨 수직 이동 > runBounceMin, 최소 stepInterval 간격
 *
 * @see Issue #11 (GitHub #76)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_CONFIG } from '../core/Config.js';

export class RunDetector {
  private _isRunning = false;
  private _stepCount = 0;
  private _lastStepTime = 0;
  private _lastBounceTime = 0;
  private _prevShoulderY = -1;
  private _baselineY = 0;
  private _direction: 'up' | 'down' | 'none' = 'none';

  private _bounceMin: number;
  private _stepInterval: number;
  private _stopTimeout: number;

  constructor(
    bounceMin = DEFAULT_CONFIG.motion.runBounceMin,
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
   * @param baselineY 보정된 어깨 기준선 Y
   * @param time 현재 시간 (초)
   * @param virtualHeight 가상 뷰포트 높이 (선택 사항)
   * @returns 이번 프레임에서 걸음이 감지되었는지
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    baselineY: number,
    time: number,
    virtualHeight?: number,
  ): boolean {
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    if (!lShoulder || !rShoulder) {
      this._isRunning = false;
      return false;
    }
    if (lShoulder.visibility < 0.5 || rShoulder.visibility < 0.5) {
      this._isRunning = false;
      return false;
    }

    if (baselineY > 0) {
      this._baselineY = baselineY;
    }

    const currentY = (lShoulder.y + rShoulder.y) / 2;

    // baselineY 기준선 검증: 어깨가 기준선 대비 과도하게 하강(스쿼트 등) 시 달리기 스텝 차단
    if (this._baselineY > 0) {
      const vh = virtualHeight ?? (this._baselineY > 500 ? 2160 : 1080);
      const maxSquatDrop = vh * 0.06;
      if (currentY - this._baselineY > maxSquatDrop) {
        this._isRunning = false;
        this._direction = 'none';
        this._prevShoulderY = currentY;
        return false;
      }
    }

    if (this._prevShoulderY < 0) {
      this._prevShoulderY = currentY;
      return false;
    }

    const deltaY = currentY - this._prevShoulderY;
    this._prevShoulderY = currentY;

    // 방향 전환 감지 (상 → 하 전환 시 1걸음)
    let stepped = false;
    const absDelta = Math.abs(deltaY);

    if (absDelta > this._bounceMin) {
      this._lastBounceTime = time;
      this._isRunning = true;

      const newDir: 'up' | 'down' = deltaY < 0 ? 'up' : 'down';

      if (this._direction !== 'none' && this._direction !== newDir) {
        // 방향 전환 = 1걸음
        const interval = time - this._lastStepTime;
        if (interval >= this._stepInterval) {
          this._stepCount++;
          this._lastStepTime = time;
          stepped = true;
        }
      }
      this._direction = newDir;
    } else {
      // 바운스가 멈춘 후 stopTimeout 경과 시 isRunning = false로 복귀
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
    this._prevShoulderY = -1;
    this._direction = 'none';
    this._baselineY = 0;
  }
}
