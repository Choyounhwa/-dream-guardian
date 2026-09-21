import type { IVisualEffect, TrailOptions } from './EffectTypes.js';

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

const MAX_TRAIL_POINTS = 20;

export class TrailEffect implements IVisualEffect {
  readonly type = 'trail' as const;
  active = false;
  elapsed = 0;
  duration = 0.8;

  color = '#28E6FF';
  lineWidth = 6;
  private _points: TrailPoint[] = [];
  private _pointCount = 0;

  constructor() {
    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      this._points.push({ x: 0, y: 0, alpha: 0 });
    }
  }

  init(options: TrailOptions): this {
    this.color = options.color ?? '#28E6FF';
    this.lineWidth = options.lineWidth ?? 6;
    this.duration = options.duration ?? 0.8;
    this.elapsed = 0;
    this._pointCount = 1;
    this._points[0].x = options.x;
    this._points[0].y = options.y;
    this._points[0].alpha = 1.0;
    this.active = true;
    return this;
  }

  addPoint(x: number, y: number): void {
    if (!this.active) return;
    if (this._pointCount < MAX_TRAIL_POINTS) {
      const p = this._points[this._pointCount];
      p.x = x;
      p.y = y;
      p.alpha = 1.0;
      this._pointCount++;
    } else {
      // Shift array
      const first = this._points[0];
      for (let i = 0; i < MAX_TRAIL_POINTS - 1; i++) {
        this._points[i] = this._points[i + 1];
      }
      first.x = x;
      first.y = y;
      first.alpha = 1.0;
      this._points[MAX_TRAIL_POINTS - 1] = first;
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;

    let aliveCount = 0;
    for (let i = 0; i < this._pointCount; i++) {
      this._points[i].alpha -= (dt / this.duration);
      if (this._points[i].alpha > 0.01) {
        aliveCount++;
      }
    }

    if (this.elapsed >= this.duration || aliveCount === 0) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this._pointCount < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < this._pointCount - 1; i++) {
      const p1 = this._points[i];
      const p2 = this._points[i + 1];
      const avgAlpha = (p1.alpha + p2.alpha) * 0.5;
      if (avgAlpha <= 0.01) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, avgAlpha));
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth * (p2.alpha);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this._pointCount = 0;
  }
}
