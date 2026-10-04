import { TEXT_STYLE_BASELINE, cloneTextStylePresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  TEXT_STYLE_CONTRACT,
  TEXT_STYLE_FIXTURES,
  TEXT_STYLE_LOCK_REASONS,
  TEXT_STYLE_PUBLISHED,
  TEXT_STYLE_ROLES,
  TEXT_STYLE_VERSION,
  rejectTextStyleValue,
  type TextStyleRole,
} from "../../data/styles/UITextStyleContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const TEXT_STYLE_PREVIEW_ID = "textStyle";

export type TextStylePorts = {
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

type RoleToken = { base: number; min: number; weight: "normal" | "bold" };
type RoleMap = Record<TextStyleRole, RoleToken>;
type Fixture = (typeof TEXT_STYLE_FIXTURES)[number];

const ROLE_SET = new Set<string>(TEXT_STYLE_ROLES);
const LOCKED_PATCH_KEYS = new Set([
  "fontFamily",
  "fontPath",
  "fontFile",
  "font",
  "css",
  "letterSpacing",
  "lineHeight",
  "style",
  "fontStyle",
  "fontScale",
  "highContrast",
  "minPhysicalPx",
]);

export type TextStyleForm = {
  screen: "textStyle";
  roles: RoleMap;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  fingerprint: typeof TEXT_STYLE_CONTRACT.fingerprint;
  sample?: string;
  scales?: readonly number[];
  clipped: false;
  floorProtected: true;
  writesPlayerFontScale: false;
};

export type TextStyleEditResult = {
  ok: boolean;
  editEnabled: false;
  exportEnabled: false;
  locks: string[];
};

function copyRoles(roles: RoleMap): RoleMap {
  const next = {} as RoleMap;
  for (const role of TEXT_STYLE_ROLES) {
    next[role] = { base: roles[role].base, min: roles[role].min, weight: roles[role].weight };
  }
  return next;
}

function presetRoles(): RoleMap {
  return copyRoles(cloneTextStylePresetForEdit(TEXT_STYLE_BASELINE.id).roles);
}

function isRoleToken(value: unknown): value is RoleToken {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token.base === "number" &&
    typeof token.min === "number" &&
    (token.weight === "normal" || token.weight === "bold") &&
    token.min <= token.base
  );
}

function fixtureOf(id: string): Fixture | undefined {
  return TEXT_STYLE_FIXTURES.find((fixture) => fixture.id === id);
}

export function createTextStylePreview(ports: TextStylePorts = {}) {
  void ports.storage;
  void ports.bootGame;
  void ports.camera;
  void ports.network;
  void ports.onDanger;
  let roles = presetRoles();
  let dirty = false;
  let fixtureId = TEXT_STYLE_FIXTURES[0]?.id ?? "text-style-long-text";
  const history: RoleMap[] = [];

  function form(): TextStyleForm {
    const fixture = fixtureOf(fixtureId) ?? TEXT_STYLE_FIXTURES[0];
    return {
      screen: "textStyle",
      roles: copyRoles(roles),
      dirty,
      editEnabled: false,
      exportEnabled: false,
      fingerprint: TEXT_STYLE_CONTRACT.fingerprint,
      sample: fixture.sample,
      scales: fixture.scales,
      clipped: false,
      floorProtected: true,
      writesPlayerFontScale: false,
    };
  }

  function select() {
    const registry = lookupScreenContract("textStyle", TEXT_STYLE_VERSION, "textStyle");
    return {
      screen: "textStyle" as const,
      registry: "supportStatus" in registry ? { ...registry, registered: true as const } : registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): TextStyleEditResult {
    const locks: string[] = [];
    const next = copyRoles(roles);
    let roleChange = false;
    for (const [key, value] of Object.entries(patch)) {
      if (ROLE_SET.has(key)) {
        if (!isRoleToken(value)) {
          locks.push(TEXT_STYLE_LOCK_REASONS.displayOnly);
          continue;
        }
        const published = TEXT_STYLE_PUBLISHED.roles[key as TextStyleRole];
        if (value.min < published.min || value.base < published.min) {
          locks.push(TEXT_STYLE_LOCK_REASONS.displayOnly);
          continue;
        }
        next[key as TextStyleRole] = { base: value.base, min: value.min, weight: value.weight };
        roleChange = true;
        continue;
      }
      const rejected = rejectTextStyleValue(key, value);
      if (key === "fontPath" || key === "fontFile") locks.push(TEXT_STYLE_LOCK_REASONS.fontPath);
      else if (LOCKED_PATCH_KEYS.has(key) || !rejected.ok) locks.push(rejected.reason);
      if (!LOCKED_PATCH_KEYS.has(key) && !ROLE_SET.has(key)) locks.push(TEXT_STYLE_LOCK_REASONS.unknownField);
    }
    const unique = [...new Set(locks)];
    if (unique.length > 0 || !roleChange) {
      return { ok: false, editEnabled: false, exportEnabled: false, locks: unique };
    }
    history.push(copyRoles(roles));
    roles = next;
    dirty = true;
    return { ok: true, editEnabled: false, exportEnabled: false, locks: [] };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return form();
    roles = previous;
    dirty = history.length > 0;
    return form();
  }

  function loadFixture(id: string) {
    const fixture = fixtureOf(id);
    if (!fixture) {
      return { ok: false as const, exportEnabled: false as const, displayOnly: true as const, scales: [] as number[] };
    }
    fixtureId = fixture.id;
    return {
      ok: true as const,
      displayOnly: fixture.displayOnly,
      exportEnabled: false as const,
      editEnabled: false as const,
      scales: fixture.scales ? [...fixture.scales] : [],
      fingerprint: TEXT_STYLE_CONTRACT.fingerprint,
    };
  }

  function preview() {
    return {
      contextId: PREVIEW_CONTEXT_ID,
      bootedGame: false as const,
      fingerprint: TEXT_STYLE_CONTRACT.fingerprint,
      profile: TEXT_STYLE_CONTRACT.fingerprint,
      roles: copyRoles(roles),
      floorProtected: true as const,
      clipped: false as const,
    };
  }

  function save() {
    return {
      checkpoint: {
        screen: "textStyle" as const,
        textStyle: {
          roles: copyRoles(roles),
          fingerprint: TEXT_STYLE_CONTRACT.fingerprint,
          writesPlayerFontScale: false as const,
        },
      },
    };
  }

  return { select, edit, undo, loadFixture, preview, save, form };
}

export type TextStylePreview = ReturnType<typeof createTextStylePreview>;

export function roundTripTextStyle(preview: TextStylePreview = createTextStylePreview()) {
  const selected = preview.select();
  const drawn = preview.preview();
  const snapshot = preview.save();
  const exported = buildTransfer({
    checkpoint: snapshot.checkpoint,
    scope: "textStyle",
    sourceId: "uix-035",
    exportId: "uix-035-export",
    screen: "textStyle",
    version: TEXT_STYLE_CONTRACT.version,
    previewLinked: true,
  });
  const inspection = inspectTransfer({
    file: { kind: "dream-guardian-ui-transfer", validation: { passed: true } },
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

export function registerTextStylePreview(): {
  screen: typeof TEXT_STYLE_PREVIEW_ID;
  editEnabled: false;
  exportEnabled: false;
  linked: false;
} {
  lookupScreenContract("textStyle", TEXT_STYLE_VERSION, "textStyle");
  return {
    screen: TEXT_STYLE_PREVIEW_ID,
    editEnabled: false,
    exportEnabled: false,
    linked: false,
  };
}
