import { describe, it, expect, vi } from 'vitest';
import { PHASE_INTENT_OWNERSHIP } from '../../config/judgment.config.js';
import { MotionIntentBus } from '../../src/motion/MotionIntentBus.js';
import type { MotionIntent, MotionIntentType } from '../../src/types/motion-intent.js';

/**
 * [BOSS-ASSAULT-40 / Issue #543]
 * ASSAULT_ROUND 동작 소유권(Intent Ownership) config 검증
 *
 * DOC-14 §15.1-A2, A24:
 * - ASSAULT_ROUND 페이즈는 'reachLeft', 'reachRight', 'squat' 동작만을 소비 소유한다.
 * - jump, stepLeft, stepRight 동작은 원천 차단(A24)되어야 한다.
 * - 기존 페이즈 소유권(ANSWER_SELECT, HAZARD_EVADE, STAR_COLLECT, BOSS_CLIMAX, default)은 일체 불변이어야 한다.
 */
describe('BOSS-ASSAULT-40: ASSAULT_ROUND Motion Intent Ownership (Issue #543)', () => {
  describe('1. PHASE_INTENT_OWNERSHIP 설정 항목 검증', () => {
    it('PHASE_INTENT_OWNERSHIP에 ASSAULT_ROUND 항목이 정의되어 있어야 한다', () => {
      expect(PHASE_INTENT_OWNERSHIP['ASSAULT_ROUND']).toBeDefined();
    });

    it('ASSAULT_ROUND 소유 동작은 reachLeft, reachRight, squat이어야 한다 (DOC-14 §15.1-A2)', () => {
      expect(PHASE_INTENT_OWNERSHIP['ASSAULT_ROUND']).toEqual([
        'reachLeft',
        'reachRight',
        'squat',
      ]);
    });

    it('기존 페이즈의 동작 소유권 설정은 일체 불변이어야 한다 (회귀 방지)', () => {
      expect(PHASE_INTENT_OWNERSHIP['ANSWER_SELECT']).toEqual(['reachLeft', 'reachRight']);
      expect(PHASE_INTENT_OWNERSHIP['HAZARD_EVADE']).toEqual(['jump', 'stepLeft', 'stepRight']);
      expect(PHASE_INTENT_OWNERSHIP['STAR_COLLECT']).toEqual(['reachLeft', 'reachRight', 'jump']);
      expect(PHASE_INTENT_OWNERSHIP['BOSS_CLIMAX']).toEqual(['jump', 'stepLeft', 'stepRight']);
      expect(PHASE_INTENT_OWNERSHIP['default']).toEqual([
        'reachLeft',
        'reachRight',
        'jump',
        'stepLeft',
        'stepRight',
        'squat',
      ]);
    });
  });

  describe('2. MotionIntentBus와의 통합 검증 (isIntentAllowedInPhase)', () => {
    it('ASSAULT_ROUND 페이즈에서 reachLeft, reachRight, squat는 허용되어야 한다', () => {
      const bus = new MotionIntentBus(undefined, 'ASSAULT_ROUND');

      expect(bus.isIntentAllowedInPhase('reachLeft')).toBe(true);
      expect(bus.isIntentAllowedInPhase('reachRight')).toBe(true);
      expect(bus.isIntentAllowedInPhase('squat')).toBe(true);
    });

    it('ASSAULT_ROUND 페이즈에서 jump, stepLeft, stepRight는 원천 차단되어야 한다 (DOC-14 A24)', () => {
      const bus = new MotionIntentBus(undefined, 'ASSAULT_ROUND');

      expect(bus.isIntentAllowedInPhase('jump')).toBe(false);
      expect(bus.isIntentAllowedInPhase('stepLeft')).toBe(false);
      expect(bus.isIntentAllowedInPhase('stepRight')).toBe(false);
    });

    it('동적으로 ASSAULT_ROUND 페이즈로 전환해도 동일한 소유권 규칙이 적용되어야 한다', () => {
      const bus = new MotionIntentBus(undefined, 'ANSWER_SELECT');
      expect(bus.isIntentAllowedInPhase('squat')).toBe(false);

      bus.setPhase('ASSAULT_ROUND');
      expect(bus.isIntentAllowedInPhase('reachLeft')).toBe(true);
      expect(bus.isIntentAllowedInPhase('reachRight')).toBe(true);
      expect(bus.isIntentAllowedInPhase('squat')).toBe(true);
      expect(bus.isIntentAllowedInPhase('jump')).toBe(false);
      expect(bus.isIntentAllowedInPhase('stepLeft')).toBe(false);
      expect(bus.isIntentAllowedInPhase('stepRight')).toBe(false);
    });
  });

  describe('3. MotionIntentBus publish 및 구독자 수신 검증', () => {
    it('ASSAULT_ROUND에서 허용된 동작만 구독자에게 전달되고 차단된 동작은 전달되지 않아야 한다', () => {
      const bus = new MotionIntentBus(undefined, 'ASSAULT_ROUND');
      const received: MotionIntentType[] = [];
      const listener = vi.fn((intent: MotionIntent) => {
        received.push(intent.type);
      });
      bus.subscribe(listener);

      // 허용된 intent 발행
      const okReachLeft = bus.publish({ type: 'reachLeft', confidence: 0.9, timestamp: 1.0 });
      const okReachRight = bus.publish({ type: 'reachRight', confidence: 0.9, timestamp: 1.5 });
      const okSquat = bus.publish({ type: 'squat', confidence: 0.9, timestamp: 2.0 });

      expect(okReachLeft).toBe(true);
      expect(okReachRight).toBe(true);
      expect(okSquat).toBe(true);

      // 차단된 intent 발행 (DOC-14 A24)
      const blockedJump = bus.publish({ type: 'jump', confidence: 0.9, timestamp: 2.5 });
      const blockedStepLeft = bus.publish({ type: 'stepLeft', confidence: 0.9, timestamp: 3.0 });
      const blockedStepRight = bus.publish({ type: 'stepRight', confidence: 0.9, timestamp: 3.5 });

      expect(blockedJump).toBe(false);
      expect(blockedStepLeft).toBe(false);
      expect(blockedStepRight).toBe(false);

      // 리스너는 3회(reachLeft, reachRight, squat)만 수신
      expect(listener).toHaveBeenCalledTimes(3);
      expect(received).toEqual(['reachLeft', 'reachRight', 'squat']);
    });
  });
});
