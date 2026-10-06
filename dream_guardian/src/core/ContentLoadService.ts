/**
 * ContentLoadService.ts - 로컬 게시본 수신·호환 재검증·요청 수명 관리 서비스
 *
 * Issue #389 / CONTENT-LOAD:
 * - 책임 레이어: Core (src/core/)
 * - 중요 규칙: src/editor/ 모듈 절대 import 금지
 * - 명시 요청된 동일 origin 로컬 게시본(PublishedContentPack / IndexedDB or 로컬 provider) 로드 수명 관리
 * - Request generation(생성 번호) 및 AbortController를 통한 요청 취소 / 응답 역전(Race Condition) 방지
 * - 최신 요청보다 오래된 비동기 응답은 폐기 (Out-of-order response 방지)
 * - 런타임 지원 rulesetVersion/rulesetHash 및 contentHash 재검증
 * - 조작된 팩, 불완전 팩 거부 및 fallback 반환
 * - 편집 원본 초안(EditorProject kind)이나 UIX 파일, 레거시 V1 키 수신 차단
 * - 로드 결과: success, fallback, cancelled 반환
 * - 타 포트/외부 저장소 공유 및 원격 네트워크 업로드 없음
 */

import {
  type PublishedContentPack,
  PUBLISHED_PACK_KIND,
  validatePublishedContentPack,
} from '../data/PublishedContentPack.js';
import { computeContentHash } from '../data/ContentCanonical.js';
import {
  SUPPORTED_RULESET_IDS,
  SUPPORTED_RUNTIME_VERSIONS,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
} from '../data/ContentCapabilities.js';

const EXPECTED_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

/**
 * 게시본 스토어 인터페이스 (IndexedDB 등 로컬 스토어 어댑터)
 */
export interface IPublishedContentStore {
  getPublishedPack(contentHash: string): Promise<PublishedContentPack | null>;
  getActivePack?(projectId: string): Promise<PublishedContentPack | null>;
}

export type ContentLoadStatus = 'success' | 'fallback' | 'cancelled';

export interface ContentLoadSuccessResult {
  status: 'success';
  pack: PublishedContentPack;
  generation: number;
}

export interface ContentLoadFallbackResult {
  status: 'fallback';
  reason: string;
  diagnostic: string;
  fallbackPack?: PublishedContentPack;
  generation: number;
}

export interface ContentLoadCancelledResult {
  status: 'cancelled';
  reason: string;
  diagnostic?: string;
  generation: number;
}

export type ContentLoadResult =
  | ContentLoadSuccessResult
  | ContentLoadFallbackResult
  | ContentLoadCancelledResult;

export interface ContentLoadOptions {
  store?: IPublishedContentStore;
  fallbackPack?: PublishedContentPack;
  signal?: AbortSignal;
  allowedOrigin?: string;
  fetchFn?: typeof fetch;
}

export interface ContentLoadServiceConfig {
  defaultStore?: IPublishedContentStore;
  allowedOrigin?: string;
  defaultFallbackPack?: PublishedContentPack;
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'object' && val !== null) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * 로컬 게시본 수신 및 수명 관리 서비스
 */
export class ContentLoadService {
  private _currentGeneration = 0;
  private _activeAbortController: AbortController | null = null;
  private _currentPack: PublishedContentPack | null = null;
  private _lastResult: ContentLoadResult | null = null;
  private readonly _defaultStore?: IPublishedContentStore;
  private readonly _allowedOrigin?: string;
  private readonly _defaultFallbackPack?: PublishedContentPack;

  constructor(config?: ContentLoadServiceConfig) {
    this._defaultStore = config?.defaultStore;
    this._allowedOrigin = config?.allowedOrigin ?? (typeof window !== 'undefined' ? window.location?.origin : undefined);
    this._defaultFallbackPack = config?.defaultFallbackPack;
  }

  /**
   * 현재 활성화된(검증 통과된) 팩
   */
  get currentPack(): PublishedContentPack | null {
    return this._currentPack;
  }

  /**
   * 현재 요청 생성 번호
   */
  get currentGeneration(): number {
    return this._currentGeneration;
  }

  /**
   * 가장 최근에 완료된 로드 결과
   */
  get lastResult(): ContentLoadResult | null {
    return this._lastResult;
  }

  /**
   * 현재 진행 중인 로드 요청 즉시 취소
   */
  cancelCurrentRequest(reason: string = 'Cancelled by caller'): void {
    if (this._activeAbortController) {
      this._activeAbortController.abort(reason);
      this._activeAbortController = null;
    }
  }

  /**
   * 메모리 상태 초기화
   */
  reset(): void {
    this.cancelCurrentRequest('Service reset');
    this._currentPack = null;
    this._lastResult = null;
  }

