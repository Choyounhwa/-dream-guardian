/**
 * editor-publish.test.ts - 검증·새 버전 게시·적용 예약 UI 연계 테스트
 *
 * Issue #387 / EDITOR-PUBLISH:
 * 1. 프로젝트 유효성 검증(validateProject) 및 컴파일(compileProject) 연계
 * 2. 미완성/수정 중인 폼(dirty/uncommitted form input)이 있을 경우 게시 차단 (명시 확정 또는 취소 필요)
 * 3. 검증 결과 에러/경고 목록, sourceRevision, contentHash, diff 요약 상태 모델 제공
 * 4. 게시(publish): PublishedContentStore 불변 저장 연동
 * 5. 적용 예약(stageActivation / scheduleRollback): "다음 스테이지 시작 시 적용" 예약 상태로 등록하며, "현재 실행 중인 세션에 즉시 반영된다"고 잘못 표시하지 않음
 * 6. 검증 또는 게시 실패 시 기존 activeContentHash 및 현재 작업 프로젝트 상태 보존
 * 7. 이전 정상본(previousHealthyHash) 목록 조회 및 롤백 예약(rollback) 액션 연동 (삭제 없는 안전한 롤백)
 * 8. Project / Library / CompiledContentPack 간 kind 검증 (kind 혼동 거부)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { EditorPublishController } from '../../src/editor/EditorPublishController.js';
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
import { PUBLISHED_PACK_KIND } from '../../src/data/PublishedContentPack.js';
import { DEFAULT_RULESET_ID } from '../../src/data/ContentCapabilities.js';

function createValidProject(projectId: string = 'proj_pub_01', revision: number = 1, bpm: number = 120): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId,
    revision,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: `Ch1 Dance Routine rev${revision}`,
      description: 'Validation & publish test routine',
      author: 'Author Tester',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
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

describe('EditorPublishController - 검증·새 버전 게시·적용 예약 (#387)', () => {
  let adapter: MemoryIndexedDBAdapter;
  let db: EditorContentDatabase;
  let store: PublishedContentStore;
  let state: EditorState;
  let controller: EditorPublishController;

  beforeEach(async () => {
    adapter = new MemoryIndexedDBAdapter();
    await adapter.open();
    db = new EditorContentDatabase(adapter);
    store = new PublishedContentStore(db);
    state = new EditorState();

    const proj = createValidProject('proj_pub_01', 1, 120);
    state.applyProject(proj);

    controller = new EditorPublishController(state, store, db);
  });

  describe('1. 미완성/수정 중인 폼(dirty input) 게시 차단', () => {
    it('폼 버퍼에 미반영 변경이 있으면 hasUncommittedChanges가 true가 되고 게시를 차단한다', async () => {
      // 슬롯 폼 버퍼에 수정 중 상태 주입
      state.setFormBuffer(0, {
        part: 'leftHand',
        zoneId: 4,
        patternId: 'pat_punch_r',
      });

      expect(controller.hasUncommittedChanges()).toBe(true);

      // 검증 시도: dirty 에러 반환
      const valResult = await controller.validateProject();
      expect(valResult.valid).toBe(false);
      expect(valResult.errors.some((e) => e.includes('미완성') || e.includes('Uncommitted') || e.includes('수정 중'))).toBe(true);

      // 게시 시도 시 에러 발생 및 게시 거부
      await expect(controller.publish()).rejects.toThrow(/Uncommitted|수정 중|미완성/i);

      // 활성 상태가 생성되지 않고 보존됨
      const head = await store.getActivationHead('proj_pub_01');
      expect(head).toBeNull();
    });

    it('컨트롤러 자체 setFormDirty(true) 설정 시에도 게시가 차단되고 취소(clear) 시 정상화된다', async () => {
      controller.setFormDirty(true);
      expect(controller.hasUncommittedChanges()).toBe(true);

      await expect(controller.publish()).rejects.toThrow();

      controller.setFormDirty(false);
      state.clearFormBuffer();
      expect(controller.hasUncommittedChanges()).toBe(false);

      const valResult = await controller.validateProject();
      expect(valResult.valid).toBe(true);
    });
  });

  describe('2. 유효하지 않은 프로젝트 검증 실패 시 게시 중단 및 상태 보존', () => {
    it('규칙 위반(미지원 BPM 등) 프로젝트는 검증 실패 및 게시가 중단된다', async () => {
      const invalidProj = createValidProject('proj_pub_01', 1, 300); // 300 BPM (지원 범위 40~240 초과)
      state.applyProject(invalidProj);

      const valResult = await controller.validateProject();
      expect(valResult.valid).toBe(false);
      expect(valResult.errors.length).toBeGreaterThan(0);

      await expect(controller.publish()).rejects.toThrow(/validation|검증/i);
    });

    it('게시 실패 후에도 기존 activeContentHash 및 현재 작업 프로젝트 상태가 보존된다', async () => {
      // 먼저 정상 프로젝트로 게시 및 활성화
      const validProj = createValidProject('proj_pub_01', 1, 120);
      state.applyProject(validProj);
      const firstPub = await controller.publish({ stageActivation: true });
      expect(firstPub.success).toBe(true);
      const originalActiveHash = firstPub.contentHash;

      // 이후 잘못된 프로젝트를 작업 상태로 적용하고 게시 시도
      const invalidProj = createValidProject('proj_pub_01', 2, 300);
      state.applyProject(invalidProj);

      await expect(controller.publish()).rejects.toThrow();

      // 기존 activeContentHash가 변경되지 않고 보존되어야 함
      const head = await store.getActivationHead('proj_pub_01');
      expect(head?.activeContentHash).toBe(originalActiveHash);
    });
  });

  describe('3. 정상 프로젝트 검증 → 컴파일 → 불변 게시본 저장 흐름', () => {
    it('검증 성공 시 diff 요약, sourceRevision, contentHash를 정상 생성하고 불변 저장소에 저장한다', async () => {
      const valResult = await controller.validateProject();
      expect(valResult.valid).toBe(true);
      expect(valResult.errors).toHaveLength(0);
      expect(valResult.sourceRevision).toBe(1);
      expect(valResult.contentHash).toBeDefined();
      expect(valResult.diffSummary).toBeDefined();
      expect(valResult.diffSummary?.isFirstPublish).toBe(true);

      // 게시 실행
      const pubResult = await controller.publish();
      expect(pubResult.success).toBe(true);
      expect(pubResult.contentHash).toBe(valResult.contentHash);

      // PublishedContentStore에서 contentHash로 조회 가능 확인
      const savedPack = await store.getPublishedPack(pubResult.contentHash);
      expect(savedPack).not.toBeNull();
      expect(savedPack?.contentHash).toBe(pubResult.contentHash);
      expect(savedPack?.kind).toBe(PUBLISHED_PACK_KIND);
    });
  });

  describe('4. 게시와 다음 스테이지 적용 예약(stage activation) 분리 상태', () => {
    it('단순 게시 시 즉시 활성화되지 않고, 적용 예약 시 "다음 스테이지 적용" 상태로 설정된다', async () => {
      // 1. 단순 게시 (stageActivation: false)
      const pubResult = await controller.publish({ stageActivation: false });
      expect(pubResult.success).toBe(true);

      const statusAfterPub = await controller.getStatus();
      expect(statusAfterPub.lastPublishedHash).toBe(pubResult.contentHash);
      expect(statusAfterPub.isStagedForNextStage).toBe(false);

      // "현재 세션에 즉시 반영된다"고 잘못 표시하지 않는 안내 문구 확인
      const statusText = controller.getActivationNoticeText();
      expect(statusText).toContain('다음 스테이지');
      expect(statusText).not.toContain('실행 중인 세션에 즉시 반영');

      // 2. 적용 예약 (stageActivation 호출)
      const stageRes = await controller.stageActivation(pubResult.contentHash);
      expect(stageRes.success).toBe(true);
      expect(stageRes.stagedHash).toBe(pubResult.contentHash);

      const statusAfterStage = await controller.getStatus();
      expect(statusAfterStage.isStagedForNextStage).toBe(true);
      expect(statusAfterStage.stagedActivationHash).toBe(pubResult.contentHash);
    });
  });

  describe('5. 이전 정상본(previousHealthyHash) 대상 롤백 예약', () => {
    it('이전 정상본 목록을 확인하고 삭제 없는 안전한 롤백을 예약할 수 있다', async () => {
      // v1 게시 및 활성화
      const v1Proj = createValidProject('proj_pub_01', 1, 110);
      state.applyProject(v1Proj);
      const pub1 = await controller.publish({ stageActivation: true });
      const hash1 = pub1.contentHash;

      // v2 게시 및 활성화
      const v2Proj = createValidProject('proj_pub_01', 2, 120);
      state.applyProject(v2Proj);
      const pub2 = await controller.publish({ stageActivation: true });
      const hash2 = pub2.contentHash;

      // 이전 정상본(previousHealthyHash)이 hash1인지 확인
      const prevHealthy = await controller.getPreviousHealthyHash();
      expect(prevHealthy).toBe(hash1);

      // 게시 목록 조회 (삭제되지 않고 모두 보존)
      const versions = await controller.listPublishedVersions();
      expect(versions.length).toBeGreaterThanOrEqual(2);
      expect(versions.some((v) => v.contentHash === hash1)).toBe(true);
      expect(versions.some((v) => v.contentHash === hash2)).toBe(true);

      // 롤백 예약 (hash1로 scheduleRollback)
      const rollbackRes = await controller.scheduleRollback();
      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.scheduledHash).toBe(hash1);

      // 롤백 후에도 hash2 팩이 삭제되지 않고 남아있음을 확인 (비파괴적 롤백)
      const hash2Pack = await store.getPublishedPack(hash2);
      expect(hash2Pack).not.toBeNull();
    });
  });

  describe('6. 잘못된 파일 kind(라이브러리 json 등) 게시 시도 거부', () => {
    it('컴파일된 ContentPack 객체를 프로젝트로 게시하려 하면 kind 혼동으로 거부한다', async () => {
      const fakePack = {
        kind: PUBLISHED_PACK_KIND,
        contentHash: 'hash_abc',
        sourceProjectId: 'proj_pub_01',
      };

      const valResult = await controller.validateProject(fakePack);
      expect(valResult.valid).toBe(false);
      expect(valResult.errors.some((e) => e.includes('kind') || e.includes('ContentPack'))).toBe(true);

      await expect(controller.publishFromProject(fakePack as any)).rejects.toThrow(/kind/i);
    });

    it('패턴 라이브러리 형태의 JSON을 프로젝트로 게시하려 하면 거부한다', async () => {
      const fakeLibrary = {
        kind: 'dream-guardian-pattern-library',
        patterns: [{ id: 'p1', name: 'Pat1' }],
      };

      const valResult = await controller.validateProject(fakeLibrary);
      expect(valResult.valid).toBe(false);
      expect(valResult.errors.some((e) => e.includes('kind') || e.includes('library'))).toBe(true);

      await expect(controller.publishFromProject(fakeLibrary as any)).rejects.toThrow(/kind/i);
    });

    it('null이나 임의의 객체를 게시하려 하면 안전하게 거부한다', async () => {
      const valResult = await controller.validateProject(null);
      expect(valResult.valid).toBe(false);
      expect(valResult.errors.length).toBeGreaterThan(0);

      await expect(controller.publishFromProject({} as any)).rejects.toThrow();
    });
  });

  describe('7. EditorLayout 게시/릴리즈 UI 렌더링 연계', () => {
    it('상단 헤더에 검증·게시·릴리즈 관리 버튼이 렌더링된다', () => {
      const layout = new EditorLayout(state);
      const html = layout.renderHeaderHTML();

      expect(html).toContain('btn-validate-project');
      expect(html).toContain('btn-publish-project');
      expect(html).toContain('btn-manage-releases');
    });

    it('상태 표시줄에 활성/예약 해시 배지가 렌더링된다', async () => {
      const layout = new EditorLayout(state);
      const pubResult = await controller.publish({ stageActivation: true });
      const status = await controller.getStatus();

      const html = layout.renderStatusBarHTML(status);
      expect(html).toContain('status-active-hash');
      expect(html).toContain(pubResult.contentHash.slice(0, 8));
    });

    it('게시 및 릴리즈 모달 HTML이 정상 렌더링되며 버전 이력을 포함한다', async () => {
      const layout = new EditorLayout(state);
      await controller.publish({ stageActivation: true });
      const status = await controller.getStatus();
      const versions = await controller.listPublishedVersions();

      const modalHtml = layout.renderPublishModalHTML(status, versions);
      expect(modalHtml).toContain('publish-modal-panel');
      expect(modalHtml).toContain('btn-modal-validate');
      expect(modalHtml).toContain('btn-modal-publish');
      expect(modalHtml).toContain('btn-modal-stage-activation');
      expect(modalHtml).toContain('btn-modal-rollback');
      expect(modalHtml).toContain('다음 스테이지 시작 시');
      expect(modalHtml).toContain(versions[0].contentHash.slice(0, 12));
    });
  });
});
