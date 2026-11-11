/**
 * assault-loop-render.test.ts - 루프 러닝·휴식 장면 공격 표시 억제 단위 테스트
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (ASSAULT-LOOP-14 / Issue #707)
 * @see docs/assault-loop/LOOP-14.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AssaultSceneRenderer,
  type AssaultSceneSnapshot,
} from '../../src/render/AssaultSceneRenderer.js';
import {
  AssaultPairPainter,
  type AssaultPairRenderSnapshot,
} from '../../src/render/AssaultPairPainter.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import type { AssaultLoopPresentation } from '../../src/types/assault-loop.js';

function createMockContext(): CanvasRenderingContext2D {
  let currentFont = '';

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
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1.0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    get font() {
      return currentFont;
    },
    set font(val: string) {
      currentFont = val;
    },
    textAlign: 'center',
    textBaseline: 'middle',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    canvas: {
      width: 1280,
      height: 720,
    },
  } as unknown as CanvasRenderingContext2D;
}

function createDummyLoopPresentation(
  kind: 'run_question' | 'answer' | 'rest' | 'squat',
  overrides?: Partial<AssaultLoopPresentation>,
): AssaultLoopPresentation {
  return {
    currentSegmentIndex: 0,
    currentSegmentKind: kind,
    segmentElapsedBeats: 0,
    segmentRemainingBeats: 4,
    segmentElapsedSeconds: 0,
    segmentRemainingSeconds: 2,
    currentOpportunity: kind === 'run_question' ? 0 : 1,
    totalOpportunities: 4,
    canSelectAnswer: kind === 'answer',
    isResting: kind === 'rest',
    isSquatActive: kind === 'squat',
    actionPrompt:
      kind === 'run_question'
        ? '문제를 읽으며 달리세요'
        : kind === 'answer'
        ? '정답을 향해 펀치하세요'
        : kind === 'squat'
        ? '스쿼트로 장애물을 피하세요'
        : '호흡을 가다듬으세요',
    currentSegment: {
      kind,
      segmentIndex: 0,
      startBeat: 0,
      endBeat: 4,
      durationBeats: 4,
    },
    ...overrides,
  };
}

describe('[ASSAULT-LOOP-14 / Issue #707] 루프 러닝·휴식 장면 공격 표시 억제 렌더링', () => {
  let ctx: CanvasRenderingContext2D;
  let pairPainter: AssaultPairPainter;
  let pairPainterSpy: ReturnType<typeof vi.spyOn>;
  let renderer: AssaultSceneRenderer;

  const dummyPair: AssaultPairRenderSnapshot = {
    leftText: '12',
    rightText: '15',
    progress: 0.5,
    status: 'flying',
  };

  beforeEach(() => {
    ctx = createMockContext();
    pairPainter = new AssaultPairPainter(DEFAULT_ASSAULT_VISUAL_CONFIG);
    pairPainterSpy = vi.spyOn(pairPainter, 'render');
    renderer = new AssaultSceneRenderer(pairPainter, DEFAULT_ASSAULT_VISUAL_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. run_question 구간 렌더링 검증', () => {
    it('run_question 구간에서는 pairPainter.render가 0회 호출되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        pair: dummyPair,
        squatHazard: { active: true, status: 'telegraph' },
        loop: createDummyLoopPresentation('run_question'),
      };

      renderer.render(ctx, snapshot);

      expect(pairPainterSpy).toHaveBeenCalledTimes(0);
    });

    it('run_question 구간에서는 스쿼트 위험 경고(hazard fillRect)가 0회 호출되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        squatHazard: { active: true, status: 'telegraph' },
        loop: createDummyLoopPresentation('run_question'),
      };

      renderer.render(ctx, snapshot);

      // fillRect는 squat hazard 바를 그릴 때 호출되므로 0회여야 함
      expect(ctx.fillRect).toHaveBeenCalledTimes(0);
    });

    it('run_question 구간에서는 투척 비행 대기 없이 문제 수식이 즉시 alpha=1.0, scale=1.0으로 계산되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        phase: 'throw_in',
        throwProgress: 0.0,
        loop: createDummyLoopPresentation('run_question'),
      };

      const pos = renderer.computeQuestionPosition(snapshot, { width: 1280, height: 720 });

      expect(pos.scale).toBe(1.0);
      expect(pos.alpha).toBe(1.0);
      expect(pos.x).toBeCloseTo(1280 * 0.5, 1);
      expect(pos.y).toBeCloseTo(720 * 0.16, 1);
    });

    it('run_question 구간에서는 러닝 안내 텍스트가 표시되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        loop: createDummyLoopPresentation('run_question', {
          actionPrompt: '문제를 읽으며 달리세요',
        }),
      };

      renderer.render(ctx, snapshot);

      expect(ctx.fillText).toHaveBeenCalledWith(
        '문제를 읽으며 달리세요',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('2. rest 구간 렌더링 검증', () => {
    it('rest 구간에서는 pairPainter.render가 0회 호출되어 공격 보기가 완전히 억제되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        pair: dummyPair,
        leftChoiceText: '42',
        rightChoiceText: '48',
        squatHazard: { active: true, status: 'active' },
        loop: createDummyLoopPresentation('rest'),
      };

      renderer.render(ctx, snapshot);

      expect(pairPainterSpy).toHaveBeenCalledTimes(0);
    });

    it('rest 구간에서는 스쿼트 위험 경고가 억제되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        squatHazard: { active: true, status: 'active', promptText: '스쿼트 회피!' },
        loop: createDummyLoopPresentation('rest'),
      };

      renderer.render(ctx, snapshot);

      expect(ctx.fillRect).toHaveBeenCalledTimes(0);
    });

    it('rest 구간에서는 휴식 안내 텍스트가 표시되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        loop: createDummyLoopPresentation('rest', {
          restNotice: '휴식: 호흡을 가다듬고 다음 문제를 준비하세요',
        }),
      };

      renderer.render(ctx, snapshot);

      expect(ctx.fillText).toHaveBeenCalledWith(
        '휴식: 호흡을 가다듬고 다음 문제를 준비하세요',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('3. answer 및 squat 구간 분기 검증', () => {
    it('answer 구간에서는 pairPainter.render가 정상 호출되고 스쿼트 경고는 억제되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        pair: dummyPair,
        squatHazard: { active: true, status: 'active' },
        loop: createDummyLoopPresentation('answer'),
      };

      renderer.render(ctx, snapshot);

      expect(pairPainterSpy).toHaveBeenCalledTimes(1);
      expect(ctx.fillRect).toHaveBeenCalledTimes(0);
    });

    it('squat 구간에서는 스쿼트 경고가 렌더링되고 pairPainter.render는 억제되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        pair: dummyPair,
        squatHazard: { active: true, status: 'active', promptText: '스쿼트!' },
        loop: createDummyLoopPresentation('squat'),
      };

      renderer.render(ctx, snapshot);

      expect(pairPainterSpy).toHaveBeenCalledTimes(0);
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('4. loop 미지정 레거시 스냅샷 동등성 검증', () => {
    it('loop가 없는 레거시 스냅샷은 기존 렌더링 동작과 100% 동등하게 pairPainter 및 hazard를 렌더링해야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        pair: dummyPair,
        squatHazard: { active: true, status: 'active' },
      };

      renderer.render(ctx, snapshot);

      expect(pairPainterSpy).toHaveBeenCalledTimes(1);
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('loop가 없는 레거시 스냅샷은 throw_in 페이즈 비행 진행도를 기존대로 계산해야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '6 × 7 = ?',
        phase: 'throw_in',
        throwProgress: 0.0,
      };

      const pos = renderer.computeQuestionPosition(snapshot, { width: 1280, height: 720 });

      expect(pos.scale).toBeLessThan(1.0);
      expect(pos.alpha).toBeLessThan(1.0);
    });
  });

  describe('5. 멱등성 및 다양한 뷰포트(가로/세로) 안전성', () => {
    it('동일 루프 스냅샷으로 여러 번 렌더링해도 부작용 없이 동일한 결과를 산출해야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '9 × 9 = ?',
        pair: dummyPair,
        loop: createDummyLoopPresentation('rest'),
      };

      expect(() => {
        renderer.render(ctx, snapshot);
        renderer.render(ctx, snapshot);
        renderer.render(ctx, snapshot);
      }).not.toThrow();

      expect(pairPainterSpy).toHaveBeenCalledTimes(0);
    });

    it('다양한 화면비(가로 1920x1080, 세로 720x1280)에서도 오류 없이 렌더링되어야 한다', () => {
      const snapshot: AssaultSceneSnapshot = {
        questionText: '5 × 5 = ?',
        pair: dummyPair,
        loop: createDummyLoopPresentation('run_question'),
      };

      expect(() => {
        renderer.render(ctx, snapshot, { width: 1920, height: 1080 });
        renderer.render(ctx, snapshot, { width: 720, height: 1280 });
      }).not.toThrow();
    });
  });
});
