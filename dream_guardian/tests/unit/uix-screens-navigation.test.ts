import { describe, expect, it } from "vitest";
import {
  SCREEN_DEFINITIONS,
  getScreenRegistry,
  getScreenElements,
  type ScreenDefinition,
} from "../../src/editor/ui/data/UIScreenRegistry";
import { mountShell, type ShellInstance } from "../../src/editor/ui/view/UIShellView";

describe("[FEAT-UIX-SCREENS-001] UI 에디터 10개 화면 네비게이션 및 컴포넌트 목록 전환 검증", () => {
  it("1. 10대 핵심 화면이 누락 없이 레지스트리에 등록되어 있어야 한다", () => {
    const screens = getScreenRegistry();
    expect(screens).toHaveLength(10);

    const expectedScreenIds = [
      "menu_main",
      "menu_sub",
      "settings",
      "pause",
      "ready_position",
      "run_question",
      "answer_select",
      "hazard_evade",
      "boss_climax",
      "result",
    ];

    for (const id of expectedScreenIds) {
      const found = screens.find((s) => s.id === id);
      expect(found).toBeDefined();
      expect(found?.label).toBeDefined();
      expect(found?.elements.length).toBeGreaterThan(0);
    }
  });

  it("2. 각 화면별 요소 ID 목록 조회가 정확히 동작해야 한다", () => {
    const bossElements = getScreenElements("boss_climax");
    expect(bossElements.map((e) => e.id)).toContain("hud-boss-hp-bar");
    expect(bossElements.map((e) => e.id)).toContain("hud-player-hp-bar");

    const answerElements = getScreenElements("answer_select");
    expect(answerElements.length).toBeGreaterThanOrEqual(3);

    const defaultMain = getScreenElements("menu_main");
    expect(defaultMain.map((e) => e.id)).toContain("card-story");
    expect(defaultMain.map((e) => e.id)).toContain("card-play");
  });

  it("3. mountShell 실행 시 좌측 패널에 화면 선택 셀렉터가 10개 옵션과 함께 렌더링되어야 한다", () => {
    const originalDoc = (globalThis as any).document;
    const mockDoc: any = createMockDocument();
    (globalThis as any).document = mockDoc;

    try {
      const container = mockDoc.createElement("div");
      const shell: ShellInstance = mountShell(container as any);

      const selector = shell.elementsPanel.querySelector(
        '[data-view="screen-selector"]'
      ) as any;
      expect(selector).not.toBeNull();
      expect(selector.children.length).toBe(10);
      expect(selector.children[0].value).toBe("menu_main");

      shell.unmount();
    } finally {
      (globalThis as any).document = originalDoc;
    }
  });

  it("4. 화면 셀렉터 변경 시 좌측 요소 목록이 해당 화면의 컴포넌트로 동적 교체되어야 한다", () => {
    const originalDoc = (globalThis as any).document;
    const mockDoc: any = createMockDocument();
    (globalThis as any).document = mockDoc;

    try {
      const container = mockDoc.createElement("div");
      const shell: ShellInstance = mountShell(container as any);

      const selector = shell.elementsPanel.querySelector(
        '[data-view="screen-selector"]'
      ) as any;
      expect(selector).not.toBeNull();

      // Switch to boss_climax
      selector.value = "boss_climax";
      selector.dispatchEvent({ type: "change", target: selector });

      const cardList = shell.elementsPanel.querySelector(".elements-card-list") as any;
      expect(cardList).not.toBeNull();
      const itemIds = cardList.children.map((c: any) => c.getAttribute("data-element-id"));
      expect(itemIds).toContain("hud-boss-hp-bar");
      expect(itemIds).toContain("hud-player-hp-bar");

      // Verify first item is selected and status updated
      expect(shell.statusPanel.textContent).toContain("hud-player-hp-bar");

      shell.unmount();
    } finally {
      (globalThis as any).document = originalDoc;
    }
  });

  it("5. 동적 교체된 요소를 클릭하면 선택 하이라이트(.is-selected) 및 속성 폼이 갱신되어야 한다", () => {
    const originalDoc = (globalThis as any).document;
    const mockDoc: any = createMockDocument();
    (globalThis as any).document = mockDoc;

    try {
      const container = mockDoc.createElement("div");
      const shell: ShellInstance = mountShell(container as any);

      const selector = shell.elementsPanel.querySelector(
        '[data-view="screen-selector"]'
      ) as any;
      selector.value = "result";
      selector.dispatchEvent({ type: "change", target: selector });

      const cardList = shell.elementsPanel.querySelector(".elements-card-list") as any;
      const targetItem = cardList.children.find(
        (c: any) => c.getAttribute("data-element-id") === "result-grade-badge"
      );
      expect(targetItem).toBeDefined();

      targetItem.click();
      expect(targetItem.className).toContain("is-selected");
      expect(shell.statusPanel.textContent).toContain("result-grade-badge");

      shell.unmount();
    } finally {
      (globalThis as any).document = originalDoc;
    }
  });
});

function createMockDocument() {
  const elements: any[] = [];
  return {
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        children: [],
        attributes: {},
        dataset: {},
        className: "",
        id: "",
        value: "",
        textContent: "",
        listeners: {},
        style: {},
        tabIndex: -1,
        appendChild: (c: any) => {
          el.children.push(c);
          c.parentNode = el;
          return c;
        },
        removeChild: (c: any) => {
          const idx = el.children.indexOf(c);
          if (idx !== -1) el.children.splice(idx, 1);
          return c;
        },
        setAttribute: (k: string, v: string) => {
          el.attributes[k] = String(v);
          if (k.startsWith("data-")) {
            const camel = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
            el.dataset[camel] = String(v);
          }
        },
        removeAttribute: (k: string) => {
          delete el.attributes[k];
        },
        getAttribute: (k: string) => el.attributes[k] ?? null,
        addEventListener: (t: string, fn: any) => {
          if (!el.listeners[t]) el.listeners[t] = [];
          el.listeners[t].push(fn);
        },
        removeEventListener: (t: string, fn: any) => {
          if (!el.listeners[t]) return;
          el.listeners[t] = el.listeners[t].filter((h: any) => h !== fn);
        },
        dispatchEvent: (evt: any) => {
          const list = el.listeners[evt.type] ?? [];
          for (const h of list) h(evt);
          return true;
        },
        click: () => {
          el.dispatchEvent({ type: "click", target: el });
        },
        querySelector: (sel: string): any => {
          const walk = (node: any): any => {
            if (sel.startsWith('[data-view="') && sel.endsWith('"]')) {
              const val = sel.slice(12, -2);
              if (node.attributes["data-view"] === val) return node;
            }
            if (sel.startsWith(".")) {
              const cls = sel.slice(1);
              if (node.className.split(/\s+/).includes(cls)) return node;
            }
            for (const c of node.children) {
              const found = walk(c);
              if (found) return found;
            }
            return null;
          };
          return walk(el);
        },
        querySelectorAll: () => [],
      };
      elements.push(el);
      return el;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };
}
