import { describe, it, expect, vi } from 'vitest';
import { parseMath, measureMath, renderMath, wrapMathTokens } from '../../src/render/MathRenderer.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 10,
    })),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('MathRenderer - parseMath (Issue #114)', () => {
  it('기본 분수를 올바르게 파싱한다 (3/4)', () => {
    const tokens = parseMath('3/4');
    expect(tokens).toEqual([
      { type: 'fraction', num: '3', den: '4' },
    ]);
  });

  it('연산자가 포함된 분수 수식을 파싱한다 (1/2 + 3/4 = ?)', () => {
    const tokens = parseMath('1/2 + 3/4 = ?');
    expect(tokens.some((t) => t.type === 'fraction' && t.num === '1' && t.den === '2')).toBe(true);
    expect(tokens.some((t) => t.type === 'fraction' && t.num === '3' && t.den === '4')).toBe(true);
    expect(tokens.some((t) => t.type === 'operator' && t.op === '+')).toBe(true);
    expect(tokens.some((t) => t.type === 'operator' && t.op === '=')).toBe(true);
  });

  it('대분수를 올바르게 파싱한다 (1 2/3, 2과 3/4)', () => {
    const tokens1 = parseMath('1 2/3');
    expect(tokens1).toEqual([
      { type: 'fraction', whole: '1', num: '2', den: '3' },
    ]);

    const tokens2 = parseMath('2과 3/4');
    expect(tokens2).toEqual([
      { type: 'fraction', whole: '2', num: '3', den: '4' },
    ]);
  });

  it('거듭제곱을 올바르게 파싱한다 (5², x^3)', () => {
    const tokens1 = parseMath('5²');
    expect(tokens1).toEqual([
      { type: 'power', base: '5', exp: '2' },
    ]);

    const tokens2 = parseMath('x^3');
    expect(tokens2).toEqual([
      { type: 'power', base: 'x', exp: '3' },
    ]);
  });

  it('루트 기호를 올바르게 파싱한다 (√16, √A)', () => {
    const tokens1 = parseMath('√16');
    expect(tokens1).toEqual([
      { type: 'sqrt', radicand: '16' },
    ]);

    const tokens2 = parseMath('√16 + 1 = ?');
    expect(tokens2[0]).toEqual({ type: 'sqrt', radicand: '16' });
  });

  it('2진수 진법 표기를 파싱한다 (1101₍₂₎)', () => {
    const tokens = parseMath('1101₍₂₎');
    expect(tokens).toEqual([
      { type: 'subscript', base: '1101', sub: '2' },
    ]);
  });

  it('빈칸/비교 박스를 파싱한다 ([ ? ])', () => {
    const tokens = parseMath('{A} + {B}  [ ? ]  {C}');
    expect(tokens.some((t) => t.type === 'placeholder' && t.label === '?')).toBe(true);
  });

  it('일반 텍스트만 있는 경우 단일 텍스트 토큰으로 반환한다', () => {
    const tokens = parseMath('정답을 고르세요');
    expect(tokens).toEqual([
      { type: 'text', text: '정답을 고르세요' },
    ]);
  });
});

describe('MathRenderer - measureMath & renderMath (Issue #114)', () => {
  it('수식의 총 너비와 높이를 계측한다', () => {
    const ctx = createMockCtx();
    const tokens = parseMath('1/2 + 3/4');
    const dim = measureMath(ctx, tokens, { fontSize: 32 });
    expect(dim.width).toBeGreaterThan(0);
    expect(dim.height).toBeGreaterThanOrEqual(32);
  });

  it('분수 수식 렌더링 시 가로 분수선(moveTo, lineTo)과 분자/분모 fillText를 호출한다', () => {
    const ctx = createMockCtx();
    renderMath(ctx, '3/4', 100, 100, { fontSize: 32, align: 'center' });

    // 가로 분수선 드로잉 확인
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();

    // 분자, 분모 fillText 확인
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('4', expect.any(Number), expect.any(Number));
  });

  it('빈칸 박스 렌더링 시 roundRect를 호출한다', () => {
    const ctx = createMockCtx();
    renderMath(ctx, '[ ? ]', 100, 100, { fontSize: 32, align: 'center' });

    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('?', expect.any(Number), expect.any(Number));
  });

  it('거듭제곱 렌더링 시 밑과 지수를 각각 올바른 위치에 fillText로 그린다', () => {
    const ctx = createMockCtx();
    renderMath(ctx, '5²', 100, 100, { fontSize: 32, align: 'center' });

    expect(ctx.fillText).toHaveBeenCalledWith('5', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('2', expect.any(Number), expect.any(Number));
  });

  it('루트 렌더링 시 근호 꺾쇠와 상단 가로선을 그리고 피개근수를 그린다', () => {
    const ctx = createMockCtx();
    renderMath(ctx, '√16', 100, 100, { fontSize: 32, align: 'center' });

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('16', expect.any(Number), expect.any(Number));
  });

  describe('문제 폰트 확대 및 영역 초과 자동 줄바꿈 (Issue #167 / RENDER-MATH-002)', () => {
    it('maxWidth 지정 시 긴 수식을 자동 줄바꿈(wrapMathTokens)하여 여러 줄로 분할한다', () => {
      const ctx = createMockCtx();
      // 긴 수식: "1/2 + 3/4 + 5/6 + 7/8 = [ ? ]"
      const tokens = parseMath('1/2 + 3/4 + 5/6 + 7/8 = [ ? ]');
      const singleDim = measureMath(ctx, tokens, { fontSize: 40 });

      // maxWidth를 전체 폭의 절반으로 설정 -> 2줄 이상 분할되어야 함
      const maxWidth = singleDim.width * 0.55;
      const lines = wrapMathTokens(ctx, tokens, { fontSize: 40 }, maxWidth);

      expect(lines.length).toBeGreaterThanOrEqual(2);
      // 모든 토큰 수가 보존되어야 함
      const totalTokens = lines.reduce((acc, l) => acc + l.length, 0);
      expect(totalTokens).toBe(tokens.length);
    });

    it('분수 토큰(whole, num, den) 및 복합 토큰이 줄바꿈 도중에 분리되지 않고 원형을 유지한다', () => {
      const ctx = createMockCtx();
      const tokens = parseMath('1 2/3 + 4/5 = [ ? ]');
      const lines = wrapMathTokens(ctx, tokens, { fontSize: 40 }, 100);

      // 분수 토큰이 깨지지 않고 온전한 fraction 타입으로 남아있는지 검증
      let foundFraction = false;
      for (const line of lines) {
        for (const t of line) {
          if (t.type === 'fraction') {
            foundFraction = true;
            expect(t.num).toBeDefined();
            expect(t.den).toBeDefined();
          }
        }
      }
      expect(foundFraction).toBe(true);
    });

    it('renderMath에 maxWidth 옵션 전달 시 자동 줄바꿈되어 렌더링되고 총 높이가 1줄 대비 증가한다', () => {
      const ctx = createMockCtx();
      const text = '1/2 + 3/4 + 5/6 = [ ? ]';
      const singleRes = renderMath(ctx, text, 100, 100, { fontSize: 40 });
      const wrapRes = renderMath(ctx, text, 100, 100, {
        fontSize: 40,
        maxWidth: singleRes.width * 0.5,
      });

      expect(wrapRes.height).toBeGreaterThan(singleRes.height);
      expect(wrapRes.width).toBeLessThanOrEqual(singleRes.width);
    });
  });
});
