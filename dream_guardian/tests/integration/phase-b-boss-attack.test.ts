import { describe, it, expect, beforeEach } from 'vitest';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { EventBus } from '../../src/core/EventBus.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';

describe('Phase B Boss Attack & Evasion Integration - [BATTLE-BOSS-001 / #193]', () => {
  let bossController: BossController;
  let battleState: BattleState;
  let minionManager: MinionTroopManager;
  let stateMachine: StateMachine;
  let scheduler: StarNoteScheduler;
  let feverController: BossFeverController;
  let hazardController: BossHazardController;
  let eventBus: EventBus;

  beforeEach(() => {
    bossController = new BossController(1); // HP 10
    battleState = new BattleState(100);
    minionManager = new MinionTroopManager({ initialMinions: 3, maxMinions: 13 });
    stateMachine = new StateMachine('ROUND_RESOLVE');
    scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });
    eventBus = new EventBus();

    feverController = new BossFeverController({
      bossController,
      battleState,
      stateMachine,
      scheduler,
      config: DEFAULT_BATTLE_CONFIG.fever,
    });

    hazardController = new BossHazardController({
      bossController,
      battleState,
      bossFeverController: feverController,
      minionTroopManager: minionManager,
      eventBus,
      config: {
        attackInterval: 4.0,
        warningDuration: 1.0,
        activeDuration: 0.5,
        damage: 15,
        enrageHpRatio: 0.3,
        enrageSpeedMultiplier: 1.5,
      },
    });
  });

  it('Phase A에서는 보스 공격 컨트롤러가 비활성 상태를 유지하여 0회 공격을 보장한다', () => {
    expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
    expect(hazardController.isActive).toBe(false);
    expect(hazardController.totalAttacks).toBe(0);

    // Phase A 루프 진행 모의
    hazardController.update(10.0);
    expect(hazardController.isAttacking).toBe(false);
    expect(hazardController.totalAttacks).toBe(0);
  });

  it('Phase B(BOSS_CLIMAX) 진입 시 보스 공격이 시작되고, 점프 회피 및 피격에 따른 피버 콤보/미니언 연동이 완벽히 작동한다', () => {
    // 1. BOSS_CLIMAX 상태 전이 및 컨트롤러 가동
    stateMachine.changeState('BOSS_CLIMAX');
    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');

    feverController.start(0);
    hazardController.start();
    expect(hazardController.isActive).toBe(true);

    // 2. 피버 별 수집으로 피버 콤보 2 누적 & 보스에게 데미지
    feverController.recordRating('Perfect', 'fever_1');
    feverController.recordRating('Perfect', 'fever_2');
    expect(battleState.feverCombo).toBe(2);
    expect(bossController.hp).toBeLessThan(10);

    // 3. 보스 패턴 1: dual_slam (양손 쿵 충격파) 발생
    hazardController.triggerAttack('dual_slam');
    expect(hazardController.currentAttack).toBe('dual_slam');

    // 유저가 점프(jump)로 회피 성공!
    hazardController.recordAction('jump');
    hazardController.update(1.5); // 판정 완료

    expect(battleState.hp).toBe(100); // 데미지 없음
    expect(battleState.feverCombo).toBe(2); // 피버 콤보 유지!
    expect(minionManager.minionCount).toBe(3); // 미니언 보존!

    // 4. 보스 패턴 2: alternating_stomp_left (적 미니언 침투) 발생
    hazardController.triggerAttack('alternating_stomp_left');
    expect(hazardController.currentAttack).toBe('alternating_stomp_left');

    // 유저가 회피 실패(Hit)
    hazardController.update(1.5); // 판정 완료

    expect(battleState.hp).toBe(85); // 100 - 15 = 85
    expect(battleState.feverCombo).toBe(0); // 피버 콤보 0 리셋!
    expect(minionManager.minionCount).toBe(2); // 아군 미니언 1마리 탈락!
  });

  it('보스 체력이 30% 이하로 내려가면 광폭화가 발동하여 공격 주기가 가속되고, 처치 시 공격이 완전 정지한다', () => {
    stateMachine.changeState('BOSS_CLIMAX');
    feverController.start(0);
    hazardController.start();

    // 초기 공격 주기: 4.0초
    expect(hazardController.effectiveAttackInterval).toBe(4.0);

    // 보스에게 대량 피해를 가해 HP를 3(30%)으로 낮춤
    bossController.takeDamage(7);
    expect(bossController.hp).toBe(3);

    hazardController.update(0.1);
    expect(hazardController.isEnraged).toBe(true);
    // 광폭화 가속: 4.0 / 1.5 = 2.666...초
    expect(hazardController.effectiveAttackInterval).toBeCloseTo(4.0 / 1.5);

    // 보스 최종 격파
    bossController.takeDamage(3);
    expect(bossController.isDefeated).toBe(true);

    hazardController.update(0.1);
    expect(hazardController.isActive).toBe(false);
    expect(hazardController.isAttacking).toBe(false);
  });
});
