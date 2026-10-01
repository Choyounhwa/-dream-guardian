/**
 * UIImageLoader - UI 비트맵 이미지 에셋 비동기 프리로더 및 캐시 매니저
 *
 * Issue #261 (UI-TOKEN-006):
 * - UI_IMAGE_ASSETS 설정의 비트맵 에셋 비동기 로딩 관리
 * - 싱글톤 `imageLoader` 제공
 * - 로드 실패 시 콘솔 경고 및 null 안전 폴백
 * - 프로시저럴 드로잉과 비트맵 이미지 렌더링 간 분기 판정
 */

import type { UIImageAssetsConfig } from '../../config/ui.config.js';

export class UIImageLoader {
  private _images: Map<string, Map<string, HTMLImageElement>> = new Map();
  private _ready = false;

  /**
   * 에셋 번들 비동기 프리로드
   * - non-null 문자열 경로인 에셋만 로드 시도
   * - 실패한 이미지는 console.warn 출력 후 null 유지 (전체 preload는 중단되지 않음)
   */
  async preload(assets: UIImageAssetsConfig): Promise<void> {
    const promises: Promise<void>[] = [];

    const categories = Object.keys(assets) as (keyof UIImageAssetsConfig)[];
    for (const cat of categories) {
      const group = assets[cat];
      if (!group) continue;

      for (const [key, src] of Object.entries(group)) {
        if (typeof src === 'string' && src.trim().length > 0) {
          promises.push(this.loadImage(cat, key, src));
        }
      }
    }

    await Promise.all(promises);
    this._ready = true;
  }

  /**
   * 개별 이미지 비동기 로드
   */
  private loadImage(category: string, key: string, src: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (typeof Image === 'undefined') {
          // Node.js / SSR 환경: 브라우저 DOM Image 미지원 시 즉시 안전 폴백
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          this.setImage(category, key, img);
          resolve();
        };
        img.onerror = (err) => {
          console.warn(`[UIImageLoader] Failed to load image: ${category}.${key} (${src})`, err);
          if (this._images.get(category)?.has(key)) {
            this._images.get(category)!.delete(key);
          }
          resolve();
        };
        img.src = src;
      } catch (e) {
        console.warn(`[UIImageLoader] Exception loading image: ${category}.${key} (${src})`, e);
        resolve();
      }
    });
  }

  /**
   * 캐시된 이미지 조회 (없거나 미로드 시 null)
   */
  get(category: keyof UIImageAssetsConfig | string, key: string): HTMLImageElement | null {
    return this._images.get(category)?.get(key) ?? null;
  }

  /**
   * 해당 이미지 캐시 보유 여부
   */
  has(category: string, key: string): boolean {
    return this._images.get(category)?.has(key) ?? false;
  }

  /**
   * 프리로드 완료 여부
   */
  isReady(): boolean {
    return this._ready;
  }

  /**
   * 이미지 수동 등록 (테스트 및 런타임 주입용)
   */
  setImage(category: string, key: string, img: HTMLImageElement): void {
    if (!this._images.has(category)) {
      this._images.set(category, new Map());
    }
    this._images.get(category)!.set(key, img);
  }

  /**
   * 전체 이미지 캐시 비우기 및 ready 상태 초기화
   */
  clear(): void {
    this._images.clear();
    this._ready = false;
  }

  /**
   * clear()의 별칭 (테스트 및 상태 리셋용)
   */
  reset(): void {
    this.clear();
  }
}

/**
 * 전역 싱글톤 UIImageLoader 인스턴스
 */
export const imageLoader = new UIImageLoader();
