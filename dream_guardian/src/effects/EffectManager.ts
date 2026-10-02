/**
 * EffectManager - 7종 시각 효과 관리 및 고성능 파티클 엔진 풀링 시스템
 *
 * Issue #24: GC 방지 객체 풀링(Object Pooling) 및 게임 로직 분리
 * Issue #273: [VFX-001] 파티클 엔진 기반 시스템 구축 (ParticleEmitter 통합)
 * Issue #299: [REFACTOR-FX-001] 서브모듈 분리 (CombatVFX & ScreenFX 위임 Facade)
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
  RESULT_EFFECT_CONFIG,
} from '../../config/effect.config.js';
import type { EventBus } from '../core/EventBus.js';
import {
  CombatVFX,
  GuardianCastSequence,
  FloatingJudgmentText,
  JUDGMENT_CONFIGS,
  wireGuardianVFX,
  type CastSequencePhase,
  type SlashOptions,
  type SlashEffect,
  type JudgmentRating,
  type JudgmentTextConfig,
  type GuardianVFXOptions,
} from './CombatVFX.js';
import { ScreenFX, type ShakeOptions } from './ScreenFX.js';

export {
  GuardianCastSequence,
  FloatingJudgmentText,
  JUDGMENT_CONFIGS,
  wireGuardianVFX,
  type CastSequencePhase,
  type SlashOptions,
  type SlashEffect,
  type JudgmentRating,
  type JudgmentTextConfig,
  type GuardianVFXOptions,
};

export class EffectManager {
  private _active: IVisualEffect[] = [];
  private _activeJudgmentTexts: FloatingJudgmentText[] = [];
  private _viewportWidth = 1280;
  private _viewportHeight = 720;
  private _lastAnswerEffectTime = 0;
  private _lastVictoryCelebrationTime = 0;

  // 7종 기본 비주얼 이펙트 풀
  private _poolGlow: GlowEffect[] = [];
  private _poolPulse: PulseEffect[] = [];
  private _poolExpand: ExpandEffect[] = [];
  private _poolFade: FadeEffect[] = [];
  private _poolBurst: BurstEffect[] = [];
  private _poolRadial: RadialEffect[] = [];
  private _poolTrail: TrailEffect[] = [];

  // 범용 파티클 이미터 & 위임 서브모듈
  private _emitter: ParticleEmitter;
  private _screenFX: ScreenFX;
  private _combatVFX: CombatVFX;

  constructor(prewarmCount = 10, maxParticles = 500) {
    if (prewarmCount > 0) {
      this.prewarm(prewarmCount);
    }
    this._emitter = new ParticleEmitter({ maxParticles, prewarm: true });
    this._screenFX = new ScreenFX();
    this._combatVFX = new CombatVFX(this._emitter, this);
  }

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
    this._screenFX.setViewport(width, height);
  }

  get viewportWidth(): number { return this._viewportWidth; }
  get viewportHeight(): number { return this._viewportHeight; }

  // ===== 서브모듈 인스턴스 접근자 =====
  get screenFX(): ScreenFX { return this._screenFX; }
  get combatVFX(): CombatVFX { return this._combatVFX; }
  get particleEmitter(): ParticleEmitter { return this._emitter; }

  // ===== 화면 연출 (ScreenFX 위임) =====
  get isFlashActive(): boolean { return this._screenFX.isFlashActive; }
  get flashAlpha(): number { return this._screenFX.flashAlpha; }
  get flashTimer(): number { return this._screenFX.flashTimer; }
  get flashColor(): string { return this._screenFX.flashColor; }
  get isDefeatDarkenActive(): boolean { return this._screenFX.isDefeatDarkenActive; }
  get defeatDarkenTimer(): number { return this._screenFX.defeatDarkenTimer; }
  get defeatDarkenDuration(): number { return this._screenFX.defeatDarkenDuration; }
  get defeatDarkenAlpha(): number { return this._screenFX.defeatDarkenAlpha; }
  get lastDefeatDarkenTime(): number { return this._screenFX.lastDefeatDarkenTime; }
  get isShakeActive(): boolean { return this._screenFX.isShakeActive; }
  get shakeOffsetX(): number { return this._screenFX.shakeOffsetX; }
  get shakeOffsetY(): number { return this._screenFX.shakeOffsetY; }
  get shakeIntensity(): number { return this._screenFX.shakeIntensity; }
  get shakeDuration(): number { return this._screenFX.shakeDuration; }

  triggerFlash(color = '#FF4444', duration = 0.3, maxAlpha = 0.4): void {
    this._screenFX.triggerFlash(color, duration, maxAlpha);
  }

  triggerShake(intensityOrOptions: number | ShakeOptions = 10, duration = 0.3): void {
    this._screenFX.triggerShake(intensityOrOptions, duration);
  }

  playDefeatDarken(w: number, h: number): void {
    this._screenFX.playDefeatDarken(w, h);
    const cfg = RESULT_EFFECT_CONFIG.defeat;
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

  // ===== 전투 연출 (CombatVFX 위임) =====
  get activeCastSequences(): readonly GuardianCastSequence[] { return this._combatVFX.activeCastSequences; }
  get activeSlashes(): readonly SlashEffect[] { return this._combatVFX.activeSlashes; }
  get lastGuardianCastTime(): number { return this._combatVFX.lastGuardianCastTime; }
  get lastBossHitTime(): number { return this._combatVFX.lastBossHitTime; }
  get lastManaFullTime(): number { return this._combatVFX.lastManaFullTime; }

  playSlash(options: SlashOptions): SlashEffect { return this._combatVFX.playSlash(options); }
  triggerSlash(options: SlashOptions): SlashEffect { return this._combatVFX.triggerSlash(options); }
  playGuardianCastSequence(gx: number, gy: number, bx: number, by: number): GuardianCastSequence {
    return this._combatVFX.playGuardianCastSequence(gx, gy, bx, by);
  }
  playBossHitImpact(bossX: number, bossY: number, isEnraged = false): void {
    this._combatVFX.playBossHitImpact(bossX, bossY, isEnraged);
  }
  playHazardHit(x: number, y: number, damage = 25): void {
    this._combatVFX.playHazardHit(x, y, damage);
  }
  playManaFullEffect(x: number, y: number): void {
    this._combatVFX.playManaFullEffect(x, y);
  }

  // ===== 상태 조회 & 풀 통계 =====
  get lastAnswerEffectTime(): number { return this._lastAnswerEffectTime; }
  get lastVictoryCelebrationTime(): number { return this._lastVictoryCelebrationTime; }
  get activeCount(): number { return this._active.length; }
  get activeJudgmentTexts(): readonly FloatingJudgmentText[] { return this._activeJudgmentTexts; }
  get particleActiveCount(): number { return this._emitter.activeCount; }
  get totalActiveCount(): number { return this._active.length + this._emitter.activeCount; }
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

  // ===== 7종 기본 비주얼 이펙트 =====
  playGlow(opt: GlowOptions): GlowEffect { const e = this._poolGlow.pop() ?? new GlowEffect(); e.init(opt); this._active.push(e); return e; }
  playPulse(opt: PulseOptions): PulseEffect { const e = this._poolPulse.pop() ?? new PulseEffect(); e.init(opt); this._active.push(e); return e; }
  playExpand(opt: ExpandOptions): ExpandEffect { const e = this._poolExpand.pop() ?? new ExpandEffect(); e.init(opt); this._active.push(e); return e; }
  playFade(opt: FadeOptions): FadeEffect { const e = this._poolFade.pop() ?? new FadeEffect(); e.init(opt); this._active.push(e); return e; }
  playBurst(opt: BurstOptions): BurstEffect { const e = this._poolBurst.pop() ?? new BurstEffect(); e.init(opt); this._active.push(e); return e; }
  playRadial(opt: RadialOptions): RadialEffect { const e = this._poolRadial.pop() ?? new RadialEffect(); e.init(opt); this._active.push(e); return e; }
  playTrail(opt: TrailOptions): TrailEffect { const e = this._poolTrail.pop() ?? new TrailEffect(); e.init(opt); this._active.push(e); return e; }

  // ===== 파티클 연출 =====
  burst(options: ParticleBurstOptions): void { this._emitter.burst(options); }
  stream(options: ParticleStreamOptions): void { this._emitter.stream(options); }

  playPresetEffect(presetName: ParticlePresetName, x: number, y: number, options?: Partial<ParticleBurstOptions>): void {
    const config = PARTICLE_PRESETS[presetName];
    if (config) {
      const burstOpts: ParticleBurstOptions = { ...config, x, y, ...options };
      if (options?.duration !== undefined) {
        if (options.durationMin === undefined) burstOpts.durationMin = options.duration;
        if (options.durationMax === undefined) burstOpts.durationMax = options.duration;
      }
      this._emitter.burst(burstOpts);
    }
  }

  playEffect(name: ParticlePresetName | EffectType | string, xOrOptions?: any, y?: number, extra?: Partial<ParticleBurstOptions>): any {
    if (name in PARTICLE_PRESETS && typeof xOrOptions === 'number' && typeof y === 'number') {
      this.playPresetEffect(name as ParticlePresetName, xOrOptions, y, extra);
      return;
    }
    return this.play(name as any, xOrOptions, y, extra);
  }

  play(typeOrPreset: EffectType | PresetName | ParticlePresetName, optionsOrX?: any, y?: number, extra?: Partial<ParticleBurstOptions>): any {
    if (typeOrPreset in PARTICLE_PRESETS && typeof optionsOrX === 'number' && typeof y === 'number') {
      this.playPresetEffect(typeOrPreset as ParticlePresetName, optionsOrX, y, extra);
      return;
    }
    switch (typeOrPreset) {
      case 'glow': return this.playGlow(optionsOrX);
      case 'pulse': return this.playPulse(optionsOrX);
      case 'expand': return this.playExpand(optionsOrX);
      case 'fade': return this.playFade(optionsOrX);
      case 'burst': return this.playBurst(optionsOrX);
      case 'radial': return this.playRadial(optionsOrX);
      case 'trail': return this.playTrail(optionsOrX);
      case 'correct':
      case 'wrong':
      case 'cast':
      case 'shield':
      case 'combo':
        if (typeof optionsOrX === 'number' && typeof y === 'number') {
          this.playPreset(typeOrPreset as PresetName, optionsOrX, y);
        }
        return;
      default:
        return;
    }
  }

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
        this.playFade({ x, y: y - 40, text: '수호신 강림!', color: '#C889FF', fontSize: 36, duration: 1.0 });
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

  playAnswerEffect(result: 'correct' | 'wrong' | 'timeout', x: number, y: number, combo = 0): void {
    this._lastAnswerEffectTime = Date.now();

    if (result === 'correct') {
      const isCombo10 = combo >= 10;
      const isCombo5 = combo >= 5;
      const baseCfg = ANSWER_EFFECT_CONFIG.correct;
      const count = isCombo10 ? baseCfg.baseCount * ANSWER_EFFECT_CONFIG.combo10Multiplier.count : baseCfg.baseCount;
      const sizeScale = isCombo10 ? ANSWER_EFFECT_CONFIG.combo10Multiplier.size : 1.0;

      this._emitter.burst({
        x, y, count,
        colors: [...baseCfg.colors],
        speedMin: baseCfg.speedMin, speedMax: baseCfg.speedMax,
        sizeMin: baseCfg.sizeMin * sizeScale, sizeMax: baseCfg.sizeMax * sizeScale,
        endSizeMin: 0, endSizeMax: 1.5 * sizeScale,
        duration: baseCfg.duration, gravity: 60, drag: 0.95,
        shapes: [...baseCfg.shapes], vRotMin: -3, vRotMax: 3,
        startAlpha: 1, endAlpha: 0,
      });

      if (isCombo5) {
        const comboCfg = ANSWER_EFFECT_CONFIG.combo5;
        const flameCount = isCombo10 ? 30 : comboCfg.count;
        this._emitter.burst({
          x, y, count: flameCount,
          colors: [...comboCfg.colors],
          speedMin: comboCfg.speedMin, speedMax: comboCfg.speedMax,
          sizeMin: comboCfg.sizeMin * sizeScale, sizeMax: comboCfg.sizeMax * sizeScale,
          endSizeMin: 0, endSizeMax: 1.2 * sizeScale,
          duration: comboCfg.duration, gravity: 40, drag: 0.94,
          shapes: [...comboCfg.shapes], vRotMin: -4, vRotMax: 4,
          startAlpha: 1, endAlpha: 0,
        });
      }
    } else if (result === 'wrong') {
      const wrongCfg = ANSWER_EFFECT_CONFIG.wrong;
      this.triggerFlash(wrongCfg.flashColor, wrongCfg.flashDuration, wrongCfg.flashMaxAlpha);

      this._emitter.burst({
        x, y,
        count: wrongCfg.particleCount,
        colors: [...wrongCfg.colors],
        speedMin: 80, speedMax: 220,
        sizeMin: 4, sizeMax: 8,
        endSizeMin: 0, endSizeMax: 2,
        duration: wrongCfg.duration,
        gravity: 80, drag: 0.94,
        shape: 'circle',
        startAlpha: 1, endAlpha: 0,
      });

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
          x: pos.x, y: pos.y, count: 3,
          colors: ['#FF4444', '#990000', '#FF2222'],
          speedMin: 30, speedMax: 90,
          sizeMin: 5, sizeMax: 12,
          endSizeMin: 0, endSizeMax: 3,
          duration: wrongCfg.duration,
          drag: 0.92, shape: 'circle',
          startAlpha: 0.8, endAlpha: 0,
        });
      }
    } else if (result === 'timeout') {
      const timeoutCfg = ANSWER_EFFECT_CONFIG.timeout;
      this._emitter.burst({
        x, y,
        count: timeoutCfg.count,
        colors: [...timeoutCfg.colors],
        speedMin: timeoutCfg.speedMin, speedMax: timeoutCfg.speedMax,
        sizeMin: timeoutCfg.sizeMin, sizeMax: timeoutCfg.sizeMax,
        endSizeMin: timeoutCfg.endSizeMin, endSizeMax: timeoutCfg.endSizeMax,
        duration: timeoutCfg.duration,
        gravity: -20, drag: 0.92,
        shape: timeoutCfg.shape,
        startAlpha: timeoutCfg.startAlpha, endAlpha: timeoutCfg.endAlpha,
      });
    }
  }

  playVictoryCelebration(w: number, h: number, stars = 3): void {
    this._lastVictoryCelebrationTime = Date.now();
    const cfg = RESULT_EFFECT_CONFIG.victory;
    const clampedStars = Math.min(3, Math.max(1, stars));
    const burstCount = cfg.starCounts[clampedStars] ?? 250;

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

  playJudgmentText(x: number, y: number, rating: JudgmentRating | string, combo?: number): void {
    const item = new FloatingJudgmentText(x, y, rating, combo);
    this._activeJudgmentTexts.push(item);

    if (item.rating === 'PERFECT') {
      this._emitter.burst({
        x, y, count: 10,
        colors: ['#FFCB4D', '#FFFFFF', '#FFF9C4'],
        speedMin: 30, speedMax: 100, sizeMin: 3, sizeMax: 6,
        duration: 0.35, shape: 'spark',
      });
    } else if (item.rating === 'GOOD') {
      this._emitter.burst({
        x, y, count: 6,
        colors: ['#28E6FF', '#FFFFFF'],
        speedMin: 20, speedMax: 70, sizeMin: 2, sizeMax: 5,
        duration: 0.3, shape: 'spark',
      });
    }
  }

  update(dt: number): void {
    this._screenFX.update(dt);

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
    this._combatVFX.update(dt);

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

  render(ctx: CanvasRenderingContext2D, width?: number, height?: number): void {
    const w = width ?? this._viewportWidth;
    const h = height ?? this._viewportHeight;

    this._screenFX.render(ctx, w, h);

    for (let i = 0; i < this._active.length; i++) {
      this._active[i].render(ctx);
    }
    this._combatVFX.render(ctx);

    for (let j = 0; j < this._activeJudgmentTexts.length; j++) {
      this._activeJudgmentTexts[j].render(ctx);
    }
    this._emitter.render(ctx);
  }

  clear(): void {
    this._screenFX.clear();
    this._combatVFX.clear();
    for (let i = 0; i < this._active.length; i++) {
      const effect = this._active[i];
      effect.reset();
      this._returnToPool(effect);
    }
    this._active.length = 0;
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
