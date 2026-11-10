/**
 * AppBootstrap - Dream Guardian 메인 앱 부트스트랩 및 이벤트 리스너 관리자
 *
 * [REFACTOR-MAIN-002] (Issue #302)
 * [REFACTOR-SRP-012] (Issue #643) UI 프레젠테이션 동기화 및 콘텐츠 프리로더(AppUIPresentationSyncManager) 분리
 */

import type {
  AssaultSession,
  AssaultSessionOptions,
  AssaultFinaleOptions,
  AssaultLocationLike,
  AssaultEnvLike,
} from './AssaultSessionFactory.js';
import { AssaultSessionWireHelper } from './bootstrap/AssaultSessionWireHelper.js';
import {
  BootstrapStateMachineBuilder,
  type BootstrapStateMachineHost,
  type ScreenMode,
  type MenuMode,
  type GamePhase,
} from './bootstrap/BootstrapStateMachineBuilder.js';
import {
  BootstrapSubsystemFactory,
  type BootstrapSubsystems,
} from './bootstrap/BootstrapSubsystemFactory.js';
import {
  AppEventListenerManager,
  type AppEventListenerHost,
} from './bootstrap/AppEventListenerManager.js';
import {
  AppBattleEventBinder,
  bindBattleEvents,
} from './bootstrap/AppBattleEventBinder.js';
import {
  AppRoundEventBinder,
  type AppRoundEventHost,
} from './bootstrap/AppRoundEventBinder.js';
import {
  AppPersistenceManager,
  STORAGE_KEY_STAGE_PROGRESS,
  STORAGE_KEY_HIGH_SCORES,
  STORAGE_KEY_REWARDS,
  STORAGE_KEY_TUTORIAL_DONE,
} from './bootstrap/AppPersistenceManager.js';
import {
  AppSessionFlowCoordinator,
  type ExtendedResultData,
  type DevPlayStateParams,
} from './bootstrap/AppSessionFlowCoordinator.js';
import {
  AppUIPresentationSyncManager,
  type AppUIPresentationSyncHost,
} from './bootstrap/AppUIPresentationSyncManager.js';
import type { AssaultFinaleController } from '../game/assault/AssaultFinaleController.js';
import type { AssaultHandoverSnapshot } from '../game/assault/AssaultProgressController.js';
import type { SessionId } from '../types/assault.js';
import { GameEngine } from './GameEngine.js';
import { StateMachine } from './StateMachine.js';
import { SceneDirector, type MainSceneContext } from './SceneDirector.js';
import { GameSessionContext } from './GameSessionContext.js';
import { loadUiLayoutOverride } from './UILayoutOverride.js';
import type { UIPresentationDocument } from '../data/UIPresentation.js';
import type {
  UIPresentationArtifact,
  UIPresentationLoadOptions,
  UIPresentationLoadResult,
} from './UIPresentationLoadService.js';
import type {
  StaticManifestLoadOptions,
  ContentLoadOptions,
} from './ContentLoadService.js';
import type { PublishedContentPack } from '../data/PublishedContentPack.js';
import type { GeneratedQuestion } from '../types/index.js';
import type { Keynote } from '../types/keynote.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { IAvatarRenderer } from '../skeleton/IAvatarRenderer.js';
import {
  BeatRoundResolver,
  BeatRunCoordinator,
  PhaseAHazardController,
  StageProgressController,
  ReadyPositionController,
  BossFeverController,
  BossHazardController,
  BossController,
} from '../game/index.js';
import { dialogueManager } from '../story/index.js';
import { toNormalizedLandmarks, imageLoader } from '../utils/index.js';
import { calcStars } from '../ui/ResultRenderer.js';
import { LOCOMOTION_MODES } from '../ui/index.js';
import type { RoundAnswerStatus, RoundResolveResult } from '../types/result.js';

// Fallback canvas for Node/test environment
function createFallbackCanvas(): HTMLCanvasElement {
  let w = 800;
  let h = 600;
  const ctx = {
    clearRect: () => {},
    setTransform: () => {},
    fillRect: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    roundRect: () => {},
  };
  return {
    clientWidth: w,
    clientHeight: h,
    get width() { return w; },
    set width(v: number) { w = v; },
    get height() { return h; },
    set height(v: number) { h = v; },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as HTMLCanvasElement;
}

export interface AppBootstrapOptions {
  canvas?: HTMLCanvasElement;
  autoStartCamera?: boolean;
  preloadAssets?: boolean;
  loadStaticManifest?: boolean;
  staticManifestUrl?: string;
  staticManifestOptions?: StaticManifestLoadOptions;
  avatarRenderer?: IAvatarRenderer;
  answerRestBeats?: number;
  location?: AssaultLocationLike;
  env?: AssaultEnvLike;
  mode?: string;
  enableAssaultFinale?: boolean;
  persistence?: AppPersistenceManager;
  storage?: Storage | null;
}

// ─── roundRect 폴리필 ───
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number, y: number, w: number, h: number, r: number | number[],
  ) {
    const radius = typeof r === 'number' ? r : (r[0] ?? 0);
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.arcTo(x + w, y, x + w, y + radius, radius);
    this.lineTo(x + w, y + h - radius);
    this.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    this.lineTo(x + radius, y + h);
    this.arcTo(x, y + h, x, y + h - radius, radius);
    this.lineTo(x, y + radius);
    this.arcTo(x, y, x + radius, y, radius);
    this.closePath();
    return this;
  };
}

