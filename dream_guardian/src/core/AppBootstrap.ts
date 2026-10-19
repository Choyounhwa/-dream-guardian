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
import { resolveBottomBarActionSlot } from './SceneDirector.js';
import { loadUiLayoutOverride } from './UILayoutOverride.js';
import { ContentProvider } from '../game/ContentProvider.js';
import {
  type PublishedContentPack,
  validatePublishedContentPack,
  computePublishedPackHash,
} from '../data/PublishedContentPack.js';
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
import type { ResultData } from '../ui/ResultRenderer.js';
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
import { EffectManager, wireAnswerVFX, wireGuardianVFX, TransitionManager } from '../effects/index.js';
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
import { CHAPTER_TRACK_PRESETS } from '../../config/beat-motion.config.js';
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

// Issue #391: 영속성 저장 키 정의
export const STORAGE_KEY_STAGE_PROGRESS = 'dg_stage_progress';
export const STORAGE_KEY_HIGH_SCORES = 'dg_high_scores';
export const STORAGE_KEY_REWARDS = 'dg_rewards';
export type ExtendedResultData = ResultData & { isTestSession?: boolean };

/**
 * 팩 유효성 및 contentHash 무결성 검증 (Issue #391)
 */
export function isVerifiedPublishedPack(
  pack: unknown,
  expectedHash?: string,
): pack is PublishedContentPack {
  if (!pack || typeof pack !== 'object') {
    return false;
  }
  const validation = validatePublishedContentPack(pack);
  if (!validation.valid) {
    return false;
  }
  const typedPack = pack as PublishedContentPack;
  const computedHash = computePublishedPackHash(typedPack);
  if (typedPack.contentHash !== computedHash) {
    return false;
  }
  if (expectedHash && typedPack.contentHash !== expectedHash) {
    return false;
  }
  return true;
}

let activePublishedPack: PublishedContentPack | null = null;

export interface DevPlayStateParams {
  chapter?: number;
  playerHp?: number;
  playerMaxHp?: number;
  playerMana?: number;
  combo?: number;
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: 'idle' | 'warning' | 'attacking' | 'defeated';
  question?: GeneratedQuestion | null;
  hazardPattern?: PhaseAHazardPattern;
}

export class AppBootstrap {
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
  private _assaultWireHelper!: AssaultSessionWireHelper;
  private _stateMachineBuilder!: BootstrapStateMachineBuilder;
  public enableAssaultFinale = false;

  private _onResize: () => void;
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onCanvasClick: (e: MouseEvent) => void;
  private _onVisibilityChange: () => void;

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

// ─── BEAT MOTION / 키노트 / 프레이밍 시스템 (Issue #206) ───
const beatRoundResolver = new BeatRoundResolver({
  battle,
  boss,
  guardian,
  onSpellCast: (spellDmg: number) => {
    const manaX = canvasManager.virtualWidth * 0.5;
    const manaY = canvasManager.virtualHeight * 0.95;
    effectManager.playManaFullEffect(manaX, manaY);
    eventBus.emit('mana:full', { mana: 100 });

    const damage = spellDmg ?? DEFAULT_CONFIG.battle.spellDamage;
    eventBus.emit('guardian:cast', { damage });

    const bx = canvasManager.virtualWidth * 0.5;
    const by = canvasManager.virtualHeight * HORIZON_RATIO;
    const isEnraged = bossHazardController ? bossHazardController.isEnraged : (boss.hp / boss.maxHp <= 0.3);
    bossRenderer.triggerHit();
    effectManager.playBossHitImpact(bx, by, isEnraged);
    eventBus.emit('boss:hit', { bossHp: boss.hp });

    effectManager.playPreset('cast', bx, by);
    castingFlash = 0.6;
    console.log(`[DG] 캐스팅! 보스 HP: ${boss.hp}/${boss.maxHp}`);
  },
  onBossDefeated: () => {
    if (sessionLifecycle.claimResultTransition()) {
      if (!sessionLifecycle.isTestSession && !sessionContext?.isTestSession) {
        const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
        starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
      }
      sessionLifecycle.schedule(() => showResult(true), 600);
    }
  },
  onPlayerDefeated: () => {
    if (sessionLifecycle.claimResultTransition()) {
      sessionLifecycle.schedule(() => showResult(false), 600);
    }
  },
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
const CLIMAX_BARRAGE_DURATION = 0.8;

beatRoundResolver.resourceManager.troopManager.setEventBus(eventBus);
beatRoundResolver.resourceManager.troopManager.setBossController(boss);
eventBus.on('troop:barrage', (info) => {
  climaxBarrageTimer = CLIMAX_BARRAGE_DURATION;
  const isEnraged = bossHazardController ? bossHazardController.isEnraged : (boss.hp / boss.maxHp <= 0.3);
  const bx = canvasManager.virtualWidth * 0.5;
  const by = canvasManager.virtualHeight * 0.35;
  bossRenderer.triggerHit();
  effectManager.playBossHitImpact(bx, by, isEnraged);
  eventBus.emit('boss:hit', { bossHp: boss.hp });
  effectManager.playPreset(
    info.isEnhanced ? 'cast' : 'correct',
    bx,
    by,
  );
  sfx.play('correct');
});

// Issue #265 (A11Y-004): 보스 광폭화 시 TTS 음성 경고 연동
eventBus.on('boss:enrage', () => {
  speech.speakFeedback('boss_enrage');
});

// Issue #274 (VFX-002): 정답/오답/타임아웃 판정 이펙트 이벤트 연동
wireAnswerVFX(eventBus, effectManager, {
  getCoordinates: () => ({
    x: canvasManager.virtualWidth * 0.5,
    y: canvasManager.virtualHeight * 0.5,
  }),
});

// Issue #275 (VFX-003): 수호신 스펠 캐스트 및 보스 피격 이펙트 이벤트 연동
wireGuardianVFX(eventBus, effectManager, {
  getManaCoordinates: () => ({
    x: canvasManager.virtualWidth * 0.5,
    y: canvasManager.virtualHeight * 0.95,
  }),
  getGuardianCoordinates: () => ({
    x: canvasManager.virtualWidth * 0.5,
    y: canvasManager.virtualHeight * 0.84,
  }),
  getBossCoordinates: () => ({
    x: canvasManager.virtualWidth * 0.5,
    y: canvasManager.virtualHeight * HORIZON_RATIO,
  }),
  getIsEnraged: () => (bossHazardController ? bossHazardController.isEnraged : (boss.hp / boss.maxHp <= 0.3)),
});

// Issue #276 (VFX-004): 스켈레톤 시각 이펙트 이벤트 연동 (정답 펄스 / 피격 플래시)
eventBus.on('answer:correct', (info) => {
  skeletonEffect.triggerCorrect(info.combo);
});
eventBus.on('answer:wrong', () => {
  skeletonEffect.triggerHit();
});
eventBus.on('player:hurt', () => {
  skeletonEffect.triggerHit();
});


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
let starsMap: Record<number, number> = {};
let castingFlash = 0;
let consecutiveWrongCount = 0;

// Issue #391: 진행도/하이스코어/보상 영속화 헬퍼 (테스트 세션 격리)
function persistSessionProgress(chapter: number, stars: number): void {
  if (sessionLifecycle.isTestSession || sessionContext?.isTestSession) {
    return;
  }
  starsMap[chapter] = Math.max(starsMap[chapter] ?? 0, stars);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_STAGE_PROGRESS, JSON.stringify(starsMap));
    } catch {
      // localStorage 불가 환경 무시
    }
  }
}

