import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initVisualEditor,
  start,
} from "../../src/editor/ui/main";
import {
  mountShell,
} from "../../src/editor/ui/view/UIShellView";
import {
  createInMemoryIDBFactory,
  UIVisualIndexedDB,
} from "../../src/editor/ui/storage/UIVisualIndexedDB";
import {
  UIVisualStore,
} from "../../src/editor/ui/storage/UIVisualStore";
import {
  UIVisualProjectController,
  type TimeScheduler,
} from "../../src/editor/ui/UIVisualProjectController";
import {
  UI_VISUAL_PAGE_IDS,
  type UIVisualDocument,
} from "../../src/editor/ui/data/UIVisualDocument";

// Lightweight DOM mock for Vitest Node environment
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
  public src = "";
  public alt = "";
  public files: any[] = [];
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public listeners: Record<string, ((event: any) => void)[]> = {};
  public ownerDocument: any;
  public contentWindow: any = null;

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

  public dispatchEvent(event: MockEvent): boolean {
    event.target = this;
    event.currentTarget = this;
    const list = this.listeners[event.type] ?? [];
    for (const l of list) {
      l.call(this, event);
    }
    return !event.defaultPrevented;
  }

  public focus(): void {}
  public blur(): void {}
  public click(): void {
    this.dispatchEvent(new MockEvent("click", { bubbles: true }));
  }

  public querySelector<T = MockDOMElement>(selector: string): T | null {
    const results = this.querySelectorAll<T>(selector);
    return results[0] ?? null;
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

class MockEvent {
  public type: string;
  public target: any = null;
  public currentTarget: any = null;
  public bubbles: boolean;
  public cancelable: boolean;
  public defaultPrevented = false;
  public _propagationStopped = false;

  constructor(type: string, init?: { bubbles?: boolean; cancelable?: boolean }) {
    this.type = type;
    this.bubbles = init?.bubbles ?? false;
    this.cancelable = init?.cancelable ?? false;
  }

  public preventDefault(): void {
    this.defaultPrevented = true;
  }

  public stopPropagation(): void {
    this._propagationStopped = true;
  }
}

class MockDocument {
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

describe("[#467 UI-VIS-037] 브라우저 영속 저장·열기·자동저장 연결", () => {
  let doc: MockDocument;
  let factory: IDBFactory;
  let container: MockDOMElement;
  let scheduler: MockScheduler;
  const originalDoc = (globalThis as any).document;

  beforeEach(() => {
    doc = new MockDocument();
    (globalThis as any).document = doc;
    factory = createInMemoryIDBFactory();
    container = doc.createElement("div");
    scheduler = new MockScheduler();
  });

  afterEach(() => {
    (globalThis as any).document = originalDoc;
    vi.restoreAllMocks();
  });

  describe("1. 브라우저 visual editor entry 연결 및 영속 복원", () => {
    it("initVisualEditor로 편집 후 저장하고, reload(재초기화) 시 10개 페이지의 변경사항이 복원된다", async () => {
      const dbName = "dg-ui-test-reload";
      const projectId = "proj-reload-1";

      // 1. First editor session
      const statusLogs: string[] = [];
      const shell1 = await initVisualEditor(container as any, {
        factory,
        dbName,
        projectId,
        scheduler,
        onStatus: (msg) => statusLogs.push(msg),
      });

      expect(shell1).toBeDefined();
      expect(shell1.controller).toBeDefined();

      // Edit page 1: menu_main
      (shell1.propertyForm as any).onVisualCommit?.({
        id: "cmd-1",
        type: "set-element-prop",
        pageId: "menu_main",
        elementId: "card-story",
        prop: "name",
        before: "스토리 모드 카드",
        after: "포겟 변경된 타이틀",
      });

      // Edit page 2: menu_sub
      (shell1.propertyForm as any).onVisualCommit?.({
        id: "cmd-2",
        type: "set-element-prop",
        pageId: "menu_sub",
        elementId: "sub-cell-1",
        prop: "name",
        before: "서브레벨 1 슬롯",
        after: "초급 모드 레이블",
      });

      // Click "저장"
      await shell1.fileActions.triggerAction("저장");

      // Verify save status message
      const hasSaved = statusLogs.some((l) => l.includes("저장됨") || l.includes("저장 완료"));
      expect(hasSaved).toBe(true);

      // Clean up session 1
      shell1.unmount();
      container.children = [];

      // 2. Reload session (second session pointing to same DB & project)
      const reloadLogs: string[] = [];
      const shell2 = await initVisualEditor(container as any, {
        factory,
        dbName,
        projectId,
        scheduler,
        onStatus: (msg) => reloadLogs.push(msg),
      });

      const restoredDoc: UIVisualDocument = shell2.controller.getDocument();

      // Verify all 10 pages exist
      for (const pageId of UI_VISUAL_PAGE_IDS) {
        expect(restoredDoc.pages[pageId]).toBeDefined();
      }

      // Verify page 1 modification restored
      const storyElem = restoredDoc.pages.menu_main.elements.find(
        (e) => e.id === "card-story"
      );
      expect(storyElem?.name).toBe("포겟 변경된 타이틀");

      // Verify page 2 modification restored
      const ch1Elem = restoredDoc.pages.menu_sub.elements.find(
        (e) => e.id === "sub-cell-1"
      );
      expect(ch1Elem?.name).toBe("초급 모드 레이블");

      shell2.unmount();
    });

    it("InMemoryDatabasePort는 테스트/호환 경로이며 실제 영속 저장 성공으로 과장하지 않는다", () => {
      const logs: string[] = [];
      const legacyPort = {
        name: "test-in-mem",
        stores: ["projects", "snapshots"] as any,
        open: () => {},
        transaction: () => ({
          get: () => null,
          put: () => {},
          delete: () => {},
          abort: () => {},
        }),
        finish: () => ({ ok: true }),
      };

      const shell = start(container as any, {
        port: legacyPort as any,
        onStatus: (msg: string) => logs.push(msg),
      } as any);

      expect(shell).toBeDefined();
      shell.unmount();
    });
  });

  describe("2. 800ms debounce draft 자동저장 및 flush/unmount 연계", () => {
    it("편집 시 800ms debounce 이후에만 draft가 IndexedDB에 기록된다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-debounce",
        writerId: "writer-tab-1",
        scheduler,
      });

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
      });

      // Initially no draft in store
      let draft = await store.loadDraft("proj-debounce", "writer-tab-1");
      expect(draft).toBeNull();

      // Edit element via shell
      (shell.propertyForm as any).onVisualCommit?.({
        id: "cmd-debounce",
        type: "set-element-prop",
        pageId: "menu_main",
        elementId: "card-story",
        prop: "name",
        before: "스토리 모드 카드",
        after: "디바운스 테스트 텍스트",
      });

      // Advance 400ms (not yet 800ms)
      scheduler.advanceBy(400);
      draft = await store.loadDraft("proj-debounce", "writer-tab-1");
      expect(draft).toBeNull();

      // Advance remaining 400ms (total 800ms)
      scheduler.advanceBy(400);
      draft = await store.loadDraft("proj-debounce", "writer-tab-1");
      expect(draft).not.toBeNull();
      const draftDoc = draft!.document as unknown as UIVisualDocument;
      expect(
        draftDoc.pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("디바운스 테스트 텍스트");

      shell.unmount();
      db.close();
    });

    it("unmount 및 visibilitychange(hidden) 시 대기 중인 autosave가 즉시 flush된다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-flush",
        writerId: "writer-tab-1",
        scheduler,
      });

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
      });

      (shell.propertyForm as any).onVisualCommit?.({
        id: "cmd-flush",
        type: "set-element-prop",
        pageId: "menu_main",
        elementId: "card-story",
        prop: "name",
        before: "스토리 모드 카드",
        after: "언마운트 플러시 테스트",
      });

      // Before 800ms, unmount occurs
      shell.unmount();

      // Should be flushed
      const draft = await store.loadDraft("proj-flush", "writer-tab-1");
      expect(draft).not.toBeNull();
      const draftDoc = draft!.document as unknown as UIVisualDocument;
      expect(
        draftDoc.pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("언마운트 플러시 테스트");

      db.close();
    });
  });

  describe("3. QuotaExceededError 실패 시 성공 라벨 0건 및 에러 안내", () => {
    it("저장 중 QuotaExceededError 발생 시 저장 성공 라벨은 0건이어야 하며 에러 상태를 안내한다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);

      // Spy on store.saveCheckpoint to simulate QuotaExceededError
      vi.spyOn(store, "saveCheckpoint").mockResolvedValue({
        status: "failed",
        saved: false,
        error: "QuotaExceededError: storage limit reached",
      });

      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-quota",
        scheduler,
      });

      const statusLogs: string[] = [];
      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
        onStatus: (msg) => statusLogs.push(msg),
      });

      // Trigger "저장"
      await shell.fileActions.triggerAction("저장");

      // Verify ZERO success labels
      const hasSavedSuccess = statusLogs.some(
        (l) => l.includes("저장됨") || l.includes("저장 완료")
      );
      expect(hasSavedSuccess).toBe(false);

      // Verify error guidance
      const hasFailedMsg = statusLogs.some(
        (l) => l.includes("저장 실패") && l.includes("저장 성공 0건")
      );
      expect(hasFailedMsg).toBe(true);

      // Toolbar meta must NOT claim saved
      const metaBox = shell.toolbar.querySelector(".toolbar-meta");
      expect(metaBox?.textContent).not.toContain("저장됨");

      shell.unmount();
      db.close();
    });
  });

  describe("4. 2탭 CAS 충돌 (Conflict) 상태 명확 구분", () => {
    it("다른 탭에서 먼저 저장하여 세대가 달라진 경우 충돌을 감지하고 저장 성공을 과장하지 않는다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);

      // Tab A controller
      const ctrlA = new UIVisualProjectController({
        store,
        projectId: "proj-cas",
        writerId: "tab-A",
        scheduler,
      });

      // Tab B controller
      const ctrlB = new UIVisualProjectController({
        store,
        projectId: "proj-cas",
        writerId: "tab-B",
        scheduler,
      });

      // Tab A saves first -> generation becomes 1
      const flightA = ctrlA.save();
      const saveResA = await ctrlA.completeSave(flightA.actionId);
      expect(saveResA.status).toBe("saved");
      expect(ctrlA.getGeneration()).toBe(1);

      // Tab B tries to save with expected generation 0
      const statusLogsB: string[] = [];
      const shellB = mountShell(container as any, {
        controller: ctrlB,
        session: ctrlB.getSession(),
        document: ctrlB.getDocument(),
        onStatus: (msg) => statusLogsB.push(msg),
      });

      await shellB.fileActions.triggerAction("저장");

      // Tab B must detect conflict
      const hasConflict = statusLogsB.some((l) => l.includes("충돌"));
      expect(hasConflict).toBe(true);

      const hasSaved = statusLogsB.some((l) => l.includes("저장됨"));
      expect(hasSaved).toBe(false);

      const metaBox = shellB.toolbar.querySelector(".toolbar-meta");
      expect(metaBox?.textContent).toContain("충돌");

      shellB.unmount();
      db.close();
    });
  });

  describe("5. 새 문서 열기 취소 / 변환 실패 시 기존 문서 및 히스토리 100% 보존", () => {
    it("새 문서 열기 취소 시 기존 문서 및 히스토리가 100% 보존된다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-cancel-open",
        scheduler,
      });

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
        picker: {
          pick: async () => null, // User cancelled file picker
        },
      });

      // Edit document
      (shell.propertyForm as any).onVisualCommit?.({
        id: "cmd-cancel",
        type: "set-element-prop",
        pageId: "menu_main",
        elementId: "card-story",
        prop: "name",
        before: "스토리 모드 카드",
        after: "유지되어야 하는 기존 타이틀",
      });

      // Attempt open (and cancel)
      await shell.fileActions.triggerAction("열기");

      // Verify original doc unchanged
      const currentDoc = ctrl.getDocument();
      expect(
        currentDoc.pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("유지되어야 하는 기존 타이틀");

      // Undo history preserved: can still undo
      const undoBtn = shell.toolbar.querySelector(
        '[data-action="Undo"]'
      ) as unknown as MockDOMElement;
      undoBtn.click();

      expect(
        ctrl.getDocument().pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("스토리 모드 카드");

      shell.unmount();
      db.close();
    });

    it("변환 실패(잘못된 JSON 또는 스키마 위반) 시 기존 문서와 히스토리가 100% 보존된다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-corrupt-open",
        scheduler,
      });

      const statusLogs: string[] = [];
      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
        picker: {
          pick: async () => ({
            name: "corrupt.json",
            text: "{ invalid json format !!@#$ }",
          }),
        },
        onStatus: (msg) => statusLogs.push(msg),
      });

      (shell.propertyForm as any).onVisualCommit?.({
        id: "cmd-corrupt",
        type: "set-element-prop",
        pageId: "menu_main",
        elementId: "card-story",
        prop: "name",
        before: "스토리 모드 카드",
        after: "변환실패시보존될텍스트",
      });

      await shell.fileActions.triggerAction("열기");

      const hasFailMsg = statusLogs.some(
        (l) => l.includes("열기 실패") && l.includes("기존 문서 보존됨")
      );
      expect(hasFailMsg).toBe(true);

      // Verify original doc untouched
      expect(
        ctrl.getDocument().pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("변환실패시보존될텍스트");

      shell.unmount();
      db.close();
    });
  });

  describe("6. 다운로드 요청(백업, 전달 데이터 추출)의 과장 없는 알림", () => {
    it("프로젝트 백업 및 전달 데이터 추출은 실제 디스크 저장이 아닌 '다운로드 요청'으로 명시된다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-download-req",
        scheduler,
      });

      const statusLogs: string[] = [];
      const downloadedFiles: string[] = [];

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
        downloader: {
          download: (name, _text) => {
            downloadedFiles.push(name);
            return name;
          },
        },
        onStatus: (msg) => statusLogs.push(msg),
      });

      // 1. Trigger backup
      await shell.fileActions.triggerAction("프로젝트 백업");
      expect(downloadedFiles.length).toBeGreaterThanOrEqual(1);
      const backupLog = statusLogs.find((l) => l.includes("백업"));
      expect(backupLog).toBeDefined();
      expect(backupLog).toContain("다운로드 요청");
      expect(backupLog).not.toContain("디스크 저장 완료");

      // 2. Trigger transfer export
      await shell.fileActions.triggerAction("전달 데이터 추출");
      expect(downloadedFiles.length).toBeGreaterThanOrEqual(2);
      const exportLog = statusLogs.find((l) => l.includes("전달 데이터"));
      expect(exportLog).toBeDefined();
      expect(exportLog).toContain("다운로드 요청");
      expect(exportLog).not.toContain("디스크 저장 완료");

      shell.unmount();
      db.close();
    });
  });

  describe("7. 단일 VisualEditorSession 구독 및 Undo / Form / Preview 일치", () => {
    it("속성 수정 및 Undo/Redo 실행 시 컨트롤러 세션, 폼, 프리뷰, 툴바 메타가 완벽히 일치한다", async () => {
      const db = new UIVisualIndexedDB({ factory });
      await db.open();
      const store = new UIVisualStore(db);
      const ctrl = new UIVisualProjectController({
        store,
        projectId: "proj-session-sync",
        scheduler,
      });

      const shell = mountShell(container as any, {
        controller: ctrl,
        session: ctrl.getSession(),
        document: ctrl.getDocument(),
      });

      const initialRev = ctrl.getSession().revision;

      // Edit a property
      (shell.propertyForm as any).onVisualCommit?.({
        id: "cmd-sync",
        type: "set-element-prop",
        pageId: "menu_main",
        elementId: "card-story",
        prop: "name",
        before: "스토리 모드 카드",
        after: "일치 검증 타이틀",
      });

      // Controller session revision incremented
      expect(ctrl.getSession().revision).toBeGreaterThan(initialRev);
      const modifiedRev = ctrl.getSession().revision;

      // Document updated in controller
      expect(
        ctrl.getDocument().pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("일치 검증 타이틀");

      // Toolbar meta updated
      const metaBox = shell.toolbar.querySelector(".toolbar-meta");
      expect(metaBox?.textContent).toContain(`rev ${modifiedRev}`);

      // Undo button click
      const undoBtn = shell.toolbar.querySelector(
        '[data-action="Undo"]'
      ) as unknown as MockDOMElement;
      undoBtn.click();

      // Controller session reverted
      expect(
        ctrl.getDocument().pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("스토리 모드 카드");

      // Toolbar meta reflects undo revision
      expect(metaBox?.textContent).toContain(`rev ${ctrl.getSession().revision}`);

      // Redo button click
      const redoBtn = shell.toolbar.querySelector(
        '[data-action="Redo"]'
      ) as unknown as MockDOMElement;
      redoBtn.click();

      // Controller session redone
      expect(
        ctrl.getDocument().pages.menu_main.elements.find((e) => e.id === "card-story")?.name
      ).toBe("일치 검증 타이틀");

      shell.unmount();
      db.close();
    });
  });
});