// Re-exports
export {
  AppPersistenceManager,
  STORAGE_KEY_STAGE_PROGRESS,
  STORAGE_KEY_HIGH_SCORES,
  STORAGE_KEY_REWARDS,
  STORAGE_KEY_TUTORIAL_DONE,
  AppRoundEventBinder,
  type AppRoundEventHost,
  AppUIPresentationSyncManager,
  type AppUIPresentationSyncHost,
};
export {
  isVerifiedPublishedPack,
  type ExtendedResultData,
  type DevPlayStateParams,
} from './bootstrap/AppSessionFlowCoordinator.js';

export interface AppBootstrap extends BootstrapSubsystems {}

export class AppBootstrap {
  public readonly persistence: AppPersistenceManager;
  public readonly canvas: HTMLCanvasElement;
  public readonly stateMachine: StateMachine;
  public readonly beatRoundResolver: BeatRoundResolver;
  public readonly beatCoordinator: BeatRunCoordinator;
  public readonly phaseAHazardController: PhaseAHazardController;
  public readonly stageProgressController: StageProgressController;
  public readonly bossFeverController: BossFeverController;
  public readonly bossHazardController: BossHazardController;
  public readonly readyPositionController: ReadyPositionController;
  public readonly sessionContext: GameSessionContext;
  public readonly sceneDirector: SceneDirector;
  public readonly mainSceneContext: MainSceneContext;
  public readonly engine: GameEngine;
  public readonly getPhaseAStarNotes: () => readonly Keynote[];
  public readonly getPhaseAHazardPattern: (roundIndex?: number) => PhaseAHazardPattern;

  public readonly getActiveUIPresentation: () => Readonly<UIPresentationDocument> | null;
  public readonly getActiveUIArtifact: () => Readonly<UIPresentationArtifact> | null;
  public readonly getActiveUIHash: () => string | null;
  public readonly getPendingUIArtifact: () => Readonly<UIPresentationArtifact> | null;
  public readonly setUIPresentationArtifact: (
    artifact: UIPresentationArtifact | null,
    options?: UIPresentationLoadOptions,
  ) => Promise<UIPresentationLoadResult>;
  public readonly applyUIPresentation: (
    presentation: UIPresentationDocument | null,
    artifact?: UIPresentationArtifact | null,
  ) => void;
  public readonly rollbackUIPresentation: () => boolean;
  public readonly flushPendingUIPresentation: () => boolean;
  public setCustomContentPack: (pack: PublishedContentPack | null) => void;

  public get activePublishedPack(): PublishedContentPack | null {
    return this._uiPresentationSyncManager?.activePublishedPack ?? null;
  }
  public get isTestSession(): boolean {
    return this.sessionLifecycle.isTestSession;
  }
  public get starsMap(): Record<number, number> {
    return this.mainSceneContext?.state?.starsMap ?? {};
  }
  public get resultData(): ExtendedResultData | null {
    return (this.mainSceneContext?.state?.resultData ?? null) as ExtendedResultData | null;
  }

  // Actions
  public readonly selectChapter: (ch: number) => void;
  public readonly selectSubLevel: (sub: number | null) => void;
  public readonly startChapter: (
    ch: number,
    sub?: number,
    options?: { pack?: PublishedContentPack | null; isTestSession?: boolean; contentHash?: string },
  ) => void;
  public readonly startTestPlaySession: (
    ch: number,
    options: { pack: PublishedContentPack; subLevel?: number; isTestSession?: boolean; contentHash?: string },
  ) => void;
  public readonly abortSession: () => void;
  public readonly abortTestSession: () => void;
  public readonly startReadyPhase: () => void;
  public readonly startRunningPhase: () => void;
  public readonly startAssaultPhase: () => void;
  public readonly enterQuestionPhase: () => void;
  public readonly handleAnswer: (idx: number, status: RoundAnswerStatus, resolveResult: RoundResolveResult) => void;
  public readonly showResult: (victory: boolean) => void;
  public readonly goToMenu: () => void;
  public readonly restartGame: () => void;
  public readonly answerCurrentQuestion: (idx: number) => void;
  public readonly ensureCameraStarted: () => Promise<void>;
  public readonly loadQuestions: () => Promise<void>;
  public readonly loadFitnessPatterns: () => Promise<void>;
  public readonly loadStaticManifest: (manifestUrl?: string, options?: StaticManifestLoadOptions) => Promise<boolean>;
  public readonly loadLocalTestOverride: (identifier: string, options?: ContentLoadOptions) => Promise<boolean>;
  public readonly applyDevPlayState?: (params: DevPlayStateParams) => void;

