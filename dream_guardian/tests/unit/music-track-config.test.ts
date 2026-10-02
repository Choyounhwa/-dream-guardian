import { describe, it, expect } from 'vitest';
import { RhythmEngine } from '../../src/core/RhythmEngine.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import {
  DEFAULT_LOOP_PATTERN,
  DEFAULT_TRACK_CONFIG,
  CHAPTER_TRACK_PRESETS,
  TRACK_TEMPLATES,
} from '../../config/beat-motion.config.js';
import type { MusicTrackConfig } from '../../src/types/index.js';

describe('MusicTrackConfig & Variable Beat Architecture (Issue #204 / BEAT-TRACK-001)', () => {
  describe('1. RhythmEngine 동적 BPM 및 가변 박자 설정 검증', () => {
    it('BPM 100~140 범위 변경 시 secondsPerBeat와 secondsPerRound가 즉시 정확히 재계산된다', () => {
      const engine = new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
      expect(engine.bpm).toBe(120);
      expect(engine.secondsPerBeat).toBeCloseTo(0.5, 5);
      expect(engine.secondsPerRound).toBeCloseTo(4.0, 5);

      // BPM 100
      engine.setBpm(100);
      expect(engine.bpm).toBe(100);
      expect(engine.secondsPerBeat).toBeCloseTo(0.6, 5);
      expect(engine.secondsPerRound).toBeCloseTo(4.8, 5);

      // BPM 135
      engine.setBpm(135);
      expect(engine.bpm).toBe(135);
      expect(engine.secondsPerBeat).toBeCloseTo(60 / 135, 5);
      expect(engine.secondsPerRound).toBeCloseTo((60 / 135) * 8, 5);

      // BPM 140
      engine.setBpm(140);
      expect(engine.bpm).toBe(140);
      expect(engine.secondsPerBeat).toBeCloseTo(60 / 140, 5);
      expect(engine.secondsPerRound).toBeCloseTo((60 / 140) * 8, 5);
    });

    it('setBeatsPerRound 호출 시 secondsPerRound가 즉시 재계산된다', () => {
      const engine = new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
      expect(engine.secondsPerRound).toBeCloseTo(4.0, 5);

      engine.setBeatsPerRound(4);
      expect(engine.beatsPerRound).toBe(4);
      expect(engine.secondsPerRound).toBeCloseTo(2.0, 5);

      engine.setBeatsPerRound(16);
      expect(engine.beatsPerRound).toBe(16);
      expect(engine.secondsPerRound).toBeCloseTo(8.0, 5);
    });

    it('생성자에 trackConfig 주입 시 bpm과 loopPattern.exerciseBeats가 자동 적용된다', () => {
      const customTrack: MusicTrackConfig = {
        id: 'track-custom',
        name: 'Custom Track',
        bpm: 100,
        timeSignature: [4, 4],
        intro: { countInBeats: 3, soundType: 'metronome' },
        loopPattern: { exerciseBeats: 6, readyBeats: 3, performanceBeats: 6 },
      };

      const engine = new RhythmEngine({ trackConfig: customTrack });
      expect(engine.bpm).toBe(100);
      expect(engine.beatsPerRound).toBe(6);
      expect(engine.secondsPerBeat).toBeCloseTo(0.6, 5);
      expect(engine.secondsPerRound).toBeCloseTo(3.6, 5);
      expect(engine.trackConfig).toEqual(customTrack);
    });

    it('setTrackConfig 호출 시 bpm과 loopPattern이 즉시 갱신된다', () => {
      const engine = new RhythmEngine({ bpm: 120, beatsPerRound: 8 });

      const newTrack: MusicTrackConfig = {
        bpm: 150,
        loopPattern: { exerciseBeats: 4, readyBeats: 2, performanceBeats: 4 },
      };
      engine.setTrackConfig(newTrack);

      expect(engine.bpm).toBe(150);
      expect(engine.beatsPerRound).toBe(4);
      expect(engine.secondsPerBeat).toBeCloseTo(60 / 150, 5);
      expect(engine.secondsPerRound).toBeCloseTo((60 / 150) * 4, 5);
    });
  });

  describe('2. BeatRunCoordinator 가변 LoopPattern (8+4+8, 4+2+4) 동적 수용 검증', () => {
    it('기본 설정 시 8+4+8 루프 패턴과 BPM 120이 적용된다', () => {
      const coordinator = new BeatRunCoordinator();
      expect(coordinator.exerciseBeats).toBe(8);
      expect(coordinator.readyBeats).toBe(4);
      expect(coordinator.performanceBeats).toBe(8);
      expect(coordinator.rhythmEngine.bpm).toBe(120);
    });

    it('8+4+8 가변 루프 패턴 적용 시 ANSWER_SELECT 페이즈가 4박 동안 유지된다', () => {
      const track848: MusicTrackConfig = {
        bpm: 120, // 1박 = 0.5s
        loopPattern: { exerciseBeats: 8, readyBeats: 4, performanceBeats: 8 },
      };

      const phaseChanges: string[] = [];
      const coordinator = new BeatRunCoordinator({
        trackConfig: track848,
        routineMode: 'arm_reach',
        onPhaseChange: (p) => phaseChanges.push(p),
      });

      expect(coordinator.exerciseBeats).toBe(8);
      expect(coordinator.readyBeats).toBe(4);
      expect(coordinator.performanceBeats).toBe(8);

      coordinator.startRound();
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 8개 슬롯에 맞춰 스텝 입력 (0.1s, 0.6s, ..., 3.6s)
      coordinator.update(0.1);
      coordinator.recordStep('run');
      for (let i = 1; i < 8; i++) {
        coordinator.update(0.5);
        coordinator.recordStep('run');
      }
      expect(coordinator.completedExerciseBeats).toBe(8);
      // 8번째 슬롯 경계(4.0s) 도달
      coordinator.update(0.4);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);

      // 2박(1.0초 @ BPM 120) 도달: 타임아웃 만료로 HAZARD_EVADE 전이 (Issue #287)
      coordinator.update(1.0);
      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(coordinator.isAnswerOpen).toBe(false);
    });

    it('setTrackConfig로 런타임에 트랙 및 루프 패턴을 동적 변경할 수 있다', () => {
      const coordinator = new BeatRunCoordinator();
      expect(coordinator.exerciseBeats).toBe(8);

      const customTrack: MusicTrackConfig = {
        bpm: 100,
        loopPattern: { exerciseBeats: 4, readyBeats: 2, performanceBeats: 6 },
      };
      coordinator.setTrackConfig(customTrack);

      expect(coordinator.exerciseBeats).toBe(4);
      expect(coordinator.readyBeats).toBe(2);
      expect(coordinator.performanceBeats).toBe(6);
      expect(coordinator.rhythmEngine.bpm).toBe(100);
      expect(coordinator.rhythmEngine.secondsPerBeat).toBeCloseTo(0.6, 5);
    });
  });

  describe('3. 카운트인(Count-in) 예비박 3박 메트로놈 및 RUN_QUESTION 동시 전이 검증', () => {
    it('startCountIn 호출 시 COUNT_IN 페이즈로 시작되고 onCountInBeat 콜백이 3박 동안 호출된다', () => {
      const countInBeats: Array<{ beat: number; total: number }> = [];
      const phaseChanges: string[] = [];

      const coordinator = new BeatRunCoordinator({
        trackConfig: {
          bpm: 120, // 1박 = 0.5초
          intro: { countInBeats: 3, soundType: 'metronome' },
        },
        onPhaseChange: (p) => phaseChanges.push(p),
        onCountInBeat: (beat, total) => countInBeats.push({ beat, total }),
      });

      coordinator.startCountIn();
      expect(coordinator.phase).toBe('COUNT_IN');
      expect(phaseChanges).toContain('COUNT_IN');

      // t=0 시작 시점에 1번째 예비박 호출 확인
      expect(countInBeats).toEqual([{ beat: 1, total: 3 }]);
      expect(coordinator.countInCurrentBeat).toBe(1);

      // t=0.5s: 2번째 예비박 호출
      coordinator.update(0.5);
      expect(countInBeats).toEqual([
        { beat: 1, total: 3 },
        { beat: 2, total: 3 },
      ]);
      expect(coordinator.countInCurrentBeat).toBe(2);
      expect(coordinator.phase).toBe('COUNT_IN');

      // t=1.0s: 3번째 예비박 호출
      coordinator.update(0.5);
      expect(countInBeats).toEqual([
        { beat: 1, total: 3 },
        { beat: 2, total: 3 },
        { beat: 3, total: 3 },
      ]);
      expect(coordinator.countInCurrentBeat).toBe(3);
      expect(coordinator.phase).toBe('COUNT_IN');

      // t=1.5s (3박 종료 직후): 즉시 RUN_QUESTION으로 전이
      coordinator.update(0.5);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.currentQuestion).not.toBeNull();
      expect(phaseChanges[phaseChanges.length - 1]).toBe('RUN_QUESTION');
    });

    it('startRound({ withCountIn: true }) 옵션으로도 카운트인이 작동한다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: {
          bpm: 120,
          intro: { countInBeats: 3, soundType: 'metronome' },
        },
      });

      coordinator.startRound({ withCountIn: true });
      expect(coordinator.phase).toBe('COUNT_IN');

      // 3박자(1.5초) 경과 후 본 라운드 전이
      coordinator.update(1.51);
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });

    it('카운트인 완료 시 잔여 dt(overshoot)가 RUN_QUESTION 활성 시간으로 지연 없이 계승된다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: {
          bpm: 120, // 1박 0.5s, 3박 = 1.5s
          intro: { countInBeats: 3, soundType: 'metronome' },
        },
      });

      coordinator.startCountIn();
      // 1.0초 진행
      coordinator.update(1.0);
      expect(coordinator.phase).toBe('COUNT_IN');

      // 0.5초 남은 상태에서 0.7초 dt 전달 -> 0.5초로 카운트인 완료 후 나머지 0.2초가 RUN_QUESTION 진행
      coordinator.update(0.7);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.questionApproachProgress).toBeCloseTo(0.2 / (2 * 0.5), 2);
    });

    it('키보드/터치 비상 fallback(triggerFallbackAdvance) 호출 시 카운트인을 즉시 스킵하고 RUN_QUESTION으로 전이된다', () => {
      const coordinator = new BeatRunCoordinator();
      coordinator.startCountIn();
      expect(coordinator.phase).toBe('COUNT_IN');

      coordinator.triggerFallbackAdvance();
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.currentQuestion).not.toBeNull();
    });
  });

  describe('4. 기존 기본값 및 챕터별 프리셋 하위 호환성 검증', () => {
    it('기본 DEFAULT_TRACK_CONFIG 및 DEFAULT_LOOP_PATTERN이 정의되어 있다 (readyBeats: 4)', () => {
      expect(DEFAULT_LOOP_PATTERN).toEqual({
        exerciseBeats: 8,
        readyBeats: 4,
        performanceBeats: 8,
      });
      expect(DEFAULT_TRACK_CONFIG.bpm).toBe(120);
      expect(DEFAULT_TRACK_CONFIG.loopPattern).toEqual(DEFAULT_LOOP_PATTERN);
      expect(DEFAULT_TRACK_CONFIG.intro?.countInBeats).toBe(3);
    });

    it('CHAPTER_TRACK_PRESETS 및 TRACK_TEMPLATES에 1~5 챕터 프리셋이 올바르게 등록되어 있다 (readyBeats: 4)', () => {
      expect(TRACK_TEMPLATES).toBe(CHAPTER_TRACK_PRESETS);
      for (let ch = 1; ch <= 5; ch++) {
        const preset = CHAPTER_TRACK_PRESETS[ch];
        expect(preset).toBeDefined();
        expect(preset.bpm).toBeGreaterThanOrEqual(100);
        expect(preset.bpm).toBeLessThanOrEqual(140);
        expect(preset.loopPattern).toBeDefined();
        expect(preset.loopPattern!.readyBeats).toBe(4);
        expect(preset.intro?.countInBeats).toBe(3);
      }
    });

    it('withCountIn 없이 startRound()를 호출하면 즉시 RUN_QUESTION으로 시작된다 (기존 동작 100% 호환)', () => {
      const coordinator = new BeatRunCoordinator();
      coordinator.startRound();
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.completedExerciseBeats).toBe(0);
      expect(coordinator.currentQuestion).not.toBeNull();
    });
  });
});
