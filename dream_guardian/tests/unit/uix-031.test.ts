import { describe, expect, it } from "vitest";
import {
  DESIGN_SIZE,
  HASHES_ARE_NOT_SIGNATURES,
  KINDS,
  MENU_CARD_IDS,
  SCHEMA_VERSION,
  SOURCE_COMPARISON_NOT_PERFORMED,
} from "../../src/editor/ui/data/UIContracts";
import {
  artifactHash,
  contentHash,
  sourceCheckpointHash,
} from "../../src/editor/ui/data/UICanonicalJSON";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract } from "../../src/editor/ui/data/UIProperties";
import { GAME_APPLY_VERIFIED, buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { migrateStepwise } from "../../src/editor/ui/io/UIMigration";

function v1MenuProject(cardX = 90) {
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  preset.cards[0].x = cardX;
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

describe("UIX-031 extended contract export, reinspect, migration", () => {
  it("rejects unregistered version/scope and incomplete supported scope", () => {
    const project = v1MenuProject();
    const unregistered = buildTransfer({
      checkpoint: { ...project, schemaVersion: "9.9.9" },
      scope: "menu",
      sourceId: "src-a",
      exportId: "exp-a",
    });
    expect(unregistered.ok).toBe(false);
    const unknownScope = buildTransfer({
      checkpoint: project,
      scope: "battle",
      sourceId: "src-a",
      exportId: "exp-a",
    });
    expect(unknownScope.ok).toBe(false);
    const incomplete = structuredClone(project) as {
      menu: { cards: unknown; width?: number; height?: number; workoutButton?: unknown };
    };
    delete incomplete.menu.height;
    delete incomplete.menu.workoutButton;
    const dropped = buildTransfer({
      checkpoint: incomplete,
      scope: "menu",
      sourceId: "src-a",
      exportId: "exp-a",
    });
    expect(dropped.ok).toBe(false);
    if (!dropped.ok) expect(dropped.reason).toMatch(/incomplete|missing|scope/i);
  });

  it("round-trips a V1 menu project through build and inspect", async () => {
    const source = v1MenuProject(120);
    const before = JSON.stringify(source);
    const built = await Promise.resolve(
      buildTransfer({ checkpoint: source, scope: "menu", sourceId: "src-v1", exportId: "exp-v1" }),
    );
    expect(JSON.stringify(source)).toBe(before);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const file = built.transfer as Record<string, unknown>;
    expect(file.kind).toBe(KINDS.transfer);
    expect(file.scope).toBe("menu");
    expect(file.contentHash).toBe(contentHash(file.content));
    const report = inspectTransfer({ file, originalCheckpoint: source });
    expect(report.contentHashOk).toBe(true);
    expect(report.artifactHashOk).toBe(true);
    expect(report.sourceComparison).toBe("match");
    expect(report.accepted).toBe(false);
    expect(report.profileStatus).toBe("미검증");
    expect(report.gameApplyVerified).toBe(false);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(HASHES_ARE_NOT_SIGNATURES).toBe(true);
    expect(report.hashesAreSignatures).toBe(false);
    const content = file.content as { cards: { id: string }[]; width: number; height: number; workoutButton: object };
    expect(content.cards.map((card) => card.id)).toEqual([...MENU_CARD_IDS]);
    expect(content.width).toBeTypeOf("number");
    expect(content.height).toBeTypeOf("number");
    expect(content.workoutButton).toEqual(expect.objectContaining({ x: expect.any(Number), width: expect.any(Number) }));
    expect(file.design).toEqual({ width: DESIGN_SIZE.width, height: DESIGN_SIZE.height });
  });

  it("re-inspects hash, diff, profile, and provenance for a new official version fixture", () => {
    const contract = lookupScreenContract("menu", "1.0.0", "menu");
    expect(contract.registered).toBe(true);
    const source = v1MenuProject(40);
    const built = buildTransfer({
      checkpoint: source,
      scope: "menu",
      sourceId: "src-new",
      exportId: "exp-new",
      screen: "menu",
      version: "1.0.0",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const file = built.transfer as Record<string, unknown>;
    expect(file.contentHash).toBe(contentHash(file.content));
    expect(artifactHash(file)).toBeTypeOf("string");
    expect(file.sourceCheckpointHash).toBe(sourceCheckpointHash(source));
    const missing = inspectTransfer({ file });
    expect(missing.sourceComparison).toBe(SOURCE_COMPARISON_NOT_PERFORMED);
    expect(missing.fileCorruptBecauseOriginalMissing).toBe(false);
    const shifted = v1MenuProject(41);
    const mismatch = inspectTransfer({ file: built.transfer, originalCheckpoint: shifted });
    expect(mismatch.sourceComparison).toBe("mismatch");
    expect(mismatch.diff).toEqual(expect.objectContaining({ changed: true }));
    expect(mismatch.profile).toEqual(
      expect.objectContaining({ status: expect.stringMatching(/미검증|unverified|linked|profile/i) }),
    );
    expect(mismatch.provenance).toEqual(
      expect.objectContaining({ sourceId: "src-new", exportId: "exp-new", verified: false }),
    );
    expect(mismatch.gameApplyVerified).toBe(false);
  });

  it("returns an explicit stepwise project migration report", () => {
    const raw = JSON.stringify({ ...v1MenuProject(), projectId: "proj-031" });
    const result = migrateStepwise(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.length).toBeGreaterThanOrEqual(4);
    expect(result.steps[0]).toBe("parse");
    expect(result.steps).toEqual(expect.arrayContaining(["kind", "schemaVersion", "registry", "validate"]));
    expect(result.report).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: "parse", status: "ok" }),
        expect.objectContaining({ step: "registry", status: "ok" }),
        expect.objectContaining({ step: "validate", status: "ok" }),
      ]),
    );
    expect(result.document.kind).toBe(KINDS.project);
    expect(result.sourceProjectId).toBe("proj-031");
  });

  it("blocks export of a registry-only screen until a safe preview/profile link exists", () => {
    const source = v1MenuProject();
    const blocked = buildTransfer({
      checkpoint: source,
      scope: "menu",
      sourceId: "src-lock",
      exportId: "exp-lock",
      screen: "menu",
      version: "1.0.0",
      previewLinked: false,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toMatch(/preview|profile|registry-only|link/i);
    const linked = buildTransfer({
      checkpoint: source,
      scope: "menu",
      sourceId: "src-link",
      exportId: "exp-link",
      screen: "menu",
      version: "1.0.0",
      previewLinked: true,
    });
    expect(linked.ok).toBe(true);
  });
});
