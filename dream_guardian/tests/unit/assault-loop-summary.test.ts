/**
 * assault-loop-summary.test.ts
 *
 * [ASSAULT-LOOP-06 / GitHub Issue #699]
 * 마지막 휴식 기준 완료1문제 · 실측 시간 요약 정합화 TDD 검증 슈트
 *
 * 핵심 검증 항목:
 * 1. 마지막 선택 직후 completedQuestions 0, 마지막 휴식(rest2) 완료 후 completedQuestions 1.
 * 2. 0~4정답/혼합 결과와 무관하게 생존 완주 시 completedQuestions: 1, attemptedAnswerHits: 4.
 * 3. 조우 집계: attemptedAnswerHits 4회, totalEncounters 5회(36박) 또는 6회(40박), run/rest 미산입.
 * 4. 실측 시간 정합성: 정각 도달 및 큰 dt overshoot 시에도 루프 계획 총 시간(18초/20초)으로 정합 (overshoot 0).
 * 5. 중간 abort 및 마지막 피해 사망 시 completedQuestions 0, isAborted true, 실측 시간/피해 보존.
 * 6. 중복 finalize 호출 시 멱등성 유지 (동일 불변 DTO 반환).
 * 7. 비루프(legacy) 경로 호환성 100% 보존.
 */

import { describe, it, expect, vi } from 'vitest';
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

