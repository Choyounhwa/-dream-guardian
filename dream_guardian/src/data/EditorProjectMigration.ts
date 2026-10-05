/**
 * EditorProjectMigration.ts - V1 에디터 패키지 → V2 저작 프로젝트 무손실 변환
 *
 * Issue #378 / EDITOR-MIGRATE:
 * - 순수 함수 migrateV1ProjectToV2(v1Input, options): MigrationResult<EditorProject>
 * - V1 패키지 감지 (version: '1.0.0' 또는 V1 시퀀스/패턴 구조)
 * - STAR_COLLECT 2~8 표시 박을 상대 1~7박(480..3360 tick)으로 정확히 변환
 * - 2.5박 등 비정규 박자는 자동 반올림 금지, 720 tick 원본 보존 및 호환성 경고(warning) 플래그
 * - FEVER_PHASE_B 16박을 BOSS_CLIMAX 8노트로 자동 치환하지 않고 Phase B motionGuide로 보존
 * - RUN_QUESTION 및 ANSWER_SELECT를 Phase A motionGuide로 적절히 변환
 * - 누락된 시퀀스를 현재 프로젝트 기본값으로 임의로 채우지 않고 진단(warning/info) 보고
 * - 원본 입력 데이터 불변성 보장 (mutation 0회)
 * - 결정적 ID 충돌 처리 및 sourcePatternId 참조 remap
 */

import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorBinding,
  type EditorPattern,
  type EditorPatternTarget,
  type EditorProject,
  type EditorSequence,
  type MotionCueEvent,
  type StarNoteEvent,
  type StarNoteTarget,
} from './EditorProject.js';
import { validateEditorProject } from './ProjectValidator.js';
import type { MigrationDiagnostic } from './PatternLibraryMigration.js';

export { type MigrationDiagnostic };

export interface MigrationOptions {
  projectId?: string;
  rulesetId?: string;
  title?: string;
  author?: string;
  idConflictPolicy?: 'rename' | 'fail';
}

export interface MigrationResult<T = EditorProject> {
  success: boolean;
  project?: T;
  data?: T;
  errors: string[];
  warnings: string[];
  diagnostics: MigrationDiagnostic[];
  idRemap?: Record<string, string>;
}

const STANDARD_STAR_SLOT_TICKS = new Set([480, 960, 1440, 1920, 2400, 2880, 3360]);

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * V1 프로젝트 패키지를 V2 Authoring EditorProject로 순수 변환
 */
