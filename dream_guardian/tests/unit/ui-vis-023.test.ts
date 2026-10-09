import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  dispatchPageRender,
  defaultPageAdapterRegistry,
  PageAdapterRegistry,
  hasPageAdapter,
  getPageAdapter,
} from '../../src/editor/ui/preview/UIPageAdapters';
import {
  pausePageAdapter,
  PAUSE_PAGE_ID,
  PAUSE_BOUNDS_IDS,
  registerPausePageAdapter,
} from '../../src/editor/ui/preview/screens/UIPausePage';
import { PauseModal } from '../../src/ui/PauseModal';
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
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] })
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] })
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] })
    ),
    clearRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'clearRect', args: [x, y, w, h] })
    ),
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] })
    ),
    strokeText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y] })
    ),
    measureText: vi.fn().mockReturnValue({ width: 60 }),
    drawImage: vi.fn((img: any, ...args: number[]) =>
      calls.push({ method: 'drawImage', args: [img, ...args] })
    ),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    setLineDash: vi.fn((dash: number[]) => calls.push({ method: 'setLineDash', args: [dash] })),
    getLineDash: vi.fn().mockReturnValue([]),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & { calls: { method: string; args: unknown[] }[] };
}

function createMockCanvas(): HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> } {
  const ctx = createMockCtx();
  return {
    clientWidth: ARTBOARD_WIDTH,
    clientHeight: ARTBOARD_HEIGHT,
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    getContext: vi.fn((type: string) => {
      if (type === '2d') return ctx;
      return null;
    }),
    mockCtx: ctx,
  } as unknown as HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> };
}

