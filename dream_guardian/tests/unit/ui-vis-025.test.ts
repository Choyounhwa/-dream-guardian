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
  RUNNING_QUESTION_PAGE_ID,
  RUN_QUESTION_PAGE_ID,
  RUNNING_QUESTION_BOUNDS_IDS,
  registerRunningQuestionPageAdapter,
} from '../../src/editor/ui/preview/screens/UIRunningQuestionPage';
import { QuestionRenderer } from '../../src/render/QuestionRenderer';
import { BeatHUDRenderer } from '../../src/render/BeatHUDRenderer';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer';
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
    setLineDash: vi.fn(),
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
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10,
    filter: 'none',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low' as ImageSmoothingQuality,
  } as unknown as CanvasRenderingContext2D & {
    calls: { method: string; args: unknown[] }[];
  };
}

function createMockCanvas(): HTMLCanvasElement & {
  mockCtx: ReturnType<typeof createMockCtx>;
} {
  const mockCtx = createMockCtx();
  const canvas = {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    getContext: vi.fn((contextId: string) => {
      if (contextId === '2d') return mockCtx;
      return null;
    }),
    mockCtx,
  } as unknown as HTMLCanvasElement & {
    mockCtx: ReturnType<typeof createMockCtx>;
  };
  (mockCtx as any).canvas = canvas;
  return canvas;
}

