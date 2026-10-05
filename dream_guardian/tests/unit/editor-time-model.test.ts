/**
 * editor-time-model.test.ts
 *
 * [Issue #382 / EDITOR-TIME-MODEL]
 * 기존 #243 후속 에디터 내부 시간·길이·자세 탐색 계약 정합화 테스트
 *
 * 1. STAR_COLLECT 분기 길이 8박과 노트 수 7의 명확한 분리
 * 2. 8박 끝단 및 마지막 7번째 노트(startBeat: 8) 정상 Seek 탐색 검증
 * 3. 1-based 표시 박자 ↔ 0-based 상대 틱(480 ticks/beat) ↔ 오디오 비트 양방향 정합성
 * 4. PhaseSequenceEditor 1..8박 범위 노트 추가/수정 시 8박 노트 유지 및 비절단 검증
 * 5. ChoreoPoseSimulator 실시간 포즈 계산과 각 박자(시작/중간/7..8박 착지/8박 초과 클램핑) 일치 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { PhaseSequenceEditor, type TimelineTrackNote } from '../../src/editor/PhaseSequenceEditor.js';
import { ChoreoPoseSimulator } from '../../src/editor/ChoreoPoseSimulator.js';
import { DancePatternRegistry, EXTENDED_CAT_CHOREO_PATTERNS } from '../../src/data/danceRoutineData.js';

describe('EDITOR-TIME-MODEL (#382): 에디터 시간·길이·자세 탐색 계약 정합화', () => {
  let state: EditorState;
  let sequenceEditor: PhaseSequenceEditor;
  let simulator: ChoreoPoseSimulator;
  let registry: DancePatternRegistry;

  beforeEach(() => {
    registry = new DancePatternRegistry(EXTENDED_CAT_CHOREO_PATTERNS);
    sequenceEditor = new PhaseSequenceEditor();
    state = new EditorState(registry, sequenceEditor);
    simulator = new ChoreoPoseSimulator();
  });

  describe('1. STAR_COLLECT 노트 수(7)와 분기 길이(8박) 분리 및 Seek 탐색', () => {
    it('STAR_COLLECT의 루틴 beats는 분기 전체 길이인 8이어야 하고, noteCount는 7이어야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      const routine = state.getCurrentPhaseRoutine();

      // #382 핵심 계약: 7이 아닌 8박 분기 길이
      expect(routine.beats).toBe(8);
      expect(routine.branchDuration).toBe(8);
      expect(routine.noteCount).toBe(7);

      const notes = state.getCurrentPhaseNotes();
      expect(notes).toHaveLength(7);
      expect(notes.map((n) => n.startBeat)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('seekBeat(8) 호출 시 7로 잘못 축소 클램핑되지 않고 8에 정상 안착해야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.seekBeat(8);

      // #243 결함 수정: 7이 아니라 8로 유지
      expect(state.currentBeat).toBe(8);

      state.seekBeat(7.5);
      expect(state.currentBeat).toBe(7.5);

      state.seekBeat(0);
      expect(state.currentBeat).toBe(0);

      // 8 초과 시에만 8로 클램핑
      state.seekBeat(9);
      expect(state.currentBeat).toBe(8);
    });

    it('페이즈 전환 시 currentBeat가 새 페이즈의 총 박수 이하이면 유지되고, 초과할 때만 클램핑되어야 한다', () => {
      state.setSelectedPhase('FEVER_PHASE_B');
      state.seekBeat(12);
      expect(state.currentBeat).toBe(12);

      // FEVER(16박) -> STAR_COLLECT(8박): 12는 8을 초과하므로 8로 클램핑
      state.setSelectedPhase('STAR_COLLECT');
      expect(state.currentBeat).toBe(8);

      // STAR_COLLECT(8박) -> RUN_QUESTION(8박): 8은 유지됨
      state.setSelectedPhase('RUN_QUESTION');
      expect(state.currentBeat).toBe(8);

      // RUN_QUESTION(8박) -> ANSWER_SELECT(2박): 8은 2를 초과하므로 2로 클램핑
      state.setSelectedPhase('ANSWER_SELECT');
      expect(state.currentBeat).toBe(2);
    });
  });

  describe('2. 1-based 표시 박자 ↔ 0-based 상대 틱(480 ticks/beat) ↔ 오디오 비트 정합성', () => {
    it('EditorState의 beatToTick 및 tickToBeat 변환이 정확해야 한다', () => {
      // 1-based 시작 박자 -> 0-based 틱
      expect(state.beatToTick(1.0)).toBe(0);
      expect(state.beatToTick(2.0)).toBe(480);
      expect(state.beatToTick(5.5)).toBe(2160);
      expect(state.beatToTick(8.0)).toBe(3360);
      expect(state.beatToTick(9.0)).toBe(3840);

      // 0-based 틱 -> 1-based 시작 박자
      expect(state.tickToBeat(0)).toBe(1.0);
      expect(state.tickToBeat(480)).toBe(2.0);
      expect(state.tickToBeat(2160)).toBe(5.5);
      expect(state.tickToBeat(3360)).toBe(8.0);
      expect(state.tickToBeat(3840)).toBe(9.0);
    });

    it('오디오 비트(0-based)와 표시 박자(1-based) 및 틱 변환이 양방향 일치해야 한다', () => {
      // displayBeat <-> audioBeat
      expect(state.displayBeatToAudioBeat(1.0)).toBe(0);
      expect(state.displayBeatToAudioBeat(8.0)).toBe(7.0);
      expect(state.audioBeatToDisplayBeat(0)).toBe(1.0);
      expect(state.audioBeatToDisplayBeat(7.0)).toBe(8.0);

      // audioBeat <-> tick
      expect(state.audioBeatToTick(0)).toBe(0);
      expect(state.audioBeatToTick(1.0)).toBe(480);
      expect(state.audioBeatToTick(7.0)).toBe(3360);
      expect(state.tickToAudioBeat(0)).toBe(0);
      expect(state.tickToAudioBeat(480)).toBe(1.0);
      expect(state.tickToAudioBeat(3360)).toBe(7.0);
    });

    it('getTimelineTotalBeats 및 getPhaseTotalBeats가 각 페이즈의 정규 길이를 반환해야 한다', () => {
      expect(state.getTimelineTotalBeats('RUN_QUESTION')).toBe(8);
      expect(state.getTimelineTotalBeats('ANSWER_SELECT')).toBe(2);
      expect(state.getTimelineTotalBeats('STAR_COLLECT')).toBe(8);
      expect(state.getTimelineTotalBeats('FEVER_PHASE_B')).toBe(16);

      expect(sequenceEditor.getPhaseTotalBeats('RUN_QUESTION')).toBe(8);
      expect(sequenceEditor.getPhaseTotalBeats('ANSWER_SELECT')).toBe(2);
      expect(sequenceEditor.getPhaseTotalBeats('STAR_COLLECT')).toBe(8);
      expect(sequenceEditor.getPhaseTotalBeats('FEVER_PHASE_B')).toBe(16);
    });
  });

  describe('3. PhaseSequenceEditor 1..8박 범위 노트 핸들링 및 8박 노트 유지', () => {
    it('1..8박 범위의 노트를 추가 및 수정할 때 8박 노트가 잘리거나 클램핑되지 않는다', () => {
      const customNote: TimelineTrackNote = {
        id: 'CUSTOM_BEAT_8',
        lane: 'keynote',
        startBeat: 8,
        durationBeats: 1,
        label: '8박 착지 테스트 노트',
        color: '#FFCB4D',
        targetZones: [3],
      };

      const added = sequenceEditor.addNote('STAR_COLLECT', customNote);
      expect(added).toBe(true);

      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const found = notes.find((n) => n.id === 'CUSTOM_BEAT_8');
      expect(found).toBeDefined();
      expect(found?.startBeat).toBe(8);
      expect(found?.durationBeats).toBe(1);

      // 업데이트 시에도 startBeat: 8 유지
      const updated = sequenceEditor.updateNote('STAR_COLLECT', 'CUSTOM_BEAT_8', {
        label: '8박 수정된 라벨',
      });
      expect(updated).toBe(true);
      const updatedNote = sequenceEditor.getNotesForPhase('STAR_COLLECT').find((n) => n.id === 'CUSTOM_BEAT_8');
      expect(updatedNote?.label).toBe('8박 수정된 라벨');
      expect(updatedNote?.startBeat).toBe(8);
    });
  });

  describe('4. ChoreoPoseSimulator 경계/중간/착지/8박 초과 자세 탐색 일치 검증', () => {
    it('STAR_COLLECT에서 beat 1.0 (리드인 버퍼 구간) 탐색 시 activeNote는 null이고 기본 패턴이 시뮬레이션되어야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.seekBeat(1.0);

      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: state.currentBeat,
        selectedPattern: state.getSelectedPattern()!,
        notes: state.getCurrentPhaseNotes(),
        registry,
      });

      expect(frame.currentBeat).toBe(1.0);
      expect(frame.activeNote).toBeNull();
      expect(frame.activePattern).toBeDefined();
    });

    it('STAR_COLLECT에서 beat 2.0 (첫 번째 별) 탐색 시 NOTE_S_1이 활성화되어야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.seekBeat(2.0);

      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: state.currentBeat,
        selectedPattern: state.getSelectedPattern()!,
        notes: state.getCurrentPhaseNotes(),
        registry,
      });

      expect(frame.currentBeat).toBe(2.0);
      expect(frame.activeNote).not.toBeNull();
      expect(frame.activeNote?.id).toBe('NOTE_S_1');
      expect(frame.activeNote?.startBeat).toBe(2);
      expect(frame.targetZones).toContain(10);
    });

    it('STAR_COLLECT에서 intermediate beat 5.0 (중간 별) 탐색 시 NOTE_S_4가 활성화되어야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.seekBeat(5.0);

      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: state.currentBeat,
        selectedPattern: state.getSelectedPattern()!,
        notes: state.getCurrentPhaseNotes(),
        registry,
      });

      expect(frame.currentBeat).toBe(5.0);
      expect(frame.activeNote?.id).toBe('NOTE_S_4');
      expect(frame.activeNote?.startBeat).toBe(5);
      expect(frame.targetZones).toContain(3);
    });

    it('STAR_COLLECT에서 beat 7.0 탐색 시 NOTE_S_6이 활성화되어야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.seekBeat(7.0);

      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: state.currentBeat,
        selectedPattern: state.getSelectedPattern()!,
        notes: state.getCurrentPhaseNotes(),
        registry,
      });

      expect(frame.currentBeat).toBe(7.0);
      expect(frame.activeNote?.id).toBe('NOTE_S_6');
      expect(frame.activeNote?.startBeat).toBe(7);
      expect(frame.targetZones).toContain(10);
    });

    it('STAR_COLLECT에서 beat 8.0 (마지막 일곱 번째 별 착지) 탐색 시 NOTE_S_7이 활성화되어야 한다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.seekBeat(8.0);

      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: state.currentBeat,
        selectedPattern: state.getSelectedPattern()!,
        notes: state.getCurrentPhaseNotes(),
        registry,
      });

      expect(frame.currentBeat).toBe(8.0);
      expect(frame.activeNote).not.toBeNull();
      expect(frame.activeNote?.id).toBe('NOTE_S_7');
      expect(frame.activeNote?.startBeat).toBe(8);
      expect(frame.targetZones).toContain(3);
    });

    it('STAR_COLLECT에서 8박 초과 (beat 8.5, 9.0) 탐색 시 마지막 노트(NOTE_S_7)로 클램핑 유지되어야 한다', () => {
      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');

      const frame85 = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: 8.5,
        selectedPattern: registry.get('CAT_LOW_BOUNCE'),
        notes,
        registry,
      });
      expect(frame85.activeNote?.id).toBe('NOTE_S_7');

      const frame9 = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: 9.0,
        selectedPattern: registry.get('CAT_LOW_BOUNCE'),
        notes,
        registry,
      });
      // 9.0에서도 NOTE_S_1로 되돌아가지 않고 마지막 노트(NOTE_S_7)에 고정
      expect(frame9.activeNote?.id).toBe('NOTE_S_7');
      expect(frame9.targetZones).toContain(3);
    });
  });
});
