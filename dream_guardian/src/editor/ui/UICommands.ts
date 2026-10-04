import { LIMITS } from "./data/UIContracts";

export const HISTORY_LIMIT = 100;

export type Position = { x: number; y: number };

export type Command = {
  id: string;
  type: "set-position" | "restore-defaults";
  cardId: string;
  before: Position;
  after: Position;
};

export type CommandResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; reason: string };

const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
const COMMAND_KEYS = new Set(["id", "type", "cardId", "before", "after"]);
const POSITION_KEYS = new Set(["x", "y"]);

type MenuLike = {
  cards: { id: string; x: number; y: number }[];
  width: number;
  height: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function position(value: unknown): CommandResult<Position> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid-position", reason: "position" };
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (DANGEROUS.has(key)) return { ok: false, code: "dangerous-key", reason: key };
    if (!POSITION_KEYS.has(key)) return { ok: false, code: "unknown-field", reason: key };
  }
  if (!("x" in record) || !("y" in record)) {
    return { ok: false, code: "unknown-field", reason: "position" };
  }
  if (!isFiniteNumber(record.x) || !isFiniteNumber(record.y)) {
    return { ok: false, code: "non-finite", reason: "position" };
  }
  return { ok: true, value: { x: record.x, y: record.y } };
}

export function parseCommand(value: unknown): CommandResult<Command> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid-command", reason: "command must be an object" };
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (DANGEROUS.has(key)) {
      return { ok: false, code: "dangerous-key", reason: key };
    }
    if (!COMMAND_KEYS.has(key)) {
      return { ok: false, code: "unknown-field", reason: key };
    }
  }
  if (typeof record.id !== "string" || record.id.length === 0 || record.id.length > LIMITS.maxNameLength) {
    return { ok: false, code: "invalid-id", reason: "id" };
  }
  if (record.type !== "set-position" && record.type !== "restore-defaults") {
    return { ok: false, code: "unknown-field", reason: "type" };
  }
  if (typeof record.cardId !== "string" || record.cardId.length === 0 || record.cardId.length > LIMITS.maxNameLength) {
    return { ok: false, code: "invalid-card", reason: "cardId" };
  }
  const before = position(record.before);
  if (!before.ok) return before;
  const after = position(record.after);
  if (!after.ok) return after;
  return {
    ok: true,
    value: { id: record.id, type: record.type, cardId: record.cardId, before: before.value, after: after.value },
  };
}

function cloneDoc<T extends MenuLike>(doc: T): T {
  return {
    ...doc,
    cards: doc.cards.map((card) => ({ ...card })),
  };
}

function cardIndex(doc: MenuLike, cardId: string): number {
  return doc.cards.findIndex((card) => card.id === cardId);
}

export function applyCommand<T extends MenuLike>(doc: T, command: Command, baseline: MenuLike): T {
  const parsed = parseCommand(command);
  if (!parsed.ok) {
    throw new Error(parsed.code);
  }
  const next = cloneDoc(doc);
  const index = cardIndex(next, parsed.value.cardId);
  if (index < 0) {
    throw new Error("unknown-card");
  }
  const target = parsed.value.type === "restore-defaults"
    ? baselinePosition(baseline, parsed.value.cardId)
    : parsed.value.after;
  const card = next.cards[index];
  if (!card) throw new Error("unknown-card");
  next.cards[index] = { ...card, x: target.x, y: target.y };
  return next;
}

export function invertCommand(command: Command): Command {
  const parsed = parseCommand(command);
  if (!parsed.ok) {
    throw new Error(parsed.code);
  }
  return {
    id: `${parsed.value.id}:invert`,
    type: parsed.value.type,
    cardId: parsed.value.cardId,
    before: { ...parsed.value.after },
    after: { ...parsed.value.before },
  };
}

export function baselinePosition(baseline: MenuLike, cardId: string): Position {
  const card = baseline.cards.find((item) => item.id === cardId);
  if (!card || !isFiniteNumber(card.x) || !isFiniteNumber(card.y)) {
    throw new Error("unknown-card");
  }
  return { x: card.x, y: card.y };
}

export function sameContent(left: MenuLike, right: MenuLike): boolean {
  if (left.width !== right.width || left.height !== right.height) return false;
  if (left.cards.length !== right.cards.length) return false;
  return left.cards.every((card, index) => {
    const other = right.cards[index];
    return other?.id === card.id && other.x === card.x && other.y === card.y;
  });
}
