/**
 * [DEVUI-001] (Issue #561) ?dev=ui 진입점 및 프로덕션 번들 격리
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDevUiEnabled, maybeStartDevUi } from '../../src/dev/DevUiGate';
import { startDevUi, DEV_UI_BADGE_ID, DEV_UI_BADGE_TEXT } from '../../src/dev/DevBootstrap';

const loc = (search: string) => ({ search });

describe('DEVUI-001 isDevUiEnabled', () => {
  it('DEV env + ?dev=ui 이면 true', () => {
    expect(isDevUiEnabled(loc('?dev=ui'), { DEV: true })).toBe(true);
    expect(isDevUiEnabled(loc('?mode=test&dev=ui'), { DEV: true })).toBe(true);
  });

  it('쿼리가 없거나 다른 값이면 false', () => {
    expect(isDevUiEnabled(loc(''), { DEV: true })).toBe(false);
    expect(isDevUiEnabled(loc('?mode=test'), { DEV: true })).toBe(false);
    expect(isDevUiEnabled(loc('?dev=other'), { DEV: true })).toBe(false);
  });

  it('프로덕션 env 이면 쿼리가 있어도 false', () => {
    expect(isDevUiEnabled(loc('?dev=ui'), { DEV: false })).toBe(false);
    expect(isDevUiEnabled(loc('?dev=ui'), {})).toBe(false);
    expect(isDevUiEnabled(loc('?dev=ui'), undefined)).toBe(false);
    expect(isDevUiEnabled(undefined, { DEV: true })).toBe(false);
  });
});

describe('DEVUI-001 maybeStartDevUi', () => {
  it('비활성 시 DevBootstrap 로더를 호출하지 않는다', async () => {
    const loader = vi.fn();
    const app = {};
    expect(await maybeStartDevUi(loc(''), { DEV: true }, app, loader)).toBe(false);
    expect(await maybeStartDevUi(loc('?dev=ui'), { DEV: false }, app, loader)).toBe(false);
    expect(loader).not.toHaveBeenCalled();
  });

  it('활성 시 로더로 동적 로드 후 startDevUi(app)를 호출한다', async () => {
    const start = vi.fn();
    const loader = vi.fn(async () => ({ startDevUi: start }));
    const app = { tag: 'app' };
    expect(await maybeStartDevUi(loc('?dev=ui'), { DEV: true }, app, loader)).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(app);
  });
});

describe('DEVUI-001 DevBootstrap badge', () => {
  function fakeDoc() {
    const children: any[] = [];
    const doc = {
      getElementById: (id: string) => children.find((c) => c.id === id) ?? null,
      createElement: (tag: string) => ({ tagName: tag, id: '', textContent: '', style: {} as Record<string, string> }),
      body: { appendChild: (el: any) => { children.push(el); return el; } },
    };
    return { doc, children };
  }

  it('좌상단에 "DEV UI" 배지를 1개만 표시한다', () => {
    const { doc, children } = fakeDoc();
    const badge = startDevUi({}, doc as unknown as Document);
    expect(children.length).toBe(1);
    expect(badge.id).toBe(DEV_UI_BADGE_ID);
    expect(badge.textContent).toBe(DEV_UI_BADGE_TEXT);
    expect(DEV_UI_BADGE_TEXT).toBe('DEV UI');
    expect(badge.style.position).toBe('fixed');
    expect(badge.style.top).toBe('0px');
    expect(badge.style.left).toBe('0px');
    startDevUi({}, doc as unknown as Document);
    expect(children.length).toBe(1);
  });
});

describe('DEVUI-001 main.ts 격리 구조', () => {
  const src = readFileSync(resolve(__dirname, '../../src/main.ts'), 'utf-8');

  it('DevBootstrap 을 정적 import 하지 않는다', () => {
    expect(src).not.toMatch(/^import[^;]*DevBootstrap/m);
  });

  it('import.meta.env.DEV 리터럴 가드 안에서 동적 import 한다', () => {
    expect(src).toContain('import.meta.env.DEV');
    expect(src).toMatch(/import\(\s*['"]\.\/dev\/DevBootstrap(\.js)?['"]\s*\)/);
  });

  it('기존 export(app, stateMachine 등)를 유지한다', () => {
    expect(src).toContain('export const app = new AppBootstrap()');
    expect(src).toContain('export const stateMachine = app.stateMachine');
    expect(src).toContain('export const sessionLifecycle = app.sessionLifecycle');
    expect(src).toContain('export const presentationAdapter = app.presentationAdapter');
  });
});
