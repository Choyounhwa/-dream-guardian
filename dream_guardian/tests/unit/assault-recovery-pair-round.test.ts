/**
 * assault-recovery-pair-round.test.ts
 *
 * [BOSS-ASSAULT-REC-06 / #591] 답 쌍 조우 판정·도착 생명주기 복구 단위 테스트
 *
 * 검증 목표:
 * 1. answer_pair 조우에서 correctSide가 'right'인 경우 우측 펀치 시 boss_negate 정답 판정 (left 무조건 폴백 제거).
 * 2. correctSide 또는 pair 정의가 누락된 경우 left로 임의 간주하지 않고 명시적 예외 발생.
 * 3. 정답 판정 시 즉시 boss_negate 명령이 발행되고 이후 도착(arrival) 및 마감(deadline) 시점에 추가 피해나 타임아웃 0건.
 * 4. 오답 판정 시 player_damage(wrong_answer) 1회 발행 후 wrong_locked 상태가 되며, 이후 반대 손 입력이나 도착/마감 시점에 중복 피해 0건.
 * 5. 미선택 시 arrival 시각에는 피해가 발생하지 않고, lateGrace 마감(deadline) 초과 시점에 timeout 피해 1건 정확히 발행.
 * 6. 양손 동시 타격(simultaneous_tolerance 이내) 시 단일 손 잠금이 롤백되어 conflict 상태로 보류되고, 마감 전 재시도가 허용된다.
 * 7. inputId 멱등성: 동일 inputId 중복 제출 시 무시.
 */

import { describe, it, expect } from 'vitest';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
} from '../../src/game/assault/AssaultRoundController.js';

