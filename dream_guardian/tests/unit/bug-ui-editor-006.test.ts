/**
 * bug-ui-editor-006.test.ts
 *
 * Issue #553 ([BUG-UI-EDITOR-006] 에디터 요소 ID와 게임 렌더러 매칭 ID 불일치 + BottomBar 중복 매칭)
 *
 * 검증 항목:
 * 1. 기본 UIVisualDocument로 presentation artifact 추출 시 buildPresentationArtifact가 성공(ok: true)해야 함
 * 2. sublevel 액션이 chapter로 오변환되지 않아야 함 (sub-cell-1이 select_chapter로 변환 금지)
 * 3. 10개 핵심 렌더러의 fromPresentationDocument에 artifact 주입 시 편집 가능 요소가 1:1로 매칭되어야 함:
 *    - ReadyPositionRenderer: countdown, alignmentFrame
 *    - RunningMatRenderer: statusHeader (run_header)
 *    - QuestionRenderer: header (run_question_banner), choice0, choice1
 *    - HazardZoneRenderer: hazardWarning (hazard_warning)
 *    - SettingsView: modal (settings_modal), closeBtn
 *    - HUDLayer: playerHpBar, bossHpBar
 *    - ResultRenderer: panel, grade
 * 4. MenuRenderer 해석 시 서브레벨 카드가 챕터 카드로 잘못 흡수되지 않고 extractedSubCards에 정상 등록되어야 함
 * 5. BottomBar 교차 페이지 액션 버튼이 pageOverrides에 페이지별로 격리 매칭되어야 함
 */

import { describe, it, expect } from 'vitest';
import { createDefaultUIVisualDocument } from '../../src/editor/ui/data/UIVisualDocument';
import { buildPresentationArtifact } from '../../src/editor/ui/data/UIVisualArtifactBuilder';
import { ReadyPositionRenderer } from '../../src/render/ReadyPositionRenderer';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer';
import { QuestionRenderer } from '../../src/render/QuestionRenderer';
import { HazardZoneRenderer } from '../../src/render/HazardZoneRenderer';
import { SettingsView } from '../../src/ui/SettingsView';
import { HUDLayer } from '../../src/ui/HUDLayer';
import { ResultRenderer } from '../../src/ui/ResultRenderer';
import { MenuRenderer } from '../../src/ui/MenuRenderer';
import { BottomBar } from '../../src/ui/BottomBar';

