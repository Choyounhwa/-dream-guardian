/**
 * StarNoteRenderer - 그리드 레일 궤적 기반 별가루 악기 노트 렌더러
 *
 * Issue #192 (RENDER-KEYNOTE-001):
 * - 그리드의 11개 피트니스 존 연결선을 레일 삼아 소실점(보스 위치)에서 목표 피트니스 존 중심으로 비행하는 별가루 악기 노트 렌더링
 * - StarCollectionInput의 현재 타겟(target)과 착지 시각(landingTime)에 맞춰 1박(0.5초) 동안 원근 비행(scale 0.3 → 1.2)
 * - 신체 부위별 4색 글로우(왼손: #28E6FF, 오른손: #FFCB4D, 머리: #C889FF, 골반: #FF865E)
 * - 안착 직전(±0.12s Perfect 판정 윈도우) 목표 존 테두리 펄스 링 표출
 */

import type { ActiveStarTarget } from '../input/StarCollectionInput.js';
import type { StarTarget } from '../types/star.js';
import { DEFAULT_FITNESS_ZONES, type FitnessZone } from '../../config/zone.config.js';
import { projectAlongRail } from './GridProjection.js';

export interface StarNoteRenderOptions {
  /** 노트 비행 소요 시간 (초, 기본값 0.5s = 1박) */
  travelDuration?: number;
  /** 소실점 시작 최소 크기 배율 (기본값 0.3) */
  minScale?: number;
  /** 존 안착 종료 최대 크기 배율 (기본값 1.2) */
  maxScale?: number;
  /** 기준 반지름 (px, 기본값 28) */
  baseRadius?: number;
  /** Perfect 판정 허용 시간 (초, 기본값 0.12s) */
  perfectWindow?: number;
  /** Late 판정 종료 허용 시간 (초, 기본값 0.25s) */
  lateWindow?: number;
}

export interface StarNotePositionResult {
  x: number;
  y: number;
  scale: number;
  progress: number;
  inFlight: boolean;
}

export interface StarNoteRenderState {
  target?: (ActiveStarTarget | StarTarget) | null;
  targets?: readonly (ActiveStarTarget | StarTarget)[];
  elapsedTime: number;
  vanishingX: number;
  vanishingY: number;
  zones?: readonly FitnessZone[];
}

const PART_COLORS: Record<string, string> = {
  leftHand: '#28E6FF',
  rightHand: '#FFCB4D',
  head: '#C889FF',
  shoulder: '#C889FF',
  hip: '#FF865E',
};

export class StarNoteRenderer {
  private readonly _options: Required<StarNoteRenderOptions>;

  constructor(options?: StarNoteRenderOptions) {
    this._options = {
      travelDuration: options?.travelDuration ?? 0.5,
      minScale: options?.minScale ?? 0.3,
      maxScale: options?.maxScale ?? 1.2,
      baseRadius: options?.baseRadius ?? 28,
      perfectWindow: options?.perfectWindow ?? 0.12,
      lateWindow: options?.lateWindow ?? 0.25,
    };
  }

  /**
   * 실시간 노트 좌표 및 비행 상태 계산
   */
  computeNotePosition(
    target: StarTarget & { landingTime?: number },
    elapsedTime: number,
    vx: number,
    vy: number,
    vw: number,
    vh: number,
    zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES,
  ): StarNotePositionResult {
    const landingTime = target.landingTime ?? 0;
    const timeRemaining = landingTime - elapsedTime;
    const travelDuration = this._options.travelDuration;

    // 비행 진행도: 0.0(소실점 출발) ~ 1.0(목표 존 착지)
    const progress = 1.0 - timeRemaining / travelDuration;

    // 출현 이전(progress < 0) 또는 판정 만료 이후(lateWindow 초과) 상태 판정
    if (progress < 0 || elapsedTime > landingTime + this._options.lateWindow) {
      return {
        x: vx,
        y: vy,
        scale: this._options.minScale,
        progress,
        inFlight: false,
      };
    }

    const zone = zones.find((z) => z.id === target.zoneId);
    const targetX = zone ? (zone.x + zone.width * 0.5) * vw : vx;
    const targetY = zone ? (zone.y + zone.height * 0.5) * vh : vy;

    const proj = projectAlongRail(
      vx,
      vy,
      targetX,
      targetY,
      progress,
      this._options.minScale,
      this._options.maxScale,
    );

    return {
      x: proj.x,
      y: proj.y,
      scale: proj.scale,
      progress,
      inFlight: true,
    };
  }

