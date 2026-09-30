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
import { DEFAULT_JUMP_CONFIG } from '../../config/motion.config.js';

export interface JumpUpdateOptions {
  isPaused?: boolean;
  isSafetyGuarded?: boolean;
  isCalibrated?: boolean;
}

export class JumpDetector {
  private _isJumping = false;
  private _jumpCount = 0;
  private _wasJumping = false;
  private _prevShoulderY = -1;
  private _threshold: number;
  private _speedMin: number;

  constructor(
    threshold = DEFAULT_JUMP_CONFIG.threshold ?? DEFAULT_CONFIG.motion.jumpThreshold,
    speedMin = DEFAULT_JUMP_CONFIG.speedMin ?? DEFAULT_CONFIG.motion.jumpSpeedMin,
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
   * @param landmarks 가상 좌표 랜드마크 (0~vh 또는 0~1 정규화)
   * @param baselineY 보정된 어깨 기준선 Y
   * @param virtualHeight 가상 뷰포트 높이 (임계값 스케일링)
   * @param dt 델타타임 (초)
   * @param options 일시정지, 안전가드, 보정 완료 여부 옵션
   * @returns 이번 프레임에서 점프가 새로 감지되었는지
   */
  update(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    baselineY: number,
    virtualHeight: number,
    dt: number,
    options?: JumpUpdateOptions,
  ): boolean {
    if (
      options?.isPaused ||
      options?.isSafetyGuarded ||
      options?.isCalibrated === false ||
      baselineY <= 0 ||
      !landmarks
    ) {
      this._isJumping = false;
      this._wasJumping = false;
      this._prevShoulderY = -1;
      return false;
    }

    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    if (!lShoulder || !rShoulder || lShoulder.visibility < 0.5 || rShoulder.visibility < 0.5) {
      this._isJumping = false;
      this._wasJumping = false;
      this._prevShoulderY = -1;
      return false;
    }

    const currentY = (lShoulder.y + rShoulder.y) / 2;

    // 추적 최초 획득 또는 유실 후 재획득 첫 프레임: 이전 위치 동기화만 수행하고 가짜 점프 차단
    if (this._prevShoulderY < 0) {
      this._prevShoulderY = currentY;
      this._isJumping = false;
      this._wasJumping = false;
      return false;
    }

    // 0~1 정규화 좌표계 또는 가상 픽셀 좌표계(vh) 안전 스케일링
    const isNormalized = currentY <= 1.5 && baselineY <= 1.5;
    const effectiveVh = isNormalized ? 1.0 : virtualHeight;
    const threshold = this._threshold * effectiveVh;
    const speedThreshold = this._speedMin * effectiveVh;
    const rise = baselineY - currentY; // Y 감소 = 상승 (캔버스 좌표계)

    // 속도 계산 (프레임 튐 / resume 방지: dt > 0.1 시 이전 프레임 동기화만)
    let speed = 0;
    if (dt > 0.1) {
      this._prevShoulderY = currentY;
      this._isJumping = false;
      this._wasJumping = false;
      return false;
    }

    if (dt > 0) {
      speed = (this._prevShoulderY - currentY) / dt; // 양수 = 위로
    }
    this._prevShoulderY = currentY;

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
