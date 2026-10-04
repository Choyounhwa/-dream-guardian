import { describe, expect, it } from "vitest";
import {
  APPROVED_RESOURCES,
  RESOURCE_BINARY_GUARANTEED,
  lookupApprovedResource,
} from "../../src/editor/ui/data/UIResourceCatalog";
import { lookupAssetContract } from "../../src/editor/ui/data/UIProperties";
import {
  ASSET_JSON_LIMITS,
  ASSET_STYLE_ID,
  ASSET_STYLE_VERSION,
  ASSET_SLOT_POLICY,
  REQUIRED_ASSET_REQUIREMENTS,
  selectApprovedAsset,
} from "../../src/editor/ui/data/styles/UIAssetContract";

const FONT = APPROVED_RESOURCES.find((item) => item.id === "font-ui-body");
const IMAGE = APPROVED_RESOURCES.find((item) => item.id === "image-ui-panel");

describe("UIX-038 approved asset selection contract", () => {
  it("registers approved catalog ids with path, kind, dimensions, hash, and slot consumers", () => {
    expect(FONT).toBeDefined();
    expect(IMAGE).toBeDefined();
    expect(ASSET_STYLE_ID).toBe("asset");
    expect(ASSET_STYLE_VERSION).toBe("1.0.0");
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);
    expect(lookupAssetContract()?.editEnabled).toBe(false);
    expect(lookupAssetContract()?.exportEnabled).toBe(false);

    const font = selectApprovedAsset("fontBody", "font-ui-body");
    const image = selectApprovedAsset("panelImage", "image-ui-panel");
    if (!font.ok || !image.ok) throw new Error("approved selection rejected");

    expect(font.resource).toEqual(lookupApprovedResource("font-ui-body"));
    expect(font.resource.path).toBe("assets/ui/font-ui-body.woff2");
    expect(font.resource.kind).toBe("font");
    expect(font.resource.width).toBeNull();
    expect(font.resource.hash).toBe("a".repeat(64));
    expect(image.resource).toEqual(IMAGE);
    expect(image.resource.width).toBe(1080);
    expect(image.resource.height).toBe(2160);
    expect(font.slot).toBe("fontBody");
    expect(image.slot).toBe("panelImage");
  });

  it("rejects unapproved ids, external and data URLs, kind mismatch, and tampered hashes", () => {
    expect(selectApprovedAsset("fontBody", "plugin-extra").ok).toBe(false);
    expect(selectApprovedAsset("panelImage", "https://evil.example/a.png").ok).toBe(false);
    expect(selectApprovedAsset("panelImage", "blob:https://local/asset").ok).toBe(false);
    expect(selectApprovedAsset("panelImage", "data:image/png;base64,aaaa").ok).toBe(false);
    expect(selectApprovedAsset("panelImage", "font-ui-body").ok).toBe(false);
    expect(selectApprovedAsset("fontBody", "image-ui-panel").ok).toBe(false);

    const tampered = selectApprovedAsset("fontBody", {
      id: "font-ui-body",
      hash: "c".repeat(64),
    });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.reason).toMatch(/hash/i);
  });

  it("locks unconnected slots and states missing fallback without binary guarantee", () => {
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);
    expect(REQUIRED_ASSET_REQUIREMENTS.map((item) => item.slot)).toEqual(["fontBody", "panelImage"]);
    expect(ASSET_SLOT_POLICY.missing).toBe("lock");
    expect(ASSET_SLOT_POLICY.fallback).toBe("none");
    expect(ASSET_SLOT_POLICY.binaryGuaranteed).toBe(false);
    expect(ASSET_SLOT_POLICY.copiesFile).toBe(false);
    expect(ASSET_SLOT_POLICY.uploads).toBe(false);
    expect(ASSET_SLOT_POLICY.network).toBe(false);

    const empty = selectApprovedAsset("fontBody", null);
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.locked).toBe(true);
      expect(empty.reason.length).toBeGreaterThan(0);
    }
    expect(selectApprovedAsset("unknownSlot", "font-ui-body").ok).toBe(false);
    expect(ASSET_JSON_LIMITS).toEqual({ maxBytes: 1024 * 1024, maxDepth: 16, maxName: 80 });
  });
});
