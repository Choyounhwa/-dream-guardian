/**
 * RunningMatGeometry.ts - 원근 러닝 매트 순수 3D 투영 및 슬롯 기하 계산기
 *
 * Issue #620 (REFACTOR-RENDER-002):
 * - 3D 사다리꼴 투영, 소실점(VP) 보정, 슬롯 좌표 계산(computeSlotCoordinates)
 * - 판정선 및 레인 앵커 기하 산출
 * - 슬롯 잠금/검증/오버라이드 및 시각 Bounds 계산 분리 격리
 */

import {
  RUNNING_MAT_CONFIG,
  DEFAULT_STRIKE_OVERHANG_RATIO,
  DEFAULT_ZONE_LANE_X_RATIOS,
  DEFAULT_MAT_BASE_Y_TOP,
  DEFAULT_MAT_BASE_Y_BOTTOM,
  DEFAULT_VANISHING_Y_RATIO,
  type RunningMatConfig,
} from '../../../config/running-mat.config.js';
import type { RunningMatViewModel } from '../RunningMatPresenter.js';
import {
  type UIPresentationDocument,
  type UIPresentationPageId,
  DEFAULT_PROTECTED_ZONES,
} from '../../data/UIPresentation.js';
import {
  computeMatHalfWBottom,
  computeStrikeLineY,
} from '../NoteAnchorResolver.js';
import { UI_LAYOUT } from '../../../config/ui.config.js';

import {
  type Point2D,
  type RunningMatBounds,
  type RunningMatSlotOverride,
  type RunningMatPresentationContext,
  type ProtectedRunningMatSlotId,
  type FootprintSlotCoords,
  type MatTrapezoid,
  type StrikeLineGeometry,
  type TargetAnchorItem,
  type FootprintItem,
  type DirectionArrowLayout,
  type UpcomingPreviewNode,
  type UpcomingPreviewLayout,
  type RunningMatFixtureDTO,
  type RunningMatRenderOptions,
  RUNNING_MAT_SLOT_IDS,
  PROTECTED_RUNNING_MAT_SLOT_IDS,
  DEFAULT_RUNNING_MAT_FIXTURE,
  KNEE_LIFT_MAT_FIXTURE,
  SIDE_STEP_LEFT_MAT_FIXTURE,
} from './RunningMatTypes.js';

