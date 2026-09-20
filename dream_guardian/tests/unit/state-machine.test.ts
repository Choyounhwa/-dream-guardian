import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import type { GameState, IStateHandler } from '../../src/types/index.js';

/**
 * StateMachine 단위 테스트
 * - 상태 전이 흐름 검증
 * - enter/exit 훅 호출 검증
 * - 잘못된 전환 차단 검증
 */

describe('StateMachine', () => {
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
    const result = sm.changeState('RUNNING');
    expect(result).toBe(false);
    expect(sm.currentState).toBe('LOADING'); // 상태 유지
  });

  it('같은 상태로의 전환은 무시된다', () => {
    const sm = new StateMachine('LOADING');
    const result = sm.changeState('LOADING');
    expect(result).toBe(false);
  });

  it('전환 시 exit → enter 순서로 훅이 호출된다', () => {
    const sm = new StateMachine('LOADING');
    const callOrder: string[] = [];

    const loadingHandler: IStateHandler = {
      exit: () => callOrder.push('loading:exit'),
    };
    const menuHandler: IStateHandler = {
      enter: () => callOrder.push('menu:enter'),
    };

    sm.registerState('LOADING', loadingHandler);
    sm.registerState('MENU_MAIN', menuHandler);
    sm.changeState('MENU_MAIN');

    expect(callOrder).toEqual(['loading:exit', 'menu:enter']);
  });

  it('onTransition 콜백이 호출된다', () => {
    const sm = new StateMachine('LOADING');
    const handler = vi.fn();

    sm.onTransition(handler);
    sm.changeState('MENU_MAIN');

    expect(handler).toHaveBeenCalledWith('LOADING', 'MENU_MAIN');
  });

  it('update()가 현재 상태의 핸들러를 호출한다', () => {
    const sm = new StateMachine('LOADING');
    const updateFn = vi.fn();
    sm.registerState('LOADING', { update: updateFn });

    sm.update(0.016);
    expect(updateFn).toHaveBeenCalledWith(0.016);
  });

  it('render()가 현재 상태의 핸들러를 호출한다', () => {
    const sm = new StateMachine('LOADING');
    const renderFn = vi.fn();
    sm.registerState('LOADING', { render: renderFn });

    const mockCtx = {} as CanvasRenderingContext2D;
    sm.render(mockCtx);
    expect(renderFn).toHaveBeenCalledWith(mockCtx);
  });

  it('canTransition()이 올바르게 판별한다', () => {
    const sm = new StateMachine('LOADING');
    expect(sm.canTransition('MENU_MAIN')).toBe(true);
    expect(sm.canTransition('RUNNING')).toBe(false);
  });

  it('전체 게임 플로우를 순서대로 진행할 수 있다', () => {
    const sm = new StateMachine('LOADING');
    const flow: GameState[] = [
      'MENU_MAIN', 'MENU_SUB', 'STORY_INTRO',
      'READY_POSITION', 'RUNNING', 'PLAYING',
      'CORRECT', 'GUARDIAN_CAST', 'RESULT',
      'ENDING_CUTSCENE', 'MENU_MAIN',
    ];

    for (const state of flow) {
      const result = sm.changeState(state);
      expect(result).toBe(true);
      expect(sm.currentState).toBe(state);
    }
  });

  it('WRONG → GAMEOVER → MENU_MAIN 플로우가 작동한다', () => {
    const sm = new StateMachine('PLAYING');
    expect(sm.changeState('WRONG')).toBe(true);
    expect(sm.changeState('GAMEOVER')).toBe(true);
    expect(sm.changeState('MENU_MAIN')).toBe(true);
  });

  it('13개 상태 모두 전환 규칙이 정의되어 있다', () => {
    const allStates: GameState[] = [
      'LOADING', 'MENU_MAIN', 'MENU_SUB', 'STORY_INTRO',
      'READY_POSITION', 'RUNNING', 'PLAYING', 'CORRECT',
      'WRONG', 'GUARDIAN_CAST', 'RESULT', 'GAMEOVER',
      'ENDING_CUTSCENE',
    ];
    const transitions = StateMachine.getAllowedTransitions();

    for (const state of allStates) {
      expect(transitions[state]).toBeDefined();
      expect(Array.isArray(transitions[state])).toBe(true);
    }
  });
});
