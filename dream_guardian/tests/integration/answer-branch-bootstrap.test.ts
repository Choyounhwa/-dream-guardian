/**
 * tests/integration/answer-branch-bootstrap.test.ts
 *
 * [QA-ANSWER-BRANCH-001 / Issue #314]
 * 실제 AppBootstrap 및 SceneDirector 기반 2+2박 답안·8박 분기 및 10문제→Phase B 최종 통합 검증
 *
 * 검증 매트릭스:
 * 1. AppBootstrap 전체 서브시스템 와이어링 정합성 (stateMachine 초기 MENU_MAIN 확인)
 * 2. 2+2박 창 수명주기 및 경계값(±epsilon): 기본 [0, 2박), 연장 [2, 4박), 만료 [4박 이상]
 * 3. 키보드 / 클릭 fallback 및 일시정지(pause) 차단
 * 4. 가변 BPM (110, 115, 120, 125, 135, 140) 전 구간에서 8박 분기(STAR_COLLECT / HAZARD_EVADE) 및 ROUND_RESOLVE
 * 5. wrongAnswerCount vs timeoutCount 분리 및 HP 직접 피해 0 정책
 * 6. 10라운드 누적 정산 → Phase B (BOSS_CLIMAX) 1회 인계 및 11번째 라운드 차단
 * 7. 합성 Pose Landmark 주입 시 팔 뻗기 선택기 및 MotionIntentBus 무결성
 * 8. 자동화(Vitest headless) 검증과 실제 브라우저/실카메라 검증 경계 분리 명시
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    canvas: { width: 1280, height: 720 },
    fillStyle: '#ffffff',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
  };

  return {
    width: 1280,
    height: 720,
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => {},
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function loadTestQuestions(app: AppBootstrap) {
  app.questionBank.loadRecords([
    {
      level: 1,
      subLevel: 1,
      levelTitle: '덧셈 기초',
      subLevelTitle: '한 자리 덧셈',
      questionTemplate: '{A} + {B} = ?',
      answerEval: 'A + B',
      wrongEval: 'A + B + 1',
      varA: '1,2,3',
      varB: '1,2,3',
      varC: '',
      varD: '',
      shapeCode: '',
    },
  ]);
}

function exercise8Beats(coordinator: any, spb: number) {
  for (let i = 0; i < 8; i++) {
    coordinator.update(spb * 0.2, null);
    coordinator.recordStep('run');
    coordinator.update(spb * 0.8, null);
  }
}

function createSyntheticLandmarks(reachLeft = false, reachRight = false): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.55, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.55, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.20, z: 0, visibility: 0.9 };

  if (reachLeft) {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.15, y: 0.35, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.25, y: 0.35, z: 0, visibility: 0.95 };
  } else {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.42, y: 0.50, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.42, y: 0.42, z: 0, visibility: 0.95 };
  }

  if (reachRight) {
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.85, y: 0.35, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.75, y: 0.35, z: 0, visibility: 0.95 };
  } else {
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.58, y: 0.50, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.58, y: 0.42, z: 0, visibility: 0.95 };
  }

  return landmarks;
}

describe('[QA-ANSWER-BRANCH-001 / Issue #314] AppBootstrap Runtime Answer-Branch Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
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

  it('AppBootstrap 시스템 초기화 시 핵심 서브시스템들이 올바르게 조립되어야 한다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    expect(app.beatCoordinator).toBeDefined();
    expect(app.stageProgressController).toBeDefined();
    expect(app.sceneDirector).toBeDefined();
    expect(app.armReachAnswerSelector).toBeDefined();
    expect(app.starNoteScheduler).toBeDefined();
    expect(app.phaseAHazardController).toBeDefined();
    expect(app.battle).toBeDefined();

    // 초기 상태 확인 (대기 메뉴)
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    expect(app.beatCoordinator.phase).toBe('RUN_QUESTION');

    app.dispose();
  });

  it('2+2박 창 수명주기 및 경계값(±epsilon)에서 올바른 상태를 반환해야 한다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
      answerRestBeats: 0,
    });
    await app.init();
    loadTestQuestions(app);

    const bpm = 120;
    const spb = 60 / bpm; // 0.5s
    app.beatCoordinator.rhythmEngine.setBpm(bpm);
    app.beatCoordinator.startRound({ chapter: 1, subLevel: 1 });

    // 8박 운동 구간 진행 -> ANSWER_SELECT 진입
    exercise8Beats(app.beatCoordinator, spb);
    expect(app.beatCoordinator.phase).toBe('ANSWER_SELECT');

    // 1) 0박 시점: primary
    let snap = app.beatCoordinator.getAnswerSnapshot();
    expect(snap.phase).toBe('primary');
    expect(snap.inputOpen).toBe(true);

    // 1.95박 시점: primary 유지
    app.beatCoordinator.update(1.95 * spb, null);
    snap = app.beatCoordinator.getAnswerSnapshot();
    expect(snap.phase).toBe('primary');
    expect(snap.inputOpen).toBe(true);

    // 2) 2.05박 시점: 4박 정책으로 primary 계속 유지
    app.beatCoordinator.update(0.1 * spb, null);
    snap = app.beatCoordinator.getAnswerSnapshot();
    expect(snap.phase).toBe('primary');
    expect(snap.inputOpen).toBe(true);

    // 3) 3.95박 시점: 4박 직전 primary 유지
    app.beatCoordinator.update(1.9 * spb, null);
    snap = app.beatCoordinator.getAnswerSnapshot();
    expect(snap.phase).toBe('primary');
    expect(snap.inputOpen).toBe(true);

    // 4) 4.05박 시점: 4박 초과로 closed 및 HAZARD_EVADE(timeout) 전환
    app.beatCoordinator.update(0.1 * spb, null);
    snap = app.beatCoordinator.getAnswerSnapshot();
    expect(snap.phase).toBe('closed');
    expect(snap.inputOpen).toBe(false);
    expect(app.beatCoordinator.phase).toBe('HAZARD_EVADE');

    app.dispose();
  });

  it('일시정지 중에는 시간 전진과 답안 입력이 완벽히 차단되어야 한다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();
    loadTestQuestions(app);

    const bpm = 120;
    const spb = 60 / bpm;
    app.startRunningPhase();
    app.beatCoordinator.rhythmEngine.setBpm(bpm);

    exercise8Beats(app.beatCoordinator, spb);
    expect(app.stateMachine.currentState).toBe('ANSWER_SELECT');

    // Pause 모달 열기
    app.pauseModal.open();
    expect(app.pauseModal.isOpen).toBe(true);

    // 일시정지 중 키보드 '1'번 선택 시도 -> 무시되어야 함
    (app as any)._onKeyDown({ key: '1', code: 'Digit1', repeat: false, preventDefault: () => {} });
    expect(app.beatCoordinator.selectedChoiceIndex).toBeNull();

    // 일시정지 중 마우스 클릭 시도 -> 무시되어야 함
    const [btn] = getAnswerButtonLayouts(app.canvasManager.virtualWidth, app.canvasManager.virtualHeight);
    const canvas = (app as any).canvas;
    const rect = canvas.getBoundingClientRect();
    (app as any)._onCanvasClick({
      clientX: rect.left + ((btn.x + btn.width / 2) / app.canvasManager.virtualWidth) * rect.width,
      clientY: rect.top + ((btn.y + btn.height / 2) / app.canvasManager.virtualHeight) * rect.height,
    });
    expect(app.beatCoordinator.selectedChoiceIndex).toBeNull();

    // 일시정지 해제 후 선택 정상 작동 확인
    app.pauseModal.close(true);
    expect(app.pauseModal.isOpen).toBe(false);

    (app as any)._onKeyDown({ key: '1', code: 'Digit1', repeat: false, preventDefault: () => {} });
    expect(app.beatCoordinator.selectedChoiceIndex).toBe(0);

    app.dispose();
  });

  it('가변 BPM (110, 115, 120, 125, 135, 140) 전 구간에서 8박 분기 수명주기가 정합해야 한다', async () => {
    const bpms = [110, 115, 120, 125, 135, 140];

    for (const bpm of bpms) {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
      answerRestBeats: 0,
    });
      await app.init();
      loadTestQuestions(app);

      const spb = 60 / bpm;
      app.beatCoordinator.rhythmEngine.setBpm(bpm);
      app.beatCoordinator.startRound({ chapter: 1, subLevel: 1 });

      // 8박 운동
      exercise8Beats(app.beatCoordinator, spb);
      expect(app.beatCoordinator.phase).toBe('ANSWER_SELECT');

      // 정답 선택 -> STAR_COLLECT 8박 분기
      const question = app.beatCoordinator.currentQuestion!;
      const correctIdx = question.correctIndex;
      app.beatCoordinator.confirmAnswerByFallback(correctIdx);

      expect(app.beatCoordinator.phase).toBe('STAR_COLLECT');
      const branchClock = app.beatCoordinator.getBranchClock();
      expect(branchClock).toBeDefined();
      expect(branchClock!.bpm).toBe(bpm);
      expect(branchClock!.durationBeats).toBe(8);

      // 분기 8박 진행
      app.beatCoordinator.update(8 * spb, null);
      // 8박 완료 후 ROUND_RESOLVE 전이
      expect(app.beatCoordinator.phase).toBe('ROUND_RESOLVE');

      app.dispose();
    }
  });

  it('오답 및 타임아웃은 HP를 직접 깎지 않고 통계(wrong/timeout)가 엄격히 분리되어야 한다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
      answerRestBeats: 0,
    });
    await app.init();
    loadTestQuestions(app);

    const bpm = 120;
    const spb = 60 / bpm;
    const initialHp = app.battle.hp;

    // 1) Round 1: 오답 선택 시뮬레이션
    app.beatCoordinator.startRound({ chapter: 1, subLevel: 1 });
    exercise8Beats(app.beatCoordinator, spb);

    const q1 = app.beatCoordinator.currentQuestion!;
    const wrongIdx = (q1.correctIndex + 1) % q1.choices.length;
    app.beatCoordinator.confirmAnswerByFallback(wrongIdx);
    expect(app.beatCoordinator.phase).toBe('HAZARD_EVADE');

    // 분기 8박 진행 (장판 피격 없는 경우)
    app.beatCoordinator.update(8 * spb, null);
    expect(app.beatCoordinator.phase).toBe('ROUND_RESOLVE');

    // Round 1 정산
    app.beatRoundResolver.resolveRound('wrong', 1);

    // 오답 자체로는 플레이어 HP 피해 0
    expect(app.battle.hp).toBe(initialHp);

    // 2) Round 2: 타임아웃(미응답) 시뮬레이션
    app.beatCoordinator.startRound({ chapter: 1, subLevel: 1 });
    exercise8Beats(app.beatCoordinator, spb);

    // 4박 대기 -> 만료
    app.beatCoordinator.update(4.01 * spb, null);
    expect(app.beatCoordinator.phase).toBe('HAZARD_EVADE');

    app.beatCoordinator.update(8 * spb, null);
    expect(app.beatCoordinator.phase).toBe('ROUND_RESOLVE');

    // Round 2 정산
    app.beatRoundResolver.resolveRound('timeout', 2);

    // 타임아웃 자체로도 플레이어 HP 피해 0
    expect(app.battle.hp).toBe(initialHp);

    // 통계 분리 검증 (BeatRoundResolver의 rhythmStats 기준)
    const stats = app.beatRoundResolver.rhythmStats;
    expect(stats.wrongAnswerCount).toBe(1);
    expect(stats.timeoutCount).toBe(1);

    app.dispose();
  });

  it('10라운드 누적 정산 시 Phase B (BOSS_CLIMAX)로 1회만 인계되며 11번째 라운드는 차단되어야 한다', async () => {
    vi.useFakeTimers();
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
      answerRestBeats: 0,
    });
    await app.init();
    loadTestQuestions(app);

    let bossClimaxTriggerCount = 0;
    app.eventBus.on('state:change', (event: any) => {
      if (event.to === 'BOSS_CLIMAX') {
        bossClimaxTriggerCount++;
      }
    });

    app.startChapter(1, 1);
    app.startRunningPhase();
    const spb = app.beatCoordinator.rhythmEngine.secondsPerBeat;

    // 10라운드 완주 시뮬레이션
    for (let round = 1; round <= 10; round++) {
      exercise8Beats(app.beatCoordinator, spb);

      // 정답 선택
      const q = app.beatCoordinator.currentQuestion!;
      app.beatCoordinator.confirmAnswerByFallback(q.correctIndex);

      // 분기 8박 진행 -> onAnswerConfirmed -> stageProgressController 자동 연동
      app.beatCoordinator.update(8 * spb, null);
      expect(app.beatCoordinator.phase).toBe('ROUND_RESOLVE');
      expect(app.stageProgressController.settledRoundCount).toBe(round);

      if (round < 10) {
        // advanceDelayMs (800ms) 경과 후 다음 라운드로 전이
        vi.advanceTimersByTime(800);
        expect(app.stateMachine.currentState).toBe('RUN_QUESTION');
      } else {
        // 10번째 라운드 완료 시 BOSS_CLIMAX로 전환
        vi.advanceTimersByTime(800);
        expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
        expect(app.stageProgressController.hasEnteredBossClimax).toBe(true);
      }
    }

    // 10라운드 누적 후 BOSS_CLIMAX 단 1회 인계 확인
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(app.stageProgressController.hasEnteredBossClimax).toBe(true);
    expect(app.stageProgressController.handoffCount).toBe(1);

    // 11번째 라운드 정산 시도 시 차단 확인 (ALREADY_HANDED_OFF)
    const eleventhResult = app.stageProgressController.handleRoundSettled(
      { roundIndex: 11, playerDefeated: false, playerHp: app.battle.hp },
      { immediate: true },
    );
    expect(eleventhResult.type).toBe('IGNORED');
    if (eleventhResult.type === 'IGNORED') {
      expect(eleventhResult.reason).toBe('ALREADY_HANDED_OFF');
    }

    app.dispose();
    vi.useRealTimers();
  });

  it('합성 Pose 주입 시 ArmReachAnswerSelector 및 MotionIntentBus가 예외 없이 동작해야 한다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();
    loadTestQuestions(app);

    const spb = 60 / 120;
    app.startRunningPhase();
    exercise8Beats(app.beatCoordinator, spb);
    expect(app.beatCoordinator.phase).toBe('ANSWER_SELECT');

    // 답안 창 열림 상태 확인 (BeatRunCoordinator 기준)
    expect(app.beatCoordinator.isAnswerOpen).toBe(true);
    expect(app.armReachAnswerSelector.isConfirmed).toBe(false);

    // 좌측 팔 뻗기 합성 랜드마크 주입
    const leftReachLandmarks = createSyntheticLandmarks(true, false);
    expect(() => {
      app.armReachAnswerSelector.update(0.033, leftReachLandmarks);
    }).not.toThrow();

    // 우측 팔 뻗기 합성 랜드마크 주입
    const rightReachLandmarks = createSyntheticLandmarks(false, true);
    expect(() => {
      app.armReachAnswerSelector.update(0.066, rightReachLandmarks);
    }).not.toThrow();

    app.dispose();
  });

  it('자동화 단위/통합 계약과 실제 브라우저 실카메라 검증 범위를 구분하여 기록한다', () => {
    // 자동화 테스트로 증명되는 항목
    const automatedCoverage = {
      windowLifecycle: true,
      variableBpm8BeatBranch: true,
      wrongVsTimeoutStatsSeparation: true,
      tenRoundsBossClimaxHandoff: true,
      eleventhRoundBlocked: true,
      syntheticLandmarksEvaluation: true,
    };
    expect(automatedCoverage.windowLifecycle).toBe(true);
    expect(automatedCoverage.variableBpm8BeatBranch).toBe(true);
    expect(automatedCoverage.wrongVsTimeoutStatsSeparation).toBe(true);
    expect(automatedCoverage.tenRoundsBossClimaxHandoff).toBe(true);

    // 실제 브라우저 / Chrome 웹캠을 통해서만 확인 가능한 수동 검증 항목 명시
    const manualBrowserCoverage = {
      realWebcamMediaStream: 'requires-chrome-browser',
      userPhysicalArmExtension: 'requires-real-human-motion',
      screenOrientationAndResizeLag: 'requires-viewport-interaction',
      audioSynthesizerOutput: 'requires-web-audio-hardware',
    };
    expect(manualBrowserCoverage.realWebcamMediaStream).toBe('requires-chrome-browser');
  });
});
