/**
 * CharacterDefinition - 캐릭터 리그·스킨·클립·이벤트 매핑 통합 정의
 *
 * Issue #689 / FEAT-CHAR-001:
 * - 캐릭터의 리깅(CharacterRig), 비주얼 파츠(CharacterSkin), 애니메이션(AnimationClip),
 *   이벤트 행동 규칙(EventActionMap)을 하나의 완성된 캐릭터로 통합 정의.
 */

import type { CharacterRig } from './character-rig.js';
import type { CharacterSkin } from './character-skin.js';
import type { AnimationClip } from './animation-clip.js';
import type { EventActionMap } from '../skeleton/anim/CharacterActionController.js';

export interface CharacterDefinition {
  id: string;
  name: string;
  description?: string;
  rig: CharacterRig;
  skin?: CharacterSkin;
  clips?: Record<string, AnimationClip>;
  eventActionMap?: EventActionMap;
}
