import { describe, expect, it } from 'vitest';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../../src/data/EditorProject.js';
import {
  createEmptyEditorProject,
  validateEditorProject,
} from '../../src/data/ProjectValidator.js';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function createSampleValidProject(): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId: 'proj_dance_groove_01',
    revision: 1,
    rulesetId: 'ruleset_standard_v1',
    metadata: {
      title: 'Groove Routine A',
      description: 'Intro dance routine for Chapter 1',
      author: 'AuthorOne',
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
    previewTempo: {
      bpm: 128,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_low_bounce',
        name: 'Low Bounce & Open Step',
        target: {
          leftHand: 4,
          rightHand: 5,
          hip: 10,
          head: null,
        },
      },
      {
        id: 'pat_sky_point',
        name: 'Right Sky Point',
        target: {
          leftHand: 1,
          rightHand: 3,
          hip: null,
          head: null,
        },
      },
    ],
    sequences: [
      {
        id: 'seq_ch1_guide',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [
          {
            id: 'evt_cue_01',
            kind: 'motionCue',
            startTick: 0,
            durationTicks: 16,
            target: { leftHand: 4, rightHand: 5 },
            sourcePatternId: 'pat_low_bounce',
          },
        ],
      },
      {
        id: 'seq_ch1_stars',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'evt_star_01',
            kind: 'starNote',
            landingTick: 4,
            target: {
              type: 'cursor',
              part: 'leftHand',
              zoneId: 4,
            },
            sourcePatternId: 'pat_low_bounce',
          },
          {
            id: 'evt_star_02',
            kind: 'starNote',
            landingTick: 8,
            target: {
              type: 'foot',
              foot: 'leftFoot',
              zoneId: 10,
            },
          },
        ],
      },
      {
        id: 'seq_ch1_hazard_a',
        phase: 'phaseA',
        kind: 'hazard',
        events: [
          {
            id: 'evt_hz_a_01',
            kind: 'phaseAHazard',
            hazardType: 'ground_shock',
          },
        ],
      },
      {
        id: 'seq_ch1_fever_b',
        phase: 'phaseB',
        kind: 'feverNotes',
        events: [
          {
            id: 'evt_fever_01',
            kind: 'feverNote',
            landingTick: 4,
            target: {
              type: 'cursor',
              part: 'rightHand',
              zoneId: 3,
            },
            sourcePatternId: 'pat_sky_point',
          },
        ],
      },
      {
        id: 'seq_ch1_hazard_b',
        phase: 'phaseB',
        kind: 'hazard',
        events: [
          {
            id: 'evt_hz_b_01',
            kind: 'phaseBHazard',
            attackType: 'dual_slam',
          },
        ],
      },
    ],
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseA',
        sequenceId: 'seq_ch1_stars',
      },
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseB',
        sequenceId: 'seq_ch1_fever_b',
      },
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseB',
        sequenceId: 'seq_ch1_hazard_b',
      },
    ],
  };
}

