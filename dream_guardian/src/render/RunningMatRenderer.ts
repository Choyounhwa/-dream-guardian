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
  DEFAULT_STRIKE_OVERHANG_RATIO,
  DEFAULT_LANE_SLOT_OFFSETS,
  DEFAULT_MAT_BASE_Y_TOP,
  DEFAULT_MAT_BASE_Y_BOTTOM,
  type RunningMatConfig,
} from '../../config/running-mat.config.js';
import type { RunningMatViewModel } from './RunningMatPresenter.js';
import { MotionNoteRenderer } from './MotionNoteRenderer.js';
import type { FloorPart, MotionNoteRenderItem } from '../types/motion-note.js';
import {
  type UIPresentationDocument,
  type UIPresentationPageId,
  DEFAULT_PROTECTED_ZONES,
} from '../data/UIPresentation.js';
import {
  DEFAULT_NOTE_PROFILES,
  STOMP_FOOT_PROFILE,
  type NoteVisualProfile,
} from '../../config/motion-note-profile.config.js';
import {
  DEFAULT_LANE_OFFSET,
  computeMatHalfWBottom,
  computeStrikeLineY,
  type FloorLayoutOptions,
} from './NoteAnchorResolver.js';

interface Point2D {
  x: number;
  y: number;
}

export interface RunningMatBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface RunningMatSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  text?: string;
  fontSize?: number;
  visible?: boolean;
  glowColor?: string;
}

export interface RunningMatPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  matVisual?: RunningMatSlotOverride;
  strikeLine?: RunningMatSlotOverride;
  statusHeader?: RunningMatSlotOverride;
  upcomingPreview?: RunningMatSlotOverride;
  footprintSlots?: RunningMatSlotOverride;
  targetAnchors?: RunningMatSlotOverride;
  vanishingPoint?: { x?: number; y?: number };
}

export const RUNNING_MAT_SLOT_IDS = [
  'matVisual',
  'strikeLine',
  'statusHeader',
  'upcomingPreview',
  'zone_9_mat_cell',
  'zone_10_mat_cell',
  'zone_11_mat_cell',
  'strike_line_geometry',
  'vanishing_point_geometry',
  'footprint_slot_left',
  'footprint_slot_center',
  'footprint_slot_right',
  'target_anchors',
] as const;

export const PROTECTED_RUNNING_MAT_SLOT_IDS = [
  'zone_9_mat_cell',
  'zone_10_mat_cell',
  'zone_11_mat_cell',
  'strike_line_geometry',
  'vanishing_point_geometry',
  'footprint_slot_left',
  'footprint_slot_center',
  'footprint_slot_right',
  'target_anchors',
] as const;

export interface RunningMatFixtureDTO {
  viewModel?: Partial<RunningMatViewModel> | null;
  view?: Partial<RunningMatViewModel> | null;
  beatIndex?: number;
  beatProgress?: number;
  actionText?: string;
  cueText?: string;
  currentActionId?: string;
  currentFootSlot?: 'left' | 'right' | 'center' | 'out' | 'home';
  nextActionId?: string;
  nextFootSlot?: 'left' | 'right' | 'center' | 'out' | 'home';
  elapsedTime?: number;
  deltaTime?: number;
  vanishingPoint?: { x: number; y: number };
  presentationContext?: RunningMatPresentationContext;
}

export const DEFAULT_RUNNING_MAT_FIXTURE: RunningMatFixtureDTO = Object.freeze({
  actionText: '제자리 달리기',
  cueText: '쿵 짝 리듬 스텝',
  currentActionId: 'step_left',
  currentFootSlot: 'left',
  nextActionId: 'step_right',
  nextFootSlot: 'right',
  beatIndex: 1,
  beatProgress: 0.25,
});

export const KNEE_LIFT_MAT_FIXTURE: RunningMatFixtureDTO = Object.freeze({
  actionText: '무릎 높이 들기',
  cueText: '무릎을 가슴까지 업!',
  currentActionId: 'knee_left',
  currentFootSlot: 'left',
  nextActionId: 'knee_right',
  nextFootSlot: 'right',
  beatIndex: 3,
  beatProgress: 0.5,
});

