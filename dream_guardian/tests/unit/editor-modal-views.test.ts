/**
 * editor-modal-views.test.ts - 에디터 모달 뷰 렌더러 분리 및 검증 단위 테스트 (#627)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { EditorModalViews } from '../../src/editor/EditorModalViews.js';
import type { EditorPublishStatus, TestLaunchResult } from '../../src/editor/EditorPublishController.js';
import type { PublishedPackSummary } from '../../src/storage/PublishedContentStore.js';

describe('EditorModalViews - 모달 및 피드백 뷰 렌더러 분리 단위 테스트 (#627)', () => {
  let state: EditorState;
  let modalViews: EditorModalViews;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    modalViews = new EditorModalViews(state);
    layout = new EditorLayout(state);
  });

  describe('1. 스테이지 바인딩 패널 HTML (renderStageBindingsPanelHTML)', () => {
    it('기본 모달 패널, 테이블 헤더, 바인딩 추가 폼 컨트롤을 렌더링한다', () => {
      const html = modalViews.renderStageBindingsPanelHTML();

      expect(html).toContain('stage-bindings-panel');
      expect(html).toContain('id="stage-bindings-panel"');
      expect(html).toContain('bindings-table');
      expect(html).toContain('id="btn-add-binding"');
      expect(html).toContain('id="btn-close-bindings"');
      expect(html).toContain('id="bind-chapter"');
      expect(html).toContain('id="bind-phase"');
      expect(html).toContain('id="bind-seq"');
      expect(html).toContain('id="bind-role"');
    });

    it('바인딩 목록이 비어있을 때 카운트 0을 표시한다', () => {
      state.setBindings([]);
      const html = modalViews.renderStageBindingsPanelHTML();
      expect(html).toContain('활성 구간 바인딩 목록 (0개)');
    });

    it('바인딩 데이터가 있을 때 복합 키 및 삭제 버튼이 포함된 행을 렌더링한다', () => {
      const html = modalViews.renderStageBindingsPanelHTML();
      expect(html).toContain('binding-row');
      expect(html).toContain('btn-remove-binding');
      expect(html).toContain('data-binding-index="0"');
    });

    it('5개 챕터의 스테이지 커버리지 현황 행과 상태 뱃지를 렌더링한다', () => {
      const html = modalViews.renderStageBindingsPanelHTML();
      expect(html).toContain('data-chapter="ch1"');
      expect(html).toContain('data-chapter="ch2"');
      expect(html).toContain('data-chapter="ch3"');
      expect(html).toContain('data-chapter="ch4"');
      expect(html).toContain('data-chapter="ch5"');
      expect(html).toContain('badge');
    });
  });

  describe('2. 배포 모달 HTML (renderPublishModalHTML)', () => {
    it('배포 모달 기본 폼 컨트롤 및 릴리즈 액션 버튼을 렌더링한다', () => {
      const html = modalViews.renderPublishModalHTML();

      expect(html).toContain('publish-modal-panel');
      expect(html).toContain('id="publish-modal-panel"');
      expect(html).toContain('id="btn-close-publish-modal"');
      expect(html).toContain('id="btn-modal-validate"');
      expect(html).toContain('id="btn-modal-publish"');
      expect(html).toContain('id="btn-modal-test-play"');
      expect(html).toContain('id="btn-modal-stage-activation"');
      expect(html).toContain('id="btn-modal-rollback"');
      expect(html).toContain('test-play-isolation-banner');
      expect(html).toContain('version-history-section');
    });

    it('검증 통과 상태일 때 성공 뱃지와 활성화된 안내를 렌더링한다', () => {
      const mockStatus: EditorPublishStatus = {
        projectId: 'proj-1',
        sourceRevision: 1,
        isFormDirty: false,
        activeContentHash: 'hash-abc',
        previousHealthyHash: null,
        stagedActivationHash: null,
        lastPublishedHash: 'hash-abc',
        isStagedForNextStage: false,
        lastValidation: {
          valid: true,
          errors: [],
          warnings: [],
          diagnostics: [],
          contentHash: 'hash-abc',
          diffSummary: {
            isFirstPublish: false,
            previousHash: 'hash-old',
            newHash: 'hash-abc',
            sourceRevision: 1,
            notesCount: 10,
            patternsCount: 2,
            bpm: 95,
            hasBpmChange: false,
            notesDiff: 0,
            patternsDiff: 2,
            summaryText: '2개 시퀀스 추가됨',
          },
        },
      };

      const html = modalViews.renderPublishModalHTML(mockStatus);
      expect(html).toContain('검증 통과 (게시 준비 완료)');
      expect(html).toContain('badge-success');
      expect(html).toContain('2개 시퀀스 추가됨');
    });

    it('검증 실패 상태일 때 오류 목록과 실패 뱃지를 렌더링한다', () => {
      const mockStatus: EditorPublishStatus = {
        projectId: 'proj-1',
        sourceRevision: 1,
        isFormDirty: true,
        activeContentHash: null,
        previousHealthyHash: null,
        stagedActivationHash: null,
        lastPublishedHash: null,
        isStagedForNextStage: false,
        lastValidation: {
          valid: false,
          errors: ['필수 스테이지 바인딩이 누락되었습니다.', '시퀀스가 최소 1개 이상 필요합니다.'],
          warnings: ['권장 템포 미달'],
          diagnostics: [],
        },
      };

      const html = modalViews.renderPublishModalHTML(mockStatus);
      expect(html).toContain('검증 실패');
      expect(html).toContain('필수 스테이지 바인딩이 누락되었습니다.');
      expect(html).toContain('시퀀스가 최소 1개 이상 필요합니다.');
      expect(html).toContain('수정 중인 미완성 폼 입력이 있습니다');
    });

    it('배포 이력(versions)이 주어지면 히스토리 테이블과 버전 조작 버튼을 렌더링한다', () => {
      const mockVersions: PublishedPackSummary[] = [
        {
          contentHash: 'hash-v1-abcdef12345678',
          sourceProjectId: 'proj-1',
          sourceRevision: 1,
          publishedAt: new Date(1700000000000).toISOString(),
          title: '테스트 안무팩',
        },
      ];

      const statusWithActive: EditorPublishStatus = {
        projectId: 'proj-1',
        sourceRevision: 1,
        isFormDirty: false,
        activeContentHash: 'hash-v1-abcdef12345678',
        previousHealthyHash: null,
        stagedActivationHash: null,
        lastPublishedHash: 'hash-v1-abcdef12345678',
        isStagedForNextStage: false,
        lastValidation: null,
      };

      const html = modalViews.renderPublishModalHTML(statusWithActive, mockVersions);
      expect(html).toContain('data-hash="hash-v1-abcdef12345678"');
      expect(html).toContain('btn-test-version');
      expect(html).toContain('btn-stage-version');
      expect(html).toContain('활성 (Active)');
    });

    it('배포 이력이 없을 때 빈 내역 안내 문구를 렌더링한다', () => {
      const html = modalViews.renderPublishModalHTML(undefined, []);
      expect(html).toContain('게시된 버전이 없습니다');
    });
  });

  describe('3. 테스트 런칭 피드백 HTML (renderTestLaunchFeedbackHTML)', () => {
    it('런칭 성공 시 feedback-success 박스, 해시 일치 여부, 격리 계약 안내를 렌더링한다', () => {
      const successResult: TestLaunchResult = {
        ok: true,
        targetHash: 'abc1234567890def',
        executedHash: 'abc1234567890def',
        descriptor: {
          contentHash: 'abc1234567890def',
          rulesetId: 'ruleset-ch1',
          rulesetHash: 'rule-hash-ch1',
          bpm: 95,
          sourceRevision: 1,
          testPlayUrl: 'http://localhost:3000/?testLaunch=1',
          isIsolatedSession: true,
          isolationContract: 'READ_ONLY_NO_PERSISTENCE',
        },
      };

      const html = modalViews.renderTestLaunchFeedbackHTML(successResult);
      expect(html).toContain('feedback-success');
      expect(html).toContain('테스트 플레이가 격리 세션으로 실행되었습니다');
      expect(html).toContain('✅ 일치 (Matched)');
      expect(html).toContain('abc123456789');
      expect(html).toContain('BPM:');
      expect(html).toContain('격리 계약');
    });

    it('해시 불일치 시 불일치 상태를 렌더링한다', () => {
      const mismatchResult: TestLaunchResult = {
        ok: true,
        targetHash: 'abc1234567890def',
        executedHash: 'different-hash-val',
        descriptor: {
          contentHash: 'different-hash-val',
          rulesetId: 'ruleset-ch1',
          rulesetHash: 'rule-hash-ch1',
          bpm: 95,
          sourceRevision: 1,
          testPlayUrl: 'http://localhost:3000/?testLaunch=1',
          isIsolatedSession: true,
          isolationContract: 'READ_ONLY_NO_PERSISTENCE',
        },
      };

      const html = modalViews.renderTestLaunchFeedbackHTML(mismatchResult);
      expect(html).toContain('feedback-success');
      expect(html).toContain('❌ 불일치');
    });

    it('런칭 실패 시 feedback-error 박스 및 에러/진단 메시지를 렌더링한다', () => {
      const failResult: TestLaunchResult = {
        ok: false,
        error: '필수 바인딩 누락으로 실행 차단',
        diagnostics: ['ch1:RUN_QUESTION 시퀀스 필요'],
      };

      const html = modalViews.renderTestLaunchFeedbackHTML(failResult);
      expect(html).toContain('feedback-error');
      expect(html).toContain('테스트 플레이 실행 차단 / 실패');
      expect(html).toContain('필수 바인딩 누락으로 실행 차단');
      expect(html).toContain('ch1:RUN_QUESTION 시퀀스 필요');
    });
  });

  describe('4. EditorLayout과의 위임 및 100% 하위 호환성 검증', () => {
    it('EditorLayout 인스턴스는 modalViews 게터를 제공한다', () => {
      expect(layout.modalViews).toBeInstanceOf(EditorModalViews);
    });

    it('layout.renderStageBindingsPanelHTML() 결과는 modalViews 결과와 동일하다', () => {
      expect(layout.renderStageBindingsPanelHTML()).toBe(
        layout.modalViews.renderStageBindingsPanelHTML()
      );
    });

    it('layout.renderPublishModalHTML() 결과는 modalViews 결과와 동일하다', () => {
      expect(layout.renderPublishModalHTML()).toBe(
        layout.modalViews.renderPublishModalHTML()
      );
    });

    it('layout.renderTestLaunchFeedbackHTML() 결과는 modalViews 결과와 동일하다', () => {
      const dummyResult: TestLaunchResult = {
        ok: false,
        error: '테스트 에러',
      };
      expect(layout.renderTestLaunchFeedbackHTML(dummyResult)).toBe(
        layout.modalViews.renderTestLaunchFeedbackHTML(dummyResult)
      );
    });

    it('renderFullLayoutHTML에 바인딩 모달과 배포 모달 컨테이너가 정상 포함된다', () => {
      const fullHtml = layout.renderFullLayoutHTML();
      expect(fullHtml).toContain('id="bindings-modal-container"');
      expect(fullHtml).toContain('id="publish-modal-container"');
      expect(fullHtml).toContain('stage-bindings-panel');
      expect(fullHtml).toContain('publish-modal-panel');
    });
  });
});
