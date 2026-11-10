import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  UIVisualPublishController,
  type DirtyPublishChoice,
} from "../../src/editor/ui/UIVisualPublishController";
import {
  createInMemoryIDBFactory,
  UIVisualIndexedDB,
} from "../../src/editor/ui/storage/UIVisualIndexedDB";
import {
  UIVisualStore,
} from "../../src/editor/ui/storage/UIVisualStore";
import {
  UIVisualProjectController,
} from "../../src/editor/ui/UIVisualProjectController";
import {
  createDefaultUIPresentationDocument,
  type UIPresentationPageId,
} from "../../src/data/UIPresentation";
import {
  type UIVisualDocument,
  type UIVisualPage,
  type UIVisualPageId,
} from "../../src/editor/ui/data/UIVisualDocument";
import { PRESENTATION_PAGE_TO_EDITOR_PAGE_MAP } from "../../src/editor/ui/data/UIVisualArtifactBuilder";
import {
  bindFileActions,
} from "../../src/editor/ui/view/UIFileActionView";
import {
  mountShell,
} from "../../src/editor/ui/view/UIShellView";

// Helper to create a fully valid 10-page document
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

// Lightweight Mock DOM node for testing UI bindings
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
    if (name === "class") this.className = s;
    if (name === "type") this.type = s;
  }

  public getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  public removeAttribute(name: string): void {
    delete this.attributes[name];
    if (name.startsWith("data-")) {
      delete this.dataset[name.slice(5)];
    }
    if (name === "class") this.className = "";
  }

  public remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  public appendChild(child: MockDOMElement): MockDOMElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  public removeChild(child: MockDOMElement): MockDOMElement {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  public querySelector(sel: string): MockDOMElement | null {
    if (sel.startsWith("button[data-action=")) {
      const match = sel.match(/button\[data-action="([^"]+)"\]/);
      if (match) {
        const action = match[1];
        return this.find((el) => el.tagName === "BUTTON" && el.attributes["data-action"] === action);
      }
    }
    if (sel.startsWith("[data-action=")) {
      const match = sel.match(/\[data-action="([^"]+)"\]/);
      if (match) {
        const action = match[1];
        return this.find((el) => el.attributes["data-action"] === action);
      }
    }
    if (sel.startsWith(".")) {
      const cls = sel.slice(1);
      return this.find((el) => el.className.split(" ").includes(cls));
    }
    return null;
  }

  public querySelectorAll(sel: string): MockDOMElement[] {
    const results: MockDOMElement[] = [];
    if (sel === "button") {
      this.findAll((el) => el.tagName === "BUTTON", results);
    }
    return results;
  }

  public addEventListener(type: string, fn: (e: any) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  public removeEventListener(type: string, fn: (e: any) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== fn);
  }

  public dispatchEvent(evt: any): boolean {
    const type = evt.type ?? "click";
    const fns = this.listeners[type] ?? [];
    for (const fn of fns) fn(evt);
    return true;
  }

  private find(predicate: (el: MockDOMElement) => boolean): MockDOMElement | null {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }

  private findAll(predicate: (el: MockDOMElement) => boolean, out: MockDOMElement[]): void {
    if (predicate(this)) out.push(this);
    for (const child of this.children) {
      child.findAll(predicate, out);
    }
  }
}

class MockDocument {
  public createElement(tagName: string): MockDOMElement {
    return new MockDOMElement(tagName, this);
  }
}

