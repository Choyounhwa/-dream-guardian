import { describe, it, expect, beforeEach } from 'vitest';
import { XGestureDetector } from '../../src/motion/XGestureDetector.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

function createDummyLandmarks(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }
  return landmarks;
}

/**
 * 어깨 너비 0.20 (Left: 0.40, Right: 0.60, Y: 0.30)
 */
function setupShoulders(landmarks: NormalizedLandmark[]): void {
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.30, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.30, z: 0, visibility: 0.95 };
}

describe('XGestureDetector (Issue #171)', () => {
  let detector: XGestureDetector;
  let landmarks: NormalizedLandmark[];

  beforeEach(() => {
    detector = new XGestureDetector();
    landmarks = createDummyLandmarks();
    setupShoulders(landmarks);
  });

  it('초기 상태에서는 isCrossing=false, progress=0, triggered=false 이다', () => {
    expect(detector.isCrossing).toBe(false);
    expect(detector.progress).toBe(0);
    expect(detector.inCooldown).toBe(false);

    const result = detector.update([], 0.016);
    expect(result.isCrossing).toBe(false);
    expect(result.triggered).toBe(false);
    expect(result.progress).toBe(0);
  });

  it('랜드마크 가시성(visibility)이 0.5 미만이면 X자 감지를 수행하지 않는다', () => {
    // 왼손이 오른쪽 어깨에, 오른손이 왼쪽 어깨에 완전히 위치
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.59, y: 0.31, z: 0, visibility: 0.3 }; // 낮은 가시성
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.41, y: 0.31, z: 0, visibility: 0.9 };

    const result = detector.update(landmarks, 0.1);
    expect(result.isCrossing).toBe(false);
    expect(result.progress).toBe(0);
  });

  it('양손이 반대쪽 어깨 관절에 동시에 접근하면 isCrossing=true가 된다', () => {
    // shoulderWidth = 0.20
    // crossThreshold = 0.55 -> max dist = 0.11
    // Left wrist at (0.58, 0.31) -> dist to Right shoulder (0.60, 0.30) = sqrt(0.02^2 + 0.01^2) = 0.02236 (< 0.11)
    // Right wrist at (0.42, 0.31) -> dist to Left shoulder (0.40, 0.30) = sqrt(0.02^2 + 0.01^2) = 0.02236 (< 0.11)
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

    const result = detector.update(landmarks, 0.1);
    expect(result.isCrossing).toBe(true);
    expect(result.triggered).toBe(false);
    expect(result.progress).toBeCloseTo(0.25, 2); // 0.1 / 0.4 = 0.25
  });

  it('한 손만 반대쪽 어깨에 닿은 경우(단일 손 교차)는 X자로 판정하지 않는다', () => {
    // 왼손만 오른쪽 어깨로 가고, 오른손은 아래(0.70, 0.70)에 있음
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.70, y: 0.70, z: 0, visibility: 0.95 };

    const result = detector.update(landmarks, 0.1);
    expect(result.isCrossing).toBe(false);
    expect(result.progress).toBe(0);
    expect(result.triggered).toBe(false);
  });

  it('양손 합장(가슴 중앙 모으기) 자세는 X자로 오인식되지 않는다', () => {
    // 양손이 가슴 중앙 (0.49, 0.45) & (0.51, 0.45)에 모인 합장 자세
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.49, y: 0.45, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.51, y: 0.45, z: 0, visibility: 0.95 };

    const result = detector.update(landmarks, 0.2);
    // dist to opposite shoulders:
    // Left wrist (0.49, 0.45) to Right shoulder (0.60, 0.30): sqrt(0.11^2 + 0.15^2) = 0.186 > 0.11
    // Right wrist (0.51, 0.45) to Left shoulder (0.40, 0.30): sqrt(0.11^2 + 0.15^2) = 0.186 > 0.11
    expect(result.isCrossing).toBe(false);
    expect(result.progress).toBe(0);
    expect(result.triggered).toBe(false);
  });

  it('0.4초간 X자 교차를 유지하면 triggered=true를 1회 반환한다', () => {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

    detector.update(landmarks, 0.2);
    expect(detector.progress).toBeCloseTo(0.5, 2);
    expect(detector.triggered).toBe(false);

    const triggerResult = detector.update(landmarks, 0.2);
    expect(triggerResult.triggered).toBe(true);
    expect(triggerResult.progress).toBe(1.0);
    expect(triggerResult.inCooldown).toBe(true);
  });

  it('트리거 직후 1.0초 쿨다운 동안에는 자세를 계속 유지해도 중복 트리거되지 않는다', () => {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

    // 트리거 발생
    detector.update(landmarks, 0.4);
    expect(detector.triggered).toBe(true);

    // 다음 프레임: 자세 유지 중이지만 트리거는 꺼져야 함
    const nextResult = detector.update(landmarks, 0.1);
    expect(nextResult.triggered).toBe(false);
    expect(nextResult.inCooldown).toBe(true);

    // 쿨다운 0.8초 경과 (누적 0.9초)
    detector.update(landmarks, 0.8);
    expect(detector.triggered).toBe(false);
    expect(detector.inCooldown).toBe(true);

    // 쿨다운 0.2초 추가 경과 (누적 1.1초) -> 쿨다운 해제
    const afterCooldown = detector.update(landmarks, 0.2);
    expect(afterCooldown.inCooldown).toBe(false);
  });

  it('중간에 자세를 풀면 progress가 리셋된다', () => {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

    detector.update(landmarks, 0.3);
    expect(detector.progress).toBeCloseTo(0.75, 2);

    // 자세 풀림
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.20, y: 0.70, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.80, y: 0.70, z: 0, visibility: 0.95 };

    const resetResult = detector.update(landmarks, 0.05);
    expect(resetResult.isCrossing).toBe(false);
    expect(resetResult.progress).toBe(0);
    expect(resetResult.triggered).toBe(false);
  });

  it('reset() 호출 시 모든 상태(진행도, 쿨다운, 트리거)가 초기화된다', () => {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

    detector.update(landmarks, 0.4);
    expect(detector.triggered).toBe(true);
    expect(detector.inCooldown).toBe(true);

    detector.reset();
    expect(detector.isCrossing).toBe(false);
    expect(detector.progress).toBe(0);
    expect(detector.triggered).toBe(false);
    expect(detector.inCooldown).toBe(false);
  });
});
