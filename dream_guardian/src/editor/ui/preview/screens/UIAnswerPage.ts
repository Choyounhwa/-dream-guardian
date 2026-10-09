/**
 * UIAnswerPage.ts - 답안 선택 실제 렌더 페이지 어댑터 (Issue #456 / UI-VIS-026)
 *
 * 개발 규칙 및 명세 준수:
 * 1. QuestionRenderer, DreamGrid, JudgmentFeedback 실제 렌더링 파이프라인 결합
 * 2. 0-runtime 부팅 격리: GameEngine, AppBootstrap, SceneDirector, LocomotionDetector, Web Audio/TTS, 카메라/포즈 부팅 0건 보장
 * 3. 결정론적 Fixture 주입 (DEFAULT_QUESTION_FIXTURE, DEFAULT_FEEDBACK_FIXTURE 등)
 * 4. UIPresentationDocument 연동: fromPresentationDocument를 통한 텍스트/스타일/위치 커스텀 반영
 * 5. 공통 HUD(HUDLayer) 및 하단바(BottomBar) 정적 합성
 * 6. Stable ID(question_card, question_text, choice_0, choice_1, question_timer, zone_4, zone_5, feedback_banner, HUD, BottomBar)를 포함한 renderedBounds 반환
 * 7. 보호 영역(보호 HUD 존, Zone 4/5 모션 존 및 action geometry) 침범 및 3·4번째 답안 생성 시도 가드
 * 8. Stale fixture, stale revision, 비정상 캔버스 엄격한 가드 처리
 */

import {
  QuestionRenderer,
  DEFAULT_QUESTION_FIXTURE,
  type QuestionFixtureDTO,
  type QuestionPresentationContext,
} from '../../../../render/QuestionRenderer.js';
import { DreamGrid } from '../../../../render/DreamGrid.js';
import {
  JudgmentFeedback,
  DEFAULT_FEEDBACK_FIXTURE,
  getJudgmentHintBounds,
  type FeedbackFixtureDTO,
  type FeedbackPresentationContext,
} from '../../../../ui/JudgmentFeedback.js';
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
import type {
  UIPresentationDocument,
  UIPresentationPageId,
} from '../../../../data/UIPresentation.js';
import { DEFAULT_FITNESS_ZONES } from '../../../../../config/zone.config.js';

export const ARTBOARD_WIDTH = 1080;
export const ARTBOARD_HEIGHT = 2160;

export const ANSWER_SELECT_PAGE_ID = 'answer_select';
export const ANSWER_PAGE_ID = 'answer';

export const ANSWER_SELECT_BOUNDS_IDS = [
  'question_card',
  'question_text',
  'choice_0',
  'choice_1',
  'question_timer',
  'zone_4',
  'zone_5',
  'feedback_banner',
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

export type AnswerSelectBoundId = (typeof ANSWER_SELECT_BOUNDS_IDS)[number];

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

export interface AnswerPageFixtureDTO {
  isStale?: boolean;
  revision?: number;
  question?: Partial<QuestionFixtureDTO>;
  feedback?: Partial<FeedbackFixtureDTO>;
  hud?: Partial<HUDData>;
  hudData?: Partial<HUDData>;
  bottomBar?: Partial<BottomBarRenderOptions>;
  bottomBarOptions?: Partial<BottomBarRenderOptions>;
  questionContext?: QuestionPresentationContext;
  feedbackContext?: FeedbackPresentationContext;
  hudContext?: HUDPresentationContext;
  bottomBarContext?: BottomBarPresentationContext;
  // 편의 평탄화 필드
  questionText?: string;
  choices?: [string, string];
  answer?: string;
  shapeCode?: string | null;
  selectedChoiceIndex?: number | null;
  activeHoverIndex?: number | null;
  choiceProgress?: [number, number];
  timeout?: boolean;
  remainingBeats?: number;
  timePhase?: 'primary' | 'extension' | 'closed';
  playerHp?: number;
  bossHp?: number;
  combo?: number;
  chapter?: number;
}

export const DEFAULT_ANSWER_PAGE_FIXTURE: AnswerPageFixtureDTO = Object.freeze({
  question: {
    ...DEFAULT_QUESTION_FIXTURE,
    selectedChoiceIndex: null,
    activeHoverIndex: null,
    choiceProgress: [0, 0] as [number, number],
    answerSelectable: true,
  },
  feedback: DEFAULT_FEEDBACK_FIXTURE,
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
    actionLabel: '답안 선택',
    mana: 25,
    manaMax: 100,
  },
});

