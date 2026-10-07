/**
 * RunningMatRenderer.ts - 반투명 원근 러닝 매트 렌더러
 *
 * Issue #372 (RUN-MAT-003):
 * - RunningMatViewModel을 소비하여 고정 원근 좌/중앙/우 반투명 셀 렌더링
 * - 중앙 좌/우 home 발자국 슬롯 및 현재/다음 발자국 시각화
 * - 이동/복귀 화살표 및 NEXT 수축 링(nextRingRatio) 렌더링
 * - 비run 모드(hip_bounce, hip_sway, arm_cross) 차별화 표시
 * - 웹캠 하체가 비치는 반투명 배경 및 텍스트/아이콘 접근성 지원
 */

import {
  RUNNING_MAT_CONFIG,
  DEFAULT_STRIKE_LINE_Y_RATIO,
  DEFAULT_STRIKE_OVERHANG_RATIO,
  type RunningMatConfig,
} from '../../config/running-mat.config.js';
import type { RunningMatViewModel } from './RunningMatPresenter.js';

interface Point2D {
  x: number;
  y: number;
}

interface FootprintSlotCoords {
  readonly leftOut: Point2D;
  readonly leftHome: Point2D;
  readonly rightHome: Point2D;
  readonly rightOut: Point2D;
  readonly footWidth: number;
  readonly footHeight: number;
}

export interface RunningMatRenderOptions {
  vanishingPoint?: { x: number; y: number };
  elapsedTime?: number;
  beatProgress?: number;
  deltaTime?: number;
}

export class RunningMatRenderer {
  private readonly config: RunningMatConfig;
  private _hitFlashTimer = 0;
  private _lastElapsedTime = 0;

  constructor(config: RunningMatConfig = RUNNING_MAT_CONFIG) {
    this.config = config;
  }

  /**
   * 모션 히트 섬광 발생 트리거 (스텝/무릎 인식 시 고휘도 화이트-골드 Flash)
   */
  triggerMotionHit(): void {
    this._hitFlashTimer = this.config.strikeHitFlashDuration ?? 0.28;
  }

  /**
   * 현재 타격 섬광 강도 (1.0 -> 0.0)
   */
  get hitFlashIntensity(): number {
    const duration = this.config.strikeHitFlashDuration || 0.28;
    return Math.max(0, Math.min(1.0, this._hitFlashTimer / duration));
  }

