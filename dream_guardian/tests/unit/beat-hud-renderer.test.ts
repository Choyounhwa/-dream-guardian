import { describe, it, expect, vi } from 'vitest';
import { BeatHUDRenderer, type BeatHUDState } from '../../src/render/BeatHUDRenderer.js';
import { BEAT_HUD_CONFIG } from '../../config/locomotion.config.js';
import type { GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
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
  questionText: '3 + 5',
  choices: [8, 9],
  correctAnswer: 8,
  wrongAnswer: 9,
  correctIndex: 0,
};

describe('BeatHUDRenderer & BEAT_HUD_CONFIG (Issue #209 / REFACTOR-RENDER-001)', () => {
  it('BEAT_HUD_CONFIG 설정 상수가 올바르게 정의되어 있다', () => {
    expect(BEAT_HUD_CONFIG.TOTAL_BEATS).toBe(8);
    expect(BEAT_HUD_CONFIG.COLOR_SPLIT_BEAT).toBe(5);
    expect(BEAT_HUD_CONFIG.COLOR_EARLY).toBe('#FFCB4D');
    expect(BEAT_HUD_CONFIG.COLOR_LATE).toBe('#28E6FF');
    expect(BEAT_HUD_CONFIG.DOT_RADIUS).toBe(14);
    expect(BEAT_HUD_CONFIG.DOT_GAP).toBe(44);
  });

  it('기본 상태로 렌더링 시 오류 없이 실행되고 타이틀 및 걸음 수를 그린다', () => {
    const renderer = new BeatHUDRenderer();
    const ctx = createMockCtx();
    const state: BeatHUDState = {
      question: mockQuestion,
      totalSteps: 12,
      locomotionMode: 'run',
      activeHazardPattern: 'jump',
      hazardBeatProgress: 0.5,
    };

    expect(() => renderer.render(ctx, 1080, 2160, state)).not.toThrow();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it('activeHazardPattern이 null일 때 완료 안내 메시지를 출력한다', () => {
    const renderer = new BeatHUDRenderer();
    const ctx = createMockCtx();
    const state: BeatHUDState = {
      question: mockQuestion,
      totalSteps: 8,
      locomotionMode: 'run',
      activeHazardPattern: null,
      hazardBeatProgress: 0,
    };

    renderer.render(ctx, 1080, 2160, state);
    const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
    expect(textCalls.some((t: string) => t.includes('장판 루틴 완료') || t.includes('완료'))).toBe(true);
  });

  it('showBeatDots=true 옵션 시 8박 원형 인디케이터가 렌더링된다', () => {
    const renderer = new BeatHUDRenderer({ showBeatDots: true });
    const ctx = createMockCtx();
    const state: BeatHUDState = {
      question: mockQuestion,
      completedExerciseBeats: 4,
      totalSteps: 4,
      locomotionMode: 'run',
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.arc).toHaveBeenCalled();
  });
});
