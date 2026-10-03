import { describe, expect, it } from "vitest";
import { MENU_CARD_IDS, SCHEMA_VERSION } from "../../src/editor/ui/data/UIContracts";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  BASELINE_VERSION,
  LIMITS,
  RENDERER_FINGERPRINT,
  acceptBaselineRecord,
  canFormallyExport,
  clonePresetForEdit,
  inspectBaseline,
  matchBaseline,
} from "../../src/editor/ui/data/UIBaselines";

describe("UIX-002 frozen preset immutability", () => {
  it("does not change the frozen preset when the edit clone is mutated", () => {
    const original = BASELINE_REGISTRY.preset;
    expect(Object.isFrozen(original)).toBe(true);
    expect(original.design).toEqual({ width: 1080, height: 2160 });
    expect(original.cards.map((card) => card.id)).toEqual([...MENU_CARD_IDS]);
    expect(original.cards).toHaveLength(5);
    expect(original.width).toBe(original.height);
    expect(original.workoutButton).toEqual({ x: 100, y: 1800, width: 400, height: 120 });

    const clone = clonePresetForEdit("menu-v1");
    const before = JSON.parse(JSON.stringify(original));
    clone.cards[0].x = 9999;
    clone.width = 1;
    clone.workoutButton.x = 7;
    expect(original).toEqual(before);
    expect(original.cards[0].x).not.toBe(9999);
  });
});

describe("UIX-002 version hash image renderer match", () => {
  it("passes only when version, preset hash, image hash, and renderer fingerprint all match", () => {
    expect(BASELINE_VERSION).toBe(SCHEMA_VERSION);
    const presetHash = contentHash(BASELINE_REGISTRY.preset);
    expect(BASELINE_REGISTRY.presetHash).toBe(presetHash);
    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
    expect(BASELINE_REGISTRY.approvedImageHash).toBe(APPROVED_IMAGE_HASH);
    expect(BASELINE_REGISTRY.rendererFingerprint).toBe(RENDERER_FINGERPRINT);

    const ok = matchBaseline({
      version: BASELINE_VERSION,
      presetHash,
      imageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    });
    expect(ok).toEqual({ ok: true });

    expect(
      matchBaseline({
        version: "9.9.9",
        presetHash,
        imageHash: APPROVED_IMAGE_HASH,
        rendererFingerprint: RENDERER_FINGERPRINT,
      }).ok,
    ).toBe(false);
    expect(
      matchBaseline({
        version: BASELINE_VERSION,
        presetHash: "0".repeat(64),
        imageHash: APPROVED_IMAGE_HASH,
        rendererFingerprint: RENDERER_FINGERPRINT,
      }).ok,
    ).toBe(false);
    expect(
      matchBaseline({
        version: BASELINE_VERSION,
        presetHash,
        imageHash: "f".repeat(64),
        rendererFingerprint: RENDERER_FINGERPRINT,
      }).ok,
    ).toBe(false);
    expect(
      matchBaseline({
        version: BASELINE_VERSION,
        presetHash,
        imageHash: APPROVED_IMAGE_HASH,
        rendererFingerprint: "other",
      }).ok,
    ).toBe(false);
  });
});

describe("UIX-002 unknown or damaged baselines", () => {
  it("keeps unknown id and damaged hash as preserve-readonly and blocks formal export", () => {
    const official = inspectBaseline({
      id: "menu-v1",
      version: BASELINE_VERSION,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    });
    expect(official).toEqual({ mode: "official", exportAllowed: true, reason: "official match" });
    expect(canFormallyExport(official)).toBe(true);

    const unknown = inspectBaseline({
      id: "menu-v9",
      version: BASELINE_VERSION,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    });
    expect(unknown.mode).toBe("preserve-readonly");
    expect(unknown.exportAllowed).toBe(false);
    expect(canFormallyExport(unknown)).toBe(false);

    const damaged = inspectBaseline({
      id: "menu-v1",
      version: BASELINE_VERSION,
      presetHash: "dead",
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    });
    expect(damaged.mode).toBe("preserve-readonly");
    expect(damaged.exportAllowed).toBe(false);
    expect(canFormallyExport(damaged)).toBe(false);
  });

  it("rejects duplicate keys, oversized, and deep JSON before treating raw input as a baseline", () => {
    expect(LIMITS.maxNameLength).toBe(80);
    expect(LIMITS.maxDepth).toBe(16);
    expect(LIMITS.maxBytes).toBe(1048576);
    expect(acceptBaselineRecord('{"id":"menu-v1","id":"x"}').ok).toBe(false);
    expect(acceptBaselineRecord(`{"blob":"${"a".repeat(1_100_000)}"}`).ok).toBe(false);
    let deep = "1";
    for (let i = 0; i < 20; i += 1) deep = `{"n":${deep}}`;
    expect(acceptBaselineRecord(deep).ok).toBe(false);
  });
});
