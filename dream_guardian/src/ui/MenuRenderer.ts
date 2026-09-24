/**
 * MenuRenderer - 메인 메뉴 챕터 카드 및 서브레벨 선택 Canvas 렌더링
 *
 * Issue #142 (Card #74 / UI-MENU-002):
 * - 홈 메뉴 2-2-1 와이드 다이아몬드 그리드 및 1:1 대형 폰트 적용
 * - 서브 메뉴 2열 3행 대형 와이드 그리드 개편
 * - 레거시 가로 1열 및 상단 뒤로가기 삭제, 하단 고정 바 우측 슬롯 연동
 */

import type { SubLevelInfo } from '../types/index.js';

export const CHAPTER_INFO = [
  { name: '포겟', sub: '덧셈/뺄셈', color: '#4DFFAA' },
  { name: '후다닥', sub: '곱셈/나눗셈', color: '#28E6FF' },
  { name: '뒤죽박죽', sub: '분수', color: '#FFCB4D' },
  { name: '에라', sub: '소수', color: '#C889FF' },
  { name: '나이트메어', sub: '전 영역', color: '#FF4444' },
];

export interface MenuState {
  unlockedChapter: number;
  stars: Record<number, number>;
  selectedChapter: number;
}

export interface SubCardLayout {
  subLevel: number; // -1: Back, 0: ALL, 1~N: SubLevel
  label: string;
  subLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChapterCardLayout {
  chapter: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class MenuRenderer {
  /**
   * 챕터 카드 레이아웃 계산 (2-2-1 와이드 다이아몬드 레이아웃, Issue #142 / UI-MENU-002)
   * 1080x2160 가상 해상도 기준:
   * - 개별 카드: 360 x 380px
   * - 1행: Ch.1 (120, 460), Ch.2 (600, 460)
   * - 2행: Ch.3 (120, 920), Ch.4 (600, 920)
   * - 3행: Ch.5 (360, 1380, 중앙 정렬)
   */
  getChapterLayouts(w: number, h: number): ChapterCardLayout[] {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const cardW = 360 * scaleX;
    const cardH = 380 * scaleY;

    return [
      { chapter: 1, x: 120 * scaleX, y: 460 * scaleY, w: cardW, h: cardH },
      { chapter: 2, x: 600 * scaleX, y: 460 * scaleY, w: cardW, h: cardH },
      { chapter: 3, x: 120 * scaleX, y: 920 * scaleY, w: cardW, h: cardH },
      { chapter: 4, x: 600 * scaleX, y: 920 * scaleY, w: cardW, h: cardH },
      { chapter: 5, x: 360 * scaleX, y: 1380 * scaleY, w: cardW, h: cardH },
    ];
  }

  /**
   * 메인 챕터 선택 메뉴 렌더링 (2-2-1 와이드 다이아몬드 레이아웃)
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, state: MenuState): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. 상단 타이틀 영역 (Red Box: x: 140, y: 180, w: 800, h: 220)
    const titleCenterY = 260 * scaleY;
    ctx.font = `bold ${Math.round(76 * scaleX)}px sans-serif`;
    ctx.fillStyle = '#C889FF';
    ctx.shadowColor = '#C889FF';
    ctx.shadowBlur = 16 * scaleX;
    ctx.fillText('꿈의 수호신', w / 2, titleCenterY);
    ctx.shadowBlur = 0;

    // 슬로건
    ctx.font = `${Math.round(32 * scaleX)}px sans-serif`;
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText('생각하는 힘이, 나를 지킨다', w / 2, titleCenterY + 70 * scaleY);

    // 2. 챕터 카드 5개 (2-2-1 와이드 다이아몬드)
    const layouts = this.getChapterLayouts(w, h);

    for (let i = 0; i < layouts.length; i++) {
      const item = layouts[i];
      const info = CHAPTER_INFO[i];
      const ch = item.chapter;
      const locked = ch > state.unlockedChapter;
      const selected = ch === state.selectedChapter;

      // 카드 배경 및 테두리 (라운드 코너 24px)
      ctx.fillStyle = locked ? 'rgba(255, 255, 255, 0.03)' : `${info.color}15`;
      ctx.strokeStyle = locked ? 'rgba(255, 255, 255, 0.15)' : selected ? info.color : `${info.color}75`;
      ctx.lineWidth = selected ? 4.0 * scaleX : 2.5 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(item.x, item.y, item.w, item.h, 24 * scaleX);
      } else {
        ctx.rect(item.x, item.y, item.w, item.h);
      }
      ctx.fill();
      ctx.stroke();

      // 카드 내부 텍스트 (칸별 높이 1:1 매핑)
      // 1) 챕터 번호 (Ch.X): bold 64px
      ctx.fillStyle = locked ? '#555555' : info.color;
      ctx.font = `bold ${Math.round(64 * scaleX)}px sans-serif`;
      ctx.fillText(`Ch.${ch}`, item.x + item.w / 2, item.y + 90 * scaleY);

      // 2) 챕터명: bold 48px
      ctx.fillStyle = locked ? '#444444' : '#FFFFFF';
      ctx.font = `bold ${Math.round(48 * scaleX)}px sans-serif`;
      ctx.fillText(locked ? '???' : info.name, item.x + item.w / 2, item.y + 200 * scaleY);

      // 3) 별점 (★★★) 또는 잠금 (🔒)
      if (!locked) {
        const starCount = state.stars[ch] ?? 0;
        const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
        ctx.font = `${Math.round(42 * scaleX)}px sans-serif`;
        ctx.fillStyle = '#FFCB4D';
        ctx.fillText(starStr, item.x + item.w / 2, item.y + 305 * scaleY);
      } else {
        ctx.font = `${Math.round(54 * scaleX)}px sans-serif`;
        ctx.fillStyle = '#555555';
        ctx.fillText('🔒', item.x + item.w / 2, item.y + 305 * scaleY);
      }
    }

    ctx.restore();
  }

  /**
   * 서브레벨 카드 레이아웃 계산 (2열 3행 대형 와이드 레이아웃, Issue #142 / UI-MENU-002)
   * 1080x2160 가상 해상도 기준:
   * - 개별 카드: 420 x 380px (간격 gapX: 80, gapY: 60)
   * - 1행: (80, 440), (580, 440)
   * - 2행: (80, 880), (580, 880)
   * - 3행: (80, 1320), (580, 1320)
   * - 뒤로가기 버튼 (-1): 하단 고정 바 우측 슬롯 (780, 1990, 270, 140)
   */
  getSubMenuLayouts(w: number, h: number, _chapter: number, subLevels: SubLevelInfo[]): SubCardLayout[] {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const layouts: SubCardLayout[] = [];

    // 1. 단계 목록 + 전체 종합(ALL)
    const allItems = [
      ...subLevels.map((s) => ({
        subLevel: s.subLevel,
        label: s.title || `단계 ${s.subLevel}`,
        subLabel: `${s.count}문항`,
      })),
      {
        subLevel: 0,
        label: '전체 종합 (ALL)',
        subLabel: '전체 혼합 풀',
      },
    ];

    const cardW = 420 * scaleX;
    const cardH = 380 * scaleY;
    const startX = 80 * scaleX;
    const startY = 440 * scaleY;
    const gapX = 80 * scaleX;
    const gapY = 60 * scaleY;
    const cols = 2;

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = startX + c * (cardW + gapX);
      const y = startY + r * (cardH + gapY);

      layouts.push({
        subLevel: item.subLevel,
        label: item.label,
        subLabel: item.subLabel,
        x,
        y,
        w: cardW,
        h: cardH,
      });
    }

    // 2. 뒤로가기 버튼: 하단 고정 바 우측 슬롯 연동 (x: 780, y: 1990, w: 270, h: 140)
    layouts.push({
      subLevel: -1,
      label: '← 뒤로',
      subLabel: '챕터 선택',
      x: 780 * scaleX,
      y: 1990 * scaleY,
      w: 270 * scaleX,
      h: 140 * scaleY,
    });

    return layouts;
  }

  /**
   * 서브레벨(세부 난이도) 선택 메뉴 렌더링 (2열 3행 대형 와이드 레이아웃)
   */
  renderSubMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    chapter: number,
    subLevels: SubLevelInfo[],
    selectedSubLevel?: number,
  ): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const chInfo = CHAPTER_INFO[chapter - 1] || CHAPTER_INFO[0];
    const layouts = this.getSubMenuLayouts(w, h, chapter, subLevels);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. 상단 헤더 영역 (Red Box: x: 80, y: 160, w: 920, h: 200)
    const titleCenterY = 240 * scaleY;
    ctx.font = `bold ${Math.round(56 * scaleX)}px sans-serif`;
    ctx.fillStyle = chInfo.color;
    ctx.shadowColor = chInfo.color;
    ctx.shadowBlur = 12 * scaleX;
    ctx.fillText(`Ch.${chapter} ${chInfo.name} - 단계 선택`, w / 2, titleCenterY);
    ctx.shadowBlur = 0;

