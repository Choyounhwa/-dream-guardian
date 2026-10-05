/**
 * ProjectValidator.ts - V2 저작 프로젝트 순수 무결성 검증기
 *
 * Issue #375 / EDITOR-SCHEMA:
 * - 순수 함수 validateEditorProject(input: unknown): ValidationResult
 * - 입력 객체 및 중첩 구조에 대한 변경(mutation) 0회 보장
 * - NaN, Infinity, 안전하지 않은 정수/음수 tick 및 revision 검증
 * - 프로젝트 전체 엔티티 ID 고유성, 참조(sourcePatternId, sequenceId) 무결성
 * - 페이즈-시퀀스 및 페이즈-이벤트 정합성 검증
 * - 복합 키(chapterId + subLevelId + phase + role) 기반 바인딩 중복 검증
 */

import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from './EditorProject.js';

export type DiagnosticSeverity = 'error' | 'warning';

export interface ValidationDiagnostic {
  code: string;
  path: string;
  entityId?: string;
  message: string;
  severity: DiagnosticSeverity;
}

export interface ValidationResult {
  valid: boolean;
  ok: boolean;
  diagnostics: ValidationDiagnostic[];
  errors: ValidationDiagnostic[];
  warnings: ValidationDiagnostic[];
}

const ROOT_ALLOWED_KEYS = new Set([
  'kind',
  'schemaVersion',
  'projectId',
  'revision',
  'rulesetId',
  'metadata',
  'previewTempo',
  'patterns',
  'sequences',
  'bindings',
]);

const METADATA_ALLOWED_KEYS = new Set([
  'title',
  'description',
  'author',
  'createdAt',
  'updatedAt',
]);

const TEMPO_ALLOWED_KEYS = new Set(['bpm', 'beatsPerBar']);

const PATTERN_ALLOWED_KEYS = new Set(['id', 'name', 'target', 'description']);

const SEQUENCE_ALLOWED_KEYS = new Set(['id', 'name', 'phase', 'kind', 'events']);

const MOTION_CUE_ALLOWED_KEYS = new Set([
  'id',
  'eventId',
  'kind',
  'startTick',
  'tick',
  'durationTicks',
  'duration',
  'target',
  'sourcePatternId',
]);

const STAR_NOTE_ALLOWED_KEYS = new Set([
  'id',
  'eventId',
  'kind',
  'landingTick',
  'tick',
  'target',
  'sourcePatternId',
]);

const FEVER_NOTE_ALLOWED_KEYS = new Set([
  'id',
  'eventId',
  'kind',
  'landingTick',
  'tick',
  'target',
  'sourcePatternId',
]);

const HAZARD_A_ALLOWED_KEYS = new Set(['id', 'eventId', 'kind', 'hazardType']);

const HAZARD_B_ALLOWED_KEYS = new Set(['id', 'eventId', 'kind', 'attackType', 'hazardType']);

const BINDING_ALLOWED_KEYS = new Set([
  'chapterId',
  'subLevelId',
  'phase',
  'sequenceId',
  'role',
]);

const VALID_CURSOR_PARTS = new Set(['leftHand', 'rightHand', 'head', 'hip']);
const VALID_FOOT_PARTS = new Set(['leftFoot', 'rightFoot', 'centerFoot']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkUnknownProperties(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  basePath: string,
  diagnostics: ValidationDiagnostic[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      diagnostics.push({
        code: 'unknown-property',
        path: `${basePath}.${key}`,
        message: `Unknown property "${key}" at ${basePath}`,
        severity: 'error',
      });
    }
  }
}

