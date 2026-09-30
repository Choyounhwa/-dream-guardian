import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StageProgressController } from '../../src/game/StageProgressController.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { PhaseAResourceManager } from '../../src/game/PhaseAResourceManager.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('Stage Handoff Integration (StageProgressController + Phase A Systems)', () => {
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;
  let resourceManager: PhaseAResourceManager;
  let beatRoundResolver: BeatRoundResolver;
  let stateMachine: StateMachine;
  let sessionLifecycle: SessionLifecycle;

  beforeEach(() => {
    battle = new BattleState();
    boss = new BossController(1);
    guardian = new GuardianSystem();
    resourceManager = new PhaseAResourceManager({ battle, boss, guardian });
    beatRoundResolver = new BeatRoundResolver({
      battle,
      boss,
      guardian,
      resourceManager,
      nonLethalPhaseA: true,
      minBossHp: 1,
      maxPhaseARounds: 10,
    });

    stateMachine = new StateMachine('ROUND_RESOLVE');
    stateMachine.registerState('RUN_QUESTION', {});
    stateMachine.registerState('ROUND_RESOLVE', {});
    stateMachine.registerState('BOSS_CLIMAX', {});
    stateMachine.registerState('GAMEOVER', {});
    stateMachine.registerState('MENU_MAIN', {});

    sessionLifecycle = new SessionLifecycle();
  });

  it('10연속 정답 경로: 1~9회는 다음 문제 전이, 10번째 정산 시 BOSS_CLIMAX 전이 및 자원 스냅샷 단 1회 인계', () => {
    const onAdvance = vi.fn((nextRound: number) => {
      beatRoundResolver.startNewRound(nextRound);
      stateMachine.changeState('RUN_QUESTION');
    });

    let receivedSnapshot: PhaseAResourceSnapshot | null = null;
    const phaseBReceiver = vi.fn((snapshot: PhaseAResourceSnapshot) => {
      receivedSnapshot = snapshot;
    });

    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      sessionLifecycle,
      resourceProvider: beatRoundResolver,
      onAdvanceToNextRound: onAdvance,
      advanceDelayMs: 0,
    });
    controller.registerPhaseBReceiver(phaseBReceiver);

    // 1~9번째 라운드 실행
    for (let r = 1; r <= 9; r++) {
      beatRoundResolver.recordStarRating('Perfect', `note-${r}`);
      stateMachine.changeState('ROUND_RESOLVE');
      const resolveResult = beatRoundResolver.resolveRound('correct', r);
      const decision = controller.handleRoundSettled(resolveResult, { immediate: true });

      expect(decision.type).toBe('NEXT_ROUND');
      expect(controller.hasEnteredBossClimax).toBe(false);
      expect(controller.handoffCount).toBe(0);
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
    }

    expect(onAdvance).toHaveBeenCalledTimes(9);
    expect(beatRoundResolver.settledRoundCount).toBe(9);
    expect(controller.scheduledNextRoundCount).toBe(9);

    // 10번째 라운드 실행
    beatRoundResolver.recordStarRating('Perfect', 'note-10');
    stateMachine.changeState('ROUND_RESOLVE');
    const round10Result = beatRoundResolver.resolveRound('correct', 10);
    const round10Decision = controller.handleRoundSettled(round10Result, { immediate: true });

    // 검증: BOSS_CLIMAX 전이 및 단 1회 인계
    expect(round10Decision.type).toBe('BOSS_CLIMAX');
    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(controller.hasEnteredBossClimax).toBe(true);
    expect(controller.handoffCount).toBe(1);
    expect(phaseBReceiver).toHaveBeenCalledTimes(1);

    // 11번째 문제 스케줄링 0회 검증
    expect(onAdvance).toHaveBeenCalledTimes(9);
    expect(controller.scheduledNextRoundCount).toBe(9);

    // 스냅샷 무결성 및 자원 보존 검증 (Phase B 진입 시 리셋 0건)
    expect(receivedSnapshot).not.toBeNull();
    const snap = receivedSnapshot!;
    expect(snap.isPhaseAComplete).toBe(true);
    expect(snap.totalSettledQuestions).toBe(10);
    expect(snap.correctCount).toBe(10);
    expect(snap.wrongCount).toBe(0);
    expect(snap.timeoutCount).toBe(0);
    expect(snap.minionCount).toBe(13); // 초기 3 + 정답 10 = 13 (최대 상한)
    expect(snap.stardust).toBe(40); // 10회 * Perfect(4) = 40
    expect(snap.bossHp).toBeGreaterThanOrEqual(1); // 비치명 하한선 보장
    expect(snap.isBossDefeated).toBe(false); // Phase A에서 조기 처치 방지

    // Phase A 내부 자원 리셋 없음 검증
    expect(resourceManager.minionCount).toBe(13);
    expect(resourceManager.stardust).toBe(40);
    expect(battle.correctCount).toBe(10);
  });

  it('혼합 10문제 (정답 5, 오답 3, 타임아웃 2): 모든 판정 합산 10문제 후 Phase B 1회 인계', () => {
    const onAdvance = vi.fn((nextRound: number) => {
      beatRoundResolver.startNewRound(nextRound);
    });

    let receivedSnapshot: PhaseAResourceSnapshot | null = null;
    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      sessionLifecycle,
      resourceProvider: beatRoundResolver,
      onAdvanceToNextRound: onAdvance,
      onEnterBossClimax: (snap) => {
        receivedSnapshot = snap;
      },
      advanceDelayMs: 0,
    });

    // 5 정답, 3 오답, 2 타임아웃
    const sequence: Array<'correct' | 'wrong' | 'timeout'> = [
      'correct', 'wrong', 'correct', 'timeout', 'correct',
      'correct', 'wrong', 'wrong', 'correct', 'timeout',
    ];

    for (let i = 0; i < sequence.length; i++) {
      const roundId = i + 1;
      const status = sequence[i];
      if (status === 'correct') {
        beatRoundResolver.recordStarRating('Good', `note-${roundId}`);
      }
      stateMachine.changeState('ROUND_RESOLVE');
      const res = beatRoundResolver.resolveRound(status, roundId);
      controller.handleRoundSettled(res, { immediate: true });
    }

    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(controller.handoffCount).toBe(1);
    expect(receivedSnapshot).not.toBeNull();
    const snap = receivedSnapshot!;
    expect(snap.totalSettledQuestions).toBe(10);
    expect(snap.correctCount).toBe(5);
    expect(snap.wrongCount).toBe(3);
    expect(snap.timeoutCount).toBe(2);
    expect(snap.minionCount).toBe(8); // 3 + 5
    expect(snap.stardust).toBe(15); // 5 * Good(3)
  });

  it('10번째 문제에서 플레이어 HP가 0이 되면 BOSS_CLIMAX 0회 / GAMEOVER가 우선한다', () => {
    const onBossClimax = vi.fn();
    const onGameOver = vi.fn();

    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      sessionLifecycle,
      resourceProvider: beatRoundResolver,
      onEnterBossClimax: onBossClimax,
      onGameOver,
      advanceDelayMs: 0,
    });

    // 1~9 라운드 정답
    for (let r = 1; r <= 9; r++) {
      const res = beatRoundResolver.resolveRound('correct', r);
      controller.handleRoundSettled(res, { immediate: true });
    }

    // 10번째 라운드: 장판 피격 등으로 플레이어 HP 0 도달
    battle.applyHazardDamage(100);
    expect(battle.isAlive).toBe(false);

    stateMachine.changeState('ROUND_RESOLVE');
    const round10Res = beatRoundResolver.resolveRound('wrong', 10);
    expect(round10Res.playerDefeated).toBe(true);

    const decision = controller.handleRoundSettled(round10Res, { immediate: true });

    expect(decision.type).toBe('GAMEOVER');
    expect(stateMachine.currentState).toBe('GAMEOVER');
    expect(controller.hasEnteredBossClimax).toBe(false);
    expect(controller.handoffCount).toBe(0);
    expect(onBossClimax).not.toHaveBeenCalled();
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it('지연 전환 대기 중 메뉴 복귀 시 Phase B 인계가 취소되고 상태가 유지된다', () => {
    vi.useFakeTimers();

    const onBossClimax = vi.fn();
    const controller = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      sessionLifecycle,
      resourceProvider: beatRoundResolver,
      onEnterBossClimax: onBossClimax,
      advanceDelayMs: 800,
    });

    for (let r = 1; r <= 9; r++) {
      const res = beatRoundResolver.resolveRound('correct', r);
      controller.handleRoundSettled(res, { immediate: true });
    }

    // 10번째 라운드: 800ms 지연 인계 스케줄링
    const round10Res = beatRoundResolver.resolveRound('correct', 10);
    controller.handleRoundSettled(round10Res);

    expect(controller.hasEnteredBossClimax).toBe(false);

    // 500ms 후 메뉴 복귀
    vi.advanceTimersByTime(500);
    sessionLifecycle.endSession();
    controller.reset();
    stateMachine.changeState('MENU_MAIN');

    // 800ms 경과
    vi.advanceTimersByTime(500);

    expect(onBossClimax).not.toHaveBeenCalled();
    expect(controller.handoffCount).toBe(0);
    expect(stateMachine.currentState).toBe('MENU_MAIN');

    vi.useRealTimers();
  });
});
