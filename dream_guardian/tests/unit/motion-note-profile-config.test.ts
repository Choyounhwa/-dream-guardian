import { describe, it, expect } from 'vitest';
import type { MotionNote } from '../../src/types/motion-note.js';
import {
  type NoteVisualProfile,
  DEFAULT_PROFILE_MAP,
  DEFAULT_NOTE_PROFILES,
  STAR_HAND_PROFILE,
  STOMP_FOOT_PROFILE,
  HAZARD_FLOOR_PROFILE,
  BOSS_SLAM_PROFILE,
  resolveProfile,
  UNIFIED_FLIGHT_STANDARD,
  UNIFIED_NOTE_PROFILES,
  createUnifiedFlightProfile,
  isUnifiedFlightProfile,
  resolveUnifiedProfile,
} from '../../config/motion-note-profile.config.js';
import { DEFAULT_STAR_NOTE_VISUAL_CONFIG } from '../../config/beat-motion.config.js';
import {
  DEFAULT_STOMP_NOTE_RADIUS,
  DEFAULT_STOMP_NOTE_MIN_SCALE,
  DEFAULT_STOMP_NOTE_MAX_SCALE,
  RUNNING_MAT_CONFIG,
} from '../../config/running-mat.config.js';

describe('MRN-02: Note Visual Profile Config and Default Mapping (#476)', () => {
  describe('1. NoteVisualProfile Interface and Default Profiles Registration', () => {
    it('registers all 4 default profiles in DEFAULT_NOTE_PROFILES', () => {
      expect(DEFAULT_NOTE_PROFILES).toBeDefined();
      expect(DEFAULT_NOTE_PROFILES.star_hand).toBeDefined();
      expect(DEFAULT_NOTE_PROFILES.stomp_foot).toBeDefined();
      expect(DEFAULT_NOTE_PROFILES.hazard_floor).toBeDefined();
      expect(DEFAULT_NOTE_PROFILES.boss_slam).toBeDefined();

      expect(STAR_HAND_PROFILE).toBe(DEFAULT_NOTE_PROFILES.star_hand);
      expect(STOMP_FOOT_PROFILE).toBe(DEFAULT_NOTE_PROFILES.stomp_foot);
      expect(HAZARD_FLOOR_PROFILE).toBe(DEFAULT_NOTE_PROFILES.hazard_floor);
      expect(BOSS_SLAM_PROFILE).toBe(DEFAULT_NOTE_PROFILES.boss_slam);
    });

    it('star_hand profile matches StarNoteRenderer parameters', () => {
      const profile: NoteVisualProfile = STAR_HAND_PROFILE;
      expect(profile.profileId).toBe('star_hand');

      // flight parameters: t^2 easing, minScale 0.3, maxScale 1.2
      expect(profile.flight.easingExponent).toBe(2.0);
      expect(profile.flight.minScale).toBe(0.3);
      expect(profile.flight.maxScale).toBe(1.2);

      // ring: circle, byPart 4-color cursor tint, landing pulse enabled
      expect(profile.ring).not.toBeNull();
      expect(profile.ring?.painter).toBe('circle');
      expect(profile.ring?.color).toBe('byPart');
      expect(profile.ring?.startScale).toBe(2.5);
      expect(profile.ring?.endScale).toBe(1.0);
      expect(profile.ring?.landingPulse).toBe(true);

      // body: uses base visual config references without duplication
      expect(profile.body.baseRadius).toBe(DEFAULT_STAR_NOTE_VISUAL_CONFIG.baseRadius);
      expect(profile.body.fillColor).toBe(DEFAULT_STAR_NOTE_VISUAL_CONFIG.bodyFillColor);
      expect(profile.body.borderColor).toBe('byPart');
      expect(profile.body.symbol).toBe('★');
      expect(profile.body.showLaneLabel).toBe(false);

      // feedback VFX keys
      expect(profile.feedback.hitVfx).toBe('starHit');
      expect(profile.feedback.missVfx).toBe('starMiss');
    });

    it('stomp_foot profile matches RunningMatRenderer flying stomp parameters', () => {
      const profile: NoteVisualProfile = STOMP_FOOT_PROFILE;
      expect(profile.profileId).toBe('stomp_foot');

      // flight parameters: p^1.4 easing, minScale 0.3, maxScale 1.25
      expect(profile.flight.easingExponent).toBe(1.4);
      expect(profile.flight.minScale).toBe(DEFAULT_STOMP_NOTE_MIN_SCALE);
      expect(profile.flight.maxScale).toBe(DEFAULT_STOMP_NOTE_MAX_SCALE);

      // ring: circle approach ring
      expect(profile.ring).not.toBeNull();
      expect(profile.ring?.painter).toBe('circle');
      expect(profile.ring?.startScale).toBe(2.2);
      expect(profile.ring?.endScale).toBe(1.0);

      // body: ♪ symbol, radius 24, showLaneLabel true
      expect(profile.body.baseRadius).toBe(DEFAULT_STOMP_NOTE_RADIUS);
      expect(profile.body.symbol).toBe(RUNNING_MAT_CONFIG.stompNoteSymbol);
      expect(profile.body.showLaneLabel).toBe(true);

      // trail: beam painter with lengthRatio 0.25 and alpha 0.45
      expect(profile.trail.painter).toBe('beam');
      expect(profile.trail.lengthRatio).toBe(0.25);
      expect(profile.trail.alpha).toBe(0.45);

      // feedback VFX keys
      expect(profile.feedback.hitVfx).toBe('stompHit');
      expect(profile.feedback.missVfx).toBe('stompMiss');
    });

    it('hazard_floor profile matches HazardZoneRenderer parameters', () => {
      const profile: NoteVisualProfile = HAZARD_FLOOR_PROFILE;
      expect(profile.profileId).toBe('hazard_floor');

      // flight parameters: p^1.5 easing, minScale 0.2, maxScale 1.0
      expect(profile.flight.easingExponent).toBe(1.5);
      expect(profile.flight.minScale).toBe(0.2);
      expect(profile.flight.maxScale).toBe(1.0);

      // ring: null (floor hazard zone does not use approach circle ring)
      expect(profile.ring).toBeNull();

      // body: hazard skull / warning symbol
      expect(profile.body.painter).toBe('hazardSkull');
      expect(profile.body.symbol).toBe('⚠');
      expect(profile.body.showLaneLabel).toBe(false);

      // trail: none
      expect(profile.trail.painter).toBe('none');

      // feedback VFX keys
      expect(profile.feedback.hitVfx).toBe('hazardHit');
      expect(profile.feedback.missVfx).toBe('hazardEvade');
    });

    it('boss_slam profile matches BossClimaxRenderer parameters', () => {
      const profile: NoteVisualProfile = BOSS_SLAM_PROFILE;
      expect(profile.profileId).toBe('boss_slam');

      // flight parameters: p^1.4 easing, minScale 0.3, maxScale 1.2
      expect(profile.flight.easingExponent).toBe(1.4);
      expect(profile.flight.minScale).toBe(0.3);
      expect(profile.flight.maxScale).toBe(1.2);

      // ring: null
      expect(profile.ring).toBeNull();

      // body: hazard skull / warning symbol
      expect(profile.body.painter).toBe('hazardSkull');
      expect(profile.body.symbol).toBe('⚠');
      expect(profile.body.showLaneLabel).toBe(false);

      // trail: none
      expect(profile.trail.painter).toBe('none');

      // feedback VFX keys
      expect(profile.feedback.hitVfx).toBe('bossSlamHit');
      expect(profile.feedback.missVfx).toBe('bossSlamEvade');
    });
  });

  describe('2. DEFAULT_PROFILE_MAP Table Verification', () => {
    it('maps tap interaction correctly for hand and floor', () => {
      expect(DEFAULT_PROFILE_MAP.tap?.hand).toBe('star_hand');
      expect(DEFAULT_PROFILE_MAP.tap?.floor).toBe('stomp_foot');
    });

    it('maps evade interaction correctly for floor', () => {
      expect(DEFAULT_PROFILE_MAP.evade?.floor).toBe('hazard_floor');
    });

    it('maps jump interaction correctly for floor', () => {
      expect(DEFAULT_PROFILE_MAP.jump?.floor).toBe('boss_slam');
    });

    it('maps extension interactions for hand placeholders', () => {
      expect(DEFAULT_PROFILE_MAP.hold?.hand).toBe('hold_nebula');
      expect(DEFAULT_PROFILE_MAP.rub?.hand).toBe('rub_vortex');
      expect(DEFAULT_PROFILE_MAP.guard?.hand).toBe('guard_shield');
    });
  });

  describe('3. resolveProfile Function Resolution and Precedence', () => {
    it('prioritizes explicit note.profileId override over default mappings', () => {
      const customOverrideNote: MotionNote = {
        id: 'note-01',
        patternId: 'P01',
        beat: 1,
        requirements: [{ part: 'leftHand', zoneId: 1 }],
        interaction: 'tap',
        profileId: 'hazard_floor', // Explicit override
      };

      const resolved = resolveProfile(customOverrideNote);
      expect(resolved.profileId).toBe('hazard_floor');
    });

    it('resolves FloorPart tap requirements to stomp_foot profile', () => {
      const floorParts = ['leftFoot', 'rightFoot', 'centerFoot', 'bothFeet', 'fullBody'] as const;

      for (const part of floorParts) {
        const footNote: MotionNote = {
          id: `foot-${part}`,
          patternId: 'P02',
          beat: 2,
          requirements: [{ part, zoneId: 10 }],
          interaction: 'tap',
        };

        const resolved = resolveProfile(footNote);
        expect(resolved.profileId).toBe('stomp_foot');
      }
    });

    it('resolves BodyPart tap requirements to star_hand profile', () => {
      const bodyParts = ['leftHand', 'rightHand', 'head', 'hip'] as const;

      for (const part of bodyParts) {
        const handNote: MotionNote = {
          id: `body-${part}`,
          patternId: 'P03',
          beat: 3,
          requirements: [{ part, zoneId: 2 }],
          interaction: 'tap',
        };

        const resolved = resolveProfile(handNote);
        expect(resolved.profileId).toBe('star_hand');
      }
    });

    it('resolves evade on floor to hazard_floor profile', () => {
      const evadeNote: MotionNote = {
        id: 'evade-01',
        patternId: 'P04',
        beat: 4,
        requirements: [{ part: 'leftFoot', zoneId: 9 }],
        interaction: 'evade',
      };

      const resolved = resolveProfile(evadeNote);
      expect(resolved.profileId).toBe('hazard_floor');
    });

    it('resolves jump on floor to boss_slam profile', () => {
      const jumpNote: MotionNote = {
        id: 'jump-01',
        patternId: 'P05',
        beat: 5,
        requirements: [{ part: 'bothFeet', zoneId: 10 }],
        interaction: 'jump',
      };

      const resolved = resolveProfile(jumpNote);
      expect(resolved.profileId).toBe('boss_slam');
    });

    it('falls back safely to star_hand when interaction is unmapped or unknown', () => {
      const unmappedNote: MotionNote = {
        id: 'unmapped-01',
        patternId: 'P06',
        beat: 6,
        requirements: [{ part: 'leftHand', zoneId: 3 }],
        interaction: 'evade', // evade has no hand profile in DEFAULT_PROFILE_MAP
      };

      const resolved = resolveProfile(unmappedNote);
      expect(resolved.profileId).toBe('star_hand');
    });

    it('falls back safely to star_hand when profileId override does not exist in registry', () => {
      const nonExistentProfileNote: MotionNote = {
        id: 'nonexistent-01',
        patternId: 'P07',
        beat: 7,
        requirements: [{ part: 'leftHand', zoneId: 1 }],
        interaction: 'tap',
        profileId: 'unknown_custom_skin_id',
      };

      const resolved = resolveProfile(nonExistentProfileNote);
      expect(resolved.profileId).toBe('star_hand');
    });

    it('falls back safely to star_hand when requirements array is empty', () => {
      const emptyReqNote: MotionNote = {
        id: 'empty-01',
        patternId: 'P08',
        beat: 8,
        requirements: [],
        interaction: 'tap',
      };

      const resolved = resolveProfile(emptyReqNote);
      expect(resolved.profileId).toBe('star_hand');
    });
  });
});

