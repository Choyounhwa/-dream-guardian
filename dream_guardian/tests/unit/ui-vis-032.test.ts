import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  mountArrangementView,
} from "../../src/editor/ui/view/UIArrangementView";
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
  undoVisual,
  redoVisual,
} from "../../src/editor/ui/UIEditorState";
import {
  type AlignDirection,
  type AlignReference,
} from "../../src/editor/ui/UIArrangement";

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

  public querySelector<T = MockDOMElement>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all.length > 0 ? all[0] : null;
  }

  public querySelectorAll<T = MockDOMElement>(selector: string): T[] {
    const results: MockDOMElement[] = [];
    const match = (el: MockDOMElement): boolean => {
      const attrMatch = selector.match(/^([a-zA-Z0-9_-]*)\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
      if (attrMatch) {
        const [, tag, attr, val] = attrMatch;
        if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        if (val !== undefined) {
          return el.getAttribute(attr) === val;
        }
        return el.getAttribute(attr) !== null;
      }

      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        return el.className.split(/\s+/).includes(cls);
      }

      if (selector.startsWith("#")) {
        const id = selector.slice(1);
        return el.getAttribute("id") === id;
      }

      return el.tagName.toLowerCase() === selector.toLowerCase();
    };

    const traverse = (current: any) => {
      for (const child of current.children) {
        if (match(child)) results.push(child as any);
        traverse(child);
      }
    };
    traverse(this);
    return results as unknown as T[];
  }
}

class MockEvent {
  public type: string;
  public bubbles = false;
  public target: any = null;
  public currentTarget: any = null;
  public _propagationStopped = false;
  public defaultPrevented = false;

  constructor(type: string, options?: { bubbles?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
  }

  public stopPropagation(): void {
    this._propagationStopped = true;
  }

  public preventDefault(): void {
    this.defaultPrevented = true;
  }
}

function q(parent: any, selector: string): any {
  return parent.querySelector(selector);
}

function createMockEnvironment() {
  const doc: any = {
    createElement(tag: string) {
      const el = new MockDOMElement(tag, doc);
      if (tag.toLowerCase() === "iframe") {
        el.contentWindow = {
          postMessage: vi.fn(),
          location: { origin: "http://localhost:3000" },
        };
      }
      return el;
    },
  };
  const body = new MockDOMElement("body", doc);
  doc.body = body;

  const winListeners: Record<string, ((e: any) => void)[]> = {};
  const win: any = {
    location: { origin: "http://localhost:3000" },
    document: doc,
    addEventListener(type: string, listener: (e: any) => void) {
      if (!winListeners[type]) winListeners[type] = [];
      winListeners[type].push(listener);
    },
    removeEventListener(type: string, listener: (e: any) => void) {
      if (!winListeners[type]) return;
      winListeners[type] = winListeners[type].filter((l) => l !== listener);
    },
  };

  return { doc, win, body };
}

describe("[Issue #462 / UI-VIS-032] 6방향 정렬·기준 선택·묶음 이동 도구", () => {
  let origDoc: any;
  let origWin: any;
  let container: MockDOMElement;
  let testDoc: UIVisualDocument;

  beforeEach(() => {
    origDoc = (globalThis as any).document;
    origWin = (globalThis as any).window;
    const { doc, win, body } = createMockEnvironment();
    (globalThis as any).document = doc;
    (globalThis as any).window = win;
    container = doc.createElement("div");
    body.appendChild(container);

    testDoc = createDefaultUIVisualDocument();
  });

  afterEach(() => {
    (globalThis as any).document = origDoc;
    (globalThis as any).window = origWin;
  });

  describe("1. 6방향 정렬 툴바 및 3기준(reference) UI 컨트롤 구성", () => {
    it("좌(left), 가로중앙(hcenter), 우(right), 상(top), 세로중앙(vcenter), 하(bottom) 6개 정렬 버튼이 렌더링되어야 한다", () => {
      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
      });

      const alignDirections: AlignDirection[] = ["left", "hcenter", "right", "top", "vcenter", "bottom"];
      for (const dir of alignDirections) {
        const btn = q(view.root, `button[data-align="${dir}"]`);
        expect(btn, `Button for ${dir} should exist`).toBeTruthy();
      }
    });

    it("selection, artboard, key-object 3가지 기준(reference) 선택 컨트롤이 제공되어야 한다", () => {
      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        reference: "selection",
      });

      const refSelector = q(view.root, '[data-control="align-reference"]');
      expect(refSelector).toBeTruthy();

      // select 옵션 또는 버튼 그룹으로 3가지 기준이 포함되어 있는지 확인
      const optSelection = q(view.root, '[data-ref="selection"]');
      const optArtboard = q(view.root, '[data-ref="artboard"]');
      const optKeyObject = q(view.root, '[data-ref="key-object"]');

      expect(optSelection).toBeTruthy();
      expect(optArtboard).toBeTruthy();
      expect(optKeyObject).toBeTruthy();
    });

