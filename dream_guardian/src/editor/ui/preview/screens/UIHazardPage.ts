/**
 * UIHazardPage.ts - 오답·위험 회피 실제 렌더 페이지 어댑터 (Issue #457 / UI-VIS-027)
 *
 * 개발 규칙 및 명세 준수:
 * 1. HazardZoneRenderer(UI-VIS-017) 및 PhasePresentationAdapter / JudgmentFeedback(UI-VIS-018) 실제 렌더링 파이프라인 결합
 * 2. 0-runtime 부팅 격리: GameEngine, AppBootstrap, SceneDirector, LocomotionDetector, Web Audio/TTS, 카메라/포즈 부팅 0건 보장
 * 3. 결정론적 Fixture 주입 (DEFAULT_HAZARD_PAGE_FIXTURE, JUMP/STEP/BALANCE 회피 패턴 DTO)
 * 4. UIPresentationDocument 연동: fromPresentationDocument를 통한 텍스트/스타일/위치 커스텀 반영
 * 5. 공통 HUD(HUDLayer) 및 하단바(BottomBar), DreamGrid 정적 합성
 * 6. Stable ID(hazard_warning_banner, hazard_action_guide, hazard_safe_zone, hazard_zone_rect, zone_6~11, HUD, BottomBar)를 포함한 renderedBounds 반환
 * 7. 보호 영역(보호 HUD 존, Zone 6~11 모션 존, 바닥 판정선, 장판 물리 기하) 침범 및 변조 시도 가드
 * 8. Stale fixture, stale revision, 비정상 캔버스 엄격한 가드 처리
 */

import { DreamGrid } from '../../../../render/DreamGrid.js';
import {
  HazardZoneRenderer,
  PROTECTED_HAZARD_ZONE_SLOT_IDS,
  type HazardFixtureDTO,
  type HazardPresentationContext,
} from '../../../../render/HazardZoneRenderer.js';
import {
  PhasePresentationAdapter,
  type HazardEvadePresentationState,
  type FeedbackPresentationContext,
} from '../../../../ui/PhasePresentationAdapter.js';
import {
  JudgmentFeedback,
  type FeedbackFixtureDTO,
} from '../../../../ui/JudgmentFeedback.js';
import { HUDLayer, type HUDData, type HUDPresentationContext } from '../../../../ui/HUDLayer.js';
import {
  BottomBar,
  type BottomBarRenderOptions,
  type BottomBarPresentationContext,
} from '../../../../ui/BottomBar.js';
import type {
  DeterministicFixture,
  PageRenderContext,
  PageRenderResult,
  PageRenderBounds,
  PageAdapterRegistry,
} from '../UIPageAdapters.js';
import type {
  UIPresentationDocument,
  UIPresentationPageId,
} from '../../../../data/UIPresentation.js';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  defaultPageAdapterRegistry,
} from '../UIPageAdapters.js';
import { DEFAULT_FITNESS_ZONES } from '../../../../../config/zone.config.js';
import type { PhaseAHazardPattern } from '../../../../../config/phase-a-hazard.config.js';

export const HAZARD_EVADE_PAGE_ID = 'hazard_evade';
export const HAZARD_PAGE_ID = 'hazard';

export const HAZARD_EVADE_BOUNDS_IDS = [
  'hazard_warning_banner',
  'hazard_warning',
  'hazard_action_guide',
  'hazard_safe_zone',
  'hazard_zone_rect',
  'zone_6',
  'zone_7',
  'zone_8',
  'zone_9',
  'zone_10',
  'zone_11',
  'hud_container',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_mana_gauge',
  'hud_combo',
  'bottom_bar',
] as const;

export const PROTECTED_HUD_ZONE = Object.freeze({
  x: 0,
  y: 0,
  width: ARTBOARD_WIDTH,
  height: 260,
});

export const PROTECTED_FLOOR_MOTION_ZONE = Object.freeze({
  x: 0,
  y: 1642,
  width: ARTBOARD_WIDTH,
  height: 518,
});

