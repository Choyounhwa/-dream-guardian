/**
 * 3D 원근 투영 및 드림 그리드 전용 설정
 *
 * Issue #227 (RENDER-PROJ-001):
 * - 하드코딩된 투영/안개/소실점 수치를 독립 설정 파일로 분리
 */

export const Z_NEAR = 1.0;
export const DELTA_Z = 0.20;
export const LINE_COUNT_Z = 16;
export const FADE_DEPTH = 0.14;
export const HORIZON_RATIO = 0.56; // 런웨이 바닥 지평선 (화면 높이 56% 위치, 하단 44% 플랫폼)
export const FOG_START = 0.10;
export const FOG_RANGE = 0.32;
export const CEILING_DELTA_Z = 0.22;
export const CEILING_LINE_COUNT_Z = 12;

// Issue #282: SFX 런웨이 듀얼 네온 및 비주얼 요소 설정
export const LONGITUDINAL_COLOR = '#00E5FF'; // 세로 방향 일렉트릭 시안
export const TRANSVERSE_COLOR = '#FF7A28'; // 가로 비트 방향 네온 오렌지/앰버
export const CENTER_SPINE_COLOR = '#E0F7FF'; // 중앙 척추선 초고휘도 청백색 코어
export const CROSSING_NODE_COLOR = '#FFFFFF'; // 교차점 노드 주 색상
export const CROSSING_NODE_SECONDARY_COLOR = '#FFCB4D'; // 교차점 노드 보조 색상
export const PANEL_DEPTH_START = 0.50; // 전경 패널 음영 시작 깊이 비율 (0.50 ~ 1.0)
export const PANEL_BG_COLOR = 'rgba(6, 10, 18, 0.90)'; // 전경 딥 차콜 메탈릭 베이스 (초고대비)

// 선 두께 원근 다이내믹스 규격
export const TRANSVERSE_MAX_WIDTH = 6.0; // 가로선 전경 최대 두께
export const TRANSVERSE_MIN_WIDTH = 1.0; // 가로선 원경 최소 두께
export const LONGITUDINAL_MAX_WIDTH = 4.5; // 세로선 전경 최대 두께
export const LONGITUDINAL_MIN_WIDTH = 0.8; // 세로선 원경 최소 두께
export const CENTER_SPINE_MAX_WIDTH = 8.0; // 중앙 척추선 전경 최대 두께
export const CENTER_SPINE_GLOW_WIDTH = 12.0; // 중앙 척추선 외곽 글로우 두께
export const CENTER_SPINE_CORE_WIDTH = 3.5; // 중앙 척추선 중심 순백 코어 두께

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
  TRANSVERSE_MAX_WIDTH,
  TRANSVERSE_MIN_WIDTH,
  LONGITUDINAL_MAX_WIDTH,
  LONGITUDINAL_MIN_WIDTH,
  CENTER_SPINE_MAX_WIDTH,
  CENTER_SPINE_GLOW_WIDTH,
  CENTER_SPINE_CORE_WIDTH,
} as const;

export const GRID_CONFIG = DEFAULT_GRID_CONFIG;
