/**
 * CenterReturnGate - 비트 전환 중앙 복귀 게이트 및 개인 기준점 잠금
 *
 * 6~7박: 중앙 복귀 네온 게이트 표시 및 플레이어 중심 복귀 유도
 * 8박: 안정 중앙 프레임들의 중앙값(median)으로 개인 기준점(hipX, headX, shoulderWidth) 잠금
 * 최대 2박 연장 대기 (CENTER_RETRY), 만료 시 fallback 기준점 강제 잠금 (TIMEOUT)
 *
 * @see Issue #178 [CENTER-RETURN-001]
 * @see Issue #176 [BEAT-SPEC-001]
 */

import {
  DEFAULT_CENTER_RETURN_CONFIG,
  type CenterReturnConfig,
} from '../../config/beat-motion.config.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';

export type CenterGateStatus =
  | 'idle'
  | 'seeking'
  | 'stable'
  | 'locked'
  | 'retry'
  | 'timeout';

export type CenterAnchorSource = 'hip' | 'auxiliary' | 'fallback' | 'none';

/**
 * 8박 라운드 개인 중심 기준점 (인메모리 전용 런타임 모델)
 */
export interface RoundCenterReference {
  /** 골반 중심 X 좌표 (정규화 0~1) */
  hipX: number;
  /** 머리(코) 중심 X 좌표 (정규화 0~1) */
  headX: number;
  /** 개인 어깨 너비 (정규화 0~1) */
  shoulderWidth: number;
  /** 잠금 시점 엔진 타임스탬프 (초) */
  lockedAtTime?: number;
  /** 타임아웃 강제 기본값 여부 */
  isFallback: boolean;
  /** 중앙값 산출에 사용된 안정 프레임 수 */
  sampleCount: number;
  /** 기준점 산출 앵커 소스 */
  source: 'hip' | 'auxiliary' | 'fallback';
}

/**
 * 중앙 복귀 게이트 프레임 갱신 결과
 */
export interface CenterGateUpdateResult {
  status: CenterGateStatus;
  isLocked: boolean;
  isInsideGate: boolean;
  isStable: boolean;
  currentCenterX: number | null;
  reference: RoundCenterReference | null;
  anchorSource: CenterAnchorSource;
}

/**
 * 안정 프레임 샘플 데이터
 */
interface CenterSample {
  hipX: number;
  headX: number;
  shoulderWidth: number;
  source: 'hip' | 'auxiliary';
}

const EPSILON = 1e-5;

