/**
 * AssaultSceneHandler - 보스 접근전(Boss Assault) 전용 씬 루프 및 렌더링 오케스트레이터
 *
 * [REFACTOR-CORE-004] (Issue #619)
 * - SceneDirector 내의 어설트 전용 씬 루프(update) 및 렌더링(render), HUD, 포즈 위임 처리
 * - 어설트 모드 세션 확인 및 스냅샷 우선순위 해석
 * - 단일 책임 원칙(SRP)에 따른 SceneDirector 경량화 및 Core 모듈 분리
 */

import { HORIZON_RATIO } from '../../../config/grid.config.js';
import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../../config/assault-visual.config.js';
import { AssaultSceneRenderer } from '../../render/AssaultSceneRenderer.js';
import { AssaultApproachRenderer, type AssaultApproachSnapshot } from '../../render/AssaultApproachRenderer.js';
import { AssaultFloorMatAdapter } from '../../render/assault/AssaultFloorMatAdapter.js';
import { AssaultImpactVFX } from '../../render/assault/AssaultImpactVFX.js';
import { AssaultHUD, type AssaultHUDSnapshot } from '../../ui/AssaultHUD.js';
import { toNormalizedLandmarks } from '../../utils/index.js';
import type { GameSessionContext } from '../GameSessionContext.js';
import type { MainSceneContext } from '../SceneDirector.js';

export const ASSAULT_MENU_HOVER_DWELL_TIME = 0.8;

export interface AssaultSceneHandlerOptions {
  assaultSceneRenderer?: AssaultSceneRenderer;
  assaultApproachRenderer?: AssaultApproachRenderer;
  assaultFloorMatAdapter?: AssaultFloorMatAdapter;
  assaultImpactVFX?: AssaultImpactVFX;
  sessionContextProvider?: () => GameSessionContext | undefined;
  visualConfig?: AssaultVisualConfig;
  inputRouter?: any;
}

export class AssaultSceneHandler {
  private readonly _assaultSceneRenderer: AssaultSceneRenderer;
  private readonly _assaultApproachRenderer: AssaultApproachRenderer;
  private readonly _assaultFloorMatAdapter: AssaultFloorMatAdapter;
  private readonly _assaultImpactVFX: AssaultImpactVFX;
  private readonly _sessionContextProvider?: () => GameSessionContext | undefined;
  private readonly _visualConfig?: AssaultVisualConfig;
  private readonly _fallbackHUD = new AssaultHUD();
  private _inputRouter?: any;

  constructor(options?: AssaultSceneHandlerOptions) {
    this._assaultSceneRenderer = options?.assaultSceneRenderer ?? new AssaultSceneRenderer();
    this._assaultApproachRenderer = options?.assaultApproachRenderer ?? new AssaultApproachRenderer();
    this._assaultFloorMatAdapter = options?.assaultFloorMatAdapter ?? new AssaultFloorMatAdapter();
    this._sessionContextProvider = options?.sessionContextProvider;
    this._visualConfig = options?.visualConfig;
    this._inputRouter = options?.inputRouter;
    this._assaultImpactVFX =
      options?.assaultImpactVFX ?? new AssaultImpactVFX({ visualConfig: this._visualConfig });

    // AssaultPairPainter에 타격 VFX 연동 (정답 팝핑 스케일 반영)
    if (this._assaultSceneRenderer.pairPainter?.setImpactVFX) {
      this._assaultSceneRenderer.pairPainter.setImpactVFX(this._assaultImpactVFX);
    }
  }

  public get inputRouter(): any {
    return this._inputRouter;
  }

  public setInputRouter(router: any): void {
    this._inputRouter = router;
  }

  public get assaultImpactVFX(): AssaultImpactVFX {
    return this._assaultImpactVFX;
  }

  public get assaultFloorMatAdapter(): AssaultFloorMatAdapter {
    return this._assaultFloorMatAdapter;
  }

  public get assaultSceneRenderer(): AssaultSceneRenderer {
    return this._assaultSceneRenderer;
  }

