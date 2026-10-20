/**
 * presentation.ts - 프레젠테이션 슬롯 오버라이드 기본 인터페이스 및 유틸리티
 *
 * Issue #631: [REFACTOR-DRY-004] 프레젠테이션 슬롯 오버라이드 베이스 인터페이스 공통화
 */

export interface BaseSlotOverride {
  text?: string;
  color?: string;
  textColor?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  glowColor?: string;
  fontSize?: number;
  visible?: boolean;
  opacity?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  [key: string]: unknown;
}

/**
 * 주어진 값이 유효한 BaseSlotOverride 형태의 객체인지 판정하는 타입 가드
 */
export function isBaseSlotOverride(val: unknown): val is BaseSlotOverride {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * 두 개의 슬롯 오버라이드(기본값 및 오버라이드)를 불변 객체로 안전하게 병합
 */
export function mergeSlotOverrides<T extends BaseSlotOverride = BaseSlotOverride>(
  base?: T,
  override?: T
): T | undefined {
  if (!base && !override) return undefined;
  if (!base) return override ? { ...override } : undefined;
  if (!override) return { ...base };
  return { ...base, ...override };
}
