/**
 * arm-reach-answer-selector.test.ts - 몸 중심 기준 팔 뻗기 방향 답안 선택기 단위 테스트
 *
 * @see Issue #287 [INPUT-ARM-DIRECTION-001]
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

describe('ArmReachAnswerSelector (Issue #287 / INPUT-ARM-DIRECTION-001)', () => {
  let selector: ArmReachAnswerSelector;

  beforeEach(() => {
    selector = new ArmReachAnswerSelector({ isMirrored: false });
  });

  describe('1. 창 개방 시점 측면 정지 손 미선택 (바깥 이동 0.18 미달 차단)', () => {
    it('답안 창이 열릴 때 한 손이 이미 측면(x 0.17)에 정지해 있어도 바깥 이동이 없으면 미선택된다', () => {
      // Frame 1: 답안 창 시작 시점에 이미 x=0.17 위치에 존재
      const pose1 = createMockPose({
        leftWrist: { x: 0.17, y: 0.35, visibility: 0.95 },
      });
      const res1 = selector.update(0.0, pose1);
      expect(res1).toBeNull();
      expect(selector.isConfirmed).toBe(false);

      // Frame 2: 0.1초 후에도 그대로 정지 (바깥 이동 0 < 0.18 * 0.20 = 0.036)
      const res2 = selector.update(0.1, pose1);
      expect(res2).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });

    it('창 개방 후 추가로 바깥 방향으로 0.18*어깨너비 이상 이동하면 정상 확정된다', () => {
      // Frame 1: 시작 시점 손 위치 x=0.25 (기준점)
      const pose1 = createMockPose({
        leftWrist: { x: 0.25, y: 0.35, visibility: 0.95 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 0.1초 후 x=0.17로 바깥 이동 (이동량 = 0.25 - 0.17 = 0.08 >= 0.036)
      // lateral = (0.40 - 0.17) / 0.20 = 1.15 >= 0.55
      // 수평우세: dx = 0.23, dy = 0 -> 0.23 >= 1.6 * 0
      const pose2 = createMockPose({
        leftWrist: { x: 0.17, y: 0.35, visibility: 0.95 },
      });
      const res2 = selector.update(0.1, pose2);

      expect(res2).not.toBeNull();
      expect(res2?.answerIndex).toBe(0);
      expect(res2?.zoneId).toBe(4);
      expect(selector.isConfirmed).toBe(true);
    });
  });

  describe('2. 몸 중심 기준 팔 뻗기 방향 판정 (존 좌표 침투 불필요)', () => {
    it('Zone 4 밖의 높이(y=0.15)여도 왼쪽으로 팔을 뻗으면 0번(좌측 답안)이 확정된다', () => {
      // Frame 1: 몸통 근처 (x 0.38, y 0.15)
      const pose1 = createMockPose({
        leftWrist: { x: 0.38, y: 0.15, visibility: 0.9 },
        leftShoulder: { x: 0.40, y: 0.15, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.15, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 좌측으로 뻗음 (x 0.20, y 0.15)
      // lateral = (0.40 - 0.20) / 0.20 = 1.00 >= 0.55
      // outwardTravel = 0.38 - 0.20 = 0.18 >= 0.036
      const pose2 = createMockPose({
        leftWrist: { x: 0.20, y: 0.15, visibility: 0.9 },
        leftShoulder: { x: 0.40, y: 0.15, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.15, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).not.toBeNull();
      expect(res?.answerIndex).toBe(0);
      expect(res?.zoneId).toBe(4);
      expect(selector.isConfirmed).toBe(true);
    });

    it('Zone 5 밖의 높이(y=0.55)여도 오른쪽으로 팔을 뻗으면 1번(우측 답안)이 확정된다', () => {
      // Frame 1: 몸통 근처 (x 0.62, y 0.55)
      const pose1 = createMockPose({
        rightWrist: { x: 0.62, y: 0.55, visibility: 0.9 },
        leftShoulder: { x: 0.40, y: 0.55, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.55, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 우측으로 뻗음 (x 0.80, y 0.55)
      // lateral = (0.60 - 0.80) / 0.20 = -1.00 <= -0.55
      // outwardTravel = 0.80 - 0.62 = 0.18 >= 0.036
      const pose2 = createMockPose({
        rightWrist: { x: 0.80, y: 0.55, visibility: 0.9 },
        leftShoulder: { x: 0.40, y: 0.55, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.55, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).not.toBeNull();
      expect(res?.answerIndex).toBe(1);
      expect(res?.zoneId).toBe(5);
      expect(selector.isConfirmed).toBe(true);
    });
  });

  describe('3. 존 스침 및 달리기 팔 스윙 차단', () => {
    it('손이 Zone 4 영역을 스쳐도 lateral 임계치(+0.55)에 미달하면 선택되지 않는다', () => {
      // 어깨가 좌측으로 치우쳐 x 0.25일 때 손이 x 0.22(Zone 4 내부)를 지나침
      // lateral = (0.25 - 0.22) / 0.20 = 0.15 < 0.55
      const pose1 = createMockPose({
        leftShoulder: { x: 0.25, y: 0.32, visibility: 0.9 },
        rightShoulder: { x: 0.45, y: 0.32, visibility: 0.9 },
        leftWrist: { x: 0.25, y: 0.32, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        leftShoulder: { x: 0.25, y: 0.32, visibility: 0.9 },
        rightShoulder: { x: 0.45, y: 0.32, visibility: 0.9 },
        leftWrist: { x: 0.22, y: 0.32, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });

    it('달리기 중 팔이 몸통 방향(안쪽)으로 되돌아오는 스윙은 선택되지 않는다', () => {
      // 우측 바깥(0.95)에서 안쪽(0.80)으로 스윙 (outwardTravel < 0)
      const pose1 = createMockPose({
        rightWrist: { x: 0.95, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        rightWrist: { x: 0.80, y: 0.35, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });

    it('짧은 왕복 스윙(바깥 이동 < 0.18*어깨너비)은 선택되지 않는다', () => {
      // shoulderWidth = 0.20, required travel = 0.036
      // 손이 0.40에서 0.38로 0.02만 이동
      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        leftWrist: { x: 0.38, y: 0.35, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });
  });

  describe('4. 수평 우세 검증 (|가로 뻗음| >= 1.6 * |세로 뻗음|)', () => {
    it('수직/대각선 스윙(|가로 뻗음| < 1.6 * |세로 뻗음|)은 미선택된다', () => {
      // leftShoulder: x 0.40, y 0.35
      // 손이 위아래로 크게 흔들림: pos.x = 0.25 (가로 뻗음 = 0.15), pos.y = 0.15 (세로 뻗음 = 0.20)
      // 0.15 < 1.6 * 0.20 = 0.32 -> 수평 우세 실패
      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        leftWrist: { x: 0.25, y: 0.15, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
    });
  });

  describe('5. Strict Mutual Exclusion (양팔 동시 유효 및 반대 방향 차단)', () => {
    it('왼손과 오른손이 동시에 각각 좌/우 방향으로 뻗으면 미선택(null)된다', () => {
      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.9 },
        rightWrist: { x: 0.60, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        leftWrist: { x: 0.20, y: 0.35, visibility: 0.9 },
        rightWrist: { x: 0.80, y: 0.35, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isMutualExclusionBlocked).toBe(true);
    });

    it('점수 우세(dominanceRatio)가 있어도 양팔 동시 통과 시 한쪽을 임의 채택하지 않는다', () => {
      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.95 },
        rightWrist: { x: 0.60, y: 0.35, visibility: 0.95 },
      });
      selector.update(0.0, pose1);

      // 좌측이 더 멀리 뻗었더라도 둘 다 유효하면 차단
      const pose2 = createMockPose({
        leftWrist: { x: 0.10, y: 0.35, visibility: 1.0 },
        rightWrist: { x: 0.75, y: 0.35, visibility: 0.8 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isMutualExclusionBlocked).toBe(true);
    });
  });

  describe('6. 스쿼트 하강(vy > 0) 및 점프 상승(vy < -threshold) 판정 분리', () => {
    it('어깨가 내려가는 스쿼트(vy > 0, bodyVy > 0) 도중 손을 뻗으면 정상 선택된다', () => {
      // Frame 1: 어깨 y 0.30
      const pose1 = createMockPose({
        leftShoulder: { x: 0.40, y: 0.30, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.30, visibility: 0.9 },
        leftWrist: { x: 0.40, y: 0.30, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 0.1초 후 스쿼트로 어깨 y 0.45 로 하강 (bodyVy = (0.45 - 0.30)/0.1 = +1.5 > 0)
      // 동시에 왼손을 좌측으로 뻗음 (x 0.20, y 0.45)
      const pose2 = createMockPose({
        leftShoulder: { x: 0.40, y: 0.45, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.45, visibility: 0.9 },
        leftWrist: { x: 0.20, y: 0.45, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).not.toBeNull();
      expect(res?.answerIndex).toBe(0);
      expect(selector.isConfirmed).toBe(true);
      expect(selector.state.isJumpBlocked).toBe(false);
    });

    it('전신 수직 점프 급상승(bodyVy < -threshold) 시에는 손 뻗기가 차단된다', () => {
      // Frame 1: 어깨 y 0.45
      const pose1 = createMockPose({
        leftShoulder: { x: 0.40, y: 0.45, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.45, visibility: 0.9 },
        leftWrist: { x: 0.40, y: 0.45, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // Frame 2: 0.1초 후 점프로 어깨 y 0.30 로 급상승 (bodyVy = -1.5, upwardSpeed = 1.5 >= 0.22)
      const pose2 = createMockPose({
        leftShoulder: { x: 0.40, y: 0.30, visibility: 0.9 },
        rightShoulder: { x: 0.60, y: 0.30, visibility: 0.9 },
        leftWrist: { x: 0.20, y: 0.30, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).toBeNull();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.state.isJumpBlocked).toBe(true);
    });
  });

  describe('7. 손의 종류(왼손/오른손) 무관성 (Cross-Body 포함)', () => {
    it('오른손으로 왼쪽을 향해 몸을 가로질러 뻗으면 0번(좌측) 답안으로 선택된다', () => {
      const pose1 = createMockPose({
        rightWrist: { x: 0.60, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // 오른손이 왼쪽으로 이동: lateral = (0.60 - 0.20) / 0.20 = 2.0 >= 0.55
      const pose2 = createMockPose({
        rightWrist: { x: 0.20, y: 0.35, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).not.toBeNull();
      expect(res?.answerIndex).toBe(0);
      expect(res?.zoneId).toBe(4);
      expect(res?.hand).toBe('right');
    });

    it('왼손으로 오른쪽을 향해 몸을 가로질러 뻗으면 1번(우측) 답안으로 선택된다', () => {
      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      // 왼손이 오른쪽으로 이동: lateral = (0.40 - 0.80) / 0.20 = -2.0 <= -0.55
      const pose2 = createMockPose({
        leftWrist: { x: 0.80, y: 0.35, visibility: 0.9 },
      });
      const res = selector.update(0.1, pose2);

      expect(res).not.toBeNull();
      expect(res?.answerIndex).toBe(1);
      expect(res?.zoneId).toBe(5);
      expect(res?.hand).toBe('left');
    });
  });

  describe('8. 1회 단일 확정 (Idempotent Trigger) & Reset', () => {
    it('한 번 선택이 확정되면 이후 프레임에서 추가 선택 이벤트가 발생하지 않는다', () => {
      const selectSpy = vi.fn();
      selector.addSelectListener(selectSpy);

      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        leftWrist: { x: 0.20, y: 0.35, visibility: 0.9 },
      });
      const res1 = selector.update(0.1, pose2);
      expect(res1).not.toBeNull();
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Frame 3: 동일 자세 유지 시 추가 발생 없음
      const res2 = selector.update(0.2, pose2);
      expect(res2).toBeNull();
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Frame 4: 반대편으로 뻗어도 번복 없음
      const pose3 = createMockPose({
        rightWrist: { x: 0.85, y: 0.35, visibility: 0.9 },
      });
      const res3 = selector.update(0.3, pose3);
      expect(res3).toBeNull();
      expect(selectSpy).toHaveBeenCalledTimes(1);
      expect(selector.confirmedAnswerIndex).toBe(0);
    });

    it('reset() / openWindow() 호출 후에는 새 기준점으로 다시 선택할 수 있다', () => {
      const pose1 = createMockPose({
        leftWrist: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.0, pose1);

      const pose2 = createMockPose({
        leftWrist: { x: 0.20, y: 0.35, visibility: 0.9 },
      });
      selector.update(0.1, pose2);
      expect(selector.isConfirmed).toBe(true);

      // 새 라운드 창 개방
      selector.openWindow();
      expect(selector.isConfirmed).toBe(false);
      expect(selector.confirmedAnswerIndex).toBeNull();

      // 우측 뻗기
      const pose3 = createMockPose({
        rightWrist: { x: 0.60, y: 0.35, visibility: 0.9 },
      });
      selector.update(1.0, pose3);

      const pose4 = createMockPose({
        rightWrist: { x: 0.80, y: 0.35, visibility: 0.9 },
      });
      const res = selector.update(1.1, pose4);
      expect(res?.answerIndex).toBe(1);
      expect(selector.isConfirmed).toBe(true);
    });
  });

  describe('9. 비상 Fallback (키보드 / 직접 선택)', () => {
    it('selectByFallback(0) 호출 시 0번(Zone 4) 답안이 즉시 확정된다', () => {
      const res = selector.selectByFallback(0, 1.5);
      expect(res?.answerIndex).toBe(0);
      expect(res?.zoneId).toBe(4);
      expect(res?.hand).toBe('fallback');
      expect(res?.source).toBe('keyboard');
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

  describe('10. 카메라 미러링(isMirrored: true) 지원', () => {
    it('isMirrored가 true일 때 카메라 우측 랜드마크가 화면 좌측(0번)으로 변환되어 선택된다', () => {
      const mirroredSelector = new ArmReachAnswerSelector({ isMirrored: true });
      // 카메라 원본에서 손 x=0.60 (미러 후 화면 0.40)
      const pose1 = createMockPose({
        leftWrist: { x: 0.60, y: 0.35, visibility: 0.9 },
        leftShoulder: { x: 0.60, y: 0.35, visibility: 0.9 },
        rightShoulder: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      mirroredSelector.update(0.0, pose1);

      // 카메라 원본에서 손 x=0.80 (미러 후 화면 0.20 -> 화면 좌측으로 뻗음)
      const pose2 = createMockPose({
        leftWrist: { x: 0.80, y: 0.35, visibility: 0.9 },
        leftShoulder: { x: 0.60, y: 0.35, visibility: 0.9 },
        rightShoulder: { x: 0.40, y: 0.35, visibility: 0.9 },
      });
      const res = mirroredSelector.update(0.1, pose2);

      expect(res?.answerIndex).toBe(0);
      expect(res?.zoneId).toBe(4);
      expect(mirroredSelector.isConfirmed).toBe(true);
    });
  });
});
