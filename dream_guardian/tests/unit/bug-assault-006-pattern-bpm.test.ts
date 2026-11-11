import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASSAULT_CONFIG,
  DEFAULT_ASSAULT_BPM,
  type AssaultTimingAndBalanceConfig,
} from '../../config/assault.config.js';
import { AssaultClockAdapter } from '../../src/core/AssaultClockAdapter.js';
import {
  compileAssaultPlan,
  DEFAULT_ASSAULT_BPM as COMPILER_DEFAULT_ASSAULT_BPM,
} from '../../src/game/assault/AssaultPlanCompiler.js';
import {
  DEFAULT_APPROACH_PATTERN,
  EXTENDED_16_APPROACH_PATTERN,
  APPROACH_PATTERNS,
} from '../../src/data/assault/approachPatterns.js';
import { validateAssaultPlan } from '../../src/game/assault/AssaultPlanValidator.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';

describe('[BUG-ASSAULT-006 / Issue #674] MVP 공격 콘텐츠·BPM 기본값 DOC-14 §5.2 단일 SSOT 정합성', () => {
  describe('1. BPM 기본값 단일 SSOT (Single Source of Truth) 검증', () => {
    it('config/assault.config.ts에서 DEFAULT_ASSAULT_BPM = 120이 export되어야 한다 (DOC-14 §5.2, #503 승인 사양)', () => {
      expect(DEFAULT_ASSAULT_BPM).toBe(120);
    });

    it('DEFAULT_ASSAULT_CONFIG에 defaultBpm = 120이 정의되어 있어야 한다', () => {
      expect((DEFAULT_ASSAULT_CONFIG as AssaultTimingAndBalanceConfig).defaultBpm).toBe(120);
      expect((DEFAULT_ASSAULT_CONFIG as AssaultTimingAndBalanceConfig).defaultBpm).toBe(DEFAULT_ASSAULT_BPM);
    });

    it('AssaultPlanCompiler의 기본 BPM이 config의 DEFAULT_ASSAULT_BPM(120)과 동일해야 한다', () => {
      expect(COMPILER_DEFAULT_ASSAULT_BPM).toBe(DEFAULT_ASSAULT_BPM);
      expect(COMPILER_DEFAULT_ASSAULT_BPM).toBe(120);
    });

    it('AssaultClockAdapter를 옵션 없이 생성했을 때 bpm이 100이 아닌 DEFAULT_ASSAULT_BPM(120)이어야 한다', () => {
      const clock = new AssaultClockAdapter();
      expect(clock.bpm).toBe(120);
      expect(clock.bpm).toBe(DEFAULT_ASSAULT_BPM);
      expect(clock.bpm).not.toBe(100);
    });

    it('AssaultRoundController를 bpm 옵션 없는 plan으로 생성 시 DEFAULT_ASSAULT_BPM(120)으로 초기화되어야 한다', () => {
      const compiledPlan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN);
      const controller = new AssaultRoundController({
        sessionId: 'session_bpm_test',
        roundId: 'round_bpm_test',
        plan: compiledPlan,
        question: '2 + 3 = ?',
      });
      expect(controller.bpm).toBe(120);
      expect(controller.bpm).toBe(DEFAULT_ASSAULT_BPM);
    });

    it('compileAssaultPlan 기본 결과와 AssaultClockAdapter의 박자당 시간(secondsPerBeat)이 0.5초로 정확히 일치해야 한다', () => {
      const clock = new AssaultClockAdapter();
      const plan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN);

      expect(plan.bpm).toBe(120);
      expect(clock.bpm).toBe(120);
      expect(clock.secondsPerBeat).toBeCloseTo(0.5, 5);
      expect(60 / plan.bpm).toBeCloseTo(0.5, 5);
      expect(clock.secondsPerBeat).toBeCloseTo(60 / plan.bpm, 5);
    });
  });

  describe('2. MVP 8박 공격 콘텐츠 및 패턴 (#503 결정 원장 준수) 검증', () => {
    it('DEFAULT_APPROACH_PATTERN은 #503 승인 원장에 따라 총 8박(답안 4박 1쌍 + 스쿼트 4박 1회)이어야 한다', () => {
      expect(DEFAULT_APPROACH_PATTERN.totalBeats).toBe(8);
      expect(DEFAULT_APPROACH_PATTERN.encounters).toHaveLength(2);

      const [encounter1, encounter2] = DEFAULT_APPROACH_PATTERN.encounters;
      expect(encounter1.kind).toBe('answer_pair');
      expect(encounter1.startBeat).toBe(0);
      expect(encounter1.durationBeats).toBe(4);

      expect(encounter2.kind).toBe('squat');
      expect(encounter2.startBeat).toBe(4);
      expect(encounter2.durationBeats).toBe(4);
    });

    it('DEFAULT_APPROACH_PATTERN이 validateAssaultPlan을 오류 없이 통과해야 한다', () => {
      const validation = validateAssaultPlan(DEFAULT_APPROACH_PATTERN);
      expect(validation.valid).toBe(true);
      if (validation.valid) {
        expect(validation.data).toBe(DEFAULT_APPROACH_PATTERN);
      }
    });

    it('APPROACH_PATTERNS 레지스트리에 기본 패턴이 등록되어 있어야 한다', () => {
      expect(APPROACH_PATTERNS['pattern_approach_standard_mvp']).toBe(DEFAULT_APPROACH_PATTERN);
      expect(APPROACH_PATTERNS['pattern_approach_extended_16']).toBe(EXTENDED_16_APPROACH_PATTERN);
    });

    it('확장 16박 패턴(EXTENDED_16_APPROACH_PATTERN)도 validateAssaultPlan 및 compileAssaultPlan을 통과해야 한다', () => {
      const validation = validateAssaultPlan(EXTENDED_16_APPROACH_PATTERN);
      expect(validation.valid).toBe(true);

      const compiled = compileAssaultPlan(EXTENDED_16_APPROACH_PATTERN);
      expect(compiled.totalBeats).toBe(16);
      expect(compiled.encounters).toHaveLength(4);
      expect(compiled.bpm).toBe(120);
    });
  });
});
