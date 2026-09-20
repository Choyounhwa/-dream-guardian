/**
 * Dream Guardian - 메인 진입점
 * Phase 0~6 시스템 통합: 코어 엔진 + 문제 + 전투 + Canvas HUD
 */

import { DEFAULT_CONFIG } from './core/Config.js';
import { GameEngine } from './core/GameEngine.js';
import { StateMachine } from './core/StateMachine.js';
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

// ─── DOM ───
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// ─── 시스템 ───
const canvasManager = new CanvasManager(canvas);
const stateMachine = new StateMachine('MENU_MAIN');
const questionBank = new QuestionBank();
const speech = new QuestionSpeech();
const battle = new BattleState();
const boss = new BossController(1);
const guardian = new GuardianSystem();
const hudLayer = new HUDLayer();
const menuRenderer = new MenuRenderer();
const resultRenderer = new ResultRenderer();

// ─── 게임 상태 ───
type ScreenMode = 'menu' | 'game' | 'result';
let screenMode: ScreenMode = 'menu';
let currentChapter = 1;
let currentQuestion: GeneratedQuestion | null = null;
let feedbackTimer = 0;
let feedbackCorrect = false;
let questionVisible = false;
let resultData: ResultData | null = null;
let unlockedChapter = 5; // 데모에서는 전부 해금
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
      console.log(`[DreamGuardian] ${records.length}개 문제 로드`);
    } else { questionBank.loadRecords([]); }
  } catch { questionBank.loadRecords([]); }
}

// ─── 게임 플로우 ───
function startChapter(ch: number): void {
  if (ch < 1 || ch > 5) return;
  currentChapter = ch;
  battle.reset();
  boss.reset(ch);
  guardian.reset();
  hudLayer.reset();
  questionBank.setLevel(ch);
  feedbackTimer = 0;
  questionVisible = false;
  castingFlash = 0;
  screenMode = 'game';

  stateMachine.changeState('MENU_MAIN');
  stateMachine.changeState('MENU_SUB');
  stateMachine.changeState('STORY_INTRO');
  stateMachine.changeState('READY_POSITION');
  stateMachine.changeState('RUNNING');
  stateMachine.changeState('PLAYING');

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
  speech.speak(currentQuestion.questionText);
}

function handleAnswer(idx: number): void {
  if (!currentQuestion || !questionVisible) return;
  if (stateMachine.currentState !== 'PLAYING') return;

  const correct = idx === currentQuestion.correctIndex;
  feedbackCorrect = correct;
  feedbackTimer = 0.8;
  questionVisible = false;

  if (correct) {
    battle.onCorrect();
    stateMachine.changeState('CORRECT');

    if (battle.trySpendMana()) {
      const dmg = guardian.cast();
      boss.takeDamage(dmg);
      castingFlash = 0.6;
      stateMachine.changeState('GUARDIAN_CAST');

      if (boss.isDefeated) {
        const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
        starsMap[currentChapter] = Math.max(starsMap[currentChapter] ?? 0, stars);
        setTimeout(() => showResult(true), 600);
        return;
      }
      stateMachine.changeState('RUNNING');
      stateMachine.changeState('PLAYING');
    } else {
      stateMachine.changeState('RUNNING');
      stateMachine.changeState('PLAYING');
    }
  } else {
    battle.onWrong();
    stateMachine.changeState('WRONG');

    if (!battle.isAlive) {
      setTimeout(() => showResult(false), 600);
      return;
    }
    stateMachine.changeState('RUNNING');
    stateMachine.changeState('PLAYING');
  }

  setTimeout(() => nextQuestion(), 700);
}

function showResult(victory: boolean): void {
  screenMode = 'result';
  stateMachine.changeState(victory ? 'RESULT' : 'GAMEOVER');
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
  screenMode = 'menu';
  stateMachine.changeState('MENU_MAIN');
}

