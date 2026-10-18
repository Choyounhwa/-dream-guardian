/**
 * AssaultJumpAdapter.ts - 보스 접근전(Boss Assault) 점프 및 저충격(heel_raise) 동작 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.5, 8.3, 15.3, A18, A19)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-28 / Issue #530)
 *
 * 절대 규칙:
 * 1. Motion 레이어 단일 책임:
 *    - 기준선 대비 상승/착지 모션 증거를 정규화하여 점프(공중) 상태와 착지 복귀(landGeneration)를 보고한다.
 *    - 판정창, HP 직접 차감, 피해 계산, effects는 일체 소유하지 않는다 (순수 모션 어댑터).
 * 2. 승인 저충격 대체 동작(heel_raise) 분리 보존:
 *    - 실제 점프와 승인 저충격 증거(heel_raise 등)를 동일 동작 계약으로 정규화한다.
 *    - accessibilityProfileId 및 motionKind를 보존하여 실제 점프와 대체를 명확히 구별(혼합 금지).
 * 3. 단일 발화 및 중복 방지 (A18, A19):
 *    - 착지/복귀 시에만 landGeneration을 1 증가시킨다.
 *    - 공중 체류(holding), 경계 떨림(transition), 추적 상실/복구 시에는 generation이 증가하지 않는다.
 * 4. 0~1 정규화 좌표계 단위를 엄격히 검증하며 픽셀 좌표 등 비정상 단위 혼용은 거부한다.
 * 5. 새 requestAnimationFrame, setInterval, DOM 이벤트 리스너 등록 0회 (순수 모션 어댑터).
 * 6. 카메라 미지원 환경을 위한 키보드/가상 Fallback(isJumpingKey) 입력을 지원한다.
 * 7. 입력 pose/landmarks 불변성을 보장한다.
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import type { CalibrationBaseline } from './CalibrationHelper.js';

export type AssaultJumpPosture = 'standing' | 'jumping' | 'transition' | 'unknown';

export type AssaultJumpMotionKind = 'real_jump' | 'low_impact' | 'fallback';

export type AssaultJumpInvalidReason =
  | 'MISSING_BASELINE'
  | 'TRACKING_LOST'
  | 'INVALID_COORDINATE_UNITS'
  | 'LOW_CONFIDENCE'
  | 'NO_LANDMARKS'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_SESSION';

export interface AssaultJumpBaselineInput {
  readonly shoulderY?: number;
  readonly shoulderX?: number;
  readonly shoulderWidth?: number;
  readonly hipY?: number;
  readonly noseY?: number;
  readonly ankleY?: number;
  readonly heelY?: number;
}

export interface AssaultJumpAdapterConfig {
  /** 실제 점프 상승 임계치 (정규화 단위, 기본 0.065) */
  readonly jumpThreshold: number;
  /** 착지/복귀 임계치 (정규화 단위, 기본 0.035) */
  readonly landThreshold: number;
  /** 저충격(heel_raise) 상승 임계치 (정규화 단위, 기본 0.035) */
  readonly lowImpactThreshold: number;
  /** 최소 트래킹 신뢰도 (기본 0.5) */
  readonly minTrackingConfidence: number;
}

export interface AssaultJumpFrameInput {
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly landmarks?: readonly NormalizedLandmark[];
  readonly baseline?: CalibrationBaseline | AssaultJumpBaselineInput | null;
  readonly isTrackingLost?: boolean;
  readonly shoulderY?: number;
  readonly hipY?: number;
  readonly heelY?: number;
  readonly ankleY?: number;
  readonly isJumpingKey?: boolean;
  readonly isLowImpact?: boolean;
  readonly inputId?: string;
  readonly sessionId?: string;
  readonly accessibilityProfileId?: string;
}

export interface AssaultJumpResult {
  readonly posture: AssaultJumpPosture;
  readonly isJumping: boolean;
  readonly isStanding: boolean;
  readonly landGeneration: number;
  readonly jumpGeneration: number;
  readonly isValid: boolean;
  readonly invalidReason?: AssaultJumpInvalidReason;
  readonly motionKind: AssaultJumpMotionKind;
  readonly accessibilityProfileId?: string;
  readonly timestampMs: number;
  readonly inputId?: string;
  readonly sessionId?: string;
  readonly deltaY: number;
  readonly normalizedCurrentY: number;
  readonly normalizedBaselineY: number;
}

const DEFAULT_JUMP_ADAPTER_CONFIG: AssaultJumpAdapterConfig = Object.freeze({
  jumpThreshold: 0.065,
  landThreshold: 0.035,
  lowImpactThreshold: 0.035,
  minTrackingConfidence: 0.5,
});

