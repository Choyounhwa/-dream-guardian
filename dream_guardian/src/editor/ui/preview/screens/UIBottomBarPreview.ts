import { BOTTOM_BAR_BASELINE, cloneBottomBarPresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  BOTTOM_BAR_ALLOWED_FIELDS,
  BOTTOM_BAR_CONTRACT,
  BOTTOM_BAR_FIXTURES,
  BOTTOM_BAR_LOCK_REASONS,
  BOTTOM_BAR_VERSION,
  rejectButtonOverlap,
  resolveBottomBarProperty,
} from "../../data/screens/UIBottomBarContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const BOTTOM_BAR_PREVIEW_ID = "bottomBar";

export type BottomBarPorts = {
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

export type BottomBarForm = {
  screen: "bottomBar";
  settingsBtn: Slot;
  actionBtn: Slot;
  manaBar: Slot;
  visible: boolean;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  display: {
    profile: string;
    action: string;
    overlapRejected: boolean;
  };
};

export type BottomBarEditResult = {
  ok: boolean;
  locks: string[];
  editEnabled: false;
  exportEnabled: false;
};

type Fixture = (typeof BOTTOM_BAR_FIXTURES)[number];

function slotsOf() {
  return cloneBottomBarPresetForEdit(BOTTOM_BAR_BASELINE.id);
}

function fixtureOf(id: string): Fixture | undefined {
  return BOTTOM_BAR_FIXTURES.find((item) => item.id === id);
}

export function createBottomBarPreview(ports: BottomBarPorts = {}) {
  void ports;
  let preset = slotsOf();
  let visible = true;
  let dirty = false;
  let fixtureId = BOTTOM_BAR_FIXTURES[0]?.id ?? "bottom-bar-visibility";
  let display = {
    profile: fixtureOf(fixtureId)?.profile ?? "visibility",
    action: "settings",
    overlapRejected: false,
  };
  const history: { visible: boolean }[] = [];

  function form(): BottomBarForm {
    return {
      screen: "bottomBar",
      settingsBtn: { ...preset.settingsBtn },
      actionBtn: { ...preset.actionBtn },
      manaBar: { ...preset.manaBar },
      visible,
      dirty,
      editEnabled: false,
      exportEnabled: false,
      display: { ...display },
    };
  }

  function select() {
    const registry = lookupScreenContract("bottomBar", BOTTOM_BAR_VERSION, "bottomBar");
    return {
      screen: "bottomBar" as const,
      registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): BottomBarEditResult {
    const locks: string[] = [];
    let nextVisible = visible;
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "visible" && typeof value === "boolean") {
        nextVisible = value;
        changed = true;
        continue;
      }
      const resolved = resolveBottomBarProperty(key);
      if (resolved.status === "locked") {
        locks.push(resolved.reason);
        continue;
      }
      if (!(BOTTOM_BAR_ALLOWED_FIELDS as readonly string[]).includes(key)) {
        locks.push(BOTTOM_BAR_LOCK_REASONS.unknownField);
      }
    }
    if (changed && locks.length === 0) {
      history.push({ visible });
      visible = nextVisible;
      dirty = true;
    }
    return { ok: locks.length === 0 && changed, locks, editEnabled: false, exportEnabled: false };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return { ok: false as const, editEnabled: false as const, exportEnabled: false as const };
    visible = previous.visible;
    dirty = history.length > 0;
    return { ok: true as const, editEnabled: false as const, exportEnabled: false as const };
  }

  function applyFixture(id: string) {
    const fixture = fixtureOf(id);
    if (!fixture) {
      return { ok: false as const, locks: [BOTTOM_BAR_LOCK_REASONS.unknownField], exportEnabled: false as const };
    }
    fixtureId = fixture.id;
    visible = fixture.id === "bottom-bar-visibility" ? false : true;
    display = {
      profile: fixture.profile,
      action: fixture.id === "bottom-bar-workout" ? "workout" : display.action,
      overlapRejected: fixture.id === "bottom-bar-overlap",
    };
    if (fixture.id === "bottom-bar-overlap") rejectButtonOverlap();
    return { ok: true as const, exportEnabled: false as const, editEnabled: false as const };
  }

  function preview() {
    return {
      contextId: PREVIEW_CONTEXT_ID,
      linked: true,
      bootedGame: false,
      editEnabled: false as const,
      exportEnabled: false as const,
      protectedRegions: BOTTOM_BAR_CONTRACT.protectedRegions,
      profile: BOTTOM_BAR_CONTRACT.fingerprint,
      fixtureId,
      coords: {
        settingsBtn: { ...preset.settingsBtn },
        actionBtn: { ...preset.actionBtn },
        manaBar: { ...preset.manaBar },
      },
      form: form(),
    };
  }

  function save() {
    const current = form();
    return {
      editEnabled: false as const,
      exportEnabled: false as const,
      checkpoint: {
        kind: "dream-guardian-ui-project" as const,
        screen: "bottomBar" as const,
        version: BOTTOM_BAR_VERSION,
        bottomBar: {
          visible: current.visible,
          settingsBtn: current.settingsBtn,
          actionBtn: current.actionBtn,
          manaBar: current.manaBar,
          profile: current.display.profile,
        },
      },
    };
  }

  return { select, edit, undo, applyFixture, preview, save, form };
}

export type BottomBarPreview = ReturnType<typeof createBottomBarPreview>;

export function roundTripBottomBar(preview: BottomBarPreview = createBottomBarPreview()) {
  const saved = preview.save();
  const exported = buildTransfer({
    checkpoint: saved.checkpoint,
    scope: "bottomBar",
    sourceId: "bottom-bar-preview",
    exportId: "bottom-bar-preview-export",
    screen: "bottomBar",
    version: BOTTOM_BAR_VERSION,
    previewLinked: true,
  });
  const inspection = inspectTransfer({ file: exported, originalCheckpoint: saved.checkpoint });
  return { invoked: true as const, export: exported, inspection, exportEnabled: false as const };
}

export function registerBottomBarPreview() {
  const registry = lookupScreenContract("bottomBar", BOTTOM_BAR_VERSION, "bottomBar");
  return {
    screen: BOTTOM_BAR_PREVIEW_ID,
    registered: "registered" in registry ? registry.registered : false,
    editEnabled: false as const,
    exportEnabled: false as const,
    linked: false as const,
  };
}
