import { describe, it, expect, vi } from 'vitest';
import { CursorTracker } from '../../src/input/CursorTracker.js';
import { RecipeGenerator } from '../../src/input/RecipeGenerator.js';
import { AnswerSelector, getTierInfo } from '../../src/input/AnswerSelector.js';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

function createMockLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }
  // 코 (head): 0
  lm[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  // 왼어깨 11, 오른어깨 12
  lm[11] = { x: 0.4, y: 0.35, z: 0, visibility: 0.9 };
  lm[12] = { x: 0.6, y: 0.35, z: 0, visibility: 0.9 };
  // 왼손목 15, 오른손목 16
  lm[15] = { x: 0.15, y: 0.4, z: 0, visibility: 0.95 };
  lm[16] = { x: 0.85, y: 0.4, z: 0, visibility: 0.95 };
  // 왼골반 23, 오른골반 24
  lm[23] = { x: 0.45, y: 0.65, z: 0, visibility: 0.9 };
  lm[24] = { x: 0.55, y: 0.65, z: 0, visibility: 0.9 };
  return lm;
}

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
    fillText: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('CursorTracker (Issue #104)', () => {
  it('Pose 랜드마크로부터 4색 커서(head, hip, leftHand, rightHand)를 정상 추출한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    const cursors = tracker.update(lm);

    expect(cursors.has('head')).toBe(true);
    expect(cursors.get('head')!.y).toBeCloseTo(0.2);

    expect(cursors.has('hip')).toBe(true);
    expect(cursors.get('hip')!.x).toBeCloseTo(0.5);
    expect(cursors.get('hip')!.y).toBeCloseTo(0.65);

    expect(cursors.has('leftHand')).toBe(true);
    expect(cursors.get('leftHand')!.x).toBeCloseTo(0.15);

    expect(cursors.has('rightHand')).toBe(true);
    expect(cursors.get('rightHand')!.x).toBeCloseTo(0.85);
  });

  it('Hands 손바닥 위치가 주어지면 Pose 손목보다 손바닥을 우선 적용한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    const palms = {
      leftPalm: { x: 0.12, y: 0.38, confidence: 0.99 },
    };

    const cursors = tracker.update(lm, palms);
    expect(cursors.get('leftHand')!.source).toBe('hands');
    expect(cursors.get('leftHand')!.x).toBeCloseTo(0.12);

    // 오른손은 여전히 pose
    expect(cursors.get('rightHand')!.source).toBe('pose');
  });

  it('미러 모드(isMirrored=true) 시 X 좌표가 1-x로 반전된다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    // leftWrist x = 0.15 -> 반전 시 0.85
    const cursors = tracker.update(lm, undefined, true);
    expect(cursors.get('leftHand')!.x).toBeCloseTo(0.85);
  });
});

describe('RecipeGenerator (Issue #104)', () => {
  const generator = new RecipeGenerator();

  it('Tier 1~4 각각에 대해 좌/우 선택지 레시피 계획을 생성한다', () => {
    for (let t = 1; t <= 4; t++) {
      const tierInfo = getTierInfo(t === 1 ? 1 : t === 2 ? 5 : t === 3 ? 9 : 13);
      const plan = generator.generatePlan(tierInfo);

      expect(plan.choices).toHaveLength(2);
      expect(plan.activeZones.length).toBeGreaterThan(0);
    }
  });

  it('좌측 선택지와 우측 선택지는 동일한 신체 커서를 중복 공유하지 않는다', () => {
    const tierInfo = getTierInfo(1);
    const plan = generator.generatePlan(tierInfo);

    const leftCursors = plan.choices[0].requiredCursors;
    const rightCursors = plan.choices[1].requiredCursors;

    const hasOverlap = leftCursors.some((c) => rightCursors.includes(c));
    expect(hasOverlap).toBe(false);
  });
});

describe('AnswerSelector - updateFromPose & Deadlock Guard (Issue #104)', () => {
  it('동일 신체 조건으로 양쪽 선택지 조건을 동시에 만족할 경우 Deadlock Guard가 발동하여 취소된다', () => {
    const as = new AnswerSelector();
    as.startQuestion(1); // Tier 1: Left=leftHand in Zone 4, Right=rightHand in Zone 5

    const lm = createMockLandmarks();
    // leftHand(Zone 4: x=0.05~0.33, y=0.33~0.58) -> x=0.15, y=0.45
    lm[15] = { x: 0.15, y: 0.45, z: 0, visibility: 0.95 };
    // rightHand(Zone 5: x=0.67~0.95, y=0.33~0.58) -> x=0.80, y=0.45
    lm[16] = { x: 0.80, y: 0.45, z: 0, visibility: 0.95 };

    // 양쪽 모두 만족하는 상태
    const result = as.updateFromPose(lm, undefined, 0.5);
    // Deadlock Guard 발동 -> 확정되지 않음
    expect(result).toBeNull();
    expect(as.choiceProgress[0]).toBe(0);
    expect(as.choiceProgress[1]).toBe(0);
  });

  it('단일 선택지 조건만 만족할 경우 체류 시간이 누적되어 확정된다', () => {
    const as = new AnswerSelector();
    as.startQuestion(1); // Tier 1 (dwellTime = 0.7s)

    const lm = createMockLandmarks();
    // leftHand만 Zone 4(x=0.19, y=0.45, 중심 근처)에 진입
    lm[15] = { x: 0.19, y: 0.45, z: 0, visibility: 0.95 };
    // rightHand는 허공(0.5, 0.5)
    lm[16] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };

    // 0.4초 체류
    const r1 = as.updateFromPose(lm, undefined, 0.4);
    expect(r1).toBeNull();
    expect(as.choiceProgress[0]).toBeGreaterThan(0);
    expect(as.choiceProgress[1]).toBe(0);

    // 추가 0.4초 체류 (총 0.8s > 0.7s)
    const r2 = as.updateFromPose(lm, undefined, 0.4);
    expect(r2).not.toBeNull();
    expect(r2!.confirmedIndex).toBe(0);
  });
});

describe('AnswerSelectionRenderer (Issue #104)', () => {
  const ctx = createMockCtx();

  it('활성 피트니스 존과 4색 신체 커서를 에러 없이 렌더링한다', () => {
    const renderer = new AnswerSelectionRenderer();
    const as = new AnswerSelector();
    const plan = as.startQuestion(1);

    const lm = createMockLandmarks();
    as.updateFromPose(lm);

    expect(() =>
      renderer.render(
        ctx,
        1920,
        1080,
        plan.activeZones,
        as.cursorTracker.cursors,
        as.choiceProgress,
      ),
    ).not.toThrow();

    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });
});
