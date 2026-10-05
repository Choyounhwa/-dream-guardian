import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProjectCommandManager,
  AddPatternCommand,
  type CommandSuccessResult,
  type CommandFailureResult,
} from '../../src/editor/ProjectCommands.js';
import {
  createEmptyEditorProject,
  validateEditorProject,
} from '../../src/data/ProjectValidator.js';
import type {
  EditorProject,
  EditorPattern,
  MotionCueEvent,
  EditorSequence,
} from '../../src/data/EditorProject.js';
import { EditorState } from '../../src/editor/EditorState.js';

describe('ProjectCommands & ProjectCommandManager (Issue #380 / EDITOR-COMMAND)', () => {
  let project: EditorProject;
  let manager: ProjectCommandManager;

  const samplePatternA: EditorPattern = {
    id: 'PAT_A',
    name: 'Pattern A',
    target: { leftHand: 4, rightHand: 5, head: 4, hip: 6 },
    description: 'Sample Pattern A',
  };

  const samplePatternB: EditorPattern = {
    id: 'PAT_B',
    name: 'Pattern B',
    target: { leftHand: 2, rightHand: 3, head: null, hip: 10 },
  };

  beforeEach(() => {
    project = createEmptyEditorProject({
      projectId: 'test_project_cmd',
      title: 'Command Test Project',
      bpm: 120,
    });
    // Add initial sequences to project
    const motionSeq: EditorSequence = {
      id: 'seq_phaseA_motion',
      phase: 'phaseA',
      kind: 'motionGuide',
      events: [],
    };
    const starSeq: EditorSequence = {
      id: 'seq_phaseA_star',
      phase: 'phaseA',
      kind: 'starNotes',
      events: [],
    };
    project.sequences = [motionSeq, starSeq];

    manager = new ProjectCommandManager(project);
  });

  describe('1. 명령 실행, revision 증가 및 문서 알림', () => {
    it('AddPatternCommand 성공 시 revision이 +1 되고 onDocumentChange가 호출된다', () => {
      const listener = vi.fn();
      manager.addListener(listener);

      const initialRev = manager.revision;
      const res = manager.executeCommand(new AddPatternCommand(samplePatternA));

      expect(res.success).toBe(true);
      expect((res as CommandSuccessResult).revision).toBe(initialRev + 1);
      expect(manager.revision).toBe(initialRev + 1);
      expect(manager.getDocument().patterns).toHaveLength(1);
      expect(manager.getDocument().patterns[0].id).toBe('PAT_A');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ revision: initialRev + 1 }));
    });

    it('updatePattern으로 패턴 속성을 수정하면 revision이 +1 되고 알림이 발행된다', () => {
      manager.executeCommand(new AddPatternCommand(samplePatternA));
      const revBefore = manager.revision;

      const res = manager.updatePattern('PAT_A', {
        name: 'Pattern A Updated',
        target: { leftHand: 5, rightHand: 4, head: 5, hip: 6 },
      });

      expect(res.success).toBe(true);
      expect((res as CommandSuccessResult).revision).toBe(revBefore + 1);
      const updated = manager.getDocument().patterns.find((p) => p.id === 'PAT_A');
      expect(updated?.name).toBe('Pattern A Updated');
      expect(updated?.target.leftHand).toBe(5);
    });

    it('일반 수정 명령으로 pattern ID를 변경하려고 하면 거부된다 (ID 불변)', () => {
      manager.executeCommand(new AddPatternCommand(samplePatternA));
      const revBefore = manager.revision;
      const docBefore = manager.getDocument();

      // Attempt to change ID through updatePattern
      const res = manager.updatePattern('PAT_A', {
        id: 'PAT_RENAMED',
        name: 'Attempted Rename',
      } as any);

      expect(res.success).toBe(false);
      expect((res as CommandFailureResult).code).toBe('ID_IMMUTABLE');
      expect(manager.revision).toBe(revBefore);
      expect(manager.getDocument()).toEqual(docBefore);
    });
  });

  describe('2. 실패 원자성 및 expectedRevision 일치 검증', () => {
    it('expectedRevision이 현재 revision과 불일치하면 실행 거부되고 상태/Undo 변경이 0이다', () => {
      manager.executeCommand(new AddPatternCommand(samplePatternA));
      const currentRev = manager.revision;
      const docSnapshot = manager.getDocument();

      const listener = vi.fn();
      manager.addListener(listener);

      // Pass expectedRevision = 999 (mismatch)
      const res = manager.executeCommand(
        new AddPatternCommand(samplePatternB, { expectedRevision: 999 })
      );

      expect(res.success).toBe(false);
      expect((res as CommandFailureResult).code).toBe('REVISION_MISMATCH');
      expect(manager.revision).toBe(currentRev);
      expect(manager.getDocument()).toEqual(docSnapshot);
      expect(manager.canRedo()).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });

    it('유효하지 않은 데이터(허용 범위를 벗어난 존)로 후보 검증 실패 시 문서/Undo 변경이 0이다', () => {
      const revBefore = manager.revision;
      const invalidPattern: EditorPattern = {
        id: 'PAT_INVALID',
        name: 'Invalid Pattern',
        // Valid zones are 1..11. Zone 99 is invalid!
        target: { head: 99 as any },
      };

      const res = manager.addPattern(invalidPattern);

      expect(res.success).toBe(false);
      expect((res as CommandFailureResult).code).toBe('VALIDATION_FAILED');
      expect(manager.revision).toBe(revBefore);
      expect(manager.getDocument().patterns).toHaveLength(0);
      expect(manager.canUndo()).toBe(false);
    });

    it('중복 ID 추가 시 원자적으로 실패한다', () => {
      manager.addPattern(samplePatternA);
      const revBefore = manager.revision;

      const dupRes = manager.addPattern(samplePatternA);

      expect(dupRes.success).toBe(false);
      expect(manager.revision).toBe(revBefore);
      expect(manager.getDocument().patterns).toHaveLength(1);
    });
  });

  describe('3. 참조 안전 삭제 (Reference-safe deletePattern)', () => {
    beforeEach(() => {
      manager.addPattern(samplePatternA);
      manager.addPattern(samplePatternB);
      // Add event referencing PAT_A
      const eventWithRef: MotionCueEvent = {
        id: 'cue_1',
        kind: 'motionCue',
        startTick: 0,
        durationTicks: 480,
        sourcePatternId: 'PAT_A',
      };
      manager.addEvent('seq_phaseA_motion', eventWithRef);
    });

    it('시퀀스 이벤트에서 sourcePatternId로 참조 중인 패턴 삭제 시 cascade=false면 기본 차단된다', () => {
      const revBefore = manager.revision;
      const docBefore = manager.getDocument();

      const res = manager.deletePattern('PAT_A'); // cascade defaults to false

      expect(res.success).toBe(false);
      expect((res as CommandFailureResult).code).toBe('PATTERN_REFERENCED');
      expect(manager.revision).toBe(revBefore);
      expect(manager.getDocument()).toEqual(docBefore);
    });

    it('cascade=true 지정 시 참조 패턴 및 종속 참조가 정리되며 결과 문서는 유효하다', () => {
      const res = manager.deletePattern('PAT_A', { cascade: true });

      expect(res.success).toBe(true);
      const doc = manager.getDocument();
      expect(doc.patterns.find((p) => p.id === 'PAT_A')).toBeUndefined();
      // seq_phaseA_motion should no longer have the referencing event
      const seq = doc.sequences.find((s) => s.id === 'seq_phaseA_motion');
      expect(seq?.events).toHaveLength(0);

      // Entire document must still pass validateEditorProject
      const validation = validateEditorProject(doc);
      expect(validation.valid).toBe(true);
    });

    it('참조되지 않은 패턴은 cascade=false라도 정상 삭제된다', () => {
      const res = manager.deletePattern('PAT_B');
      expect(res.success).toBe(true);
      expect(manager.getDocument().patterns.find((p) => p.id === 'PAT_B')).toBeUndefined();
    });
  });

  describe('4. 패턴 복제 (DuplicatePatternCommand)', () => {
    it('duplicatePattern은 고유한 새 ID를 자동 생성하여 패턴을 복제한다', () => {
      manager.addPattern(samplePatternA);
      const res = manager.duplicatePattern('PAT_A');

      expect(res.success).toBe(true);
      const doc = manager.getDocument();
      expect(doc.patterns).toHaveLength(2);
      const copyPat = doc.patterns.find((p) => p.id === 'PAT_A_COPY');
      expect(copyPat).toBeDefined();
      expect(copyPat?.target).toEqual(samplePatternA.target);
    });

    it('지정한 newId가 이미 존재하면 복제가 원자적으로 실패한다', () => {
      manager.addPattern(samplePatternA);
      manager.addPattern(samplePatternB);
      const revBefore = manager.revision;

      const res = manager.duplicatePattern('PAT_A', { newId: 'PAT_B' });

      expect(res.success).toBe(false);
      expect(manager.revision).toBe(revBefore);
    });
  });

  describe('5. 이벤트 명령 (AddEvent, UpdateEvent, DeleteEvent)', () => {
    it('시퀀스에 유효한 이벤트를 추가/수정/삭제할 수 있다', () => {
      const cue: MotionCueEvent = {
        id: 'cue_101',
        kind: 'motionCue',
        startTick: 480,
        durationTicks: 480,
        target: { leftHand: 4 },
      };

      // Add
      const addRes = manager.addEvent('seq_phaseA_motion', cue);
      expect(addRes.success).toBe(true);
      let seq = manager.getDocument().sequences.find((s) => s.id === 'seq_phaseA_motion');
      expect(seq?.events).toHaveLength(1);

      // Update
      const updateRes = manager.updateEvent('seq_phaseA_motion', 'cue_101', {
        durationTicks: 960,
      });
      expect(updateRes.success).toBe(true);
      seq = manager.getDocument().sequences.find((s) => s.id === 'seq_phaseA_motion');
      expect((seq?.events[0] as MotionCueEvent).durationTicks).toBe(960);

      // Update ID change rejection
      const invalidUpdate = manager.updateEvent('seq_phaseA_motion', 'cue_101', {
        id: 'cue_RENAMED',
      } as any);
      expect(invalidUpdate.success).toBe(false);
      expect((invalidUpdate as CommandFailureResult).code).toBe('ID_IMMUTABLE');

      // Delete
      const delRes = manager.deleteEvent('seq_phaseA_motion', 'cue_101');
      expect(delRes.success).toBe(true);
      seq = manager.getDocument().sequences.find((s) => s.id === 'seq_phaseA_motion');
      expect(seq?.events).toHaveLength(0);
    });
  });

  describe('6. 템플릿 복사 배치 적용 및 1-Step Undo 복원', () => {
    it('applyTemplate으로 지정 범위/전체 이벤트를 일괄 적용하고 단 1회의 Undo로 완전 복원된다', () => {
      // 1. Initial event in sequence
      manager.addEvent('seq_phaseA_motion', {
        id: 'initial_cue',
        kind: 'motionCue',
        startTick: 0,
        durationTicks: 480,
        target: { leftHand: 4 },
      });
      const initialDocSnapshot = manager.getDocument();

      // 2. Batch template of 3 events
      const templateEvents: MotionCueEvent[] = [
        { id: 'tpl_1', kind: 'motionCue', startTick: 0, durationTicks: 480, target: { head: 4 } },
        { id: 'tpl_2', kind: 'motionCue', startTick: 480, durationTicks: 480, target: { hip: 6 } },
        { id: 'tpl_3', kind: 'motionCue', startTick: 960, durationTicks: 480, target: { rightHand: 5 } },
      ];

      const applyRes = manager.applyTemplate({
        sequenceId: 'seq_phaseA_motion',
        events: templateEvents,
      });
      expect(applyRes.success).toBe(true);

      const seqAfter = manager.getDocument().sequences.find((s) => s.id === 'seq_phaseA_motion');
      expect(seqAfter?.events).toHaveLength(3);

      // 3. 1-Step Undo
      expect(manager.canUndo()).toBe(true);
      const undoRes = manager.undo();
      expect(undoRes.success).toBe(true);

      const seqRestored = manager.getDocument().sequences.find((s) => s.id === 'seq_phaseA_motion');
      expect(seqRestored?.events).toHaveLength(1);
      expect((seqRestored?.events[0] as MotionCueEvent).id).toBe('initial_cue');
      // Content matches initial snapshot (except revision is incremented)
      expect(seqRestored).toEqual(initialDocSnapshot.sequences.find((s) => s.id === 'seq_phaseA_motion'));
    });
  });

  describe('7. Undo / Redo 새 revision 부여 및 원자적 복원', () => {
    it('Undo와 Redo 실행 시 새 revision 번호가 부여되어 stale 저장 요청과 구별된다', () => {
      // rev 0 -> 1
      manager.addPattern(samplePatternA);
      expect(manager.revision).toBe(1);

      // rev 1 -> 2
      manager.addPattern(samplePatternB);
      expect(manager.revision).toBe(2);

      // Undo: restores state before PAT_B, but revision becomes 3!
      const undoRes = manager.undo();
      expect(undoRes.success).toBe(true);
      expect((undoRes as CommandSuccessResult).revision).toBe(3);
      expect(manager.revision).toBe(3);
      expect(manager.getDocument().patterns).toHaveLength(1);
      expect(manager.getDocument().patterns[0].id).toBe('PAT_A');

      // Redo: restores state with PAT_B, but revision becomes 4!
      const redoRes = manager.redo();
      expect(redoRes.success).toBe(true);
      expect((redoRes as CommandSuccessResult).revision).toBe(4);
      expect(manager.revision).toBe(4);
      expect(manager.getDocument().patterns).toHaveLength(2);
    });

    it('빈 스택에서 Undo/Redo 호출 시 실패한다', () => {
      expect(manager.canUndo()).toBe(false);
      expect(manager.undo().success).toBe(false);

      expect(manager.canRedo()).toBe(false);
      expect(manager.redo().success).toBe(false);
    });
  });

  describe('8. 불변 조회 및 객체 Alias 차단 (Deep Immutability)', () => {
    it('getDocument()로 반환된 객체의 내부 속성을 외부에서 변조해도 내부 문서는 오염되지 않는다', () => {
      manager.addPattern(samplePatternA);
      const exposedDoc = manager.getDocument();

      // Malicious external mutation
      exposedDoc.patterns[0].name = 'HACKED_NAME';
      exposedDoc.patterns[0].target.leftHand = 99 as any;
      exposedDoc.sequences.push({
        id: 'hacked_seq',
        phase: 'phaseA',
        kind: 'hazard',
        events: [],
      });

      // Internal document must remain pristine
      const freshDoc = manager.getDocument();
      expect(freshDoc.patterns[0].name).toBe('Pattern A');
      expect(freshDoc.patterns[0].target.leftHand).toBe(4);
      expect(freshDoc.sequences.some((s) => s.id === 'hacked_seq')).toBe(false);
    });

    it('addPattern에 전달된 원본 객체를 외부에서 사후 변조해도 내부 문서는 영향을 받지 않는다', () => {
      const inputPattern: EditorPattern = {
        id: 'PAT_MUTATE',
        name: 'Original Name',
        target: { head: 4 },
      };

      manager.addPattern(inputPattern);

      // External mutation after adding
      inputPattern.name = 'TAMPERED';
      inputPattern.target.head = 5;

      const stored = manager.getDocument().patterns.find((p) => p.id === 'PAT_MUTATE');
      expect(stored?.name).toBe('Original Name');
      expect(stored?.target.head).toBe(4);
    });
  });

  describe('9. EditorState 및 PhaseSequenceEditor 연동과 시퀀스 불변성', () => {
    let state: EditorState;

    beforeEach(() => {
      state = new EditorState();
    });

    it('EditorState는 commandManager를 제공한다', () => {
      expect(state.commandManager).toBeDefined();
      expect(state.commandManager).toBeInstanceOf(ProjectCommandManager);
    });

    it('패턴 이름이나 메타데이터를 수정해도 시퀀스 트랙 데이터가 변조되지 않는다', () => {
      // 1. 시퀀스 노트 수정
      const targetNoteId = state.sequenceEditor.getNotesForPhase('STAR_COLLECT')[0].id;
      state.sequenceEditor.updateNote('STAR_COLLECT', targetNoteId, {
        startBeat: 2.5,
        label: 'CUSTOM_LABEL',
      });

      // 2. 패턴 이름 수정
      state.updateCurrentPattern({ name: 'RENAME_TEST' });

      // 3. 시퀀스 노트 유지 검증
      const note = state.sequenceEditor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === targetNoteId);
      expect(note?.label).toBe('CUSTOM_LABEL');
      expect(note?.startBeat).toBe(2.5);
    });

    it('EditorState.updateCurrentPattern은 ID 변경 시도를 거부한다', () => {
      const res = state.updateCurrentPattern({ id: 'CHANGED_ID' } as any);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('ID'))).toBe(true);
    });

    it('PhaseSequenceEditor.getNotesForPhase는 외부에서 payload를 변조해도 내부 상태를 보존한다', () => {
      const notes = state.sequenceEditor.getNotesForPhase('RUN_QUESTION');
      const firstNote = notes[0];
      if (firstNote.payload) {
        firstNote.payload.action = 'HACKED_ACTION';
      }

      const freshNotes = state.sequenceEditor.getNotesForPhase('RUN_QUESTION');
      expect(freshNotes[0].payload?.action).not.toBe('HACKED_ACTION');
    });
  });
});
