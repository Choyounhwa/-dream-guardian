import type { IVisualEffect, FadeOptions } from './EffectTypes.js';

export class FadeEffect implements IVisualEffect {
  readonly type = 'fade' as const;
  active = false;
  elapsed = 0;
  duration = 0.8;

  x = 0;
  y = 0;
  currentY = 0;
  text = '';
  color = '#FFFFFF';
  fontSize = 28;
  vy = -60;

  init(options: FadeOptions): this {
    this.x = options.x;
    this.y = options.y;
    this.currentY = options.y;
    this.text = options.text ?? '';
    this.color = options.color ?? '#FFFFFF';
    this.fontSize = options.fontSize ?? 28;
    this.vy = options.vy ?? -60;
    this.duration = options.duration ?? 0.8;
    this.elapsed = 0;
    this.active = true;
    return this;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    this.currentY += this.vy * dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || !this.text) return;
    const progress = Math.min(1, this.elapsed / this.duration);
    const alpha = 1 - progress;
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${this.fontSize}px sans-serif`;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillText(this.text, this.x, this.currentY);
    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this.text = '';
  }
}
