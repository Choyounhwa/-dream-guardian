/**
 * [LAYOUT-002] (Issue #569) 메인 메뉴·서브메뉴 레이아웃 설정 이전
 * - 이전 전 출력 잠금(characterization): 기본값에서 텍스트·배너·뒤로가기 좌표가 그대로여야 한다.
 * - 신규 UI_LAYOUT 키를 바꾸면 해당 요소 좌표가 바뀐다 (매 프레임 다시 읽기).
 * - 뒤로가기 버튼은 그리기(renderHUD)와 hit(resolveBottomBarActionSlot)가 같은 getter 를 쓴다.
 * - 판정 연동 좌표는 변하지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuRenderer, type MenuState } from '../../src/ui/MenuRenderer.js';
import { BottomBar } from '../../src/ui/BottomBar.js';
import { SceneDirector, resolveBottomBarActionSlot } from '../../src/core/SceneDirector.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UIText } from '../../src/utils/UIText.js';
import { flattenLayoutBindings, resetLayoutTo, snapshotLayout } from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride.js';
import { getDevUiLockedSources } from '../../config/dev-ui.config.js';

const pristine = snapshotLayout(UI_LAYOUT);
const L = UI_LAYOUT as unknown as Record<string, Record<string, Record<string, number>>>;

const state: MenuState = { unlockedChapter: 5, stars: { 1: 2 }, selectedChapter: 0 };
const subLevels = [
  { subLevel: 1, title: '단계 1', count: 10 },
  { subLevel: 2, title: '단계 2', count: 12 },
];

function context() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), roundRect: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn(), drawImage: vi.fn(), measureText: vi.fn(() => ({ width: 80 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top',
    shadowColor: '', shadowBlur: 0, globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function textAt(ctx: CanvasRenderingContext2D, text: string): [number, number] | undefined {
  const call = vi.mocked(ctx.fillText).mock.calls.find((c) => c[0] === text);
  return call ? [call[1], call[2]] : undefined;
}

function renderMain(w = 1080, h = 2160) {
  const ctx = context();
  new MenuRenderer().render(ctx, w, h, state);
  return ctx;
}

function renderSub(w = 1080, h = 2160) {
  const ctx = context();
  new MenuRenderer().renderSubMenu(ctx, w, h, 1, subLevels);
  return ctx;
}

function hudOptions(vw = 1080, vh = 2160) {
  const render = vi.fn();
  new SceneDirector().renderHUD({
    canvasManager: { ctx: {}, virtualWidth: vw, virtualHeight: vh },
    bottomBar: { render },
    state: { screenMode: 'menu', menuMode: 'sub', settingsHoverTimer: 0, actionHoverTimer: 0 },
    battle: {},
  } as never);
  return render.mock.calls[0][3];
}

const TITLE = '꿈속 세계 탐험';
const SLOGAN = '깨비와 함께 신비로운 꿈의 성역으로 다이빙!';
const SUB_TITLE = 'Ch.1 에메랄드 심해 - 탐험 구역 선택';
const SUB_CAPTION = '나비가 숨 쉬는 에메랄드 심해 (덧셈 · 뺄셈)';

beforeEach(() => { UIText.resetAccessibility(); imageLoader.clear(); });
afterEach(() => {
  resetLayoutTo(UI_LAYOUT, pristine);
  UIText.resetAccessibility();
  imageLoader.clear();
  vi.restoreAllMocks();
});

describe('#569 LAYOUT-002 이전 전 출력 잠금 (기본값)', () => {
  it('메인 타이틀·슬로건·챕터 카드 내부 텍스트 좌표를 유지한다', () => {
    const ctx = renderMain();
    expect(textAt(ctx, TITLE)).toEqual([540, 260]);
    expect(textAt(ctx, SLOGAN)).toEqual([540, 314]);
    expect(textAt(ctx, 'Ch.1')).toEqual([300, 535]);
    expect(textAt(ctx, '에메랄드 심해')).toEqual([300, 620]);
    expect(textAt(ctx, '덧셈 · 뺄셈')).toEqual([300, 685]);
    expect(textAt(ctx, '★★☆')).toEqual([300, 765]);
    expect(textAt(ctx, 'Ch.5')).toEqual([540, 1455]);
  });

  it('챕터 카드 텍스트는 비율 해상도에서도 기존과 같다', () => {
    const ctx = renderMain(540, 1080);
    expect(textAt(ctx, 'Ch.1')).toEqual([150, 267.5]);
    expect(textAt(ctx, '에메랄드 심해')).toEqual([150, 310]);
    expect(textAt(ctx, '덧셈 · 뺄셈')).toEqual([150, 342.5]);
    expect(textAt(ctx, '★★☆')).toEqual([150, 382.5]);
  });

  it('메인 타이틀 배너·잠금 아이콘 이미지 좌표를 유지한다', () => {
    const banner = {} as HTMLImageElement;
    const lock = {} as HTMLImageElement;
    imageLoader.setImage('menu', 'titleBg', banner);
    imageLoader.setImage('menu', 'lockIcon', lock);
    const ctx = context();
    new MenuRenderer().render(ctx, 1080, 2160, { ...state, unlockedChapter: 4 });
    expect(ctx.drawImage).toHaveBeenCalledWith(banner, 140, 200, 800, 120);
    expect(ctx.drawImage).toHaveBeenCalledWith(lock, 520, 1665, 40, 40);
  });

  it('서브메뉴 제목·안내문·단계 카드 텍스트 좌표를 유지한다', () => {
    const ctx = renderSub();
    expect(textAt(ctx, SUB_TITLE)).toEqual([540, 240]);
    expect(textAt(ctx, SUB_CAPTION)).toEqual([540, 305]);
    expect(textAt(ctx, '단계 1')).toEqual([290, 580]);
    expect(textAt(ctx, '10문항')).toEqual([290, 670]);
    expect(textAt(ctx, '전체 종합 (ALL)')).toEqual([290, 1020]);
  });

  it('서브메뉴 배너 이미지 좌표를 유지한다', () => {
    const banner = {} as HTMLImageElement;
    imageLoader.setImage('menu', 'titleBg', banner);
    const ctx = renderSub();
    expect(ctx.drawImage).toHaveBeenCalledWith(banner, 80, 180, 920, 120);
  });

  it('뒤로가기 버튼 그리기·hit 좌표를 유지한다', () => {
    const expected = { x: 780, y: 1990, w: 270, h: 140 };
    expect(resolveBottomBarActionSlot(new BottomBar(), 1080, 2160, 'menu', 'sub')).toEqual(expected);
    expect(resolveBottomBarActionSlot(undefined, 540, 1080, 'menu', 'sub')).toEqual({ x: 390, y: 995, w: 135, h: 70 });
    expect(hudOptions().customActionSlot).toEqual(expected);
    expect(new MenuRenderer().getSubMenuBackButtonLayout(1080, 2160)).toEqual(expected);
    // 다른 화면의 액션 버튼은 변화 없음
    expect(resolveBottomBarActionSlot(undefined, 1080, 2160, 'game')).toEqual({ x: 810, y: 1990, w: 240, h: 140 });
  });

  it('presentation override 우선순위를 유지한다', () => {
    const bar = new BottomBar({ pageOverrides: { submenu: { actionBtn: { x: 700, y: 1980, w: 300, h: 150 } } } });
    expect(resolveBottomBarActionSlot(bar, 1080, 2160, 'menu', 'sub')).toEqual({ x: 700, y: 1980, w: 300, h: 150 });
    const menu = new MenuRenderer({ subMenuBackBtn: { x: 600 } });
    expect(menu.getSubMenuBackButtonLayout(1080, 2160)).toEqual({ x: 600, y: 1990, w: 270, h: 140 });
  });
});

describe('#569 LAYOUT-002 신규 UI_LAYOUT 키 연결 (매 프레임 읽기)', () => {
  it('메인 카드 내부 텍스트 오프셋을 menu.cardText 에서 읽는다', () => {
    Object.assign(L.menu.cardText, { chapterY: 50, nameY: 150, subY: 250, starsY: 350 });
    const ctx = renderMain();
    expect(textAt(ctx, 'Ch.1')).toEqual([300, 510]);
    expect(textAt(ctx, '에메랄드 심해')).toEqual([300, 610]);
    expect(textAt(ctx, '덧셈 · 뺄셈')).toEqual([300, 710]);
    expect(textAt(ctx, '★★☆')).toEqual([300, 810]);
  });

  it('메인 타이틀 오프셋·배너 높이를 menu.titleText·menu.titleBanner 에서 읽는다', () => {
    Object.assign(L.menu.titleText, { liftY: 10, sloganGapY: 70 });
    let ctx = renderMain();
    expect(textAt(ctx, TITLE)).toEqual([540, 280]);
    expect(textAt(ctx, SLOGAN)).toEqual([540, 350]);

    const banner = {} as HTMLImageElement;
    imageLoader.setImage('menu', 'titleBg', banner);
    L.menu.titleBanner.h = 100;
    ctx = renderMain();
    expect(ctx.drawImage).toHaveBeenCalledWith(banner, 140, 230, 800, 100);
  });

  it('메인 타이틀 중심 y 의 이중 스케일을 정리한다', () => {
    const ctx = renderMain(540, 1080);
    // (180 + 220/2 - 30) × 0.5 = 130
    expect(textAt(ctx, TITLE)).toEqual([270, 130]);
  });

  it('서브메뉴 제목은 subMenu.title 슬롯을 따라 움직인다', () => {
    L.subMenu.title.y = 300;
    let ctx = renderSub();
    expect(textAt(ctx, SUB_TITLE)).toEqual([540, 380]);
    expect(textAt(ctx, SUB_CAPTION)).toEqual([540, 445]);
    resetLayoutTo(UI_LAYOUT, pristine);
    Object.assign(L.subMenu.titleText, { liftY: 0, captionGapY: 80 });
    ctx = renderSub();
    expect(textAt(ctx, SUB_TITLE)).toEqual([540, 260]);
    expect(textAt(ctx, SUB_CAPTION)).toEqual([540, 340]);
  });

  it('서브메뉴 배너 높이·카드 텍스트 오프셋을 설정에서 읽는다', () => {
    const banner = {} as HTMLImageElement;
    imageLoader.setImage('menu', 'titleBg', banner);
    L.subMenu.titleBanner.h = 90;
    Object.assign(L.subMenu.cardText, { labelY: 100, subLabelY: 300 });
    const ctx = renderSub();
    expect(ctx.drawImage).toHaveBeenCalledWith(banner, 80, 195, 920, 90);
    expect(textAt(ctx, '단계 1')).toEqual([290, 540]);
    expect(textAt(ctx, '10문항')).toEqual([290, 740]);
  });

  it('뒤로가기 버튼은 그리기·hit·메뉴 레이아웃이 모두 subMenu.backBtn 하나를 쓴다', () => {
    Object.assign(UI_LAYOUT.subMenu.backBtn, { x: 700, y: 1970, w: 300, h: 160 });
    const expected = { x: 700, y: 1970, w: 300, h: 160 };
    const hit = resolveBottomBarActionSlot(new BottomBar(), 1080, 2160, 'menu', 'sub');
    expect(hit).toEqual(expected);
    expect(hudOptions().customActionSlot).toEqual(expected);
    expect(new MenuRenderer().getSubMenuBackButtonLayout(1080, 2160)).toEqual(expected);
    const half = resolveBottomBarActionSlot(undefined, 540, 1080, 'menu', 'sub')!;
    expect(half.x).toBeCloseTo(350);
    expect(half.y).toBeCloseTo(985);
    expect(half.w).toBeCloseTo(150);
    expect(half.h).toBeCloseTo(80);
    expect(new BottomBar().hitTestAction(710, 1980, 1080, 2160, 0, hit)).toBe(true);
    expect(new BottomBar().hitTestAction(1010, 1980, 1080, 2160, 0, hit)).toBe(false);
  });

  it('미사용 subMenu.cardWidth/cardHeight 를 정리한다', () => {
    expect(Object.prototype.hasOwnProperty.call(UI_LAYOUT.subMenu, 'cardWidth')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(UI_LAYOUT.subMenu, 'cardHeight')).toBe(false);
  });

  it('신규 키는 개발 패널 바인딩에 노출되고 ui-layout.json 검증을 통과한다', () => {
    const paths = flattenLayoutBindings(UI_LAYOUT, []).map((b) => b.path);
    for (const p of [
      'menu.titleText.liftY', 'menu.titleText.sloganGapY', 'menu.titleBanner.h',
      'menu.cardText.chapterY', 'menu.cardText.nameY', 'menu.cardText.subY', 'menu.cardText.starsY',
      'subMenu.titleText.liftY', 'subMenu.titleText.captionGapY', 'subMenu.titleBanner.h',
      'subMenu.cardText.labelY', 'subMenu.cardText.subLabelY',
    ]) {
      expect(paths).toContain(p);
    }
    const result = applyLayoutOverride(UI_LAYOUT, {
      menu: { cardText: { nameY: 170 }, titleBanner: { h: 130 } },
      subMenu: { cardText: { labelY: 150 }, backBtn: { x: 790 } },
    });
    expect(result.warnings).toEqual([]);
    expect(L.menu.cardText.nameY).toBe(170);
    expect(UI_LAYOUT.subMenu.backBtn.x).toBe(790);
  });

  it('메뉴 편집·렌더가 판정 연동 좌표를 바꾸지 않는다', () => {
    const locked = snapshotLayout(getDevUiLockedSources());
    for (const b of flattenLayoutBindings(UI_LAYOUT.menu, [])) b.target[b.key] += 1;
    for (const b of flattenLayoutBindings(UI_LAYOUT.subMenu, [])) b.target[b.key] += 1;
    renderMain();
    renderSub();
    hudOptions();
    expect(getDevUiLockedSources()).toEqual(locked);
  });
});
