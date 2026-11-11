/**
 * assault-loop-running-routing.test.ts - ASSAULT-LOOP-11 (#704)
 *
 * 러닝 8박 전용 실측 동작·폴백 소유권 Core 전달 및 legacy 격리 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultInputRouter,
  type AssaultInputClock,
  type AssaultInputRoundTarget,
  type AssaultInputRouterDependencies,
} from '../../src/core/bootstrap/AssaultInputRouter.js';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import { SceneMotionCoordinator } from '../../src/core/director/SceneMotionCoordinator.js';
import { AssaultExerciseTally } from '../../src/game/assault/AssaultExerciseTally.js';
import type { MainSceneContext } from '../../src/core/SceneDirector.js';

describe('Assault Loop Running Routing [ASSAULT-LOOP-11 / #704]', () => {
  let exerciseTally: AssaultExerciseTally;
  let mockClock: AssaultInputClock;
  let mockRound: AssaultInputRoundTarget & { currentLoopSegment?: { kind: string } | null };
  let deps: AssaultInputRouterDependencies;
  let router: AssaultInputRouter;

  beforeEach(() => {
    exerciseTally = new AssaultExerciseTally();
    mockClock = {
      activeSeconds: 2.0,
      isFrozen: false,
      isPaused: false,
      isTrackingLost: false,
      normalizeInput: (raw: any) => ({
        accepted: true,
        activeTimestampSeconds: raw.timestampMs ? raw.timestampMs / 1000 : 2.0,
        inputId: raw.inputId ?? `norm_${raw.timestampMs}`,
      }),
    };

    mockRound = {
      roundId: 'round_01',
      isCompleted: false,
      isPaused: false,
      currentLoopSegment: { kind: 'run_question' },
      pause: vi.fn(),
      resume: vi.fn(),
      submitPunch: vi.fn(),
      submitSquat: vi.fn(),
    };

    deps = {
      getRawSession: () => ({
        exerciseTally,
        clock: mockClock,
        activeRoundController: mockRound,
      }),
      getClock: () => mockClock,
      getActiveRound: () => mockRound,
      getExerciseTally: () => exerciseTally,
      onPunchImpact: vi.fn(),
      isDisposed: () => false,
      getSessionId: () => 'sess_test',
    };

    router = new AssaultInputRouter(deps);
  });

  describe('1. AssaultInputRouter: Physical Running Step (stepped) Routing', () => {
    it('run_question 구간에서는 실측 stepped 입력이 exerciseTally.recordRunStep으로 정상 기록된다', () => {
      mockRound.currentLoopSegment = { kind: 'run_question' };

      const handled = router.handleStep(true, {
        timestampMs: 1500,
        activeSeconds: 1.5,
        inputId: 'step_test_1',
      });

      expect(handled).toBe(true);
      const summary = exerciseTally.getLoopExerciseSummary();
      expect(summary.runStepCount).toBe(1);
    });

    it('run_question이 아닌 구간(answer, squat, rest)에서는 stepped 입력이 기록되지 않는다', () => {
      // answer 구간
      mockRound.currentLoopSegment = { kind: 'answer' };
      expect(router.handleStep(true, { inputId: 'step_ans_1' })).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);

      // squat 구간
      mockRound.currentLoopSegment = { kind: 'squat' };
      expect(router.handleStep(true, { inputId: 'step_sq_1' })).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);

      // rest 구간
      mockRound.currentLoopSegment = { kind: 'rest' };
      expect(router.handleStep(true, { inputId: 'step_rest_1' })).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);
    });

    it('동일 inputId의 중복 러닝 스텝은 중복 집계되지 않는다', () => {
      mockRound.currentLoopSegment = { kind: 'run_question' };

      const first = router.handleStep(true, { inputId: 'duplicate_step_id' });
      const second = router.handleStep(true, { inputId: 'duplicate_step_id' });

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(1);
    });

    it('일시정지(pause) 또는 추적 손실(trackingLost) 상태에서는 가짜 걸음이 집계되지 않는다', () => {
      mockRound.currentLoopSegment = { kind: 'run_question' };

      // 1. clock frozen
      (mockClock as any).isFrozen = true;
      expect(router.handleStep(true, { inputId: 'frozen_step' })).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);

      // 2. clock tracking lost
      (mockClock as any).isFrozen = false;
      (mockClock as any).isTrackingLost = true;
      expect(router.handleStep(true, { inputId: 'tracking_lost_step' })).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);

      // 3. round paused
      (mockClock as any).isTrackingLost = false;
      (mockRound as any).isPaused = true;
      expect(router.handleStep(true, { inputId: 'round_paused_step' })).toBe(false);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);
    });
  });

  describe('2. AssaultInputRouter: Fallback Input Ownership during run_question', () => {
    it('run_question 구간에서는 좌/우 punch 폴백이 답안 제출이 아닌 runStep으로 변환되어 집계된다', () => {
      mockRound.currentLoopSegment = { kind: 'run_question' };

      router.dispatchFallbackEvent(
        {
          action: 'left_punch',
          timestampMs: 1200,
        },
        'keyboard',
      );

      // 펀치로 소비되지 않아야 함
      expect(mockRound.submitPunch).not.toHaveBeenCalled();
      expect(deps.onPunchImpact).not.toHaveBeenCalled();

      // runStep으로 기록되어야 함
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(1);
    });

    it('run_question 구간에서 right_punch 폴백도 runStep으로 변환된다', () => {
      mockRound.currentLoopSegment = { kind: 'run_question' };

      router.dispatchFallbackEvent(
        {
          action: 'right_punch',
          timestampMs: 1600,
        },
        'touch',
      );

      expect(mockRound.submitPunch).not.toHaveBeenCalled();
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(1);
    });

    it('answer 구간에서는 punch 폴백이 기존대로 submitPunch(답안 선택)으로 소비된다', () => {
      mockRound.currentLoopSegment = { kind: 'answer' };

      router.dispatchFallbackEvent(
        {
          action: 'left_punch',
          timestampMs: 2500,
        },
        'keyboard',
      );

      expect(mockRound.submitPunch).toHaveBeenCalledWith('left', expect.any(Number), expect.any(Object));
      // 러닝 스텝은 증가하지 않음
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);
    });

    it('run_question 구간에서 squat 폴백은 러닝 스텝으로 변환되지 않는다', () => {
      mockRound.currentLoopSegment = { kind: 'run_question' };

      router.dispatchFallbackEvent(
        {
          action: 'squat',
          timestampMs: 1800,
        },
        'keyboard',
      );

      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(0);
    });
  });

  describe('3. SceneMotionCoordinator: Stepped Routing & Legacy Running Isolation', () => {
    let coordinator: SceneMotionCoordinator;
    let mockCtx: MainSceneContext;

    beforeEach(() => {
      coordinator = new SceneMotionCoordinator();
      mockCtx = {
        canvasManager: { virtualWidth: 1080, virtualHeight: 2160 },
        cameraLayer: { isActive: false, videoElement: null },
        poseManager: {
          hasPose: true,
          virtualLandmarks: Array.from({ length: 33 }, () => ({ x: 540, y: 1080, z: 0, visibility: 0.9 })),
        },
        skeletonAnimation: {
          smoothedLandmarks: Array.from({ length: 33 }, () => ({ x: 540, y: 1080, z: 0, visibility: 0.9 })),
          breathScale: 1.0,
          update: vi.fn(),
        },
        state: {
          screenMode: 'game',
          gamePhase: 'running',
          totalSteps: 0,
        },
        beatCoordinator: {
          recordStep: vi.fn(),
        },
        runningMatRenderer: {
          triggerMotionHit: vi.fn(),
        },
        effectManager: {
          playBurst: vi.fn(),
        },
        runDetector: {
          update: vi.fn().mockReturnValue(true), // stepped = true
        },
        jumpDetector: {
          update: vi.fn().mockReturnValue(false),
        },
      } as unknown as MainSceneContext;
    });

    it('assault 모드일 때는 stepped가 발생해도 legacy totalSteps나 beatCoordinator가 전혀 소비되지 않는다 (0회)', () => {
      const mockAssaultHandler = {
        handlePose: vi.fn(),
        handleStep: vi.fn(),
        isAssaultMode: vi.fn().mockReturnValue(true),
      };

      coordinator.process(0.016, mockCtx, {
        isAssaultMode: true,
        assaultHandler: mockAssaultHandler,
      });

      // legacy running 소비 0회
      expect(mockCtx.state.totalSteps).toBe(0);
      expect(mockCtx.beatCoordinator.recordStep).not.toHaveBeenCalled();
      expect(mockCtx.runningMatRenderer?.triggerMotionHit).not.toHaveBeenCalled();

      // assaultHandler로 stepped 전달 확인
      expect(mockAssaultHandler.handleStep).toHaveBeenCalledWith(true, mockCtx, 0.016);
    });

    it('non-assault 러닝 씬에서는 stepped가 기존 legacy totalSteps 및 beatCoordinator를 정상 갱신한다', () => {
      coordinator.process(0.016, mockCtx, {
        isAssaultMode: false,
      });

      expect(mockCtx.state.totalSteps).toBe(1);
      expect(mockCtx.beatCoordinator.recordStep).toHaveBeenCalled();
    });
  });

  describe('4. AssaultSceneHandler: exerciseTally.syncWithClock & handleStep', () => {
    let handler: AssaultSceneHandler;
    let mockSession: any;
    let mockCtx: MainSceneContext;

    beforeEach(() => {
      handler = new AssaultSceneHandler();
      mockSession = {
        isDisposed: false,
        clock: {
          activeSeconds: 4.8,
          isPaused: false,
          setPaused: vi.fn(),
          update: vi.fn(),
        },
        exerciseTally: new AssaultExerciseTally(),
        activeRoundController: {
          currentLoopSegment: { kind: 'run_question' },
        },
        update: vi.fn(),
      };

      mockCtx = {
        assaultSession: mockSession,
        state: { screenMode: 'game' },
      } as unknown as MainSceneContext;
    });

    it('AssaultSceneHandler.update는 활성 세션의 exerciseTally.syncWithClock을 호출하여 활성 시간을 동기화한다', () => {
      handler.update(0.016, mockCtx);

      const summary = mockSession.exerciseTally.getSummary();
      expect(summary.activeDurationSeconds).toBeCloseTo(4.8, 2);
    });

    it('AssaultSceneHandler.handleStep은 세션 및 inputRouter로 stepped를 정상 전달한다', () => {
      handler.setInputRouter(router);

      const result = handler.handleStep(true, mockCtx, 0.016);
      expect(result).toBe(true);
      expect(exerciseTally.getLoopExerciseSummary().runStepCount).toBe(1);
    });
  });
});
