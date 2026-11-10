import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssaultGuardAdapter } from '../../src/motion/AssaultGuardAdapter.js';
import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import { XGestureDetector } from '../../src/motion/XGestureDetector.js';
import { AssaultSquatJudge } from '../../src/game/assault/AssaultSquatJudge.js';
import { AssaultExerciseTally } from '../../src/game/assault/AssaultExerciseTally.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';
import type { CalibrationBaseline } from '../../src/motion/CalibrationHelper.js';

describe('[BOSS-ASSAULT-44 / #547] 스쿼트 회피 저충격 대체 동작 어댑터 (AssaultGuardAdapter)', () => {
  let adapter: AssaultGuardAdapter;

  const validBaseline: CalibrationBaseline = {
    noseX: 0.5,
    noseY: 0.2,
    shoulderX: 0.5,
    shoulderY: 0.35,
    shoulderWidth: 0.25,
    hipX: 0.5,
    hipY: 0.6,
  };

  /**
   * MediaPipe 표준 랜드마크 더미 생성 헬퍼
   * - 기본 자세: 양손 차렷 (손목이 골반 아래 y=0.65)
   * - 가드 자세: 양손을 얼굴/가슴 앞 (y=0.25~0.35, 손목 간 거리 좁힘)
   */
  function createMockLandmarks(options?: {
    shoulderWidth?: number;
    shoulderY?: number;
    noseY?: number;
    hipY?: number;
    leftWrist?: { x: number; y: number };
    rightWrist?: { x: number; y: number };
    visibility?: number;
  }): NormalizedLandmark[] {
    const sWidth = options?.shoulderWidth ?? 0.25;
    const sY = options?.shoulderY ?? 0.35;
    const nY = options?.noseY ?? 0.2;
    const hY = options?.hipY ?? 0.6;
    const vis = options?.visibility ?? 0.95;

    const landmarks: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: vis });
    }

    // 코, 어깨, 골반
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: nY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.5 - sWidth / 2, y: sY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.5 + sWidth / 2, y: sY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: hY, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: hY, z: 0, visibility: vis };

    // 손목 (기본: 차렷/이완 자세)
    const lWrist = options?.leftWrist ?? { x: 0.35, y: 0.65 };
    const rWrist = options?.rightWrist ?? { x: 0.65, y: 0.65 };
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: lWrist.x, y: lWrist.y, z: 0, visibility: vis };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: rWrist.x, y: rWrist.y, z: 0, visibility: vis };

    return landmarks;
  }

  /** 가드 자세 랜드마크 생성 (얼굴/가슴 앞, 손목 간격이 어깨너비 * 0.8 이하) */
  function createGuardLandmarks(options?: {
    wristDistRatio?: number;
    wristY?: number;
    visibility?: number;
  }): NormalizedLandmark[] {
    const ratio = options?.wristDistRatio ?? 0.5; // 기본 어깨너비의 50% (< 80%)
    const sWidth = 0.25;
    const wristDist = sWidth * ratio;
    const wristY = options?.wristY ?? 0.30; // 코(0.20)와 어깨(0.35) 사이 얼굴/가슴 높이

    return createMockLandmarks({
      shoulderWidth: sWidth,
      leftWrist: { x: 0.5 - wristDist / 2, y: wristY },
      rightWrist: { x: 0.5 + wristDist / 2, y: wristY },
      visibility: options?.visibility ?? 0.95,
    });
  }

  beforeEach(() => {
    adapter = new AssaultGuardAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. 순수 어댑터 제약 및 기본 설정 검증 ───
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
        const testAdapter = new AssaultGuardAdapter();
        testAdapter.setBaseline(validBaseline);
        testAdapter.update({ timestampMs: 1000, landmarks: createGuardLandmarks() });
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

    it('기본 설정으로 DEFAULT_ASSAULT_INPUT_CONFIG.guardWristDistanceRatio(0.8)을 소비해야 한다', () => {
      expect(adapter.config.guardWristDistanceRatio).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.guardWristDistanceRatio);
      expect(adapter.config.guardWristDistanceRatio).toBe(0.8);
    });

    it('입력 landmarks 원본 배열 및 객체의 불변성을 보장해야 한다', () => {
      adapter.setBaseline(validBaseline);
      const landmarks = createGuardLandmarks();
      const originalCloned = JSON.parse(JSON.stringify(landmarks));
      Object.freeze(landmarks);

      const result = adapter.update({
        timestampMs: 100,
        landmarks,
      });

      expect(result.isValid).toBe(true);
      expect(landmarks).toEqual(originalCloned);
    });

    it('HP 차감이나 공격 성공/실패 정산 권한이 없어야 한다 (순수 모션 어댑터)', () => {
      adapter.setBaseline(validBaseline);
      const result = adapter.update({
        timestampMs: 100,
        landmarks: createGuardLandmarks(),
      });

      expect(result).not.toHaveProperty('hp');
      expect(result).not.toHaveProperty('damage');
      expect(result).not.toHaveProperty('commands');
    });
  });

  // ─── 2. 단위 검증 및 트래킹 유효성 검증 ───
  describe('2. 단위 검증 및 트래킹 유효성 검증', () => {
    it('초기 baseline이 설정되지 않은 경우 isValid=false 및 MISSING_BASELINE을 보고해야 한다', () => {
      const result = adapter.update({
        timestampMs: 100,
        landmarks: createGuardLandmarks(),
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('MISSING_BASELINE');
      expect(result.isGuarding).toBe(false);
      expect(result.isDucking).toBe(false);
    });

    it('현재 랜드마크 좌표가 1.0 초과(픽셀 좌표)인 경우 거부해야 한다 (INVALID_COORDINATE_UNITS)', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks({
          leftWrist: { x: 320, y: 240 },
          rightWrist: { x: 380, y: 240 },
        }),
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('INVALID_COORDINATE_UNITS');
    });

    it('좌표가 음수이거나 NaN인 비정상 단위 혼용을 거부해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const negResult = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks({
          leftWrist: { x: -0.1, y: 0.3 },
        }),
      });
      expect(negResult.isValid).toBe(false);
      expect(negResult.invalidReason).toBe('INVALID_COORDINATE_UNITS');

      const nanResult = adapter.update({
        timestampMs: 100,
        landmarks: createMockLandmarks({
          rightWrist: { x: Number.NaN, y: 0.3 },
        }),
      });
      expect(nanResult.isValid).toBe(false);
      expect(nanResult.invalidReason).toBe('INVALID_COORDINATE_UNITS');
    });

    it('추적 상실 플래그(isTrackingLost=true)가 전달되면 isValid=false 및 TRACKING_LOST를 보고해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createGuardLandmarks(),
        isTrackingLost: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('TRACKING_LOST');
    });

    it('손목/어깨 랜드마크 신뢰도(visibility)가 0.5 미만이면 LOW_CONFIDENCE로 거부해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: createGuardLandmarks({ visibility: 0.3 }),
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('LOW_CONFIDENCE');
    });

    it('랜드마크 배열이 비어있거나 필수 랜드마크가 누락되면 NO_LANDMARKS로 거부해야 한다', () => {
      adapter.setBaseline(validBaseline);

      const result = adapter.update({
        timestampMs: 100,
        landmarks: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('NO_LANDMARKS');
    });
  });

  // ─── 3. DEC-C6 양팔 가드(Dual-Arm Guard) 자세 판정 ───
  describe('3. DEC-C6 양팔 가드(Dual-Arm Guard) 자세 판정', () => {
    beforeEach(() => {
      adapter.setBaseline(validBaseline);
    });

    it('양 손목 간 거리가 어깨너비 * 0.8 이하이고 얼굴/가슴 높이이면 가드 상태로 판정해야 한다', () => {
      // shoulderWidth = 0.25, wristDistRatio = 0.6 (dist = 0.15 <= 0.20)
      const landmarks = createGuardLandmarks({ wristDistRatio: 0.6, wristY: 0.28 });
      const result = adapter.update({ timestampMs: 100, landmarks });

      expect(result.isValid).toBe(true);
      expect(result.isGuarding).toBe(true);
      expect(result.isSafe).toBe(true);
      // #515 AssaultSquatJudge 호환을 위해 isDucking도 true여야 함
      expect(result.isDucking).toBe(true);
      expect(result.isStanding).toBe(false);
      expect(result.posture).toBe('guarding');
    });

    it('양 손목 간 거리가 어깨너비 * 0.8을 초과하면(양팔 벌림) 가드가 아니어야 한다', () => {
      // wristDistRatio = 1.0 (dist = 0.25 > 0.20)
      const landmarks = createGuardLandmarks({ wristDistRatio: 1.0, wristY: 0.30 });
      const result = adapter.update({ timestampMs: 100, landmarks });

      expect(result.isValid).toBe(true);
      expect(result.isGuarding).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.isDucking).toBe(false);
    });

    it('양 손목 거리가 좁더라도 골반/허리 아래로 내려가면 가드가 아니어야 한다', () => {
      // wristY = 0.65 (hipY = 0.60 아래)
      const landmarks = createGuardLandmarks({ wristDistRatio: 0.4, wristY: 0.65 });
      const result = adapter.update({ timestampMs: 100, landmarks });

      expect(result.isValid).toBe(true);
      expect(result.isGuarding).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.isDucking).toBe(false);
    });

    it('양 손목 거리가 좁더라도 머리 위(만세/도약)로 올라가면 가드가 아니어야 한다', () => {
      // wristY = 0.05 (noseY = 0.20보다 훨씬 위)
      const landmarks = createGuardLandmarks({ wristDistRatio: 0.4, wristY: 0.05 });
      const result = adapter.update({ timestampMs: 100, landmarks });

      expect(result.isValid).toBe(true);
      expect(result.isGuarding).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.isDucking).toBe(false);
    });
  });

  // ─── 4. X자 제스처와의 상호 무간섭 (DEC-C6 / A25) ───
  describe('4. X자 제스처(XGestureDetector)와의 상호 무간섭 검증', () => {
    let xDetector: XGestureDetector;

    beforeEach(() => {
      adapter.setBaseline(validBaseline);
      xDetector = new XGestureDetector();
    });

    it('정상 양팔 가드 자세 유지 시 X자 제스처 감지기는 트리거되지 않아야 한다 (간섭 0건)', () => {
      // 가드 자세: 왼손 x=0.45, 오른손 x=0.55 (어깨 왼쪽 0.375, 오른쪽 0.625)
      const guardLandmarks = createGuardLandmarks({ wristDistRatio: 0.4, wristY: 0.30 });

      const guardRes = adapter.update({ timestampMs: 100, landmarks: guardLandmarks });
      const xRes = xDetector.update(guardLandmarks, 0.5);

      expect(guardRes.isGuarding).toBe(true);
      expect(guardRes.isDucking).toBe(true);

      // X자 감지기는 대각 교차 조건을 만족하지 않으므로 미반응이어야 함
      expect(xRes.isCrossing).toBe(false);
      expect(xRes.triggered).toBe(false);
    });

    it('X자 일시정지 제스처(양 어깨로 대각 교차) 발생 시 AssaultGuardAdapter는 가드로 오인식하지 않아야 한다', () => {
      // X자 자세: 왼손목이 오른쪽 어깨로, 오른손목이 왼쪽 어깨로 대각 교차
      const xLandmarks = createMockLandmarks({
        shoulderWidth: 0.25,
        shoulderY: 0.35,
        leftWrist: { x: 0.62, y: 0.35 },  // 오른쪽 어깨 근처
        rightWrist: { x: 0.38, y: 0.35 }, // 왼쪽 어깨 근처
      });

      const xRes = xDetector.update(xLandmarks, 0.5);
      const guardRes = adapter.update({ timestampMs: 100, landmarks: xLandmarks });

      // X자 감지기는 교차 감지
      expect(xRes.isCrossing).toBe(true);

      // 가드 어댑터는 X자 교차를 가드로 판정하지 않아야 함
      expect(guardRes.isGuarding).toBe(false);
      expect(guardRes.isDucking).toBe(false);
    });
  });

  // ─── 5. 직립/이완 복귀 Generation 관리 (Holding 방지, 떨림 방지, 복구 방지) ───
  describe('5. 직립/이완 복귀 Generation 관리 (Holding 방지, 떨림 방지, 복구 방지)', () => {
    beforeEach(() => {
      adapter.setBaseline(validBaseline);
      // 초기 이완 상태
      adapter.update({ timestampMs: 0, landmarks: createMockLandmarks() });
    });

    it('초기 이완 상태에서는 standGeneration이 0이어야 한다', () => {
      expect(adapter.standGeneration).toBe(0);
    });

    it('가드 자세(guarding)로 진입해도 standGeneration은 증가하지 않아야 한다', () => {
      const guardRes = adapter.update({ timestampMs: 100, landmarks: createGuardLandmarks() });
      expect(guardRes.isGuarding).toBe(true);
      expect(adapter.standGeneration).toBe(0);
    });

    it('가드 자세를 장시간 계속 유지(holding)해도 standGeneration은 0이어야 한다', () => {
      for (let t = 100; t <= 1000; t += 50) {
        const res = adapter.update({ timestampMs: t, landmarks: createGuardLandmarks() });
        expect(res.isGuarding).toBe(true);
        expect(adapter.standGeneration).toBe(0);
      }
    });

    it('가드 자세에서 해제(relaxed/standing)로 복귀할 때만 standGeneration이 정확히 1 증가해야 한다', () => {
      // 1) 가드 진입
      adapter.update({ timestampMs: 100, landmarks: createGuardLandmarks() });
      expect(adapter.isGuarding).toBe(true);
      expect(adapter.standGeneration).toBe(0);

      // 2) 가드 해제 (손을 내림)
      const relaxRes = adapter.update({ timestampMs: 200, landmarks: createMockLandmarks() });
      expect(relaxRes.isGuarding).toBe(false);
      expect(relaxRes.isStanding).toBe(true);
      expect(adapter.standGeneration).toBe(1);

      // 3) 이완 상태 지속 유지 시 추가 증가 0회
      adapter.update({ timestampMs: 300, landmarks: createMockLandmarks() });
      adapter.update({ timestampMs: 400, landmarks: createMockLandmarks() });
      expect(adapter.standGeneration).toBe(1);
    });

    it('가드 임계치 경계에서 떨림(transition)이 발생해도 standGeneration이 누적 증가하지 않아야 한다', () => {
      // 1) 가드 진입
      adapter.update({ timestampMs: 100, landmarks: createGuardLandmarks({ wristDistRatio: 0.6 }) });
      expect(adapter.isGuarding).toBe(true);

      // 2) 경계 부근 (ratio 0.85: transition)
      adapter.update({ timestampMs: 150, landmarks: createGuardLandmarks({ wristDistRatio: 0.85 }) });
      adapter.update({ timestampMs: 200, landmarks: createGuardLandmarks({ wristDistRatio: 0.78 }) });
      adapter.update({ timestampMs: 250, landmarks: createGuardLandmarks({ wristDistRatio: 0.86 }) });

      // 완전한 해제가 아니므로 0회 유지
      expect(adapter.standGeneration).toBe(0);

      // 3) 완전히 차렷/이완으로 복귀 시 1회 증가
      adapter.update({ timestampMs: 300, landmarks: createMockLandmarks() });
      expect(adapter.standGeneration).toBe(1);
    });

    it('가드 중 추적 상실(tracking lost) 후 복귀했을 때는 standGeneration이 증가하지 않아야 한다 (복구 오인식 차단)', () => {
      // 1) 가드 진입
      adapter.update({ timestampMs: 100, landmarks: createGuardLandmarks() });
      expect(adapter.isGuarding).toBe(true);

      // 2) 추적 상실
      adapter.update({ timestampMs: 150, landmarks: createGuardLandmarks(), isTrackingLost: true });

      // 3) 카메라 복구 시 차렷 자세로 감지됨
      const recovered = adapter.update({ timestampMs: 200, landmarks: createMockLandmarks() });
      expect(recovered.isValid).toBe(true);
      // 추적 상실에 의해 중단되었으므로 generation 증가 차단
      expect(adapter.standGeneration).toBe(0);
    });
  });

  // ─── 6. #515 AssaultSquatJudge와의 100% 회피 계약 호환성 검증 ───
  describe('6. #515 AssaultSquatJudge와의 100% 회피 계약 호환성 검증', () => {
    let judge: AssaultSquatJudge;

    beforeEach(() => {
      adapter.setBaseline(validBaseline);
      judge = new AssaultSquatJudge({
        sessionId: 'session-01',
        roundId: 'round-01',
        attackId: 'squat-atk-01',
        windowStartMs: 1000,
        arrivalMs: 1500,
      });
    });

    it('AssaultGuardAdapter의 가드 결과를 AssaultSquatJudge에 투입 시 회피 성공(evaded) 판정이 되어야 한다', () => {
      // 판정창 진입 전 이완
      adapter.update({ timestampMs: 800, landmarks: createMockLandmarks() });

      // 판정창 내 가드 수행
      const guardResult = adapter.update({ timestampMs: 1200, landmarks: createGuardLandmarks() });

      // squat_result 액션으로 직접 투입 (#515 계약 호환)
      judge.feed(adapter.toSquatResult(guardResult));

      expect(judge.state.status).toBe('evaded');
      expect(judge.state.resultKind).toBe('evaded');
    });

    it('가드를 풀지 않고 계속 holding한 채로 두 번째 스쿼트 공격을 맞이하면 회피 실패(miss)해야 한다 (A13 Holding 방지)', () => {
      // 첫 번째 공격 회피
      const res1 = adapter.update({ timestampMs: 1200, landmarks: createGuardLandmarks() });
      judge.feed(adapter.toSquatResult(res1));
      expect(judge.state.status).toBe('evaded');

      // 두 번째 공격 시작
      judge.setPlan({
        sessionId: 'session-01',
        roundId: 'round-01',
        attackId: 'squat-atk-02',
        windowStartMs: 2500,
        arrivalMs: 3000,
      });

      // 가드를 풀지 않고 계속 가드 유지
      const res2 = adapter.update({ timestampMs: 2700, landmarks: createGuardLandmarks() });
      judge.feed(adapter.toSquatResult(res2));

      // 직립/이완 복귀가 없었으므로 두 번째 공격 회피 불인정 (status는 아직 pending 또는 arrival 초과 시 miss)
      expect(judge.state.status).toBe('pending');

      // 마감 시각 경과
      judge.tick(3200);
      expect(judge.state.status).toBe('miss');
    });

    it('가드를 풀고(복귀) 다시 가드를 올리면 두 번째 스쿼트 공격도 정상 회피 성공해야 한다', () => {
      // 첫 번째 공격 회피
      const res1 = adapter.update({ timestampMs: 1200, landmarks: createGuardLandmarks() });
      judge.feed(adapter.toSquatResult(res1));
      expect(judge.state.status).toBe('evaded');

      // 가드 해제 (복귀) -> standGeneration 증가
      const relaxRes = adapter.update({ timestampMs: 1800, landmarks: createMockLandmarks() });
      judge.feed(adapter.toSquatResult(relaxRes));

      // 두 번째 공격 시작
      judge.setPlan({
        sessionId: 'session-01',
        roundId: 'round-01',
        attackId: 'squat-atk-02',
        windowStartMs: 2500,
        arrivalMs: 3000,
      });

      // 다시 가드 수행
      const res2 = adapter.update({ timestampMs: 2700, landmarks: createGuardLandmarks() });
      judge.feed(adapter.toSquatResult(res2));

      expect(judge.state.status).toBe('evaded');
    });
  });

  // ─── 7. 접근성 프로필 식별자 보존 및 #546 운동량 집계 분리 (A31) ───
  describe('7. 접근성 프로필 식별자 보존 및 #546 운동량 집계 분리 (A31)', () => {
    beforeEach(() => {
      adapter.setBaseline(validBaseline);
    });

    it('결과에 accessibilityProfileId가 "dual_arm_guard"로 항상 보존되어야 한다', () => {
      const res = adapter.update({ timestampMs: 100, landmarks: createGuardLandmarks() });
      expect(res.accessibilityProfileId).toBe('dual_arm_guard');
    });

    it('AssaultExerciseTally에 대체 동작으로 집계 시 guardCount/alternativeCount만 증가하고 squatCount는 0이어야 한다', () => {
      const tally = new AssaultExerciseTally();
      const res = adapter.update({ timestampMs: 100, landmarks: createGuardLandmarks() });

      // 집계기에 등록
      const recorded = tally.recordGuard({
        inputId: 'guard-test-1',
        kind: res.accessibilityProfileId,
        timestampMs: res.timestampMs,
      });

      expect(recorded).toBe(true);
      const summary = tally.getSummary();
      expect(summary.guardCount).toBe(1);
      expect(summary.alternativeCount).toBe(1);
      expect(summary.squatCount).toBe(0); // A31: 스쿼트와 엄격히 분리
    });
  });

  // ─── 8. 카메라 미지원 환경을 위한 키보드/가상 Fallback 검증 ───
  describe('8. 카메라 미지원 환경을 위한 키보드/가상 Fallback 검증', () => {
    it('isGuarding=true 가상 입력 전달 시 baseline 없이도 즉시 가드 상태로 판정해야 한다', () => {
      const result = adapter.update({
        timestampMs: 100,
        isGuarding: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.isGuarding).toBe(true);
      expect(result.isDucking).toBe(true);
      expect(result.isStanding).toBe(false);
      expect(result.posture).toBe('guarding');
    });

    it('isGuarding=false 가상 입력 전달 시 가드 해제 및 standGeneration이 1 증가해야 한다', () => {
      // 1) 가드 누름
      adapter.update({ timestampMs: 100, isGuarding: true });
      expect(adapter.standGeneration).toBe(0);

      // 2) 가드 뗌
      const relaxResult = adapter.update({ timestampMs: 200, isGuarding: false });
      expect(relaxResult.isGuarding).toBe(false);
      expect(relaxResult.isStanding).toBe(true);
      expect(adapter.standGeneration).toBe(1);

      // 3) 계속 떼고 있음 (추가 증가 0회)
      adapter.update({ timestampMs: 300, isGuarding: false });
      expect(adapter.standGeneration).toBe(1);
    });

    it('fallback 가상 입력에서도 holding 지속 시 standGeneration은 0이어야 한다', () => {
      for (let t = 100; t <= 500; t += 50) {
        const res = adapter.update({ timestampMs: t, isGuarding: true });
        expect(res.isGuarding).toBe(true);
        expect(adapter.standGeneration).toBe(0);
      }
    });
  });
});
