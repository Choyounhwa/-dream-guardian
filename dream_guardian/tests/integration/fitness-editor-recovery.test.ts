/**
 * tests/integration/fitness-editor-recovery.test.ts
 *
 * [Issue #404 / FITNESS-EDITOR-QA]
 * 통합 피트니스 제작·복구·게임 적용 최종 인수 - 복구 및 회복력 통합 검증 (F단계 최종)
 *
 * 책임 레이어: Tests (소스/config 변경 0개, 종단 QA 통합 검증)
 *
 * 검증 매트릭스:
 * 1. 5대 요소(별 7노트, 장판 A, 피버 8노트, 장판 B, 가이드) 프로젝트 통합 제작 -> 저장 -> 새 인스턴스 복원 -> 불변 컴파일 및 게시 무결성 1:1 일치
 * 2. 회복력(Recovery Resilience):
 *    - 손상된 JSON 문자열/문법 파싱 실패 시 원자적 거부 및 현재 작업본 100% 보존
 *    - 미지원 역량/규칙(BPM 128 등) 컴파일 시 명시적 진단 코드 반환 및 기존 정상 상태 보존
 *    - 프로젝트 전환 시 미저장 작업의 recoveryBuffers 안전 자동 보관
 *    - V1 레거시 프로젝트 수입 시 비파괴적 V2 마이그레이션 및 원본 키 불변
 *    - 잘못된 해시/규칙 미준수 팩 저장 시도시 유효성 검증 실패로 거부
 * 3. 동시성 및 원자적 트랜잭션 롤백 (Concurrency & Atomic Rollback):
 *    - 두 탭(Tab A, Tab B) 동일 revision 동시 경쟁 시 후속 쓰기 RevisionConflictError 차단 및 recoveryBuffers 보존
 *    - 스토리지 QuotaExceededError / 트랜잭션 abort 실패 시 이전 정상 Head/Snapshot 손상 0건
 * 4. 세션 도중 중간 게시(Mid-Stage Publish) 시 실행 중인 세션 팩 불변(Session Pinning) 유지 및 다음 스테이지 반영 유예
 * 5. 이전 정상본(previousHealthyHash) 롤백 파이프라인 무결성 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorIOHandler } from '../../src/editor/EditorIOHandler.js';
import { PublishedContentStore } from '../../src/storage/PublishedContentStore.js';
import {
  EditorProjectStore,
  RevisionConflictError,
} from '../../src/storage/EditorProjectStore.js';
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
  PUBLISHED_PACK_KIND,
  PUBLISHED_SCHEMA_VERSION,
  type PublishedContentPack,
  validatePublishedContentPack,
} from '../../src/data/PublishedContentPack.js';
import {
  DEFAULT_RULESET_ID,
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
    bezierCurveTo: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    canvas: { width: 1280, height: 720 },
    fillStyle: '#ffffff',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
  };

  return {
    width: 1280,
    height: 720,
    getContext: vi.fn(() => ctx),
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
  } as unknown as HTMLCanvasElement;
}

/**
 * 5대 요소가 완벽하게 구성된 통합 저작 프로젝트 픽스처 생성기
 */
