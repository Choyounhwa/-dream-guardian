/**
 * BottomBar - 전 화면 공통 하단 고정 바 (Issue #141 / UI-BAR-001)
 *
 * 1080x2160 가상 해상도 기준 y: 1960px, h: 200px
 * 좌측: ⚙ 설정 버튼 (140x140)
 * 우측: 각 페이즈별 액션 버튼 슬롯 (240x140 기본, 커스텀 슬롯 지원)
 */

export interface BottomBarSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BOTTOM_BAR_CONFIG = {
  height: 200,
  y: 1960,
  settingsBtn: { x: 30, y: 1990, w: 140, h: 140 },
  actionBtn: { x: 810, y: 1990, w: 240, h: 140 },
};

export interface BottomBarRenderOptions {
  actionLabel?: string;
  actionColor?: string;
  customActionSlot?: BottomBarSlot;
  settingsHoverProgress?: number;
  actionHoverProgress?: number;
}

export class BottomBar {
  /**
   * 설정 버튼 히트 테스트
   */
  hitTestSettings(x: number, y: number, w: number, h: number, padding: number = 0): boolean {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const btn = BOTTOM_BAR_CONFIG.settingsBtn;
    const bx = btn.x * scaleX;
    const by = btn.y * scaleY;
    const bw = btn.w * scaleX;
    const bh = btn.h * scaleY;
    return x >= bx - padding && x <= bx + bw + padding && y >= by - padding && y <= by + bh + padding;
  }

  /**
   * 우측 액션 버튼 히트 테스트
   */
  hitTestAction(
    x: number,
    y: number,
    w: number,
    h: number,
    padding: number = 0,
    customSlot?: BottomBarSlot
  ): boolean {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const slot = customSlot ?? BOTTOM_BAR_CONFIG.actionBtn;
    const bx = slot.x * scaleX;
    const by = slot.y * scaleY;
    const bw = slot.w * scaleX;
    const bh = slot.h * scaleY;
    return x >= bx - padding && x <= bx + bw + padding && y >= by - padding && y <= by + bh + padding;
  }

  /**
   * 공통 하단 바 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, options?: BottomBarRenderOptions): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const barY = BOTTOM_BAR_CONFIG.y * scaleY;
    const barH = BOTTOM_BAR_CONFIG.height * scaleY;

    ctx.save();

    // 1. 하단 바 배경 (반투명 다크 네이비)
    ctx.fillStyle = 'rgba(10, 14, 26, 0.92)';
    ctx.fillRect(0, barY, w, barH);

    // 2. 상단 2px 네온 골드 구분선
    ctx.strokeStyle = '#FFCB4D';
    ctx.lineWidth = 2 * scaleY;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(w, barY);
    ctx.stroke();

    // 3. 좌측 "⚙ 설정" 버튼 (Cyan Box)
    const sBtn = BOTTOM_BAR_CONFIG.settingsBtn;
    const sx = sBtn.x * scaleX;
    const sy = sBtn.y * scaleY;
    const sw = sBtn.w * scaleX;
    const sh = sBtn.h * scaleY;
    const sRadius = 20 * scaleX;

    ctx.fillStyle = 'rgba(40, 230, 255, 0.12)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 3 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(sx, sy, sw, sh, sRadius);
    } else {
      ctx.rect(sx, sy, sw, sh);
    }
    ctx.fill();
    ctx.stroke();

    // 설정 텍스트
    ctx.font = `bold ${Math.round(36 * scaleX)}px sans-serif`;
    ctx.fillStyle = '#28E6FF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚙ 설정', sx + sw / 2, sy + sh / 2);

    // 설정 버튼 호버 게이지 아크
    if (options?.settingsHoverProgress && options.settingsHoverProgress > 0) {
      const progress = Math.min(1, Math.max(0, options.settingsHoverProgress));
      ctx.strokeStyle = '#28E6FF';
      ctx.lineWidth = 5 * scaleX;
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, (sw / 2) + 6 * scaleX, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
      ctx.stroke();
    }

    // 4. 우측 액션 버튼
    if (options?.actionLabel) {
      const aSlot = options.customActionSlot ?? BOTTOM_BAR_CONFIG.actionBtn;
      const ax = aSlot.x * scaleX;
      const ay = aSlot.y * scaleY;
      const aw = aSlot.w * scaleX;
      const ah = aSlot.h * scaleY;
      const aColor = options.actionColor ?? '#FF4444';
      const aRadius = 20 * scaleX;

      ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
      ctx.strokeStyle = aColor;
      ctx.lineWidth = 3 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(ax, ay, aw, ah, aRadius);
      } else {
        ctx.rect(ax, ay, aw, ah);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = `bold ${Math.round(36 * scaleX)}px sans-serif`;
      ctx.fillStyle = aColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.actionLabel, ax + aw / 2, ay + ah / 2);

      // 액션 버튼 호버 게이지 아크
      if (options.actionHoverProgress && options.actionHoverProgress > 0) {
        const progress = Math.min(1, Math.max(0, options.actionHoverProgress));
        ctx.strokeStyle = aColor;
        ctx.lineWidth = 5 * scaleX;
        ctx.beginPath();
        ctx.arc(ax + aw / 2, ay + ah / 2, (ah / 2) + 6 * scaleX, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
