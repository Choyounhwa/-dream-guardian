/**
 * AppBootstrap - Dream Guardian 메인 앱 부트스트랩 및 이벤트 리스너 관리자
 *
 * [REFACTOR-MAIN-002] (Issue #302)
 * - DOM 캔버스 초기화, 반응형 리사이즈, 웹캠/오디오 권한 요청 플로우 캡슐화
 * - 키보드(1, 2, Space, Escape 등) 및 터치/클릭 fallback 이벤트 리스너 등록 및 해제
 * - 코어 시스템 인스턴스화 및 씬 디렉터 통합 생명주기 관리
 */

import { DEFAULT_CONFIG } from './Config.js';
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
import { BootstrapSubsystemFactory } from './bootstrap/BootstrapSubsystemFactory.js';
import {
  AppEventListenerManager,
  type AppEventListenerHost,
} from './bootstrap/AppEventListenerManager.js';
import {
  AppBattleEventBinder,
  bindBattleEvents,
} from './bootstrap/AppBattleEventBinder.js';
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
import type { AssaultFinaleController } from '../game/assault/AssaultFinaleController.js';
import type { AssaultHandoverSnapshot } from '../game/assault/AssaultProgressController.js';
import type { SessionId } from '../types/assault.js';
import { GameEngine } from './GameEngine.js';
import { StateMachine } from './StateMachine.js';
import { SessionLifecycle } from './SessionLifecycle.js';
import { GameSessionContext, SceneDirector, type MainSceneContext } from './index.js';
import { CanvasManager } from '../render/CanvasManager.js';
import { CameraLayer } from '../render/CameraLayer.js';
import { PoseManager } from '../motion/PoseManager.js';
import { BoneRenderer } from '../skeleton/BoneRenderer.js';
import { JointRenderer } from '../skeleton/JointRenderer.js';
import { SkeletonAnimation } from '../skeleton/SkeletonAnimation.js';
import { SkeletonEffect } from '../skeleton/SkeletonEffect.js';
import type { IAvatarRenderer } from '../skeleton/IAvatarRenderer.js';
import { QuestionBank } from '../question/QuestionBank.js';
import { parseCSV } from '../question/CSVLoader.js';
import { parseFitnessPatternCSV, createKeynoteSequence } from '../data/index.js';
import { BEGINNER_PHASE_A_STAR_NOTES } from '../data/beginnerRhythmRoutine.js';
import {
  ContentLoadService,
  type StaticManifestLoadOptions,
  type ContentLoadOptions,
} from './ContentLoadService.js';
import {
  UIPresentationLoadService,
  type UIPresentationArtifact,
  type UIPresentationLoadOptions,
  type UIPresentationLoadResult,
} from './UIPresentationLoadService.js';
import type { UIPresentationDocument } from '../data/UIPresentation.js';
import { computeContentHash } from '../data/ContentCanonical.js';
import { loadUiLayoutOverride } from './UILayoutOverride.js';
import { ContentProvider } from '../game/ContentProvider.js';
import { type PublishedContentPack } from '../data/PublishedContentPack.js';
import type { Keynote } from '../types/keynote.js';
import type { GeneratedQuestion } from '../question/QuestionEvaluator.js';
import { QuestionSpeech } from '../question/QuestionSpeech.js';
import { EventBus } from './EventBus.js';
import { BattleState } from '../game/BattleState.js';
import { BossController } from '../game/BossController.js';
import {
  GuardianSystem,
  BeatRunCoordinator,
  BeatRoundResolver,
  PhaseAHazardController,
  type PhaseAHazardPattern,
  StarNoteScheduler,
  StageProgressController,
  BossFeverController,
  BossHazardController,
  ReadyPositionController,
} from '../game/index.js';
import { PHASE_A_ACTIVE_HAZARD_PATTERNS } from '../game/PhaseAHazardController.js';
import { HUDLayer } from '../ui/HUDLayer.js';
import { MenuRenderer } from '../ui/MenuRenderer.js';
import { ResultRenderer, calcStars } from '../ui/ResultRenderer.js';
import { PhasePresentationAdapter } from '../ui/PhasePresentationAdapter.js';
import {
  BossRenderer,
  DreamGrid,
  AnswerSelectionRenderer,
  KneeFramingGuideRenderer,
  BeatHUDRenderer,
  QuestionRenderer,
  StarNoteRenderer,
  BossClimaxRenderer,
  DialogueOverlayRenderer,
  ReadyPositionRenderer,
} from '../render/index.js';
import { RunningMatRenderer } from '../render/RunningMatRenderer.js';
import { dialogueManager } from '../story/index.js';
import { EffectManager, TransitionManager } from '../effects/index.js';
import {
  RunDetector,
  JumpDetector,
  CalibrationHelper,
  XGestureDetector,
  KneeFramingValidator,
  FootKeynoteDetector,
  MotionIntentBus,
  type ILocomotionDetector,
  type LocomotionMode,
} from '../motion/index.js';
import {
  AnswerSelector,
  ArmReachAnswerSelector,
  FootKeynoteInput,
  StarCollectionInput,
} from '../input/index.js';
import { toNormalizedLandmarks, imageLoader } from '../utils/index.js';
import { MenuInput } from '../input/MenuInput.js';
import { SFXSynth, BandSynthesizer, type BandTimingQuality, BGMManager } from '../audio/index.js';
import { StageBGMSynthesizer } from '../audio/StageBGMSynthesizer.js';
import {
  BottomBar,
  SettingsModal,
  LocomotionModal,
  PauseModal,
  TutorialOverlay,
  GestureFeedbackOverlay,
  LOCOMOTION_MODES,
} from '../ui/index.js';
import { getAnswerButtonLayouts, DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import { DEFAULT_PHASE_A_HAZARD_CONFIG } from '../../config/phase-a-hazard.config.js';
import { HORIZON_RATIO } from '../../config/grid.config.js';
import { RUNNING_MAT_CONFIG } from '../../config/running-mat.config.js';
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

// Issue #391 / Issue #634: 영속성 관리자 및 저장 키 재내보내기
export {
  AppPersistenceManager,
  STORAGE_KEY_STAGE_PROGRESS,
  STORAGE_KEY_HIGH_SCORES,
  STORAGE_KEY_REWARDS,
  STORAGE_KEY_TUTORIAL_DONE,
};
export {
  isVerifiedPublishedPack,
  type ExtendedResultData,
  type DevPlayStateParams,
} from './bootstrap/AppSessionFlowCoordinator.js';

let activePublishedPack: PublishedContentPack | null = null;

export class AppBootstrap {
  public readonly persistence: AppPersistenceManager;
  public readonly canvas: HTMLCanvasElement;
  public readonly canvasManager: CanvasManager;
  public readonly cameraLayer: CameraLayer;
  public readonly poseManager: PoseManager;
  public readonly boneRenderer: BoneRenderer;
  public readonly jointRenderer: JointRenderer;
  public readonly skeletonAnimation: SkeletonAnimation;
  public readonly skeletonEffect: SkeletonEffect;
  public readonly stickmanRenderer: IAvatarRenderer;
  public readonly questionBank: QuestionBank;
  public readonly speech: QuestionSpeech;
  public readonly eventBus: EventBus;
  public readonly battle: BattleState;
  public readonly boss: BossController;
  public readonly guardian: GuardianSystem;
  public readonly hudLayer: HUDLayer;
  public readonly menuRenderer: MenuRenderer;
  public readonly resultRenderer: ResultRenderer;
  public readonly bossRenderer: BossRenderer;
  public readonly dreamGrid: DreamGrid;
  public readonly runningMatRenderer: RunningMatRenderer;
  public readonly effectManager: EffectManager;
  public readonly runDetector: RunDetector;
  public readonly jumpDetector: JumpDetector;
  public readonly calibrationHelper: CalibrationHelper;
  public readonly locomotionDetectors: Record<LocomotionMode, ILocomotionDetector>;
  public readonly answerSelector: AnswerSelector;
  public readonly motionIntentBus: MotionIntentBus;
  public readonly armReachAnswerSelector: ArmReachAnswerSelector;
  public readonly answerSelectionRenderer: AnswerSelectionRenderer;
  public readonly menuInput: MenuInput;
  public readonly sfx: SFXSynth;
  public readonly bandSynth: BandSynthesizer;
  public readonly stageBgm: StageBGMSynthesizer;
  public readonly bgmManager: BGMManager;
  public readonly tutorial: TutorialOverlay;
  public readonly bottomBar: BottomBar;
  public readonly settingsModal: SettingsModal;
  public readonly locomotionModal: LocomotionModal;
  public readonly pauseModal: PauseModal;
  public readonly xGestureDetector: XGestureDetector;
  public readonly questionRenderer: QuestionRenderer;
  public readonly beatHUDRenderer: BeatHUDRenderer;
  public readonly presentationAdapter: PhasePresentationAdapter;
  public readonly starNoteRenderer: StarNoteRenderer;
  public readonly bossClimaxRenderer: BossClimaxRenderer;
  public readonly dialogueOverlayRenderer: DialogueOverlayRenderer;
  public readonly gestureFeedbackOverlay: GestureFeedbackOverlay;
  public readonly transitionManager: TransitionManager;
  public readonly sessionLifecycle: SessionLifecycle;
  public readonly stateMachine: StateMachine;
  public readonly beatRoundResolver: BeatRoundResolver;
  public readonly kneeFramingValidator: KneeFramingValidator;
  public readonly kneeFramingGuideRenderer: KneeFramingGuideRenderer;
  public readonly footKeynoteDetector: FootKeynoteDetector;
  public readonly footKeynoteInput: FootKeynoteInput;
  public readonly beatCoordinator: BeatRunCoordinator;
  public readonly phaseAHazardController: PhaseAHazardController;
  public readonly starNoteScheduler: StarNoteScheduler;
  public readonly starCollectionInput: StarCollectionInput;
  public readonly stageProgressController: StageProgressController;
  public readonly bossFeverController: BossFeverController;
  public readonly bossHazardController: BossHazardController;
  public readonly readyPositionRenderer: ReadyPositionRenderer;
  public readonly readyPositionController: ReadyPositionController;
  public readonly sessionContext: GameSessionContext;
  public readonly sceneDirector: SceneDirector;
  public readonly mainSceneContext: MainSceneContext;
  public readonly getPhaseAStarNotes: () => readonly Keynote[];
  public readonly getPhaseAHazardPattern: (roundIndex?: number) => PhaseAHazardPattern;
  public readonly engine: GameEngine;
  public readonly contentLoadService: ContentLoadService;
  public readonly contentProvider: ContentProvider;
  public readonly uiPresentationLoadService: UIPresentationLoadService;
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
    return activePublishedPack;
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
    options: { pack: PublishedContentPack; contentHash?: string; subLevel?: number },
  ) => boolean;
  public readonly abortSession: () => void;
  public readonly abortTestSession: () => void;
  public readonly startReadyPhase: () => void;
  public readonly startRunningPhase: () => void;
  public readonly startAssaultPhase: () => void;
  public readonly enterQuestionPhase: () => void;
  public readonly handleAnswer: (idx: number, status: RoundAnswerStatus, res: RoundResolveResult) => void;
  public readonly showResult: (victory: boolean) => void;
  public readonly goToMenu: () => void;
  public readonly restartGame: () => void;
  public readonly answerCurrentQuestion: (idx: number) => void;
  public readonly ensureCameraStarted: () => Promise<void>;
  public readonly loadQuestions: () => Promise<void>;
  public readonly loadFitnessPatterns: () => Promise<void>;
  public readonly loadStaticManifest: (
    manifestUrl?: string,
    options?: StaticManifestLoadOptions,
  ) => Promise<boolean>;
  public readonly loadLocalTestOverride: (
    identifier: string,
    options?: ContentLoadOptions,
  ) => Promise<boolean>;
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
  get sessionFlowCoordinator(): AppSessionFlowCoordinator { return this._sessionFlowCoordinator; }

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
    const {
      canvasManager,
      cameraLayer,
      poseManager,
      boneRenderer,
      jointRenderer,
      skeletonAnimation,
      skeletonEffect,
      stickmanRenderer,
      questionBank,
      speech,
      eventBus,
      battle,
      boss,
      guardian,
      hudLayer,
      menuRenderer,
      resultRenderer,
      bossRenderer,
      dreamGrid,
      runningMatRenderer,
      effectManager,
      runDetector,
      jumpDetector,
      calibrationHelper,
      locomotionDetectors,
      getActiveLocomotionDetector,
      answerSelector,
      motionIntentBus,
      armReachAnswerSelector,
      answerSelectionRenderer,
      menuInput,
      sfx,
      bandSynth,
      stageBgm,
      bgmManager,
      tutorial,
      bottomBar,
      settingsModal,
      locomotionModal,
      pauseModal,
      xGestureDetector,
      questionRenderer,
      beatHUDRenderer,
      presentationAdapter,
      starNoteRenderer,
      bossClimaxRenderer,
      dialogueOverlayRenderer,
      gestureFeedbackOverlay,
      transitionManager,
      sessionLifecycle,
      kneeFramingValidator,
      kneeFramingGuideRenderer,
      footKeynoteDetector,
      footKeynoteInput,
      starCollectionInput,
      starNoteScheduler,
      contentLoadService,
      contentProvider,
      uiPresentationLoadService,
      readyPositionRenderer,
    } = subsystems;
    const defaultSecondsPerBeat = starNoteScheduler.timeline.spb;

    const battleEventBinder = bindBattleEvents({
      eventBus,
      canvasManager,
      effectManager,
      bossRenderer,
      skeletonEffect,
      sfx,
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

// [UI-VIS-041 / Issue #471]: UI 표시 스냅샷 런타임 주입·입력 일치·안전 롤백 관리
let activeUIPresentation: Readonly<UIPresentationDocument> | null = null;
let activeUIArtifact: Readonly<UIPresentationArtifact> | null = null;
let pendingUIArtifact: Readonly<UIPresentationArtifact> | null = null;
let pendingUIPresentation: Readonly<UIPresentationDocument> | null = null;
let previousHealthyPresentation: Readonly<UIPresentationDocument> | null = null;
let previousHealthyArtifact: Readonly<UIPresentationArtifact> | null = null;

function applyUIPresentation(
  presentation: UIPresentationDocument | null,
  artifact?: UIPresentationArtifact | null,
): void {
  if (activeUIPresentation && presentation && activeUIPresentation !== presentation) {
    previousHealthyPresentation = activeUIPresentation;
    previousHealthyArtifact = activeUIArtifact;
  }
  activeUIPresentation = presentation;
  activeUIArtifact = artifact ?? null;

  if (!presentation) {
    menuRenderer.clearPresentationContext();
    hudLayer.clearPresentationContext();
    bottomBar.clearPresentationContext();
    pauseModal.clearPresentationContext();
    settingsModal.clearPresentationContext();
    resultRenderer.clearPresentationContext();
    readyPositionRenderer.clearPresentationContext();
    runningMatRenderer?.clearPresentationContext();
    questionRenderer.clearPresentationContext();
    presentationAdapter.clearPresentationContext();
    beatHUDRenderer.clearPresentationContext();
    bossRenderer.clearPresentationContext();
    bossClimaxRenderer.clearPresentationContext();
    return;
  }

  menuRenderer.setPresentationContext({ presentationDocument: presentation });
  hudLayer.setPresentationContext({ presentationDocument: presentation });
  bottomBar.setPresentationContext({ presentationDocument: presentation });
  pauseModal.setPresentationContext({ presentationDocument: presentation, pageId: 'pause' });
  settingsModal.setPresentationContext({ presentationDocument: presentation, pageId: 'options' });
  resultRenderer.setPresentationContext({ presentationDocument: presentation, pageId: 'result' });
  readyPositionRenderer.setPresentationContext({ presentationDocument: presentation, pageId: 'play_ready' });
  runningMatRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'running_question' });
  questionRenderer.setPresentationContext({ presentationDocument: presentation, pageId: 'running_question' });
  presentationAdapter.setPresentationContext({ presentationDocument: presentation, pageId: 'hazard_evade' });
  beatHUDRenderer.setPresentationContext({ presentationDocument: presentation, pageId: 'running_question' });
  bossRenderer.setPresentationContext({ presentationDocument: presentation, pageId: 'boss_battle' });
  bossClimaxRenderer.setPresentationContext({ presentationDocument: presentation, pageId: 'boss_battle' });
}

function flushPendingUIPresentation(): boolean {
  if (!pendingUIPresentation && !pendingUIArtifact) return false;
  if (pendingUIPresentation) {
    applyUIPresentation(pendingUIPresentation, pendingUIArtifact);
    pendingUIPresentation = null;
    pendingUIArtifact = null;
    return true;
  }
  return false;
}

function rollbackUIPresentation(): boolean {
  const targetDoc = previousHealthyPresentation ?? uiPresentationLoadService.previousHealthyPresentation;
  const targetArtifact = previousHealthyArtifact;
  if (targetDoc) {
    applyUIPresentation(targetDoc, targetArtifact);
    pendingUIPresentation = null;
    pendingUIArtifact = null;
    return true;
  }
  if (activeUIPresentation !== null) {
    applyUIPresentation(null, null);
    pendingUIPresentation = null;
    pendingUIArtifact = null;
    return true;
  }
  return false;
}

async function setUIPresentationArtifact(
  artifact: UIPresentationArtifact | null,
  options?: UIPresentationLoadOptions,
): Promise<UIPresentationLoadResult> {
  if (artifact === null) {
    applyUIPresentation(null, null);
    pendingUIArtifact = null;
    pendingUIPresentation = null;
    return {
      status: 'success',
      presentation: null as any,
      generation: uiPresentationLoadService.currentGeneration,
    };
  }

  const effectiveOptions: UIPresentationLoadOptions = {
    previousHealthyPresentation: (activeUIPresentation ?? undefined) as any,
    ...options,
  };

  const loadResult = await uiPresentationLoadService.loadPresentation(artifact, effectiveOptions);
  if (loadResult.status === 'success') {
    const isPlaying =
      stateMachine.currentState !== 'MENU_MAIN' &&
      stateMachine.currentState !== 'MENU_SUB' &&
      stateMachine.currentState !== 'LOADING' &&
      stateMachine.currentState !== 'RESULT' &&
      stateMachine.currentState !== 'GAMEOVER';

    if (isPlaying) {
      pendingUIArtifact = loadResult.artifact ?? artifact;
      pendingUIPresentation = loadResult.presentation;
      return loadResult;
    }

    applyUIPresentation(loadResult.presentation, loadResult.artifact);
    pendingUIArtifact = null;
    pendingUIPresentation = null;
    return loadResult;
  }

  if (loadResult.status === 'fallback') {
    if (activeUIPresentation) {
      applyUIPresentation(activeUIPresentation, activeUIArtifact);
    } else {
      applyUIPresentation(loadResult.fallbackPresentation, null);
    }
    pendingUIArtifact = null;
    pendingUIPresentation = null;
    return loadResult;
  }

  return loadResult;
}

function getActiveUIPresentation(): Readonly<UIPresentationDocument> | null {
  return activeUIPresentation;
}

function getActiveUIArtifact(): Readonly<UIPresentationArtifact> | null {
  return activeUIArtifact;
}

function getActiveUIHash(): string | null {
  if (activeUIArtifact?.contentHash) {
    return activeUIArtifact.contentHash;
  }
  if (activeUIPresentation) {
    return (
      (activeUIPresentation as any).contentHash ??
      computeContentHash({
        manifest: activeUIPresentation.manifest,
        pages: activeUIPresentation.pages,
        resolution: activeUIPresentation.resolution,
      })
    );
  }
  return null;
}

function getPendingUIArtifact(): Readonly<UIPresentationArtifact> | null {
  return pendingUIArtifact;
}

// Issue #411 & #390: Phase A 7노트 단일 공급원 (커스텀 팩 또는 기본 입문 루틴)
let sessionContext: GameSessionContext;
const getPhaseAStarNotes = (): readonly Keynote[] =>
  sessionContext ? sessionContext.starNotes : BEGINNER_PHASE_A_STAR_NOTES;

// Issue #397 (BOOT-HAZARD-A-CONTENT): Phase A 장판 패턴 단일 공급원 (커스텀 팩 또는 기본 풀)
const getPhaseAHazardPattern = (roundIndex?: number): PhaseAHazardPattern => {
  const bundle = sessionContext?.activeStageBundle ?? (sessionContext as any)?.stageBundle ?? null;
  if (bundle) {
    return bundle.getPhaseAHazardPattern(roundIndex);
  }
  const pool = PHASE_A_ACTIVE_HAZARD_PATTERNS;
  const idx = roundIndex !== undefined ? Math.abs(roundIndex - 1) % pool.length : 0;
  return pool[idx] ?? 'jump';
};

// Issue #213 & #193 & #194: Phase B 컨트롤러 인스턴스 참조 선언
let bossFeverController: BossFeverController;
let bossHazardController: BossHazardController;

// Issue #202 (FEAT-READY-001): 스테이지 첫 진입 신체 프레임 정렬 가이드 및 3초 카운트다운
const readyPositionController = new ReadyPositionController({
  countdownDuration: 3.0,
  startDisplayDuration: 0.4,
  sfx,
  onComplete: () => {
    if (self.isAssaultMode()) {
      console.log('[DG] READY_POSITION 완료 → 보스 접근전(ASSAULT_ROUND) 시작');
      startAssaultPhase();
    } else {
      console.log('[DG] READY_POSITION 완료 → 본 게임(RUN_QUESTION) 시작');
      startRunningPhase();
    }
  },
});

// Issue #194 & #195: 미니언 군단 매니저 의존성 주입 및 탄막 발사 연출 연결
let climaxBarrageTimer = 0;

beatRoundResolver.resourceManager.troopManager.setEventBus(eventBus);
beatRoundResolver.resourceManager.troopManager.setBossController(boss);


// Issue #191: 노트결과 ID 기준 중복 방지 (1회 재생 보장)
const playedNoteAudioIds = new Set<string>();
let rhythmStarCombo = 0;

starNoteScheduler.onRating((starResult) => {
  const noteId = starResult.target
    ? (starResult.target as any).id
    : `note_${starResult.timestamp}_${starResult.zoneId}`;
  if (noteId) {
    if (playedNoteAudioIds.has(noteId)) {
      return;
    }
    playedNoteAudioIds.add(noteId);
  }

  // Issue #213 & #240 & #194: Phase A(별가루 축적)와 Phase B(피버 타격 및 군단 게이지 충전) 연동
  if (
    stateMachine.currentState === 'BOSS_CLIMAX' ||
    (bossFeverController && bossFeverController.isActive)
  ) {
    bossFeverController.recordRating(starResult, noteId);
    beatRoundResolver.resourceManager.troopManager.recordStarRating(
      starResult.rating,
      starResult.zoneId,
    );
  } else {
    beatRoundResolver.recordStarRating(starResult.rating, noteId);
  }

  // Issue #284 (VFX-JUDGMENT-001): 리듬 판정 플로팅 텍스트(PERFECT/GOOD/LATE/MISS) 및 콤보 팝업 연동
  if (starResult.rating === 'Miss') {
    rhythmStarCombo = 0;
  } else {
    rhythmStarCombo++;
  }

  const currentFeverCombo = (bossFeverController && bossFeverController.isActive)
    ? bossFeverController.feverCombo
    : rhythmStarCombo;

  const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === starResult.zoneId);
  const jx = targetZone
    ? (targetZone.x + targetZone.width * 0.5) * canvasManager.virtualWidth
    : canvasManager.virtualWidth * 0.5;
  const jy = targetZone
    ? (targetZone.y + targetZone.height * 0.5) * canvasManager.virtualHeight
    : canvasManager.virtualHeight * 0.5;

  effectManager.playJudgmentText(jx, jy, starResult.rating, currentFeverCombo);

  if (starResult.collected) {
    const quality: BandTimingQuality = starResult.rating === 'Perfect' ? 'sync' : 'stumble';
    bandSynth.playZoneSound(starResult.zoneId, quality);
    sfx.play('correct');
    if (targetZone) {
      effectManager.playBurst({
        x: (targetZone.x + targetZone.width * 0.5) * canvasManager.virtualWidth,
        y: (targetZone.y + targetZone.height * 0.5) * canvasManager.virtualHeight,
        count: 8,
        colors: ['#FFCB4D', '#FFFFFF'],
        duration: 0.25,
      });
    }
  } else if (starResult.rating === 'Miss') {
    bandSynth.playZoneSound(starResult.zoneId, 'miss');
  }
});

