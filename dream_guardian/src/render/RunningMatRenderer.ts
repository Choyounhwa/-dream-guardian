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

export class RunningMatRenderer {
  private readonly config: RunningMatConfig;

  constructor(config: RunningMatConfig = RUNNING_MAT_CONFIG) {
    this.config = config;
  }

  /**
   * 러닝 매트 2D 캔버스 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel | null,
    width: number,
    height: number,
    vanishingPoint?: { x: number; y: number }
  ): void {
    // 1. 가드 체크: null view 또는 비가시 상태 시 즉시 생략
    if (!view || !view.visible) {
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
      this._renderInternal(ctx, view, width, height, vanishingPoint);
    } finally {
      ctx.restore();
    }
  }

  private _renderInternal(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    width: number,
    height: number,
    vanishingPoint?: { x: number; y: number }
  ): void {
    // 소실점 좌표 산출
    const vx = vanishingPoint?.x ?? width * 0.5;
    const vy = vanishingPoint?.y ?? height * this.config.vanishingYRatio;

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

    // 원근 수축 비율 (소실점 투영)
    const floorH = Math.max(1, yBottom - vy);
    const topSpread = Math.max(0.2, Math.min(1.0, (yTop - vy) / floorH));

    // 정규화 레인 좌표 (-1.0 ~ +1.0)
    // Left: [-1.0, -0.34], Center: [-0.34, +0.34], Right: [+0.34, +1.0]
    const uBounds = {
      leftMin: -1.0,
      leftMax: -0.34,
      centerMin: -0.34,
      centerMax: 0.34,
      rightMin: 0.34,
      rightMax: 1.0,
    };

    // 1. 좌/중앙/우 3개 반투명 원근 사다리꼴 셀 렌더링
    this._renderPerspectiveCells(
      ctx,
      view,
      vx,
      yTop,
      yBottom,
      halfWBottom,
      topSpread,
      uBounds
    );

    // 2. 발자국 슬롯 좌표 계산
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
  }

  /**
   * 좌/중앙/우 3개 원근 사다리꼴 셀 렌더링
   */
  private _renderPerspectiveCells(
    ctx: CanvasRenderingContext2D,
    view: RunningMatViewModel,
    vx: number,
    yTop: number,
    yBottom: number,
    halfWBottom: number,
    topSpread: number,
    uBounds: {
      leftMin: number;
      leftMax: number;
      centerMin: number;
      centerMax: number;
      rightMin: number;
      rightMax: number;
    }
  ): void {
    const isLeftActive = view.currentCue?.leftFootSlot === 'out';
    const isRightActive = view.currentCue?.rightFootSlot === 'out';
    const isLeftNext = view.nextCue?.leftFootSlot === 'out';
    const isRightNext = view.nextCue?.rightFootSlot === 'out';

    const cells = [
      {
        name: 'left',
        uMin: uBounds.leftMin,
        uMax: uBounds.leftMax,
        isActive: isLeftActive,
        isNext: isLeftNext,
        label: 'LEFT',
      },
      {
        name: 'center',
        uMin: uBounds.centerMin,
        uMax: uBounds.centerMax,
        isActive: !isLeftActive && !isRightActive,
        isNext: !isLeftNext && !isRightNext,
        label: 'HOME',
      },
      {
        name: 'right',
        uMin: uBounds.rightMin,
        uMax: uBounds.rightMax,
        isActive: isRightActive,
        isNext: isRightNext,
        label: 'RIGHT',
      },
    ];

    for (const cell of cells) {
      const xTop0 = vx + cell.uMin * halfWBottom * topSpread;
      const xTop1 = vx + cell.uMax * halfWBottom * topSpread;
      const xBottom1 = vx + cell.uMax * halfWBottom;
      const xBottom0 = vx + cell.uMin * halfWBottom;

      ctx.beginPath();
      ctx.moveTo(xTop0, yTop);
      ctx.lineTo(xTop1, yTop);
      ctx.lineTo(xBottom1, yBottom);
      ctx.lineTo(xBottom0, yBottom);
      ctx.closePath();

      // 반투명 배경 채우기
      if (cell.isActive) {
        ctx.fillStyle = this.config.cellActiveBgColor;
      } else if (cell.isNext) {
        ctx.fillStyle = this.config.cellNextBgColor;
      } else {
        ctx.fillStyle = this.config.cellBgColor;
      }
      ctx.fill();

      // 테두리 스트로크
      if (cell.isActive) {
        ctx.strokeStyle = this.config.cellBorderActiveColor;
        ctx.lineWidth = this.config.cellLineWidth * 1.5;
      } else if (cell.isNext) {
        ctx.strokeStyle = this.config.cellBorderNextColor;
        ctx.lineWidth = this.config.cellLineWidth * 1.2;
      } else {
        ctx.strokeStyle = this.config.cellBorderColor;
        ctx.lineWidth = this.config.cellLineWidth;
      }
      ctx.stroke();

      // 셀 바닥 접근성 라벨
      const labelX = (xBottom0 + xBottom1) * 0.5;
      const labelY = yBottom - 6;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(cell.label, labelX, labelY);
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
    style: 'home' | 'current' | 'next'
  ): void {
    const rx = w * 0.5;
    const ry = h * 0.5;

    const isDashed = style === 'next' && typeof ctx.setLineDash === 'function';
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
      ctx.strokeStyle = this.config.footNextStroke;
      ctx.lineWidth = 2.0;
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
      ctx.fillStyle = this.config.arrowActiveColor;
      ctx.fillText('▲ ▲ 바운스 업 ▲ ▲', centerX, arrowY);
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
}