describe("UI-VIS-039 (#469): 백업·추출·불변 게시본 선택 UI", () => {
  let idb: UIVisualIndexedDB;
  let store: UIVisualStore;
  let projCtrl: UIVisualProjectController;
  let baseDoc: UIVisualDocument;

  beforeEach(async () => {
    idb = new UIVisualIndexedDB({ factory: createInMemoryIDBFactory() });
    await idb.open();
    store = new UIVisualStore(idb);
    baseDoc = createValidTestDocument();

    projCtrl = new UIVisualProjectController({
      projectId: "proj-pub-test",
      writerId: "writer-pub-1",
      initialDocument: baseDoc,
      store,
    });
  });

  describe("1. UIVisualPublishController: Export vs Publish 명시적 분리 및 상태 제어", () => {
    it("추출(Export)은 releases store에 기록하지 않고 불변 presentation artifact만 생성 및 다운로드한다", async () => {
      let downloadedName = "";
      let downloadedContent = "";
      const downloader = {
        download: (name: string, content: string) => {
          downloadedName = name;
          downloadedContent = content;
          return name;
        },
      };

      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        downloader,
      });

      const res = await pubCtrl.exportArtifact();
      expect(res.ok).toBe(true);
      expect(res.savedCount).toBe(1);
      expect(downloadedName).toContain("proj-pub-test");
      expect(downloadedContent).toContain('"kind": "dream-guardian-ui-presentation"');

      // Releases store should remain untouched
      const activeRel = pubCtrl.getActiveRelease();
      expect(activeRel).toBeNull();
    });

    it("미저장(dirty) 상태에서 게시 시도 시 경고를 발생시키고 'cancel' 선택 시 게시를 차단한다", async () => {
      // Modify document to make it dirty
      projCtrl.edit((s) => {
        const doc = structuredClone(s.present);
        doc.pages.menu_main.elements.push({
          id: "extra-btn",
          name: "Extra Button",
          type: "button",
          bounds: { x: 10, y: 10, width: 100, height: 40 },
        });
        return {
          ...s,
          present: doc,
          revision: s.revision + 1,
          dirty: true,
        };
      });

      expect(projCtrl.status().dirty).toBe(true);

      const promptDirtyPublish = vi.fn((): DirtyPublishChoice => "cancel");
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        promptDirtyPublish,
      });

      const res = await pubCtrl.publishRelease();
      expect(res.ok).toBe(false);
      expect(res.savedCount).toBe(0);
      expect(res.reason).toBe("UNSAVED_CHANGES_BLOCKED");
      expect(promptDirtyPublish).toHaveBeenCalledTimes(1);

      // Verify no release is published
      expect(pubCtrl.getActiveRelease()).toBeNull();
    });

    it("미저장 상태에서 'save-and-publish' 선택 시 자동 저장 후 불변 releases에 등록된다", async () => {
      projCtrl.edit((s) => {
        const doc = structuredClone(s.present);
        doc.pages.menu_main.elements[0].name = "Updated Title";
        return {
          ...s,
          present: doc,
          revision: s.revision + 1,
          dirty: true,
        };
      });

      const promptDirtyPublish = vi.fn((): DirtyPublishChoice => "save-and-publish");
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        promptDirtyPublish,
      });

      const res = await pubCtrl.publishRelease();
      expect(res.ok).toBe(true);
      expect(res.savedCount).toBe(1);
      expect(res.releaseId).toBeDefined();
      expect(res.runtimeApplied).toBe(false); // 미검증 상태 유지
      expect(projCtrl.status().dirty).toBe(false);

      // Active release updated
      const activeRel = pubCtrl.getActiveRelease();
      expect(activeRel).not.toBeNull();
      expect(activeRel?.releaseId).toBe(res.releaseId);
    });

    it("저장 실패 또는 Quota 초과 시 이전 정상 게시본을 불변 보존하고 성공 0건을 정직 보고한다", async () => {
      // 1. First successful publish
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
      });

      const firstRes = await pubCtrl.publishRelease();
      expect(firstRes.ok).toBe(true);
      const firstReleaseId = firstRes.releaseId!;
      expect(pubCtrl.getActiveRelease()?.releaseId).toBe(firstReleaseId);

      // 2. Mock store.saveRelease to throw QuotaExceededError on next call
      vi.spyOn(store, "saveRelease").mockRejectedValueOnce(
        new Error("QuotaExceededError: storage limit reached")
      );

      // Make dirty edit
      projCtrl.edit((s) => {
        const doc = structuredClone(s.present);
        doc.pages.menu_main.elements[0].name = "Second Version";
        return {
          ...s,
          present: doc,
          revision: s.revision + 1,
          dirty: true,
        };
      });

      const secondRes = await pubCtrl.publishRelease({
        promptDirtyChoice: "save-and-publish",
      });

      expect(secondRes.ok).toBe(false);
      expect(secondRes.savedCount).toBe(0);
      expect(secondRes.reason).toBe("STORAGE_FAILED");

      // Verify previous release is STILL preserved intact
      expect(pubCtrl.getActiveRelease()?.releaseId).toBe(firstReleaseId);
      const storedRel = await store.getRelease(firstReleaseId);
      expect(storedRel).not.toBeNull();
      expect(storedRel?.releaseId).toBe(firstReleaseId);
    });
  });

  describe("2. 후보 검사 보고서(Candidate Summary) 및 해시 무결성", () => {
    it("게시 후보의 revision, dirty 여부, 유효성 검사, diff, 결정적 해시를 제공한다", async () => {
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
      });

      const summary = await pubCtrl.getCandidateSummary();
      expect(summary.projectId).toBe("proj-pub-test");
      expect(summary.isDirty).toBe(false);
      expect(summary.validationReport.valid).toBe(true);
      expect(summary.contentHash).toBeDefined();
      expect(typeof summary.contentHash).toBe("string");
      expect(summary.sourceCheckpointHash).toBeDefined();
    });

    it("다운로드 취소 또는 API 실패 시 성공 카운트 0건 및 실패 사유를 반환한다", async () => {
      const failingDownloader = {
        download: (): string => {
          throw new Error("Download aborted by user");
        },
      };

      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        downloader: failingDownloader,
      });

      const res = await pubCtrl.exportArtifact();
      expect(res.ok).toBe(false);
      expect(res.savedCount).toBe(0);
      expect(res.reason).toBe("DOWNLOAD_FAILED");
    });
  });

  describe("3. UIFileActionView 및 UIShellView 액션 연계", () => {
    it("UIFileActionView에서 '불변 게시', '적용본 추출', '전체 백업' 액션을 트리거할 수 있다", async () => {
      let statusLog = "";
      let downloaded = false;

      const downloader = {
        download: (name: string) => {
          downloaded = true;
          return name;
        },
      };

      const mockDoc = new MockDocument();
      const root = mockDoc.createElement("div");

      // Buttons inside root
      const publishBtn = mockDoc.createElement("button");
      publishBtn.setAttribute("data-action", "불변 게시");
      root.appendChild(publishBtn);

      const exportBtn = mockDoc.createElement("button");
      exportBtn.setAttribute("data-action", "적용본 추출");
      root.appendChild(exportBtn);

      const backupBtn = mockDoc.createElement("button");
      backupBtn.setAttribute("data-action", "전체 백업");
      root.appendChild(backupBtn);

      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        downloader,
      });

      const fileActions = bindFileActions(root as any, {
        controller: projCtrl,
        publishController: pubCtrl,
        downloader,
        onStatus: (msg) => {
          statusLog = msg;
        },
      });

      // 1. Trigger export
      await fileActions.triggerAction("적용본 추출");
      expect(downloaded).toBe(true);
      expect(statusLog).toContain("추출 완료");

      // 2. Trigger publish
      await fileActions.triggerAction("불변 게시");
      expect(pubCtrl.getActiveRelease()).not.toBeNull();
      expect(statusLog).toContain("게시 완료");

      // 3. Trigger backup
      downloaded = false;
      await fileActions.triggerAction("전체 백업");
      expect(downloaded).toBe(true);
      expect(statusLog).toContain("백업 완료");
    });

    it("UIShellView에서 publishController가 바인딩되고 런타임 게임 반영은 미검증으로 유지된다", async () => {
      const mockDoc = new MockDocument();
      const container = mockDoc.createElement("div");

      // Mock global window/document minimally for mountShell
      const origDoc = (globalThis as any).document;
      (globalThis as any).document = mockDoc;

      try {
        const shell = mountShell(container as any, {
          controller: projCtrl,
          document: baseDoc,
        });

        expect(shell.publishController).toBeDefined();

        // Trigger publish via fileActions
        await shell.fileActions.triggerAction("불변 게시");
        expect(shell.publishController?.getActiveRelease()).not.toBeNull();

        // Verification guard check: GAME_APPLY_VERIFIED must be false
        expect(shell.publishController?.isGameApplyVerified()).toBe(false);

        shell.unmount();
      } finally {
        (globalThis as any).document = origDoc;
      }
    });

    it("아티팩트 및 백업 재검사(re-inspect)를 통해 해시 변조 또는 외래 형식을 거부한다", async () => {
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        downloader: { download: (name: string) => name },
      });

      const expRes = await pubCtrl.exportArtifact();
      expect(expRes.ok).toBe(true);
      const validArtifact = expRes.artifact!;

      // Valid re-inspection
      const inspectRes = pubCtrl.reinspectArtifact(validArtifact);
      expect(inspectRes.ok).toBe(true);

      // Tampered artifact
      const tampered = structuredClone(validArtifact);
      tampered.pages.main_home.elements[0].name = "Tampered Element";
      const tamperedRes = pubCtrl.reinspectArtifact(tampered);
      expect(tamperedRes.ok).toBe(false);
      expect(tamperedRes.contentHashOk).toBe(false);

      // Foreign kind rejection
      const foreign = { ...validArtifact, kind: "dream-guardian-published-content-pack" };
      const foreignRes = pubCtrl.reinspectArtifact(foreign);
      expect(foreignRes.ok).toBe(false);
      expect(foreignRes.errors).toContain("FITNESS_PACK_REJECTED");

      const unknownKind = { ...validArtifact, kind: "some-unknown-format" };
      const unknownRes = pubCtrl.reinspectArtifact(unknownKind);
      expect(unknownRes.ok).toBe(false);
      expect(unknownRes.errors).toContain("UNSUPPORTED_KIND");
    });

    it("전체 백업 내보내기 및 복구(restore)가 라운드트립으로 온전하게 수행된다", async () => {
      let backupPayload = "";
      const downloader = {
        download: (name: string, content: string) => {
          backupPayload = content;
          return name;
        },
      };

      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        downloader,
      });

      const bakRes = await pubCtrl.exportFullBackup();
      expect(bakRes.ok).toBe(true);
      expect(bakRes.savedCount).toBe(1);
      expect(backupPayload.length).toBeGreaterThan(0);

      const parsedBackup = JSON.parse(backupPayload);
      const inspectRes = pubCtrl.reinspectBackup(parsedBackup);
      expect(inspectRes.ok).toBe(true);
      expect(inspectRes.contentHashOk).toBe(true);
      expect(inspectRes.backupHashOk).toBe(true);

      const restoreRes = pubCtrl.restoreBackup(parsedBackup);
      expect(restoreRes.ok).toBe(true);
      if (restoreRes.ok) {
        expect(restoreRes.document.pages.menu_main).toBeDefined();
      }
    });

    it("게시 확인 다이얼로그(confirm) 거부 시 게시가 중단되고 성공 카운트 0건을 반환한다", async () => {
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
        confirm: () => false, // User clicks Cancel on confirm dialog
      });

      const res = await pubCtrl.publishRelease();
      expect(res.ok).toBe(false);
      expect(res.savedCount).toBe(0);
      expect(res.reason).toBe("CANCELLED");
      expect(pubCtrl.getActiveRelease()).toBeNull();
    });

    it("게시 이력(history)에 성공 및 실패 내역이 올바르게 누적 관리된다", async () => {
      const pubCtrl = new UIVisualPublishController({
        projectId: "proj-pub-test",
        projectController: projCtrl,
        store,
      });

      // 1. Success
      const res1 = await pubCtrl.publishRelease();
      expect(res1.ok).toBe(true);

      // 2. Storage failure
      vi.spyOn(store, "saveRelease").mockRejectedValueOnce(new Error("IDB Error"));
      const res2 = await pubCtrl.publishRelease();
      expect(res2.ok).toBe(false);

      const history = pubCtrl.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].status).toBe("success");
      expect(history[1].status).toBe("failed");
      expect(history[1].error).toBe("IDB Error");
    });
  });
});
