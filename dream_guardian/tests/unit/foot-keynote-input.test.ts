import { describe, expect, it } from 'vitest';
import { FootKeynoteInput } from '../../src/input/FootKeynoteInput.js';

describe('FootKeynoteInput (Issue #197 - INPUT-FOOT-KEYNOTE-001)', () => {
  it('injects keyboard and virtual-pedal events through the same FootKeynoteEvent contract', () => {
    const input = new FootKeynoteInput();

    expect(input.fromKeyboard('leftFoot', 1)).toEqual(expect.objectContaining({ foot: 'leftFoot', zoneId: 9, source: 'keyboard', timestamp: 1 }));
    expect(input.fromVirtualPedal(10, 2)).toEqual(expect.objectContaining({ foot: 'centerFoot', zoneId: 10, source: 'virtual', timestamp: 2 }));
    expect(input.fromVirtualPedal(11, 3)).toEqual(expect.objectContaining({ foot: 'rightFoot', zoneId: 11, source: 'virtual', timestamp: 3 }));
  });

  it('never emits virtual events outside Zones 9-11 or during safety guards', () => {
    const input = new FootKeynoteInput();

    expect(input.fromVirtualPedal(8, 1)).toBeNull();
    input.setSafetyGuarded(true);
    expect(input.fromKeyboard('leftFoot', 2)).toBeNull();
    expect(input.fromVirtualPedal(9, 2)).toBeNull();
  });
});
