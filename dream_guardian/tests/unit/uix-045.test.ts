import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASELINE_REGISTRY } from "../../src/editor/ui/data/UIBaselines";
import {
  GAME_APPLY_VERIFIED,
  STORAGE_TOUCHED,
} from "../../src/editor/ui/UIPropertyPanel";
import { mountPropertyForm } from "../../src/editor/ui/view/UIPropertyFormView";
import { mountShell } from "../../src/editor/ui/view/UIShellView";

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
  value: string = "";
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
    if (name === "value") this.value = value;
  }

  getAttribute(name: string): string | null {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.dataset[key] ?? this.attributes[name] ?? null;
    }
    if (name === "value") return this.value;
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
  const bracketIdx = selector.indexOf("[");
  if (bracketIdx > 0 && selector.endsWith("]")) {
    const tagPart = selector.slice(0, bracketIdx);
    const attrPart = selector.slice(bracketIdx);
    return matchesSelector(el, tagPart) && matchesSelector(el, attrPart);
  }
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

describe("UIX-045 Property Form DOM & PropertyPanel Integration", () => {
  let container: MockElement;
  let originalDocument: any;
  let originalWindow: any;

  beforeEach(() => {
    container = new MockElement("div");
    container.id = "app";
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;
    const mockDoc = createMockDocument(container);
    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      addEventListener: mockDoc.addEventListener,
      removeEventListener: mockDoc.removeEventListener,
      dispatchEvent: mockDoc.dispatchEvent,
    };
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it("mounts inputs for x, y, width, height with labels, ids, aria-labels, and data-error areas", () => {
    const instance = mountPropertyForm(container as unknown as HTMLElement, {
      initialId: "card-play",
    });

    const form = container.querySelector('[data-view="property-form"]');
    expect(form).not.toBeNull();

    for (const field of ["x", "y", "width", "height"] as const) {
      const input = container.querySelector(`input[data-field="${field}"]`);
      expect(input).not.toBeNull();
      expect(input?.getAttribute("type")).toBe("number");
      expect(input?.id).toBe(`prop-input-${field}`);
      expect(input?.getAttribute("aria-label")).toBeTruthy();

      const label = container.querySelector(`label[for="prop-input-${field}"]`);
      expect(label).not.toBeNull();

      const errorArea = container.querySelector(`[data-error="${field}"]`);
      expect(errorArea).not.toBeNull();
      expect(errorArea?.id).toBe(`err-${field}`);
    }

    instance.unmount();
    expect(container.children.length).toBe(0);
  });

  it("updates input values when setSelectedId is called", () => {
    const instance = mountPropertyForm(container as unknown as HTMLElement, {
      initialId: "card-play",
    });

    const inputX = container.querySelector('input[data-field="x"]');
    const inputY = container.querySelector('input[data-field="y"]');
    const initialPreset = BASELINE_REGISTRY.preset;
    const playCard = initialPreset.cards.find((c) => c.id === "card-play")!;
    expect(inputX?.value).toBe(String(playCard.x));
    expect(inputY?.value).toBe(String(playCard.y));

    // Change to card-records
    instance.setSelectedId("card-records");
    const recordsCard = initialPreset.cards.find((c) => c.id === "card-records")!;
    expect(inputX?.value).toBe(String(recordsCard.x));
    expect(inputY?.value).toBe(String(recordsCard.y));

    // Change to workout-button
    instance.setSelectedId("workout-button");
    expect(inputX?.value).toBe(String(initialPreset.workoutButton.x));
    expect(inputY?.value).toBe(String(initialPreset.workoutButton.y));

    instance.unmount();
  });

  it("displays error message and prevents command emission on invalid input", () => {
    const onCommit = vi.fn();
    const instance = mountPropertyForm(container as unknown as HTMLElement, {
      initialId: "card-play",
      onCommit,
    });

    const inputX = container.querySelector('input[data-field="x"]');
    const errorX = container.querySelector('[data-error="x"]');
    expect(errorX?.textContent).toBe("");

    // Simulate typing invalid number "abc"
    inputX!.value = "abc";
    inputX?.dispatchEvent({ type: "input", target: inputX });

    expect(errorX?.textContent).toContain("invalid");
    expect(inputX?.getAttribute("aria-invalid")).toBe("true");

    // Commit attempt via Enter
    inputX?.dispatchEvent({ type: "keydown", key: "Enter", target: inputX });
    expect(onCommit).not.toHaveBeenCalled();

    // Commit attempt via blur
    inputX?.dispatchEvent({ type: "blur", target: inputX });
    expect(onCommit).not.toHaveBeenCalled();

    instance.unmount();
  });

  it("commits valid input on enter/blur and notifies onCommit with affectedIds", () => {
    const onCommit = vi.fn();
    const instance = mountPropertyForm(container as unknown as HTMLElement, {
      initialId: "card-play",
      onCommit,
    });

    const inputX = container.querySelector('input[data-field="x"]');
    const errorX = container.querySelector('[data-error="x"]');

    // Type valid number
    inputX!.value = "88";
    inputX?.dispatchEvent({ type: "input", target: inputX });

    expect(errorX?.textContent).toBe("");
    expect(inputX?.getAttribute("aria-invalid")).toBe("false");

    // Press Enter to commit
    inputX?.dispatchEvent({ type: "keydown", key: "Enter", target: inputX });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const result = onCommit.mock.calls[0][0];
    expect(result.command).toMatchObject({
      field: "x",
      value: 88,
      target: "card-play",
    });
    expect(result.affectedIds).toEqual(["card-play"]);

    instance.unmount();
  });

  it("displays common scope text for width and height on menu cards, but not on workout-button", () => {
    const instance = mountPropertyForm(container as unknown as HTMLElement, {
      initialId: "card-play",
    });

    const scopeWidth = container.querySelector('[data-scope="width"]');
    const scopeHeight = container.querySelector('[data-scope="height"]');
    const scopeX = container.querySelector('[data-scope="x"]');

    // Menu cards share width and height across all 5 cards
    expect(scopeWidth?.textContent).toContain("공통 적용");
    expect(scopeHeight?.textContent).toContain("공통 적용");
    expect(scopeX?.textContent).toBe("");

    // Switching to workout-button clears shared scope text
    instance.setSelectedId("workout-button");
    expect(scopeWidth?.textContent).toBe("");
    expect(scopeHeight?.textContent).toBe("");

    instance.unmount();
  });

  it("prohibits innerHTML usage and preserves game storage untouched", () => {
    const formViewSrc = readSource("src/editor/ui/view/UIPropertyFormView.ts");
    const shellViewSrc = readSource("src/editor/ui/view/UIShellView.ts");

    expect(formViewSrc).not.toContain("innerHTML");
    expect(shellViewSrc).not.toContain("innerHTML");

    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(STORAGE_TOUCHED).toBe(false);
  });

  it("mounts property form into UIShellView propertiesPanel and synchronizes on selection change", () => {
    const shell = mountShell(container as unknown as HTMLElement);

    const propertiesPanel = container.querySelector('[data-panel="properties"]');
    expect(propertiesPanel).not.toBeNull();

    const form = propertiesPanel?.querySelector('[data-view="property-form"]');
    expect(form).not.toBeNull();

    const inputX = propertiesPanel?.querySelector('input[data-field="x"]');
    const playCard = BASELINE_REGISTRY.preset.cards[0];
    expect(inputX?.value).toBe(String(playCard.x));

    // Select second item via shell
    shell.selectElement(1);
    const secondCard = BASELINE_REGISTRY.preset.cards[1];
    expect(inputX?.value).toBe(String(secondCard.x));

    shell.unmount();
    expect(container.children.length).toBe(0);
  });
});