// ─── 상태 머신 및 게임 상태 (Issue #214 / REFACTOR-FSM-001) ───
const stateMachine = new StateMachine('MENU_MAIN');
let screenMode: ScreenMode = 'menu';
let menuMode: MenuMode = 'main';
let selectedChapter = 1;
let selectedSubLevel: number | undefined = undefined;
let gamePhase: GamePhase = 'running';
let totalSteps = 0;
let totalJumps = 0;
let totalDwellTime = 0; // Issue #135: 누적 자세 유지 시간 (초)
let currentChapter = 1;
let currentQuestion: GeneratedQuestion | null = null;
let feedbackTimer = 0;
let feedbackCorrect = false;
let feedbackCustomText: string | null = null;
let feedbackCustomColor: string | null = null;
let questionVisible = false;
let answerLocked = false; // 답 연속 입력 방지
let resultData: ExtendedResultData | null = null;
let unlockedChapter = 5;
let starsMap: Record<number, number> = self.persistence.loadProgress();
let castingFlash = 0;
let consecutiveWrongCount = 0;

// ─── StateMachine 상태 핸들러 및 전환 리스너 조립 (REFACTOR-CORE-002 / Issue #617) ───
const stateMachineHost: BootstrapStateMachineHost = {
  stateMachine,
  motionIntentBus,
  setScreenMode: (m) => { screenMode = m; },
  setMenuMode: (m) => { menuMode = m; },
  setGamePhase: (p) => { gamePhase = p; },
  setQuestionVisible: (v) => { questionVisible = v; },
  setAnswerLocked: (l) => { answerLocked = l; },
  setFeedbackTimer: (t) => { feedbackTimer = t; },
  setRhythmStarCombo: (c) => { rhythmStarCombo = c; },

  get bgmManager() { return bgmManager; },
  get stageBgm() { return stageBgm; },
  get sfx() { return sfx; },
  get effectManager() { return effectManager; },
  get canvasManager() { return canvasManager; },
  get resultRenderer() { return resultRenderer; },
  get menuInput() { return menuInput; },
  get pauseModal() { return pauseModal; },
  get armReachAnswerSelector() { return armReachAnswerSelector; },
  get playedNoteAudioIds() { return playedNoteAudioIds; },
  get starNoteScheduler() { return starNoteScheduler; },
  get starCollectionInput() { return starCollectionInput; },
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
  flushPendingUIPresentation: () => flushPendingUIPresentation(),
  getResultData: () => resultData,
  calcStars: (c, t, e) => calcStars(c, t, e),
};

