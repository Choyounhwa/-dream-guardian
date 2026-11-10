/**
 * stickman.character.ts - 기본 빌트인 캐릭터(메카 졸라맨) 정의
 *
 * Issue #689 / FEAT-CHAR-001:
 * - DEFAULT_STICKMAN_RIG 기반 기본 아바타 정의
 * - 기본 캐릭터 식별자: 'mecha_stickman'
 */

import type { CharacterDefinition } from '../../../types/character-definition.js';
import { DEFAULT_STICKMAN_RIG } from '../../../../config/character-rig.config.js';

export const DEFAULT_CHARACTER_ID = 'mecha_stickman';

export const stickmanCharacter: CharacterDefinition = {
  id: DEFAULT_CHARACTER_ID,
  name: '메카 졸라맨',
  description: '기본 네온 메카 스틱맨 아바타',
  rig: DEFAULT_STICKMAN_RIG,
};
