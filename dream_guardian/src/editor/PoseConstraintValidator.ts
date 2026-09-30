/**
 * PoseConstraintValidator.ts - 신체 커서 물리 제약 룰 및 상세 유효성 검증기
 *
 * 명세서 (docs/06_DANCE_CHOREO_EDITOR_SPEC.md 3.2절):
 * - 4색 커서: 왼손(#28E6FF), 오른손(#FFCB4D), 머리(#C889FF), 골반(#FF865E)
 * - 머리: 존 4, 5만 허용
 * - 골반: 존 6, 8, 9, 10, 11만 허용
 * - Cross-Body 제약: 골반 9~11 위치 시 손이 상단 1~3에 위치 불가 (isCrossBodyViolation)
 */

import { isCrossBodyViolation, isValidZoneForCursor, ALLOWED_FOOT_ZONES } from '../../config/zone.config.js';
import type { CatChoreoPattern } from '../data/danceRoutineData.js';

export type BodyCursorPart = 'leftHand' | 'rightHand' | 'head' | 'hip';

export interface CursorRuleDefinition {
  part: BodyCursorPart;
  label: string;
  themeColor: string;
  allowedZones: number[];
}

export const CURSOR_RULES: Record<BodyCursorPart, CursorRuleDefinition> = {
  leftHand: {
    part: 'leftHand',
    label: '왼손',
    themeColor: '#28E6FF',
    allowedZones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  rightHand: {
    part: 'rightHand',
    label: '오른손',
    themeColor: '#FFCB4D',
    allowedZones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  head: {
    part: 'head',
    label: '머리',
    themeColor: '#C889FF',
    allowedZones: [4, 5],
  },
  hip: {
    part: 'hip',
    label: '골반',
    themeColor: '#FF865E',
    allowedZones: [6, 8, 9, 10, 11],
  },
};

export type PoseViolationType =
  | 'CROSS_BODY_VIOLATION'
  | 'DISALLOWED_ZONE'
  | 'NO_PART_ASSIGNED'
  | 'INVALID_FOOT_ZONE'
  | 'DUPLICATE_FOOT_ZONE';

export interface PoseViolationDetail {
  type: PoseViolationType;
  part?: BodyCursorPart | 'foot';
  zoneId?: number;
  message: string;
}

export interface CrossBodyLineInfo {
  handPart: 'leftHand' | 'rightHand';
  handZone: number;
  hipZone: number;
}

export interface DetailedPoseValidationResult {
  valid: boolean;
  violations: PoseViolationDetail[];
  crossBodyViolationLines: CrossBodyLineInfo[];
}

export class PoseConstraintValidator {
  /**
   * 특정 부위가 지정된 피트니스 존에 배치 가능한지 사전 판정
   */
  canAssign(part: BodyCursorPart | 'foot', zoneId: number): boolean {
    if (part === 'foot') {
      return ALLOWED_FOOT_ZONES.includes(zoneId);
    }
    const rule = CURSOR_RULES[part];
    if (!rule) return false;
    return rule.allowedZones.includes(zoneId) && isValidZoneForCursor(part, zoneId);
  }

  /**
   * 해당 부위의 허용 피트니스 존 목록 반환
   */
  getAllowedZones(part: BodyCursorPart | 'foot'): number[] {
    if (part === 'foot') {
      return [...ALLOWED_FOOT_ZONES];
    }
    return CURSOR_RULES[part as BodyCursorPart]?.allowedZones ?? [];
  }

  /**
   * 안무 패턴의 신체 부위 배치 상세 유효성 및 물리 제약 검증
   */
  validateDetailed(pattern: Partial<CatChoreoPattern>): DetailedPoseValidationResult {
    const violations: PoseViolationDetail[] = [];
    const crossBodyViolationLines: CrossBodyLineInfo[] = [];

    const lh = pattern.leftHand ?? null;
    const rh = pattern.rightHand ?? null;
    const head = pattern.head ?? null;
    const hip = pattern.hip ?? null;

    // 1. 최소 1개 부위 지정 확인
    if (lh === null && rh === null && head === null && hip === null) {
      violations.push({
        type: 'NO_PART_ASSIGNED',
        message: '최소 1개 이상의 신체 부위가 피트니스 존에 배치되어야 합니다.',
      });
      return {
        valid: false,
        violations,
        crossBodyViolationLines,
      };
    }

    // 2. 부위별 허용 존 검증 (DISALLOWED_ZONE)
    if (lh !== null && !this.canAssign('leftHand', lh)) {
      violations.push({
        type: 'DISALLOWED_ZONE',
        part: 'leftHand',
        zoneId: lh,
        message: `왼손(Zone ${lh})은 허용되지 않은 존입니다. (허용 존: ${CURSOR_RULES.leftHand.allowedZones.join(', ')})`,
      });
    }

    if (rh !== null && !this.canAssign('rightHand', rh)) {
      violations.push({
        type: 'DISALLOWED_ZONE',
        part: 'rightHand',
        zoneId: rh,
        message: `오른손(Zone ${rh})은 허용되지 않은 존입니다. (허용 존: ${CURSOR_RULES.rightHand.allowedZones.join(', ')})`,
      });
    }

    if (head !== null && !this.canAssign('head', head)) {
      violations.push({
        type: 'DISALLOWED_ZONE',
        part: 'head',
        zoneId: head,
        message: `머리(Zone ${head})는 허용되지 않은 존입니다. (머리는 Zone 4, 5만 허용됩니다)`,
      });
    }

    if (hip !== null && !this.canAssign('hip', hip)) {
      violations.push({
        type: 'DISALLOWED_ZONE',
        part: 'hip',
        zoneId: hip,
        message: `골반(Zone ${hip})은 허용되지 않은 존입니다. (골반은 Zone 6, 8, 9, 10, 11만 허용됩니다)`,
      });
    }

    // 3. Cross-Body 물리 제약 위반 검증
    if (hip !== null) {
      if (lh !== null && isCrossBodyViolation(lh, hip)) {
        violations.push({
          type: 'CROSS_BODY_VIOLATION',
          part: 'leftHand',
          zoneId: lh,
          message: `신체 물리 제약 위반 (Cross-Body): 골반이 Zone ${hip}에 위치할 때 왼손은 상단 Zone ${lh}에 도달할 수 없습니다.`,
        });
        crossBodyViolationLines.push({
          handPart: 'leftHand',
          handZone: lh,
          hipZone: hip,
        });
      }

      if (rh !== null && isCrossBodyViolation(rh, hip)) {
        violations.push({
          type: 'CROSS_BODY_VIOLATION',
          part: 'rightHand',
          zoneId: rh,
          message: `신체 물리 제약 위반 (Cross-Body): 골반이 Zone ${hip}에 위치할 때 오른손은 상단 Zone ${rh}에 도달할 수 없습니다.`,
        });
        crossBodyViolationLines.push({
          handPart: 'rightHand',
          handZone: rh,
          hipZone: hip,
        });
      }
    }

    // 4. 발 디딤 존(footZones) 검증 (Issue #244 / BUG-DANCE-DATA-001)
    if (pattern.footZones !== undefined) {
      if (!Array.isArray(pattern.footZones)) {
        violations.push({
          type: 'INVALID_FOOT_ZONE',
          part: 'foot',
          message: '발 존(footZones)은 배열 형태여야 합니다.',
        });
      } else {
        const seen = new Set<number>();
        for (const fz of pattern.footZones) {
          if (typeof fz !== 'number' || isNaN(fz) || !Number.isInteger(fz)) {
            violations.push({
              type: 'INVALID_FOOT_ZONE',
              part: 'foot',
              message: `발 존 값은 정수여야 합니다. (입력값: ${fz})`,
            });
            continue;
          }
          if (!this.canAssign('foot', fz)) {
            violations.push({
              type: 'DISALLOWED_ZONE',
              part: 'foot',
              zoneId: fz,
              message: `발(Zone ${fz})은 허용되지 않은 존입니다. (발은 Zone 9, 10, 11만 허용됩니다)`,
            });
          }
          if (seen.has(fz)) {
            violations.push({
              type: 'DUPLICATE_FOOT_ZONE',
              part: 'foot',
              zoneId: fz,
              message: `발 존에 중복된 존(Zone ${fz})이 포함되어 있습니다.`,
            });
          }
          seen.add(fz);
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      crossBodyViolationLines,
    };
  }
}

export const poseConstraintValidator = new PoseConstraintValidator();
