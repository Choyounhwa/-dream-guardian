import { describe, it, expect, vi } from 'vitest';
import { AssaultLoopRoundAssembler } from '../../src/core/AssaultLoopRoundAssembler.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { AssaultSceneRenderer } from '../../src/render/AssaultSceneRenderer.js';
import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../config/assault-loop.config.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { defaultNumericRepeatSource } from '../../src/core/AssaultSessionFactory.js';
import { createTestQuestionCandidate } from '../helpers/question-factory.js';
import type { SessionId, RoundId } from '../../src/types/assault.js';
import { buildAssaultLoopPlan } from '../../src/game/assault/AssaultLoopPlanBuilder.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text?: string) => ({ width: (text?.length ?? 0) * 12 })),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1.0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    canvas: { width: 1280, height: 720 },
  } as any;
}

describe('Assault Loop Question Normalization & Presentation Acceptance', () => {
  it('1. AssaultLoopRoundAssembler: questionText만 가진 QuestionCandidate 전달 시 question.text 및 presentation.questionText가 올바르게 보존된다', () => {
    const candidate = createTestQuestionCandidate({
      id: 'q_norm_test_01',
      questionText: '25 + 17 = ?',
      correctAnswer: 42,
    });
    // text 필드가 없는 실데이터 상태 확인
    expect((candidate as any).text).toBeUndefined();

    const assembler = new AssaultLoopRoundAssembler({
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      baseSeed: 12345,
      bpm: 120,
      roundSource: defaultNumericRepeatSource,
    } as any);

    const rc = assembler.createRoundController('round_01' as RoundId, candidate as any);

    // 1-1. roundController.question.text 검증
    expect(rc.question.text).toBe('25 + 17 = ?');
    expect(rc.questionText).toBe('25 + 17 = ?');

    // 1-2. presentation snapshot questionText 검증
    const presentation = rc.getPresentationSnapshot();
    expect(presentation.questionText).toBe('25 + 17 = ?');
  });

  it('2. AssaultRoundController: questionText만 있는 객체 직접 전달 시에도 text가 정상 추출된다', () => {
    const candidate = createTestQuestionCandidate({
      id: 'q_direct_01',
      questionText: '50 - 18 = ?',
    });

    const plan = buildAssaultLoopPlan({ seed: 12345, roundNumber: 1 });

    const rc = new AssaultRoundController({
      sessionId: 'sess_norm_01' as SessionId,
      roundId: 'round_01' as RoundId,
      question: candidate as any,
      loopPlan: plan,
      bpm: 120,
      config: DEFAULT_ASSAULT_CONFIG,
    });

    expect(rc.question.text).toBe('50 - 18 = ?');
    expect(rc.questionText).toBe('50 - 18 = ?');
    expect(rc.getPresentationSnapshot().questionText).toBe('50 - 18 = ?');
  });

  it('3. Renderer Spy: run_question 구간에서 AssaultSceneRenderer가 문제 수식을 빈 문자열 없이 렌더링한다', () => {
    const candidate = createTestQuestionCandidate({
      questionText: '9 × 7 = ?',
      correctAnswer: 63,
    });

    const assembler = new AssaultLoopRoundAssembler({
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      baseSeed: 12345,
      bpm: 120,
      roundSource: defaultNumericRepeatSource,
    } as any);

    const rc = assembler.createRoundController('round_01' as RoundId, candidate as any);
    const snapshot = rc.getPresentationSnapshot();

    const renderer = new AssaultSceneRenderer();
    const mockCtx = createMockContext();

    renderer.render(mockCtx, snapshot as any, { width: 1280, height: 720 });

    // fillText 호출 중 수식 토큰들('9 ', '×', ' 7 ', '=', ' ?')과 러닝 안내 문구가 전달되었는지 검증 (빈 문자열 차단)
    const calls = (mockCtx.fillText as any).mock.calls;
    const renderedTexts = calls.map((call: any[]) => call[0]);
    const fullRendered = renderedTexts.join('');
    expect(fullRendered).toContain('9');
    expect(fullRendered).toContain('×');
    expect(fullRendered).toContain('7');
    expect(renderedTexts).toContain('문제를 읽으며 달리세요');
  });
});
