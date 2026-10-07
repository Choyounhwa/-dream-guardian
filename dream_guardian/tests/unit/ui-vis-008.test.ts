import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  ARTBOARD_ASPECT_RATIO,
  computeLetterboxLayout,
  createDeterministicFixture,
  PageAdapterRegistry,
  registerPageAdapter,
  getPageAdapter,
  hasPageAdapter,
  unregisterPageAdapter,
  clearPageAdapters,
  listRegisteredPageAdapters,
  dispatchPageRender,
  mountPreviewCanvas,
  type PageAdapter,
  type PageRenderContext,
  type PageRenderResult,
  type DeterministicFixture,
} from '../../src/editor/ui/preview/UIPageAdapters';
import {
  IFRAME_IS_SECURITY_SANDBOX,
  GAME_APPLY_VERIFIED,
  PREVIEW_CONTEXT_ID,
  createPreviewSession,
} from '../../src/editor/ui/preview/UIPreviewAdapter';
import { createPreviewEntry } from '../../src/editor/ui/preview/main';
import {
  ChildBridge,
  ParentBridge,
  type UIVisualBridgeEnvelope,
} from '../../src/editor/ui/preview/UIVisualBridge';

describe('[Issue #438 / UI-VIS-008] 실제 Canvas 마운트와 페이지 렌더 디스패치', () => {
  // Mock 2D Context factory
  function createMockContext2D() {
    const calls: { method: string; args: unknown[] }[] = [];
    return {
      calls,
      clearRect: vi.fn((x: number, y: number, w: number, h: number) => {
        calls.push({ method: 'clearRect', args: [x, y, w, h] });
      }),
      fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
        calls.push({ method: 'fillRect', args: [x, y, w, h] });
      }),
      strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
        calls.push({ method: 'strokeRect', args: [x, y, w, h] });
      }),
      fillText: vi.fn((text: string, x: number, y: number) => {
        calls.push({ method: 'fillText', args: [text, x, y] });
      }),
      drawImage: vi.fn((...args: unknown[]) => {
        calls.push({ method: 'drawImage', args });
      }),
      setTransform: vi.fn((...args: unknown[]) => {
        calls.push({ method: 'setTransform', args });
      }),
      save: vi.fn(() => calls.push({ method: 'save', args: [] })),
      restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    };
  }

  // Mock Canvas factory
  function createMockCanvas(width = 0, height = 0) {
    const ctx = createMockContext2D();
    const style: Record<string, string> = {};
    let parentNode: any = null;

    const canvas = {
      clientWidth: width,
      clientHeight: height,
      width: 0,
      height: 0,
      style,
      getContext: vi.fn((id: string) => (id === '2d' ? ctx : null)),
      mockCtx: ctx,
      get parentNode() {
        return parentNode;
      },
      set parentNode(node: any) {
        parentNode = node;
      },
      remove: vi.fn(() => {
        if (parentNode && parentNode.removeChild) {
          parentNode.removeChild(canvas);
        }
      }),
    };
    return canvas as unknown as HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockContext2D> };
  }

  // Mock Container factory
  function createMockContainer(width = 1920, height = 1080) {
    const children: any[] = [];
    const container = {
      clientWidth: width,
      clientHeight: height,
      children,
      appendChild: vi.fn((child: any) => {
        children.push(child);
        child.parentNode = container;
        return child;
      }),
      removeChild: vi.fn((child: any) => {
        const idx = children.indexOf(child);
        if (idx !== -1) {
          children.splice(idx, 1);
          child.parentNode = null;
        }
        return child;
      }),
      contains: vi.fn((child: any) => children.includes(child)),
    };
    return container as unknown as HTMLElement;
  }

  // Mock Window factory
  function createMockWindow(origin = 'http://localhost:3000') {
    const listeners = new Map<string, Array<(ev: any) => void>>();
    return {
      origin,
      addEventListener: vi.fn((event: string, handler: (ev: any) => void) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (ev: any) => void) => {
        const list = listeners.get(event);
        if (list) {
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
        }
      }),
      postMessage: vi.fn(),
      dispatch(event: string, data: any) {
        const list = listeners.get(event);
        if (list) {
          for (const fn of list) {
            fn(data);
          }
        }
      },
      get listenerCount() {
        return Array.from(listeners.values()).reduce((sum, l) => sum + l.length, 0);
      },
    };
  }

  beforeEach(() => {
    clearPageAdapters();
  });

  describe('1. 실제 1080x2160 Artboard Canvas 마운트 및 Letterbox 레이아웃', () => {
    it('아트보드 표준 해상도 상수(1080x2160) 및 종횡비(0.5)가 정확하다', () => {
      expect(ARTBOARD_WIDTH).toBe(1080);
      expect(ARTBOARD_HEIGHT).toBe(2160);
      expect(ARTBOARD_ASPECT_RATIO).toBeCloseTo(0.5, 5);
    });

    it('16:9 가로 와이드 컨테이너(1920x1080)에서 Pillarbox(좌우 여백)가 정확히 계산된다', () => {
      // 1080x2160 비율에서 height 1080에 맞추면 width = 1080 * (1080 / 2160) = 540
      // scale = 1080 / 2160 = 0.5
      // 좌우 여백 offsetX = (1920 - 540) / 2 = 690, offsetY = 0
      const layout = computeLetterboxLayout(1920, 1080, 1);
      expect(layout.valid).toBe(true);
      expect(layout.scale).toBeCloseTo(0.5, 4);
      expect(layout.renderWidth).toBe(540);
      expect(layout.renderHeight).toBe(1080);
      expect(layout.offsetX).toBe(690);
      expect(layout.offsetY).toBe(0);
      expect(layout.canvasPixelWidth).toBe(1080);
      expect(layout.canvasPixelHeight).toBe(2160);
    });

    it('긴 세로 컨테이너(600x1800)에서 Letterbox(상하 여백)가 정확히 계산된다', () => {
      // container aspect = 600 / 1800 = 0.3333 < 0.5
      // width 600에 맞추면 scale = 600 / 1080 = 0.55555...
      // renderWidth = 600, renderHeight = 2160 * (600 / 1080) = 1200
      // 상하 여백 offsetY = (1800 - 1200) / 2 = 300, offsetX = 0
      const layout = computeLetterboxLayout(600, 1800, 1);
      expect(layout.valid).toBe(true);
      expect(layout.renderWidth).toBe(600);
      expect(layout.renderHeight).toBe(1200);
      expect(layout.offsetX).toBe(0);
      expect(layout.offsetY).toBe(300);
    });

    it('DPR이 2일 때 픽셀 버퍼 크기가 DPR 배수로 스케일링된다', () => {
      const layout = computeLetterboxLayout(1920, 1080, 2);
      expect(layout.dpr).toBe(2);
      expect(layout.canvasPixelWidth).toBe(2160);
      expect(layout.canvasPixelHeight).toBe(4320);
    });

    it('컨테이너 너비 또는 높이가 0 이하일 때 크래시 없이 valid: false 및 0 크기를 반환한다', () => {
      const zeroW = computeLetterboxLayout(0, 1080);
      expect(zeroW.valid).toBe(false);
      expect(zeroW.scale).toBe(0);
      expect(zeroW.renderWidth).toBe(0);

      const zeroH = computeLetterboxLayout(1920, 0);
      expect(zeroH.valid).toBe(false);
      expect(zeroH.renderHeight).toBe(0);

      const negative = computeLetterboxLayout(-100, -200);
      expect(negative.valid).toBe(false);
    });

    it('mountPreviewCanvas 호출 시 Canvas가 컨테이너에 실제 마운트되고 초기 스타일이 적용된다', () => {
      const container = createMockContainer(1920, 1080);
      const canvas = createMockCanvas();

      const mount = mountPreviewCanvas({
        container,
        canvas,
        dpr: 1,
      });

      expect(container.appendChild).toHaveBeenCalledWith(canvas);
      expect(mount.canvas).toBe(canvas);
      expect(mount.container).toBe(container);

      const layout = mount.getLayout();
      expect(layout.valid).toBe(true);
      expect(canvas.style.position).toBe('absolute');
      expect(canvas.style.left).toBe('690px');
      expect(canvas.style.top).toBe('0px');
      expect(canvas.style.width).toBe('540px');
      expect(canvas.style.height).toBe('1080px');
      expect(canvas.width).toBe(1080);
      expect(canvas.height).toBe(2160);

      // dispose 검증
      expect(mount.isDisposed()).toBe(false);
      mount.dispose();
      expect(mount.isDisposed()).toBe(true);
      expect(container.removeChild).toHaveBeenCalledWith(canvas);
    });
  });

  describe('2. 페이지 어댑터 레지스트리 (UIPageAdapters)', () => {
    it('어댑터 등록, 조회, 목록, 해제가 정확하게 동작한다', () => {
      const dummyAdapter: PageAdapter = (ctx) => ({
        ok: true,
        drew: true,
        pageId: ctx.pageId,
        renderedElementCount: 2,
      });

      expect(hasPageAdapter('menu_main')).toBe(false);
      registerPageAdapter('menu_main', dummyAdapter);
      expect(hasPageAdapter('menu_main')).toBe(true);
      expect(getPageAdapter('menu_main')).toBe(dummyAdapter);
      expect(listRegisteredPageAdapters()).toContain('menu_main');

      const removed = unregisterPageAdapter('menu_main');
      expect(removed).toBe(true);
      expect(hasPageAdapter('menu_main')).toBe(false);
      expect(getPageAdapter('menu_main')).toBeUndefined();
    });

    it('독립된 PageAdapterRegistry 인스턴스 생성 및 격리된 동작이 가능하다', () => {
      const customRegistry = new PageAdapterRegistry();
      const mockAdapter: PageAdapter = () => ({
        ok: true,
        drew: true,
        pageId: 'custom_page',
      });
      customRegistry.register('custom_page', mockAdapter);
      expect(customRegistry.has('custom_page')).toBe(true);
      expect(hasPageAdapter('custom_page')).toBe(false); // 전역 레지스트리와 격리

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'custom_page',
        snapshot: {},
        registry: customRegistry,
      });
      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
    });

    it('결정론적 fixture 생성 시 clockMs, seed, assetResolver를 정확히 제공한다', () => {
      const fixture: DeterministicFixture = createDeterministicFixture({
        clockMs: 5000,
        seed: 42,
      });
      expect(fixture.clockMs).toBe(5000);
      expect(fixture.seed).toBe(42);
      expect(typeof fixture.assetResolver).toBe('function');
      expect(fixture.assetResolver('badge_1')).toBe('asset://badge_1');
    });

    it('미등록 페이지 렌더 요청 시 가짜 사각형을 그리지 않고 명시적으로 unsupported-page를 반환한다', () => {
      const canvas = createMockCanvas(1080, 2160);
      const ctx = canvas.mockCtx;

      const result = dispatchPageRender({
        canvas,
        pageId: 'unregistered_unknown_page',
        snapshot: { elements: [] },
      });

      expect(result.ok).toBe(false);
      expect(result.drew).toBe(false);
      expect(result.pageId).toBe('unregistered_unknown_page');
      expect(result.reason).toBe('unsupported-page');

      // 중요한 규칙: 가짜 사각형이나 더미 렌더 호출이 일체 발생하지 않아야 함
      expect(ctx.fillRect).not.toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('등록된 어댑터가 호출될 때 Canvas 2D 컨텍스트에 정상 렌더링되고 결과가 반환된다', () => {
      const canvas = createMockCanvas(1080, 2160);
      const ctx = canvas.mockCtx;

      const mockAdapter: PageAdapter = (renderCtx) => {
        // 실제 드로잉 수행
        renderCtx.ctx.fillRect(100, 200, 300, 400);
        return {
          ok: true,
          drew: true,
          pageId: renderCtx.pageId,
          renderedElementCount: 1,
          renderedBounds: [{ id: 'card-play', x: 100, y: 200, width: 300, height: 400 }],
        };
      };

      registerPageAdapter('menu_main', mockAdapter);

      const result = dispatchPageRender({
        canvas,
        pageId: 'menu_main',
        snapshot: { pageId: 'menu_main', elements: [] },
        snapshotRevision: 3,
        currentRevision: 3,
      });

      expect(result.ok).toBe(true);
      expect(result.drew).toBe(true);
      expect(result.pageId).toBe('menu_main');
      expect(result.renderedElementCount).toBe(1);
      expect(result.renderedBounds).toEqual([
        { id: 'card-play', x: 100, y: 200, width: 300, height: 400 },
      ]);
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillRect).toHaveBeenCalledWith(100, 200, 300, 400);
    });

    it('지연된 stale revision 요청 시 렌더를 거부하고 stale-revision을 반환한다', () => {
      const canvas = createMockCanvas(1080, 2160);
      const ctx = canvas.mockCtx;

      const adapter: PageAdapter = vi.fn((ctx) => ({
        ok: true,
        drew: true,
        pageId: ctx.pageId,
      }));
      registerPageAdapter('menu_main', adapter);

      const result = dispatchPageRender({
        canvas,
        pageId: 'menu_main',
        snapshot: { elements: [] },
        currentRevision: 10,
        snapshotRevision: 8, // stale!
      });

      expect(result.ok).toBe(false);
      expect(result.drew).toBe(false);
      expect(result.reason).toBe('stale-revision');
      expect(adapter).not.toHaveBeenCalled();
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('3. 양방향 Bridge 및 Dispatcher 연동', () => {
    it('ChildBridge를 통해 preview:snapshot 메시지를 수신하여 어댑터로 디스패치하고 preview:result를 응답한다', () => {
      const parentWin = createMockWindow('http://localhost:3000');
      const childWin = createMockWindow('http://localhost:3000');
      (childWin as any).parent = parentWin;
      const iframe = { contentWindow: childWin } as any;

      const parentBridge = new ParentBridge({
        window: parentWin as any,
        iframe,
        targetOrigin: 'http://localhost:3000',
        docId: 'doc-438',
        pageId: 'menu_main',
        sessionId: 'sess-438',
        initialGeneration: 1,
        initialRevision: 1,
      });

      const childBridge = new ChildBridge({
        window: childWin as any,
        parentOrigin: 'http://localhost:3000',
        docId: 'doc-438',
        pageId: 'menu_main',
        sessionId: 'sess-438',
        generation: 1,
        revision: 1,
      });

      const container = createMockContainer(1920, 1080);
      const canvas = createMockCanvas();

      // 어댑터 등록
      const adapter = vi.fn((ctx: PageRenderContext): PageRenderResult => ({
        ok: true,
        drew: true,
        pageId: ctx.pageId,
        renderedElementCount: 3,
        renderedBounds: [{ id: 'hero-title', x: 100, y: 100, width: 200, height: 50 }],
      }));
      registerPageAdapter('menu_main', adapter);

      const results: PageRenderResult[] = [];
      const mount = mountPreviewCanvas({
        container,
        canvas,
        bridge: childBridge,
        onRenderResult: (r) => results.push(r),
      });

      // parent에서 snapshot 전송 시뮬레이션
      const snapshotEnvelope: UIVisualBridgeEnvelope = {
        protocolVersion: '1.0.0',
        docId: 'doc-438',
        pageId: 'menu_main',
        sessionId: 'sess-438',
        generation: 1,
        revision: 2,
        requestId: 'req-snap-1',
        kind: 'preview:snapshot',
        payload: { pageId: 'menu_main', elements: [] },
      };

      // childBridge의 messageHandler를 직접 트리거
      childWin.dispatch('message', {
        origin: 'http://localhost:3000',
        source: parentWin,
        data: snapshotEnvelope,
      });

      expect(adapter).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].ok).toBe(true);
      expect(results[0].drew).toBe(true);
      expect(results[0].renderedElementCount).toBe(3);

      mount.dispose();
      parentBridge.dispose();
      childBridge.dispose();
    });

    it('미등록 페이지의 snapshot이 수신되면 drew=false 및 unsupported-page 응답이 전송된다', () => {
      const parentWin = createMockWindow('http://localhost:3000');
      const childWin = createMockWindow('http://localhost:3000');
      (childWin as any).parent = parentWin;

      const childBridge = new ChildBridge({
        window: childWin as any,
        parentOrigin: 'http://localhost:3000',
        docId: 'doc-438',
        pageId: 'menu_unknown',
        sessionId: 'sess-438',
        generation: 1,
        revision: 1,
      });

      const container = createMockContainer(1920, 1080);
      const canvas = createMockCanvas();

      const results: PageRenderResult[] = [];
      const mount = mountPreviewCanvas({
        container,
        canvas,
        bridge: childBridge,
        onRenderResult: (r) => results.push(r),
      });

      childWin.dispatch('message', {
        origin: 'http://localhost:3000',
        source: parentWin,
        data: {
          protocolVersion: '1.0.0',
          docId: 'doc-438',
          pageId: 'menu_unknown',
          sessionId: 'sess-438',
          generation: 1,
          revision: 2,
          requestId: 'req-snap-2',
          kind: 'preview:snapshot',
          payload: {},
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].ok).toBe(false);
      expect(results[0].drew).toBe(false);
      expect(results[0].reason).toBe('unsupported-page');

      mount.dispose();
      childBridge.dispose();
    });
  });

  describe('4. 보안 및 격리 절대 준수', () => {
    it('IFRAME_IS_SECURITY_SANDBOX는 false이고 GAME_APPLY_VERIFIED도 false이다', () => {
      expect(IFRAME_IS_SECURITY_SANDBOX).toBe(false);
      expect(GAME_APPLY_VERIFIED).toBe(false);
    });

    it('preview entry 생성 시 PREVIEW_CONTEXT_ID가 유지되고 샌드박스 경고가 일치한다', () => {
      const entry = createPreviewEntry();
      expect(entry.PREVIEW_CONTEXT_ID).toBe(PREVIEW_CONTEXT_ID);
      expect(entry.IFRAME_IS_SECURITY_SANDBOX).toBe(false);
      expect(entry.GAME_APPLY_VERIFIED).toBe(false);

      const session = createPreviewSession({
        fingerprint: 'non-matching',
        cache: new Map(),
      });
      expect(session.locked).toBe(true);
    });

    it('src/editor/ui/preview/main.ts 소스 코드에 런타임 게임 실행 및 금지된 API가 일체 없다', () => {
      const source = readFileSync(
        new URL('../../src/editor/ui/preview/main.ts', import.meta.url),
        'utf8'
      );
      // uix-006 검증과 동일한 금지 패턴 검사
      expect(source).not.toMatch(
        /localStorage|mediaDevices|indexedDB|fetch\(|WebSocket|bootGame|src\/ui|src\/core|src\/render/
      );
      // AppBootstrap이나 SceneDirector 호출 없음 검증
      expect(source).not.toMatch(/AppBootstrap|SceneDirector|gameLoop/);
    });
  });
});
