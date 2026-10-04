import { HUD_BASELINE, cloneHudPresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  HUD_ALLOWED_FIELDS,
  HUD_CONTRACT,
  HUD_FIXTURES,
  HUD_VERSION,
  deriveHudSlot,
  resolveHudProperty,
} from "../../data/screens/UIHUDContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const HUD_PREVIEW_ID = "hud";

export type HudPorts = {
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
type BadgeSlot = Slot & { marginRight: number };

export type HudForm = {
  screen: "hud";
  playerHpBar: Slot;
  bossHpBar: Slot;
  combo: Slot;
  bossName: string;
  bossNameSlot: Slot;
  comboBadge: BadgeSlot;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  display: {
    playerHp: number;
    playerMaxHp: number;
    mana: number;
    combo: number;
    profile: string;
  };
};

export type HudEditResult = {
  ok: boolean;
  locks: string[];
  editEnabled: false;
  exportEnabled: false;
};



function slotsOf() {
  return cloneHudPresetForEdit(HUD_BASELINE.id).slots;
}

export function createHudPreview(ports: HudPorts = {}) {
  void ports;
  let slots = slotsOf();
  let bossName = "";
  let dirty = false;
  let fixtureId = HUD_FIXTURES[0]?.id ?? "hud-hp-zero";
  let display = {
    playerHp: 0,
    playerMaxHp: 100,
    mana: 0,
    combo: 0,
    profile: "hp-zero",
  };
  const history: { bossName: string }[] = [];

  function form(): HudForm {
    return {
      screen: "hud",
      playerHpBar: { ...slots.playerHpBar },
      bossHpBar: { ...slots.bossHpBar },
      combo: { ...slots.combo },
      bossName,
      bossNameSlot: { ...slots.bossName },
      comboBadge: { ...slots.comboBadge },
      dirty,
      editEnabled: false,
      exportEnabled: false,
      display: { ...display },
    };
  }

  function select() {
    const registry = lookupScreenContract("hud", HUD_VERSION, "hud");
    return {
      screen: "hud" as const,
      registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): HudEditResult {
    const locks: string[] = [];
    let nextName = bossName;
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "bossName" && typeof value === "string") {
        nextName = value;
        changed = true;
        continue;
      }
      const resolved = resolveHudProperty(key);
      if (resolved.locked) {
        if (resolved.reason) locks.push(resolved.reason);
        continue;
      }
      if (!(HUD_ALLOWED_FIELDS as readonly string[]).includes(key)) {
        locks.push(resolveHudProperty(key).reason ?? "hud-lock:unknown-field");
      }
    }
    if (locks.length > 0) {
      return { ok: false, locks, editEnabled: false, exportEnabled: false };
    }
    if (changed) {
      history.push({ bossName });
      bossName = nextName;
      dirty = true;
    }
    return { ok: changed, locks, editEnabled: false, exportEnabled: false };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return { ok: false as const, reason: "empty" };
    bossName = previous.bossName;
    dirty = history.length > 0;
    return { ok: true as const, form: form() };
  }

  function preview() {
    const preset = cloneHudPresetForEdit(HUD_BASELINE.id);
    return {
      ok: true as const,
      linked: true as const,
      contextId: PREVIEW_CONTEXT_ID,
      profile: HUD_CONTRACT.fingerprint,
      protectedRegions: HUD_CONTRACT.protectedRegions,
      fixtureId,
      coords: preset.slots,
    };
  }

  function applyFixture(id: string) {
    const fixture = HUD_FIXTURES.find((item) => item.id === id);
    if (!fixture) {
      return { ok: false as const, editEnabled: false as const, exportEnabled: false as const };
    }
    fixtureId = fixture.id;
    display = {
      playerHp: fixture.playerHp,
      playerMaxHp: fixture.playerMaxHp,
      mana: fixture.mana,
      combo: fixture.combo,
      profile: fixture.profile,
    };
    slots = slotsOf();
    return { ok: true as const, editEnabled: false as const, exportEnabled: false as const };
  }

  function save() {
    return {
      screen: "hud" as const,
      version: HUD_VERSION,
      profile: HUD_CONTRACT.fingerprint,
      linked: true as const,
      protectedRegions: HUD_CONTRACT.protectedRegions,
      editEnabled: false as const,
      exportEnabled: false as const,
      slots: {
        playerHpBar: deriveHudSlot("playerHpBar"),
        bossHpBar: deriveHudSlot("bossHpBar"),
        combo: deriveHudSlot("combo"),
        bossName: deriveHudSlot("bossName"),
        comboBadge: deriveHudSlot("comboBadge"),
      },
      checkpoint: {
        kind: "dream-guardian-ui-project" as const,
        screen: "hud" as const,
        version: HUD_VERSION,
        hud: form(),
      },
    };
  }

  return { select, edit, undo, preview, applyFixture, save, form };
}

export type HudPreview = ReturnType<typeof createHudPreview>;

export function roundTripHud(preview: HudPreview = createHudPreview()) {
  const selected = preview.select();
  const drawn = preview.preview();
  const snapshot = preview.save();
  const exported = buildTransfer({
    checkpoint: snapshot.checkpoint,
    scope: "hud",
    sourceId: "uix-021",
    exportId: "uix-021-export",
    screen: "hud",
    version: HUD_VERSION,
    previewLinked: true,
  });
  const inspection = inspectTransfer({
    file: exported.ok ? exported.transfer : { kind: "dream-guardian-ui-transfer", validation: { passed: true } },
    originalCheckpoint: snapshot.checkpoint,
  });
  return {
    invoked: true as const,
    selected,
    preview: drawn,
    snapshot,
    export: exported,
    inspection,
  };
}

export function registerHudPreview(): {
  screen: typeof HUD_PREVIEW_ID;
  editEnabled: false;
  exportEnabled: false;
  linked: false;
} {
  return {
    screen: HUD_PREVIEW_ID,
    editEnabled: false,
    exportEnabled: false,
    linked: false,
  };
}