// ─── 드림 그리드 ───
function renderDreamGrid(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void {
  gridOffset = (gridOffset + dt * 60) % 80;
  const color = CHAPTER_COLORS[currentChapter] || '#28E6FF';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.12;
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
  const cy = h * 0.4;

  // 문제 텍스트
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(48, w * 0.04)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(40,230,255,0.5)';
  ctx.shadowBlur = 20;
  ctx.fillText(currentQuestion.questionText, cx, cy);
  ctx.shadowBlur = 0;

  // 선택지 버튼
  const btnW = Math.min(180, w * 0.14);
  const btnH = btnW * 0.6;
  const gap = 40;
  const btnY = cy + 80;

  for (let i = 0; i < 2; i++) {
    const bx = cx + (i === 0 ? -(btnW + gap / 2) : gap / 2);

    ctx.strokeStyle = '#FFCB4D';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, btnY, btnW, btnH, 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,203,77,0.06)';
    ctx.fill();

    ctx.fillStyle = '#FFCB4D';
    ctx.font = `bold ${Math.min(36, w * 0.03)}px sans-serif`;
    ctx.fillText(String(currentQuestion.choices[i]), bx + btnW / 2, btnY + btnH / 2);

    // 번호 힌트
    ctx.font = `${Math.min(14, w * 0.011)}px sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText(`[${i + 1}]`, bx + btnW / 2, btnY + btnH + 18);
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
  ctx.font = `bold ${Math.min(64, w * 0.05)}px sans-serif`;
  ctx.fillStyle = feedbackCorrect ? '#4DFFAA' : '#FF4444';
  ctx.shadowColor = feedbackCorrect ? '#4DFFAA' : '#FF4444';
  ctx.shadowBlur = 30;
  ctx.fillText(feedbackCorrect ? '정답!' : '오답...', w / 2, h * 0.3);
  ctx.shadowBlur = 0;

  // 캐스팅 플래시
  if (castingFlash > 0) {
    ctx.globalAlpha = castingFlash * 0.3;
    ctx.fillStyle = '#C889FF';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(28, w * 0.022)}px sans-serif`;
    ctx.fillText(`수호신 캐스팅! (${guardian.stageName})`, w / 2, h * 0.55);
  }

  ctx.restore();
}

// ─── 게임 엔진 ───
const engine = new GameEngine({
  update(dt: number): void {
    if (screenMode !== 'game') return;

    if (feedbackTimer > 0) feedbackTimer -= dt;
    if (castingFlash > 0) castingFlash -= dt;
    guardian.update(dt);

    // 보스 공격 타이머
    const attacked = boss.update(dt);
    if (attacked) {
      const dmg = boss.resolveAttack(false); // TODO: 스쿼트 감지 연동
      if (dmg > 0) battle.onBossAttack();
    }

    // HUD 보간
    hudLayer.update(dt, {
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
    });

    // 게임오버 체크
    if (!battle.isAlive && stateMachine.currentState === 'PLAYING') {
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
      hudLayer.render(ctx, w, h, {
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
      });
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
  const x = (e.clientX - rect.left) / rect.width * canvas.width;
  const y = (e.clientY - rect.top) / rect.height * canvas.height;

  if (screenMode === 'menu') {
    const ch = menuRenderer.hitTest(x, y, canvas.width, canvas.height);
    if (ch > 0 && ch <= unlockedChapter) startChapter(ch);
  } else if (screenMode === 'game' && questionVisible && currentQuestion) {
    // 답 클릭 판정
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.4 + 80;
    const btnW = Math.min(180, w * 0.14);
    const btnH = btnW * 0.6;
    const gap = 40;

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
    if (e.key === 'Escape' || e.key === 'Enter') goToMenu();
  }
});

window.addEventListener('resize', () => canvasManager.resize());

// ─── 부트스트랩 ───
async function bootstrap(): Promise<void> {
  console.log('[DreamGuardian] v0.3 starting...');
  canvasManager.resize();
  await loadQuestions();
  engine.start();
  console.log('[DreamGuardian] Ready!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}
