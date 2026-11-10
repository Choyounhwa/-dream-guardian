/**
 * ContentLoadService.ts - 로컬 게시본 수신·호환 재검증·요청 수명 관리 서비스
 *
 * Issue #389 / CONTENT-LOAD & Issue #637 / REFACTOR-SRP-006:
 * - 책임 레이어: Core (src/core/)
 * - 중요 규칙: src/editor/ 모듈 절대 import 금지
 * - 명시 요청된 동일 origin 로컬 게시본(PublishedContentPack / IndexedDB or 로컬 provider) 로드 수명 관리
 * - Request generation(생성 번호) 및 AbortController를 통한 요청 취소 / 응답 역전(Race Condition) 방지
 * - 최신 요청보다 오래된 비동기 응답은 폐기 (Out-of-order response 방지)
 * - 런타임 지원 rulesetVersion/rulesetHash 및 contentHash 재검증 (ContentPackValidator 위임)
 * - 활성 팩, 이전 정상본, 메모리 캐시 수명 관리 (ContentCacheManager 위임)
 * - 조작된 팩, 불완전 팩 거부 및 fallback 반환
 * - 편집 원본 초안(EditorProject kind)이나 UIX 파일, 레거시 V1 키 수신 차단
 * - 로드 결과: success, fallback, cancelled 반환
 * - 타 포트/외부 저장소 공유 및 원격 네트워크 업로드 없음
 */

import { type PublishedContentPack } from '../data/PublishedContentPack.js';
import {
  ContentPackValidator,
  STATIC_MANIFEST_KIND,
  STATIC_MANIFEST_VERSION,
  DEFAULT_STATIC_MANIFEST_URL,
  type StaticContentManifest,
} from './content/ContentPackValidator.js';
import { ContentCacheManager } from './content/ContentCacheManager.js';

export {
  STATIC_MANIFEST_KIND,
  STATIC_MANIFEST_VERSION,
  DEFAULT_STATIC_MANIFEST_URL,
  type StaticContentManifest,
};

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
  previousHealthyPack?: PublishedContentPack;
  signal?: AbortSignal;
  allowedOrigin?: string;
  fetchFn?: typeof fetch;
  isTestMode?: boolean;
}

export interface StaticManifestLoadOptions extends ContentLoadOptions {
  manifestUrl?: string;
}

export interface ContentLoadServiceConfig {
  defaultStore?: IPublishedContentStore;
  allowedOrigin?: string;
  defaultFallbackPack?: PublishedContentPack;
  validator?: ContentPackValidator;
  cacheManager?: ContentCacheManager;
}

/**
 * 로컬 게시본 수신 및 수명 관리 서비스
 */
export class ContentLoadService {
  private _currentGeneration = 0;
  private _activeAbortController: AbortController | null = null;
  private readonly _defaultStore?: IPublishedContentStore;
  private readonly _allowedOrigin?: string;
  private readonly _defaultFallbackPack?: PublishedContentPack;
  private readonly _validator: ContentPackValidator;
  private readonly _cacheManager: ContentCacheManager;

  constructor(config?: ContentLoadServiceConfig) {
    this._defaultStore = config?.defaultStore;
    this._allowedOrigin = config?.allowedOrigin ?? (typeof window !== 'undefined' ? window.location?.origin : undefined);
    this._defaultFallbackPack = config?.defaultFallbackPack;
    this._validator = config?.validator ?? new ContentPackValidator();
    this._cacheManager = config?.cacheManager ?? new ContentCacheManager();
  }

  /**
   * 현재 활성화된(검증 통과된) 팩
   */
  get currentPack(): PublishedContentPack | null {
    return this._cacheManager.currentPack;
  }

  /**
   * 이전에 검증 통과된 최근 정상 팩 (오프라인/에러 시 whole-pack fallback 대상)
   */
  get previousHealthyPack(): PublishedContentPack | null {
    return this._cacheManager.previousHealthyPack;
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
    return this._cacheManager.lastResult;
  }

  /**
   * 연결된 검증기 인스턴스
   */
  get validator(): ContentPackValidator {
    return this._validator;
  }

