/**
 * assault-loop-input-extraction.test.ts - ASSAULT-LOOP-08 (#701)
 *
 * 배선 헬퍼(AssaultSessionWireHelper)의 입력 라우팅(AssaultInputRouter) 제한 추출 및 동작 동등성 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultInputRouter,
  type AssaultInputRouterDependencies,
  type AssaultInputClock,
  type AssaultInputRoundTarget,
  type AssaultInputFinaleTarget,
  type AssaultInputAdapters,
} from '../../src/core/bootstrap/AssaultInputRouter.js';
import {
  AssaultSessionWireHelper,
  type AssaultSessionWireHost,
} from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

describe('AssaultInputRouter Unit & Extraction Tests [ASSAULT-LOOP-08 / #701]', () => {
  describe('1. AssaultInputRouter Standalone Core Routing', () => {
    let mockClock: AssaultInputClock;
    let mockRound: AssaultInputRoundTarget;
    let mockFinale: AssaultInputFinaleTarget;
    let mockAdapters: AssaultInputAdapters;
    let onPunchImpact: ReturnType<typeof vi.fn>;
    let isDisposed: boolean;
    let deps: AssaultInputRouterDependencies;
    let router: AssaultInputRouter;

    beforeEach(() => {
      isDisposed = false;
      onPunchImpact = vi.fn();

      mockClock = {
        activeSeconds: 3.5,
        isFrozen: false,
        isFallbackMode: false,
        needsMotionReprep: false,
        primaryPauseReason: null,
        toRoundRelativeSeconds: vi.fn((sec?: number) => (sec !== undefined ? sec : 3.5)),
        setTrackingLost: vi.fn(),
        normalizeInput: vi.fn((raw) => ({
          accepted: true,
          activeTimestampSeconds: 3.5,
          inputId: raw.inputId,
        })),
      };

      mockRound = {
        roundId: 'round_01',
        isCompleted: false,
        isPaused: false,
        pause: vi.fn(),
        resume: vi.fn(),
        submitPunch: vi.fn(),
        submitSquat: vi.fn(),
      };

      mockFinale = {
        handlePunch: vi.fn(),
        handleSquat: vi.fn(),
        handleJump: vi.fn(),
      };

      mockAdapters = {
        punchAdapter: {
          update: vi.fn(),
        },
        squatAdapter: {
          update: vi.fn(),
        },
        guardAdapter: {
          update: vi.fn(),
        },
        jumpAdapter: {
          update: vi.fn(),
        },
        fallbackAdapter: {
          handleKeyDown: vi.fn(),
          handleTouchStart: vi.fn(),
          handleTouchEnd: vi.fn(),
          handleKeyUp: vi.fn(),
        },
      };

      deps = {
        getClock: () => mockClock,
        getActiveRound: () => mockRound,
        getFinaleController: () => null,
        getAdapters: () => mockAdapters,
        onPunchImpact,
        isDisposed: () => isDisposed,
        getSessionId: () => 'test_session_id',
      };

      router = new AssaultInputRouter(deps);
    });

    it('인스턴스 생성 및 의존성 주입이 정상 동작해야 한다', () => {
      expect(router).toBeInstanceOf(AssaultInputRouter);
      expect(router.dependencies).toBe(deps);
    });

    it('isDisposed=true 시 handlePose는 아무 동작도 수행하지 않아야 한다', () => {
      isDisposed = true;
      router.handlePose([], [{ x: 0.5, y: 0.5, visibility: 0.9 }], 16);
      expect(mockClock.setTrackingLost).not.toHaveBeenCalled();
      expect(mockAdapters.punchAdapter?.update).not.toHaveBeenCalled();
    });

    it('랜드마크 추적 상실(손목 visibility < 0.5) 시 clock.setTrackingLost(true)를 호출하고 모션 처리를 차단해야 한다', () => {
      const lostLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
      router.handlePose([], lostLandmarks, 16);

      expect(mockClock.setTrackingLost).toHaveBeenCalledWith(true);
      expect(mockAdapters.punchAdapter?.update).not.toHaveBeenCalled();
    });

    it('clock이 동결(isFrozen=true)되면 activeRound를 일시정지하고 모션 입력을 차단해야 한다', () => {
      (mockClock as any).isFrozen = true;
      (mockClock as any).primaryPauseReason = 'tracking_lost';

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      router.handlePose([], validLandmarks, 16);

      expect(mockRound.pause).toHaveBeenCalledWith('tracking_lost');
      expect(mockAdapters.punchAdapter?.update).not.toHaveBeenCalled();
    });

    it('펀치 이벤트 발생 시 activeRound.submitPunch와 onPunchImpact 콜백을 정확히 호출해야 한다', () => {
      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (mockAdapters.punchAdapter!.update as any).mockReturnValue([
        {
          hand: 'left',
          rawTimestampMs: 3500,
          compensatedTimestampMs: 3500,
          inputId: 'punch_1',
        },
      ]);

      router.handlePose([], validLandmarks, 16);

      expect(mockRound.submitPunch).toHaveBeenCalledWith('left', 3500, {
        activeSeconds: 3.5,
        inputId: 'punch_1',
      });
      expect(onPunchImpact).toHaveBeenCalledWith(mockRound, 'left');
    });

    it('결전(finale) 활성 상태에서는 activeRound 대신 finale.handlePunch로 라우팅되어야 한다', () => {
      deps = {
        ...deps,
        getFinaleController: () => mockFinale,
      };
      router = new AssaultInputRouter(deps);

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (mockAdapters.punchAdapter!.update as any).mockReturnValue([
        { hand: 'right', rawTimestampMs: 3500, inputId: 'punch_r' },
      ]);

      router.handlePose([], validLandmarks, 16);

      expect(mockFinale.handlePunch).toHaveBeenCalledWith(
        expect.objectContaining({ hand: 'right', activeSeconds: 3.5 }),
      );
      expect(mockRound.submitPunch).not.toHaveBeenCalled();
    });

    it('결전 중 스쿼트/가드 동작 시 finale.handleSquat로 라우팅되어야 한다', () => {
      deps = {
        ...deps,
        getFinaleController: () => mockFinale,
      };
      router = new AssaultInputRouter(deps);

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (mockAdapters.squatAdapter!.update as any).mockReturnValue({
        isDucking: true,
        posture: 'ducking',
      });

      router.handlePose([], validLandmarks, 16);

      expect(mockFinale.handleSquat).toHaveBeenCalledWith(
        expect.objectContaining({ isDucking: true, posture: 'ducking', activeSeconds: 3.5 }),
      );
    });

    it('결전 중 점프/저충격 점프 시 finale.handleJump로 라우팅되어야 한다', () => {
      deps = {
        ...deps,
        getFinaleController: () => mockFinale,
      };
      router = new AssaultInputRouter(deps);

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (mockAdapters.jumpAdapter!.update as any).mockReturnValue({
        isJumping: false,
        isLowImpact: true,
        motionKind: 'low_impact',
        posture: 'transition',
      });

      router.handlePose([], validLandmarks, 16);

      expect(mockFinale.handleJump).toHaveBeenCalledWith(
        expect.objectContaining({ isJumping: false, isLowImpact: true, motionKind: 'low_impact' }),
      );
    });

    it('dispatchFallbackEvent는 라운드 활성 시 submitPunch/submitSquat로 디스패치해야 한다', () => {
      // 좌측 펀치
      router.dispatchFallbackEvent({ action: 'left_punch', timestampMs: 3500 }, 'keyboard');
      expect(mockRound.submitPunch).toHaveBeenCalledWith('left', 3500, {
        activeSeconds: 3.5,
        inputId: undefined,
      });
      expect(onPunchImpact).toHaveBeenCalledWith(mockRound, 'left');

      // 스쿼트
      router.dispatchFallbackEvent({ action: 'squat', timestampMs: 3500 }, 'keyboard');
      expect(mockRound.submitSquat).toHaveBeenCalledWith('ducking', 3500, {
        activeSeconds: 3.5,
        inputId: undefined,
      });
    });

    it('dispatchFallbackEvent는 결전 활성 시 finale 핸들러로 디스패치해야 한다', () => {
      deps = {
        ...deps,
        getFinaleController: () => mockFinale,
      };
      router = new AssaultInputRouter(deps);

      router.dispatchFallbackEvent({ action: 'left_punch', timestampMs: 3500 }, 'keyboard');
      expect(mockFinale.handlePunch).toHaveBeenCalledWith({ hand: 'left', timestampMs: 3500, activeSeconds: 3.5 });

      router.dispatchFallbackEvent({ action: 'jump', timestampMs: 3500 }, 'keyboard');
      expect(mockFinale.handleJump).toHaveBeenCalledWith({ isJumping: true, isLowImpact: false, posture: 'jumping', timestampMs: 3500, activeSeconds: 3.5 });
    });

    it('handleKeyDown, handleClick, handleKeyUp가 fallbackAdapter를 경유하여 디스패치해야 한다', () => {
      (mockAdapters.fallbackAdapter!.handleKeyDown as any).mockReturnValue({
        action: 'left_punch',
        timestampMs: 3500,
      });
      const handledKey = router.handleKeyDown({ key: '1', code: 'Digit1', repeat: false } as KeyboardEvent);
      expect(handledKey).toBe(true);
      expect(mockRound.submitPunch).toHaveBeenCalledWith('left', 3500, expect.any(Object));

      (mockAdapters.fallbackAdapter!.handleTouchStart as any).mockReturnValue({
        action: 'right_punch',
        timestampMs: 3500,
      });
      const handledClick = router.handleClick(0.75, 0.5);
      expect(handledClick).toBe(true);
      expect(mockRound.submitPunch).toHaveBeenCalledWith('right', 3500, expect.any(Object));

      const handledUp = router.handleKeyUp({ key: '1', code: 'Digit1', repeat: false } as KeyboardEvent);
      expect(handledUp).toBe(true);
      expect(mockAdapters.fallbackAdapter!.handleKeyUp).toHaveBeenCalled();
    });
  });

  describe('2. AssaultSessionWireHelper Delegation & Equivalence', () => {
    let eventBus: EventBus;
    let battle: BattleState;
    let boss: BossController;
    let stateMachine: StateMachine;
    let sessionLifecycle: SessionLifecycle;
    let questionBank: QuestionBank;
    let host: AssaultSessionWireHost;
    let helper: AssaultSessionWireHelper;

    beforeEach(() => {
      eventBus = new EventBus();
      battle = new BattleState(100);
      boss = new BossController(1);
      stateMachine = new StateMachine('MENU_MAIN');
      sessionLifecycle = new SessionLifecycle();
      questionBank = new QuestionBank();

      questionBank.loadRecords([
        {
          id: 'q1',
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈',
          subLevelTitle: '기초',
          questionText: '1 + 2 = ?',
          choices: [3, 4],
          correctAnswer: 3,
          correctIndex: 0,
          answerEval: '1+2=3',
          difficulty: 'easy',
          questionTemplate: '',
          wrongEval: '',
          varA: '',
          varB: '',
          varC: '',
          varD: '',
          shapeCode: '',
        } as any,
      ]);

      host = {
        eventBus,
        battle,
        boss,
        bossController: boss,
        stateMachine,
        sessionLifecycle,
        questionBank,
        speech: { speak: vi.fn(), cancel: vi.fn() } as any,
        sessionContext: {
          setMode: vi.fn(),
          setActive: vi.fn(),
        } as any,
        motionIntentBus: {
          setPhase: vi.fn(),
        } as any,
        beatCoordinator: {
          pause: vi.fn(),
        } as any,
        engine: {
          pauseGame: vi.fn(),
        } as any,
        mainSceneContext: {
          state: {
            screenMode: 'game',
            isPaused: false,
          },
        } as any,
        goToMenu: vi.fn(),
        enableAssaultFinale: false,
        currentChapter: 1,
        selectedSubLevel: 1,
      };

      helper = new AssaultSessionWireHelper(host);
    });

    it('WireHelper가 inputRouter 인스턴스를 노출하고 동일 참조를 유지해야 한다', () => {
      expect(helper.inputRouter).toBeDefined();
      expect(helper.inputRouter).toBeInstanceOf(AssaultInputRouter);
    });

    it('assembleAssaultSession 후 session.handlePose 호출 시 inputRouter.handlePose로 위임되어야 한다', () => {
      const session = helper.assembleAssaultSession();
      const candidate = helper.extractQuestionCandidates()[0];
      const round = helper.createRoundController(session, 'round_delegation_01', candidate);

      const routerPoseSpy = vi.spyOn(helper.inputRouter, 'handlePose');
      const submitPunchSpy = vi.spyOn(round, 'submitPunch');

      const rawSession = (session as any).__rawSession ?? session;
      if (rawSession.punchAdapter) {
        vi.spyOn(rawSession.punchAdapter, 'update').mockReturnValue([
          {
            hand: 'left',
            rawTimestampMs: 2000,
            compensatedTimestampMs: 2000,
            inputId: 'punch_del_1',
          },
        ]);
      }

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (session as any).handlePose([], validLandmarks, 16);

      expect(routerPoseSpy).toHaveBeenCalledTimes(1);
      expect(submitPunchSpy).toHaveBeenCalledWith('left', expect.any(Number), expect.objectContaining({
        inputId: 'punch_del_1',
      }));
    });

    it('helper.handleKeyDown 및 handleClick 호출 시 inputRouter를 통해 디스패치되어야 한다', () => {
      const session = helper.assembleAssaultSession();
      const candidate = helper.extractQuestionCandidates()[0];
      const round = helper.createRoundController(session, 'round_delegation_02', candidate);

      const submitPunchSpy = vi.spyOn(round, 'submitPunch');

      helper.handleKeyDown({ key: '1', code: 'Digit1', repeat: false } as KeyboardEvent);
      expect(submitPunchSpy).toHaveBeenCalledWith('left', expect.any(Number), expect.any(Object));

      helper.handleClick(0.75, 0.5);
      expect(submitPunchSpy).toHaveBeenCalledWith('right', expect.any(Number), expect.any(Object));
    });
  });
});
