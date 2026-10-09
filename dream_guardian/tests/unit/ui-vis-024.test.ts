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
  playReadyPageAdapter,
  PLAY_READY_PAGE_ID,
  READY_POSITION_PAGE_ID,
  PLAY_READY_BOUNDS_IDS,
  registerPlayReadyPageAdapter,
} from '../../src/editor/ui/preview/screens/UIPlayReadyPage';
import { ReadyPositionRenderer } from '../../src/render/ReadyPositionRenderer';
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
    drawImage: vi.fn((img: any, ...args: number[]) =>
      calls.push({ method: 'drawImage', args: [img, ...args] })
    ),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    measureText: vi.fn((text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    })),
    setLineDash: vi.fn((pattern: number[]) =>
      calls.push({ method: 'setLineDash', args: [pattern] })
    ),
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

describe('UI-VIS-024: 플레이 시작 실제 렌더 페이지 어댑터 (UIPlayReadyPage / ReadyPositionRenderer 연결)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 레지스트리 등록 및 기본 라우팅 검증', () => {
    it('defaultPageAdapterRegistry에 play_ready 및 ready_position 페이지가 등록되어 있다', () => {
      expect(PLAY_READY_PAGE_ID).toBe('play_ready');
      expect(READY_POSITION_PAGE_ID).toBe('ready_position');
      expect(PLAY_READY_BOUNDS_IDS).toContain('ready_guide_box');
      expect(PLAY_READY_BOUNDS_IDS).toContain('ready_silhouette');
      expect(PLAY_READY_BOUNDS_IDS).toContain('ready_countdown');
      expect(PLAY_READY_BOUNDS_IDS).toContain('ready_title');
      expect(PLAY_READY_BOUNDS_IDS).toContain('ready_guide_text');
      expect(hasPageAdapter(PLAY_READY_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(READY_POSITION_PAGE_ID)).toBe(true);
      expect(getPageAdapter(PLAY_READY_PAGE_ID)).toBeDefined();
      expect(defaultPageAdapterRegistry.listPages()).toContain(PLAY_READY_PAGE_ID);
      expect(defaultPageAdapterRegistry.listPages()).toContain(READY_POSITION_PAGE_ID);
    });

    it('독립 레지스트리에 registerPlayReadyPageAdapter를 호출하여 어댑터를 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has('play_ready')).toBe(false);

      registerPlayReadyPageAdapter(customRegistry);

      expect(customRegistry.has('play_ready')).toBe(true);
      expect(customRegistry.has('ready_position')).toBe(true);
      expect(customRegistry.get('play_ready')).toBe(playReadyPageAdapter);
    });

    it('dispatchPageRender를 통해 play_ready 페이지 렌더링 요청 시 ok: true, drew: true를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('play_ready');
      expect(res.timestamp).toBeGreaterThan(0);
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);
    });

    it('dispatchPageRender를 통해 ready_position 별칭으로도 동일하게 정상 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'ready_position',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('ready_position');
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
        pageId: 'play_ready',
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
        pageId: 'play_ready',
        snapshot: { revision: 1 } as any,
        fixture: { revision: 2 } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('스냅샷 schemaVersion이 지원되지 않는 경우 unsupported-schema-version 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: { schemaVersion: '99.0.0' } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-schema-version');
    });

    it('모션 인식 보호 영역(alignmentFrame / body_alignment_area)의 geometry 변조 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatedSnapshot = {
        pages: {
          play_ready: {
            pageId: 'play_ready',
            elements: [
              {
                id: 'alignment_frame',
                type: 'container',
                bounds: { x: 50, y: 50, width: 900, height: 900 },
              },
            ],
          },
        },
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: violatedSnapshot,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('상단 HUD 보호 영역(y < 120)을 침범하는 커스텀 요소 배치 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatedSnapshot = {
        pages: {
          play_ready: {
            pageId: 'play_ready',
            elements: [
              {
                id: 'custom_banner',
                type: 'container',
                bounds: { x: 100, y: 50, width: 400, height: 100 },
              },
            ],
          },
        },
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: violatedSnapshot,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });
  });

  describe('3. 게임 런타임 및 하드웨어 부팅 0건 격리 검증', () => {
    it('카메라 웹캠 스트림, 미디어파이프 루프, 카운트다운 타이머 인터벌을 일체 부팅하지 않는다', () => {
      const getUserMediaSpy = vi.fn();
      if (typeof navigator !== 'undefined') {
        (navigator as any).mediaDevices = { getUserMedia: getUserMediaSpy };
      }
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(getUserMediaSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('AppBootstrap 및 GameLoop 런타임을 호출하지 않는다', () => {
      (globalThis as any).__appBootstrapped = undefined;
      (globalThis as any).__gameLoopRunning = undefined;

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect((globalThis as any).__appBootstrapped).toBeUndefined();
      expect((globalThis as any).__gameLoopRunning).toBeUndefined();
    });
  });

  describe('4. UIPresentationDocument 및 커스텀 bounds/스타일 바인딩 검증', () => {
    it('기본 UIPresentationDocument 주입 시 정상 렌더링되며 ready_guide_box, ready_silhouette, ready_countdown, ready_guide_text bounds를 반환한다', () => {
      const defaultDoc = createDefaultUIPresentationDocument();
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: defaultDoc,
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();

      const ids = res.renderedBounds?.map((b) => b.id) ?? [];
      expect(ids).toContain('ready_guide_box');
      expect(ids).toContain('ready_silhouette');
      expect(ids).toContain('ready_countdown');
      expect(ids).toContain('ready_guide_text');
      expect(ids).toContain('ready_title');
      expect(ids).toContain('ready_skip_notice');
      expect(ids).toContain('hud_player_hp');
      expect(ids).toContain('hud_boss_hp');
      expect(ids).toContain('bottom_bar');
    });

    it('문서 내 ready_guide_text 커스텀 오버라이드가 ReadyPositionRenderer 렌더 및 반환 bounds에 정확히 반영된다', () => {
      const canvas = createMockCanvas();
      const customDoc = {
        pages: {
          play_ready: {
            pageId: 'play_ready',
            elements: [
              {
                id: 'ready_guide_text',
                type: 'text',
                bounds: { x: 100, y: 200, width: 880, height: 90 },
                text: '커스텀 시작 준비 안내',
              },
            ],
          },
        },
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: customDoc,
      });

      expect(res.ok).toBe(true);
      const guideTextBound = res.renderedBounds?.find((b) => b.id === 'ready_guide_text');
      expect(guideTextBound).toBeDefined();
      expect(guideTextBound?.x).toBe(100);
      expect(guideTextBound?.y).toBe(200);
      expect(guideTextBound?.width).toBe(880);
      expect(guideTextBound?.height).toBe(90);

      const fillTextCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => c.args[0] === '커스텀 시작 준비 안내')).toBe(true);
    });
  });

  describe('5. 실제 렌더러 Spy 및 결정론적 Fixture 렌더링 검증', () => {
    it('가짜 사각형 대체를 금지하며 ReadyPositionRenderer, HUDLayer, BottomBar의 실제 render 메서드가 호출된다', () => {
      const readyRenderSpy = vi.spyOn(ReadyPositionRenderer.prototype, 'render');
      const hudRenderSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarRenderSpy = vi.spyOn(BottomBar.prototype, 'render');

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(readyRenderSpy).toHaveBeenCalled();
      expect(hudRenderSpy).toHaveBeenCalled();
      expect(bottomBarRenderSpy).toHaveBeenCalled();
    });

    it('카운트다운 3초 상태 fixture 주입 시 "3" 및 미정렬 안내 문구를 렌더링한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
        fixture: {
          isAligned: false,
          currentCount: 3,
          countText: '3',
        } as any,
      });

      expect(res.ok).toBe(true);
      const fillTextCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => c.args[0] === '3')).toBe(true);
      expect(fillTextCalls.some((c) => c.args[0] === '카메라 앞에 서서 준비하세요!')).toBe(true);
    });

    it('카운트다운 완료(0초/START!) 및 정렬 완료(isAligned: true) fixture 주입 시 "START!" 및 정렬 완료 문구를 렌더링한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
        fixture: {
          isAligned: true,
          currentCount: 0,
          countText: 'START!',
        } as any,
      });

      expect(res.ok).toBe(true);
      const fillTextCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => c.args[0] === 'START!')).toBe(true);
      expect(fillTextCalls.some((c) => c.args[0] === '정렬 완료! 자세를 유지하세요')).toBe(true);
    });
  });

  describe('6. 선택 요소 하이라이트 표시 및 잔류 0건 가드', () => {
    it('selectedElementIds에 지정된 요소의 bounds에 대시 스트로크 하이라이트를 그린다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
        selectedElementIds: ['ready_countdown'],
      });

      expect(res.ok).toBe(true);
      const dashCalls = canvas.mockCtx.calls.filter((c) => c.method === 'setLineDash');
      expect(dashCalls.length).toBeGreaterThan(0);
      expect(dashCalls.some((c) => JSON.stringify(c.args[0]) === JSON.stringify([8, 4]))).toBe(true);

      const strokeRectCalls = canvas.mockCtx.calls.filter((c) => c.method === 'strokeRect');
      expect(strokeRectCalls.length).toBeGreaterThan(0);
    });

    it('선택 요소가 없을 때는 하이라이트 사각형을 그리지 않는다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'play_ready',
        snapshot: {},
        selectedElementIds: [],
      });

      expect(res.ok).toBe(true);
      const dashCalls = canvas.mockCtx.calls.filter(
        (c) => c.method === 'setLineDash' && JSON.stringify(c.args[0]) === JSON.stringify([8, 4])
      );
      expect(dashCalls.length).toBe(0);
    });
  });
});
