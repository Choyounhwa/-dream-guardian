import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BOTTOM_BAR_BASELINE, cloneBottomBarPresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import {
  BOTTOM_BAR_CONTRACT,
  BOTTOM_BAR_FIXTURES,
  BOTTOM_BAR_LOCK_REASONS,
  BOTTOM_BAR_PUBLISHED,
  rejectButtonOverlap,
} from "../../src/editor/ui/data/screens/UIBottomBarContract";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  BOTTOM_BAR_PREVIEW_ID,
  createBottomBarPreview,
  registerBottomBarPreview,
  roundTripBottomBar,
} from "../../src/editor/ui/preview/screens/UIBottomBarPreview";

describe("UIX-023 bottom bar preview edit export", () => {
  it("selects bottom bar into a registry form, undoes, previews, and snapshots", () => {
    const preview = createBottomBarPreview();
    const selected = preview.select();
    expect(selected.screen).toBe("bottomBar");
    expect(selected.registry.registered).toBe(true);
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.visible).toBe(true);

    const edited = preview.edit({ visible: false });
    expect(edited.ok).toBe(true);
    expect(edited.editEnabled).toBe(false);
    expect(edited.exportEnabled).toBe(false);
    expect(preview.form().visible).toBe(false);
    expect(preview.form().dirty).toBe(true);

    preview.undo();
    expect(preview.form().visible).toBe(true);
    expect(preview.form().dirty).toBe(false);

    const drawn = preview.preview();
    expect(drawn.contextId).toBe("dream-guardian-ui-preview");
    expect(drawn.linked).toBe(true);
    expect(drawn.protectedRegions).toEqual(BOTTOM_BAR_CONTRACT.protectedRegions);
    expect(drawn.coords.settingsBtn).toEqual(BOTTOM_BAR_PUBLISHED.settingsBtn);
    expect(drawn.coords.actionBtn).toEqual(BOTTOM_BAR_PUBLISHED.actionBtn);
    expect(drawn.coords.manaBar).toEqual(BOTTOM_BAR_PUBLISHED.manaBar);

    const saved = preview.save();
    expect(saved.exportEnabled).toBe(false);
    expect(saved.editEnabled).toBe(false);
    expect(saved.checkpoint.kind).toBe("dream-guardian-ui-project");
    expect(saved.checkpoint.screen).toBe("bottomBar");
    expect(saved.checkpoint.bottomBar.settingsBtn).toEqual(BOTTOM_BAR_PUBLISHED.settingsBtn);
  });

  it("preserves protected regions, coords, and profiles across visibility, workout, and overlap", () => {
    const baseline = cloneBottomBarPresetForEdit(BOTTOM_BAR_BASELINE.id);
    for (const fixture of BOTTOM_BAR_FIXTURES) {
      const preview = createBottomBarPreview();
      const applied = preview.applyFixture(fixture.id);
      expect(applied.ok).toBe(true);
      expect(applied.exportEnabled).toBe(false);
      const form = preview.form();
      expect(form.display.profile).toBe(fixture.profile);
      expect(form.settingsBtn).toEqual(baseline.settingsBtn);
      expect(form.actionBtn).toEqual(baseline.actionBtn);
      expect(form.manaBar).toEqual(baseline.manaBar);
      expect(form.editEnabled).toBe(false);
      expect(form.exportEnabled).toBe(false);
      const drawn = preview.preview();
      expect(drawn.protectedRegions).toEqual(BOTTOM_BAR_CONTRACT.protectedRegions);
      expect(drawn.profile).toBe(BOTTOM_BAR_CONTRACT.fingerprint);
      expect(drawn.fixtureId).toBe(fixture.id);
      if (fixture.id === "bottom-bar-visibility") expect(form.visible).toBe(false);
      if (fixture.id === "bottom-bar-workout") expect(form.display.action).toBe("workout");
      if (fixture.id === "bottom-bar-overlap") {
        expect(form.display.overlapRejected).toBe(true);
        expect(rejectButtonOverlap()).toEqual({ ok: false, reason: BOTTOM_BAR_LOCK_REASONS.buttonOverlap });
      }
    }
  });

  it("round-trips a saved snapshot through existing buildTransfer and inspect without enabling export", () => {
    const preview = createBottomBarPreview();
    preview.select();
    preview.edit({ visible: false });
    const saved = preview.save();
    expect(saved.checkpoint.bottomBar.visible).toBe(false);
    expect(saved.exportEnabled).toBe(false);

    const trip = roundTripBottomBar(preview);
    expect(trip.invoked).toBe(true);
    expect(trip.export.ok).toBe(false);
    if (trip.export.ok) return;
    expect(trip.export.reason).toBe("unregistered-screen-contract");
    expect(trip.inspection.accepted).toBe(false);

    const direct = buildTransfer({
      checkpoint: saved.checkpoint,
      scope: "bottomBar",
      sourceId: "uix-023",
      exportId: "uix-023-export",
      screen: "bottomBar",
      version: "1.0.0",
      previewLinked: true,
    });
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.reason).toBe("unregistered-screen-contract");
    expect(inspectTransfer({ file: direct, originalCheckpoint: saved.checkpoint }).accepted).toBe(false);
    expect(registerScreenContract({ screen: "bottomBar", version: "1.0.0", scope: "bottomBar" }).exportEnabled).toBe(false);
    expect(lookupScreenContract("bottomBar", "1.0.0", "bottomBar")).toMatchObject({
      supportStatus: "locked",
      exportEnabled: false,
    });
  });

  it("locks unsupported fields and never boots the game or touches game storage keys", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => [] as string[]),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const preview = createBottomBarPreview({ storage, bootGame, camera, network, onDanger });

    const locked = preview.edit({ pause: { x: 1 }, color: "#fff", assetPath: "a.png", profile: "open" });
    expect(locked.ok).toBe(false);
    expect(locked.locks).toContain(BOTTOM_BAR_LOCK_REASONS.sharedActionSlot);
    expect(locked.locks).toContain(BOTTOM_BAR_LOCK_REASONS.unknownField);
    expect(locked.locks).toContain(BOTTOM_BAR_LOCK_REASONS.assetPath);
    expect(locked.locks).toContain(BOTTOM_BAR_LOCK_REASONS.profileClosed);
    expect(locked.exportEnabled).toBe(false);
    expect(preview.form().settingsBtn).toEqual(BOTTOM_BAR_PUBLISHED.settingsBtn);

    preview.preview();
    preview.save();
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    for (const key of GAME_KEYS_FORBIDDEN) {
      expect(storage.getItem).not.toHaveBeenCalledWith(key);
    }

    const registered = registerBottomBarPreview();
    expect(registered.screen).toBe(BOTTOM_BAR_PREVIEW_ID);
    expect(registered.exportEnabled).toBe(false);
    expect(registered.editEnabled).toBe(false);
    expect(registered.linked).toBe(false);
  });

  it("calls existing transfer APIs without game boot, storage keys, or shell edits", () => {
    const source = readFileSync(new URL("../../src/editor/ui/preview/screens/UIBottomBarPreview.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/AppBootstrap|localStorage|sessionStorage|indexedDB/);
    expect(source).not.toMatch(/dream-guardian-save|accessibility|choreography|ui-config/);
    expect(source).toMatch(/buildTransfer/);
    expect(source).toMatch(/inspectTransfer/);
    expect(source).not.toMatch(/UIEditorShell/);
  });
});
