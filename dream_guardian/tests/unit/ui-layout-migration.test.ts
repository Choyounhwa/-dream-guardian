import { describe, it, expect } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { MenuRenderer } from '../../src/ui/MenuRenderer.js';
import { ResultRenderer } from '../../src/ui/ResultRenderer.js';
import { BottomBar, BOTTOM_BAR_CONFIG } from '../../src/ui/BottomBar.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { PauseModal } from '../../src/ui/PauseModal.js';
import { HUDLayer } from '../../src/ui/HUDLayer.js';

describe('UI Layout Migration (Issue #259 / UI-TOKEN-004)', () => {
  const W = 1080;
  const H = 2160;

  describe('1. BottomBar - UI_LAYOUT.bottomBar 통합 및 하위 호환성', () => {
    it('BOTTOM_BAR_CONFIG가 UI_LAYOUT.bottomBar와 동일한 참조이거나 동일한 속성을 제공한다', () => {
      expect(BOTTOM_BAR_CONFIG).toBe(UI_LAYOUT.bottomBar);
      expect(BOTTOM_BAR_CONFIG.height).toBe(UI_LAYOUT.bottomBar.height);
      expect(BOTTOM_BAR_CONFIG.y).toBe(UI_LAYOUT.bottomBar.y);
      expect(BOTTOM_BAR_CONFIG.settingsBtn).toEqual(UI_LAYOUT.bottomBar.settingsBtn);
      expect(BOTTOM_BAR_CONFIG.actionBtn).toEqual(UI_LAYOUT.bottomBar.actionBtn);
    });

    it('BottomBar의 설정 버튼 및 액션 버튼 히트 테스트가 UI_LAYOUT.bottomBar 좌표와 정확히 일치한다', () => {
      const bar = new BottomBar();
      const s = UI_LAYOUT.bottomBar.settingsBtn;
      const a = UI_LAYOUT.bottomBar.actionBtn;

      // 설정 버튼 중심 히트 테스트
      expect(bar.hitTestSettings(s.x + s.w / 2, s.y + s.h / 2, W, H)).toBe(true);
      expect(bar.hitTestSettings(s.x - 10, s.y - 10, W, H)).toBe(false);

      // 액션 버튼 중심 히트 테스트
      expect(bar.hitTestAction(a.x + a.w / 2, a.y + a.h / 2, W, H)).toBe(true);
      expect(bar.hitTestAction(a.x - 10, a.y - 10, W, H)).toBe(false);
    });

    it('UI_LAYOUT.bottomBar에 마나 게이지 좌표 슬롯(manaBar)이 정의되어 있다', () => {
      expect(UI_LAYOUT.bottomBar.manaBar).toEqual({
        x: 210,
        y: 2038,
        w: 560,
        h: 50,
      });
    });
  });

  describe('2. MenuRenderer - UI_LAYOUT.menu 및 UI_LAYOUT.subMenu 연동', () => {
    it('getChapterLayouts가 UI_LAYOUT.menu.chapterCards와 일치하는 좌표를 생성한다', () => {
      const menu = new MenuRenderer();
      const layouts = menu.getChapterLayouts(W, H);

      expect(layouts).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        const slot = UI_LAYOUT.menu.chapterCards[i];
        expect(layouts[i].chapter).toBe(slot.chapter);
        expect(layouts[i].x).toBe(slot.x);
        expect(layouts[i].y).toBe(slot.y);
        expect(layouts[i].w).toBe(UI_LAYOUT.menu.cardWidth);
        expect(layouts[i].h).toBe(UI_LAYOUT.menu.cardHeight);
      }
    });

    it('getLocomotionButtonLayout이 UI_LAYOUT.menu.locomotionBtn 슬롯과 일치한다', () => {
      const menu = new MenuRenderer();
      const layout = menu.getLocomotionButtonLayout(W, H);
      expect(layout).toEqual(UI_LAYOUT.menu.locomotionBtn);
      expect(UI_LAYOUT.menu.locomotionBtn).toEqual({
        x: 290,
        y: 375,
        w: 500,
        h: 56,
      });
    });

    it('hitTest 및 hitTestLocomotion이 UI_LAYOUT 기준 슬롯에서 정상 작동한다', () => {
      const menu = new MenuRenderer();
      const card1 = UI_LAYOUT.menu.chapterCards[0];
      expect(menu.hitTest(card1.x + 10, card1.y + 10, W, H)).toBe(1);

      const lBtn = UI_LAYOUT.menu.locomotionBtn;
      expect(menu.hitTestLocomotion(lBtn.x + 10, lBtn.y + 10, W, H)).toBe(true);
    });

    it('getSubMenuLayouts가 UI_LAYOUT.subMenu.grid 및 backBtn 슬롯을 사용한다', () => {
      const menu = new MenuRenderer();
      const subLevels = [
        { subLevel: 1, title: '1단계', count: 10 },
        { subLevel: 2, title: '2단계', count: 10 },
      ];
      const layouts = menu.getSubMenuLayouts(W, H, 1, subLevels);

      // 뒤로가기 버튼(-1)이 UI_LAYOUT.subMenu.backBtn과 일치
      const back = layouts.find((l) => l.subLevel === -1);
      expect(back).toBeDefined();
      expect(back!.x).toBe(UI_LAYOUT.subMenu.backBtn.x);
      expect(back!.y).toBe(UI_LAYOUT.subMenu.backBtn.y);
      expect(back!.w).toBe(UI_LAYOUT.subMenu.backBtn.w);
      expect(back!.h).toBe(UI_LAYOUT.subMenu.backBtn.h);

      // 첫 번째 단계 카드가 grid startX, startY와 일치
      const first = layouts[0];
      expect(first.x).toBe(UI_LAYOUT.subMenu.grid.startX);
      expect(first.y).toBe(UI_LAYOUT.subMenu.grid.startY);
      expect(first.w).toBe(UI_LAYOUT.subMenu.grid.w);
      expect(first.h).toBe(UI_LAYOUT.subMenu.grid.h);
    });
  });

  describe('3. ResultRenderer - UI_LAYOUT.result 연동', () => {
    it('getPanelLayout이 UI_LAYOUT.result.panel 슬롯을 반환한다', () => {
      const renderer = new ResultRenderer();
      const layout = renderer.getPanelLayout(W, H);

      expect(layout.x).toBe(UI_LAYOUT.result.panel.x);
      expect(layout.y).toBe(UI_LAYOUT.result.panel.y);
      expect(layout.w).toBe(UI_LAYOUT.result.panel.w);
      expect(layout.h).toBe(UI_LAYOUT.result.panel.h);
    });

    it('getStatLineHeight가 UI_LAYOUT.result.statLineHeight를 기반으로 계산된다', () => {
      const renderer = new ResultRenderer();
      expect(renderer.getStatLineHeight(H)).toBe(UI_LAYOUT.result.statLineHeight);
      expect(UI_LAYOUT.result.statLineHeight).toBe(74);
    });
  });

  describe('4. SettingsModal - UI_LAYOUT.settings 연동', () => {
    it('모달 내부 버튼 좌표가 UI_LAYOUT.settings에 정의된 슬롯과 일치한다', () => {
      const modal = new SettingsModal();
      const closeLayout = modal.getButtonLayout('close', W, H);
      expect(closeLayout).toEqual(UI_LAYOUT.settings.closeBtn);
      expect(UI_LAYOUT.settings.closeBtn).toEqual({
        x: 850,
        y: 510,
        w: 60,
        h: 60,
      });

      // UI_LAYOUT.settings.buttons 슬롯 검증
      expect(UI_LAYOUT.settings.buttons).toBeDefined();
      const buttons = UI_LAYOUT.settings.buttons!;
      expect(modal.getButtonLayout('camera', W, H)).toEqual(buttons.camera);
      expect(modal.getButtonLayout('fullscreen', W, H)).toEqual(buttons.fullscreen);
      expect(modal.getButtonLayout('skeleton', W, H)).toEqual(buttons.skeleton);
      expect(modal.getButtonLayout('sound', W, H)).toEqual(buttons.sound);
      expect(modal.getButtonLayout('locomotion', W, H)).toEqual(buttons.locomotion);
    });

    it('handleClick이 UI_LAYOUT 기반 좌표로 정상 판정한다', () => {
      const modal = new SettingsModal();
      modal.open();
      const close = UI_LAYOUT.settings.closeBtn;
      expect(modal.handleClick(close.x + close.w / 2, close.y + close.h / 2, W, H)).toBe('close');
    });
  });

  describe('5. PauseModal - UI_LAYOUT.pause 연동', () => {
    it('getButtonLayout이 UI_LAYOUT.pause.resumeBtn 및 quitBtn과 일치한다', () => {
      const modal = new PauseModal();
      expect(modal.getButtonLayout('resume', W, H)).toEqual(UI_LAYOUT.pause.resumeBtn);
      expect(modal.getButtonLayout('quit', W, H)).toEqual(UI_LAYOUT.pause.quitBtn);
    });

    it('hitTest가 UI_LAYOUT.pause 슬롯 기반으로 정상 판정한다', () => {
      const modal = new PauseModal();
      modal.open();
      const r = UI_LAYOUT.pause.resumeBtn;
      const q = UI_LAYOUT.pause.quitBtn;

      expect(modal.hitTest(r.x + r.w / 2, r.y + r.h / 2, W, H)).toBe('resume');
      expect(modal.hitTest(q.x + q.w / 2, q.y + q.h / 2, W, H)).toBe('quit');
      expect(modal.hitTest(10, 10, W, H)).toBe('backdrop');
    });
  });

  describe('6. HUDLayer - UI_LAYOUT.hud 연동', () => {
    it('UI_LAYOUT.hud에 HP바 및 콤보 뱃지 레이아웃 슬롯이 정의되어 있다', () => {
      const hud = new HUDLayer();
      expect(hud).toBeDefined();
      expect(UI_LAYOUT.hud.playerHpBar).toEqual({ x: 20, y: 20, w: 320, h: 32 });
      expect(UI_LAYOUT.hud.bossHpBar).toEqual({ x: 740, y: 20, w: 320, h: 32 });
      expect(UI_LAYOUT.hud.comboBadge).toEqual({ w: 160, h: 48, y: 48, marginRight: 24 });
    });
  });
});
