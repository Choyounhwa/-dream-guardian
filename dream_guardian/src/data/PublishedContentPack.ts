/**
 * PublishedContentPack.ts - 컴파일된 게임 적용본 불변 콘텐츠 팩 타입 및 순수 검증기
 *
 * Issue #377 / EDITOR-COMPILE:
 * - kind: 'dream-guardian-published-content-pack'
 * - schemaVersion, runtimeContractVersion, rulesetId, rulesetHash, compilerVersion
 * - sourceProjectId, sourceRevision, contentHash, stages, metadata
 * - 순수 검증 함수 validatePublishedContentPack(input: unknown): ValidationResult
 * - 변조 감지: contentHash 재계산 비교
 * - 실행 payload에서 메타데이터 타임스탬프 및 UI 상태 제외
 */

import { computeContentHash } from './ContentCanonical.js';
import {
  SUPPORTED_RULESET_IDS,
  SUPPORTED_RUNTIME_VERSIONS,
} from './ContentCapabilities.js';
import type {
  DiagnosticSeverity,
  ValidationDiagnostic,
  ValidationResult,
} from './ProjectValidator.js';

export const PUBLISHED_PACK_KIND = 'dream-guardian-published-content-pack' as const;
export const PUBLISHED_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RUNTIME_CONTRACT_VERSION = '2.0.0' as const;
export const DEFAULT_COMPILER_VERSION = '1.0.0' as const;

export type PublishedPackKind = typeof PUBLISHED_PACK_KIND;

export interface PublishedPackMetadata {
  title: string;
  description?: string;
  author?: string;
  compiledAt?: string;
  publishedAt?: string;
}

export interface ResolvedStarTarget {
  type: 'cursor' | 'foot';
  part?: 'leftHand' | 'rightHand' | 'head' | 'hip';
  foot?: 'leftFoot' | 'rightFoot' | 'centerFoot';
  zoneId: number;
  instrument?: 'hand' | 'foot';
}

export interface CompiledStarNote {
  id: string;
  slotIndex: number;
  landingTick: number;
  landingBeat: number;
  target: ResolvedStarTarget;
  resolvedPartZoneMap?: Record<string, number>;
  sourcePatternId?: string;
}

export interface CompiledPhaseAHazardTimings {
  warningStartBeat: number;
  inputStartBeat: number;
  inputEndBeat: number;
  judgmentBeat: number;
  totalDurationBeats: number;
}

export interface CompiledPhaseAHazard {
  id?: string;
  hazardType: string;
  requiredAction?: string;
  timings?: CompiledPhaseAHazardTimings;
}

export interface CompiledMotionCueTarget {
  leftHand?: number | null;
  rightHand?: number | null;
  head?: number | null;
  hip?: number | null;
}

export interface CompiledMotionCue {
  id?: string;
  startTick: number;
  durationTicks: number;
  target: CompiledMotionCueTarget;
  sourcePatternId?: string;
}

export interface CompiledFeverNote {
  id: string;
  landingTick: number;
  target: ResolvedStarTarget;
  resolvedPartZoneMap?: Record<string, number>;
  sourcePatternId?: string;
}

export interface CompiledPhaseBHazard {
  id?: string;
  attackType: string;
  requiredAction: string;
  warningDurationSeconds?: number;
  activeDurationSeconds?: number;
  damage?: number;
}

export interface CompiledPhaseABundle {
  starNotes?: CompiledStarNote[];
  hazard?: CompiledPhaseAHazard;
  motionGuide?: CompiledMotionCue[];
}

export interface CompiledPhaseBBundle {
  feverNotes?: CompiledFeverNote[];
  hazards?: CompiledPhaseBHazard[];
  hazard?: CompiledPhaseBHazard;
  motionGuide?: CompiledMotionCue[];
}

export interface CompiledStageBundle {
  stageId: string;
  builtinProfile?: string;
  tempo?: {
    bpm: number;
    beatsPerBar: number;
  };
  phaseA?: CompiledPhaseABundle;
  phaseB?: CompiledPhaseBBundle;
}

export interface PublishedContentPack {
  kind: PublishedPackKind;
  schemaVersion: number;
  runtimeContractVersion: string;
  rulesetId: string;
  rulesetHash: string;
  compilerVersion: string;
  sourceProjectId: string;
  sourceRevision: number;
  contentHash: string;
  stages: Record<string, CompiledStageBundle>;
  metadata: PublishedPackMetadata;
}

/**
 * 실행에 직접적인 영향을 미치는 페이로드만 추출합니다.
 * UI 선택 상태, 컴파일 일시, 메타데이터 타임스탬프 등은 제외됩니다.
 */
export function extractExecutionPayload(pack: PublishedContentPack): Record<string, unknown> {
  return {
    compilerVersion: pack.compilerVersion,
    kind: pack.kind,
    rulesetHash: pack.rulesetHash,
    rulesetId: pack.rulesetId,
    runtimeContractVersion: pack.runtimeContractVersion,
    sourceProjectId: pack.sourceProjectId,
    sourceRevision: pack.sourceRevision,
    stages: pack.stages,
  };
}

/**
 * PublishedContentPack의 순수 실행 contentHash를 계산합니다.
 */
export function computePublishedPackHash(pack: PublishedContentPack): string {
  const payload = extractExecutionPayload(pack);
  return computeContentHash(payload);
}

/**
 * PublishedContentPack 객체의 순수 무결성 및 변조 여부를 검증합니다.
 */
