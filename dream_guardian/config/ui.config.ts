/**
 * ui.config.ts - UI 디자인 토큰 시스템 및 화면 레이아웃·에셋 설정 (Issue #256 / UI-TOKEN-001)
 *
 * 개발 규칙 6절 (데이터와 코드 분리) 및 12절 (UI 개발 규칙) 준수:
 * 1. UI_TEXT_TOKENS: 8개 텍스트 역할(Role)별 기준 크기(base), 최소 크기(min), 가중치(weight)
 * 2. UI_ACCESSIBILITY: 전역 저시력 접근성 설정 (글씨 배율, 고대비 모드, 물리 픽셀 하한선)
 * 3. UI_COLOR_THEMES: default / highContrast 2개 색상 테마 토큰
 * 4. UI_LAYOUT: 1080x2160 가상 좌표계 기준 7개 화면 레이아웃 슬롯 (hud, menu, subMenu, result, bottomBar, settings, pause)
 * 5. UI_IMAGE_ASSETS: 6개 카테고리 이미지 경로 슬롯 (초기값 null = 프로시저럴 렌더링 유지)
 */

// ─── 1. UI Text Tokens ───

export type UITextRole =
  | 'hero'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'label'
  | 'badge'
  | 'caption';

export interface UITextToken {
  /** 1080x2160 가상 해상도 기준 폰트 크기 (px) */
  base: number;
  /** 스케일 다운 시 가독성을 보장하는 최소 폰트 크기 하한선 (px) */
  min: number;
  /** 폰트 가중치 ('normal' | 'bold') */
  weight: 'normal' | 'bold' | string;
}

export const UI_TEXT_TOKENS: Record<UITextRole, UITextToken> = {
  hero: { base: 100, min: 36, weight: 'bold' },
  title: { base: 76, min: 32, weight: 'bold' },
  heading: { base: 54, min: 28, weight: 'bold' },
  subheading: { base: 44, min: 24, weight: 'bold' },
  body: { base: 36, min: 20, weight: 'normal' },
  label: { base: 28, min: 18, weight: 'normal' },
  badge: { base: 24, min: 16, weight: 'bold' },
  caption: { base: 20, min: 16, weight: 'normal' },
};

// ─── 2. UI Accessibility ───

export interface UIAccessibilityConfig {
  /** 폰트 크기 배율 (기본: 1.0, 저시력 모드 시 1.2 등) */
  fontScale: number;
  /** 고대비 테마 활성화 여부 */
  highContrast: boolean;
  /** 물리 픽셀 기준 최소 폰트 크기 하한선 (px) */
  minPhysicalPx: number;
}

export const UI_ACCESSIBILITY: UIAccessibilityConfig = {
  fontScale: 1.0,
  highContrast: false,
  minPhysicalPx: 16,
};

// ─── 3. UI Color Themes ───

export interface UIColorTheme {
  primary: string;
  secondary: string;
  accent: string;
  danger: string;
  success: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textLocked: string;
  bgDim: string;
  bgCard: string;
  border?: string;
  borderHighlight?: string;
  [key: string]: string | undefined;
}

export const UI_COLOR_THEMES: {
  default: UIColorTheme;
  highContrast: UIColorTheme;
} = {
  default: {
    primary: '#28E6FF',
    secondary: '#FFCB4D',
    accent: '#C889FF',
    danger: '#FF4444',
    success: '#4DFFAA',
    textPrimary: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#888888',
    textLocked: '#555555',
    bgDim: 'rgba(0, 0, 0, 0.7)',
    bgCard: 'rgba(20, 24, 40, 0.85)',
    border: 'rgba(255, 255, 255, 0.2)',
    borderHighlight: '#28E6FF',
  },
  highContrast: {
    primary: '#00FFFF',
    secondary: '#FFFF00',
    accent: '#FF00FF',
    danger: '#FF0000',
    success: '#00FF00',
    textPrimary: '#FFFFFF',
    textSecondary: '#FFFFFF',
    textMuted: '#DDDDDD',
    textLocked: '#888888',
    bgDim: 'rgba(0, 0, 0, 0.92)',
    bgCard: 'rgba(0, 0, 0, 0.95)',
    border: '#FFFFFF',
    borderHighlight: '#FFFF00',
  },
};

// ─── 4. UI Layout Slots (1080x2160 가상 좌표계) ───

export interface UILayoutSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

