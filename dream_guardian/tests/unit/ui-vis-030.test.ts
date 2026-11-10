import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  mountShell,
} from "../../src/editor/ui/view/UIShellView";
import {
  isInputElement,
  attachExportController,
  type ShellState,
} from "../../src/editor/ui/UIEditorShell";
import {
  createDefaultUIVisualDocument,
  type UIVisualDocument,
  type UIVisualElement,
} from "../../src/editor/ui/data/UIVisualDocument";
import {
  createVisualSession,
} from "../../src/editor/ui/UIEditorState";
import { PREVIEW_SOURCE } from "../../src/editor/ui/UIPreviewHost";

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
      delete this.dataset[name.slice(5)];
    }
  }

  public hasAttribute(name: string): boolean {
    return name in this.attributes;
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

  public focus(): void {
    this.dispatchEvent(new MockEvent("focus"));
  }

  public blur(): void {
    this.dispatchEvent(new MockEvent("blur"));
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
        return el.hasAttribute(attr);
      }
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        return el.className.split(/\s+/).includes(cls);
      }
      if (el.tagName.toLowerCase() === selector.toLowerCase()) {
        return true;
      }
      return false;
    };

    const traverse = (node: MockDOMElement) => {
      for (const child of node.children) {
        if (match(child)) results.push(child);
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

class MockKeyboardEvent extends MockEvent {
  public key: string;
  constructor(type: string, options: { key: string; bubbles?: boolean }) {
    super(type, options);
    this.key = options.key;
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
    dispatchEvent(event: any) {
      const list = winListeners[event.type] || [];
      for (const l of list) l(event);
      return true;
    },
  };

  return { doc, win, body };
}

describe("[Issue #460 / UI-VIS-030] 선택·숫자 검사기·문서 양방향 DOM 연결", () => {
  let mockEnv: ReturnType<typeof createMockEnvironment>;
  let container: MockDOMElement;
  let testDoc: UIVisualDocument;
  let origDoc: any;
  let origWin: any;

  beforeEach(() => {
    origDoc = (globalThis as any).document;
    origWin = (globalThis as any).window;

    mockEnv = createMockEnvironment();
    (globalThis as any).document = mockEnv.doc;
    (globalThis as any).window = mockEnv.win;
    (globalThis as any).Event = MockEvent;
    (globalThis as any).KeyboardEvent = MockKeyboardEvent;

    container = mockEnv.doc.createElement("div");
    mockEnv.body.appendChild(container);

    testDoc = createDefaultUIVisualDocument();
    // Add custom text, image, and locked elements to result and boss_climax pages
    const resultTitle: UIVisualElement = {
      id: "result-title-text",
      name: "결과 타이틀 문구",
      type: "text",
      bounds: { x: 150, y: 180, width: 780, height: 80 },
      text: "수호신 최종 승리!",
      fontSize: 42,
    };
    const resultBadgeImg: UIVisualElement = {
      id: "result-badge-image",
      name: "승리 뱃지 이미지",
      type: "image",
      bounds: { x: 400, y: 350, width: 280, height: 280 },
      assetId: "badge_victory_gold",
    };
    const lockedHeader: UIVisualElement = {
      id: "hud-locked-system",
      name: "보호된 시스템 코어",
      type: "container",
      bounds: { x: 0, y: 0, width: 1080, height: 90 },
      isLocked: true,
      lockReason: "protected-core-system",
    };

    testDoc.pages.result.elements.push(resultTitle, resultBadgeImg);
    testDoc.pages.boss_climax.elements.push(lockedHeader);
  });

  afterEach(() => {
    (globalThis as any).document = origDoc;
    (globalThis as any).window = origWin;
  });

  describe("1. 10페이지 및 요소 선택 동기화 & 최신 속성 폼 로드", () => {
    it("페이지 전환 시 요소 목록 갱신 및 선택 요소의 숫자·이름·문구·글자크기·이미지 로드", () => {
      const session = createVisualSession(testDoc, "menu_main", "test-sess-1");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      // 1. 초기 menu_main 첫 번째 요소 속성 확인
      const xInput = q(shell.root, 'input[data-field="x"]');
      const yInput = q(shell.root, 'input[data-field="y"]');
      const widthInput = q(shell.root, 'input[data-field="width"]');
      const heightInput = q(shell.root, 'input[data-field="height"]');
      expect(xInput).toBeTruthy();
      expect(xInput?.value).toBe("90");
      expect(yInput?.value).toBe("350");
      expect(widthInput?.value).toBe("420");
      expect(heightInput?.value).toBe("260");

      // 2. 10페이지 중 result 화면으로 전환
      const screenSelector = q(shell.root, ".screen-selector");
      expect(screenSelector).toBeTruthy();
      if (screenSelector) {
        screenSelector.value = "result";
        screenSelector.dispatchEvent(new MockEvent("change"));
      }

      // result 화면의 요소 중 텍스트 요소(result-title-text) 선택
      shell.selectElement("result-title-text");

      const nameInput = q(shell.root, 'input[data-field="name"]');
      const textInput = q(shell.root, 'input[data-field="text"]');
      const fontSizeInput = q(shell.root, 'input[data-field="fontSize"]');

      expect(nameInput?.value).toBe("결과 타이틀 문구");
      expect(textInput?.value).toBe("수호신 최종 승리!");
      expect(fontSizeInput?.value).toBe("42");
      expect(xInput?.value).toBe("150");
      expect(yInput?.value).toBe("180");
      expect(widthInput?.value).toBe("780");
      expect(heightInput?.value).toBe("80");

      // 이미지 요소(result-badge-image) 선택
      shell.selectElement("result-badge-image");
      const assetInput = q(shell.root, 'input[data-field="assetId"]');
      expect(assetInput?.value).toBe("badge_victory_gold");
      expect(xInput?.value).toBe("400");
      expect(widthInput?.value).toBe("280");

      shell.dispose();
    });

    it("preview 선택 메시지 수신 시 shell 및 form 선택 동기화", () => {
      const session = createVisualSession(testDoc, "result", "test-sess-2");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        initialScreenId: "result",
      });

      // PreviewFrame으로부터 selection 메시지 수신 시뮬레이션
      shell.previewFrame.handlePreviewMessage({
        source: PREVIEW_SOURCE,
        kind: "preview:selection",
        requestId: "req-sel-1",
        docId: "doc-test-2",
        pageId: "result",
        sessionId: "test-sess-2",
        revision: 0,
        payload: { elementId: "result-title-text" },
      });

      const textInput = q(shell.root, 'input[data-field="text"]');
      expect(textInput?.value).toBe("수호신 최종 승리!");

      shell.dispose();
    });

    it("알 수 없는 ID(unknown ID) 선택 시 첫 번째 요소 카드로 안전하게 폴백", () => {
      const session = createVisualSession(testDoc, "menu_main", "test-sess-3");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      // 존재하지 않는 element ID 선택 시도
      shell.selectElement("unknown-ghost-element-999");

      // 첫 번째 카드(card-story, index 0)로 안전하게 폴백
      expect(shell.getState().selectedIndex).toBe(0);
      const xInput = q(shell.root, 'input[data-field="x"]');
      expect(xInput?.value).toBe("90");

      shell.dispose();
    });
  });

  describe("2. 단일 커맨드 파이프라인 및 문서 Revision · Undo/Redo 양방향 동기화", () => {
    it("form 확정(Enter) 시 단일 커맨드 발행, 문서 revision 갱신, Undo로 복원", () => {
      let documentChangedCount = 0;

      const session = createVisualSession(testDoc, "menu_main", "test-sess-4");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        onDocumentChange: () => {
          documentChangedCount++;
        },
      });

      const xInput = q(shell.root, 'input[data-field="x"]');
      expect(xInput).toBeTruthy();
      expect(xInput.value).toBe("90");

      // X 좌표를 90 -> 120으로 수정하고 Enter
      xInput.value = "120";
      xInput.dispatchEvent(new MockEvent("input"));
      xInput.dispatchEvent(new MockKeyboardEvent("keydown", { key: "Enter" }));

      // 1. 단일 command 실행 및 revision 갱신 확인
      const toolbarMeta = q(shell.root, ".toolbar-meta");
      expect(toolbarMeta?.textContent).toContain("rev 1");
      expect(documentChangedCount).toBe(1);

      // 2. Undo 버튼 클릭 시 이전 값(90)으로 양방향 복원
      const undoBtn = q(shell.root, 'button[data-action="Undo"]');
      expect(undoBtn).toBeTruthy();
      undoBtn?.dispatchEvent(new MockEvent("click"));

      expect(toolbarMeta?.textContent).toContain("rev 2");
      expect(toolbarMeta?.textContent).toContain("최신 초안");
      expect(xInput.value).toBe("90");

      // 3. Redo 버튼 클릭 시 다시 120으로 복원
      const redoBtn = q(shell.root, 'button[data-action="Redo"]');
      expect(redoBtn).toBeTruthy();
      redoBtn?.dispatchEvent(new MockEvent("click"));

      expect(toolbarMeta?.textContent).toContain("rev 3");
      expect(toolbarMeta?.textContent).toContain("수정됨");
      expect(xInput.value).toBe("120");

      shell.dispose();
    });

    it("Enter 확정 후 blur 발생 시 중복 커맨드 및 중복 history 기록 방지", () => {
      let commitCount = 0;

      const session = createVisualSession(testDoc, "menu_main", "test-sess-5");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        onDocumentChange: () => {
          commitCount++;
        },
      });

      const xInput = q(shell.root, 'input[data-field="x"]');

      // 1. 입력 후 Enter로 커밋
      xInput.value = "150";
      xInput.dispatchEvent(new MockEvent("input"));
      xInput.dispatchEvent(new MockKeyboardEvent("keydown", { key: "Enter" }));

      expect(commitCount).toBe(1);

      // 2. 동일한 값에서 blur 이벤트 발생 -> 중복 커밋 방지
      xInput.dispatchEvent(new MockEvent("blur"));

      expect(commitCount).toBe(1); // 여전히 1이어야 함 (중복 없음)

      const toolbarMeta = q(shell.root, ".toolbar-meta");
      expect(toolbarMeta?.textContent).toContain("rev 1");

      shell.dispose();
    });

    it("텍스트 문구(text) 수정 시 set-element-prop 커맨드 발행 및 양방향 동기화", () => {
      let changedDoc: any = null;
      const session = createVisualSession(testDoc, "result", "test-sess-text");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        initialScreenId: "result",
        onDocumentChange: (doc) => {
          changedDoc = doc;
        },
      });

      shell.selectElement("result-title-text");

      const textInput = q(shell.root, 'input[data-field="text"]');
      expect(textInput.value).toBe("수호신 최종 승리!");

      textInput.value = "기적의 대승리!!";
      textInput.dispatchEvent(new MockEvent("input"));
      textInput.dispatchEvent(new MockKeyboardEvent("keydown", { key: "Enter" }));

      const toolbarMeta = q(shell.root, ".toolbar-meta");
      expect(toolbarMeta?.textContent).toContain("rev 1");
      expect(changedDoc.pages.result.elements.find((e: any) => e.id === "result-title-text").text).toBe("기적의 대승리!!");

      shell.dispose();
    });
  });

  describe("3. 텍스트 입력 단축키 충돌 방지 및 잠금 사유 표시", () => {
    it("isInputElement 판정 및 input 포커스 중 Arrow 단축키 충돌 방지", () => {
      const session = createVisualSession(testDoc, "menu_main", "test-sess-6");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        keyTarget: mockEnv.win,
      });

      const xInput = q(shell.root, 'input[data-field="x"]');
      expect(isInputElement(xInput)).toBe(true);
      expect(isInputElement(container)).toBe(false);

      expect(shell.getState().selectedIndex).toBe(0);

      // input에서 ArrowDown 누름 -> 선택 인덱스가 변경되지 않아야 함 (단축키 충돌 방지)
      xInput.focus();
      const arrowEvent = new MockKeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
      });
      xInput.dispatchEvent(arrowEvent);

      expect(shell.getState().selectedIndex).toBe(0);

      shell.dispose();
    });

    it("잠금(locked) 요소 선택 시 잠금 사유 표시 및 입력 필드 비활성화", () => {
      const session = createVisualSession(testDoc, "boss_climax", "test-sess-7");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
        initialScreenId: "boss_climax",
      });

      // 잠금된 요소(hud-locked-system) 선택
      shell.selectElement("hud-locked-system");

      const lockNotice = q(shell.root, '[data-panel="lock-notice"]');
      expect(lockNotice).toBeTruthy();
      expect(lockNotice?.textContent).toContain("protected-core-system");

      const xInput = q(shell.root, 'input[data-field="x"]');
      expect(xInput?.disabled).toBe(true);

      shell.dispose();
    });
  });

  describe("4. 빠른 선택 전환 시 stale 값 방어 및 화면 전환 시 draft 정책", () => {
    it("값 변경 후 Enter/blur 없이 다른 요소 클릭 시 stale 값이 새 요소에 덮어써지지 않음", () => {
      const session = createVisualSession(testDoc, "menu_main", "test-sess-8");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      const xInput = q(shell.root, 'input[data-field="x"]');
      expect(xInput.value).toBe("90");

      // 카드 0에서 입력만 하고 커밋하지 않음
      xInput.value = "999";
      xInput.dispatchEvent(new MockEvent("input"));

      // 곧바로 카드 1(card-play, x=570) 선택
      shell.selectElement(1);

      // 새로 선택된 카드의 실제 값(570)이 정상 로드되어야 하며 999가 덮어쓰여서는 안 됨
      expect(xInput.value).toBe("570");

      shell.dispose();
    });

    it("화면 전환 시 이전 화면의 draft가 취소되고 새 화면 첫 요소로 안전하게 로드", () => {
      const session = createVisualSession(testDoc, "menu_main", "test-sess-9");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      const xInput = q(shell.root, 'input[data-field="x"]');
      xInput.value = "888";
      xInput.dispatchEvent(new MockEvent("input"));

      // 화면 전환
      const screenSelector = q(shell.root, ".screen-selector");
      screenSelector.value = "pause";
      screenSelector.dispatchEvent(new MockEvent("change"));

      // pause 화면 첫 요소(pause-dialog: x=180)가 로드되고 888은 취소됨
      expect(xInput.value).toBe("180");

      shell.dispose();
    });
  });

  describe("5. attachExportController 및 리소스 해제(dispose)", () => {
    it("attachExportController 보존 검증", () => {
      const state: ShellState = {
        selectedIndex: 0,
        status: ["초기화"],
      };
      const dummyController = { export: vi.fn() };
      const updated = attachExportController(state, dummyController);

      expect(updated.exportController).toBe(dummyController);
      expect(updated.status).toContain("추출 컨트롤러 연결됨");
    });

    it("dispose 호출 시 unmount 및 이벤트 리스너 정리 완료", () => {
      const session = createVisualSession(testDoc, "menu_main", "test-sess-10");

      const shell = mountShell(container as any, {
        session,
        document: testDoc,
      });

      expect(container.children.length).toBeGreaterThan(0);
      shell.dispose();
      expect(container.children.length).toBe(0);
    });
  });
});
