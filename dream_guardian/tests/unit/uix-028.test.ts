import { describe, expect, it, vi } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import { LIMITS } from "../../src/editor/ui/data/UIContracts";
import {
  BASELINE_REGISTRY,
  BOTTOM_BAR_BASELINE,
  HUD_BASELINE,
  PAUSE_BASELINE,
  RESULT_BASELINE,
  SETTINGS_BASELINE,
  SUBMENU_BASELINE,
  clonePausePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  PAUSE_SCREEN_ID,
  lookupScreenContract,
  registerScreenContract,
  resolvePauseProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  PAUSE_CONTRACT,
  PAUSE_FIXTURES,
  PAUSE_LOCK_REASONS,
  PAUSE_PUBLISHED,
  attemptPauseAction,
  rejectPauseExport,
} from "../../src/editor/ui/data/screens/UIPauseContract";

describe("UIX-028 pause modal support contract", () => {
  it("locks published modal/resume/quit slots as display-only fixtures", () => {
    expect(PAUSE_CONTRACT.screen).toBe("pause");
    expect(PAUSE_SCREEN_ID).toBe("pause");
    expect(PAUSE_CONTRACT.version).toBe("1.0.0");
    expect(PAUSE_PUBLISHED.design).toEqual({ width: 1080, height: 2160 });
    expect(PAUSE_PUBLISHED.bounds).toEqual({ x: 140, y: 720, w: 800, h: 720 });
    expect(PAUSE_PUBLISHED.modal).toEqual({ x: 140, y: 720, w: 800, h: 720 });
    expect(PAUSE_PUBLISHED.resumeBtn).toEqual({ x: 200, y: 980, w: 680, h: 130 });
    expect(PAUSE_PUBLISHED.quitBtn).toEqual({ x: 200, y: 1160, w: 680, h: 130 });
    expect(PAUSE_CONTRACT.editEnabled).toBe(false);
    expect(PAUSE_CONTRACT.exportEnabled).toBe(false);
    expect(PAUSE_CONTRACT.supportStatus).toBe("locked");
    expect(PAUSE_CONTRACT.protectedRegions.map((region) => region.id)).toEqual([
      "pause-modal",
      "pause-resume",
      "pause-quit",
    ]);
    const byId = Object.fromEntries(PAUSE_FIXTURES.map((fixture) => [fixture.id, fixture]));
    expect(byId["pause-open"]).toMatchObject({
      screen: "pause",
      open: true,
      profileInputs: "closed",
      invokesPause: false,
    });
    expect(byId["pause-closed"]).toMatchObject({
      screen: "pause",
      open: false,
      profileInputs: "closed",
      invokesPause: false,
    });
    expect(byId["pause-resume-mock"]).toMatchObject({
      screen: "pause",
      mockedResume: true,
      invokesPause: false,
      profileInputs: "closed",
    });
    expect(byId["pause-menu-mock"]).toMatchObject({
      screen: "pause",
      mockedMenu: true,
      invokesPause: false,
      profileInputs: "closed",
    });
    expect(byId["pause-resume-mock"]).not.toHaveProperty("resume");
    expect(byId["pause-menu-mock"]).not.toHaveProperty("quitToMenu");
  });

  it("blocks pause, resume, and quit-to-menu without invoking injected callbacks", () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const quitToMenu = vi.fn();
    expect(attemptPauseAction("pause", { pause, resume, quitToMenu })).toEqual({
      blocked: true,
      reason: PAUSE_LOCK_REASONS.pauseBlocked,
    });
    expect(attemptPauseAction("resume", { pause, resume, quitToMenu })).toEqual({
      blocked: true,
      reason: PAUSE_LOCK_REASONS.resumeBlocked,
    });
    expect(attemptPauseAction("quit-to-menu", { pause, resume, quitToMenu })).toEqual({
      blocked: true,
      reason: PAUSE_LOCK_REASONS.quitBlocked,
    });
    expect(pause).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    expect(quitToMenu).not.toHaveBeenCalled();
    expect(rejectPauseExport()).toEqual({
      blocked: true,
      reason: PAUSE_LOCK_REASONS.exportBlocked,
    });
    expect(resolvePauseProperty("profile")).toEqual({
      ok: false,
      locked: true,
      reason: PAUSE_LOCK_REASONS.profileClosed,
    });
    expect(resolvePauseProperty("unknownField")).toEqual({
      ok: false,
      locked: true,
      reason: PAUSE_LOCK_REASONS.unknownField,
    });
    expect(resolvePauseProperty("modal")).toEqual({
      ok: true,
      locked: true,
      reason: PAUSE_LOCK_REASONS.exportBlocked,
      value: PAUSE_PUBLISHED.modal,
    });
  });

  it("registers a locked pause baseline and preserves prior baselines", () => {
    expect(PAUSE_BASELINE.id).toBe("pause-v1");
    expect(PAUSE_BASELINE.version).toBe("1.0.0");
    expect(PAUSE_BASELINE.presetHash).toBe(contentHash(PAUSE_BASELINE.preset));
    expect(PAUSE_BASELINE.presetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(PAUSE_BASELINE.preset.modal).toEqual(PAUSE_PUBLISHED.modal);
    expect(PAUSE_BASELINE.preset.resumeBtn).toEqual(PAUSE_PUBLISHED.resumeBtn);
    expect(PAUSE_BASELINE.preset.quitBtn).toEqual(PAUSE_PUBLISHED.quitBtn);
    expect(clonePausePresetForEdit("pause-v1").modal).toEqual(PAUSE_PUBLISHED.modal);
    expect(() => clonePausePresetForEdit("missing")).toThrow(/unknown baseline/);
    expect(SETTINGS_BASELINE.id).toBe("settings-v1");
    expect(SETTINGS_BASELINE.presetHash).toBe(contentHash(SETTINGS_BASELINE.preset));
    expect(RESULT_BASELINE.id).toBe("result-v1");
    expect(HUD_BASELINE.id).toBe("hud-v1");
    expect(SUBMENU_BASELINE.id).toBe("submenu-v1");
    expect(BOTTOM_BAR_BASELINE.id).toBe("bottom-bar-v1");
    expect(BASELINE_REGISTRY.id).toBe("menu-v1");
    const registered = lookupScreenContract("pause", "1.0.0", "pause");
    expect(registered).toMatchObject({
      registered: true,
      screen: "pause",
      supportStatus: "locked",
      editEnabled: false,
      exportEnabled: false,
    });
    expect(registerScreenContract(PAUSE_CONTRACT)).toEqual({
      accepted: false,
      editEnabled: false,
      exportEnabled: false,
    });
    expect(LIMITS.maxBytes).toBe(1024 * 1024);
    expect(LIMITS.maxDepth).toBe(16);
    expect(LIMITS.maxNameLength).toBe(80);
  });
});
