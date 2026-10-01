import { describe, it, expect, beforeEach } from 'vitest';
import {
  UIText,
  getFont,
  getFontSize,
  getColor,
  getLayoutSlot,
  setFontScale,
  setHighContrast,
  setMinPhysicalPx,
  resetAccessibility,
  getAccessibility,
} from '../../src/utils/UIText.js';
import {
  UI_TEXT_TOKENS,
  UI_COLOR_THEMES,
  UI_LAYOUT,
  type UITextRole,
} from '../../config/ui.config.js';

describe('UIText Central Rendering Utility (Issue #257 / UI-TOKEN-002)', () => {
  beforeEach(() => {
    resetAccessibility();
  });

  describe('1. getFontSize & getFont Basics', () => {
    it('scaleX=1일 때 각 역할(Role)별 기본 크기(base) 및 가중치(weight)를 정확히 반영한다', () => {
      const roles: UITextRole[] = [
        'hero',
        'title',
        'heading',
        'subheading',
        'body',
        'label',
        'badge',
        'caption',
      ];

      for (const role of roles) {
        const expectedToken = UI_TEXT_TOKENS[role];
        const size = getFontSize(role, 1.0);
        expect(size).toBe(expectedToken.base);

        const font = getFont(role, 1.0);
        expect(font).toBe(`${expectedToken.weight} ${expectedToken.base}px sans-serif`);
      }
    });

    it('scaleX 기본값은 1.0이다', () => {
      expect(getFontSize('title')).toBe(UI_TEXT_TOKENS.title.base);
      expect(getFont('title')).toBe(`bold ${UI_TEXT_TOKENS.title.base}px sans-serif`);
    });

    it('weight 및 fontFamily 사용자 지정 오버라이드를 지원한다', () => {
      const font1 = getFont('body', 1.0, 'bold');
      expect(font1).toBe(`bold ${UI_TEXT_TOKENS.body.base}px sans-serif`);

      const font2 = getFont('title', 1.0, '600', 'Pretendard, sans-serif');
      expect(font2).toBe(`600 ${UI_TEXT_TOKENS.title.base}px Pretendard, sans-serif`);
    });

    it('알 수 없는 역할이 전달될 경우 body 토큰을 안전하게 대체(fallback)한다', () => {
      const size = getFontSize('unknown_role' as UITextRole, 1.0);
      expect(size).toBe(UI_TEXT_TOKENS.body.base);

      const font = getFont('unknown_role' as UITextRole, 1.0);
      expect(font).toBe(`${UI_TEXT_TOKENS.body.weight} ${UI_TEXT_TOKENS.body.base}px sans-serif`);
    });
  });

  describe('2. Accessibility fontScale (1.0, 1.5, 2.0 배율)', () => {
    it('fontScale 1.0일 때 기본 크기를 반환한다', () => {
      setFontScale(1.0);
      expect(getFontSize('subheading', 1.0)).toBe(44);
      expect(getFont('subheading', 1.0)).toBe('bold 44px sans-serif');
    });

    it('fontScale 1.5일 때 1.5배 확대된 폰트 크기를 반환한다', () => {
      setFontScale(1.5);
      // subheading base: 44 * 1.5 = 66
      expect(getFontSize('subheading', 1.0)).toBe(66);
      expect(getFont('subheading', 1.0)).toBe('bold 66px sans-serif');

      // title base: 76 * 1.5 = 114
      expect(getFontSize('title', 1.0)).toBe(114);
      expect(getFont('title', 1.0)).toBe('bold 114px sans-serif');
    });

    it('fontScale 2.0일 때 2.0배 확대된 폰트 크기를 반환한다', () => {
      setFontScale(2.0);
      // subheading base: 44 * 2.0 = 88
      expect(getFontSize('subheading', 1.0)).toBe(88);
      expect(getFont('subheading', 1.0)).toBe('bold 88px sans-serif');

      // hero base: 100 * 2.0 = 200
      expect(getFontSize('hero', 1.0)).toBe(200);
      expect(getFont('hero', 1.0)).toBe('bold 200px sans-serif');
    });

    it('resetAccessibility() 호출 시 fontScale이 1.0으로 초기화된다', () => {
      setFontScale(1.8);
      expect(getAccessibility().fontScale).toBe(1.8);

      resetAccessibility();
      expect(getAccessibility().fontScale).toBe(1.0);
      expect(getFontSize('subheading', 1.0)).toBe(44);
    });
  });

  describe('3. Minimum Bound Guarantee (minPhysicalPx & token.min)', () => {
    it('극단적인 스케일 다운(scaleX = 0.1)에서도 token.min 하한선을 보장한다', () => {
      // hero: base 100, min 36 -> 100 * 0.1 = 10 -> 하한선 36 보장
      expect(getFontSize('hero', 0.1)).toBe(UI_TEXT_TOKENS.hero.min);
      expect(getFont('hero', 0.1)).toBe(`bold ${UI_TEXT_TOKENS.hero.min}px sans-serif`);

      // title: base 76, min 32 -> 76 * 0.1 = 7.6 -> 하한선 32 보장
      expect(getFontSize('title', 0.1)).toBe(UI_TEXT_TOKENS.title.min);

      // subheading: base 44, min 24 -> 44 * 0.1 = 4.4 -> 하한선 24 보장
      expect(getFontSize('subheading', 0.1)).toBe(UI_TEXT_TOKENS.subheading.min);
    });

    it('minPhysicalPx 설정이 token.min보다 큰 경우 minPhysicalPx 하한선을 보장한다', () => {
      // caption: base 20, min 16
      // minPhysicalPx를 22로 상향 설정
      setMinPhysicalPx(22);

      // scaleX = 0.5 -> 20 * 0.5 = 10 -> min 16보다 minPhysicalPx 22가 우선 적용
      expect(getFontSize('caption', 0.5)).toBe(22);
      expect(getFont('caption', 0.5)).toBe('normal 22px sans-serif');
    });

    it('기본 minPhysicalPx(16px) 이하로 어떤 텍스트도 축소되지 않는다', () => {
      const roles: UITextRole[] = ['badge', 'caption'];
      for (const role of roles) {
        const size = getFontSize(role, 0.01);
        expect(size).toBeGreaterThanOrEqual(16);
      }
    });
  });

  describe('4. Theme Color Switching (getColor)', () => {
    it('기본 상태(highContrast = false)에서 default 테마 색상을 반환한다', () => {
      expect(getColor('primary')).toBe(UI_COLOR_THEMES.default.primary);
      expect(getColor('secondary')).toBe(UI_COLOR_THEMES.default.secondary);
      expect(getColor('danger')).toBe(UI_COLOR_THEMES.default.danger);
      expect(getColor('textPrimary')).toBe(UI_COLOR_THEMES.default.textPrimary);
      expect(getColor('bgDim')).toBe(UI_COLOR_THEMES.default.bgDim);
    });

    it('setHighContrast(true) 활성화 시 highContrast 테마 색상을 반환한다', () => {
      setHighContrast(true);
      expect(getColor('primary')).toBe(UI_COLOR_THEMES.highContrast.primary);
      expect(getColor('secondary')).toBe(UI_COLOR_THEMES.highContrast.secondary);
      expect(getColor('danger')).toBe(UI_COLOR_THEMES.highContrast.danger);
      expect(getColor('bgDim')).toBe(UI_COLOR_THEMES.highContrast.bgDim);
      expect(getColor('border')).toBe(UI_COLOR_THEMES.highContrast.border);
    });

    it('setHighContrast(false) 또는 resetAccessibility() 시 default 테마로 복귀한다', () => {
      setHighContrast(true);
      expect(getColor('primary')).toBe(UI_COLOR_THEMES.highContrast.primary);

      setHighContrast(false);
      expect(getColor('primary')).toBe(UI_COLOR_THEMES.default.primary);

      setHighContrast(true);
      resetAccessibility();
      expect(getColor('primary')).toBe(UI_COLOR_THEMES.default.primary);
      expect(getAccessibility().highContrast).toBe(false);
    });

    it('존재하지 않는 색상 키 요청 시 안전한 기본값(#FFFFFF)을 반환한다', () => {
      expect(getColor('non_existent_key')).toBe('#FFFFFF');
    });
  });

  describe('5. getLayoutSlot (Virtual to Physical Coordinates)', () => {
    it('가상 해상도 1080x2160 기준에서는 UI_LAYOUT 좌표를 그대로 반환한다', () => {
      const slot = getLayoutSlot('hud', 'playerHpBar', 1080, 2160);
      const expected = UI_LAYOUT.hud.playerHpBar;

      expect(slot.x).toBe(expected.x);
      expect(slot.y).toBe(expected.y);
      expect(slot.w).toBe(expected.w);
      expect(slot.h).toBe(expected.h);
      expect(slot.scaleX).toBe(1.0);
      expect(slot.scaleY).toBe(1.0);
    });

    it('물리 해상도(540x1080, 0.5배) 변환 시 정확한 0.5배 물리 좌표를 반환한다', () => {
      const slot = getLayoutSlot('hud', 'playerHpBar', 540, 1080);
      const expected = UI_LAYOUT.hud.playerHpBar;

      expect(slot.x).toBe(Math.round(expected.x * 0.5));
      expect(slot.y).toBe(Math.round(expected.y * 0.5));
      expect(slot.w).toBe(Math.round(expected.w * 0.5));
      expect(slot.h).toBe(Math.round(expected.h * 0.5));
      expect(slot.scaleX).toBe(0.5);
      expect(slot.scaleY).toBe(0.5);
    });

    it('element 미지정 시 화면(screen) 슬롯 자체의 좌표를 변환하여 반환한다', () => {
      const slot = getLayoutSlot('bottomBar', undefined, 1080, 2160);
      expect(slot.x).toBe(UI_LAYOUT.bottomBar.x);
      expect(slot.y).toBe(UI_LAYOUT.bottomBar.y);
      expect(slot.w).toBe(UI_LAYOUT.bottomBar.w);
      expect(slot.h).toBe(UI_LAYOUT.bottomBar.h);
    });

    it('존재하지 않는 화면 또는 요소 지정 시 0 좌표 슬롯을 안전하게 반환한다', () => {
      const slot = getLayoutSlot('non_existent_screen', 'unknown', 540, 1080);
      expect(slot.x).toBe(0);
      expect(slot.y).toBe(0);
      expect(slot.w).toBe(0);
      expect(slot.h).toBe(0);
      expect(slot.scaleX).toBe(0.5);
      expect(slot.scaleY).toBe(0.5);
    });
  });

  describe('6. UIText 네임스페이스 및 싱글톤 객체 정합성', () => {
    it('UIText 네임스페이스 객체가 모든 유틸리티 함수를 동일하게 포함한다', () => {
      expect(UIText.getFont).toBe(getFont);
      expect(UIText.getFontSize).toBe(getFontSize);
      expect(UIText.getColor).toBe(getColor);
      expect(UIText.getLayoutSlot).toBe(getLayoutSlot);
      expect(UIText.setFontScale).toBe(setFontScale);
      expect(UIText.setHighContrast).toBe(setHighContrast);
      expect(UIText.setMinPhysicalPx).toBe(setMinPhysicalPx);
      expect(UIText.resetAccessibility).toBe(resetAccessibility);
      expect(UIText.getAccessibility).toBe(getAccessibility);
    });
  });
});
