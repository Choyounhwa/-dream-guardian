import { describe, it, expect, vi } from 'vitest';
import { PHASE_INTENT_OWNERSHIP } from '../../config/judgment.config.js';
import { MotionIntentBus } from '../../src/motion/MotionIntentBus.js';
import { AssaultFinaleController } from '../../src/game/assault/AssaultFinaleController.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import type { AssaultJumpResult } from '../../src/motion/AssaultJumpAdapter.js';
import type { MotionIntent } from '../../src/types/motion-intent.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';

/**
 * [BUG-ASSAULT-007 / Issue #675]
 * 결전 저충격 점프 필드 불일치 및 ASSAULT_FINALE 동작 소유권 누락 검증 테스트
 *
 * DOC-14 §8.3, §10.2, §15.1-A2:
 * 1. AssaultJumpResult의 motionKind === 'low_impact'를 통해 저충격 점프를 식별하고,
 *    AssaultSessionWireHelper 및 AssaultFinaleController에서 isLowImpact와 motionKind를 보존/전달해야 한다.
 * 2. PHASE_INTENT_OWNERSHIP에 ASSAULT_FINALE 페이즈가 등록되어야 하며,
 *    소유 동작은 ['reachLeft', 'reachRight', 'squat', 'jump']만 허용하고 stepLeft, stepRight 등은 원천 차단해야 한다.
 */
