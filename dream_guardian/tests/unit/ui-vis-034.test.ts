import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  mountVisualAssetView,
} from "../../src/editor/ui/view/UIVisualAssetView";
import {
  UIAssetPreviewCache,
  validatePreviewBridgeOrigin,
  filterSafeAssetBridgePayload,
} from "../../src/editor/ui/preview/styles/UIAssetPreview";
import {
  mountShell,
} from "../../src/editor/ui/view/UIShellView";
import {
  createDefaultUIVisualDocument,
  type UIVisualDocument,
  type UIVisualElement,
} from "../../src/editor/ui/data/UIVisualDocument";
import {
  createVisualSession,
  executeVisualCommand,
  undoVisual,
} from "../../src/editor/ui/UIEditorState";
import {
  UIResourceCatalog,
} from "../../src/editor/ui/data/UIResourceCatalog";
import {
  createInMemoryIDBFactory,
  UIVisualIndexedDB,
} from "../../src/editor/ui/storage/UIVisualIndexedDB";
import {
  UIVisualStore,
} from "../../src/editor/ui/storage/UIVisualStore";
import type { VisualSetPropCommand } from "../../src/editor/ui/UICommands";

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

  public dispatchEvent(event: any): boolean {
    event.target = this;
    if (!event.currentTarget) event.currentTarget = this;
    const list = this.listeners[event.type] || [];
    for (const listener of list) {
      listener(event);
    }
    if (event.bubbles && this.parentNode && !event._propagationStopped) {
      this.parentNode.dispatchEvent(event);
    }
    return true;
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

function q(root: any, selector: string): MockDOMElement | null {
  return root.querySelector(selector);
}

function qAll(root: any, selector: string): MockDOMElement[] {
  return root.querySelectorAll(selector);
}

function createPngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0D], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  bytes[24] = 8;
  bytes[25] = 6;
  bytes[26] = 0;
  bytes[27] = 0;
  bytes[28] = 0;
  view.setUint32(29, 0x12345678, false);
  return bytes;
}