  private _isInitialized = false;
  private _isRunning = false;
  private _isDisposed = false;
  private _options: AppBootstrapOptions;
  private _sessionFlowCoordinator!: AppSessionFlowCoordinator;
  private _assaultWireHelper!: AssaultSessionWireHelper;
  private _stateMachineBuilder!: BootstrapStateMachineBuilder;
  private _eventListenerManager!: AppEventListenerManager;
  private _battleEventBinder!: AppBattleEventBinder;
  private _roundEventBinder!: AppRoundEventBinder;
  private _uiPresentationSyncManager!: AppUIPresentationSyncManager;
  public enableAssaultFinale = false;

  public _onResize!: () => void;
  public _onKeyDown!: (e: KeyboardEvent) => void;
  public _onKeyUp!: (e: KeyboardEvent) => void;
  public _onCanvasClick!: (e: MouseEvent) => void;
  public _onVisibilityChange!: () => void;

  get isInitialized(): boolean { return this._isInitialized; }
  get isRunning(): boolean { return this._isRunning; }
  get isDisposed(): boolean { return this._isDisposed; }
  get currentChapter(): number { return this.mainSceneContext?.state?.currentChapter ?? 1; }
  get selectedSubLevel(): number | undefined { return this.mainSceneContext?.state?.selectedSubLevel; }
  get currentQuestion(): GeneratedQuestion | null { return (this.mainSceneContext?.state?.currentQuestion ?? null) as GeneratedQuestion | null; }
  get assaultSession(): AssaultSession | null { return this._assaultWireHelper?.assaultSession ?? null; }
  get _assaultSession(): AssaultSession | null { return this._assaultWireHelper?.assaultSession ?? null; }
  get bossController(): BossController { return this.boss; }
  get finaleController(): AssaultFinaleController | null { return this._assaultWireHelper?.finaleController ?? null; }
  get isFinaleActive(): boolean { return Boolean(this._assaultWireHelper?.isFinaleActive); }
  get stateMachineBuilder(): BootstrapStateMachineBuilder { return this._stateMachineBuilder; }
  get eventListenerManager(): AppEventListenerManager { return this._eventListenerManager; }
  get battleEventBinder(): AppBattleEventBinder { return this._battleEventBinder; }
  get roundEventBinder(): AppRoundEventBinder { return this._roundEventBinder; }
  get sessionFlowCoordinator(): AppSessionFlowCoordinator { return this._sessionFlowCoordinator; }
  get uiPresentationSyncManager(): AppUIPresentationSyncManager { return this._uiPresentationSyncManager; }

  public isAssaultMode(): boolean {
    return this._assaultWireHelper?.isAssaultMode?.() ?? false;
  }

  public handleVisibilityChange(hidden?: boolean): void {
    this._assaultWireHelper?.handleVisibilityChange(hidden);
  }

  public assembleAssaultSession(options?: Partial<AssaultSessionOptions>): AssaultSession {
    return this._assaultWireHelper.assembleAssaultSession(options);
  }
  public startAssaultFinale(snapshot?: AssaultHandoverSnapshot | null, options?: AssaultFinaleOptions): AssaultFinaleController | null {
    return this._assaultWireHelper.startAssaultFinale(snapshot, options);
  }
  public assembleAssaultFinaleSession(snapshot: AssaultHandoverSnapshot, options?: AssaultFinaleOptions): AssaultFinaleController | null {
    return this._assaultWireHelper.assembleAssaultFinaleSession(snapshot, options);
  }
  public handleAssaultIntent(
    intent: string,
    snapshot?: AssaultHandoverSnapshot | null,
    sessionToken?: SessionId | string | number | null,
    options?: { startFinale?: boolean; enableFinale?: boolean; finaleOptions?: AssaultFinaleOptions },
  ): boolean {
    return this._assaultWireHelper.handleAssaultIntent(intent, snapshot, sessionToken, options);
  }
  public restartAssaultSession(options?: Partial<AssaultSessionOptions>): AssaultSession {
    return this._assaultWireHelper.restartAssaultSession(options);
  }

