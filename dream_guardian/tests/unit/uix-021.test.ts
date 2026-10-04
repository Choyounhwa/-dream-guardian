import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HUD_BASELINE, cloneHudPresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import {
  HUD_CONTRACT,
  HUD_FIXTURES,
  HUD_LOCK_REASONS,
  HUD_PUBLISHED,
  deriveHudSlot,
} from "../../src/editor/ui/data/screens/UIHUDContract";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  HUD_PREVIEW_ID,
  createHudPreview,
  registerHudPreview,
  roundTripHud,
} from "../../src/editor/ui/preview/screens/UIHUDPreview";

function formOf(preview: ReturnType<typeof createHudPreview>) {
  return preview.form();
}

describe("UIX-021 HUD preview edit export", () => {
  it("selects HUD into a registry form, undoes, previews, and snapshots", () => {
    const preview = createHudPreview();
    const selected = preview.select();
    expect(selected.screen).toBe("hud");
    expect(selected.registry.registered).toBe(true);
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);

    const edited = preview.edit({ bossName: "포겟" });
    expect(edited.ok).toBe(true);
    expect(edited.editEnabled).toBe(false);
    expect(edited.exportEnabled).toBe(false);
    expect(formOf(preview).bossName).toBe("포겟");
    expect(formOf(preview).dirty).toBe(true);
    expect(formOf(preview).playerHpBar).toEqual(cloneHudPresetForEdit(HUD_BASELINE.id).slots.playerHpBar);

    const undone = preview.undo();
    expect(undone.ok).toBe(true);
    expect(formOf(preview).bossName).toBe("");
    expect(formOf(preview).dirty).toBe(false);

    const drawn = preview.preview();
    expect(drawn.linked).toBe(true);
    expect(drawn.profile).toBe(HUD_CONTRACT.fingerprint);
    expect(drawn.protectedRegions).toEqual(HUD_CONTRACT.protectedRegions);
    expect(drawn.coords.playerHpBar).toEqual({
      x: HUD_PUBLISHED.playerHpBar.x,
      y: HUD_PUBLISHED.playerHpBar.y,
      w: HUD_PUBLISHED.playerHpBar.w,
      h: HUD_PUBLISHED.playerHpBar.h,
    });

    const saved = preview.save();
    expect(saved.checkpoint.kind).toBe("dream-guardian-ui-project");
    expect(saved.checkpoint.screen).toBe("hud");
    expect(saved.checkpoint.hud.bossName).toBe("");
    expect(saved.slots.playerHpBar).toEqual(deriveHudSlot("playerHpBar"));
    expect(saved.slots.comboBadge.x).toBe(
      HUD_PUBLISHED.design.width - HUD_PUBLISHED.comboBadge.w - HUD_PUBLISHED.comboBadge.marginRight,
    );
    expect(saved.editEnabled).toBe(false);
    expect(saved.exportEnabled).toBe(false);
  });

  it("round-trips through existing buildTransfer and inspect without enabling export", () => {
    const preview = createHudPreview();
    preview.select();
    preview.edit({ bossName: "후다닥" });
    preview.preview();
    const saved = preview.save();
    const trip = roundTripHud(preview);
    expect(trip.invoked).toBe(true);
    expect(trip.preview.linked).toBe(true);
    expect(trip.snapshot.screen).toBe("hud");
    expect(trip.export.ok).toBe(false);
    if (!trip.export.ok) {
      expect(trip.export.reason).toMatch(/unregistered-screen-contract|unsupported-scope|export blocked|registry-only/i);
    }
    expect(trip.inspection.accepted).toBe(false);
    expect(trip.inspection.gameApplyVerified).toBe(false);
    expect(saved.editEnabled).toBe(false);
    expect(saved.exportEnabled).toBe(false);

    const direct = buildTransfer({
      checkpoint: saved.checkpoint,
      scope: "hud",
      sourceId: "uix-021",
      exportId: "uix-021-export",
      screen: "hud",
      version: HUD_CONTRACT.version,
      previewLinked: true,
    });
    expect(direct).toEqual(trip.export);
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.reason).toBe("unregistered-screen-contract");
    const inspected = inspectTransfer({
      file: { kind: "dream-guardian-ui-transfer", validation: { passed: true } },
    });
    expect(inspected.accepted).toBe(false);
    expect(inspected.gameApplyVerified).toBe(false);
    expect(inspectTransfer).toBeTypeOf("function");
  });

  it("keeps protected regions, coords, and profile across HP0, HP max, mana, and long combo", () => {
    const baseline = cloneHudPresetForEdit(HUD_BASELINE.id);
    for (const fixture of HUD_FIXTURES) {
      const preview = createHudPreview();
      preview.select();
      const applied = preview.applyFixture(fixture.id);
      expect(applied.ok).toBe(true);
      expect(applied.editEnabled).toBe(false);
      expect(applied.exportEnabled).toBe(false);
      const drawn = preview.preview();
      expect(drawn.protectedRegions).toEqual(HUD_CONTRACT.protectedRegions);
      expect(drawn.profile).toBe(HUD_CONTRACT.fingerprint);
      expect(drawn.profile).toBe(HUD_BASELINE.rendererFingerprint);
      expect(drawn.coords.playerHpBar).toEqual(baseline.slots.playerHpBar);
      expect(drawn.coords.bossHpBar).toEqual(baseline.slots.bossHpBar);
      expect(drawn.coords.combo).toEqual(baseline.slots.combo);
      expect(drawn.coords.bossName).toEqual(baseline.slots.bossName);
      expect(drawn.coords.comboBadge).toEqual(baseline.slots.comboBadge);
      expect(drawn.fixtureId).toBe(fixture.id);
      const form = formOf(preview);
      expect(form.playerHpBar).toEqual(baseline.slots.playerHpBar);
      expect(form.bossHpBar).toEqual(baseline.slots.bossHpBar);
      expect(form.combo).toEqual(baseline.slots.combo);
      expect(form.bossNameSlot).toEqual(baseline.slots.bossName);
      expect(form.comboBadge).toEqual(baseline.slots.comboBadge);
      expect(form.display.playerHp).toBe(fixture.playerHp);
      expect(form.display.playerMaxHp).toBe(fixture.playerMaxHp);
      expect(form.display.mana).toBe(fixture.mana);
      expect(form.display.combo).toBe(fixture.combo);
      expect(form.display.profile).toBe(fixture.profile);
      if (fixture.id === "hud-long-combo") {
        expect(String(form.display.combo).length).toBeGreaterThan(6);
        expect(fixture.label.length).toBeGreaterThan(20);
      }
    }
  });

  it("locks unsupported fields and does not touch game storage, callbacks, or boot", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => ["dream-guardian-save", "settings", "accessibility", "choreography"]),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const preview = createHudPreview({ storage, bootGame, camera, network, onDanger });
    const locked = preview.edit({
      hp: 0,
      mana: 100,
      color: "#fff",
      file: "a.png",
      unknownBaseline: "x",
      fillPercent: 50,
    });
    expect(locked.ok).toBe(false);
    expect(locked.editEnabled).toBe(false);
    expect(locked.exportEnabled).toBe(false);
    expect(locked.locks).toContain(HUD_LOCK_REASONS.computedPlacement);
    expect(locked.locks).toContain(HUD_LOCK_REASONS.arbitraryColor);
    expect(locked.locks).toContain(HUD_LOCK_REASONS.assetPath);
    expect(locked.locks).toContain(HUD_LOCK_REASONS.unknownBaseline);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    for (const key of ["settings", "dream-guardian-save", "accessibility", "choreography", ...GAME_KEYS_FORBIDDEN]) {
      expect(storage.setItem.mock.calls.map((call) => call[0])).not.toContain(key);
    }

    const registered = registerHudPreview();
    expect(registered.screen).toBe(HUD_PREVIEW_ID);
    expect(registered.editEnabled).toBe(false);
    expect(registered.exportEnabled).toBe(false);
    expect(registered.linked).toBe(false);
    const again = registerScreenContract({ screen: "hud", version: HUD_CONTRACT.version, scope: "hud" });
    expect(again.editEnabled).toBe(false);
    expect(again.exportEnabled).toBe(false);
    const looked = lookupScreenContract("hud", HUD_CONTRACT.version, "hud");
    if ("exportEnabled" in looked) expect(looked.exportEnabled).toBe(false);
    if ("supportStatus" in looked) expect(looked.supportStatus).toBe("locked");
  });

  it("does not import game bootstrap, camera, or SceneDirector", () => {
    const source = readFileSync(new URL("../../src/editor/ui/preview/screens/UIHUDPreview.ts", import.meta.url), "utf8");
    const adapter = readFileSync(new URL("../../src/editor/ui/preview/UIPreviewAdapter.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/AppBootstrap|SceneDirector|dream-guardian-save|accessibility|choreography|settings/);
    expect(source).not.toMatch(/from ["'].*\/(game|camera|motion)\//);
    expect(adapter).not.toMatch(/from ["'].*SceneDirector/);
    expect(adapter).not.toMatch(/from ["'].*\/game\//);
  });
});
