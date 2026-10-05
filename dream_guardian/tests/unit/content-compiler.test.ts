import { describe, expect, it } from 'vitest';
import {
  canonicalizeContentJson,
  computeContentHash,
  sha256Hex,
} from '../../src/data/ContentCanonical.js';
import {
  PUBLISHED_PACK_KIND,
  validatePublishedContentPack,
  type PublishedContentPack,
} from '../../src/data/PublishedContentPack.js';
import {
  compileEditorProject,
  type CompileOptions,
} from '../../src/data/ContentCompiler.js';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../../src/data/EditorProject.js';
import { DEFAULT_RULESET_ID } from '../../src/data/ContentCapabilities.js';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze((obj as Record<string, unknown>)[key]);
  }
  return obj;
}

function createValidPublishableProject(): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId: 'proj_publish_test_01',
    revision: 1,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: 'Chapter 1 Dance Groove',
      description: 'Ch1 test routine',
      author: 'Tester',
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T01:00:00.000Z',
    },
    previewTempo: {
      bpm: 120,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_hand_tap',
        name: 'Hand Tap',
        target: {
          leftHand: 1,
          rightHand: 5,
          head: null,
          hip: null,
        },
      },
      {
        id: 'pat_step_left',
        name: 'Left Foot Step',
        target: {
          leftHand: null,
          rightHand: null,
          head: null,
          hip: 9,
        },
      },
    ],
    sequences: [
      {
        id: 'seq_ch1_stars',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'evt_s1',
            kind: 'starNote',
            landingTick: 960,
            target: { type: 'cursor', part: 'leftHand', zoneId: 1 },
            sourcePatternId: 'pat_hand_tap',
          },
          {
            id: 'evt_s2',
            kind: 'starNote',
            landingTick: 1440,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_hand_tap',
          },
          {
            id: 'evt_s3',
            kind: 'starNote',
            landingTick: 1920,
            target: { type: 'foot', foot: 'leftFoot', zoneId: 9 },
            sourcePatternId: 'pat_step_left',
          },
          {
            id: 'evt_s4',
            kind: 'starNote',
            landingTick: 2400,
            target: { type: 'cursor', part: 'leftHand', zoneId: 2 },
          },
          {
            id: 'evt_s5',
            kind: 'starNote',
            landingTick: 2880,
            target: { type: 'cursor', part: 'rightHand', zoneId: 3 },
          },
          {
            id: 'evt_s6',
            kind: 'starNote',
            landingTick: 3360,
            target: { type: 'foot', foot: 'rightFoot', zoneId: 11 },
          },
          {
            id: 'evt_s7',
            kind: 'starNote',
            landingTick: 3840,
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
          },
        ],
      },
      {
        id: 'seq_ch1_hazard_a',
        phase: 'phaseA',
        kind: 'hazard',
        events: [
          {
            id: 'evt_hz_a',
            kind: 'phaseAHazard',
            hazardType: 'left_step',
          },
        ],
      },
      {
        id: 'seq_ch1_fever_b',
        phase: 'phaseB',
        kind: 'feverNotes',
        events: [
          {
            id: 'evt_fever_1',
            kind: 'feverNote',
            landingTick: 480,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_hand_tap',
          },
        ],
      },
      {
        id: 'seq_ch1_hazard_b',
        phase: 'phaseB',
        kind: 'hazard',
        events: [
          {
            id: 'evt_hz_b',
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
        phase: 'phaseA',
        sequenceId: 'seq_ch1_hazard_a',
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

describe('EDITOR-COMPILE (#377): ContentCanonical pure canonical JSON and SHA-256', () => {
  it('recursively sorts object keys and normalizes numbers', () => {
    const input = {
      z: 10,
      a: {
        d: 4,
        c: -0,
      },
      arr: [{ y: 2, x: 1 }],
    };
    const canonical = canonicalizeContentJson(input);
    expect(canonical).toBe('{"a":{"c":0,"d":4},"arr":[{"x":1,"y":2}],"z":10}');
  });

  it('preserves array order while recursively canonicalizing elements', () => {
    const arr = [
      { b: 2, a: 1 },
      { d: 4, c: 3 },
    ];
    expect(canonicalizeContentJson(arr)).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
  });

  it('rejects non-finite numbers like NaN and Infinity', () => {
    expect(() => canonicalizeContentJson({ val: NaN })).toThrow(TypeError);
    expect(() => canonicalizeContentJson({ val: Infinity })).toThrow(TypeError);
  });

  it('computes standard SHA-256 hex string deterministically', () => {
    const emptyHash = sha256Hex('');
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    const helloHash = sha256Hex('hello world');
    expect(helloHash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');

    const objHash1 = computeContentHash({ foo: 'bar', baz: 123 });
    const objHash2 = computeContentHash({ baz: 123, foo: 'bar' });
    expect(objHash1).toBe(objHash2);
  });
});

describe('EDITOR-COMPILE (#377): Deterministic Compilation & Immutability', () => {
  it('compiles a valid project deterministically with identical contentHash', () => {
    const project = createValidPublishableProject();
    deepFreeze(project);

    const result1 = compileEditorProject(project);
    const result2 = compileEditorProject(project);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.ok).toBe(true);
    expect(result1.contentHash).toBe(result2.contentHash);
    expect(result1.pack!.contentHash).toBe(result1.contentHash);
    expect(result1.pack!.kind).toBe(PUBLISHED_PACK_KIND);
  });

  it('guarantees zero mutations on input EditorProject', () => {
    const project = createValidPublishableProject();
    deepFreeze(project);

    expect(() => compileEditorProject(project)).not.toThrow();
  });

  it('preserves meaningful event orders sorted by landingTick', () => {
    const project = createValidPublishableProject();
    // Intentionally shuffle star events in authoring sequence
    const starSeq = project.sequences.find((s) => s.id === 'seq_ch1_stars')!;
    const reversedEvents = [...starSeq.events].reverse();
    const shuffledProject = {
      ...project,
      sequences: project.sequences.map((s) =>
        s.id === 'seq_ch1_stars' ? { ...s, events: reversedEvents } : s,
      ),
    };

    const result = compileEditorProject(shuffledProject);
    expect(result.success).toBe(true);

    const stage = result.pack!.stages['ch1'];
    expect(stage).toBeDefined();
    expect(stage.phaseA?.starNotes).toHaveLength(7);
    const ticks = stage.phaseA?.starNotes?.map((n) => n.landingTick);
    expect(ticks).toEqual([960, 1440, 1920, 2400, 2880, 3360, 3840]);
  });
});

describe('EDITOR-COMPILE (#377): ContentHash Exclusions (UI Selection & Timestamps)', () => {
  it('excludes authoring timestamps and compiledAt timestamp from contentHash calculation', () => {
    const projectA = createValidPublishableProject();
    const projectB = createValidPublishableProject();

    projectB.metadata.createdAt = '2026-01-01T00:00:00.000Z';
    projectB.metadata.updatedAt = '2026-12-31T23:59:59.000Z';

    const optionsA: CompileOptions = { compiledAt: '2026-10-05T10:00:00.000Z' };
    const optionsB: CompileOptions = { compiledAt: '2026-10-06T15:30:00.000Z' };

    const resultA = compileEditorProject(projectA, optionsA);
    const resultB = compileEditorProject(projectB, optionsB);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(resultA.contentHash).toBe(resultB.contentHash);
  });

  it('excludes transient editor UI selection state from contentHash', () => {
    const project = createValidPublishableProject();
    const resultNoUi = compileEditorProject(project);
    const resultWithUi = compileEditorProject(project, {
      editorUiSelection: { selectedSequenceId: 'seq_ch1_stars', selectedEventId: 'evt_s1' },
    });

    expect(resultNoUi.success).toBe(true);
    expect(resultWithUi.success).toBe(true);
    expect(resultNoUi.contentHash).toBe(resultWithUi.contentHash);
  });
});

  describe('EDITOR-COMPILE (#377): Validation & Tamper Detection', () => {
  it('validates a compiled pack successfully', () => {
    const project = createValidPublishableProject();
    const result = compileEditorProject(project);
    expect(result.success).toBe(true);

    const validation = validatePublishedContentPack(result.pack!);
    expect(validation.valid).toBe(true);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('detects tampering with stage event values', () => {
    const project = createValidPublishableProject();
    const result = compileEditorProject(project);
    expect(result.success).toBe(true);

    const tamperedPack = JSON.parse(JSON.stringify(result.pack!)) as PublishedContentPack;
    // Alter a zoneId in stage phaseA star note
    tamperedPack.stages['ch1'].phaseA!.starNotes![0].target.zoneId = 5;

    const validation = validatePublishedContentPack(tamperedPack);
    expect(validation.valid).toBe(false);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.code === 'tampered-content-hash')).toBe(true);
  });

  it('rejects version, ruleset, or source revision tampering', () => {
    const project = createValidPublishableProject();
    const result = compileEditorProject(project);
    expect(result.success).toBe(true);

    const tamperedPack = JSON.parse(JSON.stringify(result.pack!)) as PublishedContentPack;
    tamperedPack.sourceRevision = 999;

    const validation = validatePublishedContentPack(tamperedPack);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'tampered-content-hash')).toBe(true);
  });

  it('rejects unsupported runtime contract version or invalid kind', () => {
    const project = createValidPublishableProject();
    const result = compileEditorProject(project);
    expect(result.success).toBe(true);

    const invalidKind = { ...result.pack!, kind: 'invalid-kind' };
    const valKind = validatePublishedContentPack(invalidKind);
    expect(valKind.valid).toBe(false);
    expect(valKind.errors.some((e) => e.code === 'invalid-pack-kind')).toBe(true);

    const invalidVer = { ...result.pack!, runtimeContractVersion: '99.0.0' };
    const valVer = validatePublishedContentPack(invalidVer);
    expect(valVer.valid).toBe(false);
    expect(valVer.errors.some((e) => e.code === 'unsupported-runtime-version')).toBe(true);
  });
});

describe('EDITOR-COMPILE (#377): Non-Publishable Capabilities Rejection', () => {
  it('rejects unsupported BPM (e.g. 128) with diagnostic path previewTempo.bpm', () => {
    const project = createValidPublishableProject();
    project.previewTempo.bpm = 128; // not in [110, 115, 120, 125, 135, 140]

    const result = compileEditorProject(project);
    expect(result.success).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.pack).toBeNull();
    expect(result.errors.some((e) => e.code === 'unsupported-bpm' && e.path === 'previewTempo.bpm')).toBe(true);
  });

  it('rejects non-publishable head or hip cursor star targets', () => {
    const projectHead = createValidPublishableProject();
    projectHead.sequences[0].events[0] = {
      id: 'evt_head',
      kind: 'starNote',
      landingTick: 960,
      target: { type: 'cursor', part: 'head', zoneId: 4 },
    };

    const resHead = compileEditorProject(projectHead);
    expect(resHead.success).toBe(false);
    expect(resHead.errors.some((e) => e.code === 'non-publishable-star-target')).toBe(true);

    const projectHip = createValidPublishableProject();
    projectHip.sequences[0].events[0] = {
      id: 'evt_hip_cursor',
      kind: 'starNote',
      landingTick: 960,
      target: { type: 'cursor', part: 'hip', zoneId: 10 },
    };

    const resHip = compileEditorProject(projectHip);
    expect(resHip.success).toBe(false);
    expect(resHip.errors.some((e) => e.code === 'non-publishable-star-target')).toBe(true);
  });

  it('rejects unaligned landing tick not belonging to the 7 fixed slots', () => {
    const project = createValidPublishableProject();
    project.sequences[0].events[0] = {
      id: 'evt_bad_tick',
      kind: 'starNote',
      landingTick: 1000, // not in [960, 1440, 1920, 2400, 2880, 3360, 3840]
      target: { type: 'cursor', part: 'leftHand', zoneId: 1 },
    };

    const result = compileEditorProject(project);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid-slot-tick')).toBe(true);
  });

  it('rejects non-publishable hazard patterns (e.g. balance_left)', () => {
    const project = createValidPublishableProject();
    const hazardSeq = project.sequences.find((s) => s.id === 'seq_ch1_hazard_a')!;
    hazardSeq.events = [
      {
        id: 'evt_balance',
        kind: 'phaseAHazard',
        hazardType: 'balance_left',
      },
    ];

    const result = compileEditorProject(project);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'non-publishable-hazard-pattern')).toBe(true);
  });

  it('rejects cross-body violation (e.g. left hand in Zone 3)', () => {
    const project = createValidPublishableProject();
    project.sequences[0].events[0] = {
      id: 'evt_cross_body',
      kind: 'starNote',
      landingTick: 960,
      target: { type: 'cursor', part: 'leftHand', zoneId: 3 }, // Left hand cannot reach zone 3
    };

    const result = compileEditorProject(project);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'cross-body-violation')).toBe(true);
  });

  it('rejects unsafe consecutive transition between star notes with same part', () => {
    const project = createValidPublishableProject();
    // Consecutive leftHand in zone 1 at landingTick 960 and 1440
    project.sequences[0].events[0] = {
      id: 'evt_s1',
      kind: 'starNote',
      landingTick: 960,
      target: { type: 'cursor', part: 'leftHand', zoneId: 1 },
    };
    project.sequences[0].events[1] = {
      id: 'evt_s2',
      kind: 'starNote',
      landingTick: 1440,
      target: { type: 'cursor', part: 'leftHand', zoneId: 1 },
    };

    const result = compileEditorProject(project);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'unsafe-transition')).toBe(true);
  });

  it('rejects ruleset mismatch when expectedRulesetId does not match', () => {
    const project = createValidPublishableProject();
    const result = compileEditorProject(project, { expectedRulesetId: 'some-other-ruleset' });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'ruleset-mismatch')).toBe(true);
  });
});

