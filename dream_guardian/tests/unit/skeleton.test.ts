import { describe, it, expect, vi } from 'vitest';
import { JointRenderer } from '../../src/skeleton/JointRenderer.js';
import { BoneRenderer } from '../../src/skeleton/BoneRenderer.js';
import { SkeletonAnimation } from '../../src/skeleton/SkeletonAnimation.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS, SKELETON_CONNECTIONS } from '../../src/types/index.js';

/**
 * 스켈레톤 시각화 엔진 단위 테스트
 * - JointRenderer: 관절 마커
 * - BoneRenderer: 뼈대 라인
 * - SkeletonAnimation: 보간 및 호흡 펄스
 */

/** 33개 더미 랜드마크 */
function makeLandmarks(opts?: Partial<Record<number, Partial<NormalizedLandmark>>>): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 100 + i * 10,
    y: 200 + i * 5,
    z: 0,
    visibility: 0.9,
    ...opts?.[i],
  }));
}

/** Canvas 2D context mock */
function mockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// ═══════════════════════════════════
// JointRenderer
// ═══════════════════════════════════

describe('JointRenderer', () => {
  it('기본 관절 스타일이 정의되어 있다', () => {
    const jr = new JointRenderer();

    // 왼손 시안
    const leftWrist = jr.getStyle(POSE_LANDMARKS.LEFT_WRIST);
    expect(leftWrist).toBeDefined();
    expect(leftWrist!.color).toBe('#28E6FF');
    expect(leftWrist!.shape).toBe('circle');

    // 오른손 노랑
    const rightWrist = jr.getStyle(POSE_LANDMARKS.RIGHT_WRIST);
    expect(rightWrist!.color).toBe('#FFCB4D');

    // 어깨 보라 사각형
    const shoulder = jr.getStyle(POSE_LANDMARKS.LEFT_SHOULDER);
    expect(shoulder!.color).toBe('#C889FF');
    expect(shoulder!.shape).toBe('square');

    // 엉덩이 주황 다이아몬드
    const hip = jr.getStyle(POSE_LANDMARKS.LEFT_HIP);
    expect(hip!.color).toBe('#FF865E');
    expect(hip!.shape).toBe('diamond');
  });

  it('render()가 신뢰도 높은 관절에 대해 드로잉을 호출한다', () => {
    const jr = new JointRenderer();
    const ctx = mockCtx();
    const landmarks = makeLandmarks();

    jr.render(ctx, landmarks);

    // 13개 관절 * 각 1회 fill
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled(); // 어깨 square
  });

  it('신뢰도 낮은 관절은 렌더링하지 않는다', () => {
    const jr = new JointRenderer(undefined, 0.5);
    const ctx = mockCtx();

    // 모든 관절의 신뢰도를 0.2로 설정
    const landmarks = makeLandmarks();
    for (const lm of landmarks) {
      lm.visibility = 0.2;
    }

    jr.render(ctx, landmarks);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('커스텀 스타일이 적용된다', () => {
    const jr = new JointRenderer({
      [POSE_LANDMARKS.NOSE]: { color: '#FF0000', size: 20 },
    });

    const style = jr.getStyle(POSE_LANDMARKS.NOSE);
    expect(style!.color).toBe('#FF0000');
    expect(style!.size).toBe(20);
  });
});

// ═══════════════════════════════════
// BoneRenderer
// ═══════════════════════════════════

describe('BoneRenderer', () => {
  it('연결 수가 SKELETON_CONNECTIONS와 일치한다', () => {
    const br = new BoneRenderer();
    expect(br.connectionCount).toBe(SKELETON_CONNECTIONS.length);
    expect(br.connectionCount).toBe(12);
  });

  it('render()가 신뢰도 높은 뼈대에 대해 stroke를 호출한다', () => {
    const br = new BoneRenderer();
    const ctx = mockCtx();
    const landmarks = makeLandmarks();

    br.render(ctx, landmarks);

    // 12개 연결 모두 그려짐
    expect(ctx.stroke).toHaveBeenCalledTimes(12);
    expect(ctx.moveTo).toHaveBeenCalledTimes(12);
    expect(ctx.lineTo).toHaveBeenCalledTimes(12);
  });

  it('한쪽 끝 신뢰도가 낮으면 해당 뼈대를 건너뛴다', () => {
    const br = new BoneRenderer({ visibilityThreshold: 0.5 });
    const ctx = mockCtx();

    // 왼쪽 어깨 신뢰도를 낮게 설정
    const landmarks = makeLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { visibility: 0.2 },
    });

    br.render(ctx, landmarks);

    // LEFT_SHOULDER와 연결된 뼈:
    // LEFT_SHOULDER - RIGHT_SHOULDER
    // LEFT_SHOULDER - LEFT_HIP
    // LEFT_SHOULDER - LEFT_ELBOW
    // 3개가 빠지므로 12-3=9개
    expect(ctx.stroke).toHaveBeenCalledTimes(9);
  });

  it('커스텀 색상과 두께가 적용된다', () => {
    const br = new BoneRenderer({ color: '#FF0000', lineWidth: 5 });
    const ctx = mockCtx();
    const landmarks = makeLandmarks();

    br.render(ctx, landmarks);

    expect(ctx.strokeStyle).toBe('#FF0000');
    expect(ctx.lineWidth).toBe(5);
  });
});

