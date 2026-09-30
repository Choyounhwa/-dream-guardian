import { describe, it, expect, beforeEach } from 'vitest';
import { PhaseSequenceEditor } from '../../src/editor/PhaseSequenceEditor.js';

describe('PhaseSequenceEditor - 4대 페이즈별 타임라인 시퀀스 데이터 편집기 (Phase 3)', () => {
  let editor: PhaseSequenceEditor;

  beforeEach(() => {
    editor = new PhaseSequenceEditor();
  });

  describe('1. 4대 페이즈별 기본 시퀀스 로드', () => {
    it('RUN_QUESTION 페이즈는 8개의 바운스 모션 노트를 제공한다', () => {
      const notes = editor.getNotesForPhase('RUN_QUESTION');
      expect(notes.length).toBe(8);
      expect(notes[0].startBeat).toBe(1);
      expect(notes[7].startBeat).toBe(8);
      // 홀수는 rebound, 짝수는 dip
      expect(notes[1].label).toContain('dip');
    });

    it('ANSWER_SELECT 페이즈는 2개의 선택지(Zone 4, Zone 5)를 제공한다', () => {
      const notes = editor.getNotesForPhase('ANSWER_SELECT');
      expect(notes.length).toBe(2);
      expect(notes[0].targetZones).toContain(4);
      expect(notes[1].targetZones).toContain(5);
    });

    it('STAR_COLLECT 페이즈는 7개의 별모으기 키노트 노트를 제공한다', () => {
      const notes = editor.getNotesForPhase('STAR_COLLECT');
      expect(notes.length).toBe(7);
      expect(notes.some((n) => n.label.includes('스카이포인트'))).toBe(true);
    });

    it('FEVER_PHASE_B 페이즈는 4개의 16박 순환 안무 블록(각 4박)을 제공한다', () => {
      const notes = editor.getNotesForPhase('FEVER_PHASE_B');
      expect(notes.length).toBe(4);
      expect(notes[0].startBeat).toBe(1);
      expect(notes[0].durationBeats).toBe(4);
      expect(notes[3].startBeat).toBe(13);
      expect(notes[3].durationBeats).toBe(4);
    });
  });

  describe('2. 시퀀스 노트 추가, 수정, 삭제', () => {
    it('특정 페이즈에 신규 노트를 추가할 수 있다', () => {
      const added = editor.addNote('RUN_QUESTION', {
        id: 'CUSTOM_NOTE_1',
        lane: 'motion',
        startBeat: 4.5,
        durationBeats: 0.5,
        label: '반박 바운스',
        color: '#28E6FF',
        targetZones: [10],
      });
      expect(added).toBe(true);
      const notes = editor.getNotesForPhase('RUN_QUESTION');
      expect(notes.some((n) => n.id === 'CUSTOM_NOTE_1')).toBe(true);
    });

    it('기존 노트의 비트 위치나 타깃 존을 수정할 수 있다', () => {
      const notes = editor.getNotesForPhase('STAR_COLLECT');
      const targetId = notes[0].id;

      const updated = editor.updateNote('STAR_COLLECT', targetId, {
        startBeat: 2.5,
        targetZones: [8],
      });
      expect(updated).toBe(true);

      const modified = editor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === targetId);
      expect(modified?.startBeat).toBe(2.5);
      expect(modified?.targetZones).toEqual([8]);
    });

    it('노트를 삭제할 수 있다', () => {
      const initialCount = editor.getNotesForPhase('STAR_COLLECT').length;
      const targetId = editor.getNotesForPhase('STAR_COLLECT')[0].id;

      const removed = editor.removeNote('STAR_COLLECT', targetId);
      expect(removed).toBe(true);
      expect(editor.getNotesForPhase('STAR_COLLECT').length).toBe(initialCount - 1);
    });

    it('resetPhase() 호출 시 기본 시퀀스로 복원된다', () => {
      const targetId = editor.getNotesForPhase('RUN_QUESTION')[0].id;
      editor.removeNote('RUN_QUESTION', targetId);
      expect(editor.getNotesForPhase('RUN_QUESTION').length).toBe(7);

      editor.resetPhase('RUN_QUESTION');
      expect(editor.getNotesForPhase('RUN_QUESTION').length).toBe(8);
    });
  });

  describe('3. JSON 직렬화 및 역직렬화 (Import / Export)', () => {
    it('페이즈 시퀀스를 JSON으로 내보내고 다시 불러올 수 있다', () => {
      const json = editor.exportPhaseJSON('STAR_COLLECT');
      expect(json).toContain('STAR_COLLECT');

      const restoredEditor = new PhaseSequenceEditor();
      const success = restoredEditor.importPhaseJSON('STAR_COLLECT', json);
      expect(success).toBe(true);
      expect(restoredEditor.getNotesForPhase('STAR_COLLECT').length).toBe(7);
    });
  });
});
