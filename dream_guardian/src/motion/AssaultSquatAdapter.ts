/**
 * AssaultSquatAdapter.ts - 보스 접근전(Boss Assault) 보정 단위 일치 스쿼트 자세 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §8.2, §15.1-A3, §15.2-B6)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-10 / Issue #512)
 *
 * 절대 규칙:
 * 1. Motion 레이어 단일 책임: 보정 데이터와 포즈 증거를 기반으로 스쿼트(안전 자세) 상태와 직립 복귀(generation)를 보고한다.
 * 2. 정답 판정, HP 차감, 공격 성공/실패 확정은 일체 소유하지 않는다 (이는 #515 소유).
 * 3. 0~1 정규화 좌표계 단위를 엄격히 검증하며 픽셀 좌표 등 비정상 단위 혼용은 거부한다.
 * 4. 직립 복귀 때만 standGeneration을 1 증가시키고, 앉기 지속·경계 떨림·추적 상실 복구 시에는 증가하지 않는다.
 * 5. 새 requestAnimationFrame, setInterval, DOM 이벤트 리스너 등록 0회 (순수 모션 어댑터).
 * 6. 카메라 미지원 환경을 위한 키보드/가상 Fallback 입력을 지원한다.
 * 7. 입력 pose 불변성을 보장한다.
 */

import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import type { CalibrationBaseline } from './CalibrationHelper.js';

export type AssaultSquatPosture = 'standing' | 'ducking' | 'transition' | 'unknown';

export type AssaultSquatInvalidReason =
  | 'MISSING_BASELINE'
  | 'TRACKING_LOST'
  | 'INVALID_COORDINATE_UNITS'
  | 'LOW_CONFIDENCE'
  | 'NO_LANDMARKS';

export interface AssaultSquatBaselineInput {
  readonly hipY?: number;
  readonly shoulderY?: number;
  readonly noseY?: number;
  readonly shoulderWidth?: number;
}

export interface AssaultSquatAdapterConfig {
  /** 골반 하강 임계치 (정규화 단위, 기본 0.065) */
  readonly squatDropThreshold: number;
  /** 직립 복귀 임계치 (정규화 단위, 기본 0.035) */
  readonly squatStandThreshold: number;
  /** 최소 트래킹 신뢰도 */
  readonly minTrackingConfidence: number;
}

export interface AssaultSquatFrameInput {
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly landmarks?: readonly NormalizedLandmark[];
  readonly baseline?: CalibrationBaseline | AssaultSquatBaselineInput | null;
  readonly isTrackingLost?: boolean;
  readonly hipY?: number;
  readonly shoulderY?: number;
  readonly noseY?: number;
}

export interface AssaultSquatResult {
  readonly isValid: boolean;
  readonly posture: AssaultSquatPosture;
  readonly isDucking: boolean;
  readonly isStanding: boolean;
  readonly standGeneration: number;
  readonly deltaY: number;
  readonly normalizedCurrentY: number;
  readonly normalizedBaselineY: number;
  readonly timestampMs: number;
  readonly invalidReason?: AssaultSquatInvalidReason;
}

function isNormalizedCoord(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val) && val >= 0.0 && val <= 1.0;
}

export class AssaultSquatAdapter {
  private readonly _config: AssaultSquatAdapterConfig;
  private _baseline: CalibrationBaseline | AssaultSquatBaselineInput | null = null;
  private _standGeneration = 0;
  private _currentPosture: AssaultSquatPosture = 'unknown';
  private _isValid = false;
  private _wasDucking = false;
  private _trackingInterrupted = false;
  private _lastResult: AssaultSquatResult | null = null;

  constructor(customConfig?: Partial<AssaultSquatAdapterConfig>) {
    this._config = Object.freeze({
      squatDropThreshold:
        customConfig?.squatDropThreshold ?? DEFAULT_ASSAULT_INPUT_CONFIG.squatDropThreshold,
      squatStandThreshold:
        customConfig?.squatStandThreshold ?? DEFAULT_ASSAULT_INPUT_CONFIG.squatStandThreshold,
      minTrackingConfidence: customConfig?.minTrackingConfidence ?? 0.5,
    });
  }

  get standGeneration(): number {
    return this._standGeneration;
  }

  get isValid(): boolean {
    return this._isValid;
  }

  get isDucking(): boolean {
    return this._currentPosture === 'ducking';
  }

  get isStanding(): boolean {
    return this._currentPosture === 'standing';
  }

  get currentPosture(): AssaultSquatPosture {
    return this._currentPosture;
  }

  get lastResult(): AssaultSquatResult | null {
    return this._lastResult;
  }

  getConfig(): AssaultSquatAdapterConfig {
    return this._config;
  }

  setBaseline(baseline: CalibrationBaseline | AssaultSquatBaselineInput | null): void {
    this._baseline = baseline;
  }

  getBaseline(): CalibrationBaseline | AssaultSquatBaselineInput | null {
    return this._baseline;
  }

  reset(): void {
    this._standGeneration = 0;
    this._currentPosture = 'unknown';
    this._isValid = false;
    this._wasDucking = false;
    this._trackingInterrupted = false;
    this._lastResult = null;
  }

