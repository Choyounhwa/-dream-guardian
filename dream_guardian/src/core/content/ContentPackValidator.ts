/**
 * ContentPackValidator.ts - 로컬 게시본 스키마 무결성, 룰셋 호환성, 해시 다이제스트 검증기
 *
 * Issue #637 / REFACTOR-SRP-006:
 * - ContentLoadService로부터 스키마/해시/매니페스트/오리진 검증 로직을 분리
 * - 중요 규칙: src/editor/ 모듈 절대 import 금지
 * - 단일 파일 500줄 이하 엄격 유지
 */

import {
  type PublishedContentPack,
  PUBLISHED_PACK_KIND,
  PUBLISHED_SCHEMA_VERSION,
  validatePublishedContentPack,
  computePublishedPackHash,
} from '../../data/PublishedContentPack.js';
import { computeContentHash } from '../../data/ContentCanonical.js';
import {
  SUPPORTED_RULESET_IDS,
  SUPPORTED_RUNTIME_VERSIONS,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
} from '../../data/ContentCapabilities.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

export const STATIC_MANIFEST_KIND = 'dream-guardian-static-manifest' as const;
export const STATIC_MANIFEST_VERSION = 1 as const;
export const DEFAULT_STATIC_MANIFEST_URL = 'content/manifest.json' as const;

export const EXPECTED_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

export interface StaticContentManifest {
  kind?: string;
  manifestVersion: number;
  contentHash: string;
  rulesetId: string;
  rulesetHash: string;
  runtimeContractVersion: string;
  packPath?: string;
  packUrl?: string;
  pack?: PublishedContentPack;
  stages?: string[];
  metadata?: {
    title?: string;
    description?: string;
    deployedAt?: string;
    version?: string;
    author?: string;
  };
}

export type PackValidationResult =
  | { valid: true; pack: PublishedContentPack }
  | { valid: false; reason: string; diagnostic: string };

export type ManifestValidationResult =
  | { valid: true; manifest: StaticContentManifest }
  | { valid: false; reason: string; diagnostic: string };

export type PackManifestMatchResult =
  | { valid: true }
  | { valid: false; reason: string; diagnostic: string };

export interface UrlOriginValidationResult {
  valid: boolean;
  error?: string;
}

