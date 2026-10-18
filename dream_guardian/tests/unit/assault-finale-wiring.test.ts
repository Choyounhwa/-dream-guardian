import { describe, it, expect, vi } from 'vitest';
import {
  AssaultSessionFactory,
  type AssaultSession,
} from '../../src/core/AssaultSessionFactory.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import { DEFAULT_FINALE_PATTERN } from '../../src/data/assault/finalePatterns.js';
import { DEFAULT_ASSAULT_FINALE_CONFIG } from '../../config/assault-finale.config.js';
import { AssaultJumpAdapter } from '../../src/motion/AssaultJumpAdapter.js';
import { AssaultFinaleController } from '../../src/game/assault/AssaultFinaleController.js';
import type { AssaultHandoverSnapshot } from '../../src/game/assault/AssaultProgressController.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[BOSS-ASSAULT-30 / #532] AssaultFinale Wiring Unit Tests', () => {
  const sampleQuestions: QuestionCandidate[] = [
    {
      level: 1,
      subLevel: 1,
      questionText: '3 + 5 = ?',
      correctAnswer: 8,
      wrongAnswer: 9,
      choices: [8, 9],
    },
    {
      level: 1,
      subLevel: 2,
      questionText: '4 + 2 = ?',
      correctAnswer: 6,
      wrongAnswer: 7,
      choices: [6, 7],
    },
  ];

  const createTestHandoverSnapshot = (
    overrides?: Partial<AssaultHandoverSnapshot>
  ): AssaultHandoverSnapshot => ({
    sessionId: 'session_test_01',
    mode: 'boss_assault',
    rulesVersion: 'v0.3',
    finalHp: 75,
    targetRounds: 10,
    completedRounds: 10,
    stats: {
      totalCompletedQuestions: 10,
      totalCorrectHits: 9,
      totalWrongHits: 1,
      totalTimeoutHits: 0,
      totalEvadeSuccessCount: 8,
      totalSquatFailCount: 2,
      totalEncounters: 20,
      totalAttemptedAnswerHits: 10,
      ratingCounts: { Perfect: 8, Good: 1, Late: 1, Miss: 0 },
      maxCombo: 8,
      totalPlayerDamage: 25,
      totalBossDamage: 0,
      totalActualDamage: 25,
      totalRequestedDamage: 25,
      totalActiveDurationSeconds: 120,
      processedRoundIds: ['r1' as any, 'r2' as any],
    },
    timestampMs: 1000,
    ...overrides,
  });

  const createBaseSession = (): { session: AssaultSession; battleState: BattleState; bossController: BossController } => {
    const battleState = new BattleState(100);
    (battleState as any)._hp = 75; // Handover HP
    const bossController = new BossController(10);
    const session = AssaultSessionFactory.createSession({
      sessionId: 'session_test_01',
      battleState,
      bossController,
      speech: { speak: vi.fn() },
      questions: sampleQuestions,
      pattern: DEFAULT_APPROACH_PATTERN,
      bpm: 120,
    });
    return { session, battleState, bossController };
  };

  describe('1. AssaultSessionFactory.startFinale 조립 및 프로필/HP 주입 (#539 계약)', () => {
    it('startFinale 호출 시 #539 계약에 따라 BossController.reset을 호출하여 DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp(20)을 주입해야 한다', () => {
      const { session, bossController } = createBaseSession();
      const resetSpy = vi.spyOn(bossController, 'reset');
      const handoff = createTestHandoverSnapshot();

      const finale = AssaultSessionFactory.startFinale(session, handoff);

      expect(finale).toBeInstanceOf(AssaultFinaleController);
      expect(resetSpy).toHaveBeenCalledWith(undefined, {
        maxHp: DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp,
        initialHp: DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp,
      });
      expect(bossController.hp).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
    });

    it('handoff의 finalHp(75)와 규칙 버전(v0.3), 타이밍 프로필(assault_finale_v1)이 보존되어야 한다', () => {
      const { session } = createBaseSession();
      const handoff = createTestHandoverSnapshot({ finalHp: 80 });

      const finale = AssaultSessionFactory.startFinale(session, handoff);
      const snapshot = finale.getSnapshot();

      expect(snapshot.sessionId).toBe('session_test_01');
      expect(snapshot.playerHp).toBe(80);
      expect(snapshot.bossHp).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
      expect(snapshot.rulesVersion).toBe('v0.3');
      expect(snapshot.timingProfileId).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.profileId);
      expect(snapshot.totalEncounters).toBe(DEFAULT_FINALE_PATTERN.encounters.length);
    });

    it('session 인스턴스의 jumpAdapter가 기본 생성되거나 커스텀 어댑터가 올바르게 주입되어야 한다', () => {
      const { session } = createBaseSession();
      const handoff = createTestHandoverSnapshot();
      const customJumpAdapter = new AssaultJumpAdapter({ jumpThreshold: 0.08 });

      const finale = AssaultSessionFactory.startFinale(session, handoff, {
        jumpAdapter: customJumpAdapter,
      });

      expect(session.jumpAdapter).toBe(customJumpAdapter);
      expect(session.finaleController).toBe(finale);
    });

    it('session.startFinale 메서드를 통해서도 동일하게 결전 컨트롤러가 가동되어야 한다', () => {
      const { session, bossController } = createBaseSession();
      const handoff = createTestHandoverSnapshot();

      expect(typeof session.startFinale).toBe('function');
      const finale = session.startFinale!(handoff);

      expect(finale).toBeInstanceOf(AssaultFinaleController);
      expect(bossController.hp).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.bossInitialHp);
      expect(session.finaleController).toBe(finale);
    });
  });

  describe('2. 원자적 불변식 및 11번째 문제 출제 차단 (A02, A22)', () => {
    it('disposed된 세션에서 startFinale 호출 시 예외를 발생시키고 결전을 시작하지 않아야 한다', () => {
      const { session } = createBaseSession();
      const handoff = createTestHandoverSnapshot();
      session.dispose();

      expect(() => {
        AssaultSessionFactory.startFinale(session, handoff);
      }).toThrow(/disposed/i);
    });

    it('세션 ID가 일치하지 않는 stale handover snapshot은 거부되어야 한다', () => {
      const { session } = createBaseSession();
      const staleHandoff = createTestHandoverSnapshot({ sessionId: 'session_other_99' });

      expect(() => {
        AssaultSessionFactory.startFinale(session, staleHandoff);
      }).toThrow(/mismatch/i);
    });

    it('결전 모드가 활성화된 상태에서 추가 문제(createRoundController) 출제 시도가 차단되어야 한다', () => {
      const { session } = createBaseSession();
      const handoff = createTestHandoverSnapshot();
      AssaultSessionFactory.startFinale(session, handoff);

      expect(() => {
        session.createRoundController('round_11' as any, sampleQuestions[0] as any);
      }).toThrow(/finale.*active/i);
    });
  });
});