export function migrateV1ProjectToV2(
  v1Input: unknown,
  options?: MigrationOptions,
): MigrationResult<EditorProject> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const diagnostics: MigrationDiagnostic[] = [];
  const idRemap: Record<string, string> = {};

  // 1. Input format & version validation
  if (!isObject(v1Input)) {
    const msg = 'V1 project input must be a non-null object';
    errors.push(msg);
    diagnostics.push({ code: 'invalid-input-type', message: msg, severity: 'error' });
    return {
      success: false,
      errors,
      warnings,
      diagnostics,
      idRemap,
    };
  }

  // Pass-through if already valid V2 project
  if (
    v1Input.kind === AUTHORING_PROJECT_KIND &&
    v1Input.schemaVersion === AUTHORING_SCHEMA_VERSION
  ) {
    const cloned = JSON.parse(JSON.stringify(v1Input)) as EditorProject;
    return {
      success: true,
      project: cloned,
      data: cloned,
      errors: [],
      warnings: [],
      diagnostics: [],
      idRemap: {},
    };
  }

  // Check version string if present
  if ('version' in v1Input) {
    if (typeof v1Input.version !== 'string' || !v1Input.version.startsWith('1.')) {
      const msg = `Unsupported or unknown package version "${String(v1Input.version)}". Only V1.x packages can be migrated.`;
      errors.push(msg);
      diagnostics.push({ code: 'unsupported-version', message: msg, severity: 'error' });
      return {
        success: false,
        errors,
        warnings,
        diagnostics,
        idRemap,
      };
    }
  }

  // Check patterns shape
  if ('patterns' in v1Input && !Array.isArray(v1Input.patterns)) {
    const msg = 'V1 project "patterns" property must be an array';
    errors.push(msg);
    diagnostics.push({ code: 'invalid-patterns-field', message: msg, severity: 'error' });
    return {
      success: false,
      errors,
      warnings,
      diagnostics,
      idRemap,
    };
  }

  // Check sequences shape
  if ('sequences' in v1Input && (!isObject(v1Input.sequences) || Array.isArray(v1Input.sequences))) {
    const msg = 'V1 project "sequences" property must be an object';
    errors.push(msg);
    diagnostics.push({ code: 'invalid-sequences-field', message: msg, severity: 'error' });
    return {
      success: false,
      errors,
      warnings,
      diagnostics,
      idRemap,
    };
  }

  // 2. Patterns migration & ID deduplication
  const rawPatterns = Array.isArray(v1Input.patterns) ? v1Input.patterns : [];
  const migratedPatterns: EditorPattern[] = [];
  const seenPatternIds = new Set<string>();

  for (let i = 0; i < rawPatterns.length; i++) {
    const p = rawPatterns[i];
    if (!isObject(p)) continue;

    const origId = typeof p.id === 'string' && p.id.trim().length > 0 ? p.id.trim() : `pat_${i + 1}`;
    let finalId = origId;

    if (seenPatternIds.has(origId)) {
      if (options?.idConflictPolicy === 'fail') {
        const msg = `Pattern ID conflict detected for "${origId}"`;
        errors.push(msg);
        diagnostics.push({
          code: 'pattern-id-conflict',
          message: msg,
          severity: 'error',
          entityId: origId,
        });
        continue;
      }

      // Conflict resolution
      let suffix = 1;
      let candidate = `${origId}_copy`;
      while (seenPatternIds.has(candidate)) {
        suffix++;
        candidate = `${origId}_copy_${suffix}`;
      }
      finalId = candidate;
      idRemap[origId] = finalId;
      diagnostics.push({
        code: 'pattern-id-conflict-renamed',
        message: `Pattern ID conflict for "${origId}"; renamed to "${finalId}"`,
        severity: 'info',
        entityId: finalId,
      });
    } else {
      idRemap[origId] = origId;
    }
    seenPatternIds.add(finalId);

    // Target extraction
    const parseZone = (v: unknown): number | null => {
      if (v === null || v === undefined || v === 'X' || v === 'x') return null;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : null;
    };

    let target: EditorPatternTarget = {
      leftHand: null,
      rightHand: null,
      head: null,
      hip: null,
    };

    if (isObject(p.target)) {
      target = {
        leftHand: parseZone(p.target.leftHand),
        rightHand: parseZone(p.target.rightHand),
        head: parseZone(p.target.head),
        hip: parseZone(p.target.hip),
      };
    } else {
      target = {
        leftHand: parseZone(p.leftHand),
        rightHand: parseZone(p.rightHand),
        head: parseZone(p.head),
        hip: parseZone(p.hip),
      };
    }

    const name = typeof p.name === 'string' && p.name.trim().length > 0 ? p.name.trim() : finalId;
    const description = typeof p.description === 'string' ? p.description : undefined;

    migratedPatterns.push({
      id: finalId,
      name,
      target,
      ...(description !== undefined ? { description } : {}),
    });
  }

  // 3. Sequences migration
  const rawSequences = isObject(v1Input.sequences) ? v1Input.sequences : {};
  const migratedSequences: EditorSequence[] = [];
  const migratedBindings: EditorBinding[] = [];
  const seenEventIds = new Set<string>();

  function getUniqueEventId(rawId: unknown, fallbackPrefix: string): string {
    let id = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : `${fallbackPrefix}_${seenEventIds.size + 1}`;
    if (seenEventIds.has(id)) {
      let suffix = 2;
      let candidate = `${id}_copy`;
      while (seenEventIds.has(candidate)) {
        candidate = `${id}_copy_${suffix}`;
        suffix++;
      }
      id = candidate;
    }
    seenEventIds.add(id);
    return id;
  }

  // A. STAR_COLLECT -> Phase A starNotes
  if (Array.isArray(rawSequences.STAR_COLLECT)) {
    const starEvents: StarNoteEvent[] = [];

    for (let idx = 0; idx < rawSequences.STAR_COLLECT.length; idx++) {
      const note = rawSequences.STAR_COLLECT[idx];
      if (!isObject(note)) continue;

      const rawBeat = typeof note.startBeat === 'number' ? note.startBeat : (typeof note.beat === 'number' ? note.beat : 2);
      // Display beats 2..8 -> relative 1..7 -> ticks (beat - 1) * 480
      // 2.5 beat -> (2.5 - 1) * 480 = 720 tick exactly preserved
      const landingTick = (rawBeat - 1) * 480;

      if (!STANDARD_STAR_SLOT_TICKS.has(landingTick)) {
        const warnMsg = `Star note "${String(note.id ?? idx)}" at landingTick ${landingTick} (display beat ${rawBeat}) does not align to standard 7-star slot ticks`;
        warnings.push(warnMsg);
        diagnostics.push({
          code: 'non-slot-star-tick',
          message: warnMsg,
          severity: 'warning',
          path: `sequences.STAR_COLLECT[${idx}].startBeat`,
          entityId: typeof note.id === 'string' ? note.id : undefined,
        });
      }

      // Target mapping
      let target: StarNoteTarget;
      if (isObject(note.target) && (note.target.type === 'cursor' || note.target.type === 'foot')) {
        target = JSON.parse(JSON.stringify(note.target)) as StarNoteTarget;
      } else {
        const payload = isObject(note.payload) ? note.payload : {};
        const instrument = payload.instrument ?? note.instrument;
        const part = payload.part ?? note.part;
        const targetZones = Array.isArray(note.targetZones) ? note.targetZones : [];
        const rawZone = typeof targetZones[0] === 'number' ? targetZones[0] : (typeof note.zoneId === 'number' ? note.zoneId : 4);

        if (instrument === 'foot' || (part === 'hip' && [9, 10, 11].includes(rawZone)) || [9, 10, 11].includes(rawZone)) {
          const zoneId = (rawZone === 9 || rawZone === 10 || rawZone === 11 ? rawZone : 10) as 9 | 10 | 11;
          const foot = zoneId === 9 ? 'leftFoot' : zoneId === 11 ? 'rightFoot' : 'centerFoot';
          target = { type: 'foot', foot, zoneId };
        } else {
          const cursorPart = (['leftHand', 'rightHand', 'head', 'hip'].includes(String(part)) ? part : 'leftHand') as 'leftHand' | 'rightHand' | 'head' | 'hip';
          target = { type: 'cursor', part: cursorPart, zoneId: rawZone };
        }
      }

      const payload = isObject(note.payload) ? note.payload : {};
      const rawPatternId = typeof payload.patternId === 'string' ? payload.patternId : (typeof note.patternId === 'string' ? note.patternId : (typeof note.sourcePatternId === 'string' ? note.sourcePatternId : undefined));
      const sourcePatternId = rawPatternId ? (idRemap[rawPatternId] ?? rawPatternId) : undefined;

      const starEvt: StarNoteEvent = {
        id: getUniqueEventId(note.id, 'evt_star'),
        kind: 'starNote',
        landingTick,
        target,
      };

      if (sourcePatternId && seenPatternIds.has(sourcePatternId)) {
        starEvt.sourcePatternId = sourcePatternId;
      }

      starEvents.push(starEvt);
    }

    migratedSequences.push({
      id: 'seq_star_collect',
      name: 'Phase A Star Notes',
      phase: 'phaseA',
      kind: 'starNotes',
      events: starEvents,
    });

    migratedBindings.push({
      chapterId: 'ch1',
      subLevelId: null,
      phase: 'phaseA',
      sequenceId: 'seq_star_collect',
      role: 'starNotes',
    });
  } else {
    diagnostics.push({
      code: 'missing-sequence',
      message: 'Sequence "STAR_COLLECT" was omitted in V1 input; no default inserted.',
      severity: 'info',
    });
  }

  // B. FEVER_PHASE_B -> Phase B motionGuide (16-beat guide preserved, NOT automatically rewritten to BOSS_CLIMAX 8-notes)
  if (Array.isArray(rawSequences.FEVER_PHASE_B)) {
    const feverEvents: MotionCueEvent[] = [];

    for (let idx = 0; idx < rawSequences.FEVER_PHASE_B.length; idx++) {
      const note = rawSequences.FEVER_PHASE_B[idx];
      if (!isObject(note)) continue;

      const startBeat = typeof note.startBeat === 'number' ? note.startBeat : 1;
      const durationBeats = typeof note.durationBeats === 'number' ? note.durationBeats : 4;
      const startTick = (startBeat - 1) * 480;
      const durationTicks = durationBeats * 480;

      const payload = isObject(note.payload) ? note.payload : {};
      const rawPatternId = typeof payload.patternId === 'string' ? payload.patternId : (typeof note.patternId === 'string' ? note.patternId : (typeof note.sourcePatternId === 'string' ? note.sourcePatternId : undefined));
      const sourcePatternId = rawPatternId ? (idRemap[rawPatternId] ?? rawPatternId) : undefined;

      const cue: MotionCueEvent = {
        id: getUniqueEventId(note.id, 'evt_fever_cue'),
        kind: 'motionCue',
        startTick,
        durationTicks,
      };

      if (sourcePatternId && seenPatternIds.has(sourcePatternId)) {
        cue.sourcePatternId = sourcePatternId;
      }

      feverEvents.push(cue);
    }

    migratedSequences.push({
      id: 'seq_fever_phase_b',
      name: 'Phase B Motion Guide (Fever)',
      phase: 'phaseB',
      kind: 'motionGuide',
      events: feverEvents,
    });

    migratedBindings.push({
      chapterId: 'ch1',
      subLevelId: null,
      phase: 'phaseB',
      sequenceId: 'seq_fever_phase_b',
      role: 'motionGuide',
    });
  } else {
    diagnostics.push({
      code: 'missing-sequence',
      message: 'Sequence "FEVER_PHASE_B" was omitted in V1 input; no default inserted.',
      severity: 'info',
    });
  }

  // C. RUN_QUESTION -> Phase A motionGuide
  if (Array.isArray(rawSequences.RUN_QUESTION)) {
    const runEvents: MotionCueEvent[] = [];

    for (let idx = 0; idx < rawSequences.RUN_QUESTION.length; idx++) {
      const note = rawSequences.RUN_QUESTION[idx];
      if (!isObject(note)) continue;

      const startBeat = typeof note.startBeat === 'number' ? note.startBeat : 1;
      const durationBeats = typeof note.durationBeats === 'number' ? note.durationBeats : 1;
      const startTick = (startBeat - 1) * 480;
      const durationTicks = durationBeats * 480;

      const payload = isObject(note.payload) ? note.payload : {};
      const rawPatternId = typeof payload.patternId === 'string' ? payload.patternId : (typeof note.patternId === 'string' ? note.patternId : (typeof note.sourcePatternId === 'string' ? note.sourcePatternId : undefined));
      const sourcePatternId = rawPatternId ? (idRemap[rawPatternId] ?? rawPatternId) : undefined;

      const cue: MotionCueEvent = {
        id: getUniqueEventId(note.id, 'evt_run_q'),
        kind: 'motionCue',
        startTick,
        durationTicks,
      };

      if (sourcePatternId && seenPatternIds.has(sourcePatternId)) {
        cue.sourcePatternId = sourcePatternId;
      }

      runEvents.push(cue);
    }

    migratedSequences.push({
      id: 'seq_phase_a_run_question',
      name: 'Phase A Run Question Motion Guide',
      phase: 'phaseA',
      kind: 'motionGuide',
      events: runEvents,
    });

    migratedBindings.push({
      chapterId: 'ch1',
      subLevelId: null,
      phase: 'phaseA',
      sequenceId: 'seq_phase_a_run_question',
      role: 'runQuestion',
    });
  } else {
    diagnostics.push({
      code: 'missing-sequence',
      message: 'Sequence "RUN_QUESTION" was omitted in V1 input; no default inserted.',
      severity: 'info',
    });
  }

  // D. ANSWER_SELECT -> Phase A motionGuide
  if (Array.isArray(rawSequences.ANSWER_SELECT)) {
    const ansEvents: MotionCueEvent[] = [];

    for (let idx = 0; idx < rawSequences.ANSWER_SELECT.length; idx++) {
      const note = rawSequences.ANSWER_SELECT[idx];
      if (!isObject(note)) continue;

      const startBeat = typeof note.startBeat === 'number' ? note.startBeat : 1;
      const durationBeats = typeof note.durationBeats === 'number' ? note.durationBeats : 1;
      const startTick = (startBeat - 1) * 480;
      const durationTicks = durationBeats * 480;

      const payload = isObject(note.payload) ? note.payload : {};
      const rawPatternId = typeof payload.patternId === 'string' ? payload.patternId : (typeof note.patternId === 'string' ? note.patternId : (typeof note.sourcePatternId === 'string' ? note.sourcePatternId : undefined));
      const sourcePatternId = rawPatternId ? (idRemap[rawPatternId] ?? rawPatternId) : undefined;

      const cue: MotionCueEvent = {
        id: getUniqueEventId(note.id, 'evt_ans_sel'),
        kind: 'motionCue',
        startTick,
        durationTicks,
      };

      if (sourcePatternId && seenPatternIds.has(sourcePatternId)) {
        cue.sourcePatternId = sourcePatternId;
      }

      ansEvents.push(cue);
    }

    migratedSequences.push({
      id: 'seq_phase_a_answer_select',
      name: 'Phase A Answer Select Motion Guide',
      phase: 'phaseA',
      kind: 'motionGuide',
      events: ansEvents,
    });

    migratedBindings.push({
      chapterId: 'ch1',
      subLevelId: null,
      phase: 'phaseA',
      sequenceId: 'seq_phase_a_answer_select',
      role: 'answerSelect',
    });
  } else {
    diagnostics.push({
      code: 'missing-sequence',
      message: 'Sequence "ANSWER_SELECT" was omitted in V1 input; no default inserted.',
      severity: 'info',
    });
  }

  // 4. Metadata and project assembly
  const now = '2026-10-05T00:00:00.000Z';
  const bpm = typeof v1Input.bpm === 'number' && Number.isFinite(v1Input.bpm) ? v1Input.bpm : 120;

  const project: EditorProject = {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId: options?.projectId ?? 'project_v1_migrated',
    revision: 1,
    rulesetId: options?.rulesetId ?? 'dg-ruleset-v2',
    metadata: {
      title: options?.title ?? 'Migrated V1 Project',
      description: 'Migrated from V1 dance editor package',
      author: options?.author ?? 'System Migration',
      createdAt: typeof v1Input.exportedAt === 'string' ? v1Input.exportedAt : now,
      updatedAt: now,
    },
    previewTempo: {
      bpm,
      beatsPerBar: 4,
    },
    patterns: migratedPatterns,
    sequences: migratedSequences,
    bindings: migratedBindings,
  };

  // 5. Validation using official ProjectValidator
  const validation = validateEditorProject(project);
  if (!validation.valid) {
    for (const err of validation.errors) {
      errors.push(err.message);
      diagnostics.push({
        code: err.code,
        message: err.message,
        severity: 'error',
        path: err.path,
        entityId: err.entityId,
      });
    }
  }

  return {
    success: errors.length === 0,
    project,
    data: project,
    errors,
    warnings,
    diagnostics,
    idRemap,
  };
}
