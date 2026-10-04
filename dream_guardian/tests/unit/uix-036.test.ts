import { describe, expect, it } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import {
  BASELINE_REGISTRY,
  BOTTOM_BAR_BASELINE,
  HUD_BASELINE,
  PAUSE_BASELINE,
  RESULT_BASELINE,
  SETTINGS_BASELINE,
  SUBMENU_BASELINE,
  TEXT_STYLE_BASELINE,
  THEME_BASELINE,
  cloneTextStylePresetForEdit,
  cloneThemePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  lookupScreenContract,
  registerScreenContract,
  resolveTextStyleProperty,
  resolveThemeProperty,
} from "../../src/editor/ui/data/UIProperties";
import { TEXT_STYLE_BASELINE as TEXT_STYLE_BASELINE_ALIAS } from "../../src/editor/ui/data/UIBaselines";
import {
  IMAGE_BACKGROUND_CONTRAST,
  THEME_COLOR_CONSUMER,
  THEME_CONTRACT,
  THEME_FIXTURES,
  THEME_ID,
  THEME_LOCK_REASONS,
  THEME_PUBLISHED,
  THEME_VERSION,
  judgeThemeContrast,
  rejectThemeValue,
} from "../../src/editor/ui/data/styles/UIThemeContract";

const TOKEN_KEYS = [
  "primary",
  "secondary",
  "accent",
  "danger",
  "success",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "textLocked",
  "bgDim",
  "bgCard",
  "border",
  "borderHighlight",
] as const;

const DEFAULT_COLORS = {
  primary: "#28E6FF",
  secondary: "#FFCB4D",
  accent: "#C889FF",
  danger: "#FF4444",
  success: "#4DFFAA",
  textPrimary: "#FFFFFF",
  textSecondary: "#CCCCCC",
  textMuted: "#BBBBBB",
  textLocked: "#888888",
  bgDim: "rgba(0, 0, 0, 0.7)",
  bgCard: "rgba(20, 24, 40, 0.85)",
  border: "rgba(255, 255, 255, 0.2)",
  borderHighlight: "#28E6FF",
} as const;

const HIGH_CONTRAST_COLORS = {
  primary: "#00FFFF",
  secondary: "#FFFF00",
  accent: "#FF00FF",
  danger: "#FF0000",
  success: "#00FF00",
  textPrimary: "#FFFFFF",
  textSecondary: "#FFFFFF",
  textMuted: "#DDDDDD",
  textLocked: "#888888",
  bgDim: "rgba(0, 0, 0, 0.92)",
  bgCard: "rgba(0, 0, 0, 0.95)",
  border: "#FFFFFF",
  borderHighlight: "#FFFF00",
} as const;

