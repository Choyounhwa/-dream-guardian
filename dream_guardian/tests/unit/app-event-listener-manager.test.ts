import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppEventListenerManager } from '../../src/core/bootstrap/AppEventListenerManager.js';

describe('AppEventListenerManager (Issue #632 / REFACTOR-SRP-001)', () => {
  let mockWindowListeners: Record<string, Function[]> = {};
  let mockDocumentListeners: Record<string, Function[]> = {};
  let mockCanvasListeners: Record<string, Function[]> = {};
  let mockCanvas: any;
  let mockHost: any;

  beforeEach(() => {
    mockWindowListeners = {};
    mockDocumentListeners = {};
    mockCanvasListeners = {};

    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, fn: any) => {
        mockWindowListeners[type] = mockWindowListeners[type] || [];
        mockWindowListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockWindowListeners[type]) {
          mockWindowListeners[type] = mockWindowListeners[type].filter((cb) => cb !== fn);
        }
      }),
    });

    vi.stubGlobal('document', {
      addEventListener: vi.fn((type: string, fn: any) => {
        mockDocumentListeners[type] = mockDocumentListeners[type] || [];
        mockDocumentListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockDocumentListeners[type]) {
          mockDocumentListeners[type] = mockDocumentListeners[type].filter((cb) => cb !== fn);
        }
      }),
      getElementById: vi.fn(() => null),
      fullscreenElement: null,
      exitFullscreen: vi.fn(async () => {}),
    });

    mockCanvas = {
      width: 800,
      height: 600,
      getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
      addEventListener: vi.fn((type: string, fn: any) => {
        mockCanvasListeners[type] = mockCanvasListeners[type] || [];
        mockCanvasListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockCanvasListeners[type]) {
          mockCanvasListeners[type] = mockCanvasListeners[type].filter((cb) => cb !== fn);
        }
      }),
      requestFullscreen: vi.fn(async () => {}),
    };

    mockHost = {
      canvas: mockCanvas,
      canvasManager: {
        resize: vi.fn(),
        virtualWidth: 800,
        virtualHeight: 600,
        toVirtual: vi.fn((px: number, py: number) => ({ x: px, y: py })),
      },
      bgmManager: {
        unlock: vi.fn(),
        resume: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
      },
      stageBgm: {
        resume: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
      },
      sfx: {
        play: vi.fn(),
      },
      speech: {
        enabled: true,
      },
      cameraLayer: {
        isActive: false,
        status: 'idle',
        renderVideo: false,
        stop: vi.fn(),
      },
      ensureCameraStarted: vi.fn(async () => true),
      tutorial: {
        isVisible: false,
        nextStep: vi.fn(),
      },
      pauseModal: {
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        hitTest: vi.fn(() => null),
      },
      locomotionModal: {
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        handleClick: vi.fn(() => null),
      },
      settingsModal: {
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        handleClick: vi.fn(() => null),
        cameraEnabled: false,
        soundEnabled: true,
        renderVideoEnabled: false,
      },
      bottomBar: {
        hitTestSettings: vi.fn(() => false),
        hitTestAction: vi.fn(() => false),
      },
      screenMode: 'game',
      menuMode: 'main',
      gamePhase: 'running',
      selectedChapter: 1,
      selectChapter: vi.fn(),
      selectSubLevel: vi.fn(),
      goToMenu: vi.fn(),
      menuRenderer: {
        hitTestLocomotion: vi.fn(() => false),
        hitTest: vi.fn(() => 1),
        hitTestSub: vi.fn(() => 1),
      },
      questionBank: {
        getSubLevels: vi.fn(() => [{ level: 1 }, { level: 2 }]),
      },
      poseManager: {
        setLocomotionMode: vi.fn(),
      },
      presentationAdapter: {
        isAnswerInputAllowed: vi.fn(() => true),
        resolveAnswerClick: vi.fn(() => null),
      },
      stateMachine: {
        currentState: 'ANSWER_SELECT',
      },
      answerLocked: false,
      beatCoordinator: {
        isAnswerOpen: true,
        confirmAnswerByFallback: vi.fn(),
        phase: 'ANSWER_SELECT',
        recordStep: vi.fn(),
        currentQuestion: { id: 1, prompt: '1+1', answer: 2 },
      },
      starNoteScheduler: {
        fromKeyboard: vi.fn(),
        fromTouch: vi.fn(),
      },
      engine: {
        elapsedTime: 1.5,
      },
      bossHazardController: {
        recordAction: vi.fn(),
      },
      phaseAHazardController: {
        activePattern: null,
        recordAction: vi.fn(),
      },
      readyPositionController: {
        isActive: false,
        skip: vi.fn(),
      },
      runningMatRenderer: {
        triggerMotionHit: vi.fn(),
      },
      effectManager: {
        playBurst: vi.fn(),
      },
      footKeynoteInput: {
        fromKeyboard: vi.fn(),
      },
      assaultWireHelper: {
        handleKeyDown: vi.fn(() => false),
        handleKeyUp: vi.fn(),
        handleVisibilityChange: vi.fn(),
      },
      onRunningStep: vi.fn(),
      onJumpAction: vi.fn(),
      handleVisibilityChange: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('이벤트 리스너 생명주기 (attach / detach)', () => {
    it('attachListeners() 호출 시 window, document, canvas에 리스너를 등록한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      manager.attachListeners(mockCanvas);

      expect(window.addEventListener).toHaveBeenCalledWith('resize', manager.onResize);
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', manager.onKeyDown);
      expect(document.addEventListener).toHaveBeenCalledWith('keyup', manager.onKeyUp);
      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', manager.onVisibilityChange);
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', manager.onCanvasClick);
    });

    it('detachListeners() 호출 시 등록된 모든 리스너를 해제한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      manager.attachListeners(mockCanvas);
      manager.detachListeners();

      expect(window.removeEventListener).toHaveBeenCalledWith('resize', manager.onResize);
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', manager.onKeyDown);
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', manager.onKeyUp);
      expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', manager.onVisibilityChange);
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('click', manager.onCanvasClick);
    });

    it('detachListeners()를 여러 번 호출해도 에러 없이 안전하게 동작한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      manager.attachListeners(mockCanvas);
      expect(() => {
        manager.detachListeners();
        manager.detachListeners();
      }).not.toThrow();
    });
  });

  describe('리사이즈 및 가시성 변경 핸들러', () => {
    it('handleResize() 호출 시 canvasManager.resize()를 호출한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      manager.handleResize();
      expect(mockHost.canvasManager.resize).toHaveBeenCalled();
    });

    it('handleVisibilityChange() 호출 시 host의 handleVisibilityChange를 위임 호출한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      manager.handleVisibilityChange();
      expect(mockHost.handleVisibilityChange).toHaveBeenCalled();
    });
  });

  describe('키보드 이벤트 (handleKeyDown / handleKeyUp)', () => {
    it('게임 중 정답 입력 가능 상태에서 1 또는 2 키 입력 시 confirmAnswerByFallback을 호출한다', () => {
      const manager = new AppEventListenerManager(mockHost);

      manager.handleKeyDown({ key: '1' } as KeyboardEvent);
      expect(mockHost.sfx.play).toHaveBeenCalledWith('hover');
      expect(mockHost.beatCoordinator.confirmAnswerByFallback).toHaveBeenCalledWith(0);

      manager.handleKeyDown({ key: '2' } as KeyboardEvent);
      expect(mockHost.beatCoordinator.confirmAnswerByFallback).toHaveBeenCalledWith(1);
    });

    it('일시정지 모달이 열려있거나 정답 입력 불가 상태이면 1, 2 키가 무시된다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.pauseModal.isOpen = true;

      manager.handleKeyDown({ key: '1' } as KeyboardEvent);
      expect(mockHost.beatCoordinator.confirmAnswerByFallback).not.toHaveBeenCalled();

      mockHost.pauseModal.isOpen = false;
      mockHost.presentationAdapter.isAnswerInputAllowed.mockReturnValue(false);

      manager.handleKeyDown({ key: '2' } as KeyboardEvent);
      expect(mockHost.beatCoordinator.confirmAnswerByFallback).not.toHaveBeenCalled();
    });

    it('Escape 키 입력 시 모달이 닫히거나 게임 중이면 일시정지 모달을 연다', () => {
      const manager = new AppEventListenerManager(mockHost);

      // 게임 플레이 중 Escape -> 일시정지 모달 열기
      manager.handleKeyDown({ key: 'Escape' } as KeyboardEvent);
      expect(mockHost.pauseModal.open).toHaveBeenCalled();
      expect(mockHost.stageBgm.pause).toHaveBeenCalled();

      // 일시정지 모달이 이미 열려있을 때 Escape -> 모달 닫고 재개
      mockHost.pauseModal.isOpen = true;
      manager.handleKeyDown({ key: 'Escape' } as KeyboardEvent);
      expect(mockHost.pauseModal.close).toHaveBeenCalled();
      expect(mockHost.stageBgm.resume).toHaveBeenCalled();
    });

    it('READY_POSITION 상태에서 Space 입력 시 카운트다운을 즉시 스킵한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.stateMachine.currentState = 'READY_POSITION';
      mockHost.readyPositionController.isActive = true;

      manager.handleKeyDown({ code: 'Space' } as KeyboardEvent);
      expect(mockHost.readyPositionController.skip).toHaveBeenCalled();
    });

    it('running 상태에서 Space 입력 시 달리기 스텝 및 효과를 트리거한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.stateMachine.currentState = 'RUNNING';
      mockHost.screenMode = 'game';
      mockHost.gamePhase = 'running';

      manager.handleKeyDown({ code: 'Space' } as KeyboardEvent);
      expect(mockHost.beatCoordinator.recordStep).toHaveBeenCalled();
      expect(mockHost.runningMatRenderer.triggerMotionHit).toHaveBeenCalled();
      expect(mockHost.effectManager.playBurst).toHaveBeenCalled();
      expect(mockHost.onRunningStep).toHaveBeenCalled();
    });

    it('메인 메뉴 모드에서 1~5 키 입력 시 챕터를 선택한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.screenMode = 'menu';
      mockHost.menuMode = 'main';

      manager.handleKeyDown({ key: '3' } as KeyboardEvent);
      expect(mockHost.selectChapter).toHaveBeenCalledWith(3);
    });

    it('서브 메뉴 모드에서 Backspace 또는 Escape 입력 시 상위 메뉴(-1)로 복귀한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.screenMode = 'menu';
      mockHost.menuMode = 'sub';

      manager.handleKeyDown({ key: 'Backspace' } as KeyboardEvent);
      expect(mockHost.selectSubLevel).toHaveBeenCalledWith(-1);
    });

    it('결과 화면에서 Enter 또는 Escape 입력 시 메뉴로 이동한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.screenMode = 'result';

      manager.handleKeyDown({ key: 'Enter' } as KeyboardEvent);
      expect(mockHost.goToMenu).toHaveBeenCalled();
    });

    it('keyup 이벤트 발생 시 assaultWireHelper에 위임한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      const ev = { key: 'a' } as KeyboardEvent;
      manager.handleKeyUp(ev);
      expect(mockHost.assaultWireHelper.handleKeyUp).toHaveBeenCalledWith(ev);
    });
  });

  describe('마우스 및 터치 클릭 이벤트 (handleCanvasClick)', () => {
    it('클릭 시 bgmManager.unlock()을 호출하고 카메라가 비활성 상태면 시작을 요청한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      manager.handleCanvasClick({ clientX: 100, clientY: 100 } as MouseEvent);

      expect(mockHost.bgmManager.unlock).toHaveBeenCalled();
      expect(mockHost.ensureCameraStarted).toHaveBeenCalled();
    });

    it('튜토리얼 활성화 중 클릭 시 다음 단계로 진행한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.tutorial.isVisible = true;

      manager.handleCanvasClick({ clientX: 100, clientY: 100 } as MouseEvent);
      expect(mockHost.tutorial.nextStep).toHaveBeenCalled();
      expect(mockHost.pauseModal.hitTest).not.toHaveBeenCalled();
    });

    it('게임 중 정답 버튼 클릭 시 confirmAnswerByFallback을 호출한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.screenMode = 'game';
      mockHost.gamePhase = 'question';
      mockHost.currentQuestion = { id: 1, prompt: '1+1', answer: 2 };
      mockHost.presentationAdapter.resolveAnswerClick.mockReturnValue(1);

      manager.handleCanvasClick({ clientX: 300, clientY: 400 } as MouseEvent);
      expect(mockHost.beatCoordinator.confirmAnswerByFallback).toHaveBeenCalledWith(1);
    });

    it('결과 화면에서 클릭 시 goToMenu()를 호출한다', () => {
      const manager = new AppEventListenerManager(mockHost);
      mockHost.screenMode = 'result';

      manager.handleCanvasClick({ clientX: 100, clientY: 100 } as MouseEvent);
      expect(mockHost.goToMenu).toHaveBeenCalled();
    });
  });
});
