/**
 * cursor-tracker.test.ts - CursorTracker 단위 테스트 및 기하 유틸 연동 검증
 *
 * @see Issue #104, #105, #118
 * @see Issue #298 [REFACTOR-GEOM-002]
 */

import { describe, it, expect } from 'vitest';
import { CursorTracker } from '../../src/input/CursorTracker.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

function createMockLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
  }
  // 코 (head): 0
  lm[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  // 왼어깨 11, 오른어깨 12
  lm[11] = { x: 0.4, y: 0.35, z: 0, visibility: 0.9 };
  lm[12] = { x: 0.6, y: 0.35, z: 0, visibility: 0.9 };
  // 왼팔꿈치 13, 오른팔꿈치 14
  lm[13] = { x: 0.3, y: 0.4, z: 0, visibility: 0.9 };
  lm[14] = { x: 0.7, y: 0.4, z: 0, visibility: 0.9 };
  // 왼손목 15, 오른손목 16
  lm[15] = { x: 0.15, y: 0.4, z: 0, visibility: 0.95 };
  lm[16] = { x: 0.85, y: 0.4, z: 0, visibility: 0.95 };
  // 왼골반 23, 오른골반 24
  lm[23] = { x: 0.45, y: 0.65, z: 0, visibility: 0.9 };
  lm[24] = { x: 0.55, y: 0.65, z: 0, visibility: 0.9 };
  return lm;
}

describe('CursorTracker - 4-Color Body Cursors & PoseGeometry Integration', () => {
  it('기본 랜드마크로부터 4개 신체 부위 커서(leftHand, rightHand, head, hip)를 추적한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    const cursors = tracker.update(lm);

    expect(cursors.get('leftHand')).toBeDefined();
    expect(cursors.get('rightHand')).toBeDefined();
    expect(cursors.get('head')).toBeDefined();
    expect(cursors.get('hip')).toBeDefined();

    // head: 코 위치 (0.5, 0.2)
    const head = cursors.get('head')!;
    expect(head.x).toBeCloseTo(0.5);
    expect(head.y).toBeCloseTo(0.2);

    // hip: 양 골반 중점 ((0.45 + 0.55) / 2 = 0.5, 0.65)
    const hip = cursors.get('hip')!;
    expect(hip.x).toBeCloseTo(0.5);
    expect(hip.y).toBeCloseTo(0.65);
  });

  it('미러링 옵션(isMirrored: false 기본값) 시 x좌표 반전 없이 그대로 추적한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    lm[0] = { x: 0.3, y: 0.2, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm, undefined, false);
    const head = cursors.get('head')!;
    expect(head.x).toBeCloseTo(0.3);
  });

  it('미러링 옵션(isMirrored: true) 시 x좌표를 반전(1 - x)한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    lm[0] = { x: 0.3, y: 0.2, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm, undefined, true);
    const head = cursors.get('head')!;
    expect(head.x).toBeCloseTo(0.7);
  });

  it('화면 밖 이탈 시 마진(0.02)으로 안전하게 클램핑한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    lm[15] = { x: -0.4, y: 0.4, z: 0, visibility: 0.95 };
    lm[13] = { x: -0.3, y: 0.4, z: 0, visibility: 0.95 };
    lm[11] = { x: -0.2, y: 0.4, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand')!;
    expect(leftHand.x).toBeCloseTo(0.02, 2);
  });

  it('reset() 호출 시 저장된 커서와 스무딩 위치를 모두 비운다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    tracker.update(lm);
    expect(tracker.cursors.size).toBeGreaterThan(0);

    tracker.reset();
    expect(tracker.cursors.size).toBe(0);
    expect(tracker.getCursor('head')).toBeNull();
  });
});
