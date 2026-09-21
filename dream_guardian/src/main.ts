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
import { BossRenderer, DreamGrid } from './render/index.js';
import { EffectManager } from './effects/index.js';

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
const boneRenderer = new BoneRenderer();
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

// ─── 게임 상태 (FSM 대신 단순 변수 관리) ───
type ScreenMode = 'menu' | 'game' | 'result';
let screenMode: ScreenMode = 'menu';
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
function startChapter(ch: number): void {
  if (ch < 1 || ch > 5) return;
  console.log(`[DG] Ch.${ch} 시작`);
  currentChapter = ch;
  battle.reset();
  boss.reset(ch);
  guardian.reset();
  hudLayer.reset();
  questionBank.setLevel(ch);
  feedbackTimer = 0;
  questionVisible = false;
  answerLocked = false;
  castingFlash = 0;
  screenMode = 'game';
  ensureCameraStarted().catch(() => {});
  nextQuestion();
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
  console.log(`[DG] 문제: ${currentQuestion.questionText}`);
  speech.speak(currentQuestion.questionText);
}

function handleAnswer(idx: number): void {
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
    effectManager.playPreset('correct', bx, by);
    battle.onCorrect();

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
    effectManager.playPreset('wrong', bx, by);
    battle.onWrong();
    console.log(`[DG] HP: ${battle.hp}/${battle.maxHp}`);

    if (!battle.isAlive) {
      setTimeout(() => showResult(false), 600);
      return;
    }
  }

  setTimeout(() => nextQuestion(), 800);
}

function showResult(victory: boolean): void {
  console.log(`[DG] ${victory ? '승리' : '패배'}`);
  screenMode = 'result';
  resultData = {
    victory,
    chapter: currentChapter,
    correctCount: battle.correctCount,
    totalQuestions: battle.totalQuestions,
    maxCombo: battle.maxCombo,
    steps: 0, squats: 0, jumps: 0,
    elapsedTime: 60,
  };
}

function goToMenu(): void {
  console.log('[DG] 메뉴 복귀');
  screenMode = 'menu';
}