  /**
   * PublishedContentPack 객체 또는 원시 데이터를 직접 로드 및 검증
   */
  async loadPack(
    rawInput: unknown,
    options?: ContentLoadOptions,
  ): Promise<ContentLoadResult> {
    const generation = this.beginRequest();
    const abortController = this._activeAbortController!;

    if (this.isAborted(abortController, options?.signal)) {
      return this.createCancelledResult('cancelled', 'Request was cancelled before execution', generation);
    }

    try {
      const parsed = typeof rawInput === 'string' ? this.tryParseJson(rawInput) : rawInput;
      const verifyResult = this.verifyPackContent(parsed, options);

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} was superseded or aborted`, generation);
      }

      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} was superseded or aborted`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'unexpected-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }
  }

  /**
   * 스토어로부터 contentHash를 통해 게시본 로드 및 검증
   */
  async loadByHash(
    contentHash: string,
    options?: ContentLoadOptions,
  ): Promise<ContentLoadResult> {
    const generation = this.beginRequest();
    const abortController = this._activeAbortController!;
    const store = options?.store ?? this._defaultStore;

    if (!store) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-unavailable',
        diagnostic: 'No IPublishedContentStore provided',
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }

    if (this.isAborted(abortController, options?.signal)) {
      return this.createCancelledResult('cancelled', 'Request was cancelled', generation);
    }

    try {
      const pack = await store.getPublishedPack(contentHash);

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }

