import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASSAULT_FINALE_CONFIG,
  type AssaultFinaleConfig,
  type AssaultFinaleTimingBeats,
  type AssaultFinaleLowImpactConfig,
  type AssaultFinaleRhythmWindows,
} from '../../config/assault-finale.config.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { DEFAULT_BOSS_HAZARD_CONFIG } from '../../config/battle.config.js';

describe('[BOSS-ASSAULT-26 / #528] 근접 결전 조정 프로필 데이터', () => {
  describe('1. 프로필 메타데이터 및 규칙 버전', () => {
    it('프로필 ID 및 규칙 버전이 올바르게 정의되어야 한다', () => {
      const config: AssaultFinaleConfig = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(config.profileId).toBe('assault_finale_v1');
      expect(config.rulesVersion).toBe('v0.3');
    });
  });

  describe('2. 결전 체력, 피해량, 길이, 실패 제한 수치 계약', () => {
    it('보스 초기 HP(bossInitialHp)는 20이어야 하며 양의 유한 정수여야 한다 (#539 계약 일치)', () => {
      const { bossInitialHp } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(bossInitialHp).toBe(20);
      expect(Number.isInteger(bossInitialHp)).toBe(true);
      expect(bossInitialHp).toBeGreaterThan(0);
    });

    it('약점 펀치 피해량(punchDamage)은 2이어야 하며 0보다 커야 한다', () => {
      const { punchDamage } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(punchDamage).toBe(2);
      expect(Number.isFinite(punchDamage)).toBe(true);
      expect(punchDamage).toBeGreaterThan(0);
    });

    it('보스 공격 피해량(bossAttackDamage)은 10이어야 하며 0보다 커야 한다', () => {
      const { bossAttackDamage } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(bossAttackDamage).toBe(10);
      expect(Number.isFinite(bossAttackDamage)).toBe(true);
      expect(bossAttackDamage).toBeGreaterThan(0);
    });

    it('장판/환경 피해량(hazardDamage)은 5이어야 하며 0보다 커야 한다', () => {
      const { hazardDamage } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(hazardDamage).toBe(5);
      expect(Number.isFinite(hazardDamage)).toBe(true);
      expect(hazardDamage).toBeGreaterThan(0);
    });

    it('최대 실패 허용 횟수(maxFailures)는 5회여야 한다', () => {
      const { maxFailures } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(maxFailures).toBe(5);
      expect(Number.isInteger(maxFailures)).toBe(true);
      expect(maxFailures).toBeGreaterThan(0);
    });

    it('목표 결전 박자(targetBeats)는 64박이어야 하며 0보다 큰 유한값이어야 한다', () => {
      const { targetBeats } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(targetBeats).toBe(64);
      expect(Number.isInteger(targetBeats)).toBe(true);
      expect(targetBeats).toBeGreaterThanOrEqual(32);
    });
  });

  describe('3. 동작별 타이밍 박자 (예고, 판정창, 복귀)', () => {
    const actions: (keyof AssaultFinaleTimingBeats)[] = ['punch', 'squat', 'jump', 'rush'];

    it('모든 결전 동작(punch, squat, jump, rush)의 박자 정의가 존재해야 한다', () => {
      const { beats } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(beats).toBeDefined();
      for (const action of actions) {
        expect(beats[action]).toBeDefined();
      }
    });

    it('각 동작별 예고/판정창/복귀 박자는 양의 유한수이며 복귀 박자는 1 이상이어야 한다', () => {
      const { beats } = DEFAULT_ASSAULT_FINALE_CONFIG;
      for (const action of actions) {
        const item = beats[action];
        expect(Number.isFinite(item.anticipation)).toBe(true);
        expect(item.anticipation).toBeGreaterThanOrEqual(1);

        expect(Number.isFinite(item.window)).toBe(true);
        expect(item.window).toBeGreaterThanOrEqual(1);

        expect(Number.isFinite(item.recovery)).toBe(true);
        expect(item.recovery).toBeGreaterThanOrEqual(1);
      }
    });

    it('각 동작의 승인된 구체적 박자 수치가 정확해야 한다', () => {
      const { beats } = DEFAULT_ASSAULT_FINALE_CONFIG;
      expect(beats.punch).toEqual({ anticipation: 2, window: 2, recovery: 2 });
      expect(beats.squat).toEqual({ anticipation: 2, window: 4, recovery: 2 });
      expect(beats.jump).toEqual({ anticipation: 2, window: 3, recovery: 2 });
      expect(beats.rush).toEqual({ anticipation: 1, window: 4, recovery: 2 });
    });
  });

  describe('4. 저충격 대체 설정 (Low-Impact Alternatives)', () => {
    it('스쿼트 대체 동작은 both_arm_guard, 점프 대체 동작은 heel_raise로 지정되어야 한다', () => {
      const lowImpact: AssaultFinaleLowImpactConfig = DEFAULT_ASSAULT_FINALE_CONFIG.lowImpact;
      expect(lowImpact).toBeDefined();
      expect(lowImpact.squatSubstitute).toBe('both_arm_guard');
      expect(lowImpact.jumpSubstitute).toBe('heel_raise');
    });
  });

  describe('5. 리듬 판정 윈도우 (Rhythm Windows)', () => {
    it('리듬 판정창(ms)이 Perfect 50ms, Good 120ms, Late 170ms로 정의되어야 한다', () => {
      const windows: AssaultFinaleRhythmWindows = DEFAULT_ASSAULT_FINALE_CONFIG.rhythmWindows;
      expect(windows.Perfect).toBe(50);
      expect(windows.Good).toBe(120);
      expect(windows.Late).toBe(170);
    });

    it('판정창 크기는 0 < Perfect < Good < Late 계층 관계를 만족해야 한다', () => {
      const { Perfect, Good, Late } = DEFAULT_ASSAULT_FINALE_CONFIG.rhythmWindows;
      expect(Perfect).toBeGreaterThan(0);
      expect(Good).toBeGreaterThan(Perfect);
      expect(Late).toBeGreaterThan(Good);
    });
  });

  describe('6. 불변성 보장 (Deep Freeze Immutability)', () => {
    it('설정 객체 최상위 및 모든 하위 객체가 동결되어 있어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.beats)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.beats.punch)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.beats.squat)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.beats.jump)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.beats.rush)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.lowImpact)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_FINALE_CONFIG.rhythmWindows)).toBe(true);
    });

    it('속성 변경 또는 확장을 시도하면 에러가 발생해야 한다', () => {
      expect(() => {
        (DEFAULT_ASSAULT_FINALE_CONFIG as unknown as Record<string, unknown>).bossInitialHp = 999;
      }).toThrow();

      expect(() => {
        (DEFAULT_ASSAULT_FINALE_CONFIG.beats.punch as unknown as Record<string, unknown>).window = 10;
      }).toThrow();

      expect(() => {
        (DEFAULT_ASSAULT_FINALE_CONFIG.lowImpact as unknown as Record<string, unknown>).squatSubstitute = 'invalid';
      }).toThrow();
    });
  });

  describe('7. 부적격 Fixture 사양 검증 (0, 음수, 비유한, 복귀 부족)', () => {
    function validateFinaleConfigFixture(cfg: any): { valid: boolean; reason?: string } {
      if (!cfg || typeof cfg !== 'object') return { valid: false, reason: 'Config must be an object' };
      if (typeof cfg.profileId !== 'string' || cfg.profileId.trim() === '') return { valid: false, reason: 'Invalid profileId' };
      if (typeof cfg.rulesVersion !== 'string' || cfg.rulesVersion.trim() === '') return { valid: false, reason: 'Invalid rulesVersion' };
      if (typeof cfg.bossInitialHp !== 'number' || !Number.isInteger(cfg.bossInitialHp) || cfg.bossInitialHp <= 0) {
        return { valid: false, reason: 'bossInitialHp must be a positive integer' };
      }
      if (typeof cfg.punchDamage !== 'number' || !Number.isFinite(cfg.punchDamage) || cfg.punchDamage <= 0) {
        return { valid: false, reason: 'punchDamage must be positive finite number' };
      }
      if (typeof cfg.bossAttackDamage !== 'number' || !Number.isFinite(cfg.bossAttackDamage) || cfg.bossAttackDamage <= 0) {
        return { valid: false, reason: 'bossAttackDamage must be positive finite number' };
      }
      if (typeof cfg.hazardDamage !== 'number' || !Number.isFinite(cfg.hazardDamage) || cfg.hazardDamage <= 0) {
        return { valid: false, reason: 'hazardDamage must be positive finite number' };
      }
      if (typeof cfg.maxFailures !== 'number' || !Number.isInteger(cfg.maxFailures) || cfg.maxFailures <= 0) {
        return { valid: false, reason: 'maxFailures must be positive integer' };
      }
      if (typeof cfg.targetBeats !== 'number' || !Number.isInteger(cfg.targetBeats) || cfg.targetBeats <= 0) {
        return { valid: false, reason: 'targetBeats must be positive integer' };
      }
      if (!cfg.beats || typeof cfg.beats !== 'object') return { valid: false, reason: 'beats missing' };
      for (const act of ['punch', 'squat', 'jump', 'rush']) {
        const b = cfg.beats[act];
        if (!b) return { valid: false, reason: `beats.${act} missing` };
        if (typeof b.anticipation !== 'number' || b.anticipation < 1) return { valid: false, reason: `${act}.anticipation < 1` };
        if (typeof b.window !== 'number' || b.window < 1) return { valid: false, reason: `${act}.window < 1` };
        if (typeof b.recovery !== 'number' || b.recovery < 1) return { valid: false, reason: `${act}.recovery < 1` };
      }
      if (!cfg.lowImpact || cfg.lowImpact.squatSubstitute !== 'both_arm_guard' || cfg.lowImpact.jumpSubstitute !== 'heel_raise') {
        return { valid: false, reason: 'Invalid lowImpact' };
      }
      if (!cfg.rhythmWindows || cfg.rhythmWindows.Perfect <= 0 || cfg.rhythmWindows.Good <= cfg.rhythmWindows.Perfect || cfg.rhythmWindows.Late <= cfg.rhythmWindows.Good) {
        return { valid: false, reason: 'Invalid rhythmWindows order' };
      }
      return { valid: true };
    }

    it('기본 DEFAULT_ASSAULT_FINALE_CONFIG는 fixture 사양 검증을 온전히 통과한다', () => {
      const res = validateFinaleConfigFixture(DEFAULT_ASSAULT_FINALE_CONFIG);
      expect(res.valid).toBe(true);
      expect(res.reason).toBeUndefined();
    });

    it('0 또는 음수 HP를 가진 fixture는 부적격으로 판정되어야 한다', () => {
      expect(validateFinaleConfigFixture({ ...DEFAULT_ASSAULT_FINALE_CONFIG, bossInitialHp: 0 }).valid).toBe(false);
      expect(validateFinaleConfigFixture({ ...DEFAULT_ASSAULT_FINALE_CONFIG, bossInitialHp: -10 }).valid).toBe(false);
    });

    it('비유한값(NaN, Infinity)을 가진 fixture는 부적격으로 판정되어야 한다', () => {
      expect(validateFinaleConfigFixture({ ...DEFAULT_ASSAULT_FINALE_CONFIG, punchDamage: NaN }).valid).toBe(false);
      expect(validateFinaleConfigFixture({ ...DEFAULT_ASSAULT_FINALE_CONFIG, punchDamage: Infinity }).valid).toBe(false);
    });

    it('복귀 박자(recovery)가 1 미만(부족)인 fixture는 부적격으로 판정되어야 한다', () => {
      const invalidBeats = {
        ...DEFAULT_ASSAULT_FINALE_CONFIG.beats,
        punch: { ...DEFAULT_ASSAULT_FINALE_CONFIG.beats.punch, recovery: 0 },
      };
      expect(validateFinaleConfigFixture({ ...DEFAULT_ASSAULT_FINALE_CONFIG, beats: invalidBeats }).valid).toBe(false);
    });
  });

  describe('8. 기존 접근전(assault) 및 배틀(battle) 설정 격리 및 불변 검증', () => {
    it('기존 DEFAULT_ASSAULT_CONFIG는 본 결전 설정과 격리되어 있으며 변경되지 않는다', () => {
      expect(DEFAULT_ASSAULT_CONFIG.profileId).toBe('assault_mvp_v1');
      expect(DEFAULT_ASSAULT_CONFIG.rulesVersion).toBe('v0.3');
      expect(DEFAULT_ASSAULT_CONFIG.playerMaxHp).toBe(100);
      expect(DEFAULT_ASSAULT_CONFIG.wrongDamage).toBe(10);
      expect(DEFAULT_ASSAULT_CONFIG.squatFailDamage).toBe(5);
    });

    it('기존 DEFAULT_BOSS_HAZARD_CONFIG는 결전 설정에 영향받지 않는다', () => {
      expect(DEFAULT_BOSS_HAZARD_CONFIG.damage).toBe(15);
      expect(DEFAULT_BOSS_HAZARD_CONFIG.warningDuration).toBe(1.5);
    });
  });
});
