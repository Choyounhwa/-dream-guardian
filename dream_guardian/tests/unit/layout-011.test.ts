/**
 * [LAYOUT-011] (Issue #582) 메인 메뉴·서브메뉴 글자 크기 textScale 설정 이전
 *
 * 1. 기본값 1.0에서 기존 font 문자열과 100% 일치 (특성화/출력 고정 테스트)
 * 2. textScale 변경 시 매 프레임 UI_LAYOUT에서 다시 읽어 해당 텍스트의 font px만 비례 변경
 * 3. flattenLayoutBindings 바인딩 노출 및 getLayoutKeyRule (0.5~3.0, step 0.01) 적용 검증
 * 4. applyLayoutOverride를 통한 textScale 오버라이드 및 유효성 검증 (0.5~3.0 허용, 범위 밖 거부)
 * 5. 접근성 fontScale 및 최소 하한선 유지
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuRenderer, type MenuState } from '../../src/ui/MenuRenderer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UIText, setFontScale } from '../../src/utils/UIText.js';
import {
  flattenLayoutBindings,
  resetLayoutTo,
  snapshotLayout,
} from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride.js';

const pristine = snapshotLayout(UI_LAYOUT);

const dummyState: MenuState = {
  unlockedChapter: 2,
  stars: { 1: 3, 2: 0 },
  selectedChapter: 0,
};

const dummySubLevels = [
  { subLevel: 1, title: '단계 1', count: 10 },
  { subLevel: 2, title: '단계 2', count: 12 },
];

function createContext() {
  const fontsSet: string[] = [];
  let _font = '';
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    get font() {
      return _font;
    },
    set font(v: string) {
      _font = v;
      fontsSet.push(v);
    },
    get fontsSet() {
      return fontsSet;
    },
  };
}

describe('LAYOUT-011 메인 메뉴·서브메뉴 textScale 설정 이전', () => {
  beforeEach(() => {
    UIText.resetAccessibility();
    imageLoader.clear();
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
    UIText.resetAccessibility();
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 기본값 1.0 특성화 테스트 (기존 폰트 문자열 100% 보존)', () => {
    it('메인 메뉴의 각 텍스트 요소가 기본값 1.0에서 기존 폰트 문자열과 완전히 동일하다', () => {
      const ctx = createContext();
      const renderer = new MenuRenderer();
      renderer.render(ctx as never, 1080, 2160, dummyState);

      // 1080x2160 기준 scaleX = 1.0
      // 1) 타이틀 (title 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('title', 1.0, 'bold'));
      // 2) 슬로건 (caption 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('caption', 1.0, 'normal'));
      // 3) 챕터 번호 (subheading 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('subheading', 1.0, 'bold'));
      // 4) 챕터명 (subheading 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('subheading', 1.0, 'bold'));
      // 5) 테마 부제 (label 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('label', 1.0, 'normal'));
    });

    it('서브메뉴의 각 텍스트 요소가 기본값 1.0에서 기존 폰트 문자열과 완전히 동일하다', () => {
      const ctx = createContext();
      const renderer = new MenuRenderer();
      renderer.renderSubMenu(ctx as never, 1080, 2160, 1, dummySubLevels);

      // 1) 서브메뉴 타이틀 (heading 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('heading', 1.0, 'bold'));
      // 2) 안내 문구 (label 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('label', 1.0, 'normal'));
      // 3) 단계명 (heading 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('heading', 1.0, 'bold'));
      // 4) 부제 (subheading 토큰)
      expect(ctx.fontsSet).toContain(UIText.getFont('subheading', 1.0, 'normal'));
    });
  });

  describe('2. textScale 변경 시 해당 텍스트의 font px 비례 변경', () => {
    it('메인 메뉴 title.textScale = 1.5 변경 시 타이틀 폰트 크기만 1.5배로 변경된다', () => {
      const ctx = createContext();
      const renderer = new MenuRenderer();

      (UI_LAYOUT.menu.title as any).textScale = 1.5;
      renderer.render(ctx as never, 1080, 2160, dummyState);

      const expectedTitleFont = UIText.getFont('title', 1.0 * 1.5, 'bold');
      expect(ctx.fontsSet).toContain(expectedTitleFont);
      // 슬로건은 여전히 기본값
      expect(ctx.fontsSet).toContain(UIText.getFont('caption', 1.0, 'normal'));
    });

    it('메인 메뉴 slogan.textScale = 0.8 변경 시 슬로건 폰트 크기만 0.8배로 변경된다', () => {
      const ctx = createContext();
      const renderer = new MenuRenderer();

      (UI_LAYOUT.menu as any).slogan.textScale = 0.8;
      renderer.render(ctx as never, 1080, 2160, dummyState);

      const expectedSloganFont = UIText.getFont('caption', 1.0 * 0.8, 'normal');
      expect(ctx.fontsSet).toContain(expectedSloganFont);
      expect(ctx.fontsSet).toContain(UIText.getFont('title', 1.0, 'bold'));
    });

    it('메인 메뉴 cardText 하위 textScale(chapter, name, sub, meta) 변경이 개별 적용된다', () => {
      const ctx = createContext();
      const renderer = new MenuRenderer();

      const cardText = UI_LAYOUT.menu.cardText as any;
      cardText.chapter.textScale = 1.2;
      cardText.name.textScale = 1.3;
      cardText.sub.textScale = 0.75;
      cardText.meta.textScale = 1.4;

      renderer.render(ctx as never, 1080, 2160, {
        unlockedChapter: 1, // Ch.2~5 locked -> lock icon text fallback
        stars: { 1: 0 },   // star text fallback if images absent
        selectedChapter: 0,
      });

      expect(ctx.fontsSet).toContain(UIText.getFont('subheading', 1.0 * 1.2, 'bold'));
      expect(ctx.fontsSet).toContain(UIText.getFont('subheading', 1.0 * 1.3, 'bold'));
      expect(ctx.fontsSet).toContain(UIText.getFont('label', 1.0 * 0.75, 'normal'));
      expect(ctx.fontsSet).toContain(UIText.getFont('heading', 1.0 * 1.4, 'bold'));
    });

    it('서브메뉴 title, guide, cardText.label, cardText.subLabel 변경이 개별 적용된다', () => {
      const ctx = createContext();
      const renderer = new MenuRenderer();

      (UI_LAYOUT.subMenu.title as any).textScale = 1.25;
      (UI_LAYOUT.subMenu as any).guide.textScale = 0.85;
      const subCardText = UI_LAYOUT.subMenu.cardText as any;
      subCardText.label.textScale = 1.15;
      subCardText.subLabel.textScale = 0.7;

      renderer.renderSubMenu(ctx as never, 1080, 2160, 1, dummySubLevels);

      expect(ctx.fontsSet).toContain(UIText.getFont('heading', 1.0 * 1.25, 'bold'));
      expect(ctx.fontsSet).toContain(UIText.getFont('label', 1.0 * 0.85, 'normal'));
      expect(ctx.fontsSet).toContain(UIText.getFont('heading', 1.0 * 1.15, 'bold'));
      expect(ctx.fontsSet).toContain(UIText.getFont('subheading', 1.0 * 0.7, 'normal'));
    });

    it('매 프레임 UI_LAYOUT에서 다시 읽는다 (동적 변경 즉시 반영)', () => {
      const renderer = new MenuRenderer();

      // 프레임 1
      const ctx1 = createContext();
      (UI_LAYOUT.menu.title as any).textScale = 1.0;
      renderer.render(ctx1 as never, 1080, 2160, dummyState);
      expect(ctx1.fontsSet).toContain(UIText.getFont('title', 1.0, 'bold'));

      // 프레임 2
      const ctx2 = createContext();
      (UI_LAYOUT.menu.title as any).textScale = 2.0;
      renderer.render(ctx2 as never, 1080, 2160, dummyState);
      expect(ctx2.fontsSet).toContain(UIText.getFont('title', 2.0, 'bold'));
      expect(ctx2.fontsSet).not.toContain(UIText.getFont('title', 1.0, 'bold'));
    });
  });

  describe('3. DevLayoutPanel 바인딩 및 규칙 연동', () => {
    it('flattenLayoutBindings에 menu/subMenu의 모든 textScale 경로가 올바른 규칙으로 노출된다', () => {
      const bindings = flattenLayoutBindings(UI_LAYOUT, []);
      const paths = bindings.map((b) => b.path);

      const expectedPaths = [
        'menu.title.textScale',
        'menu.slogan.textScale',
        'menu.cardText.chapter.textScale',
        'menu.cardText.name.textScale',
        'menu.cardText.sub.textScale',
        'menu.cardText.meta.textScale',
        'subMenu.title.textScale',
        'subMenu.guide.textScale',
        'subMenu.cardText.label.textScale',
        'subMenu.cardText.subLabel.textScale',
        'subMenu.backButton.textScale',
      ];

      for (const p of expectedPaths) {
        expect(paths).toContain(p);
        const binding = bindings.find((b) => b.path === p)!;
        expect(binding.min).toBe(0.5);
        expect(binding.max).toBe(3.0);
        expect(binding.step).toBe(0.01);
        expect(binding.integer).toBe(false);
      }
    });
  });

  describe('4. applyLayoutOverride 검증 및 오버라이드 적용', () => {
    it('유효한 textScale 오버라이드가 경고 없이 target에 적용된다', () => {
      const patch = {
        menu: {
          title: { textScale: 1.5 },
          slogan: { textScale: 1.2 },
          cardText: {
            chapter: { textScale: 1.1 },
            name: { textScale: 0.9 },
            sub: { textScale: 1.3 },
            meta: { textScale: 1.4 },
          },
        },
        subMenu: {
          title: { textScale: 1.2 },
          guide: { textScale: 0.8 },
          cardText: {
            label: { textScale: 1.15 },
            subLabel: { textScale: 0.75 },
          },
          backButton: {
            textScale: 1.05,
          },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.warnings).toEqual([]);
      expect((UI_LAYOUT.menu.title as any).textScale).toBe(1.5);
      expect((UI_LAYOUT.menu as any).slogan.textScale).toBe(1.2);
      expect((UI_LAYOUT.menu.cardText as any).chapter.textScale).toBe(1.1);
      expect((UI_LAYOUT.menu.cardText as any).name.textScale).toBe(0.9);
      expect((UI_LAYOUT.menu.cardText as any).sub.textScale).toBe(1.3);
      expect((UI_LAYOUT.menu.cardText as any).meta.textScale).toBe(1.4);
      expect((UI_LAYOUT.subMenu.title as any).textScale).toBe(1.2);
      expect((UI_LAYOUT.subMenu as any).guide.textScale).toBe(0.8);
      expect((UI_LAYOUT.subMenu.cardText as any).label.textScale).toBe(1.15);
      expect((UI_LAYOUT.subMenu.cardText as any).subLabel.textScale).toBe(0.75);
      expect((UI_LAYOUT.subMenu as any).backButton.textScale).toBe(1.05);
    });

    it('0.5 미만 또는 3.0 초과 textScale 오버라이드는 경고를 발생시키고 거부된다', () => {
      const patch = {
        menu: {
          title: { textScale: 0.49 },
          slogan: { textScale: 3.01 },
        },
        subMenu: {
          guide: { textScale: -1 },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.warnings.length).toBe(3);
      expect(result.warnings.some((w) => w.includes('menu.title.textScale'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('menu.slogan.textScale'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('subMenu.guide.textScale'))).toBe(true);
      expect((UI_LAYOUT.menu.title as any).textScale).toBe(1.0);
      expect((UI_LAYOUT.menu as any).slogan.textScale).toBe(1.0);
      expect((UI_LAYOUT.subMenu as any).guide.textScale).toBe(1.0);
    });
  });

  describe('5. 접근성(fontScale) 및 최소 하한선 유지', () => {
    it('접근성 fontScale과 textScale이 함께 곱해져 폰트 크기가 계산된다', () => {
      setFontScale(1.5);
      (UI_LAYOUT.menu.title as any).textScale = 1.2;

      const ctx = createContext();
      const renderer = new MenuRenderer();
      renderer.render(ctx as never, 1080, 2160, dummyState);

      const expectedFont = UIText.getFont('title', 1.0 * 1.2, 'bold');
      expect(ctx.fontsSet).toContain(expectedFont);
    });

    it('극단적인 축소 스케일에서도 minFloor 및 minPhysicalPx 하한선이 보장된다', () => {
      (UI_LAYOUT.menu.title as any).textScale = 0.5;

      const ctx = createContext();
      const renderer = new MenuRenderer();
      // 가로 100px로 극단적 축소
      renderer.render(ctx as never, 100, 200, dummyState);

      const expectedMinFont = UIText.getFont('title', (100 / 1080) * 0.5, 'bold');
      expect(ctx.fontsSet).toContain(expectedMinFont);
    });
  });
});
