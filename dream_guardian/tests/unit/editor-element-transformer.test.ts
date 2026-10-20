import { describe, it, expect, beforeEach } from 'vitest';
import { EditorElementTransformer, type EditorElementHost } from '../../src/editor/EditorElementTransformer.js';
import { PhaseSequenceEditor } from '../../src/editor/PhaseSequenceEditor.js';
import { ProjectCommandManager } from '../../src/editor/ProjectCommands.js';
import type { EditorProject } from '../../src/data/EditorProject.js';
import { DancePatternRegistry } from '../../src/data/danceRoutineData.js';

describe('EditorElementTransformer [REFACTOR-EDITOR-002]', () => {
  let host: EditorElementHost;
  let transformer: EditorElementTransformer;
  let sequenceEditor: PhaseSequenceEditor;
  let commandManager: ProjectCommandManager;
  let registry: DancePatternRegistry;
  let docChangeNotified: boolean;
  let stateChangeNotified: boolean;

  beforeEach(() => {
    sequenceEditor = new PhaseSequenceEditor();
    commandManager = new ProjectCommandManager();
    registry = new DancePatternRegistry();
    docChangeNotified = false;
    stateChangeNotified = false;

    host = {
      getSequenceEditor: () => sequenceEditor,
      getCommandManager: () => commandManager,
      hasCommandManager: () => true,
      toEditorProject: () => ({
        formatVersion: '2.0.0',
        metadata: { id: 'test', title: 'Test Project', author: 'tester', bpm: 95, version: '1.0.0' },
        timeline: { totalBars: 32, bpm: 95, timeSignature: [4, 4], lanes: [] },
        choreography: { patterns: [], sequences: [] },
        bindings: [],
        stageBundles: {},
        customSequences: [],
      } as unknown as EditorProject),
      notifyDocumentChange: () => {
        docChangeNotified = true;
      },
      notifyStateChange: () => {
        stateChangeNotified = true;
      },
      getTimelineTotalBeats: (_phase) => 16,
      getDancePattern: (id) => registry.get(id),
    };

    transformer = new EditorElementTransformer(host);
  });

  describe('1. Star Slot Management & Validation', () => {
    it('returns exactly 7 star slots for STAR_COLLECT phase', () => {
      const slots = transformer.getStarSlots();
      expect(slots).toHaveLength(7);
      expect(slots[0].beat).toBe(2);
      expect(slots[0].tick).toBe(480);
      expect(slots[6].beat).toBe(8);
      expect(slots[6].tick).toBe(3360);
    });

    it('locks modifying star note count (COUNT_LOCKED)', () => {
      expect(transformer.canModifyStarNoteCount()).toBe(false);
      const res = transformer.addStarSlotNote();
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('COUNT_LOCKED');
    });

    it('rejects invalid landing beat/tick with FIXED_SLOT_LANDING', () => {
      const res = transformer.validateStarSlot(0, { beat: 3.5 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('FIXED_SLOT_LANDING');
    });

    it('rejects reward and free landing modifications', () => {
      const resReward = transformer.validateStarSlot(0, { rewardMultiplier: 2 } as any);
      expect(resReward.valid).toBe(false);
      expect(resReward.lockCode).toBe('LOCKED_REWARD_MODIFICATION');

      const resFree = transformer.validateStarSlot(0, { freeLanding: true } as any);
      expect(resFree.valid).toBe(false);
      expect(resFree.lockCode).toBe('LOCKED_FREE_LANDING');
    });

    it('validates hand and foot zones correctly', () => {
      // Valid hand zone (1~5)
      const validHand = transformer.validateStarSlot(0, { part: 'leftHand', zoneId: 4 });
      expect(validHand.valid).toBe(true);

      // Invalid hand zone (e.g. 6)
      const invalidHand = transformer.validateStarSlot(0, { part: 'leftHand', zoneId: 6 });
      expect(invalidHand.valid).toBe(false);
      expect(invalidHand.lockCode).toBe('LOCKED_INPUT_CAPABILITY');

      // Valid foot zone (9~11)
      const validFoot = transformer.validateStarSlot(0, { part: 'foot', zoneId: 10 });
      expect(validFoot.valid).toBe(true);

      // Invalid foot zone (e.g. 8)
      const invalidFoot = transformer.validateStarSlot(0, { part: 'foot', zoneId: 8 });
      expect(invalidFoot.valid).toBe(false);
      expect(invalidFoot.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
    });

    it('handles form buffer for star slots', () => {
      transformer.setFormBuffer(0, { part: 'rightHand', zoneId: 5 });
      const entry = transformer.getFormBuffer(0);
      expect(entry).toBeDefined();
      expect(entry?.part).toBe('rightHand');
      expect(entry?.zoneId).toBe(5);

      const applyRes = transformer.applyFormBuffer(0);
      expect(applyRes.valid).toBe(true);
      expect(transformer.getFormBuffer(0)).toBeUndefined();
      expect(docChangeNotified).toBe(true);
      expect(stateChangeNotified).toBe(true);
    });

    it('validates star slots sequence completeness with validateStarSlots', () => {
      const result = transformer.validateStarSlots();
      expect(result.valid).toBe(true);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('2. Fever Slot Management & Validation', () => {
    it('initializes default 8 fever slots', () => {
      transformer.initDefaultFeverSlots();
      const slots = transformer.getFeverSlots();
      expect(slots).toHaveLength(8);
      expect(slots[0].noteId).toBe('NOTE_F_1');
      expect(slots[7].noteId).toBe('NOTE_F_8');
    });

    it('validates fever slot constraints', () => {
      // Valid left hand zone 4
      const validRes = transformer.validateFeverSlot(0, { part: 'leftHand', zoneId: 4 });
      expect(validRes.valid).toBe(true);

      // Hand zone out of 1~5
      const invalidZone = transformer.validateFeverSlot(0, { part: 'leftHand', zoneId: 8 });
      expect(invalidZone.valid).toBe(false);
      expect(invalidZone.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
    });

    it('manages fever form buffer and applies update', () => {
      transformer.setFeverFormBuffer(1, { part: 'rightHand', zoneId: 5 });
      const entry = transformer.getFeverFormBuffer(1);
      expect(entry).toBeDefined();
      expect(entry?.part).toBe('rightHand');

      const applyRes = transformer.applyFeverFormBuffer(1);
      expect(applyRes.valid).toBe(true);
      expect(transformer.getFeverFormBuffer(1)).toBeUndefined();
    });

    it('generates fever content preview', () => {
      const preview = transformer.getFeverContentPreview('FEVER_1', 'CAT_LOW_BOUNCE');
      expect(preview.targetPhase).toBe('FEVER_1');
      expect(Array.isArray(preview.previewNotes)).toBe(true);
    });
  });

  describe('3. Phase A Hazard Evade Management', () => {
    it('sets and gets Phase A hazard pattern', () => {
      expect(transformer.getPhaseAHazardPattern()).toBe('left_step');

      const res = transformer.setPhaseAHazardPattern('jump');
      expect(res.success).toBe(true);
      expect(transformer.getPhaseAHazardPattern()).toBe('jump');
    });

    it('rejects inactive or invalid Phase A patterns', () => {
      const balanceRes = transformer.setPhaseAHazardPattern('balance_left');
      expect(balanceRes.success).toBe(false);
      expect(balanceRes.error).toContain('비활성 패턴');

      const invalidRes = transformer.setPhaseAHazardPattern('non_existent');
      expect(invalidRes.success).toBe(false);
    });

    it('provides locked config and routine for Phase A', () => {
      const config = transformer.getPhaseAHazardLockedConfig();
      expect(config.damage).toBe(25);

      const routine = transformer.getPhaseAHazardRoutine();
      expect(routine.length).toBeGreaterThan(0);
      expect(transformer.validatePhaseAHazard().valid).toBe(true);
    });
  });

  describe('4. Phase B Boss Hazard Management', () => {
    it('initializes default Phase B hazard attacks', () => {
      transformer.initDefaultPhaseBHazard();
      const attacks = transformer.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(3);
      expect(attacks[0].attackType).toBe('dual_slam');
      expect(attacks[0].requiredAction).toBe('jump');
    });

    it('adds, reorders, and removes Phase B attacks', () => {
      transformer.initDefaultPhaseBHazard();

      const addRes = transformer.addPhaseBHazardAttack('dual_slam');
      expect(addRes.success).toBe(true);
      expect(transformer.getPhaseBHazardAttacks()).toHaveLength(4);

      const reorderRes = transformer.reorderPhaseBHazardAttacks(0, 2);
      expect(reorderRes.success).toBe(true);

      const removeRes = transformer.removePhaseBHazardAttack(0);
      expect(removeRes.success).toBe(true);
      expect(transformer.getPhaseBHazardAttacks()).toHaveLength(3);
    });

    it('validates Phase B hazard sequence', () => {
      transformer.initDefaultPhaseBHazard();
      const validRes = transformer.validatePhaseBHazard();
      expect(validRes.valid).toBe(true);

      // Empty attacks validation
      transformer.replacePhaseBHazardAttacks([]);
      const emptyRes = transformer.validatePhaseBHazard();
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.diagnosticCode).toBe('empty-hazard-sequence');
    });

    it('provides locked config and action mapping', () => {
      const config = transformer.getPhaseBHazardLockedConfig();
      expect(config.damage).toBe(15);
      expect(transformer.getRequiredActionForPhaseBAttack('dual_slam')).toBe('jump');
      expect(transformer.getSupportedPhaseBAttacks().length).toBeGreaterThan(0);
    });
  });
});
