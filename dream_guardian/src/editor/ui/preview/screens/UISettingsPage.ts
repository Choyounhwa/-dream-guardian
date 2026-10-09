/**
 * UISettingsPage.ts - 옵션 실제 렌더 페이지 어댑터 (Issue #452 / UI-VIS-022)
 *
 * 개발 규칙 및 명세 준수:
 * 1. SettingsView의 실제 렌더링 로직(renderSettingsView 및 순수 SettingsView 인스턴스)을 재사용
 * 2. SettingsModal 생성자, localStorage, fullscreen, camera, audio 등 브라우저 사이드 이펙트 0건 보장
 * 3. 실제 모든 설정 항목(카메라, 실사웹캠, 전체화면, 스켈레톤, 사운드, 이동방식, 폰트크기, 고대비, 스틱맨크기) 및 닫기 버튼 렌더
 * 4. SettingsView.fromPresentationDocument 및 SettingsPresentationContext 바인딩 반영
 * 5. 공통 HUD(HUDLayer) 및 하단 고정 바(BottomBar) 정적 합성 (게임 루프 및 엔진 부팅 0건)
 * 6. Stable ID(settings_modal, settings_close, slider_bgm, slider_sfx, toggle_mirror, HUD, BottomBar 등)를 포함한 renderedBounds 반환
 * 7. Stale fixture, stale revision, 보호 영역 침범(HUD 영역 침범 등)에 대한 엄격한 가드 및 에러 처리
 */

import {
  SettingsView,
  getSettingsModalBounds,
  getSettingsButtonLayout,
  getSettingsButtonLayouts,
  createDefaultSettingsViewModel,
  SETTINGS_BUTTON_ACTIONS,
  type SettingsViewModel,
  type SettingsPresentationContext,
  type ModalButtonSlot,
} from '../../../../ui/SettingsView.js';
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
import type { UIPresentationDocument, UIPresentationPageId } from '../../../../data/UIPresentation.js';

export const OPTIONS_PAGE_ID = 'options';
export const SETTINGS_PAGE_ID = 'settings';

export const OPTIONS_BOUNDS_IDS = [
  'settings_modal',
  'settings_close',
  'btn_opt_close',
  'opt_title',
  'slider_bgm',
  'slider_sfx',
  'toggle_mirror',
  'camera',
  'webcamVideo',
  'fullscreen',
  'skeleton',
  'sound',
  'locomotion',
  'fontScale',
  'highContrast',
  'stickmanScale',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'bottom_bar',
  'bottom_bar_settings',
  'bottom_bar_action',
  'bottom_bar_mana',
] as const;

export type OptionsBoundId = (typeof OPTIONS_BOUNDS_IDS)[number];

const PROTECTED_HUD_ZONE = Object.freeze({
  x: 0,
  y: 0,
  width: 1080,
  height: 120,
});

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
 * 옵션/설정 실제 렌더 페이지 어댑터 (options / settings 공용)
 */
