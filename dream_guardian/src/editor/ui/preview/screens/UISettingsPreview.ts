import { SETTINGS_BASELINE, cloneSettingsPresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  SETTINGS_ALLOWED_FIELDS,
  SETTINGS_CONTRACT,
  SETTINGS_FIXTURES,
  SETTINGS_LOCK_REASONS,
  SETTINGS_REGIONS,
  SETTINGS_VERSION,
  resolveSettingsProperty,
} from "../../data/screens/UISettingsContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const SETTINGS_PREVIEW_ID = "settings";

export type SettingsPorts = {
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

type Slot = { x: number; y: number; w: number; h: number };
type Fixture = (typeof SETTINGS_FIXTURES)[number];

export type SettingsForm = {
  screen: "settings";
  modal: Slot;
  closeBtn: Slot;
  buttons: {
    camera: Slot;
    fullscreen: Slot;
    skeleton: Slot;
    sound: Slot;
    locomotion: Slot;
    fontScale: Slot;
    highContrast: Slot;
  };
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  regions: typeof SETTINGS_REGIONS;
  display: {
    profile: typeof SETTINGS_CONTRACT.fingerprint;
    open: boolean;
    largeText: boolean;
    mockedOptions: boolean;
    writesPlayerSettings: false;
    profileInputs: "closed";
  };
};

export type SettingsEditResult = {
  ok: boolean;
  locks: string[];
  editEnabled: false;
  exportEnabled: false;
};

const WRITE_KEYS = new Set([
  "cameraEnabled",
  "soundEnabled",
  "persist",
  "save",
  "fontScaleValue",
]);

function isSlot(value: unknown): value is Slot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Record<string, unknown>;
  return typeof slot.x === "number" && typeof slot.y === "number" && typeof slot.w === "number" && typeof slot.h === "number";
}

function copySlot(slot: Slot): Slot {
  return { x: slot.x, y: slot.y, w: slot.w, h: slot.h };
}

function presetOf() {
  return cloneSettingsPresetForEdit(SETTINGS_BASELINE.id);
}

function fixtureOf(id: string): Fixture | undefined {
  return SETTINGS_FIXTURES.find((fixture) => fixture.id === id);
}

export function createSettingsPreview(ports: SettingsPorts = {}) {
  void ports.storage;
  void ports.bootGame;
  void ports.camera;
  void ports.network;
  void ports.onDanger;
  let preset = presetOf();
  let modal = copySlot(preset.modal);
  let closeBtn = copySlot(preset.closeBtn);
  let dirty = false;
  let fixtureId = SETTINGS_FIXTURES[0]?.id ?? "settings-open";
  const history: { modal: Slot; closeBtn: Slot }[] = [];

  function displayOf() {
    const fixture = fixtureOf(fixtureId) ?? SETTINGS_FIXTURES[0];
    return {
      profile: SETTINGS_CONTRACT.fingerprint,
      open: fixture.open,
      largeText: fixture.largeText,
      mockedOptions: fixture.mockedOptions,
      writesPlayerSettings: false as const,
      profileInputs: "closed" as const,
    };
  }

  function buttonsOf() {
    return {
      camera: copySlot(preset.buttons.camera),
      fullscreen: copySlot(preset.buttons.fullscreen),
      skeleton: copySlot(preset.buttons.skeleton),
      sound: copySlot(preset.buttons.sound),
      locomotion: copySlot(preset.buttons.locomotion),
      fontScale: copySlot(preset.buttons.fontScale),
      highContrast: copySlot(preset.buttons.highContrast),
    };
  }

  function form(): SettingsForm {
    return {
      screen: "settings",
      modal: copySlot(modal),
      closeBtn: copySlot(closeBtn),
      buttons: buttonsOf(),
      dirty,
      editEnabled: false,
      exportEnabled: false,
      regions: SETTINGS_REGIONS,
      display: displayOf(),
    };
  }

  function select() {
    const registry = lookupScreenContract("settings", SETTINGS_VERSION, "settings");
    return {
      screen: "settings" as const,
      registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): SettingsEditResult {
    const locks: string[] = [];
    let nextModal = copySlot(modal);
    let nextClose = copySlot(closeBtn);
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "modal" && isSlot(value)) {
        nextModal = copySlot(value);
        changed = true;
        continue;
      }
      if (key === "closeBtn" && isSlot(value)) {
        nextClose = copySlot(value);
        changed = true;
        continue;
      }
      if (WRITE_KEYS.has(key)) {
        locks.push(SETTINGS_LOCK_REASONS.settingsWriteBlocked);
        continue;
      }
      const resolved = resolveSettingsProperty(key);
      if (resolved.reason) locks.push(resolved.reason);
      if (!(SETTINGS_ALLOWED_FIELDS as readonly string[]).includes(key)) {
        locks.push(SETTINGS_LOCK_REASONS.unknownField);
      }
    }
    if (changed && locks.length === 0) {
      history.push({ modal: copySlot(modal), closeBtn: copySlot(closeBtn) });
      modal = nextModal;
      closeBtn = nextClose;
      dirty = true;
    }
    return { ok: locks.length === 0 && changed, locks, editEnabled: false, exportEnabled: false };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return form();
    modal = copySlot(previous.modal);
    closeBtn = copySlot(previous.closeBtn);
    dirty = history.length > 0;
    return form();
  }

  function loadFixture(id: string) {
    const fixture = fixtureOf(id);
    if (!fixture) return { ok: false as const, form: form(), regions: SETTINGS_REGIONS, display: displayOf() };
    fixtureId = fixture.id;
    preset = presetOf();
    const current = form();
    return { ok: true as const, form: current, regions: current.regions, display: current.display };
  }

  function preview() {
    return {
      drew: true,
      contextId: PREVIEW_CONTEXT_ID,
      bootedGame: false,
      form: form(),
    };
  }

  function save() {
    const current = form();
    return {
      checkpoint: {
        screen: "settings" as const,
        settings: {
          modal: current.modal,
          closeBtn: current.closeBtn,
          buttons: current.buttons,
          profile: current.display.profile,
          open: current.display.open,
          largeText: current.display.largeText,
          mockedOptions: current.display.mockedOptions,
          writesPlayerSettings: current.display.writesPlayerSettings,
        },
      },
    };
  }

  return { select, edit, undo, loadFixture, preview, save, form };
}

export type SettingsPreview = ReturnType<typeof createSettingsPreview>;

export function roundTripSettings(preview: SettingsPreview = createSettingsPreview()) {
  const selected = preview.select();
  const drawn = preview.preview();
  const snapshot = preview.save();
  const exported = buildTransfer({
    checkpoint: snapshot.checkpoint,
    scope: "settings",
    sourceId: "uix-027",
    exportId: "uix-027-export",
    screen: "settings",
    version: SETTINGS_CONTRACT.version,
    previewLinked: true,
  });
  const inspection = inspectTransfer({
    file: { kind: "dream-guardian-ui-transfer", validation: { passed: true } },
    originalCheckpoint: snapshot.checkpoint,
  });
  return {
    invoked: true,
    selected,
    preview: drawn,
    snapshot,
    export: exported,
    inspection,
  };
}

export function registerSettingsPreview(): {
  screen: typeof SETTINGS_PREVIEW_ID;
  editEnabled: false;
  exportEnabled: false;
  linked: false;
} {
  lookupScreenContract("settings", SETTINGS_VERSION, "settings");
  return {
    screen: SETTINGS_PREVIEW_ID,
    editEnabled: false,
    exportEnabled: false,
    linked: false,
  };
}
