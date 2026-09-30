import { describe, expect, it } from 'vitest';
import { JumpDetector } from '../../src/motion/JumpDetector.js';
import { CalibrationHelper } from '../../src/motion/CalibrationHelper.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

const VH = 1080;

function createBodyLandmarks(shoulderY: number, visibility = 0.95): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility,
  }));
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: shoulderY - 80, z: 0, visibility };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.4, y: shoulderY, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.6, y: shoulderY, z: 0, visibility };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: shoulderY + 250, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: shoulderY + 250, z: 0, visibility };
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.45, y: shoulderY + 450, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.55, y: shoulderY + 450, z: 0, visibility };
  return landmarks;
}

describe('Jump Baseline Contract & Routing (Issue #238 / BUG-JUMP-BASELINE-001)', () => {
  it('Red 1: 키/카메라 거리가 다른 서로 다른 baselineY(400px vs 700px)에서 동일 상대 상승 비율(0.065)로 점프가 감지된다', () => {
    const jd1 = new JumpDetector(0.065, 0.22);
    const jd2 = new JumpDetector(0.065, 0.22);

    const rise = 0.07 * VH; // 75.6px 상승 (> 0.065 * 1080 = 70.2px)

    // 사용자 1: baseline = 400px (키가 크거나 카메라에 가까움)
    const base1 = 400;
    jd1.update(createBodyLandmarks(base1), base1, VH, 0.016, { isCalibrated: true });
    const jumped1 = jd1.update(createBodyLandmarks(base1 - rise), base1, VH, 0.016, { isCalibrated: true });
    expect(jumped1).toBe(true);

    // 사용자 2: baseline = 700px (키가 작거나 카메라에서 멂)
    const base2 = 700;
    jd2.update(createBodyLandmarks(base2), base2, VH, 0.016, { isCalibrated: true });
    const jumped2 = jd2.update(createBodyLandmarks(base2 - rise), base2, VH, 0.016, { isCalibrated: true });
    expect(jumped2).toBe(true);
  });

  it('Red 2: 정지 상태 및 작은 흔들림(노이즈, 20px 상승)에서는 점프가 0회 감지된다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const baseY = 500;

    // 프레임 1: 기준 위치
    jd.update(createBodyLandmarks(baseY), baseY, VH, 0.016, { isCalibrated: true });

    // 프레임 2: 정지 상태
    const still = jd.update(createBodyLandmarks(baseY), baseY, VH, 0.016, { isCalibrated: true });
    expect(still).toBe(false);

    // 프레임 3: 작은 흔들림 (20px 상승, 20 / 1080 = 0.0185 < 0.065)
    const jitter = jd.update(createBodyLandmarks(baseY - 20), baseY, VH, 0.016, { isCalibrated: true });
    expect(jitter).toBe(false);
    expect(jd.jumpCount).toBe(0);
  });

  it('Red 3: 추적 유실 후 재획득(Re-acquisition) 순간 첫 프레임에서 가짜 점프(Fake Jump)가 발생하지 않는다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const baseY = 500;

    // 정상 상태: baseY = 500
    jd.update(createBodyLandmarks(baseY), baseY, VH, 0.016, { isCalibrated: true });

    // 추적 유실 발생 (visibility = 0.1)
    jd.update(createBodyLandmarks(baseY, 0.1), baseY, VH, 0.016, { isCalibrated: true });

    // 재획득 순간: 사용자가 앉았다 일어서서 어깨가 350px(150px 상승 상태)에 위치함
    // 재획득 첫 프레임에서는 속도 스파이크 및 가짜 점프가 차단되어야 함
    const reacquiredJump = jd.update(createBodyLandmarks(350), baseY, VH, 0.016, { isCalibrated: true });
    expect(reacquiredJump).toBe(false);
    expect(jd.jumpCount).toBe(0);

    // 그 다음 프레임에서 실제로 다시 뛰어올라야 점프로 인정
    const realJump = jd.update(createBodyLandmarks(350 - 0.07 * VH), 350, VH, 0.016, { isCalibrated: true });
    expect(realJump).toBe(true);
    expect(jd.jumpCount).toBe(1);
  });

  it('Red 4: 보정 미완료(isCalibrated=false) 또는 baselineY<=0 상태에서는 점프 입력이 완전히 차단된다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const rise = 0.1 * VH;

    // 보정 미완료 플래그 전달 시
    jd.update(createBodyLandmarks(500), 500, VH, 0.016, { isCalibrated: false });
    const uncalibratedJump = jd.update(createBodyLandmarks(500 - rise), 500, VH, 0.016, { isCalibrated: false });
    expect(uncalibratedJump).toBe(false);

    // baselineY = 0 전달 시
    jd.update(createBodyLandmarks(500), 0, VH, 0.016);
    const zeroBaseJump = jd.update(createBodyLandmarks(500 - rise), 0, VH, 0.016);
    expect(zeroBaseJump).toBe(false);
  });

  it('Red 5: 일시정지(isPaused=true) 또는 안전가드(isSafetyGuarded=true) 상태에서는 점프 입력이 완전히 차단된다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const baseY = 500;
    const rise = 0.1 * VH;

    // 일시정지 상태
    jd.update(createBodyLandmarks(baseY), baseY, VH, 0.016, { isCalibrated: true, isPaused: true });
    const pausedJump = jd.update(createBodyLandmarks(baseY - rise), baseY, VH, 0.016, { isCalibrated: true, isPaused: true });
    expect(pausedJump).toBe(false);

    // 안전가드 활성화 상태
    jd.update(createBodyLandmarks(baseY), baseY, VH, 0.016, { isCalibrated: true, isSafetyGuarded: true });
    const guardedJump = jd.update(createBodyLandmarks(baseY - rise), baseY, VH, 0.016, { isCalibrated: true, isSafetyGuarded: true });
    expect(guardedJump).toBe(false);
  });

  it('Red 6: CalibrationHelper -> JumpDetector -> PhaseAHazardController 점프 회피 전체 연결 검증', () => {
    const calHelper = new CalibrationHelper(0.1); // 빠른 0.1초 보정
    const jd = new JumpDetector(0.065, 0.22);
    const hazardController = new PhaseAHazardController({ pattern: ['jump'] });

    // 점프 회피 패턴 활성화
    hazardController.start();
    expect(hazardController.activePattern).toBe('jump');

    const rawY = 480;
    const landmarks = createBodyLandmarks(rawY);

    // 1. 보정 진행 (0.1초)
    calHelper.update(0.05, landmarks);
    expect(calHelper.isDone).toBe(false);

    // 보정 중에는 점프 판정 차단
    const preCalJump = jd.update(landmarks, calHelper.baselineShoulderY, VH, 0.016, {
      isCalibrated: calHelper.isDone,
    });
    expect(preCalJump).toBe(false);

    // 0.06초 추가 경과 -> 보정 완료 (0.11초 >= 0.1초)
    calHelper.update(0.06, landmarks);
    expect(calHelper.isDone).toBe(true);
    expect(calHelper.baselineShoulderY).toBe(rawY);

    // 보정 완료 후 첫 프레임: 사용자 기준선 동기화
    jd.update(landmarks, calHelper.baselineShoulderY, VH, 0.016, {
      isCalibrated: calHelper.isDone,
    });

    // 2. 보정된 baselineShoulderY(480) 기반으로 실제 점프 수행 (480 -> 400, 80px 상승)
    const jumpedLandmarks = createBodyLandmarks(rawY - 80);
    const jumpTriggered = jd.update(jumpedLandmarks, calHelper.baselineShoulderY, VH, 0.016, {
      isCalibrated: calHelper.isDone,
    });
    expect(jumpTriggered).toBe(true);

    // 3. 점프 이벤트 -> 해저드 컨트롤러 전달
    if (jumpTriggered && hazardController.activePattern === 'jump') {
      hazardController.recordAction('jump');
    }

    expect((hazardController as any)._performedAction).toBe('jump');
  });
});
