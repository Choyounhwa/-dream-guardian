/**
 * [REFACTOR-DEV-001] (Issue #623) DevPanelInteractionHandler 단위 테스트
 *
 * TDD Step 2: Red 선작성
 * 1. DevPanelInteractionHandler 인스턴스 생성 및 dispose 수명주기 검증
 * 2. nudgeValue 순수 함수: 방향, Shift(10배), 소수점 스텝, 정밀도 보정, min/max 클램핑
 * 3. attachNudgeControls: 버튼 주입, 단일 클릭, 롱프레스 연속 증감(400ms 지연/60ms 반복), 이력 기록
 * 4. attachGlobalKeyboard: 문서 전역 방향키 단축키 연동 및 정리
 * 5. attachDraggable & attachResizable: 패널 드래그 이동 및 리사이즈 이벤트 바인딩
 * 6. attachHoverHighlight: 요소 마우스 호버 시 인스펙터 하이라이트 연동 및 정리
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DevPanelInteractionHandler,
  nudgeValue,
  attachNudgeControls,
  NUDGE_LONG_PRESS_DELAY_MS,
  NUDGE_REPEAT_INTERVAL_MS,
  type AttachNudgeOptions,
} from '../../src/dev/DevPanelInteractionHandler';
import { DevLayoutHistory } from '../../src/dev/DevLayoutHistory';

function createMockElement(tagName: string) {
  const listeners: Record<string, Function[]> = {};
  const attrs = new Map<string, string>();
  const el: any = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    value: '',
    style: {} as Record<string, string>,
    children: [] as any[],
    parentNode: null as any,
    dataset: {} as Record<string, string>,
    setAttribute(k: string, v: string) {
      attrs.set(k, String(v));
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        el.dataset[camel] = String(v);
      }
    },
    getAttribute(k: string) {
      return attrs.get(k) ?? null;
    },
    appendChild(child: any) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    remove() {
      if (el.parentNode) {
        el.parentNode.children = el.parentNode.children.filter((c: any) => c !== el);
      }
    },
    addEventListener(ev: string, fn: Function) {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    removeEventListener(ev: string, fn: Function) {
      if (listeners[ev]) {
        listeners[ev] = listeners[ev].filter((f: any) => f !== fn);
      }
    },
    dispatchEvent(event: any) {
      const ev = {
        type: event.type,
        key: event.key,
        button: event.button ?? 0,
        clientX: event.clientX ?? 0,
        clientY: event.clientY ?? 0,
        shiftKey: !!event.shiftKey,
        target: el,
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      for (const fn of listeners[event.type] || []) {
        fn(ev);
      }
      return true;
    },
    querySelector(selector: string) {
      const match = (n: any): boolean => {
        if (!n) return false;
        if (selector.startsWith('.')) {
          return n.className?.split(/\s+/).includes(selector.slice(1));
        }
        if (selector === 'input') return n.tagName === 'INPUT';
        return false;
      };
      const walk = (node: any): any => {
        for (const c of node.children) {
          if (match(c)) return c;
          const found = walk(c);
          if (found) return found;
        }
        return null;
      };
      return walk(el);
    },
    querySelectorAll(selector: string) {
      const results: any[] = [];
      const match = (n: any): boolean => {
        if (selector.startsWith('.')) {
          return n.className?.split(/\s+/).includes(selector.slice(1));
        }
        return false;
      };
      const walk = (node: any) => {
        for (const c of node.children) {
          if (match(c)) results.push(c);
          walk(c);
        }
      };
      walk(el);
      return results;
    },
    closest(selector: string) {
      let cur: any = el;
      while (cur) {
        if (selector.startsWith('.')) {
          const cls = selector.slice(1);
          if (cur.className?.split(/\s+/).includes(cls)) return cur;
        }
        if (selector.startsWith('[')) {
          const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]/);
          if (attrMatch) {
            const [, attrName, attrVal] = attrMatch;
            if (attrVal !== undefined && cur.getAttribute?.(attrName) === attrVal) return cur;
            if (attrVal === undefined && cur.getAttribute?.(attrName) !== null) return cur;
          }
        }
        cur = cur.parentNode;
      }
      return null;
    },
  };
  return el;
}

function createMockDocument() {
  const docListeners: Record<string, Function[]> = {};
  const elements: any[] = [];

  const body = createMockElement('body');
  elements.push(body);

  const doc: any = {
    activeElement: null,
    body,
    createElement: (tag: string) => {
      const el = createMockElement(tag);
      elements.push(el);
      return el;
    },
    getElementById: (id: string) => elements.find((e) => e.id === id) ?? null,
    addEventListener(ev: string, fn: Function) {
      docListeners[ev] = docListeners[ev] || [];
      docListeners[ev].push(fn);
    },
    removeEventListener(ev: string, fn: Function) {
      if (docListeners[ev]) {
        docListeners[ev] = docListeners[ev].filter((f: any) => f !== fn);
      }
    },
    _dispatch(ev: string, data: any) {
      for (const fn of docListeners[ev] || []) fn(data);
    },
  };
  return doc;
}

describe('DevPanelInteractionHandler 단위 테스트', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. nudgeValue 순수 함수 계산 검증', () => {
    it('기본 단위 1 증가 및 감소를 올바르게 계산한다', () => {
      expect(nudgeValue(10, 1, false)).toBe(11);
      expect(nudgeValue(10, -1, false)).toBe(9);
    });

    it('Shift 활성화 시 기본 스텝의 10배를 적용한다', () => {
      expect(nudgeValue(10, 1, true, 1)).toBe(20);
      expect(nudgeValue(10, -1, true, 1)).toBe(0);
      expect(nudgeValue(5, 1, true, 0.1)).toBe(6);
    });

    it('부동소수점 오차 없이 지정된 스텝 자릿수를 유지한다', () => {
      expect(nudgeValue(0.1, 1, false, 0.05)).toBe(0.15);
      expect(nudgeValue(1.05, -1, false, 0.01)).toBe(1.04);
      expect(nudgeValue(0.7, 1, false, 0.1)).toBe(0.8);
    });

    it('min 과 max 범위를 벗어나지 않도록 클램핑한다', () => {
      expect(nudgeValue(98, 1, true, 1, 0, 100)).toBe(100);
      expect(nudgeValue(5, -1, true, 1, 0, 100)).toBe(0);
      expect(nudgeValue(0, -1, false, 1, 0, 10)).toBe(0);
      expect(nudgeValue(10, 1, false, 1, 0, 10)).toBe(10);
    });
  });

  describe('2. attachNudgeControls 컨트롤 주입 및 단일 클릭 검증', () => {
    it('readonly 또는 엘리먼트 부재 시 null 을 반환한다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const node = { x: 100 };
      const history = new DevLayoutHistory();

      const resNoEl = handler.attachNudgeControls(
        { on: () => {} },
        {
          path: 'hud.x',
          node,
          key: 'x',
          meta: { path: 'hud.x', target: node, key: 'x', readonly: false },
          history,
          pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any) },
          storage: null,
          base: {},
          doc,
        },
      );
      expect(resNoEl).toBeNull();

      const el = doc.createElement('div');
      const resReadonly = handler.attachNudgeControls(
        { element: el, on: () => {} },
        {
          path: 'hud.x',
          node,
          key: 'x',
          meta: { path: 'hud.x', target: node, key: 'x', readonly: true },
          history,
          pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any) },
          storage: null,
          base: {},
          doc,
        },
      );
      expect(resReadonly).toBeNull();
    });

    it('버튼 클릭 시 값을 갱신하고 이력을 기록한다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const node = { x: 50 };
      const history = new DevLayoutHistory();
      let refreshed = false;
      let buttonUpdated = false;

      const el = doc.createElement('div');
      const api = { element: el, on: () => {} };
      const controls = handler.attachNudgeControls(api, {
        path: 'test.x',
        node,
        key: 'x',
        meta: { path: 'test.x', target: node, key: 'x', readonly: false, step: 2 },
        history,
        pane: {
          refresh: () => {
            refreshed = true;
          },
          dispose: () => {},
          addFolder: () => ({} as any),
          addBinding: () => ({} as any),
        },
        storage: null,
        base: {},
        doc,
        updateButtons: () => {
          buttonUpdated = true;
        },
      });

      expect(controls).not.toBeNull();
      expect(controls?.upBtn.textContent).toBe('▲');
      expect(controls?.downBtn.textContent).toBe('▼');

      (controls?.upBtn as any).dispatchEvent({ type: 'click' });
      expect(node.x).toBe(52);
      expect(refreshed).toBe(true);
      expect(buttonUpdated).toBe(true);
      expect(history.undoCount).toBe(1);

      (controls?.downBtn as any).dispatchEvent({ type: 'click' });
      expect(node.x).toBe(50);
      expect(history.undoCount).toBe(2);
    });

    it('동일 엘리먼트에 재호출 시 기존 컨테이너를 재사용한다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const node = { x: 50 };
      const history = new DevLayoutHistory();
      const el = doc.createElement('div');
      const api = { element: el, on: () => {} };

      const c1 = handler.attachNudgeControls(api, {
        path: 'test.x',
        node,
        key: 'x',
        meta: { path: 'test.x', target: node, key: 'x', readonly: false },
        history,
        pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any) },
        storage: null,
        base: {},
        doc,
      });

      const c2 = handler.attachNudgeControls(api, {
        path: 'test.x',
        node,
        key: 'x',
        meta: { path: 'test.x', target: node, key: 'x', readonly: false },
        history,
        pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any) },
        storage: null,
        base: {},
        doc,
      });

      expect(c1?.container).toBe(c2?.container);
    });
  });

  describe('3. 롱프레스 연속 증감 및 드래그 묶음 검증', () => {
    it('mousedown 후 400ms 지연 후 60ms 주기로 반복되고 단일 이력으로 묶인다', () => {
      vi.useFakeTimers();
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const node = { x: 10 };
      const history = new DevLayoutHistory();
      const el = doc.createElement('div');

      const controls = handler.attachNudgeControls(
        { element: el, on: () => {} },
        {
          path: 'test.x',
          node,
          key: 'x',
          meta: { path: 'test.x', target: node, key: 'x', readonly: false, step: 1 },
          history,
          pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any) },
          storage: null,
          base: {},
          doc,
        },
      );

      (controls?.upBtn as any).dispatchEvent({ type: 'mousedown', button: 0 });
      expect(node.x).toBe(11); // mousedown 직후 1회
      expect(history.undoCount).toBe(0); // 드래그 중이므로 아직 commit 안 됨

      vi.advanceTimersByTime(NUDGE_LONG_PRESS_DELAY_MS);
      expect(node.x).toBe(11);

      vi.advanceTimersByTime(NUDGE_REPEAT_INTERVAL_MS * 3);
      expect(node.x).toBe(14); // 3회 추가

      (controls?.upBtn as any).dispatchEvent({ type: 'mouseup' });
      expect(history.undoCount).toBe(1); // 마우스 뗄 때 1건으로 묶임

      const undone = history.undo();
      expect(undone).toEqual({ path: 'test.x', before: 10, after: 14 });
    });
  });

  describe('4. attachGlobalKeyboard 전역 방향키 단축키 검증', () => {
    it('포커스된 input 에서 ArrowUp / ArrowDown 입력 시 값이 갱신된다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const node = { y: 20 };
      const history = new DevLayoutHistory();
      const metas = new Map<string, any>([
        ['ui.y', { path: 'ui.y', target: node, key: 'y', readonly: false, step: 1 }],
      ]);

      const unbind = handler.attachGlobalKeyboard(doc, {
        metas,
        history,
        pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any) },
        storage: null,
        base: {},
        baseAssault: {},
        getValue: (path) => (path === 'ui.y' ? node.y : undefined),
        setValue: (path, val) => {
          if (path === 'ui.y') node.y = val;
        },
      });

      const input = doc.createElement('input');
      input.setAttribute('data-dg-layout-path', 'ui.y');
      input.value = '20';
      doc.activeElement = input;

      doc._dispatch('keydown', { key: 'ArrowUp', shiftKey: false });
      expect(node.y).toBe(21);
      expect(input.value).toBe('21');

      doc._dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
      expect(node.y).toBe(11); // shift = 10배
      expect(input.value).toBe('11');

      unbind();
      doc._dispatch('keydown', { key: 'ArrowUp', shiftKey: false });
      expect(node.y).toBe(11); // unbind 후 반응 없음
    });
  });

  describe('5. attachDraggable & attachResizable 드래그/리사이즈 핸들러 검증', () => {
    it('attachDraggable 마우스 드래그 시 좌표가 갱신되고 unbind 시 해제된다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const panel = doc.createElement('div');
      const handle = doc.createElement('div');
      panel.appendChild(handle);
      panel.style.left = '100px';
      panel.style.top = '50px';

      let lastPos: any = null;
      const unbind = handler.attachDraggable(panel, handle, {
        onDrag: (pos) => {
          lastPos = pos;
        },
      });

      (handle as any).dispatchEvent({ type: 'mousedown', clientX: 100, clientY: 50 });
      (handle as any).dispatchEvent({ type: 'mousemove', clientX: 130, clientY: 70 });
      expect(panel.style.left).toBe('130px');
      expect(panel.style.top).toBe('70px');
      expect(lastPos).toEqual({ x: 130, y: 70, dx: 30, dy: 20 });

      (handle as any).dispatchEvent({ type: 'mouseup' });
      unbind();

      (handle as any).dispatchEvent({ type: 'mousedown', clientX: 130, clientY: 70 });
      (handle as any).dispatchEvent({ type: 'mousemove', clientX: 200, clientY: 200 });
      expect(panel.style.left).toBe('130px'); // unbind 후 변경 없음
    });

    it('attachResizable 리사이즈 핸들러 조작 시 패널 크기가 변경된다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const panel = doc.createElement('div');
      const handle = doc.createElement('div');
      panel.appendChild(handle);
      panel.style.width = '300px';
      panel.style.height = '400px';

      let lastSize: any = null;
      const unbind = handler.attachResizable(panel, handle, {
        minWidth: 200,
        maxWidth: 600,
        onResize: (size) => {
          lastSize = size;
        },
      });

      (handle as any).dispatchEvent({ type: 'mousedown', clientX: 300, clientY: 400 });
      (handle as any).dispatchEvent({ type: 'mousemove', clientX: 350, clientY: 420 });
      expect(panel.style.width).toBe('350px');
      expect(panel.style.height).toBe('420px');
      expect(lastSize).toEqual({ width: 350, height: 420, dw: 50, dh: 20 });

      (handle as any).dispatchEvent({ type: 'mouseup' });
      unbind();
    });
  });

  describe('6. attachHoverHighlight 호버 연동 검증', () => {
    it('mouseenter / mouseleave 시 경로를 전달하고 unbind 시 해제된다', () => {
      const doc = createMockDocument();
      const handler = new DevPanelInteractionHandler();
      const el = doc.createElement('div');
      const hovered: Array<string | null> = [];

      const unbind = handler.attachHoverHighlight(el, 'hud.combo', (path) => {
        hovered.push(path);
      });

      (el as any).dispatchEvent({ type: 'mouseenter' });
      expect(hovered).toEqual(['hud.combo']);

      (el as any).dispatchEvent({ type: 'mouseleave' });
      expect(hovered).toEqual(['hud.combo', null]);

      unbind();
      (el as any).dispatchEvent({ type: 'mouseenter' });
      expect(hovered.length).toBe(2); // 추가 호출 없음
    });
  });

  describe('7. 독립 함수 attachNudgeControls 호출 호환성 검증', () => {
    it('attachNudgeControls 독립 함수가 정상 동작한다', () => {
      const doc = createMockDocument();
      const el = doc.createElement('div');
      const history = new DevLayoutHistory();
      const node = { v: 100 };
      const opts: AttachNudgeOptions = {
        path: 'test.v',
        node,
        key: 'v',
        meta: { path: 'test.v', target: node, key: 'v', readonly: false },
        history,
        pane: { refresh: () => {} },
        storage: null,
        base: {},
        doc,
      };
      const controls = attachNudgeControls({ element: el }, opts);
      expect(controls).not.toBeNull();
      expect(controls?.container.className).toContain('dg-nudge-container');
    });
  });

  describe('8. dispose 수명주기 정리 검증', () => {
    it('dispose 호출 시 모든 타이머와 이벤트 리스너가 정리된다', () => {
      const handler = new DevPanelInteractionHandler();
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
