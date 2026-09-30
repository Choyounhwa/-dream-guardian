import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import type { GameState, IStateHandler } from '../../src/types/index.js';

/**
 * StateMachine 단위 테스트 - [REFACTOR-FSM-001 / #214]
 * - 현행 14개 canonical 상태 전이 흐름 검증
 * - enter/exit/input/update/render 훅 계약 호출 검증
 * - 허용된 전환 및 비허용 전환 차단 검증
 * - 상충 조합 차단 및 상태 질의 헬퍼 검증
 */

describe('StateMachine - [REFACTOR-FSM-001 / #214]', () => {
  it('초기 상태가 LOADING이다', () => {
    const sm = new StateMachine();
    expect(sm.currentState).toBe('LOADING');
  });

  it('커스텀 초기 상태로 생성할 수 있다', () => {
    const sm = new StateMachine('MENU_MAIN');
    expect(sm.currentState).toBe('MENU_MAIN');
  });

  it('허용된 전환이 성공한다', () => {
    const sm = new StateMachine('LOADING');
    const result = sm.changeState('MENU_MAIN');
    expect(result).toBe(true);
    expect(sm.currentState).toBe('MENU_MAIN');
  });

  it('허용되지 않은 전환은 차단된다', () => {
    const sm = new StateMachine('LOADING');
    const result = sm.changeState('RUN_QUESTION');
    expect(result).toBe(false);
    expect(sm.currentState).toBe('LOADING'); // 상태 유지
  });

  it('같은 상태로의 전환은 무시된다', () => {
    const sm = new StateMachine('LOADING');
    const result = sm.changeState('LOADING');
    expect(result).toBe(false);
  });

  it('전환 시 exit → enter 순서로 훅이 정확히 1회 호출된다', () => {
    const sm = new StateMachine('LOADING');
    const callOrder: string[] = [];

    const loadingHandler: IStateHandler = {
      exit: vi.fn(() => callOrder.push('loading:exit')),
    };
    const menuHandler: IStateHandler = {
      enter: vi.fn(() => callOrder.push('menu:enter')),
    };

    sm.registerState('LOADING', loadingHandler);
    sm.registerState('MENU_MAIN', menuHandler);
    sm.changeState('MENU_MAIN');

    expect(callOrder).toEqual(['loading:exit', 'menu:enter']);
    expect(loadingHandler.exit).toHaveBeenCalledTimes(1);
    expect(menuHandler.enter).toHaveBeenCalledTimes(1);
  });

  it('onTransition 콜백이 이전 상태와 다음 상태를 전달받아 호출된다', () => {
    const sm = new StateMachine('LOADING');
    const handler = vi.fn();

    sm.onTransition(handler);
    sm.changeState('MENU_MAIN');

    expect(handler).toHaveBeenCalledWith('LOADING', 'MENU_MAIN');
  });

  it('update(), input(), render()가 현재 활성 상태의 핸들러만 호출한다', () => {
    const sm = new StateMachine('RUN_QUESTION');
    const runUpdate = vi.fn();
    const runInput = vi.fn();
    const runRender = vi.fn();
    const answerInput = vi.fn();

    sm.registerState('RUN_QUESTION', {
      update: runUpdate,
      input: runInput,
      render: runRender,
    });
    sm.registerState('ANSWER_SELECT', {
      input: answerInput,
    });

    sm.update(0.016);
    sm.input({ type: 'step' });
    const mockCtx = {} as CanvasRenderingContext2D;
    sm.render(mockCtx);

    expect(runUpdate).toHaveBeenCalledWith(0.016);
    expect(runInput).toHaveBeenCalledWith({ type: 'step' });
    expect(runRender).toHaveBeenCalledWith(mockCtx);
    expect(answerInput).not.toHaveBeenCalled();
  });

  it('canTransition()이 올바르게 판별한다', () => {
    const sm = new StateMachine('LOADING');
    expect(sm.canTransition('MENU_MAIN')).toBe(true);
    expect(sm.canTransition('RUN_QUESTION')).toBe(false);
  });

  describe('현행 정규 게임 루프 전이 경로 검증', () => {
    it('전체 게임 플로우를 순서대로 진행할 수 있다', () => {
      const sm = new StateMachine('LOADING');
      const flow: GameState[] = [
        'MENU_MAIN',
        'MENU_SUB',
        'STORY_INTRO',
        'READY_POSITION',
        'RUN_QUESTION',
        'ANSWER_SELECT',
        'STAR_COLLECT',
        'ROUND_RESOLVE',
        'BOSS_CLIMAX',
        'RESULT',
        'ENDING_CUTSCENE',
        'MENU_MAIN',
      ];

      for (const state of flow) {
        const result = sm.changeState(state);
        expect(result).toBe(true);
        expect(sm.currentState).toBe(state);
      }
    });

    it('Phase A 정답 루틴: RUN_QUESTION → ANSWER_SELECT → STAR_COLLECT → ROUND_RESOLVE → RUN_QUESTION', () => {
      const sm = new StateMachine('RUN_QUESTION');

      expect(sm.changeState('ANSWER_SELECT')).toBe(true);
      expect(sm.currentState).toBe('ANSWER_SELECT');

      expect(sm.changeState('STAR_COLLECT')).toBe(true);
      expect(sm.currentState).toBe('STAR_COLLECT');

      expect(sm.changeState('ROUND_RESOLVE')).toBe(true);
      expect(sm.currentState).toBe('ROUND_RESOLVE');

      expect(sm.changeState('RUN_QUESTION')).toBe(true);
      expect(sm.currentState).toBe('RUN_QUESTION');
    });

    it('Phase A 오답/타임아웃 루틴: RUN_QUESTION → ANSWER_SELECT → HAZARD_EVADE → ROUND_RESOLVE', () => {
      const sm = new StateMachine('RUN_QUESTION');

      expect(sm.changeState('ANSWER_SELECT')).toBe(true);
      expect(sm.changeState('HAZARD_EVADE')).toBe(true);
      expect(sm.currentState).toBe('HAZARD_EVADE');

      expect(sm.changeState('ROUND_RESOLVE')).toBe(true);
      expect(sm.currentState).toBe('ROUND_RESOLVE');
    });

    it('10번째 라운드 정산 후 Phase B(BOSS_CLIMAX) 진입 및 승리 RESULT 전환', () => {
      const sm = new StateMachine('ROUND_RESOLVE');

      expect(sm.changeState('BOSS_CLIMAX')).toBe(true);
      expect(sm.currentState).toBe('BOSS_CLIMAX');

      expect(sm.changeState('RESULT')).toBe(true);
      expect(sm.currentState).toBe('RESULT');
    });

    it('HP 소진 시 GAMEOVER 전환 및 메뉴 복귀 플로우', () => {
      const sm = new StateMachine('ROUND_RESOLVE');
      expect(sm.changeState('GAMEOVER')).toBe(true);
      expect(sm.currentState).toBe('GAMEOVER');

      expect(sm.changeState('MENU_MAIN')).toBe(true);
      expect(sm.currentState).toBe('MENU_MAIN');
    });

    it('비허용 전환 차단 (단계를 건너뛰거나 역주행 차단)', () => {
      const sm = new StateMachine('RUN_QUESTION');

      // ANSWER_SELECT 없이 바로 STAR_COLLECT 진입 차단
      expect(sm.changeState('STAR_COLLECT')).toBe(false);
      // ANSWER_SELECT 없이 바로 HAZARD_EVADE 진입 차단
      expect(sm.changeState('HAZARD_EVADE')).toBe(false);
      // RUN_QUESTION에서 Phase B 직접 진입 차단
      expect(sm.changeState('BOSS_CLIMAX')).toBe(false);

      // ANSWER_SELECT 진입 후
      expect(sm.changeState('ANSWER_SELECT')).toBe(true);
      // ANSWER_SELECT에서 바로 RUN_QUESTION 역주행 차단
      expect(sm.changeState('RUN_QUESTION')).toBe(false);
      // ANSWER_SELECT에서 바로 BOSS_CLIMAX 직접 진입 차단
      expect(sm.changeState('BOSS_CLIMAX')).toBe(false);

      // STAR_COLLECT 진입 후
      expect(sm.changeState('STAR_COLLECT')).toBe(true);
      // ROUND_RESOLVE 없이 바로 RUN_QUESTION 진입 차단
      expect(sm.changeState('RUN_QUESTION')).toBe(false);
      expect(sm.changeState('BOSS_CLIMAX')).toBe(false);
    });
  });

  describe('상태 상충 방지 및 상태 질의 헬퍼 검증', () => {
    it('각 페이즈별 상태 질의 결과가 배타적으로 일관성을 유지한다', () => {
      const sm = new StateMachine('RUN_QUESTION');
      expect(sm.isPhaseA()).toBe(true);
      expect(sm.isPhaseB()).toBe(false);
      expect(sm.isAnswerOpen()).toBe(false);
      expect(sm.isStarCollect()).toBe(false);
      expect(sm.isHazardEvade()).toBe(false);

      sm.changeState('ANSWER_SELECT');
      expect(sm.isPhaseA()).toBe(true);
      expect(sm.isAnswerOpen()).toBe(true);
      expect(sm.isStarCollect()).toBe(false);
      expect(sm.isHazardEvade()).toBe(false);

      sm.changeState('STAR_COLLECT');
      expect(sm.isPhaseA()).toBe(true);
      expect(sm.isAnswerOpen()).toBe(false); // 별모으기 중 답안 선택창 오픈 차단
      expect(sm.isStarCollect()).toBe(true);
      expect(sm.isHazardEvade()).toBe(false);

      sm.changeState('ROUND_RESOLVE');
      expect(sm.isPhaseA()).toBe(true);
      expect(sm.isAnswerOpen()).toBe(false);
      expect(sm.isStarCollect()).toBe(false);

      sm.changeState('BOSS_CLIMAX');
      expect(sm.isPhaseA()).toBe(false);
      expect(sm.isPhaseB()).toBe(true);
      expect(sm.isAnswerOpen()).toBe(false);

      sm.changeState('RESULT');
      expect(sm.isResult()).toBe(true);
      expect(sm.isPhaseA()).toBe(false);
      expect(sm.isPhaseB()).toBe(false);
    });
  });

  it('14개 canonical 상태 모두 전환 규칙이 정의되어 있다', () => {
    const allStates: GameState[] = [
      'LOADING',
      'MENU_MAIN',
      'MENU_SUB',
      'STORY_INTRO',
      'READY_POSITION',
      'RUN_QUESTION',
      'ANSWER_SELECT',
      'STAR_COLLECT',
      'HAZARD_EVADE',
      'ROUND_RESOLVE',
      'BOSS_CLIMAX',
      'RESULT',
      'GAMEOVER',
      'ENDING_CUTSCENE',
    ];
    const transitions = StateMachine.getAllowedTransitions();

    expect(Object.keys(transitions)).toHaveLength(14);
    for (const state of allStates) {
      expect(transitions[state]).toBeDefined();
      expect(Array.isArray(transitions[state])).toBe(true);
      expect(transitions[state].length).toBeGreaterThan(0);
    }
  });
});
