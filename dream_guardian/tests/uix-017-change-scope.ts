import { execFileSync } from "node:child_process";

type EditorEvidence = {
  readonly card: string;
  readonly sha: string;
  readonly allowedPaths: readonly string[];
};
type GitReader = (args: readonly string[]) => string;

// #644: independently reviewed, individual editor commits, NOT a continuous range.
// #341's original QA SHA is unavailable (its tests were ignored/untracked).
// https://github.com/Choyounhwa/-dream-guardian/issues/341#issuecomment-6018150704
// declares QA outputs only; it does not prove a complete historical diff.
// These three commits prove ONLY their own editor change boundaries. In particular,
// mixed commit 7a14a80 (#424) is NOT substituted for the missing #341 commit.
// The allowlists below are declarations; actual paths always come from Git objects.
export const EDITOR_EVIDENCE: readonly EditorEvidence[] = [
  {
    card: "UIX-006",
    sha: "c21c239dd49116bd0c9bd9582bf5ecbd0cc1f78d",
    allowedPaths: [
      "dream_guardian/src/editor/ui/preview/UIPreviewAdapter.ts",
      "dream_guardian/src/editor/ui/preview/main.ts",
      "dream_guardian/tests/unit/uix-006.test.ts",
    ],
  },
  {
    card: "UIX-008",
    sha: "9983a6e26a3a99f4a7936ee106dd1ce4e7b7f3b3",
    allowedPaths: [
      "dream_guardian/package.json",
      "dream_guardian/src/editor/ui/UIEditorShell.ts",
      "dream_guardian/src/editor/ui/main.ts",
      "dream_guardian/tests/unit/uix-008.test.ts",
      "dream_guardian/ui-editor.html",
      "dream_guardian/ui-preview.html",
      "dream_guardian/vite.ui-editor.config.ts",
    ],
  },
  {
    card: "UIX-011",
    sha: "a5418dec4e456558a9984acc88c1665ac0f1950c",
    allowedPaths: [
      "dream_guardian/src/editor/ui/UIEditorShell.ts",
      "dream_guardian/src/editor/ui/UIInteraction.ts",
      "dream_guardian/src/editor/ui/UIPreviewHost.ts",
      "dream_guardian/tests/unit/uix-011.test.ts",
    ],
  },
];

const protectedPrefixes = [
  "dream_guardian/src/core/",
  "dream_guardian/src/game/",
  "dream_guardian/src/render/",
  "dream_guardian/src/ui/",
  "dream_guardian/src/motion/",
  "dream_guardian/src/skeleton/",
  "dream_guardian/config/",
];

export function verifyEditorChangeScope(
  workspaceRoot: string,
  evidence: readonly EditorEvidence[] = EDITOR_EVIDENCE,
  git: GitReader = (args) => execFileSync("git", [...args], {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
): string[] {
  if (evidence.length === 0) throw new Error("Empty evidence selection");
  return evidence.flatMap(({ card, sha, allowedPaths }) => {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`${card}: invalid fixed SHA: ${sha}`);
    // Both endpoints are immutable objects, never HEAD/index/worktree. No pathspec
    // filtering: that could hide intrusion before validation. --no-renames exposes
    // BOTH old and new paths as delete/add; NUL delimiters preserve literal names.
    // Missing objects/parents (including shallow clones) deliberately throw.
    const output = git(["diff", "--name-only", "--no-renames", "-z", `${sha}^`, sha, "--"]);
    const paths = output.split("\0");
    if (paths.at(-1) === "") paths.pop();
    if (paths.length === 0 || paths.some((path) => path.length === 0)) {
      throw new Error(`${card}: empty Git diff evidence`);
    }
    for (const path of paths) {
      if (protectedPrefixes.some((prefix) => path.startsWith(prefix))) {
        throw new Error(`${card}: protected game path in editor evidence: ${path}`);
      }
      if (!allowedPaths.includes(path)) {
        throw new Error(`${card}: undeclared editor change: ${path}`);
      }
    }
    for (const path of allowedPaths) {
      if (!paths.includes(path)) throw new Error(`${card}: missing declared change: ${path}`);
    }
    return paths;
  });
}
