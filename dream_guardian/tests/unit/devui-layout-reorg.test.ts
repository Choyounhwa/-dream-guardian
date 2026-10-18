import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  startDevUi,
  DEV_SCENE_JUMPER_ID,
  DEV_SELECT_ROW_ID,
  DEV_FREEZE_ROW_ID,
  DEV_ACTION_MENU_ID,
} from '../../src/dev/DevBootstrap.js';
import {
  mountDevLayoutPanel,
  DEV_UNDO_BTN_ID,
  DEV_REDO_BTN_ID,
  DEV_EXPORT_BTN_ID,
  DEV_RESET_BTN_ID,
} from '../../src/dev/DevLayoutPanel.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride.js';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
});

function fakeApp(initial: 'MENU_MAIN' = 'MENU_MAIN') {
  const stateMachine = new StateMachine(initial);
  const engine = {
    running: true,
    frozen: false,
    setFrozen: vi.fn(function (this: any, v: boolean) {
      engine.frozen = v;
    }),
  };
  return { stateMachine, engine };
}

describe('Dev UI 레이아웃 재배치 (Freeze 및 액션 메뉴 세로 정렬)', () => {
  it('freeze 체크박스가 select바 아래에 위치하고 action-menu 가 freeze 아래에 세로로 위치한다', () => {
    const app = fakeApp();
    const created: any[] = [];
    const elementsById = new Map<string, any>();

    const mk = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        id: '',
        type: '',
        checked: false,
        value: '',
        style: {},
        children: [] as any[],
        listeners: {} as Record<string, Function>,
        appendChild(child: any) {
          el.children.push(child);
          return child;
        },
        addEventListener(event: string, fn: Function) {
          el.listeners[event] = fn;
        },
      };
      created.push(el);
      return el;
    };

    const doc = {
      createElement: mk,
      getElementById: (id: string) => elementsById.get(id) ?? created.find((e) => e.id === id) ?? null,
      body: {
        appendChild(c: any) {
          if (c.id) elementsById.set(c.id, c);
          return c;
        },
      },
    };

    startDevUi(app, doc as unknown as Document, { search: '?dev=ui' }, { schedule: (fn) => fn() });

    const jumper = doc.getElementById(DEV_SCENE_JUMPER_ID);
    expect(jumper).toBeTruthy();

    const selectRow = doc.getElementById(DEV_SELECT_ROW_ID);
    expect(selectRow).toBeTruthy();
    expect(selectRow.children.some((c: any) => c.tagName === 'SELECT')).toBe(true);

    const freezeRow = doc.getElementById(DEV_FREEZE_ROW_ID);
    expect(freezeRow).toBeTruthy();
    const freezeBox = created.find((e) => e.type === 'checkbox');
    expect(freezeBox).toBeTruthy();

    // jumper 패널 내에서 selectRow 다음 freezeRow, 그 다음 actionMenu 순서로 배치
    const selectIdx = jumper.children.indexOf(selectRow);
    const freezeIdx = jumper.children.indexOf(freezeRow);
    expect(selectIdx).toBeGreaterThanOrEqual(0);
    expect(freezeIdx).toBeGreaterThan(selectIdx);

    const actionMenu = doc.getElementById(DEV_ACTION_MENU_ID);
    expect(actionMenu).toBeTruthy();
    expect(actionMenu.style.flexDirection).toBe('column');
    const actionIdx = jumper.children.indexOf(actionMenu);
    expect(actionIdx).toBeGreaterThan(freezeIdx);
  });

  it('Undo, Redo, 내보내기, 전체 초기화 메뉴가 설정 메뉴(Tweakpane)와 분리되어 왼쪽 freeze 아래에 세로로 배치된다', async () => {
    const app = fakeApp();
    const created: any[] = [];
    const elementsById = new Map<string, any>();

    const mk = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        id: '',
        type: '',
        checked: false,
        value: '',
        style: {},
        children: [] as any[],
        listeners: {} as Record<string, Function>,
        appendChild(child: any) {
          el.children.push(child);
          if (child.id) elementsById.set(child.id, child);
          return child;
        },
        addEventListener(event: string, fn: Function) {
          el.listeners[event] = fn;
        },
      };
      created.push(el);
      return el;
    };

    const doc = {
      createElement: mk,
      getElementById: (id: string) => elementsById.get(id) ?? created.find((e) => e.id === id) ?? null,
      body: {
        appendChild(c: any) {
          if (c.id) elementsById.set(c.id, c);
          return c;
        },
      },
    };

    // 1. Scene jumper 생성
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui' }, { schedule: (fn) => fn() });

    // 2. 모의 pane 노드
    const paneButtons: any[] = [];
    const mockPane = {
      addFolder: () => {
        const folder: any = {
          addBinding: () => ({ on: () => {} }),
          addFolder: () => folder,
        };
        return folder;
      },
      addBinding: () => ({ on: () => {} }),
      addButton: (p: any) => {
        paneButtons.push(p);
        return { on: () => {} };
      },
      refresh: () => {},
      dispose: () => {},
    };

    const handle = await mountDevLayoutPanel(app, doc as unknown as Document, {
      createPane: () => mockPane as any,
      storage: null,
      fileOverride: null,
      watchState: false,
    });

    // Tweakpane(오른쪽 설정 메뉴)에는 액션 버튼이 전혀 등록되지 않아야 한다
    expect(paneButtons.length).toBe(0);

    // 왼쪽 actionMenu 안에 4개 버튼이 등록되어야 한다 (세로 정렬)
    const actionMenu = doc.getElementById(DEV_ACTION_MENU_ID);
    expect(actionMenu).toBeTruthy();
    expect(actionMenu.style.flexDirection).toBe('column');

    const undoBtn = doc.getElementById(DEV_UNDO_BTN_ID);
    const redoBtn = doc.getElementById(DEV_REDO_BTN_ID);
    const exportBtn = doc.getElementById(DEV_EXPORT_BTN_ID);
    const resetBtn = doc.getElementById(DEV_RESET_BTN_ID);

    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();
    expect(exportBtn).toBeTruthy();
    expect(resetBtn).toBeTruthy();

    expect(undoBtn.textContent).toContain('Undo');
    expect(redoBtn.textContent).toContain('Redo');
    expect(exportBtn.textContent).toContain('내보내기');
    expect(resetBtn.textContent).toContain('초기화');

    handle?.dispose();
  });
});
