import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import { KINDS, SCHEMA_VERSION } from "../../src/editor/ui/data/UIContracts";
import {
  GAME_APPLY_VERIFIED,
  GAME_REFLECTION_DISCLAIMER,
  STORAGE_TOUCHED,
  type Downloader,
  type FilePicker,
} from "../../src/editor/ui/view/UIFileActionView";
import { mountShell, type ShellInstance } from "../../src/editor/ui/view/UIShellView";

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
  type: string = "";
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
    if (name === "type") this.type = String(value);
  }

  getAttribute(name: string): string | null {
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
    for (const handler of list) {
      handler(event);
    }
    return true;
  }

  click(): void {
    this.dispatchEvent({ type: "click", target: this, defaultPrevented: false });
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

function createValidProjectDoc(projectId = "proj-test") {
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    projectId,
    design: { width: preset.design.width, height: preset.design.height },
    menu: {
      cards: preset.cards.map((card) => ({ id: card.id, x: card.x, y: card.y })),
      width: preset.width,
      height: preset.height,
      workoutButton: { ...preset.workoutButton },
    },
    baseline: {
      id: BASELINE_REGISTRY.id,
      version: BASELINE_REGISTRY.version,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    },
  };
}

describe("[UIX-047] File Action View & Toolbar IO Connection", () => {
  let originalDoc: any;
  let mockDoc: MockDocument;
  let container: MockElement;

  beforeEach(() => {
    originalDoc = (globalThis as any).document;
    mockDoc = new MockDocument();
    (globalThis as any).document = mockDoc;
    container = mockDoc.createElement("div");
    mockDoc.body.appendChild(container);
  });

  afterEach(() => {
    (globalThis as any).document = originalDoc;
  });

  it("1. 저장은 기존 checkpoint 저장 결과 문구를 상태줄에 표시하고 게임 세이브/설정에 접근하지 않는다", async () => {
    let savedCheckpointCalled = false;
    let receivedStatus = "";

    const fakeDoc = createValidProjectDoc("proj-save");
    const fakeController = {
      _doc: structuredClone(fakeDoc),
      projectId: () => "proj-save",
      document: () => fakeController._doc,
      status: () => ({ saved: true, dirty: false, label: "saved" }),
      save: () => {
        savedCheckpointCalled = true;
        return { status: "in-flight", actionId: "act-save-101" };
      },
      completeSave: (actionId: string) => ({
        status: "saved",
        checkpointId: `cp-${actionId}`,
        applied: true,
      }),
      requestReplace: () => ({ status: "confirm-replace" }),
      confirmReplace: () => ({ applied: true }),
    };

    const shell: ShellInstance = mountShell(container as any, {
      controller: fakeController,
      onStatus: (msg) => {
        receivedStatus = msg;
      },
    });

    expect(shell.fileActions).toBeDefined();
    const saveBtn = shell.toolbar.querySelector('[data-action="저장"]') as MockElement | null;
    expect(saveBtn).not.toBeNull();

    // Click save button
    saveBtn?.click();
    await Promise.resolve();

    expect(savedCheckpointCalled).toBe(true);
    expect(receivedStatus).toMatch(/저장 완료.*checkpoint/i);
    expect(receivedStatus).toContain(GAME_REFLECTION_DISCLAIMER);
    expect(shell.statusPanel.textContent).toContain("저장 완료");
    expect(shell.statusPanel.textContent).toContain(GAME_REFLECTION_DISCLAIMER);

    // Verify game apply/storage constants
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(STORAGE_TOUCHED).toBe(false);

    shell.unmount();
  });

  it("2. 백업 시 다운로드 API가 없거나 실패하면 원본을 보존하고 안내 문구를 표시한다", async () => {
    let statusLog: string[] = [];
    const originalDoc = createValidProjectDoc("proj-backup-orig");
    let currentDoc = structuredClone(originalDoc);

    const fakeController = {
      projectId: () => "proj-backup-orig",
      document: () => currentDoc,
      status: () => ({ saved: true, dirty: false, label: "saved" }),
      requestReplace: () => ({ status: "confirm-replace" }),
      confirmReplace: () => ({ applied: true }),
    };

    // Case 2-A: 다운로더 미제공 시
    const shellNoDownloader = mountShell(container as any, {
      controller: fakeController,
      downloader: undefined,
      onStatus: (msg) => statusLog.push(msg),
    });

    const backupBtn = shellNoDownloader.toolbar.querySelector(
      '[data-action="프로젝트 백업"]'
    ) as MockElement | null;
    expect(backupBtn).not.toBeNull();

    backupBtn?.click();
    await Promise.resolve();

    const lastMsg = statusLog[statusLog.length - 1];
    expect(lastMsg).toContain("다운로드 API 미지원으로 백업 추출 불가 (원본 데이터 보존됨)");
    expect(lastMsg).toContain(GAME_REFLECTION_DISCLAIMER);
    // 원본 문서가 삭제되거나 변조되지 않음 검증
    expect(fakeController.document()).toEqual(originalDoc);

    shellNoDownloader.unmount();

    // Case 2-B: 다운로더가 제공될 때는 정상적으로 다운로드 호출
    const downloadedFiles: { name: string; text: string }[] = [];
    const mockDownloader: Downloader = {
      download: (name, text) => {
        downloadedFiles.push({ name, text });
        return name;
      },
    };

    const container2 = mockDoc.createElement("div");
    mockDoc.body.appendChild(container2);
    const shellWithDownloader = mountShell(container2 as any, {
      controller: fakeController,
      downloader: mockDownloader,
      onStatus: (msg) => statusLog.push(msg),
    });

    const backupBtn2 = shellWithDownloader.toolbar.querySelector(
      '[data-action="프로젝트 백업"]'
    ) as MockElement | null;
    backupBtn2?.click();
    await Promise.resolve();

    expect(downloadedFiles.length).toBeGreaterThanOrEqual(1);
    expect(downloadedFiles.some((f) => f.name.includes("backup"))).toBe(true);
    expect(fakeController.document()).toEqual(originalDoc);

    shellWithDownloader.unmount();
  });

  it("3. 전달 데이터 추출 시 미저장 편집 상태의 3가지 분기(저장 후 추출, 기존 저장본 추출, 취소)를 올바르게 처리한다", async () => {
    const savedDoc = createValidProjectDoc("proj-transfer");
    const editedDoc = {
      ...savedDoc,
      menu: {
        ...savedDoc.menu,
        cards: savedDoc.menu.cards.map((c, i) =>
          i === 0 ? { ...c, x: c.x + 10 } : c
        ),
      },
    };

    const downloadedExports: { name: string; text: string }[] = [];
    const mockDownloader: Downloader = {
      download: (name, text) => {
        downloadedExports.push({ name, text });
        return name;
      },
    };

    // 3-A: 취소 (cancel) 선택 시
    let statusMsg = "";
    const shellCancel = mountShell(container as any, {
      controller: {
        projectId: () => "proj-transfer",
        document: () => editedDoc,
        status: () => ({ saved: false, dirty: true, label: "dirty" }),
        saved: savedDoc,
        requestReplace: () => ({ status: "confirm-replace" }),
        confirmReplace: () => ({ applied: true }),
      },
      downloader: mockDownloader,
      promptDirtyExport: () => "cancel",
      onStatus: (msg) => {
        statusMsg = msg;
      },
    });

    const exportBtn1 = shellCancel.toolbar.querySelector(
      '[data-action="전달 데이터 추출"]'
    ) as MockElement | null;
    exportBtn1?.click();
    await Promise.resolve();

    expect(downloadedExports.length).toBe(0);
    expect(statusMsg).toMatch(/취소.*(보존|유지)/);
    shellCancel.unmount();

    // 3-B: 기존 저장본 추출 (saved-only) 선택 시
    const container2 = mockDoc.createElement("div");
    mockDoc.body.appendChild(container2);
    const shellSavedOnly = mountShell(container2 as any, {
      controller: {
        projectId: () => "proj-transfer",
        document: () => editedDoc,
        saved: savedDoc,
        status: () => ({ saved: false, dirty: true, label: "dirty" }),
        requestReplace: () => ({ status: "confirm-replace" }),
        confirmReplace: () => ({ applied: true }),
      },
      downloader: mockDownloader,
      promptDirtyExport: () => "saved-only",
      onStatus: (msg) => {
        statusMsg = msg;
      },
    });

    const exportBtn2 = shellSavedOnly.toolbar.querySelector(
      '[data-action="전달 데이터 추출"]'
    ) as MockElement | null;
    exportBtn2?.click();
    await Promise.resolve();

    expect(downloadedExports.length).toBe(1);
    const parsedTransfer1 = JSON.parse(downloadedExports[0].text);
    expect(parsedTransfer1.kind).toBe(KINDS.transfer);
    // Should have used savedDoc coordinates (x not increased by 10)
    expect(parsedTransfer1.content.cards[0].x).toBe(savedDoc.menu.cards[0].x);
    shellSavedOnly.unmount();

    // 3-C: 저장 후 추출 (save-and-export) 선택 시
    let saveCalled = false;
    const container3 = mockDoc.createElement("div");
    mockDoc.body.appendChild(container3);
    const shellSaveAndExport = mountShell(container3 as any, {
      controller: {
        projectId: () => "proj-transfer",
        document: () => editedDoc,
        saved: savedDoc,
        status: () => ({ saved: false, dirty: true, label: "dirty" }),
        save: () => {
          saveCalled = true;
          return { status: "in-flight", actionId: "act-save-export" };
        },
        completeSave: () => ({ status: "saved", applied: true }),
        requestReplace: () => ({ status: "confirm-replace" }),
        confirmReplace: () => ({ applied: true }),
      },
      downloader: mockDownloader,
      promptDirtyExport: () => "save-and-export",
      onStatus: (msg) => {
        statusMsg = msg;
      },
    });

    downloadedExports.length = 0;
    const exportBtn3 = shellSaveAndExport.toolbar.querySelector(
      '[data-action="전달 데이터 추출"]'
    ) as MockElement | null;
    exportBtn3?.click();
    await Promise.resolve();

    expect(saveCalled).toBe(true);
    expect(downloadedExports.length).toBe(1);
    const parsedTransfer2 = JSON.parse(downloadedExports[0].text);
    expect(parsedTransfer2.content.cards[0].x).toBe(editedDoc.menu.cards[0].x);
    shellSaveAndExport.unmount();
  });

  it("4. 열기 버튼은 runOpen 또는 openProjectFile을 호출하고 다운로드/피커 부재 시 원본을 보존한다", async () => {
    let statusMsg = "";
    const originalDoc = createValidProjectDoc("proj-open-test");

    // Case 4-A: 피커 미제공 시
    const shellNoPicker = mountShell(container as any, {
      controller: {
        projectId: () => "proj-open-test",
        document: () => originalDoc,
        requestReplace: () => ({ status: "confirm-replace" }),
        confirmReplace: () => ({ applied: true }),
      },
      picker: undefined,
      onStatus: (msg) => {
        statusMsg = msg;
      },
    });

    const openBtn = shellNoPicker.toolbar.querySelector(
      '[data-action="열기"]'
    ) as MockElement | null;
    expect(openBtn).not.toBeNull();

    openBtn?.click();
    await Promise.resolve();

    expect(statusMsg).toMatch(/미지원.*보존|error/);
    shellNoPicker.unmount();

    // Case 4-B: 피커 제공되어 파일 선택 시
    const newDoc = createValidProjectDoc("proj-new-imported");
    let replacedIncoming: any = null;
    const mockPicker: FilePicker = {
      pick: async () => ({
        name: "test-import.json",
        text: JSON.stringify(newDoc),
      }),
    };

    const container2 = mockDoc.createElement("div");
    mockDoc.body.appendChild(container2);
    const shellWithPicker = mountShell(container2 as any, {
      controller: {
        projectId: () => "proj-open-test",
        document: () => originalDoc,
        requestReplace: (incoming: any) => {
          replacedIncoming = incoming;
          return { status: "confirm-replace" };
        },
        confirmReplace: () => ({ applied: true }),
      },
      picker: mockPicker,
      confirm: () => true,
      onStatus: (msg) => {
        statusMsg = msg;
      },
    });

    const openBtn2 = shellWithPicker.toolbar.querySelector(
      '[data-action="열기"]'
    ) as MockElement | null;
    openBtn2?.click();
    // Allow async pick and open
    await new Promise((r) => setTimeout(r, 10));

    expect(replacedIncoming).not.toBeNull();
    shellWithPicker.unmount();
  });

  it("5. 게임 적용·게시·테스트 실행 버튼은 일체 추가하지 않고 상태줄에 비반영을 명시한다", () => {
    const shell = mountShell(container as any);

    const allButtons = shell.root.querySelectorAll("button");
    const forbiddenKeywords = ["게임 적용", "게임 반영", "게시", "테스트 실행", "publish", "apply"];

    for (const btn of allButtons) {
      for (const kw of forbiddenKeywords) {
        expect(btn.textContent).not.toContain(kw);
        expect(btn.getAttribute("data-action")).not.toContain(kw);
      }
    }

    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(shell.statusPanel.textContent).toContain(GAME_REFLECTION_DISCLAIMER);
    shell.unmount();
  });

  it("6. innerHTML을 전혀 사용하지 않고 순수 DOM API만 사용한다", () => {
    // Check source files for innerHTML usage
    const actionSource = readSource("src/editor/ui/view/UIFileActionView.ts");
    const shellSource = readSource("src/editor/ui/view/UIShellView.ts");

    expect(actionSource).not.toMatch(/\.innerHTML/);
    expect(shellSource).not.toMatch(/\.innerHTML/);
  });

  it("7. unmount() 시 이벤트 리스너가 해제되어 버튼 클릭이 무시된다", async () => {
    let saveCount = 0;
    const fakeController = {
      projectId: () => "proj-unmount",
      document: () => createValidProjectDoc(),
      status: () => ({ saved: true, dirty: false, label: "saved" }),
      save: () => {
        saveCount += 1;
        return { status: "in-flight", actionId: "act-1" };
      },
      completeSave: () => ({ status: "saved", applied: true }),
      requestReplace: () => ({ status: "confirm-replace" }),
      confirmReplace: () => ({ applied: true }),
    };

    const shell = mountShell(container as any, {
      controller: fakeController,
    });

    const saveBtn = shell.toolbar.querySelector('[data-action="저장"]') as MockElement | null;
    expect(saveBtn).not.toBeNull();

    saveBtn?.click();
    await Promise.resolve();
    expect(saveCount).toBe(1);

    // Unmount
    shell.unmount();

    // Click after unmount
    saveBtn?.click();
    await Promise.resolve();
    expect(saveCount).toBe(1); // Not incremented
  });
});
