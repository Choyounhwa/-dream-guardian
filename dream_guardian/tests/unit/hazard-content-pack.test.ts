import { describe, expect, it } from 'vitest';
import {
  HAZARD_CONTENT_PACK_VERSION,
  validateHazardContentPack,
  type HazardContentPack,
} from '../../src/data/HazardContentPack.js';

function validPack(overrides: Partial<HazardContentPack> = {}): HazardContentPack {
  return {
    version: HAZARD_CONTENT_PACK_VERSION,
    id: 'chapter-1',
    bpm: 120,
    secondsPerBeat: 0.5,
    phases: {
      HAZARD_EVADE: {
        charts: [
          {
            id: 'ch1-hazard-01',
            pattern: 'left_step',
            warningStart: 0,
            inputStart: 2.6,
            inputEnd: 3.4,
            judgmentTime: 3.5,
            resolveTime: 4.0,
            damage: 25,
            visual: { lane: 'left', color: '#28E6FF', shape: 'lane' },
          },
        ],
      },
      BOSS_CLIMAX: {
        charts: [
          {
            id: 'boss-01',
            attackType: 'dual_slam',
            requiredAction: 'jump',
            warningDuration: 1.2,
            activeDuration: 0.8,
            damage: 15,
            minionLoss: 1,
            visual: { shape: 'shockwave', color: '#FF865E' },
          },
        ],
      },
    },
    ...overrides,
  };
}

describe('HazardContentPack schema validator', () => {
  it('accepts a pack the game can load without changing judgment code', () => {
    const result = validateHazardContentPack(validPack());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.pack?.phases.HAZARD_EVADE.charts[0]?.pattern).toBe('left_step');
    expect(result.pack?.phases.BOSS_CLIMAX.charts[0]?.attackType).toBe('dual_slam');
  });

  it('rejects unknown Phase A patterns and Phase B attack types', () => {
    const pack = validPack();
    pack.phases.HAZARD_EVADE.charts[0] = {
      ...pack.phases.HAZARD_EVADE.charts[0]!,
      pattern: 'balance_left' as 'left_step',
    };
    pack.phases.BOSS_CLIMAX.charts[0] = {
      ...pack.phases.BOSS_CLIMAX.charts[0]!,
      attackType: 'spin' as 'dual_slam',
    };

    const result = validateHazardContentPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/pattern/);
    expect(result.errors.join('\n')).toMatch(/attackType/);
  });

  it('rejects Phase A timing that leaves the 4s evade contract', () => {
    const pack = validPack();
    pack.phases.HAZARD_EVADE.charts[0] = {
      ...pack.phases.HAZARD_EVADE.charts[0]!,
      judgmentTime: 3.6,
      inputEnd: 3.2,
    };

    const result = validateHazardContentPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('judgmentTime'))).toBe(true);
  });

  it('rejects damage above the live config caps and duplicate chart ids', () => {
    const pack = validPack();
    pack.phases.HAZARD_EVADE.charts[0] = {
      ...pack.phases.HAZARD_EVADE.charts[0]!,
      damage: 26,
    };
    pack.phases.BOSS_CLIMAX.charts.push({
      ...pack.phases.BOSS_CLIMAX.charts[0]!,
      id: 'boss-01',
      damage: 16,
    });

    const result = validateHazardContentPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('damage'))).toBe(true);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('rejects a mismatched evade action for a Phase B attack', () => {
    const pack = validPack();
    pack.phases.BOSS_CLIMAX.charts[0] = {
      ...pack.phases.BOSS_CLIMAX.charts[0]!,
      attackType: 'alternating_stomp_left',
      requiredAction: 'jump',
    };

    const result = validateHazardContentPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/requiredAction/);
  });
});
