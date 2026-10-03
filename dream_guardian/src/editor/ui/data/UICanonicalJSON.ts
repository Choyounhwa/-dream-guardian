import { createHash } from "node:crypto";
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

export function sha256Hex(utf8: string): string {
  return createHash("sha256").update(utf8, "utf8").digest("hex");
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
