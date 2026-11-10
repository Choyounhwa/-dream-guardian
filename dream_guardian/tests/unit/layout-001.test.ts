import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUDLayer, type HUDData } from '../../src/ui/HUDLayer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { UIText } from '../../src/utils/UIText.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { flattenLayoutBindings, resetLayoutTo, snapshotLayout } from '../../src/dev/DevLayoutPanel.js';
import { DEV_UI_SECTION_MAP, getDevUiLockedSources } from '../../config/dev-ui.config.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

const pristine = snapshotLayout(UI_LAYOUT);
const data: HUDData = Object.freeze({ playerHp: 75, playerMaxHp: 100, bossHp: 8, bossMaxHp: 10, combo: 7, chapter: 1, guardianStage: 1 });

beforeEach(() => { UIText.resetAccessibility(); imageLoader.clear(); });
afterEach(() => {
  for (const key of Object.keys(UI_LAYOUT.hud)) {
    if (!(key in pristine.hud)) delete UI_LAYOUT.hud[key];
  }
  resetLayoutTo(UI_LAYOUT, pristine); // 하위 객체 참조까지 유지하는 in-place 복원
  UIText.resetAccessibility();
  imageLoader.clear();
  vi.restoreAllMocks();
});

describe('#568 설정 연결 (매 프레임 읽기)', () => {
  it('보스 HP바는 플레이어 설정과 독립적으로 모든 bounds를 읽는다', () => {
    const hud = new HUDLayer();
    const player = hud.getPlayerHpBarBounds(1080);
    Object.assign(UI_LAYOUT.hud.bossHpBar, { x: 700, y: 80, w: 250, h: 40 });
    expect(hud.getBossHpBarBounds(1080)).toEqual({ x: 700, y: 80, w: 250, h: 40 });
    expect(hud.getPlayerHpBarBounds(1080)).toEqual(player);
    UIText.setFontScale(1.5);
    expect(hud.getBossHpBarBounds(1080).h).toBe(60);
    UI_LAYOUT.hud.bossHpBar.y = 90;
    expect(hud.getBossHpBarBounds(1080).y).toBe(90);
  });

  it('보스 이름은 가상 px 슬롯에서 읽고 화면 중앙 기준 앵커를 유지한다', () => {
    const hud = new HUDLayer();
    Object.assign(UI_LAYOUT.hud.bossName, { x: 300, y: 15, w: 450, h: 70 });
    expect(hud.getBossNameBounds(1080)).toEqual({ x: 300, y: 15, w: 450, h: 70 });
    expect(hud.getBossNameBounds(1920)).toEqual({ x: 720, y: 15, w: 450, h: 70 });
    UI_LAYOUT.hud.bossName.x = 310;
    expect(hud.getBossNameBounds(1080).x).toBe(310);
  });

  it('HP 너비 상한을 가상 px로 읽어 기존 너비 비율을 보존한다', () => {
    const hud = new HUDLayer();
    // 기존 키 이름(w/h)을 쓰는 중첩 슬롯: UILayoutOverride·DevLayoutPanel 의 가로/크기 검증 범위를 그대로 적용받는다
    Object.assign(UI_LAYOUT.hud.hpBarMax, { w: 216, h: 50 });
    for (const w of [1080, 390, 1920]) {
      expect(hud.getPlayerHpBarBounds(w).w).toBe(Math.min(320, w * 0.2));
      expect(hud.getBossHpBarBounds(w).w).toBe(Math.min(320, w * 0.2));
    }
    expect(hud.getHpBarHeight(3)).toBe(50);
    hud.setPresentationContext({ bossHpBar: { w: 555, h: 77 } });
    expect(hud.getBossHpBarBounds(1080)).toMatchObject({ w: 555, h: 77 });
  });

  it('라벨 inset·콤보 텍스트 및 아이콘 상수를 매 render에서 읽는다', () => {
    const hud = new HUDLayer();
    const icon = {} as HTMLImageElement;
    imageLoader.setImage('hud', 'comboIcon', icon);
    UI_LAYOUT.hud.hpLabelInset.x = 12;
    UI_LAYOUT.hud.comboTextOffsetY = 10;
    Object.assign(UI_LAYOUT.hud.comboIcon, { w: 40, h: 40, gapX: 16 });
    const ctx = context();
    hud.render(ctx, 1080, 2160, data);
    expect(ctx.fillText).toHaveBeenCalledWith('HP 75/100', 32, 36);
    expect(ctx.fillText).toHaveBeenCalledWith('HP 8/10', 1048, 36);
    expect(ctx.fillText).toHaveBeenCalledWith('COMBO x7', 1056, 82);
    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 920, 62, 40, 40);
    Object.assign(UI_LAYOUT.hud.comboIcon, { w: 20, h: 20 });
    hud.render(ctx, 1080, 2160, data);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(icon, 940, 72, 20, 20);
  });

  it('신규 키가 기존 hud 패널 매핑에 자동 노출되고 미사용 combo 슬롯은 제거된다', () => {
    expect(DEV_UI_SECTION_MAP.RUN_QUESTION).toContain('hud');
    const paths = flattenLayoutBindings(UI_LAYOUT, []).map(b => b.path);
    for (const key of ['hpBarMax.w', 'hpBarMax.h', 'hpLabelInset.x', 'comboTextOffsetY', 'comboIcon.w', 'comboIcon.h', 'comboIcon.gapX']) {
      expect(paths).toContain(`hud.${key}`);
    }
    expect(Object.prototype.hasOwnProperty.call(UI_LAYOUT.hud, 'combo')).toBe(false);
  });
});

