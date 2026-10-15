import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssaultSquatAdapter } from '../../src/motion/AssaultSquatAdapter.js';
import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';
import type { CalibrationBaseline } from '../../src/motion/CalibrationHelper.js';

describe('[BOSS-ASSAULT-10 / #512] 보정 단위 일치 스쿼트 자세 어댑터 (AssaultSquatAdapter)', () => {
  let adapter: AssaultSquatAdapter;

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
  function createMockLandmarks(hipY = 0.6, shoulderY = 0.35, visibility = 0.9): NormalizedLandmark[] {
    const landmarks: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility });
    }
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: shoulderY - 0.15, z: 0, visibility };
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.4, y: shoulderY, z: 0, visibility };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.6, y: shoulderY, z: 0, visibility };
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: hipY, z: 0, visibility };
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: hipY, z: 0, visibility };
    return landmarks;
  }

  beforeEach(() => {
    adapter = new AssaultSquatAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 순수 어댑터 제약 및 기본 설정 검증', () => {
    it('새 requestAnimationFrame, setInterval, DOM 이벤트 리스너를 일체 등록하지 않아야 한다', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalAddEventListener = g.addEventListener;

      const rafMock = vi.fn();
      const addEventListenerMock = vi.fn();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      g.requestAnimationFrame = rafMock;
      g.addEventListener = addEventListenerMock;

      try {
        const testAdapter = new AssaultSquatAdapter();
        testAdapter.setBaseline(validBaseline);
        testAdapter.update({ timestampMs: 1000, hipY: 0.6 });
        testAdapter.reset();

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

    it('기본 설정으로 DEFAULT_ASSAULT_INPUT_CONFIG의 squatDropThreshold와 squatStandThreshold를 소비해야 한다', () => {
      const config = adapter.getConfig();
      expect(config.squatDropThreshold).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.squatDropThreshold);
      expect(config.squatStandThreshold).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.squatStandThreshold);
      expect(config.squatDropThreshold).toBe(0.065);
      expect(config.squatStandThreshold).toBe(0.035);
      expect(config.squatDropThreshold).toBeGreaterThan(config.squatStandThreshold);
    });

    it('초기 상태에서는 standGeneration이 0이고 isValid가 false여야 한다', () => {
      expect(adapter.standGeneration).toBe(0);
      expect(adapter.isValid).toBe(false);
      expect(adapter.isDucking).toBe(false);
      expect(adapter.isStanding).toBe(false);
      expect(adapter.currentPosture).toBe('unknown');
    });
  });

  describe('2. 단위 일치 및 보정 기준선 검증', () => {
    it('보정 기준선(Baseline)이 누락된 경우 isValid=false 및 MISSING_BASELINE을 보고해야 한다', () => {
      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.6),
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('MISSING_BASELINE');
      expect(result.isDucking).toBe(false);
      expect(result.isStanding).toBe(false);
    });

    it('보정 기준선 좌표가 1.0 초과(픽셀 좌표)인 경우 거부해야 한다 (INVALID_COORDINATE_UNITS)', () => {
      const pixelBaseline = { ...validBaseline, hipY: 480 };
      adapter.setBaseline(pixelBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.6),
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('INVALID_COORDINATE_UNITS');
    });

    it('현재 랜드마크 좌표가 1.0 초과(픽셀 좌표)인 경우 거부해야 한다 (INVALID_COORDINATE_UNITS)', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(640),
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('INVALID_COORDINATE_UNITS');
    });

    it('좌표가 음수이거나 NaN인 비정상 단위 혼용을 거부해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const negativeResult = adapter.update({
        timestampMs: 100,
        hipY: -0.1,
      });
      expect(negativeResult.isValid).toBe(false);
      expect(negativeResult.invalidReason).toBe('INVALID_COORDINATE_UNITS');

      const nanResult = adapter.update({
        timestampMs: 100,
        hipY: Number.NaN,
      });
      expect(nanResult.isValid).toBe(false);
      expect(nanResult.invalidReason).toBe('INVALID_COORDINATE_UNITS');
    });

    it('추적 상실 플래그(isTrackingLost=true)가 전달되면 isValid=false 및 TRACKING_LOST를 보고해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.6),
        isTrackingLost: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('TRACKING_LOST');
    });

    it('랜드마크 신뢰도(visibility)가 0.5 미만이면 LOW_CONFIDENCE로 거부해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.6, 0.35, 0.3), // visibility 0.3
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('LOW_CONFIDENCE');
    });
  });

  describe('3. 자세 및 가동 범위 판정 (사용자별 임계치)', () => {
    beforeEach(() => {
      adapter.setBaseline(validBaseline); // baseline hipY = 0.6
    });

    it('하강값 deltaY가 squatDropThreshold(0.065) 미만이면 ducking이 아니어야 한다', () => {
      // baseline hipY 0.60 + delta 0.05 = 0.65 (delta 0.05 < 0.065)
      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.65),
      });

      expect(result.isValid).toBe(true);
      expect(result.isDucking).toBe(false);
      expect(result.deltaY).toBeCloseTo(0.05, 3);
    });

    it('하강값 deltaY가 squatDropThreshold(0.065) 이상이면 낮아짐/안전 자세(ducking)로 판정해야 한다', () => {
      // baseline hipY 0.60 + delta 0.07 = 0.67 (delta 0.07 >= 0.065)
      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.67),
      });

      expect(result.isValid).toBe(true);
      expect(result.isDucking).toBe(true);
      expect(result.posture).toBe('ducking');
      expect(result.deltaY).toBeCloseTo(0.07, 3);
      expect(adapter.isDucking).toBe(true);
    });

    it('하강값 deltaY가 squatStandThreshold(0.035) 이하이면 직립(standing)으로 판정해야 한다', () => {
      // baseline hipY 0.60 + delta 0.02 = 0.62 (delta 0.02 <= 0.035)
      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks(0.62),
      });

      expect(result.isValid).toBe(true);
      expect(result.isStanding).toBe(true);
      expect(result.isDucking).toBe(false);
      expect(result.posture).toBe('standing');
    });

    it('사용자별 가동 범위 커스텀 옵션(예: 저가동성)을 지원해야 한다', () => {
      const customAdapter = new AssaultSquatAdapter({
        squatDropThreshold: 0.04,
        squatStandThreshold: 0.02,
      });
      customAdapter.setBaseline(validBaseline);

      // delta 0.045 >= custom 0.040 -> ducking
      const duckResult = customAdapter.update({
        timestampMs: 100,
        hipY: 0.645,
      });
      expect(duckResult.isDucking).toBe(true);

      // delta 0.015 <= custom 0.020 -> standing
      const standResult = customAdapter.update({
        timestampMs: 200,
        hipY: 0.615,
      });
      expect(standResult.isStanding).toBe(true);
      expect(customAdapter.standGeneration).toBe(1);
    });
  });

  describe('4. 직립 복귀 Generation 관리 (앉기 유지·경계 떨림 방지)', () => {
    beforeEach(() => {
      adapter.setBaseline(validBaseline); // baseline hipY = 0.6
      // 직립 상태로 초기화
      adapter.update({ timestampMs: 0, hipY: 0.61 });
    });

    it('초기 직립 상태에서는 standGeneration이 0이어야 한다', () => {
      expect(adapter.standGeneration).toBe(0);
    });

    it('스쿼트로 낮아진 상태(ducking)에서는 standGeneration이 증가하지 않아야 한다', () => {
      const duckResult = adapter.update({ timestampMs: 100, hipY: 0.68 });
      expect(duckResult.isDucking).toBe(true);
      expect(adapter.standGeneration).toBe(0);
    });

    it('스쿼트 자세를 장시간 계속 유지(holding)해도 standGeneration은 0이어야 한다', () => {
      for (let t = 100; t <= 1000; t += 50) {
        const res = adapter.update({ timestampMs: t, hipY: 0.69 });
        expect(res.isDucking).toBe(true);
        expect(adapter.standGeneration).toBe(0);
      }
    });

    it('실제 낮아진 상태(ducking)에서 직립(standing)으로 복귀할 때만 standGeneration이 정확히 1 증가해야 한다', () => {
      // 1) 스쿼트 하강
      adapter.update({ timestampMs: 100, hipY: 0.68 });
      expect(adapter.isDucking).toBe(true);
      expect(adapter.standGeneration).toBe(0);

      // 2) 직립 복귀
      const standResult = adapter.update({ timestampMs: 200, hipY: 0.61 });
      expect(standResult.isStanding).toBe(true);
      expect(adapter.standGeneration).toBe(1);

      // 3) 직립 상태 지속 유지 시 추가 증가 0회
      adapter.update({ timestampMs: 300, hipY: 0.61 });
      adapter.update({ timestampMs: 400, hipY: 0.60 });
      expect(adapter.standGeneration).toBe(1);
    });

    it('임계값 경계에서 미세한 떨림(jitter)이 발생해도 generation이 잘못 증가하지 않아야 한다', () => {
      // 직립 상태에서 standThreshold(0.035) 주변 떨림 (delta 0.030 ~ 0.034)
      adapter.update({ timestampMs: 100, hipY: 0.630 });
      adapter.update({ timestampMs: 150, hipY: 0.634 });
      adapter.update({ timestampMs: 200, hipY: 0.631 });
      expect(adapter.standGeneration).toBe(0);

      // 하강 중 dropThreshold(0.065) 주변 떨림 (delta 0.060 ~ 0.067)
      adapter.update({ timestampMs: 250, hipY: 0.662 });
      adapter.update({ timestampMs: 300, hipY: 0.666 }); // ducking 진입
      adapter.update({ timestampMs: 350, hipY: 0.662 }); // 전이 구간
      adapter.update({ timestampMs: 400, hipY: 0.668 }); // ducking
      // 아직 직립 복귀 임계치(<= 0.035)에 도달하지 않았으므로 generation은 0이어야 함
      expect(adapter.standGeneration).toBe(0);

      // 완전 직립 복귀 시 비로소 1회 증가
      adapter.update({ timestampMs: 500, hipY: 0.620 });
      expect(adapter.standGeneration).toBe(1);
    });

    it('2회의 완전한 스쿼트 사이클을 거치면 standGeneration이 2가 되어야 한다', () => {
      // 사이클 1
      adapter.update({ timestampMs: 100, hipY: 0.68 }); // duck
      adapter.update({ timestampMs: 200, hipY: 0.61 }); // stand
      expect(adapter.standGeneration).toBe(1);

      // 사이클 2
      adapter.update({ timestampMs: 300, hipY: 0.69 }); // duck
      adapter.update({ timestampMs: 400, hipY: 0.62 }); // stand
      expect(adapter.standGeneration).toBe(2);
    });
  });

  describe('5. 추적 상실 및 복귀 시 generation 오발 방지', () => {
    beforeEach(() => {
      adapter.setBaseline(validBaseline);
      adapter.update({ timestampMs: 0, hipY: 0.61 }); // 직립
    });

    it('스쿼트 도중 추적 상실 후 직립으로 복귀해도 generation이 증가하지 않고 재준비되어야 한다', () => {
      // 1) 스쿼트 상태로 하강
      adapter.update({ timestampMs: 100, hipY: 0.68 });
      expect(adapter.isDucking).toBe(true);
      expect(adapter.standGeneration).toBe(0);

      // 2) 추적 상실 발생
      const lostResult = adapter.update({
        timestampMs: 200,
        isTrackingLost: true,
      });
      expect(lostResult.isValid).toBe(false);
      expect(adapter.standGeneration).toBe(0);

      // 3) 직립 상태로 추적 복구
      const recoveredResult = adapter.update({
        timestampMs: 300,
        hipY: 0.61, // 직립 위치
        isTrackingLost: false,
      });

      expect(recoveredResult.isValid).toBe(true);
      expect(recoveredResult.isStanding).toBe(true);
      // 추적 상실로 인한 비연속 복구는 generation 0회 유지
      expect(adapter.standGeneration).toBe(0);

      // 4) 추적 복구 후 새로운 완전한 스쿼트 사이클은 정상 카운트
      adapter.update({ timestampMs: 400, hipY: 0.68 });
      adapter.update({ timestampMs: 500, hipY: 0.61 });
      expect(adapter.standGeneration).toBe(1);
    });
  });

  describe('6. 입력 pose 불변성 보장', () => {
    it('입력된 landmarks 및 baseline 객체를 변형하지 않아야 한다 (Object.freeze 검증)', () => {
      const frozenBaseline = Object.freeze({ ...validBaseline });
      const rawLandmarks = createMockLandmarks(0.68);
      const frozenLandmarks = Object.freeze(rawLandmarks.map((lm) => Object.freeze({ ...lm })));

      adapter.setBaseline(frozenBaseline);

      expect(() => {
        adapter.update({
          timestampMs: 100,
          landmarks: frozenLandmarks,
        });
      }).not.toThrow();

      expect(adapter.isDucking).toBe(true);
    });
  });

  describe('7. 카메라 미지원 환경 가상/키보드 Fallback 입력', () => {
    it('웹캠 기준선이 없어도 setFallbackDucking()을 통해 스쿼트 자세와 standGeneration을 제어할 수 있어야 한다', () => {
      const fallbackAdapter = new AssaultSquatAdapter();

      // Fallback ducking 활성화
      fallbackAdapter.setFallbackDucking(true, 100);
      expect(fallbackAdapter.isDucking).toBe(true);
      expect(fallbackAdapter.isStanding).toBe(false);
      expect(fallbackAdapter.standGeneration).toBe(0);

      // 반복 누름 시에도 generation 증가 없음
      fallbackAdapter.setFallbackDucking(true, 150);
      expect(fallbackAdapter.standGeneration).toBe(0);

      // 직립 복귀 (키 뗌)
      fallbackAdapter.setFallbackDucking(false, 200);
      expect(fallbackAdapter.isStanding).toBe(true);
      expect(fallbackAdapter.isDucking).toBe(false);
      expect(fallbackAdapter.standGeneration).toBe(1);

      // 반복 직립 신호 시에도 추가 증가 없음
      fallbackAdapter.setFallbackDucking(false, 250);
      expect(fallbackAdapter.standGeneration).toBe(1);
    });
  });

  describe('8. 게임 승패 및 HP/전투 로직과 완전 분리 검증', () => {
    it('어댑터는 HP, 점수, 데미지 또는 전투 상태를 일체 소유하거나 조작하지 않아야 한다', () => {
      adapter.setBaseline(validBaseline);
      const result = adapter.update({ timestampMs: 100, hipY: 0.68 });

      expect(result).not.toHaveProperty('hp');
      expect(result).not.toHaveProperty('damage');
      expect(result).not.toHaveProperty('bossHp');
      expect(result).not.toHaveProperty('score');
      expect(result).not.toHaveProperty('isCorrect');
    });
  });
});
