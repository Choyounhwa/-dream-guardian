/**
 * UISubmenuPage.ts - 서브메뉴 실제 렌더 페이지 어댑터 (Issue #451 / UI-VIS-021)
 *
 * 개발 규칙 및 명세 준수:
 * 1. MenuRenderer의 실제 서브메뉴 렌더링 로직(renderSubMenu)을 그대로 재사용
 * 2. 실제 chapter/sublevel 데이터 모양의 고정 fixture 및 가변 서브레벨 목록(3~6개 이상 가변) 렌더링 지원
 * 3. 챕터별 서로 다른 슬롯/긴 제목·뒤로 action bounds 일치
 * 4. MenuRenderer.fromPresentationDocument 또는 MenuPresentationContext 바인딩 반영
 * 5. 공통 HUD(HUDLayer) 및 하단 고정 바(BottomBar) 정적 합성
 * 6. 게임 런타임(게임 루프, AppBootstrap, SceneDirector, 카메라/오디오/TTS) 부팅 0건 보장
 * 7. Stable ID(sub_title, sub_card_0..N, menu_sub_back, bottom_bar_back, hud_..., bottom_bar_...)를 포함한 renderedBounds 반환
 * 8. Stale fixture, stale revision, 보호 영역 침범에 대한 엄격한 가드 및 에러 처리
 */

import {
  MenuRenderer,
  type MenuPresentationContext,
} from '../../../../ui/MenuRenderer.js';
import { HUDLayer, type HUDData, type HUDPresentationContext } from '../../../../ui/HUDLayer.js';
import {
  BottomBar,
  type BottomBarRenderOptions,
  type BottomBarPresentationContext,
} from '../../../../ui/BottomBar.js';
import type {
  PageAdapter,
  PageRenderContext,
  PageRenderResult,
  PageRenderBounds,
  PageAdapterRegistry,
} from '../UIPageAdapters.js';

const ARTBOARD_WIDTH = 1080;
const ARTBOARD_HEIGHT = 2160;
import type { UIPresentationDocument } from '../../../../data/UIPresentation.js';
import type { SubLevelInfo } from '../../../../types/index.js';

export const SUBMENU_PAGE_ID = 'submenu';
export const MENU_SUB_PAGE_ID = 'menu_sub';

export const DEFAULT_SUBMENU_SUBLEVELS: SubLevelInfo[] = [
  { subLevel: 1, title: '기초 덧셈', count: 10 },
  { subLevel: 2, title: '받아올림 덧셈', count: 10 },
  { subLevel: 3, title: '두 자리 덧셈', count: 10 },
  { subLevel: 4, title: '기초 뺄셈', count: 10 },
  { subLevel: 5, title: '받아내림 뺄셈', count: 10 },
];

export const SUBMENU_BOUNDS_IDS = [
  'sub_title',
  'sub_card_0',
  'sub_card_1',
  'sub_card_2',
  'sub_card_3',
  'sub_card_4',
  'sub_card_5',
  'menu_sub_back',
  'bottom_bar_back',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'bottom_bar',
  'bottom_bar_settings',
  'bottom_bar_action',
  'bottom_bar_mana',
] as const;

export type SubmenuBoundId = (typeof SUBMENU_BOUNDS_IDS)[number];

const PROTECTED_HUD_ZONE = Object.freeze({
  x: 0,
  y: 0,
  width: 1080,
  height: 120,
});

const isImageElement = (val: unknown): val is HTMLImageElement => {
  return typeof HTMLImageElement !== 'undefined' && val instanceof HTMLImageElement;
};

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// MenuRenderer.fromPresentationDocument 헬퍼 바인딩 보장
if (typeof (MenuRenderer as any).fromPresentationDocument !== 'function') {
  (MenuRenderer as any).fromPresentationDocument = function (
    doc: UIPresentationDocument,
    _pageId?: string
  ): MenuPresentationContext {
    return {
      presentationDocument: doc,
      mainPage: doc?.pages?.main_home,
      subPage: doc?.pages?.submenu ?? (doc?.pages as any)?.['menu_sub'],
    };
  };
}

