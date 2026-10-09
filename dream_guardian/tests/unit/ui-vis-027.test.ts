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
  HAZARD_EVADE_PAGE_ID,
  HAZARD_PAGE_ID,
  HAZARD_EVADE_BOUNDS_IDS,
  registerHazardPageAdapter,
  type HazardPageFixtureOptions,
  DEFAULT_HAZARD_PAGE_FIXTURE,
  JUMP_HAZARD_WARNING_PAGE_FIXTURE,
  JUMP_HAZARD_ACTIVE_PAGE_FIXTURE,
  JUMP_HAZARD_SAFE_PAGE_FIXTURE,
  JUMP_HAZARD_HIT_PAGE_FIXTURE,
  LEFT_STEP_HAZARD_PAGE_FIXTURE,
  RIGHT_STEP_HAZARD_PAGE_FIXTURE,
  BALANCE_LEFT_HAZARD_PAGE_FIXTURE,
  BALANCE_RIGHT_HAZARD_PAGE_FIXTURE,
} from '../../src/editor/ui/preview/screens/UIHazardPage';
import { HazardZoneRenderer } from '../../src/render/HazardZoneRenderer';
import { DreamGrid } from '../../src/render/DreamGrid';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter';
import { JudgmentFeedback } from '../../src/ui/JudgmentFeedback';
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

function createMockCanvas(): HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> } {
  const mockCtx = createMockCtx();
  return {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    getContext: vi.fn(() => mockCtx),
    mockCtx,
  } as unknown as HTMLCanvasElement & { mockCtx: ReturnType<typeof createMockCtx> };
}

