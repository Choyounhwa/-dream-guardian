/**
 * SkeletonAnimation - 보간(lerp) 및 호흡 펄스 효과
 *
 * 랜드마크 좌표의 부드러운 보간 + 주기적 호흡 스케일 변화
 *
 * @see Issue #9 (GitHub #74)
 */

import type { NormalizedLandmark } from '../types/index.js';

export interface SkeletonAnimationOptions {
  /** 보간 계수 (0~1, 1이면 즉시 이동) */
  lerpFactor?: number;
  /** 호흡 펄스 주기 (초) */
  breathCycle?: number;
  /** 호흡 진폭 (스케일 배수, 예: 0.02 = 2%) */
  breathAmplitude?: number;
}

export class SkeletonAnimation {
  private _lerpFactor: number;
  private _breathCycle: number;
  private _breathAmplitude: number;
  private _smoothed: NormalizedLandmark[] = [];
  private _breathTime = 0;
  private _currentBreathScale = 1;

  constructor(options?: SkeletonAnimationOptions) {
    this._lerpFactor = options?.lerpFactor ?? 0.3;
    this._breathCycle = options?.breathCycle ?? 3.0;
    this._breathAmplitude = options?.breathAmplitude ?? 0.02;
  }

  /** 현재 보간된 랜드마크 */
  get smoothedLandmarks(): readonly NormalizedLandmark[] {
    return this._smoothed;
  }

  /** 현재 호흡 스케일 (1.0 ± amplitude) */
  get breathScale(): number {
    return this._currentBreathScale;
  }

  /**
   * 매 프레임 호출: 랜드마크 보간 + 호흡 스케일 갱신
   */
  update(dt: number, targetLandmarks: readonly NormalizedLandmark[]): void {
    // 호흡 펄스
    this._breathTime += dt;
    this._currentBreathScale =
      1.0 + Math.sin((this._breathTime / this._breathCycle) * Math.PI * 2) * this._breathAmplitude;

    // 첫 프레임이면 즉시 복사
    if (this._smoothed.length !== targetLandmarks.length) {
      this._smoothed = targetLandmarks.map((lm) => ({ ...lm }));
      return;
    }

    // 보간(lerp)
    const f = this._lerpFactor;
    for (let i = 0; i < targetLandmarks.length; i++) {
      const target = targetLandmarks[i];
      const current = this._smoothed[i];

      current.x += (target.x - current.x) * f;
      current.y += (target.y - current.y) * f;
      current.z += (target.z - current.z) * f;
      current.visibility = target.visibility; // visibility는 즉시 반영
    }
  }

  /** 보간 상태 초기화 */
  reset(): void {
    this._smoothed = [];
    this._breathTime = 0;
    this._currentBreathScale = 1;
  }
}
