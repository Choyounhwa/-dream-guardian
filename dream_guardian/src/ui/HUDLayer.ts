/**
 * HUDLayer - 스트리트파이터 스타일 듀얼 HP HUD, 마나 플라스크, 실드
 *
 * Canvas 2D로 직접 렌더링하는 인게임 HUD
 * 체력/마나 부드러운 감쇠 애니메이션
 *
 * @see Issue #21 (GitHub #86)
 */

const BOSS_NAMES = ['', '포겟', '후다닥', '뒤죽박죽', '에라', '나이트메어'];

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
    this._renderManaFlask(ctx, w, h);
    this._renderCombo(ctx, w, data);
    this._renderBossName(ctx, w, data);

    if (this._shieldAlpha > 0.01) {
      this._renderShield(ctx, w, h);
    }
  }

  private _renderHpBars(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    const barW = Math.min(280, w * 0.22);
    const barH = 24;
    const y = 20;
    const pad = 20;

    // 플레이어 HP (좌측)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(pad, y, barW, barH);
    const pGrad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
    pGrad.addColorStop(0, '#28E6FF');
    pGrad.addColorStop(1, '#4DFFAA');
    ctx.fillStyle = pGrad;
    ctx.fillRect(pad, y, barW * Math.max(0, this._displayPlayerHp), barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, y, barW, barH);

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${data.playerHp}/${data.playerMaxHp}`, pad + 6, y + 16);

    // 보스 HP (우측)
    const bx = w - pad - barW;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, y, barW, barH);
    const bGrad = ctx.createLinearGradient(bx + barW, 0, bx, 0);
    bGrad.addColorStop(0, '#FF4444');
    bGrad.addColorStop(1, '#FF8844');
    ctx.fillStyle = bGrad;
    const bossBarW = barW * Math.max(0, this._displayBossHp);
    ctx.fillRect(bx + barW - bossBarW, y, bossBarW, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(bx, y, barW, barH);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP ${data.bossHp}/${data.bossMaxHp}`, bx + barW - 6, y + 16);
  }

  private _renderManaFlask(ctx: CanvasRenderingContext2D, _w: number, h: number): void {
    const fx = 30;
    const fy = h - 80;
    const fw = 36;
    const fh = 50;

    // 플라스크 외곽
    ctx.strokeStyle = 'rgba(200,137,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, 6);
    ctx.stroke();

    // 액체
    const fillH = fh * Math.max(0, Math.min(1, this._displayMana));
    const mGrad = ctx.createLinearGradient(0, fy + fh, 0, fy + fh - fillH);
    mGrad.addColorStop(0, '#C889FF');
    mGrad.addColorStop(1, '#FF65C3');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.roundRect(fx + 2, fy + fh - fillH, fw - 4, fillH - 2, 4);
    ctx.fill();

    // 라벨
    ctx.fillStyle = '#C889FF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MANA', fx + fw / 2, fy - 6);
  }

  private _renderCombo(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    if (data.combo <= 0) return;
    ctx.fillStyle = data.combo >= 5 ? '#FFCB4D' : '#fff';
    ctx.font = `bold ${data.combo >= 5 ? 20 : 16}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`COMBO x${data.combo}`, w - 24, 70);
  }

  private _renderBossName(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Ch.${data.chapter} ${BOSS_NAMES[data.chapter] ?? ''}`, w / 2, 36);
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

  reset(): void {
    this._displayPlayerHp = 1;
    this._displayBossHp = 1;
    this._displayMana = 0;
    this._shieldAlpha = 0;
  }
}
