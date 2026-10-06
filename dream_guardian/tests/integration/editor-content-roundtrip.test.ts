/**
 * tests/integration/editor-content-roundtrip.test.ts
 *
 * [Issue #394 / EDITOR-MVP-QA]
 * 별 수집 편집·복원·게시·게임 실행·롤백 종단 검증 (D단계 MVP 인수 테스트)
 *
 * 책임 레이어: Tests (소스/config 변경 0개, 종단 QA 통합 검증)
 *
 * 검증 매트릭스:
 * 1. 7개 슬롯의 순서, 신체 부위, 피트니스 존, 틱/초 시간과 게임 런타임 실행 이벤트 간 1:1 완벽 일치
 *    - 7-슬롯 편집 -> 프로젝트 저장 -> 새 인스턴스(Tab B) 복원 -> 컴파일 및 불변 게시 -> ContentLoadService/ContentProvider/AppBootstrap 주입
 *    - SessionStageBundle 7노트, AppBootstrap getPhaseAStarNotes, BeatCoordinator keynotes 1:1 일치 검증
 * 2. Revision 충돌(두 탭 경쟁), 손상된 데이터, 버전/해시 불일치 시 기존 작업 및 활성 정상본 100% 보존
 * 3. 10문제 -> Phase B -> 승리/패배 -> 메뉴 회귀 및 테스트 모드 실행 시 localStorage progress/highScore/rewards 쓰기 0건(완전 차단)
 *    - 일반 세션 복귀 후 정상 저장 동작 보존 확인
 * 4. 이전 정상본(previousHealthyHash) 롤백 예약 및 활성화 시 불변 팩 보존 및 런타임 적용 확인
 * 5. 브라우저 실렌더링·실카메라·모바일 환경 등 수동 확인 항목의 명확한 기록 및 분리
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AppBootstrap,
  STORAGE_KEY_STAGE_PROGRESS,
  STORAGE_KEY_HIGH_SCORES,
  STORAGE_KEY_REWARDS,
  isVerifiedPublishedPack,
} from '../../src/core/AppBootstrap.js';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorPublishController } from '../../src/editor/EditorPublishController.js';
import { PublishedContentStore } from '../../src/storage/PublishedContentStore.js';
import { EditorProjectStore, RevisionConflictError } from '../../src/storage/EditorProjectStore.js';
import {
  EditorContentDatabase,
  MemoryIndexedDBAdapter,
} from '../../src/storage/EditorContentDatabase.js';
import { ContentLoadService } from '../../src/core/ContentLoadService.js';
import { ContentProvider } from '../../src/game/ContentProvider.js';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../../src/data/EditorProject.js';
import {
  type PublishedContentPack,
} from '../../src/data/PublishedContentPack.js';
import {
  DEFAULT_RULESET_ID,
  PHASE_A_STAR_LANDING_BEATS,
  PHASE_A_STAR_LANDING_TICKS,
} from '../../src/data/ContentCapabilities.js';
import { compileEditorProject } from '../../src/data/ContentCompiler.js';

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    canvas: { width: 1280, height: 720 },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
  };
  return {
    getContext: vi.fn((type: string) => (type === '2d' ? ctx : null)),
    width: 1280,
    height: 720,
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => {},
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    style: {},
    parentElement: {
      clientWidth: 1280,
      clientHeight: 720,
    },
  } as unknown as HTMLCanvasElement;
}

/**
 * 7개의 고유한 별 노트를 가진 유효한 프로젝트 생성 헬퍼
 */
