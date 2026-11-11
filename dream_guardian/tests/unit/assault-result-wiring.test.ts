import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionWireHelper, type AssaultSessionWireHost } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { AssaultResultStore, ASSAULT_RESULT_STORAGE_KEY } from '../../src/storage/AssaultResultStore.js';
import type { AssaultRoundSummaryData } from '../../src/game/assault/AssaultRoundSummary.js';

describe('[BOSS-ASSAULT-35 / #537] 결과·보상·저장 종료 포트 배선', () => {
  let eventBus: EventBus;
  let battle: BattleState;
  let boss: BossController;
  let stateMachine: StateMachine;
  let sessionLifecycle: SessionLifecycle;
  let questionBank: QuestionBank;
  let host: AssaultSessionWireHost;
  let helper: AssaultSessionWireHelper;
  let mockStorage: any;
  let resultStore: AssaultResultStore;

  const mockRoundSummary: AssaultRoundSummaryData = {
    sessionId: 'session-123',
    roundId: 'round-1',
    completedQuestions: 1,
    isAborted: false,
    isDefeated: false,
    correctCount: 4,
    wrongCount: 0,
    timeoutCount: 0,
    evadeSuccessCount: 0,
    squatFailCount: 0,
    totalEncounters: 4,
    attemptedAnswerHits: 4,
    ratingCounts: { Perfect: 4, Good: 0, Late: 0, Miss: 0 },
    maxCombo: 4,
    endCombo: 4,
    totalPlayerDamage: 0,
    totalBossDamage: 4,
    totalActualDamage: 4,
    actualDamage: 0,
    totalRequestedDamage: 4,
    activeDurationSeconds: 16.0,
    processedAttackIds: ['a1', 'a2', 'a3', 'a4'],
    processedReceiptIds: ['r1', 'r2', 'r3', 'r4'],
  };

  beforeEach(() => {
    eventBus = new EventBus();
    battle = new BattleState(100);
    boss = new BossController(1);
    stateMachine = new StateMachine('MENU_MAIN');
    sessionLifecycle = new SessionLifecycle();
    questionBank = new QuestionBank();

    mockStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    resultStore = new AssaultResultStore(mockStorage);

    const mainSceneContext: any = {
      state: {
        screenMode: 'game',
        resultData: null,
      },
    };

    host = {
      eventBus,
      battle,
      boss,
      stateMachine,
      sessionLifecycle,
      questionBank,
      mainSceneContext,
      speech: { speak: vi.fn(), cancel: vi.fn() },
      goToMenu: vi.fn(),
      assaultResultStore: resultStore,
    } as any;

    helper = new AssaultSessionWireHelper(host);
  });

  it('1. 테스트 세션(isTestSession: true) 종료 시 AssaultResultStore 저장을 스킵하고 로컬스토리지를 오염시키지 않는다', () => {
    const session = helper.assembleAssaultSession({ isTestSession: true } as any);
    expect(helper.lastAssaultResultSnapshot).toBeNull();

    const roundSummary = { ...mockRoundSummary, sessionId: session.sessionId };
    const handled = helper.handleAssaultSessionTermination({
      outcome: 'completed',
      roundSummaries: [roundSummary],
      isTestSession: true,
      recordResults: false,
    });

    expect(handled).toBe(true);
    expect(mockStorage.setItem).not.toHaveBeenCalledWith(ASSAULT_RESULT_STORAGE_KEY, expect.anything());

    const snapshot = helper.lastAssaultResultSnapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot!.outcome).toBe('completed');
    expect(snapshot!.storage?.status).toBe('skipped');
    expect((snapshot!.storage as any).reason).toBe('test-session');
  });

  it('2. 승인된 기록 세션(recordResults: true, isTestSession: false) 종료 시 정확히 1회 저장 영수증을 발행한다', () => {
    const session = helper.assembleAssaultSession({ isTestSession: false, recordResults: true } as any);

    const roundSummary = { ...mockRoundSummary, sessionId: session.sessionId };
    const handled = helper.handleAssaultSessionTermination({
      outcome: 'completed',
      roundSummaries: [roundSummary],
      isTestSession: false,
      recordResults: true,
    });

    expect(handled).toBe(true);
    expect(mockStorage.setItem).toHaveBeenCalledWith(ASSAULT_RESULT_STORAGE_KEY, expect.anything());

    const snapshot = helper.lastAssaultResultSnapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot!.outcome).toBe('completed');
    expect(snapshot!.storage?.status).toBe('stored');
    expect((snapshot!.storage as any).receipt).toBeDefined();
  });

  it('3. 중복 종료 호출 또는 이미 종료된 세션의 호출은 차단(false 반환 및 중복 저장 없음)된다', () => {
    const session = helper.assembleAssaultSession({ isTestSession: false, recordResults: true } as any);

    const roundSummary = { ...mockRoundSummary, sessionId: session.sessionId };
    const firstHandled = helper.handleAssaultSessionTermination({
      outcome: 'completed',
      roundSummaries: [roundSummary],
      isTestSession: false,
      recordResults: true,
    });
    expect(firstHandled).toBe(true);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

    // 두 번째 중복 호출
    const secondHandled = helper.handleAssaultSessionTermination({
      outcome: 'completed',
      roundSummaries: [roundSummary],
      isTestSession: false,
      recordResults: true,
    });
    expect(secondHandled).toBe(false);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1); // 저장 회수 불변
  });

  it('4. 저장 실패(예외) 시에도 에러 상태를 snapshot에 안전하게 전달하고 화면 상태를 RESULT로 전이한다', () => {
    mockStorage.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const session = helper.assembleAssaultSession({ isTestSession: false, recordResults: true } as any);

    const roundSummary = { ...mockRoundSummary, sessionId: session.sessionId };
    const handled = helper.handleAssaultSessionTermination({
      outcome: 'completed',
      roundSummaries: [roundSummary],
      isTestSession: false,
      recordResults: true,
    });

    expect(handled).toBe(true);
    const snapshot = helper.lastAssaultResultSnapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot!.storage?.status).toBe('error');
    expect((snapshot!.storage as any).code).toBe('storage-write-failed');
    expect(stateMachine.currentState).toBe('RESULT');
  });
});
