/**
 * bug-assault-008-punch-time.test.ts - 보스 접근전 타임스탬프 기준계 및 숫자키/클릭 연동 검증
 *
 * @see Issue #679 [BUG-ASSAULT-008]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionWireHelper, type AssaultSessionWireHost } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

describe('[BUG-ASSAULT-008 / Issue #679] 접근전 타임스탬프 기준계 및 1/2번 키·클릭 연동', () => {
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

  it('handleKeyboard로 숫자 키 "1" 입력 시 performance.now() 대신 라운드 상대 밀리초를 submitPunch에 전달해야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_01', candidate);

    const submitPunchSpy = vi.spyOn(round, 'submitPunch');

    const rawSession = (session as any).__rawSession ?? session;
    if (rawSession.clock) {
      vi.spyOn(rawSession.clock, 'activeSeconds', 'get').mockReturnValue(4.5);
      if (rawSession.clock.toRoundRelativeSeconds) {
        vi.spyOn(rawSession.clock, 'toRoundRelativeSeconds').mockReturnValue(4.5);
      }
    }

    // performance.now()가 100,000ms여도 submitPunch에는 4500ms(4.5s * 1000)가 전달되어야 함
    (session as any).handleKeyboard({
      key: '1',
      code: 'Digit1',
      repeat: false,
    });

    expect(submitPunchSpy).toHaveBeenCalledTimes(1);
    expect(submitPunchSpy).toHaveBeenCalledWith(
      'left',
      4500, // roundRelativeMs (4.5 * 1000), NOT performance.now()
      expect.objectContaining({
        activeSeconds: 4.5,
      }),
    );
  });

  it('handleClick(normX < 0.5) 호출 시 좌측 펀치가 라운드 상대 밀리초로 submitPunch에 전달되어야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_01', candidate);

    const submitPunchSpy = vi.spyOn(round, 'submitPunch');

    const rawSession = (session as any).__rawSession ?? session;
    if (rawSession.clock) {
      vi.spyOn(rawSession.clock, 'activeSeconds', 'get').mockReturnValue(4.8);
      if (rawSession.clock.toRoundRelativeSeconds) {
        vi.spyOn(rawSession.clock, 'toRoundRelativeSeconds').mockReturnValue(4.8);
      }
    }

    // 좌측 클릭 (normX = 0.25)
    const handled = helper.handleClick(0.25, 0.4);
    expect(handled).toBe(true);

    expect(submitPunchSpy).toHaveBeenCalledTimes(1);
    expect(submitPunchSpy).toHaveBeenCalledWith(
      'left',
      4800, // 4.8 * 1000
      expect.objectContaining({
        activeSeconds: 4.8,
      }),
    );
  });

  it('handleClick(normX >= 0.5) 호출 시 우측 펀치가 라운드 상대 밀리초로 submitPunch에 전달되어야 한다', () => {
    const session = helper.assembleAssaultSession();
    const candidate = helper.extractQuestionCandidates()[0];
    const round = helper.createRoundController(session, 'round_test_01', candidate);

    const submitPunchSpy = vi.spyOn(round, 'submitPunch');

    const rawSession = (session as any).__rawSession ?? session;
    if (rawSession.clock) {
      vi.spyOn(rawSession.clock, 'activeSeconds', 'get').mockReturnValue(5.0);
      if (rawSession.clock.toRoundRelativeSeconds) {
        vi.spyOn(rawSession.clock, 'toRoundRelativeSeconds').mockReturnValue(5.0);
      }
    }

    // 우측 클릭 (normX = 0.75)
    const handled = helper.handleClick(0.75, 0.4);
    expect(handled).toBe(true);

    expect(submitPunchSpy).toHaveBeenCalledTimes(1);
    expect(submitPunchSpy).toHaveBeenCalledWith(
      'right',
      5000, // 5.0 * 1000
      expect.objectContaining({
        activeSeconds: 5.0,
      }),
    );
  });
});
