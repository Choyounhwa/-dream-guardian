/**
 * [DEVUI-010] (Issue #579) 레이아웃 패널 Undo/Redo (버튼·단축키·드래그 묶음)
 *
 * TDD Step 2 Red 선작성
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride';
import {
  DevLayoutHistory,
  type LayoutChangeItem,
  type LayoutHistoryEntry,
} from '../../src/dev/DevLayoutHistory';
import {
  mountDevLayoutPanel,
  applyPathValue,
} from '../../src/dev/DevLayoutPanel';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
});

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('DEVUI-010 DevLayoutHistory 단위 테스트', () => {
  it('초기 상태에서는 canUndo, canRedo 모두 false 이다', () => {
    const history = new DevLayoutHistory();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });

  it('단일 변경 push 후 undo 및 redo 가 정상 동작한다', () => {
    const history = new DevLayoutHistory();
    const pushed = history.push({ path: 'menu.title.y', before: 100, after: 150 });
    expect(pushed).toBe(true);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.undoCount).toBe(1);

    const undone = history.undo();
    expect(undone).toEqual({ path: 'menu.title.y', before: 100, after: 150 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo();
    expect(redone).toEqual({ path: 'menu.title.y', before: 100, after: 150 });
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('새 변경이 push 되면 redo 스택이 비워진다', () => {
    const history = new DevLayoutHistory();
    history.push({ path: 'menu.title.y', before: 100, after: 120 });
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.push({ path: 'menu.title.x', before: 50, after: 60 });
    expect(history.canRedo()).toBe(false);
    expect(history.redoCount).toBe(0);
  });

  it('clear 호출 시 undo/redo 스택이 모두 비워진다', () => {
    const history = new DevLayoutHistory();
    history.push({ path: 'menu.title.y', before: 100, after: 120 });
    history.undo();
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('최대 200건 상한을 초과하면 가장 오래된 항목부터 버린다', () => {
    const history = new DevLayoutHistory(5);
    for (let i = 1; i <= 6; i++) {
      history.push({ path: 'menu.title.y', before: i, after: i + 1 });
    }
    expect(history.undoCount).toBe(5);
    // 가장 오래된 i=1 항목은 버려지고, 6, 5, 4, 3, 2 가 남아있어야 한다
    const items: LayoutHistoryEntry[] = [];
    while (history.canUndo()) {
      items.push(history.undo()!);
    }
    expect(items.length).toBe(5);
    expect((items[items.length - 1] as LayoutChangeItem).before).toBe(2);
  });

  it('묶음(batch) 변경을 1건으로 기록하고 undo/redo 할 수 있다', () => {
    const history = new DevLayoutHistory();
    const batch: LayoutChangeItem[] = [
      { path: 'menu.title.x', before: 10, after: 20 },
      { path: 'menu.title.y', before: 30, after: 40 },
    ];
    history.push(batch);
    expect(history.undoCount).toBe(1);

    const undone = history.undo();
    expect(undone).toEqual(batch);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo();
    expect(redone).toEqual(batch);
  });

  it('before 와 after 가 동일한 변경은 push 되지 않는다', () => {
    const history = new DevLayoutHistory();
    const pushed = history.push({ path: 'menu.title.x', before: 10, after: 10 });
    expect(pushed).toBe(false);
    expect(history.undoCount).toBe(0);
  });
});

describe('DEVUI-010 드래그 묶음 처리 (Drag Coalescing)', () => {
  it('중간 change(last=false)는 이력에 쌓이지 않고, 마지막 change(last=true) 시 1건만 기록된다', () => {
    const history = new DevLayoutHistory();
    history.setValue('menu.title.y', 100);

    // 드래그 중
    const res1 = history.recordChange('menu.title.y', 110, false);
    expect(res1).toBeNull();
    expect(history.undoCount).toBe(0);

    const res2 = history.recordChange('menu.title.y', 120, false);
    expect(res2).toBeNull();
    expect(history.undoCount).toBe(0);

    // 드래그 종료
    const res3 = history.recordChange('menu.title.y', 130, true);
    expect(res3).toEqual({ path: 'menu.title.y', before: 100, after: 130 });
    expect(history.undoCount).toBe(1);

    const undone = history.undo();
    expect(undone).toEqual({ path: 'menu.title.y', before: 100, after: 130 });
  });

  it('드래그 후 제자리(시작 값과 동일)로 돌아오면 이력에 push 되지 않는다', () => {
    const history = new DevLayoutHistory();
    history.setValue('menu.title.y', 100);

    history.recordChange('menu.title.y', 120, false);
    const res = history.recordChange('menu.title.y', 100, true);
    expect(res).toBeNull();
    expect(history.undoCount).toBe(0);
  });
});

describe('DEVUI-010 in-place 객체 참조 유지 및 applyPathValue', () => {
  it('applyPathValue 로 값을 변경해도 상위 및 하위 객체 참조가 유지된다', () => {
    const titleRef = UI_LAYOUT.menu.title;
    const menuRef = UI_LAYOUT.menu;

    const success = applyPathValue(UI_LAYOUT, 'menu.title.y', 999);
    expect(success).toBe(true);
    expect(UI_LAYOUT.menu.title.y).toBe(999);
    expect(UI_LAYOUT.menu.title).toBe(titleRef);
    expect(UI_LAYOUT.menu).toBe(menuRef);
  });
});

describe('DEVUI-010 패널 마운트 및 Undo/Redo 연동 (모의 Pane)', () => {
  type Rec = { kind: string; title?: string; key?: string; params?: any; children: Rec[]; expanded?: boolean; handlers: Record<string, Function>; disabled?: boolean };

  function makeNode(kind: string, extra: Partial<Rec> = {}): any {
    const node: any = { kind, children: [] as Rec[], handlers: {}, expanded: false, disabled: false, ...extra };
    node.addFolder = (p: any) => { const f = makeNode('folder', { title: p.title, expanded: !!p.expanded }); node.children.push(f); return f; };
    node.addBinding = (obj: any, key: string, params: any) => {
      const b = makeNode('binding', { key, params });
      b.obj = obj;
      b.on = (ev: string, fn: Function) => { b.handlers[ev] = fn; return b; };
      node.children.push(b);
      return b;
    };
    node.addButton = (p: any) => {
      const b = makeNode('button', { title: p.title, disabled: !!p.disabled });
      b.on = (ev: string, fn: Function) => { b.handlers[ev] = fn; return b; };
      node.children.push(b);
      return b;
    };
    node.refresh = () => {};
    node.dispose = () => {};
    return node;
  }

  function walk(n: any, out: any[] = []): any[] { out.push(n); for (const c of n.children ?? []) walk(c, out); return out; }

  function fakeDoc() {
    const all: any[] = [];
    const eventListeners: Record<string, Function[]> = {};
    const mk = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        id: '',
        style: {},
        children: [] as any[],
        appendChild(c: any) { el.children.push(c); all.push(c); return c; },
        remove() {},
      };
      return el;
    };
    return {
      activeElement: null as any,
      getElementById: (id: string) => all.find((c) => c.id === id) ?? null,
      createElement: mk,
      body: mk('body'),
      addEventListener: (ev: string, fn: Function) => {
        eventListeners[ev] = eventListeners[ev] || [];
        eventListeners[ev].push(fn);
      },
      removeEventListener: (ev: string, fn: Function) => {
        if (eventListeners[ev]) {
          eventListeners[ev] = eventListeners[ev].filter((f) => f !== fn);
        }
      },
      _dispatch: (ev: string, data: any) => {
        for (const fn of eventListeners[ev] || []) fn(data);
      },
      _listeners: eventListeners,
    };
  }

  let storage: MemStorage;
  beforeEach(() => { storage = new MemStorage(); });

  async function mount(state = 'MENU_MAIN') {
    let root: any;
    const doc = fakeDoc();
    const app = { stateMachine: { currentState: state } };
    const handle = await mountDevLayoutPanel(app, doc as unknown as Document, {
      createPane: () => { root = makeNode('pane'); return root; },
      storage,
      download: () => {},
      fileOverride: null,
      watchState: false,
    });
    return { root, doc, handle };
  }

  it('상단에 Undo/Redo 버튼이 배치되고 초기에는 둘 다 비활성화(disabled) 상태이다', async () => {
    const { root } = await mount();
    const buttons = walk(root).filter((n) => n.kind === 'button');
    const undoBtn = buttons.find((b) => /undo/i.test(b.title));
    const redoBtn = buttons.find((b) => /redo/i.test(b.title));

    expect(undoBtn).toBeDefined();
    expect(redoBtn).toBeDefined();
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });

  it('값 변경 시 Undo 버튼이 활성화되고, Undo 클릭 시 값이 복원되며 Redo 가 활성화된다', async () => {
    const { root } = await mount();
    const b = walk(root).find((n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y')!;
    const buttons = walk(root).filter((n) => n.kind === 'button');
    const undoBtn = buttons.find((b) => /undo/i.test(b.title))!;
    const redoBtn = buttons.find((b) => /redo/i.test(b.title))!;

    const originalY = UI_LAYOUT.menu.title.y;
    b.obj.y = 250;
    b.handlers.change({ value: 250, last: true });

    expect(UI_LAYOUT.menu.title.y).toBe(250);
    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);

    // Undo 클릭
    undoBtn.handlers.click();
    expect(UI_LAYOUT.menu.title.y).toBe(originalY);
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(false);

    // Redo 클릭
    redoBtn.handlers.click();
    expect(UI_LAYOUT.menu.title.y).toBe(250);
    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);
  });

  it('전체 초기화 시 변경 사항이 batch 로 기록되어 Undo 로 일괄 복원된다', async () => {
    const { root } = await mount();
    const titleY = walk(root).find((n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y')!;
    const titleX = walk(root).find((n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'x')!;
    const buttons = walk(root).filter((n) => n.kind === 'button');
    const resetBtn = buttons.find((b) => /초기화|reset/i.test(b.title))!;
    const undoBtn = buttons.find((b) => /undo/i.test(b.title))!;

    titleY.obj.y = 333;
    titleY.handlers.change({ value: 333, last: true });
    titleX.obj.x = 444;
    titleX.handlers.change({ value: 444, last: true });

    expect(UI_LAYOUT.menu.title.y).toBe(333);
    expect(UI_LAYOUT.menu.title.x).toBe(444);

    // 전체 초기화 실행 -> 기본값으로 복원
    resetBtn.handlers.click();
    expect(UI_LAYOUT.menu.title.y).toBe(PRISTINE.menu.title.y);
    expect(UI_LAYOUT.menu.title.x).toBe(PRISTINE.menu.title.x);

    // Undo 실행 -> 초기화 직전의 333, 444 로 일괄 복원
    undoBtn.handlers.click();
    expect(UI_LAYOUT.menu.title.y).toBe(333);
    expect(UI_LAYOUT.menu.title.x).toBe(444);
  });

  it('단축키 Ctrl+Z 와 Ctrl+Y / Ctrl+Shift+Z 로 Undo/Redo 가 작동한다', async () => {
    const { root, doc } = await mount();
    const b = walk(root).find((n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y')!;
    const originalY = UI_LAYOUT.menu.title.y;

    b.obj.y = 299;
    b.handlers.change({ value: 299, last: true });

    let prevented = false;
    doc._dispatch('keydown', {
      ctrlKey: true,
      key: 'z',
      shiftKey: false,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(true);
    expect(UI_LAYOUT.menu.title.y).toBe(originalY);

    // Redo (Ctrl+Shift+Z)
    prevented = false;
    doc._dispatch('keydown', {
      ctrlKey: true,
      key: 'z',
      shiftKey: true,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(true);
    expect(UI_LAYOUT.menu.title.y).toBe(299);

    // Undo (Ctrl+Z)
    doc._dispatch('keydown', {
      ctrlKey: true,
      key: 'z',
      shiftKey: false,
      preventDefault: () => {},
    });
    expect(UI_LAYOUT.menu.title.y).toBe(originalY);

    // Redo (Ctrl+Y)
    prevented = false;
    doc._dispatch('keydown', {
      ctrlKey: true,
      key: 'y',
      shiftKey: false,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(true);
    expect(UI_LAYOUT.menu.title.y).toBe(299);
  });

  it('텍스트 입력창(INPUT/TEXTAREA)에 포커스가 있을 때는 단축키를 가로채지 않는다', async () => {
    const { root, doc } = await mount();
    const b = walk(root).find((n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y')!;

    b.obj.y = 299;
    b.handlers.change({ value: 299, last: true });

    // INPUT 포커스 상태 설정
    doc.activeElement = { tagName: 'INPUT' };

    let prevented = false;
    doc._dispatch('keydown', {
      ctrlKey: true,
      key: 'z',
      shiftKey: false,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(false);
    expect(UI_LAYOUT.menu.title.y).toBe(299); // Undo 가 실행되지 않고 값 유지
  });
});
