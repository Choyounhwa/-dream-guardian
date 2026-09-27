/**
 * AnswerZoneSelector - 골반/머리 상대 이동 기반 좌우 정답존 선택기
 *
 * 8박 루프 중 답안 단계(1~k박)에서 RoundCenterReference 대비 신체 상대 변위를 계산하여
 * 좌/우(A/B) 정답을 확정하는 입력 처리기.
 *
 * - 골반 우선, 골반 신뢰도 부족 시 머리와 어깨가 같은 방향으로 이동한 경우만 보조 입력 허용
 * - 진입 0.42 x shoulderWidth, 취소 0.30 x shoulderWidth (히스테리시스)
 * - 0.5초(BPM 120 1박) 체류 확정
 * - 미러(좌우 반전) 좌표계 지원
 *
 * @see Issue #179 [ANSWER-ZONE-001]
 * @see Issue #176 [BEAT-SPEC-001]
 */

import {
  DEFAULT_ANSWER_ZONE_CONFIG,
  type AnswerZoneConfig,
} from '../../config/beat-motion.config.js';
import type { RoundCenterReference } from '../motion/CenterReturnGate.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';

export type AnswerZone = 'left' | 'right' | 'none';

export type AnswerAnchorSource = 'hip' | 'auxiliary' | 'fallback' | 'none';

export interface AnswerZoneState {
  /** 현재 조준 중인 정답존 */
  activeZone: AnswerZone;
  /** 최종 확정된 정답존 ('none'이면 미확정) */
  confirmedZone: AnswerZone;
  /** 정답 확정 여부 */
  isConfirmed: boolean;
  /** 체류 진행률 (0.0 ~ 1.0) */
  dwellProgress: number;
  /** 누적 체류 시간 (초) */
  dwellTime: number;
  /** 기준점 대비 상대 변위 (화면 좌표계: 좌 < 0, 우 > 0) */
  dx: number;
  /** 진입 임계값 거리 (entryRatio * shoulderWidth) */
  entryThreshold: number;
  /** 취소 임계값 거리 (cancelRatio * shoulderWidth) */
  cancelThreshold: number;
  /** 판정 앵커 소스 */
  anchorSource: AnswerAnchorSource;
  /** 센서/추적 유실 여부 */
  isTrackingLost: boolean;
  /** 기준점 존재 여부 */
  hasReference: boolean;
}

const EPSILON = 1e-5;

export class AnswerZoneSelector {
  private readonly _config: AnswerZoneConfig;

  private _reference: RoundCenterReference | null = null;
  private _activeZone: AnswerZone = 'none';
  private _confirmedZone: AnswerZone = 'none';
  private _isConfirmed = false;
  private _dwellTime = 0;
  private _dx = 0;
  private _anchorSource: AnswerAnchorSource = 'none';
  private _isTrackingLost = false;

  constructor(config?: Partial<AnswerZoneConfig>) {
    this._config = {
      ...DEFAULT_ANSWER_ZONE_CONFIG,
      ...config,
    };
  }

  get config(): AnswerZoneConfig {
    return this._config;
  }

  get isConfirmed(): boolean {
    return this._isConfirmed;
  }

  get confirmedZone(): AnswerZone {
    return this._confirmedZone;
  }

  get activeZone(): AnswerZone {
    return this._activeZone;
  }

  get dwellProgress(): number {
    if (this._isConfirmed) return 1.0;
    if (this._config.dwellDuration <= 0) return 0;
    return Math.min(this._dwellTime / this._config.dwellDuration, 1.0);
  }

  get state(): AnswerZoneState {
    const sw = this._reference && this._reference.shoulderWidth > 0
      ? this._reference.shoulderWidth
      : 0.20;

    return {
      activeZone: this._activeZone,
      confirmedZone: this._confirmedZone,
      isConfirmed: this._isConfirmed,
      dwellProgress: this.dwellProgress,
      dwellTime: this._dwellTime,
      dx: this._dx,
      entryThreshold: this._config.entryRatio * sw,
      cancelThreshold: this._config.cancelRatio * sw,
      anchorSource: this._anchorSource,
      isTrackingLost: this._isTrackingLost,
      hasReference: this._reference !== null,
    };
  }

  /**
   * 라운드 중앙 기준점 주입 (매 라운드 8박 시점 획득값)
   */
  setReference(ref: RoundCenterReference | null): void {
    this._reference = ref;
  }

  getReference(): RoundCenterReference | null {
    return this._reference;
  }

  /**
   * 화면 렌더링 좌표계 변환 (미러 여부 반영)
   */
  private _toScreenX(rawX: number): number {
    return this._config.isMirrored ? 1 - rawX : rawX;
  }

