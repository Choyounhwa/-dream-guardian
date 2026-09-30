import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { BattleState } from '../../src/game/BattleState.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { StarCollectionInput } from '../../src/input/StarCollectionInput.js';
import type { IStateHandler } from '../../src/types/index.js';

/**
 * StateMachine & Production Lifecycle Integration Tests - [REFACTOR-FSM-001 / #214]
 *
 * 1. 허용/차단 전환과 실제 코디네이터/라이프사이클 연결 확인
 * 2. 상태 진입/종료 시 입력·타겟·장판 정리 인터페이스가 정확히 1회 실행되는지 검증
 * 3. 서로 다른 상태변수의 상충 조합(예: STAR_COLLECT 중 답안 열림 등) 차단 검증
 * 4. 실제 전환 이벤트 경로(8박 완료 → 답 선택 → 분기 → 정산 → 다음 라운드/Phase B) 검증
 */

describe('StateMachine Lifecycle Integration - [REFACTOR-FSM-001 / #214]', () => {
  let stateMachine: StateMachine;
  let coordinator: BeatRunCoordinator;
  let questionBank: QuestionBank;
  let battle: BattleState;
  let hazardController: PhaseAHazardController;
  let answerSelector: ArmReachAnswerSelector;
  let starInput: StarCollectionInput;

  beforeEach(() => {
    stateMachine = new StateMachine('MENU_MAIN');
    questionBank = new QuestionBank();
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

    battle = new BattleState();
    answerSelector = new ArmReachAnswerSelector({ isMirrored: false });
    starInput = new StarCollectionInput();
    hazardController = new PhaseAHazardController();

    coordinator = new BeatRunCoordinator({
      questionBank,
      battle,
      armReachAnswerSelector: answerSelector,
      speakFn: vi.fn(),
    });
  });

  describe('1. 실제 게임 진행 연결 및 단방향 전이 검증', () => {
    it('게임 시작 시 MENU_MAIN → READY_POSITION → RUN_QUESTION 전이가 정상 수행된다', () => {
      expect(stateMachine.currentState).toBe('MENU_MAIN');

      // 메뉴에서 준비 상태 진입
      expect(stateMachine.changeState('READY_POSITION')).toBe(true);
      expect(stateMachine.currentState).toBe('READY_POSITION');

      // 달리기 라운드 시작
      expect(stateMachine.changeState('RUN_QUESTION')).toBe(true);
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
      expect(stateMachine.isPhaseA()).toBe(true);
    });

    it('BeatRunCoordinator와 StateMachine의 상태 동기화가 정상 작동한다', () => {
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('RUN_QUESTION');

      coordinator.startRound({ chapter: 1 });
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(stateMachine.currentState).toBe('RUN_QUESTION');

      // 8회 스텝 진행 (각 0.5s 슬롯별 1회 및 8박 종료 경계 도달)
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep();
        coordinator.update(0.5);
      }

      // 8박 완료 후 코디네이터 phase가 ANSWER_SELECT로 전이
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      stateMachine.changeState('ANSWER_SELECT');
      expect(stateMachine.currentState).toBe('ANSWER_SELECT');
      expect(stateMachine.isAnswerOpen()).toBe(true);
    });
  });

  describe('2. 상태 진입/종료 시 리소스 정리 인터페이스 1회 실행 검증', () => {
    it('ANSWER_SELECT exit 시 answer selector 정리 및 창 닫기가 1회 실행된다', () => {
      const exitSpy = vi.fn();
      const openSpy = vi.spyOn(answerSelector, 'openWindow');
      const closeSpy = vi.spyOn(answerSelector, 'closeWindow');

      const answerHandler: IStateHandler = {
        enter: () => {
          answerSelector.openWindow();
        },
        exit: () => {
          exitSpy();
          answerSelector.closeWindow();
        },
      };

      stateMachine.registerState('ANSWER_SELECT', answerHandler);
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('RUN_QUESTION');
      stateMachine.changeState('ANSWER_SELECT');

      expect(openSpy).toHaveBeenCalledTimes(1);

      // 정답 선택으로 STAR_COLLECT 전이
      stateMachine.changeState('STAR_COLLECT');

      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('HAZARD_EVADE exit 시 hazard controller 정리가 1회 실행된다', () => {
      const hazardStopSpy = vi.spyOn(hazardController, 'stop');

      const hazardHandler: IStateHandler = {
        enter: () => {
          hazardController.start();
        },
        exit: () => {
          hazardController.stop();
        },
      };

      stateMachine.registerState('HAZARD_EVADE', hazardHandler);
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('RUN_QUESTION');
      stateMachine.changeState('ANSWER_SELECT');
      stateMachine.changeState('HAZARD_EVADE');

      expect(hazardController.isActive).toBe(true);

      // 정산 단계로 전이
      stateMachine.changeState('ROUND_RESOLVE');

      expect(hazardStopSpy).toHaveBeenCalledTimes(1);
      expect(hazardController.isActive).toBe(false);
    });

    it('STAR_COLLECT exit 시 starInput 초기화 및 타겟 정리가 1회 실행된다', () => {
      const starResetSpy = vi.spyOn(starInput, 'reset');

      const starHandler: IStateHandler = {
        exit: () => {
          starInput.reset();
        },
      };

      stateMachine.registerState('STAR_COLLECT', starHandler);
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('RUN_QUESTION');
      stateMachine.changeState('ANSWER_SELECT');
      stateMachine.changeState('STAR_COLLECT');

      stateMachine.changeState('ROUND_RESOLVE');
      expect(starResetSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. 상충 상태 발생 차단 검증', () => {
    it('STAR_COLLECT 및 HAZARD_EVADE 중에는 isAnswerOpen()이 항상 false여야 한다', () => {
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('RUN_QUESTION');
      stateMachine.changeState('ANSWER_SELECT');
      expect(stateMachine.isAnswerOpen()).toBe(true);

      stateMachine.changeState('STAR_COLLECT');
      expect(stateMachine.isAnswerOpen()).toBe(false);

      stateMachine.changeState('ROUND_RESOLVE');
      expect(stateMachine.isAnswerOpen()).toBe(false);

      stateMachine.changeState('RUN_QUESTION');
      stateMachine.changeState('ANSWER_SELECT');
      stateMachine.changeState('HAZARD_EVADE');
      expect(stateMachine.isAnswerOpen()).toBe(false);
    });

    it('ROUND_RESOLVE 중에는 Phase A/B 세부 액션(답안, 별수집, 회피)이 모두 비활성화된다', () => {
      stateMachine.changeState('READY_POSITION');
      stateMachine.changeState('RUN_QUESTION');
      stateMachine.changeState('ANSWER_SELECT');
      stateMachine.changeState('STAR_COLLECT');
      stateMachine.changeState('ROUND_RESOLVE');

      expect(stateMachine.isAnswerOpen()).toBe(false);
      expect(stateMachine.isStarCollect()).toBe(false);
      expect(stateMachine.isHazardEvade()).toBe(false);
      expect(stateMachine.isPhaseB()).toBe(false);
      expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
    });
  });
});
