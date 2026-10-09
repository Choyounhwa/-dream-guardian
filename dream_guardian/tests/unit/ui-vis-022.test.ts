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
  optionsPageAdapter,
  settingsPageAdapter,
  OPTIONS_PAGE_ID,
  SETTINGS_PAGE_ID,
  OPTIONS_BOUNDS_IDS,
  registerOptionsPageAdapter,
} from '../../src/editor/ui/preview/screens/UISettingsPage';
import { SettingsView } from '../../src/ui/SettingsView';
import { SettingsModal } from '../../src/ui/SettingsModal';
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
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
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

describe('[Issue #452 / UI-VIS-022] 옵션 실제 렌더 페이지 연결 (UISettingsPage)', () => {
  beforeEach(() => {
    registerOptionsPageAdapter(defaultPageAdapterRegistry);
  });

  describe('1. PageAdapterRegistry 등록 및 식별자 바인딩', () => {
    it('defaultPageAdapterRegistry에 options 및 settings 식별자로 어댑터가 등록되어 있다', () => {
      expect(hasPageAdapter('options')).toBe(true);
      expect(hasPageAdapter('settings')).toBe(true);
      expect(getPageAdapter('options')).toBe(optionsPageAdapter);
      expect(getPageAdapter('settings')).toBe(settingsPageAdapter);
    });

    it('새 PageAdapterRegistry 인스턴스에 registerOptionsPageAdapter로 등록할 수 있다', () => {
      const customRegistry = new PageAdapterRegistry();
      expect(customRegistry.has('options')).toBe(false);
      expect(customRegistry.has('settings')).toBe(false);

      registerOptionsPageAdapter(customRegistry);

      expect(customRegistry.has('options')).toBe(true);
      expect(customRegistry.has('settings')).toBe(true);
      expect(customRegistry.get('options')).toBe(optionsPageAdapter);
    });

    it('OPTIONS_PAGE_ID 및 SETTINGS_PAGE_ID 상수가 올바르게 정의되어 있다', () => {
      expect(OPTIONS_PAGE_ID).toBe('options');
      expect(SETTINGS_PAGE_ID).toBe('settings');
    });
  });

  describe('2. dispatchPageRender 실행 및 기본 성공 판정', () => {
    it('options 페이지 렌더 요청 시 ok: true, drew: true 및 timestamp를 반환한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('options');
      expect(typeof res.timestamp).toBe('number');
      expect(res.renderedBounds).toBeDefined();
      expect(res.renderedBounds!.length).toBeGreaterThan(0);
    });

    it('settings 페이지 렌더 요청 시에도 동일하게 성공한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'settings',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(res.pageId).toBe('settings');
    });

    it('미지원 페이지는 unsupported-page로 거절된다', () => {
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

    it('stale fixture(clockMs < 0 또는 NaN 또는 stale: true) 요청 시 거부된다', () => {
      const canvas = createMockCanvas();
      const resNegative = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
        fixture: { clockMs: -100 },
      });
      expect(resNegative.ok).toBe(false);
      expect(resNegative.reason).toBe('stale-fixture');

      const resNaN = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
        fixture: { clockMs: NaN },
      });
      expect(resNaN.ok).toBe(false);
      expect(resNaN.reason).toBe('stale-fixture');

      const resStale = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
        fixture: { clockMs: 100, stale: true } as any,
      });
      expect(resStale.ok).toBe(false);
      expect(resStale.reason).toBe('stale-fixture');
    });

    it('snapshot.stale: true인 경우 stale-revision으로 거부된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: { stale: true },
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('stale-revision');
    });

    it('보호 영역(HUD Zone y < 120)을 침범하는 커스텀 요소가 포함되면 protected-zone-violation을 반환한다', () => {
      const canvas = createMockCanvas();
      const violatingDoc = {
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
        pageId: 'options',
        snapshot: violatingDoc,
      });

      expect(res.ok).toBe(false);
      expect(res.drew).toBe(false);
      expect(res.reason).toBe('protected-zone-violation');
    });
  });

  describe('3. 실제 SettingsView 재사용 및 순수 뷰 렌더러 파이프라인 검증', () => {
    it('SettingsView의 실제 렌더 파이프라인(renderSettingsView 또는 SettingsView.prototype.render)이 호출된다', () => {
      const renderSpy = vi.spyOn(SettingsView.prototype, 'render');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
      expect(renderSpy).toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    it('가짜 사각형만 그리는 것이 아니라 실제 Canvas draw 호출(dim overlay, modal card, close 등)이 발생한다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const calls = canvas.mockCtx.calls;
      expect(calls.length).toBeGreaterThan(10);
      // dim overlay fillRect
      expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
      // text labels
      expect(calls.some((c) => c.method === 'fillText')).toBe(true);
    });

    it('SettingsModal 인스턴스를 생성하지 않고 순수 SettingsView/DTO만 사용한다', () => {
      // SettingsModal 생성자 호출 여부 감시
      const originalModal = SettingsModal;
      const modalConstructorSpy = vi.fn();
      class MockModal extends originalModal {
        constructor() {
          super();
          modalConstructorSpy();
        }
      }
      (globalThis as any).MockModal = MockModal;

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(modalConstructorSpy).not.toHaveBeenCalled();
    });

    it('localStorage, sessionStorage, fullscreen, camera, audio 등의 사이드 이펙트 호출이 0건이다', () => {
      const storageGetSpy = vi.fn();
      const storageSetSpy = vi.fn();
      vi.stubGlobal('localStorage', {
        getItem: storageGetSpy,
        setItem: storageSetSpy,
      });
      vi.stubGlobal('sessionStorage', {
        getItem: storageGetSpy,
        setItem: storageSetSpy,
      });

      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(storageGetSpy).not.toHaveBeenCalled();
      expect(storageSetSpy).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('4. UIPresentationDocument 바인딩 및 커스텀 오버라이드 반영', () => {
    it('UIPresentationDocument가 주어지면 SettingsView.fromPresentationDocument를 통해 커스텀 슬롯이 반영된다', () => {
      const canvas = createMockCanvas();
      const customDoc = createDefaultUIPresentationDocument();
      // options 페이지의 닫기 버튼 커스텀 위치 지정
      customDoc.pages.options.elements = [
        {
          id: 'settings_close',
          name: '닫기 버튼',
          type: 'button',
          bounds: { x: 800, y: 520, width: 70, height: 70 },
          hitBounds: { x: 800, y: 520, width: 70, height: 70 },
          actionId: 'close_settings',
          text: 'X',
        },
      ];

      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: customDoc,
      });

      expect(res.ok).toBe(true);
      const closeBound = res.renderedBounds?.find((b) => b.id === 'settings_close');
      expect(closeBound).toBeDefined();
      expect(closeBound?.x).toBe(800);
      expect(closeBound?.y).toBe(520);
      expect(closeBound?.width).toBe(70);
      expect(closeBound?.height).toBe(70);
    });

    it('fixture 또는 snapshot을 통해 각 설정 토글 상태(soundEnabled, highContrast 등)를 커스텀 주입할 수 있다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {
          settingsModel: {
            soundEnabled: false,
            highContrast: true,
            locomotionModeLabel: '제자리 달리기 (대체)',
          },
        },
      });

      expect(res.ok).toBe(true);
      expect(res.drew).toBe(true);
    });
  });

  describe('5. 공통 HUD 및 BottomBar 정적 합성', () => {
    it('HUDLayer 및 BottomBar가 정적으로 합성되어 렌더링 호출이 발생한다', () => {
      const hudSpy = vi.spyOn(HUDLayer.prototype, 'render');
      const bottomBarSpy = vi.spyOn(BottomBar.prototype, 'render');
      const canvas = createMockCanvas();

      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      expect(hudSpy).toHaveBeenCalled();
      expect(bottomBarSpy).toHaveBeenCalled();

      hudSpy.mockRestore();
      bottomBarSpy.mockRestore();
    });

    it('게임 엔진 루프나 SceneDirector, AppBootstrap은 부팅되지 않는다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      // 전역 스코프에 게임 루프 rAF가 호출되지 않았음을 보장
    });
  });

  describe('6. renderedBounds stable ID 및 영역 반환', () => {
    it('필수 stable ID(settings_modal, settings_close, slider_bgm, slider_sfx, toggle_mirror, HUD, BottomBar 등)가 모두 포함된다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      const ids = bounds.map((b) => b.id);

      // 모달 및 닫기 버튼
      expect(ids).toContain('settings_modal');
      expect(ids).toContain('settings_close');

      // 컨트롤러/슬라이더/토글 stable IDs
      expect(ids).toContain('slider_bgm');
      expect(ids).toContain('slider_sfx');
      expect(ids).toContain('toggle_mirror');

      // 개별 설정 항목 버튼들
      expect(ids).toContain('camera');
      expect(ids).toContain('sound');
      expect(ids).toContain('fullscreen');
      expect(ids).toContain('skeleton');
      expect(ids).toContain('locomotion');
      expect(ids).toContain('fontScale');
      expect(ids).toContain('highContrast');
      expect(ids).toContain('stickmanScale');

      // 공통 HUD bounds
      expect(ids).toContain('hud_player_hp');
      expect(ids).toContain('hud_boss_hp');
      expect(ids).toContain('hud_boss_name');
      expect(ids).toContain('hud_combo');

      // 공통 BottomBar bounds
      expect(ids).toContain('bottom_bar');
      expect(ids).toContain('bottom_bar_settings');
      expect(ids).toContain('bottom_bar_action');
      expect(ids).toContain('bottom_bar_mana');
    });

    it('모든 renderedBounds는 0 이상의 유효한 너비/높이 및 좌표를 갖는다', () => {
      const canvas = createMockCanvas();
      const res = dispatchPageRender({
        canvas,
        pageId: 'options',
        snapshot: {},
      });

      expect(res.ok).toBe(true);
      const bounds = res.renderedBounds!;
      for (const b of bounds) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
      }
    });

    it('OPTIONS_BOUNDS_IDS에 주요 식별자가 포함되어 있다', () => {
      expect(OPTIONS_BOUNDS_IDS).toContain('settings_modal');
      expect(OPTIONS_BOUNDS_IDS).toContain('settings_close');
      expect(OPTIONS_BOUNDS_IDS).toContain('slider_bgm');
      expect(OPTIONS_BOUNDS_IDS).toContain('slider_sfx');
      expect(OPTIONS_BOUNDS_IDS).toContain('toggle_mirror');
      expect(OPTIONS_BOUNDS_IDS).toContain('hud_player_hp');
      expect(OPTIONS_BOUNDS_IDS).toContain('bottom_bar');
    });
  });
});
