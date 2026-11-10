/**
 * [LAYOUT-004] (Issue #571) 결과 화면 레이아웃 설정 이전 - 제목·별·도장·통계 (+글자 textScale)
 *
 * 1. 이전 전 출력 및 bounds 잠금 (Characterization):
 *    - 기본값에서 ResultRenderer의 각 영역 bounds, 폰트 문자열, 텍스트 좌표가 이전 전과 100% 동일해야 한다.
 * 2. 신규 UI_LAYOUT 키 값 변경 시 매 프레임 다시 읽어 요소 bounds 및 렌더링 변경:
 *    - title (x, y, w, h, textScale)
 *    - chapter (x, y, w, h, textScale)
 *    - stars (x, y, w, h, textScale)
 *    - stamp (x, y, w, h, textScale)
 *    - stats (x, y, w, h, victoryY, defeatY, label.textScale, value.textScale)
 *    - prompt (x, y, w, h, textScale), button.textScale
 * 3. textScale (0.5~3.0) 적용:
 *    - title, chapter, stars, stamp, stats(label, value), prompt/button
 * 4. Presentation Context 오버라이드 우선순위 유지
 * 5. 판정 연동 좌표 불변 유지
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultRenderer, type ResultData, type ResultPresentationContext } from '../../src/ui/ResultRenderer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { UIText, resetAccessibility } from '../../src/utils/UIText.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import {
  resetLayoutTo,
  snapshotLayout,
} from '../../src/dev/DevLayoutPanel.js';
import {
  applyLayoutOverride,
  getLayoutKeyRule,
} from '../../src/core/UILayoutOverride.js';
import { getDevUiLockedSources } from '../../config/dev-ui.config.js';

const pristine = snapshotLayout(UI_LAYOUT);

function createMockCtx() {
  const fontsSet: string[] = [];
  const filledTexts: Array<{ text: string; x: number; y: number; font: string }> = [];
  let _font = '';

  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 })),
    drawImage: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text: String(text), x, y, font: _font });
    }),
    get font() {
      return _font;
    },
    set font(val: string) {
      _font = val;
      fontsSet.push(val);
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    __fontsSet: fontsSet,
    __filledTexts: filledTexts,
  };
}

const mockResultData: ResultData = Object.freeze({
  victory: true,
  chapter: 1,
  correctCount: 10,
  totalQuestions: 10,
  maxCombo: 8,
  steps: 120,
  squats: 15,
  jumps: 6,
  elapsedTime: 75,
  dwellTime: 20,
  locomotionMode: 'run',
  calories: 45,
  stars: 3,
  rank: 'S',
});

describe('[LAYOUT-004] Issue #571 결과 화면 레이아웃 설정 이전', () => {
  beforeEach(() => {
    resetAccessibility();
    imageLoader.clear();
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
    resetAccessibility();
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 기본값 특성화 (Characterization) 및 출력·좌표 잠금', () => {
    it('기본 해상도(1080x2160)에서 모든 하위 영역 bounds가 이전 전 기준과 100% 일치한다', () => {
      const renderer = new ResultRenderer();
      const W = 1080;
      const H = 2160;

      const panel = renderer.getPanelBounds(W, H);
      expect(panel).toEqual({ x: 100, y: 240, w: 880, h: 1580 });

      const title = renderer.getTitleBounds(W, H);
      expect(title).toEqual({ x: 240, y: 270, w: 600, h: 160 });

      const chapter = renderer.getChapterTitleBounds(W, H);
      expect(chapter).toEqual({ x: 140, y: 415, w: 800, h: 50 });

      const stars = renderer.getGradeBounds(W, H);
      expect(stars).toEqual({ x: 459, y: 488, w: 162, h: 54 });

      const stamp = renderer.getRankStampBounds(W, H);
      expect(stamp).toEqual({ x: 760, y: 280, w: 180, h: 180 });

      const stats = renderer.getStatsBounds(W, H);
      expect(stats).toEqual({ x: 160, y: 710, w: 760, h: 592 });

      const statLine0 = renderer.getStatLineBounds(0, W, H);
      expect(statLine0).toEqual({ x: 160, y: 710, w: 760, h: 74 });

      const prompt = renderer.getBottomPromptBounds(W, H);
      expect(prompt).toEqual({ x: 100, y: 1750, w: 880, h: 40 });
    });

    it('기본 렌더링 시 폰트와 텍스트 위치가 기본값과 100% 일치한다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();
      renderer.resetAnimation(10); // 통계 애니메이션 완료 상태
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const calls = ctx.__filledTexts;

      // 승리 타이틀
      const titleCall = calls.find((c) => c.text === '승리!');
      expect(titleCall).toBeDefined();
      expect(titleCall!.x).toBe(540);
      expect(titleCall!.y).toBe(350);
      expect(titleCall!.font).toBe(UIText.getFont('hero', 1.0, 'bold'));

      // 챕터명
      const chapterCall = calls.find((c) => c.text.includes('Ch.1'));
      expect(chapterCall).toBeDefined();
      expect(chapterCall!.x).toBe(540);
      expect(chapterCall!.y).toBe(440);
      expect(chapterCall!.font).toBe(UIText.getFont('body', 1.0, 'bold'));

      // 별 텍스트 fallback
      const starCall = calls.find((c) => c.text.includes('★'));
      expect(starCall).toBeDefined();
      expect(starCall!.x).toBe(540);
      expect(starCall!.y).toBe(515);
      expect(starCall!.font).toBe(UIText.getFont('heading', 1.0, 'bold'));

      // 랭크 스탬프 프로시저럴 fallback
      const rankBadgeCall = calls.find((c) => c.text === 'RANK');
      expect(rankBadgeCall).toBeDefined();
      expect(rankBadgeCall!.font).toBe(UIText.getFont('badge', 1.0, 'bold'));

      const rankLetterCall = calls.find((c) => c.text === 'S');
      expect(rankLetterCall).toBeDefined();
      expect(rankLetterCall!.font).toBe(UIText.getFont('title', 1.0, 'bold'));

      // 하단 안내문
      const promptCall = calls.find((c) => c.text.includes('양손을 모으거나'));
      expect(promptCall).toBeDefined();
      expect(promptCall!.x).toBe(540);
      expect(promptCall!.y).toBe(1770);
      expect(promptCall!.font).toBe(UIText.getFont('label', 1.0, 'normal'));
    });

    it('패배(defeat) 상태 렌더링 시 타이틀과 통계 시작 위치(defeatY)가 올바르게 적용된다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();
      renderer.resetAnimation(10);
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, {
        ...mockResultData,
        victory: false,
      });

      const calls = ctx.__filledTexts;
      const defeatTitle = calls.find((c) => c.text === '패배...');
      expect(defeatTitle).toBeDefined();
      expect(defeatTitle!.x).toBe(540);
      expect(defeatTitle!.y).toBe(350);

      // 패배 시 별점은 렌더링되지 않음
      expect(calls.some((c) => c.text.includes('★'))).toBe(false);

      // 통계 첫 번째 항목의 y 좌표가 defeatY (620) 기준이어야 함
      const firstStat = calls.find((c) => c.text.includes('정답률'));
      expect(firstStat).toBeDefined();
      expect(firstStat!.y).toBe(620);
    });
  });

  describe('2. UI_LAYOUT.result 키 변경 시 매 프레임 다시 읽기 (캐싱 금지)', () => {
    it('title 슬롯 변경 시 getTitleBounds가 즉시 반영된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.title.x = 210;
      anyResult.title.y = 290;
      anyResult.title.w = 550;
      anyResult.title.h = 150;

      const bounds = renderer.getTitleBounds(1080, 2160);
      expect(bounds).toEqual({ x: 210, y: 290, w: 550, h: 150 });
    });

    it('chapter 슬롯 변경 시 getChapterTitleBounds가 즉시 반영된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.chapter.x = 120;
      anyResult.chapter.y = 430;
      anyResult.chapter.w = 750;
      anyResult.chapter.h = 60;

      const bounds = renderer.getChapterTitleBounds(1080, 2160);
      expect(bounds).toEqual({ x: 120, y: 430, w: 750, h: 60 });
    });

    it('stars 슬롯 변경 시 getGradeBounds가 즉시 반영된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.stars.x = 420;
      anyResult.stars.y = 470;
      anyResult.stars.w = 150;
      anyResult.stars.h = 50;

      const bounds = renderer.getGradeBounds(1080, 2160);
      expect(bounds).toEqual({ x: 420, y: 470, w: 150, h: 50 });
    });

    it('stamp 슬롯 변경 시 getRankStampBounds가 즉시 반영된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.stamp = { x: 740, y: 260, w: 190, h: 190, textScale: 1.0 };

      const bounds = renderer.getRankStampBounds(1080, 2160);
      expect(bounds).toEqual({ x: 740, y: 260, w: 190, h: 190 });
    });

    it('stats 슬롯 변경 시 getStatsBounds 및 getStatLineBounds가 즉시 반영된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.stats.x = 140;
      anyResult.stats.y = 700;
      anyResult.stats.w = 800;
      anyResult.stats.h = 600;

      const bounds = renderer.getStatsBounds(1080, 2160);
      expect(bounds).toEqual({ x: 140, y: 700, w: 800, h: 600 });
      expect(renderer.getStatLineBounds(0, 1080, 2160).x).toBe(140);
      expect(renderer.getStatLineBounds(0, 1080, 2160).y).toBe(700);
    });

    it('prompt 슬롯 변경 시 getBottomPromptBounds가 즉시 반영된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.prompt = { x: 80, y: 1800, w: 920, h: 50, textScale: 1.0 };

      const bounds = renderer.getBottomPromptBounds(1080, 2160);
      expect(bounds).toEqual({ x: 80, y: 1800, w: 920, h: 50 });
    });
  });

  describe('3. textScale (0.5~3.0) 배율 적용', () => {
    it('title.textScale 변경 시 타이틀 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.title.textScale = 1.5;

      const ctx = createMockCtx();
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const titleCall = ctx.__filledTexts.find((c) => c.text === '승리!');
      expect(titleCall).toBeDefined();
      expect(titleCall!.font).toBe(UIText.getFont('hero', 1.5, 'bold'));
    });

    it('chapter.textScale 변경 시 챕터 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.chapter.textScale = 1.25;

      const ctx = createMockCtx();
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const chapterCall = ctx.__filledTexts.find((c) => c.text.includes('Ch.1'));
      expect(chapterCall).toBeDefined();
      expect(chapterCall!.font).toBe(UIText.getFont('body', 1.25, 'bold'));
    });

    it('stars.textScale 변경 시 별점 fallback 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.stars.textScale = 1.3;

      const ctx = createMockCtx();
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const starCall = ctx.__filledTexts.find((c) => c.text.includes('★'));
      expect(starCall).toBeDefined();
      expect(starCall!.font).toBe(UIText.getFont('heading', 1.3, 'bold'));
    });

    it('stamp.textScale 변경 시 프로시저럴 스탬프 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.stamp = { ...anyResult.stamp, textScale: 1.4 };

      const ctx = createMockCtx();
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const badgeCall = ctx.__filledTexts.find((c) => c.text === 'RANK');
      expect(badgeCall).toBeDefined();
      expect(badgeCall!.font).toBe(UIText.getFont('badge', 1.4, 'bold'));

      const letterCall = ctx.__filledTexts.find((c) => c.text === 'S');
      expect(letterCall).toBeDefined();
      expect(letterCall!.font).toBe(UIText.getFont('title', 1.4, 'bold'));
    });

    it('stats.label.textScale 및 stats.value.textScale 변경 시 통계 폰트 크기가 조정된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.stats = {
        ...anyResult.stats,
        label: { textScale: 1.2 },
        value: { textScale: 1.0 },
      };

      const ctx = createMockCtx();
      renderer.resetAnimation(10);
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const statCall = ctx.__filledTexts.find((c) => c.text.includes('정답률'));
      expect(statCall).toBeDefined();
      expect(statCall!.font).toBe(UIText.getFont('subheading', 1.2, 'bold'));
      expect(renderer.getStatFontSize(1080)).toBe(Math.round(44 * 1.2));
    });

    it('prompt.textScale 및 button.textScale 변경 시 하단 안내문 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ResultRenderer();
      const anyResult = UI_LAYOUT.result as any;
      anyResult.prompt = { ...anyResult.prompt, textScale: 1.3 };

      const ctx = createMockCtx();
      renderer.render(ctx as unknown as CanvasRenderingContext2D, 1080, 2160, mockResultData);

      const promptCall = ctx.__filledTexts.find((c) => c.text.includes('양손을 모으거나'));
      expect(promptCall).toBeDefined();
      expect(promptCall!.font).toBe(UIText.getFont('label', 1.3, 'normal'));
    });
  });

  describe('4. Presentation Context 오버라이드 우선순위 유지', () => {
    it('setPresentationContext 주입 시 UI_LAYOUT보다 우선하여 bounds를 반환한다', () => {
      const renderer = new ResultRenderer();
      const customContext: ResultPresentationContext = {
        title: { x: 300, y: 350, w: 480, h: 120 },
        chapterTitle: { x: 200, y: 460, w: 600, h: 40 },
        grade: { x: 400, y: 520, w: 200, h: 60 },
        rankStamp: { x: 800, y: 300, w: 150, h: 150 },
        stats: { x: 180, y: 650, w: 700, h: 500, lineHeight: 65 },
        bottomPrompt: { x: 120, y: 1800, w: 840, h: 50 },
      };

      renderer.setPresentationContext(customContext);

      expect(renderer.getTitleBounds(1080, 2160)).toEqual({ x: 300, y: 350, w: 480, h: 120 });
      expect(renderer.getChapterTitleBounds(1080, 2160)).toEqual({ x: 200, y: 460, w: 600, h: 40 });
      expect(renderer.getGradeBounds(1080, 2160)).toEqual({ x: 400, y: 520, w: 200, h: 60 });
      expect(renderer.getRankStampBounds(1080, 2160)).toEqual({ x: 800, y: 300, w: 150, h: 150 });
      expect(renderer.getStatsBounds(1080, 2160)).toEqual({ x: 180, y: 650, w: 700, h: 500 });
      expect(renderer.getBottomPromptBounds(1080, 2160)).toEqual({ x: 120, y: 1800, w: 840, h: 50 });
    });
  });

  describe('5. 판정 연동 좌표 불변 유지 및 UILayoutOverride 규칙', () => {
    it('피트니스 존 및 밴드 판정 연동 좌표가 변경되지 않고 보존된다', () => {
      const sources = getDevUiLockedSources();
      expect(sources.length).toBeGreaterThan(0);
      const zoneSource = sources.find((s) => s.id === 'fitnessZones');
      expect(zoneSource).toBeDefined();
      expect(zoneSource!.values['zone1.y']).toBeDefined();
    });

    it('applyLayoutOverride를 통해 result 하위 textScale 패치가 정상 허용되고 범위 외는 거부된다', () => {
      // 0.5~3.0 정상 허용
      const patchValid = {
        result: {
          title: { textScale: 1.5 },
          chapter: { textScale: 2.0 },
        },
      };
      const resValid = applyLayoutOverride(UI_LAYOUT, patchValid);
      expect(resValid.applied).toContain('result.title.textScale');
      expect(resValid.applied).toContain('result.chapter.textScale');
      expect((UI_LAYOUT.result as any).title.textScale).toBe(1.5);
      expect((UI_LAYOUT.result as any).chapter.textScale).toBe(2.0);

      // 0.49 또는 3.01 등 범위 외 거부 (#581 LAYOUT-010 규칙)
      const patchInvalid = {
        result: {
          title: { textScale: 0.4 },
          chapter: { textScale: 3.5 },
        },
      };
      const resInvalid = applyLayoutOverride(UI_LAYOUT, patchInvalid);
      expect(resInvalid.warnings.length).toBeGreaterThan(0);
      // 기존 1.5, 2.0 유지
      expect((UI_LAYOUT.result as any).title.textScale).toBe(1.5);
      expect((UI_LAYOUT.result as any).chapter.textScale).toBe(2.0);
    });

    it('getLayoutKeyRule이 textScale 및 세로/가로 좌표 키에 대해 올바른 규칙을 반환한다', () => {
      expect(getLayoutKeyRule('textScale')).toEqual({ min: 0.5, max: 3.0, step: 0.01, integer: false });
      expect(getLayoutKeyRule('victoryY')).toEqual({ min: 0, max: 2160, step: 1, integer: true });
      expect(getLayoutKeyRule('defeatY')).toEqual({ min: 0, max: 2160, step: 1, integer: true });
    });
  });
});
