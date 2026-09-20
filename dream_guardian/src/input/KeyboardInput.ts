/**
 * KeyboardInput - 키보드/터치 Fallback 비상 입력기
 *
 * 카메라 없는 환경에서 키보드/터치로 게임 조작
 * Space: 달리기, 1/2: 답 선택, ArrowDown: 스쿼트, ArrowUp: 점프
 *
 * @see Issue #20 (GitHub #85)
 */

export type InputAction =
  | 'run'
  | 'squat'
  | 'jump'
  | 'answer1'
  | 'answer2'
  | 'pause';

export type InputCallback = (action: InputAction) => void;

export class KeyboardInput {
  private _callback: InputCallback | null = null;
  private _enabled = false;
  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private _heldKeys = new Set<string>();

  /** 현재 눌려있는 키 확인 */
  isHeld(key: string): boolean {
    return this._heldKeys.has(key);
  }

  /** 달리기 상태 (Space 홀드) */
  get isRunning(): boolean {
    return this._heldKeys.has(' ');
  }

  /** 스쿼트 상태 (ArrowDown 홀드) */
  get isSquatting(): boolean {
    return this._heldKeys.has('ArrowDown');
  }

  /**
   * 키보드 입력 활성화
   */
  enable(callback: InputCallback): void {
    if (this._enabled) this.disable();

    this._callback = callback;
    this._enabled = true;

    this._boundKeyDown = (e: KeyboardEvent) => {
      if (this._heldKeys.has(e.key)) return;
      this._heldKeys.add(e.key);

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this._callback?.('run');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this._callback?.('squat');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._callback?.('jump');
          break;
        case '1':
          this._callback?.('answer1');
          break;
        case '2':
          this._callback?.('answer2');
          break;
        case 'Escape':
        case 'p':
          this._callback?.('pause');
          break;
      }
    };

    this._boundKeyUp = (e: KeyboardEvent) => {
      this._heldKeys.delete(e.key);
    };

    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
  }

  /** 키보드 입력 비활성화 */
  disable(): void {
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this._boundKeyUp) {
      document.removeEventListener('keyup', this._boundKeyUp);
    }
    this._boundKeyDown = null;
    this._boundKeyUp = null;
    this._callback = null;
    this._enabled = false;
    this._heldKeys.clear();
  }

  /** 활성 상태 여부 */
  get enabled(): boolean {
    return this._enabled;
  }

  destroy(): void {
    this.disable();
  }
}
