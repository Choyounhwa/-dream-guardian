/**
 * BootstrapSubsystemFactory.ts - AppBootstrap 핵심 서브시스템 인스턴스 팩토리
 *
 * [REFACTOR-CORE-003] (Issue #618)
 * - AppBootstrap에서 거대화되었던 40여 개 핵심 서브시스템(렌더/카메라/포즈 계층, 오디오/스피치,
 *   전투/보스/수호신, 입력/제스처 검출기, 렌더러, 모달 등)의 생성 및 의존성 주입(DI) 로직을 전담 캡슐화.
 */

import { DEFAULT_BEAT_MOTION_CONFIG } from '../../../config/beat-motion.config.js';
import { CanvasManager } from '../../render/CanvasManager.js';
import { CameraLayer } from '../../render/CameraLayer.js';
import { PoseManager } from '../../motion/PoseManager.js';
import { BoneRenderer } from '../../skeleton/BoneRenderer.js';
import { JointRenderer } from '../../skeleton/JointRenderer.js';
import { SkeletonAnimation } from '../../skeleton/SkeletonAnimation.js';
import { SkeletonEffect } from '../../skeleton/SkeletonEffect.js';
import type { IAvatarRenderer } from '../../skeleton/IAvatarRenderer.js';
import { StickmanRenderer } from '../../skeleton/StickmanRenderer.js';
import { QuestionBank } from '../../question/QuestionBank.js';
import { QuestionSpeech } from '../../question/QuestionSpeech.js';
import { EventBus } from '../EventBus.js';
import { BattleState } from '../../game/BattleState.js';
import { BossController } from '../../game/BossController.js';
import { GuardianSystem } from '../../game/GuardianSystem.js';
import { HUDLayer } from '../../ui/HUDLayer.js';
import { MenuRenderer } from '../../ui/MenuRenderer.js';
import { ResultRenderer } from '../../ui/ResultRenderer.js';
import { PhasePresentationAdapter } from '../../ui/PhasePresentationAdapter.js';
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
} from '../../render/index.js';
import { RunningMatRenderer } from '../../render/RunningMatRenderer.js';
import { EffectManager, TransitionManager } from '../../effects/index.js';
import {
  RunDetector,
  JumpDetector,
  CalibrationHelper,
  HipBounceDetector,
  HipSwayDetector,
  ArmCrossDetector,
  XGestureDetector,
  KneeFramingValidator,
  FootKeynoteDetector,
  MotionIntentBus,
  type ILocomotionDetector,
  type LocomotionMode,
} from '../../motion/index.js';
import {
  AnswerSelector,
  ArmReachAnswerSelector,
  FootKeynoteInput,
  StarCollectionInput,
  MenuInput,
} from '../../input/index.js';
import { SFXSynth, BandSynthesizer, BGMManager } from '../../audio/index.js';
import { StageBGMSynthesizer } from '../../audio/StageBGMSynthesizer.js';
import {
  BottomBar,
  SettingsModal,
  LocomotionModal,
  PauseModal,
  TutorialOverlay,
  GestureFeedbackOverlay,
} from '../../ui/index.js';
import { SessionLifecycle } from '../SessionLifecycle.js';
import { StarNoteScheduler } from '../../game/index.js';
import { ContentLoadService } from '../ContentLoadService.js';
import { ContentProvider } from '../../game/ContentProvider.js';
import { UIPresentationLoadService } from '../UIPresentationLoadService.js';

export interface BootstrapSubsystemFactoryOptions {
  canvas?: HTMLCanvasElement;
  avatarRenderer?: IAvatarRenderer;
  sfx?: SFXSynth;
  audioContext?: AudioContext;
  eventBus?: EventBus;
  sessionLifecycle?: SessionLifecycle;
  bpm?: number;
  questionBank?: QuestionBank;
  battle?: BattleState;
  boss?: BossController;
  guardian?: GuardianSystem;
}

