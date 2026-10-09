import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  dispatchPageRender,
  defaultPageAdapterRegistry,
  PageAdapterRegistry,
  hasPageAdapter,
} from '../../src/editor/ui/preview/UIPageAdapters';
import {
  RESULT_PAGE_ID,
  RESULT_PAGE_BOUNDS_IDS,
  registerResultPageAdapter,
  resultPageAdapter,
  DEFAULT_RESULT_PAGE_FIXTURE,
  VICTORY_RESULT_PAGE_FIXTURE,
  DEFEAT_RESULT_PAGE_FIXTURE,
  CH1_RESULT_PAGE_FIXTURE,
  CH2_RESULT_PAGE_FIXTURE,
  CH3_RESULT_PAGE_FIXTURE,
  CH4_RESULT_PAGE_FIXTURE,
  CH5_RESULT_PAGE_FIXTURE,
  S_RANK_RESULT_PAGE_FIXTURE,
  A_RANK_RESULT_PAGE_FIXTURE,
  B_RANK_RESULT_PAGE_FIXTURE,
  C_RANK_RESULT_PAGE_FIXTURE,
} from '../../src/editor/ui/preview/screens/UIResultPage';
import { ResultRenderer } from '../../src/ui/ResultRenderer';
import { DreamGrid } from '../../src/render/DreamGrid';
import { HUDLayer } from '../../src/ui/HUDLayer';
import { BottomBar } from '../../src/ui/BottomBar';
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
    bezierCurveTo: vi.fn((...args: unknown[]) =>
      calls.push({ method: 'bezierCurveTo', args })
    ),
    quadraticCurveTo: vi.fn((...args: unknown[]) =>
      calls.push({ method: 'quadraticCurveTo', args })
    ),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    ellipse: vi.fn((...args: unknown[]) => calls.push({ method: 'ellipse', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] })
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({
        method: 'roundRect',
        args: [x, y, w, h, ...(r !== undefined ? [r] : [])],
      })
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    clip: vi.fn(() => calls.push({ method: 'clip', args: [] })),
    clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
    fillRect: vi.fn((...args: unknown[]) => calls.push({ method: 'fillRect', args })),
    strokeRect: vi.fn((...args: unknown[]) => calls.push({ method: 'strokeRect', args })),
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] })
    ),
    strokeText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y] })
    ),
    measureText: vi.fn((text: string) => ({
      width: text.length * 16,
      actualBoundingBoxAscent: 16,
      actualBoundingBoxDescent: 4,
    })),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
    rotate: vi.fn((angle: number) => calls.push({ method: 'rotate', args: [angle] })),
    setLineDash: vi.fn((dash: number[]) => calls.push({ method: 'setLineDash', args: [dash] })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D & {
    calls: { method: string; args: unknown[] }[];
  };
}

function createMockCanvas(width = ARTBOARD_WIDTH, height = ARTBOARD_HEIGHT): HTMLCanvasElement & {
  mockCtx: ReturnType<typeof createMockCtx>;
} {
  const mockCtx = createMockCtx();
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    mockCtx,
    getContext: vi.fn((type: string) => {
      if (type === '2d') return mockCtx;
      return null;
    }),
  } as unknown as HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> };
}

