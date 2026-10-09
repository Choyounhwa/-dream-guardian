/**
 * UIPausePage.ts - 일시정지 실제 렌더 페이지 어댑터 (Issue #453 / UI-VIS-023)
 *
 * 개발 규칙 및 명세 준수:
 * 1. PauseModal의 실제 렌더링 로직(PauseModal.prototype.render) 재사용
 * 2. 게임 엔진 루프, AppBootstrap, SceneDirector, 이벤트 리스너, 카메라/오디오/TTS 부팅 0건 보장
 * 3. 모달 배경, 다이얼로그 박스, 버튼(resume, quit 및 pause_settings) 렌더링
 * 4. PauseModal.fromPresentationDocument 및 PausePresentationContext 바인딩 반영
 * 5. 공통 HUD(HUDLayer) 및 하단 고정 바(BottomBar) 정적 합성 (부작용 0건)
 * 6. Stable ID(pause_modal, pause_title, pause_resume, pause_settings, pause_quit, HUD, BottomBar 등)를 포함한 renderedBounds 반환
 * 7. Stale fixture, stale revision, 보호 영역 침범(HUD 영역 침범 등)에 대한 엄격한 가드 및 에러 처리
 */

import {
  PauseModal,
  isSupportedPauseAction,
  type PausePresentationContext,
  type PauseAction,
  type PauseModalFixtureDTO,
  type ModalButtonSlot,
} from '../../../../ui/PauseModal.js';
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

export const PAUSE_PAGE_ID = 'pause';

export const PAUSE_BOUNDS_IDS = [
  'pause_modal',
  'pause_title',
  'pause_resume',
  'pause_settings',
  'pause_quit',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'bottom_bar',
  'bottom_bar_settings',
  'bottom_bar_action',
  'bottom_bar_mana',
] as const;

export type PauseBoundId = (typeof PAUSE_BOUNDS_IDS)[number];

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
 * 일시정지 페이지 렌더 어댑터
 */
