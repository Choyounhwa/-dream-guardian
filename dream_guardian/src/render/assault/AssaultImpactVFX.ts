/**
 * AssaultImpactVFX.ts - 보스 접근전(Boss Assault) 정답 사방 폭죽·글자 팝핑 및 오답 디졸브 타격 이펙트 관리자
 *
 * [ASSAULT-FX-003] (Issue #692)
 * - 정답 (Correct):
 *   1) 화면 강한 흔들림: correctShake (강도 14, 지속시간 0.35s)
 *   2) 글자 팝핑: 타격된 정답 텍스트에 오버슈트 팝핑 애니메이션 (초기 Scale 1.35x -> 1.0x 안착)
 *   3) 정답 조각 사방 폭죽 효과: 5색 고속 파티클(시안, 노랑, 녹색, 주황, 백색) 사방 360도 방사형 분출 버스트
 * - 오답 (Wrong):
 *   1) 화면 약한 흔들림: wrongShake (강도 4, 지속시간 0.18s)
 *   2) 정답 조각 디졸브: 탄환 박스 조각이 깨지며 서서히 흩어지고 페이드아웃되는 디졸브(Dissolve) 연출
 *
 * 절대 규칙:
 * 1. 단일 파일 1,000줄 이하 엄격 준수.
 * 2. 순수 시각 효과 표현 단일 책임: 게임 진행 상태나 점수를 직접 계산하지 않음.
 */

import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../../config/assault-visual.config.js';
import { drawStardustIcon } from '../StardustIconRenderer.js';

export interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface DissolveShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface PoppingText {
  text: string;
  x: number;
  y: number;
  side?: 'left' | 'right';
  scale: number;
  alpha: number;
  elapsed: number;
  duration: number;
  color?: string;
  peakOffset?: number;
}

export interface TwinkleStarParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  minRadius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  alpha: number;
  lineWidth: number;
}

export interface FloatingBadge {
  x: number;
  y: number;
  baseY: number;
  offsetY: number;
  targetOffsetY: number;
  text: string;
  combo?: number;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface AssaultImpactVFXOptions {
  effectManager?: {
    triggerShake(intensity: number, duration: number): void;
  };
  visualConfig?: AssaultVisualConfig;
}

export interface TriggerImpactOptions {
  side?: 'left' | 'right';
  intensity?: number;
  duration?: number;
  color?: string;
  count?: number;
  combo?: number;
  badgeText?: string;
  balloonPulse?: boolean;
  peakScale?: number;
}

const FIREWORK_COLORS = ['#28E6FF', '#FFCB4D', '#00FF88', '#FF865E', '#FFFFFF'];
const SHARD_COLORS = ['#FF4D4D', '#FF865E', '#B91C1C', '#334155', '#1E293B', '#DC2626'];
const STAR_PALETTE = ['#FFD700', '#28E6FF', '#C889FF', '#FFFFFF'];

export class AssaultImpactVFX {
  private _effectManager?: { triggerShake(intensity: number, duration: number): void };
  private readonly _visualConfig: AssaultVisualConfig;

  private readonly _particles: BurstParticle[] = [];
  private readonly _shards: DissolveShard[] = [];
  private readonly _poppingTexts: PoppingText[] = [];
  private readonly _starParticles: TwinkleStarParticle[] = [];
  private readonly _shockwaves: ShockwaveRing[] = [];
  private readonly _floatingBadges: FloatingBadge[] = [];

  constructor(options?: AssaultImpactVFXOptions) {
    this._effectManager = options?.effectManager;
    this._visualConfig = options?.visualConfig ?? DEFAULT_ASSAULT_VISUAL_CONFIG;
  }

  public setEffectManager(effectManager?: { triggerShake(intensity: number, duration: number): void }): void {
    this._effectManager = effectManager;
  }

  public get effectManager(): { triggerShake(intensity: number, duration: number): void } | undefined {
    return this._effectManager;
  }

  public get particles(): readonly BurstParticle[] {
    return this._particles;
  }

  public get shards(): readonly DissolveShard[] {
    return this._shards;
  }

  public get poppingTexts(): readonly PoppingText[] {
    return this._poppingTexts;
  }

  public get starParticles(): readonly TwinkleStarParticle[] {
    return this._starParticles;
  }

  public get shockwaves(): readonly ShockwaveRing[] {
    return this._shockwaves;
  }

  public get floatingBadges(): readonly FloatingBadge[] {
    return this._floatingBadges;
  }