export interface HazardPageFixtureOptions extends Partial<DeterministicFixture> {
  pattern?: PhaseAHazardPattern;
  beatProgress?: number;
  status?: 'warning' | 'active' | 'safe' | 'hit';
  isResolved?: boolean;
  isEvaded?: boolean;
  warningText?: string;
  guideText?: string;
  hazard?: Partial<HazardFixtureDTO>;
  hazardContext?: HazardPresentationContext;
  feedback?: Partial<FeedbackFixtureDTO>;
  hud?: Partial<HUDData>;
  bottomBar?: Partial<BottomBarRenderOptions>;
  bottomBarOptions?: Partial<BottomBarRenderOptions>;
  selectedElementIds?: readonly string[];
  isStale?: boolean;
  revision?: number;
  vanishingPoint?: { x: number; y: number };
}

export const DEFAULT_HAZARD_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'jump',
  beatProgress: 0.6,
  status: 'warning',
  isResolved: false,
  isEvaded: false,
  warningText: '위험! 장판을 회피하세요!',
  hud: {
    playerHp: 100,
    playerMaxHp: 100,
    bossHp: 80,
    bossMaxHp: 100,
    combo: 3,
    chapter: 1,
  },
  bottomBar: {
    actionLabel: '위험 회피',
    mana: 50,
    manaMax: 100,
  },
});

export const JUMP_HAZARD_WARNING_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'jump',
  beatProgress: 0.6,
  status: 'warning',
  isResolved: false,
  isEvaded: false,
});

export const JUMP_HAZARD_ACTIVE_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'jump',
  beatProgress: 0.95,
  status: 'active',
  isResolved: false,
  isEvaded: false,
});

export const JUMP_HAZARD_SAFE_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'jump',
  beatProgress: 1.0,
  status: 'safe',
  isResolved: true,
  isEvaded: true,
});

export const JUMP_HAZARD_HIT_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'jump',
  beatProgress: 1.0,
  status: 'hit',
  isResolved: true,
  isEvaded: false,
});

export const LEFT_STEP_HAZARD_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'left_step',
  beatProgress: 0.75,
  status: 'active',
  isResolved: false,
  isEvaded: false,
});

export const RIGHT_STEP_HAZARD_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'right_step',
  beatProgress: 0.75,
  status: 'active',
  isResolved: false,
  isEvaded: false,
});

export const BALANCE_LEFT_HAZARD_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'balance_left',
  beatProgress: 0.85,
  status: 'active',
  isResolved: false,
  isEvaded: false,
});

export const BALANCE_RIGHT_HAZARD_PAGE_FIXTURE: HazardPageFixtureOptions = Object.freeze({
  pattern: 'balance_right',
  beatProgress: 0.85,
  status: 'active',
  isResolved: false,
  isEvaded: false,
});

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * hazard_evade 실제 렌더 페이지 어댑터 함수
 */
