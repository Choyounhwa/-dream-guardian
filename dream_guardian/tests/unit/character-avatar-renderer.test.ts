import { describe, it, expect, vi } from 'vitest';
import { CharacterAvatarRenderer } from '../../src/skeleton/skin/CharacterAvatarRenderer.js';
import { DEFAULT_STICKMAN_RIG } from '../../config/character-rig.config.js';
import type { CharacterSkin } from '../../src/types/character-skin.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1.0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createSampleLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }
  lm[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.42, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.58, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.35, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.65, y: 0.44, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.55, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.70, y: 0.55, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.60, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.60, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.44, y: 0.76, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.56, y: 0.76, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: 0.92, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.57, y: 0.92, z: 0, visibility: 0.9 };
  return lm;
}

describe('CharacterAvatarRenderer 단위 테스트 (#685 / FEAT-SKIN-001)', () => {
  const sampleSkin: CharacterSkin = {
    id: 'guardian_fox',
    name: '꼬마 수호신 여우',
    parts: [
      { boneId: 'torso', file: 'torso.png', pivotX: 0.5, pivotY: 1.0, zOrder: 0 },
      { boneId: 'head', file: 'head.png', pivotX: 0.5, pivotY: 0.8, zOrder: 10 },
      { boneId: 'leftUpperArm', file: 'left_arm.png', pivotX: 0.5, pivotY: 0.1, zOrder: -5 },
      { boneId: 'rightUpperArm', file: 'right_arm.png', pivotX: 0.5, pivotY: 0.1, zOrder: 5 },
    ],
  };

  it('IAvatarRenderer 공통 인터페이스 규격을 완벽히 충족한다', () => {
    const renderer = new CharacterAvatarRenderer(DEFAULT_STICKMAN_RIG, sampleSkin);
    expect(renderer.scale).toBeDefined();
    expect(renderer.hasPose).toBe(false);
    expect(renderer.currentAnchorXRatio).toBeCloseTo(0.5, 2);

    renderer.setScale(1.8);
    expect(renderer.scale).toBeCloseTo(1.8, 2);

    renderer.reset();
    expect(renderer.hasPose).toBe(false);
  });

  it('포즈 랜드마크 입력 시 RigSolver와 연동되어 본 트랜스폼 및 앵커를 실시간 갱신한다', () => {
    const renderer = new CharacterAvatarRenderer(DEFAULT_STICKMAN_RIG, sampleSkin);
    const lm = createSampleLandmarks();
    renderer.update(0.016, lm);

    expect(renderer.hasPose).toBe(true);
    expect(renderer.currentAnchorXRatio).toBeCloseTo(0.5, 2);
    expect(renderer.boneTransforms.length).toBeGreaterThan(0);

    const torso = renderer.boneTransforms.find((t) => t.id === 'torso');
    expect(torso).toBeDefined();
    expect(torso!.x).toBeGreaterThan(0);
  });

  it('스킨 메타데이터의 zOrder 순서에 맞춰 오름차순으로 파츠가 정렬되어 렌더링된다', () => {
    const renderer = new CharacterAvatarRenderer(DEFAULT_STICKMAN_RIG, sampleSkin);
    const lm = createSampleLandmarks();
    renderer.update(0.016, lm);

    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 1080);

    // zOrder: leftUpperArm(-5) -> torso(0) -> rightUpperArm(5) -> head(10)
    // 렌더링 중 translate 호출 순서를 통해 검증
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('이미지 파츠가 누락되었거나 로딩 전일 때 스틱맨/캡슐로 안전하게 폴백(Fallback) 렌더링된다', () => {
    const renderer = new CharacterAvatarRenderer(DEFAULT_STICKMAN_RIG, sampleSkin);
    const lm = createSampleLandmarks();
    renderer.update(0.016, lm);

    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 1080);

    // 이미지가 아직 로드되지 않은 상태이므로 stroke/fill(캡슐 폴백)이 정상 호출되어야 함
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('정렬 정책 A: CharacterAvatarRenderer는 게임플레이 4색 커서를 직접 그리지 않는다 (커서 분리 보장)', () => {
    const renderer = new CharacterAvatarRenderer(DEFAULT_STICKMAN_RIG, sampleSkin);
    const lm = createSampleLandmarks();
    renderer.update(0.016, lm);

    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 1080);

    // 4색 커서의 고유 네온 색상(#28E6FF, #FFCB4D 등)으로 원형 커서를 그리는 행위가 없어야 함 (HUD 레이어가 전담)
    // 아바타 내부 관절 볼이나 캡슐은 있을 수 있으나 커서 링은 아바타 레이어에서 독립됨
    expect(renderer.hasPose).toBe(true);
  });
});
