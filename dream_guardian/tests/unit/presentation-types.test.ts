import { describe, it, expect } from 'vitest';
import {
  type BaseSlotOverride,
  mergeSlotOverrides,
  isBaseSlotOverride,
} from '../../src/types/presentation.js';
import type { HazardSlotOverride } from '../../src/render/HazardZoneRenderer.js';
import type { BossSlotOverride } from '../../src/render/BossRenderer.js';
import type { BossClimaxSlotOverride } from '../../src/render/BossClimaxRenderer.js';
import type { RunningMatSlotOverride } from '../../src/render/mat/RunningMatTypes.js';

describe('Presentation Slot Override Types (#631 / [REFACTOR-DRY-004])', () => {
  it('BaseSlotOverride accepts standard presentation and geometry properties', () => {
    const base: BaseSlotOverride = {
      text: 'Danger Ahead',
      color: '#ff0000',
      textColor: '#ffffff',
      fillColor: 'rgba(255, 0, 0, 0.5)',
      borderColor: '#ff5500',
      borderWidth: 2,
      glowColor: '#ffff00',
      fontSize: 24,
      visible: true,
      opacity: 0.8,
      x: 100,
      y: 200,
      w: 300,
      h: 150,
      customAttribute: 'extra-slot-property',
    };

    expect(base.text).toBe('Danger Ahead');
    expect(base.color).toBe('#ff0000');
    expect(base.textColor).toBe('#ffffff');
    expect(base.fillColor).toBe('rgba(255, 0, 0, 0.5)');
    expect(base.borderColor).toBe('#ff5500');
    expect(base.borderWidth).toBe(2);
    expect(base.glowColor).toBe('#ffff00');
    expect(base.fontSize).toBe(24);
    expect(base.visible).toBe(true);
    expect(base.opacity).toBe(0.8);
    expect(base.x).toBe(100);
    expect(base.y).toBe(200);
    expect(base.w).toBe(300);
    expect(base.h).toBe(150);
    expect(base['customAttribute']).toBe('extra-slot-property');
  });

  it('HazardSlotOverride extends BaseSlotOverride properly', () => {
    const hazardSlot: HazardSlotOverride = {
      text: 'JUMP',
      color: '#ff0055',
      borderColor: '#ffffff',
      borderWidth: 3,
      glowColor: '#ff0055',
      opacity: 0.9,
      visible: true,
      x: 50,
      y: 80,
      w: 120,
      h: 60,
    };

    const asBase: BaseSlotOverride = hazardSlot;
    expect(asBase.text).toBe('JUMP');
    expect(asBase.opacity).toBe(0.9);
  });

  it('BossSlotOverride extends BaseSlotOverride properly', () => {
    const bossSlot: BossSlotOverride = {
      text: 'HAEYAESINI',
      textColor: '#00ffff',
      fillColor: '#112233',
      fontSize: 32,
      visible: true,
      x: 200,
      y: 150,
      w: 400,
      h: 250,
    };

    const asBase: BaseSlotOverride = bossSlot;
    expect(asBase.text).toBe('HAEYAESINI');
    expect(asBase.fontSize).toBe(32);
  });

  it('BossClimaxSlotOverride extends BaseSlotOverride properly', () => {
    const climaxSlot: BossClimaxSlotOverride = {
      text: 'CLIMAX SHOCKWAVE',
      color: '#ffaa00',
      borderColor: '#ff0000',
      borderWidth: 4,
      visible: true,
      opacity: 1.0,
      x: 300,
      y: 400,
      w: 500,
      h: 200,
    };

    const asBase: BaseSlotOverride = climaxSlot;
    expect(asBase.text).toBe('CLIMAX SHOCKWAVE');
    expect(asBase.borderWidth).toBe(4);
  });

  it('RunningMatSlotOverride extends BaseSlotOverride with specialized mat properties', () => {
    const matSlot: RunningMatSlotOverride = {
      x: 10,
      y: 20,
      w: 300,
      h: 600,
      color: '#28E6FF',
      borderColor: '#ffffff',
      borderWidth: 2,
      backgroundColor: '#050a15',
      glowColor: '#28E6FF',
      glowWidth: 8,
      text: 'LANE 1',
      fontSize: 16,
      visible: true,
    };

    const asBase: BaseSlotOverride = matSlot;
    expect(asBase.x).toBe(10);
    expect(asBase.color).toBe('#28E6FF');
    expect(matSlot.backgroundColor).toBe('#050a15');
    expect(matSlot.glowWidth).toBe(8);
  });

  it('Type compatibility utility verifies polymorphic presentation slot overrides', () => {
    function resolveSlotVisibility(slot?: BaseSlotOverride): boolean {
      if (!slot) return true;
      return slot.visible !== false && (slot.opacity === undefined || slot.opacity > 0);
    }

    const hazard: HazardSlotOverride = { visible: false };
    const boss: BossSlotOverride = { opacity: 0 };
    const mat: RunningMatSlotOverride = { visible: true };

    expect(resolveSlotVisibility(hazard)).toBe(false);
    expect(resolveSlotVisibility(boss)).toBe(false);
    expect(resolveSlotVisibility(mat)).toBe(true);
    expect(resolveSlotVisibility(undefined)).toBe(true);
  });

  it('isBaseSlotOverride validates runtime objects', () => {
    expect(isBaseSlotOverride({ text: 'Valid' })).toBe(true);
    expect(isBaseSlotOverride({ x: 10, y: 20 })).toBe(true);
    expect(isBaseSlotOverride(null)).toBe(false);
    expect(isBaseSlotOverride(undefined)).toBe(false);
    expect(isBaseSlotOverride('string')).toBe(false);
    expect(isBaseSlotOverride(123)).toBe(false);
    expect(isBaseSlotOverride([])).toBe(false);
  });

  it('mergeSlotOverrides merges base and custom slot overrides cleanly without mutation', () => {
    const base: BaseSlotOverride = {
      color: '#ffffff',
      fontSize: 20,
      visible: true,
      x: 100,
    };
    const override: BaseSlotOverride = {
      color: '#ff0000',
      text: 'Custom',
    };

    const merged = mergeSlotOverrides(base, override);
    expect(merged).toEqual({
      color: '#ff0000',
      fontSize: 20,
      visible: true,
      x: 100,
      text: 'Custom',
    });
    // Ensure immutability
    expect(base.color).toBe('#ffffff');
    expect(base.text).toBeUndefined();

    // Edge cases: handles undefined gracefully
    expect(mergeSlotOverrides(undefined, override)).toEqual(override);
    expect(mergeSlotOverrides(base, undefined)).toEqual(base);
    expect(mergeSlotOverrides(undefined, undefined)).toBeUndefined();
  });
});