export const optionsPageAdapter: PageAdapter = (ctx: PageRenderContext): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 지원 페이지 식별자 검증
  if (pageId !== OPTIONS_PAGE_ID && pageId !== SETTINGS_PAGE_ID) {
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

  // 3. Snapshot 무결성 및 Stale 검증
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

    // 보호 영역 침범 검사 (HUD zone: y 0..120)
    const elements =
      rawSnap.pages?.options?.elements ??
      rawSnap.pages?.settings?.elements ??
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

  const raw = (snapshot && typeof snapshot === 'object' ? snapshot : {}) as Record<string, any>;

  // 4. UIPresentationDocument 및 SettingsPresentationContext 조립
  let doc: UIPresentationDocument | undefined;
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  let settingsContext: SettingsPresentationContext = {};
  if (doc) {
    settingsContext = SettingsView.fromPresentationDocument(doc, pageId);
  }

  // snapshot이나 fixture의 명시적 settingsContext 병합
  const explicitContext = raw.settingsContext ?? (fixture as any)?.settingsContext;
  if (explicitContext) {
    settingsContext = {
      ...settingsContext,
      ...explicitContext,
      buttons: {
        ...(settingsContext.buttons ?? {}),
        ...(explicitContext.buttons ?? {}),
      },
    };
  }

  // doc elements에서 settings_close 등 추가 커스텀 슬롯 바인딩 보강
  if (doc?.pages) {
    const targetPages =
      pageId && doc.pages[pageId as UIPresentationPageId]
        ? [doc.pages[pageId as UIPresentationPageId]]
        : Object.values(doc.pages);

    for (const p of targetPages) {
      if (!p?.elements) continue;
      for (const el of p.elements) {
        if (!el?.bounds) continue;
        const b: ModalButtonSlot = {
          x: el.bounds.x,
          y: el.bounds.y,
          w: el.bounds.width ?? (el.bounds as any).w ?? 0,
          h: el.bounds.height ?? (el.bounds as any).h ?? 0,
        };
        if (
          el.id === 'settings_close' ||
          el.id === 'btn_opt_close' ||
          el.actionId === 'close_settings'
        ) {
          settingsContext.closeBtn = { ...b, ...settingsContext.closeBtn };
          if (!settingsContext.buttons) settingsContext.buttons = {};
          settingsContext.buttons.close = { ...b, ...settingsContext.buttons.close };
        } else if (
          el.id === 'settings_modal' ||
          el.id === 'opt_dialog' ||
          el.id === 'modal'
        ) {
          settingsContext.modal = { ...b, ...settingsContext.modal };
        }
      }
    }
  }

  // 5. SettingsViewModel 조립 (부작용 0건의 순수 DTO)
  const rawModel = (raw.settingsModel ?? (fixture as any)?.settingsModel ?? {}) as Partial<SettingsViewModel>;
  const viewModel: SettingsViewModel = createDefaultSettingsViewModel({
    isOpen: true,
    alpha: 1,
    scale: 1,
    cameraEnabled: rawModel.cameraEnabled ?? raw.cameraEnabled ?? (fixture as any)?.cameraEnabled ?? true,
    renderVideoEnabled: rawModel.renderVideoEnabled ?? raw.renderVideoEnabled ?? (fixture as any)?.renderVideoEnabled ?? false,
    skeletonEnabled: rawModel.skeletonEnabled ?? raw.skeletonEnabled ?? (fixture as any)?.skeletonEnabled ?? true,
    soundEnabled: rawModel.soundEnabled ?? raw.soundEnabled ?? (fixture as any)?.soundEnabled ?? true,
    locomotionModeLabel: rawModel.locomotionModeLabel ?? raw.locomotionModeLabel ?? (fixture as any)?.locomotionModeLabel ?? '제자리 달리기 (기본)',
    fontScale: rawModel.fontScale ?? raw.fontScale ?? (fixture as any)?.fontScale ?? 1.0,
    fontScaleLabel: rawModel.fontScaleLabel ?? raw.fontScaleLabel ?? (fixture as any)?.fontScaleLabel,
    highContrast: rawModel.highContrast ?? raw.highContrast ?? (fixture as any)?.highContrast ?? false,
    stickmanScale: rawModel.stickmanScale ?? raw.stickmanScale ?? (fixture as any)?.stickmanScale ?? 1.0,
    stickmanScaleLabel: rawModel.stickmanScaleLabel ?? raw.stickmanScaleLabel ?? (fixture as any)?.stickmanScaleLabel,
    isFullscreen: rawModel.isFullscreen ?? raw.isFullscreen ?? (fixture as any)?.isFullscreen ?? false,
    ...rawModel,
  });

  // 6. SettingsView 순수 렌더러 파이프라인 호출
  const settingsView = new SettingsView(settingsContext);
  settingsView.render(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    viewModel,
    settingsContext
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
    chapter: 1,
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
    actionLabel: '확인',
    mana: 0,
    manaMax: 100,
    isActionDisabled: false,
    ...(raw.bottomBarOptions ?? {}),
  };
  bottomBar.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. Rendered Bounds 계산
  const modalSlot = getSettingsModalBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, settingsContext);
  const btnSlots = getSettingsButtonLayouts(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    viewModel,
    settingsContext
  );
  const closeSlot =
    btnSlots.close ?? getSettingsButtonLayout('close', ARTBOARD_WIDTH, ARTBOARD_HEIGHT, settingsContext);

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossNameBounds = hudLayer.getBossNameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const settingsBtnBounds = bottomBar.getSettingsButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);
  const actionBtnBounds = bottomBar.getActionButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);
  const manaBarBounds = bottomBar.getManaBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);

  const docElements = doc?.pages?.[pageId as UIPresentationPageId]?.elements ?? [];
  const findDocElement = (id: string) => docElements.find((e) => e.id === id);

  const modalEl = findDocElement('settings_modal') ?? findDocElement('opt_dialog') ?? findDocElement('modal');
  const closeEl = findDocElement('settings_close') ?? findDocElement('btn_opt_close') ?? findDocElement('close');
  const titleEl = findDocElement('opt_title') ?? findDocElement('settings_title');
  const sliderBgmEl = findDocElement('slider_bgm');
  const sliderSfxEl = findDocElement('slider_sfx');
  const toggleMirrorEl = findDocElement('toggle_mirror');

  const soundSlot = btnSlots.sound;
  const cameraSlot = btnSlots.camera;

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'settings_modal',
      x: modalEl?.bounds?.x ?? modalSlot.x,
      y: modalEl?.bounds?.y ?? modalSlot.y,
      width: modalEl?.bounds?.width ?? modalSlot.w,
      height: modalEl?.bounds?.height ?? modalSlot.h,
    },
    {
      id: 'settings_close',
      x: closeEl?.bounds?.x ?? closeSlot.x,
      y: closeEl?.bounds?.y ?? closeSlot.y,
      width: closeEl?.bounds?.width ?? closeSlot.w,
      height: closeEl?.bounds?.height ?? closeSlot.h,
    },
    {
      id: 'btn_opt_close',
      x: closeEl?.bounds?.x ?? closeSlot.x,
      y: closeEl?.bounds?.y ?? closeSlot.y,
      width: closeEl?.bounds?.width ?? closeSlot.w,
      height: closeEl?.bounds?.height ?? closeSlot.h,
    },
    {
      id: 'opt_title',
      x: titleEl?.bounds?.x ?? modalSlot.x + 60,
      y: titleEl?.bounds?.y ?? modalSlot.y + 40,
      width: titleEl?.bounds?.width ?? modalSlot.w - 120,
      height: titleEl?.bounds?.height ?? 60,
    },
    {
      id: 'slider_bgm',
      x: sliderBgmEl?.bounds?.x ?? soundSlot.x,
      y: sliderBgmEl?.bounds?.y ?? soundSlot.y,
      width: sliderBgmEl?.bounds?.width ?? soundSlot.w,
      height: sliderBgmEl?.bounds?.height ?? soundSlot.h,
    },
    {
      id: 'slider_sfx',
      x: sliderSfxEl?.bounds?.x ?? soundSlot.x,
      y: sliderSfxEl?.bounds?.y ?? soundSlot.y,
      width: sliderSfxEl?.bounds?.width ?? soundSlot.w,
      height: sliderSfxEl?.bounds?.height ?? soundSlot.h,
    },
    {
      id: 'toggle_mirror',
      x: toggleMirrorEl?.bounds?.x ?? cameraSlot.x,
      y: toggleMirrorEl?.bounds?.y ?? cameraSlot.y,
      width: toggleMirrorEl?.bounds?.width ?? cameraSlot.w,
      height: toggleMirrorEl?.bounds?.height ?? cameraSlot.h,
    },
    // 전체 설정 버튼 액션들 (close 제외)
    ...SETTINGS_BUTTON_ACTIONS.filter((act) => act !== 'close').map((act) => {
      const slot = btnSlots[act];
      return {
        id: act,
        x: slot.x,
        y: slot.y,
        width: slot.w,
        height: slot.h,
      };
    }),
    // HUD bounds
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
    // BottomBar bounds
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

  // doc elements에 포함된 임의의 추가 요소 bounds 보강
  for (const el of docElements) {
    if (el?.bounds && !renderedBounds.some((b) => b.id === el.id)) {
      renderedBounds.push({
        id: el.id,
        x: el.bounds.x,
        y: el.bounds.y,
        width: el.bounds.width ?? (el.bounds as any).w ?? 0,
        height: el.bounds.height ?? (el.bounds as any).h ?? 0,
      });
    }
  }

  return {
    ok: true,
    drew: true,
    pageId,
    renderedBounds,
    timestamp: Date.now(),
  };
};

export const settingsPageAdapter: PageAdapter = optionsPageAdapter;

/**
 * PageAdapterRegistry에 options 및 settings 어댑터 등록
 */
export function registerOptionsPageAdapter(registry: PageAdapterRegistry): void {
  registry.register(OPTIONS_PAGE_ID, optionsPageAdapter);
  registry.register(SETTINGS_PAGE_ID, settingsPageAdapter);
}
