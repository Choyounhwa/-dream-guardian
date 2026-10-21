/**
 * SceneDirector - 메인 게임 루프 씬 디렉터 및 레이어 렌더링 오케스트레이터
 *
 * [REFACTOR-MAIN-001] (Issue #301)
 * - StateMachine 및 ScreenMode별 게임 씬의 생명주기(enter/update/render/exit) 분기 처리
 * - GameSessionContext와 연계하여 런타임 상태 및 게임 루프 제어
 * - 렌더 레이어(Clear -> Background -> Avatar -> Entities -> HUD -> Modals -> Transitions) 체계화
 */

import { DEFAULT_CONFIG } from './Config.js';
import type { GameSessionContext } from './GameSessionContext.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import type { PostureGuideRenderer } from '../render/index.js';
import type { RunningMatRenderer } from '../render/RunningMatRenderer.js';
import type { BottomBarSlot } from '../ui/index.js';
import type { Keynote } from '../types/keynote.js';
import type { PhaseAHazardPattern } from '../game/PhaseAHazardController.js';
import { AssaultSceneRenderer } from '../render/AssaultSceneRenderer.js';
import { AssaultSceneHandler } from './director/AssaultSceneHandler.js';
import { SceneMotionCoordinator } from './director/SceneMotionCoordinator.js';
import {
  SceneRenderOrchestrator,
  RENDER_LAYER_ORDER,
  CHAPTER_COLORS,
  getBossPlacement,
} from './director/SceneRenderOrchestrator.js';

export { RENDER_LAYER_ORDER, CHAPTER_COLORS, getBossPlacement };

export const MENU_HOVER_DWELL_TIME = 0.8;
export const CLIMAX_BARRAGE_DURATION = 0.8;

/**
 * 서브메뉴 뒤로가기 버튼 슬롯 (1080x2160 가상 px)
 * [LAYOUT-002 / Issue #569] 그리기(renderHUD)와 hit(resolveBottomBarActionSlot)의 단일 getter.
 * UI_LAYOUT.subMenu.backBtn 을 매 호출마다 다시 읽는다 (캐시 금지).
 */
export function getSubmenuBackSlot(): BottomBarSlot {
  const { x, y, w, h } = UI_LAYOUT.subMenu.backBtn;
  return { x, y, w, h };
}

/**
 * 하단바 submenu customActionSlot 등 Core의 액션 버튼 seam 검증 geometry 조회
 * [UI-VIS-041 / Issue #471]
 */
export function resolveBottomBarActionSlot(
  bottomBar: any,
  vw: number = 1080,
  vh: number = 2160,
  screenMode: string,
  menuMode?: string
): { x: number; y: number; w: number; h: number } | undefined {
  const isSubmenu = screenMode === 'menu' && menuMode === 'sub';
  const hasAction = isSubmenu || screenMode === 'game' || screenMode === 'result';
  if (!hasAction) return undefined;

  const pageId = isSubmenu ? 'submenu' : screenMode === 'game' ? 'pause' : 'result';
  const defaultSubmenuSlot = isSubmenu ? getSubmenuBackSlot() : undefined;

  if (bottomBar && typeof bottomBar.getActionButtonBounds === 'function') {
    return bottomBar.getActionButtonBounds(vw, vh, {
      pageId,
      customActionSlot: defaultSubmenuSlot,
      customSlot: defaultSubmenuSlot,
    });
  }

  if (defaultSubmenuSlot) {
    return {
      x: (defaultSubmenuSlot.x / 1080) * vw,
      y: (defaultSubmenuSlot.y / 2160) * vh,
      w: (defaultSubmenuSlot.w / 1080) * vw,
      h: (defaultSubmenuSlot.h / 2160) * vh,
    };
  }
  return {
    x: (810 / 1080) * vw,
    y: (1990 / 2160) * vh,
    w: (240 / 1080) * vw,
    h: (140 / 2160) * vh,
  };
}

export type SceneId = 'loading' | 'menu' | 'game' | 'result' | string;

export interface SceneHandler<TContext = any> {
  enter?: () => void;
  update?: (dt: number, context: TContext) => void;
  render?: (context: TContext) => void;
  exit?: () => void;
}

export interface RenderLayer<TContext = any> {
  name: string;
  order: number;
  render: (context: TContext) => void;
  enabled?: () => boolean;
}

