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
export const PANEL_BG_COLOR = 'transparent'; // 전경 패널 기본 투명 (Issue #294: 웹캠 및 배경 투과율 100% 보장)

// 선 두께 원근 다이내믹스 규격 (Issue #295: 1080p 시인성 대폭 상향)
export const TRANSVERSE_MAX_WIDTH = 8.0; // 가로선 전경 최대 두께 (기존 6.0에서 상향)
export const TRANSVERSE_MIN_WIDTH = 1.8; // 가로선 원경 최소 두께 (기존 1.0에서 상향)
export const LONGITUDINAL_MAX_WIDTH = 6.0; // 세로선 전경 최대 두께 (기존 4.5에서 상향)
export const LONGITUDINAL_MIN_WIDTH = 1.5; // 세로선 원경 최소 두께 (기존 0.8에서 상향)
export const CENTER_SPINE_MAX_WIDTH = 8.0; // 중앙 척추선 전경 최대 두께
export const CENTER_SPINE_GLOW_WIDTH = 12.0; // 중앙 척추선 외곽 글로우 두께
export const CENTER_SPINE_CORE_WIDTH = 3.5; // 중앙 척추선 중심 순백 코어 두께

// Issue #295: 일반 세로선 2-Pass 네온 글로우 파라미터
export const LONGITUDINAL_GLOW_WIDTH_MULT = 2.5; // 외곽 소프트 글로우 선폭 배율 (코어 선폭의 2.5배)
export const LONGITUDINAL_GLOW_ALPHA_MULT = 0.40; // 외곽 글로우 알파 배율

// Issue #295: 메트로놈 비트 플래시 파라미터
export const BEAT_FLASH_MAX_ALPHA = 0.35; // 비트 직후 최대 추가 알파 부스트
export const BEAT_FLASH_WIDTH_BOOST = 1.5; // 비트 직후 선폭 배율 부스트 (최대 1.5배)
export const BEAT_FLASH_DECAY = 4.5; // 비트 진행도에 따른 지수 감쇄율

// Issue #320 (RENDER-GRID-005): 바닥 가로선 확장 및 와이드 지대(Wide Terrain) 파라미터
export const TRANSVERSE_SPAN_MULTIPLIER = 1.8; // 바닥 가로선 좌우 확장 배율 (기존 1.0 대비 1.8배로 확장하여 광활한 지대감 연출)

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
  LONGITUDINAL_GLOW_WIDTH_MULT,
  LONGITUDINAL_GLOW_ALPHA_MULT,
  BEAT_FLASH_MAX_ALPHA,
  BEAT_FLASH_WIDTH_BOOST,
  BEAT_FLASH_DECAY,
  TRANSVERSE_SPAN_MULTIPLIER,
} as const;

export const GRID_CONFIG = DEFAULT_GRID_CONFIG;
