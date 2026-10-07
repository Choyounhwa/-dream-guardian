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
import {
  DEFAULT_STAR_TIMING_WINDOWS,
  DEFAULT_STAR_NOTE_VISUAL_CONFIG,
  type StarTimingWindows,
  type StarNoteVisualConfig,
} from '../../config/beat-motion.config.js';
import {
  DEFAULT_STAR_PREVIEW_CONFIG,
  type StarBeatPreviewOptions,
} from '../../config/star-preview.config.js';
import { projectAlongRail } from './GridProjection.js';

export type { StarBeatPreviewOptions };

export interface StarNoteRenderOptions {
  /** 노트 비행 소요 시간 (초, 기본값 0.5s = 1박) */
  travelDuration?: number;
  /** 소실점 시작 최소 크기 배율 (기본값 0.3) */
  minScale?: number;
  /** 존 안착 종료 최대 크기 배율 (기본값 1.2) */
  maxScale?: number;
  /** 기준 반지름 (px, 기본값 28) */
  baseRadius?: number;
  /** Perfect 판정 허용 시간 (초, 기본값 DEFAULT_STAR_TIMING_WINDOWS.perfect = 0.12s) */
  perfectWindow?: number;
  /** Late 판정 종료 허용 시간 (초, 기본값 DEFAULT_STAR_TIMING_WINDOWS.late = 0.40s) */
  lateWindow?: number;
  /** 타이밍 윈도우 설정 일괄 연동 */
  timingWindows?: Partial<StarTimingWindows>;
  /** 시각 스타일 및 아이콘 설정 (Issue #316 / RENDER-NOTE-CONFIG-001) */
  visualConfig?: Partial<StarNoteVisualConfig>;
  /** 사전 주입 이미지 맵 (Issue #424 / RENDER-NOTE-IMAGE-001) */
  imageMap?: Record<string, any>;
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
  isPaused?: boolean;
  beatPreview?: StarBeatPreviewOptions;
}

export class StarNoteRenderer {
  private readonly _options: Required<Omit<StarNoteRenderOptions, 'timingWindows' | 'visualConfig' | 'imageMap'>>;
  private readonly _visualConfig: StarNoteVisualConfig;
  private readonly _imageCache: Map<string, any> = new Map();

  constructor(options?: StarNoteRenderOptions) {
    const timing = options?.timingWindows;
    this._options = {
      travelDuration: options?.travelDuration ?? 0.5,
      minScale: options?.minScale ?? 0.3,
      maxScale: options?.maxScale ?? 1.2,
      baseRadius: options?.baseRadius ?? options?.visualConfig?.baseRadius ?? DEFAULT_STAR_NOTE_VISUAL_CONFIG.baseRadius,
      perfectWindow: options?.perfectWindow ?? timing?.perfect ?? DEFAULT_STAR_TIMING_WINDOWS.perfect,
      lateWindow: options?.lateWindow ?? timing?.late ?? DEFAULT_STAR_TIMING_WINDOWS.late,
    };

    this._visualConfig = {
      ...DEFAULT_STAR_NOTE_VISUAL_CONFIG,
      ...options?.visualConfig,
      instrumentSymbols: {
        ...DEFAULT_STAR_NOTE_VISUAL_CONFIG.instrumentSymbols,
        ...options?.visualConfig?.instrumentSymbols,
      },
      partColors: {
        ...DEFAULT_STAR_NOTE_VISUAL_CONFIG.partColors,
        ...options?.visualConfig?.partColors,
      },
      iconImages: {
        ...DEFAULT_STAR_NOTE_VISUAL_CONFIG.iconImages,
        ...options?.visualConfig?.iconImages,
      },
    };

    if (options?.imageMap) {
      for (const [k, v] of Object.entries(options.imageMap)) {
        this._imageCache.set(k, v);
      }
    }

    this._initImageLoading();
  }

  /**
   * 브라우저 환경에서 iconImages 경로의 이미지를 비동기 로드
   */
  private _initImageLoading(): void {
    if (typeof Image === 'undefined') return;
    const images = this._visualConfig.iconImages;
    if (!images) return;

    for (const [key, src] of Object.entries(images)) {
      if (src && !this._imageCache.has(key)) {
        try {
          const img = new Image();
          img.src = src;
          this._imageCache.set(key, img);
        } catch {
          // ignore error in non-standard environment
        }
      }
    }
  }

  /**
   * 특정 키의 렌더링용 이미지 수동 등록 (테스트 및 커스텀 에셋 주입용)
   */
  setImage(key: string, img: any): void {
    this._imageCache.set(key, img);
  }

  /**
   * 등록된 이미지 조회
   */
  getImage(key: string): any {
    return this._imageCache.get(key);
  }

  get options(): Readonly<Required<Omit<StarNoteRenderOptions, 'timingWindows' | 'visualConfig' | 'imageMap'>>> {
    return this._options;
  }

