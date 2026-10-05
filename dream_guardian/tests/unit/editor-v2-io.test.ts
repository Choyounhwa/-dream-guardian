import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import {
  EditorIOHandler,
  STORAGE_KEY,
  type OpenProjectResult,
} from '../../src/editor/EditorIOHandler.js';
import {
  EditorProjectStore,
} from '../../src/storage/EditorProjectStore.js';
import {
  EditorContentDatabase,
  MemoryIndexedDBAdapter,
} from '../../src/storage/EditorContentDatabase.js';
import type {
  EditorProject,
  EditorSequence,
} from '../../src/data/EditorProject.js';

describe('Editor V2 IO, Atomic Open, Auto-Save, and Recovery (Issue #381 / EDITOR-IO)', () => {
  let state: EditorState;
  let db: EditorContentDatabase;
  let store: EditorProjectStore;
  let mockStorage: Record<string, string>;
  let mockLocalStorage: Storage;
  let ioHandler: EditorIOHandler;

  const validV2Project: EditorProject = {
    kind: 'dream-guardian-authoring-project',
    schemaVersion: 2,
    projectId: 'proj_v2_sample',
    revision: 1,
    rulesetId: 'standard-fitness-v1',
    metadata: {
      title: 'Sample V2 Project',
      author: 'Tester',
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
    previewTempo: {
      bpm: 128,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'PAT_V2_ALPHA',
        name: 'V2 Alpha Pattern',
        target: { leftHand: 4, rightHand: 5, head: 4, hip: 6 },
        description: 'Valid alpha pattern',
      },
      {
        id: 'PAT_V2_BETA',
        name: 'V2 Beta Pattern',
        target: { leftHand: 4, rightHand: 8, head: null, hip: 6 },
      },
    ],
    sequences: [
      {
        id: 'seq_phaseA_star',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'star_evt_1',
            landingTick: 480,
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'PAT_V2_ALPHA',
          },
          {
            id: 'star_evt_2',
            landingTick: 960,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'PAT_V2_ALPHA',
          },
        ],
      },
      {
        id: 'seq_phaseA_motion',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [
          {
            id: 'mot_evt_1',
            startTick: 0,
            durationTicks: 480,
            target: { leftHand: 4, rightHand: 5, head: 4, hip: 6 },
            sourcePatternId: 'PAT_V2_ALPHA',
          },
        ],
      },
      {
        id: 'seq_phaseB_motion',
        phase: 'phaseB',
        kind: 'motionGuide',
        events: [
          {
            id: 'fever_evt_1',
            startTick: 0,
            durationTicks: 480,
            target: { leftHand: 4, rightHand: 8, head: null, hip: 6 },
            sourcePatternId: 'PAT_V2_BETA',
          },
        ],
      },
    ],
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: 'star_collect',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
      },
    ],
  };

  const validV1Package = {
    version: '1.0.0',
    exportedAt: '2026-10-05T00:00:00.000Z',
    bpm: 115,
    selectedPhase: 'STAR_COLLECT',
    selectedPatternId: 'CAT_TEST_V1',
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

  beforeEach(async () => {
    mockStorage = {};
    mockLocalStorage = {
      getItem: vi.fn((k: string) => mockStorage[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        mockStorage[k] = v;
      }),
      removeItem: vi.fn((k: string) => {
        delete mockStorage[k];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    } as unknown as Storage;

    db = new EditorContentDatabase(new MemoryIndexedDBAdapter());
    await db.open();
    store = new EditorProjectStore(db);

    state = new EditorState();
    ioHandler = new EditorIOHandler(mockLocalStorage, store);
  });

  describe('1. 엄격한 원자적 열기 & 실패 시 상태/알림 0회 보장 (Atomic Open)', () => {
    it('단 하나의 잘못된 노트/속성 오류 시에도 전체 수입을 거부하고 알림 0회 및 기존 상태 100% 보존', async () => {
      const initialBpm = state.bpm;
      const initialPatternsCount = state.getPatterns().length;
      const initialNotesCount = state.getCurrentPhaseNotes().length;

      const stateListener = vi.fn();
      const docListener = vi.fn();
      state.addListener({
        onStateChange: stateListener,
        onDocumentChange: docListener,
      });

      // 복제 후 단 1개의 노트에 비정상적인 존(예: 음수 존 -99) 주입
      const corruptProject = JSON.parse(JSON.stringify(validV2Project));
      corruptProject.sequences[0].events[0].target.zoneId = -99;

      const result: OpenProjectResult = await ioHandler.openProject(state, corruptProject);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 알림 0회 검증
      expect(stateListener).toHaveBeenCalledTimes(0);
      expect(docListener).toHaveBeenCalledTimes(0);

      // 기존 프로젝트 상태 무변경 보존 검증
      expect(state.bpm).toBe(initialBpm);
      expect(state.getPatterns().length).toBe(initialPatternsCount);
      expect(state.getCurrentPhaseNotes().length).toBe(initialNotesCount);
    });

    it('V1 패키지에서 부분적으로 유효하지 않은 패턴이 존재할 때 부분 수입을 금지하고 전체 거부', async () => {
      const initialPatternsCount = state.getPatterns().length;
      const docListener = vi.fn();
      state.addListener({ onDocumentChange: docListener });

      // 유효한 패턴 1개 + Cross-Body 위반 불가능한 패턴 1개 포함
      const mixedV1 = JSON.parse(JSON.stringify(validV1Package));
      mixedV1.patterns.push({
        id: 'CAT_INVALID_CROSS',
        name: 'Invalid Cross Body',
        leftHand: 1, // 왼손 Zone 1 (상단)
        hip: 10,     // 골반 Zone 10 (하단) -> Cross-Body 위반
      });

      const result = await ioHandler.openProject(state, mixedV1);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(docListener).toHaveBeenCalledTimes(0);
      expect(state.getPatterns().length).toBe(initialPatternsCount);
      expect(state.registry.get('CAT_TEST_V1')).toBeUndefined();
    });

    it('완전 유효한 V2 프로젝트 열기 시 정확히 1회의 문서 변경 알림을 발송하고 프로젝트 교체', async () => {
      const docListener = vi.fn();
      state.addListener({ onDocumentChange: docListener });

      const result = await ioHandler.openProject(state, validV2Project);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(docListener).toHaveBeenCalledTimes(1);

      // State 반영 확인
      expect(state.bpm).toBe(128);
      expect(state.currentProjectId).toBe('proj_v2_sample');
      expect(state.registry.get('PAT_V2_ALPHA')).toBeDefined();
      expect(state.registry.get('PAT_V2_BETA')).toBeDefined();
    });
  });

  describe('2. 누락 시퀀스 잔존 방지 및 삭제 패턴 부활 방지', () => {
    it('프로젝트 교체 시 이전 프로젝트에만 존재하던 패턴과 시퀀스가 완전히 제거됨', async () => {
      // 1. 커스텀 패턴 등록 및 이전 프로젝트 상태 형성
      state.createNewPattern({
        id: 'PAT_TO_BE_REMOVED',
        name: 'Old Pattern',
        description: '',
        motionType: 'center_clasp',
        leftHand: 4,
        rightHand: 5,
        head: 4,
        hip: 8,
        footZones: [],
      });
      expect(state.registry.get('PAT_TO_BE_REMOVED')).toBeDefined();

      // 2. 새 프로젝트 열기 (PAT_TO_BE_REMOVED가 포함되어 있지 않음)
      const result = await ioHandler.openProject(state, validV2Project);
      expect(result.success).toBe(true);

      // 3. 삭제 패턴 부활 방지: 이전 패턴이 registry에 잔존하지 않아야 함
      expect(state.registry.get('PAT_TO_BE_REMOVED')).toBeUndefined();
      expect(state.registry.getAll().map((p) => p.id)).toEqual(['PAT_V2_ALPHA', 'PAT_V2_BETA']);
    });

    it('이전 프로젝트의 타임라인 노트가 새 프로젝트의 빈 시퀀스로 깨끗이 대체됨 (누락 시퀀스 잔존 금지)', async () => {
      // FEVER_PHASE_B 시퀀스가 빈 새 프로젝트
      const projectWithoutFever = JSON.parse(JSON.stringify(validV2Project));
      projectWithoutFever.sequences = projectWithoutFever.sequences.filter(
        (s: EditorSequence) => s.phase !== 'phaseB'
      );

      const result = await ioHandler.openProject(state, projectWithoutFever);
      expect(result.success).toBe(true);

      const feverNotes = state.sequenceEditor.getNotesForPhase('FEVER_PHASE_B');
      expect(feverNotes).toHaveLength(0);
    });
  });

  describe('3. 스토어 자동저장 & Quota 실패 복구 보존 & 기존 Head 100% 보존', () => {
    it('저장소 쓰기 실패 시 기존 정상 Head 100% 보존 및 recoveryBuffers에 안전 보존', async () => {
      // 1. 먼저 정상 저장
      await ioHandler.openProject(state, validV2Project);
      const saveRes1 = await ioHandler.saveDraft(state);
      expect(saveRes1.success).toBe(true);

      const originalHead = await store.getHead(validV2Project.projectId);
      expect(originalHead).not.toBeNull();
      expect(originalHead?.revision).toBe(saveRes1.revision);

      // 2. Mock DB에서 다음 트랜잭션 put 실패(QuotaExceeded) 시뮬레이션
      vi.spyOn(db.adapter, 'transaction').mockRejectedValueOnce(
        new Error('QuotaExceededError: storage limit reached')
      );

      // 3. 수정 후 저장 시도 -> 실패 발생
      state.setBpm(140);
      const saveRes2 = await ioHandler.saveDraft(state, { saveRecoveryOnError: true });
      expect(saveRes2.success).toBe(false);

      // 4. 기존 Head는 revision 1 상태로 100% 온전히 보존
      const headAfterFail = await store.getHead(validV2Project.projectId);
      expect(headAfterFail?.revision).toBe(originalHead?.revision);

      // 5. 복구 버퍼에 미저장 본이 보존되었는지 검증
      const recoveryList = await store.listRecoveryBuffers(validV2Project.projectId);
      expect(recoveryList.length).toBeGreaterThan(0);
    });
  });

  describe('4. 동시성 가드 & Stale Save Callback 덮어쓰기 방지', () => {
    it('오래된 비동기 저장 응답이 최신 리비전이나 새로 전환된 프로젝트를 덮어쓰지 않음', async () => {
      await ioHandler.openProject(state, validV2Project);
      await ioHandler.saveDraft(state); // revision 1 저장

      // 새 프로젝트로 즉시 전환
      const nextProject: EditorProject = {
        ...validV2Project,
        projectId: 'proj_v2_next',
        metadata: { ...validV2Project.metadata, title: 'Next Project' },
      };
      await ioHandler.openProject(state, nextProject);

      // 이전 프로젝트(proj_v2_sample)에 대한 지연된 stale save 시도
      const staleProject: EditorProject = {
        ...validV2Project,
        projectId: 'proj_v2_sample',
        revision: 1,
      };

      const staleResult = await ioHandler.handleAsyncSaveResponse(state, staleProject, {
        success: true,
        revision: 1,
      });

      // 동시성 가드로 인해 현재 state가 오염되거나 덮어쓰이지 않음
      expect(staleResult.applied).toBe(false);
      expect(state.currentProjectId).toBe('proj_v2_next');
    });

    it('stale revision이 저장소에 더 높은 revision을 덮어쓰려 할 때 충돌 거부', async () => {
      await ioHandler.openProject(state, validV2Project);
      await ioHandler.saveDraft(state); // Head = 1

      // State는 revision 3으로 전진했다고 가정
      state.setBpm(135);
      state.setBpm(140);

      // 기대 리비전이 0(오래된 값)으로 전달되면 충돌 거부
      const conflictResult = await ioHandler.saveDraft(state, { expectedRevision: 0 });
      expect(conflictResult.success).toBe(false);
      expect(conflictResult.isConflict).toBe(true);
    });
  });

  describe('5. V1 레거시 원본 불변 보존 (Non-destructive Read)', () => {
    it('V1 LocalStorage 데이터를 복원할 때 원본 Storage 키 값을 일체 수정/삭제하지 않음', async () => {
      const v1JsonString = JSON.stringify(validV1Package);
      mockStorage[STORAGE_KEY] = v1JsonString;

      const restored = await ioHandler.restoreLatestProject(state);
      expect(restored.success).toBe(true);
      expect(restored.source).toBe('legacy_storage');

      // V1 원본 문자열이 스토리지에 그대로 보존되어야 함 (mutation 0회)
      expect(mockStorage[STORAGE_KEY]).toBe(v1JsonString);
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();

      // State에는 V2로 정상 적재
      expect(state.bpm).toBe(115);
      expect(state.registry.get('CAT_TEST_V1')).toBeDefined();
    });
  });

  describe('6. JSON 내보내기 및 재열기 의미론적 동일성 (Roundtrip)', () => {
    it('V2 프로젝트를 JSON으로 내보낸 후 새 상태에 다시 열었을 때 데이터가 완벽히 동일함', async () => {
      await ioHandler.openProject(state, validV2Project);

      const exportedJson = ioHandler.exportProjectJSON(state);
      expect(typeof exportedJson).toBe('string');

      const newState = new EditorState();
      const openResult = await ioHandler.openProject(newState, exportedJson);
      expect(openResult.success).toBe(true);

      // 의미론적 동일성 검증
      expect(newState.currentProjectId).toBe(state.currentProjectId);
      expect(newState.bpm).toBe(state.bpm);

      const origPatterns = state.getPatterns();
      const newPatterns = newState.getPatterns();
      expect(newPatterns.length).toBe(origPatterns.length);
      for (let i = 0; i < origPatterns.length; i++) {
        expect(newPatterns[i].id).toBe(origPatterns[i].id);
        expect(newPatterns[i].name).toBe(origPatterns[i].name);
        expect(newPatterns[i].leftHand).toBe(origPatterns[i].leftHand);
        expect(newPatterns[i].rightHand).toBe(origPatterns[i].rightHand);
      }

      const origStarNotes = state.sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const newStarNotes = newState.sequenceEditor.getNotesForPhase('STAR_COLLECT');
      expect(newStarNotes.length).toBe(origStarNotes.length);
    });
  });

  describe('7. 새로고침 복원 (Refresh Restoration)', () => {
    it('스토어에 저장된 프로젝트가 있을 때 restoreLatestProject()가 최신 Head를 복원한다', async () => {
      await ioHandler.openProject(state, validV2Project);
      await ioHandler.saveDraft(state);

      const freshState = new EditorState();
      const freshIO = new EditorIOHandler(mockLocalStorage, store);

      const restoreResult = await freshIO.restoreLatestProject(freshState);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.source).toBe('store');
      expect(freshState.currentProjectId).toBe(validV2Project.projectId);
      expect(freshState.bpm).toBe(validV2Project.previewTempo.bpm);
    });

    it('스토어 및 로컬스토리지가 모두 비어있을 때 크래시 없이 우아하게 fallback', async () => {
      const freshState = new EditorState();
      const initialBpm = freshState.bpm;
      const freshIO = new EditorIOHandler(mockLocalStorage, store);

      const restoreResult = await freshIO.restoreLatestProject(freshState);
      expect(restoreResult.success).toBe(false);
      expect(restoreResult.source).toBe('none');
      expect(freshState.bpm).toBe(initialBpm);
    });
  });

  describe('8. 패턴 라이브러리 병합 API (Library Merge)', () => {
    it('mergePatternLibrary()가 신규 패턴을 성공적으로 병합하고 충돌을 정책에 맞게 해결', async () => {
      await ioHandler.openProject(state, validV2Project);

      // 이미 PAT_V2_ALPHA가 존재하는 상태에서 같은 ID의 새 패턴을 rename 정책으로 병합
      const incomingPatterns = [
        {
          id: 'PAT_V2_ALPHA',
          name: 'Imported Alpha',
          target: { leftHand: 6, rightHand: 8, head: 4, hip: 10 },
        },
        {
          id: 'PAT_NEW_GAMMA',
          name: 'New Gamma',
          target: { leftHand: 4, rightHand: 5, head: null, hip: null },
        },
      ];

      const mergeResult = ioHandler.mergePatternLibrary(state, incomingPatterns, {
        collisionPolicy: 'rename',
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.importedCount).toBe(1);
      expect(mergeResult.renamedCount).toBe(1);

      // PAT_NEW_GAMMA 등록 확인
      expect(state.registry.get('PAT_NEW_GAMMA')).toBeDefined();
      // 충돌된 PAT_V2_ALPHA는 새 이름으로 등록되어 기존 패턴 보존
      expect(state.registry.get('PAT_V2_ALPHA')?.name).toBe('V2 Alpha Pattern');
      expect(state.registry.get('PAT_V2_ALPHA_copy')?.name).toBe('Imported Alpha (Copy)');
    });

    it('손상된 패턴 병합 시 전체 거부하고 기존 라이브러리 보존', async () => {
      await ioHandler.openProject(state, validV2Project);
      const countBefore = state.getPatterns().length;

      const corruptPatterns = [
        {
          id: 'PAT_CORRUPT',
          name: 'Corrupt',
          target: { leftHand: 99 }, // 허용되지 않는 존
        },
      ];

      const mergeResult = ioHandler.mergePatternLibrary(state, corruptPatterns);
      expect(mergeResult.success).toBe(false);
      expect(state.getPatterns().length).toBe(countBefore);
      expect(state.registry.get('PAT_CORRUPT')).toBeUndefined();
    });
  });
});
