import { describe, expect, it } from "vitest";
import {
  SCREEN_DEFINITIONS,
  getScreenElements,
  getScreenRegistry,
} from "../../src/editor/ui/data/UIScreenRegistry";
import {
  UI_VISUAL_DOCUMENT_KIND,
  UI_VISUAL_SCHEMA_VERSION,
  UIVisualDocument,
  createDefaultUIVisualDocument,
} from "../../src/editor/ui/data/UIVisualDocument";
import {
  UIVisualValidationResult,
  validateUIVisualDocument,
} from "../../src/editor/ui/data/UIVisualValidator";

describe("[Issue #432 / UI-VIS-002] 10페이지 편집 문서 스키마와 실게임 요소 목록", () => {
  it("1. UIScreenRegistry는 실게임에 부합하도록 교정되어 10개 화면을 제공한다", () => {
    const screens = getScreenRegistry();
    expect(screens).toHaveLength(10);
    const screenIds = screens.map((s) => s.id);
    expect(screenIds).toEqual([
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
    ]);
  });

  it("2. UIScreenRegistry에서 가짜 요소(재시작 버튼, 3/4번 답안 등)가 제거되고 실제 게임 요소로 교정되어 있다", () => {
    // pause 화면: resume, exit(quit)만 존재하고 restart는 없어야 함
    const pauseElements = getScreenElements("pause");
    const pauseIds = pauseElements.map((e) => e.id);
    expect(pauseIds).toContain("pause-resume-btn");
    expect(pauseIds).toContain("pause-exit-btn");
    expect(pauseIds).not.toContain("pause-restart-btn");

    // answer_select 화면: 2개 답안(answer-choice-1, answer-choice-2)만 존재하고 3, 4번은 없어야 함
    const answerElements = getScreenElements("answer_select");
    const answerIds = answerElements.map((e) => e.id);
    expect(answerIds).toContain("answer-choice-1");
    expect(answerIds).toContain("answer-choice-2");
    expect(answerIds).not.toContain("answer-choice-3");
    expect(answerIds).not.toContain("answer-choice-4");

    // menu_main 화면: 5개 실제 메뉴 카드 포함
    const mainElements = getScreenElements("menu_main");
    const mainIds = mainElements.map((e) => e.id);
    expect(mainIds).toHaveLength(5);
    expect(mainIds).toContain("card-story");
    expect(mainIds).toContain("card-play");
    expect(mainIds).toContain("card-records");
    expect(mainIds).toContain("card-settings");
    expect(mainIds).toContain("card-credits");
  });

  it("3. 기본 생성된 UIVisualDocument는 결정론적이며 10개 페이지를 포함하고 유효성 검증을 통과한다", () => {
    const doc1 = createDefaultUIVisualDocument();
    const doc2 = createDefaultUIVisualDocument();
    expect(doc1).toEqual(doc2);
    expect(doc1.kind).toBe(UI_VISUAL_DOCUMENT_KIND);
    expect(doc1.schemaVersion).toBe(UI_VISUAL_SCHEMA_VERSION);

    const result: UIVisualValidationResult = validateUIVisualDocument(doc1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(Object.keys(doc1.pages)).toHaveLength(10);
  });

  it("4. 각 페이지 내 element ID 및 group ID의 고유성을 검증하고 중복 시 거부한다", () => {
    const doc = createDefaultUIVisualDocument();
    const mainPage = doc.pages.menu_main;

    // 중복 element id 추가
    mainPage.elements.push({
      id: mainPage.elements[0].id,
      name: "중복 요소",
      type: "text",
      bounds: { x: 10, y: 10, width: 100, height: 40 },
    });

    const res = validateUIVisualDocument(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "DUPLICATE_ELEMENT_ID")).toBe(true);
  });

  it("5. 그룹 간 순환 참조(Cycle) 및 존재하지 않는 부모 그룹 참조를 감지하고 거부한다", () => {
    const doc = createDefaultUIVisualDocument();
    const mainPage = doc.pages.menu_main;

    // 존재하지 않는 부모 그룹 참조
    mainPage.elements.push({
      id: "elem_orphan",
      name: "미아 요소",
      type: "text",
      bounds: { x: 10, y: 10, width: 100, height: 40 },
      groupId: "non_existent_group",
    });

    const resOrphan = validateUIVisualDocument(doc);
    expect(resOrphan.valid).toBe(false);
    expect(resOrphan.errors.some((e) => e.code === "INVALID_GROUP_REFERENCE")).toBe(true);

    // 순환 그룹 생성: groupA -> groupB -> groupA
    const docCycle = createDefaultUIVisualDocument();
    docCycle.pages.menu_main.groups = [
      { id: "group_a", name: "그룹 A", parentGroupId: "group_b" },
      { id: "group_b", name: "그룹 B", parentGroupId: "group_a" },
    ];
    const resCycle = validateUIVisualDocument(docCycle);
    expect(resCycle.valid).toBe(false);
    expect(resCycle.errors.some((e) => e.code === "GROUP_CYCLE_DETECTED")).toBe(true);
  });

  it("6. 잠금(isLocked), 편집 가능, 렌더러 미지원 사유(unsupportedReason)를 명시할 수 있다", () => {
    const doc = createDefaultUIVisualDocument();
    doc.pages.answer_select.elements.push({
      id: "elem_locked",
      name: "보호된 앵커",
      type: "container",
      bounds: { x: 80, y: 480, width: 920, height: 560 },
      isLocked: true,
      lockReason: "피트니스 존 보호 앵커로 위치 이동 불가",
    });

    doc.pages.result.elements.push({
      id: "elem_unsupported",
      name: "실험적 3D 효과",
      type: "container",
      bounds: { x: 100, y: 100, width: 200, height: 200 },
      isSupported: false,
      unsupportedReason: "2D Canvas 렌더러에서 미지원",
    });

    const res = validateUIVisualDocument(doc);
    expect(res.valid).toBe(true);
  });

  it("7. 런타임 게임 데이터(HP, 문제 CSV 등) 및 위험한 URL/스크립트 주입을 거부한다", () => {
    const doc = createDefaultUIVisualDocument();
    (doc as any).playerHp = 100;
    expect(validateUIVisualDocument(doc).valid).toBe(false);

    const docScript = createDefaultUIVisualDocument();
    docScript.pages.menu_main.elements.push({
      id: "script_text",
      name: "공격",
      type: "text",
      bounds: { x: 10, y: 10, width: 50, height: 50 },
      text: "<script>alert(1)</script>",
    });
    expect(validateUIVisualDocument(docScript).valid).toBe(false);
  });

  it("8. unknown screen ID 요청 시 첫 메뉴로 fallback하지 않고 명시적 에러를 throw한다", () => {
    expect(() => getScreenElements("unknown_screen_id")).toThrowError(/UNKNOWN_SCREEN/);
  });
});
