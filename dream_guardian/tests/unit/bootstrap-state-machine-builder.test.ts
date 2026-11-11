import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import {
  BootstrapStateMachineBuilder,
  type BootstrapStateMachineHost,
} from '../../src/core/bootstrap/BootstrapStateMachineBuilder.js';
import {
  DEFAULT_STORY_BGM_TRACK,
  DEFAULT_STORY_BGM_BPM,
  DEFAULT_ASSAULT_BGM_TRACK,
  DEFAULT_ASSAULT_BGM_BPM,
} from '../../config/audio.config.js';

describe('BootstrapStateMachineBuilder (#617 / [REFACTOR-CORE-002])', () => {
  let stateMachine: StateMachine;
  let host: BootstrapStateMachineHost;
  let stateMap: {
    screenMode: string;
    menuMode: string;
    gamePhase: string;
    questionVisible: boolean;
    answerLocked: boolean;
    feedbackTimer: number;
    rhythmStarCombo: number;
  };

  let mockMotionIntentBus: { setPhase: ReturnType<typeof vi.fn> };
  let mockBgmManager: any;
  let mockStageBgm: any;
  let mockSfx: any;
  let mockEffectManager: any;
  let mockCanvasManager: any;
  let mockResultRenderer: any;
  let mockMenuInput: any;
  let mockPauseModal: any;
  let mockArmReachAnswerSelector: any;
  let mockStarNoteScheduler: any;
  let mockStarCollectionInput: any;
  let mockPhaseAHazardController: any;
  let mockBossFeverController: any;
  let mockBossHazardController: any;
  let mockStageProgressController: any;
  let mockBeatRoundResolver: any;
  let mockBeatCoordinator: any;
  let mockPlayedNoteAudioIds: Set<string>;
  let mockFlushPendingUI: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stateMachine = new StateMachine('MENU_MAIN');
    stateMap = {
      screenMode: 'menu',
      menuMode: 'main',
      gamePhase: 'running',
      questionVisible: false,
      answerLocked: false,
      feedbackTimer: 0,
      rhythmStarCombo: 0,
    };

    mockMotionIntentBus = { setPhase: vi.fn() };
    mockBgmManager = {
      isPlaying: false,
      isPaused: false,
      fadeIn: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
      fadeOut: vi.fn(),
      setPhase: vi.fn(),
      setTrack: vi.fn(),
    };
    mockStageBgm = {
      isPlaying: false,
      isPaused: false,
      start: vi.fn(),
      stop: vi.fn(),
      fadeOut: vi.fn(),
    };
    mockSfx = {
      stopDwellCharge: vi.fn(),
    };
    mockEffectManager = {
      playVictoryCelebration: vi.fn(),
      playDefeatDarken: vi.fn(),
    };
    mockCanvasManager = {
      virtualWidth: 1920,
      virtualHeight: 1080,
    };
    mockResultRenderer = {
      resetAnimation: vi.fn(),
    };
    mockMenuInput = {
      reset: vi.fn(),
    };
    mockPauseModal = {
      close: vi.fn(),
    };
    mockArmReachAnswerSelector = {
      closeWindow: vi.fn(),
    };
    mockPlayedNoteAudioIds = new Set<string>(['note-1', 'note-2']);
    mockStarNoteScheduler = {
      isStarted: false,
      start: vi.fn(),
      reset: vi.fn(),
    };
    mockStarCollectionInput = {
      reset: vi.fn(),
    };
    mockPhaseAHazardController = {
      isActive: false,
      start: vi.fn(),
      reset: vi.fn(),
      stop: vi.fn(),
    };
    mockBossFeverController = {
      isActive: false,
      start: vi.fn(),
      stop: vi.fn(),
      setStageBundle: vi.fn(),
    };
    mockBossHazardController = {
      isActive: false,
      start: vi.fn(),
      stop: vi.fn(),
      setStageBundle: vi.fn(),
    };
    mockStageProgressController = {
      hasEnteredBossClimax: false,
    };
    mockBeatRoundResolver = {
      currentRoundIndex: 1,
      resourceManager: {
        troopManager: {
          isActive: false,
          startPhaseB: vi.fn(),
          stop: vi.fn(),
        },
      },
      getResourceSnapshot: vi.fn().mockReturnValue({ hp: 100 }),
    };
    mockBeatCoordinator = {
      getBranchClock: vi.fn().mockReturnValue({ secondsPerBeat: 0.5 }),
      rhythmEngine: { secondsPerBeat: 0.5 },
    };
    mockFlushPendingUI = vi.fn();

    host = {
      stateMachine,
      motionIntentBus: mockMotionIntentBus,
      setScreenMode: (m) => { stateMap.screenMode = m; },
      setMenuMode: (m) => { stateMap.menuMode = m; },
      setGamePhase: (p) => { stateMap.gamePhase = p; },
      setQuestionVisible: (v) => { stateMap.questionVisible = v; },
      setAnswerLocked: (l) => { stateMap.answerLocked = l; },
      setFeedbackTimer: (t) => { stateMap.feedbackTimer = t; },
      setRhythmStarCombo: (c) => { stateMap.rhythmStarCombo = c; },

      bgmManager: mockBgmManager,
      stageBgm: mockStageBgm,
      sfx: mockSfx,
      effectManager: mockEffectManager,
      canvasManager: mockCanvasManager,
      resultRenderer: mockResultRenderer,
      menuInput: mockMenuInput,
      pauseModal: mockPauseModal,
      armReachAnswerSelector: mockArmReachAnswerSelector,
      playedNoteAudioIds: mockPlayedNoteAudioIds,
      starNoteScheduler: mockStarNoteScheduler,
      starCollectionInput: mockStarCollectionInput,
      phaseAHazardController: mockPhaseAHazardController,
      bossFeverController: mockBossFeverController,
      bossHazardController: mockBossHazardController,
      stageProgressController: mockStageProgressController,
      beatRoundResolver: mockBeatRoundResolver,
      beatCoordinator: mockBeatCoordinator,
      engine: { elapsedTime: 12.5 },
      sessionContext: { activeStageBundle: null },

      getPhaseAStarNotes: () => [{ beat: 1, hand: 'left' }],
      getPhaseAHazardPattern: () => ({ name: 'test_hazard' }),
      flushPendingUIPresentation: mockFlushPendingUI,
      getResultData: () => ({ correctCount: 10, totalQuestions: 10, elapsedTime: 45 } as any),
      calcStars: () => 3,
    };
  });

  it('빌더 생성 및 host 참조가 정상이어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    expect(builder.host).toBe(host);
  });

  it('registerTransitionListener가 상태 전환 시 screenMode/menuMode/gamePhase 동기화 및 motionIntentBus에 통지해야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerTransitionListener();

    // MENU_MAIN -> MENU_SUB
    stateMachine.changeState('MENU_SUB');
    expect(stateMap.screenMode).toBe('menu');
    expect(stateMap.menuMode).toBe('sub');
    expect(mockMotionIntentBus.setPhase).toHaveBeenCalledWith('MENU_SUB');

    // MENU_SUB -> READY_POSITION
    stateMachine.changeState('READY_POSITION');
    expect(stateMap.screenMode).toBe('game');
    expect(stateMap.gamePhase).toBe('ready_frame');
    expect(mockMotionIntentBus.setPhase).toHaveBeenCalledWith('READY_POSITION');

    // READY_POSITION -> RUN_QUESTION
    stateMachine.changeState('RUN_QUESTION');
    expect(stateMap.screenMode).toBe('game');
    expect(stateMap.gamePhase).toBe('running');

    // RUN_QUESTION -> ANSWER_SELECT
    stateMachine.changeState('ANSWER_SELECT');
    expect(stateMap.screenMode).toBe('game');
    expect(stateMap.gamePhase).toBe('answer_select');

    // ANSWER_SELECT -> STAR_COLLECT
    stateMachine.changeState('STAR_COLLECT');
    expect(stateMap.screenMode).toBe('game');
    expect(stateMap.gamePhase).toBe('star_collect');

    // STAR_COLLECT -> ROUND_RESOLVE
    stateMachine.changeState('ROUND_RESOLVE');
    expect(stateMap.screenMode).toBe('game');
    expect(stateMap.gamePhase).toBe('running');

    // ROUND_RESOLVE -> RESULT
    stateMachine.changeState('RESULT');
    expect(stateMap.screenMode).toBe('result');
  });

  it('READY_POSITION 상태 진입 시 questionVisible=false, answerLocked=true 및 BGM을 시작해야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerReadyPositionState();

    stateMachine.changeState('READY_POSITION');
    expect(stateMap.questionVisible).toBe(false);
    expect(stateMap.answerLocked).toBe(true);
    expect(mockBgmManager.setTrack).toHaveBeenCalledWith(DEFAULT_STORY_BGM_TRACK, DEFAULT_STORY_BGM_BPM);
    expect(mockBgmManager.fadeIn).toHaveBeenCalledWith(0.5);
    expect(mockStageBgm.start).toHaveBeenCalled();
  });

  it('READY_POSITION 상태 진입 시 어설트 모드면 DEFAULT_ASSAULT_BGM_TRACK으로 트랙을 전환해야 한다', () => {
    (host as any).assaultWireHelper = { isAssaultMode: () => true };
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerReadyPositionState();

    stateMachine.changeState('READY_POSITION');
    expect(mockBgmManager.setTrack).toHaveBeenCalledWith(DEFAULT_ASSAULT_BGM_TRACK, DEFAULT_ASSAULT_BGM_BPM);
    expect(mockBgmManager.fadeIn).toHaveBeenCalledWith(0.5);
  });

  it('ASSAULT_ROUND 상태 진입 시 DEFAULT_ASSAULT_BGM_TRACK으로 트랙을 전환하고 BGM을 재생해야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerReadyPositionState();
    builder.registerAssaultRoundState();

    stateMachine.changeState('READY_POSITION');
    stateMachine.changeState('ASSAULT_ROUND');
    expect(stateMap.questionVisible).toBe(false);
    expect(stateMap.answerLocked).toBe(true);
    expect(stateMap.feedbackTimer).toBe(0);
    expect(mockBgmManager.setTrack).toHaveBeenCalledWith(DEFAULT_ASSAULT_BGM_TRACK, DEFAULT_ASSAULT_BGM_BPM);
    expect(mockBgmManager.play).toHaveBeenCalled();
  });

  it('RUN_QUESTION 상태 진입 시 questionVisible=true, answerLocked=true 및 RUN_QUESTION BGM 페이즈를 설정해야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerRunQuestionState();

    stateMachine.changeState('RUN_QUESTION');
    expect(stateMap.questionVisible).toBe(true);
    expect(stateMap.answerLocked).toBe(true);
    expect(mockBgmManager.setPhase).toHaveBeenCalledWith('RUN_QUESTION');
    expect(mockBgmManager.play).toHaveBeenCalled();
    expect(mockStageBgm.start).toHaveBeenCalled();
  });

  it('ANSWER_SELECT 진입 및 퇴장 시 입력 잠금 및 암리치 창 관리가 수행되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerAnswerSelectState();

    stateMachine.changeState('RUN_QUESTION');
    stateMachine.changeState('ANSWER_SELECT');
    expect(stateMap.questionVisible).toBe(true);
    expect(stateMap.answerLocked).toBe(false);

    stateMachine.changeState('ROUND_RESOLVE');
    expect(stateMap.answerLocked).toBe(true);
    expect(mockArmReachAnswerSelector.closeWindow).toHaveBeenCalled();
  });

  it('STAR_COLLECT 진입 및 퇴장 시 스케줄러 시작과 노트 오디오/콤보 리셋이 수행되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerStarCollectState();

    stateMachine.changeState('RUN_QUESTION');
    stateMachine.changeState('ANSWER_SELECT');
    stateMachine.changeState('STAR_COLLECT');

    expect(stateMap.questionVisible).toBe(false);
    expect(stateMap.answerLocked).toBe(true);
    expect(mockStarNoteScheduler.start).toHaveBeenCalled();

    stateMap.rhythmStarCombo = 5;
    stateMachine.changeState('ROUND_RESOLVE');
    expect(mockStarNoteScheduler.reset).toHaveBeenCalled();
    expect(mockStarCollectionInput.reset).toHaveBeenCalled();
    expect(stateMap.rhythmStarCombo).toBe(0);
  });

  it('HAZARD_EVADE 진입 및 퇴장 시 장판 컨트롤러 시작 및 리셋이 수행되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerHazardEvadeState();

    stateMachine.changeState('RUN_QUESTION');
    stateMachine.changeState('ANSWER_SELECT');
    stateMachine.changeState('HAZARD_EVADE');

    expect(stateMap.questionVisible).toBe(false);
    expect(stateMap.answerLocked).toBe(true);
    expect(mockPhaseAHazardController.start).toHaveBeenCalled();

    stateMachine.changeState('ROUND_RESOLVE');
    expect(mockPhaseAHazardController.reset).toHaveBeenCalled();
  });

  it('BOSS_CLIMAX 진입 및 퇴장 시 Phase B 결전 컨트롤러 기동 및 정리가 수행되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerBossClimaxState();

    stateMachine.changeState('RUN_QUESTION');
    stateMachine.changeState('ROUND_RESOLVE');
    stateMachine.changeState('BOSS_CLIMAX');

    expect(mockArmReachAnswerSelector.closeWindow).toHaveBeenCalled();
    expect(mockPhaseAHazardController.stop).toHaveBeenCalled();
    expect(mockBeatRoundResolver.resourceManager.troopManager.startPhaseB).toHaveBeenCalled();
    expect(mockBossFeverController.start).toHaveBeenCalled();
    expect(mockBossHazardController.start).toHaveBeenCalled();

    stateMachine.changeState('RESULT');
    expect(mockBossFeverController.stop).toHaveBeenCalled();
    expect(mockBossHazardController.stop).toHaveBeenCalled();
    expect(mockBeatRoundResolver.resourceManager.troopManager.stop).toHaveBeenCalled();
  });

  it('MENU_MAIN 및 MENU_SUB 진입 시 사운드/입력 리셋 및 모달 닫기가 수행되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerMenuStates();

    stateMachine.changeState('MENU_SUB');
    expect(mockFlushPendingUI).toHaveBeenCalled();
    expect(mockMenuInput.reset).toHaveBeenCalled();

    stateMachine.changeState('MENU_MAIN');
    expect(mockSfx.stopDwellCharge).toHaveBeenCalled();
    expect(mockStageBgm.stop).toHaveBeenCalled();
    expect(mockBgmManager.stop).toHaveBeenCalled();
    expect(mockPauseModal.close).toHaveBeenCalled();
  });

  it('RESULT 및 GAMEOVER 진입 시 사운드 페이드아웃 및 결과/패배 이펙트가 실행되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerResultState();
    builder.registerGameOverState();

    stateMachine.changeState('RUN_QUESTION');
    stateMachine.changeState('ROUND_RESOLVE');
    stateMachine.changeState('RESULT');

    expect(mockStageBgm.fadeOut).toHaveBeenCalledWith(0.4);
    expect(mockBgmManager.fadeOut).toHaveBeenCalledWith(0.4);
    expect(mockResultRenderer.resetAnimation).toHaveBeenCalled();
    expect(mockEffectManager.playVictoryCelebration).toHaveBeenCalledWith(1920, 1080, 3);

    stateMachine.changeState('RUN_QUESTION');
    stateMachine.changeState('GAMEOVER');
    expect(mockEffectManager.playDefeatDarken).toHaveBeenCalledWith(1920, 1080);
  });

  it('enterQuestionPhase 호출 시 ANSWER_SELECT로 전환하고 문제를 표시해야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    stateMachine.changeState('RUN_QUESTION');

    builder.enterQuestionPhase();
    expect(stateMachine.currentState).toBe('ANSWER_SELECT');
    expect(stateMap.questionVisible).toBe(true);
    expect(stateMap.answerLocked).toBe(false);

    // 이미 ANSWER_SELECT이거나 BOSS_CLIMAX 진입 상태면 무시
    mockStageProgressController.hasEnteredBossClimax = true;
    builder.enterQuestionPhase();
    expect(stateMachine.currentState).toBe('ANSWER_SELECT');
  });

  it('handleBeatPhaseChange 호출 시 BeatRunCoordinator 페이즈를 StateMachine 및 BGM 페이즈로 정확히 매핑해야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    builder.registerAll();

    builder.handleBeatPhaseChange('RUN_QUESTION');
    expect(stateMachine.currentState).toBe('RUN_QUESTION');
    expect(mockBgmManager.setPhase).toHaveBeenCalledWith('RUN_QUESTION');

    builder.handleBeatPhaseChange('ANSWER_SELECT');
    expect(stateMachine.currentState).toBe('ANSWER_SELECT');

    builder.handleBeatPhaseChange('STAR_COLLECT');
    expect(stateMachine.currentState).toBe('STAR_COLLECT');

    builder.handleBeatPhaseChange('ROUND_RESOLVE');
    expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
  });

  it('registerAll 실행 시 모든 상태가 한 번에 등록되어야 한다', () => {
    const builder = new BootstrapStateMachineBuilder(host);
    const returned = builder.registerAll();
    expect(returned).toBe(builder);

    // 전체 상태 전환 시도
    stateMachine.changeState('READY_POSITION');
    expect(stateMachine.currentState).toBe('READY_POSITION');
    stateMachine.changeState('RUN_QUESTION');
    expect(stateMachine.currentState).toBe('RUN_QUESTION');
    stateMachine.changeState('ANSWER_SELECT');
    expect(stateMachine.currentState).toBe('ANSWER_SELECT');
    stateMachine.changeState('STAR_COLLECT');
    expect(stateMachine.currentState).toBe('STAR_COLLECT');
    stateMachine.changeState('ROUND_RESOLVE');
    expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
    stateMachine.changeState('BOSS_CLIMAX');
    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');
    stateMachine.changeState('RESULT');
    expect(stateMachine.currentState).toBe('RESULT');
    stateMachine.changeState('MENU_MAIN');
    expect(stateMachine.currentState).toBe('MENU_MAIN');
  });
});
