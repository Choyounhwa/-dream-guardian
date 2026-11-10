/**
 * AssaultInputRouter.ts - 보스 접근전(Boss Assault) 입력 라우팅 및 폴백 디스패치 전담 라우터
 *
 * [ASSAULT-LOOP-08] (Issue #701)
 * - AssaultSessionWireHelper에서 비대화된 포즈 입력(handlePose) 및 폴백 이벤트(dispatchFallbackEvent)
 *   처리 책임을 전담 분리 추출.
 * - 단일 책임 원칙(SRP) 및 1,000줄 가드레일 준수.
 */

import type { PoseFrame } from '../../types/pose-frame.js';

export interface AssaultInputClock {
  readonly activeSeconds: number;
  readonly isFrozen?: boolean;
  readonly isPaused?: boolean;
  readonly isTrackingLost?: boolean;
  readonly isFallbackMode?: boolean;
  readonly needsMotionReprep?: boolean;
  readonly primaryPauseReason?: string | null;
  toRoundRelativeSeconds?(activeTimestampSeconds?: number): number;
  setTrackingLost?(lost: boolean): void;
  acknowledgeResume?(): unknown;
  normalizeInput?(raw: {
    timestampMs: number;
    compensatedTimestampMs?: number;
    hand?: 'left' | 'right';
    inputId?: string;
    source?: string;
    roundId?: string;
  }): { accepted: boolean; activeTimestampSeconds?: number; inputId?: string } | null;
}

export interface AssaultInputRoundTarget {
  readonly roundId: string;
  readonly isCompleted: boolean;
  readonly isPaused: boolean;
  readonly currentLoopSegment?: { kind: string; [key: string]: unknown } | null;
  getCurrentLoopSegment?(): { kind: string; [key: string]: unknown } | null;
  pause(reason: string): void;
  resume(): void;
  submitPunch(hand: 'left' | 'right', timestampMs: number, meta?: { activeSeconds?: number; inputId?: string }): void;
  submitSquat(posture: string, timestampMs: number, meta?: { activeSeconds?: number; inputId?: string }): void;
  submitSquatResult?(result: unknown, meta?: { activeSeconds?: number }): void;
}

export interface AssaultInputFinaleTarget {
  handlePunch(event: { hand: 'left' | 'right'; timestampMs: number; activeSeconds: number }): void;
  handleSquat(event: { isDucking: boolean; posture: string; timestampMs: number; activeSeconds: number }): void;
  handleJump(event: { isJumping: boolean; isLowImpact: boolean; motionKind?: string; posture?: string; timestampMs: number; activeSeconds: number }): void;
}

export interface AssaultFallbackEvent {
  action: 'left_punch' | 'right_punch' | 'squat' | 'jump' | string;
  timestampMs: number;
  touchIdentifier?: number;
  [key: string]: unknown;
}

export interface AssaultPunchEvent {
  readonly hand: 'left' | 'right';
  readonly rawTimestampMs?: number;
  readonly compensatedTimestampMs?: number;
  readonly inputId?: string;
}

export interface AssaultSquatResult {
  readonly isDucking?: boolean;
  readonly posture?: string;
}

export interface AssaultJumpMotionResult {
  readonly isJumping?: boolean;
  readonly isLowImpact?: boolean;
  readonly motionKind?: string;
  readonly posture?: string;
}

