/**
 * UILayoutOverride - public/layouts/ui-layout.json 을 UI_LAYOUT 에 검증 후 깊은 병합(in-place) 적용
 *
 * [DEVUI-002] (Issue #562) / [DEVUI-009] (Issue #578)
 * - 객체를 교체하지 않고 숫자 값만 제자리에서 갱신한다.
 *   (BOTTOM_BAR_CONFIG, PauseModal.MODAL_VIRTUAL 등이 하위 객체 참조를 보관하기 때문)
 * - 대상에 존재하는 키만, 같은 타입의 유한한 숫자만 허용한다.
 *   가로 계열(x·w 등) 0~1080, 세로 계열(y·h 등) 0~2160, 크기(w·h 등) > 0.
 * - 잘못된 항목은 해당 항목만 무시하고 경고 목록으로 반환한다. JSON 자체가 깨지면 전체 무시.
 * - __proto__·constructor·prototype 키는 거부한다 (프로토타입 오염 방지).
 * - 판정 연동 좌표(zone.config 등)는 UI_LAYOUT 밖에 있으므로 대상이 아니다 (판정 좌표 잠금).
 */

import { UI_LAYOUT } from '../../config/ui.config.js';

export const UI_LAYOUT_OVERRIDE_URL = '/layouts/ui-layout.json';

const VIRTUAL_WIDTH = 1080;
const VIRTUAL_HEIGHT = 2160;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const HORIZONTAL_KEYS = new Set([
  'x', 'cx', 'left', 'right', 'startX', 'gapX', 'marginRight', 'barX', 'textX',
  'w', 'width', 'cardWidth', 'barW',
]);

const VERTICAL_KEYS = new Set([
  'y', 'cy', 'top', 'bottom', 'startY', 'gapY', 'cardHeight', 'barY', 'textY',
  'h', 'height', 'barH',
  'liftY', 'sloganGapY', 'captionGapY', 'chapterY', 'nameY', 'subY', 'starsY', 'labelY', 'subLabelY', 'comboTextOffsetY', 'statLineHeight',
]);

const SIZE_KEYS = new Set([
  'w', 'h', 'width', 'height', 'cardWidth', 'cardHeight', 'cols',
  'r', 'radius', 'barW', 'barH', 'iconSize',
]);

export interface LayoutKeyRule {
  min: number;
  max: number;
  step: number;
  integer: boolean;
}

export function isTextScaleKey(key: string): boolean {
  const leaf = key.includes('.') ? key.split('.').pop()! : key;
  return leaf === 'textScale' || leaf.endsWith('TextScale') || key.endsWith('.textScale');
}

export function isHorizontalKey(key: string): boolean {
  const leaf = key.includes('.') ? key.split('.').pop()! : key;
  if (HORIZONTAL_KEYS.has(leaf)) return true;
  if (leaf === 'w' || leaf === 'W') return true;
  return /(?:x|width|left|right)$/i.test(leaf);
}

export function isVerticalKey(key: string): boolean {
  const leaf = key.includes('.') ? key.split('.').pop()! : key;
  if (VERTICAL_KEYS.has(leaf)) return true;
  if (leaf === 'h' || leaf === 'H') return true;
  return /(?:y|height|top|bottom)$/i.test(leaf);
}

export function isSizeKey(key: string): boolean {
  const leaf = key.includes('.') ? key.split('.').pop()! : key;
  if (SIZE_KEYS.has(leaf)) return true;
  return /(?:w|h|width|height|size|radius|^gap|Gap)$/i.test(leaf);
}

/**
 * [LAYOUT-010] (Issue #581) 레이아웃 키별 허용 범위 및 단위 규칙 반환
 * - textScale 계열: min 0.5, max 3.0, step 0.01, integer false
 * - 가로 계열: min 0 (크기는 1), max 1080, step 1, integer true
 * - 세로 계열: min 0 (크기는 1), max 2160, step 1, integer true
 * - 크기 계열: min 1, max (가로 1080 / 세로 및 일반 2160), step 1, integer true
 * - 기본 fallback: min 0, max 2160, step 1, integer true
 */
