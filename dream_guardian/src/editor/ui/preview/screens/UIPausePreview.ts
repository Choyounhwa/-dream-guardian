import { PAUSE_BASELINE, clonePausePresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  PAUSE_ALLOWED_FIELDS,
  PAUSE_CONTRACT,
  PAUSE_FIXTURES,
  PAUSE_LOCK_REASONS,
  PAUSE_REGIONS,
  PAUSE_VERSION,
  resolvePauseProperty,
} from "../../data/screens/UIPauseContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const PAUSE_PREVIEW_ID = "pause";

export type PausePorts = {
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    keys: () => string[];
  };
  bootGame?: () => void;
  camera?: { start: () => void };
  network?: { send: (payload: unknown) => void };
  onResume?: () => void;
  onMenu?: () => void;
  onPause?: () => void;
  onDanger?: () => void;
};

type Slot = { x: number; y: number; w: number; h: number };
type Fixture = (typeof PAUSE_FIXTURES)[number];

export type PauseForm = {
  screen: "pause";
  modal: Slot;
  resumeBtn: Slot;
  quitBtn: Slot;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  regions: typeof PAUSE_REGIONS;
  display: {
    profile: typeof PAUSE_CONTRACT.fingerprint;
    open: boolean;
    mockedResume: boolean;
    mockedMenu: boolean;
    invokesPause: false;
    profileInputs: "closed";
  };
};

export type PauseEditResult = {
  ok: boolean;
  editEnabled: false;
  exportEnabled: false;
  locks: string[];
  form: PauseForm;
};

function slot(value: Slot): Slot {
  return { x: value.x, y: value.y, w: value.w, h: value.h };
}

function isAllowed(key: string): key is (typeof PAUSE_ALLOWED_FIELDS)[number] {
  return (PAUSE_ALLOWED_FIELDS as readonly string[]).includes(key);
}

function isSlot(value: unknown): value is Slot {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["x", "y", "w", "h"].every((key) => typeof item[key] === "number" && Number.isFinite(item[key]));
}

function baselineForm(): Pick<PauseForm, "modal" | "resumeBtn" | "quitBtn"> {
  const preset = clonePausePresetForEdit(PAUSE_BASELINE.id);
  return {
    modal: slot(preset.modal),
    resumeBtn: slot(preset.resumeBtn),
    quitBtn: slot(preset.quitBtn),
  };
}

