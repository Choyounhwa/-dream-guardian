/**
 * CharacterRegistry - 캐릭터 정의(CharacterDefinition) 레지스트리 및 영속화 관리자
 *
 * Issue #689 / FEAT-CHAR-001:
 * - 캐릭터 리그, 스킨, 클립, 이벤트 액션 맵을 하나로 묶은 캐릭터 정의 관리
 * - CharacterDefinition 무결성 검증 (id, name, rig 유효성)
 * - 선택된 캐릭터 영속화 (localStorage / dg_selected_character_id)
 * - 미선택 또는 미등록 ID 시 기본 메카 졸라맨(mecha_stickman) 자동 폴백(Fallback)
 * - SSR/Node/Vitest 환경 예외 방어 (SecurityError, QuotaExceededError 등)
 */

import type { CharacterDefinition } from '../../types/character-definition.js';
import { stickmanCharacter } from './builtin/stickman.character.js';

export { DEFAULT_CHARACTER_ID } from './builtin/stickman.character.js';
export const STORAGE_KEY_SELECTED_CHARACTER = 'dg_selected_character_id';

export interface CharacterValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CharacterRegistryOptions {
  storage?: Storage | null;
  defaultCharacter?: CharacterDefinition;
}

export class CharacterRegistry {
  private static _instance: CharacterRegistry | null = null;

  private readonly _characters = new Map<string, CharacterDefinition>();
  private readonly _defaultCharacter: CharacterDefinition;
  private readonly _customStorage?: Storage | null;
  private _selectedId: string;

  constructor(options?: CharacterRegistryOptions) {
    this._customStorage = options?.storage;
    this._defaultCharacter = options?.defaultCharacter ?? stickmanCharacter;

    // 기본 캐릭터 등록
    this.register(this._defaultCharacter);

    // 저장소에서 선택된 캐릭터 복원
    this._selectedId = this._loadSelectedId();
  }

  public static getInstance(): CharacterRegistry {
    if (!CharacterRegistry._instance) {
      CharacterRegistry._instance = new CharacterRegistry();
    }
    return CharacterRegistry._instance;
  }

  private _getStorage(): Storage | null {
    if (this._customStorage !== undefined) {
      return this._customStorage;
    }
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  private _loadSelectedId(): string {
    try {
      const storage = this._getStorage();
      if (storage) {
        const saved = storage.getItem(STORAGE_KEY_SELECTED_CHARACTER);
        if (saved && typeof saved === 'string' && saved.trim().length > 0) {
          return saved;
        }
      }
    } catch {
      // Storage access blocked or unavailable
    }
    return this._defaultCharacter.id;
  }

  public static validate(def: CharacterDefinition): CharacterValidationResult {
    const errors: string[] = [];

    if (!def) {
      return { valid: false, errors: ['CharacterDefinition이 null 또는 undefined입니다.'] };
    }

    if (!def.id || typeof def.id !== 'string' || def.id.trim() === '') {
      errors.push('id가 유효하지 않습니다.');
    }

    if (!def.name || typeof def.name !== 'string' || def.name.trim() === '') {
      errors.push('name이 유효하지 않습니다.');
    }

    if (!def.rig || typeof def.rig !== 'object') {
      errors.push('rig가 정의되지 않았거나 유효하지 않습니다.');
    } else {
      if (!def.rig.id || typeof def.rig.id !== 'string') {
        errors.push('rig.id가 누락되었습니다.');
      }
      if (!def.rig.rootAnchor || typeof def.rig.rootAnchor !== 'string') {
        errors.push('rig.rootAnchor가 누락되었습니다.');
      }
      if (!Array.isArray(def.rig.bones) || def.rig.bones.length === 0) {
        errors.push('rig.bones는 1개 이상의 본을 포함하는 배열이어야 합니다.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public register(def: CharacterDefinition): void {
    const result = CharacterRegistry.validate(def);
    if (!result.valid) {
      throw new Error(`Invalid CharacterDefinition [${def?.id}]: ${result.errors.join('; ')}`);
    }

    this._characters.set(def.id, def);
  }

  public has(id: string): boolean {
    return this._characters.has(id);
  }

  public get(id: string): CharacterDefinition | undefined {
    return this._characters.get(id);
  }

  public getAll(): CharacterDefinition[] {
    return Array.from(this._characters.values());
  }

  public getDefault(): CharacterDefinition {
    return this._defaultCharacter;
  }

  public getSelectedId(): string {
    return this._selectedId;
  }

  public setSelectedId(id: string): void {
    this._selectedId = id;
    try {
      const storage = this._getStorage();
      if (storage) {
        storage.setItem(STORAGE_KEY_SELECTED_CHARACTER, id);
      }
    } catch {
      // Storage access blocked or quota exceeded
    }
  }

  public getSelected(): CharacterDefinition {
    const found = this.get(this._selectedId);
    if (found) {
      return found;
    }
    return this.getDefault();
  }
}

export const characterRegistry = CharacterRegistry.getInstance();
