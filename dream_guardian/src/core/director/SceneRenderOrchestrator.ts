/**
 * SceneRenderOrchestrator - 7계층 캔버스 레이어 렌더링 디스패처 및 오케스트레이터
 *
 * [REFACTOR-SRP-005] (Issue #636)
 * - SceneDirector에서 비대해진 7단계 렌더 레이어(Clear, Background, Avatar, Entities, HUD, Modals, Transitions)
 *   및 씬별 렌더링(Menu, Game, Result, Assault) 로직을 분리
 * - 단일 책임 원칙(SRP)에 따른 렌더링 디스패칭 전담 모듈화
 * - SceneDirector 소스 코드 1,000줄 미만 경량화 달성
 */

import { DEFAULT_CONFIG } from '../Config.js';
import { HORIZON_RATIO } from '../../../config/grid.config.js';
import { UI_LAYOUT } from '../../../config/ui.config.js';
import { drawJoinedHandsCursor, PostureGuideRenderer } from '../../render/index.js';
import { RunningMatPresenter, presentRunningMat } from '../../render/RunningMatPresenter.js';
import { LOCOMOTION_MODES, type BottomBarSlot } from '../../ui/index.js';
import { AssaultSceneHandler } from './AssaultSceneHandler.js';
import {
  MENU_HOVER_DWELL_TIME,
  CLIMAX_BARRAGE_DURATION,
  getSubmenuBackSlot,
  type MainSceneContext,
} from '../SceneDirector.js';

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

/**
 * 보스 배치 위치 및 반지름 조회 (매 호출마다 UI_LAYOUT.boss 재참조, 캐시 금지)
 * [LAYOUT-009 / Issue #576]
 */
export function getBossPlacement(
  vw: number = 1080,
  vh: number = 2160,
): { x: number; y: number; radius: number } {
  const bossLayout = UI_LAYOUT.boss;
  const scaleX = vw / 1080;
  const scaleY = vh / 2160;
  const x = (bossLayout?.x ?? 540) * scaleX;
  const y = (bossLayout?.y ?? 1209.6) * scaleY;
  const maxRadius = (bossLayout?.maxRadius ?? 180) * scaleX;
  const radiusRatio = bossLayout?.radiusRatio ?? 0.12;
  const radius =
    bossLayout?.radius !== undefined && bossLayout.radius !== 129.6
      ? bossLayout.radius * scaleX
      : Math.min(maxRadius, vw * radiusRatio);
  return { x, y, radius };
}

export interface SceneRenderOrchestratorOptions {
  assaultHandler?: AssaultSceneHandler;
  kneeFramingProvider?: () => any;
  currentSceneProvider?: () => string;
}

export class SceneRenderOrchestrator {
  private readonly _assaultHandler: AssaultSceneHandler;
  private readonly _options: SceneRenderOrchestratorOptions;

  constructor(options?: SceneRenderOrchestratorOptions) {
    this._options = options ?? {};
    this._assaultHandler = options?.assaultHandler ?? new AssaultSceneHandler();
  }

  /** 현재 프레이밍 상태 조회 */
  public get kneeFraming(): any {
    return this._options.kneeFramingProvider ? this._options.kneeFramingProvider() : null;
  }

  /** 어설트 핸들러 조회 */
  public get assaultHandler(): AssaultSceneHandler {
    return this._assaultHandler;
  }

