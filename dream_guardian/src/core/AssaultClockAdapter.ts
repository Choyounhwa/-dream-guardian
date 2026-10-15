/**
 * AssaultClockAdapter.ts - 보스 접근전(Boss Assault) 공통 활성 시각 및 안전 정지 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §5.3, §15.2-B6~B8)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-08 / Issue #510)
 *
 * 절대 규칙:
 * 1. Core 레이어 단일 책임: 일시정지 제외 활성 시간축(active seconds) 정규화 및 정지/재개 어댑터만 담당.
 * 2. 콘텐츠, 판정, 이펙트, UI 렌더링을 일체 수행하지 않는다.
 * 3. 새 requestAnimationFrame, setInterval 루프 등록 0회.
 * 4. window, document 등 DOM 이벤트 리스너 직접 등록 0회 (순수 어댑터 클래스).
 * 5. performance.now와 engine.elapsedTime을 직접 비교하거나 정지 기간을 소급 가산하지 않는다.
 */

import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';

/** 안전 정지 요인 */
export type AssaultPauseReason =
  | 'pause'
  | 'hidden'
  | 'tracking_lost'
  | 'frame_delta_exceeded';

/** 입력 거부/폐기 사유 */
export type AssaultInputDiscardReason =
  | AssaultPauseReason
  | 'clock_frozen'
  | 'backwards_timestamp'
  | 'duplicate_timestamp';

/** 모션/폴백 원본 입력 계약 */
export interface AssaultRawInput {
  readonly timestampMs: number;
  readonly inputId?: string;
  readonly hand?: 'left' | 'right';
  readonly [key: string]: unknown;
}

/** 정상 수락된 정규화 입력 결과 */
export interface AssaultNormalizedInput {
  readonly accepted: true;
  readonly rawTimestampMs: number;
  readonly compensatedTimestampMs: number;
  readonly activeTimestampSeconds: number;
  readonly latencyMs: number;
  readonly inputId?: string;
  readonly hand?: 'left' | 'right';
  readonly originalInput?: AssaultRawInput;
}

/** 거부/폐기된 입력 결과 */
export interface AssaultRejectedInput {
  readonly accepted: false;
  readonly rawTimestampMs: number;
  readonly compensatedTimestampMs: number;
  readonly reason: AssaultInputDiscardReason;
  readonly inputId?: string;
  readonly hand?: 'left' | 'right';
}

/** 정규화 입력 판정 유니온 */
export type AssaultNormalizedInputResult =
  | AssaultNormalizedInput
  | AssaultRejectedInput;

/** 정지 복귀 시 출력 신호 */
export interface AssaultClockResumeSignal {
  readonly resumed: boolean;
  readonly wasPausedDuringAttack: boolean;
  readonly needsMotionReprep: boolean;
  readonly resumeReadyBeats: number;
}

/** 어댑터 설정 옵션 */
export interface AssaultClockOptions {
  readonly inputLatencyMs?: number;
  readonly maxFrameDeltaSeconds?: number;
  readonly isFallbackMode?: boolean;
  readonly resumeReadyBeats?: number;
  readonly bpm?: number;
}

export class AssaultClockAdapter {
  private readonly _inputLatencyMs: number;
  private readonly _maxFrameDeltaSeconds: number;
  private readonly _resumeReadyBeats: number;
  private readonly _bpm: number;

  private _isFallbackMode: boolean;
  private _activeSeconds = 0;

  private _isPaused = false;
  private _isHidden = false;
  private _isTrackingLost = false;
  private _isFrameDeltaExceeded = false;

  private _isAttackActive = false;
  private _wasFrozen = false;
  private _wasPausedDuringAttack = false;
  private _needsMotionReprep = false;
  private _justResumed = false;

  private _lastAcceptedRawTimestampMs: number | null = null;
  private _lastEngineTimestampMs: number | null = null;

  constructor(options: AssaultClockOptions = {}) {
    this._inputLatencyMs =
      options.inputLatencyMs ?? DEFAULT_ASSAULT_INPUT_CONFIG.inputLatencyMs;
    this._maxFrameDeltaSeconds = options.maxFrameDeltaSeconds ?? 0.25;
    this._isFallbackMode = options.isFallbackMode ?? false;
    this._resumeReadyBeats =
      options.resumeReadyBeats ?? DEFAULT_ASSAULT_CONFIG.resumeReadyBeats;
    this._bpm = options.bpm ?? 100;
  }

  // ─── Getters ───

