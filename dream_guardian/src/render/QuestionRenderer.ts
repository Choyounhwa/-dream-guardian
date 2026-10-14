/**
 * QuestionRenderer - 인게임 수학 문제 및 2개 답안 버튼 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 문제 수식 및 답안 선택 버튼 렌더링 코드 분리
 * - QuestionRenderer와 BeatHUDRenderer 간 중복되던 renderMath 블록 공통 헬퍼로 통합
 */

import type { GeneratedQuestion } from '../question/QuestionEvaluator.js';
import { renderMath } from './MathRenderer.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';
import type { QuestionRecipePlan } from '../input/RecipeGenerator.js';
import { ShapeRenderer, deriveShapeFromQuestion } from './ShapeRenderer.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { QUESTION_ANSWER_TIME_TOKENS, UI_LAYOUT } from '../../config/ui.config.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

function clampTextScale(scale: number | undefined): number {
  if (scale === undefined || Number.isNaN(scale)) return 1.0;
  return Math.max(0.5, Math.min(3.0, scale));
}

export interface QuestionBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface QuestionSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  font?: string;
  text?: string;
  visible?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
}

export interface QuestionPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  header?: QuestionSlotOverride;
  choice0?: QuestionSlotOverride;
  choice1?: QuestionSlotOverride;
  choices?: [QuestionSlotOverride, QuestionSlotOverride];
}

export interface QuestionFixtureDTO {
  questionText: string;
  choices: [string, string];
  answer?: string;
  shapeCode?: string | null;
  level?: number;
  chapter?: number;
  selectedChoiceIndex?: number | null;
  activeHoverIndex?: number | null;
  choiceProgress?: [number, number];
  questionApproachProgress?: number;
  answerApproachProgress?: number;
  vanishingX?: number;
  vanishingY?: number;
  answerSelectable?: boolean;
  buttonsOnly?: boolean;
  headerOnly?: boolean;
}

export const QUESTION_SLOT_IDS = [
  'header',
  'choice_0',
  'choice_1',
  'zone_4_action_geometry',
  'zone_5_action_geometry',
] as const;

export const PROTECTED_QUESTION_SLOT_IDS = [
  'choice_0',
  'choice_1',
  'zone_4_action_geometry',
  'zone_5_action_geometry',
] as const;

export const DEFAULT_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '12 + 15 = [ ? ]',
  choices: ['27', '25'] as [string, string],
  answer: '27',
  shapeCode: null,
  level: 1,
  chapter: 1,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const LONG_FORMULA_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '124 × 7 - 28 ÷ 4 + 50 = [ ? ]',
  choices: ['840', '820'] as [string, string],
  answer: '840',
  shapeCode: null,
  level: 4,
  chapter: 2,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const FRACTION_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '3/4 + 2/4 = [ ? ]',
  choices: ['5/4', '6/4'] as [string, string],
  answer: '5/4',
  shapeCode: null,
  level: 3,
  chapter: 3,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const GEOMETRY_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '[모양 A] 위에서 본 모양으로 알맞은 것은?',
  choices: ['2개', '3개'] as [string, string],
  answer: '2개',
  shapeCode: "{type:'stack_cubes',grid:[[2,1],[1,0]],view:'top',shapeName:'모양 A'}",
  level: 9,
  chapter: 4,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const APPROACH_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '8 × 9 = [ ? ]',
  choices: ['72', '64'] as [string, string],
  answer: '72',
  shapeCode: null,
  level: 2,
  chapter: 2,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 0.5,
  answerApproachProgress: 0.5,
  vanishingX: 540,
  vanishingY: 400,
  answerSelectable: false,
  buttonsOnly: false,
  headerOnly: false,
});

