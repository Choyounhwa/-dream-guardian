/**
 * [BUG-DEVUI-002] (Issue #586) 설정(settings) 등 패널 대메뉴 마우스 오버 시 하이라이트 미표시 버그 수정 단위 테스트
 *
 * 1. LayoutRegistry에서 settings 모달, 닫기 버튼, 각 설정 버튼 및 locomotion 모달 요소 탐색 검증
 * 2. 현재 화면 상태(예: MENU_MAIN)와 무관하게 UI_LAYOUT에 정의된 슬롯에 대한 fallback 탐색 검증
 * 3. DevLayoutPanel 최상위 섹션 폴더(settings, menu 등)의 mouseenter / mouseleave 이벤트 연동 검증
 * 4. DevInspectorOverlay에서 대메뉴 및 하위 항목 호버 시 캔버스 하이라이트 렌더링 검증
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

describe('BUG-DEVUI-002 설정(settings) 모달 요소 매칭 및 Fallback', () => {
  it('settings 및 settings.modal 경로로 설정 모달 요소를 탐색할 수 있다', () => {
    const elements = getInspectableElements('MENU_MAIN');
    const el = findElementByPath(elements, 'settings');
    expect(el).not.toBeNull();
    expect(el?.path.startsWith('settings')).toBe(true);
  });

  it('settings 하위 버튼 경로(settings.buttons.camera.x)로 카메라 버튼 요소를 탐색할 수 있다', () => {
    const elements = getInspectableElements('MENU_MAIN');
    const el = findElementByPath(elements, 'settings.buttons.camera.x');
    expect(el).not.toBeNull();
    expect(el?.path).toBe('settings.buttons.camera');
    expect(el?.label).toContain('카메라');
  });

  it('settings.closeBtn 경로로 설정 닫기 버튼 요소를 탐색할 수 있다', () => {
    const elements = getInspectableElements('MENU_MAIN');
    const el = findElementByPath(elements, 'settings.closeBtn');
    expect(el).not.toBeNull();
    expect(el?.path).toBe('settings.closeBtn');
  });

  it('locomotion 경로로 이동 모드 모달 요소를 탐색할 수 있다', () => {
    const elements = getInspectableElements('MENU_MAIN');
    const el = findElementByPath(elements, 'locomotion');
    expect(el).not.toBeNull();
    expect(el?.path.startsWith('locomotion')).toBe(true);
  });
});

describe('BUG-DEVUI-002 최상위 섹션 폴더 헤더 호버 연동', () => {
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
        const folderEl = makeElement('div');
        const titleBtn = makeElement('button');
        titleBtn.className = 'tp-fldv_t';
        folderEl.appendChild(titleBtn);
        const f = makeNode('folder', { title: p.title, element: folderEl });
        node.children.push(f);
        return f;
      };
      node.addBinding = (obj: any, key: string, params: any) => {
        const bindingEl = makeElement('div');
        bindingEl.className = 'tp-lblv';
        const b = makeNode('binding', { key, params, element: bindingEl, obj });
        b.on = vi.fn();
        node.children.push(b);
        return b;
      };
      node.addButton = (p: any) => {
        const b = makeNode('button', { title: p.title });
        node.children.push(b);
        return b;
      };
      node.refresh = () => {};
      node.dispose = () => {};
      return node;
    }
    return makeNode('pane');
  }

  it('최상위 섹션 폴더(settings 등) 헤더에 마우스 오버 시 onHoverPath가 섹션명으로 호출된다', async () => {
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

    // rootPane 직속 자식 중 settings 폴더 찾기
    const settingsFolder = rootPane.children.find((c: any) => c.kind === 'folder' && c.title === 'settings');
    expect(settingsFolder).toBeDefined();

    const titleBtn = settingsFolder.element.querySelector('.tp-fldv_t');
    expect(titleBtn).not.toBeNull();

    titleBtn.dispatchEvent({ type: 'mouseenter' });
    expect(hoveredPaths[hoveredPaths.length - 1]).toBe('settings');

    titleBtn.dispatchEvent({ type: 'mouseleave' });
    expect(hoveredPaths[hoveredPaths.length - 1]).toBeNull();

    handle?.dispose();
  });
});

describe('BUG-DEVUI-002 DevInspectorOverlay 대메뉴 하이라이트 렌더링', () => {
  it('MENU_MAIN 상태에서도 settings 대메뉴 호버 시 캔버스에 점선 박스가 렌더링된다', () => {
    const { doc } = makeMockDoc();
    const overlay = new DevInspectorOverlay({
      doc,
      app: { stateMachine: { currentState: 'MENU_MAIN' } },
    });

    overlay.setHighlightedPath('settings');
    expect(overlay.getHighlightedElement()).not.toBeNull();

    const ctx = (overlay.canvas as any).getContext('2d');
    expect(ctx.strokeRect).toHaveBeenCalled();

    overlay.dispose();
  });
});
