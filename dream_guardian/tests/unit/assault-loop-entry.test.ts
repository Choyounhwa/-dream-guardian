/**
 * assault-loop-entry.test.ts - boss_assault UI 기본 루프 선택·시작·재시작 보존 단위 테스트
 *
 * @see docs/assault-loop/LOOP-12.md (ASSAULT-LOOP-12 / Issue #705)
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 *
 * 검증 항목:
 * 1. resolveAssaultEntryOptions:
 *    - URL/호출자로부터 pattern/loopProfile 미지정 시 DEFAULT_ASSAULT_LOOP_CONFIG 기본 주입.
 *    - 기본 seed(12345), BPM(100) 주입 및 deepFreeze 불변성 보장.
 *    - 명시적 pattern 지정 시 loopProfile 주입 없이 pattern 경로 유지 (레거시/직접 패턴 호환).
 *    - 명시적 loopProfile 지정 시 유효성 검증 후 그대로 사용.
 *    - pattern과 loopProfile 동시 지정 시 AssaultSessionValidationError (원자적 거부).
 *    - 알 수 없는 loop profile 또는 malformed profile 시 AssaultSessionValidationError.
 *    - loop 모드에서 roundSource=challenge 지정 시 AssaultSessionValidationError.
 * 2. AssaultSessionWireHelper:
 *    - assembleAssaultSession() 기본 호출 시 새 루프 계획(getCurrentLoopPlan()) 정상 조립.
 *    - lastAssaultSessionOptions에 해석된 루프 옵션 안전하게 보존.
 *    - restartAssaultSession() 시 동일 seed+round번호 루프 계획 재현 및 새 세션 토큰 발행.
 *    - 재시작 시 이전 세션 teardown 및 이전 토큰 intent 차단.
 *    - 명시적 pattern 전달 시 기존 패턴 기반 세션 조립 유지.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveAssaultEntryOptions,
} from '../../src/core/bootstrap/AssaultLoopEntryOptions.js';
import {
  AssaultSessionWireHelper,
  type AssaultSessionWireHost,
} from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import {
  AssaultSessionValidationError,
  type AssaultRoundSourcePort,
} from '../../src/core/AssaultSessionFactory.js';
import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../config/assault-loop.config.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import type { AssaultLoopProfile } from '../../src/types/assault-loop.js';

describe('ASSAULT-LOOP-12: boss_assault UI 기본 루프 선택·시작·재시작 보존', () => {
  describe('1. resolveAssaultEntryOptions (단일 책임 옵션 해석기)', () => {
    it('pattern과 loopProfile 미지정 시 DEFAULT_ASSAULT_LOOP_CONFIG를 기본 주입해야 한다', () => {
      const resolved = resolveAssaultEntryOptions();

      expect(resolved.loopProfile).toBeDefined();
      expect(resolved.loopProfile).toEqual(DEFAULT_ASSAULT_LOOP_CONFIG);
      expect(resolved.seed).toBe(12345);
      expect(resolved.bpm).toBe(DEFAULT_ASSAULT_LOOP_CONFIG.defaultBpm);
      expect(resolved.pattern).toBeUndefined();
    });

    it('빈 객체 전달 시에도 DEFAULT_ASSAULT_LOOP_CONFIG 및 기본 seed/bpm이 주입되어야 한다', () => {
      const resolved = resolveAssaultEntryOptions({});

      expect(resolved.loopProfile).toBe(DEFAULT_ASSAULT_LOOP_CONFIG);
      expect(resolved.seed).toBe(12345);
      expect(resolved.bpm).toBe(DEFAULT_ASSAULT_LOOP_CONFIG.defaultBpm);
    });

    it('반환된 옵션 객체는 deepFreeze되어 불변이어야 한다', () => {
      const resolved = resolveAssaultEntryOptions({ bpm: 110 });

      expect(Object.isFrozen(resolved)).toBe(true);
      expect(() => {
        (resolved as any).bpm = 120;
      }).toThrow();
    });

    it('명시적 pattern만 지정된 경우 loopProfile을 주입하지 않고 pattern 경로를 유지해야 한다', () => {
      const resolved = resolveAssaultEntryOptions({
        pattern: DEFAULT_APPROACH_PATTERN,
      });

      expect(resolved.pattern).toBe(DEFAULT_APPROACH_PATTERN);
      expect(resolved.loopProfile).toBeUndefined();
    });

    it('명시적 loopProfile이 지정된 경우 유효성 검증 후 그대로 사용해야 한다', () => {
      const customProfile: AssaultLoopProfile = {
        ...DEFAULT_ASSAULT_LOOP_CONFIG,
        profileId: 'custom_loop_v1',
      };

      const resolved = resolveAssaultEntryOptions({
        loopProfile: customProfile,
        seed: 777,
        bpm: 125,
      });

      expect(resolved.loopProfile).toEqual(customProfile);
      expect(resolved.seed).toBe(777);
      expect(resolved.bpm).toBe(125);
    });

    it('pattern과 loopProfile을 동시에 지정하면 AssaultSessionValidationError를 발생시켜야 한다', () => {
      expect(() => {
        resolveAssaultEntryOptions({
          pattern: DEFAULT_APPROACH_PATTERN,
          loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('알 수 없는 문자열 loop profile ID가 주어지면 AssaultSessionValidationError를 발생시켜야 한다', () => {
      expect(() => {
        resolveAssaultEntryOptions({
          loopProfile: 'unknown_profile_xyz' as any,
        });
      }).toThrow(AssaultSessionValidationError);

      expect(() => {
        resolveAssaultEntryOptions({
          loop: 'invalid_loop' as any,
        } as any);
      }).toThrow(AssaultSessionValidationError);
    });

    it('불완전하거나 비정상적인 loopProfile 객체 지정 시 원자적으로 거부해야 한다', () => {
      expect(() => {
        resolveAssaultEntryOptions({
          loopProfile: { profileId: 'broken' } as any,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('loop 모드에서 challenge roundSource가 주어지면 원자적으로 거부해야 한다', () => {
      const challengeSource: AssaultRoundSourcePort = {
        kind: 'challenge',
        providePairs: vi.fn(),
      };

      expect(() => {
        resolveAssaultEntryOptions({
          roundSource: challengeSource,
        });
      }).toThrow(AssaultSessionValidationError);
    });
  });

  describe('2. AssaultSessionWireHelper: UI 기본 루프 조립 및 재시작 보존', () => {
    let host: AssaultSessionWireHost;
    let eventBus: EventBus;
    let battle: BattleState;
    let boss: BossController;
    let stateMachine: StateMachine;
    let sessionLifecycle: SessionLifecycle;
    let questionBank: QuestionBank;
    let helper: AssaultSessionWireHelper;

    const mockQuestionRecord = {
      id: 'q1',
      level: 1,
      subLevel: 1,
      levelTitle: '덧셈 기초',
      subLevelTitle: '한 자리 덧셈',
      questionText: '2 + 3 = ?',
      choices: [5, 6],
      correctAnswer: 5,
      correctIndex: 0,
      answerEval: '2+3=5',
      difficulty: 'easy',
      questionTemplate: '',
      wrongEval: '',
      varA: '',
      varB: '',
      varC: '',
      varD: '',
      shapeCode: '',
    };

    beforeEach(() => {
      eventBus = new EventBus();
      battle = new BattleState(100);
      boss = new BossController(1);
      stateMachine = new StateMachine('MENU_MAIN');
      sessionLifecycle = new SessionLifecycle();
      questionBank = new QuestionBank();
      questionBank.loadRecords([mockQuestionRecord as any]);

      host = {
        eventBus,
        battle,
        boss,
        get bossController() {
          return boss;
        },
        speech: {
          speak: vi.fn(),
          cancel: vi.fn(),
        } as any,
        stateMachine,
        sessionLifecycle,
        questionBank,
        currentChapter: 1,
        selectedSubLevel: 1,
        engine: {
          pauseGame: vi.fn(),
          resumeGame: vi.fn(),
        } as any,
        beatCoordinator: {
          pause: vi.fn(),
          resume: vi.fn(),
        } as any,
        goToMenu: vi.fn(),
        mainSceneContext: {
          state: {
            screenMode: 'menu',
          },
        } as any,
        options: {
          mode: 'boss_assault',
        },
      };

      helper = new AssaultSessionWireHelper(host);
    });

    it('옵션 없이 assembleAssaultSession() 호출 시 기본 루프 프로필과 루프 계획이 조립되어야 한다', () => {
      const session = helper.assembleAssaultSession();

      expect(session).toBeDefined();
      expect(session.loopProfile).toEqual(DEFAULT_ASSAULT_LOOP_CONFIG);
      expect(typeof session.getCurrentLoopPlan).toBe('function');

      // 세션 루프 계획 생성 확인 (24박 / FEAT-ASSAULT-LOOP-019 #744)
      const plan = session.getCurrentLoopPlan!();
      expect(plan).not.toBeNull();
      expect(plan!.totalBeats).toBe(24);
      expect(plan!.squatCount).toBe(0);
      expect(plan?.segments.length).toBeGreaterThan(0);
      expect(plan?.encounters.length).toBe(4);
      expect(helper.lastAssaultSessionOptions?.loopProfile).toEqual(DEFAULT_ASSAULT_LOOP_CONFIG);
    });

    it('restartAssaultSession() 호출 시 동일 루프 계획(seed+round)이 재현되고 새 토큰 및 HP 100으로 초기화되어야 한다', () => {
      const session1 = helper.assembleAssaultSession();
      const plan1 = session1.getCurrentLoopPlan!();
      const token1 = session1.sessionId;

      // 데미지 발생 모의
      battle.applyHazardDamage(35);
      expect(battle.hp).toBe(65);

      // 세션 재시작
      const session2 = helper.restartAssaultSession();
      const plan2 = session2.getCurrentLoopPlan!();
      const token2 = session2.sessionId;

      // 세션 토큰은 갱신됨
      expect(token2).not.toBe(token1);
      expect(sessionLifecycle.isValidAssaultToken(token2)).toBe(true);
      expect(sessionLifecycle.isValidAssaultToken(token1)).toBe(false);

      // HP 100 초기화
      expect(battle.hp).toBe(100);

      // 동일 seed+round 계획 재현 확인
      expect(plan2).not.toBeNull();
      expect(plan2?.totalBeats).toBe(plan1?.totalBeats);
      expect(plan2?.squatGapIndices).toEqual(plan1?.squatGapIndices);
      expect(plan2?.encounters.length).toBe(plan1?.encounters.length);
      expect(plan2?.segments.length).toBe(plan1?.segments.length);
    });

    it('재시작 후 이전 세션 토큰으로 유입되는 지연된 intent는 거부되어야 한다', () => {
      const session1 = helper.assembleAssaultSession();
      const token1 = session1.sessionId;

      helper.restartAssaultSession();

      const handled = helper.handleAssaultIntent('game_over', null, token1);
      expect(handled).toBe(false);
    });

    it('명시적 pattern을 전달한 경우 레거시 패턴 경로가 유지되어야 한다', () => {
      const session = helper.assembleAssaultSession({
        pattern: DEFAULT_APPROACH_PATTERN,
      });

      expect(session.loopProfile).toBeUndefined();
      expect(session.pattern).toEqual(DEFAULT_APPROACH_PATTERN);
      expect(session.getCurrentLoopPlan?.()).toBeNull();
    });
  });
});
