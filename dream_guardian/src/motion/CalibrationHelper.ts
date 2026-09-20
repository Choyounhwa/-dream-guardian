/**
 * CalibrationHelper - 사용자 신체 기준선 자동 보정
 *
 * 코 가이드 박스 2초 대기 → 어깨 Y 기준선 측정
 * 달리기/스쿼트/점프 판정의 기준값을 제공
 *
 * @see Issue #11 (GitHub #76)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';

/** 보정에 필요한 최소 대기 시간 (초) */
const CALIBRATION_DURATION = 2.0;

export type CalibrationStatus = 'waiting' | 'calibrating' | 'done';

export class CalibrationHelper {
  private _status: CalibrationStatus = 'waiting';
  private _baselineShoulderY = 0;
  private _baselineHipY = 0;
  private _elapsed = 0;
  private _samples: { shoulderY: number; hipY: number }[] = [];
  private _calibrationDuration: number;

  constructor(calibrationDuration = CALIBRATION_DURATION) {
    this._calibrationDuration = calibrationDuration;
  }

  get status(): CalibrationStatus {
    return this._status;
  }

  /** 보정된 어깨 Y 기준선 */
  get baselineShoulderY(): number {
    return this._baselineShoulderY;
  }

  /** 보정된 엉덩이 Y 기준선 */
  get baselineHipY(): number {
    return this._baselineHipY;
  }

  /** 보정 완료 여부 */
  get isDone(): boolean {
    return this._status === 'done';
  }

  /** 보정 진행률 (0~1) */
  get progress(): number {
    if (this._status === 'done') return 1;
    return Math.min(this._elapsed / this._calibrationDuration, 1);
  }

  /**
   * 매 프레임 호출: 코가 가이드 박스 안에 있으면 보정 진행
   */
  update(dt: number, landmarks: readonly NormalizedLandmark[]): void {
    if (this._status === 'done') return;

    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    if (!nose || !lShoulder || !rShoulder || !lHip || !rHip) return;
    if (nose.visibility < 0.5 || lShoulder.visibility < 0.5 || rShoulder.visibility < 0.5) return;

    this._status = 'calibrating';
    this._elapsed += dt;

    const shoulderY = (lShoulder.y + rShoulder.y) / 2;
    const hipY = (lHip.y + rHip.y) / 2;

    this._samples.push({ shoulderY, hipY });

    if (this._elapsed >= this._calibrationDuration) {
      // 평균 산출
      let sumSY = 0;
      let sumHY = 0;
      for (const s of this._samples) {
        sumSY += s.shoulderY;
        sumHY += s.hipY;
      }
      this._baselineShoulderY = sumSY / this._samples.length;
      this._baselineHipY = sumHY / this._samples.length;
      this._status = 'done';
    }
  }

  /** 보정 초기화 */
  reset(): void {
    this._status = 'waiting';
    this._baselineShoulderY = 0;
    this._baselineHipY = 0;
    this._elapsed = 0;
    this._samples = [];
  }
}
