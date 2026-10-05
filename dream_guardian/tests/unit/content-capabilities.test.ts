import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULESET_ID,
  SUPPORTED_RULESET_IDS,
  SUPPORTED_RUNTIME_VERSIONS,
  TICKS_PER_BEAT,
  PHASE_A_TOTAL_BEATS,
  PHASE_A_TOTAL_TICKS,
  PHASE_A_STAR_SLOT_COUNT,
  PHASE_A_STAR_LANDING_BEATS,
  PHASE_A_STAR_LANDING_TICKS,
  SUPPORTED_BPMS,
  PUBLISHABLE_HAND_ZONES,
  PUBLISHABLE_FOOT_ZONES,
  PHASE_A_PUBLISHABLE_HAZARD_PATTERNS,
  NON_PUBLISHABLE_HAZARD_PATTERNS,
  PHASE_B_PUBLISHABLE_ATTACKS,
  PHASE_B_ATTACK_REQUIRED_ACTIONS,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
  isSupportedBpm,
  secondsPerBeat,
  tickToBeat,
  beatToTick,
  isValidTick,
  isValidSlotTick,
  derivePartZoneMap,
  isPublishableHandZone,
  isPublishableFootZone,
  isPublishableStarTarget,
  isPublishablePhaseAHazard,
  getRequiredActionForPhaseBAttack,
  checkCrossBodyConstraint,
  checkSafeTransition,
} from '../../src/data/ContentCapabilities.js';
import {
  PHASE_A_HAZARD_BEAT_TIMINGS,
  DEFAULT_PHASE_B_HAZARD_SECONDS,
  calculateStarNoteTimings,
  validateStarTimingWithinBranch,
  calculatePhaseAHazardTiming,
  getPhaseBHazardTiming,
} from '../../src/data/ContentTiming.js';

describe('EDITOR-CAPABILITY (#376): Ruleset & Runtime Version Contract', () => {
  it('defines the standard dg-ruleset-v2 ruleset and runtime version', () => {
    expect(DEFAULT_RULESET_ID).toBe('dg-ruleset-v2');
    expect(SUPPORTED_RULESET_IDS).toContain('dg-ruleset-v2');
    expect(SUPPORTED_RUNTIME_VERSIONS).toContain('2.0.0');
    expect(V2_PUBLISHABLE_CAPABILITY_PROFILE.rulesetId).toBe('dg-ruleset-v2');
  });
});

describe('EDITOR-CAPABILITY (#376): Phase A Fixed Beat & Tick Grid', () => {
  it('enforces 480 ticks/beat and 8-beat branch (3840 ticks total)', () => {
    expect(TICKS_PER_BEAT).toBe(480);
    expect(PHASE_A_TOTAL_BEATS).toBe(8);
    expect(PHASE_A_TOTAL_TICKS).toBe(3840);
    expect(PHASE_A_TOTAL_BEATS * TICKS_PER_BEAT).toBe(PHASE_A_TOTAL_TICKS);
  });

  it('defines exactly 7 star landing slots on beats 2..8', () => {
    expect(PHASE_A_STAR_SLOT_COUNT).toBe(7);
    expect(PHASE_A_STAR_LANDING_BEATS).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(PHASE_A_STAR_LANDING_TICKS).toEqual([960, 1440, 1920, 2400, 2880, 3360, 3840]);
  });

  it('validates regular ticks and rejects irregular or out-of-range ticks', () => {
    expect(isValidTick(0)).toBe(true);
    expect(isValidTick(480)).toBe(true);
    expect(isValidTick(960)).toBe(true);
    expect(isValidTick(3840)).toBe(true);

    expect(isValidTick(-1)).toBe(false);
    expect(isValidTick(3841)).toBe(false);
    expect(isValidTick(480.5)).toBe(false);
    expect(isValidTick(NaN)).toBe(false);
    expect(isValidTick(Infinity)).toBe(false);
  });

  it('validates exactly the 7 landing slot ticks and rejects non-slot ticks', () => {
    for (const tick of PHASE_A_STAR_LANDING_TICKS) {
      expect(isValidSlotTick(tick)).toBe(true);
    }
    expect(isValidSlotTick(0)).toBe(false);
    expect(isValidSlotTick(480)).toBe(false); // beat 1 is not a star landing slot
    expect(isValidSlotTick(1000)).toBe(false); // irregular
  });
});

