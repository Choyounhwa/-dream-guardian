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
  LONGITUDINAL_COLOR,
  TRANSVERSE_COLOR,
  CENTER_SPINE_COLOR,
  CROSSING_NODE_COLOR,
  CROSSING_NODE_SECONDARY_COLOR,
  PANEL_DEPTH_START,
  PANEL_BG_COLOR,
  TRANSVERSE_MAX_WIDTH,
  TRANSVERSE_MIN_WIDTH,
  LONGITUDINAL_MAX_WIDTH,
  LONGITUDINAL_MIN_WIDTH,
  CENTER_SPINE_MAX_WIDTH,
  CENTER_SPINE_GLOW_WIDTH,
  CENTER_SPINE_CORE_WIDTH,
  LONGITUDINAL_GLOW_WIDTH_MULT,
  LONGITUDINAL_GLOW_ALPHA_MULT,
  BEAT_FLASH_MAX_ALPHA,
  BEAT_FLASH_WIDTH_BOOST,
  BEAT_FLASH_DECAY,
  TRANSVERSE_SPAN_MULTIPLIER,
} from '../../config/grid.config.js';
import { projectDepthY, depthRatioFromY } from './GridProjection.js';

export interface DreamGridConfig {
  vanishingX?: number; // 기본값: w * 0.5
  vanishingY?: number; // 기본값: h * HORIZON_RATIO (0.24, 보스 위치)
  color?: string; // 하위 호환성: 지정 시 기본/세로 컬러 오버라이드
  longitudinalColor?: string; // 세로 방향 네온 시안 (#28E6FF)
  transverseColor?: string; // 가로 비트 방향 네온 오렌지/앰버 (#FF8844)
  centerSpineColor?: string; // 중앙 척추선 청백색 코어 (#C8F5FF)
  crossingNodeColor?: string; // 교차점 노드 주 컬러 (#FFFFFF)
  crossingNodeSecondaryColor?: string; // 교차점 노드 보조 컬러 (#FFCB4D)
  panelDepthStart?: number; // 전경 패널 음영 시작 깊이 비율 (기본값: 0.50)
  panelBgColor?: string; // 전경 패널 베이스 (기본값: 'transparent', 지정 시 해당 색상으로 quad fill)
  speed?: number;
  cellAspect?: number;
  hasCeiling?: boolean;
  alpha?: number;
  renderZoneConnections?: boolean; // 피트니스 존 연결선 렌더링 여부 (기본값: true)
  zoneConnectionAlpha?: number; // 연결선 투명도 (기본값: 0.18)
  zones?: readonly FitnessZone[]; // 대상 피트니스 존 목록 (기본값: DEFAULT_FITNESS_ZONES)
  bgImage?: HTMLImageElement | null; // 챕터/메뉴 배경 이미지
  bgDimAlpha?: number; // 배경 이미지 디밍 오버레이 투명도 (기본값: 0.45)
  beatProgress?: number; // 0.0 ~ 1.0 (메트로놈 박자 진행도, 비트 시점 0.0)
  enableBeatFlash?: boolean; // 비트 플래시 활성화 여부 (기본값: true)
  transverseSpanMultiplier?: number; // 바닥 가로선 좌우 확장 배율 (기본값: TRANSVERSE_SPAN_MULTIPLIER, 1.8)
}