  constructor(options?: AppBootstrapOptions) {
    this._options = options ?? {};
    this.persistence = this._options.persistence ?? new AppPersistenceManager({ storage: this._options.storage });
    this.enableAssaultFinale = Boolean(this._options.enableAssaultFinale);
    this._assaultWireHelper = new AssaultSessionWireHelper(this);
    const self = this;

    const canvas = this._options.canvas
      ?? (typeof document !== 'undefined' ? (document.getElementById('game-canvas') as HTMLCanvasElement) : undefined)
      ?? createFallbackCanvas();
    this.canvas = canvas;

    // ─── [REFACTOR-CORE-003] (Issue #618): 핵심 서브시스템 인스턴스 팩토리 ───
    const subsystems = BootstrapSubsystemFactory.create({
      canvas,
      avatarRenderer: this._options.avatarRenderer,
    });
    Object.assign(this, subsystems);

    const {
      canvasManager, cameraLayer, poseManager, skeletonEffect,
      questionBank, speech, eventBus, battle, boss, guardian,
      bossRenderer, effectManager, locomotionDetectors, jumpDetector,
      pauseModal, settingsModal, locomotionModal, tutorial,
      dialogueOverlayRenderer, sessionLifecycle, starNoteScheduler,
      contentLoadService,
    } = subsystems;
    const defaultSecondsPerBeat = starNoteScheduler.timeline.spb;

    const battleEventBinder = bindBattleEvents({
      eventBus,
      canvasManager,
      effectManager,
      bossRenderer,
      skeletonEffect,
      sfx: subsystems.sfx,
      speech,
      battle,
      boss,
      getIsEnraged: () => (bossHazardController ? bossHazardController.isEnraged : (boss.hp / boss.maxHp <= 0.3)),
      dialogueManager,
      dialogueOverlayRenderer,
      sessionLifecycle,
      getSessionContext: () => sessionContext,
      getCurrentChapter: () => currentChapter,
      getStarsMap: () => starsMap,
      onShowResult: (victory: boolean) => showResult(victory),
      onCastingFlash: (flash: number) => { castingFlash = flash; },
      onClimaxBarrageTimer: (duration: number) => { climaxBarrageTimer = duration; },
    });
    this._battleEventBinder = battleEventBinder;

    // ─── BEAT MOTION / 키노트 / 프레이밍 시스템 (Issue #206) ───
    const beatRoundResolver = new BeatRoundResolver({
      battle,
      boss,
      guardian,
      onSpellCast: (spellDmg: number) => battleEventBinder.handleSpellCast(spellDmg),
      onBossDefeated: () => battleEventBinder.handleBossDefeated(),
      onPlayerDefeated: () => battleEventBinder.handlePlayerDefeated(),
    });

    // ─── UI 표시 스냅샷 및 콘텐츠 동기화 관리자 [REFACTOR-SRP-012] (Issue #643) ───
    const uiPresentationSyncHost: AppUIPresentationSyncHost = {
      ...subsystems,
      sessionLifecycle,
      getSessionContext: () => sessionContext,
      get beatCoordinator() { return beatCoordinator; },
      get stateMachine() { return stateMachine; },
      getStaticManifestUrl: () => this._options.staticManifestUrl,
      getStaticManifestOptions: () => this._options.staticManifestOptions,
    };
    const uiPresentationSyncManager = new AppUIPresentationSyncManager(uiPresentationSyncHost);
    this._uiPresentationSyncManager = uiPresentationSyncManager;

    // Issue #411 & #390: Phase A 7노트 단일 공급원 (커스텀 팩 또는 기본 입문 루틴)
    let sessionContext: GameSessionContext;
    let rhythmStarCombo = 0;
    let feedbackTimer = 0;
    let feedbackCorrect = false;
    let feedbackCustomText: string | null = null;
    let feedbackCustomColor: string | null = null;
    let answerLocked = false;
    let bossFeverController: BossFeverController;
    let bossHazardController: BossHazardController;

    // ─── 인게임 라운드 이벤트 바인더 및 모션 라우터 조립 (REFACTOR-SRP-011 / Issue #642) ───
    const roundEventHost: AppRoundEventHost = {
      ...subsystems,
      getScreenMode: () => screenMode,
      isPaused: () => pauseModal.isOpen,
      setFeedbackCustomText: (t) => { feedbackCustomText = t; },
      setFeedbackCustomColor: (c) => { feedbackCustomColor = c; },
      setFeedbackCorrect: (c) => { feedbackCorrect = c; },
      setFeedbackTimer: (t) => { feedbackTimer = t; },
      setAnswerLocked: (l) => { answerLocked = l; },
      setRhythmStarCombo: (c) => { rhythmStarCombo = c; },
      getRhythmStarCombo: () => rhythmStarCombo,
      getFeedbackTimer: () => feedbackTimer,
      getFeedbackCustomColor: () => feedbackCustomColor,
      getFeedbackCorrect: () => feedbackCorrect,
      getFeedbackCustomText: () => feedbackCustomText,
      get stateMachine() { return stateMachine; },
      get stateMachineBuilder() { return stateMachineBuilder; },
      get battleEventBinder() { return battleEventBinder; },
      get beatRoundResolver() { return beatRoundResolver; },
      handleAnswer: (idx, status, res) => handleAnswer(idx, status, res),
      showResult: (isVictory) => showResult(isVictory),
      get beatCoordinator() { return beatCoordinator; },
      get phaseAHazardController() { return phaseAHazardController; },
      get bossHazardController() { return bossHazardController; },
      get bossFeverController() { return bossFeverController; },
      get engine() { return engine; },
      getSessionContext: () => sessionContext,
      get sessionContext() { return sessionContext; },
      startRunningPhase: () => startRunningPhase(),
      startAssaultPhase: () => startAssaultPhase(),
      isAssaultMode: () => self.isAssaultMode(),
    };
    const roundEventBinder = new AppRoundEventBinder(roundEventHost);
    this._roundEventBinder = roundEventBinder;

    const getPhaseAStarNotes = (): readonly Keynote[] => roundEventBinder.getPhaseAStarNotes();
    const getPhaseAHazardPattern = (roundIndex?: number): PhaseAHazardPattern =>
      roundEventBinder.getPhaseAHazardPattern(roundIndex);
    const readyPositionController = roundEventBinder.createReadyPositionController();
    const phaseAHazardController = roundEventBinder.createPhaseAHazardController();
    let climaxBarrageTimer = 0;

    // ─── 게임 상태 머신 ───
    const stateMachine = new StateMachine('MENU_MAIN');
    let screenMode: ScreenMode = 'menu';
    let menuMode: MenuMode = 'main';
    let selectedChapter = 1;
    let selectedSubLevel: number | undefined = undefined;
    let gamePhase: GamePhase = 'running';
    let totalSteps = 0;
    let totalJumps = 0;
    let totalDwellTime = 0;
    let currentChapter = 1;
    let currentQuestion: GeneratedQuestion | null = null;
    let questionVisible = false;
    let resultData: ExtendedResultData | null = null;
    let unlockedChapter = 5;
    let starsMap: Record<number, number> = self.persistence.loadProgress();
    let castingFlash = 0;
    let consecutiveWrongCount = 0;

    // ─── StateMachine 상태 핸들러 및 전환 리스너 조립 (REFACTOR-CORE-002 / Issue #617) ───
    const stateMachineHost: BootstrapStateMachineHost = {
      ...subsystems,
      stateMachine,
      setScreenMode: (m) => { screenMode = m; },
      setMenuMode: (m) => { menuMode = m; },
      setGamePhase: (p) => { gamePhase = p; },
      setQuestionVisible: (v) => { questionVisible = v; },
      setAnswerLocked: (l) => { answerLocked = l; },
      setFeedbackTimer: (t) => { feedbackTimer = t; },
      setRhythmStarCombo: (c) => { rhythmStarCombo = c; },
      get playedNoteAudioIds() { return roundEventBinder.playedNoteAudioIds; },
      get phaseAHazardController() { return phaseAHazardController; },
      get bossFeverController() { return bossFeverController; },
      get bossHazardController() { return bossHazardController; },
      get stageProgressController() { return stageProgressController; },
      get beatRoundResolver() { return beatRoundResolver; },
      get beatCoordinator() { return beatCoordinator; },
      get engine() { return engine; },
      get sessionContext() { return sessionContext; },
      get assaultWireHelper() { return self._assaultWireHelper; },
      getPhaseAStarNotes: () => getPhaseAStarNotes(),
      getPhaseAHazardPattern: (idx) => getPhaseAHazardPattern(idx),
      flushPendingUIPresentation: () => uiPresentationSyncManager.flushPendingUIPresentation(),
      getResultData: () => resultData,
      calcStars: (c, t, e) => calcStars(c, t, e),
    };

    const stateMachineBuilder = new BootstrapStateMachineBuilder(stateMachineHost);
    stateMachineBuilder.registerAll();
    self._stateMachineBuilder = stateMachineBuilder;

    function enterQuestionPhase(): void {
      stateMachineBuilder.enterQuestionPhase();
    }

    const beatCoordinator = roundEventBinder.createBeatCoordinator({
      questionBank,
      battle,
      armReachAnswerSelector: subsystems.armReachAnswerSelector,
      answerRestBeats: this._options.answerRestBeats ?? (this._options.canvas ? 0 : 2),
      sfx: subsystems.sfx,
    });
    roundEventBinder.bindFootKeynote(subsystems.footKeynoteInput);
    this.beatCoordinator = beatCoordinator;

    function updateLocomotionLabel(): void {
      const currentLoco = LOCOMOTION_MODES.find((m) => m.mode === locomotionModal.selectedMode);
      if (currentLoco) {
        settingsModal.locomotionModeLabel = currentLoco.label;
      }
    }
    updateLocomotionLabel();

    let menuHoverItem: { type: 'chapter' | 'sublevel'; id: number } | null = null;
    let menuHoverTimer = 0;
    let resultReturnTimer = 0;
    let lastFrameDt = 0.016;

    async function ensureCameraStarted(): Promise<void> {
      if (!cameraLayer.isActive && cameraLayer.status !== 'requesting') {
        const started = await cameraLayer.start();
        if (started && poseManager.status === 'idle') {
          await poseManager.init();
        }
      }
    }

    bossFeverController = roundEventBinder.createBossFeverController(boss, { secondsPerBeat: defaultSecondsPerBeat });
    bossHazardController = roundEventBinder.createBossHazardController(boss, bossFeverController);
    const stageProgressController = roundEventBinder.createStageProgressController();

    const stateRef: any = {
      get screenMode() { return screenMode; }, set screenMode(v) { screenMode = v; },
      get menuMode() { return menuMode; }, set menuMode(v) { menuMode = v; },
      get gamePhase() { return gamePhase; }, set gamePhase(v) { gamePhase = v; },
      get currentChapter() { return currentChapter; }, set currentChapter(v) { currentChapter = v; },
      get selectedChapter() { return selectedChapter; }, set selectedChapter(v) { selectedChapter = v; },
      get selectedSubLevel() { return selectedSubLevel; }, set selectedSubLevel(v) { selectedSubLevel = v; },
      get unlockedChapter() { return unlockedChapter; },
      get starsMap() { return starsMap; },
      get currentQuestion() { return currentQuestion; }, set currentQuestion(v) { currentQuestion = v; },
      get resultData() { return resultData; }, set resultData(v) { resultData = v; },
      get totalSteps() { return totalSteps; }, set totalSteps(v) { totalSteps = v; },
      get totalJumps() { return totalJumps; }, set totalJumps(v) { totalJumps = v; },
      get totalDwellTime() { return totalDwellTime; }, set totalDwellTime(v) { totalDwellTime = v; },
      get questionVisible() { return questionVisible; }, set questionVisible(v) { questionVisible = v; },
      get answerLocked() { return answerLocked; }, set answerLocked(v) { answerLocked = v; },
      get feedbackTimer() { return feedbackTimer; }, set feedbackTimer(v) { feedbackTimer = v; },
      get feedbackCorrect() { return feedbackCorrect; }, set feedbackCorrect(v) { feedbackCorrect = v; },
      get menuHoverItem() { return menuHoverItem; }, set menuHoverItem(v) { menuHoverItem = v; },
      get menuHoverTimer() { return menuHoverTimer; }, set menuHoverTimer(v) { menuHoverTimer = v; },
      get resultReturnTimer() { return resultReturnTimer; }, set resultReturnTimer(v) { resultReturnTimer = v; },
      get lastFrameDt() { return lastFrameDt; }, set lastFrameDt(v) { lastFrameDt = v; },
      get consecutiveWrongCount() { return consecutiveWrongCount; }, set consecutiveWrongCount(v) { consecutiveWrongCount = v; },
      get rhythmStarCombo() { return rhythmStarCombo; }, set rhythmStarCombo(v) { rhythmStarCombo = v; },
      get climaxBarrageTimer() { return climaxBarrageTimer; }, set climaxBarrageTimer(v) { climaxBarrageTimer = v; },
    };

    // ─── 세션 진행 및 라운드 전환 조정자 (REFACTOR-SRP-010 / Issue #641) ───
    const flowCoordinator = new AppSessionFlowCoordinator({
      ...subsystems,
      dialogueManager,
      stateMachine,
      sessionLifecycle,
      get sessionContext() { return sessionContext; },
      getSessionContext: () => sessionContext,
      ensureCameraStarted,
      beatCoordinator,
      beatRoundResolver,
      starNoteScheduler,
      starCollectionInput: subsystems.starCollectionInput,
      stageProgressController,
      get bossFeverController() { return bossFeverController; },
      get bossHazardController() { return bossHazardController; },
      phaseAHazardController,
      readyPositionController,
      get assaultWireHelper() { return self._assaultWireHelper; },
      get engine() { return engine; },
      battleEventBinder,
      contentLoadService,
      questionBank,
      persistence: self.persistence,
      state: stateRef,
      getActivePublishedPack: () => uiPresentationSyncManager.activePublishedPack,
      flushPendingUIPresentation: () => uiPresentationSyncManager.flushPendingUIPresentation(),
      clearPlayedNoteAudioIds: () => roundEventBinder.playedNoteAudioIds.clear(),
      resetLocomotionDetectors: () => {
        Object.values(locomotionDetectors).forEach((d) => d.reset());
        jumpDetector.reset();
      },
      persistSessionProgress: (ch, stars) => {
        starsMap = self.persistence.saveProgress(ch, stars, {
          isTestSession: Boolean(sessionLifecycle.isTestSession || sessionContext?.isTestSession),
        });
      },
      persistSessionRewards: (ch, stars) => {
        self.persistence.saveReward(ch, stars, {
          isTestSession: Boolean(sessionLifecycle.isTestSession || sessionContext?.isTestSession),
        });
      },
      persistSessionHighScore: (result) => {
        self.persistence.saveHighScore(result, {
          isTestSession: Boolean(sessionLifecycle.isTestSession || sessionContext?.isTestSession),
        });
      },
    });
    this._sessionFlowCoordinator = flowCoordinator;

    const startChapter = (
      ch: number,
      subLevel?: number,
      options?: { pack?: PublishedContentPack | null; isTestSession?: boolean; contentHash?: string },
    ) => flowCoordinator.startChapter(ch, subLevel, options);
    const startRunningPhase = () => flowCoordinator.startRunningPhase();
    const startAssaultPhase = () => flowCoordinator.startAssaultPhase();
    const startReadyPhase = () => flowCoordinator.startReadyPhase();
    const selectChapter = (ch: number) => flowCoordinator.selectChapter(ch);
    const selectSubLevel = (sub: number | null) => flowCoordinator.selectSubLevel(sub);
    const handleAnswer = (idx: number, status: RoundAnswerStatus, resolveResult: RoundResolveResult) =>
      flowCoordinator.handleAnswer(idx, status, resolveResult);
    const showResult = (victory: boolean) => flowCoordinator.showResult(victory);
    const goToMenu = () => flowCoordinator.goToMenu();
    const abortSession = () => flowCoordinator.abortSession();

    // ─── 피드백 렌더링 ───
    const renderFeedback = (ctx: CanvasRenderingContext2D, w: number, h: number) =>
      roundEventBinder.renderFeedback(ctx, w, h, castingFlash);

    // ─── HUD 데이터 헬퍼 ───
    function getHUDData() {
      return {
        playerHp: battle.hp,
        playerMaxHp: battle.maxHp,
        bossHp: boss.hp,
        bossMaxHp: boss.maxHp,
        combo: battle.combo,
        chapter: currentChapter,
        guardianStage: guardian.stage,
      };
    }

    sessionContext = new GameSessionContext({
      mode: this.isAssaultMode() ? 'boss_assault' : 'legacy',
      systems: {
        eventBus,
        sessionLifecycle,
        canvasManager,
        effectManager,
        contentLoadService,
        contentProvider: subsystems.contentProvider,
      },
      controllers: {
        battle,
        boss,
        guardian,
        beatRoundResolver,
        bossFever: bossFeverController,
        bossHazard: bossHazardController,
      },
    });

    const sceneDirector = new SceneDirector<MainSceneContext>({
      sessionContext,
      initialScene: screenMode,
    });

    let engine: GameEngine;
    const mainSceneContext: MainSceneContext = {
      ...subsystems,
      stateMachine,
      beatCoordinator,
      getPhaseAStarNotes,
      getPhaseAHazardPattern,
      sessionContext,
      bossFeverController,
      bossHazardController,
      phaseAHazardController,
      readyPositionController,
      beatRoundResolver,
      imageLoader,
      canvas,
      get engine() { return engine; },
      cursorTracker: subsystems.answerSelector.cursorTracker,
      getHUDData,
      renderFeedback,
      toNormalizedLandmarks,
      actions: {
        goToMenu,
        updateLocomotionLabel,
        selectSubLevel,
        selectChapter,
        startChapter: (ch: number, sub?: number) => startChapter(ch, sub),
        startGame: (ch: number, sub?: number) => startChapter(ch, sub),
        showTutorial: () => tutorial.show(),
        showResult,
      },
      state: stateRef,
      get assaultSession() { return self.assaultSession; },
    };

    sceneDirector.setupMainPipelines(mainSceneContext);

    // ─── 게임 엔진 ───
    engine = new GameEngine({
      update(dt: number): void {
        lastFrameDt = dt;
        sceneDirector.setScene(screenMode);
        sceneDirector.update(dt, mainSceneContext);
      },

      render(): void {
        sceneDirector.render(mainSceneContext);
      },
    });

    this.stateMachine = stateMachine;
    this.beatRoundResolver = beatRoundResolver;
    this.phaseAHazardController = phaseAHazardController;
    this.stageProgressController = stageProgressController;
    this.bossFeverController = bossFeverController;
    this.bossHazardController = bossHazardController;
    this.readyPositionController = readyPositionController;
    this.sessionContext = sessionContext;
    this.sceneDirector = sceneDirector;
    this.mainSceneContext = mainSceneContext;
    this.getPhaseAStarNotes = getPhaseAStarNotes;
    this.getPhaseAHazardPattern = getPhaseAHazardPattern;
    this.engine = engine;

    // UI Presentation delegation
    this.getActiveUIPresentation = () => uiPresentationSyncManager.getActiveUIPresentation();
    this.getActiveUIArtifact = () => uiPresentationSyncManager.getActiveUIArtifact();
    this.getActiveUIHash = () => uiPresentationSyncManager.getActiveUIHash();
    this.getPendingUIArtifact = () => uiPresentationSyncManager.getPendingUIArtifact();
    this.setUIPresentationArtifact = (artifact, opt) => uiPresentationSyncManager.setUIPresentationArtifact(artifact, opt);
    this.applyUIPresentation = (presentation, artifact) => uiPresentationSyncManager.applyUIPresentation(presentation, artifact);
    this.rollbackUIPresentation = () => uiPresentationSyncManager.rollbackUIPresentation();
    this.flushPendingUIPresentation = () => uiPresentationSyncManager.flushPendingUIPresentation();
    this.setCustomContentPack = (pack: PublishedContentPack | null) => {
      uiPresentationSyncManager.activePublishedPack = pack;
    };

    // Actions assignment
    this.selectChapter = selectChapter;
    this.selectSubLevel = selectSubLevel;
    this.startChapter = startChapter;
    this.startTestPlaySession = (ch, opt) => flowCoordinator.startTestPlaySession(ch, opt);
    this.abortSession = abortSession;
    this.abortTestSession = abortSession;
    this.startReadyPhase = startReadyPhase;
    this.startRunningPhase = startRunningPhase;
    this.startAssaultPhase = startAssaultPhase;
    this.enterQuestionPhase = enterQuestionPhase;
    this.handleAnswer = handleAnswer;
    this.showResult = showResult;
    this.goToMenu = goToMenu;
    this.restartGame = () => {
      if (this.isAssaultMode()) {
        const restarted = self.restartAssaultSession();
        if (restarted) return;
      }
      flowCoordinator.restartGame();
    };
    this.answerCurrentQuestion = (idx) => flowCoordinator.answerCurrentQuestion(idx);
    this.ensureCameraStarted = ensureCameraStarted;
    this.loadQuestions = () => uiPresentationSyncManager.loadQuestions();
    this.loadFitnessPatterns = () => uiPresentationSyncManager.loadFitnessPatterns();
    this.applyDevPlayState = (params) => flowCoordinator.applyDevPlayState(params);
    this.loadStaticManifest = (url, opt) => uiPresentationSyncManager.loadStaticManifest(url, opt);
    this.loadLocalTestOverride = (id, opt) => uiPresentationSyncManager.loadLocalTestOverride(id, opt);

    // Browser event listeners [REFACTOR-SRP-001] (Issue #632)
    const listenerHost: AppEventListenerHost = {
      ...subsystems,
      canvas: this.canvas,
      ensureCameraStarted,
      updateLocomotionLabel,
      get screenMode() { return screenMode; },
      get menuMode() { return menuMode; },
      get gamePhase() { return gamePhase; },
      get selectedChapter() { return selectedChapter; },
      get currentQuestion() { return currentQuestion; },
      selectChapter,
      selectSubLevel,
      goToMenu,
      stateMachine,
      get answerLocked() { return answerLocked; },
      beatCoordinator,
      engine,
      bossHazardController,
      phaseAHazardController,
      assaultWireHelper: this._assaultWireHelper,
      readyPositionController,
      onRunningStep: () => {
        totalSteps++;
        currentQuestion = beatCoordinator.currentQuestion;
      },
      onJumpAction: () => {
        totalJumps++;
      },
      handleVisibilityChange: (hidden?: boolean) => {
        this.handleVisibilityChange(hidden);
      },
    };

    this._eventListenerManager = new AppEventListenerManager(listenerHost);
    this._onResize = this._eventListenerManager.onResize;
    this._onCanvasClick = this._eventListenerManager.onCanvasClick;
    this._onKeyDown = this._eventListenerManager.onKeyDown;
    this._onKeyUp = this._eventListenerManager.onKeyUp;
    this._onVisibilityChange = this._eventListenerManager.onVisibilityChange;

    this._assaultWireHelper.initAssaultMode();
  }

