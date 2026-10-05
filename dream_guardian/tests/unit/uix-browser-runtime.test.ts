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
