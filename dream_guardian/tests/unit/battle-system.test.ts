import { describe, it, expect } from 'vitest';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem, STAGE_NAMES } from '../../src/game/GuardianSystem.js';

// ═══════════════════════════════════
// BattleState
// ═══════════════════════════════════

describe('BattleState', () => {
  it('초기 HP가 100이다', () => {
    const bs = new BattleState();
    expect(bs.hp).toBe(100);
    expect(bs.maxHp).toBe(100);
    expect(bs.mana).toBe(0);
    expect(bs.combo).toBe(0);
    expect(bs.isAlive).toBe(true);
  });

  it('정답 시 마나 +25, 콤보 +1', () => {
    const bs = new BattleState();
    bs.onCorrect();
    expect(bs.mana).toBe(25);
    expect(bs.combo).toBe(1);
    expect(bs.correctCount).toBe(1);
  });

  it('오답 시 HP -25, 콤보 리셋', () => {
    const bs = new BattleState();
    bs.onCorrect(); // combo=1
    bs.onCorrect(); // combo=2
    bs.onWrong();
    expect(bs.hp).toBe(75);
    expect(bs.combo).toBe(0);
    expect(bs.wrongCount).toBe(1);
    expect(bs.maxCombo).toBe(2); // 최대 콤보 기록
  });

  it('HP가 0 이하로 떨어지면 isAlive가 false', () => {
    const bs = new BattleState();
    bs.onWrong(); // 75
    bs.onWrong(); // 50
    bs.onWrong(); // 25
    bs.onWrong(); // 0
    expect(bs.hp).toBe(0);
    expect(bs.isAlive).toBe(false);
  });

  it('보스 공격 시 HP -15', () => {
    const bs = new BattleState();
    bs.onBossAttack();
    expect(bs.hp).toBe(85);
  });

  it('trySpendMana: 마나 100 이상이면 소모 후 true', () => {
    const bs = new BattleState();
    for (let i = 0; i < 4; i++) bs.onCorrect(); // 마나 100
    expect(bs.mana).toBe(100);
    expect(bs.trySpendMana()).toBe(true);
    expect(bs.mana).toBe(0);
  });

  it('trySpendMana: 마나 부족 시 false', () => {
    const bs = new BattleState();
    bs.onCorrect(); // 25
    expect(bs.trySpendMana()).toBe(false);
    expect(bs.mana).toBe(25);
  });

  it('hpPercent / manaPercent 정확도', () => {
    const bs = new BattleState();
    bs.onWrong(); // HP 75
    expect(bs.hpPercent).toBeCloseTo(0.75);
    bs.onCorrect(); // mana 25
    expect(bs.manaPercent).toBeCloseTo(0.25);
  });

  it('reset()이 모든 상태를 초기화한다', () => {
    const bs = new BattleState();
    bs.onCorrect();
    bs.onWrong();
    bs.reset();
    expect(bs.hp).toBe(100);
    expect(bs.mana).toBe(0);
    expect(bs.combo).toBe(0);
    expect(bs.correctCount).toBe(0);
    expect(bs.wrongCount).toBe(0);
  });

  it('totalQuestions는 정답+오답 합계', () => {
    const bs = new BattleState();
    bs.onCorrect();
    bs.onCorrect();
    bs.onWrong();
    expect(bs.totalQuestions).toBe(3);
  });
});

// ═══════════════════════════════════
// BossController
// ═══════════════════════════════════

