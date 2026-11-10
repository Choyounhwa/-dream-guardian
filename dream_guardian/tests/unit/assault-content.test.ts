import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APPROACH_PATTERN,
  APPROACH_PATTERNS,
  type AssaultApproachPattern,
} from '../../src/data/assault/approachPatterns.js';
import type { AssaultEncounterDef } from '../../src/types/assault.js';

describe('[BOSS-ASSAULT-04 / #506] MVP 교대 공격 정적 콘텐츠', () => {
  describe('1. 기본 MVP 불변 접근 패턴 메타데이터 검증', () => {
    it('DEFAULT_APPROACH_PATTERN이 올바른 schemaVersion 및 patternId를 선언해야 한다', () => {
      expect(DEFAULT_APPROACH_PATTERN).toBeDefined();
      expect(DEFAULT_APPROACH_PATTERN.schemaVersion).toBe('1.0.0');
      expect(DEFAULT_APPROACH_PATTERN.patternId).toBe('pattern_approach_standard_mvp');
    });

    it('timingProfileId가 유효한 프로필 참조를 가져야 한다', () => {
      expect(
        DEFAULT_APPROACH_PATTERN.timingProfileId === 'profile_assault_standard' ||
        DEFAULT_APPROACH_PATTERN.timingProfileId === 'default_assault' ||
        DEFAULT_APPROACH_PATTERN.timingProfileId === 'assault_mvp_v1'
      ).toBe(true);
    });

    it('총 박자(totalBeats)는 8박(answer 4박 + squat 4박)이어야 한다', () => {
      expect(DEFAULT_APPROACH_PATTERN.totalBeats).toBe(8);
    });

    it('APPROACH_PATTERNS 레코드에 DEFAULT_APPROACH_PATTERN이 등록되어 있어야 한다', () => {
      expect(APPROACH_PATTERNS).toBeDefined();
      expect(APPROACH_PATTERNS['pattern_approach_standard_mvp']).toBe(DEFAULT_APPROACH_PATTERN);
    });
  });

  describe('2. 0-based 비트 및 교대 시퀀스 검증', () => {
    it('첫 번째 공격의 startBeat는 0이어야 한다 (0-based 시작 계약)', () => {
      const firstEncounter = DEFAULT_APPROACH_PATTERN.encounters[0];
      expect(firstEncounter).toBeDefined();
      expect(firstEncounter.startBeat).toBe(0);
    });

    it('교대 순서는 answer_pair (4박) -> squat (4박) 구조여야 한다', () => {
      const encounters = DEFAULT_APPROACH_PATTERN.encounters;
      expect(encounters).toHaveLength(2);

      const [first, second] = encounters;
      expect(first.kind).toBe('answer_pair');
      expect(first.startBeat).toBe(0);
      expect(first.durationBeats).toBe(4);

      expect(second.kind).toBe('squat');
      expect(second.startBeat).toBe(4);
      expect(second.durationBeats).toBe(4);
    });

    it('조우 구간 간에 겹침이 없고 연속적으로 이어져야 한다', () => {
      const [first, second] = DEFAULT_APPROACH_PATTERN.encounters;
      expect(first.startBeat + first.durationBeats).toBe(second.startBeat);
      expect(second.startBeat + second.durationBeats).toBe(DEFAULT_APPROACH_PATTERN.totalBeats);
    });

    it('각 조우는 고유한 id와 유효한 profileId 참조를 가져야 한다', () => {
      const encounters = DEFAULT_APPROACH_PATTERN.encounters;
      const ids = encounters.map((e) => e.id);
      expect(new Set(ids).size).toBe(encounters.length);

      for (const enc of encounters) {
        expect(typeof enc.id).toBe('string');
        expect(enc.id.length).toBeGreaterThan(0);
        expect(typeof enc.interactionProfileId).toBe('string');
        expect(enc.interactionProfileId.length).toBeGreaterThan(0);
        expect(typeof enc.visualProfileId).toBe('string');
        expect(enc.visualProfileId.length).toBeGreaterThan(0);
      }
    });

    it('답안 선택 공격은 pairId와 answerPolicyId를 명시할 수 있어야 한다', () => {
      const first = DEFAULT_APPROACH_PATTERN.encounters[0];
      expect(first.pairId).toBeDefined();
      expect(first.answerPolicyId).toBeDefined();
    });
  });

  describe('3. 순수 콘텐츠 데이터 격리 검증 (No Answers, Damage, Functions, Runtime State)', () => {
    it('정답 텍스트(문제 내용) 및 정답 사본이 포함되지 않아야 한다', () => {
      const patternString = JSON.stringify(DEFAULT_APPROACH_PATTERN);
      expect(patternString).not.toContain('correctAnswer');
      expect(patternString).not.toContain('questionText');
      expect(patternString).not.toContain('solution');
      expect(patternString).not.toContain('choiceA');
      expect(patternString).not.toContain('choiceB');
    });

    it('피해량(damage, hp) 수치가 콘텐츠 데이터에 포함되지 않아야 한다', () => {
      const patternString = JSON.stringify(DEFAULT_APPROACH_PATTERN);
      expect(patternString).not.toContain('damage');
      expect(patternString).not.toContain('playerHp');
      expect(patternString).not.toContain('bossHp');
    });

    it('실행 함수 또는 콜백이 일체 포함되지 않아야 한다', () => {
      function checkForFunctions(obj: unknown): void {
        if (!obj || typeof obj !== 'object') {
          expect(typeof obj).not.toBe('function');
          return;
        }
        for (const [key, val] of Object.entries(obj)) {
          expect(typeof val, `Property ${key} must not be a function`).not.toBe('function');
          if (typeof val === 'object' && val !== null) {
            checkForFunctions(val);
          }
        }
      }

      checkForFunctions(DEFAULT_APPROACH_PATTERN);
      checkForFunctions(APPROACH_PATTERNS);
    });

    it('런타임 가변 상태(phase, hitResult, combo, score 등)가 포함되지 않아야 한다', () => {
      const patternString = JSON.stringify(DEFAULT_APPROACH_PATTERN);
      expect(patternString).not.toContain('phase');
      expect(patternString).not.toContain('hitResult');
      expect(patternString).not.toContain('combo');
      expect(patternString).not.toContain('score');
    });
  });

  describe('4. 불변성(Deep Immutability) 검증', () => {
    it('DEFAULT_APPROACH_PATTERN 및 하위 객체가 deepFreeze되어 있어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_APPROACH_PATTERN)).toBe(true);
      expect(Object.isFrozen(DEFAULT_APPROACH_PATTERN.encounters)).toBe(true);
      for (const enc of DEFAULT_APPROACH_PATTERN.encounters) {
        expect(Object.isFrozen(enc)).toBe(true);
      }
      expect(Object.isFrozen(APPROACH_PATTERNS)).toBe(true);
    });

    it('패턴 데이터 수정 시도 시 변경이 방어되어야 한다', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DEFAULT_APPROACH_PATTERN as any).patternId = 'modified_id';
      }).toThrow();

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DEFAULT_APPROACH_PATTERN.encounters as any).push({} as AssaultEncounterDef);
      }).toThrow();

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DEFAULT_APPROACH_PATTERN.encounters[0] as any).startBeat = 999;
      }).toThrow();
    });
  });

  describe('5. 3쌍 교대 시나리오 fixture와의 구조적 정합성 검증 (A11 계약)', () => {
    // 3쌍 교대 시나리오 fixture: answer_pair (4박) + squat (4박) x 3 = 6 encounters, 총 24박
    const THREE_PAIR_SCENARIO_FIXTURE: AssaultApproachPattern = Object.freeze({
      schemaVersion: '1.0.0',
      patternId: 'pattern_approach_3pairs_fixture',
      timingProfileId: 'profile_assault_standard',
      totalBeats: 24,
      encounters: Object.freeze([
        Object.freeze({
          id: 'fixture_atk_01_answer',
          kind: 'answer_pair' as const,
          startBeat: 0,
          durationBeats: 4,
          interactionProfileId: 'assault_input_mvp_v1',
          visualProfileId: 'assault_visual_mvp_v1',
          pairId: 'fixture_pair_01',
          answerPolicyId: 'policy_dual_choice',
        }),
        Object.freeze({
          id: 'fixture_atk_02_squat',
          kind: 'squat' as const,
          startBeat: 4,
          durationBeats: 4,
          interactionProfileId: 'assault_input_mvp_v1',
          visualProfileId: 'assault_visual_mvp_v1',
        }),
        Object.freeze({
          id: 'fixture_atk_03_answer',
          kind: 'answer_pair' as const,
          startBeat: 8,
          durationBeats: 4,
          interactionProfileId: 'assault_input_mvp_v1',
          visualProfileId: 'assault_visual_mvp_v1',
          pairId: 'fixture_pair_02',
          answerPolicyId: 'policy_dual_choice',
        }),
        Object.freeze({
          id: 'fixture_atk_04_squat',
          kind: 'squat' as const,
          startBeat: 12,
          durationBeats: 4,
          interactionProfileId: 'assault_input_mvp_v1',
          visualProfileId: 'assault_visual_mvp_v1',
        }),
        Object.freeze({
          id: 'fixture_atk_05_answer',
          kind: 'answer_pair' as const,
          startBeat: 16,
          durationBeats: 4,
          interactionProfileId: 'assault_input_mvp_v1',
          visualProfileId: 'assault_visual_mvp_v1',
          pairId: 'fixture_pair_03',
          answerPolicyId: 'policy_dual_choice',
        }),
        Object.freeze({
          id: 'fixture_atk_06_squat',
          kind: 'squat' as const,
          startBeat: 20,
          durationBeats: 4,
          interactionProfileId: 'assault_input_mvp_v1',
          visualProfileId: 'assault_visual_mvp_v1',
        }),
      ]),
    });

    it('3쌍 시나리오 fixture가 AssaultApproachPattern 구조 계약을 완벽히 충족해야 한다', () => {
      expect(THREE_PAIR_SCENARIO_FIXTURE.schemaVersion).toBe('1.0.0');
      expect(THREE_PAIR_SCENARIO_FIXTURE.encounters).toHaveLength(6);
      expect(THREE_PAIR_SCENARIO_FIXTURE.totalBeats).toBe(24);
    });

    it('3쌍 fixture의 첫 시작 비트는 0-based(0)이어야 하고 매 4박마다 교대되어야 한다', () => {
      const encounters = THREE_PAIR_SCENARIO_FIXTURE.encounters;
      expect(encounters[0].startBeat).toBe(0);

      for (let i = 0; i < encounters.length; i++) {
        const enc = encounters[i];
        expect(enc.startBeat).toBe(i * 4);
        expect(enc.durationBeats).toBe(4);
        const expectedKind = i % 2 === 0 ? 'answer_pair' : 'squat';
        expect(enc.kind).toBe(expectedKind);
      }
    });

    it('3쌍 fixture 역시 정답 사본이나 피해 수치 없이 순수 불변 구조여야 한다', () => {
      const str = JSON.stringify(THREE_PAIR_SCENARIO_FIXTURE);
      expect(str).not.toContain('damage');
      expect(str).not.toContain('correctAnswer');
      expect(Object.isFrozen(THREE_PAIR_SCENARIO_FIXTURE)).toBe(true);
    });
  });

  describe('6. 비정상/결함 fixture 식별성 검증 (사전 검증 계약 준비)', () => {
    it('중복 ID를 가진 결함 fixture를 식별할 수 있어야 한다', () => {
      const duplicateIdFixture = {
        schemaVersion: '1.0.0',
        patternId: 'invalid_duplicate_id',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'same_attack_id',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'assault_input_mvp_v1',
            visualProfileId: 'assault_visual_mvp_v1',
          },
          {
            id: 'same_attack_id',
            kind: 'squat' as const,
            startBeat: 4,
            durationBeats: 4,
            interactionProfileId: 'assault_input_mvp_v1',
            visualProfileId: 'assault_visual_mvp_v1',
          },
        ],
      };

      const ids = duplicateIdFixture.encounters.map((e) => e.id);
      const hasDuplicate = new Set(ids).size !== ids.length;
      expect(hasDuplicate).toBe(true);
    });

    it('프로필 참조가 누락된 결함 fixture를 식별할 수 있어야 한다', () => {
      const missingProfileFixture = {
        schemaVersion: '1.0.0',
        patternId: 'invalid_missing_profile',
        timingProfileId: '',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_1',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: '',
            visualProfileId: 'assault_visual_mvp_v1',
          },
        ],
      };

      const hasMissingTimingProfile = !missingProfileFixture.timingProfileId;
      const hasMissingInteractionProfile = !missingProfileFixture.encounters[0].interactionProfileId;
      expect(hasMissingTimingProfile).toBe(true);
      expect(hasMissingInteractionProfile).toBe(true);
    });

    it('음수 박자 또는 구간 중첩이 발생한 결함 fixture를 식별할 수 있어야 한다', () => {
      const negativeBeatFixture = {
        startBeat: -2,
        durationBeats: 4,
      };
      expect(negativeBeatFixture.startBeat < 0).toBe(true);

      const overlappingFixture = [
        { startBeat: 0, durationBeats: 4 },
        { startBeat: 2, durationBeats: 4 }, // overlaps with 0..4
      ];
      const hasOverlap =
        overlappingFixture[0].startBeat + overlappingFixture[0].durationBeats >
        overlappingFixture[1].startBeat;
      expect(hasOverlap).toBe(true);
    });
  });
});
