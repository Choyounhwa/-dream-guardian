import { describe, expect, it } from 'vitest';
import { FootKeynoteDetector } from '../../src/motion/FootKeynoteDetector.js';
import { FootKeynoteInput } from '../../src/input/FootKeynoteInput.js';
import { KneeFramingValidator } from '../../src/motion/KneeFramingValidator.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { toNormalizedLandmarks } from '../../src/utils/index.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import type { FootKeynoteEvent } from '../../src/types/keynote.js';

function createMockKneeLandmarks(leftY = 0.5, rightY = 0.5, visibility = 0.95): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility,
  }));
  // Framing essentials: Nose, shoulders, hips, knees
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.4, y: 0.3, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.6, y: 0.3, z: 0, visibility };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.45, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.45, z: 0, visibility };
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.4, y: leftY, z: 0, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.6, y: rightY, z: 0, visibility };
  return landmarks;
}

describe('Foot Coordinate Contract & Routing (Issue #237 / BUG-MOTION-COORDINATE-001)', () => {
  it('Red 1: 발들기(Knee Lift UP) 동작 시 직접 트리거되며, 무릎 다운(Dip/Squat)은 무시된다', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0 });

    // Baseline: y = 0.5
    detector.update(0.016, createMockKneeLandmarks(0.5, 0.5), 0);

    // 무릎 다운(Dip: 0.50 -> 0.56, 아래로 이동)은 발들기가 아니므로 트리거되지 않아야 함
    const dipEvents = detector.update(0.016, createMockKneeLandmarks(0.56, 0.5), 0.1);
    expect(dipEvents).toEqual([]);

    // 중립 복귀: 0.56 -> 0.50
    detector.update(0.016, createMockKneeLandmarks(0.5, 0.5), 0.2);

    // 실제 발들기(Lift UP: 0.50 -> 0.44, 화면 위로 최소 0.04 이동)는 즉시 트리거되어야 함
    const liftEvents = detector.update(0.016, createMockKneeLandmarks(0.44, 0.5), 0.3);
    expect(liftEvents).toHaveLength(1);
    expect(liftEvents[0]).toMatchObject({
      foot: 'leftFoot',
      zoneId: 9,
      source: 'knee-proxy',
    });
  });

  it('Red 2: 발들기 후 공중에 머물러도 중복 트리거되지 않고, 중립 복귀 후 재무장되어야 연속 입력 가능', () => {
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04, cooldownDuration: 0.2 });

    // Baseline: y = 0.5
    detector.update(0.016, createMockKneeLandmarks(0.5, 0.5), 0);

    // 첫 번째 발들기: 0.5 -> 0.44 (트리거)
    const firstLift = detector.update(0.016, createMockKneeLandmarks(0.44, 0.5), 0.1);
    expect(firstLift).toHaveLength(1);

    // 공중에 계속 유지(0.43, 0.44): 중복 트리거 방지
    const stayUp = detector.update(0.016, createMockKneeLandmarks(0.43, 0.5), 0.2);
    expect(stayUp).toEqual([]);

    // 쿨다운 지났어도 중립에 복귀하지 않으면(0.44) 재무장 불가
    const stillUpAfterCooldown = detector.update(0.016, createMockKneeLandmarks(0.44, 0.5), 0.4);
    expect(stillUpAfterCooldown).toEqual([]);

    // 바닥/중립 복귀: 0.50
    detector.update(0.016, createMockKneeLandmarks(0.5, 0.5), 0.5);

    // 이제 다시 발들기: 0.44 (두 번째 트리거 성공)
    const secondLift = detector.update(0.016, createMockKneeLandmarks(0.44, 0.5), 0.6);
    expect(secondLift).toHaveLength(1);
    expect(secondLift[0].foot).toBe('leftFoot');
  });

  it('Red 3: 픽셀 좌표계 노이즈(0.05px)는 정규화 경계 검증으로 차단되고, 실제 발들기(50px / 1080)만 감지된다', () => {
    const detector = new FootKeynoteDetector({
      movementThreshold: 0.04,
      virtualHeight: 1080,
    });

    const vh = 1080;
    const baseY = 540; // 540 / 1080 = 0.5

    // Baseline: 픽셀 좌표 540
    detector.update(0.016, createMockKneeLandmarks(baseY, baseY), 0, { virtualHeight: vh });

    // 카메라 서브픽셀 노이즈 (540 -> 539.95, delta 0.05px)
    // 과거 픽셀 그대로 넘겼을 때 threshold 0.04를 초과하여 오인식되던 결함 검증
    const noiseEvents = detector.update(0.016, createMockKneeLandmarks(539.95, baseY), 0.1, { virtualHeight: vh });
    expect(noiseEvents).toEqual([]);

    // 실제 발들기: 540 -> 480 (60px 상승, 60/1080 = 0.055 >= 0.04)
    const realLift = detector.update(0.016, createMockKneeLandmarks(480, baseY), 0.2, { virtualHeight: vh });
    expect(realLift).toHaveLength(1);
    expect(realLift[0].foot).toBe('leftFoot');
  });

  it('Red 4: FootKeynoteInput의 onEvent 공통 라우터를 통해 Pose, Keyboard, Virtual Pedal 이벤트가 100% 전달되고 버려지지 않는다', () => {
    const input = new FootKeynoteInput();
    const receivedEvents: FootKeynoteEvent[] = [];

    const unsubscribe = input.onEvent((event) => {
      receivedEvents.push(event);
    });

    // 1. 키보드 입력
    const kbEvent = input.fromKeyboard('leftFoot', 1.0);
    expect(kbEvent).not.toBeNull();

    // 2. 가상 페달 입력 (Zone 11)
    const pedalEvent = input.fromVirtualPedal(11, 2.0);
    expect(pedalEvent).not.toBeNull();

    // 3. Pose 이벤트 라우팅
    const poseEvent: FootKeynoteEvent = {
      foot: 'centerFoot',
      zoneId: 10,
      source: 'knee-proxy',
      timestamp: 3.0,
      confidence: 0.9,
    };
    const routedPose = input.routeEvent(poseEvent);
    expect(routedPose).toEqual(poseEvent);

    // 라우터 수신 이벤트 수 검증 (버려짐 0)
    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[0]).toMatchObject({ foot: 'leftFoot', zoneId: 9, source: 'keyboard' });
    expect(receivedEvents[1]).toMatchObject({ foot: 'rightFoot', zoneId: 11, source: 'virtual' });
    expect(receivedEvents[2]).toMatchObject({ foot: 'centerFoot', zoneId: 10, source: 'knee-proxy' });

    // 리스너 해제 검증
    unsubscribe();
    input.fromKeyboard('leftFoot', 4.0);
    expect(receivedEvents).toHaveLength(3);
  });

  it('Red 5: Safety Guard 및 Pause 활성화 시 모든 발 입력(Pose, Keyboard, Virtual)이 차단된다', () => {
    const input = new FootKeynoteInput();
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04 });
    const received: FootKeynoteEvent[] = [];
    input.onEvent((e) => received.push(e));

    input.setSafetyGuarded(true);
    expect(input.fromKeyboard('leftFoot', 1.0)).toBeNull();
    expect(input.fromVirtualPedal(9, 1.0)).toBeNull();
    expect(input.routeEvent({ foot: 'leftFoot', zoneId: 9, source: 'knee-proxy', timestamp: 1.0, confidence: 1 })).toBeNull();

    detector.update(0.016, createMockKneeLandmarks(0.5, 0.5), 0);
    const guardedPose = detector.update(0.016, createMockKneeLandmarks(0.44, 0.5), 0.1, { isSafetyGuarded: true });
    expect(guardedPose).toEqual([]);
    expect(received).toEqual([]);
  });

  it('Red 6: Cover 투영 -> 무릎 프레이밍 -> 정규화 -> 감지 -> 공통 라우터 -> 해저드 컨트롤러 전체 체인 검증', () => {
    const vw = 1080;
    const vh = 2160;
    const framingValidator = new KneeFramingValidator();
    const detector = new FootKeynoteDetector({ movementThreshold: 0.04 });
    const input = new FootKeynoteInput();
    const hazardController = new PhaseAHazardController();

    // 해저드 패턴: left_step (왼발 피하기) 활성화
    hazardController.start();
    (hazardController as any)._activePattern = 'left_step';
    expect(hazardController.activePattern).toBe('left_step');

    // 공통 라우터 연결: main.ts의 실 라우팅 로직과 동일 계약
    input.onEvent((event) => {
      const target = hazardController.activePattern;
      if (event.foot === 'leftFoot' && (target === 'left_step' || target === 'balance_right')) {
        hazardController.recordAction(target);
      } else if (event.foot === 'rightFoot' && (target === 'right_step' || target === 'balance_left')) {
        hazardController.recordAction(target);
      }
    });

    // 프레이밍 준비 상태 생성 (0.75초 이상 안정화)
    const rawLandmarks = createMockKneeLandmarks(0.5, 0.5);
    // Cover 뷰포트 가상 픽셀 변환 (main.ts의 sourceLandmarks 생성 경로 모사)
    const pixelLandmarks = rawLandmarks.map((lm) => ({
      x: lm.x * vw,
      y: lm.y * vh,
      z: lm.z,
      visibility: lm.visibility,
    }));

    // 프레이밍 평가
    framingValidator.update(0.8, pixelLandmarks, vw, vh);
    expect(framingValidator.isFootKeynotePoseInputAllowed).toBe(true);

    // toNormalizedLandmarks 정규화 (Issue #237 핵심)
    const normalizedLandmarks = toNormalizedLandmarks(pixelLandmarks, vw, vh)!;
    expect(normalizedLandmarks).not.toBeNull();

    // 감지기 초기화 (Baseline)
    detector.update(0.016, normalizedLandmarks, 0, {
      isPoseInputAllowed: framingValidator.isFootKeynotePoseInputAllowed,
    });

    // 왼발 들기 (y: 0.5 -> 0.44 in normalized)
    const liftedPixelLandmarks = pixelLandmarks.map((lm, idx) => {
      if (idx === POSE_LANDMARKS.LEFT_KNEE) {
        return { ...lm, y: 0.44 * vh };
      }
      return lm;
    });
    const liftedNormalized = toNormalizedLandmarks(liftedPixelLandmarks, vw, vh)!;

    const events = detector.update(0.016, liftedNormalized, 0.1, {
      isPoseInputAllowed: framingValidator.isFootKeynotePoseInputAllowed,
    });
    expect(events).toHaveLength(1);

    // 공통 라우터로 전달
    for (const ev of events) {
      input.routeEvent(ev);
    }

    // 해저드 컨트롤러가 왼발 피하기를 성공적으로 기록했는지 검증
    expect((hazardController as any)._performedAction).toBe('left_step');
  });
});
