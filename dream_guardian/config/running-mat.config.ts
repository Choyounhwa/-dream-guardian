/**
 * running-mat.config.ts - 반투명 원근 러닝 매트 시각 설정
 *
 * Issue #372 (RUN-MAT-003):
 * - 바닥 높이 정규화 Y 범위 (0.74 ~ 0.94)
 * - 폭 비율 (기본 0.76, 좁은 화면 보정 최대 0.90)
 * - 웹캠 하체가 비치는 반투명 셀 및 발자국, NEXT 링, 화살표 스타일 규격 정의
 */

export const DEFAULT_MAT_BASE_Y_TOP = 0.74;
export const DEFAULT_MAT_BASE_Y_BOTTOM = 0.94;
export const DEFAULT_MAT_WIDTH_RATIO = 0.76;
export const MAX_NARROW_WIDTH_RATIO = 0.90;
export const DEFAULT_VANISHING_Y_RATIO = 0.56;
export const DEFAULT_RETURN_PHASE_RATIO = 0.5;
export const DEFAULT_STRIKE_LINE_Y_RATIO = 0.86;
export const DEFAULT_MAT_LANE_OFFSET = 0.45;
export const DEFAULT_LANE_SLOT_OFFSETS = Object.freeze({
  left: -0.45,
  center: 0.0,
  right: 0.45,
});
export const DEFAULT_STRIKE_CORE_LINE_WIDTH = 3.5;
export const DEFAULT_STRIKE_INNER_GLOW_WIDTH = 12.0;
export const DEFAULT_STRIKE_OUTER_GLOW_WIDTH = 38.0;
export const DEFAULT_STRIKE_OVERHANG_RATIO = 0.12;
export const DEFAULT_STOMP_NOTE_RADIUS = 24;
export const DEFAULT_STOMP_NOTE_MIN_SCALE = 0.3;
export const DEFAULT_STOMP_NOTE_MAX_SCALE = 1.25;
export const DEFAULT_STRIKE_AURA_SHADOW_BLUR = 22;
export const DEFAULT_STRIKE_AURA_SHADOW_COLOR = '#FF6600';
export const DEFAULT_STRIKE_CORE_GRADIENT_START = '#FFB800';
export const DEFAULT_STRIKE_CORE_GRADIENT_END = '#FF8800';

export interface RunningMatConfig {
  readonly baseYTop: number;
  readonly baseYBottom: number;
  readonly widthRatio: number;
  readonly maxNarrowWidthRatio: number;
  readonly vanishingYRatio: number;

  // 셀 투명도 및 테두리 색상 (웹캠 투과형 반투명 배경)
  readonly cellBgColor: string;
  readonly cellActiveBgColor: string;
  readonly cellNextBgColor: string;
  readonly cellBorderColor: string;
  readonly cellBorderActiveColor: string;
  readonly cellBorderNextColor: string;
  readonly cellLineWidth: number;

  // 발자국 슬롯 및 강조 색상
  readonly footHomeStroke: string;
  readonly footHomeFill: string;
  readonly footCurrentFill: string;
  readonly footCurrentStroke: string;
  readonly footCurrentGlow: string;
  readonly footNextFill: string;
  readonly footNextStroke: string;
  readonly footNextDash: readonly number[];

  // NEXT 수축 링
  readonly nextRingColor: string;
  readonly nextRingMinScale: number;
  readonly nextRingMaxScale: number;
  readonly nextRingLineWidth: number;

  // 화살표 및 인디케이터
  readonly arrowActiveColor: string;
  readonly arrowNextColor: string;
  readonly arrowReturnColor: string;

  // 타이포그래피 & 뱃지
  readonly textPrimaryColor: string;
  readonly textSecondaryColor: string;
  readonly textAccentColor: string;
  readonly textShortageColor: string;
  readonly textPrepareColor: string;

  // 박 내 단계 분할 및 다음 2박 예고 스타일 (Issue #408)
  readonly returnPhaseRatio: number;
  readonly preview1StrokeColor: string;
  readonly preview1LineWidth: number;
  readonly preview1Label: string;
  readonly preview2StrokeColor: string;
  readonly preview2LineWidth: number;
  readonly preview2Label: string;
  readonly kneeLiftText: string;
  readonly kneeReturnText: string;

  // 네온 글로우 발 판정선 (Strike Line) 설정 (Issue #421, #422)
  readonly strikeLineYRatio: number;
  readonly strikeCoreLineWidth: number;
  readonly strikeInnerGlowWidth: number;
  readonly strikeOuterGlowWidth: number;
  readonly strikeOverhangRatio: number;
  readonly strikeCoreColor: string;
  readonly strikeInnerColor: string;
  readonly strikeOuterColor: string;
  readonly strikeActivePulseGlow: string;
  readonly targetAnchorRadius: number;

  // 발 리듬 비트 노트(Stomp Beat Note) 설정 (Issue #425)
  readonly stompNoteRadius: number;
  readonly stompNoteMinScale: number;
  readonly stompNoteMaxScale: number;
  readonly stompNoteLeftColor: string;
  readonly stompNoteCenterColor: string;
  readonly stompNoteRightColor: string;
  readonly stompNoteSymbol: string;

