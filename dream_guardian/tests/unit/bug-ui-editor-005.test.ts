import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  type UIVisualDocument,
  type UIVisualPage,
  type UIVisualPageId,
} from "../../src/editor/ui/data/UIVisualDocument";
import {
  createDefaultUIPresentationDocument,
  type UIPresentationPageId,
} from "../../src/data/UIPresentation";
import { PRESENTATION_PAGE_TO_EDITOR_PAGE_MAP } from "../../src/editor/ui/data/UIVisualArtifactBuilder";
import { validateUIPresentationDocument } from "../../src/data/UIPresentationValidator";

function createValidTestDocument(): UIVisualDocument {
  const presDoc = createDefaultUIPresentationDocument();
  const pages: Record<UIVisualPageId, UIVisualPage> = {} as any;

  for (const [presPageId, presPage] of Object.entries(presDoc.pages)) {
    const editorPageId = PRESENTATION_PAGE_TO_EDITOR_PAGE_MAP[presPageId as UIPresentationPageId];
    pages[editorPageId] = {
      pageId: editorPageId,
      name: editorPageId,
      elements: presPage.elements.map((el: any) => ({
        id: el.id,
        name: el.name,
        type: el.type,
        bounds: { ...el.bounds },
        hitBounds: el.hitBounds ? { ...el.hitBounds } : undefined,
        actionId: el.actionId,
        text: el.text,
        assetId: el.assetId,
        fontSize: el.fontSize,
        dynamicBinding: el.dynamicBinding,
      })),
    };
  }

  return {
    kind: "dream-guardian-ui-visual-doc",
    schemaVersion: "1.0.0",
    design: { width: 1080, height: 2160 },
    pages,
    resources: { assetIds: [] },
  };
}

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
      delete this.dataset[name.slice(5)];
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
    this.dispatchEvent({
      type: "click",
      target: this,
      currentTarget: this,
      preventDefault: () => {},
    });
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
  public querySelectorAll(_selector: string): MockDOMElement[] {
    return [];
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
}

