/**
 * SkinPartLoader - 부위별 PNG 캐릭터 스킨 이미지 프리로더 및 캐시 매니저
 *
 * Issue #685 / FEAT-SKIN-001:
 * - skin.json 및 SkinPartDef 기반 개별 PNG 이미지 비동기 로드 및 메모리 캐싱
 * - 로딩 실패 또는 브라우저 외 환경(Node/Vitest) 시 null 안전 반환
 */

import type { CharacterSkin, SkinPartDef } from '../../types/character-skin.js';

export class SkinPartLoader {
  private static _instance: SkinPartLoader;
  private _cache: Map<string, HTMLImageElement> = new Map();

  public static getInstance(): SkinPartLoader {
    if (!SkinPartLoader._instance) {
      SkinPartLoader._instance = new SkinPartLoader();
    }
    return SkinPartLoader._instance;
  }

  private _getKey(skinId: string, file: string): string {
    return `${skinId}:${file}`;
  }

  /**
   * 캐시된 파츠 이미지 조회 (미로딩 시 null)
   */
  public getImage(skinId: string, file: string): HTMLImageElement | null {
    return this._cache.get(this._getKey(skinId, file)) ?? null;
  }

  /**
   * 테스트 또는 수동 등록용 이미지 캐시 주입
   */
  public setImage(skinId: string, file: string, img: HTMLImageElement): void {
    this._cache.set(this._getKey(skinId, file), img);
  }

  /**
   * 단일 파츠 이미지 비동기 로드
   */
  public async loadPart(
    skinId: string,
    basePath: string = '',
    part: SkinPartDef
  ): Promise<HTMLImageElement | null> {
    const key = this._getKey(skinId, part.file);
    if (this._cache.has(key)) {
      return this._cache.get(key)!;
    }

    if (typeof Image === 'undefined') {
      return null;
    }

    const fullPath = basePath ? `${basePath.replace(/\/$/, '')}/${part.file}` : part.file;

    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this._cache.set(key, img);
          resolve(img);
        };
        img.onerror = () => {
          resolve(null);
        };
        img.src = fullPath;
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * 캐릭터 스킨 전체 파츠 일괄 비동기 프리로드
   */
  public async preloadSkin(skin: CharacterSkin): Promise<void> {
    const basePath = skin.basePath ?? '';
    const promises = skin.parts.map((part) => this.loadPart(skin.id, basePath, part));
    await Promise.all(promises);
  }

  /**
   * 캐시 비우기
   */
  public clear(): void {
    this._cache.clear();
  }
}

export const skinPartLoader = SkinPartLoader.getInstance();
