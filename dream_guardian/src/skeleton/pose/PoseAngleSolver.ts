/**
 * PoseAngleSolver - 랜드마크 기반 캐릭터 비의존 관절 각도 추출 및 스무딩 모듈
 *
 * Issue #682 / REFACTOR-SKEL-001:
 * - StickmanRenderer에 혼재되어 있던 각도 추출 및 스무딩 로직을 순수 모듈로 분리
 * - 본 길이와 무관한 PoseFrame(root 위치, 몸통 기울기, 본별 각도, scale, confidence) 산출
 * - 화면 렌더링 1px 오차 없는 동작 보존(동일 수식·동일 파라미터 적용)
 */

import type { NormalizedLandmark } from '../../types/index.js';
import { POSE_LANDMARKS } from '../../types/index.js';
import type { BoneId, BoneAngles, PoseFrame } from '../../types/pose-frame.js';
import { calcDistance, calcShoulderWidth } from '../../utils/PoseGeometry.js';
import {
  STICKMAN_ARM_STABILIZER_CONFIG,
  type StickmanArmStabilizerConfig,
} from '../../../config/skeleton.config.js';
import { stabilizeArm } from './ArmAngleStabilizer.js';

export interface PoseAngleSolverConfig {
  anchorXRatio?: number;
  scale?: number;
  angleSmoothing?: number;
  squatSensitivity?: number;
  jumpSensitivity?: number;
  horizontalSmoothing?: number;
  horizontalClampMin?: number;
  horizontalClampMax?: number;
  armStabilizer?: Partial<StickmanArmStabilizerConfig>;
}

export interface PoseAngleSolverOptions {
  mirror?: boolean;
  isMirroredMode?: boolean;
  virtualWidth?: number;
  virtualHeight?: number;
  dt?: number;
  isRunning?: boolean;
  animTimer?: number;
}

import { diffAngle } from './angleMath.js';
export { diffAngle };

/** 일반 스무딩 루프에서 제외하고 ArmAngleStabilizer로 처리하는 팔 뼈 (Issue #725) */
const ARM_BONES: ReadonlySet<BoneId> = new Set<BoneId>([
  'leftUpperArm',
  'leftForearm',
  'rightUpperArm',
  'rightForearm',
]);

/**
 * 기본 차렷/준비 자세 관절 회전 각도 (라디안)
 */
export function getDefaultBoneAngles(): BoneAngles {
  return {
    torso: -Math.PI / 2,
    head: -Math.PI / 2,
    leftUpperArm: Math.PI * 0.65,
    leftForearm: Math.PI * 0.75,
    rightUpperArm: Math.PI * 0.35,
    rightForearm: Math.PI * 0.25,
    leftUpperLeg: Math.PI * 0.48,
    leftLowerLeg: Math.PI * 0.50,
    rightUpperLeg: Math.PI * 0.52,
    rightLowerLeg: Math.PI * 0.50,
  };
}