  public get assaultApproachRenderer(): AssaultApproachRenderer {
    return this._assaultApproachRenderer;
  }

  /**
   * 보스 접근전 모드 활성화 여부 확인
   */
  public isAssaultMode(ctx?: MainSceneContext, fallbackSessionContext?: GameSessionContext): boolean {
    const sContext = this._sessionContextProvider?.() ?? fallbackSessionContext ?? ctx?.sessionContext;
    if (sContext?.sessionMode === 'boss_assault') return true;
    const assaultSession = (ctx as any)?.assaultSession;
    if (assaultSession && !assaultSession.isDisposed) return true;
    const contextAssault = (sContext as any)?.assaultSession;
    if (contextAssault && !contextAssault.isDisposed) return true;
    return false;
  }

  /**
   * 활성 어설트 세션 인스턴스 조회 (폐기된 인스턴스 제외)
   */
  public getAssaultSession(ctx?: MainSceneContext, fallbackSessionContext?: GameSessionContext): any | null {
    if ((ctx as any)?.assaultSession && !(ctx as any).assaultSession.isDisposed) {
      return (ctx as any).assaultSession;
    }
    const sContext = this._sessionContextProvider?.() ?? fallbackSessionContext ?? ctx?.sessionContext;
    if ((sContext as any)?.assaultSession && !(sContext as any).assaultSession.isDisposed) {
      return (sContext as any).assaultSession;
    }
    return null;
  }

  /**
   * 보스 접근전 프레젠테이션 스냅샷 해석
   */
  public resolveSnapshot(session: any, ctx?: MainSceneContext): any | null {
    const finaleController = session?.finaleController;
    const finaleSnapshot = finaleController?.getSnapshot?.() ?? null;
    const roundPresentation =
      (typeof session?.activeRoundController?.getPresentationSnapshot === 'function'
        ? session.activeRoundController.getPresentationSnapshot()
        : null) ??
      (typeof session?.getPresentationSnapshot === 'function'
        ? session.getPresentationSnapshot()
        : null);

    const snapshot =
      session?.finalePresentationSnapshot ??
      (finaleSnapshot ? { ...finaleSnapshot, questionText: '' } : null) ??
      roundPresentation ??
      session?.presentation ??
      session?.activeRoundController?.presentation ??
      session?.snapshot ??
      (ctx as any)?.assaultPresentationSnapshot ??
      null;

    if (!snapshot) return null;

    // 세션 만료/stale 검사
    const isDisposed = Boolean(session?.isDisposed);
    const isEnded = Boolean(
      session?.isEnded ||
      session?.isAborted ||
      (session?.progressController?.isGameOver && session?.battleState && session.battleState.hp <= 0)
    );
    const lifecycle = (ctx as any)?.sessionLifecycle ?? (ctx as any)?.sessionContext?.sessionLifecycle;
    const sessionToken = session?.sessionToken ?? session?.token ?? session?.sessionId;
    const isStaleToken = Boolean(
      session?.isStale ||
      session?.stale ||
      (lifecycle &&
        lifecycle.activeAssaultSessionToken !== null &&
        lifecycle.activeAssaultSessionToken !== undefined &&
        typeof lifecycle.isValidAssaultToken === 'function' &&
        !lifecycle.isValidAssaultToken(sessionToken))
    );

    if (isDisposed || isEnded || isStaleToken) {
      if (snapshot.loop) {
        return {
          ...snapshot,
          loop: null,
        };
      }
      return snapshot;
    }

    if (!snapshot.loop && roundPresentation?.loop) {
      return {
        ...snapshot,
        loop: roundPresentation.loop,
      };
    }

    return snapshot;
  }