function isColorTransparent(color?: string | null): boolean {
  if (!color) return true;
  const trimmed = color.trim().toLowerCase();
  if (trimmed === 'transparent' || trimmed === 'none') return true;
  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/.test(trimmed)) return true;
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})00$/i.test(trimmed)) return true;
  return false;
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
  private _color = LONGITUDINAL_COLOR;
  private _longitudinalColor = LONGITUDINAL_COLOR;
  private _transverseColor = TRANSVERSE_COLOR;
  private _centerSpineColor = CENTER_SPINE_COLOR;
  private _crossingNodeColor = CROSSING_NODE_COLOR;
  private _crossingNodeSecondaryColor = CROSSING_NODE_SECONDARY_COLOR;
  private _panelDepthStart = PANEL_DEPTH_START;
  private _panelBgColor = PANEL_BG_COLOR;
  private _alpha = 0.30; // 30% 투명도 기본값
  private _hasCeiling = true;
  private _bgImage: HTMLImageElement | null = null;
  private _bgDimAlpha = 0.45; // 배경 이미지 디밍 오버레이 기본값 (45%)
  private _beatProgress?: number = undefined;
  private _enableBeatFlash = true;
  private _flashIntensity = 0;
  private _transverseSpanMultiplier = TRANSVERSE_SPAN_MULTIPLIER;

  constructor(config?: DreamGridConfig) {
    if (config?.color) {
      this._color = config.color;
      this._longitudinalColor = config.color;
    }
    if (config?.longitudinalColor !== undefined) {
      this._longitudinalColor = config.longitudinalColor;
      this._color = config.longitudinalColor;
    }
    if (config?.transverseColor !== undefined) this._transverseColor = config.transverseColor;
    if (config?.centerSpineColor !== undefined) this._centerSpineColor = config.centerSpineColor;
    if (config?.crossingNodeColor !== undefined) this._crossingNodeColor = config.crossingNodeColor;
    if (config?.crossingNodeSecondaryColor !== undefined) {
      this._crossingNodeSecondaryColor = config.crossingNodeSecondaryColor;
    }
    if (config?.panelDepthStart !== undefined) this._panelDepthStart = config.panelDepthStart;
    if (config?.panelBgColor !== undefined) this._panelBgColor = config.panelBgColor;
    if (config?.speed !== undefined) this._speed = config.speed;
    if (config?.alpha !== undefined) this._alpha = config.alpha;
    if (config?.hasCeiling !== undefined) this._hasCeiling = config.hasCeiling;
    if (config?.bgImage !== undefined) this._bgImage = config.bgImage;
    if (config?.bgDimAlpha !== undefined) this._bgDimAlpha = config.bgDimAlpha;
    if (config?.beatProgress !== undefined) this._beatProgress = config.beatProgress;
    if (config?.enableBeatFlash !== undefined) this._enableBeatFlash = config.enableBeatFlash;
    if (config?.transverseSpanMultiplier !== undefined) {
      this._transverseSpanMultiplier = config.transverseSpanMultiplier;
    }
  }

  get offset(): number {
    return this._offset;
  }

  get alpha(): number {
    return this._alpha;
  }

  get color(): string {
    return this._color;
  }

  get longitudinalColor(): string {
    return this._longitudinalColor;
  }

  get transverseColor(): string {
    return this._transverseColor;
  }

  get centerSpineColor(): string {
    return this._centerSpineColor;
  }

  get crossingNodeColor(): string {
    return this._crossingNodeColor;
  }

  get crossingNodeSecondaryColor(): string {
    return this._crossingNodeSecondaryColor;
  }

  get panelDepthStart(): number {
    return this._panelDepthStart;
  }

  get panelBgColor(): string {
    return this._panelBgColor;
  }

  get bgImage(): HTMLImageElement | null {
    return this._bgImage;
  }

  get bgDimAlpha(): number {
    return this._bgDimAlpha;
  }

  setColor(color: string): void {
    this._color = color;
    this._longitudinalColor = color;
  }

  setLongitudinalColor(color: string): void {
    this._longitudinalColor = color;
    this._color = color;
  }

  setTransverseColor(color: string): void {
    this._transverseColor = color;
  }

  setCenterSpineColor(color: string): void {
    this._centerSpineColor = color;
  }

  setCrossingNodeColor(color: string): void {
    this._crossingNodeColor = color;
  }

  setCrossingNodeSecondaryColor(color: string): void {
    this._crossingNodeSecondaryColor = color;
  }

  setPanelDepthStart(depth: number): void {
    this._panelDepthStart = depth;
  }

  setPanelBgColor(color: string): void {
    this._panelBgColor = color;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }

  setAlpha(alpha: number): void {
    this._alpha = alpha;
  }

  setBgImage(img: HTMLImageElement | null): void {
    this._bgImage = img;
  }

  setBgDimAlpha(alpha: number): void {
    this._bgDimAlpha = alpha;
  }

  get beatProgress(): number | undefined {
    return this._beatProgress;
  }

  setBeatProgress(progress: number | undefined): void {
    this._beatProgress = progress !== undefined ? Math.max(0, Math.min(1, progress)) : undefined;
  }

  get enableBeatFlash(): boolean {
    return this._enableBeatFlash;
  }

  setEnableBeatFlash(enable: boolean): void {
    this._enableBeatFlash = enable;
  }

  get flashIntensity(): number {
    return this._flashIntensity;
  }

  triggerBeatFlash(intensity = 1.0): void {
    this._flashIntensity = Math.max(this._flashIntensity, Math.max(0, Math.min(1, intensity)));
  }

  get transverseSpanMultiplier(): number {
    return this._transverseSpanMultiplier;
  }

  setTransverseSpanMultiplier(val: number): void {
    this._transverseSpanMultiplier = val;
  }

  /**
   * 매 프레임 스크롤 오프셋 갱신 및 비트 플래시 수동 감쇄
   * @param dt 델타 타임
   * @param speedMultiplier 달리기 속도 배율
   */
  update(dt: number, speedMultiplier = 1.0): void {
    const delta = dt * this._speed * speedMultiplier;
    this._offset = (this._offset + delta) % 1.0;
    if (this._flashIntensity > 0) {
      this._flashIntensity = Math.max(0, this._flashIntensity - dt * 4.0);
    }
  }

  /**
   * 3D 원근 그리드 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, config?: DreamGridConfig): void {
    const vx = config?.vanishingX ?? w * 0.5;
    const vy = config?.vanishingY ?? h * HORIZON_RATIO;
    const longColor = config?.longitudinalColor ?? config?.color ?? this._longitudinalColor;
    const transColor = config?.transverseColor ?? this._transverseColor;
    const spineColor = config?.centerSpineColor ?? this._centerSpineColor;
    const nodeColor = config?.crossingNodeColor ?? this._crossingNodeColor;
    const nodeSecColor = config?.crossingNodeSecondaryColor ?? this._crossingNodeSecondaryColor;
    const panelDepthStart = config?.panelDepthStart ?? this._panelDepthStart;
    const panelBgColor = config?.panelBgColor ?? this._panelBgColor;
    const baseAlpha = config?.alpha ?? this._alpha;
    const hasCeiling = config?.hasCeiling ?? this._hasCeiling;
    const beatProg = config?.beatProgress !== undefined ? config.beatProgress : this._beatProgress;
    const enableFlash = config?.enableBeatFlash ?? this._enableBeatFlash;
    const spanMult = config?.transverseSpanMultiplier ?? this._transverseSpanMultiplier;

    // Issue #295: 메트로놈 비트 플래시 계수 계산
    let flashFactor = 0;
    if (enableFlash) {
      if (beatProg !== undefined && beatProg >= 0) {
        const p = Math.max(0, Math.min(1, beatProg));
        flashFactor = Math.max(flashFactor, Math.exp(-BEAT_FLASH_DECAY * p));
      }
      if (this._flashIntensity > 0) {
        flashFactor = Math.max(flashFactor, this._flashIntensity);
      }
    }

    ctx.save();

    // 0. 배경 이미지 및 디밍 오버레이 렌더링 (Issue #272 / UI-ASSET-007)
    const bgImg = config?.bgImage !== undefined ? config.bgImage : this._bgImage;
    const bgDimAlpha = config?.bgDimAlpha !== undefined ? config.bgDimAlpha : this._bgDimAlpha;

    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
      if (bgDimAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${bgDimAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

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

    // 2. 바닥 원근 그리드 렌더링 (Issue #282: SFX 런웨이 비주얼 + Issue #295: 2-Pass 글로우 및 비트 플래시)
    this._renderFloorGrid(
      ctx,
      w,
      h,
      vx,
      vy,
      longColor,
      transColor,
      spineColor,
      nodeColor,
      nodeSecColor,
      panelDepthStart,
      panelBgColor,
      baseAlpha,
      flashFactor,
      spanMult,
    );

    // 2.5 피트니스 존 연한 연결선 렌더링 (Issue #188: RENDER-TRACK-001)
    const renderZoneConnections = config?.renderZoneConnections ?? true;
    if (renderZoneConnections) {
      const zoneAlpha = config?.zoneConnectionAlpha ?? 0.18;
      const targetZones = config?.zones ?? DEFAULT_FITNESS_ZONES;
      this._renderZoneConnections(ctx, w, h, vx, vy, longColor, zoneAlpha, targetZones);
    }

    // 3. 천장 원근 그리드 렌더링 (옵션)
    if (hasCeiling) {
      this._renderCeilingGrid(ctx, w, vx, vy, longColor, baseAlpha * 0.7);
    }

    ctx.restore();
  }

  /**
   * 바닥 3D 원근 그리드 (Issue #282: SFX 런웨이)
   * - 소실점에 가까운 상중단 영역(depthRatio < 0.16)은 심도 안개로 자연스럽게 소멸
   * - 전경 패널 음영, 듀얼 네온(세로 시안·가로 오렌지), 중앙 척추선 3.5px 코어, 교차점 노드 렌더링
   */
  private _renderFloorGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    vx: number,
    vy: number,
    longColor: string,
    transColor: string,
    spineColor: string,
    nodeColor: string,
    nodeSecColor: string,
    panelDepthStart: number,
    panelBgColor: string,
    baseAlpha: number,
    flashFactor: number = 0,
    transverseSpanMultiplier: number = TRANSVERSE_SPAN_MULTIPLIER,
  ): void {
    const floorH = h - vy;
    if (floorH <= 0) return;

    // Issue #295: 비트 플래시 알파 및 선폭 배율 계수 적용
    const flashAlphaBoost = BEAT_FLASH_MAX_ALPHA * flashFactor;
    const effAlpha = Math.min(1.0, baseAlpha + flashAlphaBoost);
    const widthBoost = 1.0 + (BEAT_FLASH_WIDTH_BOOST - 1.0) * flashFactor;

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

    // ── 1. 전경 패널 음영 (Modular Panel Grooves) ──
    // panelBgColor가 투명이 아닌 경우에만 quad fill 연산 수행
    // (기본값 'transparent' 시 완전 건너뛰어 웹캠 투과율 100% 보장 및 불필요한 드로우콜 최적화)
    if (!isColorTransparent(panelBgColor)) {
      const sortedY = [...hLinesY].sort((a, b) => a - b);
      const panelBoundaries = [...sortedY];
      if (panelBoundaries.length === 0 || panelBoundaries[panelBoundaries.length - 1] < h) {
        panelBoundaries.push(h);
      }

      ctx.fillStyle = panelBgColor;
      for (let i = 0; i < panelBoundaries.length - 1; i++) {
        const y0 = panelBoundaries[i];
        const y1 = panelBoundaries[i + 1];
        const d0 = depthRatioFromY(y0, vy, floorH);
        const d1 = depthRatioFromY(y1, vy, floorH);
        if (d1 < panelDepthStart) continue;

        const effD0 = Math.max(d0, panelDepthStart);
        const effY0 = vy + floorH * effD0;

        for (let j = -colCount; j < colCount; j++) {
          const x0Far = vx + j * stepXBottom * effD0;
          const x1Far = vx + (j + 1) * stepXBottom * effD0;
          const x0Near = vx + j * stepXBottom * d1;
          const x1Near = vx + (j + 1) * stepXBottom * d1;

          if (Math.max(x0Near, x1Near) < -30 || Math.min(x0Far, x1Far) > w + 30) continue;

          ctx.beginPath();
          ctx.moveTo(x0Far, effY0);
          ctx.lineTo(x1Far, effY0);
          ctx.lineTo(x1Near, y1);
          ctx.lineTo(x0Near, y1);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // ── 2. 가로(Transverse) 네온 오렌지/앰버 라인 (2-Pass 발광: 외곽 네온 글로우 + 중심 순백 코어) ──
    for (let i = 0; i < hLinesY.length; i++) {
      const y = hLinesY[i];
      const depthRatio = depthRatioFromY(y, vy, floorH); // 0 (소실점) ~ 1 (하단)

      if (depthRatio < FOG_START) continue;
      const fogFactor = Math.min(1, (depthRatio - FOG_START) / FOG_RANGE);
      const lineAlpha = effAlpha * Math.pow(fogFactor, 1.25);
      if (lineAlpha < 0.005) continue;

      const halfW = (w * 0.5 + 50) * depthRatio * transverseSpanMultiplier;
      const lineWidth = (TRANSVERSE_MIN_WIDTH + (TRANSVERSE_MAX_WIDTH - TRANSVERSE_MIN_WIDTH) * Math.pow(depthRatio, 1.4)) * widthBoost;

      // Pass 1: 외곽 네온 오렌지/앰버 글로우 라인
      ctx.strokeStyle = transColor;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      ctx.moveTo(vx - halfW, y);
      ctx.lineTo(vx + halfW, y);
      ctx.stroke();

      // Pass 2: 전경(depthRatio >= 0.35) 중심 순백색/소프트 옐로우 코어 라인
      if (depthRatio >= 0.35 && lineAlpha > 0.05) {
        const coreAlpha = Math.min(1, lineAlpha * 1.6);
        ctx.strokeStyle = '#FFF8F0';
        ctx.globalAlpha = coreAlpha;
        ctx.lineWidth = Math.max(1.0, lineWidth * 0.35);

        ctx.beginPath();
        ctx.moveTo(vx - halfW, y);
        ctx.lineTo(vx + halfW, y);
        ctx.stroke();
      }
    }

    // ── 3. 세로(Longitudinal) 네온 시안 방사선 드로잉 (2-Pass 발광: 외곽 소프트 글로우 + 중심 코어) ──
    const vertCoreGrad = ctx.createLinearGradient(0, h, 0, vy);
    vertCoreGrad.addColorStop(0, toRgba(longColor, effAlpha));
    vertCoreGrad.addColorStop(0.45, toRgba(longColor, effAlpha * 0.85));
    vertCoreGrad.addColorStop(0.72, toRgba(longColor, effAlpha * 0.25));
    vertCoreGrad.addColorStop(0.86, toRgba(longColor, 0));
    vertCoreGrad.addColorStop(1, toRgba(longColor, 0));

    const vertGlowGrad = ctx.createLinearGradient(0, h, 0, vy);
    vertGlowGrad.addColorStop(0, toRgba(longColor, Math.min(1, effAlpha * LONGITUDINAL_GLOW_ALPHA_MULT)));
    vertGlowGrad.addColorStop(0.45, toRgba(longColor, effAlpha * 0.85 * LONGITUDINAL_GLOW_ALPHA_MULT));
    vertGlowGrad.addColorStop(0.72, toRgba(longColor, effAlpha * 0.25 * LONGITUDINAL_GLOW_ALPHA_MULT));
    vertGlowGrad.addColorStop(0.86, toRgba(longColor, 0));
    vertGlowGrad.addColorStop(1, toRgba(longColor, 0));

    ctx.globalAlpha = 1;

    const yStart = vy + floorH * FADE_DEPTH;
    const coreLineWidth = (LONGITUDINAL_MIN_WIDTH + (LONGITUDINAL_MAX_WIDTH - LONGITUDINAL_MIN_WIDTH) * 0.7) * widthBoost;
    const glowLineWidth = coreLineWidth * LONGITUDINAL_GLOW_WIDTH_MULT;

    // 3-a-1. Pass 1: 일반 세로선 외곽 소프트 네온 글로우
    ctx.strokeStyle = vertGlowGrad;
    ctx.lineWidth = glowLineWidth;
    for (let j = -colCount; j <= colCount; j++) {
      if (j === 0) continue; // 중앙 척추선은 아래에서 특수 고광도 렌더링
      const xBottom = vx + j * stepXBottom;
      const xStart = vx + (xBottom - vx) * FADE_DEPTH;

      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xBottom, h);
      ctx.stroke();
    }

    // 3-a-2. Pass 2: 일반 세로선 중심 코어 네온 라인
    ctx.strokeStyle = vertCoreGrad;
    ctx.lineWidth = coreLineWidth;
    for (let j = -colCount; j <= colCount; j++) {
      if (j === 0) continue;
      const xBottom = vx + j * stepXBottom;
      const xStart = vx + (xBottom - vx) * FADE_DEPTH;

      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xBottom, h);
      ctx.stroke();
    }

    // 3-b. 중앙 척추선(Center Spine, j === 0): 3-Pass 초고휘도 레이저 라인 (외곽 12px 글로우, 8px 미드 글로우, 3.5px 순백 코어)
    const spineOuterGrad = ctx.createLinearGradient(0, h, 0, vy);
    spineOuterGrad.addColorStop(0, toRgba(longColor, Math.min(1, effAlpha * 1.8)));
    spineOuterGrad.addColorStop(0.45, toRgba(longColor, effAlpha * 0.9));
    spineOuterGrad.addColorStop(0.72, toRgba(longColor, effAlpha * 0.3));
    spineOuterGrad.addColorStop(0.86, toRgba(longColor, 0));
    spineOuterGrad.addColorStop(1, toRgba(longColor, 0));

    // Pass 1: 외곽 12px 시안 소프트 글로우
    ctx.strokeStyle = spineOuterGrad;
    ctx.lineWidth = CENTER_SPINE_GLOW_WIDTH * widthBoost;
    ctx.beginPath();
    ctx.moveTo(vx, yStart);
    ctx.lineTo(vx, h);
    ctx.stroke();

    // Pass 2: 미드 8px 인텐스 시안 빔
    ctx.lineWidth = CENTER_SPINE_MAX_WIDTH * widthBoost;
    ctx.beginPath();
    ctx.moveTo(vx, yStart);
    ctx.lineTo(vx, h);
    ctx.stroke();

    // Pass 3: 중심 3.5px 순백색 레이저 코어
    const spineCoreGrad = ctx.createLinearGradient(0, h, 0, vy);
    spineCoreGrad.addColorStop(0, toRgba(spineColor, Math.min(1, effAlpha * 2.8)));
    spineCoreGrad.addColorStop(0.45, toRgba(spineColor, Math.min(1, effAlpha * 2.0)));
    spineCoreGrad.addColorStop(0.72, toRgba(spineColor, effAlpha * 0.6));
    spineCoreGrad.addColorStop(0.86, toRgba(spineColor, 0));
    spineCoreGrad.addColorStop(1, toRgba(spineColor, 0));

    ctx.strokeStyle = spineCoreGrad;
    ctx.lineWidth = CENTER_SPINE_CORE_WIDTH * widthBoost;
    ctx.beginPath();
    ctx.moveTo(vx, yStart);
    ctx.lineTo(vx, h);
    ctx.stroke();

    // ── 4. 교차점 접합 노드 (Intersection Nodes) ──
    // 전경(depthRatio >= panelDepthStart)의 주요 가로-세로 교차점에 2~3px 발광 마름모/크로스 노드 드로잉
    for (let i = 0; i < hLinesY.length; i++) {
      const y = hLinesY[i];
      const depthRatio = depthRatioFromY(y, vy, floorH);
      if (depthRatio < panelDepthStart) continue;

      const nodeSize = Math.max(2, Math.min(4.5, depthRatio * 3.2 * widthBoost));
      const nodeAlpha = Math.min(1, effAlpha * 2.2 * depthRatio);

      for (let j = -colCount; j <= colCount; j++) {
        const ix = vx + j * stepXBottom * depthRatio;
        if (ix < -20 || ix > w + 20) continue;

        // 마름모(다이아몬드) 노드 코어 (#FFFFFF)
        ctx.fillStyle = nodeColor;
        ctx.globalAlpha = nodeAlpha;
        ctx.beginPath();
        ctx.moveTo(ix, y - nodeSize);
        ctx.lineTo(ix + nodeSize, y);
        ctx.lineTo(ix, y + nodeSize);
        ctx.lineTo(ix - nodeSize, y);
        ctx.closePath();
        ctx.fill();

        // 앰버/골드 보조 크로스 액센트 (#FFCB4D)
        ctx.strokeStyle = nodeSecColor;
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = nodeAlpha * 0.75;
        ctx.beginPath();
        ctx.moveTo(ix - nodeSize * 1.4, y);
        ctx.lineTo(ix + nodeSize * 1.4, y);
        ctx.moveTo(ix, y - nodeSize * 1.4);
        ctx.lineTo(ix, y + nodeSize * 1.4);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
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
