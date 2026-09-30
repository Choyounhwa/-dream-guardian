import { StardustEffect, type StardustOptions } from './StardustEffect.js';

/**
 * StardustManager - 별가루 파티클 및 스트림 전용 고성능 객체 풀링 매니저
 *
 * GC 스파이크 방지(Zero GC on runtime), 버스트/스트림/스파클 파티클 제어 담당
 */
export class StardustManager {
  private _active: StardustEffect[] = [];
  private _pool: StardustEffect[] = [];

  constructor(prewarmCount = 10) {
    if (prewarmCount > 0) {
      this.prewarm(prewarmCount);
    }
  }

  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this._pool.push(new StardustEffect());
    }
  }

  get activeCount(): number {
    return this._active.length;
  }

  get poolCount(): number {
    return this._pool.length;
  }

  getPoolSize(): number {
    return this._pool.length;
  }

  playStardust(options: StardustOptions): StardustEffect {
    const effect = this._pool.pop() ?? new StardustEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playBurst(x: number, y: number, options: Partial<StardustOptions> = {}): StardustEffect {
    return this.playStardust({
      mode: 'burst',
      x,
      y,
      count: 20,
      duration: 0.8,
      ...options,
    });
  }

  playStream(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    options: Partial<StardustOptions> = {},
  ): StardustEffect {
    return this.playStardust({
      mode: 'stream',
      x: startX,
      y: startY,
      targetX,
      targetY,
      count: 15,
      duration: 1.0,
      ...options,
    });
  }

  update(dt: number): void {
    let i = 0;
    while (i < this._active.length) {
      const effect = this._active[i];
      effect.update(dt);
      if (!effect.active) {
        effect.reset();
        this._pool.push(effect);
        this._active.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._active.length; i++) {
      this._active[i].render(ctx);
    }
  }

  clear(): void {
    for (let i = 0; i < this._active.length; i++) {
      const effect = this._active[i];
      effect.reset();
      this._pool.push(effect);
    }
    this._active.length = 0;
  }
}
