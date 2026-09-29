/**
 * answer-zone-selector.test.ts - 골반/머리 상대 이동 기반 좌우 정답존 선택기 단위 테스트
 *
 * @see Issue #179 [ANSWER-ZONE-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnswerZoneSelector } from '../../src/input/AnswerZoneSelector.js';
import type { RoundCenterReference } from '../../src/motion/CenterReturnGate.js';
import { DEFAULT_ANSWER_ZONE_CONFIG } from '../../config/beat-motion.config.js';
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

  // Pelvis
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

describe('AnswerZoneSelector - [ANSWER-ZONE-001]', () => {
  let selector: AnswerZoneSelector;
  let standardRef: RoundCenterReference;

  beforeEach(() => {
    selector = new AnswerZoneSelector();
    standardRef = {
      hipX: 0.50,
      headX: 0.50,
      shoulderWidth: 0.20,
      isFallback: false,
      sampleCount: 5,
      source: 'hip',
    };
  });

  describe('1. 설정 및 기본 기준점 제약', () => {
    it('기본 설정값이 비트 모션 규약과 정확히 일치해야 한다', () => {
      expect(DEFAULT_ANSWER_ZONE_CONFIG.entryRatio).toBe(0.42);
      expect(DEFAULT_ANSWER_ZONE_CONFIG.cancelRatio).toBe(0.30);
      expect(DEFAULT_ANSWER_ZONE_CONFIG.dwellDuration).toBe(0.5);
      expect(DEFAULT_ANSWER_ZONE_CONFIG.minVisibility).toBe(0.5);
      expect(DEFAULT_ANSWER_ZONE_CONFIG.isMirrored).toBe(true);
    });

    it('기준점(RoundCenterReference) 없이 답을 확정할 수 없다', () => {
      // reference가 주어지지 않은 상태에서 강한 좌측 이동 전달
      const lm = createMockLandmarks({ hipX: 0.30 });
      const state = selector.update(0.1, lm);

      expect(state.hasReference).toBe(false);
      expect(state.activeZone).toBe('none');
      expect(state.isConfirmed).toBe(false);
      expect(state.confirmedZone).toBe('none');
    });

    it('기준점이 주입되면 정상적으로 활성화된다', () => {
      selector.setReference(standardRef);
      expect(selector.getReference()).toEqual(standardRef);

      const lm = createMockLandmarks({ hipX: 0.50 });
      const state = selector.update(0.1, lm);
      expect(state.hasReference).toBe(true);
    });
  });

  describe('2. 데드존(Dead Zone) 및 상대 변위 진입', () => {
    beforeEach(() => {
      // shoulderWidth = 0.20
      // entryThreshold = 0.42 * 0.20 = 0.084
      // cancelThreshold = 0.30 * 0.20 = 0.060
      selector.setReference(standardRef);
    });

    it('데드존 내부(|dx| < 0.084)에서는 어떤 정답존도 활성화되지 않는다', () => {
      // 미러 모드에서 refScreen = 1 - 0.5 = 0.5
      // hipX = 0.45 -> screenX = 1 - 0.45 = 0.55 -> dx = +0.05 < 0.084
      const lm = createMockLandmarks({ hipX: 0.45 });
      const state = selector.update(0.1, lm);

      expect(state.activeZone).toBe('none');
      expect(state.dwellTime).toBe(0);
      expect(state.isConfirmed).toBe(false);
    });

    it('미러 모드에서 화면 좌측으로 0.084 이상 이동 시 좌측 존(left)이 활성화된다', () => {
      // 미러 좌표계: 화면 좌측(screenX < refScreen)으로 가려면 raw hipX가 증가해야 함 (1 - 0.60 = 0.40 -> dx = -0.10)
      const lmLeft = createMockLandmarks({ hipX: 0.60 });
      const state = selector.update(0.1, lmLeft);

      expect(state.dx).toBeCloseTo(-0.10, 2);
      expect(state.activeZone).toBe('left');
      expect(state.isConfirmed).toBe(false);
      expect(state.dwellProgress).toBeCloseTo(0.2, 1); // 0.1s / 0.5s = 0.2
    });

    it('미러 모드에서 화면 우측으로 0.084 이상 이동 시 우측 존(right)이 활성화된다', () => {
      // raw hipX = 0.40 -> screenX = 1 - 0.40 = 0.60 -> dx = +0.10
      const lmRight = createMockLandmarks({ hipX: 0.40 });
      const state = selector.update(0.1, lmRight);

      expect(state.dx).toBeCloseTo(0.10, 2);
      expect(state.activeZone).toBe('right');
      expect(state.isConfirmed).toBe(false);
      expect(state.dwellProgress).toBeCloseTo(0.2, 1);
    });

    it('좌/우 정답존은 상호 배타적이며 동시에 확정되지 않는다', () => {
      const lmLeft = createMockLandmarks({ hipX: 0.60 });
      const state = selector.update(0.1, lmLeft);
      expect(state.activeZone).toBe('left');
      expect(state.activeZone).not.toBe('right');
    });
  });

  describe('3. 히스테리시스(Hysteresis: 진입 0.42, 취소 0.30)', () => {
    beforeEach(() => {
      selector.setReference(standardRef);
    });

    it('좌측 존 진입 후 진입값(0.084) 미만으로 돌아와도 취소 임계값(0.060) 이내면 존이 유지된다', () => {
      const lmEnter = createMockLandmarks({ hipX: 0.60 }); // dx = -0.10 (진입)
      selector.update(0.2, lmEnter);
      expect(selector.state.activeZone).toBe('left');
      expect(selector.state.dwellTime).toBeCloseTo(0.2, 2);

      // dx = -0.070 (0.084보다는 작지만 0.060 취소선보다는 큼)
      const lmSlightReturn = createMockLandmarks({ hipX: 0.57 }); // screen = 0.43 -> dx = -0.07
      selector.update(0.1, lmSlightReturn);

      expect(selector.state.activeZone).toBe('left');
      expect(selector.state.dwellTime).toBeCloseTo(0.3, 2);
    });

    it('좌측 존에서 취소 임계값(0.060) 이하로 복귀 시 선택이 취소되고 체류 시간이 초기화된다', () => {
      const lmEnter = createMockLandmarks({ hipX: 0.60 }); // dx = -0.10
      selector.update(0.2, lmEnter);
      expect(selector.state.activeZone).toBe('left');

      // dx = -0.040 (|dx| < 0.060 취소 발생)
      const lmCancel = createMockLandmarks({ hipX: 0.54 }); // screen = 0.46 -> dx = -0.04
      selector.update(0.1, lmCancel);

      expect(selector.state.activeZone).toBe('none');
      expect(selector.state.dwellTime).toBe(0);
      expect(selector.state.dwellProgress).toBe(0);
    });

    it('우측 존에서도 동일하게 0.060 취소 임계값 히스테리시스가 작동한다', () => {
      const lmEnter = createMockLandmarks({ hipX: 0.40 }); // dx = +0.10
      selector.update(0.2, lmEnter);
      expect(selector.state.activeZone).toBe('right');

      // dx = +0.070 (유지)
      const lmKeep = createMockLandmarks({ hipX: 0.43 }); // dx = +0.07
      selector.update(0.1, lmKeep);
      expect(selector.state.activeZone).toBe('right');

      // dx = +0.040 (취소)
      const lmCancel = createMockLandmarks({ hipX: 0.46 }); // dx = +0.04
      selector.update(0.1, lmCancel);
      expect(selector.state.activeZone).toBe('none');
      expect(selector.state.dwellTime).toBe(0);
    });
  });

  describe('4. 0.5초 체류 확정(Dwell Confirmation)', () => {
    beforeEach(() => {
      selector.setReference(standardRef);
    });

    it('체류 시간이 0.5초 미만일 때는 확정되지 않는다', () => {
      const lm = createMockLandmarks({ hipX: 0.60 }); // dx = -0.10 (left)

      // 0.4초간 체류
      for (let i = 0; i < 4; i++) {
        selector.update(0.1, lm);
      }

      expect(selector.state.activeZone).toBe('left');
      expect(selector.state.isConfirmed).toBe(false);
      expect(selector.state.confirmedZone).toBe('none');
      expect(selector.state.dwellProgress).toBeCloseTo(0.8, 1);
    });

    it('체류 시간이 0.5초(1박)에 도달하면 해당 존이 확정된다', () => {
      const lm = createMockLandmarks({ hipX: 0.60 }); // left

      // 0.5초 체류
      for (let i = 0; i < 5; i++) {
        selector.update(0.1, lm);
      }

      expect(selector.isConfirmed).toBe(true);
      expect(selector.confirmedZone).toBe('left');
      expect(selector.state.dwellProgress).toBe(1.0);
    });

    it('확정된 이후에는 중앙 복귀나 반대편 이동이 발생해도 확정 결과가 번복되지 않는다', () => {
      const lmLeft = createMockLandmarks({ hipX: 0.60 });
      for (let i = 0; i < 5; i++) {
        selector.update(0.1, lmLeft);
      }
      expect(selector.isConfirmed).toBe(true);
      expect(selector.confirmedZone).toBe('left');

      // 확정 후 플레이어가 즉시 반대편(우측)으로 이동
      const lmRight = createMockLandmarks({ hipX: 0.35 });
      for (let i = 0; i < 5; i++) {
        const state = selector.update(0.1, lmRight);
        expect(state.isConfirmed).toBe(true);
        expect(state.confirmedZone).toBe('left');
      }

      expect(selector.confirmedZone).toBe('left');
    });
  });

  describe('5. 골반 신뢰도 부족 시 보조 입력 (머리+어깨 동방향 검증)', () => {
    beforeEach(() => {
      selector.setReference(standardRef);
    });

    it('골반 신뢰도가 낮고 머리와 어깨가 같은 방향(좌측)으로 이동한 경우 보조 입력으로 인정한다', () => {
      const lm = createMockLandmarks({
        hipVis: 0.1, // 골반 불량
        noseX: 0.60, // screen = 0.40 -> dx = -0.10 (좌측)
        noseVis: 0.9,
        shoulderX: 0.60, // screen = 0.40 -> dx = -0.10 (좌측)
        shoulderVis: 0.9,
      });

      const state = selector.update(0.1, lm);
      expect(state.anchorSource).toBe('auxiliary');
      expect(state.activeZone).toBe('left');
      expect(state.dx).toBeCloseTo(-0.10, 2);
    });

    it('머리는 좌측이나 어깨가 우측 또는 반대 방향이면 보조 입력을 거부(none)한다', () => {
      const lmConflict = createMockLandmarks({
        hipVis: 0.1,
        noseX: 0.60, // screen = 0.40 -> dx = -0.10 (좌측)
        noseVis: 0.9,
        shoulderX: 0.40, // screen = 0.60 -> dx = +0.10 (우측, 상반됨)
        shoulderVis: 0.9,
      });

      const state = selector.update(0.1, lmConflict);
      expect(state.anchorSource).toBe('none');
      expect(state.activeZone).toBe('none');
      expect(state.dx).toBe(0);
    });

    it('머리만 이동하고 어깨가 중앙(데드존)에 정체되어 있으면 보조 입력을 거부한다', () => {
      const lmHeadOnly = createMockLandmarks({
        hipVis: 0.1,
        noseX: 0.60, // screen = 0.40 -> dx = -0.10 (좌측)
        noseVis: 0.9,
        shoulderX: 0.50, // screen = 0.50 -> dx = 0 (정체)
        shoulderVis: 0.9,
      });

      const state = selector.update(0.1, lmHeadOnly);
      expect(state.anchorSource).toBe('none');
      expect(state.activeZone).toBe('none');
    });
  });

  describe('6. 추적 유실 및 미러 옵션', () => {
    beforeEach(() => {
      selector.setReference(standardRef);
    });

    it('추적 유실(null 또는 저신뢰도) 발생 시 체류 시간이 리셋된다', () => {
      const lm = createMockLandmarks({ hipX: 0.60 });
      selector.update(0.3, lm);
      expect(selector.state.dwellTime).toBeCloseTo(0.3, 2);

      // 센서 끊김
      const stateLost = selector.update(0.1, null);
      expect(stateLost.isTrackingLost).toBe(true);
      expect(stateLost.activeZone).toBe('none');
      expect(stateLost.dwellTime).toBe(0);
    });

    it('isMirrored = false 설정 시 원본 카메라 좌표계 기준으로 좌/우가 산출된다', () => {
      const unmirroredSelector = new AnswerZoneSelector({ isMirrored: false });
      unmirroredSelector.setReference(standardRef);

      // unmirrored: dx = rawX - refX = 0.40 - 0.50 = -0.10 (좌측)
      const lmLeft = createMockLandmarks({ hipX: 0.40 });
      const state = unmirroredSelector.update(0.1, lmLeft);

      expect(state.dx).toBeCloseTo(-0.10, 2);
      expect(state.activeZone).toBe('left');
    });
  });

  describe('7. Fallback 키보드/터치 입력 및 리셋', () => {
    it('selectByFallback() 호출 시 체류 시간 없이 즉시 해당 존이 확정된다', () => {
      selector.setReference(standardRef);
      selector.selectByFallback('right');

      expect(selector.isConfirmed).toBe(true);
      expect(selector.confirmedZone).toBe('right');
      expect(selector.state.anchorSource).toBe('fallback');
      expect(selector.state.dwellProgress).toBe(1.0);
    });

    it('reset() 호출 시 모든 선택 상태가 초기화된다', () => {
      selector.setReference(standardRef);
      selector.selectByFallback('left');
      expect(selector.isConfirmed).toBe(true);

      selector.reset();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.confirmedZone).toBe('none');
      expect(selector.activeZone).toBe('none');
      expect(selector.dwellProgress).toBe(0);
    });
  });

  describe('8. 좌표계 스케일 계약 검증 [BUG-BEAT-003]', () => {
    it('가상 픽셀 좌표(0~1080) 직접 입력 시 1프레임만에 비정상 좌측 진입 발생을 검증한다', () => {
      selector.setReference(standardRef);
      // 1080 픽셀 기준 중앙(540)을 직접 전달할 경우
      const lmPixel = createMockLandmarks({ hipX: 540 });
      const state = selector.update(0.1, lmPixel);
      // 정규화 전제(1 - rawX)에 540이 들어가 dx가 -539.5로 폭주하여 첫 프레임에 좌측 진입
      expect(state.dx).toBeLessThan(-100);
      expect(state.activeZone).toBe('left');
    });

    it('정규화 좌표(0~1) 및 isMirrored=false 환경에서 화면 좌/우 방향이 일치한다', () => {
      const screenSelector = new AnswerZoneSelector({ isMirrored: false });
      screenSelector.setReference(standardRef);

      // 화면 좌측(0.35, dx = -0.15)
      const lmLeft = createMockLandmarks({ hipX: 0.35 });
      const stateLeft = screenSelector.update(0.1, lmLeft);
      expect(stateLeft.dx).toBeCloseTo(-0.15, 2);
      expect(stateLeft.activeZone).toBe('left');

      // 리셋 후 화면 우측(0.65, dx = +0.15)
      screenSelector.reset();
      screenSelector.setReference(standardRef);
      const lmRight = createMockLandmarks({ hipX: 0.65 });
      const stateRight = screenSelector.update(0.1, lmRight);
      expect(stateRight.dx).toBeCloseTo(0.15, 2);
      expect(stateRight.activeZone).toBe('right');
    });
  });
});
