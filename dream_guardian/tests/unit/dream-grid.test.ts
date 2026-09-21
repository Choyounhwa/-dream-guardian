import { describe, it, expect, vi } from 'vitest';
import { DreamGrid } from '../../src/render/DreamGrid.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('DreamGrid - 3D Perspective Grid with Square Proportions (Issue #27 & Issue #111)', () => {
  const ctx = createMockCtx();

  it('기본 설정으로 정상 초기화되며 기본 투명도가 30%(0.30)이다', () => {
    const grid = new DreamGrid();
    expect(grid.offset).toBe(0);
    expect(grid.alpha).toBeCloseTo(0.30);
  });

  it('update(dt) 호출 시 오프셋이 [0, 1) 범위로 부드럽게 순환한다', () => {
    const grid = new DreamGrid({ speed: 1.0 });
    grid.update(0.5);
    expect(grid.offset).toBeCloseTo(0.5);

    grid.update(0.6); // 1.1 -> 0.1
    expect(grid.offset).toBeCloseTo(0.1);
  });

  it('render()가 바닥과 천장 그리드 및 소실점 대기 심도 구역을 렌더링한다', () => {
    const grid = new DreamGrid({ color: '#28E6FF', hasCeiling: true });
    expect(() => grid.render(ctx, 1920, 1080)).not.toThrow();

    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('보스 위치(소실점) 커스텀 설정 및 천장 비활성화가 정상 적용된다', () => {
    const grid = new DreamGrid();
    expect(() =>
      grid.render(ctx, 1280, 720, {
        vanishingX: 640,
        vanishingY: 200,
        color: '#C889FF',
        hasCeiling: false,
        alpha: 0.35,
      }),
    ).not.toThrow();
  });

  it('setColor, setSpeed, setAlpha가 정상 반영된다', () => {
    const grid = new DreamGrid();
    grid.setColor('#FF4444');
    grid.setSpeed(2.0);
    grid.setAlpha(0.40);
    expect(grid.alpha).toBeCloseTo(0.40);

    grid.update(0.2);
    expect(grid.offset).toBeCloseTo(0.4);
  });

  it('toRgba 헬퍼가 다양한 색상 포맷(hex 3자리, hex 6자리, rgb)을 안전하게 변환한다', () => {
    const grid = new DreamGrid();
    expect(() => grid.render(ctx, 800, 600, { color: '#f00' })).not.toThrow();
    expect(() => grid.render(ctx, 800, 600, { color: 'rgb(40, 230, 255)' })).not.toThrow();
    expect(() => grid.render(ctx, 800, 600, { color: 'rgba(40, 230, 255, 0.5)' })).not.toThrow();
  });
});
