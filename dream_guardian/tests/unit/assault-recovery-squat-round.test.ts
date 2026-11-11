/**
 * assault-recovery-squat-round.test.ts
 *
 * [BOSS-ASSAULT-REC-26 / #614] 스쿼트 직립 복귀·가드 판정 상태 계약 검증
 *
 * 검증 목표:
 * 1. 실제 자세 결과(AssaultSquatResult)의 isValid / standGeneration / posture 손실 없는 수신 및 소비.
 *    - isValid: false (무효 추적/신뢰도 미달/비정규화) 입력 시 회피 성공 0건 (pending 유지 후 마감 시 miss/player_damage).
 * 2. 연속 두 스쿼트 조우에서 직립 복귀 없이 계속 앉아 있거나 가드를 유지할 경우 두 번째 공격 자동 성공 0건.
 *    - 첫 번째 공격 성공 후 직립 복귀(새 standGeneration)를 완료해야만 두 번째 스쿼트 공격 성공.
 * 3. 조우 시간 시프트(Shift/Resume) 발생으로 _initJudgesForEncounter가 재호출되더라도,
 *    이미 소비된 직립 세대(consumedGenerations) 및 직립 상태(hasStoodUpSinceLastEvade)가 소실/리셋되지 않음.
 * 4. 라운드 경계를 넘는 소비 상태를 Core가 보관/재주입할 수 있는 읽기 전용 포트(exportSquatStandState) 및 주입 포트(initialSquatStandState) 제공.
 * 5. 저충격 가드 어댑터(AssaultGuardAdapter) 결과 주입 시에도 동일한 회피 계약(holding 방지, standGeneration 소비) 준수.
 * 6. 스쿼트 회피 성공이 이전 오답 피해(wrong_answer 등)를 취소하지 않음 (정산 명령 격리 보존).
 */

import { describe, it, expect } from 'vitest';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
  type AssaultSquatStandState,
} from '../../src/game/assault/AssaultRoundController.js';
import type { AssaultSquatResult } from '../../src/motion/AssaultSquatAdapter.js';
import { AssaultGuardAdapter } from '../../src/motion/AssaultGuardAdapter.js';
import type { AssaultSettlementCommand } from '../../src/types/assault.js';

