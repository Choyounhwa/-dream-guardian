import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionWireHelper, type AssaultSessionWireHost } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

describe('AssaultSessionWireHelper [REFACTOR-CORE-001 / #616]', () => {
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

  describe('1. Question mapping and pair assembling', () => {
    it('assemblePair should format question candidates with choices and wrongAnswer', () => {
      const generated = {
        questionText: '5 + 3 = ?',
        choices: [8, 9] as [number, number],
        correctAnswer: 8,
        correctIndex: 0,
        shapeCode: 'CIRCLE',
      };
      const rec = {
        id: 'rec_01',
        level: 1,
        subLevel: 1,
        levelTitle: 'Level 1',
        subLevelTitle: 'Sub 1',
        questionTemplate: '{a}+{b}',
        answerEval: '5+3',
      };

      const candidate = helper.assemblePair(generated, rec);
      expect(candidate).toBeDefined();
      expect(candidate.id).toBe('rec_01');
      expect(candidate.questionText).toBe('5 + 3 = ?');
      expect(candidate.correctAnswer).toBe(8);
      expect(candidate.wrongAnswer).toBe(9);
      expect(candidate.choices).toEqual([8, 9]);
    });

    it('extractQuestionCandidates should fetch and format records from questionBank', () => {
      const candidates = helper.extractQuestionCandidates();
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].questionText).toBe('1 + 2 = ?');
      expect(candidates[0].correctAnswer).toBe(3);
    });

    it('[BUG-ASSAULT-Q-001 / #727] extractQuestionCandidates should include template questions with numeric string correctAnswer', () => {
      const stringNumberRecord = {
        id: 'q_str_num',
        level: 4,
        subLevel: 2,
        levelTitle: '소수 덧뺄셈',
        subLevelTitle: '소수 한 자리',
        questionText: '',
        questionTemplate: '{A} + {B} = ?',
        answerEval: '((A*10+B*10)/10).toFixed(1)',
        wrongEval: '((A*10+B*10+1)/10).toFixed(1)',
        varA: '1.2',
        varB: '2.3',
        varC: '0',
        varD: '0',
        shapeCode: '',
        difficulty: 'medium',
      };
      questionBank.loadRecords([stringNumberRecord as any]);
      const candidates = helper.extractQuestionCandidates(4, 2);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('q_str_num');
      expect(candidates[0].correctAnswer).toBe('3.5');
    });
  });

  describe('2. Assault session assembly and round controller creation', () => {
    it('assembleAssaultSession creates session, sets active tokens and routes mode', () => {
      const session = helper.assembleAssaultSession();
      expect(session).toBeDefined();
      expect(helper.assaultSession).toBe(session);
      expect(sessionLifecycle.activeAssaultSessionToken).toBe(session.sessionId);
      expect(host.sessionContext?.setMode).toHaveBeenCalledWith('boss_assault');
      expect(host.motionIntentBus?.setPhase).toHaveBeenCalledWith('ASSAULT_ROUND');
    });

    it('createRoundController wraps creation and rejects while finale is active', () => {
      const session = helper.assembleAssaultSession();
      const q = helper.extractQuestionCandidates()[0];
      const rc = helper.createRoundController(session, 'round_01', q);
      expect(rc).toBeDefined();
      expect((session as any).activeRoundController).toBe(rc);

      // Finale 활성화 상태 시 에러 발생
      (helper as any)._finaleController = { getSnapshot: () => ({}) } as any;
      expect(() => helper.createRoundController(session, 'round_02', q)).toThrow(
        /Cannot create round controller while finale is active/,
      );
    });
  });

  describe('3. Lifecycle, Intent and State Transition', () => {
    it('handleAssaultIntent routes victory to RESULT and pauses engine', () => {
      const session = helper.assembleAssaultSession();
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('ASSAULT_ROUND');

      const accepted = helper.handleAssaultIntent('victory', null, session.sessionId);
      expect(accepted).toBe(true);
      expect(host.engine?.pauseGame).toHaveBeenCalled();
      expect(host.beatCoordinator?.pause).toHaveBeenCalled();
      expect(stateMachine.currentState).toBe('RESULT');
    });

    it('handleAssaultIntent routes game_over to GAMEOVER and pauses engine', () => {
      const session = helper.assembleAssaultSession();
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('ASSAULT_ROUND');

      const accepted = helper.handleAssaultIntent('game_over', null, session.sessionId);
      expect(accepted).toBe(true);
      expect(host.engine?.pauseGame).toHaveBeenCalled();
      expect(host.beatCoordinator?.pause).toHaveBeenCalled();
      expect(stateMachine.currentState).toBe('GAMEOVER');
    });

    it('restartAssaultSession resets battle and boss, returns to menu and transitions to ASSAULT_ROUND', () => {
      helper.assembleAssaultSession();
      battle.applyHazardDamage(40);
      boss.takeDamage(5);

      const newSession = helper.restartAssaultSession();
      expect(host.goToMenu).toHaveBeenCalled();
      expect(battle.hp).toBe(100);
      expect(boss.hp).toBe(boss.maxHp);
      expect(newSession).toBeDefined();
      expect(helper.assaultSession).toBe(newSession);
      expect(stateMachine.currentState).toBe('ASSAULT_ROUND');
    });

    it('teardownAssaultSession cleans up session, tokens and finale controller', () => {
      const session = helper.assembleAssaultSession();
      helper.teardownAssaultSession(session);
      expect(helper.assaultSession).toBeNull();
      expect(sessionLifecycle.activeAssaultSessionToken).toBeNull();
    });
  });

  describe('4. Input fallback routing and visibility handling', () => {
    it('handleKeyDown routes keydown event to fallbackAdapter on active session', () => {
      const session = helper.assembleAssaultSession();
      const spyDown = vi.spyOn((session as any).fallbackAdapter, 'handleKeyDown');

      helper.handleKeyDown({ key: 'a', code: 'KeyA' } as KeyboardEvent);
      expect(spyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'a', code: 'KeyA' }),
      );
    });

    it('handleKeyUp routes keyup event to fallbackAdapter on active session', () => {
      const session = helper.assembleAssaultSession();
      const spyUp = vi.spyOn((session as any).fallbackAdapter, 'handleKeyUp');

      helper.handleKeyUp({ key: 'a', code: 'KeyA' } as KeyboardEvent);
      expect(spyUp).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'a', code: 'KeyA' }),
      );
    });

    it('handleVisibilityChange forwards hidden state to assault clock', () => {
      const session = helper.assembleAssaultSession();
      const clock = (session as any).clockAdapter ?? session.clock;
      const spyVis = vi.spyOn(clock, 'setHidden');

      helper.handleVisibilityChange(true);
      expect(spyVis).toHaveBeenCalledWith(true);
    });
  });
});
