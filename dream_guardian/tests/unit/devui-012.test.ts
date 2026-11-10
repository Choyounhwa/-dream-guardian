/**
 * [DEVUI-012] (Issue #584) 레이아웃 패널 설정 항목 마우스 오버 시 캔버스 내 해당 UI 요소 영역 하이라이트 표시
 *
 * 1. LayoutRegistry.findElementByPath 경로 매칭 검증 (정확한 경로, 하위 속성 경로, 배열 인덱스 경로, 판정 연동 경로)
 * 2. DevInspectorOverlay의 setHighlightedPath / getHighlightedPath 및 하이라이트 캔버스 렌더링 검증
 * 3. DevLayoutPanel 바인딩 및 폴더 요소 mouseenter / mouseleave 이벤트 연동 검증
 * 4. 활성 오버레이 싱글턴 관리 및 dispose 시 정리 검증
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride';
import {
  findElementByPath,
  getInspectableElements,
} from '../../src/dev/LayoutRegistry';
import {
  DevInspectorOverlay,
  getActiveInspectorOverlay,
} from '../../src/dev/DevInspectorOverlay';
import {
  mountDevLayoutPanel,
} from '../../src/dev/DevLayoutPanel';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
});

function makeMockDoc() {
  const elements: any[] = [];
  const docListeners: Record<string, Function[]> = {};

  function makeElement(tagName: string) {
    const listeners: Record<string, Function[]> = {};
    const attrs = new Map<string, string>();
    const el: any = {
      tagName: tagName.toUpperCase(),
      id: '',
      className: '',
      textContent: '',
      style: {},
      children: [] as any[],
      parentNode: null as any,
      dataset: {} as Record<string, string>,
      setAttribute(k: string, v: string) {
        attrs.set(k, String(v));
      },
      getAttribute(k: string) {
        return attrs.get(k) ?? null;
      },
      appendChild(child: any) {
        child.parentNode = el;
        el.children.push(child);
        elements.push(child);
        return child;
      },
      removeChild(child: any) {
        el.children = el.children.filter((c: any) => c !== child);
        if (child.parentNode === el) child.parentNode = null;
        return child;
      },
      remove() {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
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
        const ev = typeof event === 'string' ? { type: event } : event;
        for (const fn of listeners[ev.type] || []) fn(ev);
        return true;
      },
      querySelector(selector: string) {
        if (selector === '.tp-fldv_t' || selector === 'button') {
          return el.children.find((c: any) => c.tagName === 'BUTTON' || c.className?.includes('tp-fldv_t')) ?? null;
        }
        return null;
      },
    };
    elements.push(el);
    return el;
  }

  const doc: any = {
    body: makeElement('body'),
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const c = makeElement('canvas');
        c.width = 1080;
        c.height = 2160;
        const sharedCtx = {
          clearRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          strokeRect: vi.fn(),
          fillRect: vi.fn(),
          fillText: vi.fn(),
          measureText: () => ({ width: 100 }),
          setLineDash: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
        };
        c.getContext = () => sharedCtx;
        c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 540, height: 1080 });
        return c;
      }
      return makeElement(tag);
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
  };
  return { doc, makeElement, elements };
}

describe('DEVUI-012 LayoutRegistry.findElementByPath', () => {
  const elements = getInspectableElements('MENU_MAIN');

  it('정확한 path가 일치하는 요소를 반환한다', () => {
    const el = findElementByPath(elements, 'menu.title');
    expect(el).toBeDefined();
    expect(el?.path).toBe('menu.title');
    expect(el?.label).toBe('메인 타이틀');
  });

  it('하위 속성 path (x, y, w, h, textScale)로 상위 UI 요소를 탐색한다', () => {
    const elX = findElementByPath(elements, 'menu.title.x');
    const elScale = findElementByPath(elements, 'menu.title.textScale');
    expect(elX).toBeDefined();
    expect(elX?.path).toBe('menu.title');
    expect(elScale?.path).toBe('menu.title');
  });

  it('배열 인덱스 요소의 속성 path로 해당 요소를 탐색한다', () => {
    const el = findElementByPath(elements, 'menu.chapterCards.0.x');
    expect(el).toBeDefined();
    expect(el?.path).toBe('menu.chapterCards.0');
    expect(el?.label).toBe('챕터 1 카드');
  });

  it('판정 연동 좌표 (zone) 축약 경로를 올바르게 매칭한다', () => {
    const playElements = getInspectableElements('RUN_QUESTION');
    const el = findElementByPath(playElements, 'zone1.x');
    expect(el).toBeDefined();
    expect(el?.path).toBe('zone.zone_1');
    expect(el?.isProtected).toBe(true);
  });

  it('존재하지 않는 path는 null을 반환한다', () => {
    const el = findElementByPath(elements, 'nonexistent.widget.foo');
    expect(el).toBeNull();
  });
});

describe('DEVUI-012 DevInspectorOverlay 외부 하이라이트 API', () => {
  it('setHighlightedPath 호출 시 highlightedPath와 해당 element가 설정된다', () => {
    const { doc } = makeMockDoc();
    const overlay = new DevInspectorOverlay({
      doc,
      app: { stateMachine: { currentState: 'MENU_MAIN' } },
    });

    expect(overlay.getHighlightedPath()).toBeNull();
    overlay.setHighlightedPath('menu.title.x');
    expect(overlay.getHighlightedPath()).toBe('menu.title.x');

    const ctx = (overlay.canvas as any).getContext('2d');
    overlay.render();
    expect(ctx.strokeRect).toHaveBeenCalled();

    overlay.setHighlightedPath(null);
    expect(overlay.getHighlightedPath()).toBeNull();
    overlay.dispose();
  });

  it('getActiveInspectorOverlay 싱글턴 추적 및 dispose 시 해제된다', () => {
    const { doc } = makeMockDoc();
    const overlay = new DevInspectorOverlay({
      doc,
      app: { stateMachine: { currentState: 'MENU_MAIN' } },
    });

    expect(getActiveInspectorOverlay()).toBe(overlay);
    overlay.dispose();
    expect(getActiveInspectorOverlay()).toBeNull();
  });
});

describe('DEVUI-012 DevLayoutPanel 호버 이벤트 연동', () => {
  function makeMockPane(makeElement: any) {
    function makeNode(kind: string, extra: any = {}): any {
      const node: any = {
        kind,
        children: [] as any[],
        handlers: {},
        element: makeElement('div'),
        ...extra,
      };
      node.addFolder = (p: any) => {
        const f = makeNode('folder', { title: p.title });
        node.children.push(f);
        return f;
      };
      node.addBinding = (obj: any, key: string, params: any) => {
        const bindingEl = makeElement('div');
        bindingEl.className = 'tp-lblv';
        const b = makeNode('binding', { key, params, element: bindingEl, obj });
        b.on = (ev: string, fn: Function) => {
          b.handlers[ev] = fn;
          return b;
        };
        node.children.push(b);
        return b;
      };
      node.addButton = (p: any) => {
        const b = makeNode('button', { title: p.title });
        b.on = (ev: string, fn: Function) => {
          b.handlers[ev] = fn;
          return b;
        };
        node.children.push(b);
        return b;
      };
      node.refresh = () => {};
      node.dispose = () => {};
      return node;
    }
    return makeNode('pane');
  }

  it('바인딩 행 mouseenter/mouseleave 시 onHoverPath가 호출된다', async () => {
    const { doc, makeElement } = makeMockDoc();
    const hoveredPaths: (string | null)[] = [];
    let rootPane: any = null;

    const handle = await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc,
      {
        createPane: async () => {
          rootPane = makeMockPane(makeElement);
          return rootPane;
        },
        onHoverPath: (p) => hoveredPaths.push(p),
      },
    );

    expect(handle).not.toBeNull();

    function findFirstBinding(node: any): any {
      if (node.kind === 'binding') return node;
      for (const child of node.children || []) {
        const found = findFirstBinding(child);
        if (found) return found;
      }
      return null;
    }

    const firstBinding = findFirstBinding(rootPane);
    expect(firstBinding).not.toBeNull();

    firstBinding.element.dispatchEvent({ type: 'mouseenter' });
    expect(hoveredPaths.length).toBeGreaterThan(0);
    expect(hoveredPaths[hoveredPaths.length - 1]).not.toBeNull();

    firstBinding.element.dispatchEvent({ type: 'mouseleave' });
    expect(hoveredPaths[hoveredPaths.length - 1]).toBeNull();

    handle?.dispose();
  });
});