  /**
   * 러닝 매트 2D 캔버스 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel | null,
    width: number,
    height: number,
    optionsOrVP?: { x: number; y: number } | RunningMatRenderOptions
  ): void {
    // 1. 가드 체크: 명시적으로 비가시 상태 설정 시 생략 (null view는 앰비언트 모드로 허용)
    if (view && view.visible === false) {
      return;
    }

    // 2. 가드 체크: 유효하지 않은 캔버스 크기 시 안전 no-op
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    // 3. 상태 격리: save / restore
    ctx.save();
    try {
      this._renderInternal(ctx, view, width, height, optionsOrVP);
    } finally {
      ctx.restore();
    }
  }

  private _renderInternal(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel | null,
    width: number,
    height: number,
    optionsOrVP?: { x: number; y: number } | RunningMatRenderOptions
  ): void {
    const isVp = optionsOrVP && 'x' in optionsOrVP && 'y' in optionsOrVP;
    const vp = isVp ? optionsOrVP : (optionsOrVP as RunningMatRenderOptions)?.vanishingPoint;
    const elapsedTime = (!isVp && (optionsOrVP as RunningMatRenderOptions)?.elapsedTime !== undefined)
      ? (optionsOrVP as RunningMatRenderOptions)!.elapsedTime!
      : this._lastElapsedTime;
    const beatProgress = (!isVp && (optionsOrVP as RunningMatRenderOptions)?.beatProgress !== undefined)
      ? (optionsOrVP as RunningMatRenderOptions)!.beatProgress!
      : (view ? (1.0 - Math.max(0, Math.min(1.0, view.nextRingRatio))) : undefined);
    const dt = (!isVp && (optionsOrVP as RunningMatRenderOptions)?.deltaTime !== undefined)
      ? (optionsOrVP as RunningMatRenderOptions)!.deltaTime!
      : Math.max(0, elapsedTime - this._lastElapsedTime);

    this._lastElapsedTime = elapsedTime;
    if (dt > 0 && this._hitFlashTimer > 0) {
      this._hitFlashTimer = Math.max(0, this._hitFlashTimer - dt);
    }

    // 소실점 좌표 산출
    const vx = vp?.x ?? width * 0.5;
    const vy = vp?.y ?? height * this.config.vanishingYRatio;

    // 반응형 폭 비율 산출 (좁은 화면 / 세로 모드 보정)
    const aspect = width / height;
    const matWidthRatio =
      aspect < 1.0
        ? Math.min(
            this.config.maxNarrowWidthRatio,
            this.config.widthRatio + (1.0 - aspect) * 0.15
          )
        : this.config.widthRatio;

    // Y 범위 산출
    const yTop = height * this.config.baseYTop;
    const yBottom = height * this.config.baseYBottom;
    const halfWBottom = (width * matWidthRatio) * 0.5;

    // 1. 초고휘도 네온 글로우 발 판정선(Foot Strike Line) 및 3대 레인 타깃 앵커 렌더링 (Issue #421, #422, #426)
    const yStrike = height * (this.config.strikeLineYRatio ?? DEFAULT_STRIKE_LINE_Y_RATIO);
    this._renderFootStrikeLine(
      ctx,
      view,
      vx,
      yStrike,
      width,
      halfWBottom,
      elapsedTime,
      beatProgress
    );

    // 2. view가 null이면 앰비언트 모드로 판정선만 렌더링하고 러닝 동작 큐(발자국/화살표)는 생략
    if (!view) {
      return;
    }

    // 3. 소실점에서 판정선 3대 레인으로 날아오는 발 리듬 비트 노트 렌더링 (Issue #425)
    this._renderFlyingStompNotes(ctx, view, vx, vy, yStrike, halfWBottom);

    // 4. 발자국 슬롯 좌표 계산
    const slots = this._computeSlotCoordinates(
      vx,
      vy,
      yTop,
      yBottom,
      halfWBottom,
      width
    );

    // 3. 기본 Home 발자국 슬롯 렌더링
    this._renderHomeBaseSlots(ctx, slots);

    // 4. 현재/다음 발자국 렌더링
    this._renderActiveFootprints(ctx, view, slots);

    // 5. NEXT 수축 링 렌더링
    if (view.nextCue) {
      this._renderNextRing(ctx, view, slots);
    }

    // 6. 방향 화살표 및 이동 가이드 렌더링
    this._renderDirectionArrows(ctx, view, slots, yTop, yBottom);

    // 7. 상단 상태 배너 및 인정 수 표시
    this._renderStatusHeader(ctx, view, vx, yTop, width);

    // 8. 다음 두 박 예고 및 현재 동작 플로우 렌더링 (Issue #408)
    this._renderUpcomingPreviews(ctx, view, vx, yTop, width);
  }

  /**
   * 초고휘도 네온 글로우 발 판정선(Foot Strike Line) 및 3대 레인 타깃 앵커 렌더링
   * Issue #421, #422, #426: 듀얼 네온 블러(shadowBlur 22px, shadowColor #FF6600), 호흡 진동, 비트 상방 파동 및 타격 섬광 구현
   */
  private _renderFootStrikeLine(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel | null,
    vx: number,
    yStrike: number,
    width: number,
    halfWBottom: number,
    elapsedTime?: number,
    beatProgress?: number
  ): void {
    const overhang = width * (this.config.strikeOverhangRatio ?? DEFAULT_STRIKE_OVERHANG_RATIO);
    const xStart = -overhang;
    const xEnd = width + overhang;

    // 0. Idle / Breath 부드러운 호흡 알파 진동 (60fps 기반)
    const breathSpeed = this.config.strikeBreathSpeed ?? 2.5;
    const breathAlpha = 0.88 + 0.12 * Math.sin((elapsedTime ?? 0) * breathSpeed);

    // 1. 듀얼 네온 블러(shadowBlur 20~25px, shadowColor #FF6600) 적용 (Issue #426)
    ctx.shadowBlur = this.config.strikeAuraShadowBlur ?? 22;
    ctx.shadowColor = this.config.strikeAuraShadowColor ?? '#FF6600';

    // 2. 3중 네온 글로우 수평 판정선 (오렌지-골드 블렌드 네온)
    // (1) Outer Ambient Glow (따뜻한 오렌지 앰버 글로우)
    ctx.beginPath();
    ctx.moveTo(xStart, yStrike);
    ctx.lineTo(xEnd, yStrike);
    ctx.strokeStyle = this.config.strikeOuterColor;
    ctx.lineWidth = this.config.strikeOuterGlowWidth;
    ctx.globalAlpha = breathAlpha * 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // (2) Mid Gold Glow (부드러운 중간 골드 레이어)
    ctx.beginPath();
    ctx.moveTo(xStart, yStrike);
    ctx.lineTo(xEnd, yStrike);
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.65)';
    ctx.lineWidth = this.config.strikeInnerGlowWidth * 1.8;
    ctx.globalAlpha = breathAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // (3) Inner Neon Glow (골드/옐로우 네온 코어 띠)
    ctx.beginPath();
    ctx.moveTo(xStart, yStrike);
    ctx.lineTo(xEnd, yStrike);
    ctx.strokeStyle = this.config.strikeInnerColor;
    ctx.lineWidth = this.config.strikeInnerGlowWidth;
    ctx.stroke();