describe('EDITOR-CAPABILITY (#376): Supported BPMs & Derivation Helpers', () => {
  it('accepts only supported BPMs [110, 115, 120, 125, 135, 140]', () => {
    const supported = [110, 115, 120, 125, 135, 140];
    expect(SUPPORTED_BPMS).toEqual(supported);
    for (const bpm of supported) {
      expect(isSupportedBpm(bpm)).toBe(true);
    }
  });

  it('rejects unsupported BPMs (e.g. 160 collision, 100, 130, invalid numbers)', () => {
    expect(isSupportedBpm(160)).toBe(false);
    expect(isSupportedBpm(100)).toBe(false);
    expect(isSupportedBpm(130)).toBe(false);
    expect(isSupportedBpm(0)).toBe(false);
    expect(isSupportedBpm(-120)).toBe(false);
    expect(isSupportedBpm(NaN)).toBe(false);
  });

  it('derives secondsPerBeat accurately and throws on unsupported BPM in strict mode', () => {
    expect(secondsPerBeat(120)).toBeCloseTo(0.5, 6);
    expect(secondsPerBeat(110)).toBeCloseTo(60 / 110, 6);
    expect(secondsPerBeat(140)).toBeCloseTo(60 / 140, 6);

    expect(() => secondsPerBeat(160)).toThrow(/Unsupported BPM: 160/);
    expect(() => secondsPerBeat(100)).toThrow(/Unsupported BPM: 100/);
  });

  it('provides tick <-> beat conversions', () => {
    expect(tickToBeat(480)).toBe(1);
    expect(tickToBeat(960)).toBe(2);
    expect(tickToBeat(3840)).toBe(8);

    expect(beatToTick(1)).toBe(480);
    expect(beatToTick(2)).toBe(960);
    expect(beatToTick(8)).toBe(3840);
  });

  it('derives partZoneMap cleanly without mutation', () => {
    const rawPattern = {
      leftHand: 1,
      rightHand: 5,
      head: 4,
      hip: 9,
    };
    const mapped = derivePartZoneMap(rawPattern);
    expect(mapped).toEqual({
      leftHand: 1,
      rightHand: 5,
      head: 4,
      hip: 9,
    });

    // handles null/undefined
    expect(derivePartZoneMap({ leftHand: 2, rightHand: null, head: undefined })).toEqual({
      leftHand: 2,
    });
  });
});

describe('EDITOR-CAPABILITY (#376): Publishable Inputs vs Non-Publishable Features', () => {
  it('allows publishable hand zones 1..5 and foot zones 9..11', () => {
    expect(PUBLISHABLE_HAND_ZONES).toEqual([1, 2, 3, 4, 5]);
    expect(PUBLISHABLE_FOOT_ZONES).toEqual([9, 10, 11]);

    for (const z of [1, 2, 3, 4, 5]) {
      expect(isPublishableHandZone('leftHand', z)).toBe([1, 2, 4].includes(z));
      expect(isPublishableHandZone('rightHand', z)).toBe([2, 3, 5].includes(z));
    }
    // Hand in foot zones is disallowed
    expect(isPublishableHandZone('leftHand', 9)).toBe(false);
    expect(isPublishableHandZone('rightHand', 10)).toBe(false);

    // Foot zones
    for (const z of [9, 10, 11]) {
      expect(isPublishableFootZone(z)).toBe(true);
    }
    expect(isPublishableFootZone(4)).toBe(false);
    expect(isPublishableFootZone(1)).toBe(false);
  });

  it('rejects cursor / foot role confusion in star targets', () => {
    // Valid publishable star targets
    expect(isPublishableStarTarget({ type: 'cursor', part: 'leftHand', zoneId: 1 })).toBe(true);
    expect(isPublishableStarTarget({ type: 'cursor', part: 'rightHand', zoneId: 5 })).toBe(true);
    expect(isPublishableStarTarget({ type: 'foot', part: 'foot', zoneId: 9 })).toBe(true);

    // Confusion: foot targeting hand zone
    expect(isPublishableStarTarget({ type: 'foot', part: 'foot', zoneId: 4 })).toBe(false);

    // Confusion: hand targeting foot zone
    expect(isPublishableStarTarget({ type: 'cursor', part: 'leftHand', zoneId: 10 })).toBe(false);

    // Non-publishable: head cursor for stars
    expect(isPublishableStarTarget({ type: 'cursor', part: 'head', zoneId: 4 })).toBe(false);

    // Non-publishable: hip cursor for stars
    expect(isPublishableStarTarget({ type: 'cursor', part: 'hip', zoneId: 6 })).toBe(false);
    expect(isPublishableStarTarget({ type: 'cursor', part: 'hip', zoneId: 9 })).toBe(false);
  });

  it('marks balance posture, free-time beats, and particles non-publishable in V2 profile', () => {
    expect(PHASE_A_PUBLISHABLE_HAZARD_PATTERNS).toEqual(['left_step', 'right_step', 'jump']);
    expect(NON_PUBLISHABLE_HAZARD_PATTERNS).toEqual(['balance_left', 'balance_right']);

    expect(isPublishablePhaseAHazard('left_step')).toBe(true);
    expect(isPublishablePhaseAHazard('right_step')).toBe(true);
    expect(isPublishablePhaseAHazard('jump')).toBe(true);
    expect(isPublishablePhaseAHazard('balance_left')).toBe(false);
    expect(isPublishablePhaseAHazard('balance_right')).toBe(false);

    expect(V2_PUBLISHABLE_CAPABILITY_PROFILE.features.balanceHazards).toBe(false);
    expect(V2_PUBLISHABLE_CAPABILITY_PROFILE.features.headStarNotes).toBe(false);
    expect(V2_PUBLISHABLE_CAPABILITY_PROFILE.features.hipCursorStarNotes).toBe(false);
    expect(V2_PUBLISHABLE_CAPABILITY_PROFILE.features.arbitraryFreeTimeBeats).toBe(false);
    expect(V2_PUBLISHABLE_CAPABILITY_PROFILE.features.particles).toBe(false);
  });

  it('maps Phase B attacks to required evasive actions and rejects invalid pairs', () => {
    expect(PHASE_B_PUBLISHABLE_ATTACKS).toEqual([
      'dual_slam',
      'alternating_stomp_left',
      'alternating_stomp_right',
    ]);
    expect(PHASE_B_ATTACK_REQUIRED_ACTIONS).toEqual({
      dual_slam: 'jump',
      alternating_stomp_left: 'left_step',
      alternating_stomp_right: 'right_step',
    });

    expect(getRequiredActionForPhaseBAttack('dual_slam')).toBe('jump');
    expect(getRequiredActionForPhaseBAttack('alternating_stomp_left')).toBe('left_step');
    expect(getRequiredActionForPhaseBAttack('alternating_stomp_right')).toBe('right_step');
    expect(() => getRequiredActionForPhaseBAttack('meteor_strike' as any)).toThrow(
      /Unsupported Phase B attack/,
    );
  });
});

