/**
 * [BOSS-ASSAULT-REC-08] #595
 * 공격 재개 준비박 판정 차단 검증·복구 단위 테스트
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
} from '../../src/game/assault/AssaultRoundController';
import type {
  AssaultEncounterDef,
  AssaultSettlementCommand,
} from '../../src/types/assault';
import type { AssaultSettlementReceipt } from '../../src/game/assault/AssaultSettlement';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config';

describe('[BOSS-ASSAULT-REC-08] #595: 공격 재개 준비박 판정 차단 검증·복구', () => {
  const defaultQuestion: AssaultRoundQuestionData = {
    id: 'q_rec08_01',
    text: '5 + 3 = ?',
  };

  const samplePairEncounters: readonly AssaultEncounterDef[] = Object.freeze([
    {
      id: 'enc_pair_0',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4, // 120BPM 기준 2.0s
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_0',
      correctAnswerSide: 'left',
    } as AssaultEncounterDef & { correctAnswerSide: string },
    {
      id: 'enc_pair_1',
      kind: 'answer_pair',
      startBeat: 6,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_1',
      correctAnswerSide: 'right',
    } as AssaultEncounterDef & { correctAnswerSide: string },
  ]);

  const sampleSquatEncounters: readonly AssaultEncounterDef[] = Object.freeze([
    {
      id: 'enc_squat_0',
      kind: 'squat',
      startBeat: 0,
      durationBeats: 4, // 120BPM 기준 2.0s
      interactionProfileId: 'profile_squat_default',
      visualProfileId: 'hazard_sweep_low',
    },
  ]);

  let collectedCommands: AssaultSettlementCommand[];

  beforeEach(() => {
    collectedCommands = [];
  });

  const createController = (options?: {
    encounters?: readonly AssaultEncounterDef[];
    resumeReadyBeats?: number;
    throwDurationSeconds?: number;
    disableEarlyMiss?: boolean;
  }) => {
    return new AssaultRoundController({
      sessionId: 'sess_rec08',
      roundId: 'round_rec08',
      question: defaultQuestion,
      plan: {
        encounters: (options?.encounters ?? samplePairEncounters) as AssaultEncounterDef[],
      },
      bpm: 120, // 1박 = 0.5초
      throwDurationSeconds: options?.throwDurationSeconds ?? 1.0,
      config: {
        resumeReadyBeats: options?.resumeReadyBeats ?? 1, // 1박 = 0.5초 유예
        ...(options?.disableEarlyMiss
          ? { rhythmWindows: { ...DEFAULT_ASSAULT_CONFIG.rhythmWindows, EarlyMiss: null } }
          : {}),
      },
      onSettlementCommand: (cmd) => {
        collectedCommands.push(cmd);
      },
    });
  };

  describe('1. 준비박 전/직전/동일/직후 입력 차단 경계값 및 피해·성공 0건 검증', () => {
    it('재개 직후 준비 1박(0.5초) 동안의 입력은 무시/차단되어 성공 및 피해 명령이 0건이어야 한다', () => {
      // 준비박 만료 경계(6.3s)는 재개 후 도착(8.3s)보다 항상 durationBeats(2.0s) 앞서므로 EarlyMiss(170ms, #745)와 양립 불가.
      // 준비박 차단 경계값 검증 의도 보존을 위해 이 테스트에 한해 EarlyMiss를 비활성화한다.
      const controller = createController({ disableEarlyMiss: true });
      const readingEnd = controller.readingEndTime; // 1.0 + 4.0 = 5.0s

      // 공격 0 시작: 5.0s, 원래 arrival: 7.0s
      controller.update(readingEnd);
      controller.update(readingEnd + 0.8); // 5.8s 시점 진행 중

      // 일시정지 (5.8s)
      controller.pause('test_pause');
      expect(controller.isPaused).toBe(true);

      // pause 중 입력 시도 -> 폐기되어야 함
      controller.submitPunch('left', 5800, { activeSeconds: 5.8, inputId: 'punch_during_pause' });
      expect(collectedCommands.length).toBe(0);

      // 재개 (5.8s): resumeReadyBeats: 1 -> 0.5s 준비박 (5.8s ~ 6.3s)
      controller.resume();
      expect(controller.isPaused).toBe(false);

      // 준비박 시작 시점(5.8s) 입력 -> 차단되어야 함
      controller.submitPunch('left', 5800, { activeSeconds: 5.8, inputId: 'punch_at_resume_start' });
      controller.update(5.8);
      expect(collectedCommands.length).toBe(0);

      // 준비박 중간 시점(6.0s) 오답 입력 -> 차단되어 오답 피해 0건 보장
      controller.submitPunch('right', 6000, { activeSeconds: 6.0, inputId: 'punch_ready_mid_wrong' });
      controller.update(6.0);
      expect(collectedCommands.length).toBe(0);

      // 준비박 중간 시점(6.1s) 정답 입력 -> 차단되어 조기 성공 0건 보장
      controller.submitPunch('left', 6100, { activeSeconds: 6.1, inputId: 'punch_ready_mid_correct' });
      controller.update(6.1);
      expect(collectedCommands.length).toBe(0);

      // 준비박 종료 직전(6.299s) 정답 입력 -> 차단
      controller.submitPunch('left', 6299, { activeSeconds: 6.299, inputId: 'punch_ready_just_before' });
      controller.update(6.299);
      expect(collectedCommands.length).toBe(0);

      // 준비박 만료 경계(6.3s) 정답 입력 -> 정상 판정 재개되어 성공 명령(boss_negate) 1건 발행
      controller.submitPunch('left', 6300, { activeSeconds: 6.3, inputId: 'punch_ready_boundary' });
      controller.update(6.3);
      expect(collectedCommands.length).toBe(1);
      expect(collectedCommands[0].effectType).toBe('boss_negate');
    });

    it('준비박 경과 직후(6.4s) 정상 입력 시 공격이 정상 판정되어야 한다', () => {
      const controller = createController();
      const readingEnd = controller.readingEndTime; // 5.0s

      controller.update(readingEnd);
      controller.update(5.8);
      controller.pause();
      controller.resume(); // ready until 6.3s

      // 준비 시간 경과 후, 재개 후 도착(5.8 + 2.0 + 0.5 = 8.3s) 100ms 전(8.2s, EarlyMiss 170ms 유효창 내) 정답 타격
      controller.update(6.4);
      controller.update(8.2);
      controller.submitPunch('left', 8200, { activeSeconds: 8.2, inputId: 'punch_post_ready' });
      controller.update(8.21);

      expect(collectedCommands.length).toBe(1);
      expect(collectedCommands[0].effectType).toBe('boss_negate');
    });
  });

  describe('2. 스쿼트 조우 준비박 차단 및 회피 판정 재개', () => {
    it('스쿼트 공격 도중 재개 시 준비박 동안 회피 입력이 차단되고 경과 후 정상 회피되어야 한다', () => {
      const controller = createController({
        encounters: sampleSquatEncounters,
      });
      const readingEnd = controller.readingEndTime; // 5.0s

      controller.update(readingEnd);
      controller.update(5.8);

      controller.pause();
      controller.resume(); // arrival: 5.8 + 2.0 + 0.5 = 8.3s, ready until 6.3s

      // 준비박 중(6.0s) ducking 입력 -> 차단되어 조기 evade 성공 0건
      controller.submitSquat('ducking', 6000, { activeSeconds: 6.0 });
      controller.update(6.0);
      expect(collectedCommands.length).toBe(0);

      // 준비박 경과 후(6.5s) ducking 유지
      controller.submitSquat('ducking', 6500, { activeSeconds: 6.5 });
      controller.update(6.5);

      // 새 도착 시점(8.3s)까지 유지
      controller.submitSquat('ducking', 8300, { activeSeconds: 8.3 });
      controller.update(8.3);

      expect(collectedCommands.length).toBe(1);
      expect(collectedCommands[0].effectType).toBe('evade_success');
      expect(collectedCommands[0].resultKind).toBe('evaded');
    });
  });

  describe('3. 이미 확정·적용된 결과(정답/오답/피해) 후 pause/resume 시 중복0 검증', () => {
    it('정답 확정 후 남은 arrival 대기 중 pause/resume 시 기존 결과 및 영수증이 중복되지 않아야 한다', () => {
      const controller = createController();
      const readingEnd = controller.readingEndTime; // 5.0s

      controller.update(readingEnd);
      controller.update(5.5);

      // 6.85s(도착 7.0s 150ms 전, EarlyMiss 170ms 유효창 내)에 정답 타격 성공
      controller.update(6.85);
      controller.submitPunch('left', 6850, { activeSeconds: 6.85, inputId: 'punch_correct_early' });
      controller.update(6.86);
      expect(collectedCommands.length).toBe(1);
      expect(collectedCommands[0].effectType).toBe('boss_negate');

      // 정상 정산 영수증 기록
      const receipt: AssaultSettlementReceipt = {
        receiptId: 'rcpt_01',
        sessionId: 'sess_rec08',
        roundId: 'round_rec08',
        attackId: 'enc_pair_0',
        target: 'boss',
        effectType: collectedCommands[0].effectType,
        resultKind: collectedCommands[0].resultKind,
        idempotencyKey: collectedCommands[0].idempotencyKey,
        requestedDamage: 1,
        actualDamage: 1,
        oldHp: 10,
        previousHp: 10,
        newHp: 9,
        currentHp: 9,
        applied: true,
      };
      const recorded = controller.recordSettlementReceipt(receipt);
      expect(recorded).toBe(true);

      // 조우 완료(arrival) 전인 6.9s에 일시정지 후 재개
      controller.update(6.9);
      controller.pause('pause_after_correct');
      controller.resume();

      // 이미 확정된 공격 0이 재시작되거나 재정산되지 않음
      expect(collectedCommands.length).toBe(1); // 추가 명령 0건
      const secondRecord = controller.recordSettlementReceipt(receipt);
      expect(secondRecord).toBe(false); // 영수증 멱등성 보존 (중복 0건)
    });

    it('오답 타격(wrong_locked)으로 피해 적용 후 pause/resume 시 공격이 재시작되거나 중복 피해가 없어야 한다', () => {
      const controller = createController();
      const readingEnd = controller.readingEndTime; // 5.0s

      controller.update(readingEnd);
      controller.update(5.5);

      // 6.85s(도착 7.0s 150ms 전, EarlyMiss 170ms 유효창 내)에 오답 타격 (도착 전이므로 피해 0건)
      controller.update(6.85);
      controller.submitPunch('right', 6850, { activeSeconds: 6.85, inputId: 'punch_wrong_early' });
      controller.update(6.86);
      expect(collectedCommands.length).toBe(0);

      // 도착 시점(7.0s)에 피해 1건 발행
      controller.update(7.0);
      expect(collectedCommands.length).toBe(1);
      expect(collectedCommands[0].effectType).toBe('player_damage');

      // 7.1s에 일시정지 후 재개 (피해 적용 후)
      controller.update(7.1);
      controller.pause('pause_after_wrong');
      controller.resume();

      // 재개 직후 추가 피해 0건
      expect(collectedCommands.length).toBe(1);

      // 새 도착/마감 시간까지 전진해도 추가 timeout/오답 피해 0건
      controller.update(9.5);
      expect(collectedCommands.length).toBe(1);
    });
  });

  describe('4. THINK(question_reading) 구간 pause 후 resume 시 남은 활성 시간 정상 지속', () => {
    it('문제 낭독 중 pause 발생 시 활성 시간이 동결되고 resume 후 남은 시간이 정확히 소진되어야 한다', () => {
      const controller = createController({
        throwDurationSeconds: 1.0,
      });
      // throw: 1.0s, reading: 4.0s -> readingEndTime: 5.0s

      controller.update(1.0); // reading 진입
      expect(controller.phase).toBe('question_reading');

      controller.update(2.5); // 1.5s 경과 (남은 시간: 2.5s)
      const progressAtPause = controller.readingProgress;

      controller.pause();
      expect(controller.isPaused).toBe(true);

      // pause 중 update 호출 시 진행률 불변
      controller.update(2.5);
      expect(controller.readingProgress).toBe(progressAtPause);
      expect(controller.phase).toBe('question_reading');

      // 재개
      controller.resume();
      expect(controller.isPaused).toBe(false);

      // 남은 시간 소진 전(4.99s)까지 question_reading 유지
      controller.update(4.99);
      expect(controller.phase).toBe('question_reading');

      // 5.0s 시점에 정확히 encounters 진입
      controller.update(5.0);
      expect(controller.phase).toBe('encounters');
    });
  });

  describe('5. 반복 pause/resume 및 직전 경계 공격·후속 스케줄 보존', () => {
    it('공격 중 반복해서 pause/resume을 수행해도 스케줄이 안정적으로 보존되고 준비박 차단이 매번 동작해야 한다', () => {
      const controller = createController();
      const readingEnd = controller.readingEndTime; // 5.0s

      controller.update(readingEnd);
      controller.update(5.5);

      // 1차 pause & resume (5.5s)
      controller.pause();
      controller.resume(); // ready until 6.0s, arrival: 5.5 + 2.0 + 0.5 = 8.0s

      // 1차 준비박 중 입력 차단
      controller.submitPunch('left', 5800, { activeSeconds: 5.8, inputId: 'p_rep_1' });
      controller.update(5.8);
      expect(collectedCommands.length).toBe(0);

      // 5.9s에 2차 pause & resume
      controller.update(5.9);
      controller.pause();
      controller.resume(); // ready until 5.9 + 0.5 = 6.4s, arrival: 5.9 + 2.0 + 0.5 = 8.4s

      // 2차 준비박 중 입력 차단 (6.2s)
      controller.submitPunch('left', 6200, { activeSeconds: 6.2, inputId: 'p_rep_2' });
      controller.update(6.2);
      expect(collectedCommands.length).toBe(0);

      // 2차 준비박 경과 후, 보존된 도착(8.4s) 100ms 전(8.3s, EarlyMiss 170ms 유효창 내) 정상 타격
      controller.update(6.5);
      expect(collectedCommands.length).toBe(0);
      controller.update(8.3);
      controller.submitPunch('left', 8300, { activeSeconds: 8.3, inputId: 'p_rep_3' });
      controller.update(8.3);
      expect(collectedCommands.length).toBe(1);
      expect(collectedCommands[0].effectType).toBe('boss_negate');
    });
  });
});
