import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MENU_CARD_IDS } from "../../src/editor/ui/data/UIContracts";
import { PANEL_IDS } from "../../src/editor/ui/UIEditorShell";
import { mountShell } from "../../src/editor/ui/view/UIShellView";
import { start } from "../../src/editor/ui/main";

const rootDir = resolve(__dirname, "../..");

function readSource(rel: string): string {
  return readFileSync(resolve(rootDir, rel), "utf8");
}

class MockElement {
  tagName: string;
  children: MockElement[] = [];
  parentNode: MockElement | null = null;
  private _textContent: string = "";
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  className: string = "";
  id: string = "";
  tabIndex: number = -1;
  listeners: Record<string, ((event: any) => void)[]> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get textContent(): string {
    if (this.children.length > 0) {
      return this.children.map((c) => c.textContent).join("");
    }
    return this._textContent;
  }

  set textContent(val: string) {
    this._textContent = val;
    this.children = [];
  }

  get innerHTML(): string {
    throw new Error("innerHTML read/write is strictly forbidden");
  }
  set innerHTML(_val: string) {
    throw new Error("innerHTML read/write is strictly forbidden");
  }

  appendChild<T extends MockElement>(child: T): T {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild<T extends MockElement>(child: T): T {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = value;
    }
    if (name === "id") this.id = value;
    if (name === "class") this.className = value;
  }

