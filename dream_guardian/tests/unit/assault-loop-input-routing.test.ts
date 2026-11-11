/**
 * assault-loop-input-routing.test.ts
 *
 * [ASSAULT-LOOP-10 / #703] 루프 입력 배선 및 휴식 중 회수·직립 관찰 검증 단위 테스트
 *
 * 목적:
 * 휴식 및 러닝 구간에서 공격 입력을 소비하지 않으면서 다음 선택/회피의 물리적 복귀 증거를 계속 유지하고,
 * standing 및 회수 동작이 누락 없이 라운드 컨트롤러로 전달되는지 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultInputRouter,
  type AssaultInputRouterDependencies,
  type AssaultInputClock,
  type AssaultInputRoundTarget,
  type AssaultInputAdapters,
  type AssaultSquatResult,
} from '../../src/core/bootstrap/AssaultInputRouter.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { AssaultFallbackAdapter } from '../../src/input/AssaultFallbackAdapter.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[ASSAULT-LOOP-10 / #703] Loop Input Routing & Rest Observation Tests', () => {
  const sampleQuestion: QuestionCandidate = {
    id: 'q_loop10_01',
    level: 1,
    subLevel: 1,
    type: 'add',
    text: '3 + 4 = ?',
    answer: '7',
    choices: ['7', '8'],
  };

  describe('1. Standing & Retraction Result Delivery via submitSquatResult', () => {
    let mockClock: AssaultInputClock;
    let mockRound: AssaultInputRoundTarget & { submitSquatResult: ReturnType<typeof vi.fn> };
    let mockAdapters: AssaultInputAdapters;
    let deps: AssaultInputRouterDependencies;
    let router: AssaultInputRouter;

    beforeEach(() => {
      mockClock = {
        activeSeconds: 4.5,
        isFrozen: false,
        isFallbackMode: false,
        needsMotionReprep: false,
        primaryPauseReason: null,
        toRoundRelativeSeconds: vi.fn((sec?: number) => (sec !== undefined ? sec : 4.5)),
        setTrackingLost: vi.fn(),
        normalizeInput: vi.fn((raw) => ({
          accepted: true,
          activeTimestampSeconds: 4.5,
          roundRelativeSeconds: 4.5,
          inputId: raw.inputId,
        })),
      };

      mockRound = {
        roundId: 'round_01',
        isCompleted: false,
        isPaused: false,
        pause: vi.fn(),
        resume: vi.fn(),
        submitPunch: vi.fn(),
        submitSquat: vi.fn(),
        submitSquatResult: vi.fn(),
      };

      mockAdapters = {
        squatAdapter: {
          update: vi.fn(),
        },
        punchAdapter: {
          update: vi.fn(),
        },
      };

      deps = {
        getClock: () => mockClock,
        getActiveRound: () => mockRound,
        getFinaleController: () => null,
        getAdapters: () => mockAdapters,
        onPunchImpact: vi.fn(),
        isDisposed: () => false,
        getSessionId: () => 'test_session',
      };

      router = new AssaultInputRouter(deps);
    });

    it('유효한 standing 결과가 activeRound.submitSquatResult로 손실 없이 전달되어야 한다', () => {
      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      const standingResult: AssaultSquatResult & { isStanding: boolean; standGeneration: number; isValid: boolean } = {
        isStanding: true,
        isDucking: false,
        posture: 'standing',
        standGeneration: 2,
        isValid: true,
      };

      (mockAdapters.squatAdapter!.update as any).mockReturnValue(standingResult);

      router.handlePose([], validLandmarks, 16);

      // ducking/guarding 전용 필터에 걸려 standing 결과가 누락되지 않고 전달되어야 함
      expect(mockRound.submitSquatResult).toHaveBeenCalledTimes(1);
      const passedResult = mockRound.submitSquatResult.mock.calls[0][0] as any;
      expect(passedResult.posture).toBe('standing');
      expect(passedResult.isStanding).toBe(true);
      expect(passedResult.standGeneration).toBe(2);
      expect(passedResult.isValid).toBe(true);
      expect(passedResult.timestampMs).toBe(4500); // 4.5s -> 4500ms
    });

    it('activeRound에 submitSquatResult가 없는 레거시 환경에서는 standing 결과로 submitSquat를 호출하지 않는다', () => {
      const legacyRound: AssaultInputRoundTarget = {
        roundId: 'round_legacy',
        isCompleted: false,
        isPaused: false,
        pause: vi.fn(),
        resume: vi.fn(),
        submitPunch: vi.fn(),
        submitSquat: vi.fn(),
        // submitSquatResult는 정의되지 않음
      };

      const legacyDeps: AssaultInputRouterDependencies = {
        ...deps,
        getActiveRound: () => legacyRound,
      };
      const legacyRouter = new AssaultInputRouter(legacyDeps);

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (mockAdapters.squatAdapter!.update as any).mockReturnValue({
        isStanding: true,
        isDucking: false,
        posture: 'standing',
        isValid: true,
      });

      legacyRouter.handlePose([], validLandmarks, 16);

      // 레거시 submitSquat는 ducking/guarding일 때만 호출되어야 하므로 standing에서는 호출되지 않아야 함
      expect(legacyRound.submitSquat).not.toHaveBeenCalled();
    });

    it('레거시 환경에서 ducking/guarding 동작 시에는 submitSquat가 정상 호출된다', () => {
      const legacyRound: AssaultInputRoundTarget = {
        roundId: 'round_legacy',
        isCompleted: false,
        isPaused: false,
        pause: vi.fn(),
        resume: vi.fn(),
        submitPunch: vi.fn(),
        submitSquat: vi.fn(),
      };

      const legacyDeps: AssaultInputRouterDependencies = {
        ...deps,
        getActiveRound: () => legacyRound,
      };
      const legacyRouter = new AssaultInputRouter(legacyDeps);

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (mockAdapters.squatAdapter!.update as any).mockReturnValue({
        isStanding: false,
        isDucking: true,
        posture: 'ducking',
        isValid: true,
      });

      legacyRouter.handlePose([], validLandmarks, 16);

      expect(legacyRound.submitSquat).toHaveBeenCalledWith('ducking', 4500, {
        activeSeconds: 4.5,
      });
    });
  });

  describe('2. Common Clock & Round-Relative Millisecond Alignment', () => {
    it('카메라 squatResult.timestampMs, punch, fallback 모두 공통 clock의 round-relative ms와 일치해야 한다', () => {
      const mockClock: AssaultInputClock = {
        activeSeconds: 5.2,
        toRoundRelativeSeconds: vi.fn(() => 2.2), // 라운드 원점 기준 2.2초
        normalizeInput: vi.fn((raw) => ({
          accepted: true,
          activeTimestampSeconds: 5.2,
          roundRelativeSeconds: 2.2,
          inputId: raw.inputId,
        })),
      };

      const mockRound: AssaultInputRoundTarget & { submitSquatResult: ReturnType<typeof vi.fn> } = {
        roundId: 'round_01',
        isCompleted: false,
        isPaused: false,
        pause: vi.fn(),
        resume: vi.fn(),
        submitPunch: vi.fn(),
        submitSquat: vi.fn(),
        submitSquatResult: vi.fn(),
      };

      const mockAdapters: AssaultInputAdapters = {
        squatAdapter: {
          update: vi.fn(() => ({
            isDucking: true,
            posture: 'ducking',
            isValid: true,
          })),
        },
        punchAdapter: {
          update: vi.fn(() => [
            { hand: 'left' as const, inputId: 'p_left', rawTimestampMs: 12345 },
          ]),
        },
        fallbackAdapter: {
          handleKeyDown: vi.fn(() => ({
            action: 'squat',
            timestampMs: 12345,
          })),
        },
      };

      const router = new AssaultInputRouter({
        getClock: () => mockClock,
        getActiveRound: () => mockRound,
        getFinaleController: () => null,
        getAdapters: () => mockAdapters,
        onPunchImpact: vi.fn(),
        getSessionId: () => 'sess_01',
      });

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));

      // 1) 카메라 프레임 처리
      router.handlePose([], validLandmarks, 16);

      // punch 확인: 2.2초 -> 2200ms
      expect(mockRound.submitPunch).toHaveBeenCalledWith('left', 2200, expect.objectContaining({
        activeSeconds: 2.2,
      }));

      // squatResult 확인: 2.2초 -> 2200ms
      expect(mockRound.submitSquatResult).toHaveBeenCalledWith(
        expect.objectContaining({
          timestampMs: 2200,
          posture: 'ducking',
        }),
        expect.objectContaining({
          activeSeconds: 2.2,
        }),
      );

      // 2) 폴백 키다운 처리
      router.dispatchFallbackEvent({ action: 'squat', timestampMs: 12345 }, 'keyboard');
      expect(mockRound.submitSquat).toHaveBeenCalledWith('ducking', 2200, expect.objectContaining({
        activeSeconds: 2.2,
      }));
    });
  });

  describe('3. Rest / Run Period Observation & Safe Execution', () => {
    function createMockHost(): any {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      return {
        battle,
        boss,
        bossController: boss,
        eventBus: {
          on: vi.fn(),
          emit: vi.fn(),
        } as any,
        gameEngine: {
          bpm: 120,
        } as any,
        sessionLifecycle: {
          setActiveAssaultSessionToken: vi.fn(),
          setTestSession: vi.fn(),
          isValidAssaultToken: vi.fn(() => true),
          activeAssaultSessionToken: 'token_01',
          lastHandoverSnapshot: null,
        } as any,
        sessionContext: {
          mode: 'boss_assault',
          setMode: vi.fn(),
          assaultSession: null as any,
        } as any,
        motionIntentBus: {
          setPhase: vi.fn(),
        } as any,
        sfx: {
          play: vi.fn(),
          stopDwellCharge: vi.fn(),
        } as any,
        speech: {
          speak: vi.fn(),
          speakFeedback: vi.fn(),
        } as any,
      };
    }

    it('휴식(rest) 및 러닝(run_question) 중에도 punch/squat 어댑터 update가 지속 호출된다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const rawSession = (wireHelper as any)._getActiveRawSession();
      const punchUpdateSpy = vi.spyOn(rawSession.punchAdapter, 'update');
      const squatUpdateSpy = vi.spyOn(rawSession.squatAdapter, 'update');

      const validLandmarks = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));

      // 러닝/휴식 구간 관찰 프레임 주입
      (session as any).handlePose?.(validLandmarks, validLandmarks);
      expect(punchUpdateSpy).toHaveBeenCalled();
      expect(squatUpdateSpy).toHaveBeenCalled();
    });

    it('휴식 구간 중 발생한 펀치는 조우를 해결하지 않고, 0 데미지 및 0 임팩트를 유지한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);
      const prevBossHp = host.boss.hp;
      const prevPlayerHp = host.battle.hp;

      // 120 BPM에서 run8은 0~4초, 첫 번째 answer4는 4~6초, rest2는 6~7초
      // 라운드를 휴식 구간(6.5초)으로 전진
      round.update(6.5);

      // 휴식 구간(6.5초)에서 펀치 시도
      round.submitPunch('left', 6500, { activeSeconds: 6.5 });

      expect(host.boss.hp).toBe(prevBossHp);
      expect(host.battle.hp).toBe(prevPlayerHp);
    });

    it('휴식 구간 중 keyup/touchend는 fallbackAdapter에서 관찰되어 키 홀딩을 해제한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const rawSession = (wireHelper as any)._getActiveRawSession();
      const fallbackAdapter = rawSession.fallbackAdapter as AssaultFallbackAdapter;
      expect(fallbackAdapter).toBeDefined();

      // 키 누름
      const keyEventDown = {
        key: '1',
        code: 'Digit1',
        repeat: false,
      } as KeyboardEvent;
      (session as any).handleKeyboard?.(keyEventDown);

      // 동일 키 반복 누름은 차단됨
      const repeatedResult = fallbackAdapter.handleKeyDown({
        key: '1',
        code: 'Digit1',
        repeat: false,
      });
      expect(repeatedResult).toBeNull();

      // 휴식 구간에서 keyup 관찰
      const keyEventUp = {
        key: '1',
        code: 'Digit1',
        repeat: false,
      } as KeyboardEvent;
      (session as any).handleKeyUp?.(keyEventUp);

      // keyup 후 다시 누르면 허용됨 (회수 관찰 증거)
      const freshResult = fallbackAdapter.handleKeyDown({
        key: '1',
        code: 'Digit1',
        repeat: false,
      });
      expect(freshResult).not.toBeNull();
    });
  });

  describe('4. Physical Standing Retraction & Consecutive Squat Evasion Characterization', () => {
    it('휴식 구간 중 전달된 standing 결과가 _squatStandState를 직립으로 갱신하여 다음 스쿼트 회피를 성공시킨다', () => {
      const round = new AssaultRoundController({
        roundId: 'round_squat_test',
        sessionId: 'sess_sq',
        question: sampleQuestion as any,
        bpm: 120,
        throwDurationSeconds: 1.0,
        plan: {
          encounters: [
            {
              id: 'squat_01',
              kind: 'squat',
              startBeat: 0,
              durationBeats: 4,
              interactionProfileId: 'profile_squat_default',
              visualProfileId: 'hazard_sweep_low',
            },
            {
              id: 'squat_02',
              kind: 'squat',
              startBeat: 6,
              durationBeats: 4,
              interactionProfileId: 'profile_squat_default',
              visualProfileId: 'hazard_sweep_low',
            },
          ] as any,
        },
      });

      round.update(5.0);

      // 1. 첫 번째 스쿼트 회피 성공 (activeSeconds = 6.5)
      round.submitSquatResult({
        timestampMs: 6500,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        isValid: true,
        standGeneration: 1,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
      }, { activeSeconds: 6.5 });

      const enc1 = (round as any)._encounters[0];
      expect(enc1.isResolved).toBe(true);
      expect(enc1.squatJudge.state.status).toBe('evaded');

      // 2. 휴식 구간(7.5s, 1번째 마감 7.17s 후 및 2번째 시작 8.0s 전)에서 직립(standing) 복귀 발생
      round.submitSquatResult({
        timestampMs: 7500,
        posture: 'standing',
        isDucking: false,
        isStanding: true,
        isValid: true,
        standGeneration: 2,
        deltaY: 0.0,
        normalizedCurrentY: 0.5,
        normalizedBaselineY: 0.5,
      }, { activeSeconds: 7.5 });

      // 내부 _squatStandState가 직립 및 새 generation으로 갱신되었는지 확인
      const standState = (round as any)._squatStandState;
      expect(standState.hasStoodUpSinceLastEvade).toBe(true);
      expect(standState.currentStandGeneration).toBe(2);

      // 3. 두 번째 스쿼트 구간(8.0s 진입 후 9.5s)에서 새 스쿼트 수행
      round.update(8.0);
      round.submitSquatResult({
        timestampMs: 9500,
        posture: 'ducking',
        isDucking: true,
        isStanding: false,
        isValid: true,
        standGeneration: 2,
        deltaY: 0.2,
        normalizedCurrentY: 0.7,
        normalizedBaselineY: 0.5,
      }, { activeSeconds: 9.5 });

      const enc2 = (round as any)._encounters[1];
      expect(enc2.isResolved).toBe(true);
      expect(enc2.squatJudge.state.status).toBe('evaded');
    });

    it('과거/보정 입력이 휴식 구간에서 발생했더라도 다음 조우로 재귀속되지 않는다', () => {
      const round = new AssaultRoundController({
        roundId: 'round_stale_test',
        sessionId: 'sess_stale',
        question: sampleQuestion as any,
        bpm: 120,
        throwDurationSeconds: 1.0,
        plan: {
          encounters: [
            {
              id: 'pair_1',
              kind: 'answer_pair',
              attackId: 'att_p1',
              startBeat: 0,
              durationBeats: 4,
              targetAnswer: 'left',
            },
          ] as any,
        },
      });

      // 휴식/러닝 구간(2.0s)에서 발생한 과거 펀치 입력
      round.submitPunch('left', 2000, { activeSeconds: 2.0 });

      // 조우 시작 전 시점(3.5s)으로 전진
      round.update(3.5);

      const enc = (round as any)._encounters[0];
      // 조우 시작 전이므로 펀치가 미리 소비되어 조우가 해결되면 안 됨
      expect(enc.isResolved).toBe(false);
      expect(enc.pairJudge.state.status).toBe('pending');
    });
  });
});