      if (!pack) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'pack-not-found',
          diagnostic: `Pack not found in store for hash: ${contentHash}`,
          fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
          generation,
        });
      }

      const verifyResult = this.verifyPackContent(pack, options);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }
  }

  /**
   * 스토어로부터 projectId의 활성(active) 팩 로드 및 검증
   */
  async loadByProjectId(
    projectId: string,
    options?: ContentLoadOptions,
  ): Promise<ContentLoadResult> {
    const generation = this.beginRequest();
    const abortController = this._activeAbortController!;
    const store = options?.store ?? this._defaultStore;

    if (!store || typeof store.getActivePack !== 'function') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-unavailable',
        diagnostic: 'Store does not support getActivePack',
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }

    if (this.isAborted(abortController, options?.signal)) {
      return this.createCancelledResult('cancelled', 'Request was cancelled', generation);
    }

    try {
      const pack = await store.getActivePack(projectId);

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }

      if (!pack) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'pack-not-found',
          diagnostic: `No active pack found for project: ${projectId}`,
          fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
          generation,
        });
      }

      const verifyResult = this.verifyPackContent(pack, options);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }
  }

  /**
   * 동일 Origin의 URL로부터 팩 fetch 및 검증
   */
  async loadFromUrl(
    url: string,
    options?: ContentLoadOptions,
  ): Promise<ContentLoadResult> {
    const generation = this.beginRequest();
    const abortController = this._activeAbortController!;

    const allowedOrigin = options?.allowedOrigin ?? this._allowedOrigin;

    // Origin 검증: 상대 경로는 허용, 절대 URL인 경우 origin 일치 확인
    const originCheck = this.validateUrlOrigin(url, allowedOrigin);
    if (!originCheck.valid) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'cross-origin-forbidden',
        diagnostic: originCheck.error ?? 'Forbidden cross-origin or invalid URL',
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }

    if (this.isAborted(abortController, options?.signal)) {
      return this.createCancelledResult('cancelled', 'Request was cancelled', generation);
    }

    const fetchImpl = options?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    if (!fetchImpl) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'fetch-unavailable',
        diagnostic: 'Fetch function is not available',
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }

    try {
      const response = await fetchImpl(url, { signal: abortController.signal });

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }

      if (!response.ok) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'fetch-failed',
          diagnostic: `HTTP ${response.status}: ${response.statusText}`,
          fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
          generation,
        });
      }

      const raw = await response.json();

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }

      const verifyResult = this.verifyPackContent(raw, options);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'fetch-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack: options?.fallbackPack ?? this._defaultFallbackPack,
        generation,
      });
    }
  }

  // --- 내부 검증 및 수명 관리 헬퍼 ---

  private beginRequest(): number {
    this.cancelCurrentRequest('New load request initiated');
    this._currentGeneration++;
    this._activeAbortController = new AbortController();
    return this._currentGeneration;
  }

  private isAborted(controller: AbortController, externalSignal?: AbortSignal): boolean {
    return controller.signal.aborted || (externalSignal?.aborted ?? false);
  }

  private isStaleOrAborted(generation: number, controller: AbortController, externalSignal?: AbortSignal): boolean {
    return generation !== this._currentGeneration || this.isAborted(controller, externalSignal);
  }

  private createCancelledResult(reason: string, diagnostic: string, generation: number): ContentLoadCancelledResult {
    return {
      status: 'cancelled',
      reason,
      diagnostic,
      generation,
    };
  }

  private finalizeResult(result: ContentLoadResult): ContentLoadResult {
    this._lastResult = result;
    if (result.status === 'success') {
      this._currentPack = result.pack;
    }
    return result;
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private validateUrlOrigin(url: string, allowedOrigin?: string): { valid: boolean; error?: string } {
    if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
      return { valid: false, error: 'Disallowed URL protocol' };
    }

    // 상대 경로 (/api/...)는 동일 origin으로 간주
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

  /**
   * 팩 콘텐츠 무결성 및 호환성 상세 검증
   */
  private verifyPackContent(
    input: unknown,
    options?: ContentLoadOptions,
  ): ContentLoadResult {
    const generation = this._currentGeneration;
    const fallbackPack = options?.fallbackPack ?? this._defaultFallbackPack;

    if (!input || typeof input !== 'object') {
      return {
        status: 'fallback',
        reason: 'invalid-input-type',
        diagnostic: `Expected object, got ${typeof input}`,
        fallbackPack,
        generation,
      };
    }

    const record = input as Record<string, unknown>;

    // 1. 초안(EditorProject kind) 차단
    if (record.kind === 'dream-guardian-authoring-project') {
      return {
        status: 'fallback',
        reason: 'rejected-authoring-project',
        diagnostic: 'Editor draft ("dream-guardian-authoring-project") cannot be loaded as runtime executable pack',
        fallbackPack,
        generation,
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
        status: 'fallback',
        reason: 'rejected-uix-content',
        diagnostic: `UIX content ("${record.kind}") cannot be loaded as game content pack`,
        fallbackPack,
        generation,
      };
    }

    // 3. 레거시 V1 포맷 차단
    if (
      record.version === '1.0.0' &&
      (record.sequences !== undefined || record.patterns !== undefined)
    ) {
      return {
        status: 'fallback',
        reason: 'rejected-legacy-v1',
        diagnostic: 'Legacy V1 format cannot be loaded directly as runtime pack',
        fallbackPack,
        generation,
      };
    }

    // 4. Kind 일치 여부 확인
    if (record.kind !== PUBLISHED_PACK_KIND) {
      return {
        status: 'fallback',
        reason: 'invalid-pack-kind',
        diagnostic: `Pack kind must be "${PUBLISHED_PACK_KIND}", got "${String(record.kind)}"`,
        fallbackPack,
        generation,
      };
    }

    const pack = record as unknown as PublishedContentPack;

    // 5. 런타임 버전 호환성 검증
    if (
      typeof pack.runtimeContractVersion !== 'string' ||
      !(SUPPORTED_RUNTIME_VERSIONS as readonly string[]).includes(pack.runtimeContractVersion)
    ) {
      return {
        status: 'fallback',
        reason: 'unsupported-runtime-version',
        diagnostic: `Runtime version "${String(pack.runtimeContractVersion)}" is not supported`,
        fallbackPack,
        generation,
      };
    }

    // 6. rulesetId 검증
    if (
      typeof pack.rulesetId !== 'string' ||
      !(SUPPORTED_RULESET_IDS as readonly string[]).includes(pack.rulesetId as any)
    ) {
      return {
        status: 'fallback',
        reason: 'unsupported-ruleset',
        diagnostic: `Ruleset "${String(pack.rulesetId)}" is not supported`,
        fallbackPack,
        generation,
      };
    }

    // 7. rulesetHash 검증
    if (pack.rulesetHash !== EXPECTED_RULESET_HASH) {
      return {
        status: 'fallback',
        reason: 'unsupported-ruleset-hash',
        diagnostic: `Ruleset hash mismatch: expected ${EXPECTED_RULESET_HASH}, got ${pack.rulesetHash}`,
        fallbackPack,
        generation,
      };
    }

    // 8. 구조 및 tamper(변조) 검증
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
        status: 'fallback',
        reason,
        diagnostic: validation.errors.map((e) => e.message).join('; '),
        fallbackPack,
        generation,
      };
    }

    // 9. 페이즈 완전성 재검사 (각 스테이지별 최소 1개 페이즈 또는 builtinProfile 필수)
    if (!pack.stages || Object.keys(pack.stages).length === 0) {
      return {
        status: 'fallback',
        reason: 'incomplete-pack',
        diagnostic: 'Pack has no stages defined',
        fallbackPack,
        generation,
      };
    }

    for (const [stageKey, stage] of Object.entries(pack.stages)) {
      const hasBuiltin = typeof stage.builtinProfile === 'string' && stage.builtinProfile.trim().length > 0;
      const hasPhaseA = stage.phaseA != null;
      const hasPhaseB = stage.phaseB != null;

      if (!hasBuiltin && (!hasPhaseA || !hasPhaseB)) {
        return {
          status: 'fallback',
          reason: 'incomplete-pack',
          diagnostic: `Stage "${stageKey}" is incomplete (requires both phaseA and phaseB or builtinProfile)`,
          fallbackPack,
          generation,
        };
      }
    }

    // 10. deepFreeze 적용 및 성공 반환
    const frozenPack = deepFreeze(structuredClone(pack));
    return {
      status: 'success',
      pack: frozenPack,
      generation,
    };
  }
}
