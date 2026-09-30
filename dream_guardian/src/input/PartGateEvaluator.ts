/**
 * PartGateEvaluator - 캘리브레이션 기준선 대비 신체 변위(PartGate) 판정 엔진
 *
 * RC-3 (단순 직립 상태만으로 존 2/7에 머리/골반이 닿아 자동 충족되는 결함) 완전 해결:
 * - 캘리브레이션 시 측정된 중립 baseline(코 X/Y, 어깨 Y, 골반 Y, 어깨너비 등) 활용
 * - 스쿼트: 골반 Y의 하강 변위 (Δy >= threshold, 화면 아래로 이동) 검증
 * - 머리 기울이기: 코 X/Y의 상대 변위 (좌측 기울임: Δx <= -th, 우측 기울임: Δx >= +th) 검증
 * - 팔 뻗기 / 만세: 손목-어깨 상대 상향/외측 변위 검증
 * - 캘리브레이션 미완료 또는 수동 제어 시 유연한(lenient) 폴백 지원
 *
 * @see Issue #126 (POSE-004)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import type { CalibrationBaseline } from '../motion/CalibrationHelper.js';
import type { AnswerPosture, PartGate } from '../types/posture.js';

export interface PartGateEvaluatorOptions {
  baseline?: CalibrationBaseline | null;
  /** 캘리브레이션 baseline 부재 시 판정 통과 허용 여부 (기본 true) */
  lenientIfUncalibrated?: boolean;
  /** 신뢰도 임계값 (이하 랜드마크 무시) */
  visibilityThreshold?: number;
}

export class PartGateEvaluator {
  private _baseline: CalibrationBaseline | null = null;
  private _lenientIfUncalibrated: boolean;
  private _visibilityThreshold: number;

  constructor(options?: PartGateEvaluatorOptions) {
    this._baseline = options?.baseline ?? null;
    this._lenientIfUncalibrated = options?.lenientIfUncalibrated ?? true;
    this._visibilityThreshold = options?.visibilityThreshold ?? 0.45;
  }

  setBaseline(baseline: CalibrationBaseline | null): void {
    this._baseline = baseline;
  }

  get baseline(): CalibrationBaseline | null {
    return this._baseline;
  }

  /**
   * 단일 PartGate 조건 검증
   */
  evaluateGate(
    gate: PartGate,
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    overrideBaseline?: CalibrationBaseline | null
  ): boolean {
    // 랜드마크 부재 시
    if (!landmarks || landmarks.length < 25) {
      return this._lenientIfUncalibrated;
    }

    const baseline = overrideBaseline !== undefined ? overrideBaseline : this._baseline;
    if (!baseline) {
      return this._lenientIfUncalibrated;
    }

    const { part, axis, threshold, min, max } = gate;

    // ── 1. 골반(hip) 변위 평가 (스쿼트 등) ──
    if (part === 'hip') {
      const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
      const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
      if (!lHip || !rHip) return this._lenientIfUncalibrated;
      if (lHip.visibility < this._visibilityThreshold || rHip.visibility < this._visibilityThreshold) {
        return this._lenientIfUncalibrated;
      }

      const currentHipY = (lHip.y + rHip.y) / 2;
      const currentHipX = (lHip.x + rHip.x) / 2;

      if (axis === 'y') {
        // 화면 좌표계에서 아래로 내려갈수록 Y가 증가함 (Δy = current - baseline)
        const deltaY = currentHipY - baseline.hipY;

        if (threshold !== undefined && deltaY < threshold) {
          return false;
        }
        if (min !== undefined && deltaY < min) {
          return false;
        }
        if (max !== undefined && deltaY > max) {
          return false;
        }
        return true;
      }

      if (axis === 'x') {
        const deltaX = currentHipX - baseline.hipX;
        if (min !== undefined && deltaX < min) return false;
        if (max !== undefined && deltaX > max) return false;
        if (threshold !== undefined && Math.abs(deltaX) < threshold) return false;
        return true;
      }
    }

    // ── 2. 머리(head) 변위 평가 (목 기울이기 등) ──
    if (part === 'head') {
      const nose = landmarks[POSE_LANDMARKS.NOSE];
      if (!nose || nose.visibility < this._visibilityThreshold) {
        return this._lenientIfUncalibrated;
      }

      if (axis === 'x') {
        const deltaX = nose.x - baseline.noseX;

        if (threshold !== undefined) {
          if (threshold > 0 && deltaX < threshold) return false; // 우측 기울임 미달
          if (threshold < 0 && deltaX > threshold) return false; // 좌측 기울임 미달
        }
        if (min !== undefined && deltaX < min) return false;
        if (max !== undefined && deltaX > max) return false;
        return true;
      }

      if (axis === 'y') {
        const deltaY = nose.y - baseline.noseY;
        if (threshold !== undefined && deltaY < threshold) return false;
        if (min !== undefined && deltaY < min) return false;
        if (max !== undefined && deltaY > max) return false;
        return true;
      }
    }

    // ── 3. 손(leftHand / rightHand) 변위 평가 (만세 / 수평 도달 등) ──
    if (part === 'leftHand' || part === 'rightHand') {
      const isLeft = part === 'leftHand';
      const wrist = landmarks[isLeft ? POSE_LANDMARKS.LEFT_WRIST : POSE_LANDMARKS.RIGHT_WRIST];
      const shoulder = landmarks[isLeft ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER];

      if (!wrist || !shoulder || wrist.visibility < this._visibilityThreshold) {
        return this._lenientIfUncalibrated;
      }

      if (axis === 'y') {
        // 상향 변위: 어깨보다 손목이 위(Y가 작음)에 위치해야 함
        // deltaUp = shoulder.y - wrist.y (클수록 손이 어깨보다 높음)
        const deltaUp = baseline.shoulderY - wrist.y;

        if (threshold !== undefined && deltaUp < threshold) {
          return false;
        }
        if (min !== undefined && deltaUp < min) {
          return false;
        }
        if (max !== undefined && deltaUp > max) {
          return false;
        }
        return true;
      }

      if (axis === 'x') {
        // 외측 뻗기: 몸 중심에서 바깥쪽으로 벌어짐
        const lateralDist = isLeft
          ? baseline.shoulderX - wrist.x // 좌측으로 뻗음
          : wrist.x - baseline.shoulderX; // 우측으로 뻗음

        if (threshold !== undefined && lateralDist < threshold) {
          return false;
        }
        if (min !== undefined && lateralDist < min) {
          return false;
        }
        if (max !== undefined && lateralDist > max) {
          return false;
        }
        return true;
      }
    }

    return true;
  }

  /**
   * AnswerPosture 내의 모든 PartGate 일괄 평가
   */
  evaluatePostureGates(
    posture: AnswerPosture,
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    overrideBaseline?: CalibrationBaseline | null
  ): boolean {
    if (!posture.gates || posture.gates.length === 0) {
      return true;
    }

    for (const gate of posture.gates) {
      if (!this.evaluateGate(gate, landmarks, overrideBaseline)) {
        return false;
      }
    }

    return true;
  }
}
