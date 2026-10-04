import { describe, it, expect, beforeEach } from 'vitest';
import type { RunTimingSnapshot } from '../../src/game/BeatRunCoordinator.js';
import {
  RunningMatPresenter,
  presentRunningMat,
  type RunningMatViewModel,
} from '../../src/render/RunningMatPresenter.js';
import { getRunningMatPattern } from '../../src/data/runningMatPatterns.js';

describe('RUN-MAT-002: 러닝 매트 제안 패턴 데이터 및 순수 표시 모델', () => {
  let presenter: RunningMatPresenter;

  beforeEach(() => {
    presenter = new RunningMatPresenter('run');
  });

  const createSnapshot = (overrides: Partial<RunTimingSnapshot> = {}): RunTimingSnapshot => {
    return Object.freeze({
      runId: 1,
      active: true,
      paused: false,
      elapsedBeats: 0,
      exerciseBeats: 8,
      requiredExerciseCount: 6,
      acceptedExerciseCount: 0,
      prepareStartBeat: 6,
      transitionBeat: 8,
      ...overrides,
    });
  };

  describe('1. null 스냅샷 및 비활성 스냅샷 처리', () => {
    it('null 스냅샷 전달 시 비표시 기본 뷰모델을 반환한다', () => {
      const vm: RunningMatViewModel = presenter.present(null);

      expect(vm.visible).toBe(false);
      expect(vm.paused).toBe(false);
      expect(vm.currentCue).toBeNull();
      expect(vm.nextCue).toBeNull();
      expect(vm.actionText).toBe('');
      expect(vm.directionText).toBe('');
      expect(vm.cueText).toBe('');
      expect(vm.arrowDirection).toBe('none');
      expect(vm.nextRingRatio).toBe(0);
      expect(vm.elapsedBeats).toBe(0);
      expect(vm.acceptedExerciseCount).toBe(0);
      expect(vm.requiredExerciseCount).toBe(0);
      expect(vm.isShortage).toBe(false);
      expect(vm.isPreparing).toBe(false);
    });

    it('active가 false인 스냅샷은 visible이 false이고 큐가 노출되지 않는다', () => {
      const snapshot = createSnapshot({ active: false, paused: true, elapsedBeats: 2.5 });
      const vm = presenter.present(snapshot);

      expect(vm.visible).toBe(false);
      expect(vm.paused).toBe(true);
      expect(vm.currentCue).toBeNull();
      expect(vm.nextCue).toBeNull();
      expect(vm.nextRingRatio).toBe(0);
      expect(vm.isShortage).toBe(false);
      expect(vm.isPreparing).toBe(false);
    });

    it('순수 함수 presentRunningMat도 동일하게 동작한다', () => {
      const vm = presentRunningMat(null);
      expect(vm.visible).toBe(false);
      expect(vm.currentCue).toBeNull();
    });
  });

  describe('2. 경계 박수 (0, 0.99, 1.0, 5.5, 6.0) 및 순차 큐 전이', () => {
    it('0.0박: 1번 큐(왼무릎 들고 복귀)와 2번 큐(오른무릎 들고 복귀)가 설정되고 ring ratio는 1.0이다', () => {
      const snapshot = createSnapshot({ elapsedBeats: 0.0 });
      const vm = presenter.present(snapshot);

      expect(vm.visible).toBe(true);
      expect(vm.isPreparing).toBe(false);
      expect(vm.nextRingRatio).toBe(1.0);

      expect(vm.currentCue).not.toBeNull();
      expect(vm.currentCue?.actionId).toBe('knee_left');
      expect(vm.currentCue?.leftFootSlot).toBe('lift');
      expect(vm.currentCue?.rightFootSlot).toBe('home');
      expect(vm.currentCue?.arrowDirection).toBe('up');
      expect(vm.actionText).toContain('왼무릎');
      expect(vm.directionText).toBe('왼쪽');
      expect(vm.cueText).toContain('왼무릎 들고 복귀');

      expect(vm.nextCue).not.toBeNull();
      expect(vm.nextCue?.actionId).toBe('knee_right');
      expect(vm.nextCue?.leftFootSlot).toBe('home');
      expect(vm.nextCue?.rightFootSlot).toBe('lift');
      expect(vm.nextCue?.arrowDirection).toBe('up');
    });

    it('0.99박: 1번 큐가 유지되며 ring ratio가 0.01로 단조 감소한다', () => {
      const snapshot = createSnapshot({ elapsedBeats: 0.99 });
      const vm = presenter.present(snapshot);

      expect(vm.currentCue?.actionId).toBe('knee_left');
      expect(vm.nextCue?.actionId).toBe('knee_right');
      expect(vm.nextRingRatio).toBeCloseTo(0.01, 2);
      expect(vm.isPreparing).toBe(false);
    });

    it('1.0박: 정수 박 경계에서 2번 큐(오른무릎 들고 복귀)로 넘어가고 ring ratio가 1.0으로 리셋된다', () => {
      const snapshot = createSnapshot({ elapsedBeats: 1.0 });
      const vm = presenter.present(snapshot);

      expect(vm.currentCue?.actionId).toBe('knee_right');
      expect(vm.currentCue?.leftFootSlot).toBe('home');
      expect(vm.currentCue?.rightFootSlot).toBe('lift');
      expect(vm.nextCue?.actionId).toBe('knee_left');
      expect(vm.nextCue?.leftFootSlot).toBe('lift');
      expect(vm.nextRingRatio).toBe(1.0);
      expect(vm.isPreparing).toBe(false);
    });

    it('2.0~5.0박: 무릎 교대(knee_left <-> knee_right) 순차 전이', () => {
      // 2.0: 왼무릎
      let vm = presenter.present(createSnapshot({ elapsedBeats: 2.0 }));
      expect(vm.currentCue?.actionId).toBe('knee_left');
      expect(vm.currentCue?.arrowDirection).toBe('up');
      expect(vm.nextCue?.actionId).toBe('knee_right');

      // 3.0: 오른무릎
      vm = presenter.present(createSnapshot({ elapsedBeats: 3.0 }));
      expect(vm.currentCue?.actionId).toBe('knee_right');
      expect(vm.currentCue?.arrowDirection).toBe('up');
      expect(vm.nextCue?.actionId).toBe('knee_left');

      // 4.0: 왼무릎
      vm = presenter.present(createSnapshot({ elapsedBeats: 4.0 }));
      expect(vm.currentCue?.actionId).toBe('knee_left');
      expect(vm.currentCue?.leftFootSlot).toBe('lift');
      expect(vm.currentCue?.rightFootSlot).toBe('home');
      expect(vm.currentCue?.arrowDirection).toBe('up');
      expect(vm.nextCue?.actionId).toBe('knee_right');

      // 5.0: 오른무릎
      vm = presenter.present(createSnapshot({ elapsedBeats: 5.0 }));
      expect(vm.currentCue?.actionId).toBe('knee_right');
      expect(vm.currentCue?.leftFootSlot).toBe('home');
      expect(vm.currentCue?.rightFootSlot).toBe('lift');
      expect(vm.currentCue?.arrowDirection).toBe('up');
    });

    it('5.5박: 현재 6번 큐(오른무릎)이며 nextCue는 준비 1번 큐(기본 자세)이고 isPreparing은 false이다', () => {
      const snapshot = createSnapshot({ elapsedBeats: 5.5, prepareStartBeat: 6, transitionBeat: 8 });
      const vm = presenter.present(snapshot);

      expect(vm.currentCue?.actionId).toBe('knee_right');
      expect(vm.currentCue?.isPrepare).toBe(false);
      expect(vm.nextCue?.actionId).toBe('both_home');
      expect(vm.nextCue?.isPrepare).toBe(true);
      expect(vm.isPreparing).toBe(false);
      expect(vm.nextRingRatio).toBeCloseTo(0.5, 2);
    });

    it('6.0박: prepareStartBeat 도달 시 isPreparing이 true가 되고 준비 1번 큐가 currentCue가 된다', () => {
      const snapshot = createSnapshot({ elapsedBeats: 6.0, prepareStartBeat: 6, transitionBeat: 8 });
      const vm = presenter.present(snapshot);

      expect(vm.isPreparing).toBe(true);
      expect(vm.currentCue?.actionId).toBe('both_home');
      expect(vm.currentCue?.isPrepare).toBe(true);
      expect(vm.currentCue?.leftFootSlot).toBe('home');
      expect(vm.currentCue?.rightFootSlot).toBe('home');
      expect(vm.nextCue?.actionId).toBe('ready_answer');
      expect(vm.nextCue?.isPrepare).toBe(true);
      expect(vm.nextRingRatio).toBe(1.0);
    });
  });

  describe('3. 조기 인정 달성 시에도 prepareStartBeat 도달 전에는 isPreparing이 false 유지', () => {
    it('필수 6회를 조기 달성해도 elapsedBeats < prepareStartBeat이면 준비 큐로 건너뛰지 않는다', () => {
      const snapshot = createSnapshot({
        elapsedBeats: 3.5,
        requiredExerciseCount: 6,
        acceptedExerciseCount: 6, // 조기 달성
        prepareStartBeat: 6,
        transitionBeat: 8,
      });
      const vm = presenter.present(snapshot);

      expect(vm.isShortage).toBe(false);
      expect(vm.isPreparing).toBe(false);
      expect(vm.currentCue?.actionId).toBe('knee_right');
      expect(vm.currentCue?.isPrepare).toBe(false);
      expect(vm.nextCue?.actionId).toBe('knee_left');
      expect(vm.nextCue?.isPrepare).toBe(false);
    });
  });

  describe('4. 지연 인정 (Shortage 미달 연장) 처리', () => {
    it('6박 도달 시 필수 횟수 미달이면 isPreparing은 false이고 무릎 들기 연장 큐를 교대로 표시한다', () => {
      const snapshot = createSnapshot({
        elapsedBeats: 6.0,
        requiredExerciseCount: 6,
        acceptedExerciseCount: 4, // 2회 미달
        prepareStartBeat: null, // 미달로 인해 예약 미설정
        transitionBeat: null,
      });
      const vm = presenter.present(snapshot);

      expect(vm.isShortage).toBe(true);
      expect(vm.isPreparing).toBe(false);
      // 연장 큐: run의 경우 무릎 들기를 교대로 반복
      expect(vm.currentCue?.actionId).toBe('knee_left');
      expect(vm.currentCue?.isPrepare).toBe(false);
      expect(vm.currentCue?.cueText).not.toContain('준비');
      expect(vm.currentCue?.cueText).not.toContain('완료');

      expect(vm.nextCue?.actionId).toBe('knee_right');
      expect(vm.nextCue?.isPrepare).toBe(false);
    });

    it('7.0박에도 미달 상태면 우측 무릎 들기 연장 큐를 표시하며 준비라고 하지 않는다', () => {
      const snapshot = createSnapshot({
        elapsedBeats: 7.0,
        requiredExerciseCount: 6,
        acceptedExerciseCount: 5,
        prepareStartBeat: null,
        transitionBeat: null,
      });
      const vm = presenter.present(snapshot);

      expect(vm.isShortage).toBe(true);
      expect(vm.isPreparing).toBe(false);
      expect(vm.currentCue?.actionId).toBe('knee_right');
      expect(vm.nextCue?.actionId).toBe('knee_left');
      expect(vm.cueText).not.toContain('준비');
    });

    it('이후 운동이 충족되어 prepareStartBeat가 8로 잡히면 8.0박에서 비로소 준비 큐로 전환된다', () => {
      const snapshot = createSnapshot({
        elapsedBeats: 8.0,
        requiredExerciseCount: 6,
        acceptedExerciseCount: 6,
        prepareStartBeat: 8,
        transitionBeat: 10,
      });
      const vm = presenter.present(snapshot);

      expect(vm.isShortage).toBe(false);
      expect(vm.isPreparing).toBe(true);
      expect(vm.currentCue?.actionId).toBe('both_home');
      expect(vm.currentCue?.isPrepare).toBe(true);
      expect(vm.nextCue?.actionId).toBe('ready_answer');
    });
  });

  describe('5. 준비 구간 (prepareStartBeat ~ transitionBeat)', () => {
    it('준비 1박(6.0)에서는 기본 자세, 2박(7.0)에서는 정답 존 대기를 표시한다', () => {
      // 6.0박: 기본 자세
      let vm = presenter.present(createSnapshot({ elapsedBeats: 6.0, prepareStartBeat: 6, transitionBeat: 8 }));
      expect(vm.isPreparing).toBe(true);
      expect(vm.currentCue?.actionId).toBe('both_home');
      expect(vm.currentCue?.cueText).toContain('기본 자세');
      expect(vm.nextCue?.actionId).toBe('ready_answer');

      // 7.0박: 정답 존 대기
      vm = presenter.present(createSnapshot({ elapsedBeats: 7.0, prepareStartBeat: 6, transitionBeat: 8 }));
      expect(vm.isPreparing).toBe(true);
      expect(vm.currentCue?.actionId).toBe('ready_answer');
      expect(vm.currentCue?.cueText).toContain('정답');
      expect(vm.nextCue).toBeNull(); // 전이 경계이므로 다음 러닝 매트 큐 없음
    });
  });

  describe('6. 비run 모드 (hip_bounce, hip_sway, arm_cross)', () => {
    it('hip_bounce: 발 이동 없이(home 고정) 상하 바운스를 교대로 안내한다', () => {
      presenter.setMode('hip_bounce');

      const vm0 = presenter.present(createSnapshot({ elapsedBeats: 0.0 }));
      expect(vm0.currentCue?.leftFootSlot).toBe('home');
      expect(vm0.currentCue?.rightFootSlot).toBe('home');
      expect(vm0.currentCue?.arrowDirection).toBe('down');
      expect(vm0.currentCue?.actionText).toContain('바운스');

      const vm1 = presenter.present(createSnapshot({ elapsedBeats: 1.0 }));
      expect(vm1.currentCue?.leftFootSlot).toBe('home');
      expect(vm1.currentCue?.rightFootSlot).toBe('home');
      expect(vm1.currentCue?.arrowDirection).toBe('up');
    });

    it('hip_sway: 발 이동 없이(home 고정) 중앙 좌우 체중 이동을 안내한다', () => {
      presenter.setMode('hip_sway');

      const vm0 = presenter.present(createSnapshot({ elapsedBeats: 0.0 }));
      expect(vm0.currentCue?.leftFootSlot).toBe('home');
      expect(vm0.currentCue?.rightFootSlot).toBe('home');
      expect(vm0.currentCue?.arrowDirection).toBe('left');
      expect(vm0.currentCue?.actionText).toContain('체중');

      const vm1 = presenter.present(createSnapshot({ elapsedBeats: 1.0 }));
      expect(vm1.currentCue?.arrowDirection).toBe('right');
    });

    it('arm_cross: 발 이동 없이(home 고정) 상체 팔 교차를 안내한다', () => {
      presenter.setMode('arm_cross');

      const vm0 = presenter.present(createSnapshot({ elapsedBeats: 0.0 }));
      expect(vm0.currentCue?.leftFootSlot).toBe('home');
      expect(vm0.currentCue?.rightFootSlot).toBe('home');
      expect(vm0.currentCue?.arrowDirection).toBe('left');
      expect(vm0.currentCue?.actionText).toContain('팔 교차');

      const vm1 = presenter.present(createSnapshot({ elapsedBeats: 1.0 }));
      expect(vm1.currentCue?.arrowDirection).toBe('right');
    });
  });

  describe('7. 8 / 12 / 16 박자별 제안 패턴 데이터 완결성', () => {
    it('8박 run 패턴은 필수 6개 운동 + 2개 준비 큐를 포함한다', () => {
      const pattern = getRunningMatPattern('run', 8);
      expect(pattern.exerciseCues.length).toBe(6);
      expect(pattern.prepareCues.length).toBe(2);
      expect(pattern.requiredCount).toBe(6);
    });

    it('12박 run 패턴은 바깥발이 반드시 복귀하는 완결된 쌍으로 10개 운동 큐를 갖는다', () => {
      const pattern = getRunningMatPattern('run', 12);
      expect(pattern.exerciseCues.length).toBe(10);
      expect(pattern.requiredCount).toBe(10);

      // 바깥발 복귀 쌍 검증: out 뒤에는 반드시 home
      for (let i = 0; i < pattern.exerciseCues.length - 1; i++) {
        const current = pattern.exerciseCues[i];
        const next = pattern.exerciseCues[i + 1];
        if (current.leftFootSlot === 'out') {
          expect(next.leftFootSlot).toBe('home');
        }
        if (current.rightFootSlot === 'out') {
          expect(next.rightFootSlot).toBe('home');
        }
      }
    });

    it('16박 run 패턴은 바깥발이 반드시 복귀하는 완결된 쌍으로 14개 운동 큐를 갖는다', () => {
      const pattern = getRunningMatPattern('run', 16);
      expect(pattern.exerciseCues.length).toBe(14);
      expect(pattern.requiredCount).toBe(14);

      for (let i = 0; i < pattern.exerciseCues.length - 1; i++) {
        const current = pattern.exerciseCues[i];
        const next = pattern.exerciseCues[i + 1];
        if (current.leftFootSlot === 'out') {
          expect(next.leftFootSlot).toBe('home');
        }
        if (current.rightFootSlot === 'out') {
          expect(next.rightFootSlot).toBe('home');
        }
      }
    });
  });

  describe('8. 일시정지 (paused) 및 프레임 지연 (frame delay) 시 일관성', () => {
    it('paused가 true이면 뷰모델 paused가 true이고 동일 박자 큐/링을 유지한다', () => {
      const snapshot = createSnapshot({ elapsedBeats: 2.3, paused: true });
      const vm = presenter.present(snapshot);

      expect(vm.paused).toBe(true);
      expect(vm.nextRingRatio).toBeCloseTo(0.7, 2);
      expect(vm.currentCue?.actionId).toBe('knee_left');
    });

    it('프레임 지연으로 박자가 건너뛰어져도 과거 큐 재생 없이 현재 snapshot에 즉시 맞춘다', () => {
      // 1.0 -> 4.2로 순간 이동
      const snapshot = createSnapshot({ elapsedBeats: 4.2 });
      const vm = presenter.present(snapshot);

      expect(vm.currentCue?.actionId).toBe('knee_left');
      expect(vm.currentCue?.beatIndex).toBe(4);
      expect(vm.nextRingRatio).toBeCloseTo(0.8, 2);
    });
  });
});
