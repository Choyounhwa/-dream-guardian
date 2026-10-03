import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/editor/ui/data/UIContracts";
import {
  CANONICAL_KEY_ORDER,
  CANONICAL_RULE_ID,
  HASH_IS_SIGNATURE,
  ROUNDTRIP_VECTORS,
  artifactHash,
  canonicalize,
  contentHash,
  rejectDuplicateKeys,
  sha256Hex,
  sourceCheckpointHash,
} from "../../src/editor/ui/data/UICanonicalJSON";

describe("UIX-004 canonical JSON and SHA-256", () => {
  it("exports a non-empty rule id, utf16 key order, and hash-is-not-signature", () => {
    expect(CANONICAL_RULE_ID.length).toBeGreaterThan(0);
    expect(CANONICAL_KEY_ORDER).toBe("utf16-code-unit-asc");
    expect(HASH_IS_SIGNATURE).toBe(false);
    expect(LIMITS.maxBytes).toBe(1048576);
    expect(LIMITS.maxDepth).toBe(16);
  });

  it("gives the same UTF-8 SHA-256 to objects that differ only by key order", () => {
    const left = contentHash({ b: 1, a: { z: 2, y: 3 } });
    const right = contentHash({ a: { y: 3, z: 2 }, b: 1 });
    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalize({ b: 1, a: 2 })).toEqual({ ok: true, json: '{"a":2,"b":1}' });
  });

  it("changes the hash when array order changes", () => {
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
    expect(canonicalize([1, 2])).toEqual({ ok: true, json: "[1,2]" });
  });

  it("canonicalizes -0 to 0 and 1e2 to 100", () => {
    expect(canonicalize(-0)).toEqual({ ok: true, json: "0" });
    expect(canonicalize({ n: -0 })).toEqual({ ok: true, json: '{"n":0}' });
    expect(canonicalize(1e2)).toEqual({ ok: true, json: "100" });
    expect(canonicalize(1.0)).toEqual({ ok: true, json: "1" });
  });

  it("keeps non-ascii strings stable after parse", () => {
    const parsed = JSON.parse('"\\u00e9"') as string;
    expect(canonicalize(parsed)).toEqual({ ok: true, json: '"é"' });
    expect(canonicalize("é")).toEqual(canonicalize(parsed));
    expect(contentHash("é")).toBe(contentHash(parsed));
  });

  it("rejects non-finite numbers", () => {
    expect(canonicalize(Number.NaN).ok).toBe(false);
    expect(canonicalize(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(canonicalize(Number.NEGATIVE_INFINITY).ok).toBe(false);
    expect(canonicalize({ n: Number.NaN }).ok).toBe(false);
  });

  it("rejects duplicate keys in raw JSON text", () => {
    const rejected = rejectDuplicateKeys('{"a":1,"a":2}');
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toBeTruthy();
    expect(rejectDuplicateKeys('{"a":1,"b":{"a":2}}').ok).toBe(true);
    expect(rejectDuplicateKeys('{"a":1,"b":{"c":1,"c":2}}').ok).toBe(false);
  });

  it("rejects payloads over maxBytes and nesting over maxDepth", () => {
    const oversized = "x".repeat(LIMITS.maxBytes);
    expect(canonicalize(oversized).ok).toBe(false);
    let deep: unknown = 1;
    for (let i = 0; i < LIMITS.maxDepth + 1; i += 1) deep = { n: deep };
    expect(canonicalize(deep).ok).toBe(false);
    let allowed: unknown = 1;
    for (let i = 0; i < LIMITS.maxDepth; i += 1) allowed = { n: allowed };
    expect(canonicalize(allowed).ok).toBe(true);
  });

  it("preserves meaning when canonical JSON is parsed again", () => {
    const menu = {
      cards: [
        { id: "card-play", y: 120, x: 40 },
        { id: "card-story", y: 120, x: 50 },
      ],
      height: 360,
      width: 280,
    };
    const result = canonicalize(menu);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.json)).toEqual({
      cards: [
        { id: "card-play", x: 40, y: 120 },
        { id: "card-story", x: 50, y: 120 },
      ],
      height: 360,
      width: 280,
    });
    expect(canonicalize(JSON.parse(result.json))).toEqual(result);
  });

  it("hashes content, envelope without integrity, and the whole project", () => {
    const content = { b: 2, a: 1 };
    const envelope = { content, integrity: { hash: "dead" }, kind: "dream-guardian-ui-transfer" };
    const without = artifactHash(envelope);
    const stripped = artifactHash({ content, kind: "dream-guardian-ui-transfer" });
    expect(without).toBe(stripped);
    expect(without).not.toBe(contentHash(content));
    const project = { kind: "dream-guardian-ui-project", menu: { z: 1, a: 2 } };
    expect(sourceCheckpointHash(project)).toBe(contentHash(project));
    expect(sha256Hex("a")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fixes named roundtrip vectors", () => {
    const byName = Object.fromEntries(ROUNDTRIP_VECTORS.map((vector) => [vector.name, vector]));
    expect(byName["key-order"]?.json).toBe('{"a":1,"b":2}');
    expect(byName["negative-zero"]?.json).toBe("0");
    expect(byName.unicode?.json).toBe('"é"');
    expect(byName["number-format"]?.json).toBe("100");
    expect(byName["array-order"]?.json).toBe("[1,2]");
    for (const vector of ROUNDTRIP_VECTORS) {
      expect(vector.name.length).toBeGreaterThan(0);
      expect(vector.ruleId).toBe(CANONICAL_RULE_ID);
      expect(canonicalize(vector.input)).toEqual({ ok: true, json: vector.json });
    }
  });
});
