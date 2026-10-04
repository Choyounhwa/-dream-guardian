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
  LONGITUDINAL_GLOW_WIDTH_MULT,
  LONGITUDINAL_GLOW_ALPHA_MULT,
  BEAT_FLASH_MAX_ALPHA,
  BEAT_FLASH_WIDTH_BOOST,
  BEAT_FLASH_DECAY,
  TRANSVERSE_SPAN_MULTIPLIER,
  BEAT_GLOW_COLUMN_INDEX,
  BEAT_GLOW_COLOR,
  BEAT_GLOW_CORE_COLOR,
  BEAT_GLOW_WIDTH_MULT,
  BEAT_GLOW_ALPHA_BOOST,
  DEFAULT_GRID_CONFIG,
} from '../../config/grid.config.js';

function createMockCtx() {
  const lineWidths: number[] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  const linearGradientStops: { offset: number; color: string }[] = [];
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
      addColorStop: vi.fn((_offset: number, _color: string) => {
        // radial gradient
      }),
    })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn((offset: number, color: string) => {
        linearGradientStops.push({ offset, color });
      }),
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
    linearGradientStops,
  };

  return ctx as unknown as CanvasRenderingContext2D & {
    lineWidths: number[];
    fillStyles: string[];
    strokeStyles: string[];
    linearGradientStops: { offset: number; color: string }[];
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
      expect(PANEL_BG_COLOR).toBe('transparent');

      expect(TRANSVERSE_MAX_WIDTH).toBe(8.0);
      expect(TRANSVERSE_MIN_WIDTH).toBe(1.8);
      expect(LONGITUDINAL_MAX_WIDTH).toBe(6.0);
      expect(LONGITUDINAL_MIN_WIDTH).toBe(1.5);
      expect(CENTER_SPINE_MAX_WIDTH).toBe(8.0);
      expect(CENTER_SPINE_GLOW_WIDTH).toBe(12.0);
      expect(CENTER_SPINE_CORE_WIDTH).toBe(3.5);
      expect(LONGITUDINAL_GLOW_WIDTH_MULT).toBe(2.5);
      expect(LONGITUDINAL_GLOW_ALPHA_MULT).toBe(0.40);
      expect(BEAT_FLASH_MAX_ALPHA).toBe(0.35);
      expect(BEAT_FLASH_WIDTH_BOOST).toBe(1.5);
      expect(BEAT_FLASH_DECAY).toBe(4.5);

      expect(DEFAULT_GRID_CONFIG.HORIZON_RATIO).toBe(0.56);
      expect(DEFAULT_GRID_CONFIG.LONGITUDINAL_COLOR).toBe('#00E5FF');
      expect(DEFAULT_GRID_CONFIG.TRANSVERSE_COLOR).toBe('#FF7A28');
      expect(DEFAULT_GRID_CONFIG.CENTER_SPINE_COLOR).toBe('#E0F7FF');
      expect(DEFAULT_GRID_CONFIG.CROSSING_NODE_COLOR).toBe('#FFFFFF');
      expect(DEFAULT_GRID_CONFIG.PANEL_DEPTH_START).toBe(0.50);
      expect(DEFAULT_GRID_CONFIG.PANEL_BG_COLOR).toBe('transparent');
      expect(DEFAULT_GRID_CONFIG.TRANSVERSE_MAX_WIDTH).toBe(8.0);
      expect(DEFAULT_GRID_CONFIG.TRANSVERSE_MIN_WIDTH).toBe(1.8);
      expect(DEFAULT_GRID_CONFIG.LONGITUDINAL_MAX_WIDTH).toBe(6.0);
      expect(DEFAULT_GRID_CONFIG.LONGITUDINAL_MIN_WIDTH).toBe(1.5);
      expect(DEFAULT_GRID_CONFIG.LONGITUDINAL_GLOW_WIDTH_MULT).toBe(2.5);
      expect(DEFAULT_GRID_CONFIG.LONGITUDINAL_GLOW_ALPHA_MULT).toBe(0.40);
      expect(DEFAULT_GRID_CONFIG.BEAT_FLASH_MAX_ALPHA).toBe(0.35);
      expect(DEFAULT_GRID_CONFIG.BEAT_FLASH_WIDTH_BOOST).toBe(1.5);
      expect(DEFAULT_GRID_CONFIG.BEAT_FLASH_DECAY).toBe(4.5);
    });

    it('DreamGrid 인스턴스가 듀얼 네온 및 SFX 런웨이 기본 설정을 보유한다', () => {
      const grid = new DreamGrid();
      expect(grid.longitudinalColor).toBe('#00E5FF');
      expect(grid.transverseColor).toBe('#FF7A28');
      expect(grid.centerSpineColor).toBe('#E0F7FF');
      expect(grid.crossingNodeColor).toBe('#FFFFFF');
      expect(grid.panelDepthStart).toBe(0.50);
      expect(grid.panelBgColor).toBe('transparent');
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

    it('전경 패널 음영(Modular Panel Grooves, depthRatio >= 0.50) 영역에 메탈릭 패널 fill이 명시적 설정 시 적용된다', () => {
      const grid = new DreamGrid({
        hasCeiling: false,
        renderZoneConnections: false,
        panelBgColor: 'rgba(6, 10, 18, 0.90)',
      });
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

    it('[RENDER-GRID-003] 기본 렌더링 시 전경 바닥 quad fill이 건너뛰어져 웹캠 피드가 100% 투과된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();

      grid.render(mockCtx, 1920, 1080);

      // 불투명 전경 패널 색상이 fillStyles에 설정되지 않아야 함
      expect(mockCtx.fillStyles.includes('rgba(6, 10, 18, 0.90)')).toBe(false);
      expect(mockCtx.fillStyles.includes('transparent')).toBe(false);
    });

    it('[RENDER-GRID-003] panelBgColor가 명시적으로 불투명하게 주어질 때만 quad fill이 실행된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });

      // 1. 기본 투명 렌더링
      const mockCtxDefault = createMockCtx();
      grid.render(mockCtxDefault, 1920, 1080);
      const defaultFillCount = vi.mocked(mockCtxDefault.fill).mock.calls.length;

      // 2. 명시적 불투명 색상 지정 렌더링
      const mockCtxOpaque = createMockCtx();
      grid.render(mockCtxOpaque, 1920, 1080, { panelBgColor: 'rgba(6, 10, 18, 0.90)' });
      const opaqueFillCount = vi.mocked(mockCtxOpaque.fill).mock.calls.length;

      // 명시적 불투명 색상 지정 시 quad fill이 실행되어 fill 횟수가 유의미하게 많아야 함
      expect(opaqueFillCount).toBeGreaterThan(defaultFillCount);
      expect(mockCtxOpaque.fillStyles.includes('rgba(6, 10, 18, 0.90)')).toBe(true);
    });

    it('[RENDER-GRID-003] panelBgColor가 transparent, 빈 문자열, 또는 rgba(..., 0)일 때 quad fill이 모두 건너뛰어진다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });

      const mockCtxDefault = createMockCtx();
      grid.render(mockCtxDefault, 1920, 1080);
      const baseFillCount = vi.mocked(mockCtxDefault.fill).mock.calls.length;

      // transparent 명시
      const mockCtxTrans = createMockCtx();
      grid.render(mockCtxTrans, 1920, 1080, { panelBgColor: 'transparent' });
      expect(vi.mocked(mockCtxTrans.fill).mock.calls.length).toBe(baseFillCount);

      // 빈 문자열
      const mockCtxEmpty = createMockCtx();
      grid.render(mockCtxEmpty, 1920, 1080, { panelBgColor: '' });
      expect(vi.mocked(mockCtxEmpty.fill).mock.calls.length).toBe(baseFillCount);

      // 알파 0 rgba
      const mockCtxAlpha0 = createMockCtx();
      grid.render(mockCtxAlpha0, 1920, 1080, { panelBgColor: 'rgba(0, 0, 0, 0)' });
      expect(vi.mocked(mockCtxAlpha0.fill).mock.calls.length).toBe(baseFillCount);
    });

    it('[RENDER-GRID-003] 투명 와이어프레임 전환 후에도 세로 시안선, 가로 오렌지선, 중앙 척추선, 교차점 노드가 온전히 렌더링된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();

      grid.render(mockCtx, 1920, 1080);

      // 세로선 및 가로선 스트로크 수행 확인
      expect(vi.mocked(mockCtx.stroke).mock.calls.length).toBeGreaterThan(0);
      // 중앙 척추선 코어 두께 3.5 적용 확인
      expect(mockCtx.lineWidths.includes(3.5)).toBe(true);
      // 교차점 노드 코어 (#FFFFFF) 렌더링 확인
      expect(mockCtx.fillStyles.includes('#FFFFFF')).toBe(true);
      // 교차점 노드 보조 앰버 (#FFCB4D) 렌더링 확인
      expect(mockCtx.strokeStyles.includes('#FFCB4D')).toBe(true);
    });

    it('[RENDER-GRID-004] 일반 세로선(Longitudinal)이 2-Pass 네온 글로우(Pass 1: 외곽 소프트 글로우, Pass 2: 중심 코어)로 렌더링된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      grid.render(mockCtx, 1920, 1080);

      // 세로선 코어 두께: LONGITUDINAL_MIN_WIDTH(1.5) + (LONGITUDINAL_MAX_WIDTH(6.0) - 1.5) * 0.7 = 4.65
      const expectedCoreWidth = LONGITUDINAL_MIN_WIDTH + (LONGITUDINAL_MAX_WIDTH - LONGITUDINAL_MIN_WIDTH) * 0.7;
      const expectedGlowWidth = expectedCoreWidth * LONGITUDINAL_GLOW_WIDTH_MULT;

      // Pass 1 외곽 소프트 글로우 선폭과 Pass 2 중심 코어 선폭 모두 드로잉 호출에 포함되어야 함
      expect(mockCtx.lineWidths.some((w) => Math.abs(w - expectedCoreWidth) < 0.01)).toBe(true);
      expect(mockCtx.lineWidths.some((w) => Math.abs(w - expectedGlowWidth) < 0.01)).toBe(true);
    });

    it('[RENDER-GRID-004] 메트로놈 beatProgress에 따라 비트 직후(0.0) 선폭 및 알파 부스트 플래시가 적용된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });

      // 1. 비트 직후 피크 (beatProgress = 0.0)
      const mockCtxPeak = createMockCtx();
      grid.render(mockCtxPeak, 1920, 1080, { beatProgress: 0.0 });

      // 2. 비트 끝자락 감쇄 (beatProgress = 0.9)
      const mockCtxDecayed = createMockCtx();
      grid.render(mockCtxDecayed, 1920, 1080, { beatProgress: 0.9 });

      // 피크 시점 세로선 코어 두께: expectedCoreWidth * BEAT_FLASH_WIDTH_BOOST
      const baseCoreWidth = LONGITUDINAL_MIN_WIDTH + (LONGITUDINAL_MAX_WIDTH - LONGITUDINAL_MIN_WIDTH) * 0.7;
      const boostedCoreWidth = baseCoreWidth * BEAT_FLASH_WIDTH_BOOST;

      expect(mockCtxPeak.lineWidths.some((w) => Math.abs(w - boostedCoreWidth) < 0.01)).toBe(true);

      // 피크 시점 최대 선폭이 감쇄 시점 최대 선폭보다 유의미하게 큼
      const maxPeakWidth = Math.max(...mockCtxPeak.lineWidths);
      const maxDecayedWidth = Math.max(...mockCtxDecayed.lineWidths);
      expect(maxPeakWidth).toBeGreaterThan(maxDecayedWidth);
    });

    it('[RENDER-GRID-004] setBeatProgress, triggerBeatFlash, enableBeatFlash 제어 메서드가 올바르게 작동한다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });

      // setBeatProgress
      grid.setBeatProgress(0.0);
      expect(grid.beatProgress).toBe(0.0);

      const mockCtx1 = createMockCtx();
      grid.render(mockCtx1, 1920, 1080);
      const baseCoreWidth = LONGITUDINAL_MIN_WIDTH + (LONGITUDINAL_MAX_WIDTH - LONGITUDINAL_MIN_WIDTH) * 0.7;
      expect(mockCtx1.lineWidths.some((w) => Math.abs(w - baseCoreWidth * BEAT_FLASH_WIDTH_BOOST) < 0.01)).toBe(true);

      // enableBeatFlash: false 일 경우 비트 플래시 미적용
      grid.setEnableBeatFlash(false);
      expect(grid.enableBeatFlash).toBe(false);

      const mockCtxDisabled = createMockCtx();
      grid.render(mockCtxDisabled, 1920, 1080);
      expect(mockCtxDisabled.lineWidths.some((w) => Math.abs(w - baseCoreWidth * BEAT_FLASH_WIDTH_BOOST) < 0.01)).toBe(false);

      // 다시 활성화 후 triggerBeatFlash() 및 update 감쇄 검증
      grid.setEnableBeatFlash(true);
      grid.setBeatProgress(undefined);
      grid.triggerBeatFlash(1.0);

      const mockCtxTriggered = createMockCtx();
      grid.render(mockCtxTriggered, 1920, 1080);
      expect(mockCtxTriggered.lineWidths.some((w) => Math.abs(w - baseCoreWidth * BEAT_FLASH_WIDTH_BOOST) < 0.01)).toBe(true);

      // update 후 수동 플래시 감쇄
      grid.update(0.5); // 0.5초 경과
      const mockCtxAfterUpdate = createMockCtx();
      grid.render(mockCtxAfterUpdate, 1920, 1080);
      const maxAfterWidth = Math.max(...mockCtxAfterUpdate.lineWidths);
      expect(maxAfterWidth).toBeLessThan(Math.max(...mockCtxTriggered.lineWidths));
    });

    it('[RENDER-GRID-005] 바닥 가로선 좌우 길이가 TRANSVERSE_SPAN_MULTIPLIER 설정값에 비례하여 확장되어 와이드 지대를 렌더링한다', () => {
      // TRANSVERSE_SPAN_MULTIPLIER 상수가 1.0보다 크며 지대를 넓혀주는 값으로 정의되어 있는지 확인
      expect(TRANSVERSE_SPAN_MULTIPLIER).toBeGreaterThanOrEqual(1.5);

      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      const w = 1920;
      const h = 1080;

      grid.render(mockCtx, w, h);

      // moveTo/lineTo 호출 중 바닥 가로선 드로잉 좌표(vx - halfW, vx + halfW) 추적
      const lineToCalls = vi.mocked(mockCtx.lineTo).mock.calls;
      const moveToCalls = vi.mocked(mockCtx.moveTo).mock.calls;

      // 기존 1.0 배율 기준 최대 halfW: (w * 0.5 + 50) * 1.0 = 1010
      // 신규 TRANSVERSE_SPAN_MULTIPLIER(예: 1.8배) 기준 최대 halfW는 기존 1010보다 명확히 커야 함
      const maxTransverseX = Math.max(...lineToCalls.map((call) => call[0]));
      const minTransverseX = Math.min(...moveToCalls.map((call) => call[0]));

      expect(maxTransverseX).toBeGreaterThan(w * 0.5 + 50);
      expect(minTransverseX).toBeLessThan(w * 0.5 - 50);

      // 확장된 가로선이 화면 좌우 경계를 충분히 커버하여 와이드 지대를 형성하는지 검증
      // 1080p 기준 depthRatio가 큰 전경 가로선의 경우 화면 폭 1920을 넉넉히 초과하는 좌표로 드로잉됨
      expect(maxTransverseX).toBeGreaterThanOrEqual(w * 0.7);
      expect(minTransverseX).toBeLessThanOrEqual(w * 0.3);
    });

    it('[RENDER-GRID-005] transverseSpanMultiplier 옵션 및 setTransverseSpanMultiplier 메서드로 가로선 지대 폭을 동적 제어할 수 있다', () => {
      const grid = new DreamGrid({ transverseSpanMultiplier: 2.5, hasCeiling: false, renderZoneConnections: false });
      expect(grid.transverseSpanMultiplier).toBe(2.5);

      const mockCtx1 = createMockCtx();
      grid.render(mockCtx1, 1920, 1080);
      const maxTransverseX1 = Math.max(...vi.mocked(mockCtx1.lineTo).mock.calls.map((c) => c[0]));

      grid.setTransverseSpanMultiplier(1.0);
      expect(grid.transverseSpanMultiplier).toBe(1.0);

      const mockCtx2 = createMockCtx();
      grid.render(mockCtx2, 1920, 1080);
      const maxTransverseX2 = Math.max(...vi.mocked(mockCtx2.lineTo).mock.calls.map((c) => c[0]));

      // 2.5 배율일 때의 최대 x 좌표가 1.0 배율일 때보다 훨씬 커야 함
      expect(maxTransverseX1).toBeGreaterThan(maxTransverseX2);
    });

    it('[RENDER-GRID-006] 비트 글로우 세로선 상수(BEAT_GLOW_COLUMN_INDEX = 4 등)가 올바르게 설정되어 있다', () => {
      expect(BEAT_GLOW_COLUMN_INDEX).toBe(4);
      expect(BEAT_GLOW_COLOR).toBe('#00E5FF');
      expect(BEAT_GLOW_CORE_COLOR).toBe('#E0FFFF');
      expect(BEAT_GLOW_WIDTH_MULT).toBeGreaterThan(1.0);
      expect(BEAT_GLOW_ALPHA_BOOST).toBeGreaterThan(0);
    });

    it('[RENDER-GRID-006] 음악 비트에 따라 중심 기준 양옆 4번째 세로선(j = ±4)이 Cyan 글로우로 렌더링된다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const mockCtx = createMockCtx();
      const w = 1920;
      const h = 1080;
      const vx = w * 0.5;
      const floorH = h - h * HORIZON_RATIO;
      const stepXBottom = Math.max(32, floorH * (0.2 / (1.0 + 0.2)) * 1.8);

      // 비트 피크 상태 (beatProgress: 0.0)
      grid.setBeatProgress(0.0);
      grid.render(mockCtx, w, h);

      const targetXLeft = vx - 4 * stepXBottom;
      const targetXRight = vx + 4 * stepXBottom;

      // moveTo 또는 lineTo 호출 중 j = ±4 위치에 대한 선 렌더링이 수행되었는지 검증
      const lineToCalls = vi.mocked(mockCtx.lineTo).mock.calls;
      const hasLeftRail = lineToCalls.some((call) => Math.abs(call[0] - targetXLeft) < 1.0);
      const hasRightRail = lineToCalls.some((call) => Math.abs(call[0] - targetXRight) < 1.0);

      expect(hasLeftRail).toBe(true);
      expect(hasRightRail).toBe(true);

      // j = ±4 세로선의 선폭 및 그라디언트에 Cyan 글로우 특성이 반영되었는지 검증
      const gradStops = mockCtx.linearGradientStops;
      const hasCyanStop = gradStops.some((stop) =>
        stop.color.includes('0, 229, 255') || stop.color.includes('0,229,255') || stop.color.toLowerCase().includes('#00e5ff')
      );
      expect(hasCyanStop).toBe(true);
    });

    it('[RENDER-GRID-006] 비트 플래시 강도에 따라 4번째 세로선의 글로우 선폭과 강도가 동적으로 변화한다', () => {
      const grid = new DreamGrid({ hasCeiling: false, renderZoneConnections: false });
      const w = 1920;
      const h = 1080;

      // 1) 비트 피크 시점 (flashFactor = 1.0)
      grid.setBeatProgress(0.0);
      const mockCtxPeak = createMockCtx();
      grid.render(mockCtxPeak, w, h);

      // 2) 비트 완전 감쇄/무반응 시점 (beatProgress: 1.0 또는 flash 비활성)
      grid.setBeatProgress(1.0);
      const mockCtxDecayed = createMockCtx();
      grid.render(mockCtxDecayed, w, h);

      // 피크 시점의 최대 선폭이 감쇄 시점보다 유의미하게 큼
      const maxPeakWidth = Math.max(...mockCtxPeak.lineWidths);
      const maxDecayedWidth = Math.max(...mockCtxDecayed.lineWidths);
      expect(maxPeakWidth).toBeGreaterThan(maxDecayedWidth);

      // get / set 접근자 지원 검증
      expect(grid.beatGlowColumnIndex).toBe(4);
      expect(grid.beatGlowColor).toBe('#00E5FF');
      grid.setBeatGlowColor('#28E6FF');
      expect(grid.beatGlowColor).toBe('#28E6FF');
    });
  });
});