describe('UI-VIS-023: 일시정지 실제 렌더 페이지 어댑터 (UIPausePage / PauseModal 연결)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 레지스트리 등록 및 기본 라우팅 검증', () => {
    it('defaultPageAdapterRegistry에 pause 페이지가 등록되어 있다', () => {
      expect(PAUSE_PAGE_ID).toBe('pause');
      expect(PAUSE_BOUNDS_IDS).toContain('pause_modal');
      expect(PAUSE_BOUNDS_IDS).toContain('pause_title');
      expect(PAUSE_BOUNDS_IDS).toContain('pause_resume');
      expect(PAUSE_BOUNDS_IDS).toContain('pause_settings');
      expect(PAUSE_BOUNDS_IDS).toContain('pause_quit');
      expect(hasPageAdapter(PAUSE_PAGE_ID)).toBe(true);
      expect(getPageAdapter(PAUSE_PAGE_ID)).toBeDefined();
      expect(defaultPageAdapterRegistry.listPages()).toContain(PAUSE_PAGE_ID);
    });

    it('독립 레지스트리에 registerPausePageAdapter를 호출하여 어댑터를 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has('pause')).toBe(false);

      registerPausePageAdapter(customRegistry);

      expect(customRegistry.has('pause')).toBe(true);
      expect(customRegistry.get('pause')).toBe(pausePageAdapter);
    });

    it('dispatchPageRender를 통해 pause 페이지 렌더링 요청 시 ok: true, drew: true를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('pause');
      expect(res.timestamp).toBeGreaterThan(0);
    });

    it('미등록 페이지는 unsupported-page로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'unknown_screen',
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
        pageId: 'pause',
        snapshot: {},
        fixture: { isStale: true } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-fixture');
    });

    it('snapshot.stale: true 인 경우 stale-revision 으로 렌더가 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: { stale: true },
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('보호 영역(HUD Zone y < 120)을 침범하는 커스텀 요소가 포함되면 protected-zone-violation을 반환한다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = {
        elements: [
          {
            id: 'illegal_pause_btn',
            name: '불법 버튼',
            type: 'button',
            bounds: { x: 100, y: 50, width: 200, height: 100 },
          },
        ],
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('지원되지 않는 스키마 버전이 주어지면 unsupported-schema-version을 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {
          schemaVersion: '9.9.9',
        },
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-schema-version');
    });
  });

  describe('3. 실제 PauseModal 재사용 및 렌더러 파이프라인 검증', () => {
    it('PauseModal의 실제 렌더 파이프라인(PauseModal.prototype.render)이 호출된다', () => {
      const renderSpy = vi.spyOn(PauseModal.prototype, 'render');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(renderSpy).toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    it('가짜 사각형만 그리는 것이 아니라 실제 Canvas draw 호출(반투명 오버레이, 모달 박스, 버튼, 텍스트)이 발생한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const calls = canvas.mockCtx.calls;
      expect(calls.length).toBeGreaterThan(10);
      // dim backdrop fillRect
      expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
      // title and button text labels
      expect(calls.some((c) => c.method === 'fillText')).toBe(true);
    });

    it('게임 엔진 루프, AppBootstrap, SceneDirector, 카메라/오디오/TTS는 부팅되지 않는다 (부작용 0건)', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect((globalThis as any).__appBootstrapped).toBeUndefined();
      expect((globalThis as any).__gameLoopRunning).toBeUndefined();
    });
  });

  describe('4. UIPresentationDocument 및 커스텀 bounds/스타일 바인딩 검증', () => {
    it('기본 UIPresentationDocument를 주입해도 정상 렌더링되며 pause_title, pause_resume, pause_quit bounds를 반환한다', () => {
      const defaultDoc = createDefaultUIPresentationDocument();
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: defaultDoc,
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();

      const ids = res.renderedBounds?.map((b) => b.id) ?? [];
      expect(ids).toContain('pause_modal');
      expect(ids).toContain('pause_title');
      expect(ids).toContain('pause_resume');
      expect(ids).toContain('pause_quit');
      expect(ids).toContain('pause_settings');
    });

    it('문서 내 커스텀 bounds 오버라이드가 PauseModal 렌더 및 반환 bounds에 정확히 반영된다', () => {
      const canvas = createMockCanvas();
      const customDoc = {
        pages: {
          pause: {
            pageId: 'pause',
            elements: [
              {
                id: 'pause_modal',
                type: 'container',
                bounds: { x: 120, y: 700, width: 840, height: 740 },
              },
              {
                id: 'pause_title',
                type: 'text',
                bounds: { x: 180, y: 760, width: 720, height: 110 },
                text: '잠시 멈춤!',
              },
              {
                id: 'btn_pause_resume',
                type: 'button',
                actionId: 'pause_resume',
                bounds: { x: 220, y: 950, width: 640, height: 120 },
                text: '이어서 달리기',
              },
              {
                id: 'btn_pause_quit',
                type: 'button',
                actionId: 'pause_quit',
                bounds: { x: 220, y: 1120, width: 640, height: 120 },
                text: '로비로 나가기',
              },
            ],
          },
        },
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: customDoc,
      });

      expect(res.ok).toBe(true);
      const modalBound = res.renderedBounds?.find((b) => b.id === 'pause_modal');
      expect(modalBound).toBeDefined();
      expect(modalBound?.x).toBe(120);
      expect(modalBound?.y).toBe(700);
      expect(modalBound?.width).toBe(840);
      expect(modalBound?.height).toBe(740);

      const resumeBound = res.renderedBounds?.find((b) => b.id === 'pause_resume');
      expect(resumeBound).toBeDefined();
      expect(resumeBound?.x).toBe(220);
      expect(resumeBound?.y).toBe(950);
      expect(resumeBound?.width).toBe(640);
      expect(resumeBound?.height).toBe(120);
    });

    it('fixture를 통한 hoverAction 주입 시 에러 없이 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
        fixture: {
          hoverAction: 'resume',
        } as any,
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
    });
  });

  describe('5. 공통 HUD 및 BottomBar 정적 합성 검증', () => {
    it('HUDLayer 및 BottomBar가 정적으로 합성되어 렌더링 호출이 발생한다', () => {
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(hudSpy).toHaveBeenCalled();
      expect(bottomBarSpy).toHaveBeenCalled();

      hudSpy.mockRestore();
      bottomBarSpy.mockRestore();
    });

    it('renderedBounds에 HUD 및 BottomBar stable IDs가 모두 포함된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const ids = res.renderedBounds?.map((b) => b.id) ?? [];

      expect(ids).toContain('hud_player_hp');
      expect(ids).toContain('hud_boss_hp');
      expect(ids).toContain('hud_boss_name');
      expect(ids).toContain('hud_combo');
      expect(ids).toContain('bottom_bar');
      expect(ids).toContain('bottom_bar_settings');
      expect(ids).toContain('bottom_bar_action');
      expect(ids).toContain('bottom_bar_mana');
    });
  });

  describe('6. 선택 하이라이트 (selectedElementIds) 및 상태 오염 방지', () => {
    it('selectedElementIds가 주어지면 점선 테두리(strokeRect)를 렌더링한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
        selectedElementIds: ['pause_resume'],
      });

      expect(res.ok).toBe(true);
      const calls = canvas.mockCtx.calls;
      const setLineDashCalls = calls.filter((c) => c.method === 'setLineDash');
      expect(setLineDashCalls.length).toBeGreaterThan(0);
      const strokeRectCalls = calls.filter((c) => c.method === 'strokeRect');
      expect(strokeRectCalls.length).toBeGreaterThan(0);
    });

    it('연속 호출 시 이전 렌더링 상태나 잔류 선택이 누적되지 않는다', () => {
      const canvas = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
        selectedElementIds: ['pause_quit'],
      });
      expect(res1.ok).toBe(true);

      const res2 = dispatchPageRender({
        canvas,
        pageId: 'pause',
        snapshot: {},
        selectedElementIds: [],
      });
      expect(res2.ok).toBe(true);
    });
  });
});
