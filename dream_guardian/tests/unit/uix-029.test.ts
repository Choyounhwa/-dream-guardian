import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PAUSE_BASELINE, clonePausePresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import {
  PAUSE_CONTRACT,
  PAUSE_FIXTURES,
  PAUSE_LOCK_REASONS,
  PAUSE_PUBLISHED,
  PAUSE_REGIONS,
} from "../../src/editor/ui/data/screens/UIPauseContract";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import {
  createPausePreview,
  registerPausePreview,
  roundTripPause,
} from "../../src/editor/ui/preview/screens/UIPausePreview";

describe("UIX-029 pause preview edit export", () => {
  it("selects pause into a registry form, undoes, previews, and snapshots", () => {
    const preview = createPausePreview();
    const selected = preview.select();
    expect(selected.screen).toBe("pause");
    expect(selected.registry).toMatchObject({ registered: true, exportEnabled: false, supportStatus: "locked" });
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.modal).toEqual(PAUSE_PUBLISHED.modal);
    expect(selected.form.resumeBtn).toEqual(PAUSE_PUBLISHED.resumeBtn);
    expect(selected.form.quitBtn).toEqual(PAUSE_PUBLISHED.quitBtn);

    const edited = preview.edit({ modal: { x: 160, y: 740, w: 780, h: 700 } });
    expect(edited.ok).toBe(true);
    expect(preview.form().modal).toEqual({ x: 160, y: 740, w: 780, h: 700 });
    expect(preview.form().dirty).toBe(true);

    const undone = preview.undo();
    expect(undone.ok).toBe(true);
    expect(preview.form().modal).toEqual(PAUSE_PUBLISHED.modal);
    expect(preview.form().dirty).toBe(false);

    preview.edit({ resumeBtn: { x: 210, y: 990, w: 660, h: 120 } });
    const shown = preview.preview();
    expect(shown.display.open).toBe(true);
    expect(shown.form.resumeBtn).toEqual({ x: 210, y: 990, w: 660, h: 120 });
    expect(shown.regions.map((region) => region.id)).toEqual(PAUSE_REGIONS.map((region) => region.id));
    expect(shown.display.profile).toEqual(PAUSE_CONTRACT.fingerprint);

    const saved = preview.save();
    expect(saved.checkpoint.screen).toBe("pause");
    expect(saved.checkpoint.pause.resumeBtn).toEqual({ x: 210, y: 990, w: 660, h: 120 });
    expect(saved.checkpoint.pause.quitBtn).toEqual(PAUSE_PUBLISHED.quitBtn);
    expect(saved.exportEnabled).toBe(false);
  });

  it("round-trips through the shell and calls existing buildTransfer/inspect without enabling export", () => {
    const preview = createPausePreview();
    preview.edit({ quitBtn: { x: 220, y: 1180, w: 640, h: 110 } });
    const trip = roundTripPause(preview);
    expect(trip.invoked).toBe(true);
    expect(trip.selected.screen).toBe("pause");
    expect(trip.preview.contextId).toBe("dream-guardian-ui-preview");
    expect(trip.snapshot.checkpoint.pause.quitBtn).toEqual({ x: 220, y: 1180, w: 640, h: 110 });
    expect(trip.export.ok).toBe(false);
    if (!trip.export.ok) expect(trip.export.reason).toBe("unregistered-screen-contract");
    expect(trip.inspection.accepted).toBe(false);
    expect(registerPausePreview().exportEnabled).toBe(false);
    expect(registerScreenContract(PAUSE_CONTRACT).exportEnabled).toBe(false);

    const blocked = buildTransfer({
      checkpoint: trip.snapshot.checkpoint,
      scope: "pause",
      sourceId: "uix-029",
      exportId: "uix-029-export",
      screen: "pause",
      version: PAUSE_CONTRACT.version,
      previewLinked: true,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unregistered-screen-contract");
    expect(inspectTransfer({ file: blocked }).accepted).toBe(false);
  });

  it("matches protected regions, coords, and profile across open, closed, mocked resume, and mocked menu", () => {
    const onResume = vi.fn();
    const onMenu = vi.fn();
    const onPause = vi.fn();
    const preview = createPausePreview({ onResume, onMenu, onPause });
    const ids = ["pause-open", "pause-closed", "pause-resume-mock", "pause-menu-mock"];
    expect(PAUSE_FIXTURES.map((fixture) => fixture.id)).toEqual(ids);

    for (const id of ids) {
      const shown = preview.loadFixture(id);
      expect(shown.ok).toBe(true);
      expect(shown.regions).toEqual(PAUSE_REGIONS);
      expect(shown.form.modal).toEqual(PAUSE_PUBLISHED.modal);
      expect(shown.form.resumeBtn).toEqual(PAUSE_PUBLISHED.resumeBtn);
      expect(shown.form.quitBtn).toEqual(PAUSE_PUBLISHED.quitBtn);
      expect(shown.display.profile).toBe(PAUSE_CONTRACT.fingerprint);
      expect(shown.display.invokesPause).toBe(false);
      expect(shown.display.profileInputs).toBe("closed");
      const fixture = PAUSE_FIXTURES.find((item) => item.id === id);
      expect(shown.display.open).toBe(fixture?.open);
      expect(shown.display.mockedResume).toBe(fixture?.mockedResume);
      expect(shown.display.mockedMenu).toBe(fixture?.mockedMenu);
    }

    expect(onResume).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
    const preset = clonePausePresetForEdit(PAUSE_BASELINE.id);
    expect(preset.modal).toEqual(PAUSE_PUBLISHED.modal);
    expect(preset.pauseAction.locked).toBe(true);
    expect(lookupScreenContract("pause", "1.0.0", "pause")).toMatchObject({
      registered: true,
      exportEnabled: false,
      supportStatus: "locked",
    });
  });

  it("locks unsupported fields and does not boot the game, touch storage, or invoke pause callbacks", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => []),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onResume = vi.fn();
    const onMenu = vi.fn();
    const onPause = vi.fn();
    const preview = createPausePreview({ storage, bootGame, camera, network, onResume, onMenu, onPause });

    const locked = preview.edit({
      pause: true,
      resume: true,
      quit: true,
      "quit-to-menu": true,
      profile: "open",
      unknownBaseline: "pause-v9",
      localStorage: "dream-guardian-save",
      indexedDB: "accessibility",
    });
    expect(locked.ok).toBe(false);
    expect(locked.editEnabled).toBe(false);
    expect(locked.exportEnabled).toBe(false);
    expect(locked.locks).toEqual(
      expect.arrayContaining([
        PAUSE_LOCK_REASONS.pauseBlocked,
        PAUSE_LOCK_REASONS.resumeBlocked,
        PAUSE_LOCK_REASONS.quitBlocked,
        PAUSE_LOCK_REASONS.profileClosed,
        PAUSE_LOCK_REASONS.unknownBaseline,
      ]),
    );
    expect(preview.form().dirty).toBe(false);
    expect(preview.form().modal).toEqual(PAUSE_PUBLISHED.modal);

    const unknown = preview.edit({ glow: 1 });
    expect(unknown.ok).toBe(false);
    expect(unknown.locks).toContain(PAUSE_LOCK_REASONS.unknownField);

    preview.preview();
    preview.save();
    preview.loadFixture("pause-open");
    preview.loadFixture("pause-resume-mock");
    preview.loadFixture("pause-menu-mock");
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    for (const key of GAME_KEYS_FORBIDDEN) {
      expect(storage.setItem).not.toHaveBeenCalledWith(key, expect.anything());
    }

    const source = readFileSync("src/editor/ui/preview/screens/UIPausePreview.ts", "utf8");
    expect(source).not.toMatch(/localStorage|indexedDB|SceneDirector|bootstrap/);
    expect(source).toMatch(/buildTransfer/);
    expect(source).toMatch(/inspectTransfer/);
    const adapter = readFileSync("src/editor/ui/preview/UIPreviewAdapter.ts", "utf8");
    expect(adapter).toMatch(/registerPausePreview/);
  });
});
