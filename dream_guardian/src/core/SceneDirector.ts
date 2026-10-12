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
import { HORIZON_RATIO } from '../../config/grid.config.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { drawJoinedHandsCursor, PostureGuideRenderer } from '../render/index.js';
import type { RunningMatRenderer } from '../render/RunningMatRenderer.js';
import { RunningMatPresenter, presentRunningMat } from '../render/RunningMatPresenter.js';
import { LOCOMOTION_MODES, type BottomBarSlot } from '../ui/index.js';
import { toNormalizedLandmarks } from '../utils/index.js';
import type { Keynote } from '../types/keynote.js';
import type { PhaseAHazardPattern } from '../game/PhaseAHazardController.js';

// Polyfill static present on RunningMatPresenter for #373 if needed
if (typeof (RunningMatPresenter as any).present !== 'function') {
  (RunningMatPresenter as any).present = (snapshot: any, mode: any) => presentRunningMat(snapshot, mode);
}

export const RENDER_LAYER_ORDER = {
  CLEAR: 10,
  BACKGROUND: 20,
  AVATAR: 30,
  ENTITIES: 40,
  HUD: 50,
  MODALS: 60,
  TRANSITIONS: 70,
} as const;

export const CHAPTER_COLORS = ['', '#4DFFAA', '#28E6FF', '#FFCB4D', '#C889FF', '#FF4444'];

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
}

export class SceneDirector<TContext = any> {
  private _sessionContext?: GameSessionContext;
  private _currentScene: SceneId;
  private readonly _scenes = new Map<SceneId, SceneHandler<TContext>>();
  private _layers: RenderLayer<TContext>[] = [];
  private readonly _options: SceneDirectorOptions<TContext>;

  // 메인 루프 임시 프레임 캐시
  private _frameHoverTarget: { x: number; y: number } | null = null;
  private _currentKneeFraming: any = null;

  constructor(options?: SceneDirectorOptions<TContext>) {
    this._options = options ?? {};
    this._sessionContext = this._options.sessionContext;
    this._currentScene = this._options.initialScene ?? 'menu';
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
    this.registerLayer('clear', RENDER_LAYER_ORDER.CLEAR, (c) =>
      this.renderClear(c as unknown as MainSceneContext),
    );
    this.registerLayer('background', RENDER_LAYER_ORDER.BACKGROUND, (c) =>
      this.renderBackground(c as unknown as MainSceneContext),
    );
    this.registerLayer('avatar', RENDER_LAYER_ORDER.AVATAR, (c) =>
      this.renderAvatarAndSkeleton(c as unknown as MainSceneContext),
    );
    this.registerLayer('entities', RENDER_LAYER_ORDER.ENTITIES, (c) =>
      this.renderScene(this._currentScene, c as any),
    );
    this.registerLayer('hud', RENDER_LAYER_ORDER.HUD, (c) =>
      this.renderHUD(c as unknown as MainSceneContext),
    );
    this.registerLayer('modals', RENDER_LAYER_ORDER.MODALS, (c) =>
      this.renderModalsAndOverlays(c as unknown as MainSceneContext),
    );
    this.registerLayer('transitions', RENDER_LAYER_ORDER.TRANSITIONS, (c) =>
      this.renderTransitions(c as unknown as MainSceneContext),
    );
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

    // 3. 저시력 모드 음성 피드백 (HP 50% 이하 알림)
    if (ctx.state.screenMode === 'game' && ctx.battle.isAlive && ctx.battle.hp <= ctx.battle.maxHp * 0.5) {
      ctx.speech.speakFeedback('low_hp');
    }

    // 4. 모션 & 카메라 파이프라인 실행
    this._processMotionPipeline(dt, ctx);

    // 5. 모달 및 공통 호버 버튼 처리
    this._processModalsAndHover(dt, ctx);
  }

