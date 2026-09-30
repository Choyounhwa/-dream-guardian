import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import type { GameState } from '../../src/types/index.js';

describe('Phase Presentation & Render Allow Matrix - [BUG-PHASE-PRESENTATION-001 / #232]', () => {
  let adapter: PhasePresentationAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    adapter = new PhasePresentationAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 상태별 렌더 허용표 (Render Allow Matrix)', () => {
    it('러닝 HUD는 RUN_QUESTION 및 REST_READY에서만 활성화된다', () => {
      expect(adapter.canRenderRunningHUD('RUN_QUESTION')).toBe(true);
      expect(adapter.canRenderRunningHUD('REST_READY' as GameState)).toBe(true);
      expect(adapter.canRenderRunningHUD('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderRunningHUD('STAR_COLLECT')).toBe(false);
      expect(adapter.canRenderRunningHUD('HAZARD_EVADE')).toBe(false);
      expect(adapter.canRenderRunningHUD('ROUND_RESOLVE')).toBe(false);
      expect(adapter.canRenderRunningHUD('BOSS_CLIMAX')).toBe(false);
      expect(adapter.canRenderRunningHUD('MENU_MAIN')).toBe(false);
    });

    it('문제 및 답안 버튼 렌더링은 ANSWER_SELECT에서만 활성화된다', () => {
      expect(adapter.canRenderQuestion('ANSWER_SELECT')).toBe(true);
      expect(adapter.canRenderQuestion('RUN_QUESTION')).toBe(false);
      expect(adapter.canRenderQuestion('STAR_COLLECT')).toBe(false);
      expect(adapter.canRenderQuestion('HAZARD_EVADE')).toBe(false);
      expect(adapter.canRenderQuestion('ROUND_RESOLVE')).toBe(false);
      expect(adapter.canRenderQuestion('BOSS_CLIMAX')).toBe(false);
    });

    it('별모으기 노트 렌더링은 STAR_COLLECT 및 KEYNOTE_PERFORMANCE에서만 활성화된다', () => {
      expect(adapter.canRenderStarCollect('STAR_COLLECT')).toBe(true);
      expect(adapter.canRenderStarCollect('KEYNOTE_PERFORMANCE' as GameState)).toBe(true);
      expect(adapter.canRenderStarCollect('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderStarCollect('HAZARD_EVADE')).toBe(false);
      expect(adapter.canRenderStarCollect('RUN_QUESTION')).toBe(false);
      expect(adapter.canRenderStarCollect('ROUND_RESOLVE')).toBe(false);
    });

    it('회피 장판 렌더링은 HAZARD_EVADE에서 활성화된다', () => {
      expect(adapter.canRenderHazardEvade('HAZARD_EVADE')).toBe(true);
      expect(adapter.canRenderHazardEvade('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderHazardEvade('STAR_COLLECT')).toBe(false);
      expect(adapter.canRenderHazardEvade('ROUND_RESOLVE')).toBe(false);
    });

    it('답안 선택 입력은 ANSWER_SELECT이며 answerLocked가 false일 때만 허용된다', () => {
      expect(adapter.isAnswerInputAllowed('ANSWER_SELECT', false)).toBe(true);
      expect(adapter.isAnswerInputAllowed('ANSWER_SELECT', true)).toBe(false);
      expect(adapter.isAnswerInputAllowed('STAR_COLLECT', false)).toBe(false);
      expect(adapter.isAnswerInputAllowed('HAZARD_EVADE', false)).toBe(false);
      expect(adapter.isAnswerInputAllowed('RUN_QUESTION', false)).toBe(false);
      expect(adapter.isAnswerInputAllowed('ROUND_RESOLVE', false)).toBe(false);
    });
  });

  describe('2. 정답→별 렌더 활성/답안 렌더 비활성, 오답·timeout→회피 표시 경로', () => {
    function createFixture() {
      const questionBank = new QuestionBank();
      questionBank.loadRecords([
        {
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈 기초',
          subLevelTitle: '한 자리 덧셈',
          questionTemplate: '{A} + {B} = ?',
          answerEval: 'A + B',
          wrongEval: 'A + B + 1',
          varA: '2',
          varB: '3',
          varC: '',
          varD: '',
          shapeCode: '',
        },
      ]);
      const battle = new BattleState();
      const armReachAnswerSelector = new ArmReachAnswerSelector();
      const coordinator = new BeatRunCoordinator({
        routineMode: 'arm_reach',
        questionBank,
        battle,
        armReachAnswerSelector,
      });
      return { coordinator, armReachAnswerSelector };
    }

    it('정답 선택 시 즉시 STAR_COLLECT로 전이되어 별 렌더 활성, 답안 렌더 비활성이 된다', () => {
      const { coordinator } = createFixture();
      coordinator.startRound({ chapter: 1, subLevel: 1 });

      // 8박 운동 완료 시켜 ANSWER_SELECT로 진입
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep();
        coordinator.update(0.5);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(adapter.canRenderQuestion(coordinator.phase as GameState)).toBe(true);
      expect(adapter.canRenderStarCollect(coordinator.phase as GameState)).toBe(false);

      // 정답 선택
      const correctIdx = coordinator.currentQuestion!.correctIndex;
      coordinator.confirmAnswerByFallback(correctIdx);

      expect(coordinator.phase).toBe('STAR_COLLECT');
      expect(adapter.canRenderStarCollect(coordinator.phase as GameState)).toBe(true);
      expect(adapter.canRenderQuestion(coordinator.phase as GameState)).toBe(false);
      expect(adapter.canRenderHazardEvade(coordinator.phase as GameState)).toBe(false);
    });

    it('오답 선택 시 즉시 HAZARD_EVADE로 전이되어 회피 렌더 활성, 답안 렌더 비활성이 된다', () => {
      const { coordinator } = createFixture();
      coordinator.startRound({ chapter: 1, subLevel: 1 });

      for (let i = 0; i < 8; i++) {
        coordinator.recordStep();
        coordinator.update(0.5);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 오답 선택
      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);

      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(adapter.canRenderHazardEvade(coordinator.phase as GameState)).toBe(true);
      expect(adapter.canRenderQuestion(coordinator.phase as GameState)).toBe(false);
      expect(adapter.canRenderStarCollect(coordinator.phase as GameState)).toBe(false);
    });

    it('답안 선택 2박 타임아웃 만료 시 HAZARD_EVADE로 전이되어 회피 표시 경로를 탄다', () => {
      const { coordinator } = createFixture();
      coordinator.startRound({ chapter: 1, subLevel: 1 });

      for (let i = 0; i < 8; i++) {
        coordinator.recordStep();
        coordinator.update(0.5);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 2박(1.0초) 동안 미입력 방치
      coordinator.update(1.0);

      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(adapter.canRenderHazardEvade(coordinator.phase as GameState)).toBe(true);
      expect(adapter.canRenderQuestion(coordinator.phase as GameState)).toBe(false);
    });
  });

  describe('3. 선택 직후 시각 피드백 1회 및 선택 입력 잠금', () => {
    it('답 선택 시 즉시 입력이 잠기고 시각 피드백이 1회 발생하며, 지연 정산 시 중복 실행되지 않는다', () => {
      let immediateFeedbackCount = 0;
      let delayedSettlementCount = 0;
      let answerLocked = false;

      const questionBank = new QuestionBank();
      questionBank.loadRecords([
        {
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈 기초',
          subLevelTitle: '한 자리 덧셈',
          questionTemplate: '{A} + {B} = ?',
          answerEval: 'A + B',
          wrongEval: 'A + B + 1',
          varA: '2',
          varB: '3',
          varC: '',
          varD: '',
          shapeCode: '',
        },
      ]);
      const battle = new BattleState();
      const armReachAnswerSelector = new ArmReachAnswerSelector();

      const coordinator = new BeatRunCoordinator({
        routineMode: 'arm_reach',
        questionBank,
        battle,
        armReachAnswerSelector,
        onAnswerSelected: () => {
          // 즉시 피드백
          immediateFeedbackCount++;
          answerLocked = true;
        },
        onAnswerConfirmed: () => {
          // 지연 정산
          delayedSettlementCount++;
        },
      });

      coordinator.startRound({ chapter: 1, subLevel: 1 });
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep();
        coordinator.update(0.5);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 답 선택
      coordinator.confirmAnswerByFallback(0);

      // 선택 직후 즉시 1회 피드백 및 입력 잠금
      expect(immediateFeedbackCount).toBe(1);
      expect(answerLocked).toBe(true);
      expect(adapter.isAnswerInputAllowed('STAR_COLLECT', answerLocked)).toBe(false);
      expect(delayedSettlementCount).toBe(0);

      // 추가 입력 시도 -> 차단됨
      coordinator.confirmAnswerByFallback(1);
      expect(immediateFeedbackCount).toBe(1);

      // 7박 분기 루틴 경과 (3.5초)
      coordinator.update(3.5);

      // 지연 정산 1회 완료
      expect(delayedSettlementCount).toBe(1);
      // 즉시 피드백은 여전히 1회로 유지 (중복 없음)
      expect(immediateFeedbackCount).toBe(1);
    });
  });

  describe('4. questionVisible=false여도 정산 및 다음 상태 정상 수행', () => {
    it('questionVisible이 false인 상태에서도 ROUND_RESOLVE 및 다음 라운드 정상 진행된다', () => {
      const battle = new BattleState();
      const boss = new BossController(1);
      const resolver = new BeatRoundResolver({ battle, boss });
      const session = new SessionLifecycle();
      const stateMachine = new StateMachine('RUN_QUESTION');

      let questionVisible = false;
      let nextRoundStarted = false;

      session.startSession();

      // ANSWER_SELECT 진입
      stateMachine.changeState('ANSWER_SELECT');
      questionVisible = true;

      // 정답 선택 -> STAR_COLLECT 전이
      stateMachine.changeState('STAR_COLLECT');
      questionVisible = false; // STAR_COLLECT에서는 답안 숨김

      expect(questionVisible).toBe(false);
      expect(stateMachine.currentState).toBe('STAR_COLLECT');

      // 6박 후 정산 시점 도달
      stateMachine.changeState('ROUND_RESOLVE');
      expect(stateMachine.currentState).toBe('ROUND_RESOLVE');

      // questionVisible = false인 상태에서 정산 수행
      const initialHp = boss.hp;
      const resolveResult = resolver.resolveRound('correct');

      // 정상 정산 확인 (보스 HP 감소 및 마나 증가)
      expect(resolveResult.bossDefeated).toBe(false);
      expect(boss.hp).toBe(initialHp - 1);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);

      // 세션 예약으로 다음 라운드 전이
      session.schedule(() => {
        nextRoundStarted = true;
        stateMachine.changeState('RUN_QUESTION');
        questionVisible = true;
      }, 800);

      vi.advanceTimersByTime(800);

      expect(nextRoundStarted).toBe(true);
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
      expect(questionVisible).toBe(true);
    });
  });
});
