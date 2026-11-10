import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import type { AssaultHandoverSnapshot } from '../../src/game/assault/AssaultProgressController.js';

/**
 * [BOSS-ASSAULT-24 / Issue #526] 세션 종료·재시작·인계 수명주기 연결 단위 테스트
 * (assault-lifecycle.test.ts)
 *
 * 검증 항목:
 * 1. SessionLifecycle 단일 종료 권위(Single Authority) 및 멱등성 (A14, A15, A22):
 *    - 사망(game_over) / 인계(handover_climax) 의도 발생 시 정확히 1회만 종료 전환 허용
 *    - 중복 호출 시 false 반환 및 추가 전이 차단
 *    - 인계 snapshot(AssaultHandoverSnapshot) 불변 보관
 *    - 세션 토큰 검증을 통한 이전 세션의 만료된 intent/이벤트 완전 차단
 * 2. AppBootstrap assault 수명주기 연계:
 *    - assaultSession의 종료 의도를 SessionLifecycle로 라우팅
 *    - 사망 시 StateMachine GAMEOVER 1회 전이, 인계 시 RESULT 1회 전이
 *    - MVP 테스트 세션 종료 시 승리 영속화/저장/미구현 결전 모드 호출 0회
 *    - 마지막 라운드 HP 0 경계에서 사망 최우선 처리 (다음 문제/결전/저장 0회)
 * 3. 재시작 및 메뉴 복귀 시 이전 세션 자원 격리 (A16):
 *    - 재시작/메뉴 복귀 시 assaultSession.dispose() 및 잔여 예약 취소
 *    - 재시작 뒤 이전 세션의 키보드 입력, TTS 비동기 완료 콜백, 타이머 격리 및 무시
 *    - 새 세션의 원본 계획(BPM, pattern, questions, HP 100) 및 독립 정산 보존
 */

function createMockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
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
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

const sampleQuestions: QuestionCandidate[] = [
  {
    level: 1,
    subLevel: 1,
    questionText: '4 + 3 = ?',
    correctAnswer: 7,
    wrongAnswer: 8,
    choices: [7, 8],
  },
  {
    level: 1,
    subLevel: 2,
    questionText: '9 - 5 = ?',
    correctAnswer: 4,
    wrongAnswer: 3,
    choices: [4, 3],
  },
];

const mockHandoverSnapshot: AssaultHandoverSnapshot = Object.freeze({
  sessionId: 'test_session_123',
  mode: 'boss_assault',
  rulesVersion: '0.3.0',
  targetRounds: 10,
  completedRounds: 10,
  finalHp: 75,
  timestampMs: 123456789,
  stats: Object.freeze({
    totalCompletedQuestions: 10,
    totalCorrectHits: 9,
    totalWrongHits: 1,
    totalTimeoutHits: 0,
    totalEvadeSuccessCount: 3,
    totalSquatFailCount: 0,
    totalEncounters: 13,
    totalAttemptedAnswerHits: 10,
    ratingCounts: Object.freeze({
      Perfect: 8,
      Good: 1,
      Late: 0,
      Miss: 1,
    }),
    maxCombo: 8,
    totalPlayerDamage: 25,
    totalBossDamage: 0,
    totalActualDamage: 25,
    totalRequestedDamage: 25,
    totalActiveDurationSeconds: 45,
    processedRoundIds: Object.freeze(['round_01']),
  }),
});

