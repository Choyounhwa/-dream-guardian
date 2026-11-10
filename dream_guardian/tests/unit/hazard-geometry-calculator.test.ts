/**
 * hazard-geometry-calculator.test.ts - 3D 원근 투영 기하 계산기 단위 테스트
 *
 * @see Issue #639 [REFACTOR-SRP-008]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HazardGeometryCalculator,
  type HazardTargetGeometry,
} from '../../src/render/hazard/HazardGeometryCalculator.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';

describe('HazardGeometryCalculator (Issue #639 - REFACTOR-SRP-008)', () => {
  let calculator: HazardGeometryCalculator;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = vh * 0.24; // 518.4

  beforeEach(() => {
    calculator = new HazardGeometryCalculator();
  });

  describe('1. 소실점 및 원근 투영 좌표 계산 (Perspective Projection Points)', () => {
    it('기본 소실점(vx=vw/2, vy=vh*0.24)을 올바르게 계산한다', () => {
      const vp = calculator.getVanishingPoint(vw, vh);
      expect(vp.x).toBeCloseTo(540, 1);
      expect(vp.y).toBeCloseTo(518.4, 1);
    });

    it('사용자 지정 소실점을 우선 적용한다', () => {
      const customVP = { x: 600, y: 400 };
      const vp = calculator.getVanishingPoint(vw, vh, customVP);
      expect(vp.x).toBe(600);
      expect(vp.y).toBe(400);
    });

    it('진행도 0.0일 때 Y는 정확히 소실점 Y이며, 1.0일 때 전경(화면 92%)에 도달한다', () => {
      const yAtZero = calculator.computeHazardFrontY(0.0, vy, vh);
      const floorH = vh - vy;
      const yAtOne = calculator.computeHazardFrontY(1.0, vy, vh);

      expect(yAtZero).toBeCloseTo(vy, 2);
      expect(yAtOne).toBeCloseTo(vy + floorH * 0.92, 2);
    });

    it('진행도(0.0 ~ 1.0)에 따라 frontY는 단조 증가(Monotonic Increase)한다', () => {
      let prevY = calculator.computeHazardFrontY(0.0, vy, vh);
      for (let p = 0.1; p <= 1.0; p += 0.1) {
        const curY = calculator.computeHazardFrontY(p, vy, vh);
        expect(curY).toBeGreaterThan(prevY);
        prevY = curY;
      }
    });

    it('진행도가 0 미만이거나 1 초과일 때 0.0과 1.0으로 클램핑된다', () => {
      const yNeg = calculator.computeHazardFrontY(-0.5, vy, vh);
      const yPos = calculator.computeHazardFrontY(1.5, vy, vh);

      expect(yNeg).toBeCloseTo(calculator.computeHazardFrontY(0.0, vy, vh), 2);
      expect(yPos).toBeCloseTo(calculator.computeHazardFrontY(1.0, vy, vh), 2);
    });

    it('타이밍 링 배율은 0.0일 때 2.5, 1.0일 때 1.0으로 선형 수축한다', () => {
      expect(calculator.computeTimingRingScale(0.0)).toBeCloseTo(2.5, 2);
      expect(calculator.computeTimingRingScale(0.5)).toBeCloseTo(1.75, 2);
      expect(calculator.computeTimingRingScale(1.0)).toBeCloseTo(1.0, 2);
    });

    it('projectLanePoint는 레인 오프셋과 원근 심도 비율을 곱하여 X 좌표를 투영한다', () => {
      const depthRatio = 0.5;
      const offset = 200;
      const point = calculator.projectLanePoint(vx, offset, depthRatio, 1000);

      expect(point.x).toBe(vx + offset * depthRatio);
      expect(point.y).toBe(1000);
    });

    it('interpolatePerspective는 far 값과 near 값을 depthRatio에 따라 보간한다', () => {
      const farVal = 10;
      const nearVal = 100;
      expect(calculator.interpolatePerspective(farVal, nearVal, 0.0)).toBe(10);
      expect(calculator.interpolatePerspective(farVal, nearVal, 1.0)).toBe(100);
      expect(calculator.interpolatePerspective(farVal, nearVal, 0.5)).toBe(55);
    });
  });

  describe('2. 레인 사각형 기하 계산 (Lane Quad Calculation: Left, Right, Center)', () => {
    it('중앙 레인 사다리꼴(Center Lane: offset=0)은 vx를 기준으로 좌우 대칭이다', () => {
      const quad = calculator.computeLaneTrapezoid({
        vx,
        vy,
        nearY: 1500,
        laneOffset: 0,
        laneWidth: 400,
        depthRatio: 0.6,
      });

      // 소실점 부근 Far
      expect((quad.farLeft.x + quad.farRight.x) / 2).toBeCloseTo(vx, 1);
      // 전경 Near
      expect((quad.nearLeft.x + quad.nearRight.x) / 2).toBeCloseTo(vx, 1);
      // Near 폭이 Far 폭보다 넓어야 함 (원근 효과)
      const farWidth = quad.farRight.x - quad.farLeft.x;
      const nearWidth = quad.nearRight.x - quad.nearLeft.x;
      expect(nearWidth).toBeGreaterThan(farWidth);
      expect(quad.farLeft.y).toBe(vy);
      expect(quad.nearLeft.y).toBe(1500);
    });

    it('좌측 레인(Left Lane: offset < 0) 사다리꼴은 vx보다 좌측에 위치한다', () => {
      const quad = calculator.computeLaneTrapezoid({
        vx,
        vy,
        nearY: 1600,
        laneOffset: -300,
        laneWidth: 200,
        depthRatio: 0.8,
      });

      expect(quad.nearLeft.x).toBeLessThan(vx);
      expect(quad.nearRight.x).toBeLessThan(vx);
      expect(quad.farLeft.x).toBeLessThan(vx);
    });

    it('우측 레인(Right Lane: offset > 0) 사다리꼴은 vx보다 우측에 위치한다', () => {
      const quad = calculator.computeLaneTrapezoid({
        vx,
        vy,
        nearY: 1600,
        laneOffset: 300,
        laneWidth: 200,
        depthRatio: 0.8,
      });

      expect(quad.nearLeft.x).toBeGreaterThan(vx);
      expect(quad.nearRight.x).toBeGreaterThan(vx);
      expect(quad.farRight.x).toBeGreaterThan(vx);
    });

    it('computeStepLaneQuad: left_step과 right_step의 사다리꼴 기하를 올바르게 생성한다', () => {
      const frontY = 1800;
      const depthRatio = 0.7;

      const leftQuad = calculator.computeStepLaneQuad(vw, vx, vy, frontY, depthRatio, 'left');
      const rightQuad = calculator.computeStepLaneQuad(vw, vx, vy, frontY, depthRatio, 'right');

      expect(leftQuad.nearRight.y).toBe(frontY);
      expect(leftQuad.farLeft.y).toBe(vy);
      expect(leftQuad.nearLeft.x).toBeLessThan(vx);

      expect(rightQuad.nearLeft.y).toBe(frontY);
      expect(rightQuad.farRight.y).toBe(vy);
      expect(rightQuad.nearRight.x).toBeGreaterThan(vx);
    });
  });

  describe('3. 위험 구역 및 안전 구역 사다리꼴 계산 (Zone Trapezoid Calculations)', () => {
    it('computeBalanceLanesQuads: balance_left일 때 좌측이 안전 구역, 우측이 위험 구역이다', () => {
      const frontY = 1750;
      const depthRatio = 0.65;

      const { safeQuad, dangerQuad } = calculator.computeBalanceLanesQuads(
        vw,
        vh,
        vx,
        vy,
        frontY,
        depthRatio,
        'left',
      );

      // safeZone은 좌측(vx 좌측)
      expect(safeQuad.nearLeft.x).toBeLessThan(vx);
      expect(safeQuad.nearRight.x).toBeLessThan(vx);

      // dangerZone은 우측(vx 우측)
      expect(dangerQuad.nearLeft.x).toBeGreaterThan(vx);
      expect(dangerQuad.nearRight.x).toBeGreaterThan(vx);
    });

    it('computeBalanceLanesQuads: balance_right일 때 우측이 안전 구역, 좌측이 위험 구역이다', () => {
      const frontY = 1750;
      const depthRatio = 0.65;

      const { safeQuad, dangerQuad } = calculator.computeBalanceLanesQuads(
        vw,
        vh,
        vx,
        vy,
        frontY,
        depthRatio,
        'right',
      );

      expect(safeQuad.nearLeft.x).toBeGreaterThan(vx);
      expect(dangerQuad.nearRight.x).toBeLessThan(vx);
    });

    it('computeBalancePlatformGeometry: 안전 발판 중심 좌표 및 반경을 올바르게 계산한다', () => {
      const frontY = 1700;
      const depthRatio = 0.8;

      const leftPlatform = calculator.computeBalancePlatformGeometry(vw, vx, frontY, depthRatio, 'left');
      expect(leftPlatform.safeCenterX).toBeLessThan(vx);
      expect(leftPlatform.dangerSide).toBe('right');
      expect(leftPlatform.safeRx).toBeGreaterThan(0);
      expect(leftPlatform.safeRy).toBeGreaterThan(0);
      expect(leftPlatform.safeFrontY).toBe(frontY);

      const rightPlatform = calculator.computeBalancePlatformGeometry(vw, vx, frontY, depthRatio, 'right');
      expect(rightPlatform.safeCenterX).toBeGreaterThan(vx);
      expect(rightPlatform.dangerSide).toBe('left');
    });
  });

  describe('4. 장판 목표 기하 및 경계(Bounds) 계산 위임', () => {
    const patterns: PhaseAHazardPattern[] = [
      'jump',
      'left_step',
      'right_step',
      'balance_left',
      'balance_right',
    ];

    it('5종 패턴별 HazardTargetGeometry가 유효한 값(양수 반경, 유효 좌표)을 반환한다', () => {
      for (const pattern of patterns) {
        const geom: HazardTargetGeometry = calculator.getHazardTargetGeometry(pattern, vw, vh);
        expect(geom.targetX).toBeGreaterThan(0);
        expect(geom.targetY).toBeGreaterThan(vy);
        expect(geom.baseRx).toBeGreaterThan(0);
        expect(geom.baseRy).toBeGreaterThan(0);
      }
    });

    it('computeHazardBounds는 보호 슬롯(isProtected=true) 및 올바른 너비/높이를 반환한다', () => {
      for (const pattern of patterns) {
        const bounds = calculator.computeHazardBounds(pattern, vw, vh);
        expect(bounds.isProtected).toBe(true);
        expect(bounds.w).toBeGreaterThan(0);
        expect(bounds.h).toBeGreaterThan(0);
        expect(bounds.width).toBe(bounds.w);
        expect(bounds.height).toBe(bounds.h);
      }
    });

    it('computeTimingRingBounds는 progress=1.0일 때 computeHazardBounds와 동일한 크기를 갖는다', () => {
      const hazardBounds = calculator.computeHazardBounds('jump', vw, vh);
      const ringBounds = calculator.computeTimingRingBounds('jump', 1.0, vw, vh);

      expect(ringBounds.w).toBeCloseTo(hazardBounds.w, 1);
      expect(ringBounds.h).toBeCloseTo(hazardBounds.h, 1);
      expect(ringBounds.x).toBeCloseTo(hazardBounds.x, 1);
      expect(ringBounds.y).toBeCloseTo(hazardBounds.y, 1);
    });

    it('computeSafeZoneBounds는 각 패턴에 대해 유효한 안전 영역 경계를 반환한다', () => {
      for (const pattern of patterns) {
        const safeBounds = calculator.computeSafeZoneBounds(pattern, vw, vh);
        expect(safeBounds.isProtected).toBe(true);
        expect(safeBounds.w).toBeGreaterThan(0);
        expect(safeBounds.h).toBeGreaterThan(0);
      }
    });

    it('computeWarningLabelBounds와 computeTimingGuideBounds는 적절한 가이드 레이아웃을 산출한다', () => {
      const warnBounds = calculator.computeWarningLabelBounds('jump', vw, vh);
      expect(warnBounds.w).toBeGreaterThan(0);
      expect(warnBounds.h).toBeGreaterThan(0);
      expect(warnBounds.isProtected).toBe(false);

      const guideBounds = calculator.computeTimingGuideBounds('jump', vw, vh);
      expect(guideBounds.w).toBeGreaterThan(0);
      expect(guideBounds.h).toBeGreaterThan(0);
    });
  });
});
