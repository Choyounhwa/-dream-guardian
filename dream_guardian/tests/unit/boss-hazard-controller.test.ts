import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';

describe('BossHazardController Unit Tests - [BATTLE-BOSS-001 / #193]', () => {
  let bossController: BossController;
  let battleState: BattleState;
  let minionManager: MinionTroopManager;
  let feverController: BossFeverController;
  let eventBus: EventBus;

  beforeEach(() => {
    bossController = new BossController(1); // Normal boss: HP 10
    battleState = new BattleState(100);
    minionManager = new MinionTroopManager({ initialMinions: 3, maxMinions: 13 });
    feverController = new BossFeverController({
      bossController,
      battleState,
      config: DEFAULT_BATTLE_CONFIG.fever,
    });
    eventBus = new EventBus();
  });

  describe('Lifecycle & Phase A separation', () => {
    it('초기 상태에서는 비활성화(isActive=false)이며 아무 공격도 발생하지 않는다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        eventBus,
      });

      expect(controller.isActive).toBe(false);
      expect(controller.isAttacking).toBe(false);
      expect(controller.currentAttack).toBeNull();
      expect(controller.totalAttacks).toBe(0);

      // Phase A 모의: update를 호출해도 공격이 트리거되지 않음 (0 attacks)
      controller.update(10.0);
      expect(controller.isAttacking).toBe(false);
      expect(controller.totalAttacks).toBe(0);
    });

    it('start() 호출 시 활성화되며 공격 타이머가 시작된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
        config: { attackInterval: 4.0 },
      });

      controller.start();
      expect(controller.isActive).toBe(true);
      expect(controller.isAttacking).toBe(false);

      // attackInterval 도달 시 공격 시작
      controller.update(4.0);
      expect(controller.isAttacking).toBe(true);
      expect(controller.currentAttack).not.toBeNull();
    });

    it('stop() 호출 시 즉시 모든 공격과 타이머가 정지되고 초기화된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      expect(controller.isAttacking).toBe(true);

      controller.stop();
      expect(controller.isActive).toBe(false);
      expect(controller.isAttacking).toBe(false);
      expect(controller.currentAttack).toBeNull();

      // stop 후 update를 진행해도 공격이 발생하지 않음
      controller.update(10.0);
      expect(controller.isAttacking).toBe(false);
    });

    it('pause() 시 타이머가 정지되어 시간이 흘러도 공격이 진행되지 않는다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
        config: { attackInterval: 4.0, warningDuration: 1.5, activeDuration: 1.0 },
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      expect(controller.isAttacking).toBe(true);
      const elapsedBefore = controller.attackElapsed;

      controller.pause();
      controller.update(2.0);
      expect(controller.attackElapsed).toBe(elapsedBefore);

      controller.resume();
      controller.update(0.5);
      expect(controller.attackElapsed).toBe(elapsedBefore + 0.5);
    });
  });

  describe('Attack Patterns & Evasion Input Matching', () => {
    it('dual_slam: 점프(jump) 입력 시 정상 회피된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
        config: { warningDuration: 1.5, activeDuration: 1.0 },
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      expect(controller.currentAttack).toBe('dual_slam');
      expect(controller.isEvaded).toBe(false);

      // 발동작 입력은 dual_slam 회피 불가
      controller.recordAction('step_left');
      expect(controller.isEvaded).toBe(false);

      // jump 입력 시 성공
      const success = controller.recordAction('jump');
      expect(success).toBe(true);
      expect(controller.isEvaded).toBe(true);
    });

    it('alternating_stomp_left: 왼발(step_left / zone 9) 입력 시 정상 회피된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('alternating_stomp_left');

      // 점프나 오른발은 회피 실패
      controller.recordAction('jump');
      expect(controller.isEvaded).toBe(false);
      controller.recordAction('step_right');
      expect(controller.isEvaded).toBe(false);

      // 왼발(step_left 또는 zone 9) 회피 성공
      const success = controller.recordAction('step_left');
      expect(success).toBe(true);
      expect(controller.isEvaded).toBe(true);
    });

    it('alternating_stomp_right: 오른발(step_right / zone 11) 입력 시 정상 회피된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('alternating_stomp_right');

      // 왼발은 회피 실패
      controller.recordAction('step_left');
      expect(controller.isEvaded).toBe(false);

      // 오른발(zone 11 또는 step_right) 회피 성공
      const success = controller.recordAction(11);
      expect(success).toBe(true);
      expect(controller.isEvaded).toBe(true);
    });
  });

  describe('Hit & Evasion Resolution', () => {
    it('회피 성공 시: 플레이어 피해 0, 미니언 손실 0, onEvaded 호출', () => {
      const onEvaded = vi.fn();
      const onHazardResolved = vi.fn();
      const resolvedSpy = vi.fn();
      eventBus.on('boss:hazard_resolved', resolvedSpy);

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        eventBus,
        config: { warningDuration: 1.0, activeDuration: 0.5, damage: 15 },
        onEvaded,
        onHazardResolved,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      controller.recordAction('jump');

      // 공격 시간 경과 (warning + active = 1.5초)
      controller.update(1.5);

      expect(battleState.hp).toBe(100); // 데미지 0
      expect(minionManager.minionCount).toBe(3); // 미니언 3마리 유지
      expect(onEvaded).toHaveBeenCalledTimes(1);
      expect(onHazardResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          attackType: 'dual_slam',
          evaded: true,
          damage: 0,
        }),
      );
      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attackType: 'dual_slam',
          evaded: true,
          damage: 0,
        }),
      );
    });

    it('회피 실패(Hit) 시: 플레이어 HP -15, 피버 콤보 0 리셋, 미니언 -1, MINION_CASUALTY 이벤트 발행', () => {
      const onHit = vi.fn();
      const onMinionCasualty = vi.fn();
      const casualtySpy = vi.fn();
      eventBus.on('MINION_CASUALTY', casualtySpy);

      // 피버 콤보 5 누적 모의
      battleState.incrementFeverCombo();
      battleState.incrementFeverCombo();
      battleState.incrementFeverCombo();
      battleState.incrementFeverCombo();
      battleState.incrementFeverCombo();
      expect(battleState.feverCombo).toBe(5);

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        eventBus,
        config: { warningDuration: 1.0, activeDuration: 0.5, damage: 15 },
        onHit,
        onMinionCasualty,
      });

      controller.start();
      controller.triggerAttack('alternating_stomp_left');
      // 회피 동작 없음!

      controller.update(1.5);

      expect(battleState.hp).toBe(85); // 100 - 15 = 85
      expect(battleState.feverCombo).toBe(0); // 피버 콤보 리셋
      expect(minionManager.minionCount).toBe(2); // 3 - 1 = 2
      expect(onHit).toHaveBeenCalledTimes(1);
      expect(onMinionCasualty).toHaveBeenCalledWith(2);
      expect(casualtySpy).toHaveBeenCalledWith({ remainingMinions: 2, attackType: 'alternating_stomp_left' });
    });

    it('미니언이 0마리일 때 추가 피격되어도 0마리 미만으로 감소하지 않는다 (하한 클램프)', () => {
      minionManager.removeMinion(3);
      expect(minionManager.minionCount).toBe(0);

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        eventBus,
        config: { warningDuration: 1.0, activeDuration: 0.5, damage: 15 },
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      controller.update(1.5);

      expect(minionManager.minionCount).toBe(0);
      expect(battleState.hp).toBe(85);
    });

    it('단일 공격에 대해 판정 및 이벤트 발행이 정확히 1회만 실행된다 (Idempotency)', () => {
      const onHit = vi.fn();
      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        config: { warningDuration: 1.0, activeDuration: 0.5, damage: 15 },
        onHit,
      });

      controller.start();
      controller.triggerAttack('dual_slam');

      controller.update(1.5); // 판정 발동
      expect(onHit).toHaveBeenCalledTimes(1);

      // 이후 프레임이 더 흘러도 추가 판정이 발생하지 않음
      controller.update(0.5);
      expect(onHit).toHaveBeenCalledTimes(1);
      expect(battleState.hp).toBe(85);
    });
  });

  describe('Boss Enrage (광폭화)', () => {
    it('보스 체력이 30% 이하 도달 시 광폭화가 단 1회 발동하고 공격 주기가 1.5배 단축된다', () => {
      const onEnrage = vi.fn();
      const enrageSpy = vi.fn();
      eventBus.on('boss:enrage', enrageSpy);

      const controller = new BossHazardController({
        bossController,
        battleState,
        eventBus,
        config: {
          attackInterval: 4.5,
          enrageHpRatio: 0.3,
          enrageSpeedMultiplier: 1.5,
        },
        onEnrage,
      });

      controller.start();
      expect(controller.isEnraged).toBe(false);
      expect(controller.effectiveAttackInterval).toBe(4.5);

      // 보스 HP: 10 -> 4 (40%: 미발동)
      bossController.takeDamage(6);
      controller.update(0.1);
      expect(controller.isEnraged).toBe(false);
      expect(onEnrage).not.toHaveBeenCalled();

      // 보스 HP: 4 -> 3 (30%: 광폭화 트리거)
      bossController.takeDamage(1);
      controller.update(0.1);
      expect(controller.isEnraged).toBe(true);
      expect(onEnrage).toHaveBeenCalledTimes(1);
      expect(enrageSpy).toHaveBeenCalledWith({ hp: 3, maxHp: 10 });

      // 공격 주기가 4.5 / 1.5 = 3.0초로 단축됨
      expect(controller.effectiveAttackInterval).toBeCloseTo(3.0);

      // 추가 체력 감소 시에도 enrage는 중복 발동하지 않음 (단 1회)
      bossController.takeDamage(1);
      controller.update(0.1);
      expect(onEnrage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Lifecycle Terminations', () => {
    it('보스 처치 시(isDefeated=true) 공격이 즉시 중단되고 0 attacks를 보장한다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      expect(controller.isAttacking).toBe(true);

      // 보스 격파
      bossController.takeDamage(10);
      expect(bossController.isDefeated).toBe(true);

      controller.update(0.1);
      expect(controller.isActive).toBe(false);
      expect(controller.isAttacking).toBe(false);
    });

    it('플레이어 사망 시(hp<=0) 공격이 즉시 중단된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');

      battleState.applyBossMagicDamage(100);
      expect(battleState.isAlive).toBe(false);

      controller.update(0.1);
      expect(controller.isActive).toBe(false);
      expect(controller.isAttacking).toBe(false);
    });
  });
});
