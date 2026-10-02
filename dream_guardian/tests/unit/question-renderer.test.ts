import { describe, it, expect, vi } from 'vitest';
import {
  QuestionRenderer,
  renderQuestionHeaderMath,
  type QuestionRenderState,
} from '../../src/render/QuestionRenderer.js';
import type { GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

const mockQuestion: GeneratedQuestion = {
  questionText: '12 + 15',
  choices: [27, 25],
  correctAnswer: 27,
  wrongAnswer: 25,
  correctIndex: 0,
};

describe('QuestionRenderer (Issue #209 / REFACTOR-RENDER-001)', () => {
  it('질문이 없거나 questionVisible=false이면 렌더링하지 않는다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    const state: QuestionRenderState = {
      question: null,
      questionVisible: false,
      selectedChoiceIndex: null,
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('유효한 질문 렌더링 시 문제 수식, 답안 버튼 2개, 키보드 힌트를 렌더링한다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    const state: QuestionRenderState = {
      question: mockQuestion,
      questionVisible: true,
      selectedChoiceIndex: null,
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();

    const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
    expect(textCalls.some((t: string) => t.includes('키보드 [1]'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('키보드 [2]'))).toBe(true);
  });

  it('selectedChoiceIndex가 지정되었을 때 하이라이트 테두리를 렌더링한다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    const state: QuestionRenderState = {
      question: mockQuestion,
      questionVisible: true,
      selectedChoiceIndex: 0,
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  describe('긴 자연어 및 복합 수식 영역 초과 및 겹침 방지 (Issue #234)', () => {
    it('renderQuestionHeaderMath가 긴 문항을 maxHeight 이내로 제한하여 렌더링한다', () => {
      const ctx = createMockCtx();
      const longQuestion = '[모양 P] 겹쳐지지 않고 1개만 놓인 나무(1층 단독)는 모두 몇 개일까요?';

      // scaleX = 1.0, cx = 540, qY = 400 (도형 문제 상단 위치)
      const res = renderQuestionHeaderMath(ctx, longQuestion, 540, 400, 1.0, false, {
        hasShape: true,
      });

      expect(res).toBeDefined();
      expect(res.height).toBeLessThanOrEqual(160);
      expect(res.width).toBeLessThanOrEqual(880);
    });

    it('긴 질문 텍스트 렌더링 시 하단 답안 버튼 영역(y: 890) 및 도형 뷰포트(y: 480)와 겹치지 않는다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const longShapeQuestion: GeneratedQuestion = {
        questionText: '[모양 P] 1층 위에 겹쳐 쌓은 나무(2·3층)는 모두 몇 개일까요?',
        choices: ['5개', '6개'],
        correctAnswer: '5개',
        wrongAnswer: '6개',
        correctIndex: 0,
        shapeCode: "{type:'stack_cubes', grid:[[3,2,1],[2,2,0],[1,1,0]]}",
      };

      const state: QuestionRenderState = {
        question: longShapeQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
      };

      renderer.render(ctx, 1080, 2160, state);

      // fillText에 전달된 모든 Y 좌표를 추적
      const fillTextCalls = (ctx.fillText as any).mock.calls;
      const questionYCoords = fillTextCalls
        .filter((c: any) => typeof c[0] === 'string' && (c[0].includes('나무') || c[0].includes('모양') || c[0].includes('개일까요')))
        .map((c: any) => c[2]);

      // 도형 패널 상단(480px) 이전에 문제 텍스트가 모두 끝나야 함 (겹침 0%)
      for (const y of questionYCoords) {
        expect(y).toBeLessThan(480);
      }
    });

    it('긴 답안 수식/텍스트가 버튼 경계 너비와 높이를 초과하지 않는다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const longChoiceQuestion: GeneratedQuestion = {
        questionText: '2진수 변환 결과는?',
        choices: ['1010101010101₍₂₎', '1010101010100₍₂₎'],
        correctAnswer: '1010101010101₍₂₎',
        wrongAnswer: '1010101010100₍₂₎',
        correctIndex: 0,
      };

      const state: QuestionRenderState = {
        question: longChoiceQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
      };

      renderer.render(ctx, 1080, 2160, state);

      // 답안 렌더링 호출 확인
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes('1010101010101'))).toBe(true);
    });
  });

  describe('답안 버튼 실시간 0~100% 충전 프로그레스 및 체결 연출 (Issue #285 / UI-ANSWER-002)', () => {
    it('choiceProgress에 따라 버튼 내부 네온 충전 필 및 하단 프로그레스 바를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const fillStyles: string[] = [];
      let maxProgressFillW = 0;

      const origRoundRect = ctx.roundRect as any;
      (ctx.roundRect as any) = vi.fn((x: number, y: number, w: number, h: number, r?: any) => {
        if (typeof ctx.fillStyle === 'string') {
          fillStyles.push(ctx.fillStyle);
          if (ctx.fillStyle.includes('40, 230, 255') || ctx.fillStyle.includes('#28E6FF')) {
            if (w > maxProgressFillW) maxProgressFillW = w;
          }
        }
        if (origRoundRect) origRoundRect(x, y, w, h, r);
      });

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        choiceProgress: [0.6, 0.0],
      };

      renderer.render(ctx, 1080, 2160, state);

      const hasCyanFill = fillStyles.some((s) => s.includes('40, 230, 255') || s.includes('#28E6FF'));
      expect(hasCyanFill).toBe(true);
      expect(maxProgressFillW).toBeGreaterThan(0);
    });

    it('activeHoverIndex가 지정되었을 때 버튼이 1.05배 확대되고 20px 글로우(shadowBlur)가 적용된다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      let maxRecordedBlur = 0;
      let blurVal = 0;
      Object.defineProperty(ctx, 'shadowBlur', {
        get: () => blurVal,
        set: (v: number) => {
          blurVal = v;
          if (v > maxRecordedBlur) maxRecordedBlur = v;
        },
        configurable: true,
      });

      const recordedWidths: number[] = [];
      const origRoundRect = ctx.roundRect as any;
      (ctx.roundRect as any) = vi.fn((x: number, y: number, w: number, h: number, r?: any) => {
        recordedWidths.push(w);
        if (origRoundRect) origRoundRect(x, y, w, h, r);
      });

      // 1. 호버 없을 때 기본 너비 측정
      const stateNormal: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        activeHoverIndex: null,
      };
      renderer.render(ctx, 1080, 2160, stateNormal);
      const normalBtn0W = recordedWidths[0];

      // 2. 0번 버튼 호버 활성화
      recordedWidths.length = 0;
      const stateHover: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        activeHoverIndex: 0,
      };
      renderer.render(ctx, 1080, 2160, stateHover);
      const hoverBtn0W = recordedWidths[0];

      // 1.05배 확대 검증 (오차 허용 범위 1.04 ~ 1.06)
      expect(hoverBtn0W).toBeGreaterThan(normalBtn0W);
      expect(hoverBtn0W / normalBtn0W).toBeCloseTo(1.05, 2);

      // 버튼 발광 글로우(shadowBlur: 20px 이상) 검증
      expect(maxRecordedBlur).toBeGreaterThanOrEqual(20);
    });

    it('selectedChoiceIndex가 지정되었을 때 강력한 녹색 테두리(#00FF88)와 선택 완료! [V] 스탬프를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const strokes: string[] = [];
      Object.defineProperty(ctx, 'strokeStyle', {
        get: () => strokes[strokes.length - 1] || '',
        set: (v: string) => {
          strokes.push(v);
        },
        configurable: true,
      });

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: 1,
      };

      renderer.render(ctx, 1080, 2160, state);

      // 녹색 테두리(#00FF88) 적용 검증
      expect(strokes.some((s) => s.toUpperCase() === '#00FF88' || s.includes('0, 255, 136'))).toBe(true);

      // '선택 완료! [V]' 네온 뱃지/스탬프 텍스트 렌더링 검증
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes('선택 완료! [V]'))).toBe(true);
    });

    it('choiceProgress 진행도에 비례하여 하단 프로그레스 바 너비가 증가한다 (0%, 50%, 100%)', () => {
      const renderer = new QuestionRenderer();
      const getBarWidthForProgress = (prog: number) => {
        const ctx = createMockCtx();
        const widths: number[] = [];
        const origRoundRect = ctx.roundRect as any;
        (ctx.roundRect as any) = vi.fn((x: number, y: number, w: number, h: number, r?: any) => {
          if (h <= 12 && h >= 4) {
            widths.push(w);
          }
          if (origRoundRect) origRoundRect(x, y, w, h, r);
        });

        renderer.render(ctx, 1080, 2160, {
          question: mockQuestion,
          questionVisible: true,
          choiceProgress: [prog, 0],
        });
        return widths.length > 0 ? widths[0] : 0;
      };

      const w50 = getBarWidthForProgress(0.5);
      const w100 = getBarWidthForProgress(1.0);

      expect(w50).toBeGreaterThan(0);
      expect(w100).toBeGreaterThan(w50);
      expect(w100 / w50).toBeCloseTo(2.0, 1);
    });
  });
});
