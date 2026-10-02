/**
 * phase-b-pacing.test.ts - Phase A 체력 보존 및 Phase B(결전) 40~60초 템포 밸런싱 단위/통합 테스트
 *
 * @see Issue #288 [BATTLE-PHASE-B-PACING-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_BATTLE_CONFIG, DEFAULT_TROOP_COMBAT_CONFIG } from '../../config/battle.config.js';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('Phase B Pacing & Phase A Full HP Preservation (Issue #288)', () => {
  describe('1. 밸런스 설정 기본값 검증', () => {
    it('Phase A 정답 보스 기본 피해는 0이어야 한다 (체력 무감소)', () => {
      expect(DEFAULT_BATTLE_CONFIG.correctDamage).toBe(0);
      expect(DEFAULT_CONFIG.battle.correctDamage).toBe(0);
    });

    it('보스 Max HP는 일반 500, 나이트메어 750이어야 한다', () => {
      expect(DEFAULT_BATTLE_CONFIG.bossHpNormal).toBe(500);
      expect(DEFAULT_BATTLE_CONFIG.bossHpNightmare).toBe(750);
      expect(DEFAULT_CONFIG.battle.bossHpNormal).toBe(500);
      expect(DEFAULT_CONFIG.battle.bossHpNightmare).toBe(750);
    });

    it('군단 화력 설정: baseDamage=8, damagePerMinion=1, cooldown=2.0s, stardustBonusDamage=6이어야 한다', () => {
      expect(DEFAULT_TROOP_COMBAT_CONFIG.baseDamage).toBe(8);
      expect(DEFAULT_TROOP_COMBAT_CONFIG.damagePerMinion).toBe(1);
      expect(DEFAULT_TROOP_COMBAT_CONFIG.cooldown).toBe(2.0);
      expect(DEFAULT_TROOP_COMBAT_CONFIG.stardustBonusDamage).toBe(6);
      expect(DEFAULT_TROOP_COMBAT_CONFIG.stardustCost).toBe(5);
    });

    it('피버 설정: baseDamage=1, maxComboMultiplier=2.5이어야 한다', () => {
      expect(DEFAULT_BATTLE_CONFIG.fever.baseDamage).toBe(1);
      expect(DEFAULT_BATTLE_CONFIG.fever.maxComboMultiplier).toBe(2.5);
    });
  });

  describe('2. Phase A 10문제 러닝 동안 보스 체력 100% 완전 보존 (Full HP 500)', () => {
    let battle: BattleState;
    let boss: BossController;
    let guardian: GuardianSystem;
    let resolver: BeatRoundResolver;
    let spellCastCount: number;

    beforeEach(() => {
      battle = new BattleState(100);
      boss = new BossController(1); // Ch.1 boss HP = 500
      guardian = new GuardianSystem();
      spellCastCount = 0;
      resolver = new BeatRoundResolver({
        battle,
        boss,
        guardian,
        onSpellCast: () => {
          spellCastCount++;
        },
      });
    });

    it('10문제 모두 정답이어도 보스 HP는 500(100%)으로 유지되고 조기 처치되지 않는다', () => {
      expect(boss.hp).toBe(500);
      expect(boss.maxHp).toBe(500);

      for (let round = 1; round <= 10; round++) {
        resolver.startNewRound(round);
        const res = resolver.resolveRound('correct', round);

        expect(res.damageDealt).toBe(0);
        expect(boss.hp).toBe(500);
        expect(boss.isDefeated).toBe(false);
      }

      // 정답 10회 완료 확인: 마나 100 2회 도달 -> 스펠 2회 시전되었으나 보스 HP는 여전히 500
      expect(spellCastCount).toBe(2);
      expect(guardian.castCount).toBe(2);
      expect(boss.hp).toBe(500);
      expect(boss.hpPercent).toBe(1.0);
    });

    it('오답 및 타임아웃 발생 시에도 보스 HP는 500으로 온전히 유지된다', () => {
      resolver.startNewRound(1);
      resolver.resolveRound('wrong', 1);
      expect(boss.hp).toBe(500);

      resolver.startNewRound(2);
      resolver.resolveRound('timeout', 2);
      expect(boss.hp).toBe(500);
    });
  });

  describe('3. Phase B 40~60초 템포 밸런싱 결전 시뮬레이션', () => {
    it('미니언 군단(2초 주기 발사)과 유저 피버 별 수집 조합 시 보스 격파 시간이 40~55초 사이에 도달한다', () => {
      const boss = new BossController(1); // 500 HP
      const battleState = new BattleState(100);
      const eventBus = new EventBus();

      // Phase A에서 인계된 스냅샷 모의 (미니언 10마리, 별가루 30)
      const snapshot: Partial<PhaseAResourceSnapshot> = {
        minionCount: 10,
        guardianCount: 1,
        stardust: 30,
        totalStardustEarned: 30,
        bossHp: 500,
        maxBossHp: 500,
        isPhaseAComplete: true,
      };

      const troopManager = new MinionTroopManager({
        bossController: boss,
        eventBus,
      });
      troopManager.startPhaseB(snapshot as PhaseAResourceSnapshot);

      const feverController = new BossFeverController({
        bossController: boss,
        battleState,
      });
      feverController.start(0, snapshot as PhaseAResourceSnapshot);

      // 45초 결전 시뮬레이션 루프
      const dt = 0.5; // 0.5초 간격 시뮬레이션
      let elapsedSeconds = 0;
      let starNoteCounter = 0;

      while (!boss.isDefeated && elapsedSeconds < 70) {
        elapsedSeconds += dt;

        // 1. 군단 탄막 발사 업데이트 (자동 발사: 2초 주기, 별가루 여유 시 강화)
        troopManager.update(dt, { autoConsumeStardust: true });

        // 2. 유저 피버 별 수집: 초당 1개 수집 (~100~150 총 피해 목표)
        if (Math.round(elapsedSeconds * 2) % 2 === 0) {
          starNoteCounter++;
          const rating = starNoteCounter % 3 === 0 ? 'Good' : 'Perfect';
          feverController.recordRating(rating, `sim_star_${starNoteCounter}`);
        }
      }

      // 검증: 보스는 40초 이상 55초 이하에 격파되어야 한다
      expect(boss.isDefeated).toBe(true);
      expect(boss.hp).toBe(0);
      expect(elapsedSeconds).toBeGreaterThanOrEqual(40);
      expect(elapsedSeconds).toBeLessThanOrEqual(55);

      // 군단 발사 횟수 약 20~25회 확인
      expect(troopManager.barrageCount).toBeGreaterThanOrEqual(20);
      expect(troopManager.barrageCount).toBeLessThanOrEqual(28);
    });

    it('나이트메어 보스(Ch.5 HP 750)의 경우 결전 플레이 타임이 50~70초 범위로 밸런싱된다', () => {
      const boss = new BossController(5); // 750 HP
      const battleState = new BattleState(100);
      const eventBus = new EventBus();

      const snapshot: Partial<PhaseAResourceSnapshot> = {
        minionCount: 12,
        guardianCount: 1,
        stardust: 35,
        totalStardustEarned: 35,
        bossHp: 750,
        maxBossHp: 750,
        isPhaseAComplete: true,
      };

      const troopManager = new MinionTroopManager({
        bossController: boss,
        eventBus,
      });
      troopManager.startPhaseB(snapshot as PhaseAResourceSnapshot);

      const feverController = new BossFeverController({
        bossController: boss,
        battleState,
      });
      feverController.start(0, snapshot as PhaseAResourceSnapshot);

      const dt = 0.5;
      let elapsedSeconds = 0;
      let starNoteCounter = 0;

      while (!boss.isDefeated && elapsedSeconds < 90) {
        elapsedSeconds += dt;
        troopManager.update(dt, { autoConsumeStardust: true });
        if (Math.round(elapsedSeconds * 2) % 2 === 0) {
          starNoteCounter++;
          const rating = starNoteCounter % 3 === 0 ? 'Good' : 'Perfect';
          feverController.recordRating(rating, `sim_star_ch5_${starNoteCounter}`);
        }
      }

      expect(boss.isDefeated).toBe(true);
      expect(elapsedSeconds).toBeGreaterThanOrEqual(50);
      expect(elapsedSeconds).toBeLessThanOrEqual(75);
    });
  });

  describe('4. 보스 광폭화(Enrage) 및 5초 주기 장판 공격 8~10회 실행 검증', () => {
    it('결전 진행 중 45초 동안 보스 장판 공격(5초 주기)이 8~10회 실행되며 HP 30% 이하 시 광폭화가 발동한다', () => {
      const boss = new BossController(1); // 500 HP
      const battleState = new BattleState(100);
      const eventBus = new EventBus();

      let enrageEventFired = false;
      eventBus.on('boss:enrage', () => {
        enrageEventFired = true;
      });

      const hazardController = new BossHazardController({
        bossController: boss,
        battleState,
        eventBus,
        autoSchedule: true,
      });
      hazardController.start(0);

      // 초기 설정 확인
      expect(hazardController.effectiveAttackInterval).toBe(5.0);
      expect(hazardController.isEnraged).toBe(false);

      // 20초 시뮬레이션: 보스 HP 서서히 감소 (500 -> 200, 아직 40%로 광폭화 미발동)
      boss.takeDamage(300); // HP 200 (40%)
      const dt = 0.5;
      const simulateEvade = () => {
        if (hazardController.isAttacking) {
          const attack = hazardController.currentAttack;
          if (attack === 'dual_slam') hazardController.recordAction('jump');
          else if (attack === 'alternating_stomp_left') hazardController.recordAction('step_left');
          else if (attack === 'alternating_stomp_right') hazardController.recordAction('step_right');
        }
      };

      for (let t = 0; t < 20; t += dt) {
        hazardController.update(dt);
        simulateEvade();
      }
      expect(hazardController.isEnraged).toBe(false);
      expect(enrageEventFired).toBe(false);

      // 추가 55 데미지 가해 HP 145 (29% <= 30%) 진입
      boss.takeDamage(55);
      expect(boss.hp).toBe(145);
      expect(boss.hp / boss.maxHp).toBeLessThan(0.3);

      // update 1회로 광폭화 발동
      hazardController.update(dt);
      simulateEvade();
      expect(hazardController.isEnraged).toBe(true);
      expect(enrageEventFired).toBe(true);
      // 공격 주기 1.5배 가속 확인: 5.0 / 1.5 = 3.333초
      expect(hazardController.effectiveAttackInterval).toBeCloseTo(5.0 / 1.5, 2);

      // 총 50초까지 추가 진행 (전체 공격 성실히 회피하여 플레이어 생존)
      for (let t = 20.5; t <= 50; t += dt) {
        hazardController.update(dt);
        simulateEvade();
      }

      // 45~50초 동안 8~10회의 공격 패턴(totalAttacks) 실행 확인
      expect(hazardController.totalAttacks).toBeGreaterThanOrEqual(8);
      expect(hazardController.totalAttacks).toBeLessThanOrEqual(10);
    });
  });
});
