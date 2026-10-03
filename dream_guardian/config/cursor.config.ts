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

/** 커서 가시성 설정 (Issue #369 / FEAT-CURSOR-006: 답안 판정 미사용 머리·골반 커서 화면 숨김) */
export const CURSOR_VISIBILITY: Record<CursorType, boolean> = {
  leftHand: true,
  rightHand: true,
  head: false,      // 머리/얼굴 (답안 판정 미사용으로 화면 숨김)
  shoulder: false,  // 어깨 (미사용)
  hip: false,       // 골반/엉덩이 (답안 판정 미사용으로 화면 숨김)
};

/** 양손 모으기(합장) 메뉴 커서 3배 확대 규격 (Issue #201 / FEAT-CURSOR-005) */
export const JOINED_HANDS_CURSOR = {
  ringRadius: 100,         // 합장 외곽 네온 링 반경 (기존 34px -> 100px, 지름 200px, 3배 확대)
  pulseAmplitude: 12,      // 펄스 진폭 (기존 4px -> 12px)
  pulseSpeed: 150,         // 펄스 애니메이션 속도
  lineWidth: 8,            // 네온 링 선 두께 (기존 3.5px -> 8px)
  fontSize: 40,            // 중심 텍스트 폰트 크기 (기존 14px -> 40px)
  progressRadius: 145,     // 0.8초 호버 체류 충전 아크 반경 (기존 50px -> 145px)
  progressLineWidth: 16,   // 충전 아크 선 두께 (기존 7px -> 16px)
  progressBlur: 24,        // 충전 아크 발광 블러 (기존 18px -> 24px)
  shadowBlur: 20,          // 네온 링 발광 블러 (기존 15px -> 20px)
} as const;

/** 커서 렌더링 형상 및 크기 설정 (픽셀 기준, Issue #117: Outline Only, Issue #144: 실사용 1080p 스케일업, Issue #201: 원거리 시인성 강화) */
export const CURSOR_DIMENSIONS = {
  outlineOnly: true,
  lineWidth: 3,
  hand: {
    defaultRadius: 60,
    minRadius: 20,
    maxRadius: 120,
    pulseRingOffset: 10,
    pulseRingAmplitude: 6,
    pulseLineWidth: 3,
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
    defaultHalfWidth: 80,
    defaultTopOffset: 36,
    defaultBottomOffset: 36,
    aspectRatio: 0.45, // 납작한 마름모 세로:가로 비율 (halfHeight = halfWidth * 0.45)
    minHalfWidth: 20,
    maxHalfWidth: 220,
  },
  dwellArc: {
    arcOffset: 12,
    lineWidth: 4,
    color: '#4DFFAA',
  },
  joinedHands: JOINED_HANDS_CURSOR,
} as const;
