import { describe, expect, it } from "vitest";
import { MENU_CARD_IDS } from "../../src/editor/ui/data/UIContracts";
import {
  HISTORY_LIMIT,
  applyCommand,
  invertCommand,
} from "../../src/editor/ui/UICommands";
import {
  GAME_APPLY_VERIFIED,
  STORAGE_TOUCHED,
  acceptCommandRaw,
  beginDrag,
  cancelDrag,
  commitDrag,
  createSession,
  redo,
  replaceDocument,
  restoreDefaults,
  undo,
} from "../../src/editor/ui/UIEditorState";

type Card = { id: string; x: number; y: number };
type MenuDoc = {
  cards: Card[];
  width: number;
  height: number;
};

function baseline(): MenuDoc {
  return {
    cards: MENU_CARD_IDS.map((id, index) => ({ id, x: 40 + index * 10, y: 120 })),
    width: 280,
    height: 280,
  };
}

function cardPos(doc: MenuDoc, cardId: string): { x: number; y: number } {
  const card = doc.cards.find((item) => item.id === cardId);
  if (!card) throw new Error("missing card");
  return { x: card.x, y: card.y };
}

describe("UIX-009 document commands and undo history", () => {
  it("keeps one drag as a draft until commit, and cancel restores without a revision", () => {
    const source = baseline();
    const frozen = JSON.stringify(source);
    const session = createSession("doc-a", source);
    expect(session.revision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(session.draft).toBeNull();
    expect(session.historyCount).toBe(0);

    const dragging = beginDrag(session, "card-play", { x: 300, y: 400 });
    expect(dragging.revision).toBe(0);
    expect(dragging.undo).toHaveLength(0);
    expect(dragging.draft).not.toBeNull();
    expect(cardPos(dragging.present, "card-play")).toEqual({ x: 50, y: 120 });
    expect(cardPos(dragging.draft as MenuDoc, "card-play")).toEqual({ x: 300, y: 400 });

    const cancelled = cancelDrag(dragging);
    expect(cancelled.draft).toBeNull();
    expect(cancelled.revision).toBe(0);
    expect(cardPos(cancelled.present, "card-play")).toEqual({ x: 50, y: 120 });
    expect(JSON.stringify(source)).toBe(frozen);

    const committed = commitDrag(beginDrag(session, "card-play", { x: 300, y: 400 }));
    expect(committed.draft).toBeNull();
    expect(committed.revision).toBe(1);
    expect(committed.historyCount).toBe(1);
    expect(committed.undo).toHaveLength(1);
    expect(committed.undo[0]?.type).toBe("set-position");
    expect(cardPos(committed.present, "card-play")).toEqual({ x: 300, y: 400 });
    expect(committed.dirty).toBe(true);
    expect(JSON.stringify(source)).toBe(frozen);
  });

  it("treats undo and redo as new revisions and clears dirty by content, including restore-defaults", () => {
    const source = baseline();
    const session = createSession("doc-a", source);
    const moved = commitDrag(beginDrag(session, "card-story", { x: 12, y: 34 }));
    expect(moved.dirty).toBe(true);
    expect(moved.revision).toBe(1);

    const undone = undo(moved);
    expect(undone.revision).toBe(2);
    expect(undone.undo).toHaveLength(0);
    expect(undone.redo).toHaveLength(1);
    expect(cardPos(undone.present, "card-story")).toEqual({ x: 40, y: 120 });
    expect(undone.dirty).toBe(false);

    const redone = redo(undone);
    expect(redone.revision).toBe(3);
    expect(redone.undo).toHaveLength(1);
    expect(redone.redo).toHaveLength(0);
    expect(cardPos(redone.present, "card-story")).toEqual({ x: 12, y: 34 });
    expect(redone.dirty).toBe(true);

    const restored = restoreDefaults(redone, "card-story");
    expect(restored.revision).toBe(4);
    expect(restored.undo).toHaveLength(2);
    expect(restored.undo[1]?.type).toBe("restore-defaults");
    expect(cardPos(restored.present, "card-story")).toEqual({ x: 40, y: 120 });
    expect(restored.dirty).toBe(false);

    const command = restored.undo[1];
    if (!command) throw new Error("missing restore command");
    const applied = applyCommand(source, command, source);
    expect(cardPos(applied, "card-story")).toEqual(cardPos(source, "card-story"));
    const inverted = invertCommand(command);
    expect(inverted.type).toBe(command.type);
    expect(inverted.cardId).toBe(command.cardId);
    expect(JSON.stringify(source)).toBe(JSON.stringify(baseline()));
  });

  it("separates history on document replace and keeps only the latest 100 commands", () => {
    const source = baseline();
    let session = createSession("doc-a", source);
    for (let i = 0; i < 101; i += 1) {
      session = commitDrag(beginDrag(session, "card-records", { x: 80 + i, y: 200 }));
    }
    expect(session.historyCount).toBe(HISTORY_LIMIT);
    expect(session.undo).toHaveLength(100);
    expect(session.undo.some((command) => command.id.endsWith("-1"))).toBe(false);
    expect(session.undo[0]?.id.endsWith("-2")).toBe(true);
    expect(session.revision).toBe(101);

    const replaced = replaceDocument(session, "doc-b", baseline());
    expect(replaced.docId).toBe("doc-b");
    expect(replaced.docId).not.toBe(session.docId);
    expect(replaced.undo).toEqual([]);
    expect(replaced.redo).toEqual([]);
    expect(replaced.historyCount).toBe(0);
    expect(replaced.revision).toBe(0);
    expect(replaced.dirty).toBe(false);
    expect(session.undo).toHaveLength(100);
  });

  it("does not mutate the baseline and keeps game apply and storage unverified", () => {
    const source = baseline();
    Object.freeze(source);
    Object.freeze(source.cards);
    for (const card of source.cards) Object.freeze(card);
    const session = createSession("doc-a", source);
    const next = commitDrag(beginDrag(session, "card-credits", { x: 9, y: 9 }));
    expect(source.cards[4]?.x).toBe(80);
    expect(next.present).not.toBe(source);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(STORAGE_TOUCHED).toBe(false);

    const rejected = acceptCommandRaw(
      '{"id":"c1","type":"set-position","cardId":"card-play","before":{"x":1,"y":2,"extra":1},"after":{"x":3,"y":4}}',
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.code).toBe("unknown-field");

    const proto = acceptCommandRaw(
      '{"id":"c2","type":"set-position","cardId":"card-play","before":{"x":1,"y":2},"after":{"x":3,"y":4},"__proto__":{}}',
    );
    expect(proto.ok).toBe(false);

    const infinite = acceptCommandRaw(
      '{"id":"c3","type":"set-position","cardId":"card-play","before":{"x":1,"y":2},"after":{"x":null,"y":4}}',
    );
    expect(infinite.ok).toBe(false);

    const duplicate = acceptCommandRaw('{"id":"c4","id":"c5"}');
    expect(duplicate.ok).toBe(false);

    expect(HISTORY_LIMIT).toBe(100);
    expect(applyCommand).toBeTypeOf("function");
    expect(invertCommand).toBeTypeOf("function");
  });
});
