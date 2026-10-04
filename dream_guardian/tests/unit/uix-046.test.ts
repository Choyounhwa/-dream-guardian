import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IFRAME_IS_SECURITY_SANDBOX,
  PREVIEW_SOURCE,
  type PreviewEnvelope,
} from "../../src/editor/ui/UIPreviewHost";
import {
  PREVIEW_FILE_NAME,
  SANDBOX_DISCLAIMER_TEXT,
  mountPreviewFrame,
  resolvePreviewSrc,
} from "../../src/editor/ui/view/UIPreviewFrameView";
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
  src: string = "";
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
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[key] = String(value);
    }
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
    if (name === "src") this.src = String(value);
  }

  getAttribute(name: string): string | null {
    if (name === "src" && this.src) return this.src;
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
  }

  addEventListener(type: string, handler: (event: any) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((h) => h !== handler);
  }

  dispatchEvent(event: any): boolean {
    const list = this.listeners[event.type] ?? [];
    for (const h of list) h(event);
    return true;
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const walk = (node: MockElement) => {
      if (matchesSelector(node, selector)) results.push(node);
      for (const child of node.children) walk(child);
    };
    for (const child of this.children) walk(child);
    return results;
  }
}

function matchesSelector(node: MockElement, selector: string): boolean {
  if (selector.startsWith(".")) {
    const cls = selector.slice(1);
    return node.className.split(/\s+/).includes(cls);
  }
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector.startsWith("[") && selector.endsWith("]")) {
    const inner = selector.slice(1, -1);
    const eqIdx = inner.indexOf("=");
    if (eqIdx !== -1) {
      const attr = inner.slice(0, eqIdx);
      const val = inner.slice(eqIdx + 1).replace(/^["']|["']$/g, "");
      return node.attributes[attr] === val;
    }
    return Object.prototype.hasOwnProperty.call(node.attributes, inner);
  }
  if (/^[A-Za-z]+$/.test(selector)) {
    return node.tagName.toLowerCase() === selector.toLowerCase();
  }
  return false;
}

class MockDocument {
  body: MockElement;
  constructor() {
    this.body = new MockElement("body");
  }
  createElement(tag: string): MockElement {
    return new MockElement(tag);
  }
}

describe("[UIX-046] UI Preview Frame View & PreviewHost Integration", () => {
  let originalDoc: any;
  let originalWin: any;
  let mockDoc: MockDocument;
  let mockWindow: {
    location: { origin: string };
    addEventListener: any;
    removeEventListener: any;
    listeners: Record<string, ((event: any) => void)[]>;
    dispatchEvent: (event: any) => boolean;
  };

  beforeEach(() => {
    originalDoc = (globalThis as any).document;
    originalWin = (globalThis as any).window;

    mockDoc = new MockDocument();
    mockWindow = {
      location: { origin: "http://localhost:3000" },
      listeners: {},
      addEventListener: vi.fn((type: string, handler: (e: any) => void) => {
        if (!mockWindow.listeners[type]) mockWindow.listeners[type] = [];
        mockWindow.listeners[type].push(handler);
      }),
      removeEventListener: vi.fn((type: string, handler: (e: any) => void) => {
        if (!mockWindow.listeners[type]) return;
        mockWindow.listeners[type] = mockWindow.listeners[type].filter((h) => h !== handler);
      }),
      dispatchEvent: (event: any) => {
        const list = mockWindow.listeners[event.type] ?? [];
        for (const h of list) h(event);
        return true;
      },
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = mockWindow;
  });

  afterEach(() => {
    (globalThis as any).document = originalDoc;
    (globalThis as any).window = originalWin;
  });

  it("strictly restricts iframe src to ui-preview.html and blocks game/external URLs", () => {
    expect(PREVIEW_FILE_NAME).toBe("ui-preview.html");

    // Valid paths
    expect(resolvePreviewSrc("", "ui-preview.html")).toBe("/ui-preview.html");
    expect(resolvePreviewSrc(".", "ui-preview.html")).toBe("./ui-preview.html");
    expect(resolvePreviewSrc("dist", "ui-preview.html")).toBe("dist/ui-preview.html");

    // Disallowed filenames: index.html, camera.html, main.ts, external protocols
    expect(resolvePreviewSrc("", "index.html")).toBeNull();
    expect(resolvePreviewSrc("", "camera.html")).toBeNull();
    expect(resolvePreviewSrc("", "main.ts")).toBeNull();
    expect(resolvePreviewSrc("https://evil.com", "ui-preview.html")).toBeNull();
    expect(resolvePreviewSrc("javascript:", "ui-preview.html")).toBeNull();
    expect(resolvePreviewSrc("", "../ui-preview.html")).toBeNull();

    // When mounting with unauthorized assetFile, iframe does not get malicious src
    const container = mockDoc.createElement("div") as any;
    const frame = mountPreviewFrame(container, {
      assetFile: "index.html",
    });
    expect(frame.iframe.getAttribute("src")).toBeNull();
    expect(frame.getLastStatus()).toContain("거부");
  });

  it("mounts preview frame with pure DOM, disclaimer text, and issues initial requestId", () => {
    expect(IFRAME_IS_SECURITY_SANDBOX).toBe(false);
    expect(SANDBOX_DISCLAIMER_TEXT).toContain("IFRAME_IS_SECURITY_SANDBOX=false");

    const container = mockDoc.createElement("div") as any;
    const frame = mountPreviewFrame(container, {
      docId: "menu-main",
    });

    expect(frame.root).not.toBeNull();
    expect(frame.notice.textContent).toBe(SANDBOX_DISCLAIMER_TEXT);
    expect(frame.iframe.getAttribute("src")).toBe("/ui-preview.html");
    expect(frame.iframe.className).toBe("ui-preview-iframe");

    const host = frame.getHost();
    expect(host.docId).toBe("menu-main");
    expect(host.requestId).toMatch(/^req-\d+$/);
    expect(host.issuedForDocId).toBe("menu-main");
  });

  it("updates document with replaceDocument and issues a new requestId", () => {
    const container = mockDoc.createElement("div") as any;
    const frame = mountPreviewFrame(container, { docId: "menu-main" });
    const initialReq = frame.getHost().requestId;

    frame.updateDocument("menu-sub");
    const updatedHost = frame.getHost();

    expect(updatedHost.docId).toBe("menu-sub");
    expect(updatedHost.issuedForDocId).toBe("menu-sub");
    expect(updatedHost.requestId).not.toBe(initialReq);
    expect(frame.getLastStatus()).toContain("menu-sub");
    expect(frame.getLastStatus()).toContain(updatedHost.requestId);
  });

  it("validates incoming preview messages via acceptPreviewMessage and rejects stale/unauthorized envelopes", () => {
    const statusCalls: string[] = [];
    const container = mockDoc.createElement("div") as any;
    const frame = mountPreviewFrame(container, {
      docId: "menu-main",
      origin: "http://localhost:3000",
      onStatus: (msg) => statusCalls.push(msg),
    });

    const host = frame.getHost();

    // 1. Valid matching message -> accepted
    const validMessage: PreviewEnvelope = {
      origin: "http://localhost:3000",
      source: PREVIEW_SOURCE,
      kind: "preview:update",
      requestId: host.requestId,
      payload: { tree: [] },
    };
    const decision1 = frame.handlePreviewMessage(validMessage);
    expect(decision1.applied).toBe(true);
    expect(frame.getLastStatus()).toContain("미리보기 반영 완료");

    // 2. Stale requestId -> rejected with stale-document
    const staleMessage: PreviewEnvelope = {
      origin: "http://localhost:3000",
      source: PREVIEW_SOURCE,
      kind: "preview:update",
      requestId: "req-outdated-999",
      payload: {},
    };
    const decision2 = frame.handlePreviewMessage(staleMessage);
    expect(decision2.applied).toBe(false);
    expect(decision2.reason).toBe("stale-document");
    expect(frame.getLastStatus()).toContain("거부: stale-document");

    // 3. Unauthorized origin -> rejected with origin
    const badOriginMessage: PreviewEnvelope = {
      origin: "http://untrusted-attacker.com",
      source: PREVIEW_SOURCE,
      kind: "preview:update",
      requestId: host.requestId,
      payload: {},
    };
    const decision3 = frame.handlePreviewMessage(badOriginMessage);
    expect(decision3.applied).toBe(false);
    expect(decision3.reason).toBe("origin");
    expect(frame.getLastStatus()).toContain("거부: origin");
  });

  it("does not roll back editing source when preview message fails or is rejected", () => {
    let originalBuffer = { x: 120, y: 340 };
    const container = mockDoc.createElement("div") as any;
    const frame = mountPreviewFrame(container, {
      docId: "menu-main",
      onStatus: (_msg) => {
        // Status callback invoked without touching originalBuffer
      },
    });

    // Send rejected message
    const rejectedMsg: PreviewEnvelope = {
      origin: "http://wrong-origin.org",
      source: PREVIEW_SOURCE,
      kind: "preview:update",
      requestId: frame.getHost().requestId,
      payload: { corrupted: true },
    };
    const decision = frame.handlePreviewMessage(rejectedMsg);
    expect(decision.applied).toBe(false);

    // Verify editing original remains unaffected
    expect(originalBuffer).toEqual({ x: 120, y: 340 });
    expect(frame.getLastStatus()).toContain("거부");
  });

  it("integrates UIPreviewFrameView into UIShellView preview panel and unmounts cleanly", () => {
    const container = mockDoc.createElement("div") as any;
    const shell = mountShell(container);

    expect(shell.previewFrame).toBeDefined();
    const iframe = shell.previewPanel.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe("/ui-preview.html");

    // Notice text in DOM
    const notice = shell.previewPanel.querySelector(".preview-sandbox-notice");
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("IFRAME_IS_SECURITY_SANDBOX=false");

    // Status bar mentions lack of sandbox guarantee
    expect(shell.statusPanel.textContent).toContain("샌드박스 미보장");
    expect(shell.statusPanel.textContent).toContain("게임에는 반영되지 않음");

    // Clean unmount
    shell.unmount();
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("strictly avoids innerHTML across UIPreviewFrameView and UIShellView", () => {
    const frameSource = readSource("src/editor/ui/view/UIPreviewFrameView.ts");
    const shellSource = readSource("src/editor/ui/view/UIShellView.ts");

    expect(frameSource.includes(".innerHTML")).toBe(false);
    expect(shellSource.includes(".innerHTML")).toBe(false);
  });
});