function persistSessionRewards(chapter: number, stars: number): void {
  if (sessionLifecycle.isTestSession || sessionContext?.isTestSession) {
    return;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const existingRewards = JSON.parse(localStorage.getItem(STORAGE_KEY_REWARDS) || '[]');
      existingRewards.push({ chapter, stars, unlockedAt: Date.now() });
      localStorage.setItem(STORAGE_KEY_REWARDS, JSON.stringify(existingRewards));
    } catch {
      // 무시
    }
  }
}

function persistSessionHighScore(result: any): void {
  if (sessionLifecycle.isTestSession || sessionContext?.isTestSession) {
    return;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const record = {
        chapter: result.chapter,
        correctCount: result.correctCount,
        maxCombo: result.maxCombo,
        score: result.correctCount * 100,
        recordedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY_HIGH_SCORES, JSON.stringify(record));
    } catch {
      // 무시
    }
  }
}

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
      const isEnraged = bossHazardController ? bossHazardController.isEnraged : (boss.hp / boss.maxHp <= 0.3);
      bossRenderer.triggerHit();
      effectManager.playBossHitImpact(
        canvasManager.virtualWidth * 0.5,
        canvasManager.virtualHeight * HORIZON_RATIO,
        isEnraged,
      );
      // Issue #540: 정답 TTS 낭독 삭제 (SFX 효과음으로 대체)
      eventBus.emit('answer:correct', { mana: battle.mana, combo: battle.combo + 1 });
      eventBus.emit('boss:hit', { bossHp: boss.hp });
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

function selectChapter(ch: number): void {
  if (ch > 0 && ch <= unlockedChapter) {
    selectedChapter = ch;
    stateMachine.changeState('MENU_SUB');
    menuHoverItem = null;
    menuHoverTimer = 0;
    menuInput.reset();
    sfx.play('hover');
    effectManager.playBurst({
      x: canvasManager.virtualWidth * 0.5,
      y: canvasManager.virtualHeight * 0.45,
      count: 12,
      colors: ['#28E6FF', '#4DFFAA'],
      duration: 0.35,
    });
  }
}

function selectSubLevel(sub: number | null): void {
  if (sub === null) return;
  menuHoverItem = null;
  menuHoverTimer = 0;
  menuInput.reset();
  if (sub === -1) {
    sfx.play('hover');
    stateMachine.changeState('MENU_MAIN');
  } else if (sub === 0) {
    sfx.play('start');
    startChapter(selectedChapter, undefined);
  } else {
    sfx.play('start');
    startChapter(selectedChapter, sub);
  }
}

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

// ─── 게임 플로우 ───
// Issue #202 (FEAT-READY-001): 챕터 첫 진입 2단계 분리 구조 - 카메라 프레임 정렬 및 3초 카운트다운
function startReadyPhase(): void {
  stateMachine.changeState('READY_POSITION');
  questionVisible = false;
  answerLocked = true;
  playedNoteAudioIds.clear();
  starCollectionInput.reset();
  starNoteScheduler.reset();
  Object.values(locomotionDetectors).forEach((d) => d.reset());
  jumpDetector.reset();
  readyPositionController.start();
  console.log('[DG] READY_POSITION 시작 (신체 정렬 가이드 및 3초 카운트다운)');
}

function startRunningPhase(): void {
  if (stateMachine.currentState === 'BOSS_CLIMAX' || stageProgressController.hasEnteredBossClimax) {
    console.warn('[DG] Phase B 진행 중 신규 문제 출제 차단');
    return;
  }
  stateMachine.changeState('RUN_QUESTION');
  questionVisible = true;
  answerLocked = true;
  playedNoteAudioIds.clear();
  starCollectionInput.reset();
  starNoteScheduler.reset();
  Object.values(locomotionDetectors).forEach((d) => d.reset());
  jumpDetector.reset();
  beatCoordinator.startRound({ chapter: currentChapter, subLevel: selectedSubLevel });
  currentQuestion = beatCoordinator.currentQuestion;
  console.log(`[DG] ${beatCoordinator.exerciseBeats}박 문제 라운드 시작: ${currentQuestion?.questionText}`);
}