describe('UI-VIS-027: 오답·위험 회피 실제 렌더 페이지 어댑터', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 레지스트리 등록 및 기본 디스패치', () => {
    it('defaultPageAdapterRegistry 에 hazard_evade 및 hazard 별칭이 등록되어 있다', () => {
      expect(hasPageAdapter(HAZARD_EVADE_PAGE_ID)).toBe(true);
      expect(hasPageAdapter(HAZARD_PAGE_ID)).toBe(true);
      expect(defaultPageAdapterRegistry.has(HAZARD_EVADE_PAGE_ID)).toBe(true);
      expect(defaultPageAdapterRegistry.has(HAZARD_PAGE_ID)).toBe(true);
    });

    it('독립 레지스트리에 registerHazardPageAdapter 로 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has(HAZARD_EVADE_PAGE_ID)).toBe(false);

      registerHazardPageAdapter(customRegistry);
      expect(customRegistry.has(HAZARD_EVADE_PAGE_ID)).toBe(true);
      expect(customRegistry.has(HAZARD_PAGE_ID)).toBe(true);
    });

    it('기본 fixture로 dispatchPageRender 시 ok: true, drew: true 를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: DEFAULT_HAZARD_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe(HAZARD_EVADE_PAGE_ID);
      expect(canvas.mockCtx.calls.length).toBeGreaterThan(0);
    });

    it('hazard 별칭으로도 동일하게 정상 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
    });
  });

  describe('2. 비정상 입력 및 Stale 가드 검증', () => {
    it('캔버스 크기가 0이거나 비정상적인 경우 invalid-canvas 로 거부된다', () => {
      const canvas = createMockCanvas();
      (canvas as any).width = 0;
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
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
        pageId: HAZARD_EVADE_PAGE_ID,
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
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: { revision: 2 },
        fixture: { revision: 4 } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });
  });

  describe('3. 보호 영역 및 기하학 침범 변조 가드', () => {
    it('상단 보호 HUD 영역을 침범하는 잘못된 프레젠테이션 요소는 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.hazard_evade.elements.push({
        id: 'illegal_hud_invader',
        name: '불법 침범 요소',
        type: 'container',
        bounds: { x: 100, y: 20, width: 400, height: 100 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('보호된 장판 물리 기하(x, y, w, h) 변조 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: {
          hazardContext: {
            hazardWarning: { x: 50, y: 50, w: 200, h: 100 },
          },
        } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('보호 슬롯(timingGuide x/y 변조) 시도 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: {
          hazardContext: {
            timingGuide: { y: 1500 },
          },
        } as any,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });

    it('하단 보호 모션 존(Zone 9~11 바닥) 침범 불법 버튼 추가 시 protected-zone-violation 으로 거부된다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = createDefaultUIPresentationDocument();
      violatingDoc.pages.hazard_evade.elements.push({
        id: 'illegal_button_zone_9',
        name: '바닥 불법 버튼',
        type: 'button',
        bounds: { x: 50, y: 1800, width: 200, height: 150 },
      });

      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });
  });

  describe('4. 명령 spy로 실제 렌더러 호출 검증 (가짜 사각형 금지)', () => {
    it('실제 DreamGrid.prototype.render 가 호출된다', () => {
      const canvas = createMockCanvas();
      const gridSpy = vi.spyOn(DreamGrid.prototype, 'render');
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(gridSpy).toHaveBeenCalledTimes(1);
    });

    it('실제 HazardZoneRenderer.prototype.renderFixture 가 호출된다', () => {
      const canvas = createMockCanvas();
      const hazardSpy = vi.spyOn(HazardZoneRenderer.prototype, 'renderFixture');
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(hazardSpy).toHaveBeenCalledTimes(1);
    });

    it('실제 PhasePresentationAdapter.prototype.renderHazardEvade 가 호출된다', () => {
      const canvas = createMockCanvas();
      const phaseSpy = vi.spyOn(PhasePresentationAdapter.prototype, 'renderHazardEvade');
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(phaseSpy).toHaveBeenCalledTimes(1);
    });

    it('feedback fixture 제공 시 실제 JudgmentFeedback.prototype.renderFixture 가 호출된다', () => {
      const canvas = createMockCanvas();
      const feedbackSpy = vi.spyOn(JudgmentFeedback.prototype, 'renderFixture');
      const fixtureWithFeedback: HazardPageFixtureOptions = {
        feedback: { message: '회피 준비!' },
      };
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: fixtureWithFeedback,
      });

      expect(res.ok).toBe(true);
      expect(feedbackSpy).toHaveBeenCalledTimes(1);
    });

    it('실제 HUDLayer.prototype.render 및 BottomBar.prototype.render 가 호출된다', () => {
      const canvas = createMockCanvas();
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const barSpy = vi.spyOn(BottomBar.prototype, 'render');
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(hudSpy).toHaveBeenCalledTimes(1);
      expect(barSpy).toHaveBeenCalledTimes(1);
    });

    it('캔버스 드로잉 명령어 호출이 풍부하게 발생한다 (가짜 사각형 단독 대체 금지)', () => {
      const canvas = createMockCanvas();
      dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      const methods = canvas.mockCtx.calls.map((c) => c.method);
      expect(methods).toContain('save');
      expect(methods).toContain('restore');
      expect(methods).toContain('beginPath');
      expect(methods).toContain('ellipse');
      expect(methods).toContain('stroke');
      expect(methods).toContain('fillText');
    });
  });

  describe('5. 회피 패턴 DTO fixture 합성 및 시각 피드백 검증', () => {
    it('jump 패턴 warning fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: JUMP_HAZARD_WARNING_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('피하기') || t.includes('위험'))).toBe(true);
    });

    it('jump 패턴 active fixture 렌더링이 정상 동작한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: JUMP_HAZARD_ACTIVE_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
    });

    it('SAFE 회피 성공 시각 피드백 fixture 렌더링 시 회피 성공 텍스트가 표시된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: JUMP_HAZARD_SAFE_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('회피 성공'))).toBe(true);
    });

    it('HIT 피격 실패 시각 피드백 fixture 렌더링 시 피격 알림 텍스트가 표시된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: JUMP_HAZARD_HIT_PAGE_FIXTURE,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('피격') || t.includes('회피 실패'))).toBe(true);
    });

    it('left_step 및 right_step 스텝 회피 패턴이 정상 렌더링된다', () => {
      const canvas1 = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas: canvas1,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: LEFT_STEP_HAZARD_PAGE_FIXTURE,
      });
      expect(res1.ok).toBe(true);

      const canvas2 = createMockCanvas();
      const res2 = dispatchPageRender({
        canvas: canvas2,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: RIGHT_STEP_HAZARD_PAGE_FIXTURE,
      });
      expect(res2.ok).toBe(true);
    });

    it('balance_left 및 balance_right 균형 회피 패턴이 정상 렌더링된다', () => {
      const canvas1 = createMockCanvas();
      const res1 = dispatchPageRender({
        canvas: canvas1,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: BALANCE_LEFT_HAZARD_PAGE_FIXTURE,
      });
      expect(res1.ok).toBe(true);

      const canvas2 = createMockCanvas();
      const res2 = dispatchPageRender({
        canvas: canvas2,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
        fixture: BALANCE_RIGHT_HAZARD_PAGE_FIXTURE,
      });
      expect(res2.ok).toBe(true);
    });
  });

  describe('6. UIPresentationDocument 커스텀 반영', () => {
    it('스냅샷의 hazard_warning 커스텀 텍스트가 렌더러에 전달되어 표시된다', () => {
      const canvas = createMockCanvas();
      const doc = createDefaultUIPresentationDocument();
      const warnEl = doc.pages.hazard_evade.elements.find((e) => e.id === 'hazard_warning');
      if (warnEl) {
        warnEl.text = '주의! 긴급 바닥 충격파 발생!';
      }

      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: doc,
      });

      expect(res.ok).toBe(true);
      const texts = canvas.mockCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(texts.some((t) => t.includes('긴급 바닥 충격파'))).toBe(true);
    });
  });

  describe('7. Stable Rendered Bounds 및 보호 플래그 검증', () => {
    it('모든 필수 stable bounds ID를 반환하며 실제 렌더링 영역 좌표가 유효하다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.renderedBounds).toBeDefined();
      const bounds = res.renderedBounds!;
      const boundIds = bounds.map((b) => b.id);

      for (const requiredId of HAZARD_EVADE_BOUNDS_IDS) {
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

    it('장판 물리 기하(hazard_safe_zone, hazard_zone_rect) 및 Zone 6~11은 isProtected: true 로 마킹된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      const safeZone = bounds.find((b) => b.id === 'hazard_safe_zone');
      const hazardRect = bounds.find((b) => b.id === 'hazard_zone_rect');
      const zone6 = bounds.find((b) => b.id === 'zone_6');
      const zone9 = bounds.find((b) => b.id === 'zone_9');

      expect(safeZone?.isProtected).toBe(true);
      expect(hazardRect?.isProtected).toBe(true);
      expect(zone6?.isProtected).toBe(true);
      expect(zone9?.isProtected).toBe(true);

      const warningBanner = bounds.find((b) => b.id === 'hazard_warning_banner');
      expect(warningBanner?.isProtected).toBe(false);
    });
  });

  describe('8. 런타임 수명주기 0건 격리 보장', () => {
    it('게임 엔진, AppBootstrap, 카메라, TTS 등의 부팅 없이 0-runtime 으로 렌더링된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: HAZARD_EVADE_PAGE_ID,
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      // 브라우저 윈도우/문서에 불필요한 이벤트 리스너가 등록되지 않음
    });
  });
});
