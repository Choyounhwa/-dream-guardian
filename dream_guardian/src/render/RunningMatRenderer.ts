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
  DEFAULT_LANE_SLOT_OFFSETS,
  DEFAULT_ZONE_LANE_X_RATIOS,
  type RunningMatConfig,
} from '../../config/running-mat.config.js';
import type { RunningMatViewModel } from './RunningMatPresenter.js';
import { MotionNoteRenderer } from './MotionNoteRenderer.js';
import type { FloorPart, MotionNoteRenderItem } from '../types/motion-note.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';
import {
  DEFAULT_NOTE_PROFILES,
  STOMP_FOOT_PROFILE,
  type NoteVisualProfile,
} from '../../config/motion-note-profile.config.js';
import { DEFAULT_LANE_OFFSET, type FloorLayoutOptions } from './NoteAnchorResolver.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import {
  RunningMatGeometry,
  type Point2D,
  type RunningMatBounds,
  type RunningMatSlotOverride,
  type RunningMatPresentationContext,
  type ProtectedRunningMatSlotId,
  type FootprintSlotCoords,
  type RunningMatFixtureDTO,
  type RunningMatRenderOptions,
  RUNNING_MAT_SLOT_IDS,
  PROTECTED_RUNNING_MAT_SLOT_IDS,
  DEFAULT_RUNNING_MAT_FIXTURE,
  KNEE_LIFT_MAT_FIXTURE,
  SIDE_STEP_LEFT_MAT_FIXTURE,
} from './mat/RunningMatGeometry.js';

export type {
  Point2D,
  RunningMatBounds,
  RunningMatSlotOverride,
  RunningMatPresentationContext,
  ProtectedRunningMatSlotId,
  FootprintSlotCoords,
  RunningMatFixtureDTO,
  RunningMatRenderOptions,
};

export {
  RUNNING_MAT_SLOT_IDS,
  PROTECTED_RUNNING_MAT_SLOT_IDS,
  DEFAULT_RUNNING_MAT_FIXTURE,
  KNEE_LIFT_MAT_FIXTURE,
  SIDE_STEP_LEFT_MAT_FIXTURE,
};

export class RunningMatRenderer {
  private readonly config: RunningMatConfig;
  private _hitFlashTimer = 0;
  private _lastElapsedTime = 0;
  private _presentationContext?: RunningMatPresentationContext;
  public readonly motionNoteRenderer: MotionNoteRenderer;

  constructor(
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    motionNoteRenderer?: MotionNoteRenderer,
    presentationContext?: RunningMatPresentationContext,
  ) {
    this.config = config;
    this.motionNoteRenderer = motionNoteRenderer ?? this._createMotionNoteRenderer();
    if (presentationContext) this._presentationContext = presentationContext;
  }

  setPresentationContext(context?: RunningMatPresentationContext): void {
    this._presentationContext = context;
  }

  getPresentationContext(): RunningMatPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  isSlotLocked(slotId: string): boolean {
    return RunningMatGeometry.isSlotLocked(slotId);
  }

  getSlotLockReason(slotId: string): string | null {
    return RunningMatGeometry.getSlotLockReason(slotId);
  }

  validatePresentationContext(
    context?: RunningMatPresentationContext,
  ): { valid: boolean; issues: string[] } {
    return RunningMatGeometry.validatePresentationContext(context);
  }

  getEffectiveSlotOverride(slotId: string): RunningMatSlotOverride | undefined {
    return RunningMatGeometry.getEffectiveSlotOverride(slotId, this._presentationContext);
  }

  getRunningMatBounds(width: number, height: number): RunningMatBounds {
    return RunningMatGeometry.getRunningMatBounds(width, height, this.config);
  }

  getStrikeLineBounds(width: number, height: number): RunningMatBounds {
    return RunningMatGeometry.getStrikeLineBounds(width, height, this.config);
  }

