import type { GameConfig } from '../types/index.js';
import { POSTURE_TIMING_CONFIG } from '../../config/posture.config.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';

export * from '../../config/zone.config.js';
export * from '../../config/cursor.config.js';
export * from '../../config/posture.config.js';
export * from '../../config/motion.config.js';
export * from '../../config/audio.config.js';
export * from '../../config/battle.config.js';

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
    maxHp: DEFAULT_BATTLE_CONFIG.playerMaxHp,
    wrongDamage: DEFAULT_BATTLE_CONFIG.wrongDamage,
    bossAttackDamage: DEFAULT_BATTLE_CONFIG.bossAttackDamage,
  },
  mana: {
    correctReward: DEFAULT_BATTLE_CONFIG.manaCorrectReward,
    spellCost: DEFAULT_BATTLE_CONFIG.spellCost,
  },
  battle: {
    correctDamage: DEFAULT_BATTLE_CONFIG.correctDamage,
    spellDamage: DEFAULT_BATTLE_CONFIG.spellDamage,
    bossHpNormal: DEFAULT_BATTLE_CONFIG.bossHpNormal,
    bossHpNightmare: DEFAULT_BATTLE_CONFIG.bossHpNightmare,
    phaseAQuestionCount: DEFAULT_BATTLE_CONFIG.phaseAQuestionCount,
    phaseAMinBossHp: DEFAULT_BATTLE_CONFIG.phaseAMinBossHp,
    initialMinions: DEFAULT_BATTLE_CONFIG.initialMinions,
    maxMinions: DEFAULT_BATTLE_CONFIG.maxMinions,
    minionsPerCorrect: DEFAULT_BATTLE_CONFIG.minionsPerCorrect,
    stardustReward: DEFAULT_BATTLE_CONFIG.stardustReward,
    fever: DEFAULT_BATTLE_CONFIG.fever,
  },
  motion: {
    squatThreshold: 0.065,
    jumpThreshold: 0.065,
    jumpSpeedMin: 0.22,
    runBounceMin: 0.012,
    stepInterval: 0.2,
    hipBounceMin: 0.010,
    hipSwayMin: 0.012,
    armCrossMin: 0.030,
  },
  input: {
    dwellTime: POSTURE_TIMING_CONFIG.defaultDwellTime,
    centerWeight: POSTURE_TIMING_CONFIG.centerWeight,
    edgeWeight: POSTURE_TIMING_CONFIG.edgeWeight,
  },
  render: {
    virtualWidth: 1080,
    virtualHeight: 2160,
  },
};
