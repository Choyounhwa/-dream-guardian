import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BattleState } from '../../src/game/BattleState.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import { DEFAULT_DIFFICULTY_BEAT_PROFILE, DEFAULT_LOOP_PATTERN } from '../../config/beat-motion.config.js';
import { DEFAULT_ARM_DIRECTION_ANSWER_CONFIG } from '../../config/judgment.config.js';

describe('BeatRunCoordinator Unit Tests (Issue #309 / FEAT-ANSWER-GRACE-001)', () => {
  let battle: BattleState;

  beforeEach(() => {
    battle = new BattleState();
  });

  describe('1. 기본 2박 창 및 readyBeats 규격 (Issue #287, #309가 max-2 timeout을 primary-2+extension-2로 교체)', () => {
    it('기본 BeatRunCoordinator 생성 시 readyBeats가 4박이고, DEFAULT_LOOP_PATTERN.readyBeats와 일치한다', () => {
      const coordinator = new BeatRunCoordinator({ battle });
      expect(coordinator.readyBeats).toBe(4);
      expect(DEFAULT_LOOP_PATTERN.readyBeats).toBe(4);
    });

    it('8박 러닝 완료 후 ANSWER_SELECT 진입 시 primary 2박(1.0초 @ BPM 120) 동안 입력창이 유지된다', () => {
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
    // #309: 구 max-2 timeout(1.0s)을 primary 2박 + 연장 1회(총 4박)로 교체. 테스트는 삭제하지 않고 기대만 변경.
    it('미응답 4박(2.0초)에서 onTimeout이 1회 호출되고 HAZARD_EVADE로 전이된다. 2박에서는 연장만 한다', () => {
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

      // #309: 2박은 연장이지 timeout이 아니다
      coordinator.update(1.0);
      expect(onTimeout).not.toHaveBeenCalled();
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isTimedOut).toBe(false);

      // 추가 2박(총 4박)에서 timeout 1회
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
      // #309: timeout은 4박(primary 2 + extension 2)에서 1회
      coordinator.update(2.0);
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
  // #309: 구 max-2(answerSelectBeats) timeout을 primary+extension 상한 4박으로 교체. 테스트는 유지하고 경계만 이동.
  const MAX_ANSWER = DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerMaxBeats * SPB;

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

  it('경과가 4박과 정확히 같으면 입력이 타임아웃보다 우선하고, 4박+epsilon 미선택은 타임아웃 1회다', () => {
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

describe('[FEAT-ANSWER-GRACE-001 / #309] 기본 2박 · 미응답 추가 2박 · 읽기 전용 시간 계약', () => {
  const EPS = 1e-6;

  function seconds(beats: number, bpm: number): number {
    return beats * (60 / bpm);
  }

  function enterAnswer(coordinator: BeatRunCoordinator, bpm = 120): void {
    coordinator.rhythmEngine.setBpm(bpm);
    coordinator.startRound();
    const slot = coordinator.rhythmEngine.secondsPerBeat;
    for (let i = 0; i < 8; i++) {
      coordinator.update(slot * 0.2);
      coordinator.recordStep('run');
      coordinator.update(slot * 0.8);
    }
    expect(coordinator.phase).toBe('ANSWER_SELECT');
  }

  function reachPose(direction: 'left' | 'right'): NormalizedLandmark[] {
    const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
    pose[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.58, y: 0.4, z: 0, visibility: 1 };
    pose[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.42, y: 0.4, z: 0, visibility: 1 };
    const wristX = direction === 'left' ? 0.9 : 0.1;
    const wrist = direction === 'left' ? POSE_LANDMARKS.LEFT_WRIST : POSE_LANDMARKS.RIGHT_WRIST;
    pose[wrist] = { x: wristX, y: 0.4, z: 0, visibility: 1 };
    return pose;
  }

  it('정책 필드는 primary 2, extension 2, max 4이고 answerSelectBeats는 primary 별칭 2를 유지한다', () => {
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerPrimaryBeats).toBe(2);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerExtensionBeats).toBe(2);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerMaxBeats).toBe(4);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerSelectBeats).toBe(2);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerSelectBeats).toBe(
      DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerPrimaryBeats,
    );
  });

  it('미응답 2박은 같은 창의 연장만 하고 timeout·새 문제·selector 재오픈을 하지 않는다', () => {
    const onTimeout = vi.fn();
    const selector = new ArmReachAnswerSelector({ isMirrored: false });
    const openWindow = vi.spyOn(selector, 'openWindow');
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      armReachAnswerSelector: selector,
      onTimeout,
    });
    enterAnswer(coordinator);
    const questions = coordinator.questionGeneratedCount;
    const opensAtEntry = openWindow.mock.calls.length;

    coordinator.update(seconds(2, 120) - 0.01);
    expect(coordinator.getAnswerSnapshot().phase).toBe('primary');

    coordinator.update(0.01);
    const snap = coordinator.getAnswerSnapshot();
    expect(snap.phase).toBe('extension');
    expect(snap.windowId).toBe(coordinator.questionGeneratedCount);
    expect(coordinator.phase).toBe('ANSWER_SELECT');
    expect(coordinator.isAnswerOpen).toBe(true);
    expect(coordinator.isTimedOut).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(coordinator.questionGeneratedCount).toBe(questions);
    expect(openWindow.mock.calls.length).toBe(opensAtEntry);
    expect((selector as unknown as { _isWindowOpen: boolean })._isWindowOpen).toBe(true);
  });

  it('미응답 4박은 timeout 1회만 내고 wrongAnswerCount·HP를 바꾸지 않은 채 회피 분기로 간다', () => {
    const onTimeout = vi.fn();
    const battle = new BattleState();
    const hp = battle.hp;
    const coordinator = new BeatRunCoordinator({
      battle,
      routineMode: 'arm_reach',
      onTimeout,
    });
    enterAnswer(coordinator);

    coordinator.update(seconds(4, 120));

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(coordinator.isTimedOut).toBe(true);
    expect(coordinator.phase).toBe('HAZARD_EVADE');
    expect(battle.hp).toBe(hp);

    coordinator.update(seconds(8, 120));
    expect(coordinator.phase).toBe('ROUND_RESOLVE');
    expect(coordinator.roundResolveCount).toBe(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(battle.hp).toBe(hp);
    expect(coordinator.getAnswerSnapshot().phase).toBe('closed');
    expect(coordinator.getAnswerSnapshot().inputOpen).toBe(false);

    coordinator.update(seconds(2, 120));
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(coordinator.phase).toBe('ROUND_RESOLVE');
  });

  it('연장은 1회뿐이라 6박 창이 열리지 않는다', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    coordinator.update(seconds(4, 120) + seconds(2, 120));
    expect(coordinator.phase).toBe('HAZARD_EVADE');
    expect(coordinator.isAnswerOpen).toBe(false);
    expect(coordinator.getAnswerSnapshot().maxBeats).toBe(4);
    expect(coordinator.getAnswerSnapshot().elapsedBeats).toBeLessThanOrEqual(4 + EPS);
  });

  it.each([
    ['primary', 0.2],
    ['extension', seconds(2, 120) + 0.05],
  ] as const)('정답 선택은 %s 중 즉시 STAR_COLLECT 8박을 시작한다', (_label, elapsed) => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    coordinator.update(elapsed);
    const correct = coordinator.currentQuestion?.correctIndex ?? 0;
    coordinator.confirmAnswerByFallback(correct);

    expect(coordinator.phase).toBe('STAR_COLLECT');
    const clock = coordinator.getBranchClock();
    expect(clock).not.toBeNull();
    expect(clock!.durationBeats).toBe(8);
    expect(clock!.bpm).toBe(120);
    expect(clock!.elapsed).toBeLessThan(EPS);
    expect(clock!.endElapsed - clock!.startElapsed).toBeCloseTo(seconds(8, 120), 6);
  });

  it.each([
    ['primary', 0.2],
    ['extension', seconds(2, 120) + 0.05],
  ] as const)('오답 선택은 %s 중 즉시 HAZARD_EVADE 8박을 시작한다', (_label, elapsed) => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    coordinator.update(elapsed);
    const wrong = coordinator.currentQuestion?.correctIndex === 0 ? 1 : 0;
    coordinator.confirmAnswerByFallback(wrong);

    expect(coordinator.phase).toBe('HAZARD_EVADE');
    expect(coordinator.getBranchClock()?.durationBeats).toBe(8);
    expect(coordinator.getBranchClock()?.elapsed).toBeLessThan(EPS);
  });

  it('정확히 2박의 입력은 primary로 소비되고 연장을 열지 않는다', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    const correct = coordinator.currentQuestion?.correctIndex ?? 0;
    coordinator.update(seconds(2, 120));
    expect(coordinator.phase).toBe('ANSWER_SELECT');
    coordinator.confirmAnswerByFallback(correct);
    expect(coordinator.phase).toBe('STAR_COLLECT');
    expect(coordinator.isTimedOut).toBe(false);
    expect(coordinator.getAnswerSnapshot().phase).toBe('closed');
  });

  it('정확히 4박의 입력은 timeout보다 우선해 소비된다', () => {
    const onTimeout = vi.fn();
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      onTimeout,
    });
    enterAnswer(coordinator);
    const wrong = coordinator.currentQuestion?.correctIndex === 0 ? 1 : 0;
    coordinator.update(seconds(4, 120) - 1e-6);
    coordinator.confirmAnswerByFallback(wrong);
    coordinator.update(1e-6);
    expect(coordinator.phase).toBe('HAZARD_EVADE');
    expect(coordinator.isTimedOut).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('4박을 넘긴 입력과 닫힌 창의 stale 입력은 거절한다', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    coordinator.update(seconds(4, 120) + 0.01);
    expect(coordinator.phase).toBe('HAZARD_EVADE');
    coordinator.confirmAnswerByFallback(0);
    expect(coordinator.selectedChoiceIndex).toBeNull();
    expect(coordinator.isTimedOut).toBe(true);
  });

  it('pause는 답안 경과·Hold·분기를 멈추고, resume 후 이어서 흐른다', () => {
    const selector = new ArmReachAnswerSelector({ isMirrored: false });
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      armReachAnswerSelector: selector,
    });
    enterAnswer(coordinator);
    coordinator.update(0.4, reachPose('left'));
    coordinator.pause();
    const before = coordinator.getAnswerSnapshot().elapsedBeats;
    coordinator.update(2, reachPose('left'));
    coordinator.confirmAnswerByFallback(0);
    expect(coordinator.getAnswerSnapshot().elapsedBeats).toBeCloseTo(before, 6);
    expect(coordinator.phase).toBe('ANSWER_SELECT');
    expect(coordinator.selectedChoiceIndex).toBeNull();

    coordinator.resume();
    coordinator.update(0.1);
    expect(coordinator.getAnswerSnapshot().elapsedBeats).toBeGreaterThan(before);
  });

  it('dt overshoot는 2박·4박 경계에서 분할되고 나머지 시간만 다음 구간에 들어간다', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    coordinator.update(seconds(2, 120) + 0.2);
    const extended = coordinator.getAnswerSnapshot();
    expect(extended.phase).toBe('extension');
    expect(extended.elapsedBeats).toBeCloseTo(2 + 0.2 / seconds(1, 120), 5);

    coordinator.update(seconds(2, 120) - 0.2 + seconds(1, 120));
    expect(coordinator.phase).toBe('HAZARD_EVADE');
    const clock = coordinator.getBranchClock();
    expect(clock).not.toBeNull();
    expect(clock!.elapsed).toBeCloseTo(seconds(1, 120), 5);
    expect(clock!.durationBeats).toBe(8);
  });

  it('snapshot은 매 호출 새 객체이고 반환값 변경이 코디네이터에 전파되지 않는다', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    const first = coordinator.getAnswerSnapshot();
    const second = coordinator.getAnswerSnapshot();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    const leaked = first as { phase: string; elapsedBeats: number; inputOpen: boolean };
    leaked.phase = 'closed';
    leaked.elapsedBeats = 99;
    leaked.inputOpen = false;
    expect(coordinator.getAnswerSnapshot().phase).toBe('primary');
    expect(coordinator.getAnswerSnapshot().inputOpen).toBe(true);
    expect(coordinator.getAnswerSnapshot().primaryBeats).toBe(2);
    expect(coordinator.getAnswerSnapshot().extensionBeats).toBe(2);
    expect(coordinator.getAnswerSnapshot().maxBeats).toBe(4);
    expect(coordinator.getAnswerSnapshot().remainingBeats).toBeCloseTo(4, 5);
  });

  it.each([110, 120, 140])('BPM %i에서 2박·4박 경계는 beats * 60/bpm ± epsilon이다', (bpm) => {
    const onTimeout = vi.fn();
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
      onTimeout,
    });
    enterAnswer(coordinator, bpm);

    coordinator.update(seconds(2, bpm) - EPS);
    expect(coordinator.getAnswerSnapshot().phase).toBe('primary');
    coordinator.update(EPS);
    expect(coordinator.getAnswerSnapshot().phase).toBe('extension');
    expect(onTimeout).not.toHaveBeenCalled();

    coordinator.update(seconds(2, bpm) - EPS);
    expect(coordinator.phase).toBe('ANSWER_SELECT');
    coordinator.update(EPS);
    expect(coordinator.phase).toBe('HAZARD_EVADE');
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(coordinator.getBranchClock()?.bpm).toBe(bpm);
    expect(coordinator.getBranchClock()?.secondsPerBeat).toBeCloseTo(60 / bpm, 6);
  });

  it('분기 시계 durationBeats는 기본 프로필 branchRoutineBeats(8)를 따른다', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    enterAnswer(coordinator);
    coordinator.confirmAnswerByFallback(coordinator.currentQuestion?.correctIndex ?? 0);

    const clock = coordinator.getBranchClock();
    expect(clock).not.toBeNull();
    expect(coordinator.performanceBeats).toBe(8);
    expect(clock!.durationBeats).toBe(coordinator.performanceBeats);
    expect(clock!.endElapsed - clock!.startElapsed).toBeCloseTo(
      coordinator.performanceBeats * clock!.secondsPerBeat,
      6,
    );
  });

  it('setDifficultyProfile의 branchRoutineBeats가 8이 아니면 분기 시계가 그 길이를 따른다 (#317, BranchClock.durationBeats는 소비처 리터럴 8 때문에 number로 넓히지 않음)', () => {
    const coordinator = new BeatRunCoordinator({
      battle: new BattleState(),
      routineMode: 'arm_reach',
    });
    coordinator.setDifficultyProfile({
      ...DEFAULT_DIFFICULTY_BEAT_PROFILE,
      branchRoutineBeats: 10,
    });
    enterAnswer(coordinator);
    coordinator.confirmAnswerByFallback(coordinator.currentQuestion?.correctIndex ?? 0);

    const clock = coordinator.getBranchClock();
    expect(coordinator.performanceBeats).toBe(10);
    expect(clock!.durationBeats).toBe(10);
    expect(clock!.endElapsed).toBeCloseTo(clock!.startElapsed + 10 * clock!.secondsPerBeat, 6);
  });
});
