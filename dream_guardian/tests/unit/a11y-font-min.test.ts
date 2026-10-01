import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HUDLayer, type HUDData } from '../../src/ui/HUDLayer.js';
import { TutorialOverlay } from '../../src/ui/TutorialOverlay.js';
import { JudgmentFeedback } from '../../src/ui/JudgmentFeedback.js';
import { BossRenderer } from '../../src/render/BossRenderer.js';
import { BeatHUDRenderer, type BeatHUDState } from '../../src/render/BeatHUDRenderer.js';
import { resetAccessibility } from '../../src/utils/UIText.js';

interface MockCanvasContext extends CanvasRenderingContext2D {
  __fontHistory: string[];
}

function createMockCtx(): MockCanvasContext {
  const fontHistory: string[] = [];
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
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    get font() {
      return fontHistory[fontHistory.length - 1] ?? '';
    },
    set font(val: string) {
      fontHistory.push(val);
    },
    __fontHistory: fontHistory,
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as MockCanvasContext;
}

function parsePxFromFont(fontStr: string): number {
  const match = fontStr.match(/(\d+)px/);
  return match ? parseInt(match[1], 10) : 0;
}

describe('[A11Y-001 / #262] user-scalable 해제 및 최소 폰트 크기 하한선 적용 검증', () => {
  beforeEach(() => {
    resetAccessibility();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetAccessibility();
    vi.restoreAllMocks();
  });

  describe('1. index.html viewport 메타태그 검증', () => {
    it('user-scalable=no가 제거되고 user-scalable=yes가 명시되어 핀치 줌을 허용한다', () => {
      const indexPath = path.resolve(process.cwd(), 'index.html');
      const html = fs.readFileSync(indexPath, 'utf-8');

      expect(html).not.toMatch(/user-scalable\s*=\s*no/i);
      expect(html).toMatch(/user-scalable\s*=\s*yes/i);
    });
  });

  describe('2. 정적 소스 코드 검사: 대상 파일 내 22px 미만 폰트 하드코딩 부재 및 하한선 패턴', () => {
    const TARGET_FILES = [
      'src/ui/HUDLayer.ts',
      'src/ui/TutorialOverlay.ts',
      'src/ui/JudgmentFeedback.ts',
      'src/render/BossRenderer.ts',
      'src/render/BeatHUDRenderer.ts',
    ];

    for (const relPath of TARGET_FILES) {
      it(`${relPath} 파일에 22px 미만(14px, 16px, 18px, 20px 등)의 하드코딩 폰트가 존재하지 않는다`, () => {
        const fullPath = path.resolve(process.cwd(), relPath);
        const code = fs.readFileSync(fullPath, 'utf-8');

        // ctx.font = '... 14px ...' or ctx.font = '... 16px ...' or ctx.font = '... 18px ...' or ctx.font = '... 20px ...'
        const below22Pattern = /ctx\.font\s*=\s*['"`][^'"`]*\b(?:[0-9]|1[0-9]|2[0-1])px/g;
        const matches = code.match(below22Pattern);
        expect(matches ?? []).toEqual([]);
      });
    }
  });

  describe('3. 런타임 렌더링 폰트 크기 최소 하한선 보장 검증', () => {
    it('HUDLayer: HP바 라벨 최소 26px, 보스명 최소 28px 하한선을 보장한다', () => {
      const hud = new HUDLayer();
      const ctx = createMockCtx();
      const mockData: HUDData = {
        playerHp: 100,
        playerMaxHp: 100,
        bossHp: 10,
        bossMaxHp: 10,
        combo: 3,
        chapter: 1,
        guardianStage: 1,
      };

      // 작은 해상도(360px 너비)에서도 최소 하한선 26px / 28px 유지 검증
      hud.render(ctx, 360, 720, mockData);

      const fonts = ctx.__fontHistory;
      expect(fonts.length).toBeGreaterThan(0);

      // HP바 라벨 (플레이어 & 보스) 폰트 검증: >= 26px
      const hpFonts = fonts.filter((f) => parsePxFromFont(f) >= 26);
      expect(hpFonts.length).toBeGreaterThanOrEqual(2);

      // 보스명 폰트 검증: >= 28px
      const bossNameFonts = fonts.filter((f) => parsePxFromFont(f) >= 28);
      expect(bossNameFonts.length).toBeGreaterThanOrEqual(1);

      // 어떤 폰트도 22px 미만으로 떨어지지 않음
      for (const f of fonts) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(22);
      }
    });

    it('TutorialOverlay: 스킵 힌트 최소 22px, 존 라벨 최소 24px 하한선을 보장한다', () => {
      const tutorial = new TutorialOverlay();

      // 1단계(스킵 힌트 검증)
      tutorial.show();
      const ctx1 = createMockCtx();
      tutorial.render(ctx1, 360, 720);
      const fonts1 = ctx1.__fontHistory;
      // 스킵 힌트 폰트 >= 22px
      expect(fonts1.some((f) => parsePxFromFont(f) >= 22)).toBe(true);
      for (const f of fonts1) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(22);
      }

      // 2단계(존 라벨 검증)
      tutorial.nextStep();
      const ctx2 = createMockCtx();
      tutorial.render(ctx2, 360, 720);
      const fonts2 = ctx2.__fontHistory;
      // 존 라벨 폰트 >= 24px
      expect(fonts2.some((f) => parsePxFromFont(f) >= 24)).toBe(true);
      for (const f of fonts2) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(22);
      }
    });

    it('JudgmentFeedback: 적응형 인디케이터 최소 26px 하한선을 보장한다', () => {
      const feedback = new JudgmentFeedback();
      const ctx = createMockCtx();
      const state = feedback.update({
        score: 0.5,
        gates: { armExtension: 0.4 },
        adaptiveRelaxed: true,
      });

      // 작은 해상도(360x720)에서도 최소 하한선 26px 보장
      feedback.render(ctx, 360, 720, state);

      const fonts = ctx.__fontHistory;
      const indicatorFont = fonts.find((f) => parsePxFromFont(f) >= 26);
      expect(indicatorFont).toBeDefined();

      for (const f of fonts) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(22);
      }
    });

    it('BossRenderer: Ch.1, Ch.3, Ch.4 부유 기호/물음표 최소 24px 하한선을 보장한다', () => {
      const renderer = new BossRenderer();

      // Ch.1 물음표
      const ctx1 = createMockCtx();
      renderer.render(ctx1, 1, 200, 200, 40, 'idle');
      expect(ctx1.__fontHistory.some((f) => parsePxFromFont(f) >= 24)).toBe(true);
      for (const f of ctx1.__fontHistory) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(24);
      }

      // Ch.3 수학 기호들
      const ctx3 = createMockCtx();
      renderer.render(ctx3, 3, 200, 200, 40, 'idle');
      expect(ctx3.__fontHistory.some((f) => parsePxFromFont(f) >= 24)).toBe(true);
      for (const f of ctx3.__fontHistory) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(24);
      }

      // Ch.4 포기해...
      const ctx4 = createMockCtx();
      renderer.render(ctx4, 4, 200, 200, 40, 'idle');
      expect(ctx4.__fontHistory.some((f) => parsePxFromFont(f) >= 24)).toBe(true);
      for (const f of ctx4.__fontHistory) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(24);
      }
    });

    it('BeatHUDRenderer: 힌트 및 박자 인디케이터 최소 24px 하한선을 보장한다', () => {
      const renderer = new BeatHUDRenderer({ showBeatDots: true });
      const ctx = createMockCtx();
      const state: BeatHUDState = {
        totalSteps: 10,
        completedExerciseBeats: 3,
        locomotionMode: 'run',
        activeHazardPattern: 'jump',
        hazardBeatProgress: 0.5,
      };

      // 작은 해상도(360x720)에서도 24px 하한선 보장
      renderer.render(ctx, 360, 720, state);

      const fonts = ctx.__fontHistory;
      expect(fonts.length).toBeGreaterThan(0);
      for (const f of fonts) {
        expect(parsePxFromFont(f)).toBeGreaterThanOrEqual(24);
      }
    });
  });
});
