/**
 * [LAYOUT-003] (Issue #570) 설정 모달·운동 모드 모달 레이아웃 설정 이전 (+글자 textScale)
 *
 * 1. 이전 전 출력 및 hit 잠금(characterization):
 *    - 기본값에서 SettingsView 와 LocomotionModal 의 좌표, 폰트 문자열, hit 영역이 100% 동일해야 한다.
 * 2. 신규 UI_LAYOUT 키 값 변경 시 매 프레임 다시 읽어 요소 bounds 및 렌더링 변경:
 *    - SettingsView: minModalH, buttons.stickmanScale, buttons.webcamVideo
 *    - LocomotionModal: modal (x, y, w, h), closeBtn (x, y, w, h), cards (startX, startY, w, h, gapX, gapY)
 * 3. textScale (0.5~3.0) 적용:
 *    - SettingsView: titleText, closeBtn, labelText, valueText, 개별 버튼
 *    - LocomotionModal: titleText, noticeText, closeBtn, cardText (title, sub, desc, badge)
 * 4. Presentation Context 오버라이드 우선순위 유지
 * 5. 판정 연동 좌표 불변 유지
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SettingsView,
  getSettingsModalBounds,
  getSettingsButtonLayout,
  getSettingsButtonLayouts,
  hitTestSettingsButton,
  createDefaultSettingsViewModel,
  renderSettingsView,
  SETTINGS_BUTTON_ACTIONS,
} from '../../src/ui/SettingsView.js';
import {
  LocomotionModal,
} from '../../src/ui/LocomotionModal.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { UIText, resetAccessibility } from '../../src/utils/UIText.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import {
  flattenLayoutBindings,
  resetLayoutTo,
  snapshotLayout,
} from '../../src/dev/DevLayoutPanel.js';
import {
  applyLayoutOverride,
  getLayoutKeyRule,
} from '../../src/core/UILayoutOverride.js';
import { getDevUiLockedSources } from '../../config/dev-ui.config.js';

const pristine = snapshotLayout(UI_LAYOUT);

function createMockCtx() {
  const fontsSet: string[] = [];
  const filledTexts: Array<{ text: string; x: number; y: number; font: string }> = [];
  let _font = '';

  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 })),
    drawImage: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text: String(text), x, y, font: _font });
    }),
    get font() {
      return _font;
    },
    set font(val: string) {
      _font = val;
      fontsSet.push(val);
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    __fontsSet: fontsSet,
    __filledTexts: filledTexts,
  };
}

describe('[LAYOUT-003] Issue #570 설정 모달·운동 모드 모달 레이아웃 설정 이전', () => {
  beforeEach(() => {
    resetAccessibility();
    imageLoader.clear();
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
    resetAccessibility();
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 기본값 특성화 (Characterization) 및 출력·Hit 고정', () => {
    it('SettingsView 기본 모달 및 10개 버튼 좌표가 이전 전 기준과 100% 일치한다', () => {
      const bounds = getSettingsModalBounds(1080, 2160);
      expect(bounds).toEqual({ x: 140, y: 480, w: 800, h: 1340 });

      const layouts = getSettingsButtonLayouts(1080, 2160);
      expect(layouts.close).toEqual({ x: 850, y: 510, w: 60, h: 60 });
      expect(layouts.camera).toEqual({ x: 200, y: 620, w: 680, h: 110 });
      expect(layouts.fullscreen).toEqual({ x: 200, y: 750, w: 680, h: 110 });
      expect(layouts.skeleton).toEqual({ x: 200, y: 880, w: 680, h: 110 });
      expect(layouts.sound).toEqual({ x: 200, y: 1010, w: 680, h: 110 });
      expect(layouts.locomotion).toEqual({ x: 200, y: 1140, w: 680, h: 110 });
      expect(layouts.fontScale).toEqual({ x: 200, y: 1270, w: 680, h: 110 });
      expect(layouts.highContrast).toEqual({ x: 200, y: 1400, w: 680, h: 110 });
      expect(layouts.stickmanScale).toEqual({ x: 200, y: 1530, w: 680, h: 110 });
      expect(layouts.webcamVideo).toEqual({ x: 200, y: 1660, w: 680, h: 110 });

      // hitTestButton 정합성 검증
      for (const act of SETTINGS_BUTTON_ACTIONS) {
        const slot = layouts[act];
        const hit = hitTestSettingsButton(slot.x + slot.w / 2, slot.y + slot.h / 2, 1080, 2160);
        expect(hit).toBe(act);
      }
    });

    it('LocomotionModal 기본 모달, 닫기 버튼, 4개 카드 좌표가 이전 전 기준과 100% 일치한다', () => {
      const modal = new LocomotionModal();
      modal.open();

      expect(modal.MODAL_VIRTUAL).toEqual({ x: 80, y: 380, w: 920, h: 1400 });

      const closeBtn = modal.getCloseButtonLayout(1080, 2160);
      expect(closeBtn).toEqual({ x: 915, y: 415, w: 60, h: 60 });

      const cardRun = modal.getCardLayout('run', 1080, 2160);
      expect(cardRun).toEqual({ x: 110, y: 560, w: 415, h: 560 });

      const cardBounce = modal.getCardLayout('hip_bounce', 1080, 2160);
      expect(cardBounce).toEqual({ x: 555, y: 560, w: 415, h: 560 });

      const cardSway = modal.getCardLayout('hip_sway', 1080, 2160);
      expect(cardSway).toEqual({ x: 110, y: 1150, w: 415, h: 560 });

      const cardCross = modal.getCardLayout('arm_cross', 1080, 2160);
      expect(cardCross).toEqual({ x: 555, y: 1150, w: 415, h: 560 });

      // handleClick 정합성 검증
      const clickClose = modal.handleClick(closeBtn.x + 10, closeBtn.y + 10, 1080, 2160);
      expect(clickClose).toEqual({ action: 'close' });

      modal.open();
      const clickCard = modal.handleClick(cardRun.x + 10, cardRun.y + 10, 1080, 2160);
      expect(clickCard).toEqual({ action: 'select', mode: 'run' });
    });

    it('기본 textScale 1.0 상태에서 렌더링 시 기존 폰트 문자열과 100% 동일하다', () => {
      const ctx = createMockCtx();
      const vm = createDefaultSettingsViewModel();

      renderSettingsView(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, vm);

      // 타이틀: subheading 44px
      const expectedTitleFont = UIText.getFont('subheading', 1.0, 'bold');
      const titleEntry = ctx.__filledTexts.find((t) => t.text.includes('게임 설정'));
      expect(titleEntry).toBeDefined();
      expect(titleEntry?.font).toBe(expectedTitleFont);

      // 닫기: body 36px
      const expectedBodyFont = UIText.getFont('body', 1.0, 'bold');
      const closeEntry = ctx.__filledTexts.find((t) => t.text === '✕');
      expect(closeEntry).toBeDefined();
      expect(closeEntry?.font).toBe(expectedBodyFont);

      // LocomotionModal 기본 렌더링 폰트 확인
      const locoCtx = createMockCtx();
      const loco = new LocomotionModal();
      loco.open();
      loco.render(locoCtx as unknown as CanvasRenderingContext2D, 1080, 2160);

      const locoTitleEntry = locoCtx.__filledTexts.find((t) => t.text.includes('운동 모드'));
      expect(locoTitleEntry).toBeDefined();
      expect(locoTitleEntry?.font).toBe(UIText.getFont('subheading', 1.0, 'bold'));

      const locoNoticeEntry = locoCtx.__filledTexts.find((t) => t.text.includes('거주 환경'));
      expect(locoNoticeEntry).toBeDefined();
      expect(locoNoticeEntry?.font).toBe(UIText.getFont('badge', 1.0, 'normal'));
    });
  });

  describe('2. UI_LAYOUT 좌표 이전 및 동적 변경 검증 (매 프레임 다시 읽기)', () => {
    it('UI_LAYOUT.settings.minModalH 변경 시 SettingsView 모달 높이가 즉시 반영된다', () => {
      (UI_LAYOUT.settings as any).minModalH = 1500;
      const bounds = getSettingsModalBounds(1080, 2160);
      expect(bounds.h).toBe(1500);

      (UI_LAYOUT.settings as any).minModalH = 1200;
      // baseModal.h가 1080이므로 minModalH 1200이 적용되어 1200이 됨
      expect(getSettingsModalBounds(1080, 2160).h).toBe(1200);
    });

    it('UI_LAYOUT.settings.buttons 슬롯(stickmanScale, webcamVideo 포함) 변경 시 버튼 좌표가 반영된다', () => {
      const btns = (UI_LAYOUT.settings as any).buttons;
      expect(btns.stickmanScale).toBeDefined();
      expect(btns.webcamVideo).toBeDefined();

      btns.stickmanScale.x = 240;
      btns.stickmanScale.y = 1550;
      btns.webcamVideo.x = 250;
      btns.webcamVideo.y = 1680;

      const stickmanLayout = getSettingsButtonLayout('stickmanScale', 1080, 2160);
      expect(stickmanLayout.x).toBe(240);
      expect(stickmanLayout.y).toBe(1550);

      const webcamLayout = getSettingsButtonLayout('webcamVideo', 1080, 2160);
      expect(webcamLayout.x).toBe(250);
      expect(webcamLayout.y).toBe(1680);
    });

    it('UI_LAYOUT.locomotion 슬롯 변경 시 모달, 닫기 버튼, 카드 좌표가 즉시 반영된다', () => {
      const modal = new LocomotionModal();
      modal.open();

      const loco = (UI_LAYOUT as any).locomotion;
      expect(loco).toBeDefined();
      expect(loco.modal).toBeDefined();
      expect(loco.closeBtn).toBeDefined();
      expect(loco.cards).toBeDefined();

      // 모달 영역 변경
      loco.modal.x = 100;
      loco.modal.w = 880;
      expect(modal.MODAL_VIRTUAL.x).toBe(100);
      expect(modal.MODAL_VIRTUAL.w).toBe(880);

      // 닫기 버튼 변경
      loco.closeBtn.x = 900;
      loco.closeBtn.y = 400;
      expect(modal.getCloseButtonLayout(1080, 2160).x).toBe(900);
      expect(modal.getCloseButtonLayout(1080, 2160).y).toBe(400);

      // 카드 레이아웃 변경
      loco.cards.startX = 130;
      loco.cards.startY = 580;
      loco.cards.w = 400;
      loco.cards.gapX = 40;

      const runLayout = modal.getCardLayout('run', 1080, 2160);
      expect(runLayout.x).toBe(130);
      expect(runLayout.y).toBe(580);
      expect(runLayout.w).toBe(400);

      const bounceLayout = modal.getCardLayout('hip_bounce', 1080, 2160);
      // startX(130) + cardW(400) + gapX(40) = 570
      expect(bounceLayout.x).toBe(570);
      expect(bounceLayout.y).toBe(580);
    });
  });

  describe('3. textScale (글자 크기 배율) 적용 및 검증', () => {
    it('SettingsView의 텍스트 요소별 textScale 변경 시 폰트 크기가 비례 적용된다', () => {
      const settings = UI_LAYOUT.settings as any;
      settings.titleText = { textScale: 1.5 };
      settings.closeBtn.textScale = 1.3;
      settings.labelText = { textScale: 1.2 };
      settings.buttons.camera.textScale = 1.8;

      const ctx = createMockCtx();
      const vm = createDefaultSettingsViewModel();
      renderSettingsView(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, vm);

      // 타이틀: subheading base 44 * 1.5 = 66px
      const expectedTitleFont = UIText.getFont('subheading', 1.0 * 1.5, 'bold');
      const titleEntry = ctx.__filledTexts.find((t) => t.text.includes('게임 설정'));
      expect(titleEntry?.font).toBe(expectedTitleFont);

      // 닫기 버튼: body base 36 * 1.3 = 47px (rounded)
      const expectedCloseFont = UIText.getFont('body', 1.0 * 1.3, 'bold');
      const closeEntry = ctx.__filledTexts.find((t) => t.text === '✕');
      expect(closeEntry?.font).toBe(expectedCloseFont);

      // 카메라 라벨: body base 36 * 1.8 = 65px (rounded)
      const expectedCameraFont = UIText.getFont('body', 1.0 * 1.8, 'bold');
      const cameraEntry = ctx.__filledTexts.find((t) => t.text.includes('카메라'));
      expect(cameraEntry?.font).toBe(expectedCameraFont);

      // 일반 라벨 (예: 사운드): body base 36 * 1.2 = 43px (rounded)
      const expectedSoundFont = UIText.getFont('body', 1.0 * 1.2, 'bold');
      const soundEntry = ctx.__filledTexts.find((t) => t.text.includes('사운드'));
      expect(soundEntry?.font).toBe(expectedSoundFont);
    });

    it('LocomotionModal의 텍스트 요소별 textScale 변경 시 폰트 크기가 비례 적용된다', () => {
      const loco = (UI_LAYOUT as any).locomotion;
      loco.titleText = { textScale: 1.4 };
      loco.noticeText = { textScale: 1.2 };
      loco.closeBtn.textScale = 1.25;
      loco.cardText = {
        title: { textScale: 1.3 },
        sub: { textScale: 1.1 },
        badge: { textScale: 0.9 },
        desc: { textScale: 0.8 },
      };

      const ctx = createMockCtx();
      const modal = new LocomotionModal();
      modal.open();
      modal.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160);

      // 타이틀
      const expectedTitleFont = UIText.getFont('subheading', 1.0 * 1.4, 'bold');
      const titleEntry = ctx.__filledTexts.find((t) => t.text.includes('운동 모드'));
      expect(titleEntry?.font).toBe(expectedTitleFont);

      // 안내문
      const expectedNoticeFont = UIText.getFont('badge', 1.0 * 1.2, 'normal');
      const noticeEntry = ctx.__filledTexts.find((t) => t.text.includes('거주 환경'));
      expect(noticeEntry?.font).toBe(expectedNoticeFont);

      // 닫기 버튼
      const expectedCloseFont = UIText.getFont('body', 1.0 * 1.25, 'bold');
      const closeEntry = ctx.__filledTexts.find((t) => t.text === '✕');
      expect(closeEntry?.font).toBe(expectedCloseFont);

      // 카드 이름 (달리기)
      const expectedCardTitleFont = UIText.getFont('body', 1.0 * 1.3, 'bold');
      const cardTitleEntry = ctx.__filledTexts.find((t) => t.text === '제자리 달리기');
      expect(cardTitleEntry?.font).toBe(expectedCardTitleFont);

      // 카드 서브라벨
      const expectedCardSubFont = UIText.getFont('badge', 1.0 * 1.1, 'normal');
      const cardSubEntry = ctx.__filledTexts.find((t) => t.text === '기본 모드');
      expect(cardSubEntry?.font).toBe(expectedCardSubFont);

      // 배지 (대상 부위)
      const expectedCardBadgeFont = UIText.getFont('caption', 1.0 * 0.9, 'bold');
      const cardBadgeEntry = ctx.__filledTexts.find((t) => t.text.includes('다리 / 전신'));
      expect(cardBadgeEntry?.font).toBe(expectedCardBadgeFont);
    });
  });

  describe('4. getLayoutKeyRule 검증 및 applyLayoutOverride 유효성 테스트', () => {
    it('textScale 및 신규 키들에 올바른 규칙이 반환된다', () => {
      const textScaleRule = getLayoutKeyRule('textScale');
      expect(textScaleRule).toEqual({ min: 0.5, max: 3.0, step: 0.01, integer: false });

      const minModalHRule = getLayoutKeyRule('minModalH');
      expect(minModalHRule.max).toBe(2160);
      expect(minModalHRule.integer).toBe(true);

      const startXRule = getLayoutKeyRule('startX');
      expect(startXRule).toEqual({ min: 0, max: 1080, step: 1, integer: true });

      const gapXRule = getLayoutKeyRule('gapX');
      expect(gapXRule).toEqual({ min: 0, max: 1080, step: 1, integer: true });
    });

    it('applyLayoutOverride로 textScale 유효 범위(0.5~3.0) 외 값 주입 시 거부된다', () => {
      // 0.49 거부
      const resLow = applyLayoutOverride(UI_LAYOUT, {
        settings: { titleText: { textScale: 0.49 } },
      } as any);
      expect(resLow.warnings.length).toBeGreaterThan(0);

      // 3.01 거부
      const resHigh = applyLayoutOverride(UI_LAYOUT, {
        locomotion: { titleText: { textScale: 3.01 } },
      } as any);
      expect(resHigh.warnings.length).toBeGreaterThan(0);

      // 1.5 허용
      const resValid = applyLayoutOverride(UI_LAYOUT, {
        settings: { titleText: { textScale: 1.5 } },
        locomotion: { titleText: { textScale: 1.5 } },
      } as any);
      expect(resValid.warnings).toEqual([]);
      expect(resValid.applied).toContain('settings.titleText.textScale');
      expect(resValid.applied).toContain('locomotion.titleText.textScale');
      expect((UI_LAYOUT.settings as any).titleText.textScale).toBe(1.5);
      expect((UI_LAYOUT as any).locomotion.titleText.textScale).toBe(1.5);
    });

    it('flattenLayoutBindings에 settings 및 locomotion 신규 바인딩이 노출된다', () => {
      const bindings = flattenLayoutBindings(UI_LAYOUT, []);
      const paths = bindings.map((b) => b.path);

      expect(paths).toContain('settings.minModalH');
      expect(paths).toContain('settings.buttons.stickmanScale.x');
      expect(paths).toContain('settings.buttons.webcamVideo.y');
      expect(paths).toContain('locomotion.modal.x');
      expect(paths).toContain('locomotion.closeBtn.x');
      expect(paths).toContain('locomotion.cards.startX');
      expect(paths).toContain('locomotion.cardText.title.textScale');
    });
  });

  describe('5. Presentation Context 및 모션 판정 연동 불변 검증', () => {
    it('SettingsView는 presentationContext override가 있으면 최우선으로 반영한다', () => {
      const customContext = {
        modal: { x: 100, y: 200, w: 700, h: 1000 },
        buttons: {
          camera: { x: 150, y: 300, w: 600, h: 90 },
        },
      };

      const view = new SettingsView(customContext);
      const bounds = view.getPresentationContext();
      expect(bounds).toBe(customContext);

      const modalBounds = getSettingsModalBounds(1080, 2160, customContext);
      expect(modalBounds).toEqual({ x: 100, y: 200, w: 700, h: 1000 });

      const camLayout = getSettingsButtonLayout('camera', 1080, 2160, customContext);
      expect(camLayout).toEqual({ x: 150, y: 300, w: 600, h: 90 });
    });

    it('getDevUiLockedSources 판정 연동 좌표는 이전 전과 완전히 동일하다', () => {
      const lockedSources = getDevUiLockedSources();
      expect(lockedSources.length).toBeGreaterThan(0);
      const zoneSource = lockedSources.find((s) => s.id === 'fitnessZones');
      expect(zoneSource).toBeDefined();
      expect(zoneSource?.values).toBeDefined();
    });
  });
});
