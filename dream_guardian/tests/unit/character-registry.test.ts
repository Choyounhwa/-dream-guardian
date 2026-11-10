import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CharacterDefinition } from '../../src/types/character-definition.js';
import {
  CharacterRegistry,
  characterRegistry,
  STORAGE_KEY_SELECTED_CHARACTER,
} from '../../src/data/characters/CharacterRegistry.js';
import { stickmanCharacter } from '../../src/data/characters/builtin/stickman.character.js';
import { DEFAULT_STICKMAN_RIG } from '../../config/character-rig.config.js';
import { CharacterSelectModal } from '../../src/ui/CharacterSelectModal.js';
import { BootstrapSubsystemFactory } from '../../src/core/bootstrap/BootstrapSubsystemFactory.js';
import { StickmanRenderer } from '../../src/skeleton/StickmanRenderer.js';
import { CharacterAvatarRenderer } from '../../src/skeleton/skin/CharacterAvatarRenderer.js';

describe('CharacterRegistry & CharacterDefinition (#689 / [FEAT-CHAR-001])', () => {
  let mockStorage: Record<string, string>;
  let storageAdapter: Storage;

  beforeEach(() => {
    mockStorage = {};
    storageAdapter = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    };
  });

  describe('1. CharacterRegistry 등록 및 조회', () => {
    it('기본 메카 졸라맨(stickmanCharacter)이 기본 등록되어 있어야 한다', () => {
      const registry = new CharacterRegistry({ storage: storageAdapter });
      const def = registry.getDefault();
      expect(def).toBeDefined();
      expect(def.id).toBe('mecha_stickman');
      expect(def.name).toBe('메카 졸라맨');
      expect(def.rig).toEqual(DEFAULT_STICKMAN_RIG);
    });

    it('신규 캐릭터 정의를 등록하고 조회할 수 있어야 한다', () => {
      const registry = new CharacterRegistry({ storage: storageAdapter });
      const customChar: CharacterDefinition = {
        id: 'rabbit_hero',
        name: '토끼 영웅',
        description: '빠르고 날렵한 수호신',
        rig: DEFAULT_STICKMAN_RIG,
      };

      registry.register(customChar);
      expect(registry.get('rabbit_hero')).toEqual(customChar);
      expect(registry.has('rabbit_hero')).toBe(true);

      const all = registry.getAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.find((c) => c.id === 'rabbit_hero')).toBeDefined();
    });

    it('유효하지 않은 캐릭터 정의 등록 시 에러를 던져야 한다', () => {
      const registry = new CharacterRegistry({ storage: storageAdapter });

      // id 누락
      expect(() =>
        registry.register({ id: '', name: 'Invalid', rig: DEFAULT_STICKMAN_RIG } as CharacterDefinition)
      ).toThrow();

      // name 누락
      expect(() =>
        registry.register({ id: 'invalid_name', name: '', rig: DEFAULT_STICKMAN_RIG } as CharacterDefinition)
      ).toThrow();

      // rig 누락
      expect(() =>
        registry.register({ id: 'invalid_rig', name: 'No Rig' } as unknown as CharacterDefinition)
      ).toThrow();
    });

    it('정적 validate 메서드로 캐릭터 정의 유효성을 검증할 수 있어야 한다', () => {
      const validChar: CharacterDefinition = {
        id: 'test_char',
        name: '테스트',
        rig: DEFAULT_STICKMAN_RIG,
      };
      const res1 = CharacterRegistry.validate(validChar);
      expect(res1.valid).toBe(true);
      expect(res1.errors).toHaveLength(0);

      const invalidChar = { id: '', name: '', rig: null } as unknown as CharacterDefinition;
      const res2 = CharacterRegistry.validate(invalidChar);
      expect(res2.valid).toBe(false);
      expect(res2.errors.length).toBeGreaterThan(0);
    });
  });

  describe('2. 캐릭터 선택 및 영속화 (localStorage / fallback)', () => {
    it('초기 상태에서는 기본 ID(mecha_stickman)가 선택되어야 한다', () => {
      const registry = new CharacterRegistry({ storage: storageAdapter });
      expect(registry.getSelectedId()).toBe('mecha_stickman');
      expect(registry.getSelected().id).toBe('mecha_stickman');
    });

    it('캐릭터 선택 시 영속화 저장소에 저장되어야 한다', () => {
      const registry = new CharacterRegistry({ storage: storageAdapter });
      const customChar: CharacterDefinition = {
        id: 'bear_tank',
        name: '곰 탱커',
        rig: DEFAULT_STICKMAN_RIG,
      };
      registry.register(customChar);

      registry.setSelectedId('bear_tank');
      expect(registry.getSelectedId()).toBe('bear_tank');
      expect(registry.getSelected().id).toBe('bear_tank');
      expect(storageAdapter.setItem).toHaveBeenCalledWith(STORAGE_KEY_SELECTED_CHARACTER, 'bear_tank');
    });

    it('저장소에 저장된 캐릭터 ID를 복원해야 한다', () => {
      mockStorage[STORAGE_KEY_SELECTED_CHARACTER] = 'rabbit_hero';

      const registry = new CharacterRegistry({ storage: storageAdapter });
      const rabbitChar: CharacterDefinition = {
        id: 'rabbit_hero',
        name: '토끼 영웅',
        rig: DEFAULT_STICKMAN_RIG,
      };
      registry.register(rabbitChar);

      expect(registry.getSelectedId()).toBe('rabbit_hero');
      expect(registry.getSelected().id).toBe('rabbit_hero');
    });

    it('존재하지 않는 캐릭터 ID가 저장소에 있거나 선택될 경우 기본값으로 fallback해야 한다', () => {
      mockStorage[STORAGE_KEY_SELECTED_CHARACTER] = 'non_existent_id';

      const registry = new CharacterRegistry({ storage: storageAdapter });
      // getSelectedId는 저장된 값을 보존하더라도 getSelected는 default로 fallback
      expect(registry.getSelected().id).toBe('mecha_stickman');

      // 존재하지 않는 ID로 setSelectedId 호출 시
      registry.setSelectedId('unknown_char');
      expect(registry.getSelected().id).toBe('mecha_stickman');
    });

    it('저장소 접근 예외(QuotaExceeded/SecurityError) 발생 시에도 크래시 없이 정상 동작해야 한다', () => {
      const throwingStorage: Storage = {
        getItem: vi.fn(() => {
          throw new Error('SecurityError: Access denied');
        }),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError: LocalStorage full');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      };

      const registry = new CharacterRegistry({ storage: throwingStorage });
      expect(registry.getSelectedId()).toBe('mecha_stickman');
      expect(() => registry.setSelectedId('mecha_stickman')).not.toThrow();
    });

    it('싱글톤 characterRegistry 인스턴스가 제공되어야 한다', () => {
      expect(characterRegistry).toBeInstanceOf(CharacterRegistry);
    });
  });

  describe('3. CharacterSelectModal (UI 레이어 - 상태 표시 전용)', () => {
    it('열기/닫기/토글 상태를 올바르게 제어해야 한다', () => {
      const modal = new CharacterSelectModal();
      expect(modal.isOpen).toBe(false);

      modal.open();
      expect(modal.isOpen).toBe(true);

      modal.close();
      expect(modal.isOpen).toBe(false);

      modal.toggle();
      expect(modal.isOpen).toBe(true);
    });

    it('getModalBounds가 화면 크기에 맞게 가상 해상도 좌표를 변환해야 한다', () => {
      const modal = new CharacterSelectModal();
      const bounds = modal.getModalBounds(1280, 720);
      expect(bounds.w).toBeGreaterThan(0);
      expect(bounds.h).toBeGreaterThan(0);
      expect(bounds.x).toBeGreaterThan(0);
      expect(bounds.y).toBeGreaterThan(0);
    });

    it('hitTest가 닫기 버튼 및 캐릭터 카드를 올바르게 감지해야 한다', () => {
      const modal = new CharacterSelectModal();
      const chars: CharacterDefinition[] = [
        stickmanCharacter,
        { id: 'rabbit', name: '토끼', rig: DEFAULT_STICKMAN_RIG },
      ];

      // 닫혀있을 때는 null 반환
      expect(modal.hitTest(100, 100, 1280, 720, chars)).toBeNull();

      modal.open();
      const bounds = modal.getModalBounds(1280, 720);

      // 닫기 버튼 클릭 영역 테스트 (우상단)
      const closeAction = modal.hitTest(bounds.x + bounds.w - 20, bounds.y + 20, 1280, 720, chars);
      expect(closeAction).toEqual({ type: 'close' });

      // 첫 번째 카드 영역 테스트
      const cards = modal.getCardLayout(1280, 720, chars);
      if (cards.length > 0) {
        const firstCard = cards[0];
        const cardAction = modal.hitTest(firstCard.x + 10, firstCard.y + 10, 1280, 720, chars);
        expect(cardAction).toEqual({ type: 'select', id: firstCard.character.id });
      }
    });

    it('render 호출 시 예외 없이 정상 렌더링되어야 한다 (열림/닫힘 상태)', () => {
      const modal = new CharacterSelectModal();
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 50 })),
      } as unknown as CanvasRenderingContext2D;

      // 닫힘 상태: 렌더링하지 않음
      modal.render(ctx, 1280, 720, [stickmanCharacter], 'mecha_stickman');
      expect(ctx.fillRect).not.toHaveBeenCalled();

      // 열림 상태: 렌더링 수행
      modal.open();
      modal.render(ctx, 1280, 720, [stickmanCharacter], 'mecha_stickman');
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled();
    });
  });

  describe('4. BootstrapSubsystemFactory 아바타 주입 연동', () => {
    it('BootstrapSubsystems에 characterRegistry가 포함되어야 한다', () => {
      const subsystems = BootstrapSubsystemFactory.create();
      expect(subsystems.characterRegistry).toBeInstanceOf(CharacterRegistry);
      expect(subsystems.stickmanRenderer).toBeDefined();
    });

    it('options.characterRegistry를 전달하면 주입된 레지스트리를 사용해야 한다', () => {
      const customRegistry = new CharacterRegistry({ storage: storageAdapter });
      const subsystems = BootstrapSubsystemFactory.create({
        characterRegistry: customRegistry,
      });
      expect(subsystems.characterRegistry).toBe(customRegistry);
    });

    it('스킨이 정의된 캐릭터가 선택된 경우 CharacterAvatarRenderer를 생성하여 주입해야 한다', () => {
      const customRegistry = new CharacterRegistry({ storage: storageAdapter });
      const charWithSkin: CharacterDefinition = {
        id: 'skinned_guardian',
        name: '스킨 가디언',
        rig: DEFAULT_STICKMAN_RIG,
        skin: {
          id: 'test_skin',
          name: '테스트 스킨',
          parts: [],
        },
      };
      customRegistry.register(charWithSkin);
      customRegistry.setSelectedId('skinned_guardian');

      const subsystems = BootstrapSubsystemFactory.create({
        characterRegistry: customRegistry,
      });
      expect(subsystems.stickmanRenderer).toBeInstanceOf(CharacterAvatarRenderer);
    });

    it('스킨이 없는 기본 캐릭터의 경우 기존 StickmanRenderer 동작을 100% 보존해야 한다', () => {
      const customRegistry = new CharacterRegistry({ storage: storageAdapter });
      customRegistry.setSelectedId('mecha_stickman');

      const subsystems = BootstrapSubsystemFactory.create({
        characterRegistry: customRegistry,
      });
      expect(subsystems.stickmanRenderer).toBeInstanceOf(StickmanRenderer);
    });

    it('options.avatarRenderer가 명시적으로 전달되면 레지스트리 선택보다 우선 적용되어야 한다', () => {
      const customRenderer = new StickmanRenderer();
      const subsystems = BootstrapSubsystemFactory.create({
        avatarRenderer: customRenderer,
      });
      expect(subsystems.stickmanRenderer).toBe(customRenderer);
    });
  });
});
