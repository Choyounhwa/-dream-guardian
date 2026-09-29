/**
 * 3D 원근 투영 및 드림 그리드 전용 설정
 *
 * Issue #227 (RENDER-PROJ-001):
 * - 하드코딩된 투영/안개/소실점 수치를 독립 설정 파일로 분리
 */

export const Z_NEAR = 1.0;
export const DELTA_Z = 0.18;
export const LINE_COUNT_Z = 18;
export const FADE_DEPTH = 0.14;
export const HORIZON_RATIO = 0.24;
export const FOG_START = 0.16;
export const FOG_RANGE = 0.28;
export const CEILING_DELTA_Z = 0.22;
export const CEILING_LINE_COUNT_Z = 12;

export const DEFAULT_GRID_CONFIG = {
  Z_NEAR,
  DELTA_Z,
  LINE_COUNT_Z,
  FADE_DEPTH,
  HORIZON_RATIO,
  FOG_START,
  FOG_RANGE,
  CEILING_DELTA_Z,
  CEILING_LINE_COUNT_Z,
} as const;

export const GRID_CONFIG = DEFAULT_GRID_CONFIG;
