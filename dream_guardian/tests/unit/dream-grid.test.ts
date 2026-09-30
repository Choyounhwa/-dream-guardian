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

  describe('피트니스 존 연한 연결선 렌더링 (Issue #188 / RENDER-TRACK-001)', () => {
    it('renderZoneConnections=true(기본값) 시 11개 피트니스 존으로 이어지는 연결선이 렌더링된다', () => {
      const grid = new DreamGrid();
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1080, 2160);

      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('renderZoneConnections=false 설정 시 피트니스 존 연결선 렌더링이 비활성화된다', () => {
      const grid = new DreamGrid();
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1080, 2160, { renderZoneConnections: false, hasCeiling: false });

      const mockCtxWithLines = createMockCtx();
      grid.render(mockCtxWithLines, 1080, 2160, { renderZoneConnections: true, hasCeiling: false });

      expect(vi.mocked(mockCtxWithLines.moveTo).mock.calls.length).toBeGreaterThan(
        vi.mocked(mockCtx.moveTo).mock.calls.length,
      );
    });

    it('zoneConnectionAlpha를 통해 연결선 투명도를 조절할 수 있다', () => {
      const grid = new DreamGrid();
      const mockCtx = createMockCtx();
      expect(() =>
        grid.render(mockCtx, 1080, 2160, {
          zoneConnectionAlpha: 0.25,
          renderZoneConnections: true,
        }),
      ).not.toThrow();
    });

    it('커스텀 zones 목록을 전달하면 해당 존들로만 연결선이 드로잉된다', () => {
      const grid = new DreamGrid();
      const mockCtx = createMockCtx();
      const customZones = [
        { id: 4, label: '좌', x: 0.04, y: 0.24, width: 0.26, height: 0.16 },
        { id: 5, label: '우', x: 0.70, y: 0.24, width: 0.26, height: 0.16 },
      ];
      grid.render(mockCtx, 1080, 2160, {
        zones: customZones,
        renderZoneConnections: true,
        hasCeiling: false,
      });

      const mockCtxAll = createMockCtx();
      grid.render(mockCtxAll, 1080, 2160, {
        renderZoneConnections: true,
        hasCeiling: false,
      });

      expect(vi.mocked(mockCtx.moveTo).mock.calls.length).toBeLessThan(
        vi.mocked(mockCtxAll.moveTo).mock.calls.length,
      );
    });
  });
});