export const SIDE_STEP_LEFT_MAT_FIXTURE: RunningMatFixtureDTO = Object.freeze({
  actionText: '왼발 사이드 스텝',
  cueText: '왼쪽 발판 딛기',
  currentActionId: 'side_step_left',
  currentFootSlot: 'left',
  nextActionId: 'center_return',
  nextFootSlot: 'center',
  beatIndex: 5,
  beatProgress: 0.75,
});

export interface FootprintSlotCoords {
  readonly left: Point2D;
  readonly center: Point2D;
  readonly right: Point2D;
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
  private _presentationContext?: RunningMatPresentationContext;
  public readonly motionNoteRenderer: MotionNoteRenderer;

  constructor(
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    motionNoteRenderer?: MotionNoteRenderer,
    presentationContext?: RunningMatPresentationContext,
  ) {
    this.config = config;
    this.motionNoteRenderer =
      motionNoteRenderer ?? this._createMotionNoteRenderer();
    if (presentationContext) {
      this._presentationContext = presentationContext;
    }
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
    return (PROTECTED_RUNNING_MAT_SLOT_IDS as readonly string[]).includes(slotId as any);
  }

  getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return '발판 중심 좌표(Zone 9/10/11 대응) 및 판정선(strike line), 원근 소실점은 인게임 모션 인식 및 리듬 판정의 핵심 보호 영역으로 위치 및 크기 변경이 원자적으로 잠겨 있습니다.';
    }
    return null;
  }

  validatePresentationContext(
    context?: RunningMatPresentationContext,
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!context) return { valid: true, issues };

    if (context.strikeLine?.y !== undefined || context.strikeLine?.x !== undefined) {
      issues.push('판정선(strike line)의 물리 좌표는 수정할 수 없습니다.');
    }
    if (context.footprintSlots?.x !== undefined || context.footprintSlots?.y !== undefined) {
      issues.push('발판 슬롯 물리 좌표(Zone 9/10/11)는 수정할 수 없습니다.');
    }
    if (context.targetAnchors?.x !== undefined || context.targetAnchors?.y !== undefined) {
      issues.push('타깃 앵커 물리 좌표는 수정할 수 없습니다.');
    }
    if (context.vanishingPoint?.x !== undefined || context.vanishingPoint?.y !== undefined) {
      issues.push('원근 소실점 좌표는 보호 영역입니다.');
    }
    return { valid: issues.length === 0, issues };
  }

  getRunningMatBounds(width: number, height: number): RunningMatBounds {
    const yTop = height * (this.config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const yBottom = height * (this.config.baseYBottom ?? DEFAULT_MAT_BASE_Y_BOTTOM);
    const halfW = this.computeMatHalfWBottom(width, height);
    const w = halfW * 2;
    const x = (width - w) / 2;
    const h = yBottom - yTop;
    return {
      x,
      y: yTop,
      w,
      h,
      width: w,
      height: h,
      isProtected: true,
    };
  }

  getStrikeLineBounds(width: number, height: number): RunningMatBounds {
    const yStrike = this.computeStrikeLineY(height);
    const overhang = width * (this.config.strikeOverhangRatio ?? DEFAULT_STRIKE_OVERHANG_RATIO);
    const w = width + overhang * 2;
    const x = -overhang;
    const h = 40;
    const y = yStrike - h / 2;
    return {
      x,
      y,
      w,
      h,
      width: w,
      height: h,
      isProtected: true,
    };
  }

  getLaneAnchorBounds(
    lane: 'left' | 'center' | 'right' | 9 | 10 | 11,
    width: number,
    height: number,
  ): RunningMatBounds {
    const vx = width * 0.5;
    const yStrike = this.computeStrikeLineY(height);
    const halfWBottom = this.computeMatHalfWBottom(width, height);
    let offset = 0;
    if (lane === 'left' || lane === 9) {
      offset = (this.config.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left) * halfWBottom;
    } else if (lane === 'right' || lane === 11) {
      offset = (this.config.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right) * halfWBottom;
    } else {
      offset = (this.config.laneOffsetCenter ?? DEFAULT_LANE_SLOT_OFFSETS.center) * halfWBottom;
    }
    const anchorX = vx + offset;
    const radius = this.config.targetAnchorRadius ?? 15;
    return {
      x: anchorX,
      y: yStrike,
      w: radius * 2,
      h: radius * 2,
      width: radius * 2,
      height: radius * 2,
      isProtected: true,
    };
  }

  getStatusHeaderBounds(width: number, height: number): RunningMatBounds {
    const vx = width * 0.5;
    const yTop = height * (this.config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const w = Math.min(width * 0.8, 480);
    const h = 40;
    const x = vx - w / 2;
    const y = yTop - 48;
    const override = this._presentationContext?.statusHeader;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  getUpcomingPreviewsBounds(width: number, height: number): RunningMatBounds {
    const vx = width * 0.5;
    const yTop = height * (this.config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const w = Math.min(width * 0.8, 420);
    const h = 30;
    const x = vx - w / 2;
    const y = yTop - 48;
    const override = this._presentationContext?.upcomingPreview;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'running_question',
  ): RunningMatPresentationContext {
    const page = doc.pages[pageId as UIPresentationPageId];
    let strikeLine: RunningMatSlotOverride | undefined;
    let matVisual: RunningMatSlotOverride | undefined;
    let statusHeader: RunningMatSlotOverride | undefined;

    const protectedZone = DEFAULT_PROTECTED_ZONES.find(
      (z) => z.id === 'floor_strike_line_run' || z.id.includes('strike_line'),
    );
    if (protectedZone) {
      strikeLine = {
        glowColor: '#FF6600',
      };
    }

    if (page?.elements) {
      for (const el of page.elements) {
        if (el.id === 'run_header') {
          statusHeader = {
            text: el.text,
          };
        }
      }
    }

    return {
      presentationDocument: doc,
      pageId,
      strikeLine: strikeLine ?? { glowColor: '#FF6600' },
      matVisual,
      statusHeader,
    };
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dto?: RunningMatFixtureDTO,
    optionsOrVP?: { x: number; y: number } | RunningMatRenderOptions,
  ): void {
    const prevContext = this._presentationContext;
    if (dto?.presentationContext) {
      this._presentationContext = dto.presentationContext;
    }
    try {
      const viewModel: RunningMatViewModel = {
        visible: dto?.view?.visible ?? dto?.viewModel?.visible ?? true,
        paused: dto?.view?.paused ?? dto?.viewModel?.paused ?? false,
        actionText: dto?.actionText ?? dto?.view?.actionText ?? dto?.viewModel?.actionText ?? '제자리 달리기',
        directionText: dto?.view?.directionText ?? dto?.viewModel?.directionText ?? '앞으로',
        cueText: dto?.cueText ?? dto?.view?.cueText ?? dto?.viewModel?.cueText ?? '',
        arrowDirection: dto?.view?.arrowDirection ?? dto?.viewModel?.arrowDirection ?? 'up',
        nextRingRatio: dto?.view?.nextRingRatio ?? dto?.viewModel?.nextRingRatio ?? 0.5,
        elapsedBeats: dto?.beatIndex ?? dto?.view?.elapsedBeats ?? dto?.viewModel?.elapsedBeats ?? 1,
        acceptedExerciseCount: dto?.view?.acceptedExerciseCount ?? dto?.viewModel?.acceptedExerciseCount ?? 0,
        requiredExerciseCount: dto?.view?.requiredExerciseCount ?? dto?.viewModel?.requiredExerciseCount ?? 8,
        isShortage: dto?.view?.isShortage ?? dto?.viewModel?.isShortage ?? false,
        isPreparing: dto?.view?.isPreparing ?? dto?.viewModel?.isPreparing ?? false,
        isReturnPhase: dto?.view?.isReturnPhase ?? dto?.viewModel?.isReturnPhase ?? false,
        phase: dto?.view?.phase ?? dto?.viewModel?.phase,
        currentCue: (dto?.currentActionId || dto?.currentFootSlot) ? {
          beatIndex: dto?.beatIndex ?? 1,
          actionId: dto?.currentActionId ?? 'step_left',
          actionText: dto?.actionText ?? '제자리 달리기',
          directionText: '앞으로',
          cueText: dto?.cueText ?? '',
          arrowDirection: 'up',
          leftFootSlot: (dto?.currentFootSlot === 'left' || dto?.currentFootSlot === 'out') ? 'out' : 'home',
          rightFootSlot: (dto?.currentFootSlot === 'right') ? 'out' : 'home',
          isPrepare: false,
        } : (dto?.view?.currentCue ?? dto?.viewModel?.currentCue ?? null),
        nextCue: (dto?.nextActionId || dto?.nextFootSlot) ? {
          beatIndex: (dto?.beatIndex ?? 1) + 1,
          actionId: dto?.nextActionId ?? 'step_right',
          actionText: dto?.nextActionId ?? '다음 동작',
          directionText: '앞으로',
          cueText: '',
          arrowDirection: 'up',
          leftFootSlot: (dto?.nextFootSlot === 'left') ? 'out' : 'home',
          rightFootSlot: (dto?.nextFootSlot === 'right' || dto?.nextFootSlot === 'out') ? 'out' : 'home',
          isPrepare: false,
        } : (dto?.view?.nextCue ?? dto?.viewModel?.nextCue ?? null),
        upcomingCues: dto?.view?.upcomingCues ?? dto?.viewModel?.upcomingCues ?? [],
      };

      const opts: RunningMatRenderOptions = {
        ...(typeof optionsOrVP === 'object' && optionsOrVP && 'vanishingPoint' in optionsOrVP ? optionsOrVP : {}),
        elapsedTime: dto?.elapsedTime ?? (typeof optionsOrVP === 'object' && optionsOrVP && 'elapsedTime' in optionsOrVP ? (optionsOrVP as RunningMatRenderOptions).elapsedTime : 0),
        beatProgress: dto?.beatProgress ?? (typeof optionsOrVP === 'object' && optionsOrVP && 'beatProgress' in optionsOrVP ? (optionsOrVP as RunningMatRenderOptions).beatProgress : 0),
        deltaTime: dto?.deltaTime,
        vanishingPoint: dto?.vanishingPoint ?? (typeof optionsOrVP === 'object' && optionsOrVP && 'x' in optionsOrVP ? (optionsOrVP as { x: number; y: number }) : undefined),
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

    // Y 범위 산출
    const yTop = height * this.config.baseYTop;
    const yBottom = height * this.config.baseYBottom;
    const halfWBottom = this.computeMatHalfWBottom(width, height);

    // 0. 매트 원근 반투명 셀 및 테두리 렌더링
    this._renderMatCells(ctx, vx, vy, yTop, yBottom, halfWBottom);

    // 1. 초고휘도 네온 글로우 발 판정선(Foot Strike Line) 및 3대 레인 타깃 앵커 렌더링 (Issue #421, #422, #426)
    const yStrike = this.computeStrikeLineY(height);
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

    // 3. 소실점에서 판정선 3대 레인으로 날아오는 발 리듬 비트 노트 렌더링 (Issue #425, #482 / MRN-08)
    this._renderFlyingStompNotes(ctx, view, vx, vy, width, height);

    // 4. 발자국 슬롯 좌표 계산 (3대 레인 및 yStrike 판정선 정렬)
    const slots = this._computeSlotCoordinates(
      vx,
      vy,
      yTop,
      yBottom,
      halfWBottom,
      width,
      yStrike
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

    const scaleTop = Math.max(0.1, (yTop - vy) / Math.max(1, (yBottom - vy)));
    const halfWTop = halfWBottom * scaleTop;

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
    const overhang = width * (this.config.strikeOverhangRatio ?? DEFAULT_STRIKE_OVERHANG_RATIO);
    const xStart = -overhang;
    const xEnd = width + overhang;

    // 0. Idle / Breath 부드러운 호흡 알파 진동 (60fps 기반)
    const breathSpeed = this.config.strikeBreathSpeed ?? 2.5;
    const breathAlpha = 0.88 + 0.12 * Math.sin((elapsedTime ?? 0) * breathSpeed);

    // 1. 듀얼 네온 블러(shadowBlur 20~25px, shadowColor #FF6600) 적용 (Issue #426)
    ctx.shadowBlur = this.config.strikeAuraShadowBlur ?? 22;
    ctx.shadowColor = this._presentationContext?.strikeLine?.glowColor ?? this.config.strikeAuraShadowColor ?? '#FF6600';

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
      const anchorXs = [
        vx + (this.config.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left) * halfWBottom,
        vx,
        vx + (this.config.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right) * halfWBottom,
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
    const isLeftActive = view ? (view.currentCue?.leftFootSlot === 'out' || view.actionText.includes('왼')) : false;
    const isRightActive = view ? (view.currentCue?.rightFootSlot === 'out' || view.actionText.includes('오른')) : false;
    const isCenterActive = view ? (!isLeftActive && !isRightActive) : false;

    const isLeftNext = view?.nextCue ? (view.nextCue.leftFootSlot === 'out' || (view.nextCue.actionText?.includes('왼') ?? false)) : false;
    const isRightNext = view?.nextCue ? (view.nextCue.rightFootSlot === 'out' || (view.nextCue.actionText?.includes('오른') ?? false)) : false;
    const isCenterNext = view?.nextCue ? (!isLeftNext && !isRightNext) : false;

    const baseRadius = this.config.targetAnchorRadius ?? 15;
    const leftAnchorX = vx + (this.config.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left) * halfWBottom;
    const centerAnchorX = vx;
    const rightAnchorX = vx + (this.config.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right) * halfWBottom;

    const anchors = [
      {
        id: 'left',
        x: leftAnchorX,
        y: yStrike,
        label: 'LEFT (Z9)',
        isActive: isLeftActive,
        isNext: isLeftNext,
      },
      {
        id: 'center',
        x: centerAnchorX,
        y: yStrike,
        label: 'HOME (Z10)',
        isActive: isCenterActive,
        isNext: isCenterNext,
      },
      {
        id: 'right',
        x: rightAnchorX,
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
      let part: FloorPart = 'centerFoot';
      let zoneId = 10;

      if (
        cue.leftFootSlot === 'out' ||
        cue.directionText.includes('왼') ||
        cue.actionText.includes('왼')
      ) {
        part = 'leftFoot';
        zoneId = 9;
      } else if (
        cue.rightFootSlot === 'out' ||
        cue.directionText.includes('오른') ||
        cue.actionText.includes('오른')
      ) {
        part = 'rightFoot';
        zoneId = 11;
      }

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
      laneOffsetLeft: this.config.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left,
      laneOffsetRight: this.config.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right,
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
    return computeStrikeLineY(height, this.config);
  }

  /**
   * 반응형 러닝 매트 바닥 반폭(halfWBottom) 산출 (NoteAnchorResolver 단일 공식 연동)
   */
  public computeMatHalfWBottom(width: number, height: number): number {
    return computeMatHalfWBottom(width, height, this.config);
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
    return this._computeSlotCoordinates(
      vx,
      vy,
      _yTop,
      yBottom,
      halfWBottom,
      width,
      yStrike
    );
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
    const laneOffsetLeft = this.config.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left;
    const laneOffsetRight = this.config.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right;
    const strikeY =
      yStrike ??
      this.computeStrikeLineY(
        yBottom > 0 ? yBottom / (this.config.baseYBottom ?? 0.94) : 0
      );

    const floorH = Math.max(1, yBottom - vy);
    const slotSpread = Math.max(0.2, (strikeY - vy) / floorH);
    const footWidth = Math.max(18, 28 * slotSpread * (width / 1080));
    const footHeight = footWidth * 1.8;

    // 3대 레인 기준 X 좌표: Left(Z9) = vx - 0.45 * halfWBottom, Center(Z10) = vx, Right(Z11) = vx + 0.45 * halfWBottom
    const leftX = vx + laneOffsetLeft * halfWBottom;
    const centerX = vx;
    const rightX = vx + laneOffsetRight * halfWBottom;

    // 중앙 홈 레인(Z10) 내 좌/우 홈 발자국 미세 이격 (중앙 레인 폭 내 자연스러운 홈 발판 스탠스)
    const homeSpread = Math.min(halfWBottom * 0.12, footWidth * (this.config.homeFootSpreadRatio ?? 0.55));
    const leftHomeX = vx - homeSpread;
    const rightHomeX = vx + homeSpread;

    const leftPoint: Point2D = { x: leftX, y: strikeY };
    const centerPoint: Point2D = { x: centerX, y: strikeY };
    const rightPoint: Point2D = { x: rightX, y: strikeY };
    const leftHomePoint: Point2D = { x: leftHomeX, y: strikeY };
    const rightHomePoint: Point2D = { x: rightHomeX, y: strikeY };

    return {
      left: leftPoint,
      center: centerPoint,
      right: rightPoint,
      leftOut: leftPoint,
      leftHome: leftHomePoint,
      rightHome: rightHomePoint,
      rightOut: rightPoint,
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

    const headerOverride = this._presentationContext?.statusHeader;
    // 1. 좌측 액션 배지 (Action / Cue Text)
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
