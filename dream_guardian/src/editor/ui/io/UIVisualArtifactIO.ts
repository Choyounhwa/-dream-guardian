/**
 * UIVisualArtifactIO.ts - UI 표시 적용본 및 백업 IO 검사·재수입·발행 컨트롤러
 *
 * Issue #468 / UI-VIS-038:
 * - UI 표시 적용본(presentation artifact) 검사 및 재수입(inspection & re-validation)
 * - 해시 변조, 누락 자산, 미지원 capability, 보호 구역 침범 엄격 거부
 * - 외래 파일(피트니스 콘텐츠 팩, 레거시 UIX project/transfer) 오인 및 조용한 채택 원천 차단
 * - Export vs Publish 명확한 구분 및 미저장 문서 게시(publish) 차단
 * - 전체 프로젝트 백업 검사 및 원본·바이너리 자산 복구(restore)
 */

import {
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_BACKUP_KIND,
  UI_BACKUP_SCHEMA_VERSION,
  type UIPresentationArtifact,
  type BuildPresentationInput,
  type BuildPresentationResult,
  type RestoreBackupResult,
  buildPresentationArtifact,
  deserializeBackup,
} from '../data/UIVisualArtifactBuilder';
import { validateUIPresentationDocument } from '../../../data/UIPresentationValidator';
import {
  contentHash,
  artifactHash,
  sourceCheckpointHash,
} from '../data/UICanonicalJSON';
import { RENDERER_FINGERPRINT } from '../data/UIBaselines';
import { validateUIVisualDocument } from '../data/UIVisualValidator';

function cleanUndefined<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(cleanUndefined) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = cleanUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

// Foreign/Legacy kinds that must be explicitly rejected
const FITNESS_PACK_KIND = 'dream-guardian-published-content-pack';
const LEGACY_UIX_PROJECT_KIND = 'dream-guardian-ui-project';
const LEGACY_UIX_TRANSFER_KIND = 'dream-guardian-ui-transfer';

export interface PresentationInspectionResult {
  ok: boolean;
  kindOk: boolean;
  schemaVersionOk: boolean;
  contentHashOk: boolean;
  artifactHashOk: boolean;
  capabilityOk: boolean;
  protectedZonesOk: boolean;
  assetsOk: boolean;
  gameDataFree: boolean;
  sourceCheckpointMatch?: boolean;
  reason?: string;
  errors: string[];
  artifact?: UIPresentationArtifact;
}

export interface BackupInspectionResult {
  ok: boolean;
  kindOk: boolean;
  schemaVersionOk: boolean;
  contentHashOk: boolean;
  backupHashOk: boolean;
  documentOk: boolean;
  assetsOk: boolean;
  reason?: string;
  errors: string[];
}

export interface InspectPresentationOptions {
  originalCheckpoint?: unknown;
  supportedCapabilities?: string[];
}

/**
 * UI 표시 적용본(presentation artifact)의 스키마, 해시, 자산, 보호구역, 외래 여부를 재검사합니다.
 */
