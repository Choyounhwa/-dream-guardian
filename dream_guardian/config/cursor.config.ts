/**
 * cursor.config.ts - 4색 신체 커서 색상, 신뢰도 임계값 및 기하 형상 설정 (Issue #120 / CFG-001)
 *
 * 개발 규칙 6절 (데이터와 코드 분리) 준수:
 * - 커서 종류: leftHand, rightHand, head, shoulder, hip
 * - 커서 색상: 시안(#28E6FF), 노랑(#FFCB4D), 보라(#C889FF), 주황(#FF865E)
 * - 신뢰도 임계값 및 렌더링 규격
 */

/** 커서 종류 */
export type CursorType = 'leftHand' | 'rightHand' | 'head' | 'shoulder' | 'hip';

/** 4색 커서 색상 매핑 */
export const CURSOR_COLORS: Record<CursorType, string> = {
  leftHand: '#28E6FF',
  rightHand: '#FFCB4D',
  head: '#C889FF',      // 머리/얼굴 (보라)
  shoulder: '#C889FF',  // 어깨 (호환성 유지)
  hip: '#FF865E',       // 골반/엉덩이 (주황)
};

/** 커서 인식 유효성 신뢰도 임계값 */
export const CURSOR_CONFIDENCE_THRESHOLD = 0.45;

/** 커서 렌더링 형상 및 크기 설정 (픽셀 기준, Issue #117: Outline Only, Issue #144: 실사용 1080p 스케일업) */
export const CURSOR_DIMENSIONS = {
  outlineOnly: true,
  lineWidth: 3,
  hand: {
    defaultRadius: 45,
    minRadius: 15,
    maxRadius: 90,
    pulseRingOffset: 8,
    pulseRingAmplitude: 5,
    pulseLineWidth: 2,
  },
  head: {
    defaultRadiusX: 55,
    defaultRadiusY: 72,
    minRadiusX: 14,
    maxRadiusX: 140,
    minRadiusY: 18,
    maxRadiusY: 185,
  },
  hip: {
    defaultHalfWidth: 55,
    defaultTopOffset: 32,
    defaultBottomOffset: 42,
    minHalfWidth: 16,
    maxHalfWidth: 120,
  },
  dwellArc: {
    arcOffset: 12,
    lineWidth: 4,
    color: '#4DFFAA',
  },
} as const;
