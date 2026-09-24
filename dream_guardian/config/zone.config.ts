/**
 * zone.config.ts - 피트니스 존 좌표 및 허용 부위 설정 (Issue #120 / Issue #121 - ZONE-001 / Issue #149 - FEAT-ZONE-002)
 *
 * 개발 규칙 6절 (데이터와 코드 분리) 및 RC-9, RC-6 준수:
 * - 11개 피트니스 존 겹침 0% 레이아웃 (18:9 화면 최적화)
 * - 상단 문제 텍스트 밴드 (y: 0.24~0.40) 및 답안 버튼 밴드 (y: 0.42~0.56) 영역 예약
 * - HEAD_ZONES ∩ HIP_ZONES = ∅ (머리-골반 충돌 원천 차단)
 */

export interface FitnessZone {
  id: number;
  label: string;
  /** 정규화 좌표 (0~1) */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReservedBand {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * UI 전용 예약 밴드 영역 (피트니스 존과 겹침 0%)
 */
export const RESERVED_BANDS = {
  question: {
    name: '문제 텍스트 밴드',
    x: 0.30,
    y: 0.24,
    width: 0.40,
    height: 0.16,
  },
  answer: {
    name: '답안 버튼 밴드',
    x: 0.28,
    y: 0.42,
    width: 0.44,
    height: 0.14,
  },
} as const;

/**
 * 11개 피트니스 존 기본 레이아웃 (정규화 좌표)
 *
 * 모든 인접 존 간 수평 7% 이상, 수직 4%~18%의 안전 여백을 두어
 * 상호 겹침(Overlap) 0%를 수치적으로 보장함
 */
export const DEFAULT_FITNESS_ZONES: readonly FitnessZone[] = [
  { id: 1,  label: '좌상', x: 0.04, y: 0.04, width: 0.26, height: 0.16 },
  { id: 2,  label: '상단', x: 0.37, y: 0.04, width: 0.26, height: 0.16 },
  { id: 3,  label: '우상', x: 0.70, y: 0.04, width: 0.26, height: 0.16 },
  { id: 4,  label: '좌',   x: 0.04, y: 0.24, width: 0.26, height: 0.16 },
  { id: 5,  label: '우',   x: 0.70, y: 0.24, width: 0.26, height: 0.16 },
  { id: 6,  label: '좌하', x: 0.04, y: 0.58, width: 0.26, height: 0.16 },
  { id: 7,  label: '중하', x: 0.37, y: 0.58, width: 0.26, height: 0.16 },
  { id: 8,  label: '우하', x: 0.70, y: 0.58, width: 0.26, height: 0.16 },
  { id: 9,  label: '좌저', x: 0.04, y: 0.78, width: 0.26, height: 0.16 },
  { id: 10, label: '하단', x: 0.37, y: 0.78, width: 0.26, height: 0.16 },
  { id: 11, label: '우저', x: 0.70, y: 0.78, width: 0.26, height: 0.16 },
];

/** 호환성 유지를 위한 FITNESS_ZONES 별칭 */
export const FITNESS_ZONES: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES;

/**
 * 머리/얼굴 커서 사용 가능 존 (중단 좌/우 존 4, 5 한정, Issue #156 / FEAT-ZONE-003)
 * 존 1~3 점프 체류 불가 문제 배제 및 HEAD_ZONES ∩ HIP_ZONES = ∅ (상호 배타적 보장)
 */
export const HEAD_ZONES = new Set<number>([4, 5]);

/** 어깨 커서 사용 가능 존 (중간존 4, 5, 6, 7, 8 - 호환) */
export const SHOULDER_ZONES = new Set<number>([4, 5, 6, 7, 8]);

/**
 * 엉덩이/골반 커서 사용 가능 존 (하단 및 스쿼트 존 6, 7, 8, 9, 10, 11)
 */
export const HIP_ZONES = new Set<number>([6, 7, 8, 9, 10, 11]);

/**
 * 왼손 커서 사용 가능 존 (전 존 1~11 허용, Issue #156)
 */
export const LEFT_HAND_ZONES = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

/**
 * 오른손 커서 사용 가능 존 (전 존 1~11 허용, Issue #156)
 */
export const RIGHT_HAND_ZONES = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

/**
 * Cross-Body 물리 연동 제약 검증:
 * 골반이 최하단(존 9, 10, 11)일 때 손이 최상단(존 1, 2, 3)에 위치하는 비현실적 자세 차단 (Issue #156)
 */
export function isCrossBodyViolation(handZone: number, hipZone: number): boolean {
  const isHipBottom = hipZone >= 9 && hipZone <= 11;
  const isHandTop = handZone >= 1 && handZone <= 3;
  return isHipBottom && isHandTop;
}

/**
 * 특정 커서가 특정 피트니스 존에 유효한지 검증 (Issue #156)
 */
export function isValidZoneForCursor(cursor: string, zoneId: number): boolean {
  if (cursor === 'head') return HEAD_ZONES.has(zoneId);
  if (cursor === 'hip') return HIP_ZONES.has(zoneId);
  if (cursor === 'leftHand') return LEFT_HAND_ZONES.has(zoneId);
  if (cursor === 'rightHand') return RIGHT_HAND_ZONES.has(zoneId);
  if (cursor === 'shoulder') return SHOULDER_ZONES.has(zoneId);
  return false;
}