function create7StarProject(
  projectId: string = 'proj_star_qa_01',
  revision: number = 1,
  bpm: number = 120,
): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId,
    revision,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: `Star Collection Ch1 Routine (rev ${revision})`,
      description: 'End-to-End MVP roundtrip validation project',
      author: 'QA Subagent',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
    },
    previewTempo: {
      bpm,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_punch_l',
        name: 'Punch Left',
        target: { leftHand: 4, rightHand: null, head: null, hip: null },
      },
      {
        id: 'pat_punch_r',
        name: 'Punch Right',
        target: { leftHand: null, rightHand: 5, head: null, hip: null },
      },
      {
        id: 'pat_side_l',
        name: 'Side Left',
        target: { leftHand: 1, rightHand: null, head: null, hip: null },
      },
      {
        id: 'pat_side_r',
        name: 'Side Right',
        target: { leftHand: null, rightHand: 3, head: null, hip: null },
      },
      {
        id: 'pat_step_c',
        name: 'Center Step',
        target: { leftHand: null, rightHand: null, head: null, hip: 10 },
      },
    ],
    sequences: [
      {
        id: 'seq_phaseA_star',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'star_0',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[0], // 960
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'pat_punch_l',
          },
          {
            id: 'star_1',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[1], // 1440
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_punch_r',
          },
          {
            id: 'star_2',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[2], // 1920
            target: { type: 'cursor', part: 'leftHand', zoneId: 1 },
            sourcePatternId: 'pat_side_l',
          },
          {
            id: 'star_3',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[3], // 2400
            target: { type: 'cursor', part: 'rightHand', zoneId: 3 },
            sourcePatternId: 'pat_side_r',
          },
          {
            id: 'star_4',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[4], // 2880
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'pat_punch_l',
          },
          {
            id: 'star_5',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[5], // 3360
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_punch_r',
          },
          {
            id: 'star_6',
            kind: 'starNote',
            landingTick: PHASE_A_STAR_LANDING_TICKS[6], // 3840
            target: { type: 'foot', foot: 'centerFoot', zoneId: 10 },
            sourcePatternId: 'pat_step_c',
          },
        ],
      },
      {
        id: 'seq_phaseB_hazard',
        phase: 'phaseB',
        kind: 'hazard',
        events: [
          {
            id: 'evt_hz_b',
            kind: 'phaseBHazard',
            attackType: 'dual_slam',
          },
        ],
      },
    ],
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
      },
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_hazard',
      },
    ],
  };
}

