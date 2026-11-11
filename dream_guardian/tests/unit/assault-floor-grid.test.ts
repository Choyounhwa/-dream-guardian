/**
 * assault-floor-grid.test.ts
 *
 * [ASSAULT-FX-001] (Issue #690)
 * - 비트 그리드 펄스 복원 및 분리형 바닥 판정선(AssaultFloorMatAdapter) 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HORIZON_RATIO } from '../../config/grid.config.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import { AssaultFloorMatAdapter } from '../../src/render/assault/AssaultFloorMatAdapter.js';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import type { MainSceneContext } from '../../src/core/SceneDirector.js';
import type { RunningMatRenderer } from '../../src/render/RunningMatRenderer.js';

describe('[ASSAULT-FX-001] 비트 그리드 펄스 및 분리형 바닥 판정선 어댑터', () => {
  describe('1. assault-visual.config 설정 검증', () => {
    it('DEFAULT_ASSAULT_VISUAL_CONFIG에 enableFloorMat이 true로 정의되어 있어야 한다', () => {
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.enableFloorMat).toBe(true);
    });

    it('비트 그리드 펄스 관련 설정(gridPulseSecondsPerBeat, enableGridPulse)이 정의되어 있어야 한다', () => {
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.gridPulseSecondsPerBeat).toBe(0.5);
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.enableGridPulse).toBe(true);
    });

    it('설정 객체는 freeze되어 불변성을 보장해야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG)).toBe(true);
    });
  });

  describe('2. AssaultFloorMatAdapter 격리 및 On/Off 제어 검증', () => {
    let mockContext2d: CanvasRenderingContext2D;
    let mockRunningMatRenderer: RunningMatRenderer;

    beforeEach(() => {
      mockContext2d = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      mockRunningMatRenderer = {
        render: vi.fn(),
      } as unknown as RunningMatRenderer;
    });

    it('enableFloorMat: true일 때 RunningMatRenderer.render를 호출하고 true를 반환해야 한다', () => {
      const adapter = new AssaultFloorMatAdapter({
        runningMatRenderer: mockRunningMatRenderer,
        enableFloorMat: true,
      });

      const result = adapter.render(mockContext2d, 1920, 1080, {
        vanishingPoint: { x: 960, y: 259.2 },
        elapsedTime: 1.5,
        beatProgress: 0.25,
      });

      expect(result).toBe(true);
      expect(mockRunningMatRenderer.render).toHaveBeenCalledTimes(1);
      expect(mockRunningMatRenderer.render).toHaveBeenCalledWith(
        mockContext2d,
        null,
        1920,
        1080,
        expect.objectContaining({
          vanishingPoint: { x: 960, y: 259.2 },
          elapsedTime: 1.5,
          beatProgress: 0.25,
        })
      );
    });

    it('enableFloorMat: false일 때 렌더러를 호출하지 않고 즉시 false를 반환해야 한다 (0 draw)', () => {
      const adapter = new AssaultFloorMatAdapter({
        runningMatRenderer: mockRunningMatRenderer,
        enableFloorMat: false,
      });

      const result = adapter.render(mockContext2d, 1920, 1080, {
        vanishingPoint: { x: 960, y: 259.2 },
        elapsedTime: 1.5,
        beatProgress: 0.25,
      });

      expect(result).toBe(false);
      expect(mockRunningMatRenderer.render).not.toHaveBeenCalled();
    });

    it('render 호출 시 options.enableFloorMat 오버라이드가 작동해야 한다', () => {
      const adapter = new AssaultFloorMatAdapter({
        runningMatRenderer: mockRunningMatRenderer,
        enableFloorMat: true,
      });

      const disabledResult = adapter.render(mockContext2d, 1920, 1080, {
        vanishingPoint: { x: 960, y: 259.2 },
        enableFloorMat: false,
      });

      expect(disabledResult).toBe(false);
      expect(mockRunningMatRenderer.render).not.toHaveBeenCalled();
    });

    it('options로 전달된 runningMatRenderer를 우선 사용해야 한다', () => {
      const adapter = new AssaultFloorMatAdapter({
        runningMatRenderer: mockRunningMatRenderer,
        enableFloorMat: true,
      });
      const overrideRenderer = { render: vi.fn() } as unknown as RunningMatRenderer;

      adapter.render(mockContext2d, 1920, 1080, {
        vanishingPoint: { x: 960, y: 259.2 },
        runningMatRenderer: overrideRenderer,
      });

      expect(overrideRenderer.render).toHaveBeenCalledTimes(1);
      expect(mockRunningMatRenderer.render).not.toHaveBeenCalled();
    });

    it('비정상 뷰포트 크기에서는 렌더링하지 않고 false를 반환해야 한다', () => {
      const adapter = new AssaultFloorMatAdapter({
        runningMatRenderer: mockRunningMatRenderer,
        enableFloorMat: true,
      });

      const resultZero = adapter.render(mockContext2d, 0, 1080, {
        vanishingPoint: { x: 0, y: 0 },
      });
      expect(resultZero).toBe(false);
      expect(mockRunningMatRenderer.render).not.toHaveBeenCalled();
    });
  });

  describe('3. AssaultSceneHandler 비트 그리드 펄스 및 어댑터 연동 검증', () => {
    let mockCtx: any;
    let mockDreamGrid: any;
    let mockFloorMatAdapter: any;

    beforeEach(() => {
      mockDreamGrid = {
        render: vi.fn(),
        update: vi.fn(),
      };

      mockFloorMatAdapter = {
        render: vi.fn().mockReturnValue(true),
      };

      const mockCanvasCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 100 }),
        drawImage: vi.fn(),
        setLineDash: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
          addColorStop: vi.fn(),
        }),
        createRadialGradient: vi.fn().mockReturnValue({
          addColorStop: vi.fn(),
        }),
      } as unknown as CanvasRenderingContext2D;

      mockCtx = {
        canvasManager: {
          ctx: mockCanvasCtx,
          virtualWidth: 1920,
          virtualHeight: 1080,
        },
        dreamGrid: mockDreamGrid,
        runningMatRenderer: { render: vi.fn() },
        state: { currentChapter: 1 },
        cameraLayer: { isActive: false },
        imageLoader: { get: vi.fn() },
        assaultSession: {
          sessionId: 'test-session',
          clock: {
            activeSeconds: 1.25, // 1.25s at spb=0.5 -> (1.25 / 0.5) % 1.0 = 2.5 % 1.0 = 0.5
          },
        },
      };
    });

    it('activeSeconds와 spb(0.5) 기반으로 beatProgress를 계산하여 dreamGrid.render에 전달해야 한다', () => {
      const handler = new AssaultSceneHandler({
        assaultFloorMatAdapter: mockFloorMatAdapter,
      });

      handler.render(mockCtx as MainSceneContext);

      expect(mockDreamGrid.render).toHaveBeenCalledTimes(1);
      const gridCallArgs = mockDreamGrid.render.mock.calls[0];
      const gridOptions = gridCallArgs[3];

      expect(gridOptions).toBeDefined();
      expect(gridOptions.beatProgress).toBeCloseTo(0.5, 5);
      expect(gridOptions.color).toBe('#FF8844');
    });

    it('dreamGrid.render 직후 바닥 판정선 어댑터(AssaultFloorMatAdapter)를 호출해야 한다', () => {
      const callOrder: string[] = [];
      mockDreamGrid.render.mockImplementation(() => {
        callOrder.push('dreamGrid');
      });
      mockFloorMatAdapter.render.mockImplementation(() => {
        callOrder.push('floorMat');
        return true;
      });

      const handler = new AssaultSceneHandler({
        assaultFloorMatAdapter: mockFloorMatAdapter,
      });

      handler.render(mockCtx as MainSceneContext);

      expect(callOrder).toEqual(['dreamGrid', 'floorMat']);
      expect(mockFloorMatAdapter.render).toHaveBeenCalledWith(
        mockCtx.canvasManager.ctx,
        1920,
        1080,
        expect.objectContaining({
          vanishingPoint: { x: 960, y: 1080 * HORIZON_RATIO },
          elapsedTime: 1.25,
          beatProgress: expect.any(Number),
        })
      );
    });

    it('renderScene 별칭 메서드가 render와 동일하게 정상 동작해야 한다', () => {
      const handler = new AssaultSceneHandler({
        assaultFloorMatAdapter: mockFloorMatAdapter,
      });

      expect(typeof handler.renderScene).toBe('function');
      handler.renderScene(mockCtx as MainSceneContext);
      expect(mockDreamGrid.render).toHaveBeenCalledTimes(1);
      expect(mockFloorMatAdapter.render).toHaveBeenCalledTimes(1);
    });

    it('session이 없거나 clock이 없을 때도 기본 beatProgress가 계산되고 예외가 발생하지 않아야 한다', () => {
      mockCtx.assaultSession = null;
      mockCtx.engine = { elapsedTime: 0.75 };

      const handler = new AssaultSceneHandler({
        assaultFloorMatAdapter: mockFloorMatAdapter,
      });

      expect(() => handler.render(mockCtx as MainSceneContext)).not.toThrow();
      expect(mockDreamGrid.render).toHaveBeenCalledTimes(1);
      const gridOptions = mockDreamGrid.render.mock.calls[0][3];
      expect(gridOptions.beatProgress).toBeCloseTo(0.5, 5); // 0.75 / 0.5 = 1.5 -> 0.5
    });
  });
});
