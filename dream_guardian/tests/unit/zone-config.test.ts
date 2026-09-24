import { describe, it, expect } from 'vitest';
import {
  HEAD_ZONES,
  HIP_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
  isCrossBodyViolation,
  isValidZoneForCursor,
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
});