export interface UILayoutConfig {
  hud: UILayoutSlot & {
    playerHpBar: UILayoutSlot;
    bossHpBar: UILayoutSlot;
    combo: { x: number; y: number; w?: number; h?: number };
    bossName: UILayoutSlot;
    comboBadge?: { w: number; h: number; y: number; marginRight: number };
  };
  menu: UILayoutSlot & {
    title: UILayoutSlot;
    locomotionBtn: UILayoutSlot;
    cardWidth: number;
    cardHeight: number;
    chapterCards: Array<{ chapter: number; x: number; y: number; w: number; h: number }>;
  };
  subMenu: UILayoutSlot & {
    title: UILayoutSlot;
    cardWidth: number;
    cardHeight: number;
    grid: { startX: number; startY: number; gapX: number; gapY: number; cols: number; w: number; h: number };
    backBtn: UILayoutSlot;
  };
  result: UILayoutSlot & {
    panel: UILayoutSlot;
    title: { x: number; y: number };
    stars: { x: number; y: number };
    chapter: { x: number; y: number };
    statLineHeight: number;
  };
  bottomBar: UILayoutSlot & {
    height: number;
    settingsBtn: UILayoutSlot;
    actionBtn: UILayoutSlot;
    manaBar?: UILayoutSlot;
  };
  settings: UILayoutSlot & {
    modal: UILayoutSlot;
    closeBtn: UILayoutSlot;
    buttons?: Record<'camera' | 'fullscreen' | 'skeleton' | 'sound' | 'locomotion', UILayoutSlot>;
  };
  pause: UILayoutSlot & {
    modal: UILayoutSlot;
    resumeBtn: UILayoutSlot;
    quitBtn: UILayoutSlot;
  };
}

export const UI_LAYOUT: UILayoutConfig = {
  hud: {
    x: 0,
    y: 0,
    w: 1080,
    h: 200,
    playerHpBar: { x: 20, y: 20, w: 320, h: 32 },
    bossHpBar: { x: 740, y: 20, w: 320, h: 32 },
    combo: { x: 540, y: 120, w: 200, h: 60 },
    bossName: { x: 740, y: 60, w: 320, h: 30 },
    comboBadge: { w: 160, h: 48, y: 48, marginRight: 24 },
  },
  menu: {
    x: 0,
    y: 0,
    w: 1080,
    h: 1960,
    title: { x: 140, y: 180, w: 800, h: 220 },
    locomotionBtn: { x: 290, y: 375, w: 500, h: 56 },
    cardWidth: 360,
    cardHeight: 380,
    chapterCards: [
      { chapter: 1, x: 120, y: 460, w: 360, h: 380 },
      { chapter: 2, x: 600, y: 460, w: 360, h: 380 },
      { chapter: 3, x: 120, y: 920, w: 360, h: 380 },
      { chapter: 4, x: 600, y: 920, w: 360, h: 380 },
      { chapter: 5, x: 360, y: 1380, w: 360, h: 380 },
    ],
  },
  subMenu: {
    x: 0,
    y: 0,
    w: 1080,
    h: 1960,
    title: { x: 80, y: 160, w: 920, h: 200 },
    cardWidth: 420,
    cardHeight: 380,
    grid: {
      startX: 80,
      startY: 440,
      gapX: 80,
      gapY: 60,
      cols: 2,
      w: 420,
      h: 380,
    },
    backBtn: { x: 780, y: 1990, w: 270, h: 140 },
  },
  result: {
    x: 100,
    y: 240,
    w: 880,
    h: 1580,
    panel: { x: 100, y: 240, w: 880, h: 1580 },
    title: { x: 540, y: 360 },
    stars: { x: 540, y: 490 },
    chapter: { x: 540, y: 580 },
    statLineHeight: 74,
  },
  bottomBar: {
    x: 0,
    y: 1960,
    w: 1080,
    h: 200,
    height: 200,
    settingsBtn: { x: 30, y: 1990, w: 140, h: 140 },
    actionBtn: { x: 810, y: 1990, w: 240, h: 140 },
    manaBar: { x: 210, y: 2038, w: 560, h: 50 },
  },
  settings: {
    x: 140,
    y: 480,
    w: 800,
    h: 1080,
    modal: { x: 140, y: 480, w: 800, h: 1080 },
    closeBtn: { x: 850, y: 510, w: 60, h: 60 },
    buttons: {
      camera: { x: 200, y: 620, w: 680, h: 110 },
      fullscreen: { x: 200, y: 750, w: 680, h: 110 },
      skeleton: { x: 200, y: 880, w: 680, h: 110 },
      sound: { x: 200, y: 1010, w: 680, h: 110 },
      locomotion: { x: 200, y: 1140, w: 680, h: 110 },
    },
  },
  pause: {
    x: 140,
    y: 720,
    w: 800,
    h: 720,
    modal: { x: 140, y: 720, w: 800, h: 720 },
    resumeBtn: { x: 200, y: 980, w: 680, h: 130 },
    quitBtn: { x: 200, y: 1160, w: 680, h: 130 },
  },
};

// ─── 5. UI Image Assets (프로시저럴 / 이미지 전환 슬롯) ───

export interface UIImageAssetsConfig {
  menu: Record<string, string | null>;
  hud: Record<string, string | null>;
  result: Record<string, string | null>;
  bottomBar: Record<string, string | null>;
  settings: Record<string, string | null>;
  battle: Record<string, string | null>;
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
  },
  bottomBar: {
    barBg: null,
    settingsIcon: null,
    actionButton: null,
  },
  settings: {
    dialogBg: null,
    closeIcon: null,
  },
  battle: {
    bossFrame: null,
    shieldAura: null,
  },
};
