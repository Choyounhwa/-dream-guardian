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
import { generateQuestion, type GeneratedQuestion } from './question/QuestionEvaluator.js';
import { QuestionSpeech } from './question/QuestionSpeech.js';
import { BattleState } from './game/BattleState.js';
import { BossController } from './game/BossController.js';
import { GuardianSystem } from './game/GuardianSystem.js';
import { HUDLayer } from './ui/HUDLayer.js';
import { MenuRenderer } from './ui/MenuRenderer.js';
import { ResultRenderer, calcStars } from './ui/ResultRenderer.js';
import type { ResultData } from './ui/ResultRenderer.js';
import { BossRenderer, DreamGrid, renderMath, AnswerSelectionRenderer, PartIconRenderer, MagicCircleRenderer } from './render/index.js';
import { EffectManager } from './effects/index.js';
import { RunDetector } from './motion/RunDetector.js';
import { AnswerSelector } from './input/AnswerSelector.js';
import { MenuInput } from './input/MenuInput.js';
import { SFXSynth } from './audio/SFXSynth.js';
import { TutorialOverlay } from './ui/TutorialOverlay.js';

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
const answerSelector = new AnswerSelector();
answerSelector.setViewport(
  canvasManager.virtualWidth,
  canvasManager.virtualHeight,
  (lm, vw, vh) => cameraLayer.landmarkToCanvas(lm, vw, vh),
);
const answerSelectionRenderer = new AnswerSelectionRenderer();
const magicCircleRenderer = new MagicCircleRenderer();
const menuInput = new MenuInput();
const sfx = new SFXSynth();
const tutorial = new TutorialOverlay();

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
let runGauge = 0;
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
  runGauge = 0;
  questionVisible = false;
  answerLocked = true;
  runDetector.reset();
  console.log('[DG] 달리기 페이즈 시작 (게이지 100% 도달 시 문제 출제)');
}

function startChapter(ch: number, subLevel?: number): void {
  if (ch < 1 || ch > 5) return;
  console.log(`[DG] Ch.${ch} SubLevel ${subLevel ?? 'ALL'} 시작`);
  currentChapter = ch;
  selectedSubLevel = subLevel;
  battle.reset();
  boss.reset(ch);
  guardian.reset();
  hudLayer.reset();
  questionBank.setLevel(ch, subLevel);
  feedbackTimer = 0;
  questionVisible = false;
  answerLocked = true;
  castingFlash = 0;
  totalSteps = 0;
  totalDwellTime = 0;
  screenMode = 'game';
  ensureCameraStarted().catch(() => {});

  // Issue #137: 첫 플레이 시 튜토리얼 자동 표시
  if (typeof localStorage !== 'undefined' && !localStorage.getItem('dream_guardian_tutorial_done')) {
    tutorial.show();
  }

  startRunningPhase();
}

function nextQuestion(): void {
  const record = questionBank.next();
  currentQuestion = generateQuestion(record);
  if (!currentQuestion) currentQuestion = generateQuestion(questionBank.next());
  if (!currentQuestion) {
    currentQuestion = { questionText: '3 + 5 = ?', correctAnswer: 8, wrongAnswer: 9, choices: [8, 9], correctIndex: 0 };
  }
  questionVisible = true;
  answerLocked = false;
  answerSelector.startQuestion(battle.totalQuestions + 1);
  console.log(`[DG] 문제: ${currentQuestion.questionText}`);
  speech.speak(currentQuestion.questionText);
}

