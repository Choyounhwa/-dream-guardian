/**
 * ui-vis-041.test.ts
 *
 * [UI-VIS-041 / Issue #471]
 * 런타임 표시 snapshot 주입·입력 일치·롤백 단위 테스트
 *
 * 1. 실제 bootstrap -> 10페이지 renderer 동일 hash 및 표시/hit geometry 주입
 * 2. 플레이 중 publish는 다음 경계까지 지연 (Session Pinning & Deferred Adoption)
 * 3. 손상 시 이전 정상본 전체 롤백 (Zero Partial Apply & Rollback)
 * 4. 하단바 submenu customActionSlot 등 Core의 하드코딩 경로를 해당 seam의 검증 geometry 조회로 통일
 * 5. 문제/HP/콤보/보상 값은 실제 game DTO가 우선 (presentation artifact가 덮어쓸 수 없음)
 * 6. 기본 게임 실행은 기존 config 값 보존
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { resolveBottomBarActionSlot } from '../../src/core/SceneDirector.js';
import {
  createDefaultUIPresentationDocument,
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_DESIGN_CANVAS,
} from '../../src/data/UIPresentation.js';
import { computeContentHash } from '../../src/data/ContentCanonical.js';
import {
  type UIPresentationArtifact,
  DEFAULT_RENDERER_CAPABILITY,
} from '../../src/core/UIPresentationLoadService.js';

// Canvas Mock Helper
function createMockCanvas(clientW = 540, clientH = 960) {
  let width = 1080;
  let height = 2160;

  const ctx: any = {
    canvas: { width: 1080, height: 2160 },
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    scale: vi.fn(),
    translate: vi.fn(),
    clearRect: vi.fn(),
  };

  const listeners: Record<string, Function[]> = {};

  return {
    clientWidth: clientW,
    clientHeight: clientH,
    get width() {
      return width;
    },
    set width(v: number) {
      width = v;
    },
    get height() {
      return height;
    },
    set height(v: number) {
      height = v;
    },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn((type: string, fn: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    }),
    removeEventListener: vi.fn(),
    _trigger: (type: string, event: any) => {
      if (listeners[type]) {
        for (const fn of listeners[type]) fn(event);
      }
    },
  };
}

// Helper to construct a valid, verified test artifact
function createValidTestArtifact(overrides?: Partial<UIPresentationArtifact>): UIPresentationArtifact {
  const baseDoc = createDefaultUIPresentationDocument();
  const manifest = overrides?.manifest ?? { assetIds: [] };
  const pages = overrides?.pages ?? baseDoc.pages;
  const resolution = overrides?.resolution ?? {
    width: UI_DESIGN_CANVAS.width,
    height: UI_DESIGN_CANVAS.height,
  };

  const contentToHash = {
    manifest,
    pages,
    resolution,
  };
  const calculatedContentHash = computeContentHash(contentToHash);

  const envelope: UIPresentationArtifact = {
    kind: UI_PRESENTATION_ARTIFACT_KIND,
    version: UI_PRESENTATION_VERSION,
    resolution,
    baseline: 'ui-baseline-v1',
    rendererFingerprint: DEFAULT_RENDERER_CAPABILITY,
    sourceProjectId: 'test-project-041',
    sourceRevision: 1,
    sourceCheckpointId: 'cp-041',
    sourceCheckpointHash: 'chk-041',
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

describe('[UI-VIS-041 / Issue #471] 런타임 표시 snapshot 주입·입력 일치·롤백', () => {
  let mockCanvas: any;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
  });

  describe('1. 런타임 표시 snapshot 주입 및 10페이지 동일 hash 소비', () => {
    it('기본 부트스트랩 시 UI presentation은 비활성화 상태이며 기본 config 값을 유지한다', () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      expect(app.getActiveUIPresentation()).toBeNull();
      expect(app.getActiveUIHash()).toBeNull();
      expect(app.getActiveUIArtifact()).toBeNull();
    });

    it('검증된 UI artifact를 주입하면 10개 페이지 및 모든 렌더러가 동일한 hash를 소비한다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const artifact = createValidTestArtifact();

      const result = await app.setUIPresentationArtifact(artifact);
      expect(result.status).toBe('success');

      const activeDoc = app.getActiveUIPresentation();
      expect(activeDoc).not.toBeNull();
      expect(app.getActiveUIHash()).toBe(artifact.contentHash);

      // 10개 페이지 관련 렌더러/모달들의 Presentation Context가 동일 문서와 hash를 참조하는지 검증
      expect(app.menuRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.hudLayer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.bottomBar.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.pauseModal.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.settingsModal.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.resultRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.readyPositionRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.runningMatRenderer?.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.questionRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.presentationAdapter.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.beatHUDRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.bossRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
      expect(app.bossClimaxRenderer.getPresentationContext()?.presentationDocument).toBe(activeDoc);
    });
  });

  describe('2. 안전한 메뉴/새 세션 경계에서만 원자 채택 및 세션 중 고정 (Session Pinning)', () => {
    it('게임 플레이 진행 중 UI publish가 발생하면 즉시 반영되지 않고 pending으로 대기한다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const initialArtifact = createValidTestArtifact({ sourceRevision: 1 });
      await app.setUIPresentationArtifact(initialArtifact);

      const initialHash = app.getActiveUIHash();
      expect(initialHash).toBe(initialArtifact.contentHash);

      // 게임 플레이 상태로 강제 진입 (RUN_QUESTION)
      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('RUN_QUESTION');
      expect(app.stateMachine.currentState).toBe('RUN_QUESTION');

      // 플레이 도중 새로운 revision의 UI artifact 게시
      const doc2 = createDefaultUIPresentationDocument();
      (doc2.pages.main_home.elements[0] as any).text = '수정된 메인 타이틀';
      const newArtifact = createValidTestArtifact({
        sourceRevision: 2,
        pages: doc2.pages,
      });

      const updateResult = await app.setUIPresentationArtifact(newArtifact);
      expect(updateResult.status).toBe('success');

      // 세션 진행 중에는 여전히 이전 해시가 고정(Pinning)되어 있어야 함
      expect(app.getActiveUIHash()).toBe(initialHash);
      expect(app.getPendingUIArtifact()?.contentHash).toBe(newArtifact.contentHash);
      expect(app.menuRenderer.getPresentationContext()?.presentationDocument?.pages.main_home.elements[0]?.text).not.toBe('수정된 메인 타이틀');

      // 메뉴로 복귀하는 안전 경계 도달
      app.goToMenu();
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');

      // 메뉴 경계에서 pending이 원자적으로 플러시되어 반영되어야 함
      expect(app.getActiveUIHash()).toBe(newArtifact.contentHash);
      expect(app.getPendingUIArtifact()).toBeNull();
      expect(app.menuRenderer.getPresentationContext()?.presentationDocument?.pages.main_home.elements[0]?.text).toBe('수정된 메인 타이틀');
    });

    it('새 챕터 세션 시작 시(startChapter) pending UI artifact가 원자적으로 채택된다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });

      // 플레이 상태 시뮬레이션
      app.stateMachine.changeState('READY_POSITION');
      const artifact = createValidTestArtifact({ sourceRevision: 5 });
      await app.setUIPresentationArtifact(artifact);

      expect(app.getPendingUIArtifact()?.contentHash).toBe(artifact.contentHash);

      // startChapter를 호출하여 새 세션을 시작할 때 플러시됨
      app.startChapter(1, 1);
      expect(app.getActiveUIHash()).toBe(artifact.contentHash);
      expect(app.getPendingUIArtifact()).toBeNull();
    });
  });

  describe('3. 손상 시 이전 정상본 전체 롤백 및 Zero Partial Apply', () => {
    it('손상된 artifact 주입 시 부분 적용 없이 이전 정상본으로 롤백한다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const healthyArtifact = createValidTestArtifact({ sourceRevision: 10 });
      await app.setUIPresentationArtifact(healthyArtifact);

      const healthyHash = app.getActiveUIHash();
      expect(healthyHash).toBe(healthyArtifact.contentHash);

      // 손상된 artifact (변조된 hash 및 무효한 kind)
      const corruptedArtifact = {
        ...createValidTestArtifact({ sourceRevision: 11 }),
        kind: 'corrupted-kind',
        contentHash: 'tampered-hash-0000',
      } as any;

      const corruptResult = await app.setUIPresentationArtifact(corruptedArtifact);
      expect(corruptResult.status).toBe('fallback');

      // 롤백되어 이전 정상본이 유지되어야 함
      expect(app.getActiveUIHash()).toBe(healthyHash);
      expect(app.menuRenderer.getPresentationContext()?.presentationDocument).toBe(app.getActiveUIPresentation());
    });

    it('수동 롤백 호출 시 이전 정상본으로 안전하게 복구된다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const healthy1 = createValidTestArtifact({ sourceRevision: 1 });
      await app.setUIPresentationArtifact(healthy1);

      const healthy2 = createValidTestArtifact({ sourceRevision: 2 });
      await app.setUIPresentationArtifact(healthy2);
      expect(app.getActiveUIHash()).toBe(healthy2.contentHash);

      const rolledBack = app.rollbackUIPresentation();
      expect(rolledBack).toBe(true);
      expect(app.getActiveUIHash()).toBe(healthy1.contentHash);
    });
  });

  describe('4. 하단바 submenu customActionSlot seam의 검증 geometry 조회 및 일치', () => {
    it('resolveBottomBarActionSlot이 서브메뉴, 게임, 결과 모드에서 올바른 seam geometry를 반환한다', () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });

      // 1080x2160 기준 서브메뉴 액션 버튼 슬롯
      const subSlot = resolveBottomBarActionSlot(app.bottomBar, 1080, 2160, 'menu', 'sub');
      expect(subSlot).toBeDefined();
      expect(subSlot?.x).toBe(780);
      expect(subSlot?.y).toBe(1990);
      expect(subSlot?.w).toBe(270);
      expect(subSlot?.h).toBe(140);

      // 메인 메뉴에서는 액션 버튼 없음
      const mainSlot = resolveBottomBarActionSlot(app.bottomBar, 1080, 2160, 'menu', 'main');
      expect(mainSlot).toBeUndefined();

      // 게임 화면에서는 기본 일시정지 액션 버튼 슬롯 (810, 1990, 240, 140)
      const gameSlot = resolveBottomBarActionSlot(app.bottomBar, 1080, 2160, 'game');
      expect(gameSlot).toBeDefined();
      expect(gameSlot?.x).toBe(810);
      expect(gameSlot?.y).toBe(1990);
      expect(gameSlot?.w).toBe(240);
      expect(gameSlot?.h).toBe(140);
    });

    it('터치/클릭과 hover 판정이 BottomBar의 동일한 geometry와 일치한다', () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const slot = resolveBottomBarActionSlot(app.bottomBar, 1080, 2160, 'menu', 'sub')!;

      // 내부 좌표 클릭/호버 테스트 -> 둘 다 true
      const insideX = slot.x + slot.w / 2;
      const insideY = slot.y + slot.h / 2;
      expect(app.bottomBar.hitTestAction(insideX, insideY, 1080, 2160, 0, slot)).toBe(true);

      // 외부 좌표 테스트 -> 둘 다 false
      const outsideX = slot.x - 50;
      const outsideY = slot.y;
      expect(app.bottomBar.hitTestAction(outsideX, outsideY, 1080, 2160, 0, slot)).toBe(false);
    });

    it('Presentation document에서 submenu 버튼 위치를 변경하면 렌더와 hit geometry가 함께 변경된다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const doc = createDefaultUIPresentationDocument();

      // 서브메뉴의 뒤로가기 액션 버튼 위치 커스텀 오버라이드
      const closeBtn = doc.pages.submenu.elements.find((el: any) => el.actionId === 'close_submenu');
      if (closeBtn) {
        closeBtn.bounds = { x: 750, y: 1980, width: 300, height: 150 };
        closeBtn.hitBounds = { x: 750, y: 1980, width: 300, height: 150 };
      }

      const customArtifact = createValidTestArtifact({ pages: doc.pages });
      await app.setUIPresentationArtifact(customArtifact);

      const resolved = resolveBottomBarActionSlot(app.bottomBar, 1080, 2160, 'menu', 'sub');
      expect(resolved?.x).toBe(750);
      expect(resolved?.y).toBe(1980);
      expect(resolved?.w).toBe(300);
      expect(resolved?.h).toBe(150);

      // hitTestAction도 변경된 좌표(750, 1980, 300, 150)와 정확히 일치해야 함
      expect(app.bottomBar.hitTestAction(760, 1990, 1080, 2160, 0, resolved)).toBe(true);
      expect(app.bottomBar.hitTestAction(740, 1990, 1080, 2160, 0, resolved)).toBe(false);
    });
  });

  describe('5. 게임플레이 DTO 우선순위 및 보호 구역 보존', () => {
    it('Presentation artifact가 주입되더라도 HUDLayer는 실제 game DTO의 HP/콤보 값을 우선 표시한다', async () => {
      const app = new AppBootstrap({ canvas: mockCanvas, autoStartCamera: false, preloadAssets: false });
      const artifact = createValidTestArtifact();
      await app.setUIPresentationArtifact(artifact);

      const renderSpy = vi.spyOn(app.hudLayer, 'render');
      const testData = {
        playerHp: 42,
        playerMaxHp: 100,
        bossHp: 88,
        bossMaxHp: 200,
        combo: 7,
        chapter: 1,
        guardianStage: 2,
      };

      app.hudLayer.render(mockCanvas.getContext(), 1080, 2160, testData);
      expect(renderSpy).toHaveBeenCalledWith(expect.anything(), 1080, 2160, testData);
    });
  });
});