function isNormalizedCoord(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val) && val >= 0.0 && val <= 1.0;
}

export class AssaultJumpAdapter {
  private readonly _config: AssaultJumpAdapterConfig;
  private _baseline: CalibrationBaseline | AssaultJumpBaselineInput | null = null;
  private _landGeneration = 0;
  private _currentPosture: AssaultJumpPosture = 'unknown';
  private _wasJumping = false;
  private _trackingInterrupted = false;
  private _sessionId: string | null = null;
  private _lastResult: AssaultJumpResult | null = null;

  constructor(customConfig?: Partial<AssaultJumpAdapterConfig>) {
    this._config = Object.freeze({
      jumpThreshold: customConfig?.jumpThreshold ?? DEFAULT_JUMP_ADAPTER_CONFIG.jumpThreshold,
      landThreshold: customConfig?.landThreshold ?? DEFAULT_JUMP_ADAPTER_CONFIG.landThreshold,
      lowImpactThreshold: customConfig?.lowImpactThreshold ?? DEFAULT_JUMP_ADAPTER_CONFIG.lowImpactThreshold,
      minTrackingConfidence:
        customConfig?.minTrackingConfidence ?? DEFAULT_JUMP_ADAPTER_CONFIG.minTrackingConfidence,
    });
  }

  public get config(): AssaultJumpAdapterConfig {
    return this._config;
  }

  public get landGeneration(): number {
    return this._landGeneration;
  }

  public get jumpGeneration(): number {
    return this._landGeneration;
  }

  public get currentPosture(): AssaultJumpPosture {
    return this._currentPosture;
  }

  public get sessionId(): string | null {
    return this._sessionId;
  }

  public get lastResult(): AssaultJumpResult | null {
    return this._lastResult;
  }

  /**
   * 세션 및 내부 상태 초기화
   */
  public reset(sessionId?: string): void {
    this._landGeneration = 0;
    this._currentPosture = 'unknown';
    this._wasJumping = false;
    this._trackingInterrupted = false;
    this._sessionId = sessionId ?? null;
    this._lastResult = null;
    this._baseline = null;
  }

  public setBaseline(baseline: CalibrationBaseline | AssaultJumpBaselineInput | null): void {
    this._baseline = baseline;
  }

  /**
   * 프레임별 모션/입력 판정 (processFrame alias)
   */
  public update(input: AssaultJumpFrameInput): AssaultJumpResult {
    return this.processFrame(input);
  }

