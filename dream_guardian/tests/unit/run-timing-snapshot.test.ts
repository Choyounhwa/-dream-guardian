import { describe, it, expect, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';

describe('RUN-MAT-001: BeatRunCoordinator - RunTimingSnapshot', () => {
  let coordinator: BeatRunCoordinator;

  beforeEach(() => {
    coordinator = new BeatRunCoordinator();
  });

  it('생성 직후에는 active가 false이고 예약 필드는 null이다', () => {
    const snapshot = coordinator.getRunTimingSnapshot();

    expect(snapshot.active).toBe(false);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.elapsedBeats).toBe(0);
    expect(snapshot.exerciseBeats).toBe(8);
    expect(snapshot.requiredExerciseCount).toBe(6);
    expect(snapshot.acceptedExerciseCount).toBe(0);
    expect(snapshot.prepareStartBeat).toBeNull();
    expect(snapshot.transitionBeat).toBeNull();
    expect(typeof snapshot.runId).toBe('number');
  });

  it('COUNT_IN 진행 중에는 active가 false이고 예약 필드는 null이다', () => {
    coordinator.startRound({ withCountIn: true });

    const snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.active).toBe(false);
    expect(snapshot.prepareStartBeat).toBeNull();
    expect(snapshot.transitionBeat).toBeNull();
  });

  it('RUN_QUESTION 활성화 시 active가 true이고 기본 박자 정보가 일치한다', () => {
    coordinator.startRound({ withCountIn: false });

    const snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.active).toBe(true);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.elapsedBeats).toBe(0);
    expect(snapshot.exerciseBeats).toBe(8);
    expect(snapshot.requiredExerciseCount).toBe(6);
    expect(snapshot.acceptedExerciseCount).toBe(0);
    expect(snapshot.prepareStartBeat).toBeNull();
    expect(snapshot.transitionBeat).toBeNull();
  });

  it('시간이 경과해도 입력 없이는 acceptedExerciseCount가 증가하지 않으며, 명목 경과만으로 준비가 시작되지 않는다', () => {
    coordinator.startRound({ withCountIn: false });
    const spb = coordinator.secondsPerBeat;

    // 6.5박 분량 시간 경과
    coordinator.update(spb * 6.5);

    const snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.active).toBe(true);
    expect(snapshot.elapsedBeats).toBeCloseTo(6.5, 4);
    // 시간 박수 != 인정 수
    expect(snapshot.acceptedExerciseCount).toBe(0);
    // 예약이 없으므로 N-2박(6박)을 넘어도 준비 시작은 null이어야 한다
    expect(snapshot.prepareStartBeat).toBeNull();
    expect(snapshot.transitionBeat).toBeNull();
  });

  it('동일 슬롯 중복 입력은 단 1회만 인정되며 acceptedExerciseCount는 실제 유효 운동 수를 반영한다', () => {
    coordinator.startRound({ withCountIn: false });
    const spb = coordinator.secondsPerBeat;

    // 슬롯 0 (0.1초 시점)에서 다중 입력
    coordinator.update(spb * 0.1);
    coordinator.recordStep();
    coordinator.recordStep();
    coordinator.recordStep();

    let snapshot = coordinator.getRunTimingSnapshot();
    expect(coordinator.totalSteps).toBe(3);
    expect(snapshot.acceptedExerciseCount).toBe(1);

    // 슬롯 1로 이동 후 1회 입력
    coordinator.update(spb * 1.0);
    coordinator.recordStep();

    snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.acceptedExerciseCount).toBe(2);
  });

  it('목표 유효 운동(6회) 충족 시 슬롯 경계 기준으로 transitionBeat 및 prepareStartBeat가 정확히 계산된다', () => {
    coordinator.startRound({ withCountIn: false });
    const spb = coordinator.secondsPerBeat;

    // 슬롯 0, 1, 2, 3, 4 각각 1회씩 스텝 기록 (0.1, 1.1, 2.1, 3.1, 4.1박)
    coordinator.update(spb * 0.1);
    coordinator.recordStep(); // 슬롯 0
    for (let slot = 1; slot <= 4; slot++) {
      coordinator.update(spb * 1.0);
      coordinator.recordStep(); // 슬롯 1, 2, 3, 4
    }
    // 슬롯 5 중간 시점 (5.3박)
    coordinator.update(spb * 1.2);
    coordinator.recordStep(); // 슬롯 5 (6번째 운동 인정)

    const snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.acceptedExerciseCount).toBe(6);
    // currentSlot = 5, remainingBeats = 2 -> targetSlotEndElapsed = (5 + 1 + 2) * spb = 8 * spb
    // transitionBeat = 8.0, prepareStartBeat = 8.0 - 2 = 6.0
    expect(snapshot.transitionBeat).toBeCloseTo(8.0, 4);
    expect(snapshot.prepareStartBeat).toBeCloseTo(6.0, 4);
  });

  it('목표 달성 후 추가 입력이 발생해도 이미 예약된 transitionBeat/prepareStartBeat가 유지되며 acceptedExerciseCount는 누적된다', () => {
    coordinator.startRound({ withCountIn: false });
    const spb = coordinator.secondsPerBeat;

    coordinator.update(spb * 0.1);
    coordinator.recordStep(); // 슬롯 0
    for (let slot = 1; slot <= 5; slot++) {
      coordinator.update(spb * 1.0);
      coordinator.recordStep(); // 슬롯 1~5 (총 6회 달성)
    }
    const initialTransition = coordinator.getRunTimingSnapshot().transitionBeat;
    const initialPrepare = coordinator.getRunTimingSnapshot().prepareStartBeat;

    // 슬롯 6으로 이동 후 추가 운동 기록
    coordinator.update(spb * 1.0);
    coordinator.recordStep(); // 슬롯 6 (7회차 추가 운동)

    const snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.acceptedExerciseCount).toBe(7);
    expect(snapshot.requiredExerciseCount).toBe(6); // 요구 수로 임의 덮어쓰지 않음
    expect(snapshot.transitionBeat).toBe(initialTransition);
    expect(snapshot.prepareStartBeat).toBe(initialPrepare);
  });

  it('일시정지 상태에서는 paused가 true로 노출된다', () => {
    coordinator.startRound({ withCountIn: false });
    coordinator.pause();

    const pausedSnapshot = coordinator.getRunTimingSnapshot();
    expect(pausedSnapshot.active).toBe(true);
    expect(pausedSnapshot.paused).toBe(true);

    coordinator.resume();
    const resumedSnapshot = coordinator.getRunTimingSnapshot();
    expect(resumedSnapshot.active).toBe(true);
    expect(resumedSnapshot.paused).toBe(false);
  });

  it('RUN_QUESTION 종료 및 타 페이즈(ANSWER_SELECT 등) 전이 시 active가 false가 되고 예약 필드는 null로 정규화된다', () => {
    coordinator = new BeatRunCoordinator({ routineMode: 'arm_reach' });
    coordinator.startRound({ withCountIn: false });
    const spb = coordinator.secondsPerBeat;

    coordinator.update(spb * 0.1);
    coordinator.recordStep();
    for (let slot = 1; slot <= 5; slot++) {
      coordinator.update(spb * 1.0);
      coordinator.recordStep();
    }

    // 예약 시점(8박)까지 시간 진행하여 ANSWER_SELECT로 전이
    coordinator.update(spb * 3.0);
    expect(coordinator.phase).toBe('ANSWER_SELECT');

    const snapshot = coordinator.getRunTimingSnapshot();
    expect(snapshot.active).toBe(false);
    expect(snapshot.prepareStartBeat).toBeNull();
    expect(snapshot.transitionBeat).toBeNull();
  });

  it('새 라운드 시작마다 runId가 구분 가능하고 같은 라운드 내에서는 안정적이다', () => {
    coordinator.startRound({ withCountIn: false });
    const runId1 = coordinator.getRunTimingSnapshot().runId;

    // 반복 조회 시 runId 불변
    expect(coordinator.getRunTimingSnapshot().runId).toBe(runId1);

    // 다음 라운드 시작
    coordinator.startRound({ withCountIn: false });
    const runId2 = coordinator.getRunTimingSnapshot().runId;

    expect(runId2).not.toBe(runId1);
  });

  it('getter는 독립 객체를 반환하며 내부 상태를 변경하지 않는다', () => {
    coordinator.startRound({ withCountIn: false });
    const snap1 = coordinator.getRunTimingSnapshot();
    const snap2 = coordinator.getRunTimingSnapshot();

    expect(snap1).not.toBe(snap2); // 서로 다른 독립 참조
    expect(snap1).toEqual(snap2);
    expect(Object.isFrozen(snap1)).toBe(true);
  });
});