export interface SceneDirectorOptions<TContext = any> {
  sessionContext?: GameSessionContext;
  initialScene?: SceneId;
  assaultHandler?: AssaultSceneHandler;
  motionCoordinator?: SceneMotionCoordinator;
  renderOrchestrator?: SceneRenderOrchestrator;
  onSceneChange?: (from: SceneId, to: SceneId) => void;
  onError?: (error: Error, phase: 'update' | 'render' | 'transition', scene: SceneId) => void;
  beforeUpdate?: (dt: number, context?: TContext) => void;
  afterUpdate?: (dt: number, context?: TContext) => void;
  beforeRender?: (context?: TContext) => void;
  afterRender?: (context?: TContext) => void;
}

export interface MainSceneState {
  screenMode: 'menu' | 'game' | 'result';
  menuMode: 'main' | 'sub';
  gamePhase: string;
  currentChapter: number;
  selectedChapter: number;
  selectedSubLevel?: number;
  unlockedChapter: number;
  starsMap: Record<number, number>;
  currentQuestion: any;
  resultData: any;
  totalSteps: number;
  totalJumps: number;
  settingsHoverTimer: number;
  actionHoverTimer: number;
  menuHoverItem: any;
  menuHoverTimer: number;
  resultReturnTimer: number;
  feedbackTimer: number;
  feedbackCustomText: string | null;
  feedbackCustomColor: string | null;
  feedbackCorrect: boolean;
  castingFlash: number;
  climaxBarrageTimer: number;
  lastFrameDt: number;
  questionVisible?: boolean;
}

export interface MainSceneActions {
  goToMenu: () => void;
  updateLocomotionLabel: () => void;
  selectSubLevel: (delta: number) => void;
  selectChapter?: (ch: number) => void;
  startChapter: (ch: number) => void;
  startGame: (ch: number, sub?: number) => void;
  showTutorial: () => void;
  showResult: (cleared: boolean) => void;
}

export interface MainSceneContext {
  canvasManager: any;
  cameraLayer: any;
  poseManager: any;
  skeletonAnimation: any;
  stickmanRenderer: any;
  boneRenderer: any;
  jointRenderer: any;
  skeletonEffect: any;
  cursorTracker?: any;
  postureMatcher?: any;
  kneeFraming?: any;
  kneeFramingValidator?: any;
  kneeFramingGuideRenderer?: any;
  calibrationHelper: any;
  xGestureDetector: any;
  locomotionDetectors: Record<string, any>;
  getActiveLocomotionDetector?: () => any;
  runDetector: any;
  jumpDetector: any;
  motionIntentBus: any;
  menuInput: any;
  answerSelector: any;
  armReachAnswerSelector: any;
  beatCoordinator: any;
  starNoteScheduler: any;
  starCollectionInput: any;
  getPhaseAStarNotes?: () => readonly Keynote[];
  getPhaseAHazardPattern?: (roundIndex?: number) => PhaseAHazardPattern;
  sessionContext?: GameSessionContext;
  bossFeverController: any;
  bossHazardController: any;
  phaseAHazardController: any;
  readyPositionController: any;
  readyPositionRenderer: any;
  menuRenderer: any;
  resultRenderer: any;
  hudLayer: any;
  dreamGrid: any;
  runningMatRenderer?: RunningMatRenderer | null;
  postureGuideRenderer?: PostureGuideRenderer | any;
  starNoteRenderer?: any;
  beatHUDRenderer: any;
  questionRenderer: any;
  answerSelectionRenderer: any;
  bossRenderer: any;
  guardian: any;
  effectManager: any;
  transitionManager: any;
  settingsModal: any;
  pauseModal: any;
  locomotionModal: any;
  bottomBar: any;
  gestureFeedbackOverlay: any;
  dialogueOverlayRenderer: any;
  tutorial: any;
  speech: any;
  sfx: any;
  stateMachine: any;
  battle: any;
  boss: any;
  questionBank: any;
  presentationAdapter: any;
  beatRoundResolver: any;
  imageLoader?: any;
  canvas: HTMLCanvasElement;
  engine?: any;
  footKeynoteDetector: any;
  footKeynoteInput: any;
  bossClimaxRenderer: any;
  getHUDData: () => any;
  renderFeedback: (ctx: CanvasRenderingContext2D, vw: number, vh: number) => void;
  toNormalizedLandmarks?: any;
  actions: MainSceneActions;
  state: MainSceneState;
  assaultSession?: any;
  assaultSceneRenderer?: any;
  assaultPresentationSnapshot?: any;
}

