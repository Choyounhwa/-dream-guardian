import { KINDS, LIMITS, SCHEMA_VERSION } from "./UIContracts";
import { artifactHash, contentHash, rejectDuplicateKeys, sourceCheckpointHash } from "./UICanonicalJSON";
import { BASELINE_REGISTRY, clonePresetForEdit } from "./UIBaselines";
import { OUT_OF_SCOPE_MEANS_RESTORE, validateProject, validateTransfer } from "./UIValidator";

export const GAME_APPLY_VERIFIED = false;

type Meta = { scope: string; sourceId: string; exportId: string };
type BuildResult = { ok: true; transfer: object } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function completeMenu(menu: unknown): Record<string, unknown> | null {
  if (!isRecord(menu)) return null;
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  const cards = Array.isArray(menu.cards) ? menu.cards : preset.cards;
  return {
    cards: cards.map((card, index) => {
      const base = preset.cards[index];
      const current = isRecord(card) ? card : {};
      return {
        id: typeof current.id === "string" ? current.id : base.id,
        x: typeof current.x === "number" ? current.x : base.x,
        y: typeof current.y === "number" ? current.y : base.y,
      };
    }),
    width: typeof menu.width === "number" ? menu.width : preset.width,
    height: typeof menu.height === "number" ? menu.height : preset.height,
    workoutButton: isRecord(menu.workoutButton)
      ? {
          x: typeof menu.workoutButton.x === "number" ? menu.workoutButton.x : preset.workoutButton.x,
          y: typeof menu.workoutButton.y === "number" ? menu.workoutButton.y : preset.workoutButton.y,
          width: typeof menu.workoutButton.width === "number" ? menu.workoutButton.width : preset.workoutButton.width,
          height: typeof menu.workoutButton.height === "number" ? menu.workoutButton.height : preset.workoutButton.height,
        }
      : copy(preset.workoutButton),
  };
}

function envelope(checkpoint: Record<string, unknown>, content: object, meta: Meta) {
  const checkpointHash = sourceCheckpointHash(checkpoint);
  const body: Record<string, unknown> = {
    kind: KINDS.transfer,
    schemaVersion: SCHEMA_VERSION,
    design: copy(checkpoint.design),
    scope: meta.scope,
    content,
    baseline: copy(checkpoint.baseline),
    sourceCheckpointHash: checkpointHash,
    sourceComparison: "not-performed",
  };
  body.contentHash = contentHash(content);
  body.omissionMeansRestore = OUT_OF_SCOPE_MEANS_RESTORE;
  body.provenance = {
    sourceId: meta.sourceId,
    exportId: meta.exportId,
    sourceCheckpointHash: checkpointHash,
  };
  body.integrity = { artifactHash: artifactHash(body) };
  return body;
}

export function buildTransfer(input: {
  checkpoint: unknown;
  scope: string;
  sourceId: string;
  exportId: string;
}): BuildResult {
  const snapshot = copy(input.checkpoint);
  if (!isRecord(snapshot) || input.scope !== "menu") return { ok: false, reason: "unsupported-scope" };
  const content = completeMenu(snapshot.menu);
  if (!content) return { ok: false, reason: "incomplete-scope" };
  snapshot.menu = content;
  const checked = validateProject(snapshot);
  if (!checked.ok) return { ok: false, reason: checked.errors[0]?.code ?? "invalid-checkpoint" };
  const transfer = envelope(snapshot, content, input);
  const accepted = validateTransfer({
    kind: transfer.kind,
    schemaVersion: transfer.schemaVersion,
    design: transfer.design,
    scope: transfer.scope,
    content: transfer.content,
    baseline: transfer.baseline,
    contentHash: transfer.contentHash,
    artifactHash: (transfer.integrity as { artifactHash: string }).artifactHash,
    sourceCheckpointHash: transfer.sourceCheckpointHash,
    sourceComparison: transfer.sourceComparison,
  });
  if (!accepted.ok) return { ok: false, reason: accepted.errors[0]?.code ?? "invalid-transfer" };
  return { ok: true, transfer };
}

export function buildTransferFromRaw(raw: string, meta: Meta): BuildResult {
  if (typeof raw !== "string") return { ok: false, reason: "invalid-raw" };
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) return { ok: false, reason: "max bytes exceeded" };
  if (raw.length > LIMITS.maxNameLength && !raw.trim().startsWith("{") && !raw.trim().startsWith("[")) {
    return { ok: false, reason: "max name length exceeded" };
  }
  const duplicates = rejectDuplicateKeys(raw);
  if (!duplicates.ok) return { ok: false, reason: duplicates.reason ?? "duplicate-key" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  return buildTransfer({ checkpoint: parsed, ...meta });
}
