import { describe, it, expect, beforeEach } from 'vitest';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { BossController } from '../../src/game/BossController.js';
import { EventBus } from '../../src/core/EventBus.js';
import { type TroopCombatConfig } from '../../config/battle.config.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('MinionTroopManager - Phase B 군단 화력 및 자원 소비 단위 테스트 (Issue #194 / MINION-TROOP-001)', () => {
  let troopManager: MinionTroopManager;
  let boss: BossController;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    boss = new BossController(1); // HP = 10
    troopManager = new MinionTroopManager({
      bossController: boss,
      eventBus,
    });
  });

  describe('1. Phase B 인계 자원 보존 (Zero-Reset 방지)', () => {
    it('Phase A 스냅샷으로부터 미니언 수(3~13)와 별가루를 정상 인계받고 0 리셋되지 않는다', () => {
      const mockSnapshot: Partial<PhaseAResourceSnapshot> = {
        minionCount: 8,
        guardianCount: 1,
        stardust: 25,
        totalStardustEarned: 25,
      };

      troopManager.startPhaseB(mockSnapshot as PhaseAResourceSnapshot);

      expect(troopManager.isActive).toBe(true);
      expect(troopManager.minionCount).toBe(8);
      expect(troopManager.stardust).toBe(25);
      expect(troopManager.guardianCount).toBe(1);
      expect(troopManager.totalTroopCount).toBe(9);
    });

    it('인계 시 기존 Phase A 정산 기록이나 보유 미니언이 초기값(3)으로 되돌아가지 않는다', () => {
      // Phase A에서 정답 5회로 미니언 8마리 누적
      for (let i = 1; i <= 5; i++) {
        troopManager.onRoundSettled('correct', i);
      }
      expect(troopManager.minionCount).toBe(8);

      // Phase B 시작
      troopManager.startPhaseB();
      expect(troopManager.minionCount).toBe(8);
      expect(troopManager.isActive).toBe(true);
    });
  });

  describe('2. 군단 화력 공식 (Troop DPS Calculation)', () => {
    it('화력 공식 (baseDamage + minionCount * damagePerMinion) * gaugeMultiplier를 준수한다', () => {
      // 기본 설정: baseDamage: 10, damagePerMinion: 2, gaugeMultiplier: 1.0
      // minionCount = 3 -> (10 + 3 * 2) * 1.0 = 16
      expect(troopManager.computeDamage(1.0)).toBe(16);

      // minionCount = 8 -> (10 + 8 * 2) * 1.0 = 26
      troopManager.addMinion(5);
      expect(troopManager.minionCount).toBe(8);
      expect(troopManager.computeDamage(1.0)).toBe(26);

      // minionCount = 13 (최대) -> (10 + 13 * 2) * 1.0 = 36
      troopManager.addMinion(5);
      expect(troopManager.minionCount).toBe(13);
      expect(troopManager.computeDamage(1.0)).toBe(36);

      // 게이지 최대 배율 1.5x 적용 시 -> 36 * 1.5 = 54
      expect(troopManager.computeDamage(1.5)).toBe(54);
    });

    it('미니언이 전멸(0마리)해도 수호신 단독 대치로 baseDamage(10)를 발휘한다', () => {
      troopManager.removeMinion(10);
      expect(troopManager.minionCount).toBe(0);
      expect(troopManager.guardianCount).toBe(1);
      expect(troopManager.totalTroopCount).toBe(1);

      // (10 + 0 * 2) * 1.0 = 10
      expect(troopManager.computeDamage(1.0)).toBe(10);
      // 배율 1.5x -> 15
      expect(troopManager.computeDamage(1.5)).toBe(15);
    });

    it('커스텀 TroopCombatConfig 주입 시 설정값을 충실히 반영한다', () => {
      const customConfig: Partial<TroopCombatConfig> = {
        baseDamage: 20,
        damagePerMinion: 5,
        maxGaugeMultiplier: 2.0,
      };
      const customManager = new MinionTroopManager({
        combatConfig: customConfig,
      });

      // minion 3 -> (20 + 3 * 5) * 1.0 = 35
      expect(customManager.computeDamage(1.0)).toBe(35);
      // multiplier 2.0 -> 70
      expect(customManager.computeDamage(2.0)).toBe(70);
    });
  });

  describe('3. 마법 게이지 충전 및 판정 실패 딜레이 메커니즘', () => {
    beforeEach(() => {
      troopManager.startPhaseB({
        minionCount: 5,
        guardianCount: 1,
        stardust: 10,
        totalStardustEarned: 10,
      } as PhaseAResourceSnapshot);
    });

    it('초기 게이지 배율은 1.0이다', () => {
      expect(troopManager.gaugeMultiplier).toBe(1.0);
    });

    it('Zone 1~5 상체 별빛 수집 성공 시 게이지가 +0.1 충전되며 최대 1.5배까지 증가한다', () => {
      // 1회 Perfect
      troopManager.recordStarRating('Perfect', 1);
      expect(troopManager.gaugeMultiplier).toBeCloseTo(1.1, 5);

      // 4회 추가 수집 (총 5회 -> 1.5)
      for (let i = 2; i <= 5; i++) {
        troopManager.recordStarRating('Good', i);
      }
      expect(troopManager.gaugeMultiplier).toBeCloseTo(1.5, 5);

      // 상한 1.5배 클램프 확인 (추가 수집해도 1.5 유지)
      troopManager.recordStarRating('Perfect', 2);
      expect(troopManager.gaugeMultiplier).toBe(1.5);
    });

    it('Zone 1~5 이외의 영역 수집은 상체 별빛 게이지에 영향을 주지 않는다', () => {
      // 발 영역 Zone 9, 11
      troopManager.recordStarRating('Perfect', 9);
      expect(troopManager.gaugeMultiplier).toBe(1.0);
    });

    it('Miss(판정 실패) 시 발사 쿨다운 지연(0.5초 딜레이)이 가산되고 게이지가 감쇠된다', () => {
      // 먼저 게이지 1.3까지 충전
      troopManager.recordStarRating('Perfect', 1);
      troopManager.recordStarRating('Perfect', 2);
      troopManager.recordStarRating('Perfect', 3);
      expect(troopManager.gaugeMultiplier).toBeCloseTo(1.3, 5);

      const initialCooldown = troopManager.cooldownTimer;
      const res = troopManager.recordStarRating('Miss');

      expect(res.success).toBe(false);
      expect(res.delayAdded).toBeGreaterThan(0);
      expect(troopManager.cooldownTimer).toBeGreaterThanOrEqual(initialCooldown + res.delayAdded);
      // 게이지 감쇠 확인
      expect(troopManager.gaugeMultiplier).toBeLessThan(1.3);
    });
  });

  describe('4. 별가루 소비 (Enhanced Barrage) 및 오버드래프트 거부', () => {
    beforeEach(() => {
      troopManager.startPhaseB({
        minionCount: 5,
        guardianCount: 1,
        stardust: 12,
        totalStardustEarned: 12,
      } as PhaseAResourceSnapshot);
    });

    it('충분한 별가루(>= stardustCost: 5) 보유 시 소비에 성공하고 강화 탄막 피해를 가한다', () => {
      expect(troopManager.stardust).toBe(12);

      const fired = troopManager.fireBarrage({ consumeStardust: true });
      expect(fired.fired).toBe(true);
      expect(fired.isEnhanced).toBe(true);
      expect(troopManager.stardust).toBe(7); // 12 - 5 = 7
      // 기본 피해 (10 + 5 * 2) = 20, 강화 보너스 10 -> 총 30
      expect(fired.damage).toBe(30);
    });

    it('별가루 부족 시 오버드래프트(초과 차감)를 거부하고 일반 탄막으로 발사되거나 실패한다', () => {
      // 보스 처치로 인한 발사 중단을 배제하기 위해 bossController 해제
      troopManager.setBossController(undefined as any);

      // 12에서 5씩 2번 소비 -> 잔여 2
      troopManager.fireBarrage({ consumeStardust: true }); // 잔여 7
      troopManager.fireBarrage({ consumeStardust: true }); // 잔여 2
      expect(troopManager.stardust).toBe(2);

      // 잔여 2인 상태에서 비용 5 요구
      const fired = troopManager.fireBarrage({ consumeStardust: true });
      expect(fired.isEnhanced).toBe(false);
      expect(troopManager.stardust).toBe(2); // 잔여량 보존 (오버드래프트 거부)
    });

    it('음수 또는 NaN 소비 요청을 거부한다', () => {
      expect(troopManager.consumeStardust(-5)).toBe(false);
      expect(troopManager.consumeStardust(NaN)).toBe(false);
      expect(troopManager.consumeStardust(0)).toBe(false);
      expect(troopManager.stardust).toBe(12);
    });

    it('동일 멱등키(idempotencyKey)에 대한 중복 소비를 원천 차단한다', () => {
      const ok1 = troopManager.consumeStardust(5, 'tx_barrage_1');
      expect(ok1).toBe(true);
      expect(troopManager.stardust).toBe(7);

      const ok2 = troopManager.consumeStardust(5, 'tx_barrage_1');
      expect(ok2).toBe(false);
      expect(troopManager.stardust).toBe(7);
    });
  });

  describe('5. 피격 탈락 연결 (#193 연동)', () => {
    beforeEach(() => {
      troopManager.startPhaseB({
        minionCount: 4,
        guardianCount: 1,
        stardust: 10,
        totalStardustEarned: 10,
      } as PhaseAResourceSnapshot);
    });

    it('removeMinion 호출 시 미니언 1체가 탈락하고 0마리 하한 클램프된다', () => {
      expect(troopManager.minionCount).toBe(4);

      troopManager.removeMinion(1);
      expect(troopManager.minionCount).toBe(3);

      troopManager.removeMinion(10);
      expect(troopManager.minionCount).toBe(0);
      expect(troopManager.guardianCount).toBe(1);
      expect(troopManager.totalTroopCount).toBe(1);
    });

    it('미니언 탈락 시 화력이 즉시 감소하여 DPS 정합성을 보장한다', () => {
      // 4마리 화력: (10 + 4 * 2) = 18
      expect(troopManager.computeDamage(1.0)).toBe(18);

      troopManager.removeMinion(2); // 2마리 남음
      // 2마리 화력: (10 + 2 * 2) = 14
      expect(troopManager.computeDamage(1.0)).toBe(14);
    });
  });

  describe('6. 보스 치명 피해 및 처치 시 사격 중단', () => {
    beforeEach(() => {
      boss = new BossController(1); // HP 10
      troopManager = new MinionTroopManager({
        bossController: boss,
        eventBus,
      });
      troopManager.startPhaseB({
        minionCount: 3,
        guardianCount: 1,
        stardust: 0,
        totalStardustEarned: 0,
      } as PhaseAResourceSnapshot);
    });

    it('탄막 발사 시 보스에게 치명 피해를 입히며 bossController.takeDamage가 호출된다', () => {
      expect(boss.hp).toBe(10);
      expect(boss.isDefeated).toBe(false);

      // 탄막 1회 발사 (damage = 16)
      const res = troopManager.fireBarrage();
      expect(res.fired).toBe(true);
      expect(boss.hp).toBe(0);
      expect(boss.isDefeated).toBe(true);
    });

    it('보스가 처치되면 추가 탄막 발사가 즉시 중단된다', () => {
      troopManager.fireBarrage();
      expect(boss.isDefeated).toBe(true);

      const nextFire = troopManager.fireBarrage();
      expect(nextFire.fired).toBe(false);
    });

    it('update 루프에서 쿨다운 경과 시 자동으로 탄막을 발사한다', () => {
      // 쿨다운 1.0초
      let fired = troopManager.update(0.5);
      expect(fired).toBeNull();
      expect(boss.hp).toBe(10);

      // 0.6초 추가 경과 -> 총 1.1초 경과로 발사
      fired = troopManager.update(0.6);
      expect(fired).not.toBeNull();
      expect(fired?.fired).toBe(true);
      expect(boss.isDefeated).toBe(true);
    });
  });
});
