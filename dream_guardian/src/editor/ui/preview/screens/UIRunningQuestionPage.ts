/**
 * UIRunningQuestionPage.ts - 러닝·문제 실제 렌더 페이지 어댑터 (Issue #455 / UI-VIS-025)
 *
 * 개발 규칙 및 명세 준수:
 * 1. QuestionRenderer, BeatHUDRenderer, RunningMatRenderer 실제 렌더링 파이프라인 결합
 * 2. 0-runtime 부팅 격리: GameEngine, AppBootstrap, SceneDirector, LocomotionDetector, Web Audio/TTS, 카메라/포즈 부팅 0건 보장
 * 3. 결정론적 Fixture 주입 (DEFAULT_QUESTION_FIXTURE, DEFAULT_BEAT_HUD_FIXTURE, DEFAULT_RUNNING_MAT_FIXTURE 등)
 * 4. UIPresentationDocument 연동: fromPresentationDocument를 통한 텍스트/스타일/위치 커스텀 반영
 * 5. 공통 HUD(HUDLayer) 및 하단바(BottomBar) 정적 합성
 * 6. Stable ID(question_card, question_text, question_timer, choice_0, choice_1, running_mat, beat_hud_..., HUD, BottomBar)를 포함한 renderedBounds 반환
 * 7. 보호 영역(보호 HUD 존, 3레인 러닝 매트 바닥존, Zone 4/5 action geometry) 침범 가드
 * 8. Stale fixture, stale revision, 비정상 캔버스 엄격한 가드 처리
 */

import {
  QuestionRenderer,
  DEFAULT_QUESTION_FIXTURE,
  type QuestionFixtureDTO,
  type QuestionPresentationContext,
} from '../../../../render/QuestionRenderer.js';
import {
  BeatHUDRenderer,
  DEFAULT_BEAT_HUD_FIXTURE,
  type BeatHUDFixtureDTO,
  type BeatHUDPresentationContext,
} from '../../../../render/BeatHUDRenderer.js';
import {
  RunningMatRenderer,
  DEFAULT_RUNNING_MAT_FIXTURE,
  type RunningMatFixtureDTO,
  type RunningMatPresentationContext,
} from '../../../../render/RunningMatRenderer.js';
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
import type { UIPresentationDocument, UIPresentationPageId } from '../../../../data/UIPresentation.js';
import type { LocomotionMode } from '../../../../motion/LocomotionDetector.js';

export const ARTBOARD_WIDTH = 1080;
export const ARTBOARD_HEIGHT = 2160;

export const RUNNING_QUESTION_PAGE_ID = 'running_question';
export const RUN_QUESTION_PAGE_ID = 'run_question';

export const RUNNING_QUESTION_BOUNDS_IDS = [
  'question_card',
  'question_text',
  'choice_0',
  'choice_1',
  'question_timer',
  'running_mat',
  'running_mat_strike_line',
  'running_mat_left_lane',
  'running_mat_center_lane',
  'running_mat_right_lane',
  'beat_hud_badge',
  'beat_hud_dots',
  'beat_hud_step_counter',
  'hud_player_hp',
  'hud_boss_hp',
  'hud_boss_name',
  'hud_combo',
  'hud_stats',
  'bottom_bar',
  'bottom_bar_action',
  'bottom_bar_settings',
  'bottom_bar_mana',
] as const;

export type RunningQuestionBoundId = (typeof RUNNING_QUESTION_BOUNDS_IDS)[number];

const PROTECTED_HUD_ZONE = Object.freeze({
  x: 0,
  y: 0,
  width: 1080,
  height: 120,
});

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

