import { describe, expect, it } from 'vitest';
import { migrateToUIVisualDocument } from '../../src/editor/ui/io/UIVisualMigration';
import {
  UI_VISUAL_DOCUMENT_KIND,
  UI_VISUAL_SCHEMA_VERSION,
  createDefaultUIVisualDocument,
} from '../../src/editor/ui/data/UIVisualDocument';
import { validateUIVisualDocument } from '../../src/editor/ui/data/UIVisualValidator';

describe('[Issue #433 / UI-VIS-003] 기존 UI 프로젝트 비파괴 버전 변환', () => {
  const sampleLegacyProject = () => ({
    kind: 'dream-guardian-ui-project',
    schemaVersion: '1.0.0',
    design: { width: 1080, height: 2160 },
    menu: {
      cards: [
        { id: 'card-story', x: 100, y: 360 },
        { id: 'card-play', x: 580, y: 360 },
        { id: 'card-records', x: 100, y: 650 },
        { id: 'card-settings', x: 580, y: 650 },
        { id: 'card-credits', x: 340, y: 940 },
      ],
      width: 400,
      height: 250,
      workoutButton: { x: 140, y: 1800, width: 800, height: 120 },
    },
  });

  const sampleLegacyTransfer = () => ({
    kind: 'dream-guardian-ui-transfer',
    schemaVersion: '1.0.0',
    design: { width: 1080, height: 2160 },
    scope: 'menu',
    content: {
      cards: [
        { id: 'card-story', x: 95, y: 355 },
        { id: 'card-play', x: 575, y: 355 },
        { id: 'card-records', x: 95, y: 645 },
        { id: 'card-settings', x: 575, y: 645 },
        { id: 'card-credits', x: 335, y: 935 },
      ],
      width: 410,
      height: 255,
      workoutButton: { x: 145, y: 1805, width: 790, height: 115 },
    },
    contentHash: 'a'.repeat(64),
    artifactHash: 'b'.repeat(64),
    sourceCheckpointHash: 'c'.repeat(64),
    sourceComparison: 'performed',
  });

  it('1. 레거시 UIX 프로젝트를 새 10페이지 UIVisualDocument 규격으로 비파괴 변환한다', () => {
    const raw = JSON.stringify(sampleLegacyProject(), null, 2);
    const result = migrateToUIVisualDocument(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.kind).toBe(UI_VISUAL_DOCUMENT_KIND);
    expect(result.document.schemaVersion).toBe(UI_VISUAL_SCHEMA_VERSION);
    expect(Object.keys(result.document.pages)).toHaveLength(10);

    // 원본 raw bytes 보존 확인
    expect(result.originalRaw).toBe(raw);

    // menu_main 페이지 요소에 레거시 카드 및 workoutButton 좌표/크기가 올바르게 반영되었는지 확인
    const menuPage = result.document.pages.menu_main;
    const storyCard = menuPage.elements.find((el) => el.id === 'card-story');
    expect(storyCard).toBeDefined();
    expect(storyCard?.bounds).toEqual({ x: 100, y: 360, width: 400, height: 250 });
    expect(storyCard?.hitBounds).toEqual({ x: 100, y: 360, width: 400, height: 250 });

    const workoutBtn = menuPage.elements.find((el) => el.id === 'menu-workout-btn');
    expect(workoutBtn).toBeDefined();
    expect(workoutBtn?.bounds).toEqual({ x: 140, y: 1800, width: 800, height: 120 });
    expect(workoutBtn?.hitBounds).toEqual({ x: 140, y: 1800, width: 800, height: 120 });

    // UIVisualValidator 검증 통과 확인
    const validation = validateUIVisualDocument(result.document);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('2. UI transfer 문서(kind: dream-guardian-ui-transfer)를 정상적으로 변환한다', () => {
    const raw = JSON.stringify(sampleLegacyTransfer());
    const result = migrateToUIVisualDocument(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.kind).toBe(UI_VISUAL_DOCUMENT_KIND);
    const menuPage = result.document.pages.menu_main;
    const playCard = menuPage.elements.find((el) => el.id === 'card-play');
    expect(playCard?.bounds).toEqual({ x: 575, y: 355, width: 410, height: 255 });
    expect(result.originalRaw).toBe(raw);
    expect(result.report.sourceKind).toBe('dream-guardian-ui-transfer');
  });

  it('3. 미지원 속성 및 미지원 scope를 조용히 삭제/치환하지 않고 보고서에 보존한다', () => {
    const projectWithExtra = sampleLegacyProject() as any;
    // 미지원 scope 및 미지원 카드 속성 추가
    projectWithExtra.unsupportedScope = { customData: 'keep_me' };
    projectWithExtra.menu.cards[0].customMetadata = 'extra_attr';

    const raw = JSON.stringify(projectWithExtra);
    const result = migrateToUIVisualDocument(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 변환 보고서에 미지원 항목 기록 확인
    const report = result.report;
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.unmappedItems.length).toBeGreaterThan(0);

    const hasScope = report.unmappedItems.some((item) => item.key === 'unsupportedScope');
    expect(hasScope).toBe(true);

    const hasCardAttr = report.unmappedItems.some((item) => item.key === 'customMetadata');
    expect(hasCardAttr).toBe(true);
  });

  it('4. 손상된 JSON이나 빈 입력인 경우 실패(ok: false)하고 원본 bytes를 온전히 보존하며 부분 결과를 적용하지 않는다', () => {
    const corruptJson = '{ "kind": "dream-guardian-ui-project", "incomplete": ';
    const result = migrateToUIVisualDocument(corruptJson);

    expect(result.ok).toBe(false);
    expect(result.originalRaw).toBe(corruptJson);
    expect(result.document).toBeUndefined();
    if (!result.ok) {
      expect(result.reason).toContain('JSON');
    }
  });

  it('5. 미지원 미래 버전(schemaVersion > 1.0.0)이나 잘못된 kind는 거부하고 원본을 보존한다', () => {
    // 미래 버전
    const futureDoc = { ...sampleLegacyProject(), schemaVersion: '2.0.0' };
    const resFuture = migrateToUIVisualDocument(JSON.stringify(futureDoc));
    expect(resFuture.ok).toBe(false);
    expect(resFuture.document).toBeUndefined();
    if (!resFuture.ok) {
      expect(resFuture.reason).toContain('schemaVersion');
    }

    // 잘못된 kind
    const invalidKindDoc = { ...sampleLegacyProject(), kind: 'unknown-future-format' };
    const resKind = migrateToUIVisualDocument(JSON.stringify(invalidKindDoc));
    expect(resKind.ok).toBe(false);
    expect(resKind.document).toBeUndefined();
    if (!resKind.ok) {
      expect(resKind.reason).toContain('kind');
    }
  });

  it('6. 이미 새 규격인 UIVisualDocument를 입력받은 경우 정상 통과 및 유효성을 검사한다', () => {
    const validVisualDoc = createDefaultUIVisualDocument();
    const raw = JSON.stringify(validVisualDoc);
    const result = migrateToUIVisualDocument(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toEqual(validVisualDoc);
    expect(result.report.sourceKind).toBe(UI_VISUAL_DOCUMENT_KIND);

    // 보안 위반 텍스트가 삽입된 잘못된 visual doc 거부
    const maliciousVisualDoc = createDefaultUIVisualDocument();
    maliciousVisualDoc.pages.menu_main.elements[0].text = '<script>alert(1)</script>';
    const resMalicious = migrateToUIVisualDocument(JSON.stringify(maliciousVisualDoc));
    expect(resMalicious.ok).toBe(false);
    if (!resMalicious.ok) {
      expect(resMalicious.reason).toContain('SECURITY_VIOLATION');
    }
  });

  it('7. 변환 재시도 멱등성(Idempotency)을 보장한다 (동일 입력에 대해 동일 결과)', () => {
    const raw = JSON.stringify(sampleLegacyProject());
    const res1 = migrateToUIVisualDocument(raw);
    const res2 = migrateToUIVisualDocument(raw);

    expect(res1).toEqual(res2);

    // 왕복 멱등성: 변환된 문서를 다시 변환해도 동일
    if (res1.ok) {
      const res3 = migrateToUIVisualDocument(JSON.stringify(res1.document));
      expect(res3.ok).toBe(true);
      if (res3.ok) {
        expect(res3.document).toEqual(res1.document);
      }
    }
  });

  it('8. stable ID 충돌을 감지하고 보고서에 기록하며 중복 ID 발생 시 변환을 거부한다', () => {
    const projectWithConflict = sampleLegacyProject();
    // 두 카드가 동일한 id ('card-story')를 가짐
    projectWithConflict.menu.cards[1].id = 'card-story';

    const raw = JSON.stringify(projectWithConflict);
    const result = migrateToUIVisualDocument(raw);

    expect(result.ok).toBe(false);
    expect(result.report).toBeDefined();
    expect(result.report?.conflicts.length).toBeGreaterThan(0);
    expect(result.report?.conflicts.some((c) => c.id === 'card-story')).toBe(true);
    expect(result.document).toBeUndefined();
  });

  it('9. 빈 문자열, 공백, 배열 또는 원시 값 루트 입력 시 명확한 에러를 반환한다', () => {
    expect(migrateToUIVisualDocument('').ok).toBe(false);
    expect(migrateToUIVisualDocument('   ').ok).toBe(false);

    const arrayRes = migrateToUIVisualDocument('[1, 2, 3]');
    expect(arrayRes.ok).toBe(false);
    if (!arrayRes.ok) {
      expect(arrayRes.reason).toContain('Root value must be an object');
    }

    const primRes = migrateToUIVisualDocument('"just-a-string"');
    expect(primRes.ok).toBe(false);
    if (!primRes.ok) {
      expect(primRes.reason).toContain('Root value must be an object');
    }
  });

  it('10. 스타일 리소스 전달 문서(style-resources) 및 비메뉴 scope 전달 문서를 안전하게 처리한다', () => {
    // 스타일 리소스 전달 문서
    const styleTransfer = {
      styleVersion: '1.0.0',
      scope: 'style-resources',
      resources: [{ id: 'font-main', path: 'assets/font.woff' }],
    };
    const resStyle = migrateToUIVisualDocument(JSON.stringify(styleTransfer));
    expect(resStyle.ok).toBe(true);
    if (resStyle.ok) {
      expect(resStyle.report.sourceScope).toBe('style-resources');
      expect(resStyle.report.unmappedItems.some((u) => u.key === 'style-resources')).toBe(true);
    }

    // 비메뉴 scope (bottomBar)
    const bottomBarTransfer = {
      kind: 'dream-guardian-ui-transfer',
      schemaVersion: '1.0.0',
      scope: 'bottomBar',
      content: { visible: true },
    };
    const resBottomBar = migrateToUIVisualDocument(JSON.stringify(bottomBarTransfer));
    expect(resBottomBar.ok).toBe(true);
    if (resBottomBar.ok) {
      expect(resBottomBar.report.sourceScope).toBe('bottomBar');
      expect(resBottomBar.report.warnings.some((w) => w.code === 'UNSUPPORTED_TRANSFER_SCOPE')).toBe(true);
    }
  });

  it('11. 카드의 개별 크기 지정 및 커스텀 텍스트/이름이 올바르게 반영된다', () => {
    const project = sampleLegacyProject();
    (project.menu.cards[0] as any).width = 450;
    (project.menu.cards[0] as any).height = 280;
    (project.menu.cards[0] as any).text = '이야기 모드';
    (project.menu.cards[0] as any).name = '수정된 이야기 카드';

    const res = migrateToUIVisualDocument(JSON.stringify(project));
    expect(res.ok).toBe(true);
    if (res.ok) {
      const el = res.document.pages.menu_main.elements.find((e) => e.id === 'card-story');
      expect(el?.bounds.width).toBe(450);
      expect(el?.bounds.height).toBe(280);
      expect(el?.text).toBe('이야기 모드');
      expect(el?.name).toBe('수정된 이야기 카드');
    }
  });
});

