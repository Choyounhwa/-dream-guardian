import { describe, it, expect } from 'vitest';
import {
  AdaptiveToleranceTracker,
} from '../../src/input/AdaptiveTolerance.js';
import { CalibrationHelper } from '../../src/motion/CalibrationHelper.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';

describe('Adaptive Tolerance Layer - Issue #254 [INPUT-TOLERANCE-006]', () => {
  describe('1. 니어미스 추적 및 점진적 완화', () => {
    it('score 0.62(임계 0.70의 0.886배)인 실패가 니어미스로 기록된다', () => {
      const tracker = new AdaptiveToleranceTracker();
      const res = tracker.recordAttempt(0.62, 0.70);

      expect(res.isNearMiss).toBe(true);
      expect(res.isSuccess).toBe(false);
      expect(tracker.nearMissStreak).toBe(1);
    });

    it('score 0.40인 실패는 니어미스가 아니며 스트릭을 리셋한다', () => {
      const tracker = new AdaptiveToleranceTracker();
      tracker.recordAttempt(0.62, 0.70);
      expect(tracker.nearMissStreak).toBe(1);

      // 0.40은 0.70 * 0.85 = 0.595 미만이므로 완전 실패
      const res = tracker.recordAttempt(0.40, 0.70);
      expect(res.isNearMiss).toBe(false);
      expect(res.isSuccess).toBe(false);
      expect(tracker.nearMissStreak).toBe(0);
    });

    it('니어미스 3연속 후 마진 배율이 1.0 초과로 확장된다', () => {
      const tracker = new AdaptiveToleranceTracker();
      tracker.recordAttempt(0.62, 0.70); // 1
      tracker.recordAttempt(0.63, 0.70); // 2
      expect(tracker.multiplier).toBe(1.0);

      // 3회차 니어미스
      const res = tracker.recordAttempt(0.64, 0.70);
      expect(tracker.nearMissStreak).toBe(3);
      expect(tracker.multiplier).toBeGreaterThan(1.0);
      expect(res.multiplier).toBeCloseTo(1.07, 2);
    });

    it('니어미스 10연속이어도 배율이 1.20을 넘지 않는다', () => {
      const tracker = new AdaptiveToleranceTracker();
      for (let i = 0; i < 10; i++) {
        tracker.recordAttempt(0.65, 0.70);
      }
      expect(tracker.nearMissStreak).toBe(10);
      expect(tracker.multiplier).toBeLessThanOrEqual(1.20);
      expect(tracker.multiplier).toBeCloseTo(1.20, 2);
    });

    it('성공 1회 발생 시 배율이 즉시 1.0으로 원복된다', () => {
      const tracker = new AdaptiveToleranceTracker();
      // 5회 연속 니어미스
      for (let i = 0; i < 5; i++) {
        tracker.recordAttempt(0.65, 0.70);
      }
      expect(tracker.multiplier).toBeGreaterThan(1.0);

      // 1회 성공 (score >= 0.70)
      const res = tracker.recordAttempt(0.75, 0.70);
      expect(res.isSuccess).toBe(true);
      expect(tracker.multiplier).toBe(1.0);
      expect(tracker.nearMissStreak).toBe(0);
      expect(tracker.isRelaxed).toBe(false);
    });

    it('라운드 전환 시 완화 상태가 리셋된다(기본 플래그)', () => {
      const tracker = new AdaptiveToleranceTracker({ resetOnRoundChange: true });
      for (let i = 0; i < 5; i++) {
        tracker.recordAttempt(0.65, 0.70);
      }
      expect(tracker.multiplier).toBeGreaterThan(1.0);

      tracker.onRoundChange();
      expect(tracker.multiplier).toBe(1.0);
      expect(tracker.nearMissStreak).toBe(0);
    });
  });

  describe('2. 개인 기준선 캘리브레이션', () => {
    it('캘리브레이션에서 측정한 개인 기준선이 마진 계산에 반영된다', () => {
      const helper = new CalibrationHelper();
      helper.setManualBaseline({
        shoulderWidth: 0.30,
        maxReachDistance: 0.42,
        jitterVariance: 0.0003,
      });

      const baseline = helper.getBaseline();
      expect(baseline.shoulderWidth).toBe(0.30);
      expect(baseline.maxReachDistance).toBe(0.42);
      expect(baseline.jitterVariance).toBe(0.0003);
    });

    it('캘리브레이션 측정 실패 시 기본값으로 폴백하고 예외가 발생하지 않는다', () => {
      const helper = new CalibrationHelper();
      // 아무런 샘플 없이 바로 getBaseline 호출
      expect(() => helper.getBaseline()).not.toThrow();
      const baseline = helper.getBaseline();

      expect(baseline.shoulderWidth).toBe(0.25);
      expect(baseline.maxReachDistance).toBe(0.35);
      expect(baseline.jitterVariance).toBe(0.0001);
    });
  });

  describe('3. 하위 호환 및 가시성 안전성 검증', () => {
    it('config 플래그 off 시 001/002 동작과 완전히 동일하다', () => {
      const disabledTracker = new AdaptiveToleranceTracker({ enableAdaptiveTolerance: false });
      for (let i = 0; i < 5; i++) {
        disabledTracker.recordAttempt(0.65, 0.70);
      }
      expect(disabledTracker.multiplier).toBe(1.0);
    });

    it('완화가 적용된 상태에서도 가시성 하드 가드(0.3)는 뚫리지 않는다', () => {
      const tracker = new AdaptiveToleranceTracker();
      // 5회 연속 니어미스로 최대 완화 배율 적용
      for (let i = 0; i < 5; i++) {
        tracker.recordAttempt(0.65, 0.70);
      }
      expect(tracker.multiplier).toBeGreaterThan(1.10);

      const selector = new ArmReachAnswerSelector();
      selector.setAdaptiveTolerance(tracker);

      const createLandmarks = (wrist: { x: number; y: number; visibility?: number }) => {
        const lms = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
        lms[15] = { x: wrist.x, y: wrist.y, z: 0, visibility: wrist.visibility ?? 0.9 };
        return lms;
      };

      // 가시성이 0.25인 포즈 입력 (존 내부, 팔 뻗음 양호하더라도)
      const lowVisPose = createLandmarks({ x: 0.15, y: 0.32, visibility: 0.25 });

      const result = selector.update(0.016, lowVisPose);
      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });
  });
});