  public get inputLatencyMs(): number {
    return this._inputLatencyMs;
  }

  public get maxFrameDeltaSeconds(): number {
    return this._maxFrameDeltaSeconds;
  }

  public get resumeReadyBeats(): number {
    return this._resumeReadyBeats;
  }

  public get bpm(): number {
    return this._bpm;
  }

  public get isFallbackMode(): boolean {
    return this._isFallbackMode;
  }

  public get activeSeconds(): number {
    return this._activeSeconds;
  }

  public get isFrozen(): boolean {
    if (this._isPaused) return true;
    if (this._isHidden) return true;
    if (this._isTrackingLost && !this._isFallbackMode) return true;
    if (this._isFrameDeltaExceeded) return true;
    return false;
  }

  public get pauseReasons(): readonly AssaultPauseReason[] {
    const reasons: AssaultPauseReason[] = [];
    if (this._isPaused) reasons.push('pause');
    if (this._isHidden) reasons.push('hidden');
    if (this._isTrackingLost && !this._isFallbackMode) reasons.push('tracking_lost');
    if (this._isFrameDeltaExceeded) reasons.push('frame_delta_exceeded');
    return reasons;
  }

  public get primaryPauseReason(): AssaultPauseReason | null {
    const reasons = this.pauseReasons;
    return reasons.length > 0 ? reasons[0] : null;
  }

  public get isAttackActive(): boolean {
    return this._isAttackActive;
  }

  public get wasPausedDuringAttack(): boolean {
    return this._wasPausedDuringAttack;
  }

  public get needsMotionReprep(): boolean {
    return this._needsMotionReprep;
  }

  public get resumeReady(): boolean {
    return !this.isFrozen && !this._needsMotionReprep;
  }

  // ─── State Modifiers ───

  public setPaused(paused: boolean): void {
    if (this._isPaused === paused) return;
    this._isPaused = paused;
    this._syncFreezeTransition();
  }

  public setHidden(hidden: boolean): void {
    if (this._isHidden === hidden) return;
    this._isHidden = hidden;
    this._syncFreezeTransition();
  }

  public setTrackingLost(lost: boolean): void {
    if (this._isTrackingLost === lost) return;
    this._isTrackingLost = lost;
    this._syncFreezeTransition();
  }

  public setFallbackMode(fallback: boolean): void {
    if (this._isFallbackMode === fallback) return;
    this._isFallbackMode = fallback;
    this._syncFreezeTransition();
  }

  public setAttackActive(active: boolean): void {
    this._isAttackActive = active;
  }

  public beginAttack(): void {
    this.setAttackActive(true);
  }

  public endAttack(): void {
    this.setAttackActive(false);
  }

  public clearMotionReprep(): void {
    this._needsMotionReprep = false;
  }

  public clearWasPausedDuringAttack(): void {
    this._wasPausedDuringAttack = false;
  }

  public acknowledgeResume(): AssaultClockResumeSignal {
    const signal: AssaultClockResumeSignal = {
      resumed: this._justResumed,
      wasPausedDuringAttack: this._wasPausedDuringAttack,
      needsMotionReprep: this._needsMotionReprep,
      resumeReadyBeats: this._resumeReadyBeats,
    };
    this._justResumed = false;
    this._needsMotionReprep = false;
    this._wasPausedDuringAttack = false;
    return signal;
  }

  public reset(initialActiveSeconds = 0): void {
    this._activeSeconds = initialActiveSeconds;
    this._lastAcceptedRawTimestampMs = null;
    this._lastEngineTimestampMs = null;
    this._isPaused = false;
    this._isHidden = false;
    this._isTrackingLost = false;
    this._isFrameDeltaExceeded = false;
    this._wasFrozen = false;
    this._wasPausedDuringAttack = false;
    this._needsMotionReprep = false;
    this._justResumed = false;
    this._isAttackActive = false;
  }

  // ─── Engine Loop Integration ───

  /**
   * 엔진 프레임 루프에서 호출되는 시간 진행 함수
   * @param deltaSeconds 프레임 델타 타임 (초)
   * @param engineTimestampMs 선택적 엔진 타임스탬프 (ms)
   */
  public update(deltaSeconds: number, engineTimestampMs?: number): void {
    // 음수 델타 무시
    const sanitizedDelta = Math.max(0, deltaSeconds);

    // 델타 초과 스파이크 감지
    if (sanitizedDelta > this._maxFrameDeltaSeconds) {
      this._isFrameDeltaExceeded = true;
      this._syncFreezeTransition();
      return;
    }

    this._isFrameDeltaExceeded = false;
    this._syncFreezeTransition();

    if (this.isFrozen) {
      // 동결 상태에서는 소급 가산하지 않고 기준 엔진 시각만 갱신
      if (engineTimestampMs !== undefined) {
        this._lastEngineTimestampMs = engineTimestampMs;
      }
      return;
    }

    // 정상 활성 시각 누적
    this._activeSeconds += sanitizedDelta;

    if (engineTimestampMs !== undefined) {
      this._lastEngineTimestampMs = engineTimestampMs;
    }
  }

