/**
 * EffectManager - 7종 시각 효과 관리 및 고성능 파티클 엔진 풀링 시스템
 *
 * Issue #24: GC 방지 객체 풀링(Object Pooling) 및 게임 로직 분리
 * Issue #273: [VFX-001] 파티클 엔진 기반 시스템 구축 (ParticleEmitter 통합)
 */

import type {
  EffectType,
  IVisualEffect,
  GlowOptions,
  PulseOptions,
  ExpandOptions,
  FadeOptions,
  BurstOptions,
  RadialOptions,
  TrailOptions,
  PresetName,
} from './EffectTypes.js';
import { GlowEffect } from './GlowEffect.js';
import { PulseEffect } from './PulseEffect.js';
import { ExpandEffect } from './ExpandEffect.js';
import { FadeEffect } from './FadeEffect.js';
import { BurstEffect } from './BurstEffect.js';
import { RadialEffect } from './RadialEffect.js';
import { TrailEffect } from './TrailEffect.js';
import {
  ParticleEmitter,
  type ParticleBurstOptions,
  type ParticleStreamOptions,
} from './ParticleEmitter.js';
import {
  PARTICLE_PRESETS,
  type ParticlePresetName,
  ANSWER_EFFECT_CONFIG,
  GUARDIAN_EFFECT_CONFIG,
  RESULT_EFFECT_CONFIG,
} from '../../config/effect.config.js';
import type { EventBus } from '../core/EventBus.js';

export type CastSequencePhase = 'convergence' | 'projectile' | 'explosion' | 'complete';

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
  readonly totalDuration: number = 1.1;

  elapsed = 0;
  phase: CastSequencePhase = 'convergence';
  active = true;
  explosionTriggered = false;

  private _manager: EffectManager;

  constructor(
    guardianX: number,
    guardianY: number,
    bossX: number,
    bossY: number,
    manager: EffectManager,
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
        duration: 0.3,
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
      // 투사체 이동 중 궤적 파티클 방출
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
    // 3단계 폭발: 보스 위치에서 마젠타/시안 마법 폭발 충격파
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

    // 마법 폭발 확장 링
    this._manager.playExpand({
      x: this.bossX,
      y: this.bossY,
      startRadius: 15,
      endRadius: cfg.explosionShockwaveRadius,
      color: cfg.explosionShockwaveColor,
      lineWidth: 5,
      duration: cfg.explosionDuration,
    });

    // 시안 마법 광선 방출
    this._manager.playRadial({
      x: this.bossX,
      y: this.bossY,
      rayCount: 16,
      innerRadius: 20,
      outerRadius: 160,
      color: '#28E6FF',
      duration: cfg.explosionDuration,
    });
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
  PERFECT: {
    color: '#FFCB4D',
    duration: 0.6,
    initialScale: 1.3,
    floatY: -40,
  },
  GOOD: {
    color: '#28E6FF',
    duration: 0.5,
    initialScale: 1.15,
    floatY: -30,
  },
  EARLY: {
    color: '#FF8844',
    duration: 0.5,
    initialScale: 1.1,
    floatY: -20,
  },
  LATE: {
    color: '#FF8844',
    duration: 0.5,
    initialScale: 1.1,
    floatY: -20,
  },
  MISS: {
    color: '#FF4444',
    duration: 0.45,
    initialScale: 1.0,
    floatY: 15,
    shake: true,
  },
};

/**
 * 리듬 판정 플로팅 텍스트 인스턴스 (Issue #283 / VFX-JUDGMENT-001)
 */
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

  constructor(
    x: number,
    y: number,
    rating: JudgmentRating | string,
    combo?: number,
  ) {
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
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this.alpha <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha ?? 1.0) * this.alpha;

    const cx = this.currentX;
    const cy = this.currentY;
    const s = this.scale;

    if (typeof ctx.translate === 'function') {
      ctx.translate(cx, cy);
    }
    if (typeof ctx.scale === 'function') {
      ctx.scale(s, s);
    }

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

export class EffectManager {
  private _active: IVisualEffect[] = [];
  private _activeCastSequences: GuardianCastSequence[] = [];
  private _activeJudgmentTexts: FloatingJudgmentText[] = [];

