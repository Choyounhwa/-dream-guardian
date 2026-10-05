import { LIMITS } from "./UIContracts";

export const CANONICAL_RULE_ID = "dg-ui-canonical-json-v1";
export const CANONICAL_KEY_ORDER = "utf16-code-unit-asc";
export const HASH_IS_SIGNATURE = false;

export type CanonicalResult = { ok: true; json: string } | { ok: false; reason: string };

function walk(value: unknown, depth: number): CanonicalResult {
  if (depth > LIMITS.maxDepth) return { ok: false, reason: "max depth exceeded" };
  if (value === null) return { ok: true, json: "null" };
  if (typeof value === "boolean") return { ok: true, json: value ? "true" : "false" };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: "non-finite number" };
    return { ok: true, json: JSON.stringify(value === 0 ? 0 : value) };
  }
  if (typeof value === "string") return { ok: true, json: JSON.stringify(value) };
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      const next = walk(item, depth + 1);
      if (!next.ok) return next;
      parts.push(next.json);
    }
    return { ok: true, json: `[${parts.join(",")}]` };
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const key of keys) {
      const next = walk(record[key], depth + 1);
      if (!next.ok) return next;
      parts.push(`${JSON.stringify(key)}:${next.json}`);
    }
    return { ok: true, json: `{${parts.join(",")}}` };
  }
  return { ok: false, reason: "unsupported value" };
}

export function canonicalize(value: unknown): CanonicalResult {
  const result = walk(value, 0);
  if (!result.ok) return result;
  if (new TextEncoder().encode(result.json).length > LIMITS.maxBytes) {
    return { ok: false, reason: "max bytes exceeded" };
  }
  return result;
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

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return (
    toHex(h0) +
    toHex(h1) +
    toHex(h2) +
    toHex(h3) +
    toHex(h4) +
    toHex(h5) +
    toHex(h6) +
    toHex(h7)
  );
}

function hashOf(value: unknown): string {
  const result = canonicalize(value);
  if (!result.ok) throw new Error(result.reason);
  return sha256Hex(result.json);
}

export function contentHash(content: unknown): string {
  return hashOf(content);
}

export function artifactHash(envelopeWithoutIntegrity: unknown): string {
  if (
    envelopeWithoutIntegrity !== null &&
    typeof envelopeWithoutIntegrity === "object" &&
    !Array.isArray(envelopeWithoutIntegrity)
  ) {
    const copy = { ...(envelopeWithoutIntegrity as Record<string, unknown>) };
    delete copy.integrity;
    return hashOf(copy);
  }
  return hashOf(envelopeWithoutIntegrity);
}

export function sourceCheckpointHash(project: unknown): string {
  return hashOf(project);
}

function skipString(raw: string, start: number): number {
  let i = start + 1;
  while (i < raw.length) {
    if (raw[i] === "\\") {
      i += 2;
      continue;
    }
    if (raw[i] === '"') return i + 1;
    i += 1;
  }
  return raw.length;
}

function scanObject(raw: string, start: number): { ok: boolean; reason?: string; end: number } {
  const seen = new Set<string>();
  let i = start + 1;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t" || ch === ",") {
      i += 1;
      continue;
    }
    if (ch === "}") return { ok: true, end: i + 1 };
    if (ch !== '"') return { ok: false, reason: "invalid json", end: i };
    const keyEnd = skipString(raw, i);
    const key = JSON.parse(raw.slice(i, keyEnd)) as string;
    if (seen.has(key)) return { ok: false, reason: "duplicate key", end: keyEnd };
    seen.add(key);
    i = keyEnd;
    while (i < raw.length && raw[i] !== ":") i += 1;
    i += 1;
    while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t")) i += 1;
    if (raw[i] === "{") {
      const nested = scanObject(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (raw[i] === "[") {
      const nested = scanArray(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (raw[i] === '"') {
      i = skipString(raw, i);
      continue;
    }
    while (i < raw.length && raw[i] !== "," && raw[i] !== "}" && raw[i] !== "]") i += 1;
  }
  return { ok: false, reason: "invalid json", end: raw.length };
}

function scanArray(raw: string, start: number): { ok: boolean; reason?: string; end: number } {
  let i = start + 1;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t" || ch === ",") {
      i += 1;
      continue;
    }
    if (ch === "]") return { ok: true, end: i + 1 };
    if (ch === "{") {
      const nested = scanObject(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (ch === "[") {
      const nested = scanArray(raw, i);
      if (!nested.ok) return nested;
      i = nested.end;
      continue;
    }
    if (ch === '"') {
      i = skipString(raw, i);
      continue;
    }
    while (i < raw.length && raw[i] !== "," && raw[i] !== "]") i += 1;
  }
  return { ok: false, reason: "invalid json", end: raw.length };
}

export function rejectDuplicateKeys(raw: string): { ok: boolean; reason?: string } {
  let i = 0;
  while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t")) i += 1;
  if (raw[i] !== "{") return { ok: true };
  const scanned = scanObject(raw, i);
  return scanned.ok ? { ok: true } : { ok: false, reason: scanned.reason };
}

export const ROUNDTRIP_VECTORS = [
  { name: "key-order", ruleId: CANONICAL_RULE_ID, input: { b: 2, a: 1 }, json: '{"a":1,"b":2}' },
  { name: "negative-zero", ruleId: CANONICAL_RULE_ID, input: -0, json: "0" },
  { name: "unicode", ruleId: CANONICAL_RULE_ID, input: "é", json: '"é"' },
  { name: "number-format", ruleId: CANONICAL_RULE_ID, input: 1e2, json: "100" },
  { name: "array-order", ruleId: CANONICAL_RULE_ID, input: [1, 2], json: "[1,2]" },
] as const;
