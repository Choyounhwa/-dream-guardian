import { describe, expect, it } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import { LIMITS } from "../../src/editor/ui/data/UIContracts";
import {
  BASELINE_REGISTRY,
  BOTTOM_BAR_BASELINE,
  HUD_BASELINE,
  RESULT_BASELINE,
  SETTINGS_BASELINE,
  SUBMENU_BASELINE,
  cloneSettingsPresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  SETTINGS_SCREEN_ID,
  lookupScreenContract,
  registerScreenContract,
  resolveSettingsProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  SETTINGS_CONTRACT,
  SETTINGS_FIXTURES,
  SETTINGS_LOCK_REASONS,
  SETTINGS_PUBLISHED,
  attemptPersistSettings,
  rejectSettingsExport,
} from "../../src/editor/ui/data/screens/UISettingsContract";

describe("UIX-026 settings modal support contract", () => {
  it("locks published modal/close/button slots as display-only fixtures", () => {
    expect(SETTINGS_CONTRACT.screen).toBe("settings");
    expect(SETTINGS_SCREEN_ID).toBe("settings");
    expect(SETTINGS_CONTRACT.version).toBe("1.0.0");
    expect(SETTINGS_PUBLISHED.design).toEqual({ width: 1080, height: 2160 });
    expect(SETTINGS_PUBLISHED.bounds).toEqual({ x: 140, y: 480, w: 800, h: 1080 });
    expect(SETTINGS_PUBLISHED.modal).toEqual({ x: 140, y: 480, w: 800, h: 1080 });
    expect(SETTINGS_PUBLISHED.closeBtn).toEqual({ x: 850, y: 510, w: 60, h: 60 });
    expect(SETTINGS_PUBLISHED.buttons.camera).toEqual({ x: 200, y: 620, w: 680, h: 110 });
    expect(SETTINGS_PUBLISHED.buttons.fullscreen).toEqual({ x: 200, y: 750, w: 680, h: 110 });
    expect(SETTINGS_PUBLISHED.buttons.skeleton).toEqual({ x: 200, y: 880, w: 680, h: 110 });
    expect(SETTINGS_PUBLISHED.buttons.sound).toEqual({ x: 200, y: 1010, w: 680, h: 110 });
    expect(SETTINGS_PUBLISHED.buttons.locomotion).toEqual({ x: 200, y: 1140, w: 680, h: 110 });
    expect(SETTINGS_PUBLISHED.buttons.fontScale).toEqual({ x: 200, y: 1270, w: 680, h: 110 });
    expect(SETTINGS_PUBLISHED.buttons.highContrast).toEqual({ x: 200, y: 1400, w: 680, h: 110 });
    expect(SETTINGS_CONTRACT.supportStatus).toBe("locked");
    expect(SETTINGS_CONTRACT.editEnabled).toBe(false);
    expect(SETTINGS_CONTRACT.exportEnabled).toBe(false);
    expect(SETTINGS_CONTRACT.units).toEqual({ length: "px", design: "1080x2160" });
    expect(SETTINGS_CONTRACT.profileInputs).toBe("closed");
    expect(SETTINGS_CONTRACT.protectedRegions.map((region) => region.id)).toEqual([
      "settings-modal",
      "settings-close",
      "settings-camera",
      "settings-fullscreen",
      "settings-skeleton",
      "settings-sound",
      "settings-locomotion",
      "settings-font-scale",
      "settings-high-contrast",
    ]);
    expect(SETTINGS_CONTRACT.protectedRegions.every((region) => region.locked)).toBe(true);
    expect(SETTINGS_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "settings-open",
      "settings-closed",
      "settings-large-text",
      "settings-mocked-options",
    ]);
    expect(SETTINGS_FIXTURES.find((fixture) => fixture.id === "settings-large-text")?.largeText).toBe(true);
    expect(SETTINGS_FIXTURES.every((fixture) => fixture.writesPlayerSettings === false)).toBe(true);
  });

  it("blocks player settings persist and export, and locks unknown fields", () => {
    for (const key of ["camera", "sound", "accessibility", "fontScale", "highContrast", "localStorage", "indexedDB"]) {
      const blocked = attemptPersistSettings(key, true);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toBe(SETTINGS_LOCK_REASONS.settingsWriteBlocked);
    }
    expect(rejectSettingsExport().ok).toBe(false);
    expect(rejectSettingsExport().reason).toBe(SETTINGS_LOCK_REASONS.exportBlocked);
    expect(resolveSettingsProperty("profile").reason).toBe(SETTINGS_LOCK_REASONS.profileClosed);
    expect(resolveSettingsProperty("unknownBaseline").reason).toBe(SETTINGS_LOCK_REASONS.unknownBaseline);
    expect(resolveSettingsProperty("renderer")).toEqual({
      ok: false,
      locked: true,
      reason: SETTINGS_LOCK_REASONS.unknownField,
    });
    const registered = registerScreenContract(SETTINGS_CONTRACT);
    expect(registered.accepted).toBe(false);
    expect(registered.editEnabled).toBe(false);
    expect(registered.exportEnabled).toBe(false);
    expect(lookupScreenContract("settings", "1.0.0", "settings").registered).toBe(true);
    expect(lookupScreenContract("settings", "9.9.9", "settings").registered).toBe(false);
  });

  it("keeps a settings baseline hash and does not replace prior baselines", () => {
    expect(SETTINGS_BASELINE.id).toBe("settings-v1");
    expect(SETTINGS_BASELINE.version).toBe("1.0.0");
    expect(SETTINGS_BASELINE.presetHash).toBe(contentHash(SETTINGS_BASELINE.preset));
    expect(SETTINGS_BASELINE.presetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(SETTINGS_BASELINE.preset.modal).toEqual(SETTINGS_PUBLISHED.modal);
    expect(SETTINGS_BASELINE.preset.settingsWrite.locked).toBe(true);
    expect(cloneSettingsPresetForEdit("settings-v1").buttons.sound).toEqual(SETTINGS_PUBLISHED.buttons.sound);
    expect(() => cloneSettingsPresetForEdit("missing")).toThrow(/unknown baseline/);
    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
    expect(SUBMENU_BASELINE.id).toBe("submenu-v1");
    expect(HUD_BASELINE.id).toBe("hud-v1");
    expect(BOTTOM_BAR_BASELINE.id).toBe("bottom-bar-v1");
    expect(RESULT_BASELINE.id).toBe("result-v1");
    expect(LIMITS.maxBytes).toBe(1024 * 1024);
    expect(LIMITS.maxDepth).toBe(16);
    expect(LIMITS.maxNameLength).toBe(80);
  });
});
