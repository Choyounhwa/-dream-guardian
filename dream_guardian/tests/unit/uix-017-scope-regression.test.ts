import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const workspaceRoot = resolve(__dirname, "../../..");
// Dynamic import keeps missing infrastructure visible as individual Red cases.
const loadScope = () => import("../uix-017-change-scope");
const realGit = (args: readonly string[]) =>
  execFileSync("git", [...args], { cwd: workspaceRoot, encoding: "utf8" });

describe("#644 UIX-017 editor change evidence regression", () => {
  it("validates nonempty real diffs of the three independently sourced editor commits", async () => {
    const { verifyEditorChangeScope, EDITOR_EVIDENCE } = await loadScope();
    const paths = verifyEditorChangeScope(workspaceRoot);
    expect(EDITOR_EVIDENCE.map((entry) => entry.card)).toEqual(["UIX-006", "UIX-008", "UIX-011"]);
    expect(paths).toHaveLength(14);
    expect(paths).toContain("dream_guardian/src/editor/ui/preview/UIPreviewAdapter.ts");
    expect(paths).toContain("dream_guardian/package.json");
    expect(paths).toContain("dream_guardian/src/editor/ui/UIInteraction.ts");
  });

  it.each(["M ", " M", "??"])("ignores unrelated %s src/config worktree changes without consulting status", async (status) => {
    const { verifyEditorChangeScope } = await loadScope();
    const dirty = `${status} dream_guardian/config/assault-reward.config.ts\n` +
      `${status} dream_guardian/src/game/followup.ts\n` +
      `${status} dream_guardian/config/followup.config.ts\n`;
    const git = vi.fn((args: readonly string[]) => args[0] === "status" ? dirty : realGit(args));
    expect(verifyEditorChangeScope(workspaceRoot, undefined, git))
      .toEqual(verifyEditorChangeScope(workspaceRoot));
    expect(git).toHaveBeenCalledTimes(3);
    for (const [args] of git.mock.calls) {
      expect(args[0]).toBe("diff");
      expect(args).toContain("--no-renames");
      expect(args).toContain("-z");
      expect(args.at(-1)).toBe("--");
    }
  });

  const protectedPaths = [
    "dream_guardian/src/core/injected.ts",
    "dream_guardian/src/game/injected.ts",
    "dream_guardian/src/render/injected.ts",
    "dream_guardian/src/ui/injected.ts",
    "dream_guardian/src/motion/injected.ts",
    "dream_guardian/src/skeleton/injected.ts",
    "dream_guardian/config/injected.ts",
    "dream_guardian/config/assault-reward.config.ts",
  ];
  it.each(protectedPaths)("rejects protected path inside editor evidence: %s", async (path) => {
    const { verifyEditorChangeScope } = await loadScope();
    const git = (args: readonly string[]) => `${realGit(args)}${path}\0`;
    expect(() => verifyEditorChangeScope(workspaceRoot, undefined, git)).toThrow(path);
  });

  it("does not let an allowlist override the independent protected boundary", async () => {
    const { verifyEditorChangeScope, EDITOR_EVIDENCE } = await loadScope();
    const path = "dream_guardian/config/assault-reward.config.ts";
    const evidence = [{ ...EDITOR_EVIDENCE[0], allowedPaths: [...EDITOR_EVIDENCE[0].allowedPaths, path] }];
    expect(() => verifyEditorChangeScope(workspaceRoot, evidence,
      (args) => `${realGit(args)}${path}\0`)).toThrow(path);
  });

  it.each(["old", "new"])("checks the %s side of rename evidence (no-renames reports deletion and addition)", async (side) => {
    const { verifyEditorChangeScope, EDITOR_EVIDENCE } = await loadScope();
    const protectedPath = "dream_guardian/src/game/renamed.ts";
    const editorPath = EDITOR_EVIDENCE[0].allowedPaths[0];
    const paths = side === "old" ? [protectedPath, editorPath] : [editorPath, protectedPath];
    expect(() => verifyEditorChangeScope(workspaceRoot, [EDITOR_EVIDENCE[0]],
      () => `${paths.join("\0")}\0`)).toThrow(protectedPath);
  });

  it("rejects actual changes outside the separately declared task allowlist", async () => {
    const { verifyEditorChangeScope } = await loadScope();
    const path = "dream_guardian/tests/unit/unrelated.test.ts";
    expect(() => verifyEditorChangeScope(workspaceRoot, undefined,
      (args) => `${realGit(args)}${path}\0`)).toThrow(path);
  });

  it("rejects an empty evidence selection", async () => {
    const { verifyEditorChangeScope } = await loadScope();
    expect(() => verifyEditorChangeScope(workspaceRoot, [])).toThrow(/empty evidence/i);
  });

  it.each(["", "\0"])("rejects empty actual Git evidence %j rather than vacuously passing", async (output) => {
    const { verifyEditorChangeScope } = await loadScope();
    expect(() => verifyEditorChangeScope(workspaceRoot, undefined, () => output)).toThrow(/empty.*diff/i);
  });

  it("propagates Git lookup errors instead of skipping or returning an empty list", async () => {
    const { verifyEditorChangeScope } = await loadScope();
    const error = new Error("git object unavailable (shallow clone)");
    expect(() => verifyEditorChangeScope(workspaceRoot, undefined, () => { throw error; })).toThrow(error);
  });

  it.each(["", "HEAD", "not-a-sha", "0".repeat(40)])("rejects missing, mutable or unavailable SHA %j", async (sha) => {
    const { verifyEditorChangeScope, EDITOR_EVIDENCE } = await loadScope();
    expect(() => verifyEditorChangeScope(workspaceRoot, [{ ...EDITOR_EVIDENCE[0], sha }])).toThrow();
  });
});
