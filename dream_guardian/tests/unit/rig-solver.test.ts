import { describe, it, expect } from 'vitest';
import { RigSolver } from '../../src/skeleton/rig/RigSolver.js';
import { StickmanRenderer } from '../../src/skeleton/StickmanRenderer.js';
import { PoseAngleSolver } from '../../src/skeleton/pose/PoseAngleSolver.js';
import { DEFAULT_STICKMAN_RIG } from '../../config/character-rig.config.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import type { CharacterRig } from '../../src/types/character-rig.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

function createSampleLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }
  lm[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.42, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.58, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.35, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.65, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.55, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.70, y: 0.55, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.60, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.60, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.44, y: 0.76, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.56, y: 0.76, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: 0.92, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.57, y: 0.92, z: 0, visibility: 0.9 };
  return lm;
}

describe('RigSolver 순운동학(FK) 단위 테스트 (#684 / FEAT-RIG-002)', () => {
  it('기본 스틱맨 리그 결과가 기존 StickmanRenderer.calculateFKPositions와 100% 동치이다 (동치 테스트)', () => {
    const lm = createSampleLandmarks();
    const renderer = new StickmanRenderer(STICKMAN_CONFIG);
    renderer.update(0.016, lm);

    const poseFrame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);
    const vw = 1080;
    const vh = 1080;
    const fkPositions = renderer.calculateFKPositions(vw, vh);

    const solverTransforms = RigSolver.solve(poseFrame, DEFAULT_STICKMAN_RIG, {
      virtualWidth: vw,
      virtualHeight: vh,
      anchorYRatio: STICKMAN_CONFIG.anchorYRatio,
      scale: renderer.scale,
    });
    const map = RigSolver.toMap(solverTransforms);

    // 주요 관절 좌표 검증
    expect(map['torso'].x).toBeCloseTo(fkPositions.pelvis.x, 3);
    expect(map['torso'].y).toBeCloseTo(fkPositions.pelvis.y, 3);
    expect(map['torso'].endX).toBeCloseTo(fkPositions.neck.x, 3);
    expect(map['torso'].endY).toBeCloseTo(fkPositions.neck.y, 3);

    expect(map['head'].endX).toBeCloseTo(fkPositions.head.x, 3);
    expect(map['head'].endY).toBeCloseTo(fkPositions.head.y, 3);

    expect(map['leftUpperArm'].x).toBeCloseTo(fkPositions.leftShoulder.x, 3);
    expect(map['leftUpperArm'].y).toBeCloseTo(fkPositions.leftShoulder.y, 3);
    expect(map['leftUpperArm'].endX).toBeCloseTo(fkPositions.leftElbow.x, 3);
    expect(map['leftUpperArm'].endY).toBeCloseTo(fkPositions.leftElbow.y, 3);

    expect(map['leftForearm'].endX).toBeCloseTo(fkPositions.leftWrist.x, 3);
    expect(map['leftForearm'].endY).toBeCloseTo(fkPositions.leftWrist.y, 3);

    expect(map['rightUpperArm'].x).toBeCloseTo(fkPositions.rightShoulder.x, 3);
    expect(map['rightUpperArm'].y).toBeCloseTo(fkPositions.rightShoulder.y, 3);
    expect(map['rightUpperArm'].endX).toBeCloseTo(fkPositions.rightElbow.x, 3);
    expect(map['rightUpperArm'].endY).toBeCloseTo(fkPositions.rightElbow.y, 3);

    expect(map['rightForearm'].endX).toBeCloseTo(fkPositions.rightWrist.x, 3);
    expect(map['rightForearm'].endY).toBeCloseTo(fkPositions.rightWrist.y, 3);

    expect(map['leftUpperLeg'].x).toBeCloseTo(fkPositions.leftHip.x, 3);
    expect(map['leftUpperLeg'].y).toBeCloseTo(fkPositions.leftHip.y, 3);
    expect(map['leftUpperLeg'].endX).toBeCloseTo(fkPositions.leftKnee.x, 3);
    expect(map['leftUpperLeg'].endY).toBeCloseTo(fkPositions.leftKnee.y, 3);

    expect(map['leftLowerLeg'].endX).toBeCloseTo(fkPositions.leftAnkle.x, 3);
    expect(map['leftLowerLeg'].endY).toBeCloseTo(fkPositions.leftAnkle.y, 3);

    expect(map['rightUpperLeg'].x).toBeCloseTo(fkPositions.rightHip.x, 3);
    expect(map['rightUpperLeg'].y).toBeCloseTo(fkPositions.rightHip.y, 3);
    expect(map['rightUpperLeg'].endX).toBeCloseTo(fkPositions.rightKnee.x, 3);
    expect(map['rightUpperLeg'].endY).toBeCloseTo(fkPositions.rightKnee.y, 3);

    expect(map['rightLowerLeg'].endX).toBeCloseTo(fkPositions.rightAnkle.x, 3);
    expect(map['rightLowerLeg'].endY).toBeCloseTo(fkPositions.rightAnkle.y, 3);
  });

  it('본 길이가 0.5배 및 2배인 리그에서 각도는 보존되고 본 길이가 정확히 반영된다', () => {
    const lm = createSampleLandmarks();
    const poseFrame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    const halfRig: CharacterRig = {
      ...DEFAULT_STICKMAN_RIG,
      id: 'half_stickman',
      bones: DEFAULT_STICKMAN_RIG.bones.map((b) => ({
        ...b,
        length: b.length * 0.5,
      })),
    };

    const doubleRig: CharacterRig = {
      ...DEFAULT_STICKMAN_RIG,
      id: 'double_stickman',
      bones: DEFAULT_STICKMAN_RIG.bones.map((b) => ({
        ...b,
        length: b.length * 2.0,
      })),
    };

    const halfTransforms = RigSolver.solve(poseFrame, halfRig);
    const doubleTransforms = RigSolver.solve(poseFrame, doubleRig);

    const halfMap = RigSolver.toMap(halfTransforms);
    const doubleMap = RigSolver.toMap(doubleTransforms);

    // 각도는 동일하게 보존됨
    expect(halfMap['torso'].rotation).toBeCloseTo(doubleMap['torso'].rotation, 4);
    expect(halfMap['leftUpperArm'].rotation).toBeCloseTo(doubleMap['leftUpperArm'].rotation, 4);

    // 길이는 4배 차이
    expect(doubleMap['torso'].length).toBeCloseTo(halfMap['torso'].length * 4.0, 4);
  });

  it('관절 회전 각도 제한(minAngle, maxAngle)이 주어지면 해당 범위 내로 클램프된다', () => {
    const lm = createSampleLandmarks();
    const poseFrame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    const clampedRig: CharacterRig = {
      ...DEFAULT_STICKMAN_RIG,
      id: 'clamped_stickman',
      bones: DEFAULT_STICKMAN_RIG.bones.map((b) => {
        if (b.id === 'leftUpperArm') {
          return {
            ...b,
            minAngle: 0.0,
            maxAngle: 0.5, // 0.0 ~ 0.5 rad 범위로 엄격히 제한
          };
        }
        return b;
      }),
    };

    const transforms = RigSolver.solve(poseFrame, clampedRig);
    const map = RigSolver.toMap(transforms);

    expect(map['leftUpperArm'].rotation).toBeLessThanOrEqual(0.5);
    expect(map['leftUpperArm'].rotation).toBeGreaterThanOrEqual(0.0);
  });

  it('rootAnchor가 "feet"일 때 최하단 발이 지면 기준선에 접지된다 (SD 캐릭터 대응)', () => {
    const lm = createSampleLandmarks();
    const poseFrame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    const sdFeetRig: CharacterRig = {
      ...DEFAULT_STICKMAN_RIG,
      id: 'sd_feet_stickman',
      rootAnchor: 'feet',
      bones: DEFAULT_STICKMAN_RIG.bones.map((b) => ({
        ...b,
        length: b.length * 0.4, // 다리가 짧은 SD 캐릭터
      })),
    };

    const groundBaseY = 850;
    const transforms = RigSolver.solve(poseFrame, sdFeetRig, {
      groundBaseY,
    });
    const map = RigSolver.toMap(transforms);

    const lowestY = Math.max(
      map['leftLowerLeg'].endY,
      map['rightLowerLeg'].endY,
    );

    // 지면 기준선에 정확히 접지됨 (frame.rootY에 따른 도약/스쿼트 포함)
    expect(lowestY).toBeCloseTo(groundBaseY + poseFrame.rootY, 1);
  });

  it('driver가 "pose"가 아닌 본(physics, clip)은 restAngle을 유지한다', () => {
    const lm = createSampleLandmarks();
    const poseFrame = PoseAngleSolver.solve(lm, undefined, STICKMAN_CONFIG);

    const physicsRig: CharacterRig = {
      ...DEFAULT_STICKMAN_RIG,
      id: 'physics_tail_stickman',
      bones: [
        ...DEFAULT_STICKMAN_RIG.bones,
        {
          id: 'tail',
          parent: 'pelvis',
          length: 60,
          restAngle: Math.PI * 0.25,
          driver: 'physics',
        },
      ],
    };

    const transforms = RigSolver.solve(poseFrame, physicsRig);
    const map = RigSolver.toMap(transforms);

    expect(map['tail'].rotation).toBeCloseTo(Math.PI * 0.25, 4);
  });
});
