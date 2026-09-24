import { describe, it, expect } from 'vitest';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';
import type { ILocomotionDetector } from '../../src/motion/LocomotionDetector.js';
import { RunDetector } from '../../src/motion/RunDetector.js';
import { HipBounceDetector } from '../../src/motion/HipBounceDetector.js';
import { HipSwayDetector } from '../../src/motion/HipSwayDetector.js';
import { ArmCrossDetector } from '../../src/motion/ArmCrossDetector.js';

function makeLM(overrides?: Partial<Record<number, Partial<NormalizedLandmark>>>): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 960,
    y: 400,
    z: 0,
    visibility: 0.9,
    ...overrides?.[i],
  }));
}

describe('ILocomotionDetector & Alternative Detectors', () => {
  describe('RunDetector (ILocomotionDetector implementation)', () => {
    it('implements ILocomotionDetector with mode "run"', () => {
      const rd: ILocomotionDetector = new RunDetector(5, 0.1);
      expect(rd.mode).toBe('run');
      expect(rd.isRunning).toBe(false);
      expect(rd.stepCount).toBe(0);
    });
  });

  describe('HipBounceDetector (무소음 골반 바운스)', () => {
    it('골반(LEFT_HIP, RIGHT_HIP) 상하 수직 왕복 시 스텝 및 활성 상태를 판정한다', () => {
      const bd = new HipBounceDetector(5, 0.1);
      expect(bd.mode).toBe('hip_bounce');
      expect(bd.stepCount).toBe(0);
      expect(bd.isRunning).toBe(false);

      const baseY = 800;
      // 프레임 1: 초기 골반 Y = 800
      bd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { y: 800 },
          [POSE_LANDMARKS.RIGHT_HIP]: { y: 800 },
        }),
        baseY,
        0,
      );

      // 프레임 2: 아래로 하강 (y 증가 -> 820)
      bd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { y: 820 },
          [POSE_LANDMARKS.RIGHT_HIP]: { y: 820 },
        }),
        baseY,
        0.1,
      );
      expect(bd.isRunning).toBe(true);

      // 프레임 3: 위로 상승 (y 감소 -> 790, 방향 전환 -> 1스텝)
      const stepped = bd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { y: 790 },
          [POSE_LANDMARKS.RIGHT_HIP]: { y: 790 },
        }),
        baseY,
        0.3,
      );

      expect(stepped).toBe(true);
      expect(bd.stepCount).toBe(1);
      expect(bd.isRunning).toBe(true);
    });

    it('reset() 호출 시 스텝 수와 상태가 초기화된다', () => {
      const bd = new HipBounceDetector(5, 0.1);
      bd.update(makeLM({ [POSE_LANDMARKS.LEFT_HIP]: { y: 800 }, [POSE_LANDMARKS.RIGHT_HIP]: { y: 800 } }), 800, 0);
      bd.update(makeLM({ [POSE_LANDMARKS.LEFT_HIP]: { y: 820 }, [POSE_LANDMARKS.RIGHT_HIP]: { y: 820 } }), 800, 0.1);
      bd.update(makeLM({ [POSE_LANDMARKS.LEFT_HIP]: { y: 790 }, [POSE_LANDMARKS.RIGHT_HIP]: { y: 790 } }), 800, 0.3);
      expect(bd.stepCount).toBe(1);

      bd.reset();
      expect(bd.stepCount).toBe(0);
      expect(bd.isRunning).toBe(false);
    });

    it('골반 신뢰도가 낮으면 감지되지 않는다', () => {
      const bd = new HipBounceDetector();
      const stepped = bd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { visibility: 0.3, y: 800 },
          [POSE_LANDMARKS.RIGHT_HIP]: { visibility: 0.9, y: 800 },
        }),
        800,
        0,
      );
      expect(stepped).toBe(false);
      expect(bd.isRunning).toBe(false);
    });
  });

  describe('HipSwayDetector (골반 좌우 스웨이 / 트월킹)', () => {
    it('골반 좌우(X축) 왕복 이동 시 스텝 및 활성 상태를 감지한다', () => {
      const sd = new HipSwayDetector(5, 0.1);
      expect(sd.mode).toBe('hip_sway');
      expect(sd.stepCount).toBe(0);

      const baseY = 800;
      // 프레임 1: 중앙 (X = 960)
      sd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { x: 910, y: 800 },
          [POSE_LANDMARKS.RIGHT_HIP]: { x: 1010, y: 800 },
        }),
        baseY,
        0,
      );

      // 프레임 2: 오른쪽으로 이동 (중심 X = 980 > 960)
      sd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { x: 930, y: 800 },
          [POSE_LANDMARKS.RIGHT_HIP]: { x: 1030, y: 800 },
        }),
        baseY,
        0.1,
      );
      expect(sd.isRunning).toBe(true);

      // 프레임 3: 왼쪽으로 이동 (중심 X = 940, 방향 전환 -> 1스텝)
      const stepped = sd.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_HIP]: { x: 890, y: 800 },
          [POSE_LANDMARKS.RIGHT_HIP]: { x: 990, y: 800 },
        }),
        baseY,
        0.3,
      );

      expect(stepped).toBe(true);
      expect(sd.stepCount).toBe(1);
      expect(sd.isRunning).toBe(true);
    });

    it('reset() 시 상태가 초기화된다', () => {
      const sd = new HipSwayDetector(5, 0.1);
      sd.update(makeLM({ [POSE_LANDMARKS.LEFT_HIP]: { x: 910 }, [POSE_LANDMARKS.RIGHT_HIP]: { x: 1010 } }), 800, 0);
      sd.update(makeLM({ [POSE_LANDMARKS.LEFT_HIP]: { x: 930 }, [POSE_LANDMARKS.RIGHT_HIP]: { x: 1030 } }), 800, 0.1);
      sd.update(makeLM({ [POSE_LANDMARKS.LEFT_HIP]: { x: 890 }, [POSE_LANDMARKS.RIGHT_HIP]: { x: 990 } }), 800, 0.3);
      expect(sd.stepCount).toBe(1);

      sd.reset();
      expect(sd.stepCount).toBe(0);
      expect(sd.isRunning).toBe(false);
    });
  });

  describe('ArmCrossDetector (양손 상하 교차 / 휠 펌핑)', () => {
    it('양손 손목(LEFT_WRIST, RIGHT_WRIST) Y 좌표 교차 역전 시 스텝을 카운트한다', () => {
      const ad = new ArmCrossDetector(5, 0.1);
      expect(ad.mode).toBe('arm_cross');
      expect(ad.stepCount).toBe(0);

      const baseY = 400;
      // 프레임 1: 왼손이 오른손보다 위 (left.y < right.y)
      // leftWrist = 300, rightWrist = 450 (차이 left - right = -150)
      ad.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_WRIST]: { y: 300 },
          [POSE_LANDMARKS.RIGHT_WRIST]: { y: 450 },
        }),
        baseY,
        0,
      );

      // 프레임 2: 지속
      ad.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_WRIST]: { y: 280 },
          [POSE_LANDMARKS.RIGHT_WRIST]: { y: 470 },
        }),
        baseY,
        0.1,
      );
      expect(ad.isRunning).toBe(true);

      // 프레임 3: 역전! 오른손이 왼손보다 위 (left.y > right.y)
      // leftWrist = 460, rightWrist = 290
      const stepped = ad.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_WRIST]: { y: 460 },
          [POSE_LANDMARKS.RIGHT_WRIST]: { y: 290 },
        }),
        baseY,
        0.3,
      );

      expect(stepped).toBe(true);
      expect(ad.stepCount).toBe(1);
      expect(ad.isRunning).toBe(true);
    });

    it('손목 신뢰도가 낮으면 동작하지 않는다', () => {
      const ad = new ArmCrossDetector();
      const stepped = ad.update(
        makeLM({
          [POSE_LANDMARKS.LEFT_WRIST]: { visibility: 0.2, y: 300 },
          [POSE_LANDMARKS.RIGHT_WRIST]: { visibility: 0.9, y: 450 },
        }),
        400,
        0,
      );
      expect(stepped).toBe(false);
      expect(ad.isRunning).toBe(false);
    });

    it('reset() 시 상태가 초기화된다', () => {
      const ad = new ArmCrossDetector(5, 0.1);
      ad.update(makeLM({ [POSE_LANDMARKS.LEFT_WRIST]: { y: 300 }, [POSE_LANDMARKS.RIGHT_WRIST]: { y: 450 } }), 400, 0);
      ad.update(makeLM({ [POSE_LANDMARKS.LEFT_WRIST]: { y: 460 }, [POSE_LANDMARKS.RIGHT_WRIST]: { y: 290 } }), 400, 0.2);
      expect(ad.stepCount).toBe(1);

      ad.reset();
      expect(ad.stepCount).toBe(0);
      expect(ad.isRunning).toBe(false);
    });
  });
});
