/**
 * DreamGrid - 3D 원근 와이어프레임 드림 그리드 렌더러
 *
 * Issue #27 & 피드백 반영:
 * - 보스 위치를 단일 소실점(Vanishing Point)으로 설정
 * - 3D 투영 공식 기반 가로/세로 그리드 정방형(Square Cell) 비율 계산
 * - 소실점 심도 안개(Depth Fog Fadeout): 화면 중앙부 이후 소실점으로 갈수록 자연스럽게 페이드아웃
 * - 기본 투명도 30%(0.30) 상향으로 네온 와이어프레임 시인성 대폭 개선
 * - 바닥 및 천장 원근 와이어프레임과 중앙 심도 암흑 공간 연출
 */

import { DEFAULT_FITNESS_ZONES, FitnessZone } from '../../config/zone.config.js';
import {
  Z_NEAR,
  DELTA_Z,
  LINE_COUNT_Z,
  FADE_DEPTH,
  HORIZON_RATIO,
  FOG_START,
  FOG_RANGE,
  CEILING_DELTA_Z,
  CEILING_LINE_COUNT_Z,
} from '../../config/grid.config.js';
import { projectDepthY, depthRatioFromY } from './GridProjection.js';

export interface DreamGridConfig {
  vanishingX?: number; // 기본값: w * 0.5
  vanishingY?: number; // 기본값: h * HORIZON_RATIO (0.24, 보스 위치)
  color?: string;
  speed?: number;
  cellAspect?: number;
  hasCeiling?: boolean;
  alpha?: number;
  renderZoneConnections?: boolean; // 피트니스 존 연결선 렌더링 여부 (기본값: true)
  zoneConnectionAlpha?: number; // 연결선 투명도 (기본값: 0.18)
  zones?: readonly FitnessZone[]; // 대상 피트니스 존 목록 (기본값: DEFAULT_FITNESS_ZONES)
}

