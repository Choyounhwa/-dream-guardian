/**
 * AssaultGuardAdapter.ts - 보스 접근전(Boss Assault) 스쿼트 회피 저충격 대체 동작 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§8.3, 15.3-C6, A25, A31)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-44 / Issue #547)
 *
 * 절대 규칙:
 * 1. Motion 레이어 단일 책임:
 *    - DEC-C6 승인 동작인 양팔 가드(Dual-Arm Guard)를 기반으로 스쿼트와 동일한
 *      회피 판정 계약(안전 자세 구간 + 복귀 generation)을 만족하는 저충격 대체 모션을 판정한다.
 *    - 정답 판정, HP 직접 차감, 공격 성공/실패 확정은 일체 소유하지 않는다 (순수 모션 어댑터).
 * 2. DEC-C6 양팔 가드 및 X자 상호 무간섭 (DOC-14 §15.3-C6, A25):
 *    - `DEFAULT_ASSAULT_INPUT_CONFIG.guardWristDistanceRatio`(0.8) 소비.
 *    - 양 손목 간 거리가 어깨너비 * guardWristDistanceRatio 이하이고 얼굴/가슴 높이일 때 가드 안전 자세로 판정.
 *    - 기존 X자 일시정지 제스처와 간섭 없는 영역 판정 (대각 어깨 교차 시 가드 배제).
 * 3. #515 AssaultSquatJudge 호환 회피 계약:
 *    - `isDucking`, `standGeneration`, `isValid`와 100% 호환되는 인터페이스 출력.
 *    - 가드 해제(복귀) 시점에만 `standGeneration` 1 증가.
 *    - 가드 지속(holding), 경계 떨림, 추적 상실/복구 시에는 generation 증가 0회.
 * 4. 접근성 프로필 식별자 보존 (A31):
 *    - `accessibilityProfileId: 'dual_arm_guard'`를 결과 이벤트에 보존하여 #546 운동량 집계에서 실제 스쿼트와 분리.
 * 5. 런타임 제약:
 *    - 새 requestAnimationFrame, setInterval, DOM 이벤트 리스너 등록 0회.
 *    - 입력 pose/landmarks 불변 보장.
 *    - 카메라 미지원 환경을 위한 키보드/가상 Fallback 지원.
 */

import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import type { CalibrationBaseline } from './CalibrationHelper.js';
import type {
  AssaultSquatPosture,
  AssaultSquatResult,
  AssaultSquatInvalidReason,
} from './AssaultSquatAdapter.js';

export type AssaultGuardPosture = 'guarding' | 'relaxed' | 'standing' | 'transition' | 'unknown';

export type AssaultGuardInvalidReason =
  | 'MISSING_BASELINE'
  | 'TRACKING_LOST'
  | 'INVALID_COORDINATE_UNITS'
  | 'LOW_CONFIDENCE'
  | 'NO_LANDMARKS'
  | 'X_GESTURE_COLLISION';

export interface AssaultGuardBaselineInput {
  readonly hipY?: number;
  readonly shoulderY?: number;
  readonly noseY?: number;
  readonly shoulderWidth?: number;
}

export interface AssaultGuardAdapterConfig {
  /** 양팔 가드 손목 거리 비율 (어깨너비 대비, 기본 0.8) */
  readonly guardWristDistanceRatio: number;
  /** 가드 해제 이완 임계 비율 (어깨너비 대비, 기본 0.9) */
  readonly releaseWristDistanceRatio: number;
  /** 최소 트래킹 신뢰도 */
  readonly minTrackingConfidence: number;
  /** 접근성 프로필 식별자 (A31) */
  readonly accessibilityProfileId: 'dual_arm_guard';
  /** X자 교차 판정 임계치 (어깨너비 대비 비율) */
  readonly xCrossThreshold: number;
}

export interface AssaultGuardFrameInput {
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly landmarks?: readonly NormalizedLandmark[];
  readonly baseline?: CalibrationBaseline | AssaultGuardBaselineInput | null;
  readonly isTrackingLost?: boolean;
  /** 카메라 미지원 환경 가상/키보드 Fallback 입력 */
  readonly isGuarding?: boolean;
  readonly leftWrist?: { readonly x: number; readonly y: number };
  readonly rightWrist?: { readonly x: number; readonly y: number };
  readonly shoulderWidth?: number;
  readonly shoulderY?: number;
  readonly noseY?: number;
  readonly hipY?: number;
}

