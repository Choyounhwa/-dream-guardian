/**
 * [DEVUI-004] (Issue #564) 개발 모드 화면 프리셋 - 메뉴 계열
 *
 * 프리셋: menu_main, menu_sub(Ch.1~5), settings, locomotion_modal, pause, ready_position,
 *        result(별 1~3, 고정 점수), gameover
 * - AppBootstrap 공개 API와 DEVUI-003 강제 이동(force 콜백)만 사용한다.
 * - 프리셋 적용 중 저장소(localStorage) 쓰기 0회.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { calcStars } from '../../src/ui/ResultRenderer.js';
import {
  DEV_PRESET_IDS,
  parseDevPreset,
  getPresetTarget,
  applyDevPreset,
  withStorageWriteGuard,
} from '../../src/dev/DevScenePresets.js';
import { startDevUi, DEV_SCENE_JUMPER_ID } from '../../src/dev/DevBootstrap.js';

function createMockCanvas(clientW = 540, clientH = 960) {
  const ctx: any = new Proxy(
    { canvas: { width: 1080, height: 2160 }, measureText: () => ({ width: 100 }) },
    {
      get(target: any, key) {
        if (key in target) return target[key];
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        return () => {};
      },
      set(target: any, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
  return {
    clientWidth: clientW,
    clientHeight: clientH,
    width: 1080,
    height: 2160,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => (data.has(k) ? data.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => { data.set(k, String(v)); }),
    removeItem: vi.fn((k: string) => { data.delete(k); }),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null),
    get length() { return data.size; },
  };
}

describe('DEVUI-004 프리셋 목록/URL 파싱', () => {
  it('8종 프리셋(menu_sub 1~5, result 1~3 변형 포함)을 제공한다', () => {
    for (const id of [
      'menu_main', 'menu_sub_1', 'menu_sub_2', 'menu_sub_3', 'menu_sub_4', 'menu_sub_5',
      'settings', 'locomotion_modal', 'pause', 'ready_position',
      'result_1', 'result_2', 'result_3', 'gameover',
    ]) {
      expect(DEV_PRESET_IDS).toContain(id);
    }
  });

  it('프리셋별 목표 상태', () => {
    expect(getPresetTarget('menu_main')).toBe('MENU_MAIN');
    expect(getPresetTarget('menu_sub_3')).toBe('MENU_SUB');
    expect(getPresetTarget('settings')).toBe('MENU_MAIN');
    expect(getPresetTarget('locomotion_modal')).toBe('MENU_MAIN');
    expect(getPresetTarget('pause')).toBe('READY_POSITION');
    expect(getPresetTarget('ready_position')).toBe('READY_POSITION');
    expect(getPresetTarget('result_2')).toBe('RESULT');
    expect(getPresetTarget('gameover')).toBe('GAMEOVER');
  });

  it('?dev=ui&preset=<id> 파싱 (대소문자 무시, 알 수 없는 값/ dev 없음은 null)', () => {
    expect(parseDevPreset('?dev=ui&preset=settings')).toBe('settings');
    expect(parseDevPreset('?dev=ui&preset=MENU_SUB_4')).toBe('menu_sub_4');
    expect(parseDevPreset('?dev=ui&preset=result')).toBe('result_3');
    expect(parseDevPreset('?dev=ui&preset=menu_sub')).toBe('menu_sub_1');
    expect(parseDevPreset('?mode=boss_assault&dev=ui&preset=gameover')).toBe('gameover');
    expect(parseDevPreset('?dev=ui&preset=nope')).toBeNull();
    expect(parseDevPreset('?preset=settings')).toBeNull();
    expect(parseDevPreset('')).toBeNull();
  });
});

describe('DEVUI-004 저장소 쓰기 차단', () => {
  it('guard 중 setItem/removeItem/clear 는 막히고 끝나면 원복된다', () => {
    const storage = createStorage();
    const origSet = storage.setItem;
    const { result, blocked } = withStorageWriteGuard(storage, () => {
      storage.setItem('a', '1');
      storage.removeItem('a');
      storage.clear();
      return 42;
    });
    expect(result).toBe(42);
    expect(blocked).toBe(3);
    expect(origSet).not.toHaveBeenCalled();
    expect(storage.setItem).toBe(origSet);
    storage.setItem('b', '2');
    expect(origSet).toHaveBeenCalledTimes(1);
  });

  it('예외가 나도 원복된다', () => {
    const storage = createStorage();
    const origSet = storage.setItem;
    expect(() => withStorageWriteGuard(storage, () => { throw new Error('x'); })).toThrow();
    expect(storage.setItem).toBe(origSet);
  });

  it('storage 가 없으면 그대로 실행한다', () => {
    expect(withStorageWriteGuard(null, () => 1)).toEqual({ result: 1, blocked: 0 });
  });
});

describe('DEVUI-004 실제 AppBootstrap 프리셋 적용', () => {
  let storage: ReturnType<typeof createStorage>;
  let app: AppBootstrap;
  let warn: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  let force: (s: any) => boolean;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    app = new AppBootstrap({ canvas: createMockCanvas() as any, autoStartCamera: false, preloadAssets: false });
    const token = Symbol('test-dev');
    app.stateMachine.enableDevForce(token);
    force = (s) => app.stateMachine.forceState(s, token) || app.stateMachine.currentState === s;
    storage.setItem.mockClear();
    storage.removeItem.mockClear();
    storage.clear.mockClear();
  });

  afterEach(() => {
    warn.mockRestore();
    log.mockRestore();
    vi.unstubAllGlobals();
  });

  function expectNoWrites() {
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
  }

  it('프리셋 적용 중 "허용되지 않은 전환" 경고가 없다', () => {
    for (const id of DEV_PRESET_IDS) applyDevPreset(app, id, { storage, force });
    const bad = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('허용되지 않은 전환'));
    expect(bad).toEqual([]);
  });

  it('모든 프리셋이 예외 없이 목표 상태로 진입하고 저장소 쓰기 0회', () => {
    for (const id of DEV_PRESET_IDS) {
      let res: ReturnType<typeof applyDevPreset> | undefined;
      expect(() => { res = applyDevPreset(app, id, { storage, force }); }).not.toThrow();
      expect(res!.ok, id).toBe(true);
      expect(app.stateMachine.currentState, id).toBe(getPresetTarget(id));
    }
    expectNoWrites();
  });

  it('menu_sub_1~5 는 해당 챕터 서브메뉴를 띄운다', () => {
    for (let ch = 1; ch <= 5; ch++) {
      applyDevPreset(app, `menu_sub_${ch}` as any, { storage, force });
      expect(app.stateMachine.currentState).toBe('MENU_SUB');
      expect(app.mainSceneContext.state.selectedChapter).toBe(ch);
    }
    expectNoWrites();
  });

  it('settings / locomotion_modal 은 해당 모달만 연다', () => {
    applyDevPreset(app, 'settings', { storage, force });
    expect(app.settingsModal.isOpen).toBe(true);
    expect(app.locomotionModal.isOpen).toBe(false);
    applyDevPreset(app, 'locomotion_modal', { storage, force });
    expect(app.locomotionModal.isOpen).toBe(true);
    applyDevPreset(app, 'menu_main', { storage, force });
    expect(app.locomotionModal.isOpen).toBe(false);
    expect(app.pauseModal.isOpen).toBe(false);
  });

  it('pause 는 게임 화면 위에 일시정지 모달을 연다', () => {
    applyDevPreset(app, 'pause', { storage, force });
    expect(app.pauseModal.isOpen).toBe(true);
    expect(app.mainSceneContext.state.screenMode).toBe('game');
    applyDevPreset(app, 'menu_main', { storage, force });
    expect(app.pauseModal.isOpen).toBe(false);
  });

  it('result_1~3 은 고정 데이터로 별 1~3개, 진척도/기록 저장 없음', () => {
    for (const stars of [1, 2, 3]) {
      applyDevPreset(app, `result_${stars}` as any, { storage, force });
      const data = app.resultData!;
      expect(data.victory).toBe(true);
      expect(data.totalQuestions).toBe(10);
      expect(calcStars(data.correctCount, data.totalQuestions, data.elapsedTime)).toBe(stars);
      expect(app.starsMap[1] ?? 0).toBe(0);
    }
    expectNoWrites();
  });

  it('gameover 는 고정 패배 데이터', () => {
    applyDevPreset(app, 'gameover', { storage, force });
    const data = app.resultData!;
    expect(data.victory).toBe(false);
    expect(data.correctCount).toBe(3);
    expect(data.totalQuestions).toBe(10);
    expectNoWrites();
  });

  it('공개 API 로 도달하지 못하면 force 콜백으로 보정한다', () => {
    const force = vi.fn(() => false);
    applyDevPreset(app, 'menu_main', { storage, force });
    expect(force).not.toHaveBeenCalled();
    const fake = { stateMachine: new StateMachine('MENU_MAIN') };
    const force2 = vi.fn((s: string) => { (fake.stateMachine as any)._currentState = s; return true; });
    const res = applyDevPreset(fake, 'result_3', { storage, force: force2 as any });
    expect(force2).toHaveBeenCalledWith('RESULT');
    expect(res.ok).toBe(true);
  });
});

describe('DEVUI-004 DevBootstrap 연결', () => {
  function fakeDoc() {
    const all: any[] = [];
    const mk = (tag: string) => {
      const el: any = {
        tagName: tag, id: '', textContent: '', value: '', checked: false, type: '',
        style: {} as Record<string, string>, children: [] as any[], listeners: {} as Record<string, Function>,
        appendChild(c: any) { el.children.push(c); all.push(c); return c; },
        addEventListener(ev: string, fn: Function) { el.listeners[ev] = fn; },
      };
      return el;
    };
    const body = mk('body');
    return { doc: { getElementById: (id: string) => all.find((c) => c.id === id) ?? null, createElement: mk, body }, all };
  }

  function fakeApp() {
    const stateMachine = new StateMachine('MENU_MAIN');
    const engine = { running: true, frozen: false, setFrozen: vi.fn((v: boolean) => { engine.frozen = v; }) };
    const settingsModal = { isOpen: false, open: vi.fn(() => { settingsModal.isOpen = true; }), close: vi.fn(() => { settingsModal.isOpen = false; }) };
    const goToMenu = vi.fn(() => { stateMachine.changeState('MENU_MAIN'); });
    return { stateMachine, engine, settingsModal, goToMenu };
  }

  it('?dev=ui&preset=settings 이면 프리셋 적용 후 정지한다', () => {
    const app = fakeApp();
    const { doc } = fakeDoc();
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui&preset=settings' }, { schedule: (fn) => fn() });
    expect(app.settingsModal.open).toHaveBeenCalled();
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    expect(app.engine.setFrozen).toHaveBeenLastCalledWith(true);
  });

  it('패널에 프리셋 드롭다운이 있고 change 로 적용된다', () => {
    const app = fakeApp();
    const { doc, all } = fakeDoc();
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui&freeze=0' }, { schedule: (fn) => fn() });
    const panel = all.find((e) => e.id === DEV_SCENE_JUMPER_ID);
    expect(panel).toBeTruthy();
    const selects = all.filter((e) => e.tagName === 'select');
    const presetSelect = selects.find((s) => s.children.some((o: any) => o.value === 'settings'));
    expect(presetSelect).toBeTruthy();
    presetSelect.value = 'settings';
    presetSelect.listeners.change();
    expect(app.settingsModal.open).toHaveBeenCalled();
    expect(app.engine.setFrozen).not.toHaveBeenCalledWith(true);
  });
});

describe('DEVUI-004 프로덕션 격리', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
    });
  }

  it('src/dev 밖의 모듈은 DevScenePresets 를 import 하지 않는다', () => {
    const srcDir = resolve(__dirname, '../../src');
    const offenders = walk(srcDir)
      .filter((p) => !p.includes(`${join('src', 'dev')}`))
      .filter((p) => /DevScenePresets/.test(readFileSync(p, 'utf-8')));
    expect(offenders).toEqual([]);
  });

  it('DevScenePresets 는 UIPageAdapters / 에디터 fixture 를 import 하지 않는다 (#555)', () => {
    const src = readFileSync(resolve(__dirname, '../../src/dev/DevScenePresets.ts'), 'utf-8');
    const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
    expect(imports).not.toMatch(/UIPageAdapters|ui-editor|fixture/i);
    expect(imports).not.toMatch(/AppBootstrap|SceneDirector/);
  });
});
