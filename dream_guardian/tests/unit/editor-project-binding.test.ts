import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import type { EditorBinding, EditorProject } from '../../src/data/EditorProject.js';
import { compileEditorProject } from '../../src/data/ContentCompiler.js';

describe('EDITOR-BINDING (#385): 프로젝트 구간·스테이지 연결 및 저장·적용 상태 UX', () => {
  let state: EditorState;

  beforeEach(() => {
    state = new EditorState();
  });

  describe('1. Stage Bindings Management & Compound Keys', () => {
    it('기본 프로젝트는 4개 기본 구간에 대한 스테이지 바인딩을 포함한다', () => {
      const bindings = state.getBindings();
      expect(bindings.length).toBeGreaterThanOrEqual(4);

      const starBinding = bindings.find((b) => b.sequenceId === 'seq_phaseA_star');
      expect(starBinding).toBeDefined();
      expect(starBinding?.chapterId).toBe('ch1');
      expect(starBinding?.phase).toBe('phaseA');
    });

    it('compound key (chapterId + subLevelId + phase + role)로 신규 바인딩을 추가할 수 있다', () => {
      const newBinding: EditorBinding = {
        chapterId: 'ch2',
        subLevelId: 'star_collect',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
        role: 'starNotes',
      };

      const result = state.addBinding(newBinding);
      expect(result.success).toBe(true);

      const bindings = state.getBindings();
      const added = bindings.find(
        (b) => b.chapterId === 'ch2' && b.subLevelId === 'star_collect' && b.sequenceId === 'seq_phaseA_star'
      );
      expect(added).toBeDefined();
      expect(added?.role).toBe('starNotes');
    });

    it('기존 바인딩을 업데이트할 수 있다', () => {
      const initialCount = state.getBindings().length;
      const updatedBinding: EditorBinding = {
        chapterId: 'ch1',
        subLevelId: 'star_collect_custom',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
        role: 'starNotes',
      };

      const result = state.updateBinding(0, updatedBinding);
      expect(result.success).toBe(true);
      expect(state.getBindings().length).toBe(initialCount);
      expect(state.getBindings()[0].subLevelId).toBe('star_collect_custom');
    });

    it('바인딩을 삭제할 수 있다', () => {
      const initialCount = state.getBindings().length;
      const removed = state.removeBinding(0);
      expect(removed).toBe(true);
      expect(state.getBindings().length).toBe(initialCount - 1);
    });
  });

  describe('2. Binding Validation & Rejection of Duplicates and Broken References', () => {
    it('존재하지 않는 sequenceId를 참조하는 바인딩 추가는 거부된다', () => {
      const invalidBinding: EditorBinding = {
        chapterId: 'ch1',
        subLevelId: 'custom_section',
        phase: 'phaseA',
        sequenceId: 'non_existent_seq_999',
        role: 'motionGuide',
      };

      const result = state.addBinding(invalidBinding);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unknown sequence|broken-sequence-reference/i);
    });

    it('동일한 compound key를 갖는 중복 바인딩 추가는 거부된다', () => {
      // 이미 ch1::star_collect::phaseA::starNotes 가 존재함
      const duplicateBinding: EditorBinding = {
        chapterId: 'ch1',
        subLevelId: 'star_collect',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
        role: 'starNotes',
      };

      const result = state.addBinding(duplicateBinding);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
    });

    it('sequence의 phase와 binding의 phase가 불일치하면 거부된다 (phase mismatch)', () => {
      // seq_phaseA_star는 phaseA 시퀀스인데 phaseB로 바인딩 시도
      const mismatchedPhaseBinding: EditorBinding = {
        chapterId: 'ch2',
        subLevelId: 'fever_boss',
        phase: 'phaseB',
        sequenceId: 'seq_phaseA_star',
        role: 'feverNotes',
      };

      const result = state.addBinding(mismatchedPhaseBinding);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/phase mismatch/i);
    });

    it('sequence의 kind와 binding의 role이 불일치하면 거부된다 (role mismatch)', () => {
      // seq_phaseA_motion은 motionGuide 시퀀스인데 role을 starNotes로 지정
      const mismatchedRoleBinding: EditorBinding = {
        chapterId: 'ch2',
        subLevelId: 'star_section',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_motion',
        role: 'starNotes',
      };

      const result = state.addBinding(mismatchedRoleBinding);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/role mismatch/i);
    });
  });

  describe('3. Project Duplication & Safe ID Remapping', () => {
    it('프로젝트 복제 시 새로운 고유 projectId가 생성된다', () => {
      const originalId = state.currentProjectId;
      const cloned = state.cloneProject('proj_cloned_custom');

      expect(cloned.projectId).toBe('proj_cloned_custom');
      expect(cloned.projectId).not.toBe(originalId);
      expect(cloned.metadata.title).toContain('복제본');
    });

    it('프로젝트 복제 시 내부 pattern ID와 sequence ID가 안전하게 재매핑된다', () => {
      const originalProject = state.buildExportProject();
      const cloned = state.cloneProject();

      // 패턴 ID 재매핑 확인
      const originalPatternIds = originalProject.patterns.map((p) => p.id);
      const clonedPatternIds = cloned.patterns.map((p) => p.id);
      expect(clonedPatternIds).not.toEqual(originalPatternIds);

      // 시퀀스 ID 재매핑 확인
      const originalSeqIds = originalProject.sequences.map((s) => s.id);
      const clonedSeqIds = cloned.sequences.map((s) => s.id);
      expect(clonedSeqIds).not.toEqual(originalSeqIds);

      // 바인딩의 sequenceId 참조도 새 시퀀스 ID로 재매핑되었는지 확인
      for (const binding of cloned.bindings) {
        expect(clonedSeqIds).toContain(binding.sequenceId);
        expect(originalSeqIds).not.toContain(binding.sequenceId);
      }

      // 시퀀스 내 이벤트의 sourcePatternId 참조도 새 패턴 ID로 재매핑되었는지 확인
      for (const seq of cloned.sequences) {
        for (const ev of seq.events) {
          if ('sourcePatternId' in ev && ev.sourcePatternId) {
            expect(clonedPatternIds).toContain(ev.sourcePatternId);
            expect(originalPatternIds).not.toContain(ev.sourcePatternId);
          }
        }
      }
    });

    it('newProject() 호출 시 깨끗한 기본 프로젝트로 초기화된다', () => {
      state.addBinding({
        chapterId: 'ch5',
        subLevelId: 'nightmare',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_motion',
        role: 'motionGuide',
      });

      const newProj = state.newProject({ title: 'Brand New Project' });
      expect(newProj.metadata.title).toBe('Brand New Project');
      expect(newProj.revision).toBe(1);

      // 추가했던 ch5 바인딩이 초기화되었는지 확인
      const bindings = state.getBindings();
      expect(bindings.some((b) => b.chapterId === 'ch5')).toBe(false);
    });
  });

  describe('4. Explicit Builtin Stage Presets vs Missing Stage Sections', () => {
    it('지정된 스테이지의 명시적 내장 프리셋 설정 및 조회가 가능하다', () => {
      state.setStageBuiltinProfile('ch2', 'ch2-default-v2');
      const profiles = state.getStageBuiltinProfiles();
      expect(profiles['ch2']).toBe('ch2-default-v2');

      state.setStageBuiltinProfile('ch2', null);
      expect(state.getStageBuiltinProfiles()['ch2']).toBeUndefined();
    });

    it('스테이지 커버리지 상태에서 바인딩 완료, 내장 프리셋 완료, 누락(Missing), 부분 미완성(Partial)을 명확히 구분한다', () => {
      // ch1: 기본 바인딩 있음 -> bound
      // ch2: 내장 프리셋 지정 -> builtin
      // ch3: 바인딩도 없고 프리셋도 없음 -> missing
      // ch4: phaseA 바인딩만 있고 phaseB가 없음 -> partial
      state.setStageBuiltinProfile('ch2', 'ch2-default-v2');
      state.addBinding({
        chapterId: 'ch4',
        subLevelId: 'custom_section',
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
        role: 'starNotes',
      });

      const report = state.getStageCoverageStatus(['ch1', 'ch2', 'ch3', 'ch4']);

      const ch1Status = report.stages.find((s) => s.chapterId === 'ch1');
      const ch2Status = report.stages.find((s) => s.chapterId === 'ch2');
      const ch3Status = report.stages.find((s) => s.chapterId === 'ch3');
      const ch4Status = report.stages.find((s) => s.chapterId === 'ch4');

      expect(ch1Status?.status).toBe('bound');
      expect(ch1Status?.isComplete).toBe(true);

      expect(ch2Status?.status).toBe('builtin');
      expect(ch2Status?.isComplete).toBe(true);

      expect(ch3Status?.status).toBe('missing');
      expect(ch3Status?.isComplete).toBe(false);

      expect(ch4Status?.status).toBe('partial');
      expect(ch4Status?.isComplete).toBe(false);

      expect(report.isComplete).toBe(false);
      expect(report.missingStages).toContain('ch3');
      expect(report.partialStages).toContain('ch4');
    });

    it('모든 필수 스테이지가 바인딩 또는 내장 프리셋으로 채워지면 전체 완료(isComplete=true)를 보고한다', () => {
      state.setStageBuiltinProfile('ch2', 'ch2-default-v2');
      state.setStageBuiltinProfile('ch3', 'ch3-default-v2');
      state.setStageBuiltinProfile('ch4', 'ch4-default-v2');
      state.setStageBuiltinProfile('ch5', 'ch5-default-v2');

      const report = state.getStageCoverageStatus(['ch1', 'ch2', 'ch3', 'ch4', 'ch5']);
      expect(report.isComplete).toBe(true);
      expect(report.missingStages.length).toBe(0);
      expect(report.partialStages.length).toBe(0);
    });
  });

  describe('5. Draft, Saved Revision & Publication Status Tracking', () => {
    it('초기 상태는 미저장/초안 상태를 정확히 반영한다', () => {
      const status = state.getProjectPublicationStatus();
      expect(status.currentRevision).toBeGreaterThanOrEqual(1);
      expect(status.savedRevision).toBe(0);
      expect(status.isClean).toBe(false);
      expect(status.isDraft).toBe(true);
      expect(status.isPublished).toBe(false);
    });

    it('저장(markSaved) 호출 시 isClean=true가 되고 savedRevision이 currentRevision과 일치한다', () => {
      state.markSaved();
      const status = state.getProjectPublicationStatus();
      expect(status.savedRevision).toBe(status.currentRevision);
      expect(status.isClean).toBe(true);
      expect(status.isPublished).toBe(false);
    });

    it('게시(markPublished) 호출 시 isPublished=true가 된다', () => {
      state.markSaved();
      state.markPublished();
      const status = state.getProjectPublicationStatus();
      expect(status.isPublished).toBe(true);
      expect(status.isDraft).toBe(false);
    });

    it('저장 후 새로운 수정이 발생하면 미저장(isClean=false) 초안 상태로 복귀한다', () => {
      state.markSaved();
      expect(state.getProjectPublicationStatus().isClean).toBe(true);

      // 패턴 추가 등으로 문서 변경 발생
      state.setProjectTitle('Modified Title');

      const status = state.getProjectPublicationStatus();
      expect(status.isClean).toBe(false);
      expect(status.currentRevision).toBeGreaterThan(status.savedRevision);
      expect(status.isDraft).toBe(true);
    });
  });

  describe('6. Active Draft & Compiled Pack Immutability Isolation', () => {
    it('프로젝트명 변경이 이전에 내보낸/저장된 프로젝트 객체를 오염시키지 않는다', () => {
      state.markSaved();
      const snapshotBefore = state.buildExportProject();
      const originalTitle = snapshotBefore.metadata.title;

      state.setProjectTitle('Updated New Title');
      const snapshotAfter = state.buildExportProject();

      expect(snapshotBefore.metadata.title).toBe(originalTitle);
      expect(snapshotAfter.metadata.title).toBe('Updated New Title');
      expect(snapshotBefore.metadata.title).not.toBe(snapshotAfter.metadata.title);
    });

    it('컴파일된 패키지는 이후 에디터 상태 수정에 영향을 받지 않는다', () => {
      const validProject: EditorProject = {
        kind: 'dream-guardian-authoring-project',
        schemaVersion: 2,
        projectId: 'proj_publish_test',
        revision: 1,
        rulesetId: 'dg-ruleset-v2',
        metadata: {
          title: 'Publishable Test Project',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        previewTempo: { bpm: 120, beatsPerBar: 4 },
        patterns: [
          { id: 'pat_1', name: 'Pat 1', target: { leftHand: 1, rightHand: 5, head: null, hip: null } },
        ],
        sequences: [
          {
            id: 'seq_1',
            phase: 'phaseA',
            kind: 'starNotes',
            events: [
              { id: 'ev_1', kind: 'starNote', landingTick: 960, target: { type: 'cursor', part: 'leftHand', zoneId: 1 } },
            ],
          },
        ],
        bindings: [
          { chapterId: 'ch1', subLevelId: 'all', phase: 'phaseA', sequenceId: 'seq_1', role: 'starNotes' },
        ],
      };
      state.applyProject(validProject);
      const snapshot = state.buildExportProject();
      const compileResult = compileEditorProject(snapshot);
      expect(compileResult.success).toBe(true);

      const compiledTitle = compileResult.pack?.metadata.title;

      // 에디터 프로젝트명 및 바인딩 변경
      state.setProjectTitle('Title Changed Post-Compile');
      state.removeBinding(0);

      // 이미 컴파일된 팩은 불변 유지
      expect(compileResult.pack?.metadata.title).toBe(compiledTitle);
      expect(compileResult.pack?.metadata.title).not.toBe('Title Changed Post-Compile');
    });
  });

  describe('7. EditorLayout Rendering for Bindings & Status UX', () => {
    let layout: EditorLayout;

    beforeEach(() => {
      layout = new EditorLayout(state);
    });

    it('상태 표시줄(Status Bar)에 Draft Revision, Save state, Publication badge가 렌더링된다', () => {
      const html = layout.renderStatusBarHTML();
      expect(html).toContain('editor-status-bar');
      expect(html).toContain('Draft');
      expect(html).toContain('rev');
      expect(html).toMatch(/미저장|저장됨/);
      expect(html).toMatch(/미게시 초안|게시됨/);
    });

    it('구간 및 스테이지 연결 패널(Stage Bindings Panel) HTML이 렌더링된다', () => {
      const html = layout.renderStageBindingsPanelHTML();
      expect(html).toContain('stage-bindings-panel');
      expect(html).toContain('ch1');
      expect(html).toContain('seq_phaseA_star');
      expect(html).toContain('btn-add-binding');
    });

    it('미지원 장판(Hazard) 및 피버 구간에 잠금(Lock) 배지가 표시된다', () => {
      const html = layout.renderStageBindingsPanelHTML();
      expect(html).toMatch(/잠금|미지원|lock/i);
      expect(html).toMatch(/장판|Hazard/i);
    });

    it('상단 헤더에 새 프로젝트 및 프로젝트 복제, 바인딩 관리 버튼이 포함된다', () => {
      const headerHtml = layout.renderHeaderHTML();
      expect(headerHtml).toContain('btn-new-project');
      expect(headerHtml).toContain('btn-clone-project');
      expect(headerHtml).toContain('btn-manage-bindings');
    });
  });
});
