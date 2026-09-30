import { describe, it, expect } from 'vitest';
import {
  PoseConstraintValidator,
  CURSOR_RULES,
} from '../../src/editor/PoseConstraintValidator.js';
import type { CatChoreoPattern } from '../../src/data/danceRoutineData.js';

describe('PoseConstraintValidator - 신체 커서 물리 제약 및 검증기 (Phase 2)', () => {
  const validator = new PoseConstraintValidator();

  describe('1. 4색 신체 커서 허용 피트니스 존 룰 검증', () => {
    it('CURSOR_RULES에 왼손, 오른손, 머리, 골반 4대 부위 룰이 명세서대로 정의되어 있다', () => {
      expect(CURSOR_RULES.leftHand.themeColor).toBe('#28E6FF');
      expect(CURSOR_RULES.rightHand.themeColor).toBe('#FFCB4D');
      expect(CURSOR_RULES.head.themeColor).toBe('#C889FF');
      expect(CURSOR_RULES.hip.themeColor).toBe('#FF865E');

      // 머리는 오직 Zone 4, 5만 허용
      expect(CURSOR_RULES.head.allowedZones).toEqual([4, 5]);
      // 골반은 하단 존(6, 8, 9, 10, 11)만 허용 (Zone 7 제외)
      expect(CURSOR_RULES.hip.allowedZones).toEqual([6, 8, 9, 10, 11]);
    });

    it('canAssign()이 부위별 허용 피트니스 존 여부를 정확히 판정한다', () => {
      expect(validator.canAssign('head', 4)).toBe(true);
      expect(validator.canAssign('head', 5)).toBe(true);
      expect(validator.canAssign('head', 1)).toBe(false); // 머리에 상단 존 1 불가

      expect(validator.canAssign('hip', 10)).toBe(true);
      expect(validator.canAssign('hip', 2)).toBe(false); // 골반에 상단 존 2 불가
      expect(validator.canAssign('hip', 7)).toBe(false); // 골반에 중하 존 7 불가

      expect(validator.canAssign('leftHand', 1)).toBe(true);
      expect(validator.canAssign('leftHand', 6)).toBe(true);
      expect(validator.canAssign('rightHand', 3)).toBe(true);
    });
  });

  describe('2. 상세 물리 제약(Cross-Body & Disallowed Zone) 검증', () => {
    it('정상 패턴(CAT_LOW_BOUNCE) 검증 시 유효(valid = true, 위반 0건)를 반환한다', () => {
      const pattern: Partial<CatChoreoPattern> = {
        id: 'CAT_LOW_BOUNCE',
        name: '로우바운스',
        leftHand: 6,
        rightHand: 8,
        head: null,
        hip: 10,
        footZones: [9, 11],
      };

      const result = validator.validateDetailed(pattern);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.crossBodyViolationLines).toHaveLength(0);
    });

    it('골반이 하단(10)에 있고 왼손이 상단(1)에 위치할 때 Cross-Body 위반을 상세 감지한다', () => {
      const pattern: Partial<CatChoreoPattern> = {
        id: 'TEST_CROSS_BODY',
        leftHand: 1, // 상단 좌
        rightHand: 8,
        hip: 10,    // 하단 중앙 -> 10 + 1은 Cross-Body 위반
      };

      const result = validator.validateDetailed(pattern);
      expect(result.valid).toBe(false);

      const crossBodyViolations = result.violations.filter(
        (v) => v.type === 'CROSS_BODY_VIOLATION'
      );
      expect(crossBodyViolations.length).toBeGreaterThan(0);
      expect(crossBodyViolations[0].message).toContain('Cross-Body');
      expect(crossBodyViolations[0].part).toBe('leftHand');

      // 시각화용 연결선 정보
      expect(result.crossBodyViolationLines).toBeDefined();
      expect(result.crossBodyViolationLines).toContainEqual({
        handPart: 'leftHand',
        handZone: 1,
        hipZone: 10,
      });
    });

    it('골반이 하단(9)에 있고 오른손이 상단(3)에 위치할 때도 Cross-Body 위반을 감지한다', () => {
      const pattern: Partial<CatChoreoPattern> = {
        id: 'TEST_CROSS_BODY_2',
        leftHand: 6,
        rightHand: 3, // 상단 우
        hip: 9,      // 좌저 하단 -> 9 + 3은 Cross-Body 위반
      };

      const result = validator.validateDetailed(pattern);
      expect(result.valid).toBe(false);
      expect(result.crossBodyViolationLines).toContainEqual({
        handPart: 'rightHand',
        handZone: 3,
        hipZone: 9,
      });
    });

    it('허용되지 않은 존(예: 머리에 Zone 2) 배정 시 DISALLOWED_ZONE 에러를 반환한다', () => {
      const pattern: Partial<CatChoreoPattern> = {
        id: 'TEST_INVALID_HEAD',
        head: 2, // 머리는 4, 5만 허용
      };

      const result = validator.validateDetailed(pattern);
      expect(result.valid).toBe(false);
      const headViolations = result.violations.filter((v) => v.part === 'head');
      expect(headViolations[0].type).toBe('DISALLOWED_ZONE');
      expect(headViolations[0].message).toContain('머리');
    });

    it('어떤 신체 부위도 지정되지 않은 경우 NO_PART_ASSIGNED 에러를 반환한다', () => {
      const pattern: Partial<CatChoreoPattern> = {
        id: 'EMPTY_PATTERN',
        leftHand: null,
        rightHand: null,
        head: null,
        hip: null,
      };

      const result = validator.validateDetailed(pattern);
      expect(result.valid).toBe(false);
      expect(result.violations[0].type).toBe('NO_PART_ASSIGNED');
    });

    it('[BUG-DANCE-DATA-001 / #244] 발 디딤 존(foot)의 canAssign 및 validateDetailed 상세 검증', () => {
      // 1. canAssign('foot', zoneId)
      expect(validator.canAssign('foot', 9)).toBe(true);
      expect(validator.canAssign('foot', 10)).toBe(true);
      expect(validator.canAssign('foot', 11)).toBe(true);
      expect(validator.canAssign('foot', 1)).toBe(false);
      expect(validator.canAssign('foot', 999)).toBe(false);

      // 2. getAllowedZones('foot')
      expect(validator.getAllowedZones('foot')).toEqual([9, 10, 11]);

      // 3. validateDetailed with invalid footZones
      const badFootPattern: Partial<CatChoreoPattern> = {
        id: 'BAD_FOOT_PATTERN',
        leftHand: 6,
        footZones: [1, 999],
      };
      const badResult = validator.validateDetailed(badFootPattern);
      expect(badResult.valid).toBe(false);
      const footViolations = badResult.violations.filter((v) => v.part === 'foot');
      expect(footViolations.length).toBe(2);
      expect(footViolations.every((v) => v.type === 'DISALLOWED_ZONE')).toBe(true);

      // 4. validateDetailed with duplicate footZones
      const dupFootPattern: Partial<CatChoreoPattern> = {
        id: 'DUP_FOOT_PATTERN',
        leftHand: 6,
        footZones: [9, 9],
      };
      const dupResult = validator.validateDetailed(dupFootPattern);
      expect(dupResult.valid).toBe(false);
      expect(dupResult.violations.some((v) => v.part === 'foot' && v.message.includes('중복'))).toBe(true);
    });
  });
});
