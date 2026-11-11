/**
 * assault-loop-input-windows.test.ts
 *
 * [ASSAULT-LOOP-05 / GitHub Issue #698]
 * 선택 4박 고정 · 휴식 무피해 · 스쿼트 하위창 입력 귀속 TDD 검증 슈트
 */

import { describe, it, expect } from 'vitest';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { buildAssaultLoopPlan } from '../../src/game/assault/AssaultLoopPlanBuilder.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import type { AssaultLoopRoundPlan } from '../../src/types/assault-loop.js';
import type { SessionId, RoundId } from '../../src/types/assault.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';

const SQUAT_ENABLED_LOOP_CONFIG: AssaultLoopConfig = {
  ...DEFAULT_ASSAULT_LOOP_CONFIG,
  minSquatsPerRound: 1,
  maxSquatsPerRound: 2,
};

describe('[ASSAULT-LOOP-05 / #698] Assault Loop Input Windows & Rest Protection', () => {
  const sampleQuestion = {
    id: 'q_test_loop_05',
    text: '15 + 7 = ?',
    minReadSeconds: 2.0,
    correctSide: 'left' as const,
  };

  // 커스텀 프로필을 사용하여 1개 및 2개 스쿼트 계획 생성 (스쿼트 하위창 검증 기능 보존)
  const plan36 = buildAssaultLoopPlan({
    seed: 'seed-loop-05-36',
    roundNumber: 1,
    loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
  });
  let plan40: AssaultLoopRoundPlan | null = null;
  for (let r = 1; r <= 30; r++) {
    const candidate = buildAssaultLoopPlan({
      seed: 'seed-loop-05-40',
      roundNumber: r,
      loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
    });
    if (candidate.totalBeats === 32 && candidate.squatCount === 2) {
      plan40 = candidate;
      break;
    }
  }
  if (!plan40) {
    plan40 = buildAssaultLoopPlan({
      seed: 42,
      roundNumber: 3,
      loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
    });
  }

  const createController = (
    plan: AssaultLoopRoundPlan,
    options?: { bpm?: number; configOverrides?: Partial<typeof DEFAULT_ASSAULT_CONFIG> },
  ) => {
    return new AssaultRoundController({
      sessionId: 'sess_loop_05' as SessionId,
      roundId: 'round_loop_05' as RoundId,
      question: sampleQuestion,
      loopPlan: plan,
      bpm: options?.bpm ?? 120,
      config: {
        ...DEFAULT_ASSAULT_CONFIG,
        ...options?.configOverrides,
      },
    });
  };

  // ────────────────────────────────────────────────────────────────
  // 1. 선택창 4박 고정 및 난이도 비행 오버라이드 배제
  // ────────────────────────────────────────────────────────────────
  describe('1. 선택창 4박 고정 (난이도별 flight override 배제)', () => {
    it('easy/normal/hard 난이도 설정과 무관하게 answer_pair 조우는 정확히 4박(120BPM 기준 2.0초)이어야 한다', () => {
      // DEFAULT_ASSAULT_CONFIG contains answerFlightBeatsByDifficulty (easy: 3, normal: 2, hard: 1.5)
      const ctrl = createController(plan36, {
        configOverrides: {
          answerFlightBeatsByDifficulty: { easy: 3, normal: 2, hard: 1.5 },
        },
      });

      // Encounter 0: 첫 번째 answer_pair (run8: 0..4.0s 뒤 시작 -> 4.0s ~ 6.0s)
      const enc0 = ctrl.encounters[0];
      expect(enc0.kind).toBe('answer_pair');
      expect(enc0.durationBeats).toBe(4);

      // 120 BPM -> 0.5s per beat. 4 beats = 2.0s
      expect(ctrl.secondsPerBeat).toBe(0.5);

      // 컨트롤러 런타임 조우 시간 검증
      // startSeconds: 4.0s, arrivalSeconds: 6.0s
      ctrl.update(4.0);
      const pres = ctrl.getPresentationSnapshot();
      expect(pres.phase).toBe('encounters');
      expect(pres.pair).toBeDefined();
    });

    it('루프 경로에서는 lateGraceSeconds가 0이어야 하며 170ms 유예가 휴식으로 침범하지 않아야 한다', () => {
      const ctrl = createController(plan36);
      ctrl.update(4.0);

      // 4박 종료 정각인 6.0초까지 전진
      ctrl.update(6.0);
      const cmdsAt60 = ctrl.drainSettlementCommands();
      // 타임아웃 정산(miss/player_damage) 1회가 6.0 정각에 발행됨
      expect(cmdsAt60.some((c) => c.effectType === 'player_damage' && c.resultKind === 'timeout')).toBe(true);

      // 6.0초 이후 rest 진입 (6.0s ~ 7.0s)
      ctrl.update(6.05);
      ctrl.update(6.1);
      ctrl.update(6.17);
      const cmdsInRest = ctrl.drainSettlementCommands();
      expect(cmdsInRest).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. 경계값 검증 (±1ms: 정각 유효 vs ε 초과 무효)
  // ────────────────────────────────────────────────────────────────
  describe('2. 경계값 검증 (±1ms: 정각 유효 vs ε 초과 무효)', () => {
    it('유효 판정 시작 경계(도착 6.0s - EarlyMiss 170ms = t=5.830s) 입력은 유효하게 정답 판정되어야 한다', () => {
      const ctrl = createController(plan36);
      ctrl.update(4.0);
      ctrl.update(5.83);

      // t=5.830s(deltaMs = -170ms, EarlyMiss 경계 포함)에 정답 펀치 제출 (#745: 그 이전은 조기 미스)
      ctrl.submitPunch('left', 5830, { activeSeconds: 5.83 });
      const cmds = ctrl.drainSettlementCommands();
      expect(cmds.some((c) => c.effectType === 'boss_negate')).toBe(true);
    });

    it('선택 종료 정각(t=6.000s) 입력은 마감 정산/휴식 진입 전에 우선 유효 처리되어야 한다', () => {
      const ctrl = createController(plan36);
      ctrl.update(4.0);
      ctrl.update(5.99);

      // t=6.000s (정확히 4박 종료 정각) 정답 펀치 제출
      ctrl.submitPunch('left', 6000, { activeSeconds: 6.0 });
      const cmds = ctrl.drainSettlementCommands();

      // 마감 만료(timeout) 데미지가 아닌 정답(boss_negate)이 발생해야 함
      expect(cmds.some((c) => c.effectType === 'boss_negate')).toBe(true);
      expect(cmds.some((c) => c.resultKind === 'timeout')).toBe(false);
    });

    it('선택 종료 정각 직후(t=6.001s, ε=1ms 초과) 입력은 휴식 구간으로 간주되어 무효(명령 0건)여야 한다', () => {
      const ctrl = createController(plan36);
      ctrl.update(4.0);
      // 6.0s 도달 시 미응답 타임아웃 정산
      ctrl.update(6.0);
      ctrl.drainSettlementCommands();

      // 6.001s (종료 1ms 초과) 펀치 제출 -> rest 구간이므로 무효
      ctrl.submitPunch('left', 6001, { activeSeconds: 6.001 });
      const lateCmds = ctrl.drainSettlementCommands();
      expect(lateCmds).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. 평화로운 휴식 (rest 2박 무공격·무선택·무피해) 및 달리기 (run 8박)
  // ────────────────────────────────────────────────────────────────
  describe('3. 휴식(rest) 및 달리기(run) 구간 무공격·무선택·무피해 보장', () => {
    it('달리기(run_question, 0~4.0s) 동안 유입된 펀치 및 스쿼트는 정산 명령을 전혀 발생시키지 않아야 한다', () => {
      const ctrl = createController(plan36);

      ctrl.update(1.0);
      ctrl.submitPunch('left', 1000, { activeSeconds: 1.0 });
      ctrl.submitSquat('ducking', 1000, { activeSeconds: 1.0 });

      ctrl.update(2.5);
      ctrl.submitPunch('right', 2500, { activeSeconds: 2.5 });

      expect(ctrl.drainSettlementCommands()).toHaveLength(0);
    });

    it('휴식(rest, 6.0~7.0s) 전 구간에서 유입된 펀치 및 스쿼트는 정산 명령을 전혀 발생시키지 않아야 한다', () => {
      const planWithRest = buildAssaultLoopPlan({
        seed: 'seed-loop-05-36',
        roundNumber: 1,
        loopConfig: {
          ...DEFAULT_ASSAULT_CONFIG,
          runBeats: 8,
          answerBeats: 4,
          restBeats: 2,
          answerOpportunities: 4,
          squatBeats: 4,
          squatSubBeats: { notice: 1, dodge: 2, stand: 1 },
          candidateGaps: [1, 2, 3],
          minSquatsPerRound: 1,
          maxSquatsPerRound: 2,
          baseBeats: 32,
          profileId: 'assault_loop_v1',
          rulesVersion: '1.0.0',
        } as any,
      });
      const restSeg = planWithRest.segments.find((s) => s.kind === 'rest')!;
      expect(restSeg).toBeDefined();

      const ctrl = createController(planWithRest);
      ctrl.update(4.0);
      // 4.5s에 조기 정답 처리
      ctrl.submitPunch('left', 4500, { activeSeconds: 4.5 });
      ctrl.drainSettlementCommands();

      ctrl.update(restSeg.startSeconds);
      ctrl.drainSettlementCommands();
      expect(ctrl.currentLoopSegment?.kind).toBe('rest');

      // 휴식 구간 중 다양한 입력 시도
      ctrl.submitPunch('left', Math.round((restSeg.startSeconds + 0.2) * 1000), { activeSeconds: restSeg.startSeconds + 0.2 });
      ctrl.submitPunch('right', Math.round((restSeg.startSeconds + 0.5) * 1000), { activeSeconds: restSeg.startSeconds + 0.5 });
      ctrl.submitSquat('ducking', Math.round((restSeg.startSeconds + 0.7) * 1000), { activeSeconds: restSeg.startSeconds + 0.7 });
      ctrl.submitSquat('standing', Math.round((restSeg.startSeconds + 0.9) * 1000), { activeSeconds: restSeg.startSeconds + 0.9 });
      ctrl.update(restSeg.endSeconds);

      const cmds = ctrl.drainSettlementCommands();
      expect(cmds).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. 스쿼트 하위창 (예고 1박 + 회피 2박 + 직립 1박) 판정
  // ────────────────────────────────────────────────────────────────
  describe('4. 스쿼트 하위창 (notice 1박 + dodge 2박 + stand 1박) 입력 귀속', () => {
    it('스쿼트 구간에서 dodge 마감 시점에만 실패 정산이 발행되고 stand 복귀박은 무피해여야 한다', () => {
      const ctrl = createController(plan36);
      // plan36에서 스쿼트 구간 찾기
      const squatSeg = plan36.segments.find((s) => s.kind === 'squat')!;
      expect(squatSeg).toBeDefined();

      const squatStart = squatSeg.startSeconds; // e.g. 7.0s (14 beat)
      const noticeEnd = squatStart + 0.5;      // 7.5s (1 beat)
      const dodgeEnd = squatStart + 1.5;       // 8.5s (3 beat: notice 1 + dodge 2)
      const standEnd = squatStart + 2.0;       // 9.0s (4 beat: total 4 beats)

      // 스쿼트 시작 전까지 전진
      ctrl.update(squatStart);
      ctrl.drainSettlementCommands();

      // (1) notice 구간 (7.0 ~ 7.5s): 미회피 상태로 진행해도 피해 0
      ctrl.update(noticeEnd);
      expect(ctrl.drainSettlementCommands()).toHaveLength(0);

      // (2) dodge 구간 (7.5 ~ 8.5s) 중 회피 안 함 -> dodgeEnd(8.5s)에 실패 정산(squatFail 5 피해) 발행
      ctrl.update(dodgeEnd);
      const cmdsAtDodgeEnd = ctrl.drainSettlementCommands();
      expect(cmdsAtDodgeEnd.some((c) => c.effectType === 'player_damage' && c.resultKind === 'miss')).toBe(true);

      // (3) stand 복귀박 (8.5 ~ 9.0s): 추가 피해 0건 보장
      ctrl.update(standEnd);
      expect(ctrl.drainSettlementCommands()).toHaveLength(0);
    });

    it('dodge 구간(7.5~8.5s) 내에서 웅크릴 경우 회피 성공(0피해)하고 정산 완료되어야 한다', () => {
      const ctrl = createController(plan36);
      const squatSeg = plan36.segments.find((s) => s.kind === 'squat')!;
      const squatStart = squatSeg.startSeconds;
      const dodgeTime = squatStart + 0.8; // dodge 구간 내부
      const standEnd = squatStart + 2.0;

      ctrl.update(squatStart);
      ctrl.drainSettlementCommands();

      // dodge 구간에서 스쿼트 입력
      ctrl.submitSquat('ducking', Math.round(dodgeTime * 1000), {
        activeSeconds: dodgeTime,
        standGeneration: 1,
      });

      // 회피 성공으로 피해 0건
      const cmdsAfterEvade = ctrl.drainSettlementCommands();
      expect(cmdsAfterEvade.filter((c) => c.effectType === 'player_damage')).toHaveLength(0);

      // 스쿼트 전체 종료 시점까지 추가 피해 없음
      ctrl.update(standEnd);
      expect(ctrl.drainSettlementCommands()).toHaveLength(0);
    });

    it('스쿼트 복귀박(stand) 및 휴식 중 직립(standing) 입력은 세대 소비 없이 직립 복귀를 기록해야 한다', () => {
      const ctrl = createController(plan36);
      const squatSeg = plan36.segments.find((s) => s.kind === 'squat')!;
      const squatStart = squatSeg.startSeconds;
      const dodgeTime = squatStart + 0.8;
      const standTime = squatStart + 1.7; // stand 구간

      ctrl.update(squatStart);
      ctrl.drainSettlementCommands();
      // dodge 성공 (피해 명령 0건)
      ctrl.submitSquat('ducking', Math.round(dodgeTime * 1000), {
        activeSeconds: dodgeTime,
        standGeneration: 1,
      });
      const evadeCmds = ctrl.drainSettlementCommands();
      expect(evadeCmds.filter((c) => c.effectType === 'player_damage')).toHaveLength(0);

      // stand 복귀박에서 직립 복귀
      ctrl.submitSquat('standing', Math.round(standTime * 1000), {
        activeSeconds: standTime,
        standGeneration: 1,
      });

      const standState = ctrl.exportSquatStandState();
      expect(standState.hasStoodUpSinceLastEvade).toBe(true);
      expect(ctrl.drainSettlementCommands()).toHaveLength(0);
    });

    it('연속 앉기(Holding) 방지: 첫 스쿼트 회피 후 직립 복귀 없이 두 번째 스쿼트를 맞이하면 실패 처리되어야 한다', () => {
      if (!plan40) return;
      const ctrl = createController(plan40);
      const squatSegs = plan40.segments.filter((s) => s.kind === 'squat');
      expect(squatSegs.length).toBe(2);

      const [sq1, sq2] = squatSegs;

      // 1. 첫 번째 스쿼트 회피 성공
      const sq1DodgeTime = sq1.startSeconds + 0.8;
      ctrl.update(sq1.startSeconds);
      ctrl.drainSettlementCommands();
      ctrl.submitSquat('ducking', Math.round(sq1DodgeTime * 1000), {
        activeSeconds: sq1DodgeTime,
        standGeneration: 1,
      });
      ctrl.update(sq1.endSeconds);
      ctrl.drainSettlementCommands();

      // 2. 직립 복귀 없이 계속 ducking 상태로 두 번째 스쿼트까지 진행
      ctrl.update(sq2.startSeconds);
      ctrl.drainSettlementCommands();
      const sq2DodgeTime = sq2.startSeconds + 0.8;
      // 계속 앉아있는 프레임 입력 (standGeneration 1 유지, 직립 없음)
      ctrl.submitSquat('ducking', Math.round(sq2DodgeTime * 1000), {
        activeSeconds: sq2DodgeTime,
        standGeneration: 1,
      });

      // 두 번째 스쿼트 dodge 마감 시점(notice 1박 + dodge 2박)
      const sq2DodgeEnd = sq2.startSeconds + 1.5;
      ctrl.update(sq2DodgeEnd);

      // 직립하지 않았으므로 miss 실패 피해가 발행되어야 함
      const cmds = ctrl.drainSettlementCommands();
      expect(cmds.some((c) => c.effectType === 'player_damage' && c.resultKind === 'miss')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. 조기 정답/오답/무응답 시 슬롯 유지 (단축 0) 및 격리
  // ────────────────────────────────────────────────────────────────
  describe('5. 조기 정답/오답/무응답 시 4박 슬롯 + 2박 휴식 유지 및 다음 쌍 격리', () => {
    it('조기 정답 후에도 남은 4박 슬롯과 2박 휴식이 그대로 유지되어야 한다', () => {
      const ctrl = createController(plan36);
      ctrl.update(4.0);

      // t=5.85s(도착 6.0s 150ms 전, EarlyMiss 170ms 유효창 내)에 조기 정답 선택
      ctrl.update(5.85);
      ctrl.submitPunch('left', 5850, { activeSeconds: 5.85 });
      expect(ctrl.drainSettlementCommands().some((c) => c.effectType === 'boss_negate')).toBe(true);

      // 5.9s, 5.99s, 6.0s 전진 시 여전히 answer 구간 진행 중 (축소되지 않음)
      ctrl.update(5.9);
      expect(ctrl.currentLoopSegment?.kind).toBe('answer');
      expect(ctrl.isCompleted).toBe(false);

      ctrl.update(5.99);
      expect(ctrl.currentLoopSegment?.kind).toBe('answer');

      // 6.0s에서 비로소 다음 구간(squat 또는 answer 2)으로 전이
      ctrl.update(6.0);
      expect(ctrl.currentLoopSegment?.kind).not.toBe('run_question');
      expect(['squat', 'answer']).toContain(ctrl.currentLoopSegment?.kind);
    });

    it('조기 정답 후 남은 슬롯 중 추가 펀치는 무시되며 다음 쌍에 영향을 미치지 않아야 한다', () => {
      const ctrl = createController(plan36);
      ctrl.update(4.0);
      ctrl.update(5.85);
      // 도착(6.0s) 150ms 전 정답 잠금 (EarlyMiss 170ms 유효창 내)
      ctrl.submitPunch('left', 5850, { activeSeconds: 5.85 });
      expect(ctrl.drainSettlementCommands().some((c) => c.effectType === 'boss_negate')).toBe(true);

      // 5.9s, 5.95s에 추가 타격 (잠금 이후)
      ctrl.submitPunch('left', 5900, { activeSeconds: 5.9 });
      ctrl.submitPunch('right', 5950, { activeSeconds: 5.95 });
      expect(ctrl.drainSettlementCommands()).toHaveLength(0);

      // 다음 답 쌍 조우 시작 시점까지 전진
      const nextAnswerEnc = ctrl.encounters.find((e, idx) => idx > 0 && e.kind === 'answer_pair')!;
      const nextStartSeconds = nextAnswerEnc.startBeat * ctrl.secondsPerBeat;
      ctrl.update(nextStartSeconds);

      // 이전 입력의 누출 없이 다음 답 쌍이 깨끗하게 시작되어야 함
      ctrl.drainSettlementCommands();
      // 다음 조우 도착(시작 + 4박) 100ms 전 정답 펀치 (EarlyMiss 170ms 유효창 내)
      const nextPunchSeconds = nextStartSeconds + nextAnswerEnc.durationBeats * ctrl.secondsPerBeat - 0.1;
      ctrl.update(nextPunchSeconds);
      ctrl.drainSettlementCommands();
      ctrl.submitPunch('left', Math.round(nextPunchSeconds * 1000), { activeSeconds: nextPunchSeconds });
      const enc1Cmds = ctrl.drainSettlementCommands();
      expect(enc1Cmds.some((c) => c.effectType === 'boss_negate')).toBe(true);
    });

    it('스쿼트 진행 중 펀치는 조우에 귀속되지 않고 0명령이어야 한다', () => {
      const ctrl = createController(plan36);
      const squatSeg = plan36.segments.find((s) => s.kind === 'squat')!;
      ctrl.update(squatSeg.startSeconds + 0.5);
      ctrl.drainSettlementCommands();

      // 스쿼트 중 펀치 입력 시도
      ctrl.submitPunch('left', Math.round((squatSeg.startSeconds + 0.5) * 1000), {
        activeSeconds: squatSeg.startSeconds + 0.5,
      });

      expect(ctrl.drainSettlementCommands()).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. 레거시(비루프) 경로 회귀 방지 (170ms lateGrace 유지)
  // ────────────────────────────────────────────────────────────────
  describe('6. 레거시(비루프) 경로 170ms lateGrace 및 회귀 방지', () => {
    it('loopPlan이 없는 레거시 컨트롤러는 170ms lateGrace를 유지하여 arrival + 100ms 입력을 유효 처리해야 한다', () => {
      const legacyCtrl = new AssaultRoundController({
        sessionId: 'sess_legacy' as SessionId,
        roundId: 'round_legacy' as RoundId,
        question: sampleQuestion,
        plan: {
          roundId: 'round_legacy' as RoundId,
          totalBeats: 16,
          bpm: 120,
          encounters: [
            {
              id: 'atk_legacy_1' as any,
              kind: 'answer_pair',
              startBeat: 0,
              durationBeats: 4,
              interactionProfileId: 'assault_input_mvp_v1' as any,
              visualProfileId: 'assault_visual_mvp_v1' as any,
              pairId: 'pair_legacy_1' as any,
            },
          ],
        },
        bpm: 120,
        throwDurationSeconds: 0,
      });

      // readingEndTime = 0 + calculateReading...
      const readingEnd = legacyCtrl.readingEndTime;
      // arrival = readingEnd + 4 * 0.5 = readingEnd + 2.0s
      const arrivalTime = readingEnd + 2.0;

      legacyCtrl.update(readingEnd);
      legacyCtrl.update(arrivalTime); // arrival 도달

      // arrival + 0.10s (100ms lateGrace 이내) 입력
      const lateTime = arrivalTime + 0.10;
      legacyCtrl.submitPunch('left', Math.round(lateTime * 1000), { activeSeconds: lateTime });

      const cmds = legacyCtrl.drainSettlementCommands();
      // 레거시에서는 170ms 유예 내 입력이므로 boss_negate 정답으로 인정되어야 함
      expect(cmds.some((c) => c.effectType === 'boss_negate')).toBe(true);
    });
  });
});
