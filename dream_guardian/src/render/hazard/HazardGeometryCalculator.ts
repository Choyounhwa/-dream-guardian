/**
 * HazardGeometryCalculator - 3D 원근 투영 및 장판/레인 기하 계산기
 *
 * Issue #639 [REFACTOR-SRP-008]:
 * - HazardZoneRenderer 내부의 3D 원근 투영, 사다리꼴(Quad) 정점, 레인 좌표 매핑 및 바운드 계산 분리
 * - 단일 책임 원칙(SRP) 준수 및 재사용 가능한 기하 계산 엔진
 */

import type { PhaseAHazardPattern } from '../../../config/phase-a-hazard.config.js';
import { UI_LAYOUT } from '../../../config/ui.config.js';
import { laneToScreenX } from '../GridProjection.js';

export interface Point2D {
  x: number;
  y: number;
}

export interface Quad2D {
  farLeft: Point2D;
  farRight: Point2D;
  nearRight: Point2D;
  nearLeft: Point2D;
}

export interface StepLaneQuad extends Quad2D {
  topX1: number;
  topX2: number;
  topY: number;
  botX1: number;
  botX2: number;
  botY: number;
  botCenterX: number;
}

export interface BalancePlatformGeometry {
  safeCenterX: number;
  safeFrontY: number;
  safeRx: number;
  safeRy: number;
  dangerSide: 'left' | 'right';
}

export interface HazardTargetGeometry {
  targetX: number;
  targetY: number;
  baseRx: number;
  baseRy: number;
}

export interface HazardBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface LaneTrapezoidOptions {
  vx: number;
  vy: number;
  nearY: number;
  laneOffset: number;
  laneWidth: number;
  depthRatio?: number;
  farScale?: number;
}

const HAZARD_PATTERN_CONFIG: Record<
  PhaseAHazardPattern,
  { laneSign: number; rxScale: number; ryRatio: number }
> = {
  jump: { laneSign: 0, rxScale: 0.40, ryRatio: 0.26 },
  left_step: { laneSign: -1, rxScale: 0.16, ryRatio: 0.30 },
  right_step: { laneSign: 1, rxScale: 0.16, ryRatio: 0.30 },
  balance_left: { laneSign: 1, rxScale: 0.18, ryRatio: 0.28 },
  balance_right: { laneSign: -1, rxScale: 0.18, ryRatio: 0.28 },
};

export class HazardGeometryCalculator {
  /**
   * 화면 크기 및 선택적 사용자 지정 좌표로부터 기본 소실점(Vanishing Point) 계산
   */
  getVanishingPoint(vw: number, vh: number, customVP?: Partial<Point2D>): Point2D {
    return {
      x: customVP?.x ?? vw / 2,
      y: customVP?.y ?? vh * 0.24,
    };
  }

  /**
   * 박자 진행도(beatProgress: 0.0 ~ 1.0)에 따른 장판 전방 도달 Y 좌표 계산
   * - 원근 가속(p^1.5)을 적용하여 소실점에서 전경(화면 92% 높이)까지 자연스럽게 도달
   */
  computeHazardFrontY(beatProgress: number, vanishingY: number, vh: number): number {
    const floorH = Math.max(0, vh - vanishingY);
    const p = Math.max(0, Math.min(1.0, beatProgress));
    return vanishingY + floorH * 0.92 * Math.pow(p, 1.5);
  }

  /**
   * 박자 진행도(0.0 ~ 1.0)에 동기화되어 전경 위험 발판 지점으로 수축하는 타이밍 링 배율 계산
   * - 진행도 0.0일 때 발판 반경의 2.5배 -> 1.0 도달 시 1.0배로 수축 (Issue #286)
   */
  computeTimingRingScale(progress: number): number {
    const p = Math.max(0, Math.min(1.0, progress));
    return 2.5 - 1.5 * p;
  }

