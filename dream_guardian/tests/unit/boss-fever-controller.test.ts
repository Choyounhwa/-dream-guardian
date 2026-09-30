import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('BossFeverController - [BOSS-FEVER-001 / #213]', () => {
  let bossController: BossController;
  let battleState: BattleState;
  let stateMachine: StateMachine;
  let controller: BossFeverController;

  const mockSnapshot: PhaseAResourceSnapshot = Object.freeze({
    playerHp: 100,
    maxPlayerHp: 100,
    playerMana: 100,
    bossHp: 1,
    maxBossHp: 10,
    bossChapter: 1,
    combo: 10,
    maxCombo: 10,
    correctCount: 10,
    wrongCount: 0,
    timeoutCount: 0,
    totalSettledQuestions: 10,
    guardianStage: 1,
    guardianCastCount: 1,
    minionCount: 13,
    guardianCount: 1,
    stardust: 40,
    totalStardustEarned: 40,
    rhythmStats: {
      beatStarsCollected: 35,
      perfectHits: 20,
      goodHits: 10,
      lateHits: 5,
      missedStars: 0,
      wrongAnswerCount: 0,
      timeoutCount: 0,
      recoverySwayCount: 0,
    },
    isPhaseAComplete: true,
    isPlayerDefeated: false,
    isBossDefeated: false,
    timestamp: 10.0,
  });

  beforeEach(() => {
    bossController = new BossController(1); // Normal boss, HP = 10
    battleState = new BattleState(100);
    stateMachine = new StateMachine('BOSS_CLIMAX');
    controller = new BossFeverController({
      bossController,
      battleState,
      stateMachine,
      config: DEFAULT_BATTLE_CONFIG.fever,
    });
  });

  it('초기 상태 및 설정값을 올바르게 로드한다', () => {
    expect(controller.isActive).toBe(false);
    expect(controller.feverCombo).toBe(0);
    expect(controller.maxFeverCombo).toBe(0);
    expect(controller.totalFeverDamage).toBe(0);
    expect(controller.collectedStars).toBe(0);
    expect(controller.missedStars).toBe(0);
    expect(controller.sequenceCount).toBe(0);
  });

  it('start() 호출 시 피버 모드가 활성화되고 스냅샷을 보존한다', () => {
    controller.start(10.0, mockSnapshot);
    expect(controller.isActive).toBe(true);
    expect(controller.snapshot).toBe(mockSnapshot);
    expect(controller.sequenceCount).toBe(1);
  });

  it('별 수집(Perfect, Good, Late) 시 feverCombo가 증가하고 보스에게 치명 피해를 입힌다', () => {
    controller.start(0);

    // 1st hit: Perfect (baseDamage: 1, Perfect weight: 1.5, combo: 1 -> multiplier 1.0) => damage 1.5
    controller.recordRating('Perfect', 'note_1');
    expect(controller.feverCombo).toBe(1);
    expect(controller.maxFeverCombo).toBe(1);
    expect(controller.collectedStars).toBe(1);
    expect(controller.totalFeverDamage).toBeCloseTo(1.5);
    expect(bossController.hp).toBeCloseTo(8.5);

    // 2nd hit: Good (baseDamage: 1, Good weight: 1.0, combo: 2 -> multiplier 1.0 + 1 * 0.1 = 1.1) => damage 1.1
    controller.recordRating('Good', 'note_2');
    expect(controller.feverCombo).toBe(2);
    expect(controller.maxFeverCombo).toBe(2);
    expect(controller.collectedStars).toBe(2);
    expect(controller.totalFeverDamage).toBeCloseTo(1.5 + 1.1);
    expect(bossController.hp).toBeCloseTo(10 - 2.6);

    // 3rd hit: Late (baseDamage: 1, Late weight: 0.5, combo: 3 -> multiplier 1.0 + 2 * 0.1 = 1.2) => damage 0.6
    controller.recordRating('Late', 'note_3');
    expect(controller.feverCombo).toBe(3);
    expect(controller.maxFeverCombo).toBe(3);
    expect(controller.collectedStars).toBe(3);
    expect(controller.totalFeverDamage).toBeCloseTo(2.6 + 0.6);
    expect(bossController.hp).toBeCloseTo(10 - 3.2);
  });

  it('동일한 noteId에 대한 중복 평가는 멱등하게 1회만 처리된다', () => {
    controller.start(0);
    controller.recordRating('Perfect', 'note_duplicate');
    const hpAfterFirst = bossController.hp;
    const comboAfterFirst = controller.feverCombo;

    controller.recordRating('Perfect', 'note_duplicate');
    expect(bossController.hp).toBe(hpAfterFirst);
    expect(controller.feverCombo).toBe(comboAfterFirst);
    expect(controller.collectedStars).toBe(1);
  });

  it('Miss 발생 시 feverCombo가 0으로 리셋되고 피해량은 0이다', () => {
    controller.start(0);
    controller.recordRating('Perfect', 'note_1');
    controller.recordRating('Perfect', 'note_2');
    expect(controller.feverCombo).toBe(2);

    const prevHp = bossController.hp;
    controller.recordRating('Miss', 'note_3');

    expect(controller.feverCombo).toBe(0);
    expect(controller.missedStars).toBe(1);
    expect(bossController.hp).toBe(prevHp); // 데미지 없음

    // 다음 성공 수집은 콤보 1부터 다시 시작
    controller.recordRating('Perfect', 'note_4');
    expect(controller.feverCombo).toBe(1);
  });

  it('콤보 배율은 maxComboMultiplier 상한(3.0)을 초과하지 않는다', () => {
    // 보스 조기 처치로 인한 피버 종료 방지를 위해 보스 없는 단독 컨트롤러 사용
    const testController = new BossFeverController({
      battleState,
      config: DEFAULT_BATTLE_CONFIG.fever,
    });
    testController.start(0);

    // 30회 연속 Perfect
    for (let i = 1; i <= 30; i++) {
      testController.recordRating('Perfect', `note_${i}`);
    }

    expect(testController.feverCombo).toBe(30);
    expect(testController.maxFeverCombo).toBe(30);

    // combo 30에서 multiplier = Math.min(3.0, 1.0 + 29 * 0.1) = 3.0
    // damage = 1 * 1.5 * 3.0 = 4.5
    const singleDamage = testController.computeDamage('Perfect', 30);
    expect(singleDamage).toBeCloseTo(4.5);
  });

  it('onPlayerHit() 호출 시 피버 콤보가 0으로 즉시 리셋된다 (#193 연동 규약)', () => {
    controller.start(0);
    controller.recordRating('Perfect', 'note_1');
    controller.recordRating('Perfect', 'note_2');
    expect(controller.feverCombo).toBe(2);

    controller.onPlayerHit();
    expect(controller.feverCombo).toBe(0);
    expect(battleState.feverCombo).toBe(0);
  });

  it('보스 체력이 0 이하가 되면 보스 처치(isDefeated) 및 RESULT 상태로 단 1회 전이한다', () => {
    const onVictoryMock = vi.fn();
    controller = new BossFeverController({
      bossController,
      battleState,
      stateMachine,
      config: DEFAULT_BATTLE_CONFIG.fever,
      onVictory: onVictoryMock,
    });

    controller.start(0);

    // 보스 HP가 10이므로 치명 피해를 누적하여 처치
    // combo 1: 1.5, combo 2: 1.65, combo 3: 1.8, combo 4: 1.95, combo 5: 2.1, combo 6: 2.25 => 누적 11.25 >= 10
    for (let i = 1; i <= 6; i++) {
      controller.recordRating('Perfect', `hit_${i}`);
    }

    expect(bossController.hp).toBe(0);
    expect(bossController.isDefeated).toBe(true);
    expect(controller.isActive).toBe(false);
    expect(onVictoryMock).toHaveBeenCalledTimes(1);
    expect(onVictoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isVictory: true,
        feverCombo: 6,
        collectedStars: 6,
      }),
    );
    expect(stateMachine.currentState).toBe('RESULT');

    // 승리 후 추가 평가는 차단됨
    controller.recordRating('Perfect', 'after_victory');
    expect(onVictoryMock).toHaveBeenCalledTimes(1);
  });

  it('플레이어 체력이 0 이하가 되면 GAMEOVER 상태로 단 1회 전이한다', () => {
    const onGameOverMock = vi.fn();
    controller = new BossFeverController({
      bossController,
      battleState,
      stateMachine,
      config: DEFAULT_BATTLE_CONFIG.fever,
      onGameOver: onGameOverMock,
    });

    controller.start(0);
    battleState.setHp(0);
    controller.onPlayerHit();

    expect(controller.isActive).toBe(false);
    expect(onGameOverMock).toHaveBeenCalledTimes(1);
    expect(onGameOverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isVictory: false,
      }),
    );
    expect(stateMachine.currentState).toBe('GAMEOVER');
  });

  it('손 Zone 1~5 및 발 Zone 9~11을 포함하는 기본 피버 시퀀스를 생성한다', () => {
    const sequence = controller.generateFeverSequence(1);
    expect(sequence.length).toBeGreaterThanOrEqual(4);

    const handNotes = sequence.filter((n) => n.instrument === 'hand');
    const footNotes = sequence.filter((n) => n.instrument === 'foot');

    expect(handNotes.length).toBeGreaterThan(0);
    expect(footNotes.length).toBeGreaterThan(0);

    // 손 존 1~5 범위 확인
    handNotes.forEach((n) => {
      expect([1, 2, 3, 4, 5]).toContain(n.zoneId);
    });

    // 발 존 9~11 범위 확인
    footNotes.forEach((n) => {
      expect([9, 10, 11]).toContain(n.zoneId);
    });
  });
});
