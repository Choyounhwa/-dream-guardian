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
  // Visual Document (UI-VIS-004)
  type VisualCommand,
  type VisualMoveElementsCommand,
  type VisualResizeElementCommand,
  type VisualSetPropCommand,
  type VisualSetGroupCommand,
  type VisualAlignElementsCommand,
  type VisualMoveElementItem,
  cloneVisualDocument,
  isVisualDocEqual,
  invertVisualCommand,
  applyVisualCommand,
} from "./UICommands";
import type {
  UIVisualDocument,
  UIVisualPageId,
  UIVisualElement,
  UIRect,
} from "./data/UIVisualDocument";

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

export function undo(session: EditorSession): EditorSession;
export function undo(session: VisualEditorSession): VisualEditorSession;
export function undo(session: EditorSession | VisualEditorSession): EditorSession | VisualEditorSession {
  if (isVisualSession(session)) {
    return undoVisual(session);
  }
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

export function redo(session: EditorSession): EditorSession;
export function redo(session: VisualEditorSession): VisualEditorSession;
export function redo(session: EditorSession | VisualEditorSession): EditorSession | VisualEditorSession {
  if (isVisualSession(session)) {
    return redoVisual(session);
  }
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

// ==========================================
// Visual Editor Session & State (Issue #434 / UI-VIS-004)
// ==========================================

export type VisualDragDraft = {
  elementIds: string[];
  initialBounds: Record<string, UIRect>;
  offset: { dx: number; dy: number };
};

export type VisualEditorSession = {
  sessionId: string;
  revision: number;
  dirty: boolean;
  present: UIVisualDocument;
  baseline: UIVisualDocument;
  draft: UIVisualDocument | null;
  dragDraft: VisualDragDraft | null;
  selectedElementIds: string[];
  activePageId: UIVisualPageId;
  undo: VisualCommand[];
  redo: VisualCommand[];
  historyCount: number;
  commandSerial: number;
};

export function isVisualSession(
  session: EditorSession | VisualEditorSession
): session is VisualEditorSession {
  return "activePageId" in session;
}

export function createVisualSession(
  doc: UIVisualDocument,
  initialPageId?: UIVisualPageId,
  sessionId?: string
): VisualEditorSession {
  const snapshot = cloneVisualDocument(doc);
  const activePageId = initialPageId ?? "menu_main";
  return {
    sessionId: sessionId ?? "visual-session",
    revision: 0,
    dirty: false,
    present: cloneVisualDocument(snapshot),
    baseline: snapshot,
    draft: null,
    dragDraft: null,
    selectedElementIds: [],
    activePageId,
    undo: [],
    redo: [],
    historyCount: 0,
    commandSerial: 0,
  };
}

export function selectVisualElements(
  session: VisualEditorSession,
  elementIds: string[]
): VisualEditorSession {
  const page = session.present.pages[session.activePageId];
  if (!page) return { ...session, selectedElementIds: [] };
  const validIds = new Set(page.elements.map((e) => e.id));
  const filtered = elementIds.filter((id) => validIds.has(id));
  return {
    ...session,
    selectedElementIds: filtered,
  };
}

export const setSelectedVisualElements = selectVisualElements;

export function switchVisualPage(
  session: VisualEditorSession,
  pageId: UIVisualPageId
): VisualEditorSession {
  const page = session.present.pages[pageId];
  if (!page) {
    throw new Error(`Page "${pageId}" not found`);
  }
  const validIds = new Set(page.elements.map((e) => e.id));
  const preservedSelection = session.selectedElementIds.filter((id) => validIds.has(id));
  return {
    ...session,
    activePageId: pageId,
    selectedElementIds: preservedSelection,
    draft: null,
    dragDraft: null,
  };
}

export const setActiveVisualPage = switchVisualPage;

function assertElementsUnlocked(
  session: VisualEditorSession,
  pageId: UIVisualPageId,
  elementIds: string[]
): void {
  const page = session.present.pages[pageId];
  if (!page) {
    throw new Error(`Page "${pageId}" not found`);
  }
  for (const id of elementIds) {
    const element = page.elements.find((e) => e.id === id);
    if (!element) {
      throw new Error(`Element "${id}" not found on page "${pageId}"`);
    }
    if (element.isLocked) {
      throw new Error(`Element "${id}" is locked: ${element.lockReason ?? "protected"}`);
    }
  }
}

export function executeVisualCommand(
  session: VisualEditorSession,
  command: VisualCommand
): VisualEditorSession {
  // Stale command check by docId/sessionId
  if (
    command.docId &&
    session.sessionId &&
    command.docId !== session.sessionId
  ) {
    throw new Error(
      `Stale command: docId mismatch ("${command.docId}" !== "${session.sessionId}")`
    );
  }

  const page = session.present.pages[command.pageId];
  if (!page) {
    throw new Error(`Page "${command.pageId}" not found`);
  }

  // Lock protection check
  switch (command.type) {
    case "move-elements":
    case "align-elements":
      assertElementsUnlocked(
        session,
        command.pageId,
        command.moves.map((m) => m.elementId)
      );
      break;
    case "resize-element":
      assertElementsUnlocked(session, command.pageId, [command.elementId]);
      break;
    case "set-element-prop": {
      const el = page.elements.find((e) => e.id === command.elementId);
      if (!el) {
        throw new Error(`Element "${command.elementId}" not found`);
      }
      if (el.isLocked && command.prop !== "isLocked" && command.prop !== "lockReason") {
        throw new Error(`Element "${command.elementId}" is locked`);
      }
      break;
    }
    case "set-element-group":
      assertElementsUnlocked(session, command.pageId, [command.elementId]);
      break;
  }

  const nextPresent = applyVisualCommand(session.present, command);
  if (isVisualDocEqual(nextPresent, session.present)) {
    return { ...session, draft: null, dragDraft: null };
  }

  const nextUndo = [...session.undo, command];
  while (nextUndo.length > HISTORY_LIMIT) {
    nextUndo.shift();
  }

  const nextDirty = !isVisualDocEqual(nextPresent, session.baseline);
  const validIds = new Set(
    nextPresent.pages[session.activePageId]?.elements.map((e) => e.id) ?? []
  );
  const validSelection = session.selectedElementIds.filter((id) => validIds.has(id));

  return {
    ...session,
    revision: session.revision + 1,
    dirty: nextDirty,
    present: nextPresent,
    draft: null,
    dragDraft: null,
    undo: nextUndo,
    redo: [],
    historyCount: nextUndo.length,
    commandSerial: session.commandSerial + 1,
    selectedElementIds: validSelection,
  };
}

export function beginVisualDrag(
  session: VisualEditorSession,
  elementIds?: string[]
): VisualEditorSession {
  const targetIds =
    elementIds && elementIds.length > 0 ? elementIds : session.selectedElementIds;
  if (targetIds.length === 0) return session;

  assertElementsUnlocked(session, session.activePageId, targetIds);

  const page = session.present.pages[session.activePageId];
  if (!page) {
    throw new Error(`Page "${session.activePageId}" not found`);
  }

  const initialBounds: Record<string, UIRect> = {};
  for (const id of targetIds) {
    const el = page.elements.find((e) => e.id === id);
    if (!el) {
      throw new Error(`Element "${id}" not found`);
    }
    initialBounds[id] = { ...el.bounds };
  }

  const draft = cloneVisualDocument(session.present);
  return {
    ...session,
    draft,
    dragDraft: {
      elementIds: [...targetIds],
      initialBounds,
      offset: { dx: 0, dy: 0 },
    },
  };
}

export function updateVisualDrag(
  session: VisualEditorSession,
  offset: { dx: number; dy: number }
): VisualEditorSession {
  if (!session.dragDraft || !session.draft) return session;

  const nextDraft = cloneVisualDocument(session.present);
  const targetPage = nextDraft.pages[session.activePageId];

  for (const id of session.dragDraft.elementIds) {
    const el = targetPage.elements.find((e) => e.id === id);
    const init = session.dragDraft.initialBounds[id];
    if (el && init) {
      el.bounds = {
        ...init,
        x: init.x + offset.dx,
        y: init.y + offset.dy,
      };
      if (el.hitBounds) {
        el.hitBounds = {
          ...el.hitBounds,
          x: el.hitBounds.x + offset.dx,
          y: el.hitBounds.y + offset.dy,
        };
      }
    }
  }

  return {
    ...session,
    draft: nextDraft,
    dragDraft: {
      ...session.dragDraft,
      offset: { dx: offset.dx, dy: offset.dy },
    },
  };
}

export function commitVisualDrag(session: VisualEditorSession): VisualEditorSession {
  if (!session.dragDraft || !session.draft) {
    throw new Error("no-draft");
  }

  if (session.dragDraft.offset.dx === 0 && session.dragDraft.offset.dy === 0) {
    return { ...session, draft: null, dragDraft: null };
  }

  const page = session.draft.pages[session.activePageId];
  const moves: VisualMoveElementItem[] = session.dragDraft.elementIds.map((id) => {
    const init = session.dragDraft!.initialBounds[id]!;
    const current = page.elements.find((e) => e.id === id)!;
    return {
      elementId: id,
      before: { ...init },
      after: { ...current.bounds },
    };
  });

  const command: VisualMoveElementsCommand = {
    id: `${session.sessionId}-${session.commandSerial + 1}`,
    type: "move-elements",
    pageId: session.activePageId,
    moves,
  };

  return executeVisualCommand(session, command);
}

export function cancelVisualDrag(session: VisualEditorSession): VisualEditorSession {
  return {
    ...session,
    draft: null,
    dragDraft: null,
  };
}

export function moveVisualElements(
  session: VisualEditorSession,
  elementIds: string[],
  offset: { dx: number; dy: number },
  pageId?: UIVisualPageId
): VisualEditorSession {
  const targetPageId = pageId ?? session.activePageId;
  if (offset.dx === 0 && offset.dy === 0) return session;
  if (elementIds.length === 0) return session;

  assertElementsUnlocked(session, targetPageId, elementIds);

  const page = session.present.pages[targetPageId];
  if (!page) throw new Error(`Page "${targetPageId}" not found`);

  const moves: VisualMoveElementItem[] = [];
  for (const id of elementIds) {
    const el = page.elements.find((e) => e.id === id);
    if (el) {
      moves.push({
        elementId: id,
        before: { ...el.bounds },
        after: {
          ...el.bounds,
          x: el.bounds.x + offset.dx,
          y: el.bounds.y + offset.dy,
        },
      });
    }
  }

  if (moves.length === 0) return session;

  const command: VisualMoveElementsCommand = {
    id: `${session.sessionId}-${session.commandSerial + 1}`,
    type: "move-elements",
    pageId: targetPageId,
    moves,
  };

  return executeVisualCommand(session, command);
}

export function moveSelectedElements(
  session: VisualEditorSession,
  offset: { dx: number; dy: number }
): VisualEditorSession {
  return moveVisualElements(session, session.selectedElementIds, offset, session.activePageId);
}

export function resizeVisualElement(
  session: VisualEditorSession,
  elementId: string,
  bounds: UIRect,
  pageId?: UIVisualPageId
): VisualEditorSession {
  const targetPageId = pageId ?? session.activePageId;
  assertElementsUnlocked(session, targetPageId, [elementId]);

  const page = session.present.pages[targetPageId];
  if (!page) throw new Error(`Page "${targetPageId}" not found`);

  const el = page.elements.find((e) => e.id === elementId);
  if (!el) throw new Error(`Element "${elementId}" not found`);

  if (
    el.bounds.x === bounds.x &&
    el.bounds.y === bounds.y &&
    el.bounds.width === bounds.width &&
    el.bounds.height === bounds.height
  ) {
    return session;
  }

  const command: VisualResizeElementCommand = {
    id: `${session.sessionId}-${session.commandSerial + 1}`,
    type: "resize-element",
    pageId: targetPageId,
    elementId,
    before: { ...el.bounds },
    after: { ...bounds },
  };

  return executeVisualCommand(session, command);
}

export function setVisualElementProp(
  session: VisualEditorSession,
  elementId: string,
  prop: keyof UIVisualElement,
  value: unknown,
  pageId?: UIVisualPageId
): VisualEditorSession {
  const targetPageId = pageId ?? session.activePageId;
  const page = session.present.pages[targetPageId];
  if (!page) throw new Error(`Page "${targetPageId}" not found`);

  const el = page.elements.find((e) => e.id === elementId);
  if (!el) throw new Error(`Element "${elementId}" not found`);

  if (el.isLocked && prop !== "isLocked" && prop !== "lockReason") {
    throw new Error(`Element "${elementId}" is locked`);
  }

  const elRecord = el as unknown as Record<string, unknown>;
  if (elRecord[prop] === value) {
    return session;
  }

  const command: VisualSetPropCommand = {
    id: `${session.sessionId}-${session.commandSerial + 1}`,
    type: "set-element-prop",
    pageId: targetPageId,
    elementId,
    prop,
    before: elRecord[prop],
    after: value,
  };

  return executeVisualCommand(session, command);
}

export function setVisualElementGroup(
  session: VisualEditorSession,
  elementId: string,
  groupId: string | undefined,
  pageId?: UIVisualPageId
): VisualEditorSession {
  const targetPageId = pageId ?? session.activePageId;
  assertElementsUnlocked(session, targetPageId, [elementId]);

  const page = session.present.pages[targetPageId];
  if (!page) throw new Error(`Page "${targetPageId}" not found`);

  const el = page.elements.find((e) => e.id === elementId);
  if (!el) throw new Error(`Element "${elementId}" not found`);

  if (el.groupId === groupId) {
    return session;
  }

  const command: VisualSetGroupCommand = {
    id: `${session.sessionId}-${session.commandSerial + 1}`,
    type: "set-element-group",
    pageId: targetPageId,
    elementId,
    beforeGroupId: el.groupId,
    afterGroupId: groupId,
  };

  return executeVisualCommand(session, command);
}

export function alignVisualElements(
  session: VisualEditorSession,
  alignment: "left" | "right" | "top" | "bottom" | "center-h" | "center-v",
  elementIds?: string[],
  pageId?: UIVisualPageId
): VisualEditorSession {
  const targetPageId = pageId ?? session.activePageId;
  const targetIds =
    elementIds && elementIds.length > 0 ? elementIds : session.selectedElementIds;

  if (targetIds.length < 2) return session;

  assertElementsUnlocked(session, targetPageId, targetIds);

  const page = session.present.pages[targetPageId];
  if (!page) throw new Error(`Page "${targetPageId}" not found`);

  const elements = targetIds
    .map((id) => page.elements.find((e) => e.id === id))
    .filter((e): e is UIVisualElement => e !== undefined);

  if (elements.length < 2) return session;

  const minX = Math.min(...elements.map((e) => e.bounds.x));
  const minY = Math.min(...elements.map((e) => e.bounds.y));
  const maxRight = Math.max(...elements.map((e) => e.bounds.x + e.bounds.width));
  const maxBottom = Math.max(...elements.map((e) => e.bounds.y + e.bounds.height));
  const centerX = (minX + maxRight) / 2;
  const centerY = (minY + maxBottom) / 2;

  const moves: VisualMoveElementItem[] = [];

  for (const el of elements) {
    let nextBounds = { ...el.bounds };
    switch (alignment) {
      case "left":
        nextBounds.x = minX;
        break;
      case "top":
        nextBounds.y = minY;
        break;
      case "right":
        nextBounds.x = maxRight - el.bounds.width;
        break;
      case "bottom":
        nextBounds.y = maxBottom - el.bounds.height;
        break;
      case "center-h":
        nextBounds.x = Math.round(centerX - el.bounds.width / 2);
        break;
      case "center-v":
        nextBounds.y = Math.round(centerY - el.bounds.height / 2);
        break;
    }

    if (nextBounds.x !== el.bounds.x || nextBounds.y !== el.bounds.y) {
      moves.push({
        elementId: el.id,
        before: { ...el.bounds },
        after: nextBounds,
      });
    }
  }

  if (moves.length === 0) return session;

  const command: VisualAlignElementsCommand = {
    id: `${session.sessionId}-${session.commandSerial + 1}`,
    type: "align-elements",
    pageId: targetPageId,
    alignment,
    moves,
  };

  return executeVisualCommand(session, command);
}

export function undoVisual(session: VisualEditorSession): VisualEditorSession {
  const command = session.undo[session.undo.length - 1];
  if (!command) return session;

  const inverted = invertVisualCommand(command);
  const present = applyVisualCommand(session.present, inverted);
  const nextUndo = session.undo.slice(0, -1);
  const nextRedo = [...session.redo, command];
  const dirty = !isVisualDocEqual(present, session.baseline);

  const validIds = new Set(
    present.pages[session.activePageId]?.elements.map((e) => e.id) ?? []
  );
  const validSelection = session.selectedElementIds.filter((id) => validIds.has(id));

  return {
    ...session,
    revision: session.revision + 1,
    dirty,
    present,
    draft: null,
    dragDraft: null,
    undo: nextUndo,
    redo: nextRedo,
    historyCount: nextUndo.length,
    selectedElementIds: validSelection,
  };
}

export function redoVisual(session: VisualEditorSession): VisualEditorSession {
  const command = session.redo[session.redo.length - 1];
  if (!command) return session;

  const present = applyVisualCommand(session.present, command);
  const nextUndo = [...session.undo, command];
  const nextRedo = session.redo.slice(0, -1);
  const dirty = !isVisualDocEqual(present, session.baseline);

  const validIds = new Set(
    present.pages[session.activePageId]?.elements.map((e) => e.id) ?? []
  );
  const validSelection = session.selectedElementIds.filter((id) => validIds.has(id));

  return {
    ...session,
    revision: session.revision + 1,
    dirty,
    present,
    draft: null,
    dragDraft: null,
    undo: nextUndo,
    redo: nextRedo,
    historyCount: nextUndo.length,
    selectedElementIds: validSelection,
  };
}

export function loadVisualDocument(
  session: VisualEditorSession,
  doc: UIVisualDocument,
  sessionId?: string,
  pageId?: UIVisualPageId
): VisualEditorSession {
  const snapshot = cloneVisualDocument(doc);
  const targetPageId =
    pageId ?? (snapshot.pages[session.activePageId] ? session.activePageId : "menu_main");
  return {
    sessionId: sessionId ?? session.sessionId,
    revision: session.revision + 1,
    dirty: false,
    present: cloneVisualDocument(snapshot),
    baseline: snapshot,
    draft: null,
    dragDraft: null,
    selectedElementIds: [],
    activePageId: targetPageId,
    undo: [],
    redo: [],
    historyCount: 0,
    commandSerial: 0,
  };
}

export function resetVisualSession(
  doc: UIVisualDocument,
  pageId?: UIVisualPageId,
  sessionId?: string
): VisualEditorSession {
  return createVisualSession(doc, pageId, sessionId);
}