  /**
   * 레인 오프셋과 원근 심도 비율을 기반으로 2D 화면 좌표 투영
   */
  projectLanePoint(vx: number, laneOffset: number, depthRatio: number, y: number): Point2D {
    return {
      x: laneToScreenX(vx, laneOffset, depthRatio),
      y,
    };
  }

  /**
   * 원근 심도 비율(depthRatio)에 따른 Far -> Near 값 선형/원근 보간
   */
  interpolatePerspective(farVal: number, nearVal: number, depthRatio: number): number {
    const clamped = Math.max(0, Math.min(1.0, depthRatio));
    return farVal + (nearVal - farVal) * clamped;
  }

  /**
   * 단일 레인의 3D 원근 투영 사다리꼴(Quad) 4점 계산
   */
  computeLaneTrapezoid(options: LaneTrapezoidOptions): Quad2D {
    const {
      vx,
      vy,
      nearY,
      laneOffset,
      laneWidth,
      depthRatio = 1.0,
      farScale = 0.15,
    } = options;

    const laneWidthNear = laneWidth;
    const laneWidthFar = laneWidthNear * depthRatio;

    const xNear = laneToScreenX(vx, laneOffset, depthRatio);
    const xFar = laneToScreenX(vx, laneOffset, 0.0);

    const xNearL = xNear - laneWidthFar / 2;
    const xNearR = xNear + laneWidthFar / 2;
    const xFarL = xFar - laneWidthFar * farScale;
    const xFarR = xFar + laneWidthFar * farScale;

    return {
      farLeft: { x: xFarL, y: vy },
      farRight: { x: xFarR, y: vy },
      nearRight: { x: xNearR, y: nearY },
      nearLeft: { x: xNearL, y: nearY },
    };
  }

  /**
   * 한 발 피하기 레인 위험 네온 띠 사다리꼴 계산 (left_step / right_step)
   */
  computeStepLaneQuad(
    vw: number,
    vx: number,
    vy: number,
    frontY: number,
    depthRatio: number,
    side: 'left' | 'right',
  ): StepLaneQuad {
    const isLeft = side === 'left';
    const laneOffsetSign = isLeft ? -1 : 1;
    const laneCenterOffset = laneOffsetSign * vw * 0.35;
    const laneHalfWidth = vw * 0.16;

    // 소실점 근처 시작 좌표
    const topX1 = vx + laneOffsetSign * 10;
    const topX2 = vx + laneOffsetSign * 40;
    const topY = vy;

    // 전방 진행 좌표
    const botCenterX = laneToScreenX(vx, laneCenterOffset, depthRatio);
    const botWidth = laneHalfWidth * depthRatio;
    const botX1 = botCenterX - botWidth;
    const botX2 = botCenterX + botWidth;

    return {
      topX1,
      topX2,
      topY,
      botX1,
      botX2,
      botY: frontY,
      botCenterX,
      farLeft: { x: Math.min(topX1, topX2), y: topY },
      farRight: { x: Math.max(topX1, topX2), y: topY },
      nearRight: { x: Math.max(botX1, botX2), y: frontY },
      nearLeft: { x: Math.min(botX1, botX2), y: frontY },
    };
  }

  /**
   * 외발 서기 패턴의 안전 플랫폼 링 기하 계산 (balance_left / balance_right)
   */
  computeBalancePlatformGeometry(
    vw: number,
    vx: number,
    frontY: number,
    depthRatio: number,
    safeSide: 'left' | 'right',
  ): BalancePlatformGeometry {
    const isSafeLeft = safeSide === 'left';
    const safeOffsetSign = isSafeLeft ? -1 : 1;
    const safeCenterOffset = safeOffsetSign * vw * 0.35;
    const safeCenterX = laneToScreenX(vx, safeCenterOffset, depthRatio);

    const safeRx = vw * (0.08 + 0.12 * depthRatio);
    const safeRy = safeRx * 0.28;
    const dangerSide = isSafeLeft ? 'right' : 'left';

    return {
      safeCenterX,
      safeFrontY: frontY,
      safeRx,
      safeRy,
      dangerSide,
    };
  }