export function createPausePreview(ports: PausePorts = {}) {
  void ports;
  const undoStack: Array<Pick<PauseForm, "modal" | "resumeBtn" | "quitBtn">> = [];
  let current = baselineForm();
  let dirty = false;
  let fixtureId = PAUSE_FIXTURES[0]?.id ?? "pause-open";
  let display: PauseForm["display"] = {
    profile: PAUSE_CONTRACT.fingerprint,
    open: true,
    mockedResume: false,
    mockedMenu: false,
    invokesPause: false,
    profileInputs: "closed",
  };

  function fixture(): Fixture {
    return PAUSE_FIXTURES.find((item) => item.id === fixtureId) ?? PAUSE_FIXTURES[0];
  }

  function form(): PauseForm {
    const active = fixture();
    return {
      screen: "pause",
      modal: slot(current.modal),
      resumeBtn: slot(current.resumeBtn),
      quitBtn: slot(current.quitBtn),
      dirty,
      editEnabled: false,
      exportEnabled: false,
      regions: PAUSE_REGIONS,
      display: {
        ...display,
        open: active.open,
        mockedResume: active.mockedResume,
        mockedMenu: active.mockedMenu,
        invokesPause: false,
        profileInputs: "closed",
        profile: PAUSE_CONTRACT.fingerprint,
      },
    };
  }

  function select() {
    const registry = lookupScreenContract("pause", PAUSE_VERSION, "pause");
    return {
      screen: "pause" as const,
      registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): PauseEditResult {
    const locks: string[] = [];
    const next = {
      modal: slot(current.modal),
      resumeBtn: slot(current.resumeBtn),
      quitBtn: slot(current.quitBtn),
    };
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "resume") {
        locks.push(PAUSE_LOCK_REASONS.resumeBlocked);
        continue;
      }
      if (key === "quit" || key === "quit-to-menu" || key === "quitToMenu") {
        locks.push(PAUSE_LOCK_REASONS.quitBlocked);
        continue;
      }
      const resolved = resolvePauseProperty(key);
      if (!resolved.ok) {
        locks.push(resolved.reason);
        continue;
      }
      if (!isAllowed(key) || !isSlot(value)) {
        locks.push(PAUSE_LOCK_REASONS.unknownField);
        continue;
      }
      const copied = slot(value);
      if (key === "modal") next.modal = copied;
      else if (key === "resumeBtn") next.resumeBtn = copied;
      else next.quitBtn = copied;
      changed = true;
    }
    if (locks.length > 0 || !changed) {
      return { ok: false, editEnabled: false, exportEnabled: false, locks, form: form() };
    }
    undoStack.push({
      modal: slot(current.modal),
      resumeBtn: slot(current.resumeBtn),
      quitBtn: slot(current.quitBtn),
    });
    current = next;
    dirty = true;
    return { ok: true, editEnabled: false, exportEnabled: false, locks, form: form() };
  }

  function undo() {
    const previous = undoStack.pop();
    if (!previous) return { ok: false, form: form() };
    current = previous;
    dirty = undoStack.length > 0;
    return { ok: true, form: form() };
  }

  function loadFixture(id: string) {
    const found = PAUSE_FIXTURES.find((item) => item.id === id);
    if (!found) {
      return { ok: false as const, reason: PAUSE_LOCK_REASONS.unknownField, regions: PAUSE_REGIONS, form: form(), display };
    }
    fixtureId = found.id;
    display = {
      profile: PAUSE_CONTRACT.fingerprint,
      open: found.open,
      mockedResume: found.mockedResume,
      mockedMenu: found.mockedMenu,
      invokesPause: false,
      profileInputs: "closed",
    };
    return { ok: true as const, regions: PAUSE_REGIONS, form: form(), display: form().display };
  }

  function preview() {
    const shown = form();
    return {
      contextId: PREVIEW_CONTEXT_ID,
      screen: "pause" as const,
      regions: shown.regions,
      form: shown,
      display: shown.display,
      exportEnabled: false as const,
    };
  }

  function save() {
    const shown = form();
    return {
      exportEnabled: false as const,
      checkpoint: {
        screen: "pause" as const,
        pause: {
          modal: slot(shown.modal),
          resumeBtn: slot(shown.resumeBtn),
          quitBtn: slot(shown.quitBtn),
          open: shown.display.open,
          mockedResume: shown.display.mockedResume,
          mockedMenu: shown.display.mockedMenu,
          invokesPause: shown.display.invokesPause,
          profile: shown.display.profile,
          profileInputs: shown.display.profileInputs,
        },
      },
    };
  }

  return { select, edit, undo, loadFixture, preview, save, form };
}

export type PausePreview = ReturnType<typeof createPausePreview>;

export function roundTripPause(preview: PausePreview = createPausePreview()) {
  const selected = preview.select();
  const shown = preview.preview();
  const snapshot = preview.save();
  const exported = buildTransfer({
    checkpoint: snapshot.checkpoint,
    scope: "pause",
    sourceId: "uix-029",
    exportId: "uix-029-export",
    screen: "pause",
    version: PAUSE_VERSION,
    previewLinked: true,
  });
  const inspection = inspectTransfer({ file: exported });
  return {
    invoked: true,
    selected,
    preview: shown,
    snapshot,
    export: exported,
    inspection,
    exportEnabled: false as const,
  };
}

export function registerPausePreview(): {
  screen: "pause";
  registered: true;
  editEnabled: false;
  exportEnabled: false;
} {
  lookupScreenContract("pause", PAUSE_VERSION, "pause");
  return { screen: "pause", registered: true, editEnabled: false, exportEnabled: false };
}