export interface AssaultGuardResult {
  readonly isValid: boolean;
  readonly posture: AssaultGuardPosture;
  readonly isGuarding: boolean;
  readonly isSafe: boolean;
  /** #515 AssaultSquatJudge 호환 플래그 (isGuarding과 동일) */
  readonly isDucking: boolean;
  /** #515 AssaultSquatJudge 호환 플래그 (isRelaxed와 동일) */
  readonly isStanding: boolean;
  readonly isRelaxed: boolean;
  readonly standGeneration: number;
  readonly accessibilityProfileId: 'dual_arm_guard';
  readonly wristDistanceRatio: number;
  readonly timestampMs: number;
  readonly invalidReason?: AssaultGuardInvalidReason;
  // #515 AssaultSquatResult 구조적 호환 필드
  readonly deltaY?: number;
  readonly normalizedCurrentY?: number;
  readonly normalizedBaselineY?: number;
}

function isNormalizedCoord(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val) && val >= 0.0 && val <= 1.0;
}

/** 대각 어깨 교차(X자 제스처) 여부 판정 */
function isXCrossing(
  lWrist: { x: number; y: number },
  rWrist: { x: number; y: number },
  lShoulder: { x: number; y: number },
  rShoulder: { x: number; y: number },
  shoulderWidth: number,
  crossThreshold: number,
): boolean {
  if (shoulderWidth <= 0.001) return false;
  const leftToRight = Math.hypot(lWrist.x - rShoulder.x, lWrist.y - rShoulder.y) / shoulderWidth;
  const rightToLeft = Math.hypot(rWrist.x - lShoulder.x, rWrist.y - lShoulder.y) / shoulderWidth;
  return leftToRight <= crossThreshold && rightToLeft <= crossThreshold;
}

export class AssaultGuardAdapter {
  private readonly _config: AssaultGuardAdapterConfig;
  private _baseline: CalibrationBaseline | AssaultGuardBaselineInput | null = null;
  private _standGeneration = 0;
  private _currentPosture: AssaultGuardPosture = 'unknown';
  private _isValid = false;
  private _wasGuarding = false;
  private _trackingInterrupted = false;
  private _lastResult: AssaultGuardResult | null = null;

  constructor(customConfig?: Partial<AssaultGuardAdapterConfig>) {
    this._config = Object.freeze({
      guardWristDistanceRatio:
        customConfig?.guardWristDistanceRatio ?? DEFAULT_ASSAULT_INPUT_CONFIG.guardWristDistanceRatio,
      releaseWristDistanceRatio:
        customConfig?.releaseWristDistanceRatio ?? 0.9,
      minTrackingConfidence:
        customConfig?.minTrackingConfidence ?? 0.5,
      accessibilityProfileId: 'dual_arm_guard',
      xCrossThreshold: customConfig?.xCrossThreshold ?? 0.55,
    });
  }

  get config(): Readonly<AssaultGuardAdapterConfig> {
    return this._config;
  }

  get standGeneration(): number {
    return this._standGeneration;
  }

  get isGuarding(): boolean {
    return this._currentPosture === 'guarding';
  }

  get isDucking(): boolean {
    return this.isGuarding;
  }

  get isStanding(): boolean {
    return this._currentPosture === 'standing' || this._currentPosture === 'relaxed';
  }

  get isValid(): boolean {
    return this._isValid;
  }

  get currentPosture(): AssaultGuardPosture {
    return this._currentPosture;
  }

  get lastResult(): AssaultGuardResult | null {
    return this._lastResult;
  }

  /**
   * 캘리브레이션 베이스라인 설정
   */
  setBaseline(baseline: CalibrationBaseline | AssaultGuardBaselineInput | null): void {
    this._baseline = baseline;
  }

