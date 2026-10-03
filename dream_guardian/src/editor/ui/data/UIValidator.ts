import {
  DESIGN_SIZE,
  KINDS,
  LIMITS,
  MENU_CARD_IDS,
  SCHEMA_VERSION,
} from "./UIContracts";
import { rejectDuplicateKeys } from "./UICanonicalJSON";
import { inspectBaseline, matchBaseline } from "./UIBaselines";
import {
  ASSET_OVERRIDE_KEYS,
  GAME_STAT_KEYS,
  MENU_CARD_FIELDS,
  PATH_KEYS,
  WORKOUT_BUTTON_FIELDS,
} from "./UIProperties";

export const OUT_OF_SCOPE_MEANS_RESTORE = false;

export const PROTECTED_REGIONS = Object.freeze([
  Object.freeze({ id: "hud-safe", x: 0, y: 0, width: DESIGN_SIZE.width, height: 120 }),
]);

export type ValidationError = { code: string; path: string };
export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
const SCOPES = new Set(["menu", "menu.card"]);
const PROJECT_KEYS = new Set(["kind", "schemaVersion", "design", "menu", "baseline"]);
const TRANSFER_KEYS = new Set([
  "kind",
  "schemaVersion",
  "design",
  "scope",
  "content",
  "baseline",
  "contentHash",
  "artifactHash",
  "sourceCheckpointHash",
  "sourceComparison",
]);
const DESIGN_KEYS = new Set(["width", "height"]);
const MENU_KEYS = new Set(["cards", "width", "height", "workoutButton"]);
const BASELINE_KEYS = new Set(["id", "version", "presetHash", "approvedImageHash", "rendererFingerprint"]);
const CARD_KEYS = new Set<string>(MENU_CARD_FIELDS);
const BUTTON_KEYS = new Set<string>(WORKOUT_BUTTON_FIELDS);
const REJECTED = new Set<string>([...GAME_STAT_KEYS, ...PATH_KEYS, ...ASSET_OVERRIDE_KEYS]);

function fail(errors: ValidationError[]): ValidationResult {
  return { ok: false, errors };
}

function join(path: string, key: string): string {
  return path + "." + key;
}

function at(path: string, index: number): string {
  return path + "[" + String(index) + "]";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownKeys(value: object): string[] {
  return Object.keys(value).concat(
    Object.getOwnPropertyNames(value).filter((key) => !Object.keys(value).includes(key)),
  );
}

function rect(x: unknown, y: unknown, width: unknown, height: unknown) {
  return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function geometry(
  box: { x: number; y: number; width: number; height: number },
  path: string,
  errors: ValidationError[],
) {
  const values = [box.x, box.y, box.width, box.height];
  if (values.some((value) => !Number.isFinite(value))) {
    errors.push({ code: "non-finite", path });
    return;
  }
  if (
    box.x < 0 ||
    box.y < 0 ||
    box.width <= 0 ||
    box.height <= 0 ||
    box.x + box.width > DESIGN_SIZE.width ||
    box.y + box.height > DESIGN_SIZE.height
  ) {
    errors.push({ code: "out-of-canvas", path });
  }
  if (PROTECTED_REGIONS.some((region) => overlaps(box, region))) {
    errors.push({ code: "protected-region", path });
  }
}

function unknownKeys(record: object, allowed: Set<string>, path: string, errors: ValidationError[]) {
  for (const key of ownKeys(record)) {
    if (DANGEROUS.has(key)) errors.push({ code: "dangerous-key", path: join(path, key) });
    else if (REJECTED.has(key) || !allowed.has(key)) errors.push({ code: "unknown-field", path: join(path, key) });
  }
}

function limits(input: unknown, errors: ValidationError[]) {
  const encoded = JSON.stringify(input);
  if (encoded !== undefined && new TextEncoder().encode(encoded).length > LIMITS.maxBytes) {
    errors.push({ code: "out-of-range", path: "$" });
  }
  const seen = new WeakSet<object>();
  function walk(value: unknown, depth: number, path: string) {
    if (depth > LIMITS.maxDepth) {
      errors.push({ code: "out-of-range", path });
      return;
    }
    if (typeof value === "number" && !Number.isFinite(value)) errors.push({ code: "non-finite", path });
    if (typeof value === "string" && value.length > LIMITS.maxNameLength) errors.push({ code: "out-of-range", path });
    if (typeof value !== "object" || value === null) return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, depth + 1, at(path, index)));
      return;
    }
    for (const key of ownKeys(value)) {
      if (key.length > LIMITS.maxNameLength) errors.push({ code: "out-of-range", path: join(path, key) });
      if (DANGEROUS.has(key)) errors.push({ code: "dangerous-key", path: join(path, key) });
      walk((value as Record<string, unknown>)[key], depth + 1, join(path, key));
    }
  }
  walk(input, 1, "$");
}

function baseline(value: unknown, path: string, errors: ValidationError[]) {
  if (!isRecord(value)) {
    errors.push({ code: "baseline-mismatch", path });
    return;
  }
  unknownKeys(value, BASELINE_KEYS, path, errors);
  const inspected = inspectBaseline(value);
  const matched = matchBaseline({
    version: String(value.version ?? ""),
    presetHash: String(value.presetHash ?? ""),
    imageHash: String(value.approvedImageHash ?? ""),
    rendererFingerprint: String(value.rendererFingerprint ?? ""),
  });
  if (!inspected.exportAllowed || !matched.ok) errors.push({ code: "baseline-mismatch", path });
}

