/**
 * assault-recovery-clock-wiring.test.ts
 *
 * [BOSS-ASSAULT-REC-07 / #604] 입력 공통 활성시계·라운드 원점 정규화 단위 테스트
 *
 * 검증 목표:
 * 1. 서로 다른 절대 원점(큰 wall clock 오프셋)에서도 동일한 활성 입력은 동일한 판정 시각 산출.
 * 2. 지연 보정 정확히 1회 적용 (130ms 1회 보정; 이미 compensated된 입력에 대한 이중 차감 금지).
 * 3. 폴백(keyboard/touch) 입력에 대한 카메라 130ms 과보정 0건 (latencyMs = 0 유지).
 * 4. 동일 타임스탬프의 동시손/inputId batch 입력 정상 승인 및 동일 입력 중복 폐기.
 * 5. 라운드 원점(round origin) 포트 고정 및 Round 2 즉시 만료 0건 검증.
 * 6. 과거/이전 라운드/동결 stale 입력 정상 차단.
 * 7. 조우 deadline 직전 / 동일 시각 / 직후 입력 처리 순서 정확성 (동일 시각 입력 우선).
 * 8. AssaultSessionFactory 및 Round 1 -> Round 2 연계 시 원점 자동 고정 검증.
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultClockAdapter } from '../../src/core/AssaultClockAdapter.js';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';

function createMockBattleState(hp = 100) {
  return {
    hp,
    maxHp: 100,
    takeDamage: vi.fn(),
    applyHazardDamage: vi.fn(),
  };
}

function createMockSpeech() {
  return {
    speak: vi.fn(),
    status: 'idle',
    cancel: vi.fn(),
  };
}

describe('[BOSS-ASSAULT-REC-07 / #604] Common Assault Clock & Round Origin Normalization', () => {
  describe('1. 큰 wall clock 오프셋 독립성 (절대 원점 불변성)', () => {
    it('서로 다른 절대 원점(0ms vs 500,000,000ms)에서도 같은 활성 입력은 동일한 activeTimestampSeconds를 산출해야 한다', () => {
      const clockBaseZero = new AssaultClockAdapter({ bpm: 120 });
      const clockBaseLarge = new AssaultClockAdapter({ bpm: 120 });

      // clockBaseZero: 시작 0ms -> 1.0초 경과, engineTimestampMs = 1000
      clockBaseZero.advance(1.0, 1000);

      // clockBaseLarge: 시작 500,000,000ms -> 1.0초 경과, engineTimestampMs = 500,001,000
      clockBaseLarge.advance(1.0, 500001000);

      // 둘 다 현재 프레임에서 50ms 전에 발생한 카메라 입력
      const inputZero = clockBaseZero.normalizeInput({
        timestampMs: 950,
        source: 'camera',
      });
      const inputLarge = clockBaseLarge.normalizeInput({
        timestampMs: 500000950,
        source: 'camera',
      });

      expect(inputZero.accepted).toBe(true);
      expect(inputLarge.accepted).toBe(true);

      if (inputZero.accepted && inputLarge.accepted) {
        // activeSeconds: 1.0s.
        // timeAgoMs = (engineTimestampMs - compensatedTimestampMs)
        // inputZero: 1000 - (950 - 130 = 820) = 180ms ago -> 1.0 - 0.18 = 0.82s
        // inputLarge: 500001000 - (500000950 - 130 = 500000820) = 180ms ago -> 1.0 - 0.18 = 0.82s
        expect(inputZero.activeTimestampSeconds).toBeCloseTo(0.82, 5);
        expect(inputLarge.activeTimestampSeconds).toBeCloseTo(0.82, 5);
        expect(inputZero.activeTimestampSeconds).toBeCloseTo(inputLarge.activeTimestampSeconds, 5);
      }
    });
  });

  describe('2. 지연 보정 정확히 1회 적용 및 이중 차감 방지', () => {
    it('보정되지 않은 카메라 입력은 130ms 지연 보정이 1회 적용되어야 한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(2.0, 2000);

      const res = clock.normalizeInput({
        timestampMs: 2000,
        source: 'camera',
      });

      expect(res.accepted).toBe(true);
      if (res.accepted) {
        expect(res.rawTimestampMs).toBe(2000);
        expect(res.compensatedTimestampMs).toBe(1870); // 2000 - 130
        expect(res.latencyMs).toBe(130);
        expect(res.activeTimestampSeconds).toBeCloseTo(1.87, 5);
      }
    });

    it('이미 punchAdapter에서 compensatedTimestampMs가 계산된 입력은 130ms를 이중 차감하지 않아야 한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(2.0, 2000);

      // punchAdapter가 이미 130ms 차감하여 1870ms로 제공한 경우
      const res = clock.normalizeInput({
        timestampMs: 2000,
        compensatedTimestampMs: 1870,
        source: 'camera',
      });

      expect(res.accepted).toBe(true);
      if (res.accepted) {
        expect(res.rawTimestampMs).toBe(2000);
        // 이중 차감(1870 - 130 = 1740)되지 않고 1870 유지
        expect(res.compensatedTimestampMs).toBe(1870);
        expect(res.latencyMs).toBe(130);
        expect(res.activeTimestampSeconds).toBeCloseTo(1.87, 5);
      }
    });
  });

  describe('3. 폴백(keyboard/touch) 과보정 0건', () => {
    it('keyboard 및 touch 입력은 카메라 130ms 지연 보정이 적용되지 않아야 한다 (과보정 0건)', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(2.0, 2000);

      const keyRes = clock.normalizeInput({
        timestampMs: 2000,
        source: 'keyboard',
        hand: 'left',
      });

      expect(keyRes.accepted).toBe(true);
      if (keyRes.accepted) {
        expect(keyRes.rawTimestampMs).toBe(2000);
        expect(keyRes.compensatedTimestampMs).toBe(2000); // 130ms 차감 안 함
        expect(keyRes.latencyMs).toBe(0);
        expect(keyRes.activeTimestampSeconds).toBeCloseTo(2.0, 5);
      }

      const touchRes = clock.normalizeInput({
        timestampMs: 2050,
        source: 'touch',
        hand: 'right',
      });

      expect(touchRes.accepted).toBe(true);
      if (touchRes.accepted) {
        expect(touchRes.compensatedTimestampMs).toBe(2050);
        expect(touchRes.latencyMs).toBe(0);
      }
    });
  });

  describe('4. 동시손/inputId batch 보존 및 동일 중복 입력 거부', () => {
    it('동일 timestampMs라도 손(hand) 또는 inputId가 다른 동시 배치는 정상 승인되어야 한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(1.0, 1000);

      // 동일 프레임 1000ms에 양손 동시 입력
      const leftPunch = clock.normalizeInput({
        timestampMs: 1000,
        hand: 'left',
        inputId: 'punch_left_1',
      });
      const rightPunch = clock.normalizeInput({
        timestampMs: 1000,
        hand: 'right',
        inputId: 'punch_right_1',
      });

      expect(leftPunch.accepted).toBe(true);
      expect(rightPunch.accepted).toBe(true);
    });

    it('동일 timestampMs에 동일 손/동일 inputId인 중복 입력은 duplicate_timestamp로 거부되어야 한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(1.0, 1000);

      const first = clock.normalizeInput({
        timestampMs: 1000,
        hand: 'left',
        inputId: 'punch_left_1',
      });
      expect(first.accepted).toBe(true);

      const duplicate = clock.normalizeInput({
        timestampMs: 1000,
        hand: 'left',
        inputId: 'punch_left_1',
      });
      expect(duplicate.accepted).toBe(false);
      if (!duplicate.accepted) {
        expect(duplicate.reason).toBe('duplicate_timestamp');
      }
    });
  });

  describe('5. 라운드 원점(round origin) 포트 고정 및 Round 2 즉시 만료 0건', () => {
    it('라운드 2의 원점이 고정되면 라운드 2 시작 시점에 activeSeconds는 0으로 정규화되어 즉시 만료가 발생하지 않아야 한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });

      // Round 1 진행: 0초 -> 12초 경과
      clock.advance(12.0, 12000);
      expect(clock.activeSeconds).toBeCloseTo(12.0, 5);

      // Round 2 시작: 원점을 12.0초로 고정
      clock.setRoundOrigin(12.0, 'round_2');
      expect(clock.roundOriginSeconds).toBeCloseTo(12.0, 5);
      expect(clock.toRoundRelativeSeconds()).toBe(0.0);

      // Round 2 진행 1.5초 후
      clock.advance(1.5, 13500);
      expect(clock.activeSeconds).toBeCloseTo(13.5, 5);
      expect(clock.toRoundRelativeSeconds()).toBeCloseTo(1.5, 5);

      // Round 2용 RoundController에 toRoundRelativeSeconds 전달 시 조우 즉시 만료 0건 검증
      const round2Controller = new AssaultRoundController({
        sessionId: 'test_session',
        roundId: 'round_2',
        question: '3 + 4 = ?',
        plan: {
          bpm: 120,
          encounters: [
            {
              id: 'enc_1',
              kind: 'answer_pair',
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
              correctSide: 'left',
              leftNumber: 7,
              rightNumber: 8,
            } as any,
          ],
        },
      });

      // Round 2 시작 프레임 update: 상대 시각 0.0 전달
      round2Controller.update(clock.toRoundRelativeSeconds(12.0));
      expect(round2Controller.isCompleted).toBe(false);
      // 조우가 즉시 만료되지 않고 대기 중이어야 함
      const presentation = round2Controller.getPresentationSnapshot();
      expect(presentation.phase).toBe('throw_in');
    });
  });

  describe('6. 과거 / 이전 라운드 stale 입력 차단', () => {
    it('현재 라운드 원점보다 이전 시각의 입력은 stale_round_input으로 거부되어야 한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(15.0, 15000);
      clock.setRoundOrigin(15.0, 'round_2');

      // 라운드 2(원점 15.0초)에서 라운드 1 시점(10.0초, engineTimestampMs = 10000)의 stale 입력 도착
      const staleRes = clock.normalizeInput({
        timestampMs: 10000,
        source: 'camera',
        roundId: 'round_1',
      });

      expect(staleRes.accepted).toBe(false);
      if (!staleRes.accepted) {
        expect(staleRes.reason).toBe('stale_round_input');
      }
    });
  });

  describe('7. 조우 deadline 직전 / 동일 시각 / 직후 입력 처리 순서 정확성', () => {
    it('deadline과 동일 시각(t == deadline)일 때 입력이 deadline 만료(timeout)보다 우선 처리되어야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'test_session',
        roundId: 'round_1',
        question: '2 + 3 = ?',
        throwDurationSeconds: 1.0,
        config: { lateGraceMs: 170 },
        plan: {
          bpm: 120, // 1박 = 0.5초. minRead = 8박(4.0초). readingEndTime = 5.0초.
          encounters: [
            {
              id: 'enc_pair_01',
              kind: 'answer_pair',
              startBeat: 0, // 5.0초
              durationBeats: 4, // 도착 7.0초, lateGrace 170ms -> deadline 7.17초
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
              correctSide: 'left',
              leftNumber: 5,
              rightNumber: 6,
            } as any,
          ],
        },
      });

      // 5.0초까지 전진
      controller.update(5.0);
      expect(controller.phase).toBe('encounters');

      // deadline 정확히 동일 시각(7.17초)에 정답 펀치 제출
      controller.submitPunch('left', 7170, { activeSeconds: 7.17 });
      controller.update(7.17);

      const cmds = controller.drainSettlementCommands();
      // 타임아웃 피해가 아닌 정답 boss_negate 명령이 발행되어야 함
      expect(cmds.some((c) => c.effectType === 'boss_negate')).toBe(true);
      expect(cmds.some((c) => c.effectType === 'player_damage' && (c as any).reason === 'timeout')).toBe(false);
    });
  });

  describe('8. AssaultSessionFactory 연계 시 라운드 원점 고정', () => {
    it('createRoundController 호출 시 해당 라운드의 원점이 clock에 등록되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: [
          {
            id: 'q_seed_1',
            type: 'addition',
            operands: [1, 2],
            text: '1 + 2 = ?',
            answer: 3,
            correctAnswer: 3,
            level: 1,
          },
        ],
      });

      // 초기 상태: origin 0
      expect(session.clock.roundOriginSeconds).toBe(0);

      // Session 시간 14.0초 전진
      session.clock.advance(14.0, 14000);

      // 라운드 2 생성
      session.createRoundController('round_2', {
        id: 'q2',
        text: '5 + 5 = ?',
        correctAnswer: 10,
      });

      // round_2 생성 시점의 clock.activeSeconds(14.0)가 roundOrigin으로 자동 고정
      expect(session.clock.roundOriginSeconds).toBeCloseTo(14.0, 5);
      expect(session.clock.toRoundRelativeSeconds()).toBe(0.0);

      session.dispose();
    });
  });
});