export function getLayoutKeyRule(key: string): LayoutKeyRule {
  const leaf = key.includes('.') ? key.split('.').pop()! : key;
  if (isTextScaleKey(leaf)) {
    return { min: 0.5, max: 3.0, step: 0.01, integer: false };
  }
  if (
    leaf.endsWith('Ratio') ||
    leaf.endsWith('ratio') ||
    (key.startsWith('assault.') && (leaf === 'x' || leaf === 'y'))
  ) {
    return { min: 0, max: 1, step: 0.01, integer: false };
  }
  if (leaf === 'visualScale' || leaf === 'minScale' || leaf === 'maxScale') {
    return { min: 0.1, max: 3.0, step: 0.01, integer: false };
  }
  if (leaf.endsWith('Ms')) {
    return { min: 0, max: 5000, step: 10, integer: true };
  }
  if (leaf === 'labelMaxChars') {
    return { min: 1, max: 30, step: 1, integer: true };
  }
  if (leaf === 'labelMinFontSizePx') {
    return { min: 8, max: 100, step: 1, integer: true };
  }
  const isSize = isSizeKey(leaf);
  const isHoriz = isHorizontalKey(leaf);

  return {
    min: isSize ? 1 : 0,
    max: isHoriz ? VIRTUAL_WIDTH : VIRTUAL_HEIGHT,
    step: 1,
    integer: true,
  };
}

export interface LayoutOverrideResult {
  applied: string[];
  warnings: string[];
}

export type LayoutOverrideLoadStatus = 'applied' | 'missing' | 'failed' | 'invalid';