  // 적색/오버레이 플래시 관리 (VFX-002 / Issue #274)
  private _flashColor: string = '#FF4444';
  private _flashDuration: number = 0.3;
  private _flashTimer: number = 0;
  private _flashMaxAlpha: number = 0.4;
  private _viewportWidth: number = 1280;
  private _viewportHeight: number = 720;
  private _lastAnswerEffectTime: number = 0;
  private _lastManaFullTime: number = 0;
  private _lastGuardianCastTime: number = 0;
  private _lastBossHitTime: number = 0;
  private _lastVictoryCelebrationTime: number = 0;
  private _lastDefeatDarkenTime: number = 0;

  // 패배 연출 비네팅 어두움 관리 (VFX-005 / Issue #277)
  private _defeatDarkenTimer: number = 0;
  private _defeatDarkenDuration: number = 2.0;

  // 타입별 객체 풀 (7종 기본 비주얼 이펙트)
  private _poolGlow: GlowEffect[] = [];
  private _poolPulse: PulseEffect[] = [];
  private _poolExpand: ExpandEffect[] = [];
  private _poolFade: FadeEffect[] = [];
  private _poolBurst: BurstEffect[] = [];
  private _poolRadial: RadialEffect[] = [];
  private _poolTrail: TrailEffect[] = [];

  // 고성능 범용 파티클 이미터 (최대 500개 풀링)
  private _emitter: ParticleEmitter;

  constructor(prewarmCount = 10, maxParticles = 500) {
    if (prewarmCount > 0) {
      this.prewarm(prewarmCount);
    }
    this._emitter = new ParticleEmitter({ maxParticles, prewarm: true });
  }