describe("[#465 UI-VIS-034] 이미지 선택·가져오기·교체 UI와 preview 캐시", () => {
  let doc: MockDocument;
  let container: MockDOMElement;
  let testDoc: UIVisualDocument;
  let testImageElement: UIVisualElement;
  let catalog: UIResourceCatalog;
  let idbFactory: IDBFactory;
  let store: UIVisualStore;
  let createdUrls: string[];
  let revokedUrls: string[];

  beforeEach(async () => {
    doc = new MockDocument();
    container = doc.createElement("div");

    createdUrls = [];
    revokedUrls = [];

    // Mock document
    (globalThis as any).document = doc;

    testDoc = createDefaultUIVisualDocument();
    // Ensure menu_main has an image element
    const page = testDoc.pages["menu_main"];
    testImageElement = {
      id: "el-image-hero",
      name: "히어로 패널 이미지",
      type: "image",
      bounds: { x: 100, y: 200, width: 400, height: 300 },
      assetId: "image-ui-panel",
    };
    page.elements.push(testImageElement);

    catalog = new UIResourceCatalog();
    idbFactory = createInMemoryIDBFactory();
    const dbHelper = new UIVisualIndexedDB({ factory: idbFactory });
    store = new UIVisualStore(dbHelper);
    await store.open();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createMockPreviewCache() {
    return new UIAssetPreviewCache({
      createObjectURL: () => {
        const url = `blob:dg-preview-${Math.random().toString(36).slice(2, 9)}`;
        createdUrls.push(url);
        return url;
      },
      revokeObjectURL: (url: string) => {
        revokedUrls.push(url);
      },
      imageDecoder: async () => {
        return { width: 400, height: 300 };
      },
    });
  }

  describe("1. UIVisualAssetView UI 렌더링 및 카탈로그 검색/선택", () => {
    it("선택된 이미지 요소의 에셋 정보, 썸네일, 카탈로그 및 액션 버튼들이 렌더링된다", () => {
      const cache = createMockPreviewCache();
      const assetView = mountVisualAssetView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedElementId: testImageElement.id,
        catalog,
        store,
        previewCache: cache,
      });

      expect(assetView.root).toBeTruthy();
      expect(assetView.root.getAttribute("data-view")).toBe("visual-asset-view");

      // 썸네일, 이름, 치수, ID 표시
      const thumb = q(assetView.root, '[data-role="thumbnail"]');
      expect(thumb).toBeTruthy();

      const nameEl = q(assetView.root, '[data-role="asset-name"]');
      expect(nameEl).toBeTruthy();

      const idEl = q(assetView.root, '[data-role="asset-id"]');
      expect(idEl).toBeTruthy();
      expect(idEl!.textContent).toContain("image-ui-panel");

      const searchInput = q(assetView.root, '[data-role="catalog-search"]');
      expect(searchInput).toBeTruthy();

      const catalogList = q(assetView.root, '[data-role="catalog-list"]');
      expect(catalogList).toBeTruthy();

      const importBtn = q(assetView.root, '[data-action="import-asset"]');
      expect(importBtn).toBeTruthy();

      const replaceBtn = q(assetView.root, '[data-action="replace-asset"]');
      expect(replaceBtn).toBeTruthy();

      assetView.dispose();
    });

    it("카탈로그 검색어 입력 시 에셋 목록이 필터링되고, 아이템 선택 시 assetId가 변경된다", async () => {
      const cache = createMockPreviewCache();
      const onCommitSpy = vi.fn();

      // 카탈로그에 교체용 새 에셋 등록
      catalog.registerLocalAsset({
        id: "image-ui-hero-card",
        name: "히어로 카드",
        kind: "image",
        format: "png",
        mimeType: "image/png",
        hash: "c".repeat(64),
        byteLength: 2048,
        width: 300,
        height: 200,
        aspectRatio: 1.5,
        createdAt: Date.now(),
      });

      const assetView = mountVisualAssetView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedElementId: testImageElement.id,
        catalog,
        store,
        previewCache: cache,
        onVisualCommit: onCommitSpy,
      });

      const searchInput = q(assetView.root, '[data-role="catalog-search"]');
      expect(searchInput).toBeTruthy();

      // 검색어 "hero" 입력
      searchInput!.value = "hero";
      searchInput!.dispatchEvent(new MockEvent("input"));

      const items = qAll(assetView.root, '[data-role="catalog-item"]');
      expect(items.length).toBeGreaterThan(0);

      // 카탈로그 아이템 클릭
      const itemBtn = q(items[0], 'button[data-action="select-item"]');
      expect(itemBtn).toBeTruthy();
      itemBtn!.click();

      // 커밋 호출 확인
      expect(onCommitSpy).toHaveBeenCalled();
      const cmd = onCommitSpy.mock.calls[0][0] as VisualSetPropCommand;
      expect(cmd.type).toBe("set-element-prop");
      expect(cmd.prop).toBe("assetId");
      expect(cmd.pageId).toBe("menu_main");
      expect(cmd.elementId).toBe(testImageElement.id);
      expect(cmd.after).toBe("image-ui-hero-card");

      assetView.dispose();
    });
  });

  describe("2. 로컬 파일 가져오기 및 모델 검증 / 영속 저장소 연계", () => {
    it("정상 PNG 파일을 가져오면 바이너리 검증 후 카탈로그/IndexedDB에 등록되고 assetId prop 명령이 전달된다", async () => {
      const cache = createMockPreviewCache();
      const onCommitSpy = vi.fn();

      const assetView = mountVisualAssetView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedElementId: testImageElement.id,
        catalog,
        store,
        previewCache: cache,
        onVisualCommit: onCommitSpy,
      });

      const pngBytes = createPngBytes(512, 512);
      const importResult = await assetView.importAssetFile({
        name: "test-hero.png",
        bytes: pngBytes,
        mimeType: "image/png",
      });

      expect(importResult.ok).toBe(true);
      if (importResult.ok) {
        expect(importResult.asset.width).toBe(512);
        expect(importResult.asset.height).toBe(512);
        expect(catalog.hasAsset(importResult.asset.id)).toBe(true);

        // UIVisualStore 저장 확인
        const stored = await store.getAsset(importResult.asset.id);
        expect(stored).not.toBeNull();
        expect(stored!.assetId).toBe(importResult.asset.id);
      }

      // VisualSetPropCommand 전달 확인
      expect(onCommitSpy).toHaveBeenCalled();
      const cmd = onCommitSpy.mock.calls[0][0] as VisualSetPropCommand;
      expect(cmd.type).toBe("set-element-prop");
      expect(cmd.prop).toBe("assetId");
      expect(cmd.elementId).toBe(testImageElement.id);

      assetView.dispose();
    });

    it("손상된 이미지, 용량 초과(10MB), 취소 시 기존 assetId와 문서 상태를 100% 보존하고 에러 메시지를 표시한다", async () => {
      const cache = createMockPreviewCache();
      const onCommitSpy = vi.fn();

      const assetView = mountVisualAssetView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedElementId: testImageElement.id,
        catalog,
        store,
        previewCache: cache,
        onVisualCommit: onCommitSpy,
      });

      const initialAssetId = testImageElement.assetId;

      // 1. 손상된 바이트
      const corruptedBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
      const resultCorrupt = await assetView.importAssetFile({
        name: "corrupted.png",
        bytes: corruptedBytes,
        mimeType: "image/png",
      });
      expect(resultCorrupt.ok).toBe(false);

      const errorEl = q(assetView.root, '[data-role="error-message"]');
      expect(errorEl).toBeTruthy();
      expect(errorEl!.textContent).toBeTruthy();
      expect(onCommitSpy).not.toHaveBeenCalled();

      // 2. 용량 초과 (11MB)
      const oversizedBytes = new Uint8Array(11 * 1024 * 1024);
      const resultOversize = await assetView.importAssetFile({
        name: "oversized.png",
        bytes: oversizedBytes,
        mimeType: "image/png",
      });
      expect(resultOversize.ok).toBe(false);
      expect(onCommitSpy).not.toHaveBeenCalled();

      // 3. 취소 (cancel)
      assetView.cancelImport();
      expect(onCommitSpy).not.toHaveBeenCalled();

      // 기존 assetId 보존 확인
      const idEl = q(assetView.root, '[data-role="asset-id"]');
      expect(idEl!.textContent).toContain(initialAssetId);

      assetView.dispose();
    });
  });

  describe("3. UIAssetPreviewCache - blob URL 및 디코드 수명 주기 / 누수 방지", () => {
    it("동일 에셋에 대해 중복 blob URL 생성을 방지하고 캐시된 URL을 재사용한다", async () => {
      const cache = createMockPreviewCache();
      const pngBytes = createPngBytes(128, 128);

      const assetRecord = {
        id: "asset-cache-1",
        name: "test.png",
        kind: "image" as const,
        bytes: pngBytes,
        mimeType: "image/png",
        width: 128,
        height: 128,
      };

      const url1 = await cache.resolveAssetUrl(assetRecord);
      const url2 = await cache.resolveAssetUrl(assetRecord);

      expect(url1).toBe(url2);
      expect(createdUrls.length).toBe(1); // 중복 생성 0건
      expect(cache.activeUrlCount).toBe(1);

      cache.clear();
      expect(revokedUrls.length).toBe(1);
      expect(cache.activeUrlCount).toBe(0);
    });

    it("releaseAsset 및 clear 호출 시 revokeObjectURL이 정확히 호출되어 URL 누수가 0이다", async () => {
      const cache = createMockPreviewCache();
      const pngBytes1 = createPngBytes(64, 64);
      const pngBytes2 = createPngBytes(64, 64);

      const a1 = { id: "a1", bytes: pngBytes1, mimeType: "image/png" };
      const a2 = { id: "a2", bytes: pngBytes2, mimeType: "image/png" };

      const u1 = await cache.resolveAssetUrl(a1);
      const u2 = await cache.resolveAssetUrl(a2);

      expect(createdUrls.length).toBe(2);
      expect(cache.activeUrlCount).toBe(2);

      // a1 단일 해제
      const released1 = cache.releaseAsset("a1");
      expect(released1).toBe(true);
      expect(revokedUrls).toContain(u1);
      expect(cache.activeUrlCount).toBe(1);

      // 전체 정리
      cache.clear();
      expect(revokedUrls).toContain(u2);
      expect(cache.activeUrlCount).toBe(0);
    });

    it("출처(origin) 검증 및 위험 URL 메시지 거부", () => {
      // 1. 유효 origin
      expect(validatePreviewBridgeOrigin("http://localhost:3000", ["http://localhost:3000"])).toBe(true);
      // 2. 와일드카드 또는 허용되지 않은 origin 거부
      expect(validatePreviewBridgeOrigin("*", ["http://localhost:3000"])).toBe(false);
      expect(validatePreviewBridgeOrigin("http://malicious.com", ["http://localhost:3000"])).toBe(false);

      // 3. 브리지 페이로드 필터링: 임의 URL이나 스크립트 실행 거부
      const safePayload = filterSafeAssetBridgePayload({
        assetId: "valid-asset",
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        width: 100,
        height: 100,
        dangerousScript: "alert(1)",
        externalUrl: "http://evil.com/leak.png",
      });

      expect(safePayload.assetId).toBe("valid-asset");
      expect(safePayload.width).toBe(100);
      expect((safePayload as any).dangerousScript).toBeUndefined();
      expect((safePayload as any).externalUrl).toBeUndefined();
    });
  });

  describe("4. Undo/Redo 시 에셋 뷰 동기화 및 영속 바이너리 보존", () => {
    it("에셋 교체 후 Undo 시 이전 에셋 정보로 즉각 복원되며 영속 저장소의 바이너리는 보존된다", async () => {
      let session = createVisualSession(testDoc, "menu_main", "sess-asset-undo");
      const cache = createMockPreviewCache();

      const assetView = mountVisualAssetView(container as any, {
        session,
        document: session.present,
        activePageId: "menu_main",
        selectedElementId: testImageElement.id,
        catalog,
        store,
        previewCache: cache,
        onVisualCommit: (cmd) => {
          session = executeVisualCommand(session, cmd);
          assetView.updateDocument(session.present, "menu_main");
        },
      });

      // 1. 새 이미지 에셋 등록
      const pngBytes = createPngBytes(320, 240);
      const importRes = await assetView.importAssetFile({
        name: "new-hero.png",
        bytes: pngBytes,
        mimeType: "image/png",
      });
      expect(importRes.ok).toBe(true);

      const newAssetId = (importRes as any).asset.id;
      expect(session.present.pages["menu_main"].elements.find(e => e.id === testImageElement.id)?.assetId).toBe(newAssetId);

      // 2. Undo 실행
      session = undoVisual(session);
      assetView.updateDocument(session.present, "menu_main");

      const undoneElement = session.present.pages["menu_main"].elements.find(e => e.id === testImageElement.id);
      expect(undoneElement?.assetId).toBe("image-ui-panel");

      // UI 표시도 이전 에셋 id 로 갱신
      const idEl = q(assetView.root, '[data-role="asset-id"]');
      expect(idEl!.textContent).toContain("image-ui-panel");

      // 영속 저장소에는 새 에셋 바이트가 여전히 남아있어야 함 (Redo용)
      const stored = await store.getAsset(newAssetId);
      expect(stored).not.toBeNull();

      assetView.dispose();
    });
  });

  describe("5. UIShellView 연동 및 셸 통합 검증", () => {
    it("mountShell 호출 시 assetView가 함께 마운트되어 노출되고 선택된 요소의 에셋이 연동된다", () => {
      const session = createVisualSession(testDoc, "menu_main", "sess-shell-asset");
      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      expect(shell.assetView).toBeTruthy();
      expect(typeof shell.assetView.setSelectedElement).toBe("function");

      // 이미지 요소 선택
      shell.selectElement(testImageElement.id);
      expect(shell.assetView.root).toBeTruthy();

      const assetIdText = q(shell.assetView.root, '[data-role="asset-id"]');
      expect(assetIdText).toBeTruthy();
      expect(assetIdText!.textContent).toContain("image-ui-panel");

      shell.dispose();
    });

    it("UIShellView 셸 dispose 시 assetView 및 preview 캐시가 정리된다", () => {
      const session = createVisualSession(testDoc, "menu_main", "sess-shell-dispose");
      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      expect(shell.assetView).toBeTruthy();
      shell.dispose();
      // dispose 후 에러 없이 정리 확인
    });
  });
});
