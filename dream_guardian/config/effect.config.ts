/**
 * Dream Guardian - Effect Configuration
 * 시각 효과 및 파티클 엔진 프리셋 설정
 */

import type { ParticleShape } from '../src/effects/Particle.js';

export type ParticlePresetName =
  | 'correctBurst'
  | 'wrongFlash'
  | 'bossHit'
  | 'manaFull'
  | 'victoryCelebration'
  | 'defeatDarken';

export interface ParticlePresetConfig {
  count: number;
  colors: string[];
  speedMin: number;
  speedMax: number;
  sizeMin: number;
  sizeMax: number;
  endSizeMin?: number;
  endSizeMax?: number;
  durationMin: number;
  durationMax: number;
  gravity?: number;
  drag?: number;
  shape?: ParticleShape;
  shapes?: ParticleShape[];
  vRotMin?: number;
  vRotMax?: number;
  startAlpha?: number;
  endAlpha?: number;
}

export const PARTICLE_CONFIG = {
  MAX_PARTICLES_TOTAL: 500,
  DEFAULT_BURST_COUNT: 25,
  DEFAULT_BURST_DURATION: 0.6,
} as const;

export const ANSWER_EFFECT_CONFIG = {
  correct: {
    baseCount: 35,
    colors: ['#4DFFAA', '#28E6FF', '#FFFFFF', '#A6FFDF'],
    duration: 0.8,
    speedMin: 120,
    speedMax: 320,
    sizeMin: 4,
    sizeMax: 8,
    shapes: ['star', 'spark'] as ParticleShape[],
  },
  combo5: {
    count: 20,
    colors: ['#FFCB4D', '#FFAA00', '#FFFFFF', '#FF8800'],
    duration: 0.8,
    speedMin: 140,
    speedMax: 340,
    sizeMin: 3.5,
    sizeMax: 7.5,
    shapes: ['spark', 'star'] as ParticleShape[],
  },
  combo10Multiplier: {
    count: 2,
    size: 1.5,
  },
  wrong: {
    flashColor: '#FF4444',
    flashDuration: 0.3,
    flashMaxAlpha: 0.4,
    particleCount: 20,
    colors: ['#FF4444', '#FF2222', '#CC1111', '#FF8888'],
    duration: 0.5,
  },
  timeout: {
    count: 24,
    colors: ['#888888', '#AAAAAA', '#666666', '#CCCCCC', '#777777'],
    duration: 0.5,
    speedMin: 30,
    speedMax: 110,
    sizeMin: 12,
    sizeMax: 24,
    endSizeMin: 20,
    endSizeMax: 48,
    startAlpha: 0.7,
    endAlpha: 0,
    shape: 'circle' as ParticleShape,
  },
} as const;

export const GUARDIAN_EFFECT_CONFIG = {
  manaFull: {
    duration: 0.5,
    pulseColor: '#C889FF',
    pulseStartRadius: 15,
    pulseMaxRadius: 120,
    pulseLineWidth: 4,
    particleCount: 28,
    colors: ['#C889FF', '#FF4DF0', '#28E6FF', '#FFFFFF', '#E8B5FF'],
    speedMin: 180,
    speedMax: 380,
    sizeMin: 4,
    sizeMax: 8,
    gravity: -240, // 화면 하단에서 상단으로 솟구치는 빛줄기
    drag: 0.96,
    shapes: ['star', 'spark'] as ParticleShape[],
  },
  castSequence: {
    totalDuration: 1.1,
    convergenceDuration: 0.3,
    projectileDuration: 0.5,
    explosionDuration: 0.3,
    convergenceColors: ['#C889FF', '#28E6FF', '#FFFFFF', '#FF4DF0'],
    projectileColor: '#28E6FF',
    projectileCoreColor: '#FFFFFF',
    projectileRadius: 14,
    explosionColors: ['#FF00CC', '#28E6FF', '#FFFFFF', '#C889FF', '#FF4DF0'],
    explosionCount: 40,
    explosionShockwaveColor: '#FF00CC',
    explosionShockwaveRadius: 160,
  },
  bossHit: {
    normal: {
      count: 25,
      colors: ['#FFAA00', '#FF3300', '#FFEE33', '#FF5500', '#FFFFFF'],
      speedMin: 150,
      speedMax: 350,
      sizeMin: 3,
      sizeMax: 7,
      duration: 0.5,
      shape: 'spark' as ParticleShape,
    },
    enraged: {
      count: 45,
      colors: ['#FF0055', '#FF1133', '#990022', '#FF4477', '#FFFFFF', '#FFAA00'],
      speedMin: 220,
      speedMax: 480,
      sizeMin: 4,
      sizeMax: 9,
      duration: 0.65,
      shape: 'spark' as ParticleShape,
    },
  },
} as const;

