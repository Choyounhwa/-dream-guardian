/**
 * ContentCacheManager.ts - 로컬 게시본 메모리 캐시 및 활성/대체본 상태 관리자
 *
 * Issue #637 / REFACTOR-SRP-006:
 * - ContentLoadService로부터 메모리 캐시 및 이전 정상본/활성본 수명 관리 분리
 * - 중요 규칙: src/editor/ 모듈 절대 import 금지
 * - 단일 파일 500줄 이하 엄격 유지
 */

import type { PublishedContentPack } from '../../data/PublishedContentPack.js';
import type { ContentLoadResult } from '../ContentLoadService.js';

export class ContentCacheManager {
  private _currentPack: PublishedContentPack | null = null;
  private _previousHealthyPack: PublishedContentPack | null = null;
  private _lastResult: ContentLoadResult | null = null;
  private readonly _cacheByHash: Map<string, PublishedContentPack> = new Map();
  private readonly _cacheByProjectId: Map<string, PublishedContentPack> = new Map();

  /**
   * 현재 활성화된(검증 통과된) 팩
   */
  get currentPack(): PublishedContentPack | null {
    return this._currentPack;
  }

  /**
   * 최근 검증 통과된 정상 팩 (오프라인/에러 발생 시 whole-pack fallback 대상)
   */
  get previousHealthyPack(): PublishedContentPack | null {
    return this._previousHealthyPack;
  }

  /**
   * 가장 최근에 완료된 로드 결과
   */
  get lastResult(): ContentLoadResult | null {
    return this._lastResult;
  }

  /**
   * 캐시된 팩 수
   */
  get size(): number {
    return this._cacheByHash.size;
  }

  setCurrentPack(pack: PublishedContentPack | null): void {
    this._currentPack = pack;
    if (pack) {
      this.store(pack);
    }
  }

  setPreviousHealthyPack(pack: PublishedContentPack | null): void {
    this._previousHealthyPack = pack;
    if (pack) {
      this.store(pack);
    }
  }

  setLastResult(result: ContentLoadResult | null): void {
    this._lastResult = result;
    if (result && result.status === 'success') {
      this.setCurrentPack(result.pack);
    }
  }

  store(pack: PublishedContentPack): void {
    if (pack.contentHash) {
      this._cacheByHash.set(pack.contentHash, pack);
    }
    if (pack.sourceProjectId) {
      this._cacheByProjectId.set(pack.sourceProjectId, pack);
    }
  }

  get(contentHash: string): PublishedContentPack | null {
    return this._cacheByHash.get(contentHash) ?? null;
  }

  getByProjectId(projectId: string): PublishedContentPack | null {
    return this._cacheByProjectId.get(projectId) ?? null;
  }

  has(contentHash: string): boolean {
    return this._cacheByHash.has(contentHash);
  }

  invalidate(contentHash?: string): void {
    if (contentHash) {
      const existing = this._cacheByHash.get(contentHash);
      if (existing?.sourceProjectId) {
        this._cacheByProjectId.delete(existing.sourceProjectId);
      }
      this._cacheByHash.delete(contentHash);

      if (this._currentPack?.contentHash === contentHash) {
        this._currentPack = null;
      }
      if (this._previousHealthyPack?.contentHash === contentHash) {
        this._previousHealthyPack = null;
      }
    } else {
      this.clear();
    }
  }

  clear(): void {
    this._currentPack = null;
    this._previousHealthyPack = null;
    this._lastResult = null;
    this._cacheByHash.clear();
    this._cacheByProjectId.clear();
  }

  resolveFallback(
    optionsFallback?: PublishedContentPack,
    defaultFallback?: PublishedContentPack,
  ): PublishedContentPack | undefined {
    return optionsFallback ?? this._previousHealthyPack ?? defaultFallback;
  }
}
