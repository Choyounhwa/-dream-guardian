import { describe, it, expect } from 'vitest';
import {
  GRID_CONFIG,
  Z_NEAR,
  DELTA_Z,
  LINE_COUNT_Z,
  FADE_DEPTH,
  HORIZON_RATIO,
  FOG_START,
  FOG_RANGE,
  CEILING_DELTA_Z,
  CEILING_LINE_COUNT_Z,
} from '../../config/grid.config.js';
import {
  projectDepthY,
  depthRatioFromY,
  projectAlongRail,
  laneToScreenX,
} from '../../src/render/GridProjection.js';

describe('GridProjection & grid.config (Issue #227 / RENDER-PROJ-001)', () => {
  describe('grid.config 상수 정의 검증', () => {
    it('요구된 3D 원근 투영 및 안개 상수들이 올바른 값으로 정의되어 있다', () => {
      expect(Z_NEAR).toBe(1.0);
      expect(DELTA_Z).toBe(0.18);
      expect(LINE_COUNT_Z).toBe(18);
      expect(FADE_DEPTH).toBe(0.14);
      expect(HORIZON_RATIO).toBe(0.24);
      expect(FOG_START).toBe(0.16);
      expect(FOG_RANGE).toBe(0.28);
      expect(CEILING_DELTA_Z).toBe(0.22);
      expect(CEILING_LINE_COUNT_Z).toBe(12);

      expect(GRID_CONFIG.Z_NEAR).toBe(1.0);
      expect(GRID_CONFIG.DELTA_Z).toBe(0.18);
      expect(GRID_CONFIG.LINE_COUNT_Z).toBe(18);
      expect(GRID_CONFIG.FADE_DEPTH).toBe(0.14);
      expect(GRID_CONFIG.HORIZON_RATIO).toBe(0.24);
      expect(GRID_CONFIG.FOG_START).toBe(0.16);
      expect(GRID_CONFIG.FOG_RANGE).toBe(0.28);
      expect(GRID_CONFIG.CEILING_DELTA_Z).toBe(0.22);
      expect(GRID_CONFIG.CEILING_LINE_COUNT_Z).toBe(12);
    });
  });

  describe('projectDepthY(z, vy, floorH, zNear)', () => {
    const vy = 200;
    const floorH = 800;

    it('zNear(기본값 1.0)일 때 화면 전경 하단(vy + floorH)에 정확히 위치한다', () => {
      const y = projectDepthY(1.0, vy, floorH);
      expect(y).toBe(vy + floorH);
    });

    it('z가 증가할수록 소실점(vy)에 점근적으로 가까워진다', () => {
      const y1 = projectDepthY(1.0, vy, floorH);
      const y2 = projectDepthY(2.0, vy, floorH);
      const y10 = projectDepthY(10.0, vy, floorH);

      expect(y1).toBe(1000);
      expect(y2).toBe(600); // 200 + 800 / 2 = 600
      expect(y10).toBe(280); // 200 + 800 / 10 = 280
      expect(y10).toBeGreaterThan(vy);
    });

    it('floorH가 음수일 때(천장 투영) vy 위쪽으로 투영된다', () => {
      const ceilH = -200;
      const y = projectDepthY(1.0, vy, ceilH);
      expect(y).toBe(0);
    });
  });

  describe('depthRatioFromY(y, vy, floorH)', () => {
    const vy = 240;
    const floorH = 760;

    it('소실점 y=vy일 때 0을 반환한다', () => {
      expect(depthRatioFromY(vy, vy, floorH)).toBe(0);
    });

    it('전경 하단 y=vy+floorH일 때 1을 반환한다', () => {
      expect(depthRatioFromY(vy + floorH, vy, floorH)).toBe(1);
    });

    it('중간 지점 Y에 대해 비례하는 depthRatio를 반환한다', () => {
      const midY = vy + floorH * 0.5;
      expect(depthRatioFromY(midY, vy, floorH)).toBeCloseTo(0.5);
    });

    it('floorH <= 0인 비정상 환경에서 0을 안전하게 반환한다', () => {
      expect(depthRatioFromY(300, 200, 0)).toBe(0);
      expect(depthRatioFromY(300, 200, -100)).toBe(0);
    });
  });

  describe('projectAlongRail(vx, vy, targetX, targetY, progress, minScale, maxScale)', () => {
    const vx = 500;
    const vy = 200;
    const targetX = 200;
    const targetY = 900;

    it('progress=0일 때 소실점 위치와 minScale(0.3)을 반환한다', () => {
      const res = projectAlongRail(vx, vy, targetX, targetY, 0);
      expect(res.x).toBe(vx);
      expect(res.y).toBe(vy);
      expect(res.scale).toBeCloseTo(0.3);
    });

    it('progress=1일 때 목표 지점 위치와 maxScale(1.2)을 반환한다', () => {
      const res = projectAlongRail(vx, vy, targetX, targetY, 1.0);
      expect(res.x).toBe(targetX);
      expect(res.y).toBe(targetY);
      expect(res.scale).toBeCloseTo(1.2);
    });

    it('원근 가속(t = progress^2) 곡선이 적용된다', () => {
      const res = projectAlongRail(vx, vy, targetX, targetY, 0.5);
      // t = 0.5^2 = 0.25
      const expectedX = vx + (targetX - vx) * 0.25;
      const expectedY = vy + (targetY - vy) * 0.25;
      const expectedScale = 0.3 + (1.2 - 0.3) * 0.25;

      expect(res.x).toBeCloseTo(expectedX);
      expect(res.y).toBeCloseTo(expectedY);
      expect(res.scale).toBeCloseTo(expectedScale);
    });

    it('진행도가 0 미만 또는 1 초과일 때 안전하게 클램핑된다', () => {
      const under = projectAlongRail(vx, vy, targetX, targetY, -0.5);
      expect(under.x).toBe(vx);
      expect(under.y).toBe(vy);
      expect(under.scale).toBeCloseTo(0.3);

      const over = projectAlongRail(vx, vy, targetX, targetY, 1.5);
      expect(over.x).toBe(targetX);
      expect(over.y).toBe(targetY);
      expect(over.scale).toBeCloseTo(1.2);
    });

    it('사용자 지정 minScale 및 maxScale이 정상 반영된다', () => {
      const res0 = projectAlongRail(vx, vy, targetX, targetY, 0, 0.5, 2.0);
      expect(res0.scale).toBeCloseTo(0.5);

      const res1 = projectAlongRail(vx, vy, targetX, targetY, 1.0, 0.5, 2.0);
      expect(res1.scale).toBeCloseTo(2.0);
    });
  });

  describe('laneToScreenX(vx, laneOffset, depthRatio)', () => {
    const vx = 400;
    const laneOffset = 150;

    it('depthRatio=0 (소실점)일 때 vx를 반환한다', () => {
      expect(laneToScreenX(vx, laneOffset, 0)).toBe(vx);
    });

    it('depthRatio=1 (전경)일 때 vx + laneOffset을 반환한다', () => {
      expect(laneToScreenX(vx, laneOffset, 1.0)).toBe(vx + laneOffset);
    });

    it('음수 laneOffset(좌측 레인)에 대해서도 올바른 화면 X 좌표를 계산한다', () => {
      expect(laneToScreenX(vx, -200, 0.5)).toBe(400 - 100);
    });
  });
});