describe('EDITOR-CAPABILITY (#376): Cross-Body & Safe Transition Capability Checks', () => {
  it('disallows leftHand reaching right edge zones when hip is in zone 9', () => {
    // Cross-body constraint: when hip is in 9, upper hand zones 1, 2, 3 are disallowed
    const res1 = checkCrossBodyConstraint('leftHand', 1, 9);
    expect(res1.valid).toBe(false);

    const res2 = checkCrossBodyConstraint('leftHand', 2, 9);
    expect(res2.valid).toBe(false);

    const res3 = checkCrossBodyConstraint('leftHand', 3, 9);
    expect(res3.valid).toBe(false);

    // Left hand in zone 3 (right edge) is lateral cross-body reach even without hip
    const resFar = checkCrossBodyConstraint('leftHand', 3, null);
    expect(resFar.valid).toBe(false);

    // Normal valid left hand placement
    const resOk = checkCrossBodyConstraint('leftHand', 1, null);
    expect(resOk.valid).toBe(true);
  });

  it('rejects unsafe transitions (same note repeat & long-distance reversals)', () => {
    // Same zone repeat
    expect(
      checkSafeTransition({ part: 'leftHand', zoneId: 1 }, { part: 'leftHand', zoneId: 1 }).safe,
    ).toBe(false);

    // Long distance reversal (1 <-> 3)
    expect(
      checkSafeTransition({ part: 'leftHand', zoneId: 1 }, { part: 'leftHand', zoneId: 3 }).safe,
    ).toBe(false);
    expect(
      checkSafeTransition({ part: 'leftHand', zoneId: 3 }, { part: 'leftHand', zoneId: 1 }).safe,
    ).toBe(false);

    // Long distance reversal (4 <-> 5)
    expect(
      checkSafeTransition({ part: 'leftHand', zoneId: 4 }, { part: 'leftHand', zoneId: 5 }).safe,
    ).toBe(false);

    // Long distance reversal (9 <-> 11 for feet)
    expect(
      checkSafeTransition({ part: 'foot', zoneId: 9 }, { part: 'foot', zoneId: 11 }).safe,
    ).toBe(false);

    // Safe different zone transition
    expect(
      checkSafeTransition({ part: 'leftHand', zoneId: 1 }, { part: 'leftHand', zoneId: 2 }).safe,
    ).toBe(true);

    // Different parts are always safe
    expect(
      checkSafeTransition({ part: 'leftHand', zoneId: 1 }, { part: 'rightHand', zoneId: 5 }).safe,
    ).toBe(true);
  });

  it('distinguishes strict validation from runtime fallback (e.g. center foot 10)', () => {
    // In runtime, foot center 10 acts as fallback for 9/11, but authoring profile requires explicit publishable foot zones
    expect(isPublishableFootZone(9)).toBe(true);
    expect(isPublishableFootZone(10)).toBe(true);
    expect(isPublishableFootZone(11)).toBe(true);
    // Non-foot zone 7 is never accepted as foot
    expect(isPublishableFootZone(7)).toBe(false);
  });
});

