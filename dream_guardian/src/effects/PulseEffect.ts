import type { IVisualEffect, PulseOptions } from './EffectTypes.js';

export class PulseEffect implements IVisualEffect {
  readonly type = 'pulse' as const;
  active = false;
  elapsed = 0;
  duration = 0.6;

  x = 0;
  y = 0;
  startRadius = 10;
  maxRadius = 80;
  color = '#4DFFAA';
  lineWidth = 3;

  init(options: PulseOptions): this {
    this.x = options.x;
    this.y = options.y;
    this.startRadius = options.startRadius ?? 10;
    this.maxRadius = options.maxRadius ?? 80;
    this.color = options.color ?? '#4DFFAA';
    this.lineWidth = options.lineWidth ?? 3;
    this.duration = options.duration ?? 0.6;
    this.elapsed = 0;
    this.active = true;
    return this;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const progress = Math.min(1, this.elapsed / this.duration);
    const radius = this.startRadius + (this.maxRadius - this.startRadius) * progress;
    const alpha = (1 - progress) * 0.8;
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth * (1 - progress * 0.5);
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
  }
}