export function validateEditorProject(input: unknown): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];

  if (!isRecord(input)) {
    diagnostics.push({
      code: 'invalid-root',
      path: '$',
      message: 'Project root must be a non-null plain object',
      severity: 'error',
    });
    return buildResult(diagnostics);
  }

  // Prototype pollution or hazardous keys
  for (const dangerous of ['__proto__', 'constructor', 'prototype']) {
    if (Object.prototype.hasOwnProperty.call(input, dangerous)) {
      diagnostics.push({
        code: 'dangerous-property',
        path: `$.${dangerous}`,
        message: `Dangerous property "${dangerous}" rejected`,
        severity: 'error',
      });
    }
  }

  checkUnknownProperties(input, ROOT_ALLOWED_KEYS, '$', diagnostics);

  // kind & schemaVersion
  if (input.kind !== AUTHORING_PROJECT_KIND) {
    diagnostics.push({
      code: 'invalid-kind',
      path: '$.kind',
      message: `Expected kind "${AUTHORING_PROJECT_KIND}", got "${String(input.kind)}"`,
      severity: 'error',
    });
  }

  if (input.schemaVersion !== AUTHORING_SCHEMA_VERSION) {
    diagnostics.push({
      code: 'invalid-schema-version',
      path: '$.schemaVersion',
      message: `Expected schemaVersion ${AUTHORING_SCHEMA_VERSION}, got "${String(input.schemaVersion)}"`,
      severity: 'error',
    });
  }

  // projectId & rulesetId
  if (typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    diagnostics.push({
      code: 'invalid-project-id',
      path: '$.projectId',
      message: 'projectId must be a non-empty string',
      severity: 'error',
    });
  }

  if (typeof input.rulesetId !== 'string' || input.rulesetId.trim().length === 0) {
    diagnostics.push({
      code: 'invalid-ruleset-id',
      path: '$.rulesetId',
      message: 'rulesetId must be a non-empty string',
      severity: 'error',
    });
  }

  // revision
  if (
    typeof input.revision !== 'number' ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  ) {
    diagnostics.push({
      code: 'invalid-revision',
      path: '$.revision',
      message: 'revision must be a safe non-negative integer',
      severity: 'error',
    });
  }

  // metadata
  if (!isRecord(input.metadata)) {
    diagnostics.push({
      code: 'invalid-metadata',
      path: '$.metadata',
      message: 'metadata must be an object',
      severity: 'error',
    });
  } else {
    checkUnknownProperties(input.metadata, METADATA_ALLOWED_KEYS, '$.metadata', diagnostics);

    if (
      typeof input.metadata.title !== 'string' ||
      input.metadata.title.trim().length === 0
    ) {
      diagnostics.push({
        code: 'invalid-metadata-title',
        path: '$.metadata.title',
        message: 'metadata.title must be a non-empty string',
        severity: 'error',
      });
    }

    if (
      input.metadata.description !== undefined &&
      typeof input.metadata.description !== 'string'
    ) {
      diagnostics.push({
        code: 'invalid-metadata-description',
        path: '$.metadata.description',
        message: 'metadata.description must be a string',
        severity: 'error',
      });
    }

    if (
      input.metadata.author !== undefined &&
      typeof input.metadata.author !== 'string'
    ) {
      diagnostics.push({
        code: 'invalid-metadata-author',
        path: '$.metadata.author',
        message: 'metadata.author must be a string',
        severity: 'error',
      });
    }

    if (
      typeof input.metadata.createdAt !== 'string' ||
      input.metadata.createdAt.trim().length === 0
    ) {
      diagnostics.push({
        code: 'invalid-metadata-created-at',
        path: '$.metadata.createdAt',
        message: 'metadata.createdAt must be a valid timestamp string',
        severity: 'error',
      });
    }

    if (
      typeof input.metadata.updatedAt !== 'string' ||
      input.metadata.updatedAt.trim().length === 0
    ) {
      diagnostics.push({
        code: 'invalid-metadata-updated-at',
        path: '$.metadata.updatedAt',
        message: 'metadata.updatedAt must be a valid timestamp string',
        severity: 'error',
      });
    }
  }

  // previewTempo
  if (!isRecord(input.previewTempo)) {
    diagnostics.push({
      code: 'invalid-preview-tempo',
      path: '$.previewTempo',
      message: 'previewTempo must be an object',
      severity: 'error',
    });
  } else {
    checkUnknownProperties(input.previewTempo, TEMPO_ALLOWED_KEYS, '$.previewTempo', diagnostics);

    const bpm = input.previewTempo.bpm;
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
      diagnostics.push({
        code: 'invalid-tempo-bpm',
        path: '$.previewTempo.bpm',
        message: 'previewTempo.bpm must be a finite positive number',
        severity: 'error',
      });
    }

    const beatsPerBar = input.previewTempo.beatsPerBar;
    if (
      typeof beatsPerBar !== 'number' ||
      !Number.isSafeInteger(beatsPerBar) ||
      beatsPerBar <= 0
    ) {
      diagnostics.push({
        code: 'invalid-tempo-beats-per-bar',
        path: '$.previewTempo.beatsPerBar',
        message: 'previewTempo.beatsPerBar must be a positive integer',
        severity: 'error',
      });
    }
  }

  // Entity ID collision tracker across the entire project
  const seenEntityIds = new Map<string, string>();
  function registerEntityId(id: unknown, path: string): boolean {
    if (typeof id !== 'string' || id.trim().length === 0) {
      diagnostics.push({
        code: 'invalid-entity-id',
        path,
        message: `Entity ID at ${path} must be a non-empty string`,
        severity: 'error',
      });
      return false;
    }

    const previousPath = seenEntityIds.get(id);
    if (previousPath !== undefined) {
      diagnostics.push({
        code: 'duplicate-entity-id',
        path,
        entityId: id,
        message: `Duplicate entity ID "${id}" at ${path} was already defined at ${previousPath}`,
        severity: 'error',
      });
      return false;
    }

    seenEntityIds.set(id, path);
    return true;
  }

  // Patterns
  const knownPatternIds = new Set<string>();
  if (!Array.isArray(input.patterns)) {
    diagnostics.push({
      code: 'invalid-patterns',
      path: '$.patterns',
      message: 'patterns must be an array',
      severity: 'error',
    });
  } else {
    input.patterns.forEach((pat, idx) => {
      const patPath = `$.patterns[${idx}]`;
      if (!isRecord(pat)) {
        diagnostics.push({
          code: 'invalid-pattern',
          path: patPath,
          message: 'Pattern entry must be an object',
          severity: 'error',
        });
        return;
      }

      checkUnknownProperties(pat, PATTERN_ALLOWED_KEYS, patPath, diagnostics);

      const isValidId = registerEntityId(pat.id, `${patPath}.id`);
      if (isValidId && typeof pat.id === 'string') {
        knownPatternIds.add(pat.id);
      }

      if (typeof pat.name !== 'string' || pat.name.trim().length === 0) {
        diagnostics.push({
          code: 'invalid-pattern-name',
          path: `${patPath}.name`,
          entityId: typeof pat.id === 'string' ? pat.id : undefined,
          message: 'Pattern name must be a non-empty string',
          severity: 'error',
        });
      }

      if (!isRecord(pat.target)) {
        diagnostics.push({
          code: 'invalid-pattern-target',
          path: `${patPath}.target`,
          entityId: typeof pat.id === 'string' ? pat.id : undefined,
          message: 'Pattern target must be an object',
          severity: 'error',
        });
      } else {
        const allowedTargetParts = new Set(['leftHand', 'rightHand', 'head', 'hip']);
        checkUnknownProperties(pat.target, allowedTargetParts, `${patPath}.target`, diagnostics);

        for (const [part, zone] of Object.entries(pat.target)) {
          if (zone === null || zone === undefined) continue;
          if (
            typeof zone !== 'number' ||
            !Number.isSafeInteger(zone) ||
            zone < 1 ||
            zone > 11
          ) {
            diagnostics.push({
              code: 'invalid-pattern-zone',
              path: `${patPath}.target.${part}`,
              entityId: typeof pat.id === 'string' ? pat.id : undefined,
              message: `Zone for ${part} must be an integer between 1 and 11 or null`,
              severity: 'error',
            });
          }
        }
      }
    });
  }

  // Sequences
  const knownSequences = new Map<string, { kind: string; phase: string }>();
  if (!Array.isArray(input.sequences)) {
    diagnostics.push({
      code: 'invalid-sequences',
      path: '$.sequences',
      message: 'sequences must be an array',
      severity: 'error',
    });
  } else {
    input.sequences.forEach((seq, seqIdx) => {
      const seqPath = `$.sequences[${seqIdx}]`;
      if (!isRecord(seq)) {
        diagnostics.push({
          code: 'invalid-sequence',
          path: seqPath,
          message: 'Sequence entry must be an object',
          severity: 'error',
        });
        return;
      }

      checkUnknownProperties(seq, SEQUENCE_ALLOWED_KEYS, seqPath, diagnostics);

      const isValidSeqId = registerEntityId(seq.id, `${seqPath}.id`);
      const seqIdStr = typeof seq.id === 'string' ? seq.id : undefined;

      const phase = seq.phase;
      const kind = seq.kind;

      if (phase !== 'phaseA' && phase !== 'phaseB') {
        diagnostics.push({
          code: 'invalid-sequence-phase',
          path: `${seqPath}.phase`,
          entityId: seqIdStr,
          message: 'Sequence phase must be "phaseA" or "phaseB"',
          severity: 'error',
        });
      }

      const validKinds = new Set(['motionGuide', 'starNotes', 'feverNotes', 'hazard']);
      if (typeof kind !== 'string' || !validKinds.has(kind)) {
        diagnostics.push({
          code: 'invalid-sequence-kind',
          path: `${seqPath}.kind`,
          entityId: seqIdStr,
          message: `Unknown sequence kind "${String(kind)}"`,
          severity: 'error',
        });
      }

      // Phase-Kind separation rules
      if (phase === 'phaseA' && kind === 'feverNotes') {
        diagnostics.push({
          code: 'phase-sequence-mismatch',
          path: `${seqPath}.kind`,
          entityId: seqIdStr,
          message: 'Phase A sequences cannot declare kind "feverNotes"',
          severity: 'error',
        });
      }

      if (phase === 'phaseB' && kind === 'starNotes') {
        diagnostics.push({
          code: 'phase-sequence-mismatch',
          path: `${seqPath}.kind`,
          entityId: seqIdStr,
          message: 'Phase B sequences cannot declare kind "starNotes"',
          severity: 'error',
        });
      }

      if (isValidSeqId && seqIdStr && typeof kind === 'string' && typeof phase === 'string') {
        knownSequences.set(seqIdStr, { kind, phase });
      }

      // Events inside sequence
      if (!Array.isArray(seq.events)) {
        diagnostics.push({
          code: 'invalid-sequence-events',
          path: `${seqPath}.events`,
          entityId: seqIdStr,
          message: 'Sequence events must be an array',
          severity: 'error',
        });
      } else {
        seq.events.forEach((evt, evtIdx) => {
          const evtPath = `${seqPath}.events[${evtIdx}]`;
          if (!isRecord(evt)) {
            diagnostics.push({
              code: 'invalid-event',
              path: evtPath,
              message: 'Event entry must be an object',
              severity: 'error',
            });
            return;
          }

          const rawEvtId = evt.id ?? evt.eventId;
          registerEntityId(rawEvtId, `${evtPath}.id`);
          const evtIdStr = typeof rawEvtId === 'string' ? rawEvtId : undefined;

          // Reference check for sourcePatternId
          if (evt.sourcePatternId !== undefined) {
            if (
              typeof evt.sourcePatternId !== 'string' ||
              !knownPatternIds.has(evt.sourcePatternId)
            ) {
              diagnostics.push({
                code: 'broken-pattern-reference',
                path: `${evtPath}.sourcePatternId`,
                entityId: String(evt.sourcePatternId),
                message: `Event references unknown sourcePatternId "${String(evt.sourcePatternId)}"`,
                severity: 'error',
              });
            }
          }

          // Validate by sequence kind
          switch (kind) {
            case 'motionGuide': {
              checkUnknownProperties(evt, MOTION_CUE_ALLOWED_KEYS, evtPath, diagnostics);

              if (evt.kind !== undefined && evt.kind !== 'motionCue') {
                diagnostics.push({
                  code: 'phase-event-mismatch',
                  path: `${evtPath}.kind`,
                  entityId: evtIdStr,
                  message: `motionGuide sequence events must be "motionCue", got "${String(evt.kind)}"`,
                  severity: 'error',
                });
              }

              const tick = evt.startTick ?? evt.tick;
              if (tick !== undefined) {
                if (typeof tick !== 'number' || !Number.isSafeInteger(tick) || tick < 0) {
                  diagnostics.push({
                    code: 'invalid-event-tick',
                    path: `${evtPath}.${evt.startTick !== undefined ? 'startTick' : 'tick'}`,
                    entityId: evtIdStr,
                    message: 'startTick must be a safe non-negative integer',
                    severity: 'error',
                  });
                }
              }

              const dur = evt.durationTicks ?? evt.duration;
              if (dur !== undefined) {
                if (typeof dur !== 'number' || !Number.isSafeInteger(dur) || dur < 0) {
                  diagnostics.push({
                    code: 'invalid-event-duration',
                    path: `${evtPath}.${evt.durationTicks !== undefined ? 'durationTicks' : 'duration'}`,
                    entityId: evtIdStr,
                    message: 'durationTicks must be a safe non-negative integer',
                    severity: 'error',
                  });
                }
              }
              break;
            }

            case 'starNotes':
            case 'feverNotes': {
              const allowedKeys =
                kind === 'starNotes' ? STAR_NOTE_ALLOWED_KEYS : FEVER_NOTE_ALLOWED_KEYS;
              checkUnknownProperties(evt, allowedKeys, evtPath, diagnostics);

              if (kind === 'starNotes' && evt.kind !== undefined && evt.kind !== 'starNote') {
                diagnostics.push({
                  code: 'phase-event-mismatch',
                  path: `${evtPath}.kind`,
                  entityId: evtIdStr,
                  message: `starNotes sequence events must be "starNote", got "${String(evt.kind)}"`,
                  severity: 'error',
                });
              }

              if (
                kind === 'feverNotes' &&
                evt.kind !== undefined &&
                evt.kind !== 'feverNote' &&
                evt.kind !== 'starNote'
              ) {
                diagnostics.push({
                  code: 'phase-event-mismatch',
                  path: `${evtPath}.kind`,
                  entityId: evtIdStr,
                  message: `feverNotes sequence events must be "feverNote", got "${String(evt.kind)}"`,
                  severity: 'error',
                });
              }

              const landing = evt.landingTick ?? evt.tick;
              if (
                typeof landing !== 'number' ||
                !Number.isSafeInteger(landing) ||
                landing < 0
              ) {
                diagnostics.push({
                  code: 'invalid-event-tick',
                  path: `${evtPath}.${evt.landingTick !== undefined ? 'landingTick' : 'tick'}`,
                  entityId: evtIdStr,
                  message: 'landingTick must be a safe non-negative integer',
                  severity: 'error',
                });
              }

              // Target check: cursor vs foot
              if (!isRecord(evt.target)) {
                diagnostics.push({
                  code: 'invalid-event-target',
                  path: `${evtPath}.target`,
                  entityId: evtIdStr,
                  message: 'Note target must be an object',
                  severity: 'error',
                });
              } else {
                const targetType = evt.target.type;
                if (targetType === 'foot' || evt.target.foot !== undefined) {
                  // Foot target validation
                  const footVal = evt.target.foot;
                  if (typeof footVal !== 'string' || !VALID_FOOT_PARTS.has(footVal)) {
                    diagnostics.push({
                      code: 'invalid-foot-part',
                      path: `${evtPath}.target.foot`,
                      entityId: evtIdStr,
                      message: 'Foot target must have a valid foot (leftFoot, rightFoot, centerFoot)',
                      severity: 'error',
                    });
                  }
                  const zoneId = evt.target.zoneId;
                  if (
                    typeof zoneId !== 'number' ||
                    !Number.isSafeInteger(zoneId) ||
                    zoneId < 9 ||
                    zoneId > 11
                  ) {
                    diagnostics.push({
                      code: 'invalid-foot-zone',
                      path: `${evtPath}.target.zoneId`,
                      entityId: evtIdStr,
                      message: 'Foot note target zoneId must be 9, 10, or 11',
                      severity: 'error',
                    });
                  }
                } else {
                  // Cursor target validation
                  const partVal = evt.target.part;
                  if (typeof partVal !== 'string' || !VALID_CURSOR_PARTS.has(partVal)) {
                    diagnostics.push({
                      code: 'invalid-cursor-part',
                      path: `${evtPath}.target.part`,
                      entityId: evtIdStr,
                      message: 'Cursor target must have a valid part (leftHand, rightHand, head, hip)',
                      severity: 'error',
                    });
                  }
                  const zoneId = evt.target.zoneId;
                  if (
                    typeof zoneId !== 'number' ||
                    !Number.isSafeInteger(zoneId) ||
                    zoneId < 1 ||
                    zoneId > 11
                  ) {
                    diagnostics.push({
                      code: 'invalid-cursor-zone',
                      path: `${evtPath}.target.zoneId`,
                      entityId: evtIdStr,
                      message: 'Cursor target zoneId must be an integer between 1 and 11',
                      severity: 'error',
                    });
                  }
                }
              }
              break;
            }

            case 'hazard': {
              if (phase === 'phaseA') {
                checkUnknownProperties(evt, HAZARD_A_ALLOWED_KEYS, evtPath, diagnostics);

                if (
                  evt.kind !== undefined &&
                  evt.kind !== 'phaseAHazard' &&
                  evt.kind !== 'hazard'
                ) {
                  diagnostics.push({
                    code: 'phase-event-mismatch',
                    path: `${evtPath}.kind`,
                    entityId: evtIdStr,
                    message: `Phase A hazard sequence event cannot be "${String(evt.kind)}"`,
                    severity: 'error',
                  });
                }

                if (
                  typeof evt.hazardType !== 'string' ||
                  evt.hazardType.trim().length === 0
                ) {
                  diagnostics.push({
                    code: 'invalid-hazard-type',
                    path: `${evtPath}.hazardType`,
                    entityId: evtIdStr,
                    message: 'hazardType must be a non-empty string',
                    severity: 'error',
                  });
                }
              } else if (phase === 'phaseB') {
                checkUnknownProperties(evt, HAZARD_B_ALLOWED_KEYS, evtPath, diagnostics);

                if (
                  evt.kind !== undefined &&
                  evt.kind !== 'phaseBHazard' &&
                  evt.kind !== 'hazard'
                ) {
                  diagnostics.push({
                    code: 'phase-event-mismatch',
                    path: `${evtPath}.kind`,
                    entityId: evtIdStr,
                    message: `Phase B hazard sequence event cannot be "${String(evt.kind)}"`,
                    severity: 'error',
                  });
                }

                const attack = evt.attackType ?? evt.hazardType;
                if (typeof attack !== 'string' || attack.trim().length === 0) {
                  diagnostics.push({
                    code: 'invalid-attack-type',
                    path: `${evtPath}.attackType`,
                    entityId: evtIdStr,
                    message: 'Phase B hazard event must declare a non-empty attackType',
                    severity: 'error',
                  });
                }
              }
              break;
            }

            default:
              break;
          }
        });
      }
    });
  }

  // Bindings
  const seenBindingKeys = new Set<string>();
  if (!Array.isArray(input.bindings)) {
    diagnostics.push({
      code: 'invalid-bindings',
      path: '$.bindings',
      message: 'bindings must be an array',
      severity: 'error',
    });
  } else {
    input.bindings.forEach((binding, bindIdx) => {
      const bindPath = `$.bindings[${bindIdx}]`;
      if (!isRecord(binding)) {
        diagnostics.push({
          code: 'invalid-binding',
          path: bindPath,
          message: 'Binding entry must be an object',
          severity: 'error',
        });
        return;
      }

      checkUnknownProperties(binding, BINDING_ALLOWED_KEYS, bindPath, diagnostics);

      if (
        typeof binding.chapterId !== 'string' ||
        binding.chapterId.trim().length === 0
      ) {
        diagnostics.push({
          code: 'invalid-binding-chapter',
          path: `${bindPath}.chapterId`,
          message: 'chapterId must be a non-empty string',
          severity: 'error',
        });
      }

      if (
        binding.subLevelId !== null &&
        binding.subLevelId !== undefined &&
        typeof binding.subLevelId !== 'string'
      ) {
        diagnostics.push({
          code: 'invalid-binding-sublevel',
          path: `${bindPath}.subLevelId`,
          message: 'subLevelId must be a string or null',
          severity: 'error',
        });
      }

      if (binding.phase !== 'phaseA' && binding.phase !== 'phaseB') {
        diagnostics.push({
          code: 'invalid-binding-phase',
          path: `${bindPath}.phase`,
          message: 'phase must be "phaseA" or "phaseB"',
          severity: 'error',
        });
      }

      const seqId = binding.sequenceId;
      if (typeof seqId !== 'string' || seqId.trim().length === 0) {
        diagnostics.push({
          code: 'invalid-binding-sequence-id',
          path: `${bindPath}.sequenceId`,
          message: 'sequenceId must be a non-empty string',
          severity: 'error',
        });
      } else {
        const targetSeq = knownSequences.get(seqId);
        if (!targetSeq) {
          diagnostics.push({
            code: 'broken-sequence-reference',
            path: `${bindPath}.sequenceId`,
            entityId: seqId,
            message: `Binding references unknown sequence "${seqId}"`,
            severity: 'error',
          });
        } else {
          // Compound key for duplicate check:
          // chapterId + (subLevelId ?? 'all') + phase + sequenceKind/role
          const role =
            typeof binding.role === 'string' && binding.role.trim().length > 0
              ? binding.role
              : targetSeq.kind;
          const subLevel = binding.subLevelId ?? 'all';
          const compoundKey = `${binding.chapterId}::${subLevel}::${binding.phase}::${role}`;

          if (seenBindingKeys.has(compoundKey)) {
            diagnostics.push({
              code: 'duplicate-binding',
              path: bindPath,
              entityId: seqId,
              message: `Duplicate binding for compound key "${compoundKey}"`,
              severity: 'error',
            });
          } else {
            seenBindingKeys.add(compoundKey);
          }
        }
      }
    });
  }

  return buildResult(diagnostics);
}

function buildResult(diagnostics: ValidationDiagnostic[]): ValidationResult {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const valid = errors.length === 0;
  return {
    valid,
    ok: valid,
    diagnostics,
    errors,
    warnings,
  };
}

export function isEditorProject(input: unknown): input is EditorProject {
  return validateEditorProject(input).valid;
}

export function createEmptyEditorProject(params?: {
  projectId?: string;
  title?: string;
  bpm?: number;
  rulesetId?: string;
}): EditorProject {
  const now = new Date().toISOString();
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId: params?.projectId ?? 'proj_new',
    revision: 0,
    rulesetId: params?.rulesetId ?? 'ruleset_default_v1',
    metadata: {
      title: params?.title ?? 'Untitled Project',
      createdAt: now,
      updatedAt: now,
    },
    previewTempo: {
      bpm: params?.bpm ?? 120,
      beatsPerBar: 4,
    },
    patterns: [],
    sequences: [],
    bindings: [],
  };
}
