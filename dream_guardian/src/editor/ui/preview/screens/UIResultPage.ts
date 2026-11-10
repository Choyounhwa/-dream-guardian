/**
 * UIResultPage.ts - 결과 실제 렌더 페이지 어댑터 (Issue #459 / UI-VIS-029)
 *
 * 개발 규칙 및 명세 준수:
 * 1. ResultRenderer(UI-VIS-013)의 공용 실제 draw 로직(render, renderFixture) 재사용
 * 2. 0-runtime 부팅 격리: GameEngine, AppBootstrap, SceneDirector, 배틀 시스템, Web Audio/TTS, 카메라/포즈 부팅 0건 보장
 * 3. 스토리지 격리: 표시값을 로컬스토리지에 저장하거나 통계/업적 서비스 갱신 0건 (세이브 0건)
 * 4. 결정론적 Fixture 주입 (승리/패배 상태, 등급 뱃지 S/A/B/C, 8개 통계 항목, 챕터별 fixture)
 * 5. UIPresentationDocument 연동: fromPresentationDocument를 통한 커스텀 텍스트/스타일/위치 반영
 * 6. 공통 HUD(HUDLayer) 및 하단바(BottomBar), DreamGrid 3D 정적 합성
 * 7. Stable ID(result_card, result_title, grade_badge, stats_grid, btn_restart, btn_menu, HUD, BottomBar 등)를 포함한 renderedBounds 반환
 * 8. Stale fixture, stale revision, 비정상 캔버스, 보호 영역(상단 HUD 존 및 불법 저장 조작) 침범 엄격한 가드 처리
 */

import { DreamGrid } from '../../../../render/DreamGrid.js';
import {
  ResultRenderer,
  type ResultData,
  type ResultPresentationContext,
  type RankGrade,
} from '../../../../ui/ResultRenderer.js';
import type { LocomotionMode } from '../../../../motion/LocomotionDetector.js';
import type { BeatRhythmStats } from '../../../../types/result.js';
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
import { defaultPageAdapterRegistry } from '../UIPageAdapters.js';
export const ARTBOARD_WIDTH = 1080;
export const ARTBOARD_HEIGHT = 2160;

export const RESULT_PAGE_ID = 'result';
export const STAGE_RESULT_PAGE_ID = 'stage_result';

export const RESULT_PAGE_BOUNDS_IDS = [
  'result_card',
  'result_title',
  'grade_badge',
  'stats_grid',
  'btn_restart',
  'btn_menu',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'bottom_bar',
  'bottom_bar_settings',
  'bottom_bar_action',
] as const;

const PROTECTED_HUD_ZONE = Object.freeze({
  x: 0,
  y: 0,
  width: ARTBOARD_WIDTH,
  height: 180,
});

const ILLEGAL_MUTATION_KEYS = Object.freeze([
  'saveRecord',
  'commitStats',
  'syncAchievements',
  'save_record',
  'database_commit',
  'auth_token',
  'commitProgress',
  'record_write',
  'achievement_sync',
]);

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export interface ResultPageFixtureOptions extends Partial<DeterministicFixture> {
  isStale?: boolean;
  revision?: number;
  victory?: boolean;
  chapter?: number;
  bossName?: string;
  correctCount?: number;
  totalQuestions?: number;
  maxCombo?: number;
  steps?: number;
  squats?: number;
  jumps?: number;
  elapsedTime?: number;
  dwellTime?: number;
  calories?: number;
  stars?: number;
  rank?: RankGrade;
  locomotionMode?: LocomotionMode;
  rhythmStats?: BeatRhythmStats;
  animTime?: number;

  resultData?: Partial<ResultData>;
  resultContext?: ResultPresentationContext;
  presentationContext?: ResultPresentationContext;

  hud?: Partial<HUDData>;
  hudData?: Partial<HUDData>;
  hudContext?: HUDPresentationContext;

  bottomBar?: Partial<BottomBarRenderOptions>;
  bottomBarOptions?: Partial<BottomBarRenderOptions>;
  bottomBarContext?: BottomBarPresentationContext;

  selectedElementIds?: readonly string[];

  // 보안 가드용 금지 필드
  saveRecord?: boolean;
  syncAchievements?: boolean;
  commitProgress?: boolean;
}

