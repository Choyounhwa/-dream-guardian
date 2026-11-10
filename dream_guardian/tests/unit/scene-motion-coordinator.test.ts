/**
 * scene-motion-coordinator.test.ts
 * [REFACTOR-SRP-004 / Issue #635] SceneDirector 모션 인식 파이프라인 및 신체 프레이밍 처리기 분리
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneMotionCoordinator } from '../../src/core/director/SceneMotionCoordinator.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

function createDummyLandmarks(vw = 1080, vh = 2160): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: 0.5 * vw,
      y: 0.5 * vh,
      z: 0,
      visibility: 0.9,
    });
  }
  return landmarks;
}

function createMockContext(overrides: Record<string, any> = {}) {
  const dummyLandmarks = createDummyLandmarks();

  return {
    canvasManager: {
      virtualWidth: 1080,
      virtualHeight: 2160,
    },
    cameraLayer: {
      isActive: false,
      videoElement: null,
    },
    poseManager: {
      hasPose: true,
      virtualLandmarks: dummyLandmarks,
      send: vi.fn().mockResolvedValue(undefined),
    },
    skeletonAnimation: {
      smoothedLandmarks: dummyLandmarks,
      breathScale: 1.0,
      update: vi.fn(),
      reset: vi.fn(),
    },
    stickmanRenderer: {
      update: vi.fn(),
      updateFallback: vi.fn(),
    },
    skeletonEffect: {
      recordJointPositions: vi.fn(),
    },
    cursorTracker: {
      update: vi.fn(),
      getCursor: vi.fn((key: string) => {
        if (key === 'leftHand') return { x: 400, y: 800 };
        if (key === 'rightHand') return { x: 600, y: 800 };
        return null;
      }),
    },
    answerSelector: null,
    xGestureDetector: {
      update: vi.fn().mockReturnValue({ isCrossing: false, triggered: false, progress: 0 }),
      reset: vi.fn(),
      isCrossing: false,
      inCooldown: false,
      progress: 0,
    },
    calibrationHelper: {
      isDone: false,
      baselineShoulderY: 600,
      update: vi.fn(),
    },
    locomotionDetectors: {
      run: { update: vi.fn().mockReturnValue(false), reset: vi.fn() },
    },
    locomotionModal: {
      selectedMode: 'run',
      isOpen: false,
    },
    runDetector: {
      update: vi.fn().mockReturnValue(false),
      reset: vi.fn(),
    },
    jumpDetector: {
      update: vi.fn().mockReturnValue(false),
      reset: vi.fn(),
    },
    motionIntentBus: {
      processLandmarks: vi.fn(),
      reset: vi.fn(),
    },
    menuInput: {
      isActive: false,
      cursorX: 0.5,
      cursorY: 0.5,
      update: vi.fn(),
      reset: vi.fn(),
    },
    kneeFramingValidator: {
      update: vi.fn().mockReturnValue({
        status: 'ready' as const,
        issue: null,
        progress: 1.0,
        isFootKeynotePoseInputAllowed: true,
      }),
    },
    kneeFramingGuideRenderer: {
      update: vi.fn(),
    },
    readyPositionController: {
      setPaused: vi.fn(),
      checkAlignment: vi.fn().mockReturnValue(true),
      setAligned: vi.fn(),
      update: vi.fn(),
    },
    footKeynoteDetector: {
      update: vi.fn().mockReturnValue([]),
    },
    footKeynoteInput: {
      setSafetyGuarded: vi.fn(),
      routeEvent: vi.fn(),
    },
    state: {
      screenMode: 'game' as const,
      menuMode: 'main' as const,
      gamePhase: 'running',
      totalSteps: 0,
      totalJumps: 0,
      menuHoverItem: null,
      menuHoverTimer: 0,
    },
    stateMachine: {
      currentState: 'PLAYING',
    },
    pauseModal: {
      isOpen: false,
      toggle: vi.fn(),
    },
    effectManager: {
      playBurst: vi.fn(),
    },
    beatCoordinator: {
      recordStep: vi.fn(),
    },
    sfx: {
      play: vi.fn(),
    },
    actions: {
      selectSubLevel: vi.fn(),
    },
    engine: {
      elapsedTime: 1.5,
    },
    ...overrides,
  } as any;
}

describe('SceneMotionCoordinator [REFACTOR-SRP-004 / Issue #635]', () => {
  let coordinator: SceneMotionCoordinator;

  beforeEach(() => {
    coordinator = new SceneMotionCoordinator();
  });

  describe('1. 인스턴스 생성 및 기본 상태', () => {
    it('초기 상태가 정상적으로 설정되어 있다', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.currentKneeFraming).toBeNull();
      expect(coordinator.normalizedLandmarks).toBeNull();
      expect(coordinator.sourceLandmarks).toEqual([]);
      expect(coordinator.frameHoverTarget).toBeNull();
    });
  });

  describe('2. process() 포즈 업데이트 및 폴백 (Pose Updates & Fallback)', () => {
    it('카메라 레이어가 활성화되어 있으면 poseManager.send를 호출한다', () => {
      const video = {} as HTMLVideoElement;
      const ctx = createMockContext({
        cameraLayer: { isActive: true, videoElement: video },
      });

      coordinator.process(0.016, ctx);
      expect(ctx.poseManager.send).toHaveBeenCalledWith(video, expect.any(Number));
    });

    it('포즈가 인식되었을 때 skeletonAnimation, stickmanRenderer, skeletonEffect가 갱신된다', () => {
      const ctx = createMockContext();
      coordinator.process(0.016, ctx);

      expect(ctx.skeletonAnimation.update).toHaveBeenCalledWith(0.016, ctx.poseManager.virtualLandmarks);
      expect(ctx.stickmanRenderer.update).toHaveBeenCalled();
      expect(ctx.skeletonEffect.recordJointPositions).toHaveBeenCalled();
      expect(coordinator.sourceLandmarks.length).toBeGreaterThanOrEqual(25);
    });

    it('포즈가 감지되지 않았을 때 폴백 및 초기화 루틴이 수행된다', () => {
      const ctx = createMockContext({
        poseManager: { hasPose: false, virtualLandmarks: [] },
      });

      coordinator.process(0.016, ctx);

      expect(ctx.skeletonAnimation.reset).toHaveBeenCalled();
      expect(ctx.stickmanRenderer.updateFallback).toHaveBeenCalledWith(0.016, true);
      expect(ctx.motionIntentBus.reset).toHaveBeenCalled();
      expect(ctx.menuInput.reset).toHaveBeenCalled();
      expect(ctx.xGestureDetector.reset).toHaveBeenCalled();
      expect(coordinator.sourceLandmarks).toEqual([]);
    });
  });

  describe('3. 랜드마크 정규화 변환 (Landmark Normalization)', () => {
    it('가상 픽셀 좌표 랜드마크를 0~1 정규화 좌표계로 변환하여 보관한다', () => {
      const ctx = createMockContext();
      coordinator.process(0.016, ctx);

      const norm = coordinator.normalizedLandmarks;
      expect(norm).not.toBeNull();
      expect(norm!.length).toBe(33);
      // dummy는 0.5 * vw, 0.5 * vh 이므로 정규화 시 0.5여야 함
      expect(norm![0].x).toBeCloseTo(0.5, 4);
      expect(norm![0].y).toBeCloseTo(0.5, 4);
    });
  });

  describe('4. 무릎 프레이밍 유효성 검사 (Knee Framing Validation)', () => {
    it('kneeFramingValidator.update를 호출하고 상태를 currentKneeFraming에 저장한다', () => {
      const ctx = createMockContext();
      coordinator.process(0.016, ctx);

      expect(ctx.kneeFramingValidator.update).toHaveBeenCalledWith(
        0.016,
        expect.any(Array),
        1080,
        2160,
      );
      expect(coordinator.currentKneeFraming).toEqual(
        expect.objectContaining({ status: 'ready', isFootKeynotePoseInputAllowed: true }),
      );
      expect(ctx.kneeFramingGuideRenderer.update).toHaveBeenCalledWith(0.016);
    });

    it('READY_POSITION 상태일 때 readyPositionController 정렬 및 업데이트를 실행한다', () => {
      const ctx = createMockContext({
        stateMachine: { currentState: 'READY_POSITION' },
      });

      coordinator.process(0.016, ctx);

      expect(ctx.readyPositionController.setPaused).toHaveBeenCalledWith(false);
      expect(ctx.readyPositionController.setAligned).toHaveBeenCalledWith(true);
      expect(ctx.readyPositionController.update).toHaveBeenCalledWith(0.016);
    });
  });

  describe('5. 발 키노트 감지 및 라우팅 (Foot Keynote Detection)', () => {
    it('정규화된 랜드마크를 footKeynoteDetector에 전달하고 이벤트를 라우팅한다', () => {
      const mockEvent = { foot: 'leftFoot', source: 'pose', time: 1.5, zoneId: 9 };
      const ctx = createMockContext({
        footKeynoteDetector: {
          update: vi.fn().mockReturnValue([mockEvent]),
        },
      });

      coordinator.process(0.016, ctx);

      expect(ctx.footKeynoteDetector.update).toHaveBeenCalledWith(
        0.016,
        coordinator.normalizedLandmarks,
        1.5,
        expect.objectContaining({ isPoseInputAllowed: true }),
      );
      expect(ctx.footKeynoteInput.routeEvent).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('6. X 제스처 감지 및 평가 (X-Gesture Evaluation)', () => {
    it('서브메뉴에서 X자 제스처가 트리거되면 이전 메뉴로 뒤로가기 액션을 실행한다', () => {
      const ctx = createMockContext({
        state: { screenMode: 'menu', menuMode: 'sub' },
        xGestureDetector: {
          update: vi.fn().mockReturnValue({ isCrossing: true, triggered: true, progress: 1.0 }),
          reset: vi.fn(),
        },
      });

      coordinator.process(0.016, ctx);

      expect(ctx.actions.selectSubLevel).toHaveBeenCalledWith(-1);
    });

    it('인게임에서 X자 제스처가 트리거되면 일시정지 모달을 토글하고 사운드를 재생한다', () => {
      const ctx = createMockContext({
        state: { screenMode: 'game', menuMode: 'main' },
        xGestureDetector: {
          update: vi.fn().mockReturnValue({ isCrossing: true, triggered: true, progress: 1.0 }),
          reset: vi.fn(),
        },
      });

      coordinator.process(0.016, ctx);

      expect(ctx.pauseModal.toggle).toHaveBeenCalled();
      expect(ctx.sfx.play).toHaveBeenCalledWith('hover');
    });
  });

  describe('7. 커서 상태 및 신체 캘리브레이션 갱신 (Cursor & Calibration)', () => {
    it('cursorTracker를 랜드마크로 갱신하고 frameHoverTarget을 올바르게 계산한다', () => {
      const ctx = createMockContext();
      coordinator.process(0.016, ctx);

      expect(ctx.cursorTracker.update).toHaveBeenCalledWith(
        expect.any(Array),
        undefined,
        false,
        { isVirtual: true, virtualWidth: 1080, virtualHeight: 2160 },
      );
      expect(coordinator.frameHoverTarget).toBeDefined();
    });

    it('신체 캘리브레이션이 완료되지 않았으면 calibrationHelper.update를 호출한다', () => {
      const ctx = createMockContext({
        calibrationHelper: { isDone: false, baselineShoulderY: 600, update: vi.fn() },
      });

      coordinator.process(0.016, ctx);

      expect(ctx.calibrationHelper.update).toHaveBeenCalledWith(0.016, expect.any(Array));
    });

    it('양손 합장 시 menuInput을 갱신하고 frameHoverTarget을 손모으기 커서 위치로 지정한다', () => {
      const ctx = createMockContext({
        menuInput: {
          isActive: true,
          cursorX: 0.45,
          cursorY: 0.55,
          update: vi.fn(),
          reset: vi.fn(),
        },
      });

      coordinator.process(0.016, ctx);

      expect(coordinator.frameHoverTarget).toEqual({
        x: 0.45 * 1080,
        y: 0.55 * 2160,
      });
    });
  });
});
