import { describe, expect, it } from "vitest";
import { contentHash } from "../../src/editor/ui/data/UICanonicalJSON";
import {
  BASELINE_REGISTRY,
  SUBMENU_BASELINE,
  clonePresetForEdit,
  cloneSubmenuPresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  SUBMENU_SCREEN_ID,
  lookupScreenContract,
  registerScreenContract,
  resolveSubmenuProperty,
} from "../../src/editor/ui/data/UIProperties";
import {
  SUBMENU_BACK_ID,
  SUBMENU_CELL_IDS,
  SUBMENU_CONTRACT,
  SUBMENU_FIXTURES,
  SUBMENU_GRID,
  SUBMENU_LOCK_REASONS,
  deriveSubmenuCell,
} from "../../src/editor/ui/data/screens/UISubmenuContract";

describe("UIX-018 submenu support contract", () => {
  it("is a 2-column shared-size grid, not free per-card placement", () => {
    expect(SUBMENU_CONTRACT.screen).toBe("submenu");
    expect(SUBMENU_SCREEN_ID).toBe("submenu");
    expect(SUBMENU_GRID.cols).toBe(2);
    expect(SUBMENU_GRID.w).toBe(420);
    expect(SUBMENU_GRID.h).toBe(380);
    expect(SUBMENU_CONTRACT.placement).toBe("grid");
    expect(SUBMENU_CONTRACT.cardFields).not.toContain("x");
    expect(SUBMENU_CONTRACT.cardFields).not.toContain("y");
    const cell = deriveSubmenuCell(1);
    expect(cell).toEqual({ id: "submenu-cell-1", col: 1, row: 0, x: 580, y: 440, width: 420, height: 380 });
    expect(cell.x).toBe(SUBMENU_GRID.startX + (SUBMENU_GRID.w + SUBMENU_GRID.gapX));
  });

  it("fixes cell ids and protects the back button region", () => {
    expect(SUBMENU_CELL_IDS).toEqual([
      "submenu-cell-0",
      "submenu-cell-1",
      "submenu-cell-2",
      "submenu-cell-3",
      "submenu-cell-4",
      "submenu-cell-5",
    ]);
    expect(SUBMENU_BACK_ID).toBe("submenu-back");
    const back = SUBMENU_CONTRACT.protectedRegions.find((region) => region.id === SUBMENU_BACK_ID);
    expect(back).toEqual({ id: "submenu-back", x: 780, y: 1990, width: 270, height: 140 });
    const title = SUBMENU_CONTRACT.protectedRegions.find((region) => region.id === "submenu-title");
    expect(title).toEqual({ id: "submenu-title", x: 80, y: 160, width: 920, height: 200 });
  });

  it("locks unsupported props with a reason and blocks export", () => {
    expect(resolveSubmenuProperty("x").locked).toBe(true);
    expect(resolveSubmenuProperty("x").reason).toBe(SUBMENU_LOCK_REASONS.freeCardXY);
    expect(resolveSubmenuProperty("color").reason).toBe(SUBMENU_LOCK_REASONS.arbitraryColor);
    expect(resolveSubmenuProperty("src").reason).toBe(SUBMENU_LOCK_REASONS.assetPath);
    expect(resolveSubmenuProperty("hp").reason).toBe(SUBMENU_LOCK_REASONS.gameStat);
    expect(resolveSubmenuProperty("mystery").reason).toBe(SUBMENU_LOCK_REASONS.unknownField);
    expect(resolveSubmenuProperty("cols").locked).toBe(false);
    expect(SUBMENU_CONTRACT.exportEnabled).toBe(false);
    const lookedUp = lookupScreenContract("submenu", "1.0.0", "submenu");
    if (!("exportEnabled" in lookedUp)) throw new Error("submenu contract missing");
    expect(lookedUp.exportEnabled).toBe(false);
  });

  it("keeps a stable baseline hash and a non-mutating clone", () => {
    const frozen = SUBMENU_BASELINE.preset;
    const hash = contentHash(frozen);
    expect(SUBMENU_BASELINE.presetHash).toBe(hash);
    expect(SUBMENU_BASELINE.id).toBe("submenu-v1");
    const clone = cloneSubmenuPresetForEdit("submenu-v1");
    clone.grid.startX = 1;
    expect(frozen.grid.startX).toBe(80);
    expect(contentHash(frozen)).toBe(hash);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it("closes long-name and selection-state fixture inputs", () => {
    const longName = SUBMENU_FIXTURES.find((fixture) => fixture.id === "submenu-long-name");
    const selected = SUBMENU_FIXTURES.find((fixture) => fixture.id === "submenu-selection");
    expect(longName?.closed).toBe(true);
    expect(longName?.profile).toBe("long-name");
    expect(longName?.label.length).toBeGreaterThan(40);
    expect(selected?.closed).toBe(true);
    expect(selected?.profile).toBe("selection-state");
    expect(selected?.selectedId).toBe("submenu-cell-0");
    expect(Object.isFrozen(SUBMENU_FIXTURES)).toBe(true);
  });

  it("does not enable export when submenu is registered", () => {
    const again = registerScreenContract({ screen: "submenu", version: "1.0.0", scope: "submenu" });
    expect(again.accepted).toBe(false);
    const found = lookupScreenContract("submenu", "1.0.0", "submenu");
    if (!("supportStatus" in found)) throw new Error("submenu contract missing");
    expect(found.registered).toBe(true);
    expect(found.supportStatus).toBe("locked");
    expect(found.editEnabled).toBe(false);
    expect(found.exportEnabled).toBe(false);
    expect(found.version).toBe("1.0.0");
  });

  it("still clones the V1 menu baseline", () => {
    const menu = clonePresetForEdit(BASELINE_REGISTRY.id);
    expect(menu.cards).toHaveLength(5);
    expect(menu.width).toBe(BASELINE_REGISTRY.preset.width);
    menu.cards[0].x = 1;
    expect(BASELINE_REGISTRY.preset.cards[0].x).not.toBe(1);
    const menuContract = lookupScreenContract("menu", "1.0.0", "menu");
    if (!("exportEnabled" in menuContract)) throw new Error("menu contract missing");
    expect(menuContract.exportEnabled).toBe(false);
  });
});
