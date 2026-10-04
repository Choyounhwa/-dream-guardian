import { LIMITS, MENU_CARD_IDS } from "./data/UIContracts";
import { rejectDuplicateKeys } from "./data/UICanonicalJSON";
import {
  MENU_CARD_FIELDS,
  MENU_SHARED_SIZE_FIELDS,
  WORKOUT_BUTTON_FIELDS,
} from "./data/UIProperties";
import type { MenuPreset } from "./data/UIBaselines";

export const GAME_APPLY_VERIFIED = false;
export const STORAGE_TOUCHED = false;

const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
const CARD_IDS = new Set<string>(MENU_CARD_IDS);
const CARD_FIELDS = new Set<string>(MENU_CARD_FIELDS.filter((field) => field !== "id"));
const SIZE_FIELDS = new Set<string>(MENU_SHARED_SIZE_FIELDS);
const WORKOUT_FIELDS = new Set<string>(WORKOUT_BUTTON_FIELDS);

export type FieldName = "x" | "y" | "width" | "height";

export type PropertyValues = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelCommand = {
  field: FieldName;
  value: number;
  target: string;
  affectedIds: string[];
};

export type PropertyPanel = {
  selectedId: string;
  baseline: MenuPreset;
  current: MenuPreset;
  buffer: Record<FieldName, string>;
  preview: PropertyValues;
  error: { errorLabelId: string; message: string } | null;
};

export type CommitResult = {
  panel: PropertyPanel;
  command: PanelCommand | null;
  affectedIds: string[];
};

export type AcceptResult = { ok: true; value: unknown } | { ok: false; code: string; reason: string };

function clonePreset(preset: MenuPreset): MenuPreset {
  return JSON.parse(JSON.stringify(preset)) as MenuPreset;
}

function valuesFor(preset: MenuPreset, selectedId: string): PropertyValues {
  if (selectedId === "workout-button") {
    return {
      x: preset.workoutButton.x,
      y: preset.workoutButton.y,
      width: preset.workoutButton.width,
      height: preset.workoutButton.height,
    };
  }
  const card = preset.cards.find((item) => item.id === selectedId) ?? preset.cards[0];
  return {
    x: card.x,
    y: card.y,
    width: preset.width,
    height: preset.height,
  };
}

function allowed(selectedId: string, field: string): boolean {
  if (selectedId === "workout-button") return WORKOUT_FIELDS.has(field);
  if (!CARD_IDS.has(selectedId)) return false;
  return CARD_FIELDS.has(field) || SIZE_FIELDS.has(field);
}

function parseFinite(raw: string): number | null {
  if (raw === "" || raw === "-") return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function createPropertyPanel(input: {
  selectedId: string;
  baseline: MenuPreset;
  current: MenuPreset;
}): PropertyPanel {
  const current = clonePreset(input.current);
  const preview = valuesFor(current, input.selectedId);
  return {
    selectedId: input.selectedId,
    baseline: clonePreset(input.baseline),
    current,
    buffer: {
      x: String(preview.x),
      y: String(preview.y),
      width: String(preview.width),
      height: String(preview.height),
    },
    preview,
    error: null,
  };
}

export function setBuffer(panel: PropertyPanel, field: string, raw: string): PropertyPanel {
  if (DANGEROUS.has(field) || !allowed(panel.selectedId, field)) {
    return {
      ...panel,
      error: {
        errorLabelId: `err-${field}`,
        message: "unknown-field",
      },
    };
  }
  const key = field as FieldName;
  const parsed = parseFinite(raw);
  const preview = { ...panel.preview };
  if (parsed !== null) preview[key] = parsed;
  return {
    ...panel,
    buffer: { ...panel.buffer, [key]: raw },
    preview,
    error:
      parsed === null
        ? { errorLabelId: `err-${field}`, message: "invalid number" }
        : null,
  };
}

function affectedIds(selectedId: string, field: string): string[] {
  if (selectedId !== "workout-button" && SIZE_FIELDS.has(field)) return [...MENU_CARD_IDS];
  return [selectedId];
}

export function commit(
  panel: PropertyPanel,
  input: { reason: "enter" | "blur" | "input" },
): CommitResult {
  if (input.reason === "input") {
    return { panel, command: null, affectedIds: [] };
  }
  const pending = (Object.keys(panel.buffer) as FieldName[]).find((field) => {
    const parsed = parseFinite(panel.buffer[field]);
    return parsed !== null && parsed !== valuesFor(panel.current, panel.selectedId)[field];
  });
  if (!pending) return { panel, command: null, affectedIds: [] };
  const value = parseFinite(panel.buffer[pending]);
  if (value === null) return { panel, command: null, affectedIds: [] };
  const ids = affectedIds(panel.selectedId, pending);
  return {
    panel,
    command: {
      field: pending,
      value,
      target: panel.selectedId,
      affectedIds: ids,
    },
    affectedIds: ids,
  };
}

export function compare(
  panel: PropertyPanel,
  field: string,
): { changed: boolean; baseline: number; current: number } {
  const baseline = valuesFor(panel.baseline, panel.selectedId);
  const current = valuesFor(panel.current, panel.selectedId);
  const key = field as FieldName;
  return {
    changed: baseline[key] !== current[key],
    baseline: baseline[key],
    current: current[key],
  };
}

export function fieldMeta(
  panel: PropertyPanel,
  field: string,
): { editable: boolean; lockReason: string; code?: string } {
  if (DANGEROUS.has(field) || !allowed(panel.selectedId, field)) {
    return {
      editable: false,
      lockReason: "registry field is not editable",
      code: "unknown-field",
    };
  }
  return { editable: true, lockReason: "" };
}

function depthOf(value: unknown, depth: number): number {
  if (value === null || typeof value !== "object") return depth;
  let max = depth;
  for (const child of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, depthOf(child, depth + 1));
  }
  return max;
}

function nameTooLong(value: unknown): boolean {
  if (typeof value === "string") return value.length > LIMITS.maxNameLength;
  if (value === null || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.length > LIMITS.maxNameLength || nameTooLong(child)) return true;
  }
  return false;
}

export function acceptRaw(raw: string): AcceptResult {
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) {
    return { ok: false, code: "max-bytes", reason: "1MiB" };
  }
  const duplicates = rejectDuplicateKeys(raw);
  if (!duplicates.ok) {
    return { ok: false, code: "duplicate-key", reason: duplicates.reason ?? "duplicate key" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid-json", reason: "invalid json" };
  }
  if (parsed !== null && typeof parsed === "object") {
    for (const key of Object.keys(parsed as object)) {
      if (DANGEROUS.has(key)) return { ok: false, code: "dangerous-key", reason: key };
    }
  }
  if (depthOf(parsed, 1) > LIMITS.maxDepth) {
    return { ok: false, code: "max-depth", reason: "depth 16" };
  }
  if (nameTooLong(parsed)) {
    return { ok: false, code: "max-name", reason: "name 80" };
  }
  return { ok: true, value: parsed };
}
