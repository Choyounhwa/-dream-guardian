/**
 * crypto.ts - 순수 TypeScript 동기식 SHA-256 해시 및 16진수 변환 유틸리티
 *
 * REFACTOR-DRY-002 (#629):
 * - ContentCanonical 및 UIPresentationLoadService의 중복 SHA-256 구현을 단일화
 * - 외부 의존성 없는 순수 TypeScript 동기 구현
 * - 바이트 배열(Uint8Array) 및 UTF-8 문자열 입력 지원
 */

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
 * SHA-256 알고리즘의 8개 32비트 내부 해시 상태(H0~H7)를 계산합니다.
 */
function computeSha256Words(bytes: Uint8Array): Uint32Array {
  const len = bytes.length;
  const bitLen = len * 8;
  const blockCount = ((len + 9 + 63) >>> 6);
  const buffer = new Uint8Array(blockCount * 64);
  buffer.set(bytes);
  buffer[len] = 0x80;

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
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

  const W = new Uint32Array(64);

  for (let b = 0; b < blockCount; b++) {
    const chunkOffset = b * 64;
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(chunkOffset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15];
      const s0 =
        ((w15 >>> 7) | (w15 << 25)) ^
        ((w15 >>> 18) | (w15 << 14)) ^
        (w15 >>> 3);
      const w2 = W[i - 2];
      const s1 =
        ((w2 >>> 17) | (w2 << 15)) ^
        ((w2 >>> 19) | (w2 << 13)) ^
        (w2 >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = h0;
    let bReg = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & bReg) ^ (a & c) ^ (bReg & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = bReg;
      bReg = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + bReg) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return new Uint32Array([h0, h1, h2, h3, h4, h5, h6, h7]);
}

/**
 * Uint8Array 바이트 배열에 대해 SHA-256 해시를 계산하여 32바이트 Uint8Array로 반환합니다.
 */
export function sha256Bytes(bytes: Uint8Array): Uint8Array {
  const words = computeSha256Words(bytes);
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) {
    view.setUint32(i * 4, words[i], false);
  }
  return out;
}

/**
 * Uint8Array 바이트 배열에 대해 SHA-256 64자리 소문자 16진수 문자열을 계산합니다.
 */
export function sha256BytesHex(bytes: Uint8Array): string {
  const words = computeSha256Words(bytes);
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (
    toHex(words[0]) +
    toHex(words[1]) +
    toHex(words[2]) +
    toHex(words[3]) +
    toHex(words[4]) +
    toHex(words[5]) +
    toHex(words[6]) +
    toHex(words[7])
  );
}

const textEncoder = new TextEncoder();

/**
 * UTF-8 문자열에 대해 SHA-256 64자리 소문자 16진수 문자열을 계산합니다.
 */
export function sha256Hex(utf8: string): string {
  return sha256BytesHex(textEncoder.encode(utf8));
}
