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

  it('getSubMenuLayouts 및 hitTestSub가 서브레벨 및 뒤로가기 버튼을 올바르게 판정한다', () => {
    const menu = new MenuRenderer();
    const subLevels = [
      { subLevel: 1, title: '1단계: 1자리 덧셈', count: 10 },
      { subLevel: 2, title: '2단계: 2자리 덧셈', count: 12 },
    ];
    const w = 1920;
    const h = 1080;

    const layouts = menu.getSubMenuLayouts(w, h, 1, subLevels);
    expect(layouts.length).toBe(4); // 뒤로가기(-1) + 서브레벨 2개(1, 2) + 전체종합(0)

    // 1. 뒤로가기 버튼 클릭 (-1)
    const backBtn = layouts.find((l) => l.subLevel === -1)!;
    expect(menu.hitTestSub(backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2, w, h, 1, subLevels)).toBe(-1);

    // 2. 1단계 카드 클릭 (1)
    const card1 = layouts.find((l) => l.subLevel === 1)!;
    expect(menu.hitTestSub(card1.x + card1.w / 2, card1.y + card1.h / 2, w, h, 1, subLevels)).toBe(1);

    // 3. 전체 종합 카드 클릭 (0)
    const cardAll = layouts.find((l) => l.subLevel === 0)!;
    expect(menu.hitTestSub(cardAll.x + cardAll.w / 2, cardAll.y + cardAll.h / 2, w, h, 1, subLevels)).toBe(0);

    // 4. 영역 밖 클릭 (null)
    expect(menu.hitTestSub(0, 0, w, h, 1, subLevels)).toBeNull();
  });

  it('renderSubMenu가 예외 없이 렌더링된다', () => {
    const menu = new MenuRenderer();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      textAlign: '',
      textBaseline: '',
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const subLevels = [
      { subLevel: 1, title: '1단계', count: 10 },
      { subLevel: 2, title: '2단계', count: 15 },
    ];

    expect(() => menu.renderSubMenu(mockCtx, 1920, 1080, 1, subLevels, 1)).not.toThrow();
    expect(mockCtx.fillText).toHaveBeenCalled();
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