export class PoseAngleSolver {
  /**
   * 랜드마크 데이터 및 이전 프레임 상태를 바탕으로 순수 PoseFrame을 계산합니다.
   *
   * @param landmarks MediaPipe Pose 랜드마크 배열 (최소 25개 이상 필요)
   * @param prev 직전 프레임의 PoseFrame (EMA 스무딩 및 적응형 기준선 유지용)
   * @param config 스켈레톤 설정값 (스무딩 계수, 감도 등)
   * @param options 렌더러/화면 옵션 (미러 모드, 가상 해상도 등)
   */
  public static solve(
    landmarks?: readonly NormalizedLandmark[] | null,
    prev?: PoseFrame | null,
    config?: PoseAngleSolverConfig,
    options?: PoseAngleSolverOptions
  ): PoseFrame {
    const smoothing = config?.horizontalSmoothing ?? 0.2;
    const clampMin = config?.horizontalClampMin ?? 0.18;
    const clampMax = config?.horizontalClampMax ?? 0.82;
    const defaultAnchorX = config?.anchorXRatio ?? 0.5;
    const scale = config?.scale ?? prev?.scale ?? 1.0;
    const isMirroredMode = options?.isMirroredMode ?? true;

    // 포즈 미인식 또는 랜드마크 부족 시 기본 자세 및 앵커 복귀
    if (!landmarks || landmarks.length < 25) {
      const curAnchor = prev ? prev.rootX : defaultAnchorX;
      const nextAnchor = curAnchor + (defaultAnchorX - curAnchor) * (smoothing * 0.5);
      return {
        rootX: nextAnchor,
        rootY: prev ? prev.rootY : 0,
        torsoTilt: prev ? prev.torsoTilt : -Math.PI / 2,
        boneAngles: prev ? { ...prev.boneAngles } : getDefaultBoneAngles(),
        scale,
        confidence: 0,
        hasPose: false,
        baselineHipY: prev ? prev.baselineHipY : 0.60,
        verticalOffset: prev ? prev.verticalOffset : 0,
        anchorXRatio: nextAnchor,
      };
    }

    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    const minVis = 0.25;
    const hasHips =
      lh && rh && (lh.visibility ?? 0) >= minVis && (rh.visibility ?? 0) >= minVis;
    const hasShoulders =
      ls && rs && (ls.visibility ?? 0) >= minVis && (rs.visibility ?? 0) >= minVis;

    if (!hasHips && !hasShoulders) {
      const curAnchor = prev ? prev.rootX : defaultAnchorX;
      const nextAnchor = curAnchor + (defaultAnchorX - curAnchor) * (smoothing * 0.5);
      return {
        rootX: nextAnchor,
        rootY: prev ? prev.rootY : 0,
        torsoTilt: prev ? prev.torsoTilt : -Math.PI / 2,
        boneAngles: prev ? { ...prev.boneAngles } : getDefaultBoneAngles(),
        scale,
        confidence: 0,
        hasPose: false,
        baselineHipY: prev ? prev.baselineHipY : 0.60,
        verticalOffset: prev ? prev.verticalOffset : 0,
        anchorXRatio: nextAnchor,
      };
    }

    // 1. 유저 카메라 위치 ↔ 가로 위치 실시간 동기화 (rawHipX)
    let rawHipX = 0.5;
    if (hasHips) {
      rawHipX = (lh.x + rh.x) / 2;
    } else if (hasShoulders) {
      rawHipX = (ls.x + rs.x) / 2;
    }

    // 픽셀 좌표계(rawHipX > 2.0)인 경우 가상 너비(vw)로 정규화
    const defaultVw = rawHipX > 1080 ? 1920 : 1080;
    const vw = options?.virtualWidth ?? defaultVw;
    if (rawHipX > 2.0) {
      rawHipX = rawHipX / vw;
    }

    // 거울 화면 뷰에서는 유저의 오른어깨(또는 골반)가 화면 우측(rs.x >= ls.x)에 위치
    const isLandmarkMirrored = hasShoulders
      ? !(rs.x < ls.x)
      : hasHips
        ? !(rh.x < lh.x)
        : true;
    const isMirrored =
      options?.mirror !== undefined ? options.mirror : isLandmarkMirrored;

    const shouldInvert = isMirroredMode && !isMirrored;
    const rawUserX = shouldInvert ? 1.0 - rawHipX : rawHipX;
    const targetX = Math.max(clampMin, Math.min(clampMax, rawUserX));

    const isInitialized = prev !== undefined && prev !== null && prev.hasPose;
    let nextAnchorXRatio: number;
    if (!isInitialized) {
      nextAnchorXRatio = targetX;
    } else {
      nextAnchorXRatio = prev.rootX + (targetX - prev.rootX) * smoothing;
    }

    // 2. 기준 랜드마크 추출
    const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const lk = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rk = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const la = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const ra = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const nose = landmarks[POSE_LANDMARKS.NOSE];

    // 3. 스쿼트 / 점프 수직 변위 계산
    const currentHipY = (lh.y + rh.y) / 2;
    const defaultVh = currentHipY > 1000 ? 2160 : 1080;
    const vh = options?.virtualHeight ?? defaultVh;

    let nextBaselineHipY: number;
    if (!isInitialized) {
      nextBaselineHipY = currentHipY;
    } else {
      const rawDiff = currentHipY - prev.baselineHipY;
      const normalizedRawDiff = currentHipY > 2.0 ? rawDiff / vh : rawDiff;
      // 스쿼트 유지(normalizedRawDiff > 0.035) 시 기준선 크립(Baseline Creep) 방지
      const isSquatOrJump = Math.abs(normalizedRawDiff) > 0.035;
      const adaptRate = isSquatOrJump ? 0.0005 : 0.01;
      nextBaselineHipY = prev.baselineHipY + rawDiff * adaptRate;
    }

    const hipDiff = currentHipY - nextBaselineHipY;
    const normalizedHipDiff = currentHipY > 2.0 ? hipDiff / vh : hipDiff;
    const squatSensitivity = config?.squatSensitivity ?? 350;
    const targetOffset = normalizedHipDiff * squatSensitivity;

    const prevVerticalOffset = isInitialized ? prev.verticalOffset : 0;
    const nextVerticalOffset = prevVerticalOffset + (targetOffset - prevVerticalOffset) * 0.25;

    // 4. 미러링 정합성 판단 및 목표 관절 각도 계산 (Math.atan2)
    const getDx = (p2: { x: number }, p1: { x: number }) =>
      isMirrored ? p2.x - p1.x : -(p2.x - p1.x);

    const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };

