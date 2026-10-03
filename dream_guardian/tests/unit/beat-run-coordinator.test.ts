import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BattleState } from '../../src/game/BattleState.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import { DEFAULT_LOOP_PATTERN } from '../../config/beat-motion.config.js';
import { DEFAULT_ARM_DIRECTION_ANSWER_CONFIG } from '../../config/judgment.config.js';

describe('BeatRunCoordinator Unit Tests (Issue #283 / UX-ANSWER-TIMEOUT-001)', () => {
  let battle: BattleState;

  beforeEach(() => {
    battle = new BattleState();
  });

  describe('1. 2박 답안 선택 시간 및 readyBeats 규격 (Issue #287)', () => {
    it('기본 BeatRunCoordinator 생성 시 readyBeats가 4박이고, DEFAULT_LOOP_PATTERN.readyBeats와 일치한다', () => {
      const coordinator = new BeatRunCoordinator({ battle });
      expect(coordinator.readyBeats).toBe(4);
      expect(DEFAULT_LOOP_PATTERN.readyBeats).toBe(4);
    });

    it('8박 러닝 완료 후 ANSWER_SELECT 페이즈로 진입 시 2박(1.0초 @ BPM 120) 동안 입력창이 유지된다', () => {
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
      });
      coordinator.startRound();
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 8박 운동 스텝 완료 (각 슬롯 0.5s)
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);

      // 1.9박(0.95초) 경과 시점: 여전히 열려 있음
      coordinator.update(0.95);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.isTimedOut).toBe(false);
    });
  });

  describe('2. 타임아웃 감지, isTimedOut 플래그 및 onTimeout 콜백 연동', () => {
    it('2박(1.0초) 초과 시 onTimeout 콜백이 1회 호출되고 isTimedOut이 true가 되며 HAZARD_EVADE로 전이된다', () => {
      const onTimeout = vi.fn();
      const onPhaseChange = vi.fn();
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
        onTimeout,
        onPhaseChange,
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isTimedOut).toBe(false);

      // 2박(1.0초) 만료 시점 업데이트
      coordinator.update(1.0);

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(coordinator.isTimedOut).toBe(true);
      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(onPhaseChange).toHaveBeenCalledWith('HAZARD_EVADE');
    });

    it('키보드/터치 fallbackAdvance로 ANSWER_SELECT 스킵 시에도 onTimeout이 호출되고 isTimedOut이 기록된다', () => {
      const onTimeout = vi.fn();
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
        onTimeout,
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      coordinator.triggerFallbackAdvance();

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(coordinator.isTimedOut).toBe(true);
      expect(coordinator.phase).toBe('HAZARD_EVADE');
    });

    it('답안을 정상 선택한 경우 onTimeout은 호출되지 않고 isTimedOut은 false를 유지한다', () => {
      const onTimeout = vi.fn();
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
        onTimeout,
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 정답 선택
      const correctIdx = coordinator.currentQuestion?.correctIndex ?? 0;
      coordinator.confirmAnswerByFallback(correctIdx);

      expect(coordinator.phase).toBe('STAR_COLLECT');
      expect(onTimeout).not.toHaveBeenCalled();
      expect(coordinator.isTimedOut).toBe(false);
    });

    it('다음 라운드가 시작되면 isTimedOut 플래그가 false로 리셋된다', () => {
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      // 2박 타임아웃
      coordinator.update(1.0);
      expect(coordinator.isTimedOut).toBe(true);

      // 새 라운드 시작
      coordinator.startRound();
      expect(coordinator.isTimedOut).toBe(false);
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });
  });
});

