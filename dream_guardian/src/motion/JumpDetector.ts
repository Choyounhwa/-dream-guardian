/**
 * JumpDetector - 점프 감지
 *
 * 어깨 Y가 기준선 대비 jumpThreshold(0.065) 상승 + 속도 > jumpSpeedMin(0.22)/dt
 *
 * @see Issue #11 (GitHub #76)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_CONFIG } from '../core/Config.js';

export class JumpDetector {
  private _isJumping = false;
  private _jumpCount = 0;
  private _wasJumping = false;
  private _prevShoulderY = -1;
  private _threshold: number;
  private _speedMin: number;

  constructor(
    threshold = DEFAULT_CONFIG.motion.jumpThreshold,
    speedMin = DEFAULT_CONFIG.motion.jumpSpeedMin,
  ) {
    this._threshold = threshold;
    this._speedMin = speedMin;
  }

  get isJumping(): boolean {
    return this._isJumping;
  }

  get jumpCount(): number {
    return this._jumpCount;
  }

  /**
   * 매 프레임 호출
   * @param landmarks 가상 좌표 랜드마크
   * @param baselineY 보정된 어깨 기준선 Y (가상 좌표)
   * @param virtualHeight 가상 뷰포트 높이 (임계값 스케일링)
   * @param dt 델타타임 (초)
   * @returns 이번 프레임에서 점프가 새로 감지되었는지
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    baselineY: number,
    virtualHeight: number,
    dt: number,
  ): boolean {
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    if (!lShoulder || !rShoulder) {
      this._isJumping = false;
      return false;
    }
    if (lShoulder.visibility < 0.5 || rShoulder.visibility < 0.5) {
      this._isJumping = false;
      return false;
    }

    const currentY = (lShoulder.y + rShoulder.y) / 2;
    const rise = baselineY - currentY; // Y 감소 = 상승 (캔버스 좌표계)
    const threshold = this._threshold * virtualHeight;

    // 속도 계산
    let speed = 0;
    if (this._prevShoulderY >= 0 && dt > 0) {
      speed = (this._prevShoulderY - currentY) / dt; // 양수 = 위로
    }
    this._prevShoulderY = currentY;

    const speedThreshold = this._speedMin * virtualHeight;

    this._isJumping = rise > threshold && speed > speedThreshold;

    // 점프 시작 감지 (엣지 트리거)
    let started = false;
    if (this._isJumping && !this._wasJumping) {
      this._jumpCount++;
      started = true;
    }
    this._wasJumping = this._isJumping;

    return started;
  }

  reset(): void {
    this._isJumping = false;
    this._jumpCount = 0;
    this._wasJumping = false;
    this._prevShoulderY = -1;
  }
}