  /**
   * 보스 접근전(Boss Assault) 전용 씬 루프 업데이트 (DEC-B1)
   */
  public update(dt: number, ctx: MainSceneContext): void {
    const session = this.getAssaultSession(ctx);
    if (session?.clock) {
      session.clock.setPaused(Boolean(ctx.pauseModal?.isOpen));
    }
    if (ctx.pauseModal?.isOpen) {
      ctx.dreamGrid?.update(dt, 0.8);
      ctx.effectManager?.update(dt);
      return;
    }

    if (session) {
      if (typeof session.update === 'function') {
        session.update(dt, ctx);
      } else if (session.clock && typeof session.clock.update === 'function') {
        session.clock.update(
          dt,
          ctx.engine?.elapsedTime !== undefined ? ctx.engine.elapsedTime * 1000 : undefined
        );
      }

      // [ASSAULT-LOOP-11] 활성 세션의 exerciseTally.syncWithClock을 호출하여 활성 시간 동기화
      const tally = session.exerciseTally ?? session.__rawSession?.exerciseTally;
      const clock = session.clock ?? session.clockAdapter;
      if (tally && clock && typeof tally.syncWithClock === 'function') {
        tally.syncWithClock(clock);
      }
    }

    if (ctx.state?.feedbackTimer && ctx.state.feedbackTimer > 0) {
      ctx.state.feedbackTimer -= dt;
      if (ctx.state.feedbackTimer <= 0) {
        ctx.state.feedbackCustomText = null;
        ctx.state.feedbackCustomColor = null;
      }
    }
    if (ctx.state?.castingFlash && ctx.state.castingFlash > 0) {
      ctx.state.castingFlash -= dt;
    }
    ctx.guardian?.update?.(dt);
    ctx.bossRenderer?.update?.(dt);
    ctx.effectManager?.update?.(dt);
    if (ctx.effectManager) {
      this._assaultImpactVFX.setEffectManager(ctx.effectManager);
    }
    this._assaultImpactVFX.update(dt);
    ctx.boss?.update?.(dt);
    ctx.dialogueOverlayRenderer?.update?.(dt);
    // DEC-B1: 단일 종료 권위(SessionLifecycle) 원칙에 따라 HP 0 시 showResult 중복 호출 차단
  }

