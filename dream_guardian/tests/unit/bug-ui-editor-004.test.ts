/**
 * bug-ui-editor-004.test.ts
 *
 * Issue #551 ([BUG-UI-EDITOR-004] UI 비주얼 에디터 미리보기 iframe이 비어 있음)
 *
 * 검증 항목:
 * 1. 에디터 페이지 ID -> 게임 페이지 ID 매핑 (menu_main -> main_home, menu_sub -> submenu 등)
 * 2. mountPreviewFrame 초기화 시 올바른 게임 pageId로 ParentBridge 초기화 및 snapshot 전송
 * 3. updateDocument 호출 시 올바른 게임 pageId로 브리지 갱신 및 snapshot 재전송
 * 4. initPreviewApp(preview/main.ts)에서 ChildBridge를 생성/연결하여 부모의 snapshot 수신 시 어댑터 디스패치 및 preview:result 회신
 * 5. ui-preview.html 스타일 높이(100%) 반영 시 computeLetterboxLayout이 valid: true 레이아웃을 산출
 */

import { describe, it, expect, vi } from 'vitest';
import {
  mountPreviewFrame,
  toGamePageId,
  EDITOR_TO_GAME_PAGE_MAP,
} from '../../src/editor/ui/view/UIPreviewFrameView';
import { initPreviewApp } from '../../src/editor/ui/preview/main';
import { computeLetterboxLayout } from '../../src/editor/ui/preview/UIPageAdapters';
import { createBridgeEnvelope } from '../../src/editor/ui/preview/UIVisualBridge';

