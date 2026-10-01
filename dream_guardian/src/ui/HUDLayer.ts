/**
 * HUDLayer - 스트리트파이터 스타일 듀얼 HP HUD, 마나 플라스크, 실드
 *
 * Canvas 2D로 직접 렌더링하는 인게임 HUD
 * 체력/마나 부드러운 감쇠 애니메이션
 *
 * @see Issue #21 (GitHub #86)
 */

import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import { getBossName } from '../data/bossData.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import {
  LOCOMOTION_HUD_GUIDES,
  type LocomotionHUDGuide,
} from '../../config/locomotion.config.js';

export { LOCOMOTION_HUD_GUIDES };
export type { LocomotionHUDGuide };

export interface HUDData {
  playerHp: number;
  playerMaxHp: number;
  bossHp: number;
  bossMaxHp: number;
  combo: number;
  chapter: number;
  guardianStage: number;
}

export class HUDLayer {
  private _displayPlayerHp = 1;
  private _displayBossHp = 1;

  /**
   * 매 프레임 호출: 부드러운 감쇠 보간
   */
  update(dt: number, data: HUDData): void {
    const lerpSpeed = 5;
    const targetPHp = data.playerHp / data.playerMaxHp;
    const targetBHp = data.bossHp / data.bossMaxHp;

    this._displayPlayerHp += (targetPHp - this._displayPlayerHp) * lerpSpeed * dt;
    this._displayBossHp += (targetBHp - this._displayBossHp) * lerpSpeed * dt;
  }

  /**
   * Canvas에 HUD 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, _h: number, data: HUDData): void {
    this._renderHpBars(ctx, w, data);
    this._renderCombo(ctx, w, data);
    this._renderBossName(ctx, w, data);
  }

  private _renderHpBars(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    // Issue #132: 1m+ 원거리 가독성을 위한 HP바 및 수치 텍스트 대형화 (UI_LAYOUT 슬롯 참조)
    const hpSlot = UI_LAYOUT.hud.playerHpBar;
    const barW = Math.min(hpSlot.w, w * 0.28);
    const barH = hpSlot.h;
    const y = hpSlot.y;
    const pad = hpSlot.x;

    // 플레이어 HP (좌측)
    const playerImg = imageLoader.get('hud', 'playerHpBar');
    if (playerImg) {
      ctx.drawImage(playerImg, pad, y, barW, barH);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pad, y, barW, barH);
      const pGrad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
      pGrad.addColorStop(0, '#28E6FF');
      pGrad.addColorStop(1, '#4DFFAA');
      ctx.fillStyle = pGrad;
      ctx.fillRect(pad, y, barW * Math.max(0, this._displayPlayerHp), barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(pad, y, barW, barH);
    }

    // 라벨 (18px 볼드 + 섀도우)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    ctx.font = UIText.getFont('caption', 1.0, 'bold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP ${data.playerHp}/${data.playerMaxHp}`, pad + 8, y + barH / 2);
    ctx.restore();

    // 보스 HP (우측)
    const bx = w - pad - barW;
    const bossImg = imageLoader.get('hud', 'bossHpBar');
    if (bossImg) {
      ctx.drawImage(bossImg, bx, y, barW, barH);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, y, barW, barH);
      const bGrad = ctx.createLinearGradient(bx + barW, 0, bx, 0);
      bGrad.addColorStop(0, '#FF4444');
      bGrad.addColorStop(1, '#FF8844');
      ctx.fillStyle = bGrad;
      const bossBarW = barW * Math.max(0, this._displayBossHp);
      ctx.fillRect(bx + barW - bossBarW, y, bossBarW, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, y, barW, barH);
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = UIText.getFont('caption', 1.0, 'bold');
    ctx.fillText(`HP ${data.bossHp}/${data.bossMaxHp}`, bx + barW - 8, y + barH / 2);
    ctx.restore();
  }

  private _renderCombo(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    if (data.combo <= 0) return;
    const badgeSlot = UI_LAYOUT.hud.comboBadge ?? { w: 160, h: 48, y: 48, marginRight: 24 };
    const comboImg = imageLoader.get('hud', 'comboBadge');
    if (comboImg) {
      const badgeW = badgeSlot.w;
      const badgeH = badgeSlot.h;
      ctx.drawImage(comboImg, w - badgeW - badgeSlot.marginRight, badgeSlot.y, badgeW, badgeH);
    }
    ctx.save();
    ctx.shadowColor = data.combo >= 5 ? '#FFCB4D' : '#28E6FF';
    ctx.shadowBlur = 10;
    ctx.fillStyle = data.combo >= 5 ? '#FFCB4D' : '#fff';
    ctx.font = UIText.getFont(data.combo >= 5 ? 'body' : 'badge', 1.0, 'bold');
    ctx.textAlign = 'right';
    ctx.fillText(`COMBO x${data.combo}`, w - badgeSlot.marginRight, 76);
    ctx.restore();
  }

  private _renderBossName(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    ctx.save();
    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#FFCB4D';
    ctx.font = UIText.getFont('badge', 1.0, 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`Ch.${data.chapter} ${getBossName(data.chapter)}`, w / 2, 36);
    ctx.restore();
  }

  /**
   * 선택된 운동 모드의 인게임 모션 가이드 조회 (Issue #155)
   */
  getLocomotionGuide(mode: LocomotionMode = 'run'): LocomotionHUDGuide {
    return LOCOMOTION_HUD_GUIDES[mode] ?? LOCOMOTION_HUD_GUIDES.run;
  }

  reset(): void {
    this._displayPlayerHp = 1;
    this._displayBossHp = 1;
  }
}
