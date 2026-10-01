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
  | 'victoryCelebration';

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

  /** 승리 시 5색 축하 콘페티 파티클 (100개+) */
  victoryCelebration: {
    count: 120,
    colors: ['#4DFFAA', '#28E6FF', '#FFCB4D', '#FF5577', '#C889FF'],
    speedMin: 100,
    speedMax: 450,
    sizeMin: 4,
    sizeMax: 10,
    endSizeMin: 2,
    endSizeMax: 5,
    durationMin: 1.2,
    durationMax: 2.0,
    gravity: 180,
    drag: 0.97,
    shape: 'rect',
    vRotMin: -6,
    vRotMax: 6,
    startAlpha: 1,
    endAlpha: 0.1,
  },
};
