import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { lookupAssetContract } from "../../src/editor/ui/data/UIProperties";
import {
  APPROVED_RESOURCES,
  RESOURCE_BINARY_GUARANTEED,
  lookupApprovedResource,
} from "../../src/editor/ui/data/UIResourceCatalog";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import {
  ASSET_LOCK_REASONS,
  ASSET_SLOT_POLICY,
  REQUIRED_ASSET_REQUIREMENTS,
} from "../../src/editor/ui/data/styles/UIAssetContract";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  createAssetPreview,
  registerAssetPreview,
  roundTripAsset,
} from "../../src/editor/ui/preview/styles/UIAssetPreview";

const FONT = APPROVED_RESOURCES.find((item) => item.id === "font-ui-body");
const IMAGE = APPROVED_RESOURCES.find((item) => item.id === "image-ui-panel");

describe("UIX-039 approved asset preview cache and export", () => {
  it("selects an approved id into a registry form, undoes, previews, and snapshots", () => {
    const preview = createAssetPreview();
    const selected = preview.select("fontBody", "font-ui-body");
    if (!selected.ok) throw new Error(selected.reason);
    expect(selected.screen).toBe("asset");
    expect(selected.registry).toMatchObject({
      registered: true,
      exportEnabled: false,
      supportStatus: "locked",
    });
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.slots.fontBody?.resource).toEqual(lookupApprovedResource("font-ui-body"));
    expect(selected.form.slots.fontBody?.resource.path).toBe("assets/ui/font-ui-body.woff2");
    expect(selected.form.slots.fontBody?.resource.kind).toBe("font");
    expect(selected.form.slots.fontBody?.resource.hash).toBe(FONT?.hash);
    expect(selected.form.slots.panelImage).toBeNull();
    expect(selected.form.exportEnabled).toBe(false);
    expect(selected.form.binaryGuaranteed).toBe(false);

    const replaced = preview.select("fontBody", "image-ui-panel");
    expect(replaced.ok).toBe(false);
    if (!replaced.ok) expect(replaced.reason).toBe(ASSET_LOCK_REASONS.unapproved);
    expect(preview.form().slots.fontBody?.resource.id).toBe("font-ui-body");

    const undone = preview.undo();
    expect(undone.slots.fontBody).toBeNull();

    preview.select("panelImage", { id: "image-ui-panel", hash: IMAGE?.hash });
    const shown = preview.preview();
    expect(shown.contextId).toBe("dream-guardian-ui-preview");
    expect(shown.slots.panelImage?.resource).toEqual(IMAGE);
    expect(shown.slots.panelImage?.resource.width).toBe(1080);
    expect(shown.slots.panelImage?.resource.height).toBe(2160);
    expect(shown.binaryGuaranteed).toBe(false);
    expect(shown.copiesFile).toBe(false);
    expect(shown.uploads).toBe(false);
    expect(shown.missingPolicy).toBe("lock");
    expect(shown.fallback).toBe("none");
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);

    const snapshot = preview.snapshot();
    expect(snapshot.checkpoint.screen).toBe("asset");
    expect(snapshot.checkpoint.slots.panelImage?.id).toBe("image-ui-panel");
    expect(snapshot.checkpoint.slots.panelImage?.path).toBe("assets/ui/image-ui-panel.png");
    expect(snapshot.checkpoint.binaryGuaranteed).toBe(false);
    expect(snapshot.checkpoint.copiesFile).toBe(false);
  });

  it("round-trips approved metadata and keeps registration from enabling export", () => {
    const preview = createAssetPreview();
    preview.select("fontBody", "font-ui-body");
    preview.select("panelImage", "image-ui-panel");
    const trip = roundTripAsset(preview);
    if (!trip.selected.ok) throw new Error(trip.selected.reason);
    expect(trip.selected.screen).toBe("asset");
    expect(trip.inspected.gameApplyVerified).toBe(false);
    expect(trip.inspected.accepted).toBe(false);
    expect(trip.transfer.ok).toBe(false);
    if (!trip.transfer.ok) expect(trip.transfer.reason).toBe("unregistered-screen-contract");
    expect(registerAssetPreview().exportEnabled).toBe(false);
    expect(lookupAssetContract()?.exportEnabled).toBe(false);
    expect(lookupAssetContract()?.binaryGuaranteed).toBe(false);

    const blocked = buildTransfer({
      checkpoint: {
        screen: "asset",
        slots: { fontBody: { id: "font-ui-body" }, panelImage: { id: "image-ui-panel" } },
      },
      scope: "asset",
      sourceId: "src-asset",
      exportId: "exp-asset",
      screen: "asset",
      version: "1.0.0",
      previewLinked: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unregistered-screen-contract");
    expect(trip.transfer).not.toMatchObject({ ok: true });
  });

  it("rejects unapproved ids, external urls, kind mismatch, and bad hashes in the preview path", () => {
    const preview = createAssetPreview();
    const unapproved = preview.select("fontBody", "font-not-approved");
    expect(unapproved).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.unapproved });
    const blob = preview.select("panelImage", "blob:https://local/image");
    expect(blob).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.externalUrl });
    const data = preview.select("panelImage", "data:image/png;base64,aaaa");
    expect(data).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.externalUrl });
    const external = preview.select("fontBody", "https://example.com/font.woff2");
    expect(external).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.externalUrl });
    const mismatch = preview.select("fontBody", "image-ui-panel");
    expect(mismatch).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.unapproved });
    const hash = preview.select("panelImage", { id: "image-ui-panel", hash: "c".repeat(64) });
    expect(hash).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.tamperedHash });
    const empty = preview.select("fontBody", "");
    expect(empty).toMatchObject({ ok: false, reason: ASSET_LOCK_REASONS.unconnected });
    expect(preview.form().slots.fontBody).toBeNull();
    expect(preview.form().slots.panelImage).toBeNull();
    expect(preview.form().exportEnabled).toBe(false);
  });

  it("clears context cache on replace, remove, and screen change so a late image cannot restore", () => {
    const preview = createAssetPreview();
    preview.select("panelImage", "image-ui-panel");
    const first = preview.preview();
    expect(first.slots.panelImage?.resource.id).toBe("image-ui-panel");
    const generation = first.generation;

    preview.select("panelImage", "");
    preview.changeScreen();
    const late = preview.restore(generation, IMAGE);
    expect(late.restored).toBe(false);
    expect(late.reason).toBe("stale-context");
    expect(preview.form().slots.panelImage).toBeNull();
    expect(preview.preview().slots.panelImage).toBeNull();

    preview.select("fontBody", "font-ui-body");
    const current = preview.preview();
    preview.remove("fontBody");
    const afterRemove = preview.restore(current.generation, FONT);
    expect(afterRemove.restored).toBe(false);
    expect(preview.form().slots.fontBody).toBeNull();
    expect(preview.requirements().every((item) => item.connected === false || item.slot !== "fontBody")).toBe(true);
  });

  it("locks missing resources, states fallback none, and never claims the binary exists", () => {
    const preview = createAssetPreview();
    const shown = preview.preview();
    expect(shown.requirements).toEqual(
      REQUIRED_ASSET_REQUIREMENTS.map((item) => ({ ...item, connected: false, locked: true })),
    );
    expect(shown.missingPolicy).toBe(ASSET_SLOT_POLICY.missing);
    expect(shown.fallback).toBe(ASSET_SLOT_POLICY.fallback);
    expect(shown.binaryGuaranteed).toBe(false);
    expect(shown.binaryExists).toBe(false);
    expect(RESOURCE_BINARY_GUARANTEED).toBe(false);
    expect(shown.copiesFile).toBe(false);
    expect(shown.uploads).toBe(false);
    expect(shown.network).toBe(false);

    preview.select("fontBody", "font-ui-body");
    const partial = preview.preview();
    expect(partial.requirements.find((item) => item.slot === "panelImage")).toMatchObject({
      connected: false,
      locked: true,
      fallback: "none",
    });
    expect(partial.exportEnabled).toBe(false);
    expect(partial.binaryExists).toBe(false);
  });

  it("does not boot the game, copy binaries, upload, or write storage", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), keys: vi.fn(() => [] as string[]) };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const copyBinary = vi.fn();
    const upload = vi.fn();
    const preview = createAssetPreview({ storage, bootGame, camera, network, onDanger, copyBinary, upload });
    preview.select("fontBody", "font-ui-body");
    preview.select("panelImage", "image-ui-panel");
    preview.preview();
    preview.snapshot();
    roundTripAsset(preview);
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    expect(copyBinary).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    for (const key of GAME_KEYS_FORBIDDEN) expect(storage.getItem).not.toHaveBeenCalledWith(key);
    expect(preview.form().writesStorage).toBe(false);
    expect(preview.form().bootsGame).toBe(false);
  });

  it("does not import game bootstrap, camera, or SceneDirector", () => {
    const source = readFileSync("src/editor/ui/preview/styles/UIAssetPreview.ts", "utf8");
    expect(source).not.toMatch(/from ["'].*\/(main|bootstrap|SceneDirector|camera)/);
    expect(source).not.toMatch(/localStorage|indexedDB/);
    expect(source).not.toMatch(/ports\.storage\??\.(getItem|setItem|keys)/);
    expect(source).toContain("buildTransfer");
    expect(source).toContain("inspectTransfer");
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest/);
    const adapter = readFileSync("src/editor/ui/preview/UIPreviewAdapter.ts", "utf8");
    expect(adapter).toContain("registerAssetPreview");
  });
});
