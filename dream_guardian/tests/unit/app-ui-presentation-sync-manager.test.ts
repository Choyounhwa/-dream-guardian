/**
 * app-ui-presentation-sync-manager.test.ts
 *
 * [REFACTOR-SRP-012] (Issue #643)
 * AppUIPresentationSyncManager 단위 테스트
 *
 * 1. applyUIPresentation: 렌더러/모달에 정상 전파 및 이전 상태 캐싱 검증
 * 2. setUIPresentationArtifact & flushPendingUIPresentation: 인게임 대기(pending) 및 플러시 적용 검증
 * 3. rollbackUIPresentation: 정상 롤백 및 fallback 처리 검증
 * 4. loadQuestions / loadFitnessPatterns: CSV 로드 및 세션/커스텀팩 충돌 가드 검증
 * 5. loadStaticManifest / loadLocalTestOverride: 성공 및 실패/fallback 분기 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppUIPresentationSyncManager,
  type AppUIPresentationSyncHost,
} from '../../src/core/bootstrap/AppUIPresentationSyncManager.js';
import {
  createDefaultUIPresentationDocument,
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_DESIGN_CANVAS,
} from '../../src/data/UIPresentation.js';
import { computeContentHash } from '../../src/data/ContentCanonical.js';
import {
  type UIPresentationArtifact,
  type UIPresentationLoadResult,
  DEFAULT_RENDERER_CAPABILITY,
} from '../../src/core/UIPresentationLoadService.js';
import type { PublishedContentPack } from '../../src/data/PublishedContentPack.js';

function createMockRenderer() {
  return {
    setPresentationContext: vi.fn(),
    clearPresentationContext: vi.fn(),
  };
}

function createValidTestArtifact(overrides?: Partial<UIPresentationArtifact>): UIPresentationArtifact {
  const baseDoc = createDefaultUIPresentationDocument();
  const manifest = overrides?.manifest ?? { assetIds: [] };
  const pages = overrides?.pages ?? baseDoc.pages;
  const resolution = overrides?.resolution ?? {
    width: UI_DESIGN_CANVAS.width,
    height: UI_DESIGN_CANVAS.height,
  };

  const contentToHash = { manifest, pages, resolution };
  const calculatedContentHash = computeContentHash(contentToHash);

  const envelope: UIPresentationArtifact = {
    kind: UI_PRESENTATION_ARTIFACT_KIND,
    version: UI_PRESENTATION_VERSION,
    resolution,
    baseline: 'ui-baseline-v1',
    rendererFingerprint: DEFAULT_RENDERER_CAPABILITY,
    sourceProjectId: 'test-project-sync',
    sourceRevision: 1,
    sourceCheckpointId: 'cp-sync-01',
    sourceCheckpointHash: 'chk-sync-01',
    pages,
    manifest,
    contentHash: calculatedContentHash,
    ...overrides,
  };

  const finalContentHash = overrides?.contentHash ?? calculatedContentHash;
  envelope.contentHash = finalContentHash;

  const calculatedArtifactHash = computeContentHash(envelope);
  const finalArtifactHash = overrides?.integrity?.artifactHash ?? calculatedArtifactHash;
  envelope.integrity = {
    artifactHash: finalArtifactHash,
    algorithm: 'sha256',
  };

  return envelope;
}

describe('AppUIPresentationSyncManager [REFACTOR-SRP-012]', () => {
  let host: AppUIPresentationSyncHost;
  let renderers: Record<string, ReturnType<typeof createMockRenderer>>;
  let mockUiLoadService: any;
  let mockContentLoadService: any;
  let mockQuestionBank: any;
  let mockBeatCoordinator: any;
  let mockSessionLifecycle: any;
  let mockSessionContext: any;
  let isPlaying: boolean;

  beforeEach(() => {
    isPlaying = false;
    renderers = {
      menuRenderer: createMockRenderer(),
      hudLayer: createMockRenderer(),
      bottomBar: createMockRenderer(),
      pauseModal: createMockRenderer(),
      settingsModal: createMockRenderer(),
      resultRenderer: createMockRenderer(),
      readyPositionRenderer: createMockRenderer(),
      runningMatRenderer: createMockRenderer(),
      questionRenderer: createMockRenderer(),
      presentationAdapter: createMockRenderer(),
      beatHUDRenderer: createMockRenderer(),
      bossRenderer: createMockRenderer(),
      bossClimaxRenderer: createMockRenderer(),
    };

    mockUiLoadService = {
      currentGeneration: 1,
      previousHealthyPresentation: null,
      loadPresentation: vi.fn(async (artifact: UIPresentationArtifact) => {
        return {
          status: 'success',
          presentation: createDefaultUIPresentationDocument(),
          artifact,
          generation: 1,
        } as UIPresentationLoadResult;
      }),
    };

    mockContentLoadService = {
      loadStaticManifest: vi.fn(),
      loadLocalTestOverride: vi.fn(),
    };

    mockQuestionBank = {
      loadRecords: vi.fn(),
    };

    mockBeatCoordinator = {
      setKeynotes: vi.fn(),
    };

    mockSessionLifecycle = {
      sessionId: 'session-123',
      isTestSession: false,
    };

    mockSessionContext = {
      contentGeneration: 1,
      contentMode: 'builtin',
      applyCsvKeynotes: vi.fn(() => true),
    };

    host = {
      uiPresentationLoadService: mockUiLoadService,
      contentLoadService: mockContentLoadService,
      questionBank: mockQuestionBank,
      beatCoordinator: mockBeatCoordinator,
      sessionLifecycle: mockSessionLifecycle,
      getSessionContext: () => mockSessionContext,
      isPlaying: () => isPlaying,
      menuRenderer: renderers.menuRenderer,
      hudLayer: renderers.hudLayer,
      bottomBar: renderers.bottomBar,
      pauseModal: renderers.pauseModal,
      settingsModal: renderers.settingsModal,
      resultRenderer: renderers.resultRenderer,
      readyPositionRenderer: renderers.readyPositionRenderer,
      runningMatRenderer: renderers.runningMatRenderer,
      questionRenderer: renderers.questionRenderer,
      presentationAdapter: renderers.presentationAdapter,
      beatHUDRenderer: renderers.beatHUDRenderer,
      bossRenderer: renderers.bossRenderer,
      bossClimaxRenderer: renderers.bossClimaxRenderer,
    };
  });

  describe('1. applyUIPresentation', () => {
    it('유효한 프레젠테이션 주입 시 모든 렌더러에 setPresentationContext 전파', () => {
      const manager = new AppUIPresentationSyncManager(host);
      const doc = createDefaultUIPresentationDocument();
      const artifact = createValidTestArtifact();

      manager.applyUIPresentation(doc, artifact);

      expect(manager.activeUIPresentation).toBe(doc);
      expect(manager.activeUIArtifact).toBe(artifact);
      expect(renderers.menuRenderer.setPresentationContext).toHaveBeenCalledWith({ presentationDocument: doc });
      expect(renderers.hudLayer.setPresentationContext).toHaveBeenCalledWith({ presentationDocument: doc });
      expect(renderers.pauseModal.setPresentationContext).toHaveBeenCalledWith({ presentationDocument: doc, pageId: 'pause' });
      expect(renderers.bossClimaxRenderer.setPresentationContext).toHaveBeenCalledWith({ presentationDocument: doc, pageId: 'boss_battle' });
    });

    it('null 전달 시 모든 렌더러의 clearPresentationContext 호출', () => {
      const manager = new AppUIPresentationSyncManager(host);
      const doc = createDefaultUIPresentationDocument();
      manager.applyUIPresentation(doc);

      manager.applyUIPresentation(null);

      expect(manager.activeUIPresentation).toBeNull();
      expect(manager.activeUIArtifact).toBeNull();
      expect(renderers.menuRenderer.clearPresentationContext).toHaveBeenCalled();
      expect(renderers.hudLayer.clearPresentationContext).toHaveBeenCalled();
      expect(renderers.pauseModal.clearPresentationContext).toHaveBeenCalled();
      expect(renderers.bossClimaxRenderer.clearPresentationContext).toHaveBeenCalled();
    });

    it('다른 정상 문서 적용 시 이전 문서를 previousHealthyPresentation으로 백업', () => {
      const manager = new AppUIPresentationSyncManager(host);
      const doc1 = createDefaultUIPresentationDocument();
      const art1 = createValidTestArtifact();
      const doc2 = createDefaultUIPresentationDocument();
      const art2 = createValidTestArtifact();

      manager.applyUIPresentation(doc1, art1);
      expect(manager.previousHealthyPresentation).toBeNull();

      manager.applyUIPresentation(doc2, art2);
      expect(manager.previousHealthyPresentation).toBe(doc1);
      expect(manager.previousHealthyArtifact).toBe(art1);
      expect(manager.activeUIPresentation).toBe(doc2);
    });
  });

  describe('2. setUIPresentationArtifact & flushPendingUIPresentation', () => {
    it('인게임 중이 아닐 때(isPlaying=false) 즉시 적용', async () => {
      isPlaying = false;
      const manager = new AppUIPresentationSyncManager(host);
      const artifact = createValidTestArtifact();

      const result = await manager.setUIPresentationArtifact(artifact);

      expect(result.status).toBe('success');
      expect(manager.activeUIArtifact).toBe(artifact);
      expect(manager.pendingUIArtifact).toBeNull();
      expect(renderers.hudLayer.setPresentationContext).toHaveBeenCalled();
    });

    it('인게임 중일 때(isPlaying=true) pending 대기 후 flushPendingUIPresentation 시 적용', async () => {
      isPlaying = true;
      const manager = new AppUIPresentationSyncManager(host);
      const artifact = createValidTestArtifact();

      const result = await manager.setUIPresentationArtifact(artifact);

      expect(result.status).toBe('success');
      expect(manager.activeUIArtifact).toBeNull();
      expect(manager.pendingUIArtifact).toBe(artifact);
      if (result.status === 'success') {
        expect(manager.pendingUIPresentation).toBe(result.presentation);
      }
      expect(renderers.hudLayer.setPresentationContext).not.toHaveBeenCalled();

      const flushed = manager.flushPendingUIPresentation();
      expect(flushed).toBe(true);
      expect(manager.activeUIArtifact).toBe(artifact);
      expect(manager.pendingUIArtifact).toBeNull();
      expect(manager.pendingUIPresentation).toBeNull();
      expect(renderers.hudLayer.setPresentationContext).toHaveBeenCalled();

      // 두 번째 호출 시 false 반환
      expect(manager.flushPendingUIPresentation()).toBe(false);
    });

    it('artifact=null 전달 시 즉시 초기화', async () => {
      const manager = new AppUIPresentationSyncManager(host);
      manager.applyUIPresentation(createDefaultUIPresentationDocument());

      const result = await manager.setUIPresentationArtifact(null);

      expect(result.status).toBe('success');
      expect(manager.activeUIPresentation).toBeNull();
      expect(renderers.hudLayer.clearPresentationContext).toHaveBeenCalled();
    });
  });

  describe('3. rollbackUIPresentation', () => {
    it('이전 정상본이 있을 때 이전 정상본으로 롤백', () => {
      const manager = new AppUIPresentationSyncManager(host);
      const doc1 = createDefaultUIPresentationDocument();
      const art1 = createValidTestArtifact();
      const doc2 = createDefaultUIPresentationDocument();
      const art2 = createValidTestArtifact();

      manager.applyUIPresentation(doc1, art1);
      manager.applyUIPresentation(doc2, art2);

      const rolled = manager.rollbackUIPresentation();
      expect(rolled).toBe(true);
      expect(manager.activeUIPresentation).toBe(doc1);
      expect(manager.activeUIArtifact).toBe(art1);
    });

    it('이전 정상본이 없지만 activeUIPresentation이 있으면 null로 롤백', () => {
      const manager = new AppUIPresentationSyncManager(host);
      manager.applyUIPresentation(createDefaultUIPresentationDocument());

      const rolled = manager.rollbackUIPresentation();
      expect(rolled).toBe(true);
      expect(manager.activeUIPresentation).toBeNull();
    });

    it('active도 없고 이전본도 없으면 false 반환', () => {
      const manager = new AppUIPresentationSyncManager(host);
      expect(manager.rollbackUIPresentation()).toBe(false);
    });
  });

  describe('4. loadQuestions & loadFitnessPatterns', () => {
    it('loadQuestions: 정상 CSV 응답 시 문제 파싱 후 questionBank에 로드', async () => {
      const csvData =
        'level,subLevel,levelTitle,subLevelTitle,questionTemplate,answerEval,wrongEval,varA,varB,varC,varD,shapeCode\n' +
        '1,1,Ch1,Sub1,1+1=?,2,1,1,1,0,0,ADD';
      const mockFetch = vi.fn(async () => ({
        ok: true,
        text: async () => csvData,
      } as any));

      const manager = new AppUIPresentationSyncManager({ ...host, fetch: mockFetch as any });
      await manager.loadQuestions();

      expect(mockQuestionBank.loadRecords).toHaveBeenCalled();
      const passedRecords = mockQuestionBank.loadRecords.mock.calls[0][0];
      expect(passedRecords.length).toBe(1);
    });

    it('loadFitnessPatterns: 정상 CSV 파싱 후 beatCoordinator에 전달', async () => {
      const csvData =
        'ID,사용 부위,왼손,오른손,머리,골반,판정 부위 수\n' +
        'S01,왼손 뻗기,1,X,X,X,1';
      const mockFetch = vi.fn(async () => ({
        ok: true,
        text: async () => csvData,
      } as any));

      const manager = new AppUIPresentationSyncManager({ ...host, fetch: mockFetch as any });
      await manager.loadFitnessPatterns();

      expect(mockSessionContext.applyCsvKeynotes).toHaveBeenCalled();
      expect(mockBeatCoordinator.setKeynotes).toHaveBeenCalled();
    });

    it('loadFitnessPatterns: 세션 변경 시(race condition) 로드 무시', async () => {
      const csvData =
        'ID,사용 부위,왼손,오른손,머리,골반,판정 부위 수\n' +
        'S01,왼손 뻗기,1,X,X,X,1';
      const mockFetch = vi.fn(async () => {
        // 응답 도중 세션 변경 시뮬레이션
        mockSessionLifecycle.sessionId = 'session-changed';
        return {
          ok: true,
          text: async () => csvData,
        } as any;
      });

      const manager = new AppUIPresentationSyncManager({ ...host, fetch: mockFetch as any });
      await manager.loadFitnessPatterns();

      expect(mockBeatCoordinator.setKeynotes).not.toHaveBeenCalled();
    });
  });

  describe('5. loadStaticManifest & loadLocalTestOverride', () => {
    it('loadStaticManifest: 성공 시 activePublishedPack 설정 및 true 반환', async () => {
      const mockPack: PublishedContentPack = {
        manifest: { id: 'pack-1', title: 'Pack 1' } as any,
        metadata: {} as any,
      } as any;

      mockContentLoadService.loadStaticManifest.mockResolvedValueOnce({
        status: 'success',
        pack: mockPack,
      });

      const manager = new AppUIPresentationSyncManager(host);
      const success = await manager.loadStaticManifest('https://example.com/manifest.json');

      expect(success).toBe(true);
      expect(manager.activePublishedPack).toBe(mockPack);
    });

    it('loadStaticManifest: fallback 시 fallbackPack 설정 및 false 반환', async () => {
      const fallbackPack: PublishedContentPack = {
        manifest: { id: 'fallback-pack' } as any,
      } as any;

      mockContentLoadService.loadStaticManifest.mockResolvedValueOnce({
        status: 'fallback',
        fallbackPack,
      });

      const manager = new AppUIPresentationSyncManager(host);
      const success = await manager.loadStaticManifest();

      expect(success).toBe(false);
      expect(manager.activePublishedPack).toBe(fallbackPack);
    });

    it('loadLocalTestOverride: 성공 시 activePublishedPack 설정 및 true 반환', async () => {
      const testPack: PublishedContentPack = {
        manifest: { id: 'test-override' } as any,
      } as any;

      mockContentLoadService.loadLocalTestOverride.mockResolvedValueOnce({
        status: 'success',
        pack: testPack,
      });

      const manager = new AppUIPresentationSyncManager(host);
      const success = await manager.loadLocalTestOverride('test-pack');

      expect(success).toBe(true);
      expect(manager.activePublishedPack).toBe(testPack);
    });
  });
});
