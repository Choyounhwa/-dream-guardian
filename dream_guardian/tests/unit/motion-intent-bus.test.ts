import { describe, it, expect, vi } from 'vitest';
import { MotionIntentBus } from '../../src/motion/MotionIntentBus.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import type { MotionIntent } from '../../src/types/motion-intent.js';


function createMockLandmarks(
  overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {},
): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
  }
  for (const [idxStr, val] of Object.entries(overrides)) {
    const idx = parseInt(idxStr, 10);
    lm[idx] = { ...lm[idx], ...val };
  }
  return lm;
}

describe('MotionIntentBus (Issue #252 / INPUT-TOLERANCE-004)', () => {
  describe('1. 결정적 분류 (Deterministic Classification)', () => {
    it('동일 랜드마크 입력에 대해 버스가 분류한 intent 타입과 confidence가 100% 일치한다', () => {
      const bus = new MotionIntentBus();
      const prevLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.5, visibility: 0.95 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.5, visibility: 0.95 },
      });
      // 어깨가 0.50 -> 0.45 로 0.05 상승 (dt=0.1s -> speed=0.50 >= 0.22)
      // 왼손이 x=0.20 (reachLeft), 오른손이 x=0.50
      const currLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.45, visibility: 0.95 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.45, visibility: 0.95 },
        [POSE_LANDMARKS.LEFT_WRIST]: { x: 0.20, y: 0.5, visibility: 0.95 },
      });

      const res1 = bus.classify(currLm, 0.1, 1.0, { prevLandmarks: prevLm });
      const res2 = bus.classify(currLm, 0.1, 1.0, { prevLandmarks: prevLm });

      expect(res1).toEqual(res2);
      expect(res1.length).toBeGreaterThan(0);
      expect(res1.map((i) => i.type)).toContain('jump');
      expect(res1.map((i) => i.type)).toContain('reachLeft');
      expect(res1.find((i) => i.type === 'jump')?.confidence).toBe(
        res2.find((i) => i.type === 'jump')?.confidence,
      );
    });

    it('각 동작(jump, reachLeft, reachRight, stepLeft, stepRight, squat)을 정확히 분류한다', () => {
      const bus = new MotionIntentBus();

      // Jump
      const prevShoulder = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.5 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.5 },
      });
      const jumpLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.45 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.45 },
      });
      const jumpIntents = bus.classify(jumpLm, 0.1, 1.0, { prevLandmarks: prevShoulder });
      expect(jumpIntents.some((i) => i.type === 'jump')).toBe(true);

      // reachLeft / reachRight
      const reachLeftLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_WRIST]: { x: 0.2 },
      });
      expect(bus.classify(reachLeftLm, 0.1, 1.0).some((i) => i.type === 'reachLeft')).toBe(true);

      const reachRightLm = createMockLandmarks({
        [POSE_LANDMARKS.RIGHT_WRIST]: { x: 0.8 },
      });
      expect(bus.classify(reachRightLm, 0.1, 1.0).some((i) => i.type === 'reachRight')).toBe(true);

      // stepLeft / stepRight
      const stepLeftLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.45 },
        [POSE_LANDMARKS.LEFT_KNEE]: { x: 0.38 }, // < 0.45 - 0.04
      });
      expect(bus.classify(stepLeftLm, 0.1, 1.0).some((i) => i.type === 'stepLeft')).toBe(true);

      const stepRightLm = createMockLandmarks({
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.55 },
        [POSE_LANDMARKS.RIGHT_KNEE]: { x: 0.62 }, // > 0.55 + 0.04
      });
      expect(bus.classify(stepRightLm, 0.1, 1.0).some((i) => i.type === 'stepRight')).toBe(true);

      // squat
      const squatLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_HIP]: { y: 0.68 },
        [POSE_LANDMARKS.RIGHT_HIP]: { y: 0.68 },
      });
      expect(bus.classify(squatLm, 0.1, 1.0, { baselineY: 0.58 }).some((i) => i.type === 'squat')).toBe(true);
    });
  });

  describe('2. 점프 임계치 단일 출처성 (SSOT Jump Threshold)', () => {
    it('점프 속도 임계치(jumpVerticalSpeedThreshold)를 변경하면 분류 결과가 동적으로 변경된다', () => {
      // 기본 0.22 임계치
      const defaultBus = new MotionIntentBus({ jumpVerticalSpeedThreshold: 0.22 });
      const prevLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.5 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.5 },
      });
      // dy = 0.024, dt = 0.1s -> speed = 0.24 (> 0.22, < 0.30)
      const testLm = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.476 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.476 },
      });

      const resDefault = defaultBus.classify(testLm, 0.1, 1.0, { prevLandmarks: prevLm });
      expect(resDefault.some((i) => i.type === 'jump')).toBe(true);

      // 임계치를 0.30으로 높인 버스
      const highThreshBus = new MotionIntentBus({ jumpVerticalSpeedThreshold: 0.30 });
      const resHigh = highThreshBus.classify(testLm, 0.1, 1.0, { prevLandmarks: prevLm });
      expect(resHigh.some((i) => i.type === 'jump')).toBe(false);
    });
  });

  describe('3. 페이즈별 동작 소유권 필터링 (Phase Intent Ownership)', () => {
    it('ANSWER_SELECT 페이즈에서는 reachLeft/reachRight만 통과하고 jump는 차단된다', () => {
      const bus = new MotionIntentBus(undefined, 'ANSWER_SELECT');
      const received: string[] = [];
      bus.subscribe((i) => received.push(i.type));

      const okReach = bus.publish({ type: 'reachLeft', confidence: 0.9, timestamp: 1.0 });
      const blockedJump = bus.publish({ type: 'jump', confidence: 0.9, timestamp: 1.0 });
      const blockedStep = bus.publish({ type: 'stepLeft', confidence: 0.9, timestamp: 1.0 });

      expect(okReach).toBe(true);
      expect(blockedJump).toBe(false);
      expect(blockedStep).toBe(false);
      expect(received).toEqual(['reachLeft']);
    });

    it('HAZARD_EVADE 페이즈에서는 jump/stepLeft/stepRight가 통과하고 reachLeft는 차단된다', () => {
      const bus = new MotionIntentBus(undefined, 'HAZARD_EVADE');
      const received: string[] = [];
      bus.subscribe((i) => received.push(i.type));

      const okJump = bus.publish({ type: 'jump', confidence: 0.9, timestamp: 1.0 });
      const okStep = bus.publish({ type: 'stepLeft', confidence: 0.9, timestamp: 1.0 });
      const blockedReach = bus.publish({ type: 'reachLeft', confidence: 0.9, timestamp: 1.0 });

      expect(okJump).toBe(true);
      expect(okStep).toBe(true);
      expect(blockedReach).toBe(false);
      expect(received).toEqual(['jump', 'stepLeft']);
    });

    it('소유권 테이블을 config에서 바꾸면 코드 수정 없이 전달 대상이 변경된다', () => {
      // ANSWER_SELECT에 jump를 허용하도록 오버라이드
      const customBus = new MotionIntentBus({
        ownership: {
          ANSWER_SELECT: ['jump', 'reachLeft'],
        },
      }, 'ANSWER_SELECT');

      const okJump = customBus.publish({ type: 'jump', confidence: 0.9, timestamp: 1.0 });
      expect(okJump).toBe(true);
    });
  });

  describe('4. 통합 불응기 (Refractory Lockout)', () => {
    it('확정 직후 0.20s 시점 intent는 불응기로 차단되고, 0.30s 시점 intent는 정상 소비된다', () => {
      const bus = new MotionIntentBus(undefined, 'ANSWER_SELECT');
      const received: MotionIntent[] = [];
      bus.subscribe((i) => received.push(i));

      // 1.00s에 판정 확정 -> 불응기 0.25s 발동 (1.25s까지 잠금)
      bus.triggerRefractory(1.00);

      // 1.20s 시점 (0.20s 경과): 차단
      const blocked = bus.publish({ type: 'reachLeft', confidence: 0.9, timestamp: 1.20 });
      expect(blocked).toBe(false);
      expect(received.length).toBe(0);

      // 1.30s 시점 (0.30s 경과 > 0.25s): 정상 통과
      const allowed = bus.publish({ type: 'reachLeft', confidence: 0.9, timestamp: 1.30 });
      expect(allowed).toBe(true);
      expect(received.length).toBe(1);
    });

    it('페이즈 전환 시 불응기가 즉시 리셋되어 새 페이즈 intent가 차단되지 않는다', () => {
      const bus = new MotionIntentBus(undefined, 'ANSWER_SELECT');
      const received: string[] = [];
      bus.subscribe((i) => received.push(i.type));

      bus.triggerRefractory(1.00);
      expect(bus.isRefractoryActive(1.10)).toBe(true);

      // 페이즈 전환 (STAR_COLLECT)
      bus.setPhase('STAR_COLLECT');
      expect(bus.isRefractoryActive(1.10)).toBe(false);

      const ok = bus.publish({ type: 'reachLeft', confidence: 0.9, timestamp: 1.10 });
      expect(ok).toBe(true);
      expect(received).toEqual(['reachLeft']);
    });
  });

  describe('5. 구독 및 라우팅 (Subscribe & Routing)', () => {
    it('타입별 구독자는 해당 타입의 intent만 수신하며, unsubscribe 시 수신이 중단된다', () => {
      const bus = new MotionIntentBus(undefined, 'default');
      const reachFn = vi.fn();
      const allFn = vi.fn();

      const unsubReach = bus.subscribe('reachLeft', reachFn);
      const unsubAll = bus.subscribe(allFn);

      bus.publish({ type: 'reachLeft', confidence: 0.8, timestamp: 1.0 });
      expect(reachFn).toHaveBeenCalledTimes(1);
      expect(allFn).toHaveBeenCalledTimes(1);

      bus.publish({ type: 'jump', confidence: 0.8, timestamp: 1.0 });
      expect(reachFn).toHaveBeenCalledTimes(1); // 점프는 안 받음
      expect(allFn).toHaveBeenCalledTimes(2);

      unsubReach();
      bus.publish({ type: 'reachLeft', confidence: 0.8, timestamp: 1.0 });
      expect(reachFn).toHaveBeenCalledTimes(1); // 구독 해제됨
      expect(allFn).toHaveBeenCalledTimes(3);

      unsubAll();
    });
  });
});
