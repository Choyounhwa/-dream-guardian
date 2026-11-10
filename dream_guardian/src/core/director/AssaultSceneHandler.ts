/**
 * AssaultSceneHandler - 보스 접근전(Boss Assault) 전용 씬 루프 및 렌더링 오케스트레이터
 *
 * [REFACTOR-CORE-004] (Issue #619)
 * - SceneDirector 내의 어설트 전용 씬 루프(update) 및 렌더링(render), HUD, 포즈 위임 처리
 * - 어설트 모드 세션 확인 및 스냅샷 우선순위 해석
 * - 단일 책임 원칙(SRP)에 따른 SceneDirector 경량화 및 Core 모듈 분리
 */

import { HORIZON_RATIO } from '../../../config/grid.config.js';
import { AssaultSceneRenderer } from '../../render/AssaultSceneRenderer.js';
import type { GameSessionContext } from '../GameSessionContext.js';
import type { MainSceneContext } from '../SceneDirector.js';

export const ASSAULT_MENU_HOVER_DWELL_TIME = 0.8;

export interface AssaultSceneHandlerOptions {
  assaultSceneRenderer?: AssaultSceneRenderer;
  sessionContextProvider?: () => GameSessionContext | undefined;
}

export class AssaultSceneHandler {
  private readonly _assaultSceneRenderer: AssaultSceneRenderer;
  private readonly _sessionContextProvider?: () => GameSessionContext | undefined;

  constructor(options?: AssaultSceneHandlerOptions) {
    this._assaultSceneRenderer = options?.assaultSceneRenderer ?? new AssaultSceneRenderer();
    this._sessionContextProvider = options?.sessionContextProvider;
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
    const snapshot =
      session?.finalePresentationSnapshot ??
      (finaleSnapshot ? { ...finaleSnapshot, questionText: '' } : null) ??
      session?.presentation ??
      session?.activeRoundController?.presentation ??
      session?.snapshot ??
      (ctx as any)?.assaultPresentationSnapshot ??
      null;
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
    ctx.boss?.update?.(dt);
    ctx.dialogueOverlayRenderer?.update?.(dt);
    // DEC-B1: 단일 종료 권위(SessionLifecycle) 원칙에 따라 HP 0 시 showResult 중복 호출 차단
  }

  /**
   * 보스 접근전(Boss Assault) 전용 씬 렌더링
   */
  public render(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    const vanishingX = vw * 0.5;
    const vanishingY = vh * HORIZON_RATIO;
    const chapterKey = `ch${ctx.state?.currentChapter ?? 1}`;
    const gameBg = !ctx.cameraLayer?.isActive ? ctx.imageLoader?.get?.('bg', chapterKey) : null;

    if (ctx.dreamGrid) {
      ctx.dreamGrid.render(context2d, vw, vh, {
        vanishingX,
        vanishingY,
        color: '#FF8844',
        bgImage: gameBg,
      });
    }

    const session = this.getAssaultSession(ctx);
    const snapshot = this.resolveSnapshot(session, ctx);

    if (snapshot) {
      const assaultRenderer = (ctx as any)?.assaultSceneRenderer ?? this._assaultSceneRenderer;
      assaultRenderer.render(context2d, snapshot, { width: vw, height: vh });
    }

    if (session?.hud && typeof session.hud.render === 'function') {
      session.hud.render(context2d, vw, vh);
    }
  }

  /**
   * 보스 접근전 HUD 렌더링 위임
   */
  public renderHUD(ctx: MainSceneContext): boolean {
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
   */
  public handlePose(transformedLandmarks: any, ctx: MainSceneContext, dt?: number): boolean {
    const session = this.getAssaultSession(ctx);
    if (session && typeof session.handlePose === 'function') {
      session.handlePose(transformedLandmarks, undefined, dt);
      return true;
    }
    return false;
  }
}
