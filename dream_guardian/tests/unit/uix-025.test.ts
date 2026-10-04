import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { RESULT_BASELINE, cloneResultPresetForEdit } from "../../src/editor/ui/data/UIBaselines";
import { lookupScreenContract, registerScreenContract } from "../../src/editor/ui/data/UIProperties";
import {
  RESULT_CONTRACT,
  RESULT_FIXTURES,
  RESULT_LOCK_REASONS,
  RESULT_PUBLISHED,
  RESULT_REGIONS,
  attemptPersistResultRecord,
} from "../../src/editor/ui/data/screens/UIResultContract";
import { buildTransfer } from "../../src/editor/ui/data/UITransferBuilder";
import { inspectTransfer } from "../../src/editor/ui/io/UITransferInspector";
import { GAME_KEYS_FORBIDDEN } from "../../src/editor/ui/preview/UIPreviewAdapter";
import { roundTripResult } from "../../src/editor/ui/UIEditorShell";
import {
  RESULT_PREVIEW_ID,
  createResultPreview,
  registerResultPreview,
} from "../../src/editor/ui/preview/screens/UIResultPreview";

describe("UIX-025 result preview edit export", () => {
  it("selects result into a registry form, undoes, previews, and snapshots", () => {
    const preview = createResultPreview();
    const selected = preview.select();
    expect(selected.screen).toBe("result");
    expect(selected.registry.registered).toBe(true);
    if ("exportEnabled" in selected.registry) expect(selected.registry.exportEnabled).toBe(false);
    expect(selected.editEnabled).toBe(false);
    expect(selected.exportEnabled).toBe(false);
    expect(selected.form.statLineHeight).toBe(RESULT_PUBLISHED.statLineHeight);
    expect(selected.form.panel).toEqual(RESULT_PUBLISHED.panel);

    const edited = preview.edit({ statLineHeight: 80 });
    expect(edited.ok).toBe(true);
    expect(edited.editEnabled).toBe(false);
    expect(edited.exportEnabled).toBe(false);
    expect(preview.form().statLineHeight).toBe(80);
    expect(preview.form().dirty).toBe(true);

    preview.undo();
    expect(preview.form().statLineHeight).toBe(RESULT_PUBLISHED.statLineHeight);
    expect(preview.form().dirty).toBe(false);

    const drawn = preview.preview();
    expect(drawn.contextId).toBe("dream-guardian-ui-preview");
    expect(drawn.bootedGame).toBe(false);
    const snapshot = preview.save();
    expect(snapshot.checkpoint.screen).toBe("result");
    expect(snapshot.checkpoint.result.statLineHeight).toBe(RESULT_PUBLISHED.statLineHeight);
    expect(snapshot.checkpoint.result.panel).toEqual(RESULT_PUBLISHED.panel);
  });

  it("round-trips through the shell and calls existing buildTransfer/inspect without enabling export", () => {
    const preview = createResultPreview();
    preview.edit({ statLineHeight: 82 });
    const trip = roundTripResult(preview);
    expect(trip.invoked).toBe(true);
    expect(trip.selected.screen).toBe("result");
    expect(trip.preview.contextId).toBe("dream-guardian-ui-preview");
    expect(trip.snapshot.checkpoint.result.statLineHeight).toBe(82);
    expect(trip.export.ok).toBe(false);
    if (!trip.export.ok) expect(trip.export.reason).toBe("unregistered-screen-contract");
    expect(trip.inspection.accepted).toBe(false);

    const direct = buildTransfer({
      checkpoint: trip.snapshot.checkpoint,
      scope: "result",
      sourceId: "uix-025",
      exportId: "uix-025-export",
      screen: "result",
      version: RESULT_CONTRACT.version,
      previewLinked: true,
    });
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.reason).toBe("unregistered-screen-contract");
    const inspected = inspectTransfer({
      file: { kind: "dream-guardian-ui-transfer", validation: { passed: true } },
      originalCheckpoint: trip.snapshot.checkpoint,
    });
    expect(inspected.accepted).toBe(false);
  });

  it("keeps protected regions, coords, and profile across victory, defeat, long stats, and rank", () => {
    const preview = createResultPreview();
    const baseline = cloneResultPresetForEdit(RESULT_BASELINE.id);
    expect(RESULT_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "result-victory",
      "result-defeat",
      "result-long-stats",
      "result-rank",
    ]);
    for (const fixture of RESULT_FIXTURES) {
      preview.loadFixture(fixture.id);
      const form = preview.form();
      expect(form.panel).toEqual(baseline.panel);
      expect(form.title).toEqual(baseline.title);
      expect(form.stars).toEqual(baseline.stars);
      expect(form.chapter).toEqual(baseline.chapter);
      expect(form.statLineHeight).toBe(baseline.statLineHeight);
      expect(form.display.profile).toBe(RESULT_CONTRACT.fingerprint);
      expect(form.display.outcome).toBe(fixture.outcome);
      expect(form.regions).toEqual(RESULT_REGIONS);
      expect(form.regions.every((region) => region.locked)).toBe(true);
      expect(form.display.stats).toBe(fixture.stats);
      if (fixture.id === "result-long-stats") {
        expect(fixture.stats.length).toBeGreaterThan(40);
      }
      if (fixture.rank !== undefined) {
        expect(form.display.rank).toBe(fixture.rank);
      }
    }
  });

  it("locks unsupported fields, blocks record persistence, and does not touch game storage or boot", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      keys: vi.fn(() => ["dream-guardian-save", "settings", "accessibility", "choreography"]),
    };
    const bootGame = vi.fn();
    const camera = { start: vi.fn() };
    const network = { send: vi.fn() };
    const onDanger = vi.fn();
    const preview = createResultPreview({ storage, bootGame, camera, network, onDanger });
    const locked = preview.edit({
      color: "#fff",
      file: "a.png",
      unknownBaseline: "x",
      profile: "open",
      outcome: "victory",
      recordWrite: false,
    });
    expect(locked.ok).toBe(false);
    expect(locked.editEnabled).toBe(false);
    expect(locked.exportEnabled).toBe(false);
    expect(locked.locks).toContain(RESULT_LOCK_REASONS.unknownField);
    expect(locked.locks).toContain(RESULT_LOCK_REASONS.unknownBaseline);
    expect(locked.locks).toContain(RESULT_LOCK_REASONS.profileClosed);
    expect(locked.locks).toContain(RESULT_LOCK_REASONS.recordWriteBlocked);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(bootGame).not.toHaveBeenCalled();
    expect(camera.start).not.toHaveBeenCalled();
    expect(network.send).not.toHaveBeenCalled();
    expect(onDanger).not.toHaveBeenCalled();
    for (const key of ["settings", "dream-guardian-save", "accessibility", "choreography", ...GAME_KEYS_FORBIDDEN]) {
      expect(storage.setItem.mock.calls.map((call) => call[0])).not.toContain(key);
    }

    preview.loadFixture("result-victory");
    expect(attemptPersistResultRecord(preview.form().display).persisted).toBe(false);
    expect(preview.fixturePersistsRecords("result-victory")).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();

    const registered = registerResultPreview();
    expect(registered.screen).toBe(RESULT_PREVIEW_ID);
    expect(registered.editEnabled).toBe(false);
    expect(registered.exportEnabled).toBe(false);
    expect(registered.linked).toBe(false);
    const blocked = buildTransfer({
      checkpoint: { screen: "result" },
      scope: "result",
      sourceId: "uix-025-reg",
      exportId: "uix-025-reg",
      screen: "result",
      version: RESULT_CONTRACT.version,
      previewLinked: false,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unregistered-screen-contract");
    const again = registerScreenContract({ screen: "result", version: RESULT_CONTRACT.version, scope: "result" });
    expect(again.editEnabled).toBe(false);
    expect(again.exportEnabled).toBe(false);
    const looked = lookupScreenContract("result", RESULT_CONTRACT.version, "result");
    if ("exportEnabled" in looked) expect(looked.exportEnabled).toBe(false);
    if ("supportStatus" in looked) expect(looked.supportStatus).toBe("locked");
  });

  it("does not import game bootstrap, camera, or SceneDirector", () => {
    const source = readFileSync(new URL("../../src/editor/ui/preview/screens/UIResultPreview.ts", import.meta.url), "utf8");
    const adapter = readFileSync(new URL("../../src/editor/ui/preview/UIPreviewAdapter.ts", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../../src/editor/ui/UIEditorShell.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/AppBootstrap|SceneDirector|dream-guardian-save|accessibility|choreography|settings|localStorage|indexedDB/);
    expect(source).not.toMatch(/from ["'].*\/(game|camera|motion)\//);
    expect(adapter).not.toMatch(/from ["'].*SceneDirector/);
    expect(adapter).not.toMatch(/from ["'].*\/game\//);
    expect(shell).toMatch(/roundTripResult/);
  });
});
