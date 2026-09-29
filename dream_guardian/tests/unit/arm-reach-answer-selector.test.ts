/**
 * arm-reach-answer-selector.test.ts - Zone 4/5 한 팔 도달 기반 무체류 즉시 답안 선택기 단위 테스트
 *
 * @see Issue #224 [INPUT-ARM-ANSWER-001]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

/**
 * 테스트용 33개 랜드마크 생성 도우미
 */
function createMockPose(options: {
  leftWrist?: { x: number; y: number; visibility?: number };
  rightWrist?: { x: number; y: number; visibility?: number };
  leftShoulder?: { x: number; y: number; visibility?: number };
  rightShoulder?: { x: number; y: number; visibility?: number };
  leftHip?: { x: number; y: number; visibility?: number };
  rightHip?: { x: number; y: number; visibility?: number };
  nose?: { x: number; y: number; visibility?: number };
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  // Shoulders (기본 어깨 너비 0.20, 중심 0.50, y 0.35)
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = {
    x: options.leftShoulder?.x ?? 0.40,
    y: options.leftShoulder?.y ?? 0.35,
    z: 0,
    visibility: options.leftShoulder?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = {
    x: options.rightShoulder?.x ?? 0.60,
    y: options.rightShoulder?.y ?? 0.35,
    z: 0,
    visibility: options.rightShoulder?.visibility ?? 0.9,
  };

  // Wrists (기본 차려 자세: 몸통 부근 x 0.40 / 0.60, y 0.60)
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = {
    x: options.leftWrist?.x ?? 0.40,
    y: options.leftWrist?.y ?? 0.60,
    z: 0,
    visibility: options.leftWrist?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = {
    x: options.rightWrist?.x ?? 0.60,
    y: options.rightWrist?.y ?? 0.60,
    z: 0,
    visibility: options.rightWrist?.visibility ?? 0.9,
  };

  // Hips
  landmarks[POSE_LANDMARKS.LEFT_HIP] = {
    x: options.leftHip?.x ?? 0.45,
    y: options.leftHip?.y ?? 0.65,
    z: 0,
    visibility: options.leftHip?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = {
    x: options.rightHip?.x ?? 0.55,
    y: options.rightHip?.y ?? 0.65,
    z: 0,
    visibility: options.rightHip?.visibility ?? 0.9,
  };

  // Nose
  landmarks[POSE_LANDMARKS.NOSE] = {
    x: options.nose?.x ?? 0.50,
    y: options.nose?.y ?? 0.20,
    z: 0,
    visibility: options.nose?.visibility ?? 0.9,
  };

  return landmarks;
}

describe('ArmReachAnswerSelector (Issue #224 - INPUT-ARM-ANSWER-001)', () => {
  let selector: ArmReachAnswerSelector;

  // Zone 4: x: [0.04, 0.30], y: [0.24, 0.40] (중심: x 0.17, y 0.32)
  // Zone 5: x: [0.70, 0.96], y: [0.24, 0.40] (중심: x 0.83, y 0.32)
  const ZONE_4_CENTER = { x: 0.17, y: 0.32 };
  const ZONE_5_CENTER = { x: 0.83, y: 0.32 };

  beforeEach(() => {
    selector = new ArmReachAnswerSelector({ isMirrored: false });
  });

  describe('1. 정적 손 위치 무체류(0s) 즉시 확정', () => {
    it('답안 창이 열릴 때 한 손이 Zone 4에 이미 정지해 있으면 첫 프레임에 0번이 즉시 선택된다', () => {
      const pose = createMockPose({
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.95 },
      });

      const result = selector.update(0.0, pose);

      expect(result).not.toBeNull();
      expect(result?.answerIndex).toBe(0);
      expect(result?.zoneId).toBe(4);
      expect(result?.hand).toBe('left');
      expect(selector.isConfirmed).toBe(true);
      expect(selector.confirmedAnswerIndex).toBe(0);
      expect(selector.confirmedZoneId).toBe(4);
    });

    it('답안 창이 열릴 때 한 손이 Zone 5에 이미 정지해 있으면 첫 프레임에 1번이 즉시 선택된다', () => {
      const pose = createMockPose({
        rightWrist: { ...ZONE_5_CENTER, visibility: 0.95 },
      });

      const result = selector.update(0.0, pose);

      expect(result).not.toBeNull();
      expect(result?.answerIndex).toBe(1);
      expect(result?.zoneId).toBe(5);
      expect(result?.hand).toBe('right');
      expect(selector.isConfirmed).toBe(true);
      expect(selector.confirmedAnswerIndex).toBe(1);
      expect(selector.confirmedZoneId).toBe(5);
    });
  });

  describe('2. 동적 뻗기(수평 이동 방향 + 속도 우세) 보조 검증', () => {
    it('중앙에서 바깥 좌측(Zone 4)으로 팔을 뻗어 진입하면 0번이 즉시 선택된다', () => {
      // Frame 1: 손이 중앙 근처 (x 0.45, y 0.32)
      const pose1 = createMockPose({
        leftWrist: { x: 0.45, y: 0.32, visibility: 0.9 },
      });
      const res1 = selector.update(0.0, pose1);
      expect(res1).toBeNull();
      expect(selector.isConfirmed).toBe(false);

      // Frame 2: 0.1초 후 Zone 4 중심(x 0.17, y 0.32)으로 수평 진입
      // vx = (0.17 - 0.45) / 0.1 = -2.8 (속도 크기 2.8 >= 0.25, 수평 우세)
      const pose2 = createMockPose({
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
      });
      const res2 = selector.update(0.1, pose2);

      expect(res2).not.toBeNull();
      expect(res2?.answerIndex).toBe(0);
      expect(res2?.zoneId).toBe(4);
      expect(selector.isConfirmed).toBe(true);
    });

    it('중앙에서 바깥 우측(Zone 5)으로 팔을 뻗어 진입하면 1번이 즉시 선택된다', () => {
      // Frame 1: 손이 중앙 근처 (x 0.55, y 0.32)
      const pose1 = createMockPose({
        rightWrist: { x: 0.55, y: 0.32, visibility: 0.9 },
      });
      const res1 = selector.update(0.0, pose1);
      expect(res1).toBeNull();

      // Frame 2: 0.1초 후 Zone 5 중심(x 0.83, y 0.32)으로 수평 진입
      const pose2 = createMockPose({
        rightWrist: { ...ZONE_5_CENTER, visibility: 0.9 },
      });
      const res2 = selector.update(0.1, pose2);

      expect(res2).not.toBeNull();
      expect(res2?.answerIndex).toBe(1);
      expect(res2?.zoneId).toBe(5);
      expect(selector.isConfirmed).toBe(true);
    });

    it('Zone 4 내부에서 중앙 쪽으로 되돌아오는(안쪽 방향 이동) 손동작은 선택되지 않는다', () => {
      // 존 밖에서 안으로 들어오되, 우측(+vx, 몸통 방향)으로 이동하면서 존 5에 스치는 경우
      const poseOutside = createMockPose({
        rightWrist: { x: 0.98, y: 0.32, visibility: 0.9 },
      });
      selector.update(0.0, poseOutside);
      // 우측에서 좌측으로 들어옴 (vx = (0.83 - 0.98)/0.1 = -1.5, 즉 안쪽/중앙 방향)
      const poseInward = createMockPose({
        rightWrist: { x: 0.83, y: 0.32, visibility: 0.9 },
      });
      const res = selector.update(0.1, poseInward);
      // Zone 5는 바깥쪽(우측, +vx)으로 뻗어야 하므로 좌측(-vx) 진입은 차단
      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });
  });

  describe('3. 손의 색상 및 왼손/오른손 종류 무관성', () => {
    it('오른손이 Zone 4(화면 좌측)에 도달해도 0번 답안으로 선택된다', () => {
      const pose = createMockPose({
        rightWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
      });

      const result = selector.update(0.0, pose);

      expect(result).not.toBeNull();
      expect(result?.answerIndex).toBe(0);
      expect(result?.zoneId).toBe(4);
      expect(result?.hand).toBe('right');
    });

    it('왼손이 Zone 5(화면 우측)에 도달해도 1번 답안으로 선택된다', () => {
      const pose = createMockPose({
        leftWrist: { ...ZONE_5_CENTER, visibility: 0.9 },
      });

      const result = selector.update(0.0, pose);

      expect(result).not.toBeNull();
      expect(result?.answerIndex).toBe(1);
      expect(result?.zoneId).toBe(5);
      expect(result?.hand).toBe('left');
    });
  });

  describe('4. 양팔 동시 유효 시 미선택 (Strict Mutual Exclusion)', () => {
    it('왼손이 Zone 4에, 오른손이 Zone 5에 동시에 위치하면 미선택(null)된다', () => {
      const pose = createMockPose({
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
        rightWrist: { ...ZONE_5_CENTER, visibility: 0.9 },
      });

      const result = selector.update(0.0, pose);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isMutualExclusionBlocked).toBe(true);
    });

    it('양손이 동일한 존(Zone 4)에 동시에 위치해도 미선택(null)된다', () => {
      const pose = createMockPose({
        leftWrist: { x: 0.12, y: 0.32, visibility: 0.9 },
        rightWrist: { x: 0.22, y: 0.32, visibility: 0.9 },
      });

      const result = selector.update(0.0, pose);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isMutualExclusionBlocked).toBe(true);
    });

    it('양손이 동일한 존(Zone 5)에 동시에 위치해도 미선택(null)된다', () => {
      const pose = createMockPose({
        leftWrist: { x: 0.75, y: 0.32, visibility: 0.9 },
        rightWrist: { x: 0.85, y: 0.32, visibility: 0.9 },
      });

      const result = selector.update(0.0, pose);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isMutualExclusionBlocked).toBe(true);
    });

    it('한 손이 Zone 4에 있고 다른 손의 가시성이 minVisibility 미만이면 정상 선택된다', () => {
      const pose = createMockPose({
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
        rightWrist: { ...ZONE_5_CENTER, visibility: 0.2 }, // 가시성 낮음
      });

      const result = selector.update(0.0, pose);

      expect(result).not.toBeNull();
      expect(result?.answerIndex).toBe(0);
      expect(selector.isConfirmed).toBe(true);
    });
  });

  describe('5. 수직 점프 동작 오선택 원천 차단', () => {
    it('손이 수직 상승 속도(vy) 상한을 초과하면 Zone 4에 있어도 선택되지 않는다', () => {
      // Frame 1: 손이 하단 (y 0.65)
      const pose1 = createMockPose({
        leftWrist: { x: 0.17, y: 0.65, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 0.1초 후 Zone 4 내부(y 0.32)로 급격한 수직 상승 (vy = -3.3, vy >= 0.22)
      const pose2 = createMockPose({
        leftWrist: { x: 0.17, y: 0.32, visibility: 0.9 },
      });
      const result = selector.update(0.1, pose2);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isJumpBlocked).toBe(true);
    });

    it('수직 속도가 수평 속도 대비 우세하면 (|vx| <= 1.2 * |vy|) 선택되지 않는다', () => {
      // Frame 1
      const pose1 = createMockPose({
        leftWrist: { x: 0.25, y: 0.50, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: dt = 0.1s, vx = (0.17 - 0.25)/0.1 = -0.8, vy = (0.32 - 0.50)/0.1 = -1.8
      // |vx| (0.8) <= 1.2 * |vy| (2.16)
      const pose2 = createMockPose({
        leftWrist: { x: 0.17, y: 0.32, visibility: 0.9 },
      });
      const result = selector.update(0.1, pose2);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });

    it('전신 수직 점프(어깨/몸통 급상승) 시 손이 Zone 4에 도달해도 선택되지 않는다', () => {
      // Frame 1: 차려 자세, 어깨 y 0.45
      const pose1 = createMockPose({
        leftShoulder: { x: 0.40, y: 0.45, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.45, visibility: 0.9 },
        leftWrist: { x: 0.35, y: 0.45, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 0.1초 후 점프로 어깨 y 0.35 (상승 속도 1.0 >= 0.22), 손은 우연히 Zone 4 진입
      const pose2 = createMockPose({
        leftShoulder: { x: 0.40, y: 0.35, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.35, visibility: 0.9 },
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
      });
      const result = selector.update(0.1, pose2);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isJumpBlocked).toBe(true);
    });
  });

  describe('6. 최소 팔 뻗음 거리 비율 (minArmExtensionRatio) 검증', () => {
    it('손이 어깨에 너무 가깝게 웅크려 있는 경우 (비율 < 0.25) 선택되지 않는다', () => {
      // 어깨가 존 4 가까이로 이동한 상태에서 손이 어깨 바로 위에 웅크린 경우
      // shoulderWidth = 0.20, minArmExtension = 0.05
      const pose = createMockPose({
        leftShoulder: { x: 0.20, y: 0.32, visibility: 0.9 },
        rightShoulder: { x: 0.40, y: 0.32, visibility: 0.9 },
        leftWrist: { x: 0.21, y: 0.32, visibility: 0.9 }, // 거리 0.01 / 0.20 = 0.05 < 0.25
      });

      const result = selector.update(0.0, pose);

      expect(result).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });
  });

  describe('7. 1회 단일 확정 (Idempotent Trigger)', () => {
    it('한 번 선택이 확정되면 이후 프레임에서 추가 선택 이벤트가 발생하지 않는다', () => {
      const selectSpy = vi.fn();
      selector.addSelectListener(selectSpy);

      const pose = createMockPose({
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
      });

      // Frame 1: 최초 확정
      const res1 = selector.update(0.0, pose);
      expect(res1).not.toBeNull();
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Frame 2: 동일 자세 유지
      const res2 = selector.update(0.1, pose);
      expect(res2).toBeNull();
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Frame 3: 다른 존으로 이동해도 이미 확정 상태이므로 번복/추가 확정 없음
      const poseZone5 = createMockPose({
        rightWrist: { ...ZONE_5_CENTER, visibility: 0.9 },
      });
      const res3 = selector.update(0.2, poseZone5);
      expect(res3).toBeNull();
      expect(selectSpy).toHaveBeenCalledTimes(1);
      expect(selector.confirmedAnswerIndex).toBe(0);
    });

    it('reset() 호출 후에는 새 라운드 답안을 다시 선택할 수 있다', () => {
      const poseZone4 = createMockPose({
        leftWrist: { ...ZONE_4_CENTER, visibility: 0.9 },
      });
      selector.update(0.0, poseZone4);
      expect(selector.isConfirmed).toBe(true);

      // 새 라운드 reset
      selector.reset();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.confirmedAnswerIndex).toBeNull();

      // Zone 5 선택
      const poseZone5 = createMockPose({
        rightWrist: { ...ZONE_5_CENTER, visibility: 0.9 },
      });
      const res = selector.update(1.0, poseZone5);
      expect(res?.answerIndex).toBe(1);
      expect(selector.isConfirmed).toBe(true);
    });
  });

  describe('8. 비상 Fallback (키보드 / 직접 선택)', () => {
    it('selectByFallback(0) 호출 시 0번(Zone 4) 답안이 즉시 확정된다', () => {
      const res = selector.selectByFallback(0, 1.5);
      expect(res?.answerIndex).toBe(0);
      expect(res?.zoneId).toBe(4);
      expect(res?.hand).toBe('fallback');
      expect(res?.source).toBe('keyboard');
      expect(selector.isConfirmed).toBe(true);
    });

    it('selectByFallback(1) 호출 시 1번(Zone 5) 답안이 즉시 확정된다', () => {
      const res = selector.selectByFallback(1, 1.5);
      expect(res?.answerIndex).toBe(1);
      expect(res?.zoneId).toBe(5);
      expect(selector.isConfirmed).toBe(true);
    });

    it('fromKeyboard("1")은 0번, fromKeyboard("2")는 1번을 확정한다', () => {
      const res1 = selector.fromKeyboard('1', 2.0);
      expect(res1?.answerIndex).toBe(0);
      expect(selector.isConfirmed).toBe(true);

      selector.reset();
      const res2 = selector.fromKeyboard('2', 2.5);
      expect(res2?.answerIndex).toBe(1);
      expect(selector.isConfirmed).toBe(true);
    });
  });

  describe('9. 카메라 미러링(isMirrored: true) 지원', () => {
    it('isMirrored가 true일 때 카메라 우측 랜드마크(x > 0.7)가 화면 좌측(Zone 4)으로 변환되어 선택된다', () => {
      const mirroredSelector = new ArmReachAnswerSelector({ isMirrored: true });
      // 카메라 원본에서 사용자의 오른편(x 0.83) -> 미러 변환 시 화면 좌측 1 - 0.83 = 0.17 (Zone 4)
      const pose = createMockPose({
        leftWrist: { x: 0.83, y: 0.32, visibility: 0.9 },
      });

      const res = mirroredSelector.update(0.0, pose);
      expect(res?.answerIndex).toBe(0);
      expect(res?.zoneId).toBe(4);
    });
  });
});
