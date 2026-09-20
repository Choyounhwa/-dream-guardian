/**
 * MenuRenderer - 메인 메뉴 챕터 카드 Canvas 렌더링
 *
 * 5개 챕터 카드, 해금/잠금 시각화
 * Canvas 기반 렌더링 (HTML 오버레이와 독립)
 *
 * @see Issue #22 (GitHub #87)
 */

const CHAPTER_INFO = [
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

export class MenuRenderer {
  /**
   * Canvas에 메뉴 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, state: MenuState): void {
    // 타이틀
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
      ctx.strokeStyle = locked ? 'rgba(255,255,255,0.1)' : (selected ? info.color : `${info.color}60`);
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
}
