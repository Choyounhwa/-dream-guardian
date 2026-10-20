/**
 * ContentCanonical.ts - 순수 결정적 정규화 JSON 직렬화 및 SHA-256 해시
 *
 * Issue #377 / EDITOR-COMPILE:
 * - 객체 키 재귀 정렬 (UTF-16 코드 유닛 오름차순)
 * - 결정적 숫자 정규화 (-0 -> 0, NaN/Infinity 차단)
 * - 의미 있는 배열 순서 보존
 * - 순수 TypeScript 동기 SHA-256 다이제스트
 * - 입력 객체 변형(mutation) 0회 보장
 */

import { sha256Hex } from '../utils/crypto.js';

export { sha256Hex };

const MAX_SERIALIZE_DEPTH = 100;

function walk(value: unknown, depth: number): string | undefined {
  if (depth > MAX_SERIALIZE_DEPTH) {
    throw new RangeError(`Exceeded maximum canonicalization depth of ${MAX_SERIALIZE_DEPTH}`);
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot canonicalize non-finite number: ${value}`);
    }
    // Normalize -0 to 0
    const normalized = Object.is(value, -0) ? 0 : value;
    return JSON.stringify(normalized);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      const res = walk(item, depth + 1);
      parts.push(res === undefined ? 'null' : res);
    }
    return `[${parts.join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const key of keys) {
      const serializedVal = walk(record[key], depth + 1);
      if (serializedVal !== undefined) {
        parts.push(`${JSON.stringify(key)}:${serializedVal}`);
      }
    }
    return `{${parts.join(',')}}`;
  }

  throw new TypeError(`Unsupported value type for canonicalization: ${typeof value}`);
}

/**
 * 임의의 JavaScript 객체를 순수 정규화 JSON 문자열로 변환합니다.
 */
export function canonicalizeContentJson(value: unknown): string {
  const result = walk(value, 0);
  return result === undefined ? 'undefined' : result;
}

/**
 * 정규화된 JSON 직렬화 후 SHA-256 다이제스트를 반환합니다.
 */
export function computeContentHash(value: unknown): string {
  return sha256Hex(canonicalizeContentJson(value));
}