export class ContentPackValidator {
  /**
   * PublishedContentPack 원시 데이터의 스키마, 룰셋 호환성 및 해시 무결성 전체 검증
   */
  validatePackContent(input: unknown): PackValidationResult {
    if (!input || typeof input !== 'object') {
      return {
        valid: false,
        reason: 'invalid-input-type',
        diagnostic: `Expected object, got ${typeof input}`,
      };
    }

    const record = input as Record<string, unknown>;

    // 1. 에디터 저작 초안(EditorProject kind) 차단
    if (record.kind === 'dream-guardian-authoring-project') {
      return {
        valid: false,
        reason: 'rejected-authoring-project',
        diagnostic: 'Editor draft ("dream-guardian-authoring-project") cannot be loaded as runtime executable pack',
      };
    }

    // 2. UIX 파일 차단
    if (
      typeof record.kind === 'string' &&
      (record.kind === 'dream-guardian-ui-project' ||
        record.kind === 'dream-guardian-ui-transfer' ||
        record.kind.startsWith('dream-guardian-ui-'))
    ) {
      return {
        valid: false,
        reason: 'rejected-uix-content',
        diagnostic: `UIX content ("${record.kind}") cannot be loaded as game content pack`,
      };
    }

    // 3. 레거시 V1 포맷 차단
    if (
      record.version === '1.0.0' &&
      (record.sequences !== undefined || record.patterns !== undefined)
    ) {
      return {
        valid: false,
        reason: 'rejected-legacy-v1',
        diagnostic: 'Legacy V1 format cannot be loaded directly as runtime pack',
      };
    }

    // 4. Kind 일치 여부 확인
    if (record.kind !== PUBLISHED_PACK_KIND) {
      return {
        valid: false,
        reason: 'invalid-pack-kind',
        diagnostic: `Pack kind must be "${PUBLISHED_PACK_KIND}", got "${String(record.kind)}"`,
      };
    }

    // 5. 필수 필드 누락 여부 확인
    if (
      record.schemaVersion === undefined ||
      record.runtimeContractVersion === undefined ||
      record.rulesetId === undefined ||
      record.rulesetHash === undefined ||
      record.contentHash === undefined ||
      record.stages === undefined
    ) {
      return {
        valid: false,
        reason: 'missing-required-fields',
        diagnostic: 'Missing required fields in pack payload',
      };
    }

    // 6. 스키마 버전 검증
    if (record.schemaVersion !== PUBLISHED_SCHEMA_VERSION) {
      return {
        valid: false,
        reason: 'unsupported-schema-version',
        diagnostic: `Unsupported schemaVersion: ${String(record.schemaVersion)}, expected: ${PUBLISHED_SCHEMA_VERSION}`,
      };
    }

    const pack = record as unknown as PublishedContentPack;

    // 7. 런타임 지원 계약 버전 검증
    if (
      typeof pack.runtimeContractVersion !== 'string' ||
      !(SUPPORTED_RUNTIME_VERSIONS as readonly string[]).includes(pack.runtimeContractVersion)
    ) {
      return {
        valid: false,
        reason: 'unsupported-runtime-version',
        diagnostic: `Runtime version "${String(pack.runtimeContractVersion)}" is not supported`,
      };
    }

    // 7. 룰셋 식별자 검증
    if (
      typeof pack.rulesetId !== 'string' ||
      !(SUPPORTED_RULESET_IDS as readonly string[]).includes(pack.rulesetId as any)
    ) {
      return {
        valid: false,
        reason: 'unsupported-ruleset',
        diagnostic: `Ruleset "${String(pack.rulesetId)}" is not supported`,
      };
    }

    // 8. 룰셋 해시 검증
    if (pack.rulesetHash !== EXPECTED_RULESET_HASH) {
      return {
        valid: false,
        reason: 'unsupported-ruleset-hash',
        diagnostic: `Ruleset hash mismatch: expected ${EXPECTED_RULESET_HASH}, got ${pack.rulesetHash}`,
      };
    }

    // 9. 구조 및 변조(tamper) 검증 (validatePublishedContentPack)
    const validation = validatePublishedContentPack(pack);
    if (!validation.valid) {
      const isTampered = validation.errors.some((e) => e.code === 'tampered-content-hash');
      const isIncomplete = validation.errors.some((e) => e.code === 'incomplete-stage-bundle');

      const reason = isTampered
        ? 'tampered-content-hash'
        : isIncomplete
          ? 'incomplete-pack'
          : 'invalid-pack-structure';

      return {
        valid: false,
        reason,
        diagnostic: validation.errors.map((e) => e.message).join('; '),
      };
    }

    // 10. 콘텐츠 해시(contentHash) 재계산 일치 여부 재확인
    const computedHash = computePublishedPackHash(pack);
    if (pack.contentHash !== computedHash) {
      return {
        valid: false,
        reason: 'tampered-content-hash',
        diagnostic: `Tampered content hash: ${pack.contentHash}, computed: ${computedHash}`,
      };
    }

    // 11. 스테이지 완성도 검증 (완전한 페이즈 구성 확인)
    if (!pack.stages || Object.keys(pack.stages).length === 0) {
      return {
        valid: false,
        reason: 'incomplete-pack',
        diagnostic: 'Pack has no stages defined',
      };
    }

    for (const [stageKey, stage] of Object.entries(pack.stages)) {
      const hasBuiltin = typeof stage.builtinProfile === 'string' && stage.builtinProfile.trim().length > 0;
      const hasPhaseA = stage.phaseA != null;
      const hasPhaseB = stage.phaseB != null;

      if (!hasBuiltin && (!hasPhaseA || !hasPhaseB)) {
        return {
          valid: false,
          reason: 'incomplete-pack',
          diagnostic: `Stage "${stageKey}" is incomplete (requires both phaseA and phaseB or builtinProfile)`,
        };
      }
    }

    // 12. deepFreeze 적용 및 불변 팩 반환
    const frozenPack = deepFreeze(structuredClone(pack));
    return {
      valid: true,
      pack: frozenPack,
    };
  }

  /**
   * 단일 팩 해시 무결성 검증 헬퍼
   */
  validatePackHash(pack: PublishedContentPack): boolean {
    return pack.contentHash === computePublishedPackHash(pack);
  }

  /**
   * 룰셋 호환성 검증 헬퍼
   */
  validateRulesetCompatibility(pack: PublishedContentPack): {
    compatible: boolean;
    reason?: string;
    diagnostic?: string;
  } {
    if (!(SUPPORTED_RUNTIME_VERSIONS as readonly string[]).includes(pack.runtimeContractVersion)) {
      return {
        compatible: false,
        reason: 'unsupported-runtime-version',
        diagnostic: `Unsupported runtimeContractVersion: ${pack.runtimeContractVersion}`,
      };
    }
    if (!(SUPPORTED_RULESET_IDS as readonly string[]).includes(pack.rulesetId)) {
      return {
        compatible: false,
        reason: 'unsupported-ruleset',
        diagnostic: `Unsupported rulesetId: ${pack.rulesetId}`,
      };
    }
    if (pack.rulesetHash !== EXPECTED_RULESET_HASH) {
      return {
        compatible: false,
        reason: 'unsupported-ruleset-hash',
        diagnostic: `Ruleset hash mismatch: ${pack.rulesetHash}`,
      };
    }
    return { compatible: true };
  }

