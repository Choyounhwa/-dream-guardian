import { describe, it, expect } from 'vitest';
import {
  MenuHitTester,
  type RectBounds,
  type ButtonHitTarget,
} from '../../src/ui/menu/MenuHitTester.js';

describe('MenuHitTester', () => {
  describe('isPointInRect', () => {
    const rect: RectBounds = { x: 100, y: 200, w: 300, h: 150 };

    it('사각형 내부 좌표는 true를 반환한다', () => {
      expect(MenuHitTester.isPointInRect(150, 250, rect)).toBe(true);
      expect(MenuHitTester.isPointInRect(100, 200, rect)).toBe(true);
      expect(MenuHitTester.isPointInRect(400, 350, rect)).toBe(true);
    });

    it('사각형 외부 좌표는 false를 반환한다', () => {
      expect(MenuHitTester.isPointInRect(50, 250, rect)).toBe(false);
      expect(MenuHitTester.isPointInRect(450, 250, rect)).toBe(false);
      expect(MenuHitTester.isPointInRect(200, 150, rect)).toBe(false);
      expect(MenuHitTester.isPointInRect(200, 400, rect)).toBe(false);
    });

    it('패딩을 적용하면 확장된 영역을 적중으로 판정한다', () => {
      // rect x: 100~400, y: 200~350
      // padding: 20 -> x: 80~420, y: 180~370
      expect(MenuHitTester.isPointInRect(90, 250, rect, 20)).toBe(true);
      expect(MenuHitTester.isPointInRect(415, 360, rect, 20)).toBe(true);
      expect(MenuHitTester.isPointInRect(70, 250, rect, 20)).toBe(false);
      expect(MenuHitTester.isPointInRect(200, 380, rect, 20)).toBe(false);
    });
  });

  describe('resolveBounds', () => {
    it('스케일과 패딩에 맞게 바운딩 박스를 계산한다', () => {
      const base: RectBounds = { x: 100, y: 100, w: 200, h: 100 };
      const scaled = MenuHitTester.resolveBounds(base, 2.0, 10);

      // scaled: x = 100*2 - 10 = 190, y = 100*2 - 10 = 190, w = 200*2 + 20 = 420, h = 100*2 + 20 = 220
      expect(scaled).toEqual({
        x: 190,
        y: 190,
        w: 420,
        h: 220,
      });
    });

    it('스케일 1.0 및 기본 패딩 0일 때 원본 크기를 반환한다', () => {
      const base: RectBounds = { x: 50, y: 60, w: 120, h: 80 };
      expect(MenuHitTester.resolveBounds(base)).toEqual({
        x: 50,
        y: 60,
        w: 120,
        h: 80,
      });
    });
  });

  describe('hitTestButton (normal, hover, active 상태 및 disabled)', () => {
    const normalBtn: ButtonHitTarget = {
      id: 'btn_start',
      x: 100,
      y: 100,
      w: 200,
      h: 60,
      state: 'normal',
    };

    const hoverBtn: ButtonHitTarget = {
      id: 'btn_hover',
      x: 100,
      y: 200,
      w: 200,
      h: 60,
      state: 'hover',
    };

    const activeBtn: ButtonHitTarget = {
      id: 'btn_active',
      x: 100,
      y: 300,
      w: 200,
      h: 60,
      state: 'active',
    };

    const disabledBtn: ButtonHitTarget = {
      id: 'btn_disabled',
      x: 100,
      y: 400,
      w: 200,
      h: 60,
      disabled: true,
      state: 'normal',
    };

    it('normal 상태 버튼을 적중 판정한다', () => {
      expect(MenuHitTester.hitTestButton(150, 130, normalBtn)).toBe(true);
      expect(MenuHitTester.hitTestButton(50, 130, normalBtn)).toBe(false);
    });

    it('hover 상태 버튼을 적중 판정한다', () => {
      expect(MenuHitTester.hitTestButton(150, 230, hoverBtn)).toBe(true);
      expect(MenuHitTester.hitTestButton(150, 190, hoverBtn)).toBe(false);
    });

    it('active 상태 버튼을 적중 판정한다', () => {
      expect(MenuHitTester.hitTestButton(150, 330, activeBtn)).toBe(true);
      expect(MenuHitTester.hitTestButton(150, 370, activeBtn)).toBe(false);
    });

    it('disabled 버튼은 영역 내부라도 false를 반환한다', () => {
      expect(MenuHitTester.hitTestButton(150, 430, disabledBtn)).toBe(false);
    });
  });

  describe('hitTestButtons (다중 버튼 목록)', () => {
    const buttons: ButtonHitTarget[] = [
      { id: 'opt_1', x: 50, y: 100, w: 100, h: 50, state: 'normal' },
      { id: 'opt_2', x: 200, y: 100, w: 100, h: 50, state: 'hover' },
      { id: 'opt_3', x: 350, y: 100, w: 100, h: 50, disabled: true, state: 'normal' },
    ];

    it('적중된 버튼 객체를 반환한다', () => {
      const hit = MenuHitTester.hitTestButtons(250, 120, buttons);
      expect(hit).not.toBeNull();
      expect(hit?.id).toBe('opt_2');
    });

    it('적중되지 않으면 null을 반환한다', () => {
      const hit = MenuHitTester.hitTestButtons(10, 10, buttons);
      expect(hit).toBeNull();
    });

    it('disabled 버튼에 위치하면 무시하고 null을 반환한다', () => {
      const hit = MenuHitTester.hitTestButtons(360, 120, buttons);
      expect(hit).toBeNull();
    });
  });

  describe('hitTestChapters', () => {
    const chapters = [
      { chapter: 1, x: 100, y: 200, w: 200, h: 200 },
      { chapter: 2, x: 400, y: 200, w: 200, h: 200 },
      { chapter: 3, x: 100, y: 500, w: 200, h: 200 },
    ];

    it('챕터 카드 영역 적중 시 해당 챕터 번호를 반환한다', () => {
      expect(MenuHitTester.hitTestChapters(150, 250, chapters)).toBe(1);
      expect(MenuHitTester.hitTestChapters(450, 250, chapters)).toBe(2);
      expect(MenuHitTester.hitTestChapters(150, 550, chapters)).toBe(3);
    });

    it('어떤 챕터 카드에도 적중하지 않으면 0을 반환한다', () => {
      expect(MenuHitTester.hitTestChapters(50, 50, chapters)).toBe(0);
      expect(MenuHitTester.hitTestChapters(350, 250, chapters)).toBe(0);
    });

    it('패딩을 적용하여 경계 근처를 적중으로 판정할 수 있다', () => {
      expect(MenuHitTester.hitTestChapters(95, 200, chapters, 10)).toBe(1);
    });
  });

  describe('hitTestLocomotion', () => {
    const btn: RectBounds = { x: 300, y: 1900, w: 480, h: 90 };

    it('운동 버튼 영역 내부면 true를 반환한다', () => {
      expect(MenuHitTester.hitTestLocomotion(400, 1920, btn)).toBe(true);
    });

    it('외부 좌표는 false를 반환한다', () => {
      expect(MenuHitTester.hitTestLocomotion(100, 1920, btn)).toBe(false);
    });

    it('패딩 확장 영역을 적중으로 판정한다', () => {
      expect(MenuHitTester.hitTestLocomotion(295, 1920, btn, 10)).toBe(true);
    });
  });

  describe('hitTestSubLevels', () => {
    const subLevels = [
      { subLevel: 1, x: 100, y: 300, w: 200, h: 100 },
      { subLevel: 2, x: 350, y: 300, w: 200, h: 100 },
      { subLevel: 0, x: 100, y: 450, w: 200, h: 100 },
      { subLevel: -1, x: 100, y: 600, w: 150, h: 80 },
    ];

    it('서브레벨 카드 적중 시 해당 subLevel 번호를 반환한다', () => {
      expect(MenuHitTester.hitTestSubLevels(150, 350, subLevels)).toBe(1);
      expect(MenuHitTester.hitTestSubLevels(400, 350, subLevels)).toBe(2);
      expect(MenuHitTester.hitTestSubLevels(150, 480, subLevels)).toBe(0);
      expect(MenuHitTester.hitTestSubLevels(120, 620, subLevels)).toBe(-1);
    });

    it('적중하지 않으면 null을 반환한다', () => {
      expect(MenuHitTester.hitTestSubLevels(50, 50, subLevels)).toBeNull();
      expect(MenuHitTester.hitTestSubLevels(320, 350, subLevels)).toBeNull();
    });
  });
});
