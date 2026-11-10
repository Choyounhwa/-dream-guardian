import { describe, expect, it } from 'vitest';
import {
  sha256Bytes,
  sha256BytesHex,
  sha256Hex,
} from '../../src/utils/crypto.js';

describe('Crypto Utility (REFACTOR-DRY-002 / #629)', () => {
  describe('Standard Test Vectors', () => {
    it('computes hash for empty string ("")', () => {
      const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(sha256Hex('')).toBe(expected);
      expect(sha256BytesHex(new Uint8Array(0))).toBe(expected);
    });

    it('computes hash for standard NIST vector "abc"', () => {
      const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      expect(sha256Hex('abc')).toBe(expected);
      const bytes = new TextEncoder().encode('abc');
      expect(sha256BytesHex(bytes)).toBe(expected);
    });

    it('computes hash for 448-bit edge vector ("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")', () => {
      const msg = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
      const expected = '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1';
      expect(sha256Hex(msg)).toBe(expected);
    });

    it('computes hash for "hello world"', () => {
      const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
      expect(sha256Hex('hello world')).toBe(expected);
    });
  });

  describe('sha256Bytes raw byte array return', () => {
    it('returns a 32-byte Uint8Array whose bytes match hex representation', () => {
      const bytes = new TextEncoder().encode('abc');
      const raw = sha256Bytes(bytes);

      expect(raw).toBeInstanceOf(Uint8Array);
      expect(raw.length).toBe(32);

      const hex = Array.from(raw)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      expect(hex).toBe(sha256BytesHex(bytes));
    });
  });

  describe('UTF-8 Multibyte Strings and Binary Payloads', () => {
    it('computes consistent hash for Korean multibyte characters', () => {
      const koreanText = '몽계의 꼬마 수호신 드림 가디언';
      const hex = sha256Hex(koreanText);
      const encoded = new TextEncoder().encode(koreanText);
      expect(hex).toBe(sha256BytesHex(encoded));
      expect(hex).toHaveLength(64);
    });

    it('handles arbitrary binary data including 0x00 and 0xFF', () => {
      const binary = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0x12, 0x34, 0x56, 0x78]);
      const hex = sha256BytesHex(binary);
      const raw = sha256Bytes(binary);

      expect(hex).toHaveLength(64);
      expect(raw.length).toBe(32);
    });

    it('handles chunk boundary inputs (55, 56, 64, 65 bytes)', () => {
      for (const size of [55, 56, 64, 65, 119, 120, 128]) {
        const payload = new Uint8Array(size).fill(0x61); // 'a' repeated
        const hex = sha256BytesHex(payload);
        const raw = sha256Bytes(payload);
        expect(hex).toHaveLength(64);
        expect(raw.length).toBe(32);
      }
    });
  });
});
