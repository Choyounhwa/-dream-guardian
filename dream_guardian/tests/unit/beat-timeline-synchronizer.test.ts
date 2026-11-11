import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatTimelineSynchronizer } from '../../src/game/beat/BeatTimelineSynchronizer.js';

describe('BeatTimelineSynchronizer Unit Tests (#640 / REFACTOR-SRP-009)', () => {
  describe('1. BPM Scaling and Beat Duration Calculation', () => {
    it('BPM 120일 때 secondsPerBeat는 0.5초이고 60일 때는 1.0초이다', () => {
      expect(BeatTimelineSynchronizer.calculateSecondsPerBeat(120)).toBe(0.5);
      expect(BeatTimelineSynchronizer.calculateSecondsPerBeat(60)).toBe(1.0);
      expect(BeatTimelineSynchronizer.calculateSecondsPerBeat(140)).toBeCloseTo(60 / 140, 5);
    });

    it('BPM이 0 이하이거나 유효하지 않으면 기본 fallback(0.5초)을 반환한다', () => {
      expect(BeatTimelineSynchronizer.calculateSecondsPerBeat(0)).toBe(0.5);
      expect(BeatTimelineSynchronizer.calculateSecondsPerBeat(-10)).toBe(0.5);
      expect(BeatTimelineSynchronizer.calculateSecondsPerBeat(NaN)).toBe(0.5);
    });

    it('beatsToSeconds와 secondsToBeats 상호 변환이 정확하다', () => {
      // 120 BPM -> 0.5s per beat
      expect(BeatTimelineSynchronizer.beatsToSeconds(4, 120)).toBe(2.0);
      expect(BeatTimelineSynchronizer.beatsToSeconds(8, 120)).toBe(4.0);
      expect(BeatTimelineSynchronizer.secondsToBeats(2.0, 120)).toBe(4);
      expect(BeatTimelineSynchronizer.secondsToBeats(3.5, 120)).toBe(7);
    });
  });

  describe('2. Elapsed Time to Beat/Bar Mapping and Beat Index Advance', () => {
    it('시간 경과에 따른 beatIndex, barIndex, beatInBar, beatProgress를 계산한다 (4/4 박자, 120 BPM)', () => {
      // 0.0s -> 0번 비트 시작
      const at0 = BeatTimelineSynchronizer.getBeatIndexAndBar(0, 120, 4);
      expect(at0).toEqual({
        beatIndex: 0,
        barIndex: 0,
        beatInBar: 0,
        beatProgress: 0,
      });

      // 0.25s -> 0번 비트의 50% 지점
      const at025 = BeatTimelineSynchronizer.getBeatIndexAndBar(0.25, 120, 4);
      expect(at025).toEqual({
        beatIndex: 0,
        barIndex: 0,
        beatInBar: 0,
        beatProgress: 0.5,
      });

      // 0.5s -> 1번 비트
      const at05 = BeatTimelineSynchronizer.getBeatIndexAndBar(0.5, 120, 4);
      expect(at05).toEqual({
        beatIndex: 1,
        barIndex: 0,
        beatInBar: 1,
        beatProgress: 0,
      });

      // 2.0s -> 4번째 비트 (마디 1의 0번째 비트)
      const at20 = BeatTimelineSynchronizer.getBeatIndexAndBar(2.0, 120, 4);
      expect(at20).toEqual({
        beatIndex: 4,
        barIndex: 1,
        beatInBar: 0,
        beatProgress: 0,
      });

      // 3.75s -> 7번째 비트의 50% (마디 1의 3번째 비트)
      const at375 = BeatTimelineSynchronizer.getBeatIndexAndBar(3.75, 120, 4);
      expect(at375.beatIndex).toBe(7);
      expect(at375.barIndex).toBe(1);
      expect(at375.beatInBar).toBe(3);
      expect(at375.beatProgress).toBeCloseTo(0.5, 5);
    });

    it('4/4 박자 기준 첫 박(0, 4, 8)을 강박(isStrongBeat)으로 올바르게 판정한다', () => {
      expect(BeatTimelineSynchronizer.isStrongBeat(0, 4)).toBe(true);
      expect(BeatTimelineSynchronizer.isStrongBeat(1, 4)).toBe(false);
      expect(BeatTimelineSynchronizer.isStrongBeat(2, 4)).toBe(false);
      expect(BeatTimelineSynchronizer.isStrongBeat(3, 4)).toBe(false);
      expect(BeatTimelineSynchronizer.isStrongBeat(4, 4)).toBe(true);
      expect(BeatTimelineSynchronizer.isStrongBeat(8, 4)).toBe(true);
    });
  });

  describe('3. 8-Beat Cycle Progress and Approach Calculation', () => {
    it('8박 사이클 진행률(0.0~1.0)을 계산하고 클램핑한다', () => {
      const spb = 0.5; // 120 BPM
      const totalBeats = 8; // 4.0s

      expect(BeatTimelineSynchronizer.calculateCycleProgress(0, totalBeats, spb)).toBe(0);
      expect(BeatTimelineSynchronizer.calculateCycleProgress(2.0, totalBeats, spb)).toBe(0.5);
      expect(BeatTimelineSynchronizer.calculateCycleProgress(4.0, totalBeats, spb)).toBe(1.0);
      expect(BeatTimelineSynchronizer.calculateCycleProgress(5.0, totalBeats, spb)).toBe(1.0);
      expect(BeatTimelineSynchronizer.calculateCycleProgress(-1.0, totalBeats, spb)).toBe(0);
    });

    it('문제 소실점 접근 진행도(첫 4박 동안 0->1 진행)를 계산한다', () => {
      const spb = 0.5; // 4박 = 2.0s
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(0, spb)).toBe(0);
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(0.5, spb)).toBe(0.25);
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(1.0, spb)).toBe(0.5);
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(2.0, spb)).toBe(1.0);
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(3.0, spb)).toBe(1.0);
    });

    it('인자로 커스텀 approachBeats를 넘겨 진행도를 유연하게 제어할 수 있다', () => {
      const spb = 0.5;
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(0.5, spb, 2)).toBe(0.5);
      expect(BeatTimelineSynchronizer.calculateQuestionApproachProgress(1.0, spb, 2)).toBe(1.0);
    });

    it('답안 소실점 원근 접근 진행도(approachStartBeat~exerciseBeats)를 quadratic ease-out으로 계산한다', () => {
      const spb = 0.5;
      const approachStart = 6; // 3.0s
      const exerciseBeats = 8; // 4.0s

      // 3.0s 이전은 0.0
      expect(BeatTimelineSynchronizer.calculateAnswerApproachProgress(2.0, approachStart, exerciseBeats, spb)).toBe(0.0);
      expect(BeatTimelineSynchronizer.calculateAnswerApproachProgress(3.0, approachStart, exerciseBeats, spb)).toBe(0.0);

      // 3.5s (중간: linear = 0.5 -> ease-out quadratic: 1 - (1 - 0.5)^2 = 0.75)
      expect(
        BeatTimelineSynchronizer.calculateAnswerApproachProgress(3.5, approachStart, exerciseBeats, spb),
      ).toBeCloseTo(0.75, 4);

      // 4.0s 이상은 1.0
      expect(BeatTimelineSynchronizer.calculateAnswerApproachProgress(4.0, approachStart, exerciseBeats, spb)).toBe(1.0);
      expect(BeatTimelineSynchronizer.calculateAnswerApproachProgress(5.0, approachStart, exerciseBeats, spb)).toBe(1.0);
    });
  });

  describe('4. Countdown / Count-In Timer and Step Advance', () => {
    let synchronizer: BeatTimelineSynchronizer;

    beforeEach(() => {
      synchronizer = new BeatTimelineSynchronizer();
    });

    it('카운트다운 시작 시 countInCurrentBeat=1, countInElapsed=0으로 초기화된다', () => {
      synchronizer.startCountIn();
      expect(synchronizer.countInCurrentBeat).toBe(1);
      expect(synchronizer.countInElapsed).toBe(0);
    });

    it('updateCountIn 호출 시 각 박 경계마다 onBeat 콜백이 발생하고 전체 시간이 되면 completed=true를 반환한다', () => {
      synchronizer.startCountIn();
      const onBeat = vi.fn();
      const spb = 0.5; // 120 BPM
      const totalBeats = 4; // 총 2.0초

      // 0.4초 진행 (비트 1 진행 중)
      let res = synchronizer.updateCountIn(0.4, spb, totalBeats, onBeat);
      expect(res.completed).toBe(false);
      expect(synchronizer.countInCurrentBeat).toBe(1);
      expect(onBeat).not.toHaveBeenCalled();

      // 0.2초 추가 진행 (0.6s -> 비트 2 경계 0.5s 통과)
      res = synchronizer.updateCountIn(0.2, spb, totalBeats, onBeat);
      expect(res.completed).toBe(false);
      expect(synchronizer.countInCurrentBeat).toBe(2);
      expect(onBeat).toHaveBeenCalledWith(2, 4);

      // 나머지 1.4초 단번에 진행 (2.0s 도달 -> 완료)
      res = synchronizer.updateCountIn(1.5, spb, totalBeats, onBeat);
      expect(res.completed).toBe(true);
      expect(res.remainingDt).toBeCloseTo(0.1, 5); // 1.5 - 1.4 = 0.1s 남음
      expect(onBeat).toHaveBeenCalledWith(3, 4);
      expect(onBeat).toHaveBeenCalledWith(4, 4);
    });

    it('getCountInProgress는 총 지속시간 대비 진행률을 0.0~1.0으로 반환한다', () => {
      synchronizer.startCountIn();
      const spb = 0.5;
      const totalBeats = 4; // 2.0s
      synchronizer.updateCountIn(1.0, spb, totalBeats);
      expect(synchronizer.getCountInProgress(totalBeats, spb)).toBeCloseTo(0.5, 4);
    });
  });

  describe('5. Timeline State and Snapshot Generators', () => {
    let synchronizer: BeatTimelineSynchronizer;

    beforeEach(() => {
      synchronizer = new BeatTimelineSynchronizer();
    });

    it('resetRound 및 resetRunQuestion 시 모든 경과 타이머가 정상 리셋된다', () => {
      synchronizer.runElapsed = 2.5;
      synchronizer.answerSelectElapsed = 1.0;
      synchronizer.completedExerciseBeats = 4;

      synchronizer.resetRunQuestion();
      expect(synchronizer.runElapsed).toBe(0);
      expect(synchronizer.answerSelectElapsed).toBe(0);
      expect(synchronizer.completedExerciseBeats).toBe(0);
    });

    it('stepRun은 targetSlotEndElapsed가 있을 때 해당 시점까지만 전진하고 남은 dt를 반환한다', () => {
      synchronizer.runElapsed = 1.0;
      synchronizer.targetSlotEndElapsed = 1.5;

      // dt = 0.8s 주어지면 0.5s만 진행하여 1.5s 도달 후 remainingDt = 0.3s 반환
      const res = synchronizer.stepRun(0.8);
      expect(res.reachedTarget).toBe(true);
      expect(res.step).toBeCloseTo(0.5, 5);
      expect(res.remainingDt).toBeCloseTo(0.3, 5);
      expect(synchronizer.runElapsed).toBeCloseTo(1.5, 5);
    });

    it('createAnswerSnapshot은 primary, extension, closed 상태를 올바르게 계산한다', () => {
      const policy = {
        answerPrimaryBeats: 2,
        answerExtensionBeats: 2,
        answerMaxBeats: 4,
      };
      const spb = 0.5;

      // primary phase (0.5s = 1.0 beat)
      let snap = synchronizer.createAnswerSnapshot({
        windowId: 1,
        isAnswerSelectPhase: true,
        selectedChoiceIndex: null,
        isPaused: false,
        spb,
        policy,
      });
      expect(snap.phase).toBe('primary');
      expect(snap.inputOpen).toBe(true);
      expect(snap.remainingBeats).toBe(4);

      // extension phase (1.25s = 2.5 beats)
      synchronizer.answerSelectElapsed = 1.25;
      snap = synchronizer.createAnswerSnapshot({
        windowId: 1,
        isAnswerSelectPhase: true,
        selectedChoiceIndex: null,
        isPaused: false,
        spb,
        policy,
      });
      expect(snap.phase).toBe('extension');
      expect(snap.inputOpen).toBe(true);
      expect(snap.remainingBeats).toBeCloseTo(1.5, 4);

      // closed phase (2.0s = 4.0 beats)
      synchronizer.answerSelectElapsed = 2.0;
      snap = synchronizer.createAnswerSnapshot({
        windowId: 1,
        isAnswerSelectPhase: true,
        selectedChoiceIndex: null,
        isPaused: false,
        spb,
        policy,
      });
      expect(snap.phase).toBe('closed');
      expect(snap.inputOpen).toBe(false);
      expect(snap.remainingBeats).toBe(0);
    });

    it('createBranchClock은 유효 페이즈(STAR_COLLECT, HAZARD_EVADE)에서만 시계를 반환한다', () => {
      synchronizer.branchStartElapsed = 2.0;
      synchronizer.branchElapsed = 0.5;

      // RUN_QUESTION 페이즈 -> null
      expect(
        synchronizer.createBranchClock('RUN_QUESTION', 120, 0.5, 8),
      ).toBeNull();

      // STAR_COLLECT 페이즈 -> BranchClock 객체 반환
      const clock = synchronizer.createBranchClock('STAR_COLLECT', 120, 0.5, 8);
      expect(clock).toEqual({
        bpm: 120,
        secondsPerBeat: 0.5,
        startElapsed: 2.0,
        elapsed: 0.5,
        endElapsed: 2.0 + 8 * 0.5,
        durationBeats: 8,
      });
    });
  });
});
