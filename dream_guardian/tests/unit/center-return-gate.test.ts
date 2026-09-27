/**
 * center-return-gate.test.ts - 중앙 복귀 게이트 및 개인 기준점 잠금 단위 테스트
 *
 * @see Issue #178 [CENTER-RETURN-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CenterReturnGate } from '../../src/motion/CenterReturnGate.js';
import {
  DEFAULT_CENTER_RETURN_CONFIG,
  type CenterReturnConfig,
} from '../../config/beat-motion.config.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

/**
 * 테스트용 33개 랜드마크 생성 도우미
 */
function createMockLandmarks(options: {
  hipX?: number;
  hipVis?: number;
  shoulderX?: number;
  shoulderWidth?: number;
  shoulderVis?: number;
  noseX?: number;
  noseVis?: number;
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  const hipX = options.hipX ?? 0.5;
  const hipVis = options.hipVis ?? 0.9;
  const shoulderX = options.shoulderX ?? 0.5;
  const shoulderWidth = options.shoulderWidth ?? 0.20;
  const shoulderVis = options.shoulderVis ?? 0.9;
  const noseX = options.noseX ?? shoulderX;
  const noseVis = options.noseVis ?? 0.9;

  // Pelvis (Left/Right Hip)
  landmarks[POSE_LANDMARKS.LEFT_HIP] = {
    x: hipX - 0.05,
    y: 0.55,
    z: 0,
    visibility: hipVis,
  };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = {
    x: hipX + 0.05,
    y: 0.55,
    z: 0,
    visibility: hipVis,
  };

  // Shoulders
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = {
    x: shoulderX - shoulderWidth / 2,
    y: 0.35,
    z: 0,
    visibility: shoulderVis,
  };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = {
    x: shoulderX + shoulderWidth / 2,
    y: 0.35,
    z: 0,
    visibility: shoulderVis,
  };

  // Head (Nose)
  landmarks[POSE_LANDMARKS.NOSE] = {
    x: noseX,
    y: 0.20,
    z: 0,
    visibility: noseVis,
  };

  return landmarks;
}

describe('CenterReturnGate - [CENTER-RETURN-001]', () => {
  let gate: CenterReturnGate;

  beforeEach(() => {
    gate = new CenterReturnGate();
  });

  describe('1. 설정 분리 및 기본값 검증', () => {
    it('기본 설정값이 비트 모션 규약과 정확히 일치해야 한다', () => {
      expect(DEFAULT_CENTER_RETURN_CONFIG.targetX).toBe(0.5);
      expect(DEFAULT_CENTER_RETURN_CONFIG.toleranceX).toBe(0.08);
      expect(DEFAULT_CENTER_RETURN_CONFIG.stabilityDuration).toBe(0.4);
      expect(DEFAULT_CENTER_RETURN_CONFIG.standardDuration).toBe(1.0);
      expect(DEFAULT_CENTER_RETURN_CONFIG.maxExtensionBeats).toBe(2);
      expect(DEFAULT_CENTER_RETURN_CONFIG.maxExtensionDuration).toBe(1.0);
      expect(DEFAULT_CENTER_RETURN_CONFIG.minVisibility).toBe(0.5);
      expect(DEFAULT_CENTER_RETURN_CONFIG.defaultFallbackReference).toEqual({
        hipX: 0.5,
        headX: 0.5,
        shoulderWidth: 0.20,
      });
    });

    it('커스텀 설정을 주입받아 동작할 수 있어야 한다', () => {
      const customConfig: Partial<CenterReturnConfig> = {
        toleranceX: 0.05,
        stabilityDuration: 0.3,
      };
      const customGate = new CenterReturnGate(customConfig);
      expect(customGate.config.toleranceX).toBe(0.05);
      expect(customGate.config.stabilityDuration).toBe(0.3);
      expect(customGate.config.targetX).toBe(0.5); // 기본값 유지
    });
  });

  describe('2. 앵커 평가 (골반 우선 및 보조 앵커)', () => {
    it('골반 신뢰도가 충분할 때 primary 골반 중심(hipX)을 우선 평가한다', () => {
      gate.open();
      const lm = createMockLandmarks({
        hipX: 0.49,
        hipVis: 0.85,
        shoulderX: 0.53,
        shoulderVis: 0.85,
        noseX: 0.54,
        noseVis: 0.85,
      });

      const res = gate.update(0.1, lm);
      expect(res.anchorSource).toBe('hip');
      expect(res.currentCenterX).toBeCloseTo(0.49, 2);
    });

    it('골반 신뢰도 부족 시(visibility < 0.5) 머리+어깨 중심 보조 앵커를 평가한다', () => {
      gate.open();
      const lm = createMockLandmarks({
        hipX: 0.30, // 골반은 완전히 벗어나 있으나 신뢰도 낮음
        hipVis: 0.2, // 신뢰도 부족
        shoulderX: 0.50,
        shoulderWidth: 0.20,
        shoulderVis: 0.9,
        noseX: 0.50,
        noseVis: 0.9,
      });

      const res = gate.update(0.1, lm);
      expect(res.anchorSource).toBe('auxiliary');
      expect(res.currentCenterX).toBeCloseTo(0.50, 2);
      expect(res.isInsideGate).toBe(true);
    });

    it('골반 및 코 신뢰도 부족 시 어깨 중심만으로 보조 앵커를 산출한다', () => {
      gate.open();
      const lm = createMockLandmarks({
        hipVis: 0.1,
        noseVis: 0.1,
        shoulderX: 0.48,
        shoulderWidth: 0.22,
        shoulderVis: 0.9,
      });

      const res = gate.update(0.1, lm);
      expect(res.anchorSource).toBe('auxiliary');
      expect(res.currentCenterX).toBeCloseTo(0.48, 2);
    });

    it('골반 및 어깨 신뢰도 부족 시 머리(코)만으로 보조 앵커를 산출한다', () => {
      gate.open();
      const lm = createMockLandmarks({
        hipVis: 0.1,
        shoulderVis: 0.1,
        noseX: 0.51,
        noseVis: 0.9,
      });

      const res = gate.update(0.1, lm);
      expect(res.anchorSource).toBe('auxiliary');
      expect(res.currentCenterX).toBeCloseTo(0.51, 2);
    });

    it('모든 랜드마크 신뢰도가 부족할 경우 추적 유실(none)로 평가한다', () => {
      gate.open();
      const lm = createMockLandmarks({
        hipVis: 0.2,
        shoulderVis: 0.2,
        noseVis: 0.2,
      });

      const res = gate.update(0.1, lm);
      expect(res.anchorSource).toBe('none');
      expect(res.currentCenterX).toBeNull();
      expect(gate.isTrackingLost).toBe(true);
    });
  });

  describe('3. 중앙 외부 및 흔들림(Shaking) 제약', () => {
    it('중앙 외부(|centerX - 0.5| > toleranceX)에서는 기준점이 절대 잠기지 않는다', () => {
      gate.open();
      // x = 0.35 (tolerance 0.08 바깥)
      const lm = createMockLandmarks({ hipX: 0.35 });

      for (let i = 0; i < 10; i++) {
        const res = gate.update(0.05, lm);
        expect(res.isInsideGate).toBe(false);
        expect(res.isLocked).toBe(false);
      }

      expect(gate.isLocked).toBe(false);
      expect(gate.reference).toBeNull();
      expect(gate.lock()).toBeNull();
    });

    it('중앙에 있다가 밖으로 벗어나는 흔들림(jitter) 발생 시 안정 누적 시간이 리셋된다', () => {
      gate.open();
      const lmInside = createMockLandmarks({ hipX: 0.50 });
      const lmOutside = createMockLandmarks({ hipX: 0.65 });

      // 0.3초간 중앙 체류 (안정 시간 0.4초 미만)
      for (let i = 0; i < 6; i++) {
        gate.update(0.05, lmInside);
      }
      expect(gate.stableTime).toBeCloseTo(0.3, 2);
      expect(gate.isStable).toBe(false);

      // 중앙 이탈 발생!
      gate.update(0.05, lmOutside);
      expect(gate.stableTime).toBe(0);
      expect(gate.sampleCount).toBe(0);
      expect(gate.isStable).toBe(false);

      // 다시 중앙으로 복귀하여 0.2초 체류
      for (let i = 0; i < 4; i++) {
        gate.update(0.05, lmInside);
      }
      expect(gate.stableTime).toBeCloseTo(0.2, 2);
      expect(gate.isLocked).toBe(false);
    });

    it('추적 유실 발생 시 안정 누적 시간이 즉시 리셋된다', () => {
      gate.open();
      const lmInside = createMockLandmarks({ hipX: 0.50 });

      // 0.3초간 체류
      for (let i = 0; i < 6; i++) {
        gate.update(0.05, lmInside);
      }
      expect(gate.stableTime).toBeCloseTo(0.3, 2);

      // 센서 끊김 / 추적 유실
      gate.update(0.05, null);
      expect(gate.isTrackingLost).toBe(true);
      expect(gate.stableTime).toBe(0);
      expect(gate.sampleCount).toBe(0);
    });
  });

  describe('4. 안정 프레임 중앙값(Median) 잠금 및 단 1회 잠금 보장', () => {
    it('안정 시간 충족 시 프레임들의 중앙값(median)으로 RoundCenterReference를 정확히 잠근다', () => {
      gate.open();

      // 이상치(outlier)가 섞인 5개 프레임 공급 (hipX: 0.48, 0.49, 0.50, 0.52, 0.56) -> 중앙값 0.50
      const hipSamples = [0.48, 0.49, 0.50, 0.52, 0.56];
      const headSamples = [0.49, 0.50, 0.51, 0.51, 0.55]; // 중앙값 0.51
      const swSamples = [0.18, 0.19, 0.20, 0.21, 0.22]; // 중앙값 0.20

      for (let i = 0; i < 5; i++) {
        const lm = createMockLandmarks({
          hipX: hipSamples[i],
          noseX: headSamples[i],
          shoulderWidth: swSamples[i],
        });
        // 0.4초 충족을 위해 마지막 프레임에 0.1s 추가 (0.08 * 4 + 0.10 = 0.42s)
        gate.update(i === 4 ? 0.10 : 0.08, lm);
      }

      expect(gate.isStable).toBe(true);
      expect(gate.isLocked).toBe(true);
      expect(gate.status).toBe('locked');

      const ref = gate.reference;
      expect(ref).not.toBeNull();
      expect(ref!.hipX).toBeCloseTo(0.50, 3);
      expect(ref!.headX).toBeCloseTo(0.51, 3);
      expect(ref!.shoulderWidth).toBeCloseTo(0.20, 3);
      expect(ref!.isFallback).toBe(false);
      expect(ref!.source).toBe('hip');
      expect(ref!.sampleCount).toBe(5);
    });

    it('안정 중앙 프레임은 한 번만 기준점을 잠그며 이후 움직임에 덮어써지지 않는다', () => {
      gate.open();
      const lmCenter = createMockLandmarks({ hipX: 0.50, shoulderWidth: 0.20 });

      // 0.45초간 중앙 체류하여 기준점 잠금
      for (let i = 0; i < 9; i++) {
        gate.update(0.05, lmCenter);
      }
      expect(gate.isLocked).toBe(true);
      const lockedRef = { ...gate.reference! };

      // 이후 플레이어가 좌측(0.20) 또는 우측으로 급격히 이동
      const lmFarLeft = createMockLandmarks({ hipX: 0.20, shoulderWidth: 0.35 });
      for (let i = 0; i < 5; i++) {
        const res = gate.update(0.05, lmFarLeft);
        expect(res.isLocked).toBe(true);
      }

      // 잠긴 기준점은 최초 잠금 값 유지
      expect(gate.reference!.hipX).toBe(lockedRef.hipX);
      expect(gate.reference!.shoulderWidth).toBe(lockedRef.shoulderWidth);

      // lock() 추가 호출 시에도 동일한 기존 참조 반환
      const secondCall = gate.lock();
      expect(secondCall).toEqual(lockedRef);
    });
  });

  describe('5. 최대 2박 연장(Retry) 및 타임아웃(Timeout) 규약', () => {
    it('표준 복귀 시간(1.0초 / 2박) 경과 시 오답/HP 차감 없이 retry 상태로 전이한다', () => {
      gate.open();
      const lmOutside = createMockLandmarks({ hipX: 0.30 });

      // 0.9초 경과 -> seeking
      for (let i = 0; i < 9; i++) {
        gate.update(0.1, lmOutside);
      }
      expect(gate.status).toBe('seeking');
      expect(gate.isRetrying).toBe(false);
      expect(gate.isLocked).toBe(false);

      // 1.0초 경과 시점 -> retry (연장 안내 상태)
      gate.update(0.1, lmOutside);
      expect(gate.status).toBe('retry');
      expect(gate.isRetrying).toBe(true);
      expect(gate.isLocked).toBe(false);
    });

    it('연장 기간(retry) 중에 중앙에 안정 복귀하면 정상적으로 잠금에 성공한다', () => {
      gate.open();
      const lmOutside = createMockLandmarks({ hipX: 0.30 });
      const lmInside = createMockLandmarks({ hipX: 0.50 });

      // 1.2초까지 이탈 상태 유지 (retry 모드 진입)
      for (let i = 0; i < 12; i++) {
        gate.update(0.1, lmOutside);
      }
      expect(gate.status).toBe('retry');

      // 1.2초 ~ 1.65초 동안 중앙 복귀 및 0.45초 체류
      for (let i = 0; i < 9; i++) {
        gate.update(0.05, lmInside);
      }

      expect(gate.isLocked).toBe(true);
      expect(gate.status).toBe('locked');
      expect(gate.reference!.isFallback).toBe(false);
      expect(gate.reference!.hipX).toBeCloseTo(0.50, 2);
    });

    it('최대 연장 시간(1.0s + 1.0s = 2.0초 / 총 4박) 만료 시 fallback 기준점을 강제 잠금하고 timeout 처리한다', () => {
      gate.open();
      const lmOutside = createMockLandmarks({ hipX: 0.25 });

      // 2.05초 동안 중앙 복귀 실패 유지
      for (let i = 0; i < 21; i++) {
        gate.update(0.1, lmOutside);
      }

      expect(gate.status).toBe('timeout');
      expect(gate.isTimedOut).toBe(true);
      expect(gate.isLocked).toBe(true); // 게임 루프 진행을 위해 lock 완료

      const ref = gate.reference;
      expect(ref).not.toBeNull();
      expect(ref!.isFallback).toBe(true);
      expect(ref!.source).toBe('fallback');
      expect(ref!.hipX).toBe(DEFAULT_CENTER_RETURN_CONFIG.defaultFallbackReference.hipX);
      expect(ref!.headX).toBe(DEFAULT_CENTER_RETURN_CONFIG.defaultFallbackReference.headX);
      expect(ref!.shoulderWidth).toBe(DEFAULT_CENTER_RETURN_CONFIG.defaultFallbackReference.shoulderWidth);
    });

    it('forceFallbackLock() 호출 시 즉시 기본 기준점이 잠겨야 한다', () => {
      gate.open();
      const fallbackRef = gate.forceFallbackLock();

      expect(fallbackRef.isFallback).toBe(true);
      expect(fallbackRef.source).toBe('fallback');
      expect(gate.isLocked).toBe(true);
      expect(gate.reference).toBe(fallbackRef);
    });
  });

  describe('6. 수명주기(Lifecycle) 및 재사용', () => {
    it('open() 호출 시 이전 라운드의 잠금 상태가 초기화되어야 한다', () => {
      gate.open({ roundIndex: 1 });
      const lm = createMockLandmarks({ hipX: 0.50 });
      for (let i = 0; i < 9; i++) {
        gate.update(0.05, lm);
      }
      expect(gate.isLocked).toBe(true);

      // 다음 라운드 open
      gate.open({ roundIndex: 2 });
      expect(gate.isLocked).toBe(false);
      expect(gate.status).toBe('seeking');
      expect(gate.reference).toBeNull();
      expect(gate.stableTime).toBe(0);
      expect(gate.roundIndex).toBe(2);
    });

    it('close() 호출 시 게이트가 닫히고 idle 상태가 된다', () => {
      gate.open();
      expect(gate.isOpen).toBe(true);

      gate.close();
      expect(gate.isOpen).toBe(false);
      expect(gate.status).toBe('idle');
    });
  });
});
