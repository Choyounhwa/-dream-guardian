/**
 * ReadyPositionController.ts - 스테이지 첫 진입 시 카메라 프레임 정렬 및 3초 카운트다운 컨트롤러
 *
 * @see Issue #202 [FEAT-READY-001]
 * - 스테이지 첫 진입 시 문제/러닝으로 직행하지 않고 READY_POSITION 상태 진입
 * - 3초 준비 카운트다운 (3... 2... 1... START!) 및 비프음 연동
 * - 카운트다운 동안 답안 선택 및 스텝 누적 완전 잠금 (isInputLocked)
 * - Pose 관절 정렬 상태 판정 및 Space 키 / 터치 스킵 지원
 * - 카운트다운 완료 또는 스킵 시점에 onComplete 콜백 호출로 깨끗한 러닝 페이즈 전환 보장
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';

export interface ReadyPositionControllerOptions {
  /** 총 카운트다운 시간 (초, 기본값 3.0) */
  countdownDuration?: number;
  /** START! 텍스트 노출 유지 시간 (초, 기본값 0.4) */
  startDisplayDuration?: number;
  /** 효과음 신디사이저 인터페이스 */
  sfx?: { play: (type: 'metronome_strong' | 'start') => void };
  /** 카운트다운 완료 시 호출 콜백 */
  onComplete?: () => void;
  /** 매 초 카운트 틱 콜백 (3, 2, 1) */
  onTick?: (count: number) => void;
  /** START! 신호 도달 콜백 */
  onStartSignal?: () => void;
}

export interface ReadyPositionState {
  isActive: boolean;
  isFinished: boolean;
  isInputLocked: boolean;
  readyTimer: number;
  remainingTime: number;
  currentCount: number;
  countText: string;
  isAligned: boolean;
  progress: number;
}

export type ReadyPositionRenderState = Partial<ReadyPositionState> & {
  currentCount: number;
  countText: string;
  isAligned: boolean;
};

const KEY_ALIGNMENT_LANDMARKS = [
  POSE_LANDMARKS.NOSE,
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
] as const;

export class ReadyPositionController {
  private readonly _countdownDuration: number;
  private readonly _startDisplayDuration: number;
  private readonly _sfx?: { play: (type: 'metronome_strong' | 'start') => void };
  private readonly _onComplete?: () => void;
  private readonly _onTick?: (count: number) => void;
  private readonly _onStartSignal?: () => void;

  private _isActive = false;
  private _isFinished = false;
  private _isInputLocked = false;
  private _isPaused = false;
  private _readyTimer = 3.0;
  private _currentCount = 3;
  private _isAligned = false;
  private _startSignalFired = false;
  private _startDisplayElapsed = 0;

  constructor(options?: ReadyPositionControllerOptions) {
    this._countdownDuration = options?.countdownDuration ?? 3.0;
    this._startDisplayDuration = options?.startDisplayDuration ?? 0.4;
    this._sfx = options?.sfx;
    this._onComplete = options?.onComplete;
    this._onTick = options?.onTick;
    this._onStartSignal = options?.onStartSignal;
    this._readyTimer = this._countdownDuration;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isFinished(): boolean {
    return this._isFinished;
  }

  get isInputLocked(): boolean {
    return this._isInputLocked;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get readyTimer(): number {
    return this._readyTimer;
  }

  get currentCount(): number {
    return this._currentCount;
  }

  get countText(): string {
    if (this._currentCount <= 0) {
      return 'START!';
    }
    return String(this._currentCount);
  }

  get isAligned(): boolean {
    return this._isAligned;
  }

  get progress(): number {
    if (this._countdownDuration <= 0) return 1;
    const elapsed = this._countdownDuration - this._readyTimer;
    return Math.max(0, Math.min(1, elapsed / this._countdownDuration));
  }

  getState(): ReadyPositionState {
    return {
      isActive: this._isActive,
      isFinished: this._isFinished,
      isInputLocked: this._isInputLocked,
      readyTimer: this._readyTimer,
      remainingTime: this._readyTimer,
      currentCount: this._currentCount,
      countText: this.countText,
      isAligned: this._isAligned,
      progress: this.progress,
    };
  }

  start(): void {
    this._isActive = true;
    this._isFinished = false;
    this._isInputLocked = true;
    this._readyTimer = this._countdownDuration;
    this._currentCount = Math.max(1, Math.ceil(this._readyTimer));
    this._startSignalFired = false;
    this._startDisplayElapsed = 0;

    this._sfx?.play('metronome_strong');
    this._onTick?.(this._currentCount);
  }

  update(dt: number): void {
    if (!this._isActive || this._isPaused) return;

    if (this._readyTimer > 0) {
      const prevCount = Math.max(1, Math.ceil(this._readyTimer));
      this._readyTimer = Math.max(0, this._readyTimer - dt);
      const newCount = Math.ceil(this._readyTimer);

      if (newCount > 0 && newCount < prevCount) {
        this._currentCount = newCount;
        this._sfx?.play('metronome_strong');
        this._onTick?.(newCount);
      }

      if (this._readyTimer <= 0 && !this._startSignalFired) {
        this._startSignalFired = true;
        this._currentCount = 0;
        this._sfx?.play('start');
        this._onStartSignal?.();

        if (this._startDisplayDuration <= 0) {
          this._complete();
          return;
        }
      }
    } else if (this._startSignalFired) {
      this._startDisplayElapsed += dt;
      if (this._startDisplayElapsed >= this._startDisplayDuration) {
        this._complete();
      }
    }
  }

  skip(): void {
    if (!this._isActive) return;
    this._complete();
  }

  setPaused(paused: boolean): void {
    this._isPaused = paused;
  }

  setAligned(aligned: boolean): void {
    this._isAligned = aligned;
  }

  /**
   * 주요 관절(얼굴/어깨/골반)의 가시성 및 화각 내 포함 여부를 검증하여 정렬 상태를 갱신
   */
  checkAlignment(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    virtualWidth: number,
    virtualHeight: number,
  ): boolean {
    if (!landmarks || landmarks.length < 25 || virtualWidth <= 0 || virtualHeight <= 0) {
      this._isAligned = false;
      return false;
    }

    const minX = virtualWidth * 0.05;
    const maxX = virtualWidth * 0.95;
    const minY = virtualHeight * 0.05;
    const maxY = virtualHeight * 0.95;

    for (const idx of KEY_ALIGNMENT_LANDMARKS) {
      const lm = landmarks[idx];
      if (!lm || (lm.visibility ?? 0) < 0.5) {
        this._isAligned = false;
        return false;
      }
      if (lm.x < minX || lm.x > maxX || lm.y < minY || lm.y > maxY) {
        this._isAligned = false;
        return false;
      }
    }

    this._isAligned = true;
    return true;
  }

  reset(): void {
    this._isActive = false;
    this._isFinished = false;
    this._isInputLocked = false;
    this._isPaused = false;
    this._readyTimer = this._countdownDuration;
    this._currentCount = Math.max(1, Math.ceil(this._countdownDuration));
    this._isAligned = false;
    this._startSignalFired = false;
    this._startDisplayElapsed = 0;
  }

  private _complete(): void {
    this._isActive = false;
    this._isFinished = true;
    this._isInputLocked = false;
    this._onComplete?.();
  }
}
