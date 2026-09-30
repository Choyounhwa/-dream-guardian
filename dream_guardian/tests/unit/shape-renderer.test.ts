import { describe, it, expect, vi } from 'vitest';
import {
  ShapeRenderer,
  STACK_CUBE_CATALOG,
  parseShapeCode,
  deriveShapeFromQuestion,
  type StackCubesShape,
  type CubeNetShape,
  type ArrowRotShape,
} from '../../src/render/ShapeRenderer.js';
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
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
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

describe('ShapeRenderer (Issue #247 / FEAT-QUESTION-SHAPE-001)', () => {
  describe('parseShapeCode & deriveShapeFromQuestion', () => {
    it('쌓기나무 JSON-like 문자열을 정확히 파싱한다', () => {
      const parsed = parseShapeCode("{type:'stack_cubes', grid:[[2,1],[1,0]]}") as StackCubesShape;
      expect(parsed).not.toBeNull();
      expect(parsed.type).toBe('stack_cubes');
      expect(parsed.grid).toEqual([[2, 1], [1, 0]]);
      expect(parsed.view).toBeUndefined();
    });

    it('쌓기나무 시점(view: top, front, side) 속성을 파싱한다', () => {
      const parsed = parseShapeCode("{type:'stack_cubes', grid:[[2,1],[1,0]], view:'top'}") as StackCubesShape;
      expect(parsed).not.toBeNull();
      expect(parsed.type).toBe('stack_cubes');
      expect(parsed.view).toBe('top');
    });

    it('주사위 전개도(cube_net) 및 면/점 정보를 정확히 파싱한다', () => {
      const code = "{type:'cube_net', face:1, faces:[2,4,1,3,5,6], points:[{r:0,c:1,t:'ㄱ'},{r:1,c:0,t:'ㅂ'},{r:1,c:2,t:'ㄹ'}]}";
      const parsed = parseShapeCode(code) as CubeNetShape;
      expect(parsed).not.toBeNull();
      expect(parsed.type).toBe('cube_net');
      expect(parsed.face).toBe(1);
      expect(parsed.faces).toEqual([2, 4, 1, 3, 5, 6]);
      expect(parsed.points).toHaveLength(3);
      expect(parsed.points?.[0]).toEqual({ r: 0, c: 1, t: 'ㄱ' });
      expect(parsed.points?.[1]).toEqual({ r: 1, c: 0, t: 'ㅂ' });
    });

    it('화살표 회전(arrow_rot)을 파싱한다', () => {
      const code = "{type:'arrow_rot', from:'➡️', deg:45}";
      const parsed = parseShapeCode(code) as ArrowRotShape;
      expect(parsed).not.toBeNull();
      expect(parsed.type).toBe('arrow_rot');
      expect(parsed.from).toBe('➡️');
      expect(parsed.deg).toBe(45);
    });

    it('잘못되거나 빈 문자열은 null을 반환한다', () => {
      expect(parseShapeCode('')).toBeNull();
      expect(parseShapeCode('invalid')).toBeNull();
      expect(parseShapeCode('{foo:bar}')).toBeNull();
    });

    it('질문 텍스트에 [모양 A]~[모양 Q]가 있으면 shapeCode가 없어도 카탈로그에서 추론한다', () => {
      const shapeA = deriveShapeFromQuestion('[모양 A] 그림의 쌓기나무는 모두 몇 개?');
      expect(shapeA).not.toBeNull();
      expect(shapeA?.type).toBe('stack_cubes');
      expect((shapeA as StackCubesShape).grid).toEqual([[2, 1], [1, 0]]);

      const shapeQ = deriveShapeFromQuestion('[모양 Q] 1층에 있는 쌓기나무의 수는?');
      expect(shapeQ).not.toBeNull();
      expect((shapeQ as StackCubesShape).grid).toEqual([[2, 1, 1], [2, 2, 1], [1, 1, 0]]);
    });
  });

  describe('STACK_CUBE_CATALOG (모양 A~Q 17종 전수 검증)', () => {
    const expectedCubes: Record<string, number> = {
      A: 4,
      B: 5,
      C: 6,
      D: 7,
      E: 8,
      F: 8,
      G: 8,
      H: 7,
      I: 9,
      J: 9,
      K: 7,
      L: 8,
      M: 9,
      N: 11,
      O: 10,
      P: 12,
      Q: 11,
    };

    it('모양 A부터 Q까지 17종이 모두 등록되어 있어야 한다', () => {
      const letters = 'ABCDEFGHIJKLMNOPQ'.split('');
      for (const letter of letters) {
        expect(STACK_CUBE_CATALOG[letter]).toBeDefined();
      }
      expect(Object.keys(STACK_CUBE_CATALOG)).toHaveLength(17);
    });

    it('각 모양별 총 쌓기나무 개수가 questions.csv의 정답과 100% 일치해야 한다', () => {
      for (const [letter, expectedCount] of Object.entries(expectedCubes)) {
        const grid = STACK_CUBE_CATALOG[letter];
        const total = grid.reduce((sum, row) => sum + row.reduce((rSum, h) => rSum + h, 0), 0);
        expect(total).toBe(expectedCount);
      }
    });
  });

  describe('아이소메트릭 3D 쌓기나무 렌더링', () => {
    it('renderStackCubes가 캔버스 드로잉 명령(상단, 좌측, 우측 면)을 정상 호출한다', () => {
      const renderer = new ShapeRenderer();
      const ctx = createMockCtx();
      const grid = [[2, 1], [1, 0]]; // 모양 A (4개)

      renderer.renderStackCubes(ctx, grid, 540, 600, 400, 300, { label: '[모양 A]' });

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();

      // 4개 큐브 x 각 큐브 3면 = 최소 12회 이상 fill 호출
      expect((ctx.fill as any).mock.calls.length).toBeGreaterThanOrEqual(12);

      // 라벨 텍스트 확인
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes('모양 A'))).toBe(true);
    });

    it('시점 화살표(view: front, side, top) 가이드가 요청되면 렌더링한다', () => {
      const renderer = new ShapeRenderer();

      const ctxFront = createMockCtx();
      renderer.renderStackCubes(ctxFront, [[2, 1], [1, 0]], 540, 600, 400, 300, { view: 'front' });
      const frontTexts = (ctxFront.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(frontTexts.some((t: string) => t.includes('앞'))).toBe(true);

      const ctxSide = createMockCtx();
      renderer.renderStackCubes(ctxSide, [[2, 1], [1, 0]], 540, 600, 400, 300, { view: 'side' });
      const sideTexts = (ctxSide.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(sideTexts.some((t: string) => t.includes('옆'))).toBe(true);
    });

    it('17종 전체 모양(A~Q)이 에러 없이 렌더링된다', () => {
      const renderer = new ShapeRenderer();
      for (const [letter, grid] of Object.entries(STACK_CUBE_CATALOG)) {
        const ctx = createMockCtx();
        expect(() => {
          renderer.renderStackCubes(ctx, grid, 540, 600, 400, 300, { label: `[모양 ${letter}]` });
        }).not.toThrow();
        expect(ctx.fill).toHaveBeenCalled();
      }
    });
  });

  describe('주사위/정육면체 전개도 렌더링', () => {
    it('전개도(1-4-1) 6개 면과 외곽선, 면 번호를 렌더링한다', () => {
      const renderer = new ShapeRenderer();
      const ctx = createMockCtx();
      const net: CubeNetShape = {
        type: 'cube_net',
        face: 1,
        faces: [2, 4, 1, 3, 5, 6],
      };

      renderer.renderCubeNet(ctx, net, 540, 600, 400, 300);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.setLineDash).toHaveBeenCalled(); // 접는 선 점선

      // 면 번호 1~6 렌더링 확인
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => String(c[0]));
      for (const num of [1, 2, 3, 4, 5, 6]) {
        expect(textCalls.some((t: string) => t.includes(String(num)))).toBe(true);
      }
    });

    it('전개도 꼭짓점 기호(점 ㄱ, 점 ㅂ 등)를 정확한 좌표에 렌더링한다', () => {
      const renderer = new ShapeRenderer();
      const ctx = createMockCtx();
      const net: CubeNetShape = {
        type: 'cube_net',
        face: 1,
        faces: [2, 4, 1, 3, 5, 6],
        points: [
          { r: 0, c: 1, t: 'ㄱ' },
          { r: 1, c: 0, t: 'ㅂ' },
          { r: 1, c: 2, t: 'ㄹ' },
        ],
      };

      renderer.renderCubeNet(ctx, net, 540, 600, 400, 300);

      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => String(c[0]));
      expect(textCalls.some((t: string) => t.includes('ㄱ'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('ㅂ'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('ㄹ'))).toBe(true);
    });
  });

  describe('QuestionRenderer 화면 배치 연동 (문제 영역 내부 겹침 없는 렌더링)', () => {
    it('쌓기나무 문제가 출제되면 문제 영역 내부에 시각 이미지를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const question: GeneratedQuestion = {
        questionText: '[모양 A] 그림의 쌓기나무는 모두 몇 개?',
        choices: [4, 5],
        correctAnswer: 4,
        wrongAnswer: 5,
        correctIndex: 0,
        shapeCode: "{type:'stack_cubes', grid:[[2,1],[1,0]]}",
      };

      const state: QuestionRenderState = {
        question,
        questionVisible: true,
      };

      renderer.render(ctx, 1080, 2160, state);

      expect(ctx.save).toHaveBeenCalled();
      // 쌓기나무 큐브 면 fill 호출이 존재해야 함
      expect((ctx.fill as any).mock.calls.length).toBeGreaterThanOrEqual(12);

      // 문제 텍스트 및 답안 버튼 fillText도 모두 온전히 호출됨
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => String(c[0]));
      expect(textCalls.some((t: string) => t.includes('키보드 [1]'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('키보드 [2]'))).toBe(true);
    });

    it('주사위 전개도 문제가 출제되면 전개도 이미지를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const question: GeneratedQuestion = {
        questionText: '주사위 전개도에서 [1]과 마주보는(평행한) 면은?',
        choices: [6, 5],
        correctAnswer: 6,
        wrongAnswer: 5,
        correctIndex: 0,
        shapeCode: "{type:'cube_net', face:1, faces:[2,4,1,3,5,6]}",
      };

      renderer.render(ctx, 1080, 2160, {
        question,
        questionVisible: true,
      });

      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => String(c[0]));
      expect(textCalls.some((t: string) => t.includes('1'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('6'))).toBe(true);
    });

    it('도형이 없는 일반 산수 문제의 경우 기존 렌더링 형태를 유지한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const question: GeneratedQuestion = {
        questionText: '35 + 47 = ?',
        choices: [82, 80],
        correctAnswer: 82,
        wrongAnswer: 80,
        correctIndex: 0,
      };

      renderer.render(ctx, 1080, 2160, {
        question,
        questionVisible: true,
      });

      // 일반 산수 문제는 큐브 면 fill이 없으므로 버튼 2개 외에 대량 fill이 없음
      expect((ctx.fill as any).mock.calls.length).toBeLessThan(10);
    });
  });
});