export interface RunningQuestionFixtureDTO {
  isStale?: boolean;
  revision?: number;
  question?: Partial<QuestionFixtureDTO>;
  beatHud?: Partial<BeatHUDFixtureDTO>;
  runningMat?: Partial<RunningMatFixtureDTO>;
  hud?: Partial<HUDData>;
  hudData?: Partial<HUDData>;
  bottomBar?: Partial<BottomBarRenderOptions>;
  bottomBarOptions?: Partial<BottomBarRenderOptions>;
  questionContext?: QuestionPresentationContext;
  beatHudContext?: BeatHUDPresentationContext;
  runningMatContext?: RunningMatPresentationContext;
  hudContext?: HUDPresentationContext;
  bottomBarContext?: BottomBarPresentationContext;
  // 편의 평탄화 필드
  questionText?: string;
  choices?: [string, string];
  answer?: string;
  shapeCode?: string | null;
  locomotionMode?: LocomotionMode;
  totalSteps?: number;
  actionText?: string;
  cueText?: string;
  beatIndex?: number;
  beatProgress?: number;
  showBeatDots?: boolean;
  playerHp?: number;
  bossHp?: number;
  combo?: number;
  chapter?: number;
}

export const DEFAULT_RUNNING_QUESTION_FIXTURE: RunningQuestionFixtureDTO = Object.freeze({
  question: DEFAULT_QUESTION_FIXTURE,
  beatHud: DEFAULT_BEAT_HUD_FIXTURE,
  runningMat: DEFAULT_RUNNING_MAT_FIXTURE,
  hud: {
    playerHp: 100,
    playerMaxHp: 100,
    bossHp: 80,
    bossMaxHp: 100,
    combo: 3,
    chapter: 1,
    guardianStage: 1,
  },
  bottomBar: {
    pageId: RUNNING_QUESTION_PAGE_ID,
    actionLabel: '러닝 중',
    mana: 25,
    manaMax: 100,
  },
});

/**
 * 러닝·문제 실제 렌더 페이지 어댑터
 */
