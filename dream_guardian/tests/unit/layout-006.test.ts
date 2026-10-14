/**
 * [LAYOUT-006] (Issue #573) 문제·정답 버튼 화면 레이아웃 설정 이전 (존 4/5 잠금, +글자 textScale)
 *
 * 1. 기본값 특성화 (Characterization):
 *    - 기본 해상도(1080x2160)에서 QuestionRenderer 및 getAnswerButtonLayouts의 각 영역 bounds가 UI_LAYOUT.question과 100% 일치.
 *    - 기존 계산식 대비 오차 0px 정합성 보장.
 * 2. UI_LAYOUT.question 실시간 변경 반영 (캐싱 금지):
 *    - board (x, y, w, h, shapeW, shapeH, textOffsetY 등), panel (w, h, cy, vanishingY), answerButtons (height, gapY), timer (y) 실시간 반영.
 * 3. textScale (0.5~3.0) 적용:
 *    - board.textScale, answerButtons.textScale, badgeTextScale, hintTextScale, waitingTextScale, timer.textScale 비례 조절 및 clamping.
 * 4. 판정 연동 좌표 원자적 잠금 (Zone 4/5 보호):
 *    - 정답 버튼의 x, width 및 기본 기준 좌표는 Zone 4/5에 고정(잠금), 슬롯 락 보존.
 * 5. PresentationContext 오버라이드 최우선 순위 유지:
 *    - setPresentationContext 주입 시 UI_LAYOUT보다 우선 반영.
 * 6. DEVUI / UILayoutOverride 규칙 검증:
 *    - getLayoutKeyRule 검증 (textScale은 0.5~3.0 step 0.01, 좌표/크기는 integer).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QuestionRenderer,
  type QuestionRenderState,
} from '../../src/render/QuestionRenderer.js';
import { UI_LAYOUT, QUESTION_ANSWER_TIME_TOKENS } from '../../config/ui.config.js';
import { getAnswerButtonLayouts, DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import { resetLayoutTo, snapshotLayout } from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride, getLayoutKeyRule } from '../../src/core/UILayoutOverride.js';

const pristine = snapshotLayout(UI_LAYOUT);

function createMockCtx() {
  const fontsSet: string[] = [];
  const filledTexts: Array<{ text: string; x: number; y: number; font: string }> = [];
  let _font = '';

  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text: String(text), x, y, font: _font });
    }),
    drawImage: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
    setLineDash: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillStyle: '#FFFFFF',
    strokeStyle: '#FFFFFF',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    get font(): string {
      return _font;
    },
    set font(val: string) {
      _font = val;
      fontsSet.push(val);
    },
  };

  return { ctx: ctx as unknown as CanvasRenderingContext2D, fontsSet, filledTexts };
}

const baseQuestionState: QuestionRenderState = {
  question: {
    questionText: '3 + 4 = [ ? ]',
    choices: ['7', '8'],
    correctAnswer: '7',
    wrongAnswer: '8',
    correctIndex: 0,
  },
  questionVisible: true,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
};

describe('[LAYOUT-006] (Issue #573) 문제·정답 버튼 화면 레이아웃 설정 이전', () => {
  let renderer: QuestionRenderer;

  beforeEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
    renderer = new QuestionRenderer();
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  describe('1. 기본값 특성화 (Characterization)', () => {
    it('UI_LAYOUT.question 슬롯이 정의되어 있고 기본값을 갖는다', () => {
      expect((UI_LAYOUT as any).question).toBeDefined();
      const q = (UI_LAYOUT as any).question;
      expect(q.board).toBeDefined();
      expect(q.board.y).toBe(320);
      expect(q.board.w).toBe(880);
      expect(q.board.h).toBe(280);
      expect(q.board.shapeW).toBe(760);
      expect(q.board.shapeH).toBe(200);
      expect(q.board.shapeOffsetY).toBe(-30);
      expect(q.board.textOffsetY).toBe(220);
      expect(q.board.shapeTextOffsetY).toBe(70);
      expect(q.board.textScale).toBe(1.0);

      expect(q.panel).toBeDefined();
      expect(q.panel.w).toBe(480);
      expect(q.panel.h).toBe(340);
      expect(q.panel.cy).toBe(650);
      expect(q.panel.vanishingY).toBeCloseTo(518.4, 1);

      expect(q.answerButtons).toBeDefined();
      expect(q.answerButtons.height).toBe(250);
      expect(q.answerButtons.gapY).toBe(26);
      expect(q.answerButtons.textScale).toBe(1.0);
      expect(q.answerButtons.badgeTextScale).toBe(1.0);
      expect(q.answerButtons.hintTextScale).toBe(1.0);
      expect(q.answerButtons.waitingTextScale).toBe(1.0);

      expect(q.timer).toBeDefined();
      expect(q.timer.y).toBe(860);
      expect(q.timer.maxYRatio).toBe(0.4);
      expect(q.timer.textScale).toBe(1.0);
    });

    it('기본 해상도(1080x2160)에서 getQuestionBounds가 기존 스펙과 100% 일치한다 (오차 0px)', () => {
      const normalBounds = renderer.getQuestionBounds(1080, 2160);
      expect(normalBounds.x).toBe(100);
      expect(normalBounds.y).toBe(320);
      expect(normalBounds.w).toBe(880);
      expect(normalBounds.h).toBe(280);
      expect(normalBounds.isProtected).toBe(false);

      const shapeBounds = renderer.getQuestionBounds(1080, 2160, { hasShape: true });
      expect(shapeBounds.x).toBe(160);
      expect(shapeBounds.y).toBe(290); // 320 - 30
      expect(shapeBounds.w).toBe(760);
      expect(shapeBounds.h).toBe(200);
      expect(shapeBounds.isProtected).toBe(false);
    });

    it('getAnswerButtonLayouts(1080, 2160) 기본 출력이 기존 스펙(X 43/756, Y 890, W 281, H 250)과 100% 일치한다', () => {
      const [b0, b1] = getAnswerButtonLayouts(1080, 2160);
      expect(b0.x).toBe(43);
      expect(b0.y).toBe(890);
      expect(b0.width).toBe(281);
      expect(b0.height).toBe(250);
      expect(b0.centerX).toBe(183.5);

      expect(b1.x).toBe(756);
      expect(b1.y).toBe(890);
      expect(b1.width).toBe(281);
      expect(b1.height).toBe(250);
      expect(b1.centerX).toBe(896.5);
    });

    it('getChoiceButtonBounds(1080, 2160)가 getAnswerButtonLayouts와 일치하고 isProtected=true를 보존한다', () => {
      const c0 = renderer.getChoiceButtonBounds(0, 1080, 2160);
      expect(c0.x).toBe(43);
      expect(c0.y).toBe(890);
      expect(c0.w).toBe(281);
      expect(c0.h).toBe(250);
      expect(c0.isProtected).toBe(true);

      const c1 = renderer.getChoiceButtonBounds(1, 1080, 2160);
      expect(c1.x).toBe(756);
      expect(c1.y).toBe(890);
      expect(c1.w).toBe(281);
      expect(c1.h).toBe(250);
      expect(c1.isProtected).toBe(true);
    });

    it('QUESTION_ANSWER_TIME_TOKENS.y가 UI_LAYOUT.question.timer.y와 동기화된다', () => {
      expect(QUESTION_ANSWER_TIME_TOKENS.y).toBe((UI_LAYOUT as any).question.timer.y);
      expect(QUESTION_ANSWER_TIME_TOKENS.y).toBe(860);
    });
  });

  describe('2. UI_LAYOUT.question 실시간 변경 반영 (캐싱 금지)', () => {
    it('UI_LAYOUT.question.board.y 변경 시 getQuestionBounds에 즉시 반영된다', () => {
      (UI_LAYOUT as any).question.board.y = 400;
      const bounds = renderer.getQuestionBounds(1080, 2160);
      expect(bounds.y).toBe(400);

      const shapeBounds = renderer.getQuestionBounds(1080, 2160, { hasShape: true });
      expect(shapeBounds.y).toBe(370); // 400 - 30
    });

    it('UI_LAYOUT.question.board.w, h, shapeW, shapeH 변경 시 getQuestionBounds 크기 및 x가 즉시 반영된다', () => {
      (UI_LAYOUT as any).question.board.x = 90;
      (UI_LAYOUT as any).question.board.w = 900;
      (UI_LAYOUT as any).question.board.h = 300;
      (UI_LAYOUT as any).question.board.shapeW = 700;
      (UI_LAYOUT as any).question.board.shapeH = 180;

      const normalBounds = renderer.getQuestionBounds(1080, 2160);
      expect(normalBounds.w).toBe(900);
      expect(normalBounds.h).toBe(300);
      expect(normalBounds.x).toBe(90);

      const shapeBounds = renderer.getQuestionBounds(1080, 2160, { hasShape: true });
      expect(shapeBounds.w).toBe(700);
      expect(shapeBounds.h).toBe(180);
      expect(shapeBounds.x).toBe((1080 - 700) / 2);
    });

    it('UI_LAYOUT.question.answerButtons.height 및 gapY 변경 시 getAnswerButtonLayouts와 getChoiceButtonBounds에 즉시 반영된다', () => {
      (UI_LAYOUT as any).question.answerButtons.height = 300;
      (UI_LAYOUT as any).question.answerButtons.gapY = 40;

      const [b0, b1] = getAnswerButtonLayouts(1080, 2160);
      // y = (0.24 + 0.16) * 2160 + 40 = 864 + 40 = 904
      expect(b0.height).toBe(300);
      expect(b0.y).toBe(904);
      expect(b1.height).toBe(300);
      expect(b1.y).toBe(904);

      const c0 = renderer.getChoiceButtonBounds(0, 1080, 2160);
      expect(c0.h).toBe(300);
      expect(c0.y).toBe(904);
    });

    it('UI_LAYOUT.question.timer.y 변경 시 QUESTION_ANSWER_TIME_TOKENS.y와 렌더링에 즉시 반영된다', () => {
      (UI_LAYOUT as any).question.timer.y = 750;
      expect(QUESTION_ANSWER_TIME_TOKENS.y).toBe(750);

      const { ctx, filledTexts } = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseQuestionState,
        showAnswerTime: true,
        answerTime: {
          phase: 'primary',
          primaryBeats: 4,
          extensionBeats: 2,
          maxBeats: 6,
          elapsedBeats: 1,
          remainingBeats: 3,
          inputOpen: true,
        },
      });

      const timerText = filledTexts.find((t) => t.text.includes('3박 남음'));
      expect(timerText).toBeDefined();
      expect(timerText!.y).toBe(750);
    });
  });

  describe('3. textScale (0.5~3.0) 배율 적용', () => {
    it('board.textScale 변경 시 상단 문제 수식 폰트 크기가 비례하여 조절된다', () => {
      const { ctx: ctx1, fontsSet: fonts1 } = createMockCtx();
      renderer.render(ctx1, 1080, 2160, baseQuestionState);
      const mathFont1 = fonts1.find((f) => f.includes('px') && f.includes('bold'));
      const size1 = parseFloat(mathFont1?.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0');

      (UI_LAYOUT as any).question.board.textScale = 1.5;
      const { ctx: ctx2, fontsSet: fonts2 } = createMockCtx();
      renderer.render(ctx2, 1080, 2160, baseQuestionState);
      const mathFont2 = fonts2.find((f) => f.includes('px') && f.includes('bold'));
      const size2 = parseFloat(mathFont2?.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0');

      expect(size2).toBeGreaterThan(size1);
      expect(size2 / size1).toBeCloseTo(1.5, 1);
    });

    it('answerButtons.textScale 변경 시 정답 버튼 수식 폰트 크기가 비례하여 조절된다', () => {
      const { ctx: ctx1 } = createMockCtx();
      renderer.render(ctx1, 1080, 2160, baseQuestionState);

      (UI_LAYOUT as any).question.answerButtons.textScale = 1.3;
      const { ctx: ctx2, fontsSet: fonts2 } = createMockCtx();
      renderer.render(ctx2, 1080, 2160, baseQuestionState);

      const maxChoiceFont = Math.max(...fonts2.map((f) => parseFloat(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0')));
      expect(maxChoiceFont).toBeCloseTo(124.8, 1);
    });

    it('answerButtons.badgeTextScale 변경 시 선택 완료 뱃지 폰트 크기가 비례하여 조절된다', () => {
      const selectedState: QuestionRenderState = {
        ...baseQuestionState,
        selectedChoiceIndex: 0,
      };

      (UI_LAYOUT as any).question.answerButtons.badgeTextScale = 1.4;
      const { ctx, fontsSet } = createMockCtx();
      renderer.render(ctx, 1080, 2160, selectedState);

      // badge base is 24px; with scale 1.4 -> 33.6px (~34px)
      const badgeFonts = fontsSet.map((f) => parseFloat(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0'));
      expect(badgeFonts.some((sz) => Math.abs(sz - 33.6) < 1.0)).toBe(true);
    });

    it('answerButtons.hintTextScale 변경 시 키보드 힌트 폰트 크기가 비례하여 조절된다', () => {
      (UI_LAYOUT as any).question.answerButtons.hintTextScale = 1.5;
      const { ctx, fontsSet } = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseQuestionState,
        answerApproachProgress: 1.0,
        answerSelectable: true,
      });

      // badge base is 24px; scaled by 1.5 -> 36px
      expect(fontsSet.some((f) => f.includes('36px'))).toBe(true);
    });

    it('answerButtons.waitingTextScale 변경 시 대기 문구 폰트 크기가 비례하여 조절된다', () => {
      (UI_LAYOUT as any).question.answerButtons.waitingTextScale = 1.6;
      const { ctx, fontsSet } = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseQuestionState,
        answerSelectable: false,
      });

      // badge base is 24px; scaled by 1.6 -> 38.4px (or 38px)
      expect(fontsSet.some((f) => f.includes(`${Math.round(24 * 1.6)}px`))).toBe(true);
    });

    it('timer.textScale 변경 시 타이머 폰트 크기가 비례하여 조절된다', () => {
      (UI_LAYOUT as any).question.timer.textScale = 1.5;
      const { ctx, fontsSet } = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseQuestionState,
        showAnswerTime: true,
        answerTime: {
          phase: 'primary',
          primaryBeats: 4,
          extensionBeats: 2,
          maxBeats: 6,
          elapsedBeats: 1,
          remainingBeats: 3,
          inputOpen: true,
        },
      });

      expect(fontsSet.some((f) => f.includes(`${Math.round(20 * 1.5)}px`) || f.includes(`${Math.round(32 * 1.5)}px`))).toBe(true);
    });

    it('textScale 값은 0.5~3.0 범위로 clamp 된다 (범위 밖 값 및 NaN 방어)', () => {
      (UI_LAYOUT as any).question.board.textScale = 0.1; // clamped to 0.5
      const { ctx: ctxLow, fontsSet: fontsLow } = createMockCtx();
      renderer.render(ctxLow, 1080, 2160, baseQuestionState);
      const mathFontLow = fontsLow.find((f) => f.includes('px') && f.includes('bold'));
      const sizeLow = parseFloat(mathFontLow?.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0');

      (UI_LAYOUT as any).question.board.textScale = 0.5;
      const { ctx: ctxHalf, fontsSet: fontsHalf } = createMockCtx();
      renderer.render(ctxHalf, 1080, 2160, baseQuestionState);
      const mathFontHalf = fontsHalf.find((f) => f.includes('px') && f.includes('bold'));
      const sizeHalf = parseFloat(mathFontHalf?.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0');

      expect(sizeLow).toBeCloseTo(sizeHalf, 1);
    });
  });

  describe('4. 판정 연동 좌표 원자적 잠금 (Zone 4/5 보호)', () => {
    it('답안 버튼의 X 좌표 및 너비는 Zone 4/5의 DEFAULT_FITNESS_ZONES에 종속되어 불변한다', () => {
      const z4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const z5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

      const [b0, b1] = getAnswerButtonLayouts(1080, 2160);
      expect(b0.x).toBe(Math.round(z4.x * 1080));
      expect(b0.width).toBe(Math.round(z4.width * 1080));
      expect(b1.x).toBe(Math.round(z5.x * 1080));
      expect(b1.width).toBe(Math.round(z5.width * 1080));
    });

    it('choice_0, choice_1 슬롯 락 및 락 사유가 온전하게 보존된다', () => {
      expect(renderer.isSlotLocked('choice_0')).toBe(true);
      expect(renderer.isSlotLocked('choice_1')).toBe(true);
      expect(renderer.isSlotLocked('header')).toBe(false);

      const reason = renderer.getSlotLockReason('choice_0');
      expect(reason).toContain('Zone 4/5 모션 인터랙션 핵심 보호 영역');
    });

    it('validatePresentationContext에서 choice_0, choice_1 기하 변조를 차단한다', () => {
      const result = renderer.validatePresentationContext({
        choice0: { x: 50, y: 890, w: 281, h: 250 },
      });
      expect(result.valid).toBe(false);
      expect(result.lockedSlots).toContain('choice_0');
    });
  });

  describe('5. PresentationContext 오버라이드 최우선 순위 유지', () => {
    it('setPresentationContext로 주입된 header 좌표/크기가 UI_LAYOUT보다 우선한다', () => {
      renderer.setPresentationContext({
        header: { x: 120, y: 400, w: 840, h: 260 },
      });

      const bounds = renderer.getQuestionBounds(1080, 2160);
      expect(bounds.x).toBe(120);
      expect(bounds.y).toBe(400);
      expect(bounds.w).toBe(840);
      expect(bounds.h).toBe(260);
    });

    it('setPresentationContext로 주입된 choice0.fontSize가 UI_LAYOUT.textScale보다 우선한다', () => {
      renderer.setPresentationContext({
        choice0: { fontSize: 40 },
      });

      (UI_LAYOUT as any).question.answerButtons.textScale = 2.0;
      const { ctx, fontsSet } = createMockCtx();
      renderer.render(ctx, 1080, 2160, baseQuestionState);

      // choice0 should use 40px font override rather than 96 * 2.0
      expect(fontsSet.some((f) => f.includes('40px'))).toBe(true);
    });
  });

  describe('6. DEVUI / UILayoutOverride 규칙 및 깊은 병합 검증', () => {
    it('question 하위 textScale 키의 getLayoutKeyRule이 0.5~3.0 step 0.01로 검증된다', () => {
      const ruleBoard = getLayoutKeyRule('question.board.textScale');
      expect(ruleBoard.min).toBe(0.5);
      expect(ruleBoard.max).toBe(3.0);
      expect(ruleBoard.step).toBe(0.01);
      expect(ruleBoard.integer).toBe(false);

      const ruleBtn = getLayoutKeyRule('question.answerButtons.textScale');
      expect(ruleBtn.min).toBe(0.5);
      expect(ruleBtn.max).toBe(3.0);
      expect(ruleBtn.step).toBe(0.01);
      expect(ruleBtn.integer).toBe(false);
    });

    it('question 하위 좌표 및 크기 키의 getLayoutKeyRule이 정상 범위로 검증된다', () => {
      const ruleY = getLayoutKeyRule('question.board.y');
      expect(ruleY.min).toBe(0);
      expect(ruleY.max).toBe(2160);
      expect(ruleY.integer).toBe(true);

      const ruleHeight = getLayoutKeyRule('question.answerButtons.height');
      expect(ruleHeight.min).toBe(1);
      expect(ruleHeight.max).toBe(2160);
      expect(ruleHeight.integer).toBe(true);
    });

    it('applyLayoutOverride를 통해 question 슬롯의 값이 정상적으로 깊은 병합된다', () => {
      const patch = {
        question: {
          board: {
            y: 350,
            textScale: 1.25,
          },
          answerButtons: {
            height: 270,
          },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.warnings).toEqual([]);
      expect(result.applied).toContain('question.board.y');
      expect(result.applied).toContain('question.board.textScale');
      expect(result.applied).toContain('question.answerButtons.height');

      expect((UI_LAYOUT as any).question.board.y).toBe(350);
      expect((UI_LAYOUT as any).question.board.textScale).toBe(1.25);
      expect((UI_LAYOUT as any).question.answerButtons.height).toBe(270);
    });
  });
});
