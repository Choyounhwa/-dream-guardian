/**
 * HUDLayer - 스트리트파이터 스타일 듀얼 HP HUD, 마나 플라스크, 실드
 *
 * Canvas 2D로 직접 렌더링하는 인게임 HUD
 * 체력/마나 부드러운 감쇠 애니메이션
 *
 * @see Issue #21 (GitHub #86)
 */

import type { LocomotionMode } from '../motion/LocomotionDetector.js';

const BOSS_NAMES = ['', '포겟', '후다닥', '뒤죽박죽', '에라', '나이트메어'];

export interface LocomotionHUDGuide {
  icon: string;
  title: string;
  subtitle: string;
  countLabel: string;
}

/** 운동 모드별 인게임 모션 가이드 문구 (Issue #155 / FEAT-GAME-002) */
export const LOCOMOTION_HUD_GUIDES: Record<LocomotionMode, LocomotionHUDGuide> = {
  run: {
    icon: '🏃',
    title: '가볍게 제자리에서 달리세요!',
    subtitle: '발을 구르거나 [Space] / 화면을 탭하세요',
    countLabel: '🏃 걸음 수',
  },
  hip_bounce: {
    icon: '🦘',
    title: '무릎을 굽혔다 펴며 골반을 바운스하세요!',
    subtitle: '골반을 상하로 가볍게 바운스하거나 [Space]를 탭하세요',
    countLabel: '🦘 바운스',
  },
  hip_sway: {
    icon: '💃',
    title: '골반을 좌우로 흔들어 코어를 자극하세요!',
    subtitle: '골반을 좌우로 흔들거나 [Space]를 탭하세요',
    countLabel: '💃 스웨이',
  },
  arm_cross: {
    icon: '🚗',
    title: '양손을 위아래로 교차하며 핸들을 돌리세요!',
    subtitle: '양손을 위아래로 교차하며 펌핑하거나 [Space]를 탭하세요',
    countLabel: '🚗 휠 펌핑',
  },
};

export interface HUDData {
  playerHp: number;
  playerMaxHp: number;
  bossHp: number;
  bossMaxHp: number;
  mana: number;
  manaMax: number;
  combo: number;
  chapter: number;
  shieldActive: boolean;
  guardianStage: number;
}

export class HUDLayer {
  private _displayPlayerHp = 1;
  private _displayBossHp = 1;
  private _displayMana = 0;
  private _shieldAlpha = 0;

  /**
   * 매 프레임 호출: 부드러운 감쇠 보간
   */
  update(dt: number, data: HUDData): void {
    const lerpSpeed = 5;
    const targetPHp = data.playerHp / data.playerMaxHp;
    const targetBHp = data.bossHp / data.bossMaxHp;
    const targetMana = data.mana / data.manaMax;

    this._displayPlayerHp += (targetPHp - this._displayPlayerHp) * lerpSpeed * dt;
    this._displayBossHp += (targetBHp - this._displayBossHp) * lerpSpeed * dt;
    this._displayMana += (targetMana - this._displayMana) * lerpSpeed * dt;

    // 실드 알파
    const targetShield = data.shieldActive ? 0.6 : 0;
    this._shieldAlpha += (targetShield - this._shieldAlpha) * 8 * dt;
  }

  /**
   * Canvas에 HUD 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, data: HUDData): void {
    this._renderHpBars(ctx, w, data);
    this._renderCombo(ctx, w, data);
    this._renderBossName(ctx, w, data);

    if (this._shieldAlpha > 0.01) {
      this._renderShield(ctx, w, h);
    }
  }

  private _renderHpBars(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    // Issue #132: 1m+ 원거리 가독성을 위한 HP바 및 수치 텍스트 대형화
    const barW = Math.min(320, w * 0.28);
    const barH = 32;
    const y = 20;
    const pad = 20;

    // 플레이어 HP (좌측)
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

    // 라벨 (18px 볼드 + 섀도우)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP ${data.playerHp}/${data.playerMaxHp}`, pad + 8, y + barH / 2);
    ctx.restore();

    // 보스 HP (우측)
    const bx = w - pad - barW;
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

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`HP ${data.bossHp}/${data.bossMaxHp}`, bx + barW - 8, y + barH / 2);
    ctx.restore();
  }

  private _renderCombo(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    if (data.combo <= 0) return;
    ctx.save();
    ctx.shadowColor = data.combo >= 5 ? '#FFCB4D' : '#28E6FF';
    ctx.shadowBlur = 10;
    ctx.fillStyle = data.combo >= 5 ? '#FFCB4D' : '#fff';
    ctx.font = `bold ${data.combo >= 5 ? 32 : 24}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`COMBO x${data.combo}`, w - 24, 76);
    ctx.restore();
  }

  private _renderBossName(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    ctx.save();
    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#FFCB4D';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Ch.${data.chapter} ${BOSS_NAMES[data.chapter] ?? ''}`, w / 2, 36);
    ctx.restore();
  }

  private _renderShield(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.globalAlpha = this._shieldAlpha;
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.65, Math.min(w, h) * 0.18, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(40,230,255,0.08)';
    ctx.fill();
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
    this._displayMana = 0;
    this._shieldAlpha = 0;
  }
}
