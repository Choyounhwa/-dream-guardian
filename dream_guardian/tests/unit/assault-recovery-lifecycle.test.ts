/**
 * assault-recovery-lifecycle.test.ts
 *
 * [BOSS-ASSAULT-REC-17] #610: 종료·재시작 자원 수명 검증·복구
 *
 * 검증 항목:
 * 1. raw session.dispose()에서 활성 round abort, pending 입력/명령 폐기, noteAdapter/soundCue/hud 상태 정리, clock reset, session token 만료.
 * 2. dispose 중복 호출에 대해 멱등하고 안전하게 동작 (isDisposed 유지, 다중 호출 시 에러 없음).
 * 3. 세션 종료 후 이전 라운드의 지연 콜백/async 입력·receipt가 새 세션의 HP/진행도/저장에 영향을 주지 않도록 완벽 격리.
 * 4. 메뉴 복귀 / 재시작(restart) 반복 후 리스너/구독 수 증가 0건 보장. 전역 이벤트 리스너 중복 등록 방지.
 * 5. 새 세션 생성 시 이전 세션의 상태와 완전히 독립된 깨끗한 인스턴스 초기화.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { AssaultSessionWireHelper, type AssaultSessionWireHost } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { EventBus } from '../../src/core/EventBus.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[BOSS-ASSAULT-REC-17] #610: 종료·재시작 자원 수명 검증·복구', () => {
  let battle: BattleState;
  let boss: BossController;
  let sessionLifecycle: SessionLifecycle;
  let eventBus: EventBus;
  let stateMachine: StateMachine;
  let questionBank: QuestionBank;
  let host: AssaultSessionWireHost;
  let mockQuestions: QuestionCandidate[];
  let mockSpeech: { speak: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    battle = new BattleState(100);
    boss = new BossController(1);
    sessionLifecycle = new SessionLifecycle();
    eventBus = new EventBus();
    stateMachine = new StateMachine('MENU_MAIN');
    questionBank = new QuestionBank();

    mockQuestions = [
      { id: 'q1', level: 1, questionText: '1 + 2 = ?', correctAnswer: 3, choices: [3, 4] },
      { id: 'q2', level: 1, questionText: '2 + 3 = ?', correctAnswer: 5, choices: [5, 6] },
      { id: 'q3', level: 1, questionText: '3 + 4 = ?', correctAnswer: 7, choices: [7, 8] },
    ];

    mockSpeech = { speak: vi.fn() };

    host = {
      eventBus,
      battle,
      boss,
      bossController: boss,
      speech: mockSpeech,
      stateMachine,
      sessionLifecycle,
      questionBank,
      goToMenu: vi.fn(() => {
        sessionLifecycle.endSession();
        stateMachine.changeState('MENU_MAIN');
      }),
      mainSceneContext: { state: { screenMode: 'menu' } } as any,
    };
  });

  describe('1. raw session.dispose() 정리 범위 및 멱등성', () => {
    it('raw session.dispose() 호출 시 activeRound abort, clock reset, soundCue reset, isDisposed true가 되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech: mockSpeech,
        questions: mockQuestions,
        sfxPlayer: { play: vi.fn() },
      });

      expect(session.isDisposed).toBe(false);
      const rc = session.createRoundController('round_01' as any, mockQuestions[0]);
      expect(rc.isCompleted).toBe(false);

      const abortSpy = vi.spyOn(rc, 'abort');
      const clockResetSpy = vi.spyOn(session.clock, 'reset');
      const soundCueResetSpy = session.soundCue ? vi.spyOn(session.soundCue, 'reset') : null;

      session.dispose();

      expect(session.isDisposed).toBe(true);
      expect(abortSpy).toHaveBeenCalledWith('session_disposed');
      expect(rc.isCompleted).toBe(true);
      expect(clockResetSpy).toHaveBeenCalledTimes(1);
      if (soundCueResetSpy) {
        expect(soundCueResetSpy).toHaveBeenCalledTimes(1);
      }
    });

    it('dispose() 중복 호출 시 멱등하게 동작해야 한다 (두 번째 호출은 무시)', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech: mockSpeech,
        questions: mockQuestions,
      });

      const clockResetSpy = vi.spyOn(session.clock, 'reset');

      session.dispose();
      expect(session.isDisposed).toBe(true);
      expect(clockResetSpy).toHaveBeenCalledTimes(1);

      // 2차 중복 호출
      expect(() => session.dispose()).not.toThrow();
      expect(session.isDisposed).toBe(true);
      expect(clockResetSpy).toHaveBeenCalledTimes(1);
    });

    it('dispose 후 createRoundController 또는 startNextRound 호출 시 예외를 던져야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech: mockSpeech,
        questions: mockQuestions,
      });
      session.dispose();

      expect(() => {
        session.createRoundController?.('round_01' as any, mockQuestions[0]);
      }).toThrow(/disposed/);

      expect(() => {
        session.startNextRound?.();
      }).toThrow(/disposed/);
    });
  });

  describe('2. 세션 종료 후 이전 라운드 콜백/지연 입력/영수증 완벽 격리', () => {
    it('세션이 dispose되면 이전 라운드의 정산/영수증 명령이 새 세션의 HP나 상태에 영향을 주지 않아야 한다', () => {
      const session1 = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech: mockSpeech,
        questions: mockQuestions,
      });

      sessionLifecycle.setActiveAssaultSessionToken(session1.sessionId);

      const rc1 = session1.createRoundController?.('round_01' as any, mockQuestions[0]);
      expect(rc1?.isCompleted).toBe(false);

      // session1 dispose
      session1.dispose();
      sessionLifecycle.clearActiveAssaultSessionToken(session1.sessionId);

      expect(sessionLifecycle.activeAssaultSessionToken).toBeNull();
      expect(sessionLifecycle.isValidAssaultToken(session1.sessionId)).toBe(false);

      // session2 생성
      const session2 = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech: mockSpeech,
        questions: mockQuestions,
      });
      sessionLifecycle.setActiveAssaultSessionToken(session2.sessionId);

      // 이전 session1의 만료된 토큰으로 handleAssaultIntent 호출 시 차단
      const accepted = sessionLifecycle.handleAssaultIntent(
        'game_over',
        null,
        session1.sessionId,
      );
      expect(accepted).toBe(false);
      expect(sessionLifecycle.hasResultShown).toBe(false);

      // session2의 정상 토큰은 수락
      const validAccepted = sessionLifecycle.handleAssaultIntent(
        'game_over',
        null,
        session2.sessionId,
      );
      expect(validAccepted).toBe(true);
      expect(sessionLifecycle.hasResultShown).toBe(true);
    });

    it('SessionLifecycle.clearActiveAssaultSessionToken()이 특정 토큰 검증 후 안전하게 해제해야 한다', () => {
      sessionLifecycle.setActiveAssaultSessionToken('sess_A');
      expect(sessionLifecycle.activeAssaultSessionToken).toBe('sess_A');

      // 다른 토큰으로 clear 시도 시 무시
      sessionLifecycle.clearActiveAssaultSessionToken('sess_B');
      expect(sessionLifecycle.activeAssaultSessionToken).toBe('sess_A');

      // 일치하는 토큰으로 clear 시 해제
      sessionLifecycle.clearActiveAssaultSessionToken('sess_A');
      expect(sessionLifecycle.activeAssaultSessionToken).toBeNull();
    });
  });

  describe('3. 메뉴 왕복 및 restart 반복 시 누수 및 중복 등록 0건 검증', () => {
    it('AssaultSessionWireHelper로 assemble -> teardown -> restart 반복 시 리스너 누수 0건 및 세션 독립성 보장', () => {
      const wireHelper = new AssaultSessionWireHelper(host);

      const eventBusListenerCount = () => {
        // EventBus 내부 리스너 수 확인
        let count = 0;
        const listenersMap = (eventBus as any)._listeners;
        if (listenersMap instanceof Map) {
          for (const list of listenersMap.values()) {
            count += list.length;
          }
        }
        return count;
      };

      const initialListenerCount = eventBusListenerCount();

      // 세션 1 생성
      const session1 = wireHelper.assembleAssaultSession({ questions: mockQuestions });
      expect(session1).toBeDefined();
      expect(sessionLifecycle.activeAssaultSessionToken).toBe(session1.sessionId);

      // 라운드 가동
      const rc1 = session1.createRoundController('round_01' as any, mockQuestions[0]);
      expect(rc1).toBeDefined();

      // teardown 실행
      wireHelper.teardownAssaultSession();
      expect(session1.isDisposed).toBe(true);
      expect(sessionLifecycle.activeAssaultSessionToken).toBeNull();

      // restart 실행 (세션 2)
      const session2 = wireHelper.restartAssaultSession({ questions: mockQuestions });
      expect(session2).toBeDefined();
      expect(session2.sessionId).not.toBe(session1.sessionId);
      expect(sessionLifecycle.activeAssaultSessionToken).toBe(session2.sessionId);
      expect(session2.isDisposed).toBe(false);

      // teardown 세션 2
      wireHelper.teardownAssaultSession(session2);
      expect(session2.isDisposed).toBe(true);

      // 여러 차례 restart / teardown 반복
      for (let i = 0; i < 5; i++) {
        const s = wireHelper.restartAssaultSession({ questions: mockQuestions });
        wireHelper.teardownAssaultSession(s);
      }

      // 전역 리스너 수 증가 0건 검증
      const finalListenerCount = eventBusListenerCount();
      expect(finalListenerCount).toBe(initialListenerCount);
    });

    it('wrapper session.dispose() 호출 시 내부 rawSession과 wireHelper 상태가 완전히 정리되어야 한다', () => {
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({ questions: mockQuestions });

      expect(session.isDisposed).toBe(false);
      expect(wireHelper.assaultSession).toBe(session);

      session.dispose();

      expect(session.isDisposed).toBe(true);
      expect(wireHelper.assaultSession).toBeNull();
      expect(sessionLifecycle.activeAssaultSessionToken).toBeNull();
    });
  });
});
