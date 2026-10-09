/**
 * UIPlayReadyPage.ts - 플레이 시작 실제 렌더 페이지 어댑터 (Issue #454 / UI-VIS-024)
 *
 * 개발 규칙 및 명세 준수:
 * 1. ReadyPositionRenderer의 실제 렌더링 로직(render/renderFixture) 재사용
 * 2. ReadyPositionController, 실제 웹캠 스트림, MediaPipe 모션 인식 루프, 카운트다운 타이머 인터벌 부팅 0건 보장
 * 3. 게임 엔진 루프, AppBootstrap, SceneDirector, 이벤트 리스너, 카메라/오디오/TTS 부팅 0건 보장
 * 4. 3초 네온 카운트다운(3, 2, 1, START!), 신체 정렬 가이드 프레임/실루엣, 상단 안내문구, 하단 건너뛰기 렌더링
 * 5. ReadyPositionRenderer.fromPresentationDocument 및 ReadyPositionPresentationContext 바인딩 반영
 * 6. 공통 HUD(HUDLayer) 및 하단 고정 바(BottomBar) 정적 합성 (부작용 0건)
 * 7. Stable ID(ready_guide_box, ready_silhouette, ready_countdown, ready_title, ready_guide_text, ready_skip_notice, HUD, BottomBar 등)를 포함한 renderedBounds 반환
 * 8. Stale fixture, stale revision, 모션 보호 영역 침범, HUD 영역 침범에 대한 엄격한 가드 및 에러 처리
 */

import {
  ReadyPositionRenderer,
  DEFAULT_READY_POSITION_FIXTURE_STATE,
  type ReadyPositionPresentationContext,
  type ReadyPositionSlotOverride,
} from '../../../../render/ReadyPositionRenderer.js';
import type { ReadyPositionRenderState } from '../../../../game/ReadyPositionController.js';
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

export const PLAY_READY_PAGE_ID = 'play_ready';
export const READY_POSITION_PAGE_ID = 'ready_position';

export const PLAY_READY_BOUNDS_IDS = [
  'ready_guide_box',
  'ready_silhouette',
  'ready_countdown',
  'ready_title',
  'ready_guide_text',
  'ready_skip_notice',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'bottom_bar',
  'bottom_bar_settings',
  'bottom_bar_action',
  'bottom_bar_mana',
] as const;

export type PlayReadyBoundId = (typeof PLAY_READY_BOUNDS_IDS)[number];

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
 * 플레이 시작 페이지 렌더 어댑터
 */