export function hazardPageAdapter(context: PageRenderContext): PageRenderResult {
  const pageId = context.pageId;

  // 1. 지원 페이지 ID 확인
  if (pageId !== HAZARD_EVADE_PAGE_ID && pageId !== HAZARD_PAGE_ID) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
    };
  }

  // 2. 캔버스 및 Context 유효성 검사
  if (!context || !context.canvas || context.canvas.width <= 0 || context.canvas.height <= 0) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'invalid-canvas',
      timestamp: Date.now(),
    };
  }

  const canvasCtx = context.ctx;
  if (!canvasCtx) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'invalid-canvas',
      timestamp: Date.now(),
    };
  }

  // 3. Stale Fixture 검사
  const raw = (context.snapshot ?? {}) as Record<string, any>;
  const fixtureObj = (context.fixture ?? {}) as HazardPageFixtureOptions;

  if (fixtureObj.isStale === true || (context.fixture as any)?.isStale === true) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-fixture',
      timestamp: Date.now(),
    };
  }

  // 4. Stale Revision 검사
  if (
    raw.revision !== undefined &&
    fixtureObj.revision !== undefined &&
    raw.revision < fixtureObj.revision
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-revision',
      timestamp: Date.now(),
    };
  }

  // 5. 보호 영역 침범 및 기하 변조 검사
  const hazardRendererForValidation = new HazardZoneRenderer();
  if (fixtureObj.hazardContext) {
    const validation = hazardRendererForValidation.validatePresentationContext(
      fixtureObj.hazardContext,
    );
    if (!validation.valid) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'protected-zone-violation',
        timestamp: Date.now(),
      };
    }
  }

  // fixture 레벨 보호 슬롯 변조 검사
  for (const protectedSlot of PROTECTED_HAZARD_ZONE_SLOT_IDS) {
    if (protectedSlot in fixtureObj) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'protected-zone-violation',
        timestamp: Date.now(),
      };
    }
  }

  let doc: UIPresentationDocument | undefined;
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  if (doc) {
    const pagesToCheck = [
      doc.pages[pageId as UIPresentationPageId],
      doc.pages[HAZARD_EVADE_PAGE_ID as UIPresentationPageId],
    ].filter(Boolean);

    for (const page of pagesToCheck) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el || !el.bounds) continue;
        const id = el.id ? String(el.id).toLowerCase() : '';
        const isHudElement = id.startsWith('hud_');

        const b = {
          x: el.bounds.x ?? 0,
          y: el.bounds.y ?? 0,
          width: el.bounds.width ?? (el.bounds as any).w ?? 0,
          height: el.bounds.height ?? (el.bounds as any).h ?? 0,
        };

        // 보호 HUD 영역 침범 검사
        if (!isHudElement && overlaps(b, PROTECTED_HUD_ZONE)) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }

        // 하단 보호 모션 존 침범 불법 버튼 추가 검사 (Zone 9~11 바닥)
        if (el.type === 'button' && overlaps(b, PROTECTED_FLOOR_MOTION_ZONE)) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }

        // 보호 슬롯 ID 침범 검사
        if (
          PROTECTED_HAZARD_ZONE_SLOT_IDS.includes(id as any) ||
          id.includes('hazard_geometry') ||
          id.includes('timing_ring_physics')
        ) {
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

  // 6. PresentationContext 조립
  let hazardContext: HazardPresentationContext = {};
  let feedbackContext: FeedbackPresentationContext = {};
  let hudContext: HUDPresentationContext = {};
  let bottomBarContext: BottomBarPresentationContext = {};

  if (doc) {
    hazardContext = HazardZoneRenderer.fromPresentationDocument(doc, pageId);
    feedbackContext = PhasePresentationAdapter.fromPresentationDocument(doc, pageId);
    hudContext = HUDLayer.fromPresentationDocument(doc, pageId);
    bottomBarContext = BottomBar.fromPresentationDocument(doc, pageId);
  }

  if (fixtureObj.hazardContext) {
    hazardContext = {
      ...hazardContext,
      ...fixtureObj.hazardContext,
      hazardWarning: {
        ...hazardContext.hazardWarning,
        ...fixtureObj.hazardContext.hazardWarning,
      },
      hazardStyle: {
        ...hazardContext.hazardStyle,
        ...fixtureObj.hazardContext.hazardStyle,
      },
      timingGuide: {
        ...hazardContext.timingGuide,
        ...fixtureObj.hazardContext.timingGuide,
      },
      safeZoneHighlight: {
        ...hazardContext.safeZoneHighlight,
        ...fixtureObj.hazardContext.safeZoneHighlight,
      },
    };
  }

  if (fixtureObj.warningText) {
    hazardContext.hazardWarning = {
      ...hazardContext.hazardWarning,
      text: fixtureObj.warningText,
    };
  }

  if (fixtureObj.guideText) {
    hazardContext.timingGuide = {
      ...hazardContext.timingGuide,
      text: fixtureObj.guideText,
    };
  }

  // 7. 상태 및 DTO Fixture 준비
  const pattern: PhaseAHazardPattern = fixtureObj.pattern ?? 'jump';
  const beatProgress: number = fixtureObj.beatProgress ?? 0.6;
  const status = fixtureObj.status ?? 'warning';
  const isResolved =
    fixtureObj.isResolved ?? (status === 'safe' || status === 'hit');
  const isEvaded =
    fixtureObj.isEvaded ?? (status === 'safe');
  const vanishingPoint =
    fixtureObj.vanishingPoint ?? { x: ARTBOARD_WIDTH / 2, y: ARTBOARD_HEIGHT * 0.24 };

  const hazardFixture: HazardFixtureDTO = {
    pattern,
    beatProgress,
    status,
    isResolved,
    isEvaded,
    vanishingPoint,
    presentationContext: hazardContext,
    ...(fixtureObj.hazard ?? {}),
  };

  const hazardEvadeState: HazardEvadePresentationState = {
    activePattern: pattern,
    beatProgress,
    vanishingX: vanishingPoint.x,
    vanishingY: vanishingPoint.y,
    isResolved,
    isEvaded,
  };

  const customHud = (fixtureObj.hud ?? raw.hud ?? {}) as Partial<HUDData>;
  const hudData: HUDData = {
    playerHp: customHud.playerHp ?? 100,
    playerMaxHp: customHud.playerMaxHp ?? 100,
    bossHp: customHud.bossHp ?? 80,
    bossMaxHp: customHud.bossMaxHp ?? 100,
    combo: customHud.combo ?? 3,
    chapter: customHud.chapter ?? 1,
    guardianStage: customHud.guardianStage ?? 1,
  };

  const customBottomBar = (fixtureObj.bottomBar ??
    fixtureObj.bottomBarOptions ??
    raw.bottomBarOptions ??
    {}) as Partial<BottomBarRenderOptions>;
  const bottomBarOptions: BottomBarRenderOptions = {
    pageId,
    actionLabel: customBottomBar.actionLabel ?? '위험 회피',
    mana: customBottomBar.mana ?? 50,
    manaMax: customBottomBar.manaMax ?? 100,
    ...customBottomBar,
  };

  // 8. 실제 렌더러 파이프라인 호출
  // 8.1 캔버스 초기화
  canvasCtx.clearRect(0, 0, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.2 DreamGrid (3D 원근 와이어프레임 배경)
  const dreamGrid = new DreamGrid();
  dreamGrid.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.3 HazardZoneRenderer (3D 바닥 장판 및 타이밍 링)
  const hazardZoneRenderer = new HazardZoneRenderer(undefined, hazardContext);
  hazardZoneRenderer.renderFixture(
    canvasCtx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    hazardFixture,
  );

  // 8.4 PhasePresentationAdapter & JudgmentFeedback (경고 배너 및 회피 피드백)
  const judgmentFeedback = new JudgmentFeedback(undefined, undefined, feedbackContext);
  if (fixtureObj.feedback) {
    judgmentFeedback.renderFixture(
      canvasCtx,
      ARTBOARD_WIDTH,
      ARTBOARD_HEIGHT,
      fixtureObj.feedback as FeedbackFixtureDTO,
    );
  }

  const phasePresentationAdapter = new PhasePresentationAdapter(
    hazardZoneRenderer,
    judgmentFeedback,
    hazardContext,
  );
  phasePresentationAdapter.renderHazardEvade(
    canvasCtx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    hazardEvadeState,
    hazardContext,
  );

  // 8.5 HUDLayer
  const hudLayer = new HUDLayer();
  if (hudContext) {
    hudLayer.setPresentationContext(hudContext);
  }
  hudLayer.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8.6 BottomBar
  const bottomBar = new BottomBar();
  if (bottomBarContext) {
    bottomBar.setPresentationContext(bottomBarContext);
  }
  bottomBar.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. Stable Rendered Bounds 수집
  const cx = ARTBOARD_WIDTH / 2;
  const cy = ARTBOARD_HEIGHT * 0.18;
  const scaleX = ARTBOARD_WIDTH / 1080;
  const scaleY = ARTBOARD_HEIGHT / 1920;
  const bw = Math.min(ARTBOARD_WIDTH * 0.88, 700 * scaleX);
  const bh = 110 * scaleY;

  const safeZ = hazardZoneRenderer.getSafeZoneBounds(
    pattern,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    vanishingPoint,
  );
  const hazardZ = hazardZoneRenderer.getHazardZoneBounds(
    pattern,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    vanishingPoint,
  );

  const z6 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 6)!;
  const z7 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 7)!;
  const z8 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 8)!;
  const z9 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 9)!;
  const z10 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 10)!;
  const z11 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 11)!;

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const manaBarBounds = bottomBar.getManaBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'hazard_warning_banner',
      x: cx - bw / 2,
      y: cy - bh / 2,
      width: bw,
      height: bh,
      isProtected: false,
    },
    {
      id: 'hazard_warning',
      x: cx - bw / 2,
      y: cy - bh / 2,
      width: bw,
      height: bh,
      isProtected: false,
    },
    {
      id: 'hazard_action_guide',
      x: cx - bw / 2,
      y: cy - bh / 2 + 10,
      width: bw,
      height: bh - 20,
      isProtected: false,
    },
    {
      id: 'hazard_safe_zone',
      x: safeZ.x,
      y: safeZ.y,
      width: safeZ.width,
      height: safeZ.height,
      isProtected: true,
    },
    {
      id: 'hazard_zone_rect',
      x: hazardZ.x,
      y: hazardZ.y,
      width: hazardZ.width,
      height: hazardZ.height,
      isProtected: true,
    },
    {
      id: 'zone_6',
      x: Math.round(z6.x * ARTBOARD_WIDTH),
      y: Math.round(z6.y * ARTBOARD_HEIGHT),
      width: Math.round(z6.width * ARTBOARD_WIDTH),
      height: Math.round(z6.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'zone_7',
      x: Math.round(z7.x * ARTBOARD_WIDTH),
      y: Math.round(z7.y * ARTBOARD_HEIGHT),
      width: Math.round(z7.width * ARTBOARD_WIDTH),
      height: Math.round(z7.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'zone_8',
      x: Math.round(z8.x * ARTBOARD_WIDTH),
      y: Math.round(z8.y * ARTBOARD_HEIGHT),
      width: Math.round(z8.width * ARTBOARD_WIDTH),
      height: Math.round(z8.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'zone_9',
      x: Math.round(z9.x * ARTBOARD_WIDTH),
      y: Math.round(z9.y * ARTBOARD_HEIGHT),
      width: Math.round(z9.width * ARTBOARD_WIDTH),
      height: Math.round(z9.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'zone_10',
      x: Math.round(z10.x * ARTBOARD_WIDTH),
      y: Math.round(z10.y * ARTBOARD_HEIGHT),
      width: Math.round(z10.width * ARTBOARD_WIDTH),
      height: Math.round(z10.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'zone_11',
      x: Math.round(z11.x * ARTBOARD_WIDTH),
      y: Math.round(z11.y * ARTBOARD_HEIGHT),
      width: Math.round(z11.width * ARTBOARD_WIDTH),
      height: Math.round(z11.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'hud_container',
      x: 0,
      y: 0,
      width: ARTBOARD_WIDTH,
      height: 260,
      isProtected: false,
    },
    {
      id: 'hud_player_hp',
      x: playerHpBounds.x,
      y: playerHpBounds.y,
      width: playerHpBounds.w,
      height: playerHpBounds.h,
      isProtected: false,
    },
    {
      id: 'hud_boss_hp',
      x: bossHpBounds.x,
      y: bossHpBounds.y,
      width: bossHpBounds.w,
      height: bossHpBounds.h,
      isProtected: false,
    },
    {
      id: 'hud_mana_gauge',
      x: manaBarBounds.x,
      y: manaBarBounds.y,
      width: manaBarBounds.w,
      height: manaBarBounds.h,
      isProtected: false,
    },
    {
      id: 'hud_combo',
      x: comboBounds.x,
      y: comboBounds.y,
      width: comboBounds.w,
      height: comboBounds.h,
      isProtected: false,
    },
    {
      id: 'bottom_bar',
      x: bottomBarBounds.x,
      y: bottomBarBounds.y,
      width: bottomBarBounds.w,
      height: bottomBarBounds.h,
      isProtected: false,
    },
  ];

  return {
    ok: true,
    drew: true,
    pageId,
    renderedBounds,
    timestamp: Date.now(),
  };
}

/**
 * hazard_evade 어댑터 등록 함수
 */
export function registerHazardPageAdapter(
  registry: PageAdapterRegistry = defaultPageAdapterRegistry,
): void {
  registry.register(HAZARD_EVADE_PAGE_ID, hazardPageAdapter);
  registry.register(HAZARD_PAGE_ID, hazardPageAdapter);
}
