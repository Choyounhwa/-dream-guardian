/**
 * [BUG-DEVUI-001] (Issue #585) Dev UI 레이아웃 재내보내기 시 기존 ui-layout.json 보존 검증
 *
 * 부팅 시 이미 ui-layout.json(fileOverride)이 UI_LAYOUT에 병합된 환경에서,
 * 패널 마운트 후 일부 요소만 변경하고 내보낼 때 기존 파일의 오버라이드 항목들이
 * pinned로 정상 유지되어 새 내보내기 JSON에서 누락되지 않는지 검증한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config';
import {
  applyLayoutOverride,
  applyMultiLayoutOverride,
} from '../../src/core/UILayoutOverride';
import {
  mountDevLayoutPanel,
  extractLayoutLeafPaths,
  ASSAULT_VISUAL,
} from '../../src/dev/DevLayoutPanel';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));
const PRISTINE_ASSAULT = JSON.parse(JSON.stringify(DEFAULT_ASSAULT_VISUAL_CONFIG));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
  if (ASSAULT_VISUAL) {
    applyLayoutOverride(ASSAULT_VISUAL, PRISTINE_ASSAULT);
  }
});

class MockStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

function makeNode(kind: string, extra: any = {}): any {
  const node: any = { kind, children: [] as any[], handlers: {}, expanded: false, ...extra };
  node.addFolder = (p: any) => {
    const f = makeNode('folder', { title: p.title, expanded: !!p.expanded });
    node.children.push(f);
    return f;
  };
  node.addBinding = (obj: any, key: string, params: any) => {
    const b = makeNode('binding', { key, params });
    b.obj = obj;
    b.on = (ev: string, fn: Function) => { b.handlers[ev] = fn; return b; };
    node.children.push(b);
    return b;
  };
  node.addButton = (p: any) => {
    const b = makeNode('button', { title: p.title });
    b.on = (ev: string, fn: Function) => { b.handlers[ev] = fn; return b; };
    node.children.push(b);
    return b;
  };
  node.refresh = () => {};
  node.dispose = () => {};
  return node;
}

function fakeDoc() {
  const all: any[] = [];
  const mk = (tag: string) => {
    const el: any = {
      tagName: tag,
      id: '',
      style: {},
      children: [] as any[],
      appendChild(c: any) { el.children.push(c); all.push(c); return c; },
      remove() { const idx = all.indexOf(el); if (idx >= 0) all.splice(idx, 1); },
    };
    return el;
  };
  return {
    getElementById: (id: string) => all.find((c) => c.id === id) ?? null,
    createElement: mk,
    body: mk('body'),
  };
}

describe('BUG-DEVUI-001: extractLayoutLeafPaths 순수 함수', () => {
  it('중첩 객체의 모든 숫자 리프 경로를 추출한다', () => {
    const input = {
      menu: {
        title: { x: 10, y: 20 },
        locomotionBtn: { w: 500 },
      },
      hud: {
        playerHpBar: { x: 40 },
      },
    };
    const paths = extractLayoutLeafPaths(input);
    expect(paths.sort()).toEqual([
      'hud.playerHpBar.x',
      'menu.locomotionBtn.w',
      'menu.title.x',
      'menu.title.y',
    ].sort());
  });

  it('배열 인덱스를 포함한 리프 경로를 올바르게 점 표기법으로 추출한다', () => {
    const input = {
      menu: {
        chapterCards: [
          { x: 120, y: 460 },
          { x: 600, y: 460 },
        ],
      },
    };
    const paths = extractLayoutLeafPaths(input);
    expect(paths.sort()).toEqual([
      'menu.chapterCards.0.x',
      'menu.chapterCards.0.y',
      'menu.chapterCards.1.x',
      'menu.chapterCards.1.y',
    ].sort());
  });

  it('객체가 아니거나 빈 객체일 경우 빈 배열을 반환한다', () => {
    expect(extractLayoutLeafPaths(null)).toEqual([]);
    expect(extractLayoutLeafPaths(undefined)).toEqual([]);
    expect(extractLayoutLeafPaths('string')).toEqual([]);
    expect(extractLayoutLeafPaths({})).toEqual([]);
  });
});

describe('BUG-DEVUI-001: 부팅 후 재내보내기 시 기존 fileOverride 누락 방지', () => {
  it('기존 파일의 여러 오버라이드가 병합된 상태에서 1개 항목만 수정 후 내보낼 때 기존 항목들이 100% 보존된다', async () => {
    // 1. 기존에 사용자가 여러 개 수정하여 public/layouts/ui-layout.json에 저장해 둔 가상의 파일 오버라이드
    const fileOverride = {
      menu: {
        title: { x: 6, y: 200, w: 1027 },
        locomotionBtn: { x: 300, y: 380 },
      },
      hud: {
        playerHpBar: { x: 55, y: 65 },
      },
    };

    // 2. 엔진 부팅 시뮬레이션: UI_LAYOUT에 fileOverride가 이미 병합되어 적용됨
    applyLayoutOverride(UI_LAYOUT, fileOverride);

    // 3. 브라우저에서 Dev UI 패널 마운트 (이때 base는 이미 fileOverride 값을 포함)
    const exportedJsons: string[] = [];
    const storage = new MockStorage();
    const doc = fakeDoc();

    const handle = await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc as unknown as Document,
      {
        createPane: () => makeNode('pane'),
        storage,
        fileOverride,
        download: (json) => {
          exportedJsons.push(json);
        },
      },
    );

    expect(handle).not.toBeNull();

    // 4. 이번 세션에서 사용자가 hud.bossHpBar.x 하나만 새로 수정함
    UI_LAYOUT.hud.bossHpBar.x = 750;

    // 5. 내보내기(Export) 실행
    handle?.buttons?.export?.handlers?.click();

    expect(exportedJsons.length).toBe(1);
    const result = JSON.parse(exportedJsons[0]);

    // 검증: 새로 수정한 bossHpBar 뿐만 아니라, 기존 파일에 들어있던
    // menu.title(x, y, w), menu.locomotionBtn(x, y), hud.playerHpBar(x, y)가 누락 없이 그대로 보존되어야 함!
    expect(result.hud?.bossHpBar?.x).toBe(750);
    expect(result.menu?.title?.x).toBe(6);
    expect(result.menu?.title?.y).toBe(200);
    expect(result.menu?.title?.w).toBe(1027);
    expect(result.menu?.locomotionBtn?.x).toBe(300);
    expect(result.menu?.locomotionBtn?.y).toBe(380);
    expect(result.hud?.playerHpBar?.x).toBe(55);
    expect(result.hud?.playerHpBar?.y).toBe(65);
  });

  it('다중 소스(ui, assault) 네임스페이스 파일 오버라이드에서도 기존 항목이 누락 없이 보존된다', async () => {
    const multiFileOverride = {
      version: 1,
      ui: {
        menu: {
          title: { x: 15, y: 220 },
        },
      },
      assault: {
        visualScale: 1.5,
      },
    };

    applyMultiLayoutOverride({ ui: UI_LAYOUT, assault: ASSAULT_VISUAL }, multiFileOverride);

    const exportedJsons: string[] = [];
    const storage = new MockStorage();
    const doc = fakeDoc();

    const handle = await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc as unknown as Document,
      {
        createPane: () => makeNode('pane'),
        storage,
        fileOverride: multiFileOverride,
        multiSource: true,
        download: (json) => {
          exportedJsons.push(json);
        },
      },
    );

    // 이번 세션에서 UI_LAYOUT.menu.title.x 만 30으로 수정
    UI_LAYOUT.menu.title.x = 30;

    handle?.buttons?.export?.handlers?.click();

    expect(exportedJsons.length).toBe(1);
    const result = JSON.parse(exportedJsons[0]);

    expect(result.version).toBe(1);
    // UI에서 x는 30으로 변경되고 기존 y: 220은 보존되어야 함
    expect(result.ui?.menu?.title?.x).toBe(30);
    expect(result.ui?.menu?.title?.y).toBe(220);
    // assault 네임스페이스의 기존 항목도 보존되어야 함
    expect(result.assault?.visualScale).toBe(1.5);
  });
});