  /**
   * 정적 매니페스트(StaticContentManifest) 스키마 및 호환성 검증
   */
  validateManifest(manifestRaw: unknown): ManifestValidationResult {
    if (!manifestRaw || typeof manifestRaw !== 'object') {
      return {
        valid: false,
        reason: 'invalid-manifest-schema',
        diagnostic: 'Manifest payload must be an object',
      };
    }

    const manifest = manifestRaw as Partial<StaticContentManifest>;

    if (manifest.manifestVersion !== STATIC_MANIFEST_VERSION) {
      return {
        valid: false,
        reason: 'unsupported-manifest-version',
        diagnostic: `Unsupported manifest version: ${manifest.manifestVersion}, expected: ${STATIC_MANIFEST_VERSION}`,
      };
    }

    if (typeof manifest.contentHash !== 'string' || manifest.contentHash.length !== 64) {
      return {
        valid: false,
        reason: 'invalid-manifest-hash',
        diagnostic: 'Manifest contentHash must be a 64-character hex string',
      };
    }

    if (
      typeof manifest.rulesetId !== 'string' ||
      !(SUPPORTED_RULESET_IDS as readonly string[]).includes(manifest.rulesetId)
    ) {
      return {
        valid: false,
        reason: 'unsupported-ruleset-id',
        diagnostic: `Unsupported manifest rulesetId: ${String(manifest.rulesetId)}`,
      };
    }

    if (manifest.rulesetHash !== EXPECTED_RULESET_HASH) {
      return {
        valid: false,
        reason: 'unsupported-ruleset-hash',
        diagnostic: `Unsupported manifest rulesetHash: ${String(manifest.rulesetHash)}, expected: ${EXPECTED_RULESET_HASH}`,
      };
    }

    if (
      typeof manifest.runtimeContractVersion !== 'string' ||
      !(SUPPORTED_RUNTIME_VERSIONS as readonly string[]).includes(manifest.runtimeContractVersion)
    ) {
      return {
        valid: false,
        reason: 'unsupported-runtime-version',
        diagnostic: `Unsupported manifest runtimeContractVersion: ${String(manifest.runtimeContractVersion)}`,
      };
    }

    return {
      valid: true,
      manifest: manifest as StaticContentManifest,
    };
  }

  /**
   * 매니페스트와 실제 로드된 팩 간의 해시 및 스테이지 바인딩 정합성 검증
   */
  validatePackAgainstManifest(
    pack: PublishedContentPack,
    manifest: StaticContentManifest,
    options?: { mismatchReason?: string },
  ): PackManifestMatchResult {
    const mismatchReason = options?.mismatchReason ?? 'hash-mismatch';

    if (pack.contentHash !== manifest.contentHash) {
      return {
        valid: false,
        reason: mismatchReason,
        diagnostic: `Manifest contentHash (${manifest.contentHash}) does not match pack contentHash (${pack.contentHash})`,
      };
    }

    if (manifest.rulesetHash && pack.rulesetHash !== manifest.rulesetHash) {
      return {
        valid: false,
        reason: mismatchReason,
        diagnostic: `Manifest rulesetHash (${manifest.rulesetHash}) does not match pack rulesetHash (${pack.rulesetHash})`,
      };
    }

    if (manifest.runtimeContractVersion && pack.runtimeContractVersion !== manifest.runtimeContractVersion) {
      return {
        valid: false,
        reason: mismatchReason,
        diagnostic: `Manifest runtimeContractVersion (${manifest.runtimeContractVersion}) does not match pack runtimeContractVersion (${pack.runtimeContractVersion})`,
      };
    }

    if (manifest.rulesetId && pack.rulesetId !== manifest.rulesetId) {
      return {
        valid: false,
        reason: mismatchReason,
        diagnostic: `Manifest rulesetId (${manifest.rulesetId}) does not match pack rulesetId (${pack.rulesetId})`,
      };
    }

    if (Array.isArray(manifest.stages) && manifest.stages.length > 0) {
      for (const requiredStageId of manifest.stages) {
        if (!pack.stages || !pack.stages[requiredStageId]) {
          return {
            valid: false,
            reason: 'incomplete-pack',
            diagnostic: `Pack is missing declared stage binding from manifest: "${requiredStageId}"`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 로드 대상 URL origin 유효성 및 보안 검증
   */
  validateUrlOrigin(url: string, allowedOrigin?: string): UrlOriginValidationResult {
    if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
      return { valid: false, error: 'Disallowed URL protocol' };
    }

    // 상대 경로는 동일 origin으로 간주
    if (url.startsWith('/') && !url.startsWith('//')) {
      return { valid: true };
    }

    try {
      const parsed = new URL(url, allowedOrigin ?? 'http://localhost');
      if (allowedOrigin) {
        const allowed = new URL(allowedOrigin);
        if (parsed.origin !== allowed.origin) {
          return {
            valid: false,
            error: `Cross-origin request to ${parsed.origin} not allowed (expected ${allowed.origin})`,
          };
        }
      }
      return { valid: true };
    } catch {
      return { valid: false, error: `Malformed URL: ${url}` };
    }
  }
}
