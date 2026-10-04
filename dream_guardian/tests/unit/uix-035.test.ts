import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { TEXT_STYLE_BASELINE, cloneTextStylePresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import {
  TEXT_STYLE_CONTRACT,
  TEXT_STYLE_FIXTURES,
  TEXT_STYLE_LOCK_REASONS,
  TEXT_STYLE_PUBLISHED,
  TEXT_STYLE_ROLES,
} from "../../src/editor/ui/data/styles/UITextStyleContract";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  createTextStylePreview,
  registerTextStylePreview,
  roundTripTextStyle,
} from "../../src/editor/ui/preview/styles/UITextStylePreview";

describe("UIX-035 text style preview edit export", () => {
  it("selects text style into a registry form, undoes, previews, and snapshots", () => {
    const preview = createTextStylePreview();
    const selected = preview.select();
    expect(selected.screen).toBe("textStyle");
    expect(selected.registry).toMatchObject({ registered: true, exportEnabled: false, supportStatus: "locked" });
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.roles.hero).toEqual(TEXT_STYLE_PUBLISHED.roles.hero);
    expect(selected.form.roles.body).toEqual(TEXT_STYLE_PUBLISHED.roles.body);
    expect(selected.form.roles.caption).toEqual(TEXT_STYLE_PUBLISHED.roles.caption);

    const edited = preview.edit({ hero: { base: 88, min: 36, weight: "bold" } });
    expect(edited.ok).toBe(true);
    expect(edited.editEnabled).toBe(false);
    expect(edited.exportEnabled).toBe(false);
    expect(preview.form().roles.hero).toEqual({ base: 88, min: 36, weight: "bold" });
    expect(preview.form().dirty).toBe(true);

    preview.undo();
    expect(preview.form().roles.hero).toEqual(TEXT_STYLE_PUBLISHED.roles.hero);
    expect(preview.form().dirty).toBe(false);

    const drawn = preview.preview();
    expect(drawn.contextId).toBe("dream-guardian-ui-preview");
    expect(drawn.bootedGame).toBe(false);
    expect(drawn.fingerprint).toBe(TEXT_STYLE_CONTRACT.fingerprint);
    const snapshot = preview.save();
    expect(snapshot.checkpoint.screen).toBe("textStyle");
    expect(snapshot.checkpoint.textStyle.roles.hero).toEqual(TEXT_STYLE_PUBLISHED.roles.hero);
    expect(snapshot.checkpoint.textStyle.roles.caption).toEqual(TEXT_STYLE_PUBLISHED.roles.caption);
  });

  it("round-trips through the shell and calls existing buildTransfer/inspect without enabling export", () => {
    const preview = createTextStylePreview();
    preview.edit({ body: { base: 32, min: 20, weight: "normal" } });
    const trip = roundTripTextStyle(preview);
    expect(trip.invoked).toBe(true);
    expect(trip.selected.screen).toBe("textStyle");
    expect(trip.preview.contextId).toBe("dream-guardian-ui-preview");
    expect(trip.snapshot.checkpoint.textStyle.roles.body).toEqual({ base: 32, min: 20, weight: "normal" });
    expect(trip.export.ok).toBe(false);
    if (!trip.export.ok) expect(trip.export.reason).toBe("unregistered-screen-contract");
    expect(trip.inspection.accepted).toBe(false);
    expect(registerTextStylePreview().exportEnabled).toBe(false);
    expect(registerScreenContract(TEXT_STYLE_CONTRACT).accepted).toBe(false);
    expect(registerScreenContract(TEXT_STYLE_CONTRACT).exportEnabled).toBe(false);

    const blocked = buildTransfer({
      checkpoint: trip.snapshot.checkpoint,
      scope: "textStyle",
      sourceId: "text-style-source",
      exportId: "text-style-export",
      screen: "textStyle",
      version: "1.0.0",
      previewLinked: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unregistered-screen-contract");
    const lookedUp = lookupScreenContract("textStyle", "1.0.0", "textStyle");
    expect("supportStatus" in lookedUp && lookedUp.supportStatus).toBe("locked");
    expect("exportEnabled" in lookedUp && lookedUp.exportEnabled).toBe(false);
  });

  it("keeps fingerprint and role tokens across long text and scale fixtures", () => {
    const preview = createTextStylePreview();
    const longText = preview.loadFixture("text-style-long-text");
    expect(longText.ok).toBe(true);
    expect(longText.displayOnly).toBe(true);
    expect(longText.exportEnabled).toBe(false);
    expect(preview.form().fingerprint).toBe("text-style-v1");
    expect(preview.form().sample).toBe("long-text-display-only");
    expect(preview.form().clipped).toBe(false);
    expect(preview.preview().profile).toBe(TEXT_STYLE_CONTRACT.fingerprint);

    const scaled = preview.loadFixture("text-style-scale");
    expect(scaled.ok).toBe(true);
    expect(scaled.scales).toEqual([1, 1.5, 2]);
    expect(preview.form().scales).toEqual([1, 1.5, 2]);
    expect(preview.form().floorProtected).toBe(true);
    for (const role of TEXT_STYLE_ROLES) {
      expect(preview.form().roles[role]).toEqual(TEXT_STYLE_PUBLISHED.roles[role]);
    }
    expect(TEXT_STYLE_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "text-style-long-text",
      "text-style-scale",
    ]);
    expect(cloneTextStylePresetForEdit(TEXT_STYLE_BASELINE.id).roles.hero.base).toBe(100);
  });

  it("locks unsupported font paths and CSS, and does not write accessibility or boot the game", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => []),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const preview = createTextStylePreview({ storage, bootGame, camera, network, onDanger });

    const locked = preview.edit({
      fontFamily: "Custom Dream",
      fontPath: "C:/fonts/custom.ttf",
      fontFile: "custom.woff2",
      css: "font-size: 99px",
      letterSpacing: 4,
      fontScale: 2,
      highContrast: true,
      minPhysicalPx: 12,
    });
    expect(locked.ok).toBe(false);
    expect(locked.editEnabled).toBe(false);
    expect(locked.exportEnabled).toBe(false);
    expect(locked.locks).toContain(TEXT_STYLE_LOCK_REASONS.fontPath);
    expect(locked.locks).toContain(TEXT_STYLE_LOCK_REASONS.arbitraryCss);
    expect(locked.locks).toContain(TEXT_STYLE_LOCK_REASONS.accessibility);
    expect(locked.locks).toContain(TEXT_STYLE_LOCK_REASONS.customFont);
    expect(preview.form().dirty).toBe(false);
    expect(preview.form().roles.body).toEqual(TEXT_STYLE_PUBLISHED.roles.body);
    expect(preview.form().writesPlayerFontScale).toBe(false);

    const unknown = preview.edit({ glow: 1 });
    expect(unknown.ok).toBe(false);
    expect(unknown.locks).toContain(TEXT_STYLE_LOCK_REASONS.unknownField);

    preview.preview();
    preview.save();
    preview.loadFixture("text-style-long-text");
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    for (const key of GAME_KEYS_FORBIDDEN) {
      expect(storage.setItem).not.toHaveBeenCalledWith(key, expect.anything());
    }
    expect(storage.setItem).not.toHaveBeenCalledWith("fontScale", expect.anything());
    expect(storage.setItem).not.toHaveBeenCalledWith("accessibility", expect.anything());
  });

  it("does not import game bootstrap, camera, UIText, or SceneDirector", () => {
    const source = readFileSync("src/editor/ui/preview/styles/UITextStylePreview.ts", "utf8");
    const adapter = readFileSync("src/editor/ui/preview/UIPreviewAdapter.ts", "utf8");
    expect(source).not.toMatch(/AppBootstrap|SceneDirector|from ["'][^"']*UIText["']|dream-guardian-save|choreography/);
    expect(source).not.toMatch(/from ["'].*\/(game|camera|motion)\//);
    expect(source).not.toMatch(/localStorage|indexedDB|fontScale\s*=/);
    expect(adapter).toContain("registerTextStylePreview");
    expect(adapter).not.toMatch(/from ["'].*SceneDirector/);
    expect(adapter).not.toMatch(/from ["'].*\/game\//);
    expect(source).toContain("buildTransfer");
    expect(source).toContain("inspectTransfer");
  });
});
