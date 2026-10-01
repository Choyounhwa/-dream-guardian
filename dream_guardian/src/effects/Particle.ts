/**
 * Dream Guardian - Particle
 * 범용 2D 파티클 클래스 (위치, 속도, 수명, 회전, 크기/알파 보간 및 렌더링)
 */

export type ParticleShape = 'circle' | 'rect' | 'star' | 'spark';

export interface ParticleOptions {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life?: number;
  maxLife?: number;
  size?: number;
  startSize?: number;
  endSize?: number;
  color?: string;
  alpha?: number;
  startAlpha?: number;
  endAlpha?: number;
  rotation?: number;
  vRot?: number;
  gravity?: number;
  drag?: number;
  shape?: ParticleShape;
}

export class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 1;
  size = 4;
  startSize = 4;
  endSize = 0;
  color = '#FFFFFF';
  alpha = 1;
  startAlpha = 1;
  endAlpha = 0;
  rotation = 0;
  vRot = 0;
  gravity = 0;
  drag = 1;
  shape: ParticleShape = 'circle';
  active = false;

  init(options: ParticleOptions): this {
    this.x = options.x;
    this.y = options.y;
    this.vx = options.vx ?? 0;
    this.vy = options.vy ?? 0;
    this.life = 0;
    this.maxLife = options.maxLife ?? options.life ?? 1.0;

    const baseSize = options.size ?? 4;
    this.startSize = options.startSize ?? baseSize;
    this.endSize = options.endSize ?? 0;
    this.size = this.startSize;

    this.color = options.color ?? '#FFFFFF';

    const baseAlpha = options.alpha ?? 1;
    this.startAlpha = options.startAlpha ?? baseAlpha;
    this.endAlpha = options.endAlpha ?? 0;
    this.alpha = this.startAlpha;

    this.rotation = options.rotation ?? 0;
    this.vRot = options.vRot ?? 0;
    this.gravity = options.gravity ?? 0;
    this.drag = options.drag ?? 1;
    this.shape = options.shape ?? 'circle';
    this.active = true;

    return this;
  }

  update(dt: number): boolean {
    if (!this.active) return false;

    this.life += dt;
    if (this.life >= this.maxLife) {
      this.active = false;
      return false;
    }

    const progress = Math.min(1, Math.max(0, this.life / this.maxLife));

    const dragFactor = this.drag === 1 ? 1 : Math.pow(this.drag, dt * 60);
    this.vx *= dragFactor;
    this.vy = this.vy * dragFactor + this.gravity * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.rotation += this.vRot * dt;

    this.alpha = this.startAlpha + (this.endAlpha - this.startAlpha) * progress;
    this.size = Math.max(0, this.startSize + (this.endSize - this.startSize) * progress);

    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this.alpha <= 0.001 || this.size <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, ctx.globalAlpha * this.alpha));
    ctx.translate(this.x, this.y);

    if (this.rotation !== 0) {
      ctx.rotate(this.rotation);
    }

    ctx.fillStyle = this.color;

    switch (this.shape) {
      case 'rect':
        ctx.fillRect(-this.size, -this.size * 0.5, this.size * 2, this.size);
        break;

      case 'star': {
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.5);
        ctx.lineTo(s * 0.4, -s * 0.4);
        ctx.lineTo(s * 1.5, 0);
        ctx.lineTo(s * 0.4, s * 0.4);
        ctx.lineTo(0, s * 1.5);
        ctx.lineTo(-s * 0.4, s * 0.4);
        ctx.lineTo(-s * 1.5, 0);
        ctx.lineTo(-s * 0.4, -s * 0.4);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'spark': {
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.4);
        ctx.lineTo(s * 0.35, 0);
        ctx.lineTo(0, s * 1.4);
        ctx.lineTo(-s * 0.35, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'circle':
      default:
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  reset(): void {
    this.active = false;
    this.life = 0;
    this.maxLife = 1;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 0;
    this.startSize = 0;
    this.endSize = 0;
    this.color = '#FFFFFF';
    this.alpha = 1;
    this.startAlpha = 1;
    this.endAlpha = 0;
    this.rotation = 0;
    this.vRot = 0;
    this.gravity = 0;
    this.drag = 1;
    this.shape = 'circle';
  }
}
