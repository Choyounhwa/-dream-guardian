import { describe, it, expect, beforeEach } from 'vitest';
import { XGestureDetector } from '../../src/motion/XGestureDetector.js';
import { MenuInput } from '../../src/input/MenuInput.js';
import { AnswerSelector } from '../../src/input/AnswerSelector.js';
import { ArmCrossDetector } from '../../src/motion/ArmCrossDetector.js';
import { RunDetector } from '../../src/motion/RunDetector.js';
import { SquatDetector } from '../../src/motion/SquatDetector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

function createDummyLandmarks(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
  }
  return landmarks;
}

describe('X-Gesture 타 시스템 상호작용 및 무충돌 정합성 검증', () => {
  let xDetector: XGestureDetector;
  let menuInput: MenuInput;
  let armCrossDetector: ArmCrossDetector;
  let runDetector: RunDetector;
  let squatDetector: SquatDetector;
  let answerSelector: AnswerSelector;
  let landmarks: NormalizedLandmark[];

  beforeEach(() => {
    xDetector = new XGestureDetector();
    menuInput = new MenuInput();
    armCrossDetector = new ArmCrossDetector();
    runDetector = new RunDetector();
    squatDetector = new SquatDetector();
    answerSelector = new AnswerSelector();
    landmarks = createDummyLandmarks();

    // 기본 어깨 너비 0.20 (Left: 0.40, Right: 0.60, Y: 0.30)
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.30, z: 0, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.30, z: 0, visibility: 0.95 };
  });

  describe('1. 양손 합장 제스처 (MenuInput) 와의 상호 배타성 검증', () => {
    it('순수 합장 자세(양손 중앙 모음) 시 MenuInput만 active되고 X자 감지는 0%이다', () => {
      // 가슴 중앙에 손바닥 모으기
      const leftWrist = { x: 0.48, y: 0.45 };
      const rightWrist = { x: 0.52, y: 0.45 };
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { ...leftWrist, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { ...rightWrist, z: 0, visibility: 0.95 };

      const menuRes = menuInput.update(leftWrist.x, leftWrist.y, rightWrist.x, rightWrist.y);
      const xRes = xDetector.update(landmarks, 0.4);

      expect(menuRes.active).toBe(true);
      expect(xRes.isCrossing).toBe(false);
      expect(xRes.progress).toBe(0);
      expect(xRes.triggered).toBe(false);
    });

    it('X자 교차 자세를 취할 때는 X자 감지만 트리거되고, MenuInput 활성화 여부와 무관하게 충돌하지 않는다', () => {
      // 대각선 어깨에 손 올리기
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

      const xRes = xDetector.update(landmarks, 0.4);
      expect(xRes.isCrossing).toBe(true);
      expect(xRes.triggered).toBe(true);
    });
  });

  describe('2. 피트니스 답안 선택 (AnswerSelector) 시스템과의 간섭 방지 검증', () => {
    it('X자 제스처 트리거 시 answerSelector.paused=true로 즉시 동결되어 오답/정답 처리가 차단된다', () => {
      // Tier 1 문제 시작
      answerSelector.startQuestion(1);
      expect(answerSelector.paused).toBe(false);

      // X자 자세 입력
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: 0.31, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: 0.31, z: 0, visibility: 0.95 };

      const xRes = xDetector.update(landmarks, 0.4);
      expect(xRes.triggered).toBe(true);

      // main.ts의 연동 로직: 일시정지 상태 적용
      answerSelector.paused = true;

      // 랜드마크가 특정 존에 우연히 걸쳐있더라도 paused 상태면 업데이트가 무시됨
      const confirmed = answerSelector.updateFromPose(landmarks, undefined, 0.1, false);
      expect(confirmed).toBeNull();
      expect(answerSelector.choiceProgress[0]).toBe(0);
      expect(answerSelector.choiceProgress[1]).toBe(0);
    });
  });

  describe('3. 달리기 및 이동 감지기 (LocomotionDetectors) 와의 간섭 검증', () => {
    it('양손 상하 교차 달리기(ArmCrossDetector) 중에는 X자 제스처가 트리거되지 않는다', () => {
      // ArmCross 달리기: 한 손은 위(y: 0.25), 한 손은 아래(y: 0.55)로 교차 반복
      // 왼손목 (0.35, 0.25) -> 오른어깨 (0.60, 0.30) 거리: sqrt(0.25^2 + 0.05^2) = 0.255 (> 0.11)
      // 오른손목 (0.65, 0.55) -> 왼어깨 (0.40, 0.30) 거리: sqrt(0.25^2 + 0.25^2) = 0.353 (> 0.11)
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.35, y: 0.25, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.65, y: 0.55, z: 0, visibility: 0.95 };

      const armStep = armCrossDetector.update(landmarks, 0.3, 1.0);
      const xRes = xDetector.update(landmarks, 0.4);

      expect(armStep).toBe(false);
      expect(xRes.isCrossing).toBe(false);
      expect(xRes.triggered).toBe(false);
    });

    it('제자리 달리기 바운스 중에는 X자 제스처가 트리거되지 않는다', () => {
      // 달리기 중: 양손은 허리춤(y: 0.50~0.60)에서 상하로 흔들림
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.55, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.70, y: 0.55, z: 0, visibility: 0.95 };

      const stepped = runDetector.update(landmarks, 0.30, 1.0);
      const xRes = xDetector.update(landmarks, 0.4);

      expect(stepped).toBe(false);
      expect(xRes.isCrossing).toBe(false);
      expect(xRes.triggered).toBe(false);
    });
  });

  describe('4. 스쿼트(Squat) 및 점프(Jump) 방어/도약 동작과의 간섭 검증', () => {
    it('스쿼트 동작 중(어깨 하강) 양팔을 앞으로 뻗거나 내리고 있으면 X자가 발생하지 않는다', () => {
      // 스쿼트: 어깨 하강 (baselineY: 0.30 대비 drop: 0.12 > 0.065)
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.42, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.42, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.35, y: 0.60, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.65, y: 0.60, z: 0, visibility: 0.95 };

      const isSquatStarted = squatDetector.update(landmarks, 0.30, 1.0);
      const xRes = xDetector.update(landmarks, 0.4);

      expect(squatDetector.isSquatting).toBe(true);
      expect(isSquatStarted).toBe(true);
      expect(xRes.isCrossing).toBe(false);
      expect(xRes.triggered).toBe(false);
    });

    it('점프 동작 중(어깨 상승) 양손을 위로 들고 있으면 X자가 발생하지 않는다', () => {
      // 점프 만세: 어깨 상승 (Y: 0.20), 손목 상단 (Y: 0.05)
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.20, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.20, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.05, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.70, y: 0.05, z: 0, visibility: 0.95 };

      const xRes = xDetector.update(landmarks, 0.4);
      expect(xRes.isCrossing).toBe(false);
      expect(xRes.triggered).toBe(false);
    });
  });
});
