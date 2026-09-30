import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';

describe('EditorState - 피트니스 안무 및 타임라인 에디터 상태 관리 (Phase 1)', () => {
  let state: EditorState;

  beforeEach(() => {
    state = new EditorState();
  });

  describe('1. 초기 상태 기본값 검증', () => {
    it('기본 BPM은 95로 설정된다', () => {
      expect(state.bpm).toBe(95);
    });

    it('기본 선택 패턴은 CAT_LOW_BOUNCE 이다', () => {
      expect(state.selectedPatternId).toBe('CAT_LOW_BOUNCE');
      const pattern = state.getSelectedPattern();
      expect(pattern).not.toBeNull();
      expect(pattern?.id).toBe('CAT_LOW_BOUNCE');
    });

    it('기본 선택 페이즈는 RUN_QUESTION 이다', () => {
      expect(state.selectedPhase).toBe('RUN_QUESTION');
      const routine = state.getCurrentPhaseRoutine();
      expect(routine.phase).toBe('RUN_QUESTION');
      expect(routine.beats).toBe(8);
    });

    it('초기 재생 상태는 정지(isPlaying = false), 재생 비트는 0이다', () => {
      expect(state.isPlaying).toBe(false);
      expect(state.currentBeat).toBe(0);
    });

    it('초기 등록된 4대 기본 안무 패턴 목록을 모두 반환한다', () => {
      const patterns = state.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(4);
      const ids = patterns.map((p) => p.id);
      expect(ids).toContain('CAT_LOW_BOUNCE');
      expect(ids).toContain('CAT_SKY_POINT_RIGHT');
      expect(ids).toContain('CAT_CENTER_CLASP');
      expect(ids).toContain('CAT_SKY_POINT_LEFT');
    });
  });

  describe('2. 패턴 선택 및 수정, 유효성 검증', () => {
    it('다른 패턴 ID를 선택할 수 있다', () => {
      state.setSelectedPattern('CAT_SKY_POINT_RIGHT');
      expect(state.selectedPatternId).toBe('CAT_SKY_POINT_RIGHT');
      expect(state.getSelectedPattern()?.name).toContain('우측 스카이포인트');
    });

    it('존재하지 않는 패턴 ID 선택 시 false를 반환하고 기존 선택을 유지한다', () => {
      const result = state.setSelectedPattern('NON_EXISTENT');
      expect(result).toBe(false);
      expect(state.selectedPatternId).toBe('CAT_LOW_BOUNCE');
    });

    it('현재 패턴의 부위별 피트니스 존을 수정하고 유효성을 판정한다', () => {
      const result = state.updateCurrentPattern({
        leftHand: 4,
        rightHand: 5,
      });
      expect(result.valid).toBe(true);
      const updated = state.getSelectedPattern();
      expect(updated?.leftHand).toBe(4);
      expect(updated?.rightHand).toBe(5);
    });

    it('물리 제약(Cross-Body 위반: 골반 하단 10 + 왼손 상단 1) 시 유효성 검증 에러를 반환한다', () => {
      const result = state.updateCurrentPattern({
        hip: 10,
        leftHand: 1, // 골반 10일 때 손 1은 Cross-Body 위반
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Cross-Body');
    });

    it('새로운 패턴을 생성하고 등록할 수 있다', () => {
      const result = state.createNewPattern({
        id: 'CAT_CUSTOM_DANCE',
        name: '커스텀 댄스',
        description: '테스트용 커스텀 안무',
        motionType: 'center_clasp',
        leftHand: 4,
        rightHand: 5,
        head: 4,
        hip: 8,
        footZones: [10],
      });
      expect(result.valid).toBe(true);
      expect(state.selectedPatternId).toBe('CAT_CUSTOM_DANCE');
      expect(state.getSelectedPattern()?.id).toBe('CAT_CUSTOM_DANCE');
    });

    it('중복 ID로 새 패턴 생성 시 에러를 반환한다', () => {
      const result = state.createNewPattern({
        id: 'CAT_LOW_BOUNCE', // 중복 ID
        name: '중복 패턴',
        description: '',
        motionType: 'low_bounce',
        leftHand: 6,
        rightHand: 8,
        head: null,
        hip: 10,
        footZones: [9, 11],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('이미 존재');
    });
  });

  describe('3. BPM 및 페이즈 변경, 재생/정지 제어', () => {
    it('BPM을 설정하고 40~240 범위로 클램핑한다', () => {
      state.setBpm(120);
      expect(state.bpm).toBe(120);

      state.setBpm(20);
      expect(state.bpm).toBe(40);

      state.setBpm(300);
      expect(state.bpm).toBe(240);
    });

    it('페이즈를 변경하면 해당 페이즈의 루틴 정보가 반환된다', () => {
      state.setSelectedPhase('FEVER_PHASE_B');
      expect(state.selectedPhase).toBe('FEVER_PHASE_B');
      const routine = state.getCurrentPhaseRoutine();
      expect(routine.phase).toBe('FEVER_PHASE_B');
      expect(routine.beats).toBe(16);
    });

    it('재생/정지(play, pause, togglePlay)를 올바르게 제어한다', () => {
      state.play();
      expect(state.isPlaying).toBe(true);

      state.pause();
      expect(state.isPlaying).toBe(false);

      state.togglePlay();
      expect(state.isPlaying).toBe(true);
      state.togglePlay();
      expect(state.isPlaying).toBe(false);
    });

    it('비트 탐색(seekBeat) 시 0 이상, 페이즈 최대 비트 이하로 클램핑된다', () => {
      state.setSelectedPhase('RUN_QUESTION'); // 8 beats
      state.seekBeat(4.5);
      expect(state.currentBeat).toBe(4.5);

      state.seekBeat(-2);
      expect(state.currentBeat).toBe(0);

      state.seekBeat(15);
      expect(state.currentBeat).toBe(8);
    });
  });

  describe('4. 리스너 알림 콜백 (Reactive Events)', () => {
    it('상태 변경 시 리스너가 호출된다', () => {
      const listener = {
        onStateChange: vi.fn(),
        onPatternChange: vi.fn(),
        onPhaseChange: vi.fn(),
        onPlayStateChange: vi.fn(),
        onBeatUpdate: vi.fn(),
      };

      state.addListener(listener);

      state.setSelectedPattern('CAT_SKY_POINT_LEFT');
      expect(listener.onPatternChange).toHaveBeenCalled();
      expect(listener.onStateChange).toHaveBeenCalled();

      state.setSelectedPhase('STAR_COLLECT');
      expect(listener.onPhaseChange).toHaveBeenCalledWith('STAR_COLLECT');

      state.play();
      expect(listener.onPlayStateChange).toHaveBeenCalledWith(true);

      state.seekBeat(3);
      expect(listener.onBeatUpdate).toHaveBeenCalledWith(3);

      state.removeListener(listener);
      state.pause();
      expect(listener.onPlayStateChange).toHaveBeenCalledTimes(1);
    });
  });
});
