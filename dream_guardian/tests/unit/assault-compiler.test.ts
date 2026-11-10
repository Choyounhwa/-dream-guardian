import { describe, it, expect, vi } from 'vitest';
import {
  compileAssaultPlan,
  tryCompileAssaultPlan,
  beatToSeconds,
  secondsToBeat,
  AssaultCompileError,
  type AssaultCompileOptions,
} from '../../src/game/assault/AssaultPlanCompiler.js';
import {
  DEFAULT_APPROACH_PATTERN,
  type AssaultApproachPattern,
} from '../../src/data/assault/approachPatterns.js';

describe('[BOSS-ASSAULT-06 / #508] 불변 실행 시간표 순수 컴파일 (AssaultPlanCompiler)', () => {
  describe('1. 박자-초 변환 순수 수학 함수 검증 (beatToSeconds & secondsToBeat)', () => {
    it('startBeat=0일 때 모든 BPM에서 seconds=0이어야 한다', () => {
      expect(beatToSeconds(0, 120)).toBe(0);
      expect(beatToSeconds(0, 100)).toBe(0);
      expect(beatToSeconds(0, 90)).toBe(0);
      expect(beatToSeconds(0, 150)).toBe(0);
    });

    it('120 BPM에서 0-based 비트가 기대 초(seconds = beat * 60 / bpm)와 정확히 일치해야 한다', () => {
      // 120 BPM: 1 beat = 0.5s
      expect(beatToSeconds(1, 120)).toBeCloseTo(0.5, 6);
      expect(beatToSeconds(2, 120)).toBeCloseTo(1.0, 6);
      expect(beatToSeconds(4, 120)).toBeCloseTo(2.0, 6);
      expect(beatToSeconds(8, 120)).toBeCloseTo(4.0, 6);
    });

    it('100 BPM에서 0-based 비트가 기대 초와 정확히 일치해야 한다', () => {
      // 100 BPM: 1 beat = 0.6s
      expect(beatToSeconds(1, 100)).toBeCloseTo(0.6, 6);
      expect(beatToSeconds(2, 100)).toBeCloseTo(1.2, 6);
      expect(beatToSeconds(4, 100)).toBeCloseTo(2.4, 6);
      expect(beatToSeconds(8, 100)).toBeCloseTo(4.8, 6);
    });

    it('소수점 비트(fractional beats)가 오차 없이 초로 환산되어야 한다 (A17)', () => {
      expect(beatToSeconds(0.5, 120)).toBeCloseTo(0.25, 6);
      expect(beatToSeconds(1.5, 120)).toBeCloseTo(0.75, 6);
      expect(beatToSeconds(3.5, 120)).toBeCloseTo(1.75, 6);
      expect(beatToSeconds(3.8, 120)).toBeCloseTo(1.9, 6);

      expect(beatToSeconds(0.5, 100)).toBeCloseTo(0.3, 6);
      expect(beatToSeconds(2.5, 100)).toBeCloseTo(1.5, 6);
      expect(beatToSeconds(3.5, 100)).toBeCloseTo(2.1, 6);
    });

    it('secondsToBeat 역변환이 정확해야 한다', () => {
      expect(secondsToBeat(0, 120)).toBe(0);
      expect(secondsToBeat(2.0, 120)).toBeCloseTo(4, 6);
      expect(secondsToBeat(2.4, 100)).toBeCloseTo(4, 6);
    });

    it('유효하지 않은 BPM(0 이하, NaN, Infinity) 전달 시 에러를 던져야 한다', () => {
      expect(() => beatToSeconds(1, 0)).toThrow();
      expect(() => beatToSeconds(1, -100)).toThrow();
      expect(() => beatToSeconds(1, Number.NaN)).toThrow();
      expect(() => beatToSeconds(1, Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe('2. 기본 MVP 패턴(DEFAULT_APPROACH_PATTERN) 컴파일 검증', () => {
    it('120 BPM 기준으로 기본 패턴을 순수 컴파일하여 시간표를 정확히 생성해야 한다', () => {
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120 });

      expect(plan.schemaVersion).toBe('1.0.0');
      expect(plan.patternId).toBe('pattern_approach_standard_mvp');
      expect(plan.bpm).toBe(120);
      expect(plan.secondsPerBeat).toBeCloseTo(0.5, 6);
      expect(plan.totalBeats).toBe(8);
      expect(plan.totalDurationSeconds).toBeCloseTo(4.0, 6);
      expect(plan.encounters).toHaveLength(2);

      // Encounter 0: answer_pair (0~4박)
      const enc0 = plan.encounters[0];
      expect(enc0.id).toBe('attack_01_answer');
      expect(enc0.kind).toBe('answer_pair');
      expect(enc0.index).toBe(0);
      expect(enc0.startBeat).toBe(0);
      expect(enc0.durationBeats).toBe(4);
      expect(enc0.launchBeat).toBe(0);
      expect(enc0.launchSeconds).toBeCloseTo(0, 6);
      expect(enc0.windowStartBeat).toBe(0);
      expect(enc0.windowStartSeconds).toBeCloseTo(0, 6);
      expect(enc0.windowEndBeat).toBe(4);
      expect(enc0.windowEndSeconds).toBeCloseTo(2.0, 6);
      expect(enc0.impactBeat).toBe(4);
      expect(enc0.impactSeconds).toBeCloseTo(2.0, 6);
      expect(enc0.retractDeadlineBeat).toBe(4);
      expect(enc0.retractDeadlineSeconds).toBeCloseTo(2.0, 6);
      expect(enc0.durationSeconds).toBeCloseTo(2.0, 6);

      // Encounter 1: squat (4~8박)
      const enc1 = plan.encounters[1];
      expect(enc1.id).toBe('attack_02_squat');
      expect(enc1.kind).toBe('squat');
      expect(enc1.index).toBe(1);
      expect(enc1.startBeat).toBe(4);
      expect(enc1.durationBeats).toBe(4);
      expect(enc1.launchBeat).toBe(4);
      expect(enc1.launchSeconds).toBeCloseTo(2.0, 6);
      expect(enc1.windowStartBeat).toBe(4);
      expect(enc1.windowStartSeconds).toBeCloseTo(2.0, 6);
      expect(enc1.windowEndBeat).toBe(8);
      expect(enc1.windowEndSeconds).toBeCloseTo(4.0, 6);
      expect(enc1.impactBeat).toBe(8);
      expect(enc1.impactSeconds).toBeCloseTo(4.0, 6);
      expect(enc1.retractDeadlineBeat).toBe(8);
      expect(enc1.retractDeadlineSeconds).toBeCloseTo(4.0, 6);
      expect(enc1.durationSeconds).toBeCloseTo(2.0, 6);
    });

    it('100 BPM 기준으로 기본 패턴을 컴파일할 때 초(seconds) 단위가 100 BPM에 맞게 고정되어야 한다', () => {
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 100 });

      expect(plan.bpm).toBe(100);
      expect(plan.secondsPerBeat).toBeCloseTo(0.6, 6);
      expect(plan.totalDurationSeconds).toBeCloseTo(4.8, 6);

      expect(plan.encounters[0].launchSeconds).toBeCloseTo(0, 6);
      expect(plan.encounters[0].windowEndSeconds).toBeCloseTo(2.4, 6);
      expect(plan.encounters[0].impactSeconds).toBeCloseTo(2.4, 6);

      expect(plan.encounters[1].launchSeconds).toBeCloseTo(2.4, 6);
      expect(plan.encounters[1].windowEndSeconds).toBeCloseTo(4.8, 6);
      expect(plan.encounters[1].impactSeconds).toBeCloseTo(4.8, 6);
    });

    it('BPM 옵션을 생략하면 기본 120 BPM이 적용되어야 한다', () => {
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN);
      expect(plan.bpm).toBe(120);
      expect(plan.secondsPerBeat).toBeCloseTo(0.5, 6);
    });
  });

  describe('3. 세부 하위 창(Sub-Window) 타임스탬프 계산 검증 (launch, windowStart, impact, windowEnd, retractDeadline)', () => {
    it('세부 하위 창(windowStartBeat, windowEndBeat, arrivalBeat, recoveryBeat)이 명시된 패턴의 시간표를 정확히 계산해야 한다', () => {
      const customPattern = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_with_subwindows',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_sub_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 0.5,
            windowEndBeat: 3.5,
            arrivalBeat: 3.8,
            recoveryBeat: 4.0,
          },
        ],
      };

      const plan = compileAssaultPlan(customPattern, { bpm: 120 });
      const enc = plan.encounters[0];

      // Beats
      expect(enc.launchBeat).toBe(0);
      expect(enc.windowStartBeat).toBe(0.5);
      expect(enc.windowEndBeat).toBe(3.5);
      expect(enc.impactBeat).toBe(3.8);
      expect(enc.arrivalBeat).toBe(3.8);
      expect(enc.retractDeadlineBeat).toBe(4.0);
      expect(enc.recoveryBeat).toBe(4.0);

      // Seconds at 120 BPM (0.5s per beat)
      expect(enc.launchSeconds).toBeCloseTo(0.0, 6);
      expect(enc.startSeconds).toBeCloseTo(0.0, 6);
      expect(enc.windowStartSeconds).toBeCloseTo(0.25, 6); // 0.5 * 0.5
      expect(enc.windowEndSeconds).toBeCloseTo(1.75, 6);   // 3.5 * 0.5
      expect(enc.impactSeconds).toBeCloseTo(1.9, 6);      // 3.8 * 0.5
      expect(enc.arrivalSeconds).toBeCloseTo(1.9, 6);
      expect(enc.retractDeadlineSeconds).toBeCloseTo(2.0, 6); // 4.0 * 0.5
      expect(enc.recoverySeconds).toBeCloseTo(2.0, 6);
    });

    it('100 BPM(0.6s per beat)에서 세부 하위 창의 타임스탬프를 계산해야 한다', () => {
      const customPattern = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_sub_100bpm',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_sub_100',
            kind: 'squat' as const,
            startBeat: 2,
            durationBeats: 4,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
            windowStartBeat: 2.5,
            windowEndBeat: 5.0,
            arrivalBeat: 5.5,
            recoveryBeat: 6.0,
          },
        ],
      };

      const plan = compileAssaultPlan(customPattern, { bpm: 100 });
      const enc = plan.encounters[0];

      expect(enc.launchSeconds).toBeCloseTo(1.2, 6);            // 2.0 * 0.6
      expect(enc.windowStartSeconds).toBeCloseTo(1.5, 6);       // 2.5 * 0.6
      expect(enc.windowEndSeconds).toBeCloseTo(3.0, 6);         // 5.0 * 0.6
      expect(enc.impactSeconds).toBeCloseTo(3.3, 6);            // 5.5 * 0.6
      expect(enc.retractDeadlineSeconds).toBeCloseTo(3.6, 6);   // 6.0 * 0.6
    });
  });

  describe('4. 동일 시각 경계 및 복귀 간격 보존 검증 (A17)', () => {
    it('조우 사이의 복귀 간격(recovery gap)을 보존하고 계산해야 한다', () => {
      const patternWithGap: AssaultApproachPattern = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_with_gap',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 10,
        encounters: [
          {
            id: 'atk_gap_01',
            kind: 'answer_pair',
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_gap_02',
            kind: 'squat',
            startBeat: 5, // 4박 종료 후 1박 간격
            durationBeats: 4,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };

      const plan = compileAssaultPlan(patternWithGap, { bpm: 120 });
      expect(plan.encounters[0].gapFromPreviousBeats).toBe(0);
      expect(plan.encounters[0].gapFromPreviousSeconds).toBe(0);

      expect(plan.encounters[1].gapFromPreviousBeats).toBe(1);
      expect(plan.encounters[1].gapFromPreviousSeconds).toBeCloseTo(0.5, 6);
    });

    it('연속된 조우(gap=0)에서 논리적 배열 순서가 엄격히 보존되어야 한다', () => {
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120 });
      expect(plan.encounters[0].index).toBe(0);
      expect(plan.encounters[1].index).toBe(1);
      expect(plan.encounters[1].startBeat).toBe(plan.encounters[0].startBeat + plan.encounters[0].durationBeats);
    });
  });

  describe('5. 결정성(Determinism) 및 주입 시드/옵션 고정 검증', () => {
    it('동일 입력, 시드, 옵션에 대해 100% 동일한 깊은 동등성(Deep Equality) 결과를 반환해야 한다', () => {
      const options: AssaultCompileOptions = {
        bpm: 110,
        seed: 'fixed_seed_42',
        questionRef: 'q_addition_123',
        sessionId: 'session_fixed_test',
        roundId: 'round_01',
      };

      const plan1 = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, options);
      const plan2 = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, options);

      expect(plan1).toEqual(plan2);
      expect(plan1.seed).toBe('fixed_seed_42');
      expect(plan1.questionRef).toBe('q_addition_123');
      expect(plan1.sessionId).toBe('session_fixed_test');
      expect(plan1.roundId).toBe('round_01');
    });

    it('질문 참조가 객체인 경우에도 깊은 복사되어 안전하게 보존되어야 한다', () => {
      const questionObj = { id: 'q_obj_1', expression: '2+3', answer: 5 };
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, {
        questionRef: questionObj,
      });

      expect(plan.questionRef).toEqual(questionObj);
      expect(Object.isFrozen(plan.questionRef)).toBe(true);
    });
  });

  describe('6. 불변성(Immutability) 및 deepFreeze 검증', () => {
    it('반환된 계획 객체 및 모든 하위 객체가 deepFreeze(Object.isFrozen)되어야 한다', () => {
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120 });

      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan.encounters)).toBe(true);
      for (const enc of plan.encounters) {
        expect(Object.isFrozen(enc)).toBe(true);
      }
    });

    it('컴파일 후 반환 객체의 필드를 수정하려고 하면 TypeError가 발생해야 한다 (엄격 모드)', () => {
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120 });

      expect(() => {
        // @ts-expect-error - readonly 수정 시도
        plan.bpm = 140;
      }).toThrow();

      expect(() => {
        // @ts-expect-error - readonly 수정 시도
        plan.encounters[0].launchSeconds = 999;
      }).toThrow();
    });

    it('컴파일 후 원본 입력 패턴을 변경해도 이미 생성된 계획은 영향을 받지 않아야 한다', () => {
      const mutablePattern: AssaultApproachPattern = {
        schemaVersion: '1.0.0',
        patternId: 'mutable_pattern',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_mut_01',
            kind: 'answer_pair',
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };

      const plan = compileAssaultPlan(mutablePattern, { bpm: 120 });

      // 원본 변경 시도
      // @ts-expect-error - 원본 수정 시뮬레이션
      mutablePattern.encounters[0].startBeat = 10;

      expect(plan.encounters[0].startBeat).toBe(0);
      expect(plan.encounters[0].launchSeconds).toBe(0);
    });
  });

  describe('7. 검증 실패 입력에 대한 컴파일 거부 및 에러 반환 검증', () => {
    it('비객체(null, undefined, 원시값) 입력 시 AssaultCompileError를 던져야 한다', () => {
      expect(() => compileAssaultPlan(null)).toThrow(AssaultCompileError);
      expect(() => compileAssaultPlan(undefined)).toThrow(AssaultCompileError);
      expect(() => compileAssaultPlan('invalid')).toThrow(AssaultCompileError);
    });

    it('박자 역전(ORDER_INVERSION)이 있는 잘못된 패턴 입력 시 컴파일을 거부해야 한다', () => {
      const invertedPattern = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_inverted',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_01',
            kind: 'answer_pair',
            startBeat: 4,
            durationBeats: 2,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_02',
            kind: 'squat',
            startBeat: 2, // 2 < 4 (역전)
            durationBeats: 2,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };

      expect(() => compileAssaultPlan(invertedPattern)).toThrow(AssaultCompileError);
    });

    it('하위 창 역전(windowStart > windowEnd)이 있는 패턴 입력 시 컴파일을 거부해야 한다', () => {
      const invalidWindowPattern = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_invalid_window',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_01',
            kind: 'answer_pair',
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 3.5,
            windowEndBeat: 1.0, // 3.5 > 1.0
          },
        ],
      };

      expect(() => compileAssaultPlan(invalidWindowPattern)).toThrow(AssaultCompileError);
    });

    it('tryCompileAssaultPlan은 에러를 던지지 않고 에러 목록을 포함한 실패 객체를 반환해야 한다', () => {
      const result = tryCompileAssaultPlan(null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.error).toBeInstanceOf(AssaultCompileError);
      }
    });

    it('tryCompileAssaultPlan은 정상 데이터에 대해 성공 객체와 동결 계획을 반환해야 한다', () => {
      const result = tryCompileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.plan).toBeDefined();
        expect(result.plan.bpm).toBe(120);
        expect(Object.isFrozen(result.plan)).toBe(true);
      }
    });
  });

  describe('8. 부작용 배제 순수성 검증 (타이머, rAF, Math.random, Date.now 호출 0회)', () => {
    it('컴파일 과정에서 Math.random, Date.now, 타이머, rAF가 일체 호출되지 않아야 한다', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      const dateNowSpy = vi.spyOn(Date, 'now');
      const perfNowSpy = vi.spyOn(performance, 'now');
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, {
        bpm: 120,
        seed: 'test_seed_deterministic',
      });

      expect(plan).toBeDefined();
      expect(randomSpy).toHaveBeenCalledTimes(0);
      expect(dateNowSpy).toHaveBeenCalledTimes(0);
      expect(perfNowSpy).toHaveBeenCalledTimes(0);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
      expect(setIntervalSpy).toHaveBeenCalledTimes(0);

      randomSpy.mockRestore();
      dateNowSpy.mockRestore();
      perfNowSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });
});
