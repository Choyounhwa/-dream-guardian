/**
 * MenuInput - 양손 합장 제스처 메뉴 입력기
 *
 * 양손 손바닥을 모으면 메뉴 커서 활성화
 * 합장 위치의 중점으로 메뉴 항목 선택
 *
 * Issue #724 (FEAT-INPUT-JOIN-001): join 임계치 이하에서 최소 체류시간(dwell)을
 * 충족해야 활성화되며, release 임계치까지는 히스테리시스로 활성/적분 상태를 유지한다.
 *
 * @see Issue #19 (GitHub #84), Issue #724
 */

import {
  DEFAULT_JOINED_HANDS_CONFIG,
  type JoinedHandsGestureConfig,
} from '../../config/cursor.config.js';

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

/** dt 방어: NaN/음수/Infinity는 0으로 취급 */
function sanitizeDt(dt: number): number {
  return Number.isFinite(dt) && dt > 0 ? dt : 0;
}

export class MenuInput {
  private _active = false;
  private _x = 0.5;
  private _y = 0.5;
  private _dwellSec = 0;
  private readonly _config: Readonly<JoinedHandsGestureConfig>;

  constructor(config: Partial<JoinedHandsGestureConfig> = {}) {
    this._config = Object.freeze({ ...DEFAULT_JOINED_HANDS_CONFIG, ...config });
  }

  get isActive(): boolean { return this._active; }
  get cursorX(): number { return this._x; }
  get cursorY(): number { return this._y; }
  /** 현재 누적 체류 시간 (초) */
  get dwellSec(): number { return this._dwellSec; }

  /**
   * 매 프레임 호출: 양손 좌표로 합장 감지
   * @param leftX 왼손 정규화 X
   * @param leftY 왼손 정규화 Y
   * @param rightX 오른손 정규화 X
   * @param rightY 오른손 정규화 Y
   * @param dt 프레임 경과 시간 (초, 미전달 시 0 → 체류 적분 없음)
   */
  update(leftX: number, leftY: number, rightX: number, rightY: number, dt = 0): MenuCursorResult {
    const distance = Math.hypot(leftX - rightX, leftY - rightY);
    const { joinDistanceThreshold, releaseDistanceThreshold, requiredDwellSec } = this._config;

    if (distance > releaseDistanceThreshold) {
      this._active = false;
      this._dwellSec = 0;
    } else if (!this._active && distance <= joinDistanceThreshold) {
      this._dwellSec += sanitizeDt(dt);
      if (this._dwellSec >= requiredDwellSec) {
        this._active = true;
      }
    }
    // join < distance <= release: 활성 유지 / 비활성 시 dwell 유지 (히스테리시스)

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
    this._dwellSec = 0;
  }
}
