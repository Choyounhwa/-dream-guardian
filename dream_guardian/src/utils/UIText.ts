/**
 * UIText.ts - UI 텍스트 중앙 렌더링 및 레이아웃/테마 접근성 유틸리티 (Issue #257 / UI-TOKEN-002)
 *
 * 개발 규칙 6절 (데이터와 코드 분리) 및 12절 (UI 개발 규칙) 준수:
 * 1. getFont(role, scaleX, weight?, fontFamily?): 역할 기반 Canvas 2D 폰트 문자열 자동 생성
 * 2. getFontSize(role, scaleX): 역할 + 스케일 → 최종 px 숫자 반환 (fontScale 반영, minPhysicalPx/token.min 하한 보장)
 * 3. getColor(colorKey): 현재 접근성 테마(default / highContrast) 기반 색상 반환
 * 4. getLayoutSlot(screen, element?, width?, height?): UI_LAYOUT 가상 좌표를 물리 좌표로 비파괴 변환
 * 5. 접근성 제어: setFontScale, setHighContrast, setMinPhysicalPx, resetAccessibility, getAccessibility
 */

import {
  UI_TEXT_TOKENS,
  UI_ACCESSIBILITY,
  UI_COLOR_THEMES,
  UI_LAYOUT,
  type UITextRole,
  type UITextToken,
  type UIAccessibilityConfig,
  type UIColorTheme,
  type UILayoutConfig,
} from '../../config/ui.config.js';

export interface PhysicalLayoutSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  scaleX: number;
  scaleY: number;
}

// ─── 내부 접근성 상태 (UI_ACCESSIBILITY 기본값 복제) ───
let currentAccessibility: UIAccessibilityConfig = { ...UI_ACCESSIBILITY };

/**
 * 전역 폰트 크기 배율(fontScale) 설정
 * @param scale 배율 (예: 1.0, 1.2, 1.5, 2.0)
 */
export function setFontScale(scale: number): void {
  currentAccessibility.fontScale = Math.max(0.1, scale);
}

/**
 * 고대비 테마(highContrast) 활성화 여부 설정
 * @param enabled true: 고대비 테마, false: 기본 테마
 */
export function setHighContrast(enabled: boolean): void {
  currentAccessibility.highContrast = enabled;
}

/**
 * 물리 픽셀 기준 최소 폰트 크기 하한선(minPhysicalPx) 설정
 * @param minPx 최소 물리 픽셀
 */
export function setMinPhysicalPx(minPx: number): void {
  currentAccessibility.minPhysicalPx = Math.max(0, minPx);
}

/**
 * 접근성 설정을 ui.config.ts 기본값으로 초기화
 */
export function resetAccessibility(): void {
  currentAccessibility = { ...UI_ACCESSIBILITY };
}

/**
 * 현재 접근성 설정 복사본 조회
 */
export function getAccessibility(): Readonly<UIAccessibilityConfig> {
  return { ...currentAccessibility };
}

/**
 * 역할(role)과 화면 스케일(scaleX)을 기반으로 계산된 최종 폰트 크기(px) 반환
 * - fontScale 반영
 * - minPhysicalPx 및 token.min 하한선 이중 보장
 *
 * @param role UI 텍스트 역할
 * @param scaleX 가로 스케일 비율 (기본값: 1.0)
 */
export function getFontSize(role: UITextRole, scaleX: number = 1.0): number {
  const token: UITextToken = UI_TEXT_TOKENS[role] ?? UI_TEXT_TOKENS.body;
  const scaled = Math.round(token.base * scaleX * currentAccessibility.fontScale);
  const minBound = Math.max(token.min, currentAccessibility.minPhysicalPx);
  return Math.max(scaled, minBound);
}

/**
 * 역할(role)과 화면 스케일(scaleX)을 기반으로 Canvas 2D `ctx.font` 표준 문자열 생성
 * 예: 'bold 44px sans-serif'
 *
 * @param role UI 텍스트 역할
 * @param scaleX 가로 스케일 비율 (기본값: 1.0)
 * @param weight 폰트 가중치 오버라이드 (기본값: token.weight)
 * @param fontFamily 폰트 패밀리 (기본값: 'sans-serif')
 */
export function getFont(
  role: UITextRole,
  scaleX: number = 1.0,
  weight?: string,
  fontFamily: string = 'sans-serif',
): string {
  const token: UITextToken = UI_TEXT_TOKENS[role] ?? UI_TEXT_TOKENS.body;
  const size = getFontSize(role, scaleX);
  const w = weight ?? token.weight;
  return `${w} ${size}px ${fontFamily}`;
}

/**
 * 현재 테마(default / highContrast) 기반의 UI 색상 코드 반환
 *
 * @param colorKey UIColorTheme 키 이름
 */
export function getColor(colorKey: keyof UIColorTheme | string): string {
  const theme = currentAccessibility.highContrast
    ? UI_COLOR_THEMES.highContrast
    : UI_COLOR_THEMES.default;

  return theme[colorKey] ?? UI_COLOR_THEMES.default[colorKey] ?? '#FFFFFF';
}

/**
 * UI_LAYOUT에 정의된 1080x2160 가상 좌표를 물리 Canvas 해상도에 맞춘 물리 좌표 슬롯으로 변환
 *
 * @param screen 화면 명칭 ('hud' | 'menu' | 'subMenu' | 'result' | 'bottomBar' | 'settings' | 'pause')
 * @param element 화면 내 세부 요소 명칭 (생략 시 화면 자체 슬롯 반환)
 * @param width 대상 물리 캔버스 너비 (기본값: 1080)
 * @param height 대상 물리 캔버스 높이 (기본값: 2160)
 */
export function getLayoutSlot(
  screen: keyof UILayoutConfig | string,
  element?: string,
  width: number = 1080,
  height: number = 2160,
): PhysicalLayoutSlot {
  const scaleX = width / 1080;
  const scaleY = height / 2160;

  const screenSlot = (UI_LAYOUT as unknown as Record<string, unknown>)[screen];
  if (!screenSlot || typeof screenSlot !== 'object') {
    return { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY };
  }

  let target: unknown = screenSlot;
  if (element && element in (screenSlot as Record<string, unknown>)) {
    target = (screenSlot as Record<string, unknown>)[element];
  } else if (element) {
    return { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY };
  }

  if (!target || typeof target !== 'object') {
    return { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY };
  }

  const slotObj = target as Record<string, unknown>;
  const rawX = typeof slotObj.x === 'number' ? slotObj.x : 0;
  const rawY = typeof slotObj.y === 'number' ? slotObj.y : 0;
  const rawW = typeof slotObj.w === 'number' ? slotObj.w : 0;
  const rawH = typeof slotObj.h === 'number' ? slotObj.h : 0;

  return {
    x: Math.round(rawX * scaleX),
    y: Math.round(rawY * scaleY),
    w: Math.round(rawW * scaleX),
    h: Math.round(rawH * scaleY),
    scaleX,
    scaleY,
  };
}

/**
 * UIText 네임스페이스 싱글톤 객체
 */
export const UIText = {
  getFont,
  getFontSize,
  getColor,
  getLayoutSlot,
  setFontScale,
  setHighContrast,
  setMinPhysicalPx,
  resetAccessibility,
  getAccessibility,
};

export default UIText;
