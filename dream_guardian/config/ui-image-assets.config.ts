/**
 * ui-image-assets.config.ts - UI 이미지 에셋 경로 슬롯 (프로시저럴 / 이미지 전환)
 *
 * REFACTOR-SRP-013 (#677): config/ui.config.ts 1,000줄 규칙 준수를 위해 §5 UI Image Assets를 분리했다.
 * 값과 키 순서는 원본과 동일하며, 기존 소비자는 ui.config.js 재export를 통해 동일 참조를 사용한다.
 * 초기값 null = 프로시저럴 렌더링 유지.
 */

export interface UIImageAssetsConfig {
  menu: Record<string, string | null>;
  hud: Record<string, string | null>;
  result: Record<string, string | null>;
  bottomBar: Record<string, string | null>;
  settings: Record<string, string | null>;
  battle: Record<string, string | null>;
  pause: Record<string, string | null>;
  boss: Record<string, string | null>;
  guardian: Record<string, string | null>;
  bg: Record<string, string | null>;
  question?: Record<string, string | null>;
  dialogue?: Record<string, string | null>;
  modal?: Record<string, string | null>;
  icon?: Record<string, string | null>;
}

export const UI_IMAGE_ASSETS: UIImageAssetsConfig = {
  menu: {
    background: null,
    cardFrame: '/assets/ui/menu/chapter_card_frame.png',
    banner: null,
    titleBg: '/assets/ui/menu/title_bg.png',
    lockIcon: '/assets/ui/menu/lock_icon.png',
    starFull: '/assets/ui/menu/star_full.png',
    starEmpty: '/assets/ui/menu/star_empty.png',
    sublevelCardBg: '/assets/ui/menu/sublevel_card_bg.png',
  },
  question: {
    questionBoardBg: '/assets/ui/question/question_board_bg.png',
    answerBtnDefault: '/assets/ui/question/answer_btn_default.png',
    answerBtnHover: '/assets/ui/question/answer_btn_hover.png',
    answerBtnSelected: '/assets/ui/question/answer_btn_selected.png',
  },
  hud: {
    playerHpBar: null,
    bossHpBar: null,
    manaFlask: null,
    comboBadge: null,
    hpBarFrame: '/assets/ui/hud/hp_bar_frame.png',
    hpBarFillPlayer: '/assets/ui/hud/hp_bar_fill_player.png',
    hpBarFillBoss: '/assets/ui/hud/hp_bar_fill_boss.png',
    comboIcon: '/assets/ui/hud/combo_icon.png',
    bossNameplate: '/assets/ui/hud/boss_nameplate.png',
    beatDotActive: '/assets/ui/hud/beat_dot_active.png',
    beatDotInactive: '/assets/ui/hud/beat_dot_inactive.png',
    beatDotTarget: '/assets/ui/hud/beat_dot_target.png',
  },
  result: {
    panelBg: '/assets/ui/result/panel_bg.png',
    victoryTitle: '/assets/ui/result/victory_title.png',
    defeatTitle: '/assets/ui/result/defeat_title.png',
    victoryBadge: '/assets/ui/result/victory_title.png',
    defeatBadge: '/assets/ui/result/defeat_title.png',
    starFilled: '/assets/ui/result/star_filled.png',
    starEmpty: '/assets/ui/result/star_empty.png',
    statIcon_accuracy: '/assets/ui/result/stat_accuracy.png',
    statIcon_combo: '/assets/ui/result/stat_combo.png',
    statIcon_time: '/assets/ui/result/stat_time.png',
    statIcon_run: '/assets/ui/result/stat_run.png',
    statIcon_squat: '/assets/ui/result/stat_squat.png',
    statIcon_jump: '/assets/ui/result/stat_jump.png',
    statIcon_pose: '/assets/ui/result/stat_pose.png',
    statIcon_calorie: '/assets/ui/result/stat_calorie.png',
    rankStampS: '/assets/ui/result/rank_stamp_s.png',
    rankStampA: '/assets/ui/result/rank_stamp_a.png',
    rankStampB: '/assets/ui/result/rank_stamp_b.png',
    rankStampC: '/assets/ui/result/rank_stamp_c.png',
  },
  bottomBar: {
    barBg: '/assets/ui/bottombar/bar_bg.png',
    settingsIcon: '/assets/ui/bottombar/settings_icon.png',
    manaFrame: '/assets/ui/bottombar/mana_frame.png',
    manaFill: '/assets/ui/bottombar/mana_fill.png',
    actionButton: null,
  },
  settings: {
    modalBg: '/assets/ui/settings/modal_bg.png',
    dialogBg: '/assets/ui/settings/modal_bg.png',
    toggleOn: '/assets/ui/settings/toggle_on.png',
    toggleOff: '/assets/ui/settings/toggle_off.png',
    closeIcon: null,
  },
  battle: {
    bossFrame: null,
    shieldAura: null,
  },
  pause: {
    modalBg: '/assets/ui/pause/modal_bg.png',
    resumeBtn: '/assets/ui/pause/resume_btn.png',
    quitBtn: '/assets/ui/pause/quit_btn.png',
  },
  boss: {
    ch1_idle: '/assets/boss/ch1/idle.png',
    ch1_hit: '/assets/boss/ch1/hit.png',
    ch1_enrage: '/assets/boss/ch1/enrage.png',
    ch2_idle: '/assets/boss/ch2/idle.png',
    ch2_hit: '/assets/boss/ch2/hit.png',
    ch2_enrage: '/assets/boss/ch2/enrage.png',
    ch3_idle: '/assets/boss/ch3/idle.png',
    ch3_hit: '/assets/boss/ch3/hit.png',
    ch3_enrage: '/assets/boss/ch3/enrage.png',
    ch4_idle: '/assets/boss/ch4/idle.png',
    ch4_hit: '/assets/boss/ch4/hit.png',
    ch4_enrage: '/assets/boss/ch4/enrage.png',
    ch5_idle: '/assets/boss/ch5/idle.png',
    ch5_hit: '/assets/boss/ch5/hit.png',
    ch5_enrage: '/assets/boss/ch5/enrage.png',
    ch5_defeat: '/assets/boss/ch5/defeat.png',
  },
  guardian: {
    stage1_idle: '/assets/guardian/stage1/idle.png',
    stage1_cast: '/assets/guardian/stage1/cast.png',
    stage2_idle: '/assets/guardian/stage2/idle.png',
    stage2_cast: '/assets/guardian/stage2/cast.png',
    stage3_idle: '/assets/guardian/stage3/idle.png',
    stage3_cast: '/assets/guardian/stage3/cast.png',
    stage3_shield: '/assets/guardian/stage3/shield.png',
    stage4_idle: '/assets/guardian/stage4/idle.png',
    stage4_cast: '/assets/guardian/stage4/cast.png',
    stage4_shield: '/assets/guardian/stage4/shield.png',
    stage4_ultimate: '/assets/guardian/stage4/ultimate.png',
  },
  bg: {
    menu: '/assets/bg/menu_bg.png',
    ch1: '/assets/bg/ch1_bg.png',
    ch2: '/assets/bg/ch2_bg.png',
    ch3: '/assets/bg/ch3_bg.png',
    ch4: '/assets/bg/ch4_bg.png',
    ch5: '/assets/bg/ch5_bg.png',
  },
  dialogue: {
    boxBg: '/assets/ui/dialogue/dialogue_box_bg.png',
    badgeKkebi: '/assets/ui/dialogue/speaker_badge_kkebi.png',
    badgeBoss: '/assets/ui/dialogue/speaker_badge_boss.png',
  },
  modal: {
    btnResume: '/assets/ui/modal/btn_resume.png',
    btnQuit: '/assets/ui/modal/btn_quit.png',
    btnCloseX: '/assets/ui/modal/btn_close_x.png',
    iconCamera: '/assets/ui/modal/icon_camera.png',
    iconSound: '/assets/ui/modal/icon_sound.png',
    iconSkeleton: '/assets/ui/modal/icon_skeleton.png',
    iconFullscreen: '/assets/ui/modal/icon_fullscreen.png',
  },
  icon: {
    leftHand: '/assets/ui/icon/icon_hand_left.png',
    rightHand: '/assets/ui/icon/icon_hand_right.png',
    head: '/assets/ui/icon/icon_head.png',
    hip: '/assets/ui/icon/icon_hip.png',
    shoulder: '/assets/ui/icon/icon_shoulder.png',
  },
};
