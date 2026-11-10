import { describe, it, expect } from 'vitest';
import { PoseAngleSolver, diffAngle, getDefaultBoneAngles } from '../../src/skeleton/pose/PoseAngleSolver.js';
import { StickmanRenderer } from '../../src/skeleton/StickmanRenderer.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

function createSampleLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }

  // 머리 / 코
  lm[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  // 어깨
  lm[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.42, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.58, y: 0.32, z: 0, visibility: 0.95 };
  // 팔꿈치
  lm[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.36, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.64, y: 0.44, z: 0, visibility: 0.9 };
  // 손목
  lm[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.32, y: 0.54, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.68, y: 0.54, z: 0, visibility: 0.9 };
  // 골반
  lm[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.55, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.55, z: 0, visibility: 0.95 };
  // 무릎
  lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.44, y: 0.72, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.56, y: 0.72, z: 0, visibility: 0.9 };
  // 발목
  lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: 0.90, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.57, y: 0.90, z: 0, visibility: 0.9 };

  return lm;
}

describe('PoseAngleSolver 단위 테스트 (#682 / REFACTOR-SKEL-001)', () => {
  it('diffAngle 유틸리티가 각도 차이를 [-PI, PI] 범위로 올바르게 정규화한다', () => {
    expect(diffAngle(0, 0)).toBe(0);
    expect(diffAngle(Math.PI, 0)).toBeCloseTo(Math.PI);
    expect(diffAngle(0, Math.PI)).toBeCloseTo(-Math.PI);
    // Wrap around
    expect(diffAngle(Math.PI * 1.5, 0)).toBeCloseTo(-Math.PI * 0.5);
    expect(diffAngle(0, Math.PI * 1.5)).toBeCloseTo(Math.PI * 0.5);
  });

  it('랜드마크가 없거나 길이가 25 미만일 때 hasPose=false와 기본 PoseFrame을 반환한다', () => {
    const frameNull = PoseAngleSolver.solve(null, undefined, STICKMAN_CONFIG);
    expect(frameNull.hasPose).toBe(false);
    expect(frameNull.confidence).toBe(0);
    expect(frameNull.rootX).toBe(0.5);
    expect(frameNull.torsoTilt).toBeCloseTo(-Math.PI / 2);
    expect(frameNull.boneAngles.torso).toBeCloseTo(-Math.PI / 2);

    const frameShort = PoseAngleSolver.solve([], undefined, STICKMAN_CONFIG);
    expect(frameShort.hasPose).toBe(false);
    expect(frameShort.confidence).toBe(0);
  });

  it('골반과 어깨의 visibility가 0.25 미만인 저신뢰도 랜드마크인 경우 hasPose=false를 반환한다', () => {
    const lm = createSampleLandmarks();
    lm[POSE_LANDMARKS.LEFT_SHOULDER].visibility = 0.1;
    lm[POSE_LANDMARKS.RIGHT_SHOULDER].visibility = 0.1;
    lm[POSE_LANDMARKS.LEFT_HIP].visibility = 0.1;
    lm[POSE_LANDMARKS.RIGHT_HIP].visibility = 0.1;

    const frame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
    expect(frame.hasPose).toBe(false);
    expect(frame.confidence).toBe(0);
  });

  it('정상 정면 포즈 랜드마크 입력 시 올바른 PoseFrame을 산출한다', () => {
    const lm = createSampleLandmarks();
    const frame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    expect(frame.hasPose).toBe(true);
    expect(frame.confidence).toBeGreaterThan(0.8);
    expect(frame.rootX).toBeCloseTo(0.5, 2);
    expect(frame.torsoTilt).toBeCloseTo(-Math.PI / 2, 1);
    expect(frame.boneAngles.leftUpperArm).toBeDefined();
    expect(frame.boneAngles.rightUpperArm).toBeDefined();
    expect(frame.boneAngles.leftUpperLeg).toBeDefined();
    expect(frame.boneAngles.rightUpperLeg).toBeDefined();
  });

  it('측면 기울임(torso tilt) 및 팔 각도 변위가 정상 반영된다', () => {
    const lm = createSampleLandmarks();
    // 상체를 오른쪽으로 기울임
    lm[POSE_LANDMARKS.LEFT_SHOULDER].x = 0.52;
    lm[POSE_LANDMARKS.RIGHT_SHOULDER].x = 0.68;
    lm[POSE_LANDMARKS.LEFT_HIP].x = 0.45;
    lm[POSE_LANDMARKS.RIGHT_HIP].x = 0.55;

    const frame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
    expect(frame.hasPose).toBe(true);
    // 수직(-PI/2 ≈ -1.57)보다 기울어진 각도여야 함
    expect(frame.torsoTilt).not.toBeCloseTo(-Math.PI / 2, 2);
  });

  it('이전 프레임(prev)이 주어지면 angleSmoothing과 horizontalSmoothing을 적용하여 보간한다', () => {
    const lm1 = createSampleLandmarks();
    const frame1 = PoseAngleSolver.solve(lm1, undefined, STICKMAN_CONFIG);

    const lm2 = createSampleLandmarks();
    // 왼손을 크게 위로 듦
    lm2[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.10, z: 0, visibility: 0.95 };
    lm2[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.35, y: 0.20, z: 0, visibility: 0.95 };

    const frame2 = PoseAngleSolver.solve(lm2, frame1, STICKMAN_CONFIG);
    // frame1의 각도와 즉각 목표 각도 사이로 스무딩되어야 함
    expect(frame2.boneAngles.leftForearm).not.toBe(frame1.boneAngles.leftForearm);
  });

  it('무릎/발목이 화면 하단 밖이거나 저신뢰도인 경우 기본 다리 각도로 안전하게 폴백한다', () => {
    const lm = createSampleLandmarks();
    // 무릎이 화면 아래로 잘림 (y >= 1.0)
    lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.44, y: 1.15, z: 0, visibility: 0.9 };
    lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: 1.30, z: 0, visibility: 0.9 };

    const frame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
    const defaultAngles = getDefaultBoneAngles();
    expect(frame.boneAngles.leftUpperLeg).toBeCloseTo(defaultAngles.leftUpperLeg, 2);
    expect(frame.boneAngles.leftLowerLeg).toBeCloseTo(defaultAngles.leftLowerLeg, 2);
  });

  it('리팩터링 전후 동일 입력에 대해 StickmanRenderer와 PoseAngleSolver 결과가 완전히 일치한다 (골든 스냅샷)', () => {
    const lm = createSampleLandmarks();
    const renderer = new StickmanRenderer(STICKMAN_CONFIG);
    renderer.update(0.016, lm);

    const solverFrame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
    const rendererAngles = renderer.getSmoothedAngles();

    for (const key of Object.keys(rendererAngles) as Array<keyof typeof rendererAngles>) {
      expect(rendererAngles[key]).toBeCloseTo(solverFrame.boneAngles[key], 4);
    }
    expect(renderer.currentAnchorXRatio).toBeCloseTo(solverFrame.rootX, 4);
  });

  it('[#678 / FEAT-SKEL-007] 발목이 잘리고 무릎만 인식될 때 허벅지 회전에 맞춰 종아리가 계층적으로 추종 굴곡된다', () => {
    const lm = createSampleLandmarks();
    // 왼쪽 무릎은 왼쪽으로 벌려짐 (허벅지 회전)
    lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.35, y: 0.68, z: 0, visibility: 0.9 };
    // 발목은 화면 밖으로 잘림 (y >= 1.0)
    lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.35, y: 1.10, z: 0, visibility: 0.9 };

    const frame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
    const defaultAngles = getDefaultBoneAngles();
    // 발목이 잘렸어도 허벅지가 회전했으므로 종아리는 기본 수직(PI * 0.50)에 굳지 않고 허벅지를 따라 추종 굴곡되어야 함
    expect(frame.boneAngles.leftLowerLeg).not.toBeCloseTo(defaultAngles.leftLowerLeg, 2);
  });

  it('[#678 / FEAT-SKEL-007] 스쿼트 동작 시 무릎 굴곡이 가산되고 기준선 크립(Baseline Creep)이 방지된다', () => {
    const lm = createSampleLandmarks();
    const frameStand = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    // 스쿼트로 골반 하강
    const lmSquat = createSampleLandmarks();
    lmSquat[POSE_LANDMARKS.LEFT_HIP].y = 0.68;
    lmSquat[POSE_LANDMARKS.RIGHT_HIP].y = 0.68;
    lmSquat[POSE_LANDMARKS.LEFT_KNEE].y = 0.82;
    lmSquat[POSE_LANDMARKS.RIGHT_KNEE].y = 0.82;

    const frameSquat1 = PoseAngleSolver.solve(lmSquat, frameStand, STICKMAN_CONFIG);
    expect(frameSquat1.verticalOffset).toBeGreaterThan(0);
    // 스쿼트 시 무릎 굴곡 각도가 서 있을 때와 달라야 함
    expect(frameSquat1.boneAngles.leftLowerLeg).not.toBeCloseTo(frameStand.boneAngles.leftLowerLeg, 2);

    // 스쿼트를 여러 프레임 유지할 때 baselineHipY가 골반 위치로 무한정 끌려가지 않음 (Baseline Creep 방지)
    let curFrame = frameSquat1;
    for (let i = 0; i < 30; i++) {
      curFrame = PoseAngleSolver.solve(lmSquat, curFrame, STICKMAN_CONFIG);
    }
    // 기준선이 0.68까지 크립되지 않고 이전 baseline 근처에 유지되어야 함
    expect(curFrame.baselineHipY).toBeLessThan(0.65);
  });

  it('[#678 / FEAT-SKEL-007] 점프 동작 시 체공 턱(Tuck) 각도가 다리에 적용된다', () => {
    const lm = createSampleLandmarks();
    const frameStand = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    // 점프로 골반 및 신체 상승
    const lmJump = createSampleLandmarks();
    lmJump[POSE_LANDMARKS.LEFT_HIP].y = 0.42;
    lmJump[POSE_LANDMARKS.RIGHT_HIP].y = 0.42;

    const frameJump = PoseAngleSolver.solve(lmJump, frameStand, STICKMAN_CONFIG);
    expect(frameJump.verticalOffset).toBeLessThan(0);
    // 점프 체공 턱으로 인해 서 있을 때와 다리 각도 차이가 발생해야 함
    expect(frameJump.boneAngles.leftUpperLeg).not.toBeCloseTo(frameStand.boneAngles.leftUpperLeg, 2);
  });

  it('[#678 / FEAT-SKEL-007] 포즈 인식 중 isRunning=true 시 다리 교차 스윙이 합성된다', () => {
    const lm = createSampleLandmarks();
    const frameStand = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    const frameRun1 = PoseAngleSolver.solve(lm, frameStand, STICKMAN_CONFIG, { isRunning: true, animTimer: 0.2 });
    const frameRun2 = PoseAngleSolver.solve(lm, frameStand, STICKMAN_CONFIG, { isRunning: true, animTimer: 0.6 });

    // 달리기 시간에 따라 다리 각도가 앞뒤로 스윙되어 차이가 발생해야 함
    expect(frameRun1.boneAngles.leftUpperLeg).not.toBeCloseTo(frameRun2.boneAngles.leftUpperLeg, 2);
    expect(frameRun1.boneAngles.rightUpperLeg).not.toBeCloseTo(frameRun2.boneAngles.rightUpperLeg, 2);
  });

  describe('[BUG-AVATAR-003 / #721] 다리 각도 정렬 및 스쿼트·폴백 관절 왜곡 개선', () => {
    it('발목이 잘리고 무릎만 인식될 때 종아리가 허벅지 회전량에 1:1(100%) 비율로 온전히 추종한다', () => {
      const lm = createSampleLandmarks();
      // 왼쪽 무릎을 바깥쪽으로 회전
      lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.35, y: 0.68, z: 0, visibility: 0.9 };
      // 발목은 화면 아래로 잘림
      lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.35, y: 1.10, z: 0, visibility: 0.9 };

      const frame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
      const defaultAngles = getDefaultBoneAngles();
      const thighDelta = frame.boneAngles.leftUpperLeg - defaultAngles.leftUpperLeg;
      const lowerLegDelta = frame.boneAngles.leftLowerLeg - defaultAngles.leftLowerLeg;

      // 75% 감쇠가 아닌 1:1(100%)로 추종하여 무릎 꺾임이 발생하지 않아야 함
      expect(lowerLegDelta).toBeCloseTo(thighDelta, 2);
    });

    it('스쿼트 동작 시 양쪽 무릎이 외측으로 벌어지도록(좌측 무릎은 외측 +각도, 우측 무릎은 외측 -각도) 자연스럽게 굴곡된다', () => {
      const lm = createSampleLandmarks();
      const frameStand = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

      const lmSquat = createSampleLandmarks();
      lmSquat[POSE_LANDMARKS.LEFT_HIP].y = 0.68;
      lmSquat[POSE_LANDMARKS.RIGHT_HIP].y = 0.68;
      lmSquat[POSE_LANDMARKS.LEFT_KNEE].y = 0.82;
      lmSquat[POSE_LANDMARKS.RIGHT_KNEE].y = 0.82;

      const frameSquat = PoseAngleSolver.solve(lmSquat, frameStand, STICKMAN_CONFIG);

      // 좌측 허벅지는 외측으로 벌어져 각도가 증가(Canvas X축 음의 방향으로 전개)해야 함
      expect(frameSquat.boneAngles.leftUpperLeg).toBeGreaterThan(frameStand.boneAngles.leftUpperLeg);
      // 우측 허벅지는 외측으로 벌어져 각도가 감소(Canvas X축 양의 방향으로 전개)해야 함
      expect(frameSquat.boneAngles.rightUpperLeg).toBeLessThan(frameStand.boneAngles.rightUpperLeg);
    });
  });
});
