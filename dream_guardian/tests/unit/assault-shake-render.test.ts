import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../config/assault-visual.config.js';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';

describe('[ASSAULT-FX-002] 어설트 화면 흔들림(Screen Shake) 및 이펙트 파이프라인 연동', () => {
  describe('1. 비주얼 설정(assault-visual.config.ts) 검증', () => {
    it('DEFAULT_ASSAULT_VISUAL_CONFIG 에 화면 흔들림 및 shake 파라미터가 정확히 정의되어 있어야 한다', () => {
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.enableScreenShake).toBe(true);
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.correctShake).toEqual({
        intensity: 14,
        duration: 0.35,
      });
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.wrongShake).toEqual({
        intensity: 4,
        duration: 0.18,
      });
    });

    it('설정 객체는 deepFreeze 되어 불변성이 보장되어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.correctShake)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.wrongShake)).toBe(true);
    });
  });

  describe('2. AssaultSceneHandler 화면 흔들림 변위 및 렌더 파이프라인 검증', () => {
    let callOrder: string[];
    let mockCtx: any;
    let mockContext2d: any;

    beforeEach(() => {
      callOrder = [];
      mockContext2d = {
        save: vi.fn(() => callOrder.push('save')),
        translate: vi.fn((x: number, y: number) => callOrder.push(`translate(${x},${y})`)),
        restore: vi.fn(() => callOrder.push('restore')),
      };

      mockCtx = {
        canvasManager: {
          ctx: mockContext2d,
          virtualWidth: 1080,
          virtualHeight: 2160,
        },
        cameraLayer: { isActive: false },
        imageLoader: { get: vi.fn(() => null) },
        dreamGrid: {
          render: vi.fn(() => callOrder.push('dreamGrid.render')),
        },
        effectManager: {
          shakeOffsetX: 0,
          shakeOffsetY: 0,
          render: vi.fn((_c: any, w: number, h: number) => callOrder.push(`effectManager.render(${w},${h})`)),
        },
        runningMatRenderer: undefined,
        bottomBar: {
          render: vi.fn(() => callOrder.push('bottomBar.render')),
        },
        state: {
          screenMode: 'game',
          currentChapter: 1,
          actionHoverTimer: 0.2,
        },
        engine: { elapsedTime: 5.0 },
      };
    });

    it('흔들림 변위(shakeOffsetX/Y)가 존재할 때 월드 렌더링 전 translate가 적용되고 restore 후 HUD가 그려져야 한다', () => {
      mockCtx.effectManager.shakeOffsetX = 14;
      mockCtx.effectManager.shakeOffsetY = -7;

      const mockAssaultRenderer = {
        render: vi.fn(() => callOrder.push('assaultRenderer.render')),
      };
      const mockHud = {
        render: vi.fn(() => callOrder.push('hud.render')),
      };

      const handler = new AssaultSceneHandler({
        assaultSceneRenderer: mockAssaultRenderer as any,
      });

      mockCtx.assaultSession = {
        snapshot: { id: 'test_snap' },
        hud: mockHud,
      };

      handler.render(mockCtx);

      expect(mockContext2d.save).toHaveBeenCalled();
      expect(mockContext2d.translate).toHaveBeenCalledWith(14, -7);
      expect(mockCtx.dreamGrid.render).toHaveBeenCalled();
      expect(mockAssaultRenderer.render).toHaveBeenCalled();
      expect(mockCtx.effectManager.render).toHaveBeenCalledWith(mockContext2d, 1080, 2160);
      expect(mockContext2d.restore).toHaveBeenCalled();
      expect(mockHud.render).toHaveBeenCalled();

      // 엄격한 순서 검증:
      // save -> translate -> dreamGrid -> assaultRenderer -> effectManager.render -> restore -> hud.render
      const saveIdx = callOrder.indexOf('save');
      const translateIdx = callOrder.indexOf('translate(14,-7)');
      const gridIdx = callOrder.indexOf('dreamGrid.render');
      const sceneIdx = callOrder.indexOf('assaultRenderer.render');
      const effectIdx = callOrder.indexOf('effectManager.render(1080,2160)');
      const restoreIdx = callOrder.indexOf('restore');
      const hudIdx = callOrder.indexOf('hud.render');

      expect(saveIdx).toBeLessThan(translateIdx);
      expect(translateIdx).toBeLessThan(gridIdx);
      expect(gridIdx).toBeLessThan(sceneIdx);
      expect(sceneIdx).toBeLessThan(effectIdx);
      expect(effectIdx).toBeLessThan(restoreIdx);
      expect(restoreIdx).toBeLessThan(hudIdx);
    });

    it('흔들림 변위가 0일 때는 translate를 호출하지 않으나 save/restore는 정상 수행되어야 한다', () => {
      mockCtx.effectManager.shakeOffsetX = 0;
      mockCtx.effectManager.shakeOffsetY = 0;

      const mockHud = {
        render: vi.fn(() => callOrder.push('hud.render')),
      };

      const handler = new AssaultSceneHandler();
      mockCtx.assaultSession = {
        hud: mockHud,
      };

      handler.render(mockCtx);

      expect(mockContext2d.save).toHaveBeenCalled();
      expect(mockContext2d.translate).not.toHaveBeenCalled();
      expect(mockContext2d.restore).toHaveBeenCalled();
      expect(mockHud.render).toHaveBeenCalled();
    });

    it('enableScreenShake: false 설정 시 shakeOffsetX/Y가 있어도 translate를 호출하지 않아야 한다', () => {
      mockCtx.effectManager.shakeOffsetX = 14;
      mockCtx.effectManager.shakeOffsetY = 5;

      const disabledConfig: AssaultVisualConfig = {
        ...DEFAULT_ASSAULT_VISUAL_CONFIG,
        enableScreenShake: false,
      };

      const handler = new AssaultSceneHandler({
        visualConfig: disabledConfig,
      });

      handler.render(mockCtx);

      expect(mockContext2d.save).toHaveBeenCalled();
      expect(mockContext2d.translate).not.toHaveBeenCalled();
      expect(mockContext2d.restore).toHaveBeenCalled();
    });

    it('effectManager 가 없거나 render 가 누락된 환경에서도 에러 없이 정상 렌더링되어야 한다', () => {
      mockCtx.effectManager = undefined;

      const handler = new AssaultSceneHandler();
      expect(() => handler.render(mockCtx)).not.toThrow();
      expect(mockContext2d.save).toHaveBeenCalled();
      expect(mockContext2d.restore).toHaveBeenCalled();
    });

    it('renderHUD() 호출 시 고정 좌표 UI(BottomBar)가 정상 렌더링되어야 한다', () => {
      const handler = new AssaultSceneHandler();
      const handled = handler.renderHUD(mockCtx);

      expect(handled).toBe(true);
      expect(mockCtx.bottomBar.render).toHaveBeenCalledWith(
        mockContext2d,
        1080,
        2160,
        expect.objectContaining({
          actionLabel: '정지',
          actionColor: '#FF4444',
          pageId: 'pause',
        })
      );
    });
  });
});
