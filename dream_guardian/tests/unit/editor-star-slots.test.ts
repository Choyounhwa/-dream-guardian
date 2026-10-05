import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import type { EditorProject } from '../../src/data/EditorProject.js';

describe('EditorStarSlots - STAR_COLLECT 7-Slot Editor & Validation UX (#384)', () => {
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    state.setSelectedPhase('STAR_COLLECT');
    layout = new EditorLayout(state);
  });

  describe('1. 7 Fixed Slots for STAR_COLLECT', () => {
    it('returns exactly 7 fixed slots corresponding to beats 2 through 8', () => {
      const slots = state.getStarSlots();
      expect(slots).toHaveLength(7);

      const expectedBeats = [2, 3, 4, 5, 6, 7, 8];
      const expectedTicks = [480, 960, 1440, 1920, 2400, 2880, 3360];

      slots.forEach((slot, idx) => {
        expect(slot.slotIndex).toBe(idx);
        expect(slot.slotNumber).toBe(idx + 1);
        expect(slot.beat).toBe(expectedBeats[idx]);
        expect(slot.tick).toBe(expectedTicks[idx]);
        expect(slot.noteId).toBeDefined();
      });
    });

    it('locks modifying slot landing beat/tick with FIXED_SLOT_LANDING reason', () => {
      const res = state.validateStarSlot(0, { beat: 2.5 } as any);
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('FIXED_SLOT_LANDING');
      expect(res.lockReason).toContain('고정');
      expect(res.diagnostics.some((d) => d.code === 'FIXED_SLOT_LANDING')).toBe(true);
    });

    it('locks modifying note count from exactly 7 notes with COUNT_LOCKED reason', () => {
      const canModify = state.canModifyStarNoteCount();
      expect(canModify).toBe(false);

      const addRes = state.addStarSlotNote?.({ beat: 9 });
      expect(addRes?.valid).toBe(false);
      expect(addRes?.lockCode).toBe('COUNT_LOCKED');
      expect(addRes?.lockReason).toContain('7');
    });

    it('locks reward or free landing modifications with diagnostic reason', () => {
      const rewardRes = state.validateStarSlot(1, { rewardMultiplier: 2.0 } as any);
      expect(rewardRes.valid).toBe(false);
      expect(rewardRes.lockCode).toBe('LOCKED_REWARD_MODIFICATION');

      const freeRes = state.validateStarSlot(1, { freeLanding: true } as any);
      expect(freeRes.valid).toBe(false);
      expect(freeRes.lockCode).toBe('LOCKED_FREE_LANDING');
    });
  });

  describe('2. Initial V2 Profile Allowed vs Locked Inputs', () => {
    it('allows leftHand and rightHand with zones 1..5', () => {
      const resLh = state.validateStarSlot(0, { part: 'leftHand', zoneId: 3 });
      expect(resLh.valid).toBe(true);
      expect(resLh.lockReason).toBeUndefined();

      const updateLh = state.updateStarSlot(0, { part: 'leftHand', zoneId: 3 });
      expect(updateLh.valid).toBe(true);
      const slot0 = state.getStarSlots()[0];
      expect(slot0.part).toBe('leftHand');
      expect(slot0.zoneId).toBe(3);

      const resRh = state.validateStarSlot(1, { part: 'rightHand', zoneId: 5 });
      expect(resRh.valid).toBe(true);

      const updateRh = state.updateStarSlot(1, { part: 'rightHand', zoneId: 5 });
      expect(updateRh.valid).toBe(true);
      const slot1 = state.getStarSlots()[1];
      expect(slot1.part).toBe('rightHand');
      expect(slot1.zoneId).toBe(5);
    });

    it('allows foot with zones 9..11', () => {
      const resFoot = state.validateStarSlot(2, { part: 'foot', zoneId: 10 });
      expect(resFoot.valid).toBe(true);

      const updateFoot = state.updateStarSlot(2, { part: 'foot', zoneId: 10 });
      expect(updateFoot.valid).toBe(true);
      const slot2 = state.getStarSlots()[2];
      expect(slot2.part).toBe('foot');
      expect(slot2.zoneId).toBe(10);
    });

    it('locks head cursor for stars with LOCKED_INPUT_CAPABILITY reason', () => {
      const res = state.validateStarSlot(0, { part: 'head' as any, zoneId: 4 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
      expect(res.lockReason).toContain('머리');
      expect(res.diagnostics.some((d) => d.code === 'LOCKED_INPUT_CAPABILITY')).toBe(true);
    });

    it('locks hip cursor for stars with LOCKED_INPUT_CAPABILITY reason', () => {
      const res = state.validateStarSlot(0, { part: 'hip' as any, zoneId: 6 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
      expect(res.lockReason).toContain('골반');
    });

    it('locks hands targeting zone outside 1..5 with LOCKED_INPUT_CAPABILITY', () => {
      const res = state.validateStarSlot(0, { part: 'leftHand', zoneId: 7 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
      expect(res.lockReason).toContain('1~5');
    });

    it('locks feet targeting zone outside 9..11 with LOCKED_INPUT_CAPABILITY', () => {
      const res = state.validateStarSlot(0, { part: 'foot', zoneId: 4 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
      expect(res.lockReason).toContain('9~11');
    });
  });

  describe('3. Form Buffer Separation & Safe Handling', () => {
    it('stores invalid or unapplied input in form buffer without corrupting document', () => {
      const canonicalSlot0 = { ...state.getStarSlots()[0] };

      // Set invalid input into form buffer for slot 0
      state.setFormBuffer(0, { part: 'head', zoneId: 4 });

      const buffer = state.getFormBuffer(0);
      expect(buffer).toBeDefined();
      expect(buffer?.part).toBe('head');
      expect(buffer?.zoneId).toBe(4);
      expect(buffer?.errors?.length).toBeGreaterThan(0);

      // Canonical document slot is NOT corrupted
      const currentSlot0 = state.getStarSlots()[0];
      expect(currentSlot0.part).toBe(canonicalSlot0.part);
      expect(currentSlot0.zoneId).toBe(canonicalSlot0.zoneId);

      // Exported EditorProject document is NOT corrupted
      const project = state.toEditorProject();
      const starSeq = project.sequences.find((s) => s.phase === 'phaseA' && s.kind === 'starNotes');
      expect(starSeq).toBeDefined();
      const firstEvt = starSeq?.events[0] as any;
      expect(firstEvt.target.part).not.toBe('head');
    });

    it('clears form buffer and applies valid changes only upon explicit application', () => {
      state.setFormBuffer(3, { part: 'rightHand', zoneId: 2 });
      expect(state.getFormBuffer(3)?.zoneId).toBe(2);

      const applyRes = state.applyFormBuffer(3);
      expect(applyRes.valid).toBe(true);

      // Slot 3 in canonical document is now updated
      const slot3 = state.getStarSlots()[3];
      expect(slot3.part).toBe('rightHand');
      expect(slot3.zoneId).toBe(2);

      // Form buffer is cleared
      expect(state.getFormBuffer(3)).toBeUndefined();
    });

    it('refuses to apply invalid form buffer and leaves document intact', () => {
      const originalSlot = { ...state.getStarSlots()[4] };
      state.setFormBuffer(4, { part: 'leftHand', zoneId: 8 }); // Invalid zone for hand

      const applyRes = state.applyFormBuffer(4);
      expect(applyRes.valid).toBe(false);

      const slot4 = state.getStarSlots()[4];
      expect(slot4.zoneId).toBe(originalSlot.zoneId);
      expect(state.getFormBuffer(4)).toBeDefined();
    });
  });

  describe('4. Pattern Selection vs Application with Diff Preview', () => {
    it('selecting pattern shows diff preview without silently mutating sequence notes', () => {
      const initialNotes = state.getNotesForPhase('STAR_COLLECT');
      const initialParts = initialNotes.map((n) => n.payload?.part);

      // Select pattern
      const ok = state.setSelectedPattern('CAT_SKY_POINT_RIGHT');
      expect(ok).toBe(true);

      // Sequence notes are completely unchanged!
      const currentNotes = state.getNotesForPhase('STAR_COLLECT');
      expect(currentNotes.map((n) => n.payload?.part)).toEqual(initialParts);

      // Pattern diff is available
      const diff = state.getPatternApplicationDiff('CAT_SKY_POINT_RIGHT', 'STAR_COLLECT');
      expect(diff).toBeDefined();
      expect(diff.targetPhase).toBe('STAR_COLLECT');
      expect(diff.previewNotes.length).toBe(7);

      // Explicit application mutates the sequence
      state.applyPatternToSequence('CAT_SKY_POINT_RIGHT');
      const appliedNotes = state.getNotesForPhase('STAR_COLLECT');
      expect(appliedNotes[0].label).toContain('우측 스카이포인트');
    });
  });

  describe('5. Error Diagnostic & Error Focus Navigation', () => {
    it('focusError sets target note selection and active field path', () => {
      const slot2 = state.getStarSlots()[2];
      const targetNoteId = slot2.noteId;
      const targetPath = 'target.zoneId';

      state.focusError(targetNoteId, targetPath);

      expect(state.selectedNoteId).toBe(targetNoteId);
      const focused = state.getFocusedError();
      expect(focused).toEqual({
        entityId: targetNoteId,
        path: targetPath,
      });

      state.clearFocusedError();
      expect(state.getFocusedError()).toBeNull();
    });

    it('layout renders error badges with clickable data-focus attributes', () => {
      // Intentionally induce a validation diagnostic in slot 1
      state.setFormBuffer(1, { part: 'head', zoneId: 4 });
      const html = layout.renderSidebarHTML();

      expect(html).toContain('star-slot-editor');
      expect(html).toContain('data-error-path');
      expect(html).toContain('data-error-entity');
    });
  });

  describe('6. Non-Standard Legacy Values Roundtrip & Warning Preservation', () => {
    it('preserves non-standard legacy values with warning rather than silently rounding or dropping', () => {
      const legacyProject: EditorProject = {
        kind: 'dream-guardian-authoring-project',
        schemaVersion: 2,
        projectId: 'legacy_project',
        revision: 1,
        rulesetId: 'standard_v1',
        metadata: {
          title: 'Legacy Star Project',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        previewTempo: { bpm: 95, beatsPerBar: 4 },
        patterns: [],
        sequences: [
          {
            id: 'seq_star_collect',
            name: 'Star Collect',
            phase: 'phaseA',
            kind: 'starNotes',
            events: [
              // Non-standard tick: 720 (beat 2.5)
              {
                id: 'star_evt_nonstandard',
                landingTick: 720,
                target: { type: 'cursor', part: 'leftHand', zoneId: 3 },
              },
              // Standard tick 960 (beat 3) but legacy foot representation
              {
                id: 'star_evt_foot',
                landingTick: 960,
                target: { type: 'foot', foot: 'centerFoot', zoneId: 10 },
              },
            ],
          },
        ],
        bindings: [],
      };

      state.applyProject(legacyProject);

      // Check slot / notes - non-standard tick 720 is preserved (beat 2.5)
      const starNotes = state.getNotesForPhase('STAR_COLLECT');
      const nonStd = starNotes.find((n) => n.id === 'star_evt_nonstandard');
      expect(nonStd).toBeDefined();
      expect(nonStd?.startBeat).toBe(2.5); // NOT rounded to 2 or 3

      // Foot note preserved
      const footNote = starNotes.find((n) => n.id === 'star_evt_foot');
      expect(footNote).toBeDefined();
      expect(footNote?.payload?.part).toBe('foot');

      // Validation issues warning for non-standard timing
      const validation = state.validateStarSlots();
      expect(validation.warnings.some((w) => w.code === 'NON_STANDARD_SLOT_TIMING')).toBe(true);

      // Roundtrip export preserves exact 720 landingTick and foot target
      const exported = state.toEditorProject();
      const exportedSeq = exported.sequences.find((s) => s.id === 'seq_star_collect');
      const exportedEvt = exportedSeq?.events.find((e: any) => e.id === 'star_evt_nonstandard') as any;
      expect(exportedEvt.landingTick).toBe(720);

      const exportedFoot = exportedSeq?.events.find((e: any) => e.id === 'star_evt_foot') as any;
      expect(exportedFoot.target.type).toBe('foot');
      expect(exportedFoot.target.zoneId).toBe(10);
    });
  });

  describe('7. EditorLayout STAR_COLLECT UI Rendering', () => {
    it('renders 7-slot editor section when STAR_COLLECT is active phase', () => {
      state.setSelectedPhase('STAR_COLLECT');
      const sidebarHtml = layout.renderSidebarHTML();

      expect(sidebarHtml).toContain('star-slot-editor-section');
      expect(sidebarHtml).toContain('별 수집 7슬롯 편집');

      // Should render all 7 slots
      for (let i = 1; i <= 7; i++) {
        expect(sidebarHtml).toContain(`슬롯 ${i}`);
      }

      // Check part options: 왼손, 오른손, 발
      expect(sidebarHtml).toContain('leftHand');
      expect(sidebarHtml).toContain('rightHand');
      expect(sidebarHtml).toContain('foot');
    });

    it('highlights currently selected note and focused error in layout', () => {
      const slots = state.getStarSlots();
      const slotNoteId = slots[1].noteId;
      state.setSelectedNoteId(slotNoteId);
      state.focusError(slotNoteId, 'target.zoneId');

      const sidebarHtml = layout.renderSidebarHTML();
      expect(sidebarHtml).toContain('active-slot');
      expect(sidebarHtml).toContain('has-error-focus');
    });
  });
});