export const DEFAULT_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  victory: true,
  chapter: 1,
  bossName: '포겟(하얘시니)',
  correctCount: 8,
  totalQuestions: 10,
  maxCombo: 8,
  steps: 120,
  squats: 6,
  jumps: 4,
  elapsedTime: 65,
  dwellTime: 12,
  calories: 18.5,
  stars: 3,
  rank: 'S' as RankGrade,
  hud: {
    chapter: 1,
    bossHp: 0,
    bossMaxHp: 10,
    bossName: '포겟(하얘시니)',
    playerHp: 100,
    playerMaxHp: 100,
    combo: 8,
    guardianStage: 1,
  },
  bottomBar: {
    pageId: 'result',
    mana: 100,
    manaMax: 100,
    actionLabel: '결과 확인',
    isActionDisabled: false,
  },
});

export const VICTORY_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  victory: true,
  rank: 'S' as RankGrade,
  stars: 3,
});

export const DEFEAT_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  victory: false,
  correctCount: 2,
  totalQuestions: 10,
  maxCombo: 1,
  steps: 40,
  squats: 1,
  jumps: 0,
  elapsedTime: 45,
  dwellTime: 2,
  calories: 4.2,
  stars: 1,
  rank: 'C' as RankGrade,
  hud: {
    ...DEFAULT_RESULT_PAGE_FIXTURE.hud,
    bossHp: 8,
    playerHp: 0,
    combo: 0,
  },
});

export const CH1_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  chapter: 1,
  bossName: '포겟(하얘시니)',
});

export const CH2_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  chapter: 2,
  bossName: '후다닥(번개돌이)',
  hud: {
    ...DEFAULT_RESULT_PAGE_FIXTURE.hud,
    chapter: 2,
    bossName: '후다닥(번개돌이)',
  },
});

export const CH3_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  chapter: 3,
  bossName: '뒤죽박죽(퍼즐킹)',
  hud: {
    ...DEFAULT_RESULT_PAGE_FIXTURE.hud,
    chapter: 3,
    bossName: '뒤죽박죽(퍼즐킹)',
  },
});

export const CH4_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  chapter: 4,
  bossName: '에라(소용돌이)',
  hud: {
    ...DEFAULT_RESULT_PAGE_FIXTURE.hud,
    chapter: 4,
    bossName: '에라(소용돌이)',
  },
});

export const CH5_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  chapter: 5,
  bossName: '나이트메어(캄캄대왕)',
  hud: {
    ...DEFAULT_RESULT_PAGE_FIXTURE.hud,
    chapter: 5,
    bossName: '나이트메어(캄캄대왕)',
  },
});

export const S_RANK_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  rank: 'S' as RankGrade,
  stars: 3,
  correctCount: 10,
  totalQuestions: 10,
  victory: true,
});

export const A_RANK_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  rank: 'A' as RankGrade,
  stars: 2,
  correctCount: 8,
  totalQuestions: 10,
  victory: true,
});

export const B_RANK_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  rank: 'B' as RankGrade,
  stars: 1,
  correctCount: 6,
  totalQuestions: 10,
  victory: true,
});

export const C_RANK_RESULT_PAGE_FIXTURE: ResultPageFixtureOptions = Object.freeze({
  ...DEFAULT_RESULT_PAGE_FIXTURE,
  rank: 'C' as RankGrade,
  stars: 1,
  correctCount: 4,
  totalQuestions: 10,
  victory: false,
});

/**
 * Result 실제 렌더 페이지 어댑터 함수
 */