  /**
   * 외발 서기 패턴의 안전 구역 및 위험 구역 사다리꼴 동시 계산 (balance_left / balance_right)
   */
  computeBalanceLanesQuads(
    vw: number,
    vh: number,
    vx: number,
    vy: number,
    frontY: number,
    depthRatio: number,
    side: 'left' | 'right',
  ): { safeQuad: Quad2D; dangerQuad: Quad2D } {
    const isLeft = side === 'left';
    const safeLaneOffset = isLeft ? -vw * 0.35 : vw * 0.35;
    const dangerLaneOffset = -safeLaneOffset;
    const floorH = Math.max(1, vh - vy);
    const targetFloorY = vy + floorH * 0.92;
    const laneWidthNear = vw * 0.36;

    // 안전 지대 (소실점 -> 전경 전면)
    const safeNearX = laneToScreenX(vx, safeLaneOffset, 1.0);
    const safeFarX = laneToScreenX(vx, safeLaneOffset, 0.0);
    const safeL = safeNearX - laneWidthNear / 2;
    const safeR = safeNearX + laneWidthNear / 2;
    const safeFarL = safeFarX - laneWidthNear * 0.15;
    const safeFarR = safeFarX + laneWidthNear * 0.15;

    const safeQuad: Quad2D = {
      farLeft: { x: safeFarL, y: vy },
      farRight: { x: safeFarR, y: vy },
      nearRight: { x: safeR, y: targetFloorY },
      nearLeft: { x: safeL, y: targetFloorY },
    };

    // 위험 지대 사다리꼴 (소실점 -> 현재 frontY)
    const dangerQuad = this.computeLaneTrapezoid({
      vx,
      vy,
      nearY: frontY,
      laneOffset: dangerLaneOffset,
      laneWidth: laneWidthNear,
      depthRatio,
      farScale: 0.15,
    });

    return { safeQuad, dangerQuad };
  }