  /**
   * 프레임 단위 모션 업데이트 및 자세 판정
   */
  update(input: AssaultSquatFrameInput): AssaultSquatResult {
    const timestampMs = input.timestampMs;

    // 1. 기준선 갱신 (명시 전달 시)
    if (input.baseline !== undefined) {
      this._baseline = input.baseline;
    }

    // 2. 추적 상실 플래그 검사
    if (input.isTrackingLost) {
      return this._handleInvalid(timestampMs, 'TRACKING_LOST');
    }

    // 3. 캘리브레이션 기준선 존재 여부 검증
    if (!this._baseline) {
      return this._handleInvalid(timestampMs, 'MISSING_BASELINE');
    }

    // 4. 기준선 단위 정규화(0~1) 검증
    const baseline = this._baseline;
    if (
      (baseline.hipY !== undefined && !isNormalizedCoord(baseline.hipY)) ||
      (baseline.shoulderY !== undefined && !isNormalizedCoord(baseline.shoulderY)) ||
      (baseline.noseY !== undefined && !isNormalizedCoord(baseline.noseY))
    ) {
      return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
    }

    const baselineY = baseline.hipY ?? baseline.shoulderY ?? baseline.noseY;
    if (baselineY === undefined || !isNormalizedCoord(baselineY)) {
      return this._handleInvalid(timestampMs, 'MISSING_BASELINE');
    }

    // 5. 현재 좌표 추출 및 단위 검증
    let currentY: number | null = null;

    if (input.hipY !== undefined) {
      if (!isNormalizedCoord(input.hipY)) {
        return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
      }
      currentY = input.hipY;
    } else if (input.landmarks && input.landmarks.length > 0) {
      const leftHip = input.landmarks[POSE_LANDMARKS.LEFT_HIP];
      const rightHip = input.landmarks[POSE_LANDMARKS.RIGHT_HIP];

      if (leftHip && rightHip) {
        if (!isNormalizedCoord(leftHip.y) || !isNormalizedCoord(rightHip.y)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
        }

        const leftVis = leftHip.visibility ?? 1.0;
        const rightVis = rightHip.visibility ?? 1.0;
        if (leftVis < this._config.minTrackingConfidence || rightVis < this._config.minTrackingConfidence) {
          return this._handleInvalid(timestampMs, 'LOW_CONFIDENCE');
        }

        currentY = (leftHip.y + rightHip.y) / 2;
      } else {
        const leftShoulder = input.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = input.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (leftShoulder && rightShoulder) {
          if (!isNormalizedCoord(leftShoulder.y) || !isNormalizedCoord(rightShoulder.y)) {
            return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
          }
          currentY = (leftShoulder.y + rightShoulder.y) / 2;
        } else if (input.landmarks[POSE_LANDMARKS.NOSE]) {
          const nose = input.landmarks[POSE_LANDMARKS.NOSE];
          if (!isNormalizedCoord(nose.y)) {
            return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
          }
          currentY = nose.y;
        }
      }
    } else if (input.shoulderY !== undefined) {
      if (!isNormalizedCoord(input.shoulderY)) {
        return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
      }
      currentY = input.shoulderY;
    } else if (input.noseY !== undefined) {
      if (!isNormalizedCoord(input.noseY)) {
        return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
      }
      currentY = input.noseY;
    }

    if (currentY === null) {
      return this._handleInvalid(timestampMs, 'NO_LANDMARKS');
    }

    // 6. 하강값 deltaY 계산 (0이 상단, 1이 하단이므로 하강 시 currentY > baselineY)
    const deltaY = currentY - baselineY;
    this._isValid = true;

    // 7. 자세 및 직립 복귀 generation 갱신
    let posture: AssaultSquatPosture = 'transition';

    if (deltaY >= this._config.squatDropThreshold) {
      posture = 'ducking';
      this._wasDucking = true;
      this._trackingInterrupted = false;
    } else if (deltaY <= this._config.squatStandThreshold) {
      posture = 'standing';
      if (this._wasDucking && !this._trackingInterrupted) {
        this._standGeneration += 1;
      }
      this._wasDucking = false;
      this._trackingInterrupted = false;
    } else {
      posture = 'transition';
    }

    this._currentPosture = posture;

    const result: AssaultSquatResult = {
      isValid: true,
      posture,
      isDucking: posture === 'ducking',
      isStanding: posture === 'standing',
      standGeneration: this._standGeneration,
      deltaY,
      normalizedCurrentY: currentY,
      normalizedBaselineY: baselineY,
      timestampMs,
    };

    this._lastResult = result;
    return result;
  }

  /**
   * 키보드/터치 가상 Fallback 스쿼트 입력
   */
  setFallbackDucking(isDucking: boolean, timestampMs = 0): AssaultSquatResult {
    this._isValid = true;
    let posture: AssaultSquatPosture;

    if (isDucking) {
      posture = 'ducking';
      this._wasDucking = true;
      this._trackingInterrupted = false;
    } else {
      posture = 'standing';
      if (this._wasDucking && !this._trackingInterrupted) {
        this._standGeneration += 1;
      }
      this._wasDucking = false;
      this._trackingInterrupted = false;
    }

    this._currentPosture = posture;

    const result: AssaultSquatResult = {
      isValid: true,
      posture,
      isDucking: posture === 'ducking',
      isStanding: posture === 'standing',
      standGeneration: this._standGeneration,
      deltaY: isDucking ? this._config.squatDropThreshold : 0,
      normalizedCurrentY: isDucking ? 0.6 + this._config.squatDropThreshold : 0.6,
      normalizedBaselineY: 0.6,
      timestampMs,
    };

    this._lastResult = result;
    return result;
  }

  private _handleInvalid(timestampMs: number, reason: AssaultSquatInvalidReason): AssaultSquatResult {
    this._isValid = false;
    this._trackingInterrupted = true;
    this._currentPosture = 'unknown';

    const result: AssaultSquatResult = {
      isValid: false,
      posture: 'unknown',
      isDucking: false,
      isStanding: false,
      standGeneration: this._standGeneration,
      deltaY: 0,
      normalizedCurrentY: 0,
      normalizedBaselineY: 0,
      timestampMs,
      invalidReason: reason,
    };

    this._lastResult = result;
    return result;
  }
}
