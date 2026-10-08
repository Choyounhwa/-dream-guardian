import { describe, expect, it, vi } from 'vitest';
import {
  HUDLayer,
  type HUDData,
  type HUDPresentationContext,
} from '../../src/ui/HUDLayer.js';
import {
  BottomBar,
  BOTTOM_BAR_CONFIG,
  type BottomBarPresentationContext,
  type BottomBarSlot,
} from '../../src/ui/BottomBar.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import {
  createDefaultUIPresentationDocument,
} from '../../src/data/UIPresentation.js';

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
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    drawImage: vi.fn((img: any, ...args: number[]) =>
      calls.push({ method: 'drawImage', args: [img, ...args] })
    ),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('[Issue #440 / UI-VIS-010] 공통 HUD·하단바 표시 주입 경계', () => {
  const W = 1080;
  const H = 2160;

  const sampleHUDData: HUDData = {
    playerHp: 75,
    playerMaxHp: 100,
    bossHp: 8,
    bossMaxHp: 10,
    combo: 4,
    chapter: 1,
    guardianStage: 1,
  };

  describe('1. 기본 호출 호환성 및 기본 bounds 조회 (미주입 시)', () => {
    it('HUDLayer 기본 인스턴스는 UI_LAYOUT.hud 기준의 bounds를 제공한다', () => {
      const hud = new HUDLayer();
      expect(hud.getPresentationContext()).toBeUndefined();

      const pBounds = hud.getPlayerHpBarBounds(W, H);
      expect(pBounds.x).toBe(UI_LAYOUT.hud.playerHpBar.x);
      expect(pBounds.y).toBe(UI_LAYOUT.hud.playerHpBar.y);
      expect(pBounds.w).toBe(Math.min(UI_LAYOUT.hud.playerHpBar.w, W * 0.28));
      expect(pBounds.h).toBe(hud.getHpBarHeight());

      const bBounds = hud.getBossHpBarBounds(W, H);
      expect(bBounds.y).toBe(UI_LAYOUT.hud.playerHpBar.y);
      expect(bBounds.w).toBe(Math.min(UI_LAYOUT.hud.playerHpBar.w, W * 0.28));
      expect(bBounds.x).toBe(W - UI_LAYOUT.hud.playerHpBar.x - bBounds.w);

      const nameBounds = hud.getBossNameBounds(W, H);
      expect(nameBounds.w).toBe(400);
      expect(nameBounds.h).toBe(60);
      expect(nameBounds.x).toBe((W - 400) / 2);
      expect(nameBounds.y).toBe(6);

      const comboBounds = hud.getComboBounds(W, H);
      const badgeSlot = UI_LAYOUT.hud.comboBadge ?? { w: 160, h: 48, y: 48, marginRight: 24 };
      expect(comboBounds.w).toBe(badgeSlot.w);
      expect(comboBounds.h).toBe(badgeSlot.h);
      expect(comboBounds.x).toBe(W - badgeSlot.w - badgeSlot.marginRight);

      // getHpBarBounds alias 오버로드 검증
      expect(hud.getHpBarBounds('player', W, H)).toEqual(pBounds);
      expect(hud.getHpBarBounds('boss', W, H)).toEqual(bBounds);
    });

    it('BottomBar 기본 인스턴스는 BOTTOM_BAR_CONFIG 기준의 bounds를 제공한다', () => {
      const bar = new BottomBar();
      expect(bar.getPresentationContext()).toBeUndefined();

      const sBounds = bar.getSettingsButtonBounds(W, H);
      expect(sBounds.x).toBe(BOTTOM_BAR_CONFIG.settingsBtn.x);
      expect(sBounds.y).toBe(BOTTOM_BAR_CONFIG.settingsBtn.y);
      expect(sBounds.w).toBe(BOTTOM_BAR_CONFIG.settingsBtn.w);
      expect(sBounds.h).toBe(BOTTOM_BAR_CONFIG.settingsBtn.h);

      const aBounds = bar.getActionButtonBounds(W, H);
      expect(aBounds.x).toBe(BOTTOM_BAR_CONFIG.actionBtn.x);
      expect(aBounds.y).toBe(BOTTOM_BAR_CONFIG.actionBtn.y);
      expect(aBounds.w).toBe(BOTTOM_BAR_CONFIG.actionBtn.w);
      expect(aBounds.h).toBe(BOTTOM_BAR_CONFIG.actionBtn.h);

      const mBounds = bar.getManaBarBounds(W, H);
      const expectedManaSlot = BOTTOM_BAR_CONFIG.manaBar ?? { x: 210, y: 2038, w: 560, h: 50 };
      expect(mBounds.x).toBe(expectedManaSlot.x);
      expect(mBounds.y).toBe(expectedManaSlot.y);
      expect(mBounds.w).toBe(expectedManaSlot.w);

      const barBounds = bar.getBottomBarBounds(W, H);
      expect(barBounds.x).toBe(0);
      expect(barBounds.y).toBe(BOTTOM_BAR_CONFIG.y);
      expect(barBounds.w).toBe(W);
      expect(barBounds.h).toBe(BOTTOM_BAR_CONFIG.height);
    });
  });

  describe('2. 동일 HUDData에서 geometry/style만 변경 및 게임플레이 불변 보장', () => {
    it('HUDPresentationContext 주입 시 바운딩 박스가 오버라이드되고 HUDData 수치는 불변이다', () => {
      const hudContext: HUDPresentationContext = {
        playerHpBar: { x: 40, y: 50, w: 350, h: 44 },
        bossHpBar: { x: 690, y: 50, w: 350, h: 44 },
        bossName: { x: 340, y: 12, w: 400, h: 70, label: '커스텀 보스전' },
        combo: { x: 820, y: 100, w: 200, h: 55 },
      };

      const hud = new HUDLayer(hudContext);
      expect(hud.getPresentationContext()).toEqual(hudContext);

      const pBounds = hud.getPlayerHpBarBounds(W, H);
      expect(pBounds).toEqual({ x: 40, y: 50, w: 350, h: 44 });

      const bBounds = hud.getBossHpBarBounds(W, H);
      expect(bBounds).toEqual({ x: 690, y: 50, w: 350, h: 44 });

      const nameBounds = hud.getBossNameBounds(W, H);
      expect(nameBounds).toEqual({ x: 340, y: 12, w: 400, h: 70 });

      const comboBounds = hud.getComboBounds(W, H);
      expect(comboBounds).toEqual({ x: 820, y: 100, w: 200, h: 55 });

      // HUDData가 읽기 전용으로 보존되는지 검증
      const frozenData = Object.freeze({ ...sampleHUDData });
      const ctx = createMockCtx();

      expect(() => {
        hud.update(0.016, frozenData);
        hud.render(ctx, W, H, frozenData);
      }).not.toThrow();

      expect(frozenData.playerHp).toBe(75);
      expect(frozenData.bossHp).toBe(8);
      expect(frozenData.combo).toBe(4);

      // 렌더 시 오버라이드된 bounds의 좌표가 실제로 호출되었는지 검증
      const fillRectCalls = (ctx.fillRect as any).mock.calls;
      const matchedPlayerRect = fillRectCalls.some(
        (call: number[]) => call[0] === 40 && call[1] === 50 && call[3] === 44
      );
      expect(matchedPlayerRect).toBe(true);

      const fillTextCalls = (ctx.fillText as any).mock.calls;
      const matchedBossText = fillTextCalls.some(
        (call: [string, number, number]) => call[0] === '커스텀 보스전'
      );
      expect(matchedBossText).toBe(true);
    });
  });

  describe('3. 하단 action/settings 버튼 시각 bounds와 hitTest 1:1 일치 및 오클릭 0건', () => {
    it('BottomBar의 설정 버튼 및 액션 버튼 위치 이동 시 hitTest와 시각 bounds가 완전 동기화된다', () => {
      const barContext: BottomBarPresentationContext = {
        settingsBtn: { x: 300, y: 2010, w: 120, h: 120, label: '옵션' },
        actionBtn: { x: 500, y: 2010, w: 200, h: 120, label: '확인' },
      };

      const bar = new BottomBar(barContext);

      const sBounds = bar.getSettingsButtonBounds(W, H);
      expect(sBounds).toEqual({ x: 300, y: 2010, w: 120, h: 120 });

      const aBounds = bar.getActionButtonBounds(W, H);
      expect(aBounds).toEqual({ x: 500, y: 2010, w: 200, h: 120 });

      // 새 위치 중심점 hitTest -> true
      expect(bar.hitTestSettings(300 + 60, 2010 + 60, W, H)).toBe(true);
      expect(bar.hitTestAction(500 + 100, 2010 + 60, W, H)).toBe(true);

      // 새 위치 경계선 hitTest -> true
      expect(bar.hitTestSettings(300, 2010, W, H)).toBe(true);
      expect(bar.hitTestSettings(420, 2130, W, H)).toBe(true);
      expect(bar.hitTestAction(500, 2010, W, H)).toBe(true);
      expect(bar.hitTestAction(700, 2130, W, H)).toBe(true);

      // 이전 기본 위치(30, 1990) 클릭 시 오클릭 0건 (false 반환)
      const oldSettingsCenter = {
        x: BOTTOM_BAR_CONFIG.settingsBtn.x + BOTTOM_BAR_CONFIG.settingsBtn.w / 2,
        y: BOTTOM_BAR_CONFIG.settingsBtn.y + BOTTOM_BAR_CONFIG.settingsBtn.h / 2,
      };
      expect(bar.hitTestSettings(oldSettingsCenter.x, oldSettingsCenter.y, W, H)).toBe(false);

      const oldActionCenter = {
        x: BOTTOM_BAR_CONFIG.actionBtn.x + BOTTOM_BAR_CONFIG.actionBtn.w / 2,
        y: BOTTOM_BAR_CONFIG.actionBtn.y + BOTTOM_BAR_CONFIG.actionBtn.h / 2,
      };
      expect(bar.hitTestAction(oldActionCenter.x, oldActionCenter.y, W, H)).toBe(false);

      // 렌더링 시 새 bounds와 label이 캔버스에 전달되는지 확인
      const ctx = createMockCtx();
      bar.render(ctx, W, H, { actionLabel: '기본라벨' });

      const fillTextCalls = (ctx.fillText as any).mock.calls;
      const matchedActionLabel = fillTextCalls.some(
        (call: [string, number, number]) => call[0] === '확인' && call[1] === 500 + 100
      );
      expect(matchedActionLabel).toBe(true);
    });
  });

  describe('4. actionBtn 오버라이드 우선순위 (Page Override > customActionSlot > Common Override > Default)', () => {
    it('페이지별 오버라이드가 있으면 customActionSlot 및 공통 오버라이드보다 최우선 적용된다', () => {
      const barContext: BottomBarPresentationContext = {
        actionBtn: { x: 790, y: 1990, w: 260, h: 140 }, // 공통 오버라이드
        pageOverrides: {
          submenu: {
            actionBtn: { x: 700, y: 1980, w: 320, h: 150 }, // 서브메뉴 페이지 전용
          },
        },
      };

      const bar = new BottomBar(barContext);
      const runtimeCustomSlot: BottomBarSlot = { x: 780, y: 1990, w: 270, h: 140 };

      // Case A: pageId: 'submenu' 제공 시 -> pageOverride 최우선
      const subBounds = bar.getActionButtonBounds(W, H, {
        customActionSlot: runtimeCustomSlot,
        pageId: 'submenu',
      });
      expect(subBounds).toEqual({ x: 700, y: 1980, w: 320, h: 150 });
      expect(bar.hitTestAction(700 + 160, 1980 + 75, W, H, 0, {
        customActionSlot: runtimeCustomSlot,
        pageId: 'submenu',
      })).toBe(true);

      // Case B: pageId 미지정 + customActionSlot 전달 시 -> customActionSlot 적용
      const customBounds = bar.getActionButtonBounds(W, H, runtimeCustomSlot);
      expect(customBounds).toEqual({ x: 780, y: 1990, w: 270, h: 140 });
      expect(bar.hitTestAction(780 + 135, 1990 + 70, W, H, 0, runtimeCustomSlot)).toBe(true);

      // Case C: pageId 미지정 + customActionSlot 없음 -> 공통 오버라이드 적용
      const commonBounds = bar.getActionButtonBounds(W, H);
      expect(commonBounds).toEqual({ x: 790, y: 1990, w: 260, h: 140 });
      expect(bar.hitTestAction(790 + 130, 1990 + 70, W, H)).toBe(true);
    });
  });

  describe('5. 멀티 인스턴스 격리 및 전역 UI_LAYOUT/UIText 상태 불변성', () => {
    it('한 인스턴스의 오버라이드가 다른 인스턴스 및 전역 설정에 누출되지 않는다', () => {
      const origLayout = JSON.stringify(UI_LAYOUT);

      const customContext: BottomBarPresentationContext = {
        settingsBtn: { x: 120, y: 2020, w: 100, h: 100 },
        actionBtn: { x: 600, y: 2020, w: 400, h: 100 },
      };

      const bar1 = new BottomBar(customContext);
      const bar2 = new BottomBar(); // 기본 인스턴스

      // bar1은 오버라이드 적용
      expect(bar1.getSettingsButtonBounds(W, H).x).toBe(120);
      expect(bar1.getActionButtonBounds(W, H).x).toBe(600);

      // bar2는 기본값 유지 (누출 0건)
      expect(bar2.getSettingsButtonBounds(W, H).x).toBe(BOTTOM_BAR_CONFIG.settingsBtn.x);
      expect(bar2.getActionButtonBounds(W, H).x).toBe(BOTTOM_BAR_CONFIG.actionBtn.x);

      // bar1 context clear 시 원복 확인
      bar1.clearPresentationContext();
      expect(bar1.getSettingsButtonBounds(W, H).x).toBe(BOTTOM_BAR_CONFIG.settingsBtn.x);

      // 전역 UI_LAYOUT 원본 불변 검증
      expect(JSON.stringify(UI_LAYOUT)).toBe(origLayout);
    });

    it('HUDLayer 인스턴스 간에도 오버라이드가 완벽히 격리된다', () => {
      const hud1 = new HUDLayer({ playerHpBar: { x: 99, y: 99, w: 200, h: 50 } });
      const hud2 = new HUDLayer();

      expect(hud1.getPlayerHpBarBounds(W, H).x).toBe(99);
      expect(hud2.getPlayerHpBarBounds(W, H).x).toBe(UI_LAYOUT.hud.playerHpBar.x);

      hud1.clearPresentationContext();
      expect(hud1.getPlayerHpBarBounds(W, H).x).toBe(UI_LAYOUT.hud.playerHpBar.x);
    });
  });

  describe('6. UIPresentationDocument 기반 정적 팩토리 변환 검증', () => {
    it('HUDLayer.fromPresentationDocument가 문서의 보스전 페이지 요소를 바르게 추출한다', () => {
      const doc = createDefaultUIPresentationDocument();
      // 보스전에 커스텀 요소 주입
      doc.pages.boss_battle.elements.push({
        id: 'hud_player_hp',
        name: '수호신 HP 바',
        type: 'container',
        bounds: { x: 35, y: 25, width: 310, height: 38 },
      });

      const extracted = HUDLayer.fromPresentationDocument(doc, 'boss_battle');
      expect(extracted.playerHpBar).toBeDefined();
      expect(extracted.playerHpBar?.x).toBe(35);
      expect(extracted.playerHpBar?.y).toBe(25);
      expect(extracted.playerHpBar?.w).toBe(310);
      expect(extracted.playerHpBar?.h).toBe(38);
    });

    it('BottomBar.fromPresentationDocument가 문서의 하단 버튼 요소를 바르게 추출한다', () => {
      const doc = createDefaultUIPresentationDocument();
      // main_home에 커스텀 btn_opt 주입
      doc.pages.main_home.elements.push({
        id: 'btn_opt',
        name: '설정 버튼',
        type: 'button',
        bounds: { x: 45, y: 1985, width: 150, height: 150 },
        actionId: 'open_settings',
      });

      const extracted = BottomBar.fromPresentationDocument(doc, 'main_home');
      expect(extracted.settingsBtn).toBeDefined();
      expect(extracted.settingsBtn?.x).toBe(45);
      expect(extracted.settingsBtn?.y).toBe(1985);
      expect(extracted.settingsBtn?.w).toBe(150);
      expect(extracted.settingsBtn?.h).toBe(150);
    });
  });
});