export interface AssaultInputAdapters {
  readonly punchAdapter?: {
    update(payload: {
      timestampMs: number;
      landmarks: any;
      poseFrame?: PoseFrame | null;
    }): readonly AssaultPunchEvent[] | null | undefined;
  };
  readonly squatAdapter?: {
    update(payload: { timestampMs: number; landmarks: readonly unknown[]; baseline?: unknown }): AssaultSquatResult | null | undefined;
  };
  readonly guardAdapter?: {
    update(payload: { timestampMs: number; landmarks: readonly unknown[]; baseline?: unknown }): AssaultSquatResult | null | undefined;
  };
  readonly jumpAdapter?: {
    update(payload: { timestampMs: number; landmarks: readonly unknown[] }): AssaultJumpMotionResult | null | undefined;
  };
  readonly fallbackAdapter?: {
    handleKeyDown?(opts: { key: string; code: string; repeat: boolean; timestampMs: number; sessionId?: string }): AssaultFallbackEvent | null | undefined;
    handleTouchStart?(opts: { x: number; y: number; timestampMs: number; sessionId?: string }): AssaultFallbackEvent | null | undefined;
    handleTouchEnd?(opts: { identifier?: number; x: number; y: number; timestampMs: number; sessionId?: string }): unknown;
    handleKeyUp?(opts: { key: string; code: string; repeat: boolean; timestampMs: number; sessionId?: string }): unknown;
  };
}

export interface AssaultInputRouterDependencies {
  readonly getRawSession?: () => unknown;
  readonly getClock: () => AssaultInputClock | null | undefined;
  readonly getActiveRound: () => AssaultInputRoundTarget | null | undefined;
  readonly getFinaleController?: () => AssaultInputFinaleTarget | null | undefined;
  readonly getAdapters?: () => AssaultInputAdapters | null | undefined;
  readonly onPunchImpact?: (activeRound: AssaultInputRoundTarget, hand: 'left' | 'right') => void;
  readonly isDisposed?: () => boolean;
  readonly getSessionId?: () => string | undefined;
  readonly getExerciseTally?: () => any;
  readonly getPoseFrame?: () => PoseFrame | null | undefined;
}

export class AssaultInputRouter {
  constructor(private readonly _deps: AssaultInputRouterDependencies) {}

  public get dependencies(): AssaultInputRouterDependencies {
    return this._deps;
  }