  /**
   * 보스 접근전 HUD 스냅샷 해석
   */
  public resolveHUDSnapshot(session: any, ctx?: MainSceneContext): AssaultHUDSnapshot | null {
    const isDisposed = Boolean(session?.isDisposed);
    const isEnded = Boolean(
      session?.isEnded ||
      session?.isAborted ||
      (session?.progressController?.isGameOver && session?.battleState && session.battleState.hp <= 0)
    );
    const lifecycle = (ctx as any)?.sessionLifecycle ?? (ctx as any)?.sessionContext?.sessionLifecycle;
    const sessionToken = session?.sessionToken ?? session?.token ?? session?.sessionId;
    const isStaleToken = Boolean(
      session?.isStale ||
      session?.stale ||
      (lifecycle &&
        lifecycle.activeAssaultSessionToken !== null &&
        lifecycle.activeAssaultSessionToken !== undefined &&
        typeof lifecycle.isValidAssaultToken === 'function' &&
        !lifecycle.isValidAssaultToken(sessionToken))
    );

    const isStaleOrEnded = isDisposed || isEnded || isStaleToken;

    let baseSnapshot: AssaultHUDSnapshot | null = null;
    if (session && typeof session.getHUDSnapshot === 'function') {
      baseSnapshot = session.getHUDSnapshot();
    } else if (session?.hudSnapshot) {
      baseSnapshot = session.hudSnapshot;
    }

    if (baseSnapshot) {
      if (isStaleOrEnded) {
        return baseSnapshot.loop !== undefined
          ? { ...baseSnapshot, loop: null }
          : baseSnapshot;
      }

      // loop 정보 추출 및 합성
      const roundPres =
        (typeof session?.activeRoundController?.getPresentationSnapshot === 'function'
          ? session.activeRoundController.getPresentationSnapshot()
          : null) ??
        (typeof session?.getPresentationSnapshot === 'function'
          ? session.getPresentationSnapshot()
          : null) ??
        session?.presentation ??
        null;

      const loop =
        baseSnapshot.loop ??
        roundPres?.loop ??
        (session as any)?.loopSnapshot ??
        null;

      if (loop !== undefined && loop !== null) {
        return {
          ...baseSnapshot,
          loop,
        };
      }
      return baseSnapshot;
    }

    const validationError =
      (ctx as any)?.assaultValidationError ??
      (ctx as any)?.assaultError ??
      (ctx?.sessionContext as any)?.assaultError ??
      session?.validationError ??
      session?.lastValidationError;

    if (!session) {
      if (validationError) {
        return {
          playerHp: (ctx as any)?.battle?.hp ?? (ctx as any)?.state?.battle?.hp ?? 100,
          playerMaxHp: (ctx as any)?.battle?.maxHp ?? (ctx as any)?.state?.battle?.maxHp ?? 100,
          completedQuestions: 0,
          targetRounds: 0,
          validationError,
        };
      }
      return null;
    }

    const playerHp =
      session.battleState?.hp ??
      (ctx as any)?.battle?.hp ??
      (ctx as any)?.state?.battle?.hp ??
      0;
    const playerMaxHp =
      session.battleState?.maxHp ??
      (ctx as any)?.battle?.maxHp ??
      (ctx as any)?.state?.battle?.maxHp ??
      100;
    const completedQuestions =
      session.progressController?.completedRounds ??
      session.progressController?.completedQuestions ??
      session.completedQuestions ??
      0;
    const targetRounds =
      session.targetRounds ??
      session.progressController?.targetRounds ??
      0;
    const strikeCount =
      session.exerciseTally?.getSummary?.()?.totalPunchCount ??
      session.exerciseTally?.totalPunchCount ??
      session.activeRoundController?.summary?.attemptedAnswerHits ??
      session.strikeCount ??
      0;
    const combo =
      session.battleState?.combo ??
      (ctx as any)?.battle?.combo ??
      (ctx as any)?.state?.battle?.combo ??
      session.combo ??
      0;
    const isPaused = Boolean(
      session.clock?.isPaused ||
      session.clock?.isFrozen ||
      session.activeRoundController?.isPaused ||
      ctx?.pauseModal?.isOpen ||
      (ctx as any)?.isPaused
    );
    const trackingLost = Boolean(
      session.clock?.isTrackingLost ||
      session.clock?.pauseReasons?.includes('tracking_lost') ||
      session.clock?.primaryPauseReason === 'tracking_lost' ||
      session.trackingLost ||
      (ctx as any)?.trackingLost
    );
    const needsMotionReprep = Boolean(
      session.clock?.needsMotionReprep ||
      session.needsMotionReprep
    );
    const isAborted = Boolean(
      session.activeRoundController?.isAborted ||
      session.progressController?.isGameOver
    );
    const isDefeated = Boolean(
      session.progressController?.isGameOver ||
      playerHp <= 0
    );

    const roundPres =
      (typeof session.activeRoundController?.getPresentationSnapshot === 'function'
        ? session.activeRoundController.getPresentationSnapshot()
        : null) ??
      (typeof session.getPresentationSnapshot === 'function'
        ? session.getPresentationSnapshot()
        : null) ??
      session.presentation ??
      null;

    const loop = isStaleOrEnded
      ? null
      : (roundPres?.loop ?? (session as any)?.loopSnapshot ?? undefined);

    return {
      sessionId: session.sessionId,
      roundId: session.activeRoundController?.roundId,
      playerHp,
      playerMaxHp,
      completedQuestions,
      targetRounds,
      strikeCount,
      strikes: strikeCount,
      combo,
      comboCount: combo,
      isPaused,
      trackingLost,
      needsMotionReprep,
      validationError,
      isAborted,
      isDefeated,
      ...(loop !== undefined ? { loop } : {}),
    };
  }

