import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';

/**
 * AppBootstrap 단위 테스트 (REFACTOR-MAIN-002 / Issue #302)
 *
 * 1. 생성 및 기본 상태 확인
 * 2. 생명주기 (init, start, dispose)
 * 3. 브라우저 이벤트 바인딩 및 해제 (resize, keydown, click)
 * 4. 노출되는 코어 시스템 인스턴스 검증 (stateMachine, sessionLifecycle, presentationAdapter 등)
 */

function createMockCanvas(clientW = 800, clientH = 600) {
  let width = clientW;
  let height = clientH;
  const ctx = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
  };

  const listeners: Record<string, Function[]> = {};

  return {
    clientWidth: clientW,
    clientHeight: clientH,
    get width() {
      return width;
    },
    set width(v: number) {
      width = v;
    },
    get height() {
      return height;
    },
    set height(v: number) {
      height = v;
    },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn((type: string, fn: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((cb) => cb !== fn);
      }
    }),
    dispatchEvent: vi.fn((event: any) => {
      const cbs = listeners[event.type] || [];
      cbs.forEach((cb) => cb(event));
      return true;
    }),
    _listeners: listeners,
  } as unknown as HTMLCanvasElement & {
    _listeners: Record<string, Function[]>;
  };
}

describe('AppBootstrap (Issue #302)', () => {
  let originalWindow: any;
  let originalDocument: any;
  let mockWindowListeners: Record<string, Function[]>;
  let mockDocumentListeners: Record<string, Function[]>;
  let mockCanvas: any;

  beforeEach(() => {
    mockWindowListeners = {};
    mockDocumentListeners = {};
    mockCanvas = createMockCanvas();

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;

    (globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn((type: string, fn: any) => {
        mockWindowListeners[type] = mockWindowListeners[type] || [];
        mockWindowListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockWindowListeners[type]) {
          mockWindowListeners[type] = mockWindowListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockWindowListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };

    (globalThis as any).document = {
      getElementById: vi.fn((id: string) => {
        if (id === 'game-canvas') return mockCanvas;
        return null;
      }),
      addEventListener: vi.fn((type: string, fn: any) => {
        mockDocumentListeners[type] = mockDocumentListeners[type] || [];
        mockDocumentListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockDocumentListeners[type]) {
          mockDocumentListeners[type] = mockDocumentListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockDocumentListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  it('AppBootstrap 인스턴스를 정상 생성하고 기본 시스템을 노출한다', () => {
    const bootstrap = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });

    expect(bootstrap).toBeDefined();
    expect(bootstrap.isInitialized).toBe(false);
    expect(bootstrap.isRunning).toBe(false);
    expect(bootstrap.isDisposed).toBe(false);

    // 코어 시스템 노출 확인
    expect(bootstrap.stateMachine).toBeDefined();
    expect(bootstrap.sessionLifecycle).toBeDefined();
    expect(bootstrap.presentationAdapter).toBeDefined();
    expect(bootstrap.engine).toBeDefined();
    expect(bootstrap.eventBus).toBeDefined();
    expect(bootstrap.canvasManager).toBeDefined();
    expect(bootstrap.cameraLayer).toBeDefined();
    expect(bootstrap.sessionContext).toBeDefined();
    expect(bootstrap.sceneDirector).toBeDefined();
  });

  it('생명주기 init(), start(), dispose() 순차 동작을 검증한다', async () => {
    const bootstrap = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });

    await bootstrap.init();
    expect(bootstrap.isInitialized).toBe(true);
    expect(bootstrap.isRunning).toBe(false);

    bootstrap.start();
    expect(bootstrap.isRunning).toBe(true);

    bootstrap.dispose();
    expect(bootstrap.isRunning).toBe(false);
    expect(bootstrap.isDisposed).toBe(true);
  });

  it('init 시 window resize, document keydown, canvas click 리스너를 등록하고 dispose 시 안전하게 해제한다', async () => {
    const bootstrap = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });

    await bootstrap.init();

    // 이벤트 리스너가 등록되었는지 확인
    expect((globalThis as any).window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect((globalThis as any).document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

    // 리스너가 실제로 동작하는지 시뮬레이션
    const resizeCbs = mockWindowListeners['resize'] || [];
    expect(resizeCbs.length).toBeGreaterThan(0);
    expect(() => resizeCbs[0]({ type: 'resize' })).not.toThrow();

    const keydownCbs = mockDocumentListeners['keydown'] || [];
    expect(keydownCbs.length).toBeGreaterThan(0);
    // 숫자 1 키 (정답 선택 핫키) 시뮬레이션
    expect(() => keydownCbs[0]({ key: '1', preventDefault: vi.fn() })).not.toThrow();

    const clickCbs = mockCanvas._listeners['click'] || [];
    expect(clickCbs.length).toBeGreaterThan(0);
    expect(() => clickCbs[0]({ clientX: 100, clientY: 100, preventDefault: vi.fn() })).not.toThrow();

    // dispose 호출
    bootstrap.dispose();

    // 이벤트 리스너 해제 호출 검증
    expect((globalThis as any).window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect((globalThis as any).document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('이미 dispose된 상태에서 dispose를 재호출해도 에러가 발생하지 않는다', async () => {
    const bootstrap = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
    await bootstrap.init();
    bootstrap.dispose();
    expect(() => bootstrap.dispose()).not.toThrow();
  });
});
