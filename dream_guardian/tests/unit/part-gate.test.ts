import { describe, it, expect } from 'vitest';
import { PartGateEvaluator } from '../../src/input/PartGateEvaluator.js';
import { CalibrationHelper, type CalibrationBaseline } from '../../src/motion/CalibrationHelper.js';
import { AnswerSelector } from '../../src/input/AnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import type { AnswerPosture, PartGate } from '../../src/types/posture.js';

function createMockLandmarks(overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
  }
  for (const [idxStr, val] of Object.entries(overrides)) {
    const idx = parseInt(idxStr, 10);
    lm[idx] = { ...lm[idx], ...val };
  }
  return lm;
}

describe('PartGateEvaluator (Issue #126 - POSE-004)', () => {
  const mockBaseline: CalibrationBaseline = {
    noseX: 0.50,
    noseY: 0.15,
    shoulderX: 0.50,
    shoulderY: 0.35,
    shoulderWidth: 0.25,
    hipX: 0.50,
    hipY: 0.58,
  };

  describe('스쿼트(골반 Y 하강 변위) 게이트 검증', () => {
    const squatGate: PartGate = {
      part: 'hip',
      axis: 'y',
      threshold: 0.08, // baseline 대비 최소 0.08 이상 하강
    };

    it('단순 직립 상태(골반 변위 미달)에서는 게이트 통과 실패 (RC-3 해결)', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      // 직립: 골반 Y가 baseline(0.58)과 유사한 0.59 (변위 = 0.01 < 0.08)
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_HIP]: { y: 0.59 },
        [POSE_LANDMARKS.RIGHT_HIP]: { y: 0.59 },
      });

      const passed = evaluator.evaluateGate(squatGate, lm);
      expect(passed).toBe(false);
    });

    it('실제 스쿼트 동작(골반 하강 변위 >= 0.08) 수행 시 게이트 통과', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      // 스쿼트: 골반 Y가 0.68로 하강 (변위 = 0.10 >= 0.08)
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_HIP]: { y: 0.68 },
        [POSE_LANDMARKS.RIGHT_HIP]: { y: 0.68 },
      });

      const passed = evaluator.evaluateGate(squatGate, lm);
      expect(passed).toBe(true);
    });
  });

  describe('머리(코 X 좌우 기울이기) 게이트 검증', () => {
    const tiltRightGate: PartGate = {
      part: 'head',
      axis: 'x',
      threshold: 0.06, // baseline 대비 우측으로 0.06 이상 이동
    };

    const tiltLeftGate: PartGate = {
      part: 'head',
      axis: 'x',
      threshold: -0.06, // baseline 대비 좌측으로 0.06 이상 이동
    };

    it('정면 주시(변위 미달) 시 좌/우 기울임 게이트 불통과', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.51 }, // baseline(0.50) 대비 +0.01
      });

      expect(evaluator.evaluateGate(tiltRightGate, lm)).toBe(false);
      expect(evaluator.evaluateGate(tiltLeftGate, lm)).toBe(false);
    });

    it('우측으로 머리 기울임(noseX = 0.58) 시 우측 게이트 통과', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.58 }, // +0.08 >= +0.06
      });

      expect(evaluator.evaluateGate(tiltRightGate, lm)).toBe(true);
      expect(evaluator.evaluateGate(tiltLeftGate, lm)).toBe(false);
    });

    it('좌측으로 머리 기울임(noseX = 0.42) 시 좌측 게이트 통과', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.42 }, // -0.08 <= -0.06
      });

      expect(evaluator.evaluateGate(tiltLeftGate, lm)).toBe(true);
      expect(evaluator.evaluateGate(tiltRightGate, lm)).toBe(false);
    });
  });

  describe('손(상향 만세 변위) 게이트 검증', () => {
    const overheadGate: PartGate = {
      part: 'leftHand',
      axis: 'y',
      threshold: 0.10, // baseline 어깨(0.35)보다 0.10 이상 상향 (wristY <= 0.25)
    };

    it('팔을 내리고 있는 상태(wristY = 0.50)에서는 불통과', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_WRIST]: { y: 0.50 },
      });

      expect(evaluator.evaluateGate(overheadGate, lm)).toBe(false);
    });

    it('팔을 위로 올린 상태(wristY = 0.20)에서는 통과', () => {
      const evaluator = new PartGateEvaluator({ baseline: mockBaseline });
      const lm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_WRIST]: { y: 0.20 }, // 0.35 - 0.20 = 0.15 >= 0.10
      });

      expect(evaluator.evaluateGate(overheadGate, lm)).toBe(true);
    });
  });

  describe('미보정(Uncalibrated) 및 랜드마크 누락 폴백', () => {
    it('lenientIfUncalibrated: true 시 baseline 부재여도 게임 진행을 차단하지 않고 true 반환', () => {
      const evaluator = new PartGateEvaluator({ baseline: null, lenientIfUncalibrated: true });
      const gate: PartGate = { part: 'hip', axis: 'y', threshold: 0.08 };
      const lm = createMockLandmarks();

      expect(evaluator.evaluateGate(gate, lm)).toBe(true);
    });

    it('lenientIfUncalibrated: false 시 baseline 부재이면 false 반환', () => {
      const evaluator = new PartGateEvaluator({ baseline: null, lenientIfUncalibrated: false });
      const gate: PartGate = { part: 'hip', axis: 'y', threshold: 0.08 };
      const lm = createMockLandmarks();

      expect(evaluator.evaluateGate(gate, lm)).toBe(false);
    });
  });

  describe('AnswerSelector와 CalibrationHelper 연동 통합 검증', () => {
    it('스쿼트 요구 문제에서 baseline 변위 미달 시 체류 진행도가 충전되지 않는다 (RC-3 해결)', () => {
      const calHelper = new CalibrationHelper(0.1);
      const calLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.35, y: 0.35 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.65, y: 0.35 },
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.40, y: 0.60 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.60, y: 0.60 },
        [POSE_LANDMARKS.NOSE]: { x: 0.50, y: 0.15 },
      });
      calHelper.update(0.1, calLm);
      expect(calHelper.isDone).toBe(true);

      const as = new AnswerSelector();
      as.setCalibrationBaseline(calHelper.baseline);

      // 강제로 선택지 0에 스쿼트 게이트가 있는 자세 주입
      const squatPosture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['hip'],
        zoneIds: [7], // 존 7 (중하)
        binding: 'any',
        patternId: 'TEST_SQUAT',
        gates: [
          { part: 'hip', axis: 'y', threshold: 0.08 },
        ],
      };

      // 골반이 존 7 영역(x: 0.37~0.63, y: 0.58~0.74)에 있지만 하강하지 않은 직립 상태 (y = 0.60)
      const uprightLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.50, y: 0.60 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.50, y: 0.60 },
      });

      const resUpright = as.updateFromPose(uprightLm, undefined, 0.5);
      expect(resUpright).toBeNull();
      expect(as.choiceProgress[0]).toBe(0); // 게이트 미달로 충전 0

      // 실제 스쿼트 수행: 골반이 y = 0.70으로 하강 (변위 0.10 >= 0.08)
      const squatLmData = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.50, y: 0.70 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.50, y: 0.70 },
      });

      // PartGateEvaluator를 통해 직접 자세 게이트 검증 확인
      expect(as.gateEvaluator.evaluatePostureGates(squatPosture, squatLmData)).toBe(true);
    });
  });
});