function context() {
  return {
    save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn(), drawImage: vi.fn(), measureText: vi.fn(() => ({ width: 80 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

describe('#568 LAYOUT-001 이전 전 출력 잠금', () => {
  it.each([
    [1080, 302.40000000000003, 757.5999999999999, 340, 896],
    [390, 109.20000000000002, 260.79999999999995, -5, 206],
    [1920, 320, 1580, 760, 1736],
  ])('너비 %i에서 기존 bounds를 정확히 유지한다', (w, barW, bossX, nameX, comboX) => {
    const hud = new HUDLayer();
    expect(hud.getPlayerHpBarBounds(w)).toEqual({ x: 20, y: 20, w: barW, h: 32 });
    expect(hud.getBossHpBarBounds(w)).toEqual({ x: bossX, y: 20, w: barW, h: 32 });
    expect(hud.getBossNameBounds(w)).toEqual({ x: nameX, y: 6, w: 400, h: 60 });
    expect(hud.getComboBounds(w)).toEqual({ x: comboX, y: 48, w: 160, h: 48 });
  });

  it('기존 라벨·아이콘·플레이트 좌표와 감쇠 프레임을 잠근다', () => {
    const ctx = context();
    const icon = {} as HTMLImageElement;
    const plate = {} as HTMLImageElement;
    imageLoader.setImage('hud', 'comboIcon', icon);
    imageLoader.setImage('hud', 'bossNameplate', plate);
    const hud = new HUDLayer();
    hud.update(0.1, data);
    hud.render(ctx, 1080, 2160, data);
    expect(vi.mocked(ctx.fillText).mock.calls).toEqual([
      ['HP 75/100', 28, 36], ['HP 8/10', 1052, 36],
      ['COMBO x7', 1056, 76], ['Ch.1 하얘시니', 540, 36],
    ]);
    expect(vi.mocked(ctx.drawImage).mock.calls).toEqual([
      [icon, 932, 58, 36, 36], [plate, 340, 6, 400, 60],
    ]);
    expect(ctx.fillRect).toHaveBeenCalledWith(20, 20, 302.40000000000003 * 0.875, 32);
  });

  it('접근성 높이와 명시 override > 문서 > 기본값 우선순위를 잠근다', () => {
    const doc = createDefaultUIPresentationDocument();
    const page = Object.values(doc.pages)[0];
    page.elements.push({ id: 'hud_boss_hp', bounds: { x: 600, y: 90, width: 200, height: 40 } } as typeof page.elements[number]);
    const hud = new HUDLayer({ presentationDocument: doc, pageId: page.pageId, bossHpBar: { x: 610 } });
    expect(hud.getBossHpBarBounds(1080)).toEqual({ x: 610, y: 90, w: 200, h: 40 });
    hud.clearPresentationContext();
    UIText.setFontScale(1.5);
    expect(hud.getPlayerHpBarBounds(1080).h).toBe(48);
    expect(hud.getBossHpBarBounds(1080).h).toBe(48);
    expect(hud.getHpBarHeight(3)).toBe(64);
  });

  it('HUD 편집·렌더는 판정 좌표와 전달받은 전투 수치를 변경하지 않는다', () => {
    const locked = snapshotLayout(getDevUiLockedSources());
    const hpRef = UI_LAYOUT.hud.playerHpBar;
    for (const binding of flattenLayoutBindings(UI_LAYOUT.hud, [])) binding.target[binding.key] += 1;
    const hud = new HUDLayer();
    hud.update(0.1, data);
    hud.render(context(), 1080, 2160, data);
    expect(getDevUiLockedSources()).toEqual(locked);
    expect(data).toEqual({ playerHp: 75, playerMaxHp: 100, bossHp: 8, bossMaxHp: 10, combo: 7, chapter: 1, guardianStage: 1 });
    resetLayoutTo(UI_LAYOUT, pristine);
    expect(UI_LAYOUT.hud.playerHpBar).toBe(hpRef);
    expect(UI_LAYOUT).toEqual(pristine);
  });
});
