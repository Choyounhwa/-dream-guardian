import { describe, expect, it, vi } from 'vitest';
import {
  QuestionRenderer,
  DEFAULT_QUESTION_FIXTURE,
  LONG_FORMULA_QUESTION_FIXTURE,
  FRACTION_QUESTION_FIXTURE,
  GEOMETRY_QUESTION_FIXTURE,
  APPROACH_QUESTION_FIXTURE,
  type QuestionPresentationContext,
  type QuestionRenderState,
} from '../../src/render/QuestionRenderer.js';
import { QuestionApproachRenderer } from '../../src/render/QuestionApproachRenderer.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D & { calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] }),
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] }),
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] }),
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] }),
    ),
    clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] }),
    ),
    strokeText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y] }),
    ),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
    drawImage: vi.fn((...args: unknown[]) => calls.push({ method: 'drawImage', args })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((sx: number, sy: number) => calls.push({ method: 'scale', args: [sx, sy] })),
    setLineDash: vi.fn(() => {}),
    fillStyle: '#ffffff',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    font: '24px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: 'transparent',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & { calls: { method: string; args: unknown[] }[] };
}

describe('[Issue #445 / UI-VIS-015] 러닝·답안 공용 문제 표시 경계', () => {
  const W = 1080;
  const H = 2160;

  describe('1. 선택적 표시 컨텍스트(QuestionPresentationContext) 주입 및 bounds 조회', () => {
    it('컨텍스트 미주입 시 기본 헤더 및 2답안 버튼 bounds를 반환한다', () => {
      const renderer = new QuestionRenderer();
      expect(renderer.getPresentationContext()).toBeUndefined();

      const headerBounds = renderer.getHeaderBounds(W, H);
      expect(headerBounds.w).toBe(880);
      expect(headerBounds.h).toBe(280);
      expect(headerBounds.x).toBe((W - 880) / 2);
      expect(headerBounds.y).toBe(320);
      expect(headerBounds.isProtected).toBe(false);

      const expectedLayouts = getAnswerButtonLayouts(W, H);
      const choice0Bounds = renderer.getChoiceButtonBounds(0, W, H);
      expect(choice0Bounds.x).toBe(expectedLayouts[0].x);
      expect(choice0Bounds.y).toBe(expectedLayouts[0].y);
      expect(choice0Bounds.w).toBe(expectedLayouts[0].width);
      expect(choice0Bounds.h).toBe(expectedLayouts[0].height);
      expect(choice0Bounds.isProtected).toBe(true);

      const choice1Bounds = renderer.getChoiceButtonBounds(1, W, H);
      expect(choice1Bounds.x).toBe(expectedLayouts[1].x);
      expect(choice1Bounds.y).toBe(expectedLayouts[1].y);
      expect(choice1Bounds.w).toBe(expectedLayouts[1].width);
      expect(choice1Bounds.h).toBe(expectedLayouts[1].height);
      expect(choice1Bounds.isProtected).toBe(true);
    });

    it('도형 문제(hasShape: true)의 경우 상단 헤더 bounds가 안전하게 조정된다', () => {
      const renderer = new QuestionRenderer();
      const shapeHeaderBounds = renderer.getHeaderBounds(W, H, { hasShape: true });
      expect(shapeHeaderBounds.w).toBe(760);
      expect(shapeHeaderBounds.h).toBe(200);
      expect(shapeHeaderBounds.x).toBe((W - 760) / 2);
      expect(shapeHeaderBounds.y).toBe(320 - 30);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext가 정상 동작한다', () => {
      const renderer = new QuestionRenderer();
      const customContext: QuestionPresentationContext = {
        header: {
          x: 120,
          y: 200,
          w: 840,
          h: 220,
          color: '#FFD700',
        },
      };

      renderer.setPresentationContext(customContext);
      expect(renderer.getPresentationContext()).toEqual(customContext);

      const bounds = renderer.getHeaderBounds(W, H);
      expect(bounds.x).toBe(120);
      expect(bounds.y).toBe(200);
      expect(bounds.w).toBe(840);
      expect(bounds.h).toBe(220);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
      const resetBounds = renderer.getHeaderBounds(W, H);
      expect(resetBounds.x).toBe((W - 880) / 2);
    });

    it('fromPresentationDocument를 통해 running_question과 answer_select 페이지를 정확히 매핑한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const context = QuestionRenderer.fromPresentationDocument(doc);

      expect(context.presentationDocument).toBe(doc);
      expect(context.header).toBeDefined();
      expect(context.header?.x).toBe(324);
      expect(context.header?.y).toBe(518);
      expect(context.header?.w).toBe(432);
      expect(context.header?.h).toBe(346);

      expect(context.choice0).toBeDefined();
      expect(context.choice0?.x).toBe(43);
      expect(context.choice0?.y).toBe(890);
      expect(context.choice0?.w).toBe(281);
      expect(context.choice0?.h).toBe(250);

      expect(context.choice1).toBeDefined();
      expect(context.choice1?.x).toBe(756);
      expect(context.choice1?.y).toBe(890);
      expect(context.choice1?.w).toBe(281);
      expect(context.choice1?.h).toBe(250);

      expect(context.choices).toHaveLength(2);
    });

    it('QuestionApproachRenderer도 동일한 PresentationContext를 일관되게 수신 및 소비한다', () => {
      const approachRenderer = new QuestionApproachRenderer();
      const customContext: QuestionPresentationContext = {
        header: {
          x: 100,
          y: 150,
          w: 800,
          h: 200,
          color: '#00FFAA',
        },
      };

      approachRenderer.setPresentationContext(customContext);
      expect(approachRenderer.getPresentationContext()).toEqual(customContext);

      const headerBounds = approachRenderer.getHeaderBounds(W, H);
      expect(headerBounds.x).toBe(100);
      expect(headerBounds.y).toBe(150);
      expect(headerBounds.w).toBe(800);
      expect(headerBounds.h).toBe(200);

      const choice0Bounds = approachRenderer.getChoiceButtonBounds(0, W, H);
      expect(choice0Bounds.isProtected).toBe(true);
      expect(choice0Bounds.x).toBe(43);

      approachRenderer.clearPresentationContext();
      expect(approachRenderer.getPresentationContext()).toBeUndefined();
    });
  });

  describe('2. 정확히 2답안 및 피트니스 존 4/5 보호 기하 (Protected Zone Guard)', () => {
    it('2답안 범위를 벗어난 선택지 인덱스(0, 1 외)에 대해 getChoiceButtonBounds는 예외를 던진다', () => {
      const renderer = new QuestionRenderer();
      expect(() => renderer.getChoiceButtonBounds(2 as any, W, H)).toThrow(
        /Only.*2 choices|Invalid choice button index/i,
      );
      expect(() => renderer.getChoiceButtonBounds(-1 as any, W, H)).toThrow(
        /Only.*2 choices|Invalid choice button index/i,
      );
    });

    it('QuestionRenderState에 3개 이상의 choices가 전달되면 render는 즉시 예외를 발생시킨다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      const illegalState: QuestionRenderState = {
        question: {
          questionText: '1 + 1 = ?',
          correctAnswer: '2',
          wrongAnswer: '3',
          choices: ['2', '3', '4'] as unknown as [string, string],
          correctIndex: 0,
        },
        questionVisible: true,
      };

      expect(() => renderer.render(ctx, W, H, illegalState)).toThrow(
        /exactly 2 choices/i,
      );
    });

    it('QuestionRenderState에 1개의 choice만 전달되어도 render는 원자적으로 거부한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      const illegalState: QuestionRenderState = {
        question: {
          questionText: '5 - 3 = ?',
          correctAnswer: '2',
          wrongAnswer: '3',
          choices: ['2'] as unknown as [string, string],
          correctIndex: 0,
        },
        questionVisible: true,
      };

      expect(() => renderer.render(ctx, W, H, illegalState)).toThrow(
        /exactly 2 choices/i,
      );
    });

    it('답안 버튼의 action geometry 변조 시도는 validatePresentationContext에서 거부된다', () => {
      const renderer = new QuestionRenderer();
      const illegalContext: QuestionPresentationContext = {
        choice0: {
          x: 200, // 원래 43이어야 함
          y: 950, // 원래 890이어야 함
        },
      };

      const result = renderer.validatePresentationContext(illegalContext);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.includes('Zone 4') || v.includes('choice_0'))).toBe(true);
    });

    it('답안 버튼 개수가 2개가 아닌 presentation context는 유효성 검사에서 거부된다', () => {
      const renderer = new QuestionRenderer();
      const invalidChoicesCtx: QuestionPresentationContext = {
        choices: [
          { color: '#ffffff' },
          { color: '#ffffff' },
          { color: '#ffffff' },
        ] as any,
      };

      const result = renderer.validatePresentationContext(invalidChoicesCtx);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('2답안'))).toBe(true);
    });

    it('isSlotLocked 및 getSlotLockReason이 Zone 4/5 및 2답안 액션 슬롯을 잠금 상태로 보호한다', () => {
      const renderer = new QuestionRenderer();
      expect(renderer.isSlotLocked('choice_0')).toBe(true);
      expect(renderer.isSlotLocked('choice_1')).toBe(true);
      expect(renderer.isSlotLocked('zone_4_action_geometry')).toBe(true);
      expect(renderer.isSlotLocked('zone_5_action_geometry')).toBe(true);
      expect(renderer.isSlotLocked('header')).toBe(false);

      expect(renderer.getSlotLockReason('choice_0')).toMatch(/Zone 4\/5|입력 판정/);
      expect(renderer.getSlotLockReason('header')).toBeNull();
    });

    it('보호 영역이 적용된 상태에서 답안 버튼 bounds 쿼리는 context의 변조값을 무시하고 항상 보호 geometry를 반환한다', () => {
      const renderer = new QuestionRenderer({
        choice0: { x: 500, y: 1500, w: 999, h: 999 },
      });

      const bounds = renderer.getChoiceButtonBounds(0, W, H);
      expect(bounds.x).toBe(43);
      expect(bounds.y).toBe(890);
      expect(bounds.w).toBe(281);
      expect(bounds.h).toBe(250);
      expect(bounds.isProtected).toBe(true);
    });
  });

  describe('3. 문제 생성/평가/정답/시간 계산 불변 및 순수 Fixture DTO 렌더', () => {
    it('DEFAULT_QUESTION_FIXTURE를 사용하여 부작용 없이 순수하게 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      renderer.renderFixture(ctx, W, H, DEFAULT_QUESTION_FIXTURE);

      expect(ctx.calls.length).toBeGreaterThan(0);
      const textCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(textCalls.some((c) => String(c.args[0]).includes('27'))).toBe(true);
      expect(textCalls.some((c) => String(c.args[0]).includes('25'))).toBe(true);
    });

    it('긴 수식 DTO(LONG_FORMULA_QUESTION_FIXTURE)를 깨짐 없이 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      expect(() => {
        renderer.renderFixture(ctx, W, H, LONG_FORMULA_QUESTION_FIXTURE);
      }).not.toThrow();

      const textCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(textCalls.some((c) => String(c.args[0]).includes('840'))).toBe(true);
      expect(textCalls.some((c) => String(c.args[0]).includes('820'))).toBe(true);
    });

    it('분수 수식 DTO(FRACTION_QUESTION_FIXTURE)를 분수 렌더러와 연동하여 정상 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      expect(() => {
        renderer.renderFixture(ctx, W, H, FRACTION_QUESTION_FIXTURE);
      }).not.toThrow();

      expect(ctx.calls.some((c) => c.method === 'lineTo')).toBe(true); // 분수선 그리기
    });

    it('기하 도형 DTO(GEOMETRY_QUESTION_FIXTURE)를 ShapeRenderer와 연동하여 정상 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      expect(() => {
        renderer.renderFixture(ctx, W, H, GEOMETRY_QUESTION_FIXTURE);
      }).not.toThrow();

      const textCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(textCalls.some((c) => String(c.args[0]).includes('모양 A'))).toBe(true);
    });

    it('접근 진행도 DTO(APPROACH_QUESTION_FIXTURE)를 변환 행렬과 함께 정상 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      expect(() => {
        renderer.renderFixture(ctx, W, H, APPROACH_QUESTION_FIXTURE);
      }).not.toThrow();

      expect(ctx.calls.some((c) => c.method === 'translate')).toBe(true);
      expect(ctx.calls.some((c) => c.method === 'scale')).toBe(true);
    });

    it('renderFixture 호출은 인스턴스의 presentationContext를 오염시키지 않고 불변 복원한다', () => {
      const baseContext: QuestionPresentationContext = {
        header: { color: '#112233' },
      };
      const renderer = new QuestionRenderer(baseContext);

      const tempContext: QuestionPresentationContext = {
        header: { color: '#998877' },
      };

      const ctx = createMockCtx();
      renderer.renderFixture(ctx, W, H, DEFAULT_QUESTION_FIXTURE, tempContext);

      expect(renderer.getPresentationContext()).toBe(baseContext);
      expect(renderer.getPresentationContext()?.header?.color).toBe('#112233');
    });

    it('QuestionApproachRenderer.renderFixture도 결정론적으로 동작한다', () => {
      const approachRenderer = new QuestionApproachRenderer();
      const ctx = createMockCtx();

      expect(() => {
        approachRenderer.renderFixture(ctx, W, H, {
          questionText: '6 × 7 = [ ? ]',
          progress: 0.5,
        });
      }).not.toThrow();

      expect(ctx.calls.some((c) => c.method === 'translate')).toBe(true);
      expect(ctx.calls.some((c) => c.method === 'scale')).toBe(true);
    });

    it('정적 QuestionRenderer.renderFixture 및 정적 QuestionApproachRenderer.renderFixture 메서드를 지원한다', () => {
      const ctx = createMockCtx();
      expect(() => {
        QuestionRenderer.renderFixture(ctx, W, H, DEFAULT_QUESTION_FIXTURE);
      }).not.toThrow();

      expect(() => {
        QuestionApproachRenderer.renderFixture(ctx, W, H, {
          questionText: '9 + 9 = [ ? ]',
          progress: 1.0,
        });
      }).not.toThrow();
    });
  });
});