export function validatePublishedContentPack(input: unknown): ValidationResult {
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

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    addDiagnostic('invalid-pack-root', 'root', 'PublishedContentPack must be a non-null object');
    return {
      valid: false,
      ok: false,
      diagnostics,
      errors: diagnostics,
      warnings: [],
    };
  }

  const pack = input as Partial<PublishedContentPack>;

  // 1. Kind
  if (pack.kind !== PUBLISHED_PACK_KIND) {
    addDiagnostic(
      'invalid-pack-kind',
      'kind',
      `Pack kind must be "${PUBLISHED_PACK_KIND}", received: "${String(pack.kind)}"`,
    );
  }

  // 2. Runtime Contract Version
  if (
    typeof pack.runtimeContractVersion !== 'string' ||
    !(SUPPORTED_RUNTIME_VERSIONS as readonly string[]).includes(pack.runtimeContractVersion)
  ) {
    addDiagnostic(
      'unsupported-runtime-version',
      'runtimeContractVersion',
      `Runtime contract version "${String(pack.runtimeContractVersion)}" is unsupported. Supported: ${SUPPORTED_RUNTIME_VERSIONS.join(', ')}`,
    );
  }

  // 3. Ruleset ID
  if (
    typeof pack.rulesetId !== 'string' ||
    !(SUPPORTED_RULESET_IDS as readonly string[]).includes(pack.rulesetId as any)
  ) {
    addDiagnostic(
      'unsupported-ruleset-id',
      'rulesetId',
      `Ruleset ID "${String(pack.rulesetId)}" is unsupported. Supported: ${SUPPORTED_RULESET_IDS.join(', ')}`,
    );
  }

  // 4. Ruleset Hash
  if (typeof pack.rulesetHash !== 'string' || pack.rulesetHash.length !== 64) {
    addDiagnostic(
      'invalid-ruleset-hash',
      'rulesetHash',
      'rulesetHash must be a 64-character SHA-256 hex string',
    );
  }

  // 5. Compiler Version
  if (typeof pack.compilerVersion !== 'string' || pack.compilerVersion.trim().length === 0) {
    addDiagnostic(
      'invalid-compiler-version',
      'compilerVersion',
      'compilerVersion must be a non-empty string',
    );
  }

  // 6. Source Project ID & Revision
  if (typeof pack.sourceProjectId !== 'string' || pack.sourceProjectId.trim().length === 0) {
    addDiagnostic(
      'invalid-source-project-id',
      'sourceProjectId',
      'sourceProjectId must be a non-empty string',
    );
  }

  if (
    typeof pack.sourceRevision !== 'number' ||
    !Number.isInteger(pack.sourceRevision) ||
    pack.sourceRevision < 0
  ) {
    addDiagnostic(
      'invalid-source-revision',
      'sourceRevision',
      'sourceRevision must be a non-negative integer',
    );
  }

  // 7. Stages
  if (pack.stages === null || typeof pack.stages !== 'object' || Array.isArray(pack.stages)) {
    addDiagnostic('invalid-stages', 'stages', 'stages must be a non-null record');
  } else {
    const stageKeys = Object.keys(pack.stages);
    if (stageKeys.length === 0) {
      addDiagnostic('empty-stages', 'stages', 'stages must contain at least one stage bundle');
    }

    for (const stageKey of stageKeys) {
      const stage = pack.stages[stageKey];
      if (!stage || typeof stage !== 'object') {
        addDiagnostic('invalid-stage-bundle', `stages[${stageKey}]`, 'Stage bundle must be an object');
        continue;
      }
      if (typeof stage.stageId !== 'string' || stage.stageId !== stageKey) {
        addDiagnostic(
          'stage-id-mismatch',
          `stages[${stageKey}].stageId`,
          `stageId "${String(stage.stageId)}" must match stage key "${stageKey}"`,
        );
      }
      // Stage must either have a builtinProfile or compiled phases
      const hasBuiltin = typeof stage.builtinProfile === 'string' && stage.builtinProfile.trim().length > 0;
      const hasPhaseA = stage.phaseA != null;
      const hasPhaseB = stage.phaseB != null;
      if (!hasBuiltin && !hasPhaseA && !hasPhaseB) {
        addDiagnostic(
          'incomplete-stage-bundle',
          `stages[${stageKey}]`,
          `Stage "${stageKey}" must have either an explicit builtinProfile or at least one compiled phase`,
        );
      }
    }
  }

  // 8. Content Hash & Tamper Detection
  if (typeof pack.contentHash !== 'string' || pack.contentHash.length !== 64) {
    addDiagnostic(
      'invalid-content-hash-format',
      'contentHash',
      'contentHash must be a 64-character SHA-256 hex string',
    );
  } else if (pack.kind === PUBLISHED_PACK_KIND && pack.stages) {
    // Only attempt tamper check if envelope is structurally intact
    try {
      const computed = computePublishedPackHash(pack as PublishedContentPack);
      if (computed !== pack.contentHash) {
        addDiagnostic(
          'tampered-content-hash',
          'contentHash',
          `Tampered content detected: computed hash "${computed}" does not match declared hash "${pack.contentHash}"`,
        );
      }
    } catch (err) {
      addDiagnostic(
        'hash-computation-failed',
        'contentHash',
        `Failed to compute hash for pack: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  return {
    valid: errors.length === 0,
    ok: errors.length === 0,
    diagnostics,
    errors,
    warnings,
  };
}
