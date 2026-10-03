import {
  DESIGN_SIZE,
  LIMITS,
  MENU_CARD_IDS,
  SCHEMA_VERSION,
} from "./UIContracts";
import { contentHash, rejectDuplicateKeys } from "./UICanonicalJSON";

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
