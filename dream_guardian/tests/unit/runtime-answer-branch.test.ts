/**
 * runtime-answer-branch.test.ts
 * [BUG-RUNTIME-ANSWER-BRANCH-001 / Issue #312]
 * 조립 계층의 답안 창·일시정지 입력·분기 시계·dt 단일 적용 계약
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneDirector } from '../../src/core/SceneDirector.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';

function createMockCanvas(clientW = 800, clientH = 600) {
  let width = clientW;
  let height = clientH;
  const gradient = { addColorStop: vi.fn() };
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
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    translate: vi.fn(),
    scale: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
  };
  return {
    clientWidth: clientW,
    clientHeight: clientH,
    get width() { return width; },
    set width(v: number) { width = v; },
    get height() { return height; },
    set height(v: number) { height = v; },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

function stubDirectorSideEffects(ctx: any) {
  ctx.poseManager = { virtualLandmarks: [], hasPose: false };
  ctx.cameraLayer = { isActive: false };
  ctx.skeletonAnimation = { smoothedLandmarks: [], update: vi.fn() };
  ctx.transitionManager = { update: vi.fn() };
  ctx.settingsModal = { update: vi.fn() };
  ctx.menuRenderer = { update: vi.fn() };
  ctx.readyPositionRenderer = { update: vi.fn() };
  ctx.answerSelectionRenderer = { update: vi.fn() };
  ctx.tutorial = { update: vi.fn() };
  ctx.skeletonEffect = { setMana: vi.fn(), setHp: vi.fn(), update: vi.fn() };
  ctx.battle = { isAlive: true, mana: 0, hp: 100, maxHp: 100 };
  ctx.speech = { speakFeedback: vi.fn() };
  ctx.effectManager = { update: vi.fn() };
  ctx.guardian = { update: vi.fn() };
  ctx.bossRenderer = { update: vi.fn() };
  ctx.boss = { update: vi.fn() };
  ctx.dialogueOverlayRenderer = { update: vi.fn() };
  ctx.hudLayer = { update: vi.fn() };
  ctx.getHUDData = vi.fn(() => ({}));
  ctx.canvasManager = { virtualWidth: 1080, virtualHeight: 2160 };
  ctx.kneeFramingValidator = {
    update: vi.fn(() => ({ isFootKeynotePoseInputAllowed: true, status: 'ready' })),
  };
  ctx.kneeFramingGuideRenderer = { update: vi.fn() };
  ctx.calibrationHelper = { isDone: true, baselineShoulderY: 0.28, update: vi.fn() };
  ctx.menuInput = { isActive: false };
  ctx.pauseModal = { isOpen: false, update: vi.fn() };
  ctx.stateMachine = { currentState: 'ANSWER_SELECT' };
  ctx.state = { gamePhase: 'answer_select', screenMode: 'game', currentQuestion: null, feedbackTimer: 0, castingFlash: 0, climaxBarrageTimer: 0 };
  ctx.footKeynoteInput = { setSafetyGuarded: vi.fn(), routeEvent: vi.fn() };
  ctx.footKeynoteDetector = { update: vi.fn(() => []) };
  ctx.dreamGrid = { update: vi.fn() };
  ctx.starCollectionInput = { setPaused: vi.fn(), setTarget: vi.fn() };
  ctx.engine = { elapsedTime: 12.5, isGamePaused: false, pauseGame: vi.fn(), resumeGame: vi.fn() };
  ctx.beatRoundResolver = { currentRoundIndex: 3 };
  ctx.battle = { isAlive: true };
  ctx.actions = { showResult: vi.fn() };
  ctx.sfx = { stopDwellCharge: vi.fn() };
}

describe('runtime answer branch assembly (#312)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn(() => null),
      fullscreenElement: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('연장 전환에서 openWindow를 다시 호출하지 않는다', async () => {
    const app = new AppBootstrap({ canvas: createMockCanvas() as any, autoStartCamera: false, preloadAssets: false });
    await app.init();
    const openWindow = vi.spyOn(app.armReachAnswerSelector, 'openWindow');
    openWindow.mockClear();

    app.beatCoordinator.rhythmEngine.setBpm(140);
    app.beatCoordinator.startRound({ chapter: 1, subLevel: 1 });
    const spb = app.beatCoordinator.rhythmEngine.secondsPerBeat;
    for (let t = 0; t < 8; t++) {
      app.beatCoordinator.update(spb * 0.2, null);
      app.beatCoordinator.recordStep();
      app.beatCoordinator.update(spb * 0.8, null);
    }
    expect(app.beatCoordinator.phase).toBe('ANSWER_SELECT');
    const opensAtEntry = openWindow.mock.calls.length;

    app.beatCoordinator.update(2 * spb + 0.01, null);
    expect(app.beatCoordinator.getAnswerSnapshot().phase).toBe('primary');
    expect(openWindow.mock.calls.length).toBe(opensAtEntry);
    app.dispose();
  });

  it('일시정지 중 키보드/클릭 답안을 확정하지 않는다', async () => {
    const app = new AppBootstrap({ canvas: createMockCanvas() as any, autoStartCamera: false, preloadAssets: false });
    await app.init();
    app.beatCoordinator.rhythmEngine.setBpm(140);
    app.beatCoordinator.startRound({ chapter: 1, subLevel: 1 });
    const spb = app.beatCoordinator.rhythmEngine.secondsPerBeat;
    for (let t = 0; t < 8; t++) {
      app.beatCoordinator.update(spb * 0.2, null);
      app.beatCoordinator.recordStep();
      app.beatCoordinator.update(spb * 0.8, null);
    }
    expect(app.stateMachine.currentState).toBe('ANSWER_SELECT');

    app.pauseModal.open();
    const confirm = vi.spyOn(app.beatCoordinator, 'confirmAnswerByFallback');
    (app as any)._onKeyDown({ key: '1', code: 'Digit1', repeat: false, preventDefault: () => {} });
    const [btn] = getAnswerButtonLayouts(app.canvasManager.virtualWidth, app.canvasManager.virtualHeight);
    const canvas = (app as any).canvas as { width: number; height: number; getBoundingClientRect: () => { left: number; top: number; width: number; height: number } };
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + ((btn.x + btn.width / 2) / app.canvasManager.virtualWidth) * rect.width;
    const clientY = rect.top + ((btn.y + btn.height / 2) / app.canvasManager.virtualHeight) * rect.height;
    (app as any)._onCanvasClick({ clientX, clientY });
    expect(confirm).not.toHaveBeenCalled();
    expect(app.beatCoordinator.selectedChoiceIndex).toBeNull();
    app.dispose();
  });

  it('분기 시작 시 star/hazard start에 coordinator BPM을 주입하고 같은 dt를 두 번 더하지 않는다', () => {
    const director = new SceneDirector();
    const spb = 60 / 140;
    const clock = {
      bpm: 140,
      secondsPerBeat: spb,
      startElapsed: 1.2,
      elapsed: 0,
      endElapsed: 1.2 + 8 * spb,
      durationBeats: 8 as const,
    };
    const starNoteScheduler = {
      isStarted: false,
      start: vi.fn(),
      update: vi.fn(),
      setPaused: vi.fn(),
      currentTarget: null,
    };
    const phaseAHazardController = {
      isActive: false,
      start: vi.fn(function (this: { isActive: boolean }, _options?: { secondsPerBeat?: number; branchClock?: { secondsPerBeat: number } }) {
        this.isActive = true;
      }),
      update: vi.fn(),
      activePattern: 'jump',
    };
    const beatCoordinator = {
      isPaused: false,
      pause: vi.fn(),
      resume: vi.fn(),
      phase: 'ANSWER_SELECT',
      currentQuestion: null,
      keynotes: [],
      getBranchClock: () => clock,
      update: vi.fn((_dt: number) => {
        beatCoordinator.phase = 'STAR_COLLECT';
        clock.elapsed += 0.05;
      }),
    };
    const ctx: any = {
      beatCoordinator,
      starNoteScheduler,
      phaseAHazardController,
    };
    stubDirectorSideEffects(ctx);
    ctx.stateMachine.currentState = 'ANSWER_SELECT';
    ctx.state.gamePhase = 'hazard_evade';

    const dt = 0.4;
    director.updateGameScene(dt, ctx);

    expect(starNoteScheduler.start).toHaveBeenCalled();
    const starOpts = starNoteScheduler.start.mock.calls[0][1];
    expect(starOpts.branchClock?.secondsPerBeat ?? starOpts.secondsPerBeat).toBeCloseTo(spb, 6);
    expect(starOpts.secondsPerBeat ?? starOpts.branchClock.secondsPerBeat).not.toBe(0.5);

    beatCoordinator.phase = 'ANSWER_SELECT';
    clock.elapsed = 0;
    phaseAHazardController.isActive = false;
    beatCoordinator.update.mockImplementation((_frameDt: number) => {
      beatCoordinator.phase = 'HAZARD_EVADE';
      clock.elapsed += 0.05;
    });
    director.updateGameScene(dt, ctx);
    expect(phaseAHazardController.start).toHaveBeenCalled();
    const hazardOpts = phaseAHazardController.start.mock.calls[0][0];
    expect(hazardOpts?.branchClock?.secondsPerBeat ?? hazardOpts?.secondsPerBeat).toBeCloseTo(spb, 6);

    const hazardSteps = phaseAHazardController.update.mock.calls.reduce((sum, call) => sum + call[0], 0);
    expect(hazardSteps).toBeLessThan(dt);
    expect(beatCoordinator.update).toHaveBeenCalledWith(dt, null);
  });

  it('늦은 포즈 샘플 시각을 과거 경계로 되돌리지 않는다', () => {
    const director = new SceneDirector();
    const sampleTime = 9.75;
    const beatCoordinator = {
      isPaused: false,
      pause: vi.fn(),
      resume: vi.fn(),
      phase: 'ANSWER_SELECT',
      currentQuestion: { id: 'q' },
      keynotes: [],
      getBranchClock: () => null,
      update: vi.fn(),
    };
    const ctx: any = { beatCoordinator, starNoteScheduler: { isStarted: true, start: vi.fn(), update: vi.fn(), setPaused: vi.fn() }, phaseAHazardController: { isActive: false, start: vi.fn(), update: vi.fn() } };
    stubDirectorSideEffects(ctx);
    ctx.engine.elapsedTime = sampleTime;
    const landmarks = Array.from({ length: 33 }, () => ({ x: 100, y: 200 }));
    ctx.skeletonAnimation.smoothedLandmarks = landmarks;

    director.updateGameScene(0.2, ctx);

    expect(beatCoordinator.update).toHaveBeenCalledWith(0.2, expect.any(Array));
    const passed = beatCoordinator.update.mock.calls[0][1] as Array<{ timestamp?: number }>;
    const stamped = passed.find((lm) => lm.timestamp !== undefined);
    expect(stamped?.timestamp).toBe(sampleTime);
    expect(stamped?.timestamp).not.toBeLessThan(sampleTime);
  });
});