describe("UIX-036 theme color support contract", () => {
  it("registers published color tokens with consumer, ranges, baseline, and theme version", () => {
    expect(THEME_ID).toBe("theme");
    expect(THEME_VERSION).toBe("1.0.0");
    expect(THEME_CONTRACT.id).toBe("theme");
    expect(THEME_CONTRACT.screen).toBe("theme");
    expect(THEME_CONTRACT.version).toBe("1.0.0");
    expect(THEME_CONTRACT.scope).toBe("theme");
    expect(THEME_CONTRACT.editEnabled).toBe(false);
    expect(THEME_CONTRACT.exportEnabled).toBe(false);
    expect(THEME_CONTRACT.supportStatus).toBe("locked");
    expect(THEME_COLOR_CONSUMER).toBe("UIText.getColor token keys");
    expect(THEME_CONTRACT.consumer).toBe("UIText.getColor token keys");
    expect(THEME_CONTRACT.consumerMode).toBe("read-only");
    expect([...THEME_CONTRACT.tokens]).toEqual([...TOKEN_KEYS]);
    expect(THEME_PUBLISHED.default).toEqual(DEFAULT_COLORS);
    expect(THEME_PUBLISHED.highContrast).toEqual(HIGH_CONTRAST_COLORS);
    expect(THEME_CONTRACT.valueRanges.primary).toEqual(["#28E6FF", "#00FFFF"]);
    expect(THEME_CONTRACT.valueRanges.bgDim).toEqual(["rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0.92)"]);
    expect(THEME_CONTRACT.baselineId).toBe("theme-v1");

    const registered = lookupScreenContract("theme", "1.0.0", "theme");
    expect(registered.registered).toBe(true);
    if (registered.registered) {
      expect(registered.editEnabled).toBe(false);
      expect(registered.exportEnabled).toBe(false);
      expect(registered.supportStatus).toBe("locked");
      expect(registered.fingerprint).toBe(THEME_CONTRACT.fingerprint);
    }
    expect(lookupScreenContract("theme", "9.9.9", "theme").registered).toBe(false);
    expect(registerScreenContract({ screen: "theme", version: "1.0.0", scope: "theme" })).toEqual({
      accepted: false,
      editEnabled: false,
      exportEnabled: false,
    });

    expect(THEME_BASELINE.id).toBe("theme-v1");
    expect(THEME_BASELINE.version).toBe("1.0.0");
    expect(THEME_BASELINE.presetHash).toBe(contentHash(THEME_BASELINE.preset));
    expect(THEME_BASELINE.rendererFingerprint).toBe(THEME_CONTRACT.fingerprint);
    expect(Object.isFrozen(THEME_BASELINE.preset)).toBe(true);
    expect(cloneThemePresetForEdit("theme-v1")).toEqual(THEME_BASELINE.preset);
    expect(cloneThemePresetForEdit("theme-v1")).not.toBe(THEME_BASELINE.preset);
    expect(THEME_BASELINE.preset.exportableFields).toEqual([]);
  });

  it("fixes default and highContrast fixtures and leaves image/rgba contrast unverified", () => {
    expect(IMAGE_BACKGROUND_CONTRAST).toBe("unverified");
    expect(THEME_FIXTURES.map((fixture) => fixture.id)).toEqual(["theme-default", "theme-high-contrast"]);
    expect(THEME_FIXTURES[0].kind).toBe("display");
    expect(THEME_FIXTURES[1].kind).toBe("display");
    expect(THEME_FIXTURES[1].writesPlayerSetting).toBe(false);
    expect(THEME_FIXTURES[0].colors).toEqual(DEFAULT_COLORS);
    expect(THEME_FIXTURES[1].colors).toEqual(HIGH_CONTRAST_COLORS);

    const judged = judgeThemeContrast({
      fixture: "default",
      foreground: "textPrimary",
      background: "#000000",
    });
    expect(judged.status).toBe("judged");
    if (judged.status === "judged") {
      expect(judged.pair).toEqual({ foreground: "#FFFFFF", background: "#000000" });
    }

    const overlay = judgeThemeContrast({
      fixture: "default",
      foreground: "textPrimary",
      background: "bgDim",
    });
    expect(overlay.status).toBe("unverified");
    if (overlay.status === "unverified") {
      expect(overlay.reason).toBe(IMAGE_BACKGROUND_CONTRAST);
    }

    const image = judgeThemeContrast({
      fixture: "highContrast",
      foreground: "textPrimary",
      background: "image",
    });
    expect(image.status).toBe("unverified");
    if (image.status === "unverified") {
      expect(image.reason).toBe("unverified");
    }
  });

  it("rejects unconnected tokens, arbitrary CSS, and player highContrast overrides", () => {
    expect(rejectThemeValue("glow", "#FFFFFF")).toEqual({
      ok: false,
      reason: THEME_LOCK_REASONS.unconnected,
    });
    expect(rejectThemeValue("primary", "rgb(0, 255, 255)")).toEqual({
      ok: false,
      reason: THEME_LOCK_REASONS.arbitraryCss,
    });
    expect(rejectThemeValue("css", "color: red")).toEqual({
      ok: false,
      reason: THEME_LOCK_REASONS.arbitraryCss,
    });
    expect(rejectThemeValue("highContrast", true)).toEqual({
      ok: false,
      reason: THEME_LOCK_REASONS.accessibility,
    });
    expect(THEME_LOCK_REASONS.accessibility).toBe("player accessibility is not a transfer override");
    expect(rejectThemeValue("primary", "#28E6FF")).toEqual({
      ok: false,
      reason: THEME_LOCK_REASONS.baselineMismatch,
    });
    expect(resolveThemeProperty("theme", "1.0.0", "primary")).toMatchObject({
      ok: false,
      locked: true,
    });
    expect(resolveThemeProperty("theme", "1.0.0", "highContrast").reason).toBe(
      THEME_LOCK_REASONS.accessibility,
    );
  });

  it("preserves textStyle and earlier baselines", () => {
    expect(TEXT_STYLE_BASELINE.id).toBe("text-style-v1");
    expect(cloneTextStylePresetForEdit("text-style-v1").roles.hero.base).toBe(100);
    expect(resolveTextStyleProperty("hero.base")).toMatchObject({ locked: true });
    expect(BASELINE_REGISTRY.id).toBeDefined();
    expect(SUBMENU_BASELINE.id).toBeDefined();
    expect(HUD_BASELINE.id).toBeDefined();
    expect(BOTTOM_BAR_BASELINE.id).toBeDefined();
    expect(RESULT_BASELINE.id).toBeDefined();
    expect(SETTINGS_BASELINE.id).toBeDefined();
    expect(PAUSE_BASELINE.id).toBeDefined();
    expect(TEXT_STYLE_BASELINE_ALIAS).toBe(TEXT_STYLE_BASELINE);
  });
});
