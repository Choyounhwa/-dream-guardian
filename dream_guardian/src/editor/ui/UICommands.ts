import { LIMITS } from "./data/UIContracts";
import { canonicalize } from "./data/UICanonicalJSON";
import type {
  UIVisualDocument,
  UIVisualPageId,
  UIVisualElement,
  UIRect,
} from "./data/UIVisualDocument";

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

// ==========================================
// Visual Document Commands (Issue #434 / UI-VIS-004)
// ==========================================

export type VisualMoveElementItem = {
  elementId: string;
  before: UIRect;
  after: UIRect;
  beforeHitBounds?: UIRect;
  afterHitBounds?: UIRect;
};

export type VisualMoveElementsCommand = {
  id: string;
  docId?: string;
  type: "move-elements";
  pageId: UIVisualPageId;
  moves: VisualMoveElementItem[];
};

export type VisualResizeElementCommand = {
  id: string;
  docId?: string;
  type: "resize-element";
  pageId: UIVisualPageId;
  elementId: string;
  before: UIRect;
  after: UIRect;
};

export type VisualSetPropCommand = {
  id: string;
  docId?: string;
  type: "set-element-prop";
  pageId: UIVisualPageId;
  elementId: string;
  prop: keyof UIVisualElement;
  before: unknown;
  after: unknown;
};

export type VisualSetGroupCommand = {
  id: string;
  docId?: string;
  type: "set-element-group";
  pageId: UIVisualPageId;
  elementId: string;
  beforeGroupId?: string;
  afterGroupId?: string;
};

export type VisualAlignElementsCommand = {
  id: string;
  docId?: string;
  type: "align-elements";
  pageId: UIVisualPageId;
  alignment: "left" | "right" | "top" | "bottom" | "center-h" | "center-v";
  moves: VisualMoveElementItem[];
};

export type VisualCommand =
  | VisualMoveElementsCommand
  | VisualResizeElementCommand
  | VisualSetPropCommand
  | VisualSetGroupCommand
  | VisualAlignElementsCommand;

export function cloneVisualDocument(doc: UIVisualDocument): UIVisualDocument {
  return JSON.parse(JSON.stringify(doc)) as UIVisualDocument;
}

export function isVisualDocEqual(a: UIVisualDocument, b: UIVisualDocument): boolean {
  const canA = canonicalize(a);
  const canB = canonicalize(b);
  if (canA.ok && canB.ok) {
    return canA.json === canB.json;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export function invertVisualCommand(command: VisualCommand): VisualCommand {
  switch (command.type) {
    case "move-elements":
      return {
        ...command,
        moves: command.moves.map((m) => ({
          elementId: m.elementId,
          before: { ...m.after },
          after: { ...m.before },
          beforeHitBounds: m.afterHitBounds ? { ...m.afterHitBounds } : undefined,
          afterHitBounds: m.beforeHitBounds ? { ...m.beforeHitBounds } : undefined,
        })),
      };
    case "resize-element":
      return {
        ...command,
        before: { ...command.after },
        after: { ...command.before },
      };
    case "set-element-prop":
      return {
        ...command,
        before: command.after,
        after: command.before,
      };
    case "set-element-group":
      return {
        ...command,
        beforeGroupId: command.afterGroupId,
        afterGroupId: command.beforeGroupId,
      };
    case "align-elements":
      return {
        ...command,
        moves: command.moves.map((m) => ({
          elementId: m.elementId,
          before: { ...m.after },
          after: { ...m.before },
          beforeHitBounds: m.afterHitBounds ? { ...m.afterHitBounds } : undefined,
          afterHitBounds: m.beforeHitBounds ? { ...m.beforeHitBounds } : undefined,
        })),
      };
  }
}

export function applyVisualCommand(
  doc: UIVisualDocument,
  command: VisualCommand
): UIVisualDocument {
  const page = doc.pages[command.pageId];
  if (!page) {
    throw new Error(`Page "${command.pageId}" not found`);
  }

  const nextDoc = cloneVisualDocument(doc);
  const targetPage = nextDoc.pages[command.pageId];

  switch (command.type) {
    case "move-elements":
    case "align-elements": {
      for (const move of command.moves) {
        const element = targetPage.elements.find((e) => e.id === move.elementId);
        if (!element) {
          throw new Error(`Element "${move.elementId}" not found in page "${command.pageId}"`);
        }
        element.bounds = { ...move.after };
        if (move.afterHitBounds !== undefined) {
          element.hitBounds = { ...move.afterHitBounds };
        } else if (element.hitBounds) {
          const dx = move.after.x - move.before.x;
          const dy = move.after.y - move.before.y;
          element.hitBounds = {
            ...element.hitBounds,
            x: element.hitBounds.x + dx,
            y: element.hitBounds.y + dy,
          };
        }
      }
      break;
    }
    case "resize-element": {
      const element = targetPage.elements.find((e) => e.id === command.elementId);
      if (!element) {
        throw new Error(`Element "${command.elementId}" not found in page "${command.pageId}"`);
      }
      element.bounds = { ...command.after };
      break;
    }
    case "set-element-prop": {
      const element = targetPage.elements.find((e) => e.id === command.elementId);
      if (!element) {
        throw new Error(`Element "${command.elementId}" not found in page "${command.pageId}"`);
      }
      const record = element as unknown as Record<string, unknown>;
      if (command.after === undefined) {
        delete record[command.prop];
      } else {
        record[command.prop] = command.after;
      }
      break;
    }
    case "set-element-group": {
      const element = targetPage.elements.find((e) => e.id === command.elementId);
      if (!element) {
        throw new Error(`Element "${command.elementId}" not found in page "${command.pageId}"`);
      }
      if (command.afterGroupId === undefined) {
        delete element.groupId;
      } else {
        element.groupId = command.afterGroupId;
      }
      break;
    }
  }

  return nextDoc;
}

export function parseVisualCommand(value: unknown): CommandResult<VisualCommand> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid-command", reason: "command" };
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) {
    return { ok: false, code: "missing-id", reason: "id" };
  }
  if (typeof record.type !== "string" || !record.type) {
    return { ok: false, code: "missing-type", reason: "type" };
  }
  if (typeof record.pageId !== "string" || !record.pageId) {
    return { ok: false, code: "missing-pageId", reason: "pageId" };
  }
  const validTypes = new Set([
    "move-elements",
    "resize-element",
    "set-element-prop",
    "set-element-group",
    "align-elements",
  ]);
  if (!validTypes.has(record.type)) {
    return { ok: false, code: "unknown-type", reason: record.type };
  }
  return { ok: true, value: value as VisualCommand };
}

