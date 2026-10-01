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
} from '../../config/effect.config.js';
import type { EventBus } from '../core/EventBus.js';

export class EffectManager {
  private _active: IVisualEffect[] = [];

  // 적색/오버레이 플래시 관리 (VFX-002 / Issue #274)
  private _flashColor: string = '#FF4444';
  private _flashDuration: number = 0.3;
  private _flashTimer: number = 0;
  private _flashMaxAlpha: number = 0.4;
  private _viewportWidth: number = 1280;
  private _viewportHeight: number = 720;
  private _lastAnswerEffectTime: number = 0;

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
   * 매 프레임 업데이트: 기본 이펙트 풀 반환 및 파티클 이미터 업데이트
   */
  update(dt: number): void {
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
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

    for (let i = 0; i < this._active.length; i++) {
      this._active[i].render(ctx);
    }
    this._emitter.render(ctx);
  }

  /**
   * 전체 이펙트 및 파티클 초기화 및 풀 반환
   */
  clear(): void {
    this._flashTimer = 0;
    for (let i = 0; i < this._active.length; i++) {
      const effect = this._active[i];
      effect.reset();
      this._returnToPool(effect);
    }
    this._active.length = 0;
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