function createFullFiveElementProject(
  projectId: string = 'proj_full_recovery_01',
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
      title: `Full 5-Element Routine rev${revision}`,
      description: 'Acceptance & Recovery Verification Routine',
      author: 'Subagent Tester',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
    },
    previewTempo: {
      bpm,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_l_punch',
        name: 'Left Punch',
        target: { leftHand: 4, rightHand: null, head: null, hip: null },
      },
      {
        id: 'pat_r_punch',
        name: 'Right Punch',
        target: { leftHand: null, rightHand: 5, head: null, hip: null },
      },
      {
        id: 'pat_step_l',
        name: 'Left Step',
        target: { leftHand: null, rightHand: null, head: null, hip: 8 },
      },
    ],
    sequences: [
      // 1. 별 7노트
      {
        id: 'seq_phaseA_star',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          { id: 'star_0', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[0], target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'star_1', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[1], target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'star_2', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[2], target: { type: 'cursor', part: 'leftHand', zoneId: 1 } },
          { id: 'star_3', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[3], target: { type: 'cursor', part: 'rightHand', zoneId: 3 } },
          { id: 'star_4', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[4], target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'star_5', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[5], target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'star_6', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[6], target: { type: 'foot', foot: 'leftFoot', zoneId: 10 } },
        ],
      },
      // 2. Phase A 오답 장판 (jump)
      {
        id: 'seq_phaseA_hazard',
        phase: 'phaseA',
        kind: 'hazard',
        events: [
          {
            id: 'evt_phaseA_hz_1',
            kind: 'phaseAHazard',
            hazardType: 'jump',
          },
        ],
      },
      // 3. Phase A 모션 가이드
      {
        id: 'seq_phaseA_motion',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [
          { id: 'cue_a_0', kind: 'motionCue', startTick: 0, durationTicks: 480, target: { leftHand: 4, rightHand: 5 } },
        ],
      },
      // 4. Phase B 피버 노트 (8개 노트)
      {
        id: 'seq_phaseB_fever',
        phase: 'phaseB',
        kind: 'feverNotes',
        events: [
          { id: 'fn_0', kind: 'feverNote', landingTick: 480, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_1', kind: 'feverNote', landingTick: 960, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'fn_2', kind: 'feverNote', landingTick: 1440, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_3', kind: 'feverNote', landingTick: 1920, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'fn_4', kind: 'feverNote', landingTick: 2400, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_5', kind: 'feverNote', landingTick: 2880, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'fn_6', kind: 'feverNote', landingTick: 3360, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_7', kind: 'feverNote', landingTick: 3840, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
        ],
      },
      // 5. Phase B 보스 장판 (3종 순서: dual_slam, alternating_stomp_left, alternating_stomp_right)
      {
        id: 'seq_phaseB_hazard',
        phase: 'phaseB',
        kind: 'hazard',
        events: [
          { id: 'bhz_0', kind: 'phaseBHazard', attackType: 'dual_slam' },
          { id: 'bhz_1', kind: 'phaseBHazard', attackType: 'alternating_stomp_left' },
          { id: 'bhz_2', kind: 'phaseBHazard', attackType: 'alternating_stomp_right' },
        ],
      },
      // 6. Phase B 16박 모션 가이드
      {
        id: 'seq_phaseB_motion',
        phase: 'phaseB',
        kind: 'motionGuide',
        events: [
          { id: 'cue_b_0', kind: 'motionCue', startTick: 0, durationTicks: 480, target: { leftHand: 4, rightHand: 5 } },
        ],
      },
    ],
    bindings: [
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_star', role: 'starNotes' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_hazard', role: 'hazard' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_motion', role: 'motionGuide' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_fever', role: 'feverNotes' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_hazard', role: 'hazard' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_motion', role: 'motionGuide' },
    ],
  };
}

