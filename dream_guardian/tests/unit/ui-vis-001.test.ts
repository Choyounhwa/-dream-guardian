import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROTECTED_ZONES,
  UIPresentationElement,
  UI_DESIGN_CANVAS,
  UI_PRESENTATION_PAGE_IDS,
  createDefaultUIPresentationDocument,
} from "../../src/data/UIPresentation";
import {
  UIPresentationValidationResult,
  validateUIPresentationDocument,
} from "../../src/data/UIPresentationValidator";

describe("[Issue #431 / UI-VIS-001] 실게임 UI 표시 계약과 보호 레이아웃 검증", () => {
  it("1. 1080x2160 해상도 및 10개 페이지 ID가 완벽하게 정의되어 있다", () => {
    expect(UI_DESIGN_CANVAS.width).toBe(1080);
    expect(UI_DESIGN_CANVAS.height).toBe(2160);
    expect(UI_PRESENTATION_PAGE_IDS).toHaveLength(10);
    expect(new Set(UI_PRESENTATION_PAGE_IDS).size).toBe(10);

    const expectedPages = [
      "main_home",
      "submenu",
      "options",
      "pause",
      "play_ready",
      "running_question",
      "answer_select",
      "hazard_evade",
      "boss_battle",
      "result",
    ];
    expect(Array.from(UI_PRESENTATION_PAGE_IDS)).toEqual(expectedPages);
  });

  it("2. 기본 생성된 문서는 10개 페이지를 포함하며 결정론적으로 유효성 검증을 통과한다", () => {
    const doc1 = createDefaultUIPresentationDocument();
    const doc2 = createDefaultUIPresentationDocument();
    expect(doc1).toEqual(doc2);

    const result: UIPresentationValidationResult = validateUIPresentationDocument(doc1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(Object.keys(doc1.pages)).toHaveLength(10);
  });

  it("3. 잘못된 kind나 미지원 버전을 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    
    // fitness authoring project kind 거부
    const fitnessPack = { ...doc, kind: "dream-guardian-authoring-project" };
    expect(validateUIPresentationDocument(fitnessPack).valid).toBe(false);

    // ui-transfer kind 거부
    const transferPack = { ...doc, kind: "dream-guardian-ui-transfer" };
    expect(validateUIPresentationDocument(transferPack).valid).toBe(false);

    // 미지원 버전 거부
    const wrongVersion = { ...doc, version: "9.9.9" };
    expect(validateUIPresentationDocument(wrongVersion).valid).toBe(false);
  });

  it("4. 10개 페이지 중 일부가 누락되거나 알 수 없는 페이지 ID가 포함되면 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    const pages = { ...doc.pages };
    delete (pages as any).result;

    const missingPageResult = validateUIPresentationDocument({ ...doc, pages });
    expect(missingPageResult.valid).toBe(false);
    expect(missingPageResult.errors.some((e) => e.code === "MISSING_PAGES")).toBe(true);

    const unknownPageResult = validateUIPresentationDocument({
      ...doc,
      pages: { ...doc.pages, fake_page: { pageId: "fake_page", elements: [] } } as any,
    });
    expect(unknownPageResult.valid).toBe(false);
    expect(unknownPageResult.errors.some((e) => e.code === "INVALID_PAGE_ID")).toBe(true);
  });

  it("5. 중복된 element ID는 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    const dupElement: UIPresentationElement = {
      id: "dup_btn",
      name: "버튼1",
      type: "button",
      bounds: { x: 100, y: 100, width: 200, height: 60 },
      hitBounds: { x: 100, y: 100, width: 200, height: 60 },
      actionId: "nav_play",
    };
    const dupElement2: UIPresentationElement = {
      id: "dup_btn",
      name: "버튼2",
      type: "button",
      bounds: { x: 100, y: 200, width: 200, height: 60 },
      hitBounds: { x: 100, y: 200, width: 200, height: 60 },
      actionId: "nav_records",
    };

    doc.pages.main_home.elements = [dupElement, dupElement2];
    const result = validateUIPresentationDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_ELEMENT_ID")).toBe(true);
  });

  it("6. 비유한 좌표(NaN, Infinity) 및 음수 크기를 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    doc.pages.main_home.elements = [
      {
        id: "bad_coord",
        name: "좌표에러",
        type: "container",
        bounds: { x: NaN, y: 100, width: 200, height: 50 },
      },
    ];
    expect(validateUIPresentationDocument(doc).valid).toBe(false);

    doc.pages.main_home.elements = [
      {
        id: "neg_size",
        name: "음스크기",
        type: "container",
        bounds: { x: 10, y: 10, width: -100, height: 50 },
      },
    ];
    expect(validateUIPresentationDocument(doc).valid).toBe(false);
  });

  it("7. 닫힌 속성 허용목록을 준수하며 알 수 없는 속성이나 알 수 없는 action ID를 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    doc.pages.main_home.elements = [
      {
        id: "unknown_prop",
        name: "미허용속성",
        type: "button",
        bounds: { x: 50, y: 50, width: 100, height: 50 },
        hitBounds: { x: 50, y: 50, width: 100, height: 50 },
        actionId: "nav_story",
        unauthorizedPayload: "hack",
      } as any,
    ];
    const resUnknownProp = validateUIPresentationDocument(doc);
    expect(resUnknownProp.valid).toBe(false);
    expect(resUnknownProp.errors.some((e) => e.code === "UNKNOWN_PROPERTY")).toBe(true);

    doc.pages.main_home.elements = [
      {
        id: "unknown_act",
        name: "알수없는액션",
        type: "button",
        bounds: { x: 50, y: 50, width: 100, height: 50 },
        hitBounds: { x: 50, y: 50, width: 100, height: 50 },
        actionId: "non_existent_action" as any,
      },
    ];
    const resUnknownAction = validateUIPresentationDocument(doc);
    expect(resUnknownAction.valid).toBe(false);
    expect(resUnknownAction.errors.some((e) => e.code === "UNKNOWN_ACTION_ID")).toBe(true);
  });

  it("8. display bounds와 hit bounds의 불일치를 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    doc.pages.main_home.elements = [
      {
        id: "mismatch_btn",
        name: "불일치버튼",
        type: "button",
        bounds: { x: 100, y: 100, width: 200, height: 80 },
        hitBounds: { x: 120, y: 100, width: 200, height: 80 }, // x 불일치
        actionId: "nav_play",
      },
    ];
    const res = validateUIPresentationDocument(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "DISPLAY_HIT_MISMATCH")).toBe(true);
  });

  it("9. 보호 레이아웃(11개 피트니스 존, 바닥 판정선, 신체 정렬 구역) 변조 및 불법 침범을 거부하며 자동 이동하지 않는다", () => {
    const doc = createDefaultUIPresentationDocument();

    // 보호 존 목록 확인
    expect(DEFAULT_PROTECTED_ZONES.length).toBeGreaterThanOrEqual(13); // 11 zones + judgment line + body alignment
    
    // 바닥 판정선 구역에 불법 오버랩되는 임의 버튼 배치
    // 바닥 판정선은 y: 약 1857 근처
    doc.pages.running_question.elements.push({
      id: "intruder_btn",
      name: "침범버튼",
      type: "button",
      bounds: { x: 200, y: 1850, width: 300, height: 100 },
      hitBounds: { x: 200, y: 1850, width: 300, height: 100 },
      actionId: "nav_play",
    });

    const res = validateUIPresentationDocument(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "PROTECTED_ZONE_ENCROACHMENT")).toBe(true);
    // 자동 이동하지 않고 원본 bounds가 유지된 상태로 에러 반환됨을 확인
    expect(doc.pages.running_question.elements.find((e) => e.id === "intruder_btn")?.bounds.y).toBe(1850);
  });

  it("10. 게임 데이터(HP, 문제 CSV, 수치) 변조 시도 및 피트니스 팩 입력을 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    (doc as any).playerHp = 1000; // 게임 수치 오버라이드 시도
    expect(validateUIPresentationDocument(doc).valid).toBe(false);

    const doc2 = createDefaultUIPresentationDocument();
    (doc2 as any).questionCsv = "1+1=2"; // 문제 CSV 주입 시도
    expect(validateUIPresentationDocument(doc2).valid).toBe(false);

    const doc3 = createDefaultUIPresentationDocument();
    (doc3.pages.main_home as any).bossHp = 50;
    expect(validateUIPresentationDocument(doc3).valid).toBe(false);
  });

  it("11. 임의 URL(http, https, data:) 및 script 실행 시도를 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    doc.pages.main_home.elements.push({
      id: "script_img",
      name: "해킹이미지",
      type: "image",
      bounds: { x: 10, y: 10, width: 50, height: 50 },
      assetId: "https://evil.com/payload.png", // 외부 URL 거부
    });
    expect(validateUIPresentationDocument(doc).valid).toBe(false);

    const docScript = createDefaultUIPresentationDocument();
    docScript.pages.main_home.elements.push({
      id: "script_text",
      name: "해킹스크립트",
      type: "text",
      bounds: { x: 10, y: 10, width: 50, height: 50 },
      text: "<script>alert(1)</script>", // script 거부
    });
    expect(validateUIPresentationDocument(docScript).valid).toBe(false);
  });

  it("12. 동적 바인딩은 허용된 읽기 전용 preview fixture 목록만 허용한다", () => {
    const doc = createDefaultUIPresentationDocument();
    doc.pages.running_question.elements.push({
      id: "fixture_q",
      name: "문제텍스트",
      type: "text",
      bounds: { x: 330, y: 550, width: 400, height: 100 },
      dynamicBinding: "preview_question_text",
    });
    const validRes = validateUIPresentationDocument(doc);
    expect(validRes.valid).toBe(true);

    // 알 수 없는 dynamicBinding 거부
    doc.pages.running_question.elements.push({
      id: "invalid_binding",
      name: "불법바인딩",
      type: "text",
      bounds: { x: 330, y: 660, width: 400, height: 100 },
      dynamicBinding: "unsupported_runtime_state" as any,
    });
    const res = validateUIPresentationDocument(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "INVALID_DYNAMIC_BINDING")).toBe(true);
  });

  it("13. manifest에 위험한 assetId나 부정한 데이터가 포함되면 거부한다", () => {
    const doc = createDefaultUIPresentationDocument();
    doc.manifest = { assetIds: ["valid_bg", "https://malicious.com/img.png"] };
    const res = validateUIPresentationDocument(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "SECURITY_VIOLATION")).toBe(true);
  });
});
