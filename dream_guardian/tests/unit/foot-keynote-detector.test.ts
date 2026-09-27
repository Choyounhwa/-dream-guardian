import { describe, expect, it } from 'vitest';
import { FootKeynoteDetector } from '../../src/motion/FootKeynoteDetector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

function knees(leftY = 0.5, rightY = 0.5, visibility = 0.95): NormalizedLandmark[] {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }));
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.4, y: leftY, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.6, y: rightY, z: 0, visibility };
  return landmarks;
}

describe('FootKeynoteDetector (Issue #197 - INPUT-FOOT-KEYNOTE-001)', () => {
  it('emits anatomical left Zone 9 and right Zone 11 knee-proxy hits without using ankle landmarks', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });

    detector.update(0.016, knees(), 0);
    detector.update(0.016, knees(0.56), 0.1);
    const left = detector.update(0.016, knees(0.52), 0.2);
    detector.update(0.016, knees(0.5), 0.3);
    detector.update(0.016, knees(0.5, 0.56), 0.4);
    const right = detector.update(0.016, knees(0.5, 0.52), 0.5);

    expect(left).toEqual([expect.objectContaining({ foot: 'leftFoot', zoneId: 9, source: 'knee-proxy' })]);
    expect(right).toEqual([expect.objectContaining({ foot: 'rightFoot', zoneId: 11, source: 'knee-proxy' })]);
  });

  it('maps a simultaneous bilateral knee intent to a single Zone 10 center step', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });

    detector.update(0.016, knees(), 0);
    detector.update(0.016, knees(0.56, 0.56), 0.1);

    expect(detector.update(0.016, knees(0.52, 0.52), 0.2)).toEqual([
      expect.objectContaining({ foot: 'centerFoot', zoneId: 10, source: 'knee-proxy' }),
    ]);
  });

  it('does not reverse anatomical left/right mapping in mirrored environments', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0, isMirrored: true });
    detector.update(0.016, knees(), 0);
    detector.update(0.016, knees(0.56), 0.1);

    expect(detector.update(0.016, knees(0.52), 0.2)[0]).toMatchObject({ foot: 'leftFoot', zoneId: 9 });
  });

  it('resets without a hit on knee visibility loss, pause, and the first resume frame', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });
    detector.update(0.016, knees(), 0);
    detector.update(0.016, knees(0.56), 0.1);
    expect(detector.update(0.016, knees(0.52, 0.5, 0.1), 0.2)).toEqual([]);

    detector.update(0.016, knees(0.56), 0.3, { isSafetyGuarded: true });
    expect(detector.update(0.016, knees(0.52), 0.4, { isSafetyGuarded: false })).toEqual([]);
  });

  it('enforces cooldown and re-arms only after both the cooldown and neutral knee position', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0.5 });
    detector.update(0.016, knees(), 0);
    detector.update(0.016, knees(0.56), 0.1);
    expect(detector.update(0.016, knees(0.52), 0.2)).toHaveLength(1);

    detector.update(0.016, knees(0.56), 0.3);
    expect(detector.update(0.016, knees(0.52), 0.4)).toEqual([]);
    detector.update(0.016, knees(0.5), 0.8);
    detector.update(0.016, knees(0.56), 0.9);
    expect(detector.update(0.016, knees(0.52), 1.0)).toHaveLength(1);
  });
});