export const playReadyPageAdapter: PageAdapter = (ctx: PageRenderContext): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 페이지 ID 유효성 검사
  if (pageId !== PLAY_READY_PAGE_ID && pageId !== READY_POSITION_PAGE_ID) {
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

    if (typeof rawSnap.revision === 'number' && typeof (fixture as any)?.revision === 'number') {
      if (rawSnap.revision < (fixture as any).revision) {
        return {
          ok: false,
          drew: false,
          pageId,
          reason: 'stale-revision',
          timestamp: Date.now(),
        };
      }
    }

    // 상단 HUD 보호 영역 침범 검증
    const elements =
      rawSnap.pages?.[pageId]?.elements ??
      rawSnap.pages?.[PLAY_READY_PAGE_ID]?.elements ??
      rawSnap.pages?.[READY_POSITION_PAGE_ID]?.elements ??
      rawSnap.elements;

    if (Array.isArray(elements)) {
      for (const el of elements) {
        if (!el || !el.bounds) continue;
        if (el.id && el.id.startsWith('hud_')) continue;
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

  // 4. UIPresentationDocument 및 ReadyPositionPresentationContext 조립
  let doc: UIPresentationDocument | undefined;
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  let readyContext: ReadyPositionPresentationContext = {};
  if (doc) {
    readyContext = ReadyPositionRenderer.fromPresentationDocument(doc, pageId);
  }

  // snapshot이나 fixture의 명시적 readyContext 병합
  const explicitContext =
    raw.readyContext ??
    (fixture as any)?.readyContext ??
    (fixture as any)?.presentationContext;
  if (explicitContext) {
    readyContext = {
      ...readyContext,
      ...explicitContext,
      headerMessage: { ...readyContext.headerMessage, ...explicitContext.headerMessage },
      countdown: { ...readyContext.countdown, ...explicitContext.countdown },
      skipNotice: { ...readyContext.skipNotice, ...explicitContext.skipNotice },
      alignmentFrame: { ...readyContext.alignmentFrame, ...explicitContext.alignmentFrame },
      background: { ...readyContext.background, ...explicitContext.background },
    };
  }

  // presentationDocument의 elements 직접 순회하여 커스텀 bounds 보강
  const docElements: any[] = [];
  if (doc?.pages?.[pageId as UIPresentationPageId]?.elements) {
    docElements.push(...doc.pages[pageId as UIPresentationPageId]!.elements);
  } else if (doc?.pages?.[PLAY_READY_PAGE_ID]?.elements) {
    docElements.push(...doc.pages[PLAY_READY_PAGE_ID]!.elements);
  } else if ((doc?.pages as Record<string, any>)?.[READY_POSITION_PAGE_ID]?.elements) {
    docElements.push(...(doc?.pages as Record<string, any>)[READY_POSITION_PAGE_ID].elements);
  } else if (Array.isArray(raw.elements)) {
    docElements.push(...raw.elements);
  }

  if (docElements.length > 0) {
    for (const el of docElements) {
      if (!el) continue;
      const b: ReadyPositionSlotOverride = el.bounds
        ? {
            x: el.bounds.x,
            y: el.bounds.y,
            w: el.bounds.width ?? (el.bounds as any).w ?? 0,
            h: el.bounds.height ?? (el.bounds as any).h ?? 0,
          }
        : {};

      if (el.text) b.text = el.text;
      if (el.fontSize) b.fontSize = el.fontSize;
      if (el.style?.fontSize) b.fontSize = el.style.fontSize;
      if (el.style?.color) b.color = el.style.color;

      const id = el.id ? String(el.id).toLowerCase() : '';
      if (
        id === 'ready_guide_text' ||
        id === 'header_message' ||
        id === 'guide_text' ||
        id === 'ready_title' ||
        id === 'header'
      ) {
        readyContext.headerMessage = { ...b, ...readyContext.headerMessage };
      } else if (
        id === 'ready_skip_notice' ||
        id === 'skip_notice' ||
        id === 'skip_text' ||
        id === 'skip_prompt' ||
        id === 'skip'
      ) {
        readyContext.skipNotice = { ...b, ...readyContext.skipNotice };
      } else if (
        id === 'ready_countdown' ||
        id === 'countdown' ||
        id === 'timer'
      ) {
        readyContext.countdown = { ...b, ...readyContext.countdown };
      } else if (
        id === 'body_alignment_area' ||
        id === 'alignment_frame' ||
        id === 'guide_frame' ||
        id === 'silhouette' ||
        id === 'ready_guide_box'
      ) {
        readyContext.alignmentFrame = { ...b, ...readyContext.alignmentFrame };
      }
    }
  }

  // 5. 모션 인식 안전 영역 보호 검증 (alignmentFrame geometry 변조 차단)
  const readyRenderer = new ReadyPositionRenderer(readyContext);
  const motionZoneValidation = readyRenderer.validatePresentationContext(readyContext);
  if (!motionZoneValidation.valid) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'protected-zone-violation',
      timestamp: Date.now(),
    };
  }

  // 6. ReadyPositionRenderer 인스턴스 렌더링 호출 (결정론적 fixture)
  const fixtureObj = (fixture ?? {}) as Record<string, any>;
  const isAligned =
    fixtureObj.isAligned ??
    raw.isAligned ??
    (fixtureObj.state?.isAligned) ??
    DEFAULT_READY_POSITION_FIXTURE_STATE.isAligned;

  const currentCount =
    fixtureObj.currentCount ??
    raw.currentCount ??
    (fixtureObj.state?.currentCount) ??
    DEFAULT_READY_POSITION_FIXTURE_STATE.currentCount;

  const countText =
    fixtureObj.countText ??
    raw.countText ??
    (fixtureObj.state?.countText) ??
    (currentCount <= 0 ? 'START!' : String(currentCount));

  const readyTimer =
    fixtureObj.readyTimer ??
    raw.readyTimer ??
    (fixtureObj.state?.readyTimer) ??
    (currentCount <= 0 ? 0 : currentCount);

  const remainingTime =
    fixtureObj.remainingTime ??
    raw.remainingTime ??
    (fixtureObj.state?.remainingTime) ??
    readyTimer;

  const renderState: ReadyPositionRenderState = {
    ...DEFAULT_READY_POSITION_FIXTURE_STATE,
    isAligned,
    currentCount,
    countText,
    readyTimer,
    remainingTime,
    ...(raw.state ?? fixtureObj.state ?? {}),
  };

  if (fixtureObj.clockMs !== undefined) {
    readyRenderer.update(fixtureObj.clockMs / 1000);
  } else if (fixtureObj.animTime !== undefined) {
    readyRenderer.update(fixtureObj.animTime);
  } else if (raw.animTime !== undefined) {
    readyRenderer.update(raw.animTime);
  }

  readyRenderer.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, renderState);

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
    ...(raw.hudData ?? fixtureObj.hudData ?? {}),
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
    actionLabel: '준비 완료',
    mana: 0,
    manaMax: 100,
    ...((raw.bottomBarOptions ?? fixtureObj.bottomBarOptions ?? {}) as Partial<BottomBarRenderOptions>),
  };
  bottomBar.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. Bounds 산출
  const frameBounds = readyRenderer.getAlignmentFrameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, readyContext);
  const headerBounds = readyRenderer.getHeaderMessageBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, readyContext);
  const countdownBounds = readyRenderer.getCountdownBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, readyContext);
  const skipBounds = readyRenderer.getSkipNoticeBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, readyContext);

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
      id: 'ready_guide_box',
      x: frameBounds.x,
      y: frameBounds.y,
      width: frameBounds.w,
      height: frameBounds.h,
      isProtected: true,
    },
    {
      id: 'ready_silhouette',
      x: frameBounds.x + frameBounds.w * 0.15,
      y: frameBounds.y + frameBounds.h * 0.08,
      width: frameBounds.w * 0.7,
      height: frameBounds.h * 0.84,
      isProtected: true,
    },
    {
      id: 'ready_countdown',
      x: countdownBounds.x,
      y: countdownBounds.y,
      width: countdownBounds.w,
      height: countdownBounds.h,
    },
    {
      id: 'ready_title',
      x: headerBounds.x,
      y: headerBounds.y,
      width: headerBounds.w,
      height: headerBounds.h,
    },
    {
      id: 'ready_guide_text',
      x: headerBounds.x,
      y: headerBounds.y,
      width: headerBounds.w,
      height: headerBounds.h,
    },
    {
      id: 'ready_skip_notice',
      x: skipBounds.x,
      y: skipBounds.y,
      width: skipBounds.w,
      height: skipBounds.h,
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

  // doc elements에 포함된 추가 커스텀 요소 bounds 보강
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

  // 10. 선택 요소 하이라이트 표시 (selectedElementIds)
  if (ctx.selectedElementIds && ctx.selectedElementIds.length > 0) {
    const selectedSet = new Set(ctx.selectedElementIds);
    ctx.ctx.save();
    ctx.ctx.strokeStyle = '#28E6FF';
    ctx.ctx.lineWidth = 3;
    if (ctx.ctx.setLineDash) ctx.ctx.setLineDash([8, 4]);

    for (const bound of renderedBounds) {
      if (selectedSet.has(bound.id)) {
        ctx.ctx.strokeRect(bound.x, bound.y, bound.width, bound.height);
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
    revision: (snapshot as any)?.revision,
    generation: (snapshot as any)?.generation,
  };
};

/**
 * PageAdapterRegistry에 play_ready 및 ready_position 어댑터 등록
 */
export function registerPlayReadyPageAdapter(registry: PageAdapterRegistry): void {
  registry.register(PLAY_READY_PAGE_ID, playReadyPageAdapter);
  registry.register(READY_POSITION_PAGE_ID, playReadyPageAdapter);
}