// ─── 문제 렌더링 ───
function renderQuestion(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!currentQuestion || !questionVisible) return;

  const cx = w / 2;
  const cy = h * 0.38;

  // 문제 텍스트
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(48, w * 0.04)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(40,230,255,0.5)';
  ctx.shadowBlur = 20;
  ctx.fillText(currentQuestion.questionText, cx, cy);
  ctx.shadowBlur = 0;

  // 선택지
  const btnW = Math.min(200, w * 0.16);
  const btnH = btnW * 0.55;
  const gap = 50;
  const btnY = cy + 80;

  for (let i = 0; i < 2; i++) {
    const bx = cx + (i === 0 ? -(btnW + gap / 2) : gap / 2);

    ctx.strokeStyle = '#FFCB4D';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, btnY, btnW, btnH, 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,203,77,0.08)';
    ctx.fill();

    ctx.fillStyle = '#FFCB4D';
    ctx.font = `bold ${Math.min(40, w * 0.035)}px sans-serif`;
    ctx.fillText(String(currentQuestion.choices[i]), bx + btnW / 2, btnY + btnH / 2);

    ctx.font = `${Math.min(14, w * 0.012)}px sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText(`키보드 [${i + 1}]`, bx + btnW / 2, btnY + btnH + 20);
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
  ctx.font = `bold ${Math.min(64, w * 0.055)}px sans-serif`;
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
    // 웹캠 비디오 프레임 추출 및 스켈레톤 보간 파이프라인
    if (cameraLayer.isActive && cameraLayer.videoElement) {
      poseManager.send(cameraLayer.videoElement, performance.now()).catch(() => {});
    }
    if (poseManager.hasPose) {
      skeletonAnimation.update(dt, poseManager.virtualLandmarks);
    } else {
      skeletonAnimation.reset();
    }

    if (screenMode !== 'game') {
      effectManager.update(dt);
      return;
    }

    if (feedbackTimer > 0) feedbackTimer -= dt;
    if (castingFlash > 0) castingFlash -= dt;
    guardian.update(dt);
    dreamGrid.update(dt);
    bossRenderer.update(dt);
    effectManager.update(dt);

    const attacked = boss.update(dt);
    if (attacked) {
      bossRenderer.triggerAttack();
      effectManager.playPreset('wrong', canvas.width / 2, canvas.height * 0.5);
      const dmg = boss.resolveAttack(false);
      if (dmg > 0) battle.onBossAttack();
    }

    hudLayer.update(dt, getHUDData());

    if (!battle.isAlive && screenMode === 'game') {
      showResult(false);
    }
  },

  render(): void {
    const ctx = canvasManager.ctx;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // 카메라 미러 피드 렌더링 (활성화 시 35% 디밍 포함)
    if (cameraLayer.isActive) {
      cameraLayer.render(ctx, w, h);
    }

    // 스켈레톤 시각화 (포즈 인식 시 메뉴 및 인게임 전체에서 렌더링)
    if (poseManager.hasPose && skeletonAnimation.smoothedLandmarks.length > 0) {
      const scaleX = w / canvasManager.virtualWidth;
      const scaleY = h / canvasManager.virtualHeight;
      ctx.save();
      ctx.scale(scaleX, scaleY);
      boneRenderer.render(ctx, skeletonAnimation.smoothedLandmarks, 1);
      jointRenderer.render(ctx, skeletonAnimation.smoothedLandmarks, skeletonAnimation.breathScale);
      ctx.restore();
    }

    if (screenMode === 'menu') {
      dreamGrid.render(ctx, w, h, { alpha: 0.08, color: '#28E6FF' });
      menuRenderer.render(ctx, w, h, {
        unlockedChapter,
        stars: starsMap,
        selectedChapter: 0,
      });

      // 카메라 상태 안내 오버레이 (대기 중 또는 권한 거부 시 안내)
      if (cameraLayer.status === 'requesting') {
        ctx.fillStyle = '#28E6FF';
        ctx.font = `bold ${Math.min(16, w * 0.028)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('📷 카메라 권한 요청 중... 브라우저에서 허용을 눌러주세요', w / 2, h * 0.88);
      } else if (cameraLayer.status === 'denied') {
        ctx.fillStyle = '#FF8844';
        ctx.font = `bold ${Math.min(15, w * 0.026)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ 카메라 권한 차단됨 (1~5번 키 또는 화면 클릭으로 플레이 가능)', w / 2, h * 0.88);
      }
      effectManager.render(ctx);
    } else if (screenMode === 'game') {
      const bossX = w * 0.5;
      const bossY = h * 0.24;
      const bossRadius = Math.min(85, w * 0.08);

      dreamGrid.render(ctx, w, h, {
        vanishingX: bossX,
        vanishingY: bossY,
        color: CHAPTER_COLORS[currentChapter] || '#28E6FF',
      });
      bossRenderer.render(ctx, currentChapter, bossX, bossY, bossRadius, boss.phase);
      hudLayer.render(ctx, w, h, getHUDData());
      renderQuestion(ctx, w, h);
      renderFeedback(ctx, w, h);
      effectManager.render(ctx);
    } else if (screenMode === 'result' && resultData) {
      resultRenderer.render(ctx, w, h, resultData);
      effectManager.render(ctx);
    }
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
  const x = (e.clientX - rect.left) / rect.width * canvas.width;
  const y = (e.clientY - rect.top) / rect.height * canvas.height;

  if (screenMode === 'menu') {
    const ch = menuRenderer.hitTest(x, y, canvas.width, canvas.height);
    if (ch > 0 && ch <= unlockedChapter) startChapter(ch);
  } else if (screenMode === 'game' && questionVisible && currentQuestion && !answerLocked) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.38 + 80;
    const btnW = Math.min(200, w * 0.16);
    const btnH = btnW * 0.55;
    const gap = 50;

    for (let i = 0; i < 2; i++) {
      const bx = cx + (i === 0 ? -(btnW + gap / 2) : gap / 2);
      if (x >= bx && x <= bx + btnW && y >= cy && y <= cy + btnH) {
        handleAnswer(i);
        break;
      }
    }
  } else if (screenMode === 'result') {
    goToMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'c') {
    if (cameraLayer.isActive) {
      cameraLayer.stop();
    } else {
      ensureCameraStarted().catch(() => {});
    }
  }

  if (screenMode === 'game') {
    if (e.key === '1') handleAnswer(0);
    if (e.key === '2') handleAnswer(1);
  } else if (screenMode === 'menu') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 5 && n <= unlockedChapter) startChapter(n);
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