export class SceneDirector<TContext = any> {
  private _sessionContext?: GameSessionContext;
  private _currentScene: SceneId;
  private readonly _scenes = new Map<SceneId, SceneHandler<TContext>>();
  private _layers: RenderLayer<TContext>[] = [];
  private readonly _options: SceneDirectorOptions<TContext>;
  private readonly _assaultHandler: AssaultSceneHandler;
  private readonly _motionCoordinator: SceneMotionCoordinator;
  private readonly _renderOrchestrator: SceneRenderOrchestrator;

  // 메인 루프 임시 프레임 캐시
  private _frameHoverTarget: { x: number; y: number } | null = null;
  private _currentKneeFraming: any = null;
  private readonly _assaultSceneRenderer = new AssaultSceneRenderer();

  public get motionCoordinator(): SceneMotionCoordinator {
    return this._motionCoordinator;
  }

  public get renderOrchestrator(): SceneRenderOrchestrator {
    return this._renderOrchestrator;
  }

  public get currentKneeFraming(): any {
    return this._motionCoordinator.currentKneeFraming ?? this._currentKneeFraming;
  }

  public isAssaultMode(ctx?: MainSceneContext): boolean {
    return this._assaultHandler.isAssaultMode(ctx, this._sessionContext);
  }

  private _isAssaultMode(ctx?: MainSceneContext): boolean {
    return this.isAssaultMode(ctx);
  }

  public getAssaultSession(ctx?: MainSceneContext): any | null {
    return this._assaultHandler.getAssaultSession(ctx, this._sessionContext);
  }

  public _getAssaultSession(ctx?: MainSceneContext): any | null {
    return this.getAssaultSession(ctx);
  }

  constructor(options?: SceneDirectorOptions<TContext>) {
    this._options = options ?? {};
    this._sessionContext = this._options.sessionContext;
    this._currentScene = this._options.initialScene ?? 'menu';
    this._assaultHandler =
      this._options.assaultHandler ??
      new AssaultSceneHandler({
        sessionContextProvider: () => this._sessionContext,
        assaultSceneRenderer: this._assaultSceneRenderer,
      });
    this._motionCoordinator = this._options.motionCoordinator ?? new SceneMotionCoordinator();
    this._renderOrchestrator =
      this._options.renderOrchestrator ??
      new SceneRenderOrchestrator({
        assaultHandler: this._assaultHandler,
        kneeFramingProvider: () => this.currentKneeFraming,
        currentSceneProvider: () => this._currentScene,
      });
  }

  /** 현재 활성 씬 식별자 */
  get currentScene(): SceneId {
    return this._currentScene;
  }

  /** 연동된 세션 컨텍스트 (있는 경우) */
  get sessionContext(): GameSessionContext | undefined {
    return this._sessionContext;
  }

  /** 등록된 전체 씬 식별자 배열 */
  get registeredScenes(): SceneId[] {
    return Array.from(this._scenes.keys());
  }

  /** 세션 컨텍스트 바인딩 */
  setSessionContext(sessionContext: GameSessionContext): void {
    this._sessionContext = sessionContext;
  }

  /** 씬 등록 여부 확인 */
  hasScene(name: SceneId): boolean {
    return this._scenes.has(name);
  }

  /** 씬 핸들러 조회 */
  getScene(name: SceneId): SceneHandler<TContext> | undefined {
    return this._scenes.get(name);
  }

  /** 씬 등록 */
  registerScene(name: SceneId, handler: SceneHandler<TContext>): this {
    this._scenes.set(name, handler);
    return this;
  }

  /** 씬 등록 해제 */
  unregisterScene(name: SceneId): boolean {
    return this._scenes.delete(name);
  }

  /** 현재 활성 씬 변경 및 생명주기(exit -> enter) 실행 */
  setScene(scene: SceneId): void {
    if (this._currentScene === scene) {
      return;
    }

    const previousScene = this._currentScene;

    // 이전 씬 exit 호출
    const prevHandler = this._scenes.get(previousScene);
    if (prevHandler?.exit) {
      try {
        prevHandler.exit();
      } catch (err) {
        this._handleError(err, 'transition', previousScene);
      }
    }

    this._currentScene = scene;

    // 다음 씬 enter 호출
    const nextHandler = this._scenes.get(scene);
    if (nextHandler?.enter) {
      try {
        nextHandler.enter();
      } catch (err) {
        this._handleError(err, 'transition', scene);
      }
    }

    // 전이 알림 콜백
    if (this._options.onSceneChange) {
      try {
        this._options.onSceneChange(previousScene, scene);
      } catch (err) {
        this._handleError(err, 'transition', scene);
      }
    }
  }