    const maxY = currentHipY > 2.0 ? vh : 1.0;
    const isLegLandmarkValid = (p?: NormalizedLandmark): boolean => {
      if (!p) return false;
      if ((p.visibility ?? 0) < minVis) return false;
      if (p.y >= maxY) return false;
      return true;
    };

    const defaultAngles = getDefaultBoneAngles();
    const isLeftKneeValid = isLegLandmarkValid(lk);
    const isLeftAnkleValid = isLegLandmarkValid(la);
    const isRightKneeValid = isLegLandmarkValid(rk);
    const isRightAnkleValid = isLegLandmarkValid(ra);

    const leftUpperLegAngle = isLeftKneeValid
      ? Math.atan2(lk.y - lh.y, getDx(lk, lh))
      : defaultAngles.leftUpperLeg;
    const rightUpperLegAngle = isRightKneeValid
      ? Math.atan2(rk.y - rh.y, getDx(rk, rh))
      : defaultAngles.rightUpperLeg;

    // Issue #678 & #721: 상위 본(허벅지) 회전량에 1:1로 비례하여 종아리가 자연스럽게 추종 굴곡
    const leftThighDelta = leftUpperLegAngle - defaultAngles.leftUpperLeg;
    const rightThighDelta = rightUpperLegAngle - defaultAngles.rightUpperLeg;
    const derivedLeftLowerLeg = defaultAngles.leftLowerLeg + leftThighDelta * 1.0;
    const derivedRightLowerLeg = defaultAngles.rightLowerLeg + rightThighDelta * 1.0;

    const leftLowerLegAngle = isLeftKneeValid && isLeftAnkleValid
      ? Math.atan2(la.y - lk.y, getDx(la, lk))
      : derivedLeftLowerLeg;
    const rightLowerLegAngle = isRightKneeValid && isRightAnkleValid
      ? Math.atan2(ra.y - rk.y, getDx(ra, rk))
      : derivedRightLowerLeg;

    const targetAngles: BoneAngles = {
      torso: Math.atan2(midShoulder.y - midHip.y, getDx(midShoulder, midHip)),
      head: nose ? Math.atan2(nose.y - midShoulder.y, getDx(nose, midShoulder)) : -Math.PI / 2,
      leftUpperArm: Math.atan2(le.y - ls.y, getDx(le, ls)),
      leftForearm: Math.atan2(lw.y - le.y, getDx(lw, le)),
      rightUpperArm: Math.atan2(re.y - rs.y, getDx(re, rs)),
      rightForearm: Math.atan2(rw.y - re.y, getDx(rw, re)),
      leftUpperLeg: leftUpperLegAngle,
      leftLowerLeg: leftLowerLegAngle,
      rightUpperLeg: rightUpperLegAngle,
      rightLowerLeg: rightLowerLegAngle,
    };

    // Issue #678 & #721: 스쿼트 시 무릎 외측/전방 굴곡(Flexion) 가산 (좌측 무릎은 외측 +각도, 우측 무릎은 외측 -각도)
    if (normalizedHipDiff > 0.02) {
      const squatFactor = Math.max(0, Math.min(1.0, (normalizedHipDiff - 0.02) / 0.12));
      const squatFlex = squatFactor * 0.35;
      const squatSpread = squatFactor * 0.15;
      targetAngles.leftUpperLeg += squatSpread;
      targetAngles.leftLowerLeg -= squatFlex;
      targetAngles.rightUpperLeg -= squatSpread;
      targetAngles.rightLowerLeg += squatFlex;
    }

