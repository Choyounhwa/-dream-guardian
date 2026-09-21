import type { IVisualEffect, BurstOptions } from './EffectTypes.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

const MAX_PARTICLES_PER_BURST = 40;

export class BurstEffect implements IVisualEffect {
  readonly type = 'burst' as const;
  active = false;
  elapsed = 0;
  duration = 0.6;

  private _particles: Particle[] = [];
  private _particleCount = 0;
  private _gravity = 120;
  private _drag = 0.95;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES_PER_BURST; i++) {
      this._particles.push({ x: 0, y: 0, vx: 0, vy: 0, size: 4, color: '#FFCB4D' });
    }
  }

  init(options: BurstOptions): this {
    const count = Math.min(options.count ?? 20, MAX_PARTICLES_PER_BURST);
    this._particleCount = count;
    this.duration = options.duration ?? 0.6;
    this._gravity = options.gravity ?? 120;
    this._drag = options.drag ?? 0.95;
    this.elapsed = 0;

    const colors = options.colors ?? ['#FFCB4D', '#28E6FF', '#4DFFAA', '#FFFFFF'];
    const speedMin = options.speedMin ?? 80;
    const speedMax = options.speedMax ?? 240;
    const sizeMin = options.sizeMin ?? 3;
    const sizeMax = options.sizeMax ?? 8;

    for (let i = 0; i < count; i++) {
      const p = this._particles[i];
      p.x = options.x;
      p.y = options.y;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.color = colors[i % colors.length];
    }

    this.active = true;
    return this;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
      return;
    }

    for (let i = 0; i < this._particleCount; i++) {
      const p = this._particles[i];
      p.vx *= Math.pow(this._drag, dt * 60);
      p.vy = p.vy * Math.pow(this._drag, dt * 60) + this._gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this._particleCount === 0) return;
    const progress = Math.min(1, this.elapsed / this.duration);
    const alpha = 1 - progress;
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    for (let i = 0; i < this._particleCount; i++) {
      const p = this._particles[i];
      const size = p.size * (1 - progress * 0.5);
      if (size <= 0.5) continue;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this._particleCount = 0;
  }
}