export function inspectPresentationArtifact(
  artifactInput: unknown,
  options?: InspectPresentationOptions
): PresentationInspectionResult {
  const errors: string[] = [];

  if (!artifactInput || typeof artifactInput !== 'object') {
    return {
      ok: false,
      kindOk: false,
      schemaVersionOk: false,
      contentHashOk: false,
      artifactHashOk: false,
      capabilityOk: false,
      protectedZonesOk: false,
      assetsOk: false,
      gameDataFree: false,
      reason: 'INVALID_ARTIFACT: 적용본 데이터가 올바른 객체가 아닙니다.',
      errors: ['INVALID_ARTIFACT'],
    };
  }

  const art = artifactInput as any;

  // 1. 외래 포맷 / 레거시 전달 포맷 오인 차단
  if (art.kind === FITNESS_PACK_KIND) {
    return {
      ok: false,
      kindOk: false,
      schemaVersionOk: false,
      contentHashOk: false,
      artifactHashOk: false,
      capabilityOk: false,
      protectedZonesOk: false,
      assetsOk: false,
      gameDataFree: false,
      reason: 'FITNESS_PACK_REJECTED: 피트니스 콘텐츠 팩은 UI 표시 적용본으로 채택할 수 없습니다.',
      errors: ['FITNESS_PACK_REJECTED'],
    };
  }

  if (art.kind === LEGACY_UIX_PROJECT_KIND || art.kind === LEGACY_UIX_TRANSFER_KIND) {
    return {
      ok: false,
      kindOk: false,
      schemaVersionOk: false,
      contentHashOk: false,
      artifactHashOk: false,
      capabilityOk: false,
      protectedZonesOk: false,
      assetsOk: false,
      gameDataFree: false,
      reason: 'LEGACY_TRANSFER_REJECTED: 레거시 UIX 문서는 UI 표시 적용본으로 채택할 수 없습니다.',
      errors: ['LEGACY_TRANSFER_REJECTED'],
    };
  }

  if (art.kind !== UI_PRESENTATION_ARTIFACT_KIND) {
    return {
      ok: false,
      kindOk: false,
      schemaVersionOk: false,
      contentHashOk: false,
      artifactHashOk: false,
      capabilityOk: false,
      protectedZonesOk: false,
      assetsOk: false,
      gameDataFree: false,
      reason: `UNSUPPORTED_KIND: 지원되지 않는 아티팩트 kind입니다 (${String(art.kind)})`,
      errors: ['UNSUPPORTED_KIND'],
    };
  }

  const kindOk = true;

  // 2. 버전 검증
  const schemaVersionOk = art.version === UI_PRESENTATION_VERSION;
  if (!schemaVersionOk) {
    errors.push('UNSUPPORTED_VERSION');
  }

  // 3. 실게임 표시 계약 검증 (보호 구역, 게임 데이터 주입 차단 등)
  const presValidation = validateUIPresentationDocument(art);
  const gameDataFree = !presValidation.errors.some((e) => e.code === 'GAME_DATA_INJECTION');
  const protectedZonesOk = !presValidation.errors.some((e) => e.code === 'PROTECTED_ZONE_ENCROACHMENT');

  if (!presValidation.valid) {
    for (const err of presValidation.errors) {
      errors.push(err.code);
    }
  }

  // 4. Renderer capability 검증
  const supportedFingerprints = options?.supportedCapabilities ?? [RENDERER_FINGERPRINT];
  const capabilityOk = supportedFingerprints.includes(art.rendererFingerprint);
  if (!capabilityOk) {
    errors.push('UNSUPPORTED_CAPABILITY');
  }

  // 5. Content Hash 재계산 및 검증
  let contentHashOk = false;
  try {
    const contentToHash = cleanUndefined({
      manifest: art.manifest,
      pages: art.pages,
      resolution: art.resolution,
    });
    const recomputedContentHash = contentHash(contentToHash);
    contentHashOk = art.contentHash === recomputedContentHash;
  } catch {
    contentHashOk = false;
  }
  if (!contentHashOk) {
    errors.push('CONTENT_HASH_MISMATCH');
  }

  // 6. Artifact Envelope Hash 재계산 및 검증
  let artifactHashOk = false;
  try {
    const recomputedArtifactHash = artifactHash(cleanUndefined(art));
    artifactHashOk = art.integrity?.artifactHash === recomputedArtifactHash;
  } catch {
    artifactHashOk = false;
  }
  if (!artifactHashOk) {
    errors.push('ARTIFACT_HASH_MISMATCH');
  }

  // 7. 자산 검증
  let assetsOk = true;
  if (art.manifest?.assetIds && Array.isArray(art.manifest.assetIds)) {
    // Check manifest assets
    if (art.manifest.assets && Array.isArray(art.manifest.assets)) {
      const manifestIds = new Set(art.manifest.assets.map((a: any) => a.assetId));
      for (const aid of art.manifest.assetIds) {
        if (!manifestIds.has(aid)) {
          assetsOk = false;
          errors.push('MISSING_ASSET');
          break;
        }
      }
    }
  }

  // 8. 원본 체크포인트 대조 (제공된 경우)
  let sourceCheckpointMatch: boolean | undefined = undefined;
  if (options?.originalCheckpoint !== undefined) {
    try {
      const expectedChkHash = sourceCheckpointHash(options.originalCheckpoint);
      sourceCheckpointMatch = art.sourceCheckpointHash === expectedChkHash;
      if (!sourceCheckpointMatch) {
        errors.push('SOURCE_CHECKPOINT_MISMATCH');
      }
    } catch {
      sourceCheckpointMatch = false;
      errors.push('SOURCE_CHECKPOINT_MISMATCH');
    }
  }

  const ok =
    kindOk &&
    schemaVersionOk &&
    gameDataFree &&
    protectedZonesOk &&
    capabilityOk &&
    contentHashOk &&
    artifactHashOk &&
    assetsOk &&
    (sourceCheckpointMatch === undefined || sourceCheckpointMatch);

  return {
    ok,
    kindOk,
    schemaVersionOk,
    contentHashOk,
    artifactHashOk,
    capabilityOk,
    protectedZonesOk,
    assetsOk,
    gameDataFree,
    sourceCheckpointMatch,
    reason: ok ? undefined : errors.join(', '),
    errors,
    artifact: ok ? (art as UIPresentationArtifact) : undefined,
  };
}