export const runningQuestionPageAdapter: PageAdapter = (
  ctx: PageRenderContext,
): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 페이지 ID 유효성 검사
  if (pageId !== RUNNING_QUESTION_PAGE_ID && pageId !== RUN_QUESTION_PAGE_ID) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
    };
  }

  // 2. 캔버스 유효성 검사
  if (!ctx.canvas || ctx.canvas.width <= 0 || ctx.canvas.height <= 0) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'invalid-canvas',
      timestamp: Date.now(),
    };
  }

  const fixtureObj = (fixture ?? {}) as Record<string, any>;
  const raw = (snapshot && typeof snapshot === 'object' ? snapshot : {}) as Record<string, any>;

  // 3. Stale fixture 검사
  if (fixtureObj.isStale) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-fixture',
      timestamp: Date.now(),
    };
  }

  // 4. Stale revision 검사
  const snapshotRev = raw.revision;
  const fixtureRev = fixtureObj.revision;
  if (
    typeof snapshotRev === 'number' &&
    typeof fixtureRev === 'number' &&
    snapshotRev < fixtureRev
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-revision',
      timestamp: Date.now(),
    };
  }

  // 5. UIPresentationDocument 추출 및 보호 영역 침범 검사
  let doc: UIPresentationDocument | undefined;
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  if (doc) {
    const pagesToCheck = [
      doc.pages[pageId as UIPresentationPageId],
      doc.pages[RUNNING_QUESTION_PAGE_ID as UIPresentationPageId],
      doc.pages[RUN_QUESTION_PAGE_ID as UIPresentationPageId],
    ].filter(Boolean);

    for (const page of pagesToCheck) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el || !el.bounds) continue;
        const id = el.id ? String(el.id).toLowerCase() : '';
        const isHudElement = id.startsWith('hud_') || id === 'run_header';
        const b = {
          x: el.bounds.x ?? 0,
          y: el.bounds.y ?? 0,
          width: el.bounds.width ?? (el.bounds as any).w ?? 0,
          height: el.bounds.height ?? (el.bounds as any).h ?? 0,
        };

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

  // 6. 각 레이어별 PresentationContext 조립
  let questionContext: QuestionPresentationContext = {};
  let beatHudContext: BeatHUDPresentationContext = {};
  let runningMatContext: RunningMatPresentationContext = {};
  let hudContext: HUDPresentationContext = {};
  let bottomBarContext: BottomBarPresentationContext = {};

  if (doc) {
    questionContext = QuestionRenderer.fromPresentationDocument(doc, pageId);
    beatHudContext = BeatHUDRenderer.fromPresentationDocument(doc, pageId);
    runningMatContext = RunningMatRenderer.fromPresentationDocument(doc, pageId);
    hudContext = HUDLayer.fromPresentationDocument(doc, pageId);
    bottomBarContext = BottomBar.fromPresentationDocument(doc, pageId);
  }

  // snapshot 또는 fixture에 명시된 PresentationContext 병합
  if (raw.questionContext || fixtureObj.questionContext) {
    questionContext = {
      ...questionContext,
      ...raw.questionContext,
      ...fixtureObj.questionContext,
    };
  }
  if (raw.beatHudContext || fixtureObj.beatHudContext) {
    beatHudContext = {
      ...beatHudContext,
      ...raw.beatHudContext,
      ...fixtureObj.beatHudContext,
    };
  }
  if (raw.runningMatContext || fixtureObj.runningMatContext) {
    runningMatContext = {
      ...runningMatContext,
      ...raw.runningMatContext,
      ...fixtureObj.runningMatContext,
    };
  }
  if (raw.hudContext || fixtureObj.hudContext) {
    hudContext = { ...hudContext, ...raw.hudContext, ...fixtureObj.hudContext };
  }
  if (raw.bottomBarContext || fixtureObj.bottomBarContext) {
    bottomBarContext = {
      ...bottomBarContext,
      ...raw.bottomBarContext,
      ...fixtureObj.bottomBarContext,
    };
  }

  // QuestionRenderer 답안 보호 지오메트리(Zone 4/5) 검증
  const questionRenderer = new QuestionRenderer(questionContext);
  const qValidation = questionRenderer.validatePresentationContext(questionContext);
  if (!qValidation.valid) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'protected-zone-violation',
      timestamp: Date.now(),
    };
  }

  const runningMatRenderer = new RunningMatRenderer();
  if (runningMatContext) {
    runningMatRenderer.setPresentationContext(runningMatContext);
  }
  const mValidation = runningMatRenderer.validatePresentationContext(runningMatContext);
  if (!mValidation.valid) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'protected-zone-violation',
      timestamp: Date.now(),
    };
  }

  // 7. 결정론적 Fixture 파라미터 조합
  const customQuestion = (fixtureObj.question ?? {}) as Partial<QuestionFixtureDTO>;
  const questionFixture: QuestionFixtureDTO = {
    ...DEFAULT_QUESTION_FIXTURE,
    ...customQuestion,
    ...(fixtureObj.questionText !== undefined
      ? { questionText: fixtureObj.questionText }
      : {}),
    ...(fixtureObj.choices !== undefined ? { choices: fixtureObj.choices } : {}),
    ...(fixtureObj.answer !== undefined ? { answer: fixtureObj.answer } : {}),
    ...(fixtureObj.shapeCode !== undefined
      ? { shapeCode: fixtureObj.shapeCode }
      : {}),
  };

  if (doc) {
    const targetPage =
      doc.pages[pageId as UIPresentationPageId] ??
      doc.pages[RUNNING_QUESTION_PAGE_ID as UIPresentationPageId];
    const banner = targetPage?.elements?.find(
      (e) => e.id === 'run_question_banner' || e.id === 'question_banner',
    );
    if (banner?.text && !customQuestion.questionText && !fixtureObj.questionText) {
      questionFixture.questionText = banner.text;
    }
  }

  const customBeatHud = (fixtureObj.beatHud ?? {}) as Partial<BeatHUDFixtureDTO>;
  const beatHudFixture: BeatHUDFixtureDTO = {
    ...DEFAULT_BEAT_HUD_FIXTURE,
    ...customBeatHud,
    ...(fixtureObj.locomotionMode !== undefined
      ? { locomotionMode: fixtureObj.locomotionMode }
      : {}),
    ...(fixtureObj.totalSteps !== undefined
      ? { totalSteps: fixtureObj.totalSteps }
      : {}),
    ...(fixtureObj.showBeatDots !== undefined
      ? { showBeatDots: fixtureObj.showBeatDots }
      : {}),
  };

  const customRunningMat = (fixtureObj.runningMat ?? {}) as Partial<RunningMatFixtureDTO>;
  const runningMatFixture: RunningMatFixtureDTO = {
    ...DEFAULT_RUNNING_MAT_FIXTURE,
    ...customRunningMat,
    ...(fixtureObj.actionText !== undefined
      ? { actionText: fixtureObj.actionText }
      : {}),
    ...(fixtureObj.cueText !== undefined ? { cueText: fixtureObj.cueText } : {}),
    ...(fixtureObj.beatIndex !== undefined
      ? { beatIndex: fixtureObj.beatIndex }
      : {}),
    ...(fixtureObj.beatProgress !== undefined
      ? { beatProgress: fixtureObj.beatProgress }
      : {}),
  };

  const customHud = (fixtureObj.hud ?? fixtureObj.hudData ?? raw.hudData ?? {}) as Partial<HUDData>;
  const hudData: HUDData = {
    playerHp: fixtureObj.playerHp ?? customHud.playerHp ?? 100,
    playerMaxHp: customHud.playerMaxHp ?? 100,
    bossHp: fixtureObj.bossHp ?? customHud.bossHp ?? 80,
    bossMaxHp: customHud.bossMaxHp ?? 100,
    combo: fixtureObj.combo ?? customHud.combo ?? 3,
    chapter: fixtureObj.chapter ?? customHud.chapter ?? 1,
    guardianStage: customHud.guardianStage ?? 1,
  };

  const customBottomBar = (fixtureObj.bottomBar ?? fixtureObj.bottomBarOptions ?? raw.bottomBarOptions ?? {}) as Partial<BottomBarRenderOptions>;
  const bottomBarOptions: BottomBarRenderOptions = {
    pageId,
    actionLabel: customBottomBar.actionLabel ?? '러닝 중',
    mana: customBottomBar.mana ?? 25,
    manaMax: customBottomBar.manaMax ?? 100,
    ...customBottomBar,
  };

  // 8. 실제 렌더러 파이프라인 호출
  // 8.1 Running Mat (바닥 원근 3레인)
  runningMatRenderer.renderFixture(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    runningMatFixture,
  );

  // 8.2 Beat HUD (운동 모드 및 8박 인디케이터)
  const beatHUDRenderer = new BeatHUDRenderer({
    showBeatDots: beatHudFixture.showBeatDots ?? true,
    presentationContext: beatHudContext,
  });
  beatHUDRenderer.renderFixture(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    beatHudFixture,
    beatHudContext,
  );

  // 8.3 Question Header and Choices
  questionRenderer.renderFixture(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    questionFixture,
    questionContext,
  );

  // 8.4 In-game HUDLayer
  const hudLayer = new HUDLayer();
  if (hudContext) {
    hudLayer.setPresentationContext(hudContext);
  }
  hudLayer.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8.5 Bottom Bar
  const bottomBar = new BottomBar();
  if (bottomBarContext) {
    bottomBar.setPresentationContext(bottomBarContext);
  }
  bottomBar.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. Bounds 산출
  const qHeaderBounds = questionRenderer.getHeaderBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    {
      hasShape: Boolean(questionFixture.shapeCode),
    },
  );
  const choice0Bounds = questionRenderer.getChoiceButtonBounds(
    0,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const choice1Bounds = questionRenderer.getChoiceButtonBounds(
    1,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );

  const badgeBounds = beatHUDRenderer.getExerciseBadgeBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const dotsBounds = beatHUDRenderer.getBeatDotsBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const stepBounds = beatHUDRenderer.getStepCounterBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );

  const matBounds = runningMatRenderer.getRunningMatBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const strikeLineBounds = runningMatRenderer.getStrikeLineBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const leftLaneBounds = runningMatRenderer.getLaneAnchorBounds(
    'left',
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const centerLaneBounds = runningMatRenderer.getLaneAnchorBounds(
    'center',
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const rightLaneBounds = runningMatRenderer.getLaneAnchorBounds(
    'right',
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const bossHpBounds = hudLayer.getBossHpBarBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const bossNameBounds = hudLayer.getBossNameBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const settingsBtnBounds = bottomBar.getSettingsButtonBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    pageId,
  );
  const actionBtnBounds = bottomBar.getActionButtonBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    pageId,
  );
  const manaBarBounds = bottomBar.getManaBarBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'question_card',
      x: qHeaderBounds.x,
      y: qHeaderBounds.y,
      width: qHeaderBounds.w,
      height: qHeaderBounds.h,
    },
    {
      id: 'question_text',
      x: qHeaderBounds.x,
      y: qHeaderBounds.y,
      width: qHeaderBounds.w,
      height: qHeaderBounds.h,
    },
    {
      id: 'choice_0',
      x: choice0Bounds.x,
      y: choice0Bounds.y,
      width: choice0Bounds.w,
      height: choice0Bounds.h,
      isProtected: true,
    },
    {
      id: 'choice_1',
      x: choice1Bounds.x,
      y: choice1Bounds.y,
      width: choice1Bounds.w,
      height: choice1Bounds.h,
      isProtected: true,
    },
    {
      id: 'question_timer',
      x: ARTBOARD_WIDTH * 0.2,
      y: 1150,
      width: ARTBOARD_WIDTH * 0.6,
      height: 40,
    },
    {
      id: 'running_mat',
      x: matBounds.x,
      y: matBounds.y,
      width: matBounds.w,
      height: matBounds.h,
      isProtected: true,
    },
    {
      id: 'running_mat_strike_line',
      x: strikeLineBounds.x,
      y: strikeLineBounds.y,
      width: strikeLineBounds.w,
      height: strikeLineBounds.h,
      isProtected: true,
    },
    {
      id: 'running_mat_left_lane',
      x: leftLaneBounds.x,
      y: leftLaneBounds.y,
      width: leftLaneBounds.w,
      height: leftLaneBounds.h,
      isProtected: true,
    },
    {
      id: 'running_mat_center_lane',
      x: centerLaneBounds.x,
      y: centerLaneBounds.y,
      width: centerLaneBounds.w,
      height: centerLaneBounds.h,
      isProtected: true,
    },
    {
      id: 'running_mat_right_lane',
      x: rightLaneBounds.x,
      y: rightLaneBounds.y,
      width: rightLaneBounds.w,
      height: rightLaneBounds.h,
      isProtected: true,
    },
    {
      id: 'beat_hud_badge',
      x: badgeBounds.x,
      y: badgeBounds.y,
      width: badgeBounds.w,
      height: badgeBounds.h,
    },
    {
      id: 'beat_hud_dots',
      x: dotsBounds.x,
      y: dotsBounds.y,
      width: dotsBounds.w,
      height: dotsBounds.h,
    },
    {
      id: 'beat_hud_step_counter',
      x: stepBounds.x,
      y: stepBounds.y,
      width: stepBounds.w,
      height: stepBounds.h,
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
      id: 'hud_stats',
      x: ARTBOARD_WIDTH * 0.05,
      y: 200,
      width: ARTBOARD_WIDTH * 0.9,
      height: 80,
    },
    {
      id: 'bottom_bar',
      x: bottomBarBounds.x,
      y: bottomBarBounds.y,
      width: bottomBarBounds.w,
      height: bottomBarBounds.h,
    },
    {
      id: 'bottom_bar_action',
      x: actionBtnBounds.x,
      y: actionBtnBounds.y,
      width: actionBtnBounds.w,
      height: actionBtnBounds.h,
    },
    {
      id: 'bottom_bar_settings',
      x: settingsBtnBounds.x,
      y: settingsBtnBounds.y,
      width: settingsBtnBounds.w,
      height: settingsBtnBounds.h,
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

export function registerRunningQuestionPageAdapter(
  registry: PageAdapterRegistry,
): void {
  registry.register(RUNNING_QUESTION_PAGE_ID, runningQuestionPageAdapter);
  registry.register(RUN_QUESTION_PAGE_ID, runningQuestionPageAdapter);
}