describe('[ASSAULT-LOOP-06 / #699] Assault Loop Summary & Last Rest Completion', () => {
  const sampleQuestion = {
    id: 'q_test_loop_06',
    text: '24 + 18 = ?',
    minReadSeconds: 2.0,
    correctSide: 'left' as const,
  };

  // 28박 계획 (스쿼트 1회, 14.0초 @ 120BPM) - 커스텀 설정으로 스쿼트 기능 검증 보존
  const plan36 = buildAssaultLoopPlan({
    seed: 'seed-loop-06-36',
    roundNumber: 1,
    loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
  });
  expect(plan36.totalBeats).toBe(28);
  expect(plan36.squatCount).toBe(1);

  // 32박 계획 (스쿼트 2회, 16.0초 @ 120BPM)
  let plan40Candidate: AssaultLoopRoundPlan | null = null;
  for (let r = 1; r <= 30; r++) {
    const candidate = buildAssaultLoopPlan({
      seed: 'seed-loop-06-40',
      roundNumber: r,
      loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
    });
    if (candidate.totalBeats === 32 && candidate.squatCount === 2) {
      plan40Candidate = candidate;
      break;
    }
  }
  const plan40 = plan40Candidate ?? buildAssaultLoopPlan({
    seed: 42,
    roundNumber: 3,
    loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
  });
  expect(plan40.totalBeats).toBe(32);
  expect(plan40.squatCount).toBe(2);

  const createController = (
    plan: AssaultLoopRoundPlan,
    options?: {
      bpm?: number;
      onRoundComplete?: (res: any) => void;
      onSummaryFinalized?: (s: any) => void;
    },
  ) => {
    return new AssaultRoundController({
      sessionId: 'sess_loop_06' as SessionId,
      roundId: 'round_loop_06' as RoundId,
      question: sampleQuestion,
      loopPlan: plan,
      bpm: options?.bpm ?? 120,
      config: DEFAULT_ASSAULT_CONFIG,
      onRoundComplete: options?.onRoundComplete,
      onSummaryFinalized: options?.onSummaryFinalized,
    });
  };

  describe('1. 마지막 선택 직후 vs 마지막 답안 완료 경계 분리', () => {
    it('4번째 답안 진행 중(완료 전)에는 completedQuestions가 0이고 finalizeRoundSummary는 null이다', () => {
      const controller = createController(plan36);
      const answerEncounters = plan36.encounters.filter((e) => e.kind === 'answer_pair');
      expect(answerEncounters).toHaveLength(4);

      const lastAnswer = answerEncounters[3];
      const fourthAnswerPunchTime = lastAnswer.startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내

      // 4번째 답안 정답 펀치 제출 (답안 창 내부)
      controller.submitPunch('left', Math.round(fourthAnswerPunchTime * 1000), {
        activeSeconds: fourthAnswerPunchTime,
      });

      // 4번째 답안 직후 (완료 전 시점)
      expect(controller.isCompleted).toBe(false);
      expect(controller.getRoundSummary()).toBeNull();
      expect(controller.finalizeRoundSummary({ isDefeated: false })).toBeNull();

      // 마지막 답안 진행 중 (예: 13.0초)
      controller.update(13.0);
      expect(controller.isCompleted).toBe(false);
      expect(controller.getRoundSummary()).toBeNull();
      expect(controller.finalizeRoundSummary({ isDefeated: false })).toBeNull();
    });

    it('마지막 4번째 답안이 종료되는 정각(14.0초)에 정상 완료되어 completedQuestions: 1이 된다', () => {
      const onRoundComplete = vi.fn();
      const onSummaryFinalized = vi.fn();
      const controller = createController(plan36, { onRoundComplete, onSummaryFinalized });

      // 전체 14.0초 완주
      controller.update(14.0);

      expect(controller.isCompleted).toBe(true);
      expect(controller.completedSuccess).toBe(true);
      expect(onRoundComplete).toHaveBeenCalledTimes(1);
      expect(onRoundComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          roundId: 'round_loop_06',
        }),
      );

      const summary = controller.finalizeRoundSummary({ isDefeated: false });
      expect(summary).not.toBeNull();
      expect(summary!.completedQuestions).toBe(1);
      expect(summary!.isAborted).toBe(false);
      expect(summary!.isDefeated).toBe(false);
      expect(onSummaryFinalized).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. 정답 횟수(0~4)와 무관한 생존 완주 및 통계 집계', () => {
    it('정답을 1개도 맞히지 못해도(0정답 4오답) 생존 완주 시 completedQuestions: 1, attemptedAnswerHits: 4', () => {
      const controller = createController(plan36);
      const answerEncounters = plan36.encounters.filter((e) => e.kind === 'answer_pair');

      // 4번 모두 오답(right) 펀치 제출 (각 조우 창 내부)
      for (const enc of answerEncounters) {
        const midT = enc.startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
        controller.submitPunch('right', Math.round(midT * 1000), { activeSeconds: midT });
      }

      // 마지막 완주
      controller.update(14.0);
      expect(controller.isCompleted).toBe(true);

      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.completedQuestions).toBe(1);
      expect(summary.correctCount).toBe(0);
      expect(summary.wrongCount).toBe(4);
      expect(summary.attemptedAnswerHits).toBe(4);
      expect(summary.isAborted).toBe(false);
    });

    it('혼합 결과(2정답, 1오답, 1타임아웃)에서도 완주 시 completedQuestions: 1, attemptedAnswerHits: 4', () => {
      const controller = createController(plan36);
      const answerEncounters = plan36.encounters.filter((e) => e.kind === 'answer_pair');

      // 1: 정답
      const t1 = answerEncounters[0].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.submitPunch('left', Math.round(t1 * 1000), { activeSeconds: t1 });

      // 2: 오답
      const t2 = answerEncounters[1].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.submitPunch('right', Math.round(t2 * 1000), { activeSeconds: t2 });

      // 3: 정답
      const t3 = answerEncounters[2].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.submitPunch('left', Math.round(t3 * 1000), { activeSeconds: t3 });

      // 4: 미선택(타임아웃 발생)

      // 마지막 완주
      controller.update(14.0);
      expect(controller.isCompleted).toBe(true);

      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.completedQuestions).toBe(1);
      expect(summary.correctCount).toBe(2);
      expect(summary.wrongCount).toBe(1);
      expect(summary.timeoutCount).toBe(1);
      expect(summary.attemptedAnswerHits).toBe(4);
    });

    it('조우 수 집계: answer 4개 + squat N개만 집계 (28박: 5개, 32박: 6개), run은 조우 수에 미산입', () => {
      // 28박 (스쿼트 1개)
      const ctrl36 = createController(plan36);
      ctrl36.update(14.0);
      const sum36 = ctrl36.finalizeRoundSummary({ isDefeated: false })!;
      expect(sum36.attemptedAnswerHits).toBe(4);
      expect(sum36.totalEncounters).toBe(5); // 4 answers + 1 squat

      // 40박 (스쿼트 2개)
      const ctrl40 = createController(plan40);
      ctrl40.update(20.0);
      const sum40 = ctrl40.finalizeRoundSummary({ isDefeated: false })!;
      expect(sum40.attemptedAnswerHits).toBe(4);
      expect(sum40.totalEncounters).toBe(6); // 4 answers + 2 squats
    });
  });

  describe('3. 실측 시간 정합성 및 큰 dt overshoot 방지', () => {
    it('28박 루프 완주 시 큰 dt로 overshoot가 발생해도 activeDurationSeconds는 정확히 14.0초이다', () => {
      const controller = createController(plan36);

      // 13.0초까지 진행 후, 한 번에 25.0초로 큰 dt 점프
      controller.update(13.0);
      controller.update(25.0);

      expect(controller.isCompleted).toBe(true);
      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.activeDurationSeconds).toBeCloseTo(14.0, 5);
    });

    it('32박 루프 완주 시 큰 dt로 overshoot가 발생해도 activeDurationSeconds는 정확히 16.0초이다', () => {
      const controller = createController(plan40);

      // 한 번에 30.0초로 업데이트
      controller.update(30.0);

      expect(controller.isCompleted).toBe(true);
      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.activeDurationSeconds).toBeCloseTo(16.0, 5);
    });

    it('러닝/낭독 중 일시정지(pause/resume) 시 일시정지 시간은 제외되고 총 14.0초로 정합된다', () => {
      const controller = createController(plan36);

      // 러닝/낭독 구간(0~4초) 중 일시정지
      controller.update(2.0);
      controller.pause();
      // 일시정지 중 시간 흐름 무시
      controller.update(10.0);
      controller.resume();

      // 재개 후 나머지 시간 진행 (14초 도달)
      controller.update(14.0);

      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.activeDurationSeconds).toBeCloseTo(14.0, 5);
    });

    it('조우 도중 일시정지 후 재개 시 안전 재준비 시간(+1.5초)이 포함된 경계 시간(15.5초)으로 정합된다', () => {
      const controller = createController(plan36);

      // 1번째 조우(4.0~6.0초) 도중 5.0초 시점에 일시정지
      controller.update(5.0);
      controller.pause();
      controller.resume(); // DEC-B8 미완료 공격 재시작+안전 재준비(+1.5초)로 총 계획 시간 15.5초가 됨

      // 14.0초 시점에서는 아직 미완료 (안전 재준비로 15.5초 종료)
      controller.update(14.0);
      expect(controller.isCompleted).toBe(false);

      // overshoot 22.0초로 업데이트해도 정확히 15.5초로 정합 (overshoot 0)
      controller.update(22.0);
      expect(controller.isCompleted).toBe(true);

      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.activeDurationSeconds).toBeCloseTo(controller.timeline!.totalSeconds, 5);
      expect(summary.activeDurationSeconds).toBeCloseTo(15.5, 5);
    });
  });

  describe('4. 중간 중단(abort) 및 사망(defeat) 시 정합성', () => {
    it('중간 abort 발생 시 completedQuestions: 0, isAborted: true이며 실제 활성 시간만 보존된다', () => {
      const onRoundComplete = vi.fn();
      const controller = createController(plan36, { onRoundComplete });

      // 10.0초 시점에 진행
      controller.update(10.0);
      controller.abort('user_quit');

      expect(controller.isCompleted).toBe(true);
      expect(controller.completedSuccess).toBe(false);
      expect(onRoundComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          reason: 'user_quit',
        }),
      );

      const summary = controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.completedQuestions).toBe(0);
      expect(summary.isAborted).toBe(true);
      expect(summary.isDefeated).toBe(false);
      expect(summary.activeDurationSeconds).toBeCloseTo(10.0, 5);
    });

    it('사망(defeat) 발생 시 completedQuestions: 0, isDefeated: true, isAborted: true이며 4기회 시도가 보존된다', () => {
      const controller = createController(plan36);
      const answerEncounters = plan36.encounters.filter((e) => e.kind === 'answer_pair');

      // 4회 모두 오답 제출
      for (const enc of answerEncounters) {
        const midT = enc.startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
        controller.submitPunch('right', Math.round(midT * 1000), { activeSeconds: midT });
      }

      // 4번째 피격으로 사망하여 abort 처리
      controller.abort('player_dead');

      const summary = controller.finalizeRoundSummary({ isDefeated: true })!;
      expect(summary.completedQuestions).toBe(0);
      expect(summary.isDefeated).toBe(true);
      expect(summary.isAborted).toBe(true);
      expect(summary.wrongCount).toBe(4);
      expect(summary.attemptedAnswerHits).toBe(4);
    });

    it('완주 후 finalize에 isDefeated: true가 전달되어도 사망 우선으로 completedQuestions: 0', () => {
      const controller = createController(plan36);
      controller.update(18.0);
      expect(controller.isCompleted).toBe(true);

      const summary = controller.finalizeRoundSummary({ isDefeated: true })!;
      expect(summary.completedQuestions).toBe(0);
      expect(summary.isDefeated).toBe(true);
      expect(summary.isAborted).toBe(true);
    });
  });

  describe('5. finalize 멱등성 및 레거시 호환성', () => {
    it('중복 finalizeRoundSummary 호출 시 항상 동일한 불변 객체를 반환한다', () => {
      const onSummaryFinalized = vi.fn();
      const controller = createController(plan36, { onSummaryFinalized });
      controller.update(18.0);

      const first = controller.finalizeRoundSummary({ isDefeated: false });
      const second = controller.finalizeRoundSummary({ isDefeated: true }); // 두 번째 호출의 옵션은 무시됨

      expect(first).toBe(second);
      expect(first).toBe(controller.getRoundSummary());
      expect(onSummaryFinalized).toHaveBeenCalledTimes(1);
    });

    it('loopPlan 미주입(legacy) 시 기존 요약 API 및 집계 방식과 100% 동일하게 동작한다', () => {
      const legacyPlan = {
        encounters: [
          {
            id: 'legacy_p1',
            kind: 'answer_pair' as const,
            startBeat: 2,
            durationBeats: 4,
            interactionProfileId: 'profile_punch_default',
            visualProfileId: 'bullet_choice_basic',
            pairId: 'legacy_p1_pair',
            correctSide: 'left' as const,
          },
        ],
      };
      const ctrl = new AssaultRoundController({
        sessionId: 'sess_legacy' as SessionId,
        roundId: 'round_legacy' as RoundId,
        question: sampleQuestion,
        plan: legacyPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      const R = ctrl.readingEndTime;
      ctrl.update(R + 1.0);
      // 도착(R + 3.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      ctrl.submitPunch('left', Math.round((R + 2.9) * 1000), { activeSeconds: R + 2.9 });
      ctrl.update(R + 4.0);

      expect(ctrl.isCompleted).toBe(true);
      const summary = ctrl.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.completedQuestions).toBe(1);
      expect(summary.correctCount).toBe(1);
      expect(summary.totalEncounters).toBe(1);
      expect(summary.attemptedAnswerHits).toBe(1);
    });
  });
});
