/**
 * NoteAnchorResolver - 모션 리듬 노트 착지 앵커 좌표 해석기 (순수 함수)
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§6 공용 투영 및 앵커 좌표)
 * @see Issue #478 [MRN-04]
 *
 * 핵심 역할:
 * - 렌더러와 판정기가 동일한 함수로 착지 좌표를 산출하여 오차를 원천 배제
 * - 손/머리/골반: zoneCenter 모드 -> Zone 직사각형 중심 (x + width/2, y + height/2)
 * - 발 3대 레인 / 양발 / 전신: strikeLine 모드 -> 판정선 높이 및 레인 오프셋 좌표
 * - RunningMatRenderer의 레인 앵커 렌더링 공식과 100% 동일한 수치 산출
 */

import type { PartRequirement } from '../types/motion-note.js';
import { isFloorPart } from '../types/motion-note.js';
import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
} from '../../config/zone.config.js';
import {
  RUNNING_MAT_CONFIG,
  DEFAULT_STRIKE_LINE_Y_RATIO,
  DEFAULT_MAT_WIDTH_RATIO,
  MAX_NARROW_WIDTH_RATIO,
  DEFAULT_STOMP_NOTE_RADIUS,
  DEFAULT_LANE_SLOT_OFFSETS,
} from '../../config/running-mat.config.js';
import { DEFAULT_STAR_NOTE_VISUAL_CONFIG } from '../../config/beat-motion.config.js';

/**
 * 노트 착지 모드
 * - zoneCenter: 피트니스 존 중심 착지 (손, 머리, 골반)
 * - strikeLine: 하단 발 판정선 착지 (왼발, 중앙발, 오른발, 양발, 전신)
 */
export type LandingMode = 'zoneCenter' | 'strikeLine';

/**
 * 해석된 착지 앵커 좌표 및 규격
 */
export interface NoteAnchor {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly mode: LandingMode;
}

/**
 * 뷰포트 크기
 */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * 바닥 판정선 및 존 레이아웃 커스텀 옵션
 */
export interface FloorLayoutOptions {
  readonly strikeLineYRatio?: number;
  readonly widthRatio?: number;
  readonly maxNarrowWidthRatio?: number;
  readonly laneOffset?: number;
  readonly laneOffsetLeft?: number;
  readonly laneOffsetRight?: number;
  readonly stompNoteRadius?: number;
  readonly zoneRadius?: number;
  readonly vanishingX?: number;
  readonly vanishingPoint?: { x: number; y: number };
}

/**
 * 기본 판정선 레인 오프셋 (RunningMatRenderer와 일치: ±0.45)
 */
export const DEFAULT_LANE_OFFSET = 0.45;

/**
 * 화면 가로세로 비율을 고려한 러닝 매트 바닥 반폭(halfWBottom) 산출
 * (RunningMatRenderer의 반응형 폭 보정 공식과 100% 일치)
 */
export function computeMatHalfWBottom(
  width: number,
  height: number,
  layout?: FloorLayoutOptions,
): number {
  if (width <= 0) return 0;
  const widthRatio =
    layout?.widthRatio ?? RUNNING_MAT_CONFIG.widthRatio ?? DEFAULT_MAT_WIDTH_RATIO;
  const maxNarrowWidthRatio =
    layout?.maxNarrowWidthRatio ??
    RUNNING_MAT_CONFIG.maxNarrowWidthRatio ??
    MAX_NARROW_WIDTH_RATIO;
  const aspect = height > 0 ? width / height : 1.0;
  const matWidthRatio =
    aspect < 1.0
      ? Math.min(maxNarrowWidthRatio, widthRatio + (1.0 - aspect) * 0.15)
      : widthRatio;
  return width * matWidthRatio * 0.5;
}

/**
 * 판정선 Y 좌표 산출
 */
export function computeStrikeLineY(
  height: number,
  layout?: FloorLayoutOptions,
): number {
  if (height <= 0) return 0;
  const ratio =
    layout?.strikeLineYRatio ??
    RUNNING_MAT_CONFIG.strikeLineYRatio ??
    DEFAULT_STRIKE_LINE_Y_RATIO;
  return height * ratio;
}

