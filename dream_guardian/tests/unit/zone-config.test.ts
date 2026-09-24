import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FITNESS_ZONES,
  HEAD_ZONES,
  HIP_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
  isCrossBodyViolation,
  isValidZoneForCursor,
  getAnswerButtonLayouts,
} from '../../config/zone.config.js';

describe('Zone Config & Cursor-Zone Matrix (Issue #156 / FEAT-ZONE-003)', () => {
  describe('머리(Head) 허용 구역 개편', () => {
    it('HEAD_ZONES는 중단 좌/우 존(4, 5)만 포함하고 1~3은 배제된다', () => {
      expect(HEAD_ZONES.size).toBe(2);
      expect(HEAD_ZONES.has(4)).toBe(true);
      expect(HEAD_ZONES.has(5)).toBe(true);

      // 상단 점프 불가 구역(1, 2, 3) 배제 확인
      expect(HEAD_ZONES.has(1)).toBe(false);
      expect(HEAD_ZONES.has(2)).toBe(false);
      expect(HEAD_ZONES.has(3)).toBe(false);
      // 하단 존 배제 확인
      expect(HEAD_ZONES.has(6)).toBe(false);
      expect(HEAD_ZONES.has(7)).toBe(false);
      expect(HEAD_ZONES.has(10)).toBe(false);
    });

    it('HEAD_ZONES와 HIP_ZONES는 여전히 상호 배타적이다 (교집합 ∅)', () => {
      const intersection = [...HEAD_ZONES].filter((id) => HIP_ZONES.has(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('양손(leftHand, rightHand) 전 구역 허용', () => {
    it('LEFT_HAND_ZONES와 RIGHT_HAND_ZONES는 전 구역(1~11)을 허용한다', () => {
      expect(LEFT_HAND_ZONES.size).toBe(11);
      expect(RIGHT_HAND_ZONES.size).toBe(11);

      for (let z = 1; z <= 11; z++) {
        expect(LEFT_HAND_ZONES.has(z)).toBe(true);
        expect(RIGHT_HAND_ZONES.has(z)).toBe(true);
      }
    });
  });

  describe('Cross-Body 물리 연동 제약 (isCrossBodyViolation)', () => {
    it('골반이 최하단(9, 10, 11)일 때 손이 최상단(1, 2, 3)에 위치하면 true를 반환한다', () => {
      for (const hipZ of [9, 10, 11]) {
        for (const handZ of [1, 2, 3]) {
          expect(isCrossBodyViolation(handZ, hipZ)).toBe(true);
        }
      }
    });

    it('골반이 중하단(6, 7, 8)일 때는 손이 최상단(1, 2, 3)이어도 위반이 아니다 (false)', () => {
      for (const hipZ of [6, 7, 8]) {
        for (const handZ of [1, 2, 3]) {
          expect(isCrossBodyViolation(handZ, hipZ)).toBe(false);
        }
      }
    });

    it('골반이 최하단(9, 10, 11)이어도 손이 중단/하단(4~11)이면 위반이 아니다 (false)', () => {
      for (const hipZ of [9, 10, 11]) {
        for (const handZ of [4, 5, 6, 7, 8, 9, 10, 11]) {
          expect(isCrossBodyViolation(handZ, hipZ)).toBe(false);
        }
      }
    });
  });

  describe('isValidZoneForCursor', () => {
    it('머리는 4, 5만 유효하다', () => {
      expect(isValidZoneForCursor('head', 4)).toBe(true);
      expect(isValidZoneForCursor('head', 5)).toBe(true);
      expect(isValidZoneForCursor('head', 1)).toBe(false);
      expect(isValidZoneForCursor('head', 2)).toBe(false);
      expect(isValidZoneForCursor('head', 7)).toBe(false);
    });

    it('골반은 6~11만 유효하다', () => {
      expect(isValidZoneForCursor('hip', 6)).toBe(true);
      expect(isValidZoneForCursor('hip', 11)).toBe(true);
      expect(isValidZoneForCursor('hip', 4)).toBe(false);
      expect(isValidZoneForCursor('hip', 5)).toBe(false);
    });

    it('왼손과 오른손은 1~11 모두 유효하다', () => {
      for (let z = 1; z <= 11; z++) {
        expect(isValidZoneForCursor('leftHand', z)).toBe(true);
        expect(isValidZoneForCursor('rightHand', z)).toBe(true);
      }
    });
  });

  describe('답안 버튼 위치 4, 5번 피트니스 존 하단 X축 정렬 배치 (Issue #164 / UI-ANS-002)', () => {
    it('0번 및 1번 답안 버튼이 각각 4번 및 5번 피트니스 존 중심 X축과 일치하고 하단에 배치된다', () => {
      const [btn0, btn1] = getAnswerButtonLayouts(1080, 2160);
      const z4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const z5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

      const z4CenterX = (z4.x + z4.width / 2) * 1080;
      const z5CenterX = (z5.x + z5.width / 2) * 1080;

      // 1. 중심 X축 100% 일치
      expect(btn0.centerX).toBeCloseTo(z4CenterX, 0);
      expect(btn1.centerX).toBeCloseTo(z5CenterX, 0);

      // 2. Y축 위치가 4, 5번 존 바로 아래쪽에 위치
      const z4BottomY = (z4.y + z4.height) * 2160;
      expect(btn0.y).toBeGreaterThan(z4BottomY);
      expect(btn0.y).toBeLessThan(z4BottomY + 60);

      // 3. 버튼 너비가 존 너비와 조화롭게 구성
      expect(btn0.width).toBeGreaterThanOrEqual(260);
      expect(btn1.width).toBeGreaterThanOrEqual(260);
    });
  });
});