  /**
   * 보스 접근전(Boss Assault) 전용 씬 렌더링
   */
  public render(ctx: MainSceneContext): void {
    if (ctx) {
      (ctx as any).__assaultHudRendered = false;
    }
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    const vanishingX = vw * 0.5;
    const vanishingY = vh * HORIZON_RATIO;
    const chapterKey = `ch${ctx.state?.currentChapter ?? 1}`;
    const gameBg = !ctx.cameraLayer?.isActive ? ctx.imageLoader?.get?.('bg', chapterKey) : null;

    const session = this.getAssaultSession(ctx);
    const activeSeconds =
      session?.clock?.activeSeconds ??
      session?.activeSeconds ??
      ctx.engine?.elapsedTime ??
      0;
    const visualConfig = (ctx as any)?.assaultVisualConfig ?? this._visualConfig ?? DEFAULT_ASSAULT_VISUAL_CONFIG;
    const spb =
      visualConfig.gridPulseSecondsPerBeat > 0
        ? visualConfig.gridPulseSecondsPerBeat
        : 0.5;
    const beatProgress = ((activeSeconds / spb) % 1.0 + 1.0) % 1.0;

    // 화면 흔들림(Screen Shake) 변위 계산 및 적용 (ASSAULT-FX-002)
    const enableScreenShake = visualConfig.enableScreenShake !== false;
    const shakeOffsetX = enableScreenShake ? (ctx.effectManager?.shakeOffsetX ?? 0) : 0;
    const shakeOffsetY = enableScreenShake ? (ctx.effectManager?.shakeOffsetY ?? 0) : 0;

    context2d.save();
    if (shakeOffsetX !== 0 || shakeOffsetY !== 0) {
      context2d.translate(shakeOffsetX, shakeOffsetY);
    }

    try {
      if (ctx.dreamGrid) {
        ctx.dreamGrid.render(context2d, vw, vh, {
          vanishingX,
          vanishingY,
          color: '#FF8844',
          bgImage: gameBg,
          beatProgress,
        });
      }

      // 0. 바닥 판정선 어댑터 (AssaultFloorMatAdapter - ASSAULT-FX-001)
      const runningMatRenderer = ctx.runningMatRenderer ?? undefined;
      this._assaultFloorMatAdapter.render(context2d, vw, vh, {
        vanishingPoint: { x: vanishingX, y: vanishingY },
        elapsedTime: activeSeconds,
        beatProgress,
        runningMatRenderer,
        enableFloorMat: visualConfig.enableFloorMat,
      });

      // 1. 접근 진행도 연출 렌더링 (AssaultApproachRenderer)
      const approachSnapshot: AssaultApproachSnapshot | null =
        session?.getApproachSnapshot?.() ??
        session?.approachSnapshot ??
        (session?.progressController
          ? {
              progress: session.progressController.progress,
              completedQuestions: session.progressController.completedRounds ?? session.progressController.completedQuestions ?? 0,
              targetRounds: session.targetRounds ?? session.progressController.targetRounds,
              isRoundCompleted: Boolean(session.activeRoundController?.isCompleted),
            }
          : null);

      if (approachSnapshot) {
        const approachRenderer = (ctx as any)?.assaultApproachRenderer ?? this._assaultApproachRenderer;
        if (typeof approachRenderer?.renderApproachProgress === 'function') {
          approachRenderer.renderApproachProgress(context2d, approachSnapshot, { width: vw, height: vh });
        }
      }

      // 2. 공격 장면 렌더링 (AssaultSceneRenderer)
      const snapshot = this.resolveSnapshot(session, ctx);
      if (snapshot) {
        const assaultRenderer = (ctx as any)?.assaultSceneRenderer ?? this._assaultSceneRenderer;
        assaultRenderer.render(context2d, snapshot, { width: vw, height: vh });
      }

      // 2.5. 플레이어 모션 아바타 렌더링 (Issue #715: BUG-AVATAR-002)
      if (ctx.stickmanRenderer && typeof ctx.stickmanRenderer.render === 'function') {
        ctx.stickmanRenderer.render(context2d, vw, vh, { alwaysRender: true });
      }

      // 화면 이탈 감지 및 복귀 유도 가이드 UI (Card #490)
      if (ctx.postureGuideRenderer && typeof ctx.postureGuideRenderer.renderBoundaryWarning === 'function') {
        const anchorX = ctx.stickmanRenderer?.currentAnchorXRatio ?? 0.5;
        const exitDir: 'left' | 'right' | null = anchorX < 0.20 ? 'left' : anchorX > 0.80 ? 'right' : null;
        ctx.postureGuideRenderer.renderBoundaryWarning(context2d, vw, vh, exitDir);
      }

      // 3. 이펙트 매니저 렌더 연동 (ASSAULT-FX-002)
      if (typeof ctx.effectManager?.render === 'function') {
        ctx.effectManager.render(context2d, vw, vh);
      }

      // 4. 어설트 타격 이펙트 렌더 연동 (ASSAULT-FX-003)
      if (typeof this._assaultImpactVFX?.render === 'function') {
        this._assaultImpactVFX.render(context2d, vw, vh);
      }
    } finally {
      context2d.restore();
    }

    // 4. HUD 렌더링 (AssaultHUD) - 고정 좌표 보호
    const hud = session?.hud ?? (ctx as any)?.assaultHUD ?? this._fallbackHUD;
    const hudSnapshot = this.resolveHUDSnapshot(session, ctx);

    if (hud && typeof hud.render === 'function') {
      if (hudSnapshot && typeof hud.setSnapshot === 'function') {
        hud.setSnapshot(hudSnapshot);
      }
      if (typeof (hud as any).setLoopSnapshot === 'function') {
        (hud as any).setLoopSnapshot(hudSnapshot?.loop ?? null);
      }
      hud.render(context2d, vw, vh);
      if (ctx) {
        (ctx as any).__assaultHudRendered = true;
      }
    }
  }

