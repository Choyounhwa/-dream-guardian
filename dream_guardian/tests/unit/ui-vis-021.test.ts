import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  dispatchPageRender,
  defaultPageAdapterRegistry,
  PageAdapterRegistry,
  hasPageAdapter,
  getPageAdapter,
} from '../../src/editor/ui/preview/UIPageAdapters';
import {
  submenuPageAdapter,
  SUBMENU_PAGE_ID,
  MENU_SUB_PAGE_ID,
  SUBMENU_BOUNDS_IDS,
  DEFAULT_SUBMENU_SUBLEVELS,
  registerSubmenuPageAdapter,
} from '../../src/editor/ui/preview/screens/UISubmenuPage';
import { MenuRenderer } from '../../src/ui/MenuRenderer';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation';

function createMockCtx(): CanvasRenderingContext2D & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] })
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] })
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] })
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] })
    ),
    clearRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'clearRect', args: [x, y, w, h] })
    ),
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] })
    ),
    strokeText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y] })
    ),
    measureText: vi.fn().mockReturnValue({ width: 60 }),
    drawImage: vi.fn((img: any, ...args: number[]) =>
      calls.push({ method: 'drawImage', args: [img, ...args] })
    ),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    setLineDash: vi.fn(),
    getLineDash: vi.fn().mockReturnValue([]),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & { calls: { method: string; args: unknown[] }[] };
}

function createMockCanvas(): HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> } {
  const ctx = createMockCtx();
  return {
    clientWidth: ARTBOARD_WIDTH,
    clientHeight: ARTBOARD_HEIGHT,
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    style: {},
    getContext: vi.fn((type: string) => (type === '2d' ? ctx : null)),
    mockCtx: ctx,
  } as unknown as HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> };
}

