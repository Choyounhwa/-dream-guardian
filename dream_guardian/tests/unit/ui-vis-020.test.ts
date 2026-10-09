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
  homePageAdapter,
  MAIN_HOME_PAGE_ID,
  MAIN_HOME_BOUNDS_IDS,
  registerHomePageAdapter,
} from '../../src/editor/ui/preview/screens/UIHomePage';
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

describe('[Issue #450 / UI-VIS-020] 메인 홈 실제 렌더 페이지 연결 (UIHomePage)', () => {
  beforeEach(() => {
    // defaultPageAdapterRegistry에 main_home 어댑터가 연결되어 있는지 확인/보장
    registerHomePageAdapter(defaultPageAdapterRegistry);
  });

  describe('1. 레지스트리 연결 및 어댑터 식별', () => {
    it('MAIN_HOME_PAGE_ID 상수가 main_home으로 정의되어 있다', () => {
      expect(MAIN_HOME_PAGE_ID).toBe('main_home');
    });

    it('defaultPageAdapterRegistry에 main_home 페이지 어댑터가 등록되어 있다', () => {
      expect(hasPageAdapter('main_home')).toBe(true);
      expect(getPageAdapter('main_home')).toBe(homePageAdapter);
    });

    it('독립된 PageAdapterRegistry 인스턴스에도 격리하여 등록 및 조회가 가능하다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has('main_home')).toBe(false);
      registerHomePageAdapter(customRegistry);
      expect(customRegistry.has('main_home')).toBe(true);
      expect(customRegistry.get('main_home')).toBe(homePageAdapter);
    });
  });

  describe('2. 실제 Canvas 드로잉 및 렌더 디스패치', () => {
    it('dispatchPageRender로 main_home 호출 시 drew: true, ok: true를 반환하고 실제 캔버스 드로잉이 발생한다', () => {
      const canvas = createMockCanvas();
      const result = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
      });

      expect(result.ok).toBe(true);
      expect(result.drew).toBe(true);
      expect(result.pageId).toBe('main_home');
      expect(result.renderedElementCount).toBeGreaterThan(0);
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);

      // 실제 텍스트 및 사각형/라운드렉트 호출 여부
      const fillTextCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.length).toBeGreaterThan(0);
    });

    it('menu_main 별칭 호출 시에도 homePageAdapter가 안전하게 렌더링을 수행한다', () => {
      const customRegistry = new PageAdapterRegistry();
      customRegistry.register('menu_main', homePageAdapter);

      const canvas = createMockCanvas();
      const result = dispatchPageRender({
        canvas,
        pageId: 'menu_main',
        snapshot: {},
        registry: customRegistry,
      });

      expect(result.ok).toBe(true);
      expect(result.drew).toBe(true);
      expect(result.pageId).toBe('menu_main');
    });

    it('게임 런타임(게임 루프, AppBootstrap, SceneDirector, 카메라/오디오/TTS) 부팅 없이 순수하게 정적 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
      });
      expect(res.ok).toBe(true);
      // 글로벌 객체 오염이나 타이머 누수 없음
      expect(typeof window).toBe('undefined');
    });
  });

  describe('3. 실제 5챕터 카드, 타이틀, 운동 모드 버튼 렌더링', () => {
    it('실제 MenuRenderer와 UI_LAYOUT.menu 기하학을 따라 5개 챕터 카드와 타이틀, 운동 버튼이 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const textCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const texts = textCalls.map((c) => String(c.args[0]));

      // 기본 타이틀 및 슬로건
      expect(texts.some((t) => t.includes('꿈속 세계 탐험') || t.includes('꿈'))).toBe(true);

      // Ch.1은 해금 상태이므로 에메랄드 심해 표시
      expect(texts.some((t) => t.includes('에메랄드 심해'))).toBe(true);
      // 잠긴 챕터는 미개방 성역 / ??? / 🔒 표시
      expect(texts.some((t) => t.includes('미개방 성역') || t.includes('???') || t.includes('🔒'))).toBe(true);

      // 운동 모드 버튼 라벨 확인
      expect(texts.some((t) => t.includes('운동 모드'))).toBe(true);
    });

    it('잠금 상태(unlockedChapter)가 카드 렌더링에 반영된다 (Ch.1~2 해금 시 사탕 바구니 숲 노출)', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {
          menuState: {
            unlockedChapter: 2,
            selectedChapter: 2,
            stars: { 1: 3, 2: 1, 3: 0, 4: 0, 5: 0 },
          },
        },
      });

      expect(res.ok).toBe(true);
      const textCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const texts = textCalls.map((c) => String(c.args[0]));
      expect(texts.some((t) => t.includes('사탕 바구니 숲'))).toBe(true);

      const bounds = res.renderedBounds ?? [];
      const ch1Bounds = bounds.find((b) => b.id === 'chapter_1');
      const ch2Bounds = bounds.find((b) => b.id === 'chapter_2');
      expect(ch1Bounds).toBeDefined();
      expect(ch2Bounds).toBeDefined();
    });
  });

  describe('4. 공통 HUD 및 하단 바 합성', () => {
    it('HUD(플레이어/보스 HP, 콤보, 보스명)와 BottomBar(설정, 액션, 마나바)가 정적 합성된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds ?? [];
      const boundIds = bounds.map((b) => b.id);

      // HUD 슬롯 존재
      expect(boundIds).toContain('hud_player_hp');
      expect(boundIds).toContain('hud_boss_hp');
      expect(boundIds).toContain('hud_boss_name');

      // 하단 바 슬롯 존재
      expect(boundIds).toContain('bottom_bar');
      expect(boundIds).toContain('bottom_bar_settings');
      expect(boundIds).toContain('bottom_bar_action');
      expect(boundIds).toContain('bottom_bar_mana');
    });
  });

  describe('5. renderedBounds 목록 및 Stable ID 반환', () => {
    it('요구되는 모든 stable ID(chapter_1~5, locomotion_btn, menu_title, hud_..., bottom_bar_...)가 실제 좌표와 함께 반환된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds;
      expect(bounds).toBeDefined();
      expect(Array.isArray(bounds)).toBe(true);

      const boundMap = new Map((bounds ?? []).map((b) => [b.id, b]));

      // 5개 챕터 카드
      for (let i = 1; i <= 5; i++) {
        const id = `chapter_${i}`;
        expect(boundMap.has(id)).toBe(true);
        const b = boundMap.get(id)!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
      }

      // 메뉴 타이틀 및 운동 버튼
      expect(boundMap.has('menu_title')).toBe(true);
      expect(boundMap.has('locomotion_btn')).toBe(true);

      // HUD 바운즈
      expect(boundMap.has('hud_player_hp')).toBe(true);
      expect(boundMap.has('hud_boss_hp')).toBe(true);
      expect(boundMap.has('hud_boss_name')).toBe(true);

      // 하단바 바운즈
      expect(boundMap.has('bottom_bar')).toBe(true);
      expect(boundMap.has('bottom_bar_settings')).toBe(true);
      expect(boundMap.has('bottom_bar_action')).toBe(true);
      expect(boundMap.has('bottom_bar_mana')).toBe(true);

      // MAIN_HOME_BOUNDS_IDS 상수에 포함되어 있는지 검증
      for (const expectedId of MAIN_HOME_BOUNDS_IDS) {
        expect(boundMap.has(expectedId)).toBe(true);
      }
    });

    it('선택된 엘리먼트 ID(selectedElementIds)가 제공되면 선택 하이라이트 드로잉이 수행된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
        selectedElementIds: ['chapter_1', 'locomotion_btn'],
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      const strokeCalls = canvas.mockCtx.calls.filter((c) => c.method === 'strokeRect' || c.method === 'stroke');
      expect(strokeCalls.length).toBeGreaterThan(0);
    });
  });

  describe('6. 커스텀 UIPresentationDocument 바인딩', () => {
    it('UIPresentationDocument가 주입되면 커스텀 텍스트 및 타이틀이 렌더링에 반영된다', () => {
      const doc = createDefaultUIPresentationDocument();
      // main_home의 타이틀 텍스트 커스텀 변경
      const homePage = doc.pages.main_home;
      const titleEl = homePage.elements.find((e) => e.id === 'home_title');
      if (titleEl) {
        titleEl.text = '꿈의 수호신 스페셜 에디션';
      }

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      const textCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const texts = textCalls.map((c) => String(c.args[0]));
      expect(texts.some((t) => t.includes('꿈의 수호신 스페셜 에디션'))).toBe(true);
    });

    it('MenuPresentationContext 직접 주입 시 커스텀 챕터 및 운동 버튼 속성이 반영된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {
          context: {
            title: { text: '슈퍼 챌린지 모드' },
            locomotionBtn: { label: '스쿼트 파워' },
            chapterCards: {
              1: { title: '변형된 심해' },
            },
          },
        },
      });

      expect(res.ok).toBe(true);
      const textCalls = canvas.mockCtx.calls.filter((c) => c.method === 'fillText');
      const texts = textCalls.map((c) => String(c.args[0]));
      expect(texts.some((t) => t.includes('슈퍼 챌린지 모드'))).toBe(true);
      expect(texts.some((t) => t.includes('스쿼트 파워'))).toBe(true);
      expect(texts.some((t) => t.includes('변형된 심해'))).toBe(true);
    });
  });

  describe('7. 가드 및 에러 처리 (stale fixture, 미지원 슬롯, 잠금 영역)', () => {
    it('stale fixture(음수 clockMs 또는 stale 플래그) 전달 시 렌더를 거부한다', () => {
      const canvas = createMockCanvas();
      const resNegativeClock = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
        fixture: { clockMs: -100 },
      });
      expect(resNegativeClock.ok).toBe(false);
      expect(resNegativeClock.drew).toBe(false);
      expect(resNegativeClock.reason).toBe('stale-fixture');

      const resStaleFlag = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {},
        fixture: { clockMs: 1000, ...({ stale: true } as any) },
      });
      expect(resStaleFlag.ok).toBe(false);
      expect(resStaleFlag.drew).toBe(false);
      expect(resStaleFlag.reason).toBe('stale-fixture');
    });

    it('미지원 슬롯이나 위험한 프로토타입 키가 포함된 snapshot은 안전하게 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {
          __proto__: { corrupted: true },
          unsupportedSlot: 'invalid_foreign_slot',
        },
      });
      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toMatch(/unsupported-slot|dangerous-key|invalid-snapshot/);
    });

    it('보호 영역/잠금 영역을 침범하는 불법 슬롯 좌표는 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'main_home',
        snapshot: {
          customSlots: [
            // HUD 상단 안전 영역 침범
            { id: 'illegal_slot', bounds: { x: 50, y: 10, width: 300, height: 100 } },
          ],
        },
      });
      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toMatch(/protected-zone-violation|locked-zone-violation/);
    });

    it('지원되지 않는 페이지 ID 요청 시 unsupported-page를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'non_existent_page',
        snapshot: {},
      });
      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-page');
    });
  });
});
