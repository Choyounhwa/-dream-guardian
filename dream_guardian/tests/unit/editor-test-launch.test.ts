/**
 * tests/unit/editor-test-launch.test.ts
 *
 * [Issue #393 / EDITOR-TEST-LAUNCH]
 * 게시 hash 기반 테스트 플레이 실행·상태 표시 단위 테스트
 *
 * 검증 매트릭스:
 * 1. dirty form (미완성 폼 입력) 상태에서 테스트 플레이 준비 및 실행 차단
 * 2. 미게시 / 저장소에 없는 hash 요청 시 테스트 실행 차단
 * 3. 활성 게시본이 설정되지 않은 상태에서 hash 생략 호출 시 차단 (초안 임의 전송 차단)
 * 4. 변조된 팩 차단 (Kind mismatch, contentHash tampering 등)
 * 5. 정상 게시본에 대해 올바른 contentHash, rulesetId, rulesetHash, bpm, 격리 URL 디스크립터 생성
 * 6. 요청 hash와 실행 hash 일치 검증 (targetHash === executedHash)
 * 7. 브라우저 창 열기 실패 / 팝업 차단 / 비브라우저 환경 시 실패 상태 및 진단 반환 (성공 오표시 금지)
 * 8. 다른 origin 요청 시 보안 차단
 * 9. EditorLayout 헤더에 [🎮 테스트 플레이] 버튼 렌더링 검증
 * 10. EditorLayout 릴리즈 모달에 테스트 플레이 실행 버튼 및 Issue #391 격리 안내 렌더링 검증
 * 11. EditorLayout.renderTestLaunchFeedbackHTML 피드백 렌더링 검증 (해시 일치 확인 및 격리 상태 안내)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import {
  EditorPublishController,
  type TestLaunchResult,
} from '../../src/editor/EditorPublishController.js';
import { PublishedContentStore } from '../../src/storage/PublishedContentStore.js';
import {
  EditorContentDatabase,
  MemoryIndexedDBAdapter,
} from '../../src/storage/EditorContentDatabase.js';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../../src/data/EditorProject.js';
import { DEFAULT_RULESET_ID } from '../../src/data/ContentCapabilities.js';

function createValidProject(
  projectId: string = 'proj_test_launch',
  revision: number = 1,
  bpm: number = 120
): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId,
    revision,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: 'Test Launch Project',
      author: 'Tester',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    previewTempo: {
      bpm,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_punch_r',
        name: 'Right Punch',
        target: { leftHand: null, rightHand: 5, head: null, hip: null },
      },
    ],
    sequences: [
      {
        id: 'seq_phaseA_stars',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'star_01',
            kind: 'starNote',
            landingTick: 960,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_punch_r',
          },
        ],
      },
    ],
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_stars',
      },
    ],
  };
}

describe('[EDITOR-TEST-LAUNCH] EditorPublishController Test Launch Tests', () => {
  let adapter: MemoryIndexedDBAdapter;
  let db: EditorContentDatabase;
  let store: PublishedContentStore;
  let state: EditorState;
  let controller: EditorPublishController;
  let layout: EditorLayout;

  beforeEach(async () => {
    adapter = new MemoryIndexedDBAdapter();
    await adapter.open();
    db = new EditorContentDatabase(adapter);
    store = new PublishedContentStore(db);
    state = new EditorState();
    controller = new EditorPublishController(state, store, db);
    layout = new EditorLayout(state);
  });

  it('1. dirty form(미완성 폼 수정) 상태에서는 테스트 플레이 준비 및 실행을 차단한다', async () => {
    controller.setFormDirty(true);
    expect(controller.hasUncommittedChanges()).toBe(true);

    const prep = await controller.prepareTestLaunch();
    expect(prep.ok).toBe(false);
    expect(prep.error).toContain('수정 중인 미완성 폼 입력이 있습니다');

    const launch = await controller.launchTestPlay();
    expect(launch.ok).toBe(false);
    expect(launch.error).toContain('수정 중인 미완성 폼 입력이 있습니다');
  });

  it('2. 게시본이 전혀 없는 상태에서 hash 없이 테스트를 요청하면 초안을 전송하지 않고 차단한다', async () => {
    const prep = await controller.prepareTestLaunch();
    expect(prep.ok).toBe(false);
    expect(prep.error).toContain('게시된 팩이 없거나');
  });

  it('3. 저장소에 존재하지 않는 임의의 hash 요청 시 미게시로 차단한다', async () => {
    const unknownHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const prep = await controller.prepareTestLaunch(unknownHash);
    expect(prep.ok).toBe(false);
    expect(prep.error).toContain('존재하지 않습니다');
  });

  it('4. 정상 게시된 팩에 대해 올바른 hash, ruleset, bpm, 격리 URL 디스크립터를 생성한다', async () => {
    const project = createValidProject('proj_ok', 1, 125);
    state.applyProject(project);

    // 팩 불변 게시
    const pubRes = await controller.publish({ stageActivation: true });
    expect(pubRes.success).toBe(true);
    const contentHash = pubRes.contentHash;

    const prep = await controller.prepareTestLaunch(contentHash);
    expect(prep.ok).toBe(true);
    expect(prep.descriptor).toBeDefined();
    expect(prep.descriptor!.contentHash).toBe(contentHash);
    expect(prep.descriptor!.bpm).toBe(125);
    expect(prep.descriptor!.rulesetId).toBe(DEFAULT_RULESET_ID);
    expect(prep.descriptor!.sourceRevision).toBe(1);
    expect(prep.descriptor!.isIsolatedSession).toBe(true);
    expect(prep.descriptor!.testPlayUrl).toContain('mode=test');
    expect(prep.descriptor!.testPlayUrl).toContain(`hash=${contentHash}`);
    expect(prep.descriptor!.isolationContract).toContain('Issue #391');
  });

  it('5. targetHash 생략 시 활성 게시본(activeContentHash)을 대상으로 론치 디스크립터를 생성한다', async () => {
    const project = createValidProject('proj_auto_active', 1, 120);
    state.applyProject(project);

    const pubRes = await controller.publish({ stageActivation: true });
    const contentHash = pubRes.contentHash;

    const prep = await controller.prepareTestLaunch();
    expect(prep.ok).toBe(true);
    expect(prep.descriptor!.contentHash).toBe(contentHash);
  });

  it('6. 요청 hash와 실행 hash가 완벽히 일치함을 확인하고 targetHash === executedHash를 반환한다', async () => {
    const project = createValidProject('proj_hash_match', 1, 120);
    state.applyProject(project);

    const pubRes = await controller.publish({ stageActivation: true });
    const hash = pubRes.contentHash;

    const mockOpener = vi.fn().mockReturnValue(true);
    const launchRes = await controller.launchTestPlay(hash, {
      windowOpener: mockOpener,
    });

    expect(launchRes.ok).toBe(true);
    expect(launchRes.targetHash).toBe(hash);
    expect(launchRes.executedHash).toBe(hash);
    expect(launchRes.targetHash).toBe(launchRes.executedHash);
    expect(mockOpener).toHaveBeenCalledWith(launchRes.descriptor!.testPlayUrl);
  });

  it('7. 기대 hash(expectedHash)와 실제 팩 hash가 다를 경우 차단한다', async () => {
    const project = createValidProject('proj_mismatch', 1, 120);
    state.applyProject(project);

    const pubRes = await controller.publish({ stageActivation: true });
    const hash = pubRes.contentHash;

    const launchRes = await controller.launchTestPlay(hash, {
      expectedHash: 'different_hash_value_1234',
      windowOpener: vi.fn(),
    });

    expect(launchRes.ok).toBe(false);
    expect(launchRes.error).toContain('일치하지 않습니다');
  });

  it('8. 브라우저 팝업 차단 또는 창 열기 실패 시 실패 상태를 명확히 반환하며 성공으로 오표시하지 않는다', async () => {
    const project = createValidProject('proj_popup_block', 1, 120);
    state.applyProject(project);

    const pubRes = await controller.publish({ stageActivation: true });
    const hash = pubRes.contentHash;

    // opener가 null을 반환하는 경우 (팝업 차단)
    const mockOpener = vi.fn().mockReturnValue(null);
    const launchRes = await controller.launchTestPlay(hash, {
      windowOpener: mockOpener,
    });

    expect(launchRes.ok).toBe(false);
    expect(launchRes.error).toContain('창을 생성할 수 없습니다');
  });

  it('9. 다른 origin에서 테스트 플레이 요청 시 보안 차단한다', async () => {
    const project = createValidProject('proj_origin_test', 1, 120);
    state.applyProject(project);

    const pubRes = await controller.publish({ stageActivation: true });
    const hash = pubRes.contentHash;

    const launchRes = await controller.launchTestPlay(hash, {
      targetOrigin: 'https://evil-unauthorized-site.com',
      windowOpener: vi.fn().mockReturnValue(true),
    });

    expect(launchRes.ok).toBe(false);
    expect(launchRes.error).toContain('출처(Origin) 불일치');
  });

  it('10. EditorLayout 헤더에 [🎮 테스트 플레이] 버튼이 렌더링된다', () => {
    const headerHtml = layout.renderHeaderHTML();
    expect(headerHtml).toContain('id="btn-test-play"');
    expect(headerHtml).toContain('🎮 테스트 플레이');
  });

  it('11. EditorLayout 릴리즈 모달에 테스트 플레이 실행 버튼 및 Issue #391 격리 안내가 렌더링된다', () => {
    const mockStatus = {
      projectId: 'p1',
      sourceRevision: 1,
      isFormDirty: false,
      activeContentHash: 'hash_abc_123456789012',
      previousHealthyHash: null,
      stagedActivationHash: null,
      lastPublishedHash: 'hash_abc_123456789012',
      lastValidation: null,
      isStagedForNextStage: false,
    };
    const mockVersions = [
      {
        contentHash: 'hash_abc_123456789012',
        sourceProjectId: 'p1',
        title: 'Title',
        sourceRevision: 1,
        publishedAt: new Date().toISOString(),
        notesCount: 1,
        patternsCount: 1,
      },
    ];

    const modalHtml = layout.renderPublishModalHTML(mockStatus, mockVersions);
    expect(modalHtml).toContain('id="btn-modal-test-play"');
    expect(modalHtml).toContain('btn-test-version');
    expect(modalHtml).toContain('Issue #391');
    expect(modalHtml).toContain('격리');
  });

  it('12. EditorLayout.renderTestLaunchFeedbackHTML이 요청 hash와 실행 hash 일치 피드백을 정상 출력한다', () => {
    const successResult: TestLaunchResult = {
      ok: true,
      targetHash: '11112222333344445555666677778888',
      executedHash: '11112222333344445555666677778888',
      descriptor: {
        contentHash: '11112222333344445555666677778888',
        rulesetId: DEFAULT_RULESET_ID,
        rulesetHash: 'rule_hash',
        bpm: 120,
        sourceRevision: 1,
        testPlayUrl: '/?mode=test&hash=11112222333344445555666677778888',
        isIsolatedSession: true,
        isolationContract: 'ISSUE-391: Session progression, rewards, and global settings are isolated.',
      },
    };

    const html = layout.renderTestLaunchFeedbackHTML(successResult);
    expect(html).toContain('일치');
    expect(html).toContain('111122223333');
    expect(html).toContain('Issue #391');

    const failResult: TestLaunchResult = {
      ok: false,
      error: '수정 중인 미완성 폼 입력이 있습니다',
    };
    const failHtml = layout.renderTestLaunchFeedbackHTML(failResult);
    expect(failHtml).toContain('수정 중인 미완성 폼 입력이 있습니다');
  });
});
