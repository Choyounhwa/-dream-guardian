/**
 * GridProjection - 3D 원근 투영 및 레일 궤적 공용 모듈
 *
 * Issue #227 (RENDER-PROJ-001):
 * - 드림 그리드, 보스 장판(HazardZoneRenderer), 별가루 악기 노트(StarNoteRenderer) 공용 투영 계산식
 */

import { Z_NEAR } from '../../config/grid.config.js';

export interface RailProjectionResult {
  x: number;
  y: number;
  scale: number;
  t?: number;
}

/**
 * 깊이 z를 화면 Y 좌표로 투영
 * @param z 원근 깊이 (z >= zNear)
 * @param vy 소실점 Y 좌표
 * @param floorH 소실점에서 화면 바닥까지의 높이
 * @param zNear 전경 근접 기준 깊이 (기본값: Z_NEAR = 1.0)
 */
export function projectDepthY(z: number, vy: number, floorH: number, zNear: number = Z_NEAR): number {
  if (z === 0) return vy + floorH;
  return vy + (floorH * zNear) / z;
}

/**
 * 화면 Y 좌표를 정규화 깊이 비율(0: 소실점 ~ 1: 전경 하단)로 역변환
 * @param y 화면 Y 좌표
 * @param vy 소실점 Y 좌표
 * @param floorH 소실점에서 화면 바닥까지의 높이
 */
export function depthRatioFromY(y: number, vy: number, floorH: number): number {
  if (floorH <= 0) return 0;
  return (y - vy) / floorH;
}

/**
 * 소실점(vx, vy)에서 목표 지점(targetX, targetY)까지 진행도에 원근 가속(t^2)을 적용한 현재 좌표 및 크기 배율 산출
 * @param vx 소실점 X 좌표
 * @param vy 소실점 Y 좌표
 * @param targetX 목표 지점 X 좌표
 * @param targetY 목표 지점 Y 좌표
 * @param progress 비행 진행도 (0.0: 소실점 ~ 1.0: 목표 지점)
 * @param minScale 시작 크기 배율 (기본값: 0.3)
 * @param maxScale 종료 크기 배율 (기본값: 1.2)
 */
export function projectAlongRail(
  vx: number,
  vy: number,
  targetX: number,
  targetY: number,
  progress: number,
  minScale: number = 0.3,
  maxScale: number = 1.2,
): RailProjectionResult {
  const p = Math.max(0, Math.min(1, progress));
  const t = p * p;
  const x = vx + (targetX - vx) * t;
  const y = vy + (targetY - vy) * t;
  const scale = minScale + (maxScale - minScale) * t;

  return { x, y, scale, t };
}

/**
 * 깊이 비율에 따른 가로선 폭 및 X 오프셋 계산
 * @param vx 소실점 X 좌표
 * @param laneOffset 전경 기준 레인 오프셋 (X 거리)
 * @param depthRatio 현재 깊이 비율 (0: 소실점 ~ 1: 전경)
 */
export function laneToScreenX(vx: number, laneOffset: number, depthRatio: number): number {
  return vx + laneOffset * depthRatio;
}