  /**
   * 연결된 캐시 관리자 인스턴스
   */
  get cacheManager(): ContentCacheManager {
    return this._cacheManager;
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
    this._cacheManager.clear();
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
    const fallbackPack = this.resolveFallback(options);

    if (this.isAborted(abortController, options?.signal)) {
      return this.createCancelledResult('cancelled', 'Request was cancelled before execution', generation);
    }

    try {
      const parsed = typeof rawInput === 'string' ? this.tryParseJson(rawInput) : rawInput;
      const verifyResult = this.verifyPackContent(parsed, fallbackPack, generation);

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
        fallbackPack,
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
    const fallbackPack = this.resolveFallback(options);

    if (!store) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-unavailable',
        diagnostic: 'No IPublishedContentStore provided',
        fallbackPack,
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
          fallbackPack,
          generation,
        });
      }

      const verifyResult = this.verifyPackContent(pack, fallbackPack, generation);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack,
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
    const fallbackPack = this.resolveFallback(options);

    if (!store || typeof store.getActivePack !== 'function') {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-unavailable',
        diagnostic: 'Store does not support getActivePack',
        fallbackPack,
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
          fallbackPack,
          generation,
        });
      }

      const verifyResult = this.verifyPackContent(pack, fallbackPack, generation);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack,
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
    const fallbackPack = this.resolveFallback(options);

    // Origin 검증: 상대 경로는 허용, 절대 URL인 경우 origin 일치 확인
    const originCheck = this._validator.validateUrlOrigin(url, allowedOrigin);
    if (!originCheck.valid) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'cross-origin-forbidden',
        diagnostic: originCheck.error ?? 'Forbidden cross-origin or invalid URL',
        fallbackPack,
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
        fallbackPack,
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
          fallbackPack,
          generation,
        });
      }

      const raw = await response.json();

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }

      const verifyResult = this.verifyPackContent(raw, fallbackPack, generation);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'fetch-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack,
        generation,
      });
    }
  }

  /**
   * 로컬 테스트 오버라이드 (명시적 ?mode=test 환경에서만 허용)
   */
  async loadLocalTestOverride(
    identifier: string,
    options?: ContentLoadOptions,
  ): Promise<ContentLoadResult> {
    const generation = this.beginRequest();
    const abortController = this._activeAbortController!;
    const fallbackPack = this.resolveFallback(options);

    // 명시적 test mode 검증: 일반 운영 환경에서는 로컬 팩 오버라이드 차단
    if (!this.isTestModeActive(options)) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'test-override-forbidden',
        diagnostic: 'Local store override is only allowed in explicit test mode (?mode=test)',
        fallbackPack,
        generation,
      });
    }

    const store = options?.store ?? this._defaultStore;
    if (!store) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-unavailable',
        diagnostic: 'IPublishedContentStore is not configured for local test override',
        fallbackPack,
        generation,
      });
    }

    if (this.isAborted(abortController, options?.signal)) {
      return this.createCancelledResult('cancelled', 'Request was cancelled', generation);
    }

    try {
      let pack: PublishedContentPack | null = null;
      if (typeof store.getPublishedPack === 'function') {
        pack = await store.getPublishedPack(identifier);
      }
      if (!pack && typeof store.getActivePack === 'function') {
        pack = await store.getActivePack(identifier);
      }

      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }

      if (!pack) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'pack-not-found',
          diagnostic: `No published pack found in store for: ${identifier}`,
          fallbackPack,
          generation,
        });
      }

      const verifyResult = this.verifyPackContent(pack, fallbackPack, generation);
      return this.finalizeResult(verifyResult);
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'store-error',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack,
        generation,
      });
    }
  }

  /**
   * 정적 배포 manifest(content/manifest.json 등) 수신 및 전체 검증
   *
   * Issue #403 / CONTENT-DEPLOY:
   * - manifest schema, manifestVersion, contentHash, rulesetId, rulesetHash, runtimeContractVersion 검증
   * - packPath 및 pack 데이터의 무결성 검증
   * - 404, 손상된 JSON, 부분 배포, stale cache(캐시 불일치) 감지 시 whole-pack fallback
   * - 정상 통과 시 deepFreeze 불변 스냅샷 생성 및 _previousHealthyPack 갱신
   */
  async loadStaticManifest(
    manifestUrl: string = DEFAULT_STATIC_MANIFEST_URL,
    options?: StaticManifestLoadOptions,
  ): Promise<ContentLoadResult> {
    const generation = this.beginRequest();
    const abortController = this._activeAbortController!;
    const fallbackPack = this.resolveFallback(options);
    const allowedOrigin = options?.allowedOrigin ?? this._allowedOrigin;

    // 1. Origin 검증
    const originCheck = this._validator.validateUrlOrigin(manifestUrl, allowedOrigin);
    if (!originCheck.valid) {
      return this.finalizeResult({
        status: 'fallback',
        reason: 'cross-origin-forbidden',
        diagnostic: originCheck.error ?? 'Forbidden cross-origin manifest URL',
        fallbackPack,
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
        fallbackPack,
        generation,
      });
    }

    // 2. Manifest 파일 fetch
    let manifestRaw: unknown;
    try {
      const res = await fetchImpl(manifestUrl, { signal: abortController.signal });
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      if (!res.ok) {
        return this.finalizeResult({
          status: 'fallback',
          reason: res.status === 404 ? 'manifest-not-found' : 'fetch-failed',
          diagnostic: `HTTP ${res.status}: ${res.statusText || 'Failed to fetch manifest'}`,
          fallbackPack,
          generation,
        });
      }
      manifestRaw = await res.json();
    } catch (err) {
      if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
        return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
      }
      if (err instanceof SyntaxError) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'corrupted-json',
          diagnostic: `Failed to parse manifest JSON: ${err.message}`,
          fallbackPack,
          generation,
        });
      }
      return this.finalizeResult({
        status: 'fallback',
        reason: 'fetch-failed',
        diagnostic: err instanceof Error ? err.message : String(err),
        fallbackPack,
        generation,
      });
    }

    if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
      return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
    }

    // 3. Manifest 스키마 및 호환성 검증
    const manifestValidation = this._validator.validateManifest(manifestRaw);
    if (!manifestValidation.valid) {
      return this.finalizeResult({
        status: 'fallback',
        reason: manifestValidation.reason,
        diagnostic: manifestValidation.diagnostic,
        fallbackPack,
        generation,
      });
    }
    const manifest = manifestValidation.manifest;

    // 4. 팩 획득 (inline pack 또는 packPath/packUrl fetch)
    let packRaw: unknown;
    if (manifest.pack && typeof manifest.pack === 'object') {
      packRaw = manifest.pack;
    } else {
      const rawPackPath = manifest.packPath ?? manifest.packUrl;
      if (!rawPackPath || typeof rawPackPath !== 'string') {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'partial-deployment',
          diagnostic: 'Manifest does not provide pack or valid packPath/packUrl',
          fallbackPack,
          generation,
        });
      }

      const packFullUrl = this.resolvePackUrl(manifestUrl, rawPackPath);

      const packOriginCheck = this._validator.validateUrlOrigin(packFullUrl, allowedOrigin);
      if (!packOriginCheck.valid) {
        return this.finalizeResult({
          status: 'fallback',
          reason: 'cross-origin-forbidden',
          diagnostic: packOriginCheck.error ?? 'Pack asset URL forbidden cross-origin',
          fallbackPack,
          generation,
        });
      }

      try {
        const packRes = await fetchImpl(packFullUrl, { signal: abortController.signal });
        if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
          return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
        }
        if (!packRes.ok) {
          return this.finalizeResult({
            status: 'fallback',
            reason: 'partial-deployment',
            diagnostic: `Pack asset request failed: ${packRes.status} (${packRes.statusText || 'Error'})`,
            fallbackPack,
            generation,
          });
        }
        packRaw = await packRes.json();
      } catch (err) {
        if (this.isStaleOrAborted(generation, abortController, options?.signal)) {
          return this.createCancelledResult('superseded', `Request generation ${generation} superseded`, generation);
        }
        if (err instanceof SyntaxError) {
          return this.finalizeResult({
            status: 'fallback',
            reason: 'corrupted-json',
            diagnostic: `Failed to parse pack JSON: ${err.message}`,
            fallbackPack,
            generation,
          });
        }
        return this.finalizeResult({
          status: 'fallback',
          reason: 'partial-deployment',
          diagnostic: `Pack fetch error: ${err instanceof Error ? err.message : String(err)}`,
          fallbackPack,
          generation,
        });
      }
    }

    // 5. 팩 콘텐츠 무결성 및 호환성 검증
    const verifyResult = this.verifyPackContent(packRaw, fallbackPack, generation);
    if (verifyResult.status !== 'success') {
      return this.finalizeResult(verifyResult);
    }

    const verifiedPack = verifyResult.pack;

    // 6. Stale cache 및 Manifest <-> Pack 일관성 검증
    const matchValidation = this._validator.validatePackAgainstManifest(verifiedPack, manifest, {
      mismatchReason: 'stale-cache',
    });
    if (!matchValidation.valid) {
      return this.finalizeResult({
        status: 'fallback',
        reason: matchValidation.reason,
        diagnostic: matchValidation.diagnostic,
        fallbackPack,
        generation,
      });
    }

    // 7. 정상 통과: previousHealthyPack 갱신 및 반환
    this._cacheManager.setPreviousHealthyPack(verifiedPack);

    return this.finalizeResult({
      status: 'success',
      pack: verifiedPack,
      generation,
    });
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
    this._cacheManager.setLastResult(result);
    return result;
  }

  private resolveFallback(options?: ContentLoadOptions): PublishedContentPack | undefined {
    return (
      options?.previousHealthyPack ??
      this._cacheManager.previousHealthyPack ??
      options?.fallbackPack ??
      this._defaultFallbackPack
    );
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private isTestModeActive(options?: ContentLoadOptions): boolean {
    if (options?.isTestMode !== undefined) {
      return Boolean(options.isTestMode);
    }
    if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'test';
      } catch {
        return false;
      }
    }
    return false;
  }

  private verifyPackContent(
    input: unknown,
    fallbackPack?: PublishedContentPack,
    generation: number = this._currentGeneration,
  ): ContentLoadResult {
    const result = this._validator.validatePackContent(input);
    if (!result.valid) {
      return {
        status: 'fallback',
        reason: result.reason,
        diagnostic: result.diagnostic,
        fallbackPack,
        generation,
      };
    }
    return {
      status: 'success',
      pack: result.pack,
      generation,
    };
  }

  private resolvePackUrl(manifestUrl: string, rawPackPath: string): string {
    let packFullUrl = rawPackPath;
    if (manifestUrl.startsWith('http://') || manifestUrl.startsWith('https://')) {
      try {
        const baseObj = new URL(manifestUrl);
        if (rawPackPath.startsWith('/')) {
          packFullUrl = new URL(rawPackPath, baseObj.origin).toString();
        } else if (rawPackPath.startsWith('./') || rawPackPath.startsWith('../')) {
          packFullUrl = new URL(rawPackPath, manifestUrl).toString();
        } else {
          const manifestDir = baseObj.pathname.substring(0, baseObj.pathname.lastIndexOf('/') + 1);
          const firstSegment = rawPackPath.split('/')[0];
          if (manifestDir.includes(`/${firstSegment}/`)) {
            packFullUrl = new URL(rawPackPath, baseObj.origin).toString();
          } else {
            packFullUrl = new URL(rawPackPath, manifestUrl).toString();
          }
        }
      } catch {
        packFullUrl = rawPackPath;
      }
    } else if (
      rawPackPath.startsWith('/') ||
      rawPackPath.startsWith('./') ||
      rawPackPath.startsWith('../') ||
      !rawPackPath.includes('://')
    ) {
      const lastSlash = manifestUrl.lastIndexOf('/');
      if (lastSlash >= 0) {
        const baseDir = manifestUrl.substring(0, lastSlash + 1);
        packFullUrl = rawPackPath.startsWith('/') ? rawPackPath : `${baseDir}${rawPackPath}`;
      }
    }
    return packFullUrl;
  }
}
