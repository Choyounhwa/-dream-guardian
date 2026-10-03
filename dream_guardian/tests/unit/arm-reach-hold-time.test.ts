/**
 * arm-reach-hold-time.test.ts - 가변 프레임 Hold 명시적 dt API (#307)
 *
 * updateDelta(dt, ...)는 값의 증감을 절대시각으로 오인하지 않고
 * 수용된 dt(초)만큼만 내부 시계와 Hold를 전진시킨다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

function prime(selector: ArmReachAnswerSelector, pose: NormalizedLandmark[]): void {
  selector.update(0, pose);
}

function createHeldPose(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.4, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.6, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.17, y: 0.35, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.55, y: 0.48, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.42, y: 0.62, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.58, y: 0.62, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.9 };
  return landmarks;
}

describe('ArmReachAnswerSelector updateDelta (#307)', () => {
  let selector: ArmReachAnswerSelector;
  const pose = createHeldPose();

  beforeEach(() => {
    selector = new ArmReachAnswerSelector({ isMirrored: false });
    selector.openWindow();
    prime(selector, pose);
  });

  it('가변 dt(0.016/0.033/0.008/0.05) 합 1.00초는 고정 0.016 합과 같은 Hold다', () => {
    const variable = [0.016, 0.033, 0.008, 0.05];
    let variableSum = 0;
    for (const dt of variable) {
      variableSum += dt;
      selector.updateDelta(dt, pose);
    }
    const variableHeld = selector.heldDuration;

    const fixed = new ArmReachAnswerSelector({ isMirrored: false });
    fixed.openWindow();
    prime(fixed, pose);
    let fixedSum = 0;
    const step = 0.016;
    while (fixedSum + 1e-9 < 1) {
      const dt = Math.min(step, 1 - fixedSum);
      fixedSum += dt;
      fixed.updateDelta(dt, pose);
    }

    expect(variableSum).toBeCloseTo(0.107, 6);
    expect(variableHeld).toBeCloseTo(variableSum, 6);
    expect(fixed.heldDuration).toBeCloseTo(1, 6);
    expect(fixed.isConfirmed).toBe(true);
  });

  it('0.99초는 Hold 게이트를 넘지 않고 1.00초와 1.01초는 확정한다', () => {
    selector.updateDelta(0.99, pose);
    expect(selector.heldDuration).toBeCloseTo(0.99, 6);
    expect(selector.isConfirmed).toBe(false);

    const atOne = new ArmReachAnswerSelector({ isMirrored: false });
    atOne.openWindow();
    prime(atOne, pose);
    const resOne = atOne.updateDelta(1.0, pose);
    expect(atOne.heldDuration).toBeGreaterThanOrEqual(1);
    expect(resOne?.answerIndex).toBe(0);
    expect(atOne.isConfirmed).toBe(true);

    const over = new ArmReachAnswerSelector({ isMirrored: false });
    over.openWindow();
    prime(over, pose);
    const resOver = over.updateDelta(1.01, pose);
    expect(resOver?.answerIndex).toBe(0);
    expect(over.isConfirmed).toBe(true);
  });

  it('dt 0, 음수, NaN, Infinity는 Hold와 시계를 전진시키지 않는다', () => {
    selector.updateDelta(0.2, pose);
    const held = selector.heldDuration;

    const clockBeforeReject = selector.monotonicTime;
    expect(selector.updateDelta(0, pose)).toBeNull();
    expect(selector.updateDelta(-0.05, pose)).toBeNull();
    expect(selector.updateDelta(Number.NaN, pose)).toBeNull();
    expect(selector.updateDelta(Number.POSITIVE_INFINITY, pose)).toBeNull();

    expect(selector.heldDuration).toBeCloseTo(held, 6);
    expect(selector.monotonicTime).toBeCloseTo(clockBeforeReject, 6);
    expect(selector.isConfirmed).toBe(false);
  });

  it('이미 열린 창의 openWindow는 Hold를 리셋하지 않고 close+open은 리셋한다', () => {
    selector.updateDelta(0.4, pose);
    expect(selector.heldDuration).toBeCloseTo(0.4, 6);

    selector.openWindow();
    selector.updateDelta(0.4, pose);
    expect(selector.heldDuration).toBeCloseTo(0.8, 6);
    expect(selector.isConfirmed).toBe(false);

    selector.closeWindow();
    selector.openWindow();
    expect(selector.heldDuration).toBe(0);
    selector.updateDelta(0.4, pose);
    expect(selector.heldDuration).toBeCloseTo(0.4, 6);
  });

  it('pause와 stale(랜드마크 없음) 샘플은 Hold에 더하지 않는다', () => {
    selector.updateDelta(0.3, pose);
    selector.setPaused(true);
    selector.updateDelta(0.5, pose);
    expect(selector.heldDuration).toBeCloseTo(0.3, 6);
    expect(selector.isPaused).toBe(true);

    selector.setPaused(false);
    selector.updateDelta(0.2, null);
    expect(selector.heldDuration).toBeCloseTo(0.3, 6);

    selector.updateDelta(0.7, pose);
    expect(selector.heldDuration).toBeCloseTo(1, 6);
    expect(selector.isConfirmed).toBe(true);
  });

  it('기존 update() 절대시각 경로는 증가하는 timestamp로 1초 Hold를 확정한다', () => {
    const legacy = new ArmReachAnswerSelector({ isMirrored: false });
    expect(legacy.update(0, pose)).toBeNull();
    expect(legacy.heldDuration).toBe(0);
    expect(legacy.update(0.5, pose)).toBeNull();
    const res = legacy.update(1.0, pose);
    expect(res?.answerIndex).toBe(0);
    expect(legacy.isConfirmed).toBe(true);
  });
});
