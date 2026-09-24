import { describe, it, expect, vi } from 'vitest';
import { PartIconRenderer, drawPartIcon } from '../../src/render/PartIconRenderer.js';
import { CURSOR_COLORS } from '../../config/cursor.config.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('PartIconRenderer (Issue #127 / ICON-001)', () => {
  it('모든 신체 부위(leftHand, rightHand, head, hip, shoulder) 아이콘이 에러 없이 드로잉된다', () => {
    const parts = ['leftHand', 'rightHand', 'head', 'hip', 'shoulder'] as const;

    for (const part of parts) {
      const ctx = createMockCtx();
      expect(() => PartIconRenderer.drawIcon(ctx, part, 100, 100, 32)).not.toThrow();
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
    }
  });

  it('기본 모드(stroke)에서는 stroke만 호출되고 채움 모드(fill)에서는 fill이 호출된다', () => {
    const ctxStroke = createMockCtx();
    PartIconRenderer.drawIcon(ctxStroke, 'leftHand', 50, 50, 24, { mode: 'stroke' });
    expect(ctxStroke.stroke).toHaveBeenCalled();
    expect(ctxStroke.fill).not.toHaveBeenCalled();

    const ctxFill = createMockCtx();
    PartIconRenderer.drawIcon(ctxFill, 'leftHand', 50, 50, 24, { mode: 'fill' });
    expect(ctxFill.fill).toHaveBeenCalled();
    expect(ctxFill.stroke).not.toHaveBeenCalled();

    const ctxBoth = createMockCtx();
    PartIconRenderer.drawIcon(ctxBoth, 'leftHand', 50, 50, 24, { mode: 'both' });
    expect(ctxBoth.fill).toHaveBeenCalled();
    expect(ctxBoth.stroke).toHaveBeenCalled();
  });

  it('각 부위별 기본 색상(CURSOR_COLORS)이 자동으로 바인딩된다', () => {
    const ctxLeft = createMockCtx();
    PartIconRenderer.drawIcon(ctxLeft, 'leftHand', 50, 50, 24);
    expect(ctxLeft.strokeStyle).toBe(CURSOR_COLORS.leftHand);

    const ctxRight = createMockCtx();
    PartIconRenderer.drawIcon(ctxRight, 'rightHand', 50, 50, 24);
    expect(ctxRight.strokeStyle).toBe(CURSOR_COLORS.rightHand);

    const ctxHead = createMockCtx();
    PartIconRenderer.drawIcon(ctxHead, 'head', 50, 50, 24);
    expect(ctxHead.strokeStyle).toBe(CURSOR_COLORS.head);

    const ctxHip = createMockCtx();
    PartIconRenderer.drawIcon(ctxHip, 'hip', 50, 50, 24);
    expect(ctxHip.strokeStyle).toBe(CURSOR_COLORS.hip);
  });

  it('간편 함수형 인터페이스(drawPartIcon)가 정상 동작한다', () => {
    const ctx = createMockCtx();
    expect(() => drawPartIcon(ctx, 'head', 100, 100, 30, '#FF00FF')).not.toThrow();
    expect(ctx.strokeStyle).toBe('#FF00FF');
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('glow 옵션 활성화 시 네온 섀도우가 적용된다', () => {
    const ctx = createMockCtx();
    PartIconRenderer.drawIcon(ctx, 'head', 50, 50, 20, { glow: true });
    expect(ctx.shadowColor).toBe(CURSOR_COLORS.head);
    expect(ctx.shadowBlur).toBeGreaterThan(0);
  });

  describe('Radial Answer Button Split (Issue #148 / FEAT-UI-005)', () => {
    it('1개 커서 요구 시 단일 색상으로 둥근 사각형 테두리 및 배경을 드로잉한다', () => {
      const ctx = createMockCtx();
      const recipe = { requiredCursors: ['leftHand'] as const, targetZoneIds: [4] };

      PartIconRenderer.drawRadialAnswerButton(ctx, recipe as any, 100, 200, 300, 150, 16);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.roundRect).toHaveBeenCalledWith(100, 200, 300, 150, 16);
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.strokeStyle).toBe(CURSOR_COLORS.leftHand);
    });

    it('2개 커서 요구 시 1/2 방사형(180도) 2개 섹터로 분할하여 클리핑 및 드로잉한다', () => {
      const ctx = createMockCtx();
      const recipe = { requiredCursors: ['leftHand', 'rightHand'] as const, targetZoneIds: [4, 8] };

      PartIconRenderer.drawRadialAnswerButton(ctx, recipe as any, 100, 200, 300, 150, 16);

      // 2개 섹터 각각에 대해 클리핑(clip 2회) 및 roundRect(stroke 2회, fill 2회) 호출
      expect(ctx.clip).toHaveBeenCalledTimes(2);
      expect(ctx.stroke).toHaveBeenCalledTimes(4); // 2개 섹터 stroke + 2개 분할선 stroke
      expect(ctx.fill).toHaveBeenCalledTimes(2);
      expect(ctx.arc).toHaveBeenCalledTimes(2);
    });

    it('3개 커서 요구 시 1/3 방사형(120도) 3개 섹터로 분할하여 클리핑 및 드로잉한다', () => {
      const ctx = createMockCtx();
      const recipe = {
        requiredCursors: ['leftHand', 'rightHand', 'head'] as const,
        targetZoneIds: [4, 8, 2],
      };

      PartIconRenderer.drawRadialAnswerButton(ctx, recipe as any, 100, 200, 300, 150, 16);

      // 3개 섹터 각각에 대해 클리핑(clip 3회), arc 3회
      expect(ctx.clip).toHaveBeenCalledTimes(3);
      expect(ctx.arc).toHaveBeenCalledTimes(3);
      expect(ctx.fill).toHaveBeenCalledTimes(3);
    });

    it('recipe가 null이거나 빈 경우 기본 색상(#FFCB4D)으로 안전 렌더링된다', () => {
      const ctx = createMockCtx();
      PartIconRenderer.drawRadialAnswerButton(ctx, null, 100, 200, 300, 150, 16);

      expect(ctx.roundRect).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.strokeStyle).toBe('#FFCB4D');
    });
  });
});
