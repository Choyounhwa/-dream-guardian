/**
 * arm-reach-weighted-score.test.ts - 답안 선택 팔 뻗기 가중 신뢰도 스코어링 및 양팔 우세 판정 단위 테스트
 *
 * @see Issue #249 [INPUT-TOLERANCE-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import {
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
  computeWeightedArmScore,
} from '../../config/judgment.config.js';

function createMockPose(options: {
  leftWrist?: { x: number; y: number; visibility?: number };
  rightWrist?: { x: number; y: number; visibility?: number };
  leftShoulder?: { x: number; y: number; visibility?: number };
  rightShoulder?: { x: number; y: number; visibility?: number };
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = {
    x: options.leftShoulder?.x ?? 0.40,
    y: options.leftShoulder?.y ?? 0.35,
    z: 0,
    visibility: options.leftShoulder?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = {
    x: options.rightShoulder?.x ?? 0.60,
    y: options.rightShoulder?.y ?? 0.35,
    z: 0,
    visibility: options.rightShoulder?.visibility ?? 0.9,
  };

  landmarks[POSE_LANDMARKS.LEFT_WRIST] = {
    x: options.leftWrist?.x ?? 0.40,
    y: options.leftWrist?.y ?? 0.60,
    z: 0,
    visibility: options.leftWrist?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = {
    x: options.rightWrist?.x ?? 0.60,
    y: options.rightWrist?.y ?? 0.60,
    z: 0,
    visibility: options.rightWrist?.visibility ?? 0.9,
  };

  return landmarks;
}

describe('ArmReachAnswerSelector - Weighted Score & Dominance (Issue #249 / INPUT-TOLERANCE-001)', () => {
  let selector: ArmReachAnswerSelector;

  const ZONE_4_CENTER = { x: 0.17, y: 0.32 };
  const ZONE_5_CENTER = { x: 0.83, y: 0.32 };

  beforeEach(() => {
    selector = new ArmReachAnswerSelector({ isMirrored: false });
  });

  // Red Scenario 1
  it('1. 뻗음 비율 0.25 미달(0.20)이지만 존 중심 깊이·속도·가시성이 높은 케이스가 score >= 0.70으로 확정된다', () => {
    // shoulderWidth = 0.20, leftShoulder x = 0.21, y = 0.32
    // leftWrist reaches Zone 4 center (0.17, 0.32) -> dist = 0.04 -> armExtensionRatio = 0.04 / 0.20 = 0.20 (< 0.25)
    // Frame 1: outside Zone 4 (x 0.45, y 0.32)
    const pose1 = createMockPose({
      leftShoulder: { x: 0.21, y: 0.32, visibility: 1.0 },
      rightShoulder: { x: 0.41, y: 0.32, visibility: 1.0 },
      leftWrist: { x: 0.45, y: 0.32, visibility: 1.0 },
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    selector.update(0.0, pose1);

    // Frame 2 (dt = 0.1s): moves fast to Zone 4 center (x 0.17, y 0.32)
    // vx = (0.17 - 0.45)/0.1 = -2.8 (outwardVx = 2.8, vy = 0 -> full velocity & dominance score 1.0)
    // zonePenetration = 1.0, visibility = 1.0
    // armExtensionRatio = 0.20 -> armExtension score = 0.20 / 0.50 = 0.40
    // weighted score = 0.30(1.0) + 0.25(0.40) + 0.15(1.0) + 0.15(1.0) + 0.15(1.0) = 0.85 >= 0.70
    const pose2 = createMockPose({
      leftShoulder: { x: 0.21, y: 0.32, visibility: 1.0 },
      rightShoulder: { x: 0.41, y: 0.32, visibility: 1.0 },
      leftWrist: { ...ZONE_4_CENTER, visibility: 1.0 },
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    const result = selector.update(0.1, pose2);

    expect(result).not.toBeNull();
    expect(result?.answerIndex).toBe(0);
    expect(result?.zoneId).toBe(4);
    expect(result?.hand).toBe('left');
    expect(selector.isConfirmed).toBe(true);
    expect(selector.confirmedAnswerIndex).toBe(0);
    expect(result?.score).toBeGreaterThanOrEqual(DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold);
  });

  // Red Scenario 2
  it('2. 수평 속도 0.25 미달(0.18)이지만 뻗음 비율이 충분한 케이스가 확정된다', () => {
    // leftShoulder: x 0.40, y 0.32, width: 0.20
    // leftWrist: reaches Zone 4 center (x 0.17, y 0.32), dist = 0.23 -> ratio = 1.15 >= 0.50 (full extension 1.0)
    // Frame 1 (t = 0.0s): leftWrist at x = 0.188, y = 0.32 (outside zone 4)
    // Zone 4 x is [0.04, 0.30]. Wait, 0.188 is inside zone 4.
    // Let's place Frame 1 at x = 0.318 (just outside Zone 4, xMax is 0.30)
    // dt = 0.1s -> target x = 0.30 (boundary) -> vx = (0.30 - 0.318)/0.1 = -0.18
    // Or target x = 0.17 with dt = 1.0s?
    // If Frame 1 at x = 0.188 and dt = 0.1s, vx = (0.170 - 0.188)/0.1 = -0.18
    // Let's make Frame 1 at x = 0.318 (outside zone 4), Frame 2 at x = 0.300 (just entered zone 4), dt = 0.1s:
    // vx = -0.18, outwardSpeed = 0.18 < 0.25
    // Better: Frame 1 at x = 0.318, Frame 2 at x = 0.17 (center), dt = (0.318 - 0.17) / 0.18 = 0.8222s
    const dt = (0.35 - 0.17) / 0.18; // outwardVx = 0.18
    const pose1 = createMockPose({
      leftShoulder: { x: 0.40, y: 0.32, visibility: 1.0 },
      rightShoulder: { x: 0.60, y: 0.32, visibility: 1.0 },
      leftWrist: { x: 0.35, y: 0.32, visibility: 1.0 }, // outside Zone 4 ([0.04, 0.30])
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    selector.update(0.0, pose1);

    const pose2 = createMockPose({
      leftShoulder: { x: 0.40, y: 0.32, visibility: 1.0 },
      rightShoulder: { x: 0.60, y: 0.32, visibility: 1.0 },
      leftWrist: { x: 0.17, y: 0.32, visibility: 1.0 }, // Zone 4 center
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    // vx = (0.17 - 0.35) / dt = -0.18 -> outwardVx = 0.18 < 0.25
    const result = selector.update(dt, pose2);

    expect(result).not.toBeNull();
    expect(result?.answerIndex).toBe(0);
    expect(result?.zoneId).toBe(4);
    expect(selector.isConfirmed).toBe(true);
    expect(result?.score).toBeGreaterThanOrEqual(DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold);
  });

  // Red Scenario 3
  it('3. 모든 게이트가 임계치 근처(각 0.5)인 케이스는 score = 0.50으로 미확정된다', () => {
    // 1) zonePenetration: hand at boundary (x = 0.04, y = 0.32) -> normDist = 1.0 -> 0.50
    // 2) armExtension: shoulder at x = 0.09, y = 0.32, width = 0.20 -> dist = 0.05 -> ratio = 0.25 -> 0.50
    // 3) velocity: outwardVx = 0.25 (dt = 0.1s, prevX = 0.065, currentX = 0.04 -> vx = -0.25 -> outwardVx = 0.25) -> 0.50
    // 4) horizontalDominance: vy = 0.25 / 1.2 = 0.20833 (prevY = 0.32 - 0.020833, currentY = 0.32) -> R = 1.2 -> 0.50
    // 5) visibility: 0.50 -> 0.50
    const pose1 = createMockPose({
      leftShoulder: { x: 0.09, y: 0.32, visibility: 0.9 },
      rightShoulder: { x: 0.29, y: 0.32, visibility: 0.9 },
      leftWrist: { x: 0.065, y: 0.32 - 0.020833, visibility: 0.50 },
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    selector.update(0.0, pose1);

    const pose2 = createMockPose({
      leftShoulder: { x: 0.09, y: 0.32, visibility: 0.9 },
      rightShoulder: { x: 0.29, y: 0.32, visibility: 0.9 },
      leftWrist: { x: 0.04, y: 0.32, visibility: 0.50 }, // boundary of Zone 4
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    const result = selector.update(0.1, pose2);

    expect(result).toBeNull();
    expect(selector.isConfirmed).toBe(false);

    // computeWeightedArmScore helper check
    const gateScores = {
      zonePenetration: 0.5,
      armExtension: 0.5,
      horizontalDominance: 0.5,
      velocity: 0.5,
      visibility: 0.5,
    };
    const totalScore = computeWeightedArmScore(gateScores);
    expect(totalScore).toBeCloseTo(0.50, 2);
  });

  // Red Scenario 4
  it('4. 가시성 0.3 미만이면 다른 게이트가 만점이어도 확정되지 않는다', () => {
    // Hand at Zone 4 center, full extension, moving outward fast, BUT visibility = 0.25 (< 0.30 hard cutoff)
    const pose1 = createMockPose({
      leftWrist: { x: 0.45, y: 0.32, visibility: 0.25 },
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    selector.update(0.0, pose1);

    const pose2 = createMockPose({
      leftWrist: { ...ZONE_4_CENTER, visibility: 0.25 }, // visibility < 0.30
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });
    const result = selector.update(0.1, pose2);

    expect(result).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  // Red Scenario 5
  it('5. 좌 score 0.90 / 우 score 0.70 (비율 1.28배)이면 좌측이 채택된다', () => {
    // Frame 1: Left wrist outside Zone 4, Right wrist near boundary with vis 0.50
    const pose1 = createMockPose({
      leftShoulder: { x: 0.40, y: 0.35, visibility: 0.95 },
      rightShoulder: { x: 0.60, y: 0.35, visibility: 0.95 },
      leftWrist: { x: 0.35, y: 0.32, visibility: 1.0 },
      rightWrist: { x: 0.675, y: 0.32, visibility: 0.50 },
    });
    selector.update(0.0, pose1);

    // Frame 2: Left reaches Zone 4 center (score ~1.00), Right reaches Zone 5 boundary (score ~0.70)
    // vx_right = (0.70 - 0.675)/0.1 = 0.25 -> vel score 0.5, normDist 1.0 -> zone score 0.5, vis 0.5 -> score 0.70
    // Left score ~1.0 >= Right score 0.70 * 1.25 (0.875) -> Left is adopted
    const pose2 = createMockPose({
      leftShoulder: { x: 0.40, y: 0.35, visibility: 0.95 },
      rightShoulder: { x: 0.60, y: 0.35, visibility: 0.95 },
      leftWrist: { ...ZONE_4_CENTER, visibility: 1.0 },
      rightWrist: { x: 0.70, y: 0.32, visibility: 0.50 }, // boundary of Zone 5
    });
    const result = selector.update(0.1, pose2);

    expect(result).not.toBeNull();
    expect(result?.answerIndex).toBe(0);
    expect(result?.zoneId).toBe(4);
    expect(result?.hand).toBe('left');
    expect(selector.isConfirmed).toBe(true);
  });

  // Red Scenario 6
  it('6. 좌 score 0.80 / 우 score 0.75 (비율 1.07배)이면 판정 보류(null)된다', () => {
    // Both left and right arms reach into Zone 4 and Zone 5 with similar high scores
    // (score ratio < 1.25) -> mutual exclusion blocks confirmation
    const pose1 = createMockPose({
      leftShoulder: { x: 0.40, y: 0.35, visibility: 0.95 },
      rightShoulder: { x: 0.60, y: 0.35, visibility: 0.95 },
      leftWrist: { x: 0.35, y: 0.32, visibility: 0.90 },
      rightWrist: { x: 0.65, y: 0.32, visibility: 0.85 },
    });
    selector.update(0.0, pose1);

    const pose2 = createMockPose({
      leftShoulder: { x: 0.40, y: 0.35, visibility: 0.95 },
      rightShoulder: { x: 0.60, y: 0.35, visibility: 0.95 },
      leftWrist: { ...ZONE_4_CENTER, visibility: 0.85 }, // Zone 4 center
      rightWrist: { ...ZONE_5_CENTER, visibility: 0.80 }, // Zone 5 center
    });
    const result = selector.update(0.1, pose2);

    expect(result).toBeNull();
    expect(selector.isConfirmed).toBe(false);
    expect(selector.state.isMutualExclusionBlocked).toBe(true);
  });

  // Red Scenario 7
  it('7. 확정 후 재호출 시 Idempotent(null)를 유지한다', () => {
    const pose = createMockPose({
      leftWrist: { ...ZONE_4_CENTER, visibility: 0.95 },
      rightWrist: { x: 0.60, y: 0.60, visibility: 0.1 },
    });

    const res1 = selector.update(0.0, pose);
    expect(res1).not.toBeNull();
    expect(selector.isConfirmed).toBe(true);

    // Call again -> must return null
    const res2 = selector.update(0.1, pose);
    expect(res2).toBeNull();
    expect(selector.isConfirmed).toBe(true);
  });

  // Red Scenario 8
  it('8. 키보드 1/2 폴백이 기존과 동일하게 동작한다', () => {
    const res1 = selector.fromKeyboard('1', 1.0);
    expect(res1).not.toBeNull();
    expect(res1?.answerIndex).toBe(0);
    expect(res1?.zoneId).toBe(4);
    expect(res1?.source).toBe('keyboard');
    expect(selector.isConfirmed).toBe(true);

    selector.reset();
    expect(selector.isConfirmed).toBe(false);

    const res2 = selector.fromKeyboard('2', 2.0);
    expect(res2).not.toBeNull();
    expect(res2?.answerIndex).toBe(1);
    expect(res2?.zoneId).toBe(5);
    expect(res2?.source).toBe('keyboard');
    expect(selector.isConfirmed).toBe(true);
  });
});