    // Issue #678: 점프 상승 시 체공 턱(Tuck) 각도 가산
    if (normalizedHipDiff < -0.02) {
      const jumpFactor = Math.max(0, Math.min(1.0, (-normalizedHipDiff - 0.02) / 0.12));
      const jumpTuck = jumpFactor * 0.35;
      targetAngles.leftUpperLeg -= jumpTuck * 0.7;
      targetAngles.leftLowerLeg += jumpTuck;
      targetAngles.rightUpperLeg += jumpTuck * 0.7;
      targetAngles.rightLowerLeg -= jumpTuck;
    }

    // Issue #678: 포즈 인식 중 제자리 달리기(isRunning) 연동 다리 교차 스윙 합성
    if (options?.isRunning) {
      const timer = options.animTimer ?? 0;
      const runCycle = Math.sin(timer * 8.0);
      const legSwing = runCycle * 0.32;
      targetAngles.leftUpperLeg += legSwing;
      targetAngles.leftLowerLeg += (runCycle > 0 ? legSwing * 0.8 : legSwing * 0.4);
      targetAngles.rightUpperLeg -= legSwing;
      targetAngles.rightLowerLeg -= (runCycle < 0 ? -legSwing * 0.8 : -legSwing * 0.4);
    }

    // 5. 각도 스무딩 (Damping)
    const angleSmoothing = config?.angleSmoothing ?? 0.35;
    const prevAngles = isInitialized ? prev.boneAngles : defaultAngles;
    const smoothedAngles: BoneAngles = { ...prevAngles };

    for (const key of Object.keys(targetAngles) as BoneId[]) {
      if (ARM_BONES.has(key)) continue;
      const diff = diffAngle(targetAngles[key], smoothedAngles[key]);
      smoothedAngles[key] += diff * angleSmoothing;
    }

    // Issue #725: 팔 관절 스냅 방지 (길이·가시성 가중, 굽힘 방향 유지, 소프트 가동 범위)
    const armCfg: StickmanArmStabilizerConfig = {
      ...STICKMAN_ARM_STABILIZER_CONFIG,
      ...config?.armStabilizer,
    };
    const shoulderWidth = calcShoulderWidth(ls, rs);
    const solveArm = (
      shoulder: NormalizedLandmark,
      elbow: NormalizedLandmark,
      wrist: NormalizedLandmark,
      upperKey: BoneId,
      forearmKey: BoneId,
    ): number => {
      const shoulderVis = shoulder.visibility ?? 0;
      const elbowVis = elbow.visibility ?? 0;
      const wristVis = wrist.visibility ?? 0;
      const arm = stabilizeArm(
        {
          rawUpperArm: targetAngles[upperKey],
          rawForearm: targetAngles[forearmKey],
          torso: smoothedAngles.torso,
          prevUpperArm: prevAngles[upperKey],
          prevForearm: prevAngles[forearmKey],
          prevTorso: prevAngles.torso,
          upperLengthRatio: calcDistance(shoulder, elbow) / shoulderWidth,
          forearmLengthRatio: calcDistance(elbow, wrist) / shoulderWidth,
          upperVisibility: Math.min(shoulderVis, elbowVis),
          forearmVisibility: Math.min(elbowVis, wristVis),
          angleSmoothing,
        },
        armCfg,
      );
      smoothedAngles[upperKey] = arm.upperArm;
      smoothedAngles[forearmKey] = arm.forearm;
      return Math.min(arm.upperWeight, arm.forearmWeight);
    };
    const armConfidence = {
      left: solveArm(ls, le, lw, 'leftUpperArm', 'leftForearm'),
      right: solveArm(rs, re, rw, 'rightUpperArm', 'rightForearm'),
    };

    const visPoints = [ls?.visibility, rs?.visibility, lh?.visibility, rh?.visibility].filter(
      (v): v is number => typeof v === 'number'
    );
    const confidence =
      visPoints.length > 0
        ? visPoints.reduce((acc, cur) => acc + cur, 0) / visPoints.length
        : 0;

    return {
      rootX: nextAnchorXRatio,
      rootY: nextVerticalOffset,
      torsoTilt: smoothedAngles.torso,
      boneAngles: smoothedAngles,
      scale,
      confidence,
      hasPose: true,
      baselineHipY: nextBaselineHipY,
      verticalOffset: nextVerticalOffset,
      anchorXRatio: nextAnchorXRatio,
      armConfidence,
    };
  }
}
