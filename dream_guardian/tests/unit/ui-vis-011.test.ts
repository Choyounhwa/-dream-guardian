import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  SettingsView,
  renderSettingsView,
  getSettingsButtonLayout,
  getSettingsButtonLayouts,
  hitTestSettingsButton,
  hitTestSettings,
  getSettingsModalBounds,
  createDefaultSettingsViewModel,
  SETTINGS_BUTTON_ACTIONS,
  type SettingsViewModel,
  type SettingsViewDTO,
  type SettingsPresentationContext,
} from '../../src/ui/SettingsView.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { UI_ACCESSIBILITY } from '../../config/ui.config.js';
import { UIText, resetAccessibility } from '../../src/utils/UIText.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D {
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
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] })
    ),
    measureText: vi.fn().mockReturnValue({ width: 80 }),
    drawImage: vi.fn((...args: unknown[]) => calls.push({ method: 'drawImage', args })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((sx: number, sy: number) => calls.push({ method: 'scale', args: [sx, sy] })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createSampleDTO(overrides?: Partial<SettingsViewModel>): SettingsViewDTO {
  return createDefaultSettingsViewModel({
    isOpen: true,
    alpha: 1.0,
    scale: 1.0,
    cameraEnabled: true,
    skeletonEnabled: true,
    soundEnabled: true,
    locomotionModeLabel: '제자리 달리기',
    fontScale: 1.0,
    fontScaleLabel: '기본 (1.0x)',
    highContrast: false,
    stickmanScale: 1.0,
    stickmanScaleLabel: '기본 (1.0x)',
    isFullscreen: false,
    ...overrides,
  });
}

describe('[Issue #441 / UI-VIS-011] 설정 모달 부작용 없는 실제 그리기 분리 (SettingsView)', () => {
  beforeEach(() => {
    resetAccessibility();
    imageLoader.clear();
  });

  afterEach(() => {
    resetAccessibility();
    vi.restoreAllMocks();
  });

  describe('1. 부작용 0건 (Zero Side-Effects) 및 순수 함수형 검증', () => {
    it('renderSettingsView 실행 시 localStorage 조회 및 쓰기가 0건이다', () => {
      const getItemSpy = vi.fn();
      const setItemSpy = vi.fn();
      vi.stubGlobal('localStorage', {
        getItem: getItemSpy,
        setItem: setItemSpy,
      });

      const ctx = createMockCtx();
      const dto = createSampleDTO();
      renderSettingsView(ctx, 1080, 2160, dto);

      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('renderSettingsView 실행 시 document.fullscreenElement 조회가 0건이다 (DTO의 isFullscreen만 사용)', () => {
      const getFullscreenElementSpy = vi.fn(() => null);
      const mockDoc = {};
      Object.defineProperty(mockDoc, 'fullscreenElement', {
        get: getFullscreenElementSpy,
        configurable: true,
      });
      vi.stubGlobal('document', mockDoc);

      const ctx = createMockCtx();
      const dto = createSampleDTO({ isFullscreen: true });
      renderSettingsView(ctx, 1080, 2160, dto);

      expect(getFullscreenElementSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('renderSettingsView 실행 시 전역 UI_ACCESSIBILITY 및 UIText 상태가 변경되지 않는다', () => {
      const initialFontScale = UI_ACCESSIBILITY.fontScale;
      const initialContrast = UI_ACCESSIBILITY.highContrast;

      const ctx = createMockCtx();
      const dto = createSampleDTO({
        fontScale: 2.0,
        highContrast: true,
      });
      renderSettingsView(ctx, 1080, 2160, dto);

      expect(UI_ACCESSIBILITY.fontScale).toBe(initialFontScale);
      expect(UI_ACCESSIBILITY.highContrast).toBe(initialContrast);
      expect(UIText.getAccessibility().fontScale).toBe(initialFontScale);
      expect(UIText.getAccessibility().highContrast).toBe(initialContrast);
    });
  });

  describe('2. DTO 기반 순수 렌더링 검증', () => {
    it('isOpen이 false이면 아무것도 그리지 않는다', () => {
      const ctx = createMockCtx();
      const dto = createSampleDTO({ isOpen: false });

      renderSettingsView(ctx, 1080, 2160, dto);

      expect(ctx.fillRect).not.toHaveBeenCalled();
      expect(ctx.fillText).not.toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled();
    });

    it('isOpen이 true이면 배경 딤, 모달 카드, 타이틀, 닫기 버튼, 8개 설정 항목을 그린다', () => {
      const ctx = createMockCtx();
      const dto = createSampleDTO();

      renderSettingsView(ctx, 1080, 2160, dto);

      // 전체 화면 딤 오버레이
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);

      // 타이틀
      expect(ctx.fillText).toHaveBeenCalledWith(
        '⚙ 게임 설정',
        expect.any(Number),
        expect.any(Number),
      );

      // 닫기 버튼
      expect(ctx.fillText).toHaveBeenCalledWith(
        '✕',
        expect.any(Number),
        expect.any(Number),
      );

      // 설정 라벨들
      expect(ctx.fillText).toHaveBeenCalledWith(
        '📷 카메라',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '⛶ 전체화면',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '🦴 스켈레톤 본',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '🔊 사운드 효과음',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '🏃 운동 방식',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '🔤 글씨 크기',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '👁 고대비 모드',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '🧍 졸라맨 크기',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('imageLoader에 모달 배경 및 토글 에셋이 있을 때 drawImage를 호출한다', () => {
      const mockImg = {} as HTMLImageElement;
      imageLoader.setImage('settings', 'modalBg', mockImg);
      imageLoader.setImage('settings', 'toggleOn', mockImg);
      imageLoader.setImage('settings', 'toggleOff', mockImg);

      const ctx = createMockCtx();
      const dto = createSampleDTO({ cameraEnabled: true, soundEnabled: false });

      renderSettingsView(ctx, 1080, 2160, dto);

      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });

  describe('3. 9개 버튼 레이아웃 및 SettingsModal과의 1:1 일치 검증', () => {
    it('SETTINGS_BUTTON_ACTIONS 상수에 9개 액션이 모두 포함되어 있다', () => {
      expect(SETTINGS_BUTTON_ACTIONS).toHaveLength(9);
      expect(SETTINGS_BUTTON_ACTIONS).toContain('close');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('camera');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('fullscreen');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('skeleton');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('sound');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('locomotion');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('fontScale');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('highContrast');
      expect(SETTINGS_BUTTON_ACTIONS).toContain('stickmanScale');
    });

    it('getSettingsButtonLayouts가 9개 액션 모두에 대한 layout 슬롯을 반환한다', () => {
      const layouts = getSettingsButtonLayouts(1080, 2160);
      for (const act of SETTINGS_BUTTON_ACTIONS) {
        expect(layouts[act]).toBeDefined();
        expect(layouts[act].w).toBeGreaterThan(0);
        expect(layouts[act].h).toBeGreaterThan(0);
      }
    });

    it('모든 9개 버튼의 getSettingsButtonLayout 결과가 SettingsModal.getButtonLayout과 1:1 일치한다', () => {
      const modal = new SettingsModal();
      const w = 1080;
      const h = 2160;

      for (const act of SETTINGS_BUTTON_ACTIONS) {
        const layoutFromView = getSettingsButtonLayout(act, w, h);
        const layoutFromModal = modal.getButtonLayout(act, w, h);

        expect(layoutFromView.x).toBeCloseTo(layoutFromModal.x, 3);
        expect(layoutFromView.y).toBeCloseTo(layoutFromModal.y, 3);
        expect(layoutFromView.w).toBeCloseTo(layoutFromModal.w, 3);
        expect(layoutFromView.h).toBeCloseTo(layoutFromModal.h, 3);
      }
    });

    it('다른 해상도(720x1280)에서도 레이아웃이 정확히 스케일링된다', () => {
      const modal = new SettingsModal();
      const w = 720;
      const h = 1280;

      for (const act of SETTINGS_BUTTON_ACTIONS) {
        const layoutFromView = getSettingsButtonLayout(act, w, h);
        const layoutFromModal = modal.getButtonLayout(act, w, h);

        expect(layoutFromView.x).toBeCloseTo(layoutFromModal.x, 3);
        expect(layoutFromView.y).toBeCloseTo(layoutFromModal.y, 3);
        expect(layoutFromView.w).toBeCloseTo(layoutFromModal.w, 3);
        expect(layoutFromView.h).toBeCloseTo(layoutFromModal.h, 3);
      }
    });
  });

  describe('4. 히트 테스트 (hitTestSettingsButton & hitTestSettings) 검증', () => {
    it('각 버튼의 중심 좌표 클릭 시 해당 액션을 정확히 반환한다', () => {
      const w = 1080;
      const h = 2160;
      const dto = createSampleDTO();

      for (const act of SETTINGS_BUTTON_ACTIONS) {
        const slot = getSettingsButtonLayout(act, w, h);
        const centerX = slot.x + slot.w / 2;
        const centerY = slot.y + slot.h / 2;

        const hit = hitTestSettingsButton(centerX, centerY, w, h, dto);
        expect(hit).toBe(act);

        const hitAction = hitTestSettings(centerX, centerY, w, h, dto);
        expect(hitAction).toBe(act);
      }
    });

    it('버튼 경계선 바로 밖(5px) 클릭 시 기본 padding(0)에서는 null, padding=10에서는 감지된다', () => {
      const w = 1080;
      const h = 2160;
      const dto = createSampleDTO();
      const slot = getSettingsButtonLayout('camera', w, h);

      const outsideX = slot.x - 5;
      const centerY = slot.y + slot.h / 2;

      expect(hitTestSettingsButton(outsideX, centerY, w, h, dto, undefined, 0)).toBeNull();
      expect(hitTestSettingsButton(outsideX, centerY, w, h, dto, undefined, 10)).toBe('camera');
    });

    it('모달 바깥 영역 클릭 시 hitTestSettings는 "backdrop-close"를 반환한다', () => {
      const w = 1080;
      const h = 2160;
      const dto = createSampleDTO();

      // 모달 바깥 (예: 화면 최상단 좌측 10, 10)
      const hit = hitTestSettings(10, 10, w, h, dto);
      expect(hit).toBe('backdrop-close');
    });

    it('모달 내부이지만 버튼이 없는 빈 영역 클릭 시 hitTestSettings는 null을 반환한다', () => {
      const w = 1080;
      const h = 2160;
      const dto = createSampleDTO();
      const modalBounds = getSettingsModalBounds(w, h);

      // 모달 상단 타이틀 근처 빈 영역 (x: 중앙, y: 모달 상단 + 20)
      const emptyX = modalBounds.x + modalBounds.w / 2;
      const emptyY = modalBounds.y + 20;

      const hit = hitTestSettings(emptyX, emptyY, w, h, dto);
      expect(hit).toBeNull();
    });

    it('isOpen이 false이면 히트 테스트 결과가 항상 null이다', () => {
      const w = 1080;
      const h = 2160;
      const dto = createSampleDTO({ isOpen: false });
      const slot = getSettingsButtonLayout('camera', w, h);

      expect(hitTestSettingsButton(slot.x + 10, slot.y + 10, w, h, dto)).toBeNull();
      expect(hitTestSettings(slot.x + 10, slot.y + 10, w, h, dto)).toBeNull();
    });
  });

  describe('5. PresentationContext 주입 및 오버라이드 지원', () => {
    it('context.modal 오버라이드 시 모달 크기 및 기본 버튼 배치가 조정된다', () => {
      const context: SettingsPresentationContext = {
        modal: { x: 100, y: 300, w: 900, h: 1400 },
      };
      const bounds = getSettingsModalBounds(1080, 2160, context);
      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(300);
      expect(bounds.w).toBe(900);
      expect(bounds.h).toBe(1400);

      const stickmanLayout = getSettingsButtonLayout('stickmanScale', 1080, 2160, context);
      expect(stickmanLayout.x).toBe(100 + 60);
      expect(stickmanLayout.w).toBe(900 - 120);
    });

    it('context.buttons 개별 슬롯 오버라이드 시 지정된 버튼 레이아웃이 변경된다', () => {
      const context: SettingsPresentationContext = {
        buttons: {
          sound: { x: 250, y: 1050, w: 600, h: 120 },
        },
      };

      const soundLayout = getSettingsButtonLayout('sound', 1080, 2160, context);
      expect(soundLayout.x).toBe(250);
      expect(soundLayout.y).toBe(1050);
      expect(soundLayout.w).toBe(600);
      expect(soundLayout.h).toBe(120);

      // 다른 버튼은 기존 레이아웃 유지
      const cameraLayout = getSettingsButtonLayout('camera', 1080, 2160, context);
      expect(cameraLayout.x).toBe(200);
    });

    it('SettingsView.fromPresentationDocument로 UIPresentationDocument의 options 페이지 요소를 파싱한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const context = SettingsView.fromPresentationDocument(doc, 'options');
      expect(context).toBeDefined();
      expect(context.closeBtn).toBeDefined();
    });
  });

  describe('6. SettingsModal 위임 및 회귀 결함 0건 검증', () => {
    it('modal.toViewModel()이 SettingsModal의 상태를 순수 DTO로 변환한다', () => {
      const modal = new SettingsModal();
      modal.open();
      modal.cameraEnabled = false;
      modal.soundEnabled = false;
      modal.locomotionModeLabel = '스쿼트 모드';

      const dto = modal.toViewModel();
      expect(dto.isOpen).toBe(true);
      expect(dto.cameraEnabled).toBe(false);
      expect(dto.soundEnabled).toBe(false);
      expect(dto.locomotionModeLabel).toBe('스쿼트 모드');
      expect(dto.fontScale).toBe(1.0);
      expect(dto.highContrast).toBe(false);
    });

    it('modal.render()가 SettingsView의 렌더 로직으로 정상 위임된다', () => {
      const modal = new SettingsModal();
      modal.open();
      const ctx = createMockCtx();

      modal.render(ctx, 1080, 2160);

      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillText).toHaveBeenCalledWith(
        '⚙ 게임 설정',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('modal.hitTest()가 올바르게 작동한다', () => {
      const modal = new SettingsModal();
      modal.open();
      const w = 1080;
      const h = 2160;

      const camBtn = modal.getButtonLayout('camera', w, h);
      const action = modal.hitTest(camBtn.x + camBtn.w / 2, camBtn.y + camBtn.h / 2, w, h);
      expect(action).toBe('camera');

      const backdropAction = modal.hitTest(10, 10, w, h);
      expect(backdropAction).toBe('backdrop-close');
    });

    it('modal.handleClick()이 기존처럼 폰트/스틱맨 순환 및 고대비 토글을 정상 실행한다', () => {
      const modal = new SettingsModal();
      modal.open();
      const w = 1080;
      const h = 2160;

      const fontSlot = modal.getButtonLayout('fontScale', w, h);
      const act = modal.handleClick(fontSlot.x + 10, fontSlot.y + 10, w, h);

      expect(act).toBe('fontScale');
      expect(modal.fontScale).toBe(1.5);
      expect(modal.fontScaleLabel).toBe('크게 (1.5x)');
    });

    it('modal.setPresentationContext()를 통해 프레젠테이션 컨텍스트를 주입할 수 있다', () => {
      const modal = new SettingsModal();
      modal.setPresentationContext({
        buttons: {
          fullscreen: { x: 300, y: 800, w: 500, h: 100 },
        },
      });

      const slot = modal.getButtonLayout('fullscreen', 1080, 2160);
      expect(slot.x).toBe(300);
      expect(slot.y).toBe(800);
      expect(slot.w).toBe(500);
      expect(slot.h).toBe(100);

      modal.clearPresentationContext();
      const resetSlot = modal.getButtonLayout('fullscreen', 1080, 2160);
      expect(resetSlot.x).toBe(200);
    });
  });
});