  /**
   * 5종 패턴별 전경 도달 목표점 및 기본 타원 반경(targetX, targetY, baseRx, baseRy) 계산
   */
  getHazardTargetGeometry(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardTargetGeometry {
    const vp = this.getVanishingPoint(vw, vh, vanishingPoint);
    const floorH = Math.max(1, vh - vp.y);
    const targetY = vp.y + floorH * 0.92;
    const cfg = HAZARD_PATTERN_CONFIG[pattern] ?? HAZARD_PATTERN_CONFIG.jump;
    const targetX = cfg.laneSign === 0 ? vp.x : laneToScreenX(vp.x, cfg.laneSign * vw * 0.35, 1.0);
    const baseRx = vw * cfg.rxScale;
    const baseRy = baseRx * cfg.ryRatio;

    return { targetX, targetY, baseRx, baseRy };
  }

  /**
   * 5종 패턴별 안전 구역 타원 기하 계산
   */
  getSafeTargetGeometry(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardTargetGeometry {
    if (pattern === 'jump') {
      const jg = this.getHazardTargetGeometry('jump', vw, vh, vanishingPoint);
      return {
        targetX: jg.targetX,
        targetY: Math.max(0, jg.targetY - jg.baseRy * 4),
        baseRx: jg.baseRx,
        baseRy: jg.baseRy,
      };
    }

    const vp = this.getVanishingPoint(vw, vh, vanishingPoint);
    const floorH = Math.max(1, vh - vp.y);
    const targetY = vp.y + floorH * 0.92;
    const cfg = HAZARD_PATTERN_CONFIG[pattern] ?? HAZARD_PATTERN_CONFIG.jump;
    const safeSign = -cfg.laneSign;
    const safeX = laneToScreenX(vp.x, safeSign * vw * 0.35, 1.0);
    const safeRx = vw * cfg.rxScale;
    const safeRy = safeRx * cfg.ryRatio;

    return { targetX: safeX, targetY, baseRx: safeRx, baseRy: safeRy };
  }

  private _createBounds(
    x: number,
    y: number,
    w: number,
    h: number,
    isProtected: boolean,
  ): HazardBounds {
    return { x, y, w, h, width: w, height: h, isProtected };
  }

  /**
   * 3D 장판 물리적 유효 바운드 계산
   */
  computeHazardBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardBounds {
    const geom = this.getHazardTargetGeometry(pattern, vw, vh, vanishingPoint);
    const w = geom.baseRx * 2;
    const h = geom.baseRy * 2;
    return this._createBounds(geom.targetX - geom.baseRx, geom.targetY - geom.baseRy, w, h, true);
  }

  /**
   * 타이밍 서클 수축 링 물리 바운드 계산
   */
  computeTimingRingBounds(
    pattern: PhaseAHazardPattern,
    progress: number,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardBounds {
    const geom = this.getHazardTargetGeometry(pattern, vw, vh, vanishingPoint);
    const scale = this.computeTimingRingScale(progress);
    const ringRx = geom.baseRx * scale;
    const ringRy = geom.baseRy * scale;
    return this._createBounds(geom.targetX - ringRx, geom.targetY - ringRy, ringRx * 2, ringRy * 2, true);
  }

  /**
   * 안전 구역 바운드 계산
   */
  computeSafeZoneBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardBounds {
    if (pattern === 'jump') {
      const jb = this.computeHazardBounds('jump', vw, vh, vanishingPoint);
      return this._createBounds(jb.x, Math.max(0, jb.y - jb.h * 1.5), jb.w, jb.h, true);
    }

    const geom = this.getSafeTargetGeometry(pattern, vw, vh, vanishingPoint);
    return this._createBounds(
      geom.targetX - geom.baseRx,
      geom.targetY - geom.baseRy,
      geom.baseRx * 2,
      geom.baseRy * 2,
      true,
    );
  }

  /**
   * 경고 라벨 UI 바운드 계산
   */
  computeWarningLabelBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardBounds {
    const layout = UI_LAYOUT.hazard?.warningBanner;
    const hz = this.computeHazardBounds(pattern, vw, vh, vanishingPoint);
    const scaleX = vw / 1080;
    const scaleY = vh / 2160;
    const baseW = layout?.w ?? 432;
    const baseH = layout?.h ?? 80;
    const w = Math.min(vw * 0.8, baseW * scaleX);
    const h = baseH * scaleY;
    const gapY = (layout?.gapY ?? 30) * scaleY;
    const minY = (layout?.minY ?? 20) * scaleY;
    const defaultX = hz.x + hz.w / 2 - w / 2;
    const defaultY = Math.max(minY, hz.y - h - gapY);
    const x = layout?.x !== undefined && layout.x !== 324 ? layout.x * scaleX : defaultX;
    const y = layout?.y !== undefined && layout.y !== 1806 ? layout.y * scaleY : defaultY;

    return this._createBounds(x, y, w, h, false);
  }

  /**
   * 타이밍 가이드 텍스트 UI 바운드 계산
   */
  computeTimingGuideBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: Partial<Point2D>,
  ): HazardBounds {
    const layout = UI_LAYOUT.hazard?.timingGuide;
    const ring = this.computeTimingRingBounds(pattern, 1.0, vw, vh, vanishingPoint);
    const targetX = ring.x + ring.w / 2;
    const targetY = ring.y + ring.h / 2;
    const baseRy = ring.h / 2;
    const scaleX = vw / 1080;
    const scaleY = vh / 2160;
    const offsetY = (layout?.offsetY ?? 28) * scaleY;
    const defaultX = targetX;
    const defaultY = targetY - baseRy - offsetY;
    const textX = layout?.x !== undefined && layout.x !== 540 ? layout.x * scaleX : defaultX;
    const textY = layout?.y !== undefined && layout.y !== 1886 ? layout.y * scaleY : defaultY;
    const w = (layout?.w ?? 400) * scaleX;
    const h = (layout?.h ?? 60) * scaleY;

    return this._createBounds(textX - w / 2, textY - h / 2, w, h, false);
  }
}