function toRgba(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith('#')) {
    let c = color.slice(1);
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${a})`);
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/[\d.]+\)$/, `${a})`);
  }
  return color;
}

export class DreamGrid {
  private _offset = 0;
  private _speed = 1.2;
  private _color = '#28E6FF';
  private _alpha = 0.30; // 30% 투명도 기본값
  private _hasCeiling = true;

  constructor(config?: DreamGridConfig) {
    if (config?.color) this._color = config.color;
    if (config?.speed !== undefined) this._speed = config.speed;
    if (config?.alpha !== undefined) this._alpha = config.alpha;
    if (config?.hasCeiling !== undefined) this._hasCeiling = config.hasCeiling;
  }

  get offset(): number {
    return this._offset;
  }

  get alpha(): number {
    return this._alpha;
  }

  setColor(color: string): void {
    this._color = color;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }

  setAlpha(alpha: number): void {
    this._alpha = alpha;
  }

  /**
   * 매 프레임 스크롤 오프셋 갱신
   * @param dt 델타 타임
   * @param speedMultiplier 달리기 속도 배율
   */
  update(dt: number, speedMultiplier = 1.0): void {
    const delta = dt * this._speed * speedMultiplier;
    this._offset = (this._offset + delta) % 1.0;
  }

  /**
   * 3D 원근 그리드 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, config?: DreamGridConfig): void {
    const vx = config?.vanishingX ?? w * 0.5;
    const vy = config?.vanishingY ?? h * HORIZON_RATIO;
    const color = config?.color ?? this._color;
    const baseAlpha = config?.alpha ?? this._alpha;
    const hasCeiling = config?.hasCeiling ?? this._hasCeiling;

    ctx.save();

    // 1. 소실점 중심의 부드러운 대기 심도 암흑 구역 (보스 실루엣 강조)
    const voidRadius = Math.min(w, h) * 0.42;
    const voidGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, voidRadius);
    voidGrad.addColorStop(0, 'rgba(5, 5, 18, 0.98)');
    voidGrad.addColorStop(0.35, 'rgba(6, 6, 22, 0.82)');
    voidGrad.addColorStop(0.7, 'rgba(8, 8, 25, 0.35)');
    voidGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(vx, vy, voidRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 바닥 원근 그리드 렌더링 (자연스러운 심도 페이드아웃 적용)
    this._renderFloorGrid(ctx, w, h, vx, vy, color, baseAlpha);

    // 2.5 피트니스 존 연한 연결선 렌더링 (Issue #188: RENDER-TRACK-001)
    const renderZoneConnections = config?.renderZoneConnections ?? true;
    if (renderZoneConnections) {
      const zoneAlpha = config?.zoneConnectionAlpha ?? 0.18;
      const targetZones = config?.zones ?? DEFAULT_FITNESS_ZONES;
      this._renderZoneConnections(ctx, w, h, vx, vy, color, zoneAlpha, targetZones);
    }

    // 3. 천장 원근 그리드 렌더링 (옵션)
    if (hasCeiling) {
      this._renderCeilingGrid(ctx, w, vx, vy, color, baseAlpha * 0.7);
    }

    ctx.restore();
  }

  /**
   * 바닥 3D 원근 그리드
   * - 소실점에 가까운 상중단 영역(depthRatio < 0.16)은 심도 안개로 자연스럽게 소멸
   * - 화면 하단으로 올수록 선명도(선 두께 및 30% 투명도) 증가
   */
  private _renderFloorGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    vx: number,
    vy: number,
    color: string,
    baseAlpha: number,
  ): void {
    const floorH = h - vy;
    if (floorH <= 0) return;

    // 가로선 깊이 및 Y 좌표 계산
    const hLinesY: number[] = [];
    for (let k = 0; k < LINE_COUNT_Z; k++) {
      const z = Z_NEAR + (k - this._offset) * DELTA_Z;
      if (z <= 0.1) continue;
      const y = projectDepthY(z, vy, floorH, Z_NEAR);
      if (y >= vy && y <= h + 10) {
        hLinesY.push(y);
      }
    }

    // 전경(화면 하단)에서의 정방형 셀 폭 계산
    const stepXBottom = Math.max(32, floorH * (DELTA_Z / (Z_NEAR + DELTA_Z)) * 1.8);
    const colCount = Math.ceil((w * 0.5) / stepXBottom) + 2;

    // ── 가로(Horizontal) 라인 드로잉 (심도 소프트 페이드) ──
    for (let i = 0; i < hLinesY.length; i++) {
      const y = hLinesY[i];
      const depthRatio = depthRatioFromY(y, vy, floorH); // 0 (소실점) ~ 1 (하단)

      // 소실점 부근 영역은 완전히 안개에 묻히고, FOG_START ~ (FOG_START + FOG_RANGE) 구간에서 부드럽게 페이드인
      if (depthRatio < FOG_START) continue;
      const fogFactor = Math.min(1, (depthRatio - FOG_START) / FOG_RANGE);
      const lineAlpha = baseAlpha * Math.pow(fogFactor, 1.25);
      if (lineAlpha < 0.005) continue;

      const halfW = (w * 0.5 + 50) * depthRatio;

      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = Math.max(1.2, depthRatio * 2.8);

      ctx.beginPath();
      ctx.moveTo(vx - halfW, y);
      ctx.lineTo(vx + halfW, y);
      ctx.stroke();
    }

    // ── 세로(Vertical) 원근 방사선 드로잉 ──
    // 소실점 (vx, vy)에 뭉치지 않도록 Y축 선형 그라데이션 및 시작 오프셋 적용
    const vertGrad = ctx.createLinearGradient(0, h, 0, vy);
    vertGrad.addColorStop(0, toRgba(color, baseAlpha));
    vertGrad.addColorStop(0.45, toRgba(color, baseAlpha * 0.85));
    vertGrad.addColorStop(0.72, toRgba(color, baseAlpha * 0.25));
    vertGrad.addColorStop(0.86, toRgba(color, 0));
    vertGrad.addColorStop(1, toRgba(color, 0));

    ctx.strokeStyle = vertGrad;
    ctx.globalAlpha = 1;

    // 소실점 중심에서 FADE_DEPTH 떨어진 지점부터 하단으로 뻗어나감 (날카로운 꼭짓점 형성 방지)
    const yStart = vy + floorH * FADE_DEPTH;

    for (let j = -colCount; j <= colCount; j++) {
      const xBottom = vx + j * stepXBottom;
      const xStart = vx + (xBottom - vx) * FADE_DEPTH;

      ctx.lineWidth = j === 0 ? 2.8 : 1.5;

      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xBottom, h);
      ctx.stroke();
    }
  }

  /**
   * 천장 3D 원근 그리드 (심도 소프트 페이드)
   */
  private _renderCeilingGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    vx: number,
    vy: number,
    color: string,
    baseAlpha: number,
  ): void {
    const ceilH = vy;
    if (ceilH <= 0) return;

    const hLinesY: number[] = [];
    for (let k = 0; k < CEILING_LINE_COUNT_Z; k++) {
      const z = Z_NEAR + (k - this._offset) * CEILING_DELTA_Z;
      if (z <= 0.1) continue;
      // 천장은 vy 위쪽이므로 -ceilH를 높이로 투영
      const y = projectDepthY(z, vy, -ceilH, Z_NEAR);
      if (y >= -10 && y <= vy) {
        hLinesY.push(y);
      }
    }

    const stepXTop = Math.max(40, ceilH * (CEILING_DELTA_Z / (Z_NEAR + CEILING_DELTA_Z)) * 2.2);
    const colCount = Math.ceil((w * 0.5) / stepXTop) + 1;

    for (let i = 0; i < hLinesY.length; i++) {
      const y = hLinesY[i];
      const depthRatio = (vy - y) / ceilH;

      if (depthRatio < FOG_START) continue;
      const fogFactor = Math.min(1, (depthRatio - FOG_START) / FOG_RANGE);
      const lineAlpha = baseAlpha * Math.pow(fogFactor, 1.25);
      if (lineAlpha < 0.005) continue;

      const halfW = (w * 0.5 + 30) * depthRatio;

      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = Math.max(1, depthRatio * 2.0);

      ctx.beginPath();
      ctx.moveTo(vx - halfW, y);
      ctx.lineTo(vx + halfW, y);
      ctx.stroke();
    }

    const ceilGrad = ctx.createLinearGradient(0, 0, 0, vy);
    ceilGrad.addColorStop(0, toRgba(color, baseAlpha));
    ceilGrad.addColorStop(0.45, toRgba(color, baseAlpha * 0.8));
    ceilGrad.addColorStop(0.72, toRgba(color, baseAlpha * 0.2));
    ceilGrad.addColorStop(0.86, toRgba(color, 0));
    ceilGrad.addColorStop(1, toRgba(color, 0));

    ctx.strokeStyle = ceilGrad;
    ctx.globalAlpha = 1;

    const yStart = vy - ceilH * FADE_DEPTH;

    for (let j = -colCount; j <= colCount; j++) {
      const xTop = vx + j * stepXTop;
      const xStart = vx + (xTop - vx) * FADE_DEPTH;

      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xTop, 0);
      ctx.stroke();
    }
  }

  /**
   * 피트니스 존 연한 연결선 렌더링 (Issue #188: RENDER-TRACK-001)
   * - 소실점(vx, vy)에서 각 피트니스 존 중심(cx, cy)으로 이어지는 은은한 네온 가이드 선
   * - 소실점 부근은 0에서 점진적으로 페이드인되는 선형 그라데이션 적용
   */
  private _renderZoneConnections(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    vx: number,
    vy: number,
    color: string,
    zoneAlpha: number,
    zones: readonly FitnessZone[],
  ): void {
    if (zones.length === 0 || zoneAlpha <= 0) return;

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const cx = (zone.x + zone.width * 0.5) * w;
      const cy = (zone.y + zone.height * 0.5) * h;

      // 1. 소실점 -> 피트니스 존 중심 원근 연결선
      const grad = ctx.createLinearGradient(vx, vy, cx, cy);
      grad.addColorStop(0, toRgba(color, 0));
      grad.addColorStop(0.25, toRgba(color, zoneAlpha * 0.35));
      grad.addColorStop(0.75, toRgba(color, zoneAlpha * 0.85));
      grad.addColorStop(1, toRgba(color, zoneAlpha));

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      // 2. 피트니스 존 중심 앵커 링 (은은한 3px 원형 마커)
      ctx.strokeStyle = toRgba(color, zoneAlpha * 0.9);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