  getVisualConfig(): Readonly<StarNoteVisualConfig> {
    return this._visualConfig;
  }

  /**
   * 노트 비행 진행도에 따른 목표 피트니스 존 어프로치 링 수축 배율 계산 (Issue #284 / VFX-JUDGMENT-001)
   * - 진행도 0.0일 때 2.5배 -> 1.0 안착 시 1.0배
   * - formula: approachScale = 1.0 + 1.5 * (1.0 - progress)
   */
  computeApproachScale(progress: number): number {
    const clamped = Math.min(1.0, Math.max(0.0, progress));
    return 1.0 + 1.5 * (1.0 - clamped);
  }

  /**
   * 실시간 노트 좌표 및 비행 상태 계산
   */
  computeNotePosition(
    target: (StarTarget | ActiveStarTarget) & {
      landingTime?: number;
      resolved?: boolean;
      isCollected?: boolean;
      beatPreview?: StarBeatPreviewOptions;
    },
    elapsedTime: number,
    vx: number,
    vy: number,
    vw: number,
    vh: number,
    zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES,
    beatPreview?: StarBeatPreviewOptions,
  ): StarNotePositionResult {
    // 1. 이미 수집/판정 완료된 노트(resolved / isCollected)는 비행 중단
    if (target.resolved || target.isCollected) {
      return {
        x: vx,
        y: vy,
        scale: this._options.minScale,
        progress: 0,
        inFlight: false,
      };
    }

    const landingTime = target.landingTime ?? 0;
    const preview = beatPreview ?? target.beatPreview;

    const isPreviewValid =
      preview !== undefined &&
      preview !== null &&
      typeof preview.startTime === 'number' &&
      Number.isFinite(preview.startTime) &&
      typeof preview.secondsPerBeat === 'number' &&
      Number.isFinite(preview.secondsPerBeat) &&
      preview.secondsPerBeat >= DEFAULT_STAR_PREVIEW_CONFIG.minSecondsPerBeat;

    let progress: number;

    if (isPreviewValid) {
      const leadBeats =
        preview.leadBeats !== undefined &&
        Number.isFinite(preview.leadBeats) &&
        preview.leadBeats > 0
          ? preview.leadBeats
          : DEFAULT_STAR_PREVIEW_CONFIG.leadBeats;

      const displayStart = Math.max(
        preview.startTime,
        landingTime - leadBeats * preview.secondsPerBeat,
      );
      const duration = landingTime - displayStart;

      if (duration <= 0) {
        progress = 1.0;
      } else {
        progress = (elapsedTime - displayStart) / duration;
      }

      // 출현 이전(displayStart 미만) 또는 판정 만료 이후(lateWindow 초과) 숨김
      if (elapsedTime < displayStart || elapsedTime > landingTime + this._options.lateWindow) {
        return {
          x: vx,
          y: vy,
          scale: this._options.minScale,
          progress,
          inFlight: false,
        };
      }
    } else {
      const timeRemaining = landingTime - elapsedTime;
      const travelDuration = this._options.travelDuration;

      // 비행 진행도: 0.0(소실점 출발) ~ 1.0(목표 존 착지)
      progress = 1.0 - timeRemaining / travelDuration;

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
    const targets = rawTargets.filter(
      (t): t is ActiveStarTarget | StarTarget =>
        Boolean(t && t.landingTime !== undefined && !(t as any).resolved && !(t as any).isCollected)
    );
    if (targets.length === 0) return;

    // 렌더 순서: 여러 타겟이 렌더링될 때 가까운 착지(landingTime이 더 빠른 노트)를 우선하여 시인성 확보
    const sortedTargets = targets.length > 1
      ? [...targets].sort((a, b) => (a.landingTime ?? 0) - (b.landingTime ?? 0))
      : targets;

    const zones = state.zones ?? DEFAULT_FITNESS_ZONES;

    for (const target of sortedTargets) {
      this._renderSingleTarget(
        ctx,
        vw,
        vh,
        target,
        state.elapsedTime,
        state.vanishingX,
        state.vanishingY,
        zones,
        state.beatPreview,
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
    beatPreview?: StarBeatPreviewOptions,
  ): void {
    const pos = this.computeNotePosition(
      target,
      elapsedTime,
      vanishingX,
      vanishingY,
      vw,
      vh,
      zones,
      beatPreview,
    );

    if (!pos.inFlight) return;

    const targetPart = target.part || 'leftHand';
    const color = this._visualConfig.partColors[targetPart] || this._visualConfig.partColors.leftHand || '#28E6FF';
    const zone = zones.find((z) => z.id === target.zoneId);

    ctx.save();

    // 1. 목표 존 어프로치 링 (Issue #284 / VFX-JUDGMENT-001): 비행 진행도에 따라 목표 존 테두리로 수축
    if (zone && this._visualConfig.showApproachRing !== false) {
      this._renderApproachRing(ctx, vw, vh, zone, color, pos.progress);
    }

    // 2. 안착 직전(±0.12s Perfect 판정 윈도우) 목표 존 테두리 펄스 링 연출
    const timeDiff = Math.abs(target.landingTime! - elapsedTime);
    if (timeDiff <= this._options.perfectWindow && zone) {
      this._renderZonePulse(ctx, vw, vh, zone, color, 1.0 - timeDiff / this._options.perfectWindow);
    }

    // 3. 비행 궤적 잔상 트레일 (소실점 방향 꼬리)
    this._renderTrail(ctx, vanishingX, vanishingY, pos.x, pos.y, color, pos.scale);

    // 4. 별가루 악기 노트 본체 (4색 테두리 + 글로우)
    const radius = this._options.baseRadius * pos.scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this._visualConfig.bodyFillColor;
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = this._visualConfig.strokeWidthFactor * pos.scale;
    ctx.shadowColor = color;
    ctx.shadowBlur = this._visualConfig.glowBlurFactor * pos.scale;
    ctx.stroke();

    // 5. 악기 / 별가루 심볼 렌더링 (Issue #424: 비트맵 이미지 드로잉 및 텍스트 Fallback)
    const instrument = (target as any).instrument ?? ((targetPart as string) === 'hip' || (targetPart as string) === 'foot' ? 'foot' : 'hand');
    const renderMode = this._visualConfig.renderMode ?? 'image';

    let renderedAsImage = false;
    if (renderMode === 'image') {
      const img = this._resolveTargetImage(targetPart, instrument);
      if (img && (img.complete !== false || img.naturalWidth)) {
        const iconSize = radius * 1.5;
        ctx.drawImage(img, pos.x - iconSize * 0.5, pos.y - iconSize * 0.5, iconSize, iconSize);
        renderedAsImage = true;
      }
    }

    if (!renderedAsImage) {
      const fontSize = Math.max(1, Math.round(this._visualConfig.symbolFontSizeFactor * pos.scale));
      ctx.fillStyle = this._visualConfig.symbolColor;
      ctx.font = `bold ${fontSize}px ${this._visualConfig.symbolFontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const defaultSymbol = this._visualConfig.instrumentSymbols[instrument] || this._visualConfig.instrumentSymbols.hand || '★';
      const icon = (target as any).icon ?? (this._visualConfig.resolveSymbol ? this._visualConfig.resolveSymbol(target) : defaultSymbol);
      ctx.fillText(icon, pos.x, pos.y);
    }

    ctx.restore();
    ctx.restore();
  }

  /**
   * 부위 및 악기에 따른 비트맵 이미지 조회
   */
  private _resolveTargetImage(targetPart: string, instrument: string): any {
    return (
      this._imageCache.get(targetPart) ??
      this._imageCache.get(instrument) ??
      this._imageCache.get('gold') ??
      this._imageCache.get('default') ??
      null
    );
  }

  /**
   * 목표 존 어프로치 링 (진행도에 따라 목표 존 테두리로 수축, Issue #284 / VFX-JUDGMENT-001)
   */
  private _renderApproachRing(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    zone: FitnessZone,
    color: string,
    progress: number,
  ): void {
    const scale = this.computeApproachScale(progress);
    const zx = zone.x * vw;
    const zy = zone.y * vh;
    const zw = zone.width * vw;
    const zh = zone.height * vh;
    const cx = zx + zw * 0.5;
    const cy = zy + zh * 0.5;

    const baseW = zw + 8;
    const baseH = zh + 8;
    const rw = baseW * scale;
    const rh = baseH * scale;
    const rx = cx - rw * 0.5;
    const ry = cy - rh * 0.5;

    const clampedProgress = Math.min(1.0, Math.max(0.0, progress));
    const maxAlpha = this._visualConfig.approachRingAlpha ?? 0.8;
    const alpha = Math.min(maxAlpha, Math.max(0.15, (0.2 + 0.8 * clampedProgress) * maxAlpha));

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, 2.5 * (1.0 + (1.0 - (scale - 1.0) / 1.5) * 0.5));
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + 8 * clampedProgress;

    const shape = this._visualConfig.approachShape ?? 'circle';
    if (shape === 'circle') {
      const ringRadius = (Math.max(zw, zh) * 0.5 + 4) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, 12 * Math.min(scale, 1.5));
        ctx.stroke();
      } else {
        ctx.strokeRect(rx, ry, rw, rh);
      }
    }

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
    const cx = zx + zw * 0.5;
    const cy = zy + zh * 0.5;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 + 3 * intensity;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * intensity;

    const shape = this._visualConfig.approachShape ?? 'circle';
    if (shape === 'circle') {
      const pulseRadius = Math.max(zw, zh) * 0.5 + 6 * intensity;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(zx - 4, zy - 4, zw + 8, zh + 8, 12);
        ctx.stroke();
      } else {
        ctx.strokeRect(zx - 4, zy - 4, zw + 8, zh + 8);
      }
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
