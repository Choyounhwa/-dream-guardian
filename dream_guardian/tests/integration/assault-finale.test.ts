import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { DEFAULT_ASSAULT_FINALE_CONFIG } from '../../config/assault-finale.config.js';
import { AssaultFinaleController } from '../../src/game/assault/AssaultFinaleController.js';
import type { AssaultHandoverSnapshot } from '../../src/game/assault/AssaultProgressController.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[BOSS-ASSAULT-30 / #532] Assault Finale Handover and Execution Integration Tests', () => {
  let app: AppBootstrap;

  const sampleQuestions: QuestionCandidate[] = [
    {
      level: 1,
      subLevel: 1,
      questionText: '5 + 3 = ?',
      correctAnswer: 8,
      wrongAnswer: 9,
      choices: [8, 9],
    },
    {
      level: 1,
      subLevel: 2,
      questionText: '10 - 4 = ?',
      correctAnswer: 6,
      wrongAnswer: 7,
      choices: [6, 7],
    },
  ];

  const createHandoverSnapshot = (
    overrides?: Partial<AssaultHandoverSnapshot>
  ): AssaultHandoverSnapshot => ({
    sessionId: 'session_finale_int_01',
    mode: 'boss_assault',
    rulesVersion: 'v0.3',
    finalHp: 80,
    targetRounds: 10,
    completedRounds: 10,
    stats: {
      totalCompletedQuestions: 10,
      totalCorrectHits: 10,
      totalWrongHits: 0,
      totalTimeoutHits: 0,
      totalEvadeSuccessCount: 10,
      totalSquatFailCount: 0,
      totalEncounters: 20,
      totalAttemptedAnswerHits: 10,
      ratingCounts: { Perfect: 10, Good: 0, Late: 0, Miss: 0 },
      maxCombo: 10,
      totalPlayerDamage: 0,
      totalBossDamage: 0,
      totalActualDamage: 0,
      totalRequestedDamage: 0,
      totalActiveDurationSeconds: 100,
      processedRoundIds: ['r1' as any, 'r2' as any, 'r3' as any, 'r4' as any, 'r5' as any, 'r6' as any, 'r7' as any, 'r8' as any, 'r9' as any, 'r10' as any],
    },
    timestampMs: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    app = new AppBootstrap({
      mode: 'boss_assault',
    });
  });

  afterEach(() => {
    if (app && !app.isDisposed) {
      app.dispose();
    }
    vi.unstubAllGlobals();
  });

  describe('1. 근접 결전 인계 및 시작 배선 (handover_climax -> AssaultFinaleController)', () => {
    it('handover_climax 의도에 startFinale 옵션 전달 시 결전 컨트롤러가 활성화되고 HP/설정이 주입되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });

      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId, finalHp: 85 });
      const accepted = app.handleAssaultIntent('handover_climax', snapshot, session.sessionId, {
        startFinale: true,
      });

      expect(accepted).toBe(true);
      expect(app.finaleController).toBeInstanceOf(AssaultFinaleController);
      expect(app.bossController.hp).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
      expect(app.battle.hp).toBe(85);
      // StateMachine은 결전 중이므로 즉시 RESULT로 전이하지 않음
      expect(app.stateMachine.currentState).not.toBe('RESULT');
    });

    it('startAssaultFinale 및 assembleAssaultFinaleSession 편의 메서드로 결전이 올바르게 시작되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });

      const finale = app.startAssaultFinale(snapshot);

      expect(finale).toBeInstanceOf(AssaultFinaleController);
      expect(app.finaleController).toBe(finale);
      expect(app.bossController.hp).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
    });

    it('결전이 시작된 후에는 11번째 추가 문제 출제 시도가 차단되어야 한다 (추가 문제 0회)', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });
      app.startAssaultFinale(snapshot);

      expect(() => {
        (session as any).createRoundController('round_11', sampleQuestions[0]);
      }).toThrow(/finale.*active/i);
    });
  });

  describe('2. 결전 런타임 진행, 모션 입력 및 정산 배선', () => {
    it('키보드 및 포즈 점프 입력이 AssaultJumpAdapter를 거쳐 결전 컨트롤러로 라우팅되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });
      const finale = app.startAssaultFinale(snapshot)!;

      const jumpSpy = vi.spyOn(finale, 'handleJump');
      const punchSpy = vi.spyOn(finale, 'handlePunch');
      const squatSpy = vi.spyOn(finale, 'handleSquat');

      // 키보드 Fallback 입력 라우팅 (ArrowUp -> jump, ArrowDown -> squat, 1 -> punch)
      (session as any).handleKeyboard({ key: 'ArrowUp', code: 'ArrowUp' } as any);
      expect(jumpSpy).toHaveBeenCalled();

      (session as any).handleKeyboard({ key: 'ArrowDown', code: 'ArrowDown' } as any);
      expect(squatSpy).toHaveBeenCalled();

      (session as any).handleKeyboard({ key: 'ArrowLeft', code: 'ArrowLeft' } as any);
      expect(punchSpy).toHaveBeenCalled();
    });

    it('결전 컨트롤러의 정산 명령(Settlement Command)이 세션의 AssaultSettlement를 통해 보스 및 플레이어 HP에 즉시 반영되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId, finalHp: 100 });
      const finale = app.startAssaultFinale(snapshot)!;

      // 0~4박: 약점 펀치 판정창 (2~4박, 120BPM 기준 1.0s~2.0s)
      (session as any).clock.update(1.2, 1200); // 1.2초 시점 (판정창 내부)
      (session as any).update(0.016);

      // 정답 펀치 입력
      const inputResult = finale.handlePunch({ hand: 'left', timestampMs: 1200, activeSeconds: 1.2 });
      expect(inputResult.accepted).toBe(true);
      expect(finale.getPendingSettlementCommands().length).toBeGreaterThan(0);

      // update() 호출 시 정산 명령 처리 및 receipt 반영
      (session as any).update(0.016);

      expect(finale.getPendingSettlementCommands().length).toBe(0);
      expect(app.bossController.hp).toBeLessThan(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
    });
  });

  describe('3. 결전 종료 권위 및 A14/A22 동시 HP 0 우선순위 검증', () => {
    it('보스 처치(victory) 시 RESULT 상태로 안전하게 전이되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });
      const finale = app.startAssaultFinale(snapshot)!;

      // 보스 HP 0으로 강제 소진
      app.bossController.takeDamage(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
      (finale as any)._bossHp = 0;
      (finale as any)._isVictory = true;
      (finale as any)._phase = 'victory';

      (session as any).update(0.016);

      expect(app.stateMachine.currentState).toBe('RESULT');
      expect(app.sessionLifecycle.hasResultShown).toBe(true);
    });

    it('플레이어 사망(defeat) 시 GAMEOVER 상태로 안전하게 전이되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });
      const finale = app.startAssaultFinale(snapshot)!;

      // 플레이어 HP 0
      (app.battle as any)._hp = 0;
      (finale as any)._playerHp = 0;
      (finale as any)._isDefeat = true;
      (finale as any)._phase = 'defeat';

      (session as any).update(0.016);

      expect(app.stateMachine.currentState).toBe('GAMEOVER');
      expect(app.sessionLifecycle.hasResultShown).toBe(true);
    });

    it('A14 & A22: 플레이어 HP 0과 보스 HP 0이 동시 발생할 경우 반드시 플레이어 패배(GAMEOVER)가 최우선 전이되어야 한다', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });
      const finale = app.startAssaultFinale(snapshot)!;

      // 양측 동시 HP 0
      (app.battle as any)._hp = 0;
      app.bossController.takeDamage(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
      (finale as any)._playerHp = 0;
      (finale as any)._bossHp = 0;
      (finale as any)._isDefeat = true;
      (finale as any)._isVictory = true;

      (session as any).update(0.016);

      expect(app.stateMachine.currentState).toBe('GAMEOVER');
      expect(app.stateMachine.currentState).not.toBe('RESULT');
    });

    it('결전 종료 후 지연된 stale 신호나 중복 종료 요청은 차단되어야 한다 (멱등성)', () => {
      const session = app.assembleAssaultSession({
        sessionId: 'session_finale_int_01',
        questions: sampleQuestions,
      });
      const snapshot = createHandoverSnapshot({ sessionId: session.sessionId });
      app.startAssaultFinale(snapshot);

      // 이미 종료된 상태
      app.handleAssaultIntent('game_over', null, session.sessionId);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');

      // 중복 종료 시도
      const secondCall = app.handleAssaultIntent('victory', null, session.sessionId);
      expect(secondCall).toBe(false);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');
    });
  });
});
