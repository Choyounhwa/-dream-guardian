/**
 * scene-director-answer-presentation.test.ts
 * [CORE-ANSWER-PRESENTATION-001 / Issue #313]
 * 읽기 전용 답안 snapshot을 QuestionRenderer로 전달한다.
 * 시간은 렌더 경로에서 계산하지 않는다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneDirector } from '../../src/core/SceneDirector.js';

const primarySnap = {
  windowId: 1,
  phase: 'primary' as const,
  primaryBeats: 2,
  extensionBeats: 2,
  maxBeats: 4,
  elapsedBeats: 0.4,
  remainingBeats: 3.6,
  inputOpen: true,
};

const extensionSnap = {
  windowId: 1,
  phase: 'extension' as const,
  primaryBeats: 2,
  extensionBeats: 2,
  maxBeats: 4,
  elapsedBeats: 2.5,
  remainingBeats: 1.5,
  inputOpen: true,
};

const closedSnap = {
  windowId: 1,
  phase: 'closed' as const,
  primaryBeats: 2,
  extensionBeats: 2,
  maxBeats: 4,
  elapsedBeats: 4,
  remainingBeats: 0,
  inputOpen: false,
};

function createMockCanvas() {
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
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    getContext: () => ctx,
  };
}

function hand(zoneId: number, score: number) {
  return { zoneId, score, answerIndex: zoneId === 4 ? 0 : zoneId === 5 ? 1 : null };
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  const canvas = createMockCanvas();
  const questionRenderer = { render: vi.fn() };
  const beatCoordinator = {
    phase: 'ANSWER_SELECT',
    isAnswerOpen: true,
    answerApproachProgress: 0,
    getAnswerSnapshot: vi.fn(() => primarySnap),
    ...(overrides.beatCoordinator as object | undefined),
  };
  const armReachAnswerSelector = {
    state: {
      leftHand: hand(4, 0.62),
      rightHand: hand(0, 0),
      lockedChoice: null,
      confirmedChoice: null,
    },
    ...(overrides.armReachAnswerSelector as object | undefined),
  };
  const     effectManager = { play: vi.fn(), playAnswerEffect: vi.fn(), playPreset: vi.fn(), render: vi.fn() };
  const speech = { speakFeedback: vi.fn(), speak: vi.fn() };
  const stateMachine = {
    currentState: 'ANSWER_SELECT',
    changeState: vi.fn(),
    ...(overrides.stateMachine as object | undefined),
  };

  const ctx: any = {
    canvas,
    canvasManager: {
      ctx: canvas.getContext(),
      virtualWidth: 800,
      virtualHeight: 600,
      resize: vi.fn(),
    },
    cameraLayer: { isActive: false, status: 'stopped' },
    imageLoader: { get: vi.fn(() => null) },
    dreamGrid: { render: vi.fn() },
    starNoteRenderer: { render: vi.fn() },
    starNoteScheduler: { currentTarget: null, activeNotes: [], isPaused: false },
    bossRenderer: { render: vi.fn() },
    hudLayer: { render: vi.fn() },
    getHUDData: vi.fn(() => ({})),
    questionRenderer,
    beatCoordinator,
    armReachAnswerSelector,
    effectManager,
    speech,
    sfx: { play: vi.fn() },
    stateMachine,
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
    locomotionModal: { selectedMode: 'run' },
    stickmanRenderer: { render: vi.fn() },
    renderFeedback: vi.fn(),
    bossFeverController: null,
    state: {
      currentChapter: 1,
      gamePhase: 'playing',
      currentQuestion: { text: '1+1', answer: 2 },
      questionVisible: true,
      lastFrameDt: 0.016,
      climaxBarrageTimer: 0,
    },
    boss: { phase: 'idle', hp: 10, maxHp: 10 },
    engine: { elapsedTime: 12, paused: false },
    eventBus: { emit: vi.fn() },
  };

  for (const key of Object.keys(overrides)) {
    if (key === 'beatCoordinator' || key === 'armReachAnswerSelector' || key === 'stateMachine') continue;
    ctx[key] = overrides[key];
  }
  return ctx;
}

describe('SceneDirector answer presentation (#313)', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;
  let perfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now');
    perfSpy = vi.spyOn(performance, 'now');
  });

  afterEach(() => {
    nowSpy.mockRestore();
    perfSpy.mockRestore();
  });

  function render(ctx: any) {
    const director = new SceneDirector();
    director.renderGameScene(ctx);
    return ctx.questionRenderer.render.mock.calls.at(-1)?.[3];
  }

  it('ANSWER_SELECT primary snapshot을 그대로 전달하고 showAnswerTime은 true다', () => {
    const ctx = makeCtx();
    const state = render(ctx);
    expect(ctx.beatCoordinator.getAnswerSnapshot).toHaveBeenCalled();
    expect(state.answerTime).toEqual(primarySnap);
    expect(state.showAnswerTime).toBe(true);
    expect(state.choiceProgress).toEqual([0.62, 0]);
    expect(Date.now).not.toHaveBeenCalled();
    expect(performance.now).not.toHaveBeenCalled();
  });

  it('extension snapshot을 전달해도 timeout/오답/회피 전이를 발생시키지 않는다', () => {
    const ctx = makeCtx({
      beatCoordinator: {
        phase: 'ANSWER_SELECT',
        isAnswerOpen: true,
        getAnswerSnapshot: vi.fn(() => extensionSnap),
      },
    });
    const state = render(ctx);
    expect(state.answerTime).toEqual(extensionSnap);
    expect(state.showAnswerTime).toBe(true);
    expect(ctx.effectManager.play).not.toHaveBeenCalled();
    expect(ctx.effectManager.playAnswerEffect).not.toHaveBeenCalled();
    expect(ctx.effectManager.playPreset).not.toHaveBeenCalled();
    expect(ctx.speech.speakFeedback).not.toHaveBeenCalled();
    expect(ctx.sfx.play).not.toHaveBeenCalled();
    expect(ctx.stateMachine.changeState).not.toHaveBeenCalled();
    expect(ctx.eventBus.emit).not.toHaveBeenCalled();
  });

  it('choiceProgress는 remainingBeats가 아니라 arm score에서 온다', () => {
    const snap = { ...primarySnap, remainingBeats: 0.1, elapsedBeats: 3.9 };
    const ctx = makeCtx({
      beatCoordinator: {
        phase: 'ANSWER_SELECT',
        isAnswerOpen: true,
        getAnswerSnapshot: vi.fn(() => snap),
      },
      armReachAnswerSelector: {
        state: {
          leftHand: hand(5, 0.4),
          rightHand: hand(4, 0.15),
          lockedChoice: null,
          confirmedChoice: null,
        },
      },
    });
    const state = render(ctx);
    expect(state.choiceProgress).toEqual([0.15, 0.4]);
    expect(state.choiceProgress[0]).not.toBeCloseTo(snap.remainingBeats);
    expect(state.answerTime.remainingBeats).toBe(0.1);
  });

  it('closed window는 showAnswerTime false다', () => {
    const ctx = makeCtx({
      beatCoordinator: {
        phase: 'ANSWER_SELECT',
        isAnswerOpen: false,
        getAnswerSnapshot: vi.fn(() => closedSnap),
      },
    });
    const state = render(ctx);
    expect(state.showAnswerTime).toBe(false);
  });

  it('inputOpen false primary는 활성 타이머를 표시하지 않는다', () => {
    const snap = { ...primarySnap, inputOpen: false };
    const ctx = makeCtx({
      beatCoordinator: {
        phase: 'ANSWER_SELECT',
        isAnswerOpen: false,
        getAnswerSnapshot: vi.fn(() => snap),
      },
    });
    expect(render(ctx).showAnswerTime).toBe(false);
  });

  it('RUN_QUESTION 프리뷰는 showAnswerTime false다', () => {
    const ctx = makeCtx({
      stateMachine: { currentState: 'RUN_QUESTION', changeState: vi.fn() },
      beatCoordinator: {
        phase: 'RUN_QUESTION',
        isAnswerOpen: false,
        answerApproachProgress: 0.5,
        completedExerciseBeats: 6,
        exerciseBeats: 8,
        questionApproachProgress: 0.5,
        getAnswerSnapshot: vi.fn(() => primarySnap),
      },
    });
    ctx.beatHUDRenderer = { render: vi.fn() };
    const state = render(ctx);
    expect(state.showAnswerTime).toBe(false);
    expect(state.answerTime).toBeUndefined();
    expect(state.buttonsOnly).toBe(true);
  });

  it('STAR_COLLECT / HAZARD_EVADE 분기 렌더는 활성 답안 타이머를 유지하지 않는다', () => {
    for (const gameState of ['STAR_COLLECT', 'HAZARD_EVADE'] as const) {
      const ctx = makeCtx({
        stateMachine: { currentState: gameState, changeState: vi.fn() },
        beatCoordinator: {
          phase: gameState,
          isAnswerOpen: false,
          getAnswerSnapshot: vi.fn(() => primarySnap),
        },
      });
      if (gameState === 'HAZARD_EVADE') {
        ctx.phaseAHazardController = {
          isEvaded: false,
          performedAction: null,
          activePattern: null,
          beatProgress: 0,
          isResolved: false,
        };
      }
      directorRender(ctx);
      const calls = ctx.questionRenderer.render.mock.calls;
      const active = calls.filter((c: any[]) => c[3]?.showAnswerTime === true);
      expect(active).toHaveLength(0);
    }
  });

  it('같은 pause snapshot을 두 번 렌더하면 answerTime이 동일하다', () => {
    const paused = { ...primarySnap, elapsedBeats: 1.25, remainingBeats: 2.75 };
    const ctx = makeCtx({
      beatCoordinator: {
        phase: 'ANSWER_SELECT',
        isAnswerOpen: true,
        getAnswerSnapshot: vi.fn(() => paused),
      },
      engine: { elapsedTime: 3, paused: true },
    });
    const director = new SceneDirector();
    director.renderGameScene(ctx);
    director.renderGameScene(ctx);
    const [a, b] = ctx.questionRenderer.render.mock.calls.map((c: any[]) => c[3].answerTime);
    expect(a).toEqual(paused);
    expect(b).toEqual(paused);
    expect(a).toEqual(b);
    expect(Date.now).not.toHaveBeenCalled();
    expect(performance.now).not.toHaveBeenCalled();
  });

  it('새 라운드 snapshot은 이전 answerTime을 재사용하지 않는다', () => {
    const first = { ...primarySnap, windowId: 3, elapsedBeats: 1 };
    const second = { ...primarySnap, windowId: 4, elapsedBeats: 0, remainingBeats: 4 };
    const snaps = [first, second];
    const ctx = makeCtx({
      beatCoordinator: {
        phase: 'ANSWER_SELECT',
        isAnswerOpen: true,
        getAnswerSnapshot: vi.fn(() => snaps.shift()),
      },
    });
    const director = new SceneDirector();
    director.renderGameScene(ctx);
    director.renderGameScene(ctx);
    const times = ctx.questionRenderer.render.mock.calls.map((c: any[]) => c[3].answerTime);
    expect(times[0].windowId).toBe(3);
    expect(times[1].windowId).toBe(4);
    expect(times[1]).not.toEqual(times[0]);
  });
});

function directorRender(ctx: any) {
  new SceneDirector().renderGameScene(ctx);
}
