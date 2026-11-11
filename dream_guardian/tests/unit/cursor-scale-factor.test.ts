/**
 * cursor-scale-factor.test.ts - 웹캠 거리 비례 손 커서 최대 확대율 1.5배 제한 및 기본 크기 70% 축소 검증
 *
 * @see Issue #723 [FEAT-CURSOR-007]
 */

import { describe, it, expect } from 'vitest';
import { CursorTracker } from '../../src/input/CursorTracker.js';
import { CURSOR_DIMENSIONS } from '../../config/cursor.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

function createMockLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
  }
  // 코 (head): 0
  lm[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  // 왼어깨 11, 오른어깨 12 (기준 어깨 거리 0.18)
  lm[11] = { x: 0.41, y: 0.35, z: 0, visibility: 0.95 };
  lm[12] = { x: 0.59, y: 0.35, z: 0, visibility: 0.95 };
  // 왼손목 15, 오른손목 16
  lm[15] = { x: 0.25, y: 0.5, z: 0, visibility: 0.95 };
  lm[16] = { x: 0.75, y: 0.5, z: 0, visibility: 0.95 };
  return lm;
}

describe('[FEAT-CURSOR-007] 웹캠 거리 비례 손 커서 확대율 및 기본 크기 70% 축소 검증 (Issue #723)', () => {
  it('손 커서 기본 반지름이 기존(60px)의 70% 수준인 42px 및 비례 min/max 반경으로 설정되어 있다', () => {
    // 60px * 0.7 = 42px
    expect(CURSOR_DIMENSIONS.hand.defaultRadius).toBe(42);
    expect(CURSOR_DIMENSIONS.hand.minRadius).toBe(15);
    expect(CURSOR_DIMENSIONS.hand.maxRadius).toBe(80);
    expect(CURSOR_DIMENSIONS.hand.pulseRingOffset).toBe(7);
    expect(CURSOR_DIMENSIONS.hand.pulseRingAmplitude).toBe(4);
  });

  it('사용자가 카메라에 매우 가까이 다가와도 scaleFactor가 최대 1.5배로 제한된다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();

    // 기준 거리 baselineShoulder = 0.18
    // 어깨 거리를 0.45로 매우 크게 설정 (0.45 / 0.18 = 2.5배 -> 1.5배로 클램핑되어야 함)
    lm[11] = { x: 0.25, y: 0.35, z: 0, visibility: 0.95 };
    lm[12] = { x: 0.70, y: 0.35, z: 0, visibility: 0.95 }; // dist = 0.45

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand');
    expect(leftHand).toBeDefined();
    expect(leftHand?.size?.radius).toBeDefined();

    // defaultRadius(42) * max scaleFactor(1.5) = 63
    expect(leftHand!.size!.radius).toBe(63);
  });

  it('사용자가 카메라에서 멀어지면 scaleFactor가 최소 0.70배로 유지된다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();

    // 기준 거리 baselineShoulder = 0.18
    // 어깨 거리를 0.05로 매우 작게 설정 (0.05 / 0.18 = 0.27배 -> 0.70배로 클램핑되어야 함)
    lm[11] = { x: 0.475, y: 0.35, z: 0, visibility: 0.95 };
    lm[12] = { x: 0.525, y: 0.35, z: 0, visibility: 0.95 }; // dist = 0.05

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand');
    expect(leftHand).toBeDefined();
    expect(leftHand?.size?.radius).toBeDefined();

    // defaultRadius(42) * min scaleFactor(0.70) = 29.4 -> round = 29
    expect(leftHand!.size!.radius).toBe(29);
  });
});
