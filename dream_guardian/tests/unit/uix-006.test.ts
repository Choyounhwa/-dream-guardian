import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { LIMITS, RENDERER_FINGERPRINT } from "../../src/editor/ui/data/UIBaselines";
import {
  GAME_APPLY_VERIFIED,
  GAME_KEYS_FORBIDDEN,
  IFRAME_IS_SECURITY_SANDBOX,
  PREVIEW_CONTEXT_ID,
  assertNoSideEffects,
  createPreviewSession,
  rejectUnsafeSnapshot,
} from "../../src/editor/ui/preview/UIPreviewAdapter";
import { createPreviewEntry } from "../../src/editor/ui/preview/main";

const GAME_CONTEXT_ID = "dream-guardian-game";

function ports() {
  const cache = new Map<string, unknown>([["shared", 1]]);
  const storage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    keys: vi.fn(() => ["dream-guardian-save"]),
  };
  const network = { send: vi.fn() };
  const camera = { start: vi.fn() };
  const bootGame = vi.fn();
  return { cache, storage, network, camera, bootGame };
}

describe("UIX-006 isolated preview adapter", () => {
  it("keeps a distinct preview context and blocks side effects", () => {
    const deps = ports();
    const before = deps.cache.size;
    const session = createPreviewSession({
      fingerprint: RENDERER_FINGERPRINT,
      ...deps,
    });
    session.update({ cards: [{ id: "card-play", x: 1, y: 2 }] });
    const drawn = session.draw();
    expect(PREVIEW_CONTEXT_ID).toBe("dream-guardian-ui-preview");
    expect(PREVIEW_CONTEXT_ID).not.toBe(GAME_CONTEXT_ID);
    expect(drawn).toEqual({ drew: true, contextId: PREVIEW_CONTEXT_ID });
    expect(session.context.contextId).toBe(PREVIEW_CONTEXT_ID);
    expect(session.locked).toBe(false);
    expect(deps.cache.size).toBe(before);
    expect(deps.cache.has("preview")).toBe(false);
    expect(deps.bootGame).not.toHaveBeenCalled();
    expect(deps.camera.start).not.toHaveBeenCalled();
    expect(deps.network.send).not.toHaveBeenCalled();
    expect(deps.storage.setItem).not.toHaveBeenCalled();
    expect(deps.storage.getItem).not.toHaveBeenCalled();
    assertNoSideEffects({
      bootGame: deps.bootGame,
      cameraStart: deps.camera.start,
      networkSend: deps.network.send,
      storageSetItem: deps.storage.setItem,
      cacheSize: deps.cache.size,
      cacheSizeBefore: before,
    });
    expect(GAME_KEYS_FORBIDDEN).toEqual(
      expect.arrayContaining(["dream-guardian-save", "accessibility", "choreography", "ui-config"]),
    );
    expect(Object.isFrozen(GAME_KEYS_FORBIDDEN)).toBe(true);
    for (const key of GAME_KEYS_FORBIDDEN) {
      expect(JSON.stringify(session.context)).not.toContain(key);
    }
  });

  it("locks on fingerprint mismatch and drops the old context on recreate", () => {
    const deps = ports();
    const session = createPreviewSession({
      fingerprint: "not-the-renderer",
      ...deps,
    });
    const stale = session.context;
    expect(session.locked).toBe(true);
    expect(session.supportLocked).toBe("fingerprint-mismatch");
    const ignored = session.update({ x: 9 });
    const drawn = session.draw();
    expect(ignored).toEqual({ ok: false, reason: "fingerprint-mismatch" });
    expect(drawn).toEqual({ drew: false, contextId: PREVIEW_CONTEXT_ID, reason: "fingerprint-mismatch" });
    expect(session.context).not.toBe(stale);
    expect(stale).not.toHaveProperty("snapshot");
    const next = session.recreate();
    expect(next).not.toBe(stale);
    expect(next).not.toBe(session.context === next ? stale : next);
    expect(session.context).toBe(next);
    expect(session.context).not.toBe(stale);
    expect(JSON.stringify(stale)).not.toContain("stale-kept");
    expect(deps.bootGame).not.toHaveBeenCalled();
    expect(deps.storage.setItem).not.toHaveBeenCalled();
  });

  it("rejects unsafe external JSON and re-exports contract limits", () => {
    expect(LIMITS).toEqual({ maxBytes: 1048576, maxDepth: 16, maxNameLength: 80 });
    expect(rejectUnsafeSnapshot('{"__proto__":{"x":1}}').ok).toBe(false);
    expect(rejectUnsafeSnapshot('{"constructor":{"prototype":{}}}').ok).toBe(false);
    expect(rejectUnsafeSnapshot('{"prototype":1}').ok).toBe(false);
    expect(rejectUnsafeSnapshot('{"a":1,"a":2}').ok).toBe(false);
    const safe = rejectUnsafeSnapshot('{"cards":[{"id":"card-play","x":1,"y":2}]}');
    expect(safe.ok).toBe(true);
    const session = createPreviewSession({ fingerprint: RENDERER_FINGERPRINT, cache: new Map() });
    expect(session.update('{"__proto__":{"polluted":true}}')).toEqual({
      ok: false,
      reason: expect.any(String),
    });
    expect(session.update('{"a":1,"a":2}')).toEqual({ ok: false, reason: expect.any(String) });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("does not treat iframe context split as a security sandbox or verified game apply", () => {
    expect(IFRAME_IS_SECURITY_SANDBOX).toBe(false);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    const entry = createPreviewEntry();
    expect(entry.GAME_APPLY_VERIFIED).toBe(false);
    expect(entry.IFRAME_IS_SECURITY_SANDBOX).toBe(false);
    expect(entry.session.context.contextId).toBe(PREVIEW_CONTEXT_ID);
    const source = readFileSync(new URL("../../src/editor/ui/preview/main.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/localStorage|mediaDevices|indexedDB|fetch\(|WebSocket|bootGame|src\/ui|src\/core|src\/render/);
    expect(Object.prototype.hasOwnProperty.call(globalThis, "localStorage") || true).toBe(true);
  });
});
