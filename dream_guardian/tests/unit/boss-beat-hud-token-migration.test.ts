import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UIText, setFontScale, resetAccessibility } from '../../src/utils/UIText.js';
import { BossClimaxRenderer, type BossClimaxRenderState } from '../../src/render/BossClimaxRenderer.js';
import { BeatHUDRenderer, type BeatHUDState } from '../../src/render/BeatHUDRenderer.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';

const TARGET_FILES = [
  'src/render/BossClimaxRenderer.ts',
  'src/render/BeatHUDRenderer.ts',
  'src/ui/PhasePresentationAdapter.ts',
];

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
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

describe('[UI-TOKEN-005 / #260] BossClimaxRenderer/BeatHUDRenderer/PhasePresentationAdapter 하드코딩 폰트→토큰 전환 검증', () => {
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
    it('BossClimaxRenderer 렌더링 시 UIText.getFont가 호출된다 (body, badge, caption)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const renderer = new BossClimaxRenderer();
      const ctx = createMockCtx();

      const state: BossClimaxRenderState = {
        bossHp: 8,
        bossMaxHp: 10,
        isEnraged: true,
        minionCount: 5,
        guardianStage: 2,
        stardust: 42,
        feverCombo: 3,
        hazard: {
          activePattern: 'dual_slam',
          progress: 0.5,
          isResolved: true,
          isEvaded: true,
        },
        barrageActive: true,
        barrageProgress: 0.8,
        elapsedTime: 2.5,
      };

      renderer.render(ctx, 1080, 2160, state);

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('body'); // shockwave guide / evade feedback / fever combo
      expect(rolesCalled).toContain('badge'); // guardian name / berserk badge / minion count / stardust
      expect(rolesCalled).toContain('caption'); // boss hp text
    });

    it('BeatHUDRenderer 렌더링 시 UIText.getFont가 호출된다 (subheading, label, caption, body)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const renderer = new BeatHUDRenderer({ showBeatDots: true });
      const ctx = createMockCtx();

      const state: BeatHUDState = {
        totalSteps: 24,
        completedExerciseBeats: 4,
        locomotionMode: 'run',
        activeHazardPattern: 'jump',
        hazardBeatProgress: 0.6,
      };

      renderer.render(ctx, 1080, 2160, state);

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('subheading'); // hazard guide title (44px)
      expect(rolesCalled).toContain('label'); // hazard guide subtitle (26px)
      expect(rolesCalled).toContain('caption'); // beat dots (16px)
      expect(rolesCalled).toContain('body'); // step count (32px)
    });

    it('PhasePresentationAdapter renderHazardEvade 시 UIText.getFont가 호출된다 (subheading, body)', () => {
      const spy = vi.spyOn(UIText, 'getFont');
      const adapter = new PhasePresentationAdapter();
      const ctx = createMockCtx();

      adapter.renderHazardEvade(ctx, 1080, 2160, {
        activePattern: 'jump',
        beatProgress: 0.8,
        vanishingX: 540,
        vanishingY: 800,
        isResolved: true,
        isEvaded: true,
      });

      expect(spy).toHaveBeenCalled();
      const rolesCalled = spy.mock.calls.map((call) => call[0]);
      expect(rolesCalled).toContain('subheading'); // evade title (44px)
      expect(rolesCalled).toContain('body'); // evade subtitle/feedback
    });
  });

  describe('접근성 확장성 검사: fontScale 배율 적용 시 폰트 크기 반응 확인', () => {
    it('fontScale 배율 변경 시 BossClimaxRenderer 폰트 크기가 비례하여 확대된다', () => {
      const renderer = new BossClimaxRenderer();
      const ctx = createMockCtx();
      const state: BossClimaxRenderState = {
        bossHp: 8,
        bossMaxHp: 10,
        isEnraged: true,
        minionCount: 5,
        guardianStage: 2,
        stardust: 42,
        feverCombo: 3,
        hazard: {
          activePattern: 'dual_slam',
          progress: 0.5,
          isResolved: false,
          isEvaded: false,
        },
        barrageActive: false,
        barrageProgress: 0,
        elapsedTime: 2.5,
      };

      // 1.0 배율
      setFontScale(1.0);
      renderer.render(ctx, 1080, 2160, state);
      const fontAt100 = ctx.font;

      // 1.5 배율
      setFontScale(1.5);
      renderer.render(ctx, 1080, 2160, state);
      const fontAt150 = ctx.font;

      const size100 = parseInt(fontAt100.match(/(\d+)px/)![1], 10);
      const size150 = parseInt(fontAt150.match(/(\d+)px/)![1], 10);

      expect(size150).toBeGreaterThan(size100);
      expect(size150).toBe(Math.round(size100 * 1.5));
    });

    it('fontScale 배율 변경 시 BeatHUDRenderer 폰트 크기가 비례하여 확대된다', () => {
      const renderer = new BeatHUDRenderer();
      const ctx = createMockCtx();
      const state: BeatHUDState = {
        totalSteps: 24,
        completedExerciseBeats: 4,
        locomotionMode: 'run',
        activeHazardPattern: 'jump',
        hazardBeatProgress: 0.6,
      };

      setFontScale(1.0);
      renderer.render(ctx, 1080, 2160, state);
      const fontAt100 = ctx.font;

      setFontScale(1.5);
      renderer.render(ctx, 1080, 2160, state);
      const fontAt150 = ctx.font;

      const size100 = parseInt(fontAt100.match(/(\d+)px/)![1], 10);
      const size150 = parseInt(fontAt150.match(/(\d+)px/)![1], 10);

      expect(size150).toBeGreaterThan(size100);
      expect(size150).toBe(Math.round(size100 * 1.5));
    });
  });
});
