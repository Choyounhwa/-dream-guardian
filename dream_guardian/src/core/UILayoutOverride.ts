/**
 * UILayoutOverride - public/ui-layout.json 을 UI_LAYOUT 에 검증 후 깊은 병합(in-place) 적용
 *
 * [DEVUI-002] (Issue #562)
 * - 객체를 교체하지 않고 숫자 값만 제자리에서 갱신한다.
 *   (BOTTOM_BAR_CONFIG, PauseModal.MODAL_VIRTUAL 등이 하위 객체 참조를 보관하기 때문)
 * - 대상에 존재하는 키만, 같은 타입의 유한한 숫자만 허용한다.
 *   가로 계열(x·w 등) 0~1080, 세로 계열(y·h 등) 0~2160, 크기(w·h 등) > 0.
 * - 잘못된 항목은 해당 항목만 무시하고 경고 목록으로 반환한다. JSON 자체가 깨지면 전체 무시.
 * - __proto__·constructor·prototype 키는 거부한다 (프로토타입 오염 방지).
 * - 판정 연동 좌표(zone.config 등)는 UI_LAYOUT 밖에 있으므로 대상이 아니다 (판정 좌표 잠금).
 */

import { UI_LAYOUT } from '../../config/ui.config.js';

export const UI_LAYOUT_OVERRIDE_URL = '/ui-layout.json';

const VIRTUAL_WIDTH = 1080;
const VIRTUAL_HEIGHT = 2160;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const HORIZONTAL_KEYS = new Set(['x', 'w', 'width', 'startX', 'gapX', 'cardWidth', 'marginRight']);
const SIZE_KEYS = new Set(['w', 'h', 'width', 'height', 'cardWidth', 'cardHeight', 'cols']);

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
  const max = HORIZONTAL_KEYS.has(key) ? VIRTUAL_WIDTH : VIRTUAL_HEIGHT;
  if (value < 0 || value > max) return `범위 밖 (0~${max})`;
  if (SIZE_KEYS.has(key) && value <= 0) return '크기는 0보다 커야 함';
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

/**
 * target 의 숫자 값만 patch 로 제자리 갱신한다. 객체·배열 참조는 교체하지 않는다.
 */
export function applyLayoutOverride(target: object, patch: unknown): LayoutOverrideResult {
  const result: LayoutOverrideResult = { applied: [], warnings: [] };
  if (!isPlainObject(patch)) {
    result.warnings.push('(root): 객체가 아님 — 전체 무시');
    return result;
  }
  mergeInto(target as Record<string, unknown>, patch, '', result);
  return result;
}

/**
 * 부팅 시 1회: /ui-layout.json 을 읽어 UI_LAYOUT 에 적용한다.
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
