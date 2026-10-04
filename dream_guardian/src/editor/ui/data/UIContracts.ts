import {
  ASSET_OVERRIDE_KEYS,
  GAME_STAT_KEYS,
  MENU_CARD_FIELDS,
  MENU_SHARED_SIZE_FIELDS,
  PATH_KEYS,
  WORKOUT_BUTTON_FIELDS,
  isRejectedCategoryKey,
  lookupScreenContract,
} from "./UIProperties";

export const SCHEMA_VERSION = "1.0.0";

export const KINDS = {
  project: "dream-guardian-ui-project",
  transfer: "dream-guardian-ui-transfer",
} as const;

export const DESIGN_SIZE = { width: 1080, height: 2160 } as const;

export const MENU_CARD_IDS = [
  "card-story",
  "card-play",
  "card-records",
  "card-settings",
  "card-credits",
] as const;

export const LIMITS = { maxBytes: 1048576, maxDepth: 16, maxNameLength: 80 } as const;

export const REJECTED_CATEGORIES = [
  "game-stats",
  "arbitrary-paths",
  "asset-overrides",
  "unsupported-scopes",
] as const;

export const SCOPED_SNAPSHOT_SEMANTICS =
  "scoped-snapshot의 범위 밖 키 미포함은 삭제나 기본값 복원이 아니다. 범위 안은 완전 값이어야 한다.";

export const SOURCE_COMPARISON_NOT_PERFORMED = "원본 대조 미실시";

export const HASHES_ARE_NOT_SIGNATURES = true;

export { RESOURCE_BINARY_GUARANTEED, STYLE_TRANSFER_VERSION } from "./UIResourceCatalog";

const ALLOWED_SCOPES = ["menu"] as const;

const MENU_FIELDS = new Set<string>([
  "cards",
  ...MENU_SHARED_SIZE_FIELDS,
  "workoutButton",
]);

const WORKOUT_FIELDS = new Set<string>(WORKOUT_BUTTON_FIELDS);
const CARD_FIELDS = new Set<string>(MENU_CARD_FIELDS);
const CARD_IDS = new Set<string>(MENU_CARD_IDS);
const GAME_STATS = new Set<string>(GAME_STAT_KEYS);
const PATHS = new Set<string>(PATH_KEYS);
const ASSET_OVERRIDES = new Set<string>(ASSET_OVERRIDE_KEYS);

const PROJECT_ROOT = new Set([
  "kind",
  "schemaVersion",
  "design",
  "menu",
]);

const TRANSFER_ROOT = new Set([
  "kind",
  "schemaVersion",
  "design",
  "scope",
  "content",
  "contentHash",
  "artifactHash",
  "sourceCheckpointHash",
  "sourceComparison",
]);

export type ContractOk = {
  ok: true;
  outOfScopeOmissionMeansRestoreDefaults?: false;
  sourceComparison?: string;
};

export type ContractResult = ContractOk | { ok: false; reason: string };

export function outOfScopeOmissionMeansRestoreDefaults(): false {
  return false;
}

export function isFieldAllowed(scope: string, field: string): boolean {
  if (scope === "menu") {
    const contract = lookupScreenContract("menu", SCHEMA_VERSION, "menu");
    if (!("requiredFields" in contract)) return false;
    return contract.requiredFields.includes(field);
  }
  if (scope === "menu.workoutButton") return WORKOUT_FIELDS.has(field);
  if (scope === "menu.card") return CARD_FIELDS.has(field);
  return lookupScreenContract(scope, SCHEMA_VERSION, scope).registered === true && false;
}

function fail(reason: string): ContractResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnly(record: Record<string, unknown>, allowed: Set<string>): string | null {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return key;
  }
  return null;
}

function isArbitraryPath(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.includes("..")) return true;
  if (value.includes("\\")) return true;
  if (/^[a-zA-Z]:/.test(value)) return true;
  if (value.startsWith("/")) return true;
  if (/^[a-z]+:\/\//i.test(value)) return true;
  return false;
}

function rejectDangerous(record: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(record)) {
    if (GAME_STATS.has(key) || isRejectedCategoryKey(key)) return `rejected game stat: ${key}`;
    if (PATHS.has(key) || ASSET_OVERRIDES.has(key)) return `rejected field: ${key}`;
    if (isArbitraryPath(value)) return `rejected path: ${key}`;
    if (typeof key === "string" && (key.includes("..") || key.includes("/") || key.includes("\\"))) {
      return `rejected key: ${key}`;
    }
  }
  return null;
}

function assertDesign(value: unknown): string | null {
  if (!isRecord(value)) return "design required";
  const extra = hasOnly(value, new Set(["width", "height"]));
  if (extra) return `unsupported design field: ${extra}`;
  if (value.width !== DESIGN_SIZE.width || value.height !== DESIGN_SIZE.height) {
    return "design size must be 1080x2160";
  }
  return null;
}

