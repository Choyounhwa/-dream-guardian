import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_CARD_IDS } from "../../src/editor/ui/data/UIContracts";
import {
  GAME_APPLY_VERIFIED,
  PANEL_IDS,
  SHELL_LOADS_GAME_MAIN,
  announce,
  bootEditor,
  previewAssetPath,
  selectElementByKey,
} from "../../src/editor/ui/UIEditorShell";

const root = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("UIX-008 isolated editor shell", () => {
  it("adds editor scripts without changing game scripts or vite inputs", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.dev).toBe("vite");
    expect(pkg.scripts.build).toBe("tsc && vite build");
    expect(pkg.scripts.preview).toBe("vite preview");
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts["test:watch"]).toBe("vitest");
    expect(pkg.scripts["dev:ui-editor"]).toBe("vite --config vite.ui-editor.config.ts");
    expect(pkg.scripts["build:ui-editor"]).toBe("tsc && vite build --config vite.ui-editor.config.ts");
    expect(pkg.scripts["preview:ui-editor"]).toBe("vite preview --config vite.ui-editor.config.ts");

    const gameVite = read("vite.config.ts");
    expect(gameVite).toContain("outDir: 'dist'");
    expect(gameVite).toContain("index.html");
    expect(gameVite).toContain("editor.html");
    expect(gameVite).toContain("port: 3000");

    const editorVite = read("vite.ui-editor.config.ts");
    expect(editorVite).toContain("dist-ui-editor");
    expect(editorVite).not.toContain("outDir: 'dist'");
    expect(editorVite).toContain("ui-editor.html");
    expect(editorVite).toContain("ui-preview.html");
    expect(editorVite).not.toContain("index.html");
    expect(editorVite).toContain("port: 3010");
    expect(editorVite).not.toContain("src/main");
  });

  it("wires html entries away from game main", () => {
    const editorHtml = read("ui-editor.html");
    const previewHtml = read("ui-preview.html");
    expect(editorHtml).toContain("/src/editor/ui/main.ts");
    expect(previewHtml).toContain("/src/editor/ui/preview/main.ts");
    expect(editorHtml).not.toContain("/src/main.ts");
    expect(previewHtml).not.toContain("/src/main.ts");
    const gameIndex = read("index.html");
    const danceEditor = read("editor.html");
    expect(gameIndex).toContain("/src/main.ts");
    expect(danceEditor).not.toContain("/src/editor/ui/main.ts");
  });

  it("selects menu cards by arrow keys without navigation callbacks", () => {
    const state = { selectedIndex: 0, status: [] as string[] };
    expect(MENU_CARD_IDS).toHaveLength(5);
    const down = selectElementByKey(state, "ArrowDown");
    expect(down.selectedIndex).toBe(1);
    expect("selectedId" in down && down.selectedId).toBe(MENU_CARD_IDS[1]);
    const wrapped = selectElementByKey({ selectedIndex: 4, status: [] }, "ArrowRight");
    expect(wrapped.selectedIndex).toBe(0);
    expect("selectedId" in wrapped && wrapped.selectedId).toBe(MENU_CARD_IDS[0]);
    const up = selectElementByKey({ selectedIndex: 0, status: [] }, "ArrowUp");
    expect(up.selectedIndex).toBe(4);
    expect(selectElementByKey(state, "Enter")).toEqual(state);
    expect(SHELL_LOADS_GAME_MAIN).toBe(false);
    expect(GAME_APPLY_VERIFIED).toBe(false);
  });

  it("keeps independent panels and status announcements without storage", () => {
    expect(PANEL_IDS).toEqual(["properties", "preview", "status"]);
    const announced = announce({ selectedIndex: 2, status: ["ready"] }, "saved locally");
    expect(announced.status).toEqual(["ready", "saved locally"]);
    expect(announced.selectedIndex).toBe(2);
    expect(announced.status).not.toBeUndefined();
  });

  it("joins preview subpaths and rejects traversal, absolute, protocol, and long names", () => {
    expect(previewAssetPath("/preview", "card.png")).toBe("/preview/card.png");
    expect(previewAssetPath("/preview/", "icons/play.svg")).toBe("/preview/icons/play.svg");
    expect(previewAssetPath("/preview", "../secret.png")).toBeNull();
    expect(previewAssetPath("/preview", "/abs.png")).toBeNull();
    expect(previewAssetPath("/preview", "https://evil.test/a.png")).toBeNull();
    expect(previewAssetPath("/preview", `${"a".repeat(81)}.png`)).toBeNull();
    expect(previewAssetPath("/preview", "ok.png")?.includes("..")).toBe(false);
  });

  it("boots editor without game main, bootstrap, or mediaDevices", () => {
    const source = read("src/editor/ui/main.ts");
    expect(source).not.toContain("src/main");
    expect(source).not.toContain("bootstrap");
    expect(source).not.toContain("mediaDevices");
    expect(source).not.toContain("src/core");
    expect(source).not.toContain("src/ui");
    expect(source).not.toContain("src/render");
    const booted = bootEditor();
    expect(booted.panels).toEqual(["properties", "preview", "status"]);
    expect(booted.gameApplyVerified).toBe(false);
    expect(booted.loadsGameMain).toBe(false);
  });
});