const stateMachineBuilder = new BootstrapStateMachineBuilder(stateMachineHost);
stateMachineBuilder.registerAll();
self._stateMachineBuilder = stateMachineBuilder;

function enterQuestionPhase(): void {
  stateMachineBuilder.enterQuestionPhase();
}

const beatCoordinator = new BeatRunCoordinator({
  questionBank,
  battle,
  armReachAnswerSelector,
  answerRestBeats: options?.answerRestBeats ?? (options?.canvas ? 0 : 2),
  sfx,
  speakFn: (text) => {
    bgmManager.setDucking(true);
    speech.speakRunPhase(text);
    setTimeout(() => bgmManager.setDucking(false), 2600);
  },
  onBeat: (event) => {
    (eventBus as any).emit?.('beat:tick', event);
  },
  onPhaseChange: (phase) => {
    stateMachineBuilder.handleBeatPhaseChange(phase);
  },
  onTimeout: () => {
    // Issue #283: 답안 선택 4박 타임아웃 발생 즉시 명확한 인과관계 알림 ("시간 초과!")
    feedbackCustomText = '시간 초과!';
    feedbackCustomColor = '#FFAA33';
    feedbackCorrect = false;
    feedbackTimer = Math.max(0.8, beatCoordinator.rhythmEngine.secondsPerBeat * beatCoordinator.answerRestBeats);
    sfx.play('wrong');
    speech.speak('시간 초과!');
    skeletonEffect.triggerHit();
    effectManager.playFade({
      x: canvasManager.virtualWidth * 0.5,
      y: canvasManager.virtualHeight * 0.22 - 30,
      text: '시간 초과!',
      color: '#FFAA33',
      fontSize: 36,
      duration: 0.8,
    });
    effectManager.playAnswerEffect(
      'timeout',
      canvasManager.virtualWidth * 0.5,
      canvasManager.virtualHeight * 0.5,
    );
    (eventBus as any).emit('answer:timeout');
  },
  onAnswerSelected: (idx) => {
    feedbackCustomText = null;
    feedbackCustomColor = null;
    sfx.play('hover');
    answerLocked = true;
    const correct = idx === beatCoordinator.currentQuestion?.correctIndex;
    feedbackCorrect = correct;
    feedbackTimer = Math.max(0.8, beatCoordinator.rhythmEngine.secondsPerBeat * beatCoordinator.answerRestBeats);

    const buttonLayouts = getAnswerButtonLayouts(canvasManager.virtualWidth, canvasManager.virtualHeight);
    const targetBtn = (idx === 0 || idx === 1) ? buttonLayouts[idx] : null;
    const bx = targetBtn ? targetBtn.centerX : canvasManager.virtualWidth * 0.5;
    const by = targetBtn ? targetBtn.y + targetBtn.height / 2 : canvasManager.virtualHeight * 0.5;

    if (correct) {
      sfx.play('correct');
      effectManager.playAnswerEffect('correct', bx, by, battle.combo + 1);
      effectManager.playPreset('correct', bx, by);
      battleEventBinder.triggerBossHitImpact(HORIZON_RATIO);
      // Issue #540: 정답 TTS 낭독 삭제 (SFX 효과음으로 대체)
      eventBus.emit('answer:correct', { mana: battle.mana, combo: battle.combo + 1 });
    } else {
      sfx.play('wrong');
      effectManager.playAnswerEffect('wrong', bx, by);
      effectManager.playPreset('wrong', bx, by);
      // Issue #540: 오답 TTS 낭독 삭제 (SFX 효과음으로 대체)
      eventBus.emit('answer:wrong', { hp: battle.hp });
    }
  },
  onAnswerConfirmed: (idx, _correct, status) => {
    stateMachine.changeState('ROUND_RESOLVE');
    const resolveResult = beatRoundResolver.resolveRound(status, beatRoundResolver.currentRoundIndex);
    handleAnswer(idx, status, resolveResult);
  },
});
const phaseAHazardController = new PhaseAHazardController({
  intentBus: motionIntentBus,
  onBeatResolved: ({ evaded, damage }) => {
    if (evaded) {
      sfx.play('shield_deflect');
      effectManager.playBurst({
        x: canvasManager.virtualWidth * 0.5,
        y: canvasManager.virtualHeight * 0.76,
        count: 10,
        colors: ['#4DFFAA', '#FFFFFF'],
        duration: 0.28,
      });
      return;
    }

    const appliedDamage = damage ?? DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss;
    battle.applyHazardDamage(appliedDamage);
    sfx.play('player_hurt');
    skeletonEffect.triggerHit();
    // Issue #283: 오답 프리셋('wrong') 대신 장판 피격 전용 이펙트('HIT! -25 HP') 적용
    effectManager.playHazardHit(canvasManager.virtualWidth * 0.5, canvasManager.virtualHeight * 0.76, appliedDamage);
    if (!battle.isAlive) {
      showResult(false);
    }
  },
});

