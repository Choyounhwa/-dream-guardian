/**
 * UIPresentationLoadService.ts - 피트니스와 분리된 UI 표시 적용본 로더
 *
 * Issue #470 / UI-VIS-040:
 * - 책임 레이어: Core / UI 수신 (src/core/)
 * - 중요 규칙: src/editor/ 모듈 및 DB 절대 import 금지 (Core 경계 보존)
 * - UI 전용 artifact(`kind: 'dream-guardian-ui-presentation'`)와 asset bundle 명시적 수신 및 재검증
 * - ContentLoadService와의 철저한 분리:
 *   피트니스 팩, 레거시 에디터 초안(authoring/ui-project), 레거시 UI transfer 수신 시 즉각 거부 및 whole-snapshot fallback
 * - 무결성 및 보안 검증:
 *   kind, version(1.0.0), contentHash, artifactHash, renderer capability('menu-renderer-v1'),
 *   10개 정식 페이지 ID 및 11개 피트니스 보호 구역/판정선 침범 검증
 * - 임의 URL fetch, 외부 프로토콜(http, https 등), 스크립트 실행(script, javascript 등) 완전 차단
 * - 승인된 정적 catalog 또는 검증된 포함 이미지 bytes(SHA-256)만 안전하게 해석
 * - 수명 관리: generation 번호 및 AbortSignal 지원으로 race condition, stale, cancelled 안전 처리
 * - 무결성 훼손/누락/변조 시 부분 적용(partial apply) 절대 금지 (0건),
 *   전체 builtin 기본 UI 표시 스냅샷(whole-snapshot fallback)으로 즉각 안전 복귀
 * - 반환 스냅샷은 Object.freeze로 완전 동결되어 런타임 변형 차단
 */

import {
  createDefaultUIPresentationDocument,
  type UIPresentationDocument,
  type UIPresentationPage,
  type UIPresentationPageId,
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_DESIGN_CANVAS,
} from '../data/UIPresentation.js';
import { validateUIPresentationDocument } from '../data/UIPresentationValidator.js';
import { computeContentHash } from '../data/ContentCanonical.js';

export const DEFAULT_RENDERER_CAPABILITY = 'menu-renderer-v1' as const;
export const SUPPORTED_RENDERER_CAPABILITIES: readonly string[] = Object.freeze([
  DEFAULT_RENDERER_CAPABILITY,
]);

export interface VisualArtifactAssetEntry {
  assetId: string;
  contentHash: string;
  mimeType?: string;
  byteLength?: number;
  data?: Uint8Array | ArrayBuffer | string;
}

export interface UIPresentationArtifact extends UIPresentationDocument {
  baseline?: string;
  rendererFingerprint?: string;
  sourceProjectId?: string;
  sourceRevision?: number;
  sourceCheckpointId?: string;
  sourceCheckpointHash?: string;
  contentHash?: string;
  integrity?: {
    artifactHash: string;
    algorithm: 'sha256' | string;
  };
  manifest?: {
    assetIds: string[];
    assets?: VisualArtifactAssetEntry[];
  };
}

export type UIPresentationLoadStatus = 'success' | 'fallback' | 'cancelled';

export interface UIPresentationLoadSuccessResult {
  status: 'success';
  presentation: Readonly<UIPresentationDocument>;
  artifact?: Readonly<UIPresentationArtifact>;
  generation: number;
  contentHash?: string;
  artifactHash?: string;
}

export interface UIPresentationLoadFallbackResult {
  status: 'fallback';
  reason: string;
  diagnostic: string;
  fallbackPresentation: Readonly<UIPresentationDocument>;
  generation: number;
  candidateHash?: string;
  candidateRevision?: number;
}

export interface UIPresentationLoadCancelledResult {
  status: 'cancelled';
  reason: string;
  diagnostic?: string;
  generation: number;
}

export type UIPresentationLoadResult =
  | UIPresentationLoadSuccessResult
  | UIPresentationLoadFallbackResult
  | UIPresentationLoadCancelledResult;

export interface UIPresentationLoadOptions {
  signal?: AbortSignal;
  assets?: Record<string, Uint8Array | ArrayBuffer | string | VisualArtifactAssetEntry> | VisualArtifactAssetEntry[];
  fallbackPresentation?: UIPresentationDocument;
  previousHealthyPresentation?: UIPresentationDocument;
  allowedRendererFingerprints?: string[];
  approvedCatalogAssetIds?: string[] | Set<string>;
}

