import { describe, it, expect } from 'vitest';
import {
  reducePairState,
  createInitialPairState,
  type AssaultPairPlan,
  type AssaultPairJudgeConfig,
  type AssaultPairAction,
} from '../../src/game/assault/AssaultPairJudge.js';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
} from '../../src/game/assault/AssaultRoundController.js';

describe('[BUG-ASSAULT-003 / #671] 오답 피해 도착 시점 지연 정산 및 동시입력 롤백 충돌 방지', () => {
  const defaultPlan: AssaultPairPlan = {
    sessionId: 'session_bug_003',
    roundId: 'round_01',
    attackId: 'attack_pair_01',
    pairId: 'pair_01',
    correctSide: 'left',
    arrivalMs: 2000,
    windowStartMs: 0,
  };

  const judgeConfig: Required<AssaultPairJudgeConfig> = {
    lateGraceMs: 170,
    simultaneousToleranceMs: 50,
    rhythmWindows: {
      Perfect: 50,
      Good: 120,
      Late: 170,
    },
  };

  const sampleQuestion: AssaultRoundQuestionData = {
    id: 'q_bug_003',
    text: '2 + 3 = ?',
    answer: '5',
    wrongAnswer: '6',
    choices: ['5', '6'],
    correctSide: 'left',
    type: 'add',
    level: 1,
    subLevel: 1,
  };

  const sampleRoundPlan: any = {
    bpm: 120,
    encounters: [
      {
        id: 'attack_pair_01',
        kind: 'answer_pair',
        startBeat: 0,
        durationBeats: 4, // 120bpm -> 2.0초
        pairId: 'pair_01',
        correctAnswerSide: 'left',
        interactionProfileId: 'interaction_punch_default',
        visualProfileId: 'visual_pair_default',
      },
    ],
  };

  describe('1. AssaultPairJudge Reducer 순수 판정: 오답 즉시 피해 배제 및 도착 시점 정산', () => {
    it('오답 펀치 입력 시 wrong_locked로 잠기지만 player_damage 명령은 즉시 발행되지 않아야 한다 (A06)', () => {
      const state = createInitialPairState();
      const wrongPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'right', // correctSide는 left이므로 right는 오답
        timestampMs: 1850, // arrivalMs(2000) 150ms 이전 (EarlyMiss 170ms 유효창 내)
        inputId: 'punch_wrong_01',
      };

      const result = reducePairState(state, wrongPunch, judgeConfig, defaultPlan);

      expect(result.state.status).toBe('wrong_locked');
      expect(result.state.lockedChoice).toBe('right');
      expect(result.state.isLocked).toBe(true);
      expect(result.state.isCorrect).toBe(false);
      expect(result.state.isSettled).toBe(false);
      // 핵심 버그 수정: 입력 순간 명령 0건
      expect(result.commands).toHaveLength(0);
    });

    it('wrong_locked 상태에서 arrival 액션 또는 arrivalMs 도달 시 player_damage 1건이 발행되어야 한다', () => {
      const state = createInitialPairState();
      const wrongPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1850,
        inputId: 'punch_wrong_01',
      };
      const lockedRes = reducePairState(state, wrongPunch, judgeConfig, defaultPlan);
      expect(lockedRes.commands).toHaveLength(0);

      // 도착 경계(arrivalMs: 2000) 도달
      const arrivalAction: AssaultPairAction = {
        type: 'arrival',
        timestampMs: 2000,
      };
      const arrivalRes = reducePairState(lockedRes.state, arrivalAction, judgeConfig, defaultPlan);

      expect(arrivalRes.state.status).toBe('wrong_locked');
      expect(arrivalRes.state.isSettled).toBe(true);
      expect(arrivalRes.commands).toHaveLength(1);
      expect(arrivalRes.commands[0].effectType).toBe('player_damage');
      expect(arrivalRes.commands[0].resultKind).toBe('miss');
      expect(arrivalRes.commands[0].idempotencyKey).toBe(
        `${defaultPlan.sessionId}:${defaultPlan.attackId}:player_damage`
      );

      // 이후 추가 tick 시 중복 피해 0건
      const postTick: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2100,
      };
      const postRes = reducePairState(arrivalRes.state, postTick, judgeConfig, defaultPlan);
      expect(postRes.commands).toHaveLength(0);
    });

    it('오답 입력 후 허용 오차(50ms) 이내 반대 손 유입 시 롤백되고 정답 입력 시 피해 0건, 정답 1건만 발행되어야 한다 (A10)', () => {
      const state = createInitialPairState();
      // 1. 오답 입력
      const wrongPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1850,
        inputId: 'p_wrong',
      };
      const wrongRes = reducePairState(state, wrongPunch, judgeConfig, defaultPlan);
      expect(wrongRes.state.status).toBe('wrong_locked');
      expect(wrongRes.commands).toHaveLength(0);

      // 2. 30ms 후 반대 손 유입 -> conflict 롤백
      const rollbackPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1880,
        inputId: 'p_opp',
      };
      const rolledBack = reducePairState(wrongRes.state, rollbackPunch, judgeConfig, defaultPlan);
      expect(rolledBack.state.status).toBe('pending');
      expect(rolledBack.state.isLocked).toBe(false);
      expect(rolledBack.commands).toHaveLength(0);

      // 3. 재시도로 정답(left) 펀치 입력
      const correctPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1950,
        inputId: 'p_correct',
      };
      const correctRes = reducePairState(rolledBack.state, correctPunch, judgeConfig, defaultPlan);
      expect(correctRes.state.status).toBe('correct');
      expect(correctRes.commands).toHaveLength(1);
      expect(correctRes.commands[0].effectType).toBe('boss_negate');

      // 4. 이후 arrival 도달 시 player_damage는 전혀 발생하지 않아야 함
      const arrivalRes = reducePairState(correctRes.state, { type: 'arrival', timestampMs: 2000 }, judgeConfig, defaultPlan);
      expect(arrivalRes.commands).toHaveLength(0);
    });
  });

  describe('2. AssaultRoundController 수명주기 통합 검증 (A05, A06, A07, A10)', () => {
    it('A06: 오답 펀치 입력 시점에는 피해 명령이 0건이고, arrival 시점에 정확히 1회 발행되어야 한다', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'session_bug_003',
        roundId: 'round_01',
        question: sampleQuestion,
        plan: sampleRoundPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime; // 1.0 + readingDuration
      // 조우 시작: readingEnd (0 beat)
      // arrival: readingEnd + 2.0s (4 beats at 120bpm)
      const punchTime = readingEnd + 1.85; // 도착 0.15초 전 (EarlyMiss 170ms 유효창 내)

      controller.update(punchTime);
      controller.submitPunch('right', Math.round(punchTime * 1000), {
        activeSeconds: punchTime,
        inputId: 'punch_wrong_round',
      });
      controller.update(punchTime + 0.05);

      // 핵심 검증 1: 입력 순간에는 피해 명령이 전혀 없어야 함!
      expect(commands).toHaveLength(0);

      // 도착 직전(arrival - 0.05s)까지 업데이트해도 피해 명령 0건
      const arrivalTime = readingEnd + 2.0;
      controller.update(arrivalTime - 0.05);
      expect(commands).toHaveLength(0);

      // 도착 시점(arrivalTime) 업데이트 -> 정확히 1건의 player_damage 발행
      controller.update(arrivalTime);
      expect(commands).toHaveLength(1);
      expect(commands[0].effectType).toBe('player_damage');
      expect(commands[0].resultKind).toBe('miss');

      // 마감 시점 및 라운드 종료까지 추가 피해 0건
      controller.update(arrivalTime + 1.0);
      expect(commands).toHaveLength(1);
    });

    it('A10: 오답 후 동시 입력 롤백 -> 정답 입력 시 피해 0건, 정답(boss_negate) 1건만 발행되어야 한다', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'session_bug_003',
        roundId: 'round_01',
        question: sampleQuestion,
        plan: sampleRoundPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
        config: {
          simultaneousPunchGraceMs: 50,
        } as any,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const baseT = readingEnd + 1.85; // 도착 0.15초 전 (EarlyMiss 170ms 유효창 내)
      controller.update(baseT);

      const baseMs = Math.round(baseT * 1000);
      // 1. 오른손(오답) 펀치
      controller.submitPunch('right', baseMs, { activeSeconds: baseT, inputId: 'p_right' });
      // 2. 20ms 후 왼손 펀치 (동시 입력 발생 -> conflict 롤백)
      controller.submitPunch('left', baseMs + 20, { activeSeconds: baseT + 0.02, inputId: 'p_left' });
      controller.update(baseT + 0.03);

      // 피해 명령 0건
      expect(commands).toHaveLength(0);

      // 3. 재시도로 왼손(정답) 단독 펀치
      controller.submitPunch('left', baseMs + 100, { activeSeconds: baseT + 0.1, inputId: 'p_retry_left' });
      controller.update(baseT + 0.11);

      // 정답 boss_negate 1건 발행
      expect(commands).toHaveLength(1);
      expect(commands[0].effectType).toBe('boss_negate');

      // 4. 도착 및 마감 통과
      const arrivalTime = readingEnd + 2.0;
      controller.update(arrivalTime + 0.5);

      // 피해 명령 추가 없이 오직 boss_negate 1건만 유지
      const damageCmds = commands.filter((c) => c.effectType === 'player_damage');
      const negateCmds = commands.filter((c) => c.effectType === 'boss_negate');
      expect(damageCmds).toHaveLength(0);
      expect(negateCmds).toHaveLength(1);
    });

    it('A07: 미선택(timeout) 시 마감(deadline) 시점에 player_damage 정확히 1건 발행되어야 한다', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'session_bug_003',
        roundId: 'round_01',
        question: sampleQuestion,
        plan: sampleRoundPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const arrivalTime = readingEnd + 2.0;
      // 도착 시점까지 입력 없으면 아직 timeout 정산 전
      controller.update(arrivalTime);
      expect(commands).toHaveLength(0);

      // 마감(deadline = arrival + 0.17s) 통과
      controller.update(arrivalTime + 0.2);
      expect(commands).toHaveLength(1);
      expect(commands[0].effectType).toBe('player_damage');
      expect(commands[0].resultKind).toBe('timeout');
    });

    it('A05: 정답 타격 시 boss_negate 1건 발행 및 도착/마감 시점에 피해 0건이어야 한다', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'session_bug_003',
        roundId: 'round_01',
        question: sampleQuestion,
        plan: sampleRoundPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const punchTime = readingEnd + 1.9; // 도착 0.1초 전 (EarlyMiss 170ms 유효창 내)
      controller.update(punchTime);

      controller.submitPunch('left', Math.round(punchTime * 1000), {
        activeSeconds: punchTime,
        inputId: 'punch_correct_round',
      });
      controller.update(punchTime + 0.05);

      expect(commands).toHaveLength(1);
      expect(commands[0].effectType).toBe('boss_negate');

      // 도착 및 마감 통과
      const arrivalTime = readingEnd + 2.0;
      controller.update(arrivalTime + 0.5);

      // 여전히 피해 0건, 정답 1건만 유지
      const damageCmds = commands.filter((c) => c.effectType === 'player_damage');
      expect(damageCmds).toHaveLength(0);
      expect(commands).toHaveLength(1);
    });
  });
});
