/**
 * [DEVUI-003] (Issue #563) 개발 모드 화면 강제 이동(Scene Jump) 및 시간 정지(Freeze)
 *
 * 3파일 제한으로 DevSceneJumper 기능은 동적 import 진입점인 DevBootstrap.ts 안에 둔다.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { StateMachine } from '../../src/core/StateMachine';
import { GameEngine } from '../../src/core/GameEngine';
import {
  parseDevScreen,
  shouldAutoFreeze,
  jumpToScreen,
  startDevUi,
  DEV_SCENE_JUMPER_ID,
} from '../../src/dev/DevBootstrap';

describe('DEVUI-003 StateMachine.forceState', () => {
  it('토큰 없이 호출하면 예외로 거부한다', () => {
    const sm = new StateMachine('MENU_MAIN');
    expect(() => sm.forceState('RESULT', undefined as unknown as symbol)).toThrow();
    expect(sm.currentState).toBe('MENU_MAIN');
  });

  it('등록되지 않은 토큰이면 거부한다', () => {
    const sm = new StateMachine('MENU_MAIN');
    sm.enableDevForce(Symbol('a'));
    expect(() => sm.forceState('RESULT', Symbol('b'))).toThrow();
    expect(sm.currentState).toBe('MENU_MAIN');
  });

  it('토큰은 한 번만 등록된다 (다른 토큰 재등록 불가)', () => {
    const sm = new StateMachine('MENU_MAIN');
    const t1 = Symbol('t1');
    sm.enableDevForce(t1);
    expect(() => sm.enableDevForce(Symbol('t2'))).toThrow();
    expect(() => sm.enableDevForce(t1)).not.toThrow();
  });

  it('등록된 토큰이면 전환 테이블을 우회하고 exit/onTransition/enter 를 호출한다', () => {
    const sm = new StateMachine('MENU_MAIN');
    const calls: string[] = [];
    sm.registerState('MENU_MAIN', { exit: () => calls.push('exit:MENU_MAIN') });
    sm.registerState('BOSS_CLIMAX', { enter: () => calls.push('enter:BOSS_CLIMAX') });
    sm.onTransition((f, t) => calls.push(`tr:${f}->${t}`));
    const token = Symbol('dev');
    sm.enableDevForce(token);
    expect(sm.canTransition('BOSS_CLIMAX')).toBe(false);
    expect(sm.forceState('BOSS_CLIMAX', token)).toBe(true);
    expect(sm.currentState).toBe('BOSS_CLIMAX');
    expect(sm.previousState).toBe('MENU_MAIN');
    expect(calls).toEqual(['exit:MENU_MAIN', 'tr:MENU_MAIN->BOSS_CLIMAX', 'enter:BOSS_CLIMAX']);
  });

  it('같은 상태로의 강제 전환은 false', () => {
    const sm = new StateMachine('MENU_MAIN');
    const token = Symbol('dev');
    sm.enableDevForce(token);
    expect(sm.forceState('MENU_MAIN', token)).toBe(false);
  });

  it('일반 changeState 검증은 그대로 유지된다', () => {
    const sm = new StateMachine('MENU_MAIN');
    sm.enableDevForce(Symbol('dev'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(sm.changeState('BOSS_CLIMAX')).toBe(false);
    expect(sm.currentState).toBe('MENU_MAIN');
    expect(sm.changeState('MENU_SUB')).toBe(true);
    warn.mockRestore();
  });
});

describe('DEVUI-003 GameEngine.setFrozen', () => {
  function makeEngine() {
    let pending: FrameRequestCallback | null = null;
    const update = vi.fn();
    const render = vi.fn();
    const engine = new GameEngine(
      { update, render },
      { requestFrame: (cb) => { pending = cb; return 1; }, cancelFrame: () => {} },
    );
    const frame = (ts: number) => { const cb = pending; pending = null; cb?.(ts); };
    return { engine, update, render, frame };
  }

  it('기본값은 frozen=false', () => {
    expect(makeEngine().engine.frozen).toBe(false);
  });

  it('frozen 이면 update 는 호출되지 않고 render 는 호출된다', () => {
    const { engine, update, render, frame } = makeEngine();
    engine.start();
    frame(0);
    frame(16);
    expect(update).toHaveBeenCalledTimes(1);
    const elapsed = engine.elapsedTime;

    engine.setFrozen(true);
    expect(engine.frozen).toBe(true);
    update.mockClear();
    render.mockClear();
    frame(32);
    frame(48);
    expect(update).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(2);
    expect(engine.elapsedTime).toBe(elapsed);

    engine.setFrozen(false);
    frame(64);
    expect(update).toHaveBeenCalledTimes(1);
    // 해제 직후 델타 스파이크 없음 (최대 1프레임 분량)
    expect(update.mock.calls[0][0]).toBeLessThanOrEqual(0.2);
  });

  it('pause/resume 동작은 그대로 유지된다', () => {
    const { engine, update, render, frame } = makeEngine();
    engine.start();
    frame(0);
    engine.pause();
    frame(16);
    expect(update).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
    engine.resume();
    frame(32);
    frame(48);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('DEVUI-003 URL screen 파라미터 → 상태 매핑', () => {
  it('?dev=ui&screen=<id> 를 GameState 로 매핑한다', () => {
    expect(parseDevScreen('?dev=ui&screen=menu_sub')).toBe('MENU_SUB');
    expect(parseDevScreen('?dev=ui&screen=menu_main')).toBe('MENU_MAIN');
    expect(parseDevScreen('?dev=ui&screen=result')).toBe('RESULT');
    expect(parseDevScreen('?dev=ui&screen=BOSS_CLIMAX')).toBe('BOSS_CLIMAX');
    expect(parseDevScreen('?screen=answer_select&dev=ui')).toBe('ANSWER_SELECT');
  });

  it('알 수 없는 screen, 빈 값, dev=ui 없음이면 null', () => {
    expect(parseDevScreen('?dev=ui&screen=nope')).toBeNull();
    expect(parseDevScreen('?dev=ui&screen=')).toBeNull();
    expect(parseDevScreen('?dev=ui')).toBeNull();
    expect(parseDevScreen('?screen=menu_sub')).toBeNull();
    expect(parseDevScreen('')).toBeNull();
  });

  it('?mode=boss_assault 와 함께 쓰여도 충돌하지 않는다 (결합 규칙 고정)', () => {
    // mode 파라미터는 screen 매핑에 영향을 주지 않는다.
    expect(parseDevScreen('?mode=boss_assault&dev=ui&screen=menu_sub')).toBe('MENU_SUB');
    expect(parseDevScreen('?dev=ui&screen=result&mode=boss_assault')).toBe('RESULT');
    // dev=ui 없이 mode 만 있으면 화면 강제 이동은 일어나지 않는다.
    expect(parseDevScreen('?mode=boss_assault&screen=menu_sub')).toBeNull();
    // 상태가 추가되면 자동으로 매핑된다 (Issue #523: ASSAULT_ROUND 추가).
    expect(parseDevScreen('?mode=boss_assault&dev=ui&screen=assault_round')).toBe('ASSAULT_ROUND');
  });

  it('자동 freeze 는 기본 on, ?freeze=0 이면 off', () => {
    expect(shouldAutoFreeze('?dev=ui&screen=menu_sub')).toBe(true);
    expect(shouldAutoFreeze('?dev=ui&screen=menu_sub&freeze=0')).toBe(false);
    expect(shouldAutoFreeze('?dev=ui&screen=menu_sub&freeze=1')).toBe(true);
  });
});

function fakeApp(initial: 'MENU_MAIN' = 'MENU_MAIN') {
  const stateMachine = new StateMachine(initial);
  const engine = { running: true, frozen: false, setFrozen: vi.fn(function (this: any, v: boolean) { engine.frozen = v; }) };
  return { stateMachine, engine };
}

describe('DEVUI-003 jumpToScreen', () => {
  it('강제 전환 후 autoFreeze 면 freeze 를 예약/적용한다', () => {
    const app = fakeApp();
    const ok = jumpToScreen(app, 'MENU_SUB', { autoFreeze: true, scheduleFreeze: (fn) => fn() });
    expect(ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('MENU_SUB');
    expect(app.engine.setFrozen).toHaveBeenCalledWith(true);
  });

  it('전환 테이블에 없는 전환도 가능하다 (MENU_MAIN → RESULT)', () => {
    const app = fakeApp();
    expect(jumpToScreen(app, 'RESULT', { autoFreeze: false })).toBe(true);
    expect(app.stateMachine.currentState).toBe('RESULT');
    expect(app.engine.setFrozen).not.toHaveBeenCalledWith(true);
  });

  it('점프 전 freeze 를 해제해 새 화면이 한 번은 갱신되게 한다', () => {
    const app = fakeApp();
    app.engine.frozen = true;
    jumpToScreen(app, 'MENU_SUB', { autoFreeze: false });
    expect(app.engine.setFrozen).toHaveBeenCalledWith(false);
  });

  it('stateMachine 이 없는 app 이면 false', () => {
    expect(jumpToScreen({}, 'MENU_SUB', { autoFreeze: false })).toBe(false);
  });
});

describe('DEVUI-003 startDevUi 연결', () => {
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
    const doc = {
      getElementById: (id: string) => all.find((c) => c.id === id) ?? null,
      createElement: mk,
      body,
    };
    return { doc, body, all };
  }

  it('?dev=ui&screen=menu_sub 이면 MENU_SUB 로 이동하고 정지한다', () => {
    const app = fakeApp();
    const { doc } = fakeDoc();
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui&screen=menu_sub' }, { schedule: (fn) => fn() });
    expect(app.stateMachine.currentState).toBe('MENU_SUB');
    expect(app.engine.setFrozen).toHaveBeenLastCalledWith(true);
  });

  it('상태 드롭다운 패널을 1개만 만들고 change 로 이동한다', () => {
    const app = fakeApp();
    const { doc, all } = fakeDoc();
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui' }, { schedule: (fn) => fn() });
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui' }, { schedule: (fn) => fn() });
    const panels = all.filter((e) => e.id === DEV_SCENE_JUMPER_ID);
    expect(panels.length).toBe(1);
    const select = all.find((e) => e.tagName === 'select');
    expect(select).toBeTruthy();
    const options = all.filter((e) => e.tagName === 'option').map((o) => o.value);
    expect(options).toContain('MENU_SUB');
    expect(options).toContain('RESULT');
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    select.value = 'RESULT';
    select.listeners.change();
    expect(app.stateMachine.currentState).toBe('RESULT');
  });

  it('freeze 체크박스로 정지/해제한다', () => {
    const app = fakeApp();
    const { doc, all } = fakeDoc();
    startDevUi(app, doc as unknown as Document, { search: '?dev=ui' }, { schedule: (fn) => fn() });
    const box = all.find((e) => e.tagName === 'input' && e.type === 'checkbox');
    box.checked = true;
    box.listeners.change();
    expect(app.engine.setFrozen).toHaveBeenLastCalledWith(true);
    box.checked = false;
    box.listeners.change();
    expect(app.engine.setFrozen).toHaveBeenLastCalledWith(false);
  });

  it('stateMachine 이 없는 app 이면 배지만 표시한다 (DEVUI-001 호환)', () => {
    const { doc, all } = fakeDoc();
    const badge = startDevUi({}, doc as unknown as Document, { search: '?dev=ui&screen=menu_sub' });
    expect(badge.textContent).toBe('DEV UI');
    expect(all.some((e) => e.id === DEV_SCENE_JUMPER_ID)).toBe(false);
  });
});

describe('DEVUI-003 프로덕션 격리', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
    });
  }

  it('src/dev 밖의 모듈은 DevBootstrap 을 정적 import 하지 않는다', () => {
    const srcDir = resolve(__dirname, '../../src');
    const offenders = walk(srcDir)
      .filter((p) => !p.includes(`${join('src', 'dev')}`))
      .filter((p) => /^import[^;]*DevBootstrap/m.test(readFileSync(p, 'utf-8')));
    expect(offenders).toEqual([]);
  });
});