export type {
  Point2D,
  RunningMatBounds,
  RunningMatSlotOverride,
  RunningMatPresentationContext,
  ProtectedRunningMatSlotId,
  FootprintSlotCoords,
  MatTrapezoid,
  StrikeLineGeometry,
  TargetAnchorItem,
  FootprintItem,
  DirectionArrowLayout,
  UpcomingPreviewNode,
  UpcomingPreviewLayout,
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

export class RunningMatGeometry {
  /**
   * 소실점(VP) 좌표 산출
   */
  static computeVanishingPoint(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    customVP?: { x: number; y: number }
  ): Point2D {
    return {
      x: customVP?.x ?? width * 0.5,
      y: customVP?.y ?? height * (config.vanishingYRatio ?? DEFAULT_VANISHING_Y_RATIO),
    };
  }

  /**
   * 판정선 Y 좌표 산출 (NoteAnchorResolver 단일 공식 연동)
   */
  static computeStrikeLineY(
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): number {
    return computeStrikeLineY(height, config);
  }

  /**
   * 반응형 러닝 매트 바닥 반폭(halfWBottom) 산출 (NoteAnchorResolver 단일 공식 연동)
   */
  static computeMatHalfWBottom(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): number {
    return computeMatHalfWBottom(width, height, config);
  }

  /**
   * 3D 원근 사다리꼴 기하 정보 산출
   */
  static computeMatTrapezoid(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    customVP?: { x: number; y: number }
  ): MatTrapezoid {
    const vp = this.computeVanishingPoint(width, height, config, customVP);
    const vx = vp.x;
    const vy = vp.y;
    const yTop = height * (config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const yBottom = height * (config.baseYBottom ?? DEFAULT_MAT_BASE_Y_BOTTOM);
    const halfWBottom = this.computeMatHalfWBottom(width, height, config);
    const scaleTop = Math.max(0.1, (yTop - vy) / Math.max(1, yBottom - vy));
    const halfWTop = halfWBottom * scaleTop;

    return {
      vx,
      vy,
      yTop,
      yBottom,
      halfWTop,
      halfWBottom,
      scaleTop,
      topLeft: { x: vx - halfWTop, y: yTop },
      topRight: { x: vx + halfWTop, y: yTop },
      bottomRight: { x: vx + halfWBottom, y: yBottom },
      bottomLeft: { x: vx - halfWBottom, y: yBottom },
    };
  }

  /**
   * 3대 레인(-0.45, 0.0, +0.45) 및 판정선 Y(yStrike)에 일치하는 발자국 슬롯 좌표 계산 (Issue #494 / LANE-SYNC-01)
   */
  static computeSlotCoordinates(
    vx: number,
    vy: number,
    _yTop: number,
    yBottom: number,
    halfWBottom: number,
    width: number,
    yStrike?: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): FootprintSlotCoords {
    const strikeY =
      yStrike ??
      this.computeStrikeLineY(
        yBottom > 0 ? yBottom / (config.baseYBottom ?? 0.94) : 0,
        config
      );

    const floorH = Math.max(1, yBottom - vy);
    const slotSpread = Math.max(0.2, (strikeY - vy) / floorH);
    const footWidth = Math.max(18, 28 * slotSpread * (width / 1080));
    const footHeight = footWidth * 1.8;

    // 3대 레인 기준 X 좌표 (Issue #499 [LANE-ALIGN-01]): Zone 9 (1/6), Zone 10 (1/2), Zone 11 (5/6)
    const zoneRatios = config.zoneLaneXRatios ?? DEFAULT_ZONE_LANE_X_RATIOS;
    const leftX = vx + (zoneRatios.left - 0.5) * width;
    const centerX = vx + (zoneRatios.center - 0.5) * width;
    const rightX = vx + (zoneRatios.right - 0.5) * width;

    // 중앙 홈 레인(Z10) 내 좌/우 홈 발자국 미세 이격 (중앙 레인 폭 내 자연스러운 홈 발판 스탠스)
    const homeSpread = Math.min(
      halfWBottom * 0.12,
      footWidth * (config.homeFootSpreadRatio ?? 0.55)
    );
    const leftHomeX = vx - homeSpread;
    const rightHomeX = vx + homeSpread;

    return {
      left: { x: leftX, y: strikeY },
      center: { x: centerX, y: strikeY },
      right: { x: rightX, y: strikeY },
      leftOut: { x: leftX, y: strikeY },
      rightOut: { x: rightX, y: strikeY },
      leftHome: { x: leftHomeX, y: strikeY },
      rightHome: { x: rightHomeX, y: strikeY },
      footWidth,
      footHeight,
    };
  }

  /**
   * 판정선 기본 기하 정보(시작/끝점, overhang, 각 레인 앵커 X) 계산
   */
  static computeStrikeLineGeometry(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    customVP?: { x: number; y: number }
  ): StrikeLineGeometry {
    const vp = this.computeVanishingPoint(width, height, config, customVP);
    const yStrike = this.computeStrikeLineY(height, config);
    const overhang =
      width * (config.strikeOverhangRatio ?? DEFAULT_STRIKE_OVERHANG_RATIO);
    const zoneRatios = config.zoneLaneXRatios ?? DEFAULT_ZONE_LANE_X_RATIOS;

    return {
      yStrike,
      overhang,
      xStart: -overhang,
      xEnd: width + overhang,
      leftAnchorX: vp.x + (zoneRatios.left - 0.5) * width,
      centerAnchorX: vp.x + (zoneRatios.center - 0.5) * width,
      rightAnchorX: vp.x + (zoneRatios.right - 0.5) * width,
    };
  }

  /**
   * 3대 발 레인 타깃 앵커 상태 산출 (Zone 9, 10, 11)
   */
  static computeTargetAnchors(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    view: RunningMatViewModel | null,
    customVP?: { x: number; y: number }
  ): TargetAnchorItem[] {
    const geom = this.computeStrikeLineGeometry(width, height, config, customVP);
    const isLeftActive = view
      ? view.currentCue?.leftFootSlot === 'out' || view.actionText.includes('왼')
      : false;
    const isRightActive = view
      ? view.currentCue?.rightFootSlot === 'out' || view.actionText.includes('오른')
      : false;
    const isCenterActive = view ? !isLeftActive && !isRightActive : false;

    const isLeftNext = view?.nextCue
      ? view.nextCue.leftFootSlot === 'out' ||
        (view.nextCue.actionText?.includes('왼') ?? false)
      : false;
    const isRightNext = view?.nextCue
      ? view.nextCue.rightFootSlot === 'out' ||
        (view.nextCue.actionText?.includes('오른') ?? false)
      : false;
    const isCenterNext = view?.nextCue ? !isLeftNext && !isRightNext : false;

    return [
      {
        id: 'left',
        x: geom.leftAnchorX,
        y: geom.yStrike,
        label: 'LEFT (Z9)',
        isActive: isLeftActive,
        isNext: isLeftNext,
      },
      {
        id: 'center',
        x: geom.centerAnchorX,
        y: geom.yStrike,
        label: 'HOME (Z10)',
        isActive: isCenterActive,
        isNext: isCenterNext,
      },
      {
        id: 'right',
        x: geom.rightAnchorX,
        y: geom.yStrike,
        label: 'RIGHT (Z11)',
        isActive: isRightActive,
        isNext: isRightNext,
      },
    ];
  }

  /**
   * 다음 큐의 주요 타깃 포인트 산출
   */
  static resolveNextTargetPoint(
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

    if (
      next.actionId.includes('left') ||
      (next.directionText && next.directionText.includes('왼'))
    ) {
      return slots.leftOut;
    }
    if (
      next.actionId.includes('right') ||
      (next.directionText && next.directionText.includes('오른'))
    ) {
      return slots.rightOut;
    }
    return {
      x: (slots.leftHome.x + slots.rightHome.x) * 0.5,
      y: slots.leftHome.y,
    };
  }

  /**
   * 슬롯 잠금 여부 판정
   */
  static isSlotLocked(slotId: string): boolean {
    return (PROTECTED_RUNNING_MAT_SLOT_IDS as readonly string[]).includes(
      slotId as any
    );
  }

  /**
   * 슬롯 잠금 사유 반환
   */
  static getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return '발판 중심 좌표(Zone 9/10/11 대응) 및 판정선(strike line), 원근 소실점은 인게임 모션 인식 및 리듬 판정의 핵심 보호 영역으로 위치 및 크기 변경이 원자적으로 잠겨 있습니다.';
    }
    return null;
  }

  /**
   * 프레젠테이션 컨텍스트 무결성 검증
   */
  static validatePresentationContext(
    context?: RunningMatPresentationContext
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!context) return { valid: true, issues };

    if (
      context.strikeLine?.y !== undefined ||
      context.strikeLine?.x !== undefined
    ) {
      issues.push('판정선(strike line)의 물리 좌표는 수정할 수 없습니다.');
    }
    if (
      context.footprintSlots?.x !== undefined ||
      context.footprintSlots?.y !== undefined
    ) {
      issues.push('발판 슬롯 물리 좌표(Zone 9/10/11)는 수정할 수 없습니다.');
    }
    if (
      context.targetAnchors?.x !== undefined ||
      context.targetAnchors?.y !== undefined
    ) {
      issues.push('타깃 앵커 물리 좌표는 수정할 수 없습니다.');
    }
    if (
      context.vanishingPoint?.x !== undefined ||
      context.vanishingPoint?.y !== undefined
    ) {
      issues.push('원근 소실점 좌표는 보호 영역입니다.');
    }
    return { valid: issues.length === 0, issues };
  }

  /**
   * 지정된 슬롯 ID에 대한 유효 오버라이드 산출
   */
  static getEffectiveSlotOverride(
    slotId: string,
    context?: RunningMatPresentationContext
  ): RunningMatSlotOverride | undefined {
    if (!context) return undefined;
    if (slotId === 'strike_line' || slotId === 'strike_line_geometry') {
      return context.strikeLine;
    }
    if (slotId === 'mat_visual' || slotId.includes('mat_cell')) {
      return context.matVisual;
    }
    if (slotId === 'status_header' || slotId === 'run_header') {
      return context.statusHeader;
    }
    if (slotId === 'upcomingPreview' || slotId === 'upcoming_preview') {
      return context.upcomingPreview;
    }
    if (slotId.includes('footprint_slot')) {
      return context.footprintSlots;
    }
    if (slotId === 'target_anchors') {
      return context.targetAnchors;
    }
    if (slotId === 'vanishing_point' || slotId === 'vanishing_point_geometry') {
      return context.vanishingPoint;
    }
    return undefined;
  }

  /**
   * 러닝 매트 영역 Bounds 산출
   */
  static getRunningMatBounds(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): RunningMatBounds {
    const yTop = height * (config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const yBottom = height * (config.baseYBottom ?? DEFAULT_MAT_BASE_Y_BOTTOM);
    const halfW = this.computeMatHalfWBottom(width, height, config);
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

  /**
   * 판정선 영역 Bounds 산출
   */
  static getStrikeLineBounds(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): RunningMatBounds {
    const yStrike = this.computeStrikeLineY(height, config);
    const overhang =
      width * (config.strikeOverhangRatio ?? DEFAULT_STRIKE_OVERHANG_RATIO);
    const w = width + overhang * 2;
    const x = -overhang;
    const strikeLayout = UI_LAYOUT.runningMat?.strikeLine;
    const h = strikeLayout?.h ?? strikeLayout?.height ?? 40;
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

  /**
   * 특정 레인 앵커 영역 Bounds 산출
   */
  static getLaneAnchorBounds(
    lane: 'left' | 'center' | 'right' | 9 | 10 | 11,
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): RunningMatBounds {
    const vx = width * 0.5;
    const yStrike = this.computeStrikeLineY(height, config);
    const zoneRatios = config.zoneLaneXRatios ?? DEFAULT_ZONE_LANE_X_RATIOS;
    let anchorX = vx;
    if (lane === 'left' || lane === 9) {
      anchorX = vx + (zoneRatios.left - 0.5) * width;
    } else if (lane === 'right' || lane === 11) {
      anchorX = vx + (zoneRatios.right - 0.5) * width;
    } else {
      anchorX = vx + (zoneRatios.center - 0.5) * width;
    }
    const radius = config.targetAnchorRadius ?? 15;
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

  /**
   * 발자국 슬롯 영역 Bounds 산출
   */
  static getFootprintSlotBounds(
    slot: 'left' | 'right' | 'center' | 'leftHome' | 'rightHome',
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): RunningMatBounds {
    const vx = width * 0.5;
    const vy = height * (config.vanishingYRatio ?? DEFAULT_VANISHING_Y_RATIO);
    const yTop = height * (config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const yBottom = height * (config.baseYBottom ?? DEFAULT_MAT_BASE_Y_BOTTOM);
    const halfWBottom = this.computeMatHalfWBottom(width, height, config);
    const yStrike = this.computeStrikeLineY(height, config);
    const slots = this.computeSlotCoordinates(
      vx,
      vy,
      yTop,
      yBottom,
      halfWBottom,
      width,
      yStrike,
      config
    );

    const pt = slots[slot] ?? slots.center;
    const w = slots.footWidth;
    const h = slots.footHeight;
    return {
      x: pt.x - w / 2,
      y: pt.y - h / 2,
      w,
      h,
      width: w,
      height: h,
      isProtected: true,
    };
  }

  /**
   * 상단 상태 헤더 Bounds 산출
   */
  static getStatusHeaderBounds(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    context?: RunningMatPresentationContext
  ): RunningMatBounds {
    const vx = width * 0.5;
    const yTop = height * (config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const headerLayout = UI_LAYOUT.runningMat?.header;
    const maxW = headerLayout?.maxWidth ?? 480;
    const w =
      headerLayout?.w !== undefined
        ? headerLayout.w
        : Math.min(width * 0.8, maxW);
    const h = headerLayout?.h ?? 40;
    const x =
      headerLayout?.x !== undefined ? headerLayout.x : vx - w / 2;
    const offsetY = headerLayout?.offsetY ?? -48;
    const y =
      headerLayout?.y !== undefined ? headerLayout.y : yTop + offsetY;
    const override = context?.statusHeader;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  /**
   * 다음 두 박 예고 영역 Bounds 산출
   */
  static getUpcomingPreviewsBounds(
    width: number,
    height: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG,
    context?: RunningMatPresentationContext
  ): RunningMatBounds {
    const vx = width * 0.5;
    const yTop = height * (config.baseYTop ?? DEFAULT_MAT_BASE_Y_TOP);
    const previewLayout = UI_LAYOUT.runningMat?.upcomingPreview;
    const maxW = previewLayout?.maxWidth ?? 420;
    const w =
      previewLayout?.w !== undefined
        ? previewLayout.w
        : Math.min(width * 0.8, maxW);
    const h = previewLayout?.h ?? 30;
    const x =
      previewLayout?.x !== undefined ? previewLayout.x : vx - w / 2;
    const offsetY = previewLayout?.offsetY ?? -48;
    const y =
      previewLayout?.y !== undefined ? previewLayout.y : yTop + offsetY;
    const override = context?.upcomingPreview;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  /**
   * UIPresentationDocument로부터 RunningMatPresentationContext 생성
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'running_question'
  ): RunningMatPresentationContext {
    const page = doc.pages[pageId as UIPresentationPageId];
    let strikeLine: RunningMatSlotOverride | undefined;
    let matVisual: RunningMatSlotOverride | undefined;
    let statusHeader: RunningMatSlotOverride | undefined;

    const protectedZone = DEFAULT_PROTECTED_ZONES.find(
      (z) => z.id === 'floor_strike_line_run' || z.id.includes('strike_line')
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

  /**
   * RunningMatFixtureDTO로부터 렌더러용 RunningMatViewModel 생성
   */
  static createViewModelFromFixture(dto?: RunningMatFixtureDTO): RunningMatViewModel {
    const v = dto?.view ?? dto?.viewModel;
    const curAction = dto?.currentActionId || dto?.currentFootSlot;
    const nextAction = dto?.nextActionId || dto?.nextFootSlot;
    return {
      visible: v?.visible ?? true,
      paused: v?.paused ?? false,
      actionText: dto?.actionText ?? v?.actionText ?? '제자리 달리기',
      directionText: v?.directionText ?? '앞으로',
      cueText: dto?.cueText ?? v?.cueText ?? '',
      arrowDirection: v?.arrowDirection ?? 'up',
      nextRingRatio: v?.nextRingRatio ?? 0.5,
      elapsedBeats: dto?.beatIndex ?? v?.elapsedBeats ?? 1,
      acceptedExerciseCount: v?.acceptedExerciseCount ?? 0,
      requiredExerciseCount: v?.requiredExerciseCount ?? 8,
      isShortage: v?.isShortage ?? false,
      isPreparing: v?.isPreparing ?? false,
      isReturnPhase: v?.isReturnPhase ?? false,
      phase: v?.phase,
      currentCue: curAction
        ? {
            beatIndex: dto?.beatIndex ?? 1,
            actionId: dto?.currentActionId ?? 'step_left',
            actionText: dto?.actionText ?? '제자리 달리기',
            directionText: '앞으로',
            cueText: dto?.cueText ?? '',
            arrowDirection: 'up',
            leftFootSlot:
              dto?.currentFootSlot === 'left' || dto?.currentFootSlot === 'out'
                ? 'out'
                : 'home',
            rightFootSlot: dto?.currentFootSlot === 'right' ? 'out' : 'home',
            isPrepare: false,
          }
        : v?.currentCue ?? null,
      nextCue: nextAction
        ? {
            beatIndex: (dto?.beatIndex ?? 1) + 1,
            actionId: dto?.nextActionId ?? 'step_right',
            actionText: '다음 스텝',
            directionText: '앞으로',
            cueText: '',
            arrowDirection: 'up',
            leftFootSlot: dto?.nextFootSlot === 'left' ? 'out' : 'home',
            rightFootSlot:
              dto?.nextFootSlot === 'right' || dto?.nextFootSlot === 'out'
                ? 'out'
                : 'home',
            isPrepare: false,
          }
        : v?.nextCue ?? null,
      upcomingCues: dto?.view?.upcomingCues ?? dto?.viewModel?.upcomingCues ?? [],
    };
  }

  /**
   * 기본 Home 발자국 슬롯 목록 계산
   */
  static computeHomeBaseFootprints(slots: FootprintSlotCoords): FootprintItem[] {
    return [
      {
        x: slots.leftHome.x,
        y: slots.leftHome.y,
        w: slots.footWidth,
        h: slots.footHeight,
        isLeft: true,
        style: 'home',
      },
      {
        x: slots.rightHome.x,
        y: slots.rightHome.y,
        w: slots.footWidth,
        h: slots.footHeight,
        isLeft: false,
        style: 'home',
      },
    ];
  }

  /**
   * 현재/다음/그다음 활성 발자국 목록 계산
   */
  static computeActiveFootprints(
    view: RunningMatViewModel,
    slots: FootprintSlotCoords
  ): FootprintItem[] {
    const result: FootprintItem[] = [];
    const addFp = (
      pt: Point2D,
      isLeft: boolean,
      style: 'current' | 'next' | 'preview2'
    ) => {
      result.push({
        x: pt.x,
        y: pt.y,
        w: slots.footWidth,
        h: slots.footHeight,
        isLeft,
        style,
      });
    };

    // 1. 현재 발자국 (채움 / 강조)
    if (view.currentCue) {
      const cue = view.currentCue;
      addFp(
        cue.leftFootSlot === 'out' ? slots.leftOut : slots.leftHome,
        true,
        'current'
      );
      addFp(
        cue.rightFootSlot === 'out' ? slots.rightOut : slots.rightHome,
        false,
        'current'
      );
    }

    // 2. 다음 발자국 (외곽선 / 점선)
    if (view.nextCue) {
      const next = view.nextCue;
      if (next.leftFootSlot === 'out') {
        addFp(slots.leftOut, true, 'next');
      } else if (
        next.leftFootSlot === 'home' &&
        view.currentCue?.leftFootSlot === 'out'
      ) {
        addFp(slots.leftHome, true, 'next');
      }

      if (next.rightFootSlot === 'out') {
        addFp(slots.rightOut, false, 'next');
      } else if (
        next.rightFootSlot === 'home' &&
        view.currentCue?.rightFootSlot === 'out'
      ) {
        addFp(slots.rightHome, false, 'next');
      }
    }

    // 3. 그다음 2박 발자국 (약한 윤곽선 / 점선)
    if (view.upcomingCues && view.upcomingCues.length > 1) {
      const cue2 = view.upcomingCues[1].cue;
      if (cue2.leftFootSlot === 'out') addFp(slots.leftOut, true, 'preview2');
      if (cue2.rightFootSlot === 'out') addFp(slots.rightOut, false, 'preview2');
    }

    return result;
  }

  /**
   * 이동/복귀 화살표 가이드 텍스트/위치 계산
   */
  static computeDirectionArrowLayout(
    view: RunningMatViewModel,
    slots: FootprintSlotCoords,
    yTop: number,
    yBottom: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): DirectionArrowLayout | null {
    const dir = view.arrowDirection;
    const arrowY = yTop + (yBottom - yTop) * 0.26;
    const centerX = (slots.leftHome.x + slots.rightHome.x) * 0.5;
    const arrowTextScale = Math.max(
      0.5,
      Math.min(
        3.0,
        UI_LAYOUT.runningMat?.arrow?.textScale ??
          UI_LAYOUT.runningMat?.textScale ??
          1.0
      )
    );
    const font = `bold ${Math.round(16 * arrowTextScale)}px sans-serif`;

    let text = '';
    let color = config.arrowActiveColor;
    let x = centerX;

    if (dir === 'left') {
      text = '◀ ── 왼발 딛기';
      x = centerX - 40;
    } else if (dir === 'right') {
      text = '오른발 딛기 ── ▶';
      x = centerX + 40;
    } else if (dir === 'center') {
      text = '▶ 중앙 복귀 ◀';
      color = config.arrowReturnColor;
    } else if (dir === 'up') {
      const isKnee =
        view.currentCue?.actionId === 'knee_left' ||
        view.currentCue?.actionId === 'knee_right' ||
        view.actionText.includes('무릎');
      if (isKnee) {
        const isRet = view.isReturnPhase || view.currentCue?.isReturnPhase;
        text = isRet
          ? `▼ ▼ ${config.kneeReturnText} ▼ ▼`
          : `▲ ▲ ${config.kneeLiftText} ▲ ▲`;
        color = isRet ? config.arrowReturnColor : config.arrowActiveColor;
      } else {
        text = '▲ 쿵! 짝! 리듬 스텝 ▲';
      }
    } else if (dir === 'down') {
      text = '▼ ▼ 바운스 다운 ▼ ▼';
    } else if (
      view.actionText.includes('스웨이') ||
      view.cueText.includes('체중')
    ) {
      text = '~ ◀ 체중 이동 ▶ ~';
      color = config.textAccentColor;
    } else if (view.actionText.includes('팔 교차')) {
      text = '✕ 두 발 고정 · 상체 교차 ✕';
      color = config.textAccentColor;
    } else {
      return null;
    }

    return { text, color, x, y: arrowY, font };
  }

  /**
   * 다음 두 박 예고 노드 레이아웃 계산
   */
  static computeUpcomingPreviewLayout(
    view: RunningMatViewModel,
    vx: number,
    yTop: number,
    width: number,
    config: RunningMatConfig = RUNNING_MAT_CONFIG
  ): UpcomingPreviewLayout {
    const upcoming =
      view.upcomingCues ??
      (view.nextCue
        ? [
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
          ]
        : []);

    interface RawNode {
      readonly label: string;
      readonly actionText: string;
      readonly style: 'current' | 'preview1' | 'preview2';
    }

    const currentText =
      view.actionText || view.currentCue?.actionText || '운동 동작';
    const rawNodes: RawNode[] = [
      { label: '지금', actionText: currentText, style: 'current' },
    ];

    if (upcoming.length > 0) {
      rawNodes.push({
        label: config.preview1Label || '다음',
        actionText: upcoming[0].cue.actionText,
        style: 'preview1',
      });
    }

    if (upcoming.length > 1) {
      rawNodes.push({
        label: config.preview2Label || '그다음',
        actionText: upcoming[1].cue.actionText,
        style: 'preview2',
      });
    }

    const nodeWidth = Math.min(130, (width * 0.8) / rawNodes.length);
    const nodeHeight = 26;
    const totalW = rawNodes.length * nodeWidth + (rawNodes.length - 1) * 8;
    const startX = vx - totalW * 0.5;

    const previewLayout = UI_LAYOUT.runningMat?.upcomingPreview;
    const previewOffsetY = previewLayout?.offsetY ?? -48;
    const previewY =
      previewLayout?.y !== undefined ? previewLayout.y : yTop + previewOffsetY;

    const previewTextScale = Math.max(
      0.5,
      Math.min(
        3.0,
        previewLayout?.textScale ?? UI_LAYOUT.runningMat?.textScale ?? 1.0
      )
    );

    const nodes: UpcomingPreviewNode[] = rawNodes.map((node, i) => {
      const nx = startX + i * (nodeWidth + 8);
      let displayTxt = node.actionText;
      if (displayTxt.length > 6) {
        displayTxt = displayTxt.slice(0, 5) + '..';
      }
      return {
        label: node.label,
        actionText: node.actionText,
        displayTxt,
        style: node.style,
        x: nx,
        y: previewY,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    return {
      nodes,
      previewTextScale,
    };
  }
}
