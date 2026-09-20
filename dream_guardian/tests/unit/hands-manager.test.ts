import { describe, it, expect } from 'vitest';
import { HandsManager } from '../../src/motion/HandsManager.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

/**
 * HandsManager 단위 테스트
 * - 손 트래킹 손실 시 Fallback 전환 로직 검증
 * - 캐시 만료 검증
 * - Pose wrist fallback 검증
 */

/** 33개 더미 Pose 랜드마크 (가상 좌표) */
function makePoseLandmarks(overrides?: Partial<Record<number, Partial<NormalizedLandmark>>>): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 960,
    y: 540,
    z: 0,
    visibility: 0.9,
    ...overrides?.[i],
  }));
}

describe('HandsManager', () => {
  it('초기 상태가 idle이고 양손 모두 null이다', () => {
    const hm = new HandsManager();
    expect(hm.status).toBe('idle');
    expect(hm.leftHand).toBeNull();
    expect(hm.rightHand).toBeNull();
  });

  it('init()이 MediaPipe 없는 환경에서 error를 반환한다', async () => {
    const hm = new HandsManager();
    const result = await hm.init();
    expect(result).toBe(false);
    expect(hm.status).toBe('error');
  });

  it('setHandData()로 손 데이터를 주입하면 Hands 소스로 위치가 반환된다', () => {
    const hm = new HandsManager({ virtualWidth: 1920, virtualHeight: 1080 });

    // 왼손 데이터 주입 (정규화 좌표)
    hm.setHandData(
      { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
      null,
      100,
    );

    // timestamp=100에서 update (캐시 유효)
    hm.update(100);

    const left = hm.leftHand;
    expect(left).not.toBeNull();
    expect(left!.source).toBe('hands');
    expect(left!.x).toBeCloseTo(0.3 * 1920);  // 576
    expect(left!.y).toBeCloseTo(0.4 * 1080);  // 432
  });

  it('캐시 만료(180ms) 후 Hands 데이터가 무효화된다', () => {
    const hm = new HandsManager({ virtualWidth: 1920, virtualHeight: 1080, cacheTimeout: 180 });

    // 왼손 데이터 주입 at t=100
    hm.setHandData(
      { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
      null,
      100,
    );

    // t=100 → 유효
    hm.update(100);
    expect(hm.leftHand).not.toBeNull();
    expect(hm.leftHand!.source).toBe('hands');

    // t=290 → 만료 (290 - 100 = 190 > 180)
    hm.update(290);
    expect(hm.leftHand).toBeNull(); // Pose fallback도 없으므로 null
  });

  it('Hands 캐시 만료 시 Pose wrist로 fallback된다', () => {
    const hm = new HandsManager({ virtualWidth: 1920, virtualHeight: 1080, cacheTimeout: 180 });

    // 왼손 Hands 데이터 at t=0
    hm.setHandData(
      { x: 0.3, y: 0.4, z: 0, visibility: 0.9 },
      null,
      0,
    );

    // Pose 랜드마크 (이미 가상 좌표)
    const poseLM = makePoseLandmarks({
      [POSE_LANDMARKS.LEFT_WRIST]: { x: 600, y: 400, visibility: 0.85 },
    });

    // t=200 → Hands 캐시 만료, Pose fallback
    hm.update(200, poseLM);

    const left = hm.leftHand;
    expect(left).not.toBeNull();
    expect(left!.source).toBe('pose');
    expect(left!.x).toBeCloseTo(600);
    expect(left!.y).toBeCloseTo(400);
  });

  it('양손 모두 독립적으로 추적된다', () => {
    const hm = new HandsManager({ virtualWidth: 1920, virtualHeight: 1080 });

    hm.setHandData(
      { x: 0.2, y: 0.3, z: 0, visibility: 0.9 },
      { x: 0.8, y: 0.7, z: 0, visibility: 0.85 },
      100,
    );

    hm.update(100);

    expect(hm.leftHand).not.toBeNull();
    expect(hm.rightHand).not.toBeNull();
    expect(hm.leftHand!.x).toBeCloseTo(0.2 * 1920);
    expect(hm.rightHand!.x).toBeCloseTo(0.8 * 1920);
  });

  it('Pose fallback의 visibility가 0.5 미만이면 null을 반환한다', () => {
    const hm = new HandsManager({ virtualWidth: 1920, virtualHeight: 1080, cacheTimeout: 180 });

    const poseLM = makePoseLandmarks({
      [POSE_LANDMARKS.LEFT_WRIST]: { x: 600, y: 400, visibility: 0.3 },
    });

    // Hands 데이터 없이 Pose만 제공
    hm.update(0, poseLM);

    expect(hm.leftHand).toBeNull();
  });

  it('destroy()가 모든 상태를 초기화한다', () => {
    const hm = new HandsManager();
    hm.setHandData(
      { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
      { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
      0,
    );
    hm.update(0);
    expect(hm.leftHand).not.toBeNull();

    hm.destroy();

    expect(hm.status).toBe('idle');
    expect(hm.leftHand).toBeNull();
    expect(hm.rightHand).toBeNull();
  });

  it('Hands가 유효한 동안은 Pose fallback를 사용하지 않는다', () => {
    const hm = new HandsManager({ virtualWidth: 1920, virtualHeight: 1080, cacheTimeout: 180 });

    // Hands 데이터
    hm.setHandData(
      { x: 0.3, y: 0.4, z: 0, visibility: 0.9 },
      null,
      100,
    );

    // Pose 데이터 (다른 위치)
    const poseLM = makePoseLandmarks({
      [POSE_LANDMARKS.LEFT_WRIST]: { x: 999, y: 999, visibility: 0.9 },
    });

    // Hands 캐시 유효 (100 + 50 = 150 < 280)
    hm.update(150, poseLM);

    const left = hm.leftHand;
    expect(left!.source).toBe('hands');
    expect(left!.x).toBeCloseTo(0.3 * 1920); // Hands 좌표 사용
  });
});
