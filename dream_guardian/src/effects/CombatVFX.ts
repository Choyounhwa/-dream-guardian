/**
 * CombatVFX - 전투 시각 효과 서브모듈
 *
 * Issue #299: [REFACTOR-FX-001] EffectManager 서브모듈 분리
 * - 슬래시(Slash) 참격 궤적 효과
 * - 타격 폭발(Burst) 파티클
 * - 수호신 스펠 투사체 및 연쇄 시퀀스(GuardianCastSequence)
 * - 리듬 판정 플로팅 텍스트(FloatingJudgmentText)
 * - 보스 피격 충격(BossHitImpact), 장판 피격(HazardHit), 마나 풀(ManaFull)
 */

import {
  ParticleEmitter,
  type ParticleBurstOptions,
} from './ParticleEmitter.js';
import { GUARDIAN_EFFECT_CONFIG } from '../../config/effect.config.js';
import type { EventBus } from '../core/EventBus.js';

export interface SlashOptions {
  x: number;
  y: number;
  length?: number;
  angle?: number;
  color?: string;
  lineWidth?: number;
  duration?: number;
}

export class SlashEffect {
  x: number;
  y: number;
  length: number;
  angle: number;
  color: string;
  lineWidth: number;
  duration: number;
  elapsed = 0;
  active = true;

  constructor(options: SlashOptions) {
    this.x = options.x;
    this.y = options.y;
    this.length = options.length ?? 80;
    this.angle = options.angle ?? -Math.PI / 4;
    this.color = options.color ?? '#28E6FF';
    this.lineWidth = options.lineWidth ?? 4;
    this.duration = options.duration ?? 0.25;
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
    const progress = Math.min(1, Math.max(0, this.elapsed / this.duration));
    const alpha = 1 - progress;
    if (alpha <= 0.001) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(1, this.lineWidth * (1 - progress * 0.5));
    ctx.lineCap = 'round';

    const half = this.length * 0.5;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();

    ctx.restore();
  }

  reset(): void {
    this.elapsed = 0;
    this.active = false;
  }
}

export type CastSequencePhase = 'convergence' | 'projectile' | 'explosion' | 'complete';

export interface IParticleRunner {
  particleEmitter: ParticleEmitter;
  burst(options: ParticleBurstOptions): void;
}

/**
 * 수호신 스펠 캐스트 3단계 연쇄 시퀀스
 * 1) 수렴 (0~0.3s): 수호신 위치로 에너지 입자 수렴
 * 2) 발사/투사 (0.3~0.8s): 수호신 -> 보스 좌표로 고속 마법 구체 투사체 이동
 * 3) 폭발 (0.8~1.1s): 보스 위치에서 마젠타/시안 마법 폭발 충격파
 */
export class GuardianCastSequence {
  readonly guardianX: number;
  readonly guardianY: number;
  readonly bossX: number;
  readonly bossY: number;
  readonly totalDuration = 1.1;

  elapsed = 0;
  phase: CastSequencePhase = 'convergence';
  active = true;
  explosionTriggered = false;

  private _manager: any;

  constructor(
    guardianX: number,
    guardianY: number,
    bossX: number,
    bossY: number,
    manager: any,
  ) {
    this.guardianX = guardianX;
    this.guardianY = guardianY;
    this.bossX = bossX;
    this.bossY = bossY;
    this._manager = manager;

    this._spawnConvergenceParticles();
  }

  get progress(): number {
    return Math.min(1, Math.max(0, this.elapsed / this.totalDuration));
  }

  get projectileProgress(): number {
    if (this.elapsed < 0.3) return 0;
    if (this.elapsed >= 0.8) return 1;
    return (this.elapsed - 0.3) / 0.5;
  }

  get currentProjectileX(): number {
    const p = this.projectileProgress;
    return this.guardianX + (this.bossX - this.guardianX) * p;
  }

  get currentProjectileY(): number {
    const p = this.projectileProgress;
    return this.guardianY + (this.bossY - this.guardianY) * p;
  }