/**
 * 게시(Publish): 저장 완료된 체크포인트를 검증하여 게임 스테이지에 적용 가능한 UI 아티팩트로 발행합니다.
 * 미저장(saved=false 또는 dirty=true) 문서의 게시는 거부됩니다.
 */
export function publishPresentationArtifact(input: BuildPresentationInput): BuildPresentationResult {
  return buildPresentationArtifact({
    ...input,
    isPublish: true,
  });
}

/**
 * 추출(Export): 외부 저장/다운로드/미리보기를 위한 휴대용 UI 프레젠테이션 아티팩트를 생성합니다.
 */
export function exportPresentationArtifact(input: BuildPresentationInput): BuildPresentationResult {
  return buildPresentationArtifact({
    ...input,
    isPublish: false,
  });
}

/**
 * 백업(Backup) 파일의 무결성, 스키마, 해시를 검사합니다.
 */
export function inspectBackup(backupInput: unknown): BackupInspectionResult {
  const errors: string[] = [];

  if (!backupInput || typeof backupInput !== 'object') {
    return {
      ok: false,
      kindOk: false,
      schemaVersionOk: false,
      contentHashOk: false,
      backupHashOk: false,
      documentOk: false,
      assetsOk: false,
      reason: 'INVALID_BACKUP',
      errors: ['INVALID_BACKUP'],
    };
  }

  const b = backupInput as any;
  const kindOk = b.kind === UI_BACKUP_KIND;
  if (!kindOk) errors.push('UNSUPPORTED_KIND');

  const schemaVersionOk = b.schemaVersion === UI_BACKUP_SCHEMA_VERSION;
  if (!schemaVersionOk) errors.push('UNSUPPORTED_SCHEMA_VERSION');

  let contentHashOk = false;
  let documentOk = false;
  if (b.document && typeof b.document === 'object') {
    const docVal = validateUIVisualDocument(b.document);
    documentOk = docVal.valid;
    if (!documentOk) {
      for (const e of docVal.errors) errors.push(e.code);
    }
    contentHashOk = contentHash(cleanUndefined(b.document)) === b.contentHash;
  }
  if (!contentHashOk) errors.push('CONTENT_HASH_MISMATCH');

  let backupHashOk = false;
  try {
    backupHashOk = artifactHash(cleanUndefined(b)) === b.integrity?.backupHash;
  } catch {
    backupHashOk = false;
  }
  if (!backupHashOk) errors.push('BACKUP_HASH_MISMATCH');

  const assetsOk = Array.isArray(b.assets);
  if (!assetsOk) errors.push('INVALID_ASSETS');

  const ok = kindOk && schemaVersionOk && contentHashOk && backupHashOk && documentOk && assetsOk;

  return {
    ok,
    kindOk,
    schemaVersionOk,
    contentHashOk,
    backupHashOk,
    documentOk,
    assetsOk,
    reason: ok ? undefined : errors.join(', '),
    errors,
  };
}

/**
 * 전체 백업 JSON 또는 객체로부터 원본 문서 및 이미지 바이너리 bytes를 원자적으로 복구합니다.
 */
export function restoreProjectFromBackup(rawOrObj: string | unknown): RestoreBackupResult {
  return deserializeBackup(rawOrObj);
}
