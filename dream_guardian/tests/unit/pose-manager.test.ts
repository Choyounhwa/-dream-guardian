import { describe, it, expect } from 'vitest';
import { PoseManager } from '../../src/motion/PoseManager.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

/**
 * PoseManager 단위 테스트
 * - 랜드마크 데이터 수신 및 정규화 변환 검증
 * - 신뢰도 필터링 검증
 * - 스로틀링 및 상태 관리 검증
 */

/** 테스트용 33개 더미 랜드마크 생성 */
function createDummyLandmarks(overrides?: Partial<Record<number, Partial<NormalizedLandmark>>>): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
      ...overrides?.[i],
    });
  }
  return landmarks;
}

describe('PoseManager', () => {
  it('초기 상태가 idle이다', () => {
    const pm = new PoseManager();
    expect(pm.status).toBe('idle');
    expect(pm.hasPose).toBe(false);
    expect(pm.rawLandmarks).toHaveLength(0);
    expect(pm.virtualLandmarks).toHaveLength(0);
  });

  it('init()이 MediaPipe 없는 환경에서 error를 반환한다', async () => {
    const pm = new PoseManager();
    const result = await pm.init();
    expect(result).toBe(false);
    expect(pm.status).toBe('error');
  });

  it('setLandmarks()로 랜드마크를 직접 주입할 수 있다', () => {
    const pm = new PoseManager({ virtualWidth: 1920, virtualHeight: 1080 });
    const landmarks = createDummyLandmarks();

    pm.setLandmarks(landmarks);

    expect(pm.hasPose).toBe(true);
    expect(pm.rawLandmarks).toHaveLength(33);
    expect(pm.virtualLandmarks).toHaveLength(33);
  });

  it('정규화 좌표(0~1)가 가상 해상도로 정확히 변환된다', () => {
    const pm = new PoseManager({ virtualWidth: 1920, virtualHeight: 1080 });
    const landmarks = createDummyLandmarks({
      [POSE_LANDMARKS.NOSE]: { x: 0.5, y: 0.3 },
    });

    pm.setLandmarks(landmarks);

    const nose = pm.getLandmark(POSE_LANDMARKS.NOSE);
    expect(nose).not.toBeNull();
    expect(nose!.x).toBeCloseTo(960);    // 0.5 * 1920
    expect(nose!.y).toBeCloseTo(324);    // 0.3 * 1080
  });

  it('신뢰도가 임계값 미만인 랜드마크는 null을 반환한다', () => {
    const pm = new PoseManager({ visibilityThreshold: 0.5 });
    const landmarks = createDummyLandmarks({
      [POSE_LANDMARKS.LEFT_WRIST]: { visibility: 0.3 },
    });

    pm.setLandmarks(landmarks);

    const wrist = pm.getLandmark(POSE_LANDMARKS.LEFT_WRIST);
    expect(wrist).toBeNull();
  });

  it('신뢰도가 임계값 이상인 랜드마크는 정상 반환된다', () => {
    const pm = new PoseManager({ visibilityThreshold: 0.5 });
    const landmarks = createDummyLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { visibility: 0.8 },
    });

    pm.setLandmarks(landmarks);

    const shoulder = pm.getLandmark(POSE_LANDMARKS.LEFT_SHOULDER);
    expect(shoulder).not.toBeNull();
    expect(shoulder!.visibility).toBe(0.8);
  });

  it('존재하지 않는 인덱스의 랜드마크는 null을 반환한다', () => {
    const pm = new PoseManager();
    const result = pm.getLandmark(99);
    expect(result).toBeNull();
  });

  it('주요 관절 인덱스 상수가 올바르게 정의되어 있다', () => {
    expect(POSE_LANDMARKS.NOSE).toBe(0);
    expect(POSE_LANDMARKS.LEFT_SHOULDER).toBe(11);
    expect(POSE_LANDMARKS.RIGHT_SHOULDER).toBe(12);
    expect(POSE_LANDMARKS.LEFT_HIP).toBe(23);
    expect(POSE_LANDMARKS.RIGHT_HIP).toBe(24);
    expect(POSE_LANDMARKS.LEFT_ANKLE).toBe(27);
    expect(POSE_LANDMARKS.RIGHT_ANKLE).toBe(28);
  });

  it('커스텀 가상 해상도로 좌표가 변환된다', () => {
    const pm = new PoseManager({ virtualWidth: 800, virtualHeight: 600 });
    const landmarks = createDummyLandmarks({
      [POSE_LANDMARKS.RIGHT_WRIST]: { x: 0.25, y: 0.75 },
    });

    pm.setLandmarks(landmarks);

    const wrist = pm.getLandmark(POSE_LANDMARKS.RIGHT_WRIST);
    expect(wrist).not.toBeNull();
    expect(wrist!.x).toBeCloseTo(200);   // 0.25 * 800
    expect(wrist!.y).toBeCloseTo(450);   // 0.75 * 600
  });

  it('destroy()가 상태를 초기화한다', () => {
    const pm = new PoseManager();
    pm.setLandmarks(createDummyLandmarks());
    expect(pm.hasPose).toBe(true);

    pm.destroy();

    expect(pm.status).toBe('idle');
    expect(pm.hasPose).toBe(false);
    expect(pm.rawLandmarks).toHaveLength(0);
  });

  it('빈 랜드마크 배열 주입 시 hasPose가 false이다', () => {
    const pm = new PoseManager();
    pm.setLandmarks([]);
    expect(pm.hasPose).toBe(false);
  });
});