  /**
   * 포즈 랜드마크 입력 처리 (어댑터 갱신, 시간축 정규화, 펀치/스쿼트/점프 라우팅)
   */
  public handlePose(
    _sourceLandmarks: readonly unknown[],
    normalizedLandmarks?: readonly unknown[],
    _dt?: number,
  ): void {
    if (this._deps.isDisposed?.()) return;

    const timestampMs = performance.now();
    const clock = this._deps.getClock?.() ?? (this._deps.getRawSession?.() as any)?.clock;
    const activeSeconds = clock?.toRoundRelativeSeconds
      ? clock.toRoundRelativeSeconds()
      : (clock?.activeSeconds ?? 0);
    const finale = this._deps.getFinaleController?.();
    const activeRound = this._deps.getActiveRound?.();
    const adapters = this._deps.getAdapters?.() ?? (this._deps.getRawSession?.() as AssaultInputAdapters | undefined);

    // 랜드마크 유효성 기반 추적 상실(trackingLost) 상태 동기화
    const isTrackingLost =
      !normalizedLandmarks ||
      normalizedLandmarks.length === 0 ||
      (normalizedLandmarks.length >= 33 &&
        ((normalizedLandmarks[15] as { visibility?: number } | undefined)?.visibility ?? 0) < 0.5 &&
        ((normalizedLandmarks[16] as { visibility?: number } | undefined)?.visibility ?? 0) < 0.5);

    if (clock) {
      clock.setTrackingLost?.(isTrackingLost);
      if (activeRound && !activeRound.isCompleted) {
        if (clock.isFrozen && !activeRound.isPaused) {
          activeRound.pause(clock.primaryPauseReason ?? 'clock_frozen');
        } else if (!clock.isFrozen && activeRound.isPaused) {
          activeRound.resume();
        }
      }
      // [BUG-ASSAULT-PUNCH-001 / #722] 정상 포즈 프레임 수신 시 영구 락 방지를 위해 acknowledgeResume 즉시 호출
      if (!clock.isFrozen && !isTrackingLost && clock.needsMotionReprep) {
        clock.acknowledgeResume?.();
      }
    }

    // 추적 상실(화면 이탈) 중이거나 모션 재준비(needsMotionReprep) 중인 경우 카메라 의사타격 차단 (fallback 모드 제외)
    if (!clock?.isFallbackMode && (clock?.isFrozen || clock?.needsMotionReprep || isTrackingLost)) {
      return;
    }

    if (adapters?.punchAdapter && normalizedLandmarks) {
      const poseFrame = this._deps.getPoseFrame?.();
      const punchEvents = adapters.punchAdapter.update({
        timestampMs,
        landmarks: normalizedLandmarks,
        ...(poseFrame ? { poseFrame } : {}),
      });
      if (finale && punchEvents && punchEvents.length > 0) {
        for (const pe of punchEvents) {
          finale.handlePunch({ hand: pe.hand, timestampMs, activeSeconds });
        }
      } else if (activeRound && !activeRound.isCompleted && punchEvents && punchEvents.length > 0) {
        const segmentKind =
          activeRound.currentLoopSegment?.kind ??
          (activeRound as any).getCurrentLoopSegment?.()?.kind ??
          (activeRound as any).currentSegment?.kind;
        if (segmentKind !== 'run_question') {
          for (const pe of punchEvents) {
            const norm = clock?.normalizeInput
              ? clock.normalizeInput({
                  timestampMs: pe.rawTimestampMs ?? timestampMs,
                  compensatedTimestampMs: pe.compensatedTimestampMs,
                  hand: pe.hand,
                  inputId: pe.inputId,
                  source: 'camera',
                  roundId: activeRound.roundId,
                })
              : null;
            if (norm && !norm.accepted) {
              continue;
            }
            const roundTimestampMs = Math.round(activeSeconds * 1000);
            activeRound.submitPunch(pe.hand, roundTimestampMs, {
              activeSeconds,
              inputId: pe.inputId,
            });
            this._deps.onPunchImpact?.(activeRound, pe.hand);
          }
        }
      }
    }

    const squatAdapter = adapters?.squatAdapter;
    const guardAdapter = adapters?.guardAdapter;
    if (normalizedLandmarks) {
      // 자동 베이스라인 폴백 주입 (베이스라인 미설정 시)
      const lm = normalizedLandmarks as Array<{ x?: number; y?: number }>;
      const sWidth = Math.abs((lm[12]?.x ?? 0.6) - (lm[11]?.x ?? 0.4)) || 0.25;
      const sY = ((lm[11]?.y ?? 0.35) + (lm[12]?.y ?? 0.35)) / 2;
      const nY = lm[0]?.y ?? 0.2;
      const hY = ((lm[23]?.y ?? 0.6) + (lm[24]?.y ?? 0.6)) / 2;
      const autoBaseline = { shoulderWidth: sWidth, shoulderY: sY, noseY: nY, hipY: hY };

      let effectiveSquatResult: AssaultSquatResult | null = null;
      if (squatAdapter && typeof squatAdapter.update === 'function') {
        effectiveSquatResult = squatAdapter.update({ timestampMs, landmarks: normalizedLandmarks, baseline: autoBaseline }) ?? null;
      }
      if (guardAdapter && typeof guardAdapter.update === 'function') {
        const guardResult = guardAdapter.update({ timestampMs, landmarks: normalizedLandmarks, baseline: autoBaseline });
        if (guardResult && (guardResult.isDucking || guardResult.posture === 'ducking' || guardResult.posture === 'guarding')) {
          effectiveSquatResult = guardResult;
        }
      }

      const isDuckOrGuard = Boolean(
        effectiveSquatResult &&
        (effectiveSquatResult.isDucking ||
          effectiveSquatResult.posture === 'ducking' ||
          effectiveSquatResult.posture === 'guarding')
      );

      if (finale && effectiveSquatResult && isDuckOrGuard) {
        finale.handleSquat({
          isDucking: Boolean(effectiveSquatResult.isDucking),
          posture: effectiveSquatResult.posture ?? 'ducking',
          timestampMs,
          activeSeconds,
        });
      } else if (
        activeRound &&
        !activeRound.isCompleted &&
        effectiveSquatResult
      ) {
        const hasSquatResultHandler = typeof activeRound.submitSquatResult === 'function';
        if (hasSquatResultHandler || isDuckOrGuard) {
          const norm = clock?.normalizeInput
            ? clock.normalizeInput({
                timestampMs,
                source: 'camera',
                roundId: activeRound.roundId,
              })
            : null;
          if (!norm || norm.accepted) {
            const roundTimestampMs = Math.round(activeSeconds * 1000);
            if (hasSquatResultHandler && activeRound.submitSquatResult) {
              activeRound.submitSquatResult(
                {
                  ...effectiveSquatResult,
                  timestampMs: roundTimestampMs,
                },
                { activeSeconds },
              );
            } else if (isDuckOrGuard) {
              activeRound.submitSquat(
                effectiveSquatResult.posture ?? 'ducking',
                roundTimestampMs,
                { activeSeconds },
              );
            }
          }
        }
      }
    }

    const jumpAdapter = adapters?.jumpAdapter;
    if (jumpAdapter && normalizedLandmarks && typeof jumpAdapter.update === 'function') {
      const jumpResult = jumpAdapter.update({ timestampMs, landmarks: normalizedLandmarks });
      const isLowImpact =
        jumpResult?.motionKind === 'low_impact' || jumpResult?.isLowImpact === true;
      if (finale && jumpResult && (jumpResult.isJumping || isLowImpact)) {
        finale.handleJump({
          isJumping: Boolean(jumpResult.isJumping),
          isLowImpact,
          motionKind: jumpResult.motionKind,
          posture: jumpResult.posture,
          timestampMs,
          activeSeconds,
        });
      }
    }
  }