  /** 모션 & 카메라 파이프라인 처리 */
  private _processMotionPipeline(dt: number, ctx: MainSceneContext): void {
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    if (ctx.cameraLayer.isActive && ctx.cameraLayer.videoElement) {
      ctx.poseManager.send(ctx.cameraLayer.videoElement, performance.now()).catch(() => {});
    }

    let sourceLandmarks: any[] = [];

    if (ctx.poseManager.hasPose) {
      ctx.skeletonAnimation.update(dt, ctx.poseManager.virtualLandmarks);
      sourceLandmarks =
        ctx.skeletonAnimation.smoothedLandmarks.length >= 25
          ? ctx.skeletonAnimation.smoothedLandmarks
          : ctx.poseManager.virtualLandmarks;

      ctx.stickmanRenderer.update(
        dt,
        sourceLandmarks,
        ctx.skeletonAnimation.breathScale,
      );

      // Issue #140: 모든 장면(메뉴·달리기·문제·결과)에서 4색 커서가 상시 유지되도록 매 프레임 커서 트래커 갱신
      if (sourceLandmarks.length >= 25) {
        const jointMap: Record<number, { x: number; y: number }> = {};
        for (let i = 0; i < sourceLandmarks.length; i++) {
          const lm = sourceLandmarks[i];
          if ((lm.visibility ?? 0) >= 0.3) {
            jointMap[i] = { x: lm.x, y: lm.y };
          }
        }
        ctx.skeletonEffect.recordJointPositions(jointMap);

        const tracker = ctx.answerSelector?.cursorTracker ?? ctx.cursorTracker;
        tracker?.update(
          sourceLandmarks,
          undefined,
          false,
          { isVirtual: true, virtualWidth: vw, virtualHeight: vh },
        );
      }

      // Issue #171 & #172: X자 교차 제스처 갱신 (서브메뉴 뒤로가기 & 인게임 일시정지)
      if (sourceLandmarks.length >= 17) {
        const xResult = ctx.xGestureDetector.update(sourceLandmarks, dt);
        if (xResult.triggered) {
          if (ctx.state.screenMode === 'menu' && ctx.state.menuMode === 'sub') {
            ctx.actions.selectSubLevel(-1);
          } else if (ctx.state.screenMode === 'game') {
            ctx.pauseModal.toggle();
            ctx.sfx.play('hover');
          }
        }
      }

      // 사용자 신체 기준선 자동 보정 (Issue #238 / BUG-JUMP-BASELINE-001)
      if (sourceLandmarks.length >= 25 && !ctx.calibrationHelper.isDone) {
        ctx.calibrationHelper.update(dt, sourceLandmarks);
      }

      const userBaselineY = ctx.calibrationHelper.isDone
        ? ctx.calibrationHelper.baselineShoulderY
        : vh * 0.28;

      const isSafetyGuarded = ctx.menuInput.isActive || ctx.pauseModal.isOpen;
      const activeDetector = ctx.getActiveLocomotionDetector
        ? ctx.getActiveLocomotionDetector()
        : (ctx.locomotionDetectors[ctx.locomotionModal.selectedMode] ?? ctx.runDetector);

      const time = performance.now() / 1000;
      const stepped = activeDetector.update(
        sourceLandmarks,
        userBaselineY,
        time,
        vh,
      );
      const jumped = ctx.jumpDetector.update(
        sourceLandmarks,
        userBaselineY,
        vh,
        dt,
        {
          isPaused: ctx.pauseModal.isOpen,
          isSafetyGuarded,
          isCalibrated: ctx.calibrationHelper.isDone,
        },
      );

      ctx.motionIntentBus.processLandmarks(sourceLandmarks, dt, time, {
        baselineY: userBaselineY,
        virtualHeight: vh,
        isPaused: ctx.pauseModal.isOpen,
      });

      if (stepped && ctx.state.screenMode === 'game' && ctx.state.gamePhase === 'running' && !ctx.pauseModal.isOpen) {
        ctx.state.totalSteps++;
        ctx.beatCoordinator.recordStep();
        ctx.runningMatRenderer?.triggerMotionHit?.();
        ctx.effectManager.playBurst({
          x: vw * 0.5,
          y: vh * 0.65,
          count: 8,
          colors: ['#28E6FF', '#4DFFAA'],
          duration: 0.3,
        });
      }

      if (jumped && ctx.state.screenMode === 'game' && !ctx.pauseModal.isOpen) {
        ctx.state.totalJumps++;
        if (ctx.stateMachine.currentState === 'HAZARD_EVADE') {
          if (ctx.phaseAHazardController.activePattern === 'jump') {
            ctx.phaseAHazardController.recordAction('jump');
            ctx.sfx.play('jump_whoosh');
          }
        } else if (ctx.stateMachine.currentState === 'BOSS_CLIMAX' && ctx.bossHazardController) {
          if (ctx.bossHazardController.recordAction('jump')) {
            ctx.sfx.play('jump_whoosh');
          }
        }
        ctx.effectManager.playBurst({
          x: vw * 0.5,
          y: vh * 0.65,
          count: 10,
          colors: ['#28E6FF', '#FFFFFF'],
          duration: 0.3,
        });
      }
    } else {
      ctx.skeletonAnimation.reset();
      const isRunning = ctx.state.screenMode === 'game' && ctx.state.gamePhase === 'running' && !ctx.pauseModal.isOpen;
      ctx.stickmanRenderer.updateFallback(dt, isRunning);
      ctx.motionIntentBus.reset();
      Object.values(ctx.locomotionDetectors).forEach((d: any) => d.reset());
      ctx.jumpDetector.reset();
      ctx.menuInput.reset();
      ctx.xGestureDetector.reset();
      ctx.state.menuHoverItem = null;
      ctx.state.menuHoverTimer = 0;
    }

    const tracker = ctx.answerSelector?.cursorTracker ?? ctx.cursorTracker;
    const leftHand = tracker?.getCursor('leftHand');
    const rightHand = tracker?.getCursor('rightHand');

    // Issue #169 & #172: 전 화면(menu, game, result) 공통 매 프레임 양손 합장 제스처 갱신 및 문제선택/모달 일시정지 동기화
    if (leftHand && rightHand) {
      ctx.menuInput.update(leftHand.x, leftHand.y, rightHand.x, rightHand.y);
    } else {
      ctx.menuInput.reset();
    }
    if (ctx.answerSelector) {
      ctx.answerSelector.paused = ctx.menuInput.isActive || ctx.pauseModal.isOpen;
    }

    let hoverTarget: { x: number; y: number } | null = null;

    if (ctx.menuInput.isActive) {
      hoverTarget = { x: ctx.menuInput.cursorX * vw, y: ctx.menuInput.cursorY * vh };
    } else if (leftHand || rightHand) {
      if (leftHand && rightHand) {
        hoverTarget = leftHand.y > rightHand.y
          ? { x: leftHand.x, y: leftHand.y }
          : { x: rightHand.x, y: rightHand.y };
      } else {
        const h = leftHand || rightHand!;
        hoverTarget = { x: h.x, y: h.y };
      }
    }
    this._frameHoverTarget = hoverTarget;
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

  /** 게임 씬 루프 업데이트 */
  updateGameScene(dt: number, ctx: MainSceneContext): void {
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

    // Issue #206 & #246: 무릎 프레이밍 유효성 검사 및 정렬 가이드 시각화
    const currentKneeFraming = ctx.kneeFramingValidator
      ? ctx.kneeFramingValidator.update(
          dt,
          sourceLandmarks,
          ctx.canvasManager.virtualWidth,
          ctx.canvasManager.virtualHeight,
        )
      : (ctx.kneeFraming ? ctx.kneeFraming.update(sourceLandmarks, ctx.canvasManager.virtualHeight) : { isFootKeynotePoseInputAllowed: true, status: 'ready' as const });
    this._currentKneeFraming = currentKneeFraming;

    if (ctx.kneeFramingGuideRenderer) {
      ctx.kneeFramingGuideRenderer.update(dt);
    }

    if (ctx.stateMachine.currentState === 'READY_POSITION') {
      ctx.readyPositionController.setPaused(ctx.pauseModal.isOpen);
      const isAligned =
        currentKneeFraming.status === 'ready' ||
        ctx.readyPositionController.checkAlignment(
          sourceLandmarks,
          ctx.canvasManager.virtualWidth,
          ctx.canvasManager.virtualHeight,
        );
      ctx.readyPositionController.setAligned(isAligned);
      ctx.readyPositionController.update(dt);
    }

    // Issue #205 & #237: 가상 픽셀 좌표(0~1080 / 0~2160)를 정규화 좌표계(0~1)로 비파괴 변환하여 전달
    const normalizedLandmarks =
      sourceLandmarks.length >= 25
        ? (ctx.toNormalizedLandmarks
            ? ctx.toNormalizedLandmarks(sourceLandmarks, ctx.canvasManager.virtualWidth, ctx.canvasManager.virtualHeight)
            : toNormalizedLandmarks(sourceLandmarks, ctx.canvasManager.virtualWidth, ctx.canvasManager.virtualHeight))
        : null;

    // 발 키노트 감지 (Issue #197, #206, #237: 정규화 좌표 전달, 프레이밍/합장/pause 안전 가드 및 공통 라우터 경유)
    const isSafetyGuarded = ctx.menuInput.isActive || ctx.pauseModal.isOpen;
    ctx.footKeynoteInput.setSafetyGuarded(isSafetyGuarded);
    const footEvents = ctx.footKeynoteDetector.update(
      dt,
      normalizedLandmarks,
      ctx.engine?.elapsedTime ?? 0,
      {
        isSafetyGuarded,
        isPoseInputAllowed: currentKneeFraming.isFootKeynotePoseInputAllowed,
        virtualHeight: 1,
      },
    );
    for (const event of footEvents) {
      ctx.footKeynoteInput.routeEvent(event);
    }

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
  // 7단계 렌더 레이어 세부 구현 (Render Layer Implementations)
  // ─────────────────────────────────────────────────────────────

  renderClear(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    ctx.canvasManager.resetTransform();
    context2d.fillStyle = '#0a0a1a';
    context2d.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.canvasManager.applyVirtualTransform();
  }

  renderBackground(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;
    if (ctx.cameraLayer.isActive) {
      ctx.cameraLayer.render(context2d, vw, vh);
    }
  }

  renderAvatarAndSkeleton(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    if (ctx.settingsModal.skeletonEnabled && ctx.poseManager.hasPose && ctx.skeletonAnimation.smoothedLandmarks.length > 0) {
      ctx.boneRenderer.render(context2d, ctx.skeletonAnimation.smoothedLandmarks, 1);
      ctx.jointRenderer.render(context2d, ctx.skeletonAnimation.smoothedLandmarks, ctx.skeletonAnimation.breathScale);
      ctx.skeletonEffect.renderTrails(context2d);
    }
  }

  renderMenuScene(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    const menuBg = !ctx.cameraLayer.isActive ? ctx.imageLoader?.get?.('bg', 'menu') : null;
    ctx.dreamGrid.render(context2d, vw, vh, {
      alpha: 0.08,
      color: '#28E6FF',
      renderZoneConnections: false,
      bgImage: menuBg,
    });

    ctx.stickmanRenderer.render(context2d, vw, vh, { alpha: 0.85, alwaysRender: true });

    if (ctx.state.menuMode === 'main') {
      const currentLoco = LOCOMOTION_MODES.find((m) => m.mode === ctx.locomotionModal.selectedMode);
      ctx.menuRenderer.render(context2d, vw, vh, {
        unlockedChapter: ctx.state.unlockedChapter,
        stars: ctx.state.starsMap,
        selectedChapter: ctx.state.menuHoverItem?.type === 'chapter' ? ctx.state.menuHoverItem.id : 0,
        locomotionLabel: currentLoco?.label,
        locomotionIcon: currentLoco?.icon,
      });
    } else {
      const subLevels = ctx.questionBank.getSubLevels(ctx.state.selectedChapter);
      ctx.menuRenderer.renderSubMenu(
        context2d,
        vw,
        vh,
        ctx.state.selectedChapter,
        subLevels,
        ctx.state.menuHoverItem?.type === 'sublevel' ? ctx.state.menuHoverItem.id : ctx.state.selectedSubLevel,
      );
    }

    // 카메라 상태 안내 오버레이 (대기 중 또는 권한 거부 시 안내)
    if (ctx.cameraLayer.status === 'requesting') {
      context2d.fillStyle = '#28E6FF';
      context2d.font = `bold 28px sans-serif`;
      context2d.textAlign = 'center';
      context2d.fillText('📷 카메라 권한 요청 중... 브라우저에서 허용을 눌러주세요', vw / 2, vh * 0.88);
    } else if (ctx.cameraLayer.status === 'denied') {
      context2d.fillStyle = '#FF8844';
      context2d.font = `bold 26px sans-serif`;
      context2d.textAlign = 'center';
      context2d.fillText('⚠️ 카메라 권한 차단됨 (1~5번 키 또는 화면 클릭으로 플레이 가능)', vw / 2, vh * 0.88);
    }
    ctx.effectManager.render(context2d, vw, vh);
  }

  renderGameScene(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    const bossX = vw * 0.5;
    const bossY = vh * HORIZON_RATIO;
    const bossRadius = Math.min(180, vw * 0.12);

    let gridColor = CHAPTER_COLORS[ctx.state.currentChapter] || '#28E6FF';
    if (ctx.state.gamePhase === 'running') {
      gridColor = ctx.beatCoordinator.phase === 'REST_READY' ? '#28E6FF' : '#FF8844';
    }

    const chapterKey = `ch${ctx.state.currentChapter}`;
    const gameBg = !ctx.cameraLayer.isActive ? ctx.imageLoader?.get?.('bg', chapterKey) : null;
    const beatProg = ctx.beatCoordinator?.rhythmEngine?.beatProgress ?? undefined;

    ctx.dreamGrid.render(context2d, vw, vh, {
      vanishingX: bossX,
      vanishingY: bossY,
      color: gridColor,
      bgImage: gameBg,
      beatProgress: beatProg,
    });

    // RUN-MAT-004 (#373) & Issue #422, #426: 전 페이즈 상시 발 판정선 렌더링 (DreamGrid 직후 바닥 배경 레이어)
    if (ctx.runningMatRenderer) {
      const isRunQuestion = ctx.stateMachine?.currentState === 'RUN_QUESTION';
      const snapshot = isRunQuestion ? (ctx.beatCoordinator?.getRunTimingSnapshot?.() ?? null) : null;
      const mode = ctx.locomotionModal?.selectedMode ?? 'run';
      const view = isRunQuestion ? (RunningMatPresenter as any).present(snapshot, mode) : null;
      ctx.runningMatRenderer.render(context2d, view, vw, vh, {
        vanishingPoint: { x: bossX, y: bossY },
        elapsedTime: ctx.engine?.elapsedTime ?? 0,
        beatProgress: beatProg,
      });
    }

    // Issue #192, #232 & #235: 그리드 레일 궤적 기반 별가루 악기 노트(StarNoteRenderer) 렌더링
    if (ctx.presentationAdapter.canRenderStarCollect(ctx.stateMachine.currentState)) {
      const isPhaseAStarCollect = ctx.stateMachine?.currentState === 'STAR_COLLECT';
      const branchClock = ctx.beatCoordinator?.getBranchClock?.() ?? null;
      const secondsPerBeat =
        branchClock?.secondsPerBeat ?? ctx.beatCoordinator?.rhythmEngine?.secondsPerBeat ?? 0.5;

      ctx.starNoteRenderer.render(context2d, vw, vh, {
        target: ctx.starNoteScheduler.currentTarget,
        targets: ctx.starNoteScheduler.activeNotes,
        elapsedTime: ctx.engine?.elapsedTime ?? 0,
        vanishingX: bossX,
        vanishingY: bossY,
        isPaused: ctx.engine?.paused || ctx.starNoteScheduler.isPaused,
        ...(isPhaseAStarCollect
          ? {
              beatPreview: {
                startTime: ctx.starNoteScheduler.startTime,
                secondsPerBeat,
              },
            }
          : {}),
      });
    }

    // Issue #195: Phase B 보스 결전(BOSS_CLIMAX) 충격파·군단·피버·광폭화 시각화 (DreamGrid 이후, HUD 이전)
    if (ctx.stateMachine.currentState === 'BOSS_CLIMAX') {
      const hazardState =
        ctx.bossHazardController && ctx.bossHazardController.isAttacking
          ? {
              activePattern: ctx.bossHazardController.currentAttack,
              progress: ctx.bossHazardController.attackProgress,
              isResolved: ctx.bossHazardController.attackState === 'resolved',
              isEvaded: ctx.bossHazardController.isEvaded,
            }
          : null;

      ctx.bossClimaxRenderer.render(context2d, vw, vh, {
        bossHp: ctx.boss.hp,
        bossMaxHp: ctx.boss.maxHp,
        isEnraged: ctx.bossHazardController ? ctx.bossHazardController.isEnraged : (ctx.boss.hp / ctx.boss.maxHp <= 0.3),
        minionCount: ctx.beatRoundResolver.resourceManager.troopManager.minionCount,
        guardianStage: ctx.guardian.stage,
        stardust: ctx.beatRoundResolver.resourceManager.stardust,
        feverCombo: ctx.bossFeverController ? ctx.bossFeverController.feverCombo : 0,
        hazard: hazardState,
        barrageActive: ctx.state.climaxBarrageTimer > 0,
        barrageProgress: ctx.state.climaxBarrageTimer > 0 ? 1 - (ctx.state.climaxBarrageTimer / CLIMAX_BARRAGE_DURATION) : 0,
        elapsedTime: ctx.engine?.elapsedTime ?? 0,
        vanishingX: bossX,
        vanishingY: bossY,
      });
    }

    ctx.bossRenderer.render(context2d, ctx.state.currentChapter, bossX, bossY, bossRadius, ctx.boss.phase);
    ctx.hudLayer.render(context2d, vw, vh, ctx.getHUDData());

    // Issue #232 & #279: GameState 기반 상태별 렌더 허용표(Render Allow Matrix) 적용
    if (ctx.presentationAdapter.canRenderRunningHUD(ctx.stateMachine.currentState)) {
      ctx.beatHUDRenderer.render(context2d, vw, vh, {
        question: ctx.state.currentQuestion,
        totalSteps: ctx.state.totalSteps,
        completedExerciseBeats: ctx.beatCoordinator.completedExerciseBeats,
        exerciseBeats: ctx.beatCoordinator.exerciseBeats,
        locomotionMode: ctx.locomotionModal.selectedMode,
        activeHazardPattern: null,
        hazardBeatProgress: 0,
        questionApproachProgress: ctx.beatCoordinator.questionApproachProgress,
        vanishingX: bossX,
        vanishingY: bossY,
      });

      // Issue #322: 러닝 페이즈 문제 수식을 QuestionRenderer 단일 뷰(SSOT)로 일원화
      ctx.questionRenderer.render(context2d, vw, vh, {
        question: ctx.state.currentQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
        questionApproachProgress: ctx.beatCoordinator.questionApproachProgress,
        vanishingX: bossX,
        vanishingY: bossY,
        headerOnly: true,
        answerSelectable: false,
        showAnswerTime: false,
      });

      // Issue #279 / #313: 러닝 페이즈 approachStartBeat(기본 6박) 이후 답안 카드 원근 접근 프리뷰 렌더링
      if (
        ctx.presentationAdapter.canRenderAnswerPreview(
          ctx.stateMachine.currentState,
          ctx.beatCoordinator.answerApproachProgress,
        )
      ) {
        ctx.questionRenderer.render(context2d, vw, vh, {
          question: ctx.state.currentQuestion,
          questionVisible: true,
          selectedChoiceIndex: null,
          answerApproachProgress: ctx.beatCoordinator.answerApproachProgress,
          vanishingX: bossX,
          vanishingY: bossY,
          buttonsOnly: true,
          answerSelectable: false,
          showAnswerTime: false,
        });
      }
    } else if (ctx.presentationAdapter.canRenderQuestion(ctx.stateMachine.currentState)) {
      // Issue #285 (UI-ANSWER-002): ArmReachAnswerSelector 점수 및 조준/확정 상태 실시간 연동
      const armState = ctx.armReachAnswerSelector.state;
      let choiceProgress0 = 0;
      let choiceProgress1 = 0;

      const leftIdx = armState.leftHand.answerIndex ?? (armState.leftHand.zoneId === 4 ? 0 : (armState.leftHand.zoneId === 5 ? 1 : null));
      if (leftIdx === 0) {
        choiceProgress0 = Math.max(choiceProgress0, armState.leftHand.score ?? 0);
      } else if (leftIdx === 1) {
        choiceProgress1 = Math.max(choiceProgress1, armState.leftHand.score ?? 0);
      }

      const rightIdx = armState.rightHand.answerIndex ?? (armState.rightHand.zoneId === 4 ? 0 : (armState.rightHand.zoneId === 5 ? 1 : null));
      if (rightIdx === 0) {
        choiceProgress0 = Math.max(choiceProgress0, armState.rightHand.score ?? 0);
      } else if (rightIdx === 1) {
        choiceProgress1 = Math.max(choiceProgress1, armState.rightHand.score ?? 0);
      }

      const selectedIndex = armState.lockedChoice !== null
        ? armState.lockedChoice
        : (armState.confirmedChoice !== null ? armState.confirmedChoice : null);

      let activeHoverIndex: number | null = null;
      if (selectedIndex === null) {
        if (choiceProgress0 >= 0.25 && choiceProgress0 >= choiceProgress1) {
          activeHoverIndex = 0;
        } else if (choiceProgress1 >= 0.25 && choiceProgress1 > choiceProgress0) {
          activeHoverIndex = 1;
        }
      }

      const answerTime = ctx.beatCoordinator.getAnswerSnapshot?.() ?? null;
      const showAnswerTime =
        ctx.stateMachine.currentState === 'ANSWER_SELECT' &&
        ctx.beatCoordinator.phase === 'ANSWER_SELECT' &&
        answerTime?.inputOpen === true &&
        (answerTime.phase === 'primary' || answerTime.phase === 'extension');

      ctx.questionRenderer.render(context2d, vw, vh, {
        question: ctx.state.currentQuestion,
        questionVisible: ctx.state.questionVisible ?? true,
        selectedChoiceIndex: selectedIndex,
        answerApproachProgress: 1.0,
        vanishingX: bossX,
        vanishingY: bossY,
        choiceProgress: [choiceProgress0, choiceProgress1],
        activeHoverIndex,
        answerSelectable: ctx.beatCoordinator.isAnswerOpen,
        answerTime,
        showAnswerTime,
      });

      // Issue #255: ANSWER_SELECT 상태에서 부분 진행도 시각화 및 실패 사유 힌트 렌더링
      const answerFeedback = ctx.presentationAdapter.getAnswerSelectFeedback(
        ctx.stateMachine.currentState,
        ctx.armReachAnswerSelector.state,
        ctx.state.lastFrameDt,
      );
      ctx.presentationAdapter.renderAnswerFeedback(context2d, vw, vh, answerFeedback);
    } else if (ctx.presentationAdapter.canRenderHazardEvade(ctx.stateMachine.currentState)) {
      const isActionSafe =
        ctx.phaseAHazardController.isEvaded ||
        (ctx.phaseAHazardController.performedAction !== null &&
          ctx.phaseAHazardController.performedAction === ctx.phaseAHazardController.activePattern);
      ctx.presentationAdapter.renderHazardEvade(context2d, vw, vh, {
        activePattern: ctx.phaseAHazardController.activePattern,
        beatProgress: ctx.phaseAHazardController.beatProgress,
        vanishingX: bossX,
        vanishingY: bossY,
        isEvaded: ctx.phaseAHazardController.isEvaded,
        isResolved: ctx.phaseAHazardController.isResolved,
        performedAction: ctx.phaseAHazardController.performedAction,
        isActionDetected: isActionSafe,
        isCurrentlySafe: isActionSafe,
      });
    } else if (ctx.presentationAdapter.canRenderReadyPosition(ctx.stateMachine.currentState)) {
      ctx.readyPositionRenderer.render(
        context2d,
        vw,
        vh,
        ctx.readyPositionController.getState(),
      );
    }

    ctx.stickmanRenderer.render(context2d, vw, vh, { alwaysRender: true });
    ctx.renderFeedback(context2d, vw, vh);
    ctx.effectManager.render(context2d, vw, vh);

    // Issue #490 (Card #490): [AVATAR-03] 화면 이탈 감지 및 중앙 복귀 유도 가이드 UI
    const postureGuide = ctx.postureGuideRenderer ?? (ctx.postureGuideRenderer = new PostureGuideRenderer());
    const anchorX = ctx.stickmanRenderer?.currentAnchorXRatio ?? 0.5;
    const exitDir: 'left' | 'right' | null = anchorX < 0.20 ? 'left' : anchorX > 0.80 ? 'right' : null;
    postureGuide.renderBoundaryWarning(context2d, vw, vh, exitDir);
  }

  renderResultScene(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    if (ctx.state.resultData) {
      ctx.resultRenderer.render(context2d, vw, vh, ctx.state.resultData);
    }
    ctx.stickmanRenderer.render(context2d, vw, vh, { alpha: 0.9, alwaysRender: true });
    ctx.effectManager.render(context2d, vw, vh);
  }

  renderHUD(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    let actionLabel: string | undefined;
    let actionColor: string | undefined;
    let pageId: string | undefined;
    let customActionSlot: BottomBarSlot | undefined;

    if (ctx.state.screenMode === 'menu') {
      if (ctx.state.menuMode === 'sub') {
        actionLabel = '← 뒤로';
        actionColor = '#28E6FF';
        pageId = 'submenu';
        customActionSlot = getSubmenuBackSlot();
      } else {
        pageId = 'main_home';
      }
    } else if (ctx.state.screenMode === 'game') {
      actionLabel = '정지';
      actionColor = '#FF4444';
      pageId = 'pause';
    } else if (ctx.state.screenMode === 'result') {
      actionLabel = '메뉴로';
      actionColor = '#FFCB4D';
      pageId = 'result';
    }

    ctx.bottomBar.render(context2d, vw, vh, {
      actionLabel,
      actionColor,
      pageId,
      customActionSlot,
      settingsHoverProgress: ctx.state.settingsHoverTimer / MENU_HOVER_DWELL_TIME,
      actionHoverProgress: ctx.state.actionHoverTimer / MENU_HOVER_DWELL_TIME,
      mana: ctx.state.screenMode === 'game' ? ctx.battle.mana : undefined,
      manaMax: ctx.state.screenMode === 'game' ? DEFAULT_CONFIG.mana.spellCost : undefined,
      combo: ctx.state.screenMode === 'game' ? ctx.battle.combo : undefined,
    });
  }

  renderModalsAndOverlays(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    if (ctx.settingsModal.isOpen) {
      ctx.settingsModal.render(context2d, vw, vh);
    }
    if (ctx.locomotionModal.isOpen) {
      ctx.locomotionModal.render(context2d, vw, vh);
    }
    if (ctx.pauseModal.isOpen) {
      ctx.pauseModal.render(context2d, vw, vh);
    }

    // 무릎 프레이밍 가이드 렌더링 (인게임 중, READY_POSITION 제외)
    if (ctx.state.screenMode === 'game' && ctx.stateMachine.currentState !== 'READY_POSITION' && this._currentKneeFraming) {
      ctx.kneeFramingGuideRenderer?.render(context2d, vw, vh, this._currentKneeFraming);
    }

    // 커서 렌더링 (Issue #492: tracker.render 미존재 예외 해소 및 answerSelectionRenderer 교정)
    const tracker = ctx.answerSelector?.cursorTracker ?? ctx.cursorTracker;
    if (tracker && tracker.cursors && tracker.cursors.size > 0) {
      const renderCursors = new Map(tracker.cursors.entries());
      if (ctx.menuInput?.isActive) {
        renderCursors.delete('leftHand');
        renderCursors.delete('rightHand');
      }
      ctx.answerSelectionRenderer?.render(
        context2d,
        vw,
        vh,
        [],
        renderCursors,
        [0, 0],
      );
    }

    // 금빛 합장 링 렌더링
    if (ctx.menuInput.isActive) {
      let label = '손모으기';
      let progress = 0;

      if (ctx.pauseModal.isOpen) {
        label = ctx.pauseModal.hoverAction === 'resume' ? '재개' : (ctx.pauseModal.hoverAction === 'quit' ? '나가기' : '선택');
        progress = ctx.pauseModal.hoverProgress;
      } else if (ctx.state.screenMode === 'menu') {
        label = ctx.state.menuHoverItem ? '선택' : (ctx.state.settingsHoverTimer > 0 ? '설정' : (ctx.state.actionHoverTimer > 0 ? '뒤로' : '손모으기'));
        progress = Math.max(ctx.state.menuHoverTimer, ctx.state.settingsHoverTimer, ctx.state.actionHoverTimer) / MENU_HOVER_DWELL_TIME;
      } else if (ctx.state.screenMode === 'game') {
        label = ctx.state.settingsHoverTimer > 0 ? '설정' : (ctx.state.actionHoverTimer > 0 ? '정지' : '손모으기');
        progress = Math.max(ctx.state.settingsHoverTimer, ctx.state.actionHoverTimer) / MENU_HOVER_DWELL_TIME;
      } else if (ctx.state.screenMode === 'result') {
        label = '메뉴복귀';
        progress = Math.max(ctx.state.resultReturnTimer, ctx.state.settingsHoverTimer, ctx.state.actionHoverTimer) / MENU_HOVER_DWELL_TIME;
      }

      drawJoinedHandsCursor(context2d, vw, vh, ctx.menuInput.cursorX, ctx.menuInput.cursorY, label, progress);
    }

    // X자 제스처 오버레이
    ctx.gestureFeedbackOverlay.render(context2d, vw, vh, {
      isCrossing: ctx.xGestureDetector.isCrossing,
      inCooldown: ctx.xGestureDetector.inCooldown,
      isPaused: ctx.pauseModal.isOpen,
      progress: ctx.xGestureDetector.progress,
      screenMode: ctx.state.screenMode,
      menuMode: ctx.state.menuMode,
    });

    // 캐릭터 대사창 오버레이
    ctx.dialogueOverlayRenderer.render(context2d, vw, vh);

    // 튜토리얼 오버레이
    if (ctx.tutorial.isVisible) {
      ctx.tutorial.render(context2d, vw, vh);
    }
  }

  renderTransitions(ctx: MainSceneContext): void {
    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    ctx.transitionManager.render(context2d, vw, vh);
    ctx.canvasManager.resetTransform();
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