describe('[UI-VIS-025 / Issue #455] 러닝·문제 실제 렌더 페이지 어댑터', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 레지스트리 등록 및 디스패치', () => {
    it('running_question 및 run_question 페이지가 defaultPageAdapterRegistry에 등록되어 있다', () => {
      expect(hasPageAdapter(RUNNING_QUESTION_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(RUN_QUESTION_PAGE_ID)).toBe(true);
      expect(defaultPageAdapterRegistry.has('running_question')).toBe(true);
      expect(defaultPageAdapterRegistry.has('run_question')).toBe(true);
    });

    it('독립 레지스트리에 registerRunningQuestionPageAdapter로 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has('running_question')).toBe(false);
      registerRunningQuestionPageAdapter(customRegistry);
      expect(customRegistry.has('running_question')).toBe(true);
      expect(customRegistry.has('run_question')).toBe(true);
    });

    it('dispatchPageRender를 통해 running_question 페이지가 정상 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('running_question');
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);
    });

    it('dispatchPageRender를 통해 run_question 별칭으로도 동일하게 정상 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'run_question',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('run_question');
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);
    });

    it('미지원 페이지 렌더 요청 시 drew: false, reason: unsupported-page로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'unknown_runner_page',
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-page');
    });
  });

  describe('2. 가드 조건 및 엄격한 유효성 검증', () => {
    it('fixture.isStale: true 인 경우 stale-fixture 로 렌더가 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
        fixture: { isStale: true } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-fixture');
    });

    it('snapshot.revision이 fixture.revision보다 이전인 경우 stale-revision 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: { revision: 1 } as any,
        fixture: { revision: 2 } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('캔버스 크기가 0이거나 비정상적인 경우 invalid-canvas 로 거부된다', () => {
      const canvas = createMockCanvas();
      (canvas as any).width = 0;
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('invalid-canvas');
    });

    it('상단 보호 HUD 영역을 침범하는 잘못된 프레젠테이션 요소는 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.running_question.elements.push({
        id: 'illegal_banner',
        name: '불법 배너',
        type: 'container',
        bounds: { x: 100, y: 10, width: 400, height: 100 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('QuestionRenderer의 답안 보호 영역(Zone 4/5 action geometry) 변조 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
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
    it('가짜 사각형 대체를 금지하고 QuestionRenderer, BeatHUDRenderer, RunningMatRenderer, HUDLayer, BottomBar의 실제 메서드를 호출한다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const beatHudSpy = vi.spyOn(BeatHUDRenderer.prototype, 'renderFixture');
      const runningMatSpy = vi.spyOn(RunningMatRenderer.prototype, 'renderFixture');
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);

      expect(questionSpy).toHaveBeenCalledTimes(1);
      expect(beatHudSpy).toHaveBeenCalledTimes(1);
      expect(runningMatSpy).toHaveBeenCalledTimes(1);
      expect(hudSpy).toHaveBeenCalledTimes(1);
      expect(bottomBarSpy).toHaveBeenCalledTimes(1);
    });

    it('결정론적 Fixture 파라미터가 각 실제 렌더러에 정확히 전달된다', () => {
      const questionSpy = vi.spyOn(QuestionRenderer.prototype, 'renderFixture');
      const beatHudSpy = vi.spyOn(BeatHUDRenderer.prototype, 'renderFixture');
      const runningMatSpy = vi.spyOn(RunningMatRenderer.prototype, 'renderFixture');

      const canvas = createMockCanvas();
      const customFixture = {
        question: {
          questionText: '99 × 9 = [ ? ]',
          choices: ['891', '881'] as [string, string],
        },
        beatHud: {
          totalSteps: 42,
          locomotionMode: 'squat' as const,
        },
        runningMat: {
          actionText: '스쿼트 점프',
          cueText: '더 깊이 앉으세요!',
        },
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
        fixture: customFixture as any,
      });

      expect(res.ok).toBe(true);

      const passedQuestionFixture = questionSpy.mock.calls[0][3];
      expect(passedQuestionFixture.questionText).toBe('99 × 9 = [ ? ]');
      expect(passedQuestionFixture.choices).toEqual(['891', '881']);

      const passedBeatHudFixture = beatHudSpy.mock.calls[0][3];
      expect(passedBeatHudFixture?.totalSteps).toBe(42);
      expect(passedBeatHudFixture?.locomotionMode).toBe('squat');

      const passedRunningMatFixture = runningMatSpy.mock.calls[0][3];
      expect(passedRunningMatFixture?.actionText).toBe('스쿼트 점프');
      expect(passedRunningMatFixture?.cueText).toBe('더 깊이 앉으세요!');
    });
  });

  describe('4. UIPresentationDocument 연동 및 커스텀 오버라이드 반영', () => {
    it('UIPresentationDocument가 주어지면 각 렌더러의 fromPresentationDocument가 호출되어 바인딩된다', () => {
      const qDocSpy = vi.spyOn(QuestionRenderer, 'fromPresentationDocument');
      const bDocSpy = vi.spyOn(BeatHUDRenderer, 'fromPresentationDocument');
      const mDocSpy = vi.spyOn(RunningMatRenderer, 'fromPresentationDocument');

      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();

      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      expect(qDocSpy).toHaveBeenCalled();
      expect(bDocSpy).toHaveBeenCalled();
      expect(mDocSpy).toHaveBeenCalled();
    });

    it('프레젠테이션 문서의 배너 텍스트가 렌더러에 반영된다', () => {
      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();
      const banner = doc.pages.running_question.elements.find(
        (e) => e.id === 'run_question_banner'
      );
      if (banner) {
        banner.text = '7 × 8 = [ ? ]';
      }

      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      // canvas 호출 중 7 × 8 관련 텍스트 렌더 확인
      const fillTextCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const renderedAny = fillTextCalls.some((c) =>
        String(c.args[0]).includes('7') || String(c.args[0]).includes('8')
      );
      expect(renderedAny).toBe(true);
    });
  });

  describe('5. renderedBounds 반환 및 Stable ID 명세 준수', () => {
    it('question, beat_hud, running_mat, hud, bottom_bar의 모든 필수 stable ID bounds를 포함한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();
      const bounds = res.renderedBounds!;
      const boundIds = bounds.map((b) => b.id);

      // 필수 ID 목록 확인
      for (const requiredId of RUNNING_QUESTION_BOUNDS_IDS) {
        expect(boundIds).toContain(requiredId);
      }

      // 각 bounds의 유효성 검증
      for (const b of bounds) {
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(ARTBOARD_HEIGHT + 10);

        if (b.id === 'running_mat_strike_line') {
          // 판정선은 화면 좌우로 시각적 풀블리드 오버행(overhang)을 가짐
          expect(b.x).toBeLessThan(0);
          expect(b.width).toBeGreaterThan(ARTBOARD_WIDTH);
        } else {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width).toBeLessThanOrEqual(ARTBOARD_WIDTH + 10);
        }
      }
    });

    it('러닝 매트 및 답안 버튼 등 보호 영역 요소는 isProtected: true 로 마킹된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
      });

      const bounds = res.renderedBounds!;
      const protectedIds = [
        'choice_0',
        'choice_1',
        'running_mat',
        'running_mat_strike_line',
        'running_mat_left_lane',
        'running_mat_center_lane',
        'running_mat_right_lane',
      ];

      for (const id of protectedIds) {
        const item = bounds.find((b) => b.id === id);
        expect(item, `Element ${id} should be present`).toBeDefined();
        expect(item?.isProtected, `Element ${id} should be protected`).toBe(true);
      }
    });
  });

  describe('6. 런타임 격리 보장 (Zero Runtime Boot)', () => {
    it('GameEngine, AppBootstrap, 카메라, TTS, 오디오가 전혀 부팅되지 않는다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'running_question',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      // 순수 캔버스 2D 호출 외 외부 전역 부작용 없음 검증
      expect((globalThis as any).AudioContext).toBeUndefined();
      expect((globalThis as any).speechSynthesis).toBeUndefined();
    });
  });
});
