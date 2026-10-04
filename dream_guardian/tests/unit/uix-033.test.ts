import { describe, expect, it } from "vitest";
import {
  HASHES_ARE_NOT_SIGNATURES,
  KINDS,
  SCHEMA_VERSION,
  SOURCE_COMPARISON_NOT_PERFORMED,
} from "../../src/editor/ui/data/UIContracts";
import {
  artifactHash,
  contentHash,
  sourceCheckpointHash,
} from "../../src/editor/ui/data/UICanonicalJSON";
import {
  APPROVED_RESOURCES,
  RESOURCE_BINARY_GUARANTEED,
  STYLE_TRANSFER_VERSION,
} from "../../src/editor/ui/data/UIResourceCatalog";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import { GAME_APPLY_VERIFIED, buildStyleResourceTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { migrateStyleResourceList } from "../../src/editor/ui/io/UIMigration";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";

function v1MenuProject() {
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

describe("UIX-033 style resource list export, reinspect, migration", () => {
  it("exports only approved style values and resource id/hash, never binary bytes", () => {
    const built = buildStyleResourceTransfer({
      styleVersion: STYLE_TRANSFER_VERSION,
      sourceId: "src-style",
      exportId: "exp-style",
      sourceCheckpoint: { projectId: "p-1", kind: KINDS.project },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const file = built.transfer as Record<string, unknown>;
    expect(file.styleVersion).toBe(STYLE_TRANSFER_VERSION);
    expect(file.kind).toBe(KINDS.transfer);
    expect(file.scope).toBe("style-resources");
    const resources = file.resources as Array<Record<string, unknown>>;
    expect(resources.map((item) => item.id)).toEqual(APPROVED_RESOURCES.map((item) => item.id));
    expect(resources.every((item) => typeof item.hash === "string" && item.hash.length === 64)).toBe(true);
    expect(JSON.stringify(file)).not.toMatch(/bytes|base64|data:/i);
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);
    expect(file.resourceBinaryGuaranteed).toBe(false);
    expect(file.gameApplyVerified).toBe(false);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(file.hashesAreSignatures).toBe(false);
    expect(HASHES_ARE_NOT_SIGNATURES).toBe(true);
    expect(file.contentHash).toBe(contentHash(file.content));
    const integrity = file.integrity as { artifactHash: string };
    expect(integrity.artifactHash).toBe(artifactHash(file));
    expect(file.sourceCheckpointHash).toBe(
      sourceCheckpointHash({ projectId: "p-1", kind: KINDS.project }),
    );
  });

  it("reinspect rejects tampered, missing, and unsupported style resource requirements", () => {
    const built = buildStyleResourceTransfer({
      styleVersion: STYLE_TRANSFER_VERSION,
      sourceId: "src-style",
      exportId: "exp-style",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const good = inspectTransfer({ file: built.transfer });
    expect(good.accepted).toBe(true);
    expect(good.gameApplyVerified).toBe(false);
    expect(good.sourceComparison).toBe(SOURCE_COMPARISON_NOT_PERFORMED);

    const tampered = structuredClone(built.transfer) as {
      resources: Array<{ hash: string }>;
      content: { resources: Array<{ hash: string }> };
    };
    tampered.resources[0].hash = "c".repeat(64);
    tampered.content.resources[0].hash = "c".repeat(64);
    expect(inspectTransfer({ file: tampered }).accepted).toBe(false);

    const missing = structuredClone(built.transfer) as { resources: unknown[] };
    missing.resources = [];
    expect(inspectTransfer({ file: missing }).accepted).toBe(false);

    const unsupported = structuredClone(built.transfer) as { styleVersion: string };
    unsupported.styleVersion = "style-9.9.9";
    expect(inspectTransfer({ file: unsupported }).accepted).toBe(false);
  });

  it("still inspects older V1 menu transfer files", async () => {
    const built = await Promise.resolve(
      buildTransfer({
        checkpoint: v1MenuProject(),
        scope: "menu",
        sourceId: "src-v1",
        exportId: "exp-v1",
      }),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const report = inspectTransfer({ file: built.transfer, originalCheckpoint: v1MenuProject() });
    expect(report.accepted).toBe(false);
    expect(report.contentHashOk).toBe(true);
    expect(report.artifactHashOk).toBe(true);
    expect(report.validationRecomputed).toBe(true);
    expect(report.gameApplyVerified).toBe(false);
  });

  it("round-trips the style resource list as JSON with an explicit pure migration report", () => {
    const built = buildStyleResourceTransfer({
      styleVersion: STYLE_TRANSFER_VERSION,
      sourceId: "src-style",
      exportId: "exp-style",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const raw = JSON.stringify(built.transfer);
    const migrated = migrateStyleResourceList(raw);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.report.length).toBeGreaterThan(0);
    expect(migrated.report.every((step) => step.status === "ok")).toBe(true);
    expect(migrated.copied).toBe(false);
    expect(migrated.resourceBinaryGuaranteed).toBe(false);
    expect(JSON.stringify(migrated.document)).toBe(raw);
  });
});