function assertMenu(value: unknown): string | null {
  if (!isRecord(value)) return "menu required";
  const dangerous = rejectDangerous(value);
  if (dangerous) return dangerous;
  const extra = hasOnly(value, MENU_FIELDS);
  if (extra) return `unsupported menu field: ${extra}`;
  if (!Array.isArray(value.cards) || value.cards.length !== MENU_CARD_IDS.length) {
    return "menu requires exactly 5 cards";
  }
  const seen = new Set<string>();
  for (const card of value.cards) {
    if (!isRecord(card)) return "card must be an object";
    const cardExtra = hasOnly(card, CARD_FIELDS);
    if (cardExtra) return `unsupported card field: ${cardExtra}`;
    if (typeof card.id !== "string" || !CARD_IDS.has(card.id) || seen.has(card.id)) {
      return "unsupported or duplicate card id";
    }
    if (typeof card.x !== "number" || typeof card.y !== "number") return "card x/y required";
    seen.add(card.id);
  }
  if (seen.size !== MENU_CARD_IDS.length) return "menu card set incomplete";
  if (typeof value.width !== "number" || typeof value.height !== "number") {
    return "shared width/height required";
  }
  if (!isRecord(value.workoutButton)) return "workout button rectangle required";
  const buttonExtra = hasOnly(value.workoutButton, WORKOUT_FIELDS);
  if (buttonExtra) return `unsupported workout button field: ${buttonExtra}`;
  for (const field of WORKOUT_BUTTON_FIELDS) {
    if (typeof value.workoutButton[field] !== "number") return "workout button rectangle incomplete";
  }
  return null;
}

function assertHash(value: unknown, allowNull: boolean): boolean {
  if (allowNull && value === null) return true;
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

export function assertProjectContract(input: unknown): ContractResult {
  if (!isRecord(input)) return fail("project must be an object");
  const dangerous = rejectDangerous(input);
  if (dangerous) return fail(dangerous);
  const extra = hasOnly(input, PROJECT_ROOT);
  if (extra) return fail(`unsupported project field: ${extra}`);
  if (input.kind !== KINDS.project) return fail("wrong kind");
  if (input.schemaVersion !== SCHEMA_VERSION) return fail("wrong schemaVersion");
  const designError = assertDesign(input.design);
  if (designError) return fail(designError);
  const menuError = assertMenu(input.menu);
  if (menuError) return fail(menuError);
  return { ok: true };
}

export function assertTransferContract(input: unknown): ContractResult {
  if (!isRecord(input)) return fail("transfer must be an object");
  const dangerous = rejectDangerous(input);
  if (dangerous) return fail(dangerous);
  const extra = hasOnly(input, TRANSFER_ROOT);
  if (extra) return fail(`unsupported transfer field: ${extra}`);
  if (input.kind !== KINDS.transfer) return fail("wrong kind");
  if (input.schemaVersion !== SCHEMA_VERSION) return fail("wrong schemaVersion");
  const designError = assertDesign(input.design);
  if (designError) return fail(designError);
  if (typeof input.scope !== "string" || !ALLOWED_SCOPES.includes(input.scope as "menu")) {
    return fail("unsupported scope");
  }
  const menuError = assertMenu(input.content);
  if (menuError) return fail(menuError);
  if (!assertHash(input.contentHash, false) || !assertHash(input.artifactHash, false)) {
    return fail("contentHash and artifactHash required");
  }
  const missingSource = input.sourceCheckpointHash === null || input.sourceComparison === "not-performed";
  if (!assertHash(input.sourceCheckpointHash, true)) return fail("invalid sourceCheckpointHash");
  if (missingSource && input.sourceComparison !== "not-performed") {
    return fail("missing source must be marked not-performed");
  }
  if (
    input.sourceComparison !== "performed" &&
    input.sourceComparison !== "not-performed" &&
    input.sourceComparison !== "hash-mismatch"
  ) {
    return fail("invalid sourceComparison");
  }
  if (missingSource) {
    return {
      ok: true,
      sourceComparison: SOURCE_COMPARISON_NOT_PERFORMED,
    };
  }
  if (input.sourceComparison === "hash-mismatch") {
    return { ok: true, sourceComparison: "hash-mismatch" };
  }
  return { ok: true, outOfScopeOmissionMeansRestoreDefaults: false };
}

export function validateExternalJsonLimits(input: unknown): ContractResult {
  const encoded = JSON.stringify(input);
  if (encoded !== undefined && new TextEncoder().encode(encoded).length > LIMITS.maxBytes) {
    return fail("file exceeds 1MiB");
  }
  const seen = new WeakSet<object>();
  function walk(value: unknown, depth: number): string | null {
    if (depth > LIMITS.maxDepth) return "max depth exceeded";
    if (Array.isArray(value)) {
      if (seen.has(value)) return "cycle";
      seen.add(value);
      for (const item of value) {
        const error = walk(item, depth + 1);
        if (error) return error;
      }
      return null;
    }
    if (!isRecord(value)) return null;
    if (seen.has(value)) return "cycle";
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (key.length > LIMITS.maxNameLength) return "name length exceeded";
      const error = walk(value[key], depth + 1);
      if (error) return error;
    }
    return null;
  }
  const error = walk(input, 1);
  if (error) return fail(error);
  return { ok: true };
}