describe('[BUG-UI-EDITOR-004] UI 미리보기 iframe 연동 및 렌더 복구 검증', () => {
  const TEST_ORIGIN = 'http://localhost:3000';

  function createMockWindow(origin = TEST_ORIGIN) {
    const listeners = new Map<string, Array<(ev: any) => void>>();
    const win: any = {
      origin,
      location: { origin, search: '' },
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
      postMessage: vi.fn((_data: any) => {
        // Mock postMessage handler
      }),
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
    return win;
  }

  describe('1. 에디터 페이지 ID -> 게임 페이지 ID 매핑 검증', () => {
    it('toGamePageId가 에디터 ID를 등록된 어댑터 게임 ID로 정확히 변환해야 한다', () => {
      expect(typeof toGamePageId).toBe('function');
      expect(EDITOR_TO_GAME_PAGE_MAP.menu_main).toBe('main_home');
      expect(toGamePageId('menu_main')).toBe('main_home');
      expect(toGamePageId('menu_sub')).toBe('submenu');
      expect(toGamePageId('settings')).toBe('options');
      expect(toGamePageId('pause')).toBe('pause');
      expect(toGamePageId('ready_position')).toBe('play_ready');
      expect(toGamePageId('run_question')).toBe('running_question');
      expect(toGamePageId('answer_select')).toBe('answer_select');
      expect(toGamePageId('hazard_evade')).toBe('hazard_evade');
      expect(toGamePageId('boss_climax')).toBe('boss_battle');
      expect(toGamePageId('result')).toBe('result');
    });

    it('이미 게임 ID인 경우 원본 ID를 그대로 유지해야 한다', () => {
      expect(toGamePageId('main_home')).toBe('main_home');
      expect(toGamePageId('submenu')).toBe('submenu');
      expect(toGamePageId('options')).toBe('options');
    });
  });

  describe('2. UIPreviewFrameView의 초기 snapshot 전송 및 페이지 전환 갱신 검증', () => {
    it('mountPreviewFrame은 menu_main 에디터 ID를 main_home으로 변환하여 브리지를 생성하고 snapshot을 전송해야 한다', () => {
      const mockParentWin = createMockWindow(TEST_ORIGIN);
      const mockChildWin = createMockWindow(TEST_ORIGIN);
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockParentWin;

      const mockDoc = {
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag,
            className: '',
            setAttribute: vi.fn((k, v) => { el[k] = v; }),
            getAttribute: vi.fn((k) => el[k]),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            textContent: '',
            contentWindow: mockChildWin,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
          return el;
        },
      };

      const container: any = {
        ownerDocument: mockDoc,
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      try {
        const frameInstance = mountPreviewFrame(container, {
          docId: 'doc-1',
          pageId: 'menu_main',
          origin: TEST_ORIGIN,
        });

        // Child 창에 postMessage로 snapshot이 전달되었는지 확인
        expect(mockChildWin.postMessage).toHaveBeenCalled();
        const sentCalls = mockChildWin.postMessage.mock.calls;
        const snapshotMsg = sentCalls.find((call: any[]) => call[0]?.kind === 'preview:snapshot');
        expect(snapshotMsg).toBeDefined();
        expect(snapshotMsg[0].pageId).toBe('main_home');
        expect(snapshotMsg[0].kind).toBe('preview:snapshot');

        frameInstance.dispose();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });

    it('updateDocument 호출 시 새로운 게임 페이지 ID로 갱신되고 snapshot이 재전송되어야 한다', () => {
      const mockParentWin = createMockWindow(TEST_ORIGIN);
      const mockChildWin = createMockWindow(TEST_ORIGIN);
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockParentWin;

      const mockDoc = {
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag,
            className: '',
            setAttribute: vi.fn((k, v) => { el[k] = v; }),
            getAttribute: vi.fn((k) => el[k]),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            textContent: '',
            contentWindow: mockChildWin,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
          return el;
        },
      };

      const container: any = {
        ownerDocument: mockDoc,
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      try {
        const frameInstance = mountPreviewFrame(container, {
          docId: 'doc-1',
          pageId: 'menu_main',
          origin: TEST_ORIGIN,
        });

        mockChildWin.postMessage.mockClear();

        // 페이지를 'menu_sub'로 전환
        frameInstance.updateDocument('menu_sub');

        expect(mockChildWin.postMessage).toHaveBeenCalled();
        const sentCalls = mockChildWin.postMessage.mock.calls;
        const updateSnapshotMsg = sentCalls.find(
          (call: any[]) => call[0]?.kind === 'preview:snapshot'
        );
        expect(updateSnapshotMsg).toBeDefined();
        expect(updateSnapshotMsg[0].pageId).toBe('submenu');

        frameInstance.dispose();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });

    it('자식이 preview:ready를 보고하면 부모는 즉시 snapshot을 응답 전송해야 한다', () => {
      const mockParentWin = createMockWindow(TEST_ORIGIN);
      const mockChildWin = createMockWindow(TEST_ORIGIN);
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockParentWin;

      const mockDoc = {
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag,
            className: '',
            setAttribute: vi.fn((k, v) => { el[k] = v; }),
            getAttribute: vi.fn((k) => el[k]),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            textContent: '',
            contentWindow: mockChildWin,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
          return el;
        },
      };

      const container: any = {
        ownerDocument: mockDoc,
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      try {
        const frameInstance = mountPreviewFrame(container, {
          docId: 'doc-1',
          pageId: 'menu_main',
          origin: TEST_ORIGIN,
        });

        mockChildWin.postMessage.mockClear();

        // child -> parent: preview:ready 발송
        mockParentWin.dispatch('message', {
          origin: TEST_ORIGIN,
          source: mockChildWin,
          data: createBridgeEnvelope({
            docId: 'doc-1',
            pageId: 'main_home',
            sessionId: 'sess-1',
            kind: 'preview:ready',
            generation: 1,
            revision: 1,
            payload: { artboardWidth: 1080, artboardHeight: 2160 },
          }),
        });

        const sentCalls = mockChildWin.postMessage.mock.calls;
        const readyResponseSnapshot = sentCalls.find(
          (call: any[]) => call[0]?.kind === 'preview:snapshot'
        );
        expect(readyResponseSnapshot).toBeDefined();
        expect(readyResponseSnapshot[0].pageId).toBe('main_home');

        frameInstance.dispose();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });
  });

  describe('3. preview/main.ts 진입점 ChildBridge 연결 및 렌더 수신 검증', () => {
    it('initPreviewApp은 ChildBridge를 생성하고 preview:snapshot을 수신하여 렌더링해야 한다', () => {
      const mockParentWin = createMockWindow(TEST_ORIGIN);
      const mockChildWin = createMockWindow(TEST_ORIGIN);
      mockChildWin.parent = mockParentWin;

      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockChildWin;

      const mockCtx: any = new Proxy(
        {
          setTransform: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          fillText: vi.fn(),
          strokeText: vi.fn(),
          measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arc: vi.fn(),
          rect: vi.fn(),
          roundRect: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          drawImage: vi.fn(),
          createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        },
        {
          get(target: any, prop: string) {
            if (prop in target) return target[prop];
            return vi.fn();
          },
        }
      );

      const mockCanvas: any = {
        width: 0,
        height: 0,
        style: {},
        getContext: vi.fn(() => mockCtx),
      };

      const mockContainer: any = {
        clientWidth: 540,
        clientHeight: 1080,
        offsetWidth: 540,
        offsetHeight: 1080,
        ownerDocument: {
          createElement: vi.fn((tag: string) => {
            if (tag === 'canvas') return mockCanvas;
            return { style: {}, setAttribute: vi.fn(), appendChild: vi.fn() };
          }),
        },
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      try {
        const mount = initPreviewApp({
          container: mockContainer,
          canvas: mockCanvas,
          parentOrigin: TEST_ORIGIN,
        });

        expect(mount).not.toBeNull();
        expect(mount?.canvas).toBeDefined();

        // Parent에서 Child로 preview:snapshot 전송
        mockChildWin.dispatch('message', {
          origin: TEST_ORIGIN,
          source: mockParentWin,
          data: createBridgeEnvelope({
            docId: 'doc-app',
            pageId: 'main_home',
            sessionId: 'sess-app',
            generation: 1,
            revision: 2,
            kind: 'preview:snapshot',
            payload: {},
          }),
        });

        // Child가 snapshot 처리 후 Parent에 preview:result를 회신했는지 검증
        const parentCalls = mockParentWin.postMessage.mock.calls;
        const resultMsg = parentCalls.find((call: any[]) => call[0]?.kind === 'preview:result');
        expect(resultMsg).toBeDefined();
        expect(resultMsg[0].payload?.ok).toBe(true);
        expect(resultMsg[0].payload?.drew).toBe(true);

        mount?.dispose();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });

    it('initPreviewApp에 canvas를 명시하지 않아도 container의 ownerDocument로부터 canvas를 생성해야 한다', () => {
      const mockParentWin = createMockWindow(TEST_ORIGIN);
      const mockChildWin = createMockWindow(TEST_ORIGIN);
      mockChildWin.parent = mockParentWin;

      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockChildWin;

      const mockCtx: any = new Proxy(
        {
          setTransform: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          fillText: vi.fn(),
          strokeText: vi.fn(),
          measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arc: vi.fn(),
          rect: vi.fn(),
          roundRect: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          drawImage: vi.fn(),
          createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        },
        {
          get(target: any, prop: string) {
            if (prop in target) return target[prop];
            return vi.fn();
          },
        }
      );

      const mockCanvas: any = {
        width: 0,
        height: 0,
        style: {},
        getContext: vi.fn(() => mockCtx),
      };

      const mockContainer: any = {
        clientWidth: 540,
        clientHeight: 1080,
        offsetWidth: 540,
        offsetHeight: 1080,
        ownerDocument: {
          createElement: vi.fn((tag: string) => {
            if (tag === 'canvas') return mockCanvas;
            return { style: {}, setAttribute: vi.fn(), appendChild: vi.fn() };
          }),
        },
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      try {
        const mount = initPreviewApp({
          container: mockContainer,
          parentOrigin: TEST_ORIGIN,
        });

        expect(mount).not.toBeNull();
        expect(mount?.canvas).toBe(mockCanvas);

        mount?.dispose();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });
  });

  describe('4. ui-preview.html 레이아웃 유효성 검증', () => {
    it('100% 높이가 주어졌을 때 computeLetterboxLayout이 valid: true를 반환해야 한다', () => {
      // 0 높이일 경우
      const zeroLayout = computeLetterboxLayout(540, 0, 1);
      expect(zeroLayout.valid).toBe(false);

      // 브라우저 뷰포트 크기(예: 540x1080)일 경우
      const validLayout = computeLetterboxLayout(540, 1080, 1);
      expect(validLayout.valid).toBe(true);
      expect(validLayout.renderWidth).toBeGreaterThan(0);
      expect(validLayout.renderHeight).toBeGreaterThan(0);
      expect(validLayout.scale).toBeGreaterThan(0);
    });
  });
});
