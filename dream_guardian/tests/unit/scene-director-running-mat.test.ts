/**
 * scene-director-running-mat.test.ts
 *
 * [RUN-MAT-004 / Issue #373]
 * RUN_QUESTION 전용 러닝 매트 스냅샷·표시 모델·렌더러 연결 단위 테스트
 *
 * 1. RUN_QUESTION 상태일 때 runningMatRenderer.render 호출 및 인자 검증
 * 2. COUNT_IN 포함 비RUN_QUESTION 상태일 때 runningMatRenderer.render 미호출 검증
 * 3. runningMatRenderer 누락(null/undefined) 시 크래시 없는 안전 실행 검증
 * 4. AppBootstrap 및 mainSceneContext 주입 검증
 * 5. 렌더링 호출 순서 검증 (dreamGrid -> runningMatRenderer)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneDirector, type MainSceneContext } from '../../src/core/SceneDirector.js';
import { HORIZON_RATIO } from '../../config/grid.config.js';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import type { RunTimingSnapshot } from '../../src/game/BeatRunCoordinator.js';

function createMockCanvas(clientW = 800, clientH = 600) {
  let width = clientW;
  let height = clientH;
  const ctx = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
  };

  const listeners: Record<string, Function[]> = {};

  return {
    clientWidth: clientW,
    clientHeight: clientH,
    get width() {
      return width;
    },
    set width(v: number) {
      width = v;
    },
    get height() {
      return height;
    },
    set height(v: number) {
      height = v;
    },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn((type: string, fn: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('RUN-MAT-004 (#373): RUN_QUESTION 전용 러닝 매트 스냅샷·표시 모델·렌더러 연결', () => {
  let director: SceneDirector;
  let mockCtx2d: any;
  let mockContext: MainSceneContext;
  let mockRunningMatRenderer: any;
  let mockSnapshot: RunTimingSnapshot;
  let renderCallOrder: string[];

  beforeEach(() => {
    director = new SceneDirector();
    renderCallOrder = [];

    const canvas = createMockCanvas(800, 600);
    mockCtx2d = canvas.getContext();

    mockRunningMatRenderer = {
      render: vi.fn(() => {
        renderCallOrder.push('runningMat');
      }),
    };

    mockSnapshot = Object.freeze({
      runId: 1,
      active: true,
      paused: false,
      elapsedBeats: 2.5,
      exerciseBeats: 8,
      requiredExerciseCount: 6,
      acceptedExerciseCount: 2,
      prepareStartBeat: 6,
      transitionBeat: 8,
    });

    mockContext = {
      canvasManager: {
        ctx: mockCtx2d,
        virtualWidth: 800,
        virtualHeight: 600,
      },
      cameraLayer: { isActive: true },
      imageLoader: null,
      dreamGrid: {
        render: vi.fn(() => {
          renderCallOrder.push('dreamGrid');
        }),
        update: vi.fn(),
      },
      stateMachine: {
        currentState: 'RUN_QUESTION',
      },
      state: {
        currentChapter: 1,
        gamePhase: 'running',
        currentQuestion: { text: '1+1', answer: 2 },
        totalSteps: 5,
        climaxBarrageTimer: 0,
      },
      beatCoordinator: {
        phase: 'RUN_QUESTION',
        completedExerciseBeats: 2,
        exerciseBeats: 8,
        questionApproachProgress: 0.5,
        getRunTimingSnapshot: vi.fn(() => mockSnapshot),
      },
      locomotionModal: {
        selectedMode: 'run',
      },
      presentationAdapter: {
        canRenderRunningHUD: (s: string) => s === 'RUN_QUESTION' || s === 'REST_READY',
        canRenderAnswerPreview: (s: string, p = 0) => s === 'RUN_QUESTION' && p > 0,
        canRenderQuestion: (s: string) => s === 'ANSWER_SELECT',
        canRenderStarCollect: () => false,
        canRenderHazardEvade: (s: string) => s === 'HAZARD_EVADE',
        canRenderReadyPosition: () => false,
        getAnswerSelectFeedback: vi.fn(() => null),
        renderAnswerFeedback: vi.fn(),
        renderHazardEvade: vi.fn(),
      },
      renderFeedback: vi.fn(),
      bossFeverController: null,
      phaseAHazardController: { isEvaded: false, performedAction: null, activePattern: null } as any,
      hazardZoneRenderer: { render: vi.fn() } as any,
      starNoteScheduler: { currentTarget: null, activeNotes: [], isPaused: false },
      starNoteRenderer: { render: vi.fn() },
      bossClimaxRenderer: { render: vi.fn() },
      bossRenderer: { render: vi.fn() },
      hudLayer: { render: vi.fn() },
      getHUDData: vi.fn(() => ({})),
      beatHUDRenderer: { render: vi.fn() },
      questionRenderer: { render: vi.fn() },
      answerSelectionRenderer: { render: vi.fn() },
      stickmanRenderer: { render: vi.fn() },
      skeletonEffect: { renderTrails: vi.fn() },
      gestureFeedbackOverlay: { render: vi.fn() },
      dialogueOverlayRenderer: { render: vi.fn() },
      bottomBar: { render: vi.fn() },
      settingsModal: { isOpen: false, render: vi.fn() },
      pauseModal: { isOpen: false, render: vi.fn() },
      locomotionModalRef: null,
      transitionManager: { render: vi.fn() },
      tutorial: { isActive: false },
      boss: { hp: 10, maxHp: 10, phase: 'idle' },
      guardian: { stage: 1 },
      beatRoundResolver: { resourceManager: { troopManager: { minionCount: 0 }, stardust: 0 } },
      effectManager: { render: vi.fn(), play: vi.fn() },
      armReachAnswerSelector: {
        state: {
          leftHand: { zoneId: 0, score: 0 },
          rightHand: { zoneId: 0, score: 0 },
          lockedChoice: null,
          confirmedChoice: null,
        },
      },
      canvas: canvas as any,
      actions: {} as any,
      runningMatRenderer: mockRunningMatRenderer,
    } as any;
  });

  describe('1. RUN_QUESTION 상태에서 렌더링 동작', () => {
    it('RUN_QUESTION 상태일 때 runningMatRenderer.render가 올바른 인자와 함께 호출된다', () => {
      mockContext.stateMachine.currentState = 'RUN_QUESTION';

      director.renderGameScene(mockContext);

      expect(mockRunningMatRenderer.render).toHaveBeenCalledTimes(1);

      const [ctxArg, viewArg, vwArg, vhArg, vpArg] = mockRunningMatRenderer.render.mock.calls[0];
      expect(ctxArg).toBe(mockCtx2d);
      expect(vwArg).toBe(800);
      expect(vhArg).toBe(600);
      expect(vpArg.vanishingPoint ?? vpArg).toEqual({ x: 400, y: 600 * HORIZON_RATIO });

      expect(viewArg).toBeDefined();
      expect(viewArg.visible).toBe(true);
      expect(viewArg.elapsedBeats).toBe(2.5);
      expect(viewArg.acceptedExerciseCount).toBe(2);
      expect(viewArg.requiredExerciseCount).toBe(6);
    });

    it('locomotionModal.selectedMode가 변경되면 해당 모드의 뷰모델이 전달된다', () => {
      mockContext.stateMachine.currentState = 'RUN_QUESTION';
      mockContext.locomotionModal.selectedMode = 'hip_bounce';

      director.renderGameScene(mockContext);

      expect(mockRunningMatRenderer.render).toHaveBeenCalledTimes(1);
      const [, viewArg] = mockRunningMatRenderer.render.mock.calls[0];
      expect(viewArg).toBeDefined();
      expect(viewArg.visible).toBe(true);
    });

    it('dreamGrid.render 직후 바닥 배경 레이어로 호출된다', () => {
      mockContext.stateMachine.currentState = 'RUN_QUESTION';

      director.renderGameScene(mockContext);

      expect(renderCallOrder.indexOf('dreamGrid')).toBeGreaterThanOrEqual(0);
      expect(renderCallOrder.indexOf('runningMat')).toBeGreaterThan(renderCallOrder.indexOf('dreamGrid'));
    });
  });

  describe('2. 게임 씬(COUNT_IN, ANSWER_SELECT, STAR_COLLECT, BOSS_CLIMAX 등) 상시 판정선 노출 검증 (Issue #422)', () => {
    const inGameStates = [
      'COUNT_IN',
      'ANSWER_SELECT',
      'STAR_COLLECT',
      'HAZARD_EVADE',
      'BOSS_CLIMAX',
      'READY_POSITION',
    ];

    inGameStates.forEach((stateName) => {
      it(`${stateName} 인게임 상태에서도 상시 판정선 렌더링이 호출된다`, () => {
        mockContext.stateMachine.currentState = stateName;

        director.renderGameScene(mockContext);

        expect(mockRunningMatRenderer.render).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('3. Null 안전성 및 예외 회피', () => {
    it('runningMatRenderer가 undefined인 경우에도 에러 없이 정상 실행된다', () => {
      mockContext.runningMatRenderer = undefined;
      mockContext.stateMachine.currentState = 'RUN_QUESTION';

      expect(() => director.renderGameScene(mockContext)).not.toThrow();
    });

    it('runningMatRenderer가 null인 경우에도 에러 없이 정상 실행된다', () => {
      mockContext.runningMatRenderer = null;
      mockContext.stateMachine.currentState = 'RUN_QUESTION';

      expect(() => director.renderGameScene(mockContext)).not.toThrow();
    });

    it('beatCoordinator가 없거나 getRunTimingSnapshot이 undefined인 경우 null 스냅샷으로 안전하게 동작한다', () => {
      mockContext.beatCoordinator = {
        phase: 'RUN_QUESTION',
        completedExerciseBeats: 0,
        exerciseBeats: 8,
        questionApproachProgress: 0,
        getRunTimingSnapshot: undefined,
      } as any;
      mockContext.stateMachine.currentState = 'RUN_QUESTION';

      expect(() => director.renderGameScene(mockContext)).not.toThrow();
      expect(mockRunningMatRenderer.render).toHaveBeenCalledTimes(1);

      const [, viewArg] = mockRunningMatRenderer.render.mock.calls[0];
      expect(viewArg.visible).toBe(false);
    });

    it('locomotionModal이 undefined인 경우 기본 모드 run으로 fallback된다', () => {
      mockContext.locomotionModal = undefined;
      (mockContext.presentationAdapter as any).canRenderRunningHUD = () => false;
      mockContext.stateMachine.currentState = 'RUN_QUESTION';

      expect(() => director.renderGameScene(mockContext)).not.toThrow();
      expect(mockRunningMatRenderer.render).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. AppBootstrap 및 mainSceneContext 주입 검증', () => {
    let mockCanvas: any;

    beforeEach(() => {
      mockCanvas = createMockCanvas(800, 600);
      (globalThis as any).window = {
        innerWidth: 800,
        innerHeight: 600,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      (globalThis as any).document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });

    afterEach(() => {
      delete (globalThis as any).window;
      delete (globalThis as any).document;
    });

    it('AppBootstrap에 runningMatRenderer 인스턴스가 존재하고 mainSceneContext에 주입된다', () => {
      const bootstrap = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
      });

      expect(bootstrap.runningMatRenderer).toBeDefined();
      expect(bootstrap.runningMatRenderer).toBeInstanceOf(RunningMatRenderer);
      expect((bootstrap as any).mainSceneContext.runningMatRenderer).toBe(bootstrap.runningMatRenderer);

      bootstrap.dispose();
    });
  });
});
