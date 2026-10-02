/**
 * pose-geometry.test.ts - 모션·포즈 공통 기하학 유틸리티 단위 테스트
 *
 * @see Issue #297 [REFACTOR-GEOM-001]
 */

import { describe, it, expect } from 'vitest';
import {
  PoseGeometry,
  mirrorX,
  mirrorPoint,
  calcShoulderWidth,
  normalizeByShoulder,
  calcLateralReach,
  calcDominanceRatio,
  calcDistance,
  calcArmExtensionRatio,
  calcVelocity,
  calcNormalizedZoneDistance,
  calcNormalizedRadialDistance,
  clamp,
  clamp01,
  lerp,
  lerpPoint,
  calcMidpoint,
  calcVector,
  calcJointAngle,
  isPointInRect,
  calcRectOutsideDistance,
  calcPointsVariance,
  clampPointToRect,
} from '../../src/utils/PoseGeometry.js';

describe('PoseGeometry Utility', () => {
  describe('mirrorX', () => {
    it('정규화 좌표를 반전(1 - x)한다', () => {
      expect(mirrorX(0.2)).toBeCloseTo(0.8);
      expect(mirrorX(0.5)).toBeCloseTo(0.5);
      expect(mirrorX(0.7)).toBeCloseTo(0.3);
      expect(mirrorX(0)).toBeCloseTo(1.0);
      expect(mirrorX(1)).toBeCloseTo(0.0);
    });

    it('[0, 1] 범위를 벗어난 값을 안전하게 클램핑한다', () => {
      expect(mirrorX(-0.2)).toBe(1.0);
      expect(mirrorX(1.3)).toBe(0.0);
    });
  });

  describe('mirrorPoint', () => {
    it('isMirrored가 true일 때 x좌표만 반전하고 y좌표는 유지한다', () => {
      const pt = { x: 0.3, y: 0.4 };
      const mirrored = mirrorPoint(pt, true);
      expect(mirrored.x).toBeCloseTo(0.7);
      expect(mirrored.y).toBe(0.4);
    });

    it('isMirrored가 false일 때 원래 좌표를 그대로 반환한다', () => {
      const pt = { x: 0.3, y: 0.4 };
      const unchanged = mirrorPoint(pt, false);
      expect(unchanged.x).toBe(0.3);
      expect(unchanged.y).toBe(0.4);
    });
  });

  describe('calcShoulderWidth', () => {
    it('좌우 어깨 좌표 간의 유클리드 거리를 계산한다', () => {
      const leftShoulder = { x: 0.40, y: 0.35 };
      const rightShoulder = { x: 0.60, y: 0.35 };
      expect(calcShoulderWidth(leftShoulder, rightShoulder)).toBeCloseTo(0.20);
    });

    it('대각선 어깨 위치에서도 거리를 올바르게 계산한다', () => {
      const leftShoulder = { x: 0.30, y: 0.10 };
      const rightShoulder = { x: 0.60, y: 0.50 }; // dx=0.3, dy=0.4 -> hypot=0.5
      expect(calcShoulderWidth(leftShoulder, rightShoulder)).toBeCloseTo(0.50);
    });

    it('거리 0 또는 0에 근접한 경우 fallback 값을 반환한다', () => {
      const p = { x: 0.5, y: 0.5 };
      expect(calcShoulderWidth(p, p)).toBeCloseTo(0.20);
      expect(calcShoulderWidth(p, p, 0.30)).toBeCloseTo(0.30);
    });
  });

  describe('normalizeByShoulder', () => {
    it('좌우 어깨 좌표를 받아 어깨 너비로 값을 정규화한다', () => {
      const leftShoulder = { x: 0.40, y: 0.35 };
      const rightShoulder = { x: 0.60, y: 0.35 }; // width = 0.20
      const normalized = normalizeByShoulder(0.10, leftShoulder, rightShoulder);
      expect(normalized).toBeCloseTo(0.50);
    });

    it('어깨 너비 숫자를 직접 받아 정규화한다', () => {
      const normalized = normalizeByShoulder(0.15, 0.30);
      expect(normalized).toBeCloseTo(0.50);
    });

    it('어깨 너비가 0 또는 거의 0일 때 0으로 나누지 않고 fallback을 사용한다', () => {
      const normalized = normalizeByShoulder(0.10, 0, undefined, 0.20);
      expect(normalized).toBeCloseTo(0.50);
      expect(Number.isFinite(normalized)).toBe(true);
    });
  });

  describe('calcLateralReach', () => {
    it('왼쪽 방향으로 뻗었을 때 양수 비율을 반환한다 (어깨X > 손목X)', () => {
      const wristX = 0.30;
      const shoulderX = 0.50;
      const shoulderWidth = 0.20;
      // (0.50 - 0.30) / 0.20 = 1.0
      expect(calcLateralReach(wristX, shoulderX, shoulderWidth)).toBeCloseTo(1.0);
    });

    it('오른쪽 방향으로 뻗었을 때 음수 비율을 반환한다 (어깨X < 손목X)', () => {
      const wristX = 0.70;
      const shoulderX = 0.50;
      const shoulderWidth = 0.20;
      // (0.50 - 0.70) / 0.20 = -1.0
      expect(calcLateralReach(wristX, shoulderX, shoulderWidth)).toBeCloseTo(-1.0);
    });

    it('손목과 어깨 X좌표가 같을 때 0을 반환한다', () => {
      expect(calcLateralReach(0.50, 0.50, 0.20)).toBe(0);
    });

    it('어깨 너비가 0 이하일 때 fallback을 적용하여 안전하게 계산한다', () => {
      const reach = calcLateralReach(0.40, 0.50, 0, 0.20);
      expect(reach).toBeCloseTo(0.50);
    });
  });

  describe('calcDominanceRatio', () => {
    it('수평 우세(|dx| / (|dy| + epsilon)) 비율을 계산한다', () => {
      const ratio = calcDominanceRatio(0.30, 0.10);
      expect(ratio).toBeCloseTo(3.0, 1);
    });

    it('수직 변위가 0일 때도 epsilon으로 인해 무한대가 되지 않고 안전하게 처리된다', () => {
      const ratio = calcDominanceRatio(0.30, 0);
      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(0);
    });

    it('음수 변위도 절댓값으로 처리한다', () => {
      const ratio = calcDominanceRatio(-0.20, -0.10);
      expect(ratio).toBeCloseTo(2.0, 1);
    });
  });

  describe('calcDistance', () => {
    it('두 점 사이의 유클리드 거리를 계산한다', () => {
      expect(calcDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5.0);
      expect(calcDistance({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(0);
    });
  });

  describe('calcArmExtensionRatio', () => {
    it('어깨로부터 손목까지의 거리를 어깨 너비로 나눈 비율을 계산한다', () => {
      const wrist = { x: 0.30, y: 0.35 };
      const shoulder = { x: 0.50, y: 0.35 };
      const ratio = calcArmExtensionRatio(wrist, shoulder, 0.20);
      expect(ratio).toBeCloseTo(1.0);
    });
  });

  describe('calcVelocity', () => {
    it('시간 변화량 dt에 따른 x, y 속도를 계산한다', () => {
      const current = { x: 0.60, y: 0.40 };
      const prev = { x: 0.50, y: 0.30 };
      const vel = calcVelocity(current, prev, 0.1);
      expect(vel.vx).toBeCloseTo(1.0);
      expect(vel.vy).toBeCloseTo(1.0);
    });

    it('dt가 0 이하이거나 prev가 null일 때 속도 0을 반환한다', () => {
      const current = { x: 0.60, y: 0.40 };
      expect(calcVelocity(current, null, 0.1)).toEqual({ vx: 0, vy: 0 });
      expect(calcVelocity(current, { x: 0.5, y: 0.3 }, 0)).toEqual({ vx: 0, vy: 0 });
    });
  });

  describe('calcNormalizedZoneDistance', () => {
    it('존 중심에서는 정규화 거리가 0이다', () => {
      const zone = { x: 0.1, y: 0.2, width: 0.2, height: 0.2 };
      const center = { x: 0.2, y: 0.3 };
      expect(calcNormalizedZoneDistance(center, zone)).toBeCloseTo(0);
    });

    it('존 가장자리(1반폭 거리)에서는 정규화 거리가 1이다', () => {
      const zone = { x: 0.1, y: 0.2, width: 0.2, height: 0.2 };
      const edge = { x: 0.3, y: 0.3 }; // x 방향으로 halfW = 0.1 이동
      expect(calcNormalizedZoneDistance(edge, zone)).toBeCloseTo(1.0);
    });
  });

  describe('calcNormalizedRadialDistance', () => {
    it('존 중심에서는 정규화 방사형 거리가 0이다', () => {
      const zone = { x: 0.1, y: 0.2, width: 0.2, height: 0.2 };
      const center = { x: 0.2, y: 0.3 };
      expect(calcNormalizedRadialDistance(center, zone)).toBeCloseTo(0);
    });

    it('대각선 가장자리(x 0.9, y 0.9)에서는 유클리드 거리가 sqrt(0.8^2 + 0.8^2)이다', () => {
      const zone = { x: 0, y: 0, width: 1, height: 1 };
      const pt = { x: 0.9, y: 0.9 }; // halfW = 0.5, dx = 0.4 / 0.5 = 0.8, dy = 0.8
      expect(calcNormalizedRadialDistance(pt, zone)).toBeCloseTo(Math.hypot(0.8, 0.8));
    });
  });

  describe('clamp & clamp01', () => {
    it('임의의 범위 [min, max]로 값을 클램핑한다', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-2, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('clamp01은 [0, 1] 범위로 값을 클램핑한다', () => {
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(-0.2)).toBe(0);
      expect(clamp01(1.5)).toBe(1);
    });
  });

  describe('lerp & lerpPoint', () => {
    it('두 스칼라 값 간의 선형 보간을 계산한다', () => {
      expect(lerp(10, 20, 0.5)).toBeCloseTo(15);
      expect(lerp(0, 100, 0.25)).toBeCloseTo(25);
      expect(lerp(5, 5, 0.8)).toBeCloseTo(5);
    });

    it('두 2D 점 간의 선형 보간 점을 계산한다', () => {
      const p1 = { x: 0, y: 10 };
      const p2 = { x: 10, y: 20 };
      const res = lerpPoint(p1, p2, 0.5);
      expect(res.x).toBeCloseTo(5);
      expect(res.y).toBeCloseTo(15);
    });
  });

  describe('calcMidpoint & calcVector', () => {
    it('두 점의 중점 좌표를 계산한다', () => {
      const p1 = { x: 2, y: 4 };
      const p2 = { x: 6, y: 8 };
      const mid = calcMidpoint(p1, p2);
      expect(mid.x).toBeCloseTo(4);
      expect(mid.y).toBeCloseTo(6);
    });

    it('p1에서 p2로 향하는 벡터를 계산한다', () => {
      const p1 = { x: 1, y: 2 };
      const p2 = { x: 4, y: 6 };
      const vec = calcVector(p1, p2);
      expect(vec.x).toBeCloseTo(3);
      expect(vec.y).toBeCloseTo(4);
    });
  });

  describe('calcJointAngle', () => {
    it('직각(90도) 관절 각도를 도(degree) 단위로 계산한다', () => {
      const p1 = { x: 0, y: 1 };
      const p2 = { x: 0, y: 0 }; // vertex
      const p3 = { x: 1, y: 0 };
      expect(calcJointAngle(p1, p2, p3)).toBeCloseTo(90);
    });

    it('일직선(180도) 관절 각도를 계산한다', () => {
      const p1 = { x: -1, y: 0 };
      const p2 = { x: 0, y: 0 };
      const p3 = { x: 1, y: 0 };
      expect(calcJointAngle(p1, p2, p3)).toBeCloseTo(180);
    });

    it('동일 방향(0도) 관절 각도를 계산한다', () => {
      const p1 = { x: 1, y: 0 };
      const p2 = { x: 0, y: 0 };
      const p3 = { x: 1, y: 0 };
      expect(calcJointAngle(p1, p2, p3)).toBeCloseTo(0);
    });

    it('라디안 단위 요청 시 라디안 값을 반환한다', () => {
      const p1 = { x: 0, y: 1 };
      const p2 = { x: 0, y: 0 };
      const p3 = { x: 1, y: 0 };
      expect(calcJointAngle(p1, p2, p3, false)).toBeCloseTo(Math.PI / 2);
    });

    it('퇴화된 점(길이 0)인 경우 0을 반환한다', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 0, y: 0 };
      const p3 = { x: 1, y: 0 };
      expect(calcJointAngle(p1, p2, p3)).toBe(0);
    });

    it('3차원 z 좌표를 포함한 공간 각도를 계산한다', () => {
      const p1 = { x: 0, y: 1, z: 0 };
      const p2 = { x: 0, y: 0, z: 0 };
      const p3 = { x: 0, y: 0, z: 1 };
      expect(calcJointAngle(p1, p2, p3)).toBeCloseTo(90);
    });
  });

  describe('isPointInRect', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };

    it('점이 사각형 내부에 있으면 true를 반환한다', () => {
      expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(true);
      expect(isPointInRect({ x: 0, y: 0 }, rect)).toBe(true);
      expect(isPointInRect({ x: 10, y: 10 }, rect)).toBe(true);
    });

    it('점이 사각형 외부에 있으면 false를 반환한다', () => {
      expect(isPointInRect({ x: -1, y: 5 }, rect)).toBe(false);
      expect(isPointInRect({ x: 11, y: 5 }, rect)).toBe(false);
      expect(isPointInRect({ x: 5, y: 11 }, rect)).toBe(false);
    });

    it('마진을 적용하여 영역을 확장해 판정한다', () => {
      expect(isPointInRect({ x: -1, y: 5 }, rect, 2)).toBe(true);
      expect(isPointInRect({ x: 11, y: 5 }, rect, 2)).toBe(true);
      expect(isPointInRect({ x: 13, y: 5 }, rect, 2)).toBe(false);
    });
  });

  describe('calcRectOutsideDistance', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };

    it('사각형 내부 점의 외곽 거리는 0이다', () => {
      expect(calcRectOutsideDistance({ x: 5, y: 5 }, rect)).toBe(0);
    });

    it('사각형 우측 외부 점의 외곽 거리를 계산한다', () => {
      expect(calcRectOutsideDistance({ x: 13, y: 5 }, rect)).toBeCloseTo(3);
    });

    it('대각선 외부 점의 유클리드 거리를 계산한다', () => {
      // x: 13 (distX = 3), y: 14 (distY = 4) -> hypot = 5
      expect(calcRectOutsideDistance({ x: 13, y: 14 }, rect)).toBeCloseTo(5);
    });
  });

  describe('calcPointsVariance', () => {
    it('점 목록이 2개 미만이면 0을 반환한다', () => {
      expect(calcPointsVariance([])).toBe(0);
      expect(calcPointsVariance([{ x: 1, y: 1 }])).toBe(0);
    });

    it('동일한 점들의 분산은 0이다', () => {
      expect(calcPointsVariance([{ x: 2, y: 3 }, { x: 2, y: 3 }])).toBeCloseTo(0);
    });

    it('2D 점들의 평균 대비 분산을 올바르게 계산한다', () => {
      const points = [{ x: 0, y: 0 }, { x: 2, y: 0 }];
      // mean = (1, 0), dx = -1, 1 -> sumSq = 1 + 1 = 2, var = 2 / 2 = 1
      expect(calcPointsVariance(points)).toBeCloseTo(1);
    });
  });

  describe('clampPointToRect', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };

    it('내부 점은 그대로 유지된다', () => {
      const clamped = clampPointToRect({ x: 5, y: 5 }, rect);
      expect(clamped.x).toBe(5);
      expect(clamped.y).toBe(5);
    });

    it('외부 점은 사각형 경계로 클램핑된다', () => {
      const clamped = clampPointToRect({ x: -5, y: 15 }, rect);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(10);
    });
  });

  describe('mirrorPoint 클램핑 옵션', () => {
    it('clamp 옵션이 false이면 [0, 1] 범위를 벗어난 반전 좌표를 그대로 보존한다', () => {
      const res = mirrorPoint({ x: -0.4, y: 0.4 }, true, false);
      expect(res.x).toBeCloseTo(1.4);
      expect(res.y).toBe(0.4);
    });

    it('기본값(clamp: true)에서는 [0, 1] 범위로 클램핑한다', () => {
      const res = mirrorPoint({ x: -0.4, y: 0.4 }, true);
      expect(res.x).toBeCloseTo(1.0);
    });
  });

  describe('PoseGeometry 네임스페이스 객체', () => {
    it('모든 유틸리티 함수를 객체 프로퍼티로 제공한다', () => {
      expect(typeof PoseGeometry.mirrorX).toBe('function');
      expect(typeof PoseGeometry.calcLateralReach).toBe('function');
      expect(typeof PoseGeometry.normalizeByShoulder).toBe('function');
      expect(typeof PoseGeometry.calcDominanceRatio).toBe('function');
      expect(typeof PoseGeometry.calcShoulderWidth).toBe('function');
      expect(typeof PoseGeometry.calcNormalizedRadialDistance).toBe('function');
      expect(typeof PoseGeometry.clamp).toBe('function');
      expect(typeof PoseGeometry.clamp01).toBe('function');
      expect(typeof PoseGeometry.lerp).toBe('function');
      expect(typeof PoseGeometry.lerpPoint).toBe('function');
      expect(typeof PoseGeometry.calcMidpoint).toBe('function');
      expect(typeof PoseGeometry.calcVector).toBe('function');
      expect(typeof PoseGeometry.calcJointAngle).toBe('function');
      expect(typeof PoseGeometry.isPointInRect).toBe('function');
      expect(typeof PoseGeometry.calcRectOutsideDistance).toBe('function');
      expect(typeof PoseGeometry.calcPointsVariance).toBe('function');
      expect(typeof PoseGeometry.clampPointToRect).toBe('function');
    });
  });
});
