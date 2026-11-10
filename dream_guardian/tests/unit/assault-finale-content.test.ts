import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FINALE_PATTERN,
  FINALE_PATTERNS,
  type AssaultFinalePattern,
} from '../../src/data/assault/finalePatterns.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import { validateAssaultPlan } from '../../src/game/assault/AssaultPlanValidator.js';
import { compileAssaultPlan } from '../../src/game/assault/AssaultPlanCompiler.js';

// compileAssaultTimeline alias for 06 compiler contract verification
const compileAssaultTimeline = compileAssaultPlan;

describe('[BOSS-ASSAULT-27 / #529] 근접 결전 선언형 패턴 콘텐츠', () => {
  describe('1. 결전 패턴 메타데이터 및 스키마 검증', () => {
    it('DEFAULT_FINALE_PATTERN이 정의되어 있고 필수 메타데이터를 포함해야 한다', () => {
      const finalePattern: AssaultFinalePattern = DEFAULT_FINALE_PATTERN;
      expect(finalePattern).toBeDefined();
      expect(DEFAULT_FINALE_PATTERN.schemaVersion).toBe('1.0.0');
      expect(DEFAULT_FINALE_PATTERN.patternId).toBe('pattern_finale_standard');
      expect(DEFAULT_FINALE_PATTERN.name).toBe('근접 결전 표준 패턴');
      expect(DEFAULT_FINALE_PATTERN.description).toContain('약점 펀치');
    });

    it('timingProfileId와 balanceProfileId가 결전 프로필 assault_finale_v1을 참조해야 한다', () => {
      expect(DEFAULT_FINALE_PATTERN.timingProfileId).toBe('assault_finale_v1');
      expect(DEFAULT_FINALE_PATTERN.balanceProfileId).toBe('assault_finale_v1');
    });

    it('totalBeats는 32박이어야 하며 모든 조우의 종료 박자(28박) 이상이어야 한다', () => {
      expect(DEFAULT_FINALE_PATTERN.totalBeats).toBe(32);
      const lastEncounter = DEFAULT_FINALE_PATTERN.encounters[DEFAULT_FINALE_PATTERN.encounters.length - 1];
      expect(lastEncounter.startBeat + lastEncounter.durationBeats).toBeLessThanOrEqual(
        DEFAULT_FINALE_PATTERN.totalBeats,
      );
    });

    it('FINALE_PATTERNS 레코드에 DEFAULT_FINALE_PATTERN이 등록되어 있어야 한다', () => {
      expect(FINALE_PATTERNS).toBeDefined();
      expect(FINALE_PATTERNS['pattern_finale_standard']).toBe(DEFAULT_FINALE_PATTERN);
    });
  });

  describe('2. DOC-14 §10.2 결전 조우 시퀀스 및 박자 배치 검증', () => {
    it('첫 번째 조우의 startBeat는 0이어야 한다 (0-based 시작 계약)', () => {
      expect(DEFAULT_FINALE_PATTERN.encounters.length).toBeGreaterThan(0);
      expect(DEFAULT_FINALE_PATTERN.encounters[0].startBeat).toBe(0);
    });

    it('결전 시퀀스는 정확히 5단계(약점 펀치 -> 스쿼트 회피 -> 약점 펀치 -> 충격파 점프 -> 빈틈 연타)여야 한다', () => {
      const encounters = DEFAULT_FINALE_PATTERN.encounters;
      expect(encounters).toHaveLength(5);

      // 1) 약점 펀치: answer_pair (0~4박, 4박)
      expect(encounters[0].kind).toBe('answer_pair');
      expect(encounters[0].startBeat).toBe(0);
      expect(encounters[0].durationBeats).toBe(4);

      // 2) 가로 공격 스쿼트: squat (4~10박, 6박)
      expect(encounters[1].kind).toBe('squat');
      expect(encounters[1].startBeat).toBe(4);
      expect(encounters[1].durationBeats).toBe(6);

      // 3) 약점 펀치: answer_pair (10~14박, 4박)
      expect(encounters[2].kind).toBe('answer_pair');
      expect(encounters[2].startBeat).toBe(10);
      expect(encounters[2].durationBeats).toBe(4);

      // 4) 바닥 충격파 점프: jump (14~20박, 6박)
      expect(encounters[3].kind).toBe('jump');
      expect(encounters[3].startBeat).toBe(14);
      expect(encounters[3].durationBeats).toBe(6);

      // 5) 큰 빈틈 연타: answer_pair (20~28박, 8박)
      expect(encounters[4].kind).toBe('answer_pair');
      expect(encounters[4].startBeat).toBe(20);
      expect(encounters[4].durationBeats).toBe(8);
    });

    it('모든 조우의 식별자(id)는 고유하고 비어있지 않아야 한다', () => {
      const ids = DEFAULT_FINALE_PATTERN.encounters.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.trim().length).toBeGreaterThan(0);
      }
    });

    it('인접 조우 간 겹침(overlap)이 없고 순서 역전이 없어야 한다', () => {
      const encounters = DEFAULT_FINALE_PATTERN.encounters;
      for (let i = 1; i < encounters.length; i++) {
        const prev = encounters[i - 1];
        const curr = encounters[i];
        expect(curr.startBeat).toBeGreaterThanOrEqual(prev.startBeat + prev.durationBeats);
      }
    });

    it('answer_pair 조우는 pairId와 answerPolicyId를 명시해야 한다', () => {
      const answerEncounters = DEFAULT_FINALE_PATTERN.encounters.filter(
        (e) => e.kind === 'answer_pair',
      );
      expect(answerEncounters.length).toBe(3);
      for (const enc of answerEncounters) {
        expect(enc.pairId).toBeDefined();
        expect(typeof enc.pairId).toBe('string');
        expect(enc.answerPolicyId).toBeDefined();
        expect(typeof enc.answerPolicyId).toBe('string');
      }
    });
  });

  describe('3. 순수 선언형 정적 콘텐츠 계약 (Content 레이어 책임 분리)', () => {
    it('실행 함수 또는 콜백이 일체 포함되지 않아야 한다', () => {
      function checkNoFunctions(obj: unknown): void {
        if (!obj || typeof obj !== 'object') {
          expect(typeof obj).not.toBe('function');
          return;
        }
        for (const [key, val] of Object.entries(obj)) {
          expect(typeof val, `Property ${key} must not be a function`).not.toBe('function');
          if (val && typeof val === 'object') {
            checkNoFunctions(val);
          }
        }
      }

      checkNoFunctions(DEFAULT_FINALE_PATTERN);
      checkNoFunctions(FINALE_PATTERNS);
    });

    it('HP, 데미지, 타이머, 정산, 점수, 콤보 등의 런타임 수치/상태가 포함되지 않아야 한다', () => {
      const serialized = JSON.stringify(DEFAULT_FINALE_PATTERN);
      expect(serialized).not.toContain('"hp"');
      expect(serialized).not.toContain('"bossHp"');
      expect(serialized).not.toContain('"playerHp"');
      expect(serialized).not.toContain('"damage"');
      expect(serialized).not.toContain('"score"');
      expect(serialized).not.toContain('"combo"');
      expect(serialized).not.toContain('"phase"');
    });

    it('수학 문제 정답이나 수식이 내장되지 않아야 한다 (Question 레이어 복제 방지)', () => {
      const serialized = JSON.stringify(DEFAULT_FINALE_PATTERN);
      expect(serialized).not.toContain('"correctAnswer"');
      expect(serialized).not.toContain('"questionText"');
      expect(serialized).not.toContain('"formula"');
    });
  });

  describe('4. deepFreeze 불변성(Deep Immutability) 검증', () => {
    it('DEFAULT_FINALE_PATTERN 및 하위 객체가 deepFreeze되어 있어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_FINALE_PATTERN)).toBe(true);
      expect(Object.isFrozen(DEFAULT_FINALE_PATTERN.encounters)).toBe(true);
      for (const enc of DEFAULT_FINALE_PATTERN.encounters) {
        expect(Object.isFrozen(enc)).toBe(true);
      }
      expect(Object.isFrozen(FINALE_PATTERNS)).toBe(true);
    });

    it('패턴 데이터 수정 시도 시 변경이 방어되어야 한다', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DEFAULT_FINALE_PATTERN as any).patternId = 'mutated_pattern';
      }).toThrow();

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DEFAULT_FINALE_PATTERN.encounters as any).push({ id: 'illegal_enc' });
      }).toThrow();

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DEFAULT_FINALE_PATTERN.encounters[0] as any).startBeat = 999;
      }).toThrow();
    });

    it('기존 DEFAULT_APPROACH_PATTERN 및 접근전 콘텐츠를 변경하지 않아야 한다', () => {
      expect(DEFAULT_APPROACH_PATTERN).toBeDefined();
      expect(DEFAULT_APPROACH_PATTERN.patternId).toBe('pattern_approach_standard_mvp');
      expect(DEFAULT_APPROACH_PATTERN.totalBeats).toBe(8);
      expect(DEFAULT_APPROACH_PATTERN.encounters).toHaveLength(2);
    });
  });

  describe('5. AssaultPlanValidator (05번 검증기) 계약 검증', () => {
    it('DEFAULT_FINALE_PATTERN이 validateAssaultPlan 검증을 100% 통과해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_FINALE_PATTERN);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toBe(DEFAULT_FINALE_PATTERN);
        expect(result.errors).toBeUndefined();
      }
    });

    it('허용 프로필 옵션 지정 시에도 통과해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_FINALE_PATTERN, {
        allowedTimingProfiles: ['assault_finale_v1'],
        allowedBalanceProfiles: ['assault_finale_v1'],
      });
      expect(result.valid).toBe(true);
    });

    it('잘못된 kind(미지원 kind)가 포함된 결전 패턴은 검증에 실패해야 한다', () => {
      const invalidFixture = {
        ...DEFAULT_FINALE_PATTERN,
        encounters: [
          {
            ...DEFAULT_FINALE_PATTERN.encounters[0],
            kind: 'laser_dodge',
          },
        ],
      };
      const result = validateAssaultPlan(invalidFixture);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.code === 'INVALID_KIND')).toBe(true);
    });

    it('중복 조우 ID가 포함된 결전 패턴은 검증에 실패해야 한다', () => {
      const invalidFixture = {
        ...DEFAULT_FINALE_PATTERN,
        encounters: [
          DEFAULT_FINALE_PATTERN.encounters[0],
          {
            ...DEFAULT_FINALE_PATTERN.encounters[1],
            id: DEFAULT_FINALE_PATTERN.encounters[0].id,
          },
        ],
      };
      const result = validateAssaultPlan(invalidFixture);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.code === 'DUPLICATE_ATTACK_ID')).toBe(true);
    });

    it('조우 간 박자 중첩(overlap)이 발생한 결전 패턴은 검증에 실패해야 한다', () => {
      const invalidFixture = {
        ...DEFAULT_FINALE_PATTERN,
        encounters: [
          DEFAULT_FINALE_PATTERN.encounters[0], // startBeat: 0, duration: 4 (ends at 4)
          {
            ...DEFAULT_FINALE_PATTERN.encounters[1],
            startBeat: 2, // starts at 2, overlapping with encounter 0!
            durationBeats: 6,
          },
        ],
      };
      const result = validateAssaultPlan(invalidFixture);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.code === 'ENCOUNTER_OVERLAP')).toBe(true);
    });

    it('순서 역전(order inversion)이 발생한 결전 패턴은 검증에 실패해야 한다', () => {
      const invalidFixture = {
        ...DEFAULT_FINALE_PATTERN,
        encounters: [
          DEFAULT_FINALE_PATTERN.encounters[1], // startBeat: 4
          DEFAULT_FINALE_PATTERN.encounters[0], // startBeat: 0 (inversion!)
        ],
      };
      const result = validateAssaultPlan(invalidFixture);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.code === 'ORDER_INVERSION')).toBe(true);
    });

    it('미등록 timingProfileId에 대해 검증기가 거부해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_FINALE_PATTERN, {
        allowedTimingProfiles: ['unregistered_timing_profile'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.code === 'UNKNOWN_PROFILE')).toBe(true);
    });
  });

  describe('6. AssaultPlanCompiler (06번 컴파일러) 계약 검증', () => {
    it('compileAssaultTimeline(DEFAULT_FINALE_PATTERN)이 성공적으로 불변 실행 시간표를 생성해야 한다', () => {
      const compiled = compileAssaultTimeline(DEFAULT_FINALE_PATTERN, { bpm: 120 });
      expect(compiled).toBeDefined();
      expect(compiled.patternId).toBe('pattern_finale_standard');
      expect(compiled.bpm).toBe(120);
      expect(compiled.totalBeats).toBe(32);
      expect(compiled.totalDurationSeconds).toBeCloseTo(16, 4); // 32 * 60 / 120 = 16.0s
      expect(compiled.encounters).toHaveLength(5);
    });

    it('컴파일된 조우들의 활성 초(seconds)가 0-based 박자 비율과 정확히 일치해야 한다', () => {
      const compiled = compileAssaultTimeline(DEFAULT_FINALE_PATTERN, { bpm: 120 });
      const [e0, e1, e2, e3, e4] = compiled.encounters;

      // 1) answer_pair: startBeat: 0, duration: 4 -> 0.0s ~ 2.0s
      expect(e0.startBeat).toBe(0);
      expect(e0.startSeconds).toBeCloseTo(0.0, 4);
      expect(e0.durationSeconds).toBeCloseTo(2.0, 4);

      // 2) squat: startBeat: 4, duration: 6 -> 2.0s ~ 5.0s
      expect(e1.startBeat).toBe(4);
      expect(e1.startSeconds).toBeCloseTo(2.0, 4);
      expect(e1.durationSeconds).toBeCloseTo(3.0, 4);

      // 3) answer_pair: startBeat: 10, duration: 4 -> 5.0s ~ 7.0s
      expect(e2.startBeat).toBe(10);
      expect(e2.startSeconds).toBeCloseTo(5.0, 4);
      expect(e2.durationSeconds).toBeCloseTo(2.0, 4);

      // 4) jump: startBeat: 14, duration: 6 -> 7.0s ~ 10.0s
      expect(e3.startBeat).toBe(14);
      expect(e3.startSeconds).toBeCloseTo(7.0, 4);
      expect(e3.durationSeconds).toBeCloseTo(3.0, 4);

      // 5) answer_pair: startBeat: 20, duration: 8 -> 10.0s ~ 14.0s
      expect(e4.startBeat).toBe(20);
      expect(e4.startSeconds).toBeCloseTo(10.0, 4);
      expect(e4.durationSeconds).toBeCloseTo(4.0, 4);
    });

    it('컴파일 결과 객체는 deepFreeze되어 불변이어야 한다', () => {
      const compiled = compileAssaultTimeline(DEFAULT_FINALE_PATTERN, { bpm: 120 });
      expect(Object.isFrozen(compiled)).toBe(true);
      expect(Object.isFrozen(compiled.encounters)).toBe(true);
      for (const enc of compiled.encounters) {
        expect(Object.isFrozen(enc)).toBe(true);
      }
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (compiled as any).bpm = 140;
      }).toThrow();
    });
  });
});
