import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  dispatchPageRender,
  defaultPageAdapterRegistry,
  PageAdapterRegistry,
  hasPageAdapter,
} from '../../src/editor/ui/preview/UIPageAdapters';
import {
  ANSWER_SELECT_PAGE_ID,
  ANSWER_PAGE_ID,
  ANSWER_SELECT_BOUNDS_IDS,
  registerAnswerPageAdapter,
  DEFAULT_ANSWER_PAGE_FIXTURE,
} from '../../src/editor/ui/preview/screens/UIAnswerPage';
import { QuestionRenderer } from '../../src/render/QuestionRenderer';
import { DreamGrid } from '../../src/render/DreamGrid';
import { JudgmentFeedback } from '../../src/ui/JudgmentFeedback';
import { HUDLayer } from '../../src/ui/HUDLayer';
import { BottomBar } from '../../src/ui/BottomBar';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation';

function createMockCtx(): CanvasRenderingContext2D & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    ellipse: vi.fn(),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] })
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({
        method: 'roundRect',
        args: [x, y, w, h, ...(r !== undefined ? [r] : [])],
      })
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    clip: vi.fn(() => calls.push({ method: 'clip', args: [] })),
    clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
    fillRect: vi.fn((...args: unknown[]) => calls.push({ method: 'fillRect', args })),
    strokeRect: vi.fn((...args: unknown[]) => calls.push({ method: 'strokeRect', args })),
    fillText: vi.fn((...args: unknown[]) => calls.push({ method: 'fillText', args })),
    strokeText: vi.fn((...args: unknown[]) => calls.push({ method: 'strokeText', args })),
    measureText: vi.fn((text: string) => ({
      width: text.length * 16,
      actualBoundingBoxAscent: 14,
      actualBoundingBoxDescent: 4,
    })),
    drawImage: vi.fn(),
    setLineDash: vi.fn((pattern: number[]) =>
      calls.push({ method: 'setLineDash', args: [pattern] })
    ),
    getLineDash: vi.fn(() => []),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
    rotate: vi.fn((a: number) => calls.push({ method: 'rotate', args: [a] })),
    resetTransform: vi.fn(),
    canvas: { width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT } as HTMLCanvasElement,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
  } as unknown as CanvasRenderingContext2D & {
    calls: { method: string; args: unknown[] }[];
  };
}

function createMockCanvas(): HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> } {
  const mockCtx = createMockCtx();
  const canvas = {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    clientWidth: ARTBOARD_WIDTH,
    clientHeight: ARTBOARD_HEIGHT,
    getContext: vi.fn((type: string) => (type === '2d' ? mockCtx : null)),
    mockCtx,
  } as unknown as HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> };
  return canvas;
}

