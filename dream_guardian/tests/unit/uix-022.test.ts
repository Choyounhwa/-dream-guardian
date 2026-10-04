import { describe, expect, it } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import {
  BASELINE_REGISTRY,
  BOTTOM_BAR_BASELINE,
  HUD_BASELINE,
  SUBMENU_BASELINE,
  cloneBottomBarPresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  BOTTOM_BAR_SCREEN_ID,
  lookupScreenContract,
  registerScreenContract,
  resolveBottomBarProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  BOTTOM_BAR_CONTRACT,
  BOTTOM_BAR_FIXTURES,
  BOTTOM_BAR_LOCK_REASONS,
  BOTTOM_BAR_PUBLISHED,
  rejectButtonOverlap,
} from "../../src/editor/ui/data/screens/UIBottomBarContract";

describe("UIX-022 bottom bar support contract", () => {
  it("locks published settings/action/mana regions and a distinct pause slot", () => {
    expect(BOTTOM_BAR_CONTRACT.screen).toBe("bottomBar");
    expect(BOTTOM_BAR_SCREEN_ID).toBe("bottomBar");
    expect(BOTTOM_BAR_CONTRACT.version).toBe("1.0.0");
    expect(BOTTOM_BAR_PUBLISHED.design).toEqual({ width: 1080, height: 2160 });
    expect(BOTTOM_BAR_PUBLISHED.bounds).toEqual({ x: 0, y: 1960, w: 1080, h: 200 });
    expect(BOTTOM_BAR_PUBLISHED.height).toBe(200);
    expect(BOTTOM_BAR_PUBLISHED.settingsBtn).toEqual({ x: 30, y: 1990, w: 140, h: 140 });
    expect(BOTTOM_BAR_PUBLISHED.actionBtn).toEqual({ x: 810, y: 1990, w: 240, h: 140 });
    expect(BOTTOM_BAR_PUBLISHED.manaBar).toEqual({ x: 210, y: 2038, w: 560, h: 50 });
    expect(BOTTOM_BAR_CONTRACT.supportStatus).toBe("locked");
    expect(BOTTOM_BAR_CONTRACT.editEnabled).toBe(false);
    expect(BOTTOM_BAR_CONTRACT.exportEnabled).toBe(false);
    expect(BOTTOM_BAR_CONTRACT.actionSlot).toBe("shared");

    const regions = BOTTOM_BAR_CONTRACT.protectedRegions;
    expect(regions.map((region) => region.id)).toEqual([
      "bottom-bar-settings",
      "bottom-bar-action",
      "bottom-bar-pause",
      "bottom-bar-mana",
    ]);
    expect(regions.find((region) => region.id === "bottom-bar-settings")).toMatchObject({
      x: 30,
      y: 1990,
      width: 140,
      height: 140,
      priority: 1,
      role: "settings",
      locked: false,
    });
    expect(regions.find((region) => region.id === "bottom-bar-action")).toMatchObject({
      x: 810,
      y: 1990,
      width: 240,
      height: 140,
      priority: 2,
      role: "workout",
      locked: false,
    });
    expect(regions.find((region) => region.id === "bottom-bar-pause")).toMatchObject({
      priority: 3,
      role: "pause",
      locked: true,
      reason: BOTTOM_BAR_LOCK_REASONS.sharedActionSlot,
    });
    expect(BOTTOM_BAR_LOCK_REASONS.sharedActionSlot).toBe(
      "no independent pause slot in published layout; actionBtn is shared",
    );
    expect(regions.find((region) => region.id === "bottom-bar-mana")).toMatchObject({
      x: 210,
      y: 2038,
      width: 560,
      height: 50,
      role: "mana",
    });

    const pause = resolveBottomBarProperty("pause");
    expect(pause).toEqual({
      status: "locked",
      reason: BOTTOM_BAR_LOCK_REASONS.sharedActionSlot,
      exportEnabled: false,
    });
    expect(rejectButtonOverlap(regions)).toEqual({
      ok: false,
      reason: BOTTOM_BAR_LOCK_REASONS.buttonOverlap,
    });
  });

  it("fixes units, ranges, baseline hash, fixtures, and closed profile inputs", () => {
    expect(BOTTOM_BAR_CONTRACT.units).toEqual({ length: "px", design: "1080x2160" });
    expect(BOTTOM_BAR_CONTRACT.ranges.x).toEqual({ min: 0, max: 1080 });
    expect(BOTTOM_BAR_CONTRACT.ranges.y).toEqual({ min: 0, max: 2160 });

    expect(BOTTOM_BAR_BASELINE.id).toBe("bottom-bar-v1");
    expect(BOTTOM_BAR_BASELINE.version).toBe("1.0.0");
    expect(BOTTOM_BAR_BASELINE.preset.design).toEqual({ width: 1080, height: 2160 });
    expect(BOTTOM_BAR_BASELINE.preset.settingsBtn).toEqual({ x: 30, y: 1990, w: 140, h: 140 });
    expect(BOTTOM_BAR_BASELINE.preset.actionBtn).toEqual({ x: 810, y: 1990, w: 240, h: 140 });
    expect(BOTTOM_BAR_BASELINE.preset.manaBar).toEqual({ x: 210, y: 2038, w: 560, h: 50 });
    expect(BOTTOM_BAR_BASELINE.preset.pause.locked).toBe(true);
    expect(BOTTOM_BAR_BASELINE.presetHash).toBe(contentHash(BOTTOM_BAR_BASELINE.preset));
    expect(cloneBottomBarPresetForEdit("bottom-bar-v1")).toEqual(BOTTOM_BAR_BASELINE.preset);
    expect(cloneBottomBarPresetForEdit("bottom-bar-v1")).not.toBe(BOTTOM_BAR_BASELINE.preset);
    expect(() => cloneBottomBarPresetForEdit("unknown")).toThrow(/unknown baseline/);

    expect(BOTTOM_BAR_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "bottom-bar-visibility",
      "bottom-bar-workout",
      "bottom-bar-overlap",
    ]);
    expect(BOTTOM_BAR_FIXTURES.every((fixture) => fixture.closed && fixture.screen === "bottomBar")).toBe(true);
    expect(BOTTOM_BAR_FIXTURES.find((fixture) => fixture.id === "bottom-bar-visibility")).toMatchObject({
      profile: "visibility",
      visible: false,
    });
    expect(BOTTOM_BAR_FIXTURES.find((fixture) => fixture.id === "bottom-bar-workout")).toMatchObject({
      profile: "workout",
      action: "workout",
    });
    expect(BOTTOM_BAR_FIXTURES.find((fixture) => fixture.id === "bottom-bar-overlap")).toMatchObject({
      profile: "button-overlap",
      rejected: true,
    });

    const profile = resolveBottomBarProperty("profile");
    expect(profile).toEqual({
      status: "locked",
      reason: BOTTOM_BAR_LOCK_REASONS.profileClosed,
      exportEnabled: false,
    });
    expect(BOTTOM_BAR_BASELINE.presetHash).not.toBe(HUD_BASELINE.presetHash);
    expect(BOTTOM_BAR_BASELINE.presetHash).not.toBe(SUBMENU_BASELINE.presetHash);
    expect(BASELINE_REGISTRY.presetHash).not.toBe(BOTTOM_BAR_BASELINE.presetHash);
  });

  it("locks unknown fields, blocks export, and keeps menu/submenu/hud contracts", () => {
    const unknown = resolveBottomBarProperty("color");
    expect(unknown).toEqual({
      status: "locked",
      reason: BOTTOM_BAR_LOCK_REASONS.unknownField,
      exportEnabled: false,
    });
    const path = resolveBottomBarProperty("assetPath");
    expect(path.status).toBe("locked");
    expect(path.exportEnabled).toBe(false);

    const found = lookupScreenContract("bottomBar", "1.0.0", "bottomBar");
    expect(found).toMatchObject({
      registered: true,
      screen: "bottomBar",
      version: "1.0.0",
      supportStatus: "locked",
      editEnabled: false,
      exportEnabled: false,
    });
    expect(registerScreenContract({ screen: "bottomBar", version: "1.0.0", scope: "bottomBar" })).toEqual({
      accepted: false,
      editEnabled: false,
      exportEnabled: false,
    });

    expect(lookupScreenContract("menu", "1.0.0", "menu")).toMatchObject({
      screen: "menu",
      supportStatus: "supported",
    });
    expect(lookupScreenContract("submenu", "1.0.0", "submenu")).toMatchObject({ screen: "submenu" });
    expect(lookupScreenContract("hud", "1.0.0", "hud")).toMatchObject({
      screen: "hud",
      supportStatus: "locked",
    });
    expect(HUD_BASELINE.id).toBe("hud-v1");
    expect(SUBMENU_BASELINE.id).toBe("submenu-v1");
    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
  });
});