  /**
   * 프레임별 모션/입력 판정
   */
  public processFrame(input: AssaultJumpFrameInput): AssaultJumpResult {
    const { timestampMs } = input;

    // 1. 타임스탬프 유효성 검사
    if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs) || timestampMs < 0) {
      return this._handleInvalid(timestampMs ?? 0, 'INVALID_TIMESTAMP', input);
    }

    // 2. 세션 일관성 검사
    if (this._sessionId !== null && input.sessionId !== undefined && input.sessionId !== this._sessionId) {
      return this._handleInvalid(timestampMs, 'INVALID_SESSION', input);
    }
    if (this._sessionId === null && input.sessionId !== undefined) {
      this._sessionId = input.sessionId;
    }

    // 3. Fallback (가상/키보드 입력) 우선 처리
    if (input.isJumpingKey !== undefined) {
      const isDown = input.isJumpingKey === true;
      let posture: AssaultJumpPosture;
      if (isDown) {
        posture = 'jumping';
        this._wasJumping = true;
      } else {
        posture = 'standing';
        if (this._wasJumping) {
          if (!this._trackingInterrupted) {
            this._landGeneration++;
          }
          this._wasJumping = false;
        }
        this._trackingInterrupted = false;
      }
      this._currentPosture = posture;

      const result: AssaultJumpResult = Object.freeze({
        posture,
        isJumping: posture === 'jumping',
        isStanding: posture === 'standing',
        landGeneration: this._landGeneration,
        jumpGeneration: this._landGeneration,
        isValid: true,
        motionKind: 'fallback',
        accessibilityProfileId: input.accessibilityProfileId ?? 'fallback',
        timestampMs,
        inputId: input.inputId,
        sessionId: input.sessionId ?? (this._sessionId ?? undefined),
        deltaY: isDown ? this._config.jumpThreshold : 0,
        normalizedCurrentY: isDown ? 0.5 - this._config.jumpThreshold : 0.5,
        normalizedBaselineY: 0.5,
      });
      this._lastResult = result;
      return result;
    }

    // 4. 카메라 트래킹 상실 검사 (A19)
    if (input.isTrackingLost) {
      this._trackingInterrupted = true;
      this._wasJumping = false;
      this._currentPosture = 'unknown';
      return this._handleInvalid(timestampMs, 'TRACKING_LOST', input);
    }

    // 5. 기준선(Baseline) 갱신 및 유효성 검사
    if (input.baseline !== undefined) {
      this._baseline = input.baseline;
    }
    const baseline = this._baseline;
    if (!baseline) {
      return this._handleInvalid(timestampMs, 'MISSING_BASELINE', input);
    }

    const baselineInput = baseline as AssaultJumpBaselineInput;
    const baseHeelY = 'heelY' in baseline ? baselineInput.heelY : undefined;
    const baseAnkleY = 'ankleY' in baseline ? baselineInput.ankleY : undefined;
    const baseShoulderY = baseline.shoulderY;
    const baseHipY = baseline.hipY;
    const baseNoseY = baseline.noseY;

    // 베이스라인 좌표 단위 검증 (정규화 0~1)
    if (
      (baseShoulderY !== undefined && !isNormalizedCoord(baseShoulderY)) ||
      (baseHipY !== undefined && !isNormalizedCoord(baseHipY)) ||
      (baseNoseY !== undefined && !isNormalizedCoord(baseNoseY)) ||
      (baseHeelY !== undefined && !isNormalizedCoord(baseHeelY)) ||
      (baseAnkleY !== undefined && !isNormalizedCoord(baseAnkleY))
    ) {
      return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
    }

    // 6. 모션 종류 및 접근성 프로필 결정
    const isLowImpact =
      input.isLowImpact === true ||
      input.accessibilityProfileId === 'heel_raise' ||
      (input.accessibilityProfileId !== undefined && input.accessibilityProfileId.includes('low_impact'));

    const motionKind: AssaultJumpMotionKind = isLowImpact ? 'low_impact' : 'real_jump';
    const accessibilityProfileId: string | undefined = isLowImpact
      ? (input.accessibilityProfileId ?? 'heel_raise')
      : (input.accessibilityProfileId === 'real_jump' ? undefined : input.accessibilityProfileId);

    // 7. 현재 좌표(currentY) 및 베이스라인(baselineY) 추출
    let currentY: number | null = null;
    let baselineY: number | null = null;

    if (isLowImpact) {
      if (input.heelY !== undefined) {
        if (!isNormalizedCoord(input.heelY)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
        }
        currentY = input.heelY;
        baselineY = baseHeelY ?? baseAnkleY ?? baseShoulderY ?? baseHipY ?? null;
      } else if (input.ankleY !== undefined) {
        if (!isNormalizedCoord(input.ankleY)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
        }
        currentY = input.ankleY;
        baselineY = baseAnkleY ?? baseHeelY ?? baseShoulderY ?? baseHipY ?? null;
      } else if (input.shoulderY !== undefined) {
        if (!isNormalizedCoord(input.shoulderY)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
        }
        currentY = input.shoulderY;
        baselineY = baseShoulderY ?? baseHipY ?? baseNoseY ?? null;
      } else if (input.landmarks && input.landmarks.length > 0) {
        const leftHeel = input.landmarks[POSE_LANDMARKS.LEFT_HEEL];
        const rightHeel = input.landmarks[POSE_LANDMARKS.RIGHT_HEEL];
        if (leftHeel && rightHeel && baseHeelY !== undefined) {
          if (!isNormalizedCoord(leftHeel.y) || !isNormalizedCoord(rightHeel.y)) {
            return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
          }
          const leftVis = leftHeel.visibility ?? 1.0;
          const rightVis = rightHeel.visibility ?? 1.0;
          if (leftVis < this._config.minTrackingConfidence || rightVis < this._config.minTrackingConfidence) {
            return this._handleInvalid(timestampMs, 'LOW_CONFIDENCE', input);
          }
          currentY = (leftHeel.y + rightHeel.y) / 2;
          baselineY = baseHeelY;
        } else {
          const leftShoulder = input.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
          const rightShoulder = input.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
          if (leftShoulder && rightShoulder) {
            if (!isNormalizedCoord(leftShoulder.y) || !isNormalizedCoord(rightShoulder.y)) {
              return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
            }
            const leftVis = leftShoulder.visibility ?? 1.0;
            const rightVis = rightShoulder.visibility ?? 1.0;
            if (leftVis < this._config.minTrackingConfidence || rightVis < this._config.minTrackingConfidence) {
              return this._handleInvalid(timestampMs, 'LOW_CONFIDENCE', input);
            }
            currentY = (leftShoulder.y + rightShoulder.y) / 2;
            baselineY = baseShoulderY ?? baseHipY ?? baseNoseY ?? null;
          }
        }
      }
    } else {
      if (input.shoulderY !== undefined) {
        if (!isNormalizedCoord(input.shoulderY)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
        }
        currentY = input.shoulderY;
        baselineY = baseShoulderY ?? baseHipY ?? baseNoseY ?? null;
      } else if (input.hipY !== undefined) {
        if (!isNormalizedCoord(input.hipY)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
        }
        currentY = input.hipY;
        baselineY = baseHipY ?? baseShoulderY ?? null;
      } else if (input.landmarks && input.landmarks.length > 0) {
        const leftShoulder = input.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = input.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (leftShoulder && rightShoulder) {
          if (!isNormalizedCoord(leftShoulder.y) || !isNormalizedCoord(rightShoulder.y)) {
            return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS', input);
          }
          const leftVis = leftShoulder.visibility ?? 1.0;
          const rightVis = rightShoulder.visibility ?? 1.0;
          if (leftVis < this._config.minTrackingConfidence || rightVis < this._config.minTrackingConfidence) {
            return this._handleInvalid(timestampMs, 'LOW_CONFIDENCE', input);
          }
          currentY = (leftShoulder.y + rightShoulder.y) / 2;
          baselineY = baseShoulderY ?? baseHipY ?? baseNoseY ?? null;
        }
      }
    }

    if (currentY === null) {
      return this._handleInvalid(timestampMs, 'NO_LANDMARKS', input);
    }

    if (baselineY === null || !isNormalizedCoord(baselineY)) {
      return this._handleInvalid(timestampMs, 'MISSING_BASELINE', input);
    }

    // 8. 상승량 계산 및 자세 상태 전이
    // Y축: 0이 상단, 1이 하단이므로 상승(점프/힐레이즈)은 baselineY - currentY > 0
    const deltaY = baselineY - currentY;
    const threshold = isLowImpact ? this._config.lowImpactThreshold : this._config.jumpThreshold;

    if (deltaY >= threshold) {
      this._currentPosture = 'jumping';
      this._wasJumping = true;
    } else if (deltaY <= this._config.landThreshold) {
      if (this._wasJumping) {
        if (!this._trackingInterrupted) {
          this._landGeneration++;
        }
        this._wasJumping = false;
      }
      this._currentPosture = 'standing';
      this._trackingInterrupted = false;
    } else {
      this._currentPosture = 'transition';
    }

    const result: AssaultJumpResult = Object.freeze({
      posture: this._currentPosture,
      isJumping: this._currentPosture === 'jumping',
      isStanding: this._currentPosture === 'standing',
      landGeneration: this._landGeneration,
      jumpGeneration: this._landGeneration,
      isValid: true,
      motionKind,
      accessibilityProfileId,
      timestampMs,
      inputId: input.inputId,
      sessionId: input.sessionId ?? (this._sessionId ?? undefined),
      deltaY,
      normalizedCurrentY: currentY,
      normalizedBaselineY: baselineY,
    });
    this._lastResult = result;
    return result;
  }

  private _handleInvalid(
    timestampMs: number,
    reason: AssaultJumpInvalidReason,
    input?: AssaultJumpFrameInput,
  ): AssaultJumpResult {
    const isLowImpact =
      input?.isLowImpact === true ||
      input?.accessibilityProfileId === 'heel_raise' ||
      (input?.accessibilityProfileId !== undefined && input.accessibilityProfileId.includes('low_impact'));
    const motionKind: AssaultJumpMotionKind =
      input?.isJumpingKey !== undefined ? 'fallback' : isLowImpact ? 'low_impact' : 'real_jump';

    const result: AssaultJumpResult = Object.freeze({
      posture:
        this._currentPosture === 'jumping' && reason !== 'TRACKING_LOST' ? this._currentPosture : 'unknown',
      isJumping: false,
      isStanding: false,
      landGeneration: this._landGeneration,
      jumpGeneration: this._landGeneration,
      isValid: false,
      invalidReason: reason,
      motionKind,
      accessibilityProfileId: isLowImpact ? (input?.accessibilityProfileId ?? 'heel_raise') : undefined,
      timestampMs,
      inputId: input?.inputId,
      sessionId: input?.sessionId ?? (this._sessionId ?? undefined),
      deltaY: 0,
      normalizedCurrentY: 0,
      normalizedBaselineY: 0,
    });
    this._lastResult = result;
    return result;
  }
}