  /**
   * 러닝 스텝(stepped) 입력 처리
   * [ASSAULT-LOOP-11] run_question 구간에서만 exerciseTally.recordRunStep으로 실측 기록
   */
  public handleStep(
    stepped: boolean,
    options?: {
      timestampMs?: number;
      activeSeconds?: number;
      inputId?: string;
    },
  ): boolean {
    if (!stepped || this._deps.isDisposed?.()) return false;
    const activeRound = this._deps.getActiveRound?.();
    if (!activeRound || activeRound.isCompleted || activeRound.isPaused) return false;

    const segmentKind =
      activeRound.currentLoopSegment?.kind ??
      (activeRound as any).getCurrentLoopSegment?.()?.kind ??
      (activeRound as any).currentSegment?.kind;
    if (segmentKind !== 'run_question') return false;

    const clock = this._deps.getClock?.() ?? (this._deps.getRawSession?.() as any)?.clock;
    if (
      clock?.isFrozen ||
      (clock as any)?.isPaused ||
      (clock as any)?.isTrackingLost ||
      clock?.needsMotionReprep
    ) {
      return false;
    }

    const exerciseTally =
      this._deps.getExerciseTally?.() ??
      (this._deps.getRawSession?.() as any)?.exerciseTally ??
      (activeRound as any)?.exerciseTally;
    if (!exerciseTally || typeof exerciseTally.recordRunStep !== 'function') {
      return false;
    }

    const timestampMs = options?.timestampMs ?? performance.now();
    const activeSeconds = options?.activeSeconds ?? clock?.activeSeconds ?? 0;
    const roundId = activeRound.roundId ?? 'round_0';
    const defaultInputId = `step_${roundId}_${Math.round(activeSeconds * 1000)}_${Math.round(timestampMs)}`;
    const rawInputId = options?.inputId ?? defaultInputId;

    const norm = clock?.normalizeInput
      ? clock.normalizeInput({
          timestampMs,
          source: 'running',
          roundId,
          inputId: rawInputId,
        })
      : null;
    if (norm && !norm.accepted) {
      return false;
    }

    const effectiveInputId = norm?.inputId ?? rawInputId;
    const effectiveActiveSeconds = norm?.activeTimestampSeconds ?? activeSeconds;

    return exerciseTally.recordRunStep({
      inputId: effectiveInputId,
      roundId,
      isValid: true,
      timestampMs,
      activeTimestampSeconds: effectiveActiveSeconds,
    });
  }

