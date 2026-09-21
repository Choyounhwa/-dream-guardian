import type { IVisualEffect, RadialOptions } from './EffectTypes.js';

export class RadialEffect implements IVisualEffect {
  readonly type = 'radial' as const;
  active = false;
  elapsed = 0;
  duration = 0.5;

  x = 0;
  y = 0;
  rayCount = 12;
  innerRadius = 20;
  outerRadius = 140;
  color = '#FFFFFF';
  rotationSpeed = 1.5;
  rotation = 0;

  init(options: RadialOptions): this {
    this.x = options.x;
    this.y = options.y;
    this.rayCount = options.rayCount ?? 12;
    this.innerRadius = options.innerRadius ?? 20;
    this.outerRadius = options.outerRadius ?? 140;
    this.color = options.color ?? '#FFFFFF';
    this.rotationSpeed = options.rotationSpeed ?? 1.5;
    this.duration = options.duration ?? 0.5;
    this.rotation = 0;
    this.elapsed = 0;
    this.active = true;
    return this;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    this.rotation += this.rotationSpeed * dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const progress = Math.min(1, this.elapsed / this.duration);
    const alpha = Math.sin(progress * Math.PI) * 0.8;
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;

    const angleStep = (Math.PI * 2) / this.rayCount;
    for (let i = 0; i < this.rayCount; i++) {
      const angle = this.rotation + i * angleStep;
      const x1 = this.x + Math.cos(angle) * this.innerRadius;
      const y1 = this.y + Math.sin(angle) * this.innerRadius;
      const x2 = this.x + Math.cos(angle) * (this.innerRadius + (this.outerRadius - this.innerRadius) * progress);
      const y2 = this.y + Math.sin(angle) * (this.innerRadius + (this.outerRadius - this.innerRadius) * progress);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
  }
}
