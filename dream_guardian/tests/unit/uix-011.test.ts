import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/editor/ui/data/UIContracts";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  GAME_APPLY_VERIFIED,
  NUDGE_PX,
  SHIFT_NUDGE_PX,
  SNAP_PX,
  STORAGE_TOUCHED,
  acceptRaw,
  applyNudge,
  beginDrag,
  cancelDrag,
  commitDrag,
  cssToDesign,
  designToCss,
  updateDrag,
} from "../../src/editor/ui/UIInteraction";
import {
  IFRAME_IS_SECURITY_SANDBOX,
  PREVIEW_KINDS,
  PREVIEW_SOURCE,
  acceptPreviewMessage,
  enterReadonlyInspection,
  exitReadonlyInspection,
  issueRequest,
  replaceDocument,
} from "../../src/editor/ui/UIPreviewHost";

const VIEW = { dpr: 2, zoomPercent: 50 };

describe("UIX-011 pointer transform and preview message checks", () => {
  it("round-trips css and design for dpr 1/2/3 and zoom 50/100/150", () => {
    expect(DESIGN_WIDTH).toBe(1080);
    expect(DESIGN_HEIGHT).toBe(2160);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(STORAGE_TOUCHED).toBe(false);

    const samples = [0, 100, 540];
    for (const dpr of [1, 2, 3]) {
      for (const zoomPercent of [50, 100, 150]) {
        for (const css of samples) {
          const design = cssToDesign(css, css, { dpr, zoomPercent });
          const back = designToCss(design.x, design.y, { dpr, zoomPercent });
          expect(back).toEqual({ x: css, y: css });
          expect(design.x * dpr * (zoomPercent / 100)).toBe(css * dpr);
        }
      }
    }

    const even = cssToDesign(100, 100, VIEW);
    expect(even).toEqual({ x: 200, y: 200 });
    expect(designToCss(200, 200, VIEW)).toEqual({ x: 100, y: 100 });
  });

  it("restores pre-drag position on cancel paths and nudges unless the form has focus", () => {
    expect(NUDGE_PX).toBe(1);
    expect(SHIFT_NUDGE_PX).toBe(10);
    expect(SNAP_PX).toBe(10);

    const origin = { x: 40, y: 80 };
    const session = beginDrag(origin, "card-play");
    const moved = updateDrag(session, { x: 55, y: 91 });
    expect(moved.position).toEqual({ x: 55, y: 91 });
    expect(commitDrag(moved).position).toEqual({ x: 55, y: 91 });

    for (const reason of ["pointercancel", "lostpointercapture", "Escape"] as const) {
      const dragging = updateDrag(beginDrag(origin, "card-play"), { x: 70, y: 12 });
      expect(cancelDrag(dragging, reason).position).toEqual(origin);
    }

    expect(applyNudge(origin, "ArrowRight", { shift: false, snapEnabled: false, formHasFocus: false })).toEqual({
      x: 41,
      y: 80,
    });
    expect(applyNudge(origin, "ArrowUp", { shift: true, snapEnabled: false, formHasFocus: false })).toEqual({
      x: 40,
      y: 70,
    });
    expect(applyNudge({ x: 14, y: 6 }, "ArrowRight", { shift: false, snapEnabled: true, formHasFocus: false })).toEqual({
      x: 20,
      y: 6,
    });
    expect(applyNudge(origin, "ArrowLeft", { shift: true, snapEnabled: false, formHasFocus: true })).toEqual(origin);
    expect(cancelDrag(updateDrag(beginDrag(origin, "card-play", { formHasFocus: true }), { x: 9, y: 9 }), "pointercancel").position).toEqual(
      origin,
    );
  });

  it("rejects bad preview envelopes, discards stale responses, and restores readonly with a token", () => {
    expect(IFRAME_IS_SECURITY_SANDBOX).toBe(false);
    expect(PREVIEW_SOURCE).toBe("dream-guardian-ui-preview");
    expect(PREVIEW_KINDS).toEqual(["preview:update", "preview:result"]);

    const allow = ["https://editor.local"];
    const host = issueRequest({ docId: "doc-a", origin: allow[0] });
    const good = {
      origin: allow[0],
      source: PREVIEW_SOURCE,
      kind: "preview:result",
      requestId: host.requestId,
      payload: { ok: true },
    };
    expect(acceptPreviewMessage(host, good, allow).applied).toBe(true);

    expect(acceptPreviewMessage(host, { ...good, origin: "https://evil.example" }, allow).applied).toBe(false);
    expect(acceptPreviewMessage(host, { ...good, source: "other" }, allow).applied).toBe(false);
    expect(acceptPreviewMessage(host, { ...good, kind: "preview:apply" }, allow).applied).toBe(false);
    expect(acceptPreviewMessage(host, { origin: allow[0], source: PREVIEW_SOURCE }, allow).applied).toBe(false);

    const replaced = replaceDocument(host, "doc-b");
    const stale = acceptPreviewMessage(replaced, good, allow);
    expect(stale).toEqual({ applied: false, reason: "stale-document" });

    const entered = enterReadonlyInspection({ readonly: false, docId: "doc-b" });
    expect(entered.session.readonly).toBe(true);
    expect(exitReadonlyInspection(entered.session, "wrong-token").readonly).toBe(true);
    expect(exitReadonlyInspection(entered.session, entered.token).readonly).toBe(false);
  });

  it("rejects dangerous keys, duplicates, 1MiB, depth 16, and names over 80", () => {
    expect(LIMITS.maxBytes).toBe(1_048_576);
    expect(acceptRaw('{"__proto__":1}').ok).toBe(false);
    expect(acceptRaw('{"constructor":1}').ok).toBe(false);
    expect(acceptRaw('{"prototype":1}').ok).toBe(false);
    expect(acceptRaw('{"x":1,"x":2}').ok).toBe(false);
    expect(acceptRaw(`{"name":"${"n".repeat(81)}"}`).ok).toBe(false);
    expect(acceptRaw(`{"blob":"${"a".repeat(1_100_000)}"}`).ok).toBe(false);
    let deep = "1";
    for (let i = 0; i < 17; i += 1) deep = `{"k":${deep}}`;
    expect(acceptRaw(deep).ok).toBe(false);
    expect(acceptRaw('{"x":12,"y":34}').ok).toBe(true);
    expect(GAME_APPLY_VERIFIED).toBe(false);
  });
});