export interface QuestionRenderState {
  question: GeneratedQuestion | null;
  questionVisible: boolean;
  selectedChoiceIndex?: number | null;
  answerPlan?: QuestionRecipePlan | null;
  /** Issue #322: 문제 출제 첫 2박 원근 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 안착) */
  questionApproachProgress?: number;
  /** Issue #279: 답안 원근 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 안착) */
  answerApproachProgress?: number;
  /** 원근 접근 소실점 좌표 (기본 중앙 상단 / 보스 위치) */
  vanishingX?: number;
  vanishingY?: number;
  /** 러닝 페이즈 6박 이후 답안 프리뷰 시 헤더 중복 방지 플래그 */
  buttonsOnly?: boolean;
  /** Issue #322: 러닝 페이즈(1~5박) 등 답안 버튼 숨김 및 수식 목판 헤더만 렌더링 */
  headerOnly?: boolean;
  /** 8박 종료 후 2박 선택 창에서만 true. 6~8박 프리뷰는 false(비활성) */
  answerSelectable?: boolean;
  /** Issue #285 (UI-ANSWER-002): 각 보기 버튼의 0.0 ~ 1.0 충전 진행도 */
  choiceProgress?: [number, number];
  /** Issue #285 (UI-ANSWER-002): 현재 조준/타겟팅된 보기 버튼 인덱스 0 또는 1 */
  activeHoverIndex?: number | null;
  /** Issue #311: #309 AnswerTimeSnapshot과 호환되는 읽기 전용 표시 입력 */
  answerTime?: AnswerTimeDisplay | null;
  /** 프리뷰/비활성/분기 후 경로가 true를 넘기기 전까지 시간 라벨을 숨긴다 */
  showAnswerTime?: boolean;
}

export interface AnswerTimeDisplay {
  phase: 'primary' | 'extension' | 'closed';
  primaryBeats: number;
  extensionBeats: number;
  maxBeats: number;
  elapsedBeats: number;
  remainingBeats: number;
  inputOpen: boolean;
}

export interface QuestionHeaderMathOptions {
  hasShape?: boolean;
  maxHeight?: number;
  maxWidth?: number;
  minFontSize?: number;
  color?: string;
  shadowColor?: string;
  shadowBlur?: number;
  textScale?: number;
}

/**
 * 상단 문제 수식 텍스트 렌더링 공통 헬퍼
 * @param ctx 캔버스 2D 컨텍스트
 * @param questionText 문제 수식 텍스트
 * @param cx 수평 중앙 좌표
 * @param qY 기준 Y 좌표
 * @param scaleX 가상 X 스케일 비율
 * @param isRunningPhase 러닝 페이즈 여부 (러닝 페이즈는 110px 기본, 문제 풀이 페이즈는 132px 기본)
 * @param options 너비/높이/폰트 제약 옵션
 */
export function renderQuestionHeaderMath(
  ctx: CanvasRenderingContext2D,
  questionText: string,
  cx: number,
  qY: number,
  scaleX: number,
  _isRunningPhase: boolean = false,
  options?: QuestionHeaderMathOptions,
): { width: number; height: number } {
  const qLen = questionText.length;
  // Issue #322: 러닝·답선택 페이즈 간 132px 대형 폰트 일원화 (SSOT)
  const baseSize = 132;
  const minSize = options?.minFontSize ?? (options?.hasShape ? 44 : 64);
  const textScale = clampTextScale(options?.textScale);

  let qFontSize = baseSize * scaleX * textScale;
  if (qLen > 10) {
    qFontSize = Math.max(minSize * scaleX * textScale, (baseSize - (qLen - 10) * 2.8) * scaleX * textScale);
  }

  const defaultMaxHeight = options?.hasShape ? 150 * scaleX : 340 * scaleX;
  const maxHeight = options?.maxHeight ?? defaultMaxHeight;
  const maxWidth = options?.maxWidth ?? 880 * scaleX;

  const shadowCol = options?.shadowColor ?? 'rgba(40, 230, 255, 0.5)';
  const shadowB = options?.shadowBlur !== undefined ? options.shadowBlur * scaleX : 16 * scaleX;
  const textColor = options?.color ?? '#ffffff';

  ctx.shadowColor = shadowCol;
  ctx.shadowBlur = shadowB;
  const result = renderMath(ctx, questionText, cx, qY, {
    fontSize: qFontSize,
    color: textColor,
    align: 'center',
    maxWidth,
    maxHeight,
    minFontSize: minSize * scaleX,
    placeholderColor: '#28E6FF',
    placeholderBgColor: 'rgba(40, 230, 255, 0.18)',
    fractionLineColor: textColor,
  });
  ctx.shadowBlur = 0;
  return result;
}

export class QuestionRenderer {
  private _shapeRenderer = new ShapeRenderer();
  private _presentationContext?: QuestionPresentationContext;