  private _spawnConvergenceParticles(): void {
    const cfg = GUARDIAN_EFFECT_CONFIG.castSequence;
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dist = 75;
      const startX = this.guardianX + Math.cos(angle) * dist;
      const startY = this.guardianY + Math.sin(angle) * dist;
      const speed = dist / 0.3;
      const color = cfg.convergenceColors[i % cfg.convergenceColors.length];

      this._manager.particleEmitter.burst({
        x: startX,
        y: startY,
        count: 1,
        colors: [color],
        speedMin: speed * 0.9,
        speedMax: speed * 1.1,
        angleMin: angle + Math.PI - 0.15,
        angleMax: angle + Math.PI + 0.15,
        duration: 0.28,
        sizeMin: 3,
        sizeMax: 6,
        shape: 'spark',
        drag: 0.98,
      });
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;

    if (this.elapsed < 0.3) {
      this.phase = 'convergence';
    } else if (this.elapsed < 0.8) {
      this.phase = 'projectile';
      this._manager.particleEmitter.burst({
        x: this.currentProjectileX + (Math.random() - 0.5) * 6,
        y: this.currentProjectileY + (Math.random() - 0.5) * 6,
        count: 1,
        colors: ['#28E6FF', '#C889FF', '#FFFFFF'],
        speedMin: 20,
        speedMax: 60,
        duration: 0.2,
        sizeMin: 2,
        sizeMax: 5,
        shape: 'spark',
      });
    } else if (this.elapsed < this.totalDuration) {
      this.phase = 'explosion';
      if (!this.explosionTriggered) {
        this.explosionTriggered = true;
        this._triggerExplosion();
      }
    } else {
      this.phase = 'complete';
      this.active = false;
      if (!this.explosionTriggered) {
        this.explosionTriggered = true;
        this._triggerExplosion();
      }
    }
  }