describe('EDITOR-SCHEMA #375: Authoring Project V2 Schema & Validator', () => {
  describe('Envelope and Valid Empty Draft', () => {
    it('validates an empty draft successfully without modifying input', () => {
      const draft = createEmptyEditorProject({
        projectId: 'proj_blank_01',
        title: 'New Blank Draft',
      });
      deepFreeze(draft);

      const result = validateEditorProject(draft);
      expect(result.valid).toBe(true);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates a complete sample project successfully with zero mutations', () => {
      const project = createSampleValidProject();
      deepFreeze(project);

      const result = validateEditorProject(project);
      expect(result.valid).toBe(true);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects non-object, null, or array roots', () => {
      expect(validateEditorProject(null).valid).toBe(false);
      expect(validateEditorProject(undefined).valid).toBe(false);
      expect(validateEditorProject('hello').valid).toBe(false);
      expect(validateEditorProject([]).valid).toBe(false);

      const res = validateEditorProject(null);
      expect(res.errors[0]).toMatchObject({
        code: 'invalid-root',
        path: '$',
        severity: 'error',
      });
    });

    it('rejects wrong kind or unsupported schemaVersion', () => {
      const project = (createSampleValidProject() as unknown) as Record<string, unknown>;
      const badKind = { ...project, kind: 'unknown-editor-project' };
      const resKind = validateEditorProject(badKind);
      expect(resKind.valid).toBe(false);
      expect(resKind.errors.some((e) => e.code === 'invalid-kind')).toBe(true);

      const badVersion = { ...project, schemaVersion: 3 };
      const resVersion = validateEditorProject(badVersion);
      expect(resVersion.valid).toBe(false);
      expect(resVersion.errors.some((e) => e.code === 'invalid-schema-version')).toBe(true);
    });

    it('rejects unsafe non-negative integer revisions, NaNs, and infinities', () => {
      const project = createSampleValidProject();

      const invalidRevisions = [-1, 1.5, NaN, Infinity, -Infinity, '1'];
      for (const rev of invalidRevisions) {
        const testCase = { ...project, revision: rev };
        const result = validateEditorProject(testCase);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === 'invalid-revision')).toBe(true);
      }
    });

    it('rejects missing or empty projectId and rulesetId', () => {
      const p1 = { ...createSampleValidProject(), projectId: '' };
      expect(validateEditorProject(p1).valid).toBe(false);

      const p2 = { ...createSampleValidProject(), rulesetId: '   ' };
      expect(validateEditorProject(p2).valid).toBe(false);
    });

    it('rejects invalid previewTempo (zero/negative bpm, float beatsPerBar)', () => {
      const base = createSampleValidProject();

      const badBpmCases = [0, -10, NaN, Infinity];
      for (const bpm of badBpmCases) {
        const res = validateEditorProject({
          ...base,
          previewTempo: { bpm, beatsPerBar: 4 },
        });
        expect(res.valid).toBe(false);
        expect(res.errors.some((e) => e.code === 'invalid-tempo-bpm')).toBe(true);
      }

      const badBeatsCases = [0, -4, 4.5, NaN, Infinity];
      for (const beatsPerBar of badBeatsCases) {
        const res = validateEditorProject({
          ...base,
          previewTempo: { bpm: 120, beatsPerBar },
        });
        expect(res.valid).toBe(false);
        expect(res.errors.some((e) => e.code === 'invalid-tempo-beats-per-bar')).toBe(true);
      }
    });

    it('rejects unknown root properties (e.g. runtime state, playState, compiledState)', () => {
      const dirty = {
        ...createSampleValidProject(),
        playState: { active: true },
        compiledState: { notes: [] },
      };
      const res = validateEditorProject(dirty);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'unknown-property' && e.path.includes('playState'))).toBe(true);
      expect(res.errors.some((e) => e.code === 'unknown-property' && e.path.includes('compiledState'))).toBe(true);
    });

    it('rejects unknown metadata properties', () => {
      const base = createSampleValidProject();
      const dirty = {
        ...base,
        metadata: {
          ...base.metadata,
          hackedKey: 'inject',
        },
      };
      const res = validateEditorProject(dirty);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'unknown-property' && e.path === '$.metadata.hackedKey')).toBe(true);
    });
  });

  describe('Patterns Integrity', () => {
    it('rejects duplicate pattern IDs', () => {
      const base = createSampleValidProject();
      const dupePatterns = [
        base.patterns[0],
        { ...base.patterns[1], id: base.patterns[0].id },
      ];
      const res = validateEditorProject({ ...base, patterns: dupePatterns });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'duplicate-entity-id' && e.entityId === base.patterns[0].id)).toBe(true);
    });

    it('rejects patterns with invalid zone numbers or prohibited partZoneMap', () => {
      const base = createSampleValidProject();
      const invalidZonePattern = {
        ...base,
        patterns: [
          {
            id: 'pat_bad_zone',
            name: 'Bad Zone',
            target: { leftHand: 99 },
          },
        ],
      };
      const res1 = validateEditorProject(invalidZonePattern);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some((e) => e.code === 'invalid-pattern-zone')).toBe(true);

      const partZoneMapPattern = {
        ...base,
        patterns: [
          {
            id: 'pat_has_map',
            name: 'Has Map',
            target: { leftHand: 4 },
            partZoneMap: { leftHand: 4 },
          },
        ],
      };
      const res2 = validateEditorProject(partZoneMapPattern);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some((e) => e.code === 'unknown-property')).toBe(true);
    });
  });

  describe('Sequences and Phase-Kind Separation', () => {
    it('rejects phaseA sequence declaring kind feverNotes', () => {
      const base = createSampleValidProject();
      const badSeq = {
        id: 'seq_bad_phase_a',
        phase: 'phaseA',
        kind: 'feverNotes',
        events: [],
      };
      const res = validateEditorProject({ ...base, sequences: [badSeq as any] });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'phase-sequence-mismatch')).toBe(true);
    });

    it('rejects phaseB sequence declaring kind starNotes', () => {
      const base = createSampleValidProject();
      const badSeq = {
        id: 'seq_bad_phase_b',
        phase: 'phaseB',
        kind: 'starNotes',
        events: [],
      };
      const res = validateEditorProject({ ...base, sequences: [badSeq as any] });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'phase-sequence-mismatch')).toBe(true);
    });

    it('rejects duplicate sequence IDs', () => {
      const base = createSampleValidProject();
      const dupeSequences = [
        base.sequences[0],
        { ...base.sequences[1], id: base.sequences[0].id },
      ];
      const res = validateEditorProject({ ...base, sequences: dupeSequences });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'duplicate-entity-id' && e.entityId === base.sequences[0].id)).toBe(true);
    });

    it('rejects entity ID collision across patterns, sequences, and events', () => {
      const base = createSampleValidProject();
      const collisionProject = {
        ...base,
        sequences: [
          {
            ...base.sequences[0],
            id: base.patterns[0].id,
          },
        ],
      };
      const res = validateEditorProject(collisionProject);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'duplicate-entity-id' && e.entityId === base.patterns[0].id)).toBe(true);
    });
  });

  describe('Event Validation and Phase-Event Matching', () => {
    it('rejects phase-event mismatch (e.g. hazard event inside motionGuide sequence)', () => {
      const base = createSampleValidProject();
      const badGuide = {
        id: 'seq_bad_guide',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [
          {
            id: 'evt_hz_in_guide',
            kind: 'phaseAHazard',
            hazardType: 'ground_shock',
          },
        ],
      };
      const res = validateEditorProject({ ...base, sequences: [badGuide as any] });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'phase-event-mismatch')).toBe(true);
    });

    it('rejects phaseAHazard event inside phaseB hazard sequence', () => {
      const base = createSampleValidProject();
      const badHazardB = {
        id: 'seq_bad_hazard_b',
        phase: 'phaseB',
        kind: 'hazard',
        events: [
          {
            id: 'evt_a_in_b',
            kind: 'phaseAHazard',
            hazardType: 'ground_shock',
          },
        ],
      };
      const res = validateEditorProject({ ...base, sequences: [badHazardB as any] });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'phase-event-mismatch')).toBe(true);
    });

    it('rejects unsafe integer ticks (NaN, float, negative) in cues and notes', () => {
      const base = createSampleValidProject();
      const badTicks = [-1, 2.5, NaN, Infinity];

      for (const tick of badTicks) {
        const testProj = {
          ...base,
          sequences: [
            {
              id: 'seq_tick_test',
              phase: 'phaseA',
              kind: 'starNotes',
              events: [
                {
                  id: 'evt_test_tick',
                  kind: 'starNote',
                  landingTick: tick,
                  target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
                },
              ],
            },
          ],
        };
        const res = validateEditorProject(testProj);
        expect(res.valid).toBe(false);
        expect(res.errors.some((e) => e.code === 'invalid-event-tick')).toBe(true);
      }
    });

    it('validates cursor target vs foot target strictly', () => {
      const base = createSampleValidProject();

      // Foot target with invalid zone (e.g. zone 4, not in 9..11)
      const invalidFoot = {
        ...base,
        sequences: [
          {
            id: 'seq_bad_foot',
            phase: 'phaseA',
            kind: 'starNotes',
            events: [
              {
                id: 'evt_bad_foot_zone',
                kind: 'starNote',
                landingTick: 4,
                target: {
                  type: 'foot',
                  foot: 'leftFoot',
                  zoneId: 4, // invalid for foot!
                },
              },
            ],
          },
        ],
      };
      const res1 = validateEditorProject(invalidFoot);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some((e) => e.code === 'invalid-foot-zone')).toBe(true);

      // Cursor target with invalid zone (<1 or >11)
      const invalidCursor = {
        ...base,
        sequences: [
          {
            id: 'seq_bad_cursor',
            phase: 'phaseA',
            kind: 'starNotes',
            events: [
              {
                id: 'evt_bad_cursor_zone',
                kind: 'starNote',
                landingTick: 4,
                target: {
                  type: 'cursor',
                  part: 'leftHand',
                  zoneId: 15,
                },
              },
            ],
          },
        ],
      };
      const res2 = validateEditorProject(invalidCursor);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some((e) => e.code === 'invalid-cursor-zone')).toBe(true);
    });

    it('rejects free runtime execution fields on hazard events (no damage or customDuration)', () => {
      const base = createSampleValidProject();
      const dirtyHazard = {
        ...base,
        sequences: [
          {
            id: 'seq_dirty_hazard',
            phase: 'phaseA',
            kind: 'hazard',
            events: [
              {
                id: 'evt_hz_dirty',
                kind: 'phaseAHazard',
                hazardType: 'ground_shock',
                damage: 50,
                duration: 2000,
              },
            ],
          },
        ],
      };
      const res = validateEditorProject(dirtyHazard);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'unknown-property' && e.path.includes('damage'))).toBe(true);
    });
  });

  describe('Referential Integrity (sourcePatternId & sequenceId)', () => {
    it('rejects broken sourcePatternId reference', () => {
      const base = createSampleValidProject();
      const brokenRefProj = {
        ...base,
        sequences: [
          {
            id: 'seq_broken_ref',
            phase: 'phaseA',
            kind: 'motionGuide',
            events: [
              {
                id: 'evt_broken_ref',
                kind: 'motionCue',
                startTick: 0,
                durationTicks: 4,
                target: { leftHand: 4 },
                sourcePatternId: 'non_existent_pattern_id',
              },
            ],
          },
        ],
      };
      const res = validateEditorProject(brokenRefProj);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'broken-pattern-reference' && e.entityId === 'non_existent_pattern_id')).toBe(true);
    });

    it('rejects broken sequenceId reference in bindings', () => {
      const base = createSampleValidProject();
      const brokenBindingProj = {
        ...base,
        bindings: [
          {
            chapterId: 'ch1',
            subLevelId: null,
            phase: 'phaseA' as const,
            sequenceId: 'missing_sequence_id',
          },
        ],
      };
      const res = validateEditorProject(brokenBindingProj);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'broken-sequence-reference' && e.entityId === 'missing_sequence_id')).toBe(true);
    });
  });

  describe('Bindings Compound Key Integrity', () => {
    it('allows Phase B stars (feverNotes) and hazard coexistence under the same chapter and subLevel', () => {
      const base = createSampleValidProject();
      // base has both feverNotes and hazard for (ch1, null, phaseB)
      const res = validateEditorProject(base);
      expect(res.valid).toBe(true);
    });

    it('rejects duplicate bindings targeting the same role for the same chapter/subLevel/phase', () => {
      const base = createSampleValidProject();
      const dupeBindingProj = {
        ...base,
        bindings: [
          ...base.bindings,
          {
            chapterId: 'ch1',
            subLevelId: null,
            phase: 'phaseB' as const,
            sequenceId: 'seq_ch1_fever_b', // duplicate role for (ch1, null, phaseB)
          },
        ],
      };
      const res = validateEditorProject(dupeBindingProj);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'duplicate-binding')).toBe(true);
    });

    it('distinguishes subLevelId: null from specific subLevelId', () => {
      const base = createSampleValidProject();
      const distinctSubLevelProj = {
        ...base,
        bindings: [
          {
            chapterId: 'ch1',
            subLevelId: null,
            phase: 'phaseA' as const,
            sequenceId: 'seq_ch1_stars',
          },
          {
            chapterId: 'ch1',
            subLevelId: 'level_1_boss',
            phase: 'phaseA' as const,
            sequenceId: 'seq_ch1_stars',
          },
        ],
      };
      const res = validateEditorProject(distinctSubLevelProj);
      expect(res.valid).toBe(true);
    });
  });
});