export function resultPageAdapter(context: PageRenderContext): PageRenderResult {
  const { canvas, pageId, snapshot, fixture } = context;

  // 1. 지원 페이지 ID 검증
  if (pageId !== RESULT_PAGE_ID && pageId !== STAGE_RESULT_PAGE_ID) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
    };
  }

  // 2. 캔버스 상태 유효성 검증
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'invalid-canvas',
      timestamp: Date.now(),
    };
  }

  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'context-unavailable',
      timestamp: Date.now(),
    };
  }

  const fixtureObj = (fixture ?? {}) as ResultPageFixtureOptions;
  const snapshotObj = (snapshot ?? {}) as { revision?: number };

  // 3. Stale Fixture 검증
  if (fixtureObj.isStale === true) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-fixture',
      timestamp: Date.now(),
    };
  }

  // 4. Stale Revision 검증
  if (
    fixtureObj.revision !== undefined &&
    snapshotObj.revision !== undefined &&
    snapshotObj.revision < fixtureObj.revision
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-revision',
      timestamp: Date.now(),
    };
  }

  // 5. 보안 및 데이터 무결성 검사 (로컬스토리지/DB 커밋 등 불법 변조 시도 차단)
  for (const illegalKey of ILLEGAL_MUTATION_KEYS) {
    if ((fixtureObj as any)[illegalKey]) {
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
  if (snapshot && typeof snapshot === 'object' && 'pages' in snapshot) {
    doc = snapshot as UIPresentationDocument;
  }

  if (doc) {
    const pagesToCheck = [
      doc.pages[RESULT_PAGE_ID as UIPresentationPageId],
      doc.pages[STAGE_RESULT_PAGE_ID as UIPresentationPageId],
    ].filter(Boolean);

    for (const page of pagesToCheck) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el || !el.bounds) continue;
        const id = el.id ? String(el.id).toLowerCase() : '';
        const actionId = el.actionId ? String(el.actionId).toLowerCase() : '';

        // 불법 변조 슬롯 ID 검사
        for (const illegalKey of ILLEGAL_MUTATION_KEYS) {
          if (id.includes(illegalKey.toLowerCase()) || actionId.includes(illegalKey.toLowerCase())) {
            return {
              ok: false,
              drew: false,
              pageId,
              reason: 'protected-zone-violation',
              timestamp: Date.now(),
            };
          }
        }

        const b = {
          x: el.bounds.x ?? 0,
          y: el.bounds.y ?? 0,
          width: el.bounds.width ?? (el.bounds as any).w ?? 0,
          height: el.bounds.height ?? (el.bounds as any).h ?? 0,
        };

        const isHudElement = id.startsWith('hud_');
        // 상단 보호 HUD 영역 침범 검사
        if (!isHudElement && overlaps(b, PROTECTED_HUD_ZONE)) {
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

  // 6. PresentationContext 조립 (UIPresentationDocument 및 오버라이드)
  let resultContext: ResultPresentationContext = {};
  let hudContext: HUDPresentationContext = {};
  let bottomBarContext: BottomBarPresentationContext = {};

  if (doc) {
    resultContext = ResultRenderer.fromPresentationDocument(doc, pageId);
    hudContext = HUDLayer.fromPresentationDocument(doc, pageId);
    bottomBarContext = BottomBar.fromPresentationDocument(doc, pageId);
  }

  if (fixtureObj.resultContext) {
    resultContext = { ...resultContext, ...fixtureObj.resultContext };
  }
  if (fixtureObj.presentationContext) {
    resultContext = { ...resultContext, ...fixtureObj.presentationContext };
  }
  if (fixtureObj.hudContext) {
    hudContext = { ...hudContext, ...fixtureObj.hudContext };
  }
  if (fixtureObj.bottomBarContext) {
    bottomBarContext = { ...bottomBarContext, ...fixtureObj.bottomBarContext };
  }

  // 7. 실측 렌더링 데이터 구성
  const rawData = fixtureObj.resultData ?? {};
  const effectiveResultData: ResultData = {
    victory: fixtureObj.victory ?? rawData.victory ?? DEFAULT_RESULT_PAGE_FIXTURE.victory!,
    chapter: fixtureObj.chapter ?? rawData.chapter ?? DEFAULT_RESULT_PAGE_FIXTURE.chapter!,
    correctCount: fixtureObj.correctCount ?? rawData.correctCount ?? DEFAULT_RESULT_PAGE_FIXTURE.correctCount!,
    totalQuestions: fixtureObj.totalQuestions ?? rawData.totalQuestions ?? DEFAULT_RESULT_PAGE_FIXTURE.totalQuestions!,
    maxCombo: fixtureObj.maxCombo ?? rawData.maxCombo ?? DEFAULT_RESULT_PAGE_FIXTURE.maxCombo!,
    steps: fixtureObj.steps ?? rawData.steps ?? DEFAULT_RESULT_PAGE_FIXTURE.steps!,
    squats: fixtureObj.squats ?? rawData.squats ?? DEFAULT_RESULT_PAGE_FIXTURE.squats!,
    jumps: fixtureObj.jumps ?? rawData.jumps ?? DEFAULT_RESULT_PAGE_FIXTURE.jumps!,
    elapsedTime: fixtureObj.elapsedTime ?? rawData.elapsedTime ?? DEFAULT_RESULT_PAGE_FIXTURE.elapsedTime!,
    dwellTime: fixtureObj.dwellTime ?? rawData.dwellTime ?? DEFAULT_RESULT_PAGE_FIXTURE.dwellTime!,
    calories: fixtureObj.calories ?? rawData.calories ?? DEFAULT_RESULT_PAGE_FIXTURE.calories,
    stars: fixtureObj.stars ?? rawData.stars ?? DEFAULT_RESULT_PAGE_FIXTURE.stars,
    rank: fixtureObj.rank ?? rawData.rank ?? DEFAULT_RESULT_PAGE_FIXTURE.rank,
    locomotionMode: fixtureObj.locomotionMode ?? rawData.locomotionMode,
    rhythmStats: fixtureObj.rhythmStats ?? rawData.rhythmStats,
  };

  const hudData: HUDData = {
    playerHp: fixtureObj.hud?.playerHp ?? (effectiveResultData.victory ? 100 : 0),
    playerMaxHp: fixtureObj.hud?.playerMaxHp ?? 100,
    bossHp: fixtureObj.hud?.bossHp ?? (effectiveResultData.victory ? 0 : 8),
    bossMaxHp: fixtureObj.hud?.bossMaxHp ?? 10,
    chapter: effectiveResultData.chapter,
    combo: fixtureObj.hud?.combo ?? effectiveResultData.maxCombo,
    guardianStage: fixtureObj.hud?.guardianStage ?? 1,
    ...fixtureObj.hud,
    ...fixtureObj.hudData,
  };

  const bottomBarOptions: BottomBarRenderOptions = {
    pageId,
    mana: fixtureObj.bottomBar?.mana ?? 100,
    manaMax: fixtureObj.bottomBar?.manaMax ?? 100,
    actionLabel: fixtureObj.bottomBar?.actionLabel ?? '결과 확인',
    ...fixtureObj.bottomBar,
    ...fixtureObj.bottomBarOptions,
  };

  // 8. 실제 렌더러 파이프라인 호출
  canvasCtx.clearRect(0, 0, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.1 DreamGrid (3D 원근 와이어프레임 배경 정적 합성)
  const dreamGrid = new DreamGrid();
  dreamGrid.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.2 ResultRenderer 실제 렌더러 호출 (결과 카드, 타이틀, 별점, 통계 8개 항목 등)
  const resultRenderer = new ResultRenderer(resultContext);
  if (fixtureObj.animTime !== undefined) {
    resultRenderer.resetAnimation(fixtureObj.animTime);
  }
  resultRenderer.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, effectiveResultData);

  // 8.3 재도전 및 메인 메뉴 버튼 렌더링
  let btnRestartLayout = {
    x: 140,
    y: 1700,
    width: 380,
    height: 110,
    text: '🔄 다시 도전',
  };
  let btnMenuLayout = {
    x: 560,
    y: 1700,
    width: 380,
    height: 110,
    text: '🏠 메인 메뉴',
  };

  if (doc) {
    const pageObj = doc.pages[pageId as UIPresentationPageId] ?? doc.pages[RESULT_PAGE_ID as UIPresentationPageId];
    if (pageObj?.elements) {
      for (const el of pageObj.elements) {
        if (!el || !el.bounds) continue;
        const id = el.id ? String(el.id).toLowerCase() : '';
        const actionId = el.actionId ? String(el.actionId).toLowerCase() : '';

        if (
          id === 'btn_restart' ||
          id === 'btn_res_retry' ||
          id === 'btn_retry' ||
          actionId === 'result_retry'
        ) {
          btnRestartLayout = {
            x: el.bounds.x,
            y: el.bounds.y,
            width: el.bounds.width,
            height: el.bounds.height,
            text: el.text ?? '다시 도전',
          };
        } else if (
          id === 'btn_menu' ||
          id === 'btn_res_menu' ||
          actionId === 'result_menu'
        ) {
          btnMenuLayout = {
            x: el.bounds.x,
            y: el.bounds.y,
            width: el.bounds.width,
            height: el.bounds.height,
            text: el.text ?? '메인 메뉴',
          };
        }
      }
    }
  }

  // 버튼 드로잉 (네온 아웃라인 & 텍스트)
  canvasCtx.save();
  // 1) 재도전 버튼
  canvasCtx.fillStyle = 'rgba(20, 30, 55, 0.9)';
  canvasCtx.strokeStyle = '#28E6FF';
  canvasCtx.lineWidth = 3;
  canvasCtx.beginPath();
  if (canvasCtx.roundRect) {
    canvasCtx.roundRect(btnRestartLayout.x, btnRestartLayout.y, btnRestartLayout.width, btnRestartLayout.height, 16);
  } else {
    canvasCtx.rect(btnRestartLayout.x, btnRestartLayout.y, btnRestartLayout.width, btnRestartLayout.height);
  }
  canvasCtx.fill();
  canvasCtx.stroke();

  canvasCtx.fillStyle = '#FFFFFF';
  canvasCtx.font = 'bold 36px sans-serif';
  canvasCtx.textAlign = 'center';
  canvasCtx.textBaseline = 'middle';
  canvasCtx.fillText(
    btnRestartLayout.text,
    btnRestartLayout.x + btnRestartLayout.width / 2,
    btnRestartLayout.y + btnRestartLayout.height / 2,
  );

  // 2) 메인 메뉴 버튼
  canvasCtx.fillStyle = 'rgba(30, 20, 45, 0.9)';
  canvasCtx.strokeStyle = '#FFCB4D';
  canvasCtx.lineWidth = 3;
  canvasCtx.beginPath();
  if (canvasCtx.roundRect) {
    canvasCtx.roundRect(btnMenuLayout.x, btnMenuLayout.y, btnMenuLayout.width, btnMenuLayout.height, 16);
  } else {
    canvasCtx.rect(btnMenuLayout.x, btnMenuLayout.y, btnMenuLayout.width, btnMenuLayout.height);
  }
  canvasCtx.fill();
  canvasCtx.stroke();

  canvasCtx.fillStyle = '#FFFFFF';
  canvasCtx.fillText(
    btnMenuLayout.text,
    btnMenuLayout.x + btnMenuLayout.width / 2,
    btnMenuLayout.y + btnMenuLayout.height / 2,
  );
  canvasCtx.restore();

  // 8.4 HUDLayer (상단 공통 HUD 정적 합성)
  const hudLayer = new HUDLayer();
  if (hudContext) {
    hudLayer.setPresentationContext(hudContext);
  }
  hudLayer.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8.5 BottomBar (하단 네비게이션 및 마나 바 정적 합성)
  const bottomBar = new BottomBar();
  if (bottomBarContext) {
    bottomBar.setPresentationContext(bottomBarContext);
  }
  bottomBar.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. Rendered Bounds 계산
  const panelBounds = resultRenderer.getPanelBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, resultContext);
  const titleBounds = resultRenderer.getTitleBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, resultContext);
  const gradeBounds = resultRenderer.getGradeBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, resultContext);
  const rankBounds = resultRenderer.getRankStampBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, resultContext);
  const statsBounds = resultRenderer.getStatsBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, resultContext);
  const chapterBounds = resultRenderer.getChapterTitleBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT, resultContext);

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossNameBounds = hudLayer.getBossNameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const settingsBtnBounds = bottomBar.getSettingsButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const actionBtnBounds = bottomBar.getActionButtonBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'result_card',
      x: panelBounds.x,
      y: panelBounds.y,
      width: panelBounds.w,
      height: panelBounds.h,
      isProtected: false,
    },
    {
      id: 'result_title',
      x: titleBounds.x,
      y: titleBounds.y,
      width: titleBounds.w,
      height: titleBounds.h,
      isProtected: false,
    },
    {
      id: 'grade_badge',
      x: gradeBounds.x,
      y: gradeBounds.y,
      width: gradeBounds.w,
      height: gradeBounds.h,
      isProtected: false,
    },
    {
      id: 'stats_grid',
      x: statsBounds.x,
      y: statsBounds.y,
      width: statsBounds.w,
      height: statsBounds.h,
      isProtected: false,
    },
    {
      id: 'btn_restart',
      x: btnRestartLayout.x,
      y: btnRestartLayout.y,
      width: btnRestartLayout.width,
      height: btnRestartLayout.height,
      isProtected: false,
    },
    {
      id: 'btn_menu',
      x: btnMenuLayout.x,
      y: btnMenuLayout.y,
      width: btnMenuLayout.width,
      height: btnMenuLayout.height,
      isProtected: false,
    },
    {
      id: 'hud_player_hp',
      x: playerHpBounds.x,
      y: playerHpBounds.y,
      width: playerHpBounds.w,
      height: playerHpBounds.h,
      isProtected: true,
    },
    {
      id: 'hud_boss_hp',
      x: bossHpBounds.x,
      y: bossHpBounds.y,
      width: bossHpBounds.w,
      height: bossHpBounds.h,
      isProtected: true,
    },
    {
      id: 'hud_boss_name',
      x: bossNameBounds.x,
      y: bossNameBounds.y,
      width: bossNameBounds.w,
      height: bossNameBounds.h,
      isProtected: true,
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
    {
      id: 'bottom_bar_settings',
      x: settingsBtnBounds.x,
      y: settingsBtnBounds.y,
      width: settingsBtnBounds.w,
      height: settingsBtnBounds.h,
      isProtected: false,
    },
    {
      id: 'bottom_bar_action',
      x: actionBtnBounds.x,
      y: actionBtnBounds.y,
      width: actionBtnBounds.w,
      height: actionBtnBounds.h,
      isProtected: false,
    },
    {
      id: 'chapter_title',
      x: chapterBounds.x,
      y: chapterBounds.y,
      width: chapterBounds.w,
      height: chapterBounds.h,
      isProtected: false,
    },
    {
      id: 'rank_stamp',
      x: rankBounds.x,
      y: rankBounds.y,
      width: rankBounds.w,
      height: rankBounds.h,
      isProtected: false,
    },
  ];

  // 10. 선택 요소 하이라이트 표시 (selectedElementIds)
  const selectedIds = context.selectedElementIds ?? fixtureObj.selectedElementIds;
  if (selectedIds && selectedIds.length > 0) {
    const selectedSet = new Set(selectedIds);
    canvasCtx.save();
    canvasCtx.strokeStyle = '#28E6FF';
    canvasCtx.lineWidth = 3;
    if (canvasCtx.setLineDash) canvasCtx.setLineDash([8, 4]);

    for (const bound of renderedBounds) {
      if (selectedSet.has(bound.id)) {
        bound.isSelected = true;
        canvasCtx.strokeRect(bound.x, bound.y, bound.width, bound.height);
      } else {
        bound.isSelected = false;
      }
    }
    canvasCtx.restore();
  } else {
    for (const bound of renderedBounds) {
      bound.isSelected = false;
    }
  }

  return {
    ok: true,
    drew: true,
    pageId,
    renderedBounds,
    timestamp: Date.now(),
  };
}

/**
 * PageAdapterRegistry에 Result 페이지 어댑터 등록
 */
export function registerResultPageAdapter(
  registry: PageAdapterRegistry = defaultPageAdapterRegistry,
): void {
  registry.register(RESULT_PAGE_ID, resultPageAdapter);
  registry.register(STAGE_RESULT_PAGE_ID, resultPageAdapter);
}