// ─── 발 키노트 공통 라우터 (Issue #237 / BUG-MOTION-COORDINATE-001) ───
footKeynoteInput.onEvent((event) => {
  console.log(`[DG] 발 키노트 수신: ${event.source} ${event.foot} (Zone ${event.zoneId})`);
  if (screenMode === 'game') {
    // Issue #425: RUN_QUESTION 페이즈 발 키노트 입력 시 스텝 기록 및 리듬 판정 피드백 연동
    if (
      (stateMachine.currentState === 'RUN_QUESTION' || beatCoordinator.phase === 'RUN_QUESTION') &&
      !pauseModal.isOpen
    ) {
      beatCoordinator.recordStep();
      runningMatRenderer.triggerMotionHit();
      const spb = beatCoordinator.rhythmEngine?.secondsPerBeat || 0.5;
      const beatProg = beatCoordinator.rhythmEngine?.beatProgress ?? 0;
      const distToBeat = Math.min(beatProg, 1.0 - beatProg) * spb;
      let rating = 'GOOD';
      if (distToBeat <= 0.12) {
        rating = 'PERFECT';
      } else if (distToBeat <= 0.25) {
        rating = 'GOOD';
      } else {
        rating = 'LATE';
      }

      const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === event.zoneId);
      const jx = targetZone
        ? (targetZone.x + targetZone.width * 0.5) * canvasManager.virtualWidth
        : canvasManager.virtualWidth * 0.5;
      const jy = canvasManager.virtualHeight * (RUNNING_MAT_CONFIG.strikeLineYRatio ?? 0.86);

      effectManager.playJudgmentText(jx, jy - 35, rating);
      if (rating === 'PERFECT') {
        sfx.play('crystal_pickup');
      } else {
        sfx.play('step_beat');
      }
    }

    // Issue #235 & #213: STAR_COLLECT 및 BOSS_CLIMAX 페이즈 발 키노트 단일 결과 라우팅 연동
    if (
      stateMachine.currentState === 'STAR_COLLECT' ||
      stateMachine.currentState === 'BOSS_CLIMAX' ||
      beatCoordinator.phase === 'STAR_COLLECT' ||
      beatCoordinator.phase === 'KEYNOTE_PERFORMANCE'
    ) {
      starNoteScheduler.fromFoot(event, engine.elapsedTime);
    }

    if (stateMachine.currentState === 'HAZARD_EVADE' && !pauseModal.isOpen) {
      const target = phaseAHazardController.activePattern;
      if (event.foot === 'leftFoot') {
        phaseAHazardController.recordAction(target === 'balance_right' ? 'balance_right' : 'left_step');
      } else if (event.foot === 'rightFoot') {
        phaseAHazardController.recordAction(target === 'balance_left' ? 'balance_left' : 'right_step');
      } else if (event.foot === 'centerFoot') {
        phaseAHazardController.recordAction('jump');
      }
    }

    // Issue #193: BOSS_CLIMAX 중 발 키노트 입력 시 보스 공격(교대 짓밟기/충격파) 회피 판정 연동
    if (stateMachine.currentState === 'BOSS_CLIMAX' && !pauseModal.isOpen && bossHazardController) {
      if (event.foot === 'leftFoot') {
        bossHazardController.recordAction('step_left');
      } else if (event.foot === 'rightFoot') {
        bossHazardController.recordAction('step_right');
      } else if (event.foot === 'centerFoot') {
        bossHazardController.recordAction('jump');
      }
    }

    const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === event.zoneId);
    if (targetZone) {
      effectManager.playBurst({
        x: (targetZone.x + targetZone.width * 0.5) * canvasManager.virtualWidth,
        y: (targetZone.y + targetZone.height * 0.5) * canvasManager.virtualHeight,
        count: 6,
        colors: ['#28E6FF', '#FFCB4D'],
        duration: 0.25,
      });
    }
  }
});