  /**
   * 프레임별 모션/입력 판정 업데이트
   */
  update(input: AssaultGuardFrameInput): AssaultGuardResult {
    const timestampMs = input.timestampMs;

    // 1. 추적 상실 플래그 검증
    if (input.isTrackingLost) {
      return this._handleInvalid(timestampMs, 'TRACKING_LOST');
    }

    // 2. 가상/키보드 Fallback 입력 우선 처리
    if (input.isGuarding !== undefined) {
      this._isValid = true;
      const posture: AssaultGuardPosture = input.isGuarding ? 'guarding' : 'relaxed';

      if (input.isGuarding) {
        this._wasGuarding = true;
        this._trackingInterrupted = false;
      } else {
        if (this._wasGuarding && !this._trackingInterrupted) {
          this._standGeneration++;
          this._wasGuarding = false;
        }
        this._trackingInterrupted = false;
      }

      this._currentPosture = posture;
      return this._buildResult(timestampMs, posture, input.isGuarding ? 0.5 : 1.0, true);
    }

    // 3. 베이스라인 유효성 검증
    const baseline = input.baseline ?? this._baseline;
    if (!baseline) {
      return this._handleInvalid(timestampMs, 'MISSING_BASELINE');
    }

    // 4. 랜드마크 추출 및 좌표 검증
    let lWrist: { x: number; y: number } | null = null;
    let rWrist: { x: number; y: number } | null = null;
    let lShoulder: { x: number; y: number } | null = null;
    let rShoulder: { x: number; y: number } | null = null;
    let noseY: number | null = null;
    let hipY: number | null = null;

    if (input.landmarks && input.landmarks.length > 0) {
      if (input.landmarks.length < 17) {
        return this._handleInvalid(timestampMs, 'NO_LANDMARKS');
      }

      const leftWristLm = input.landmarks[POSE_LANDMARKS.LEFT_WRIST];
      const rightWristLm = input.landmarks[POSE_LANDMARKS.RIGHT_WRIST];
      const leftShoulderLm = input.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rightShoulderLm = input.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
      const noseLm = input.landmarks[POSE_LANDMARKS.NOSE];
      const leftHipLm = input.landmarks[POSE_LANDMARKS.LEFT_HIP];
      const rightHipLm = input.landmarks[POSE_LANDMARKS.RIGHT_HIP];

      if (!leftWristLm || !rightWristLm || !leftShoulderLm || !rightShoulderLm) {
        return this._handleInvalid(timestampMs, 'NO_LANDMARKS');
      }

      // 단위 검증 (0~1 범위 확인)
      const coordsToCheck = [
        leftWristLm.x, leftWristLm.y,
        rightWristLm.x, rightWristLm.y,
        leftShoulderLm.x, leftShoulderLm.y,
        rightShoulderLm.x, rightShoulderLm.y,
      ];
      for (const c of coordsToCheck) {
        if (!isNormalizedCoord(c)) {
          return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
        }
      }

      // 가시성/신뢰도 검증
      const confThreshold = this._config.minTrackingConfidence;
      const visibilities = [
        leftWristLm.visibility ?? 1.0,
        rightWristLm.visibility ?? 1.0,
        leftShoulderLm.visibility ?? 1.0,
        rightShoulderLm.visibility ?? 1.0,
      ];
      for (const v of visibilities) {
        if (v < confThreshold) {
          return this._handleInvalid(timestampMs, 'LOW_CONFIDENCE');
        }
      }

      lWrist = { x: leftWristLm.x, y: leftWristLm.y };
      rWrist = { x: rightWristLm.x, y: rightWristLm.y };
      lShoulder = { x: leftShoulderLm.x, y: leftShoulderLm.y };
      rShoulder = { x: rightShoulderLm.x, y: rightShoulderLm.y };

      if (noseLm && isNormalizedCoord(noseLm.y)) {
        noseY = noseLm.y;
      }
      if (leftHipLm && rightHipLm && isNormalizedCoord(leftHipLm.y) && isNormalizedCoord(rightHipLm.y)) {
        hipY = (leftHipLm.y + rightHipLm.y) / 2;
      }
    } else if (input.leftWrist && input.rightWrist) {
      if (
        !isNormalizedCoord(input.leftWrist.x) || !isNormalizedCoord(input.leftWrist.y) ||
        !isNormalizedCoord(input.rightWrist.x) || !isNormalizedCoord(input.rightWrist.y)
      ) {
        return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
      }
      lWrist = input.leftWrist;
      rWrist = input.rightWrist;
    }

    if (!lWrist || !rWrist) {
      return this._handleInvalid(timestampMs, 'NO_LANDMARKS');
    }

    // 5. 어깨 너비 및 기준 높이 계산
    let shoulderWidth = input.shoulderWidth ?? baseline.shoulderWidth;
    let shoulderY = input.shoulderY ?? baseline.shoulderY;

    if (lShoulder && rShoulder) {
      shoulderWidth = Math.hypot(rShoulder.x - lShoulder.x, rShoulder.y - lShoulder.y);
      shoulderY = (lShoulder.y + rShoulder.y) / 2;
    }

    if (!shoulderWidth || shoulderWidth <= 0.001) {
      return this._handleInvalid(timestampMs, 'INVALID_COORDINATE_UNITS');
    }

    const refShoulderY = shoulderY ?? 0.35;
    const refNoseY = noseY ?? input.noseY ?? baseline.noseY ?? (refShoulderY - shoulderWidth * 0.6);
    const refHipY = hipY ?? input.hipY ?? baseline.hipY ?? (refShoulderY + shoulderWidth * 1.0);

    // 6. X자 일시정지 제스처 상호 배타성 검사 (DEC-C6 / A25)
    if (lShoulder && rShoulder) {
      if (isXCrossing(lWrist, rWrist, lShoulder, rShoulder, shoulderWidth, this._config.xCrossThreshold)) {
        // X자 교차 제스처 상태이므로 가드로 판정하지 않음
        this._isValid = true;
        return this._buildResult(timestampMs, 'relaxed', 1.0, false);
      }
    }

    // 7. 양 손목 간 거리 및 높이 판정
    const wristDist = Math.hypot(rWrist.x - lWrist.x, rWrist.y - lWrist.y);
    const wristDistRatio = wristDist / shoulderWidth;

    // 높이 조건: 얼굴/가슴 높이 (머리 위 만세 및 골반/허리 아래 배제)
    const topLimit = refNoseY - 0.08;
    const bottomLimit = refHipY - 0.05;

    const isHeightValid =
      lWrist.y >= topLimit && lWrist.y <= bottomLimit &&
      rWrist.y >= topLimit && rWrist.y <= bottomLimit;

    // 8. 자세 판정 및 standGeneration 갱신
    this._isValid = true;
    let posture: AssaultGuardPosture = 'transition';

    if (isHeightValid && wristDistRatio <= this._config.guardWristDistanceRatio) {
      posture = 'guarding';
      this._wasGuarding = true;
      this._trackingInterrupted = false;
    } else if (!isHeightValid || wristDistRatio >= this._config.releaseWristDistanceRatio) {
      posture = 'relaxed';
      if (this._wasGuarding && !this._trackingInterrupted) {
        this._standGeneration++;
        this._wasGuarding = false;
      }
      this._trackingInterrupted = false;
    } else {
      posture = 'transition';
    }

    this._currentPosture = posture;
    return this._buildResult(timestampMs, posture, wristDistRatio, true);
  }

