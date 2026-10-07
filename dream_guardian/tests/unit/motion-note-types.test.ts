import { describe, it, expect } from 'vitest';
import type {
  FloorPart,
  MotionPart,
  MotionInteractionType,
  PartRequirement,
  MotionNote,
  MotionNoteState,
  MotionRating,
  MotionNoteRuntime,
  MotionNoteResult,
  MotionNoteRenderItem,
} from '../../src/types/motion-note.js';
import {
  isFloorPart,
  isCursorPart,
  footToZone,
} from '../../src/types/motion-note.js';
import * as TypesIndex from '../../src/types/index.js';
import { FootKeynoteInput } from '../../src/input/FootKeynoteInput.js';

describe('MRN-01: MotionNote Type Contract and Guards', () => {
  describe('FloorPart and BodyPart type guards', () => {
    it('isFloorPart correctly identifies floor parts and rejects others', () => {
      const validFloorParts: FloorPart[] = [
        'leftFoot',
        'rightFoot',
        'centerFoot',
        'bothFeet',
        'fullBody',
      ];

      for (const part of validFloorParts) {
        expect(isFloorPart(part)).toBe(true);
      }

      // Cursor parts should be false
      expect(isFloorPart('leftHand')).toBe(false);
      expect(isFloorPart('rightHand')).toBe(false);
      expect(isFloorPart('head')).toBe(false);
      expect(isFloorPart('hip')).toBe(false);

      // Non-part values should be false
      expect(isFloorPart('')).toBe(false);
      expect(isFloorPart('foot')).toBe(false);
      expect(isFloorPart('knee')).toBe(false);
      expect(isFloorPart(null)).toBe(false);
      expect(isFloorPart(undefined)).toBe(false);
      expect(isFloorPart(123)).toBe(false);
      expect(isFloorPart({})).toBe(false);
    });

    it('isCursorPart correctly identifies cursor parts and rejects others', () => {
      const validCursorParts = ['leftHand', 'rightHand', 'head', 'hip'] as const;

      for (const part of validCursorParts) {
        expect(isCursorPart(part)).toBe(true);
      }

      // Floor parts should be false
      expect(isCursorPart('leftFoot')).toBe(false);
      expect(isCursorPart('rightFoot')).toBe(false);
      expect(isCursorPart('centerFoot')).toBe(false);
      expect(isCursorPart('bothFeet')).toBe(false);
      expect(isCursorPart('fullBody')).toBe(false);

      // Non-part values should be false
      expect(isCursorPart('')).toBe(false);
      expect(isCursorPart('hand')).toBe(false);
      expect(isCursorPart(null)).toBe(false);
      expect(isCursorPart(undefined)).toBe(false);
      expect(isCursorPart(456)).toBe(false);
      expect(isCursorPart([])).toBe(false);
    });
  });

  describe('footToZone mapping and FootKeynoteInput consistency', () => {
    it('maps each FloorPart to its canonical zone ID', () => {
      expect(footToZone('leftFoot')).toBe(9);
      expect(footToZone('centerFoot')).toBe(10);
      expect(footToZone('rightFoot')).toBe(11);
      expect(footToZone('bothFeet')).toBe(10);
      expect(footToZone('fullBody')).toBe(10);
    });

    it('matches FootKeynoteInput keyboard and virtual pedal zone definitions', () => {
      const footInput = new FootKeynoteInput();
      let capturedZone: number | null = null;
      footInput.onEvent((evt) => {
        capturedZone = evt.zoneId;
      });

      // Verify leftFoot mapping
      footInput.fromKeyboard('leftFoot', 100);
      expect(capturedZone).toBe(footToZone('leftFoot'));

      // Verify centerFoot mapping
      footInput.fromKeyboard('centerFoot', 100);
      expect(capturedZone).toBe(footToZone('centerFoot'));

      // Verify rightFoot mapping
      footInput.fromKeyboard('rightFoot', 100);
      expect(capturedZone).toBe(footToZone('rightFoot'));

      // Verify virtual pedal mapping for 9, 10, 11
      const virtualLeft = footInput.fromVirtualPedal(9, 100);
      expect(virtualLeft?.foot).toBe('leftFoot');
      expect(virtualLeft?.zoneId).toBe(footToZone('leftFoot'));

      const virtualCenter = footInput.fromVirtualPedal(10, 100);
      expect(virtualCenter?.foot).toBe('centerFoot');
      expect(virtualCenter?.zoneId).toBe(footToZone('centerFoot'));

      const virtualRight = footInput.fromVirtualPedal(11, 100);
      expect(virtualRight?.foot).toBe('rightFoot');
      expect(virtualRight?.zoneId).toBe(footToZone('rightFoot'));
    });
  });

  describe('MotionNote immutable contract definition', () => {
    it('constructs a valid MotionNote object with required and optional fields', () => {
      const singleRequirement: PartRequirement = {
        part: 'leftFoot',
        zoneId: 9,
      };

      const note: MotionNote = {
        id: 'note-001',
        patternId: 'S001',
        beat: 1,
        requirements: [singleRequirement],
        interaction: 'tap',
        profileId: 'stomp-ring',
        leadBeats: 2,
        holdBeats: 0,
        source: 'stomp',
      };

      expect(note.id).toBe('note-001');
      expect(note.patternId).toBe('S001');
      expect(note.beat).toBe(1);
      expect(note.requirements).toHaveLength(1);
      expect(note.requirements[0].part).toBe('leftFoot');
      expect(note.requirements[0].zoneId).toBe(9);
      expect(note.interaction).toBe('tap');
      expect(note.profileId).toBe('stomp-ring');
      expect(note.leadBeats).toBe(2);
      expect(note.source).toBe('stomp');
    });

    it('supports all valid MotionInteractionType values', () => {
      const interactions: MotionInteractionType[] = [
        'tap',
        'evade',
        'hold',
        'rub',
        'guard',
        'jump',
      ];

      for (const interaction of interactions) {
        const note: MotionNote = {
          id: `note-${interaction}`,
          patternId: 'TEST',
          beat: 2,
          requirements: [{ part: 'rightHand', zoneId: 5 }],
          interaction,
        };
        expect(note.interaction).toBe(interaction);
      }
    });

    it('supports multi-part requirements for Double, Triple, and Quad patterns', () => {
      const quadRequirements: readonly PartRequirement[] = [
        { part: 'leftHand', zoneId: 1 },
        { part: 'rightHand', zoneId: 3 },
        { part: 'head', zoneId: 4 },
        { part: 'hip', zoneId: 10 },
      ];

      const note: MotionNote = {
        id: 'note-quad',
        patternId: 'Q001',
        beat: 4,
        requirements: quadRequirements,
        interaction: 'hold',
        holdBeats: 2,
        source: 'star',
      };

      expect(note.requirements).toHaveLength(4);
      expect(note.requirements.map((r) => r.part)).toEqual([
        'leftHand',
        'rightHand',
        'head',
        'hip',
      ]);
    });
  });

  describe('MotionNoteRuntime and MotionNoteResult contract', () => {
    it('manages runtime lifecycle states and evaluation results', () => {
      const note: MotionNote = {
        id: 'rt-note-1',
        patternId: 'S002',
        beat: 3,
        requirements: [{ part: 'centerFoot', zoneId: 10 }],
        interaction: 'tap',
      };

      const runtime: MotionNoteRuntime = {
        note,
        landingTime: 2.5,
        displayStart: 1.5,
        state: 'inFlight',
        holdProgress: 0,
      };

      expect(runtime.state).toBe('inFlight');
      expect(runtime.landingTime).toBe(2.5);
      expect(runtime.displayStart).toBe(1.5);

      const states: MotionNoteState[] = ['pending', 'inFlight', 'judging', 'holding', 'resolved'];
      for (const state of states) {
        runtime.state = state;
        expect(runtime.state).toBe(state);
      }

      const result: MotionNoteResult = {
        noteId: note.id,
        interaction: 'tap',
        rating: 'Perfect' as MotionRating,
        success: true,
        timingError: 0.02,
        matchedParts: ['centerFoot'] as readonly MotionPart[],
      };

      runtime.result = result;
      runtime.state = 'resolved';

      expect(runtime.result.rating).toBe('Perfect');
      expect(runtime.result.success).toBe(true);
      expect(runtime.result.timingError).toBe(0.02);
      expect(runtime.result.matchedParts).toEqual(['centerFoot']);
    });
  });

  describe('MotionNoteRenderItem contract', () => {
    it('represents read-only snapshot for rendering layer', () => {
      const renderItem: MotionNoteRenderItem = {
        id: 'render-001',
        requirements: [{ part: 'leftHand', zoneId: 1 }],
        interaction: 'tap',
        profileId: 'star-ring',
        progress: 0.75,
        timeToLanding: 0.25,
        holdProgress: undefined,
        outcome: 'hit',
      };

      expect(renderItem.id).toBe('render-001');
      expect(renderItem.profileId).toBe('star-ring');
      expect(renderItem.progress).toBe(0.75);
      expect(renderItem.timeToLanding).toBe(0.25);
      expect(renderItem.outcome).toBe('hit');
    });
  });

  describe('Re-export in src/types/index.ts', () => {
    it('exports all guards and mapping functions from index.ts', () => {
      expect(typeof TypesIndex.isFloorPart).toBe('function');
      expect(typeof TypesIndex.isCursorPart).toBe('function');
      expect(typeof TypesIndex.footToZone).toBe('function');

      expect(TypesIndex.isFloorPart('leftFoot')).toBe(true);
      expect(TypesIndex.isCursorPart('leftHand')).toBe(true);
      expect(TypesIndex.footToZone('leftFoot')).toBe(9);
    });
  });
});
