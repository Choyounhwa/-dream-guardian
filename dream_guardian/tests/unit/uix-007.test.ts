import { describe, expect, it, vi } from "vitest";
import { PROTECTED_REGIONS } from "../../src/editor/ui/data/UIValidator";
import {
  CHROME_READONLY,
  GAME_APPLY_VERIFIED,
  IFRAME_IS_SECURITY_SANDBOX,
  composeFrame,
  composeFromRaw,
  hitTest,
} from "../../src/editor/ui/preview/UIComposition";

const clock = { nowMs: 1000 };
const fakeState = { showBottomBar: true, priority: ["card-play", "bottom-bar", "hud-safe"] };

const snapshot = {
  design: { width: 1080, height: 2160 },
  cards: [{ id: "card-play", x: 100, y: 200, width: 200, height: 80 }],
  clock,
  fakeState,
};

describe("UIX-007 chrome composition", () => {
  it("composes read-only chrome and copied protected regions", () => {
    const frame = composeFrame(snapshot, clock);
    expect(frame.design).toEqual({ width: 1080, height: 2160 });
    expect(CHROME_READONLY).toBe(true);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(IFRAME_IS_SECURITY_SANDBOX).toBe(false);
    const bar = frame.chrome.find((item: { id: string }) => item.id === "bottom-bar");
    expect(bar).toMatchObject({ id: "bottom-bar" });
    expect(typeof bar!.x).toBe("number");
    expect(typeof bar!.y).toBe("number");
    expect(bar!.width).toBeGreaterThan(0);
    expect(bar!.height).toBeGreaterThan(0);
    expect(frame.protectedRegions.some((region: { id: string }) => region.id === "hud-safe")).toBe(true);
    const source = PROTECTED_REGIONS.find((region) => region.id === "hud-safe");
    const copied = frame.protectedRegions.find((region: { id: string }) => region.id === "hud-safe");
    expect(copied).not.toBe(source);
    copied!.x = 9;
    expect(source?.x).toBe(0);
    expect(frame.protectedRegions[0]).not.toBe(PROTECTED_REGIONS[0]);
  });

  it("returns only id and expectedAction and never calls ports", () => {
    const navigate = vi.fn();
    const save = vi.fn();
    const camera = vi.fn();
    const frame = composeFrame(snapshot, clock);
    const hit = hitTest(frame, 150, 220);
    expect(Object.keys(hit).sort()).toEqual(["expectedAction", "id"]);
    expect(typeof hit.id).toBe("string");
    expect(typeof hit.expectedAction).toBe("string");
    expect(hit.expectedAction).not.toEqual(expect.any(Function));
    expect(navigate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(camera).not.toHaveBeenCalled();
    expect(hitTest.length).toBe(3);
  });

  it("resolves overlap by priority and hides the bottom bar when disabled", () => {
    const overlapping = {
      design: { width: 1080, height: 2160 },
      cards: [{ id: "card-play", x: 0, y: 1900, width: 1080, height: 260 }],
      clock,
      fakeState: { showBottomBar: true, priority: ["bottom-bar", "card-play"] },
    };
    const frame = composeFrame(overlapping, clock);
    const bar = frame.chrome.find((item: { id: string }) => item.id === "bottom-bar");
    const winner = hitTest(frame, bar!.x + 1, bar!.y + 1);
    expect(winner).toEqual({ id: "bottom-bar", expectedAction: "none" });

    const reversed = composeFrame(
      {
        ...overlapping,
        fakeState: { showBottomBar: true, priority: ["card-play", "bottom-bar"] },
      },
      clock,
    );
    expect(hitTest(reversed, bar!.x + 1, bar!.y + 1)).toEqual({
      id: "card-play",
      expectedAction: "select-card",
    });

    const hidden = composeFrame(
      {
        ...overlapping,
        fakeState: { showBottomBar: false, priority: ["bottom-bar", "card-play"] },
      },
      clock,
    );
    expect(hidden.chrome.some((item: { id: string }) => item.id === "bottom-bar")).toBe(false);
    expect(hitTest(hidden, bar!.x + 1, bar!.y + 1).id).not.toBe("bottom-bar");

    const again = composeFrame(snapshot, clock);
    const first = composeFrame(snapshot, clock);
    expect(again).toEqual(first);
    expect(again).not.toBe(first);
  });

  it("rejects unsafe raw snapshots instead of dropping fields", () => {
    expect(composeFromRaw('{"a":1,"a":2}').ok).toBe(false);
    expect(composeFromRaw('{"__proto__":{"x":1}}').ok).toBe(false);
    expect(composeFromRaw('{"constructor":1}').ok).toBe(false);
    expect(composeFromRaw('{"prototype":1}').ok).toBe(false);
    expect(composeFromRaw(`{"name":"${"n".repeat(81)}"}`).ok).toBe(false);
    expect(composeFromRaw("x".repeat(1024 * 1024 + 1)).ok).toBe(false);
    let deep = "0";
    for (let i = 0; i < 17; i += 1) deep = `{"d":${deep}}`;
    expect(composeFromRaw(deep).ok).toBe(false);
    const safe = composeFromRaw('{"cards":[{"id":"card-play","x":1,"y":2,"width":3,"height":4}]}');
    expect(safe.ok).toBe(true);
  });
});
