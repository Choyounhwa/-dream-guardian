import { drawStardustIcon } from '../render/StardustIconRenderer.js';

export interface IStardustVisualEffect {
  readonly type: 'stardust';
  active: boolean;
  elapsed: number;
  duration: number;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  reset(): void;
}

export interface StardustOptions {
  mode?: 'burst' | 'stream';
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  count?: number;
  duration?: number;
  colors?: string[];
  speedMin?: number;
  speedMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  twinkle?: boolean;
}

interface StardustParticle {
  x: number;
  y: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  controlX: number;
  controlY: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  twinkleOffset: number;
  delay: number;
}

const MAX_STARDUST_PARTICLES = 50;
const DEFAULT_PALETTE = ['#FFCB4D', '#28E6FF', '#FF6584', '#FFFFFF', '#C889FF'];

export class StardustEffect implements IStardustVisualEffect {
  readonly type = 'stardust' as const;
  active = false;
  elapsed = 0;
  duration = 0.8;

  private _mode: 'burst' | 'stream' = 'burst';
  private _particles: StardustParticle[] = [];
  private _particleCount = 0;
  private _gravity = 80;
  private _drag = 0.94;

  constructor() {
    for (let i = 0; i < MAX_STARDUST_PARTICLES; i++) {
      this._particles.push({
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        controlX: 0,
        controlY: 0,
        size: 8,
        color: '#FFCB4D',
        rotation: 0,
        rotSpeed: 0,
        twinkleOffset: 0,
        delay: 0,
      });
    }
  }

  get particleCount(): number {
    return this._particleCount;
  }

  getParticles(): readonly StardustParticle[] {
    return this._particles.slice(0, this._particleCount);
  }

  init(options: StardustOptions): this {
    this._mode = options.mode ?? 'burst';
    this.duration = options.duration ?? 0.8;
    this.elapsed = 0;

    const count = Math.min(options.count ?? 20, MAX_STARDUST_PARTICLES);
    this._particleCount = count;

    const colors = options.colors && options.colors.length > 0 ? options.colors : DEFAULT_PALETTE;
    const speedMin = options.speedMin ?? 60;
    const speedMax = options.speedMax ?? 200;
    const sizeMin = options.sizeMin ?? 6;
    const sizeMax = options.sizeMax ?? 14;

    const targetX = options.targetX ?? options.x;
    const targetY = options.targetY ?? (options.y - 100);

    for (let i = 0; i < count; i++) {
      const p = this._particles[i];
      p.x = options.x;
      p.y = options.y;
      p.startX = options.x;
      p.startY = options.y;
      p.targetX = targetX;
      p.targetY = targetY;

      // 스트림 베지에 커브 제어점 (부드러운 곡선 아크)
      const midX = (options.x + targetX) * 0.5;
      const midY = (options.y + targetY) * 0.5;
      const perpAngle = Math.atan2(targetY - options.y, targetX - options.x) + Math.PI * 0.5;
      const curveDist = (Math.random() - 0.5) * 160;
      p.controlX = midX + Math.cos(perpAngle) * curveDist;
      p.controlY = midY + Math.sin(perpAngle) * curveDist;

      // 파티클별 미세 시차
      p.delay = (i / count) * (this.duration * 0.25);

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.color = colors[i % colors.length];
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
      p.twinkleOffset = Math.random() * Math.PI * 2;
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
      p.rotation += p.rotSpeed * dt;

      if (this._mode === 'burst') {
        p.vx *= Math.pow(this._drag, dt * 60);
        p.vy = p.vy * Math.pow(this._drag, dt * 60) + this._gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        // stream 모드: 부드러운 베지어 곡선 흡입
        const particleTime = Math.max(0, this.elapsed - p.delay);
        const streamDuration = Math.max(0.01, this.duration - p.delay);
        const t = Math.min(1, particleTime / streamDuration);
        const easeT = t * t * (3 - 2 * t); // smoothstep

        // Quadratic Bezier: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const oneMinusT = 1 - easeT;
        p.x =
          oneMinusT * oneMinusT * p.startX +
          2 * oneMinusT * easeT * p.controlX +
          easeT * easeT * p.targetX;
        p.y =
          oneMinusT * oneMinusT * p.startY +
          2 * oneMinusT * easeT * p.controlY +
          easeT * easeT * p.targetY;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this._particleCount === 0) return;
    const progress = Math.min(1, this.elapsed / this.duration);
    const baseAlpha = 1 - progress;
    if (baseAlpha <= 0.001) return;

    ctx.save();

    for (let i = 0; i < this._particleCount; i++) {
      const p = this._particles[i];
      if (this._mode === 'stream' && this.elapsed < p.delay) {
        continue; // 아직 발사 지연 중인 파티클
      }

      // 반짝임 진폭 계산
      const twinkle = 0.7 + 0.3 * Math.sin(this.elapsed * 12 + p.twinkleOffset);
      const alpha = Math.max(0, Math.min(1, baseAlpha * twinkle));
      const currentSize = p.size * (1 - progress * 0.35);

      if (currentSize <= 0.5 || alpha <= 0.01) continue;

      drawStardustIcon(ctx, p.x, p.y, currentSize, {
        points: 4,
        color: p.color,
        innerColor: '#FFFFFF',
        glowColor: p.color,
        glowBlur: 6,
        rotation: p.rotation,
        alpha,
      });
    }

    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this._particleCount = 0;
  }
}
