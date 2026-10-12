/**
 * [DEVUI-002] (Issue #562) ui-layout.json 검증 후 깊은 병합(in-place) 적용
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UI_LAYOUT } from '../../config/ui.config';
import {
  applyLayoutOverride,
  loadUiLayoutOverride,
  UI_LAYOUT_OVERRIDE_URL,
} from '../../src/core/UILayoutOverride';

const SNAPSHOT = JSON.parse(JSON.stringify(UI_LAYOUT));

function restoreLayout(): void {
  // 참조를 유지한 채 기본값으로 원복 (공유 싱글턴 오염 방지)
  applyLayoutOverride(UI_LAYOUT as unknown as Record<string, unknown>, SNAPSHOT);
}

function makeTarget() {
  return {
    menu: {
      x: 0,
      w: 1080,
      title: { x: 140, y: 180, w: 800, h: 220 },
      cardWidth: 360,
      chapterCards: [
        { chapter: 1, x: 120, y: 460, w: 360, h: 380 },
        { chapter: 2, x: 600, y: 460, w: 360, h: 380 },
      ],
    },
    bottomBar: { y: 1960, h: 200, settingsBtn: { x: 30, y: 1990, w: 140, h: 140 } },
  };
}

afterEach(() => {
  restoreLayout();
  vi.restoreAllMocks();
});

describe('DEVUI-002 applyLayoutOverride: in-place 깊은 병합', () => {
  it('숫자 값을 갱신하고 하위 객체 참조는 동일(===)하게 유지한다', () => {
    const target = makeTarget();
    const menuRef = target.menu;
    const titleRef = target.menu.title;
    const cardsRef = target.menu.chapterCards;
    const card0Ref = target.menu.chapterCards[0];

    const result = applyLayoutOverride(target, {
      menu: { title: { y: 240 }, chapterCards: [{ x: 100 }] },
    });

    expect(target.menu).toBe(menuRef);
    expect(target.menu.title).toBe(titleRef);
    expect(target.menu.chapterCards).toBe(cardsRef);
    expect(target.menu.chapterCards[0]).toBe(card0Ref);
    expect(target.menu.title.y).toBe(240);
    expect(target.menu.title.x).toBe(140);
    expect(target.menu.chapterCards[0].x).toBe(100);
    expect(result.applied).toContain('menu.title.y');
    expect(result.applied).toContain('menu.chapterCards.0.x');
    expect(result.warnings).toEqual([]);
  });

  it('실제 UI_LAYOUT에서도 하위 객체 참조가 유지된다', () => {
    const bottomBarRef = UI_LAYOUT.bottomBar;
    const pauseModalRef = UI_LAYOUT.pause.modal;
    const titleRef = UI_LAYOUT.menu.title;
    applyLayoutOverride(UI_LAYOUT as unknown as Record<string, unknown>, {
      menu: { title: { y: 300 } },
      pause: { modal: { y: 800 } },
    });
    expect(UI_LAYOUT.bottomBar).toBe(bottomBarRef);
    expect(UI_LAYOUT.pause.modal).toBe(pauseModalRef);
    expect(UI_LAYOUT.menu.title).toBe(titleRef);
    expect(UI_LAYOUT.menu.title.y).toBe(300);
    expect(UI_LAYOUT.pause.modal.y).toBe(800);
  });

  it('알 수 없는 키는 해당 항목만 무시하고 경고한다', () => {
    const target = makeTarget();
    const result = applyLayoutOverride(target, {
      menu: { title: { y: 250, foo: 10 }, unknownSlot: { x: 1 } },
      zones: { 1: { x: 0.1 } },
    });
    expect(target.menu.title.y).toBe(250);
    expect((target.menu.title as Record<string, unknown>).foo).toBeUndefined();
    expect((target.menu as Record<string, unknown>).unknownSlot).toBeUndefined();
    expect((target as Record<string, unknown>).zones).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('menu.title.foo'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('menu.unknownSlot'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('zones'))).toBe(true);
  });

  it('NaN·Infinity·문자열·타입 불일치를 거부한다', () => {
    const target = makeTarget();
    const result = applyLayoutOverride(target, {
      menu: {
        x: Number.NaN,
        w: Number.POSITIVE_INFINITY,
        cardWidth: '400',
        title: 5,
        chapterCards: { 0: { x: 1 } },
      },
    });
    expect(target.menu.x).toBe(0);
    expect(target.menu.w).toBe(1080);
    expect(target.menu.cardWidth).toBe(360);
    expect(target.menu.title).toEqual({ x: 140, y: 180, w: 800, h: 220 });
    expect(target.menu.chapterCards[0].x).toBe(120);
    expect(result.applied).toEqual([]);
    expect(result.warnings.length).toBe(5);
  });

  it('음수·0 크기와 범위 밖 좌표를 거부한다 (x·w 0~1080, y·h 0~2160)', () => {
    const target = makeTarget();
    const result = applyLayoutOverride(target, {
      menu: { title: { x: -1, y: 2161, w: 0, h: -20 }, cardWidth: 1081 },
      bottomBar: { y: 2160, settingsBtn: { x: 1080, w: 1 } },
    });
    expect(target.menu.title).toEqual({ x: 140, y: 180, w: 800, h: 220 });
    expect(target.menu.cardWidth).toBe(360);
    expect(target.bottomBar.y).toBe(2160);
    expect(target.bottomBar.settingsBtn.x).toBe(1080);
    expect(target.bottomBar.settingsBtn.w).toBe(1);
    expect(result.warnings.length).toBe(5);
  });

  it('배열은 존재하는 인덱스만 허용한다', () => {
    const target = makeTarget();
    const result = applyLayoutOverride(target, {
      menu: { chapterCards: [{ y: 500 }, { y: 520 }, { y: 999 }] },
    });
    expect(target.menu.chapterCards.length).toBe(2);
    expect(target.menu.chapterCards[1].y).toBe(520);
    expect(result.warnings.some((w) => w.includes('menu.chapterCards.2'))).toBe(true);
  });

  it('__proto__·constructor·prototype 키를 거부하고 프로토타입을 오염시키지 않는다', () => {
    const target = makeTarget();
    const patch = JSON.parse(
      '{"__proto__":{"polluted":1},"menu":{"constructor":{"x":1},"title":{"__proto__":{"y":5},"prototype":{"y":1}}}}',
    );
    const result = applyLayoutOverride(target, patch);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    expect(target.menu.title.y).toBe(180);
    expect(result.applied).toEqual([]);
    expect(result.warnings.length).toBe(4);
  });

  it('patch 루트가 객체가 아니면 전체를 무시한다', () => {
    const target = makeTarget();
    for (const bad of [null, 5, 'x', [1, 2]]) {
      const r = applyLayoutOverride(target, bad);
      expect(r.applied).toEqual([]);
      expect(r.warnings.length).toBe(1);
    }
    expect(target).toEqual(makeTarget());
  });
});

describe('DEVUI-002 loadUiLayoutOverride: 부팅 시 로드', () => {
  const fakeResponse = (status: number, body: string, contentType = 'application/json') => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  });

  it('기본 URL은 /layouts/ui-layout.json 이다', () => {
    expect(UI_LAYOUT_OVERRIDE_URL).toBe('/layouts/ui-layout.json');
  });

  it('메뉴 타이틀 y 변경 예시 JSON이 반영된다', async () => {
    const fetchFn = vi.fn(async () => fakeResponse(200, '{"menu":{"title":{"y":260}}}'));
    const titleRef = UI_LAYOUT.menu.title;
    const r = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith(UI_LAYOUT_OVERRIDE_URL, expect.anything());
    expect(r.status).toBe('applied');
    expect(UI_LAYOUT.menu.title).toBe(titleRef);
    expect(UI_LAYOUT.menu.title.y).toBe(260);
  });

  it('404면 기본값을 유지한다 (파일 없음)', async () => {
    const fetchFn = vi.fn(async () => fakeResponse(404, 'not found', 'text/plain'));
    const r = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(r.status).toBe('missing');
    expect(UI_LAYOUT).toEqual(SNAPSHOT);
  });

  it('SPA 폴백 HTML 응답은 파일 없음으로 처리한다', async () => {
    const fetchFn = vi.fn(async () => fakeResponse(200, '<!doctype html><html></html>', 'text/html'));
    const r = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(r.status).toBe('missing');
    expect(UI_LAYOUT).toEqual(SNAPSHOT);
  });

  it('네트워크 실패 시 예외 없이 기본값을 유지한다', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network');
    });
    const r = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(r.status).toBe('failed');
    expect(UI_LAYOUT).toEqual(SNAPSHOT);
  });

  it('깨진 JSON이면 전체를 무시한다', async () => {
    const fetchFn = vi.fn(async () => fakeResponse(200, '{"menu":{"title":{"y":260}'));
    const r = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(r.status).toBe('invalid');
    expect(UI_LAYOUT).toEqual(SNAPSHOT);
  });

  it('일부 잘못된 항목이 있으면 유효한 항목만 적용하고 경고를 반환한다', async () => {
    const fetchFn = vi.fn(async () =>
      fakeResponse(200, '{"menu":{"title":{"y":260,"x":-5}},"hud":{"bogus":1}}'),
    );
    const r = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(r.status).toBe('applied');
    expect(UI_LAYOUT.menu.title.y).toBe(260);
    expect(UI_LAYOUT.menu.title.x).toBe(140);
    expect(r.warnings.length).toBe(2);
  });

  it('fetch가 없으면 건너뛴다', async () => {
    const r = await loadUiLayoutOverride(undefined);
    expect(r.status).toBe('missing');
    expect(UI_LAYOUT).toEqual(SNAPSHOT);
  });
});

describe('DEVUI-002 AppBootstrap 연동 (정적 검사)', () => {
  const src = readFileSync(resolve(__dirname, '../../src/core/AppBootstrap.ts'), 'utf8');

  it('init()에서 loadUiLayoutOverride를 호출한다', () => {
    expect(src).toMatch(/import\s*\{[^}]*loadUiLayoutOverride[^}]*\}\s*from\s*'\.\/UILayoutOverride\.js'/);
    const initIdx = src.indexOf('public async init(): Promise<void>');
    expect(initIdx).toBeGreaterThan(0);
    expect(src.indexOf('loadUiLayoutOverride(', initIdx)).toBeGreaterThan(initIdx);
  });

  it('top-level await를 사용하지 않는다', () => {
    expect(src).not.toMatch(/^await\s/m);
  });
});
