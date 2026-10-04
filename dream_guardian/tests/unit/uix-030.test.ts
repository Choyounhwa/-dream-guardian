import { describe, expect, it } from "vitest";
import {
  DESIGN_SIZE,
  KINDS,
  MENU_CARD_IDS,
  SCHEMA_VERSION,
  assertProjectContract,
} from "../../src/editor/ui/data/UIContracts";
import {
  MENU_SHARED_SIZE_FIELDS,
  WORKOUT_BUTTON_FIELDS,
  consumeScreenContract,
  listScreenFixtures,
  lookupScreenContract,
  registerScreenContract,
} from "../../src/editor/ui/data/UIProperties";
import {
  PROTECTED_REGIONS,
  formFieldsForContract,
  validateAgainstRegistry,
} from "../../src/editor/ui/data/UIValidator";

function menuProject(extra: Record<string, unknown> = {}) {
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
    menu: {
      cards: MENU_CARD_IDS.map((id, index) => ({ id, x: 40 + index * 10, y: 120 })),
      width: 280,
      height: 360,
      workoutButton: { x: 100, y: 1800, width: 400, height: 120 },
    },
    ...extra,
  };
}

describe("UIX-030 closed screen contracts", () => {
  it("rejects unregistered screen, version, and scope combinations", () => {
    expect(lookupScreenContract("menu", "1.0.0", "menu").registered).toBe(true);
    expect(lookupScreenContract("battle", "1.0.0", "battle").registered).toBe(false);
    expect(lookupScreenContract("menu", "9.9.9", "menu").registered).toBe(false);
    expect(lookupScreenContract("menu", "1.0.0", "hud").registered).toBe(false);
    expect(registerScreenContract({ screen: "secret", version: "1.0.0", scope: "secret" }).accepted).toBe(false);
  });

  it("keeps the V1 menu project shape and rejects unsupported fields", () => {
    expect(assertProjectContract(menuProject()).ok).toBe(true);
    expect(assertProjectContract(menuProject({ menu: { ...menuProject().menu, opacity: 0.2 } })).ok).toBe(false);
    const contract = lookupScreenContract("menu", "1.0.0", "menu");
    if (!("requiredFields" in contract)) throw new Error("menu contract missing");
    expect(contract.requiredFields).toEqual(["cards", ...MENU_SHARED_SIZE_FIELDS, "workoutButton"]);
    expect(contract.cardFields).toEqual(["id", "x", "y"]);
    expect(contract.workoutFields).toEqual([...WORKOUT_BUTTON_FIELDS]);
    expect(contract.supportStatus).toBe("supported");
  });

  it("does not enable edit or export by registration alone", () => {
    const registered = registerScreenContract({
      screen: "menu",
      version: "1.0.0",
      scope: "menu",
    });
    expect(registered.accepted).toBe(true);
    expect(registered.editEnabled).toBe(false);
    expect(registered.exportEnabled).toBe(false);
    const lookedUp = lookupScreenContract("menu", "1.0.0", "menu");
    if (!("editEnabled" in lookedUp)) throw new Error("menu contract missing");
    expect(lookedUp.editEnabled).toBe(false);
    expect(lookedUp.exportEnabled).toBe(false);
  });

  it("lets form and validator consume registry required fields and support status", () => {
    const fields = formFieldsForContract("menu", "1.0.0", "menu");
    expect(fields.ok).toBe(true);
    if (fields.ok) {
      expect(fields.required).toEqual(["cards", "width", "height", "workoutButton"]);
      expect(fields.supportStatus).toBe("supported");
      expect(fields.locked).toContain("opacity");
    }
    expect(formFieldsForContract("ending", "1.0.0", "ending").ok).toBe(false);
    expect(validateAgainstRegistry(menuProject(), "menu", "1.0.0", "menu").ok).toBe(true);
    expect(validateAgainstRegistry(menuProject(), "records", "1.0.0", "records").ok).toBe(false);
    const unsupported = menuProject({ menu: { ...menuProject().menu, label: "nope" } });
    expect(validateAgainstRegistry(unsupported, "menu", "1.0.0", "menu").ok).toBe(false);
  });

  it("exposes closed per-screen fingerprints, protected regions, and fixtures without deep merge", () => {
    const contract = lookupScreenContract("menu", "1.0.0", "menu");
    if (!("fingerprint" in contract)) throw new Error("menu contract missing");
    expect(contract.fingerprint).toMatch(/^menu@1\.0\.0:/);
    expect(contract.protectedRegions.length).toBeGreaterThan(0);
    expect(PROTECTED_REGIONS.some((region) => region.id === contract.protectedRegions[0].id)).toBe(true);
    const fixtures = listScreenFixtures("menu", "1.0.0");
    expect(fixtures.map((fixture) => fixture.id)).toContain("menu-v1-default");
    expect(fixtures.every((fixture) => fixture.closed === true)).toBe(true);
    const consumed = consumeScreenContract("menu", "1.0.0", "menu");
    expect("deepMerge" in consumed).toBe(false);
    expect("merge" in consumed).toBe(false);
  });
});
