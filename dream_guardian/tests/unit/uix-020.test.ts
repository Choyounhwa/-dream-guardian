import { describe, expect, it } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import {
  BASELINE_REGISTRY,
  HUD_BASELINE,
  SUBMENU_BASELINE,
  cloneHudPresetForEdit,
  clonePresetForEdit,
  cloneSubmenuPresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  HUD_SCREEN_ID,
  lookupScreenContract,
  registerScreenContract,
  resolveHudProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  HUD_CONTRACT,
  HUD_FIXTURES,
  HUD_LOCK_REASONS,
  HUD_PUBLISHED,
  HUD_SLOT_IDS,
  deriveHudSlot,
} from "../../src/editor/ui/data/screens/UIHUDContract";

describe("UIX-020 HUD support contract", () => {
  it("supports published display slots and locks computed HP/mana/combo placement", () => {
    expect(HUD_CONTRACT.screen).toBe("hud");
    expect(HUD_SCREEN_ID).toBe("hud");
    expect(HUD_PUBLISHED.design).toEqual({ width: 1080, height: 2160 });
    expect(HUD_PUBLISHED.bounds).toEqual({ x: 0, y: 0, w: 1080, h: 200 });
    expect(HUD_CONTRACT.placement).toBe("slots");
    expect(HUD_CONTRACT.supportStatus).toBe("locked");
    expect(HUD_CONTRACT.editEnabled).toBe(false);
    expect(HUD_CONTRACT.exportEnabled).toBe(false);

    const player = deriveHudSlot("playerHpBar");
    expect(player).toEqual({ id: "hud-player-hp-bar", x: 20, y: 20, width: 320, height: 32 });
    const boss = deriveHudSlot("bossHpBar");
    expect(boss).toEqual({ id: "hud-boss-hp-bar", x: 740, y: 20, width: 320, height: 32 });
    const combo = deriveHudSlot("combo");
    expect(combo).toEqual({ id: "hud-combo", x: 540, y: 120, width: 200, height: 60 });
    const bossName = deriveHudSlot("bossName");
    expect(bossName).toEqual({ id: "hud-boss-name", x: 740, y: 60, width: 320, height: 30 });
    const badge = deriveHudSlot("comboBadge");
    expect(badge).toEqual({ id: "hud-combo-badge", x: 896, y: 48, width: 160, height: 48 });
    expect(badge.x).toBe(1080 - HUD_PUBLISHED.comboBadge.w - HUD_PUBLISHED.comboBadge.marginRight);

    expect(resolveHudProperty("playerHpBar").locked).toBe(false);
    expect(resolveHudProperty("playerHp").locked).toBe(true);
    expect(resolveHudProperty("playerHp").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("hp").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("damage").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("mana").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("bossHp").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("spellDamage").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("fillPercent").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
    expect(resolveHudProperty("computedFill").reason).toBe(HUD_LOCK_REASONS.computedPlacement);
  });

  it("fixes units, ranges, baseline hash, protected regions, and closed fixtures", () => {
    expect(HUD_CONTRACT.units).toEqual({ length: "px", design: "1080x2160" });
    expect(HUD_CONTRACT.ranges.x).toEqual({ min: 0, max: 1080 });
    expect(HUD_CONTRACT.ranges.y).toEqual({ min: 0, max: 2160 });
    expect(HUD_CONTRACT.ranges.width).toEqual({ min: 1, max: 1080 });
    expect(HUD_CONTRACT.ranges.height).toEqual({ min: 1, max: 2160 });
    expect(HUD_SLOT_IDS).toEqual([
      "hud-player-hp-bar",
      "hud-boss-hp-bar",
      "hud-combo",
      "hud-boss-name",
      "hud-combo-badge",
    ]);
    expect(HUD_CONTRACT.protectedRegions.map((region) => region.id)).toEqual([...HUD_SLOT_IDS]);
    const playerRegion = HUD_CONTRACT.protectedRegions.find((region) => region.id === "hud-player-hp-bar");
    expect(playerRegion).toEqual({ id: "hud-player-hp-bar", x: 20, y: 20, width: 320, height: 32 });

    expect(HUD_BASELINE.id).toBe("hud-v1");
    expect(HUD_BASELINE.presetHash).toBe(contentHash(HUD_BASELINE.preset));
    expect(HUD_BASELINE.preset.slots.playerHpBar).toEqual({ x: 20, y: 20, w: 320, h: 32 });
    expect(HUD_BASELINE.rendererFingerprint).toBe("hud-slots-v1");
    const frozen = HUD_BASELINE.preset;
    const hash = HUD_BASELINE.presetHash;
    const clone = cloneHudPresetForEdit("hud-v1");
    clone.slots.playerHpBar.x = 1;
    expect(frozen.slots.playerHpBar.x).toBe(20);
    expect(contentHash(frozen)).toBe(hash);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => cloneHudPresetForEdit("unknown-hud")).toThrow(/unknown baseline/);

    expect(HUD_FIXTURES.map((fixture) => fixture.profile)).toEqual(["hp-zero", "hp-max", "mana", "long-combo"]);
    expect(HUD_FIXTURES.every((fixture) => fixture.closed && fixture.screen === "hud")).toBe(true);
    const longCombo = HUD_FIXTURES.find((fixture) => fixture.profile === "long-combo");
    expect(longCombo?.label.length).toBeGreaterThan(40);
    expect(HUD_FIXTURES.find((fixture) => fixture.profile === "hp-zero")?.playerHp).toBe(0);
    expect(HUD_FIXTURES.find((fixture) => fixture.profile === "hp-max")?.playerHp).toBe(100);
    expect(HUD_FIXTURES.find((fixture) => fixture.profile === "mana")?.mana).toBe(100);
  });

  it("registers only supportable consumers and blocks unknown baselines and export", () => {
    const lookedUp = lookupScreenContract("hud", "1.0.0", "hud");
    if (!("exportEnabled" in lookedUp)) throw new Error("hud contract missing");
    expect(lookedUp.registered).toBe(true);
    expect(lookedUp.supportStatus).toBe("locked");
    expect(lookedUp.editEnabled).toBe(false);
    expect(lookedUp.exportEnabled).toBe(false);
    expect(lookedUp.fingerprint).toBe("hud-slots-v1");
    expect(registerScreenContract({ screen: "hud", version: "9.9.9", scope: "hud" }).accepted).toBe(false);
    expect(lookupScreenContract("hud", "9.9.9", "hud").registered).toBe(false);

    expect(resolveHudProperty("color").reason).toBe(HUD_LOCK_REASONS.arbitraryColor);
    expect(resolveHudProperty("src").reason).toBe(HUD_LOCK_REASONS.assetPath);
    expect(resolveHudProperty("mystery").reason).toBe(HUD_LOCK_REASONS.unknownField);
    expect(resolveHudProperty("unknownBaseline").reason).toBe(HUD_LOCK_REASONS.unknownBaseline);
    expect(resolveHudProperty("playerHpBar").exportEnabled).toBe(false);
    expect(resolveHudProperty("hp").exportEnabled).toBe(false);
    expect(HUD_CONTRACT.lockReasons.exportBlocked).toBe("hud-lock:export-blocked-until-preview");
    expect(HUD_CONTRACT.lockReasons.previewUnlinked).toBe("hud-lock:preview-unlinked");

    expect(lookupScreenContract("menu", "1.0.0", "menu").registered).toBe(true);
    expect(lookupScreenContract("submenu", "1.0.0", "submenu").registered).toBe(true);
    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
    expect(SUBMENU_BASELINE.id).toBe("submenu-v1");
    expect(clonePresetForEdit("menu-v1").width).toBe(280);
    expect(cloneSubmenuPresetForEdit("submenu-v1").grid.startX).toBe(80);
  });
});
