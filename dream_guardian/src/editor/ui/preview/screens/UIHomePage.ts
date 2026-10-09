/**
 * UIHomePage.ts - 메인 홈 실제 렌더 페이지 어댑터 (Issue #450 / UI-VIS-020)
 *
 * 개발 규칙 및 명세 준수:
 * 1. MenuRenderer의 실제 렌더링 로직(draw/render)을 그대로 재사용
 * 2. 5개 챕터 카드(1~5, 잠금 상태 반영), 운동 모드 버튼(locomotion_btn), 메뉴 타이틀 및 배경 정적 렌더링
 * 3. 공통 HUD(HUDLayer) 및 하단 고정 바(BottomBar) 정적 합성
 * 4. 게임 런타임(게임 루프, AppBootstrap, SceneDirector, 카메라/오디오/TTS) 부팅 0건 보장
 * 5. Stable ID(chapter_1~5, locomotion_btn, menu_title, hud_..., bottom_bar_...)를 포함한 renderedBounds 반환
 * 6. Stale fixture, 미지원 슬롯, 보호 영역 침범에 대한 엄격한 가드 및 에러 처리
 */

import {
  MenuRenderer,
  type MenuState,
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
import { ARTBOARD_WIDTH, ARTBOARD_HEIGHT } from '../UIPageAdapters.js';
import type { UIPresentationDocument } from '../../../../data/UIPresentation.js';

export const MAIN_HOME_PAGE_ID = 'main_home';

export const MAIN_HOME_BOUNDS_IDS = [
  'menu_title',
  'locomotion_btn',
  'chapter_1',
  'chapter_2',
  'chapter_3',
  'chapter_4',
  'chapter_5',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'bottom_bar',
  'bottom_bar_settings',
  'bottom_bar_action',
  'bottom_bar_mana',
] as const;

export type MainHomeBoundId = (typeof MAIN_HOME_BOUNDS_IDS)[number];

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

/**
 * 메인 홈 페이지 렌더 어댑터 (main_home / menu_main 공용)
 */
export const homePageAdapter: PageAdapter = (ctx: PageRenderContext): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 지원 페이지 검증
  if (pageId !== MAIN_HOME_PAGE_ID && pageId !== 'menu_main') {
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
        reason: 'stale-fixture',
        timestamp: Date.now(),
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(rawSnap, '__proto__') ||
      rawSnap.corrupted === true ||
      rawSnap.unsupportedSlot !== undefined
    ) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'unsupported-slot',
        timestamp: Date.now(),
      };
    }

    if (rawSnap.violatesProtectedZone === true) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'protected-zone-violation',
        timestamp: Date.now(),
      };
    }

    // 커스텀 슬롯 가드 검사
    if (Array.isArray(rawSnap.customSlots)) {
      for (const slot of rawSnap.customSlots) {
        if (!slot?.bounds) continue;
        const b = slot.bounds;
        if (
          b.x < 0 ||
          b.y < 0 ||
          b.width <= 0 ||
          b.height <= 0 ||
          b.x + b.width > ARTBOARD_WIDTH ||
          b.y + b.height > ARTBOARD_HEIGHT
        ) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'unsupported-slot',
            timestamp: Date.now(),
          };
        }
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

  const explicitContext = raw.context as MenuPresentationContext | undefined;

  const menuContext: MenuPresentationContext = {
    presentationDocument: doc,
    mainPage: doc?.pages?.main_home,
    assetResolver: (assetId: string) => {
      const res = fixture.assetResolver ? fixture.assetResolver(assetId) : null;
      return isImageElement(res) ? res : null;
    },
    ...(explicitContext ?? {}),
  };

  // 5. MenuState 조립
  const menuState: MenuState = {
    unlockedChapter: raw.menuState?.unlockedChapter ?? 1,
    stars: raw.menuState?.stars ?? { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0 },
    selectedChapter: raw.menuState?.selectedChapter ?? 1,
    locomotionLabel: raw.menuState?.locomotionLabel ?? '러닝 (Run)',
    locomotionIcon: raw.menuState?.locomotionIcon ?? '🏃',
  };

  // 6. MenuRenderer 정적 렌더링
  const menuRenderer = new MenuRenderer();
  menuRenderer.setPresentationContext(menuContext);
  menuRenderer.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, menuState, menuContext);

  // 7. HUDLayer 정적 합성
  const hudLayer = new HUDLayer();
  if (doc) {
    hudLayer.setPresentationContext(HUDLayer.fromPresentationDocument(doc, 'main_home'));
  } else if (raw.hudContext) {
    hudLayer.setPresentationContext(raw.hudContext as HUDPresentationContext);
  }
  const hudData: HUDData = {
    playerHp: 100,
    playerMaxHp: 100,
    bossHp: 10,
    bossMaxHp: 10,
    combo: 0,
    chapter: 1,
    guardianStage: 1,
    ...(raw.hudData ?? {}),
  };
  hudLayer.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8. BottomBar 정적 합성
  const bottomBar = new BottomBar();
  if (doc) {
    bottomBar.setPresentationContext(BottomBar.fromPresentationDocument(doc, 'main_home'));
  } else if (raw.bottomBarContext) {
    bottomBar.setPresentationContext(raw.bottomBarContext as BottomBarPresentationContext);
  }
  const bottomBarOptions: BottomBarRenderOptions = {
    pageId: 'main_home',
    actionLabel: '시작',
    mana: 0,
    manaMax: 100,
    combo: 0,
    ...(raw.bottomBarOptions ?? {}),
  };
  bottomBar.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. renderedBounds 생성
  const titleSlot = menuRenderer.getTitleLayout(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, menuContext);
  const locomotionSlot = menuRenderer.getLocomotionButtonLayout(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, menuContext);
  const chapterLayouts = menuRenderer.getChapterLayouts(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, menuContext);

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossNameBounds = hudLayer.getBossNameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const settingsBtnBounds = bottomBar.getSettingsButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, 'main_home');
  const actionBtnBounds = bottomBar.getActionButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, 'main_home');
  const manaBarBounds = bottomBar.getManaBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, 'main_home');

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'menu_title',
      x: titleSlot.x,
      y: titleSlot.y,
      width: titleSlot.w,
      height: titleSlot.h,
    },
    {
      id: 'locomotion_btn',
      x: locomotionSlot.x,
      y: locomotionSlot.y,
      width: locomotionSlot.w,
      height: locomotionSlot.h,
    },
    ...chapterLayouts.map((ch) => ({
      id: `chapter_${ch.chapter}`,
      x: ch.x,
      y: ch.y,
      width: ch.w,
      height: ch.h,
    })),
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

  // 10. 선택 요소 하이라이트 표시 (selectedElementIds)
  if (ctx.selectedElementIds && ctx.selectedElementIds.length > 0) {
    const selectedSet = new Set(ctx.selectedElementIds);
    ctx.ctx.save();
    ctx.ctx.strokeStyle = '#28E6FF';
    ctx.ctx.lineWidth = 3;
    if (ctx.ctx.setLineDash) ctx.ctx.setLineDash([8, 4]);

    for (const bound of renderedBounds) {
      if (selectedSet.has(bound.id)) {
        ctx.ctx.strokeRect(bound.x - 4, bound.y - 4, bound.width + 8, bound.height + 8);
      }
    }
    ctx.ctx.restore();
  }

  return {
    ok: true,
    drew: true,
    pageId,
    renderedElementCount: renderedBounds.length,
    renderedBounds,
    timestamp: Date.now(),
  };
};

/**
 * 대상 PageAdapterRegistry에 메인 홈 페이지 어댑터 등록
 */
export function registerHomePageAdapter(registry: PageAdapterRegistry): void {
  registry.register(MAIN_HOME_PAGE_ID, homePageAdapter);
}
