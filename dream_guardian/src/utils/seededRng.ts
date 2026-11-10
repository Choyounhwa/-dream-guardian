/**
 * [ASSAULT-CHALLENGE-CH-01a / #645] 시드 기반 결정론적 RNG 공통 유틸 (Mulberry32)
 *
 * - AssaultAnswerPairFactory 내부 PRNG와 동일한 알고리즘/시드 정규화(`>>> 0`)를 사용한다.
 * - Math.random / Date.now 등 비결정론적 소스를 사용하지 않는다.
 */

/** [0, 1) 범위 난수를 반환하는 결정론적 RNG 함수 */
export type SeededRng = () => number;

const UINT32_RANGE = 4294967296;

/**
 * Mulberry32 PRNG를 생성한다.
 * @param seed 정수 시드 (음수 포함, `>>> 0`으로 32비트 부호 없는 정수로 정규화)
 * @throws 시드가 유한 정수가 아니면 예외
 */
export function createSeededRng(seed: number): SeededRng {
  if (!Number.isInteger(seed)) {
    throw new Error(`[seededRng] seed must be an integer: ${seed}`);
  }
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/**
 * [min, max] 포함 범위의 정수를 반환한다.
 * @throws min/max가 정수가 아니거나 min > max 이면 예외
 */
export function nextInt(rng: SeededRng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`[seededRng] invalid integer range: [${min}, ${max}]`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * 리스트에서 원소 하나를 결정론적으로 선택한다. (입력 리스트는 변경하지 않음)
 * @throws 빈 리스트이면 예외
 */
export function pickOne<T>(rng: SeededRng, list: readonly T[]): T {
  if (list.length === 0) {
    throw new Error('[seededRng] cannot pick from an empty list');
  }
  return list[nextInt(rng, 0, list.length - 1)];
}
