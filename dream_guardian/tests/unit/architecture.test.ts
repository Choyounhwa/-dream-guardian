import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';
import type { GameState, GameConfig, ISystem, IStateHandler, EventMap } from '../../src/types/index.js';

describe('Architecture Test', () => {
  it('GameState 타입이 13개 상태를 포함한다', () => {
    const states: GameState[] = [
      'LOADING', 'MENU_MAIN', 'MENU_SUB', 'STORY_INTRO',
      'READY_POSITION', 'RUNNING', 'PLAYING', 'CORRECT',
      'WRONG', 'GUARDIAN_CAST', 'RESULT', 'GAMEOVER',
      'ENDING_CUTSCENE',
    ];
    expect(states).toHaveLength(13);
  });

  it('DEFAULT_CONFIG 전투 밸런스가 GDD와 일치한다', () => {
    expect(DEFAULT_CONFIG.player.maxHp).toBe(100);
    expect(DEFAULT_CONFIG.player.wrongDamage).toBe(25);
    expect(DEFAULT_CONFIG.player.bossAttackDamage).toBe(15);
    expect(DEFAULT_CONFIG.mana.correctReward).toBe(25);
    expect(DEFAULT_CONFIG.mana.spellCost).toBe(100);
    expect(DEFAULT_CONFIG.battle.spellDamage).toBe(4);
    expect(DEFAULT_CONFIG.battle.bossHpNormal).toBe(10);
    expect(DEFAULT_CONFIG.battle.bossHpNightmare).toBe(20);
  });

  it('DEFAULT_CONFIG 모션 임계값이 GDD와 일치한다', () => {
    expect(DEFAULT_CONFIG.motion.squatThreshold).toBe(0.065);
    expect(DEFAULT_CONFIG.motion.jumpThreshold).toBe(0.065);
    expect(DEFAULT_CONFIG.motion.jumpSpeedMin).toBe(0.22);
    expect(DEFAULT_CONFIG.motion.runBounceMin).toBe(0.012);
  });

  it('DEFAULT_CONFIG 입력 설정이 GDD와 일치한다', () => {
    expect(DEFAULT_CONFIG.input.dwellTime).toBe(1.0);
    expect(DEFAULT_CONFIG.input.centerWeight).toBe(1.5);
    expect(DEFAULT_CONFIG.input.edgeWeight).toBe(0.75);
  });

  it('DEFAULT_CONFIG 가상 해상도가 정의되어 있다', () => {
    expect(DEFAULT_CONFIG.render.virtualWidth).toBe(1920);
    expect(DEFAULT_CONFIG.render.virtualHeight).toBe(1080);
  });
});