export interface UIPresentationLoadServiceConfig {
  allowedRendererFingerprints?: string[];
  defaultFallbackPresentation?: UIPresentationDocument;
  approvedCatalogAssetIds?: string[] | Set<string>;
}

// ---------------------------------------------------------------------------
// Pure SHA-256 implementation for Uint8Array bytes
// ---------------------------------------------------------------------------
const K_SHA256: readonly number[] = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256BytesHex(bytes: Uint8Array): string {
  const len = bytes.length;
  const bitLen = len * 8;
  const blockCount = ((len + 9 + 63) >>> 6);
  const buffer = new Uint8Array(blockCount * 64);
  buffer.set(bytes);
  buffer[len] = 0x80;

  const view = new DataView(buffer.buffer);
  const byteOffset = blockCount * 64 - 8;
  view.setUint32(byteOffset, Math.floor(bitLen / 0x100000000) >>> 0, false);
  view.setUint32(byteOffset + 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const W = new Uint32Array(64);

  for (let b = 0; b < blockCount; b++) {
    const chunkOffset = b * 64;
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(chunkOffset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15];
      const s0 =
        ((w15 >>> 7) | (w15 << 25)) ^
        ((w15 >>> 18) | (w15 << 14)) ^
        (w15 >>> 3);
      const w2 = W[i - 2];
      const s1 =
        ((w2 >>> 17) | (w2 << 15)) ^
        ((w2 >>> 19) | (w2 << 13)) ^
        (w2 >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = h0;
    let bReg = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K_SHA256[i] + W[i]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & bReg) ^ (a & c) ^ (bReg & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = bReg;
      bReg = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + bReg) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (
    toHex(h0) +
    toHex(h1) +
    toHex(h2) +
    toHex(h3) +
    toHex(h4) +
    toHex(h5) +
    toHex(h6) +
    toHex(h7)
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj as Readonly<T>;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj as Readonly<T>;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /data:/i,
  /blob:/i,
  /file:/i,
  /onerror=/i,
  /onload=/i,
  /eval\(/i,
  /^https?:\/\//i,
  /https?:\/\//i,
];

function containsDangerousPattern(val: unknown): string | null {
  if (typeof val === 'string') {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(val)) {
        return `Dangerous pattern matched: ${val}`;
      }
    }
  } else if (Array.isArray(val)) {
    for (const item of val) {
      const danger = containsDangerousPattern(item);
      if (danger) return danger;
    }
  } else if (val && typeof val === 'object') {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const danger = containsDangerousPattern(v);
      if (danger) return danger;
    }
  }
  return null;
}

function extractEnvelope(artifact: UIPresentationArtifact): Record<string, unknown> {
  const envelope: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(artifact)) {
    if (key !== 'integrity' && value !== undefined) {
      envelope[key] = value;
    }
  }
  return envelope;
}

function normalizeAssetBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === 'string') {
    // If base64 or raw string
    try {
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(data, 'base64');
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      const bin = atob(data);
      const ab = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        ab[i] = bin.charCodeAt(i);
      }
      return ab;
    } catch {
      return new TextEncoder().encode(data);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// UIPresentationLoadService
// ---------------------------------------------------------------------------
export class UIPresentationLoadService {
  private _currentGeneration = 0;
  private _activeAbortController: AbortController | null = null;
  private _currentPresentation: Readonly<UIPresentationDocument> | null = null;
  private _currentArtifact: Readonly<UIPresentationArtifact> | null = null;
  private _previousHealthyPresentation: Readonly<UIPresentationDocument> | null = null;
  private _lastResult: UIPresentationLoadResult | null = null;

  private readonly _allowedRendererFingerprints: readonly string[];
  private readonly _defaultFallbackPresentation: Readonly<UIPresentationDocument>;
  private readonly _approvedCatalogAssetIds: Set<string>;

  constructor(config?: UIPresentationLoadServiceConfig) {
    this._allowedRendererFingerprints = Object.freeze(
      config?.allowedRendererFingerprints ?? [...SUPPORTED_RENDERER_CAPABILITIES]
    );
    this._defaultFallbackPresentation = deepFreeze(
      config?.defaultFallbackPresentation
        ? deepClone(config.defaultFallbackPresentation)
        : createDefaultUIPresentationDocument()
    );
    this._approvedCatalogAssetIds = new Set(config?.approvedCatalogAssetIds ?? []);
  }

  get currentPresentation(): Readonly<UIPresentationDocument> | null {
    return this._currentPresentation;
  }

  get currentArtifact(): Readonly<UIPresentationArtifact> | null {
    return this._currentArtifact;
  }

  get previousHealthyPresentation(): Readonly<UIPresentationDocument> | null {
    return this._previousHealthyPresentation;
  }

  get currentGeneration(): number {
    return this._currentGeneration;
  }

  get lastResult(): UIPresentationLoadResult | null {
    return this._lastResult;
  }

  cancelCurrentRequest(reason: string = 'Cancelled by caller'): void {
    if (this._activeAbortController) {
      this._activeAbortController.abort(reason);
      this._activeAbortController = null;
    }
  }

  reset(): void {
    this.cancelCurrentRequest('Reset service state');
    this._currentGeneration = 0;
    this._currentPresentation = null;
    this._currentArtifact = null;
    this._previousHealthyPresentation = null;
    this._lastResult = null;
  }

  /**
   * UI 전용 적용본 로드 및 수명 관리
   */
  async loadPresentation(
    input: unknown,
    options?: UIPresentationLoadOptions
  ): Promise<UIPresentationLoadResult> {
    const generation = this.beginRequest();
    const activeController = this._activeAbortController!;

    // Yield microtask to allow async cancellation & concurrency resolution
    await Promise.resolve();

    if (this.isStaleOrAborted(generation, activeController, options?.signal)) {
      return this.finalizeResult({
        status: 'cancelled',
        reason: options?.signal?.aborted ? 'aborted' : 'superseded',
        diagnostic: `Load request generation ${generation} was aborted or superseded by generation ${this._currentGeneration}`,
        generation,
      });
    }

    const effectiveFallback = this.getEffectiveFallback(options);

    // 1. 입력 파싱 및 기본 검사
    const parsed = typeof input === 'string' ? this.tryParseJson(input) : input;
    if (!parsed || typeof parsed !== 'object') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'invalid-input',
        diagnostic: 'Input must be a valid JSON object or string',
        fallbackPresentation: effectiveFallback,
        generation,
      });
    }

    const record = parsed as Record<string, unknown>;
    const candidateHash = typeof record.contentHash === 'string' ? record.contentHash : undefined;
    const candidateRevision = typeof record.sourceRevision === 'number' ? record.sourceRevision : undefined;

    // 2. 피트니스 팩 및 레거시 프로젝트 수신 차단 (철저한 분리)
    if (record.kind === 'dream-guardian-published-content-pack') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'rejected-fitness-content-pack',
        diagnostic:
          'Fitness content pack ("dream-guardian-published-content-pack") cannot be loaded as UI presentation. Use ContentLoadService instead.',
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    if (record.kind === 'dream-guardian-authoring-project') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'rejected-legacy-project',
        diagnostic: 'Editor authoring project cannot be loaded as UI presentation.',
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    if (record.kind === 'dream-guardian-ui-project') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'rejected-editor-project',
        diagnostic: 'UI editor project cannot be loaded as UI presentation.',
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    if (record.kind === 'dream-guardian-ui-transfer') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'rejected-legacy-transfer',
        diagnostic: 'Legacy UI transfer data cannot be loaded as UI presentation.',
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    if (record.kind !== UI_PRESENTATION_ARTIFACT_KIND) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'unsupported-kind',
        diagnostic: `Artifact kind must be "${UI_PRESENTATION_ARTIFACT_KIND}", got "${String(record.kind)}"`,
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    // 3. 버전 검증
    if (record.version !== UI_PRESENTATION_VERSION) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'unsupported-version',
        diagnostic: `Unsupported presentation version: "${String(record.version)}", expected "${UI_PRESENTATION_VERSION}"`,
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    // 4. Renderer capability 검증
    const rendererFingerprint = record.rendererFingerprint;
    const allowedCapabilities = options?.allowedRendererFingerprints ?? this._allowedRendererFingerprints;
    if (rendererFingerprint && !allowedCapabilities.includes(rendererFingerprint as string)) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'unsupported-renderer-capability',
        diagnostic: `Renderer capability "${String(rendererFingerprint)}" is not supported by runtime. Supported: ${allowedCapabilities.join(', ')}`,
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    // 5. 보안 및 외부 URL/스크립트 실행 차단 검증
    const danger = containsDangerousPattern(record);
    if (danger) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'security-violation',
        diagnostic: `Security policy violation detected: ${danger}`,
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    // 6. UI 계약 및 10개 정식 페이지 / 11개 피트니스 보호 구역 침범 검증
    const contractResult = validateUIPresentationDocument(record);
    if (!contractResult.valid) {
      const diagnostic = contractResult.errors.map((e) => `[${e.code}] ${e.message} (${e.path ?? ''})`).join('; ');
      return this.finalizeResult({
        status: 'fallback',
        reason: 'contract-validation-failed',
        diagnostic: `UI presentation contract validation failed: ${diagnostic}`,
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    // 7. contentHash 무결성 재검증
    if (typeof record.contentHash === 'string') {
      const contentToHash = cleanUndefined({
        manifest: record.manifest ?? { assetIds: [] },
        pages: record.pages,
        resolution: record.resolution ?? { width: UI_DESIGN_CANVAS.width, height: UI_DESIGN_CANVAS.height },
      });
      const computedContentHash = computeContentHash(contentToHash);
      if (computedContentHash !== record.contentHash) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'content-hash-mismatch',
          diagnostic: `Content hash mismatch: declared "${record.contentHash}", computed "${computedContentHash}"`,
          fallbackPresentation: effectiveFallback,
          generation,
          candidateHash,
          candidateRevision,
        });
      }
    }

    // 8. artifactHash 무결성 재검증
    const integrity = record.integrity as { artifactHash?: string; algorithm?: string } | undefined;
    if (integrity && typeof integrity.artifactHash === 'string') {
      const envelope = extractEnvelope(record as unknown as UIPresentationArtifact);
      const computedArtifactHash = computeContentHash(cleanUndefined(envelope));
      if (computedArtifactHash !== integrity.artifactHash) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'artifact-hash-mismatch',
          diagnostic: `Artifact hash mismatch: declared "${integrity.artifactHash}", computed "${computedArtifactHash}"`,
          fallbackPresentation: effectiveFallback,
          generation,
          candidateHash,
          candidateRevision,
        });
      }
    }

    // 9. 자산 번들 및 승인 카탈로그 검증
    const assetValidation = this.validateAssets(record as unknown as UIPresentationArtifact, options);
    if (!assetValidation.valid) {
      return this.finalizeResult({
        status: 'fallback',
        reason: assetValidation.reason ?? 'asset-validation-failed',
        diagnostic: assetValidation.diagnostic ?? 'Asset validation failed',
        fallbackPresentation: effectiveFallback,
        generation,
        candidateHash,
        candidateRevision,
      });
    }

    // 10. 지연/취소 여부 최종 확인
    if (this.isStaleOrAborted(generation, activeController, options?.signal)) {
      return this.finalizeResult({
        status: 'cancelled',
        reason: options?.signal?.aborted ? 'aborted' : 'superseded',
        diagnostic: `Load request generation ${generation} was aborted or superseded`,
        generation,
      });
    }

    // 11. 최종 성공: deepFreeze 적용 및 상태 갱신 (Zero Partial Apply 보장)
    const presentationDoc: UIPresentationDocument = {
      kind: UI_PRESENTATION_ARTIFACT_KIND,
      version: UI_PRESENTATION_VERSION,
      resolution: (record.resolution as any) ?? { width: UI_DESIGN_CANVAS.width, height: UI_DESIGN_CANVAS.height },
      pages: record.pages as Record<UIPresentationPageId, UIPresentationPage>,
      manifest: (record.manifest as any) ?? { assetIds: [] },
    };

    const frozenPresentation = deepFreeze(deepClone(presentationDoc));
    const frozenArtifact = deepFreeze(deepClone(record as unknown as UIPresentationArtifact));

    if (this._currentPresentation) {
      this._previousHealthyPresentation = this._currentPresentation;
    }
    this._currentPresentation = frozenPresentation;
    this._currentArtifact = frozenArtifact;

    return this.finalizeResult({
      status: 'success',
      presentation: frozenPresentation,
      artifact: frozenArtifact,
      generation,
      contentHash: candidateHash,
      artifactHash: integrity?.artifactHash,
    });
  }

  // --- 내부 헬퍼 메서드 ---

  private beginRequest(): number {
    this.cancelCurrentRequest('New presentation load initiated');
    this._currentGeneration++;
    this._activeAbortController = new AbortController();
    return this._currentGeneration;
  }

  private isStaleOrAborted(
    generation: number,
    controller: AbortController,
    externalSignal?: AbortSignal
  ): boolean {
    return (
      generation !== this._currentGeneration ||
      controller.signal.aborted ||
      (externalSignal?.aborted ?? false)
    );
  }

  private finalizeResult(result: UIPresentationLoadResult): UIPresentationLoadResult {
    this._lastResult = result;
    return result;
  }

  private getEffectiveFallback(options?: UIPresentationLoadOptions): Readonly<UIPresentationDocument> {
    if (options?.fallbackPresentation) {
      return deepFreeze(deepClone(options.fallbackPresentation));
    }
    if (options?.previousHealthyPresentation) {
      return deepFreeze(deepClone(options.previousHealthyPresentation));
    }
    if (this._previousHealthyPresentation) {
      return this._previousHealthyPresentation;
    }
    return this._defaultFallbackPresentation;
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private validateAssets(
    artifact: UIPresentationArtifact,
    options?: UIPresentationLoadOptions
  ): { valid: boolean; reason?: string; diagnostic?: string } {
    const approvedCatalog = new Set<string>([
      ...this._approvedCatalogAssetIds,
      ...(options?.approvedCatalogAssetIds ?? []),
    ]);

    // Build asset map from options and manifest
    const assetMap = new Map<string, VisualArtifactAssetEntry>();

    if (artifact.manifest?.assets && Array.isArray(artifact.manifest.assets)) {
      for (const a of artifact.manifest.assets) {
        if (a && a.assetId) assetMap.set(a.assetId, a);
      }
    }

    if (options?.assets) {
      if (Array.isArray(options.assets)) {
        for (const a of options.assets) {
          if (a && a.assetId) assetMap.set(a.assetId, a);
        }
      } else if (typeof options.assets === 'object') {
        for (const [key, val] of Object.entries(options.assets)) {
          if (val && typeof val === 'object' && 'assetId' in val) {
            assetMap.set((val as VisualArtifactAssetEntry).assetId, val as VisualArtifactAssetEntry);
          } else if (val) {
            assetMap.set(key, { assetId: key, contentHash: '', data: val as any });
          }
        }
      }
    }

    // Collect all referenced asset IDs in pages
    const referencedAssetIds = new Set<string>();
    if (artifact.manifest?.assetIds && Array.isArray(artifact.manifest.assetIds)) {
      for (const id of artifact.manifest.assetIds) {
        referencedAssetIds.add(id);
      }
    }

    if (artifact.pages && typeof artifact.pages === 'object') {
      for (const page of Object.values(artifact.pages)) {
        if (page && Array.isArray(page.elements)) {
          for (const el of page.elements) {
            if (el && typeof el.assetId === 'string') {
              referencedAssetIds.add(el.assetId);
            }
          }
        }
      }
    }

    // Verify each referenced asset
    for (const assetId of referencedAssetIds) {
      if (approvedCatalog.has(assetId)) {
        continue;
      }

      const entry = assetMap.get(assetId);
      if (!entry) {
        return {
          valid: false,
          reason: 'missing-asset',
          diagnostic: `Referenced asset "${assetId}" is missing from bundle and catalog`,
        };
      }

      if (entry.data !== undefined) {
        const bytes = normalizeAssetBytes(entry.data);
        if (!bytes) {
          return {
            valid: false,
            reason: 'invalid-asset-data',
            diagnostic: `Asset "${assetId}" contains unparseable data`,
          };
        }

        const computedHash = sha256BytesHex(bytes);
        if (entry.contentHash && computedHash !== entry.contentHash) {
          return {
            valid: false,
            reason: 'asset-hash-mismatch',
            diagnostic: `Asset "${assetId}" SHA-256 mismatch: declared "${entry.contentHash}", computed "${computedHash}"`,
          };
        }
      }
    }

    return { valid: true };
  }
}
