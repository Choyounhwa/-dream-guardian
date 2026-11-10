/**
 * [ASSAULT-CHALLENGE-CH-02] (Issue #647) Rational 정확 분수 연산 유틸 테스트
 */
import { describe, it, expect } from 'vitest';
import { Rational } from '../../src/utils/Rational';

describe('[#647] Rational 정확 분수 연산 유틸', () => {
  describe('생성 및 정규화', () => {
    it('기약분수로 자동 약분한다', () => {
      const r = Rational.of(2, 4);
      expect(r.numerator).toBe(1);
      expect(r.denominator).toBe(2);
    });

    it('부호를 분자로 정규화한다', () => {
      const a = Rational.of(1, -2);
      expect(a.numerator).toBe(-1);
      expect(a.denominator).toBe(2);
      const b = Rational.of(-3, -6);
      expect(b.numerator).toBe(1);
      expect(b.denominator).toBe(2);
    });

    it('0은 0/1로 정규화한다', () => {
      const z = Rational.of(0, -5);
      expect(z.numerator).toBe(0);
      expect(z.denominator).toBe(1);
      expect(Object.is(z.numerator, -0)).toBe(false);
    });

    it('분모 기본값은 1이다', () => {
      const r = Rational.of(3);
      expect(r.numerator).toBe(3);
      expect(r.denominator).toBe(1);
    });

    it('분모 0을 거부한다', () => {
      expect(() => Rational.of(1, 0)).toThrow();
    });

    it('NaN/Infinity를 거부한다', () => {
      expect(() => Rational.of(NaN, 1)).toThrow();
      expect(() => Rational.of(1, NaN)).toThrow();
      expect(() => Rational.of(Infinity, 1)).toThrow();
    });

    it('정수가 아닌 입력을 거부한다', () => {
      expect(() => Rational.of(1.5, 2)).toThrow();
      expect(() => Rational.of(1, 2.5)).toThrow();
    });
  });

  describe('불변성', () => {
    it('인스턴스는 동결(frozen)되어 있다', () => {
      const r = Rational.of(1, 2);
      expect(Object.isFrozen(r)).toBe(true);
      expect(() => {
        (r as unknown as { numerator: number }).numerator = 5;
      }).toThrow();
      expect(r.numerator).toBe(1);
    });

    it('연산은 새 인스턴스를 반환하고 원본을 변경하지 않는다', () => {
      const a = Rational.of(1, 2);
      const b = Rational.of(1, 3);
      const c = a.add(b);
      expect(c).not.toBe(a);
      expect(a.equals(Rational.of(1, 2))).toBe(true);
      expect(b.equals(Rational.of(1, 3))).toBe(true);
    });
  });

  describe('사칙연산', () => {
    it('add', () => {
      expect(Rational.of(1, 2).add(Rational.of(1, 3)).equals(Rational.of(5, 6))).toBe(true);
    });
    it('sub', () => {
      expect(Rational.of(1, 2).sub(Rational.of(3, 4)).equals(Rational.of(-1, 4))).toBe(true);
    });
    it('mul', () => {
      expect(Rational.of(2, 3).mul(Rational.of(3, 4)).equals(Rational.of(1, 2))).toBe(true);
    });
    it('div', () => {
      expect(Rational.of(1, 2).div(Rational.of(1, 4)).equals(Rational.of(2))).toBe(true);
    });
    it('0으로 나누기를 거부한다', () => {
      expect(() => Rational.of(1, 2).div(Rational.of(0))).toThrow();
    });
    it('0.1 + 0.2 == 0.3 (정확 연산)', () => {
      const s = Rational.fromDecimalString('0.1').add(Rational.fromDecimalString('0.2'));
      expect(s.equals(Rational.fromDecimalString('0.3'))).toBe(true);
    });
  });

  describe('비교', () => {
    it('1/2 == 2/4 == fromDecimalString("0.5")', () => {
      const a = Rational.of(1, 2);
      const b = Rational.of(2, 4);
      const c = Rational.fromDecimalString('0.5');
      expect(a.equals(b)).toBe(true);
      expect(b.equals(c)).toBe(true);
      expect(a.compare(c)).toBe(0);
    });

    it('0.45 < 0.5', () => {
      const a = Rational.fromDecimalString('0.45');
      const b = Rational.fromDecimalString('0.5');
      expect(a.compare(b)).toBe(-1);
      expect(b.compare(a)).toBe(1);
    });

    it('3/8 < 3/4', () => {
      expect(Rational.of(3, 8).compare(Rational.of(3, 4))).toBe(-1);
    });

    it('음수 비교', () => {
      expect(Rational.of(-1, 2).compare(Rational.of(1, 3))).toBe(-1);
      expect(Rational.of(-1, 2).equals(Rational.of(1, 2))).toBe(false);
    });
  });

  describe('fromDecimalString', () => {
    it('"0.45" → 9/20', () => {
      const r = Rational.fromDecimalString('0.45');
      expect(r.numerator).toBe(9);
      expect(r.denominator).toBe(20);
    });
    it('"-1.5" → -3/2', () => {
      const r = Rational.fromDecimalString('-1.5');
      expect(r.numerator).toBe(-3);
      expect(r.denominator).toBe(2);
    });
    it('"3" → 3/1', () => {
      const r = Rational.fromDecimalString('3');
      expect(r.numerator).toBe(3);
      expect(r.denominator).toBe(1);
    });
    it('공백을 허용하고 "+" 부호를 지원한다', () => {
      expect(Rational.fromDecimalString(' +2.25 ').equals(Rational.of(9, 4))).toBe(true);
    });
    it('잘못된 문자열을 거부한다', () => {
      for (const bad of ['', 'abc', '1.2.3', '.', '-', '1e3', 'NaN', '1/2', '0x10']) {
        expect(() => Rational.fromDecimalString(bad)).toThrow();
      }
    });
  });

  describe('toDecimalString', () => {
    it('유한소수를 정확히 표시한다', () => {
      expect(Rational.of(9, 20).toDecimalString(4)).toBe('0.45');
      expect(Rational.of(-3, 2).toDecimalString(4)).toBe('-1.5');
      expect(Rational.of(3).toDecimalString(4)).toBe('3');
    });
    it('maxPlaces에서 반올림(half away from zero)한다', () => {
      expect(Rational.of(1, 3).toDecimalString(3)).toBe('0.333');
      expect(Rational.of(2, 3).toDecimalString(2)).toBe('0.67');
      expect(Rational.of(-2, 3).toDecimalString(2)).toBe('-0.67');
      expect(Rational.of(1, 8).toDecimalString(2)).toBe('0.13');
    });
    it('maxPlaces 0은 정수로 반올림한다', () => {
      expect(Rational.of(5, 2).toDecimalString(0)).toBe('3');
    });
    it('반올림 결과가 0이면 "-0"이 아닌 "0"', () => {
      expect(Rational.of(-1, 1000).toDecimalString(2)).toBe('0');
    });
    it('잘못된 maxPlaces를 거부한다', () => {
      expect(() => Rational.of(1, 2).toDecimalString(-1)).toThrow();
      expect(() => Rational.of(1, 2).toDecimalString(1.5)).toThrow();
    });
  });

  describe('toFractionLabel', () => {
    it('"3/8" 형태로 표시한다', () => {
      expect(Rational.of(6, 16).toFractionLabel()).toBe('3/8');
    });
    it('정수는 분모 없이 표시한다', () => {
      expect(Rational.of(4, 2).toFractionLabel()).toBe('2');
      expect(Rational.of(0).toFractionLabel()).toBe('0');
    });
    it('음수는 분자에 부호를 붙인다', () => {
      expect(Rational.of(3, -8).toFractionLabel()).toBe('-3/8');
    });
  });
});