  /**
   * 지정한 총 시간만큼 정상 프레임 간격으로 활성 시각을 전진시킨다.
   * (테스트 및 다중 프레임 시뮬레이션용 편의 메서드)
   */
  public advance(totalSeconds: number, finalEngineTimestampMs?: number): void {
    const step = 0.05;
    let remaining = Math.max(0, totalSeconds);
    const startEngineMs =
      finalEngineTimestampMs !== undefined
        ? finalEngineTimestampMs - totalSeconds * 1000
        : undefined;
    let currentEngineMs = startEngineMs;

    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      if (currentEngineMs !== undefined) {
        currentEngineMs += dt * 1000;
      }
      this.update(dt, currentEngineMs);
      remaining -= dt;
    }
  }

  // ─── Input Normalization ───

  /**
   * 수집된 입력 시각에서 inputLatencyMs를 감산 정규화하고 유효성을 평가한다.
   * - 동결 중인 경우 폐기
   * - 이전 승인 시각 대비 역행 또는 중복 시각인 경우 거부
   */
  public normalizeInput(
    rawInput: number | AssaultRawInput
  ): AssaultNormalizedInputResult {
    const isObject = typeof rawInput === 'object' && rawInput !== null;
    const rawTimestampMs = isObject ? rawInput.timestampMs : rawInput;
    const inputId = isObject ? rawInput.inputId : undefined;
    const hand = isObject ? rawInput.hand : undefined;

    const compensatedTimestampMs = Math.max(
      0,
      rawTimestampMs - this._inputLatencyMs
    );

    // 1. 동결 상태 확인
    if (this.isFrozen) {
      return {
        accepted: false,
        rawTimestampMs,
        compensatedTimestampMs,
        reason: this.primaryPauseReason ?? 'clock_frozen',
        inputId,
        hand,
      };
    }

    // 2. 단조 증가성 확인 (역행 / 중복 차단)
    if (this._lastAcceptedRawTimestampMs !== null) {
      if (rawTimestampMs < this._lastAcceptedRawTimestampMs) {
        return {
          accepted: false,
          rawTimestampMs,
          compensatedTimestampMs,
          reason: 'backwards_timestamp',
          inputId,
          hand,
        };
      }
      if (rawTimestampMs === this._lastAcceptedRawTimestampMs) {
        return {
          accepted: false,
          rawTimestampMs,
          compensatedTimestampMs,
          reason: 'duplicate_timestamp',
          inputId,
          hand,
        };
      }
    }

    // 3. 입력 승인 및 활성 시각 산출
    this._lastAcceptedRawTimestampMs = rawTimestampMs;

    let activeTimestampSeconds: number;
    if (
      this._lastEngineTimestampMs !== null &&
      rawTimestampMs <= this._lastEngineTimestampMs
    ) {
      const timeAgoMs = this._lastEngineTimestampMs - compensatedTimestampMs;
      activeTimestampSeconds = Math.max(
        0,
        this._activeSeconds - timeAgoMs / 1000
      );
    } else {
      activeTimestampSeconds = Math.max(
        0,
        this._activeSeconds - this._inputLatencyMs / 1000
      );
    }

    return {
      accepted: true,
      rawTimestampMs,
      compensatedTimestampMs,
      activeTimestampSeconds,
      latencyMs: this._inputLatencyMs,
      inputId,
      hand,
      originalInput: isObject ? rawInput : undefined,
    };
  }

  // ─── Private Helpers ───

  private _syncFreezeTransition(): void {
    const frozenNow = this.isFrozen;

    // 정상 -> 동결 전환
    if (!this._wasFrozen && frozenNow) {
      if (this._isAttackActive) {
        this._wasPausedDuringAttack = true;
      }
    }

    // 동결 -> 정상 복귀 전환
    if (this._wasFrozen && !frozenNow) {
      this._needsMotionReprep = true;
      this._justResumed = true;
    }

    this._wasFrozen = frozenNow;
  }
}
