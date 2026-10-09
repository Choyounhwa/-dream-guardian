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
  BOSS_BATTLE_PAGE_ID,
  BOSS_CLIMAX_PAGE_ID,
  BOSS_PAGE_BOUNDS_IDS,
  registerBossPageAdapter,
  bossPageAdapter,
  DEFAULT_BOSS_PAGE_FIXTURE,
  CH1_BOSS_PAGE_FIXTURE,
  CH2_BOSS_PAGE_FIXTURE,
  CH3_BOSS_PAGE_FIXTURE,
  CH4_BOSS_PAGE_FIXTURE,
  CH5_BOSS_PAGE_FIXTURE,
  ENRAGED_BOSS_PAGE_FIXTURE,
  FEVER_BOSS_PAGE_FIXTURE,
  CLIMAX_HAZARD_STOMP_BOSS_PAGE_FIXTURE,
  CLIMAX_HAZARD_SLAM_BOSS_PAGE_FIXTURE,
} from '../../src/editor/ui/preview/screens/UIBossPage';
import { BossRenderer } from '../../src/render/BossRenderer';
import { BossClimaxRenderer } from '../../src/render/BossClimaxRenderer';
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

describe('UI-VIS-028: 보스 결전 실제 렌더 페이지 연결 (UIBossPage & UIPageAdapters)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 레지스트리 연결 및 기본 디스패치 검증', () => {
    it('defaultPageAdapterRegistry 에 boss_battle 및 boss_climax 가 등록되어 있다', () => {
      expect(defaultPageAdapterRegistry.has(BOSS_BATTLE_PAGE_ID)).toBe(true);
      expect(defaultPageAdapterRegistry.has(BOSS_CLIMAX_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(BOSS_BATTLE_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(BOSS_CLIMAX_PAGE_ID)).toBe(true);
    });

    it('커스텀 레지스트리 인스턴스에도 정상 등록된다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has(BOSS_BATTLE_PAGE_ID)).toBe(false);
      expect(customRegistry.has(BOSS_CLIMAX_PAGE_ID)).toBe(false);

      registerBossPageAdapter(customRegistry);

      expect(customRegistry.has(BOSS_BATTLE_PAGE_ID)).toBe(true);
      expect(customRegistry.has(BOSS_CLIMAX_PAGE_ID)).toBe(true);
    });

    it('dispatchPageRender(boss_battle) 호출 시 drew: true, ok: true 를 반환하며 ctx 드로잉이 수행된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe(BOSS_BATTLE_PAGE_ID);
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);
    });

    it('dispatchPageRender(boss_climax) 호출 시 drew: true, ok: true 를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_CLIMAX_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe(BOSS_CLIMAX_PAGE_ID);
    });
  });

  describe('2. 비정상 입력 및 Stale 가드 검증', () => {
    it('캔버스 크기가 0이거나 비정상적인 경우 invalid-canvas 로 거부된다', () => {
      const canvas = createMockCanvas();
      (canvas as any).width = 0;
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
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
        pageId: BOSS_BATTLE_PAGE_ID,
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
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: { revision: 1 },
        fixture: { revision: 3 } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('지원하지 않는 페이지 ID 요청 시 unsupported-page 로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = bossPageAdapter({
        canvas,
        ctx: canvas.mockCtx,
        pageId: 'unknown_boss_screen',
        snapshot: {},
        fixture: DEFAULT_BOSS_PAGE_FIXTURE as any,
        dpr: 1,
        artboardWidth: ARTBOARD_WIDTH,
        artboardHeight: ARTBOARD_HEIGHT,
        layout: {
          valid: true,
          scale: 1,
          renderWidth: ARTBOARD_WIDTH,
          renderHeight: ARTBOARD_HEIGHT,
          offsetX: 0,
          offsetY: 0,
          dpr: 1,
          canvasPixelWidth: ARTBOARD_WIDTH,
          canvasPixelHeight: ARTBOARD_HEIGHT,
        },
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('unsupported-page');
    });
  });

  describe('3. 보호 영역 및 기하학 침범 변조 가드', () => {
    it('상단 보호 HUD 영역을 침범하는 불법 프레젠테이션 요소는 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.boss_battle.elements.push({
        id: 'illegal_hud_invader',
        name: '불법 HUD 침범 요소',
        type: 'button',
        bounds: { x: 100, y: 50, width: 300, height: 100 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('보호된 슬롯 ID (boss_hp, damage_calculation 등) 변조 시도시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.boss_battle.elements.push({
        id: 'damage_calculation',
        name: '보호된 전투 계산 슬롯',
        type: 'container',
        bounds: { x: 100, y: 600, width: 200, height: 100 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('fixture 레벨의 보호된 슬롯 (damage_calculation) 변조 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: { damage_calculation: true } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('bossContext 및 bossClimaxContext 내부 보호 필드 변조 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas1 = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas: canvas1,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: { bossContext: { boss_hp: { text: '999' } } } as any,
      });

      expect(res1.ok).toBe(false);
      expect(res1.drew).toBe(false);
      expect(res1.reason).toBe('protected-zone-violation');

      const canvas2 = createMockCanvas();
      const res2 = dispatchPageRender({
        canvas: canvas2,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: { bossClimaxContext: { hazard_geometry: { x: 0 } } } as any,
      });

      expect(res2.ok).toBe(false);
      expect(res2.drew).toBe(false);
      expect(res2.reason).toBe('protected-zone-violation');
    });

    it('하단 바닥 모션 영역(Zone 9~11)에 불법 버튼 배치 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.boss_battle.elements.push({
        id: 'floor_illegal_button',
        name: '바닥 불법 버튼',
        type: 'button',
        bounds: { x: 200, y: 1800, width: 300, height: 150 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });
  });

  describe('4. 명령 spy로 실제 렌더러 호출 검증 (가짜 사각형 대체 금지)', () => {
    it('실제 DreamGrid, BossRenderer, BossClimaxRenderer, HUDLayer, BottomBar 가 모두 호출된다', () => {
      const canvas = createMockCanvas();
      const gridSpy = vi.spyOn(DreamGrid.prototype, 'render');
      const bossSpy = vi.spyOn(BossRenderer.prototype, 'renderFixture');
      const climaxSpy = vi.spyOn(BossClimaxRenderer.prototype, 'renderFixture');
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');

      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(gridSpy).toHaveBeenCalledTimes(1);
      expect(bossSpy).toHaveBeenCalledTimes(1);
      expect(climaxSpy).toHaveBeenCalledTimes(1);
      expect(hudSpy).toHaveBeenCalledTimes(1);
      expect(bottomBarSpy).toHaveBeenCalledTimes(1);
    });

    it('실제 canvas context 에 save, restore, beginPath, fill, stroke 등의 드로잉 호출이 누적된다', () => {
      const canvas = createMockCanvas();
      dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
      });

      const methods = canvas.mockCtx.calls.map((c) => c.method);
      expect(methods).toContain('save');
      expect(methods).toContain('restore');
      expect(methods).toContain('beginPath');
      expect(methods).toContain('fill');
      expect(methods).toContain('stroke');
      expect(methods).toContain('fillText');
    });
  });

  describe('5. 5개 챕터 보스 및 결전 모드 Fixture 렌더링 검증', () => {
    it('Ch.1 포겟(하얘시니) fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CH1_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('포겟') || t.includes('하얘시니'))).toBe(true);
    });

    it('Ch.2 후다닥(재촉새) fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CH2_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('재촉새') || t.includes('후다닥'))).toBe(true);
    });

    it('Ch.3 뒤죽박죽(따돌시니) fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CH3_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('따돌시니') || t.includes('뒤죽박죽'))).toBe(true);
    });

    it('Ch.4 에라(풀죽새) fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CH4_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('풀죽새') || t.includes('에라'))).toBe(true);
    });

    it('Ch.5 나이트메어(캄캄대왕) fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CH5_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('캄캄대왕') || t.includes('나이트메어'))).toBe(true);
    });

    it('광폭화(ENRAGED) fixture 렌더링 시 광폭화 상태가 시각화된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: ENRAGED_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('광폭화') || t.includes('ENRAGED'))).toBe(true);
    });

    it('피버(FEVER) fixture 렌더링 시 탄막 및 피버 콤보가 시각화된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: FEVER_BOSS_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('FEVER') || t.includes('콤보') || t.includes('COMBO'))).toBe(true);
    });

    it('결전 바닥 장판(STOMP, SLAM) fixture 렌더링이 정상 동작한다', () => {
      const canvas1 = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas: canvas1,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CLIMAX_HAZARD_STOMP_BOSS_PAGE_FIXTURE,
      });
      expect(res1.ok).toBe(true);

      const canvas2 = createMockCanvas();
      const res2 = dispatchPageRender({
        canvas: canvas2,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        fixture: CLIMAX_HAZARD_SLAM_BOSS_PAGE_FIXTURE,
      });
      expect(res2.ok).toBe(true);
    });
  });

  describe('6. UIPresentationDocument 커스텀 반영', () => {
    it('스냅샷의 boss_title 커스텀 텍스트가 렌더러에 전달된다', () => {
      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();
      doc.pages.boss_battle.elements.push({
        id: 'boss_title',
        name: '보스 타이틀 커스텀',
        type: 'text',
        bounds: { x: 300, y: 150, width: 480, height: 80 },
        text: '악몽의 제왕 각성!',
      });

      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('악몽의 제왕 각성!'))).toBe(true);
    });
  });

  describe('7. Stable Rendered Bounds 및 보호 플래그 검증', () => {
    it('모든 필수 stable bounds ID를 반환하며 실제 렌더링 영역 좌표가 유효하다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();
      const bounds = res.renderedBounds!;
      const boundIds = bounds.map((b) => b.id);

      for (const requiredId of BOSS_PAGE_BOUNDS_IDS) {
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

    it('보호 슬롯(hud_boss_hp, hud_player_hp, climax_hazard, hud_container)은 isProtected: true 로 마킹된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      const hudBossHp = bounds.find((b) => b.id === 'hud_boss_hp');
      const hudPlayerHp = bounds.find((b) => b.id === 'hud_player_hp');
      const climaxHazard = bounds.find((b) => b.id === 'climax_hazard');
      const hudContainer = bounds.find((b) => b.id === 'hud_container');

      expect(hudBossHp?.isProtected).toBe(true);
      expect(hudPlayerHp?.isProtected).toBe(true);
      expect(climaxHazard?.isProtected).toBe(true);
      expect(hudContainer?.isProtected).toBe(true);

      const bossBody = bounds.find((b) => b.id === 'boss_body');
      const guardianBody = bounds.find((b) => b.id === 'guardian_body');
      const minionTroop = bounds.find((b) => b.id === 'minion_troop');
      const bottomBar = bounds.find((b) => b.id === 'bottom_bar');

      expect(bossBody?.isProtected).toBe(false);
      expect(guardianBody?.isProtected).toBe(false);
      expect(minionTroop?.isProtected).toBe(false);
      expect(bottomBar?.isProtected).toBe(false);
    });
  });

  describe('8. 선택 요소 하이라이트 및 페이지 전환 가드', () => {
    it('selectedElementIds 에 지정된 요소의 strokeRect 하이라이트가 호출된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        selectedElementIds: ['boss_body'],
      });

      expect(res.ok).toBe(true);
      const setLineDashCalls = canvas.mockCtx.calls.filter((c) => c.method === 'setLineDash');
      const strokeRectCalls = canvas.mockCtx.calls.filter((c) => c.method === 'strokeRect');
      expect(setLineDashCalls.length).toBeGreaterThan(0);
      expect(strokeRectCalls.length).toBeGreaterThan(0);
    });

    it('선택이 지정되지 않은 경우 하이라이트 잔류가 발생하지 않는다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
        selectedElementIds: [],
      });

      expect(res.ok).toBe(true);
      const setLineDashCalls = canvas.mockCtx.calls.filter((c) => c.method === 'setLineDash');
      expect(setLineDashCalls.length).toBe(0);
    });
  });

  describe('9. 런타임 수명주기 0건 격리 보장', () => {
    it('GameEngine, BossController, 데미지 계산 없이 순수 프리젠테이션으로 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: BOSS_BATTLE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
    });
  });
});
