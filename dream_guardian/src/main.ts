/**
 * Dream Guardian - 메인 진입점
 * Phase 0~6 시스템 통합: 코어 엔진 + 문제 + 전투 + Canvas HUD
 */

import { DEFAULT_CONFIG } from './core/Config.js';
import { GameEngine } from './core/GameEngine.js';
import { CanvasManager } from './render/CanvasManager.js';
import { CameraLayer } from './render/CameraLayer.js';
import { PoseManager } from './motion/PoseManager.js';
import { BoneRenderer } from './skeleton/BoneRenderer.js';
import { JointRenderer } from './skeleton/JointRenderer.js';
import { SkeletonAnimation } from './skeleton/SkeletonAnimation.js';
import { QuestionBank } from './question/QuestionBank.js';
import { parseCSV } from './question/CSVLoader.js';
import { parseFitnessPatternCSV, createKeynoteSequence } from './data/index.js';
import type { GeneratedQuestion } from './question/QuestionEvaluator.js';
import { QuestionSpeech } from './question/QuestionSpeech.js';
import { BattleState } from './game/BattleState.js';
import { BossController } from './game/BossController.js';
import { GuardianSystem, BeatRunCoordinator, BeatRoundResolver } from './game/index.js';
import { HUDLayer } from './ui/HUDLayer.js';
import { MenuRenderer } from './ui/MenuRenderer.js';
import { ResultRenderer, calcStars } from './ui/ResultRenderer.js';
import type { ResultData } from './ui/ResultRenderer.js';
import {
  BossRenderer,
  DreamGrid,
  renderMath,
  AnswerSelectionRenderer,
  PartIconRenderer,
  MagicCircleRenderer,
  PostureGuideRenderer,
  KneeFramingGuideRenderer,
} from './render/index.js';
import { EffectManager } from './effects/index.js';
import {
  RunDetector,
  HipBounceDetector,
  HipSwayDetector,
  ArmCrossDetector,
  XGestureDetector,
  KneeFramingValidator,
  FootKeynoteDetector,
  type ILocomotionDetector,
  type LocomotionMode,
  type KneeFramingResult,
} from './motion/index.js';
import {
  AnswerSelector,
  AnswerZoneSelector,
  FootKeynoteInput,
  StarCollectionInput,
} from './input/index.js';
import { toNormalizedLandmarks } from './utils/index.js';
import { MenuInput } from './input/MenuInput.js';
import { SFXSynth } from './audio/index.js';
import {
  BottomBar,
  SettingsModal,
  LocomotionModal,
  PauseModal,
  TutorialOverlay,
  LOCOMOTION_MODES,
  type BottomBarSlot,
} from './ui/index.js';
import { getAnswerButtonLayouts, DEFAULT_FITNESS_ZONES } from '../config/zone.config.js';
import type { RoundAnswerStatus, RoundResolveResult } from './types/result.js';

