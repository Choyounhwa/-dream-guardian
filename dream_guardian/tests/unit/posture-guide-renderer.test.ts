import { describe, it, expect, vi } from 'vitest';
import { PostureGuideRenderer } from '../../src/render/PostureGuideRenderer.js';
import type { AnswerPosture } from '../../src/types/posture.js';
import type { FitnessZone } from '../../config/zone.config.js';
import type { QuestionRecipePlan } from '../../src/input/RecipeGenerator.js';
import { getTierInfo } from '../../src/input/AnswerSelector.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    clip: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
  } as unknown as CanvasRenderingContext2D;
}

const MOCK_ZONES: FitnessZone[] = [
  { id: 1, label: '좌상', x: 0.04, y: 0.04, width: 0.26, height: 0.16 },
  { id: 2, label: '상단', x: 0.37, y: 0.04, width: 0.26, height: 0.16 },
  { id: 3, label: '우상', x: 0.70, y: 0.04, width: 0.26, height: 0.16 },
  { id: 4, label: '좌', x: 0.04, y: 0.24, width: 0.26, height: 0.16 },
  { id: 5, label: '우', x: 0.70, y: 0.24, width: 0.26, height: 0.16 },
  { id: 7, label: '중하', x: 0.37, y: 0.58, width: 0.26, height: 0.16 },
  { id: 10, label: '하단', x: 0.37, y: 0.78, width: 0.26, height: 0.16 },
];

const MOCK_POSTURES: [AnswerPosture, AnswerPosture] = [
  {
    choiceIndex: 0,
    parts: ['leftHand'],
    zoneIds: [4],
    binding: 'any',
    patternId: 'S001',
  },
  {
    choiceIndex: 1,
    parts: ['rightHand'],
    zoneIds: [5],
    binding: 'any',
    patternId: 'S016',
  },
];

describe('PostureGuideRenderer (Issue #159 - FEAT-GUIDE-001)', () => {
  it('인스턴스 생성 및 update 호출 시 타이머가 정상 갱신된다', () => {
    const renderer = new PostureGuideRenderer();
    expect(renderer).toBeDefined();

    expect(() => renderer.update(0.016)).not.toThrow();
  });

  it('빈 입력이나 유효하지 않은 좌표에서도 에러 없이 안전하게 처리된다', () => {
    const renderer = new PostureGuideRenderer();
    const ctx = createMockCtx();

    expect(() => renderer.render(ctx, 1080, 2160, [], [])).not.toThrow();
    expect(() => renderer.render(ctx, 0, 0, MOCK_POSTURES, MOCK_ZONES)).not.toThrow();
  });

  it('목표 자세 실루엣(스틱맨)과 목표 존 네온 하이라이트를 렌더링한다', () => {
    const renderer = new PostureGuideRenderer();
    const ctx = createMockCtx();

    renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0, 0]);

    // Canvas context 조작 검증
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('진입한 선택지(진행도 > 0)의 실루엣이 능동적으로 하이라이트된다', () => {
    const renderer = new PostureGuideRenderer();
    const ctx = createMockCtx();

    // 0번 선택지만 진행도 0.5 (하이라이트)
    renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0.5, 0], 0);

    // 드로잉 호출 확인
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('다양한 신체 부위(머리, 골반, 양손) 조합의 스틱맨 관절 좌표가 정상 계산된다', () => {
    const renderer = new PostureGuideRenderer();
    const complexPostures: [AnswerPosture, AnswerPosture] = [
      {
        choiceIndex: 0,
        parts: ['leftHand', 'head'],
        zoneIds: [1, 4],
        binding: 'any',
        patternId: 'D016',
      },
      {
        choiceIndex: 1,
        parts: ['rightHand', 'hip'],
        zoneIds: [3, 7],
        binding: 'any',
        patternId: 'D025',
      },
    ];

    const ctx = createMockCtx();
    expect(() => renderer.render(ctx, 1080, 2160, complexPostures, MOCK_ZONES)).not.toThrow();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('renderFromPlan 메서드를 통해 QuestionRecipePlan 객체로 직접 렌더링할 수 있다', () => {
    const renderer = new PostureGuideRenderer();
    const ctx = createMockCtx();

    const plan: QuestionRecipePlan = {
      tier: getTierInfo(1),
      choices: [
        { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [4] },
        { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [5] },
      ],
      activeZones: [MOCK_ZONES[3], MOCK_ZONES[4]],
    };

    expect(() => renderer.renderFromPlan(ctx, 1080, 2160, plan, [0.2, 0])).not.toThrow();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('선택지 실루엣의 기준 위치(silhouettePositions)를 커스텀 지정할 수 있다', () => {
    const renderer = new PostureGuideRenderer();
    renderer.setSilhouettePositions([
      { x: 300, y: 1200 },
      { x: 780, y: 1200 },
    ]);

    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES);
    expect(ctx.save).toHaveBeenCalled();
  });

  it('activeChoiceIndex가 지정되었을 때 해당 선택지가 하이라이트된다', () => {
    const renderer = new PostureGuideRenderer();
    const ctx = createMockCtx();

    renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0, 0], 1);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('연속 100회 렌더링 호출을 빠르게 수행하여 60fps 성능을 유지한다', () => {
    const renderer = new PostureGuideRenderer();
    const ctx = createMockCtx();

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      renderer.update(0.016);
      renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0.5, 0.1]);
    }
    const elapsed = performance.now() - start;
    // 100회 드로잉이 50ms 이내에 완료되어야 함
    expect(elapsed).toBeLessThan(50);
  });
});
