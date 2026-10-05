/**
 * rhythm-intro-bootstrap.test.ts
 *
 * [RHYTHM-INTRO-004 / Issue #411]
 * Phase A 입문 손 루틴과 박 기반 별 예고 단일 연결 단위 테스트
 *
 * 1. MainSceneContext 및 AppBootstrap에 getPhaseAStarNotes 노출 검증 (BEGINNER_PHASE_A_STAR_NOTES 단일 공급원)
 * 2. AppBootstrap의 STAR_COLLECT 상태 진입 시 입문 7노트 주입 및 기존 scheduler.start 인자 구조 보존 검증
 * 3. SceneDirector의 updateGameScene에서 STAR_COLLECT 시 getPhaseAStarNotes 호출 및 입문 7노트 주입 검증
 * 4. SceneDirector의 renderGameScene에서 STAR_COLLECT 상태 시 beatPreview (startTime, secondsPerBeat) 주입 검증
 * 5. SceneDirector의 renderGameScene에서 BOSS_CLIMAX (Phase B) 시 beatPreview 절대 비주입 검증
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneDirector } from '../../src/core/SceneDirector.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import {
  BEGINNER_PHASE_A_STAR_NOTES,
  BEGINNER_PHASE_A_PATTERN_ID,
} from '../../src/data/beginnerRhythmRoutine.js';

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
    removeEventListener: vi.fn((type: string, fn: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((cb) => cb !== fn);
      }
    }),
    dispatchEvent: vi.fn((event: any) => {
      const cbs = listeners[event.type] || [];
      cbs.forEach((cb) => cb(event));
      return true;
    }),
  };
}

describe('RHYTHM-INTRO-004 (#411): Phase A 입문 손 루틴과 박 기반 별 예고 단일 연결', () => {
  let originalWindow: any;
  let originalDocument: any;
  let mockCanvas: any;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;

    (globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    (globalThis as any).document = {
      getElementById: vi.fn((id: string) => (id === 'game-canvas' ? mockCanvas : null)),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
  });

  describe('1. AppBootstrap 및 MainSceneContext 단일 공급원 (getPhaseAStarNotes) 검증', () => {
    it('mainSceneContext에 getPhaseAStarNotes 함수가 노출되어야 하고 BEGINNER_PHASE_A_STAR_NOTES를 반환해야 한다', () => {
      const bootstrap = new AppBootstrap({
        canvas: mockCanvas as any,
        autoStartCamera: false,
        preloadAssets: false,
      });

      expect(bootstrap.mainSceneContext.getPhaseAStarNotes).toBeDefined();
      expect(typeof bootstrap.mainSceneContext.getPhaseAStarNotes).toBe('function');

      const notes = bootstrap.mainSceneContext.getPhaseAStarNotes!();
      expect(notes).toBe(BEGINNER_PHASE_A_STAR_NOTES);
      expect(notes).toHaveLength(7);
      expect(Object.isFrozen(notes)).toBe(true);
      expect(notes[0].patternId).toBe(BEGINNER_PHASE_A_PATTERN_ID);

      bootstrap.dispose();
    });

    it('AppBootstrap의 STAR_COLLECT 상태 진입 시 starNoteScheduler.start에 입문 7노트가 전달되어야 한다', () => {
      const bootstrap = new AppBootstrap({
        canvas: mockCanvas as any,
        autoStartCamera: false,
        preloadAssets: false,
      });

      const startSpy = vi.spyOn(bootstrap.starNoteScheduler, 'start');

      // FSM 허용 전이: (초기 MENU_MAIN) -> RUN_QUESTION -> ANSWER_SELECT -> STAR_COLLECT
      expect(bootstrap.stateMachine.currentState).toBe('MENU_MAIN');
      bootstrap.stateMachine.changeState('RUN_QUESTION');
      bootstrap.stateMachine.changeState('ANSWER_SELECT');
      const changed = bootstrap.stateMachine.changeState('STAR_COLLECT');

      expect(changed).toBe(true);
      expect(startSpy).toHaveBeenCalledTimes(1);

      const [startElapsed, options] = startSpy.mock.calls[0];
      expect(typeof startElapsed).toBe('number');
      expect(options).toBeDefined();
      expect(options!.roundId).toBe(bootstrap.beatRoundResolver.currentRoundIndex);
      expect(options!.notes).toBe(BEGINNER_PHASE_A_STAR_NOTES);
      expect(options!.notes).toHaveLength(7);
      expect(options!.secondsPerBeat).toBeDefined();

      bootstrap.dispose();
    });

    it('BUG-STAR-CLOCK-001 (#419): branchClock.startElapsed(로컬 시간) 대신 engine.elapsedTime(전역 시간)을 전달하여 별 노트가 1프레임 만에 Miss 만료되지 않아야 한다', () => {
      const bootstrap = new AppBootstrap({
        canvas: mockCanvas as any,
        autoStartCamera: false,
        preloadAssets: false,
      });

      // 가상 게임 실행 25초 경과 시뮬레이션
      const targetElapsedTime = 25.0;
      (bootstrap.engine as any)._elapsedTime = targetElapsedTime;
      expect(bootstrap.engine.elapsedTime).toBe(targetElapsedTime);

      // beatCoordinator의 branchClock이 0.8초(답안 선택 소요 로컬 시간)를 가리키도록 모킹
      const mockBranchClock = {
        bpm: 120,
        secondsPerBeat: 0.5,
        startElapsed: 0.8,
        elapsed: 0.0,
        endElapsed: 4.8,
        durationBeats: 8 as const,
      };
      vi.spyOn(bootstrap.beatCoordinator, 'getBranchClock').mockReturnValue(mockBranchClock as any);

      const startSpy = vi.spyOn(bootstrap.starNoteScheduler, 'start');

      bootstrap.stateMachine.changeState('RUN_QUESTION');
      bootstrap.stateMachine.changeState('ANSWER_SELECT');
      bootstrap.stateMachine.changeState('STAR_COLLECT');

      expect(startSpy).toHaveBeenCalledTimes(1);
      const [startElapsed] = startSpy.mock.calls[0];

      // 핵심 검증: 로컬 branchClock.startElapsed(0.8)가 아닌 실제 엔진 전역 시간(25.0)이어야 함
      expect(startElapsed).toBe(targetElapsedTime);

      // 첫 프레임(25.0초)에서 7개 별 노트가 만료(Miss)되지 않고 모두 활성 상태여야 함
      expect(bootstrap.starNoteScheduler.notes).toHaveLength(7);
      expect(bootstrap.starNoteScheduler.activeNotes).toHaveLength(7);

      const frameResults = bootstrap.starNoteScheduler.update(targetElapsedTime);
      expect(frameResults).toHaveLength(0); // 첫 프레임에 만료된 노트 0개
      expect(bootstrap.starNoteScheduler.activeNotes).toHaveLength(7);

      bootstrap.dispose();
    });
  });

  describe('2. SceneDirector.updateGameScene 에서의 스케줄러 시작 및 노트 주입 검증', () => {
    it('STAR_COLLECT 상태에서 스케줄러가 미시작 상태일 때 ctx.getPhaseAStarNotes를 통해 입문 노트를 전달해야 한다', () => {
      const director = new SceneDirector();
      const mockStart = vi.fn();
      const mockUpdate = vi.fn();

      const branchClock = {
        branch: 'correct' as const,
        startElapsed: 5.0,
        elapsed: 0.1,
        remaining: 3.9,
        totalDuration: 4.0,
        secondsPerBeat: 0.5,
        totalBeats: 8,
      };

      const mockContext: any = {
        canvasManager: { ctx: mockCanvas.getContext(), virtualWidth: 800, virtualHeight: 600 },
        cameraLayer: { isActive: true },
        stateMachine: { currentState: 'STAR_COLLECT' },
        state: { currentChapter: 1, gamePhase: 'playing', feedbackTimer: 0 },
        beatCoordinator: {
          phase: 'STAR_COLLECT',
          keynotes: [{ patternId: 'legacy-csv', part: 'leftHand', zoneId: 1, instrument: 'hand', beat: 2 }],
          getBranchClock: vi.fn(() => branchClock),
          rhythmEngine: { secondsPerBeat: 0.5 },
          update: vi.fn(),
          currentQuestion: null,
        },
        dreamGrid: { update: vi.fn(), render: vi.fn() },
        skeletonAnimation: { smoothedLandmarks: [] },
        poseManager: { virtualLandmarks: [] },
        starNoteScheduler: {
          isStarted: false,
          start: mockStart,
          update: mockUpdate,
          currentTarget: null,
          startTime: 5.0,
          setPaused: vi.fn(),
        },
        starCollectionInput: { setTarget: vi.fn(), setPaused: vi.fn() },
        menuInput: { isActive: false },
        beatRoundResolver: { currentRoundIndex: 2 },
        getPhaseAStarNotes: vi.fn(() => BEGINNER_PHASE_A_STAR_NOTES),
        footKeynoteInput: { setSafetyGuarded: vi.fn(), routeEvent: vi.fn() },
        footKeynoteDetector: { update: vi.fn(() => []) },
        kneeFraming: null,
        pauseModal: { isOpen: false },
        actions: { showResult: vi.fn() },
        battle: { isAlive: true },
        boss: { update: vi.fn() },
        dialogueOverlayRenderer: { update: vi.fn() },
        guardian: { update: vi.fn() },
        bossRenderer: { update: vi.fn() },
        effectManager: { update: vi.fn() },
        hudLayer: { update: vi.fn() },
        getHUDData: vi.fn(() => ({})),
        engine: { elapsedTime: 5.0 },
      };

      director.updateGameScene(0.016, mockContext);

      expect(mockContext.getPhaseAStarNotes).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalledTimes(1);

      const [startElapsed, options] = mockStart.mock.calls[0];
      expect(startElapsed).toBe(5.0);
      expect(options.roundId).toBe(2);
      expect(options.notes).toBe(BEGINNER_PHASE_A_STAR_NOTES);
      expect(options.branchClock).toBe(branchClock);
      expect(options.secondsPerBeat).toBe(0.5);
    });
  });

  describe('3. SceneDirector.renderGameScene 에서의 beatPreview 주입 및 격리 검증', () => {
    let director: SceneDirector;
    let mockCtx2d: any;
    let mockStarNoteRenderer: any;
    let mockContext: any;

    beforeEach(() => {
      director = new SceneDirector();
      mockCtx2d = mockCanvas.getContext();

      mockStarNoteRenderer = {
        render: vi.fn(),
      };

      const branchClock = {
        branch: 'correct' as const,
        startElapsed: 12.0,
        elapsed: 1.2,
        remaining: 2.8,
        totalDuration: 4.0,
        secondsPerBeat: 0.55,
        totalBeats: 8,
      };

      mockContext = {
        canvasManager: { ctx: mockCtx2d, virtualWidth: 800, virtualHeight: 600 },
        cameraLayer: { isActive: true },
        imageLoader: null,
        dreamGrid: { render: vi.fn(), update: vi.fn() },
        stateMachine: { currentState: 'STAR_COLLECT' },
        state: { currentChapter: 1, gamePhase: 'playing' },
        beatCoordinator: {
          phase: 'STAR_COLLECT',
          getBranchClock: vi.fn(() => branchClock),
          rhythmEngine: { secondsPerBeat: 0.55 },
        },
        presentationAdapter: {
          canRenderRunningHUD: () => false,
          canRenderAnswerPreview: () => false,
          canRenderQuestion: () => false,
          canRenderStarCollect: (s: string) => s === 'STAR_COLLECT' || s === 'BOSS_CLIMAX',
          canRenderHazardEvade: () => false,
          canRenderReadyPosition: () => false,
          getAnswerSelectFeedback: vi.fn(() => null),
          renderAnswerFeedback: vi.fn(),
          renderHazardEvade: vi.fn(),
        },
        starNoteScheduler: {
          startTime: 12.0,
          currentTarget: null,
          activeNotes: [],
          isPaused: false,
        },
        starNoteRenderer: mockStarNoteRenderer,
        engine: { elapsedTime: 13.2, paused: false },
        boss: { hp: 10, maxHp: 10, phase: 'idle' },
        bossRenderer: { render: vi.fn() },
        guardian: { stage: 1 },
        hudLayer: { render: vi.fn() },
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
        transitionManager: { render: vi.fn() },
        tutorial: { isActive: false },
        beatRoundResolver: { resourceManager: { troopManager: { minionCount: 0 }, stardust: 0 } },
        effectManager: { render: vi.fn(), play: vi.fn() },
        canvas: mockCanvas as any,
        actions: {} as any,
        renderFeedback: vi.fn(),
        getHUDData: vi.fn(() => ({})),
      };
    });

    it('STAR_COLLECT 상태일 때 starNoteRenderer.render에 beatPreview(startTime, secondsPerBeat)가 전달된다', () => {
      mockContext.stateMachine.currentState = 'STAR_COLLECT';

      director.renderGameScene(mockContext);

      expect(mockStarNoteRenderer.render).toHaveBeenCalledTimes(1);
      const [ctxArg, vwArg, vhArg, stateArg] = mockStarNoteRenderer.render.mock.calls[0];
      expect(ctxArg).toBe(mockCtx2d);
      expect(vwArg).toBe(800);
      expect(vhArg).toBe(600);
      expect(stateArg).toBeDefined();
      expect(stateArg.beatPreview).toBeDefined();
      expect(stateArg.beatPreview.startTime).toBe(12.0);
      expect(stateArg.beatPreview.secondsPerBeat).toBe(0.55);
    });

    it('branchClock이 없는 경우에도 beatCoordinator.rhythmEngine.secondsPerBeat 또는 0.5를 fallback으로 사용하여 beatPreview를 구성한다', () => {
      mockContext.stateMachine.currentState = 'STAR_COLLECT';
      mockContext.beatCoordinator.getBranchClock = vi.fn(() => null);
      mockContext.beatCoordinator.rhythmEngine = { secondsPerBeat: 0.48 };

      director.renderGameScene(mockContext);

      expect(mockStarNoteRenderer.render).toHaveBeenCalledTimes(1);
      const stateArg = mockStarNoteRenderer.render.mock.calls[0][3];
      expect(stateArg.beatPreview).toBeDefined();
      expect(stateArg.beatPreview.startTime).toBe(12.0);
      expect(stateArg.beatPreview.secondsPerBeat).toBe(0.48);
    });

    it('BOSS_CLIMAX (Phase B) 상태일 때는 canRenderStarCollect가 참이어도 beatPreview가 절대 전달되지 않아야 한다', () => {
      mockContext.stateMachine.currentState = 'BOSS_CLIMAX';
      mockContext.bossClimaxRenderer = { render: vi.fn() };
      mockContext.bossHazardController = null;

      director.renderGameScene(mockContext);

      expect(mockStarNoteRenderer.render).toHaveBeenCalledTimes(1);
      const stateArg = mockStarNoteRenderer.render.mock.calls[0][3];
      expect(stateArg.beatPreview).toBeUndefined();
    });
  });
});
