/**
 * ContentCompiler.ts - 검증된 원본의 결정적 게임 적용본 컴파일러
 *
 * Issue #377 / EDITOR-COMPILE:
 * - 순수 함수 compileEditorProject(project: EditorProject, options?: CompileOptions): CompileResult
 * - 입력 원본(EditorProject) 변형(mutation) 0회 보장
 * - ProjectValidator 및 ContentCapabilities 기반 게시 가능성 사전 검증
 * - 미지원 BPM, 착지 틱 불일치, 머리/골반 별노트, 크로스바디 위반, 미지원 장판 등 비게시 역량 거부
 * - 에디터 UI 선택 및 타임스탬프를 contentHash 계산에서 제외
 * - 실행 시 template 역조회 방지: 자체 완결적(self-contained) 실행 노트로 확장
 * - 미편집 단계의 명시적 버전 고정 builtin profile 지원 (암묵적 CSV fallback 엄격 차단)
 * - 동일 입력·규칙·컴파일러에 대한 100% 동일한 정규 JSON 및 SHA-256 contentHash 생성
 */

import { computeContentHash } from './ContentCanonical.js';
import {
  DEFAULT_RULESET_ID,
  PHASE_A_PUBLISHABLE_HAZARD_PATTERNS,
  PHASE_B_PUBLISHABLE_ATTACKS,
  PHASE_A_STAR_LANDING_TICKS,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
  checkCrossBodyConstraint,
  checkSafeTransition,
  derivePartZoneMap,
  getRequiredActionForPhaseBAttack,
  isPublishablePhaseAHazard,
  isPublishableStarTarget,
  isSupportedBpm,
  isValidSlotTick,
  tickToBeat,
  type PhaseBPublishableAttack,
} from './ContentCapabilities.js';
import { PHASE_A_HAZARD_BEAT_TIMINGS } from './ContentTiming.js';
import type {
  EditorPattern,
  EditorProject,
  EditorSequence,
  FeverNoteEvent,
  MotionCueEvent,
  PhaseAHazardEvent,
  PhaseBHazardEvent,
  StarNoteEvent,
} from './EditorProject.js';
import {
  validateEditorProject,
  type DiagnosticSeverity,
  type ValidationDiagnostic,
} from './ProjectValidator.js';
import {
  DEFAULT_COMPILER_VERSION,
  DEFAULT_RUNTIME_CONTRACT_VERSION,
  PUBLISHED_PACK_KIND,
  PUBLISHED_SCHEMA_VERSION,
  computePublishedPackHash,
  validatePublishedContentPack,
  type CompiledFeverNote,
  type CompiledPhaseABundle,
  type CompiledPhaseBBundle,
  type CompiledPhaseBHazard,
  type CompiledStageBundle,
  type CompiledStarNote,
  type PublishedContentPack,
  type ResolvedStarTarget,
} from './PublishedContentPack.js';

export interface CompileOptions {
  compilerVersion?: string;
  expectedRulesetId?: string;
  compiledAt?: string;
  editorUiSelection?: Record<string, unknown>;
  requiredStages?: string[];
  builtinProfiles?: Record<string, string>;
}

export type CompileResult =
  | {
      success: true;
      ok: true;
      pack: PublishedContentPack;
      contentHash: string;
      diagnostics: ValidationDiagnostic[];
      errors: [];
      warnings: ValidationDiagnostic[];
    }
  | {
      success: false;
      ok: false;
      pack: null;
      contentHash: null;
      diagnostics: ValidationDiagnostic[];
      errors: ValidationDiagnostic[];
      warnings: ValidationDiagnostic[];
    };

