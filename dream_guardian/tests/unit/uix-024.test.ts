import { describe, expect, it } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import { LIMITS } from "../../src/editor/ui/data/UIContracts";
import {
  BASELINE_REGISTRY,
  BOTTOM_BAR_BASELINE,
  HUD_BASELINE,
  RESULT_BASELINE,
  SUBMENU_BASELINE,
  cloneResultPresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  RESULT_SCREEN_ID,
  lookupScreenContract,
  registerScreenContract,
  resolveResultProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  RESULT_CONTRACT,
  RESULT_FIXTURES,
  RESULT_LOCK_REASONS,
  RESULT_PUBLISHED,
  attemptPersistResultRecord,
  rejectResultExport,
} from "../../src/editor/ui/data/screens/UIResultContract";

describe("UIX-024 result screen support contract", () => {
  it("locks published panel/title/stars/chapter and fixture-only win/loss/rank/stats", () => {
    expect(RESULT_CONTRACT.screen).toBe("result");
    expect(RESULT_SCREEN_ID).toBe("result");
    expect(RESULT_CONTRACT.version).toBe("1.0.0");
    expect(RESULT_PUBLISHED.design).toEqual({ width: 1080, height: 2160 });
    expect(RESULT_PUBLISHED.bounds).toEqual({ x: 100, y: 240, w: 880, h: 1580 });
    expect(RESULT_PUBLISHED.panel).toEqual({ x: 100, y: 240, w: 880, h: 1580 });
    expect(RESULT_PUBLISHED.title).toEqual({ x: 540, y: 360 });
    expect(RESULT_PUBLISHED.stars).toEqual({ x: 540, y: 490 });
    expect(RESULT_PUBLISHED.chapter).toEqual({ x: 540, y: 580 });
    expect(RESULT_PUBLISHED.statLineHeight).toBe(74);
    expect(RESULT_CONTRACT.supportStatus).toBe("locked");
    expect(RESULT_CONTRACT.editEnabled).toBe(false);
    expect(RESULT_CONTRACT.exportEnabled).toBe(false);
    expect(RESULT_CONTRACT.units).toEqual({ length: "px", design: "1080x2160" });
    expect(RESULT_CONTRACT.ranges.x).toEqual({ min: 0, max: 1080 });
    expect(RESULT_CONTRACT.ranges.y).toEqual({ min: 0, max: 2160 });
    expect(RESULT_CONTRACT.ranges.statLineHeight).toEqual({ min: 1, max: 2160 });
    expect(contentHash(RESULT_PUBLISHED)).toMatch(/^[a-f0-9]{64}$/);

    const regions = RESULT_CONTRACT.protectedRegions;
    expect(regions.map((region) => region.id)).toEqual([
      "result-panel",
      "result-title",
      "result-stars",
      "result-chapter",
    ]);
    expect(regions.every((region) => region.locked)).toBe(true);
    const panel = regions.find((region) => region.id === "result-panel");
    expect(panel).toMatchObject({ x: 100, y: 240, width: 880, height: 1580, role: "panel" });
    const title = regions.find((region) => region.id === "result-title");
    expect(title).toMatchObject({ x: 540, y: 360, role: "title" });
    const stars = regions.find((region) => region.id === "result-stars");
    expect(stars).toMatchObject({ x: 540, y: 490, role: "stars" });
    const chapter = regions.find((region) => region.id === "result-chapter");
    expect(chapter).toMatchObject({ x: 540, y: 580, role: "chapter" });

    const ids = RESULT_FIXTURES.map((fixture) => fixture.id);
    expect(ids).toEqual(["result-victory", "result-defeat", "result-long-stats", "result-rank"]);
    expect(RESULT_FIXTURES.every((fixture) => fixture.closed && fixture.screen === "result")).toBe(true);
    expect(RESULT_FIXTURES.find((fixture) => fixture.id === "result-victory")).toMatchObject({
      outcome: "victory",
      rank: "S",
    });
    expect(RESULT_FIXTURES.find((fixture) => fixture.id === "result-defeat")).toMatchObject({
      outcome: "defeat",
    });
    const longStats = RESULT_FIXTURES.find((fixture) => fixture.id === "result-long-stats");
    expect(longStats?.stats.length).toBeGreaterThan(80);
    expect(RESULT_FIXTURES.find((fixture) => fixture.id === "result-rank")).toMatchObject({ rank: "A" });
    expect(RESULT_CONTRACT.fixtures).toBe(RESULT_FIXTURES);
    expect(LIMITS.maxNameLength).toBe(80);
  });

  it("blocks real record writes and locks profile, unknown fields, and export", () => {
    const blocked = attemptPersistResultRecord({
      outcome: "victory",
      rank: "S",
      stats: "score:100",
      storage: "localStorage",
    });
    expect(blocked).toEqual({
      blocked: true,
      persisted: false,
      reason: RESULT_LOCK_REASONS.recordWriteBlocked,
    });
    expect(attemptPersistResultRecord({ key: "dream-guardian-save" }).reason).toBe(
      RESULT_LOCK_REASONS.recordWriteBlocked,
    );
    expect(resolveResultProperty("profile")).toEqual({
      status: "locked",
      reason: RESULT_LOCK_REASONS.profileClosed,
      exportEnabled: false,
    });
    expect(resolveResultProperty("unknownBaseline")).toEqual({
      status: "locked",
      reason: RESULT_LOCK_REASONS.unknownBaseline,
      exportEnabled: false,
    });
    expect(resolveResultProperty("renderer")).toEqual({
      status: "locked",
      reason: RESULT_LOCK_REASONS.unknownField,
      exportEnabled: false,
    });
    expect(resolveResultProperty("panel").exportEnabled).toBe(false);
    expect(rejectResultExport()).toEqual({
      ok: false,
      reason: RESULT_LOCK_REASONS.exportBlocked,
      exportEnabled: false,
    });
  });

  it("registers a locked result baseline without moving prior baselines", () => {
    expect(RESULT_BASELINE.id).toBe("result-v1");
    expect(RESULT_BASELINE.version).toBe("1.0.0");
    expect(RESULT_BASELINE.presetHash).toBe(contentHash(RESULT_BASELINE.preset));
    expect(RESULT_BASELINE.preset.panel).toEqual(RESULT_PUBLISHED.panel);
    expect(RESULT_BASELINE.preset.statLineHeight).toBe(74);
    expect(RESULT_BASELINE.preset.recordWrite).toEqual({
      locked: true,
      reason: RESULT_LOCK_REASONS.recordWriteBlocked,
    });
    expect(cloneResultPresetForEdit("result-v1").title).toEqual({ x: 540, y: 360 });
    expect(() => cloneResultPresetForEdit("result-missing")).toThrow(/unknown baseline/);

    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
    expect(BASELINE_REGISTRY.presetHash).toBe(contentHash(BASELINE_REGISTRY.preset));
    expect(SUBMENU_BASELINE.id).toBe("submenu-v1");
    expect(HUD_BASELINE.id).toBe("hud-v1");
    expect(BOTTOM_BAR_BASELINE.id).toBe("bottom-bar-v1");
    expect(BOTTOM_BAR_BASELINE.presetHash).toBe(contentHash(BOTTOM_BAR_BASELINE.preset));

    const found = lookupScreenContract("result", "1.0.0", "result");
    expect(found).toMatchObject({
      registered: true,
      screen: "result",
      supportStatus: "locked",
      editEnabled: false,
      exportEnabled: false,
    });
    expect(registerScreenContract({ screen: "result", version: "1.0.0", scope: "result" })).toEqual({
      accepted: false,
      editEnabled: false,
      exportEnabled: false,
    });
    expect(lookupScreenContract("menu", "1.0.0", "menu").registered).toBe(true);
    expect(lookupScreenContract("submenu", "1.0.0", "submenu")).toMatchObject({ screen: "submenu" });
    expect(lookupScreenContract("hud", "1.0.0", "hud")).toMatchObject({ screen: "hud", supportStatus: "locked" });
    expect(lookupScreenContract("bottomBar", "1.0.0", "bottomBar")).toMatchObject({
      screen: "bottomBar",
      supportStatus: "locked",
    });
  });
});