// ═══════════════════════════════════
// SkeletonAnimation
// ═══════════════════════════════════

describe('SkeletonAnimation', () => {
  it('첫 프레임에서 랜드마크를 즉시 복사한다', () => {
    const anim = new SkeletonAnimation({ lerpFactor: 0.3 });
    const landmarks = makeLandmarks();

    anim.update(0.016, landmarks);

    expect(anim.smoothedLandmarks).toHaveLength(33);
    expect(anim.smoothedLandmarks[0].x).toBeCloseTo(landmarks[0].x);
    expect(anim.smoothedLandmarks[0].y).toBeCloseTo(landmarks[0].y);
  });

  it('보간(lerp)이 점진적으로 접근한다', () => {
    const anim = new SkeletonAnimation({ lerpFactor: 0.5 });

    // 초기 위치
    const initial = makeLandmarks({ 0: { x: 0, y: 0 } });
    anim.update(0.016, initial);

    // 목표 위치
    const target = makeLandmarks({ 0: { x: 100, y: 200 } });
    anim.update(0.016, target);

    // 50% 보간: 0 + (100-0)*0.5 = 50
    expect(anim.smoothedLandmarks[0].x).toBeCloseTo(50);
    expect(anim.smoothedLandmarks[0].y).toBeCloseTo(100);
  });

  it('호흡 펄스가 ±amplitude 범위에서 진동한다', () => {
    const anim = new SkeletonAnimation({
      breathCycle: 2.0,
      breathAmplitude: 0.05,
    });

    const landmarks = makeLandmarks();

    // 주기의 1/4에서 sin = 1 → scale = 1.05
    anim.update(0.5, landmarks); // t=0.5, cycle=2 → sin(π/2) = 1

    expect(anim.breathScale).toBeCloseTo(1.05, 3);

    // 주기의 3/4에서 sin = -1 → scale = 0.95
    anim.update(1.0, landmarks); // t=1.5 → sin(3π/2) = -1

    expect(anim.breathScale).toBeCloseTo(0.95, 3);
  });

  it('reset()이 보간 상태를 초기화한다', () => {
    const anim = new SkeletonAnimation();
    anim.update(0.016, makeLandmarks());
    expect(anim.smoothedLandmarks).toHaveLength(33);

    anim.reset();
    expect(anim.smoothedLandmarks).toHaveLength(0);
    expect(anim.breathScale).toBe(1);
  });

  it('lerpFactor=1이면 즉시 목표에 도달한다', () => {
    const anim = new SkeletonAnimation({ lerpFactor: 1.0 });

    anim.update(0.016, makeLandmarks({ 0: { x: 0, y: 0 } }));
    anim.update(0.016, makeLandmarks({ 0: { x: 500, y: 300 } }));

    expect(anim.smoothedLandmarks[0].x).toBeCloseTo(500);
    expect(anim.smoothedLandmarks[0].y).toBeCloseTo(300);
  });

  it('visibility는 보간 없이 즉시 반영된다', () => {
    const anim = new SkeletonAnimation({ lerpFactor: 0.1 });

    anim.update(0.016, makeLandmarks({ 0: { visibility: 0.9 } }));
    anim.update(0.016, makeLandmarks({ 0: { visibility: 0.2 } }));

    // visibility는 lerpFactor와 무관하게 즉시 반영
    expect(anim.smoothedLandmarks[0].visibility).toBe(0.2);
  });
});
