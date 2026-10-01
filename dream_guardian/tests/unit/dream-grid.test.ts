import { describe, it, expect, vi } from 'vitest';
import { DreamGrid } from '../../src/render/DreamGrid.js';
import {
  HORIZON_RATIO,
  LONGITUDINAL_COLOR,
  TRANSVERSE_COLOR,
  CENTER_SPINE_COLOR,
  CROSSING_NODE_COLOR,
  PANEL_DEPTH_START,
  PANEL_BG_COLOR,
  TRANSVERSE_MAX_WIDTH,
  TRANSVERSE_MIN_WIDTH,
  LONGITUDINAL_MAX_WIDTH,
  LONGITUDINAL_MIN_WIDTH,
  CENTER_SPINE_MAX_WIDTH,
  CENTER_SPINE_GLOW_WIDTH,
  CENTER_SPINE_CORE_WIDTH,
  DEFAULT_GRID_CONFIG,
} from '../../config/grid.config.js';

function createMockCtx() {
  const lineWidths: number[] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  let _lineWidth = 1;
  let _fillStyle: any = '';
  let _strokeStyle: any = '';

  const ctx = {
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
    get lineWidth() {
      return _lineWidth;
    },
    set lineWidth(val: number) {
      _lineWidth = val;
      lineWidths.push(val);
    },
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(val: any) {
      _fillStyle = val;
      fillStyles.push(typeof val === 'string' ? val : '');
    },
    get strokeStyle() {
      return _strokeStyle;
    },
    set strokeStyle(val: any) {
      _strokeStyle = val;
      strokeStyles.push(typeof val === 'string' ? val : '');
    },
    lineWidths,
    fillStyles,
    strokeStyles,
  };

  return ctx as unknown as CanvasRenderingContext2D & {
    lineWidths: number[];
    fillStyles: string[];
    strokeStyles: string[];
  };
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

  describe('Issue #282: [FEAT-GRID-002] SFX 런웨이 원근 드림 그리드 비주얼 전면 개편', () => {
    it('grid.config.ts에 SFX 런웨이 전용 지평선, 색상, 두께 상수들이 정의되어 있다', () => {
      expect(HORIZON_RATIO).toBe(0.56);
      expect(LONGITUDINAL_COLOR).toBe('#00E5FF');
      expect(TRANSVERSE_COLOR).toBe('#FF7A28');
      expect(CENTER_SPINE_COLOR).toBe('#E0F7FF');
      expect(CROSSING_NODE_COLOR).toBe('#FFFFFF');
      expect(PANEL_DEPTH_START).toBe(0.50);
      expect(PANEL_BG_COLOR).toBe('rgba(6, 10, 18, 0.90)');

      expect(TRANSVERSE_MAX_WIDTH).toBe(6.0);
      expect(TRANSVERSE_MIN_WIDTH).toBe(1.0);
      expect(LONGITUDINAL_MAX_WIDTH).toBe(4.5);
      expect(LONGITUDINAL_MIN_WIDTH).toBe(0.8);
      expect(CENTER_SPINE_MAX_WIDTH).toBe(8.0);
      expect(CENTER_SPINE_GLOW_WIDTH).toBe(12.0);
      expect(CENTER_SPINE_CORE_WIDTH).toBe(3.5);

      expect(DEFAULT_GRID_CONFIG.HORIZON_RATIO).toBe(0.56);
      expect(DEFAULT_GRID_CONFIG.LONGITUDINAL_COLOR).toBe('#00E5FF');
      expect(DEFAULT_GRID_CONFIG.TRANSVERSE_COLOR).toBe('#FF7A28');
      expect(DEFAULT_GRID_CONFIG.CENTER_SPINE_COLOR).toBe('#E0F7FF');
      expect(DEFAULT_GRID_CONFIG.CROSSING_NODE_COLOR).toBe('#FFFFFF');
      expect(DEFAULT_GRID_CONFIG.PANEL_DEPTH_START).toBe(0.50);
      expect(DEFAULT_GRID_CONFIG.PANEL_BG_COLOR).toBe('rgba(6, 10, 18, 0.90)');
    });

    it('DreamGrid 인스턴스가 듀얼 네온 및 SFX 런웨이 기본 설정을 보유한다', () => {
      const grid = new DreamGrid();
      expect(grid.longitudinalColor).toBe('#00E5FF');
      expect(grid.transverseColor).toBe('#FF7A28');
      expect(grid.centerSpineColor).toBe('#E0F7FF');
      expect(grid.crossingNodeColor).toBe('#FFFFFF');
      expect(grid.panelDepthStart).toBe(0.50);
      expect(grid.panelBgColor).toBe('rgba(6, 10, 18, 0.90)');
    });

    it('가로선(Transverse)은 네온 오렌지(#FF7A28) 및 2-Pass 순백 코어(#FFF8F0)로 렌더링된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1920, 1080);

      expect(mockCtx.strokeStyles.includes('#FF7A28')).toBe(true);
      expect(mockCtx.strokeStyles.includes('#FFF8F0')).toBe(true);
    });

    it('중앙 척추선(Center Spine) 렌더링 시 외곽 글로우(12px), 미드 글로우(8px), 순백 코어(3.5px)가 드로잉된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1920, 1080);

      expect(mockCtx.lineWidths.includes(12.0)).toBe(true);
      expect(mockCtx.lineWidths.includes(8.0)).toBe(true);
      expect(mockCtx.lineWidths.includes(3.5)).toBe(true);
    });

    it('전경 패널 음영(Modular Panel Grooves, depthRatio >= 0.50) 영역에 메탈릭 패널 fill이 적용된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1920, 1080);

      expect(mockCtx.fillStyles.includes('rgba(6, 10, 18, 0.90)')).toBe(true);
      expect(mockCtx.closePath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('교차점 노드(Intersection Nodes)가 전경 교차점에 마름모/크로스로 드로잉된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1920, 1080);

      // 교차점 노드 fillStyle(#FFFFFF) 확인
      expect(mockCtx.fillStyles.includes('#FFFFFF')).toBe(true);
    });

    it('하위 호환성: config.color 오버라이드 및 setters가 정상 작동한다', () => {
      const grid = new DreamGrid({ color: '#FF0055' });
      expect(grid.longitudinalColor).toBe('#FF0055');
      expect(grid.color).toBe('#FF0055');

      grid.setLongitudinalColor('#00FFCC');
      expect(grid.longitudinalColor).toBe('#00FFCC');

      grid.setTransverseColor('#FFAA00');
      expect(grid.transverseColor).toBe('#FFAA00');

      grid.setCenterSpineColor('#FFFFFF');
      expect(grid.centerSpineColor).toBe('#FFFFFF');

      grid.setCrossingNodeColor('#FFFF00');
      expect(grid.crossingNodeColor).toBe('#FFFF00');

      grid.setPanelDepthStart(0.6);
      expect(grid.panelDepthStart).toBe(0.6);

      grid.setPanelBgColor('rgba(20, 20, 40, 0.5)');
      expect(grid.panelBgColor).toBe('rgba(20, 20, 40, 0.5)');
    });

    it('render() 시 config 인자로 전달된 SFX 런웨이 색상 및 옵션이 즉시 오버라이드된다', () => {
      const grid = new DreamGrid();
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1920, 1080, {
        longitudinalColor: '#00E5FF',
        transverseColor: '#FF6600',
        centerSpineColor: '#E0FFFF',
        crossingNodeColor: '#EEEEEE',
        crossingNodeSecondaryColor: '#FFD700',
        panelBgColor: 'rgba(25, 35, 60, 0.6)',
        hasCeiling: false,
        renderZoneConnections: false,
      });

      expect(mockCtx.strokeStyles.includes('#FF6600')).toBe(true);
      expect(mockCtx.strokeStyles.includes('#FFD700')).toBe(true);
      expect(mockCtx.fillStyles.includes('rgba(25, 35, 60, 0.6)')).toBe(true);
      expect(mockCtx.fillStyles.includes('#EEEEEE')).toBe(true);
      expect(mockCtx.lineWidths.includes(3.5)).toBe(true);
    });

    it('panelDepthStart가 높을수록 전경 패널 및 노드가 더 적게 생성된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });

      const mockCtxDefault = createMockCtx();
      grid.render(mockCtxDefault, 1920, 1080, { panelDepthStart: 0.50 });
      const fillCountDefault = vi.mocked(mockCtxDefault.fill).mock.calls.length;

      const mockCtxDeep = createMockCtx();
      grid.render(mockCtxDeep, 1920, 1080, { panelDepthStart: 0.95 });
      const fillCountDeep = vi.mocked(mockCtxDeep.fill).mock.calls.length;

      expect(fillCountDefault).toBeGreaterThan(fillCountDeep);
    });
  });
});