    it("기준(reference) 변경 시 내부 상태가 갱신되어야 한다", () => {
      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
      });

      expect(view.getState().reference).toBe("selection");
      view.setReference("artboard");
      expect(view.getState().reference).toBe("artboard");
      view.setReference("key-object");
      expect(view.getState().reference).toBe("key-object");
    });
  });

  describe("2. 18가지 조합 (6방향 × 3기준) UI → UIArrangement 모델 인자 바인딩", () => {
    const directions: AlignDirection[] = ["left", "hcenter", "right", "top", "vcenter", "bottom"];
    const references: AlignReference[] = ["selection", "artboard", "key-object"];

    it("18가지 (6방향 × 3기준) 조합에서 align 메서드가 정상 호출되고 정확한 인자로 계산되어야 한다", () => {
      const session = createVisualSession(testDoc, "menu_main", "sess-18combos");
      const pageElements = testDoc.pages["menu_main"].elements;
      const elA = pageElements[0];
      const elB = pageElements[1];

      const onAlignSpy = vi.fn();
      const view = mountArrangementView(container as any, {
        document: testDoc,
        session,
        activePageId: "menu_main",
        selectedIds: [elA.id, elB.id],
        keyObjectId: elA.id,
        onAlign: onAlignSpy,
      });

      let comboCount = 0;
      for (const ref of references) {
        view.setReference(ref);
        for (const dir of directions) {
          comboCount++;
          const result = view.align(dir, ref);
          expect(result.ok, `Combo ${dir} + ${ref} should succeed`).toBe(true);
          if (result.ok) {
            expect(result.elements.length).toBe(2);
          }
        }
      }
      expect(comboCount).toBe(18);
    });

    it("버튼 클릭 이벤트로도 6방향 정렬이 정확히 발화되어야 한다", () => {
      const pageElements = testDoc.pages["menu_main"].elements;
      const elA = pageElements[0];
      const elB = pageElements[1];

      const onAlignSpy = vi.fn();
      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedIds: [elA.id, elB.id],
        reference: "artboard",
        onAlign: onAlignSpy,
      });

      const leftBtn = q(view.root, 'button[data-align="left"]');
      expect(leftBtn).toBeTruthy();
      leftBtn.dispatchEvent(new MockEvent("click"));

      expect(onAlignSpy).toHaveBeenCalledTimes(1);
      const [result, cmd] = onAlignSpy.mock.calls[0];
      expect(result.ok).toBe(true);
      expect(cmd.alignment).toBe("left");
    });
  });

  describe("3. 키 객체(Key Object) 강조 및 식별 설명 표시", () => {
    it("key-object 기준 선택 시 키 객체 식별 설명과 강조 요소가 UI 상에 명시되어야 한다", () => {
      const pageElements = testDoc.pages["menu_main"].elements;
      const keyEl = pageElements[0];

      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedIds: [keyEl.id, pageElements[1].id],
        keyObjectId: keyEl.id,
        reference: "key-object",
      });

      const keyIndicator = q(view.root, '[data-role="key-object-indicator"]');
      expect(keyIndicator).toBeTruthy();
      expect(keyIndicator.textContent).toContain(keyEl.name || keyEl.id);

      // 키 객체 식별 속성 확인
      expect(keyIndicator.getAttribute("data-key-object-id")).toBe(keyEl.id);
    });

    it("키 객체가 선택 목록에 없는 경우 원자적으로 거부(key-object-not-found)되어야 한다", () => {
      const pageElements = testDoc.pages["menu_main"].elements;
      const onRejectSpy = vi.fn();

      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
        selectedIds: [pageElements[0].id],
        keyObjectId: "non-existent-id",
        reference: "key-object",
        onReject: onRejectSpy,
      });

      const result = view.align("hcenter", "key-object");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("key-object-not-found");
      }
      expect(onRejectSpy).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "key-object-not-found" })
      );
    });
  });

  describe("4. 개별 정렬(Individual) vs 묶음 전체(Group / En-bloc) 정렬 분리 및 상대 offset 보존", () => {
    it("개별 정렬과 묶음 정렬을 명확히 분리하는 모드 선택 또는 버튼과 설명 문구를 제공해야 한다", () => {
      const view = mountArrangementView(container as any, {
        document: testDoc,
        activePageId: "menu_main",
      });

      const modeControl = q(view.root, '[data-control="align-mode"]');
      expect(modeControl).toBeTruthy();

      const individualOption = q(view.root, '[data-mode="individual"]');
      const groupOption = q(view.root, '[data-mode="group"]');
      expect(individualOption).toBeTruthy();
      expect(groupOption).toBeTruthy();

      const modeHelp = q(view.root, '[data-role="mode-description"]');
      expect(modeHelp).toBeTruthy();
      expect(modeHelp.textContent.length).toBeGreaterThan(0);
    });

    it("묶음 정렬(Group Align) 시 자식 간 상대 offset(상대 거리)이 100% 불변 보존되어야 한다", () => {
      // 이미지(hero)와 텍스트(title) 생성 및 그룹 설정
      const elImage: UIVisualElement = {
        id: "hero-img",
        name: "히어로 이미지",
        type: "image",
        bounds: { x: 100, y: 200, width: 200, height: 100 },
      };
      const elText: UIVisualElement = {
        id: "title-txt",
        name: "타이틀 텍스트",
        type: "text",
        bounds: { x: 150, y: 350, width: 100, height: 50 },
      };

      testDoc.pages["menu_main"].elements = [elImage, elText];
      const session = createVisualSession(testDoc, "menu_main", "sess-group-offset");

      const initialDiffX = elText.bounds.x - elImage.bounds.x; // 150 - 100 = 50
      const initialDiffY = elText.bounds.y - elImage.bounds.y; // 350 - 200 = 150

      const view = mountArrangementView(container as any, {
        document: testDoc,
        session,
        activePageId: "menu_main",
        selectedIds: ["hero-img", "title-txt"],
        reference: "artboard",
        mode: "group",
      });

      // 아트보드 가로중앙(hcenter) 묶음 정렬 실행
      const result = view.align("hcenter", "artboard", "group");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const updatedImage = result.elements.find((e) => e.id === "hero-img")!;
        const updatedText = result.elements.find((e) => e.id === "title-txt")!;

        const postDiffX = updatedText.bounds.x - updatedImage.bounds.x;
        const postDiffY = updatedText.bounds.y - updatedImage.bounds.y;

        // 상대 offset이 100% 보존되어야 함
        expect(postDiffX).toBe(initialDiffX);
        expect(postDiffY).toBe(initialDiffY);
      }
    });

    it("개별 정렬(Individual Align) 시에는 각 요소가 독립적으로 정렬되어 상대 offset이 재배치되어야 한다", () => {
      const elImage: UIVisualElement = {
        id: "hero-img",
        name: "히어로 이미지",
        type: "image",
        bounds: { x: 100, y: 200, width: 200, height: 100 },
      };
      const elText: UIVisualElement = {
        id: "title-txt",
        name: "타이틀 텍스트",
        type: "text",
        bounds: { x: 150, y: 350, width: 100, height: 50 },
      };

      testDoc.pages["menu_main"].elements = [elImage, elText];
      const session = createVisualSession(testDoc, "menu_main", "sess-indiv");

      const view = mountArrangementView(container as any, {
        document: testDoc,
        session,
        activePageId: "menu_main",
        selectedIds: ["hero-img", "title-txt"],
        reference: "artboard",
        mode: "individual",
      });

      const result = view.align("hcenter", "artboard", "individual");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const updatedImage = result.elements.find((e) => e.id === "hero-img")!;
        const updatedText = result.elements.find((e) => e.id === "title-txt")!;

        // 아트보드 중앙 = 1080 / 2 = 540
        // 이미지 x = 540 - 200 / 2 = 440
        // 텍스트 x = 540 - 100 / 2 = 490
        expect(updatedImage.bounds.x).toBe(440);
        expect(updatedText.bounds.x).toBe(490);
        // 상대 offset은 490 - 440 = 50 (너비 차이로 인한 개별 중앙 정렬)
      }
    });
  });

  describe("5. Undo 1회로 원본 좌표 완전 복원", () => {
    it("다중 요소 묶음 정렬 후 단 1회의 Undo 호출로 모든 요소가 원본 좌표로 복원되어야 한다", () => {
      const elImage: UIVisualElement = {
        id: "hero-img",
        name: "히어로 이미지",
        type: "image",
        bounds: { x: 100, y: 200, width: 200, height: 100 },
      };
      const elText: UIVisualElement = {
        id: "title-txt",
        name: "타이틀 텍스트",
        type: "text",
        bounds: { x: 150, y: 350, width: 100, height: 50 },
      };

      testDoc.pages["menu_main"].elements = [elImage, elText];
      let session = createVisualSession(testDoc, "menu_main", "sess-undo-test");

      const view = mountArrangementView(container as any, {
        document: testDoc,
        session,
        activePageId: "menu_main",
        selectedIds: ["hero-img", "title-txt"],
        reference: "artboard",
        mode: "group",
        onSessionChange: (nextSession) => {
          session = nextSession;
        },
      });

      // 묶음 정렬 실행
      view.align("hcenter", "artboard", "group");

      const currDoc = session.present;
      const movedImage = currDoc.pages["menu_main"].elements.find((e) => e.id === "hero-img")!;
      const movedText = currDoc.pages["menu_main"].elements.find((e) => e.id === "title-txt")!;
      expect(movedImage.bounds.x).not.toBe(100);
      expect(movedText.bounds.x).not.toBe(150);

      // Undo 1회 실행
      session = undoVisual(session);

      const restoredDoc = session.present;
      const restoredImage = restoredDoc.pages["menu_main"].elements.find((e) => e.id === "hero-img")!;
      const restoredText = restoredDoc.pages["menu_main"].elements.find((e) => e.id === "title-txt")!;

      expect(restoredImage.bounds.x).toBe(100);
      expect(restoredImage.bounds.y).toBe(200);
      expect(restoredText.bounds.x).toBe(150);
      expect(restoredText.bounds.y).toBe(350);

      // Redo 1회 실행 시 다시 정렬 위치로 복원
      session = redoVisual(session);
      const redoneImage = session.present.pages["menu_main"].elements.find((e) => e.id === "hero-img")!;
      expect(redoneImage.bounds.x).toBe(movedImage.bounds.x);
    });
  });

  describe("6. 잠긴 요소(isLocked) 선택 시 원자적 거부(0건 변경) 및 lockReason 통지", () => {
    it("잠긴 요소가 포함된 경우 정렬 조작이 0건 변경으로 거부되고 lockReason이 통지되어야 한다", () => {
      const elImage: UIVisualElement = {
        id: "hero-img",
        name: "히어로 이미지",
        type: "image",
        bounds: { x: 100, y: 200, width: 200, height: 100 },
        isLocked: true,
        lockReason: "배경 템플릿 잠금",
      };
      const elText: UIVisualElement = {
        id: "title-txt",
        name: "타이틀 텍스트",
        type: "text",
        bounds: { x: 150, y: 350, width: 100, height: 50 },
      };

      testDoc.pages["menu_main"].elements = [elImage, elText];
      let session = createVisualSession(testDoc, "menu_main", "sess-locked");

      const onRejectSpy = vi.fn();
      const onStatusSpy = vi.fn();

      const view = mountArrangementView(container as any, {
        document: testDoc,
        session,
        activePageId: "menu_main",
        selectedIds: ["hero-img", "title-txt"],
        reference: "artboard",
        onReject: onRejectSpy,
        onStatus: onStatusSpy,
      });

      const result = view.align("left", "artboard");

      // 1. 원자적 거부 확인
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("locked-element");
        expect(result.message).toContain("배경 템플릿 잠금");
        expect(result.violatedElementId).toBe("hero-img");
      }

      // 2. 문서 및 세션 변경 0건 보존
      expect(session.present.pages["menu_main"].elements[0].bounds.x).toBe(100);
      expect(session.present.pages["menu_main"].elements[1].bounds.x).toBe(150);
      expect(session.undo.length).toBe(0);

      // 3. 콜백 및 UI 알림 통지 확인
      expect(onRejectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "locked-element",
          violatedElementId: "hero-img",
        })
      );
      expect(onStatusSpy).toHaveBeenCalledWith(expect.stringContaining("배경 템플릿 잠금"));

      const lockNotice = q(view.root, '[data-role="lock-notice"]');
      expect(lockNotice).toBeTruthy();
      expect(lockNotice.textContent).toContain("배경 템플릿 잠금");
    });
  });

  describe("7. UIShellView 연동 및 셸 통합 검증", () => {
    it("mountShell 호출 시 arrangementView가 함께 초기화되고 노출되어야 한다", () => {
      const session = createVisualSession(testDoc, "menu_main", "sess-shell");
      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      expect(shell.arrangementView).toBeTruthy();
      expect(typeof shell.arrangementView.align).toBe("function");

      const arrangementToolbar = q(shell.root, '[data-panel="arrangement"]');
      expect(arrangementToolbar).toBeTruthy();

      const leftBtn = q(arrangementToolbar, 'button[data-align="left"]');
      expect(leftBtn).toBeTruthy();
    });

    it("UIShellView에서 정렬 실행 시 session과 프리뷰가 실시간 갱신되어야 한다", () => {
      const onDocChangeSpy = vi.fn();
      const session = createVisualSession(testDoc, "menu_main", "sess-shell-align");
      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        onDocumentChange: onDocChangeSpy,
      });

      const elements = testDoc.pages["menu_main"].elements;
      shell.arrangementView.setSelection([elements[0].id, elements[1].id]);
      shell.arrangementView.setReference("artboard");

      // 우측 정렬 실행
      const result = shell.arrangementView.align("right", "artboard");
      expect(result.ok).toBe(true);

      // onDocumentChange 호출 및 세션 갱신 검증
      expect(onDocChangeSpy).toHaveBeenCalled();
    });
  });
});
