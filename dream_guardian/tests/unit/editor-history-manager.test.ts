import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorHistoryManager } from '../../src/editor/EditorHistoryManager.js';
import { ProjectCommandManager, AddPatternCommand } from '../../src/editor/ProjectCommands.js';
import type { EditorProject } from '../../src/data/EditorProject.js';

describe('EditorHistoryManager - 히스토리(Undo/Redo) 및 직렬화/프로젝트 라이프사이클 분리 (#624)', () => {
  let state: EditorState;
  let historyManager: EditorHistoryManager;

  beforeEach(() => {
    state = new EditorState();
    historyManager = state.historyManager;
  });

  describe('1. 인스턴스 생성 및 초기화', () => {
    it('EditorState로부터 분리된 historyManager 인스턴스를 제공한다', () => {
      expect(historyManager).toBeDefined();
      expect(historyManager).toBeInstanceOf(EditorHistoryManager);
      expect(state.historyManager).toBe(historyManager);
    });

    it('기본 commandManager가 올바르게 초기화되어 있다', () => {
      expect(historyManager.commandManager).toBeDefined();
      expect(historyManager.commandManager).toBeInstanceOf(ProjectCommandManager);
      expect(state.commandManager).toBe(historyManager.commandManager);
      expect(historyManager.revision).toBe(1);
    });

    it('초기 히스토리 상태는 Undo/Redo 불가 상태이다', () => {
      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(false);
      expect(state.canUndo()).toBe(false);
      expect(state.canRedo()).toBe(false);
    });

    it('초기 발행 상태(PublicationStatus)를 정확히 보고한다', () => {
      const status = historyManager.getProjectPublicationStatus();
      expect(status.currentRevision).toBe(1);
      expect(status.savedRevision).toBe(0);
      expect(status.isClean).toBe(false); // saved(0) !== current(1)
      expect(status.isPublished).toBe(false);
      expect(status.isDraft).toBe(true);
    });
  });

  describe('2. Undo / Redo 연동 및 리비전 관리', () => {
    it('명령 실행 후 Undo/Redo가 가능하고 EditorState 및 historyManager에서 정상 동작한다', () => {
      const initialRev = historyManager.revision;

      // 1. 명령 실행 (패턴 추가)
      const res = historyManager.commandManager.executeCommand(
        new AddPatternCommand({
          id: 'PAT_HISTORY_TEST',
          name: 'History Test Pattern',
          target: { leftHand: 3, rightHand: 4 },
        })
      );
      expect(res.success).toBe(true);
      expect(historyManager.revision).toBe(initialRev + 1);
      expect(historyManager.canUndo()).toBe(true);
      expect(historyManager.canRedo()).toBe(false);
      expect(state.canUndo()).toBe(true);

      // 2. Undo 실행
      const undoRes = state.undo();
      expect(undoRes.success).toBe(true);
      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(true);
      expect(state.canRedo()).toBe(true);

      // 3. Redo 실행
      const redoRes = state.redo();
      expect(redoRes.success).toBe(true);
      expect(historyManager.canUndo()).toBe(true);
      expect(historyManager.canRedo()).toBe(false);
    });

    it('저장 및 발행 상태를 갱신할 수 있다', () => {
      historyManager.markSaved();
      let status = historyManager.getProjectPublicationStatus();
      expect(status.savedRevision).toBe(historyManager.revision);
      expect(status.isClean).toBe(true);

      historyManager.markPublished();
      status = historyManager.getProjectPublicationStatus();
      expect(status.isPublished).toBe(true);
      expect(status.isDraft).toBe(false);

      historyManager.markUnpublished();
      status = historyManager.getProjectPublicationStatus();
      expect(status.isPublished).toBe(false);
      expect(status.isDraft).toBe(true);
    });
  });

  describe('3. 프로젝트 직렬화 (Serialization)', () => {
    it('toEditorProject 및 buildExportProject로 현재 에디터 상태를 완전한 EditorProject로 직렬화한다', () => {
      const project = historyManager.toEditorProject();

      expect(project.kind).toBe('dream-guardian-authoring-project');
      expect(project.schemaVersion).toBe(2);
      expect(project.projectId).toBe(state.currentProjectId);
      expect(project.previewTempo.bpm).toBe(state.bpm);
      expect(project.patterns.length).toBeGreaterThanOrEqual(4);
      expect(project.sequences.length).toBeGreaterThanOrEqual(5);
      expect(project.bindings.length).toBeGreaterThanOrEqual(4);

      const exported = historyManager.buildExportProject();
      expect(exported.projectId).toBe(project.projectId);
      expect(exported.patterns.length).toBe(project.patterns.length);
    });

    it('EditorState.toEditorProject와 historyManager.toEditorProject의 결과가 100% 동일하다', () => {
      const fromState = state.toEditorProject();
      const fromHelper = historyManager.toEditorProject();

      expect(fromState.projectId).toBe(fromHelper.projectId);
      expect(fromState.revision).toBe(fromHelper.revision);
      expect(fromState.patterns).toEqual(fromHelper.patterns);
      expect(fromState.sequences).toEqual(fromHelper.sequences);
      expect(fromState.bindings).toEqual(fromHelper.bindings);
    });
  });

  describe('4. 프로젝트 역직렬화 (Deserialization / applyProject)', () => {
    it('applyProject로 EditorProject 데이터를 에디터 상태에 정확히 복원한다', () => {
      const originalProject = historyManager.toEditorProject();

      // 프로젝트 데이터 변형
      const modifiedProject: EditorProject = {
        ...originalProject,
        projectId: 'proj_restored_test',
        previewTempo: { bpm: 135, beatsPerBar: 4 },
        metadata: {
          ...originalProject.metadata,
          title: 'Modified Restoration Title',
        },
      };

      historyManager.applyProject(modifiedProject, { skipCommand: true });

      expect(state.currentProjectId).toBe('proj_restored_test');
      expect(state.bpm).toBe(135);
      expect(state.projectTitle).toBe('Modified Restoration Title');
    });
  });

  describe('5. 프로젝트 복제 (cloneProject)', () => {
    it('cloneProject로 고유 ID가 부여된 신규 프로젝트 사본을 생성한다', () => {
      const cloned = historyManager.cloneProject('proj_cloned_99');

      expect(cloned.projectId).toBe('proj_cloned_99');
      expect(cloned.revision).toBe(1);
      expect(cloned.metadata.title).toMatch(/복제본|Copy/);

      // ID 리매핑 검증
      expect(cloned.patterns.every((p) => p.id.includes('proj_cloned_99'))).toBe(true);
      expect(cloned.sequences.every((s) => s.id.includes('proj_cloned_99'))).toBe(true);
    });

    it('EditorState.cloneProject가 historyManager에 정상 위임된다', () => {
      const clonedFromState = state.cloneProject('proj_state_clone');
      expect(clonedFromState.projectId).toBe('proj_state_clone');
    });
  });

  describe('6. 신규 프로젝트 생성 (newProject)', () => {
    it('newProject 호출 시 기본값으로 초기화된 새 프로젝트를 생성하고 commandManager를 재설정한다', () => {
      state.setBpm(160);
      const newProj = historyManager.newProject({ title: 'Brand New Project', projectId: 'proj_fresh_01' });

      expect(newProj.projectId).toBe('proj_fresh_01');
      expect(newProj.metadata.title).toBe('Brand New Project');
      expect(state.bpm).toBe(95);
      expect(historyManager.revision).toBe(1);
      expect(historyManager.canUndo()).toBe(false);
    });

    it('EditorState.newProject가 historyManager에 정상 위임된다', () => {
      const res = state.newProject({ title: 'Via State' });
      expect(res.metadata.title).toBe('Via State');
      expect(state.bpm).toBe(95);
    });
  });

  describe('7. 바인딩 및 스테이지 커버리지 관리', () => {
    it('바인딩 추가/수정/삭제 시 유효성 검증과 commandManager 명령 실행이 수행된다', () => {
      const initialCount = state.getBindings().length;
      const initialRev = historyManager.revision;

      // 1. 유효한 바인딩 추가
      const addRes = historyManager.addBinding({
        chapterId: 'ch2',
        subLevelId: 'run_question',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_motion',
        role: 'motionGuide',
      });
      expect(addRes.success).toBe(true);
      expect(state.getBindings().length).toBe(initialCount + 1);
      expect(historyManager.revision).toBe(initialRev + 1);

      // 2. 바인딩 삭제
      const removeRes = historyManager.removeBinding(state.getBindings().length - 1);
      expect(removeRes).toBe(true);
      expect(state.getBindings().length).toBe(initialCount);
    });

    it('스테이지 커버리지 및 보스 결전 진단을 정확히 수행한다', () => {
      const coverage = historyManager.getStageCoverageReport();
      expect(coverage).toBeDefined();
      expect(coverage.stages.length).toBeGreaterThanOrEqual(1);

      const bossDiag = historyManager.diagnoseBossClimaxBindings('ch1');
      expect(bossDiag).toBeDefined();
      expect(bossDiag.chapterId).toBe('ch1');
    });
  });
});
