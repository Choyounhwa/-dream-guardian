import { describe, it, expect } from 'vitest';
import { PoseBlender, blendAngles, blend } from '../../src/skeleton/anim/PoseBlender.js';

describe('PoseBlender', () => {
  describe('blendAngles', () => {
    it('weight가 0이면 baseAngle을 반환한다', () => {
      expect(blendAngles(1.2, 2.5, 0)).toBeCloseTo(1.2, 5);
      expect(PoseBlender.blendAngles(1.2, 2.5, 0)).toBeCloseTo(1.2, 5);
    });

    it('weight가 1이면 overlayAngle을 반환한다', () => {
      expect(blendAngles(1.2, 2.5, 1)).toBeCloseTo(2.5, 5);
    });

    it('weight가 0.5이면 두 각도의 중간값을 반환한다', () => {
      expect(blendAngles(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 5);
    });

    it('각도 경계(-PI ~ PI)를 지날 때 diffAngle을 통해 최단 경로로 보간한다', () => {
      // 3.0(약 171도)과 -3.0(약 -171도) 사이의 최단 거리는 0.28318... rad (약 18도)
      // 중간값은 Math.PI 또는 -Math.PI 방향이어야 함
      const base = 3.0;
      const overlay = -3.0;
      const blended = blendAngles(base, overlay, 0.5);
      // diff = (-3.0 - 3.0) = -6.0 -> + 2*PI = 0.283185...
      // blended = 3.0 + 0.5 * 0.283185... = 3.14159...
      expect(blended).toBeCloseTo(Math.PI, 3);
    });
  });

  describe('blend (Record<string, number>)', () => {
    const baseAngles: Record<string, number> = {
      torso: -Math.PI / 2,
      arm_left: 0,
      arm_right: 0,
      leg_left: Math.PI / 2,
    };

    const overlayAngles: Record<string, number> = {
      arm_left: Math.PI / 2,
      arm_right: -Math.PI / 2,
      head: 0.1,
    };

    it('weight가 0이면 원본 baseAngles와 동일한 값을 반환한다', () => {
      const result = blend(baseAngles, overlayAngles, 0);
      expect(result).toEqual(baseAngles);
    });

    it('weight가 1이면 overlayAngles의 본들이 합성된다', () => {
      const result = blend(baseAngles, overlayAngles, 1);
      expect(result.torso).toBeCloseTo(-Math.PI / 2, 5);
      expect(result.arm_left).toBeCloseTo(Math.PI / 2, 5);
      expect(result.arm_right).toBeCloseTo(-Math.PI / 2, 5);
      expect(result.leg_left).toBeCloseTo(Math.PI / 2, 5);
      expect(result.head).toBeCloseTo(0.1, 5);
    });

    it('weight 0.5 적용 시 각 본별로 정확히 중간 각도로 합성된다', () => {
      const result = blend(baseAngles, overlayAngles, 0.5);
      expect(result.arm_left).toBeCloseTo(Math.PI / 4, 5);
      expect(result.arm_right).toBeCloseTo(-Math.PI / 4, 5);
      expect(result.torso).toBeCloseTo(-Math.PI / 2, 5);
    });

    it('boneMask(Set)가 지정되면 마스크에 포함된 본만 합성하고 나머지는 baseAngles를 유지한다', () => {
      const mask = new Set(['arm_left']);
      const result = blend(baseAngles, overlayAngles, 1.0, mask);
      expect(result.arm_left).toBeCloseTo(Math.PI / 2, 5);
      expect(result.arm_right).toBeCloseTo(0, 5); // base 유지
      expect(result.head).toBeUndefined(); // mask에 없으므로 추가되지 않음
      expect(result.torso).toBeCloseTo(-Math.PI / 2, 5);
    });

    it('boneMask(string[]) 배열 형태로도 마스크를 지정할 수 있다', () => {
      const result = blend(baseAngles, overlayAngles, 1.0, ['arm_right']);
      expect(result.arm_left).toBeCloseTo(0, 5); // base 유지
      expect(result.arm_right).toBeCloseTo(-Math.PI / 2, 5);
    });

    it('인스턴스 메서드로도 정적 메서드와 동일하게 작동한다', () => {
      const blender = new PoseBlender();
      const result = blender.blend(baseAngles, overlayAngles, 0.5, ['arm_left']);
      expect(result.arm_left).toBeCloseTo(Math.PI / 4, 5);
      expect(result.arm_right).toBeCloseTo(0, 5);
    });
  });
});