/**
 * 신체 부위 요구조건(PartRequirement)에 따른 착지 앵커 좌표를 결정하는 순수 함수
 *
 * @param req 요구 부위 및 존 ID
 * @param viewport 렌더링 뷰포트 해상도 ({ width, height })
 * @param zones 피트니스 존 목록 (기본값: DEFAULT_FITNESS_ZONES)
 * @param floorLayout 바닥 판정선 레이아웃 오버라이드 옵션
 * @returns 결정된 착지 앵커 (x, y, radius, mode)
 */
export function resolveAnchor(
  req: PartRequirement,
  viewport: ViewportSize,
  zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES,
  floorLayout?: FloorLayoutOptions,
): NoteAnchor {
  const w = Math.max(0, viewport.width || 0);
  const h = Math.max(0, viewport.height || 0);
  const vx =
    floorLayout?.vanishingX ??
    floorLayout?.vanishingPoint?.x ??
    w * 0.5;
  const vy =
    floorLayout?.vanishingPoint?.y ??
    h * 0.5;

  // 1. 발 / 하체 / 전신 부위 (strikeLine 착지 모드)
  if (isFloorPart(req.part)) {
    const halfWBottom = computeMatHalfWBottom(w, h, floorLayout);
    const yStrike = computeStrikeLineY(h, floorLayout);
    const laneOffsetLeft =
      floorLayout?.laneOffsetLeft ??
      (floorLayout?.laneOffset !== undefined
        ? -Math.abs(floorLayout.laneOffset)
        : (RUNNING_MAT_CONFIG.laneOffsetLeft ?? DEFAULT_LANE_SLOT_OFFSETS.left));
    const laneOffsetRight =
      floorLayout?.laneOffsetRight ??
      (floorLayout?.laneOffset !== undefined
        ? Math.abs(floorLayout.laneOffset)
        : (RUNNING_MAT_CONFIG.laneOffsetRight ?? DEFAULT_LANE_SLOT_OFFSETS.right));
    const laneOffsetCenter =
      RUNNING_MAT_CONFIG.laneOffsetCenter ?? DEFAULT_LANE_SLOT_OFFSETS.center;
    const stompRadius =
      floorLayout?.stompNoteRadius ??
      RUNNING_MAT_CONFIG.stompNoteRadius ??
      DEFAULT_STOMP_NOTE_RADIUS;

    switch (req.part) {
      case 'leftFoot':
        return {
          x: vx + laneOffsetLeft * halfWBottom,
          y: yStrike,
          radius: stompRadius,
          mode: 'strikeLine',
        };
      case 'rightFoot':
        return {
          x: vx + laneOffsetRight * halfWBottom,
          y: yStrike,
          radius: stompRadius,
          mode: 'strikeLine',
        };
      case 'centerFoot':
        return {
          x: vx + laneOffsetCenter * halfWBottom,
          y: yStrike,
          radius: stompRadius,
          mode: 'strikeLine',
        };
      case 'bothFeet':
      case 'fullBody':
        return {
          x: vx,
          y: yStrike,
          radius: halfWBottom,
          mode: 'strikeLine',
        };
    }
  }

  // 2. 손 / 머리 / 골반 부위 (zoneCenter 착지 모드)
  // (골반은 하단 Zone 9, 10, 11에 위치하더라도 발 판정선이 아닌 Zone 중심으로 착지)
  const zoneRadius =
    floorLayout?.zoneRadius ?? DEFAULT_STAR_NOTE_VISUAL_CONFIG.baseRadius;
  const zoneList = zones ?? DEFAULT_FITNESS_ZONES;
  const zone = zoneList.find((z) => z.id === req.zoneId);

  if (!zone) {
    // 존이 없거나 범위를 벗어난 경우의 안전 폴백 (화면 중앙)
    return {
      x: vx,
      y: vy,
      radius: zoneRadius,
      mode: 'zoneCenter',
    };
  }

  // 정규화 좌표(0~1) 또는 픽셀 단위 좌표 여부 확인
  const isNormalized =
    zone.x <= 1.0 &&
    zone.y <= 1.0 &&
    zone.width <= 1.0 &&
    zone.height <= 1.0 &&
    zone.x + zone.width <= 1.05 &&
    zone.y + zone.height <= 1.05;

  const cx = zone.x + zone.width * 0.5;
  const cy = zone.y + zone.height * 0.5;

  return {
    x: isNormalized ? cx * w : cx,
    y: isNormalized ? cy * h : cy,
    radius: zoneRadius,
    mode: 'zoneCenter',
  };
}