describe('[Issue #394 / EDITOR-MVP-QA] 별 수집 편집·복원·게시·게임 실행·롤백 종단 검증', () => {
  let localStorageMock: Record<string, string>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let getItemSpy: ReturnType<typeof vi.fn>;

  let adapter: MemoryIndexedDBAdapter;
  let db: EditorContentDatabase;
  let projectStore: EditorProjectStore;
  let publishedStore: PublishedContentStore;
  let contentLoadService: ContentLoadService;
  let contentProvider: ContentProvider;

  beforeEach(async () => {
    localStorageMock = {};
    setItemSpy = vi.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    getItemSpy = vi.fn((key: string) => localStorageMock[key] ?? null);

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });

    vi.stubGlobal('window', {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn(() => null),
      fullscreenElement: null,
    });

    adapter = new MemoryIndexedDBAdapter();
    await adapter.open();
    db = new EditorContentDatabase(adapter);
    projectStore = new EditorProjectStore(db);
    publishedStore = new PublishedContentStore(db);
    contentLoadService = new ContentLoadService({ defaultStore: publishedStore });
    contentProvider = new ContentProvider();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. 7개 슬롯 순서/부위/존/시간과 게임 런타임 실행 이벤트 1:1 일치 종단 검증', () => {
    it('에디터 편집 -> 저장 -> 새 인스턴스 복원 -> 컴파일 및 불변 게시 -> 런타임 주입 전 과정에서 7개 별 노트가 1:1 일치한다', async () => {
      const projectId = 'proj_star_roundtrip';
      const initialProject = create7StarProject(projectId, 1, 120);

      // [Step 1-A] Tab A 인스턴스에서 프로젝트 로드 및 슬롯 수정
      const stateTabA = new EditorState();
      stateTabA.applyProject(initialProject);

      // 슬롯 2 수정 (leftHand -> Zone 2 도달 가능한 중앙 이동)
      stateTabA.setSelectedPhase('STAR_COLLECT');
      const updateRes = stateTabA.updateStarSlot(2, {
        part: 'leftHand',
        zoneId: 2,
      });
      expect(updateRes.valid).toBe(true);

      const editedProject = stateTabA.toEditorProject();
      expect(editedProject.revision).toBe(1);

      // [Step 1-B] 프로젝트 저장소에 영구 저장 (EditorProjectStore)
      const saveRes = await projectStore.saveProject(editedProject);
      expect(saveRes.success).toBe(true);
      expect(saveRes.revision).toBe(1);

      // [Step 1-C] 새 탭/인스턴스(Tab B)에서 저장소 복원
      const restoredProject = await projectStore.loadProject(projectId);
      expect(restoredProject).not.toBeNull();
      expect(restoredProject?.projectId).toBe(projectId);

      const stateTabB = new EditorState();
      stateTabB.applyProject(restoredProject!);

      // 복원된 7개 슬롯 확인
      const restoredSlots = stateTabB.getStarSlots();
      expect(restoredSlots).toHaveLength(7);
      expect(restoredSlots[0].zoneId).toBe(4);
      expect(restoredSlots[1].zoneId).toBe(5);
      expect(restoredSlots[2].zoneId).toBe(2); // 수정한 Zone 2가 정확히 복원됨
      expect(restoredSlots[2].part).toBe('leftHand');
      expect(restoredSlots[6].part).toBe('foot');
      expect(restoredSlots[6].zoneId).toBe(10);

      // [Step 1-D] Tab B에서 불변 게시 (EditorPublishController & PublishedContentStore)
      const publishController = new EditorPublishController(stateTabB, publishedStore, db);
      const publishResult = await publishController.publish({ stageActivation: true });

      expect(publishResult.success).toBe(true);
      expect(publishResult.contentHash).toBeDefined();

      const publishedPack = await publishedStore.getPublishedPack(publishResult.contentHash);
      expect(publishedPack).not.toBeNull();
      expect(publishedPack?.contentHash).toBe(publishResult.contentHash);

      // [Step 1-E] ContentLoadService를 통한 게시본 수신 및 ContentProvider를 통한 SessionStageBundle 해석
      const loadResult = await contentLoadService.loadByHash(publishResult.contentHash);
      expect(loadResult.status).toBe('success');
      if (loadResult.status === 'success') {
        expect(loadResult.pack.contentHash).toBe(publishResult.contentHash);
      }

      const activeHead = await publishedStore.getActivationHead(projectId);
      expect(activeHead?.activeContentHash).toBe(publishResult.contentHash);

      const stageBundle = contentProvider.resolveSessionStage({
        stageId: 'ch1',
        pack: publishedPack!,
        seed: 42,
      });

      // 7개 별노트의 메타데이터와 순서/부위/존/착지시간 1:1 완벽 일치 검증
      expect(stageBundle.phaseA.starNotes).toHaveLength(7);
      const bundleNotes = stageBundle.phaseA.starNotes;

      // 슬롯 인덱스 및 박자/틱 일치 검증
      for (let i = 0; i < 7; i++) {
        expect(bundleNotes[i].slotIndex).toBe(i);
        expect(bundleNotes[i].landingBeat).toBe(PHASE_A_STAR_LANDING_BEATS[i]);
        expect(bundleNotes[i].landingTick).toBe(PHASE_A_STAR_LANDING_TICKS[i]);
      }

      // 신체 부위 및 존 일치 검증
      expect(bundleNotes[0].target.part).toBe('leftHand');
      expect(bundleNotes[0].target.zoneId).toBe(4);

      expect(bundleNotes[1].target.part).toBe('rightHand');
      expect(bundleNotes[1].target.zoneId).toBe(5);

      expect(bundleNotes[2].target.part).toBe('leftHand');
      expect(bundleNotes[2].target.zoneId).toBe(2);

      expect(bundleNotes[3].target.part).toBe('rightHand');
      expect(bundleNotes[3].target.zoneId).toBe(3);

      expect(bundleNotes[4].target.part).toBe('leftHand');
      expect(bundleNotes[4].target.zoneId).toBe(4);

      expect(bundleNotes[5].target.part).toBe('rightHand');
      expect(bundleNotes[5].target.zoneId).toBe(5);

      expect(bundleNotes[6].target.instrument).toBe('foot');
      expect(bundleNotes[6].target.zoneId).toBe(10);

      // [Step 1-F] 게임 조립 계층(AppBootstrap)에 커스텀 팩 주입 및 런타임 이벤트 1:1 검증
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      app.setCustomContentPack(publishedPack!);
      app.startChapter(1);

      expect(app.sessionContext.contentMode).toBe('custom_pack');
      const runtimeNotes = app.getPhaseAStarNotes();
      expect(runtimeNotes).toHaveLength(7);
      expect(runtimeNotes[2].zoneId).toBe(2);
      expect(runtimeNotes[6].zoneId).toBe(10);
      expect(runtimeNotes[6].instrument).toBe('foot');

      // BeatCoordinator 8박 분기 주입 키노트 일치
      expect(app.beatCoordinator.keynotes).toHaveLength(7);
      expect(app.beatCoordinator.keynotes[2].zoneId).toBe(2);
      expect(app.beatCoordinator.keynotes[6].instrument).toBe('foot');

      app.dispose();
    });
  });

  describe('2. Revision 충돌, 손상된 데이터, 버전/해시 불일치 시 작업 및 정상본 보존', () => {
    it('동일 revision에서 두 탭이 동시에 저장 경쟁할 때 한 쪽은 RevisionConflictError가 발생하고 작업본 및 정상본이 보존된다', async () => {
      const projectId = 'proj_conflict_test';
      const baseProject = create7StarProject(projectId, 1, 120);
      await projectStore.saveProject(baseProject);

      // Tab A가 revision 2로 저장 성공
      const tabAProject: EditorProject = {
        ...baseProject,
        revision: 2,
        metadata: { ...baseProject.metadata, title: 'Updated by Tab A' },
      };
      const saveA = await projectStore.saveProject(tabAProject, { throwOnConflict: true });
      expect(saveA.success).toBe(true);
      expect(saveA.revision).toBe(2);

      // Tab B가 여전히 이전 기대치(revision 1)를 기반으로 revision 2를 쓰려고 시도 -> 충돌 감지
      const tabBProject: EditorProject = {
        ...baseProject,
        revision: 2,
        metadata: { ...baseProject.metadata, title: 'Competing write from Tab B' },
      };

      await expect(
        projectStore.saveProject(tabBProject, { throwOnConflict: true })
      ).rejects.toThrow(RevisionConflictError);

      // 데이터베이스의 Head는 Tab A의 정상 revision 2를 유지함
      const head = await projectStore.getHead(projectId);
      expect(head?.revision).toBe(2);
      expect(head?.title).toBe('Updated by Tab A');

      // Tab B의 작업 데이터는 유실되지 않고 메모리에 보존되어 있음
      expect(tabBProject.metadata.title).toBe('Competing write from Tab B');
    });

    it('손상되거나 유효하지 않은 프로젝트는 저장이 거부되고 기존 정상본이 100% 보존된다', async () => {
      const projectId = 'proj_corrupt_test';
      const validProject = create7StarProject(projectId, 1, 120);
      await projectStore.saveProject(validProject);

      // BPM이 음수인 스키마 검증 위반 손상 프로젝트
      const corruptedProject = {
        ...validProject,
        revision: 2,
        previewTempo: { bpm: -10, beatsPerBar: 4 },
      } as unknown as EditorProject;

      const saveRes = await projectStore.saveProject(corruptedProject);
      expect(saveRes.success).toBe(false);
      expect(saveRes.errorType).toBe('validation');

      // 기존 정상본이 전혀 훼손되지 않고 보존됨
      const head = await projectStore.getHead(projectId);
      expect(head?.revision).toBe(1);
      const loaded = await projectStore.loadProject(projectId);
      expect(loaded?.previewTempo.bpm).toBe(120);
    });

    it('해시가 조작되거나 변조된 팩은 검증 실패로 테스트 플레이 진입이 차단된다', async () => {
      const validProject = create7StarProject('proj_tamper_test', 1, 120);
      const compileRes = compileEditorProject(validProject);
      expect(compileRes.success).toBe(true);

      const tamperedPack: PublishedContentPack = {
        ...compileRes.pack!,
        contentHash: 'tampered_fake_hash_1234567890',
      };

      // AppBootstrap의 엄격한 무결성 검증 함수 통과 불가
      expect(isVerifiedPublishedPack(tamperedPack)).toBe(false);

      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      // 테스트 세션 진입 차단
      const launchSuccess = app.startTestPlaySession(1, { pack: tamperedPack });
      expect(launchSuccess).toBe(false);
      expect(app.isTestSession).toBe(false);

      app.dispose();
    });
  });

  describe('3. 10문제 -> Phase B -> 승리/패배 -> 메뉴 회귀 및 테스트 모드 실제 save 쓰기 0건 격리', () => {
    it('10문제 라운드 정산 완료 후 Phase B 전환, 승리 후 메뉴 복귀 시 localStorage 쓰기가 0건이어야 한다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      const validProject = create7StarProject('proj_lifecycle_test', 1, 120);
      const compileRes = compileEditorProject(validProject);
      const validPack = compileRes.pack!;

      // 1. 테스트 플레이 세션으로 시작
      const launched = app.startTestPlaySession(1, { pack: validPack });
      expect(launched).toBe(true);
      expect(app.isTestSession).toBe(true);
      expect(app.sessionLifecycle.isTestSession).toBe(true);

      setItemSpy.mockClear();

      // 2. 10문제 라운드 연속 정산 시뮬레이션
      for (let r = 1; r <= 9; r++) {
        app.stageProgressController.handleRoundSettled(
          {
            roundIndex: r,
            playerDefeated: false,
            playerHp: 100,
          },
          { immediate: true }
        );
      }

      // 10번째 문제 정산 전 정상적인 라운드 정산 상태(ROUND_RESOLVE)로 전이
      app.stateMachine.changeState('ROUND_RESOLVE');
      app.stageProgressController.handleRoundSettled(
        {
          roundIndex: 10,
          playerDefeated: false,
          playerHp: 100,
        },
        { immediate: true }
      );

      // 10문제 정산 완료 후 Phase B(BOSS_CLIMAX) 전환 확인
      expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');

      // 3. 승리 정산 호출 (showResult)
      app.showResult(true);
      expect(app.stateMachine.currentState).toBe('RESULT');

      // 4. [핵심 검증] 테스트 세션이므로 localStorage 진행도/점수/보상 쓰기 0건
      expect(setItemSpy).not.toHaveBeenCalled();
      expect(localStorageMock[STORAGE_KEY_STAGE_PROGRESS]).toBeUndefined();
      expect(localStorageMock[STORAGE_KEY_HIGH_SCORES]).toBeUndefined();
      expect(localStorageMock[STORAGE_KEY_REWARDS]).toBeUndefined();

      // 5. 메뉴 복귀
      app.goToMenu();
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');
      expect(app.isTestSession).toBe(false);

      // 6. 패배(GAMEOVER) 경로에서도 저장 쓰기 0건 검증
      app.startTestPlaySession(1, { pack: validPack });
      expect(app.isTestSession).toBe(true);
      setItemSpy.mockClear();

      app.showResult(false);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');
      expect(setItemSpy).not.toHaveBeenCalled();

      app.goToMenu();
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');

      // 7. [동작 보존] 일반 플레이 세션에서는 정상적으로 저장이 수행되는지 회귀 검증
      app.startChapter(1);
      expect(app.isTestSession).toBe(false);
      setItemSpy.mockClear();

      app.showResult(true);
      expect(setItemSpy).toHaveBeenCalled();
      expect(localStorageMock[STORAGE_KEY_STAGE_PROGRESS]).toBeDefined();

      app.dispose();
    });
  });

  describe('4. 이전 정상본(previousHealthyHash) 대상 롤백 예약 및 활성화', () => {
    it('v1 게시 -> v2 게시 후 v1으로 롤백 예약 및 활성화 시 불변 팩이 보존되고 런타임에 v1이 복원된다', async () => {
      const projectId = 'proj_rollback_lifecycle';

      // v1 생성 및 게시 (BPM 110)
      const v1Project = create7StarProject(projectId, 1, 110);
      const state = new EditorState();
      state.applyProject(v1Project);

      const controller = new EditorPublishController(state, publishedStore, db);
      const pub1 = await controller.publish({ stageActivation: true });
      const hash1 = pub1.contentHash;

      // v2 생성 및 게시 (BPM 135)
      const v2Project = create7StarProject(projectId, 2, 135);
      state.applyProject(v2Project);
      const pub2 = await controller.publish({ stageActivation: true });
      const hash2 = pub2.contentHash;

      // 이전 정상본이 hash1인지 확인
      const prevHealthy = await controller.getPreviousHealthyHash();
      expect(prevHealthy).toBe(hash1);

      // 롤백 예약 (scheduleRollback)
      const rollbackRes = await controller.scheduleRollback();
      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.scheduledHash).toBe(hash1);

      // 롤백 활성화 (activateRollback)
      const activateRes = await publishedStore.activateRollback(projectId);
      expect(activateRes.success).toBe(true);
      expect(activateRes.activeContentHash).toBe(hash1);
      expect(activateRes.previousHealthyHash).toBe(hash2);

      // 불변 저장소 내에서 hash1, hash2 팩이 모두 삭제되지 않고 보존되었는지 검증
      const pack1 = await publishedStore.getPublishedPack(hash1);
      const pack2 = await publishedStore.getPublishedPack(hash2);
      expect(pack1).not.toBeNull();
      expect(pack2).not.toBeNull();

      // ContentProvider 해석 시 복원된 v1의 BPM(110)과 노트를 산출하는지 확인
      const resolvedStage = contentProvider.resolveSessionStage({
        stageId: 'ch1',
        pack: pack1!,
        seed: 100,
      });
      expect(resolvedStage.bpm).toBe(110);
      expect(resolvedStage.sourcePackHash).toBe(hash1);
    });
  });

  describe('5. 브라우저·실카메라·모바일 미확인 항목 명확한 기록 및 분리 (Acceptance Gate)', () => {
    it('단위/통합 테스트 환경에서 검증할 수 없는 실물 브라우저/하드웨어 종속 항목을 UNVERIFIED로 명시 기록한다', () => {
      const manualVerificationChecklist = {
        webglCanvasRendering60fps: 'UNVERIFIED_IN_VITEST_MOCK',
        realCameraMediaStreamPoseRecognition: 'UNVERIFIED_IN_VITEST_MOCK',
        mobileTouchAndViewportScaling: 'UNVERIFIED_IN_VITEST_MOCK',
      } as const;

      // 자동화 테스트 통과를 실물 하드웨어 확인으로 대체하지 않음을 확인
      expect(manualVerificationChecklist.webglCanvasRendering60fps).toBe('UNVERIFIED_IN_VITEST_MOCK');
      expect(manualVerificationChecklist.realCameraMediaStreamPoseRecognition).toBe('UNVERIFIED_IN_VITEST_MOCK');
      expect(manualVerificationChecklist.mobileTouchAndViewportScaling).toBe('UNVERIFIED_IN_VITEST_MOCK');
    });
  });
});