describe('[BOSS-ASSAULT-REC-26 / #614] Squat Stand Return & Guard State Contract Verification', () => {
  // 120 BPM: 1박 = 0.5초. throwDuration = 1.0s, readingMin = 4.0s (8박). readingEndTime = 5.0s.
  // encounter 0: startBeat = 0 (5.0s), durationBeats = 4 (도착 7.0s), deadline 7.17s.
  // encounter 1: startBeat = 6 (8.0s), durationBeats = 4 (도착 10.0s), deadline 10.17s.
  const createTwoSquatsPlan = () => ({
    encounters: [
      {
        id: 'squat_01',
        kind: 'squat' as const,
        startBeat: 0,
        durationBeats: 4,
        interactionProfileId: 'profile_squat_default',
        visualProfileId: 'hazard_sweep_low',
      },
      {
        id: 'squat_02',
        kind: 'squat' as const,
        startBeat: 6,
        durationBeats: 4,
        interactionProfileId: 'profile_squat_default',
        visualProfileId: 'hazard_sweep_low',
      },
    ],
  });

  const question: AssaultRoundQuestionData = {
    id: 'q_rec26',
    text: '5 + 3 = ?',
    type: 'addition',
  };

  it('실제 자세 결과(AssaultSquatResult)의 isValid=false인 경우 회피 성공하지 않고 마감 시 피해가 발생해야 한다', () => {
    const commands: AssaultSettlementCommand[] = [];
    const controller = new AssaultRoundController({
      sessionId: 'sess_rec26_01',
      roundId: 'round_rec26_01',
      question,
      plan: createTwoSquatsPlan(),
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commands.push(cmd),
    });

    controller.update(5.0); // reading_end, encounters 진입 (enc_0: start 5.0s, arrival 7.0s)

    const invalidResult: AssaultSquatResult = {
      isValid: false,
      posture: 'ducking',
      isDucking: true,
      isStanding: false,
      standGeneration: 1,
      deltaY: 0.1,
      normalizedCurrentY: 0.6,
      normalizedBaselineY: 0.5,
      timestampMs: 6500,
      invalidReason: 'LOW_CONFIDENCE',
    };

    // submitSquatResult로 전달
    controller.submitSquatResult(invalidResult, { activeSeconds: 6.5 });

    // 유효하지 않은 자세이므로 evade_success 명령이 발행되지 않아야 함
    const evadeCmds = commands.filter((c) => c.effectType === 'evade_success');
    expect(evadeCmds.length).toBe(0);

    // 마감 초과 진행
    controller.update(7.2);

    // 미회피로 인한 player_damage 1회 발행 확인
    const damageCmds = commands.filter(
      (c) => c.attackId === 'squat_01' && c.effectType === 'player_damage'
    );
    expect(damageCmds.length).toBe(1);
  });

  it('연속 두 스쿼트 조우에서 직립 복귀 없이 계속 앉아 있을 경우 두 번째 공격은 자동 성공하지 않고 실패(miss)해야 한다', () => {
    const commands: AssaultSettlementCommand[] = [];
    const controller = new AssaultRoundController({
      sessionId: 'sess_rec26_02',
      roundId: 'round_rec26_02',
      question,
      plan: createTwoSquatsPlan(),
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commands.push(cmd),
    });

    controller.update(5.0);

    // 1번째 스쿼트: standGeneration=1로 유효하게 회피 성공
    const validSquat1: AssaultSquatResult = {
      isValid: true,
      posture: 'ducking',
      isDucking: true,
      isStanding: false,
      standGeneration: 1,
      deltaY: 0.2,
      normalizedCurrentY: 0.7,
      normalizedBaselineY: 0.5,
      timestampMs: 6500,
    };
    controller.submitSquatResult(validSquat1, { activeSeconds: 6.5 });

    // 1번째 공격 성공 확인
    expect(commands.some((c) => c.attackId === 'squat_01' && c.effectType === 'evade_success')).toBe(true);

    // 조우 1 마감 후 조우 2(8.0s ~ 10.0s) 진입
    controller.update(8.0);

    // 직립 복귀 없이 동일한 standGeneration=1 및 ducking 상태 유지 제출
    const holdingSquat: AssaultSquatResult = {
      isValid: true,
      posture: 'ducking',
      isDucking: true,
      isStanding: false,
      standGeneration: 1, // 미증가 (복귀 안함)
      deltaY: 0.2,
      normalizedCurrentY: 0.7,
      normalizedBaselineY: 0.5,
      timestampMs: 9500,
    };
    controller.submitSquatResult(holdingSquat, { activeSeconds: 9.5 });

    // 두 번째 스쿼트에서 evade_success 명령이 발행되지 않아야 함
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'evade_success')).toBe(false);

    // 2번째 마감 초과
    controller.update(10.2);

    // 직립 미복귀(holding)로 인한 player_damage 1회 발행 확인
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'player_damage')).toBe(true);
  });

  it('1번째 스쿼트 회피 후 직립 복귀(standGeneration 증가)를 거치면 두 번째 스쿼트 공격도 정상 회피 성공해야 한다', () => {
    const commands: AssaultSettlementCommand[] = [];
    const controller = new AssaultRoundController({
      sessionId: 'sess_rec26_03',
      roundId: 'round_rec26_03',
      question,
      plan: createTwoSquatsPlan(),
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commands.push(cmd),
    });

    controller.update(5.0);

    // 1번째 스쿼트 회피 (gen 1)
    controller.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 1,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 6500,
      },
      { activeSeconds: 6.5 }
    );
    expect(commands.some((c) => c.attackId === 'squat_01' && c.effectType === 'evade_success')).toBe(true);

    controller.update(7.5);

    // 직립 복귀 프레임 제출 (gen 2로 증가)
    controller.submitSquatResult(
      {
        isValid: true,
        posture: 'standing',
        isDucking: false,
        isStanding: true,
        standGeneration: 2,
        deltaY: 0.0,
        normalizedCurrentY: 0.5,
        normalizedBaselineY: 0.5,
        timestampMs: 7600,
      },
      { activeSeconds: 7.6 }
    );

    controller.update(8.0); // 조우 2 시작

    // 2번째 스쿼트: gen 2로 다시 ducking 제출
    controller.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 2,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 9500,
      },
      { activeSeconds: 9.5 }
    );

    // 2번째 공격 회피 성공 확인
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'evade_success')).toBe(true);
  });

  it('조우 시간 시프트(Shift/Resume)로 _initJudgesForEncounter가 재호출되더라도 직립 세대 소비 상태가 보존되어야 한다', () => {
    const commands: AssaultSettlementCommand[] = [];
    const controller = new AssaultRoundController({
      sessionId: 'sess_rec26_04',
      roundId: 'round_rec26_04',
      question,
      plan: createTwoSquatsPlan(),
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commands.push(cmd),
    });

    controller.update(5.0);

    // 1번째 스쿼트 회피 (gen 1)
    controller.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 1,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 6500,
      },
      { activeSeconds: 6.5 }
    );
    expect(commands.some((c) => c.attackId === 'squat_01' && c.effectType === 'evade_success')).toBe(true);

    // 조우 0 종료 직전 일시정지 및 재개 (시간 시프트 발생 -> _initJudgesForEncounter 재호출 유발)
    controller.pause('test_pause');
    controller.resume();

    // 시프트 후 조우 2 진입
    controller.update(9.5);

    // 직립 복귀 없이 동일 gen 1으로 2번째 스쿼트 회피 시도
    controller.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 1, // 복귀 안함
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 10500,
      },
      { activeSeconds: 10.5 }
    );

    // 재초기화로 인해 gen 1이 재사용되어 성공하는 버그가 없어야 함 (자동 성공 0건)
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'evade_success')).toBe(false);
  });

  it('Core가 라운드 경계를 넘어 소비 상태를 보관하고 다음 라운드에 주입할 수 있어야 한다 (exportSquatStandState / initialSquatStandState)', () => {
    const commandsRound1: AssaultSettlementCommand[] = [];
    const controllerRound1 = new AssaultRoundController({
      sessionId: 'sess_rec26_05',
      roundId: 'round_rec26_05_1',
      question,
      plan: {
        encounters: [
          {
            id: 'squat_r1_01',
            kind: 'squat' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_squat_default',
            visualProfileId: 'hazard_sweep_low',
          },
        ],
      },
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commandsRound1.push(cmd),
    });

    controllerRound1.update(5.0);
    controllerRound1.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 1,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 6500,
      },
      { activeSeconds: 6.5 }
    );
    expect(commandsRound1.some((c) => c.effectType === 'evade_success')).toBe(true);

    controllerRound1.update(7.2); // 라운드 완료

    // 라운드 1 종료 시점에서 직립 세대 소비 상태 export
    const standState: AssaultSquatStandState = controllerRound1.exportSquatStandState();
    expect(standState.consumedGenerations).toContain(1);
    expect(standState.hasStoodUpSinceLastEvade).toBe(false);

    // 라운드 2 생성 시 standState 주입
    const commandsRound2: AssaultSettlementCommand[] = [];
    const controllerRound2 = new AssaultRoundController({
      sessionId: 'sess_rec26_05',
      roundId: 'round_rec26_05_2',
      question,
      plan: {
        encounters: [
          {
            id: 'squat_r2_01',
            kind: 'squat' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_squat_default',
            visualProfileId: 'hazard_sweep_low',
          },
        ],
      },
      bpm: 120,
      throwDurationSeconds: 1.0,
      initialSquatStandState: standState,
      onSettlementCommand: (cmd) => commandsRound2.push(cmd),
    });

    controllerRound2.update(5.0);

    // 라운드 2에서 직립 복귀 없이 계속 앉은 채 gen 1으로 스쿼트 제출
    controllerRound2.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 1, // 라운드 1에서 이미 소비된 gen
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 6500,
      },
      { activeSeconds: 6.5 }
    );

    // 라운드를 넘어가도 직립 복귀 없이는 자동 성공하지 않아야 함
    expect(commandsRound2.some((c) => c.effectType === 'evade_success')).toBe(false);

    // 복귀 프레임 제출 (gen 2)
    controllerRound2.submitSquatResult(
      {
        isValid: true,
        posture: 'standing',
        isDucking: false,
        isStanding: true,
        standGeneration: 2,
        deltaY: 0.0,
        normalizedCurrentY: 0.5,
        normalizedBaselineY: 0.5,
        timestampMs: 6700,
      },
      { activeSeconds: 6.7 }
    );

    // 새 gen 2로 다시 스쿼트 제출
    controllerRound2.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 2,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 6800,
      },
      { activeSeconds: 6.8 }
    );

    // 복귀 후에는 정상 회피 성공
    expect(commandsRound2.some((c) => c.effectType === 'evade_success')).toBe(true);
  });

  it('AssaultGuardAdapter 저충격 가드 결과 주입 시에도 동일한 회피 계약(holding 방지)이 성립해야 한다', () => {
    const commands: AssaultSettlementCommand[] = [];
    const controller = new AssaultRoundController({
      sessionId: 'sess_rec26_06',
      roundId: 'round_rec26_06',
      question,
      plan: createTwoSquatsPlan(),
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commands.push(cmd),
    });

    const guardAdapter = new AssaultGuardAdapter();
    guardAdapter.setBaseline({
      shoulderWidth: 0.25,
      shoulderY: 0.35,
      noseY: 0.2,
      hipY: 0.6,
    });

    controller.update(5.0);

    // 가드 랜드마크 생성 헬퍼
    const createGuardLandmarks = () => [
      { x: 0.5, y: 0.2, z: 0.0, visibility: 0.99 }, // nose
      ...Array(10).fill({ x: 0.5, y: 0.3, z: 0.0, visibility: 0.99 }),
      { x: 0.45, y: 0.35, z: 0.0, visibility: 0.99 }, // 11: left shoulder
      { x: 0.55, y: 0.35, z: 0.0, visibility: 0.99 }, // 12: right shoulder
      { x: 0.42, y: 0.40, z: 0.0, visibility: 0.99 }, // 13: left elbow
      { x: 0.58, y: 0.40, z: 0.0, visibility: 0.99 }, // 14: right elbow
      { x: 0.47, y: 0.22, z: 0.0, visibility: 0.99 }, // 15: left wrist (nose 근처)
      { x: 0.53, y: 0.22, z: 0.0, visibility: 0.99 }, // 16: right wrist (nose 근처)
      ...Array(16).fill({ x: 0.5, y: 0.6, z: 0.0, visibility: 0.99 }),
    ];

    const guardRes1 = guardAdapter.update({ timestampMs: 6500, landmarks: createGuardLandmarks() });
    const squatRes1 = guardAdapter.toSquatResult(guardRes1);

    // 가드 결과를 submitSquatResult로 투입
    controller.submitSquatResult(squatRes1, { activeSeconds: 6.5 });

    // 1번째 공격 가드로 회피 성공 확인
    expect(commands.some((c) => c.attackId === 'squat_01' && c.effectType === 'evade_success')).toBe(true);

    // 2번째 조우 진입 (가드 계속 holding)
    controller.update(8.0);
    const guardRes2 = guardAdapter.update({ timestampMs: 9500, landmarks: createGuardLandmarks() });
    const squatRes2 = guardAdapter.toSquatResult(guardRes2);

    controller.submitSquatResult(squatRes2, { activeSeconds: 9.5 });

    // 가드 유지 시 2번째 공격 자동 성공 0건
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'evade_success')).toBe(false);

    controller.update(10.2);
    // miss로 인한 피해 발생 확인
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'player_damage')).toBe(true);
  });

  it('스쿼트 회피 성공이 이전 문제/조우의 오답 피해를 취소하지 않아야 한다 (정산 명령 격리 보존)', () => {
    const commands: AssaultSettlementCommand[] = [];
    const controller = new AssaultRoundController({
      sessionId: 'sess_rec26_07',
      roundId: 'round_rec26_07',
      question: {
        id: 'q_rec26_mix',
        text: '3 * 4 = ?',
        type: 'multiplication',
        correctSide: 'left',
      },
      plan: {
        encounters: [
          {
            id: 'pair_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_punch_default',
            visualProfileId: 'bullet_choice_basic',
            pairId: 'pair_01',
          },
          {
            id: 'squat_02',
            kind: 'squat' as const,
            startBeat: 6,
            durationBeats: 4,
            interactionProfileId: 'profile_squat_default',
            visualProfileId: 'hazard_sweep_low',
          },
        ],
      },
      bpm: 120,
      throwDurationSeconds: 1.0,
      onSettlementCommand: (cmd) => commands.push(cmd),
    });

    controller.update(5.0);

    // 1번째 조우(pair)에서 우측(오답) 펀치 -> 도착 시점(7.0s)에 player_damage 발생 (BUG-ASSAULT-003)
    // 도착(7.0s) 150ms 전 오답 펀치 (EarlyMiss 170ms 유효창 내)
    controller.update(6.85);
    controller.submitPunch('right', 6850, { activeSeconds: 6.85 });
    controller.update(7.0);
    const wrongCmds = commands.filter((c) => c.attackId === 'pair_01' && c.effectType === 'player_damage');
    expect(wrongCmds.length).toBe(1);

    // 조우 2(squat) 진입
    controller.update(8.0);

    // 스쿼트 정상 회피 성공
    controller.submitSquatResult(
      {
        isValid: true,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        standGeneration: 1,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
        timestampMs: 9500,
      },
      { activeSeconds: 9.5 }
    );

    // 스쿼트 evade_success 발행 확인
    expect(commands.some((c) => c.attackId === 'squat_02' && c.effectType === 'evade_success')).toBe(true);

    // 기존의 pair_01 오답 피해 명령이 취소되거나 상쇄되지 않고 여전히 그대로 보존되어야 함
    expect(commands.filter((c) => c.attackId === 'pair_01' && c.effectType === 'player_damage').length).toBe(1);
  });
});