function cards(value: unknown, width: unknown, height: unknown, path: string, errors: ValidationError[]) {
  if (!Array.isArray(value)) {
    errors.push({ code: "missing-card", path });
    return;
  }
  const seen = new Map<string, number>();
  for (const [index, card] of value.entries()) {
    const cardPath = at(path, index);
    if (!isRecord(card)) {
      errors.push({ code: "missing-card", path: cardPath });
      continue;
    }
    unknownKeys(card, CARD_KEYS, cardPath, errors);
    if (typeof card.id === "string") seen.set(card.id, (seen.get(card.id) ?? 0) + 1);
    for (const field of MENU_CARD_FIELDS) {
      if (card[field] === undefined) errors.push({ code: "incomplete-scope", path: join(cardPath, field) });
    }
    geometry(rect(card.x, card.y, width, height), cardPath, errors);
  }
  for (const id of MENU_CARD_IDS) {
    if (!seen.has(id) && ![...seen.values()].some((count) => count > 1)) {
      errors.push({ code: "missing-card", path: join(path, id) });
    }
  }
  for (const [id, count] of seen) {
    if (count > 1) errors.push({ code: "duplicate-card-id", path: join(path, id) });
  }
}

function sharedSize(width: unknown, height: unknown, path: string, errors: ValidationError[]) {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    errors.push({ code: "shared-size-violation", path });
  }
}

function button(value: unknown, path: string, errors: ValidationError[]) {
  if (!isRecord(value)) {
    errors.push({ code: "incomplete-scope", path });
    return;
  }
  unknownKeys(value, BUTTON_KEYS, path, errors);
  for (const field of WORKOUT_BUTTON_FIELDS) {
    if (typeof value[field] !== "number") errors.push({ code: "incomplete-scope", path: join(path, field) });
  }
  geometry(rect(value.x, value.y, value.width, value.height), path, errors);
}

function menu(value: unknown, path: string, errors: ValidationError[]) {
  if (!isRecord(value)) {
    errors.push({ code: "incomplete-scope", path });
    return;
  }
  unknownKeys(value, MENU_KEYS, path, errors);
  sharedSize(value.width, value.height, path, errors);
  cards(value.cards, value.width, value.height, join(path, "cards"), errors);
  button(value.workoutButton, join(path, "workoutButton"), errors);
}

function scoped(scope: string, content: unknown, path: string, errors: ValidationError[]) {
  if (scope === "menu") {
    menu(content, path, errors);
    return;
  }
  if (scope === "menu.card") {
    if (!isRecord(content) || !Array.isArray(content.cards)) {
      errors.push({ code: "incomplete-scope", path });
      return;
    }
    cards(content.cards, content.width, content.height, join(path, "cards"), errors);
    return;
  }
  }

function design(value: unknown, path: string, errors: ValidationError[]) {
  if (!isRecord(value)) {
    errors.push({ code: "out-of-canvas", path });
    return;
  }
  unknownKeys(value, DESIGN_KEYS, path, errors);
  if (value.width !== DESIGN_SIZE.width || value.height !== DESIGN_SIZE.height) {
    errors.push({ code: "out-of-canvas", path });
  }
}

function header(input: Record<string, unknown>, expected: string, errors: ValidationError[]) {
  if (input.kind !== expected) errors.push({ code: "kind-mismatch", path: "$.kind" });
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push({ code: "version-mismatch", path: "$.schemaVersion" });
}

export function validateProject(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  limits(input, errors);
  if (!isRecord(input)) return fail(errors.concat({ code: "kind-mismatch", path: "$" }));
  unknownKeys(input, PROJECT_KEYS, "$", errors);
  header(input, KINDS.project, errors);
  design(input.design, "$.design", errors);
  menu(input.menu, "$.menu", errors);
  baseline(input.baseline, "$.baseline", errors);
  return errors.length === 0 ? { ok: true } : fail(errors);
}

export function validateTransfer(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  limits(input, errors);
  if (!isRecord(input)) return fail(errors.concat({ code: "kind-mismatch", path: "$" }));
  unknownKeys(input, TRANSFER_KEYS, "$", errors);
  header(input, KINDS.transfer, errors);
  design(input.design, "$.design", errors);
  if (typeof input.scope !== "string" || !SCOPES.has(input.scope)) {
    errors.push({ code: "scope-mismatch", path: "$.scope" });
  } else {
    scoped(input.scope, input.content, "$.content", errors);
  }
  baseline(input.baseline, "$.baseline", errors);
  if (typeof input.contentHash !== "string" || typeof input.artifactHash !== "string") {
    errors.push({ code: "incomplete-scope", path: "$.contentHash" });
  }
  return errors.length === 0 ? { ok: true } : fail(errors);
}

export function validateRaw(raw: string): ValidationResult {
  const errors: ValidationError[] = [];
  const dup = rejectDuplicateKeys(raw);
  if (!dup.ok) errors.push({ code: "dangerous-key", path: "$" });
  for (const key of DANGEROUS) {
    if (raw.includes('"' + key + '"')) errors.push({ code: "dangerous-key", path: join("$", key) });
  }
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) errors.push({ code: "out-of-range", path: "$" });
  if (errors.length > 0) return fail(errors);
  try {
    return validateProject(JSON.parse(raw));
  } catch {
    return fail([{ code: "kind-mismatch", path: "$" }]);
  }
}