describe('BossController', () => {
  it('Ch.1~4 HP가 10이다', () => {
    const bc = new BossController(1);
    expect(bc.hp).toBe(10);
    expect(bc.maxHp).toBe(10);
  });

  it('Ch.5 HP가 20이다', () => {
    const bc = new BossController(5);
    expect(bc.hp).toBe(20);
    expect(bc.maxHp).toBe(20);
  });

  it('공격 타이머 경과 후 warning → attacking 전이', () => {
    const bc = new BossController(1, 2.0); // 2초 간격

    // idle → warning
    let attacked = bc.update(2.0);
    expect(attacked).toBe(false);
    expect(bc.isWarning).toBe(true);

    // warning → attacking
    attacked = bc.update(1.5);
    expect(attacked).toBe(true);
    expect(bc.isAttacking).toBe(true);
  });

  it('방어 성공 시 피해 0, 실패 시 -15', () => {
    const bc = new BossController(1, 0.1);
    bc.update(0.1); // → warning
    bc.update(1.5); // → attacking

    const blocked = bc.resolveAttack(true);
    expect(blocked).toBe(0);

    // 다시 공격
    bc.update(0.1);
    bc.update(1.5);
    const hit = bc.resolveAttack(false);
    expect(hit).toBe(15);
  });

  it('takeDamage로 보스 HP를 감소시킨다', () => {
    const bc = new BossController(1);
    bc.takeDamage(4);
    expect(bc.hp).toBe(6);
  });

  it('HP 0 이하 시 defeated 상태', () => {
    const bc = new BossController(1);
    bc.takeDamage(10);
    expect(bc.isDefeated).toBe(true);
    expect(bc.phase).toBe('defeated');
  });

  it('defeated 상태에서 update는 false만 반환', () => {
    const bc = new BossController(1);
    bc.takeDamage(10);
    expect(bc.update(10.0)).toBe(false);
  });

  it('reset()이 상태를 초기화한다', () => {
    const bc = new BossController(1);
    bc.takeDamage(5);
    bc.reset(3);
    expect(bc.hp).toBe(10);
    expect(bc.chapter).toBe(3);
    expect(bc.phase).toBe('idle');
  });
});

// ═══════════════════════════════════
// GuardianSystem
// ═══════════════════════════════════

describe('GuardianSystem', () => {
  it('초기 단계가 1이다', () => {
    const gs = new GuardianSystem();
    expect(gs.stage).toBe(1);
    expect(gs.stageName).toBe('작은 요정');
    expect(gs.castCount).toBe(0);
  });

  it('cast()가 spellDamage(4)를 반환한다', () => {
    const gs = new GuardianSystem();
    const dmg = gs.cast();
    expect(dmg).toBe(4);
    expect(gs.castCount).toBe(1);
    expect(gs.isCasting).toBe(true);
  });

  it('캐스팅 2회 후 2단계 성장', () => {
    const gs = new GuardianSystem();
    gs.cast();
    gs.cast();
    expect(gs.stage).toBe(2);
    expect(gs.stageName).toBe('빛의 오브 2개');
  });

  it('캐스팅 5회 후 3단계 성장', () => {
    const gs = new GuardianSystem();
    for (let i = 0; i < 5; i++) gs.cast();
    expect(gs.stage).toBe(3);
  });

  it('캐스팅 10회 후 4단계(최종) 성장', () => {
    const gs = new GuardianSystem();
    for (let i = 0; i < 10; i++) gs.cast();
    expect(gs.stage).toBe(4);
    expect(gs.stageName).toBe('천사 날개');
  });

  it('update()가 캐스팅 완료 시 true 반환', () => {
    const gs = new GuardianSystem();
    gs.cast();
    expect(gs.isCasting).toBe(true);

    // 캐스팅 시간(1초) 경과
    const done = gs.update(1.0);
    expect(done).toBe(true);
    expect(gs.isCasting).toBe(false);
  });

  it('update()가 캐스팅 중이 아니면 false', () => {
    const gs = new GuardianSystem();
    expect(gs.update(0.5)).toBe(false);
  });

  it('STAGE_NAMES 4개 모두 정의됨', () => {
    expect(Object.keys(STAGE_NAMES)).toHaveLength(4);
  });

  it('reset()이 모든 상태를 초기화한다', () => {
    const gs = new GuardianSystem();
    for (let i = 0; i < 5; i++) gs.cast();
    expect(gs.stage).toBe(3);

    gs.reset();
    expect(gs.stage).toBe(1);
    expect(gs.castCount).toBe(0);
    expect(gs.isCasting).toBe(false);
  });
});
