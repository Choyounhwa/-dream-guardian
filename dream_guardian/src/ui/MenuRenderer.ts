/**
 * MenuRenderer - 메인 메뉴 챕터 카드 및 서브레벨 선택 Canvas 렌더링
 *
 * 5개 챕터 카드, 해금/잠금 시각화 및 서브레벨(세부 난이도) 그리드 UI
 *
 * @see Issue #22 (GitHub #87), Issue #103, Issue #115 (Card #103-B)
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

export class MenuRenderer {
  /**
   * 메인 챕터 선택 메뉴 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, state: MenuState): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleY = h * 0.18;
    ctx.font = `bold ${Math.min(48, w * 0.04)}px sans-serif`;
    ctx.fillStyle = '#C889FF';
    ctx.fillText('꿈의 수호신', w / 2, titleY);

    ctx.font = `${Math.min(18, w * 0.015)}px sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText('생각하는 힘이, 나를 지킨다', w / 2, titleY + 40);

    // 챕터 카드
    const cardW = Math.min(140, w * 0.12);
    const cardH = cardW * 0.7;
    const gap = 16;
    const totalW = CHAPTER_INFO.length * cardW + (CHAPTER_INFO.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const cardY = h * 0.42;

    for (let i = 0; i < CHAPTER_INFO.length; i++) {
      const info = CHAPTER_INFO[i];
      const ch = i + 1;
      const x = startX + i * (cardW + gap);
      const locked = ch > state.unlockedChapter;
      const selected = ch === state.selectedChapter;

      // 카드 배경
      ctx.fillStyle = locked ? 'rgba(255,255,255,0.03)' : `${info.color}10`;
      ctx.strokeStyle = locked ? 'rgba(255,255,255,0.1)' : selected ? info.color : `${info.color}60`;
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      // 챕터 번호
      ctx.fillStyle = locked ? '#444' : info.color;
      ctx.font = `bold ${cardW * 0.18}px sans-serif`;
      ctx.fillText(`Ch.${ch}`, x + cardW / 2, cardY + cardH * 0.35);

      // 이름
      ctx.font = `${cardW * 0.11}px sans-serif`;
      ctx.fillText(locked ? '???' : info.name, x + cardW / 2, cardY + cardH * 0.6);

      // 별
      if (!locked) {
        const starCount = state.stars[ch] ?? 0;
        const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
        ctx.font = `${cardW * 0.1}px sans-serif`;
        ctx.fillStyle = '#FFCB4D';
        ctx.fillText(starStr, x + cardW / 2, cardY + cardH * 0.82);
      }

      // 잠금 아이콘
      if (locked) {
        ctx.font = `${cardW * 0.2}px sans-serif`;
        ctx.fillStyle = '#444';
        ctx.fillText('🔒', x + cardW / 2, cardY + cardH * 0.82);
      }
    }

    // 안내 텍스트
    ctx.font = `${Math.min(14, w * 0.012)}px sans-serif`;
    ctx.fillStyle = '#666';
    ctx.fillText('챕터를 클릭하거나 1~5 키를 눌러 시작', w / 2, h * 0.75);
  }

  /**
   * 서브레벨 카드 레이아웃 계산 (렌더링 및 히트테스트 공통)
   */
  getSubMenuLayouts(w: number, h: number, _chapter: number, subLevels: SubLevelInfo[]): SubCardLayout[] {
    const layouts: SubCardLayout[] = [];

    // 1. 뒤로가기 버튼
    const backW = Math.min(160, w * 0.18);
    const backH = 40;
    layouts.push({
      subLevel: -1,
      label: '← 뒤로가기',
      subLabel: '챕터 선택으로',
      x: w * 0.5 - backW / 2,
      y: h * 0.14,
      w: backW,
      h: backH,
    });

    // 2. 서브레벨 목록 + 전체 선택 카드
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

    const cols = w > 800 ? Math.min(4, allItems.length) : 2;
    const cardW = Math.min(220, (w * 0.85) / cols - 16);
    const cardH = cardW * 0.52;
    const gapX = 16;
    const gapY = 14;

    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (w - gridW) / 2;
    const startY = h * 0.32;

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

    return layouts;
  }

  /**
   * 서브레벨(세부 난이도) 선택 메뉴 렌더링
   */
  renderSubMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    chapter: number,
    subLevels: SubLevelInfo[],
    selectedSubLevel?: number,
  ): void {
    const chInfo = CHAPTER_INFO[chapter - 1] || CHAPTER_INFO[0];
    const layouts = this.getSubMenuLayouts(w, h, chapter, subLevels);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 챕터 헤더 타이틀
    const titleY = h * 0.22;
    ctx.font = `bold ${Math.min(36, w * 0.032)}px sans-serif`;
    ctx.fillStyle = chInfo.color;
    ctx.fillText(`Ch.${chapter} ${chInfo.name} - 세부 난이도 선택`, w / 2, titleY);

    ctx.font = `${Math.min(16, w * 0.014)}px sans-serif`;
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`${chInfo.sub} 집중 학습 단계를 선택하세요`, w / 2, titleY + 34);

    // 카드 렌더링
    for (const item of layouts) {
      const isBack = item.subLevel === -1;
      const isAll = item.subLevel === 0;
      const isSelected = selectedSubLevel !== undefined && item.subLevel === selectedSubLevel;

      if (isBack) {
        // 뒤로가기 버튼
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.w, item.h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.min(14, w * 0.013)}px sans-serif`;
        ctx.fillText(item.label, item.x + item.w / 2, item.y + item.h / 2);
      } else {
        // 서브레벨 카드
        const baseColor = isAll ? '#FFCB4D' : chInfo.color;
        ctx.fillStyle = isSelected ? `${baseColor}25` : 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = isSelected ? baseColor : `${baseColor}60`;
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.w, item.h, 10);
        ctx.fill();
        ctx.stroke();

        // 라벨 (서브레벨 제목)
        ctx.fillStyle = isAll ? '#FFCB4D' : '#FFFFFF';
        ctx.font = `bold ${Math.min(16, item.w * 0.09)}px sans-serif`;
        ctx.fillText(item.label, item.x + item.w / 2, item.y + item.h * 0.38);

        // 부제 (문항 수)
        ctx.fillStyle = '#888888';
        ctx.font = `${Math.min(13, item.w * 0.075)}px sans-serif`;
        ctx.fillText(item.subLabel, item.x + item.w / 2, item.y + item.h * 0.72);
      }
    }

    // 하단 키보드 힌트
    ctx.font = `${Math.min(14, w * 0.012)}px sans-serif`;
    ctx.fillStyle = '#666';
    ctx.fillText('단계를 클릭하여 시작하거나 Esc/0 키로 뒤로가기', w / 2, h * 0.90);
  }

  /**
   * 클릭 좌표로 챕터 선택 판정
   * @returns 선택된 챕터 (1~5) 또는 0
   */
  hitTest(x: number, y: number, w: number, h: number): number {
    const cardW = Math.min(140, w * 0.12);
    const cardH = cardW * 0.7;
    const gap = 16;
    const totalW = 5 * cardW + 4 * gap;
    const startX = (w - totalW) / 2;
    const cardY = h * 0.42;

    for (let i = 0; i < 5; i++) {
      const cx = startX + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
        return i + 1;
      }
    }
    return 0;
  }

  /**
   * 서브레벨 클릭 판정
   * @returns -1: 뒤로가기, 0: 전체, 1~N: 서브레벨 번호, null: 클릭 안 됨
   */
  hitTestSub(x: number, y: number, w: number, h: number, chapter: number, subLevels: SubLevelInfo[]): number | null {
    const layouts = this.getSubMenuLayouts(w, h, chapter, subLevels);
    for (const item of layouts) {
      if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
        return item.subLevel;
      }
    }
    return null;
  }
}
