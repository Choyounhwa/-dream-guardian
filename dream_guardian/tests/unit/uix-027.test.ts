import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SETTINGS_BASELINE, cloneSettingsPresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import {
  SETTINGS_CONTRACT,
  SETTINGS_FIXTURES,
  SETTINGS_LOCK_REASONS,
  SETTINGS_PUBLISHED,
  SETTINGS_REGIONS,
  attemptPersistSettings,
} from "../../src/editor/ui/data/screens/UISettingsContract";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  createSettingsPreview,
  registerSettingsPreview,
  roundTripSettings,
} from "../../src/editor/ui/preview/screens/UISettingsPreview";

describe("UIX-027 settings preview edit export", () => {
  it("selects settings into a registry form, undoes, previews, and snapshots", () => {
    const preview = createSettingsPreview();
    const selected = preview.select();
    expect(selected.screen).toBe("settings");
    expect(selected.registry).toMatchObject({ registered: true, exportEnabled: false, supportStatus: "locked" });
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.modal).toEqual(SETTINGS_PUBLISHED.modal);
    expect(selected.form.closeBtn).toEqual(SETTINGS_PUBLISHED.closeBtn);
    expect(selected.form.buttons.camera).toEqual(SETTINGS_PUBLISHED.buttons.camera);

    const edited = preview.edit({ modal: { x: 160, y: 500, w: 800, h: 1080 } });
    expect(edited.ok).toBe(true);
    expect(edited.editEnabled).toBe(false);
    expect(edited.exportEnabled).toBe(false);
    expect(preview.form().modal).toEqual({ x: 160, y: 500, w: 800, h: 1080 });
    expect(preview.form().dirty).toBe(true);

    preview.undo();
    expect(preview.form().modal).toEqual(SETTINGS_PUBLISHED.modal);
    expect(preview.form().dirty).toBe(false);

    const drawn = preview.preview();
    expect(drawn.contextId).toBe("dream-guardian-ui-preview");
    expect(drawn.bootedGame).toBe(false);
    const snapshot = preview.save();
    expect(snapshot.checkpoint.screen).toBe("settings");
    expect(snapshot.checkpoint.settings.modal).toEqual(SETTINGS_PUBLISHED.modal);
    expect(snapshot.checkpoint.settings.closeBtn).toEqual(SETTINGS_PUBLISHED.closeBtn);
  });

  it("round-trips through the shell and calls existing buildTransfer/inspect without enabling export", () => {
    const preview = createSettingsPreview();
    preview.edit({ closeBtn: { x: 860, y: 520, w: 60, h: 60 } });
    const trip = roundTripSettings(preview);
    expect(trip.invoked).toBe(true);
    expect(trip.selected.screen).toBe("settings");
    expect(trip.preview.contextId).toBe("dream-guardian-ui-preview");
    expect(trip.snapshot.checkpoint.settings.closeBtn).toEqual({ x: 860, y: 520, w: 60, h: 60 });
    expect(trip.export.ok).toBe(false);
    if (!trip.export.ok) expect(trip.export.reason).toBe("unregistered-screen-contract");
    expect(trip.inspection.accepted).toBe(false);
    expect(registerSettingsPreview().exportEnabled).toBe(false);
    expect(registerScreenContract(SETTINGS_CONTRACT).accepted).toBe(false);
    expect(registerScreenContract(SETTINGS_CONTRACT).exportEnabled).toBe(false);

    const blocked = buildTransfer({
      checkpoint: trip.snapshot.checkpoint,
      scope: "settings",
      sourceId: "uix-027",
      exportId: "uix-027-export",
      screen: "settings",
      version: SETTINGS_CONTRACT.version,
      previewLinked: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unregistered-screen-contract");
    expect(inspectTransfer({ file: blocked }).accepted).toBe(false);
  });

  it("matches protected regions, coords, and profile across open, closed, large text, and mocked options", () => {
    const preview = createSettingsPreview();
    const ids = ["settings-open", "settings-closed", "settings-large-text", "settings-mocked-options"];
    expect(SETTINGS_FIXTURES.map((fixture) => fixture.id)).toEqual(ids);

    for (const id of ids) {
      const shown = preview.loadFixture(id);
      expect(shown.ok).toBe(true);
      expect(shown.regions).toEqual(SETTINGS_REGIONS);
      expect(shown.form.modal).toEqual(SETTINGS_PUBLISHED.modal);
      expect(shown.form.closeBtn).toEqual(SETTINGS_PUBLISHED.closeBtn);
      expect(shown.form.buttons).toEqual(SETTINGS_PUBLISHED.buttons);
      expect(shown.display.profile).toBe(SETTINGS_CONTRACT.fingerprint);
      expect(shown.display.writesPlayerSettings).toBe(false);
      expect(shown.display.profileInputs).toBe("closed");
      const fixture = SETTINGS_FIXTURES.find((item) => item.id === id);
      expect(shown.display.open).toBe(fixture?.open);
      expect(shown.display.largeText).toBe(fixture?.largeText);
      expect(shown.display.mockedOptions).toBe(fixture?.mockedOptions);
    }

    const preset = cloneSettingsPresetForEdit(SETTINGS_BASELINE.id);
    expect(preset.modal).toEqual(SETTINGS_PUBLISHED.modal);
    expect(preset.settingsWrite.locked).toBe(true);
    expect(lookupScreenContract("settings", "1.0.0", "settings")).toMatchObject({
      registered: true,
      exportEnabled: false,
      supportStatus: "locked",
    });
  });

  it("locks unsupported fields, blocks dangerous callbacks, and does not persist player settings", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => []),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const preview = createSettingsPreview({ storage, bootGame, camera, network, onDanger });

    const locked = preview.edit({
      profile: "open",
      profileInput: true,
      cameraEnabled: true,
      soundEnabled: false,
      localStorage: "dream-guardian-save",
      indexedDB: "accessibility",
      persist: true,
      unknownBaseline: "settings-v9",
    });
    expect(locked.ok).toBe(false);
    expect(locked.editEnabled).toBe(false);
    expect(locked.exportEnabled).toBe(false);
    expect(locked.locks).toContain(SETTINGS_LOCK_REASONS.settingsWriteBlocked);
    expect(locked.locks).toContain(SETTINGS_LOCK_REASONS.profileClosed);
    expect(locked.locks).toContain(SETTINGS_LOCK_REASONS.unknownBaseline);
    expect(preview.form().dirty).toBe(false);
    expect(preview.form().modal).toEqual(SETTINGS_PUBLISHED.modal);

    const unknown = preview.edit({ glow: 1 });
    expect(unknown.ok).toBe(false);
    expect(unknown.locks).toContain(SETTINGS_LOCK_REASONS.unknownField);

    preview.preview();
    preview.save();
    preview.loadFixture("settings-open");
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();

    const persist = attemptPersistSettings("camera", true);
    expect(persist.ok).toBe(false);
    expect(persist.reason).toBe(SETTINGS_LOCK_REASONS.settingsWriteBlocked);
    for (const key of GAME_KEYS_FORBIDDEN) {
      expect(storage.setItem).not.toHaveBeenCalledWith(key, expect.anything());
    }
  });

  it("does not import game bootstrap, camera, SceneDirector, or storage keys", () => {
    const source = readFileSync("src/editor/ui/preview/screens/UISettingsPreview.ts", "utf8");
    const adapter = readFileSync("src/editor/ui/preview/UIPreviewAdapter.ts", "utf8");
    expect(source).not.toMatch(/AppBootstrap|SceneDirector|dream-guardian-save|choreography/);
    expect(source).not.toMatch(/from ["'].*\/(game|camera|motion)\//);
    expect(adapter).toContain("registerSettingsPreview");
    expect(adapter).not.toMatch(/from ["'].*SceneDirector/);
    expect(adapter).not.toMatch(/from ["'].*\/game\//);
    expect(source).toContain("buildTransfer");
    expect(source).toContain("inspectTransfer");
  });
});