  /**
   * 객체 풀 사전 생성 (게임 시작 전 GC 스파이크 방지)
   */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this._poolGlow.push(new GlowEffect());
      this._poolPulse.push(new PulseEffect());
      this._poolExpand.push(new ExpandEffect());
      this._poolFade.push(new FadeEffect());
      this._poolBurst.push(new BurstEffect());
      this._poolRadial.push(new RadialEffect());
      this._poolTrail.push(new TrailEffect());
    }
  }

  setViewport(width: number, height: number): void {
    this._viewportWidth = width;
    this._viewportHeight = height;
  }

  get viewportWidth(): number {
    return this._viewportWidth;
  }

  get viewportHeight(): number {
    return this._viewportHeight;
  }

  get isFlashActive(): boolean {
    return this._flashTimer > 0;
  }

  get flashAlpha(): number {
    if (this._flashTimer <= 0 || this._flashDuration <= 0) return 0;
    return Math.min(1, Math.max(0, (this._flashTimer / this._flashDuration) * this._flashMaxAlpha));
  }

  get flashTimer(): number {
    return this._flashTimer;
  }

  get flashColor(): string {
    return this._flashColor;
  }

  get lastAnswerEffectTime(): number {
    return this._lastAnswerEffectTime;
  }

  get lastManaFullTime(): number {
    return this._lastManaFullTime;
  }

  get lastGuardianCastTime(): number {
    return this._lastGuardianCastTime;
  }

  get lastBossHitTime(): number {
    return this._lastBossHitTime;
  }

  get lastVictoryCelebrationTime(): number {
    return this._lastVictoryCelebrationTime;
  }

  get lastDefeatDarkenTime(): number {
    return this._lastDefeatDarkenTime;
  }

  get isDefeatDarkenActive(): boolean {
    return this._defeatDarkenTimer > 0;
  }

  get defeatDarkenTimer(): number {
    return this._defeatDarkenTimer;
  }

  get defeatDarkenDuration(): number {
    return this._defeatDarkenDuration;
  }

  get defeatDarkenAlpha(): number {
    if (this._defeatDarkenTimer <= 0 || this._defeatDarkenDuration <= 0) return 0;
    const elapsed = this._defeatDarkenDuration - this._defeatDarkenTimer;
    const fadeIn = Math.min(1, elapsed / 0.4);
    const fadeOut = Math.min(1, this._defeatDarkenTimer / 0.5);
    const maxAlpha = RESULT_EFFECT_CONFIG.defeat.maxAlpha ?? 0.8;
    return maxAlpha * Math.min(fadeIn, fadeOut);
  }

  triggerFlash(color = '#FF4444', duration = 0.3, maxAlpha = 0.4): void {
    this._flashColor = color;
    this._flashDuration = duration;
    this._flashTimer = duration;
    this._flashMaxAlpha = maxAlpha;
  }

  get particleEmitter(): ParticleEmitter {
    return this._emitter;
  }

  get activeCount(): number {
    return this._active.length;
  }

  get activeCastSequences(): readonly GuardianCastSequence[] {
    return this._activeCastSequences;
  }

  get activeJudgmentTexts(): readonly FloatingJudgmentText[] {
    return this._activeJudgmentTexts;
  }

  get particleActiveCount(): number {
    return this._emitter.activeCount;
  }

  get totalActiveCount(): number {
    return this._active.length + this._emitter.activeCount;
  }

  get poolCount(): number {
    return (
      this._poolGlow.length +
      this._poolPulse.length +
      this._poolExpand.length +
      this._poolFade.length +
      this._poolBurst.length +
      this._poolRadial.length +
      this._poolTrail.length
    );
  }

  getPoolSize(type: EffectType): number {
    switch (type) {
      case 'glow': return this._poolGlow.length;
      case 'pulse': return this._poolPulse.length;
      case 'expand': return this._poolExpand.length;
      case 'fade': return this._poolFade.length;
      case 'burst': return this._poolBurst.length;
      case 'radial': return this._poolRadial.length;
      case 'trail': return this._poolTrail.length;
    }
  }

  playGlow(options: GlowOptions): GlowEffect {
    const effect = this._poolGlow.pop() ?? new GlowEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playPulse(options: PulseOptions): PulseEffect {
    const effect = this._poolPulse.pop() ?? new PulseEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playExpand(options: ExpandOptions): ExpandEffect {
    const effect = this._poolExpand.pop() ?? new ExpandEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playFade(options: FadeOptions): FadeEffect {
    const effect = this._poolFade.pop() ?? new FadeEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playBurst(options: BurstOptions): BurstEffect {
    const effect = this._poolBurst.pop() ?? new BurstEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playRadial(options: RadialOptions): RadialEffect {
    const effect = this._poolRadial.pop() ?? new RadialEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  playTrail(options: TrailOptions): TrailEffect {
    const effect = this._poolTrail.pop() ?? new TrailEffect();
    effect.init(options);
    this._active.push(effect);
    return effect;
  }

  /**
   * 파티클 이미터 직접 버스트 방출
   */
  burst(options: ParticleBurstOptions): void {
    this._emitter.burst(options);
  }

  /**
   * 파티클 이미터 지속 스트림 방출
   */
  stream(options: ParticleStreamOptions): void {
    this._emitter.stream(options);
  }

  /**
   * 파티클 프리셋 연출 재생
   */
  playPresetEffect(
    presetName: ParticlePresetName,
    x: number,
    y: number,
    options?: Partial<ParticleBurstOptions>
  ): void {
    const config = PARTICLE_PRESETS[presetName];
    if (config) {
      const burstOpts: ParticleBurstOptions = {
        ...config,
        x,
        y,
        ...options,
      };

      // options.duration이 전달된 경우 durationMin/durationMax를 명시적으로 덮어씀
      if (options?.duration !== undefined) {
        if (options.durationMin === undefined) {
          burstOpts.durationMin = options.duration;
        }
        if (options.durationMax === undefined) {
          burstOpts.durationMax = options.duration;
        }
      }

      this._emitter.burst(burstOpts);
    }
  }

  /**
   * 범용 이펙트/프리셋 재생 함수
   */
  playEffect(
    name: ParticlePresetName | EffectType | string,
    xOrOptions?: any,
    y?: number,
    options?: any
  ): any {
    if (typeof xOrOptions === 'number') {
      this.playPresetEffect(name as ParticlePresetName, xOrOptions, y ?? 0, options);
      return;
    }
    return this.play(name as EffectType, xOrOptions);
  }

  /**
   * 제네릭 재생 함수 (기존 7종 및 신규 프리셋 호환)
   */
  play(
    typeOrPreset: EffectType | ParticlePresetName | PresetName | string,
    optionsOrX?: any,
    y?: number,
    options?: any
  ): any {
    if (typeof optionsOrX === 'number' && typeof y === 'number') {
      if (typeOrPreset in PARTICLE_PRESETS) {
        this.playPresetEffect(typeOrPreset as ParticlePresetName, optionsOrX, y, options);
        return;
      }
      if (
        typeOrPreset === 'correct' ||
        typeOrPreset === 'wrong' ||
        typeOrPreset === 'cast' ||
        typeOrPreset === 'shield' ||
        typeOrPreset === 'combo'
      ) {
        this.playPreset(typeOrPreset as PresetName, optionsOrX, y);
        return;
      }
    }

    switch (typeOrPreset) {
      case 'glow': return this.playGlow(optionsOrX);
      case 'pulse': return this.playPulse(optionsOrX);
      case 'expand': return this.playExpand(optionsOrX);
      case 'fade': return this.playFade(optionsOrX);
      case 'burst': return this.playBurst(optionsOrX);
      case 'radial': return this.playRadial(optionsOrX);
      case 'trail': return this.playTrail(optionsOrX);
    }
  }

  /**
   * 게임플레이 프리셋 연출 (기존 5종 하위 호환)
   */
  playPreset(preset: PresetName, x: number, y: number): void {
    switch (preset) {
      case 'correct':
        this.playPulse({ x, y, startRadius: 10, maxRadius: 100, color: '#4DFFAA', duration: 0.5 });
        this.playBurst({ x, y, count: 24, colors: ['#4DFFAA', '#28E6FF', '#FFFFFF'], duration: 0.6 });
        this.playFade({ x, y: y - 20, text: '+25 MANA', color: '#4DFFAA', fontSize: 32, duration: 0.8 });
        break;

      case 'wrong':
        this.playExpand({ x, y, startRadius: 20, endRadius: 120, color: '#FF4444', lineWidth: 4, duration: 0.4 });
        this.playBurst({ x, y, count: 16, colors: ['#FF4444', '#FF8844'], duration: 0.5 });
        this.playFade({ x, y: y - 20, text: '-25 HP', color: '#FF4444', fontSize: 32, duration: 0.8 });
        break;

      case 'cast':
        this.playRadial({ x, y, rayCount: 16, innerRadius: 30, outerRadius: 200, color: '#C889FF', duration: 0.7 });
        this.playExpand({ x, y, startRadius: 20, endRadius: 250, color: '#28E6FF', lineWidth: 6, duration: 0.6 });
        this.playBurst({ x, y, count: 35, colors: ['#C889FF', '#28E6FF', '#FFFFFF', '#FFCB4D'], duration: 0.8 });
        this.playFade({ x, y: y - 40, text: '사고의 별!', color: '#C889FF', fontSize: 36, duration: 1.0 });
        break;

      case 'shield':
        this.playGlow({ x, y, radius: 100, color: '#28E6FF', maxAlpha: 0.7, duration: 0.5 });
        this.playPulse({ x, y, startRadius: 40, maxRadius: 120, color: '#4DFFAA', duration: 0.6 });
        this.playFade({ x, y: y - 30, text: 'DEFENSE!', color: '#28E6FF', fontSize: 28, duration: 0.7 });
        break;

      case 'combo':
        this.playPulse({ x, y, startRadius: 20, maxRadius: 90, color: '#FFCB4D', duration: 0.5 });
        this.playBurst({ x, y, count: 20, colors: ['#FFCB4D', '#FFAA00', '#FFFFFF'], duration: 0.5 });
        break;
    }
  }

  /**
   * 정답/오답/타임아웃 판정 시각 효과 재생 (VFX-002 / Issue #274)
   *
   * @param result 'correct' | 'wrong' | 'timeout'
   * @param x 이펙트 중심 X좌표
   * @param y 이펙트 중심 Y좌표
   * @param combo 현재 콤보 수
   */
  playAnswerEffect(
    result: 'correct' | 'wrong' | 'timeout',
    x: number,
    y: number,
    combo: number = 0,
  ): void {
    this._lastAnswerEffectTime = Date.now();

    if (result === 'correct') {
      const isCombo10 = combo >= 10;
      const isCombo5 = combo >= 5;

      const baseCfg = ANSWER_EFFECT_CONFIG.correct;
      const baseCount = baseCfg.baseCount;
      const count = isCombo10 ? baseCount * ANSWER_EFFECT_CONFIG.combo10Multiplier.count : baseCount;
      const sizeScale = isCombo10 ? ANSWER_EFFECT_CONFIG.combo10Multiplier.size : 1.0;

      // 에메랄드(#4DFFAA) + 시안(#28E6FF) 별/스파크 파티클 30~50개 방사형 버스트 (수명 0.8초)
      this._emitter.burst({
        x,
        y,
        count,
        colors: [...baseCfg.colors],
        speedMin: baseCfg.speedMin,
        speedMax: baseCfg.speedMax,
        sizeMin: baseCfg.sizeMin * sizeScale,
        sizeMax: baseCfg.sizeMax * sizeScale,
        endSizeMin: 0,
        endSizeMax: 1.5 * sizeScale,
        duration: baseCfg.duration,
        gravity: 60,
        drag: 0.95,
        shapes: [...baseCfg.shapes],
        vRotMin: -3,
        vRotMax: 3,
        startAlpha: 1,
        endAlpha: 0,
      });

      // 콤보 >= 5: 골드(#FFCB4D) 화염/스파크 추가 방출
      if (isCombo5) {
        const comboCfg = ANSWER_EFFECT_CONFIG.combo5;
        const flameCount = isCombo10 ? 30 : comboCfg.count;
        this._emitter.burst({
          x,
          y,
          count: flameCount,
          colors: [...comboCfg.colors],
          speedMin: comboCfg.speedMin,
          speedMax: comboCfg.speedMax,
          sizeMin: comboCfg.sizeMin * sizeScale,
          sizeMax: comboCfg.sizeMax * sizeScale,
          endSizeMin: 0,
          endSizeMax: 1.2 * sizeScale,
          duration: comboCfg.duration,
          gravity: 40,
          drag: 0.94,
          shapes: [...comboCfg.shapes],
          vRotMin: -4,
          vRotMax: 4,
          startAlpha: 1,
          endAlpha: 0,
        });
      }
    } else if (result === 'wrong') {
      const wrongCfg = ANSWER_EFFECT_CONFIG.wrong;
      // 화면 전체 적색(#FF4444) 플래시 오버레이 (0.3초 페이드아웃)
      this.triggerFlash(wrongCfg.flashColor, wrongCfg.flashDuration, wrongCfg.flashMaxAlpha);

      // 적색 비네팅 파티클 및 오답 파티클 방출
      this._emitter.burst({
        x,
        y,
        count: wrongCfg.particleCount,
        colors: [...wrongCfg.colors],
        speedMin: 80,
        speedMax: 220,
        sizeMin: 4,
        sizeMax: 8,
        endSizeMin: 0,
        endSizeMax: 2,
        duration: wrongCfg.duration,
        gravity: 80,
        drag: 0.94,
        shape: 'circle',
        startAlpha: 1,
        endAlpha: 0,
      });

      // 가장자리 적색 비네팅 파티클
      const vw = this._viewportWidth || 1280;
      const vh = this._viewportHeight || 720;
      const edgeOffsets = [
        { x: vw * 0.08, y: vh * 0.08 },
        { x: vw * 0.92, y: vh * 0.08 },
        { x: vw * 0.08, y: vh * 0.92 },
        { x: vw * 0.92, y: vh * 0.92 },
      ];
      for (const pos of edgeOffsets) {
        this._emitter.burst({
          x: pos.x,
          y: pos.y,
          count: 3,
          colors: ['#FF4444', '#990000', '#FF2222'],
          speedMin: 30,
          speedMax: 90,
          sizeMin: 5,
          sizeMax: 12,
          endSizeMin: 0,
          endSizeMax: 3,
          duration: wrongCfg.duration,
          drag: 0.92,
          shape: 'circle',
          startAlpha: 0.8,
          endAlpha: 0,
        });
      }
    } else if (result === 'timeout') {
      const timeoutCfg = ANSWER_EFFECT_CONFIG.timeout;
      // 회색(#888888) 안개/스모크 파티클 확산 (0.5초)
      this._emitter.burst({
        x,
        y,
        count: timeoutCfg.count,
        colors: [...timeoutCfg.colors],
        speedMin: timeoutCfg.speedMin,
        speedMax: timeoutCfg.speedMax,
        sizeMin: timeoutCfg.sizeMin,
        sizeMax: timeoutCfg.sizeMax,
        endSizeMin: timeoutCfg.endSizeMin,
        endSizeMax: timeoutCfg.endSizeMax,
        duration: timeoutCfg.duration,
        gravity: -20,
        drag: 0.92,
        shape: timeoutCfg.shape,
        startAlpha: timeoutCfg.startAlpha,
        endAlpha: timeoutCfg.endAlpha,
      });
    }
  }

  /**
   * 마나 100 도달 이펙트 재생 (VFX-003 / Issue #275)
   * 마나 바에서 보라빛(#C889FF) 펄스 파동 방출 및 화면 하단에서 상단으로 솟구치는 빛줄기 파티클 (0.5초)
   */
  playManaFullEffect(x: number, y: number): void {
    this._lastManaFullTime = Date.now();
    const cfg = GUARDIAN_EFFECT_CONFIG.manaFull;
    this.playPulse({
      x,
      y,
      startRadius: cfg.pulseStartRadius,
      maxRadius: cfg.pulseMaxRadius,
      color: cfg.pulseColor,
      lineWidth: cfg.pulseLineWidth,
      duration: cfg.duration,
    });

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

  /**
   * 수호신 스펠 시전 3단계 연쇄 시퀀스 재생 (VFX-003 / Issue #275)
   * 1) 수렴 (0~0.3초) -> 2) 발사/투사 (0.3~0.8초) -> 3) 폭발 (0.8~1.1초)
   */
  playGuardianCastSequence(
    guardianX: number,
    guardianY: number,
    bossX: number,
    bossY: number,
  ): void {
    this._lastGuardianCastTime = Date.now();
    const seq = new GuardianCastSequence(guardianX, guardianY, bossX, bossY, this);
    this._activeCastSequences.push(seq);
  }

  /**
   * 보스 피격 충격 이펙트 재생 (VFX-003 / Issue #275)
   * 보스 위치에서 주황/적색 충격 불꽃 파티클 (광폭화 시 진홍 스파크 강화)
   */
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

    this.playPulse({
      x: bossX,
      y: bossY,
      startRadius: 10,
      maxRadius: isEnraged ? 90 : 60,
      color: isEnraged ? '#FF0055' : '#FFAA00',
      lineWidth: isEnraged ? 4 : 3,
      duration: cfg.duration * 0.7,
    });
  }

  /**
   * 승리 결과 화면 축하 연출 (VFX-005 / Issue #277)
   * 5색(골드, 에메랄드, 시안, 마젠타, 화이트) 별/스파크/사각형 콘페티 대규모 폭발 및 상단 낙하 스트림
   */
  playVictoryCelebration(w: number, h: number, stars = 3): void {
    this._lastVictoryCelebrationTime = Date.now();
    const cfg = RESULT_EFFECT_CONFIG.victory;
    const clampedStars = Math.min(3, Math.max(1, stars));
    const burstCount = cfg.starCounts[clampedStars] ?? 250;

    // 대규모 폭발 방출
    this._emitter.burst({
      x: w * 0.5,
      y: h * 0.35,
      count: burstCount,
      colors: [...cfg.colors],
      shapes: [...cfg.shapes],
      speedMin: cfg.speedMin,
      speedMax: cfg.speedMax,
      sizeMin: cfg.sizeMin,
      sizeMax: cfg.sizeMax,
      durationMin: cfg.durationMin,
      durationMax: cfg.durationMax,
      gravity: cfg.gravity,
      drag: cfg.drag,
      vRotMin: -5,
      vRotMax: 5,
      startAlpha: 1,
      endAlpha: 0.1,
    });

    // 상단에서 흩날리며 떨어지는 지속 스트림 파티클
    this._emitter.stream({
      x: w * 0.5,
      y: -20,
      rate: cfg.streamRate,
      duration: cfg.streamDuration,
      colors: [...cfg.colors],
      shapes: [...cfg.shapes],
      speedMin: 50,
      speedMax: 160,
      angleMin: Math.PI * 0.25,
      angleMax: Math.PI * 0.75,
      gravity: 130,
      drag: 0.98,
      sizeMin: 4,
      sizeMax: 10,
      vRotMin: -4,
      vRotMax: 4,
      startAlpha: 0.9,
      endAlpha: 0.1,
    });
  }

  /**
   * 패배 결과 화면 침강 및 어두움 연출 (VFX-005 / Issue #277)
   * 2.0초 지속 비네팅 다크 오버레이 및 적색/보라 침강 파티클(25~35개) 하강
   */
  playDefeatDarken(w: number, h: number): void {
    this._lastDefeatDarkenTime = Date.now();
    const cfg = RESULT_EFFECT_CONFIG.defeat;
    this._defeatDarkenDuration = cfg.vignetteDuration;
    this._defeatDarkenTimer = cfg.vignetteDuration;

    // 25~35개 적색/보라 침강 파티클 하강 방출
    this._emitter.burst({
      x: w * 0.5,
      y: h * 0.25,
      count: cfg.particleCount,
      colors: [...cfg.colors],
      shapes: [...cfg.shapes],
      speedMin: cfg.speedMin,
      speedMax: cfg.speedMax,
      angleMin: Math.PI * 0.2,
      angleMax: Math.PI * 0.8,
      gravity: cfg.gravity,
      drag: cfg.drag,
      durationMin: cfg.durationMin,
      durationMax: cfg.durationMax,
      sizeMin: cfg.sizeMin,
      sizeMax: cfg.sizeMax,
      vRotMin: -2,
      vRotMax: 2,
      startAlpha: 0.9,
      endAlpha: 0,
    });
  }

  /**
   * 리듬 판정 플로팅 텍스트 재생 (Issue #283 / VFX-JUDGMENT-001)
   *
   * @param x 화면 X 좌표
   * @param y 화면 Y 좌표
   * @param rating 판정 등급 ('PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'MISS')
   * @param combo 현재 콤보 수
   */
  playJudgmentText(
    x: number,
    y: number,
    rating: JudgmentRating | string,
    combo?: number,
  ): void {
    const item = new FloatingJudgmentText(x, y, rating, combo);
    this._activeJudgmentTexts.push(item);

    if (item.rating === 'PERFECT') {
      this._emitter.burst({
        x,
        y,
        count: 10,
        colors: ['#FFCB4D', '#FFFFFF', '#FFF9C4'],
        speedMin: 30,
        speedMax: 100,
        sizeMin: 3,
        sizeMax: 6,
        duration: 0.35,
        shape: 'spark',
      });
    } else if (item.rating === 'GOOD') {
      this._emitter.burst({
        x,
        y,
        count: 6,
        colors: ['#28E6FF', '#FFFFFF'],
        speedMin: 20,
        speedMax: 80,
        sizeMin: 2,
        sizeMax: 5,
        duration: 0.3,
        shape: 'spark',
      });
    }
  }

  /**
   * 매 프레임 업데이트: 기본 이펙트 풀 반환 및 파티클 이미터 업데이트
   */
  update(dt: number): void {
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
    }

    if (this._defeatDarkenTimer > 0) {
      this._defeatDarkenTimer = Math.max(0, this._defeatDarkenTimer - dt);
    }

    let i = 0;
    while (i < this._active.length) {
      const effect = this._active[i];
      effect.update(dt);

      if (!effect.active) {
        effect.reset();
        this._returnToPool(effect);
        this._active.splice(i, 1);
      } else {
        i++;
      }
    }

    this._emitter.update(dt);

    // 활성 수호신 스펠 연쇄 시퀀스 업데이트 (VFX-003 / Issue #275)
    let s = 0;
    while (s < this._activeCastSequences.length) {
      const seq = this._activeCastSequences[s];
      seq.update(dt);
      if (!seq.active) {
        this._activeCastSequences.splice(s, 1);
      } else {
        s++;
      }
    }

    // 활성 리듬 판정 플로팅 텍스트 업데이트 (VFX-JUDGMENT-001 / Issue #283)
    let j = 0;
    while (j < this._activeJudgmentTexts.length) {
      const jt = this._activeJudgmentTexts[j];
      jt.update(dt);
      if (!jt.active) {
        this._activeJudgmentTexts.splice(j, 1);
      } else {
        j++;
      }
    }
  }

  /**
   * 모든 활성 이펙트 및 파티클 렌더링
   */
  render(ctx: CanvasRenderingContext2D, width?: number, height?: number): void {
    if (this._flashTimer > 0) {
      const alpha = this.flashAlpha;
      if (alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this._flashColor;
        const w = width ?? (ctx.canvas?.width || this._viewportWidth);
        const h = height ?? (ctx.canvas?.height || this._viewportHeight);
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    if (this._defeatDarkenTimer > 0) {
      const alpha = this.defeatDarkenAlpha;
      if (alpha > 0.001) {
        ctx.save();
        const w = width ?? (ctx.canvas?.width || this._viewportWidth);
        const h = height ?? (ctx.canvas?.height || this._viewportHeight);
        const cx = w * 0.5;
        const cy = h * 0.5;
        const maxR = Math.max(w, h) * 0.75;
        const grad = ctx.createRadialGradient(cx, cy, maxR * 0.2, cx, cy, maxR);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.6, `rgba(40, 0, 20, ${alpha * 0.5})`);
        grad.addColorStop(1, `rgba(15, 0, 10, ${alpha * 0.85})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    for (let i = 0; i < this._active.length; i++) {
      this._active[i].render(ctx);
    }
    for (let s = 0; s < this._activeCastSequences.length; s++) {
      this._activeCastSequences[s].render(ctx);
    }
    for (let j = 0; j < this._activeJudgmentTexts.length; j++) {
      this._activeJudgmentTexts[j].render(ctx);
    }
    this._emitter.render(ctx);
  }

  /**
   * 전체 이펙트 및 파티클 초기화 및 풀 반환
   */
  clear(): void {
    this._flashTimer = 0;
    this._defeatDarkenTimer = 0;
    for (let i = 0; i < this._active.length; i++) {
      const effect = this._active[i];
      effect.reset();
      this._returnToPool(effect);
    }
    this._active.length = 0;
    this._activeCastSequences.length = 0;
    this._activeJudgmentTexts.length = 0;
    this._emitter.clear();
  }

  private _returnToPool(effect: IVisualEffect): void {
    switch (effect.type) {
      case 'glow': this._poolGlow.push(effect as GlowEffect); break;
      case 'pulse': this._poolPulse.push(effect as PulseEffect); break;
      case 'expand': this._poolExpand.push(effect as ExpandEffect); break;
      case 'fade': this._poolFade.push(effect as FadeEffect); break;
      case 'burst': this._poolBurst.push(effect as BurstEffect); break;
      case 'radial': this._poolRadial.push(effect as RadialEffect); break;
      case 'trail': this._poolTrail.push(effect as TrailEffect); break;
    }
  }
}

export interface AnswerVFXOptions {
  getCoordinates?: (type: 'correct' | 'wrong' | 'timeout') => { x: number; y: number };
  debounceMs?: number;
}

export function wireAnswerVFX(
  eventBus: EventBus | { on: (event: any, handler: any) => void; off?: (event: any, handler: any) => void },
  effectManager: EffectManager,
  options?: AnswerVFXOptions,
): () => void {
  const debounceMs = options?.debounceMs ?? 100;

  const onCorrect = (data?: { mana?: number; combo?: number }) => {
    const now = Date.now();
    if (now - effectManager.lastAnswerEffectTime < debounceMs) return;
    const coords = options?.getCoordinates?.('correct') ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.5,
    };
    effectManager.playAnswerEffect('correct', coords.x, coords.y, data?.combo ?? 0);
  };

  const onWrong = (_data?: { hp?: number }) => {
    const now = Date.now();
    if (now - effectManager.lastAnswerEffectTime < debounceMs) return;
    const coords = options?.getCoordinates?.('wrong') ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.5,
    };
    effectManager.playAnswerEffect('wrong', coords.x, coords.y);
  };

  const onTimeout = () => {
    const now = Date.now();
    if (now - effectManager.lastAnswerEffectTime < debounceMs) return;
    const coords = options?.getCoordinates?.('timeout') ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.5,
    };
    effectManager.playAnswerEffect('timeout', coords.x, coords.y);
  };

  (eventBus as any).on('answer:correct', onCorrect);
  (eventBus as any).on('answer:wrong', onWrong);
  (eventBus as any).on('answer:timeout', onTimeout);

  return () => {
    if (typeof (eventBus as any).off === 'function') {
      (eventBus as any).off('answer:correct', onCorrect);
      (eventBus as any).off('answer:wrong', onWrong);
      (eventBus as any).off('answer:timeout', onTimeout);
    }
  };
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
  effectManager: EffectManager,
  options?: GuardianVFXOptions,
): () => void {
  const debounceMs = options?.debounceMs ?? 100;

  const onManaFull = () => {
    const now = Date.now();
    if (now - effectManager.lastManaFullTime < debounceMs) return;
    const coords = options?.getManaCoordinates?.() ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.95,
    };
    effectManager.playManaFullEffect(coords.x, coords.y);
  };

  const onGuardianCast = () => {
    const now = Date.now();
    if (now - effectManager.lastGuardianCastTime < debounceMs) return;
    const gCoords = options?.getGuardianCoordinates?.() ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.84,
    };
    const bCoords = options?.getBossCoordinates?.() ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.24,
    };
    effectManager.playGuardianCastSequence(gCoords.x, gCoords.y, bCoords.x, bCoords.y);
  };

  const onBossHit = () => {
    const now = Date.now();
    if (now - effectManager.lastBossHitTime < debounceMs) return;
    const bCoords = options?.getBossCoordinates?.() ?? {
      x: effectManager.viewportWidth * 0.5,
      y: effectManager.viewportHeight * 0.24,
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