describe('[BUG-ANSWER-CONSUME-001 / #308] 선확정 답안 단일 소비', () => {
  const SPB = 0.5;
  const MAX_ANSWER = DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerSelectBeats * SPB;

  function restPose(): NormalizedLandmark[] {
    const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
    }));
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.4, y: 0.35, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.6, y: 0.35, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.45, y: 0.48, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.55, y: 0.48, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.42, y: 0.62, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.58, y: 0.62, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.9 };
    return landmarks;
  }

  function reachPose(side: 'left' | 'right'): NormalizedLandmark[] {
    const landmarks = restPose();
    if (side === 'left') {
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.17, y: 0.35, z: 0, visibility: 0.95 };
    } else {
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.83, y: 0.35, z: 0, visibility: 0.95 };
    }
    return landmarks;
  }

  function enterAnswer(coordinator: BeatRunCoordinator): void {
    coordinator.startRound();
    for (let i = 0; i < 8; i++) {
      coordinator.update(0.1);
      coordinator.recordStep('run');
      coordinator.update(0.4);
    }
    expect(coordinator.phase).toBe('ANSWER_SELECT');
    expect(coordinator.isAnswerOpen).toBe(true);
  }

  function confirmPose(selector: ArmReachAnswerSelector, side: 'left' | 'right'): void {
    selector.updateDelta(0.05, restPose());
    const result = selector.updateDelta(0.05, reachPose(side));
    expect(result).not.toBeNull();
    expect(selector.isConfirmed).toBe(true);
    expect(selector.confirmedChoiceIndex).toBe(side === 'left' ? 0 : 1);
  }

  it('창이 열린 뒤 진입 전에 확정된 좌/우 답은 각각 1회만 소비되고 타임아웃되지 않는다', () => {
    for (const side of ['left', 'right'] as const) {
      const onAnswerSelected = vi.fn();
      const onPhaseChange = vi.fn();
      const onTimeout = vi.fn();
      const onAnswerConfirmed = vi.fn();
      const selector = new ArmReachAnswerSelector({ isMirrored: false });
      const coordinator = new BeatRunCoordinator({
        battle: new BattleState(),
        routineMode: 'arm_reach',
        armReachAnswerSelector: selector,
        onAnswerSelected,
        onPhaseChange,
        onTimeout,
        onAnswerConfirmed,
      });
      enterAnswer(coordinator);
      confirmPose(selector, side);

      coordinator.update(0.05, reachPose(side));
      coordinator.update(0.05, reachPose(side));

      expect(onAnswerSelected).toHaveBeenCalledTimes(1);
      expect(onAnswerSelected).toHaveBeenCalledWith(side === 'left' ? 0 : 1);
      expect(onPhaseChange.mock.calls.filter((call) => call[0] === 'STAR_COLLECT' || call[0] === 'HAZARD_EVADE')).toHaveLength(1);
      expect(coordinator.phase === 'STAR_COLLECT' || coordinator.phase === 'HAZARD_EVADE').toBe(true);
      expect(onTimeout).not.toHaveBeenCalled();
      expect(coordinator.isTimedOut).toBe(false);
      expect(coordinator.selectedChoiceIndex).toBe(side === 'left' ? 0 : 1);

      coordinator.update(4);
      expect(onAnswerConfirmed).toHaveBeenCalledTimes(1);
      expect(coordinator.roundResolveCount).toBe(1);
    }
  });

  it('후보 포즈만으로는 소비되지 않고, 유효 뻗기 검증이 update 중에 확정되면 1회만 소비된다', () => {
    const onAnswerSelected = vi.fn();
    const onTimeout = vi.fn();
    const selector = new ArmReachAnswerSelector({ isMirrored: false });
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      armReachAnswerSelector: selector,
      onAnswerSelected,
      onTimeout,
    });
    enterAnswer(coordinator);

    coordinator.update(0.05, restPose());
    expect(selector.isConfirmed).toBe(false);
    expect(onAnswerSelected).not.toHaveBeenCalled();
    expect(coordinator.phase).toBe('ANSWER_SELECT');

    coordinator.update(0.05, reachPose('left'));
    coordinator.update(0.05, reachPose('left'));

    expect(selector.isConfirmed).toBe(true);
    expect(onAnswerSelected).toHaveBeenCalledTimes(1);
    expect(onAnswerSelected).toHaveBeenCalledWith(0);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(coordinator.isTimedOut).toBe(false);
  });

  it('경과가 2박과 정확히 같으면 입력이 타임아웃보다 우선하고, 2박+epsilon 미선택은 타임아웃 1회다', () => {
    const onTimeout = vi.fn();
    const onAnswerSelected = vi.fn();
    const selector = new ArmReachAnswerSelector({ isMirrored: false });
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      armReachAnswerSelector: selector,
      onTimeout,
      onAnswerSelected,
    });
    enterAnswer(coordinator);
    coordinator.update(MAX_ANSWER - 0.1, restPose());
    confirmPose(selector, 'right');

    coordinator.update(0.1, reachPose('right'));

    expect(onAnswerSelected).toHaveBeenCalledTimes(1);
    expect(onAnswerSelected).toHaveBeenCalledWith(1);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(coordinator.isTimedOut).toBe(false);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerSelectBeats).toBe(2);

    const lateTimeout = vi.fn();
    const lateSelector = new ArmReachAnswerSelector({ isMirrored: false });
    const late = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      armReachAnswerSelector: lateSelector,
      onTimeout: lateTimeout,
    });
    enterAnswer(late);
    late.update(MAX_ANSWER + 1e-6);
    expect(lateTimeout).toHaveBeenCalledTimes(1);
    expect(late.isTimedOut).toBe(true);
    expect(late.phase).toBe('HAZARD_EVADE');

    confirmPose(lateSelector, 'left');
    late.update(0.05, reachPose('left'));
    expect(late.selectedChoiceIndex).toBeNull();
    expect(lateTimeout).toHaveBeenCalledTimes(1);
    expect(late.phase).toBe('HAZARD_EVADE');
  });

  it('pause 중 모션/폴백과 창이 닫힌 뒤의 늦은 확정은 소비되지 않는다', () => {
    const onAnswerSelected = vi.fn();
    const onTimeout = vi.fn();
    const selector = new ArmReachAnswerSelector({ isMirrored: false });
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      armReachAnswerSelector: selector,
      onAnswerSelected,
      onTimeout,
    });
    enterAnswer(coordinator);
    coordinator.pause();
    confirmPose(selector, 'left');
    coordinator.update(0.05, reachPose('left'));
    coordinator.confirmAnswerByFallback(0);
    expect(onAnswerSelected).not.toHaveBeenCalled();
    expect(coordinator.selectedChoiceIndex).toBeNull();
    expect(coordinator.phase).toBe('ANSWER_SELECT');

    coordinator.resume();
    coordinator.update(0.05, reachPose('left'));
    expect(onAnswerSelected).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('모션 확정 뒤 키보드 중복과 반복 update는 콜백/분기/정산을 1회만 일으키고 타임아웃하지 않는다', () => {
    const onAnswerSelected = vi.fn();
    const onPhaseChange = vi.fn();
    const onTimeout = vi.fn();
    const onAnswerConfirmed = vi.fn();
    const selector = new ArmReachAnswerSelector({ isMirrored: false });
    const battle = new BattleState();
    const hp = battle.hp;
    const coordinator = new BeatRunCoordinator({
      battle,
      routineMode: 'arm_reach',
      armReachAnswerSelector: selector,
      onAnswerSelected,
      onPhaseChange,
      onTimeout,
      onAnswerConfirmed,
    });
    enterAnswer(coordinator);
    confirmPose(selector, 'left');

    coordinator.update(0.05, reachPose('left'));
    coordinator.confirmAnswerByFallback(1);
    selector.fromKeyboard('2');
    coordinator.update(0.05, reachPose('right'));
    coordinator.update(4);

    expect(onAnswerSelected).toHaveBeenCalledTimes(1);
    expect(onPhaseChange.mock.calls.filter((call) => call[0] === 'STAR_COLLECT' || call[0] === 'HAZARD_EVADE')).toHaveLength(1);
    expect(onAnswerConfirmed).toHaveBeenCalledTimes(1);
    expect(coordinator.roundResolveCount).toBe(1);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(coordinator.isTimedOut).toBe(false);
    expect(battle.hp).toBe(hp);
  });
});
