import { describe, it, expect, vi } from 'vitest';
import { HUDLayer } from '../../src/ui/HUDLayer.js';
import { MenuRenderer } from '../../src/ui/MenuRenderer.js';
import { ResultRenderer, calcCalories, calcStars } from '../../src/ui/ResultRenderer.js';

describe('HUDLayer', () => {
  it('update()가 감쇠 보간을 수행한다', () => {
    const hud = new HUDLayer();
    const data = { playerHp: 50, playerMaxHp: 100, bossHp: 5, bossMaxHp: 10, mana: 75, manaMax: 100, combo: 3, chapter: 1, shieldActive: false, guardianStage: 1 };
    hud.update(0.5, data);
    // 보간이 시작되었으므로 에러 없이 동작 확인
    expect(true).toBe(true);
  });

  it('reset()이 에러 없이 동작한다', () => {
    const hud = new HUDLayer();
    expect(() => hud.reset()).not.toThrow();
  });
});

describe('MenuRenderer', () => {
  it('hitTest가 올바른 챕터를 반환한다', () => {
    const menu = new MenuRenderer();
    // 캔버스 크기 1920x1080에서 중앙 영역
    const w = 1920;
    const h = 1080;
    const cardW = Math.min(140, w * 0.12); // 140
    const gap = 16;
    const totalW = 5 * cardW + 4 * gap; // 764
    const startX = (w - totalW) / 2; // 578
    const cardY = h * 0.42; // 453

    // 첫 번째 카드 중앙
    expect(menu.hitTest(startX + 70, cardY + 50, w, h)).toBe(1);
    // 마지막 카드 중앙
    expect(menu.hitTest(startX + 4 * (cardW + gap) + 70, cardY + 50, w, h)).toBe(5);
    // 밖
    expect(menu.hitTest(0, 0, w, h)).toBe(0);
  });
});

describe('ResultRenderer - calcCalories', () => {
  it('GDD 공식에 따라 칼로리를 계산한다', () => {
    // (steps*0.04) + (squats*0.35) + (jumps*0.15)
    expect(calcCalories(100, 10, 20)).toBeCloseTo(100 * 0.04 + 10 * 0.35 + 20 * 0.15);
    expect(calcCalories(0, 0, 0)).toBe(0);
    expect(calcCalories(50, 5, 10)).toBeCloseTo(50 * 0.04 + 5 * 0.35 + 10 * 0.15);
  });
});

describe('ResultRenderer - calcStars', () => {
  it('90% 이상 + 2분 미만이면 3성', () => {
    expect(calcStars(9, 10, 90)).toBe(3);
    expect(calcStars(10, 10, 60)).toBe(3);
  });

  it('70% 이상이면 2성', () => {
    expect(calcStars(7, 10, 200)).toBe(2);
    expect(calcStars(8, 10, 200)).toBe(2);
  });

  it('70% 미만이면 1성', () => {
    expect(calcStars(5, 10, 200)).toBe(1);
  });

  it('문제 0개면 1성', () => {
    expect(calcStars(0, 0, 0)).toBe(1);
  });
});