  public get activeCount(): number {
    return (
      this._particles.length +
      this._shards.length +
      this._poppingTexts.length +
      this._starParticles.length +
      this._shockwaves.length +
      this._floatingBadges.length
    );
  }

  public clear(): void {
    this._particles.length = 0;
    this._shards.length = 0;
    this._poppingTexts.length = 0;
    this._starParticles.length = 0;
    this._shockwaves.length = 0;
    this._floatingBadges.length = 0;
  }

  /**
   * 정답 사방 폭죽·글자 팝핑 및 강한 화면 흔들림 트리거
   */
  public triggerCorrect(x: number, y: number, text?: string, options?: TriggerImpactOptions): void {
    // 1. 화면 강한 흔들림 (correctShake: 강도 14, 지속시간 0.35s)
    const intensity = options?.intensity ?? this._visualConfig.correctShake?.intensity ?? 14;
    const duration = options?.duration ?? this._visualConfig.correctShake?.duration ?? 0.35;
    this._effectManager?.triggerShake(intensity, duration);

    // 2. 5색 파티클 360도 전방향 방사형 고속 폭죽 버스트
    const particleCount = options?.count ?? 32;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = 180 + Math.random() * 260;
      const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
      const maxLife = 0.45 + Math.random() * 0.3;

      this._particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: 3 + Math.random() * 3,
        life: maxLife,
        maxLife,
        alpha: 1.0,
      });
    }

    // 3. 텍스트 팝핑 (풍선 팝핑 스케일 펄스: 1.48x 급팽창 -> 1.0x 안착 오버슈트 애니메이션)
    const peakScale = options?.balloonPulse ? (options?.peakScale ?? 1.48) : 1.35;
    if (text !== undefined && text !== '') {
      this._poppingTexts.push({
        text,
        x,
        y,
        side: options?.side,
        scale: peakScale,
        alpha: 1.0,
        elapsed: 0,
        duration: 0.45,
        color: options?.color ?? '#00FF88',
        peakOffset: peakScale - 1.0,
      });
    }

    const punchCfg = this._visualConfig.punchImpact;

    // 4. [ASSAULT-FX-005] 4각 회전 반짝임(Twinkle) 별가루 파티클 방출 (골드/시안/보라/화이트)
    const starCount = punchCfg?.starCount ?? 16;
    const starPalette = punchCfg?.starColors ?? STAR_PALETTE;
    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount + (Math.random() - 0.5) * 0.35;
      const speed = 120 + Math.random() * 220;
      const color = starPalette[i % starPalette.length];
      const maxLife = 0.45 + Math.random() * 0.3;
      this._starParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 14 + Math.random() * 12,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12,
        life: maxLife,
        maxLife,
        alpha: 1.0,
      });
    }

    // 5. [ASSAULT-FX-005] 동심원 충격파 펄스 링 (Shockwave Ring, 20px -> 90px)
    const minRadius = punchCfg?.shockwaveMinRadius ?? 20;
    const maxRadius = punchCfg?.shockwaveMaxRadius ?? 90;
    const ringDuration = punchCfg?.shockwaveDuration ?? 0.4;
    const ringColor = punchCfg?.shockwaveColor ?? '#FFD700';
    this._shockwaves.push({
      x,
      y,
      radius: minRadius,
      minRadius,
      maxRadius,
      color: ringColor,
      life: ringDuration,
      maxLife: ringDuration,
      alpha: 1.0,
      lineWidth: 3.5,
    });

    // 6. [ASSAULT-FX-005] PERFECT 골드 배지 및 콤보 카운트 부유 (floatY: -40px)
    const badgeText = options?.badgeText ?? 'PERFECT';
    const floatDistance = punchCfg?.badgeFloatY !== undefined ? Math.abs(punchCfg.badgeFloatY) : 40;
    const badgeDuration = punchCfg?.badgeDuration ?? 0.6;
    const badgeColor = punchCfg?.badgeColor ?? '#FFD700';
    this._floatingBadges.push({
      x,
      y,
      baseY: y,
      offsetY: 0,
      targetOffsetY: -floatDistance,
      text: badgeText,
      combo: options?.combo,
      color: badgeColor,
      scale: 1.25,
      life: badgeDuration,
      maxLife: badgeDuration,
      alpha: 1.0,
    });
  }

  /**
   * 오답 디졸브 조각 분출 및 약한 화면 흔들림 트리거
   */
  public triggerWrong(x: number, y: number, _text?: string, options?: TriggerImpactOptions): void {
    // 1. 화면 약한 흔들림 (wrongShake: 강도 4, 지속시간 0.18s)
    const intensity = options?.intensity ?? this._visualConfig.wrongShake?.intensity ?? 4;
    const duration = options?.duration ?? this._visualConfig.wrongShake?.duration ?? 0.18;
    this._effectManager?.triggerShake(intensity, duration);

    // 2. 탄환 박스 조각 디졸브 파티클 (사각 파편 산란 및 중력/회전/페이드아웃)
    const shardCount = options?.count ?? 18;
    for (let i = 0; i < shardCount; i++) {
      const offsetX = (Math.random() - 0.5) * 70;
      const offsetY = (Math.random() - 0.5) * 40;
      const vx = (Math.random() - 0.5) * 320;
      const vy = -120 - Math.random() * 160;
      const color = SHARD_COLORS[i % SHARD_COLORS.length];
      const maxLife = 0.55 + Math.random() * 0.3;

      this._shards.push({
        x: x + offsetX,
        y: y + offsetY,
        vx,
        vy,
        width: 6 + Math.random() * 8,
        height: 6 + Math.random() * 8,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12,
        life: maxLife,
        maxLife,
        alpha: 1.0,
      });
    }

    // 3. 오답 타격 텍스트/UI 스케일 펄스 (1.28x 찌그러짐/진동 탄성 연출)
    const wrongPeak = options?.balloonPulse ? (options?.peakScale ?? 1.28) : 1.20;
    this._poppingTexts.push({
      text: _text ?? '',
      x,
      y,
      side: options?.side,
      scale: wrongPeak,
      alpha: 1.0,
      elapsed: 0,
      duration: 0.35,
      color: options?.color ?? '#FF4444',
      peakOffset: wrongPeak - 1.0,
    });
  }

  /**
   * 지정된 사이드(또는 전체 최신)의 활성 팝핑 스케일 조회
   */
  public getPoppingScale(side?: 'left' | 'right'): number {
    if (side) {
      const match = this._poppingTexts.find((p) => p.side === side);
      if (match) return match.scale;
    }
    if (this._poppingTexts.length > 0) {
      return this._poppingTexts[this._poppingTexts.length - 1].scale;
    }
    return 1.0;
  }

  /**
   * 프레임 단위 물리 및 애니메이션 갱신
   */
  public update(dt: number): void {
    if (dt <= 0) return;

    // 1. 폭죽 파티클 갱신
    const dragP = Math.pow(0.93, dt * 60);
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this._particles.splice(i, 1);
        continue;
      }
      p.vx *= dragP;
      p.vy *= dragP;
      p.vy += 150 * dt; // 미세 중력
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    // 2. 디졸브 조각 갱신
    const dragS = Math.pow(0.96, dt * 60);
    for (let i = this._shards.length - 1; i >= 0; i--) {
      const s = this._shards[i];
      s.life -= dt;
      if (s.life <= 0) {
        this._shards.splice(i, 1);
        continue;
      }
      s.vx *= dragS;
      s.vy += 550 * dt; // 중력 가속도
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rotation += s.rotationSpeed * dt;
      s.alpha = Math.max(0, s.life / s.maxLife);
    }

    // 3. 텍스트 팝핑 오버슈트 갱신
    for (let i = this._poppingTexts.length - 1; i >= 0; i--) {
      const pop = this._poppingTexts[i];
      pop.elapsed += dt;
      if (pop.elapsed >= pop.duration) {
        this._poppingTexts.splice(i, 1);
        continue;
      }

      const t = Math.min(1, pop.elapsed / pop.duration);
      // 풍선 팝핑 탄성 스프링 곡선 (급팽창 후 탄성 튕김 안착)
      const peak = pop.peakOffset ?? 0.35;
      const overshoot = peak * Math.cos(t * Math.PI * 2.5) * Math.exp(-4 * t);
      pop.scale = Math.max(0.9, 1.0 + overshoot);

      if (t > 0.7) {
        pop.alpha = Math.max(0, 1 - (t - 0.7) / 0.3);
      } else {
        pop.alpha = 1.0;
      }
    }

    // 4. [ASSAULT-FX-005] 별가루 파티클 갱신 (회전, 미세 감속, 알파 감쇠)
    const dragStar = Math.pow(0.95, dt * 60);
    for (let i = this._starParticles.length - 1; i >= 0; i--) {
      const s = this._starParticles[i];
      s.life -= dt;
      if (s.life <= 0) {
        this._starParticles.splice(i, 1);
        continue;
      }
      s.vx *= dragStar;
      s.vy *= dragStar;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rotation += s.rotationSpeed * dt;
      s.alpha = Math.max(0, s.life / s.maxLife);
    }

    // 5. [ASSAULT-FX-005] 동심원 충격파 링 갱신 (20px -> 90px 확장 및 페이드아웃)
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      const ring = this._shockwaves[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        this._shockwaves.splice(i, 1);
        continue;
      }
      const progress = Math.min(1, 1 - ring.life / ring.maxLife);
      const ease = 1 - Math.pow(1 - progress, 2);
      ring.radius = ring.minRadius + (ring.maxRadius - ring.minRadius) * ease;
      ring.alpha = Math.max(0, ring.life / ring.maxLife);
      ring.lineWidth = Math.max(1, 3.5 * (1 - progress * 0.7));
    }

    // 6. [ASSAULT-FX-005] PERFECT 부유 배지 갱신 (위로 -40px 부유, 스케일 안착, 알파 페이드아웃)
    for (let i = this._floatingBadges.length - 1; i >= 0; i--) {
      const badge = this._floatingBadges[i];
      badge.life -= dt;
      if (badge.life <= 0) {
        this._floatingBadges.splice(i, 1);
        continue;
      }
      const progress = Math.min(1, 1 - badge.life / badge.maxLife);
      const ease = 1 - Math.pow(1 - progress, 2);
      badge.offsetY = badge.targetOffsetY * ease;
      badge.scale = progress < 0.2 ? 1.0 + (progress / 0.2) * 0.25 : Math.max(1.0, 1.25 - (progress - 0.2) * 0.35);
      badge.alpha = progress > 0.65 ? Math.max(0, (1 - progress) / 0.35) : 1.0;
    }
  }

  /**
   * 캔버스에 파티클, 디졸브 조각, 팝핑 텍스트 및 별모으기 융합 시각효과 렌더링
   */
  public render(ctx: CanvasRenderingContext2D, _vw?: number, _vh?: number): void {
    if (!ctx) return;

    // 0. 동심원 충격파 펄스 링 렌더링
    for (const ring of this._shockwaves) {
      if (ring.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = ring.alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.lineWidth;
      if (ctx.shadowColor !== undefined) {
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      if (typeof ctx.stroke === 'function') {
        ctx.stroke();
      }
      ctx.restore();
    }

    // 1. 폭죽 파티클 렌더링
    for (const p of this._particles) {
      if (p.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const currentRadius = Math.max(1, p.radius * (0.3 + 0.7 * (p.life / p.maxLife)));
      ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 1-b. 4각 회전 반짝임(Twinkle) 별가루 파티클 렌더링
    for (const star of this._starParticles) {
      if (star.alpha <= 0) continue;
      if (typeof ctx.moveTo === 'function') {
        drawStardustIcon(ctx, star.x, star.y, star.size, {
          points: 4,
          color: star.color,
          glowColor: star.color,
          glowBlur: 6,
          rotation: star.rotation,
          alpha: star.alpha,
        });
      } else {
        ctx.save();
        ctx.globalAlpha = star.alpha;
        ctx.translate(star.x, star.y);
        ctx.rotate(star.rotation);
        ctx.fillStyle = star.color;
        ctx.fillRect(-star.size / 2, -star.size / 2, star.size, star.size);
        ctx.restore();
      }
    }

    // 2. 디졸브 사각 조각 렌더링
    for (const s of this._shards) {
      if (s.alpha <= 0) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.restore();
    }

    // 3. 글자 팝핑 렌더링
    for (const pop of this._poppingTexts) {
      if (pop.alpha <= 0) continue;
      ctx.save();
      ctx.translate(pop.x, pop.y);
      ctx.scale(pop.scale, pop.scale);
      ctx.globalAlpha = pop.alpha;
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = pop.color ?? '#00FF88';
      ctx.shadowColor = pop.color ?? '#00FF88';
      ctx.shadowBlur = 16;
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }

    // 4. PERFECT 골드 배지 및 콤보 렌더링
    for (const badge of this._floatingBadges) {
      if (badge.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = badge.alpha;
      ctx.translate(badge.x, badge.baseY + badge.offsetY);
      ctx.scale(badge.scale, badge.scale);
      ctx.font = 'bold 50px NanumSquareRound, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = badge.color;
      if (ctx.shadowColor !== undefined) {
        ctx.shadowColor = badge.color;
        ctx.shadowBlur = 12;
      }
      const displayText = badge.combo && badge.combo > 1 ? `${badge.text} +${badge.combo}` : badge.text;
      ctx.fillText(displayText, 0, 0);
      ctx.restore();
    }
  }
}
