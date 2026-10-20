import { describe, it, expect } from 'vitest';
import { deepFreeze } from '../../src/utils/deepFreeze.js';

describe('deepFreeze [REFACTOR-DRY-001 / #628]', () => {
  it('null 및 undefined를 안전하게 반환해야 한다', () => {
    expect(deepFreeze(null)).toBeNull();
    expect(deepFreeze(undefined)).toBeUndefined();
  });

  it('기본 원시 타입(숫자, 문자열, 불리언)을 그대로 반환해야 한다', () => {
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze('hello')).toBe('hello');
    expect(deepFreeze(true)).toBe(true);
  });

  it('단일 계층 객체를 동결해야 한다', () => {
    const obj = { a: 1, b: 'test' };
    const frozen = deepFreeze(obj);

    expect(frozen).toBe(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => {
      // @ts-expect-error mutating frozen object
      frozen.a = 2;
    }).toThrow();
  });

  it('중첩된 객체를 재귀적으로 깊은 동결해야 한다', () => {
    const obj = {
      level1: {
        level2: {
          value: 100,
        },
      },
    };

    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.level1)).toBe(true);
    expect(Object.isFrozen(frozen.level1.level2)).toBe(true);
    expect(() => {
      (frozen as any).level1.level2.value = 200;
    }).toThrow();
  });

  it('배열 및 배열 내부 객체도 재귀적으로 동결해야 한다', () => {
    const arr = [{ id: 1 }, { id: 2 }];
    const frozen = deepFreeze(arr);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen[0])).toBe(true);
    expect(Object.isFrozen(frozen[1])).toBe(true);
    expect(() => {
      // @ts-expect-error mutating array
      frozen.push({ id: 3 });
    }).toThrow();
  });

  it('이미 동결된 객체는 중복 동결 시 안전하게 건너뛰어야 한다', () => {
    const obj = Object.freeze({ a: 1 });
    const frozen = deepFreeze(obj);
    expect(frozen).toBe(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('함수 프로퍼티가 포함된 객체도 안전하게 처리해야 한다', () => {
    const obj = {
      fn: () => 'result',
      meta: { count: 5 },
    };
    const frozen = deepFreeze(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.meta)).toBe(true);
    expect(frozen.fn()).toBe('result');
  });

  it('순환 참조가 있는 객체에서도 무한 재귀 에러(Stack Overflow) 없이 안전하게 동결해야 한다', () => {
    type Cyclic = { name: string; self?: Cyclic };
    const cyclicObj: Cyclic = { name: 'cyclic' };
    cyclicObj.self = cyclicObj;

    const frozen = deepFreeze(cyclicObj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.self).toBe(frozen);
  });
});
