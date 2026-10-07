import { describe, expect, it, vi } from 'vitest';
import {
  UI_PREVIEW_PROTOCOL_VERSION,
  MAX_BRIDGE_PAYLOAD_BYTES,
  DANGEROUS_KEYS,
  FORBIDDEN_BRIDGE_KINDS,
  SAFE_BRIDGE_KINDS,
  ParentBridge,
  ChildBridge,
  validateBridgeEnvelope,
  createBridgeEnvelope,
} from '../../src/editor/ui/preview/UIVisualBridge';
import {
  IFRAME_IS_SECURITY_SANDBOX,
  acceptPreviewMessage,
  issueRequest,
  type PreviewHost,
} from '../../src/editor/ui/UIPreviewHost';
import {
  mountPreviewFrame,
  SANDBOX_DISCLAIMER_TEXT,
} from '../../src/editor/ui/view/UIPreviewFrameView';

describe('[Issue #437 / UI-VIS-007] 정확한 출처 검증과 revision 미리보기 브리지', () => {
  const HOST_ORIGIN = 'http://localhost:3000';
  const OTHER_ORIGIN = 'https://malicious.example.com';
  const DOC_ID = 'doc-test-437';
  const PAGE_ID = 'menu_main';
  const SESSION_ID = 'sess-437-abc';

  // Mock window and iframe factories
  function createMockWindow(origin = HOST_ORIGIN) {
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

  describe('1. 프로토콜 규격 및 봉투(Envelope) 구조 검증', () => {
    it('프로토콜 버전 상수가 1.0.0이어야 한다', () => {
      expect(UI_PREVIEW_PROTOCOL_VERSION).toBe('1.0.0');
    });

    it('봉투 생성 시 필수 7대 필드(protocolVersion, docId, pageId, sessionId, generation, revision, requestId)가 포함되어야 한다', () => {
      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 10,
        requestId: 'req-001',
        kind: 'preview:snapshot',
        payload: { elements: [] },
      });

      expect(envelope.protocolVersion).toBe(UI_PREVIEW_PROTOCOL_VERSION);
      expect(envelope.docId).toBe(DOC_ID);
      expect(envelope.pageId).toBe(PAGE_ID);
      expect(envelope.sessionId).toBe(SESSION_ID);
      expect(envelope.generation).toBe(1);
      expect(envelope.revision).toBe(10);
      expect(envelope.requestId).toBe('req-001');
      expect(envelope.kind).toBe('preview:snapshot');
      expect(envelope.payload).toEqual({ elements: [] });
      expect(typeof envelope.timestamp).toBe('number');
    });

    it('프로토콜 버전 불일치 시 invalid-protocol-version 사유로 거부되어야 한다', () => {
      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 1,
        requestId: 'req-002',
        kind: 'preview:snapshot',
      });
      (envelope as any).protocolVersion = '0.9.0';

      const mockChildWin = createMockWindow();

      const result = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: HOST_ORIGIN,
        expectedSourceWindow: mockChildWin,
        eventSourceWindow: mockChildWin,
        currentGeneration: 1,
        currentRevision: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid-protocol-version');
    });
  });

  describe('2. 출처 및 창(Window) 엄격 검증', () => {
    it('Parent는 동일 origin이라도 출처 window가 iframe.contentWindow가 아니면 거부해야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      const mockOtherWin = createMockWindow(HOST_ORIGIN); // same origin, different window

      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 2,
        requestId: 'req-src-1',
        kind: 'preview:snapshot',
      });

      const result = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: HOST_ORIGIN,
        expectedSourceWindow: mockChildWin,
        eventSourceWindow: mockOtherWin,
        currentGeneration: 1,
        currentRevision: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid-source-window');
    });

    it('Parent는 올바른 iframe.contentWindow라도 origin이 불일치하면 거부해야 한다', () => {
      const mockChildWin = createMockWindow(OTHER_ORIGIN);

      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 2,
        requestId: 'req-src-2',
        kind: 'preview:snapshot',
      });

      const result = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: OTHER_ORIGIN,
        expectedSourceWindow: mockChildWin,
        eventSourceWindow: mockChildWin,
        currentGeneration: 1,
        currentRevision: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid-origin');
    });

    it('Child는 source가 window.parent가 아니거나 origin이 부모 origin과 다르면 거부해야 한다', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockOtherWin = createMockWindow(HOST_ORIGIN);

      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 2,
        requestId: 'req-child-1',
        kind: 'preview:update',
      });

      // 1) 다른 source window
      const res1 = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: HOST_ORIGIN,
        expectedSourceWindow: mockParentWin,
        eventSourceWindow: mockOtherWin,
        currentGeneration: 1,
        currentRevision: 1,
      });
      expect(res1.valid).toBe(false);
      expect(res1.reason).toBe('invalid-source-window');

      // 2) 다른 origin
      const res2 = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: OTHER_ORIGIN,
        expectedSourceWindow: mockParentWin,
        eventSourceWindow: mockParentWin,
        currentGeneration: 1,
        currentRevision: 1,
      });
      expect(res2.valid).toBe(false);
      expect(res2.reason).toBe('invalid-origin');
    });

    it('targetOrigin에 와일드카드(*)를 지정하여 전송 시도시 에러를 발생시키고 전송을 차단해야 한다', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      const mockIframe = { contentWindow: mockChildWin } as any;

      expect(() => {
        new ParentBridge({
          window: mockParentWin as any,
          iframe: mockIframe,
          targetOrigin: '*',
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
        });
      }).toThrow(/wildcard/i);

      expect(() => {
        new ChildBridge({
          window: mockChildWin as any,
          parentOrigin: '*',
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 1,
          revision: 1,
        });
      }).toThrow(/wildcard/i);
    });
  });

  describe('3. 세대(Generation) 및 Revision 추적', () => {
    it('이전 세대(stale generation)의 지연 메시지는 즉시 거부되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1, // 이전 세대
        revision: 50,
        requestId: 'req-gen-1',
        kind: 'preview:snapshot',
      });

      const result = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: HOST_ORIGIN,
        expectedSourceWindow: mockChildWin,
        eventSourceWindow: mockChildWin,
        currentGeneration: 2, // 현재는 세대 2
        currentRevision: 10,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('stale-generation');
    });

    it('동일 세대라도 지연/과거 revision(stale revision) 메시지는 거부되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 2,
        revision: 4, // 과거 revision
        requestId: 'req-rev-1',
        kind: 'preview:geometry',
      });

      const result = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: HOST_ORIGIN,
        expectedSourceWindow: mockChildWin,
        eventSourceWindow: mockChildWin,
        currentGeneration: 2,
        currentRevision: 5, // 현재 이미 revision 5
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('stale-revision');
    });

    it('ParentBridge에서 advanceGeneration 호출 시 세대가 전진하고 이전 세대 메시지는 무시된다', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      const mockIframe = { contentWindow: mockChildWin } as any;

      const received: any[] = [];
      const bridge = new ParentBridge({
        window: mockParentWin as any,
        iframe: mockIframe,
        targetOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        onMessage: (msg) => received.push(msg),
      });

      expect(bridge.getGeneration()).toBe(1);

      // 세대 1 메시지 수신 성공
      mockParentWin.dispatch('message', {
        origin: HOST_ORIGIN,
        source: mockChildWin,
        data: createBridgeEnvelope({
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 1,
          revision: 1,
          requestId: 'req-1',
          kind: 'preview:ready',
        }),
      });
      expect(received.length).toBe(1);

      // 세대 2로 전진
      bridge.advanceGeneration(2);
      expect(bridge.getGeneration()).toBe(2);

      // 지연 도착한 세대 1 메시지 -> 거부
      mockParentWin.dispatch('message', {
        origin: HOST_ORIGIN,
        source: mockChildWin,
        data: createBridgeEnvelope({
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 1,
          revision: 2,
          requestId: 'req-old',
          kind: 'preview:snapshot',
        }),
      });
      expect(received.length).toBe(1); // 반영 안 됨

      // 세대 2 메시지 -> 반영 성공
      mockParentWin.dispatch('message', {
        origin: HOST_ORIGIN,
        source: mockChildWin,
        data: createBridgeEnvelope({
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 2,
          revision: 2,
          requestId: 'req-new',
          kind: 'preview:snapshot',
        }),
      });
      expect(received.length).toBe(2);
      expect(bridge.getRevision()).toBe(2);

      bridge.dispose();
    });
  });

  describe('4. 보안 및 페이로드 검증 (크기, 위험키, 허용/금지 명령어)', () => {
    it('1MB(MAX_BRIDGE_PAYLOAD_BYTES) 초과 페이로드는 max-bytes 사유로 거부되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      // 1MB를 초과하는 대용량 페이로드 생성
      const hugeString = 'a'.repeat(MAX_BRIDGE_PAYLOAD_BYTES + 10);
      const envelope = createBridgeEnvelope({
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 1,
        requestId: 'req-huge',
        kind: 'preview:snapshot',
        payload: { bigData: hugeString },
      });

      const result = validateBridgeEnvelope(envelope, {
        expectedOrigin: HOST_ORIGIN,
        eventOrigin: HOST_ORIGIN,
        expectedSourceWindow: mockChildWin,
        eventSourceWindow: mockChildWin,
        currentGeneration: 1,
        currentRevision: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('max-bytes');
    });

    it('__proto__, constructor, prototype 등 프로토타입 오염 위험 키 포함 시 dangerous-key 사유로 거부되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      for (const dangerousKey of DANGEROUS_KEYS) {
        const payload: Record<string, any> = {};
        payload[dangerousKey] = { polluted: true };

        const envelope = createBridgeEnvelope({
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 1,
          revision: 1,
          requestId: `req-danger-${dangerousKey}`,
          kind: 'preview:snapshot',
          payload,
        });

        const result = validateBridgeEnvelope(envelope, {
          expectedOrigin: HOST_ORIGIN,
          eventOrigin: HOST_ORIGIN,
          expectedSourceWindow: mockChildWin,
          eventSourceWindow: mockChildWin,
          currentGeneration: 1,
          currentRevision: 0,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('dangerous-key');
      }
    });

    it('게임 루프 부팅, 스크립트 실행, 외부 URL 로드 등 금지된 명령어는 forbidden-operation 사유로 거부되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      for (const forbiddenKind of FORBIDDEN_BRIDGE_KINDS) {
        const envelope = createBridgeEnvelope({
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 1,
          revision: 1,
          requestId: `req-forbid-${forbiddenKind}`,
          kind: forbiddenKind as any,
        });

        const result = validateBridgeEnvelope(envelope, {
          expectedOrigin: HOST_ORIGIN,
          eventOrigin: HOST_ORIGIN,
          expectedSourceWindow: mockChildWin,
          eventSourceWindow: mockChildWin,
          currentGeneration: 1,
          currentRevision: 0,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('forbidden-operation');
      }
    });

    it('허용된 안전 메시지(snapshot, selection, geometry, ready, error 등)는 정상 허용되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      for (const safeKind of SAFE_BRIDGE_KINDS) {
        const envelope = createBridgeEnvelope({
          docId: DOC_ID,
          pageId: PAGE_ID,
          sessionId: SESSION_ID,
          generation: 1,
          revision: 1,
          requestId: `req-safe-${safeKind}`,
          kind: safeKind,
          payload: { ok: true },
        });

        const result = validateBridgeEnvelope(envelope, {
          expectedOrigin: HOST_ORIGIN,
          eventOrigin: HOST_ORIGIN,
          expectedSourceWindow: mockChildWin,
          eventSourceWindow: mockChildWin,
          currentGeneration: 1,
          currentRevision: 0,
        });

        expect(result.valid).toBe(true);
        expect(result.envelope).toBeDefined();
      }
    });

    it('IFRAME_IS_SECURITY_SANDBOX는 false이어야 하고 디스클레이머 텍스트가 명시되어야 한다', () => {
      expect(IFRAME_IS_SECURITY_SANDBOX).toBe(false);
      expect(SANDBOX_DISCLAIMER_TEXT).toContain('IFRAME_IS_SECURITY_SANDBOX=false');
    });
  });

  describe('5. 생명주기 및 리스너 해제(dispose) 누수 방지', () => {
    it('ParentBridge dispose() 호출 시 window message 이벤트 리스너가 누수 없이 해제되어야 한다', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      const mockIframe = { contentWindow: mockChildWin } as any;

      const bridge = new ParentBridge({
        window: mockParentWin as any,
        iframe: mockIframe,
        targetOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
      });

      expect(mockParentWin.listenerCount).toBe(1);
      expect(bridge.isDisposed()).toBe(false);

      bridge.dispose();

      expect(mockParentWin.listenerCount).toBe(0);
      expect(bridge.isDisposed()).toBe(true);

      // dispose 후 메시지 전송 및 수신 시도 차단
      const sendSuccess = bridge.send('preview:update', { test: 1 });
      expect(sendSuccess).toBe(false);
    });

    it('ChildBridge dispose() 호출 시 window message 이벤트 리스너가 누수 없이 해제되어야 한다', () => {
      const mockChildWin = createMockWindow(HOST_ORIGIN);

      const bridge = new ChildBridge({
        window: mockChildWin as any,
        parentOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 1,
      });

      expect(mockChildWin.listenerCount).toBe(1);
      expect(bridge.isDisposed()).toBe(false);

      bridge.dispose();

      expect(mockChildWin.listenerCount).toBe(0);
      expect(bridge.isDisposed()).toBe(true);
    });
  });

  describe('6. UIPreviewHost 및 UIPreviewFrameView 연동 검증', () => {
    it('acceptPreviewMessage가 generation 및 revision 검증과 dangerous-key 검증을 지원해야 한다', () => {
      let host: PreviewHost = issueRequest({
        docId: DOC_ID,
        origin: HOST_ORIGIN,
      });
      // 확장 필드
      host = {
        ...host,
        generation: 2,
        latestRevision: 10,
      };

      // 1) 오래된 세대 거부
      const staleGenRes = acceptPreviewMessage(
        host,
        {
          origin: HOST_ORIGIN,
          kind: 'preview:result',
          requestId: 'req-1',
          generation: 1,
          revision: 20,
        } as any,
        [HOST_ORIGIN]
      );
      expect(staleGenRes.applied).toBe(false);
      expect(staleGenRes.reason).toBe('stale-generation');

      // 2) 오래된 revision 거부
      const staleRevRes = acceptPreviewMessage(
        host,
        {
          origin: HOST_ORIGIN,
          kind: 'preview:result',
          requestId: 'req-2',
          generation: 2,
          revision: 5,
        } as any,
        [HOST_ORIGIN]
      );
      expect(staleRevRes.applied).toBe(false);
      expect(staleRevRes.reason).toBe('stale-revision');

      // 3) 최신 revision 정상 적용
      const validRes = acceptPreviewMessage(
        host,
        {
          origin: HOST_ORIGIN,
          kind: 'preview:result',
          requestId: 'req-3',
          generation: 2,
          revision: 11,
          payload: { summary: 'ok' },
        } as any,
        [HOST_ORIGIN]
      );
      expect(validRes.applied).toBe(true);
    });

    it('mountPreviewFrame이 브리지를 탑재하고 dispose 시 클린업을 수행해야 한다', () => {
      // Mock DOM element
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
            contentWindow: createMockWindow(HOST_ORIGIN),
          };
          return el;
        },
      };

      const container: any = {
        ownerDocument: mockDoc,
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      const mockWin = createMockWindow(HOST_ORIGIN);
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockWin;

      try {
        const frameInstance = mountPreviewFrame(container as any, {
          docId: DOC_ID,
          origin: HOST_ORIGIN,
        });

        expect(frameInstance.root).toBeDefined();
        expect(frameInstance.iframe).toBeDefined();
        expect(typeof frameInstance.dispose).toBe('function');

        // frameInstance dispose 호출 시 에러 없이 리소스 정리
        frameInstance.dispose();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });
  });

  describe('7. Parent와 Child 간 양방향 통신 (snapshot, selection, geometry) 왕복 검증', () => {
    it('Parent -> Child: snapshot 메시지 전송 및 Child 수신', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      (mockChildWin as any).parent = mockParentWin;
      const mockIframe = { contentWindow: mockChildWin } as any;

      const parentBridge = new ParentBridge({
        window: mockParentWin as any,
        iframe: mockIframe,
        targetOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
      });

      const childReceived: any[] = [];
      const childBridge = new ChildBridge({
        window: mockChildWin as any,
        parentOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 0,
        onMessage: (msg) => childReceived.push(msg),
      });

      // Parent sends snapshot
      const sent = parentBridge.send('preview:snapshot', { elements: [{ id: 'el-1' }] });
      expect(sent).toBe(true);

      // Verify child window postMessage received
      expect(mockChildWin.postMessage).toHaveBeenCalledTimes(1);
      const [postedData, targetOrigin] = (mockChildWin.postMessage as any).mock.calls[0];
      expect(targetOrigin).toBe(HOST_ORIGIN);
      expect(postedData.kind).toBe('preview:snapshot');
      expect(postedData.revision).toBe(1);

      // Dispatch event to child window
      mockChildWin.dispatch('message', {
        origin: HOST_ORIGIN,
        source: mockParentWin,
        data: postedData,
      });

      expect(childReceived.length).toBe(1);
      expect(childReceived[0].kind).toBe('preview:snapshot');
      expect(childReceived[0].payload).toEqual({ elements: [{ id: 'el-1' }] });
      expect(childBridge.getRevision()).toBe(1);

      parentBridge.dispose();
      childBridge.dispose();
    });

    it('Child -> Parent: selection 및 geometry 응답 전송 및 Parent 수신', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      (mockChildWin as any).parent = mockParentWin;
      const mockIframe = { contentWindow: mockChildWin } as any;

      const parentReceived: any[] = [];
      const parentBridge = new ParentBridge({
        window: mockParentWin as any,
        iframe: mockIframe,
        targetOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        onMessage: (msg) => parentReceived.push(msg),
      });

      const childBridge = new ChildBridge({
        window: mockChildWin as any,
        parentOrigin: HOST_ORIGIN,
        docId: DOC_ID,
        pageId: PAGE_ID,
        sessionId: SESSION_ID,
        generation: 1,
        revision: 1,
      });

      // Child sends selection
      const sentSel = childBridge.send('preview:selection', { selectedId: 'el-btn-start' });
      expect(sentSel).toBe(true);
      expect(mockParentWin.postMessage).toHaveBeenCalledTimes(1);
      const [postedSel] = (mockParentWin.postMessage as any).mock.calls[0];

      mockParentWin.dispatch('message', {
        origin: HOST_ORIGIN,
        source: mockChildWin,
        data: postedSel,
      });
      expect(parentReceived.length).toBe(1);
      expect(parentReceived[0].kind).toBe('preview:selection');
      expect(parentReceived[0].payload).toEqual({ selectedId: 'el-btn-start' });

      // Child sends geometry
      const sentGeo = childBridge.send('preview:geometry', { bounds: { x: 10, y: 20, width: 100, height: 40 } });
      expect(sentGeo).toBe(true);
      const [postedGeo] = (mockParentWin.postMessage as any).mock.calls[1];

      mockParentWin.dispatch('message', {
        origin: HOST_ORIGIN,
        source: mockChildWin,
        data: postedGeo,
      });
      expect(parentReceived.length).toBe(2);
      expect(parentReceived[1].kind).toBe('preview:geometry');

      parentBridge.dispose();
      childBridge.dispose();
    });
  });

  describe('8. updateDocument 및 remount 시 generation 및 docId 갱신', () => {
    it('ParentBridge updateDocument 시 docId 및 pageId가 갱신되고 다음 메시지에 반영된다', () => {
      const mockParentWin = createMockWindow(HOST_ORIGIN);
      const mockChildWin = createMockWindow(HOST_ORIGIN);
      const mockIframe = { contentWindow: mockChildWin } as any;

      const bridge = new ParentBridge({
        window: mockParentWin as any,
        iframe: mockIframe,
        targetOrigin: HOST_ORIGIN,
        docId: 'doc-old',
        pageId: 'page-old',
        sessionId: SESSION_ID,
      });

      bridge.updateDocument('doc-new', 'page-new');
      bridge.send('preview:ready');

      const [posted] = (mockChildWin.postMessage as any).mock.calls[0];
      expect(posted.docId).toBe('doc-new');
      expect(posted.pageId).toBe('page-new');

      bridge.dispose();
    });
  });
});