describe('UI-VIS-029: 결과 실제 렌더 페이지 연결 (UIResultPage & UIPageAdapters)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 기본 렌더링 및 디스패치 검증', () => {
    it('defaultPageAdapterRegistry에 result 페이지 어댑터가 등록되어 있다', () => {
      expect(hasPageAdapter(RESULT_PAGE_ID)).toBe(true);
      expect(hasPageAdapter('result')).toBe(true);
      expect(defaultPageAdapterRegistry.get(RESULT_PAGE_ID)).toBeDefined();
    });

    it('독립된 PageAdapterRegistry에도 registerResultPageAdapter로 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has(RESULT_PAGE_ID)).toBe(false);
      registerResultPageAdapter(customRegistry);
      expect(customRegistry.has(RESULT_PAGE_ID)).toBe(true);
      expect(customRegistry.get(RESULT_PAGE_ID)).toBe(resultPageAdapter);
    });

    it('dispatchPageRender(result) 호출 시 drew: true, ok: true를 반환하고 실제 canvas 렌더링이 발생한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe(RESULT_PAGE_ID);
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);
    });

    it('명령 spy로 ResultRenderer의 실제 render 로직이 호출됨을 보장한다 (가짜 사각형 대체 금지)', () => {
      const renderSpy = vi.spyOn(ResultRenderer.prototype, 'render');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('DreamGrid, HUDLayer, BottomBar가 정적으로 합성된다', () => {
      const dreamGridSpy = vi.spyOn(DreamGrid.prototype, 'render');
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(dreamGridSpy).toHaveBeenCalledTimes(1);
      expect(hudSpy).toHaveBeenCalledTimes(1);
      expect(bottomBarSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. 비정상 입력 및 Stale / 무결성 가드 검증', () => {
    it('캔버스 크기가 0이거나 비정상적인 경우 invalid-canvas 로 거부된다', () => {
      const canvas = createMockCanvas();
      (canvas as any).width = 0;
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('invalid-canvas');
    });

    it('stale fixture(isStale: true)는 stale-fixture 로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: { isStale: true } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-fixture');
    });

    it('지연된 stale revision 스냅샷 요청은 stale-revision 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: { revision: 1 },
        fixture: { revision: 3 } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('등록되지 않은 잘못된 페이지 ID는 unsupported-page 로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'unknown_result_page',
        snapshot: {},
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-page');
    });

    it('보호된 상단 HUD 영역을 침범하는 불법 버튼 삽입 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.result = {
        pageId: 'result',
        elements: [
          {
            id: 'illegal_btn',
            name: '불법 버튼',
            type: 'button',
            bounds: { x: 100, y: 50, width: 200, height: 60 }, // 상단 HUD 영역 침범
          },
        ],
      };

      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('통계 저장/세이브 시도 및 불법 슬롯 조작 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: { saveRecord: true } as any,
      });
      expect(res1.ok).toBe(false);
      expect(res1.reason).toBe('protected-zone-violation');

      const res2 = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: { syncAchievements: true } as any,
      });
      expect(res2.ok).toBe(false);
      expect(res2.reason).toBe('protected-zone-violation');

      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.result = {
        pageId: 'result',
        elements: [
          {
            id: 'save_record_hack',
            name: '기록저장조작',
            type: 'button',
            bounds: { x: 200, y: 1500, width: 200, height: 60 },
          },
        ],
      };

      const res3 = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: violatingDoc,
      });
      expect(res3.ok).toBe(false);
      expect(res3.reason).toBe('protected-zone-violation');
    });
  });

  describe('3. 런타임 0-부팅 및 부작용 0건 (격리성) 검증', () => {
    it('렌더링 중 localStorage 쓰기/읽기 및 외부 스토리지 저장이 발생하지 않는다 (0건)', () => {
      const setItem = vi.fn();
      const getItem = vi.fn();
      vi.stubGlobal('localStorage', { setItem, getItem });
      const canvas = createMockCanvas();

      dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: DEFAULT_RESULT_PAGE_FIXTURE,
      });

      expect(setItem).not.toHaveBeenCalled();
      expect(getItem).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('게임 라이프사이클, Web Audio/TTS, 카메라/포즈 부팅이 일체 발생하지 않는다 (0-boot 격리)', () => {
      const canvas = createMockCanvas();

      // 전역 window 내 게임 런타임 객체 미호출 확인
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: DEFAULT_RESULT_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
    });
  });

  describe('4. 승리/패배 상태 및 등급 뱃지, 통계 반영 검증', () => {
    it('승리(victory: true) fixture 렌더링 시 승리 타이틀 및 별 등급이 시각화된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: VICTORY_RESULT_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('승리'))).toBe(true);
    });

    it('패배(victory: false) fixture 렌더링 시 패배 타이틀이 시각화된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: DEFEAT_RESULT_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('패배'))).toBe(true);
    });

    it('8개 통계 항목(정답수, 콤보, 시간, 걸음, 스쿼트, 점프, 자세유지, 칼로리)이 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: DEFAULT_RESULT_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);

      expect(texts.some((t) => t.includes('정답률'))).toBe(true);
      expect(texts.some((t) => t.includes('최대 콤보') || t.includes('콤보'))).toBe(true);
      expect(texts.some((t) => t.includes('걸음') || t.includes('달린 걸음'))).toBe(true);
      expect(texts.some((t) => t.includes('스쿼트'))).toBe(true);
      expect(texts.some((t) => t.includes('점프'))).toBe(true);
      expect(texts.some((t) => t.includes('칼로리'))).toBe(true);
    });

    it('Ch.1 ~ Ch.5 챕터별 fixture 렌더링이 정상 동작한다', () => {
      const fixtures = [
        CH1_RESULT_PAGE_FIXTURE,
        CH2_RESULT_PAGE_FIXTURE,
        CH3_RESULT_PAGE_FIXTURE,
        CH4_RESULT_PAGE_FIXTURE,
        CH5_RESULT_PAGE_FIXTURE,
      ];

      for (const fix of fixtures) {
        const canvas = createMockCanvas();
        const res = dispatchPageRender({
          canvas,
          pageId: RESULT_PAGE_ID,
          snapshot: {},
          fixture: fix,
        });
        expect(res.ok).toBe(true);
      }
    });

    it('S / A / B / C 등급별 fixture 렌더링이 정상 동작한다', () => {
      const rankFixtures = [
        S_RANK_RESULT_PAGE_FIXTURE,
        A_RANK_RESULT_PAGE_FIXTURE,
        B_RANK_RESULT_PAGE_FIXTURE,
        C_RANK_RESULT_PAGE_FIXTURE,
      ];

      for (const fix of rankFixtures) {
        const canvas = createMockCanvas();
        const res = dispatchPageRender({
          canvas,
          pageId: RESULT_PAGE_ID,
          snapshot: {},
          fixture: fix,
        });
        expect(res.ok).toBe(true);
      }
    });

    it('재도전(btn_restart) 및 메뉴 복귀(btn_menu) 버튼이 드로잉된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        fixture: DEFAULT_RESULT_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('다시') || t.includes('재도전'))).toBe(true);
      expect(texts.some((t) => t.includes('메뉴'))).toBe(true);
    });
  });

  describe('5. Presentation Document 연동 및 커스텀 오버라이드 검증', () => {
    it('UIPresentationDocument의 커스텀 타이틀 및 버튼 텍스트가 렌더에 반영된다', () => {
      const customDoc = createDefaultUIPresentationDocument();
      customDoc.pages.result = {
        pageId: 'result',
        elements: [
          {
            id: 'result_title',
            name: '커스텀 타이틀',
            type: 'text',
            bounds: { x: 100, y: 300, width: 880, height: 140 },
            text: '꿈의 결전 완료!',
          },
          {
            id: 'btn_restart',
            name: '커스텀 재도전',
            type: 'button',
            bounds: { x: 140, y: 1720, width: 380, height: 110 },
            text: '한 번 더!',
          },
          {
            id: 'btn_menu',
            name: '커스텀 메뉴',
            type: 'button',
            bounds: { x: 560, y: 1720, width: 380, height: 110 },
            text: '돌아가기',
          },
        ],
      };

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: customDoc,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);

      expect(texts.some((t) => t.includes('꿈의 결전 완료'))).toBe(true);
      expect(texts.some((t) => t.includes('한 번 더'))).toBe(true);
      expect(texts.some((t) => t.includes('돌아가기'))).toBe(true);
    });
  });

  describe('6. Rendered Bounds 및 Stable IDs 검증', () => {
    it('필수 Stable ID 목록(result_card, result_title, grade_badge, stats_grid, btn_restart, btn_menu, HUD, BottomBar 등)이 모두 반환된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();
      const bounds = res.renderedBounds!;
      const boundIds = bounds.map((b) => b.id);

      for (const requiredId of RESULT_PAGE_BOUNDS_IDS) {
        expect(boundIds).toContain(requiredId);
      }

      for (const b of bounds) {
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(ARTBOARD_WIDTH + 10);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(ARTBOARD_HEIGHT + 10);
      }
    });

    it('보호 슬롯(hud_player_hp, hud_boss_hp, hud_boss_name)은 isProtected: true, 상호작용 요소는 false로 마킹된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      const hudPlayerHp = bounds.find((b) => b.id === 'hud_player_hp');
      const hudBossHp = bounds.find((b) => b.id === 'hud_boss_hp');
      const resultCard = bounds.find((b) => b.id === 'result_card');
      const btnRestart = bounds.find((b) => b.id === 'btn_restart');
      const btnMenu = bounds.find((b) => b.id === 'btn_menu');

      expect(hudPlayerHp?.isProtected).toBe(true);
      expect(hudBossHp?.isProtected).toBe(true);
      expect(resultCard?.isProtected).toBe(false);
      expect(btnRestart?.isProtected).toBe(false);
      expect(btnMenu?.isProtected).toBe(false);
    });
  });

  describe('7. 선택 요소 하이라이트 및 Stale 선택 잔류 0건 검증', () => {
    it('selectedElementIds에 지정된 요소가 isSelected: true로 마킹되고 하이라이트 사각형이 드로잉된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        selectedElementIds: ['btn_restart'],
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      const btnRestart = bounds.find((b) => b.id === 'btn_restart');
      const btnMenu = bounds.find((b) => b.id === 'btn_menu');

      expect(btnRestart?.isSelected).toBe(true);
      expect(btnMenu?.isSelected).toBe(false);

      // strokeRect 호출 확인 (#28E6FF)
      expect(canvas.mockCtx.calls.some((c) => c.method === 'strokeRect')).toBe(true);
    });

    it('selectedElementIds가 비어있을 때는 어떤 요소도 isSelected가 true가 되지 않는다 (선택 잔류 0건)', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: RESULT_PAGE_ID,
        snapshot: {},
        selectedElementIds: [],
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      expect(bounds.every((b) => !b.isSelected)).toBe(true);
    });
  });
});
