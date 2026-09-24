/**
 * XGestureDetector - 양손 대각 어깨 교차 X자 제스처 감지기
 *
 * MediaPipe Pose의 어깨(LEFT_SHOULDER 11, RIGHT_SHOULDER 12)와
 * 손목(LEFT_WRIST 15, RIGHT_WRIST 16) 랜드마크를 활용하여
 * 왼손이 오른쪽 어깨에, 오른손이 왼쪽 어깨에 동시에 접근하는 X자 교차 포즈를 판정.
 *
 * @see Issue #171 (FEAT-MOTION-002)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_X_GESTURE_CONFIG, type XGestureConfig } from '../../config/motion.config.js';

export interface XGestureResult {
  /** 현재 X자 교차 포즈 만족 여부 */
  isCrossing: boolean;
  /** 0.4초 체류 누적 진행도 (0~1) */
  progress: number;
  /** 이번 프레임에서 트리거 발생 여부 */
  triggered: boolean;
  /** 현재 쿨다운 중인지 여부 */
  inCooldown: boolean;
  /** 왼손목-오른어깨 정규화 거리 (shoulderWidth 대비 비율) */
  leftToRightDistRatio: number;
  /** 오른손목-왼어깨 정규화 거리 (shoulderWidth 대비 비율) */
  rightToLeftDistRatio: number;
}

export class XGestureDetector {
  private _config: XGestureConfig;
  private _isCrossing = false;
  private _holdTimer = 0;
  private _cooldownTimer = 0;
  private _triggered = false;
  private _leftToRightDistRatio = 999;
  private _rightToLeftDistRatio = 999;

  constructor(config: Partial<XGestureConfig> = {}) {
    this._config = { ...DEFAULT_X_GESTURE_CONFIG, ...config };
  }

  get isCrossing(): boolean {
    return this._isCrossing;
  }

  get progress(): number {
    return Math.min(1, Math.max(0, this._holdTimer / this._config.dwellTime));
  }

  get triggered(): boolean {
    return this._triggered;
  }

  get inCooldown(): boolean {
    return this._cooldownTimer > 0;
  }

  get config(): Readonly<XGestureConfig> {
    return this._config;
  }

  /**
   * 매 프레임 Pose 랜드마크 및 델타타임으로 X자 제스처 갱신
   * @param landmarks 33개 Pose 랜드마크 배열
   * @param dt 프레임 경과 시간 (초)
   */
  update(landmarks: readonly NormalizedLandmark[], dt: number): XGestureResult {
    // 쿨다운 타이머 감소
    if (this._cooldownTimer > 0) {
      this._cooldownTimer = Math.max(0, this._cooldownTimer - dt);
      if (this._cooldownTimer === 0) {
        this._holdTimer = 0;
      }
    }

    this._triggered = false;

    if (!landmarks || landmarks.length < 17) {
      this._isCrossing = false;
      this._holdTimer = 0;
      return this._buildResult();
    }

    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    if (!lShoulder || !rShoulder || !lWrist || !rWrist) {
      this._isCrossing = false;
      this._holdTimer = 0;
      return this._buildResult();
    }

    const minVis = this._config.minVisibility;
    if (
      (lShoulder.visibility ?? 1) < minVis ||
      (rShoulder.visibility ?? 1) < minVis ||
      (lWrist.visibility ?? 1) < minVis ||
      (rWrist.visibility ?? 1) < minVis
    ) {
      this._isCrossing = false;
      this._holdTimer = 0;
      return this._buildResult();
    }

    // 양 어깨 너비 (사용자 체형 및 카메라 거리 불변 기준 척도)
    const shoulderWidth = Math.hypot(
      rShoulder.x - lShoulder.x,
      rShoulder.y - lShoulder.y,
    );

    if (shoulderWidth <= 0.001) {
      this._isCrossing = false;
      this._holdTimer = 0;
      return this._buildResult();
    }

    // 왼손목 ↔ 오른쪽 어깨 거리
    const leftToRightDist = Math.hypot(
      lWrist.x - rShoulder.x,
      lWrist.y - rShoulder.y,
    );
    // 오른손목 ↔ 왼쪽 어깨 거리
    const rightToLeftDist = Math.hypot(
      rWrist.x - lShoulder.x,
      rWrist.y - lShoulder.y,
    );

    this._leftToRightDistRatio = leftToRightDist / shoulderWidth;
    this._rightToLeftDistRatio = rightToLeftDist / shoulderWidth;

    const maxDistRatio = this._config.crossThreshold;
    this._isCrossing =
      this._leftToRightDistRatio <= maxDistRatio &&
      this._rightToLeftDistRatio <= maxDistRatio;

    if (this._isCrossing) {
      if (this._cooldownTimer <= 0) {
        this._holdTimer += dt;
        if (this._holdTimer >= this._config.dwellTime) {
          this._triggered = true;
          this._holdTimer = this._config.dwellTime;
          this._cooldownTimer = this._config.cooldownTime;
        }
      }
    } else {
      this._holdTimer = 0;
    }

    return this._buildResult();
  }

  /** 전체 상태 초기화 */
  reset(): void {
    this._isCrossing = false;
    this._holdTimer = 0;
    this._cooldownTimer = 0;
    this._triggered = false;
    this._leftToRightDistRatio = 999;
    this._rightToLeftDistRatio = 999;
  }

  private _buildResult(): XGestureResult {
    return {
      isCrossing: this._isCrossing,
      progress: this.progress,
      triggered: this._triggered,
      inCooldown: this.inCooldown,
      leftToRightDistRatio: this._leftToRightDistRatio,
      rightToLeftDistRatio: this._rightToLeftDistRatio,
    };
  }
}
