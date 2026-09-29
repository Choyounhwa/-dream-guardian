import { describe, it, expect, vi } from 'vitest';
import { QuestionRenderer, type QuestionRenderState } from '../../src/render/QuestionRenderer.js';
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
});
