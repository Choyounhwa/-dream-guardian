import { describe, it, expect, beforeEach } from 'vitest';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { PhaseAResourceManager } from '../../src/game/PhaseAResourceManager.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { EventBus } from '../../src/core/EventBus.js';

describe('미니언 군단 및 Phase B 결전 통합 검증 (tests/integration/troop-combat.test.ts / #194)', () => {
  let eventBus: EventBus;
  let battleState: BattleState;
  let bossController: BossController;
  let resourceManager: PhaseAResourceManager;
  let troopManager: MinionTroopManager;
  let bossFeverController: BossFeverController;
  let bossHazardController: BossHazardController;

  beforeEach(() => {
    eventBus = new EventBus();
    battleState = new BattleState(100);
    bossController = new BossController(5); // Ch.5 Nightmare: HP 20
    resourceManager = new PhaseAResourceManager({
      battle: battleState,
      boss: bossController,
    });
    troopManager = resourceManager.troopManager;
    troopManager.setBossController(bossController);
    troopManager.setEventBus(eventBus);

    bossFeverController = new BossFeverController({
      battleState,
      bossController,
    });

    bossHazardController = new BossHazardController({
      battleState,
      bossController,
      bossFeverController,
      minionTroopManager: troopManager,
      eventBus,
      autoSchedule: false,
    });
  });

  it('Phase A 10문제 러닝 후 자원 인계 -> Phase B 군단 화력 -> 피격 탈락 -> 보스 격파 통합 흐름 검증', () => {
    // ── Phase A 진행 ──
    // 7문제 정답, 3문제 오답
    for (let r = 1; r <= 7; r++) {
      resourceManager.onRoundSettled('correct', r);
      resourceManager.recordStarRating('Perfect', `note_p_${r}`); // 7 * 4 = 28 별가루
    }
    for (let r = 8; r <= 10; r++) {
      resourceManager.onRoundSettled('wrong', r);
    }

    // 10문제 정산 완료 후 군단: 초기 3 + 7 = 10마리, 별가루: 28
    expect(troopManager.minionCount).toBe(10);
    expect(resourceManager.stardust).toBe(28);

    // Phase B 인계 스냅샷 생성
    const snapshot = resourceManager.createSnapshot({
      isPhaseAComplete: true,
      totalSettledQuestions: 10,
    });

    expect(snapshot.minionCount).toBe(10);
    expect(snapshot.stardust).toBe(28);

    // ── Phase B 진입 ──
    // Zero-Reset 없이 Phase B 시작
    troopManager.startPhaseB(snapshot);
    bossHazardController.start();
    bossFeverController.start(0, snapshot);

    expect(troopManager.isActive).toBe(true);
    expect(troopManager.minionCount).toBe(10);
    expect(troopManager.stardust).toBe(28);

    // ── Zone 1~5 별빛 수집으로 게이지 배율 상승 ──
    // Perfect 3회 -> 게이지 1.0 -> 1.3
    troopManager.recordStarRating('Perfect', 1);
    troopManager.recordStarRating('Perfect', 2);
    troopManager.recordStarRating('Perfect', 3);
    expect(troopManager.gaugeMultiplier).toBeCloseTo(1.3, 5);

    // ── 별가루 소비형 강화 탄막 발사 ──
    // 화력 = (base 10 + 10 * 2 + bonus 10) * 1.3 = 40 * 1.3 = 52
    // 보스 HP가 20이므로 단 1발로 보스 체력 0 도달
    // 테스트를 위해 잔여 HP 20을 보장하는 일반 사격 먼저 검증
    const unenhancedDmg = troopManager.computeDamage(1.0, false);
    expect(unenhancedDmg).toBe(30); // (10 + 10 * 2) = 30

    // ── #193 보스 패턴 공격 피격 시 아군 미니언 1체 탈락 검증 ──
    // dual_slam 경고 후 회피 실패 유도
    bossHazardController.triggerAttack('dual_slam');
    // active 경과 (회피 입력 없음)
    bossHazardController.update(2.6);

    // 미니언 1체 탈락 확인: 10 -> 9
    expect(troopManager.minionCount).toBe(9);
    // 화력 재계산: (10 + 9 * 2) = 28
    expect(troopManager.computeDamage(1.0, false)).toBe(28);

    // ── 별가루 소비 및 보스 격파 ──
    // stardustCost: 5 소비
    const barrageRes = troopManager.fireBarrage({ consumeStardust: true });
    expect(barrageRes.fired).toBe(true);
    expect(barrageRes.isEnhanced).toBe(true);
    expect(troopManager.stardust).toBe(23); // 28 - 5 = 23
    expect(resourceManager.stardust).toBe(23); // PhaseAResourceManager 자원 지갑도 동기화

    // 보스 격파 확인
    expect(bossController.isDefeated).toBe(true);
    expect(bossController.hp).toBe(0);

    // 보스 처치 후 추가 탄막 발사 중단 검증
    const stoppedBarrage = troopManager.fireBarrage();
    expect(stoppedBarrage.fired).toBe(false);
  });
});