  /**
   * 키보드/터치 폴백 액션 이벤트 디스패치
   */
  public dispatchFallbackEvent(
    fbEvent: AssaultFallbackEvent | null | undefined,
    source: 'keyboard' | 'touch',
  ): void {
    if (!fbEvent) return;

    const finale = typeof this._deps.getFinaleController === 'function' ? this._deps.getFinaleController() : null;
    const activeRound = this._deps.getActiveRound();
    const clock = this._deps.getClock() ?? (this._deps.getRawSession?.() as any)?.clock;

    if (finale) {
      const activeSeconds = clock?.activeSeconds ?? 0;
      if (fbEvent.action === 'left_punch') {
        finale.handlePunch({ hand: 'left', timestampMs: fbEvent.timestampMs, activeSeconds });
      } else if (fbEvent.action === 'right_punch') {
        finale.handlePunch({ hand: 'right', timestampMs: fbEvent.timestampMs, activeSeconds });
      } else if (fbEvent.action === 'squat') {
        finale.handleSquat({ posture: 'squatting', isDucking: true, timestampMs: fbEvent.timestampMs, activeSeconds });
      } else if (fbEvent.action === 'jump') {
        finale.handleJump({ isJumping: true, isLowImpact: false, posture: 'jumping', timestampMs: fbEvent.timestampMs, activeSeconds });
      }
    } else if (activeRound && !activeRound.isCompleted) {
      const segmentKind =
        activeRound.currentLoopSegment?.kind ??
        (activeRound as any).getCurrentLoopSegment?.()?.kind ??
        (activeRound as any).currentSegment?.kind;

      // [ASSAULT-LOOP-11] run_question 구간에서는 좌/우 punch 폴백을 runStep 증거로 변환하여 기록
      if (segmentKind === 'run_question' && (fbEvent.action === 'left_punch' || fbEvent.action === 'right_punch')) {
        if (
          clock?.isFrozen ||
          (clock as any)?.isPaused ||
          (clock as any)?.isTrackingLost ||
          clock?.needsMotionReprep ||
          activeRound.isPaused
        ) {
          return;
        }

        const hand = fbEvent.action === 'left_punch' ? 'left' : 'right';
        const norm = clock?.normalizeInput
          ? clock.normalizeInput({
              timestampMs: fbEvent.timestampMs,
              hand,
              source: `${source}_run_step`,
              roundId: activeRound.roundId,
            })
          : null;

        if (!norm || norm.accepted) {
          const exerciseTally =
            this._deps.getExerciseTally?.() ??
            (this._deps.getRawSession?.() as any)?.exerciseTally ??
            (activeRound as any)?.exerciseTally;
          if (exerciseTally && typeof exerciseTally.recordRunStep === 'function') {
            const activeSeconds = norm?.activeTimestampSeconds ?? clock?.activeSeconds ?? 0;
            const inputId = norm?.inputId ?? `step_fb_${source}_${activeRound.roundId}_${Math.round(fbEvent.timestampMs)}`;
            exerciseTally.recordRunStep({
              inputId,
              roundId: activeRound.roundId,
              isValid: true,
              timestampMs: fbEvent.timestampMs,
              activeTimestampSeconds: activeSeconds,
            });
          }
        }
        return;
      }

      if (segmentKind === 'run_question') {
        // run_question 구간에서는 squat/jump 등 기타 폴백이 답안이나 회피로 오인되지 않도록 차단
        return;
      }

      const hand = fbEvent.action === 'left_punch' ? 'left' : fbEvent.action === 'right_punch' ? 'right' : undefined;
      const norm = clock?.normalizeInput
        ? clock.normalizeInput({
            timestampMs: fbEvent.timestampMs,
            hand,
            source,
            roundId: activeRound.roundId,
          })
        : null;
      if (!norm || norm.accepted) {
        const activeSeconds = clock?.toRoundRelativeSeconds
          ? (norm?.activeTimestampSeconds !== undefined && norm.activeTimestampSeconds > 0
              ? clock.toRoundRelativeSeconds(norm.activeTimestampSeconds)
              : clock.toRoundRelativeSeconds())
          : (clock?.activeSeconds ?? 0);
        const roundTimestampMs = Math.round(activeSeconds * 1000);
        if (fbEvent.action === 'left_punch') {
          activeRound.submitPunch('left', roundTimestampMs, { activeSeconds, inputId: norm?.inputId });
          this._deps.onPunchImpact?.(activeRound, 'left');
        } else if (fbEvent.action === 'right_punch') {
          activeRound.submitPunch('right', roundTimestampMs, { activeSeconds, inputId: norm?.inputId });
          this._deps.onPunchImpact?.(activeRound, 'right');
        } else if (fbEvent.action === 'squat') {
          activeRound.submitSquat('ducking', roundTimestampMs, { activeSeconds, inputId: norm?.inputId });
        }
      }
    }
  }

