/**
 * assault-loop-plan.test.ts
 *
 * [ASSAULT-LOOP-02 / Issue #695]
 * 시드·라운드 번호 기반 36/40박 루프 계획 생성 및 사전 검증 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  buildAssaultLoopPlan,
  validateLoopPlan,
  projectToApproachPattern,
  AssaultLoopPlanBuilder,
  AssaultLoopPlanError,
} from '../../src/game/assault/AssaultLoopPlanBuilder.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  ASSAULT_LOOP_RUN_BEATS,
  ASSAULT_LOOP_ANSWER_BEATS,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import { validateAssaultPlan } from '../../src/game/assault/AssaultPlanValidator.js';
import type { AssaultLoopRoundPlan } from '../../src/types/assault-loop.js';

const SQUAT_ENABLED_LOOP_CONFIG: AssaultLoopConfig = {
  ...DEFAULT_ASSAULT_LOOP_CONFIG,
  minSquatsPerRound: 1,
  maxSquatsPerRound: 2,
};

describe('ASSAULT-LOOP-02 Assault Loop Plan Builder Tests', () => {
  describe('1. 결정론적 시드 및 라운드 계획 생성 (Determinism)', () => {
    it('동일한 seed와 roundNumber는 항상 동일한 계획을 생성해야 한다', () => {
      const planA = buildAssaultLoopPlan({ seed: 'test-seed-42', roundNumber: 1 });
      const planB = buildAssaultLoopPlan({ seed: 'test-seed-42', roundNumber: 1 });

      expect(planA).toEqual(planB);
      expect(planA.totalBeats).toBe(planB.totalBeats);
      expect(planA.squatGapIndices).toEqual(planB.squatGapIndices);
      expect(planA.segments.length).toBe(planB.segments.length);
    });

    it('숫자 시드 및 문자열 시드 모두 결정론적으로 동작해야 한다', () => {
      const numPlan1 = buildAssaultLoopPlan({ seed: 123456, roundNumber: 2 });
      const numPlan2 = buildAssaultLoopPlan({ seed: 123456, roundNumber: 2 });
      expect(numPlan1).toEqual(numPlan2);

      const strPlan1 = buildAssaultLoopPlan({ seed: 'boss_forget_ch1', roundNumber: 3 });
      const strPlan2 = buildAssaultLoopPlan({ seed: 'boss_forget_ch1', roundNumber: 3 });
      expect(strPlan1).toEqual(strPlan2);
    });

    it('인자 전달 방식(오브젝트 또는 위치 인자) 모두 호환되어야 한다', () => {
      const planByObj = buildAssaultLoopPlan({ seed: 9999, roundNumber: 1, bpm: 120 });
      const planByArgs = buildAssaultLoopPlan(9999, 1, { bpm: 120 });

      expect(planByObj).toEqual(planByArgs);
    });

    it('유효하지 않은 seed 또는 roundNumber는 원자적으로 거부되어야 한다', () => {
      expect(() => buildAssaultLoopPlan({ seed: NaN, roundNumber: 1 })).toThrow(AssaultLoopPlanError);
      expect(() => buildAssaultLoopPlan({ seed: Infinity, roundNumber: 1 })).toThrow(AssaultLoopPlanError);
      expect(() => buildAssaultLoopPlan({ seed: 100, roundNumber: -1 })).toThrow(AssaultLoopPlanError);
      expect(() => buildAssaultLoopPlan({ seed: 100, roundNumber: 1.5 })).toThrow(AssaultLoopPlanError);
    });
  });

  describe('2. 스쿼트 후보 gap 및 총 박자/시간 사양 (기본 24박 및 커스텀 28/32박)', () => {
    it('기본 프로필은 스쿼트 0개, 총 24박(12초)이어야 한다 (#744)', () => {
      const plan = buildAssaultLoopPlan({ seed: 'gap-test', roundNumber: 1 });
      expect(plan.squatCount).toBe(0);
      expect(plan.squatGapIndices).toEqual([]);
      expect(plan.totalBeats).toBe(24);
      expect(plan.totalSeconds).toBe(12);
    });

    it('커스텀 프로필(min1/max2)에서 스쿼트 개수는 1개 또는 2개이며, gap 후보 [1, 2, 3] 중 중복 없이 선택되어야 한다', () => {
      const plan = buildAssaultLoopPlan({
        seed: 'gap-test-custom',
        roundNumber: 1,
        loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
      });

      expect([1, 2]).toContain(plan.squatCount);
      expect(plan.squatGapIndices.length).toBe(plan.squatCount);

      // 모든 gap은 [1, 2, 3]에 속하고 중복이 없으며 오름차순이어야 한다
      for (const gap of plan.squatGapIndices) {
        expect([1, 2, 3]).toContain(gap);
      }
      const uniqueGaps = new Set(plan.squatGapIndices);
      expect(uniqueGaps.size).toBe(plan.squatGapIndices.length);

      if (plan.squatGapIndices.length === 2) {
        expect(plan.squatGapIndices[0]).toBeLessThan(plan.squatGapIndices[1]);
      }
    });

    it('커스텀 프로필(min1/max2)에서 N=1일 때 28박(14초), N=2일 때 32박(16초) (120 BPM 기준)이어야 한다', () => {
      // 50개의 다양한 시드를 검사하여 모든 경우 28박 또는 32박을 만족하는지 검증
      for (let i = 0; i < 50; i++) {
        const plan = buildAssaultLoopPlan({
          seed: `seed_variety_${i}`,
          roundNumber: i + 1,
          bpm: 120,
          loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
        });
        if (plan.squatCount === 1) {
          expect(plan.totalBeats).toBe(28);
          expect(plan.totalSeconds).toBe(14);
        } else {
          expect(plan.totalBeats).toBe(32);
          expect(plan.totalSeconds).toBe(16);
        }
      }
    });

    it('다양한 BPM(90, 120, 150)에서 totalSeconds 계산이 정확해야 한다', () => {
      const plan90 = buildAssaultLoopPlan({ seed: 777, roundNumber: 1, bpm: 90 });
      const plan120 = buildAssaultLoopPlan({ seed: 777, roundNumber: 1, bpm: 120 });
      const plan150 = buildAssaultLoopPlan({ seed: 777, roundNumber: 1, bpm: 150 });

      // 동일 시드이므로 총 박자는 동일
      expect(plan90.totalBeats).toBe(plan120.totalBeats);
      expect(plan150.totalBeats).toBe(plan120.totalBeats);

      const beats = plan120.totalBeats;
      expect(plan90.totalSeconds).toBeCloseTo((beats * 60) / 90, 4);
      expect(plan120.totalSeconds).toBeCloseTo((beats * 60) / 120, 4);
      expect(plan150.totalSeconds).toBeCloseTo((beats * 60) / 150, 4);
    });
  });

  describe('3. 구간(Segments) 구성 및 연속성 (No Overlap, No Gaps)', () => {
    it('구간은 run8 1회, answer4 4회, squat4 N회를 포함해야 하며 rest(0박)는 제외되어야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'segment-count-test', roundNumber: 1 });

      const runs = plan.segments.filter((s) => s.kind === 'run_question');
      const answers = plan.segments.filter((s) => s.kind === 'answer');
      const rests = plan.segments.filter((s) => s.kind === 'rest');
      const squats = plan.segments.filter((s) => s.kind === 'squat');

      expect(runs.length).toBe(1);
      expect(answers.length).toBe(4);
      expect(rests.length).toBe(0);
      expect(squats.length).toBe(plan.squatCount);
      expect(plan.segments.length).toBe(1 + 4 + plan.squatCount);
    });

    it('첫 구간은 반드시 0~8박 run_question이어야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'first-segment', roundNumber: 1 });
      const first = plan.segments[0];

      expect(first.kind).toBe('run_question');
      expect(first.segmentIndex).toBe(0);
      expect(first.startBeat).toBe(0);
      expect(first.durationBeats).toBe(ASSAULT_LOOP_RUN_BEATS);
      expect(first.endBeat).toBe(8);
    });

    it('마지막 구간은 반드시 최종 4번째 answer(4박)여야 하며, 전체 totalBeats에 종료되어야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'last-segment', roundNumber: 1 });
      const last = plan.segments[plan.segments.length - 1];

      expect(last.kind).toBe('answer');
      expect(last.opportunityIndex).toBe(4);
      expect(last.durationBeats).toBe(ASSAULT_LOOP_ANSWER_BEATS);
      expect(last.endBeat).toBe(plan.totalBeats);
    });

    it('모든 구간은 빈틈(gap)이나 겹침(overlap) 없이 완전 연속되어야 한다', () => {
      for (let i = 0; i < 20; i++) {
        const plan = buildAssaultLoopPlan({ seed: `continuity_${i}`, roundNumber: i + 1 });
        expect(plan.segments[0].startBeat).toBe(0);

        for (let j = 0; j < plan.segments.length; j++) {
          const seg = plan.segments[j];
          expect(seg.segmentIndex).toBe(j);
          expect(seg.endBeat).toBe(seg.startBeat + seg.durationBeats);

          if (j > 0) {
            const prev = plan.segments[j - 1];
            expect(seg.startBeat).toBe(prev.endBeat);
            expect(seg.startSeconds).toBeCloseTo(prev.endSeconds, 6);
          }
        }
      }
    });

    it('각 squat 구간은 직전 answer 완료 후 별도 삽입되며 다음 answer 전에 배치되어야 한다', () => {
      for (let i = 0; i < 20; i++) {
        const plan = buildAssaultLoopPlan({ seed: `squat_placement_${i}`, roundNumber: i + 1 });

        for (let j = 0; j < plan.segments.length; j++) {
          const seg = plan.segments[j];
          if (seg.kind === 'squat') {
            const prev = plan.segments[j - 1];
            const next = plan.segments[j + 1];

            expect(prev).toBeDefined();
            expect(prev.kind).toBe('answer');
            expect(prev.opportunityIndex).toBe(seg.gapIndex);

            expect(next).toBeDefined();
            expect(next.kind).toBe('answer');
            expect(next.opportunityIndex).toBe((seg.gapIndex ?? 0) + 1);
          }
        }
      }
    });

    it('스쿼트 구간은 notice(1박) + dodge(2박) + stand(1박)의 하위 구간을 정확히 가져야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'squat_sub_test', roundNumber: 1 });
      const squatSegments = plan.segments.filter((s) => s.kind === 'squat');

      for (const squat of squatSegments) {
        expect(squat.squatSubSegments).toBeDefined();
        const subs = squat.squatSubSegments!;
        expect(subs.length).toBe(3);

        expect(subs[0].kind).toBe('notice');
        expect(subs[0].durationBeats).toBe(1);
        expect(subs[0].startBeat).toBe(squat.startBeat);
        expect(subs[0].endBeat).toBe(squat.startBeat + 1);

        expect(subs[1].kind).toBe('dodge');
        expect(subs[1].durationBeats).toBe(2);
        expect(subs[1].startBeat).toBe(squat.startBeat + 1);
        expect(subs[1].endBeat).toBe(squat.startBeat + 3);

        expect(subs[2].kind).toBe('stand');
        expect(subs[2].durationBeats).toBe(1);
        expect(subs[2].startBeat).toBe(squat.startBeat + 3);
        expect(subs[2].endBeat).toBe(squat.startBeat + 4);
      }
    });
  });

  describe('4. 전투 조우(Encounters) 매핑 및 기존 Validator/Compiler 호환성', () => {
    it('전투 조우 목록에는 answer_pair 4개와 squat 1~2개만 포함되어야 한다 (run, rest 제외)', () => {
      const plan = buildAssaultLoopPlan({ seed: 'encounter-test', roundNumber: 1 });

      const kinds = plan.encounters.map((e) => e.kind);
      expect(kinds).not.toContain('run_question');
      expect(kinds).not.toContain('rest');

      const answerEncounters = plan.encounters.filter((e) => e.kind === 'answer_pair');
      const squatEncounters = plan.encounters.filter((e) => e.kind === 'squat');

      expect(answerEncounters.length).toBe(4);
      expect(squatEncounters.length).toBe(plan.squatCount);
      expect(plan.encounters.length).toBe(4 + plan.squatCount);
    });

    it('조우 목록은 startBeat 기준 오름차순으로 정렬되어야 하며 겹치지 않아야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'encounter-order', roundNumber: 1 });

      for (let i = 0; i < plan.encounters.length - 1; i++) {
        const current = plan.encounters[i];
        const next = plan.encounters[i + 1];

        expect(current.startBeat).toBeLessThan(next.startBeat);
        expect(current.startBeat + current.durationBeats).toBeLessThanOrEqual(next.startBeat);
      }
    });

    it('투영된 패턴은 기존 validateAssaultPlan을 100% 통과해야 한다', () => {
      for (let i = 0; i < 10; i++) {
        const plan = buildAssaultLoopPlan({ seed: `val_compat_${i}`, roundNumber: i + 1 });
        const approachPattern = projectToApproachPattern(plan);

        const result = validateAssaultPlan(approachPattern);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      }
    });

    it('기존 compileAssaultPlan과 완벽히 연동되고 compiledPlan이 생성되어야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'compiler_compat', roundNumber: 1, bpm: 120 });

      expect(plan.compiledPlan).toBeDefined();
      expect(plan.compiledPlan!.totalBeats).toBe(plan.totalBeats);
      expect(plan.compiledPlan!.encounters.length).toBe(plan.encounters.length);
    });
  });

  describe('5. 유효성 검증(validateLoopPlan) 및 결함 거부 (Atomicity)', () => {
    it('정상 계획은 validateLoopPlan 검증을 통과해야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'valid_check', roundNumber: 1 });
      expect(() => validateLoopPlan(plan)).not.toThrow();
    });

    it('마지막 rest가 누락되거나 변조된 계획은 거부해야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'corrupt_rest', roundNumber: 1 });
      const corruptedSegments = [...plan.segments];
      corruptedSegments.pop(); // 마지막 rest 제거

      const corruptedPlan: AssaultLoopRoundPlan = {
        ...plan,
        segments: corruptedSegments,
      };

      expect(() => validateLoopPlan(corruptedPlan)).toThrow(AssaultLoopPlanError);
    });

    it('구간 사이에 gap(빈틈)이 존재하면 거부해야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'gap_check', roundNumber: 1 });
      const corruptedSegments = plan.segments.map((s, idx) => {
        if (idx === 2) {
          return { ...s, startBeat: s.startBeat + 1, endBeat: s.endBeat + 1 };
        }
        return s;
      });

      const corruptedPlan: AssaultLoopRoundPlan = {
        ...plan,
        segments: corruptedSegments,
      };

      expect(() => validateLoopPlan(corruptedPlan)).toThrow(AssaultLoopPlanError);
    });

    it('총 박자 수가 36 또는 40이 아니면 거부해야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'beats_check', roundNumber: 1 });
      const corruptedPlan: AssaultLoopRoundPlan = {
        ...plan,
        totalBeats: 38,
      };

      expect(() => validateLoopPlan(corruptedPlan)).toThrow(AssaultLoopPlanError);
    });
  });

  describe('6. 불변성(Immutability) 보장', () => {
    it('생성된 계획 객체 및 하위 배열들은 딥 프리즈되어 수정할 수 없어야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'freeze_test', roundNumber: 1 });

      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan.segments)).toBe(true);
      expect(Object.isFrozen(plan.encounters)).toBe(true);
      expect(Object.isFrozen(plan.squatGapIndices)).toBe(true);

      // 객체 수정 시도 시 TypeError 발생
      expect(() => {
        (plan as any).totalBeats = 99;
      }).toThrow();
      expect(() => {
        (plan.segments as any).push({} as any);
      }).toThrow();
    });
  });

  describe('7. AssaultLoopPlanBuilder 클래스 정적 메서드 호환성', () => {
    it('AssaultLoopPlanBuilder.build 및 validate가 정상 작동해야 한다', () => {
      const plan = AssaultLoopPlanBuilder.build('class-test-seed', 2, { roundId: 'round_custom_2' });
      expect(plan.roundId).toBe('round_custom_2');
      expect(() => AssaultLoopPlanBuilder.validate(plan)).not.toThrow();
    });
  });
});