  getLaneAnchorBounds(
    lane: 'left' | 'center' | 'right' | 9 | 10 | 11,
    width: number,
    height: number,
  ): RunningMatBounds {
    return RunningMatGeometry.getLaneAnchorBounds(lane, width, height, this.config);
  }

  getStatusHeaderBounds(width: number, height: number): RunningMatBounds {
    return RunningMatGeometry.getStatusHeaderBounds(width, height, this.config, this._presentationContext);
  }

  getUpcomingPreviewsBounds(width: number, height: number): RunningMatBounds {
    return RunningMatGeometry.getUpcomingPreviewsBounds(width, height, this.config, this._presentationContext);
  }

  getFootprintSlotBounds(
    slot: 'left' | 'right' | 'center' | 'leftHome' | 'rightHome',
    width: number,
    height: number,
  ): RunningMatBounds {
    return RunningMatGeometry.getFootprintSlotBounds(slot, width, height, this.config);
  }

  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'running_question',
  ): RunningMatPresentationContext {
    return RunningMatGeometry.fromPresentationDocument(doc, pageId);
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dto?: RunningMatFixtureDTO,
    optionsOrVP?: { x: number; y: number } | RunningMatRenderOptions,
  ): void {
    const prevContext = this._presentationContext;
    if (dto?.presentationContext) this._presentationContext = dto.presentationContext;
    try {
      const viewModel = RunningMatGeometry.createViewModelFromFixture(dto);
      const isVp = typeof optionsOrVP === 'object' && optionsOrVP && 'x' in optionsOrVP;
      const optsObj = !isVp ? (optionsOrVP as RunningMatRenderOptions) : undefined;
      const opts: RunningMatRenderOptions = {
        ...optsObj,
        elapsedTime: dto?.elapsedTime ?? optsObj?.elapsedTime ?? 0,
        beatProgress: dto?.beatProgress ?? optsObj?.beatProgress ?? 0,
        deltaTime: dto?.deltaTime ?? optsObj?.deltaTime,
        vanishingPoint: dto?.vanishingPoint ?? (isVp ? (optionsOrVP as { x: number; y: number }) : optsObj?.vanishingPoint),
      };
      this.render(ctx, viewModel, width, height, opts);
    } finally {
      this._presentationContext = prevContext;
    }
  }

  static renderFixture(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dto?: RunningMatFixtureDTO,
    optionsOrVP?: { x: number; y: number } | RunningMatRenderOptions,
  ): void {
    const renderer = new RunningMatRenderer();
    renderer.renderFixture(ctx, width, height, dto, optionsOrVP);
  }

  /**
   * RunningMatRenderer용 기본 MotionNoteRenderer 인스턴스 생성
   */
  private _createMotionNoteRenderer(): MotionNoteRenderer {
    const stompProfile: NoteVisualProfile = {
      ...STOMP_FOOT_PROFILE,
      flight: {
        ...STOMP_FOOT_PROFILE.flight,
        minScale: this.config.stompNoteMinScale ?? STOMP_FOOT_PROFILE.flight.minScale,
        maxScale: this.config.stompNoteMaxScale ?? STOMP_FOOT_PROFILE.flight.maxScale,
      },
      body: {
        ...STOMP_FOOT_PROFILE.body,
        baseRadius: this.config.stompNoteRadius ?? STOMP_FOOT_PROFILE.body.baseRadius,
        symbol: this.config.stompNoteSymbol ?? STOMP_FOOT_PROFILE.body.symbol,
      },
    };
    return new MotionNoteRenderer({
      profiles: {
        ...DEFAULT_NOTE_PROFILES,
        stomp_foot: stompProfile,
      },
    });
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
    if (view && view.visible === false) return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

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

    const { vx, vy, yTop, yBottom, halfWBottom } = RunningMatGeometry.computeMatTrapezoid(
      width,
      height,
      this.config,
      vp
    );

    // 0. 매트 원근 반투명 셀 및 테두리 렌더링
    this._renderMatCells(ctx, vx, vy, yTop, yBottom, halfWBottom);

    // 1. 초고휘도 네온 글로우 발 판정선(Foot Strike Line) 및 3대 레인 타깃 앵커 렌더링 (Issue #421, #422, #426)
    const yStrike = this.computeStrikeLineY(height);
    this._renderFootStrikeLine(
      ctx, view, vx, yStrike, width, halfWBottom, elapsedTime, beatProgress
    );

    // 2. view가 null이면 앰비언트 모드로 판정선만 렌더링하고 러닝 동작 큐(발자국/화살표)는 생략
    if (!view) return;

    // 3. 소실점에서 판정선 3대 레인으로 날아오는 발 리듬 비트 노트 렌더링 (Issue #425, #482 / MRN-08)
    this._renderFlyingStompNotes(ctx, view, vx, vy, width, height);

    // 4. 발자국 슬롯 좌표 계산 (3대 레인 및 yStrike 판정선 정렬)
    const slots = this._computeSlotCoordinates(
      vx, vy, yTop, yBottom, halfWBottom, width, yStrike
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
   * 매트 원근 반투명 셀 및 테두리 렌더링
   */
  private _renderMatCells(
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    yTop: number,
    yBottom: number,
    halfWBottom: number,
  ): void {
    const override = this._presentationContext?.matVisual;
    const borderColor = override?.borderColor ?? this.config.cellBorderColor;
    const borderWidth = override?.borderWidth ?? 1.5;
    const bgColor = override?.backgroundColor ?? this.config.cellBgColor;
    const halfWTop = halfWBottom * Math.max(0.1, (yTop - vy) / Math.max(1, yBottom - vy));

    ctx.beginPath();
    ctx.moveTo(vx - halfWTop, yTop);
    ctx.lineTo(vx + halfWTop, yTop);
    ctx.lineTo(vx + halfWBottom, yBottom);
    ctx.lineTo(vx - halfWBottom, yBottom);
    ctx.closePath();

    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fill();
    }
    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
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
    const geom = RunningMatGeometry.computeStrikeLineGeometry(
      width,
      yStrike / (this.config.strikeLineYRatio ?? 0.88),
      this.config,
      { x: vx, y: yStrike }
    );
    const { xStart, xEnd } = geom;

    // 0. Idle / Breath 부드러운 호흡 알파 진동 (60fps 기반)
    const breathSpeed = this.config.strikeBreathSpeed ?? 2.5;
    const breathAlpha = 0.88 + 0.12 * Math.sin((elapsedTime ?? 0) * breathSpeed);

    // 1. 듀얼 네온 블러(shadowBlur 20~25px, shadowColor #FF6600) 적용 (Issue #426)
    ctx.shadowBlur = this.config.strikeAuraShadowBlur ?? 22;
    ctx.shadowColor = this._presentationContext?.strikeLine?.glowColor ?? this.config.strikeAuraShadowColor ?? '#FF6600';

    const drawHLine = (y: number, stroke: string | CanvasGradient, lineWidth: number, alpha = 1.0) => {
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      if (alpha !== 1.0) ctx.globalAlpha = alpha;
      ctx.stroke();
      if (alpha !== 1.0) ctx.globalAlpha = 1.0;
    };

    // 2. 3중 네온 글로우 수평 판정선 (오렌지-골드 블렌드 네온)
    drawHLine(yStrike, this.config.strikeOuterColor, this.config.strikeOuterGlowWidth, breathAlpha * 0.9);
    drawHLine(yStrike, 'rgba(255, 183, 3, 0.65)', this.config.strikeInnerGlowWidth * 1.8, breathAlpha);
    drawHLine(yStrike, this.config.strikeInnerColor, this.config.strikeInnerGlowWidth);

    // (4) Core Line: 3px 두께의 선명한 네온 골드·주황 그라데이션 (#FFB800 ~ #FF8800)
    const coreGrad = typeof ctx.createLinearGradient === 'function'
      ? ctx.createLinearGradient(xStart, yStrike, xEnd, yStrike)
      : null;
    if (coreGrad) {
      coreGrad.addColorStop(0, this.config.strikeCoreGradientEnd ?? '#FF8800');
      coreGrad.addColorStop(0.25, this.config.strikeCoreGradientStart ?? '#FFB800');
      coreGrad.addColorStop(0.5, '#FFFFFF');
      coreGrad.addColorStop(0.75, this.config.strikeCoreGradientStart ?? '#FFB800');
      coreGrad.addColorStop(1, this.config.strikeCoreGradientEnd ?? '#FF8800');
    }
    drawHLine(yStrike, coreGrad ?? this.config.strikeCoreColor, this.config.strikeCoreLineWidth);

    // 3. Beat Pulse: BGM 비트 타이밍마다 중심에서 상방으로 2배 강렬하게 퍼지는 빛 파동 (Issue #426 강화)
    if (beatProgress !== undefined && beatProgress >= 0 && beatProgress <= 0.55) {
      const pulseP = beatProgress / 0.55;
      const waveAlpha = (1.0 - pulseP);
      const waveY1 = yStrike - 72 * Math.pow(pulseP, 0.65);
      const waveY2 = yStrike - 38 * Math.pow(pulseP, 0.65);

      drawHLine(waveY2, '#FF6600', Math.max(3, 14.0 * (1.0 - pulseP)), waveAlpha * 0.65);
      drawHLine(waveY1, '#FFE066', Math.max(2, 7.5 * (1.0 - pulseP)), waveAlpha * 0.95);

      const waveW = halfWBottom * (1.0 + pulseP * 0.35);
      ctx.beginPath();
      ctx.moveTo(vx - waveW, yStrike);
      ctx.lineTo(vx + waveW, yStrike);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = Math.max(1, 4 * (1.0 - pulseP));
      ctx.globalAlpha = waveAlpha * 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      const anchorXs = [
        vx + (this.config.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left) * halfWBottom,
        vx + (this.config.laneOffsetCenter ?? DEFAULT_LANE_SLOT_OFFSETS.center) * halfWBottom,
        vx + (this.config.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right) * halfWBottom,
      ];
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
      drawHLine(yStrike, '#FF5500', this.config.strikeCoreLineWidth * 18.0, flashAlpha * 0.55);
      drawHLine(yStrike, '#FFD166', this.config.strikeCoreLineWidth * 10.0, flashAlpha * 0.85);
      drawHLine(yStrike, '#FFFFFF', this.config.strikeCoreLineWidth * 5.6, flashAlpha * 1.0);

      const burstZoneRatios = this.config.zoneLaneXRatios ?? DEFAULT_ZONE_LANE_X_RATIOS;
      const anchorXs = [
        vx + (burstZoneRatios.left - 0.5) * width,
        vx + (burstZoneRatios.center - 0.5) * width,
        vx + (burstZoneRatios.right - 0.5) * width,
      ];
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
    const baseRadius = this.config.targetAnchorRadius ?? 15;
    const isLeftActive = view ? (view.currentCue?.leftFootSlot === 'out' || view.actionText.includes('왼')) : false;
    const isRightActive = view ? (view.currentCue?.rightFootSlot === 'out' || view.actionText.includes('오른')) : false;
    const isCenterActive = view ? (!isLeftActive && !isRightActive) : false;

    const isLeftNext = view?.nextCue ? (view.nextCue.leftFootSlot === 'out' || (view.nextCue.actionText?.includes('왼') ?? false)) : false;
    const isRightNext = view?.nextCue ? (view.nextCue.rightFootSlot === 'out' || (view.nextCue.actionText?.includes('오른') ?? false)) : false;
    const isCenterNext = view?.nextCue ? (!isLeftNext && !isRightNext) : false;

    const anchors = [
      {
        id: 'left',
        x: geom.leftAnchorX,
        y: yStrike,
        label: 'LEFT (Z9)',
        isActive: isLeftActive,
        isNext: isLeftNext,
      },
      {
        id: 'center',
        x: geom.centerAnchorX,
        y: yStrike,
        label: 'HOME (Z10)',
        isActive: isCenterActive,
        isNext: isCenterNext,
      },
      {
        id: 'right',
        x: geom.rightAnchorX,
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
      const anchorTextScale = Math.max(0.5, Math.min(3.0, UI_LAYOUT.runningMat?.anchor?.textScale ?? UI_LAYOUT.runningMat?.textScale ?? 1.0));
      ctx.font = `bold ${Math.round(9 * anchorTextScale)}px sans-serif`;
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
   * 8박 문제 구간 동안 소실점에서 발 판정선 3대 레인으로 비행하는 발 리듬 비트 노트 렌더링 (Issue #425, MRN-08 #482)
   * MotionNoteRenderer에 위임하여 stomp_foot 프로필 규격에 맞추어 원형 링(Circle Ring) 및 오브 바디 렌더링 (#473 결함 해소)
   */
  private _renderFlyingStompNotes(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    vx: number,
    vy: number,
    width: number,
    height: number
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

    const renderItems: MotionNoteRenderItem[] = upcomingList.map((item, idx) => {
      const cue = item.cue;
      const isLeft = cue.leftFootSlot === 'out' || cue.directionText.includes('왼') || cue.actionText.includes('왼');
      const isRight = cue.rightFootSlot === 'out' || cue.directionText.includes('오른') || cue.actionText.includes('오른');
      const part: FloorPart = isLeft ? 'leftFoot' : isRight ? 'rightFoot' : 'centerFoot';
      const zoneId = isLeft ? 9 : isRight ? 11 : 10;

      return {
        id: cue.id || `stomp_${item.targetBeat}_${idx}`,
        requirements: [{ part, zoneId }],
        interaction: 'tap',
        profileId: 'stomp_foot',
        progress: Math.max(0, Math.min(1.0, item.progress)),
        timeToLanding: item.remainingBeats * 0.5,
      };
    });

    const floorLayout: FloorLayoutOptions = {
      strikeLineYRatio: this.config.strikeLineYRatio,
      widthRatio: this.config.widthRatio,
      maxNarrowWidthRatio: this.config.maxNarrowWidthRatio,
      laneOffset: this.config.laneOffsetRight ?? DEFAULT_LANE_OFFSET,
      zoneLaneXRatios: this.config.zoneLaneXRatios ?? DEFAULT_ZONE_LANE_X_RATIOS,
      stompNoteRadius: this.config.stompNoteRadius,
      vanishingPoint: { x: vx, y: vy },
      vanishingX: vx,
    };

    // 네이티브 CanvasRenderingContext2D를 직접 전달하여 WebIDL Illegal invocation 원천 방지 (Issue #492)
    // RunningMatRenderer.render의 단일 save/restore 계약 및 MotionNoteRenderer 내부의 상태 보존 활용
    this.motionNoteRenderer.render(
      ctx,
      renderItems,
      { width, height },
      { x: vx, y: vy },
      undefined,
      floorLayout
    );

    // 캔버스 상태 안전 복원
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }

  /**
   * 판정선 Y 좌표 산출 (NoteAnchorResolver 단일 공식 연동)
   */
  public computeStrikeLineY(height: number): number {
    return RunningMatGeometry.computeStrikeLineY(height, this.config);
  }

  /**
   * 반응형 러닝 매트 바닥 반폭(halfWBottom) 산출 (NoteAnchorResolver 단일 공식 연동)
   */
  public computeMatHalfWBottom(width: number, height: number): number {
    return RunningMatGeometry.computeMatHalfWBottom(width, height, this.config);
  }

  /**
   * 3대 레인(-0.45, 0.0, +0.45) 및 판정선 Y(yStrike)에 일치하는 발자국 슬롯 좌표 계산 (Issue #494 / LANE-SYNC-01)
   */
  public computeSlotCoordinates(
    vx: number,
    vy: number,
    _yTop: number,
    yBottom: number,
    halfWBottom: number,
    width: number,
    yStrike?: number
  ): FootprintSlotCoords {
    return this._computeSlotCoordinates(vx, vy, _yTop, yBottom, halfWBottom, width, yStrike);
  }

  public _computeSlotCoordinates(
    vx: number,
    vy: number,
    _yTop: number,
    yBottom: number,
    halfWBottom: number,
    width: number,
    yStrike?: number
  ): FootprintSlotCoords {
    return RunningMatGeometry.computeSlotCoordinates(
      vx, vy, _yTop, yBottom, halfWBottom, width, yStrike, this.config
    );
  }

  /**
   * 기본 Home 발자국 슬롯 (중앙 좌/우 휴식 발판)
   */
  private _renderHomeBaseSlots(
    ctx: CanvasRenderingContext2D,
    slots: FootprintSlotCoords
  ): void {
    const fps = RunningMatGeometry.computeHomeBaseFootprints(slots);
    for (const fp of fps) {
      this._drawFootprint(ctx, fp.x, fp.y, fp.w, fp.h, fp.isLeft, fp.style);
    }
  }

  /**
   * 현재(currentCue) 및 다음(nextCue) 발자국 렌더링
   */
  private _renderActiveFootprints(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    slots: FootprintSlotCoords
  ): void {
    const fps = RunningMatGeometry.computeActiveFootprints(view, slots);
    for (const fp of fps) {
      this._drawFootprint(ctx, fp.x, fp.y, fp.w, fp.h, fp.isLeft, fp.style);
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
    let fill = this.config.footHomeFill;
    let stroke = this.config.footHomeStroke;
    let strokeWidth = 1.2;
    let txtColor = 'rgba(255, 255, 255, 0.6)';

    if (style === 'current') {
      fill = this.config.footCurrentFill;
      stroke = this.config.footCurrentStroke;
      strokeWidth = 2.5;
      txtColor = '#061727';
    } else if (style === 'next') {
      fill = this.config.footNextFill;
      stroke = this.config.preview1StrokeColor || this.config.footNextStroke;
      strokeWidth = this.config.preview1LineWidth || 2.0;
      txtColor = this.config.footNextStroke;
    } else if (style === 'preview2') {
      fill = 'rgba(255, 203, 77, 0.08)';
      stroke = this.config.preview2StrokeColor || 'rgba(255, 203, 77, 0.45)';
      strokeWidth = this.config.preview2LineWidth || 1.5;
    }

    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();

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
    const footTextScale = Math.max(0.5, Math.min(3.0, UI_LAYOUT.runningMat?.footprint?.textScale ?? UI_LAYOUT.runningMat?.textScale ?? 1.0));
    ctx.font = `bold ${Math.round(11 * footTextScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = txtColor;
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
    const scale = this.config.nextRingMinScale + (this.config.nextRingMaxScale - this.config.nextRingMinScale) * ringRatio;
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

    const ringTextScale = Math.max(0.5, Math.min(3.0, UI_LAYOUT.runningMat?.footprint?.textScale ?? UI_LAYOUT.runningMat?.textScale ?? 1.0));
    ctx.font = `bold ${Math.round(10 * ringTextScale)}px sans-serif`;
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
    return RunningMatGeometry.resolveNextTargetPoint(view, slots);
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
    const layout = RunningMatGeometry.computeDirectionArrowLayout(
      view,
      slots,
      yTop,
      yBottom,
      this.config
    );
    if (!layout) return;

    ctx.font = layout.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = layout.color;
    ctx.fillText(layout.text, layout.x, layout.y);
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
    const headerLayout = UI_LAYOUT.runningMat?.header;
    const textOffsetY = headerLayout?.textOffsetY ?? -14;
    const headerY = headerLayout?.textY !== undefined ? headerLayout.textY : (yTop + textOffsetY);
    const headerOverride = this._presentationContext?.statusHeader;

    let badgeText = headerOverride?.text ?? `${view.actionText}${view.cueText ? ` · ${view.cueText}` : ''}`;
    let badgeColor = headerOverride?.color ?? this.config.textPrimaryColor;

    if (!headerOverride?.text) {
      if (view.isShortage) {
        badgeText = `[부족] ${view.actionText} (중앙 운동 연장!)`;
        badgeColor = this.config.textShortageColor;
      } else if (view.isPreparing) {
        badgeText = `[준비] ${view.actionText} (정답 존 대기)`;
        badgeColor = this.config.textPrepareColor;
      }
    }

    const baseTextScale = Math.max(0.5, Math.min(3.0, headerLayout?.textScale ?? UI_LAYOUT.runningMat?.textScale ?? 1.0));
    const badgeTextScale = Math.max(0.5, Math.min(3.0, headerLayout?.badgeTextScale ?? baseTextScale));
    const countTextScale = Math.max(0.5, Math.min(3.0, headerLayout?.countTextScale ?? baseTextScale));

    ctx.font = `bold ${Math.round(14 * badgeTextScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, vx, headerY);

    ctx.font = `bold ${Math.round(12 * countTextScale)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.config.textSecondaryColor;
    ctx.fillText(`인정: ${view.acceptedExerciseCount} / ${view.requiredExerciseCount} 회`, width * 0.94, headerY);
  }

  /**
   * 다음 두 박 예고 및 현재 동작 플로우 렌더링 (Issue #408)
   */
  private _renderUpcomingPreviews(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    vx: number,
    yTop: number,
    width: number
  ): void {
    const layout = RunningMatGeometry.computeUpcomingPreviewLayout(
      view,
      vx,
      yTop,
      width,
      this.config
    );
    const { nodes, previewTextScale } = layout;

    for (const node of nodes) {
      const { x: nx, y: previewY, width: nodeWidth, height: nodeHeight } = node;

      ctx.beginPath();
      ctx.moveTo(nx, previewY);
      ctx.lineTo(nx + nodeWidth, previewY);
      ctx.lineTo(nx + nodeWidth, previewY + nodeHeight);
      ctx.lineTo(nx, previewY + nodeHeight);
      ctx.closePath();

      let fill = 'rgba(255, 203, 77, 0.08)';
      let stroke = this.config.preview2StrokeColor || 'rgba(255, 203, 77, 0.45)';
      let lw = this.config.preview2LineWidth || 1.5;
      let labelFont = `${Math.round(11 * previewTextScale)}px sans-serif`;
      let labelColor = 'rgba(255, 203, 77, 0.75)';
      let txtFont = `${Math.round(10 * previewTextScale)}px sans-serif`;
      let txtColor = 'rgba(255, 255, 255, 0.75)';

      if (node.style === 'current') {
        fill = this.config.footCurrentFill;
        stroke = this.config.footCurrentStroke;
        labelFont = `bold ${Math.round(11 * previewTextScale)}px sans-serif`;
        labelColor = '#061325';
        txtFont = `bold ${Math.round(10 * previewTextScale)}px sans-serif`;
        txtColor = '#061325';
      } else if (node.style === 'preview1') {
        fill = 'rgba(255, 203, 77, 0.16)';
        stroke = this.config.preview1StrokeColor || '#FFCB4D';
        lw = this.config.preview1LineWidth || 2.5;
        labelFont = `bold ${Math.round(11 * previewTextScale)}px sans-serif`;
        labelColor = this.config.textAccentColor;
        txtColor = this.config.textPrimaryColor;
      }

      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.font = labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = labelColor;
      ctx.fillText(node.label, nx + nodeWidth * 0.28, previewY + nodeHeight * 0.5);

      ctx.font = txtFont;
      ctx.fillStyle = txtColor;
      ctx.fillText(node.displayTxt, nx + nodeWidth * 0.72, previewY + nodeHeight * 0.5);
    }
  }
}
