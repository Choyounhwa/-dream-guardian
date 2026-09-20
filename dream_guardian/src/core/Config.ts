import type { GameConfig } from '../types/index.js';

/**
 * 전역 게임 밸런스 상수
 * GDD 3.1절 전투 시스템 파라미터 기반
 */
export const DEFAULT_CONFIG: GameConfig = {
  player: {
    maxHp: 100,
    wrongDamage: 25,
    bossAttackDamage: 15,
  },
  mana: {
    correctReward: 25,
    spellCost: 100,
  },
  battle: {
    spellDamage: 4,
    bossHpNormal: 10,
    bossHpNightmare: 20,
  },
  motion: {
    squatThreshold: 0.065,
    jumpThreshold: 0.065,
    jumpSpeedMin: 0.22,
    runBounceMin: 0.012,
    stepInterval: 0.2,
  },
  input: {
    dwellTime: 1.0,
    centerWeight: 1.5,
    edgeWeight: 0.75,
  },
  render: {
    virtualWidth: 1920,
    virtualHeight: 1080,
  },
};