/**
 * 서브메뉴 페이지 렌더 어댑터 (submenu / menu_sub 공용)
 */
export const submenuPageAdapter: PageAdapter = (ctx: PageRenderContext): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 지원 페이지 검증
  if (pageId !== SUBMENU_PAGE_ID && pageId !== MENU_SUB_PAGE_ID) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
    };
  }

  // 2. Fixture 유효성 및 Stale 검증
  if (
    !fixture ||
    fixture.clockMs < 0 ||
    Number.isNaN(fixture.clockMs) ||
    (fixture as any).stale === true
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-fixture',
      timestamp: Date.now(),
    };
  }

  // 3. Snapshot 보안 및 무결성 검증
  if (snapshot && typeof snapshot === 'object') {
    const rawSnap = snapshot as any;

    if (rawSnap.stale === true) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'stale-revision',
        timestamp: Date.now(),
      };
    }

    // 보호 영역 침범 검사 (HUD zone: 0..120)
    const elements =
      rawSnap.pages?.submenu?.elements ??
      rawSnap.pages?.menu_sub?.elements ??
      rawSnap.elements;

    if (Array.isArray(elements)) {
      for (const el of elements) {
        if (!el || !el.bounds) continue;
        const b = {
          x: el.bounds.x ?? 0,
          y: el.bounds.y ?? 0,
          width: el.bounds.width ?? el.bounds.w ?? 0,
          height: el.bounds.height ?? el.bounds.h ?? 0,
        };

        if (overlaps(b, PROTECTED_HUD_ZONE)) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }
      }
    }
  }

  // 4. Presentation Document 및 Context 추출
  const raw = (snapshot ?? {}) as any;
  const doc: UIPresentationDocument | undefined =
    raw.kind === 'dream-guardian-ui-presentation'
      ? (raw as UIPresentationDocument)
      : raw.presentationDocument ?? raw.document;

  const baseContext = doc
    ? ((MenuRenderer as any).fromPresentationDocument(doc, pageId) as MenuPresentationContext)
    : {};
  const explicitContext = raw.context as MenuPresentationContext | undefined;

  const menuContext: MenuPresentationContext = {
    ...baseContext,
    presentationDocument: doc,
    subPage: doc?.pages?.submenu ?? (doc?.pages as any)?.['menu_sub'],
    assetResolver: (assetId: string) => {
      const res = fixture.assetResolver ? fixture.assetResolver(assetId) : null;
      return isImageElement(res) ? res : null;
    },
    ...(explicitContext ?? {}),
  };

  // 5. 챕터 및 서브레벨 데이터 조립
  const chapter: number = raw.chapter ?? (fixture as any).chapter ?? 1;
  const subLevels: SubLevelInfo[] =
    raw.subLevels ?? (fixture as any).subLevels ?? DEFAULT_SUBMENU_SUBLEVELS;
  const selectedSubLevel: number | undefined =
    raw.selectedSubLevel ?? (fixture as any).selectedSubLevel;

  // 6. MenuRenderer 서브메뉴 실제 렌더링
  const menuRenderer = new MenuRenderer();
  menuRenderer.setPresentationContext(menuContext);
  menuRenderer.renderSubMenu(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    chapter,
    subLevels,
    selectedSubLevel,
    menuContext
  );

  // 7. HUDLayer 정적 합성
  const hudLayer = new HUDLayer();
  if (doc) {
    hudLayer.setPresentationContext(HUDLayer.fromPresentationDocument(doc, pageId));
  } else if (raw.hudContext) {
    hudLayer.setPresentationContext(raw.hudContext as HUDPresentationContext);
  }
  const hudData: HUDData = {
    playerHp: 100,
    playerMaxHp: 100,
    bossHp: 10,
    bossMaxHp: 10,
    combo: 0,
    chapter,
    guardianStage: 1,
    ...(raw.hudData ?? {}),
  };
  hudLayer.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8. BottomBar 정적 합성
  const bottomBar = new BottomBar();
  if (doc) {
    bottomBar.setPresentationContext(BottomBar.fromPresentationDocument(doc, pageId));
  } else if (raw.bottomBarContext) {
    bottomBar.setPresentationContext(raw.bottomBarContext as BottomBarPresentationContext);
  }
  const bottomBarOptions: BottomBarRenderOptions = {
    pageId,
    actionLabel: '← 뒤로',
    mana: 0,
    manaMax: 100,
    combo: 0,
    ...(raw.bottomBarOptions ?? {}),
  };
  bottomBar.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. renderedBounds 영역 계산
  const titleSlot = menuRenderer.getSubMenuTitleLayout(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    menuContext
  );
  const allLayouts = menuRenderer.getSubMenuLayouts(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    chapter,
    subLevels,
    menuContext
  );

  // 카드 목록 (subLevel !== -1)
  const cardLayouts = allLayouts.filter((item) => item.subLevel !== -1);
  const backLayout = menuRenderer.getSubMenuBackButtonLayout(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    menuContext
  );

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossNameBounds = hudLayer.getBossNameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const settingsBtnBounds = bottomBar.getSettingsButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);
  const actionBtnBounds = bottomBar.getActionButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);
  const manaBarBounds = bottomBar.getManaBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'sub_title',
      x: titleSlot.x,
      y: titleSlot.y,
      width: titleSlot.w,
      height: titleSlot.h,
    },
    ...cardLayouts.map((card, idx) => ({
      id: `sub_card_${idx}`,
      x: card.x,
      y: card.y,
      width: card.w,
      height: card.h,
    })),
    {
      id: 'menu_sub_back',
      x: backLayout.x,
      y: backLayout.y,
      width: backLayout.w,
      height: backLayout.h,
    },
    {
      id: 'bottom_bar_back',
      x: backLayout.x,
      y: backLayout.y,
      width: backLayout.w,
      height: backLayout.h,
    },
    {
      id: 'hud_player_hp',
      x: playerHpBounds.x,
      y: playerHpBounds.y,
      width: playerHpBounds.w,
      height: playerHpBounds.h,
    },
    {
      id: 'hud_boss_hp',
      x: bossHpBounds.x,
      y: bossHpBounds.y,
      width: bossHpBounds.w,
      height: bossHpBounds.h,
    },
    {
      id: 'hud_boss_name',
      x: bossNameBounds.x,
      y: bossNameBounds.y,
      width: bossNameBounds.w,
      height: bossNameBounds.h,
    },
    {
      id: 'hud_combo',
      x: comboBounds.x,
      y: comboBounds.y,
      width: comboBounds.w,
      height: comboBounds.h,
    },
    {
      id: 'bottom_bar',
      x: bottomBarBounds.x,
      y: bottomBarBounds.y,
      width: bottomBarBounds.w,
      height: bottomBarBounds.h,
    },
    {
      id: 'bottom_bar_settings',
      x: settingsBtnBounds.x,
      y: settingsBtnBounds.y,
      width: settingsBtnBounds.w,
      height: settingsBtnBounds.h,
    },
    {
      id: 'bottom_bar_action',
      x: actionBtnBounds.x,
      y: actionBtnBounds.y,
      width: actionBtnBounds.w,
      height: actionBtnBounds.h,
    },
    {
      id: 'bottom_bar_mana',
      x: manaBarBounds.x,
      y: manaBarBounds.y,
      width: manaBarBounds.w,
      height: manaBarBounds.h,
    },
  ];

  return {
    ok: true,
    drew: true,
    pageId,
    renderedBounds,
    timestamp: Date.now(),
  };
};

/**
 * Registry에 Submenu Page Adapter 등록
 */
export function registerSubmenuPageAdapter(registry: PageAdapterRegistry): void {
  registry.register(SUBMENU_PAGE_ID, submenuPageAdapter);
  registry.register(MENU_SUB_PAGE_ID, submenuPageAdapter);
}
