import { describe, it, expect } from 'vitest';
import {
  UI_TEXT_TOKENS,
  UI_ACCESSIBILITY,
  UI_COLOR_THEMES,
  UI_LAYOUT,
  UI_IMAGE_ASSETS,
  type UITextRole,
  type UITextToken,
  type UIAccessibilityConfig,
  type UIColorTheme,
  type UILayoutSlot,
  type UIImageAssetsConfig,
} from '../../config/ui.config.js';
import * as Config from '../../src/core/Config.js';

describe('UI Design Token System (Issue #256 / UI-TOKEN-001)', () => {
  describe('1. UI_TEXT_TOKENS (8 Text Roles)', () => {
    const EXPECTED_ROLES: Record<UITextRole, { base: number; min: number; weight: string }> = {
      hero: { base: 100, min: 36, weight: 'bold' },
      title: { base: 76, min: 32, weight: 'bold' },
      heading: { base: 54, min: 28, weight: 'bold' },
      subheading: { base: 44, min: 24, weight: 'bold' },
      body: { base: 36, min: 20, weight: 'normal' },
      label: { base: 28, min: 18, weight: 'normal' },
      badge: { base: 24, min: 16, weight: 'bold' },
      caption: { base: 20, min: 16, weight: 'normal' },
    };

    it('8개 역할(hero, title, heading, subheading, body, label, badge, caption)이 모두 정의되어 있다', () => {
      const roles = Object.keys(EXPECTED_ROLES) as UITextRole[];
      expect(Object.keys(UI_TEXT_TOKENS)).toHaveLength(8);

      for (const role of roles) {
        expect(UI_TEXT_TOKENS).toHaveProperty(role);
      }
    });

    it('각 역할별 기본 크기(base), 최소 크기(min), 가중치(weight)가 명세와 정확히 일치한다', () => {
      for (const [role, spec] of Object.entries(EXPECTED_ROLES) as [UITextRole, { base: number; min: number; weight: string }][]) {
        const token: UITextToken = UI_TEXT_TOKENS[role];
        expect(token).toBeDefined();
        expect(token.base).toBe(spec.base);
        expect(token.min).toBe(spec.min);
        expect(token.weight).toBe(spec.weight);
        expect(token.base).toBeGreaterThanOrEqual(token.min);
      }
    });
  });

  describe('2. UI_ACCESSIBILITY (전역 접근성 기본값)', () => {
    it('접근성 기본값이 정확히 설정되어 있다 (fontScale 1.0, highContrast false, minPhysicalPx 16)', () => {
      const a11y: UIAccessibilityConfig = UI_ACCESSIBILITY;
      expect(a11y).toBeDefined();
      expect(a11y.fontScale).toBe(1.0);
      expect(a11y.highContrast).toBe(false);
      expect(a11y.minPhysicalPx).toBe(16);
    });
  });

  describe('3. UI_COLOR_THEMES (default 및 highContrast 2개 테마)', () => {
    const REQUIRED_COLOR_KEYS: (keyof UIColorTheme)[] = [
      'primary',
      'secondary',
      'accent',
      'danger',
      'success',
      'textPrimary',
      'textSecondary',
      'textMuted',
      'textLocked',
      'bgDim',
      'bgCard',
    ];

    it('default와 highContrast 테마가 모두 정의되어 있다', () => {
      expect(UI_COLOR_THEMES).toHaveProperty('default');
      expect(UI_COLOR_THEMES).toHaveProperty('highContrast');
    });

    it('default 테마에 필수 색상 토큰이 모두 유효한 문자열로 존재한다', () => {
      const defaultTheme = UI_COLOR_THEMES.default;
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(defaultTheme[key]).toBeDefined();
        expect(typeof defaultTheme[key]).toBe('string');
        expect(defaultTheme[key]!.length).toBeGreaterThan(0);
      }
    });

    it('highContrast 테마에 필수 색상 토큰이 모두 유효한 문자열로 존재한다', () => {
      const hcTheme = UI_COLOR_THEMES.highContrast;
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(hcTheme[key]).toBeDefined();
        expect(typeof hcTheme[key]).toBe('string');
        expect(hcTheme[key]!.length).toBeGreaterThan(0);
      }
    });

    it('default와 highContrast의 테마 색상 구성이 차별화되어 있다', () => {
      expect(UI_COLOR_THEMES.default.bgDim).not.toBe(UI_COLOR_THEMES.highContrast.bgDim);
    });
  });

  describe('4. UI_LAYOUT (7개 화면 가상 좌표 슬롯: 1080x2160 기준)', () => {
    const REQUIRED_SCREENS = [
      'hud',
      'menu',
      'subMenu',
      'result',
      'bottomBar',
      'settings',
      'pause',
    ] as const;

    it('7개 화면 레이아웃 슬롯이 모두 정의되어 있다', () => {
      for (const screen of REQUIRED_SCREENS) {
        expect(UI_LAYOUT).toHaveProperty(screen);
        const slot = UI_LAYOUT[screen] as UILayoutSlot;
        expect(typeof slot.x).toBe('number');
        expect(typeof slot.y).toBe('number');
        expect(typeof slot.w).toBe('number');
        expect(typeof slot.h).toBe('number');
      }
    });

    it('bottomBar 슬롯이 기존 BottomBar 좌표 규격과 일치한다 (y: 1960, h: 200, settingsBtn, actionBtn)', () => {
      const bb = UI_LAYOUT.bottomBar;
      expect(bb.y).toBe(1960);
      expect(bb.h).toBe(200);
      expect(bb.settingsBtn).toEqual({ x: 30, y: 1990, w: 140, h: 140 });
      expect(bb.actionBtn).toEqual({ x: 810, y: 1990, w: 240, h: 140 });
    });

    it('result 슬롯이 마젠타 결과 카드 패널 규격과 일치한다 (x: 100, y: 240, w: 880, h: 1580)', () => {
      const res = UI_LAYOUT.result;
      expect(res.panel).toEqual({ x: 100, y: 240, w: 880, h: 1580 });
      expect(res.statLineHeight).toBe(74);
    });

    it('pause 슬롯이 PauseModal 모달 규격과 일치한다 (x: 140, y: 720, w: 800, h: 720)', () => {
      const pause = UI_LAYOUT.pause;
      expect(pause.modal).toEqual({ x: 140, y: 720, w: 800, h: 720 });
      expect(pause.resumeBtn).toBeDefined();
      expect(pause.quitBtn).toBeDefined();
    });

    it('settings 슬롯이 SettingsModal 모달 규격과 일치한다 (x: 140, y: 480, w: 800, h: 1080)', () => {
      const settings = UI_LAYOUT.settings;
      expect(settings.modal).toEqual({ x: 140, y: 480, w: 800, h: 1080 });
      expect(settings.closeBtn).toEqual({ x: 850, y: 510, w: 60, h: 60 });
    });

    it('hud 슬롯이 플레이어/보스 HP바 좌표 규격을 갖는다', () => {
      const hud = UI_LAYOUT.hud;
      expect(hud.playerHpBar).toEqual({ x: 20, y: 20, w: 320, h: 32 });
      expect(hud.bossHpBar).toEqual({ x: 740, y: 20, w: 320, h: 32 });
    });

    it('menu 및 subMenu 슬롯이 카드 규격을 포함한다', () => {
      expect(UI_LAYOUT.menu.cardWidth).toBe(360);
      expect(UI_LAYOUT.menu.cardHeight).toBe(380);
      expect(UI_LAYOUT.menu.chapterCards).toHaveLength(5);

      expect(UI_LAYOUT.subMenu.cardWidth).toBe(420);
      expect(UI_LAYOUT.subMenu.cardHeight).toBe(380);
      expect(UI_LAYOUT.subMenu.backBtn).toEqual({ x: 780, y: 1990, w: 270, h: 140 });
    });
  });

  describe('5. UI_IMAGE_ASSETS (6개 카테고리 이미지 경로 슬롯)', () => {
    const REQUIRED_CATEGORIES = [
      'menu',
      'hud',
      'result',
      'bottomBar',
      'settings',
      'battle',
    ] as const;

    it('6개 카테고리 슬롯이 모두 정의되어 있다', () => {
      const assets: UIImageAssetsConfig = UI_IMAGE_ASSETS;
      for (const cat of REQUIRED_CATEGORIES) {
        expect(assets).toHaveProperty(cat);
      }
    });

    it('menu 및 hud 슬롯에는 에셋 경로가 설정되어 있고, 그 외 카테고리의 초기값은 null (프로시저럴 렌더링 폴백)이다', () => {
      // 1) menu 카테고리: 신규 등록된 이미지 경로 검증
      expect(UI_IMAGE_ASSETS.menu.titleBg).toBe('/assets/ui/menu/title_bg.png');
      expect(UI_IMAGE_ASSETS.menu.cardFrame).toBe('/assets/ui/menu/chapter_card_frame.png');
      expect(UI_IMAGE_ASSETS.menu.lockIcon).toBe('/assets/ui/menu/lock_icon.png');
      expect(UI_IMAGE_ASSETS.menu.starFull).toBe('/assets/ui/menu/star_full.png');
      expect(UI_IMAGE_ASSETS.menu.starEmpty).toBe('/assets/ui/menu/star_empty.png');

      // 2) hud 카테고리 (Issue #267 / UI-ASSET-002)
      expect(UI_IMAGE_ASSETS.hud.hpBarFrame).toBe('/assets/ui/hud/hp_bar_frame.png');
      expect(UI_IMAGE_ASSETS.hud.hpBarFillPlayer).toBe('/assets/ui/hud/hp_bar_fill_player.png');
      expect(UI_IMAGE_ASSETS.hud.hpBarFillBoss).toBe('/assets/ui/hud/hp_bar_fill_boss.png');
      expect(UI_IMAGE_ASSETS.hud.comboIcon).toBe('/assets/ui/hud/combo_icon.png');
      expect(UI_IMAGE_ASSETS.hud.bossNameplate).toBe('/assets/ui/hud/boss_nameplate.png');
      // hud 레거시 슬롯 null 유지
      expect(UI_IMAGE_ASSETS.hud.playerHpBar).toBeNull();
      expect(UI_IMAGE_ASSETS.hud.bossHpBar).toBeNull();
      expect(UI_IMAGE_ASSETS.hud.manaFlask).toBeNull();
      expect(UI_IMAGE_ASSETS.hud.comboBadge).toBeNull();

      // 3) result 카테고리 (Issue #268 / UI-ASSET-003)
      expect(UI_IMAGE_ASSETS.result.panelBg).toBe('/assets/ui/result/panel_bg.png');
      expect(UI_IMAGE_ASSETS.result.victoryTitle).toBe('/assets/ui/result/victory_title.png');
      expect(UI_IMAGE_ASSETS.result.defeatTitle).toBe('/assets/ui/result/defeat_title.png');
      expect(UI_IMAGE_ASSETS.result.victoryBadge).toBe('/assets/ui/result/victory_title.png');
      expect(UI_IMAGE_ASSETS.result.defeatBadge).toBe('/assets/ui/result/defeat_title.png');
      expect(UI_IMAGE_ASSETS.result.starFilled).toBe('/assets/ui/result/star_filled.png');
      expect(UI_IMAGE_ASSETS.result.starEmpty).toBe('/assets/ui/result/star_empty.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_accuracy).toBe('/assets/ui/result/stat_accuracy.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_combo).toBe('/assets/ui/result/stat_combo.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_time).toBe('/assets/ui/result/stat_time.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_run).toBe('/assets/ui/result/stat_run.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_squat).toBe('/assets/ui/result/stat_squat.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_jump).toBe('/assets/ui/result/stat_jump.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_pose).toBe('/assets/ui/result/stat_pose.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_calorie).toBe('/assets/ui/result/stat_calorie.png');

      // 4) 그 외 카테고리(bottomBar, settings, battle): 모든 슬롯이 null 유지
      const nonConfiguredCategories = REQUIRED_CATEGORIES.filter((c) => c !== 'menu' && c !== 'hud' && c !== 'result');
      for (const cat of nonConfiguredCategories) {
        const slots = UI_IMAGE_ASSETS[cat];
        const keys = Object.keys(slots);
        expect(keys.length).toBeGreaterThan(0);

        for (const key of keys) {
          expect(slots[key]).toBeNull();
        }
      }
    });
  });

  describe('6. src/core/Config.ts re-export 검증', () => {
    it('Config 모듈에서 모든 UI 토큰 상수 및 설정이 re-export 된다', () => {
      expect(Config.UI_TEXT_TOKENS).toBe(UI_TEXT_TOKENS);
      expect(Config.UI_ACCESSIBILITY).toBe(UI_ACCESSIBILITY);
      expect(Config.UI_COLOR_THEMES).toBe(UI_COLOR_THEMES);
      expect(Config.UI_LAYOUT).toBe(UI_LAYOUT);
      expect(Config.UI_IMAGE_ASSETS).toBe(UI_IMAGE_ASSETS);
    });
  });
});
