/**
 * Rational - 불변(immutable) 정확 분수 연산 유틸
 *
 * [ASSAULT-CHALLENGE-CH-02] (Issue #647)
 * - 정수 분자/분모, 기약분수 자동 약분(gcd), 부호는 분자로 정규화
 * - 분모 0 / NaN / Infinity / 비정수 / 안전 정수 범위 초과 입력 거부(throw)
 * - add/sub/mul/div/compare/equals, fromDecimalString, toDecimalString, toFractionLabel
 * - 인스턴스는 공용 deepFreeze(SSOT)로 동결
 * - 부동소수점 오차 없이 소수/분수 비교·연산 (예: 0.1 + 0.2 == 0.3)
 */

import { deepFreeze } from './deepFreeze';

const DECIMAL_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Rational: ${label} must be a safe integer (got ${String(value)})`);
  }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export class Rational {
  readonly numerator: number;
  readonly denominator: number;

  private constructor(numerator: number, denominator: number) {
    assertSafeInteger(numerator, 'numerator');
    assertSafeInteger(denominator, 'denominator');
    if (denominator === 0) {
      throw new RangeError('Rational: denominator must not be 0');
    }
    if (numerator === 0) {
      this.numerator = 0;
      this.denominator = 1;
    } else {
      const g = gcd(numerator, denominator);
      const sign = denominator < 0 ? -1 : 1;
      this.numerator = (sign * numerator) / g;
      this.denominator = Math.abs(denominator) / g;
    }
    deepFreeze(this);
  }

  /** 정수 분자/분모로 Rational 생성 (분모 기본값 1) */
  static of(numerator: number, denominator = 1): Rational {
    return new Rational(numerator, denominator);
  }

  /** "0.45", "-1.5", "3" 같은 10진 문자열을 정확한 Rational로 변환 */
  static fromDecimalString(str: string): Rational {
    const match = DECIMAL_PATTERN.exec(String(str).trim());
    if (!match) {
      throw new SyntaxError(`Rational: invalid decimal string "${str}"`);
    }
    const [, signChar, intPart, fracPart = ''] = match;
    const digits = Number(intPart + fracPart);
    const denominator = 10 ** fracPart.length;
    const numerator = signChar === '-' ? -digits : digits;
    return new Rational(numerator, denominator);
  }

  add(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  sub(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  mul(other: Rational): Rational {
    return new Rational(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  div(other: Rational): Rational {
    if (other.numerator === 0) {
      throw new RangeError('Rational: division by zero');
    }
    return new Rational(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  /** this < other → -1, this == other → 0, this > other → 1 */
  compare(other: Rational): -1 | 0 | 1 {
    const left = BigInt(this.numerator) * BigInt(other.denominator);
    const right = BigInt(other.numerator) * BigInt(this.denominator);
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  equals(other: Rational): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  /** 소수 문자열 (maxPlaces 자리에서 0에서 먼 쪽으로 반올림, 후행 0 제거) */
  toDecimalString(maxPlaces: number): string {
    if (!Number.isSafeInteger(maxPlaces) || maxPlaces < 0) {
      throw new RangeError(`Rational: maxPlaces must be a non-negative integer (got ${String(maxPlaces)})`);
    }
    const den = BigInt(this.denominator);
    const absNum = BigInt(Math.abs(this.numerator));
    const scaled = absNum * 10n ** BigInt(maxPlaces);
    let q = scaled / den;
    if ((scaled % den) * 2n >= den) {
      q += 1n;
    }
    if (q === 0n) return '0';

    const digits = q.toString().padStart(maxPlaces + 1, '0');
    const intPart = digits.slice(0, digits.length - maxPlaces);
    const fracPart = digits.slice(digits.length - maxPlaces).replace(/0+$/, '');
    const sign = this.numerator < 0 ? '-' : '';
    return fracPart.length > 0 ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
  }

  /** "3/8" 형태 라벨, 정수는 "2" */
  toFractionLabel(): string {
    return this.denominator === 1 ? String(this.numerator) : `${this.numerator}/${this.denominator}`;
  }
}
