import { describe, expect, it } from "vitest";
import { KINDS, SCHEMA_VERSION } from "../../src/editor/ui/data/UIContracts";
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
import { OUT_OF_SCOPE_MEANS_RESTORE } from "../../src/editor/ui/data/UIValidator";
import {
  GAME_APPLY_VERIFIED,
  buildTransfer,
  buildTransferFromRaw,
} from "../../src/editor/ui/data/UITransferBuilder";

function checkpoint() {
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  preset.cards[0].x = 90;
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

describe("UIX-005 scoped transfer from checkpoint", () => {
  it("exports the full menu scope including restored baseline values", async () => {
    const source = checkpoint();
    delete (source.menu as { height?: number }).height;
    const before = JSON.stringify(source);
    const built = await Promise.resolve(
      buildTransfer({
        checkpoint: source,
        scope: "menu",
        sourceId: "src-a",
        exportId: "exp-a",
      }),
    );
    expect(JSON.stringify(source)).toBe(before);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const transfer = built.transfer as {
      kind: string;
      omissionMeansRestore: boolean;
      restoreDefaults?: unknown;
      content: { cards: unknown[]; width: number; height: number; workoutButton: object };
      provenance: { sourceId: string; exportId: string; sourceCheckpointHash: string };
    };
    expect(transfer.kind).toBe("dream-guardian-ui-transfer");
    expect(transfer.omissionMeansRestore).toBe(false);
    expect(OUT_OF_SCOPE_MEANS_RESTORE).toBe(false);
    expect(transfer.restoreDefaults).toBeUndefined();
    expect(transfer.content.cards).toHaveLength(5);
    expect(transfer.content.width).toBe(clonePresetForEdit(BASELINE_REGISTRY.id).width);
    expect(transfer.content.height).toBe(clonePresetForEdit(BASELINE_REGISTRY.id).height);
    expect(transfer.content.workoutButton).toEqual(clonePresetForEdit(BASELINE_REGISTRY.id).workoutButton);
    expect(transfer.content.cards[0]).toEqual({ id: "card-story", x: 90, y: 120 });
    expect(GAME_APPLY_VERIFIED).toBe(false);
  });

  it("keeps contentHash stable and provenance distinct across sources", async () => {
    const left = await Promise.resolve(
      buildTransfer({ checkpoint: checkpoint(), scope: "menu", sourceId: "src-a", exportId: "exp-a" }),
    );
    const right = await Promise.resolve(
      buildTransfer({ checkpoint: checkpoint(), scope: "menu", sourceId: "src-b", exportId: "exp-b" }),
    );
    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    const a = left.transfer as {
      content: object;
      contentHash: string;
      integrity: { artifactHash: string };
      sourceCheckpointHash: string;
      provenance: { sourceId: string; exportId: string; sourceCheckpointHash: string };
    };
    const b = right.transfer as typeof a;
    expect(a.contentHash).toBe(contentHash(a.content));
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.provenance.sourceId).toBe("src-a");
    expect(b.provenance.sourceId).toBe("src-b");
    expect(a.provenance.exportId).not.toBe(b.provenance.exportId);
    expect(a.integrity.artifactHash).toBe(artifactHash(a));
    expect(a.sourceCheckpointHash).toBe(sourceCheckpointHash(checkpoint()));
    expect(a.provenance.sourceCheckpointHash).toBe(a.sourceCheckpointHash);
    expect(a.contentHash).not.toBe(a.integrity.artifactHash);
    expect(a.integrity.artifactHash).not.toBe(a.sourceCheckpointHash);
  });

  it("rejects invalid checkpoints and dangerous raw input without dropping fields", async () => {
    const invalid = checkpoint() as Record<string, unknown>;
    invalid.hp = 1;
    const rejected = await Promise.resolve(
      buildTransfer({ checkpoint: invalid, scope: "menu", sourceId: "src-a", exportId: "exp-a" }),
    );
    expect(rejected.ok).toBe(false);
    const raw = await Promise.resolve(
      buildTransferFromRaw('{"a":1,"a":2}', { scope: "menu", sourceId: "src-a", exportId: "exp-a" }),
    );
    expect(raw.ok).toBe(false);
    const huge = await Promise.resolve(
      buildTransferFromRaw("x".repeat(1048577), { scope: "menu", sourceId: "src-a", exportId: "exp-a" }),
    );
    expect(huge.ok).toBe(false);
  });
});
