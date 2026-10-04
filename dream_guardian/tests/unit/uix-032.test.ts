import { describe, expect, it } from "vitest";
import {
  DESIGN_SIZE,
  KINDS,
  LIMITS,
  MENU_CARD_IDS,
  SCHEMA_VERSION,
  assertProjectContract,
} from "../../src/editor/ui/data/UIContracts";
import {
  APPROVED_RESOURCES,
  RESOURCE_BINARY_GUARANTEED,
  STYLE_TRANSFER_VERSION,
  lookupApprovedResource,
} from "../../src/editor/ui/data/UIResourceCatalog";
import { lookupScreenContract } from "../../src/editor/ui/data/UIProperties";
import { validateStyleTransfer } from "../../src/editor/ui/data/UIValidator";

const FONT_ID = "font-ui-body";
const IMAGE_ID = "image-ui-panel";
const FONT_PATH = "assets/ui/font-ui-body.woff2";
const IMAGE_PATH = "assets/ui/image-ui-panel.png";
const FONT_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

function menuProject() {
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
    menu: {
      cards: MENU_CARD_IDS.map((id, index) => ({ id, x: 40 + index * 10, y: 120 })),
      width: 280,
      height: 360,
      workoutButton: { x: 100, y: 1800, width: 400, height: 120 },
    },
  };
}

function stylePayload(overrides: Record<string, unknown> = {}) {
  return {
    styleVersion: STYLE_TRANSFER_VERSION,
    resources: [
      { id: FONT_ID, path: FONT_PATH, hash: FONT_HASH },
      { id: IMAGE_ID, path: IMAGE_PATH, hash: IMAGE_HASH },
    ],
    ...overrides,
  };
}

describe("UIX-032 closed style resource catalog", () => {
  it("freezes style version and an approved font plus image catalog", () => {
    expect(STYLE_TRANSFER_VERSION).toBe("style-1.0.0");
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);
    expect(Object.isFrozen(APPROVED_RESOURCES)).toBe(true);
    expect(APPROVED_RESOURCES).toHaveLength(2);
    expect(lookupApprovedResource(FONT_ID)).toEqual({
      id: FONT_ID,
      path: FONT_PATH,
      kind: "font",
      width: null,
      height: null,
      hash: FONT_HASH,
    });
    expect(lookupApprovedResource(IMAGE_ID)).toEqual({
      id: IMAGE_ID,
      path: IMAGE_PATH,
      kind: "image",
      width: 1080,
      height: 2160,
      hash: IMAGE_HASH,
    });
    expect(lookupApprovedResource("plugin-extra")).toBeNull();
  });

  it("preserves layout V1 and rejects unknown resources and version mismatches", () => {
    expect(assertProjectContract(menuProject()).ok).toBe(true);
    expect(lookupScreenContract("menu", SCHEMA_VERSION, "menu").registered).toBe(true);
    expect(validateStyleTransfer(stylePayload()).ok).toBe(true);
    expect(validateStyleTransfer(stylePayload({ styleVersion: "style-9.9.9" })).ok).toBe(false);
    expect(validateStyleTransfer(stylePayload({
      resources: [{ id: "plugin-extra", path: FONT_PATH, hash: FONT_HASH }],
    })).ok).toBe(false);
    expect(LIMITS).toEqual({ maxBytes: 1048576, maxDepth: 16, maxNameLength: 80 });
  });

  it("rejects external URL, blob, data URL, arbitrary CSS, and uploads", () => {
    const unsafe = [
      "https://example.com/font.woff2",
      "http://example.com/a.png",
      "blob:https://local/1",
      "data:image/png;base64,aaaa",
      "assets/ui/custom.css",
      "upload://local/font.woff2",
    ];
    for (const path of unsafe) {
      const result = validateStyleTransfer(stylePayload({
        resources: [{ id: FONT_ID, path, hash: FONT_HASH }],
      }));
      expect(result.ok).toBe(false);
    }
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);
  });
});