  /**
   * 보스 접근전(Boss Assault) 전용 씬 렌더링 별칭
   */
  public renderScene(ctx: MainSceneContext): void {
    this.render(ctx);
  }

  /**
   * 보스 접근전 HUD 렌더링 위임
   */
  public renderHUD(ctx: MainSceneContext): boolean {
    const session = this.getAssaultSession(ctx);
    const hud = session?.hud ?? (ctx as any)?.assaultHUD;
    const hudSnapshot = this.resolveHUDSnapshot(session, ctx);

    if (hud) {
      if (hudSnapshot && typeof hud.setSnapshot === 'function') {
        hud.setSnapshot(hudSnapshot);
      }
      if (typeof (hud as any).setLoopSnapshot === 'function') {
        (hud as any).setLoopSnapshot(hudSnapshot?.loop ?? null);
      }
      if (
        typeof hud.render === 'function' &&
        !(ctx as any)?.__assaultHudRendered &&
        ctx.canvasManager?.ctx
      ) {
        hud.render(
          ctx.canvasManager.ctx,
          ctx.canvasManager.virtualWidth,
          ctx.canvasManager.virtualHeight,
        );
      }
    }

    if (ctx.state?.screenMode === 'game' && ctx.bottomBar) {
      const context2d = ctx.canvasManager.ctx;
      const vw = ctx.canvasManager.virtualWidth;
      const vh = ctx.canvasManager.virtualHeight;
      ctx.bottomBar.render(context2d, vw, vh, {
        actionLabel: '정지',
        actionColor: '#FF4444',
        pageId: 'pause',
        actionHoverProgress: (ctx.state.actionHoverTimer ?? 0) / ASSAULT_MENU_HOVER_DWELL_TIME,
      });
      return true;
    }
    return false;
  }

  /**
   * 포즈 랜드마크를 활성 어설트 세션으로 전달
   * [BUG-ASSAULT-002] 정규화 랜드마크(0~1 범위, 1회 미러링 적용)를 두 번째 인자로 전달
   */
  public handlePose(
    transformedLandmarks: any,
    ctx: MainSceneContext,
    dt?: number,
    normalizedLandmarks?: any[],
  ): boolean {
    const session = this.getAssaultSession(ctx);
    if (session && typeof session.handlePose === 'function') {
      const normalized = this._resolveNormalizedLandmarks(transformedLandmarks, ctx, normalizedLandmarks);
      session.handlePose(transformedLandmarks, normalized, dt);
      return true;
    }
    return false;
  }