  /** 렌더 레이어 등록 (order 오름차순으로 자동 정렬) */
  registerLayer(
    name: string,
    order: number,
    render: (context: TContext) => void,
    enabled?: () => boolean,
  ): this {
    this._layers = this._layers.filter((l) => l.name !== name);
    this._layers.push({ name, order, render, enabled });
    this._layers.sort((a, b) => a.order - b.order);
    return this;
  }

  /** 렌더 레이어 등록 해제 */
  unregisterLayer(name: string): void {
    this._layers = this._layers.filter((l) => l.name !== name);
  }

  /** 전체 씬 루프 업데이트 (beforeUpdate -> currentScene.update -> afterUpdate) */
  update(dt: number, context?: TContext): void {
    try {
      this._options.beforeUpdate?.(dt, context);
    } catch (err) {
      this._handleError(err, 'update', this._currentScene);
    }

    const handler = this._scenes.get(this._currentScene);
    if (handler?.update) {
      try {
        handler.update(dt, context as TContext);
      } catch (err) {
        this._handleError(err, 'update', this._currentScene);
      }
    }

    try {
      this._options.afterUpdate?.(dt, context);
    } catch (err) {
      this._handleError(err, 'update', this._currentScene);
    }
  }

  /** 특정 씬 핸들러 업데이트 직접 실행 */
  updateScene(scene: SceneId, dt: number, context?: TContext): void {
    const handler = this._scenes.get(scene);
    if (handler?.update) {
      try {
        handler.update(dt, context as TContext);
      } catch (err) {
        this._handleError(err, 'update', scene);
      }
    }
  }

  /** 전체 씬 렌더링 (beforeRender -> layers -> [fallback scene render] -> afterRender) */
  render(context?: TContext): void {
    try {
      this._options.beforeRender?.(context);
    } catch (err) {
      this._handleError(err, 'render', this._currentScene);
    }

    for (const layer of this._layers) {
      if (layer.enabled && !layer.enabled()) {
        continue;
      }
      try {
        layer.render(context as TContext);
      } catch (err) {
        this._handleError(err, 'render', this._currentScene);
      }
    }

    // 등록된 레이어가 없는 경우에만 활성 씬 렌더러 직접 호출
    if (this._layers.length === 0) {
      const handler = this._scenes.get(this._currentScene);
      if (handler?.render) {
        try {
          handler.render(context as TContext);
        } catch (err) {
          this._handleError(err, 'render', this._currentScene);
        }
      }
    }

    try {
      this._options.afterRender?.(context);
    } catch (err) {
      this._handleError(err, 'render', this._currentScene);
    }
  }

