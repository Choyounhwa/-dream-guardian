/**
 * question-approach-renderer.test.ts - 문제 출제 첫 2박 원근 접근(소실점 → 정면) 렌더러 단위 테스트
 *
 * @see Issue #212 [RENDER-QUESTION-APPROACH-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  QuestionApproachRenderer,
  type QuestionApproachState,
} from '../../src/render/QuestionApproachRenderer.js';
import {
  DEFAULT_QUESTION_APPROACH_CONFIG,
  type QuestionApproachConfig,
} from '../../config/beat-motion.config.js';
import { BeatHUDRenderer } from '../../src/render/BeatHUDRenderer.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createReadyCoordinator(): BeatRunCoordinator {
  const qBank = new QuestionBank();
  qBank.loadRecords([
    {
      level: 1,
      subLevel: 1,
      levelTitle: '덧셈',
      subLevelTitle: '기초',
      questionTemplate: '3 + 5 = [ ? ]',
      answerEval: '8',
      wrongEval: '9',
      varA: '3',
      varB: '5',
      varC: '',
      varD: '',
      shapeCode: '',
    },
  ]);
  const coordinator = new BeatRunCoordinator({ questionBank: qBank });
  return coordinator;
}

describe('QuestionApproachRenderer (Issue #212 - RENDER-QUESTION-APPROACH-001)', () => {
  let renderer: QuestionApproachRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    renderer = new QuestionApproachRenderer();
    ctx = createMockContext();
  });

  describe('1. 원근 투영 변환 수치 계산 (computeTransform)', () => {
    const targetX = 540;
    const targetY = 480;
    const vanishingX = 540;
    const vanishingY = 200;

    it('진행도 t=0일 때 소실점 위치, minScale, startAlpha를 반환한다', () => {
      const t = renderer.computeTransform(0, targetX, targetY, vanishingX, vanishingY);
      expect(t.x).toBeCloseTo(vanishingX, 4);
      expect(t.y).toBeCloseTo(vanishingY, 4);
      expect(t.scale).toBeCloseTo(DEFAULT_QUESTION_APPROACH_CONFIG.minScale, 4);
      expect(t.alpha).toBeCloseTo(DEFAULT_QUESTION_APPROACH_CONFIG.startAlpha, 4);
      expect(t.easedProgress).toBeCloseTo(0, 4);
    });

    it('진행도 t=0.5일 때 ease-out 커브를 적용하여 감속 접근 보간을 수행한다', () => {
      // easePower = 2 -> eased = 1 - (1 - 0.5)^2 = 0.75
      const t = renderer.computeTransform(0.5, targetX, targetY, vanishingX, vanishingY);
      expect(t.easedProgress).toBeCloseTo(0.75, 4);
      expect(t.x).toBeCloseTo(vanishingX + (targetX - vanishingX) * 0.75, 4);
      expect(t.y).toBeCloseTo(vanishingY + (targetY - vanishingY) * 0.75, 4);
      expect(t.scale).toBeCloseTo(0.15 + (1.0 - 0.15) * 0.75, 4);
      expect(t.alpha).toBeCloseTo(0.10 + (1.0 - 0.10) * 0.75, 4);
    });

    it('진행도 t=1.0일 때 목표 정면 위치, scale=1.0, alpha=1.0을 반환한다', () => {
      const t = renderer.computeTransform(1.0, targetX, targetY, vanishingX, vanishingY);
      expect(t.x).toBe(targetX);
      expect(t.y).toBe(targetY);
      expect(t.scale).toBe(1.0);
      expect(t.alpha).toBe(1.0);
      expect(t.easedProgress).toBe(1.0);
    });

    it('진행도 t > 1.0(이후 6박 고정 구간)일 때 1.0 상태를 엄격히 유지한다', () => {
      const t = renderer.computeTransform(2.5, targetX, targetY, vanishingX, vanishingY);
      expect(t.x).toBe(targetX);
      expect(t.y).toBe(targetY);
      expect(t.scale).toBe(1.0);
      expect(t.alpha).toBe(1.0);
    });

    it('음수 진행도 t < 0일 때 0.0 상태로 클램핑된다', () => {
      const t = renderer.computeTransform(-0.5, targetX, targetY, vanishingX, vanishingY);
      expect(t.scale).toBeCloseTo(DEFAULT_QUESTION_APPROACH_CONFIG.minScale, 4);
      expect(t.alpha).toBeCloseTo(DEFAULT_QUESTION_APPROACH_CONFIG.startAlpha, 4);
    });

    it('커스텀 설정을 주입하여 스케일 및 커브를 조정할 수 있다', () => {
      const customConfig: QuestionApproachConfig = {
        approachBeats: 3,
        minScale: 0.3,
        startAlpha: 0.2,
        easePower: 3.0,
      };
      const customRenderer = new QuestionApproachRenderer(customConfig);
      const t = customRenderer.computeTransform(0.5, targetX, targetY, vanishingX, vanishingY);
      // eased = 1 - (1 - 0.5)^3 = 0.875
      expect(t.easedProgress).toBeCloseTo(0.875, 4);
      expect(t.scale).toBeCloseTo(0.3 + (1.0 - 0.3) * 0.875, 4);
      expect(t.alpha).toBeCloseTo(0.2 + (1.0 - 0.2) * 0.875, 4);
    });
  });

  describe('2. 캔버스 렌더링 동작 (render)', () => {
    it('t=1.0일 때 translate/scale 없이 정면 고정 렌더링을 직접 호출한다 (기존 픽셀 동일성 보장)', () => {
      const state: QuestionApproachState = {
        progress: 1.0,
        vanishingX: 540,
        vanishingY: 200,
      };

      renderer.render(ctx, '3 + 5 = ?', 540, 480, 1.0, state, true);

      // t=1.0일 때는 ctx.translate나 ctx.scale을 통한 변환 왜곡을 적용하지 않음
      expect(ctx.translate).not.toHaveBeenCalled();
      expect(ctx.scale).not.toHaveBeenCalled();
    });

    it('t < 1.0일 때 translate, scale 및 alpha 변환을 적용하여 렌더링한다', () => {
      const state: QuestionApproachState = {
        progress: 0.4,
        vanishingX: 540,
        vanishingY: 200,
      };

      renderer.render(ctx, '3 + 5 = ?', 540, 480, 1.0, state, true);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.translate).toHaveBeenCalled();
      expect(ctx.scale).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.globalAlpha).toBeGreaterThan(0);
      expect(ctx.globalAlpha).toBeLessThan(1.0);
    });
  });

  describe('3. BeatRunCoordinator 접근 진행도 (questionApproachProgress)', () => {
    it('RUN_QUESTION 시작 시 진행도가 0이며 시간에 따라 2박(1.0s) 동안 1.0까지 증가한다', () => {
      const coordinator = createReadyCoordinator();
      coordinator.startRound();

      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.questionApproachProgress).toBe(0);

      // 1박(0.5s) 경과 시 약 0.5
      coordinator.update(0.5);
      expect(coordinator.questionApproachProgress).toBeCloseTo(0.5, 2);

      // 2박(1.0s) 경과 시 1.0 도달
      coordinator.update(0.5);
      expect(coordinator.questionApproachProgress).toBe(1.0);

      // 이후 시간 경과해도 1.0 유지
      coordinator.update(1.0);
      expect(coordinator.questionApproachProgress).toBe(1.0);
    });

    it('스텝 입력을 통해 박자가 진행되어도 2박 완료 시 1.0에 도달한다', () => {
      const coordinator = createReadyCoordinator();
      coordinator.startRound();

      coordinator.recordStep();
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.questionApproachProgress).toBeGreaterThanOrEqual(0.5);

      coordinator.recordStep();
      expect(coordinator.completedExerciseBeats).toBe(2);
      expect(coordinator.questionApproachProgress).toBe(1.0);
    });

    it('RUN_QUESTION 페이즈가 아닐 때는 항상 1.0을 반환한다', () => {
      const coordinator = createReadyCoordinator();
      coordinator.startRound();
      coordinator.triggerFallbackAdvance(); // 8박 스텝 완료 -> ANSWER_SELECT
      expect(coordinator.questionApproachProgress).toBe(1.0);
    });
  });

  describe('4. BeatHUDRenderer 통합 연동', () => {
    it('BeatHUDRenderer가 questionApproachProgress를 수신하여 에러 없이 렌더링한다', () => {
      const hudRenderer = new BeatHUDRenderer();
      expect(() => {
        hudRenderer.render(ctx, 1080, 2160, {
          question: {
            questionText: '7 × 8 = ?',
            correctAnswer: 56,
            wrongAnswer: 48,
            choices: [56, 48],
            correctIndex: 0,
          },
          totalSteps: 10,
          completedExerciseBeats: 1,
          locomotionMode: 'run',
          activeHazardPattern: 'jump',
          hazardBeatProgress: 0,
          questionApproachProgress: 0.5,
          vanishingX: 540,
          vanishingY: 2160 * 0.24,
        });
      }).not.toThrow();
    });
  });
});