describe('[BOSS-ASSAULT-REC-06 / #591] Pair Encounter & Arrival Lifecycle in Round', () => {
  // 120 BPM: 1박 = 0.5초.
  // throwDurationSeconds = 1.0s.
  // minReadSeconds = 4.0s (8박). readingEndTime = 1.0 + 4.0 = 5.0s.
  // Encounter 0: startBeat = 0 (5.0s), durationBeats = 4 (도착 7.0s), lateGraceMs = 170ms (마감 7.17s)
  const createPlanWithCorrectSide = (correctSide?: 'left' | 'right') => ({
    bpm: 120,
    encounters: [
      {
        id: 'enc_pair_01',
        kind: 'answer_pair' as const,
        startBeat: 0,
        durationBeats: 4,
        index: 0,
        launchBeat: 0,
        windowStartBeat: 0,
        windowEndBeat: 4,
        impactBeat: 4,
        arrivalBeat: 4,
        retractDeadlineBeat: 4,
        recoveryBeat: 4,
        launchSeconds: 0,
        startSeconds: 0,
        windowStartSeconds: 0,
        windowEndSeconds: 2.0,
        impactSeconds: 2.0,
        arrivalSeconds: 2.0,
        retractDeadlineSeconds: 2.0,
        recoverySeconds: 2.0,
        durationSeconds: 2.0,
        gapFromPreviousBeats: 0,
        gapFromPreviousSeconds: 0,
        interactionProfileId: 'profile_punch_default',
        visualProfileId: 'bullet_choice_basic',
        pairId: 'pair_01',
        correctSide,
      },
    ],
  });

  const question: AssaultRoundQuestionData = {
    id: 'q_test_1',
    text: '2 * 3 = ?',
    minReadSeconds: 4.0,
  };

  describe('1. 실제 정답 방향(correctSide) 소비 및 left 무조건 폴백 제거', () => {
    it('correctSide가 right일 때 오른손 펀치가 정답(boss_negate)이어야 한다 (left 무조건 폴백 금지)', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: createPlanWithCorrectSide('right'),
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      // 조우 시작 이후 (도착 전)
      const encounterMid = readingEnd + 1.0;
      controller.update(encounterMid);

      // 오른손 펀치 제출
      controller.submitPunch('right', Math.round(encounterMid * 1000), {
        activeSeconds: encounterMid,
        inputId: 'p_right_1',
      });
      controller.update(encounterMid + 0.05);

      // 정답 boss_negate 1건 발행되어야 함
      expect(commands.length).toBe(1);
      expect(commands[0].effectType).toBe('boss_negate');
      expect(commands[0].target).toBe('boss');
    });

    it('encounter 및 question에 correctSide가 전혀 정의되지 않은 경우 left로 임의 간주하지 않고 에러를 발생시켜야 한다 (strictCorrectSide)', () => {
      expect(() => {
        new AssaultRoundController({
          sessionId: 'sess_1',
          roundId: 'round_1',
          question,
          plan: createPlanWithCorrectSide(undefined), // correctSide 없음
          bpm: 120,
          throwDurationSeconds: 1.0,
          strictCorrectSide: true,
        } as any);
      }).toThrowError(/correctSide/);
    });
  });

  describe('2. 정답/오답/미선택 도착 및 마감 생명주기', () => {
    it('정답 타격 후 arrival 및 deadline 경과 시 추가 피해나 타임아웃 0건', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: createPlanWithCorrectSide('left'),
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const punchTime = readingEnd + 1.0;
      controller.update(punchTime);
      controller.submitPunch('left', Math.round(punchTime * 1000), { activeSeconds: punchTime });
      controller.update(punchTime + 0.1);

      expect(commands.length).toBe(1);
      expect(commands[0].effectType).toBe('boss_negate');

      // arrival (readingEnd + 2.0s), deadline (readingEnd + 2.17s), 이후 경과
      controller.update(readingEnd + 2.0);
      controller.update(readingEnd + 2.2);
      controller.update(readingEnd + 3.0);

      // 추가 피해나 timeout이 일체 없어야 함 (명령 수 1건 유지)
      expect(commands.length).toBe(1);
    });

    it('오답 타격 후 wrong_locked 상태가 되며, 반대 손 입력이나 deadline 시 중복 피해 0건', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: createPlanWithCorrectSide('left'), // left가 정답
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const punchTime = readingEnd + 1.0;
      controller.update(punchTime);
      controller.submitPunch('right', Math.round(punchTime * 1000), { activeSeconds: punchTime, inputId: 'p_wrong' });
      controller.update(punchTime + 0.1);

      // 오답 피해 1건 발행
      expect(commands.length).toBe(1);
      expect(commands[0].effectType).toBe('player_damage');
      expect(commands[0].resultKind).toBe('miss');

      // 반대 손(정답 손) 펀치 시도 -> wrong_locked 상태이므로 무시
      controller.submitPunch('left', Math.round((punchTime + 0.5) * 1000), {
        activeSeconds: punchTime + 0.5,
        inputId: 'p_late_left',
      });
      controller.update(punchTime + 0.6);
      expect(commands.length).toBe(1);

      // deadline 초과 -> 추가 timeout 중복 발행 0건
      controller.update(readingEnd + 2.5);
      expect(commands.length).toBe(1);
    });

    it('미선택 시 arrival에는 피해가 없고, deadline 초과 시점에 timeout 피해 1건 발행', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: createPlanWithCorrectSide('left'),
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const arrival = readingEnd + 2.0;
      const deadline = arrival + 0.170;

      // 조우 진행 중 (입력 없음)
      controller.update(readingEnd);
      controller.update(arrival - 0.1);
      expect(commands.length).toBe(0);

      // arrival (시각 도착): 아직 lateGrace 유예(170ms) 구간이므로 timeout 발생하지 않음
      controller.update(arrival);
      expect(commands.length).toBe(0);

      // deadline 직전: 여전히 피해 0건
      controller.update(deadline - 0.01);
      expect(commands.length).toBe(0);

      // deadline 초과: timeout 피해 1건 발생
      controller.update(deadline + 0.05);
      expect(commands.length).toBe(1);
      expect(commands[0].effectType).toBe('player_damage');
      expect(commands[0].resultKind).toBe('timeout');

      // 이후 시간 경과 시 추가 피해 0건
      controller.update(deadline + 1.0);
      expect(commands.length).toBe(1);
    });
  });

  describe('3. 양손 동시 입력(보류/재시도) 및 inputId 멱등성', () => {
    it('양손 펀치가 동시 타격 허용차(50ms) 이내에 유입되면 잠금이 롤백(conflict)되어 재시도할 수 있어야 한다', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: createPlanWithCorrectSide('left'),
        bpm: 120,
        throwDurationSeconds: 1.0,
        config: {
          simultaneousPunchGraceMs: 50,
        } as any,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const baseT = readingEnd + 0.5;
      controller.update(baseT);

      const baseMs = Math.round(baseT * 1000);
      // 오른손 펀치 (오답 잠금 유도)
      controller.submitPunch('right', baseMs, { activeSeconds: baseT, inputId: 'p_right' });
      // 20ms 후 왼손 펀치 (동시 입력 발생 -> conflict 롤백)
      controller.submitPunch('left', baseMs + 20, { activeSeconds: baseT + 0.02, inputId: 'p_left' });
      controller.update(baseT + 0.03);

      // 양손 충돌로 보류되었으므로 오답 정산이 확정되지 않고 pending 상태로 롤백
      // 200ms 후 재시도로 왼손(정답) 단독 펀치
      controller.submitPunch('left', baseMs + 200, { activeSeconds: baseT + 0.2, inputId: 'p_retry_left' });
      controller.update(baseT + 0.21);

      // 최종적으로 정답 boss_negate 명령이 발행되어야 함
      const bossNegate = commands.find((c) => c.effectType === 'boss_negate');
      expect(bossNegate).toBeDefined();
    });

    it('동일 inputId의 중복 펀치 입력은 무시되어야 한다', () => {
      const commands: any[] = [];
      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: createPlanWithCorrectSide('left'),
        bpm: 120,
        throwDurationSeconds: 1.0,
        onSettlementCommand: (cmd) => commands.push(cmd),
      });

      const readingEnd = controller.readingEndTime;
      const punchTime = readingEnd + 0.5;
      controller.update(punchTime);
      controller.submitPunch('left', Math.round(punchTime * 1000), { activeSeconds: punchTime, inputId: 'same_input_id' });
      controller.submitPunch('left', Math.round(punchTime * 1000), { activeSeconds: punchTime, inputId: 'same_input_id' }); // 중복
      controller.update(punchTime + 0.1);

      expect(commands.length).toBe(1);
    });
  });
});