  /**
   * AssaultSquatJudge (#515) 계약 호환 DTO 변환
   */
  toSquatResult(result: AssaultGuardResult): AssaultSquatResult {
    const squatPosture: AssaultSquatPosture = result.isGuarding
      ? 'ducking'
      : result.isStanding
        ? 'standing'
        : result.posture === 'transition'
          ? 'transition'
          : 'unknown';

    return Object.freeze({
      isValid: result.isValid,
      posture: squatPosture,
      isDucking: result.isDucking,
      isStanding: result.isStanding,
      standGeneration: result.standGeneration,
      deltaY: result.isGuarding ? 0.2 : 0.0,
      normalizedCurrentY: result.isGuarding ? 0.8 : 0.6,
      normalizedBaselineY: 0.6,
      timestampMs: result.timestampMs,
      invalidReason: result.invalidReason as AssaultSquatInvalidReason | undefined,
    });
  }

  /**
   * 어댑터 상태 초기화
   */
  reset(): void {
    this._standGeneration = 0;
    this._currentPosture = 'unknown';
    this._isValid = false;
    this._wasGuarding = false;
    this._trackingInterrupted = false;
    this._lastResult = null;
  }

  private _buildResult(
    timestampMs: number,
    posture: AssaultGuardPosture,
    wristDistRatio: number,
    isValid: boolean,
    invalidReason?: AssaultGuardInvalidReason,
  ): AssaultGuardResult {
    const isGuard = posture === 'guarding';
    const isStand = posture === 'relaxed' || posture === 'standing';

    const result: AssaultGuardResult = Object.freeze({
      isValid,
      posture,
      isGuarding: isGuard,
      isSafe: isGuard,
      isDucking: isGuard,
      isStanding: isStand,
      isRelaxed: isStand,
      standGeneration: this._standGeneration,
      accessibilityProfileId: 'dual_arm_guard',
      wristDistanceRatio: Number.isFinite(wristDistRatio) ? wristDistRatio : 1.0,
      timestampMs,
      invalidReason,
      deltaY: isGuard ? 0.2 : 0.0,
      normalizedCurrentY: isGuard ? 0.8 : 0.6,
      normalizedBaselineY: 0.6,
    });

    this._lastResult = result;
    return result;
  }

  private _handleInvalid(timestampMs: number, reason: AssaultGuardInvalidReason): AssaultGuardResult {
    this._isValid = false;
    if (reason === 'TRACKING_LOST' || reason === 'LOW_CONFIDENCE' || reason === 'NO_LANDMARKS') {
      this._trackingInterrupted = true;
    }
    this._currentPosture = 'unknown';
    return this._buildResult(timestampMs, 'unknown', 1.0, false, reason);
  }
}
