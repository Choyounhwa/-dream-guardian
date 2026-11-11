import { describe, it, expect, vi } from 'vitest';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { BattleState } from '../../src/game/BattleState.js';
import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../config/assault-loop.config.js';
import { createTestQuestionCandidate } from '../helpers/question-factory.js';
import type { RoundId } from '../../src/types/assault.js';

describe('Assault Loop Round 1 -> Round 2 Transition Acceptance', () => {
  it('Round 1 완료 후 session.lastEvaluation이 next_round로 설정되어 startNextRound가 정상 호출된다', () => {
    const mockQuestions = [
      createTestQuestionCandidate({ id: 'q1', questionText: '10 + 10 = ?', correctAnswer: 20 }),
      createTestQuestionCandidate({ id: 'q2', questionText: '20 + 20 = ?', correctAnswer: 40 }),
    ];

    const battleState = new BattleState();

    const session = AssaultSessionFactory.createSession({
      mode: 'boss_assault',
      questions: mockQuestions,
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      bpm: 120,
      battleState,
      speech: { speak: vi.fn(), cancel: vi.fn() },
    });

    const rc1 = session.createRoundController('round_01' as RoundId, mockQuestions[0]);

    // 36/40박 계획의 총 시간(18.0초 또는 20.0초)까지 시간 전진하여 라운드 1 완료
    const plan = session.getCurrentLoopPlan?.();
    const totalSec = plan?.totalSeconds ?? 18.0;

    rc1.update(totalSec, 0.016);
    expect(rc1.isCompleted).toBe(true);

    // [핵심 검증 1] 라운드 1 완료 후 session.lastEvaluation이 null이 아니어야 함!
    expect(session.lastEvaluation).not.toBeNull();
    expect(session.lastEvaluation?.intent).toBe('next_round');

    // [핵심 검증 2] startNextRound 호출 시 round_02 컨트롤러가 생성되어야 함
    const rc2 = session.startNextRound ? session.startNextRound() : null;
    expect(rc2).not.toBeNull();
    expect(rc2?.roundId).toBe('round_02');
    expect(rc2?.questionText).toBe('20 + 20 = ?');
  });

  it('2. AssaultSessionWireHelper.update(): 라운드 1 완료 프레임 이후 자동으로 round_02 컨트롤러로 전이된다', () => {
    const mockQuestions = [
      createTestQuestionCandidate({ id: 'q1', questionText: '10 + 10 = ?', correctAnswer: 20 }),
      createTestQuestionCandidate({ id: 'q2', questionText: '20 + 20 = ?', correctAnswer: 40 }),
    ];

    const battleState = new BattleState();

    const host = {
      battle: battleState,
      boss: { hp: 10, maxHp: 10, reset: vi.fn(), takeDamage: vi.fn() },
      sessionContext: { setMode: vi.fn(), setActive: vi.fn() },
      sessionLifecycle: {
        setActiveAssaultSessionToken: vi.fn(),
        setTestSession: vi.fn(),
        claimResultTransition: vi.fn().mockReturnValue(true),
        handleAssaultIntent: vi.fn().mockReturnValue(true),
        isValidAssaultToken: vi.fn().mockReturnValue(true),
        activeAssaultSessionToken: 'sess_test',
      },
      motionIntentBus: { setPhase: vi.fn() },
      stateMachine: {
        canTransition: vi.fn().mockReturnValue(true),
        changeState: vi.fn(),
      },
      sfx: { play: vi.fn() },
    } as any;

    const wireHelper = new AssaultSessionWireHelper(host);
    const session: any = wireHelper.assembleAssaultSession({
      mode: 'boss_assault',
      questions: mockQuestions,
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      bpm: 120,
      battleState,
      speech: { speak: vi.fn(), cancel: vi.fn() },
    });

    const rc1 = wireHelper.createRoundController(session, 'round_01' as RoundId, mockQuestions[0]);
    expect(session.activeRoundController?.roundId).toBe('round_01');

    // 라운드 1 완료 시점까지 시간 전진
    const plan = session.getCurrentLoopPlan?.();
    const totalSec = plan?.totalSeconds ?? 18.0;

    rc1.update(totalSec, 0.016);
    expect(rc1.isCompleted).toBe(true);

    // 다음 게임 루프 프레임 업데이트 실행
    session.update(0.016, {} as any);

    // [핵심 검증 3] update 루프에서 자동으로 라운드 2로 전이되어야 함!
    expect(session.activeRoundController?.roundId).toBe('round_02');
    expect(session.activeRoundController?.isCompleted).toBe(false);
    expect(session.activeRoundController?.questionText).toBe('20 + 20 = ?');
  });

  it('3. 연속 다중 라운드 루프: Round 1 -> Round 2 -> Round 3 연속 자동 전이 검증', () => {
    const mockQuestions = [
      createTestQuestionCandidate({ id: 'q1', questionText: '1 + 1 = ?', correctAnswer: 2 }),
      createTestQuestionCandidate({ id: 'q2', questionText: '2 + 2 = ?', correctAnswer: 4 }),
      createTestQuestionCandidate({ id: 'q3', questionText: '3 + 3 = ?', correctAnswer: 6 }),
    ];

    const battleState = new BattleState();

    const host = {
      battle: battleState,
      boss: { hp: 10, maxHp: 10, reset: vi.fn(), takeDamage: vi.fn() },
      sessionContext: { setMode: vi.fn(), setActive: vi.fn() },
      sessionLifecycle: {
        setActiveAssaultSessionToken: vi.fn(),
        setTestSession: vi.fn(),
        claimResultTransition: vi.fn().mockReturnValue(true),
        handleAssaultIntent: vi.fn().mockReturnValue(true),
        isValidAssaultToken: vi.fn().mockReturnValue(true),
        activeAssaultSessionToken: 'sess_test',
      },
      motionIntentBus: { setPhase: vi.fn() },
      stateMachine: {
        canTransition: vi.fn().mockReturnValue(true),
        changeState: vi.fn(),
      },
      sfx: { play: vi.fn() },
    } as any;

    const wireHelper = new AssaultSessionWireHelper(host);
    const session: any = wireHelper.assembleAssaultSession({
      mode: 'boss_assault',
      questions: mockQuestions,
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      bpm: 120,
      battleState,
      speech: { speak: vi.fn(), cancel: vi.fn() },
    });

    wireHelper.createRoundController(session, 'round_01' as RoundId, mockQuestions[0]);
    expect(session.activeRoundController?.roundId).toBe('round_01');

    // ─── Round 1 완료 및 전이 ───
    const plan1 = session.getCurrentLoopPlan?.();
    session.activeRoundController?.update(plan1?.totalSeconds ?? 18.0, 0.016);
    expect(session.activeRoundController?.isCompleted).toBe(true);

    session.update(0.016, {} as any);
    expect(session.activeRoundController?.roundId).toBe('round_02');
    expect(session.activeRoundController?.questionText).toBe('2 + 2 = ?');
    expect(session.activeRoundController?.isCompleted).toBe(false);

    // ─── Round 2 완료 및 전이 ───
    battleState.reset();
    const plan2 = session.getCurrentLoopPlan?.();
    session.activeRoundController?.update(plan2?.totalSeconds ?? 18.0, 0.016);
    expect(session.activeRoundController?.isCompleted).toBe(true);

    session.update(0.016, {} as any);
    expect(session.activeRoundController?.roundId).toBe('round_03');
    expect(session.activeRoundController?.questionText).toBe('3 + 3 = ?');
    expect(session.activeRoundController?.isCompleted).toBe(false);
  });
});
