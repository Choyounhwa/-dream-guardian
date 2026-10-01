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

/**
 * 캘리브레이션 완료 시 산출되는 신체 기준선 좌표 모음
 * (RC-3 해결: PartGate 판정의 기준선으로 활용)
 */
export interface CalibrationBaseline {
  noseX: number;
  noseY: number;
  shoulderX: number;
  shoulderY: number;
  shoulderWidth: number;
  hipX: number;
  hipY: number;
  maxReachDistance?: number;
  jitterVariance?: number;
}

export class CalibrationHelper {
  private _status: CalibrationStatus = 'waiting';
  private _baselineShoulderY = 0;
  private _baselineHipY = 0;
  private _baselineNoseX = 0;
  private _baselineNoseY = 0;
  private _baselineShoulderX = 0;
  private _baselineShoulderWidth = 0;
  private _baselineHipX = 0;
  private _baselineMaxReachDistance = 0;
  private _baselineJitterVariance = 0;
  private _elapsed = 0;
  private _samples: {
    noseX: number;
    noseY: number;
    shoulderX: number;
    shoulderY: number;
    shoulderWidth: number;
    hipX: number;
    hipY: number;
    reachDist: number;
  }[] = [];
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

  /** 보정된 코 X 기준선 */
  get baselineNoseX(): number {
    return this._baselineNoseX;
  }

  /** 보정된 코 Y 기준선 */
  get baselineNoseY(): number {
    return this._baselineNoseY;
  }

  /** 보정된 어깨 너비 기준선 */
  get baselineShoulderWidth(): number {
    return this._baselineShoulderWidth;
  }

  /** 보정된 어깨 X 기준선 */
  get baselineShoulderX(): number {
    return this._baselineShoulderX;
  }

  /** 보정된 골반 X 기준선 */
  get baselineHipX(): number {
    return this._baselineHipX;
  }

  /** 통합 기준선 객체 (미완료 시 null) */
  get baseline(): CalibrationBaseline | null {
    if (this._status !== 'done') return null;
    return {
      noseX: this._baselineNoseX,
      noseY: this._baselineNoseY,
      shoulderX: this._baselineShoulderX,
      shoulderY: this._baselineShoulderY,
      shoulderWidth: this._baselineShoulderWidth,
      hipX: this._baselineHipX,
      hipY: this._baselineHipY,
      maxReachDistance: this._baselineMaxReachDistance || 0.35,
      jitterVariance: this._baselineJitterVariance || 0.0001,
    };
  }

  /**
   * 기준선 객체 조회 (실패 또는 미완료 시 기본값으로 안전 폴백, Issue #254)
   */
  getBaseline(): CalibrationBaseline {
    if (this._status !== 'done') {
      return {
        noseX: 0.5,
        noseY: 0.3,
        shoulderX: 0.5,
        shoulderY: 0.4,
        shoulderWidth: 0.25,
        hipX: 0.5,
        hipY: 0.7,
        maxReachDistance: 0.35,
        jitterVariance: 0.0001,
      };
    }
    return {
      noseX: this._baselineNoseX,
      noseY: this._baselineNoseY,
      shoulderX: this._baselineShoulderX,
      shoulderY: this._baselineShoulderY,
      shoulderWidth: this._baselineShoulderWidth || 0.25,
      hipX: this._baselineHipX,
      hipY: this._baselineHipY,
      maxReachDistance: this._baselineMaxReachDistance || 0.35,
      jitterVariance: this._baselineJitterVariance || 0.0001,
    };
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

    const noseX = nose.x;
    const noseY = nose.y;
    const shoulderX = (lShoulder.x + rShoulder.x) / 2;
    const shoulderY = (lShoulder.y + rShoulder.y) / 2;
    const shoulderWidth = Math.abs(rShoulder.x - lShoulder.x);
    const hipX = (lHip.x + rHip.x) / 2;
    const hipY = (lHip.y + rHip.y) / 2;

    const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    let reachDist = 0;
    if (lWrist && (lWrist.visibility ?? 0) >= 0.5) {
      reachDist = Math.max(reachDist, Math.hypot(lWrist.x - shoulderX, lWrist.y - shoulderY));
    }
    if (rWrist && (rWrist.visibility ?? 0) >= 0.5) {
      reachDist = Math.max(reachDist, Math.hypot(rWrist.x - shoulderX, rWrist.y - shoulderY));
    }

    this._samples.push({ noseX, noseY, shoulderX, shoulderY, shoulderWidth, hipX, hipY, reachDist });

    if (this._elapsed >= this._calibrationDuration && this._samples.length > 0) {
      // 평균 산출
      let sumNX = 0;
      let sumNY = 0;
      let sumSX = 0;
      let sumSY = 0;
      let sumSW = 0;
      let sumHX = 0;
      let sumHY = 0;
      let maxR = 0;

      for (const s of this._samples) {
        sumNX += s.noseX;
        sumNY += s.noseY;
        sumSX += s.shoulderX;
        sumSY += s.shoulderY;
        sumSW += s.shoulderWidth;
        sumHX += s.hipX;
        sumHY += s.hipY;
        if (s.reachDist > maxR) maxR = s.reachDist;
      }

      const count = this._samples.length;
      this._baselineNoseX = sumNX / count;
      this._baselineNoseY = sumNY / count;
      this._baselineShoulderX = sumSX / count;
      this._baselineShoulderY = sumSY / count;
      this._baselineShoulderWidth = sumSW / count;
      this._baselineHipX = sumHX / count;
      this._baselineHipY = sumHY / count;
      this._baselineMaxReachDistance = maxR > 0 ? maxR : 0.35;

      const varX = this._samples.reduce((acc, s) => acc + (s.noseX - this._baselineNoseX) ** 2, 0) / count;
      const varY = this._samples.reduce((acc, s) => acc + (s.noseY - this._baselineNoseY) ** 2, 0) / count;
      this._baselineJitterVariance = varX + varY;

      this._status = 'done';
    }
  }

  /** 수동 기준선 설정 (테스트 및 빠른 초기화 지원) */
  setManualBaseline(baseline: Partial<CalibrationBaseline>): void {
    if (baseline.shoulderY !== undefined) this._baselineShoulderY = baseline.shoulderY;
    if (baseline.hipY !== undefined) this._baselineHipY = baseline.hipY;
    if (baseline.noseX !== undefined) this._baselineNoseX = baseline.noseX;
    if (baseline.noseY !== undefined) this._baselineNoseY = baseline.noseY;
    if (baseline.shoulderX !== undefined) this._baselineShoulderX = baseline.shoulderX;
    if (baseline.shoulderWidth !== undefined) this._baselineShoulderWidth = baseline.shoulderWidth;
    if (baseline.hipX !== undefined) this._baselineHipX = baseline.hipX;
    if (baseline.maxReachDistance !== undefined) this._baselineMaxReachDistance = baseline.maxReachDistance;
    if (baseline.jitterVariance !== undefined) this._baselineJitterVariance = baseline.jitterVariance;
    this._status = 'done';
  }

  /** 보정 초기화 */
  reset(): void {
    this._status = 'waiting';
    this._baselineShoulderY = 0;
    this._baselineHipY = 0;
    this._baselineNoseX = 0;
    this._baselineNoseY = 0;
    this._baselineShoulderX = 0;
    this._baselineShoulderWidth = 0;
    this._baselineHipX = 0;
    this._baselineMaxReachDistance = 0;
    this._baselineJitterVariance = 0;
    this._elapsed = 0;
    this._samples = [];
  }
}
