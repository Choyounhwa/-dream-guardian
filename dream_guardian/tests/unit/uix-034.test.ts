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
  cloneTextStylePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  lookupScreenContract,
  registerScreenContract,
  resolveTextStyleProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  TEXT_STYLE_CONTRACT,
  TEXT_STYLE_FIXTURES,
  TEXT_STYLE_ID,
  TEXT_STYLE_LOCK_REASONS,
  TEXT_STYLE_PUBLISHED,
  TEXT_STYLE_VERSION,
  rejectTextStyleValue,
} from "../../src/editor/ui/data/styles/UITextStyleContract";

const ROLES = ["hero", "title", "heading", "subheading", "body", "label", "badge", "caption"] as const;

const PUBLISHED_ROLES = {
  hero: { base: 100, min: 36, weight: "bold" },
  title: { base: 76, min: 32, weight: "bold" },
  heading: { base: 54, min: 28, weight: "bold" },
  subheading: { base: 44, min: 24, weight: "bold" },
  body: { base: 36, min: 20, weight: "normal" },
  label: { base: 28, min: 18, weight: "normal" },
  badge: { base: 24, min: 16, weight: "bold" },
  caption: { base: 20, min: 16, weight: "normal" },
} as const;

describe("UIX-034 text style support contract", () => {
  it("registers only published role token base/min/weight as display defaults", () => {
    expect(TEXT_STYLE_ID).toBe("textStyle");
    expect(TEXT_STYLE_VERSION).toBe("1.0.0");
    expect(TEXT_STYLE_CONTRACT.id).toBe("textStyle");
    expect(TEXT_STYLE_CONTRACT.version).toBe("1.0.0");
    expect(TEXT_STYLE_CONTRACT.scope).toBe("textStyle");
    expect(TEXT_STYLE_CONTRACT.unit).toBe("px");
    expect(TEXT_STYLE_CONTRACT.editEnabled).toBe(false);
    expect(TEXT_STYLE_CONTRACT.exportEnabled).toBe(false);
    expect(TEXT_STYLE_CONTRACT.supportStatus).toBe("locked");
    expect(TEXT_STYLE_PUBLISHED.roles).toEqual(PUBLISHED_ROLES);
    expect(TEXT_STYLE_CONTRACT.supportedFields).toEqual(
      ROLES.flatMap((role) => [`${role}.base`, `${role}.min`, `${role}.weight`]),
    );
    for (const role of ROLES) {
      const token = PUBLISHED_ROLES[role];
      expect(resolveTextStyleProperty(`${role}.base`)).toEqual({
        status: "supported",
        locked: true,
        reason: TEXT_STYLE_LOCK_REASONS.displayOnly,
        unit: "px",
        min: token.min,
        max: token.base,
        defaultValue: token.base,
      });
      expect(resolveTextStyleProperty(`${role}.min`)).toEqual({
        status: "supported",
        locked: true,
        reason: TEXT_STYLE_LOCK_REASONS.displayOnly,
        unit: "px",
        min: token.min,
        max: token.base,
        defaultValue: token.min,
      });
      expect(resolveTextStyleProperty(`${role}.weight`)).toEqual({
        status: "supported",
        locked: true,
        reason: TEXT_STYLE_LOCK_REASONS.displayOnly,
        unit: "px",
        allowed: ["normal", "bold"],
        defaultValue: token.weight,
      });
    }
    const registered = registerScreenContract({
      screen: "textStyle",
      version: "1.0.0",
      scope: "textStyle",
    });
    expect(registered).toEqual({ accepted: false, editEnabled: false, exportEnabled: false });
    const lookedUp = lookupScreenContract("textStyle", "1.0.0", "textStyle");
    expect(lookedUp.registered).toBe(true);
    if (lookedUp.registered) {
      expect(lookedUp.editEnabled).toBe(false);
      expect(lookedUp.exportEnabled).toBe(false);
      expect(lookedUp.fingerprint).toBe(TEXT_STYLE_CONTRACT.fingerprint);
    }
    expect(lookupScreenContract("textStyle", "9.9.9", "textStyle")).toEqual({ registered: false });
  });

  it("locks unconnected font props and rejects arbitrary CSS and font paths", () => {
    for (const key of ["fontFamily", "fontPath", "fontFile", "css", "letterSpacing", "lineHeight"]) {
      expect(resolveTextStyleProperty(key).status).toBe("locked");
      expect(resolveTextStyleProperty(key).reason.length).toBeGreaterThan(0);
    }
    expect(resolveTextStyleProperty("fontFamily")).toEqual({
      status: "locked",
      locked: true,
      reason: "no unmodified editor consumer for custom fonts",
    });
    expect(resolveTextStyleProperty("fontPath").reason).toBe(
      "no unmodified editor consumer for custom fonts",
    );
    for (const key of ["fontScale", "highContrast", "minPhysicalPx"]) {
      expect(resolveTextStyleProperty(key)).toEqual({
        status: "locked",
        locked: true,
        reason: "player accessibility is not a transfer override",
        exportable: false,
      });
    }
    expect(rejectTextStyleValue("fontFamily", "Comic Sans")).toEqual({
      ok: false,
      reason: "no unmodified editor consumer for custom fonts",
    });
    expect(rejectTextStyleValue("css", "font-size: 99px")).toEqual({
      ok: false,
      reason: TEXT_STYLE_LOCK_REASONS.arbitraryCss,
    });
    expect(rejectTextStyleValue("fontPath", "C:/fonts/custom.ttf")).toEqual({
      ok: false,
      reason: TEXT_STYLE_LOCK_REASONS.fontPath,
    });
    expect(rejectTextStyleValue("fontFile", "../assets/font.woff2")).toEqual({
      ok: false,
      reason: TEXT_STYLE_LOCK_REASONS.fontPath,
    });
    expect(rejectTextStyleValue("fontScale", 2)).toEqual({
      ok: false,
      reason: "player accessibility is not a transfer override",
    });
  });

  it("freezes the text baseline, fingerprint, and display-only long-text/scale fixtures", () => {
    expect(TEXT_STYLE_BASELINE.id).toBe("text-style-v1");
    expect(TEXT_STYLE_BASELINE.version).toBe("1.0.0");
    expect(TEXT_STYLE_BASELINE.presetHash).toBe(contentHash(TEXT_STYLE_BASELINE.preset));
    expect(TEXT_STYLE_BASELINE.rendererFingerprint).toBe(TEXT_STYLE_CONTRACT.fingerprint);
    expect(TEXT_STYLE_CONTRACT.fingerprint).toBe("text-style-v1");
    expect(Object.isFrozen(TEXT_STYLE_BASELINE.preset)).toBe(true);
    expect(cloneTextStylePresetForEdit("text-style-v1")).toEqual(TEXT_STYLE_BASELINE.preset);
    expect(cloneTextStylePresetForEdit("text-style-v1")).not.toBe(TEXT_STYLE_BASELINE.preset);
    expect(() => cloneTextStylePresetForEdit("menu-v1")).toThrow("unknown baseline");
    expect(TEXT_STYLE_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "text-style-long-text",
      "text-style-scale",
    ]);
    for (const fixture of TEXT_STYLE_FIXTURES) {
      expect(fixture.closed).toBe(true);
      expect(fixture.displayOnly).toBe(true);
      expect(fixture.exportEnabled).toBe(false);
      expect(fixture.editEnabled).toBe(false);
    }
    const scale = TEXT_STYLE_FIXTURES.find((fixture) => fixture.id === "text-style-scale");
    expect(scale?.scales).toEqual([1, 1.5, 2]);
    expect(scale && "fontScale" in scale).toBe(false);
    expect(TEXT_STYLE_BASELINE.preset.exportableFields).not.toEqual(
      expect.arrayContaining(["fontScale", "highContrast", "minPhysicalPx"]),
    );
    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
    expect(BASELINE_REGISTRY.presetHash).toBe(contentHash(BASELINE_REGISTRY.preset));
    expect(SUBMENU_BASELINE.presetHash).toBe(contentHash(SUBMENU_BASELINE.preset));
    expect(HUD_BASELINE.presetHash).toBe(contentHash(HUD_BASELINE.preset));
    expect(BOTTOM_BAR_BASELINE.presetHash).toBe(contentHash(BOTTOM_BAR_BASELINE.preset));
    expect(RESULT_BASELINE.presetHash).toBe(contentHash(RESULT_BASELINE.preset));
    expect(SETTINGS_BASELINE.presetHash).toBe(contentHash(SETTINGS_BASELINE.preset));
    expect(PAUSE_BASELINE.presetHash).toBe(contentHash(PAUSE_BASELINE.preset));
  });
});