function handleAnswer(idx: number): void {
  sfx.stopDwellCharge();
  if (screenMode !== 'game') return;
  if (!currentQuestion || !questionVisible || answerLocked) return;

  answerLocked = true; // 연속 입력 방지
  const correct = idx === currentQuestion.correctIndex;
  feedbackCorrect = correct;
  feedbackTimer = 0.8;
  questionVisible = false;

  console.log(`[DG] 답: ${idx} (${correct ? '정답' : '오답'})`);

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * 0.38 + 80;
  const btnW = Math.min(200, w * 0.16);
  const btnH = btnW * 0.55;
  const gap = 50;
  const bx = cx + (idx === 0 ? -(btnW + gap / 2) : gap / 2) + btnW / 2;
  const by = cy + btnH / 2;

  if (correct) {
    sfx.play('correct');
    effectManager.playPreset('correct', bx, by);
    battle.onCorrect();

    // Issue #146: 매 정답마다 기본 데미지(correctDamage: 1) 즉시 타격 및 피격 연출
    const baseDamage = DEFAULT_CONFIG.battle.correctDamage;
    boss.takeDamage(baseDamage);
    bossRenderer.triggerHit();
    console.log(`[DG] 정답 타격! 보스 HP: ${boss.hp}/${boss.maxHp}`);

    if (boss.isDefeated) {
      const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
      starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
      setTimeout(() => showResult(true), 600);
      return;
    }

    if (battle.trySpendMana()) {
      const dmg = guardian.cast();
      boss.takeDamage(dmg);
      bossRenderer.triggerHit();
      effectManager.playPreset('cast', w * 0.5, h * 0.24);
      castingFlash = 0.6;
      console.log(`[DG] 캐스팅! 보스 HP: ${boss.hp}/${boss.maxHp}`);

      if (boss.isDefeated) {
        const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
        starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
        setTimeout(() => showResult(true), 600);
        return;
      }
    }
  } else {
    sfx.play('wrong');
    effectManager.playPreset('wrong', bx, by);
    // Issue #147: 기습 타이머 제거 및 보스 공격을 오답 시 반격(-25 HP)으로 일원화
    boss.triggerAttack();
    bossRenderer.triggerAttack();
    effectManager.playPreset('wrong', canvasManager.virtualWidth * 0.5, canvasManager.virtualHeight * 0.5);
    battle.onWrong();
    console.log(`[DG] 오답 보스 반격! 플레이어 HP: ${battle.hp}/${battle.maxHp}`);

    if (!battle.isAlive) {
      setTimeout(() => showResult(false), 600);
      return;
    }
  }

  setTimeout(() => startRunningPhase(), 800);
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
    steps: totalSteps, squats: 0, jumps: 0,
    elapsedTime: 60,
    dwellTime: totalDwellTime,
  };
}

function goToMenu(): void {
  sfx.stopDwellCharge();
  console.log('[DG] 메뉴 복귀');
  screenMode = 'menu';
  menuMode = 'main';
}

