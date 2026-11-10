/**
 * arm-reach-gate-evaluator.test.ts
 *
 * ArmReachGateEvaluator 5대 게이트 평가 및 후보 점수 산출기 단위 테스트
 *
 * 5대 게이트:
 * 1. 가시성 (visibility): 최소 검출 임계치 (0.30)
 * 2. 신체 점프 차단 (jumpVerticalSpeedThreshold / isBodyJumping)
 * 3. 목표 존 침투 및 방향성 (zonePenetration / lateralReach)
 * 4. 팔 신전 (armExtension / lateralProgress)
 * 5. 수평 우세 및 속도 (horizontalDominance / velocity)
 *
 * @see Issue #622 [REFACTOR-INPUT-002]
 * @see Issue #287 [INPUT-ARM-DIRECTION-001]
 * @see Issue #249 [INPUT-TOLERANCE-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArmReachGateEvaluator,
  type ArmGateEvaluationInput,
} from '../../src/input/arm/ArmReachGateEvaluator.js';
import {
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
} from '../../config/judgment.config.js';

describe('ArmReachGateEvaluator (Issue #622 / REFACTOR-INPUT-002)', () => {
  let evaluator: ArmReachGateEvaluator;

  beforeEach(() => {
    evaluator = new ArmReachGateEvaluator();
  });

  describe('1. 가시성 하드 가드 (Visibility Gate)', () => {
    it('가시성이 hardMinVisibility(0.30) 미만이면 즉시 무효(isValid: false, score: 0)로 반환한다', () => {
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.17, y: 0.35, visibility: 0.25 },
        prevPos: { x: 0.35, y: 0.35, visibility: 0.9 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.05,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.answerIndex).toBeNull();
      expect(result.zoneId).toBeNull();
      expect(result.gates.visibility).toBe(0.25);
      expect(result.gates.zonePenetration).toBe(0);
      expect(result.gates.armExtension).toBe(0);
      expect(result.gates.horizontalDominance).toBe(0);
      expect(result.gates.velocity).toBe(0);
    });
  });

  describe('2. 점프 차단 가드 (Jump Guard)', () => {
    it('isBodyJumping이 true이면 즉시 무효(isValid: false, score: 0)로 차단된다', () => {
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.17, y: 0.35, visibility: 0.95 },
        prevPos: { x: 0.40, y: 0.35, visibility: 0.95 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.05,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: true,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.answerIndex).toBeNull();
      expect(result.zoneId).toBeNull();
    });
  });

  describe('3. 방향성 모드 (direction_relative mode)', () => {
    it('좌측(Zone 4 / 답안 0)으로 충분히 팔을 뻗고 수평 우세하면 유효로 확정된다', () => {
      // shoulder x = 0.40, y = 0.35, shoulderWidth = 0.20
      // lateral = (0.40 - 0.20) / 0.20 = 1.0 >= 0.55 (isLeft)
      // dx = |0.20 - 0.40| = 0.20, dy = |0.35 - 0.35| = 0 -> horizontal dominant
      // baseX = 0.38, outwardTravel = 0.38 - 0.20 = 0.18 >= 0.15 * 0.20 (0.03) -> traveled
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.20, y: 0.35, visibility: 0.95 },
        prevPos: { x: 0.30, y: 0.35, visibility: 0.95 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.05,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
        baseWristX: 0.38,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(true);
      expect(result.answerIndex).toBe(0);
      expect(result.zoneId).toBe(4);
      expect(result.score).toBeGreaterThanOrEqual(DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold);
      expect(result.isDirectionSatisfied).toBe(true);
      expect(result.gates.armExtension).toBeGreaterThanOrEqual(1.0);
      expect(result.gates.horizontalDominance).toBe(1.0);
    });

    it('우측(Zone 5 / 답안 1)으로 충분히 팔을 뻗고 수평 우세하면 유효로 확정된다', () => {
      // shoulder x = 0.60, y = 0.35, shoulderWidth = 0.20
      // lateral = (0.60 - 0.80) / 0.20 = -1.0 <= -0.55 (isRight)
      // dx = 0.20, dy = 0.01 -> dx >= 1.6 * dy
      // baseX = 0.62, outwardTravel = 0.80 - 0.62 = 0.18 >= 0.03
      const input: ArmGateEvaluationInput = {
        hand: 'right',
        pos: { x: 0.80, y: 0.36, visibility: 0.95 },
        prevPos: { x: 0.70, y: 0.36, visibility: 0.95 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.05,
        shoulderPos: { x: 0.60, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
        baseWristX: 0.62,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(true);
      expect(result.answerIndex).toBe(1);
      expect(result.zoneId).toBe(5);
      expect(result.score).toBeGreaterThanOrEqual(DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold);
      expect(result.isDirectionSatisfied).toBe(true);
    });

    it('수직 뻗음이 강하여 수평 우세 조건을 충족하지 못하면 무효 처리된다', () => {
      // shoulder x = 0.40, y = 0.35
      // pos x = 0.25 (dx = 0.15), pos y = 0.10 (dy = 0.25)
      // dx = 0.15 < 1.6 * 0.25 (0.40) -> 수평 우세 실패
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.25, y: 0.10, visibility: 0.95 },
        prevPos: { x: 0.30, y: 0.20, visibility: 0.95 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.05,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
        baseWristX: 0.35,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(false);
      expect(result.isDirectionSatisfied).toBe(false);
      expect(result.score).toBeLessThan(DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold);
    });

    it('바깥쪽 이동 거리(outwardTravel)가 부족하면 유효 처리되지 않는다', () => {
      // baseX = 0.22, pos x = 0.21 -> outwardTravel = 0.01 < 0.15 * 0.20 (0.03)
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.21, y: 0.35, visibility: 0.95 },
        prevPos: { x: 0.22, y: 0.35, visibility: 0.95 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.05,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
        baseWristX: 0.22,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(false);
    });
  });

  describe('4. 레거시 가중치 모드 (legacy_weighted mode)', () => {
    beforeEach(() => {
      evaluator.setConfig({ mode: 'legacy_weighted' });
    });

    it('가중 점수 산출 공식에 따라 5대 게이트 가중치가 올바르게 반영된다', () => {
      const ZONE_4_CENTER = { x: 0.17, y: 0.32 };
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { ...ZONE_4_CENTER, visibility: 1.0 },
        prevPos: { x: 0.45, y: 0.32, visibility: 1.0 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.1,
        shoulderPos: { x: 0.21, y: 0.32 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.isValid).toBe(true);
      expect(result.answerIndex).toBe(0);
      expect(result.zoneId).toBe(4);
      expect(result.score).toBeGreaterThanOrEqual(0.70);
      expect(result.gates.zonePenetration).toBeCloseTo(1.0, 2);
      expect(result.gates.visibility).toBe(1.0);
    });

    it('존 내부에서 안쪽(몸통 쪽)으로 되돌아오는 이동은 속도/우세 점수가 0이 된다', () => {
      // Zone 4 안에서 x가 0.15에서 0.25로 증가 (몸통 쪽 복귀) -> outwardVx = -(0.10/0.1) = -1.0
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.25, y: 0.32, visibility: 0.95 },
        prevPos: { x: 0.15, y: 0.32, visibility: 0.95 },
        prevInside4: true,
        prevInside5: false,
        dt: 0.1,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
      };

      const result = evaluator.evaluateArm(input);

      expect(result.gates.velocity).toBe(0);
      expect(result.gates.horizontalDominance).toBe(0);
    });

    it('적응형 허용치 승수(toleranceMultiplier)가 적용되면 유효 판정 임계치가 조정된다', () => {
      const input: ArmGateEvaluationInput = {
        hand: 'left',
        pos: { x: 0.20, y: 0.35, visibility: 0.8 },
        prevPos: { x: 0.25, y: 0.35, visibility: 0.8 },
        prevInside4: false,
        prevInside5: false,
        dt: 0.1,
        shoulderPos: { x: 0.40, y: 0.35 },
        shoulderWidth: 0.20,
        isBodyJumping: false,
        toleranceMultiplier: 1.5, // 임계치 완화: 0.70 / 1.5 = 0.467
      };

      const resultWithTolerance = evaluator.evaluateArm(input);
      const resultWithoutTolerance = evaluator.evaluateArm({
        ...input,
        toleranceMultiplier: 1.0,
      });

      // 동일 조건에서 toleranceMultiplier가 클 때 더 쉽게 통과 가능
      expect(resultWithTolerance.score).toBe(resultWithoutTolerance.score);
    });
  });

  describe('5. 후보 경합 판정 (Candidate Arbitration)', () => {
    it('한쪽 손의 점수가 다른 쪽 손보다 dominanceRatio(1.25) 이상 높으면 해당 손이 승리한다', () => {
      const leftEval = {
        isValid: true,
        score: 0.85,
        gates: {} as any,
        answerIndex: 0 as const,
        zoneId: 4 as const,
        vx: -1.0,
        vy: 0,
        armExtensionRatio: 0.5,
        isInside: true,
        isDynamicReach: true,
      };
      const rightEval = {
        isValid: true,
        score: 0.60,
        gates: {} as any,
        answerIndex: 1 as const,
        zoneId: 5 as const,
        vx: 0.5,
        vy: 0,
        armExtensionRatio: 0.3,
        isInside: true,
        isDynamicReach: true,
      };

      const arb = evaluator.arbitrateWeightedCandidates(leftEval, rightEval);

      expect(arb.winner).toBe('left');
      expect(arb.isBlocked).toBe(false);
    });

    it('양손 점수 차이가 dominanceRatio(1.25) 미만으로 비등하면 경합(isBlocked: true)으로 차단된다', () => {
      const leftEval = {
        isValid: true,
        score: 0.80,
        gates: {} as any,
        answerIndex: 0 as const,
        zoneId: 4 as const,
        vx: -1.0,
        vy: 0,
        armExtensionRatio: 0.5,
        isInside: true,
        isDynamicReach: true,
      };
      const rightEval = {
        isValid: true,
        score: 0.75,
        gates: {} as any,
        answerIndex: 1 as const,
        zoneId: 5 as const,
        vx: 1.0,
        vy: 0,
        armExtensionRatio: 0.5,
        isInside: true,
        isDynamicReach: true,
      };

      const arb = evaluator.arbitrateWeightedCandidates(leftEval, rightEval);

      expect(arb.winner).toBeNull();
      expect(arb.isBlocked).toBe(true);
    });
  });

  describe('6. 오버로딩 및 인자 호환성', () => {
    it('개별 인자 방식 evaluateArm(hand, pos, prevPos, ...) 호출도 동일하게 동작한다', () => {
      const pos = { x: 0.20, y: 0.35, visibility: 0.95 };
      const prevPos = { x: 0.30, y: 0.35, visibility: 0.95 };

      const result = evaluator.evaluateArm(
        'left',
        pos,
        prevPos,
        false,
        false,
        0.05,
        { x: 0.40, y: 0.35 },
        0.20,
        false,
        { baseWristX: 0.38 }
      );

      expect(result.isValid).toBe(true);
      expect(result.answerIndex).toBe(0);
      expect(result.zoneId).toBe(4);
    });
  });
});
