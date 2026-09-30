import { describe, it, expect, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { RhythmEngine } from '../../src/core/RhythmEngine.js';
import { BattleState } from '../../src/game/BattleState.js';

describe('BeatRunCoordinator - [BUG-BEAT-CLOCK-001 / #230] 실제 8박 시계 및 중복 입력 제한', () => {
  let coordinator: BeatRunCoordinator;
  let rhythmEngine: RhythmEngine;
  let battle: BattleState;

  beforeEach(() => {
    rhythmEngine = new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
    battle = new BattleState(100);
    coordinator = new BeatRunCoordinator({
      rhythmEngine,
      battle,
      routineMode: 'arm_reach',
    });
  });

  describe('1. t=0에 8회 입력해도 조기 전환 없음 (No early transition at t=0)', () => {
    it('t=0에 recordStep()을 8회 동기 호출해도 첫 슬롯 1박만 인정되고 조기 전환되지 않는다', () => {
      coordinator.startRound({ chapter: 1 });
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // t=0에서 연속 8회 입력
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
      }

      // raw steps는 8회 모두 누적되지만
      expect(coordinator.totalSteps).toBe(8);
      // 같은 슬롯(slot 0)이므로 인정된 유효 운동 박은 1회뿐이어야 함
      expect(coordinator.completedExerciseBeats).toBe(1);
      // 조기 전환 없이 계속 RUN_QUESTION이어야 함
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);
    });
  });

  describe('2. BPM 120에서 3.999초 전 전환 없음; 8번째 유효 슬롯 종료 후에만 전환', () => {
    it('각 0.5초 슬롯마다 1회씩 8회 운동 시 3.999초까지는 RUN_QUESTION을 유지하고 4.000초 경계에서 전환된다', () => {
      const phaseChanges: string[] = [];
      coordinator = new BeatRunCoordinator({
        rhythmEngine,
        battle,
        routineMode: 'arm_reach',
        onPhaseChange: (p) => phaseChanges.push(p),
      });

      coordinator.startRound({ chapter: 1 });
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 8개 슬롯 순차 진행 (BPM 120 -> 1슬롯 = 0.5s)
      // Slot 0 (0.0s ~ 0.5s): step at 0.1s
      coordinator.update(0.1);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 1 (0.5s ~ 1.0s): step at 0.6s
      coordinator.update(0.5);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(2);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 2 (1.0s ~ 1.5s): step at 1.1s
      coordinator.update(0.5);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(3);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 3 (1.5s ~ 2.0s): step at 1.6s
      coordinator.update(0.5);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(4);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 4 (2.0s ~ 2.5s): step at 2.1s
      coordinator.update(0.5);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(5);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 5 (2.5s ~ 3.0s): step at 2.6s
      coordinator.update(0.5);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(6);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 6 (3.0s ~ 3.5s): step at 3.1s
      coordinator.update(0.5);
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(7);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // Slot 7 (3.5s ~ 4.0s): step at 3.6s (현재 경과 3.6s)
      coordinator.update(0.5);
      coordinator.recordStep('run');
      // 8번째 유효 슬롯 인정됨
      expect(coordinator.completedExerciseBeats).toBe(8);
      // 하지만 8번째 슬롯의 종료 경계(4.0s) 이전이므로 전환되지 않아야 함!
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);

      // t = 3.999s까지 진행 (경과 시간 3.999s)
      coordinator.update(0.399);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);

      // t = 4.000s 경계 도달
      coordinator.update(0.001);
      // 8번째 슬롯이 완전히 종료된 후 ANSWER_SELECT로 전이
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
    });

    it('불규칙하게 쉬어가며 8번째 유효 슬롯을 채웠을 때도 해당 슬롯 종료 경계에서 정확히 전환된다', () => {
      coordinator.startRound({ chapter: 1 });

      // Slot 0 (0.0~0.5s): step at 0.1s -> 1st
      coordinator.update(0.1);
      coordinator.recordStep('run');

      // 10초간 무동작 휴식 (경과 10.1s)
      coordinator.update(10.0);
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 이후 7개 슬롯을 각 슬롯마다 1회씩 운동
      // Slot at 10.5s -> 2nd
      coordinator.update(0.4); // 10.5s
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(2);

      // 3rd ~ 7th (5번 더)
      for (let s = 3; s <= 7; s++) {
        coordinator.update(0.5);
        coordinator.recordStep('run');
        expect(coordinator.completedExerciseBeats).toBe(s);
      }

      // 8th valid slot: current time around 13.5s, slot ends at 14.0s
      coordinator.update(0.5); // ~13.5s
      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(8);
      expect(coordinator.phase).toBe('RUN_QUESTION'); // 아직 슬롯 미종료

      // 슬롯 종료 직전
      coordinator.update(0.49);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 슬롯 종료 경계 도달
      coordinator.update(0.02);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
    });
  });

  describe('3. 30초 무동작 0/8, 같은 슬롯 중복 불인정, 지연 프레임 가짜 입력 없음', () => {
    it('30초 동안 아무 운동 입력이 없으면 0/8이며 자동 진행되지 않는다', () => {
      coordinator.startRound({ chapter: 1 });
      expect(coordinator.phase).toBe('RUN_QUESTION');

      coordinator.update(30.0);

      expect(coordinator.completedExerciseBeats).toBe(0);
      expect(coordinator.totalSteps).toBe(0);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);
    });

    it('동일 슬롯에서 연타(중복 입력)해도 1박만 인정된다', () => {
      coordinator.startRound({ chapter: 1 });

      coordinator.update(1.0); // Slot 2 (1.0s ~ 1.5s)
      for (let i = 0; i < 10; i++) {
        coordinator.recordStep('run');
      }

      expect(coordinator.totalSteps).toBe(10);
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });

    it('대형 프레임 지연(lag spike)이 발생해도 가짜 운동 입력이 생성되지 않는다', () => {
      coordinator.startRound({ chapter: 1 });
      coordinator.recordStep('run'); // 1st beat at t=0
      expect(coordinator.completedExerciseBeats).toBe(1);

      // 5초 lag spike
      coordinator.update(5.0);

      // 가짜 입력이 자동 생성되지 않고 여전히 1박 유지
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.totalSteps).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });
  });

  describe('4. 2회 빠른 운동으로 1초 전 접근 완료 불가; pause 시간 제외', () => {
    it('2회 빠른 운동을 수행해도 첫 2박(1.0s) 시간 소비 계약에 따라 1초 전에는 1.0에 도달하지 않는다', () => {
      coordinator.startRound({ chapter: 1 });

      // t=0에서 1회 스텝
      coordinator.recordStep('run');
      // t=0.2s 경과 후 2번째 슬롯 진입 전 또 스텝 시도
      coordinator.update(0.2);
      coordinator.recordStep('run');

      // 0.2초 시점에서 questionApproachProgress는 0.2 / 1.0 = 0.2 수준이어야 하며 절대 1.0이 될 수 없음
      expect(coordinator.questionApproachProgress).toBeCloseTo(0.2, 2);
      expect(coordinator.questionApproachProgress).toBeLessThan(1.0);

      // 0.5초 경과 (t=0.5s)
      coordinator.update(0.3);
      expect(coordinator.questionApproachProgress).toBeCloseTo(0.5, 2);
      expect(coordinator.questionApproachProgress).toBeLessThan(1.0);

      // 0.999초 경과 (t=0.999s)
      coordinator.update(0.499);
      expect(coordinator.questionApproachProgress).toBeLessThan(1.0);

      // 1.000초 도달 (t=1.000s) -> 비로소 1.0에 도달
      coordinator.update(0.001);
      expect(coordinator.questionApproachProgress).toBeCloseTo(1.0, 2);
    });

    it('일시정지(pause) 중에는 경과 시간이 누적되지 않아 문제 접근 진행도가 멈춘다', () => {
      coordinator.startRound({ chapter: 1 });

      coordinator.update(0.5);
      expect(coordinator.questionApproachProgress).toBeCloseTo(0.5, 2);

      // 일시정지
      coordinator.pause();

      // pause 중 update 호출
      coordinator.update(2.0);
      // pause 중이었으므로 진행도는 여전히 0.5여야 함
      expect(coordinator.questionApproachProgress).toBeCloseTo(0.5, 2);

      // 재개
      coordinator.resume();
      coordinator.update(0.5);
      // 0.5s + 0.5s = 1.0s 도달하여 1.0
      expect(coordinator.questionApproachProgress).toBeCloseTo(1.0, 2);
    });
  });

  describe('5. triggerFallbackAdvance 루프 우회 차단', () => {
    it('triggerFallbackAdvance()를 호출해도 루프 우회로 8박을 즉시 채우지 않고 현재 슬롯 1회만 처리한다', () => {
      coordinator.startRound({ chapter: 1 });

      coordinator.triggerFallbackAdvance();

      // 8박 즉시 완료가 아니라 현재 슬롯 1박만 인정
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 동기 연속 호출해도 같은 슬롯이므로 증가하지 않음
      coordinator.triggerFallbackAdvance();
      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });
  });

  describe('6. RhythmEngine 시간 갱신 연동 검증', () => {
    it('BeatRunCoordinator.update() 호출 시 RhythmEngine의 elapsedTime과 beatIndex가 정상 갱신된다', () => {
      coordinator.startRound({ chapter: 1 });

      expect(coordinator.rhythmEngine.running).toBe(true);
      expect(coordinator.rhythmEngine.elapsedTime).toBe(0);

      coordinator.update(0.5);
      expect(coordinator.rhythmEngine.elapsedTime).toBeCloseTo(0.5, 3);
      expect(coordinator.beatIndex).toBe(1);

      coordinator.update(0.5);
      expect(coordinator.rhythmEngine.elapsedTime).toBeCloseTo(1.0, 3);
      expect(coordinator.beatIndex).toBe(2);
    });
  });
});