let settingsHoverTimer = 0;
let actionHoverTimer = 0;

function updateLocomotionLabel(): void {
  const currentLoco = LOCOMOTION_MODES.find(m => m.mode === locomotionModal.selectedMode);
  if (currentLoco) {
    settingsModal.locomotionModeLabel = currentLoco.label;
  }
}
updateLocomotionLabel();

// ─── 메뉴 제스처 선택 상태 (Issue #119 / BUG-MENU-001) ───
let menuHoverItem: { type: 'chapter' | 'sublevel'; id: number } | null = null;
let menuHoverTimer = 0;
let resultReturnTimer = 0; // Issue #134: 결과 화면 양손 모으기 복귀 타이머
let lastFrameDt = 0.016;

// ─── CSV ───
async function loadQuestions(): Promise<void> {
  try {
    const resp = await fetch('/questions.csv');
    if (resp.ok) {
      const text = await resp.text();
      const records = parseCSV(text);
      questionBank.loadRecords(records);
      console.log(`[DG] ${records.length}개 문제 로드`);
    } else { questionBank.loadRecords([]); }
  } catch { questionBank.loadRecords([]); }
}

async function loadFitnessPatterns(): Promise<void> {
  const reqSession = sessionLifecycle.sessionId;
  const reqGen = sessionContext ? sessionContext.contentGeneration : 0;
  try {
    const resp = await fetch('/fitness pattern.csv');
    if (resp.ok) {
      const text = await resp.text();
      const records = parseFitnessPatternCSV(text);
      const keynotes = createKeynoteSequence(records, 7);

      // Issue #390: 경쟁 차단 가드 (세션 변경 또는 커스텀 팩 활성화 시 덮어쓰기 금지)
      if (sessionLifecycle.sessionId !== reqSession) {
        console.log('[DG] 세션 변경으로 인한 CSV 피트니스 패턴 로드 무시');
        return;
      }
      if (sessionContext && sessionContext.contentMode === 'custom_pack') {
        console.log('[DG] 커스텀 팩 활성화 상태이므로 CSV 패턴으로 노트를 덮어쓰지 않습니다.');
        return;
      }

      if (sessionContext) {
        const applied = sessionContext.applyCsvKeynotes(keynotes, reqGen);
        if (!applied) return;
      }

      beatCoordinator.setKeynotes(keynotes);
      console.log(`[DG] ${records.length}개 피트니스 패턴 로드 완료 및 ${keynotes.length}개 2~8박 키노트 생성 완료`);
    }
  } catch (err) {
    console.warn('[DG] 피트니스 패턴 로드 실패:', err);
  }
}

