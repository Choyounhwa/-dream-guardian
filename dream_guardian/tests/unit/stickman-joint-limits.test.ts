/**
 * Issue #725 / FEAT-SKEL-LIMIT-001
 * 메카 졸라맨 팔 관절 스냅 방지: 길이·가시성 신뢰도 가중, 굽힘 방향 유지, 소프트 가동 범위
 */
import { describe, it, expect } from 'vitest';
import { smoothstep, calcDistance, calcShoulderWidth } from '../../src/utils/PoseGeometry.js';
import { diffAngle, unwrapNear, softLimitSymmetric } from '../../src/skeleton/pose/angleMath.js';
import { calcSegmentWeight, stabilizeArm } from '../../src/skeleton/pose/ArmAngleStabilizer.js';
import type { ArmStabilizerInput } from '../../src/skeleton/pose/ArmAngleStabilizer.js';
import { PoseAngleSolver } from '../../src/skeleton/pose/PoseAngleSolver.js';
import type { PoseFrame } from '../../src/types/pose-frame.js';
import { STICKMAN_ARM_STABILIZER_CONFIG } from '../../config/skeleton.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

const CFG = STICKMAN_ARM_STABILIZER_CONFIG;
const DEG = Math.PI / 180;
const SMOOTHING = 0.35;

/** pose-angle-solver.test.ts 와 동일한 정면 포즈 (어깨 0.42/0.58, y 0.32, 어깨너비 0.16) */
function createFrontLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }
  lm[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.42, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.58, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.36, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.64, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.32, y: 0.54, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.68, y: 0.54, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.55, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.55, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.44, y: 0.72, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.56, y: 0.72, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: 0.90, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.57, y: 0.90, z: 0, visibility: 0.9 };
  return lm;
}

/** 고정 시드 LCG (Numerical Recipes 상수) → [-1, 1) 균등 난수 */
function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };
}

const NOISE = 0.003;

function runFrames(
  frames: number,
  prev: PoseFrame | null,
  makeLandmarks: (frame: number) => NormalizedLandmark[],
): PoseFrame[] {
  const out: PoseFrame[] = [];
  let p = prev;
  for (let f = 0; f < frames; f++) {
    p = PoseAngleSolver.solve(makeLandmarks(f), p);
    out.push(p);
  }
  return out;
}

function baseInput(overrides: Partial<ArmStabilizerInput>): ArmStabilizerInput {
  return {
    rawUpperArm: 1.2,
    rawForearm: 1.8,
    torso: -Math.PI / 2,
    prevUpperArm: 1.2,
    prevForearm: 1.8,
    prevTorso: -Math.PI / 2,
    upperLengthRatio: 1.0,
    forearmLengthRatio: 1.0,
    upperVisibility: 1.0,
    forearmVisibility: 1.0,
    angleSmoothing: SMOOTHING,
    ...overrides,
  };
}