  /**
   * 별가루 악기 노트 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: StarNoteRenderState,
  ): void {
    const rawTargets = state.targets ?? (state.target ? [state.target] : []);
    const targets = rawTargets.filter((t): t is ActiveStarTarget | StarTarget => Boolean(t && t.landingTime !== undefined));
    if (targets.length === 0) return;

    const zones = state.zones ?? DEFAULT_FITNESS_ZONES;

    for (const target of targets) {
      this._renderSingleTarget(
        ctx,
        vw,
        vh,
        target,
        state.elapsedTime,
        state.vanishingX,
        state.vanishingY,
        zones,
      );
    }
  }

  private _renderSingleTarget(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    target: ActiveStarTarget | StarTarget,
    elapsedTime: number,
    vanishingX: number,
    vanishingY: number,
    zones: readonly FitnessZone[],
  ): void {
    const pos = this.computeNotePosition(
      target,
      elapsedTime,
      vanishingX,
      vanishingY,
      vw,
      vh,
      zones,
    );

    if (!pos.inFlight) return;

    const targetPart = target.part || 'leftHand';
    const color = PART_COLORS[targetPart] || '#28E6FF';
    const zone = zones.find((z) => z.id === target.zoneId);

    ctx.save();

    // 1. 안착 직전(±0.12s Perfect 판정 윈도우) 목표 존 테두리 펄스 링 연출
    const timeDiff = Math.abs(target.landingTime! - elapsedTime);
    if (timeDiff <= this._options.perfectWindow && zone) {
      this._renderZonePulse(ctx, vw, vh, zone, color, 1.0 - timeDiff / this._options.perfectWindow);
    }

    // 2. 비행 궤적 잔상 트레일 (소실점 방향 꼬리)
    this._renderTrail(ctx, vanishingX, vanishingY, pos.x, pos.y, color, pos.scale);

    // 3. 별가루 악기 노트 본체 (4색 테두리 + 글로우)
    const radius = this._options.baseRadius * pos.scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 18, 30, 0.9)';
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * pos.scale;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * pos.scale;
    ctx.stroke();

    // 4. 중앙 별/음표 아이콘
    ctx.font = `bold ${Math.round(26 * pos.scale)}px sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', pos.x, pos.y);

    ctx.restore();
    ctx.restore();
  }

  /**
   * 목표 존 착지 직전 펄스 링
   */
  private _renderZonePulse(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    zone: FitnessZone,
    color: string,
    intensity: number,
  ): void {
    const zx = zone.x * vw;
    const zy = zone.y * vh;
    const zw = zone.width * vw;
    const zh = zone.height * vh;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 + 3 * intensity;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * intensity;

    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(zx - 4, zy - 4, zw + 8, zh + 8, 12);
      ctx.stroke();
    } else {
      ctx.strokeRect(zx - 4, zy - 4, zw + 8, zh + 8);
    }

    ctx.restore();
  }

  /**
   * 소실점 방향으로 이어지는 별가루 잔상 궤적
   */
  private _renderTrail(
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    nx: number,
    ny: number,
    color: string,
    scale: number,
  ): void {
    ctx.save();
    const trailLen = 0.22; // 노트 위치 기준 뒤쪽 22% 지점까지 트레일
    const tailX = nx - (nx - vx) * trailLen;
    const tailY = ny - (ny - vy) * trailLen;

    const grad = ctx.createLinearGradient(tailX, tailY, nx, ny);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, color);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.restore();
  }
}