function startAssaultPhase(): void {
  self._assaultWireHelper.startAssaultPhase(() => {
    questionVisible = false;
    answerLocked = true;
    playedNoteAudioIds.clear();
    starCollectionInput.reset();
    starNoteScheduler.reset();
    Object.values(locomotionDetectors).forEach((d) => d.reset());
    jumpDetector.reset();
  });
}

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
    const purifyDialogue = dialogueManager.getDialogue({
      trigger: 'boss_purified',
      chapter: currentChapter,
      force: true,
    });
    if (purifyDialogue) {
      dialogueOverlayRenderer.show(purifyDialogue);
    }
    showResult(true);
  },
  onGameOver: (stats) => {
    console.log('[DG] Phase B 플레이어 패배... 통계:', stats);
    showResult(false);
  },
  onDamageDealt: () => {
    const isEnraged = bossHazardController ? bossHazardController.isEnraged : (boss.hp / boss.maxHp <= 0.3);
    const bx = canvasManager.virtualWidth * 0.5;
    const by = canvasManager.virtualHeight * 0.35;
    bossRenderer.triggerHit();
    effectManager.playBossHitImpact(bx, by, isEnraged);
    eventBus.emit('boss:hit', { bossHp: boss.hp });
    effectManager.playPreset(
      'correct',
      bx,
      by,
    );
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
    if (result.evaded) {
      console.log(`[DG] 보스 공격 회피 성공! (${result.attackType})`);
      sfx.play('posture_complete');
    } else {
      console.log(`[DG] 보스 공격 피격! (${result.attackType}) 피해: ${result.damage}, 잔여 미니언: ${result.remainingMinions}`);
      sfx.play('wrong');
    }
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

function startChapter(
  ch: number,
  subLevel?: number,
  options?: { pack?: PublishedContentPack | null; isTestSession?: boolean; contentHash?: string },
): void {
  flushPendingUIPresentation();
  if (ch < 1 || ch > 5) return;
  const isTest = Boolean(options?.isTestSession);

  // Issue #391: URL 쿼리나 외부 입력으로 전달된 임의 미검증 데이터의 직접 실행 금지
  if (isTest) {
    if (!options?.pack || !isVerifiedPublishedPack(options.pack, options.contentHash)) {
      console.warn('[DG] 미검증 팩으로 테스트 세션 진입 차단');
      return;
    }
  }

  console.log(`[DG] Ch.${ch} SubLevel ${subLevel ?? 'ALL'} 시작${isTest ? ' (테스트 세션)' : ''}`);
  // Issue #278 (VFX-006): 메뉴 -> 게임 원형 와이프 트랜지션 (0.6초)
  transitionManager.start('circleWipe', 0.6);
  sessionLifecycle.startSession(isTest);
  contentLoadService.cancelCurrentRequest();

  // Issue #390 & #391: 스테이지 시작 전 콘텐츠 모드 및 테스트 세션 확정
  const stageKey = `ch${ch}`;
  const targetPack = options && 'pack' in options ? options.pack : activePublishedPack;
  const resolvedContent = sessionContext
    ? sessionContext.setStageContent({
        stageId: stageKey,
        pack: targetPack,
        isTestSession: isTest,
        force: true,
      })
    : { contentMode: 'default_csv' as const, bundle: null, starNotes: BEGINNER_PHASE_A_STAR_NOTES };

  if (sessionContext) {
    sessionContext.setActive(true);
  }

  engine.resumeGame();
  currentChapter = ch;
  selectedSubLevel = subLevel;
  battle.reset();
  boss.reset(ch);
  guardian.reset();
  beatRoundResolver.reset();
  stageProgressController.reset();
  bossFeverController.reset();
  if (bossHazardController) {
    bossHazardController.reset();
  }
  if (resolvedContent.bundle) {
    bossFeverController?.setStageBundle(resolvedContent.bundle);
    bossHazardController?.setStageBundle(resolvedContent.bundle);
  }
  climaxBarrageTimer = 0;
  starCollectionInput.reset();
  starNoteScheduler.reset();
  hudLayer.reset();
  questionBank.setLevel(ch, subLevel);
  feedbackTimer = 0;
  feedbackCustomText = null;
  feedbackCustomColor = null;

  if (resolvedContent.contentMode === 'custom_pack' && resolvedContent.bundle) {
    beatCoordinator.setKeynotes(resolvedContent.starNotes);
    beatCoordinator.setTrackConfig({
      bpm: resolvedContent.bundle.bpm,
    });
  } else {
    const trackPreset = CHAPTER_TRACK_PRESETS[ch];
    if (trackPreset) {
      beatCoordinator.setTrackConfig(trackPreset);
    }
    beatCoordinator.setKeynotes(sessionContext ? sessionContext.starNotes : BEGINNER_PHASE_A_STAR_NOTES);
  }
  questionVisible = false;
  answerLocked = true;
  castingFlash = 0;
  totalSteps = 0;
  totalJumps = 0;
  totalDwellTime = 0;
  phaseAHazardController.reset();
  pauseModal.close();
  xGestureDetector.reset();
  speech.resetFeedbackState();
  ensureCameraStarted().catch(() => {});

  // Issue #219 (STORY-RENDER-001): 챕터 진입 시 보스 battle_start 대사 발화
  consecutiveWrongCount = 0;
  dialogueManager.reset();
  dialogueOverlayRenderer.clear();
  const startDialogue = dialogueManager.getDialogue({
    trigger: 'battle_start',
    chapter: ch,
    force: true,
  });
  if (startDialogue) {
    dialogueOverlayRenderer.show(startDialogue);
  }

  // Issue #137: 첫 플레이 시 튜토리얼 자동 표시 (테스트 세션에서는 팝업 및 저장 억제)
  if (!isTest && typeof localStorage !== 'undefined' && !localStorage.getItem('dream_guardian_tutorial_done')) {
    tutorial.show();
  }

  // Issue #202: 챕터 진입 시 READY_POSITION(정렬 가이드 & 3초 카운트다운) 선행
  startReadyPhase();
}

function handleAnswer(idx: number, status: RoundAnswerStatus, resolveResult: RoundResolveResult): void {
  sfx.stopDwellCharge();
  if (screenMode !== 'game') return;
  if (!currentQuestion) return;

  answerLocked = true; // 연속 입력 방지
  const correct = status === 'correct';
  questionVisible = false;

  console.log(`[DG] 라운드 정산 완료: 답 ${idx} (${correct ? '정답' : '오답'}) [${status}]`);

  if (correct) {
    consecutiveWrongCount = 0;
    if (resolveResult.spellCast) {
      const manaX = canvasManager.virtualWidth * 0.5;
      const manaY = canvasManager.virtualHeight * 0.95;
      effectManager.playManaFullEffect(manaX, manaY);
      eventBus.emit('mana:full', { mana: 100 });
      eventBus.emit('guardian:cast', { damage: DEFAULT_CONFIG.battle.spellDamage });

      effectManager.playPreset('cast', canvasManager.virtualWidth * 0.5, canvasManager.virtualHeight * HORIZON_RATIO);
      castingFlash = 0.6;
      console.log(`[DG] 캐스팅! 보스 HP: ${boss.hp}/${boss.maxHp}`);
    }

    if (resolveResult.bossDefeated) {
      // Issue #219 (STORY-RENDER-001): 보스 격파/정화 시 boss_purified 대사 발화
      const purifyDialogue = dialogueManager.getDialogue({
        trigger: 'boss_purified',
        chapter: currentChapter,
        force: true,
      });
      if (purifyDialogue) {
        dialogueOverlayRenderer.show(purifyDialogue);
      }
      if (sessionLifecycle.claimResultTransition()) {
        if (!sessionLifecycle.isTestSession && !sessionContext?.isTestSession) {
          const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
          starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
        }
        sessionLifecycle.schedule(() => {
          showResult(true);
        }, 600);
      }
      return;
    }

    // Issue #219 (STORY-RENDER-001): 정답/연속 정답 대사 발화
    const correctDialogue = dialogueManager.getDialogue({
      trigger: 'answer_correct',
      chapter: currentChapter,
      consecutiveCount: battle.combo,
    });
    if (correctDialogue) {
      dialogueOverlayRenderer.show(correctDialogue);
    }
  } else {
    consecutiveWrongCount++;
    // Issue #283: 타임아웃 및 오답 피드백은 이미 ANSWER_SELECT 단계(onTimeout / onAnswerSelected)에서
    // 즉시 표출되었으므로, 장판 페이즈 종료 후 ROUND_RESOLVE 시점에 뒤늦게 중복으로 "오답..." 텍스트나
    // "틀렸습니다!" 음성을 뒷북 발화하지 않도록 억제한다.
    console.log(`[DG] ${status === 'timeout' ? '타임아웃' : '오답'} 정산 완료! 플레이어 HP: ${battle.hp}/${battle.maxHp}`);

    // Issue #219 (STORY-RENDER-001): 오답/연속 오답 시 깨비 위로 대사 발화
    const wrongDialogue = dialogueManager.getDialogue({
      trigger: 'answer_wrong',
      chapter: currentChapter,
      consecutiveCount: consecutiveWrongCount,
    });
    if (wrongDialogue) {
      dialogueOverlayRenderer.show(wrongDialogue);
    }

    if (resolveResult.playerDefeated) {
      stageProgressController.handleRoundSettled(resolveResult, { immediate: true });
      if (sessionLifecycle.claimResultTransition()) {
        sessionLifecycle.schedule(() => {
          showResult(false);
        }, 600);
      }
      return;
    }
  }

  // Phase A 라운드 진행 및 10번째 라운드 후 Phase B 단일 인계 (Issue #241)
  stageProgressController.handleRoundSettled(resolveResult);
}

function showResult(victory: boolean): void {
  sessionLifecycle.cancelAllReservations();
  sfx.stopDwellCharge();
  if (victory) sfx.play('posture_complete');
  else sfx.play('wrong');
  console.log(`[DG] ${victory ? '승리' : '패배'}`);
  resultReturnTimer = 0;
  answerLocked = true;
  questionVisible = false;
  armReachAnswerSelector.closeWindow();
  phaseAHazardController.stop();
  if (bossHazardController) {
    bossHazardController.stop();
  }
  if (bossFeverController) {
    bossFeverController.stop();
  }
  if (sessionContext) {
    sessionContext.setActive(false);
  }
  beatCoordinator.pause();
  engine.pauseGame();
  const isTest = sessionLifecycle.isTestSession || Boolean(sessionContext?.isTestSession);
  resultData = {
    victory,
    chapter: currentChapter,
    correctCount: battle.correctCount,
    totalQuestions: battle.totalQuestions,
    maxCombo: battle.maxCombo,
    // Issue #193: BATTLE-BOSS-001 보스 충격파 회피/짓밟기 실제 steps/jumps 카운트 연동
    steps: totalSteps,
    squats: 0,
    jumps: totalJumps,
    elapsedTime: 60,
    dwellTime: totalDwellTime,
    locomotionMode: locomotionModal.selectedMode,
    rhythmStats: { ...beatRoundResolver.rhythmStats },
    isTestSession: isTest,
  };

  // Issue #391: 일반 승리 시 진행도/하이스코어/보상 영속화 (테스트 세션 제외)
  if (victory && !isTest) {
    const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
    persistSessionProgress(currentChapter, stars);
    persistSessionRewards(currentChapter, stars);
    persistSessionHighScore(resultData);
  }

  // Issue #278 (VFX-006): 게임 -> 결과 전환: fadeToBlack (0.4초)
  const targetState = victory ? 'RESULT' : 'GAMEOVER';
  if (!stateMachine.canTransition(targetState)) {
    if (stateMachine.currentState === 'READY_POSITION') {
      stateMachine.changeState('RUN_QUESTION');
    }
    if (!stateMachine.canTransition(targetState)) {
      if (
        stateMachine.currentState === 'RUN_QUESTION' ||
        stateMachine.currentState === 'ANSWER_SELECT' ||
        stateMachine.currentState === 'STAR_COLLECT' ||
        stateMachine.currentState === 'HAZARD_EVADE'
      ) {
        stateMachine.changeState('ROUND_RESOLVE');
      }
    }
  }
  transitionManager.start('fadeToBlack', 0.4);
  stateMachine.changeState(targetState);
}

function goToMenu(): void {
  flushPendingUIPresentation();
  sessionLifecycle.cancelAllReservations();
  sessionLifecycle.endSession();
  speech.cancel();
  self._assaultWireHelper.dispose();
  contentLoadService.cancelCurrentRequest();
  if (sessionContext) {
    sessionContext.resetContent();
    sessionContext.resetSession();
    sessionContext.setTestSession(false);
  }
  stageProgressController.reset();
  bossFeverController.reset();
  if (bossHazardController) {
    bossHazardController.reset();
  }
  phaseAHazardController.reset();
  climaxBarrageTimer = 0;
  consecutiveWrongCount = 0;
  dialogueOverlayRenderer.clear();
  sfx.stopDwellCharge();
  stageBgm.stop();
  bgmManager.stop();
  pauseModal.close(true);
  starCollectionInput.reset();
  starNoteScheduler.reset();
  beatCoordinator.pause();
  feedbackTimer = 0;
  feedbackCustomText = null;
  feedbackCustomColor = null;
  engine.resumeGame();
  console.log('[DG] 메뉴 복귀');
  // Issue #278 (VFX-006): 결과 -> 메뉴 전환: fadeIn (0.3초)
  transitionManager.start('fadeIn', 0.3);
  stateMachine.changeState('MENU_MAIN');
}

function abortSession(): void {
  goToMenu();
}

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


let lastFrameDt = 0.016;

// ─── 메인 루프 컨텍스트 및 씬 디렉터 (Issue #301 / REFACTOR-MAIN-001) ───
const stateRef: any = {
  get screenMode() { return screenMode; },
  set screenMode(v) { screenMode = v; },
  get menuMode() { return menuMode; },
  set menuMode(v) { menuMode = v; },
  get gamePhase() { return gamePhase; },
  set gamePhase(v) { gamePhase = v; },
  get currentChapter() { return currentChapter; },
  get selectedChapter() { return selectedChapter; },
  get selectedSubLevel() { return selectedSubLevel; },
  get unlockedChapter() { return unlockedChapter; },
  get starsMap() { return starsMap; },
  get currentQuestion() { return currentQuestion; },
  set currentQuestion(v) { currentQuestion = v; },
  get resultData() { return resultData; },
  get totalSteps() { return totalSteps; },
  set totalSteps(v) { totalSteps = v; },
  get totalJumps() { return totalJumps; },
  set totalJumps(v) { totalJumps = v; },
  get settingsHoverTimer() { return settingsHoverTimer; },
  set settingsHoverTimer(v) { settingsHoverTimer = v; },
  get actionHoverTimer() { return actionHoverTimer; },
  set actionHoverTimer(v) { actionHoverTimer = v; },
  get menuHoverItem() { return menuHoverItem; },
  set menuHoverItem(v) { menuHoverItem = v; },
  get menuHoverTimer() { return menuHoverTimer; },
  set menuHoverTimer(v) { menuHoverTimer = v; },
  get resultReturnTimer() { return resultReturnTimer; },
  set resultReturnTimer(v) { resultReturnTimer = v; },
  get feedbackTimer() { return feedbackTimer; },
  set feedbackTimer(v) { feedbackTimer = v; },
  get feedbackCustomText() { return feedbackCustomText; },
  set feedbackCustomText(v) { feedbackCustomText = v; },
  get feedbackCustomColor() { return feedbackCustomColor; },
  set feedbackCustomColor(v) { feedbackCustomColor = v; },
  get feedbackCorrect() { return feedbackCorrect; },
  set feedbackCorrect(v) { feedbackCorrect = v; },
  get castingFlash() { return castingFlash; },
  set castingFlash(v) { castingFlash = v; },
  get climaxBarrageTimer() { return climaxBarrageTimer; },
  set climaxBarrageTimer(v) { climaxBarrageTimer = v; },
  get lastFrameDt() { return lastFrameDt; },
  get questionVisible() { return questionVisible; },
  set questionVisible(v) { questionVisible = v; },
};

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

// ─── 이벤트 ───

    const restartGame = () => {
      if (self.isAssaultMode() || self.assaultSession) {
        self.restartAssaultSession();
        return;
      }
      goToMenu();
      startChapter(selectedChapter, selectedSubLevel, { pack: activePublishedPack });
    };

    const answerCurrentQuestion = (idx: number) => {
      if (pauseModal.isOpen) return;
      if (beatCoordinator.isAnswerOpen) {
        sfx.play('hover');
        beatCoordinator.confirmAnswerByFallback(idx);
      }
    };

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
    this.startTestPlaySession = (
      ch: number,
      options: { pack: PublishedContentPack; contentHash?: string; subLevel?: number },
    ): boolean => {
      if (!options || !options.pack) {
        return false;
      }
      if (!isVerifiedPublishedPack(options.pack, options.contentHash)) {
        console.warn('[DG] 미검증 팩으로 테스트 세션 진입 차단');
        return false;
      }
      startChapter(ch, options.subLevel, {
        pack: options.pack,
        isTestSession: true,
        contentHash: options.contentHash,
      });
      return true;
    };
    this.abortSession = abortSession;
    this.abortTestSession = abortSession;
    this.startReadyPhase = startReadyPhase;
    this.startRunningPhase = startRunningPhase;
    this.startAssaultPhase = startAssaultPhase;
    this.enterQuestionPhase = enterQuestionPhase;
    this.handleAnswer = handleAnswer;
    this.showResult = showResult;
    this.goToMenu = goToMenu;
    this.restartGame = restartGame;
    this.answerCurrentQuestion = answerCurrentQuestion;
    this.ensureCameraStarted = ensureCameraStarted;
    this.loadQuestions = loadQuestions;
    this.loadFitnessPatterns = loadFitnessPatterns;

    this.applyDevPlayState = (params: DevPlayStateParams): void => {
      if (params.chapter !== undefined && params.chapter >= 1 && params.chapter <= 5) {
        currentChapter = params.chapter;
        selectedChapter = params.chapter;
        boss.reset(params.chapter);
      }
      if (params.playerHp !== undefined) {
        battle.setHp(params.playerHp);
      }
      if (params.playerMana !== undefined) {
        (battle as any)._mana = params.playerMana;
      }
      if (params.combo !== undefined) {
        (battle as any)._combo = params.combo;
      }
      if (params.bossHp !== undefined) {
        (boss as any)._hp = params.bossHp;
      }
      if (params.bossMaxHp !== undefined) {
        (boss as any)._maxHp = params.bossMaxHp;
      }
      if (params.bossPhase !== undefined) {
        (boss as any)._phase = params.bossPhase;
      }
      if (params.question !== undefined) {
        currentQuestion = params.question;
        (beatCoordinator as any)._currentQuestion = params.question;
        questionVisible = true;
      }
      if (params.hazardPattern !== undefined) {
        (phaseAHazardController as any)._activePattern = params.hazardPattern;
        (phaseAHazardController as any)._active = true;
      }
    };

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

    // Browser event listeners
    this._onResize = () => {
      canvasManager.resize();
    };

    this._onCanvasClick = (e: MouseEvent) => {
      bgmManager.unlock();

  // 브라우저 사용자 제스처 시 카메라 미시작 상태면 자동 재요청
  if (!cameraLayer.isActive && cameraLayer.status !== 'requesting') {
    ensureCameraStarted().catch(() => {});
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const px = (e.clientX - rect.left) / rect.width * canvas.width;
  const py = (e.clientY - rect.top) / rect.height * canvas.height;
  const { x, y } = canvasManager.toVirtual(px, py);

  const vw = canvasManager.virtualWidth;
  const vh = canvasManager.virtualHeight;

  // Issue #137: 튜토리얼 노출 중 탭/클릭 시 다음 단계 진행 또는 닫기
  if (tutorial.isVisible) {
    tutorial.nextStep();
    return;
  }

  // Issue #172: 일시정지 모달 열림 상태 시 클릭 우선 처리
  if (pauseModal.isOpen) {
    const action = pauseModal.hitTest(x, y, vw, vh);
    if (action === 'resume') {
      pauseModal.close();
      stageBgm.resume();
      bgmManager.resume();
      sfx.play('correct');
    } else if (action === 'quit') {
      pauseModal.close();
      stageBgm.stop();
      bgmManager.stop();
      goToMenu();
      sfx.play('hover');
    } else if (action === 'backdrop') {
      pauseModal.close();
      stageBgm.resume();
      bgmManager.resume();
      sfx.play('hover');
    }
    return;
  }

  // Issue #154: 운동 모드(이동 방식 4종) 모달 열림 상태 시 클릭 우선 처리
  if (locomotionModal.isOpen) {
    const res = locomotionModal.handleClick(x, y, vw, vh);
    if (res) {
      sfx.play('hover');
      if (res.action === 'select') {
        updateLocomotionLabel();
      }
    }
    return;
  }

  // Issue #141: 설정 모달 열림 상태 시 모달 클릭 우선 처리
  if (settingsModal.isOpen) {
    const action = settingsModal.handleClick(x, y, vw, vh);
    if (action === 'close' || action === 'backdrop-close') {
      settingsModal.close();
      sfx.play('hover');
    } else if (action === 'locomotion') {
      settingsModal.close();
      locomotionModal.open();
      sfx.play('hover');
    } else if (action === 'camera') {
      if (cameraLayer.isActive) {
        cameraLayer.stop();
        settingsModal.cameraEnabled = false;
      } else {
        ensureCameraStarted().catch(() => {});
        settingsModal.cameraEnabled = true;
      }
      sfx.play('hover');
    } else if (action === 'fullscreen') {
      const container = document.getElementById('container') || canvas;
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
      sfx.play('hover');
    } else if (action === 'skeleton') {
      settingsModal.skeletonEnabled = !settingsModal.skeletonEnabled;
      sfx.play('hover');
    } else if (action === 'sound') {
      settingsModal.soundEnabled = !settingsModal.soundEnabled;
      sfx.setMuted(!settingsModal.soundEnabled);
      bandSynth.setMuted(!settingsModal.soundEnabled);
      stageBgm.setMuted(!settingsModal.soundEnabled);
      bgmManager.setMuted(!settingsModal.soundEnabled);
      speech.enabled = settingsModal.soundEnabled;
      if (settingsModal.soundEnabled) sfx.play('correct');
    } else if (action === 'fontScale' || action === 'highContrast') {
      sfx.play('hover');
    } else if (action === 'webcamVideo') {
      cameraLayer.renderVideo = settingsModal.renderVideoEnabled;
      sfx.play('hover');
    }
    return;
  }

  // Issue #141: 공통 하단 바 클릭 (설정 버튼)
  if (bottomBar.hitTestSettings(x, y, vw, vh)) {
    settingsModal.open();
    sfx.play('hover');
    return;
  }

  // Issue #141 & #471: 공통 하단 바 클릭 (우측 액션 버튼 - seam geometry 조회 통일)
  const actionSlot = resolveBottomBarActionSlot(bottomBar, vw, vh, screenMode, menuMode);
  const hasAction = actionSlot !== undefined;

  if (hasAction && bottomBar.hitTestAction(x, y, vw, vh, 0, actionSlot)) {
    if (screenMode === 'menu' && menuMode === 'sub') {
      selectSubLevel(-1);
    } else if (screenMode === 'game') {
      stageBgm.pause();
      bgmManager.pause();
      pauseModal.open();
      sfx.play('hover');
    } else if (screenMode === 'result') {
      goToMenu();
    }
    return;
  }

  if (screenMode === 'menu') {
    if (menuMode === 'main') {
      if (menuRenderer.hitTestLocomotion(x, y, vw, vh)) {
        locomotionModal.open();
        sfx.play('hover');
        return;
      }
      const ch = menuRenderer.hitTest(x, y, vw, vh);
      selectChapter(ch);
    } else {
      const subLevels = questionBank.getSubLevels(selectedChapter);
      const chosen = menuRenderer.hitTestSub(x, y, vw, vh, selectedChapter, subLevels);
      selectSubLevel(chosen);
    }
  } else if (screenMode === 'game') {
    // Issue #202: READY_POSITION 진행 중 화면 클릭/터치 시 3초 카운트다운 즉시 건너뛰기
    if (stateMachine.currentState === 'READY_POSITION' && readyPositionController.isActive) {
      readyPositionController.skip();
      return;
    }
    if (gamePhase === 'running' && !pauseModal.isOpen) {
      totalSteps++;
      beatCoordinator.recordStep();
      runningMatRenderer.triggerMotionHit();
      effectManager.playBurst({
        x: vw * 0.5,
        y: vh * 0.65,
        count: 8,
        colors: ['#28E6FF', '#FFCB4D'],
        duration: 0.3,
      });
      currentQuestion = beatCoordinator.currentQuestion;
      return;
    }
    if (!pauseModal.isOpen && presentationAdapter.isAnswerInputAllowed(stateMachine.currentState, answerLocked, beatCoordinator.isAnswerOpen) && currentQuestion) {
      const buttonLayouts = getAnswerButtonLayouts(vw, vh);

      for (let i = 0; i < 2; i++) {
        const btn = buttonLayouts[i];
        if (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height) {
          if (beatCoordinator.isAnswerOpen) {
            sfx.play('hover');
            beatCoordinator.confirmAnswerByFallback(i);
          }
          break;
        }
      }
    }

    // 가상 페달 (Zone 9, 10, 11) 터치/클릭 fallback (Issue #237 & #427: 1/3 균등 전폭 확장 및 바닥 밀착)
    const normX = x / vw;
    const normY = y / vh;
    if (normY >= 0.76 && normY <= 1.0) {
      let pedalZone: 9 | 10 | 11 | null = null;
      if (normX < 1 / 3) pedalZone = 9;
      else if (normX < 2 / 3) pedalZone = 10;
      else pedalZone = 11;
      if (pedalZone) {
        const ev = footKeynoteInput.fromVirtualPedal(pedalZone, engine.elapsedTime);
        if (ev) {
          sfx.play('hover');
        }
      }
    }

    // Issue #235 & #213: STAR_COLLECT 및 BOSS_CLIMAX 중 피트니스 존 터치/클릭 입력
    if (
      stateMachine.currentState === 'STAR_COLLECT' ||
      stateMachine.currentState === 'BOSS_CLIMAX' ||
      beatCoordinator.phase === 'STAR_COLLECT' ||
      beatCoordinator.phase === 'KEYNOTE_PERFORMANCE'
    ) {
      const hitZone = DEFAULT_FITNESS_ZONES.find(
        (z) => normX >= z.x && normX <= z.x + z.width && normY >= z.y && normY <= z.y + z.height,
      );
      if (hitZone) {
        starNoteScheduler.fromTouch(hitZone.id, engine.elapsedTime);
        if (stateMachine.currentState === 'BOSS_CLIMAX' && bossHazardController && !pauseModal.isOpen) {
          if (hitZone.id === 9) {
            bossHazardController.recordAction('step_left');
          } else if (hitZone.id === 11) {
            bossHazardController.recordAction('step_right');
          } else if (hitZone.id === 10) {
            bossHazardController.recordAction('jump');
          }
        }
      }
    }

    // Issue #236: HAZARD_EVADE 중 터치/클릭 회피 fallback (좌: 왼발, 우: 오른발, 중앙: 점프)
    if (stateMachine.currentState === 'HAZARD_EVADE' && !pauseModal.isOpen) {
      const target = phaseAHazardController.activePattern;
      if (target) {
        if (normX < 0.35) {
          phaseAHazardController.recordAction(target === 'balance_right' ? 'balance_right' : 'left_step');
        } else if (normX > 0.65) {
          phaseAHazardController.recordAction(target === 'balance_left' ? 'balance_left' : 'right_step');
        } else {
          phaseAHazardController.recordAction('jump');
        }
        sfx.play('hover');
      }
    }
  } else if (screenMode === 'result') {
    goToMenu();
  }

    };

    this._onKeyDown = (e: KeyboardEvent) => {

  // Issue #141 / #154 / #172: 모달 열림 상태 시 Escape 또는 P로 토글/닫기
  if (e.key === 'Escape' || e.code === 'KeyP') {
    if (pauseModal.isOpen) {
      pauseModal.close();
      stageBgm.resume();
      bgmManager.resume();
      sfx.play('hover');
      return;
    }
    if (locomotionModal.isOpen) {
      locomotionModal.close();
      return;
    }
    if (settingsModal.isOpen) {
      settingsModal.close();
      return;
    }
    if (screenMode === 'game') {
      stageBgm.pause();
      bgmManager.pause();
      pauseModal.open();
      sfx.play('hover');
      return;
    }
    if (screenMode === 'menu' && menuMode === 'sub') {
      selectSubLevel(-1);
      return;
    }
  }

  // BOSS-ASSAULT-23 (#525): assault 모드 활성화 시 키보드 입력을 assault 어댑터로 배타 라우팅
  if (this._assaultWireHelper.handleKeyDown(e)) {
    return;
  }

  // Issue #137: 튜토리얼 스킵 지원
  if (tutorial.isVisible) {
    if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') {
      tutorial.nextStep();
      return;
    }
  }

  if (e.code === 'Space') {
    if (e.repeat) return;
    // Issue #202: READY_POSITION 진행 중 Space 입력 시 3초 카운트다운 즉시 건너뛰기
    if (stateMachine.currentState === 'READY_POSITION' && readyPositionController.isActive) {
      readyPositionController.skip();
      return;
    }
    if (screenMode === 'game' && gamePhase === 'running' && !pauseModal.isOpen) {
      totalSteps++;
      beatCoordinator.recordStep();
      runningMatRenderer.triggerMotionHit();
      effectManager.playBurst({
        x: canvasManager.virtualWidth * 0.5,
        y: canvasManager.virtualHeight * 0.65,
        count: 8,
        colors: ['#28E6FF', '#FFCB4D'],
        duration: 0.3,
      });
      currentQuestion = beatCoordinator.currentQuestion;
      return;
    } else if (
      screenMode === 'game' &&
      stateMachine.currentState === 'HAZARD_EVADE' &&
      !pauseModal.isOpen
    ) {
      const target = phaseAHazardController.activePattern;
      if (target === 'jump') {
        phaseAHazardController.recordAction('jump');
        sfx.play('jump_whoosh');
      } else if (target) {
        phaseAHazardController.recordAction(target);
      }
      effectManager.playBurst({
        x: canvasManager.virtualWidth * 0.5,
        y: canvasManager.virtualHeight * 0.65,
        count: 8,
        colors: ['#28E6FF', '#FFFFFF'],
        duration: 0.3,
      });
      return;
    } else if (
      screenMode === 'game' &&
      (beatCoordinator.phase === 'KEYNOTE_PERFORMANCE' ||
        beatCoordinator.phase === 'STAR_COLLECT' ||
        stateMachine.currentState === 'STAR_COLLECT' ||
        stateMachine.currentState === 'BOSS_CLIMAX')
    ) {
      // Issue #235 & #213: Space 키보드 입력 시 StarNoteScheduler 단일 결과 라우터 연동
      starNoteScheduler.fromKeyboard(engine.elapsedTime);
      if (stateMachine.currentState === 'BOSS_CLIMAX' && bossHazardController && !pauseModal.isOpen) {
        totalJumps++;
        bossHazardController.recordAction('jump');
      }
      return;
    }
  }

  // C: 카메라 켜기/끄기 단축키
  if (e.key.toLowerCase() === 'c') {
    if (cameraLayer.isActive) {
      cameraLayer.stop();
      settingsModal.cameraEnabled = false;
    } else {
      ensureCameraStarted().catch(() => {});
      settingsModal.cameraEnabled = true;
    }
  }

  // F: 전체화면 전환 단축키
  if (e.key.toLowerCase() === 'f') {
    const container = document.getElementById('container') || canvas;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  if (screenMode === 'game') {
    // 발 키노트 키보드 fallback (Z: 왼발 9, X: 중앙발 10, V: 오른발 11) - Issue #237: 공통 라우터 경유
    if (e.key === 'z' || e.key === 'Z') {
      footKeynoteInput.fromKeyboard('leftFoot', engine.elapsedTime);
    } else if (e.key === 'x' || e.key === 'X') {
      footKeynoteInput.fromKeyboard('centerFoot', engine.elapsedTime);
    } else if (e.key === 'v' || e.key === 'V') {
      footKeynoteInput.fromKeyboard('rightFoot', engine.elapsedTime);
    }

    if (!pauseModal.isOpen && presentationAdapter.isAnswerInputAllowed(stateMachine.currentState, answerLocked, beatCoordinator.isAnswerOpen)) {
      if (e.key === '1') {
        sfx.play('hover');
        beatCoordinator.confirmAnswerByFallback(0);
      } else if (e.key === '2') {
        sfx.play('hover');
        beatCoordinator.confirmAnswerByFallback(1);
      }
    }
  } else if (screenMode === 'menu') {
    if (menuMode === 'main') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 5) {
        selectChapter(n);
      }
    } else {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === '0' || e.key.toLowerCase() === 'b') {
        selectSubLevel(-1);
      } else if (e.key.toLowerCase() === 'a') {
        selectSubLevel(0);
      } else {
        const n = parseInt(e.key, 10);
        const subLevels = questionBank.getSubLevels(selectedChapter);
        if (n >= 1 && n <= subLevels.length) {
          selectSubLevel(n);
        }
      }
    }
  } else if (screenMode === 'result') {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') goToMenu();
  }

    };

    this._onKeyUp = (e: KeyboardEvent) => {
      this._assaultWireHelper.handleKeyUp(e);
    };

    this._onVisibilityChange = () => {
      this.handleVisibilityChange();
    };

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

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this._onKeyDown);
      document.addEventListener('keyup', this._onKeyUp);
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (this.canvas && typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('click', this._onCanvasClick);
    }

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

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onResize);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._onKeyDown);
      document.removeEventListener('keyup', this._onKeyUp);
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (this.canvas && typeof this.canvas.removeEventListener === 'function') {
      this.canvas.removeEventListener('click', this._onCanvasClick);
    }

    this.cameraLayer.stop();
    this._isRunning = false;
    this._isDisposed = true;
  }
}
