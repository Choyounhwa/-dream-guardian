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

// Issue #282: SFX 런웨이 듀얼 네온 및 비주얼 요소 설정
export const LONGITUDINAL_COLOR = '#28E6FF'; // 세로 방향 네온 시안
export const TRANSVERSE_COLOR = '#FF8844'; // 가로 비트 방향 네온 오렌지/앰버
export const CENTER_SPINE_COLOR = '#C8F5FF'; // 중앙 척추선 청백색 코어
export const CROSSING_NODE_COLOR = '#FFFFFF'; // 교차점 노드 주 색상
export const CROSSING_NODE_SECONDARY_COLOR = '#FFCB4D'; // 교차점 노드 보조 색상
export const PANEL_DEPTH_START = 0.55; // 전경 패널 음영 시작 깊이 비율 (0.55 ~ 1.0)
export const PANEL_BG_COLOR = 'rgba(10, 16, 32, 0.45)'; // 전경 패널 은은한 메탈릭 베이스

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
  LONGITUDINAL_COLOR,
  TRANSVERSE_COLOR,
  CENTER_SPINE_COLOR,
  CROSSING_NODE_COLOR,
  CROSSING_NODE_SECONDARY_COLOR,
  PANEL_DEPTH_START,
  PANEL_BG_COLOR,
} as const;

export const GRID_CONFIG = DEFAULT_GRID_CONFIG;