  /** 특정 씬 렌더링 직접 실행 */
  renderScene(scene: SceneId, context?: TContext): void {
    const handler = this._scenes.get(scene);
    if (handler?.render) {
      try {
        handler.render(context as TContext);
      } catch (err) {
        this._handleError(err, 'render', scene);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 메인 게임 루프 오케스트레이션 파이프라인 (Main Loop Pipelines)
  // ─────────────────────────────────────────────────────────────

  /** main.ts 게임 루프 씬 및 7단계 렌더 레이어 자동 구성 */
  setupMainPipelines(_ctx?: MainSceneContext): void {
    this._options.beforeUpdate = (dt, c) => {
      if (c) this.updateCommon(dt, c as unknown as MainSceneContext);
    };

    // 씬 핸들러 등록
    this.registerScene('menu', {
      update: (dt, c) => this.updateMenuScene(dt, c as unknown as MainSceneContext),
      render: (c) => this.renderMenuScene(c as unknown as MainSceneContext),
    });

    this.registerScene('game', {
      update: (dt, c) => this.updateGameScene(dt, c as unknown as MainSceneContext),
      render: (c) => this.renderGameScene(c as unknown as MainSceneContext),
    });

    this.registerScene('result', {
      update: (dt, c) => this.updateResultScene(dt, c as unknown as MainSceneContext),
      render: (c) => this.renderResultScene(c as unknown as MainSceneContext),
    });

    // 7단계 렌더 레이어 등록
    this._renderOrchestrator.registerLayers(this);
  }

  /** 전체 씬 공통 업데이트 및 모션/입력 파이프라인 전처리 */
  updateCommon(dt: number, ctx: MainSceneContext): void {
    // 1. 화면 전환 및 모달 애니메이션 / 메뉴 펄스 타이머 갱신
    ctx.transitionManager.update(dt);
    ctx.settingsModal.update(dt);
    ctx.pauseModal.update(dt);
    ctx.menuRenderer.update(dt);
    ctx.readyPositionRenderer.update(dt);
    ctx.answerSelectionRenderer.update(dt);
    ctx.tutorial.update(dt);

    // 2. 스켈레톤 시각 이펙트 상태 및 타이머 갱신
    ctx.skeletonEffect.setMana(ctx.battle.mana, DEFAULT_CONFIG.mana.spellCost);
    ctx.skeletonEffect.setHp(ctx.battle.hp, ctx.battle.maxHp);
    ctx.skeletonEffect.update(dt);

    // 3. 저시력 모드 음성 피드백 (HP 50% 이하 알림 - DEC-B2: assault 모드 억제)
    if (!this._isAssaultMode(ctx) && ctx.state.screenMode === 'game' && ctx.battle.isAlive && ctx.battle.hp <= ctx.battle.maxHp * 0.5) {
      ctx.speech.speakFeedback('low_hp');
    }

    // 4. 모션 & 카메라 파이프라인 실행
    this._processMotionPipeline(dt, ctx);

    // 5. 모달 및 공통 호버 버튼 처리
    this._processModalsAndHover(dt, ctx);
  }

  /** 모션 & 카메라 파이프라인 처리 */
  private _processMotionPipeline(dt: number, ctx: MainSceneContext): void {
    const isAssault = this._isAssaultMode(ctx);
    const result = this._motionCoordinator.process(dt, ctx, {
      isAssaultMode: isAssault,
      assaultHandler: this._assaultHandler,
    });
    this._frameHoverTarget = result.frameHoverTarget;
    this._currentKneeFraming = result.kneeFraming;
  }

  /** 모달 및 하단 바 호버 처리 */
  private _processModalsAndHover(dt: number, ctx: MainSceneContext): void {
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;
    const hoverTarget = this._frameHoverTarget;

    if (ctx.pauseModal.isOpen) {
      if (hoverTarget) {
        const pauseRes = ctx.pauseModal.updateHover(hoverTarget.x, hoverTarget.y, vw, vh, dt);
        const action = typeof pauseRes === 'string' ? pauseRes : pauseRes?.action;
        if (action === 'resume') {
          ctx.pauseModal.close();
          ctx.sfx.play('correct');
        } else if (action === 'quit') {
          ctx.pauseModal.close();
          ctx.actions.goToMenu();
          ctx.sfx.play('hover');
        }
      }
    } else if (ctx.locomotionModal.isOpen) {
      if (hoverTarget) {
        const hoverRes = ctx.locomotionModal.updateHover(hoverTarget.x, hoverTarget.y, vw, vh, dt);
        if (hoverRes.modeSelected) {
          ctx.sfx.play('correct');
          ctx.actions.updateLocomotionLabel();
        }
      }
    } else if (!ctx.settingsModal.isOpen && !ctx.tutorial.isVisible) {
      if (hoverTarget) {
        if (ctx.bottomBar.hitTestSettings(hoverTarget.x, hoverTarget.y, vw, vh, 15)) {
          ctx.state.settingsHoverTimer += dt;
          if (ctx.state.settingsHoverTimer >= MENU_HOVER_DWELL_TIME) {
            ctx.settingsModal.open();
            ctx.sfx.play('hover');
            ctx.state.settingsHoverTimer = 0;
          }
        } else {
          ctx.state.settingsHoverTimer = Math.max(0, ctx.state.settingsHoverTimer - dt * 2);
        }

        const actionSlot = resolveBottomBarActionSlot(ctx.bottomBar, vw, vh, ctx.state.screenMode, ctx.state.menuMode);
        const hasAction = actionSlot !== undefined;

        if (hasAction && ctx.bottomBar.hitTestAction(hoverTarget.x, hoverTarget.y, vw, vh, 15, actionSlot)) {
          ctx.state.actionHoverTimer += dt;
          if (ctx.state.actionHoverTimer >= MENU_HOVER_DWELL_TIME) {
            ctx.state.actionHoverTimer = 0;
            if (ctx.state.screenMode === 'menu' && ctx.state.menuMode === 'sub') {
              ctx.actions.selectSubLevel(-1);
            } else if (ctx.state.screenMode === 'game') {
              ctx.pauseModal.open();
              ctx.sfx.play('hover');
            } else if (ctx.state.screenMode === 'result') {
              ctx.actions.goToMenu();
            }
          }
        } else {
          ctx.state.actionHoverTimer = Math.max(0, ctx.state.actionHoverTimer - dt * 2);
        }
      } else {
        ctx.state.settingsHoverTimer = Math.max(0, ctx.state.settingsHoverTimer - dt * 2);
        ctx.state.actionHoverTimer = Math.max(0, ctx.state.actionHoverTimer - dt * 2);
      }
    }
  }

  /** 메뉴 씬 루프 업데이트 */
  updateMenuScene(dt: number, ctx: MainSceneContext): void {
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    ctx.dreamGrid.update(dt, 0.8);
    ctx.effectManager.update(dt);

    // Issue #119 & Issue #133: 메뉴 선택 판정 (양손 모으기 우선)
    let activeTargetPos: { x: number; y: number } | null = null;
    if (ctx.menuInput.isActive) {
      activeTargetPos = { x: ctx.menuInput.cursorX, y: ctx.menuInput.cursorY };
    }

    if (activeTargetPos) {
      const mx = activeTargetPos.x * vw;
      const my = activeTargetPos.y * vh;
      // Issue #133: 호버 중일 때는 히스테리시스 패딩(+24px), 미호버 시에는 기본 패딩(+12px) 적용
      const hitPadding = ctx.state.menuHoverItem ? 24 : 12;

      if (ctx.state.menuMode === 'main') {
        const hitCh = ctx.menuRenderer.hitTest(mx, my, vw, vh, hitPadding);
        if (hitCh > 0 && hitCh <= ctx.state.unlockedChapter) {
          if (ctx.state.menuHoverItem?.type === 'chapter' && ctx.state.menuHoverItem.id === hitCh) {
            ctx.state.menuHoverTimer += dt;
            if (ctx.state.menuHoverTimer >= MENU_HOVER_DWELL_TIME) {
              if (ctx.actions.selectChapter) {
                ctx.actions.selectChapter(hitCh);
              }
            }
          } else {
            ctx.state.menuHoverItem = { type: 'chapter', id: hitCh };
            ctx.state.menuHoverTimer = 0;
          }
        } else {
          ctx.state.menuHoverItem = null;
          ctx.state.menuHoverTimer = 0;
        }
      } else {
        const subLevels = ctx.questionBank.getSubLevels(ctx.state.selectedChapter);
        const hitSub = ctx.menuRenderer.hitTestSub(mx, my, vw, vh, ctx.state.selectedChapter, subLevels, hitPadding);
        if (hitSub !== null) {
          if (ctx.state.menuHoverItem?.type === 'sublevel' && ctx.state.menuHoverItem.id === hitSub) {
            ctx.state.menuHoverTimer += dt;
            if (ctx.state.menuHoverTimer >= MENU_HOVER_DWELL_TIME) {
              ctx.actions.selectSubLevel(hitSub);
            }
          } else {
            ctx.state.menuHoverItem = { type: 'sublevel', id: hitSub };
            ctx.state.menuHoverTimer = 0;
          }
        } else {
          ctx.state.menuHoverItem = null;
          ctx.state.menuHoverTimer = 0;
        }
      }
    } else {
      ctx.menuInput.reset();
      ctx.state.menuHoverItem = null;
      ctx.state.menuHoverTimer = 0;
    }
  }

  /** 결과 씬 루프 업데이트 */
  updateResultScene(dt: number, ctx: MainSceneContext): void {
    ctx.resultRenderer.update(dt);
    ctx.dreamGrid.update(dt, 0.8);
    ctx.effectManager.update(dt);

    if (ctx.menuInput.isActive) {
      ctx.state.resultReturnTimer += dt;
      if (ctx.state.resultReturnTimer >= MENU_HOVER_DWELL_TIME) {
        ctx.state.resultReturnTimer = 0;
        ctx.actions.goToMenu();
      }
    } else {
      ctx.state.resultReturnTimer = 0;
    }
  }

  /** 보스 접근전(Boss Assault) 전용 씬 루프 업데이트 (DEC-B1) */
  updateAssaultGameScene(dt: number, ctx: MainSceneContext): void {
    this._assaultHandler.update(dt, ctx);
  }

  /** 게임 씬 루프 업데이트 */
  updateGameScene(dt: number, ctx: MainSceneContext): void {
    if (this._isAssaultMode(ctx)) {
      this.updateAssaultGameScene(dt, ctx);
      return;
    }
    if (ctx.pauseModal.isOpen) {
      ctx.engine?.pauseGame?.();
      ctx.beatCoordinator.pause();
      ctx.starCollectionInput.setPaused(true);
      ctx.starNoteScheduler.setPaused(true);
      ctx.phaseAHazardController?.pause?.();
      ctx.dreamGrid.update(dt, 0.8);
      ctx.effectManager.update(dt);
      ctx.sfx.stopDwellCharge();
      return;
    }
    if (ctx.engine?.isGamePaused) {
      ctx.engine.resumeGame();
    }
    if (ctx.beatCoordinator.isPaused) {
      ctx.beatCoordinator.resume();
    }
    ctx.phaseAHazardController?.resume?.();
    ctx.starCollectionInput.setPaused(false);
    ctx.starNoteScheduler.setPaused(false);

    const isRunning = ctx.state.gamePhase === 'running';
    const speedMult = isRunning ? 2.5 : 0.8;
    ctx.dreamGrid.update(dt, speedMult);
    ctx.postureGuideRenderer?.update(dt);

    const sourceLandmarks =
      ctx.skeletonAnimation.smoothedLandmarks.length >= 25
        ? ctx.skeletonAnimation.smoothedLandmarks
        : ctx.poseManager.virtualLandmarks;

    // Issue #206 & #246 & #635: 무릎 프레이밍 유효성 검사, 정렬 가이드 및 발 키노트 감지 위임
    const framingResult = this._motionCoordinator.processFramingAndFootKeynotes(dt, ctx, sourceLandmarks);
    this._currentKneeFraming = framingResult.kneeFraming;
    const normalizedLandmarks = framingResult.normalizedLandmarks;

    const sampleTime = ctx.engine?.elapsedTime ?? 0;
    const stampedLandmarks = normalizedLandmarks
      ? normalizedLandmarks.map((lm: { x: number; y: number; timestamp?: number }) => ({ ...lm, timestamp: sampleTime }))
      : normalizedLandmarks;
    const phaseBefore = ctx.beatCoordinator.phase;
    ctx.beatCoordinator.update(dt, stampedLandmarks);
    ctx.state.currentQuestion = ctx.beatCoordinator.currentQuestion;
    const phaseAfter = ctx.beatCoordinator.phase;
    const clock = ctx.beatCoordinator.getBranchClock?.() ?? null;
    const branchStarted =
      (phaseAfter === 'STAR_COLLECT' || phaseAfter === 'HAZARD_EVADE') &&
      phaseBefore !== phaseAfter;
    const branchRemainder = branchStarted ? Math.max(0, dt - (clock?.elapsed ?? 0)) : dt;

    if (
      (ctx.stateMachine.currentState === 'HAZARD_EVADE' || phaseAfter === 'HAZARD_EVADE') &&
      !ctx.phaseAHazardController.isActive
    ) {
      const branchClock = clock;
      const roundIndex = ctx.beatRoundResolver.currentRoundIndex;
      const sContext = this._sessionContext ?? ctx.sessionContext;
      const bundle = sContext?.activeStageBundle ?? (sContext as any)?.stageBundle ?? null;
      const pattern = bundle
        ? bundle.getPhaseAHazardPattern(roundIndex)
        : (ctx.getPhaseAHazardPattern ? ctx.getPhaseAHazardPattern(roundIndex) : undefined);
      const attackId = bundle
        ? `${bundle.getRoundExecutionId(roundIndex)}_hazard`
        : (roundIndex ? `hazard_r${roundIndex}` : undefined);

      ctx.phaseAHazardController.start({
        roundIndex,
        pattern,
        bundle: bundle ?? undefined,
        attackId,
        ...(branchClock
          ? { branchClock, secondsPerBeat: branchClock.secondsPerBeat }
          : { secondsPerBeat: ctx.beatCoordinator.rhythmEngine?.secondsPerBeat }),
      });
    }
    if (ctx.stateMachine.currentState === 'HAZARD_EVADE' && ctx.phaseAHazardController?.isActive && !branchStarted) {
      if (ctx.pauseModal.isOpen) {
        ctx.phaseAHazardController?.pause?.();
      } else {
        ctx.phaseAHazardController?.resume?.();
        ctx.phaseAHazardController.update(branchRemainder);
      }
      if (!ctx.battle.isAlive) {
        ctx.actions.showResult(false);
        return;
      }
    }

    if (
      ctx.beatCoordinator.phase === 'KEYNOTE_PERFORMANCE' ||
      ctx.beatCoordinator.phase === 'STAR_COLLECT' ||
      ctx.stateMachine.currentState === 'STAR_COLLECT'
    ) {
      if (!ctx.starNoteScheduler.isStarted) {
        const branchClock = clock;
        const notes = ctx.getPhaseAStarNotes ? ctx.getPhaseAStarNotes() : ctx.beatCoordinator.keynotes;
        ctx.starNoteScheduler.start(sampleTime, {
          roundId: ctx.beatRoundResolver.currentRoundIndex,
          notes,
          ...(branchClock
            ? { branchClock, secondsPerBeat: branchClock.secondsPerBeat }
            : { secondsPerBeat: ctx.beatCoordinator.rhythmEngine?.secondsPerBeat }),
        });
      }
      if (!branchStarted) {
        ctx.starNoteScheduler.update(sampleTime, sourceLandmarks);
      }
      ctx.starCollectionInput.setTarget(ctx.starNoteScheduler.currentTarget);
    } else if (
      ctx.stateMachine.currentState === 'BOSS_CLIMAX' ||
      (ctx.bossFeverController && ctx.bossFeverController.isActive)
    ) {
      // Issue #402: Phase B 루프 업데이트에서 동일한 stageBundle 참조 보존 및 갱신 역전 방지
      const sContext = this._sessionContext ?? ctx.sessionContext;
      const activeBundle = sContext?.activeStageBundle ?? (sContext as any)?.stageBundle ?? null;
      if (activeBundle) {
        if (ctx.bossFeverController && (ctx.bossFeverController as any).stageBundle !== activeBundle) {
          ctx.bossFeverController.setStageBundle(activeBundle);
        }
        if (ctx.bossHazardController && (ctx.bossHazardController as any).stageBundle !== activeBundle) {
          ctx.bossHazardController.setStageBundle(activeBundle);
        }
      }
      ctx.bossFeverController.update(ctx.engine?.elapsedTime ?? 0, sourceLandmarks);
      ctx.starCollectionInput.setTarget(ctx.starNoteScheduler.currentTarget);
      if (ctx.bossHazardController && !ctx.pauseModal.isOpen) {
        ctx.bossHazardController.update(dt);
      }
      if (!ctx.pauseModal.isOpen) {
        ctx.beatRoundResolver.resourceManager.troopManager.update(dt, { autoConsumeStardust: true });
      }
    }

    if (ctx.state.feedbackTimer > 0) {
      ctx.state.feedbackTimer -= dt;
      if (ctx.state.feedbackTimer <= 0) {
        ctx.state.feedbackCustomText = null;
        ctx.state.feedbackCustomColor = null;
      }
    }
    if (ctx.state.castingFlash > 0) ctx.state.castingFlash -= dt;
    if (ctx.state.climaxBarrageTimer > 0) {
      ctx.state.climaxBarrageTimer = Math.max(0, ctx.state.climaxBarrageTimer - dt);
    }
    ctx.guardian.update(dt);
    ctx.bossRenderer.update(dt);
    ctx.effectManager.update(dt);
    ctx.boss.update(dt);
    ctx.dialogueOverlayRenderer.update(dt);

    ctx.hudLayer.update(dt, ctx.getHUDData());

    if (!ctx.battle.isAlive && ctx.state.screenMode === 'game') {
      ctx.actions.showResult(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7단계 캔버스 레이어 및 씬 렌더링 위임 (Delegated to SceneRenderOrchestrator)
  // ─────────────────────────────────────────────────────────────

  renderClear(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderClear(ctx);
  }

  renderBackground(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderBackground(ctx);
  }

  renderAvatarAndSkeleton(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderAvatarAndSkeleton(ctx);
  }

  renderMenuScene(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderMenuScene(ctx);
  }

  /** 보스 접근전(Boss Assault) 전용 씬 렌더링 */
  renderAssaultScene(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderAssaultScene(ctx);
  }

  renderGameScene(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderGameScene(ctx);
  }

  renderResultScene(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderResultScene(ctx);
  }

  renderHUD(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderHUD(ctx);
  }

  renderModalsAndOverlays(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderModalsAndOverlays(ctx);
  }

  renderTransitions(ctx: MainSceneContext): void {
    this._renderOrchestrator.renderTransitions(ctx);
  }

  private _handleError(
    err: unknown,
    phase: 'update' | 'render' | 'transition',
    scene: SceneId,
  ): void {
    const error = err instanceof Error ? err : new Error(String(err));
    if (this._options.onError) {
      this._options.onError(error, phase, scene);
    } else {
      console.error(`[SceneDirector] Error during ${phase} in scene ${scene}:`, error);
    }
  }
}

/**
 * 메인 게임 씬 디렉터 팩토리 함수
 */
export function createMainGameDirector<TContext = MainSceneContext>(
  options?: SceneDirectorOptions<TContext>,
  ctx?: MainSceneContext
): SceneDirector<TContext> {
  const director = new SceneDirector<TContext>(options);
  director.setupMainPipelines(ctx);
  return director;
}

export { AssaultSceneHandler };
