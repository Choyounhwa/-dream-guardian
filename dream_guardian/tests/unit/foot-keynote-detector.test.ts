import { describe, expect, it } from 'vitest';
import { FootKeynoteDetector } from '../../src/motion/FootKeynoteDetector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

function knees(leftY = 0.5, rightY = 0.5, visibility = 0.95): NormalizedLandmark[] {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }));
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.4, y: leftY, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.6, y: rightY, z: 0, visibility };
  return landmarks;
}

describe('FootKeynoteDetector (Issue #197 & #237 - BUG-MOTION-COORDINATE-001)', () => {
  it('emits anatomical left Zone 9 and right Zone 11 knee-proxy hits upon upward knee lift without using ankle landmarks', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });

    // Baseline: y = 0.5
    detector.update(0.016, knees(), 0);
    // Left knee lift UP: 0.50 -> 0.44 (threshold 0.04 만족)
    const left = detector.update(0.016, knees(0.44), 0.1);
    // Neutral return
    detector.update(0.016, knees(0.5), 0.2);
    // Right knee lift UP: 0.50 -> 0.44
    const right = detector.update(0.016, knees(0.5, 0.44), 0.3);

    expect(left).toEqual([expect.objectContaining({ foot: 'leftFoot', zoneId: 9, source: 'knee-proxy' })]);
    expect(right).toEqual([expect.objectContaining({ foot: 'rightFoot', zoneId: 11, source: 'knee-proxy' })]);
  });

  it('maps a simultaneous bilateral knee lift intent to a single Zone 10 center step', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });

    detector.update(0.016, knees(), 0);
    expect(detector.update(0.016, knees(0.44, 0.44), 0.1)).toEqual([
      expect.objectContaining({ foot: 'centerFoot', zoneId: 10, source: 'knee-proxy' }),
    ]);
  });

  it('does not reverse anatomical left/right mapping in mirrored environments', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0, isMirrored: true });
    detector.update(0.016, knees(), 0);

    expect(detector.update(0.016, knees(0.44), 0.1)[0]).toMatchObject({ foot: 'leftFoot', zoneId: 9 });
  });

  it('resets without a hit on knee visibility loss, pause, and the first resume frame', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });
    detector.update(0.016, knees(), 0);
    // Visibility drop
    expect(detector.update(0.016, knees(0.44, 0.5, 0.1), 0.1)).toEqual([]);

    // Safety guard active
    detector.update(0.016, knees(0.5), 0.2);
    expect(detector.update(0.016, knees(0.44), 0.3, { isSafetyGuarded: true })).toEqual([]);
    // First resume frame should resynchronize without emitting
    expect(detector.update(0.016, knees(0.44), 0.4, { isSafetyGuarded: false })).toEqual([]);
  });

  it('enforces cooldown and re-arms only after both the cooldown and neutral knee position', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0.5 });
    detector.update(0.016, knees(), 0);
    // First lift UP: 0.50 -> 0.44
    expect(detector.update(0.016, knees(0.44), 0.1)).toHaveLength(1);

    // Keep knee lifted: should not re-trigger
    expect(detector.update(0.016, knees(0.44), 0.2)).toEqual([]);
    // Cooldown passed at 0.7, but knee still lifted: should not re-arm
    expect(detector.update(0.016, knees(0.44), 0.7)).toEqual([]);
    // Return to neutral 0.5 at 0.8: re-arms
    detector.update(0.016, knees(0.5), 0.8);
    // Second lift UP at 0.9: successfully triggers
    expect(detector.update(0.016, knees(0.44), 0.9)).toHaveLength(1);
  });
});
