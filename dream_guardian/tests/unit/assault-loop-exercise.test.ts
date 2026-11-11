/**
 * assault-loop-exercise.test.ts - 보스 접근전(Boss Assault) 루프 러닝 실측 운동량 집계 단위 테스트
 *
 * @see docs/assault-loop/LOOP-07.md (ASSAULT-LOOP-07 / Issue #700)
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 */

import { describe, it, expect } from 'vitest';
import {
  AssaultExerciseTally,
  type AssaultExerciseSummary,
  type AssaultLoopExerciseSummary,
  type AssaultRunStepRecord,
} from '../../src/game/assault/AssaultExerciseTally.js';

describe('AssaultExerciseTally - 러닝 실측 운동량 집계 (ASSAULT-LOOP-07 / #700)', () => {
  describe('1. 초기 상태 및 루프 요약 DTO 기본값', () => {
    it('초기 생성 시 runStepCount가 0이어야 한다', () => {
      const tally = new AssaultExerciseTally();
      const loopSummary: AssaultLoopExerciseSummary = tally.getLoopExerciseSummary();

      expect(loopSummary.runStepCount).toBe(0);
      expect(loopSummary.leftPunchCount).toBe(0);
      expect(loopSummary.rightPunchCount).toBe(0);
      expect(loopSummary.totalPunchCount).toBe(0);
      expect(loopSummary.squatCount).toBe(0);
      expect(loopSummary.guardCount).toBe(0);
      expect(loopSummary.alternativeCount).toBe(0);
      expect(loopSummary.activeDurationSeconds).toBe(0);
      expect(loopSummary.processedInputIds).toEqual([]);
    });

    it('getLoopExerciseSummary는 칼로리 미지원(DEC-C5) 정책을 유지해야 한다', () => {
      const tally = new AssaultExerciseTally();
      const loopSummary = tally.getLoopExerciseSummary();

      expect(loopSummary.kcalSupported).toBe(false);
      expect(loopSummary.estimatedKcal).toBeNull();
      expect(loopSummary.kcalDetails).toBeDefined();
      expect(loopSummary.kcalDetails.supported).toBe(false);
    });

    it('getLoopExerciseSummary 반환 객체는 deepFreeze된 불변 DTO여야 한다', () => {
      const tally = new AssaultExerciseTally();
      const loopSummary = tally.getLoopExerciseSummary();

      expect(Object.isFrozen(loopSummary)).toBe(true);
      expect(() => {
        (loopSummary as unknown as { runStepCount: number }).runStepCount = 999;
      }).toThrow();
    });
  });

  describe('2. 러닝 실측 걸음(runStep) 기록 및 멱등성 검증', () => {
    it('계획 8박을 가짜 8걸음으로 채우지 않고 실제 유효 측정 입력만 집계한다 (0회 측정 시 0회, 3회 측정 시 3회)', () => {
      const tally = new AssaultExerciseTally();

      // 0회 측정 시
      expect(tally.getLoopExerciseSummary().runStepCount).toBe(0);

      // 3회 실측 입력 기록
      const step1: AssaultRunStepRecord = {
        inputId: 'run_step_001',
        roundId: 'round_1',
        isValid: true,
        timestampMs: 1000,
        activeTimestampSeconds: 1.0,
      };
      const step2: AssaultRunStepRecord = {
        inputId: 'run_step_002',
        roundId: 'round_1',
        isValid: true,
        timestampMs: 1500,
        activeTimestampSeconds: 1.5,
      };
      const step3: AssaultRunStepRecord = {
        inputId: 'run_step_003',
        roundId: 'round_1',
        isValid: true,
        timestampMs: 2000,
        activeTimestampSeconds: 2.0,
      };

      expect(tally.recordRunStep(step1)).toBe(true);
      expect(tally.recordRunStep(step2)).toBe(true);
      expect(tally.recordRunStep(step3)).toBe(true);

      const loopSummary = tally.getLoopExerciseSummary();
      expect(loopSummary.runStepCount).toBe(3);
      expect(loopSummary.processedInputIds).toContain('run_step_001');
      expect(loopSummary.processedInputIds).toContain('run_step_002');
      expect(loopSummary.processedInputIds).toContain('run_step_003');
    });

    it('동일한 inputId의 중복 입력은 거부되고 카운트가 증가하지 않아야 한다 (멱등성)', () => {
      const tally = new AssaultExerciseTally();
      const step: AssaultRunStepRecord = {
        inputId: 'run_step_dup',
        roundId: 'round_1',
        isValid: true,
      };

      expect(tally.recordRunStep(step)).toBe(true);
      expect(tally.recordRunStep(step)).toBe(false);

      const summary = tally.getLoopExerciseSummary();
      expect(summary.runStepCount).toBe(1);
      expect(summary.processedInputIds.filter((id) => id === 'run_step_dup').length).toBe(1);
    });

    it('isValid === false인 입력은 거부되고 카운트가 증가하지 않아야 한다', () => {
      const tally = new AssaultExerciseTally();
      const invalidStep: AssaultRunStepRecord = {
        inputId: 'run_step_invalid',
        isValid: false,
      };

      expect(tally.recordRunStep(invalidStep)).toBe(false);
      expect(tally.getLoopExerciseSummary().runStepCount).toBe(0);
      expect(tally.getLoopExerciseSummary().processedInputIds).not.toContain('run_step_invalid');
    });

    it('빈 객체이거나 inputId가 없는 입력은 거부되어야 한다', () => {
      const tally = new AssaultExerciseTally();

      expect(tally.recordRunStep(null as unknown as AssaultRunStepRecord)).toBe(false);
      expect(tally.recordRunStep(undefined as unknown as AssaultRunStepRecord)).toBe(false);
      expect(tally.recordRunStep({ inputId: '' } as AssaultRunStepRecord)).toBe(false);
      expect(tally.getLoopExerciseSummary().runStepCount).toBe(0);
    });

    it('다른 라운드라도 inputId가 고유하면 정상 집계된다', () => {
      const tally = new AssaultExerciseTally();
      tally.recordRunStep({ inputId: 'step_r1_1', roundId: 'round_1', isValid: true });
      tally.recordRunStep({ inputId: 'step_r1_2', roundId: 'round_1', isValid: true });
      tally.recordRunStep({ inputId: 'step_r2_1', roundId: 'round_2', isValid: true });

      expect(tally.getLoopExerciseSummary().runStepCount).toBe(3);
    });
  });

  describe('3. 기존 포트 호환성 및 스키마 보존 검증', () => {
    it('기존 getSummary() 출력 필드 집합은 runStepCount를 포함하지 않고 기존 스키마를 100% 보존해야 한다', () => {
      const tally = new AssaultExerciseTally();
      tally.recordRunStep({ inputId: 'step_legacy_test', isValid: true });

      const legacySummary: AssaultExerciseSummary = tally.getSummary();
      // 기존 스키마 필드 확인
      expect(legacySummary.leftPunchCount).toBe(0);
      expect(legacySummary.rightPunchCount).toBe(0);
      expect(legacySummary.totalPunchCount).toBe(0);
      expect(legacySummary.squatCount).toBe(0);
      expect(legacySummary.guardCount).toBe(0);
      expect(legacySummary.alternativeCount).toBe(0);
      expect(legacySummary.activeDurationSeconds).toBe(0);
      expect(legacySummary.kcalSupported).toBe(false);
      expect(legacySummary.estimatedKcal).toBeNull();
      expect(legacySummary.partialSquatKcal).toBe(0);
      expect(legacySummary.processedInputIds).toEqual(['step_legacy_test']);

      // getSummary() 키 목록 검증 (기존 AssaultExerciseSummary 필드 집합에 runStepCount가 노출되지 않음)
      expect('runStepCount' in legacySummary).toBe(false);
    });

    it('기존 getLegacyResultPatch() 출력 스키마가 불변이어야 한다', () => {
      const tally = new AssaultExerciseTally();
      tally.recordRunStep({ inputId: 'step_patch_test', isValid: true });

      const patch = tally.getLegacyResultPatch();
      expect(patch).toEqual({
        squats: 0,
        elapsedTime: 0,
        totalPunches: 0,
        leftPunches: 0,
        rightPunches: 0,
        guards: 0,
        calories: null,
      });
      expect('runStepCount' in patch).toBe(false);
    });
  });

  describe('4. reset() 및 독립 세션 초기화 검증', () => {
    it('reset() 호출 시 runStepCount와 처리된 inputId 목록이 깨끗이 초기화되어야 한다', () => {
      const tally = new AssaultExerciseTally();
      tally.recordRunStep({ inputId: 'step_reset_01', isValid: true });
      expect(tally.getLoopExerciseSummary().runStepCount).toBe(1);

      tally.reset();

      const resetSummary = tally.getLoopExerciseSummary();
      expect(resetSummary.runStepCount).toBe(0);
      expect(resetSummary.processedInputIds).toEqual([]);

      // 리셋 후 이전 inputId 재등록 가능 검증
      expect(tally.recordRunStep({ inputId: 'step_reset_01', isValid: true })).toBe(true);
      expect(tally.getLoopExerciseSummary().runStepCount).toBe(1);
    });
  });
});