  // 듀얼 네온 블러 및 동적 반응 설정 (Issue #426)
  readonly strikeAuraShadowBlur: number;
  readonly strikeAuraShadowColor: string;
  readonly strikeCoreGradientStart: string;
  readonly strikeCoreGradientEnd: string;
  readonly strikeBreathSpeed: number;
  readonly strikeHitFlashDuration: number;

  // 3대 레인 발자국 슬롯 오프셋 규격 (Issue #494 / LANE-SYNC-01)
  readonly laneOffsetLeft?: number;
  readonly laneOffsetCenter?: number;
  readonly laneOffsetRight?: number;
  readonly homeFootSpreadRatio?: number;
}

export const RUNNING_MAT_CONFIG: RunningMatConfig = Object.freeze({
  baseYTop: DEFAULT_MAT_BASE_Y_TOP,
  baseYBottom: DEFAULT_MAT_BASE_Y_BOTTOM,
  widthRatio: DEFAULT_MAT_WIDTH_RATIO,
  maxNarrowWidthRatio: MAX_NARROW_WIDTH_RATIO,
  vanishingYRatio: DEFAULT_VANISHING_Y_RATIO,

  cellBgColor: 'rgba(10, 25, 45, 0.45)',
  cellActiveBgColor: 'rgba(0, 229, 255, 0.22)',
  cellNextBgColor: 'rgba(255, 203, 77, 0.18)',
  cellBorderColor: 'rgba(0, 229, 255, 0.45)',
  cellBorderActiveColor: '#00E5FF',
  cellBorderNextColor: 'rgba(255, 203, 77, 0.85)',
  cellLineWidth: 2.0,

  footHomeStroke: 'rgba(255, 255, 255, 0.35)',
  footHomeFill: 'rgba(255, 255, 255, 0.08)',
  footCurrentFill: '#00E5FF',
  footCurrentStroke: '#FFFFFF',
  footCurrentGlow: 'rgba(0, 229, 255, 0.8)',
  footNextFill: 'rgba(255, 203, 77, 0.20)',
  footNextStroke: '#FFCB4D',
  footNextDash: Object.freeze([5, 4]),

  nextRingColor: '#FFCB4D',
  nextRingMinScale: 1.0,
  nextRingMaxScale: 2.2,
  nextRingLineWidth: 2.5,

  arrowActiveColor: '#00E5FF',
  arrowNextColor: '#FFCB4D',
  arrowReturnColor: '#A0E8FF',

  textPrimaryColor: '#FFFFFF',
  textSecondaryColor: '#A0D8EF',
  textAccentColor: '#FFCB4D',
  textShortageColor: '#FF865E',
  textPrepareColor: '#C889FF',

  returnPhaseRatio: DEFAULT_RETURN_PHASE_RATIO,
  preview1StrokeColor: 'rgba(255, 203, 77, 0.95)',
  preview1LineWidth: 2.5,
  preview1Label: '다음',
  preview2StrokeColor: 'rgba(255, 203, 77, 0.45)',
  preview2LineWidth: 1.5,
  preview2Label: '그다음',
  kneeLiftText: '무릎 들기',
  kneeReturnText: '기본 자세 복귀',

  strikeLineYRatio: DEFAULT_STRIKE_LINE_Y_RATIO,
  strikeCoreLineWidth: DEFAULT_STRIKE_CORE_LINE_WIDTH,
  strikeInnerGlowWidth: DEFAULT_STRIKE_INNER_GLOW_WIDTH,
  strikeOuterGlowWidth: DEFAULT_STRIKE_OUTER_GLOW_WIDTH,
  strikeOverhangRatio: DEFAULT_STRIKE_OVERHANG_RATIO,
  strikeCoreColor: '#FFFFF0',
  strikeInnerColor: '#FFB703',
  strikeOuterColor: 'rgba(255, 128, 0, 0.42)',
  strikeActivePulseGlow: '#FFD166',
  targetAnchorRadius: 15,

  stompNoteRadius: DEFAULT_STOMP_NOTE_RADIUS,
  stompNoteMinScale: DEFAULT_STOMP_NOTE_MIN_SCALE,
  stompNoteMaxScale: DEFAULT_STOMP_NOTE_MAX_SCALE,
  stompNoteLeftColor: '#00E5FF',
  stompNoteCenterColor: '#FFD166',
  stompNoteRightColor: '#FF8800',
  stompNoteSymbol: '♪',

  strikeAuraShadowBlur: DEFAULT_STRIKE_AURA_SHADOW_BLUR,
  strikeAuraShadowColor: DEFAULT_STRIKE_AURA_SHADOW_COLOR,
  strikeCoreGradientStart: DEFAULT_STRIKE_CORE_GRADIENT_START,
  strikeCoreGradientEnd: DEFAULT_STRIKE_CORE_GRADIENT_END,
  strikeBreathSpeed: 2.5,
  strikeHitFlashDuration: 0.38,

  laneOffsetLeft: DEFAULT_LANE_SLOT_OFFSETS.left,
  laneOffsetCenter: DEFAULT_LANE_SLOT_OFFSETS.center,
  laneOffsetRight: DEFAULT_LANE_SLOT_OFFSETS.right,
  homeFootSpreadRatio: 0.55,
});