export const RESULT_EFFECT_CONFIG = {
  victory: {
    colors: ['#FFCB4D', '#4DFFAA', '#28E6FF', '#FF28D8', '#FFFFFF'],
    shapes: ['star', 'spark', 'rect'] as ParticleShape[],
    starCounts: {
      1: 120,
      2: 180,
      3: 250,
    } as Record<number, number>,
    speedMin: 120,
    speedMax: 480,
    sizeMin: 4,
    sizeMax: 12,
    durationMin: 1.5,
    durationMax: 2.8,
    gravity: 160,
    drag: 0.97,
    streamRate: 35,
    streamDuration: 2.5,
  },
  defeat: {
    vignetteDuration: 2.0,
    maxAlpha: 0.8,
    particleCount: 30,
    colors: ['#FF4444', '#880022', '#C889FF', '#550055', '#330033'],
    shapes: ['circle', 'spark'] as ParticleShape[],
    speedMin: 30,
    speedMax: 90,
    sizeMin: 4,
    sizeMax: 10,
    durationMin: 1.5,
    durationMax: 2.2,
    gravity: 60,
    drag: 0.96,
  },
} as const;

export const PARTICLE_PRESETS: Record<ParticlePresetName, ParticlePresetConfig> = {
  /** 정답 시 에메랄드(#4DFFAA) + 시안(#28E6FF) 별빛 버스트 */
  correctBurst: {
    count: 30,
    colors: ['#4DFFAA', '#28E6FF', '#FFFFFF', '#A6FFDF'],
    speedMin: 120,
    speedMax: 300,
    sizeMin: 3,
    sizeMax: 6,
    endSizeMin: 0,
    endSizeMax: 1,
    durationMin: 0.5,
    durationMax: 0.8,
    gravity: 80,
    drag: 0.96,
    shape: 'star',
    vRotMin: -3,
    vRotMax: 3,
    startAlpha: 1,
    endAlpha: 0,
  },

  /** 오답 시 적색(#FF4444) 플래시 및 파티클 */
  wrongFlash: {
    count: 20,
    colors: ['#FF4444', '#FF2222', '#FF8844', '#CC1111'],
    speedMin: 80,
    speedMax: 200,
    sizeMin: 4,
    sizeMax: 8,
    endSizeMin: 0,
    endSizeMax: 2,
    durationMin: 0.3,
    durationMax: 0.5,
    gravity: 100,
    drag: 0.94,
    shape: 'circle',
    startAlpha: 1,
    endAlpha: 0,
  },

  /** 보스 피격 시 주황/적색 충격 불꽃 파티클 */
  bossHit: {
    count: 25,
    colors: ['#FFAA00', '#FF3300', '#FFEE33', '#FF5500', '#FFFFFF'],
    speedMin: 150,
    speedMax: 350,
    sizeMin: 3,
    sizeMax: 7,
    endSizeMin: 0,
    endSizeMax: 1,
    durationMin: 0.3,
    durationMax: 0.6,
    gravity: 140,
    drag: 0.93,
    shape: 'spark',
    vRotMin: -4,
    vRotMax: 4,
    startAlpha: 1,
    endAlpha: 0,
  },

  /** 마나 100 도달 시 보라(#C889FF)/마젠타 빛줄기 파티클 */
  manaFull: {
    count: 30,
    colors: ['#C889FF', '#FF4DF0', '#28E6FF', '#FFFFFF', '#E8B5FF'],
    speedMin: 180,
    speedMax: 400,
    sizeMin: 4,
    sizeMax: 8,
    endSizeMin: 0,
    endSizeMax: 2,
    durationMin: 0.6,
    durationMax: 0.9,
    gravity: 40,
    drag: 0.96,
    shape: 'star',
    vRotMin: -2,
    vRotMax: 2,
    startAlpha: 1,
    endAlpha: 0,
  },

  /** 승리 시 5색 축하 콘페티 파티클 (120~250개+) */
  victoryCelebration: {
    count: 120,
    colors: ['#FFCB4D', '#4DFFAA', '#28E6FF', '#FF28D8', '#FFFFFF'],
    speedMin: 120,
    speedMax: 480,
    sizeMin: 4,
    sizeMax: 12,
    endSizeMin: 2,
    endSizeMax: 5,
    durationMin: 1.5,
    durationMax: 2.5,
    gravity: 160,
    drag: 0.97,
    shapes: ['star', 'spark', 'rect'],
    vRotMin: -6,
    vRotMax: 6,
    startAlpha: 1,
    endAlpha: 0.1,
  },

  /** 패배 시 적색/보라 침강 파티클 (25~35개) */
  defeatDarken: {
    count: 30,
    colors: ['#FF4444', '#880022', '#C889FF', '#550055', '#330033'],
    speedMin: 30,
    speedMax: 90,
    sizeMin: 4,
    sizeMax: 10,
    endSizeMin: 1,
    endSizeMax: 3,
    durationMin: 1.5,
    durationMax: 2.2,
    gravity: 60,
    drag: 0.96,
    shapes: ['circle', 'spark'],
    vRotMin: -1,
    vRotMax: 1,
    startAlpha: 0.9,
    endAlpha: 0,
  },
};