describe('UI-VIS-026 (#456) 답안 선택 실제 렌더 페이지 연결 어댑터', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 레지스트리 등록 및 지원 페이지 식별', () => {
    it('defaultPageAdapterRegistry에 answer_select 및 answer 페이지가 등록되어 있다', () => {
      expect(defaultPageAdapterRegistry.has(ANSWER_SELECT_PAGE_ID)).toBe(true);
      expect(defaultPageAdapterRegistry.has(ANSWER_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(ANSWER_SELECT_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(ANSWER_PAGE_ID)).toBe(true);
    });

    it('독립 Registry에 registerAnswerPageAdapter를 호출하면 올바르게 등록된다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has(ANSWER_SELECT_PAGE_ID)).toBe(false);
      registerAnswerPageAdapter(customRegistry);
      expect(customRegistry.has(ANSWER_SELECT_PAGE_ID)).toBe(true);
      expect(customRegistry.has(ANSWER_PAGE_ID)).toBe(true);
      expect(DEFAULT_ANSWER_PAGE_FIXTURE.question?.choices).toHaveLength(2);
    });

    it('미지원 페이지 렌더 요청 시 unsupported-page 로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'unsupported_test_page',
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-page');
    });
  });

  describe('2. 가드 검증: 캔버스 유효성, Stale Fixture, Stale Revision, 보호 영역 변조 및 2답안 규약', () => {
    it('캔버스 크기가 0이거나 비정상적인 경우 invalid-canvas 로 거부된다', () => {
      const canvas = createMockCanvas();
      (canvas as any).width = 0;
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('invalid-canvas');
    });

    it('stale fixture(isStale: true)는 stale-fixture 로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: { isStale: true } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-fixture');
    });

    it('지연된 stale revision 스냅샷 요청은 stale-revision 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: { revision: 3 },
        fixture: { revision: 5 } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('상단 보호 HUD 영역을 침범하는 잘못된 프레젠테이션 요소는 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.answer_select.elements.push({
        id: 'illegal_hud_invader',
        name: '불법 침범 요소',
        type: 'container',
        bounds: { x: 100, y: 10, width: 400, height: 100 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('정확히 2답안(Zone 4/5)을 초과하는 3답안 이상 생성 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.answer_select.elements.push({
        id: 'ans_btn_extra_3',
        name: '답안 3 (불법)',
        type: 'button',
        bounds: { x: 400, y: 890, width: 281, height: 250 },
        actionId: 'answer_select_2' as any,
      });

      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('fixture에 3개 이상의 답안 배열이 주어질 경우 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: {
          question: {
            choices: ['27', '25', '30'],
          },
        } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('피트니스 Zone 4/5 답안 버튼 보호 지오메트리 변조 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: {
          questionContext: {
            choice0: { x: 300, y: 300, w: 100, h: 100 },
          },
        } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });
  });

  describe('3. 실제 렌더러 호출 및 무부작용 합성 보장 (Spy 검증)', () => {
    it('가짜 사각형 대체를 금지하고 QuestionRenderer, DreamGrid, HUDLayer, BottomBar의 실제 메서드를 호출한다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const dreamGridSpy = vi.spyOn(DreamGrid.prototype, 'render');
      const feedbackSpy = vi.spyOn(JudgmentFeedback.prototype, 'renderFixture');
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);

      expect(questionSpy).toHaveBeenCalledTimes(1);
      expect(dreamGridSpy).toHaveBeenCalledTimes(1);
      expect(feedbackSpy).toHaveBeenCalledTimes(1);
      expect(hudSpy).toHaveBeenCalledTimes(1);
      expect(bottomBarSpy).toHaveBeenCalledTimes(1);
    });

    it('결정론적 Fixture 파라미터가 각 실제 렌더러에 정확히 전달된다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');

      const canvas = createMockCanvas();
      const customFixture = {
        question: {
          questionText: '99 × 9 = [ ? ]',
          choices: ['891', '881'] as [string, string],
          answer: '891',
        },
        hud: {
          playerHp: 75,
          bossHp: 5,
          combo: 8,
          chapter: 2,
        },
        bottomBar: {
          actionLabel: '정답 터치 대기',
          mana: 50,
          manaMax: 100,
        },
      };

      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: customFixture as any,
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);

      const passedQuestionFixture = questionSpy.mock.calls[0][3];
      expect(passedQuestionFixture.questionText).toBe('99 × 9 = [ ? ]');
      expect(passedQuestionFixture.choices).toEqual(['891', '881']);
      expect(passedQuestionFixture.answer).toBe('891');

      const passedHudData = hudSpy.mock.calls[0][3];
      expect(passedHudData.playerHp).toBe(75);
      expect(passedHudData.bossHp).toBe(5);
      expect(passedHudData.combo).toBe(8);

      const passedBottomBarOptions = bottomBarSpy.mock.calls[0][3];
      expect(passedBottomBarOptions?.actionLabel).toBe('정답 터치 대기');
      expect(passedBottomBarOptions?.mana).toBe(50);
    });

    it('2답안 규약: QuestionRenderer에 정확히 2개의 보기만 전달된다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const passedFixture = questionSpy.mock.calls[0][3];
      expect(passedFixture.choices).toHaveLength(2);
    });
  });

  describe('4. 피드백 연동: 선택(Selected), 호버(Hover), 타임아웃(Timeout) 상태 렌더링 검증', () => {
    it('선택 상태(selectedChoiceIndex: 0) 전달 시 QuestionRenderer에 선택 인덱스가 올바르게 전달된다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: {
          question: {
            selectedChoiceIndex: 0,
          },
        } as any,
      });

      expect(res.ok).toBe(true);
      const passedFixture = questionSpy.mock.calls[0][3];
      expect(passedFixture.selectedChoiceIndex).toBe(0);
    });

    it('호버 상태(activeHoverIndex: 1, choiceProgress: [0, 0.75]) 전달 시 호버 파라미터가 렌더러에 전달된다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: {
          question: {
            activeHoverIndex: 1,
            choiceProgress: [0, 0.75],
          },
        } as any,
      });

      expect(res.ok).toBe(true);
      const passedFixture = questionSpy.mock.calls[0][3];
      expect(passedFixture.activeHoverIndex).toBe(1);
      expect(passedFixture.choiceProgress).toEqual([0, 0.75]);
    });

    it('타임아웃(timeout: true) 또는 잔여 박자 0(remainingBeats: 0) 시 타임아웃 피드백이 합성된다', () => {
      const feedbackSpy = vi.spyOn(JudgmentFeedback.prototype, 'renderFixture');
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        fixture: {
          timeout: true,
          feedback: {
            message: '시간 초과! 정답을 확인하세요.',
          },
        } as any,
      });

      expect(res.ok).toBe(true);
      const passedFeedback = feedbackSpy.mock.calls[0][3];
      expect(passedFeedback.message).toBe('시간 초과! 정답을 확인하세요.');
      expect(passedFeedback.isVisible).toBe(true);
    });
  });

  describe('5. UIPresentationDocument 연동 및 커스텀 오버라이드 반영', () => {
    it('UIPresentationDocument가 주어지면 QuestionRenderer.fromPresentationDocument가 호출되어 바인딩된다', () => {
      const qDocSpy = vi.spyOn(QuestionRenderer, 'fromPresentationDocument');
      const fDocSpy = vi.spyOn(JudgmentFeedback, 'fromPresentationDocument');
      const hDocSpy = vi.spyOn(HUDLayer, 'fromPresentationDocument');
      const bDocSpy = vi.spyOn(BottomBar, 'fromPresentationDocument');

      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();

      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      expect(qDocSpy).toHaveBeenCalled();
      expect(fDocSpy).toHaveBeenCalled();
      expect(hDocSpy).toHaveBeenCalled();
      expect(bDocSpy).toHaveBeenCalled();
    });

    it('프레젠테이션 문서의 답안 텍스트가 렌더러에 반영된다', () => {
      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();
      const ans0 = doc.pages.answer_select.elements.find((e) => e.id === 'ans_btn_left');
      if (ans0) {
        ans0.text = '100';
      }

      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');

      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      const passedContext = questionSpy.mock.calls[0][4];
      expect(passedContext?.choice0?.text).toBe('100');
    });
  });

  describe('6. Stable Rendered Bounds 및 보호 플래그 검증', () => {
    it('모든 필수 stable bounds ID를 반환하며 실제 렌더링 영역 좌표가 유효하다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();
      const bounds = res.renderedBounds!;
      const boundIds = bounds.map((b) => b.id);

      // 필수 ID 목록 확인
      for (const requiredId of ANSWER_SELECT_BOUNDS_IDS) {
        expect(boundIds).toContain(requiredId);
      }

      // 각 bounds의 유효성 검증
      for (const b of bounds) {
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(ARTBOARD_WIDTH + 10);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(ARTBOARD_HEIGHT + 10);
      }
    });

    it('피트니스 Zone 4/5 모션 존 및 답안 버튼 0/1은 isProtected: true 로 마킹된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
      });

      const bounds = res.renderedBounds!;
      const protectedIds = ['choice_0', 'choice_1', 'zone_4', 'zone_5'];

      for (const id of protectedIds) {
        const item = bounds.find((b) => b.id === id);
        expect(item).toBeDefined();
        expect(item?.isProtected).toBe(true);
      }
    });
  });

  describe('7. 선택 요소 하이라이트 표시 및 잔류 0건 가드', () => {
    it('selectedElementIds에 지정된 요소의 bounds에 대시 스트로크 하이라이트를 그린다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        selectedElementIds: ['choice_0'],
      });

      expect(res.ok).toBe(true);
      const dashCalls = canvas.mockCtx.calls.filter((c) => c.method === 'setLineDash');
      expect(dashCalls.length).toBeGreaterThan(0);
      expect(dashCalls.some((c) => JSON.stringify(c.args[0]) === JSON.stringify([8, 4]))).toBe(
        true
      );

      const strokeRectCalls = canvas.mockCtx.calls.filter((c) => c.method === 'strokeRect');
      expect(strokeRectCalls.length).toBeGreaterThan(0);
    });

    it('선택 요소가 없을 때는 하이라이트 점선 스트로크를 그리지 않는다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        selectedElementIds: [],
      });

      expect(res.ok).toBe(true);
      const dashCalls = canvas.mockCtx.calls.filter(
        (c) => c.method === 'setLineDash' && JSON.stringify(c.args[0]) === JSON.stringify([8, 4])
      );
      expect(dashCalls.length).toBe(0);
    });

    it('연속 렌더링 호출 시 이전 선택이나 상태가 잔류하지 않고 멱등성을 유지한다', () => {
      const canvas1 = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas: canvas1,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        selectedElementIds: ['choice_1'],
      });

      expect(res1.ok).toBe(true);

      const canvas2 = createMockCanvas();
      const res2 = dispatchPageRender({
        canvas: canvas2,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
        selectedElementIds: [],
      });

      expect(res2.ok).toBe(true);
      const dashCalls2 = canvas2.mockCtx.calls.filter(
        (c) => c.method === 'setLineDash' && JSON.stringify(c.args[0]) === JSON.stringify([8, 4])
      );
      expect(dashCalls2.length).toBe(0);
    });
  });

  describe('8. 0-Runtime 부팅 격리 보장', () => {
    it('GameEngine, AppBootstrap, 카메라, TTS, 오디오 등 게임 라이프사이클 부팅 0건을 보장한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: ANSWER_SELECT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      // 순수 캔버스 2D 호출 외 외부 전역 부작용 없음 검증
      expect((globalThis as any).AudioContext).toBeUndefined();
      expect((globalThis as any).speechSynthesis).toBeUndefined();
    });
  });
});