  public async init(): Promise<void> {
    if (this._isInitialized) return;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      await loadUiLayoutOverride(fetch.bind(window)).catch(() => undefined);
    }

    if (this._options.preloadAssets !== false) {
      await Promise.all([
        this.loadQuestions(),
        this.loadFitnessPatterns(),
        imageLoader.preload().catch((err) => console.warn('[DG] Image preload warning:', err)),
      ]);
    }

    if (this._options.loadStaticManifest) {
      await this.loadStaticManifest(
        this._options.staticManifestUrl,
        this._options.staticManifestOptions,
      ).catch((err) => {
        console.warn('[DG] Static manifest loading failed, falling back to builtin:', err);
      });
    }

    this._eventListenerManager.attachListeners(this.canvas);
    this._isInitialized = true;
  }

  public start(): void {
    if (this._isRunning || this._isDisposed) return;
    if (this._options.autoStartCamera !== false) {
      this.ensureCameraStarted().catch(() => {});
    }
    this.engine.start();
    this._isRunning = true;
  }

  public dispose(): void {
    if (this._isDisposed) return;
    this.engine.stop();

    this._assaultWireHelper.dispose();
    this._eventListenerManager.detachListeners();
    this._battleEventBinder?.dispose();
    this._roundEventBinder?.dispose();

    this.cameraLayer.stop();
    this._isRunning = false;
    this._isDisposed = true;
  }
}