  /**
   * 7단계 캔버스 렌더 레이어 등록
   */
  public registerLayers(director: {
    registerLayer: (
      name: string,
      order: number,
      render: (context: any) => void,
      enabled?: () => boolean,
    ) => any;
    renderScene: (scene: any, context?: any) => void;
    currentScene: string;
    renderClear?: (ctx: MainSceneContext) => void;
    renderBackground?: (ctx: MainSceneContext) => void;
    renderAvatarAndSkeleton?: (ctx: MainSceneContext) => void;
    renderHUD?: (ctx: MainSceneContext) => void;
    renderModalsAndOverlays?: (ctx: MainSceneContext) => void;
    renderTransitions?: (ctx: MainSceneContext) => void;
  }): void {
    director.registerLayer('clear', RENDER_LAYER_ORDER.CLEAR, (c: any) =>
      director.renderClear ? director.renderClear(c) : this.renderClear(c),
    );
    director.registerLayer('background', RENDER_LAYER_ORDER.BACKGROUND, (c: any) =>
      director.renderBackground ? director.renderBackground(c) : this.renderBackground(c),
    );
    director.registerLayer('avatar', RENDER_LAYER_ORDER.AVATAR, (c: any) =>
      director.renderAvatarAndSkeleton ? director.renderAvatarAndSkeleton(c) : this.renderAvatarAndSkeleton(c),
    );
    director.registerLayer('entities', RENDER_LAYER_ORDER.ENTITIES, (c: any) => {
      const scene = this._options.currentSceneProvider
        ? this._options.currentSceneProvider()
        : director.currentScene;
      director.renderScene(scene, c);
    });
    director.registerLayer('hud', RENDER_LAYER_ORDER.HUD, (c: any) =>
      director.renderHUD ? director.renderHUD(c) : this.renderHUD(c),
    );
    director.registerLayer('modals', RENDER_LAYER_ORDER.MODALS, (c: any) =>
      director.renderModalsAndOverlays ? director.renderModalsAndOverlays(c) : this.renderModalsAndOverlays(c),
    );
    director.registerLayer('transitions', RENDER_LAYER_ORDER.TRANSITIONS, (c: any) =>
      director.renderTransitions ? director.renderTransitions(c) : this.renderTransitions(c),
    );
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
      const subLevels = ctx.questionBank?.getSubLevels
        ? ctx.questionBank.getSubLevels(ctx.state.selectedChapter)
        : [];
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

  /** 보스 접근전(Boss Assault) 전용 씬 렌더링 */
  renderAssaultScene(ctx: MainSceneContext): void {
    this._assaultHandler.render(ctx);
  }

  renderGameScene(ctx: MainSceneContext): void {
    if (this._assaultHandler.isAssaultMode(ctx)) {
      this.renderAssaultScene(ctx);
      return;
    }

    const context2d = ctx.canvasManager.ctx;
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    const vanishingX = vw * 0.5;
    const vanishingY = vh * HORIZON_RATIO;
    const { x: bossX, y: bossY, radius: bossRadius } = getBossPlacement(vw, vh);

    let gridColor = CHAPTER_COLORS[ctx.state.currentChapter] || '#28E6FF';
    if (ctx.state.gamePhase === 'running') {
      gridColor = ctx.beatCoordinator.phase === 'REST_READY' ? '#28E6FF' : '#FF8844';
    }

    const chapterKey = `ch${ctx.state.currentChapter}`;
    const gameBg = !ctx.cameraLayer.isActive ? ctx.imageLoader?.get?.('bg', chapterKey) : null;
    const beatProg = ctx.beatCoordinator?.rhythmEngine?.beatProgress ?? undefined;

    ctx.dreamGrid.render(context2d, vw, vh, {
      vanishingX,
      vanishingY,
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
        vanishingPoint: { x: vanishingX, y: vanishingY },
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
        vanishingX,
        vanishingY,
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
        vanishingX,
        vanishingY,
      });
    }

    ctx.bossRenderer.render(context2d, ctx.state.currentChapter, bossX, bossY, bossRadius, ctx.boss.phase);
    ctx.hudLayer.render(context2d, vw, vh, ctx.getHUDData());

    // Issue #232 & #279: GameState 기반 상태별 렌더 허용표(Render Allow Matrix) 적용
    if (ctx.presentationAdapter?.canRenderRunningHUD?.(ctx.stateMachine.currentState)) {
      ctx.beatHUDRenderer.render(context2d, vw, vh, {
        question: ctx.state.currentQuestion,
        totalSteps: ctx.state.totalSteps,
        completedExerciseBeats: ctx.beatCoordinator.completedExerciseBeats,
        exerciseBeats: ctx.beatCoordinator.exerciseBeats,
        locomotionMode: ctx.locomotionModal.selectedMode,
        activeHazardPattern: null,
        hazardBeatProgress: 0,
        questionApproachProgress: ctx.beatCoordinator.questionApproachProgress,
        vanishingX,
        vanishingY,
      });

      // Issue #322: 러닝 페이즈 문제 수식을 QuestionRenderer 단일 뷰(SSOT)로 일원화
      ctx.questionRenderer.render(context2d, vw, vh, {
        question: ctx.state.currentQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
        questionApproachProgress: ctx.beatCoordinator.questionApproachProgress,
        vanishingX,
        vanishingY,
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
          vanishingX,
          vanishingY,
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
        vanishingX,
        vanishingY,
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
        vanishingX,
        vanishingY,
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

    if (this._assaultHandler.isAssaultMode(ctx)) {
      this._assaultHandler.renderHUD(ctx);
      return;
    }

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
    const kneeFraming = this.kneeFraming;
    if (ctx.state.screenMode === 'game' && ctx.stateMachine.currentState !== 'READY_POSITION' && kneeFraming) {
      ctx.kneeFramingGuideRenderer?.render(context2d, vw, vh, kneeFraming);
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
    if (ctx.gestureFeedbackOverlay && ctx.xGestureDetector) {
      ctx.gestureFeedbackOverlay.render(context2d, vw, vh, {
        isCrossing: ctx.xGestureDetector.isCrossing,
        inCooldown: ctx.xGestureDetector.inCooldown,
        isPaused: ctx.pauseModal?.isOpen ?? false,
        progress: ctx.xGestureDetector.progress,
        screenMode: ctx.state.screenMode,
        menuMode: ctx.state.menuMode,
      });
    }

    ctx.dialogueOverlayRenderer?.render?.(context2d, vw, vh);

    if (ctx.tutorial?.isVisible) {
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
}