/**
 * 수치 배열의 수학적 중앙값(Median) 계산
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export class CenterReturnGate {
  private readonly _config: CenterReturnConfig;

  private _status: CenterGateStatus = 'idle';
  private _isOpen = false;
  private _isLocked = false;
  private _isStable = false;
  private _isTrackingLost = false;

  private _elapsedTime = 0;
  private _stableTime = 0;
  private _currentCenterX: number | null = null;
  private _roundIndex = 0;

  private _samples: CenterSample[] = [];
  private _reference: RoundCenterReference | null = null;

  constructor(config?: Partial<CenterReturnConfig>) {
    this._config = {
      ...DEFAULT_CENTER_RETURN_CONFIG,
      ...config,
      defaultFallbackReference: {
        ...DEFAULT_CENTER_RETURN_CONFIG.defaultFallbackReference,
        ...config?.defaultFallbackReference,
      },
    };
  }

  get config(): CenterReturnConfig {
    return this._config;
  }

  get status(): CenterGateStatus {
    return this._status;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get isLocked(): boolean {
    return this._isLocked;
  }

  get isInsideGate(): boolean {
    return (
      this._currentCenterX !== null &&
      Math.abs(this._currentCenterX - this._config.targetX) <= this._config.toleranceX
    );
  }

  get isStable(): boolean {
    return this._isStable;
  }

  get isRetrying(): boolean {
    return this._status === 'retry';
  }

  get isTimedOut(): boolean {
    return this._status === 'timeout';
  }

  get isTrackingLost(): boolean {
    return this._isTrackingLost;
  }

  get reference(): RoundCenterReference | null {
    return this._reference;
  }

  get currentCenterX(): number | null {
    return this._currentCenterX;
  }

  get stableTime(): number {
    return this._stableTime;
  }

  get sampleCount(): number {
    return this._samples.length;
  }

  get elapsedTime(): number {
    return this._elapsedTime;
  }

  get roundIndex(): number {
    return this._roundIndex;
  }

  /**
   * 게이트 활성화 (새 라운드 시작)
   */
  open(options?: { roundIndex?: number }): void {
    this._isOpen = true;
    this._isLocked = false;
    this._isStable = false;
    this._isTrackingLost = false;
    this._status = 'seeking';
    this._reference = null;
    this._stableTime = 0;
    this._elapsedTime = 0;
    this._samples = [];
    this._currentCenterX = null;

    if (options?.roundIndex !== undefined) {
      this._roundIndex = options.roundIndex;
    }
  }

  /**
   * 게이트 닫기 (idle 전환)
   */
  close(): void {
    this._isOpen = false;
    this._status = 'idle';
    this._samples = [];
    this._stableTime = 0;
  }

  /**
   * 게이트 전체 상태 리셋
   */
  reset(): void {
    this.close();
    this._isLocked = false;
    this._reference = null;
    this._elapsedTime = 0;
    this._currentCenterX = null;
    this._roundIndex = 0;
  }

  /**
   * 랜드마크 기반 신체 중심 앵커 평가
   * 골반 중심 우선 → 신뢰도 부족 시 머리+어깨 보조 앵커
   */
  private _evaluateAnchor(landmarks?: readonly NormalizedLandmark[] | null): {
    centerX: number | null;
    headX: number;
    shoulderWidth: number;
    source: CenterAnchorSource;
  } {
    const fallback = this._config.defaultFallbackReference;

    if (!landmarks || landmarks.length === 0) {
      return {
        centerX: null,
        headX: fallback.headX,
        shoulderWidth: fallback.shoulderWidth,
        source: 'none',
      };
    }

    const minVis = this._config.minVisibility;
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const nose = landmarks[POSE_LANDMARKS.NOSE];

    const hasHip = Boolean(
      lHip &&
      rHip &&
      lHip.visibility >= minVis &&
      rHip.visibility >= minVis,
    );

    const hasShoulders = Boolean(
      lShoulder &&
      rShoulder &&
      lShoulder.visibility >= minVis &&
      rShoulder.visibility >= minVis,
    );

    const hasNose = Boolean(nose && nose.visibility >= minVis);

    // 1. 골반 신뢰도가 충분할 때 (Primary Anchor)
    if (hasHip && lHip && rHip) {
      const hipX = (lHip.x + rHip.x) / 2;
      const shoulderWidth = hasShoulders && lShoulder && rShoulder
        ? Math.abs(rShoulder.x - lShoulder.x)
        : fallback.shoulderWidth;
      const headX = hasNose && nose
        ? nose.x
        : (hasShoulders && lShoulder && rShoulder
            ? (lShoulder.x + rShoulder.x) / 2
            : hipX);

      return {
        centerX: hipX,
        headX,
        shoulderWidth,
        source: 'hip',
      };
    }

    // 2. 골반 신뢰도 부족 시 머리+어깨 보조 앵커 (Auxiliary Anchor)
    if (hasShoulders && hasNose && lShoulder && rShoulder && nose) {
      const shoulderCenterX = (lShoulder.x + rShoulder.x) / 2;
      const auxCenterX = (nose.x + shoulderCenterX) / 2;
      const shoulderWidth = Math.abs(rShoulder.x - lShoulder.x);

      return {
        centerX: auxCenterX,
        headX: nose.x,
        shoulderWidth,
        source: 'auxiliary',
      };
    }

    if (hasShoulders && lShoulder && rShoulder) {
      const shoulderCenterX = (lShoulder.x + rShoulder.x) / 2;
      const shoulderWidth = Math.abs(rShoulder.x - lShoulder.x);

      return {
        centerX: shoulderCenterX,
        headX: shoulderCenterX,
        shoulderWidth,
        source: 'auxiliary',
      };
    }

    if (hasNose && nose) {
      return {
        centerX: nose.x,
        headX: nose.x,
        shoulderWidth: fallback.shoulderWidth,
        source: 'auxiliary',
      };
    }

    // 3. 모든 랜드마크 신뢰도 부족 (Tracking Lost)
    return {
      centerX: null,
      headX: fallback.headX,
      shoulderWidth: fallback.shoulderWidth,
      source: 'none',
    };
  }

  /**
   * 매 프레임 업데이트 호출
   */
  update(
    dt: number,
    landmarks?: readonly NormalizedLandmark[] | null,
  ): CenterGateUpdateResult {
    if (!this._isOpen) {
      return {
        status: this._status,
        isLocked: this._isLocked,
        isInsideGate: false,
        isStable: false,
        currentCenterX: null,
        reference: this._reference,
        anchorSource: 'none',
      };
    }

    this._elapsedTime += dt;
    const anchor = this._evaluateAnchor(landmarks);

    // 이미 잠긴 경우: 최초 잠긴 기준점을 불변 유지하고 현재 위치만 보고
    if (this._isLocked) {
      const isInside =
        anchor.centerX !== null &&
        Math.abs(anchor.centerX - this._config.targetX) <= this._config.toleranceX;

      return {
        status: this._status,
        isLocked: true,
        isInsideGate: isInside,
        isStable: true,
        currentCenterX: anchor.centerX,
        reference: this._reference,
        anchorSource: anchor.source,
      };
    }

    // 미잠금 상태의 추적 및 안정도 평가
    if (anchor.source === 'none' || anchor.centerX === null) {
      this._isTrackingLost = true;
      this._currentCenterX = null;
      this._stableTime = 0;
      this._samples = [];
      this._isStable = false;
    } else {
      this._isTrackingLost = false;
      this._currentCenterX = anchor.centerX;

      const isInside =
        Math.abs(anchor.centerX - this._config.targetX) <= this._config.toleranceX;

      if (isInside) {
        this._stableTime += dt;
        this._samples.push({
          hipX: anchor.centerX,
          headX: anchor.headX,
          shoulderWidth: anchor.shoulderWidth,
          source: anchor.source === 'hip' ? 'hip' : 'auxiliary',
        });

        if (
          this._stableTime >= this._config.stabilityDuration - EPSILON &&
          this._samples.length >= this._config.minSamples
        ) {
          this._isStable = true;
          if (this._config.autoLock) {
            this.lock();
          }
        }
      } else {
        // 중앙 게이트 외부 (흔들림 / 이탈) -> 안정 누적 즉시 초기화
        this._stableTime = 0;
        this._samples = [];
        this._isStable = false;
      }
    }

    // 타임아웃 및 재시도 상태 전이 검사 (아직 잠기지 않은 경우)
    if (!this._isLocked) {
      const totalTimeout =
        this._config.standardDuration + this._config.maxExtensionDuration;

      if (this._elapsedTime >= totalTimeout - EPSILON) {
        // 최대 연장 만료: fallback 강제 잠금 및 timeout 상태 전이
        this.forceFallbackLock();
      } else if (this._elapsedTime >= this._config.standardDuration - EPSILON) {
        // 표준 2박 경과: retry 상태 전이
        this._status = 'retry';
      } else {
        this._status = this._isStable ? 'stable' : 'seeking';
      }
    }

    const isInsideGate =
      this._currentCenterX !== null &&
      Math.abs(this._currentCenterX - this._config.targetX) <= this._config.toleranceX;

    return {
      status: this._status,
      isLocked: this._isLocked,
      isInsideGate,
      isStable: this._isStable,
      currentCenterX: this._currentCenterX,
      reference: this._reference,
      anchorSource: anchor.source,
    };
  }

  /**
   * 안정 프레임들의 중앙값(median)으로 RoundCenterReference 잠금
   * 안정 조건 미충족 시(샘플 부족 또는 중앙 이탈) 잠금하지 않고 null 반환
   */
  lock(): RoundCenterReference | null {
    if (this._isLocked && this._reference) {
      return this._reference;
    }

    if (this._samples.length < this._config.minSamples) {
      return null;
    }

    const medianHipX = calculateMedian(this._samples.map((s) => s.hipX));
    const medianHeadX = calculateMedian(this._samples.map((s) => s.headX));
    const medianSW = calculateMedian(this._samples.map((s) => s.shoulderWidth));

    const hipCount = this._samples.filter((s) => s.source === 'hip').length;
    const source: 'hip' | 'auxiliary' =
      hipCount >= this._samples.length / 2 ? 'hip' : 'auxiliary';

    this._reference = {
      hipX: medianHipX,
      headX: medianHeadX,
      shoulderWidth: medianSW,
      lockedAtTime: this._elapsedTime,
      isFallback: false,
      sampleCount: this._samples.length,
      source,
    };

    this._isLocked = true;
    this._status = 'locked';
    return this._reference;
  }

  /**
   * 타임아웃 또는 비상 시 기본 기준점 강제 잠금 (단일 루프 무중단 보장)
   */
  forceFallbackLock(): RoundCenterReference {
    if (this._isLocked && this._reference) {
      return this._reference;
    }

    const fallback = this._config.defaultFallbackReference;
    this._reference = {
      hipX: fallback.hipX,
      headX: fallback.headX,
      shoulderWidth: fallback.shoulderWidth,
      lockedAtTime: this._elapsedTime,
      isFallback: true,
      sampleCount: 0,
      source: 'fallback',
    };

    this._isLocked = true;
    this._status = 'timeout';
    return this._reference;
  }
}
