/**
 * [DEVUI-006] (Issue #566) Tweakpane 레이아웃 패널
 *
 * 실제 Tweakpane 없이 검증 가능한 순수 로직(바인딩 평탄화·잠금·diff·내보내기 왕복·저장 복원)과
 * 모의 Pane 으로 패널 마운트 동작을 검증한다. UI_LAYOUT 은 공유 싱글턴이므로 afterEach 에서 원복한다.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { UI_LAYOUT } from '../../config/ui.config';
import {
  DEV_UI_SECTION_MAP,
  DEV_UI_LOCKED_LAYOUT_PATHS,
  getDevUiLockedSources,
} from '../../config/dev-ui.config';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride';
import {
  flattenLayoutBindings,
  isLockedPath,
  snapshotLayout,
  buildLayoutDiff,
  buildLayoutExport,
  resetLayoutTo,
  saveLayoutDiff,
  restoreLayoutDiff,
  getSectionsForState,
  mountDevLayoutPanel,
  DEV_LAYOUT_STORAGE_KEY,
  DEV_LAYOUT_PANEL_ID,
  DEV_LAYOUT_EXPORT_FILENAME,
} from '../../src/dev/DevLayoutPanel';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
});

function countNumbers(v: unknown): number {
  if (typeof v === 'number') return 1;
  if (v && typeof v === 'object') return Object.values(v).reduce<number>((n, c) => n + countNumbers(c), 0);
  return 0;
}

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('DEVUI-006 바인딩 생성', () => {
  it('UI_LAYOUT 의 모든 숫자 필드가 바인딩에 포함된다', () => {
    const bindings = flattenLayoutBindings(UI_LAYOUT, []);
    expect(bindings.length).toBe(countNumbers(UI_LAYOUT));
    const paths = bindings.map((b) => b.path);
    expect(paths).toContain('menu.title.y');
    expect(paths).toContain('menu.chapterCards.2.x');
    expect(paths).toContain('settings.buttons.camera.h');
  });

  it('바인딩은 대상 객체를 직접 가리킨다 (교체 없이 제자리 수정)', () => {
    const titleRef = UI_LAYOUT.menu.title;
    const b = flattenLayoutBindings(UI_LAYOUT, []).find((x) => x.path === 'menu.title.y')!;
    expect(b.target).toBe(titleRef);
    expect(b.key).toBe('y');
    b.target[b.key] = 222;
    expect(UI_LAYOUT.menu.title).toBe(titleRef);
    expect(UI_LAYOUT.menu.title.y).toBe(222);
  });

  it('슬라이더 범위: 가로 계열 0~1080, 세로 계열 0~2160, 크기는 최소 1', () => {
    const bindings = flattenLayoutBindings(UI_LAYOUT, []);
    const x = bindings.find((b) => b.path === 'menu.title.x')!;
    const y = bindings.find((b) => b.path === 'menu.title.y')!;
    const w = bindings.find((b) => b.path === 'menu.title.w')!;
    const h = bindings.find((b) => b.path === 'menu.title.h')!;
    expect([x.min, x.max]).toEqual([0, 1080]);
    expect([y.min, y.max]).toEqual([0, 2160]);
    expect([w.min, w.max]).toEqual([1, 1080]);
    expect([h.min, h.max]).toEqual([1, 2160]);
  });

  it('잠금 패턴과 일치하는 항목은 읽기 전용이다 (* 는 한 단계 와일드카드)', () => {
    expect(isLockedPath('menu.chapterCards.3.chapter', ['menu.chapterCards.*.chapter'])).toBe(true);
    expect(isLockedPath('menu.chapterCards.3.x', ['menu.chapterCards.*.chapter'])).toBe(false);
    expect(isLockedPath('hud.comboBadge.w', ['hud.comboBadge'])).toBe(true);
    const bindings = flattenLayoutBindings(UI_LAYOUT, ['hud.comboBadge', 'menu.chapterCards.*.chapter']);
    expect(bindings.find((b) => b.path === 'hud.comboBadge.y')!.readonly).toBe(true);
    expect(bindings.find((b) => b.path === 'menu.chapterCards.0.chapter')!.readonly).toBe(true);
    expect(bindings.find((b) => b.path === 'menu.title.y')!.readonly).toBe(false);
  });

  it('기본 잠금 목록은 챕터 식별자를 읽기 전용으로 둔다', () => {
    const bindings = flattenLayoutBindings(UI_LAYOUT, DEV_UI_LOCKED_LAYOUT_PATHS);
    expect(bindings.find((b) => b.path === 'menu.chapterCards.4.chapter')!.readonly).toBe(true);
  });
});

describe('DEVUI-006 dev-ui.config', () => {
  it('화면 → 섹션 매핑: 메뉴는 menu, 서브메뉴는 subMenu, 결과는 result', () => {
    expect(getSectionsForState('MENU_MAIN')).toContain('menu');
    expect(getSectionsForState('MENU_SUB')).toContain('subMenu');
    expect(getSectionsForState('RESULT')).toContain('result');
    expect(getSectionsForState('UNKNOWN_STATE')).toEqual([]);
  });

  it('매핑된 섹션 키는 모두 UI_LAYOUT 의 최상위 키다', () => {
    for (const sections of Object.values(DEV_UI_SECTION_MAP)) {
      for (const s of sections) expect(Object.keys(UI_LAYOUT)).toContain(s);
    }
  });

  it('판정 연동 좌표(피트니스 존 1~11 등)는 값 복사본으로 제공된다 (원본 수정 불가)', () => {
    const sources = getDevUiLockedSources();
    const zones = sources.find((s) => s.id === 'fitnessZones')!;
    expect(zones).toBeDefined();
    expect(Object.keys(zones.values).length).toBe(11 * 4);
    zones.values['zone1.x'] = 0.99;
    expect(DEFAULT_FITNESS_ZONES[0].x).toBe(0.04);
    expect(sources.some((s) => s.id === 'floorLine')).toBe(true);
    expect(sources.some((s) => s.id === 'laneX')).toBe(true);
  });
});

describe('DEVUI-006 diff·내보내기', () => {
  it('변경이 없으면 diff 는 빈 객체다', () => {
    const base = snapshotLayout(UI_LAYOUT);
    expect(buildLayoutDiff(UI_LAYOUT, base)).toEqual({});
  });

  it('변경분만 담고, 배열은 빈 객체 자리표시로 인덱스를 유지한다', () => {
    const base = snapshotLayout(UI_LAYOUT);
    UI_LAYOUT.menu.title.y = 250;
    UI_LAYOUT.menu.chapterCards[2].x = 130;
    const diff = buildLayoutDiff(UI_LAYOUT, base);
    expect(diff).toEqual({
      menu: { title: { y: 250 }, chapterCards: [{}, {}, { x: 130 }] },
    });
  });

  it('pinned 경로는 값이 같아도 포함한다 (기존 ui-layout.json 항목 보존)', () => {
    const base = snapshotLayout(UI_LAYOUT);
    const diff = buildLayoutDiff(UI_LAYOUT, base, new Set(['hud.comboBadge.w']));
    expect(diff).toEqual({ hud: { comboBadge: { w: UI_LAYOUT.hud.comboBadge!.w } } });
  });

  it('내보낸 JSON 을 DEVUI-002 로 기본값에 재적용하면 결과가 같다 (왕복)', () => {
    const base = snapshotLayout(UI_LAYOUT);
    UI_LAYOUT.menu.title.y = 260;
    UI_LAYOUT.subMenu.grid.gapX = 90;
    UI_LAYOUT.menu.chapterCards[4].y = 1400;
    UI_LAYOUT.settings.buttons!.sound.x = 210;
    const expected = snapshotLayout(UI_LAYOUT);
    const out = buildLayoutExport(UI_LAYOUT, base);
    expect(out.warnings).toEqual([]);
    expect(out.filename).toBe(DEV_LAYOUT_EXPORT_FILENAME);
    expect(DEV_LAYOUT_EXPORT_FILENAME).toBe('ui-layout.json');

    const fresh = snapshotLayout(base);
    const res = applyLayoutOverride(fresh, JSON.parse(out.json));
    expect(res.warnings).toEqual([]);
    expect(fresh).toEqual(expected);
  });

  it('검증기를 통과하지 못하는 값이 있으면 경고를 돌려준다', () => {
    const base = snapshotLayout(UI_LAYOUT);
    UI_LAYOUT.menu.title.w = 0;
    const out = buildLayoutExport(UI_LAYOUT, base);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it('resetLayoutTo 는 객체 참조를 유지한 채 기준값으로 되돌린다', () => {
    const base = snapshotLayout(UI_LAYOUT);
    const ref = UI_LAYOUT.menu.title;
    UI_LAYOUT.menu.title.y = 300;
    resetLayoutTo(UI_LAYOUT, base);
    expect(UI_LAYOUT.menu.title).toBe(ref);
    expect(UI_LAYOUT.menu.title.y).toBe(base.menu.title.y);
  });
});

describe('DEVUI-006 localStorage 저장·복원', () => {
  it('저장한 변경분을 복원하면 같은 값이 제자리로 적용된다', () => {
    const storage = new MemStorage();
    const base = snapshotLayout(UI_LAYOUT);
    UI_LAYOUT.menu.title.y = 333;
    saveLayoutDiff(storage, UI_LAYOUT, base);
    expect(storage.getItem(DEV_LAYOUT_STORAGE_KEY)).toContain('333');
    resetLayoutTo(UI_LAYOUT, base);
    const ref = UI_LAYOUT.menu.title;
    const res = restoreLayoutDiff(storage, UI_LAYOUT);
    expect(res.applied).toContain('menu.title.y');
    expect(UI_LAYOUT.menu.title).toBe(ref);
    expect(UI_LAYOUT.menu.title.y).toBe(333);
  });

  it('변경분이 없으면 저장 항목을 지운다', () => {
    const storage = new MemStorage();
    storage.setItem(DEV_LAYOUT_STORAGE_KEY, '{"menu":{"title":{"y":1}}}');
    saveLayoutDiff(storage, UI_LAYOUT, snapshotLayout(UI_LAYOUT));
    expect(storage.getItem(DEV_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('깨진 저장값은 무시한다', () => {
    const storage = new MemStorage();
    storage.setItem(DEV_LAYOUT_STORAGE_KEY, '{broken');
    const res = restoreLayoutDiff(storage, UI_LAYOUT);
    expect(res.applied).toEqual([]);
    expect(UI_LAYOUT).toEqual(PRISTINE);
  });
});

describe('DEVUI-006 패널 마운트 (모의 Pane)', () => {
  type Rec = { kind: string; title?: string; key?: string; params?: any; children: Rec[]; expanded?: boolean; handlers: Record<string, Function> };

  function makeNode(kind: string, extra: Partial<Rec> = {}): any {
    const node: any = { kind, children: [] as Rec[], handlers: {}, expanded: false, ...extra };
    node.addFolder = (p: any) => { const f = makeNode('folder', { title: p.title, expanded: !!p.expanded }); node.children.push(f); return f; };
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

  function walk(n: any, out: any[] = []): any[] { out.push(n); for (const c of n.children ?? []) walk(c, out); return out; }

  function fakeDoc() {
    const all: any[] = [];
    const mk = (tag: string) => {
      const el: any = { tagName: tag, id: '', style: {}, children: [] as any[], appendChild(c: any) { el.children.push(c); all.push(c); return c; } };
      return el;
    };
    return { getElementById: (id: string) => all.find((c) => c.id === id) ?? null, createElement: mk, body: mk('body') };
  }

  let storage: MemStorage;
  beforeEach(() => { storage = new MemStorage(); });

  async function mount(state = 'MENU_MAIN', exported: string[] = []) {
    let root: any;
    const doc = fakeDoc();
    const app = { stateMachine: { currentState: state } };
    const handle = await mountDevLayoutPanel(app, doc as unknown as Document, {
      createPane: () => { root = makeNode('pane'); return root; },
      storage,
      download: (text) => { exported.push(text); },
      fileOverride: null,
      watchState: false,
    });
    return { root, doc, handle };
  }

  it('패널 컨테이너를 장면 이동 패널과 겹치지 않는 우측에 붙인다', async () => {
    const { doc } = await mount();
    const el = doc.getElementById(DEV_LAYOUT_PANEL_ID)!;
    expect(el).toBeTruthy();
    expect(el.style.right).toBe('0px');
    expect(el.style.left).toBeUndefined();
  });

  it('현재 상태에 매핑된 섹션만 펼친다', async () => {
    const { root } = await mount('MENU_MAIN');
    const folders = walk(root).filter((n) => n.kind === 'folder');
    expect(folders.find((f) => f.title === 'menu')!.expanded).toBe(true);
    expect(folders.find((f) => f.title === 'result')!.expanded).toBe(false);
  });

  it('잠금 항목과 판정 연동 좌표는 readonly 로 바인딩된다', async () => {
    const { root } = await mount();
    const bindings = walk(root).filter((n) => n.kind === 'binding');
    const chapter = bindings.find((b) => b.key === 'chapter')!;
    expect(chapter.params.readonly).toBe(true);
    const locked = walk(root).find((n) => n.kind === 'folder' && /판정/.test(n.title))!;
    expect(locked).toBeDefined();
    const lockedBindings = walk(locked).filter((n) => n.kind === 'binding');
    expect(lockedBindings.length).toBeGreaterThan(0);
    for (const b of lockedBindings) expect(b.params.readonly).toBe(true);
  });

  it('값 변경 시 UI_LAYOUT 이 즉시 바뀌고 localStorage 에 저장된다', async () => {
    const { root } = await mount();
    const b = walk(root).find((n) => n.kind === 'binding' && n.obj === UI_LAYOUT.menu.title && n.key === 'y')!;
    b.obj.y = 199;
    b.handlers.change({ value: 199 });
    expect(UI_LAYOUT.menu.title.y).toBe(199);
    expect(JSON.parse(storage.getItem(DEV_LAYOUT_STORAGE_KEY)!)).toEqual({ menu: { title: { y: 199 } } });
  });

  it('내보내기 버튼은 diff JSON 을 내려받고, 전체 초기화는 기준값으로 되돌린다', async () => {
    const exported: string[] = [];
    const { root } = await mount('MENU_MAIN', exported);
    UI_LAYOUT.menu.title.y = 205;
    const buttons = walk(root).filter((n) => n.kind === 'button');
    buttons.find((b) => /내보내기|export/i.test(b.title))!.handlers.click();
    expect(JSON.parse(exported[0])).toEqual({ menu: { title: { y: 205 } } });
    buttons.find((b) => /초기화|reset/i.test(b.title))!.handlers.click();
    expect(UI_LAYOUT.menu.title.y).toBe(PRISTINE.menu.title.y);
    expect(storage.getItem(DEV_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('마운트 시 저장된 변경분을 복원한다', async () => {
    storage.setItem(DEV_LAYOUT_STORAGE_KEY, JSON.stringify({ menu: { title: { y: 211 } } }));
    await mount();
    expect(UI_LAYOUT.menu.title.y).toBe(211);
  });
});

describe('DEVUI-006 DevBootstrap 연결', () => {
  it('stateMachine 이 있으면 예약 후 레이아웃 패널 마운트를 호출한다', async () => {
    const { startDevUi } = await import('../../src/dev/DevBootstrap');
    const { StateMachine } = await import('../../src/core/StateMachine');
    const all: any[] = [];
    const mk = (tag: string) => {
      const el: any = { tagName: tag, id: '', value: '', style: {}, children: [] as any[], appendChild(c: any) { el.children.push(c); all.push(c); return c; }, addEventListener() {} };
      return el;
    };
    const doc = { getElementById: (id: string) => all.find((c) => c.id === id) ?? null, createElement: mk, body: mk('body') };
    const app = { stateMachine: new StateMachine('MENU_MAIN'), engine: { running: true, frozen: false, setFrozen() {} } };
    const calls: unknown[][] = [];
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui' }, {
      schedule: (fn) => fn(),
      mountLayoutPanel: (a, d) => { calls.push([a, d]); },
    });
    expect(calls).toEqual([[app, doc]]);
  });

  it('stateMachine 이 없으면 레이아웃 패널을 붙이지 않는다', async () => {
    const { startDevUi } = await import('../../src/dev/DevBootstrap');
    const doc = { getElementById: () => null, createElement: () => ({ style: {} }), body: { appendChild() {} } };
    let called = false;
    startDevUi({}, doc as unknown as Document, { search: '?dev=ui' }, { schedule: (fn) => fn(), mountLayoutPanel: () => { called = true; } });
    expect(called).toBe(false);
  });
});

describe('DEVUI-006 번들 격리', () => {
  function walkFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walkFiles(p, out);
      else if (p.endsWith('.ts')) out.push(p);
    }
    return out;
  }

  it('tweakpane 은 src/dev 안에서만 import 한다', () => {
    const src = resolve(__dirname, '../../src');
    const devDir = join(src, 'dev');
    for (const f of walkFiles(src)) {
      if (f.startsWith(devDir)) continue;
      expect(readFileSync(f, 'utf8')).not.toMatch(/['"]tweakpane['"]/);
    }
  });

  it('tweakpane 은 devDependency 로만 선언된다', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.devDependencies?.tweakpane).toBeDefined();
    expect(pkg.dependencies?.tweakpane).toBeUndefined();
  });
});