    // (4) Core Line: 3px 두께의 선명한 네온 골드·주황 그라데이션 (#FFB800 ~ #FF8800)
    ctx.beginPath();
    ctx.moveTo(xStart, yStrike);
    ctx.lineTo(xEnd, yStrike);
    const coreGrad = typeof ctx.createLinearGradient === 'function'
      ? ctx.createLinearGradient(xStart, yStrike, xEnd, yStrike)
      : null;
    if (coreGrad) {
      coreGrad.addColorStop(0, this.config.strikeCoreGradientEnd ?? '#FF8800');
      coreGrad.addColorStop(0.25, this.config.strikeCoreGradientStart ?? '#FFB800');
      coreGrad.addColorStop(0.5, '#FFFFFF');
      coreGrad.addColorStop(0.75, this.config.strikeCoreGradientStart ?? '#FFB800');
      coreGrad.addColorStop(1, this.config.strikeCoreGradientEnd ?? '#FF8800');
      ctx.strokeStyle = coreGrad;
    } else {
      ctx.strokeStyle = this.config.strikeCoreColor;
    }
    ctx.lineWidth = this.config.strikeCoreLineWidth;
    ctx.stroke();

    // 3. Beat Pulse: BGM 비트 타이밍마다 중심에서 상방으로 2배 강렬하게 퍼지는 빛 파동 (Issue #426 강화)
    if (beatProgress !== undefined && beatProgress >= 0 && beatProgress <= 0.55) {
      const pulseP = beatProgress / 0.55;
      const waveAlpha = (1.0 - pulseP);
      const waveY1 = yStrike - 72 * Math.pow(pulseP, 0.65);
      const waveY2 = yStrike - 38 * Math.pow(pulseP, 0.65);

      // (1) 뒤따르는 앰버 충격파 파동 (Aura Wave)
      ctx.beginPath();
      ctx.moveTo(xStart, waveY2);
      ctx.lineTo(xEnd, waveY2);
      ctx.strokeStyle = '#FF6600';
      ctx.lineWidth = Math.max(3, 14.0 * (1.0 - pulseP));
      ctx.globalAlpha = waveAlpha * 0.65;
      ctx.stroke();

      // (2) 선두 고휘도 네온 골드 펄스 파동 (Primary Wave)
      ctx.beginPath();
      ctx.moveTo(xStart, waveY1);
      ctx.lineTo(xEnd, waveY1);
      ctx.strokeStyle = '#FFE066';
      ctx.lineWidth = Math.max(2, 7.5 * (1.0 - pulseP));
      ctx.globalAlpha = waveAlpha * 0.95;
      ctx.stroke();

      // (3) 3대 타깃 앵커 상방 수직 광선 기둥 (Upward Light Pillars)
      const anchorXs = [vx - halfWBottom * 0.45, vx, vx + halfWBottom * 0.45];
      const pillarH = 65 * (1.0 - pulseP);
      for (const ax of anchorXs) {
        ctx.beginPath();
        ctx.moveTo(ax, yStrike);
        ctx.lineTo(ax, yStrike - pillarH);
        ctx.strokeStyle = '#FFD166';
        ctx.lineWidth = Math.max(2, 6.0 * (1.0 - pulseP));
        ctx.globalAlpha = waveAlpha * 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    // 4. Motion Hit Flash: 스텝/무릎 감지 시 순간적인 2배 고휘도 화이트-골드 폭발 섬광 (Issue #426 강화)
    if (this._hitFlashTimer > 0) {
      const flashAlpha = this.hitFlashIntensity;

      // (1) Outer Fiery Shockwave (대형 오렌지 앰버 충격파 오라 - 65px 두께)
      ctx.beginPath();
      ctx.moveTo(xStart, yStrike);
      ctx.lineTo(xEnd, yStrike);
      ctx.strokeStyle = '#FF5500';
      ctx.lineWidth = this.config.strikeCoreLineWidth * 18.0;
      ctx.globalAlpha = flashAlpha * 0.55;
      ctx.stroke();

      // (2) Super Golden Flare (선명한 골드 플레어 광선 - 35px 두께)
      ctx.beginPath();
      ctx.moveTo(xStart, yStrike);
      ctx.lineTo(xEnd, yStrike);
      ctx.strokeStyle = '#FFD166';
      ctx.lineWidth = this.config.strikeCoreLineWidth * 10.0;
      ctx.globalAlpha = flashAlpha * 0.85;
      ctx.stroke();

      // (3) Ultra Core Laser Flash (초고휘도 퓨어 화이트 코어 레이저 - 20px 두께)
      ctx.beginPath();
      ctx.moveTo(xStart, yStrike);
      ctx.lineTo(xEnd, yStrike);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = this.config.strikeCoreLineWidth * 5.6;
      ctx.globalAlpha = flashAlpha * 1.0;
      ctx.stroke();

      // (4) 3대 타깃 앵커 동시 버스트 링 폭발
      const anchorXs = [vx - halfWBottom * 0.45, vx, vx + halfWBottom * 0.45];
      for (const ax of anchorXs) {
        ctx.beginPath();
        if (typeof ctx.arc === 'function') {
          ctx.arc(ax, yStrike, (this.config.targetAnchorRadius ?? 15) * 2.4 * (1.0 - flashAlpha * 0.3), 0, Math.PI * 2);
        }
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.globalAlpha = flashAlpha * 0.9;
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    // 5. 3대 발 레인 타깃 앵커 (Zone 9: Left Foot, Zone 10: Center, Zone 11: Right Foot)
    const isLeftActive = view ? (view.currentCue?.leftFootSlot === 'out' || view.actionText.includes('왼')) : false;
    const isRightActive = view ? (view.currentCue?.rightFootSlot === 'out' || view.actionText.includes('오른')) : false;
    const isCenterActive = view ? (!isLeftActive && !isRightActive) : false;

    const isLeftNext = view?.nextCue ? (view.nextCue.leftFootSlot === 'out' || (view.nextCue.actionText?.includes('왼') ?? false)) : false;
    const isRightNext = view?.nextCue ? (view.nextCue.rightFootSlot === 'out' || (view.nextCue.actionText?.includes('오른') ?? false)) : false;
    const isCenterNext = view?.nextCue ? (!isLeftNext && !isRightNext) : false;

    const baseRadius = this.config.targetAnchorRadius ?? 15;

    const anchors = [
      {
        id: 'left',
        x: vx - halfWBottom * 0.45,
        y: yStrike,
        label: 'LEFT (Z9)',
        isActive: isLeftActive,
        isNext: isLeftNext,
      },
      {
        id: 'center',
        x: vx,
        y: yStrike,
        label: 'HOME (Z10)',
        isActive: isCenterActive,
        isNext: isCenterNext,
      },
      {
        id: 'right',
        x: vx + halfWBottom * 0.45,
        y: yStrike,
        label: 'RIGHT (Z11)',
        isActive: isRightActive,
        isNext: isRightNext,
      },
    ];

    for (const anchor of anchors) {
      const r = anchor.isActive ? baseRadius * 1.3 : anchor.isNext ? baseRadius * 1.15 : baseRadius;

      // 타깃 외곽 링
      ctx.beginPath();
      if (typeof ctx.arc === 'function') {
        ctx.arc(anchor.x, anchor.y, r, 0, Math.PI * 2);
      } else if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(anchor.x, anchor.y, r, r, 0, 0, Math.PI * 2);
      }
      ctx.strokeStyle = anchor.isActive
        ? this.config.strikeActivePulseGlow
        : anchor.isNext
          ? this.config.cellBorderNextColor
          : this.config.strikeInnerColor;
      ctx.lineWidth = anchor.isActive ? 3.5 : anchor.isNext ? 2.5 : 1.8;
      ctx.stroke();

      // 타깃 중심 코어 점
      ctx.beginPath();
      if (typeof ctx.arc === 'function') {
        ctx.arc(anchor.x, anchor.y, anchor.isActive ? 5 : 3, 0, Math.PI * 2);
      }
      ctx.fillStyle = anchor.isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      // 접근성 / 레인 식별 라벨
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = anchor.isActive
        ? this.config.textAccentColor
        : anchor.isNext
          ? this.config.textSecondaryColor
          : 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(anchor.label, anchor.x, anchor.y + r + 3);
    }
  }

  /**
   * 8박 문제 구간 동안 소실점에서 발 판정선 3대 레인으로 비행하는 발 리듬 비트 노트 렌더링 (Issue #425)
   */
  private _renderFlyingStompNotes(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    vx: number,
    vy: number,
    yStrike: number,
    halfWBottom: number
  ): void {
    // 비행할 큐 목록 수집 (upcomingCues 우선, 없으면 nextCue fallback)
    const upcomingList =
      view.upcomingCues && view.upcomingCues.length > 0
        ? view.upcomingCues
        : view.nextCue
          ? [
              {
                cue: {
                  id: view.nextCue.actionId,
                  actionText: view.nextCue.actionText,
                  directionText: view.nextCue.directionText,
                  cueText: view.nextCue.cueText,
                  arrowDirection: view.nextCue.arrowDirection,
                  leftFootSlot: view.nextCue.leftFootSlot,
                  rightFootSlot: view.nextCue.rightFootSlot,
                },
                targetBeat: view.nextCue.beatIndex,
                remainingBeats: view.nextRingRatio,
                progress: Math.max(0, Math.min(1.0, 1.0 - view.nextRingRatio)),
                phase: 'lift' as const,
              },
            ]
          : [];

    if (upcomingList.length === 0) return;

    const baseRadius = this.config.stompNoteRadius ?? 24;
    const minScale = this.config.stompNoteMinScale ?? 0.3;
    const maxScale = this.config.stompNoteMaxScale ?? 1.25;

    for (const item of upcomingList) {
      const cue = item.cue;
      // 레인 결정: 좌(Zone 9), 중앙(Zone 10), 우(Zone 11)
      let targetX = vx;
      let noteColor = this.config.stompNoteCenterColor ?? '#FFD166';
      let laneLetter = 'C';

      if (
        cue.leftFootSlot === 'out' ||
        cue.directionText.includes('왼') ||
        cue.actionText.includes('왼')
      ) {
        targetX = vx - halfWBottom * 0.45;
        noteColor = this.config.stompNoteLeftColor ?? '#00E5FF';
        laneLetter = 'L';
      } else if (
        cue.rightFootSlot === 'out' ||
        cue.directionText.includes('오른') ||
        cue.actionText.includes('오른')
      ) {
        targetX = vx + halfWBottom * 0.45;
        noteColor = this.config.stompNoteRightColor ?? '#FF8800';
        laneLetter = 'R';
      }

      // 3D 비행 투영 좌표 계산 (원근 가속 p^1.4)
      const p = Math.max(0, Math.min(1.0, item.progress));
      const curX = vx + (targetX - vx) * p;
      const curY = vy + (yStrike - vy) * Math.pow(p, 1.4);
      const scale = minScale + (maxScale - minScale) * p;
      const r = baseRadius * scale;

      // (1) 라이트 트레일 (소실점에서 노트까지 궤적 빔)
      ctx.beginPath();
      ctx.moveTo(
        vx + (targetX - vx) * Math.max(0, p - 0.25),
        vy + (yStrike - vy) * Math.pow(Math.max(0, p - 0.25), 1.4)
      );
      ctx.lineTo(curX, curY);
      ctx.strokeStyle = noteColor;
      ctx.lineWidth = Math.max(1, 4 * scale);
      ctx.globalAlpha = 0.45 * p;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // (2) 외부 네온 발광 글로우
      ctx.beginPath();
      if (typeof ctx.arc === 'function') {
        ctx.arc(curX, curY, r * 1.35, 0, Math.PI * 2);
      }
      ctx.fillStyle = noteColor;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // (3) 노트 본체 (어두운 베이스 원)
      ctx.beginPath();
      if (typeof ctx.arc === 'function') {
        ctx.arc(curX, curY, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(12, 20, 36, 0.92)';
      ctx.fill();

      // (4) 네온 테두리 링
      ctx.strokeStyle = noteColor;
      ctx.lineWidth = Math.max(2, 3.5 * scale);
      ctx.stroke();

      // (5) 중앙 심볼 (음표 ♪ 및 L/R 레인 표시)
      ctx.font = `bold ${Math.max(10, Math.round(15 * scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.config.stompNoteSymbol || '♪', curX, curY);

      // (6) 미니 레인 라벨
      ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px sans-serif`;
      ctx.fillStyle = noteColor;
      ctx.fillText(laneLetter, curX, curY + r * 0.7);
    }
  }

  /**
   * 원근에 맞춘 4개 발 슬롯 좌표 계산 (LeftOut, LeftHome, RightHome, RightOut)
   */
  private _computeSlotCoordinates(
    vx: number,
    vy: number,
    yTop: number,
    yBottom: number,
    halfWBottom: number,
    width: number
  ): FootprintSlotCoords {
    const ySlot = yTop + (yBottom - yTop) * 0.56;
    const floorH = Math.max(1, yBottom - vy);
    const slotSpread = Math.max(0.2, (ySlot - vy) / floorH);

    const footWidth = Math.max(16, 26 * slotSpread * (width / 1080));
    const footHeight = footWidth * 1.85;

    // normalized lane positions:
    // Left Out: -0.67, Left Home: -0.17, Right Home: +0.17, Right Out: +0.67
    const leftOutX = vx + -0.67 * halfWBottom * slotSpread;
    const leftHomeX = vx + -0.17 * halfWBottom * slotSpread;
    const rightHomeX = vx + 0.17 * halfWBottom * slotSpread;
    const rightOutX = vx + 0.67 * halfWBottom * slotSpread;

    return {
      leftOut: { x: leftOutX, y: ySlot },
      leftHome: { x: leftHomeX, y: ySlot },
      rightHome: { x: rightHomeX, y: ySlot },
      rightOut: { x: rightOutX, y: ySlot },
      footWidth,
      footHeight,
    };
  }

  /**
   * 기본 Home 발자국 슬롯 (중앙 좌/우 휴식 발판)
   */
  private _renderHomeBaseSlots(
    ctx: CanvasRenderingContext2D,
    slots: FootprintSlotCoords
  ): void {
    this._drawFootprint(
      ctx,
      slots.leftHome.x,
      slots.leftHome.y,
      slots.footWidth,
      slots.footHeight,
      true,
      'home'
    );
    this._drawFootprint(
      ctx,
      slots.rightHome.x,
      slots.rightHome.y,
      slots.footWidth,
      slots.footHeight,
      false,
      'home'
    );
  }

  /**
   * 현재(currentCue) 및 다음(nextCue) 발자국 렌더링
   */
  private _renderActiveFootprints(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    slots: FootprintSlotCoords
  ): void {
    // 1. 현재 발자국 (채움 / 강조)
    if (view.currentCue) {
      const cue = view.currentCue;
      const leftTarget =
        cue.leftFootSlot === 'out' ? slots.leftOut : slots.leftHome;
      const rightTarget =
        cue.rightFootSlot === 'out' ? slots.rightOut : slots.rightHome;

      this._drawFootprint(
        ctx,
        leftTarget.x,
        leftTarget.y,
        slots.footWidth,
        slots.footHeight,
        true,
        'current'
      );
      this._drawFootprint(
        ctx,
        rightTarget.x,
        rightTarget.y,
        slots.footWidth,
        slots.footHeight,
        false,
        'current'
      );
    }

    // 2. 다음 발자국 (외곽선 / 점선)
    if (view.nextCue) {
      const next = view.nextCue;
      if (next.leftFootSlot === 'out') {
        this._drawFootprint(
          ctx,
          slots.leftOut.x,
          slots.leftOut.y,
          slots.footWidth,
          slots.footHeight,
          true,
          'next'
        );
      } else if (
        next.leftFootSlot === 'home' &&
        view.currentCue?.leftFootSlot === 'out'
      ) {
        this._drawFootprint(
          ctx,
          slots.leftHome.x,
          slots.leftHome.y,
          slots.footWidth,
          slots.footHeight,
          true,
          'next'
        );
      }

      if (next.rightFootSlot === 'out') {
        this._drawFootprint(
          ctx,
          slots.rightOut.x,
          slots.rightOut.y,
          slots.footWidth,
          slots.footHeight,
          false,
          'next'
        );
      } else if (
        next.rightFootSlot === 'home' &&
        view.currentCue?.rightFootSlot === 'out'
      ) {
        this._drawFootprint(
          ctx,
          slots.rightHome.x,
          slots.rightHome.y,
          slots.footWidth,
          slots.footHeight,
          false,
          'next'
        );
      }
    }

    // 3. 그다음 2박 발자국 (약한 윤곽선 / 점선)
    if (view.upcomingCues && view.upcomingCues.length > 1) {
      const cue2 = view.upcomingCues[1].cue;
      if (cue2.leftFootSlot === 'out') {
        this._drawFootprint(
          ctx,
          slots.leftOut.x,
          slots.leftOut.y,
          slots.footWidth,
          slots.footHeight,
          true,
          'preview2'
        );
      }
      if (cue2.rightFootSlot === 'out') {
        this._drawFootprint(
          ctx,
          slots.rightOut.x,
          slots.rightOut.y,
          slots.footWidth,
          slots.footHeight,
          false,
          'preview2'
        );
      }
    }
  }

  /**
   * 단일 발자국 그리기 (벡터 패스 및 L/R 텍스트)
   */
  private _drawFootprint(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    isLeft: boolean,
    style: 'home' | 'current' | 'next' | 'preview2'
  ): void {
    const rx = w * 0.5;
    const ry = h * 0.5;

    const isDashed =
      (style === 'next' || style === 'preview2') &&
      typeof ctx.setLineDash === 'function';
    if (isDashed) {
      ctx.setLineDash(Array.from(this.config.footNextDash));
    }

    // 1. 발바닥 캡슐/타원 그리기
    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    }

    // 2. 스타일별 채우기 및 외곽선
    if (style === 'current') {
      ctx.fillStyle = this.config.footCurrentFill;
      ctx.fill();
      ctx.strokeStyle = this.config.footCurrentStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (style === 'next') {
      ctx.fillStyle = this.config.footNextFill;
      ctx.fill();
      ctx.strokeStyle = this.config.preview1StrokeColor || this.config.footNextStroke;
      ctx.lineWidth = this.config.preview1LineWidth || 2.0;
      ctx.stroke();
    } else if (style === 'preview2') {
      ctx.fillStyle = 'rgba(255, 203, 77, 0.08)';
      ctx.fill();
      ctx.strokeStyle = this.config.preview2StrokeColor || 'rgba(255, 203, 77, 0.45)';
      ctx.lineWidth = this.config.preview2LineWidth || 1.5;
      ctx.stroke();
    } else {
      // home
      ctx.fillStyle = this.config.footHomeFill;
      ctx.fill();
      ctx.strokeStyle = this.config.footHomeStroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (isDashed) {
      ctx.setLineDash([]);
    }

    // 3. 발 앞꿈치 원호 보조 디테일
    const toeY = cy - ry * 0.55;
    ctx.beginPath();
    ctx.arc(cx, toeY, rx * 0.45, 0, Math.PI * 2);
    if (style === 'current') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    } else if (style === 'next') {
      ctx.strokeStyle = this.config.footNextStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
    }

    // 4. 접근성 식별 텍스트 L / R
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (style === 'current') {
      ctx.fillStyle = '#061727';
    } else if (style === 'next') {
      ctx.fillStyle = this.config.footNextStroke;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    }
    ctx.fillText(isLeft ? 'L' : 'R', cx, cy + ry * 0.15);
  }

  /**
   * NEXT 수축 링 렌더링 (view.nextRingRatio 비례 축소)
   */
  private _renderNextRing(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    slots: FootprintSlotCoords
  ): void {
    const nextTarget = this._resolveNextTargetPoint(view, slots);
    if (!nextTarget) return;

    const ringRatio = Math.max(0, Math.min(1.0, view.nextRingRatio));
    const scale =
      this.config.nextRingMinScale +
      (this.config.nextRingMaxScale - this.config.nextRingMinScale) *
        ringRatio;

    const rx = slots.footWidth * 1.35 * scale;
    const ry = slots.footHeight * 0.8 * scale;

    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(nextTarget.x, nextTarget.y, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(nextTarget.x, nextTarget.y, rx, 0, Math.PI * 2);
    }

    ctx.strokeStyle = this.config.nextRingColor;
    ctx.lineWidth = this.config.nextRingLineWidth;
    ctx.stroke();

    // NEXT 미니 뱃지 텍스트
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.config.nextRingColor;
    ctx.fillText('NEXT', nextTarget.x, nextTarget.y - ry - 4);
  }

  /**
   * 다음 큐의 주요 타깃 포인트 산출
   */
  private _resolveNextTargetPoint(
    view: RunningMatViewModel,
    slots: FootprintSlotCoords
  ): Point2D | null {
    const next = view.nextCue;
    if (!next) return null;

    if (next.leftFootSlot === 'out') return slots.leftOut;
    if (next.rightFootSlot === 'out') return slots.rightOut;
    if (
      next.leftFootSlot === 'home' &&
      view.currentCue?.leftFootSlot === 'out'
    ) {
      return slots.leftHome;
    }
    if (
      next.rightFootSlot === 'home' &&
      view.currentCue?.rightFootSlot === 'out'
    ) {
      return slots.rightHome;
    }

    // 기본 중앙
    return {
      x: (slots.leftHome.x + slots.rightHome.x) * 0.5,
      y: slots.leftHome.y,
    };
  }

  /**
   * 이동/복귀 화살표 및 비run 모드 가이드
   */
  private _renderDirectionArrows(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    slots: FootprintSlotCoords,
    yTop: number,
    yBottom: number
  ): void {
    const dir = view.arrowDirection;
    const arrowY = yTop + (yBottom - yTop) * 0.26;
    const centerX = (slots.leftHome.x + slots.rightHome.x) * 0.5;

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (dir === 'left') {
      ctx.fillStyle = this.config.arrowActiveColor;
      ctx.fillText('◀ ── 왼발 딛기', centerX - 40, arrowY);
    } else if (dir === 'right') {
      ctx.fillStyle = this.config.arrowActiveColor;
      ctx.fillText('오른발 딛기 ── ▶', centerX + 40, arrowY);
    } else if (dir === 'center') {
      ctx.fillStyle = this.config.arrowReturnColor;
      ctx.fillText('▶ 중앙 복귀 ◀', centerX, arrowY);
    } else if (dir === 'up') {
      const isKnee =
        view.currentCue?.actionId === 'knee_left' ||
        view.currentCue?.actionId === 'knee_right' ||
        view.actionText.includes('무릎');
      if (isKnee) {
        if (view.isReturnPhase || view.currentCue?.isReturnPhase) {
          ctx.fillStyle = this.config.arrowReturnColor;
          ctx.fillText(`▼ ▼ ${this.config.kneeReturnText} ▼ ▼`, centerX, arrowY);
        } else {
          ctx.fillStyle = this.config.arrowActiveColor;
          ctx.fillText(`▲ ▲ ${this.config.kneeLiftText} ▲ ▲`, centerX, arrowY);
        }
      } else {
        ctx.fillStyle = this.config.arrowActiveColor;
        ctx.fillText('▲ ▲ 바운스 업 ▲ ▲', centerX, arrowY);
      }
    } else if (dir === 'down') {
      ctx.fillStyle = this.config.arrowActiveColor;
      ctx.fillText('▼ ▼ 바운스 다운 ▼ ▼', centerX, arrowY);
    } else {
      // 'none' or hip_sway / arm_cross
      if (view.actionText.includes('스웨이') || view.cueText.includes('체중')) {
        ctx.fillStyle = this.config.textAccentColor;
        ctx.fillText('~ ◀ 체중 이동 ▶ ~', centerX, arrowY);
      } else if (view.actionText.includes('팔 교차')) {
        ctx.fillStyle = this.config.textAccentColor;
        ctx.fillText('✕ 두 발 고정 · 상체 교차 ✕', centerX, arrowY);
      }
    }
  }

  /**
   * 상단 상태 배너 (액션 텍스트, 안내 문구, 인정/필수 수)
   */
  private _renderStatusHeader(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    vx: number,
    yTop: number,
    width: number
  ): void {
    const headerY = yTop - 14;

    // 1. 좌측 액션 배지 (Action / Cue Text)
    let badgeText = `${view.actionText} · ${view.cueText}`;
    let badgeColor = this.config.textPrimaryColor;

    if (view.isShortage) {
      badgeText = `[부족] ${view.actionText} (중앙 운동 연장!)`;
      badgeColor = this.config.textShortageColor;
    } else if (view.isPreparing) {
      badgeText = `[준비] ${view.actionText} (정답 존 대기)`;
      badgeColor = this.config.textPrepareColor;
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, vx, headerY);

    // 2. 우측 인정 수 / 필수 수 배지
    const countText = `인정: ${view.acceptedExerciseCount} / ${view.requiredExerciseCount} 회`;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.config.textSecondaryColor;
    ctx.fillText(countText, width * 0.94, headerY);
  }

  /**
   * 다음 두 박 예고 및 현재 동작 플로우 렌더링 (Issue #408)
   * - 현재 동작: 채운 아이콘/지금
   * - 다음 1박: 강한 윤곽/다음
   * - 다음 2박: 약한 윤곽/그다음
   */
  private _renderUpcomingPreviews(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    vx: number,
    yTop: number,
    width: number
  ): void {
    const upcoming = view.upcomingCues ?? (view.nextCue ? [
      {
        targetBeat: view.nextCue.beatIndex,
        remainingBeats: 1,
        progress: 0,
        phase: 'hold' as const,
        cue: {
          id: view.nextCue.actionId,
          actionText: view.nextCue.actionText,
          directionText: view.nextCue.directionText,
          cueText: view.nextCue.cueText,
          arrowDirection: view.nextCue.arrowDirection,
          leftFootSlot: view.nextCue.leftFootSlot,
          rightFootSlot: view.nextCue.rightFootSlot,
        },
      },
    ] : []);

    interface PreviewNode {
      readonly label: string;
      readonly actionText: string;
      readonly style: 'current' | 'preview1' | 'preview2';
    }

    const currentText = view.actionText || view.currentCue?.actionText || '운동 동작';
    const nodes: PreviewNode[] = [
      { label: '지금', actionText: currentText, style: 'current' },
    ];

    if (upcoming.length > 0) {
      nodes.push({
        label: this.config.preview1Label || '다음',
        actionText: upcoming[0].cue.actionText,
        style: 'preview1',
      });
    }

    if (upcoming.length > 1) {
      nodes.push({
        label: this.config.preview2Label || '그다음',
        actionText: upcoming[1].cue.actionText,
        style: 'preview2',
      });
    }

    const nodeWidth = Math.min(130, (width * 0.8) / nodes.length);
    const nodeHeight = 26;
    const totalW = nodes.length * nodeWidth + (nodes.length - 1) * 8;
    const startX = vx - totalW * 0.5;
    const previewY = yTop - 48;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nx = startX + i * (nodeWidth + 8);

      ctx.beginPath();
      ctx.moveTo(nx, previewY);
      ctx.lineTo(nx + nodeWidth, previewY);
      ctx.lineTo(nx + nodeWidth, previewY + nodeHeight);
      ctx.lineTo(nx, previewY + nodeHeight);
      ctx.closePath();

      if (node.style === 'current') {
        // 현재 동작: 채운 아이콘/지금
        ctx.fillStyle = this.config.footCurrentFill;
        ctx.fill();
        ctx.strokeStyle = this.config.footCurrentStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#061325';
        ctx.fillText(node.label, nx + nodeWidth * 0.28, previewY + nodeHeight * 0.5);

        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#061325';
        const displayTxt = node.actionText.length > 6 ? node.actionText.slice(0, 5) + '..' : node.actionText;
        ctx.fillText(displayTxt, nx + nodeWidth * 0.72, previewY + nodeHeight * 0.5);
      } else if (node.style === 'preview1') {
        // 다음 1박: 강한 윤곽/다음
        ctx.fillStyle = 'rgba(255, 203, 77, 0.16)';
        ctx.fill();
        ctx.strokeStyle = this.config.preview1StrokeColor || '#FFCB4D';
        ctx.lineWidth = this.config.preview1LineWidth || 2.5;
        ctx.stroke();

        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.config.textAccentColor;
        ctx.fillText(node.label, nx + nodeWidth * 0.28, previewY + nodeHeight * 0.5);

        ctx.font = '10px sans-serif';
        ctx.fillStyle = this.config.textPrimaryColor;
        const displayTxt = node.actionText.length > 6 ? node.actionText.slice(0, 5) + '..' : node.actionText;
        ctx.fillText(displayTxt, nx + nodeWidth * 0.72, previewY + nodeHeight * 0.5);
      } else {
        // 다음 2박: 약한 윤곽/그다음
        ctx.fillStyle = 'rgba(255, 203, 77, 0.08)';
        ctx.fill();
        ctx.strokeStyle = this.config.preview2StrokeColor || 'rgba(255, 203, 77, 0.45)';
        ctx.lineWidth = this.config.preview2LineWidth || 1.5;
        ctx.stroke();

        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 203, 77, 0.75)';
        ctx.fillText(node.label, nx + nodeWidth * 0.28, previewY + nodeHeight * 0.5);

        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        const displayTxt = node.actionText.length > 6 ? node.actionText.slice(0, 5) + '..' : node.actionText;
        ctx.fillText(displayTxt, nx + nodeWidth * 0.72, previewY + nodeHeight * 0.5);
      }
    }
  }
}
