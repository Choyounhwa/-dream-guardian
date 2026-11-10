import { describe, it, expect, vi } from 'vitest';
import {
  calcStickmanArmReach,
  armPoseFromPoints,
  createStrokeHandMemory,
  evaluateStrokeHand,
  type StickmanArmPose,
  type StrokeHandMemory,
} from '../../src/input/StickmanPunchStroke.js';
import {
  DEFAULT_ASSAULT_INPUT_CONFIG,
  LEGACY_BOX_ASSAULT_INPUT_CONFIG,
} from '../../config/assault-input.config.js';
import { AssaultPunchAdapter } from '../../src/input/AssaultPunchAdapter.js';
import { AssaultInputRouter } from '../../src/core/bootstrap/AssaultInputRouter.js';
import type { PoseFrame } from '../../src/types/pose-frame.js';

describe('FEAT-ASSAULT-PUNCH-002 (#726) 졸라맨 Stroke 펀치 판정', () => {
  const cfg = DEFAULT_ASSAULT_INPUT_CONFIG;

  describe('1. calcStickmanArmReach', () => {
    it('일직선 e = 1.0 (±1e-9), 완전 접힘 e = 10/190, 90도 굽힘 e = hypot(100, 90)/190', () => {
      // 왼팔 일직선 (upperArm: π, forearm: π)
      const straight = calcStickmanArmReach({ upperArm: Math.PI, forearm: Math.PI, confidence: 1 }, cfg);
      expect(straight.extension).toBeCloseTo(1.0, 8);

      // 왼팔 완전 접힘 (upperArm: π, forearm: 0)
      const folded = calcStickmanArmReach({ upperArm: Math.PI, forearm: 0, confidence: 1 }, cfg);
      expect(folded.extension).toBeCloseTo(10 / 190, 8);

      // 왼팔 90도 굽힘 (upperArm: π, forearm: π / 2)
      const rightAngle = calcStickmanArmReach({ upperArm: Math.PI, forearm: Math.PI / 2, confidence: 1 }, cfg);
      expect(rightAngle.extension).toBeCloseTo(Math.hypot(100, 90) / 190, 8);
    });
  });

  describe('2. side 판정', () => {
    it('왼쪽 수평 -> left, 오른쪽 수평 -> right', () => {
      const leftHorizontal = calcStickmanArmReach({ upperArm: Math.PI, forearm: Math.PI, confidence: 1 }, cfg);
      expect(leftHorizontal.side).toBe('left');
      expect(leftHorizontal.vx).toBeLessThan(0);

      const rightHorizontal = calcStickmanArmReach({ upperArm: 0, forearm: 0, confidence: 1 }, cfg);
      expect(rightHorizontal.side).toBe('right');
      expect(rightHorizontal.vx).toBeGreaterThan(0);
    });
  });

  describe('3. directionValid 판정', () => {
    it('수직 위 -> false, 수직 아래 -> false, 대각 위 바깥 -> true', () => {
      // 수직 위 (-π/2, -π/2)
      const up = calcStickmanArmReach({ upperArm: -Math.PI / 2, forearm: -Math.PI / 2, confidence: 1 }, cfg);
      expect(up.directionValid).toBe(false);

      // 수직 아래 (π/2, π/2)
      const down = calcStickmanArmReach({ upperArm: Math.PI / 2, forearm: Math.PI / 2, confidence: 1 }, cfg);
      expect(down.directionValid).toBe(false);

      // 대각 위 바깥 (왼팔 -3π/4, -3π/4)
      const diagUpOut = calcStickmanArmReach({ upperArm: (-3 * Math.PI) / 4, forearm: (-3 * Math.PI) / 4, confidence: 1 }, cfg);
      expect(diagUpOut.directionValid).toBe(true);
    });
  });

  describe('4. armPoseFromPoints', () => {
    it('수평 점 3개 -> 각도 일치, 길이 0 마디 -> confidence 0', () => {
      const shoulder = { x: 0, y: 0 };
      const elbow = { x: 100, y: 0 };
      const wrist = { x: 190, y: 0 };

      const pose = armPoseFromPoints(shoulder, elbow, wrist, 0.95);
      expect(pose.upperArm).toBeCloseTo(0, 5);
      expect(pose.forearm).toBeCloseTo(0, 5);
      expect(pose.confidence).toBe(0.95);

      // 길이 0 마디 (elbow == shoulder)
      const degenerate = armPoseFromPoints(shoulder, shoulder, wrist, 1.0);
      expect(degenerate.confidence).toBe(0);
    });
  });

  describe('5~12. 상태머신 evaluateStrokeHand', () => {
    const leftFoldedPose: StickmanArmPose = { upperArm: Math.PI, forearm: 0, confidence: 1 };
    const leftStraightPose: StickmanArmPose = { upperArm: Math.PI, forearm: Math.PI, confidence: 1 };
    const rightStraightPose: StickmanArmPose = { upperArm: 0, forearm: 0, confidence: 1 };

    it('5. IDLE + 접힘 -> READY', () => {
      const memory = createStrokeHandMemory();
      expect(memory.state).toBe('IDLE');

      const res = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: leftFoldedPose,
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });

      expect(res.memory.state).toBe('READY');
      expect(res.fire).toBe(false);
    });

    it('6. READY + 왼쪽 일직선 -> fire 1회, 상태 EXTENDED', () => {
      const memory = { ...createStrokeHandMemory(), state: 'READY' as const };
      const res = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: leftStraightPose,
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });

      expect(res.fire).toBe(true);
      expect(res.memory.state).toBe('EXTENDED');
    });

    it('7. EXTENDED 유지 10프레임 -> fire 0회', () => {
      let memory: StrokeHandMemory = { ...createStrokeHandMemory(), state: 'EXTENDED' };
      for (let i = 0; i < 10; i++) {
        const res = evaluateStrokeHand({
          memory,
          hand: 'left',
          pose: leftStraightPose,
          timestampMs: 100 + i * 16,
          justRecovered: false,
          cfg,
        });
        expect(res.fire).toBe(false);
        expect(res.memory.state).toBe('EXTENDED');
        memory = res.memory;
      }
    });

    it('8. EXTENDED -> e = 0.70(히스테리시스) -> 상태 유지 -> 다시 1.0 -> fire 0회', () => {
      const memory = { ...createStrokeHandMemory(), state: 'EXTENDED' as const };
      // 90도 굽힘 e ≈ 0.708 (0.65 < e < 0.80)
      const hysteresisPose: StickmanArmPose = { upperArm: Math.PI, forearm: Math.PI / 2, confidence: 1 };

      const res1 = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: hysteresisPose,
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });
      expect(res1.memory.state).toBe('EXTENDED');
      expect(res1.fire).toBe(false);

      const res2 = evaluateStrokeHand({
        memory: res1.memory,
        hand: 'left',
        pose: leftStraightPose,
        timestampMs: 116,
        justRecovered: false,
        cfg,
      });
      expect(res2.memory.state).toBe('EXTENDED');
      expect(res2.fire).toBe(false);
    });

    it('9. EXTENDED -> 접힘(<= 0.65) -> READY -> 일직선 -> fire 1회', () => {
      const memory = { ...createStrokeHandMemory(), state: 'EXTENDED' as const };
      const res1 = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: leftFoldedPose,
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });
      expect(res1.memory.state).toBe('READY');
      expect(res1.fire).toBe(false);

      const res2 = evaluateStrokeHand({
        memory: res1.memory,
        hand: 'left',
        pose: leftStraightPose,
        timestampMs: 116,
        justRecovered: false,
        cfg,
      });
      expect(res2.memory.state).toBe('EXTENDED');
      expect(res2.fire).toBe(true);
    });

    it('10. IDLE + 첫 프레임 일직선 -> fire 0회, 상태 EXTENDED', () => {
      const memory = createStrokeHandMemory();
      const res = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: leftStraightPose,
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });
      expect(res.fire).toBe(false);
      expect(res.memory.state).toBe('EXTENDED');
    });

    it('11. 교차: 왼손 + 오른쪽 일직선 -> fire 0회, EXTENDED', () => {
      const memory = { ...createStrokeHandMemory(), state: 'READY' as const };
      const res = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: rightStraightPose, // 오른쪽으로 뻗음
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });
      expect(res.fire).toBe(false);
      expect(res.memory.state).toBe('EXTENDED');
    });

    it('12. confidence 0.3 -> memory 불변, fire 0회', () => {
      const memory = { ...createStrokeHandMemory(), state: 'READY' as const };
      const lowConfidencePose: StickmanArmPose = { upperArm: Math.PI, forearm: Math.PI, confidence: 0.3 };
      const res = evaluateStrokeHand({
        memory,
        hand: 'left',
        pose: lowConfidencePose,
        timestampMs: 100,
        justRecovered: false,
        cfg,
      });
      expect(res.memory).toBe(memory);
      expect(res.fire).toBe(false);
      expect(res.holdReached).toBe(false);
    });
  });

  describe('13~14. hold 판정', () => {
    const leftStraightPose: StickmanArmPose = { upperArm: Math.PI, forearm: Math.PI, confidence: 1 };

    it('13. hold: IDLE 첫 프레임부터 왼쪽 일직선 고정, 16.7ms 간격 30프레임 -> 24번째 프레임까지 holdReached 0회, 25번째 프레임(400.8ms) 1회, 총 1회', () => {
      let memory = createStrokeHandMemory();
      let totalHoldReached = 0;
      let frame24HoldReached = false;
      let frame25HoldReached = false;

      for (let frame = 1; frame <= 30; frame++) {
        const timestampMs = (frame - 1) * 16.7;
        const res = evaluateStrokeHand({
          memory,
          hand: 'left',
          pose: leftStraightPose,
          timestampMs,
          justRecovered: false,
          cfg,
        });
        memory = res.memory;
        if (res.holdReached) {
          totalHoldReached++;
        }
        if (frame === 24) {
          frame24HoldReached = res.holdReached;
        }
        if (frame === 25) {
          frame25HoldReached = res.holdReached;
        }
      }

      expect(frame24HoldReached).toBe(false);
      expect(frame25HoldReached).toBe(true);
      expect(totalHoldReached).toBe(1);
    });

    it('14. hold: 프레임마다 e가 0.85 ↔ 1.0 왕복(속도 큼) -> holdReached 0회', () => {
      let memory = createStrokeHandMemory();
      let totalHoldReached = 0;

      // 0.85 신전 자세 (upperArm: π, forearm 계산 대신 직접 각도)
      // STICKMAN_CONFIG limbLengths: 100, 90. total 190.
      // len = 0.85 * 190 = 161.5. cos(theta) = (100^2 + 90^2 - 161.5^2) / (2 * 100 * 90)
      const cosAngle = (100 * 100 + 90 * 90 - 161.5 * 161.5) / (2 * 100 * 90);
      const elbowInterior = Math.acos(cosAngle);
      const pose085: StickmanArmPose = { upperArm: Math.PI, forearm: Math.PI - elbowInterior, confidence: 1 };
      const pose100: StickmanArmPose = { upperArm: Math.PI, forearm: Math.PI, confidence: 1 };

      for (let frame = 1; frame <= 40; frame++) {
        const timestampMs = (frame - 1) * 16.7;
        const pose = frame % 2 === 0 ? pose085 : pose100;
        const res = evaluateStrokeHand({
          memory,
          hand: 'left',
          pose,
          timestampMs,
          justRecovered: false,
          cfg,
        });
        memory = res.memory;
        if (res.holdReached) {
          totalHoldReached++;
        }
      }

      expect(totalHoldReached).toBe(0);
    });
  });

  describe('15~17. Adapter 통합 검증', () => {
    it('15. Adapter: poseFrame(boneAngles + armConfidence) 입력으로 이벤트 발화, onPreExtendedHold 리스너 1회 호출', () => {
      const adapter = new AssaultPunchAdapter();
      const holdEvents: any[] = [];
      const punchEventsList: any[] = [];
      adapter.onPreExtendedHold((e) => holdEvents.push(e));
      adapter.onPunch((e) => punchEventsList.push(e));

      // 1) 팔을 접어서 READY 상태로 만든다 (오른팔도 접힌 상태)
      adapter.update({
        timestampMs: 0,
        poseFrame: {
          timestampMs: 0,
          boneAngles: {
            leftUpperArm: Math.PI,
            leftForearm: 0,
            rightUpperArm: 0,
            rightForearm: Math.PI,
          },
          armConfidence: { left: 1, right: 1 },
          hasPose: true,
        } as unknown as PoseFrame,
      });

      // 2) 왼팔을 일직선으로 뻗어 발화 확인 (오른팔은 접힘 유지)
      const punches = adapter.update({
        timestampMs: 50,
        poseFrame: {
          timestampMs: 50,
          boneAngles: {
            leftUpperArm: Math.PI,
            leftForearm: Math.PI,
            rightUpperArm: 0,
            rightForearm: Math.PI,
          },
          armConfidence: { left: 1, right: 1 },
          hasPose: true,
        } as unknown as PoseFrame,
      });

      expect(punches.length).toBe(1);
      expect(punches[0].hand).toBe('left');
      expect(punches[0].reachRatio).toBeCloseTo(1.0, 5);

      // 3) 뻗은 채로 400ms 이상 고정 유지 시 onPreExtendedHold 1회 통지 확인
      for (let t = 67; t <= 550; t += 17) {
        adapter.update({
          timestampMs: t,
          poseFrame: {
            timestampMs: t,
            boneAngles: {
              leftUpperArm: Math.PI,
              leftForearm: Math.PI,
              rightUpperArm: 0,
              rightForearm: Math.PI,
            },
            armConfidence: { left: 1, right: 1 },
            hasPose: true,
          } as unknown as PoseFrame,
        });
      }

      expect(holdEvents.length).toBe(1);
      expect(holdEvents[0].hand).toBe('left');
      expect(holdEvents[0].side).toBe('left');
    });

    it('16. Adapter: poseFrame 없이 leftHand 좌표 입력으로 동일 판정 (Fallback)', () => {
      const adapter = new AssaultPunchAdapter();

      // 접힘 -> READY
      adapter.update({
        timestampMs: 0,
        leftHand: {
          shoulder: { x: 0.5, y: 0.5 },
          elbow: { x: 0.4, y: 0.5 },
          wrist: { x: 0.49, y: 0.5 }, // 접힘
        },
      });

      // 왼쪽 수평으로 뻗음 -> fire
      const punches = adapter.update({
        timestampMs: 50,
        leftHand: {
          shoulder: { x: 0.5, y: 0.5 },
          elbow: { x: 0.35, y: 0.5 },
          wrist: { x: 0.2, y: 0.5 }, // 일직선 왼쪽
        },
      });

      expect(punches.length).toBe(1);
      expect(punches[0].hand).toBe('left');
      expect(punches[0].reachRatio).toBeCloseTo(1.0, 5);
    });

    it('17. Adapter: LEGACY_BOX_ASSAULT_INPUT_CONFIG 주입 시 punchDetectionMode === legacy_box', () => {
      const adapter = new AssaultPunchAdapter(LEGACY_BOX_ASSAULT_INPUT_CONFIG);
      expect((adapter as any)._config.punchDetectionMode).toBe('legacy_box');
    });
  });

  describe('18. Router getPoseFrame 연동 검증', () => {
    const validLandmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
    }));

    it('Router: getPoseFrame 제공 시 punchAdapter.update가 poseFrame 포함 payload로 호출됨', () => {
      const mockPoseFrame = { timestampMs: 123, boneAngles: {}, hasPose: true } as unknown as PoseFrame;
      const getPoseFrame = vi.fn().mockReturnValue(mockPoseFrame);
      const updateSpy = vi.fn().mockReturnValue([]);

      const mockPunchAdapter = {
        update: updateSpy,
        onPunch: vi.fn(),
      } as unknown as AssaultPunchAdapter;

      const router = new AssaultInputRouter({
        getClock: () => null,
        getActiveRound: () => null,
        getAdapters: () => ({
          punchAdapter: mockPunchAdapter,
          squatAdapter: { update: vi.fn(), onSquat: vi.fn() } as any,
          guardAdapter: { update: vi.fn(), onGuard: vi.fn() } as any,
          fallbackAdapter: { onFallback: vi.fn() } as any,
        }),
        getPoseFrame,
      });

      router.handlePose([], validLandmarks, 123);

      expect(getPoseFrame).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestampMs: expect.any(Number),
          poseFrame: mockPoseFrame,
        })
      );
    });

    it('Router: getPoseFrame 미제공 시 poseFrame 키가 payload에 존재하지 않음', () => {
      const updateSpy = vi.fn().mockReturnValue([]);

      const mockPunchAdapter = {
        update: updateSpy,
        onPunch: vi.fn(),
      } as unknown as AssaultPunchAdapter;

      const router = new AssaultInputRouter({
        getClock: () => null,
        getActiveRound: () => null,
        getAdapters: () => ({
          punchAdapter: mockPunchAdapter,
          squatAdapter: { update: vi.fn(), onSquat: vi.fn() } as any,
          guardAdapter: { update: vi.fn(), onGuard: vi.fn() } as any,
          fallbackAdapter: { onFallback: vi.fn() } as any,
        }),
      });

      router.handlePose([], validLandmarks, 123);

      expect(updateSpy).toHaveBeenCalled();
      const callArg = updateSpy.mock.calls[0][0];
      expect('poseFrame' in callArg).toBe(false);
    });
  });
});
