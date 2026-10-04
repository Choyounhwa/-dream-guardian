import { SUBMENU_BASELINE, cloneSubmenuPresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  SUBMENU_CELL_IDS,
  SUBMENU_CONTRACT,
  SUBMENU_LOCK_REASONS,
  SUBMENU_VERSION,
  deriveSubmenuCell,
  resolveSubmenuProperty,
} from "../../data/screens/UISubmenuContract";
import { buildTransfer } from "../../data/UITransferBuilder";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";
const registeredScreens = new Set<string>();

export const SUBMENU_PREVIEW_ID = "submenu";

export type SubmenuPorts = {
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    keys: () => string[];
  };
  bootGame?: () => void;
  camera?: { start: () => void };
  network?: { send: (payload: unknown) => void };
  onDanger?: () => void;
};

export type SubmenuForm = {
  screen: "submenu";
  cols: number;
  rows: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  gapX: number;
  gapY: number;
  title: string;
  selectedIndex: number;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
};

export type SubmenuEditResult = {
  ok: boolean;
  locks: string[];
  editEnabled: false;
  exportEnabled: false;
};

export type SubmenuSnapshot = {
  screen: "submenu";
  version: string;
  profile: string;
  linked: true;
  protectedRegions: typeof SUBMENU_CONTRACT.protectedRegions;
  grid: SubmenuForm;
  selectedIndex: number;
  selectedId: string;
  title: string;
  checkpoint: {
    kind: "dream-guardian-ui-project";
    screen: "submenu";
    version: string;
    submenu: SubmenuForm;
  };
};

type HistoryEntry = { gapX: number; gapY: number; startX: number; startY: number; width: number; height: number; title: string; selectedIndex: number };

function baselineForm(): HistoryEntry & { cols: number; rows: number } {
  const preset = cloneSubmenuPresetForEdit(SUBMENU_BASELINE.id);
  return {
    cols: preset.grid.cols,
    rows: 3,
    width: preset.cardWidth,
    height: preset.cardHeight,
    startX: preset.grid.startX,
    startY: preset.grid.startY,
    gapX: preset.grid.gapX,
    gapY: preset.grid.gapY,
    title: "",
    selectedIndex: 0,
  };
}

