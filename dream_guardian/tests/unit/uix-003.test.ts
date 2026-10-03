import { describe, expect, it } from "vitest";
import { DESIGN_SIZE, KINDS, MENU_CARD_IDS, SCHEMA_VERSION } from "../../src/editor/ui/data/UIContracts";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  OUT_OF_SCOPE_MEANS_RESTORE,
  PROTECTED_REGIONS,
  validateProject,
  validateRaw,
  validateTransfer,
} from "../../src/editor/ui/data/UIValidator";

function validProject() {
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    design: { width: preset.design.width, height: preset.design.height },
    menu: {
      cards: preset.cards.map((card) => ({ id: card.id, x: card.x, y: card.y })),
      width: preset.width,
      height: preset.height,
      workoutButton: { ...preset.workoutButton },
    },
    baseline: {
      id: BASELINE_REGISTRY.id,
      version: BASELINE_REGISTRY.version,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    },
  };
}

function validTransfer(scope: string = "menu") {
  const project = validProject();
  return {
    kind: KINDS.transfer,
    schemaVersion: SCHEMA_VERSION,
    design: project.design,
    scope,
    content: project.menu,
    baseline: project.baseline,
    contentHash: "b".repeat(64),
    artifactHash: "c".repeat(64),
    sourceCheckpointHash: null,
    sourceComparison: "not-performed",
  };
}

function codes(result: { ok: true } | { ok: false; errors: Array<{ code: string; path: string }> }) {
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  return result.errors.map((error) => error.code);
}

describe("UIX-003 layout error codes stay distinct", () => {
  it("reports missing-card, duplicate-card-id, shared-size-violation, out-of-canvas, and protected-region separately", () => {
    const missing = validProject();
    missing.menu.cards = missing.menu.cards.filter((card) => card.id !== MENU_CARD_IDS[0]);
    expect(codes(validateProject(missing))).toContain("missing-card");
    expect(codes(validateProject(missing))).not.toContain("duplicate-card-id");

    const duplicate = validProject();
    duplicate.menu.cards = duplicate.menu.cards.map((card, index) =>
      index === 1 ? { ...card, id: MENU_CARD_IDS[0] } : card,
    );
    expect(codes(validateProject(duplicate))).toContain("duplicate-card-id");
    expect(codes(validateProject(duplicate))).not.toContain("missing-card");

    const shared = validProject();
    (shared.menu as { width?: number }).width = undefined;
    expect(codes(validateProject(shared))).toContain("shared-size-violation");

    const outside = validProject();
    outside.menu.cards[0].x = DESIGN_SIZE.width;
    expect(codes(validateProject(outside))).toContain("out-of-canvas");
    expect(codes(validateProject(outside))).not.toContain("protected-region");

    const protectedHit = validProject();
    protectedHit.menu.cards[0].y = 0;
    expect(PROTECTED_REGIONS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(PROTECTED_REGIONS)).toBe(true);
    expect(codes(validateProject(protectedHit))).toContain("protected-region");
    expect(codes(validateProject(protectedHit))).not.toContain("out-of-canvas");
  });
});

describe("UIX-003 rejects unknown, dangerous, and non-finite values", () => {
  it("rejects unknown fields, prototype keys, and non-finite numbers, and accepts the frozen baseline fixture", () => {
    const accepted = validateProject(validProject());
    expect(accepted).toEqual({ ok: true });

    const unknown = validProject() as Record<string, unknown>;
    unknown.extra = 1;
    const snapshot = JSON.stringify(unknown);
    const unknownResult = validateProject(unknown);
    expect(codes(unknownResult)).toContain("unknown-field");
    expect(JSON.stringify(unknown)).toBe(snapshot);
    expect(unknown.extra).toBe(1);

    const proto = validProject() as Record<string, unknown>;
    Object.defineProperty(proto, "__proto__", { value: { polluted: true }, enumerable: true });
    expect(codes(validateProject(proto))).toContain("dangerous-key");
    expect(codes(validateRaw('{"__proto__":1}'))).toContain("dangerous-key");
    expect(codes(validateRaw('{"constructor":1}'))).toContain("dangerous-key");
    expect(codes(validateRaw('{"prototype":1}'))).toContain("dangerous-key");
    expect(validateRaw('{"a":1,"a":2}').ok).toBe(false);

    const nonFinite = validProject();
    nonFinite.menu.cards[0].x = Number.NaN;
    expect(codes(validateProject(nonFinite))).toContain("non-finite");
    nonFinite.menu.cards[0].x = Number.POSITIVE_INFINITY;
    expect(codes(validateProject(nonFinite))).toContain("non-finite");
  });
});

describe("UIX-003 rejects mismatches without partial success", () => {
  it("rejects kind, version, baseline, and scope mismatches and does not delete unknown fields", () => {
    const wrongKind = validProject() as { kind: string };
    wrongKind.kind = KINDS.transfer;
    expect(codes(validateProject(wrongKind))).toContain("kind-mismatch");
    expect(codes(validateProject(wrongKind))).not.toContain("unknown-field");

    const wrongVersion = validProject();
    wrongVersion.schemaVersion = "9.9.9";
    expect(codes(validateProject(wrongVersion))).toContain("version-mismatch");

    const wrongBaseline = validProject();
    wrongBaseline.baseline.presetHash = "d".repeat(64);
    expect(codes(validateProject(wrongBaseline))).toContain("baseline-mismatch");

    expect(codes(validateTransfer(validTransfer("game-stats")))).toContain("scope-mismatch");
    expect(OUT_OF_SCOPE_MEANS_RESTORE).toBe(false);

    const incomplete = validTransfer("menu.card");
    delete (incomplete.content.cards[0] as { y?: number }).y;
    const incompleteResult = validateTransfer(incomplete);
    expect(codes(incompleteResult)).toContain("incomplete-scope");
    expect(codes(incompleteResult)).not.toContain("unknown-field");

    const omitted = validTransfer("menu.workoutButton");
    expect(codes(validateTransfer(omitted))).not.toContain("incomplete-scope");
    expect(validateTransfer(omitted).ok).toBe(false);

    const dirty = validTransfer() as Record<string, unknown>;
    dirty.warning = "keep-me";
    const before = JSON.stringify(dirty);
    const dirtyResult = validateTransfer(dirty);
    expect(dirtyResult.ok).toBe(false);
    expect("warnings" in dirtyResult).toBe(false);
    expect(JSON.stringify(dirty)).toBe(before);
    expect(codes(dirtyResult)).toContain("unknown-field");
  });
});
