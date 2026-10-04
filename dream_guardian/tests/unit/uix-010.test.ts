import { describe, expect, it } from "vitest";
import { MENU_CARD_IDS } from "../../src/editor/ui/data/UIContracts";
import { BASELINE_REGISTRY, type MenuPreset } from "../../src/editor/ui/data/UIBaselines";

const MENU_V1_PRESET: MenuPreset = BASELINE_REGISTRY.preset;
import {
  GAME_APPLY_VERIFIED,
  STORAGE_TOUCHED,
  acceptRaw,
  commit,
  compare,
  createPropertyPanel,
  fieldMeta,
  setBuffer,
} from "../../src/editor/ui/UIPropertyPanel";

describe("UIX-010 property form buffer and shared size diff", () => {
  it("keeps empty and minus in the buffer without replacing the last valid preview", () => {
    const panel = createPropertyPanel({
      selectedId: "card-play",
      baseline: MENU_V1_PRESET,
      current: MENU_V1_PRESET,
    });
    const seeded = setBuffer(panel, "x", "42");
    expect(seeded.buffer.x).toBe("42");
    expect(seeded.preview.x).toBe(42);

    const empty = setBuffer(seeded, "x", "");
    expect(empty.buffer.x).toBe("");
    expect(empty.preview.x).toBe(42);

    const minus = setBuffer(seeded, "x", "-");
    expect(minus.buffer.x).toBe("-");
    expect(minus.preview.x).toBe(42);

    const invalid = setBuffer(seeded, "x", "nope");
    expect(invalid.buffer.x).toBe("nope");
    expect(invalid.preview.x).toBe(42);
    expect(setBuffer(seeded, "x", "-3").preview.x).toBe(42);
    expect(setBuffer(seeded, "x", "Infinity").preview.x).toBe(42);
    expect(setBuffer(seeded, "width", "12").preview.width).toBe(12);
  });

  it("commits only on enter or valid blur and reports shared size affecting all five cards", () => {
    const panel = createPropertyPanel({
      selectedId: "card-play",
      baseline: MENU_V1_PRESET,
      current: MENU_V1_PRESET,
    });
    const typed = setBuffer(panel, "width", "300");
    expect(commit(typed, { reason: "input" }).command).toBeNull();
    expect(commit(setBuffer(panel, "width", "-"), { reason: "blur" }).command).toBeNull();
    expect(commit(setBuffer(panel, "width", ""), { reason: "enter" }).command).toBeNull();

    const entered = commit(typed, { reason: "enter" });
    expect(entered.command).not.toBeNull();
    expect(entered.command?.field).toBe("width");
    expect(entered.command?.value).toBe(300);
    expect(entered.affectedIds).toHaveLength(5);
    expect(entered.affectedIds).toEqual([...MENU_CARD_IDS]);

    const blurred = commit(setBuffer(panel, "height", "160"), { reason: "blur" });
    expect(blurred.command?.field).toBe("height");
    expect(blurred.affectedIds).toHaveLength(5);

    const moved = commit(setBuffer(panel, "x", "88"), { reason: "enter" });
    expect(moved.affectedIds).toEqual(["card-play"]);
    expect(moved.affectedIds).toHaveLength(1);

    const workout = commit(
      setBuffer(createPropertyPanel({
        selectedId: "workout-button",
        baseline: MENU_V1_PRESET,
        current: MENU_V1_PRESET,
      }), "width", "410"),
      { reason: "enter" },
    );
    expect(workout.command?.target).toBe("workout-button");
    expect(workout.affectedIds).toEqual(["workout-button"]);
  });

  it("compares baseline, locks unsupported fields, links error labels, and accepts only registry fields", () => {
    const current = {
      ...MENU_V1_PRESET,
      width: 300,
      cards: MENU_V1_PRESET.cards.map((card) =>
        card.id === "card-play" ? { ...card, x: 90 } : { ...card },
      ),
    };
    const panel = createPropertyPanel({
      selectedId: "card-play",
      baseline: MENU_V1_PRESET,
      current,
    });
    expect(compare(panel, "width")).toEqual({
      changed: true,
      baseline: MENU_V1_PRESET.width,
      current: 300,
    });
    expect(compare(panel, "height").changed).toBe(false);
    expect(compare(panel, "x")).toMatchObject({ changed: true, current: 90 });

    const locked = fieldMeta(panel, "rotation");
    expect(locked.editable).toBe(false);
    expect(locked.lockReason.length).toBeGreaterThan(0);
    expect(locked.code).toBe("unknown-field");

    const bad = setBuffer(panel, "y", "abc");
    expect(bad.error).toMatchObject({
      errorLabelId: "err-y",
      message: expect.any(String),
    });

    expect(acceptRaw('{"__proto__":1}').ok).toBe(false);
    expect(acceptRaw('{"constructor":1}').ok).toBe(false);
    expect(acceptRaw('{"prototype":1}').ok).toBe(false);
    expect(acceptRaw('{"x":1,"x":2}').ok).toBe(false);
    expect(acceptRaw(`{"name":"${"n".repeat(81)}"}`).ok).toBe(false);
    expect(acceptRaw(`{"blob":"${"a".repeat(1_100_000)}"}`).ok).toBe(false);
    let deep = "1";
    for (let i = 0; i < 20; i += 1) deep = `{"n":${deep}}`;
    expect(acceptRaw(deep).ok).toBe(false);
    expect(acceptRaw('{"x":12,"y":34}').ok).toBe(true);

    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(STORAGE_TOUCHED).toBe(false);
  });
});
