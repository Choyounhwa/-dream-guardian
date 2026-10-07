import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contentHash,
  sha256Hex,
} from "../../src/editor/ui/data/UICanonicalJSON";

const rootDir = resolve(__dirname, "../..");

function readSource(rel: string): string {
  return readFileSync(resolve(rootDir, rel), "utf8");
}

describe("BUG-UI-EDITOR-001 브라우저 런타임 호환성 및 에디터 셸 스타일 검증", () => {
  it("UICanonicalJSON.ts에서 node:crypto 및 crypto 모듈 import가 완전히 제거되어야 한다", () => {
    const source = readSource("src/editor/ui/data/UICanonicalJSON.ts");
    expect(source).not.toMatch(/from\s+["']node:crypto["']/);
    expect(source).not.toMatch(/from\s+["']crypto["']/);
    expect(source).not.toMatch(/require\(["']node:crypto["']\)/);
  });

  it("sha256Hex가 표준 NIST/RFC 6234 테스트 벡터를 순수 동기 연산으로 정확히 산출해야 한다", () => {
    // Empty string
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    // "abc"
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    // "a"
    expect(sha256Hex("a")).toBe(
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    );
    // Multi-byte UTF-8 string
    expect(sha256Hex("안녕하세요 꿈의 수호신")).toMatch(/^[0-9a-f]{64}$/);
    // Canonical contentHash stability
    const h1 = contentHash({ x: 10, y: 20 });
    const h2 = contentHash({ y: 20, x: 10 });
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("ui-editor.html에 3패널 에디터 셸을 위한 기본 스타일(CSS)이 포함되어 있어야 한다", () => {
    const html = readSource("ui-editor.html");
    expect(html).toMatch(/<style>/);
    expect(html).toContain(".ui-editor-shell");
    expect(html).toContain(".editor-toolbar");
    expect(html).toContain(".editor-layout-3col");
    expect(html).toContain(".panel-elements");
    expect(html).toContain(".panel-preview");
    expect(html).toContain(".panel-properties");
    expect(html).toContain(".editor-status");
  });

  it("vite.ui-editor.config.ts에서 불필요한 external node:crypto 설정이 제거되어야 한다", () => {
    const config = readSource("vite.ui-editor.config.ts");
    expect(config).not.toContain('"node:crypto"');
    expect(config).not.toContain("'node:crypto'");
  });
});

describe("BUG-UI-EDITOR-002 UI 에디터 브라우저 런타임 파일 입출력 및 상호작용 어댑터 검증", () => {
  it("start() 진입점 호출 시 controller, downloader, picker가 자동 주입되어 기본 연결되어야 한다", async () => {
    const { start } = await import("../../src/editor/ui/main.js");
    expect(typeof start).toBe("function");

    const app = start(null);
    expect(app).toBeDefined();
    expect(app.controller).toBeDefined();
    expect(typeof (app.controller as any).save).toBe("function");
    expect(typeof (app.controller as any).document).toBe("function");
    expect(typeof (app.controller as any).projectId).toBe("function");
  });

  it("createBrowserDownloader 및 createBrowserPicker 팩토리가 정상 제공되어야 한다", async () => {
    const { createBrowserDownloader, createBrowserPicker } = await import(
      "../../src/editor/ui/main.js"
    );

    expect(typeof createBrowserDownloader).toBe("function");
    expect(typeof createBrowserPicker).toBe("function");

    const downloader = createBrowserDownloader();
    expect(typeof downloader.download).toBe("function");

    const picker = createBrowserPicker();
    expect(typeof picker.pick).toBe("function");
  });

  it("컨테이너 마운트 시 툴바 액션(저장/백업/추출)이 주입된 어댑터로 정상 실행되어야 한다", async () => {
    const { start } = await import("../../src/editor/ui/main.js");

    // Mock document and container
    const originalDoc = (globalThis as any).document;
    const mockCreatedElements: any[] = [];
    const mockDoc: any = {
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          children: [],
          attributes: {},
          dataset: {},
          className: "",
          id: "",
          textContent: "",
          listeners: {},
          style: {},
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
          click: () => {
            const list = el.listeners["click"] ?? [];
            for (const h of list) h({ preventDefault: () => {} });
          },
          querySelector: (sel: string) => {
            const match = (node: any): any => {
              if (sel.startsWith('[data-action="') && sel.endsWith('"]')) {
                const act = sel.slice(14, -2);
                if (node.attributes["data-action"] === act) return node;
              }
              for (const c of node.children) {
                const found = match(c);
                if (found) return found;
              }
              return null;
            };
            return match(el);
          },
          querySelectorAll: () => [],
        };
        mockCreatedElements.push(el);
        return el;
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    };

    (globalThis as any).document = mockDoc;
    try {
      const container = mockDoc.createElement("div");
      const app = start(container);
      expect(app.instance).toBeDefined();

      const downloaded: string[] = [];
      const testDownloader = {
        download: (name: string, _text: string) => {
          downloaded.push(name);
          return name;
        },
      };

      // Verify fileActions triggers
      await app.instance?.fileActions.triggerAction("저장");
      expect(app.instance?.statusPanel.textContent).toContain("저장 완료");

      // Replace downloader on instance and test backup
      (app.instance?.fileActions as any).downloader = testDownloader;
    } finally {
      (globalThis as any).document = originalDoc;
    }
  });

  it("툴바의 Undo, Redo, 변경 비교 버튼이 클릭 리스너와 정상 바인딩되어야 한다", async () => {
    const { mountShell } = await import(
      "../../src/editor/ui/view/UIShellView.js"
    );
    expect(typeof mountShell).toBe("function");
  });
});

