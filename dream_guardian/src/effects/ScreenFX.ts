/**
 * ScreenFX - 화면 연출 서브모듈
 *
 * Issue #299: [REFACTOR-FX-001] EffectManager 서브모듈 분리
 * - 화면 흔들림(shake)
 * - 적색/오버레이 플래시(flash)
 * - 암전/비네팅 다크 오버레이(defeat darken / fade)
 */

import { RESULT_EFFECT_CONFIG } from '../../config/effect.config.js';

export interface ShakeOptions {
  intensity?: number;
  duration?: number;
}

export class ScreenFX {
  // 화면 흔들림 상태
  private _shakeIntensity = 0;
  private _shakeDuration = 0;
  private _shakeTimer = 0;
  private _shakeOffsetX = 0;
  private _shakeOffsetY = 0;

  // 플래시 효과 상태
  private _flashColor = '#FF4444';
  private _flashDuration = 0.3;
  private _flashTimer = 0;
  private _flashMaxAlpha = 0.4;

  // 암전 / 비네팅 효과 상태
  private _defeatDarkenTimer = 0;
  private _defeatDarkenDuration = 2.0;
  private _defeatDarkenMaxAlpha = 0.8;
  private _lastDefeatDarkenTime = 0;

  // 뷰포트 크기
  private _viewportWidth = 1280;
  private _viewportHeight = 720;

  constructor() {
    this._defeatDarkenMaxAlpha = RESULT_EFFECT_CONFIG.defeat.maxAlpha ?? 0.8;
  }

  // ===== 화면 흔들림 (Shake) =====

  get isShakeActive(): boolean {
    return this._shakeTimer > 0;
  }

  get shakeIntensity(): number {
    return this._shakeIntensity;
  }

  get shakeDuration(): number {
    return this._shakeDuration;
  }

  get shakeTimer(): number {
    return this._shakeTimer;
  }

  get shakeOffsetX(): number {
    return this._shakeOffsetX;
  }

  get shakeOffsetY(): number {
    return this._shakeOffsetY;
  }

  triggerShake(intensityOrOptions: number | ShakeOptions = 10, duration = 0.3): void {
    if (typeof intensityOrOptions === 'number') {
      this._shakeIntensity = intensityOrOptions;
      this._shakeDuration = duration;
    } else {
      this._shakeIntensity = intensityOrOptions.intensity ?? 10;
      this._shakeDuration = intensityOrOptions.duration ?? duration;
    }
    this._shakeTimer = this._shakeDuration;
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;
  }

  // ===== 플래시 (Flash) =====

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

  get flashDuration(): number {
    return this._flashDuration;
  }

  get flashColor(): string {
    return this._flashColor;
  }

  get flashMaxAlpha(): number {
    return this._flashMaxAlpha;
  }

  triggerFlash(color = '#FF4444', duration = 0.3, maxAlpha = 0.4): void {
    this._flashColor = color;
    this._flashDuration = duration;
    this._flashTimer = duration;
    this._flashMaxAlpha = maxAlpha;
  }

  // ===== 암전 / 비네팅 페이드 (Defeat Darken / Fade) =====

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
    return this._defeatDarkenMaxAlpha * Math.min(fadeIn, fadeOut);
  }

  get lastDefeatDarkenTime(): number {
    return this._lastDefeatDarkenTime;
  }

  playDefeatDarken(width?: number, height?: number, duration?: number, maxAlpha?: number): void {
    this._lastDefeatDarkenTime = Date.now();
    const cfg = RESULT_EFFECT_CONFIG.defeat;
    this._defeatDarkenDuration = duration ?? cfg.vignetteDuration;
    this._defeatDarkenTimer = this._defeatDarkenDuration;
    this._defeatDarkenMaxAlpha = maxAlpha ?? (cfg.maxAlpha ?? 0.8);
    if (width !== undefined && height !== undefined) {
      this.setViewport(width, height);
    }
  }

  triggerFade(duration = 2.0, maxAlpha = 0.8): void {
    this.playDefeatDarken(undefined, undefined, duration, maxAlpha);
  }

  // ===== 뷰포트 설정 =====

  setViewport(width: number, height: number): void {
    this._viewportWidth = width;
    this._viewportHeight = height;
  }

  // ===== 생명주기 관리 =====

  update(dt: number): void {
    if (this._shakeTimer > 0) {
      this._shakeTimer = Math.max(0, this._shakeTimer - dt);
      if (this._shakeTimer > 0) {
        const decay = this._shakeTimer / this._shakeDuration;
        const amp = this._shakeIntensity * decay;
        this._shakeOffsetX = (Math.random() * 2 - 1) * amp;
        this._shakeOffsetY = (Math.random() * 2 - 1) * amp;
      } else {
        this._shakeOffsetX = 0;
        this._shakeOffsetY = 0;
      }
    }

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
    }

    if (this._defeatDarkenTimer > 0) {
      this._defeatDarkenTimer = Math.max(0, this._defeatDarkenTimer - dt);
    }
  }

  render(ctx: CanvasRenderingContext2D, width?: number, height?: number): void {
    const w = width ?? this._viewportWidth;
    const h = height ?? this._viewportHeight;

    // 플래시 오버레이
    if (this._flashTimer > 0) {
      const alpha = this.flashAlpha;
      if (alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this._flashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    // 암전/비네팅 효과
    if (this._defeatDarkenTimer > 0) {
      const dAlpha = this.defeatDarkenAlpha;
      if (dAlpha > 0.001) {
        ctx.save();
        const cx = w * 0.5;
        const cy = h * 0.5;
        const maxR = Math.max(w, h) * 0.75;
        const grad = ctx.createRadialGradient(cx, cy, maxR * 0.2, cx, cy, maxR);
        grad.addColorStop(0, 'rgba(10, 5, 20, 0)');
        grad.addColorStop(0.7, `rgba(20, 5, 25, ${dAlpha * 0.7})`);
        grad.addColorStop(1, `rgba(15, 0, 15, ${dAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
  }

  reset(): void {
    this._shakeTimer = 0;
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;
    this._flashTimer = 0;
    this._defeatDarkenTimer = 0;
  }

  clear(): void {
    this.reset();
  }
}