describe('[BUG-ASSAULT-007 / Issue #675] 결전 저충격 점프 및 ASSAULT_FINALE 동작 소유권 검증', () => {
  const sampleQuestion = {
    level: 1,
    subLevel: 1,
    questionText: '2 + 3 = ?',
    correctAnswer: 5,
    wrongAnswer: 6,
    choices: [5, 6],
  };

  describe('1. PHASE_INTENT_OWNERSHIP 및 MotionIntentBus ASSAULT_FINALE 소유권 검증', () => {
    it('PHASE_INTENT_OWNERSHIP에 ASSAULT_FINALE 항목이 정의되어 있어야 한다', () => {
      expect(PHASE_INTENT_OWNERSHIP['ASSAULT_FINALE']).toBeDefined();
    });

    it('ASSAULT_FINALE 소유 동작은 reachLeft, reachRight, squat, jump만 허용해야 한다 (DOC-14 §15.1-A2)', () => {
      expect(PHASE_INTENT_OWNERSHIP['ASSAULT_FINALE']).toEqual([
        'reachLeft',
        'reachRight',
        'squat',
        'jump',
      ]);
    });

    it('기존 페이즈 동작 소유권 설정은 일체 불변이어야 한다 (회귀 방지)', () => {
      expect(PHASE_INTENT_OWNERSHIP['ANSWER_SELECT']).toEqual(['reachLeft', 'reachRight']);
      expect(PHASE_INTENT_OWNERSHIP['HAZARD_EVADE']).toEqual(['jump', 'stepLeft', 'stepRight']);
      expect(PHASE_INTENT_OWNERSHIP['STAR_COLLECT']).toEqual(['reachLeft', 'reachRight', 'jump']);
      expect(PHASE_INTENT_OWNERSHIP['BOSS_CLIMAX']).toEqual(['jump', 'stepLeft', 'stepRight']);
      expect(PHASE_INTENT_OWNERSHIP['ASSAULT_ROUND']).toEqual([
        'reachLeft',
        'reachRight',
        'squat',
      ]);
      expect(PHASE_INTENT_OWNERSHIP['default']).toEqual([
        'reachLeft',
        'reachRight',
        'jump',
        'stepLeft',
        'stepRight',
        'squat',
      ]);
    });

    it('MotionIntentBus가 ASSAULT_FINALE 페이즈일 때 허용된 동작만 통과시키고 stepLeft/stepRight는 차단해야 한다', () => {
      const bus = new MotionIntentBus();
      bus.setPhase('ASSAULT_FINALE');

      expect(bus.isIntentAllowedInPhase('reachLeft', 'ASSAULT_FINALE')).toBe(true);
      expect(bus.isIntentAllowedInPhase('reachRight', 'ASSAULT_FINALE')).toBe(true);
      expect(bus.isIntentAllowedInPhase('squat', 'ASSAULT_FINALE')).toBe(true);
      expect(bus.isIntentAllowedInPhase('jump', 'ASSAULT_FINALE')).toBe(true);

      // 결전에서 허용되지 않는 비소유 intent
      expect(bus.isIntentAllowedInPhase('stepLeft', 'ASSAULT_FINALE')).toBe(false);
      expect(bus.isIntentAllowedInPhase('stepRight', 'ASSAULT_FINALE')).toBe(false);

      const makeIntent = (type: MotionIntent['type'], timestamp = 1000): MotionIntent => ({
        type,
        confidence: 0.9,
        timestamp,
        sourceCursor: 'body',
      });

      const resStepLeft = bus.publish(makeIntent('stepLeft', 1000));
      expect(resStepLeft).toBe(false);

      const resStepRight = bus.publish(makeIntent('stepRight', 2000));
      expect(resStepRight).toBe(false);

      const resJump = bus.publish(makeIntent('jump', 3000));
      expect(resJump).toBe(true);
    });
  });

  describe('2. AssaultFinaleController.handleJump 저충격(motionKind: low_impact) 수락 검증', () => {
    it('motionKind: "low_impact"를 가진 점프 입력을 저충격(isLowImpact: true)으로 판별하고 점프 조우를 회피 처리해야 한다', () => {
      const finale = new AssaultFinaleController({
        sessionId: 'test_session',
        playerHp: 100,
        bossHp: 20,
        rulesVersion: 'v0.3',
        timingProfileId: 'assault_finale_v1',
      });

      // 점프 조우 유효창 시간으로 이동 (DEFAULT_FINALE_PATTERN 기준: 8.0s ~ 9.5s)
      finale.update(8500, 8.5);
      const snapshot = finale.getSnapshot();
      expect(snapshot.currentEncounter?.kind).toBe('jump');

      // isJumping이 false이고 posture도 jumping이 아닌 저충격(heel_raise) 결과
      const jumpInput: AssaultJumpResult = {
        posture: 'transition',
        isJumping: false,
        isStanding: false,
        landGeneration: 1,
        jumpGeneration: 1,
        isValid: true,
        motionKind: 'low_impact',
        timestampMs: 8500,
        deltaY: 0.04,
        normalizedCurrentY: 0.5,
        normalizedBaselineY: 0.54,
      };

      const result = finale.handleJump({
        ...jumpInput,
        activeSeconds: 8.5,
      } as any);

      expect(result.accepted).toBe(true);
      expect(result.reason).toBe('SUCCESS');
      expect(result.encounterKind).toBe('jump');
    });

    it('handleJump 호출 시 motionKind가 motionInput에 보존되어야 한다', () => {
      const finale = new AssaultFinaleController({
        sessionId: 'test_session',
        playerHp: 100,
        bossHp: 20,
        rulesVersion: 'v0.3',
        timingProfileId: 'assault_finale_v1',
      });

      const spyHandleMotionInput = vi.spyOn(finale, 'handleMotionInput');

      finale.handleJump({
        isJumping: false,
        motionKind: 'low_impact',
        posture: 'transition',
        timestampMs: 1200,
      } as any);

      expect(spyHandleMotionInput).toHaveBeenCalledTimes(1);
      const passedInput = spyHandleMotionInput.mock.calls[0][0];
      expect(passedInput.kind).toBe('jump');
      expect((passedInput as any).isLowImpact).toBe(true);
      expect((passedInput as any).motionKind).toBe('low_impact');
    });
  });

  describe('3. AssaultSessionWireHelper 저충격 점프(motionKind: low_impact) 전달 검증', () => {
    it('jumpResult.motionKind === "low_impact"이고 isJumping === false일 때도 finale.handleJump로 정상 전달되어야 한다', () => {
      const mockHost: any = {
        battle: new BattleState(100),
        boss: new BossController(1, { initialHp: 100 }),
        speech: { speak: vi.fn(), cancel: vi.fn() },
        sfx: { play: vi.fn() },
        sessionLifecycle: {
          getActiveAssaultSessionToken: vi.fn(() => null),
          setActiveAssaultSessionToken: vi.fn(),
          clearActiveAssaultSessionToken: vi.fn(),
          setTestSession: vi.fn(),
        },
        sessionContext: {
          sessionMode: 'normal',
          setMode: vi.fn(),
        },
        motionIntentBus: {
          setPhase: vi.fn(),
        },
        questionBank: {
          getQuestions: () => [sampleQuestion],
          currentLevel: 1,
        },
        currentChapter: 1,
      };

      const helper = new AssaultSessionWireHelper(mockHost);
      const session = helper.assembleAssaultSession({
        mode: 'boss_assault' as any,
        questions: [sampleQuestion],
        pattern: DEFAULT_APPROACH_PATTERN,
        bpm: 120,
      });

      // 결전 진입
      session.startFinale?.({
        sessionId: session.sessionId,
        mode: 'boss_assault',
        rulesVersion: 'v0.3',
        finalHp: 80,
        targetRounds: 10,
        completedRounds: 10,
        stats: {
          totalCompletedQuestions: 10,
          totalCorrectHits: 10,
          totalWrongHits: 0,
          totalTimeoutHits: 0,
          totalEvadeSuccessCount: 2,
          totalSquatFailCount: 0,
          totalEncounters: 12,
          totalAttemptedAnswerHits: 10,
          ratingCounts: { Perfect: 10, Good: 0, Late: 0, Miss: 0 },
          maxCombo: 10,
          totalPlayerDamage: 0,
          totalBossDamage: 80,
          totalActualDamage: 0,
          totalRequestedDamage: 0,
          totalActiveDurationSeconds: 60,
          processedRoundIds: [],
        },
        timestampMs: 60000,
      });

      const finale = session.finaleController;
      expect(finale).toBeDefined();

      const jumpAdapter = (session as any).jumpAdapter;
      expect(jumpAdapter).toBeDefined();

      // jumpAdapter.update가 low_impact이지만 isJumping은 false인 결과를 반환하도록 mock
      const mockJumpResult: AssaultJumpResult = {
        posture: 'transition',
        isJumping: false, // isJumping이 false여도
        motionKind: 'low_impact', // motionKind가 low_impact이면
        isValid: true,
        landGeneration: 1,
        jumpGeneration: 1,
        timestampMs: 8500,
        deltaY: 0.04,
        normalizedCurrentY: 0.5,
        normalizedBaselineY: 0.54,
        isStanding: false,
      };
      vi.spyOn(jumpAdapter, 'update').mockReturnValue(mockJumpResult);

      const spyHandleJump = vi.spyOn(finale as any, 'handleJump');

      // 랜드마크 입력 시뮬레이션: pose 랜드마크는 wrist visibility >= 0.5 충족하도록 설정
      const fakeLandmarks: any[] = new Array(33).fill(null).map(() => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));

      (session as any).handlePose(fakeLandmarks, fakeLandmarks, 0.016);

      expect(jumpAdapter.update).toHaveBeenCalledTimes(1);
      expect(spyHandleJump).toHaveBeenCalledTimes(1);
      expect(spyHandleJump).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowImpact: true,
          motionKind: 'low_impact',
        })
      );
    });
  });
});