export function createSubmenuPreview(ports: SubmenuPorts = {}) {
  void ports;
  let current = baselineForm();
  const history: HistoryEntry[] = [];
  let dirty = false;

  function form(): SubmenuForm {
    return {
      screen: "submenu",
      cols: current.cols,
      rows: current.rows,
      width: current.width,
      height: current.height,
      startX: current.startX,
      startY: current.startY,
      gapX: current.gapX,
      gapY: current.gapY,
      title: current.title,
      selectedIndex: current.selectedIndex,
      dirty,
      editEnabled: false,
      exportEnabled: false,
    };
  }

  function select() {
    const registry = lookupScreenContract("submenu", SUBMENU_VERSION, "submenu");
    return {
      screen: "submenu" as const,
      registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): SubmenuEditResult {
    const locks: string[] = [];
    const next: typeof current = { ...current };
    let changed = false;
    if (typeof patch.title === "string") {
      next.title = patch.title;
      changed = true;
    }
    if (typeof patch.selectedIndex === "number") {
      const index = patch.selectedIndex;
      if (index >= 0 && index < SUBMENU_CELL_IDS.length) {
        next.selectedIndex = index;
        changed = true;
      } else {
        locks.push(SUBMENU_LOCK_REASONS.unknownField);
      }
    }
    for (const [key, value] of Object.entries(patch)) {
      if (key === "title" || key === "selectedIndex") continue;
      const resolved = resolveSubmenuProperty(key);
      if (resolved.locked) {
        if (resolved.reason) locks.push(resolved.reason);
        continue;
      }
      if (typeof value !== "number") {
        locks.push(SUBMENU_LOCK_REASONS.unknownField);
        continue;
      }
      if (key === "cols") {
        if (value !== next.cols) locks.push(SUBMENU_LOCK_REASONS.freeCardXY);
        continue;
      }
      if (key === "rows") {
        if (value !== next.rows) locks.push(SUBMENU_LOCK_REASONS.unknownField);
        continue;
      }
      if (key === "width") next.width = value;
      else if (key === "height") next.height = value;
      else if (key === "startX") next.startX = value;
      else if (key === "startY") next.startY = value;
      else if (key === "gapX") next.gapX = value;
      else if (key === "gapY") next.gapY = value;
      else continue;
      changed = true;
    }
    if (locks.length > 0 && !changed) {
      return { ok: false, locks, editEnabled: false, exportEnabled: false };
    }
    if (locks.length > 0) {
      return { ok: false, locks, editEnabled: false, exportEnabled: false };
    }
    if (changed) {
      history.push({
        gapX: current.gapX,
        gapY: current.gapY,
        startX: current.startX,
        startY: current.startY,
        width: current.width,
        height: current.height,
        title: current.title,
        selectedIndex: current.selectedIndex,
      });
      current = next;
      dirty = true;
    }
    return { ok: true, locks, editEnabled: false, exportEnabled: false };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return { ok: false as const, reason: "empty" };
    current = { ...current, ...previous };
    dirty = history.length > 0;
    return { ok: true as const, form: form() };
  }

  function preview() {
    const cells = SUBMENU_CELL_IDS.map((_, index) => deriveSubmenuCell(index));
    return {
      ok: true as const,
      linked: true as const,
      contextId: PREVIEW_CONTEXT_ID,
      profile: SUBMENU_BASELINE.rendererFingerprint,
      protectedRegions: SUBMENU_CONTRACT.protectedRegions,
      selectedId: SUBMENU_CELL_IDS[current.selectedIndex] ?? SUBMENU_CELL_IDS[0],
      cells,
      editEnabled: false as const,
      exportEnabled: false as const,
    };
  }

  function saveSnapshot(): SubmenuSnapshot {
    const body = form();
    return {
      screen: "submenu",
      version: SUBMENU_VERSION,
      profile: SUBMENU_BASELINE.rendererFingerprint,
      linked: true,
      protectedRegions: SUBMENU_CONTRACT.protectedRegions,
      grid: body,
      selectedIndex: current.selectedIndex,
      selectedId: SUBMENU_CELL_IDS[current.selectedIndex] ?? SUBMENU_CELL_IDS[0],
      title: current.title,
      checkpoint: {
        kind: "dream-guardian-ui-project",
        screen: "submenu",
        version: SUBMENU_VERSION,
        submenu: body,
      },
    };
  }

  function exportAttempt() {
    const saved = saveSnapshot();
    return buildTransfer({
      checkpoint: saved.checkpoint,
      scope: "submenu",
      sourceId: "src-019",
      exportId: "exp-019",
      screen: "submenu",
      version: SUBMENU_VERSION,
      previewLinked: saved.linked,
    });
  }

  return { select, edit, undo, preview, saveSnapshot, form, exportAttempt, portsIgnored: true as const };
}

export type SubmenuPreview = ReturnType<typeof createSubmenuPreview>;

export function roundTripSubmenu(preview: SubmenuPreview = createSubmenuPreview()) {
  const selected = preview.select();
  const drawn = preview.preview();
  const snapshot = preview.saveSnapshot();
  const exported = preview.exportAttempt();
  return {
    selected,
    preview: drawn,
    snapshot,
    export: exported,
    editEnabled: false as const,
    exportEnabled: false as const,
    registrationEnablesExport: false as const,
  };
}

export function registerSubmenuPreview(): {
  screen: string;
  exportEnabled: false;
  editEnabled: false;
  linked: false;
} {
  registeredScreens.add(SUBMENU_PREVIEW_ID);
  return {
    screen: SUBMENU_PREVIEW_ID,
    exportEnabled: false,
    editEnabled: false,
    linked: false,
  };
}
