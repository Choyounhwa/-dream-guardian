/**
 * [DEVUI-007] (Issue #567) 인스펙터 오버레이 단위 테스트
 *
 * 1. 캔버스 화면 좌표 ↔ 1080x2160 가상 좌표 변환 (screenToVirtual / virtualToScreen)
 * 2. Hit Test 및 겹친 요소 감지·순환 선택
 * 3. GameState별 LayoutRegistry 요소 등록 및 렌더러/UI_LAYOUT 연동
 * 4. 판정 연동 좌표(피트니스 존, 바닥 판정선, 레인)의 isProtected 잠금 및 드래그 거부 검증
 * 5. 마우스 드래그를 통한 x/y 편집, Shift 축 고정, DevLayoutHistory 연계
 * 6. DevBootstrap 라이프사이클 마운트 및 dispose 연계
 *
 * UI_LAYOUT 공유 싱글턴 오염을 방지하기 위해 afterEach에서 반드시 원복한다.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { UI_LAYOUT } from '../../config/ui.config';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride';
import {
  screenToVirtual,
  virtualToScreen,
  virtualRectToScreen,
  screenRectToVirtual,
  isPointInBounds,
  hitTestElement,
  findAllInspectableAt,
  findInspectableAt,
  cycleInspectable,
  getInspectableElements,
  getLayoutCoordinates,
  setLayoutCoordinates,
  type InspectableElement,
} from '../../src/dev/LayoutRegistry';
import {
  DevInspectorOverlay,
  mountDevInspectorOverlay,
  DEV_INSPECTOR_OVERLAY_ID,
} from '../../src/dev/DevInspectorOverlay';
import { DevLayoutHistory } from '../../src/dev/DevLayoutHistory';
import { startDevUi } from '../../src/dev/DevBootstrap';

const PRISTINE_LAYOUT = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE_LAYOUT);
});

function makeMockDoc() {
  const listeners: Record<string, Function[]> = {};
  const elements: any[] = [];

  const mk = (tagName: string) => {
    const el: any = {
      tagName,
      id: '',
      style: {},
      width: 1080,
      height: 2160,
      clientWidth: 1080,
      clientHeight: 2160,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1080, height: 2160 }),
      children: [] as any[],
      appendChild(child: any) {
        el.children.push(child);
        elements.push(child);
        return child;
      },
      removeChild(child: any) {
        const idx = el.children.indexOf(child);
        if (idx >= 0) el.children.splice(idx, 1);
        const idx2 = elements.indexOf(child);
        if (idx2 >= 0) elements.splice(idx2, 1);
        return child;
      },
      getContext: () => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        setLineDash: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
      }),
      addEventListener: (ev: string, fn: Function) => {
        listeners[ev] = listeners[ev] || [];
        listeners[ev].push(fn);
      },
      removeEventListener: (ev: string, fn: Function) => {
        if (!listeners[ev]) return;
        listeners[ev] = listeners[ev].filter((f) => f !== fn);
      },
      dispatchEvent: (ev: any) => {
        const fns = listeners[ev.type] || [];
        fns.forEach((f) => f(ev));
      },
    };
    return el;
  };

  const doc: any = {
    createElement: mk,
    getElementById: (id: string) => elements.find((e) => e.id === id) ?? null,
    body: mk('body'),
    addEventListener: (ev: string, fn: Function) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    removeEventListener: (ev: string, fn: Function) => {
      if (!listeners[ev]) return;
      listeners[ev] = listeners[ev].filter((f) => f !== fn);
    },
  };

  return { doc, listeners };
}

describe('DEVUI-007 [1] 좌표 변환 유틸리티', () => {
  it('동일 해상도(1080x2160)에서 화면 좌표와 가상 좌표가 1:1 대응된다', () => {
    const pt = { x: 540, y: 1080 };
    const virt = screenToVirtual(pt, 1080, 2160);
    expect(virt.x).toBeCloseTo(540);
    expect(virt.y).toBeCloseTo(1080);

    const screen = virtualToScreen(virt, 1080, 2160);
    expect(screen.x).toBeCloseTo(540);
    expect(screen.y).toBeCloseTo(1080);
  });

  it('절반 해상도(540x1080)에서 화면 픽셀이 1080x2160 가상 좌표로 2배 스케일링된다', () => {
    const pt = { x: 270, y: 540 };
    const virt = screenToVirtual(pt, 540, 1080);
    expect(virt.x).toBeCloseTo(540);
    expect(virt.y).toBeCloseTo(1080);

    const back = virtualToScreen({ x: 540, y: 1080 }, 540, 1080);
    expect(back.x).toBeCloseTo(270);
    expect(back.y).toBeCloseTo(540);
  });

  it('virtualRectToScreen 및 screenRectToVirtual 직사각형 변환이 정확하다', () => {
    const virtRect = { x: 100, y: 200, w: 300, h: 400 };
    const screenRect = virtualRectToScreen(virtRect, 540, 1080);
    expect(screenRect).toEqual({ x: 50, y: 100, w: 150, h: 200 });

    const roundTrip = screenRectToVirtual(screenRect, 540, 1080);
    expect(roundTrip).toEqual(virtRect);
  });

  it('0 또는 음수 뷰포트 크기가 주어지면 기본 1080x2160으로 안전하게 fallback한다', () => {
    const virt = screenToVirtual({ x: 100, y: 200 }, 0, 0);
    expect(virt.x).toBeCloseTo(100);
    expect(virt.y).toBeCloseTo(200);
  });
});

describe('DEVUI-007 [2] Hit Test 및 순환 선택', () => {
  const elemA: InspectableElement = {
    id: 'box.a',
    label: '박스 A',
    path: 'test.a',
    getBounds: () => ({ x: 100, y: 100, w: 200, h: 200 }),
  };

  const elemB: InspectableElement = {
    id: 'box.b',
    label: '박스 B (A 내부에 겹침)',
    path: 'test.b',
    getBounds: () => ({ x: 150, y: 150, w: 100, h: 100 }),
  };

  it('isPointInBounds가 경계 내외부를 정확히 판별한다', () => {
    const bounds = { x: 10, y: 20, w: 100, h: 50 };
    expect(isPointInBounds({ x: 10, y: 20 }, bounds)).toBe(true);
    expect(isPointInBounds({ x: 110, y: 70 }, bounds)).toBe(true);
    expect(isPointInBounds({ x: 50, y: 40 }, bounds)).toBe(true);
    expect(isPointInBounds({ x: 9, y: 20 }, bounds)).toBe(false);
    expect(isPointInBounds({ x: 50, y: 71 }, bounds)).toBe(false);
  });

  it('hitTestElement가 요소 바운즈 기준으로 적중 여부를 반환한다', () => {
    expect(hitTestElement(elemA, 120, 120, 1080, 2160)).toBe(true);
    expect(hitTestElement(elemA, 50, 50, 1080, 2160)).toBe(false);
  });

  it('겹친 영역에서 findAllInspectableAt은 모든 겹친 요소를 반환하고 findInspectableAt은 최상위 요소를 반환한다', () => {
    const elements = [elemA, elemB];
    const hits = findAllInspectableAt(elements, 175, 175, 1080, 2160);
    expect(hits.length).toBe(2);
    expect(hits[0].id).toBe('box.a');
    expect(hits[1].id).toBe('box.b');

    const top = findInspectableAt(elements, 175, 175, 1080, 2160);
    expect(top?.id).toBe('box.b');
  });

  it('cycleInspectable이 겹친 요소를 순환(cycle)하여 다음 요소를 선택한다', () => {
    const hits = [elemA, elemB];
    // 선택 없는 상태에서는 첫 번째
    expect(cycleInspectable(hits, null)?.id).toBe('box.a');
    // box.a 선택 상태에서는 box.b
    expect(cycleInspectable(hits, 'box.a')?.id).toBe('box.b');
    // box.b 선택 상태에서는 다시 box.a로 래핑
    expect(cycleInspectable(hits, 'box.b')?.id).toBe('box.a');
    // hits가 비어있으면 null
    expect(cycleInspectable([], 'box.a')).toBeNull();
  });
});

describe('DEVUI-007 [3] LayoutRegistry 요소 등록 및 렌더러/UI_LAYOUT 연동', () => {
  it('MENU_MAIN 상태에서 메인 타이틀, 이동 모드 버튼, 챕터 카드 5종, 하단바 등이 등록된다', () => {
    const elements = getInspectableElements('MENU_MAIN');
    const ids = elements.map((e) => e.id);

    expect(ids).toContain('menu.title');
    expect(ids).toContain('menu.locomotionBtn');
    expect(ids).toContain('menu.chapterCards.0');
    expect(ids).toContain('menu.chapterCards.4');
    expect(ids).toContain('bottomBar.bar');
    expect(ids).toContain('bottomBar.settingsBtn');

    const titleElem = elements.find((e) => e.id === 'menu.title')!;
    const bounds = titleElem.getBounds(1080, 2160);
    expect(bounds.x).toBe(UI_LAYOUT.menu.title.x);
    expect(bounds.y).toBe(UI_LAYOUT.menu.title.y);
  });

  it('MENU_SUB 상태에서 서브메뉴 타이틀, 뒤로가기 버튼, 모드 카드 2종이 등록된다', () => {
    const elements = getInspectableElements('MENU_SUB');
    const ids = elements.map((e) => e.id);

    expect(ids).toContain('subMenu.title');
    expect(ids).toContain('subMenu.backBtn');
    expect(ids).toContain('subMenu.subCards.0');
    expect(ids).toContain('subMenu.subCards.1');
  });

  it('RUN_QUESTION 상태에서 HUD(플레이어/보스 HP바, 보스이름, 콤보), 문제 보드 등이 등록된다', () => {
    const elements = getInspectableElements('RUN_QUESTION');
    const ids = elements.map((e) => e.id);

    expect(ids).toContain('hud.playerHpBar');
    expect(ids).toContain('hud.bossHpBar');
    expect(ids).toContain('hud.bossName');
    expect(ids).toContain('hud.comboBadge');
    expect(ids).toContain('question.board');
    expect(ids).toContain('bottomBar.manaBar');
  });

  it('app 객체에 공개 bounds getter(MenuRenderer, HUDLayer 등)가 존재하면 이를 우선 호출한다', () => {
    const mockApp = {
      menuRenderer: {
        getTitleLayout: vi.fn().mockReturnValue({ x: 99, y: 88, w: 777, h: 66 }),
      },
      hudLayer: {
        getPlayerHpBarBounds: vi.fn().mockReturnValue({ x: 12, y: 34, w: 200, h: 30 }),
      },
    };

    const menuElems = getInspectableElements('MENU_MAIN', mockApp);
    const title = menuElems.find((e) => e.id === 'menu.title')!;
    expect(title.getBounds(1080, 2160)).toEqual({ x: 99, y: 88, w: 777, h: 66 });
    expect(mockApp.menuRenderer.getTitleLayout).toHaveBeenCalled();

    const hudElems = getInspectableElements('RUN_QUESTION', mockApp);
    const hp = hudElems.find((e) => e.id === 'hud.playerHpBar')!;
    expect(hp.getBounds(1080, 2160)).toEqual({ x: 12, y: 34, w: 200, h: 30 });
    expect(mockApp.hudLayer.getPlayerHpBarBounds).toHaveBeenCalled();
  });
});

describe('DEVUI-007 [4] 판정 연동 좌표 잠금 및 드래그 거부', () => {
  it('피트니스 존 1~11 및 바닥 판정선, 회피 레인은 isProtected가 true이다', () => {
    const elements = getInspectableElements('READY_POSITION');
    const protectedElems = elements.filter((e) => e.isProtected);
    const protectedIds = protectedElems.map((e) => e.id);

    // 피트니스 존 1~11 등록 확인
    expect(protectedIds).toContain('zone.zone_1');
    expect(protectedIds).toContain('zone.zone_11');
    expect(protectedIds).toContain('runningMat.strikeLine');

    // 일반 UI 요소는 isProtected가 아님
    const playerHp = elements.find((e) => e.id === 'hud.playerHpBar')!;
    expect(playerHp.isProtected).toBeFalsy();
  });

  it('setLayoutCoordinates는 isProtected인 경로의 수정을 거부하고 false를 반환한다', () => {
    const result = setLayoutCoordinates('zone.zone_1', { x: 100, y: 100 });
    expect(result).toBe(false);

    const strikeResult = setLayoutCoordinates('runningMat.strikeLine', { x: 50, y: 50 });
    expect(strikeResult).toBe(false);
  });

  it('일반 UI 요소의 x, y는 getLayoutCoordinates와 setLayoutCoordinates로 읽고 쓸 수 있다', () => {
    const initial = getLayoutCoordinates('menu.title');
    expect(initial).toEqual({ x: UI_LAYOUT.menu.title.x, y: UI_LAYOUT.menu.title.y });

    const ok = setLayoutCoordinates('menu.title', { x: 123, y: 456 });
    expect(ok).toBe(true);
    expect(UI_LAYOUT.menu.title.x).toBe(123);
    expect(UI_LAYOUT.menu.title.y).toBe(456);
  });
});

describe('DEVUI-007 [5] DevInspectorOverlay 인터랙션 (선택·드래그·축 고정·히스토리)', () => {
  it('오버레이 마운트 시 캔버스가 생성되고 DEV_INSPECTOR_OVERLAY_ID 아이디가 부여된다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const overlay = new DevInspectorOverlay({ app, doc });

    expect(overlay.canvas).toBeDefined();
    expect(overlay.canvas.id).toBe(DEV_INSPECTOR_OVERLAY_ID);

    overlay.dispose();
    expect(doc.getElementById(DEV_INSPECTOR_OVERLAY_ID)).toBeNull();
  });

  it('마우스 이동 시 hover 요소를 감지한다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const overlay = new DevInspectorOverlay({ app, doc });

    const titleBounds = UI_LAYOUT.menu.title;
    overlay.handlePointerMove(titleBounds.x + 10, titleBounds.y + 10);
    expect(overlay.getHoveredElement()?.id).toBe('menu.title');

    // 요소가 없는 영역으로 이동 시 hover가 해제된다
    overlay.handlePointerMove(0, 0);
    expect(overlay.getHoveredElement()).toBeNull();

    overlay.dispose();
  });

  it('마우스 클릭 시 요소를 선택하고 onSelect 콜백을 호출한다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const onSelect = vi.fn();
    const overlay = new DevInspectorOverlay({ app, doc, onSelect });

    const titleBounds = UI_LAYOUT.menu.title;
    overlay.handlePointerDown(titleBounds.x + 10, titleBounds.y + 10);
    overlay.handlePointerUp();

    expect(overlay.getSelectedElement()?.id).toBe('menu.title');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'menu.title' }));

    overlay.dispose();
  });

  it('일반 요소를 마우스 드래그하면 UI_LAYOUT 좌표가 갱신되고 onChange가 호출된다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const history = new DevLayoutHistory();
    const onChange = vi.fn();
    const overlay = new DevInspectorOverlay({ app, doc, history, onChange });

    const startX = UI_LAYOUT.menu.title.x;
    const startY = UI_LAYOUT.menu.title.y;

    // 타이틀 요소 영역에서 pointer down
    overlay.handlePointerDown(startX + 20, startY + 20);
    // +50px, +30px 드래그 이동
    overlay.handlePointerMove(startX + 70, startY + 50);
    overlay.handlePointerUp();

    expect(UI_LAYOUT.menu.title.x).toBe(startX + 50);
    expect(UI_LAYOUT.menu.title.y).toBe(startY + 30);
    expect(onChange).toHaveBeenCalled();

    // DevLayoutHistory에 묶음 변경이 기록되었는지 확인
    expect(history.undoCount).toBeGreaterThan(0);
    expect(history.canUndo()).toBe(true);

    overlay.dispose();
  });

  it('Shift 키를 누른 상태에서 드래그하면 이동폭이 더 큰 한 축으로 고정된다 (수평 축 고정)', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const overlay = new DevInspectorOverlay({ app, doc });

    const startX = UI_LAYOUT.menu.title.x;
    const startY = UI_LAYOUT.menu.title.y;

    overlay.handlePointerDown(startX + 10, startY + 10);
    // dx = 60, dy = 20 (수평 변위가 더 크므로 y는 고정되어야 함)
    overlay.handlePointerMove(startX + 70, startY + 30, { shiftKey: true });
    overlay.handlePointerUp();

    expect(UI_LAYOUT.menu.title.x).toBe(startX + 60);
    expect(UI_LAYOUT.menu.title.y).toBe(startY); // y 변화 없음

    overlay.dispose();
  });

  it('isProtected인 판정 연동 요소를 드래그하려고 하면 드래그가 거부되고 좌표가 바뀌지 않는다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'READY_POSITION' } };
    const overlay = new DevInspectorOverlay({ app, doc });

    const strikeLine = getInspectableElements('READY_POSITION').find(
      (e) => e.id === 'runningMat.strikeLine',
    )!;
    const bounds = strikeLine.getBounds(1080, 2160);

    const initialY = UI_LAYOUT.runningMat.y;

    overlay.handlePointerDown(bounds.x + 10, bounds.y + 2);
    expect(overlay.isDragRejected()).toBe(true);

    overlay.handlePointerMove(bounds.x + 10, bounds.y + 100);
    overlay.handlePointerUp();

    // 판정 좌표는 절대 변경되지 않아야 함
    expect(UI_LAYOUT.runningMat.y).toBe(initialY);

    overlay.dispose();
  });

  it('snapGrid 설정 시 드래그 이동 좌표가 지정된 단위(예: 10px)로 스냅된다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const overlay = new DevInspectorOverlay({ app, doc, snapGrid: 10 });

    const startX = UI_LAYOUT.menu.title.x;
    const startY = UI_LAYOUT.menu.title.y;

    overlay.handlePointerDown(startX + 10, startY + 10);
    // +23px, +17px 이동 시 10단위로 반올림되어 +20px, +20px로 스냅
    overlay.handlePointerMove(startX + 33, startY + 27);
    overlay.handlePointerUp();

    expect(UI_LAYOUT.menu.title.x).toBe(Math.round((startX + 23) / 10) * 10);
    expect(UI_LAYOUT.menu.title.y).toBe(Math.round((startY + 17) / 10) * 10);

    overlay.dispose();
  });

  it('setEnabled(false) 호출 시 오버레이 비활성화 및 선택이 초기화된다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const overlay = new DevInspectorOverlay({ app, doc });

    overlay.selectElement('menu.title');
    expect(overlay.getSelectedElement()?.id).toBe('menu.title');

    overlay.setEnabled(false);
    expect(overlay.getSelectedElement()).toBeNull();
    expect(overlay.canvas.style.display).toBe('none');

    overlay.dispose();
  });
});

describe('DEVUI-007 [6] DevBootstrap 연결 및 라이프사이클', () => {
  it('startDevUi 호출 시 mountInspectorOverlay 옵션이 정상 실행된다', () => {
    const doc: any = {
      createElement: () => ({
        style: {},
        appendChild: () => {},
        setAttribute: () => {},
        addEventListener: vi.fn(),
      }),
      getElementById: () => null,
      body: { appendChild: () => {} },
    };

    const mockMountInspector = vi.fn();
    const app = {
      stateMachine: {
        currentState: 'MENU_MAIN',
        forceState: vi.fn(),
        enableDevForce: vi.fn(),
      },
      engine: { running: true, frozen: false, setFrozen: vi.fn() },
    };

    startDevUi(app, doc, { search: '?dev=ui' }, {
      schedule: (fn) => fn(),
      mountLayoutPanel: vi.fn(),
      mountInspectorOverlay: mockMountInspector,
    });

    expect(mockMountInspector).toHaveBeenCalledWith(app, doc);
  });

  it('mountDevInspectorOverlay 헬퍼 함수가 정상적으로 오버레이 인스턴스를 생성한다', () => {
    const { doc } = makeMockDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };
    const overlay = mountDevInspectorOverlay(app, doc as unknown as Document);
    expect(overlay).toBeInstanceOf(DevInspectorOverlay);
    expect(overlay.canvas.id).toBe(DEV_INSPECTOR_OVERLAY_ID);
    overlay.dispose();
  });
});

describe('DEVUI-007 [7] 프로덕션 번들 격리', () => {
  function walkFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walkFiles(p, out);
      else if (p.endsWith('.ts')) out.push(p);
    }
    return out;
  }

  it('LayoutRegistry와 DevInspectorOverlay는 src/dev 내부 및 테스트에서만 import 된다', () => {
    const src = resolve(__dirname, '../../src');
    const devDir = join(src, 'dev');
    for (const f of walkFiles(src)) {
      if (f.startsWith(devDir)) continue;
      const content = readFileSync(f, 'utf8');
      expect(content).not.toMatch(/from\s+['"].*\/LayoutRegistry(\.js)?['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/DevInspectorOverlay(\.js)?['"]/);
    }
  });
});