  private _triggerExplosion(): void {
    const cfg = GUARDIAN_EFFECT_CONFIG.castSequence;
    this._manager.burst({
      x: this.bossX,
      y: this.bossY,
      count: cfg.explosionCount,
      colors: [...cfg.explosionColors],
      speedMin: 180,
      speedMax: 420,
      sizeMin: 4,
      sizeMax: 10,
      endSizeMin: 0,
      endSizeMax: 2,
      duration: cfg.explosionDuration,
      gravity: 40,
      drag: 0.94,
      shapes: ['star', 'spark'],
    });

    if (typeof this._manager.playExpand === 'function') {
      this._manager.playExpand({
        x: this.bossX,
        y: this.bossY,
        startRadius: 15,
        endRadius: cfg.explosionShockwaveRadius,
        color: cfg.explosionShockwaveColor,
        lineWidth: 5,
        duration: 0.35,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    if (this.phase === 'convergence') {
      ctx.save();
      const p = this.elapsed / 0.3;
      ctx.globalAlpha = 0.5 + 0.5 * p;
      ctx.strokeStyle = '#C889FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.guardianX, this.guardianY, Math.max(5, 50 * (1 - p)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.phase === 'projectile') {
      const px = this.currentProjectileX;
      const py = this.currentProjectileY;
      ctx.save();
      ctx.shadowColor = '#28E6FF';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#28E6FF';
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export type JudgmentRating = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'MISS';

export interface JudgmentTextConfig {
  color: string;
  duration: number;
  initialScale: number;
  floatY: number;
  shake?: boolean;
}

export const JUDGMENT_CONFIGS: Record<JudgmentRating, JudgmentTextConfig> = {
  PERFECT: { color: '#FFCB4D', duration: 0.6, initialScale: 1.3, floatY: -40 },
  GOOD: { color: '#28E6FF', duration: 0.5, initialScale: 1.15, floatY: -30 },
  EARLY: { color: '#FF8844', duration: 0.5, initialScale: 1.1, floatY: -20 },
  LATE: { color: '#FF8844', duration: 0.5, initialScale: 1.1, floatY: -20 },
  MISS: { color: '#FF4444', duration: 0.45, initialScale: 0.9, floatY: 20, shake: true },
};

export class FloatingJudgmentText {
  readonly x: number;
  readonly y: number;
  readonly rating: JudgmentRating;
  readonly combo?: number;
  readonly color: string;
  readonly duration: number;
  readonly initialScale: number;
  readonly floatY: number;
  readonly shake: boolean;
  elapsed = 0;
  active = true;

  constructor(x: number, y: number, rating: JudgmentRating | string, combo?: number) {
    this.x = x;
    this.y = y;
    const normalized = (rating ? String(rating).trim().toUpperCase() : 'MISS') as JudgmentRating;
    this.rating = (['PERFECT', 'GOOD', 'EARLY', 'LATE', 'MISS'].includes(normalized)
      ? normalized
      : 'MISS') as JudgmentRating;
    this.combo = combo;
    const cfg = JUDGMENT_CONFIGS[this.rating] ?? JUDGMENT_CONFIGS.MISS;
    this.color = cfg.color;
    this.duration = cfg.duration;
    this.initialScale = cfg.initialScale;
    this.floatY = cfg.floatY;
    this.shake = Boolean(cfg.shake);
  }

  get progress(): number {
    return Math.min(1.0, Math.max(0.0, this.elapsed / this.duration));
  }

  get scale(): number {
    const p = this.progress;
    const bounceDuration = 0.25;
    if (p < bounceDuration) {
      const t = p / bounceDuration;
      return this.initialScale + (1.0 - this.initialScale) * t;
    }
    return 1.0;
  }

  get currentY(): number {
    const p = this.progress;
    return this.y + this.floatY * (1.0 - Math.pow(1.0 - p, 1.4));
  }

  get currentX(): number {
    if (!this.shake) return this.x;
    return this.x + Math.sin(this.elapsed * 40) * 3;
  }

  get alpha(): number {
    const p = this.progress;
    if (p < 0.5) return 1.0;
    return Math.max(0, 1.0 - (p - 0.5) / 0.5);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.active = false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this.alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha ?? 1.0) * this.alpha;
    const cx = this.currentX;
    const cy = this.currentY;
    const s = this.scale;
    if (typeof ctx.translate === 'function') ctx.translate(cx, cy);
    if (typeof ctx.scale === 'function') ctx.scale(s, s);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 28px sans-serif';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    if (this.rating === 'PERFECT') {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#FFCB4D';
      ctx.strokeText(this.rating, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.rating, 0, 0);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillText(this.rating, 0, 0);
    }

    if (this.combo !== undefined && this.combo >= 2) {
      const comboText = `${this.combo} COMBO!`;
      ctx.font = 'bold 16px sans-serif';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#FFCB4D';
      ctx.fillStyle = '#FFCB4D';
      ctx.fillText(comboText, 0, 24);
    }
    ctx.restore();
  }
}

export class CombatVFX implements IParticleRunner {
  private _emitter: ParticleEmitter;
  private _effectManager?: any;
  private _activeSlashes: SlashEffect[] = [];
  private _activeCastSequences: GuardianCastSequence[] = [];
  private _lastGuardianCastTime = 0;
  private _lastBossHitTime = 0;
  private _lastManaFullTime = 0;

  constructor(emitter?: ParticleEmitter, effectManager?: any) {
    this._emitter = emitter ?? new ParticleEmitter({ maxParticles: 300, prewarm: true });
    this._effectManager = effectManager;
  }

  get particleEmitter(): ParticleEmitter {
    return this._emitter;
  }

  get activeSlashes(): readonly SlashEffect[] {
    return this._activeSlashes;
  }

  get activeCastSequences(): readonly GuardianCastSequence[] {
    return this._activeCastSequences;
  }

  get lastGuardianCastTime(): number {
    return this._lastGuardianCastTime;
  }

  get lastBossHitTime(): number {
    return this._lastBossHitTime;
  }

  get lastManaFullTime(): number {
    return this._lastManaFullTime;
  }

  setEmitter(emitter: ParticleEmitter): void {
    this._emitter = emitter;
  }

  setEffectManager(effectManager: any): void {
    this._effectManager = effectManager;
  }

  playSlash(options: SlashOptions): SlashEffect {
    const slash = new SlashEffect(options);
    this._activeSlashes.push(slash);
    return slash;
  }

  triggerSlash(options: SlashOptions): SlashEffect {
    return this.playSlash(options);
  }

  burst(options: ParticleBurstOptions): void {
    this._emitter.burst(options);
  }

  playGuardianCastSequence(
    guardianX: number,
    guardianY: number,
    bossX: number,
    bossY: number,
  ): GuardianCastSequence {
    this._lastGuardianCastTime = Date.now();
    const targetManager = this._effectManager ?? this;
    const seq = new GuardianCastSequence(guardianX, guardianY, bossX, bossY, targetManager);
    this._activeCastSequences.push(seq);
    return seq;
  }

  playBossHitImpact(bossX: number, bossY: number, isEnraged = false): void {
    this._lastBossHitTime = Date.now();
    const cfg = isEnraged
      ? GUARDIAN_EFFECT_CONFIG.bossHit.enraged
      : GUARDIAN_EFFECT_CONFIG.bossHit.normal;

    this._emitter.burst({
      x: bossX,
      y: bossY,
      count: cfg.count,
      colors: [...cfg.colors],
      speedMin: cfg.speedMin,
      speedMax: cfg.speedMax,
      sizeMin: cfg.sizeMin,
      sizeMax: cfg.sizeMax,
      endSizeMin: 0,
      endSizeMax: 1,
      duration: cfg.duration,
      gravity: isEnraged ? 80 : 120,
      drag: 0.94,
      shape: cfg.shape,
      vRotMin: -4,
      vRotMax: 4,
      startAlpha: 1,
      endAlpha: 0,
    });

    if (this._effectManager && typeof this._effectManager.playPulse === 'function') {
      this._effectManager.playPulse({
        x: bossX,
        y: bossY,
        startRadius: 10,
        maxRadius: isEnraged ? 90 : 60,
        color: isEnraged ? '#FF0055' : '#FFAA00',
        lineWidth: isEnraged ? 4 : 3,
        duration: cfg.duration * 0.7,
      });
    }
  }

  playHazardHit(x: number, y: number, damage = 25): void {
    if (this._effectManager) {
      if (typeof this._effectManager.playExpand === 'function') {
        this._effectManager.playExpand({ x, y, startRadius: 20, endRadius: 130, color: '#FF3333', lineWidth: 5, duration: 0.45 });
      }
      if (typeof this._effectManager.playBurst === 'function') {
        this._effectManager.playBurst({ x, y, count: 20, colors: ['#FF2222', '#FF6600', '#FFAA00'], duration: 0.5 });
      }
      if (typeof this._effectManager.playFade === 'function') {
        this._effectManager.playFade({ x, y: y - 25, text: `HIT! -${damage} HP`, color: '#FF3333', fontSize: 34, duration: 0.85 });
      }
    } else {
      this._emitter.burst({ x, y, count: 20, colors: ['#FF2222', '#FF6600', '#FFAA00'], duration: 0.5 });
    }
  }

  playManaFullEffect(x: number, y: number): void {
    this._lastManaFullTime = Date.now();
    const cfg = GUARDIAN_EFFECT_CONFIG.manaFull;
    if (this._effectManager && typeof this._effectManager.playPulse === 'function') {
      this._effectManager.playPulse({
        x,
        y,
        startRadius: cfg.pulseStartRadius,
        maxRadius: cfg.pulseMaxRadius,
        color: cfg.pulseColor,
        lineWidth: cfg.pulseLineWidth,
        duration: cfg.duration,
      });
    }

    this._emitter.burst({
      x,
      y,
      count: cfg.particleCount,
      colors: [...cfg.colors],
      speedMin: cfg.speedMin,
      speedMax: cfg.speedMax,
      angleMin: -Math.PI * 0.85,
      angleMax: -Math.PI * 0.15,
      gravity: cfg.gravity,
      drag: cfg.drag,
      duration: cfg.duration,
      sizeMin: cfg.sizeMin,
      sizeMax: cfg.sizeMax,
      shapes: [...cfg.shapes],
      vRotMin: -2,
      vRotMax: 2,
      startAlpha: 1,
      endAlpha: 0,
    });
  }

  update(dt: number): void {
    let s = 0;
    while (s < this._activeSlashes.length) {
      const slash = this._activeSlashes[s];
      slash.update(dt);
      if (!slash.active) {
        this._activeSlashes.splice(s, 1);
      } else {
        s++;
      }
    }

    let c = 0;
    while (c < this._activeCastSequences.length) {
      const seq = this._activeCastSequences[c];
      seq.update(dt);
      if (!seq.active) {
        this._activeCastSequences.splice(c, 1);
      } else {
        c++;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._activeSlashes.length; i++) {
      this._activeSlashes[i].render(ctx);
    }
    for (let c = 0; c < this._activeCastSequences.length; c++) {
      this._activeCastSequences[c].render(ctx);
    }
  }

  clear(): void {
    this._activeSlashes.length = 0;
    this._activeCastSequences.length = 0;
  }

  reset(): void {
    this.clear();
  }
}

export interface GuardianVFXOptions {
  getManaCoordinates?: () => { x: number; y: number };
  getGuardianCoordinates?: () => { x: number; y: number };
  getBossCoordinates?: () => { x: number; y: number };
  getIsEnraged?: () => boolean;
  debounceMs?: number;
}

export function wireGuardianVFX(
  eventBus: EventBus | { on: (event: any, handler: any) => void; off?: (event: any, handler: any) => void },
  effectManager: any,
  options?: GuardianVFXOptions,
): () => void {
  const debounceMs = options?.debounceMs ?? 100;

  const onManaFull = () => {
    const now = Date.now();
    if (now - effectManager.lastManaFullTime < debounceMs) return;
    const coords = options?.getManaCoordinates?.() ?? {
      x: (effectManager.viewportWidth ?? 1280) * 0.5,
      y: (effectManager.viewportHeight ?? 720) * 0.95,
    };
    effectManager.playManaFullEffect(coords.x, coords.y);
  };

  const onGuardianCast = () => {
    const now = Date.now();
    if (now - effectManager.lastGuardianCastTime < debounceMs) return;
    const gCoords = options?.getGuardianCoordinates?.() ?? {
      x: (effectManager.viewportWidth ?? 1280) * 0.5,
      y: (effectManager.viewportHeight ?? 720) * 0.84,
    };
    const bCoords = options?.getBossCoordinates?.() ?? {
      x: (effectManager.viewportWidth ?? 1280) * 0.5,
      y: (effectManager.viewportHeight ?? 720) * 0.24,
    };
    effectManager.playGuardianCastSequence(gCoords.x, gCoords.y, bCoords.x, bCoords.y);
  };

  const onBossHit = () => {
    const now = Date.now();
    if (now - effectManager.lastBossHitTime < debounceMs) return;
    const bCoords = options?.getBossCoordinates?.() ?? {
      x: (effectManager.viewportWidth ?? 1280) * 0.5,
      y: (effectManager.viewportHeight ?? 720) * 0.24,
    };
    const isEnraged = options?.getIsEnraged?.() ?? false;
    effectManager.playBossHitImpact(bCoords.x, bCoords.y, isEnraged);
  };

  (eventBus as any).on('mana:full', onManaFull);
  (eventBus as any).on('guardian:cast', onGuardianCast);
  (eventBus as any).on('boss:hit', onBossHit);

  return () => {
    if (typeof (eventBus as any).off === 'function') {
      (eventBus as any).off('mana:full', onManaFull);
      (eventBus as any).off('guardian:cast', onGuardianCast);
      (eventBus as any).off('boss:hit', onBossHit);
    }
  };
}