export interface BootstrapSubsystems {
  canvasManager: CanvasManager;
  cameraLayer: CameraLayer;
  poseManager: PoseManager;
  boneRenderer: BoneRenderer;
  jointRenderer: JointRenderer;
  skeletonAnimation: SkeletonAnimation;
  skeletonEffect: SkeletonEffect;
  stickmanRenderer: IAvatarRenderer;
  questionBank: QuestionBank;
  speech: QuestionSpeech;
  eventBus: EventBus;
  battle: BattleState;
  boss: BossController;
  guardian: GuardianSystem;
  hudLayer: HUDLayer;
  menuRenderer: MenuRenderer;
  resultRenderer: ResultRenderer;
  bossRenderer: BossRenderer;
  dreamGrid: DreamGrid;
  runningMatRenderer: RunningMatRenderer;
  effectManager: EffectManager;
  runDetector: RunDetector;
  jumpDetector: JumpDetector;
  calibrationHelper: CalibrationHelper;
  locomotionDetectors: Record<LocomotionMode, ILocomotionDetector>;
  getActiveLocomotionDetector: () => ILocomotionDetector;
  answerSelector: AnswerSelector;
  motionIntentBus: MotionIntentBus;
  armReachAnswerSelector: ArmReachAnswerSelector;
  answerSelectionRenderer: AnswerSelectionRenderer;
  menuInput: MenuInput;
  sfx: SFXSynth;
  bandSynth: BandSynthesizer;
  stageBgm: StageBGMSynthesizer;
  bgmManager: BGMManager;
  tutorial: TutorialOverlay;
  bottomBar: BottomBar;
  settingsModal: SettingsModal;
  locomotionModal: LocomotionModal;
  pauseModal: PauseModal;
  xGestureDetector: XGestureDetector;
  questionRenderer: QuestionRenderer;
  beatHUDRenderer: BeatHUDRenderer;
  presentationAdapter: PhasePresentationAdapter;
  starNoteRenderer: StarNoteRenderer;
  bossClimaxRenderer: BossClimaxRenderer;
  dialogueOverlayRenderer: DialogueOverlayRenderer;
  gestureFeedbackOverlay: GestureFeedbackOverlay;
  transitionManager: TransitionManager;
  sessionLifecycle: SessionLifecycle;
  kneeFramingValidator: KneeFramingValidator;
  kneeFramingGuideRenderer: KneeFramingGuideRenderer;
  footKeynoteDetector: FootKeynoteDetector;
  footKeynoteInput: FootKeynoteInput;
  starCollectionInput: StarCollectionInput;
  starNoteScheduler: StarNoteScheduler;
  contentLoadService: ContentLoadService;
  contentProvider: ContentProvider;
  uiPresentationLoadService: UIPresentationLoadService;
  readyPositionRenderer: ReadyPositionRenderer;
}

/**
 * Node/테스트 환경용 Fallback Canvas 생성 헬퍼
 */
