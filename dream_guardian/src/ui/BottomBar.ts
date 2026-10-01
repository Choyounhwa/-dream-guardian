/**
 * BottomBar - 전 화면 공통 하단 고정 바 (Issue #141 / UI-BAR-001)
 *
 * 1080x2160 가상 해상도 기준 y: 1960px, h: 200px
 * 좌측: ⚙ 설정 버튼 (140x140)
 * 우측: 각 페이즈별 액션 버튼 슬롯 (240x140 기본, 커스텀 슬롯 지원)
 */

import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';

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
  mana?: number;
  manaMax?: number;
  combo?: number;
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

    // 1. 하단 바 배경 (반투명 다크 네이비 또는 이미지)
    const barBgImg = imageLoader.get('bottomBar', 'barBg');
    if (barBgImg) {
      ctx.drawImage(barBgImg, 0, barY, w, barH);
    } else {
      ctx.fillStyle = 'rgba(10, 14, 26, 0.92)';
      ctx.fillRect(0, barY, w, barH);

      // 2. 상단 2px 네온 골드 구분선
      ctx.strokeStyle = '#FFCB4D';
      ctx.lineWidth = 2 * scaleY;
      ctx.beginPath();
      ctx.moveTo(0, barY);
      ctx.lineTo(w, barY);
      ctx.stroke();
    }

    // 3. 좌측 "⚙ 설정" 버튼 (Cyan Box)
    const sBtn = BOTTOM_BAR_CONFIG.settingsBtn;
    const sx = sBtn.x * scaleX;
    const sy = sBtn.y * scaleY;
    const sw = sBtn.w * scaleX;
    const sh = sBtn.h * scaleY;
    const sRadius = 20 * scaleX;

    const settingsIconImg = imageLoader.get('bottomBar', 'settingsIcon');
    if (settingsIconImg) {
      ctx.drawImage(settingsIconImg, sx, sy, sw, sh);
    } else {
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
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.fillStyle = '#28E6FF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚙ 설정', sx + sw / 2, sy + sh / 2);
    }

    // 설정 버튼 호버 게이지 아크
    if (options?.settingsHoverProgress && options.settingsHoverProgress > 0) {
      const progress = Math.min(1, Math.max(0, options.settingsHoverProgress));
      ctx.strokeStyle = '#28E6FF';
      ctx.lineWidth = 5 * scaleX;
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, (sw / 2) + 6 * scaleX, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
      ctx.stroke();
    }

    // 4. 중앙 수평 마나 게이지 & 콤보 배지 (Issue #143)
    if (options?.mana !== undefined) {
      const mana = Math.max(0, options.mana);
      const manaMax = options.manaMax || 100;
      const ratio = Math.min(1, mana / manaMax);

      const mx = 210 * scaleX;
      const my = 2038 * scaleY;
      const mw = 560 * scaleX;
      const mh = 50 * scaleY;
      const mRadius = 14 * scaleX;

      // 콤보 표시
      if (options.combo && options.combo > 1) {
        ctx.font = UIText.getFont('label', scaleX, 'bold');
        ctx.fillStyle = '#FFCB4D';
        ctx.shadowColor = '#FFCB4D';
        ctx.shadowBlur = 10 * scaleX;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`🔥 COMBO x${options.combo}`, mx + mw / 2, my - 4 * scaleY);
        ctx.shadowBlur = 0;
      }

      // 마나 게이지 배경
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.strokeStyle = 'rgba(200, 137, 255, 0.5)';
      ctx.lineWidth = 2 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(mx, my, mw, mh, mRadius);
      } else {
        ctx.rect(mx, my, mw, mh);
      }
      ctx.fill();
      ctx.stroke();

      // 마나 게이지 채우기
      if (ratio > 0) {
        const fillW = Math.max(mRadius * 2, mw * ratio);
        const mGrad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
        mGrad.addColorStop(0, '#C889FF');
        mGrad.addColorStop(1, '#FF65C3');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(mx, my, fillW, mh, mRadius);
        } else {
          ctx.rect(mx, my, fillW, mh);
        }
        ctx.fill();
      }

      // 마나 텍스트 라벨
      ctx.font = UIText.getFont('label', scaleX, 'bold');
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4 * scaleX;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`MANA ${Math.round(mana)} / ${manaMax}`, mx + mw / 2, my + mh / 2);
      ctx.shadowBlur = 0;
    }

    // 5. 우측 액션 버튼
    if (options?.actionLabel) {
      const aSlot = options.customActionSlot ?? BOTTOM_BAR_CONFIG.actionBtn;
      const ax = aSlot.x * scaleX;
      const ay = aSlot.y * scaleY;
      const aw = aSlot.w * scaleX;
      const ah = aSlot.h * scaleY;
      const aColor = options.actionColor ?? '#FF4444';
      const aRadius = 20 * scaleX;

      const actionBtnImg = imageLoader.get('bottomBar', 'actionButton');
      if (actionBtnImg) {
        ctx.drawImage(actionBtnImg, ax, ay, aw, ah);
      } else {
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

        ctx.font = UIText.getFont('body', scaleX, 'bold');
        ctx.fillStyle = aColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.actionLabel, ax + aw / 2, ay + ah / 2);
      }

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
