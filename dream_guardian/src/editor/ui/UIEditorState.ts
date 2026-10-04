import { LIMITS } from "./data/UIContracts";
import { rejectDuplicateKeys } from "./data/UICanonicalJSON";
import {
  HISTORY_LIMIT,
  applyCommand,
  baselinePosition,
  invertCommand,
  parseCommand,
  sameContent,
  type Command,
  type Position,
} from "./UICommands";

export const GAME_APPLY_VERIFIED = false;
export const STORAGE_TOUCHED = false;

export type MenuDoc = {
  cards: { id: string; x: number; y: number }[];
  width: number;
  height: number;
};

export type EditorSession = {
  docId: string;
  revision: number;
  dirty: boolean;
  present: MenuDoc;
  baseline: MenuDoc;
  draft: MenuDoc | null;
  undo: Command[];
  redo: Command[];
  historyCount: number;
  commandSerial: number;
};

function cloneDoc(doc: MenuDoc): MenuDoc {
  return {
    width: doc.width,
    height: doc.height,
    cards: doc.cards.map((card) => ({ id: card.id, x: card.x, y: card.y })),
  };
}

function withDirty(session: EditorSession, present: MenuDoc): EditorSession {
  return {
    ...session,
    present,
    dirty: !sameContent(present, session.baseline),
  };
}

export function createSession(docId: string, baseline: MenuDoc): EditorSession {
  const snapshot = cloneDoc(baseline);
  return {
    docId,
    revision: 0,
    dirty: false,
    present: cloneDoc(snapshot),
    baseline: snapshot,
    draft: null,
    undo: [],
    redo: [],
    historyCount: 0,
    commandSerial: 0,
  };
}

export function beginDrag(session: EditorSession, cardId: string, nextPos: Position): EditorSession {
  if (!Number.isFinite(nextPos.x) || !Number.isFinite(nextPos.y)) {
    throw new Error("non-finite");
  }
  const draft = cloneDoc(session.present);
  const index = draft.cards.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error("unknown-card");
  const card = draft.cards[index];
  if (!card) throw new Error("unknown-card");
  draft.cards[index] = { ...card, x: nextPos.x, y: nextPos.y };
  return { ...session, draft };
}

export function cancelDrag(session: EditorSession): EditorSession {
  return { ...session, draft: null };
}

function pushHistory(session: EditorSession, command: Command, present: MenuDoc): EditorSession {
  const undo = [...session.undo, command];
  while (undo.length > HISTORY_LIMIT) undo.shift();
  return withDirty(
    {
      ...session,
      revision: session.revision + 1,
      draft: null,
      undo,
      redo: [],
      historyCount: undo.length,
      commandSerial: session.commandSerial + 1,
    },
    present,
  );
}

export function commitDrag(session: EditorSession): EditorSession {
  if (!session.draft) throw new Error("no-draft");
  const changed = session.draft.cards.find((card, index) => {
    const current = session.present.cards[index];
    return current && (current.x !== card.x || current.y !== card.y);
  });
  if (!changed) return { ...session, draft: null };
  const current = session.present.cards.find((card) => card.id === changed.id);
  if (!current) throw new Error("unknown-card");
  const command: Command = {
    id: `${session.docId}-${session.commandSerial + 1}`,
    type: "set-position",
    cardId: changed.id,
    before: { x: current.x, y: current.y },
    after: { x: changed.x, y: changed.y },
  };
  return pushHistory(session, command, cloneDoc(session.draft));
}

export function undo(session: EditorSession): EditorSession {
  const command = session.undo[session.undo.length - 1];
  if (!command) return session;
  const present = applyCommand(session.present, invertCommand(command), session.baseline);
  return withDirty(
    {
      ...session,
      revision: session.revision + 1,
      draft: null,
      undo: session.undo.slice(0, -1),
      redo: [...session.redo, command],
      historyCount: session.undo.length - 1,
    },
    present,
  );
}

export function redo(session: EditorSession): EditorSession {
  const command = session.redo[session.redo.length - 1];
  if (!command) return session;
  const present = applyCommand(session.present, command, session.baseline);
  const undo = [...session.undo, command];
  return withDirty(
    {
      ...session,
      revision: session.revision + 1,
      draft: null,
      undo,
      redo: session.redo.slice(0, -1),
      historyCount: undo.length,
    },
    present,
  );
}

export function restoreDefaults(session: EditorSession, cardId: string): EditorSession {
  const current = session.present.cards.find((card) => card.id === cardId);
  if (!current) throw new Error("unknown-card");
  const base = baselinePosition(session.baseline, cardId);
  if (current.x === base.x && current.y === base.y) {
    return { ...session, draft: null };
  }
  const command: Command = {
    id: `${session.docId}-${session.commandSerial + 1}`,
    type: "restore-defaults",
    cardId,
    before: { x: current.x, y: current.y },
    after: { x: base.x, y: base.y },
  };
  const present = applyCommand(session.present, command, session.baseline);
  return pushHistory(session, command, present);
}

export function replaceDocument(session: EditorSession, otherDocId: string, content: MenuDoc): EditorSession {
  void session;
  return createSession(otherDocId, content);
}

function depthOf(value: unknown, depth: number): number {
  if (value === null || typeof value !== "object") return depth;
  if (depth > LIMITS.maxDepth) return depth;
  const nested = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return nested.reduce((max, item) => Math.max(max, depthOf(item, depth + 1)), depth);
}

function hasDangerous(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const keys = Array.isArray(value) ? [] : Object.keys(value as object);
  if (keys.some((key) => key === "__proto__" || key === "constructor" || key === "prototype")) return true;
  const nested = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return nested.some((item) => hasDangerous(item));
}

export function acceptCommandRaw(raw: string): { ok: boolean; code?: string; reason?: string; command?: Command } {
  if (raw.length > LIMITS.maxBytes) {
    return { ok: false, code: "too-large", reason: "size" };
  }
  const duplicate = rejectDuplicateKeys(raw);
  if (!duplicate.ok) {
    return { ok: false, code: "duplicate-key", reason: duplicate.reason ?? "duplicate-key" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid-json", reason: "json" };
  }
  if (hasDangerous(parsed)) {
    return { ok: false, code: "dangerous-key", reason: "dangerous-key" };
  }
  if (depthOf(parsed, 1) > LIMITS.maxDepth) {
    return { ok: false, code: "too-deep", reason: "depth" };
  }
  const command = parseCommand(parsed);
  if (!command.ok) return command;
  if (command.value.id.length > LIMITS.maxNameLength || command.value.cardId.length > LIMITS.maxNameLength) {
    return { ok: false, code: "name-too-long", reason: "name" };
  }
  return { ok: true, command: command.value };
}
