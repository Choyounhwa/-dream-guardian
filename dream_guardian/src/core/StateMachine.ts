/**
 * StateMachine - 유한 상태 머신 (FSM) 13개 상태 관리자
 *
 * 기획서 정의 13개 게임 상태의 전환과 생명주기 관리
 * 허용되지 않은 상태 전환 차단
 *
 * @see Issue #5 (GitHub #70)
 */

import type { GameState, IStateHandler } from '../types/index.js';

/** 허용된 상태 전환 맵 */
const ALLOWED_TRANSITIONS: Record<GameState, GameState[]> = {
  LOADING:          ['MENU_MAIN'],
  MENU_MAIN:        ['MENU_SUB', 'LOADING'],
  MENU_SUB:         ['MENU_MAIN', 'STORY_INTRO'],
  STORY_INTRO:      ['READY_POSITION'],
  READY_POSITION:   ['RUNNING'],
  RUNNING:          ['PLAYING', 'GAMEOVER'],
  PLAYING:          ['CORRECT', 'WRONG', 'RUNNING', 'GAMEOVER'],
  CORRECT:          ['RUNNING', 'GUARDIAN_CAST', 'GAMEOVER'],
  WRONG:            ['RUNNING', 'GAMEOVER'],
  GUARDIAN_CAST:    ['RUNNING', 'RESULT', 'GAMEOVER'],
  RESULT:           ['MENU_MAIN', 'MENU_SUB', 'ENDING_CUTSCENE'],
  GAMEOVER:         ['MENU_MAIN', 'MENU_SUB'],
  ENDING_CUTSCENE:  ['MENU_MAIN'],
};

export class StateMachine {
  private _currentState: GameState;
  private _handlers = new Map<GameState, IStateHandler>();
  private _onTransition?: (from: GameState, to: GameState) => void;

  constructor(initialState: GameState = 'LOADING') {
    this._currentState = initialState;
  }

  /** 현재 상태 */
  get currentState(): GameState {
    return this._currentState;
  }

  /** 상태 핸들러 등록 */
  registerState(state: GameState, handler: IStateHandler): void {
    this._handlers.set(state, handler);
  }

  /** 상태 전환 콜백 등록 */
  onTransition(cb: (from: GameState, to: GameState) => void): void {
    this._onTransition = cb;
  }

  /**
   * 상태 전환
   * @returns 전환 성공 여부
   */
  changeState(to: GameState): boolean {
    const from = this._currentState;

    // 같은 상태로의 전환은 무시
    if (from === to) return false;

    // 허용된 전환인지 검증
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      console.warn(`[StateMachine] 허용되지 않은 전환: ${from} → ${to}`);
      return false;
    }

    // 현재 상태 exit
    const currentHandler = this._handlers.get(from);
    currentHandler?.exit?.();

    // 상태 변경
    this._currentState = to;

    // 전환 콜백
    this._onTransition?.(from, to);

    // 새 상태 enter
    const nextHandler = this._handlers.get(to);
    nextHandler?.enter?.();

    return true;
  }

  /** 현재 상태의 update 호출 */
  update(dt: number): void {
    const handler = this._handlers.get(this._currentState);
    handler?.update?.(dt);
  }

  /** 현재 상태의 render 호출 */
  render(ctx: CanvasRenderingContext2D): void {
    const handler = this._handlers.get(this._currentState);
    handler?.render?.(ctx);
  }

  /** 특정 전환이 허용되는지 확인 */
  canTransition(to: GameState): boolean {
    const allowed = ALLOWED_TRANSITIONS[this._currentState];
    return !!allowed && allowed.includes(to);
  }

  /** 허용된 전환 목록의 읽기 전용 접근 (테스트용) */
  static getAllowedTransitions(): Readonly<Record<GameState, readonly GameState[]>> {
    return ALLOWED_TRANSITIONS;
  }
}