    // 안내 문구: 28px
    ctx.font = `${Math.round(28 * scaleX)}px sans-serif`;
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText(`${chInfo.sub} 집중 학습 단계를 선택하세요`, w / 2, titleCenterY + 65 * scaleY);

    // 2. 단계 카드 6개 (2열 3행)
    for (const item of layouts) {
      if (item.subLevel === -1) {
        // 뒤로가기 버튼은 BottomBar에서 하단 고정 바 우측 슬롯으로 전담 렌더링
        continue;
      }

      const isAll = item.subLevel === 0;
      const isSelected = selectedSubLevel !== undefined && item.subLevel === selectedSubLevel;
      const baseColor = isAll ? '#FFCB4D' : chInfo.color;

      // 카드 배경 및 테두리 (라운드 코너 24px)
      ctx.fillStyle = isSelected ? `${baseColor}25` : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = isSelected ? baseColor : `${baseColor}75`;
      ctx.lineWidth = isSelected ? 4.0 * scaleX : 2.5 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(item.x, item.y, item.w, item.h, 24 * scaleX);
      } else {
        ctx.rect(item.x, item.y, item.w, item.h);
      }
      ctx.fill();
      ctx.stroke();

      // 카드 내부 텍스트 (1:1 매핑)
      // 1) 단계 타이틀: bold 68px
      ctx.fillStyle = isAll ? '#FFCB4D' : '#FFFFFF';
      ctx.font = `bold ${Math.round(68 * scaleX)}px sans-serif`;
      ctx.fillText(item.label, item.x + item.w / 2, item.y + 160 * scaleY);

