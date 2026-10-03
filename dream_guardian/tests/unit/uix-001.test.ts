import { describe, expect, it } from "vitest";
import {
  DESIGN_SIZE,
  KINDS,
  LIMITS,
  MENU_CARD_IDS,
  REJECTED_CATEGORIES,
  SCHEMA_VERSION,
  SCOPED_SNAPSHOT_SEMANTICS,
  SOURCE_COMPARISON_NOT_PERFORMED,
  assertProjectContract,
  assertTransferContract,
  isFieldAllowed,
  outOfScopeOmissionMeansRestoreDefaults,
  validateExternalJsonLimits,
} from "../../src/editor/ui/data/UIContracts";
import {
  MENU_SHARED_SIZE_FIELDS,
  WORKOUT_BUTTON_FIELDS,
  isRejectedCategoryKey,
} from "../../src/editor/ui/data/UIProperties";

const fiveCards = () =>
  MENU_CARD_IDS.map((id, index) => ({
    id,
    x: 40 + index * 10,
    y: 120,
  }));

function validProject() {
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
    menu: {
      cards: fiveCards(),
      width: 280,
      height: 360,
      workoutButton: { x: 100, y: 1800, width: 400, height: 120 },
    },
  };
}

function validTransfer(overrides: Record<string, unknown> = {}) {
  return {
    kind: KINDS.transfer,
    schemaVersion: SCHEMA_VERSION,
    design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
    scope: "menu",
    content: {
      cards: fiveCards(),
      width: 280,
      height: 360,
      workoutButton: { x: 100, y: 1800, width: 400, height: 120 },
    },
    contentHash: "a".repeat(64),
    artifactHash: "b".repeat(64),
    sourceCheckpointHash: "c".repeat(64),
    sourceComparison: "performed",
    ...overrides,
  };
}

describe("UIX-001 project and transfer allowlist", () => {
  it("allows kind, schemaVersion, 1080x2160, and exactly 5 menu cards plus shared size", () => {
    expect(KINDS.project).toBe("dream-guardian-ui-project");
    expect(KINDS.transfer).toBe("dream-guardian-ui-transfer");
    expect(SCHEMA_VERSION).toBe("1.0.0");
    expect(DESIGN_SIZE).toEqual({ width: 1080, height: 2160 });
    expect(MENU_CARD_IDS).toEqual([
      "card-story",
      "card-play",
      "card-records",
      "card-settings",
      "card-credits",
    ]);
    expect(MENU_SHARED_SIZE_FIELDS).toEqual(["width", "height"]);
    expect(WORKOUT_BUTTON_FIELDS).toEqual(["x", "y", "width", "height"]);
    expect(assertProjectContract(validProject()).ok).toBe(true);
    expect(assertTransferContract(validTransfer()).ok).toBe(true);
  });

  it("rejects wrong kind, version, size, a 6th card id, and unsupported fields", () => {
    const wrongKind = validProject() as { kind: string };
    wrongKind.kind = "dream-guardian-ui-other";
    expect(assertProjectContract(wrongKind).ok).toBe(false);

    const wrongVersion = validProject() as { schemaVersion: string };
    wrongVersion.schemaVersion = "2.0.0";
    expect(assertProjectContract(wrongVersion).ok).toBe(false);

    const wrongSize = validProject() as { design: { width: number; height: number } };
    wrongSize.design = { width: 1920, height: 1080 };
    expect(assertProjectContract(wrongSize).ok).toBe(false);

    const sixth = validProject() as { menu: { cards: Array<{ id: string; x: number; y: number }> } };
    sixth.menu.cards = [...fiveCards(), { id: "card-extra", x: 1, y: 2 }];
    expect(assertProjectContract(sixth).ok).toBe(false);

    const extraField = validProject() as { menu: Record<string, unknown> };
    extraField.menu = { ...validProject().menu, opacity: 0.5 };
    expect(assertProjectContract(extraField).ok).toBe(false);
    expect(isFieldAllowed("menu", "opacity")).toBe(false);
    expect(isFieldAllowed("menu", "width")).toBe(true);
    expect(isFieldAllowed("menu.workoutButton", "x")).toBe(true);
  });

  it("treats out-of-scope omission as not restoring defaults", () => {
    expect(outOfScopeOmissionMeansRestoreDefaults()).toBe(false);
    expect(SCOPED_SNAPSHOT_SEMANTICS).toMatch(/기본값 복원/);
    expect(SCOPED_SNAPSHOT_SEMANTICS).toMatch(/미포함/);
    const omitted = validTransfer();
    delete (omitted as { theme?: unknown }).theme;
    const result = assertTransferContract(omitted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outOfScopeOmissionMeansRestoreDefaults).toBe(false);
    }
  });

  it("rejects game stats, arbitrary paths, asset overrides, and unsupported scopes", () => {
    expect(REJECTED_CATEGORIES).toEqual(
      expect.arrayContaining(["game-stats", "arbitrary-paths", "asset-overrides", "unsupported-scopes"]),
    );
    expect(isRejectedCategoryKey("hp")).toBe(true);
    expect(isRejectedCategoryKey("damage")).toBe(true);
    expect(isRejectedCategoryKey("mana")).toBe(true);

    const withHp = validProject() as Record<string, unknown>;
    withHp.hp = 100;
    expect(assertProjectContract(withHp).ok).toBe(false);

    const withPath = validTransfer({
      content: { ...validTransfer().content, image: "../secret.png" },
    });
    expect(assertTransferContract(withPath).ok).toBe(false);
    expect(assertTransferContract(validTransfer({ assetOverride: "skin.png" })).ok).toBe(false);
    expect(assertTransferContract(validTransfer({ scope: "battle" })).ok).toBe(false);
    expect(assertProjectContract({ ...validProject(), file: "C:\\Windows\\system.ini" }).ok).toBe(false);
    expect(assertProjectContract({ ...validProject(), href: "https://evil.example/ui.json" }).ok).toBe(false);
  });

  it("encodes external JSON limits and rejects depth or name violations", () => {
    expect(LIMITS).toEqual({ maxBytes: 1048576, maxDepth: 16, maxNameLength: 80 });
    const deep = { a: {} as Record<string, unknown> };
    let cursor = deep.a;
    for (let i = 0; i < 20; i += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(validateExternalJsonLimits(deep).ok).toBe(false);

    const longName: Record<string, unknown> = {};
    longName["n".repeat(81)] = 1;
    expect(validateExternalJsonLimits(longName).ok).toBe(false);
    expect(validateExternalJsonLimits({ name: "ok" }).ok).toBe(true);
  });

  it("distinguishes missing source from hash mismatch and does not treat hashes as signatures", () => {
    const missing = validTransfer({ sourceCheckpointHash: null, sourceComparison: "not-performed" });
    const result = assertTransferContract(missing);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sourceComparison).toBe(SOURCE_COMPARISON_NOT_PERFORMED);
    }
    expect(SOURCE_COMPARISON_NOT_PERFORMED).toBe("원본 대조 미실시");
    const mismatch = validTransfer({ sourceComparison: "hash-mismatch" });
    const mismatched = assertTransferContract(mismatch);
    expect(mismatched.ok).toBe(true);
    if (mismatched.ok) {
      expect(mismatched.sourceComparison).not.toBe(SOURCE_COMPARISON_NOT_PERFORMED);
    }
  });
});
