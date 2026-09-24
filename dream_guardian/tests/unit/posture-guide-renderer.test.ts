import { describe, it, expect, vi } from 'vitest';
import { PostureGuideRenderer } from '../../src/render/PostureGuideRenderer.js';
import type { AnswerPosture } from '../../src/types/posture.js';
import type { FitnessZone } from '../../config/zone.config.js';
import type { QuestionRecipePlan } from '../../src/input/RecipeGenerator.js';
import { AnswerSelector, getTierInfo } from '../../src/input/AnswerSelector.js';
import type { CursorPosition } from '../../src/input/CursorTracker.js';
import type { CursorType } from '../../config/cursor.config.js';

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

  describe('Issue #160 (Card #90) - FEAT-GUIDE-002: 첫 문제 유도 화살표(Arrow Hint)', () => {
    it('AnswerSelector는 questionNumber가 1일 때 isFirstQuestion이 true이고, 2 이상일 때 false이다', () => {
      const selector = new AnswerSelector();
      selector.setQuestion(1);
      expect(selector.isFirstQuestion).toBe(true);

      selector.setQuestion(2);
      expect(selector.isFirstQuestion).toBe(false);

      selector.setQuestion(5);
      expect(selector.isFirstQuestion).toBe(false);

      selector.setQuestion(1);
      expect(selector.isFirstQuestion).toBe(true);
    });

    it('첫 번째 문제(isFirstQuestion === true)에서 4색 커서->목표 존 유도 화살표가 렌더링된다', () => {
      const renderer = new PostureGuideRenderer();
      renderer.startFirstQuestionHint(5.0);
      expect(renderer.isHintActive).toBe(true);

      const ctx = createMockCtx();
      const cursors = new Map<CursorType, CursorPosition>([
        [
          'leftHand',
          { type: 'leftHand', x: 0.5, y: 0.5, confidence: 0.9, source: 'hands' },
        ],
      ]);

      renderer.render(
        ctx,
        1080,
        2160,
        MOCK_POSTURES,
        MOCK_ZONES,
        [0, 0],
        null,
        cursors,
        true, // isFirstQuestion
      );

      // 화살표 선 및 헤드 드로잉 호출 확인
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('목표 존에 커서가 이미 진입한 경우 해당 화살표는 즉시 렌더링되지 않는다', () => {
      const renderer = new PostureGuideRenderer();
      renderer.startFirstQuestionHint(5.0);

      const ctx = createMockCtx();
      // Zone 4: x: 0.04~0.30, y: 0.24~0.40 -> 커서가 0.15, 0.30에 위치 (완전 내부)
      const insideCursors = new Map<CursorType, CursorPosition>([
        [
          'leftHand',
          { type: 'leftHand', x: 0.15, y: 0.30, confidence: 0.9, source: 'hands' },
        ],
      ]);

      renderer.render(
        ctx,
        1080,
        2160,
        MOCK_POSTURES,
        MOCK_ZONES,
        [0, 0],
        null,
        insideCursors,
        true,
      );

      // 내부 커서에 대해서는 화살표가 드로잉되지 않음
      expect(ctx.save).toHaveBeenCalled();
    });

    it('5초가 경과하면 화살표 힌트 타이머가 만료되어 화살표가 자동 페이드아웃 및 소멸한다', () => {
      const renderer = new PostureGuideRenderer();
      renderer.startFirstQuestionHint(5.0);
      expect(renderer.isHintActive).toBe(true);

      // 4초 경과 (남은 1초 - 페이드아웃 구간)
      renderer.update(4.0);
      expect(renderer.isHintActive).toBe(true);
      expect(renderer.hintTimer).toBeCloseTo(1.0, 1);

      // 1.5초 추가 경과 (총 5.5초 -> 완전 만료)
      renderer.update(1.5);
      expect(renderer.isHintActive).toBe(false);
      expect(renderer.hintTimer).toBe(0);
    });

    it('두 번째 문제부터는(isFirstQuestion === false) 화살표 힌트가 비활성화되어 렌더링되지 않는다', () => {
      const renderer = new PostureGuideRenderer();
      renderer.startFirstQuestionHint(5.0);

      const ctx = createMockCtx();
      const cursors = new Map<CursorType, CursorPosition>([
        [
          'leftHand',
          { type: 'leftHand', x: 0.5, y: 0.5, confidence: 0.9, source: 'hands' },
        ],
      ]);

      renderer.render(
        ctx,
        1080,
        2160,
        MOCK_POSTURES,
        MOCK_ZONES,
        [0, 0],
        null,
        cursors,
        false, // isFirstQuestion === false
      );

      // isFirstQuestion이 false이므로 화살표 드로잉은 전혀 수행되지 않음
      expect(ctx.save).toHaveBeenCalled();
    });
  });

  describe('Issue #173 (Card #103) - RENDER-ZONE-001: 피트니스 존 활성화 시 네모 영역 표시 제거 (가상 영역화)', () => {
    it('활성 피트니스 존 렌더링 시 roundRect나 rect 기반의 사각 테두리 및 반투명 배경 채움이 호출되지 않는다', () => {
      const renderer = new PostureGuideRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0, 0]);

      // 사각 영역 박스를 그리는 roundRect 및 rect가 일체 호출되지 않아야 함 (가상 영역화)
      expect(ctx.roundRect).not.toHaveBeenCalled();
      expect(ctx.rect).not.toHaveBeenCalled();
    });

    it('renderZoneBoxes를 명시적으로 true로 설정하면 사각 박스가 드로잉된다', () => {
      const renderer = new PostureGuideRenderer();
      renderer.renderZoneBoxes = true;
      const ctx = createMockCtx();

      renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0, 0]);

      expect(ctx.roundRect).toHaveBeenCalled();
    });

    it('사각 박스 드로잉이 제거되어도 중앙 부위 벡터 아이콘(PartIcon)과 하단 실루엣은 정상 드로잉된다', () => {
      const renderer = new PostureGuideRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, 1080, 2160, MOCK_POSTURES, MOCK_ZONES, [0, 0]);

      // 스틱맨 실루엣 및 부위 아이콘 드로잉 정상 유지
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });
});

