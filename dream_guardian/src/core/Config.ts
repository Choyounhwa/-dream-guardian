import type { GameConfig } from '../types/index.js';

/**
 * 18:9 고정 종횡비 해상도 프리셋
 * - portrait (세로 9:18): 1080 x 2160
 * - landscape (가로 18:9): 2160 x 1080
 */
export const RESOLUTION_18_9 = {
  portrait: { virtualWidth: 1080, virtualHeight: 2160 },
  landscape: { virtualWidth: 2160, virtualHeight: 1080 },
} as const;

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
    virtualWidth: 1080,
    virtualHeight: 2160,
  },
};