export const pausePageAdapter: PageAdapter = (ctx: PageRenderContext): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 페이지 ID 유효성 검사
  if (pageId !== PAUSE_PAGE_ID) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
    };
  }

  // 2. Stale fixture 가드
  if ((fixture as any)?.isStale || (fixture as any)?.stale) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-fixture',
      timestamp: Date.now(),
    };
  }

  // 3. 스냅샷 데이터 및 stale-revision 가드
  if (snapshot && typeof snapshot === 'object') {
    const rawSnap = snapshot as Record<string, any>;

    if (rawSnap.schemaVersion && rawSnap.schemaVersion !== '1.0.0' && !rawSnap.schemaVersion.startsWith('1.')) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'unsupported-schema-version',
        timestamp: Date.now(),
      };
    }

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
      rawSnap.pages?.pause?.elements ??
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

  // 4. UIPresentationDocument 및 PausePresentationContext 조립
  let doc: UIPresentationDocument | undefined;
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  let pauseContext: PausePresentationContext = {};
  if (doc) {
    pauseContext = PauseModal.fromPresentationDocument(doc, pageId);
  }

  // snapshot이나 fixture의 명시적 pauseContext 병합
  const explicitContext = raw.pauseContext ?? (fixture as any)?.pauseContext;
  if (explicitContext) {
    pauseContext = {
      ...pauseContext,
      ...explicitContext,
      modal: { ...pauseContext.modal, ...explicitContext.modal },
      title: { ...pauseContext.title, ...explicitContext.title },
      resumeBtn: { ...pauseContext.resumeBtn, ...explicitContext.resumeBtn },
      quitBtn: { ...pauseContext.quitBtn, ...explicitContext.quitBtn },
      buttons: { ...pauseContext.buttons, ...explicitContext.buttons },
    };
  }

  // presentationDocument의 elements 직접 순회하여 커스텀 bounds 보강
  const docElements: any[] = [];
  if (doc?.pages?.[pageId as UIPresentationPageId]?.elements) {
    docElements.push(...doc.pages[pageId as UIPresentationPageId]!.elements);
  } else if (Array.isArray(raw.elements)) {
    docElements.push(...raw.elements);
  }

  if (docElements.length > 0) {
    for (const el of docElements) {
      if (!el?.bounds) continue;
      const b: ModalButtonSlot = {
        x: el.bounds.x,
        y: el.bounds.y,
        w: el.bounds.width ?? (el.bounds as any).w ?? 0,
        h: el.bounds.height ?? (el.bounds as any).h ?? 0,
      };
      if (
        el.id === 'pause_modal' ||
        el.id === 'modal' ||
        el.id === 'pause-dialog' ||
        el.id === 'dialog'
      ) {
        pauseContext.modal = { ...b, ...pauseContext.modal };
      } else if (
        el.id === 'pause_title' ||
        el.id === 'title' ||
        el.id === 'pause-title'
      ) {
        pauseContext.title = {
          ...b,
          text: el.text ?? pauseContext.title?.text,
          ...pauseContext.title,
        };
      } else if (
        el.id === 'btn_pause_resume' ||
        el.id === 'pause_resume' ||
        el.actionId === 'pause_resume' ||
        el.actionId === 'resume'
      ) {
        pauseContext.resumeBtn = {
          ...b,
          label: el.text ?? pauseContext.resumeBtn?.label,
          ...pauseContext.resumeBtn,
        };
        if (!pauseContext.buttons) pauseContext.buttons = {};
        pauseContext.buttons.resume = { ...b, label: el.text, ...pauseContext.buttons.resume };
      } else if (
        el.id === 'btn_pause_quit' ||
        el.id === 'pause_quit' ||
        el.actionId === 'pause_quit' ||
        el.actionId === 'quit' ||
        el.actionId === 'quitToMenu'
      ) {
        pauseContext.quitBtn = {
          ...b,
          label: el.text ?? pauseContext.quitBtn?.label,
          ...pauseContext.quitBtn,
        };
        if (!pauseContext.buttons) pauseContext.buttons = {};
        pauseContext.buttons.quit = { ...b, label: el.text, ...pauseContext.buttons.quit };
      }
    }
  }

  // 5. PauseModal 인스턴스 생성 및 순수 렌더러 호출
  const pauseModal = new PauseModal();
  pauseModal.setPresentationContext(pauseContext);
  const hoverAction = ((fixture as any)?.hoverAction ?? raw.hoverAction ?? null) as PauseAction | null;

  const fixtureDto: PauseModalFixtureDTO = {
    isOpen: true,
    scale: 1,
    alpha: 1,
    hoverAction: isSupportedPauseAction(hoverAction) ? hoverAction : null,
    hoverProgress: (fixture as any)?.hoverProgress ?? raw.hoverProgress ?? 0,
    presentationContext: pauseContext,
    ...((raw.pauseFixtureDto ?? (fixture as any)?.pauseFixtureDto ?? {}) as Partial<PauseModalFixtureDTO>),
  };

  pauseModal.render(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    fixtureDto
  );

  // 6. HUDLayer 정적 합성
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

  // 7. BottomBar 정적 합성
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

  // 8. Rendered Bounds 계산
  const modalSlot = pauseModal.getModalBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pauseContext);
  const titleSlot = pauseModal.getTitleBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pauseContext);
  const resumeSlot = pauseModal.getButtonLayout('resume', ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pauseContext)!;
  const quitSlot = pauseModal.getButtonLayout('quit', ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pauseContext)!;

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossNameBounds = hudLayer.getBossNameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const settingsBtnBounds = bottomBar.getSettingsButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);
  const actionBtnBounds = bottomBar.getActionButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);
  const manaBarBounds = bottomBar.getManaBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, pageId);

  // 커스텀 pause_settings가 있으면 우선 채택하고, 없으면 bottom_bar_settings 영역 채택
  const customSettingsEl = docElements.find(
    (el) => el.id === 'pause_settings' || el.id === 'btn_pause_settings' || el.actionId === 'pause_settings'
  );
  const settingsSlot = customSettingsEl?.bounds
    ? {
        x: customSettingsEl.bounds.x,
        y: customSettingsEl.bounds.y,
        width: customSettingsEl.bounds.width ?? (customSettingsEl.bounds as any).w ?? 0,
        height: customSettingsEl.bounds.height ?? (customSettingsEl.bounds as any).h ?? 0,
      }
    : (pauseContext as any)?.settingsBtn ?? (pauseContext?.buttons as any)?.settings ?? {
        x: settingsBtnBounds.x,
        y: settingsBtnBounds.y,
        width: settingsBtnBounds.w,
        height: settingsBtnBounds.h,
      };

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'pause_modal',
      x: modalSlot.x,
      y: modalSlot.y,
      width: modalSlot.w,
      height: modalSlot.h,
    },
    {
      id: 'pause_title',
      x: titleSlot.x,
      y: titleSlot.y,
      width: titleSlot.w,
      height: titleSlot.h,
    },
    {
      id: 'pause_resume',
      x: resumeSlot.x,
      y: resumeSlot.y,
      width: resumeSlot.w,
      height: resumeSlot.h,
    },
    {
      id: 'pause_settings',
      x: settingsSlot.x,
      y: settingsSlot.y,
      width: settingsSlot.width ?? (settingsSlot as any).w ?? 0,
      height: settingsSlot.height ?? (settingsSlot as any).h ?? 0,
    },
    {
      id: 'pause_quit',
      x: quitSlot.x,
      y: quitSlot.y,
      width: quitSlot.w,
      height: quitSlot.h,
    },
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

  // 9. 선택 요소 하이라이트 표시 (selectedElementIds)
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
 * PageAdapterRegistry에 pause 어댑터 등록
 */
export function registerPausePageAdapter(registry: PageAdapterRegistry): void {
  registry.register(PAUSE_PAGE_ID, pausePageAdapter);
}
