import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StageProgressController } from '../../src/game/StageProgressController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import type { PhaseAResourceSnapshot, RoundResolveResult } from '../../src/types/result.js';
import { createDefaultRhythmStats } from '../../src/types/result.js';

describe('StageProgressController (Unit)', () => {
  let stateMachine: StateMachine;
  let sessionLifecycle: SessionLifecycle;

  beforeEach(() => {
    stateMachine = new StateMachine('ROUND_RESOLVE');
    // Register allowed transitions for testing
    stateMachine.registerState('ROUND_RESOLVE', {});
    stateMachine.registerState('RUN_QUESTION', {});
    stateMachine.registerState('BOSS_CLIMAX', {});
    stateMachine.registerState('GAMEOVER', {});
    stateMachine.registerState('MENU_MAIN', {});
    sessionLifecycle = new SessionLifecycle();
  });

  const createMockResolveResult = (overrides?: Partial<RoundResolveResult>): RoundResolveResult => ({
    roundIndex: 1,
    status: 'correct',
    manaGained: 25,
    damageDealt: 1,
    damageTaken: 0,
    combo: 1,
    spellCast: false,
    bossDefeated: false,
    playerDefeated: false,
    playerHp: 100,
    bossHp: 9,
    playerMana: 25,
    rhythmStats: createDefaultRhythmStats(),
    ...overrides,
  });

  it('기본 설정으로 초기화 시 0 라운드 정산 및 미완료 상태이다', () => {
    const controller = new StageProgressController();

    expect(controller.maxRounds).toBe(10);
    expect(controller.settledRoundCount).toBe(0);
    expect(controller.isPhaseAComplete).toBe(false);
    expect(controller.hasEnteredBossClimax).toBe(false);
    expect(controller.handoffCount).toBe(0);
    expect(controller.scheduledNextRoundCount).toBe(0);
    expect(controller.phaseBSnapshot).toBeNull();
  });

  it('1~9번째 라운드 정산 시 다음 문제(RUN_QUESTION) 진행을 통지하고 BOSS_CLIMAX로 전이하지 않는다', () => {
    const onAdvance = vi.fn();
    const onBossClimax = vi.fn();

    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      onAdvanceToNextRound: onAdvance,
      onEnterBossClimax: onBossClimax,
      advanceDelayMs: 0,
    });

    for (let round = 1; round <= 9; round++) {
      const result = createMockResolveResult({ roundIndex: round });
      const decision = controller.handleRoundSettled(result, { immediate: true });

      expect(decision.type).toBe('NEXT_ROUND');
      if (decision.type === 'NEXT_ROUND') {
        expect(decision.nextRoundIndex).toBe(round + 1);
      }
      expect(controller.settledRoundCount).toBe(round);
      expect(controller.isPhaseAComplete).toBe(false);
      expect(controller.hasEnteredBossClimax).toBe(false);
      expect(controller.handoffCount).toBe(0);
    }

    expect(onAdvance).toHaveBeenCalledTimes(9);
    expect(onBossClimax).not.toHaveBeenCalled();
    expect(controller.scheduledNextRoundCount).toBe(9);
  });

  it('10번째 라운드 정산 완료 시 플레이어가 생존해 있으면 BOSS_CLIMAX로 전이하고 단 1회 자원을 인계한다', () => {
    const onAdvance = vi.fn();
    const onBossClimax = vi.fn();
    const phaseBReceiver = vi.fn();

    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      onAdvanceToNextRound: onAdvance,
      onEnterBossClimax: onBossClimax,
      advanceDelayMs: 0,
    });
    controller.registerPhaseBReceiver(phaseBReceiver);

    // 1~9 라운드 진행
    for (let round = 1; round <= 9; round++) {
      controller.handleRoundSettled(createMockResolveResult({ roundIndex: round }), { immediate: true });
    }

    // 10번째 라운드 정산 (HP 100 생존)
    const round10 = createMockResolveResult({ roundIndex: 10, playerHp: 100 });
    const decision = controller.handleRoundSettled(round10, { immediate: true });

    expect(decision.type).toBe('BOSS_CLIMAX');
    expect(controller.settledRoundCount).toBe(10);
    expect(controller.isPhaseAComplete).toBe(true);
    expect(controller.hasEnteredBossClimax).toBe(true);
    expect(controller.handoffCount).toBe(1);
    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');

    // 11번째 문제 스케줄링은 발생하지 않음 (정확히 0회)
    expect(onAdvance).toHaveBeenCalledTimes(9);
    expect(controller.scheduledNextRoundCount).toBe(9);

    // 인계된 스냅샷 검증
    expect(onBossClimax).toHaveBeenCalledTimes(1);
    expect(phaseBReceiver).toHaveBeenCalledTimes(1);
    const handedSnapshot: PhaseAResourceSnapshot = onBossClimax.mock.calls[0][0];
    expect(handedSnapshot).toBeDefined();
    expect(handedSnapshot.isPhaseAComplete).toBe(true);
    expect(handedSnapshot.playerHp).toBe(100);
    expect(Object.isFrozen(handedSnapshot)).toBe(true);
  });

  it('10번째 라운드 정산 시 플레이어 HP <= 0이면 GAMEOVER가 우선하며 Phase B 인계 횟수는 0이다', () => {
    const onAdvance = vi.fn();
    const onBossClimax = vi.fn();
    const onGameOver = vi.fn();
    const phaseBReceiver = vi.fn();

    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      onAdvanceToNextRound: onAdvance,
      onEnterBossClimax: onBossClimax,
      onGameOver,
      advanceDelayMs: 0,
    });
    controller.registerPhaseBReceiver(phaseBReceiver);

    for (let round = 1; round <= 9; round++) {
      controller.handleRoundSettled(createMockResolveResult({ roundIndex: round }), { immediate: true });
    }

    // 10번째 라운드에서 플레이어 사망 (HP 0, playerDefeated: true)
    const deadResult = createMockResolveResult({
      roundIndex: 10,
      playerHp: 0,
      playerDefeated: true,
    });
    const decision = controller.handleRoundSettled(deadResult, { immediate: true });

    expect(decision.type).toBe('GAMEOVER');
    expect(stateMachine.currentState).toBe('GAMEOVER');
    expect(controller.hasEnteredBossClimax).toBe(false);
    expect(controller.handoffCount).toBe(0);
    expect(onBossClimax).not.toHaveBeenCalled();
    expect(phaseBReceiver).not.toHaveBeenCalled();
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(controller.scheduledNextRoundCount).toBe(9);
  });

  it('동일 라운드 중복 정산 요청 시 멱등성을 보장하여 중복 처리를 차단한다', () => {
    const onAdvance = vi.fn();
    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      onAdvanceToNextRound: onAdvance,
      advanceDelayMs: 0,
    });

    const result = createMockResolveResult({ roundIndex: 1 });
    const first = controller.handleRoundSettled(result, { immediate: true });
    expect(first.type).toBe('NEXT_ROUND');

    // 동일 라운드 중복 호출
    const second = controller.handleRoundSettled(result, { immediate: true });
    expect(second.type).toBe('IGNORED');
    expect(controller.settledRoundCount).toBe(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('10번째 라운드 완료 후 추가 호출이나 중복 프레임에서도 Phase B 인계는 단 1회만 일어난다', () => {
    const onBossClimax = vi.fn();
    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      onEnterBossClimax: onBossClimax,
      advanceDelayMs: 0,
    });

    for (let round = 1; round <= 10; round++) {
      controller.handleRoundSettled(createMockResolveResult({ roundIndex: round }), { immediate: true });
    }
    expect(controller.handoffCount).toBe(1);

    // 10번째 재호출 또는 임의 11번째 호출
    const duplicate = controller.handleRoundSettled(createMockResolveResult({ roundIndex: 10 }), { immediate: true });
    expect(duplicate.type).toBe('IGNORED');
    const extra = controller.handleRoundSettled(createMockResolveResult({ roundIndex: 11 }), { immediate: true });
    expect(extra.type).toBe('IGNORED');

    expect(controller.handoffCount).toBe(1);
    expect(onBossClimax).toHaveBeenCalledTimes(1);
  });

  it('SessionLifecycle 지연 예약 중 메뉴 복귀 시 비동기 인계가 취소된다', () => {
    vi.useFakeTimers();

    const onBossClimax = vi.fn();
    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      sessionLifecycle,
      onEnterBossClimax: onBossClimax,
      advanceDelayMs: 800,
    });

    for (let round = 1; round <= 9; round++) {
      controller.handleRoundSettled(createMockResolveResult({ roundIndex: round }), { immediate: true });
    }

    // 10번째 라운드 지연 정산 예약
    controller.handleRoundSettled(createMockResolveResult({ roundIndex: 10 }));
    expect(controller.hasEnteredBossClimax).toBe(false);
    expect(onBossClimax).not.toHaveBeenCalled();

    // 400ms 시점에 메뉴 복귀 (세션 종료)
    vi.advanceTimersByTime(400);
    sessionLifecycle.endSession();
    stateMachine.changeState('MENU_MAIN');

    // 800ms 만료 시점
    vi.advanceTimersByTime(500);

    expect(onBossClimax).not.toHaveBeenCalled();
    expect(controller.handoffCount).toBe(0);
    expect(stateMachine.currentState).toBe('MENU_MAIN');

    vi.useRealTimers();
  });

  it('reset() 호출 시 정산 카운트 및 인계 상태가 초기화된다', () => {
    const controller = new StageProgressController({ maxRounds: 10, advanceDelayMs: 0 });

    for (let round = 1; round <= 10; round++) {
      controller.handleRoundSettled(createMockResolveResult({ roundIndex: round }), { immediate: true });
    }
    expect(controller.settledRoundCount).toBe(10);
    expect(controller.handoffCount).toBe(1);

    controller.reset();

    expect(controller.settledRoundCount).toBe(0);
    expect(controller.isPhaseAComplete).toBe(false);
    expect(controller.hasEnteredBossClimax).toBe(false);
    expect(controller.handoffCount).toBe(0);
    expect(controller.scheduledNextRoundCount).toBe(0);
    expect(controller.phaseBSnapshot).toBeNull();
  });
});
