import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { THEME_BASELINE, cloneThemePresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract } from "../../src/editor/ui/data/UIProperties";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import {
  IMAGE_BACKGROUND_CONTRAST,
  THEME_FIXTURES,
  THEME_LOCK_REASONS,
  THEME_PUBLISHED,
  THEME_TOKEN_KEYS,
  judgeThemeContrast,
} from "../../src/editor/ui/data/styles/UIThemeContract";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  createThemePreview,
  registerThemePreview,
  roundTripTheme,
} from "../../src/editor/ui/preview/styles/UIThemePreview";

describe("UIX-037 theme preview edit export", () => {
  it("selects theme into a registry form, undoes, previews, and snapshots", () => {
    const preview = createThemePreview();
    const selected = preview.select();
    expect(selected.screen).toBe("theme");
    expect(selected.registry).toMatchObject({ registered: true, exportEnabled: false, supportStatus: "locked" });
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.default).toEqual(THEME_PUBLISHED.default);
    expect(selected.form.highContrast).toEqual(THEME_PUBLISHED.highContrast);
    expect(selected.form.default).toEqual(cloneThemePresetForEdit(THEME_BASELINE.id).default);

    const edited = preview.edit({ default: { primary: THEME_PUBLISHED.default.primary } });
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.form.default.primary).toBe(THEME_PUBLISHED.default.primary);
    expect(preview.undo().default.primary).toBe(THEME_PUBLISHED.default.primary);
    expect(preview.restoreDefault().highContrast).toEqual(THEME_PUBLISHED.highContrast);

    const shown = preview.preview();
    expect(shown.changedByPreviewOnly).toBe(true);
    expect(shown.gameApplyVerified).toBe(false);
    expect(shown.contrast).toEqual({
      default: judgeThemeContrast({
        fixture: "default",
        foreground: "textPrimary",
        background: "bgCard",
      }),
      highContrast: judgeThemeContrast({
        fixture: "highContrast",
        foreground: "textPrimary",
        background: "bgCard",
      }),
    });
    expect(shown.imageBackgroundContrast).toBe(IMAGE_BACKGROUND_CONTRAST);
    expect(shown.failures).toEqual([]);
    expect(shown.form.default).toEqual(THEME_PUBLISHED.default);

    const snapshot = preview.snapshot();
    expect(snapshot.checkpoint.screen).toBe("theme");
    expect(snapshot.checkpoint.theme.default).toEqual(THEME_PUBLISHED.default);
    expect(snapshot.checkpoint.theme.highContrast).toEqual(THEME_PUBLISHED.highContrast);
    expect(snapshot.checkpoint.writesPlayerSetting).toBe(false);
  });

  it("round-trips supported tokens and keeps highContrast out of the transfer payload", () => {
    const preview = createThemePreview();
    preview.select();
    const trip = roundTripTheme(preview);
    expect(trip.selected.screen).toBe("theme");
    expect(trip.inspected.gameApplyVerified).toBe(false);
    expect(trip.inspected.accepted).toBe(false);
    expect(trip.transfer.ok).toBe(false);
    if (!trip.transfer.ok) expect(trip.transfer.reason).toBe("unregistered-screen-contract");
    expect(registerThemePreview().exportEnabled).toBe(false);

    const blocked = buildTransfer({
      checkpoint: { screen: "theme", theme: { default: THEME_PUBLISHED.default } },
      scope: "theme",
      sourceId: "src-theme",
      exportId: "exp-theme",
      screen: "theme",
      version: "1.0.0",
      previewLinked: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unregistered-screen-contract");
    const looked = lookupScreenContract("theme", "1.0.0", "theme");
    expect("supportStatus" in looked && looked.supportStatus).toBe("locked");

    for (const fixture of THEME_FIXTURES) {
      const judged = judgeThemeContrast({
        fixture: fixture.fixture,
        foreground: "textPrimary",
        background: "bgCard",
      });
      expect(judged.status).toBe("unverified");
      if (judged.status === "unverified") expect(judged.reason).toBe(IMAGE_BACKGROUND_CONTRAST);
      const solid = judgeThemeContrast({
        fixture: fixture.fixture,
        foreground: "#FFFFFF",
        background: "#000000",
      });
      expect(solid.status).toBe("judged");
      for (const key of THEME_TOKEN_KEYS) {
        expect(fixture.colors[key]).toBe(THEME_PUBLISHED[fixture.fixture][key]);
      }
    }
    expect(trip.transfer).not.toMatchObject({
      content: { theme: { highContrast: THEME_PUBLISHED.highContrast } },
    });
  });

  it("locks arbitrary css and refuses game boot, storage, and player highContrast writes", () => {
    const preview = createThemePreview();
    preview.select();
    const css = preview.edit({ css: "body{filter:invert(1)}" });
    expect(css).toEqual({ ok: false, reason: THEME_LOCK_REASONS.arbitraryCss });
    const color = preview.edit({ color: "#000" });
    expect(color).toEqual({ ok: false, reason: THEME_LOCK_REASONS.arbitraryCss });
    const player = preview.edit({ playerHighContrast: true });
    expect(player).toEqual({ ok: false, reason: THEME_LOCK_REASONS.accessibility });
    const unknown = preview.edit({ glow: "#fff" });
    expect(unknown).toEqual({ ok: false, reason: THEME_LOCK_REASONS.unconnected });

    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), keys: vi.fn(() => [] as string[]) };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const isolated = createThemePreview({ storage, bootGame, camera, network, onDanger });
    isolated.select();
    isolated.preview();
    isolated.snapshot();
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    for (const key of GAME_KEYS_FORBIDDEN) expect(storage.getItem).not.toHaveBeenCalledWith(key);
    expect(isolated.form().writesPlayerSetting).toBe(false);
    expect(THEME_FIXTURES.every((fixture) => fixture.writesPlayerSetting === false)).toBe(true);
  });

  it("does not import game bootstrap, camera, UIText, or SceneDirector", () => {
    const source = readFileSync("src/editor/ui/preview/styles/UIThemePreview.ts", "utf8");
    expect(source).not.toMatch(/from ["'].*\/(main|bootstrap|SceneDirector|UIText|camera)/);
    expect(source).not.toMatch(/localStorage|indexedDB/);
    expect(source).not.toMatch(/ports\.storage\??\.(getItem|setItem|keys)/);
    expect(source).toContain("buildTransfer");
    expect(source).toContain("inspectTransfer");
    const adapter = readFileSync("src/editor/ui/preview/UIPreviewAdapter.ts", "utf8");
    expect(adapter).toContain("registerThemePreview");
  });
});