describe('stickman 팔 관절 스냅 방지 (#725 / FEAT-SKEL-LIMIT-001)', () => {
  it('1. smoothstep 경계값 (0, 0.5, 1, edge 역전)', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0);
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 2)).toBe(1);
    // edge 역전/동일: x >= edge1 이면 1, 아니면 0
    expect(smoothstep(1, 0, 0.5)).toBe(1);
    expect(smoothstep(1, 0, -0.1)).toBe(0);
    expect(smoothstep(0.3, 0.3, 0.3)).toBe(1);
    expect(smoothstep(0.3, 0.3, 0.2)).toBe(0);
  });

  it('2. softLimitSymmetric: knee 이하 항등, 한계 미만, 부호 대칭, 단조 증가', () => {
    const maxAbs = CFG.elbowMaxFlexDeg * DEG;
    const soft = CFG.softZoneDeg * DEG;
    const knee = maxAbs - soft;
    expect(softLimitSymmetric(knee * 0.5, maxAbs, soft)).toBe(knee * 0.5);
    expect(softLimitSymmetric(-knee, maxAbs, soft)).toBe(-knee);
    expect(softLimitSymmetric(10, maxAbs, soft)).toBeLessThanOrEqual(maxAbs);
    expect(softLimitSymmetric(200 * DEG, maxAbs, soft)).toBeLessThan(maxAbs);
    for (const a of [0.3, 2.6, 2.8, 3.5, 5]) {
      expect(softLimitSymmetric(-a, maxAbs, soft)).toBeCloseTo(-softLimitSymmetric(a, maxAbs, soft), 12);
    }
    let last = -Infinity;
    for (let a = -400; a <= 400; a += 0.5) {
      const v = softLimitSymmetric(a * DEG, maxAbs, soft);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    // softZone <= 0 → 하드 클램프
    expect(softLimitSymmetric(4, 3, 0)).toBe(3);
    expect(softLimitSymmetric(-4, 3, 0)).toBe(-3);
  });

  it('3. unwrapNear: ±π 경계를 넘어도 기준 근처 연속값을 반환', () => {
    expect(unwrapNear(Math.PI - 0.1, Math.PI - 0.2)).toBeCloseTo(Math.PI - 0.1, 12);
    expect(unwrapNear(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(Math.PI + 0.1, 12);
  });

  it('4. calcSegmentWeight: 길이 0.10 → 0, 0.50 → 1, visibility 0.1 → 0', () => {
    expect(calcSegmentWeight(0.10, 0.9, CFG)).toBe(0);
    expect(calcSegmentWeight(0.50, 0.9, CFG)).toBe(1);
    expect(calcSegmentWeight(0.50, 0.1, CFG)).toBe(0);
    const mid = calcSegmentWeight(0.275, 0.9, CFG);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('5. stabilizeArm 가중치 1 등가성: 위팔/전완이 기존 공식과 1e-9 일치', () => {
    const cases: Array<Partial<ArmStabilizerInput>> = [
      { prevUpperArm: 1.2, rawUpperArm: 1.9, prevForearm: 1.8, rawForearm: 2.4 },
      { prevUpperArm: 2.0, rawUpperArm: 1.1, prevForearm: 2.5, rawForearm: 1.6 },
      { prevUpperArm: 0.6, rawUpperArm: 0.2, prevForearm: 0.3, rawForearm: -0.4, torso: -1.5, prevTorso: -1.6 },
    ];
    for (const c of cases) {
      const input = baseInput(c);
      const out = stabilizeArm(input, CFG);
      const legacyUpper =
        input.prevUpperArm + diffAngle(input.rawUpperArm, input.prevUpperArm) * SMOOTHING;
      expect(out.upperWeight).toBe(1);
      expect(out.forearmWeight).toBe(1);
      expect(Math.abs(out.upperArm - legacyUpper)).toBeLessThan(1e-9);

      // (b) 위팔 입력이 직전과 같을 때 전완도 기존 공식과 일치
      const fixed = baseInput({ ...c, rawUpperArm: input.prevUpperArm });
      const outB = stabilizeArm(fixed, CFG);
      const legacyForearm =
        fixed.prevForearm + diffAngle(fixed.rawForearm, fixed.prevForearm) * SMOOTHING;
      expect(Math.abs(outB.upperArm - fixed.prevUpperArm)).toBeLessThan(1e-9);
      expect(Math.abs(outB.forearm - legacyForearm)).toBeLessThan(1e-9);
    }
  });

  it('6. 전완 지터: 손목이 팔꿈치 ±0.003 안에서 흔들려도 전완 프레임당 |Δ| ≤ 0.5°', () => {
    const settled = runFrames(30, null, () => createFrontLandmarks());
    const rand = createLcg(725);
    const jitter = runFrames(30, settled[settled.length - 1], () => {
      const lm = createFrontLandmarks();
      const le = lm[POSE_LANDMARKS.LEFT_ELBOW];
      lm[POSE_LANDMARKS.LEFT_WRIST] = {
        x: le.x + rand() * NOISE,
        y: le.y + rand() * NOISE,
        z: 0,
        visibility: 0.9,
      };
      return lm;
    });
    let prevForearm = settled[settled.length - 1].boneAngles.leftForearm;
    for (const f of jitter) {
      expect(Math.abs(diffAngle(f.boneAngles.leftForearm, prevForearm))).toBeLessThanOrEqual(0.5 * DEG);
      prevForearm = f.boneAngles.leftForearm;
    }
  });

  it('7. 위팔 지터: 팔꿈치가 어깨 ±0.003 안에서 흔들려도 위팔 프레임당 |Δ| ≤ 0.5°', () => {
    const settled = runFrames(30, null, () => createFrontLandmarks());
    const rand = createLcg(1234);
    const jitter = runFrames(30, settled[settled.length - 1], () => {
      const lm = createFrontLandmarks();
      const ls = lm[POSE_LANDMARKS.LEFT_SHOULDER];
      lm[POSE_LANDMARKS.LEFT_ELBOW] = {
        x: ls.x + rand() * NOISE,
        y: ls.y + rand() * NOISE,
        z: 0,
        visibility: 0.9,
      };
      return lm;
    });
    let prevUpper = settled[settled.length - 1].boneAngles.leftUpperArm;
    for (const f of jitter) {
      expect(Math.abs(diffAngle(f.boneAngles.leftUpperArm, prevUpper))).toBeLessThanOrEqual(0.5 * DEG);
      prevUpper = f.boneAngles.leftUpperArm;
    }
  });

  it('8. 접힘 방향 유지: 상대각 150° 수렴 후 200° 입력에도 부호 유지 및 |상대각| ≤ 165°', () => {
    const upper = 1.0;
    let state = { upperArm: upper, forearm: upper + 150 * DEG };
    for (let i = 0; i < 40; i++) {
      state = stabilizeArm(
        baseInput({
          rawUpperArm: upper,
          rawForearm: upper + 150 * DEG,
          prevUpperArm: state.upperArm,
          prevForearm: state.forearm,
        }),
        CFG,
      );
    }
    let rel = diffAngle(state.forearm, state.upperArm);
    expect(rel).toBeGreaterThan(140 * DEG);
    for (let i = 0; i < 20; i++) {
      state = stabilizeArm(
        baseInput({
          rawUpperArm: upper,
          rawForearm: upper + 200 * DEG,
          prevUpperArm: state.upperArm,
          prevForearm: state.forearm,
        }),
        CFG,
      );
      rel = state.forearm - state.upperArm;
      expect(rel).toBeGreaterThan(0);
      expect(Math.abs(rel)).toBeLessThanOrEqual(CFG.elbowMaxFlexDeg * DEG);
    }
  });

  it('9. 연속성: 상대각 100°→200°를 1°씩 입력 → 출력 단조 비감소, 프레임당 증가 ≤ 1°', () => {
    const upper = 0.8;
    let state = { upperArm: upper, forearm: upper + 100 * DEG };
    for (let i = 0; i < 60; i++) {
      state = stabilizeArm(
        baseInput({
          rawUpperArm: upper,
          rawForearm: upper + 100 * DEG,
          prevUpperArm: state.upperArm,
          prevForearm: state.forearm,
        }),
        CFG,
      );
    }
    let lastRel = state.forearm - state.upperArm;
    for (let deg = 101; deg <= 200; deg++) {
      state = stabilizeArm(
        baseInput({
          rawUpperArm: upper,
          rawForearm: upper + deg * DEG,
          prevUpperArm: state.upperArm,
          prevForearm: state.forearm,
        }),
        CFG,
      );
      const rel = state.forearm - state.upperArm;
      expect(rel - lastRel).toBeGreaterThanOrEqual(-1e-12);
      expect(rel - lastRel).toBeLessThanOrEqual(1 * DEG + 1e-12);
      lastRel = rel;
    }
    expect(lastRel).toBeLessThanOrEqual(CFG.elbowMaxFlexDeg * DEG);
  });

  it('10. 가림: 손목 visibility 0.1 → 전완 상대각이 직전과 동일', () => {
    const settled = runFrames(30, null, () => createFrontLandmarks());
    const last = settled[settled.length - 1];
    const prevRel = diffAngle(last.boneAngles.leftForearm, last.boneAngles.leftUpperArm);
    const lm = createFrontLandmarks();
    lm[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.20, y: 0.20, z: 0, visibility: 0.1 };
    const next = PoseAngleSolver.solve(lm, last);
    const rel = diffAngle(next.boneAngles.leftForearm, next.boneAngles.leftUpperArm);
    expect(Math.abs(rel - prevRel)).toBeLessThan(1e-9);
  });

  it('11. PoseAngleSolver.solve armConfidence: 정상 포즈 1, 손목 가림 시 < 0.01, 0~1 범위', () => {
    const normal = PoseAngleSolver.solve(createFrontLandmarks(), null);
    expect(normal.armConfidence).toBeDefined();
    expect(normal.armConfidence!.left).toBe(1);
    expect(normal.armConfidence!.right).toBe(1);

    const lm = createFrontLandmarks();
    lm[POSE_LANDMARKS.LEFT_WRIST] = { ...lm[POSE_LANDMARKS.LEFT_WRIST], visibility: 0.1 };
    // visibility 누락(undefined) → 0 취급
    const rw = lm[POSE_LANDMARKS.RIGHT_WRIST];
    lm[POSE_LANDMARKS.RIGHT_WRIST] = { x: rw.x, y: rw.y, z: rw.z } as unknown as NormalizedLandmark;
    const occluded = PoseAngleSolver.solve(lm, normal);
    for (const v of [occluded.armConfidence!.left, occluded.armConfidence!.right]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(0.01);
    }

    // 포즈 미인식 경로는 armConfidence 미포함
    expect(PoseAngleSolver.solve(null, null).armConfidence).toBeUndefined();
  });

  it('12. config.armStabilizer 부분 주입이 기본값과 병합됨', () => {
    const lm = createFrontLandmarks();
    const override = { fullLengthRatio: 0.9 };
    const merged = { ...CFG, ...override };
    const frame = PoseAngleSolver.solve(lm, null, { armStabilizer: override });

    const sw = calcShoulderWidth(lm[POSE_LANDMARKS.LEFT_SHOULDER], lm[POSE_LANDMARKS.RIGHT_SHOULDER]);
    const upperRatio = calcDistance(lm[POSE_LANDMARKS.LEFT_SHOULDER], lm[POSE_LANDMARKS.LEFT_ELBOW]) / sw;
    const foreRatio = calcDistance(lm[POSE_LANDMARKS.LEFT_ELBOW], lm[POSE_LANDMARKS.LEFT_WRIST]) / sw;
    const expected = Math.min(
      calcSegmentWeight(upperRatio, 0.9, merged),
      calcSegmentWeight(foreRatio, 0.9, merged),
    );
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(1);
    expect(frame.armConfidence!.left).toBeCloseTo(expected, 12);

    // 기본 config 객체는 변경되지 않음
    expect(CFG.fullLengthRatio).toBe(0.40);
  });
});
