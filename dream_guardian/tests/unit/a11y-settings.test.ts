/**
 * tests/unit/a11y-settings.test.ts
 *
 * [A11Y-003 / #264] SettingsModal 글씨 크기 및 고대비 모드 접근성 옵션 TDD 단위 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { UI_ACCESSIBILITY, UI_LAYOUT } from '../../config/ui.config.js';
import { UIText, resetAccessibility } from '../../src/utils/UIText.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[A11Y-003 / #264] SettingsModal 접근성 옵션 (글씨 크기 / 고대비 모드)', () => {
  let modal: SettingsModal;
  const W = 1080;
  const H = 2160;
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    resetAccessibility();
    mockStore = {};

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStore[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    });

    imageLoader.clear();
    modal = new SettingsModal();
  });

  afterEach(() => {
    resetAccessibility();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. 글씨 크기(fontScale) 3단계 순환 토글', () => {
    it('기본값은 1.0이며 라벨은 "기본 (1.0x)"이다', () => {
      expect(modal.fontScale).toBe(1.0);
      expect(modal.fontScaleLabel).toBe('기본 (1.0x)');
      expect(UI_ACCESSIBILITY.fontScale).toBe(1.0);
      expect(UIText.getAccessibility().fontScale).toBe(1.0);
    });

    it('cycleFontScale() 호출 시 1.0 -> 1.5 -> 2.0 -> 1.0 순환한다', () => {
      // 1회 순환: 1.5x
      const next1 = modal.cycleFontScale();
      expect(next1).toBe(1.5);
      expect(modal.fontScale).toBe(1.5);
      expect(modal.fontScaleLabel).toBe('크게 (1.5x)');
      expect(UI_ACCESSIBILITY.fontScale).toBe(1.5);
      expect(UIText.getAccessibility().fontScale).toBe(1.5);

      // 2회 순환: 2.0x
      const next2 = modal.cycleFontScale();
      expect(next2).toBe(2.0);
      expect(modal.fontScale).toBe(2.0);
      expect(modal.fontScaleLabel).toBe('매우 크게 (2.0x)');
      expect(UI_ACCESSIBILITY.fontScale).toBe(2.0);
      expect(UIText.getAccessibility().fontScale).toBe(2.0);

      // 3회 순환: 1.0x (복귀)
      const next3 = modal.cycleFontScale();
      expect(next3).toBe(1.0);
      expect(modal.fontScale).toBe(1.0);
      expect(modal.fontScaleLabel).toBe('기본 (1.0x)');
      expect(UI_ACCESSIBILITY.fontScale).toBe(1.0);
      expect(UIText.getAccessibility().fontScale).toBe(1.0);
    });

    it('fontScale setter를 통해 직접 설정할 수 있고 UIText와 동기화된다', () => {
      modal.fontScale = 1.5;
      expect(modal.fontScale).toBe(1.5);
      expect(UI_ACCESSIBILITY.fontScale).toBe(1.5);
      expect(UIText.getAccessibility().fontScale).toBe(1.5);
      expect(UIText.getFontSize('body', 1.0)).toBe(Math.round(36 * 1.5));
    });
  });

  describe('2. 고대비 모드(highContrast) 토글', () => {
    it('기본값은 false(OFF)이다', () => {
      expect(modal.highContrast).toBe(false);
      expect(UI_ACCESSIBILITY.highContrast).toBe(false);
      expect(UIText.getAccessibility().highContrast).toBe(false);
    });

    it('toggleHighContrast() 호출 시 true(ON)와 false(OFF)가 상호 전환된다', () => {
      // false -> true
      const state1 = modal.toggleHighContrast();
      expect(state1).toBe(true);
      expect(modal.highContrast).toBe(true);
      expect(UI_ACCESSIBILITY.highContrast).toBe(true);
      expect(UIText.getAccessibility().highContrast).toBe(true);
      expect(UIText.getColor('primary')).toBe('#00FFFF'); // highContrast theme color

      // true -> false
      const state2 = modal.toggleHighContrast();
      expect(state2).toBe(false);
      expect(modal.highContrast).toBe(false);
      expect(UI_ACCESSIBILITY.highContrast).toBe(false);
      expect(UIText.getAccessibility().highContrast).toBe(false);
      expect(UIText.getColor('primary')).toBe('#28E6FF'); // default theme color
    });

    it('highContrast setter를 통해 직접 설정할 수 있다', () => {
      modal.highContrast = true;
      expect(modal.highContrast).toBe(true);
      expect(UI_ACCESSIBILITY.highContrast).toBe(true);
      expect(UIText.getAccessibility().highContrast).toBe(true);
    });
  });

  describe('3. localStorage 저장 및 복원', () => {
    it('fontScale 변경 시 dg_a11y_fontScale 키로 자동 저장된다', () => {
      modal.fontScale = 1.5;
      expect(localStorage.setItem).toHaveBeenCalledWith('dg_a11y_fontScale', '1.5');
      expect(mockStore['dg_a11y_fontScale']).toBe('1.5');
    });

    it('highContrast 변경 시 dg_a11y_highContrast 키로 자동 저장된다', () => {
      modal.highContrast = true;
      expect(localStorage.setItem).toHaveBeenCalledWith('dg_a11y_highContrast', 'true');
      expect(mockStore['dg_a11y_highContrast']).toBe('true');
    });

    it('새 모달 생성 시 localStorage에 저장된 설정값을 복원하여 적용한다', () => {
      mockStore['dg_a11y_fontScale'] = '2';
      mockStore['dg_a11y_highContrast'] = 'true';

      const restoredModal = new SettingsModal();
      expect(restoredModal.fontScale).toBe(2.0);
      expect(restoredModal.fontScaleLabel).toBe('매우 크게 (2.0x)');
      expect(restoredModal.highContrast).toBe(true);
      expect(UI_ACCESSIBILITY.fontScale).toBe(2.0);
      expect(UI_ACCESSIBILITY.highContrast).toBe(true);
      expect(UIText.getAccessibility().fontScale).toBe(2.0);
      expect(UIText.getAccessibility().highContrast).toBe(true);
    });

    it('localStorage에 유효하지 않은 값이 있으면 기본값을 유지한다', () => {
      mockStore['dg_a11y_fontScale'] = '999';
      mockStore['dg_a11y_highContrast'] = 'not-boolean';

      const restoredModal = new SettingsModal();
      expect(restoredModal.fontScale).toBe(1.0);
      expect(restoredModal.highContrast).toBe(false);
    });
  });

  describe('4. 레이아웃 및 클릭 히트테스트 (getButtonLayout & handleClick)', () => {
    it('fontScale 및 highContrast 버튼의 레이아웃 좌표를 정상 반환한다', () => {
      const fontBtn = modal.getButtonLayout('fontScale', W, H);
      expect(fontBtn).toBeDefined();
      expect(fontBtn.w).toBeGreaterThan(0);
      expect(fontBtn.h).toBeGreaterThan(0);

      const hcBtn = modal.getButtonLayout('highContrast', W, H);
      expect(hcBtn).toBeDefined();
      expect(hcBtn.w).toBeGreaterThan(0);
      expect(hcBtn.h).toBeGreaterThan(0);

      // UI_LAYOUT.settings.buttons에 정의된 좌표와 일치
      expect(fontBtn).toEqual(UI_LAYOUT.settings.buttons?.fontScale);
      expect(hcBtn).toEqual(UI_LAYOUT.settings.buttons?.highContrast);
    });

    it('fontScale 버튼 클릭 시 "fontScale" 액션을 반환하고 cycleFontScale()이 실행된다', () => {
      modal.open();
      const fontBtn = modal.getButtonLayout('fontScale', W, H);
      const clickX = fontBtn.x + fontBtn.w / 2;
      const clickY = fontBtn.y + fontBtn.h / 2;

      expect(modal.fontScale).toBe(1.0);
      const action = modal.handleClick(clickX, clickY, W, H);

      expect(action).toBe('fontScale');
      expect(modal.fontScale).toBe(1.5);
      expect(modal.fontScaleLabel).toBe('크게 (1.5x)');
    });

    it('highContrast 버튼 클릭 시 "highContrast" 액션을 반환하고 toggleHighContrast()가 실행된다', () => {
      modal.open();
      const hcBtn = modal.getButtonLayout('highContrast', W, H);
      const clickX = hcBtn.x + hcBtn.w / 2;
      const clickY = hcBtn.y + hcBtn.h / 2;

      expect(modal.highContrast).toBe(false);
      const action = modal.handleClick(clickX, clickY, W, H);

      expect(action).toBe('highContrast');
      expect(modal.highContrast).toBe(true);
    });

    it('기존 5개 버튼(camera, fullscreen, skeleton, sound, locomotion) 히트테스트가 유지된다', () => {
      modal.open();
      const actions: Array<'close' | 'camera' | 'fullscreen' | 'skeleton' | 'sound' | 'locomotion'> = [
        'close',
        'camera',
        'fullscreen',
        'skeleton',
        'sound',
        'locomotion',
      ];

      for (const act of actions) {
        const btn = modal.getButtonLayout(act, W, H);
        const result = modal.handleClick(btn.x + btn.w / 2, btn.y + btn.h / 2, W, H);
        expect(result).toBe(act);
      }
    });
  });

  describe('5. 화면 렌더링 검증', () => {
    it('열린 상태에서 render() 호출 시 2개 신규 옵션 텍스트가 정상 렌더링된다', () => {
      modal.open();
      const ctx = createMockCtx();

      modal.render(ctx, W, H);

      // 옵션명 텍스트 검증
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('글씨 크기'),
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('고대비'),
        expect.any(Number),
        expect.any(Number),
      );

      // 상태 표시 텍스트 검증
      expect(ctx.fillText).toHaveBeenCalledWith(
        '기본 (1.0x)',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        'OFF',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('fontScale 변경 시 렌더링되는 라벨이 즉시 반영된다', () => {
      modal.open();
      modal.fontScale = 1.5;
      const ctx = createMockCtx();

      modal.render(ctx, W, H);
      expect(ctx.fillText).toHaveBeenCalledWith(
        '크게 (1.5x)',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('highContrast 변경 시 ON 텍스트 또는 toggleOn 이미지가 반영된다', () => {
      modal.open();
      modal.highContrast = true;
      const ctx = createMockCtx();

      modal.render(ctx, W, H);
      expect(ctx.fillText).toHaveBeenCalledWith(
        'ON',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});