// ─── 문제 렌더링 ───
function renderQuestion(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!currentQuestion || !questionVisible) return;

  const cx = w / 2;
  // Issue #121: 예약 밴드(RESERVED_BANDS.question, y: 0.24~0.40) 내부 중앙 배치
  const cy = h * 0.32;

  // 문제 텍스트 (직관적 수식 렌더러 적용: 가로 분수선, 지수, 루트, 빈칸 박스 - Issue #132: 1m 대형화)
  ctx.shadowColor = 'rgba(40,230,255,0.5)';
  ctx.shadowBlur = 20;
  const qFontSize = Math.min(64, w * 0.054);
  renderMath(ctx, currentQuestion.questionText, cx, cy, {
    fontSize: qFontSize,
    color: '#ffffff',
    align: 'center',
    placeholderColor: '#28E6FF',
    placeholderBgColor: 'rgba(40,230,255,0.18)',
    fractionLineColor: '#ffffff',
  });
  ctx.shadowBlur = 0;

  // 선택지 (Issue #121: 예약 밴드 내부, Issue #132: 버튼 및 폰트 대형화)
  const btnW = Math.min(240, w * 0.20);
  const btnH = Math.round(btnW * 0.58);
  const gap = 50;
  const btnY = h * 0.44;

  for (let i = 0; i < 2; i++) {
    const bx = cx + (i === 0 ? -(btnW + gap / 2) : gap / 2);
    const plan = answerSelector.currentPlan;
    const recipe = plan?.choices[i];

    // Issue #128: 요구 부위 색상 그라데이션 테두리
    if (recipe) {
      ctx.strokeStyle = PartIconRenderer.getRequirementGradient(ctx, recipe, bx, btnY, bx + btnW, btnY + btnH);
    } else {
      ctx.strokeStyle = '#FFCB4D';
    }
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(bx, btnY, btnW, btnH, 16);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,203,77,0.08)';
    ctx.fill();

    const choiceFontSize = Math.min(46, w * 0.040);
    renderMath(ctx, String(currentQuestion.choices[i]), bx + btnW / 2, btnY + btnH / 2, {
      fontSize: choiceFontSize,
      color: '#FFCB4D',
      align: 'center',
      fractionLineColor: '#FFCB4D',
      placeholderColor: '#FFCB4D',
    });

    // Issue #128: 답안 버튼 하단에 요구 부위 아이콘 및 묶음 기호(( )/|) 렌더링
    if (recipe) {
      const iconSize = Math.min(22, Math.max(16, w * 0.018));
      PartIconRenderer.drawRequirementGroup(ctx, recipe, bx + btnW / 2, btnY + btnH + 20, iconSize);
    }

    ctx.font = `bold ${Math.min(16, w * 0.014)}px sans-serif`;
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`키보드 [${i + 1}]`, bx + btnW / 2, btnY + btnH + 42);
  }
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

  const isFever = runGauge >= 75;
  const feverTitle = isFever ? '✨ FEVER! 수호신과 함께 질주!' : '제자리에서 달려 다음 문제로!';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillStyle = isFever ? '#28E6FF' : '#FFCB4D';
  ctx.shadowColor = isFever ? '#28E6FF' : '#FFCB4D';
  ctx.shadowBlur = 24;
  ctx.fillText(feverTitle, cx, cy - 74);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#DDDDDD';
  ctx.fillText('발을 구르거나 [Space] / 화면을 탭하세요', cx, cy - 15);

  // 게이지 바 외곽
  const barW = Math.min(540, vw * 0.72);
  const barH = 34;
  const barX = cx - barW / 2;
  const barY = cy + 30;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 17);
  ctx.fill();

  // 게이지 채우기
  const fillW = Math.max(0, barW * (runGauge / 100));
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    if (isFever) {
      grad.addColorStop(0, '#28E6FF');
      grad.addColorStop(1, '#4DFFAA');
    } else {
      grad.addColorStop(0, '#FF8844');
      grad.addColorStop(1, '#FFCB4D');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 17);
    ctx.fill();
  }

  ctx.strokeStyle = isFever ? '#28E6FF' : 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 17);
  ctx.stroke();

  // 게이지 수치 텍스트
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.round(runGauge)}%`, cx, barY + barH / 2);

  // 걸음 수 표시 (Issue #132: 32px 볼드 대형화)
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#4DFFAA';
  ctx.fillText(`🏃 걸음 수: ${totalSteps}보`, cx, barY + barH + 54);

  ctx.restore();
}

// ─── HUD 데이터 헬퍼 ───
function getHUDData() {
  return {
    playerHp: battle.hp,
    playerMaxHp: battle.maxHp,
    bossHp: boss.hp,
    bossMaxHp: boss.maxHp,
    mana: battle.mana,
    manaMax: DEFAULT_CONFIG.mana.spellCost,
    combo: battle.combo,
    chapter: currentChapter,
    shieldActive: false,
    guardianStage: guardian.stage,
  };
}

// ─── 게임 엔진 ───
const engine = new GameEngine({
  update(dt: number): void {
    // Issue #140: 전 장면(메뉴·달리기·문제·결과) 커서 펄스 타이머 상시 갱신
    answerSelectionRenderer.update(dt);
    magicCircleRenderer.update(dt);
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

      const time = performance.now() / 1000;
      const stepped = runDetector.update(
        poseManager.virtualLandmarks,
        canvasManager.virtualHeight * 0.28,
        time,
        canvasManager.virtualHeight,
      );
      if (stepped && screenMode === 'game' && gamePhase === 'running') {
        runGauge += 20;
        totalSteps++;
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
      runDetector.reset();
      menuInput.reset();
      menuHoverItem = null;
      menuHoverTimer = 0;
    }

    if (screenMode === 'menu') {
      dreamGrid.update(dt, 0.8);
      effectManager.update(dt);

      // Issue #119 & Issue #133: 메뉴 선택 판정 (양손 모으기 우선, 또는 손 뻗기 호버 지원 + 히스테리시스 20px 패딩)
      const leftHand = answerSelector.cursorTracker.getCursor('leftHand');
      const rightHand = answerSelector.cursorTracker.getCursor('rightHand');
      let activeTargetPos: { x: number; y: number } | null = null;

      if (leftHand && rightHand) {
        const menuResult = menuInput.update(leftHand.x, leftHand.y, rightHand.x, rightHand.y);
        if (menuResult.active) {
          activeTargetPos = { x: menuResult.x, y: menuResult.y };
        }
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
      const leftHand = answerSelector.cursorTracker.getCursor('leftHand');
      const rightHand = answerSelector.cursorTracker.getCursor('rightHand');
      if (leftHand && rightHand) {
        const menuResult = menuInput.update(leftHand.x, leftHand.y, rightHand.x, rightHand.y);
        if (menuResult.active) {
          resultReturnTimer += dt;
          if (resultReturnTimer >= MENU_HOVER_DWELL_TIME) {
            resultReturnTimer = 0;
            goToMenu();
          }
        } else {
          resultReturnTimer = 0;
        }
      } else {
        menuInput.reset();
        resultReturnTimer = 0;
      }
      return;
    }

    if (screenMode !== 'game') {
      dreamGrid.update(dt, 0.8);
      effectManager.update(dt);
      return;
    }

    // 드림 그리드 속도 및 달리기 게이지 업데이트
    const isRunning = gamePhase === 'running';
    const speedMult = isRunning ? 1.5 + (runGauge / 100) * 2.5 : 0.8;
    dreamGrid.update(dt, speedMult);

    if (isRunning) {
      // 제자리 달리기 유지 시 완만 지속 충전
      if (runDetector.isRunning) {
        runGauge += dt * 15;
      } else if (runGauge > 0) {
        // 정지 시 초당 4% 자연 감쇠
        runGauge = Math.max(0, runGauge - dt * 4);
      }

      if (runGauge >= 100) {
        runGauge = 100;
        gamePhase = 'question';
        nextQuestion();
      }
    } else if (gamePhase === 'question' && questionVisible && !answerLocked) {
      if (poseManager.hasPose) {
        // Issue #116: 스켈레톤 렌더링에 사용되는 보간 랜드마크(smoothedLandmarks)를 우선 사용하여
        // 스켈레톤 관절과 4색 커서 중심 좌표가 0px 오차로 1:1 일치하도록 동기화
        const sourceLandmarks =
          skeletonAnimation.smoothedLandmarks.length >= 25
            ? skeletonAnimation.smoothedLandmarks
            : poseManager.virtualLandmarks;

        if (sourceLandmarks.length >= 25) {
          const confirmed = answerSelector.updateFromPose(
            sourceLandmarks,
            undefined,
            dt,
            false, // virtualLandmarks 및 smoothedLandmarks는 이미 Cover 변환 및 미러링 완료됨
            { isVirtual: true, virtualWidth: canvasManager.virtualWidth, virtualHeight: canvasManager.virtualHeight },
          );

          // Issue #135: 자세 유지 시간(Dwell Time) 누적
          const maxProg = Math.max(answerSelector.choiceProgress[0], answerSelector.choiceProgress[1]);
          if (maxProg > 0) {
            totalDwellTime += dt;
          }

          // Issue #136: 체류 진행도(0~1)에 비례한 점진적 피치 상승 충전음
          sfx.updateDwellCharge(maxProg);

          if (confirmed) {
            handleAnswer(confirmed.confirmedIndex);
          }
        }
      }
    } else if (gamePhase !== 'question') {
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

    // 4. 스켈레톤 시각화 (수동 scale 불일치 제거 - 가상 좌표계 1:1 드로잉)
    if (poseManager.hasPose && skeletonAnimation.smoothedLandmarks.length > 0) {
      boneRenderer.render(ctx, skeletonAnimation.smoothedLandmarks, 1);
      jointRenderer.render(ctx, skeletonAnimation.smoothedLandmarks, skeletonAnimation.breathScale);
    }

    // 5. 메뉴 / 인게임 / 결과 렌더링 (모두 vw, vh 가상 좌표계 기준으로 일관 드로잉)
    if (screenMode === 'menu') {
      dreamGrid.render(ctx, vw, vh, { alpha: 0.08, color: '#28E6FF' });
      if (menuMode === 'main') {
        menuRenderer.render(ctx, vw, vh, {
          unlockedChapter,
          stars: starsMap,
          selectedChapter: menuHoverItem?.type === 'chapter' ? menuHoverItem.id : 0,
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

      // Issue #119: 양손 모으기(합장) 제스처 커서 및 0.8초 호버 체류 아크 렌더링
      if (menuInput.isActive) {
        const mx = menuInput.cursorX * vw;
        const my = menuInput.cursorY * vh;

        ctx.save();
        ctx.shadowColor = '#FFCB4D';
        ctx.shadowBlur = 15;

        // 외곽 합장 네온 링 (Issue #133: 시인성 대폭 강화)
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
        ctx.fillText('손모으기', mx, my);

        // 0.8초 호버 체류 프로그레스 아크 (Issue #133: 반경 50px, 두께 7px 대형화)
        if (menuHoverTimer > 0) {
          const progress = Math.min(1, menuHoverTimer / MENU_HOVER_DWELL_TIME);
          ctx.strokeStyle = '#4DFFAA';
          ctx.lineWidth = 7;
          ctx.shadowColor = '#4DFFAA';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(mx, my, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.stroke();
        }
        ctx.restore();
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
        gridColor = runGauge >= 75 ? '#28E6FF' : '#FF8844';
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

      // Issue #134: 결과 화면 합장 복귀 링 및 0.8초 프로그레스 아크 렌더링
      if (menuInput.isActive) {
        const mx = menuInput.cursorX * vw;
        const my = menuInput.cursorY * vh;

        ctx.save();
        ctx.shadowColor = '#FFCB4D';
        ctx.shadowBlur = 16;

        const pulse = Math.sin(Date.now() / 150) * 4;
        ctx.strokeStyle = '#FFCB4D';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(mx, my, 34 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('메뉴복귀', mx, my);

        if (resultReturnTimer > 0) {
          const progress = Math.min(1, resultReturnTimer / MENU_HOVER_DWELL_TIME);
          ctx.strokeStyle = '#4DFFAA';
          ctx.lineWidth = 7;
          ctx.shadowColor = '#4DFFAA';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(mx, my, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.stroke();
        }
        ctx.restore();
      }

      effectManager.render(ctx);
    }

    // 6. Issue #140: 전 장면(메뉴·달리기·문제·결과) 4색 스켈레톤 커서 상시 지속 렌더링
    // 문제 페이즈에서는 피트니스 존 및 진행도와 함께, 그 외 모든 장면에서는 순수 커서 상시 가시화
    if (answerSelector.cursorTracker.cursors.size > 0) {
      const isQuestionPhase = screenMode === 'game' && gamePhase === 'question' && questionVisible;
      const activeZones = isQuestionPhase && answerSelector.currentPlan ? answerSelector.currentPlan.activeZones : [];
      const choiceProgress: [number, number] = isQuestionPhase ? answerSelector.choiceProgress : [0, 0];

      answerSelectionRenderer.render(
        ctx,
        vw,
        vh,
        activeZones,
        answerSelector.cursorTracker.cursors,
        choiceProgress,
      );
    }

    // 7. Issue #137: 튜토리얼 인터랙티브 오버레이 렌더링
    if (tutorial.isVisible) {
      tutorial.render(ctx, vw, vh);
    }

    // 8. 가상 좌표계 복원
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

  if (screenMode === 'menu') {
    if (menuMode === 'main') {
      const ch = menuRenderer.hitTest(x, y, vw, vh);
      selectChapter(ch);
    } else {
      const subLevels = questionBank.getSubLevels(selectedChapter);
      const chosen = menuRenderer.hitTestSub(x, y, vw, vh, selectedChapter, subLevels);
      selectSubLevel(chosen);
    }
  } else if (screenMode === 'game') {
    if (gamePhase === 'running') {
      runGauge += 15;
      totalSteps++;
      effectManager.playBurst({
        x: vw * 0.5,
        y: vh * 0.65,
        count: 8,
        colors: ['#28E6FF', '#FFCB4D'],
        duration: 0.3,
      });
      if (runGauge >= 100) {
        runGauge = 100;
        gamePhase = 'question';
        nextQuestion();
      }
      return;
    }
    if (questionVisible && currentQuestion && !answerLocked) {
      const cx = vw / 2;
      const cy = vh * 0.38 + 80;
      const btnW = Math.min(200, vw * 0.16);
      const btnH = btnW * 0.55;
      const gap = 50;

      for (let i = 0; i < 2; i++) {
        const bx = cx + (i === 0 ? -(btnW + gap / 2) : gap / 2);
        if (x >= bx && x <= bx + btnW && y >= cy && y <= cy + btnH) {
          handleAnswer(i);
          break;
        }
      }
    }
  } else if (screenMode === 'result') {
    goToMenu();
  }
});

// ─── 상단 컨트롤 버튼 ───
const btnCam = document.getElementById('btn_cam');
if (btnCam) {
  btnCam.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cameraLayer.isActive) {
      cameraLayer.stop();
      btnCam.textContent = '🚫';
      btnCam.title = '카메라 켜기 (단축키: C)';
    } else {
      ensureCameraStarted().catch(() => {});
      btnCam.textContent = '📷';
      btnCam.title = '카메라 끄기 (단축키: C)';
    }
  });
}

const btnFullscreen = document.getElementById('btn_fullscreen');
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', (e) => {
    e.stopPropagation();
    const container = document.getElementById('container') || canvas;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

document.addEventListener('keydown', (e) => {
  // Issue #137: 튜토리얼 스킵 지원
  if (tutorial.isVisible) {
    if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') {
      tutorial.nextStep();
      return;
    }
  }

  if (e.code === 'Space') {
    if (screenMode === 'game' && gamePhase === 'running') {
      runGauge += 15;
      totalSteps++;
      effectManager.playBurst({
        x: canvasManager.virtualWidth * 0.5,
        y: canvasManager.virtualHeight * 0.65,
        count: 8,
        colors: ['#28E6FF', '#FFCB4D'],
        duration: 0.3,
      });
      if (runGauge >= 100) {
        runGauge = 100;
        gamePhase = 'question';
        nextQuestion();
      }
      return;
    }
  }

  if (e.key.toLowerCase() === 'c') {
    if (cameraLayer.isActive) {
      cameraLayer.stop();
      if (btnCam) {
        btnCam.textContent = '🚫';
        btnCam.title = '카메라 켜기 (단축키: C)';
      }
    } else {
      ensureCameraStarted().catch(() => {});
      if (btnCam) {
        btnCam.textContent = '📷';
        btnCam.title = '카메라 끄기 (단축키: C)';
      }
    }
  }

  if (screenMode === 'game') {
    if (e.key === '1') handleAnswer(0);
    if (e.key === '2') handleAnswer(1);
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
  await loadQuestions();

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