describe('MRN-12: Unified Flight Standard and Profile Consistency (#486)', () => {
  describe('1. UNIFIED_FLIGHT_STANDARD constants and constraints', () => {
    it('defines UNIFIED_FLIGHT_STANDARD with minScale: 0.3, maxScale: 1.2, easingExponent: 1.4', () => {
      expect(UNIFIED_FLIGHT_STANDARD).toBeDefined();
      expect(UNIFIED_FLIGHT_STANDARD.minScale).toBe(0.3);
      expect(UNIFIED_FLIGHT_STANDARD.maxScale).toBe(1.2);
      expect(UNIFIED_FLIGHT_STANDARD.easingExponent).toBe(1.4);
    });

    it('UNIFIED_FLIGHT_STANDARD is an immutable frozen object', () => {
      expect(Object.isFrozen(UNIFIED_FLIGHT_STANDARD)).toBe(true);
    });

    it('boss_slam default profile matches UNIFIED_FLIGHT_STANDARD', () => {
      expect(BOSS_SLAM_PROFILE.flight.minScale).toBe(UNIFIED_FLIGHT_STANDARD.minScale);
      expect(BOSS_SLAM_PROFILE.flight.maxScale).toBe(UNIFIED_FLIGHT_STANDARD.maxScale);
      expect(BOSS_SLAM_PROFILE.flight.easingExponent).toBe(UNIFIED_FLIGHT_STANDARD.easingExponent);
    });
  });

  describe('2. Unified Profile Set and Profile Consistency', () => {
    it('provides UNIFIED_NOTE_PROFILES where all profiles adhere to UNIFIED_FLIGHT_STANDARD', () => {
      expect(UNIFIED_NOTE_PROFILES).toBeDefined();
      expect(UNIFIED_NOTE_PROFILES.star_hand).toBeDefined();
      expect(UNIFIED_NOTE_PROFILES.stomp_foot).toBeDefined();
      expect(UNIFIED_NOTE_PROFILES.hazard_floor).toBeDefined();
      expect(UNIFIED_NOTE_PROFILES.boss_slam).toBeDefined();

      for (const [key, profile] of Object.entries(UNIFIED_NOTE_PROFILES)) {
        expect(profile.flight.minScale, `${key} minScale`).toBe(0.3);
        expect(profile.flight.maxScale, `${key} maxScale`).toBe(1.2);
        expect(profile.flight.easingExponent, `${key} easingExponent`).toBe(1.4);
      }
    });

    it('createUnifiedFlightProfile applies UNIFIED_FLIGHT_STANDARD while preserving other properties', () => {
      const unifiedStar = createUnifiedFlightProfile(STAR_HAND_PROFILE);
      expect(unifiedStar.profileId).toBe('star_hand');
      expect(unifiedStar.flight.minScale).toBe(0.3);
      expect(unifiedStar.flight.maxScale).toBe(1.2);
      expect(unifiedStar.flight.easingExponent).toBe(1.4);
      expect(unifiedStar.ring).toEqual(STAR_HAND_PROFILE.ring);
      expect(unifiedStar.body).toEqual(STAR_HAND_PROFILE.body);
      expect(unifiedStar.feedback).toEqual(STAR_HAND_PROFILE.feedback);
    });

    it('createUnifiedFlightProfile allows optional flight overrides', () => {
      const customProfile = createUnifiedFlightProfile(STAR_HAND_PROFILE, { maxScale: 1.5 });
      expect(customProfile.flight.minScale).toBe(0.3);
      expect(customProfile.flight.maxScale).toBe(1.5);
      expect(customProfile.flight.easingExponent).toBe(1.4);
    });

    it('isUnifiedFlightProfile correctly identifies profiles adhering to the standard', () => {
      expect(isUnifiedFlightProfile(BOSS_SLAM_PROFILE)).toBe(true);
      expect(isUnifiedFlightProfile(UNIFIED_NOTE_PROFILES.star_hand)).toBe(true);
      expect(isUnifiedFlightProfile(UNIFIED_NOTE_PROFILES.stomp_foot)).toBe(true);
      expect(isUnifiedFlightProfile(UNIFIED_NOTE_PROFILES.hazard_floor)).toBe(true);
      expect(isUnifiedFlightProfile(STAR_HAND_PROFILE)).toBe(false); // retains 2.0 for existing renderer backward compatibility
    });

    it('resolveUnifiedProfile resolves profiles with UNIFIED_FLIGHT_STANDARD', () => {
      const note: MotionNote = {
        id: 'test-unified-note',
        patternId: 'P_TEST',
        beat: 4,
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
      };
      const resolved = resolveUnifiedProfile(note);
      expect(resolved.profileId).toBe('star_hand');
      expect(resolved.flight.minScale).toBe(0.3);
      expect(resolved.flight.maxScale).toBe(1.2);
      expect(resolved.flight.easingExponent).toBe(1.4);
    });
  });
});