if (typeof document === 'undefined') {
  throw new Error('브라우저 환경에서만 실행 가능합니다.');
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

// ─── DOM ───
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// ─── 시스템 ───
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

const questionBank = new QuestionBank();
const speech = new QuestionSpeech();
const battle = new BattleState();
const boss = new BossController(1);
const guardian = new GuardianSystem();
const hudLayer = new HUDLayer();
const menuRenderer = new MenuRenderer();
const resultRenderer = new ResultRenderer();
const bossRenderer = new BossRenderer();
const dreamGrid = new DreamGrid({ speed: 1.2, hasCeiling: true });
const effectManager = new EffectManager(15);
const runDetector = new RunDetector();
const locomotionDetectors: Record<LocomotionMode, ILocomotionDetector> = {
  run: runDetector,
  hip_bounce: new HipBounceDetector(),
  hip_sway: new HipSwayDetector(),
  arm_cross: new ArmCrossDetector(),
};

function getActiveLocomotionDetector(): ILocomotionDetector {
  const mode = locomotionModal.selectedMode;
  return locomotionDetectors[mode] ?? locomotionDetectors.run;
}
const answerSelector = new AnswerSelector();
answerSelector.setViewport(
  canvasManager.virtualWidth,
  canvasManager.virtualHeight,
  (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
);
const answerSelectionRenderer = new AnswerSelectionRenderer();
const magicCircleRenderer = new MagicCircleRenderer();
const postureGuideRenderer = new PostureGuideRenderer(); // Issue #173: renderZoneBoxes 기본 false (가상 영역화)
const menuInput = new MenuInput();
const sfx = new SFXSynth();
const tutorial = new TutorialOverlay();
const bottomBar = new BottomBar();
const settingsModal = new SettingsModal();
const locomotionModal = new LocomotionModal();
const pauseModal = new PauseModal();
const xGestureDetector = new XGestureDetector();

// ─── BEAT MOTION / 키노트 / 프레이밍 시스템 (Issue #206) ───
const beatRoundResolver = new BeatRoundResolver({
  battle,
  boss,
  guardian,
  onSpellCast: () => {
    bossRenderer.triggerHit();
    effectManager.playPreset('cast', canvasManager.virtualWidth * 0.5, canvasManager.virtualHeight * 0.24);
    castingFlash = 0.6;
    console.log(`[DG] 캐스팅! 보스 HP: ${boss.hp}/${boss.maxHp}`);
  },
  onBossDefeated: () => {
    const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
    starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
    setTimeout(() => showResult(true), 600);
  },
  onPlayerDefeated: () => {
    setTimeout(() => showResult(false), 600);
  },
});

const kneeFramingValidator = new KneeFramingValidator();
const kneeFramingGuideRenderer = new KneeFramingGuideRenderer();
let currentKneeFraming: KneeFramingResult = kneeFramingValidator.update(0, null, canvasManager.virtualWidth, canvasManager.virtualHeight);

const footKeynoteDetector = new FootKeynoteDetector({ isMirrored: false });
const footKeynoteInput = new FootKeynoteInput();
const starCollectionInput = new StarCollectionInput();
starCollectionInput.setViewport(
  canvasManager.virtualWidth,
  canvasManager.virtualHeight,
  (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
);

function enterQuestionPhase(): void {
  if (gamePhase === 'question') return;
  gamePhase = 'question';
  questionVisible = true;
  answerLocked = false;
  answerSelector.startQuestion(battle.totalQuestions + 1);
  if (answerSelector.isFirstQuestion) {
    postureGuideRenderer.startFirstQuestionHint(5.0);
  }
}

const beatCoordinator = new BeatRunCoordinator({
  questionBank,
  battle,
  answerZoneSelector: new AnswerZoneSelector({ isMirrored: false }),
  speakFn: (text) => speech.speak(text),
  onPhaseChange: (phase) => {
    if (phase === 'RUN_QUESTION' || phase === 'REST_READY') {
      gamePhase = 'running';
    } else if (phase === 'KEYNOTE_PERFORMANCE') {
      enterQuestionPhase();
    }
  },
  onAnswerSelected: (_idx) => {
    sfx.play('hover');
  },
  onAnswerConfirmed: (idx, _correct, status) => {
    const resolveResult = beatRoundResolver.resolveRound(status);
    handleAnswer(idx, status, resolveResult);
  },
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
const MENU_HOVER_DWELL_TIME = 0.8; // 0.8초 체류 시 메뉴 자동 선택
let resultReturnTimer = 0; // Issue #134: 결과 화면 양손 모으기 복귀 타이머

function selectChapter(ch: number): void {
  if (ch > 0 && ch <= unlockedChapter) {
    selectedChapter = ch;
    menuMode = 'sub';
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
    menuMode = 'main';
  } else if (sub === 0) {
    sfx.play('start');
    startChapter(selectedChapter, undefined);
  } else {
    sfx.play('start');
    startChapter(selectedChapter, sub);
  }
}

// ─── 게임 상태 (FSM 대신 단순 변수 관리) ───
type ScreenMode = 'menu' | 'game' | 'result';
type MenuMode = 'main' | 'sub';
type GamePhase = 'running' | 'question';
let screenMode: ScreenMode = 'menu';
let menuMode: MenuMode = 'main';
let selectedChapter = 1;
let selectedSubLevel: number | undefined = undefined;
let gamePhase: GamePhase = 'running';
let totalSteps = 0;
let totalDwellTime = 0; // Issue #135: 누적 자세 유지 시간 (초)
let currentChapter = 1;
let currentQuestion: GeneratedQuestion | null = null;
let feedbackTimer = 0;
let feedbackCorrect = false;
let questionVisible = false;
let answerLocked = false; // 답 연속 입력 방지
let resultData: ResultData | null = null;
let unlockedChapter = 5;
let starsMap: Record<number, number> = {};
let castingFlash = 0;

const CHAPTER_COLORS = ['', '#4DFFAA', '#28E6FF', '#FFCB4D', '#C889FF', '#FF4444'];

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
  try {
    const resp = await fetch('/fitness pattern.csv');
    if (resp.ok) {
      const text = await resp.text();
      const records = parseFitnessPatternCSV(text);
      answerSelector.recipeGenerator.postureGenerator.setPatterns(records);
      const keynotes = createKeynoteSequence(records, 7);
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
function startRunningPhase(): void {
  gamePhase = 'running';
  questionVisible = true;
  answerLocked = true;
  starCollectionInput.reset();
  Object.values(locomotionDetectors).forEach((d) => d.reset());
  beatCoordinator.startRound({ chapter: currentChapter, subLevel: selectedSubLevel });
  currentQuestion = beatCoordinator.currentQuestion;
  console.log(`[DG] 8박 문제 라운드 시작: ${currentQuestion?.questionText}`);
}

function startChapter(ch: number, subLevel?: number): void {
  if (ch < 1 || ch > 5) return;
  console.log(`[DG] Ch.${ch} SubLevel ${subLevel ?? 'ALL'} 시작`);
  currentChapter = ch;
  selectedSubLevel = subLevel;
  battle.reset();
  boss.reset(ch);
  guardian.reset();
  beatRoundResolver.reset();
  starCollectionInput.reset();
  hudLayer.reset();
  questionBank.setLevel(ch, subLevel);
  feedbackTimer = 0;
  questionVisible = false;
  answerLocked = true;
  castingFlash = 0;
  totalSteps = 0;
  totalDwellTime = 0;
  pauseModal.close();
  xGestureDetector.reset();
  screenMode = 'game';
  ensureCameraStarted().catch(() => {});

  // Issue #137: 첫 플레이 시 튜토리얼 자동 표시
  if (typeof localStorage !== 'undefined' && !localStorage.getItem('dream_guardian_tutorial_done')) {
    tutorial.show();
  }

  startRunningPhase();
}

function handleAnswer(idx: number, status: RoundAnswerStatus, resolveResult: RoundResolveResult): void {
  sfx.stopDwellCharge();
  if (screenMode !== 'game') return;
  if (!currentQuestion || !questionVisible || answerLocked) return;

  answerLocked = true; // 연속 입력 방지
  const correct = status === 'correct';
  feedbackCorrect = correct;
  feedbackTimer = 0.8;
  questionVisible = false;

  console.log(`[DG] 답: ${idx} (${correct ? '정답' : '오답'}) [${status}]`);

  const buttonLayouts = getAnswerButtonLayouts(canvasManager.virtualWidth, canvasManager.virtualHeight);
  const targetBtn = (idx === 0 || idx === 1) ? buttonLayouts[idx] : null;
  const bx = targetBtn ? targetBtn.centerX : canvasManager.virtualWidth * 0.5;
  const by = targetBtn ? targetBtn.y + targetBtn.height / 2 : canvasManager.virtualHeight * 0.5;

  if (correct) {
    sfx.play('correct');
    effectManager.playPreset('correct', bx, by);
    bossRenderer.triggerHit();
    console.log(`[DG] 정답 타격! 보스 HP: ${boss.hp}/${boss.maxHp}`);

    if (resolveResult.spellCast) {
      effectManager.playPreset('cast', canvasManager.virtualWidth * 0.5, canvasManager.virtualHeight * 0.24);
      castingFlash = 0.6;
      console.log(`[DG] 캐스팅! 보스 HP: ${boss.hp}/${boss.maxHp}`);
    }

    if (resolveResult.bossDefeated) {
      const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
      starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
      setTimeout(() => showResult(true), 600);
      return;
    }
  } else {
    sfx.play('wrong');
    effectManager.playPreset('wrong', bx, by);
    // Issue #225: Phase A 오답 시 보스 직접 반격 및 화면 중앙 피격 이펙트 제거 (버튼 피드백만 유지)
    console.log(`[DG] 오답 피드백! 플레이어 HP: ${battle.hp}/${battle.maxHp}`);

    if (resolveResult.playerDefeated) {
      setTimeout(() => showResult(false), 600);
      return;
    }
  }

  setTimeout(() => {
    beatRoundResolver.startNewRound(battle.totalQuestions + 1);
    startRunningPhase();
  }, 800);
}

function showResult(victory: boolean): void {
  sfx.stopDwellCharge();
  if (victory) sfx.play('posture_complete');
  else sfx.play('wrong');
  console.log(`[DG] ${victory ? '승리' : '패배'}`);
  screenMode = 'result';
  resultReturnTimer = 0;
  resultData = {
    victory,
    chapter: currentChapter,
    correctCount: battle.correctCount,
    totalQuestions: battle.totalQuestions,
    maxCombo: battle.maxCombo,
    // TODO(#193): BATTLE-BOSS-001 보스 충격파 회피/짓밟기 구현 시 실제 squats/jumps 카운트 연동
    steps: totalSteps,
    squats: 0,
    jumps: 0,
    elapsedTime: 60,
    dwellTime: totalDwellTime,
    locomotionMode: locomotionModal.selectedMode,
    rhythmStats: { ...beatRoundResolver.rhythmStats },
  };
}

function goToMenu(): void {
  sfx.stopDwellCharge();
  pauseModal.close();
  console.log('[DG] 메뉴 복귀');
  screenMode = 'menu';
  menuMode = 'main';
}

// ─── 문제 렌더링 ───
function renderQuestion(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!currentQuestion || !questionVisible) return;

  const scaleX = w / 1080;
  const scaleY = h / 2160;

  ctx.save();

  // 1. Issue #143 & #165: 문제영역 가상 레이아웃 영역 (사각 박스 화면 표시 제거, Y 기준 좌표계 유지)
  const boxY = 320 * scaleY;

  // 2. 문제 수식 텍스트 (Issue #167: 1.5배 대형화 132px 및 maxWidth 자동 줄바꿈)
  const cx = w / 2;
  const qY = boxY + 220 * scaleY;
  const qText = currentQuestion.questionText;
  const qLen = qText.length;
  let qFontSize = 132 * scaleX; // 1.5배 대형화 (기존 88px -> 132px)
  if (qLen > 10) {
    qFontSize = Math.max(84 * scaleX, (132 - (qLen - 10) * 2.8) * scaleX);
  }

  ctx.shadowColor = 'rgba(40, 230, 255, 0.5)';
  ctx.shadowBlur = 16 * scaleX;
  renderMath(ctx, qText, cx, qY, {
    fontSize: qFontSize,
    color: '#ffffff',
    align: 'center',
    maxWidth: 880 * scaleX,
    placeholderColor: '#28E6FF',
    placeholderBgColor: 'rgba(40, 230, 255, 0.18)',
    fractionLineColor: '#ffffff',
  });
  ctx.shadowBlur = 0;

  // 3. 답안 버튼 2개 횡배치 (Issue #164: 4, 5번 피트니스 존 하단 수직/X축 중심 정렬)
  const buttonLayouts = getAnswerButtonLayouts(w, h);

  for (let i = 0; i < 2; i++) {
    const btn = buttonLayouts[i];
    const bx = btn.x;
    const btnY = btn.y;
    const btnW = btn.width;
    const btnH = btn.height;
    const plan = answerSelector.currentPlan;
    const recipe = plan?.choices[i];

    // Issue #148 & #163: 방사형 색상 분할 버튼 렌더링 (외곽선 두께 8px로 2배 상향)
    PartIconRenderer.drawRadialAnswerButton(ctx, recipe, bx, btnY, btnW, btnH, 20 * scaleX, 8 * scaleX);

    // Issue #200: 답안 선택 즉시 선택 하이라이트 테두리 점등
    if (beatCoordinator.selectedChoiceIndex === i) {
      ctx.save();
      ctx.strokeStyle = '#4DFFAA';
      ctx.lineWidth = 10 * scaleX;
      ctx.shadowColor = '#4DFFAA';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx - 3, btnY - 3, btnW + 6, btnH + 6, 22 * scaleX);
      } else {
        ctx.strokeRect(bx - 3, btnY - 3, btnW + 6, btnH + 6);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 수식 폰트: bold 96px (긴 수식은 최소 60px까지 자동 축소)
    const choiceStr = String(currentQuestion.choices[i]);
    const choiceLen = choiceStr.length;
    const choiceFontSize = choiceLen > 6 ? Math.max(60 * scaleX, (96 - (choiceLen - 6) * 6) * scaleX) : 96 * scaleX;

    renderMath(ctx, choiceStr, bx + btnW / 2, btnY + btnH / 2 - 20 * scaleY, {
      fontSize: choiceFontSize,
      color: '#FFCB4D',
      align: 'center',
      fractionLineColor: '#FFCB4D',
      placeholderColor: '#FFCB4D',
    });

    // 요구 부위 아이콘 렌더링
    if (recipe) {
      const iconSize = 28 * scaleX;
      PartIconRenderer.drawRequirementGroup(ctx, recipe, bx + btnW / 2, btnY + btnH - 36 * scaleY, iconSize);
    }

    // 키보드 힌트
    ctx.font = `bold ${Math.round(22 * scaleX)}px sans-serif`;
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`키보드 [${i + 1}]`, bx + btnW / 2, btnY + btnH + 34 * scaleY);
  }

  ctx.restore();
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
  ctx.fillStyle = feedbackCorrect ? '#4DFFAA' : '#FF4444';
  ctx.shadowColor = feedbackCorrect ? '#4DFFAA' : '#FF4444';
  ctx.shadowBlur = 30;
  ctx.fillText(feedbackCorrect ? '정답!' : '오답...', w / 2, h * 0.22);
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

// ─── 달리기 페이즈 렌더링 ───
function renderRunningPhase(ctx: CanvasRenderingContext2D, vw: number, vh: number): void {
  const cx = vw / 2;
  const cy = vh * 0.52;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const scaleX = vw / 1080;
  const scaleY = vh / 2160;

  // 1. 문제 수식 표시 (1박부터 상단 표시)
  if (currentQuestion) {
    const qY = 320 * scaleY + 160 * scaleY;
    const qText = currentQuestion.questionText;
    const qLen = qText.length;
    let qFontSize = 110 * scaleX;
    if (qLen > 10) {
      qFontSize = Math.max(76 * scaleX, (110 - (qLen - 10) * 2.8) * scaleX);
    }

    ctx.shadowColor = 'rgba(40, 230, 255, 0.5)';
    ctx.shadowBlur = 16 * scaleX;
    renderMath(ctx, qText, cx, qY, {
      fontSize: qFontSize,
      color: '#ffffff',
      align: 'center',
      maxWidth: 880 * scaleX,
      placeholderColor: '#28E6FF',
      placeholderBgColor: 'rgba(40, 230, 255, 0.18)',
      fractionLineColor: '#ffffff',
    });
    ctx.shadowBlur = 0;
  }

  // 2. 페이즈 안내 가이드
  const guide = hudLayer.getLocomotionGuide(locomotionModal.selectedMode);
  const isCenter = beatCoordinator.phase === 'REST_READY';
  const isRetry = beatCoordinator.centerReturnGate.isRetrying;
  const title = isRetry
    ? '⏳ 위치 안정화 연장 대기 중...'
    : isCenter
    ? '🌟 중앙으로 복귀하여 기준점을 맞춰주세요!'
    : guide.title;
  const subtitle = isCenter
    ? '네온 게이트 중앙에 서서 잠시 멈추세요 (8박 기준점 잠금)'
    : guide.subtitle;

  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = isCenter ? '#28E6FF' : '#FFCB4D';
  ctx.shadowColor = isCenter ? '#28E6FF' : '#FFCB4D';
  ctx.shadowBlur = 24;
  ctx.fillText(title, cx, cy - 60);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#DDDDDD';
  ctx.fillText(subtitle, cx, cy - 5);

  // 3. 8박 진행 인디케이터 (원형 비트 점)
  const completedExerciseBeats = beatCoordinator.completedExerciseBeats;
  const dotRadius = 14 * scaleX;
  const dotGap = 44 * scaleX;
  const startX = cx - (7 * dotGap) / 2;
  const dotY = cy + 55;

  for (let i = 0; i < 8; i++) {
    const bx = startX + i * dotGap;
    ctx.beginPath();
    ctx.arc(bx, dotY, dotRadius, 0, Math.PI * 2);
    if (i < completedExerciseBeats) {
      ctx.fillStyle = i >= 5 ? '#28E6FF' : '#FFCB4D';
      ctx.shadowColor = i >= 5 ? '#28E6FF' : '#FFCB4D';
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = `bold ${Math.round(16 * scaleX)}px sans-serif`;
    ctx.fillStyle = i < completedExerciseBeats ? '#000000' : 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`${i + 1}`, bx, dotY);
  }

  // 4. 걸음 수 표시
  const countUnit = locomotionModal.selectedMode === 'run' ? '보' : '회';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#4DFFAA';
  ctx.fillText(`${guide.countLabel}: ${totalSteps}${countUnit}`, cx, dotY + 60);

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

// ─── 양손 모으기(합장) 커서 렌더링 헬퍼 (Issue #119, #134, #169) ───
function renderJoinedHandsCursor(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  label: string,
  progress: number = 0,
): void {
  if (!menuInput.isActive) return;
  const mx = menuInput.cursorX * vw;
  const my = menuInput.cursorY * vh;

  ctx.save();
  ctx.shadowColor = '#FFCB4D';
  ctx.shadowBlur = 15;

  // 외곽 합장 네온 링 (시인성 강화 펄스)
  const pulse = Math.sin(Date.now() / 150) * 4;
  ctx.strokeStyle = '#FFCB4D';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(mx, my, 34 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // 텍스트 라벨
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mx, my);

  // 0.8초 호버 체류 프로그레스 아크
  if (progress > 0) {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    ctx.strokeStyle = '#4DFFAA';
    ctx.lineWidth = 7;
    ctx.shadowColor = '#4DFFAA';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(mx, my, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clampedProgress);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── 게임 엔진 ───
const engine = new GameEngine({
  update(dt: number): void {
    // Issue #140: 전 장면(메뉴·달리기·문제·결과) 커서 펄스 타이머 상시 갱신
    answerSelectionRenderer.update(dt);
    magicCircleRenderer.update(dt);
    postureGuideRenderer.update(dt);
    tutorial.update(dt);

    // 웹캠 비디오 프레임 추출 및 스켈레톤 보간 파이프라인
    if (cameraLayer.isActive && cameraLayer.videoElement) {
      poseManager.send(cameraLayer.videoElement, performance.now()).catch(() => {});
    }
    if (poseManager.hasPose) {
      skeletonAnimation.update(dt, poseManager.virtualLandmarks);

      // Issue #140: 모든 장면(메뉴·달리기·문제·결과)에서 4색 커서가 상시 유지되도록 매 프레임 커서 트래커 갱신
      const sourceLandmarks =
        skeletonAnimation.smoothedLandmarks.length >= 25
          ? skeletonAnimation.smoothedLandmarks
          : poseManager.virtualLandmarks;
      if (sourceLandmarks.length >= 25) {
        answerSelector.cursorTracker.update(
          sourceLandmarks,
          undefined,
          false,
          { isVirtual: true, virtualWidth: canvasManager.virtualWidth, virtualHeight: canvasManager.virtualHeight },
        );
      }

      // Issue #171 & #172: X자 교차 제스처 갱신 (서브메뉴 뒤로가기 & 인게임 일시정지)
      if (sourceLandmarks.length >= 17) {
        const xResult = xGestureDetector.update(sourceLandmarks, dt);
        if (xResult.triggered) {
          if (screenMode === 'menu' && menuMode === 'sub') {
            selectSubLevel(-1);
          } else if (screenMode === 'game') {
            pauseModal.toggle();
            sfx.play('hover');
          }
        }
      }

      const time = performance.now() / 1000;
      const activeDetector = getActiveLocomotionDetector();
      const stepped = activeDetector.update(
        poseManager.virtualLandmarks,
        canvasManager.virtualHeight * 0.28,
        time,
        canvasManager.virtualHeight,
      );
      if (stepped && screenMode === 'game' && gamePhase === 'running' && !pauseModal.isOpen) {
        totalSteps++;
        beatCoordinator.recordStep();
        effectManager.playBurst({
          x: canvasManager.virtualWidth * 0.5,
          y: canvasManager.virtualHeight * 0.65,
          count: 8,
          colors: ['#28E6FF', '#4DFFAA'],
          duration: 0.3,
        });
      }
    } else {
      skeletonAnimation.reset();
      Object.values(locomotionDetectors).forEach((d) => d.reset());
      menuInput.reset();
      xGestureDetector.reset();
      menuHoverItem = null;
      menuHoverTimer = 0;
    }

    const vw = canvasManager.virtualWidth;
    const vh = canvasManager.virtualHeight;
    const leftHand = answerSelector.cursorTracker.getCursor('leftHand');
    const rightHand = answerSelector.cursorTracker.getCursor('rightHand');

    // Issue #169 & #172: 전 화면(menu, game, result) 공통 매 프레임 양손 합장 제스처 갱신 및 문제선택/모달 일시정지 동기화
    if (leftHand && rightHand) {
      menuInput.update(leftHand.x, leftHand.y, rightHand.x, rightHand.y);
    } else {
      menuInput.reset();
    }
    answerSelector.paused = menuInput.isActive || pauseModal.isOpen;

    let hoverTarget: { x: number; y: number } | null = null;

    if (menuInput.isActive) {
      hoverTarget = { x: menuInput.cursorX * vw, y: menuInput.cursorY * vh };
    } else if (leftHand || rightHand) {
      if (leftHand && rightHand) {
        hoverTarget = leftHand.y > rightHand.y
          ? { x: leftHand.x, y: leftHand.y }
          : { x: rightHand.x, y: rightHand.y };
      } else if (leftHand) {
        hoverTarget = { x: leftHand.x, y: leftHand.y };
      } else if (rightHand) {
        hoverTarget = { x: rightHand.x, y: rightHand.y };
      }
    }

    // Issue #172: 일시정지 모달 호버(0.8초) 판정
    if (pauseModal.isOpen) {
      if (hoverTarget) {
        const pauseRes = pauseModal.updateHover(hoverTarget.x, hoverTarget.y, vw, vh, dt);
        if (pauseRes.action === 'resume') {
          pauseModal.close();
          sfx.play('correct');
        } else if (pauseRes.action === 'quit') {
          pauseModal.close();
          goToMenu();
          sfx.play('hover');
        }
      }
    } else if (locomotionModal.isOpen) {
      if (hoverTarget) {
        const hoverRes = locomotionModal.updateHover(hoverTarget.x, hoverTarget.y, vw, vh, dt);
        if (hoverRes.modeSelected) {
          sfx.play('correct');
          updateLocomotionLabel();
        }
      }
    } else if (!settingsModal.isOpen && !tutorial.isVisible) {
      if (hoverTarget) {
        if (bottomBar.hitTestSettings(hoverTarget.x, hoverTarget.y, vw, vh, 15)) {
          settingsHoverTimer += dt;
          if (settingsHoverTimer >= MENU_HOVER_DWELL_TIME) {
            settingsModal.open();
            sfx.play('hover');
            settingsHoverTimer = 0;
          }
        } else {
          settingsHoverTimer = Math.max(0, settingsHoverTimer - dt * 2);
        }

        const customSlot = (screenMode === 'menu' && menuMode === 'sub')
          ? { x: 780, y: 1990, w: 270, h: 140 }
          : undefined;
        const hasAction = (screenMode === 'menu' && menuMode === 'sub') || screenMode === 'game' || screenMode === 'result';

        if (hasAction && bottomBar.hitTestAction(hoverTarget.x, hoverTarget.y, vw, vh, 15, customSlot)) {
          actionHoverTimer += dt;
          if (actionHoverTimer >= MENU_HOVER_DWELL_TIME) {
            actionHoverTimer = 0;
            if (screenMode === 'menu' && menuMode === 'sub') {
              selectSubLevel(-1);
            } else if (screenMode === 'game') {
              pauseModal.open();
              sfx.play('hover');
            } else if (screenMode === 'result') {
              goToMenu();
            }
          }
        } else {
          actionHoverTimer = Math.max(0, actionHoverTimer - dt * 2);
        }
      } else {
        settingsHoverTimer = 0;
        actionHoverTimer = 0;
      }
    } else {
      settingsHoverTimer = 0;
      actionHoverTimer = 0;
    }

    if (screenMode === 'menu') {
      dreamGrid.update(dt, 0.8);
      effectManager.update(dt);

      // Issue #119 & Issue #133: 메뉴 선택 판정 (양손 모으기 우선)
      let activeTargetPos: { x: number; y: number } | null = null;
      if (menuInput.isActive) {
        activeTargetPos = { x: menuInput.cursorX, y: menuInput.cursorY };
      }

      if (activeTargetPos) {
        const vw = canvasManager.virtualWidth;
        const vh = canvasManager.virtualHeight;
        const mx = activeTargetPos.x * vw;
        const my = activeTargetPos.y * vh;
        // Issue #133: 호버 중일 때는 히스테리시스 패딩(+24px), 미호버 시에는 기본 패딩(+12px) 적용
        const hitPadding = menuHoverItem ? 24 : 12;

        if (menuMode === 'main') {
          const hitCh = menuRenderer.hitTest(mx, my, vw, vh, hitPadding);
          if (hitCh > 0 && hitCh <= unlockedChapter) {
            if (menuHoverItem?.type === 'chapter' && menuHoverItem.id === hitCh) {
              menuHoverTimer += dt;
              if (menuHoverTimer >= MENU_HOVER_DWELL_TIME) {
                selectChapter(hitCh);
              }
            } else {
              menuHoverItem = { type: 'chapter', id: hitCh };
              menuHoverTimer = 0;
            }
          } else {
            menuHoverItem = null;
            menuHoverTimer = 0;
          }
        } else {
          const subLevels = questionBank.getSubLevels(selectedChapter);
          const hitSub = menuRenderer.hitTestSub(mx, my, vw, vh, selectedChapter, subLevels, hitPadding);
          if (hitSub !== null) {
            if (menuHoverItem?.type === 'sublevel' && menuHoverItem.id === hitSub) {
              menuHoverTimer += dt;
              if (menuHoverTimer >= MENU_HOVER_DWELL_TIME) {
                selectSubLevel(hitSub);
              }
            } else {
              menuHoverItem = { type: 'sublevel', id: hitSub };
              menuHoverTimer = 0;
            }
          } else {
            menuHoverItem = null;
            menuHoverTimer = 0;
          }
        }
      } else {
        menuInput.reset();
        menuHoverItem = null;
        menuHoverTimer = 0;
      }
      return;
    }

    if (screenMode === 'result') {
      dreamGrid.update(dt, 0.8);
      effectManager.update(dt);

      // Issue #134: 결과 화면 양손 모으기(합장) 0.8초 체류 시 메뉴 자동 복귀
      if (menuInput.isActive) {
        resultReturnTimer += dt;
        if (resultReturnTimer >= MENU_HOVER_DWELL_TIME) {
          resultReturnTimer = 0;
          goToMenu();
        }
      } else {
        resultReturnTimer = 0;
      }
      return;
    }

    if (screenMode !== 'game' || pauseModal.isOpen) {
      starCollectionInput.setPaused(true);
      dreamGrid.update(dt, 0.8);
      effectManager.update(dt);
      sfx.stopDwellCharge();
      return;
    }
    starCollectionInput.setPaused(false);

    // 드림 그리드 속도 및 8박 코디네이터 업데이트
    const isRunning = gamePhase === 'running';
    const speedMult = isRunning ? 2.5 : 0.8;
    dreamGrid.update(dt, speedMult);

    const sourceLandmarks =
      skeletonAnimation.smoothedLandmarks.length >= 25
        ? skeletonAnimation.smoothedLandmarks
        : poseManager.virtualLandmarks;

    // 무릎 프레이밍 및 가이드 업데이트 (Issue #198, #199, #206)
    currentKneeFraming = kneeFramingValidator.update(
      dt,
      sourceLandmarks,
      canvasManager.virtualWidth,
      canvasManager.virtualHeight,
    );
    kneeFramingGuideRenderer.update(dt);

    // 발 키노트 감지 (Issue #197, #206: degraded 프레이밍 시 Pose 입력 차단, 합장/정지 시 안전 가드)
    const isSafetyGuarded = menuInput.isActive || pauseModal.isOpen;
    footKeynoteInput.setSafetyGuarded(isSafetyGuarded);
    const footEvents = footKeynoteDetector.update(
      dt,
      sourceLandmarks,
      engine.elapsedTime,
      {
        isSafetyGuarded,
        isPoseInputAllowed: currentKneeFraming.isFootKeynotePoseInputAllowed,
      },
    );
    if (footEvents.length > 0) {
      console.log(`[DG] 발 키노트 감지: ${footEvents.map(e => e.zoneId).join(', ')}`);
    }

    // Issue #205: 가상 픽셀 좌표(0~1080 / 0~2160)를 정규화 좌표계(0~1)로 비파괴 변환하여 전달
    // CenterReturnGate와 AnswerZoneSelector가 정합성 있게 동작하도록 보장
    const normalizedLandmarks =
      sourceLandmarks.length >= 25
        ? toNormalizedLandmarks(
            sourceLandmarks,
            canvasManager.virtualWidth,
            canvasManager.virtualHeight,
          )
        : null;

    // Issue #200: 문제 페이즈(gamePhase === 'question')에서도 코디네이터에 시간(dt)을 지속 전달하여
    // 내부 8박 시계 및 라운드 정산(_resolveRound)이 멈추지 않도록 보장
    beatCoordinator.update(dt, normalizedLandmarks);
    currentQuestion = beatCoordinator.currentQuestion;

    // 2~8박 키노트 퍼포먼스 별 수집 판정 (Issue #206, #207 / StarCollectionInput 연동)
    if (beatCoordinator.phase === 'KEYNOTE_PERFORMANCE') {
      const beat = beatCoordinator.performanceBeat;
      if (beat >= 2 && beat <= 8) {
        const keynotes = beatCoordinator.keynotes;
        const keynote = keynotes[beat - 2];
        if (keynote && starCollectionInput.currentTarget?.beatIndex !== keynote.beat) {
          starCollectionInput.setTarget({
            patternId: keynote.patternId,
            part: keynote.part,
            cursorType: keynote.part,
            zoneId: keynote.zoneId,
            beatIndex: keynote.beat,
            landingTime: engine.elapsedTime + 0.25,
          });
        }

        if (starCollectionInput.currentTarget && !starCollectionInput.isCollected) {
          const starResult = starCollectionInput.update(engine.elapsedTime, sourceLandmarks);
          if (starResult) {
            beatRoundResolver.recordStarRating(starResult.rating);
            if (starResult.collected) {
              sfx.play('correct');
              const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === starResult.zoneId);
              if (targetZone) {
                effectManager.playBurst({
                  x: (targetZone.x + targetZone.width * 0.5) * canvasManager.virtualWidth,
                  y: (targetZone.y + targetZone.height * 0.5) * canvasManager.virtualHeight,
                  count: 8,
                  colors: ['#FFCB4D', '#FFFFFF'],
                  duration: 0.25,
                });
              }
            }
          }
        }
      }
    }

    // Issue #207: 1박째 정답 확정은 BeatRunCoordinator 내부의 AnswerZoneSelector가 전담 (이중 확정 경로 제거)
    // 체류 시간(Dwell Time) 누적 및 체류 충전음만 동기화
    if (gamePhase === 'question' && questionVisible && !answerLocked && beatCoordinator.isAnswerOpen) {
      if (menuInput.isActive) {
        // Issue #169: 합장 중에는 체류 충전 정지
        sfx.updateDwellCharge(0);
      } else {
        const zoneState = beatCoordinator.answerZoneSelector.state;
        if (zoneState.activeZone !== 'none') {
          totalDwellTime += dt;
        }
        sfx.updateDwellCharge(zoneState.dwellProgress);
      }
    } else {
      sfx.stopDwellCharge();
    }

    if (feedbackTimer > 0) feedbackTimer -= dt;
    if (castingFlash > 0) castingFlash -= dt;
    guardian.update(dt);
    bossRenderer.update(dt);
    effectManager.update(dt);
    boss.update(dt);

    hudLayer.update(dt, getHUDData());

    if (!battle.isAlive && screenMode === 'game') {
      showResult(false);
    }
  },

  render(): void {
    const ctx = canvasManager.ctx;
    const vw = canvasManager.virtualWidth;
    const vh = canvasManager.virtualHeight;

    // 1. 전체 화면 배경 클리어 (물리 캔버스 기준)
    canvasManager.resetTransform();
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 가상 좌표계 (1080 x 2160) 통일 적용
    canvasManager.applyVirtualTransform();

    // 3. 카메라 미러 피드 렌더링 (가상 해상도 기준 Cover 드로잉)
    if (cameraLayer.isActive) {
      cameraLayer.render(ctx, vw, vh);
    }

    // 4. 스켈레톤 시각화 (설정에서 활성화된 경우만 렌더링)
    if (settingsModal.skeletonEnabled && poseManager.hasPose && skeletonAnimation.smoothedLandmarks.length > 0) {
      boneRenderer.render(ctx, skeletonAnimation.smoothedLandmarks, 1);
      jointRenderer.render(ctx, skeletonAnimation.smoothedLandmarks, skeletonAnimation.breathScale);
    }

    // 5. 메뉴 / 인게임 / 결과 렌더링 (모두 vw, vh 가상 좌표계 기준으로 일관 드로잉)
    if (screenMode === 'menu') {
      dreamGrid.render(ctx, vw, vh, { alpha: 0.08, color: '#28E6FF', renderZoneConnections: false });
      if (menuMode === 'main') {
        const currentLoco = LOCOMOTION_MODES.find((m) => m.mode === locomotionModal.selectedMode);
        menuRenderer.render(ctx, vw, vh, {
          unlockedChapter,
          stars: starsMap,
          selectedChapter: menuHoverItem?.type === 'chapter' ? menuHoverItem.id : 0,
          locomotionLabel: currentLoco?.label,
          locomotionIcon: currentLoco?.icon,
        });
      } else {
        const subLevels = questionBank.getSubLevels(selectedChapter);
        menuRenderer.renderSubMenu(
          ctx,
          vw,
          vh,
          selectedChapter,
          subLevels,
          menuHoverItem?.type === 'sublevel' ? menuHoverItem.id : selectedSubLevel,
        );
      }

      // 카메라 상태 안내 오버레이 (대기 중 또는 권한 거부 시 안내)
      if (cameraLayer.status === 'requesting') {
        ctx.fillStyle = '#28E6FF';
        ctx.font = `bold 28px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('📷 카메라 권한 요청 중... 브라우저에서 허용을 눌러주세요', vw / 2, vh * 0.88);
      } else if (cameraLayer.status === 'denied') {
        ctx.fillStyle = '#FF8844';
        ctx.font = `bold 26px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ 카메라 권한 차단됨 (1~5번 키 또는 화면 클릭으로 플레이 가능)', vw / 2, vh * 0.88);
      }
      effectManager.render(ctx);
    } else if (screenMode === 'game') {
      const bossX = vw * 0.5;
      const bossY = vh * 0.24;
      const bossRadius = Math.min(180, vw * 0.12);

      let gridColor = CHAPTER_COLORS[currentChapter] || '#28E6FF';
      if (gamePhase === 'running') {
        gridColor = beatCoordinator.phase === 'REST_READY' ? '#28E6FF' : '#FF8844';
      }

      dreamGrid.render(ctx, vw, vh, {
        vanishingX: bossX,
        vanishingY: bossY,
        color: gridColor,
      });
      bossRenderer.render(ctx, currentChapter, bossX, bossY, bossRadius, boss.phase);
      hudLayer.render(ctx, vw, vh, getHUDData());

      if (gamePhase === 'running') {
        renderRunningPhase(ctx, vw, vh);
      } else {
        renderQuestion(ctx, vw, vh);
        renderFeedback(ctx, vw, vh);
      }

      effectManager.render(ctx);
    } else if (screenMode === 'result' && resultData) {
      resultRenderer.render(ctx, vw, vh, resultData);
      effectManager.render(ctx);
    }

    // 6. Issue #141: 공통 하단 고정 바 (Yellow Bar) 렌더링
    let actionLabel: string | undefined;
    let actionColor: string | undefined;
    let customActionSlot: BottomBarSlot | undefined;

    if (screenMode === 'menu') {
      if (menuMode === 'sub') {
        actionLabel = '← 뒤로';
        actionColor = '#28E6FF';
        customActionSlot = { x: 780, y: 1990, w: 270, h: 140 };
      }
    } else if (screenMode === 'game') {
      actionLabel = '정지';
      actionColor = '#FF4444';
    } else if (screenMode === 'result') {
      actionLabel = '메뉴로';
      actionColor = '#FFCB4D';
    }

    bottomBar.render(ctx, vw, vh, {
      actionLabel,
      actionColor,
      customActionSlot,
      settingsHoverProgress: settingsHoverTimer / MENU_HOVER_DWELL_TIME,
      actionHoverProgress: actionHoverTimer / MENU_HOVER_DWELL_TIME,
      mana: screenMode === 'game' ? battle.mana : undefined,
      manaMax: screenMode === 'game' ? DEFAULT_CONFIG.mana.spellCost : undefined,
      combo: screenMode === 'game' ? battle.combo : undefined,
    });

    // 7. Issue #141: 설정 모달 렌더링 (오버레이 및 팝업 카드)
    if (settingsModal.isOpen) {
      settingsModal.render(ctx, vw, vh);
    }

    // 7.5 Issue #154: 운동 모드(이동 방식 4종) 모달 렌더링
    if (locomotionModal.isOpen) {
      locomotionModal.render(ctx, vw, vh);
    }

    // 7.6 Issue #172: 일시정지 모달 렌더링
    if (pauseModal.isOpen) {
      pauseModal.render(ctx, vw, vh);
    }

    // 7.7 Issue #199 & #206: 무릎 프레이밍 가이드 렌더링
    if (screenMode === 'game') {
      kneeFramingGuideRenderer.render(ctx, vw, vh, currentKneeFraming);
    }

    // 7.8 Issue #159 & #160: 목표 자세 실루엣 가이드 오버레이 및 첫 문제 유도 화살표
    const isQuestionPhase = screenMode === 'game' && gamePhase === 'question' && questionVisible;
    const zoneState = beatCoordinator.answerZoneSelector.state;
    const currentChoiceProgress: [number, number] =
      isQuestionPhase && beatCoordinator.isAnswerOpen
        ? [
            zoneState.activeZone === 'left' ? zoneState.dwellProgress : 0,
            zoneState.activeZone === 'right' ? zoneState.dwellProgress : 0,
          ]
        : [0, 0];

    if (isQuestionPhase && answerSelector.currentPlan) {
      postureGuideRenderer.renderFromPlan(
        ctx,
        vw,
        vh,
        answerSelector.currentPlan,
        currentChoiceProgress,
        null,
        answerSelector.cursorTracker.cursors,
        answerSelector.isFirstQuestion,
      );
    }

    // 8. Issue #140 & #141: 전 장면(메뉴·달리기·문제·결과) 4색 스켈레톤 커서 상시 지속 렌더링
    // (하단 바 및 모달 위에 상시 렌더링되어 호버/클릭 지원)
    if (answerSelector.cursorTracker.cursors.size > 0) {
      const activeZones = isQuestionPhase && answerSelector.currentPlan ? answerSelector.currentPlan.activeZones : [];

      // Issue #169: 합장 시 개별 손 커서(시안/노랑)를 숨기고 단일 금빛 합장 링으로 대체
      const renderCursors = new Map(answerSelector.cursorTracker.cursors.entries());
      if (menuInput.isActive) {
        renderCursors.delete('leftHand');
        renderCursors.delete('rightHand');
      }

      answerSelectionRenderer.render(
        ctx,
        vw,
        vh,
        activeZones,
        renderCursors,
        currentChoiceProgress,
      );
    }

    // 8.5 Issue #119, #134, #169, #172: 양손 모으기(합장) 활성화 시 전 화면 공통 금빛 합장 링 렌더링
    if (menuInput.isActive) {
      let label = '손모으기';
      let progress = 0;

      if (pauseModal.isOpen) {
        label = pauseModal.hoverAction === 'resume' ? '재개' : (pauseModal.hoverAction === 'quit' ? '나가기' : '선택');
        progress = pauseModal.hoverProgress;
      } else if (screenMode === 'menu') {
        label = menuHoverItem ? '선택' : (settingsHoverTimer > 0 ? '설정' : (actionHoverTimer > 0 ? '뒤로' : '손모으기'));
        progress = Math.max(menuHoverTimer, settingsHoverTimer, actionHoverTimer) / MENU_HOVER_DWELL_TIME;
      } else if (screenMode === 'game') {
        label = settingsHoverTimer > 0 ? '설정' : (actionHoverTimer > 0 ? '정지' : '손모으기');
        progress = Math.max(settingsHoverTimer, actionHoverTimer) / MENU_HOVER_DWELL_TIME;
      } else if (screenMode === 'result') {
        label = '메뉴복귀';
        progress = Math.max(resultReturnTimer, settingsHoverTimer, actionHoverTimer) / MENU_HOVER_DWELL_TIME;
      }

      renderJoinedHandsCursor(ctx, vw, vh, label, progress);
    }

    // 8.8 Issue #171 & #172: X자 제스처 진행 시 상단 비주얼 피드백 표시
    if (xGestureDetector.isCrossing && !xGestureDetector.inCooldown && !pauseModal.isOpen) {
      ctx.save();
      const cx = vw * 0.5;
      const cy = vh * 0.22;
      const prog = xGestureDetector.progress;

      ctx.fillStyle = 'rgba(10, 14, 26, 0.88)';
      ctx.strokeStyle = '#FF865E';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FF865E';
      ctx.shadowBlur = 16;
      if (ctx.roundRect) {
        ctx.roundRect(cx - 180, cy - 40, 360, 80, 24);
      } else {
        ctx.rect(cx - 180, cy - 40, 360, 80);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (screenMode === 'menu' && menuMode === 'sub') ? '✕ 홈으로 나가기...' : '⏸ 일시정지...';
      ctx.fillText(label, cx, cy - 6);

      const barW = 300 * prog;
      ctx.fillStyle = '#4DFFAA';
      if (ctx.roundRect) {
        ctx.roundRect(cx - 150, cy + 22, barW, 8, 4);
      } else {
        ctx.rect(cx - 150, cy + 22, barW, 8);
      }
      ctx.fill();
      ctx.restore();
    }

    // 9. Issue #137: 튜토리얼 인터랙티브 오버레이 렌더링
    if (tutorial.isVisible) {
      tutorial.render(ctx, vw, vh);
    }

    // 10. 가상 좌표계 복원
    canvasManager.resetTransform();
  },
});

// ─── 이벤트 ───
canvas.addEventListener('click', (e) => {
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
      sfx.play('correct');
    } else if (action === 'quit') {
      pauseModal.close();
      goToMenu();
      sfx.play('hover');
    } else if (action === 'backdrop') {
      pauseModal.close();
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
      if (settingsModal.soundEnabled) sfx.play('correct');
    }
    return;
  }

  // Issue #141: 공통 하단 바 클릭 (설정 버튼)
  if (bottomBar.hitTestSettings(x, y, vw, vh)) {
    settingsModal.open();
    sfx.play('hover');
    return;
  }

  // Issue #141: 공통 하단 바 클릭 (우측 액션 버튼)
  const customSlot = (screenMode === 'menu' && menuMode === 'sub')
    ? { x: 780, y: 1990, w: 270, h: 140 }
    : undefined;
  const hasAction = (screenMode === 'menu' && menuMode === 'sub') || screenMode === 'game' || screenMode === 'result';

  if (hasAction && bottomBar.hitTestAction(x, y, vw, vh, 0, customSlot)) {
    if (screenMode === 'menu' && menuMode === 'sub') {
      selectSubLevel(-1);
    } else if (screenMode === 'game') {
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
    if (gamePhase === 'running') {
      totalSteps++;
      beatCoordinator.recordStep();
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
    if (questionVisible && currentQuestion && !answerLocked) {
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

    // 가상 페달 (Zone 9, 10, 11) 터치/클릭 fallback
    const normX = x / vw;
    const normY = y / vh;
    if (normY >= 0.78 && normY <= 0.94) {
      let pedalZone: 9 | 10 | 11 | null = null;
      if (normX >= 0.04 && normX <= 0.30) pedalZone = 9;
      else if (normX >= 0.37 && normX <= 0.63) pedalZone = 10;
      else if (normX >= 0.70 && normX <= 0.96) pedalZone = 11;
      if (pedalZone) {
        footKeynoteInput.fromVirtualPedal(pedalZone, engine.elapsedTime);
      }
    }
  } else if (screenMode === 'result') {
    goToMenu();
  }
});

// ─── 키보드 단축키 ───
document.addEventListener('keydown', (e) => {
  // Issue #141 / #154 / #172: 모달 열림 상태 시 Escape 또는 P로 토글/닫기
  if (e.key === 'Escape' || e.code === 'KeyP') {
    if (pauseModal.isOpen) {
      pauseModal.close();
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
      pauseModal.open();
      sfx.play('hover');
      return;
    }
    if (screenMode === 'menu' && menuMode === 'sub') {
      selectSubLevel(-1);
      return;
    }
  }

  // Issue #137: 튜토리얼 스킵 지원
  if (tutorial.isVisible) {
    if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') {
      tutorial.nextStep();
      return;
    }
  }

  if (e.code === 'Space') {
    if (screenMode === 'game' && gamePhase === 'running') {
      totalSteps++;
      beatCoordinator.recordStep();
      effectManager.playBurst({
        x: canvasManager.virtualWidth * 0.5,
        y: canvasManager.virtualHeight * 0.65,
        count: 8,
        colors: ['#28E6FF', '#FFCB4D'],
        duration: 0.3,
      });
      currentQuestion = beatCoordinator.currentQuestion;
      return;
    } else if (screenMode === 'game' && beatCoordinator.phase === 'KEYNOTE_PERFORMANCE') {
      const starRes = starCollectionInput.fromKeyboard(engine.elapsedTime);
      if (starRes) {
        beatRoundResolver.recordStarRating(starRes.rating);
        if (starRes.collected) {
          sfx.play('correct');
        }
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
    // 발 키노트 키보드 fallback (Z: 왼발 9, X: 중앙발 10, V: 오른발 11)
    if (e.key === 'z' || e.key === 'Z') {
      footKeynoteInput.fromKeyboard('leftFoot', engine.elapsedTime);
    } else if (e.key === 'x' || e.key === 'X') {
      footKeynoteInput.fromKeyboard('centerFoot', engine.elapsedTime);
    } else if (e.key === 'v' || e.key === 'V') {
      footKeynoteInput.fromKeyboard('rightFoot', engine.elapsedTime);
    }

    if (questionVisible && !answerLocked && beatCoordinator.isAnswerOpen) {
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
});

window.addEventListener('resize', () => canvasManager.resize());

// ─── 부트스트랩 ───
async function bootstrap(): Promise<void> {
  console.log('[DG] v0.4 starting...');
  canvasManager.resize();
  console.log(`[DG] Canvas: ${canvas.width}x${canvas.height}`);
  await Promise.all([loadQuestions(), loadFitnessPatterns()]);

  // Issue #143: 3중 마법진 이미지 에셋 로드 및 AnswerSelectionRenderer 연결
  const magicCirclePaths = ['img/E_Pit_act1.png', 'img/E_Pit_act2.png', 'img/E_Pit_act3.png'];
  const magicImages = magicCirclePaths.map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
  Promise.all(magicImages.map((img) => new Promise<void>((resolve) => {
    if (img.complete) { resolve(); return; }
    img.onload = () => resolve();
    img.onerror = () => { console.warn(`[DG] 마법진 이미지 로드 실패: ${img.src}`); resolve(); };
  }))).then(() => {
    const loaded = magicImages.filter((img) => img.complete && img.naturalWidth > 0);
    if (loaded.length >= 3) {
      magicCircleRenderer.setImages(loaded);
      answerSelectionRenderer.setMagicCircle(magicCircleRenderer);
      console.log('[DG] 마법진 이미지 3종 로드 완료');
    } else {
      console.warn(`[DG] 마법진 이미지 ${loaded.length}/3 로드 (일부 누락 - 마법진 비활성)`);
    }
  });

  engine.start();
  // 첫 메뉴 화면부터 웹캠 피드 및 포즈 추적 즉시 시작
  ensureCameraStarted().catch(() => {});
  console.log('[DG] Ready! 챕터를 클릭하거나 1~5 키를 눌러 시작');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}
