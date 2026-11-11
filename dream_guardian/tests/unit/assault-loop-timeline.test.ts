/**
 * assault-loop-timeline.test.ts
 *
 * [ASSAULT-LOOP-04 / GitHub Issue #697]
 * 명시 구간 루프 활성시계 진행과 8박 내 읽기·TTS 통합 TDD 검증 슈트
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultLoopTimeline } from '../../src/game/assault/AssaultLoopTimeline.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { buildAssaultLoopPlan } from '../../src/game/assault/AssaultLoopPlanBuilder.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import type { AssaultLoopRoundPlan } from '../../src/types/assault-loop.js';
import type { SessionId, RoundId, AttackId, PairId } from '../../src/types/assault.js';

const SQUAT_ENABLED_LOOP_CONFIG: AssaultLoopConfig = {
  ...DEFAULT_ASSAULT_LOOP_CONFIG,
  minSquatsPerRound: 1,
  maxSquatsPerRound: 2,
};

describe('[ASSAULT-LOOP-04 / #697] Assault Loop Timeline & Run8 Reading/TTS Integration', () => {
  const sampleQuestion = {
    id: 'q_test_loop_04',
    text: '12 + 15 = ?',
    minReadSeconds: 3.5, // Even if minReadSeconds is large, loopPlan must not add additive reading time!
  };

  // Build deterministic plans with 1 squat (28 beats) and 2 squats (32 beats) using custom config
  const plan36 = buildAssaultLoopPlan({
    seed: 'test-seed-1-squat',
    roundNumber: 1,
    loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
  });
  // Find a seed for 32 beats (2 squats)
  let plan40: AssaultLoopRoundPlan | null = null;
  for (let r = 1; r <= 20; r++) {
    const candidate = buildAssaultLoopPlan({
      seed: 'test-seed-squats',
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

  describe('1. AssaultLoopTimeline 단위 테스트 (시간축, 구간 경계, 시프트)', () => {
    it('28박 및 32박 계획의 기본 길이와 초 단위 정밀 변환을 보장해야 한다', () => {
      const timeline36 = new AssaultLoopTimeline(plan36, 120);
      expect(timeline36.baseTotalBeats).toBe(28);
      expect(timeline36.baseTotalSeconds).toBe(14.0);
      expect(timeline36.totalSeconds).toBe(14.0);
      expect(timeline36.totalShiftSeconds).toBe(0);

      const timeline40 = new AssaultLoopTimeline(plan40!, 120);
      expect(timeline40.baseTotalBeats).toBe(32);
      expect(timeline40.baseTotalSeconds).toBe(16.0);
      expect(timeline40.totalSeconds).toBe(16.0);
      expect(timeline40.totalShiftSeconds).toBe(0);
    });

    it('getCurrentSegment가 활성 시각에 맞는 구간을 정확히 반환해야 한다', () => {
      const timeline = new AssaultLoopTimeline(plan36, 120);
      // t=0: run_question (0..4.0s)
      const segAt0 = timeline.getCurrentSegment(0);
      expect(segAt0).not.toBeNull();
      expect(segAt0?.kind).toBe('run_question');
      expect(segAt0?.startSeconds).toBe(0);
      expect(segAt0?.endSeconds).toBe(4.0);

      // t=2.0: still run_question
      expect(timeline.getCurrentSegment(2.0)?.kind).toBe('run_question');

      // t=4.5: answer (opp 1, 4.0..6.0s)
      const segAt4_5 = timeline.getCurrentSegment(4.5);
      expect(segAt4_5?.kind).toBe('answer');
      expect(segAt4_5?.opportunityIndex).toBe(1);

      // t=6.5: squat or answer
      const segAt6_5 = timeline.getCurrentSegment(6.5);
      expect(segAt6_5).not.toBeNull();
      expect(['answer', 'squat']).toContain(segAt6_5?.kind);

      // t >= totalSeconds: null
      expect(timeline.getCurrentSegment(14.0)).toBeNull();
      expect(timeline.getCurrentSegment(15.0)).toBeNull();
      expect(timeline.getCurrentSegment(-0.1)).toBeNull();
    });

    it('getPendingTransitions가 구간 경계 진입 시 순차적으로 전이 목록을 반환해야 한다', () => {
      const timeline = new AssaultLoopTimeline(plan36, 120);

      // t=0 진입 시 최초 run_question 진입 전이 발생
      const trans0 = timeline.getPendingTransitions(0);
      expect(trans0.length).toBe(1);
      expect(trans0[0].segment.kind).toBe('run_question');
      expect(trans0[0].prevSegment).toBeUndefined();

      // t=2.0: 추가 전이 없음
      expect(timeline.getPendingTransitions(2.0).length).toBe(0);

      // t=4.0: answer 1 진입 전이 발생
      const trans4 = timeline.getPendingTransitions(4.0);
      expect(trans4.length).toBe(1);
      expect(trans4[0].segment.kind).toBe('answer');
      expect(trans4[0].prevSegment?.kind).toBe('run_question');

      // 큰 dt 점프 (t=4.0에서 t=8.5로 점프):
      // answer1(4..6) -> rest1(6..7) -> squat 또는 answer2(7..) 전이가 순서대로 모두 추출되어야 함
      const transJump = timeline.getPendingTransitions(8.5);
      expect(transJump.length).toBeGreaterThanOrEqual(2);
      expect(transJump[0].segment.startSeconds).toBeLessThan(transJump[1].segment.startSeconds);
    });

    it('applyShift 호출 시 지정 조우 이후 구간과 최종 구간이 delta만큼 이동하고 baseTotal은 보존되어야 한다', () => {
      const timeline = new AssaultLoopTimeline(plan36, 120);
      const lastSegOriginalStart = timeline.segments[timeline.segments.length - 1].startSeconds;

      // answer 1 조우에 0.5초(1박) 시프트 적용
      const firstAnswerAttackId = plan36.encounters[0].id;
      timeline.applyShift({ attackId: firstAnswerAttackId, deltaSeconds: 0.5 });

      expect(timeline.baseTotalSeconds).toBe(14.0);
      expect(timeline.baseTotalBeats).toBe(28);
      expect(timeline.totalShiftSeconds).toBe(0.5);
      expect(timeline.totalSeconds).toBe(14.5);

      // 최종 구간도 0.5초 뒤로 이동했는지 검증
      const lastSegShifted = timeline.segments[timeline.segments.length - 1];
      expect(lastSegShifted.startSeconds).toBeCloseTo(lastSegOriginalStart + 0.5);
      expect(lastSegShifted.endSeconds).toBeCloseTo(14.5);
      expect(timeline.isCompleted(14.0)).toBe(false);
      expect(timeline.isCompleted(14.5)).toBe(true);
    });
  });

  describe('2. AssaultRoundController - loopPlan 주입 시 동작 검증', () => {
    it('loopPlan 주입 시 throwDurationSeconds=0, 추가 읽기 가산 0, t=0에 가독성 보장 및 TTS 1회 발화', () => {
      const onTtsSpeak = vi.fn();
      const onLoopSegmentChange = vi.fn();
      const onRunEnd = vi.fn();

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_01' as SessionId,
        roundId: 'round_loop_01' as RoundId,
        question: sampleQuestion,
        plan: plan36,
        loopPlan: plan36,
        bpm: 120,
        onTtsSpeak,
        onLoopSegmentChange,
        onRunEnd,
      });

      // 1. throwDurationSeconds는 0이어야 함
      expect(controller.throwDurationSeconds).toBe(0);
      expect(controller.phase).toBe('question_reading');

      // 2. readingDurationSeconds는 run_question 8박(4.0초)이어야 하며, minReadSeconds 3.5초가 별도로 가산되지 않음
      expect(controller.readingDurationSeconds).toBe(4.0);
      expect(controller.readingEndTime).toBe(4.0);

      // 3. t=0 update 시 TTS 정확히 1회 호출
      controller.update(0);
      expect(onTtsSpeak).toHaveBeenCalledTimes(1);
      expect(onTtsSpeak).toHaveBeenCalledWith('12 + 15 = ?');

      // t=0에서 표시 스냅샷 검증 (문제 가독성 즉시 확보, 투척 1초 대기 없음)
      const snapshot0 = controller.getPresentationSnapshot();
      expect(snapshot0.readingProgress).toBe(0.0);
      expect(snapshot0.phase).toBe('question_reading');
      expect(controller.throwDurationSeconds).toBe(0);

      // 4. t=2.0 업데이트 시 TTS 중복 발화 0
      controller.update(2.0);
      expect(onTtsSpeak).toHaveBeenCalledTimes(1);
    });

    it('TTS 콜백이 동기 에러를 던지거나 지연되더라도 라운드 진행을 블로킹하지 않아야 한다', () => {
      const throwingTts = vi.fn().mockImplementation(() => {
        throw new Error('TTS Speech synthesis failed');
      });

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_err' as SessionId,
        roundId: 'round_loop_err' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        onTtsSpeak: throwingTts,
      });

      // update(0)에서 예외가 발생하지 않고 정상 진행되어야 함
      expect(() => controller.update(0)).not.toThrow();
      expect(throwingTts).toHaveBeenCalledTimes(1);
      expect(controller.phase).toBe('question_reading');
    });

    it('8박(4.0초) 종료 시점에 encounters 단계로 진입하고 run 종료 콜백을 발생시켜야 한다', () => {
      const onLoopSegmentChange = vi.fn();
      const onRunEnd = vi.fn();

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_run8' as SessionId,
        roundId: 'round_loop_run8' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        onLoopSegmentChange,
        onRunEnd,
      });

      controller.update(0);
      expect(controller.phase).toBe('question_reading');

      // t=3.99s: 여전히 question_reading
      controller.update(3.99);
      expect(controller.phase).toBe('question_reading');
      expect(onRunEnd).not.toHaveBeenCalled();

      // t=4.0s (8박 완료): encounters 단계 진입 및 answer1 시작
      controller.update(4.0);
      expect(controller.phase).toBe('encounters');
      expect(onRunEnd).toHaveBeenCalledTimes(1);

      // onLoopSegmentChange 검증: run_question -> answer
      const answerChange = onLoopSegmentChange.mock.calls.find(
        (call) => call[0]?.kind === 'answer' && call[1]?.kind === 'run_question',
      );
      expect(answerChange).toBeDefined();
    });

    it('answer 구간 내 조기 입력이 발생하더라도 4박 타임라인을 유지해야 한다', () => {
      const onEncounterStart = vi.fn();
      const onEncounterEnd = vi.fn();

      const controller = new AssaultRoundController({
        sessionId: 'sess_early_ans' as SessionId,
        roundId: 'round_early_ans' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        onEncounterStart,
        onEncounterEnd,
      });

      controller.update(0);
      controller.update(4.0); // answer 1 시작 (4.0s ~ 6.0s)
      expect(onEncounterStart).toHaveBeenCalledTimes(1);

      // t=4.5s에 사용자가 조기 답안 제출 (성공)
      controller.submitPunch('left', 4500, { activeSeconds: 4.5 });

      // 조기 입력 후에도 다음 encounter가 바로 시작되지 않고 기존 타임라인 유지
      controller.update(5.0);
      expect(onEncounterStart).toHaveBeenCalledTimes(1); // 아직 다음 조우 미시작

      // answer 1의 마감 시각(6.0s + lateGrace)까지는 다음 조우가 시작되지 않음
      controller.update(6.0);
      expect(controller.isCompleted).toBe(false);
    });

    it('모든 조우가 완료된 후에도 마지막 rest(2박) 끝에서만 onRoundComplete가 1회 발생해야 한다', () => {
      const onRoundComplete = vi.fn();
      const onLoopSegmentChange = vi.fn();

      const controller = new AssaultRoundController({
        sessionId: 'sess_rest_end' as SessionId,
        roundId: 'round_rest_end' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36, // 36박 = 18.0초
        bpm: 120,
        onRoundComplete,
        onLoopSegmentChange,
      });

      controller.update(0);

      // 4회 answer 조우를 각각 조기 완료하면서 진행
      const ansEncs = plan36.encounters.filter((e) => e.kind === 'answer_pair');
      for (const enc of ansEncs) {
        const midT = enc.startBeat * 0.5 + 0.5;
        controller.update(midT);
        controller.submitPunch('left', Math.round(midT * 1000), { activeSeconds: midT });
      }

      // 마지막 answer 완료 직후 (예: t=13.5s): 아직 14.0초 도달 전이므로 미완료
      controller.update(13.5);
      expect(controller.isCompleted).toBe(false);
      expect(onRoundComplete).not.toHaveBeenCalled();

      // t=13.99s: 아직 14.0초 도달 전이므로 미완료
      controller.update(13.99);
      expect(controller.isCompleted).toBe(false);
      expect(onRoundComplete).not.toHaveBeenCalled();

      // t=14.0s: 최종 완료 시점에 정확히 1회 roundComplete 트리거!
      controller.update(14.0);
      expect(controller.isCompleted).toBe(true);
      expect(onRoundComplete).toHaveBeenCalledTimes(1);
      expect(onRoundComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess_rest_end',
          roundId: 'round_rest_end',
          success: true,
        }),
      );

      // 이후 추가 update가 들어와도 중복 complete 0회
      controller.update(14.5);
      expect(onRoundComplete).toHaveBeenCalledTimes(1);
    });

    it('pause 및 resume: run/rest 중 재개 시 남은 구간 보존 및 TTS 재발화 0', () => {
      const onTtsSpeak = vi.fn();
      const controller = new AssaultRoundController({
        sessionId: 'sess_pause_run' as SessionId,
        roundId: 'round_pause_run' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        onTtsSpeak,
      });

      controller.update(0);
      controller.update(2.0); // run_question 4초 중 2초 진행
      expect(onTtsSpeak).toHaveBeenCalledTimes(1);

      // 일시정지
      controller.pause('user_pause');
      expect(controller.isPaused).toBe(true);

      // 정지 중 update는 시간 진행을 차단함
      controller.update(2.5);

      // 재개
      controller.resume();
      expect(controller.isPaused).toBe(false);

      // 재개 후 update: TTS 재발화 없음
      controller.update(2.5);
      expect(onTtsSpeak).toHaveBeenCalledTimes(1);

      // 남은 1.5초 후(t=4.0)에 정확히 run이 완료되고 encounters 진입
      controller.update(3.99);
      expect(controller.phase).toBe('question_reading');
      controller.update(4.0);
      expect(controller.phase).toBe('encounters');
    });

    it('pause 및 resume: 미해결 공격 진행 중 재개 시 1박 준비 유예 및 후속 구간 delta 이동', () => {
      const onRoundComplete = vi.fn();
      const controller = new AssaultRoundController({
        sessionId: 'sess_pause_atk' as SessionId,
        roundId: 'round_pause_atk' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36, // base 14.0s
        bpm: 120,
        onRoundComplete,
      });

      controller.update(0);
      controller.update(4.5); // answer 1(4.0..6.0s) 미해결 진행 중

      // 일시정지 후 재개
      controller.pause('tracking_lost');
      controller.resume();

      // 재개 시 1박(0.5초) 준비 유예가 제공되어 타임라인 전체가 delta만큼 뒤로 밀려야 함
      // 14.0초에는 아직 끝나지 않음
      controller.update(14.0);
      expect(controller.isCompleted).toBe(false);
      expect(onRoundComplete).not.toHaveBeenCalled();

      // 이동된 종료 시각(예: 14.5초 이상) 도달 시 완료
      controller.update(16.0);
      expect(controller.isCompleted).toBe(true);
      expect(onRoundComplete).toHaveBeenCalledTimes(1);
    });

    it('abort 호출 시 후속 경계·조우·완료 콜백이 일체 실행되지 않아야 한다', () => {
      const onRoundComplete = vi.fn();
      const onEncounterStart = vi.fn();
      const onLoopSegmentChange = vi.fn();

      const controller = new AssaultRoundController({
        sessionId: 'sess_abort' as SessionId,
        roundId: 'round_abort' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        onRoundComplete,
        onEncounterStart,
        onLoopSegmentChange,
      });

      controller.update(0);
      controller.update(2.0);

      // 외부 사망/중단 통지 (Core abort 소비)
      controller.abort('player_dead');
      expect(controller.isCompleted).toBe(true);
      expect(onRoundComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess_abort',
          roundId: 'round_abort',
          success: false,
          reason: 'player_dead',
        }),
      );

      const startCountBefore = onEncounterStart.mock.calls.length;
      const segCountBefore = onLoopSegmentChange.mock.calls.length;

      // abort 이후 대규모 시간 점프
      controller.update(10.0);
      controller.update(25.0);

      // 후속 조우 시작 0회, 후속 구간 변경 0회, 추가 완료 콜백 0회
      expect(onEncounterStart.mock.calls.length).toBe(startCountBefore);
      expect(onLoopSegmentChange.mock.calls.length).toBe(segCountBefore);
      expect(onRoundComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Legacy 미주입 경로 100% 동등성 보존 검증', () => {
    it('loopPlan이 없을 때는 기존 throwDurationSeconds 및 calculateReadingDurationSeconds가 적용되어야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'sess_legacy' as SessionId,
        roundId: 'round_legacy' as RoundId,
        question: sampleQuestion, // minReadSeconds: 3.5
        plan: {
          encounters: [
            {
              id: 'atk_leg_01' as AttackId,
              kind: 'answer_pair',
              startBeat: 0,
              durationBeats: 4,
              interactionProfileId: 'profile_punch' as any,
              visualProfileId: 'profile_pair' as any,
              pairId: 'pair_leg_01' as PairId,
            },
          ],
          bpm: 120,
        },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // 기존 throwDurationSeconds=1.0 적용
      expect(controller.throwDurationSeconds).toBe(1.0);
      expect(controller.phase).toBe('throw_in');

      // 기존 calculateReadingDurationSeconds 계산 결과 적용 (minReadSeconds 3.5s 등 반영되어 > 1.0)
      expect(controller.readingDurationSeconds).toBeGreaterThan(1.0);
      expect(controller.readingEndTime).toBe(1.0 + controller.readingDurationSeconds);
    });
  });
});
