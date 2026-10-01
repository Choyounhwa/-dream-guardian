import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UIText, setFontScale, resetAccessibility } from '../../src/utils/UIText.js';
import { HUDLayer } from '../../src/ui/HUDLayer.js';
import { MenuRenderer } from '../../src/ui/MenuRenderer.js';
import { ResultRenderer } from '../../src/ui/ResultRenderer.js';
import { BottomBar } from '../../src/ui/BottomBar.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { PauseModal } from '../../src/ui/PauseModal.js';
import { TutorialOverlay } from '../../src/ui/TutorialOverlay.js';
import { LocomotionModal } from '../../src/ui/LocomotionModal.js';
import { GestureFeedbackOverlay } from '../../src/ui/GestureFeedbackOverlay.js';
import { JudgmentFeedback } from '../../src/ui/JudgmentFeedback.js';
import { QuestionRenderer } from '../../src/render/QuestionRenderer.js';

const TARGET_FILES = [
  'src/ui/HUDLayer.ts',
  'src/ui/MenuRenderer.ts',
  'src/ui/ResultRenderer.ts',
  'src/ui/BottomBar.ts',
  'src/ui/SettingsModal.ts',
  'src/ui/PauseModal.ts',
  'src/ui/TutorialOverlay.ts',
  'src/ui/LocomotionModal.ts',
  'src/ui/GestureFeedbackOverlay.ts',
  'src/ui/JudgmentFeedback.ts',
  'src/render/QuestionRenderer.ts',
];

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[UI-TOKEN-003 / #258] 11개 UI 렌더러 하드코딩 폰트→토큰 전환 검증', () => {
  beforeEach(() => {
    resetAccessibility();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetAccessibility();
    vi.restoreAllMocks();
  });

  describe('정적 소스 코드 검사: 하드코딩된 ctx.font 제거 및 UIText 사용 확인', () => {
    for (const relPath of TARGET_FILES) {
      it(`${relPath} 파일에 하드코딩된 px 폰트 문자열이 없고 UIText.getFont가 사용된다`, () => {
        const fullPath = path.resolve(process.cwd(), relPath);
        const code = fs.readFileSync(fullPath, 'utf-8');

        // UIText import 확인
        expect(code).toMatch(/UIText/);

        // 하드코딩된 font 패턴 감지:
        // 예: ctx.font = 'bold 18px ...' 또는 ctx.font = `bold ${...}px ...`
        const hardcodedPattern = /ctx\.font\s*=\s*['"`](?:bold\s+|italic\s+)?(?:\$\{.*\}|\d+)\s*px/g;
        const matches = code.match(hardcodedPattern);
        expect(matches ?? []).toEqual([]);
      });
    }
  });

  describe('런타임 렌더링 검사: UIText.getFont 호출 및 역할 매핑 확인', () => {
    it('HUDLayer 렌더링 시 UIText.getFont가 호출된다 (caption, badge, body)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const hud = new HUDLayer();
      const ctx = createMockCtx();

      hud.render(ctx, 1080, 2160, {
        playerHp: 80,
        playerMaxHp: 100,
        bossHp: 8,
        bossMaxHp: 10,
        combo: 6,
        chapter: 1,
        guardianStage: 1,
      });

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('caption');
      expect(rolesCalled).toContain('badge');
      expect(rolesCalled).toContain('body');
    });

    it('MenuRenderer 메인 및 서브메뉴 렌더링 시 UIText.getFont가 호출된다 (title, heading, subheading, body, label, badge)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const menu = new MenuRenderer();
      const ctx = createMockCtx();

      // 메인 메뉴
      menu.render(ctx, 1080, 2160, {
        selectedChapter: 1,
        unlockedChapter: 2,
        stars: { 1: 3, 2: 1 },
        locomotionLabel: '달리기',
        locomotionIcon: '🏃',
      });

      // 서브메뉴
      menu.renderSubMenu(
        ctx,
        1080,
        2160,
        1,
        [
          { subLevel: 1, title: '1단계', count: 3 },
          { subLevel: 2, title: '2단계', count: 3 },
          { subLevel: 3, title: '3단계', count: 3 },
        ],
        1,
      );

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('title');
      expect(rolesCalled).toContain('label');
      expect(rolesCalled).toContain('subheading');
      expect(rolesCalled).toContain('heading');
    });

    it('ResultRenderer 렌더링 시 UIText.getFont가 호출된다 (hero, body, heading, subheading, label)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const result = new ResultRenderer();
      const ctx = createMockCtx();

      result.render(ctx, 1080, 2160, {
        victory: true,
        chapter: 1,
        correctCount: 10,
        totalQuestions: 10,
        maxCombo: 10,
        elapsedTime: 120,
        steps: 100,
        squats: 15,
        jumps: 10,
        dwellTime: 20,
        locomotionMode: 'run',
      });

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('hero');
      expect(rolesCalled).toContain('subheading');
      expect(rolesCalled).toContain('label');
    });

    it('BottomBar 렌더링 시 UIText.getFont가 호출된다 (body, label)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const bar = new BottomBar();
      const ctx = createMockCtx();

      bar.render(ctx, 1080, 2160, {
        mana: 50,
        manaMax: 100,
        combo: 3,
        actionLabel: '포기하기',
      });

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('body');
      expect(rolesCalled).toContain('label');
    });

    it('SettingsModal, PauseModal, TutorialOverlay, LocomotionModal 렌더링 시 UIText.getFont가 호출된다', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const ctx = createMockCtx();

      const settings = new SettingsModal();
      settings.open();
      settings.render(ctx, 1080, 2160);

      const pause = new PauseModal();
      pause.open();
      pause.render(ctx, 1080, 2160);

      const tutorial = new TutorialOverlay();
      tutorial.show();
      tutorial.render(ctx, 1080, 2160);

      const locomotion = new LocomotionModal();
      locomotion.open();
      locomotion.render(ctx, 1080, 2160);

      expect(spy).toHaveBeenCalled();
      const rolesCalled = new Set(spy.mock.calls.map((call) => call[0]));
      expect(rolesCalled.has('subheading')).toBe(true);
      expect(rolesCalled.has('body')).toBe(true);
      expect(rolesCalled.has('badge')).toBe(true);
    });

    it('GestureFeedbackOverlay, JudgmentFeedback, QuestionRenderer 렌더링 시 UIText.getFont가 호출된다', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const ctx = createMockCtx();

      const gesture = new GestureFeedbackOverlay();
      gesture.render(ctx, 1080, 2160, {
        isCrossing: true,
        inCooldown: false,
        isPaused: false,
        progress: 0.5,
        screenMode: 'game',
      });

      const judgment = new JudgmentFeedback();
      const state = judgment.update({
        score: 0.5,
        gates: { armExtension: 0.4 },
        adaptiveRelaxed: true,
      });
      judgment.render(ctx, 1080, 2160, state);

      const questionRenderer = new QuestionRenderer();
      questionRenderer.render(ctx, 1080, 2160, {
        question: {
          questionText: '1 + 1',
          choices: ['2', '3'],
          correctAnswer: '2',
          wrongAnswer: '3',
          correctIndex: 0,
        },
        questionVisible: true,
        selectedChoiceIndex: 0,
      });

      expect(spy).toHaveBeenCalled();
      const rolesCalled = new Set(spy.mock.calls.map((call) => call[0]));
      expect(rolesCalled.has('label')).toBe(true);
      expect(rolesCalled.has('badge')).toBe(true);
    });
  });

  describe('접근성 fontScale 동적 반응 검증', () => {
    it('fontScale 변경 시 렌더러가 생성하는 폰트 크기가 비례하여 확대된다', () => {
      setFontScale(1.0);
      const fontBase = UIText.getFont('hero', 1.0);
      expect(fontBase).toContain('100px');

      setFontScale(1.5);
      const fontScaled = UIText.getFont('hero', 1.0);
      expect(fontScaled).toContain('150px');
    });
  });
});
