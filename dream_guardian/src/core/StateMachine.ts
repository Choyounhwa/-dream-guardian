/**
 * StateMachine - 유한 상태 머신 (FSM) 14개 canonical 상태 관리자
 *
 * 기획서 정의 현행 14개 게임 상태의 전환과 생명주기 관리
 * 허용되지 않은 상태 전환 차단 및 상태별 enter/update/input/render/exit 계약 정의
 *
 * @see Issue #5 (GitHub #70)
 * @see Issue #214 [REFACTOR-FSM-001]
 * @see Issue #229 [SPEC-ROUTINE-VERIFY-001]
 */

import type { GameState, IStateHandler } from '../types/index.js';

/** 허용된 상태 전환 맵 (현행 14개 Canonical 상태 전이 계약) */
const ALLOWED_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  LOADING:         ['MENU_MAIN'],
  MENU_MAIN:       ['MENU_SUB', 'READY_POSITION', 'STORY_INTRO', 'RUN_QUESTION', 'LOADING'],
  MENU_SUB:        ['MENU_MAIN', 'READY_POSITION', 'STORY_INTRO', 'RUN_QUESTION'],
  STORY_INTRO:     ['READY_POSITION', 'RUN_QUESTION', 'MENU_MAIN'],
  READY_POSITION:  ['RUN_QUESTION', 'MENU_MAIN'],
  RUN_QUESTION:    ['ANSWER_SELECT', 'ROUND_RESOLVE', 'GAMEOVER', 'MENU_MAIN'],
  ANSWER_SELECT:   ['STAR_COLLECT', 'HAZARD_EVADE', 'ROUND_RESOLVE', 'GAMEOVER', 'MENU_MAIN'],
  STAR_COLLECT:    ['ROUND_RESOLVE', 'GAMEOVER', 'MENU_MAIN'],
  HAZARD_EVADE:    ['ROUND_RESOLVE', 'GAMEOVER', 'MENU_MAIN'],
  ROUND_RESOLVE:   ['RUN_QUESTION', 'BOSS_CLIMAX', 'RESULT', 'GAMEOVER', 'MENU_MAIN'],
  BOSS_CLIMAX:     ['RESULT', 'GAMEOVER', 'MENU_MAIN'],
  RESULT:          ['MENU_MAIN', 'MENU_SUB', 'ENDING_CUTSCENE', 'RUN_QUESTION'],
  GAMEOVER:        ['MENU_MAIN', 'MENU_SUB', 'RUN_QUESTION'],
  ENDING_CUTSCENE: ['MENU_MAIN', 'RESULT'],
};

export class StateMachine {
  private _currentState: GameState;
  private _previousState: GameState | null = null;
  private _handlers = new Map<GameState, IStateHandler>();
  private _onTransition?: (from: GameState, to: GameState) => void;

  constructor(initialState: GameState = 'LOADING') {
    this._currentState = initialState;
  }

  /** 현재 상태 */
  get currentState(): GameState {
    return this._currentState;
  }

  /** 이전 상태 */
  get previousState(): GameState | null {
    return this._previousState;
  }

  /** 상태 핸들러 등록 */
  registerState(state: GameState, handler: IStateHandler): void {
    this._handlers.set(state, handler);
  }

  /** 등록된 상태 핸들러 조회 */
  getStateHandler(state: GameState): IStateHandler | undefined {
    return this._handlers.get(state);
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

    // 현재 상태 exit (정리 인터페이스 1회 실행)
    const currentHandler = this._handlers.get(from);
    currentHandler?.exit?.();

    // 상태 변경
    this._previousState = from;
    this._currentState = to;

    // 전환 콜백
    this._onTransition?.(from, to);

    // 새 상태 enter (초기화 인터페이스 1회 실행)
    const nextHandler = this._handlers.get(to);
    nextHandler?.enter?.();

    return true;
  }

  /** 현재 활성 상태의 enter 호출 */
  enter(): void {
    const handler = this._handlers.get(this._currentState);
    handler?.enter?.();
  }

  /** 현재 활성 상태의 update 호출 */
  update(dt: number): void {
    const handler = this._handlers.get(this._currentState);
    handler?.update?.(dt);
  }

  /** 현재 활성 상태의 input 호출 */
  input(data?: unknown): void {
    const handler = this._handlers.get(this._currentState);
    handler?.input?.(data);
  }

  /** 현재 활성 상태의 render 호출 */
  render(ctx: CanvasRenderingContext2D): void {
    const handler = this._handlers.get(this._currentState);
    handler?.render?.(ctx);
  }

  /** 현재 활성 상태의 exit 호출 */
  exit(): void {
    const handler = this._handlers.get(this._currentState);
    handler?.exit?.();
  }

  /** 특정 전환이 허용되는지 확인 */
  canTransition(to: GameState): boolean {
    const allowed = ALLOWED_TRANSITIONS[this._currentState];
    return !!allowed && allowed.includes(to);
  }

  // ─── 상태 상충 방지 및 상태 질의 헬퍼 메서드 ───

  /** Phase A 런/답/별/회피/정산 진행 중 여부 */
  isPhaseA(): boolean {
    return (
      this._currentState === 'RUN_QUESTION' ||
      this._currentState === 'ANSWER_SELECT' ||
      this._currentState === 'STAR_COLLECT' ||
      this._currentState === 'HAZARD_EVADE' ||
      this._currentState === 'ROUND_RESOLVE'
    );
  }

  /** Phase B 보스 결전 진행 중 여부 */
  isPhaseB(): boolean {
    return this._currentState === 'BOSS_CLIMAX';
  }

  /** 메뉴 화면 여부 (메인 메뉴 또는 서브 메뉴) */
  isMenu(): boolean {
    return this._currentState === 'MENU_MAIN' || this._currentState === 'MENU_SUB';
  }

  /** 결과 화면 여부 (승리 결과 또는 게임오버) */
  isResult(): boolean {
    return this._currentState === 'RESULT' || this._currentState === 'GAMEOVER';
  }

  /** 답안 선택 인터랙션이 오픈된 상태인지 여부 (ANSWER_SELECT 페이즈에만 한정) */
  isAnswerOpen(): boolean {
    return this._currentState === 'ANSWER_SELECT';
  }

  /** 문제 텍스트/접근 표시 허용 여부 (RUN_QUESTION 또는 ANSWER_SELECT) */
  isQuestionVisible(): boolean {
    return this._currentState === 'RUN_QUESTION' || this._currentState === 'ANSWER_SELECT';
  }

  /** 별가루 키노트 수집 페이즈인지 여부 */
  isStarCollect(): boolean {
    return this._currentState === 'STAR_COLLECT';
  }

  /** 바닥 충격파/장판 회피 페이즈인지 여부 */
  isHazardEvade(): boolean {
    return this._currentState === 'HAZARD_EVADE';
  }

  /** 허용된 전환 목록의 읽기 전용 접근 (테스트용) */
  static getAllowedTransitions(): Readonly<Record<GameState, readonly GameState[]>> {
    return ALLOWED_TRANSITIONS;
  }
}
