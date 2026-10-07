import { LIMITS, MENU_CARD_IDS } from "./data/UIContracts";
import { rejectDuplicateKeys } from "./data/UICanonicalJSON";
import {
  MENU_CARD_FIELDS,
  MENU_SHARED_SIZE_FIELDS,
  WORKOUT_BUTTON_FIELDS,
  findVisualElement,
} from "./data/UIProperties";
import { BASELINE_REGISTRY, type MenuPreset } from "./data/UIBaselines";
import type {
  UIVisualDocument,
  UIVisualElementType,
  UIVisualPageId,
} from "./data/UIVisualDocument";

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
  document?: UIVisualDocument;
  activePageId?: UIVisualPageId;
  baseline: MenuPreset;
  current: MenuPreset;
  buffer: Record<FieldName, string>;
  preview: PropertyValues;
  originalValues: PropertyValues;
  error: { errorLabelId: string; message: string } | null;
  isLocked?: boolean;
  lockReason?: string;
  elementType?: UIVisualElementType;
  text?: string;
  fontSize?: number;
  assetId?: string;
};

export type CreatePropertyPanelInput = {
  selectedId: string;
  baseline?: MenuPreset;
  current?: MenuPreset;
  document?: UIVisualDocument;
  activePageId?: UIVisualPageId;
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
  const card = preset.cards.find((item) => item.id === selectedId);
  if (card) {
    return {
      x: card.x,
      y: card.y,
      width: preset.width,
      height: preset.height,
    };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
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

export function createPropertyPanel(input: CreatePropertyPanelInput): PropertyPanel {
  const baseline = input.baseline ? clonePreset(input.baseline) : clonePreset(BASELINE_REGISTRY.preset);
  const current = input.current ? clonePreset(input.current) : clonePreset(BASELINE_REGISTRY.preset);

  // 1. UIVisualDocument 기준 속성 로드
  if (input.document) {
    const found = findVisualElement(input.document, input.selectedId, input.activePageId);
    if (found) {
      const { element, pageId } = found;
      const preview: PropertyValues = {
        x: element.bounds.x,
        y: element.bounds.y,
        width: element.bounds.width,
        height: element.bounds.height,
      };
      return {
        selectedId: input.selectedId,
        document: input.document,
        activePageId: pageId,
        baseline,
        current,
        buffer: {
          x: String(preview.x),
          y: String(preview.y),
          width: String(preview.width),
          height: String(preview.height),
        },
        preview,
        originalValues: { ...preview },
        error: null,
        isLocked: element.isLocked ?? false,
        lockReason: element.lockReason,
        elementType: element.type,
        text: element.text,
        fontSize: element.fontSize,
        assetId: element.assetId,
      };
    }

    // 문서 내에 존재하지 않는 unknown-id: cards[0] fallback 없이 오류/빈 선택 처리
    const emptyPreview: PropertyValues = { x: 0, y: 0, width: 0, height: 0 };
    return {
      selectedId: input.selectedId,
      document: input.document,
      activePageId: input.activePageId,
      baseline,
      current,
      buffer: { x: "", y: "", width: "", height: "" },
      preview: emptyPreview,
      originalValues: { ...emptyPreview },
      error: { errorLabelId: "err-selectedId", message: "unknown-id" },
      isLocked: false,
    };
  }

  // 2. 레거시 MenuPreset 기준 속성 로드
  let preview: PropertyValues | null = null;
  if (input.selectedId === "workout-button") {
    preview = {
      x: current.workoutButton.x,
      y: current.workoutButton.y,
      width: current.workoutButton.width,
      height: current.workoutButton.height,
    };
  } else if (CARD_IDS.has(input.selectedId)) {
    const card = current.cards.find((c) => c.id === input.selectedId);
    if (card) {
      preview = {
        x: card.x,
        y: card.y,
        width: current.width,
        height: current.height,
      };
    }
  }

  if (!preview) {
    // unknown ID fallback 제거 및 오류 상태 반환
    const emptyPreview: PropertyValues = { x: 0, y: 0, width: 0, height: 0 };
    return {
      selectedId: input.selectedId,
      baseline,
      current,
      buffer: { x: "", y: "", width: "", height: "" },
      preview: emptyPreview,
      originalValues: { ...emptyPreview },
      error: { errorLabelId: "err-selectedId", message: "unknown-id" },
    };
  }

  return {
    selectedId: input.selectedId,
    baseline,
    current,
    buffer: {
      x: String(preview.x),
      y: String(preview.y),
      width: String(preview.width),
      height: String(preview.height),
    },
    preview,
    originalValues: { ...preview },
    error: null,
  };
}

export function setBuffer(panel: PropertyPanel, field: string, raw: string): PropertyPanel {
  if (DANGEROUS.has(field)) {
    return {
      ...panel,
      error: {
        errorLabelId: `err-${field}`,
        message: "unknown-field",
      },
    };
  }

  if (panel.isLocked) {
    return {
      ...panel,
      error: {
        errorLabelId: `err-${field}`,
        message: panel.lockReason || "locked-element",
      },
    };
  }

  if (panel.error && panel.error.message === "unknown-id") {
    return panel;
  }

  if (!panel.document && !allowed(panel.selectedId, field)) {
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

export function cancelBuffer(panel: PropertyPanel, field?: string): PropertyPanel {
  if (field) {
    const key = field as FieldName;
    const origVal = panel.originalValues[key];
    return {
      ...panel,
      buffer: {
        ...panel.buffer,
        [key]: origVal !== undefined ? String(origVal) : "",
      },
      preview: {
        ...panel.preview,
        [key]: origVal ?? 0,
      },
      error: null,
    };
  }

  const newBuffer = { ...panel.buffer };
  const newPreview = { ...panel.preview };
  for (const k of Object.keys(panel.originalValues) as FieldName[]) {
    newBuffer[k] = String(panel.originalValues[k] ?? "");
    newPreview[k] = panel.originalValues[k] ?? 0;
  }
  return {
    ...panel,
    buffer: newBuffer,
    preview: newPreview,
    error: null,
  };
}

export function selectElement(
  panel: PropertyPanel,
  newSelectedId: string,
  pageId?: UIVisualPageId
): PropertyPanel {
  return createPropertyPanel({
    selectedId: newSelectedId,
    document: panel.document,
    activePageId: pageId ?? panel.activePageId,
    baseline: panel.baseline,
    current: panel.current,
  });
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
  if (panel.error !== null) {
    return { panel, command: null, affectedIds: [] };
  }
  if (panel.isLocked) {
    return { panel, command: null, affectedIds: [] };
  }

  const pending = (Object.keys(panel.buffer) as FieldName[]).find((field) => {
    const parsed = parseFinite(panel.buffer[field]);
    return parsed !== null && parsed !== panel.originalValues[field];
  });
  if (!pending) return { panel, command: null, affectedIds: [] };

  const value = parseFinite(panel.buffer[pending]);
  if (value === null) return { panel, command: null, affectedIds: [] };

  const ids = panel.document ? [panel.selectedId] : affectedIds(panel.selectedId, pending);

  const nextOriginalValues = {
    ...panel.originalValues,
    [pending]: value,
  };

  const nextPanel: PropertyPanel = {
    ...panel,
    originalValues: nextOriginalValues,
  };

  return {
    panel: nextPanel,
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
  if (panel.document) {
    const key = field as FieldName;
    const baselineVal = panel.originalValues[key] ?? 0;
    const currentVal = panel.preview[key] ?? 0;
    return {
      changed: baselineVal !== currentVal,
      baseline: baselineVal,
      current: currentVal,
    };
  }
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
  if (panel.isLocked) {
    return {
      editable: false,
      lockReason: panel.lockReason || "locked-element",
      code: "locked-element",
    };
  }
  if (panel.document) {
    if (panel.error && panel.error.message === "unknown-id") {
      return { editable: false, lockReason: "unknown-id", code: "unknown-id" };
    }
    return { editable: true, lockReason: "" };
  }
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
