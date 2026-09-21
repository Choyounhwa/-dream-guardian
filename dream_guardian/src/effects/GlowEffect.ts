import type { IVisualEffect, GlowOptions } from './EffectTypes.js';

export class GlowEffect implements IVisualEffect {
  readonly type = 'glow' as const;
  active = false;
  elapsed = 0;
  duration = 0.5;

  x = 0;
  y = 0;
  radius = 50;
  color = '#28E6FF';
  maxAlpha = 0.6;

  init(options: GlowOptions): this {
    this.x = options.x;
    this.y = options.y;
    this.radius = options.radius ?? 50;
    this.color = options.color ?? '#28E6FF';
    this.maxAlpha = options.maxAlpha ?? 0.6;
    this.duration = options.duration ?? 0.5;
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
    if (!this.active || this.radius <= 0) return;
    const progress = Math.min(1, this.elapsed / this.duration);
    // Smooth fade-out: starts visible immediately and fades smoothly
    const alpha = (1 - progress) * this.maxAlpha;
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    grad.addColorStop(0, this.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
  }
}