describe("Issue #552: [BUG-UI-EDITOR-005] 적용본 추출 버튼 누락 및 편집 내용 반영", () => {
  let mockDoc: MockDocument;
  let container: MockDOMElement;
  let factory: any;
  let scheduler: MockScheduler;
  let origGlobalDoc: any;

  beforeEach(() => {
    mockDoc = new MockDocument();
    container = mockDoc.createElement("div");
    factory = createInMemoryIDBFactory();
    scheduler = new MockScheduler();
    origGlobalDoc = (globalThis as any).document;
    (globalThis as any).document = mockDoc;
  });

  afterEach(() => {
    (globalThis as any).document = origGlobalDoc;
  });

  it("1. 툴바에 '적용본 추출' 및 '전체 백업' 버튼이 렌더링되어 표시된다", async () => {
    const db = new UIVisualIndexedDB({ factory });
    await db.open();
    const store = new UIVisualStore(db);
    const ctrl = new UIVisualProjectController({
      store,
      projectId: "proj-test-toolbar",
      scheduler,
    });

    mountShell(container as any, {
      controller: ctrl,
      session: ctrl.getSession(),
      document: ctrl.getDocument(),
    });

    const exportArtifactBtn = container.querySelector('[data-action="적용본 추출"]');
    const fullBackupBtn = container.querySelector('[data-action="전체 백업"]');

    expect(exportArtifactBtn).not.toBeNull();
    expect((exportArtifactBtn as any).textContent).toBe("적용본 추출");

    expect(fullBackupBtn).not.toBeNull();
    expect((fullBackupBtn as any).textContent).toBe("전체 백업");

    db.close();
  });

  it("2. 툴바의 '적용본 추출' 버튼 클릭 시 편집된 좌표가 반영된 JSON이 다운로드되고 UIPresentationValidator를 통과한다", async () => {
    const db = new UIVisualIndexedDB({ factory });
    await db.open();
    const store = new UIVisualStore(db);
    const projectId = "proj-math-adventure";
    const initialDoc = createValidTestDocument();
    const ctrl = new UIVisualProjectController({
      store,
      projectId,
      initialDocument: initialDoc,
      scheduler,
    });

    // 요소 좌표 편집: btn_story의 x를 320, y를 480으로 변경
    const editCommand = {
      id: "cmd-move-card",
      type: "move-elements" as const,
      pageId: "menu_main" as const,
      moves: [
        {
          elementId: "btn_story",
          before: { x: 140, y: 450, width: 800, height: 100 },
          after: { x: 320, y: 480, width: 800, height: 100 },
          afterHitBounds: { x: 320, y: 480, width: 800, height: 100 },
        },
      ],
    };
    ctrl.edit(editCommand);

    const downloadedFiles: { filename: string; text: string }[] = [];
    const downloader = {
      download: (filename: string, text: string): string => {
        downloadedFiles.push({ filename, text });
        return filename;
      },
    };

    let statusLog = "";
    mountShell(container as any, {
      controller: ctrl,
      session: ctrl.getSession(),
      document: ctrl.getDocument(),
      downloader,
      onStatus: (msg) => {
        statusLog = msg;
      },
    });

    const exportArtifactBtn = container.querySelector<MockDOMElement>('[data-action="적용본 추출"]');
    expect(exportArtifactBtn).not.toBeNull();

    // 버튼 클릭 트리거
    exportArtifactBtn!.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadedFiles.length).toBe(1);
    expect(downloadedFiles[0].filename).toContain("ui-presentation-proj-math-adventure");
    expect(statusLog).toContain("적용본 추출 완료");

    const parsed = JSON.parse(downloadedFiles[0].text);

    // 1) Presentation Artifact kind 확인
    expect(parsed.kind).toBe("dream-guardian-ui-presentation");

    // 2) sourceId가 실제 projectId인지 확인
    expect(parsed.sourceProjectId).toBe(projectId);

    // 3) 편집된 좌표(x: 320, y: 480)가 반영되었는지 확인
    const btnStory = parsed.pages?.main_home?.elements?.find((el: any) => el.id === "btn_story");
    expect(btnStory).toBeDefined();
    expect(btnStory.bounds.x).toBe(320);
    expect(btnStory.bounds.y).toBe(480);

    // 4) UIPresentationValidator 유효성 검증 통과 확인
    const validationResult = validateUIPresentationDocument(parsed);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toEqual([]);

    db.close();
  });

  it("3. 전달 데이터 추출 실행 시 controller의 getProjectId() 및 getDocument()가 바인딩되고 sourceId가 실제 projectId로 반영된다", async () => {
    const db = new UIVisualIndexedDB({ factory });
    await db.open();
    const store = new UIVisualStore(db);
    const projectId = "proj-custom-guardian";
    const initialDoc = createValidTestDocument();
    const ctrl = new UIVisualProjectController({
      store,
      projectId,
      initialDocument: initialDoc,
      scheduler,
    });

    // 편집: btn_story의 x를 260, y를 380으로 변경
    ctrl.edit({
      id: "cmd-move-2",
      type: "move-elements",
      pageId: "menu_main",
      moves: [
        {
          elementId: "btn_story",
          before: { x: 140, y: 450, width: 800, height: 100 },
          after: { x: 260, y: 380, width: 800, height: 100 },
          afterHitBounds: { x: 260, y: 380, width: 800, height: 100 },
        },
      ],
    });

    const downloadedFiles: { filename: string; text: string }[] = [];
    const downloader = {
      download: (filename: string, text: string): string => {
        downloadedFiles.push({ filename, text });
        return filename;
      },
    };

    mountShell(container as any, {
      controller: ctrl,
      session: ctrl.getSession(),
      document: ctrl.getDocument(),
      downloader,
      promptDirtyExport: () => "save-and-export",
    });

    const transferBtn = container.querySelector<MockDOMElement>('[data-action="전달 데이터 추출"]');
    expect(transferBtn).not.toBeNull();

    transferBtn!.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadedFiles.length).toBe(1);
    const parsed = JSON.parse(downloadedFiles[0].text);

    // sourceId가 기본 fallback인 "proj-export"가 아닌 실제 projectId로 반영되었는지 검증
    expect(parsed.provenance?.sourceId).toBe(projectId);

    // 편집된 좌표가 전달 메뉴에 보존/반영되었는지 확인
    const cardStory = parsed.content?.cards?.find((c: any) => c.id === "card-story");
    expect(cardStory).toBeDefined();
    expect(cardStory.x).toBe(260);
    expect(cardStory.y).toBe(380);

    db.close();
  });
});