describe('EDITOR-COMPILE (#377): Stage Coverage & Versioned Builtin Profiles', () => {
  it('rejects missing required stage when unedited stage has no explicit builtin profile', () => {
    const project = createValidPublishableProject();
    // ch1 is defined, but ch2 is required and missing
    const options: CompileOptions = {
      requiredStages: ['ch1', 'ch2'],
    };

    const result = compileEditorProject(project, options);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing-stage-coverage' && e.path === 'stages[ch2]')).toBe(true);
  });

  it('compiles unedited required stages with explicit versioned builtin profiles', () => {
    const project = createValidPublishableProject();
    const options: CompileOptions = {
      requiredStages: ['ch1', 'ch2'],
      builtinProfiles: {
        ch2: 'ch2-default-v2',
      },
    };

    const result = compileEditorProject(project, options);
    expect(result.success).toBe(true);
    expect(result.pack!.stages['ch1']).toBeDefined();
    expect(result.pack!.stages['ch2']).toBeDefined();
    expect(result.pack!.stages['ch2'].builtinProfile).toBe('ch2-default-v2');

    const validation = validatePublishedContentPack(result.pack!);
    expect(validation.valid).toBe(true);
  });
});

describe('EDITOR-COMPILE (#377): Phase B Multi-Role Coexistence & Self-Contained Expansion', () => {
  it('compiles Phase B with both feverNotes and hazards, expanding source pattern references', () => {
    const project = createValidPublishableProject();
    const result = compileEditorProject(project);

    expect(result.success).toBe(true);
    const stage = result.pack!.stages['ch1'];
    expect(stage.phaseB).toBeDefined();
    expect(stage.phaseB?.feverNotes).toHaveLength(1);
    expect(stage.phaseB?.hazards).toHaveLength(1);

    // Self-contained expansion: no template lookup needed
    const feverNote = stage.phaseB?.feverNotes?.[0];
    expect(feverNote).toBeDefined();
    expect(feverNote?.target).toEqual({
      type: 'cursor',
      part: 'rightHand',
      zoneId: 5,
      instrument: 'hand',
    });
    expect(feverNote?.resolvedPartZoneMap).toEqual({
      leftHand: 1,
      rightHand: 5,
    });

    const hazardB = stage.phaseB?.hazards?.[0];
    expect(hazardB).toBeDefined();
    expect(hazardB?.attackType).toBe('dual_slam');
    expect(hazardB?.requiredAction).toBe('jump');
  });
});
