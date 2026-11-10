import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountPropertyForm } from "../../src/editor/ui/view/UIPropertyFormView";
import { mountShell } from "../../src/editor/ui/view/UIShellView";
import {
  createInMemoryIDBFactory,
  UIVisualIndexedDB,
} from "../../src/editor/ui/storage/UIVisualIndexedDB";
import { UIVisualStore } from "../../src/editor/ui/storage/UIVisualStore";
import {
  UIVisualProjectController,
  type TimeScheduler,
} from "../../src/editor/ui/UIVisualProjectController";
import {
  createDefaultUIVisualDocument,
  type UIVisualDocument,
} from "../../src/editor/ui/data/UIVisualDocument";
import type { VisualCommand } from "../../src/editor/ui/UICommands";

class MockDOMElement {
  public tagName: string;
  public className = "";
  public children: MockDOMElement[] = [];
  public parentNode: MockDOMElement | null = null;
  public textContent = "";
  public value = "";
  public disabled = false;
  public tabIndex = 0;
  public type = "";
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public listeners: Record<string, ((event: any) => void)[]> = {};
  public ownerDocument: any;

  constructor(tagName: string, doc: any) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = doc;
  }

  public setAttribute(name: string, val: any): void {
    const s = String(val);
    this.attributes[name] = s;
    if (name.startsWith("data-")) {
      const key = name.slice(5);
      this.dataset[key] = s;
    }
    if (name === "class") {
      this.className = s;
    }
  }

  public getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  public removeAttribute(name: string): void {
    delete this.attributes[name];
    if (name.startsWith("data-")) {
      const key = name.slice(5);
      delete this.dataset[key];
    }
    if (name === "class") {
      this.className = "";
    }
  }

  public appendChild(child: MockDOMElement): MockDOMElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  public removeChild(child: MockDOMElement): MockDOMElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  public remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  public addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  public removeEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  public dispatchEvent(event: any): boolean {
    event.target = this;
    event.currentTarget = this;
    const list = this.listeners[event.type] || [];
    for (const l of list) {
      l(event);
    }
    return true;
  }

  public click(): void {
    this.dispatchEvent({ type: "click", target: this, currentTarget: this });
  }

  public querySelector<T = MockDOMElement>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all.length > 0 ? all[0] : null;
  }

  public querySelectorAll<T = MockDOMElement>(selector: string): T[] {
    const matches: MockDOMElement[] = [];

    const check = (el: MockDOMElement): boolean => {
      let s = selector;
      if (s.includes("[") && !s.startsWith("[")) {
        const parts = s.split("[");
        if (el.tagName.toLowerCase() !== parts[0].toLowerCase()) {
          return false;
        }
        s = "[" + parts[1];
      }

      if (s.startsWith("#")) {
        return el.getAttribute("id") === s.slice(1);
      }
      if (s.startsWith(".")) {
        const targetClass = s.slice(1);
        return el.className.split(/\s+/).includes(targetClass);
      }
      if (s.startsWith("[") && s.endsWith("]")) {
        const inner = s.slice(1, -1);
        if (inner.includes("=")) {
          const [attr, val] = inner.split("=");
          const cleanVal = val.replace(/^["']|["']$/g, "");
          return el.getAttribute(attr) === cleanVal;
        }
        return el.attributes[inner] !== undefined;
      }
      return el.tagName.toLowerCase() === s.toLowerCase();
    };

    const traverse = (current: MockDOMElement) => {
      for (const child of current.children) {
        if (check(child)) {
          matches.push(child);
        }
        traverse(child);
      }
    };

    traverse(this);
    return matches as unknown as T[];
  }
}

class MockDocument {
  public body: MockDOMElement;
  constructor() {
    this.body = new MockDOMElement("BODY", this);
  }
  public createElement(tagName: string): MockDOMElement {
    return new MockDOMElement(tagName, this);
  }
  public querySelector(_selector: string): MockDOMElement | null {
    return null;
  }
}

class MockScheduler implements TimeScheduler {
  private currentTime = 1000;
  private timerIdSeq = 0;
  private timers = new Map<number, { due: number; fn: () => void }>();

  now(): number {
    return this.currentTime;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = ++this.timerIdSeq;
    this.timers.set(id, { due: this.currentTime + ms, fn });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  advanceBy(ms: number): void {
    this.currentTime += ms;
    const dueTimers = Array.from(this.timers.entries())
      .filter(([_, t]) => t.due <= this.currentTime)
      .sort((a, b) => a[1].due - b[1].due);

    for (const [id, t] of dueTimers) {
      if (this.timers.has(id)) {
        this.timers.delete(id);
        t.fn();
      }
    }
  }

  hasPending(): boolean {
    return this.timers.size > 0;
  }
}

describe("[BUG-UI-EDITOR-003 / Issue #550] UI 비주얼 에디터 속성 편집 시 세션 손상 (이중 커밋 방지 및 가드)", () => {
  let doc: MockDocument;
  let container: MockDOMElement;
  let testDoc: UIVisualDocument;
  let scheduler: MockScheduler;

  beforeEach(() => {
    doc = new MockDocument();
    container = doc.createElement("div");
    (globalThis as any).document = doc;
    testDoc = createDefaultUIVisualDocument();
    scheduler = new MockScheduler();
  });

  describe("1. UIPropertyFormView 이중 커밋 방지", () => {
    it("비주얼 문서 속성 커밋 시 onVisualCommit만 1회 호출되고 legacy onCommit은 호출되지 않아야 한다", () => {
      const onVisualCommitSpy = vi.fn();
      const onCommitSpy = vi.fn();

      const targetEl = testDoc.pages.menu_main.elements[0];
      expect(targetEl).toBeDefined();

      const form = mountPropertyForm(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        initialId: targetEl.id,
        onVisualCommit: onVisualCommitSpy,
        onCommit: onCommitSpy,
      });

      const xInput = form.root.querySelector('input[data-field="x"]') as unknown as MockDOMElement;
      expect(xInput).not.toBeNull();

      // Change x to a new value
      const newVal = targetEl.bounds.x + 50;
      xInput.value = String(newVal);
      xInput.dispatchEvent({ type: "input" });
      xInput.dispatchEvent({ type: "blur" });

      expect(onVisualCommitSpy).toHaveBeenCalledTimes(1);
      expect(onCommitSpy).not.toHaveBeenCalled();

      const cmd = onVisualCommitSpy.mock.calls[0][0] as VisualCommand;
      expect(cmd.type).toBe("resize-element");
      expect((cmd as any).after.x).toBe(newVal);
    });

    it("onVisualCommit이 제공되지 않은 경우 레거시 onCommit fallback이 정상 호출되어야 한다", () => {
      const onCommitSpy = vi.fn();

      const targetEl = testDoc.pages.menu_main.elements[0];
      const form = mountPropertyForm(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        initialId: targetEl.id,
        onCommit: onCommitSpy,
      });

      const xInput = form.root.querySelector('input[data-field="x"]') as unknown as MockDOMElement;
      expect(xInput).not.toBeNull();

      const newVal = targetEl.bounds.x + 30;
      xInput.value = String(newVal);
      xInput.dispatchEvent({ type: "input" });
      xInput.dispatchEvent({ type: "blur" });

      expect(onCommitSpy).toHaveBeenCalledTimes(1);
      expect(onCommitSpy.mock.calls[0][0].command.value).toBe(newVal);
    });
  });

  describe("2. UIVisualProjectController.edit session 방어 가드", () => {
    it("평문 UIVisualDocument 객체나 비세션 객체 전달 시 세션이 파괴되지 않고 불변이어야 한다", async () => {
      const factory = createInMemoryIDBFactory();
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-bug-550",
        scheduler,
      });

      const sessionBefore = ctrl.getSession();
      const docBefore = ctrl.getDocument();
      const revBefore = sessionBefore.revision;
      const dirtyBefore = ctrl.status().dirty;

      // 1) 평문 document 전달
      ctrl.edit(testDoc as any);
      expect(ctrl.getSession()).toBe(sessionBefore);
      expect(ctrl.getSession().revision).toBe(revBefore);
      expect(ctrl.status().dirty).toBe(dirtyBefore);
      expect(ctrl.getDocument()).toEqual(docBefore);

      // 2) 빈 객체 전달
      ctrl.edit({} as any);
      expect(ctrl.getSession()).toBe(sessionBefore);
      expect(ctrl.getDocument()).toEqual(docBefore);

      // 3) null / undefined 전달
      ctrl.edit(null as any);
      ctrl.edit(undefined as any);
      expect(ctrl.getSession()).toBe(sessionBefore);
      expect(ctrl.getDocument()).toEqual(docBefore);

      // 4) updater 함수가 유효하지 않은 세션(예: doc 또는 undefined)을 반환한 경우
      ctrl.edit((() => testDoc) as any);
      ctrl.edit((() => undefined) as any);
      expect(ctrl.getSession()).toBe(sessionBefore);
      expect(ctrl.getDocument()).toEqual(docBefore);

      // getDocument() 호출 시 cloneVisualDocument(undefined) 예외가 절대 발생하지 않아야 함
      expect(() => ctrl.getDocument()).not.toThrow();
    });
  });

  describe("3. UIShellView 속성 편집, 저장, Undo/Redo 통합 검증", () => {
    it("속성 편집 1회 시 세션이 손상되지 않고 Undo/Redo 및 Checkpoint 저장이 정상 동작해야 한다", async () => {
      const factory = createInMemoryIDBFactory();
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-shell-bug-550",
        scheduler,
      });

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
      });

      const initialRev = ctrl.getSession().revision;
      const targetEl = ctrl.getDocument().pages.menu_main.elements[0];
      const origX = targetEl.bounds.x;

      // 속성 폼의 x 좌표 입력 변경
      const xInput = shell.root.querySelector('input[data-field="x"]') as unknown as MockDOMElement;
      expect(xInput).not.toBeNull();

      const newX1 = origX + 40;
      xInput.value = String(newX1);
      xInput.dispatchEvent({ type: "input" });
      xInput.dispatchEvent({ type: "blur" });

      // 이중 커밋 없이 정확히 revision 1 증가
      expect(ctrl.getSession().revision).toBe(initialRev + 1);
      expect(ctrl.getDocument().pages.menu_main.elements[0].bounds.x).toBe(newX1);
      expect(ctrl.getSession().present).toBeDefined();

      // 2차 연속 편집
      const newX2 = origX + 80;
      xInput.value = String(newX2);
      xInput.dispatchEvent({ type: "input" });
      xInput.dispatchEvent({ type: "blur" });

      expect(ctrl.getSession().revision).toBe(initialRev + 2);
      expect(ctrl.getDocument().pages.menu_main.elements[0].bounds.x).toBe(newX2);

      // Undo 실행
      const undoBtn = shell.toolbar.querySelector('[data-action="Undo"]') as unknown as MockDOMElement;
      expect(undoBtn).not.toBeNull();
      undoBtn.click();

      // newX1로 복구됨
      expect(ctrl.getDocument().pages.menu_main.elements[0].bounds.x).toBe(newX1);

      // Redo 실행
      const redoBtn = shell.toolbar.querySelector('[data-action="Redo"]') as unknown as MockDOMElement;
      expect(redoBtn).not.toBeNull();
      redoBtn.click();

      // newX2로 재적용됨
      expect(ctrl.getDocument().pages.menu_main.elements[0].bounds.x).toBe(newX2);

      // 저장 (checkpoint) 수행 시 cloneVisualDocument(undefined) 예외 없이 성공해야 함
      const saveResult = await ctrl.saveCheckpoint();
      expect(saveResult.saved).toBe(true);
      expect(saveResult.status).toBe("saved");
      expect(ctrl.getDocument()).toBeDefined();

      shell.dispose();
    });

    it("연속 편집 후 800ms debounce draft 자동저장이 정상 수행되어야 한다", async () => {
      const factory = createInMemoryIDBFactory();
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-shell-autosave-550",
        scheduler,
      });

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
      });

      const targetEl = ctrl.getDocument().pages.menu_main.elements[0];
      const xInput = shell.root.querySelector('input[data-field="x"]') as unknown as MockDOMElement;
      expect(xInput).not.toBeNull();

      xInput.value = String(targetEl.bounds.x + 99);
      xInput.dispatchEvent({ type: "input" });
      xInput.dispatchEvent({ type: "blur" });

      // Autosave 타이머 진행
      expect(scheduler.hasPending()).toBe(true);
      scheduler.advanceBy(800);
      await new Promise((r) => setTimeout(r, 20));

      expect(ctrl.status().draftSaved).toBe(true);
      expect(ctrl.getDocument()).toBeDefined();

      shell.dispose();
    });
  });
});