  /**
   * 러닝 스텝 입력을 활성 어설트 세션 및 inputRouter로 전달
   * [ASSAULT-LOOP-11] run_question 구간 러닝 실측 기록 전용
   */
  public handleStep(stepped: boolean, ctx: MainSceneContext, dt?: number): boolean {
    if (!stepped) return false;
    const session = this.getAssaultSession(ctx);
    if (!session || session.isDisposed) return false;

    // 1. 세션 자체의 handleStep 포트가 있는 경우 우선 위임
    if (typeof session.handleStep === 'function') {
      return Boolean(session.handleStep(stepped, dt, ctx));
    }

    // 2. inputRouter 탐색 (AssaultSceneHandler 내부, session, 또는 ctx.assaultWireHelper)
    const router =
      this._inputRouter ??
      (session as any).inputRouter ??
      (session as any).__rawSession?.inputRouter ??
      (ctx as any)?.assaultWireHelper?.inputRouter;

    if (router && typeof router.handleStep === 'function') {
      return Boolean(router.handleStep(stepped));
    }

    // 3. router가 없는 환경에서도 session.exerciseTally 직접 기록 지원
    const activeRound = session.activeRoundController ?? (session as any).__rawSession?.activeRoundController;
    const segmentKind =
      activeRound?.currentLoopSegment?.kind ??
      activeRound?.getCurrentLoopSegment?.()?.kind ??
      activeRound?.currentSegment?.kind;

    if (segmentKind === 'run_question' && !activeRound?.isPaused) {
      const clock = session.clock ?? (session as any).clockAdapter;
      if (clock?.isFrozen || clock?.isPaused || clock?.isTrackingLost) {
        return false;
      }
      const tally = session.exerciseTally ?? (session as any).__rawSession?.exerciseTally;
      if (tally && typeof tally.recordRunStep === 'function') {
        const activeSeconds = clock?.activeSeconds ?? 0;
        const roundId = activeRound?.roundId ?? 'round_0';
        const inputId = `step_${roundId}_${Math.round(activeSeconds * 1000)}_${Math.round(performance.now())}`;
        return tally.recordRunStep({
          inputId,
          roundId,
          isValid: true,
          timestampMs: performance.now(),
          activeTimestampSeconds: activeSeconds,
        });
      }
    }

    return false;
  }

  /**
   * 정규화 랜드마크(0~1 범위, 1회 미러링 적용) 계산
   */
  private _resolveNormalizedLandmarks(
    transformedLandmarks: any,
    ctx: MainSceneContext,
    explicitNormalized?: any[],
  ): any[] | undefined {
    if (Array.isArray(explicitNormalized) && explicitNormalized.length > 0) {
      return explicitNormalized;
    }
    if (!Array.isArray(transformedLandmarks) || transformedLandmarks.length === 0) {
      return undefined;
    }

    // 이미 0~1 정규화된 랜드마크인 경우 (모든 x, y 절대값이 1.5 이하)
    const isAlreadyNormalized = transformedLandmarks.every(
      (lm) => typeof lm?.x === 'number' && typeof lm?.y === 'number' && Math.abs(lm.x) <= 1.5 && Math.abs(lm.y) <= 1.5,
    );
    if (isAlreadyNormalized) {
      return transformedLandmarks;
    }

    // 가상 좌표계(1080x2160, 1920x1080 등)를 0~1 정규화 좌표계로 비파괴 변환
    const vw = ctx?.canvasManager?.virtualWidth ?? 1920;
    const vh = ctx?.canvasManager?.virtualHeight ?? 1080;
    const normalized = ctx?.toNormalizedLandmarks
      ? ctx.toNormalizedLandmarks(transformedLandmarks, vw, vh)
      : toNormalizedLandmarks(transformedLandmarks, vw, vh);

    return normalized ?? undefined;
  }
}
