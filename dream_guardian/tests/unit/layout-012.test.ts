/**
 * [LAYOUT-012] (Issue #583) HUD 글자 크기 textScale 설정 이전
 *
 * 1. 기본값 1.0에서 기존 font 문자열과 100% 일치 (특성화/출력 고정 테스트)
 * 2. textScale 변경 시 매 프레임 UI_LAYOUT에서 다시 읽어 해당 텍스트의 font px만 비례 변경
 * 3. flattenLayoutBindings 바인딩 노출 및 getLayoutKeyRule (0.5~3.0, step 0.01) 적용 검증
 * 4. applyLayoutOverride를 통한 textScale 오버라이드 및 유효성 검증 (0.5~3.0 허용, 범위 밖 거부)
 * 5. 접근성 fontScale 연동 및 하한선 유지
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUDLayer, type HUDData } from '../../src/ui/HUDLayer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UIText, setFontScale } from '../../src/utils/UIText.js';
import {
  flattenLayoutBindings,
  resetLayoutTo,
  snapshotLayout,
} from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride.js';

const pristine = snapshotLayout(UI_LAYOUT);

const dummyDataLowCombo: HUDData = {
  playerHp: 80,
  playerMaxHp: 100,
  bossHp: 6,
  bossMaxHp: 10,
  combo: 3,
  chapter: 1,
  guardianStage: 1,
};

const dummyDataHighCombo: HUDData = {
  playerHp: 80,
  playerMaxHp: 100,
  bossHp: 6,
  bossMaxHp: 10,
  combo: 7,
  chapter: 1,
  guardianStage: 1,
};

function createContext() {
  const fontsSet: string[] = [];
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
    fillText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    get font() {
      return _font;
    },
    set font(v: string) {
      _font = v;
      fontsSet.push(v);
    },
    get fontsSet() {
      return fontsSet;
    },
  };
}

describe('LAYOUT-012 HUD 글자 크기 textScale 설정 이전 (#583)', () => {
  beforeEach(() => {
    UIText.resetAccessibility();
    imageLoader.clear();
  });

  afterEach(() => {
    for (const key of Object.keys(UI_LAYOUT.hud)) {
      if (!(key in pristine.hud)) delete (UI_LAYOUT.hud as any)[key];
    }
    delete (UI_LAYOUT.hud.playerHpBar as any).textScale;
    delete (UI_LAYOUT.hud.bossHpBar as any).textScale;
    delete (UI_LAYOUT.hud.bossName as any).textScale;
    delete (UI_LAYOUT.hud.comboBadge as any).textScale;
    resetLayoutTo(UI_LAYOUT, pristine);
    UIText.resetAccessibility();
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 기본값 1.0 특성화 테스트 (기존 폰트 문자열 100% 보존)', () => {
    it('기본값 1.0에서 플레이어 HP, 보스 HP, 보스 이름, 콤보 폰트가 기존과 완전히 일치한다 (combo < 5)', () => {
      const ctx = createContext();
      const hud = new HUDLayer();
      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // 플레이어 HP 라벨: caption 26px 볼드
      expect(ctx.fontsSet).toContain('bold 26px sans-serif');
      // 보스 HP 라벨: caption 26px 볼드
      expect(ctx.fontsSet.filter((f) => f === 'bold 26px sans-serif').length).toBeGreaterThanOrEqual(2);
      // 보스 이름: badge 28px 볼드
      expect(ctx.fontsSet).toContain('bold 28px sans-serif');
      // 콤보 (combo < 5): badge 24px 볼드
      expect(ctx.fontsSet).toContain('bold 24px sans-serif');
    });

    it('기본값 1.0에서 combo >= 5일 때 콤보 폰트가 body 36px 볼드이다', () => {
      const ctx = createContext();
      const hud = new HUDLayer();
      hud.render(ctx as never, 1080, 2160, dummyDataHighCombo);

      expect(ctx.fontsSet).toContain('bold 36px sans-serif');
    });
  });

  describe('2. textScale 비례 조정 및 매 프레임 동적 반영', () => {
    it('playerHpText.textScale 변경 시 플레이어 HP 폰트 크기만 비례 조정된다', () => {
      const ctx = createContext();
      const hud = new HUDLayer();

      (UI_LAYOUT.hud as any).playerHpText.textScale = 1.5;
      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // 플레이어 HP: 26 * 1.5 = 39px
      expect(ctx.fontsSet).toContain('bold 39px sans-serif');
      // 보스 HP는 여전히 기본 26px
      expect(ctx.fontsSet).toContain('bold 26px sans-serif');
      // 보스 이름은 여전히 기본 28px
      expect(ctx.fontsSet).toContain('bold 28px sans-serif');
    });

    it('bossHpText.textScale 변경 시 보스 HP 폰트 크기만 비례 조정된다', () => {
      const ctx = createContext();
      const hud = new HUDLayer();

      (UI_LAYOUT.hud as any).bossHpText.textScale = 1.5;
      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // 보스 HP: 26 * 1.5 = 39px
      expect(ctx.fontsSet).toContain('bold 39px sans-serif');
      // 플레이어 HP는 기본 26px
      expect(ctx.fontsSet).toContain('bold 26px sans-serif');
    });

    it('bossNameText.textScale 변경 시 보스 이름 폰트 크기만 비례 조정된다', () => {
      const ctx = createContext();
      const hud = new HUDLayer();

      (UI_LAYOUT.hud as any).bossNameText.textScale = 1.5;
      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // 보스 이름: 28 * 1.5 = 42px
      expect(ctx.fontsSet).toContain('bold 42px sans-serif');
      expect(ctx.fontsSet).not.toContain('bold 28px sans-serif');
    });

    it('comboText.textScale 변경 시 콤보 폰트 크기만 비례 조정된다', () => {
      const hud = new HUDLayer();

      // combo < 5: 24 * 1.5 = 36px
      const ctxLow = createContext();
      (UI_LAYOUT.hud as any).comboText.textScale = 1.5;
      hud.render(ctxLow as never, 1080, 2160, dummyDataLowCombo);
      expect(ctxLow.fontsSet).toContain('bold 36px sans-serif');

      // combo >= 5: 36 * 1.5 = 54px
      const ctxHigh = createContext();
      hud.render(ctxHigh as never, 1080, 2160, dummyDataHighCombo);
      expect(ctxHigh.fontsSet).toContain('bold 54px sans-serif');
    });

    it('대체 키(playerHp, bossHp, bossName)로도 textScale을 읽을 수 있다', () => {
      const ctx = createContext();
      const hud = new HUDLayer();

      (UI_LAYOUT.hud as any).playerHp = { textScale: 1.25 };
      (UI_LAYOUT.hud as any).bossHp = { textScale: 1.25 };
      (UI_LAYOUT.hud.bossName as any).textScale = 1.25;

      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // 26 * 1.25 = 32.5 -> 33px
      expect(ctx.fontsSet).toContain('bold 33px sans-serif');
      // 28 * 1.25 = 35px
      expect(ctx.fontsSet).toContain('bold 35px sans-serif');
    });

    it('playerHpBar, bossHpBar, bossName, comboBadge에 직접 설정된 textScale도 지원한다', () => {
      const ctx = createContext();
      const hud = new HUDLayer();

      (UI_LAYOUT.hud.playerHpBar as any).textScale = 1.5;
      (UI_LAYOUT.hud.bossHpBar as any).textScale = 1.5;
      (UI_LAYOUT.hud.bossName as any).textScale = 1.5;
      (UI_LAYOUT.hud.comboBadge as any).textScale = 1.5;

      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // 26 * 1.5 = 39px
      expect(ctx.fontsSet).toContain('bold 39px sans-serif');
      // 28 * 1.5 = 42px
      expect(ctx.fontsSet).toContain('bold 42px sans-serif');
      // combo < 5: 24 * 1.5 = 36px
      expect(ctx.fontsSet).toContain('bold 36px sans-serif');
    });

    it('매 프레임 UI_LAYOUT에서 다시 읽는다 (동적 변경 즉시 반영)', () => {
      const hud = new HUDLayer();

      // 프레임 1: 기본값 1.0
      const ctx1 = createContext();
      (UI_LAYOUT.hud as any).bossNameText.textScale = 1.0;
      hud.render(ctx1 as never, 1080, 2160, dummyDataLowCombo);
      expect(ctx1.fontsSet).toContain('bold 28px sans-serif');

      // 프레임 2: 2.0으로 동적 변경 -> 28 * 2.0 = 56px
      const ctx2 = createContext();
      (UI_LAYOUT.hud as any).bossNameText.textScale = 2.0;
      hud.render(ctx2 as never, 1080, 2160, dummyDataLowCombo);
      expect(ctx2.fontsSet).toContain('bold 56px sans-serif');
      expect(ctx2.fontsSet).not.toContain('bold 28px sans-serif');
    });
  });

  describe('3. DevLayoutPanel 바인딩 및 규칙 연동', () => {
    it('flattenLayoutBindings에 hud의 모든 textScale 경로가 올바른 규칙으로 노출된다', () => {
      const bindings = flattenLayoutBindings(UI_LAYOUT, []);
      const textScaleBindings = bindings.filter((b) => b.path.startsWith('hud.') && b.key === 'textScale');

      const expectedPaths = [
        'hud.playerHpText.textScale',
        'hud.bossHpText.textScale',
        'hud.bossNameText.textScale',
        'hud.comboText.textScale',
      ];

      const foundPaths = textScaleBindings.map((b) => b.path);
      for (const ep of expectedPaths) {
        expect(foundPaths).toContain(ep);
      }

      for (const binding of textScaleBindings) {
        expect(binding.min).toBe(0.5);
        expect(binding.max).toBe(3.0);
        expect(binding.step).toBe(0.01);
        expect(binding.integer).toBe(false);
      }
    });
  });

  describe('4. applyLayoutOverride 검증 및 오버라이드 적용 (왕복 테스트)', () => {
    it('유효한 hud textScale 오버라이드가 경고 없이 target에 적용된다', () => {
      const patch = {
        hud: {
          playerHpText: { textScale: 1.5 },
          bossHpText: { textScale: 1.2 },
          bossNameText: { textScale: 1.3 },
          comboText: { textScale: 0.8 },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.warnings).toEqual([]);
      expect((UI_LAYOUT.hud as any).playerHpText.textScale).toBe(1.5);
      expect((UI_LAYOUT.hud as any).bossHpText.textScale).toBe(1.2);
      expect((UI_LAYOUT.hud as any).bossNameText.textScale).toBe(1.3);
      expect((UI_LAYOUT.hud as any).comboText.textScale).toBe(0.8);
    });

    it('허용 범위(0.5~3.0) 밖의 hud textScale 값은 경고와 함께 거부된다', () => {
      const initial = (UI_LAYOUT.hud as any).playerHpText?.textScale ?? 1.0;
      const patch = {
        hud: {
          playerHpText: { textScale: 0.4 }, // 0.5 미만 거부
          bossHpText: { textScale: 3.5 }, // 3.0 초과 거부
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.warnings.length).toBe(2);
      expect((UI_LAYOUT.hud as any).playerHpText?.textScale).toBe(initial);
    });
  });

  describe('5. 접근성 fontScale 연동', () => {
    it('저시력 모드 fontScale(1.5)과 textScale(1.2)이 결합되어 계산된다', () => {
      setFontScale(1.5);
      (UI_LAYOUT.hud as any).playerHpText.textScale = 1.2;

      const ctx = createContext();
      const hud = new HUDLayer();
      hud.render(ctx as never, 1080, 2160, dummyDataLowCombo);

      // base: 20, scaleX = 1.2, fontScale = 1.5 -> scaled = 20 * 1.2 * 1.5 = 36px
      // minFloor: Math.round(26 * 1.2) = 31px
      // Math.max(36, 31) = 36px
      expect(ctx.fontsSet).toContain('bold 36px sans-serif');
    });
  });
});
