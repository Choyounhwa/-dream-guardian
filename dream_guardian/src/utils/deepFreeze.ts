/**
 * deepFreeze - 객체 및 중첩 속성을 재귀적으로 완전 동결(Object.freeze)
 *
 * [REFACTOR-DRY-001] (Issue #628)
 * - 11개 소스 파일에 분산되어 있던 deepFreeze 단일 진실 공급원(SSOT)
 * - 원시값, null, undefined에 대한 안전 가드
 * - 순환 참조 및 기동결 객체 스킵 (WeakSet)
 * - Readonly<T> 불변 타입 반환
 */

export function deepFreeze<T>(obj: T, seen: WeakSet<object> = new WeakSet()): Readonly<T> {
  if (obj === null || obj === undefined || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return obj as Readonly<T>;
  }

  const target = obj as unknown as object;

  if (seen.has(target)) {
    return obj as Readonly<T>;
  }
  seen.add(target);

  if (!Object.isFrozen(target)) {
    Object.freeze(target);
  }

  for (const key of Object.getOwnPropertyNames(target)) {
    if (typeof target === 'function' && (key === 'caller' || key === 'callee' || key === 'arguments')) {
      continue;
    }
    try {
      const val = (target as Record<string, unknown>)[key];
      if (val !== null && val !== undefined && (typeof val === 'object' || typeof val === 'function')) {
        deepFreeze(val, seen);
      }
    } catch {
      // Getter 에러 방지
    }
  }

  return obj as Readonly<T>;
}
