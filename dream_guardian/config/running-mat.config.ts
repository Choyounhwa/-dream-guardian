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
});
