import { describe, it, expect } from 'vitest';
import { BossController, type BossInitOptions } from '../../src/game/BossController.js';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';

describe('[BOSS-ASSAULT-37 / #539] 기존 보스 HP 소유자의 명시적 초기화 옵션', () => {
  describe('1. 옵션 생략 시 하위 호환성 (DEFAULT_CONFIG 일치 및 불변)', () => {
    it('옵션 없이 생성 시 Chapter 1~4는 bossHpNormal(10), Chapter 5는 bossHpNightmare(20)으로 초기화되어야 한다', () => {
      for (let ch = 1; ch <= 4; ch++) {
        const boss = new BossController(ch);
        expect(boss.chapter).toBe(ch);
        expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
        expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
        expect(boss.phase).toBe('idle');
      }

      const boss5 = new BossController(5);
      expect(boss5.chapter).toBe(5);
      expect(boss5.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNightmare);
      expect(boss5.hp).toBe(DEFAULT_CONFIG.battle.bossHpNightmare);
      expect(boss5.phase).toBe('idle');
    });

    it('인자 없이 new BossController() 생성 시 기본 chapter=1, bossHpNormal이어야 한다', () => {
      const boss = new BossController();
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
    });

    it('옵션 없이 reset() 호출 시 해당 챕터의 DEFAULT_CONFIG 기본 체력으로 복구되어야 한다', () => {
      const boss = new BossController(1);
      boss.takeDamage(5);
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal - 5);

      boss.reset();
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
      expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
      expect(boss.chapter).toBe(1);

      boss.reset(5);
      expect(boss.chapter).toBe(5);
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNightmare);
      expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNightmare);
    });

    it('전역 DEFAULT_CONFIG 객체는 변경되지 않고 불변이어야 한다 (A01)', () => {
      const originalNormal = DEFAULT_CONFIG.battle.bossHpNormal;
      const originalNightmare = DEFAULT_CONFIG.battle.bossHpNightmare;

      // 옵션 주입 후에도 DEFAULT_CONFIG는 불변
      const boss = new BossController(1, { maxHp: 999 });
      expect(boss.maxHp).toBe(999);

      expect(DEFAULT_CONFIG.battle.bossHpNormal).toBe(originalNormal);
      expect(DEFAULT_CONFIG.battle.bossHpNightmare).toBe(originalNightmare);
    });
  });

  describe('2. 명시적 maxHp 및 initialHp 주입 옵션 (생성자)', () => {
    it('명시적 maxHp를 전달하면 initialHp 생략 시 hp는 maxHp와 동일해야 한다', () => {
      const options: BossInitOptions = { maxHp: 20 };
      const boss = new BossController(1, options);
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(20);
      expect(boss.hp).toBe(20);
      expect(boss.hpPercent).toBe(1);
    });

    it('initialHp가 명시된 경우 maxHp 이하의 값이면 initialHp로 체력이 초기화되어야 한다', () => {
      const boss = new BossController(1, { maxHp: 30, initialHp: 15 });
      expect(boss.maxHp).toBe(30);
      expect(boss.hp).toBe(15);
      expect(boss.hpPercent).toBe(0.5);
    });

    it('initialHp가 maxHp를 초과하면 maxHp로 클램핑되어야 한다', () => {
      const boss = new BossController(1, { maxHp: 20, initialHp: 50 });
      expect(boss.maxHp).toBe(20);
      expect(boss.hp).toBe(20);
      expect(boss.hpPercent).toBe(1);
    });

    it('maxHp 생략하고 initialHp만 전달된 경우 기본 maxHp 내에서 initialHp가 적용되어야 한다', () => {
      const boss = new BossController(1, { initialHp: 7 });
      expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNormal); // 10
      expect(boss.hp).toBe(7);
    });

    it('빈 옵션 객체 {} 전달 시 기본 chapter 설정이 적용되어야 한다', () => {
      const boss = new BossController(2, {});
      expect(boss.chapter).toBe(2);
      expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
    });
  });

  describe('3. reset() 시 명시적 옵션 주입 및 기본값 복귀 동작', () => {
    it('reset(chapter, options)로 새 챕터와 명시적 HP 옵션을 주입할 수 있어야 한다', () => {
      const boss = new BossController(1);
      boss.takeDamage(8);
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal - 8);

      boss.reset(2, { maxHp: 40, initialHp: 20 });
      expect(boss.chapter).toBe(2);
      expect(boss.maxHp).toBe(40);
      expect(boss.hp).toBe(20);
      expect(boss.phase).toBe('idle');
    });

    it('reset(undefined, options)로 챕터를 유지한 채 명시적 HP 옵션을 주입할 수 있어야 한다', () => {
      const boss = new BossController(3);
      boss.reset(undefined, { maxHp: 25 });
      expect(boss.chapter).toBe(3);
      expect(boss.maxHp).toBe(25);
      expect(boss.hp).toBe(25);
    });

    it('명시적 옵션으로 생성된 보스도 reset() 시 옵션을 생략하면 해당 챕터 기본값으로 복귀해야 한다', () => {
      const boss = new BossController(1, { maxHp: 50 });
      expect(boss.maxHp).toBe(50);
      expect(boss.hp).toBe(50);

      boss.takeDamage(10);
      boss.reset(); // 옵션 생략
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
      expect(boss.hp).toBe(DEFAULT_CONFIG.battle.bossHpNormal);
    });
  });

  describe('4. 유효하지 않은 입력 검증 및 상태 원자성(Atomicity) 보장', () => {
    it('생성자: maxHp가 0, 음수, NaN, Infinity 등 유효하지 않은 값이면 Error를 던져야 한다', () => {
      expect(() => new BossController(1, { maxHp: 0 })).toThrow();
      expect(() => new BossController(1, { maxHp: -5 })).toThrow();
      expect(() => new BossController(1, { maxHp: NaN })).toThrow();
      expect(() => new BossController(1, { maxHp: Infinity })).toThrow();
      expect(() => new BossController(1, { maxHp: -Infinity })).toThrow();
      expect(() => new BossController(1, { maxHp: '10' as unknown as number })).toThrow();
    });

    it('생성자: initialHp가 0, 음수, NaN, Infinity 등 유효하지 않은 값이면 Error를 던져야 한다', () => {
      expect(() => new BossController(1, { maxHp: 20, initialHp: 0 })).toThrow();
      expect(() => new BossController(1, { maxHp: 20, initialHp: -1 })).toThrow();
      expect(() => new BossController(1, { maxHp: 20, initialHp: NaN })).toThrow();
      expect(() => new BossController(1, { maxHp: 20, initialHp: Infinity })).toThrow();
      expect(() => new BossController(1, { initialHp: 0 })).toThrow();
    });

    it('reset(): 유효하지 않은 입력 시 Error를 던지고 기존 상태(chapter, hp, maxHp, phase)가 변경되지 않아야 한다', () => {
      const boss = new BossController(1, { maxHp: 20, initialHp: 15 });
      boss.triggerAttack();
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(20);
      expect(boss.hp).toBe(15);
      expect(boss.phase).toBe('attacking');

      // Invalid maxHp 시도
      expect(() => boss.reset(2, { maxHp: -10 })).toThrow();
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(20);
      expect(boss.hp).toBe(15);
      expect(boss.phase).toBe('attacking');

      // Invalid initialHp 시도
      expect(() => boss.reset(3, { maxHp: 30, initialHp: 0 })).toThrow();
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(20);
      expect(boss.hp).toBe(15);
      expect(boss.phase).toBe('attacking');

      // NaN 시도
      expect(() => boss.reset(4, { maxHp: NaN })).toThrow();
      expect(boss.chapter).toBe(1);
      expect(boss.maxHp).toBe(20);
      expect(boss.hp).toBe(15);
      expect(boss.phase).toBe('attacking');
    });
  });

  describe('5. 단일 보스 HP 권위 및 전투 판정 무결성', () => {
    it('명시적 maxHp가 설정된 상태에서도 takeDamage, isDefeated, hpPercent가 정확히 동작해야 한다', () => {
      const boss = new BossController(1, { maxHp: 20 });
      expect(boss.hp).toBe(20);
      expect(boss.maxHp).toBe(20);
      expect(boss.hpPercent).toBe(1);
      expect(boss.isDefeated).toBe(false);

      boss.takeDamage(8);
      expect(boss.hp).toBe(12);
      expect(boss.hpPercent).toBe(0.6);
      expect(boss.isDefeated).toBe(false);

      boss.takeDamage(15); // 체력 초과 피해
      expect(boss.hp).toBe(0);
      expect(boss.hpPercent).toBe(0);
      expect(boss.isDefeated).toBe(true);
      expect(boss.phase).toBe('defeated');
    });
  });
});
