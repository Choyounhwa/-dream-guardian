/**
 * UIVisualElementIdMap.ts - 에디터 요소 ID ↔ 게임 렌더러 ID 정규화 매핑 테이블
 *
 * Issue #553 ([BUG-UI-EDITOR-006])
 *
 * 에디터 기본 문서(하이픈 표기 등)의 요소 ID를 실제 런타임 렌더러가 기대하는 정규 ID(언더스코어 등)로 1:1 변환하고,
 * 보호 영역 침범 방지 및 액션 ID 정규화를 수행합니다.
 */

import type { UIActionId, UIDynamicFixtureBinding, UIRect } from '../../../data/UIPresentation.js';

export interface ElementIdMapping {
  /** 대상 게임 렌더러 요소 ID */
  targetId: string;
  /** 정규화된 상호작용 액션 ID */
  actionId?: UIActionId;
  /** 정규화된 동적 fixture 바인딩 */
  dynamicBinding?: UIDynamicFixtureBinding;
  /** 보호된 영역 여부 */
  isProtected?: boolean;
  /** 기본 문서의 침범 좌표를 교정하는 안전 좌표 */
  normalizedBounds?: UIRect;
}

export const EDITOR_ELEMENT_ID_MAP: Record<string, ElementIdMapping> = Object.freeze({
  // 1. menu_main (main_home)
  'card-story': { targetId: 'chapter_1', actionId: 'select_chapter_1' },
  'card-play': { targetId: 'chapter_2', actionId: 'select_chapter_2' },
  'card-records': { targetId: 'chapter_3', actionId: 'select_chapter_3' },
  'card-settings': { targetId: 'chapter_4', actionId: 'select_chapter_4' },
  'card-credits': { targetId: 'chapter_5', actionId: 'select_chapter_5' },
  'menu-workout-btn': { targetId: 'locomotion_btn', actionId: 'nav_workout' },
  'menu-title': { targetId: 'menu_title' },
  'home-title': { targetId: 'home_title' },

  // 2. menu_sub (submenu)
  'sub-header': { targetId: 'sub_title' },
  'sub-cell-1': { targetId: 'btn_sub_1' },
  'sub-cell-2': { targetId: 'btn_sub_2' },
  'sub-cell-3': { targetId: 'btn_sub_3' },
  'sub-cell-4': { targetId: 'btn_sub_4' },
  'sub-cell-5': { targetId: 'btn_sub_5' },
  'sub-cell-6': { targetId: 'btn_sub_6' },
  'sub-back-btn': { targetId: 'btn_close_sub', actionId: 'close_submenu' },

  // 3. settings (options)
  'settings-dialog': { targetId: 'settings_modal' },
  'settings-sound-slider': { targetId: 'sound_slider' },
  'settings-sensitivity': { targetId: 'motion_sensitivity' },
  'settings-calibration-btn': { targetId: 'btn_calibration' },
  'settings-close-btn': { targetId: 'btn_opt_close', actionId: 'close_settings' },

  // 4. pause (pause)
  'pause-dialog': { targetId: 'pause_modal' },
  'pause-resume-btn': { targetId: 'btn_pause_resume', actionId: 'pause_resume' },
  'pause-exit-btn': { targetId: 'btn_pause_quit', actionId: 'pause_quit' },

  // 5. ready_position (play_ready)
  'ready-countdown': {
    targetId: 'ready_countdown',
    normalizedBounds: { x: 440, y: 100, width: 200, height: 200 },
  },
  'ready-silhouette': {
    targetId: 'silhouette',
    isProtected: true,
  },
  'ready-guide-text': {
    targetId: 'ready_guide_text',
    normalizedBounds: { x: 140, y: 180, width: 800, height: 100 },
  },

  // 6. run_question (running_question)
  'run-track': {
    targetId: 'run_header',
    normalizedBounds: { x: 50, y: 20, width: 980, height: 60 },
  },
  'run-question-box': {
    targetId: 'run_question_banner',
    dynamicBinding: 'preview_question_text',
    normalizedBounds: { x: 324, y: 518, width: 432, height: 346 },
  },
  'run-mana-gauge': {
    targetId: 'mana_bar',
    normalizedBounds: { x: 90, y: 1000, width: 900, height: 50 },
  },

  // 7. answer_select (answer_select)
  'answer-choice-1': {
    targetId: 'ans_btn_left',
    actionId: 'answer_select_0',
    dynamicBinding: 'preview_answer_0_text',
  },
  'answer-choice-2': {
    targetId: 'ans_btn_right',
    actionId: 'answer_select_1',
    dynamicBinding: 'preview_answer_1_text',
  },
  'answer-zone-anchors': {
    targetId: 'zone_anchors',
    isProtected: true,
  },

  // 8. hazard_evade (hazard_evade)
  'hazard-overlay': {
    targetId: 'hazard_warning',
  },
  'hazard-timer': {
    targetId: 'timing_guide',
    normalizedBounds: { x: 324, y: 440, width: 432, height: 60 },
  },
  'hazard-warning-frame': {
    targetId: 'hazard_warning_frame',
    isProtected: true,
  },

  // 9. boss_climax (boss_battle)
  'hud-player-hp-bar': {
    targetId: 'hud_player_hp',
    dynamicBinding: 'preview_player_hp',
  },
  'hud-boss-hp-bar': {
    targetId: 'hud_boss_hp',
    dynamicBinding: 'preview_boss_hp',
  },
  'hud-combo': {
    targetId: 'hud_combo',
    dynamicBinding: 'preview_combo',
  },
  'hud-boss-name': {
    targetId: 'hud_boss_name',
  },
  'hud-combo-badge': {
    targetId: 'combo_badge',
  },
  'boss-avatar': {
    targetId: 'boss_title',
    isProtected: true,
  },
  'boss-hp-bar': {
    targetId: 'boss_hud',
    normalizedBounds: { x: 50, y: 20, width: 980, height: 60 },
  },

  // 10. result (result)
  'result-panel': { targetId: 'result_panel' },
  'result-title': { targetId: 'result_title' },
  'result-grade-badge': { targetId: 'res_grade' },
  'result-calorie-box': { targetId: 'res_stats' },
  'result-accuracy-stats': { targetId: 'res_rank' },
  'result-stardust-count': { targetId: 'res_footer' },
  'result-retry-btn': { targetId: 'bottom_prompt', actionId: 'result_retry' },
  'result-confirm-btn': { targetId: 'bottom_prompt', actionId: 'result_retry' },
});

/**
 * 에디터 요소 ID에 대응하는 정규화 매핑 정보 조회
 */
export function resolveElementIdMapping(editorElementId: string): ElementIdMapping | undefined {
  return EDITOR_ELEMENT_ID_MAP[editorElementId];
}
