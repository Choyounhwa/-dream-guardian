/**
 * Dream Guardian - ParticleEmitter
 * 고성능 파티클 방출기 (오브젝트 풀링 기반 GC 압력 0, burst/stream 지원)
 */

import { Particle, type ParticleShape } from './Particle.js';

export interface ParticleEmitterConfig {
  maxParticles?: number;
  prewarm?: boolean;
}

export interface ParticleBurstOptions {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  speedMin?: number;
  speedMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  endSizeMin?: number;
  endSizeMax?: number;
  angleMin?: number;
  angleMax?: number;
  gravity?: number;
  drag?: number;
  duration?: number;
  durationMin?: number;
  durationMax?: number;
  shape?: ParticleShape;
  shapes?: ParticleShape[];
  vRotMin?: number;
  vRotMax?: number;
  startAlpha?: number;
  endAlpha?: number;
}

export interface ParticleStreamOptions extends Omit<ParticleBurstOptions, 'count'> {
  rate: number; // 초당 파티클 수
  duration?: number; // 스트림 수명 (0 또는 생략 시 무제한)
  streamDuration?: number;
  particleDuration?: number;
}

interface ActiveStream {
  options: ParticleStreamOptions;
  elapsed: number;
  duration: number;
  accumulator: number;
  active: boolean;
}

export class ParticleEmitter {
  private _maxParticles: number;
  private _pool: Particle[] = [];
  private _active: Particle[] = [];
  private _streams: ActiveStream[] = [];

  constructor(config?: ParticleEmitterConfig | number) {
    if (typeof config === 'number') {
      this._maxParticles = config;
    } else {
      this._maxParticles = config?.maxParticles ?? 500;
    }

    const prewarm = typeof config === 'object' ? config.prewarm !== false : true;
    if (prewarm) {
      for (let i = 0; i < this._maxParticles; i++) {
        this._pool.push(new Particle());
      }
    }
  }

  get maxParticles(): number {
    return this._maxParticles;
  }

  get activeCount(): number {
    return this._active.length;
  }

  get activeParticles(): readonly Particle[] {
    return this._active;
  }

  get poolCount(): number {
    return this._pool.length;
  }

  get isFinished(): boolean {
    return this._active.length === 0 && this._streams.length === 0;
  }

  /**
   * 순간 일괄 방출 (Burst)
   */
  burst(options: ParticleBurstOptions): void {
    const requestedCount = options.count ?? 20;
    const availableSlots = this._maxParticles - this._active.length;
    const spawnCount = Math.min(requestedCount, availableSlots);
    if (spawnCount <= 0) return;

    const colors = options.colors ?? ['#FFFFFF'];
    const speedMin = options.speedMin ?? 80;
    const speedMax = options.speedMax ?? 240;
    const sizeMin = options.sizeMin ?? 3;
    const sizeMax = options.sizeMax ?? 8;
    const endSizeMin = options.endSizeMin ?? 0;
    const endSizeMax = options.endSizeMax ?? 0;
    const angleMin = options.angleMin ?? 0;
    const angleMax = options.angleMax ?? (Math.PI * 2);
    const gravity = options.gravity ?? 0;
    const drag = options.drag ?? 1;

    let durationMin = options.durationMin;
    let durationMax = options.durationMax;
    if (options.duration !== undefined) {
      if (durationMin === undefined) durationMin = options.duration;
      if (durationMax === undefined) durationMax = options.duration;
    }
    durationMin = durationMin ?? 0.6;
    durationMax = durationMax ?? 0.6;

    const shape = options.shape;
    const shapes = options.shapes;
    const vRotMin = options.vRotMin ?? 0;
    const vRotMax = options.vRotMax ?? 0;
    const startAlpha = options.startAlpha ?? 1;
    const endAlpha = options.endAlpha ?? 0;

    for (let i = 0; i < spawnCount; i++) {
      let p = this._pool.pop();
      if (!p) {
        if (this._active.length < this._maxParticles) {
          p = new Particle();
        } else {
          break;
        }
      }

      const angle = angleMin + Math.random() * (angleMax - angleMin);
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const size = sizeMin + Math.random() * (sizeMax - sizeMin);
      const endSize = endSizeMin + Math.random() * (endSizeMax - endSizeMin);
      const maxLife = durationMin + Math.random() * (durationMax - durationMin);
      const vRot = vRotMin + Math.random() * (vRotMax - vRotMin);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particleShape = shape ?? (shapes ? shapes[Math.floor(Math.random() * shapes.length)] : 'circle');

      p.init({
        x: options.x,
        y: options.y,
        vx,
        vy,
        size,
        startSize: size,
        endSize,
        color,
        startAlpha,
        endAlpha,
        rotation: Math.random() * Math.PI * 2,
        vRot,
        gravity,
        drag,
        maxLife,
        shape: particleShape,
      });

      this._active.push(p);
    }
  }

  /**
   * 지속 방출 (Stream)
   */
  stream(options: ParticleStreamOptions): void {
    const streamDuration = options.streamDuration ?? options.duration ?? 0;
    this._streams.push({
      options,
      elapsed: 0,
      duration: streamDuration,
      accumulator: 0,
      active: true,
    });
  }

  /**
   * 매 프레임 업데이트
   */
  update(dt: number): void {
    // 1. 스트림 업데이트 및 파티클 생성
    for (let s = this._streams.length - 1; s >= 0; s--) {
      const st = this._streams[s];
      let effectiveDt = dt;
      if (st.duration > 0 && st.elapsed + dt > st.duration) {
        effectiveDt = Math.max(0, st.duration - st.elapsed);
      }

      st.elapsed += dt;
      st.accumulator += st.options.rate * effectiveDt;

      const countToEmit = Math.floor(st.accumulator);
      if (countToEmit > 0) {
        st.accumulator -= countToEmit;

        const particleDuration = st.options.particleDuration ?? 1.0;
        const { duration: _dur, streamDuration: _sd, particleDuration: _pd, ...burstOpts } = st.options;

        this.burst({
          ...burstOpts,
          duration: burstOpts.durationMin !== undefined || burstOpts.durationMax !== undefined ? undefined : particleDuration,
          count: countToEmit,
        });
      }

      if (st.duration > 0 && st.elapsed >= st.duration) {
        st.active = false;
        this._streams.splice(s, 1);
      }
    }

    // 2. 활성 파티클 업데이트 및 만료 시 풀 회수 (O(1) 반환)
    let i = 0;
    while (i < this._active.length) {
      const p = this._active[i];
      const alive = p.update(dt);
      if (!alive) {
        p.reset();
        this._pool.push(p);
        this._active[i] = this._active[this._active.length - 1];
        this._active.pop();
      } else {
        i++;
      }
    }
  }

  /**
   * 활성 파티클 렌더링
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._active.length; i++) {
      this._active[i].render(ctx);
    }
  }

  /**
   * 전체 활성 파티클 및 스트림 즉시 회수
   */
  clear(): void {
    for (let i = 0; i < this._active.length; i++) {
      const p = this._active[i];
      p.reset();
      this._pool.push(p);
    }
    this._active.length = 0;
    this._streams.length = 0;
  }
}