export interface SkeletonEffectConfig {
  breathCycle: number;
  manaGlow: {
    startColor: string;
    endColor: string;
    minAlpha: number;
    maxAlpha: number;
    blur: number;
    baseRadius: number;
  };
  correctPulse: {
    duration: number;
    color: string;
    baseIntensity: number;
    comboThreshold: number;
    comboMultiplier: number;
    maxIntensity: number;
  };
  hitFlash: {
    duration: number;
    color: string;
    lowHpThreshold: number;
    lowHpColor: string;
    warningPulseSpeed: number;
  };
  trail: {
    maxFrames: number;
    minFrames: number;
    trackedJoints: number[];
    colors: Record<number, string>;
    speedThreshold: number;
    speedAlphaMultiplier: number;
    baseRadius: number;
    fadeDecay: number;
  };
}

export const SKELETON_EFFECT_CONFIG: SkeletonEffectConfig = {
  breathCycle: 2.0,
  manaGlow: {
    startColor: '#28E6FF',
    endColor: '#C889FF',
    minAlpha: 0.25,
    maxAlpha: 0.75,
    blur: 16,
    baseRadius: 18,
  },
  correctPulse: {
    duration: 0.3,
    color: '#4DFFAA',
    baseIntensity: 1.0,
    comboThreshold: 5,
    comboMultiplier: 1.5,
    maxIntensity: 2.5,
  },
  hitFlash: {
    duration: 0.2,
    color: '#FF4444',
    lowHpThreshold: 0.5,
    lowHpColor: '#FF4444',
    warningPulseSpeed: 5.0,
  },
  trail: {
    maxFrames: 6,
    minFrames: 4,
    trackedJoints: [19, 20, 31, 32],
    colors: {
      19: '#28E6FF',
      20: '#FFCB4D',
      31: '#28E6FF',
      32: '#FFCB4D',
    },
    speedThreshold: 50,
    speedAlphaMultiplier: 1.5,
    baseRadius: 12,
    fadeDecay: 0.8,
  },
};

