/**
 * Dream Guardian - 메인 진입점
 * Phase 0~6 시스템 통합: 코어 엔진 + 문제 + 전투 + Canvas HUD
 */

import { DEFAULT_CONFIG } from './core/Config.js';
import { GameEngine } from './core/GameEngine.js';
import { CanvasManager } from './render/CanvasManager.js';
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
const questionBank = new QuestionBank();
const speech = new QuestionSpeech();
const battle = new BattleState();
const boss = new BossController(1);
const guardian = new GuardianSystem();
const hudLayer = new HUDLayer();
const menuRenderer = new MenuRenderer();
const resultRenderer = new ResultRenderer();

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
let gridOffset = 0;
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

  if (correct) {
    battle.onCorrect();

    if (battle.trySpendMana()) {
      const dmg = guardian.cast();
      boss.takeDamage(dmg);
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

// ─── 드림 그리드 ───
function renderDreamGrid(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void {
  gridOffset = (gridOffset + dt * 60) % 80;
  const color = CHAPTER_COLORS[currentChapter] || '#28E6FF';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  const vanishY = h * 0.38;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = vanishY + (h - vanishY) * t;
    const sp = t * 0.6;
    ctx.beginPath();
    ctx.moveTo(w * (0.5 - sp), y);
    ctx.lineTo(w * (0.5 + sp), y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, vanishY);
    ctx.lineTo(w * 0.5 + i * 80, h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
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
    if (screenMode !== 'game') return;

    if (feedbackTimer > 0) feedbackTimer -= dt;
    if (castingFlash > 0) castingFlash -= dt;
    guardian.update(dt);

    const attacked = boss.update(dt);
    if (attacked) {
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

    if (screenMode === 'menu') {
      menuRenderer.render(ctx, w, h, {
        unlockedChapter,
        stars: starsMap,
        selectedChapter: 0,
      });
    } else if (screenMode === 'game') {
      renderDreamGrid(ctx, w, h, 0.016);
      hudLayer.render(ctx, w, h, getHUDData());
      renderQuestion(ctx, w, h);
      renderFeedback(ctx, w, h);
    } else if (screenMode === 'result' && resultData) {
      resultRenderer.render(ctx, w, h, resultData);
    }
  },
});

// ─── 이벤트 ───
canvas.addEventListener('click', (e) => {
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
  console.log('[DG] Ready! 챕터를 클릭하거나 1~5 키를 눌러 시작');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}
