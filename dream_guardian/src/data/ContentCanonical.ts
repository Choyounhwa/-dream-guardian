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

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * UTF-8 문자열에 대해 순수 TypeScript 기반 SHA-256 64자리 16진수 해시를 계산합니다.
 */
export function sha256Hex(utf8: string): string {
  const bytes = new TextEncoder().encode(utf8);
  const len = bytes.length;
  const bitLen = len * 8;

  const blockCount = ((len + 9 + 63) >>> 6);
  const buffer = new Uint8Array(blockCount * 64);
  buffer.set(bytes);
  buffer[len] = 0x80;

  const view = new DataView(buffer.buffer);
  const byteOffset = blockCount * 64 - 8;
  view.setUint32(byteOffset, Math.floor(bitLen / 0x100000000) >>> 0, false);
  view.setUint32(byteOffset + 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let b = 0; b < blockCount; b++) {
    const base = b * 64;
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(base + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let bVal = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & bVal) ^ (a & c) ^ (bVal & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = bVal;
      bVal = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + bVal) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hexParts = [h0, h1, h2, h3, h4, h5, h6, h7].map((num) =>
    (num >>> 0).toString(16).padStart(8, '0'),
  );
  return hexParts.join('');
}

/**
 * 정규화된 JSON 직렬화 후 SHA-256 다이제스트를 반환합니다.
 */
export function computeContentHash(value: unknown): string {
  return sha256Hex(canonicalizeContentJson(value));
}
