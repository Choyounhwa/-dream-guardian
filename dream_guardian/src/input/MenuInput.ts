/**
 * MenuInput - 양손 합장 제스처 메뉴 입력기
 *
 * 양손 손바닥을 모으면 메뉴 커서 활성화
 * 합장 위치의 중점으로 메뉴 항목 선택
 *
 * @see Issue #19 (GitHub #84)
 */

export interface MenuCursorResult {
  /** 합장 감지 여부 */
  active: boolean;
  /** 커서 정규화 X (0~1) */
  x: number;
  /** 커서 정규화 Y (0~1) */
  y: number;
  /** 두 손 사이 거리 (정규화) */
  distance: number;
}

/** 합장 감지 기본 거리 임계값 (18:9 Cover 뷰포트 확대율 고려: 0.22) */
export const DEFAULT_JOIN_DISTANCE_THRESHOLD = 0.22;

export class MenuInput {
  private _active = false;
  private _x = 0.5;
  private _y = 0.5;
  private _joinDistanceThreshold = DEFAULT_JOIN_DISTANCE_THRESHOLD;

  constructor(joinThreshold = DEFAULT_JOIN_DISTANCE_THRESHOLD) {
    this._joinDistanceThreshold = joinThreshold;
  }

  get isActive(): boolean { return this._active; }
  get cursorX(): number { return this._x; }
  get cursorY(): number { return this._y; }

  /**
   * 매 프레임 호출: 양손 좌표로 합장 감지
   * @param leftX 왼손 정규화 X
   * @param leftY 왼손 정규화 Y
   * @param rightX 오른손 정규화 X
   * @param rightY 오른손 정규화 Y
   */
  update(leftX: number, leftY: number, rightX: number, rightY: number): MenuCursorResult {
    const dx = leftX - rightX;
    const dy = leftY - rightY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this._active = distance < this._joinDistanceThreshold;

    if (this._active) {
      this._x = (leftX + rightX) / 2;
      this._y = (leftY + rightY) / 2;
    }

    return {
      active: this._active,
      x: this._x,
      y: this._y,
      distance,
    };
  }

  reset(): void {
    this._active = false;
    this._x = 0.5;
    this._y = 0.5;
  }
}