  getAttribute(name: string): string | null {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.dataset[key] ?? this.attributes[name] ?? null;
    }
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[key];
    }
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  dispatchEvent(event: { type: string; [key: string]: any }): boolean {
    const list = (this.listeners[event.type] || []).slice();
    for (const l of list) {
      l(event);
    }
    return true;
  }

  click(): void {
    this.dispatchEvent({ type: "click", target: this });
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];
    const walk = (el: MockElement) => {
      for (const child of el.children) {
        if (matchesSelector(child, selector)) {
          matches.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return matches;
  }
}

function matchesSelector(el: MockElement, selector: string): boolean {
  selector = selector.trim();
  if (selector.startsWith("[") && selector.endsWith("]")) {
    const inside = selector.slice(1, -1);
    const eqIdx = inside.indexOf("=");
    if (eqIdx >= 0) {
      const key = inside.slice(0, eqIdx).trim();
      let val = inside.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return el.getAttribute(key) === val;
    }
    return el.hasAttribute(inside.trim());
  }
  if (selector.startsWith(".")) {
    const cls = selector.slice(1);
    return el.className.split(/\s+/).includes(cls);
  }
  return el.tagName.toLowerCase() === selector.toLowerCase();
}

function createMockDocument(root: MockElement) {
  const docListeners: Record<string, ((event: any) => void)[]> = {};
  return {
    createElement(tag: string) {
      return new MockElement(tag);
    },
    getElementById(id: string) {
      if (root.id === id) return root;
      return root.querySelector(`#${id}`) ?? null;
    },
    addEventListener(type: string, listener: (event: any) => void) {
      docListeners[type] = docListeners[type] || [];
      docListeners[type].push(listener);
    },
    removeEventListener(type: string, listener: (event: any) => void) {
      if (docListeners[type]) {
        docListeners[type] = docListeners[type].filter((l) => l !== listener);
      }
    },
    dispatchEvent(event: { type: string; [key: string]: any }) {
      const list = (docListeners[event.type] || []).slice();
      for (const l of list) {
        l(event);
      }
      return true;
    },
  };
}

describe("UIX-044 Editor Shell DOM and Three-Panel Layout Mount", () => {
  let appElement: MockElement;
  let originalDocument: any;
  let originalWindow: any;

  beforeEach(() => {
    appElement = new MockElement("div");
    appElement.id = "app";
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;

    const mockDoc = createMockDocument(appElement);
    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      addEventListener: mockDoc.addEventListener.bind(mockDoc),
      removeEventListener: mockDoc.removeEventListener.bind(mockDoc),
      dispatchEvent: mockDoc.dispatchEvent.bind(mockDoc),
    };
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it("prohibits innerHTML usage across shell view and main modules", () => {
    const viewSrc = readSource("src/editor/ui/view/UIShellView.ts");
    const mainSrc = readSource("src/editor/ui/main.ts");
    expect(viewSrc).not.toContain("innerHTML");
    expect(mainSrc).not.toContain("innerHTML");
  });

  it("prohibits game apply, publish, and test-run action buttons", () => {
    const viewSrc = readSource("src/editor/ui/view/UIShellView.ts");
    expect(viewSrc).not.toContain("게임 적용");
    expect(viewSrc).not.toContain("게시");
    expect(viewSrc).not.toContain("테스트 게임 실행");

    const instance = mountShell(appElement as unknown as HTMLElement);
    const buttons = appElement.querySelectorAll("button");
    const buttonTexts = buttons.map((b) => b.textContent);
    for (const txt of buttonTexts) {
      expect(txt).not.toMatch(/게임 적용|게시|테스트 게임 실행/);
    }
    instance.unmount();
  });

  it("mounts toolbar, elements list, preview, properties, and status panels into #app", () => {
    expect(appElement.children.length).toBe(0);

    const instance = mountShell(appElement as unknown as HTMLElement);
    expect(appElement.children.length).toBeGreaterThan(0);

    const toolbar = appElement.querySelector('[data-panel="toolbar"]');
    expect(toolbar).not.toBeNull();

    const elementsPanel = appElement.querySelector('[data-panel="elements"]');
    expect(elementsPanel).not.toBeNull();

    const previewPanel = appElement.querySelector('[data-panel="preview"]');
    expect(previewPanel).not.toBeNull();

    const propertiesPanel = appElement.querySelector('[data-panel="properties"]');
    expect(propertiesPanel).not.toBeNull();

    const statusPanel = appElement.querySelector('[data-panel="status"]');
    expect(statusPanel).not.toBeNull();

    const elementItems = appElement.querySelectorAll("[data-element-id]");
    expect(elementItems.length).toBe(MENU_CARD_IDS.length);
    const ids = elementItems.map((el) => el.getAttribute("data-element-id"));
    expect(ids).toEqual([...MENU_CARD_IDS]);

    expect(statusPanel?.textContent).toContain("게임에는 반영되지 않음");

    instance.unmount();
  });

  it("reflects selection changes via keyboard arrow keys", () => {
    const instance = mountShell(appElement as unknown as HTMLElement);
    expect(instance.getState().selectedIndex).toBe(0);
    expect(instance.getState().selectedId).toBe(MENU_CARD_IDS[0]);

    const item0 = appElement.querySelector(`[data-element-id="${MENU_CARD_IDS[0]}"]`);
    expect(item0?.getAttribute("data-selected")).toBe("true");

    (globalThis as any).window.dispatchEvent({ type: "keydown", key: "ArrowDown" });
    expect(instance.getState().selectedIndex).toBe(1);
    expect(instance.getState().selectedId).toBe(MENU_CARD_IDS[1]);

    const item1 = appElement.querySelector(`[data-element-id="${MENU_CARD_IDS[1]}"]`);
    expect(item1?.getAttribute("data-selected")).toBe("true");
    expect(item0?.getAttribute("data-selected")).toBe("false");

    (globalThis as any).window.dispatchEvent({ type: "keydown", key: "ArrowUp" });
    expect(instance.getState().selectedIndex).toBe(0);
    expect(instance.getState().selectedId).toBe(MENU_CARD_IDS[0]);

    (globalThis as any).window.dispatchEvent({ type: "keydown", key: "ArrowLeft" });
    expect(instance.getState().selectedIndex).toBe(MENU_CARD_IDS.length - 1);
    expect(instance.getState().selectedId).toBe(MENU_CARD_IDS[MENU_CARD_IDS.length - 1]);

    instance.unmount();
  });

  it("reflects selection change when an element card item is clicked", () => {
    const instance = mountShell(appElement as unknown as HTMLElement);
    const targetId = MENU_CARD_IDS[2];
    const targetItem = appElement.querySelector(`[data-element-id="${targetId}"]`);
    expect(targetItem).not.toBeNull();

    targetItem?.click();
    expect(instance.getState().selectedIndex).toBe(2);
    expect(instance.getState().selectedId).toBe(targetId);
    expect(targetItem?.getAttribute("data-selected")).toBe("true");

    const statusPanel = appElement.querySelector('[data-panel="status"]');
    expect(statusPanel?.textContent).toContain(targetId);

    instance.unmount();
  });

  it("cleans up mounted DOM nodes and listeners upon unmount", () => {
    const instance = mountShell(appElement as unknown as HTMLElement);
    expect(appElement.children.length).toBeGreaterThan(0);

    instance.unmount();
    expect(appElement.children.length).toBe(0);

    const prevIndex = instance.getState().selectedIndex;
    (globalThis as any).window.dispatchEvent({ type: "keydown", key: "ArrowDown" });
    expect(instance.getState().selectedIndex).toBe(prevIndex);
  });

  it("integrates with start() in main.ts and mounts into #app", () => {
    const started = start(appElement as unknown as HTMLElement);
    expect(started.panels).toEqual(PANEL_IDS);
    expect(started.loadsGameMain).toBe(false);
    expect(started.gameApplyVerified).toBe(false);
    expect(appElement.children.length).toBeGreaterThan(0);

    started.unmount?.();
    expect(appElement.children.length).toBe(0);
  });
});
