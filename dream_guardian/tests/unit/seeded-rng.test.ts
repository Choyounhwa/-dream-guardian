/**
 * [ASSAULT-CHALLENGE-CH-01a / #645] 시드 RNG(Mulberry32) 공통 유틸 검증
 *
 * - 동일 시드 → 동일 시퀀스
 * - 값 범위 [0, 1)
 * - AssaultAnswerPairFactory 내부 createMulberry32 알고리즘
 *   (Math.trunc(seed) >>> 0 정규화)과 3개 고정 시드에서 동일 시퀀스
 * - 비정수 시드 거부
 * - nextInt / pickOne 순수 헬퍼
 */
import { describe, it, expect } from 'vitest';
import { createSeededRng, nextInt, pickOne } from '../../src/utils/seededRng';

/**
 * 기존 AssaultAnswerPairFactory.createMulberry32 알고리즘으로 산출한 기대 시퀀스(첫 5개).
 * (src/question/AssaultAnswerPairFactory.ts:70-78 알고리즘을 그대로 실행해 얻은 고정값)
 */
const FACTORY_EXPECTED: ReadonlyArray<{ seed: number; values: number[] }> = [
  {
    seed: 1,
    values: [
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
      0.9683778982143849,
    ],
  },
  {
    seed: 42,
    values: [
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
      0.17481389874592423,
    ],
  },
  {
    seed: 123456789,
    values: [
      0.2577907438389957, 0.9707721115555614, 0.7853280142880976, 0.20616457983851433,
      0.30307188746519387,
    ],
  },
];

describe('[#645] createSeededRng (Mulberry32)', () => {
  it('동일 시드는 동일 시퀀스를 생성한다', () => {
    const a = createSeededRng(2024);
    const b = createSeededRng(2024);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('다른 시드는 다른 시퀀스를 생성한다', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a()).not.toBe(b());
  });

  it('모든 값은 [0, 1) 범위에 있다', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it.each(FACTORY_EXPECTED)(
    'AssaultAnswerPairFactory 기존 구현과 동일 시퀀스 (seed=$seed)',
    ({ seed, values }) => {
      const rng = createSeededRng(seed);
      for (const expected of values) {
        expect(rng()).toBe(expected);
      }
    },
  );

  it('음수 정수 시드는 >>> 0 정규화로 기존 구현과 동일하게 처리된다', () => {
    const rng = createSeededRng(-7);
    expect(rng()).toBe(0.43306733411736786);
    expect(rng()).toBe(0.32539576734416187);
  });

  it.each([1.5, NaN, Infinity, -Infinity])('비정수 시드(%s)는 예외를 던진다', (seed) => {
    expect(() => createSeededRng(seed)).toThrow();
  });
});

describe('[#645] nextInt', () => {
  it('[min, max] 포함 범위 정수를 반환한다', () => {
    const rng = createSeededRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = nextInt(rng, 3, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('min === max 이면 해당 값을 반환한다', () => {
    expect(nextInt(createSeededRng(1), 5, 5)).toBe(5);
  });

  it('rng 값으로 결정론적으로 계산된다 (rng=0.6270... → floor(0.627*10)=6)', () => {
    expect(nextInt(createSeededRng(1), 0, 9)).toBe(6);
  });

  it('잘못된 범위(min > max, 비정수)는 예외를 던진다', () => {
    const rng = createSeededRng(1);
    expect(() => nextInt(rng, 5, 1)).toThrow();
    expect(() => nextInt(rng, 0.5, 3)).toThrow();
    expect(() => nextInt(rng, 0, 3.2)).toThrow();
  });
});

describe('[#645] pickOne', () => {
  it('동일 시드는 동일 원소를 선택한다', () => {
    const list = ['a', 'b', 'c', 'd', 'e'] as const;
    const a = createSeededRng(11);
    const b = createSeededRng(11);
    for (let i = 0; i < 20; i++) {
      expect(pickOne(a, list)).toBe(pickOne(b, list));
    }
  });

  it('항상 리스트의 원소를 반환한다', () => {
    const list = [10, 20, 30];
    const rng = createSeededRng(5);
    for (let i = 0; i < 100; i++) {
      expect(list).toContain(pickOne(rng, list));
    }
  });

  it('rng 값으로 결정론적 인덱스를 선택한다 (seed=1 → idx floor(0.627*4)=2)', () => {
    expect(pickOne(createSeededRng(1), ['w', 'x', 'y', 'z'])).toBe('y');
  });

  it('빈 리스트는 예외를 던진다', () => {
    expect(() => pickOne(createSeededRng(1), [])).toThrow();
  });

  it('입력 리스트를 변경하지 않는다', () => {
    const list = Object.freeze([1, 2, 3]);
    expect(() => pickOne(createSeededRng(3), list)).not.toThrow();
    expect(list).toEqual([1, 2, 3]);
  });
});