  /**
   * 키보드 KeyDown 입력 처리
   */
  public handleKeyDown(event: KeyboardEvent): boolean {
    if (this._deps.isDisposed?.()) return false;
    const adapters = this._deps.getAdapters?.() ?? (this._deps.getRawSession?.() as AssaultInputAdapters | undefined);
    const fallbackAdapter = adapters?.fallbackAdapter;
    if (!fallbackAdapter || typeof fallbackAdapter.handleKeyDown !== 'function') {
      return false;
    }
    const sessionId = this._deps.getSessionId?.() ?? (this._deps.getRawSession?.() as any)?.sessionId ?? '';
    const fbEvent = fallbackAdapter.handleKeyDown({
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      timestampMs: performance.now(),
      sessionId,
    });
    if (fbEvent) {
      this.dispatchFallbackEvent(fbEvent, 'keyboard');
    }
    return true;
  }

  /**
   * 화면 클릭/터치 입력 처리 (정규화 좌표)
   */
  public handleClick(normX: number, normY: number): boolean {
    if (this._deps.isDisposed?.()) return false;
    const adapters = this._deps.getAdapters?.() ?? (this._deps.getRawSession?.() as AssaultInputAdapters | undefined);
    const fallbackAdapter = adapters?.fallbackAdapter;
    if (!fallbackAdapter || typeof fallbackAdapter.handleTouchStart !== 'function') {
      return false;
    }
    const now = performance.now();
    const sessionId = this._deps.getSessionId?.() ?? (this._deps.getRawSession?.() as any)?.sessionId ?? '';
    const fbEvent = fallbackAdapter.handleTouchStart({
      x: normX,
      y: normY,
      timestampMs: now,
      sessionId,
    });
    if (typeof fallbackAdapter.handleTouchEnd === 'function') {
      fallbackAdapter.handleTouchEnd({
        identifier: fbEvent?.touchIdentifier,
        x: normX,
        y: normY,
        timestampMs: now,
        sessionId,
      });
    }
    if (fbEvent) {
      this.dispatchFallbackEvent(fbEvent, 'touch');
      return true;
    }
    return false;
  }

  /**
   * 키보드 KeyUp 입력 처리
   */
  public handleKeyUp(event: KeyboardEvent): boolean {
    if (this._deps.isDisposed?.()) return false;
    const adapters = this._deps.getAdapters?.() ?? (this._deps.getRawSession?.() as AssaultInputAdapters | undefined);
    const fallbackAdapter = adapters?.fallbackAdapter;
    if (!fallbackAdapter || typeof fallbackAdapter.handleKeyUp !== 'function') {
      return false;
    }
    const sessionId = this._deps.getSessionId?.() ?? (this._deps.getRawSession?.() as any)?.sessionId ?? '';
    fallbackAdapter.handleKeyUp({
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      timestampMs: performance.now(),
      sessionId,
    });
    return true;
  }
}