// ─── 카메라 및 포즈 파이프라인 ───
async function ensureCameraStarted(): Promise<void> {
  if (!cameraLayer.isActive && cameraLayer.status !== 'requesting') {
    const started = await cameraLayer.start();
    if (started && poseManager.status === 'idle') {
      await poseManager.init();
    }
  }
}

// ─── Phase B 및 스테이지 진행도 컨트롤러 인스턴스화 ───
// Issue #213: Phase B 보스 결전 및 연속 별모으기 피버 컨트롤러 인스턴스화
bossFeverController = new BossFeverController({
  battleState: battle,
  bossController: boss,
  stateMachine,
  scheduler: starNoteScheduler,
  config: DEFAULT_CONFIG.battle.fever,
  secondsPerBeat: defaultSecondsPerBeat,
  onVictory: (stats) => {
    console.log('[DG] Phase B 보스 격파 승리! 통계:', stats);
    battleEventBinder.handleBossDefeated(stats, true);
  },
  onGameOver: (stats) => {
    console.log('[DG] Phase B 플레이어 패배... 통계:', stats);
    battleEventBinder.handlePlayerDefeated(stats, true);
  },
  onDamageDealt: () => {
    battleEventBinder.triggerBossHitImpact(0.35, true, false, 'correct');
  },
});

// Issue #193: Phase B 전용 보스 공격·충격파·광폭화 컨트롤러 인스턴스화
bossHazardController = new BossHazardController({
  battleState: battle,
  bossController: boss,
  bossFeverController,
  minionTroopManager: beatRoundResolver.resourceManager.troopManager,
  eventBus,
  config: DEFAULT_CONFIG.battle.bossHazard,
  onAttackStart: (attackType) => {
    console.log(`[DG] Phase B 보스 패턴 공격 개시: ${attackType}`);
  },
  onHazardResolved: (result) => {
    battleEventBinder.handleHazardResolved(result);
  },
});

const stageProgressController = new StageProgressController({
  maxRounds: DEFAULT_CONFIG.battle.phaseAQuestionCount ?? 10,
  stateMachine,
  sessionLifecycle,
  resourceProvider: beatRoundResolver,
  advanceDelayMs: 800,
  onAdvanceToNextRound: (nextRound) => {
    beatRoundResolver.startNewRound(nextRound);
    startRunningPhase();
  },
  onEnterBossClimax: (snapshot) => {
    console.log('[DG] Phase B (BOSS_CLIMAX) 진입 완료! 단일 자원 인계:', snapshot);
    const bundle = sessionContext?.activeStageBundle ?? (sessionContext as any)?.stageBundle ?? null;
    if (bundle) {
      bossFeverController?.setStageBundle(bundle);
      bossHazardController?.setStageBundle(bundle);
    }
    if (!beatRoundResolver.resourceManager.troopManager.isActive) {
      beatRoundResolver.resourceManager.troopManager.startPhaseB(snapshot);
    }
    if (bossFeverController && !bossFeverController.isActive) {
      bossFeverController.start(engine.elapsedTime, snapshot);
    }
    if (bossHazardController && !bossHazardController.isActive) {
      bossHazardController.start();
    }
  },
  onGameOver: () => {
    if (sessionLifecycle.claimResultTransition()) {
      sessionLifecycle.schedule(() => {
        showResult(false);
      }, 600);
    }
  },
});

