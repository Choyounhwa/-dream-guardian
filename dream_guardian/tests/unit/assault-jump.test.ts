import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssaultJumpAdapter } from '../../src/motion/AssaultJumpAdapter.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';
import type { CalibrationBaseline } from '../../src/motion/CalibrationHelper.js';

describe('[BOSS-ASSAULT-28 / #530] 점프·저충격 대체 동작 어댑터 (AssaultJumpAdapter)', () => {
  let adapter: AssaultJumpAdapter;

  const validBaseline: CalibrationBaseline = {
    noseX: 0.5,
    noseY: 0.2,
    shoulderX: 0.5,
    shoulderY: 0.35,
    shoulderWidth: 0.25,
    hipX: 0.5,
    hipY: 0.6,
  };

  /** MediaPipe 표준 랜드마크 더미 생성 헬퍼 (0~1 정규화) */
  function createMockLandmarks(options?: {
    shoulderY?: number;
    hipY?: number;
    heelY?: number;
    ankleY?: number;
    visibility?: number;
  }): NormalizedLandmark[] {
    const sY = options?.shoulderY ?? 0.35;
    const hY = options?.hipY ?? 0.6;
    const heelY = options?.heelY ?? 0.9;
    const ankleY = options?.ankleY ?? 0.85;
    const vis = options?.visibility ?? 0.95;

    const landmarks: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: vis });
    }
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: sY - 0.15, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.4, y: sY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.6, y: sY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: hY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: hY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.45, y: ankleY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.55, y: ankleY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.LEFT_HEEL] = { x: 0.45, y: heelY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_HEEL] = { x: 0.55, y: heelY, z: 0, visibility: vis };
    return landmarks;
  }

  beforeEach(() => {
    adapter = new AssaultJumpAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 순수 어댑터 제약 및 기본 설정 검증', () => {
    it('새 requestAnimationFrame, setInterval, DOM 이벤트 리스너 등록 0회', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalAddEventListener = g.addEventListener;

      const rafMock = vi.fn();
      const addEventListenerMock = vi.fn();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      g.requestAnimationFrame = rafMock;
      g.addEventListener = addEventListenerMock;

      try {
        const testAdapter = new AssaultJumpAdapter();
        testAdapter.processFrame({
          timestampMs: 1000,
          shoulderY: 0.35,
          baseline: validBaseline,
        });

        expect(rafMock).not.toHaveBeenCalled();
        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(addEventListenerMock).not.toHaveBeenCalled();
      } finally {
        if (originalRaf === undefined) {
          delete g.requestAnimationFrame;
        } else {
          g.requestAnimationFrame = originalRaf;
        }
        if (originalAddEventListener === undefined) {
          delete g.addEventListener;
        } else {
          g.addEventListener = originalAddEventListener;
        }
      }
    });

    it('입력 랜드마크 및 베이스라인 데이터의 불변성을 유지한다', () => {
      const landmarks = Object.freeze(createMockLandmarks({ shoulderY: 0.25 }));
      const baseline = Object.freeze({ ...validBaseline });

      expect(() => {
        adapter.processFrame({
          timestampMs: 1000,
          landmarks,
          baseline,
        });
      }).not.toThrow();
    });

    it('배틀 레이어 책임인 HP 차감, 피해량, 판정창 계산 코드가 존재하지 않는다', () => {
      const result = adapter.processFrame({
        timestampMs: 1000,
        shoulderY: 0.35,
        baseline: validBaseline,
      });

      const resRecord = result as unknown as Record<string, unknown>;
      expect(resRecord.damage).toBeUndefined();
      expect(resRecord.bossHp).toBeUndefined();
      expect(resRecord.playerHp).toBeUndefined();
      expect(resRecord.score).toBeUndefined();
    });
  });

  describe('2. 실제 점프(real_jump) 동작 계약 검증', () => {
    it('준비(standing) -> 도약(jumping) -> 착지/복귀(standing) 시 landGeneration이 정확히 1 증가한다', () => {
      // 1) 준비 (서 있는 상태: baseline shoulderY=0.35, current shoulderY=0.35)
      const r1 = adapter.processFrame({
        timestampMs: 1000,
        shoulderY: 0.35,
        baseline: validBaseline,
      });
      expect(r1.isValid).toBe(true);
      expect(r1.posture).toBe('standing');
      expect(r1.isJumping).toBe(false);
      expect(r1.isStanding).toBe(true);
      expect(r1.landGeneration).toBe(0);
      expect(r1.jumpGeneration).toBe(0);
      expect(r1.motionKind).toBe('real_jump');
      expect(r1.accessibilityProfileId).toBeUndefined();

      // 2) 점프 상승 (shoulderY=0.25, deltaY = 0.35 - 0.25 = 0.10 >= jumpThreshold 0.065)
      const r2 = adapter.processFrame({
        timestampMs: 1100,
        shoulderY: 0.25,
      });
      expect(r2.isValid).toBe(true);
      expect(r2.posture).toBe('jumping');
      expect(r2.isJumping).toBe(true);
      expect(r2.isStanding).toBe(false);
      expect(r2.landGeneration).toBe(0);
      expect(r2.jumpGeneration).toBe(0);
      expect(r2.motionKind).toBe('real_jump');

      // 3) 착지 / 복귀 (shoulderY=0.35, deltaY = 0 <= landThreshold 0.035)
      const r3 = adapter.processFrame({
        timestampMs: 1300,
        shoulderY: 0.35,
      });
      expect(r3.isValid).toBe(true);
      expect(r3.posture).toBe('standing');
      expect(r3.isJumping).toBe(false);
      expect(r3.isStanding).toBe(true);
      expect(r3.landGeneration).toBe(1);
      expect(r3.jumpGeneration).toBe(1);
      expect(r3.motionKind).toBe('real_jump');
    });

    it('MediaPipe landmarks 배열을 통해서도 정확히 점프를 판정한다', () => {
      const standingLm = createMockLandmarks({ shoulderY: 0.35 });
      const jumpLm = createMockLandmarks({ shoulderY: 0.24 });

      // Standing
      adapter.processFrame({ timestampMs: 1000, landmarks: standingLm, baseline: validBaseline });

      // Jumping
      const rJump = adapter.processFrame({ timestampMs: 1100, landmarks: jumpLm });
      expect(rJump.isValid).toBe(true);
      expect(rJump.isJumping).toBe(true);
      expect(rJump.posture).toBe('jumping');

      // Landing
      const rLand = adapter.processFrame({ timestampMs: 1250, landmarks: standingLm });
      expect(rLand.isValid).toBe(true);
      expect(rLand.isStanding).toBe(true);
      expect(rLand.landGeneration).toBe(1);
    });
  });

  describe('3. 저충격 대체 동작(heel_raise) 분리 및 프로필 보존', () => {
    it('accessibilityProfileId=heel_raise 지정 시 motionKind=low_impact 및 식별자를 유지한다', () => {
      // 1) 서 있는 상태
      const r1 = adapter.processFrame({
        timestampMs: 1000,
        shoulderY: 0.35,
        baseline: validBaseline,
        accessibilityProfileId: 'heel_raise',
      });
      expect(r1.isValid).toBe(true);
      expect(r1.motionKind).toBe('low_impact');
      expect(r1.accessibilityProfileId).toBe('heel_raise');
      expect(r1.posture).toBe('standing');
      expect(r1.landGeneration).toBe(0);

      // 2) 발꿈치 들기 (소폭 상승: shoulderY=0.31, deltaY=0.04 >= lowImpactThreshold 0.035)
      const r2 = adapter.processFrame({
        timestampMs: 1100,
        shoulderY: 0.31,
        accessibilityProfileId: 'heel_raise',
      });
      expect(r2.isValid).toBe(true);
      expect(r2.posture).toBe('jumping');
      expect(r2.isJumping).toBe(true);
      expect(r2.motionKind).toBe('low_impact');
      expect(r2.accessibilityProfileId).toBe('heel_raise');
      expect(r2.landGeneration).toBe(0);

      // 3) 발꿈치 내리기 (복귀: shoulderY=0.35)
      const r3 = adapter.processFrame({
        timestampMs: 1250,
        shoulderY: 0.35,
        accessibilityProfileId: 'heel_raise',
      });
      expect(r3.isValid).toBe(true);
      expect(r3.posture).toBe('standing');
      expect(r3.isJumping).toBe(false);
      expect(r3.motionKind).toBe('low_impact');
      expect(r3.accessibilityProfileId).toBe('heel_raise');
      expect(r3.landGeneration).toBe(1);
    });

    it('isLowImpact=true 플래그 지정 시 저충격 모드로 동작하며 heel 랜드마크를 활용한다', () => {
      const standingLm = createMockLandmarks({ heelY: 0.90 });
      const raisedHeelLm = createMockLandmarks({ heelY: 0.85 }); // 발꿈치 상승

      const customBaseline = {
        ...validBaseline,
        heelY: 0.90,
      };

      // 1) Standing
      adapter.processFrame({
        timestampMs: 1000,
        landmarks: standingLm,
        baseline: customBaseline,
        isLowImpact: true,
      });

      // 2) Heel raise (상승)
      const rRise = adapter.processFrame({
        timestampMs: 1100,
        landmarks: raisedHeelLm,
        isLowImpact: true,
      });
      expect(rRise.isValid).toBe(true);
      expect(rRise.isJumping).toBe(true);
      expect(rRise.motionKind).toBe('low_impact');
      expect(rRise.accessibilityProfileId).toBe('heel_raise');

      // 3) Return
      const rLand = adapter.processFrame({
        timestampMs: 1250,
        landmarks: standingLm,
        isLowImpact: true,
      });
      expect(rLand.landGeneration).toBe(1);
      expect(rLand.motionKind).toBe('low_impact');
    });

    it('실제 점프와 저충격 대체의 프로필이 절대 혼합되지 않는다 (단일 진실 공급원)', () => {
      // 1) 실제 점프
      adapter.processFrame({ timestampMs: 1000, shoulderY: 0.35, baseline: validBaseline });
      adapter.processFrame({ timestampMs: 1100, shoulderY: 0.25 });
      const rReal = adapter.processFrame({ timestampMs: 1200, shoulderY: 0.35 });
      expect(rReal.motionKind).toBe('real_jump');
      expect(rReal.accessibilityProfileId).toBeUndefined();

      // 2) 저충격 대체
      adapter.processFrame({
        timestampMs: 1300,
        shoulderY: 0.35,
        accessibilityProfileId: 'heel_raise',
      });
      adapter.processFrame({
        timestampMs: 1400,
        shoulderY: 0.31,
        accessibilityProfileId: 'heel_raise',
      });
      const rLow = adapter.processFrame({
        timestampMs: 1500,
        shoulderY: 0.35,
        accessibilityProfileId: 'heel_raise',
      });
      expect(rLow.motionKind).toBe('low_impact');
      expect(rLow.accessibilityProfileId).toBe('heel_raise');
    });
  });

  describe('4. 점프 유지(holding) 및 경계 떨림 시 중복 generation 증가 0회', () => {
    it('점프 공중 체류(holding) 지속 시 generation이 중복 증가하지 않는다', () => {
      adapter.processFrame({ timestampMs: 1000, shoulderY: 0.35, baseline: validBaseline });
      adapter.processFrame({ timestampMs: 1050, shoulderY: 0.24 }); // jump 시작

      // 5개 프레임 동안 계속 공중 유지
      for (let t = 1100; t <= 1300; t += 50) {
        const res = adapter.processFrame({ timestampMs: t, shoulderY: 0.23 });
        expect(res.isJumping).toBe(true);
        expect(res.landGeneration).toBe(0);
      }

      // 착지
      const landRes = adapter.processFrame({ timestampMs: 1350, shoulderY: 0.35 });
      expect(landRes.landGeneration).toBe(1);

      // 착지 후 지상 유지
      for (let t = 1400; t <= 1600; t += 50) {
        const res = adapter.processFrame({ timestampMs: t, shoulderY: 0.35 });
        expect(res.isStanding).toBe(true);
        expect(res.landGeneration).toBe(1); // 여전히 1
      }
    });

    it('임계값 경계 부근 떨림(transition) 시 가짜 generation 증가가 발생하지 않는다', () => {
      adapter.processFrame({ timestampMs: 1000, shoulderY: 0.35, baseline: validBaseline });

      // jumpThreshold(0.065) 미만인 경계 떨림 (deltaY=0.045, shoulderY=0.305)
      for (let t = 1050; t <= 1250; t += 50) {
        const res = adapter.processFrame({ timestampMs: t, shoulderY: 0.305 });
        expect(res.posture).toBe('transition');
        expect(res.landGeneration).toBe(0);
      }

      // 지상 복귀 (shoulderY=0.35)
      const resLand = adapter.processFrame({ timestampMs: 1300, shoulderY: 0.35 });
      expect(resLand.posture).toBe('standing');
      expect(resLand.landGeneration).toBe(0); // 점프 인정 안 됨
    });
  });

  describe('5. 추적 상실(tracking lost) 후 복구 시 가짜 점프 생성 방지 (A19)', () => {
    it('점프 중 추적 상실 후 지상으로 복구되어도 가짜 착지 generation이 발생하지 않는다', () => {
      // 1) 서 있기
      adapter.processFrame({ timestampMs: 1000, shoulderY: 0.35, baseline: validBaseline });

      // 2) 점프 도약
      adapter.processFrame({ timestampMs: 1100, shoulderY: 0.25 });

      // 3) 공중에서 추적 상실 발생
      const rLost = adapter.processFrame({
        timestampMs: 1150,
        isTrackingLost: true,
      });
      expect(rLost.isValid).toBe(false);
      expect(rLost.invalidReason).toBe('TRACKING_LOST');

      // 4) 추적 복구 (이미 착지한 지상 상태)
      const rRecovered = adapter.processFrame({
        timestampMs: 1300,
        shoulderY: 0.35,
      });
      expect(rRecovered.isValid).toBe(true);
      expect(rRecovered.posture).toBe('standing');
      // 추적 상실로 중단되었으므로 가짜 generation 카운트 0
      expect(rRecovered.landGeneration).toBe(0);
    });

    it('지상 상태에서 추적 상실 후 복구 시 generation이 증가하지 않는다', () => {
      adapter.processFrame({ timestampMs: 1000, shoulderY: 0.35, baseline: validBaseline });

      adapter.processFrame({ timestampMs: 1050, isTrackingLost: true });

      const res = adapter.processFrame({ timestampMs: 1100, shoulderY: 0.35 });
      expect(res.isValid).toBe(true);
      expect(res.landGeneration).toBe(0);
    });
  });

  describe('6. 키보드/가상 fallback 입력 지원 (A18)', () => {
    it('isJumpingKey=true 입력으로 폴백 점프 동작을 정상 수행한다', () => {
      // 1) 키보드 점프 누름
      const rDown = adapter.processFrame({
        timestampMs: 1000,
        isJumpingKey: true,
        inputId: 'fb-jump-1',
      });
      expect(rDown.isValid).toBe(true);
      expect(rDown.isJumping).toBe(true);
      expect(rDown.posture).toBe('jumping');
      expect(rDown.motionKind).toBe('fallback');
      expect(rDown.inputId).toBe('fb-jump-1');
      expect(rDown.landGeneration).toBe(0);

      // 2) 키 유지 (holding / repeat)
      const rHold = adapter.processFrame({
        timestampMs: 1050,
        isJumpingKey: true,
      });
      expect(rHold.landGeneration).toBe(0);

      // 3) 키 해제 (착지 복귀)
      const rUp = adapter.processFrame({
        timestampMs: 1150,
        isJumpingKey: false,
      });
      expect(rUp.isValid).toBe(true);
      expect(rUp.isStanding).toBe(true);
      expect(rUp.posture).toBe('standing');
      expect(rUp.landGeneration).toBe(1);
    });

    it('키 해제 상태 유지 시 generation이 중복 증가하지 않는다', () => {
      adapter.processFrame({ timestampMs: 1000, isJumpingKey: true });
      adapter.processFrame({ timestampMs: 1100, isJumpingKey: false }); // 1증가

      const rStay = adapter.processFrame({ timestampMs: 1200, isJumpingKey: false });
      expect(rStay.landGeneration).toBe(1);
    });
  });

  describe('7. 세션 관리 및 reset() 안전성 검증', () => {
    it('reset() 호출 시 generation 및 모든 내부 상태가 0으로 안전 초기화된다', () => {
      adapter.processFrame({ timestampMs: 1000, shoulderY: 0.35, baseline: validBaseline });
      adapter.processFrame({ timestampMs: 1100, shoulderY: 0.25 });
      adapter.processFrame({ timestampMs: 1200, shoulderY: 0.35 });
      expect(adapter.processFrame({ timestampMs: 1250, shoulderY: 0.35 }).landGeneration).toBe(1);

      // Reset
      adapter.reset();

      const rAfterReset = adapter.processFrame({
        timestampMs: 2000,
        shoulderY: 0.35,
        baseline: validBaseline,
      });
      expect(rAfterReset.landGeneration).toBe(0);
      expect(rAfterReset.jumpGeneration).toBe(0);
    });

    it('이전 세션의 inputId/sessionId는 가짜 입력을 만들지 않고 거부된다', () => {
      adapter.reset('session-A');

      // 정상 세션 입력
      const rValid = adapter.processFrame({
        timestampMs: 1000,
        shoulderY: 0.35,
        baseline: validBaseline,
        sessionId: 'session-A',
      });
      expect(rValid.isValid).toBe(true);
      expect(rValid.sessionId).toBe('session-A');

      // 이전/다른 세션 입력 거부
      const rOtherSession = adapter.processFrame({
        timestampMs: 1100,
        shoulderY: 0.25,
        sessionId: 'old-session-Z',
      });
      expect(rOtherSession.isValid).toBe(false);
      expect(rOtherSession.invalidReason).toBe('INVALID_SESSION');
    });
  });

  describe('8. 비정상 입력 방어 및 유효성 검증', () => {
    it('baseline 누락 시 MISSING_BASELINE 반환', () => {
      const res = adapter.processFrame({
        timestampMs: 1000,
        shoulderY: 0.35,
      });
      expect(res.isValid).toBe(false);
      expect(res.invalidReason).toBe('MISSING_BASELINE');
    });

    it('정규화 범위(0~1)를 벗어난 픽셀 좌표 입력 시 INVALID_COORDINATE_UNITS 반환', () => {
      const res = adapter.processFrame({
        timestampMs: 1000,
        shoulderY: 350, // 픽셀 좌표 오입력
        baseline: validBaseline,
      });
      expect(res.isValid).toBe(false);
      expect(res.invalidReason).toBe('INVALID_COORDINATE_UNITS');
    });

    it('신뢰도가 minTrackingConfidence 미만일 때 LOW_CONFIDENCE 반환', () => {
      const lowVisLm = createMockLandmarks({ shoulderY: 0.35, visibility: 0.2 });
      const res = adapter.processFrame({
        timestampMs: 1000,
        landmarks: lowVisLm,
        baseline: validBaseline,
      });
      expect(res.isValid).toBe(false);
      expect(res.invalidReason).toBe('LOW_CONFIDENCE');
    });

    it('타임스탬프 오류(음수, 비유한값) 시 INVALID_TIMESTAMP 반환', () => {
      const res = adapter.processFrame({
        timestampMs: -10,
        shoulderY: 0.35,
        baseline: validBaseline,
      });
      expect(res.isValid).toBe(false);
      expect(res.invalidReason).toBe('INVALID_TIMESTAMP');
    });
  });
});