describe('[Issue #451 / UI-VIS-021] 서브메뉴 실제 렌더 페이지 연결 (UISubmenuPage)', () => {
  beforeEach(() => {
    // defaultPageAdapterRegistry에 submenu 어댑터가 연결되어 있는지 확인/보장
    registerSubmenuPageAdapter(defaultPageAdapterRegistry);
  });

  describe('1. 레지스트리 연결 및 어댑터 식별', () => {
    it('SUBMENU_PAGE_ID 및 MENU_SUB_PAGE_ID, DEFAULT_SUBMENU_SUBLEVELS 상수가 올바르게 정의되어 있다', () => {
      expect(SUBMENU_PAGE_ID).toBe('submenu');
      expect(MENU_SUB_PAGE_ID).toBe('menu_sub');
      expect(DEFAULT_SUBMENU_SUBLEVELS.length).toBeGreaterThan(0);
    });

    it('defaultPageAdapterRegistry에 submenu 및 menu_sub 페이지로 어댑터가 등록되어 있다', () => {
      expect(hasPageAdapter('submenu')).toBe(true);
      expect(hasPageAdapter('menu_sub')).toBe(true);

      const adapterSubmenu = getPageAdapter('submenu');
      const adapterMenuSub = getPageAdapter('menu_sub');
      expect(adapterSubmenu).toBeDefined();
      expect(adapterMenuSub).toBeDefined();
      expect(adapterSubmenu).toBe(adapterMenuSub);
      expect(adapterSubmenu).toBe(submenuPageAdapter);
    });

    it('새로운 PageAdapterRegistry 인스턴스에도 registerSubmenuPageAdapter로 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has('submenu')).toBe(false);

      registerSubmenuPageAdapter(customRegistry);
      expect(customRegistry.has('submenu')).toBe(true);
      expect(customRegistry.has('menu_sub')).toBe(true);
      expect(customRegistry.get('submenu')).toBe(submenuPageAdapter);
    });

    it('지원하지 않는 pageId 호출 시 { ok: false, drew: false, reason: "unsupported-page" }를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'non_existent_page' as any,
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-page');
    });
  });

  describe('2. Stale Fixture 및 Revision 차단', () => {
    it('fixture의 clockMs가 음수 또는 NaN이면 stale-fixture로 렌더를 거부한다', () => {
      const canvas = createMockCanvas();

      const res1 = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
        fixture: { clockMs: -1 },
      });
      expect(res1.ok).toBe(false);
      expect(res1.drew).toBe(false);
      expect(res1.reason).toBe('stale-fixture');

      const res2 = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
        fixture: { clockMs: Number.NaN },
      });
      expect(res2.ok).toBe(false);
      expect(res2.drew).toBe(false);
      expect(res2.reason).toBe('stale-fixture');

      const resStaleFlag = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
        fixture: { clockMs: 1000, ...({ stale: true } as any) },
      });
      expect(resStaleFlag.ok).toBe(false);
      expect(resStaleFlag.drew).toBe(false);
      expect(resStaleFlag.reason).toBe('stale-fixture');
    });

    it('stale 플래그가 설정된 스냅샷은 stale-revision으로 렌더를 거부한다', () => {
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: { stale: true },
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('보호 영역(상단 HUD 구역 0..120)을 침범하는 요소가 스냅샷에 정의된 경우 렌더를 거부한다', () => {
      const canvas = createMockCanvas();

      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.submenu = {
        pageId: 'submenu',
        elements: [
          {
            id: 'illegal_btn',
            name: '불법 버튼',
            type: 'button',
            bounds: { x: 100, y: 50, width: 200, height: 100 },
          },
        ],
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });
  });

  describe('3. 실제 MenuRenderer 재사용 및 가변 서브레벨 렌더링', () => {
    it('MenuRenderer.prototype.renderSubMenu가 호출되어 실제 서브메뉴 그리드를 그린다', () => {
      const renderSubMenuSpy = vi.spyOn(MenuRenderer.prototype, 'renderSubMenu');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(renderSubMenuSpy).toHaveBeenCalled();
      renderSubMenuSpy.mockRestore();
    });

    it('임의 6개 고정이 아닌 fixture의 가변 서브레벨(3개, 5개 등) 목록을 정확히 렌더링한다', () => {
      const canvas = createMockCanvas();

      // 3개 서브레벨 fixture (+ 1개 ALL 종합 = 총 4개 카드)
      const subLevels3 = [
        { subLevel: 1, title: '분수 기초', count: 8 },
        { subLevel: 2, title: '진분수와 가분수', count: 12 },
        { subLevel: 3, title: '대분수 변환', count: 10 },
      ];

      const res3 = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {
          chapter: 3,
          subLevels: subLevels3,
        },
      });

      expect(res3.ok).toBe(true);
      const bounds3 = res3.renderedBounds ?? [];
      const cardBounds3 = bounds3.filter((b) => b.id.startsWith('sub_card_'));
      expect(cardBounds3).toHaveLength(4); // 3개 서브레벨 + 1개 ALL

      // 5개 서브레벨 fixture (+ 1개 ALL = 총 6개 카드)
      const subLevels5 = [
        { subLevel: 1, title: '소수 기초', count: 8 },
        { subLevel: 2, title: '소수의 덧셈', count: 10 },
        { subLevel: 3, title: '소수의 뺄셈', count: 10 },
        { subLevel: 4, title: '소수와 자연수', count: 10 },
        { subLevel: 5, title: '소수의 곱셈', count: 12 },
      ];

      const res5 = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {
          chapter: 4,
          subLevels: subLevels5,
        },
      });

      expect(res5.ok).toBe(true);
      const bounds5 = res5.renderedBounds ?? [];
      const cardBounds5 = bounds5.filter((b) => b.id.startsWith('sub_card_'));
      expect(cardBounds5).toHaveLength(6); // 5개 서브레벨 + 1개 ALL
    });

    it('챕터별 서로 다른 테마 정보(Ch.2 사탕 바구니 숲) 및 커스텀 텍스트가 반영된다', () => {
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {
          chapter: 2,
        },
      });

      expect(res.ok).toBe(true);
      const textCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const texts = textCalls.map((c) => String(c.args[0]));
      // Ch.2 테마명 '사탕 바구니 숲' 텍스트 포함 확인
      expect(texts.some((t) => t.includes('사탕 바구니 숲'))).toBe(true);
    });

    it('presentation document 커스텀 스타일 및 텍스트 오버라이드가 렌더링에 적용된다', () => {
      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();
      doc.pages.submenu = {
        pageId: 'submenu',
        elements: [
          {
            id: 'sub_title',
            name: '서브메뉴 타이틀',
            type: 'text',
            bounds: { x: 100, y: 150, width: 880, height: 200 },
            text: '★ 특별 서브메뉴 커스텀 타이틀 ★',
          },
          {
            id: 'back_btn',
            name: '뒤로가기 버튼',
            type: 'button',
            actionId: 'close_submenu',
            bounds: { x: 750, y: 1980, width: 300, height: 150 },
            text: '나가기',
          },
        ],
      };

      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      const textCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const texts = textCalls.map((c) => String(c.args[0]));
      expect(texts.some((t) => t.includes('특별 서브메뉴 커스텀 타이틀'))).toBe(true);

      const bounds = res.renderedBounds ?? [];
      const titleBound = bounds.find((b) => b.id === 'sub_title');
      expect(titleBound).toBeDefined();
      expect(titleBound?.x).toBe(100);
      expect(titleBound?.y).toBe(150);
      expect(titleBound?.width).toBe(880);
      expect(titleBound?.height).toBe(200);
    });
  });

  describe('4. 공통 HUD 및 하단 바 합성', () => {
    it('HUD(플레이어/보스 HP, 콤보, 보스명)와 BottomBar(뒤로/액션, 설정, 마나바)가 정적 합성된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds ?? [];
      const boundIds = bounds.map((b) => b.id);

      // HUD 슬롯 존재
      expect(boundIds).toContain('hud_player_hp');
      expect(boundIds).toContain('hud_boss_hp');
      expect(boundIds).toContain('hud_boss_name');
      expect(boundIds).toContain('hud_combo');

      // 하단 바 슬롯 및 뒤로가기 버튼 존재
      expect(boundIds).toContain('bottom_bar');
      expect(boundIds).toContain('bottom_bar_settings');
      expect(boundIds).toContain('bottom_bar_action');
      expect(boundIds).toContain('bottom_bar_mana');
      expect(boundIds).toContain('menu_sub_back');
    });

    it('게임 루프, 카메라, TTS 등의 런타임 객체에 일체 접근하거나 호출하지 않는다', () => {
      const canvas = createMockCanvas();

      // window 전역에 런타임 스파이 확인
      const g = globalThis as any;
      const originalRequestAnimationFrame = g.requestAnimationFrame;
      const rafSpy = vi.fn();
      g.requestAnimationFrame = rafSpy;

      try {
        const res = dispatchPageRender({
          canvas,
          pageId: 'submenu',
          snapshot: {},
        });

        expect(res.ok).toBe(true);
        expect(rafSpy).not.toHaveBeenCalled();
      } finally {
        g.requestAnimationFrame = originalRequestAnimationFrame;
      }
    });
  });

  describe('5. renderedBounds 목록 및 Stable ID 반환', () => {
    it('모든 요구되는 stable ID(sub_title, sub_card_0..N, menu_sub_back, bottom_bar_back, hud_..., bottom_bar_...)가 실제 좌표와 함께 반환된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds;
      expect(bounds).toBeDefined();
      expect(Array.isArray(bounds)).toBe(true);

      const boundMap = new Map((bounds ?? []).map((b) => [b.id, b]));

      // 서브 타이틀
      expect(boundMap.has('sub_title')).toBe(true);
      const title = boundMap.get('sub_title')!;
      expect(title.x).toBeGreaterThanOrEqual(0);
      expect(title.y).toBeGreaterThanOrEqual(0);
      expect(title.width).toBeGreaterThan(0);
      expect(title.height).toBeGreaterThan(0);

      // 기본 서브레벨 카드 (DEFAULT_SUBMENU_SUBLEVELS 5개 + ALL 1개 = 6개: sub_card_0 ~ sub_card_5)
      for (let i = 0; i < 6; i++) {
        const id = `sub_card_${i}`;
        expect(boundMap.has(id)).toBe(true);
        const card = boundMap.get(id)!;
        expect(card.x).toBeGreaterThanOrEqual(0);
        expect(card.y).toBeGreaterThanOrEqual(0);
        expect(card.width).toBeGreaterThan(0);
        expect(card.height).toBeGreaterThan(0);
      }

      // 뒤로가기 버튼 (menu_sub_back 및 bottom_bar_back)
      expect(boundMap.has('menu_sub_back')).toBe(true);
      expect(boundMap.has('bottom_bar_back')).toBe(true);
      const backBtn = boundMap.get('menu_sub_back')!;
      expect(backBtn.x).toBeGreaterThanOrEqual(0);
      expect(backBtn.y).toBeGreaterThanOrEqual(0);
      expect(backBtn.width).toBeGreaterThan(0);
      expect(backBtn.height).toBeGreaterThan(0);

      // HUD 바운즈
      expect(boundMap.has('hud_player_hp')).toBe(true);
      expect(boundMap.has('hud_boss_hp')).toBe(true);
      expect(boundMap.has('hud_boss_name')).toBe(true);
      expect(boundMap.has('hud_combo')).toBe(true);

      // 하단 바 바운즈
      expect(boundMap.has('bottom_bar')).toBe(true);
      expect(boundMap.has('bottom_bar_settings')).toBe(true);
      expect(boundMap.has('bottom_bar_action')).toBe(true);
      expect(boundMap.has('bottom_bar_mana')).toBe(true);
    });

    it('SUBMENU_BOUNDS_IDS 상수에 정의된 핵심 ID들이 기본 바운즈에 포함된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const boundIds = new Set((res.renderedBounds ?? []).map((b) => b.id));

      for (const requiredId of SUBMENU_BOUNDS_IDS) {
        expect(boundIds.has(requiredId)).toBe(true);
      }
    });
  });

  describe('6. 명령 spy로 가짜 사각형 방지 및 실제 그리기 검증', () => {
    it('가짜 사각형 플레이스홀더가 아닌 실제 텍스트 및 라운드 렉트 드로잉 호출이 발생한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'submenu',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);

      const calls = canvas.mockCtx.calls;
      const fillTextCalls = calls.filter((c) => c.method === 'fillText');
      const strokeCalls = calls.filter((c) => c.method === 'stroke');
      const fillCalls = calls.filter((c) => c.method === 'fill');

      expect(fillTextCalls.length).toBeGreaterThan(5);
      expect(strokeCalls.length).toBeGreaterThan(0);
      expect(fillCalls.length).toBeGreaterThan(0);
    });
  });

  describe('7. dispatchPageRender 통합 및 상태 잔류 격리', () => {
    it('menu_sub 별칭 pageId로 dispatchPageRender를 호출해도 동일하게 정상 렌더된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'menu_sub',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('menu_sub');
      expect(res.renderedBounds).toBeDefined();
    });

    it('연속 렌더 시 이전 스냅샷의 데이터나 선택 상태가 후속 렌더에 누출/잔류하지 않는다 (멱등성)', () => {
      const canvas1 = createMockCanvas();
      const canvas2 = createMockCanvas();

      // 첫 번째 렌더: 3개 서브레벨
      const res1 = dispatchPageRender({
        canvas: canvas1,
        pageId: 'submenu',
        snapshot: {
          subLevels: [
            { subLevel: 1, title: '단계 A', count: 5 },
            { subLevel: 2, title: '단계 B', count: 5 },
          ],
        },
      });

      // 두 번째 렌더: 기본 서브레벨
      const res2 = dispatchPageRender({
        canvas: canvas2,
        pageId: 'submenu',
        snapshot: {},
      });

      const cards1 = (res1.renderedBounds ?? []).filter((b) => b.id.startsWith('sub_card_'));
      const cards2 = (res2.renderedBounds ?? []).filter((b) => b.id.startsWith('sub_card_'));

      expect(cards1.length).toBe(3); // 2 + 1 ALL
      expect(cards2.length).toBe(6); // 5 + 1 ALL
    });
  });
});