      // 2) 서브 문항수: 32px
      ctx.fillStyle = '#AAAAAA';
      ctx.font = `${Math.round(32 * scaleX)}px sans-serif`;
      ctx.fillText(item.subLabel, item.x + item.w / 2, item.y + 280 * scaleY);
    }

    ctx.restore();
  }

  /**
   * 클릭 좌표로 챕터 선택 판정 (getChapterLayouts와 100% 동기화, Issue #133: padding 지원)
   * @param padding 히트박스 여유 마진 (픽셀 단위, 기본값 0)
   * @returns 선택된 챕터 (1~5) 또는 0
   */
  hitTest(x: number, y: number, w: number, h: number, padding = 0): number {
    const layouts = this.getChapterLayouts(w, h);
    for (const card of layouts) {
      if (
        x >= card.x - padding &&
        x <= card.x + card.w + padding &&
        y >= card.y - padding &&
        y <= card.y + card.h + padding
      ) {
        return card.chapter;
      }
    }
    return 0;
  }

  /**
   * 서브레벨 클릭 판정 (getSubMenuLayouts와 100% 동기화, Issue #133: padding 지원)
   * @param padding 히트박스 여유 마진 (픽셀 단위, 기본값 0)
   * @returns -1: 뒤로가기, 0: 전체, 1~N: 서브레벨 번호, null: 클릭 안 됨
   */
  hitTestSub(
    x: number,
    y: number,
    w: number,
    h: number,
    chapter: number,
    subLevels: SubLevelInfo[],
    padding = 0,
  ): number | null {
    const layouts = this.getSubMenuLayouts(w, h, chapter, subLevels);
    for (const item of layouts) {
      if (
        x >= item.x - padding &&
        x <= item.x + item.w + padding &&
        y >= item.y - padding &&
        y <= item.y + item.h + padding
      ) {
        return item.subLevel;
      }
    }
    return null;
  }
}