  constructor(presentationContext?: QuestionPresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  get shapeRenderer(): ShapeRenderer {
    return this._shapeRenderer;
  }

  setPresentationContext(context?: QuestionPresentationContext): void {
    this._presentationContext = context;
  }

  getPresentationContext(): QuestionPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  private _resolveContext(overrideCtx?: QuestionPresentationContext): QuestionPresentationContext | undefined {
    const ctx = overrideCtx ?? this._presentationContext;
    if (!ctx) return undefined;
    if (!ctx.presentationDocument) return ctx;

    const docCtx = QuestionRenderer.fromPresentationDocument(ctx.presentationDocument, ctx.pageId);
    return {
      ...docCtx,
      ...ctx,
      header: { ...docCtx.header, ...ctx.header },
      choice0: { ...docCtx.choice0, ...ctx.choice0 },
      choice1: { ...docCtx.choice1, ...ctx.choice1 },
      choices: ctx.choices ?? docCtx.choices,
    };
  }

  isSlotLocked(slotId: string): boolean {
    return (PROTECTED_QUESTION_SLOT_IDS as readonly string[]).includes(slotId);
  }

  getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return '답안 버튼(choice_0, choice_1)은 피트니스 Zone 4/5 모션 인터랙션 핵심 보호 영역으로 action geometry 및 원근 앵커 변조가 원자적으로 잠겨 있습니다. 입력 판정 왜곡 방지를 위해 기하 변경이 거부됩니다.';
    }
    return null;
  }

  validatePresentationContext(
    context?: QuestionPresentationContext,
  ): { valid: boolean; violations: string[]; lockedSlots: string[] } {
    const violations: string[] = [];
    const lockedSlots: string[] = [];

    if (!context) {
      return { valid: true, violations, lockedSlots };
    }

    if (context.choices && context.choices.length !== 2) {
      violations.push(
        `2답안 규격 위반: 본 게임은 정확히 2답안(Zone 4/5) 구조만 지원하며, ${context.choices.length}개 답안은 허용되지 않습니다.`,
      );
    }

    const checkChoice = (slotName: string, override?: QuestionSlotOverride, expectedX = 43, expectedY = 890) => {
      if (!override) return;
      if (
        (override.x !== undefined && Math.abs(override.x - expectedX) > 0.001) ||
        (override.y !== undefined && Math.abs(override.y - expectedY) > 0.001) ||
        (override.w !== undefined && Math.abs(override.w - 281) > 0.001) ||
        (override.h !== undefined && Math.abs(override.h - 250) > 0.001)
      ) {
        lockedSlots.push(slotName);
        violations.push(
          `${slotName}: 피트니스 Zone 4/5 보호 기하(action geometry) 변조 시도가 감지되었습니다. 입력 판정과의 왜곡을 방지하기 위해 위치/크기 변경이 거부됩니다.`,
        );
      }
    };

    checkChoice('choice_0', context.choice0, 43, 890);
    checkChoice('choice_1', context.choice1, 756, 890);
    if (context.choices && context.choices.length === 2) {
      checkChoice('choice_0', context.choices[0], 43, 890);
      checkChoice('choice_1', context.choices[1], 756, 890);
    }

    return {
      valid: violations.length === 0,
      violations,
      lockedSlots,
    };
  }

  getHeaderBounds(
    w: number,
    h: number,
    options?: { hasShape?: boolean },
  ): QuestionBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const hasShape = options?.hasShape ?? false;
    const resolvedCtx = this._resolveContext();
    const board = UI_LAYOUT.question?.board;
    const baseW = (hasShape ? (board?.shapeW ?? 760) : (board?.w ?? 880)) * scaleX;
    const baseH = (hasShape ? (board?.shapeH ?? 200) : (board?.h ?? 280)) * scaleY;
    const boxY = (board?.y ?? 320) * scaleY;
    const shapeOffsetY = (board?.shapeOffsetY ?? -30) * scaleY;
    const defaultY = hasShape ? boxY + shapeOffsetY : boxY;
    const defaultX = board?.x !== undefined && !hasShape ? board.x * scaleX : (w - baseW) / 2;

    if (resolvedCtx?.header) {
      const hov = resolvedCtx.header;
      const bw = hov.w !== undefined ? hov.w * scaleX : baseW;
      const bh = hov.h !== undefined ? hov.h * scaleY : baseH;
      const bx = hov.x !== undefined ? hov.x * scaleX : (w - bw) / 2;
      const by = hov.y !== undefined ? hov.y * scaleY : defaultY;
      return {
        x: bx,
        y: by,
        w: bw,
        h: bh,
        width: bw,
        height: bh,
        isProtected: false,
      };
    }

    return {
      x: defaultX,
      y: defaultY,
      w: baseW,
      h: baseH,
      width: baseW,
      height: baseH,
      isProtected: false,
    };
  }

  getQuestionBounds(
    w: number,
    h: number,
    options?: { hasShape?: boolean },
  ): QuestionBounds {
    return this.getHeaderBounds(w, h, options);
  }

  getChoiceButtonBounds(
    choiceIndex: 0 | 1,
    w: number,
    h: number,
  ): QuestionBounds {
    if (choiceIndex !== 0 && choiceIndex !== 1) {
      throw new Error(`Invalid choice button index: ${choiceIndex}. Only exactly 2 choices (0 or 1) are supported.`);
    }

    const layouts = getAnswerButtonLayouts(w, h);
    const layout = layouts[choiceIndex];

    // Protected zone geometry: button bounds are locked to Zone 4 / Zone 5 interaction geometry!
    return {
      x: layout.x,
      y: layout.y,
      w: layout.width,
      h: layout.height,
      width: layout.width,
      height: layout.height,
      isProtected: true,
    };
  }

  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId?: UIPresentationPageId | string,
  ): QuestionPresentationContext {
    const result: QuestionPresentationContext = {
      presentationDocument: doc,
      pageId,
    };
    if (!doc?.pages) return result;

    const targetPages = pageId && doc.pages[pageId as UIPresentationPageId]
      ? [doc.pages[pageId as UIPresentationPageId]]
      : [
          doc.pages['running_question' as UIPresentationPageId],
          doc.pages['answer_select' as UIPresentationPageId],
        ].filter(Boolean);

    for (const page of targetPages) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        const boundsObj: QuestionSlotOverride = el.bounds
          ? {
              x: el.bounds.x,
              y: el.bounds.y,
              w: el.bounds.width,
              h: el.bounds.height,
              fontSize: el.fontSize,
              text: el.text,
              color: (el as { color?: string }).color,
            }
          : {};

        if (
          el.id === 'run_question_banner' ||
          el.id === 'question_banner' ||
          el.id === 'header' ||
          el.dynamicBinding === 'preview_question_text'
        ) {
          result.header = { ...boundsObj, ...result.header };
        } else if (
          el.id === 'ans_btn_left' ||
          el.id === 'choice_0' ||
          el.actionId === 'answer_select_0' ||
          el.dynamicBinding === 'preview_answer_0_text'
        ) {
          result.choice0 = { ...boundsObj, ...result.choice0 };
        } else if (
          el.id === 'ans_btn_right' ||
          el.id === 'choice_1' ||
          el.actionId === 'answer_select_1' ||
          el.dynamicBinding === 'preview_answer_1_text'
        ) {
          result.choice1 = { ...boundsObj, ...result.choice1 };
        }
      }
    }

    if (result.choice0 || result.choice1) {
      result.choices = [
        result.choice0 ?? {},
        result.choice1 ?? {},
      ];
    }

    return result;
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fixture: QuestionFixtureDTO,
    contextOverride?: QuestionPresentationContext,
  ): void {
    const prevContext = this._presentationContext;
    if (contextOverride) {
      this._presentationContext = contextOverride;
    }
    try {
      const state: QuestionRenderState = {
        question: {
          questionText: fixture.questionText,
          correctAnswer: fixture.answer ?? fixture.choices[0],
          wrongAnswer: fixture.choices[1],
          choices: [fixture.choices[0], fixture.choices[1]],
          correctIndex: 0,
          shapeCode: fixture.shapeCode ?? undefined,
        },
        questionVisible: true,
        selectedChoiceIndex: fixture.selectedChoiceIndex,
        activeHoverIndex: fixture.activeHoverIndex,
        choiceProgress: fixture.choiceProgress,
        questionApproachProgress: fixture.questionApproachProgress,
        answerApproachProgress: fixture.answerApproachProgress,
        vanishingX: fixture.vanishingX,
        vanishingY: fixture.vanishingY,
        buttonsOnly: fixture.buttonsOnly,
        headerOnly: fixture.headerOnly,
        answerSelectable: fixture.answerSelectable,
      };
      this.render(ctx, w, h, state);
    } finally {
      this._presentationContext = prevContext;
    }
  }

  static renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fixture: QuestionFixtureDTO,
    contextOverride?: QuestionPresentationContext,
  ): void {
    const renderer = new QuestionRenderer(contextOverride);
    renderer.renderFixture(ctx, w, h, fixture);
  }

  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: QuestionRenderState,
  ): void {
    if (!state.question || !state.questionVisible) return;

    if (!Array.isArray(state.question.choices) || state.question.choices.length !== 2) {
      throw new Error(
        `QuestionRenderer requires exactly 2 choices (index 0 and 1) for Zone 4/5, but received ${state.question.choices?.length ?? 0}`,
      );
    }

    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const resolvedCtx = this._resolveContext();
    const shape = deriveShapeFromQuestion(state.question.questionText, state.question.shapeCode);

    ctx.save();

    // 1 & 2. 문제영역 가상 레이아웃 및 수식/도형 (buttonsOnly가 아닐 때만 렌더)
    if (!state.buttonsOnly) {
      const board = UI_LAYOUT.question?.board;
      const boxY = (board?.y ?? 320) * scaleY;
      const cx = w / 2;
      const shapeOffsetY = (board?.shapeOffsetY ?? -30) * scaleY;
      const textOffsetY = (board?.textOffsetY ?? 220) * scaleY;
      const shapeTextOffsetY = (board?.shapeTextOffsetY ?? 70) * scaleY;

      // 도형 존재 시 문제 텍스트를 상단으로 정렬하여 중앙 3D 뷰포트 영역(480~820px)과 겹침 0% 보장
      const qY = shape ? boxY + shapeTextOffsetY : boxY + textOffsetY;

      const qProgress = state.questionApproachProgress !== undefined
        ? Math.max(0, Math.min(1.0, state.questionApproachProgress))
        : 1.0;

      ctx.save();

      // Issue #322: 러닝 페이즈 첫 2박 동안 소실점(보스)에서 목표 정면으로 원근 접근 연출
      if (qProgress < 1.0) {
        const panelLayout = UI_LAYOUT.question?.panel;
        const defaultVy = panelLayout?.vanishingY !== undefined ? panelLayout.vanishingY * scaleY : (h * 0.24);
        const vx = state.vanishingX ?? cx;
        const vy = state.vanishingY ?? defaultVy;
        const headerCenterY = shape ? boxY + shapeTextOffsetY : boxY + (board?.h ?? 280) / 2 * scaleY;

        const eased = 1.0 - Math.pow(1.0 - qProgress, 2.0);
        const curX = vx + (cx - vx) * eased;
        const curY = vy + (headerCenterY - vy) * eased;
        const scale = 0.15 + (1.0 - 0.15) * eased;
        const alpha = 0.10 + (1.0 - 0.10) * eased;

        ctx.globalAlpha = Math.max(0, Math.min(1.0, ctx.globalAlpha * alpha));
        ctx.translate(curX, curY);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -headerCenterY);
      }

      // 1. 문제 수식 배경 패널 (Issue #290 / UI-ASSET-009)
      const boardBgImg = imageLoader.get('question', 'questionBoardBg');
      if (boardBgImg) {
        const boardW = (resolvedCtx?.header?.w !== undefined
          ? resolvedCtx.header.w * scaleX
          : (shape ? (board?.shapeW ?? 760) : (board?.w ?? 880)) * scaleX);
        const boardH = (resolvedCtx?.header?.h !== undefined
          ? resolvedCtx.header.h * scaleY
          : (shape ? (board?.shapeH ?? 200) : (board?.h ?? 280)) * scaleY);
        const boardX = resolvedCtx?.header?.x !== undefined
          ? resolvedCtx.header.x * scaleX
          : cx - boardW / 2;
        const boardY = resolvedCtx?.header?.y !== undefined
          ? resolvedCtx.header.y * scaleY
          : (shape ? boxY + shapeOffsetY : boxY);
        ctx.drawImage(boardBgImg, boardX, boardY, boardW, boardH);
      }

      // 2. 문제 수식 텍스트 (Issue #167 & #234: 긴 자연어/복합 수식 높이 및 너비 안전 수용)
      renderQuestionHeaderMath(ctx, state.question.questionText, cx, qY, scaleX, false, {
        hasShape: Boolean(shape),
        maxHeight: shape ? 140 * scaleY : 320 * scaleY,
        color: resolvedCtx?.header?.color,
        shadowColor: resolvedCtx?.header?.shadowColor,
        shadowBlur: resolvedCtx?.header?.shadowBlur,
        textScale: board?.textScale,
      });

      // 2-1. 도형(쌓기나무 3D / 전개도 / 회전) 시각화 렌더링 (텍스트와 버튼 사이 중앙 비간섭 영역)
      if (shape) {
        const panelLayout = UI_LAYOUT.question?.panel;
        const panelW = (panelLayout?.w ?? 480) * scaleX;
        const panelH = (panelLayout?.h ?? 340) * scaleY;
        const panelCy = (panelLayout?.cy !== undefined
          ? panelLayout.cy
          : (panelLayout?.y !== undefined ? panelLayout.y + panelH / 2 : 650)) * scaleY;
        this._shapeRenderer.renderShape(ctx, shape, cx, panelCy, panelW, panelH);
      }

      ctx.restore();
    }

    // 3. 답안 버튼 2개 횡배치 (Issue #164, #233 & #279: Zone 4/5 깔끔한 2버튼 레이아웃 및 소실점 원근 접근)
    if (!state.headerOnly) {
      const buttonLayouts = getAnswerButtonLayouts(w, h);
    const progress = state.answerApproachProgress !== undefined
      ? Math.max(0, Math.min(1.0, state.answerApproachProgress))
      : 1.0;
    const panelLayout = UI_LAYOUT.question?.panel;
    const defaultVy = panelLayout?.vanishingY !== undefined ? panelLayout.vanishingY * scaleY : (h * 0.24);
    const vx = state.vanishingX ?? (w / 2);
    const vy = state.vanishingY ?? defaultVy;

    const isApproaching = progress < 1.0;
    const eased = isApproaching ? 1.0 - Math.pow(1.0 - progress, 2) : 1.0;
    const minScale = 0.20;
    const minAlpha = 0.20;
    const scale = isApproaching ? minScale + (1.0 - minScale) * eased : 1.0;
    const alpha = isApproaching ? minAlpha + (1.0 - minAlpha) * eased : 1.0;
    const selectable = state.answerSelectable !== false;

    for (let i = 0; i < 2; i++) {
      const btn = buttonLayouts[i];
      const targetCenterX = btn.x + btn.width / 2;
      const targetCenterY = btn.y + btn.height / 2;

      const choiceOverride = i === 0
        ? (resolvedCtx?.choice0 ?? resolvedCtx?.choices?.[0])
        : (resolvedCtx?.choice1 ?? resolvedCtx?.choices?.[1]);

      // 소실점에서 목표 위치로 부채꼴 외곽 궤적 보간
      const curCenterX = isApproaching ? vx + (targetCenterX - vx) * eased : targetCenterX;
      const curCenterY = isApproaching ? vy + (targetCenterY - vy) * eased : targetCenterY;

      // Issue #285 (UI-ANSWER-002): 조준 시 미세 확대 (Magnet Hover State: 1.05x)
      const isHovered = state.activeHoverIndex === i;
      const hoverScale = isHovered ? 1.05 : 1.0;
      const effectiveScale = scale * hoverScale;

      const curW = btn.width * effectiveScale;
      const curH = btn.height * effectiveScale;
      const bx = curCenterX - curW / 2;
      const btnY = curCenterY - curH / 2;

      ctx.save();
      ctx.globalAlpha *= selectable ? alpha : alpha * 0.42;

      // Issue #285 (UI-ANSWER-002): 호버 시 글로우 효과 (shadowBlur 20px)
      if (isHovered) {
        ctx.shadowColor = i === 0 ? 'rgba(40, 230, 255, 0.8)' : 'rgba(255, 203, 77, 0.8)';
        ctx.shadowBlur = 20 * scaleX * scale;
      }

      // Issue #290 (UI-ASSET-009): 사전 렌더링된 버튼 프레임 비트맵 이미지 에셋 연동
      const isSelected = state.selectedChoiceIndex === i;
      const assetKey = isHovered ? 'answerBtnHover' : (isSelected ? 'answerBtnSelected' : 'answerBtnDefault');
      const btnImg = imageLoader.get('question', assetKey) ?? imageLoader.get('question', 'answerBtnDefault');

      if (btnImg) {
        ctx.drawImage(btnImg, bx, btnY, curW, curH);
      } else {
        // 모던 반투명 네온 버튼 배경 (프로시저럴 폴백)
        ctx.fillStyle = choiceOverride?.backgroundColor ?? 'rgba(16, 24, 48, 0.88)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.fill();
        if (choiceOverride?.borderColor) {
          ctx.strokeStyle = choiceOverride.borderColor;
          ctx.lineWidth = (choiceOverride.borderWidth ?? 3) * scaleX * effectiveScale;
          ctx.stroke();
        }
      }

      // Issue #285 (UI-ANSWER-002): 실시간 0~100% 충전 프로그레스 바 및 부드러운 네온 내부 채우기 (Fill)
      const rawProgress = state.selectedChoiceIndex === i ? 1.0 : (state.choiceProgress ? state.choiceProgress[i] : 0);
      const choiceProgress = Math.max(0, Math.min(1.0, rawProgress ?? 0));

      if (choiceProgress > 0) {
        ctx.save();
        // 1) 내부 네온 충전 필 (진행도 비례 너비)
        ctx.fillStyle = i === 0
          ? `rgba(40, 230, 255, ${0.12 + choiceProgress * 0.13})`
          : `rgba(255, 203, 77, ${0.12 + choiceProgress * 0.13})`;
        ctx.beginPath();
        const fillW = curW * choiceProgress;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, fillW, curH, 18 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, fillW, curH);
        }
        ctx.fill();

        // 2) 버튼 하단 네온 프로그레스 바
        const barH = Math.max(4, 8 * scaleY * effectiveScale);
        const barY = btnY + curH - barH - 6 * scaleY * effectiveScale;
        const barPad = 8 * scaleX * effectiveScale;
        const barMaxW = curW - barPad * 2;
        const barW = Math.max(0, barMaxW * choiceProgress);

        ctx.fillStyle = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.shadowColor = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.shadowBlur = 12 * effectiveScale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx + barPad, barY, barW, barH, barH / 2);
        } else {
          ctx.rect(bx + barPad, barY, barW, barH);
        }
        ctx.fill();

        // 3) 네온 프로그레스 테두리 (진행도 비례 발광 강화)
        ctx.strokeStyle = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.lineWidth = (6 + choiceProgress * 2) * scaleX * effectiveScale;
        ctx.shadowColor = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.shadowBlur = (10 + choiceProgress * 10) * effectiveScale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.stroke();

        ctx.restore();
      } else if (!selectable) {
        ctx.strokeStyle = 'rgba(140, 150, 170, 0.55)';
        ctx.lineWidth = 4 * scaleX * effectiveScale;
        ctx.setLineDash([10 * scaleX, 8 * scaleX]);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (!btnImg) {
        // 기본 네온 테두리 (진행도 없을 때 & 비트맵 미로드 프로시저럴 폴백)
        ctx.strokeStyle = i === 0 ? 'rgba(40, 230, 255, 0.7)' : 'rgba(255, 203, 77, 0.7)';
        ctx.lineWidth = 6 * scaleX * effectiveScale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Issue #200 & #285 (UI-ANSWER-002): 확정 즉시 체결 및 판정 스탬프 (Confirm Stamp)
      if (state.selectedChoiceIndex === i) {
        ctx.save();
        // 강력한 녹색 테두리 (#00FF88)
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 10 * scaleX * effectiveScale;
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 24 * scale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(
            bx - 3 * scale,
            btnY - 3 * scale,
            curW + 6 * scale,
            curH + 6 * scale,
            22 * scaleX * effectiveScale,
          );
        } else {
          ctx.strokeRect(bx - 3 * scale, btnY - 3 * scale, curW + 6 * scale, curH + 6 * scale);
        }
        ctx.stroke();

        // 버튼 중앙 '선택 완료! [V]' 네온 뱃지/스탬프
        const badgeText = '선택 완료! [V]';
        const btnConfig = UI_LAYOUT.question?.answerButtons;
        const badgeTextScale = clampTextScale(btnConfig?.badgeTextScale);
        ctx.font = UIText.getFont('badge', scaleX * effectiveScale * badgeTextScale, 'bold');
        const textMetrics = ctx.measureText ? ctx.measureText(badgeText) : { width: 100 };
        const badgeW = (textMetrics.width || 100) + 24 * scaleX * effectiveScale;
        const badgeH = 34 * scaleY * effectiveScale;
        const badgeX = curCenterX - badgeW / 2;
        const badgeY = curCenterY - badgeH / 2;

        ctx.fillStyle = 'rgba(16, 40, 24, 0.95)';
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 2 * scaleX * effectiveScale;
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 14 * scale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10 * scaleX * effectiveScale);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00FF88';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, curCenterX, badgeY + badgeH / 2);
        ctx.restore();
      }

      // 수식 폰트: bold 96px (긴 수식은 최소 32px까지 자동 축소, 버튼 경계 내 안전 수용)
      const btnConfig = UI_LAYOUT.question?.answerButtons;
      const btnTextScale = clampTextScale(btnConfig?.textScale);
      const hintTextScale = clampTextScale(btnConfig?.hintTextScale);
      const waitingTextScale = clampTextScale(btnConfig?.waitingTextScale);

      const choiceStr = String(state.question.choices[i]);
      const choiceLen = choiceStr.length;
      const baseChoiceFontSize = choiceLen > 6 ? Math.max(50 * scaleX, (96 - (choiceLen - 6) * 5) * scaleX) : 96 * scaleX;
      const choiceFontSize = (choiceOverride?.fontSize ? choiceOverride.fontSize * scaleX : baseChoiceFontSize * btnTextScale) * effectiveScale;
      const choiceTargetY = state.selectedChoiceIndex === i
        ? curCenterY - 48 * scaleY * effectiveScale
        : curCenterY;

      const choiceColor = choiceOverride?.color ?? (selectable ? '#FFCB4D' : '#8A93A8');
      renderMath(ctx, choiceStr, curCenterX, choiceTargetY, {
        fontSize: choiceFontSize,
        color: choiceColor,
        align: 'center',
        maxWidth: Math.max(20, (btn.width - 32 * scaleX) * effectiveScale),
        maxHeight: Math.max(20, (btn.height - 32 * scaleY) * effectiveScale),
        minFontSize: Math.round(32 * scaleX * effectiveScale * btnTextScale),
        fractionLineColor: choiceColor,
        placeholderColor: choiceColor,
      });

      if (!selectable) {
        ctx.save();
        ctx.font = UIText.getFont('badge', scaleX * scale * waitingTextScale, 'bold');
        ctx.fillStyle = '#9AA3B5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('대기', curCenterX, btnY + curH + 28 * scaleY * scale);
        ctx.restore();
      }

      // 키보드 힌트 (선택 가능 구간에서만 표시)
      if (selectable && progress >= 0.7) {
        const badgeAlpha = isApproaching ? Math.min(1.0, (progress - 0.7) / 0.3) : 1.0;
        ctx.save();
        ctx.globalAlpha *= badgeAlpha;
        ctx.font = UIText.getFont('badge', scaleX * scale * hintTextScale, 'bold');
        ctx.fillStyle = '#CCCCCC';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`키보드 [${i + 1}]`, curCenterX, btnY + curH + 34 * scaleY * scale);
        ctx.restore();
      }

      ctx.restore();
    }

    this.renderAnswerTimeStatus(ctx, w, h, scaleX, scaleY, state);
    }

    ctx.restore();
  }

  private renderAnswerTimeStatus(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scaleX: number,
    scaleY: number,
    state: QuestionRenderState,
  ): void {
    const snap = state.answerTime;
    const visible = state.showAnswerTime === true
      && !state.buttonsOnly
      && state.answerSelectable !== false
      && snap != null
      && snap.inputOpen
      && (snap.phase === 'primary' || snap.phase === 'extension');
    if (!visible || !snap) return;

    const phaseLabel = snap.phase === 'primary'
      ? QUESTION_ANSWER_TIME_TOKENS.primaryLabel
      : QUESTION_ANSWER_TIME_TOKENS.extensionLabel;
    const label = `${phaseLabel} ${snap.remainingBeats}박 남음`;
    const timerConfig = UI_LAYOUT.question?.timer;
    const y = (timerConfig?.y ?? QUESTION_ANSWER_TIME_TOKENS.y) * scaleY;
    const maxYRatio = timerConfig?.maxYRatio ?? 0.4;
    const timerTextScale = clampTextScale(timerConfig?.textScale);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = UIText.getFont('caption', scaleX * timerTextScale, 'bold');
    ctx.fillStyle = snap.phase === 'primary'
      ? QUESTION_ANSWER_TIME_TOKENS.primaryColor
      : QUESTION_ANSWER_TIME_TOKENS.extensionColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, Math.min(y, h * maxYRatio));
    ctx.restore();
  }
}