export function compileEditorProject(
  project: EditorProject,
  options?: CompileOptions,
): CompileResult {
  const diagnostics: ValidationDiagnostic[] = [];

  function addDiagnostic(
    code: string,
    path: string,
    message: string,
    severity: DiagnosticSeverity = 'error',
    entityId?: string,
  ): void {
    diagnostics.push({ code, path, message, severity, entityId });
  }

  // 1. Structural & Reference Integrity Validation
  const structuralValidation = validateEditorProject(project);
  if (!structuralValidation.valid) {
    return {
      success: false,
      ok: false,
      pack: null,
      contentHash: null,
      diagnostics: structuralValidation.diagnostics,
      errors: structuralValidation.errors,
      warnings: structuralValidation.warnings,
    };
  }

  // 2. Ruleset & Capability Validation
  if (project.rulesetId !== DEFAULT_RULESET_ID) {
    addDiagnostic(
      'unsupported-ruleset-id',
      'rulesetId',
      `Ruleset "${project.rulesetId}" is not publishable. Expected: "${DEFAULT_RULESET_ID}"`,
    );
  }

  if (options?.expectedRulesetId && project.rulesetId !== options.expectedRulesetId) {
    addDiagnostic(
      'ruleset-mismatch',
      'rulesetId',
      `Ruleset ID "${project.rulesetId}" does not match expected "${options.expectedRulesetId}"`,
    );
  }

  if (!isSupportedBpm(project.previewTempo.bpm)) {
    addDiagnostic(
      'unsupported-bpm',
      'previewTempo.bpm',
      `BPM ${project.previewTempo.bpm} is not supported for publishing. Supported BPMs: 110, 115, 120, 125, 135, 140`,
    );
  }

  // 3. Capability & Safety Checks on Sequences and Events
  for (let seqIdx = 0; seqIdx < project.sequences.length; seqIdx++) {
    const seq = project.sequences[seqIdx];
    const seqPath = `sequences[${seqIdx}]`;

    if (seq.phase === 'phaseA' && seq.kind === 'starNotes') {
      const starEvents = seq.events as StarNoteEvent[];
      // Check each star note target and tick
      for (let evtIdx = 0; evtIdx < starEvents.length; evtIdx++) {
        const evt = starEvents[evtIdx];
        const evtPath = `${seqPath}.events[${evtIdx}]`;

        if (!isPublishableStarTarget(evt.target)) {
          addDiagnostic(
            'non-publishable-star-target',
            `${evtPath}.target`,
            `Target ${JSON.stringify(evt.target)} is not publishable as a star note (cursor hand 1-5 or foot 9-11 only)`,
            'error',
            evt.id,
          );
        }

        const landingTick = evt.landingTick ?? evt.tick;
        if (landingTick === undefined || !isValidSlotTick(landingTick)) {
          addDiagnostic(
            'invalid-slot-tick',
            `${evtPath}.landingTick`,
            `Landing tick ${landingTick} does not align with Phase A fixed slot ticks: [${PHASE_A_STAR_LANDING_TICKS.join(', ')}]`,
            'error',
            evt.id,
          );
        }

        if (evt.target.type === 'cursor' && (evt.target.part === 'leftHand' || evt.target.part === 'rightHand')) {
          const cb = checkCrossBodyConstraint(evt.target.part, evt.target.zoneId);
          if (!cb.valid) {
            addDiagnostic(
              'cross-body-violation',
              `${evtPath}.target`,
              cb.reason ?? 'Cross body physical constraint violated',
              'error',
              evt.id,
            );
          }
        }
      }

      // Safe transition check between chronologically sorted star notes
      const sortedStarEvents = [...starEvents].sort((a, b) => (a.landingTick ?? 0) - (b.landingTick ?? 0));
      for (let i = 1; i < sortedStarEvents.length; i++) {
        const prev = sortedStarEvents[i - 1].target;
        const curr = sortedStarEvents[i].target;
        const prevPart = (prev as any).part ?? (prev as any).foot;
        const currPart = (curr as any).part ?? (curr as any).foot;
        if (prevPart && currPart) {
          const trans = checkSafeTransition(
            { part: prevPart, zoneId: prev.zoneId },
            { part: currPart, zoneId: curr.zoneId },
          );
          if (!trans.safe) {
            addDiagnostic(
              'unsafe-transition',
              `${seqPath}.events[${sortedStarEvents[i].id ?? i}]`,
              trans.reason ?? 'Unsafe body transition detected between consecutive star notes',
              'error',
              sortedStarEvents[i].id,
            );
          }
        }
      }
    }

    if (seq.phase === 'phaseA' && seq.kind === 'hazard') {
      const hazardEvents = seq.events as PhaseAHazardEvent[];
      for (let evtIdx = 0; evtIdx < hazardEvents.length; evtIdx++) {
        const evt = hazardEvents[evtIdx];
        const evtPath = `${seqPath}.events[${evtIdx}]`;
        if (!isPublishablePhaseAHazard(evt.hazardType)) {
          addDiagnostic(
            'non-publishable-hazard-pattern',
            `${evtPath}.hazardType`,
            `Phase A hazard pattern "${evt.hazardType}" is not publishable. Supported: [${PHASE_A_PUBLISHABLE_HAZARD_PATTERNS.join(', ')}]`,
            'error',
            evt.id,
          );
        }
      }
    }

    if (seq.phase === 'phaseB' && seq.kind === 'hazard') {
      const hazardEvents = seq.events as PhaseBHazardEvent[];
      for (let evtIdx = 0; evtIdx < hazardEvents.length; evtIdx++) {
        const evt = hazardEvents[evtIdx];
        const evtPath = `${seqPath}.events[${evtIdx}]`;
        const attack = evt.attackType ?? evt.hazardType ?? '';
        if (!(PHASE_B_PUBLISHABLE_ATTACKS as readonly string[]).includes(attack)) {
          addDiagnostic(
            'non-publishable-attack-type',
            `${evtPath}.attackType`,
            `Phase B attack "${attack}" is not publishable. Supported: [${PHASE_B_PUBLISHABLE_ATTACKS.join(', ')}]`,
            'error',
            evt.id,
          );
        }
      }
    }

    if (seq.phase === 'phaseB' && seq.kind === 'feverNotes') {
      const feverEvents = seq.events as FeverNoteEvent[];
      for (let evtIdx = 0; evtIdx < feverEvents.length; evtIdx++) {
        const evt = feverEvents[evtIdx];
        const evtPath = `${seqPath}.events[${evtIdx}]`;
        if (!isPublishableStarTarget(evt.target)) {
          addDiagnostic(
            'non-publishable-star-target',
            `${evtPath}.target`,
            `Fever target ${JSON.stringify(evt.target)} is not publishable (cursor hand 1-5 or foot 9-11 only)`,
            'error',
            evt.id,
          );
        }
        const landingTick = evt.landingTick ?? evt.tick;
        if (landingTick === undefined || !Number.isInteger(landingTick) || landingTick < 0) {
          addDiagnostic(
            'invalid-tick',
            `${evtPath}.landingTick`,
            `Landing tick ${landingTick} must be a non-negative integer`,
            'error',
            evt.id,
          );
        }
      }
    }
  }

  // 4. Stage Coverage & Binding Completeness Validation
  const boundChapterIds = new Set<string>();
  for (const b of project.bindings) {
    boundChapterIds.add(b.chapterId);
  }

  if (options?.requiredStages) {
    for (const reqStage of options.requiredStages) {
      const isBound = boundChapterIds.has(reqStage);
      const hasBuiltin =
        options.builtinProfiles?.[reqStage] != null &&
        options.builtinProfiles[reqStage].trim().length > 0;

      if (!isBound && !hasBuiltin) {
        addDiagnostic(
          'missing-stage-coverage',
          `stages[${reqStage}]`,
          `Stage "${reqStage}" is neither bound nor backed by an explicit builtin profile`,
        );
      }
    }
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  if (errors.length > 0) {
    return {
      success: false,
      ok: false,
      pack: null,
      contentHash: null,
      diagnostics,
      errors: errors as ValidationDiagnostic[],
      warnings,
    };
  }

  // 5. Expand & Compile Stage Bundles Deterministically
  const patternMap = new Map<string, EditorPattern>();
  for (const pat of project.patterns) {
    patternMap.set(pat.id, pat);
  }

  const sequenceMap = new Map<string, EditorSequence>();
  for (const seq of project.sequences) {
    sequenceMap.set(seq.id, seq);
  }

  const stages: Record<string, CompiledStageBundle> = {};

  // Compile bound stages
  const sortedChapterIds = Array.from(boundChapterIds).sort();
  for (const chapterId of sortedChapterIds) {
    const stageBindings = project.bindings.filter((b) => b.chapterId === chapterId);
    const phaseABundle: CompiledPhaseABundle = {};
    const phaseBBundle: CompiledPhaseBBundle = {};

    for (const binding of stageBindings) {
      const seq = sequenceMap.get(binding.sequenceId);
      if (!seq) continue;

      if (binding.phase === 'phaseA') {
        if (seq.kind === 'starNotes') {
          const starEvents = seq.events as StarNoteEvent[];
          const compiledStarNotes: CompiledStarNote[] = [...starEvents]
            .sort((a, b) => (a.landingTick ?? 0) - (b.landingTick ?? 0))
            .map((evt, idx) => {
              const landingTick = evt.landingTick ?? evt.tick ?? 0;
              const slotIdx = (PHASE_A_STAR_LANDING_TICKS as readonly number[]).indexOf(landingTick);
              const resolvedTarget: ResolvedStarTarget = {
                type: evt.target.type,
                zoneId: evt.target.zoneId,
                instrument: evt.target.type === 'foot' ? 'foot' : 'hand',
              };
              if ((evt.target as any).part !== undefined) {
                resolvedTarget.part = (evt.target as any).part;
              }
              if ((evt.target as any).foot !== undefined) {
                resolvedTarget.foot = (evt.target as any).foot;
              }

              const note: CompiledStarNote = {
                id: evt.id ?? `star_${idx}`,
                slotIndex: slotIdx !== -1 ? slotIdx : idx,
                landingTick,
                landingBeat: tickToBeat(landingTick),
                target: resolvedTarget,
              };

              if (evt.sourcePatternId) {
                note.sourcePatternId = evt.sourcePatternId;
                const pat = patternMap.get(evt.sourcePatternId);
                if (pat) {
                  note.resolvedPartZoneMap = derivePartZoneMap(pat.target);
                }
              }

              return note;
            });
          phaseABundle.starNotes = compiledStarNotes;
        } else if (seq.kind === 'hazard') {
          const hazardEvt = seq.events[0] as PhaseAHazardEvent | undefined;
          if (hazardEvt) {
            const hType = hazardEvt.hazardType ?? 'left_step';
            phaseABundle.hazard = {
              id: hazardEvt.id,
              hazardType: hType,
              requiredAction: hType,
              timings: {
                warningStartBeat: PHASE_A_HAZARD_BEAT_TIMINGS.warningStart,
                inputStartBeat: PHASE_A_HAZARD_BEAT_TIMINGS.inputStart,
                inputEndBeat: PHASE_A_HAZARD_BEAT_TIMINGS.inputEnd,
                judgmentBeat: PHASE_A_HAZARD_BEAT_TIMINGS.judgmentTime,
                totalDurationBeats: PHASE_A_HAZARD_BEAT_TIMINGS.totalDuration,
              },
            };
          }
        } else if (seq.kind === 'motionGuide') {
          const cues = (seq.events as MotionCueEvent[])
            .map((c) => ({
              id: c.id,
              startTick: c.startTick ?? c.tick ?? 0,
              durationTicks: c.durationTicks ?? c.duration ?? 0,
              target: c.target ?? (c.sourcePatternId ? patternMap.get(c.sourcePatternId)?.target ?? {} : {}),
              sourcePatternId: c.sourcePatternId,
            }))
            .sort((a, b) => a.startTick - b.startTick);
          phaseABundle.motionGuide = cues;
        }
      } else if (binding.phase === 'phaseB') {
        if (seq.kind === 'feverNotes') {
          const feverEvents = seq.events as FeverNoteEvent[];
          const compiledFeverNotes: CompiledFeverNote[] = [...feverEvents]
            .sort((a, b) => (a.landingTick ?? 0) - (b.landingTick ?? 0))
            .map((evt, idx) => {
              const landingTick = evt.landingTick ?? evt.tick ?? 0;
              const resolvedTarget: ResolvedStarTarget = {
                type: evt.target.type,
                zoneId: evt.target.zoneId,
                instrument: evt.target.type === 'foot' ? 'foot' : 'hand',
              };
              if ((evt.target as any).part !== undefined) {
                resolvedTarget.part = (evt.target as any).part;
              }
              if ((evt.target as any).foot !== undefined) {
                resolvedTarget.foot = (evt.target as any).foot;
              }

              const note: CompiledFeverNote = {
                id: evt.id ?? `fever_${idx}`,
                landingTick,
                target: resolvedTarget,
              };

              if (evt.sourcePatternId) {
                note.sourcePatternId = evt.sourcePatternId;
                const pat = patternMap.get(evt.sourcePatternId);
                if (pat) {
                  note.resolvedPartZoneMap = derivePartZoneMap(pat.target);
                }
              }

              return note;
            });
          phaseBBundle.feverNotes = compiledFeverNotes;
        } else if (seq.kind === 'hazard') {
          const hazardEvents = seq.events as PhaseBHazardEvent[];
          const compiledHazards: CompiledPhaseBHazard[] = hazardEvents.map((evt) => {
            const attack = (evt.attackType ?? evt.hazardType ?? 'dual_slam') as PhaseBPublishableAttack;
            return {
              id: evt.id,
              attackType: attack,
              requiredAction: getRequiredActionForPhaseBAttack(attack),
              warningDurationSeconds: 1.5,
              activeDurationSeconds: 1.0,
              damage: 15,
            };
          });
          phaseBBundle.hazards = compiledHazards;
        } else if (seq.kind === 'motionGuide') {
          const cues = (seq.events as MotionCueEvent[])
            .map((c) => ({
              id: c.id,
              startTick: c.startTick ?? c.tick ?? 0,
              durationTicks: c.durationTicks ?? c.duration ?? 0,
              target: c.target ?? (c.sourcePatternId ? patternMap.get(c.sourcePatternId)?.target ?? {} : {}),
              sourcePatternId: c.sourcePatternId,
            }))
            .sort((a, b) => a.startTick - b.startTick);
          phaseBBundle.motionGuide = cues;
        }
      }
    }

    stages[chapterId] = {
      stageId: chapterId,
      tempo: {
        bpm: project.previewTempo.bpm,
        beatsPerBar: project.previewTempo.beatsPerBar,
      },
      phaseA: phaseABundle,
      phaseB: phaseBBundle,
    };
  }

  // Compile unedited required stages backed by explicit builtin profile
  if (options?.builtinProfiles) {
    const builtinStageKeys = Object.keys(options.builtinProfiles).sort();
    for (const bStageKey of builtinStageKeys) {
      if (!stages[bStageKey]) {
        stages[bStageKey] = {
          stageId: bStageKey,
          builtinProfile: options.builtinProfiles[bStageKey],
          tempo: {
            bpm: project.previewTempo.bpm,
            beatsPerBar: project.previewTempo.beatsPerBar,
          },
        };
      }
    }
  }

  // 6. Build Pack & Compute Content Hash
  const rulesetHash = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);
  const pack: PublishedContentPack = {
    kind: PUBLISHED_PACK_KIND,
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    runtimeContractVersion: DEFAULT_RUNTIME_CONTRACT_VERSION,
    rulesetId: project.rulesetId,
    rulesetHash,
    compilerVersion: options?.compilerVersion ?? DEFAULT_COMPILER_VERSION,
    sourceProjectId: project.projectId,
    sourceRevision: project.revision,
    contentHash: '',
    stages,
    metadata: {
      title: project.metadata.title,
      description: project.metadata.description,
      author: project.metadata.author,
      compiledAt: options?.compiledAt ?? new Date().toISOString(),
    },
  };

  const contentHash = computePublishedPackHash(pack);
  pack.contentHash = contentHash;

  // 7. Validate Final Generated Pack
  const postValidation = validatePublishedContentPack(pack);
  if (!postValidation.valid) {
    return {
      success: false,
      ok: false,
      pack: null,
      contentHash: null,
      diagnostics: [...diagnostics, ...postValidation.diagnostics],
      errors: postValidation.errors,
      warnings: postValidation.warnings,
    };
  }

  return {
    success: true,
    ok: true,
    pack,
    contentHash,
    diagnostics,
    errors: [],
    warnings,
  };
}