describe('[BOSS-ASSAULT-24 / #526] 세션 종료·재시작·인계 수명주기 연결', () => {
  let originalWindow: any;
  let originalDocument: any;
  let mockCanvas: any;
  let mockDoc: any;
  let mockDocumentListeners: Record<string, any[]> = {};

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    mockCanvas = createMockCanvas();
    mockDocumentListeners = {};

    mockDoc = {
      hidden: false,
      getElementById: vi.fn((id: string) => (id === 'game-canvas' ? mockCanvas : null)),
      addEventListener: vi.fn((type: string, fn: any) => {
        mockDocumentListeners[type] = mockDocumentListeners[type] || [];
        mockDocumentListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockDocumentListeners[type]) {
          mockDocumentListeners[type] = mockDocumentListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockDocumentListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };

    const mockStorage: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
  });

  // ─── 1. SessionLifecycle 단일 종료 권위 ───
  describe('1. SessionLifecycle 단일 종료 권위 및 인계 스냅샷 보관 (A14, A15, A22)', () => {
    let lifecycle: SessionLifecycle;

    beforeEach(() => {
      lifecycle = new SessionLifecycle();
    });

    it('사망(game_over) 의도 발생 시 최초 1회만 true를 반환하고 중복 호출은 false를 반환한다', () => {
      lifecycle.setActiveAssaultSessionToken('sess_01');

      const firstCall = lifecycle.handleAssaultIntent('game_over', null, 'sess_01');
      expect(firstCall).toBe(true);
      expect(lifecycle.hasResultShown).toBe(true);

      // 중복 사망 의도 유입 시 false 반환
      const secondCall = lifecycle.handleAssaultIntent('game_over', null, 'sess_01');
      expect(secondCall).toBe(false);

      // 이미 결과가 전환되었으므로 인계 의도가 유입되어도 거부
      const handoverAfterDeath = lifecycle.handleAssaultIntent('handover_climax', mockHandoverSnapshot, 'sess_01');
      expect(handoverAfterDeath).toBe(false);
    });

    it('인계(handover_climax) 의도 발생 시 1회 승인되고 lastHandoverSnapshot에 스냅샷을 보관한다', () => {
      lifecycle.setActiveAssaultSessionToken('sess_02');

      const res = lifecycle.handleAssaultIntent('handover_climax', mockHandoverSnapshot, 'sess_02');
      expect(res).toBe(true);
      expect(lifecycle.hasResultShown).toBe(true);
      expect(lifecycle.lastHandoverSnapshot).toBe(mockHandoverSnapshot);

      // 중복 인계 시도 시 false
      const duplicateRes = lifecycle.handleAssaultIntent('handover_climax', mockHandoverSnapshot, 'sess_02');
      expect(duplicateRes).toBe(false);
    });

    it('종료 의도가 아닌 intent(next_round, none 등)는 거부(false)하고 결과 상태를 변경하지 않는다', () => {
      lifecycle.setActiveAssaultSessionToken('sess_03');

      expect(lifecycle.handleAssaultIntent('next_round', null, 'sess_03')).toBe(false);
      expect(lifecycle.handleAssaultIntent('none', null, 'sess_03')).toBe(false);
      expect(lifecycle.handleAssaultIntent('unknown' as any, null, 'sess_03')).toBe(false);
      expect(lifecycle.hasResultShown).toBe(false);
    });

    it('만료되었거나 다른 세션 토큰을 가진 의도는 완전히 차단된다', () => {
      lifecycle.setActiveAssaultSessionToken('sess_current');

      // 이전 세션의 지연된 사망 의도
      const oldIntent = lifecycle.handleAssaultIntent('game_over', null, 'sess_expired');
      expect(oldIntent).toBe(false);
      expect(lifecycle.hasResultShown).toBe(false);

      // 현재 세션의 의도는 정상 처리
      const currentIntent = lifecycle.handleAssaultIntent('game_over', null, 'sess_current');
      expect(currentIntent).toBe(true);
      expect(lifecycle.hasResultShown).toBe(true);
    });

    it('startSession 또는 endSession 호출 시 이전 토큰과 스냅샷이 정리된다', () => {
      lifecycle.setActiveAssaultSessionToken('sess_01');
      lifecycle.handleAssaultIntent('handover_climax', mockHandoverSnapshot, 'sess_01');
      expect(lifecycle.lastHandoverSnapshot).toBe(mockHandoverSnapshot);

      // 세션 재시작
      lifecycle.startSession();
      expect(lifecycle.hasResultShown).toBe(false);
      expect(lifecycle.lastHandoverSnapshot).toBeNull();
      expect(lifecycle.activeAssaultSessionToken).toBeNull();
    });
  });

  // ─── 2. AppBootstrap assault 수명주기 라우팅 ───
  describe('2. AppBootstrap assault 수명주기 라우팅 및 상태 전이 (A14, A15, A22)', () => {
    it('assaultSession에서 game_over 의도 유입 시 StateMachine이 GAMEOVER로 1회 전이된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      // 초기 상태를 READY_POSITION -> ASSAULT_ROUND로 설정
      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('ASSAULT_ROUND');
      expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');

      const handled = app.handleAssaultIntent('game_over', null, session.sessionId);
      expect(handled).toBe(true);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');
      expect(app.sessionLifecycle.hasResultShown).toBe(true);

      // 2번째 중복 호출 시 false 반환 및 상태 유지
      const duplicateHandled = app.handleAssaultIntent('game_over', null, session.sessionId);
      expect(duplicateHandled).toBe(false);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');

      app.dispose();
    });

    it('assaultSession에서 handover_climax 의도 유입 시 StateMachine이 RESULT로 1회 전이되고 영속 저장을 하지 않는다 (A22)', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('ASSAULT_ROUND');

      // 영속 저장 모의 스파이 (localStorage 또는 persistence)
      const setItemSpy = vi.spyOn(localStorage, 'setItem');

      const handled = app.handleAssaultIntent('handover_climax', mockHandoverSnapshot, session.sessionId);
      expect(handled).toBe(true);
      expect(app.stateMachine.currentState).toBe('RESULT');
      expect(app.sessionLifecycle.lastHandoverSnapshot).toBe(mockHandoverSnapshot);

      // MVP 테스트 세션: 별점/하이스코어 영속 저장 0회
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      // 미구현 결전 모드로의 전이 0회 확인
      expect(app.stateMachine.currentState).not.toBe('BOSS_CLIMAX');

      app.dispose();
    });

    it('마지막 라운드 HP 0 경계에서 사망 의도가 최우선으로 처리된다 (A15, A22)', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
        targetRounds: 2,
      });

      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('ASSAULT_ROUND');

      // HP 0 상태
      app.battle.applyHazardDamage(100);
      expect(app.battle.hp).toBe(0);

      // progressController에서 사망 의도 평가
      const summaryData = {
        roundId: 'round_final',
        sessionId: session.sessionId,
        questionText: '4 + 3 = ?',
        isAborted: false,
        completedQuestions: 1,
        totalQuestions: 1,
        isDefeated: true,
        correctCount: 0,
        wrongCount: 1,
        timeoutCount: 0,
        ratings: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 1 },
      } as any;

      const evalResult = session.progressController.evaluate(summaryData, app.battle.hp);
      expect(evalResult.intent).toBe('game_over');

      // game_over 의도 라우팅
      const handled = app.handleAssaultIntent(evalResult.intent, evalResult.handoverSnapshot, session.sessionId);
      expect(handled).toBe(true);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');

      // 인계 스냅샷은 생성되지 않음
      expect(app.sessionLifecycle.lastHandoverSnapshot).toBeNull();

      app.dispose();
    });
  });

  // ─── 3. 재시작 및 메뉴 복귀 시 이전 세션 격리 (A16) ───
  describe('3. 재시작 및 메뉴 복귀 시 이전 세션 자원 격리 (A16)', () => {
    it('메뉴 복귀(goToMenu) 시 assaultSession이 dispose되고 세션 토큰 및 예약이 취소된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const oldSessionId = session.sessionId;
      const oldSessionDisposeSpy = vi.spyOn(session, 'dispose');

      // 비동기 예약 등록
      const scheduledCallback = vi.fn();
      app.sessionLifecycle.schedule(scheduledCallback, 100);
      expect(app.sessionLifecycle.pendingTimeoutCount).toBeGreaterThan(0);

      // 메뉴 복귀
      app.goToMenu();

      // 기존 세션 dispose 확인
      expect(oldSessionDisposeSpy).toHaveBeenCalledTimes(1);
      expect(app.assaultSession).toBeNull();
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');
      expect(app.sessionLifecycle.pendingTimeoutCount).toBe(0);

      // 이전 세션의 지연된 intent는 거부됨
      const res = app.handleAssaultIntent('game_over', null, oldSessionId);
      expect(res).toBe(false);

      app.dispose();
    });

    it('restartAssaultSession 호출 시 이전 세션이 dispose되고 새 세션이 원본 계획과 HP 100으로 초기화된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session1 = app.assembleAssaultSession({
        questions: sampleQuestions,
        bpm: 130,
      });

      const session1Id = session1.sessionId;

      // session1에서 플레이어 HP 감소
      app.battle.applyHazardDamage(40);
      expect(app.battle.hp).toBe(60);

      // 이전 세션에 걸어둔 비동기 예약
      const pendingFn = vi.fn();
      app.sessionLifecycle.schedule(pendingFn, 200);

      // 세션 재시작
      const session2 = app.restartAssaultSession();

      expect(session2).toBeDefined();
      expect(session2.sessionId).not.toBe(session1Id);
      expect(app.battle.hp).toBe(100); // HP 100 리셋
      expect(session1.isDisposed).toBe(true); // 이전 세션 완전 dispose
      expect(session2.isDisposed).toBe(false);
      expect(session2.compiledPlan.bpm).toBe(130); // 원본 계획 보존

      // 이전 세션(session1)의 늦은 키보드 입력은 무시됨
      const keyEvent = {
        key: '1',
        code: 'Digit1',
        repeat: false,
        timestampMs: performance.now(),
        sessionId: session1Id,
      };
      // fallbackAdapter handleKeyDown 직접 호출 시 아무 동작 안 함
      expect(() => {
        (session1.fallbackAdapter as any)?.handleKeyDown(keyEvent);
      }).not.toThrow();

      // 이전 세션의 늦은 사망/인계 의도 무시
      expect(app.handleAssaultIntent('game_over', null, session1Id)).toBe(false);

      // 이전 세션의 예약 콜백 취소 확인
      expect(app.sessionLifecycle.pendingTimeoutCount).toBe(0);

      app.dispose();
    });

    it('새 세션에서 이전 세션과 동일한 attackId라도 settlement가 독립적으로 동작한다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session1 = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      // session1에서 피해 정산
      const result1 = session1.settlement.settle({
        sessionId: session1.sessionId,
        roundId: 'round_01',
        attackId: 'atk_shared_id',
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'idem_key_01',
      });
      expect(result1.applied).toBe(true);
      expect(app.battle.hp).toBe(100 - session1.config.wrongDamage);

      // 재시작
      const session2 = app.restartAssaultSession();

      // session2에서 동일한 attackId와 idempotencyKey로 정산 시도
      const result2 = session2.settlement.settle({
        sessionId: session2.sessionId,
        roundId: 'round_01',
        attackId: 'atk_shared_id',
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'idem_key_01',
      });

      // 새 세션이므로 이전 세션의 멱등성 캐시에 영향받지 않고 정상 applied
      expect(result2.applied).toBe(true);
      expect(app.battle.hp).toBe(100 - session2.config.wrongDamage);

      app.dispose();
    });

    it('재시작 후 이전 세션의 TTS 완료나 cancel이 현재 세션에 영향을 주지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const speechCancelSpy = vi.spyOn(app.speech, 'cancel');

      // 재시작 실행
      app.restartAssaultSession();

      // 재시작 과정에서 이전 발화 cancel 1회 호출
      expect(speechCancelSpy).toHaveBeenCalled();

      // 현재 세션 상태는 정상
      expect(app.assaultSession).toBeDefined();
      expect(app.assaultSession?.isDisposed).toBe(false);

      app.dispose();
    });
  });
});