// ─── 메인 루프 컨텍스트 및 씬 디렉터 상태 참조 ───
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
  get consecutiveWrongCount() { return consecutiveWrongCount; }, set consecutiveWrongCount(v) { consecutiveWrongCount = v; },
  get settingsHoverTimer() { return settingsHoverTimer; }, set settingsHoverTimer(v) { settingsHoverTimer = v; },
  get actionHoverTimer() { return actionHoverTimer; }, set actionHoverTimer(v) { actionHoverTimer = v; },
  get menuHoverItem() { return menuHoverItem; }, set menuHoverItem(v) { menuHoverItem = v; },
  get menuHoverTimer() { return menuHoverTimer; }, set menuHoverTimer(v) { menuHoverTimer = v; },
  get resultReturnTimer() { return resultReturnTimer; }, set resultReturnTimer(v) { resultReturnTimer = v; },
  get feedbackTimer() { return feedbackTimer; }, set feedbackTimer(v) { feedbackTimer = v; },
  get feedbackCustomText() { return feedbackCustomText; }, set feedbackCustomText(v) { feedbackCustomText = v; },
  get feedbackCustomColor() { return feedbackCustomColor; }, set feedbackCustomColor(v) { feedbackCustomColor = v; },
  get feedbackCorrect() { return feedbackCorrect; }, set feedbackCorrect(v) { feedbackCorrect = v; },
  get castingFlash() { return castingFlash; }, set castingFlash(v) { castingFlash = v; },
  get climaxBarrageTimer() { return climaxBarrageTimer; }, set climaxBarrageTimer(v) { climaxBarrageTimer = v; },
  get lastFrameDt() { return lastFrameDt; },
  get questionVisible() { return questionVisible; }, set questionVisible(v) { questionVisible = v; },
};

