import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BossHazardController,
  DEFAULT_BOSS_HAZARD_PATTERNS,
} from '../../src/game/BossHazardController.js';
import {
  createSessionStageSnapshot,
  resolvePhaseBHazardPatterns,
  type SessionStageBundle,
} from '../../src/game/SessionContent.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';
import type { CompiledPhaseBHazard } from '../../src/data/PublishedContentPack.js';

function createMockBundle(params?: {
  isBuiltin?: boolean;
  hazards?: CompiledPhaseBHazard[];
  seed?: number;
}): SessionStageBundle {
  return createSessionStageSnapshot({
    stageId: 'stage_test_hazard_b',
    sourcePackHash: 'hash_hazard_b_12345678',
    rulesetId: 'dg-ruleset-v2',
    rulesetHash: 'hash_ruleset_abc',
    runtimeContractVersion: '2.0.0',
    bpm: 120,
    beatsPerBar: 4,
    isBuiltin: params?.isBuiltin ?? false,
    isFallback: false,
    seed: params?.seed ?? 42,
    phaseA: {
      starNotes: [],
      hazard: null,
      motionGuide: [],
    },
    phaseB: {
      feverNotes: [],
      hazards: params?.hazards ?? [
        {
          id: 'hz_1',
          attackType: 'dual_slam',
          requiredAction: 'jump',
          warningDurationSeconds: 1.5,
          activeDurationSeconds: 1.0,
          damage: 15,
        },
        {
          id: 'hz_2',
          attackType: 'alternating_stomp_left',
          requiredAction: 'left_step',
          warningDurationSeconds: 1.5,
          activeDurationSeconds: 1.0,
          damage: 15,
        },
      ],
      motionGuide: [],
    },
  });
}