  /**
   * 매 프레임 업데이트 호출
   */
  update(
    dt: number,
    landmarks?: readonly NormalizedLandmark[] | null,
  ): AnswerZoneState {
    // 1. 기준점이 없으면 답안 선택 불가
    if (!this._reference) {
      this._activeZone = 'none';
      this._dwellTime = 0;
      this._dx = 0;
      return this.state;
    }

    // 2. 이미 확정된 경우 결과 번복 방지 (단 1회 확정 보장)
    if (this._isConfirmed) {
      return this.state;
    }

    const sw = this._reference.shoulderWidth > 0
      ? this._reference.shoulderWidth
      : 0.20;
    const entryThreshold = this._config.entryRatio * sw;
    const cancelThreshold = this._config.cancelRatio * sw;

    // 3. 센서 끊김 / 추적 유실 처리
    if (!landmarks || landmarks.length === 0) {
      this._isTrackingLost = true;
      this._activeZone = 'none';
      this._dwellTime = 0;
      this._dx = 0;
      this._anchorSource = 'none';
      return this.state;
    }

    const minVis = this._config.minVisibility;
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    const hasHip = Boolean(
      lHip &&
      rHip &&
      lHip.visibility >= minVis &&
      rHip.visibility >= minVis,
    );

    let evaluatedDx = 0;
    let source: AnswerAnchorSource = 'none';

    if (hasHip && lHip && rHip) {
      // 1순위: 골반 중심 변위
      const hipX = (lHip.x + rHip.x) / 2;
      const currentScreenHipX = this._toScreenX(hipX);
      const refScreenHipX = this._toScreenX(this._reference.hipX);

      evaluatedDx = currentScreenHipX - refScreenHipX;
      source = 'hip';
      this._isTrackingLost = false;
    } else {
      // 2순위: 머리+어깨 동방향 보조 입력 평가
      const nose = landmarks[POSE_LANDMARKS.NOSE];
      const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

      const hasHead = Boolean(nose && nose.visibility >= minVis);
      const hasShoulders = Boolean(
        lShoulder &&
        rShoulder &&
        lShoulder.visibility >= minVis &&
        rShoulder.visibility >= minVis,
      );

      if (hasHead && hasShoulders && nose && lShoulder && rShoulder) {
        this._isTrackingLost = false;

        const currentScreenHeadX = this._toScreenX(nose.x);
        const refScreenHeadX = this._toScreenX(this._reference.headX);
        const dxHead = currentScreenHeadX - refScreenHeadX;

        const shoulderCenterX = (lShoulder.x + rShoulder.x) / 2;
        const currentScreenShoulderX = this._toScreenX(shoulderCenterX);
        const refScreenShoulderX = this._toScreenX(this._reference.headX);
        const dxShoulder = currentScreenShoulderX - refScreenShoulderX;

        // 머리와 어깨가 같은 방향으로 충분히 이동한 경우만 보조 입력으로 인정
        const isSameDirectionLeft =
          dxHead <= -cancelThreshold + EPSILON &&
          dxShoulder <= -cancelThreshold + EPSILON;

        const isSameDirectionRight =
          dxHead >= cancelThreshold - EPSILON &&
          dxShoulder >= cancelThreshold - EPSILON;

        if (isSameDirectionLeft || isSameDirectionRight) {
          evaluatedDx = (dxHead + dxShoulder) / 2;
          source = 'auxiliary';
        } else {
          evaluatedDx = 0;
          source = 'none';
        }
      } else {
        this._isTrackingLost = true;
        evaluatedDx = 0;
        source = 'none';
      }
    }

    this._dx = evaluatedDx;
    this._anchorSource = source;

    // 4. 히스테리시스 상태 전이 및 체류 시간 계산
    if (this._activeZone === 'none') {
      if (this._dx <= -entryThreshold + EPSILON) {
        this._activeZone = 'left';
        this._dwellTime = dt;
      } else if (this._dx >= entryThreshold - EPSILON) {
        this._activeZone = 'right';
        this._dwellTime = dt;
      } else {
        this._dwellTime = 0;
      }
    } else if (this._activeZone === 'left') {
      if (this._dx > -cancelThreshold - EPSILON) {
        // 취소 임계값 이하로 복귀 -> 선택 취소
        this._activeZone = 'none';
        this._dwellTime = 0;
      } else {
        // 좌측 체류 유지
        this._dwellTime += dt;
        if (this._dwellTime >= this._config.dwellDuration - EPSILON) {
          this._confirmedZone = 'left';
          this._isConfirmed = true;
        }
      }
    } else if (this._activeZone === 'right') {
      if (this._dx < cancelThreshold + EPSILON) {
        // 취소 임계값 이하로 복귀 -> 선택 취소
        this._activeZone = 'none';
        this._dwellTime = 0;
      } else {
        // 우측 체류 유지
        this._dwellTime += dt;
        if (this._dwellTime >= this._config.dwellDuration - EPSILON) {
          this._confirmedZone = 'right';
          this._isConfirmed = true;
        }
      }
    }

    return this.state;
  }

  /**
   * 키보드/터치 비상 fallback 입력 즉시 확정
   */
  selectByFallback(zone: 'left' | 'right'): void {
    this._activeZone = zone;
    this._confirmedZone = zone;
    this._isConfirmed = true;
    this._anchorSource = 'fallback';
    this._dwellTime = this._config.dwellDuration;
  }

  /**
   * 답안 선택 상태 초기화 (새 질문/라운드 준비)
   */
  reset(): void {
    this._activeZone = 'none';
    this._confirmedZone = 'none';
    this._isConfirmed = false;
    this._dwellTime = 0;
    this._dx = 0;
    this._anchorSource = 'none';
    this._isTrackingLost = false;
  }
}