export const answerPageAdapter: PageAdapter = (ctx: PageRenderContext): PageRenderResult => {
  const { pageId, snapshot, fixture } = ctx;

  // 1. 지원 페이지 검사
  if (pageId !== ANSWER_SELECT_PAGE_ID && pageId !== ANSWER_PAGE_ID) {
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

  // 5. 2답안 규약 및 보호 영역 침범 검사
  const customQuestion = (fixtureObj.question ?? {}) as Partial<QuestionFixtureDTO>;
  if (
    (customQuestion.choices && customQuestion.choices.length !== 2) ||
    (fixtureObj.choices && fixtureObj.choices.length !== 2)
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'protected-zone-violation',
      timestamp: Date.now(),
    };
  }

  let doc: UIPresentationDocument | undefined;
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  if (doc) {
    const pagesToCheck = [
      doc.pages[pageId as UIPresentationPageId],
      doc.pages[ANSWER_SELECT_PAGE_ID as UIPresentationPageId],
    ].filter(Boolean);

    for (const page of pagesToCheck) {
      if (!page?.elements) continue;
      let buttonCount = 0;
      for (const el of page.elements) {
        if (!el || !el.bounds) continue;
        const id = el.id ? String(el.id).toLowerCase() : '';
        const actionId = el.actionId ? String(el.actionId).toLowerCase() : '';
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

        // 3번째/4번째 불법 답안 요소 가드
        if (
          id.includes('choice_2') ||
          id.includes('choice_3') ||
          id.includes('ans_btn_extra') ||
          actionId.includes('answer_select_2') ||
          actionId.includes('answer_select_3')
        ) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }

        if (el.type === 'button' && (actionId.startsWith('answer_select_') || id.startsWith('ans_btn_'))) {
          buttonCount++;
        }
      }

      if (buttonCount > 2) {
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

  // 6. PresentationContext 조립
  let questionContext: QuestionPresentationContext = {};
  let feedbackContext: FeedbackPresentationContext = {};
  let hudContext: HUDPresentationContext = {};
  let bottomBarContext: BottomBarPresentationContext = {};

  if (doc) {
    questionContext = QuestionRenderer.fromPresentationDocument(doc, pageId);
    feedbackContext = JudgmentFeedback.fromPresentationDocument(doc, pageId);
    hudContext = HUDLayer.fromPresentationDocument(doc, pageId);
    bottomBarContext = BottomBar.fromPresentationDocument(doc, pageId);
  }

  if (raw.questionContext || fixtureObj.questionContext) {
    questionContext = {
      ...questionContext,
      ...raw.questionContext,
      ...fixtureObj.questionContext,
    };
  }
  if (raw.feedbackContext || fixtureObj.feedbackContext) {
    feedbackContext = {
      ...feedbackContext,
      ...raw.feedbackContext,
      ...fixtureObj.feedbackContext,
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

  // 7. 결정론적 Fixture 파라미터 조합
  const questionChoices: [string, string] =
    customQuestion.choices && customQuestion.choices.length === 2
      ? customQuestion.choices
      : fixtureObj.choices && fixtureObj.choices.length === 2
      ? fixtureObj.choices
      : DEFAULT_QUESTION_FIXTURE.choices;

  const questionFixture: QuestionFixtureDTO = {
    ...DEFAULT_QUESTION_FIXTURE,
    ...customQuestion,
    choices: questionChoices,
    ...(fixtureObj.questionText !== undefined
      ? { questionText: fixtureObj.questionText }
      : {}),
    ...(fixtureObj.answer !== undefined ? { answer: fixtureObj.answer } : {}),
    ...(fixtureObj.shapeCode !== undefined
      ? { shapeCode: fixtureObj.shapeCode }
      : {}),
    ...(fixtureObj.selectedChoiceIndex !== undefined
      ? { selectedChoiceIndex: fixtureObj.selectedChoiceIndex }
      : {}),
    ...(fixtureObj.activeHoverIndex !== undefined
      ? { activeHoverIndex: fixtureObj.activeHoverIndex }
      : {}),
    ...(fixtureObj.choiceProgress !== undefined
      ? { choiceProgress: fixtureObj.choiceProgress }
      : {}),
    answerSelectable: customQuestion.answerSelectable ?? true,
    buttonsOnly: false,
    headerOnly: false,
  };

  const customFeedback = (fixtureObj.feedback ?? {}) as Partial<FeedbackFixtureDTO>;
  const isTimeout =
    fixtureObj.timeout === true ||
    (customQuestion as any).remainingBeats === 0 ||
    fixtureObj.remainingBeats === 0 ||
    fixtureObj.timePhase === 'closed';

  const feedbackFixture: FeedbackFixtureDTO = {
    ...DEFAULT_FEEDBACK_FIXTURE,
    ...customFeedback,
    ...(isTimeout
      ? {
          message: customFeedback.message ?? '시간 초과! 정답을 확인하세요.',
          isVisible: true,
          glowIntensity: 0.9,
        }
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

  const customBottomBar = (fixtureObj.bottomBar ??
    fixtureObj.bottomBarOptions ??
    raw.bottomBarOptions ??
    {}) as Partial<BottomBarRenderOptions>;
  const bottomBarOptions: BottomBarRenderOptions = {
    pageId,
    actionLabel: customBottomBar.actionLabel ?? '답안 선택',
    mana: customBottomBar.mana ?? 25,
    manaMax: customBottomBar.manaMax ?? 100,
    ...customBottomBar,
  };

  // 8. 실제 렌더러 파이프라인 호출
  // 8.1 DreamGrid (3D 원근 와이어프레임 배경)
  const dreamGrid = new DreamGrid();
  dreamGrid.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.2 QuestionRenderer (문제 헤더 및 좌우 2답안 버튼)
  questionRenderer.renderFixture(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    questionFixture,
    questionContext,
  );

  // 8.3 JudgmentFeedback (선택/피드백 힌트 배너)
  const judgmentFeedback = new JudgmentFeedback(undefined, undefined, feedbackContext);
  judgmentFeedback.renderFixture(
    ctx.ctx,
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    feedbackFixture,
  );

  // 8.4 HUDLayer
  const hudLayer = new HUDLayer();
  if (hudContext) {
    hudLayer.setPresentationContext(hudContext);
  }
  hudLayer.render(ctx.ctx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8.5 BottomBar
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

  const z4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
  const z5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

  const hintBounds = getJudgmentHintBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

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
      x: Math.round(ARTBOARD_WIDTH * 0.2),
      y: 1150,
      width: Math.round(ARTBOARD_WIDTH * 0.6),
      height: 40,
    },
    {
      id: 'zone_4',
      x: Math.round(z4.x * ARTBOARD_WIDTH),
      y: Math.round(z4.y * ARTBOARD_HEIGHT),
      width: Math.round(z4.width * ARTBOARD_WIDTH),
      height: Math.round(z4.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'zone_5',
      x: Math.round(z5.x * ARTBOARD_WIDTH),
      y: Math.round(z5.y * ARTBOARD_HEIGHT),
      width: Math.round(z5.width * ARTBOARD_WIDTH),
      height: Math.round(z5.height * ARTBOARD_HEIGHT),
      isProtected: true,
    },
    {
      id: 'feedback_banner',
      x: hintBounds.x,
      y: hintBounds.y,
      width: hintBounds.width,
      height: hintBounds.height,
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
      x: Math.round(ARTBOARD_WIDTH * 0.05),
      y: 200,
      width: Math.round(ARTBOARD_WIDTH * 0.9),
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
    renderedBounds,
    timestamp: Date.now(),
  };
};

export function registerAnswerPageAdapter(registry: PageAdapterRegistry): void {
  registry.register(ANSWER_SELECT_PAGE_ID, answerPageAdapter);
  registry.register(ANSWER_PAGE_ID, answerPageAdapter);
}
