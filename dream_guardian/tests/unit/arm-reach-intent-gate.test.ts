/**
 * arm-reach-intent-gate.test.ts - 버스 팔 intent는 후보만, 최종 확정은 포즈 판정
 *
 * @see Issue #306 [BUG-ARM-INTENT-GATE-001]
 * @see Issue #287 [INPUT-ARM-DIRECTION-001]
 * @see Issue #303 [INPUT-ARM-HOLD-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { MotionIntentBus } from '../../src/motion/MotionIntentBus.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import type { MotionIntent } from '../../src/types/motion-intent.js';

function createMockPose(options: {
  leftWrist?: { x: number; y: number; visibility?: number };
  rightWrist?: { x: number; y: number; visibility?: number };
  leftElbow?: { x: number; y: number; visibility?: number };
  rightElbow?: { x: number; y: number; visibility?: number };
  leftShoulder?: { x: number; y: number; visibility?: number };
  rightShoulder?: { x: number; y: number; visibility?: number };
  leftHip?: { x: number; y: number; visibility?: number };
  rightHip?: { x: number; y: number; visibility?: number };
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
  landmarks[POSE_LANDMARKS.LEFT_ELBOW] = {
    x: options.leftElbow?.x ?? 0.42,
    y: options.leftElbow?.y ?? 0.48,
    z: 0,
    visibility: options.leftElbow?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = {
    x: options.rightElbow?.x ?? 0.58,
    y: options.rightElbow?.y ?? 0.48,
    z: 0,
    visibility: options.rightElbow?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = {
    x: options.leftWrist?.x ?? 0.45,
    y: options.leftWrist?.y ?? 0.55,
    z: 0,
    visibility: options.leftWrist?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = {
    x: options.rightWrist?.x ?? 0.55,
    y: options.rightWrist?.y ?? 0.55,
    z: 0,
    visibility: options.rightWrist?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = {
    x: options.leftHip?.x ?? 0.45,
    y: options.leftHip?.y ?? 0.65,
    z: 0,
    visibility: options.leftHip?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = {
    x: options.rightHip?.x ?? 0.55,
    y: options.rightHip?.y ?? 0.65,
    z: 0,
    visibility: options.rightHip?.visibility ?? 0.9,
  };
  return landmarks;
}

function reachIntent(type: 'reachLeft' | 'reachRight', timestamp: number): MotionIntent {
  return {
    type,
    confidence: 0.92,
    timestamp,
    sourceCursor: type === 'reachLeft' ? 'left_hand' : 'right_hand',
    payload: { x: type === 'reachLeft' ? 0.2 : 0.8, y: 0.5 },
  };
}

const neutralPose = () =>
  createMockPose({
    leftWrist: { x: 0.42, y: 0.50, visibility: 0.95 },
    rightWrist: { x: 0.58, y: 0.50, visibility: 0.95 },
  });

const leftReachPose = () =>
  createMockPose({
    leftWrist: { x: 0.17, y: 0.35, visibility: 0.95 },
    rightWrist: { x: 0.58, y: 0.50, visibility: 0.95 },
  });

describe('ArmReach intent gate (Issue #306 / BUG-ARM-INTENT-GATE-001)', () => {
  let selector: ArmReachAnswerSelector;
  let bus: MotionIntentBus;

  beforeEach(() => {
    selector = new ArmReachAnswerSelector({ isMirrored: false });
    bus = new MotionIntentBus(undefined, 'ANSWER_SELECT');
    selector.attachIntentBus(bus);
  });

  it('버스 intent만으로는 확정하지 않는다 (포즈 없음)', () => {
    selector.openWindow();
    const published = bus.publish(reachIntent('reachLeft', 1.0));

    expect(published).toBe(true);
    expect(selector.isConfirmed).toBe(false);
    expect(selector.selectByReachIntent(0, 4, reachIntent('reachLeft', 1.0))).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('수직 스윙 포즈 + 매칭 버스 intent는 확정하지 않는다', () => {
    selector.openWindow();
    const base = createMockPose({
      leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 },
    });
    selector.update(0.0, base);

    bus.publish(reachIntent('reachLeft', 0.1));
    const vertical = createMockPose({
      leftWrist: { x: 0.32, y: 0.10, visibility: 0.95 },
    });
    const res = selector.update(0.1, vertical);

    expect(res).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('양팔 동시 유효 + 매칭 버스 intent는 상호배제로 확정하지 않는다', () => {
    selector.openWindow();
    selector.update(0.0, neutralPose());
    bus.publish(reachIntent('reachLeft', 0.1));

    const both = createMockPose({
      leftWrist: { x: 0.17, y: 0.35, visibility: 0.95 },
      rightWrist: { x: 0.83, y: 0.35, visibility: 0.95 },
    });
    const res = selector.update(0.1, both);

    expect(res).toBeNull();
    expect(selector.isConfirmed).toBe(false);
    expect(selector.state.isMutualExclusionBlocked).toBe(true);
  });

  it('점프 포즈 + 매칭 버스 intent는 확정하지 않는다', () => {
    selector.openWindow();
    const base = createMockPose({
      leftWrist: { x: 0.40, y: 0.40, visibility: 0.95 },
      leftHip: { x: 0.45, y: 0.65, visibility: 0.95 },
      rightHip: { x: 0.55, y: 0.65, visibility: 0.95 },
    });
    selector.update(0.0, base);
    bus.publish(reachIntent('reachLeft', 0.1));

    const jumped = createMockPose({
      leftWrist: { x: 0.17, y: 0.20, visibility: 0.95 },
      leftHip: { x: 0.45, y: 0.50, visibility: 0.95 },
      rightHip: { x: 0.55, y: 0.50, visibility: 0.95 },
    });
    const res = selector.update(0.1, jumped);

    expect(res).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('1초 미만 사전 뻗기 유지 + 버스 intent는 확정하지 않는다', () => {
    selector.openWindow();
    const held = leftReachPose();
    selector.update(0.0, held);
    bus.publish(reachIntent('reachLeft', 0.4));
    const res = selector.update(0.4, held);

    expect(res).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('현재 창의 유효 포즈와 매칭되는 in-window 후보만 정확히 1회 확정한다', () => {
    selector.openWindow();
    const base = createMockPose({
      leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 },
    });
    selector.update(0.0, base);
    bus.publish(reachIntent('reachLeft', 0.1));

    const reached = leftReachPose();
    const res = selector.update(0.1, reached);

    expect(res).not.toBeNull();
    expect(res?.answerIndex).toBe(0);
    expect(res?.zoneId).toBe(4);
    expect(res?.source).toBe('motion');
    expect(selector.isConfirmed).toBe(true);

    expect(selector.update(0.2, reached)).toBeNull();
    expect(selector.selectByReachIntent(0, 4, reachIntent('reachLeft', 0.2))).toBeNull();
  });

  it('closeWindow 이후 늦은 intent는 확정하지 않는다', () => {
    selector.openWindow();
    selector.update(0.0, neutralPose());
    selector.closeWindow();

    bus.publish(reachIntent('reachLeft', 1.5));
    expect(selector.selectByReachIntent(0, 4, reachIntent('reachLeft', 1.6))).toBeNull();
    expect(selector.isConfirmed).toBe(false);

    selector.openWindow();
    const base = createMockPose({
      leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 },
    });
    selector.update(1.7, base);
    const vertical = createMockPose({
      leftWrist: { x: 0.32, y: 0.10, visibility: 0.95 },
    });
    expect(selector.update(1.8, vertical)).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('이전 창 intent는 새 창의 무효 포즈를 확정하지 않는다', () => {
    selector.openWindow();
    bus.publish(reachIntent('reachLeft', 0.2));
    selector.closeWindow();

    selector.openWindow();
    const vertical = createMockPose({
      leftWrist: { x: 0.32, y: 0.10, visibility: 0.95 },
    });
    selector.update(2.0, createMockPose({
      leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 },
    }));
    const res = selector.update(2.1, vertical);

    expect(res).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('창 개방 전에 도착한 stale intent는 무효 포즈를 확정하지 않는다', () => {
    bus.publish(reachIntent('reachLeft', 0.1));
    selector.openWindow();

    selector.update(1.0, createMockPose({
      leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 },
    }));
    const res = selector.update(1.1, createMockPose({
      leftWrist: { x: 0.32, y: 0.10, visibility: 0.95 },
    }));

    expect(res).toBeNull();
    expect(selector.isConfirmed).toBe(false);
  });

  it('직접 포즈 경로·키보드·터치·팔꿈치 fallback은 유지된다', () => {
    const poseOnly = new ArmReachAnswerSelector({ isMirrored: false });
    poseOnly.openWindow();
    poseOnly.update(
      0.0,
      createMockPose({ leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 } }),
    );
    const poseRes = poseOnly.update(0.1, leftReachPose());
    expect(poseRes?.answerIndex).toBe(0);
    expect(poseRes?.source).toBe('motion');

    const kb = new ArmReachAnswerSelector({ isMirrored: false });
    kb.openWindow();
    expect(kb.selectByFallback(1, 3.0)?.source).toBe('keyboard');
    expect(kb.isConfirmed).toBe(true);

    const touch = new ArmReachAnswerSelector({ isMirrored: false });
    touch.openWindow();
    expect(touch.fromTouch(0, 4.0)?.source).toBe('touch');

    const elbow = new ArmReachAnswerSelector({ isMirrored: false });
    elbow.openWindow();
    elbow.update(
      0.0,
      createMockPose({
        leftWrist: { x: 0.45, y: 0.55, visibility: 0.1 },
        leftElbow: { x: 0.40, y: 0.48, visibility: 0.95 },
      }),
    );
    const elbowRes = elbow.update(
      0.1,
      createMockPose({
        leftWrist: { x: 0.17, y: 0.35, visibility: 0.1 },
        leftElbow: { x: 0.22, y: 0.40, visibility: 0.95 },
      }),
    );
    expect(elbowRes).not.toBeNull();
    expect(elbowRes?.answerIndex).toBe(0);
    expect(elbowRes?.hand).toBe('left');
  });
});