describe('EDITOR-TIMING (#376): Distinct Timing Models (Phase A vs Phase B)', () => {
  it('scales Phase A star note landing times with BPM while keeping judgment windows in seconds', () => {
    const plan120 = calculateStarNoteTimings(120);
    expect(plan120.secondsPerBeat).toBeCloseTo(0.5, 6);
    expect(plan120.totalDurationSeconds).toBeCloseTo(4.0, 6);
    expect(plan120.notes).toHaveLength(7);

    // Note 1 (index 0, relative 1 beat from start): 0.5s landing
    expect(plan120.notes[0].landingTimeSeconds).toBeCloseTo(0.5, 6);
    expect(plan120.notes[0].windowStartSeconds).toBeCloseTo(0.5 - 0.40, 6);
    expect(plan120.notes[0].windowEndSeconds).toBeCloseTo(0.5 + 0.40, 6);

    // Note 7 (index 6, relative 7 beats from start): 3.5s landing
    expect(plan120.notes[6].landingTimeSeconds).toBeCloseTo(3.5, 6);
    expect(plan120.notes[6].windowEndSeconds).toBeCloseTo(3.9, 6);
    expect(plan120.completeAtSeconds).toBeCloseTo(3.9, 6);

    // CompleteAt (3.9s) is strictly within branch total duration (4.0s)
    expect(plan120.completeAtSeconds).toBeLessThanOrEqual(plan120.totalDurationSeconds);
  });

  it('validates that 110..140 BPM fit within 8 beats, but 160 BPM judgment exceeds branch duration', () => {
    for (const bpm of [110, 115, 120, 125, 135, 140]) {
      const result = validateStarTimingWithinBranch(bpm);
      expect(result.valid).toBe(true);
      expect(result.completeAtSeconds).toBeLessThanOrEqual(result.branchDurationSeconds);
    }

    // 160 BPM: 7 * (60/160) = 2.625s landing, + 0.40s late = 3.025s. Branch = 8 * (60/160) = 3.0s.
    // 3.025s > 3.0s -> window exceeds branch duration!
    const result160 = validateStarTimingWithinBranch(160);
    expect(result160.valid).toBe(false);
    expect(result160.error).toMatch(/exceeds branch duration/i);
    expect(result160.completeAtSeconds).toBeGreaterThan(result160.branchDurationSeconds);
  });

  it('scales Phase A beat-based hazard timings (5.2, 6.8, 7.0, 8.0 beats)', () => {
    expect(PHASE_A_HAZARD_BEAT_TIMINGS).toEqual({
      warningStart: 0,
      inputStart: 5.2,
      inputEnd: 6.8,
      judgmentTime: 7.0,
      totalDuration: 8.0,
    });

    const hazard120 = calculatePhaseAHazardTiming(120);
    expect(hazard120.secondsPerBeat).toBeCloseTo(0.5, 6);
    expect(hazard120.inputStartSeconds).toBeCloseTo(2.6, 6); // 5.2 * 0.5
    expect(hazard120.inputEndSeconds).toBeCloseTo(3.4, 6); // 6.8 * 0.5
    expect(hazard120.judgmentSeconds).toBeCloseTo(3.5, 6); // 7.0 * 0.5
    expect(hazard120.totalDurationSeconds).toBeCloseTo(4.0, 6); // 8.0 * 0.5
    expect(hazard120.damage).toBe(25); // Fixed damage

    // At 140 BPM
    const hazard140 = calculatePhaseAHazardTiming(140);
    const spb140 = 60 / 140;
    expect(hazard140.judgmentSeconds).toBeCloseTo(7.0 * spb140, 6);
  });

  it('keeps Phase B hazard timings fixed in seconds across different BPMs', () => {
    expect(DEFAULT_PHASE_B_HAZARD_SECONDS).toEqual({
      warningDuration: 1.5,
      activeDuration: 1.0,
      attackInterval: 5.0,
      damage: 15,
      minionCasualtyCount: 1,
    });

    const b120 = getPhaseBHazardTiming();
    expect(b120.warningDuration).toBe(1.5);
    expect(b120.activeDuration).toBe(1.0);
    expect(b120.attackInterval).toBe(5.0);
    expect(b120.damage).toBe(15);
    expect(b120.minionCasualtyCount).toBe(1);
  });
});
