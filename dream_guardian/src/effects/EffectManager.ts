/**
 * EffectManager - 7종 시각 효과 관리 및 객체 풀링 시스템
 *
 * Issue #24: GC 방지 객체 풀링(Object Pooling) 및 게임 로직 분리
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

export class EffectManager {
  private _active: IVisualEffect[] = [];

  // 타입별 객체 풀
  private _poolGlow: GlowEffect[] = [];
  private _poolPulse: PulseEffect[] = [];
  private _poolExpand: ExpandEffect[] = [];
  private _poolFade: FadeEffect[] = [];
  private _poolBurst: BurstEffect[] = [];
  private _poolRadial: RadialEffect[] = [];
  private _poolTrail: TrailEffect[] = [];

  constructor(prewarmCount = 10) {
    if (prewarmCount > 0) {
      this.prewarm(prewarmCount);
    }
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

  get activeCount(): number {
    return this._active.length;
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
   * 제네릭 재생 함수
   */
  play(type: EffectType, options: any): IVisualEffect {
    switch (type) {
      case 'glow': return this.playGlow(options);
      case 'pulse': return this.playPulse(options);
      case 'expand': return this.playExpand(options);
      case 'fade': return this.playFade(options);
      case 'burst': return this.playBurst(options);
      case 'radial': return this.playRadial(options);
      case 'trail': return this.playTrail(options);
    }
  }

  /**
   * 게임플레이 프리셋 연출
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
   * 매 프레임 업데이트: 만료된 이펙트는 풀로 반환
   */
  update(dt: number): void {
    let i = 0;
    while (i < this._active.length) {
      const effect = this._active[i];
      effect.update(dt);

      if (!effect.active) {
        // 배열에서 제거하고 해당 풀로 반환
        effect.reset();
        this._returnToPool(effect);
        this._active.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * 모든 활성 이펙트 렌더링
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._active.length; i++) {
      this._active[i].render(ctx);
    }
  }

  /**
   * 전체 이펙트 초기화 및 풀 반환
   */
  clear(): void {
    for (let i = 0; i < this._active.length; i++) {
      const effect = this._active[i];
      effect.reset();
      this._returnToPool(effect);
    }
    this._active.length = 0;
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
