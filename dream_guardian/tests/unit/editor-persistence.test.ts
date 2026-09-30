import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorIOHandler } from '../../src/editor/EditorIOHandler.js';

describe('EditorPersistence - 패턴 선택 및 프로젝트 복원 시 편집 시퀀스 보존 (#245 / BUG-DANCE-PERSIST-001)', () => {
  let state: EditorState;
  let ioHandler: EditorIOHandler;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      }),
    };

    state = new EditorState();
    ioHandler = new EditorIOHandler(mockLocalStorage as unknown as Storage);
  });

  describe('1. 사용자 편집 시퀀스 보존 및 복원 (Roundtrip)', () => {
    it('STAR_COLLECT의 커스텀 수정된 노트(startBeat, label, targetZones)가 내보내기 및 새 EditorState 복원 후 100% 동일하게 유지된다', () => {
      // 1. STAR_COLLECT 첫 번째 노트 커스텀 편집
      const originalNotes = state.sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const targetNoteId = originalNotes[0].id; // NOTE_S_1

      const updated = state.sequenceEditor.updateNote('STAR_COLLECT', targetNoteId, {
        startBeat: 2.5,
        label: 'CUSTOM_EDIT_LABEL',
        targetZones: [8],
      });
      expect(updated).toBe(true);

      // 편집 확인
      const editedNote = state.sequenceEditor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === targetNoteId);
      expect(editedNote?.startBeat).toBe(2.5);
      expect(editedNote?.label).toBe('CUSTOM_EDIT_LABEL');
      expect(editedNote?.targetZones).toEqual([8]);

      // 2. 전체 프로젝트 JSON 내보내기
      const jsonStr = ioHandler.exportFullProjectJSON(state);

      // 3. 새 EditorState에 복원
      const restoredState = new EditorState();
      const result = ioHandler.importFullProjectJSON(restoredState, jsonStr);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // 4. 복원된 상태에서 편집 내용이 그대로 보존되어 있어야 함 (기본 템플릿으로 덮어쓰여지지 않음)
      const restoredNotes = restoredState.sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const restoredTarget = restoredNotes.find((n) => n.id === targetNoteId);

      expect(restoredTarget).toBeDefined();
      expect(restoredTarget?.startBeat).toBe(2.5);
      expect(restoredTarget?.label).toBe('CUSTOM_EDIT_LABEL');
      expect(restoredTarget?.targetZones).toEqual([8]);
    });
  });

  describe('2. 패턴 단순 선택 및 이름 수정 시 시퀀스 불변 보장', () => {
    it('같은 패턴을 재선택하거나 다른 패턴을 선택해도 시퀀스 노트 내용이 초기화되지 않는다', () => {
      // 1. 시퀀스 노트 커스텀 수정
      const targetNoteId = state.sequenceEditor.getNotesForPhase('STAR_COLLECT')[0].id;
      state.sequenceEditor.updateNote('STAR_COLLECT', targetNoteId, {
        startBeat: 2.5,
        label: 'PRESERVED_NOTE',
        targetZones: [3],
      });

      // 2. 현재 선택된 패턴과 동일한 패턴 재선택
      state.setSelectedPattern(state.selectedPatternId);

      let noteAfterSameSelect = state.sequenceEditor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === targetNoteId);
      expect(noteAfterSameSelect?.startBeat).toBe(2.5);
      expect(noteAfterSameSelect?.label).toBe('PRESERVED_NOTE');
      expect(noteAfterSameSelect?.targetZones).toEqual([3]);

      // 3. 다른 패턴 선택
      state.setSelectedPattern('CAT_SKY_POINT_RIGHT');

      let noteAfterOtherSelect = state.sequenceEditor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === targetNoteId);
      expect(noteAfterOtherSelect?.startBeat).toBe(2.5);
      expect(noteAfterOtherSelect?.label).toBe('PRESERVED_NOTE');
      expect(noteAfterOtherSelect?.targetZones).toEqual([3]);
    });

    it('패턴의 이름이나 설명을 수정해도 시퀀스 노트 내용이 초기화되지 않는다', () => {
      // 1. 시퀀스 노트 커스텀 수정
      const targetNoteId = state.sequenceEditor.getNotesForPhase('STAR_COLLECT')[0].id;
      state.sequenceEditor.updateNote('STAR_COLLECT', targetNoteId, {
        startBeat: 2.5,
        label: 'DO_NOT_OVERWRITE',
        targetZones: [5],
      });

      // 2. 패턴 이름 및 설명 수정
      state.updateCurrentPattern({
        name: '수정된 패턴 이름',
        description: '수정된 패턴 설명',
      });

      // 3. 시퀀스 노트가 보존되는지 검증
      const noteAfterNameEdit = state.sequenceEditor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === targetNoteId);
      expect(noteAfterNameEdit?.startBeat).toBe(2.5);
      expect(noteAfterNameEdit?.label).toBe('DO_NOT_OVERWRITE');
      expect(noteAfterNameEdit?.targetZones).toEqual([5]);
    });

    it('명시적 패턴 적용(applyPatternToSequence)을 호출했을 때만 시퀀스가 해당 패턴으로 갱신된다', () => {
      // 1. 시퀀스 노트 커스텀 수정
      const targetNoteId = state.sequenceEditor.getNotesForPhase('STAR_COLLECT')[0].id;
      state.sequenceEditor.updateNote('STAR_COLLECT', targetNoteId, {
        startBeat: 2.5,
        label: 'CUSTOM_BEFORE_APPLY',
      });

      // 2. 명시적 적용 호출
      const applied = state.applyPatternToSequence('CAT_SKY_POINT_RIGHT');
      expect(applied).toBe(true);

      // 3. 명시적 적용 후에는 패턴에 맞게 갱신됨
      const notesAfterApply = state.sequenceEditor.getNotesForPhase('STAR_COLLECT');
      expect(notesAfterApply.some((n) => n.label.includes('스카이포인트'))).toBe(true);
    });
  });

  describe('3. 삭제된 패턴의 부활 방지 (프로젝트 열기 시 전체 교체)', () => {
    it('프로젝트에서 삭제된 패턴은 새 EditorState로 프로젝트 복원 시 부활하지 않는다', () => {
      // 1. 특정 패턴 확인 및 삭제 (CAT_WAVE_RIGHT 또는 특정 패턴)
      const patterns = state.getPatterns();
      const patternToDelete = patterns.find((p) => p.id !== state.selectedPatternId);
      expect(patternToDelete).toBeDefined();
      const deletedId = patternToDelete!.id;

      // 삭제
      const unregistered = state.registry.unregister(deletedId);
      expect(unregistered).toBe(true);
      expect(state.registry.has(deletedId)).toBe(false);

      // 2. 프로젝트 내보내기
      const jsonStr = ioHandler.exportFullProjectJSON(state);
      expect(jsonStr).not.toContain(`"id": "${deletedId}"`);

      // 3. 새 EditorState 생성 (기본 레지스트리에는 deletedId가 포함되어 있음)
      const freshState = new EditorState();
      expect(freshState.registry.has(deletedId)).toBe(true);

      // 4. 프로젝트 불러오기 -> 삭제된 패턴이 새 state에서도 없어야 함
      const res = ioHandler.importFullProjectJSON(freshState, jsonStr);
      expect(res.success).toBe(true);
      expect(freshState.registry.has(deletedId)).toBe(false);
    });
  });

  describe('4. 문서 변경과 재생 상태 분리 및 재생 중 자동저장 보장', () => {
    it('문서 변경(노트/패턴/BPM) 시 onDocumentChange가 발생하지만 seekBeat/재생 시에는 발생하지 않는다', () => {
      const onDocChange = vi.fn();
      state.addListener({ onDocumentChange: onDocChange });

      // 1. 재생 및 탐색 (재생 상태 변경) -> onDocumentChange 호출되지 않아야 함
      state.play();
      state.seekBeat(1.5);
      state.seekBeat(2.0);
      state.pause();
      expect(onDocChange).not.toHaveBeenCalled();

      // 2. 노트 수정 (문서 변경) -> onDocumentChange 호출되어야 함
      const noteId = state.sequenceEditor.getNotesForPhase('RUN_QUESTION')[0].id;
      state.sequenceEditor.updateNote('RUN_QUESTION', noteId, { label: 'DOC_EDIT' });
      expect(onDocChange).toHaveBeenCalledTimes(1);

      // 3. 패턴 속성 수정 (문서 변경) -> onDocumentChange 호출되어야 함
      state.updateCurrentPattern({ name: '새 이름 2' });
      expect(onDocChange).toHaveBeenCalledTimes(2);

      // 4. BPM 수정 (문서 변경) -> onDocumentChange 호출되어야 함
      state.setBpm(130);
      expect(onDocChange).toHaveBeenCalledTimes(3);
    });
  });
});
