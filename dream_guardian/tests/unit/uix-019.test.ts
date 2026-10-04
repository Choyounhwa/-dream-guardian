import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SUBMENU_BASELINE, cloneSubmenuPresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import {
  SUBMENU_CONTRACT,
  SUBMENU_LOCK_REASONS,
  deriveSubmenuCell,
} from "../../src/editor/ui/data/screens/UISubmenuContract";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import { roundTripSubmenu } from "../../src/editor/ui/UIEditorShell";
import {
  SUBMENU_PREVIEW_ID,
  createSubmenuPreview,
  registerSubmenuPreview,
} from "../../src/editor/ui/preview/screens/UISubmenuPreview";

const LONG_NAME = "가".repeat(80);

function formOf(preview: ReturnType<typeof createSubmenuPreview>) {
  return preview.form();
}

describe("UIX-019 submenu preview edit export", () => {
  it("selects submenu into a registry form, undoes, previews, and snapshots", () => {
    const preview = createSubmenuPreview();
    const selected = preview.select();
    expect(selected.screen).toBe("submenu");
    expect(selected.registry.registered).toBe(true);
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);

    const edited = preview.edit({ gapX: 96, title: LONG_NAME });
    expect(edited.ok).toBe(true);
    expect(formOf(preview).gapX).toBe(96);
    expect(formOf(preview).title).toBe(LONG_NAME);
    expect(formOf(preview).dirty).toBe(true);

    const undone = preview.undo();
    expect(undone.ok).toBe(true);
    expect(formOf(preview).gapX).toBe(SUBMENU_BASELINE.preset.grid.gapX);
    expect(formOf(preview).title).toBe("");

    preview.edit({ cols: 2, rows: 3, selectedIndex: 4 });
    const drawn = preview.preview();
    expect(drawn.ok).toBe(true);
    expect(drawn.linked).toBe(true);
    expect(drawn.contextId).not.toBe("dream-guardian-game");
    expect(drawn.selectedId).toBe("submenu-cell-4");
    expect(drawn.cells[1]).toEqual(deriveSubmenuCell(1));

    const saved = preview.saveSnapshot();
    expect(saved.screen).toBe("submenu");
    expect(saved.profile).toBe(SUBMENU_BASELINE.rendererFingerprint);
    expect(saved.protectedRegions).toEqual(SUBMENU_CONTRACT.protectedRegions);
    expect(saved.grid.cols).toBe(2);
    expect(saved.selectedIndex).toBe(4);
  });

  it("locks unsupported fields and preserves protected regions across lock and unlock", () => {
    const preview = createSubmenuPreview();
    preview.select();
    const locked = preview.edit({ x: 10, color: "#fff", src: "a.png", hp: 1 });
    expect(locked.ok).toBe(false);
    expect(locked.locks).toEqual(
      expect.arrayContaining([
        SUBMENU_LOCK_REASONS.freeCardXY,
        SUBMENU_LOCK_REASONS.arbitraryColor,
        SUBMENU_LOCK_REASONS.assetPath,
        SUBMENU_LOCK_REASONS.gameStat,
      ]),
    );
    expect(formOf(preview).gapX).toBe(SUBMENU_BASELINE.preset.grid.gapX);

    const unlocked = preview.edit({ startX: 100, startY: 460, width: 400, height: 360 });
    expect(unlocked.ok).toBe(true);
    expect(unlocked.locks).toEqual([]);
    const drawn = preview.preview();
    expect(drawn.protectedRegions).toEqual(SUBMENU_CONTRACT.protectedRegions);
    expect(drawn.profile).toBe(SUBMENU_BASELINE.rendererFingerprint);
    expect(formOf(preview).startX).toBe(100);
    expect(formOf(preview).width).toBe(400);
    expect(cloneSubmenuPresetForEdit(SUBMENU_BASELINE.id).grid.startX).toBe(80);
  });

  it("does not touch game keys, boot, camera, or dangerous callbacks", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => [] as string[]),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const preview = createSubmenuPreview({ storage, bootGame, camera, network, onDanger: vi.fn() });
    preview.select();
    preview.edit({ gapY: 70 });
    preview.preview();
    preview.saveSnapshot();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    for (const key of GAME_KEYS_FORBIDDEN) {
      expect(storage.setItem.mock.calls.map((call) => call[0])).not.toContain(key);
    }
  });

  it("keeps export blocked after registration and reports the existing builder result", () => {
    const registered = registerScreenContract({ screen: "submenu", version: "1.0.0", scope: "submenu" });
    expect(registered.exportEnabled).toBe(false);
    expect(registered.editEnabled).toBe(false);
    const looked = lookupScreenContract("submenu", "1.0.0", "submenu");
    if (!("exportEnabled" in looked)) throw new Error("missing");
    expect(looked.exportEnabled).toBe(false);
    expect(looked.supportStatus).toBe("locked");

    const preview = createSubmenuPreview();
    preview.select();
    const saved = preview.saveSnapshot();
    expect(saved.linked).toBe(true);
    const trip = roundTripSubmenu(preview);
    expect(trip.preview.linked).toBe(true);
    expect(trip.snapshot.screen).toBe("submenu");
    expect(trip.export.ok).toBe(false);
    if (!trip.export.ok) {
      expect(trip.export.reason).toMatch(/unregistered|unsupported-scope|preview|registry-only/i);
    }
    const direct = buildTransfer({
      checkpoint: saved.checkpoint,
      scope: "submenu",
      sourceId: "src-019",
      exportId: "exp-019",
      screen: "submenu",
      version: "1.0.0",
      previewLinked: saved.linked,
    });
    expect(direct).toEqual(trip.export);
    if (direct.ok) {
      const inspected = inspectTransfer({ file: direct.transfer });
      expect(inspected.gameApplyVerified).toBe(false);
    } else {
      expect(inspectTransfer).toBeTypeOf("function");
    }
  });

  it("registers the preview module on the adapter without enabling export", () => {
    const registered = registerSubmenuPreview();
    expect(registered.screen).toBe(SUBMENU_PREVIEW_ID);
    expect(registered.exportEnabled).toBe(false);
    expect(registered.linked).toBe(false);
    const source = readFileSync(new URL("../../src/editor/ui/preview/screens/UISubmenuPreview.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/AppBootstrap|SceneDirector|dream-guardian-save|accessibility|choreography/);
    expect(source).not.toMatch(/from ["'].*\/game\//);
  });
});