describe('Issue #401 [GAME-HAZARD-B-CONTENT] Phase B 장판 순서 공급과 전투 수명 보존', () => {
  let bossController: BossController;
  let battleState: BattleState;
  let minionManager: MinionTroopManager;
  let feverController: BossFeverController;
  let eventBus: EventBus;

  beforeEach(() => {
    bossController = new BossController(1); // Normal boss: maxHp 10
    battleState = new BattleState(100);
    minionManager = new MinionTroopManager({ initialMinions: 3, maxMinions: 13 });
    feverController = new BossFeverController({
      bossController,
      battleState,
      config: DEFAULT_BATTLE_CONFIG.fever,
    });
    eventBus = new EventBus();
  });

  describe('1. SessionStageBundle의 Phase B 보스 장판 패턴 해석 (getPhaseBHazardPatterns)', () => {
    it('커스텀 팩의 유효한 공격 리스트(dual_slam, alternating_stomp_left 등)를 순서대로 반환한다', () => {
      const bundle = createMockBundle({
        isBuiltin: false,
        hazards: [
          { attackType: 'alternating_stomp_right', requiredAction: 'right_step' },
          { attackType: 'dual_slam', requiredAction: 'jump' },
          { attackType: 'alternating_stomp_left', requiredAction: 'left_step' },
        ],
      });

      const patterns = bundle.getPhaseBHazardPatterns();
      expect(patterns).toEqual([
        'alternating_stomp_right',
        'dual_slam',
        'alternating_stomp_left',
      ]);
    });

    it('builtin 팩이거나 hazards 목록이 비어있는 경우 DEFAULT_BOSS_HAZARD_PATTERNS로 fallback한다', () => {
      const builtinBundle = createMockBundle({
        isBuiltin: true,
        hazards: [{ attackType: 'dual_slam', requiredAction: 'jump' }],
      });
      expect(builtinBundle.getPhaseBHazardPatterns()).toEqual(DEFAULT_BOSS_HAZARD_PATTERNS);

      const emptyBundle = createMockBundle({
        isBuiltin: false,
        hazards: [],
      });
      expect(emptyBundle.getPhaseBHazardPatterns()).toEqual(DEFAULT_BOSS_HAZARD_PATTERNS);
    });

    it('공격 종류와 요구 입력의 모순이 있는 경우 해당 항목을 거부하고 유효한 항목만 반환한다', () => {
      const contradictoryBundle = createMockBundle({
        isBuiltin: false,
        hazards: [
          { attackType: 'dual_slam', requiredAction: 'left_step' }, // 모순: dual_slam은 jump여야 함
          { attackType: 'alternating_stomp_right', requiredAction: 'right_step' }, // 정상
          { attackType: 'invalid_attack' as any, requiredAction: 'jump' }, // 미지원 공격
        ],
      });

      const patterns = contradictoryBundle.getPhaseBHazardPatterns();
      expect(patterns).toEqual(['alternating_stomp_right']);
    });

    it('모든 항목이 모순되거나 유효하지 않은 경우 안전하게 DEFAULT_BOSS_HAZARD_PATTERNS로 fallback한다', () => {
      const allInvalidBundle = createMockBundle({
        isBuiltin: false,
        hazards: [
          { attackType: 'dual_slam', requiredAction: 'left_step' },
          { attackType: 'alternating_stomp_left', requiredAction: 'jump' },
        ],
      });

      expect(allInvalidBundle.getPhaseBHazardPatterns()).toEqual(DEFAULT_BOSS_HAZARD_PATTERNS);
    });

    it('resolvePhaseBHazardPatterns 함수로도 동일한 해석 결과를 반환한다', () => {
      const bundle = createMockBundle({
        isBuiltin: false,
        hazards: [{ attackType: 'dual_slam', requiredAction: 'jump' }],
      });

      expect(resolvePhaseBHazardPatterns(bundle)).toEqual(['dual_slam']);
    });

    it('getPhaseBHazardExecutionId로 루프 및 공격 인덱스별 고유 ID를 결정론적으로 생성한다', () => {
      const bundle = createMockBundle();
      const id0_0 = bundle.getPhaseBHazardExecutionId(0, 0);
      const id0_1 = bundle.getPhaseBHazardExecutionId(0, 1);
      const id1_0 = bundle.getPhaseBHazardExecutionId(1, 0);

      expect(id0_0).toMatch(/_loop0_h0$/);
      expect(id0_1).toMatch(/_loop0_h1$/);
      expect(id1_0).toMatch(/_loop1_h0$/);
      expect(id0_0).not.toBe(id0_1);
      expect(id0_0).not.toBe(id1_0);
    });
  });

  describe('2. BossHazardController 순서 공급, strict cycling 및 executionId 연동', () => {
    it('stageBundle의 패턴 풀을 순서대로 순환(0 -> 1 -> 0 ...)하며 공격을 실행한다', () => {
      const bundle = createMockBundle({
        isBuiltin: false,
        hazards: [
          { attackType: 'alternating_stomp_left', requiredAction: 'left_step' },
          { attackType: 'dual_slam', requiredAction: 'jump' },
        ],
      });

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        eventBus,
        stageBundle: bundle,
      });

      controller.start();

      // 첫 번째 공격: index 0 -> alternating_stomp_left, loop 0, attack 0
      controller.triggerAttack();
      expect(controller.currentAttack).toBe('alternating_stomp_left');
      expect(controller.attackId).toBe(bundle.getPhaseBHazardExecutionId(0, 0));
      controller.update(2.5); // warning(1.5) + active(1.0) 종료

      // 두 번째 공격: index 1 -> dual_slam, loop 0, attack 1
      controller.triggerAttack();
      expect(controller.currentAttack).toBe('dual_slam');
      expect(controller.attackId).toBe(bundle.getPhaseBHazardExecutionId(0, 1));
      controller.update(2.5);

      // 세 번째 공격: index 0 (순환) -> alternating_stomp_left, loop 1, attack 0
      controller.triggerAttack();
      expect(controller.currentAttack).toBe('alternating_stomp_left');
      expect(controller.attackId).toBe(bundle.getPhaseBHazardExecutionId(1, 0));
    });

    it('setStageBundle 또는 setPatternPool로 실행 중 패턴 목록을 갱신할 수 있다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      expect(controller.patternPool).toEqual(DEFAULT_BOSS_HAZARD_PATTERNS);

      const newBundle = createMockBundle({
        isBuiltin: false,
        hazards: [{ attackType: 'alternating_stomp_right', requiredAction: 'right_step' }],
      });

      controller.setStageBundle(newBundle);
      expect(controller.patternPool).toEqual(['alternating_stomp_right']);
      expect(controller.stageBundle).toBe(newBundle);

      controller.setPatternPool(['dual_slam']);
      expect(controller.patternPool).toEqual(['dual_slam']);
    });

    it('공격 진행 중(isAttacking) 중복 triggerAttack 호출 시 단일 공격 동시성을 유지한다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      expect(controller.isAttacking).toBe(true);
      expect(controller.currentAttack).toBe('dual_slam');
      const firstAttackId = controller.attackId;

      // 이미 공격 진행 중에 또 다른 공격 호출 시도 -> 무시되어야 함
      controller.triggerAttack('alternating_stomp_left');
      expect(controller.currentAttack).toBe('dual_slam');
      expect(controller.attackId).toBe(firstAttackId);
      expect(controller.totalAttacks).toBe(1);
    });
  });

  describe('3. 회피 성공(0 피해) 및 회피 실패(-15 HP, 콤보 리셋, 미니언 1체 손실) 보존', () => {
    it('회피 성공 시 피해 0, 미니언 손실 0이 적용된다', () => {
      const onEvaded = vi.fn();
      const onHazardResolved = vi.fn();

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        eventBus,
        onEvaded,
        onHazardResolved,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      const evaded = controller.recordAction('jump');
      expect(evaded).toBe(true);

      controller.update(2.5); // warning(1.5) + active(1.0)
      expect(battleState.hp).toBe(100);
      expect(minionManager.minionCount).toBe(3);
      expect(onEvaded).toHaveBeenCalledTimes(1);
      expect(onHazardResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          attackType: 'dual_slam',
          evaded: true,
          damage: 0,
          remainingHp: 100,
          remainingMinions: 3,
        }),
      );
    });

    it('회피 실패 시 플레이어 HP -15, 피버 콤보 0 리셋, 아군 미니언 1체 탈락이 적용된다', () => {
      const onHit = vi.fn();
      const onMinionCasualty = vi.fn();

      // 피버 콤보 3 누적
      (feverController as any)._feverCombo = 3;
      expect(feverController.feverCombo).toBe(3);

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
        eventBus,
        onHit,
        onMinionCasualty,
      });

      controller.start();
      controller.triggerAttack('alternating_stomp_left');
      // 회피 입력 없이 시간 경과
      controller.update(2.5);

      expect(battleState.hp).toBe(85); // 100 - 15
      expect(feverController.feverCombo).toBe(0); // 피버 콤보 0 리셋
      expect(minionManager.minionCount).toBe(2); // 3 - 1
      expect(onHit).toHaveBeenCalledTimes(1);
      expect(onMinionCasualty).toHaveBeenCalledWith(2);
    });

    it('미니언이 0마리일 때 회피 실패해도 0마리 미만으로 감소하지 않는다', () => {
      minionManager.removeMinion(3);
      expect(minionManager.minionCount).toBe(0);

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        bossFeverController: feverController,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      controller.update(2.5);

      expect(minionManager.minionCount).toBe(0);
      expect(battleState.hp).toBe(85);
    });
  });

  describe('4. 광폭화(HP 30% 이하 시 1.5배 가속) 및 기존 전투 수치 불변 유지', () => {
    it('보스 체력이 30% 이하가 되면 광폭화가 발동하고 공격 주기가 1.5배 가속된다', () => {
      const onEnrage = vi.fn();
      const controller = new BossHazardController({
        bossController,
        battleState,
        config: {
          attackInterval: 5.0,
          warningDuration: 1.5,
          activeDuration: 1.0,
          damage: 15,
          enrageHpRatio: 0.3,
          enrageSpeedMultiplier: 1.5,
        },
        onEnrage,
      });

      controller.start();
      expect(controller.isEnraged).toBe(false);
      expect(controller.effectiveAttackInterval).toBe(5.0);

      // 보스 HP: 30% 이하로 감소
      bossController.takeDamage(bossController.maxHp * 0.75);
      expect(bossController.hp / bossController.maxHp).toBeLessThanOrEqual(0.3);

      controller.update(0.1);
      expect(controller.isEnraged).toBe(true);
      expect(onEnrage).toHaveBeenCalledTimes(1);
      // 5.0 / 1.5 = 3.333... 초
      expect(controller.effectiveAttackInterval).toBeCloseTo(3.333, 2);
    });

    it('자유발동시간이나 임의 전투값(피해량 등) 변조 없이 기본 설정값(15 HP 등)을 엄격히 유지한다', () => {
      // CompiledPhaseBHazard에 비표준 duration/damage가 명시되어 있어도 컨트롤러의 전투 수치는 보존됨
      const weirdHazardBundle = createMockBundle({
        isBuiltin: false,
        hazards: [
          {
            attackType: 'dual_slam',
            requiredAction: 'jump',
            warningDurationSeconds: 99.0, // 변조 시도
            activeDurationSeconds: 99.0, // 변조 시도
            damage: 999, // 변조 시도
          },
        ],
      });

      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        stageBundle: weirdHazardBundle,
      });

      controller.start();
      controller.triggerAttack();

      // 기본 warningDuration 1.5 + activeDuration 1.0 = 2.5초 후 정산
      controller.update(2.5);
      expect(battleState.hp).toBe(85); // 999 피해가 아닌 15 피해 적용
    });
  });

  describe('5. 생명주기: pause/stop/death 이후 잔여 공격 0건 및 단일 결과 보장', () => {
    it('pause() 시 타이머가 동결되어 공격 진행 및 판정이 중단된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');
      controller.update(1.0); // 1초 경과 (warning 상태)

      controller.pause();
      controller.update(5.0); // 일시정지 중 5초 경과
      expect(controller.attackElapsed).toBe(1.0);
      expect(controller.isAttacking).toBe(true);
      expect(controller.attackState).toBe('warning');

      controller.resume();
      controller.update(0.5); // resume 후 0.5초 경과 (총 1.5초) -> active 진입
      expect(controller.attackState).toBe('active');
    });

    it('stop() 호출 시 예약된 공격 및 진행 중 공격이 즉시 제거되고 이후 update로도 실행되지 않는다', () => {
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

      // 이후 update 실행해도 공격 0건
      controller.update(10.0);
      expect(controller.isAttacking).toBe(false);
      expect(controller.currentAttack).toBeNull();
    });

    it('플레이어 사망 시 컨트롤러가 즉시 stop되어 잔여 공격이 0건이 된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');

      battleState.applyBossMagicDamage(100); // 플레이어 사망
      expect(battleState.isAlive).toBe(false);

      controller.update(0.1);
      expect(controller.isActive).toBe(false);
      expect(controller.isAttacking).toBe(false);
    });

    it('보스 격파 시 컨트롤러가 즉시 stop되어 잔여 공격이 0건이 된다', () => {
      const controller = new BossHazardController({
        bossController,
        battleState,
      });

      controller.start();
      controller.triggerAttack('dual_slam');

      bossController.takeDamage(bossController.maxHp); // 보스 격파
      expect(bossController.isDefeated).toBe(true);

      controller.update(0.1);
      expect(controller.isActive).toBe(false);
      expect(controller.isAttacking).toBe(false);
    });

    it('resolve()를 중복 호출해도 결과는 멱등(Idempotent)하게 단 1회만 정산된다', () => {
      const onHit = vi.fn();
      const controller = new BossHazardController({
        bossController,
        battleState,
        minionTroopManager: minionManager,
        onHit,
      });

      controller.start();
      controller.triggerAttack('dual_slam');

      const res1 = controller.resolve();
      const res2 = controller.resolve();
      const res3 = controller.resolve();

      expect(res1).not.toBeNull();
      expect(res1).toBe(res2);
      expect(res2).toBe(res3);
      expect(onHit).toHaveBeenCalledTimes(1);
      expect(battleState.hp).toBe(85); // 1회만 감점
    });
  });
});
