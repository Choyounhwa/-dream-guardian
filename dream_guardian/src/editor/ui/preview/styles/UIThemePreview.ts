import { THEME_BASELINE, cloneThemePresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  IMAGE_BACKGROUND_CONTRAST,
  THEME_CONTRACT,
  THEME_FIXTURES,
  THEME_ID,
  THEME_LOCK_REASONS,
  THEME_PUBLISHED,
  THEME_TOKEN_KEYS,
  THEME_VERSION,
  judgeThemeContrast,
  rejectThemeValue,
  type ThemeFixtureId,
  type ThemeTokenKey,
} from "../../data/styles/UIThemeContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const THEME_PREVIEW_ID = "theme";

export type ThemePorts = {
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

type ColorMap = Record<ThemeTokenKey, string>;

export type ThemeForm = {
  screen: "theme";
  default: ColorMap;
  highContrast: ColorMap;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  fingerprint: typeof THEME_CONTRACT.fingerprint;
  writesPlayerSetting: false;
  imageBackgroundContrast: typeof IMAGE_BACKGROUND_CONTRAST;
};

export type ThemeEditResult =
  | { ok: true; form: ThemeForm }
  | { ok: false; reason: string };

const TOKEN_SET = new Set<string>(THEME_TOKEN_KEYS);
const CSS_KEYS = new Set(["css", "style", "color", "background", "filter"]);
const A11Y_KEYS = new Set(["highContrast", "playerHighContrast", "accessibility"]);

function copyColors(source: ColorMap): ColorMap {
  return { ...source };
}

function published(id: ThemeFixtureId): ColorMap {
  return copyColors(THEME_PUBLISHED[id]);
}

function isTokenPatch(value: unknown): value is Partial<ColorMap> {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).every(([key, color]) => TOKEN_SET.has(key) && typeof color === "string");
}

export function createThemePreview(ports: ThemePorts = {}) {
  void ports.storage;
  void ports.bootGame;
  void ports.camera;
  void ports.network;
  void ports.onDanger;

  let colors = {
    default: published("default"),
    highContrast: published("highContrast"),
  };
  let dirty = false;
  const history: Array<typeof colors> = [];

  function form(): ThemeForm {
    return {
      screen: "theme",
      default: copyColors(colors.default),
      highContrast: copyColors(colors.highContrast),
      dirty,
      editEnabled: false,
      exportEnabled: false,
      fingerprint: THEME_CONTRACT.fingerprint,
      writesPlayerSetting: false,
      imageBackgroundContrast: IMAGE_BACKGROUND_CONTRAST,
    };
  }

  function select() {
    const registry = lookupScreenContract(THEME_ID, THEME_VERSION, THEME_ID);
    return {
      screen: "theme" as const,
      registry: "supportStatus" in registry ? { ...registry, registered: true as const } : registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): ThemeEditResult {
    for (const key of Object.keys(patch)) {
      if (key === "default" || key === "highContrast") continue;
      if (CSS_KEYS.has(key)) return { ok: false, reason: THEME_LOCK_REASONS.arbitraryCss };
      if (A11Y_KEYS.has(key)) return { ok: false, reason: THEME_LOCK_REASONS.accessibility };
      const rejected = rejectThemeValue(key, patch[key]);
      return { ok: false, reason: rejected.reason };
    }

    const next = {
      default: copyColors(colors.default),
      highContrast: copyColors(colors.highContrast),
    };
    for (const id of ["default", "highContrast"] as const) {
      const value = patch[id];
      if (value === undefined) continue;
      if (!isTokenPatch(value)) return { ok: false, reason: THEME_LOCK_REASONS.unknownField };
      for (const [key, color] of Object.entries(value) as Array<[ThemeTokenKey, string]>) {
        const rejected = rejectThemeValue(key, color);
        if (!rejected.ok && rejected.reason !== THEME_LOCK_REASONS.baselineMismatch) {
          return { ok: false, reason: rejected.reason };
        }
        if (color !== THEME_PUBLISHED[id][key]) {
          return { ok: false, reason: THEME_LOCK_REASONS.baselineMismatch };
        }
        next[id][key] = color;
      }
    }

    history.push({
      default: copyColors(colors.default),
      highContrast: copyColors(colors.highContrast),
    });
    colors = next;
    dirty = true;
    return { ok: true, form: form() };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return form();
    colors = previous;
    dirty = history.length > 0;
    return form();
  }

  function restoreDefault() {
    history.push({
      default: copyColors(colors.default),
      highContrast: copyColors(colors.highContrast),
    });
    const preset = cloneThemePresetForEdit(THEME_BASELINE.id);
    colors = {
      default: copyColors(preset.default),
      highContrast: copyColors(preset.highContrast),
    };
    dirty = false;
    return form();
  }

  function preview() {
    return {
      changedByPreviewOnly: true as const,
      gameApplyVerified: false as const,
      contextId: PREVIEW_CONTEXT_ID,
      contrast: {
        default: judgeThemeContrast({
          fixture: "default",
          foreground: "textPrimary",
          background: "bgCard",
        }),
        highContrast: judgeThemeContrast({
          fixture: "highContrast",
          foreground: "textPrimary",
          background: "bgCard",
        }),
      },
      imageBackgroundContrast: IMAGE_BACKGROUND_CONTRAST,
      failures: [] as string[],
      form: form(),
    };
  }

  function snapshot() {
    const current = form();
    return {
      checkpoint: {
        screen: "theme" as const,
        theme: {
          default: current.default,
          highContrast: current.highContrast,
        },
        writesPlayerSetting: false as const,
        fingerprint: THEME_CONTRACT.fingerprint,
      },
    };
  }

  return { select, edit, undo, restoreDefault, preview, snapshot, form };
}

export type ThemePreview = ReturnType<typeof createThemePreview>;

export function roundTripTheme(preview: ThemePreview = createThemePreview()) {
  const selected = preview.select();
  const shown = preview.preview();
  const snap = preview.snapshot();
  const transfer = buildTransfer({
    checkpoint: snap.checkpoint,
    scope: "theme",
    sourceId: "src-theme",
    exportId: "exp-theme",
    screen: "theme",
    version: THEME_VERSION,
    previewLinked: true,
  });
  const inspected = inspectTransfer({
    file: transfer.ok ? transfer.transfer : { kind: "blocked", reason: transfer.reason },
  });
  return { selected, shown, snapshot: snap, transfer, inspected, fixtures: THEME_FIXTURES };
}

export function registerThemePreview(): {
  registered: true;
  exportEnabled: false;
  screen: "theme";
} {
  lookupScreenContract(THEME_ID, THEME_VERSION, THEME_ID);
  return { registered: true, exportEnabled: false, screen: "theme" };
}
