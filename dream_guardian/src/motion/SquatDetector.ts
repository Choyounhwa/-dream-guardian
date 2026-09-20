/**
 * SquatDetector - 스쿼트 방어 감지
 *
 * 어깨 Y가 기준선 대비 squatThreshold(0.065) 이상 하강 시 스쿼트 판정
 *
 * @see Issue #11 (GitHub #76)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import { DEFAULT_CONFIG } from '../core/Config.js';

export class SquatDetector {
  private _isSquatting = false;
  private _squatCount = 0;
  private _wasSquatting = false;
  private _threshold: number;

  constructor(threshold = DEFAULT_CONFIG.motion.squatThreshold) {
    this._threshold = threshold;
  }

  get isSquatting(): boolean {
    return this._isSquatting;
  }

  get squatCount(): number {
    return this._squatCount;
  }

  /**
   * 매 프레임 호출
   * @param landmarks 가상 좌표 랜드마크
   * @param baselineY 보정된 어깨 기준선 Y (가상 좌표)
   * @param virtualHeight 가상 뷰포트 높이 (임계값 스케일링)
   * @returns 이번 프레임에서 스쿼트가 새로 시작되었는지
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    baselineY: number,
    virtualHeight: number,
  ): boolean {
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    if (!lShoulder || !rShoulder) {
      this._isSquatting = false;
      return false;
    }
    if (lShoulder.visibility < 0.5 || rShoulder.visibility < 0.5) {
      this._isSquatting = false;
      return false;
    }

    const currentY = (lShoulder.y + rShoulder.y) / 2;
    const drop = currentY - baselineY; // Y 증가 = 하강 (캔버스 좌표계)
    const threshold = this._threshold * virtualHeight;

    this._isSquatting = drop > threshold;

    // 스쿼트 시작 감지 (엣지 트리거)
    let started = false;
    if (this._isSquatting && !this._wasSquatting) {
      this._squatCount++;
      started = true;
    }
    this._wasSquatting = this._isSquatting;

    return started;
  }

  reset(): void {
    this._isSquatting = false;
    this._squatCount = 0;
    this._wasSquatting = false;
  }
}
