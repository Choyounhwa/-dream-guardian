/**
 * scene-render-orchestrator.test.ts
 * [REFACTOR-SRP-005] (Issue #636) SceneDirector 7계층 캔버스 레이어 렌더링 디스패처 분리
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneRenderOrchestrator } from '../../src/core/director/SceneRenderOrchestrator.js';
import { RENDER_LAYER_ORDER } from '../../src/core/SceneDirector.js';

describe('SceneRenderOrchestrator [REFACTOR-SRP-005 / #636]', () => {
  let orchestrator: SceneRenderOrchestrator;
  let mockContext: any;
  let mockCanvasCtx: any;

  beforeEach(() => {
    mockCanvasCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
    };

    mockContext = {
      canvas: { width: 1280, height: 720 },
      canvasManager: {
        ctx: mockCanvasCtx,
        virtualWidth: 1280,
        virtualHeight: 720,
        resetTransform: vi.fn(),
        applyVirtualTransform: vi.fn(),
      },
      cameraLayer: {
        isActive: false,
        render: vi.fn(),
      },
      settingsModal: {
        skeletonEnabled: true,
        isOpen: false,
        render: vi.fn(),
      },
      locomotionModal: {
        isOpen: false,
        selectedMode: 'run',
        render: vi.fn(),
      },
      pauseModal: {
        isOpen: false,
        hoverAction: null,
        render: vi.fn(),
      },
      poseManager: {
        hasPose: true,
      },
      skeletonAnimation: {
        smoothedLandmarks: [{ x: 0.5, y: 0.5, visibility: 1 }],
        breathScale: 1,
      },
      boneRenderer: {
        render: vi.fn(),
      },
      jointRenderer: {
        render: vi.fn(),
      },
      skeletonEffect: {
        renderTrails: vi.fn(),
      },
      stickmanRenderer: {
        render: vi.fn(),
        currentAnchorXRatio: 0.5,
      },
      renderFeedback: vi.fn(),
      effectManager: {
        render: vi.fn(),
      },
      dreamGrid: {
        render: vi.fn(),
      },
      menuRenderer: {
        render: vi.fn(),
        renderSubMenu: vi.fn(),
      },
      resultRenderer: {
        render: vi.fn(),
      },
      hudLayer: {
        render: vi.fn(),
      },
      bottomBar: {
        render: vi.fn(),
      },
      beatHUDRenderer: {
        render: vi.fn(),
      },
      transitionManager: {
        render: vi.fn(),
      },
      kneeFramingGuideRenderer: {
        render: vi.fn(),
      },
      gestureFeedbackOverlay: {
        render: vi.fn(),
      },
      dialogueOverlayRenderer: {
        render: vi.fn(),
      },
      postureGuideRenderer: {
        renderBoundaryWarning: vi.fn(),
      },
      answerSelectionRenderer: {
        render: vi.fn(),
      },
      cursorTracker: {
        cursors: new Map(),
      },
      menuInput: {
        isActive: false,
        cursorX: 100,
        cursorY: 100,
      },
      state: {
        screenMode: 'menu',
        menuMode: 'main',
        currentChapter: 1,
        gamePhase: 'running',
        currentQuestion: null,
        resultData: { score: 100, rank: 'S' },
        settingsHoverTimer: 0,
        actionHoverTimer: 0,
        score: 0,
        combo: 0,
      },
      stateMachine: {
        currentState: 'MENU_MAIN',
      },
      beatCoordinator: {
        phase: 'RUN_QUESTION',
        questionApproachProgress: 0.5,
        answerApproachProgress: 0.5,
        rhythmEngine: { beatProgress: 0.5 },
      },
      presentationAdapter: {
        canRenderStarCollect: vi.fn(() => false),
        canRenderRunningHUD: vi.fn(() => false),
        canRenderQuestion: vi.fn(() => false),
        canRenderHazardEvade: vi.fn(() => false),
        canRenderReadyPosition: vi.fn(() => false),
        canRenderAnswerPreview: vi.fn(() => false),
      },
      battle: {
        isAlive: true,
      },
      boss: {
        hp: 10,
        maxHp: 10,
        state: 'idle',
      },
      bossRenderer: {
        render: vi.fn(),
      },
      guardian: {
        render: vi.fn(),
      },
      questionRenderer: {
        render: vi.fn(),
      },
      getHUDData: vi.fn(() => ({})),
    };

    orchestrator = new SceneRenderOrchestrator();
  });

  describe('1. 인스턴스 생성 및 초기화', () => {
    it('SceneRenderOrchestrator 인스턴스가 정상 생성된다', () => {
      expect(orchestrator).toBeDefined();
    });

    it('주입된 옵션(assaultHandler, kneeFramingProvider 등)을 보관한다', () => {
      const mockAssaultHandler = { isAssaultMode: vi.fn(() => false), renderHUD: vi.fn() } as any;
      const kneeFraming = { isFramed: true };
      const orchWithOptions = new SceneRenderOrchestrator({
        assaultHandler: mockAssaultHandler,
        kneeFramingProvider: () => kneeFraming,
      });

      expect(orchWithOptions).toBeDefined();
      expect(orchWithOptions.kneeFraming).toBe(kneeFraming);
    });
  });

  describe('2. 7개 캔버스 레이어별 개별 렌더링 디스패치', () => {
    it('renderClear: 캔버스 리셋 및 배경색(#0a0a1a)으로 클리어한다', () => {
      orchestrator.renderClear(mockContext);

      expect(mockContext.canvasManager.resetTransform).toHaveBeenCalled();
      expect(mockCanvasCtx.fillStyle).toBe('#0a0a1a');
      expect(mockCanvasCtx.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
      expect(mockContext.canvasManager.applyVirtualTransform).toHaveBeenCalled();
    });

    it('renderBackground: 카메라 활성화 상태일 때 cameraLayer.render를 호출한다', () => {
      mockContext.cameraLayer.isActive = true;
      orchestrator.renderBackground(mockContext);

      expect(mockContext.cameraLayer.render).toHaveBeenCalledWith(mockCanvasCtx, 1280, 720);
    });

    it('renderBackground: 카메라 비활성화 상태일 때는 cameraLayer.render를 호출하지 않는다', () => {
      mockContext.cameraLayer.isActive = false;
      orchestrator.renderBackground(mockContext);

      expect(mockContext.cameraLayer.render).not.toHaveBeenCalled();
    });

    it('renderAvatarAndSkeleton: 스켈레톤 활성화 및 랜드마크 존재 시 스켈레톤 렌더러들을 호출한다', () => {
      orchestrator.renderAvatarAndSkeleton(mockContext);

      expect(mockContext.boneRenderer.render).toHaveBeenCalledWith(
        mockCanvasCtx,
        mockContext.skeletonAnimation.smoothedLandmarks,
        1,
      );
      expect(mockContext.jointRenderer.render).toHaveBeenCalledWith(
        mockCanvasCtx,
        mockContext.skeletonAnimation.smoothedLandmarks,
        mockContext.skeletonAnimation.breathScale,
      );
      expect(mockContext.skeletonEffect.renderTrails).toHaveBeenCalledWith(mockCanvasCtx);
    });

    it('renderAvatarAndSkeleton: skeletonEnabled=false 시 렌더링하지 않는다', () => {
      mockContext.settingsModal.skeletonEnabled = false;
      orchestrator.renderAvatarAndSkeleton(mockContext);

      expect(mockContext.boneRenderer.render).not.toHaveBeenCalled();
    });

    it('renderHUD: BottomBar 렌더링을 디스패치한다', () => {
      orchestrator.renderHUD(mockContext);

      expect(mockContext.bottomBar.render).toHaveBeenCalledWith(
        mockCanvasCtx,
        1280,
        720,
        expect.objectContaining({
          pageId: 'main_home',
        }),
      );
    });

    it('renderHUD: 보스 접근전(Assault Mode) 활성화 시 assaultHandler.renderHUD로 위임한다', () => {
      const mockAssaultHandler = {
        isAssaultMode: vi.fn(() => true),
        renderHUD: vi.fn(() => true),
      } as any;
      const assaultOrch = new SceneRenderOrchestrator({ assaultHandler: mockAssaultHandler });

      assaultOrch.renderHUD(mockContext);

      expect(mockAssaultHandler.renderHUD).toHaveBeenCalledWith(mockContext);
      expect(mockContext.hudLayer.render).not.toHaveBeenCalled();
    });

    it('renderModalsAndOverlays: 모달 열림 상태에 따라 해당 모달을 렌더링한다', () => {
      mockContext.settingsModal.isOpen = true;
      mockContext.pauseModal.isOpen = true;

      orchestrator.renderModalsAndOverlays(mockContext);

      expect(mockContext.settingsModal.render).toHaveBeenCalledWith(mockCanvasCtx, 1280, 720);
      expect(mockContext.pauseModal.render).toHaveBeenCalledWith(mockCanvasCtx, 1280, 720);
      expect(mockContext.locomotionModal.render).not.toHaveBeenCalled();
    });

    it('renderTransitions: transitionManager.render를 호출한다', () => {
      orchestrator.renderTransitions(mockContext);

      expect(mockContext.transitionManager.render).toHaveBeenCalledWith(mockCanvasCtx, 1280, 720);
    });
  });

  describe('3. 씬별 개별 렌더링 (ENTITIES 레이어 디스패치)', () => {
    it('renderMenuScene: 메인 메뉴 렌더링을 디스패치한다', () => {
      orchestrator.renderMenuScene(mockContext);

      expect(mockContext.dreamGrid.render).toHaveBeenCalled();
      expect(mockContext.menuRenderer.render).toHaveBeenCalled();
    });

    it('renderMenuScene: 서브 메뉴일 경우 menuRenderer.renderSubMenu를 호출한다', () => {
      mockContext.state.menuMode = 'sub';
      orchestrator.renderMenuScene(mockContext);

      expect(mockContext.menuRenderer.renderSubMenu).toHaveBeenCalled();
    });

    it('renderGameScene: 인게임 배경 그리드, 스틱맨, 이펙트를 렌더링한다', () => {
      orchestrator.renderGameScene(mockContext);

      expect(mockContext.dreamGrid.render).toHaveBeenCalled();
      expect(mockContext.stickmanRenderer.render).toHaveBeenCalled();
      expect(mockContext.effectManager.render).toHaveBeenCalled();
    });

    it('renderResultScene: 결과 화면 ResultRenderer 및 stickmanRenderer를 호출한다', () => {
      orchestrator.renderResultScene(mockContext);

      expect(mockContext.resultRenderer.render).toHaveBeenCalledWith(
        mockCanvasCtx,
        1280,
        720,
        mockContext.state.resultData,
      );
      expect(mockContext.stickmanRenderer.render).toHaveBeenCalled();
      expect(mockContext.effectManager.render).toHaveBeenCalled();
    });
  });

  describe('4. 7계층 렌더 레이어 등록 및 오케스트레이션 연계 (RENDER_LAYER_ORDER)', () => {
    it('registerLayers 메서드로 director에 7개 레이어가 정의된 우선순위 순서대로 등록된다', () => {
      const mockDirector = {
        registerLayer: vi.fn(),
        renderScene: vi.fn(),
        currentScene: 'game',
      } as any;

      orchestrator.registerLayers(mockDirector);

      expect(mockDirector.registerLayer).toHaveBeenCalledTimes(7);
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'clear',
        RENDER_LAYER_ORDER.CLEAR,
        expect.any(Function),
      );
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'background',
        RENDER_LAYER_ORDER.BACKGROUND,
        expect.any(Function),
      );
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'avatar',
        RENDER_LAYER_ORDER.AVATAR,
        expect.any(Function),
      );
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'entities',
        RENDER_LAYER_ORDER.ENTITIES,
        expect.any(Function),
      );
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'hud',
        RENDER_LAYER_ORDER.HUD,
        expect.any(Function),
      );
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'modals',
        RENDER_LAYER_ORDER.MODALS,
        expect.any(Function),
      );
      expect(mockDirector.registerLayer).toHaveBeenCalledWith(
        'transitions',
        RENDER_LAYER_ORDER.TRANSITIONS,
        expect.any(Function),
      );
    });
  });
});
