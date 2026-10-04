import { MENU_CARD_IDS } from "./data/UIContracts";
export { roundTripPause } from "./preview/screens/UIPausePreview";
export type { PausePreview } from "./preview/screens/UIPausePreview";
export { roundTripSubmenu } from "./preview/screens/UISubmenuPreview";
export type { SubmenuPreview } from "./preview/screens/UISubmenuPreview";

export type {
  AcceptResult,
  DragReason,
  DragSession,
  NudgeOptions,
  Point,
  ViewTransform,
} from "./UIInteraction";
export type { AcceptDecision, PreviewEnvelope, PreviewHost, PreviewKind } from "./UIPreviewHost";

export const GAME_APPLY_VERIFIED = false;
export const SHELL_LOADS_GAME_MAIN = false;
export const PANEL_IDS = ["properties", "preview", "status"] as const;

export interface ShellState {
  selectedIndex: number;
  status: string[];
}

export interface SelectionResult extends ShellState {
  selectedId: (typeof MENU_CARD_IDS)[number];
}

const FORWARD = new Set(["ArrowDown", "ArrowRight"]);
const BACKWARD = new Set(["ArrowUp", "ArrowLeft"]);

export function selectElementByKey(state: ShellState, key: string): ShellState | SelectionResult {
  const count = MENU_CARD_IDS.length;
  if (!FORWARD.has(key) && !BACKWARD.has(key)) {
    return { ...state };
  }
  const delta = FORWARD.has(key) ? 1 : -1;
  const selectedIndex = (state.selectedIndex + delta + count) % count;
  return {
    selectedIndex,
    status: state.status.slice(),
    selectedId: MENU_CARD_IDS[selectedIndex],
  };
}

export function announce(state: ShellState, message: string): ShellState {
  return {
    selectedIndex: state.selectedIndex,
    status: [...state.status, message],
  };
}

export function previewAssetPath(base: string, file: string): string | null {
  if (file.length > 80) return null;
  if (file.includes("..")) return null;
  if (file.startsWith("/") || file.startsWith("\\")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(file)) return null;
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${root}/${file}`;
}

export function bootEditor(): {
  panels: readonly string[];
  gameApplyVerified: boolean;
  loadsGameMain: boolean;
} {
  return {
    panels: PANEL_IDS,
    gameApplyVerified: GAME_APPLY_VERIFIED,
    loadsGameMain: SHELL_LOADS_GAME_MAIN,
  };
}
