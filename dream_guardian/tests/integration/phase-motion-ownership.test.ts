import { describe, it, expect, beforeEach } from 'vitest';
import { MotionIntentBus } from '../../src/motion/MotionIntentBus.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { StarCollectionInput } from '../../src/input/StarCollectionInput.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import {
  PHASE_INTENT_OWNERSHIP,
} from '../../config/judgment.config.js';

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

describe('Phase Motion Ownership & MotionIntentBus Integration (Issue #252)', () => {
  let bus: MotionIntentBus;
  let armSelector: ArmReachAnswerSelector;
  let hazardController: PhaseAHazardController;
  let starInput: StarCollectionInput;

  beforeEach(() => {
    bus = new MotionIntentBus();
    armSelector = new ArmReachAnswerSelector({ isMirrored: false });
    hazardController = new PhaseAHazardController({ pattern: ['jump'] });
    starInput = new StarCollectionInput();

    armSelector.attachIntentBus(bus);
    hazardController.attachIntentBus(bus);
    starInput.attachIntentBus(bus);
  });

  // Red 시나리오 1
  it('Scenario 1: 동일 랜드마크 입력에 대해 버스가 발행한 intent 타입·confidence가 결정적(deterministic)이다', () => {
    const prevLm = createMockLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.5 },
      [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.5 },
    });
    const currLm = createMockLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.45 },
      [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.45 },
      [POSE_LANDMARKS.LEFT_WRIST]: { x: 0.22, y: 0.5 },
    });

    const runA = bus.classify(currLm, 0.1, 1.0, { prevLandmarks: prevLm });
    const runB = bus.classify(currLm, 0.1, 1.0, { prevLandmarks: prevLm });

    expect(runA).toEqual(runB);
    expect(runA.length).toBe(2);
    expect(runA.map((i) => i.type).sort()).toEqual(['jump', 'reachLeft'].sort());
    expect(runA[0].confidence).toBe(runB[0].confidence);
  });

  // Red 시나리오 2
  it('Scenario 2: 답안 선택(ANSWER_SELECT) 페이즈에서 점프 intent가 소비자에게 전달되지 않는다', () => {
    bus.setPhase('ANSWER_SELECT');
    armSelector.openWindow();

    expect(armSelector.isConfirmed).toBe(false);

    // 점프 intent 발행 시도
    const published = bus.publish({
      type: 'jump',
      confidence: 0.95,
      timestamp: 1.0,
      sourceCursor: 'body',
    });

    // 버스에서 소유권 없음으로 차단됨
    expect(published).toBe(false);
    // 답안 선택기는 점프에 반응하지 않고 미확정 상태 유지
    expect(armSelector.isConfirmed).toBe(false);
  });

  // Red 시나리오 3
  it('Scenario 3: 장판 회피(HAZARD_EVADE) 페이즈에서 점프 intent가 정상 전달되어 회피로 인정된다', () => {
    bus.setPhase('HAZARD_EVADE');
    hazardController.start({ pattern: 'jump' });

    expect(hazardController.isEvaded).toBe(false);

    // 점프 intent 발행
    const published = bus.publish({
      type: 'jump',
      confidence: 0.95,
      timestamp: 1.0,
      sourceCursor: 'body',
    });

    expect(published).toBe(true);
    // 점프 intent가 전달되어 회피 성공 잠금
    expect(hazardController.isEvaded).toBe(true);
  });

  // Red 시나리오 4
  it('Scenario 4: 답안 선택(ANSWER_SELECT) 페이즈에서 reachLeft/reachRight는 정상 전달되어 답안이 확정된다', () => {
    bus.setPhase('ANSWER_SELECT');
    armSelector.openWindow();

    const published = bus.publish({
      type: 'reachLeft',
      confidence: 0.88,
      timestamp: 1.0,
      sourceCursor: 'left_hand',
      payload: { x: 0.20, y: 0.50 },
    });

    expect(published).toBe(true);
    expect(armSelector.isConfirmed).toBe(true);
    expect(armSelector.confirmedAnswerIndex).toBe(0);
    expect(armSelector.confirmedZoneId).toBe(4);
  });

  // Red 시나리오 5
  it('Scenario 5: 확정 직후 0.20s 시점 intent가 불응기로 차단된다', () => {
    bus.setPhase('ANSWER_SELECT');
    armSelector.openWindow();

    // 1.00s에 답안 확정 -> 불응기 0.25s 발동 (1.25s까지 잠금)
    armSelector.selectByReachIntent(0, 4, {
      type: 'reachLeft',
      confidence: 0.9,
      timestamp: 1.00,
    });
    expect(armSelector.isConfirmed).toBe(true);

    // 확정 직후 0.20s 시점 (1.20s) intent 발행
    const published = bus.publish({
      type: 'reachLeft',
      confidence: 0.9,
      timestamp: 1.20,
    });

    expect(published).toBe(false);
    expect(bus.isRefractoryActive(1.20)).toBe(true);
  });

  // Red 시나리오 6
  it('Scenario 6: 확정 후 0.30s 시점 intent는 정상 소비된다', () => {
    bus.setPhase('ANSWER_SELECT');
    armSelector.openWindow();

    // 1.00s에 확정
    bus.triggerRefractory(1.00);

    // 0.30s 경과 시점 (1.30s > 1.25s)
    expect(bus.isRefractoryActive(1.30)).toBe(false);
    const published = bus.publish({
      type: 'reachLeft',
      confidence: 0.9,
      timestamp: 1.30,
    });

    expect(published).toBe(true);
  });

  // Red 시나리오 7
  it('Scenario 7: 페이즈 전환 시 불응기가 즉시 리셋되어 잔여 락아웃이 해제된다', () => {
    bus.setPhase('ANSWER_SELECT');
    bus.triggerRefractory(1.00);

    // 1.10s 시점에서는 불응기 활성
    expect(bus.isRefractoryActive(1.10)).toBe(true);

    // 페이즈 전환: STAR_COLLECT로 이동
    bus.setPhase('STAR_COLLECT');

    // 페이즈 전환 즉시 불응기 해제 확인
    expect(bus.isRefractoryActive(1.10)).toBe(false);
    const published = bus.publish({
      type: 'reachLeft',
      confidence: 0.9,
      timestamp: 1.10,
    });
    expect(published).toBe(true);
  });

  // Red 시나리오 8
  it('Scenario 8: 버스 미주입(폴백) 시 기존 3개 소비자(선택기, 장판, 별가루)가 100% 정상 동작한다', () => {
    const fallbackSelector = new ArmReachAnswerSelector({ isMirrored: false });
    const fallbackHazard = new PhaseAHazardController({ pattern: ['jump'] });
    const fallbackStar = new StarCollectionInput();

    // 1. 답안 선택기 폴백 동작
    fallbackSelector.openWindow();
    fallbackSelector.selectByFallback(1);
    expect(fallbackSelector.isConfirmed).toBe(true);
    expect(fallbackSelector.confirmedAnswerIndex).toBe(1);

    // 2. 장판 컨트롤러 폴백 동작
    fallbackHazard.start({ pattern: 'jump' });
    fallbackHazard.recordAction('jump');
    expect(fallbackHazard.isEvaded).toBe(true);

    // 3. 별가루 수집기 폴백 동작
    fallbackStar.setTarget({
      patternId: 'p1',
      part: 'leftHand',
      cursorType: 'leftHand',
      zoneId: 4,
      beatIndex: 1,
      landingTime: 2.0,
    });
    const starRes = fallbackStar.fromKeyboard(2.0);
    expect(starRes?.collected).toBe(true);
    expect(starRes?.rating).toBe('Perfect');
  });

  // Red 시나리오 9
  it('Scenario 9: 점프 임계치를 config에서 변경하면 버스 분류 결과가 따라 바뀐다', () => {
    const prevLm = createMockLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.5 },
      [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.5 },
    });
    // 상승 속도: (0.50 - 0.476) / 0.1 = 0.24
    const currLm = createMockLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 0.476 },
      [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 0.476 },
    });

    // 0.22 임계치 버스 -> 0.24 >= 0.22 이므로 점프 감지
    const busStandard = new MotionIntentBus({ jumpVerticalSpeedThreshold: 0.22 });
    const resStandard = busStandard.classify(currLm, 0.1, 1.0, { prevLandmarks: prevLm });
    expect(resStandard.some((i) => i.type === 'jump')).toBe(true);

    // 0.28 임계치 버스 -> 0.24 < 0.28 이므로 점프 감지 안 됨
    const busStrict = new MotionIntentBus({ jumpVerticalSpeedThreshold: 0.28 });
    const resStrict = busStrict.classify(currLm, 0.1, 1.0, { prevLandmarks: prevLm });
    expect(resStrict.some((i) => i.type === 'jump')).toBe(false);
  });

  // Red 시나리오 10
  it('Scenario 10: 소유권 테이블을 config에서 바꾸면 코드 수정 없이 전달 대상이 변경된다', () => {
    // 기본 ANSWER_SELECT는 jump를 소유하지 않음
    const defaultBus = new MotionIntentBus(undefined, 'ANSWER_SELECT');
    expect(defaultBus.publish({ type: 'jump', confidence: 0.9, timestamp: 1.0 })).toBe(false);

    // config에서 ANSWER_SELECT에 jump를 추가한 커스텀 버스
    const customConfigBus = new MotionIntentBus({
      ownership: {
        ...PHASE_INTENT_OWNERSHIP,
        ANSWER_SELECT: ['reachLeft', 'reachRight', 'jump'],
      },
    }, 'ANSWER_SELECT');

    // 코드 변경 없이 설정 주입만으로 jump가 ANSWER_SELECT에서 허용됨
    expect(customConfigBus.publish({ type: 'jump', confidence: 0.9, timestamp: 1.0 })).toBe(true);
  });
});
