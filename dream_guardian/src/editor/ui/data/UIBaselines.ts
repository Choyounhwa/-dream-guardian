import {
  DESIGN_SIZE,
  LIMITS,
  MENU_CARD_IDS,
  SCHEMA_VERSION,
} from "./UIContracts";
import { contentHash, rejectDuplicateKeys } from "./UICanonicalJSON";
import { BOTTOM_BAR_LOCK_REASONS, BOTTOM_BAR_PUBLISHED } from "./screens/UIBottomBarContract";
import { HUD_PUBLISHED, deriveHudSlot } from "./screens/UIHUDContract";
import { SUBMENU_PUBLISHED } from "./screens/UISubmenuContract";

export { LIMITS };

export const BASELINE_VERSION = SCHEMA_VERSION;
export const APPROVED_IMAGE_HASH = "a".repeat(64);
export const RENDERER_FINGERPRINT = "menu-renderer-v1";

export type MenuPreset = {
  design: { width: number; height: number };
  cards: { id: string; x: number; y: number }[];
  width: number;
  height: number;
  workoutButton: { x: number; y: number; width: number; height: number };
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const MENU_V1_PRESET = deepFreeze<MenuPreset>({
  design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
  cards: MENU_CARD_IDS.map((id, index) => ({
    id,
    x: 40 + index * 10,
    y: 120,
  })),
  width: 280,
  height: 280,
  workoutButton: { x: 100, y: 1800, width: 400, height: 120 },
});

export const BASELINE_REGISTRY = {
  id: "menu-v1",
  version: BASELINE_VERSION,
  preset: MENU_V1_PRESET,
  presetHash: contentHash(MENU_V1_PRESET),
  approvedImageHash: APPROVED_IMAGE_HASH,
  rendererFingerprint: RENDERER_FINGERPRINT,
} as const;

export function clonePresetForEdit(id: string): MenuPreset {
  if (id !== BASELINE_REGISTRY.id) {
    throw new Error("unknown baseline");
  }
  return deepClone(BASELINE_REGISTRY.preset);
}

export type SubmenuPreset = {
  design: { width: number; height: number };
  placement: "grid";
  grid: {
    startX: number;
    startY: number;
    gapX: number;
    gapY: number;
    cols: number;
    w: number;
    h: number;
  };
  cardWidth: number;
  cardHeight: number;
  backButton: { id: "submenu-back"; x: number; y: number; width: number; height: number };
  title: { id: "submenu-title"; x: number; y: number; width: number; height: number };
  cellIds: readonly string[];
};

const SUBMENU_V1_PRESET = deepFreeze<SubmenuPreset>({
  design: { width: SUBMENU_PUBLISHED.design.width, height: SUBMENU_PUBLISHED.design.height },
  placement: "grid",
  grid: {
    startX: SUBMENU_PUBLISHED.grid.startX,
    startY: SUBMENU_PUBLISHED.grid.startY,
    gapX: SUBMENU_PUBLISHED.grid.gapX,
    gapY: SUBMENU_PUBLISHED.grid.gapY,
    cols: SUBMENU_PUBLISHED.grid.cols,
    w: SUBMENU_PUBLISHED.grid.w,
    h: SUBMENU_PUBLISHED.grid.h,
  },
  cardWidth: SUBMENU_PUBLISHED.cardWidth,
  cardHeight: SUBMENU_PUBLISHED.cardHeight,
  backButton: {
    id: "submenu-back",
    x: SUBMENU_PUBLISHED.backBtn.x,
    y: SUBMENU_PUBLISHED.backBtn.y,
    width: SUBMENU_PUBLISHED.backBtn.w,
    height: SUBMENU_PUBLISHED.backBtn.h,
  },
  title: {
    id: "submenu-title",
    x: SUBMENU_PUBLISHED.title.x,
    y: SUBMENU_PUBLISHED.title.y,
    width: SUBMENU_PUBLISHED.title.w,
    height: SUBMENU_PUBLISHED.title.h,
  },
  cellIds: ["submenu-cell-0", "submenu-cell-1", "submenu-cell-2", "submenu-cell-3", "submenu-cell-4", "submenu-cell-5"],
});

export const SUBMENU_BASELINE = {
  id: "submenu-v1",
  version: BASELINE_VERSION,
  preset: SUBMENU_V1_PRESET,
  presetHash: contentHash(SUBMENU_V1_PRESET),
  approvedImageHash: APPROVED_IMAGE_HASH,
  rendererFingerprint: "submenu-grid-v1",
} as const;

export function cloneSubmenuPresetForEdit(id: string): SubmenuPreset {
  if (id !== SUBMENU_BASELINE.id) {
    throw new Error("unknown baseline");
  }
  return deepClone(SUBMENU_BASELINE.preset);
}

export type HudPreset = {
  design: { width: number; height: number };
  placement: "slots";
  bounds: { x: number; y: number; w: number; h: number };
  slots: {
    playerHpBar: { x: number; y: number; w: number; h: number };
    bossHpBar: { x: number; y: number; w: number; h: number };
    combo: { x: number; y: number; w: number; h: number };
    bossName: { x: number; y: number; w: number; h: number };
    comboBadge: { x: number; y: number; w: number; h: number; marginRight: number };
  };
};

const comboBadgeSlot = deriveHudSlot("comboBadge");

const HUD_V1_PRESET = deepFreeze<HudPreset>({
  design: { width: HUD_PUBLISHED.design.width, height: HUD_PUBLISHED.design.height },
  placement: "slots",
  bounds: {
    x: HUD_PUBLISHED.bounds.x,
    y: HUD_PUBLISHED.bounds.y,
    w: HUD_PUBLISHED.bounds.w,
    h: HUD_PUBLISHED.bounds.h,
  },
  slots: {
    playerHpBar: {
      x: HUD_PUBLISHED.playerHpBar.x,
      y: HUD_PUBLISHED.playerHpBar.y,
      w: HUD_PUBLISHED.playerHpBar.w,
      h: HUD_PUBLISHED.playerHpBar.h,
    },
    bossHpBar: {
      x: HUD_PUBLISHED.bossHpBar.x,
      y: HUD_PUBLISHED.bossHpBar.y,
      w: HUD_PUBLISHED.bossHpBar.w,
      h: HUD_PUBLISHED.bossHpBar.h,
    },
    combo: {
      x: HUD_PUBLISHED.combo.x,
      y: HUD_PUBLISHED.combo.y,
      w: HUD_PUBLISHED.combo.w,
      h: HUD_PUBLISHED.combo.h,
    },
    bossName: {
      x: HUD_PUBLISHED.bossName.x,
      y: HUD_PUBLISHED.bossName.y,
      w: HUD_PUBLISHED.bossName.w,
      h: HUD_PUBLISHED.bossName.h,
    },
    comboBadge: {
      x: comboBadgeSlot.x,
      y: comboBadgeSlot.y,
      w: comboBadgeSlot.width,
      h: comboBadgeSlot.height,
      marginRight: HUD_PUBLISHED.comboBadge.marginRight,
    },
  },
});

export const HUD_BASELINE = {
  id: "hud-v1",
  version: BASELINE_VERSION,
  preset: HUD_V1_PRESET,
  presetHash: contentHash(HUD_V1_PRESET),
  approvedImageHash: APPROVED_IMAGE_HASH,
  rendererFingerprint: "hud-slots-v1",
} as const;

export function cloneHudPresetForEdit(id: string): HudPreset {
  if (id !== HUD_BASELINE.id) {
    throw new Error("unknown baseline");
  }
  return deepClone(HUD_BASELINE.preset);
}

export type BottomBarPreset = {
  design: { width: number; height: number };
  bounds: { x: number; y: number; w: number; h: number };
  height: number;
  settingsBtn: { x: number; y: number; w: number; h: number };
  actionBtn: { x: number; y: number; w: number; h: number };
  manaBar: { x: number; y: number; w: number; h: number };
  pause: { locked: true; reason: string };
};

const BOTTOM_BAR_V1_PRESET = deepFreeze<BottomBarPreset>({
  design: { width: BOTTOM_BAR_PUBLISHED.design.width, height: BOTTOM_BAR_PUBLISHED.design.height },
  bounds: {
    x: BOTTOM_BAR_PUBLISHED.bounds.x,
    y: BOTTOM_BAR_PUBLISHED.bounds.y,
    w: BOTTOM_BAR_PUBLISHED.bounds.w,
    h: BOTTOM_BAR_PUBLISHED.bounds.h,
  },
  height: BOTTOM_BAR_PUBLISHED.height,
  settingsBtn: {
    x: BOTTOM_BAR_PUBLISHED.settingsBtn.x,
    y: BOTTOM_BAR_PUBLISHED.settingsBtn.y,
    w: BOTTOM_BAR_PUBLISHED.settingsBtn.w,
    h: BOTTOM_BAR_PUBLISHED.settingsBtn.h,
  },
  actionBtn: {
    x: BOTTOM_BAR_PUBLISHED.actionBtn.x,
    y: BOTTOM_BAR_PUBLISHED.actionBtn.y,
    w: BOTTOM_BAR_PUBLISHED.actionBtn.w,
    h: BOTTOM_BAR_PUBLISHED.actionBtn.h,
  },
  manaBar: {
    x: BOTTOM_BAR_PUBLISHED.manaBar.x,
    y: BOTTOM_BAR_PUBLISHED.manaBar.y,
    w: BOTTOM_BAR_PUBLISHED.manaBar.w,
    h: BOTTOM_BAR_PUBLISHED.manaBar.h,
  },
  pause: { locked: true, reason: BOTTOM_BAR_LOCK_REASONS.sharedActionSlot },
});

export const BOTTOM_BAR_BASELINE = {
  id: "bottom-bar-v1",
  version: BASELINE_VERSION,
  preset: BOTTOM_BAR_V1_PRESET,
  presetHash: contentHash(BOTTOM_BAR_V1_PRESET),
  approvedImageHash: APPROVED_IMAGE_HASH,
  rendererFingerprint: "bottom-bar-slots-v1",
} as const;

export function cloneBottomBarPresetForEdit(id: string): BottomBarPreset {
  if (id !== BOTTOM_BAR_BASELINE.id) {
    throw new Error("unknown baseline");
  }
  return deepClone(BOTTOM_BAR_BASELINE.preset);
}

export function matchBaseline(input: {
  version: string;
  presetHash: string;
  imageHash: string;
  rendererFingerprint: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.version !== BASELINE_REGISTRY.version) {
    return { ok: false, reason: "version mismatch" };
  }
  if (input.presetHash !== BASELINE_REGISTRY.presetHash) {
    return { ok: false, reason: "preset hash mismatch" };
  }
  if (input.imageHash !== BASELINE_REGISTRY.approvedImageHash) {
    return { ok: false, reason: "image hash mismatch" };
  }
  if (input.rendererFingerprint !== BASELINE_REGISTRY.rendererFingerprint) {
    return { ok: false, reason: "renderer fingerprint mismatch" };
  }
  return { ok: true };
}

export type BaselineInspection = {
  mode: "official" | "preserve-readonly";
  exportAllowed: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasDamage(record: Record<string, unknown>): string | null {
  for (const value of Object.values(record)) {
    if (typeof value === "number" && !Number.isFinite(value)) return "non-finite number";
  }
  if (
    typeof record.id !== "string" ||
    typeof record.version !== "string" ||
    typeof record.presetHash !== "string" ||
    typeof record.approvedImageHash !== "string" ||
    typeof record.rendererFingerprint !== "string"
  ) {
    return "missing fields";
  }
  if (record.id !== BASELINE_REGISTRY.id) return "unknown id";
  if (record.version !== BASELINE_REGISTRY.version) return "version mismatch";
  if (record.presetHash !== BASELINE_REGISTRY.presetHash) return "hash mismatch";
  if (record.approvedImageHash !== APPROVED_IMAGE_HASH) return "image hash mismatch";
  if (record.rendererFingerprint !== RENDERER_FINGERPRINT) return "renderer fingerprint mismatch";
  return null;
}

export function inspectBaseline(record: unknown): BaselineInspection {
  if (!isRecord(record)) {
    return { mode: "preserve-readonly", exportAllowed: false, reason: "missing fields" };
  }
  const damage = hasDamage(record);
  if (damage) {
    return { mode: "preserve-readonly", exportAllowed: false, reason: damage };
  }
  return { mode: "official", exportAllowed: true, reason: "official match" };
}

export function canFormallyExport(record: unknown): boolean {
  if (isRecord(record) && "exportAllowed" in record && "mode" in record) {
    return record.exportAllowed === true && record.mode === "official";
  }
  return inspectBaseline(record).exportAllowed;
}

function walkLimits(value: unknown, depth: number): string | null {
  if (depth > LIMITS.maxDepth) return "max depth exceeded";
  if (typeof value === "number" && !Number.isFinite(value)) return "non-finite number";
  if (typeof value === "string" && value.length > LIMITS.maxNameLength && depth > 0) {
    return "name length exceeded";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = walkLimits(item, depth + 1);
      if (reason) return reason;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      if (key.length > LIMITS.maxNameLength) return "name length exceeded";
      const reason = walkLimits(value[key], depth + 1);
      if (reason) return reason;
    }
  }
  return null;
}

export function acceptBaselineRecord(raw: string): { ok: true; record: unknown } | { ok: false; reason: string } {
  const dup = rejectDuplicateKeys(raw);
  if (!dup.ok) return { ok: false, reason: dup.reason ?? "duplicate keys" };
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) {
    return { ok: false, reason: "max bytes exceeded" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid json" };
  }
  const limited = walkLimits(parsed, 0);
  if (limited) return { ok: false, reason: limited };
  return { ok: true, record: parsed };
}
