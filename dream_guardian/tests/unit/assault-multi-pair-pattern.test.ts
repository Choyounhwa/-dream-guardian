/**
 * assault-multi-pair-pattern.test.ts
 *
 * [ASSAULT-CHALLENGE-CH-06] (#651) 다중 답 쌍 접근전 패턴 데이터 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APPROACH_PATTERN,
  EXTENDED_16_APPROACH_PATTERN,
  MULTI_PAIR_20_APPROACH_PATTERN,
  MULTI_PAIR_32_APPROACH_PATTERN,
  APPROACH_PATTERNS,
} from '../../src/data/assault/approachPatterns.js';
import { validateAssaultPlan } from '../../src/game/assault/AssaultPlanValidator.js';
import { compileAssaultPlan } from '../../src/game/assault/AssaultPlanCompiler.js';

describe('[ASSAULT-CHALLENGE-CH-06] (#651) 다중 답 쌍 접근전 패턴 데이터', () => {
  describe('기존 패턴 보존 검증', () => {
    it('기존 DEFAULT_APPROACH_PATTERN 및 EXTENDED_16_APPROACH_PATTERN이 불변으로 유지되어야 한다', () => {
      expect(DEFAULT_APPROACH_PATTERN.patternId).toBe('pattern_approach_standard_mvp');
      expect(DEFAULT_APPROACH_PATTERN.totalBeats).toBe(8);
      expect(DEFAULT_APPROACH_PATTERN.encounters).toHaveLength(2);

      expect(EXTENDED_16_APPROACH_PATTERN.patternId).toBe('pattern_approach_extended_16');
      expect(EXTENDED_16_APPROACH_PATTERN.totalBeats).toBe(16);
      expect(EXTENDED_16_APPROACH_PATTERN.encounters).toHaveLength(4);

      expect(APPROACH_PATTERNS['pattern_approach_standard_mvp']).toBe(DEFAULT_APPROACH_PATTERN);
      expect(APPROACH_PATTERNS['pattern_approach_extended_16']).toBe(EXTENDED_16_APPROACH_PATTERN);
    });
  });

  describe('3쌍 20박 패턴 (MULTI_PAIR_20_APPROACH_PATTERN)', () => {
    it('레지스트리에 정상 등록되어 있어야 한다', () => {
      expect(MULTI_PAIR_20_APPROACH_PATTERN).toBeDefined();
      expect(APPROACH_PATTERNS['pattern_approach_multi_pair_20']).toBe(MULTI_PAIR_20_APPROACH_PATTERN);
      expect(APPROACH_PATTERNS['pattern_approach_multi_pair_3']).toBe(MULTI_PAIR_20_APPROACH_PATTERN);
    });

    it('3쌍 답안(각 4박)과 2회 스쿼트(각 4박)로 총 20박을 구성해야 한다', () => {
      expect(MULTI_PAIR_20_APPROACH_PATTERN.totalBeats).toBe(20);
      expect(MULTI_PAIR_20_APPROACH_PATTERN.encounters).toHaveLength(5);

      const kinds = MULTI_PAIR_20_APPROACH_PATTERN.encounters.map((e) => e.kind);
      expect(kinds).toEqual(['answer_pair', 'squat', 'answer_pair', 'squat', 'answer_pair']);
    });

    it('각 answer_pair는 고유한 pairId를 가져야 한다', () => {
      const answerEncounters = MULTI_PAIR_20_APPROACH_PATTERN.encounters.filter(
        (e) => e.kind === 'answer_pair',
      );
      expect(answerEncounters).toHaveLength(3);

      const pairIds = answerEncounters.map((e) => (e as any).pairId);
      expect(pairIds).toEqual(['pair_01', 'pair_02', 'pair_03']);
      const uniquePairIds = new Set(pairIds);
      expect(uniquePairIds.size).toBe(3);
    });

    it('박자 중첩 및 간격 결함 없이 validateAssaultPlan을 통과해야 한다', () => {
      const result = validateAssaultPlan(MULTI_PAIR_20_APPROACH_PATTERN);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toBe(MULTI_PAIR_20_APPROACH_PATTERN);
      }
    });

    it('compileAssaultPlan으로 런타임 공격 계획 컴파일이 성공해야 한다', () => {
      const plan = compileAssaultPlan(MULTI_PAIR_20_APPROACH_PATTERN, { bpm: 120 });
      expect(plan.patternId).toBe(MULTI_PAIR_20_APPROACH_PATTERN.patternId);
      expect(plan.totalBeats).toBe(20);
      expect(plan.encounters).toHaveLength(5);
      expect(plan.bpm).toBe(120);
    });

    it('deepFreeze 불변성이 유지되어야 한다', () => {
      expect(Object.isFrozen(MULTI_PAIR_20_APPROACH_PATTERN)).toBe(true);
      expect(Object.isFrozen(MULTI_PAIR_20_APPROACH_PATTERN.encounters)).toBe(true);
      for (const enc of MULTI_PAIR_20_APPROACH_PATTERN.encounters) {
        expect(Object.isFrozen(enc)).toBe(true);
      }
    });
  });

  describe('4쌍 32박 패턴 (MULTI_PAIR_32_APPROACH_PATTERN, #680 체계 연동)', () => {
    it('레지스트리에 정상 등록되어 있어야 한다', () => {
      expect(MULTI_PAIR_32_APPROACH_PATTERN).toBeDefined();
      expect(APPROACH_PATTERNS['pattern_approach_multi_pair_32']).toBe(MULTI_PAIR_32_APPROACH_PATTERN);
      expect(APPROACH_PATTERNS['pattern_approach_multi_pair_4']).toBe(MULTI_PAIR_32_APPROACH_PATTERN);
    });

    it('4쌍 답안(각 4박)과 4회 스쿼트(각 4박) 교대로 총 32박을 구성해야 한다', () => {
      expect(MULTI_PAIR_32_APPROACH_PATTERN.totalBeats).toBe(32);
      expect(MULTI_PAIR_32_APPROACH_PATTERN.encounters).toHaveLength(8);

      const kinds = MULTI_PAIR_32_APPROACH_PATTERN.encounters.map((e) => e.kind);
      expect(kinds).toEqual([
        'answer_pair',
        'squat',
        'answer_pair',
        'squat',
        'answer_pair',
        'squat',
        'answer_pair',
        'squat',
      ]);
    });

    it('각 answer_pair는 4개의 고유한 pairId를 가져야 한다', () => {
      const answerEncounters = MULTI_PAIR_32_APPROACH_PATTERN.encounters.filter(
        (e) => e.kind === 'answer_pair',
      );
      expect(answerEncounters).toHaveLength(4);

      const pairIds = answerEncounters.map((e) => (e as any).pairId);
      expect(pairIds).toEqual(['pair_01', 'pair_02', 'pair_03', 'pair_04']);
      const uniquePairIds = new Set(pairIds);
      expect(uniquePairIds.size).toBe(4);
    });

    it('박자 중첩 및 간격 결함 없이 validateAssaultPlan을 통과해야 한다', () => {
      const result = validateAssaultPlan(MULTI_PAIR_32_APPROACH_PATTERN);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toBe(MULTI_PAIR_32_APPROACH_PATTERN);
      }
    });

    it('compileAssaultPlan으로 런타임 공격 계획 컴파일이 성공해야 한다', () => {
      const plan = compileAssaultPlan(MULTI_PAIR_32_APPROACH_PATTERN, { bpm: 120 });
      expect(plan.patternId).toBe(MULTI_PAIR_32_APPROACH_PATTERN.patternId);
      expect(plan.totalBeats).toBe(32);
      expect(plan.encounters).toHaveLength(8);
      expect(plan.bpm).toBe(120);
    });

    it('deepFreeze 불변성이 유지되어야 한다', () => {
      expect(Object.isFrozen(MULTI_PAIR_32_APPROACH_PATTERN)).toBe(true);
      expect(Object.isFrozen(MULTI_PAIR_32_APPROACH_PATTERN.encounters)).toBe(true);
      for (const enc of MULTI_PAIR_32_APPROACH_PATTERN.encounters) {
        expect(Object.isFrozen(enc)).toBe(true);
      }
    });
  });
});
