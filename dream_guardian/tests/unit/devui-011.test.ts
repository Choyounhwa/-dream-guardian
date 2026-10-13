/**
 * [DEVUI-011] (Issue #580) 레이아웃 패널 미세 조정 화살표 버튼 및 키보드 조작
 *
 * TDD Step 2: Red 선작성
 * - nudgeValue 순수 함수 (dir 1/-1, shift, step, min/max clamp, 부동소수점 오차 방지)
 * - 편집 가능한 숫자 바인딩에 ▲ / ▼ 버튼 주입 및 읽기 전용 행 화살표 미생성 검증
 * - 화살표 버튼 클릭 (1회 ±1, Shift ±10) 및 Undo 이력 1건 기록 검증
 * - 화살표 버튼 길게 누르기(mousedown: 400ms 후 60ms 간격 반복) 및 단일 Undo 묶음 검증
 * - 숫자 입력칸 포커스 시 키보드 ArrowUp / ArrowDown (+1 / Shift +10) 연동 검증
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride';
import { DevLayoutHistory } from '../../src/dev/DevLayoutHistory';
import {
  nudgeValue,
  attachNudgeControls,
  mountDevLayoutPanel,
  NUDGE_LONG_PRESS_DELAY_MS,
  NUDGE_REPEAT_INTERVAL_MS,
} from '../../src/dev/DevLayoutPanel';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
  vi.useRealTimers();
});

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
}

function createFakeDOM() {
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
      value: '',
      style: {},
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
        elements.push(child);
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
        let prevented = false;
        let propagationStopped = false;
        const ev = {
          type: event.type,
          key: event.key,
          button: event.button ?? 0,
          shiftKey: !!event.shiftKey,
          ctrlKey: !!event.ctrlKey,
          metaKey: !!event.metaKey,
          target: el,
          preventDefault: () => {
            prevented = true;
            event.preventDefault?.();
          },
          stopPropagation: () => {
            propagationStopped = true;
            event.stopPropagation?.();
          },
          defaultPrevented: false,
        };
        for (const fn of listeners[event.type] || []) {
          fn(ev);
        }
        ev.defaultPrevented = prevented;
        if (!propagationStopped && el.parentNode) {
          el.parentNode.dispatchEvent(event);
        }
        return !prevented;
      },
      click() {
        el.dispatchEvent({ type: 'click' });
      },
      querySelector(selector: string) {
        return el.querySelectorAll(selector)[0] ?? null;
      },
      querySelectorAll(selector: string) {
        const results: any[] = [];
        const match = (item: any): boolean => {
          if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return item.className?.split(/\s+/).includes(cls);
          }
          if (selector.startsWith('#')) {
            return item.id === selector.slice(1);
          }
          if (selector === 'input') {
            return item.tagName === 'INPUT';
          }
          if (selector === 'button') {
            return item.tagName === 'BUTTON';
          }
          if (selector.startsWith('[')) {
            const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]/);
            if (attrMatch) {
              const [, attrName, attrVal] = attrMatch;
              if (attrVal !== undefined) {
                return item.getAttribute?.(attrName) === attrVal;
              }
              return item.getAttribute?.(attrName) !== null;
            }
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
    elements.push(el);
    return el;
  }

  const doc: any = {
    activeElement: null,
    body: makeElement('body'),
    createElement: (tag: string) => makeElement(tag),
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
  return { doc, makeElement, elements };
}

describe('DEVUI-011 상수 및 attachNudgeControls 직접 호출 검증', () => {
  it('롱프레스 지연 및 반복 간격 상수가 올바르게 정의되어 있다', () => {
    expect(NUDGE_LONG_PRESS_DELAY_MS).toBe(400);
    expect(NUDGE_REPEAT_INTERVAL_MS).toBe(60);
  });

  it('attachNudgeControls 는 읽기 전용이거나 element 가 없으면 null 을 반환한다', () => {
    const { doc } = createFakeDOM();
    const history = new DevLayoutHistory();
    const node = { val: 10 };
    const meta = { path: 'test.val', target: node, key: 'val', readonly: true, min: 0, max: 20 };

    // element 가 없는 경우
    const resNoEl = attachNudgeControls({ on: () => {} }, {
      path: 'test.val',
      node,
      key: 'val',
      meta,
      history,
      pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any), addButton: () => ({} as any) },
      storage: null,
      base: {},
      doc,
    });
    expect(resNoEl).toBeNull();

    // readonly 인 경우
    const el = doc.createElement('div');
    const resReadonly = attachNudgeControls({ element: el, on: () => {} }, {
      path: 'test.val',
      node,
      key: 'val',
      meta,
      history,
      pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any), addButton: () => ({} as any) },
      storage: null,
      base: {},
      doc,
    });
    expect(resReadonly).toBeNull();
  });

  it('attachNudgeControls 는 편집 가능 바인딩에 버튼을 생성하고 중복 호출 시 재사용한다', () => {
    const { doc } = createFakeDOM();
    const history = new DevLayoutHistory();
    const node = { val: 10 };
    const meta = { path: 'test.val', target: node, key: 'val', readonly: false, min: 0, max: 20 };
    const el = doc.createElement('div');

    const first = attachNudgeControls({ element: el, on: () => {} }, {
      path: 'test.val',
      node,
      key: 'val',
      meta,
      history,
      pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any), addButton: () => ({} as any) },
      storage: null,
      base: {},
      doc,
    });
    expect(first).not.toBeNull();
    expect(first?.upBtn.textContent).toBe('▲');
    expect(first?.downBtn.textContent).toBe('▼');

    // 재호출 시 중복 생성 없이 기존 컨테이너 반환
    const second = attachNudgeControls({ element: el, on: () => {} }, {
      path: 'test.val',
      node,
      key: 'val',
      meta,
      history,
      pane: { refresh: () => {}, dispose: () => {}, addFolder: () => ({} as any), addBinding: () => ({} as any), addButton: () => ({} as any) },
      storage: null,
      base: {},
      doc,
    });
    expect(second).not.toBeNull();
    expect(second?.container).toBe(first?.container);
  });
});

describe('DEVUI-011 nudgeValue 순수 함수 단위 테스트', () => {
  it('기본 step=1일 때 dir 1이면 +1, dir -1이면 -1을 반환한다', () => {
    expect(nudgeValue(10, 1, false)).toBe(11);
    expect(nudgeValue(10, -1, false)).toBe(9);
  });

  it('shift가 true이면 기본 단위의 10배 (step * 10) 만큼 조정된다', () => {
    expect(nudgeValue(100, 1, true)).toBe(110);
    expect(nudgeValue(100, -1, true)).toBe(90);
    // 커스텀 step=2 일 때 shift=true 이면 20 조정
    expect(nudgeValue(50, 1, true, 2)).toBe(70);
    expect(nudgeValue(50, -1, true, 2)).toBe(30);
  });

  it('min 및 max 범위를 벗어나지 않도록 클램프된다', () => {
    // min clamp
    expect(nudgeValue(5, -1, false, 1, 0, 10)).toBe(4);
    expect(nudgeValue(0, -1, false, 1, 0, 10)).toBe(0);
    expect(nudgeValue(3, -1, true, 1, 0, 10)).toBe(0);

    // max clamp
    expect(nudgeValue(9, 1, false, 1, 0, 10)).toBe(10);
    expect(nudgeValue(10, 1, false, 1, 0, 10)).toBe(10);
    expect(nudgeValue(8, 1, true, 1, 0, 10)).toBe(10);
  });

  it('소수점 연산 시 부동소수점 오차(0.1 + 0.2 등)를 방지한다', () => {
    expect(nudgeValue(0.1, 1, false, 0.1)).toBe(0.2);
    expect(nudgeValue(0.2, 1, false, 0.1)).toBe(0.3);
    expect(nudgeValue(0.3, -1, false, 0.1)).toBe(0.2);
    // step=0.01 에 shift=true 이면 +0.1
    expect(nudgeValue(0.05, 1, true, 0.01)).toBe(0.15);
  });
});

describe('DEVUI-011 화살표 버튼 주입 및 읽기 전용 검증', () => {
  type Rec = {
    kind: string;
    title?: string;
    key?: string;
    params?: any;
    children: Rec[];
    handlers: Record<string, Function>;
    element?: any;
    obj?: any;
  };

  function makeMockPane(doc: any) {
    function makeNode(kind: string, extra: Partial<Rec> = {}): any {
      const node: any = {
        kind,
        children: [] as Rec[],
        handlers: {},
        element: doc.makeElement('div'),
        ...extra,
      };
      node.addFolder = (p: any) => {
        const f = makeNode('folder', { title: p.title });
        node.children.push(f);
        return f;
      };
      node.addBinding = (obj: any, key: string, params: any) => {
        const bindingEl = doc.makeElement('div');
        bindingEl.className = 'tp-lblv';
        const valEl = doc.makeElement('div');
        valEl.className = 'tp-lblv_v';
        bindingEl.appendChild(valEl);

        const inputEl = doc.makeElement('input');
        inputEl.type = 'text';
        inputEl.value = String(obj[key]);
        valEl.appendChild(inputEl);

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

  function walk(n: any, out: any[] = []): any[] {
    out.push(n);
    for (const c of n.children || []) walk(c, out);
    return out;
  }

  it('편집 가능한 숫자 바인딩 행에는 ▲ / ▼ 버튼이 주입된다', async () => {
    const { doc, makeElement } = createFakeDOM();
    (doc as any).makeElement = makeElement;
    const storage = new MemStorage();
    let root: any;

    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc,
      {
        createPane: () => {
          root = makeMockPane(doc);
          return root;
        },
        storage,
        download: () => {},
        fileOverride: null,
        watchState: false,
      },
    );

    const editableBinding = walk(root).find(
      (n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y',
    );
    expect(editableBinding).toBeDefined();

    const upBtn = editableBinding.element.querySelector('.dg-nudge-up');
    const downBtn = editableBinding.element.querySelector('.dg-nudge-down');
    expect(upBtn).not.toBeNull();
    expect(downBtn).not.toBeNull();
    expect(upBtn.textContent).toBe('▲');
    expect(downBtn.textContent).toBe('▼');
  });

  it('읽기 전용 바인딩 행에는 화살표 버튼이 생성되지 않는다', async () => {
    const { doc, makeElement } = createFakeDOM();
    (doc as any).makeElement = makeElement;
    const storage = new MemStorage();
    let root: any;

    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc,
      {
        createPane: () => {
          root = makeMockPane(doc);
          return root;
        },
        storage,
        download: () => {},
        fileOverride: null,
        watchState: false,
      },
    );

    const lockedFolder = walk(root).find(
      (n) => n.kind === 'folder' && n.title?.includes('판정 연동 좌표 (읽기 전용)'),
    );
    expect(lockedFolder).toBeDefined();

    const readonlyBindings = walk(lockedFolder).filter((n) => n.kind === 'binding');
    expect(readonlyBindings.length).toBeGreaterThan(0);

    for (const b of readonlyBindings) {
      const upBtn = b.element.querySelector('.dg-nudge-up');
      const downBtn = b.element.querySelector('.dg-nudge-down');
      expect(upBtn).toBeNull();
      expect(downBtn).toBeNull();
    }
  });

  it('화살표 버튼 단일 클릭 시 ±1(Shift: ±10) 조정되고 DevLayoutHistory에 1건 기록된다', async () => {
    const { doc, makeElement } = createFakeDOM();
    (doc as any).makeElement = makeElement;
    const storage = new MemStorage();
    const history = new DevLayoutHistory();
    let root: any;

    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc,
      {
        createPane: () => {
          root = makeMockPane(doc);
          return root;
        },
        storage,
        download: () => {},
        fileOverride: null,
        watchState: false,
        history,
      },
    );

    const b = walk(root).find(
      (n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y',
    );
    const startY = UI_LAYOUT.menu.title.y;
    const upBtn = b.element.querySelector('.dg-nudge-up');
    const downBtn = b.element.querySelector('.dg-nudge-down');

    // 1회 클릭: +1
    upBtn.dispatchEvent({ type: 'click', shiftKey: false });
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 1);
    expect(history.undoCount).toBe(1);

    // Shift + 1회 클릭: +10
    upBtn.dispatchEvent({ type: 'click', shiftKey: true });
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 11);
    expect(history.undoCount).toBe(2);

    // 1회 클릭: -1
    downBtn.dispatchEvent({ type: 'click', shiftKey: false });
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 10);
    expect(history.undoCount).toBe(3);

    // Shift + 1회 클릭: -10
    downBtn.dispatchEvent({ type: 'click', shiftKey: true });
    expect(UI_LAYOUT.menu.title.y).toBe(startY);
    expect(history.undoCount).toBe(4);
  });

  it('길게 누르기(mousedown -> repeat -> mouseup) 시 누르고 있는 동안의 변경이 1건의 Undo 이력으로 묶인다', async () => {
    vi.useFakeTimers();
    const { doc, makeElement } = createFakeDOM();
    (doc as any).makeElement = makeElement;
    const storage = new MemStorage();
    const history = new DevLayoutHistory();
    let root: any;

    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc,
      {
        createPane: () => {
          root = makeMockPane(doc);
          return root;
        },
        storage,
        download: () => {},
        fileOverride: null,
        watchState: false,
        history,
      },
    );

    const b = walk(root).find(
      (n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y',
    );
    const startY = UI_LAYOUT.menu.title.y;
    const upBtn = b.element.querySelector('.dg-nudge-up');

    // mousedown 발생: 초기 1회 즉시 실행 (+1)
    upBtn.dispatchEvent({ type: 'mousedown', button: 0, shiftKey: false });
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 1);

    // 400ms 이전 (300ms 진행): 추가 변경 없음
    vi.advanceTimersByTime(300);
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 1);

    // 400ms 도달 (100ms 추가 진행): 반복 타이머 활성화
    vi.advanceTimersByTime(100);

    // 60ms 간격으로 3회 반복 (180ms 진행): +3
    vi.advanceTimersByTime(NUDGE_REPEAT_INTERVAL_MS * 3);
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 4);

    // mouseup 으로 종료
    upBtn.dispatchEvent({ type: 'mouseup', button: 0 });

    // 누르고 있던 동안 여러 번 변경되었지만 Undo 이력은 단 1건으로 묶여야 함
    expect(history.undoCount).toBe(1);

    // Undo 1회 실행으로 시작값(startY)으로 일괄 복원
    const undone = history.undo();
    expect(undone).toEqual({ path: 'menu.title.y', before: startY, after: startY + 4 });
  });

  it('숫자 입력칸 포커스 상태에서 키보드 ArrowUp / ArrowDown 키 입력 시 조작되고 이력이 1건씩 기록된다', async () => {
    const { doc, makeElement } = createFakeDOM();
    (doc as any).makeElement = makeElement;
    const storage = new MemStorage();
    const history = new DevLayoutHistory();
    let root: any;

    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc,
      {
        createPane: () => {
          root = makeMockPane(doc);
          return root;
        },
        storage,
        download: () => {},
        fileOverride: null,
        watchState: false,
        history,
      },
    );

    const b = walk(root).find(
      (n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y',
    );
    const inputEl = b.element.querySelector('input');
    expect(inputEl).not.toBeNull();
    const startY = UI_LAYOUT.menu.title.y;

    // input 포커스 설정
    doc.activeElement = inputEl;

    // ArrowUp: +1
    let prevented = false;
    inputEl.dispatchEvent({
      type: 'keydown',
      key: 'ArrowUp',
      shiftKey: false,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(true);
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 1);
    expect(history.undoCount).toBe(1);

    // Shift + ArrowUp: +10
    prevented = false;
    inputEl.dispatchEvent({
      type: 'keydown',
      key: 'ArrowUp',
      shiftKey: true,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(true);
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 11);
    expect(history.undoCount).toBe(2);

    // ArrowDown: -1
    inputEl.dispatchEvent({
      type: 'keydown',
      key: 'ArrowDown',
      shiftKey: false,
      preventDefault: () => {},
    });
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 10);
    expect(history.undoCount).toBe(3);

    // Shift + ArrowDown: -10
    inputEl.dispatchEvent({
      type: 'keydown',
      key: 'ArrowDown',
      shiftKey: true,
      preventDefault: () => {},
    });
    expect(UI_LAYOUT.menu.title.y).toBe(startY);
    expect(history.undoCount).toBe(4);
  });
});
