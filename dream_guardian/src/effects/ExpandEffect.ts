import type { IVisualEffect, ExpandOptions } from './EffectTypes.js';

export class ExpandEffect implements IVisualEffect {
  readonly type = 'expand' as const;
  active = false;
  elapsed = 0;
  duration = 0.4;

  x = 0;
  y = 0;
  startRadius = 5;
  endRadius = 120;
  color = '#FFCB4D';
  lineWidth = 4;
  filled = false;

  init(options: ExpandOptions): this {
    this.x = options.x;
    this.y = options.y;
    this.startRadius = options.startRadius ?? 5;
    this.endRadius = options.endRadius ?? 120;
    this.color = options.color ?? '#FFCB4D';
    this.lineWidth = options.lineWidth ?? 4;
    this.duration = options.duration ?? 0.4;
    this.filled = options.filled ?? false;
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
    // Cubic ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    const radius = this.startRadius + (this.endRadius - this.startRadius) * eased;
    const alpha = (1 - progress);
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (this.filled) {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
  }
}
