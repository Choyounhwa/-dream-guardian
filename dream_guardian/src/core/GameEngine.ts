/**
 * GameEngine - 메인 게임 루프 및 시간 제어
 *
 * requestAnimationFrame 기반 60fps 메인 루프
 * deltaTime 계산 및 스파이크 방지 최대 델타 캡
 * update(dt) / render() 파이프라인 호출
 *
 * @see Issue #3 (GitHub #68)
 */

/** 외부에서 주입하는 update/render 콜백 */
export interface GameLoopCallbacks {
  update(dt: number): void;
  render(): void;
}

/** 최대 델타타임 캡 (200ms = 5fps 이하 스파이크 방지) */
const MAX_DELTA_MS = 200;

export class GameEngine {
  private _running = false;
  private _paused = false;
  private _lastTimestamp = -1;
  private _rafId = 0;
  private _elapsedTime = 0;
  private _frameCount = 0;

  private readonly _callbacks: GameLoopCallbacks;

  /** 테스트용: 외부에서 주입 가능한 rAF/cancelRAF */
  private _requestFrame: (cb: FrameRequestCallback) => number;
  private _cancelFrame: (id: number) => void;

  constructor(
    callbacks: GameLoopCallbacks,
    options?: {
      requestFrame?: (cb: FrameRequestCallback) => number;
      cancelFrame?: (id: number) => void;
    },
  ) {
    this._callbacks = callbacks;

    // 테스트 환경에서 rAF가 없을 수 있으므로 주입 가능
    this._requestFrame =
      options?.requestFrame ??
      (typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame.bind(globalThis)
        : (_cb: FrameRequestCallback) => 0);
    this._cancelFrame =
      options?.cancelFrame ??
      (typeof cancelAnimationFrame !== 'undefined'
        ? cancelAnimationFrame.bind(globalThis)
        : (_id: number) => {});
  }

  /** 현재 실행 중인지 */
  get running(): boolean {
    return this._running;
  }

  /** 현재 일시정지 상태인지 */
  get paused(): boolean {
    return this._paused;
  }

  /** 누적 경과 시간 (초 단위) */
  get elapsedTime(): number {
    return this._elapsedTime;
  }

  /** 누적 프레임 수 */
  get frameCount(): number {
    return this._frameCount;
  }

  /** 게임 루프 시작 */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this._lastTimestamp = -1;
    this._rafId = this._requestFrame(this._loop);
  }

  /** 게임 루프 완전 정지 */
  stop(): void {
    if (!this._running) return;
    this._running = false;
    this._paused = false;
    this._cancelFrame(this._rafId);
    this._rafId = 0;
  }

  /** 일시정지: 시간 흐름 멈춤, 루프는 유지 */
  pause(): void {
    if (!this._running || this._paused) return;
    this._paused = true;
  }

  /** 재개: 일시정지 해제, 타임스탬프 리셋으로 시간 점프 방지 */
  resume(): void {
    if (!this._running || !this._paused) return;
    this._paused = false;
    this._lastTimestamp = -1; // 다음 프레임에서 기준점 리셋
  }

  /** 누적 시간 및 프레임 카운터 초기화 */
  reset(): void {
    this._elapsedTime = 0;
    this._frameCount = 0;
    this._lastTimestamp = -1;
  }

  /** rAF 콜백 (arrow function으로 this 바인딩 보장) */
  private _loop = (timestamp: number): void => {
    if (!this._running) return;

    // 다음 프레임 예약 (먼저 예약하여 끊김 방지)
    this._rafId = this._requestFrame(this._loop);

    // 일시정지 상태에서는 render만 호출
    if (this._paused) {
      this._callbacks.render();
      return;
    }

    // 델타타임 계산
    if (this._lastTimestamp < 0) {
      this._lastTimestamp = timestamp;
      return; // 첫 프레임은 기준점 설정만
    }

    let deltaMs = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    // 스파이크 방지: 최대 델타 캡
    if (deltaMs > MAX_DELTA_MS) {
      deltaMs = MAX_DELTA_MS;
    }

    // 음수 방지
    if (deltaMs < 0) {
      deltaMs = 0;
    }

    const dt = deltaMs / 1000; // 초 단위 변환

    this._elapsedTime += dt;
    this._frameCount++;

    // update → render 파이프라인
    this._callbacks.update(dt);
    this._callbacks.render();
  };
}