export function createFallbackCanvas(w = 1280, h = 720): HTMLCanvasElement {
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

export class BootstrapSubsystemFactory {
  public static create(options?: BootstrapSubsystemFactoryOptions): BootstrapSubsystems {
    return new BootstrapSubsystemFactory().create(options);
  }

  public create(options?: BootstrapSubsystemFactoryOptions): BootstrapSubsystems {
    const canvas = options?.canvas
      ?? (typeof document !== 'undefined' ? (document.getElementById('game-canvas') as HTMLCanvasElement) : undefined)
      ?? createFallbackCanvas();

    // ─── 1. 캔버스, 카메라, 포즈 및 스켈레톤 계층 ───
    const canvasManager = new CanvasManager(canvas);
    const cameraLayer = new CameraLayer({ width: 1280, height: 720, dimAlpha: 0.35, mirror: true });
    const poseManager = new PoseManager({
      virtualWidth: canvasManager.virtualWidth,
      virtualHeight: canvasManager.virtualHeight,
      visibilityThreshold: 0.5,
      mirror: true,
      projectFn: (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
    });
    const boneRenderer = new BoneRenderer({ renderHandBones: true });
    const jointRenderer = new JointRenderer();
    const skeletonAnimation = new SkeletonAnimation({ lerpFactor: 0.3, breathCycle: 3.0, breathAmplitude: 0.02 });
    const skeletonEffect = new SkeletonEffect();
    const stickmanRenderer = options?.avatarRenderer ?? new StickmanRenderer();

    // ─── 2. 코어 데이터 및 전투 시스템 ───
    const questionBank = options?.questionBank ?? new QuestionBank();
    const speech = new QuestionSpeech();
    const eventBus = options?.eventBus ?? new EventBus();
    const battle = options?.battle ?? new BattleState();
    const boss = options?.boss ?? new BossController(1);
    const guardian = options?.guardian ?? new GuardianSystem();

    // ─── 3. 렌더러 계층 ───
    const hudLayer = new HUDLayer();
    const menuRenderer = new MenuRenderer();
    const resultRenderer = new ResultRenderer();
    const bossRenderer = new BossRenderer();
    const dreamGrid = new DreamGrid({ speed: 1.2, hasCeiling: true });
    const runningMatRenderer = new RunningMatRenderer();
    const effectManager = new EffectManager(15);
    effectManager.setViewport(canvasManager.virtualWidth, canvasManager.virtualHeight);

    // ─── 4. 모션 검출기 계층 ───
    const runDetector = new RunDetector();
    const jumpDetector = new JumpDetector();
    const calibrationHelper = new CalibrationHelper(1.0);
    const locomotionDetectors: Record<LocomotionMode, ILocomotionDetector> = {
      run: runDetector,
      hip_bounce: new HipBounceDetector(),
      hip_sway: new HipSwayDetector(),
      arm_cross: new ArmCrossDetector(),
    };

    // ─── 5. 입력 계층 ───
    const answerSelector = new AnswerSelector();
    answerSelector.setViewport(
      canvasManager.virtualWidth,
      canvasManager.virtualHeight,
      (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
    );
    const motionIntentBus = new MotionIntentBus();
    const armReachAnswerSelector = new ArmReachAnswerSelector({ isMirrored: false });
    armReachAnswerSelector.attachIntentBus(motionIntentBus);
    armReachAnswerSelector.setViewport(
      canvasManager.virtualWidth,
      canvasManager.virtualHeight,
      (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
    );
    const answerSelectionRenderer = new AnswerSelectionRenderer();
    const menuInput = new MenuInput();

    // ─── 6. 오디오 계층 ───
    const sfx = options?.sfx ?? new SFXSynth();
    const audioContext = options?.audioContext ?? sfx.audioContext ?? undefined;
    const bandSynth = new BandSynthesizer({ audioContext });
    const stageBgm = new StageBGMSynthesizer({ audioContext });
    const bgmManager = new BGMManager({ audioContext });

    // ─── 7. UI 모달 및 오버레이 ───
    const tutorial = new TutorialOverlay();
    const bottomBar = new BottomBar();
    const settingsModal = new SettingsModal();
    cameraLayer.renderVideo = settingsModal.renderVideoEnabled;
    settingsModal.onRenderVideoChange = (enabled) => {
      cameraLayer.renderVideo = enabled;
    };
    speech.enabled = settingsModal.soundEnabled;
    stageBgm.setMuted(!settingsModal.soundEnabled);
    bgmManager.setMuted(!settingsModal.soundEnabled);

    const locomotionModal = new LocomotionModal();
    const pauseModal = new PauseModal();
    const xGestureDetector = new XGestureDetector();

    function getActiveLocomotionDetector(): ILocomotionDetector {
      const mode = locomotionModal.selectedMode;
      return locomotionDetectors[mode] ?? locomotionDetectors.run;
    }

    const questionRenderer = new QuestionRenderer();
    const beatHUDRenderer = new BeatHUDRenderer();
    const presentationAdapter = new PhasePresentationAdapter(beatHUDRenderer.hazardRenderer);
    const starNoteRenderer = new StarNoteRenderer();
    const bossClimaxRenderer = new BossClimaxRenderer();
    const dialogueOverlayRenderer = new DialogueOverlayRenderer();
    const gestureFeedbackOverlay = new GestureFeedbackOverlay();
    const transitionManager = new TransitionManager();
    const sessionLifecycle = options?.sessionLifecycle ?? new SessionLifecycle();

    // ─── 8. 키노트 / 프레이밍 / 리듬 연동 계층 ───
    const kneeFramingValidator = new KneeFramingValidator();
    const kneeFramingGuideRenderer = new KneeFramingGuideRenderer();

    const footKeynoteDetector = new FootKeynoteDetector({ isMirrored: false });
    const footKeynoteInput = new FootKeynoteInput();
    const starCollectionInput = new StarCollectionInput();
    starCollectionInput.attachIntentBus(motionIntentBus);
    starCollectionInput.setViewport(
      canvasManager.virtualWidth,
      canvasManager.virtualHeight,
      (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
    );

    const defaultSecondsPerBeat = 60 / (options?.bpm ?? DEFAULT_BEAT_MOTION_CONFIG.bpm);
    const starNoteScheduler = new StarNoteScheduler({ secondsPerBeat: defaultSecondsPerBeat });
    starNoteScheduler.setViewport(
      canvasManager.virtualWidth,
      canvasManager.virtualHeight,
      (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
    );

    // ─── 9. 콘텐츠 / UI Presentation 서비스 ───
    const contentLoadService = new ContentLoadService();
    const contentProvider = new ContentProvider();
    const uiPresentationLoadService = new UIPresentationLoadService();

    // ─── 10. 레디 포지션 렌더러 ───
    const readyPositionRenderer = new ReadyPositionRenderer();

    return {
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
    };
  }
}
