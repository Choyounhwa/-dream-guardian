import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssaultPunchAdapter } from '../../src/input/AssaultPunchAdapter.js';
import { AssaultInputRouter } from '../../src/core/bootstrap/AssaultInputRouter.js';
import {
  DEFAULT_ASSAULT_INPUT_CONFIG,
  LEGACY_BOX_ASSAULT_INPUT_CONFIG,
} from '../../config/assault-input.config.js';
import { type NormalizedLandmark } from '../../src/types/index.js';

describe('[#722 / BUG-ASSAULT-PUNCH-001] 가슴 대기 자세 기반 펀치 인식 및 needsMotionReprep 영구 락 해제', () => {
  const createBaseLandmarks = (): NormalizedLandmark[] =>
    Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
    }));

  describe('1. needsMotionReprep 자동 락 해제 (AssaultInputRouter)', () => {
    it('clock.needsMotionReprep = true 상태에서 정상 포즈(추적 정상, unfreeze) 수신 시 acknowledgeResume()를 호출하여 자동 락을 해제하고 펀치를 전달해야 한다', () => {
      let needsMotionReprep = true;
      let isFrozen = false;
      const acknowledgeResume = vi.fn(() => {
        needsMotionReprep = false;
        return {
          resumed: true,
          wasPausedDuringAttack: false,
          needsMotionReprep: false,
          resumeReadyBeats: 0,
        };
      });

      const mockClock = {
        activeSeconds: 2.0,
        get needsMotionReprep() {
          return needsMotionReprep;
        },
        get isFrozen() {
          return isFrozen;
        },
        isFallbackMode: false,
        acknowledgeResume,
        setTrackingLost: vi.fn(),
        normalizeInput: vi.fn(() => ({ accepted: true, inputId: 'inp-1', activeTimestampSeconds: 2.0 })),
      };

      const mockPunchAdapter = {
        update: vi.fn(() => [
          {
            inputId: 'punch-left-1',
            hand: 'left' as const,
            targetSide: 'left' as const,
            rawTimestampMs: 1000,
            compensatedTimestampMs: 870,
            reachRatio: 1.1,
            elbowAngleDeg: 150,
            wristPoint: { x: 0.25, y: 0.25 },
            targetBox: DEFAULT_ASSAULT_INPUT_CONFIG.targetBoxes.left,
          },
        ]),
      };

      const submitPunch = vi.fn();
      const mockActiveRound = {
        roundId: 'round-1',
        isCompleted: false,
        isPaused: false,
        currentLoopSegment: { kind: 'answer_beat' },
        pause: vi.fn(),
        resume: vi.fn(),
        submitPunch,
        submitSquat: vi.fn(),
      };

      const router = new AssaultInputRouter({
        getClock: () => mockClock as any,
        getAdapters: () => ({ punchAdapter: mockPunchAdapter as any }),
        getActiveRound: () => mockActiveRound as any,
      });

      const landmarks = createBaseLandmarks();
      // 정상 포즈 입력 전달 (sourceLandmarks, normalizedLandmarks)
      router.handlePose(landmarks, landmarks);

      // acknowledgeResume가 즉시 호출되어 락이 풀리고, punchAdapter.update 및 submitPunch가 수행되어야 함
      expect(acknowledgeResume).toHaveBeenCalledTimes(1);
      expect(mockPunchAdapter.update).toHaveBeenCalledTimes(1);
      expect(submitPunch).toHaveBeenCalledWith('left', expect.any(Number), expect.objectContaining({
        inputId: 'punch-left-1',
      }));
    });
  });

  describe('2. punchReachRatio 및 elbowExtensionAngleDeg 임계치 현실화', () => {
    it('기본 punchReachRatio는 1.00이고 elbowExtensionAngleDeg는 135도여야 한다', () => {
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio).toBe(1.00);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.elbowExtensionAngleDeg).toBe(135);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio).toBeGreaterThan(
        DEFAULT_ASSAULT_INPUT_CONFIG.punchRetractRatio,
      );
    });
  });

  describe('3. 가슴 대기 자세(Chest Guard)에서 타깃 박스 신전 시 1회 발화 및 회수 후 재신전', () => {
    let adapter: AssaultPunchAdapter;

    beforeEach(() => {
      adapter = new AssaultPunchAdapter(LEGACY_BOX_ASSAULT_INPUT_CONFIG);
    });

    it('손목이 타깃 박스 하단 바깥(가슴 대기 자세: wrist.y > targetBox.yMax)에 위치할 때 reachRatio > 0.85여도 READY 상태로 전이되어야 한다', () => {
      // shoulderWidth = 0.20
      // 가슴 앞 대기: wrist { x: 0.35, y: 0.55 }, shoulder { x: 0.35, y: 0.35 }
      // dist = 0.20 -> reachRatio = 1.00 (> punchRetractRatio 0.85)
      // targetBox.yMax = 0.48 이므로 wrist.y(0.55) > targetBox.yMax(0.48)로 타깃 박스 하단 바깥 회수 인정
      adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.35, y: 0.55 },
          shoulder: { x: 0.35, y: 0.35 },
          elbow: { x: 0.35, y: 0.45 },
        },
      });

      expect(adapter.getState('left')).toBe('READY');
    });

    it('IDLE 상태에서 곧바로 완전 신전(inTargetBox + reachRatio >= 1.0 + elbowAngle >= 135도)하여 뻗으면 1회 타격 이벤트를 발화해야 한다', () => {
      // IDLE 상태에서 첫 프레임부터 가슴에서 전방 타깃 박스로 펀치를 날린 경우
      const events = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 }, // 왼쪽 타깃 박스 안
          shoulder: { x: 0.35, y: 0.50 }, // dist = hypot(0.10, 0.25) = 0.269, shoulderWidth = 0.20 -> reachRatio = 1.345 >= 1.0
          elbow: { x: 0.30, y: 0.38 }, // elbowAngle ~ 150도 >= 135도
        },
      });

      expect(events).toHaveLength(1);
      expect(events[0].hand).toBe('left');
      expect(adapter.getState('left')).toBe('EXTENDED');
    });

    it('가슴 대기 자세(READY) -> 타깃 박스 신전(EXTENDED, 1회 발화) -> 타깃 박스 체류(0회) -> 가슴 회수(READY) -> 재신전(1회 발화)', () => {
      // 1. 가슴 대기
      adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.35, y: 0.45 },
          shoulder: { x: 0.35, y: 0.50 },
          elbow: { x: 0.35, y: 0.48 },
        },
      });
      expect(adapter.getState('left')).toBe('READY');

      // 2. 타깃 박스 신전 (1회 발화)
      const punch1 = adapter.update({
        timestampMs: 1100,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.50 },
          elbow: { x: 0.30, y: 0.38 },
        },
      });
      expect(punch1).toHaveLength(1);
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 3. 타깃 박스 내부 체류 중 프레임 (중복 발화 0회)
      const punchStay = adapter.update({
        timestampMs: 1200,
        leftHand: {
          wrist: { x: 0.24, y: 0.24 },
          shoulder: { x: 0.35, y: 0.50 },
          elbow: { x: 0.30, y: 0.38 },
        },
      });
      expect(punchStay).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 4. 가슴으로 회수
      const punchRetract = adapter.update({
        timestampMs: 1300,
        leftHand: {
          wrist: { x: 0.35, y: 0.45 },
          shoulder: { x: 0.35, y: 0.50 },
          elbow: { x: 0.35, y: 0.48 },
        },
      });
      expect(punchRetract).toHaveLength(0);
      expect(adapter.getState('left')).toBe('READY');

      // 5. 다시 펀치 신전 (2번째 타격 1회 발화)
      const punch2 = adapter.update({
        timestampMs: 1400,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.50 },
          elbow: { x: 0.30, y: 0.38 },
        },
      });
      expect(punch2).toHaveLength(1);
      expect(adapter.getState('left')).toBe('EXTENDED');
    });
  });
});
