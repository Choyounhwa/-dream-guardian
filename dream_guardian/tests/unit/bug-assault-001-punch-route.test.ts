import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionWireHelper, type AssaultSessionWireHost } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

describe('[BUG-ASSAULT-001] 접근전 카메라 펀치 경로 라우팅 검증 (#669)', () => {
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

    const mockQuestionRecord = {
      id: 'q1',
      level: 1,
      subLevel: 1,
      levelTitle: '덧셈 기초',
      subLevelTitle: '한 자리 덧셈',
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
    };
    questionBank.loadRecords([mockQuestionRecord as any]);

    host = {
      eventBus,
      battle,
      boss,
      get bossController() { return boss; },
      speech: {
        speak: vi.fn(),
        cancel: vi.fn(),
      } as any,
      stateMachine,
      sessionLifecycle,
      questionBank,
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

  it('카메라 펀치 이벤트 발생 시 activeRound.submitPunch를 정확히 호출하고 inputId와 activeSeconds를 보존해야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_01', candidate);

    const submitPunchSpy = vi.spyOn(round, 'submitPunch');

    const rawSession = (session as any).__rawSession ?? session;
    const mockPunchEvent = {
      inputId: 'punch_custom_123',
      hand: 'left' as const,
      targetSide: 'left' as const,
      rawTimestampMs: 1000,
      compensatedTimestampMs: 1000,
      reachRatio: 1.0,
    };

    if (rawSession.punchAdapter) {
      vi.spyOn(rawSession.punchAdapter, 'update').mockReturnValue([mockPunchEvent]);
    }
    if (rawSession.clock) {
      vi.spyOn(rawSession.clock, 'activeSeconds', 'get').mockReturnValue(5.25);
    }

    const dummyLandmarks = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];

    // handlePose 호출 (카메라 랜드마크 입력 경로)
    expect(() => {
      (session as any).handlePose([], dummyLandmarks, 16);
    }).not.toThrow();

    expect(submitPunchSpy).toHaveBeenCalledTimes(1);
    expect(submitPunchSpy).toHaveBeenCalledWith(
      'left',
      expect.any(Number),
      {
        activeSeconds: 5.25,
        inputId: 'punch_custom_123',
      },
    );
  });

  it('오른손 펀치 이벤트 발생 시 submitPunch에 right 핸드와 올바른 메타데이터가 전달되어야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_02', candidate);

    const submitPunchSpy = vi.spyOn(round, 'submitPunch');
    const rawSession = (session as any).__rawSession ?? session;
    const mockPunchEvent = {
      inputId: 'punch_right_456',
      hand: 'right' as const,
      targetSide: 'right' as const,
      rawTimestampMs: 2000,
      compensatedTimestampMs: 2000,
      reachRatio: 0.95,
    };

    if (rawSession.punchAdapter) {
      vi.spyOn(rawSession.punchAdapter, 'update').mockReturnValue([mockPunchEvent]);
    }
    if (rawSession.clock) {
      vi.spyOn(rawSession.clock, 'activeSeconds', 'get').mockReturnValue(8.0);
    }

    const dummyLandmarks = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];
    (session as any).handlePose([], dummyLandmarks, 16);

    expect(submitPunchSpy).toHaveBeenCalledTimes(1);
    expect(submitPunchSpy).toHaveBeenCalledWith(
      'right',
      expect.any(Number),
      {
        activeSeconds: 8.0,
        inputId: 'punch_right_456',
      },
    );
  });

  it('라운드가 완료(isCompleted = true)된 상태에서는 submitPunch가 호출되지 않아야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_03', candidate);

    vi.spyOn(round, 'isCompleted', 'get').mockReturnValue(true);
    const submitPunchSpy = vi.spyOn(round, 'submitPunch');

    const rawSession = (session as any).__rawSession ?? session;
    const mockPunchEvent = {
      inputId: 'punch_test_789',
      hand: 'left' as const,
      targetSide: 'left' as const,
      rawTimestampMs: 3000,
      compensatedTimestampMs: 3000,
      reachRatio: 1.0,
    };

    if (rawSession.punchAdapter) {
      vi.spyOn(rawSession.punchAdapter, 'update').mockReturnValue([mockPunchEvent]);
    }

    const dummyLandmarks = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];
    (session as any).handlePose([], dummyLandmarks, 16);

    expect(submitPunchSpy).not.toHaveBeenCalled();
  });

  it('결전(finale) 활성 상태에서는 activeRound.submitPunch 대신 finale.handlePunch로 라우팅되어야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_04', candidate);

    const submitPunchSpy = vi.spyOn(round, 'submitPunch');
    const mockFinale = {
      handlePunch: vi.fn(),
    };
    (helper as any)._finaleController = mockFinale;
    const rawSession = (session as any).__rawSession ?? session;

    const mockPunchEvent = {
      inputId: 'punch_test_finale',
      hand: 'left' as const,
      targetSide: 'left' as const,
      rawTimestampMs: 4000,
      compensatedTimestampMs: 4000,
      reachRatio: 1.0,
    };

    if (rawSession.punchAdapter) {
      vi.spyOn(rawSession.punchAdapter, 'update').mockReturnValue([mockPunchEvent]);
    }
    if (rawSession.clock) {
      vi.spyOn(rawSession.clock, 'activeSeconds', 'get').mockReturnValue(12.0);
    }

    const dummyLandmarks = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];
    (session as any).handlePose([], dummyLandmarks, 16);

    expect(mockFinale.handlePunch).toHaveBeenCalledTimes(1);
    expect(mockFinale.handlePunch).toHaveBeenCalledWith({
      hand: 'left',
      timestampMs: expect.any(Number),
      activeSeconds: 12.0,
    });
    expect(submitPunchSpy).not.toHaveBeenCalled();
  });
});
