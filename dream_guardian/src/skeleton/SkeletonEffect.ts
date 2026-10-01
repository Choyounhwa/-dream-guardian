/**
 * SkeletonEffect - 스켈레톤 상태 기반 시각 이펙트 관리자
 *
 * 1) 호흡 글로우 (breathGlow): 관절 부드러운 펄스 (주기 2초), 마나 0~100% 연동 시안(#28E6FF)->보라(#C889FF) 보간
 * 2) 정답 펄스 (correctPulse): 에메랄드(#4DFFAA) 플래시 (0.3초), 5+ 연쇄 콤보 시 강도 및 크기 배율 증가
 * 3) 오답/피격 플래시 (hitFlash): 적색(#FF4444) 플래시 (0.2초), HP 50% 이하 경고 펄스
 * 4) 모션 트레일 (motionTrail): 손(19, 20) 및 발(31, 32) 4~6프레임 잔상 버퍼
 *
 * @see Issue #276 / Task [VFX-004]
 */

import { SKELETON_EFFECT_CONFIG, type SkeletonEffectConfig } from '../../config/effect.config.js';

export interface TrailPoint {
  x: number;
  y: number;
  speed: number;
  alpha: number;
  timestamp: number;
}

/** 16진수 색상 선형 보간 유틸리티 */
export function interpolateHexColor(color1: string, color2: string, t: number): string {
  const clampT = Math.max(0, Math.min(1, t));
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * clampT);
  const g = Math.round(g1 + (g2 - g1) * clampT);
  const b = Math.round(b1 + (b2 - b1) * clampT);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

export class SkeletonEffect {
  private readonly _config: SkeletonEffectConfig;

  private _time = 0;
  private _breathTime = 0;
  private _correctTimer = 0;
  private _correctIntensity = 1.0;
  private _hitTimer = 0;
  private _warningTimer = 0;

  private _manaRatio = 0;
  private _hpRatio = 1.0;

  private _trails = new Map<number, TrailPoint[]>();
  private _lastSpeeds = new Map<number, number>();

  constructor(customConfig?: Partial<SkeletonEffectConfig>) {
    this._config = {
      ...SKELETON_EFFECT_CONFIG,
      ...customConfig,
    };
  }

  // ─── Getters ───
  get breathCycle(): number {
    return this._config.breathCycle;
  }

  get manaRatio(): number {
    return this._manaRatio;
  }

  get hpRatio(): number {
    return this._hpRatio;
  }

  get isCorrectPulseActive(): boolean {
    return this._correctTimer > 0;
  }

  get correctPulseTimer(): number {
    return Math.max(0, this._correctTimer);
  }

  get correctIntensity(): number {
    return this._correctIntensity;
  }

  get isHitFlashActive(): boolean {
    return this._hitTimer > 0;
  }

  get hitFlashTimer(): number {
    return Math.max(0, this._hitTimer);
  }

  get isLowHpWarning(): boolean {
    return this._hpRatio <= this._config.hitFlash.lowHpThreshold;
  }

  /** 호흡 펄스 스케일 진동 (기본 1.0 ± 0.15) */
  get breathGlowScale(): number {
    return (
      1.0 +
      Math.sin((this._breathTime / this._config.breathCycle) * Math.PI * 2) * 0.15
    );
  }

  /** 마나 연동 색상 선형 보간 (0% 시안 #28E6FF -> 100% 보라 #C889FF) */
  getManaGlowColor(): string {
    return interpolateHexColor(
      this._config.manaGlow.startColor,
      this._config.manaGlow.endColor,
      this._manaRatio,
    );
  }

  /** 현재 최우선 글로우 색상 (피격 적색 > 정답 에메랄드 > 마나 호흡 색상) */
  getCurrentGlowColor(): string {
    if (this._hitTimer > 0) {
      return this._config.hitFlash.color;
    }
    if (this._correctTimer > 0) {
      return this._config.correctPulse.color;
    }
    return this.getManaGlowColor();
  }

  /** 관절별 트레일 큐 크기 */
  getTrailCount(jointIndex: number): number {
    return this._trails.get(jointIndex)?.length ?? 0;
  }

  /** 관절별 트레일 버퍼 */
  getTrail(jointIndex: number): readonly TrailPoint[] {
    return this._trails.get(jointIndex) ?? [];
  }

  /** 관절별 이동 속도 배율 */
  getTrailSpeedMultiplier(jointIndex: number): number {
    const speed = this._lastSpeeds.get(jointIndex) ?? 0;
    const threshold = this._config.trail.speedThreshold;
    if (speed <= threshold) {
      return 1.0;
    }
    const extra = (speed - threshold) / threshold;
    return Math.min(2.5, 1.0 + extra * (this._config.trail.speedAlphaMultiplier - 1.0));
  }

  // ─── Setters & Triggers ───
  setMana(mana: number, maxMana = 100): void {
    this._manaRatio = Math.max(0, Math.min(1, maxMana > 0 ? mana / maxMana : 0));
  }

  setHp(hp: number, maxHp = 100): void {
    this._hpRatio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  }