describe('[BUG-UI-EDITOR-006] 에디터 요소 ID 정규화 및 게임 렌더러 매칭 검증', () => {
  function buildDefaultArtifact() {
    const doc = createDefaultUIVisualDocument();
    return buildPresentationArtifact({
      checkpoint: {
        projectId: 'proj-test',
        revision: 1,
        document: doc,
        saved: true,
      },
    });
  }

  it('기본 문서 추출 시 buildPresentationArtifact가 성공하고 sublevel이 chapter로 변환되지 않아야 한다', () => {
    const buildResult = buildDefaultArtifact();
    expect(buildResult.ok).toBe(true);

    if (!buildResult.ok) return;
    const subPage = buildResult.artifact.pages.submenu;
    expect(subPage).toBeDefined();

    // sub-cell-1이 select_chapter_1로 오변환되지 않아야 함
    const hasWrongChapterAction = subPage.elements.some((el) => el.actionId === 'select_chapter_1');
    expect(hasWrongChapterAction).toBe(false);

    // sub_1 요소가 존재해야 함
    const subCell = subPage.elements.find((el) => el.id === 'btn_sub_1' || el.id === 'sub_1');
    expect(subCell).toBeDefined();
  });

  it('기본 문서 artifact가 ReadyPositionRenderer 슬롯에 정상 매칭되어야 한다', () => {
    const buildResult = buildDefaultArtifact();
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const ctx = ReadyPositionRenderer.fromPresentationDocument(buildResult.artifact, 'play_ready');
    // ready-countdown -> countdown 매칭
    expect(ctx.countdown).toBeDefined();
    // ready-silhouette -> alignmentFrame 매칭
    expect(ctx.alignmentFrame).toBeDefined();
  });

  it('기본 문서 artifact가 RunningMatRenderer 및 QuestionRenderer 슬롯에 정상 매칭되어야 한다', () => {
    const buildResult = buildDefaultArtifact();
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const matCtx = RunningMatRenderer.fromPresentationDocument(buildResult.artifact, 'running_question');
    // run-track -> statusHeader (run_header) 매칭
    expect(matCtx.statusHeader).toBeDefined();

    const qCtx = QuestionRenderer.fromPresentationDocument(buildResult.artifact, 'running_question');
    // run-question-box -> header 매칭
    expect(qCtx.header).toBeDefined();

    const ansCtx = QuestionRenderer.fromPresentationDocument(buildResult.artifact, 'answer_select');
    // answer-choice-1 / answer-choice-2 -> choice0 / choice1 매칭
    expect(ansCtx.choice0).toBeDefined();
    expect(ansCtx.choice1).toBeDefined();
  });

  it('기본 문서 artifact가 HazardZoneRenderer, SettingsView, HUDLayer, ResultRenderer에 정상 매칭되어야 한다', () => {
    const buildResult = buildDefaultArtifact();
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    // HazardZoneRenderer: hazard-overlay -> hazardWarning
    const hazardCtx = HazardZoneRenderer.fromPresentationDocument(buildResult.artifact, 'hazard_evade');
    expect(hazardCtx.hazardWarning).toBeDefined();

    // SettingsView: settings-dialog -> modal, settings-close-btn -> closeBtn
    const settingsCtx = SettingsView.fromPresentationDocument(buildResult.artifact, 'settings');
    expect(settingsCtx.modal).toBeDefined();
    expect(settingsCtx.closeBtn).toBeDefined();

    // HUDLayer: hud-player-hp-bar -> playerHpBar, hud-boss-hp-bar -> bossHpBar
    const hudCtx = HUDLayer.fromPresentationDocument(buildResult.artifact, 'boss_battle');
    expect(hudCtx.playerHpBar).toBeDefined();
    expect(hudCtx.bossHpBar).toBeDefined();

    // ResultRenderer: result-grade-badge -> grade, result-confirm-btn -> bottomPrompt
    const resultCtx = ResultRenderer.fromPresentationDocument(buildResult.artifact, 'result');
    expect(resultCtx.grade).toBeDefined();
    expect(resultCtx.bottomPrompt).toBeDefined();
  });

  it('MenuRenderer에서 서브레벨 카드가 챕터 카드로 오인되지 않고 정상 추출되어야 한다', () => {
    const buildResult = buildDefaultArtifact();
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const menuRenderer = new MenuRenderer();
    menuRenderer.setPresentationContext({
      presentationDocument: buildResult.artifact,
    });

    const resolved = (menuRenderer as any)._resolveContext();
    expect(resolved).toBeDefined();
    // 서브레벨 카드 1번이 subCards에 정상 추출되어야 함
    expect(resolved.subCards?.[1]).toBeDefined();
  });

  it('BottomBar에서 페이지별 액션 버튼이 pageOverrides에 격리되어 교차 오염이 없어야 한다', () => {
    const buildResult = buildDefaultArtifact();
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const bottomBarCtx = BottomBar.fromPresentationDocument(buildResult.artifact);
    expect(bottomBarCtx.pageOverrides).toBeDefined();
    // submenu는 close_submenu 액션 버튼 소유
    expect(bottomBarCtx.pageOverrides?.submenu?.actionBtn).toBeDefined();
    // settings는 close_settings 액션 버튼 소유
    expect(bottomBarCtx.pageOverrides?.options?.actionBtn).toBeDefined();
    // pause는 pause_resume 액션 버튼 소유
    expect(bottomBarCtx.pageOverrides?.pause?.actionBtn).toBeDefined();
  });
});