export interface LayoutOverrideLoadResult extends LayoutOverrideResult {
  status: LayoutOverrideLoadStatus;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateNumber(key: string, value: number): string | null {
  if (!Number.isFinite(value)) return '유한한 숫자가 아님';
  const rule = getLayoutKeyRule(key);
  if (value < rule.min || value > rule.max) {
    if (rule.min === 1 && value <= 0) return '크기는 0보다 커야 함';
    return `범위 밖 (${rule.min}~${rule.max})`;
  }
  return null;
}

function mergeInto(
  target: Record<string, unknown> | unknown[],
  patch: Record<string, unknown> | unknown[],
  path: string,
  result: LayoutOverrideResult,
): void {
  for (const key of Object.keys(patch)) {
    const p = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) {
      result.warnings.push(`${p}: 금지된 키`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      result.warnings.push(`${p}: 알 수 없는 키`);
      continue;
    }
    const tv = (target as Record<string, unknown>)[key];
    const pv = (patch as Record<string, unknown>)[key];

    if (typeof tv === 'number') {
      if (typeof pv !== 'number') {
        result.warnings.push(`${p}: 숫자가 아님`);
        continue;
      }
      const err = validateNumber(key, pv);
      if (err) {
        result.warnings.push(`${p}: ${err}`);
        continue;
      }
      if (tv !== pv) {
        (target as Record<string, unknown>)[key] = pv;
      }
      result.applied.push(p);
    } else if (Array.isArray(tv)) {
      if (!Array.isArray(pv)) {
        result.warnings.push(`${p}: 배열이 아님`);
        continue;
      }
      mergeInto(tv, pv, p, result);
    } else if (isPlainObject(tv)) {
      if (!isPlainObject(pv)) {
        result.warnings.push(`${p}: 객체가 아님`);
        continue;
      }
      mergeInto(tv, pv, p, result);
    } else {
      result.warnings.push(`${p}: 편집할 수 없는 값`);
    }
  }
}

export interface MultiLayoutTargets {
  ui?: Record<string, unknown> | object;
  assault?: Record<string, unknown> | object;
  [key: string]: unknown;
}

/**
 * target 의 숫자 값만 patch 로 제자리 갱신한다. 객체·배열 참조는 교체하지 않는다.
 */
export function applyLayoutOverride(target: object, patch: unknown): LayoutOverrideResult {
  const result: LayoutOverrideResult = { applied: [], warnings: [] };
  if (!isPlainObject(patch)) {
    result.warnings.push('(root): 객체가 아님 — 전체 무시');
    return result;
  }
  const pObj = patch as Record<string, unknown>;
  if (('ui' in pObj || 'assault' in pObj) && !('ui' in target)) {
    if ('ui' in pObj && isPlainObject(pObj.ui)) {
      mergeInto(target as Record<string, unknown>, pObj.ui as Record<string, unknown>, '', result);
    }
    return result;
  }
  mergeInto(target as Record<string, unknown>, patch, '', result);
  return result;
}

/**
 * [DEVUI-008] (Issue #577) 다중 네임스페이스 오버라이드 지원 ({ ui: ..., assault: ... })
 * 루트에 ui 또는 assault 키가 있는 경우 네임스페이스별 타겟에 패치를 적용하고,
 * 레거시 단일 소스 패치는 targets.ui 에 100% 하위 호환으로 적용한다.
 */
export function applyMultiLayoutOverride(
  targets: MultiLayoutTargets,
  patch: unknown,
): LayoutOverrideResult {
  const result: LayoutOverrideResult = { applied: [], warnings: [] };
  if (!isPlainObject(patch)) {
    result.warnings.push('(root): 객체가 아님 — 전체 무시');
    return result;
  }

  const pObj = patch as Record<string, unknown>;
  const hasUi = 'ui' in pObj;
  const hasAssault = 'assault' in pObj;

  if (hasUi || hasAssault) {
    if (hasUi) {
      if (!targets.ui) {
        result.warnings.push('ui: 대상 없음');
      } else if (!isPlainObject(pObj.ui)) {
        result.warnings.push('ui: 객체가 아님');
      } else {
        const subResult: LayoutOverrideResult = { applied: [], warnings: [] };
        mergeInto(
          targets.ui as Record<string, unknown>,
          pObj.ui as Record<string, unknown>,
          'ui',
          subResult,
        );
        result.applied.push(...subResult.applied);
        result.warnings.push(...subResult.warnings);
      }
    }

    if (hasAssault) {
      if (!targets.assault) {
        result.warnings.push('assault: 대상 없음');
      } else if (!isPlainObject(pObj.assault)) {
        result.warnings.push('assault: 객체가 아님');
      } else {
        const subResult: LayoutOverrideResult = { applied: [], warnings: [] };
        mergeInto(
          targets.assault as Record<string, unknown>,
          pObj.assault as Record<string, unknown>,
          'assault',
          subResult,
        );
        result.applied.push(...subResult.applied);
        result.warnings.push(...subResult.warnings);
      }
    }

    for (const k of Object.keys(pObj)) {
      if (k !== 'ui' && k !== 'assault' && k !== 'version') {
        result.warnings.push(`${k}: 알 수 없는 네임스페이스`);
      }
    }

    return result;
  }

  // 레거시 단일 소스: ui 키 없이 직접 hud, menu 등이 있는 경우
  const targetUi = (targets.ui ?? targets) as Record<string, unknown>;
  return applyLayoutOverride(targetUi, patch);
}

/**
 * [DEVUI-008] patch 를 임시 복사본에 적용하여 다중 타겟 검증 결과만 반환한다.
 * 원본 targets 는 변경되지 않는다.
 */
export function validateMultiLayoutPatch(
  targets: MultiLayoutTargets,
  patch: unknown,
): LayoutOverrideResult {
  const cloneTargets: MultiLayoutTargets = {};
  if (targets.ui) cloneTargets.ui = JSON.parse(JSON.stringify(targets.ui));
  if (targets.assault) cloneTargets.assault = JSON.parse(JSON.stringify(targets.assault));
  return applyMultiLayoutOverride(cloneTargets, patch);
}

/**
 * [LAYOUT-010] patch 를 임시 복사본에 적용하여 검증 결과(warnings, applied)만 반환한다.
 * 원본 target 은 변경되지 않는다.
 */
export function validateLayoutPatch(target: object, patch: unknown): LayoutOverrideResult {
  const clone = JSON.parse(JSON.stringify(target));
  return applyLayoutOverride(clone, patch);
}

/**
 * 부팅 시 1회: /layouts/ui-layout.json 을 읽어 UI_LAYOUT 에 적용한다.
 * 파일이 없거나 실패하면 기본값 그대로 두고 예외를 던지지 않는다.
 */
export async function loadUiLayoutOverride(
  fetchFn: typeof fetch | undefined,
  url: string = UI_LAYOUT_OVERRIDE_URL,
): Promise<LayoutOverrideLoadResult> {
  const empty = (status: LayoutOverrideLoadStatus): LayoutOverrideLoadResult => ({
    status,
    applied: [],
    warnings: [],
  });
  if (typeof fetchFn !== 'function') return empty('missing');

  let text: string;
  try {
    const res = await fetchFn(url, { cache: 'no-store' });
    if (!res.ok) return empty('missing');
    const contentType = res.headers?.get?.('content-type') ?? '';
    text = await res.text();
    if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      return empty('missing');
    }
  } catch (err) {
    console.warn('[DG] ui-layout.json 로드 실패, 기본 레이아웃 사용:', err);
    return empty('failed');
  }

  let patch: unknown;
  try {
    patch = JSON.parse(text);
  } catch (err) {
    console.warn('[DG] ui-layout.json JSON 파싱 실패, 전체 무시:', err);
    return empty('invalid');
  }

  const result = applyLayoutOverride(UI_LAYOUT, patch);
  if (result.applied.length === 0 && result.warnings.length > 0 && !isPlainObject(patch)) {
    console.warn('[DG] ui-layout.json 형식 오류, 전체 무시:', result.warnings);
    return { status: 'invalid', ...result };
  }
  console.info(
    `[DG] ui-layout.json 적용: ${result.applied.length}개 적용, ${result.warnings.length}개 무시`,
  );
  if (result.warnings.length > 0) {
    console.warn('[DG] ui-layout.json 무시된 항목:', result.warnings);
  }
  return { status: 'applied', ...result };
}