  /** 정답 펄스 발동 (지속 0.3초, 5+ 콤보 시 강도 배율 증가) */
  triggerCorrect(combo = 0): void {
    this._correctTimer = this._config.correctPulse.duration;
    if (combo >= this._config.correctPulse.comboThreshold) {
      this._correctIntensity = Math.min(
        this._config.correctPulse.maxIntensity,
        this._config.correctPulse.comboMultiplier + (combo - this._config.correctPulse.comboThreshold) * 0.1,
      );
    } else {
      this._correctIntensity = this._config.correctPulse.baseIntensity;
    }
  }

  /** 피격/오답 플래시 발동 (지속 0.2초) */
  triggerHit(): void {
    this._hitTimer = this._config.hitFlash.duration;
  }

  /** 손(19, 20) 및 발(31, 32) 커서 위치 기록 (4~6프레임 큐 관리) */
  recordJointPositions(joints: Record<number, { x: number; y: number }>): void {
    for (const jointId of this._config.trail.trackedJoints) {
      const pt = joints[jointId];
      if (!pt) continue;

      const queue = this._trails.get(jointId) ?? [];
      const lastPt = queue.length > 0 ? queue[queue.length - 1] : null;
      let speed = 0;
      if (lastPt) {
        const dx = pt.x - lastPt.x;
        const dy = pt.y - lastPt.y;
        speed = Math.sqrt(dx * dx + dy * dy);
      }
      this._lastSpeeds.set(jointId, speed);

      queue.push({
        x: pt.x,
        y: pt.y,
        speed,
        alpha: 1.0,
        timestamp: this._time,
      });

      while (queue.length > this._config.trail.maxFrames) {
        queue.shift();
      }

      this._trails.set(jointId, queue);
    }
  }

  // ─── Lifecycle ───
  update(dt: number): void {
    this._time += dt;
    this._breathTime += dt;

    if (this._correctTimer > 0) {
      this._correctTimer = Math.max(0, this._correctTimer - dt);
    }
    if (this._hitTimer > 0) {
      this._hitTimer = Math.max(0, this._hitTimer - dt);
    }

    if (this.isLowHpWarning) {
      this._warningTimer += dt;
    } else {
      this._warningTimer = 0;
    }
  }

  reset(): void {
    this._time = 0;
    this._breathTime = 0;
    this._correctTimer = 0;
    this._correctIntensity = 1.0;
    this._hitTimer = 0;
    this._warningTimer = 0;
    this._manaRatio = 0;
    this._hpRatio = 1.0;
    this._trails.clear();
    this._lastSpeeds.clear();
  }

  // ─── Rendering ───
  /**
   * 스켈레톤 관절에 부드러운 펄스 글로우 드로잉
   */
  renderGlow(
    ctx: CanvasRenderingContext2D,
    joints: Record<number, { x: number; y: number }>,
    scaleX = 1,
  ): void {
    const jointKeys = Object.keys(joints);
    if (jointKeys.length === 0) return;

    ctx.save();
    const glowColor = this.getCurrentGlowColor();
    const breathScale = this.breathGlowScale;
    const isHit = this.isHitFlashActive;
    const isCorrect = this.isCorrectPulseActive;
    const isLowHp = this.isLowHpWarning;

    let baseAlpha =
      this._config.manaGlow.minAlpha +
      (this._config.manaGlow.maxAlpha - this._config.manaGlow.minAlpha) *
        (0.5 + 0.5 * Math.sin((this._breathTime / this._config.breathCycle) * Math.PI * 2));

    let radiusScale = breathScale;
    if (isHit) {
      baseAlpha = Math.min(1.0, 0.7 * (this._hitTimer / this._config.hitFlash.duration) + 0.3);
      radiusScale = 1.3;
    } else if (isCorrect) {
      baseAlpha = Math.min(1.0, 0.6 * this._correctIntensity);
      radiusScale = 1.2 * this._correctIntensity;
    } else if (isLowHp) {
      const warnSin = Math.sin(this._warningTimer * this._config.hitFlash.warningPulseSpeed);
      if (warnSin > 0) {
        baseAlpha = Math.min(1.0, baseAlpha + warnSin * 0.35);
      }
    }

    const baseRadius = this._config.manaGlow.baseRadius * radiusScale * scaleX;

    for (const key of jointKeys) {
      const pt = joints[Number(key)];
      if (!pt) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, baseAlpha));
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = this._config.manaGlow.blur;
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, baseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 손(19, 20) 및 발(31, 32) 모션 트레일 잔상 드로잉
   */
  renderTrails(ctx: CanvasRenderingContext2D, scaleX = 1): void {
    ctx.save();

    for (const jointId of this._config.trail.trackedJoints) {
      const queue = this._trails.get(jointId);
      if (!queue || queue.length === 0) continue;

      const baseColor = this._config.trail.colors[jointId] ?? '#28E6FF';
      const speedMult = this.getTrailSpeedMultiplier(jointId);
      const count = queue.length;

      for (let i = 0; i < count; i++) {
        const pt = queue[i];
        const progress = (i + 1) / count;
        const alpha = Math.min(1.0, progress * 0.5 * speedMult);
        const radius = this._config.trail.baseRadius * (0.4 + 0.6 * progress) * scaleX;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