// ─── 게임 세션 진행 및 라운드 전환 흐름 조정자 (Issue #641 / REFACTOR-SRP-010) ───
const flowCoordinator = new AppSessionFlowCoordinator({
  stateMachine,
  transitionManager,
  sessionLifecycle,
  get sessionContext() { return sessionContext; },
  sfx,
  speech,
  stageBgm,
  bgmManager,
  canvasManager,
  effectManager,
  get engine() { return engine; },
  menuInput,
  starCollectionInput,
  starNoteScheduler,
  hudLayer,
  armReachAnswerSelector,
  pauseModal,
  locomotionModal,
  tutorial,
  xGestureDetector,
  ensureCameraStarted,
  dialogueManager,
  dialogueOverlayRenderer,
  battle,
  boss,
  guardian,
  beatCoordinator,
  beatRoundResolver,
  stageProgressController,
  bossFeverController,
  get bossHazardController() { return bossHazardController; },
  phaseAHazardController,
  readyPositionController,
  get assaultWireHelper() { return self._assaultWireHelper; },
  battleEventBinder,
  contentLoadService,
  questionBank,
  persistence: self.persistence,
  state: stateRef,
  getActivePublishedPack: () => activePublishedPack,
  flushPendingUIPresentation,
  clearPlayedNoteAudioIds: () => playedNoteAudioIds.clear(),
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
function renderFeedback(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (feedbackTimer <= 0) return;
  const alpha = Math.min(1, feedbackTimer * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(84, w * 0.075)}px sans-serif`;
  const color = feedbackCustomColor ?? (feedbackCorrect ? '#4DFFAA' : '#FF4444');
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  const text = feedbackCustomText ?? (feedbackCorrect ? '정답!' : '오답...');
  ctx.fillText(text, w / 2, h * 0.22);
  ctx.shadowBlur = 0;

  if (castingFlash > 0) {
    ctx.globalAlpha = castingFlash * 0.25;
    ctx.fillStyle = '#C889FF';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(28, w * 0.024)}px sans-serif`;
    ctx.fillText(`수호신 캐스팅! (${guardian.stageName})`, w / 2, h * 0.55);
  }

  ctx.restore();
}

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
    contentProvider,
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
  canvasManager,
  cameraLayer,
  poseManager,
  skeletonAnimation,
  stickmanRenderer,
  boneRenderer,
  jointRenderer,
  skeletonEffect,
  calibrationHelper,
  xGestureDetector,
  locomotionDetectors,
  runDetector,
  jumpDetector,
  motionIntentBus,
  menuInput,
  answerSelector,
  armReachAnswerSelector,
  beatCoordinator,
  starNoteScheduler,
  starCollectionInput,
  getPhaseAStarNotes,
  getPhaseAHazardPattern,
  sessionContext,
  bossFeverController,
  bossHazardController,
  phaseAHazardController,
  readyPositionController,
  readyPositionRenderer,
  menuRenderer,
  resultRenderer,
  hudLayer,
  dreamGrid,
  runningMatRenderer,
  starNoteRenderer,
  beatHUDRenderer,
  questionRenderer,
  answerSelectionRenderer,
  bossRenderer,
  guardian,
  effectManager,
  transitionManager,
  settingsModal,
  pauseModal,
  locomotionModal,
  bottomBar,
  gestureFeedbackOverlay,
  dialogueOverlayRenderer,
  tutorial,
  speech,
  sfx,
  stateMachine,
  battle,
  boss,
  questionBank,
  presentationAdapter,
  beatRoundResolver,
  imageLoader,
  canvas,
  get engine() { return engine; },
  cursorTracker: answerSelector.cursorTracker,
  kneeFramingValidator,
  kneeFramingGuideRenderer,
  getActiveLocomotionDetector,
  footKeynoteDetector,
  footKeynoteInput,
  bossClimaxRenderer,
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

    // Systems assignment
    this.canvasManager = canvasManager;
    this.cameraLayer = cameraLayer;
    this.poseManager = poseManager;
    this.boneRenderer = boneRenderer;
    this.jointRenderer = jointRenderer;
    this.skeletonAnimation = skeletonAnimation;
    this.skeletonEffect = skeletonEffect;
    this.stickmanRenderer = stickmanRenderer;
    this.questionBank = questionBank;
    this.speech = speech;
    this.eventBus = eventBus;
    this.battle = battle;
    this.boss = boss;
    this.guardian = guardian;
    this.hudLayer = hudLayer;
    this.menuRenderer = menuRenderer;
    this.resultRenderer = resultRenderer;
    this.bossRenderer = bossRenderer;
    this.dreamGrid = dreamGrid;
    this.runningMatRenderer = runningMatRenderer;
    this.effectManager = effectManager;
    this.runDetector = runDetector;
    this.jumpDetector = jumpDetector;
    this.calibrationHelper = calibrationHelper;
    this.locomotionDetectors = locomotionDetectors;
    this.answerSelector = answerSelector;
    this.motionIntentBus = motionIntentBus;
    this.armReachAnswerSelector = armReachAnswerSelector;
    this.answerSelectionRenderer = answerSelectionRenderer;
    this.menuInput = menuInput;
    this.sfx = sfx;
    this.bandSynth = bandSynth;
    this.stageBgm = stageBgm;
    this.bgmManager = bgmManager;
    this.tutorial = tutorial;
    this.bottomBar = bottomBar;
    this.settingsModal = settingsModal;
    this.locomotionModal = locomotionModal;
    this.pauseModal = pauseModal;
    this.xGestureDetector = xGestureDetector;
    this.questionRenderer = questionRenderer;
    this.beatHUDRenderer = beatHUDRenderer;
    this.presentationAdapter = presentationAdapter;
    this.starNoteRenderer = starNoteRenderer;
    this.bossClimaxRenderer = bossClimaxRenderer;
    this.dialogueOverlayRenderer = dialogueOverlayRenderer;
    this.gestureFeedbackOverlay = gestureFeedbackOverlay;
    this.transitionManager = transitionManager;
    this.sessionLifecycle = sessionLifecycle;
    this.stateMachine = stateMachine;
    this.beatRoundResolver = beatRoundResolver;
    this.kneeFramingValidator = kneeFramingValidator;
    this.kneeFramingGuideRenderer = kneeFramingGuideRenderer;
    this.footKeynoteDetector = footKeynoteDetector;
    this.footKeynoteInput = footKeynoteInput;
    this.beatCoordinator = beatCoordinator;
    this.phaseAHazardController = phaseAHazardController;
    this.starNoteScheduler = starNoteScheduler;
    this.starCollectionInput = starCollectionInput;
    this.stageProgressController = stageProgressController;
    this.bossFeverController = bossFeverController;
    this.bossHazardController = bossHazardController;
    this.readyPositionRenderer = readyPositionRenderer;
    this.readyPositionController = readyPositionController;
    this.sessionContext = sessionContext;
    this.sceneDirector = sceneDirector;
    this.mainSceneContext = mainSceneContext;
    this.getPhaseAStarNotes = getPhaseAStarNotes;
    this.getPhaseAHazardPattern = getPhaseAHazardPattern;
    this.engine = engine;
    this.contentLoadService = contentLoadService;
    this.contentProvider = contentProvider;
    this.uiPresentationLoadService = uiPresentationLoadService;
    this.getActiveUIPresentation = getActiveUIPresentation;
    this.getActiveUIArtifact = getActiveUIArtifact;
    this.getActiveUIHash = getActiveUIHash;
    this.getPendingUIArtifact = getPendingUIArtifact;
    this.setUIPresentationArtifact = setUIPresentationArtifact;
    this.applyUIPresentation = applyUIPresentation;
    this.rollbackUIPresentation = rollbackUIPresentation;
    this.flushPendingUIPresentation = flushPendingUIPresentation;
    this.setCustomContentPack = (pack: PublishedContentPack | null) => {
      activePublishedPack = pack;
    };

    // Actions assignment
    this.selectChapter = selectChapter;
    this.selectSubLevel = selectSubLevel;
    this.startChapter = startChapter;
    this.startTestPlaySession = (ch, options) => flowCoordinator.startTestPlaySession(ch, options);
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
      if (self.isAssaultMode() || self.assaultSession) {
        self.restartAssaultSession();
        return;
      }
      flowCoordinator.restartGame();
    };
    this.answerCurrentQuestion = (idx) => flowCoordinator.answerCurrentQuestion(idx);
    this.ensureCameraStarted = ensureCameraStarted;
    this.loadQuestions = loadQuestions;
    this.loadFitnessPatterns = loadFitnessPatterns;
    this.applyDevPlayState = (params) => flowCoordinator.applyDevPlayState(params);

    const loadStaticManifest = async (
      manifestUrl?: string,
      options?: StaticManifestLoadOptions,
    ): Promise<boolean> => {
      const mergedOptions = options ?? this._options.staticManifestOptions;
      const targetUrl = manifestUrl ?? this._options.staticManifestUrl;
      const result = await contentLoadService.loadStaticManifest(targetUrl, mergedOptions);
      if (result.status === 'success') {
        activePublishedPack = result.pack;
        return true;
      }
      if (result.status === 'fallback') {
        activePublishedPack = result.fallbackPack ?? null;
        return false;
      }
      activePublishedPack = null;
      return false;
    };

    const loadLocalTestOverride = async (
      identifier: string,
      options?: ContentLoadOptions,
    ): Promise<boolean> => {
      const isTest = options?.isTestMode ?? sessionLifecycle.isTestSession ?? false;
      const result = await contentLoadService.loadLocalTestOverride(identifier, {
        ...options,
        isTestMode: isTest,
      });
      if (result.status === 'success') {
        activePublishedPack = result.pack;
        return true;
      }
      return false;
    };

    this.loadStaticManifest = loadStaticManifest;
    this.loadLocalTestOverride = loadLocalTestOverride;

    // Browser event listeners [REFACTOR-SRP-001] (Issue #632)
    const listenerHost: AppEventListenerHost = {
      canvas: this.canvas,
      canvasManager,
      bgmManager,
      stageBgm,
      sfx,
      bandSynth,
      speech,
      cameraLayer,
      ensureCameraStarted,
      tutorial,
      pauseModal,
      locomotionModal,
      updateLocomotionLabel,
      settingsModal,
      bottomBar,
      get screenMode() { return screenMode; },
      get menuMode() { return menuMode; },
      get gamePhase() { return gamePhase; },
      get selectedChapter() { return selectedChapter; },
      get currentQuestion() { return currentQuestion; },
      selectChapter,
      selectSubLevel,
      goToMenu,
      menuRenderer,
      questionBank,
      poseManager,
      presentationAdapter,
      stateMachine,
      get answerLocked() { return answerLocked; },
      beatCoordinator,
      starNoteScheduler,
      engine,
      bossHazardController,
      phaseAHazardController,
      assaultWireHelper: this._assaultWireHelper,
      readyPositionController,
      runningMatRenderer,
      effectManager,
      footKeynoteInput,
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

    // [DEVUI-002] (Issue #562): 엔진 시작(첫 렌더) 전 public/ui-layout.json 을 UI_LAYOUT 에 in-place 병합.
    // 파일이 없거나 실패하면 기본값 그대로 부팅한다.
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

    this.cameraLayer.stop();
    this._isRunning = false;
    this._isDisposed = true;
  }
}
