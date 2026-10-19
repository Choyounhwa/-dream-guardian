import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import { SceneDirector, createMainGameDirector } from '../../src/core/SceneDirector.js';

describe('AssaultSceneHandler (#619)', () => {
  let handler: AssaultSceneHandler;
  let mockContext: any;

  beforeEach(() => {
    handler = new AssaultSceneHandler();
    mockContext = {
      canvasManager: {
        ctx: {
          save: vi.fn(),
          restore: vi.fn(),
        },
        virtualWidth: 1080,
        virtualHeight: 2160,
      },
      cameraLayer: { isActive: false },
      imageLoader: { get: vi.fn(() => null) },
      dreamGrid: {
        render: vi.fn(),
        update: vi.fn(),
      },
      effectManager: {
        update: vi.fn(),
        render: vi.fn(),
      },
      guardian: { update: vi.fn() },
      bossRenderer: { update: vi.fn() },
      boss: { update: vi.fn() },
      dialogueOverlayRenderer: { update: vi.fn() },
      bottomBar: { render: vi.fn() },
      pauseModal: { isOpen: false },
      state: {
        screenMode: 'game',
        currentChapter: 1,
        feedbackTimer: 0.5,
        feedbackCustomText: 'EXCELLENT',
        feedbackCustomColor: '#00FF00',
        castingFlash: 0.3,
        actionHoverTimer: 0.4,
      },
      sessionContext: null,
      assaultSession: null,
      engine: { elapsedTime: 12.5 },
    };
  });

  describe('isAssaultMode & getAssaultSession 판정', () => {
    it('sessionContext.sessionMode 가 boss_assault 이면 true 를 반환한다', () => {
      mockContext.sessionContext = { sessionMode: 'boss_assault' };
      expect(handler.isAssaultMode(mockContext)).toBe(true);
    });

    it('ctx.assaultSession 이 존재하고 disposed 가 아니면 true 를 반환한다', () => {
      mockContext.assaultSession = { isDisposed: false };
      expect(handler.isAssaultMode(mockContext)).toBe(true);
      expect(handler.getAssaultSession(mockContext)).toBe(mockContext.assaultSession);
    });

    it('ctx.assaultSession 이 disposed 이면 무시하고 false 를 반환한다', () => {
      mockContext.assaultSession = { isDisposed: true };
      expect(handler.isAssaultMode(mockContext)).toBe(false);
      expect(handler.getAssaultSession(mockContext)).toBeNull();
    });

    it('sessionContextProvider 옵션이 주어지면 우선 조회한다', () => {
      const customHandler = new AssaultSceneHandler({
        sessionContextProvider: () => ({ sessionMode: 'boss_assault' } as any),
      });
      expect(customHandler.isAssaultMode()).toBe(true);
    });

    it('어설트 조건이 전혀 없으면 false 및 null 을 반환한다', () => {
      expect(handler.isAssaultMode(mockContext)).toBe(false);
      expect(handler.getAssaultSession(mockContext)).toBeNull();
    });
  });

  describe('resolveSnapshot 스냅샷 우선순위 해석', () => {
    it('finalePresentationSnapshot 이 최우선이다', () => {
      const session = {
        finalePresentationSnapshot: { id: 'finale_pres' },
        finaleController: { getSnapshot: () => ({ id: 'finale_ctrl' }) },
        presentation: { id: 'pres' },
      };
      expect(handler.resolveSnapshot(session, mockContext)).toEqual({ id: 'finale_pres' });
    });

    it('finaleController.getSnapshot() 이 두 번째 우선순위이다 (questionText 빈문자열 보정)', () => {
      const session = {
        finaleController: { getSnapshot: () => ({ id: 'finale_ctrl', hp: 100 }) },
        presentation: { id: 'pres' },
      };
      expect(handler.resolveSnapshot(session, mockContext)).toEqual({
        id: 'finale_ctrl',
        hp: 100,
        questionText: '',
      });
    });

    it('activeRoundController.presentation 및 session.snapshot 폴백이 동작한다', () => {
      const session1 = {
        activeRoundController: { presentation: { id: 'round_pres' } },
      };
      expect(handler.resolveSnapshot(session1, mockContext)).toEqual({ id: 'round_pres' });

      const session2 = {
        snapshot: { id: 'raw_snapshot' },
      };
      expect(handler.resolveSnapshot(session2, mockContext)).toEqual({ id: 'raw_snapshot' });
    });

    it('session 에 스냅샷이 없으면 ctx.assaultPresentationSnapshot 을 조회한다', () => {
      mockContext.assaultPresentationSnapshot = { id: 'ctx_snapshot' };
      expect(handler.resolveSnapshot(null, mockContext)).toEqual({ id: 'ctx_snapshot' });
    });
  });

  describe('update 틱 루프', () => {
    it('pauseModal 이 열려있으면 clock 을 일시정지하고 dreamGrid, effectManager 만 갱신 후 조기 종료한다', () => {
      const session = {
        clock: { setPaused: vi.fn(), update: vi.fn() },
        update: vi.fn(),
      };
      mockContext.assaultSession = session;
      mockContext.pauseModal.isOpen = true;

      handler.update(0.016, mockContext);

      expect(session.clock.setPaused).toHaveBeenCalledWith(true);
      expect(mockContext.dreamGrid.update).toHaveBeenCalledWith(0.016, 0.8);
      expect(mockContext.effectManager.update).toHaveBeenCalledWith(0.016);
      expect(session.update).not.toHaveBeenCalled();
      expect(mockContext.boss.update).not.toHaveBeenCalled();
    });

    it('정상 상태에서 session.update 와 서브시스템(guardian, boss, effects 등)을 순차 갱신한다', () => {
      const session = {
        clock: { setPaused: vi.fn() },
        update: vi.fn(),
      };
      mockContext.assaultSession = session;
      mockContext.pauseModal.isOpen = false;

      handler.update(0.016, mockContext);

      expect(session.clock.setPaused).toHaveBeenCalledWith(false);
      expect(session.update).toHaveBeenCalledWith(0.016, mockContext);
      expect(mockContext.guardian.update).toHaveBeenCalledWith(0.016);
      expect(mockContext.bossRenderer.update).toHaveBeenCalledWith(0.016);
      expect(mockContext.effectManager.update).toHaveBeenCalledWith(0.016);
      expect(mockContext.boss.update).toHaveBeenCalledWith(0.016);
      expect(mockContext.dialogueOverlayRenderer.update).toHaveBeenCalledWith(0.016);
    });

    it('session.update 가 없고 clock.update 만 있는 경우 밀리초 타임스탬프와 함께 호출한다', () => {
      const session = {
        clock: { setPaused: vi.fn(), update: vi.fn() },
      };
      mockContext.assaultSession = session;
      mockContext.engine.elapsedTime = 5;

      handler.update(0.016, mockContext);

      expect(session.clock.update).toHaveBeenCalledWith(0.016, 5000);
    });

    it('feedbackTimer 가 0 이하가 되면 customText/customColor 를 초기화한다', () => {
      mockContext.state.feedbackTimer = 0.01;
      handler.update(0.02, mockContext);
      expect(mockContext.state.feedbackTimer).toBeLessThanOrEqual(0);
      expect(mockContext.state.feedbackCustomText).toBeNull();
      expect(mockContext.state.feedbackCustomColor).toBeNull();
    });
  });

  describe('render 어설트 씬 렌더링', () => {
    it('dreamGrid, assaultSceneRenderer, session.hud 를 순차 호출한다', () => {
      const mockAssaultRenderer = { render: vi.fn() };
      const customHandler = new AssaultSceneHandler({
        assaultSceneRenderer: mockAssaultRenderer as any,
      });

      const session = {
        snapshot: { id: 'snap_1' },
        hud: { render: vi.fn() },
      };
      mockContext.assaultSession = session;

      customHandler.render(mockContext);

      expect(mockContext.dreamGrid.render).toHaveBeenCalled();
      expect(mockAssaultRenderer.render).toHaveBeenCalledWith(
        mockContext.canvasManager.ctx,
        session.snapshot,
        { width: 1080, height: 2160 }
      );
      expect(session.hud.render).toHaveBeenCalledWith(
        mockContext.canvasManager.ctx,
        1080,
        2160
      );
    });
  });

  describe('renderHUD & handlePose', () => {
    it('screenMode 가 game 이면 bottomBar.render(pause)를 호출하고 true 를 반환한다', () => {
      const result = handler.renderHUD(mockContext);
      expect(result).toBe(true);
      expect(mockContext.bottomBar.render).toHaveBeenCalledWith(
        mockContext.canvasManager.ctx,
        1080,
        2160,
        expect.objectContaining({
          actionLabel: '정지',
          actionColor: '#FF4444',
          pageId: 'pause',
        })
      );
    });

    it('session.handlePose 가 존재하면 transformedLandmarks 를 전달한다', () => {
      const session = { handlePose: vi.fn() };
      mockContext.assaultSession = session;
      const landmarks = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];

      const handled = handler.handlePose(landmarks, mockContext, 0.016);
      expect(handled).toBe(true);
      expect(session.handlePose).toHaveBeenCalledWith(landmarks, undefined, 0.016);
    });
  });

  describe('SceneDirector 연동 및 createMainGameDirector 팩토리', () => {
    it('SceneDirector 가 AssaultSceneHandler 를 통해 updateAssaultGameScene 및 renderAssaultScene 을 수행한다', () => {
      const director = new SceneDirector();
      const spyUpdate = vi.spyOn((director as any)._assaultHandler, 'update');
      const spyRender = vi.spyOn((director as any)._assaultHandler, 'render');

      director.updateAssaultGameScene(0.016, mockContext);
      expect(spyUpdate).toHaveBeenCalledWith(0.016, mockContext);

      director.renderAssaultScene(mockContext);
      expect(spyRender).toHaveBeenCalledWith(mockContext);
    });

    it('createMainGameDirector 팩토리를 통해 인스턴스 생성 및 파이프라인 등록이 완료된다', () => {
      const director = createMainGameDirector();
      expect(director).toBeInstanceOf(SceneDirector);
      expect(director.hasScene('game')).toBe(true);
      expect(director.hasScene('menu')).toBe(true);
      expect(director.hasScene('result')).toBe(true);
    });
  });
});