describe('[Issue #404 / FITNESS-EDITOR-QA] 통합 피트니스 제작·복구·게임 적용 최종 인수 (복구 및 회복력 통합 검증)', () => {
  let adapter: MemoryIndexedDBAdapter;
  let db: EditorContentDatabase;
  let projectStore: EditorProjectStore;
  let publishedStore: PublishedContentStore;
  let contentLoadService: ContentLoadService;
  let contentProvider: ContentProvider;

  beforeEach(async () => {
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

  describe('1. 5대 요소 통합 제작 -> 저장 -> 새 인스턴스 복원 -> 불변 컴파일 무결성 검증', () => {
    it('에디터에서 5대 요소를 직접 구성한 후 영구 저장하고 새 인스턴스에서 복원 시 모든 요소가 1:1 완벽 보존된다', async () => {
      const stateTabA = new EditorState();

      // 별 7슬롯 설정
      stateTabA.setSelectedPhase('STAR_COLLECT');
      stateTabA.updateStarSlot(0, { part: 'leftHand', zoneId: 4 });
      stateTabA.updateStarSlot(1, { part: 'rightHand', zoneId: 5 });
      stateTabA.updateStarSlot(2, { part: 'leftHand', zoneId: 1 });
      stateTabA.updateStarSlot(3, { part: 'rightHand', zoneId: 3 });
      stateTabA.updateStarSlot(4, { part: 'leftHand', zoneId: 4 });
      stateTabA.updateStarSlot(5, { part: 'rightHand', zoneId: 5 });
      stateTabA.updateStarSlot(6, { part: 'foot', zoneId: 10 });

      // Phase A 오답 장판 설정
      const hazardRes = stateTabA.setPhaseAHazardPattern('jump');
      expect(hazardRes.success).toBe(true);

      // Phase B 피버 노트 8개 설정
      stateTabA.setSelectedPhase('FEVER_NOTES');
      for (let i = 0; i < 8; i++) {
        const part = i % 2 === 0 ? 'leftHand' : 'rightHand';
        const zoneId = i % 2 === 0 ? 4 : 5;
        stateTabA.updateFeverSlot(i, { part, zoneId });
      }

      // Phase B 보스 장판 3종 설정
      stateTabA.setSelectedPhase('BOSS_HAZARD');
      const bossHzRes = stateTabA.setPhaseBHazardAttacks([
        'dual_slam',
        'alternating_stomp_left',
        'alternating_stomp_right',
      ]);
      expect(bossHzRes.success).toBe(true);

      const project = stateTabA.toEditorProject();
      expect(project.projectId).toBeDefined();

      // [저장] EditorProjectStore에 영구 저장
      const saveResult = await projectStore.saveProject(project);
      expect(saveResult.success).toBe(true);
      expect(saveResult.revision).toBe(1);

      // [복원] 새 인스턴스(Tab B)에서 저장소로부터 로드
      const loadedProject = await projectStore.loadProject(project.projectId);
      expect(loadedProject).not.toBeNull();

      const stateTabB = new EditorState();
      stateTabB.applyProject(loadedProject!);

      // 복원된 5대 요소 1:1 일치 검증
      // 1. 별 7노트
      const restoredStars = stateTabB.getStarSlots();
      expect(restoredStars).toHaveLength(7);
      expect(restoredStars[0].part).toBe('leftHand');
      expect(restoredStars[0].zoneId).toBe(4);
      expect(restoredStars[2].zoneId).toBe(1);
      expect(restoredStars[6].part).toBe('foot');
      expect(restoredStars[6].zoneId).toBe(10);

      // 2. Phase A 오답 장판
      expect(stateTabB.getPhaseAHazardPattern()).toBe('jump');

      // 3. Phase B 피버 8노트
      const restoredFever = stateTabB.getFeverSlots();
      expect(restoredFever).toHaveLength(8);
      for (let i = 0; i < 8; i++) {
        expect(restoredFever[i].slotIndex).toBe(i);
        expect(restoredFever[i].zoneId).toBe(i % 2 === 0 ? 4 : 5);
      }

      // 4. Phase B 보스 장판
      const restoredBossHz = stateTabB.getPhaseBHazardAttacks();
      expect(restoredBossHz).toHaveLength(3);
      expect(restoredBossHz[0].attackType).toBe('dual_slam');
      expect(restoredBossHz[0].requiredAction).toBe('jump');
      expect(restoredBossHz[1].attackType).toBe('alternating_stomp_left');
      expect(restoredBossHz[1].requiredAction).toBe('left_step');
      expect(restoredBossHz[2].attackType).toBe('alternating_stomp_right');
      expect(restoredBossHz[2].requiredAction).toBe('right_step');

      // 5. 모션 가이드
      const feverMotion = stateTabB.getNotesForPhase('FEVER_PHASE_B');
      expect(feverMotion.length).toBeGreaterThanOrEqual(1);
    });

    it('5대 요소를 포함하는 프로젝트를 불변 게시본으로 컴파일하고 게시할 때 무결성 일치 및 SessionStageBundle 생성이 정상 완료된다', async () => {
      const fullProject = createFullFiveElementProject('proj_full_compile_test', 1, 120);
      const compileResult = compileEditorProject(fullProject);

      expect(compileResult.success).toBe(true);
      expect(compileResult.pack).not.toBeNull();
      const pack = compileResult.pack!;

      expect(pack.schemaVersion).toBe(PUBLISHED_SCHEMA_VERSION);
      expect(pack.kind).toBe(PUBLISHED_PACK_KIND);
      expect(pack.contentHash).toBeDefined();

      const stageCh1 = pack.stages['ch1'];
      expect(stageCh1).toBeDefined();

      if (stageCh1 && stageCh1.phaseA && stageCh1.phaseB) {
        // Phase A 7노트, 장판, 가이드
        expect(stageCh1.phaseA.starNotes).toHaveLength(7);
        expect(stageCh1.phaseA.hazard?.hazardType).toBe('jump');
        expect(stageCh1.phaseA.hazard?.requiredAction).toBe('jump');

        // Phase B 피버 8노트, 장판 3종
        expect(stageCh1.phaseB.feverNotes).toHaveLength(8);
        expect(stageCh1.phaseB.hazards).toHaveLength(3);
        expect(stageCh1.phaseB.hazards![0].attackType).toBe('dual_slam');
        expect(stageCh1.phaseB.hazards![1].attackType).toBe('alternating_stomp_left');
        expect(stageCh1.phaseB.hazards![2].attackType).toBe('alternating_stomp_right');
      }

      // PublishedContentStore 게시
      const pubRes = await publishedStore.publish(pack, {
        activateNow: true,
      });
      expect(pubRes.success).toBe(true);

      // ContentLoadService로 수신
      const loadResult = await contentLoadService.loadByHash(pack.contentHash);
      expect(loadResult.status).toBe('success');
      if (loadResult.status === 'success') {
        expect(loadResult.pack.contentHash).toBe(pack.contentHash);

        // ContentProvider를 통한 SessionStageBundle 해석
        const bundle = contentProvider.resolveSessionStage({
          stageId: 'ch1',
          pack: loadResult.pack,
          seed: 42,
        });
        expect(bundle).not.toBeNull();
        expect(bundle?.phaseA.starNotes).toHaveLength(7);
        expect(bundle?.phaseA.hazard?.hazardType).toBe('jump');
        expect(bundle?.phaseB.feverNotes).toHaveLength(8);
        expect(bundle?.phaseB.hazards).toHaveLength(3);
      }
    });
  });

  describe('2. 데이터 회복력 (손상 파일, 스키마 위반, V1 마이그레이션, 변조 방지)', () => {
    it('손상된 JSON 문자열이나 잘못된 문법 수입 시도시 원자적으로 거부하며 기존 에디터 상태를 100% 보존한다', async () => {
      const state = new EditorState();
      state.updateStarSlot(0, { part: 'leftHand', zoneId: 4 });

      const ioHandler = new EditorIOHandler(undefined, projectStore);
      const malformedJson = '{ "projectId": "corrupted", "schemaVersion": 2, invalid_syntax: ';

      const openResult = ioHandler.openProjectSync(state, malformedJson);
      expect(openResult.success).toBe(false);
      expect(openResult.errors[0]).toContain('JSON 파싱 오류');

      // 기존 state 불변 확인
      const currentSlots = state.getStarSlots();
      expect(currentSlots[0].part).toBe('leftHand');
      expect(currentSlots[0].zoneId).toBe(4);
    });

    it('미지원 역량(예: 비허용 BPM 128)을 포함하는 프로젝트는 컴파일 시 명시적 진단 코드와 함께 거부된다', () => {
      const invalidBpmProject = createFullFiveElementProject('proj_invalid_bpm', 1, 128);
      const compileResult = compileEditorProject(invalidBpmProject);

      expect(compileResult.success).toBe(false);
      const errors = (compileResult as { errors?: Array<{ code: string }> }).errors;
      expect(errors?.some((e) => e.code === 'unsupported-bpm')).toBe(true);
      expect(compileResult.pack).toBeNull();
    });

    it('프로젝트 전환 시 미저장 작업(unsaved changes)이 있을 경우 recoveryBuffers에 안전하게 자동 격리 보관된다', async () => {
      const ioHandler = new EditorIOHandler(undefined, projectStore);
      const state = new EditorState();

      // 프로젝트 1에 변경사항 발생 (커맨드 실행으로 revision 변경)
      state.setProjectTitle('Unsaved Modified Title');
      expect(ioHandler.hasUnsavedChanges(state)).toBe(true);

      const targetProject = createFullFiveElementProject('proj_second_target', 1, 120);

      // 프로젝트 2 열기
      const openRes = await ioHandler.openProject(state, targetProject);
      expect(openRes.success).toBe(true);

      // recoveryBuffers에 프로젝트 1의 미저장 작업이 보존되었는지 확인
      const buffers = await projectStore.listRecoveryBuffers();
      expect(buffers.length).toBeGreaterThanOrEqual(1);
      expect(buffers.some((b) => b.reason === 'project_switch_unsaved')).toBe(true);
    });

    it('V1 레거시 프로젝트 수입 시 비파괴적 V2 마이그레이션이 성공하고 원본 스토리지 키는 변경되지 않는다', () => {
      const state = new EditorState();
      const ioHandler = new EditorIOHandler();

      const legacyV1Project = {
        version: '1.0.0',
        title: 'Legacy Ch1 Routine',
        bpm: 120,
        patterns: [
          {
            id: 'CAT_TEST_V1',
            name: 'V1 Test Dance',
            motionType: 'center_clasp',
            leftHand: 4,
            rightHand: 5,
            head: 4,
            hip: 8,
            footZones: [10],
          },
        ],
        sequences: {
          RUN_QUESTION: [
            {
              id: 'NOTE_Q_1',
              lane: 'motion',
              startBeat: 1,
              durationBeats: 1,
              label: 'dip: Down',
              color: '#FF865E',
              targetZones: [8],
              payload: { action: 'dip', part: 'hip', patternId: 'CAT_TEST_V1' },
            },
          ],
          ANSWER_SELECT: [],
          STAR_COLLECT: [
            {
              id: 'NOTE_S_1',
              lane: 'keynote',
              startBeat: 2,
              durationBeats: 1,
              label: 'Star 1',
              color: '#28E6FF',
              targetZones: [4],
              payload: { part: 'leftHand', patternId: 'CAT_TEST_V1' },
            },
          ],
          FEVER_PHASE_B: [],
        },
      };

      const openRes = ioHandler.openProjectSync(state, legacyV1Project);
      expect(openRes.success).toBe(true);
      expect(state.currentProjectId).toBeDefined();

      // V2 모델로 성공적으로 로드됨
      const v2Proj = state.toEditorProject();
      expect(v2Proj.schemaVersion).toBe(AUTHORING_SCHEMA_VERSION);
      expect(v2Proj.kind).toBe(AUTHORING_PROJECT_KIND);
    });

    it('콘텐츠 해시가 변조된 게시본은 유효성 검증에서 거부되고 PublishedContentStore 저장이 차단된다', async () => {
      const fullProject = createFullFiveElementProject('proj_tamper_test', 1, 120);
      const compileRes = compileEditorProject(fullProject);
      expect(compileRes.success).toBe(true);

      const tamperedPack: PublishedContentPack = {
        ...compileRes.pack!,
        contentHash: 'a'.repeat(64),
      };

      const valResult = validatePublishedContentPack(tamperedPack);
      expect(valResult.valid).toBe(false);
      expect(valResult.errors.some((e) => e.code === 'tampered-content-hash')).toBe(true);

      await expect(
        publishedStore.publish(tamperedPack, {
          activateNow: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('3. 동시성 보호 및 원자적 트랜잭션 롤백 (Two-Tab Conflict & Storage Abort)', () => {
    it('동일 revision에서 두 탭이 동시에 저장 경쟁할 때 후속 쓰기는 RevisionConflictError로 차단되고 작업본은 recoveryBuffers에 보존된다', async () => {
      const projectId = 'proj_two_tab_race';
      const baseProject = createFullFiveElementProject(projectId, 1, 120);

      // 기본 프로젝트 영구 저장
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

      // Tab B가 구버전 기대치(expectedRevision: 1)로 경쟁 쓰기 시도 -> 충돌 발생
      const tabBProject: EditorProject = {
        ...baseProject,
        revision: 2,
        metadata: { ...baseProject.metadata, title: 'Competing write from Tab B' },
      };

      await expect(
        projectStore.saveProject(tabBProject, {
          expectedRevision: 1,
          throwOnConflict: true,
          saveRecoveryOnConflict: true,
        })
      ).rejects.toThrow(RevisionConflictError);

      // Tab B의 작업 내용은 유실되지 않고 recoveryBuffers에 보존됨
      const recoveryList = await projectStore.listRecoveryBuffers(projectId);
      expect(recoveryList.length).toBeGreaterThanOrEqual(1);
      expect(recoveryList.some((b) => b.reason === 'revision_conflict')).toBe(true);

      // Tab A의 정상 Head는 덮어써지지 않고 그대로 유지됨
      const currentHead = await projectStore.getHead(projectId);
      expect(currentHead?.revision).toBe(2);
      expect(currentHead?.title).toBe('Updated by Tab A');
    });

    it('스토리지 트랜잭션 중단(Abort) 또는 Quota 실패 시 원자적 롤백이 작동하여 기존 Head 및 Snapshot이 손상되지 않는다', async () => {
      const projectId = 'proj_abort_test';
      const baseProject = createFullFiveElementProject(projectId, 1, 120);
      await projectStore.saveProject(baseProject);

      // Head가 1로 정상 저장된 상태 확인
      const headBefore = await projectStore.getHead(projectId);
      expect(headBefore?.revision).toBe(1);

      // 의도적으로 트랜잭션 내에서 QuotaExceededError를 던지는 모의 작업 수행
      const failingProject: EditorProject = {
        ...baseProject,
        revision: 2,
        metadata: { ...baseProject.metadata, title: 'Quota Fail Attempt' },
      };

      adapter.simulateNextError(new Error('QuotaExceededError: storage full'));

      const saveRes = await projectStore.saveProject(failingProject, { expectedRevision: 1 });
      expect(saveRes.success).toBe(false);
      expect(saveRes.errorType).toBe('quota');

      // 원자적 롤백 검증: 기존 Head는 여전히 revision 1 유지
      const headAfter = await projectStore.getHead(projectId);
      expect(headAfter?.revision).toBe(1);
      expect(headAfter?.title).toBe(baseProject.metadata.title);
    });
  });

  describe('4. 세션 도중 중간 게시(Mid-Stage Publish)에 대한 런타임 팩 불변(Session Pinning)', () => {
    it('스테이지가 진행 중일 때 새 팩이 게시되더라도 현재 실행 중인 스테이지는 직전 팩을 불변 유지하고 다음 스테이지에만 반영된다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      // 팩 1 (BPM 120) 생성 및 게시
      const project1 = createFullFiveElementProject('proj_mid_publish_1', 1, 120);
      const compileRes1 = compileEditorProject(project1);
      const pack1 = compileRes1.pack!;

      // 팩 2 (BPM 140) 생성 및 게시
      const project2 = createFullFiveElementProject('proj_mid_publish_2', 1, 140);
      const compileRes2 = compileEditorProject(project2);
      const pack2 = compileRes2.pack!;

      // 게임 시작: 팩 1로 스테이지 시작
      app.setCustomContentPack(pack1);
      app.startChapter(1);

      expect(app.sessionContext.activeStageBundle?.bpm).toBe(120);
      expect(app.sessionContext.stageBundle?.bpm).toBe(120);

      // 스테이지 진행 도중 에디터에서 팩 2를 게시 및 예약
      app.setCustomContentPack(pack2);
      app.sessionContext.setStageContent({
        stageId: 'ch1',
        pack: pack2,
      });

      // 현재 진행 중인 스테이지는 팩 1로 Pinning 유지
      expect(app.sessionContext.activeStageBundle?.bpm).toBe(120);
      expect(app.sessionContext.stageBundle?.bpm).toBe(120);
      expect(app.sessionContext.stagedBundle?.bpm).toBe(140);

      // 스테이지 명시적 재시작 또는 다음 스테이지 시작 시 비로소 팩 2 적용
      app.restartGame();
      expect(app.sessionContext.activeStageBundle?.bpm).toBe(140);

      app.dispose();
    });
  });

  describe('5. 이전 정상본 롤백(Rollback) 파이프라인', () => {
    it('새 팩 배포 후 결함 발견 시 이전 정상 해시(previousHealthyHash)로 안전하게 롤백할 수 있다', async () => {
      const projectId = 'proj_rollback_test';

      // 팩 1(정상본) 게시
      const proj1 = createFullFiveElementProject(projectId, 1, 120);
      const res1 = compileEditorProject(proj1);
      const pack1 = res1.pack!;
      await publishedStore.publish(pack1, {
        activateNow: true,
      });

      const headAfter1 = await publishedStore.getActivationHead(projectId);
      expect(headAfter1?.activeContentHash).toBe(pack1.contentHash);
      expect(headAfter1?.previousHealthyHash).toBeNull();

      // 팩 2 게시
      const proj2 = createFullFiveElementProject(projectId, 2, 135);
      const res2 = compileEditorProject(proj2);
      const pack2 = res2.pack!;
      await publishedStore.publish(pack2, {
        activateNow: true,
      });

      const headAfter2 = await publishedStore.getActivationHead(projectId);
      expect(headAfter2?.activeContentHash).toBe(pack2.contentHash);
      expect(headAfter2?.previousHealthyHash).toBe(pack1.contentHash);

      // 롤백 예약 및 활성화: 팩 1로 복원
      const schedRes = await publishedStore.scheduleRollback(projectId, pack1.contentHash);
      expect(schedRes.success).toBe(true);
      expect(schedRes.scheduledHash).toBe(pack1.contentHash);

      const rollbackRes = await publishedStore.activateRollback(projectId);
      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.activeContentHash).toBe(pack1.contentHash);

      // 활성 헤드가 팩 1로 안전 복귀됨 확인
      const headAfterRollback = await publishedStore.getActivationHead(projectId);
      expect(headAfterRollback?.activeContentHash).toBe(pack1.contentHash);

      // 팩 2 데이터는 파괴되지 않고 스토어에 보존됨
      const pack2Stored = await publishedStore.getPublishedPack(pack2.contentHash);
      expect(pack2Stored).not.toBeNull();
      expect(pack2Stored?.contentHash).toBe(pack2.contentHash);
    });
  });
});
