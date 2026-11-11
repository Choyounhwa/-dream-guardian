import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import { SceneMotionCoordinator } from '../../src/core/director/SceneMotionCoordinator.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { PoseManager } from '../../src/motion/PoseManager.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

describe('[BUG-ASSAULT-002] 접근전 장면 핸들러의 정규화 랜드마크 전달 및 카메라 판정 검증 (#670)', () => {
  let handler: AssaultSceneHandler;
  let mockContext: any;

  beforeEach(() => {
    handler = new AssaultSceneHandler();
    mockContext = {
      canvasManager: {
        virtualWidth: 1920,
        virtualHeight: 1080,
        ctx: {},
      },
      state: {
        screenMode: 'game',
      },
      sessionContext: {
        sessionMode: 'boss_assault',
      },
    };
  });

  describe('1. AssaultSceneHandler.handlePose 정규화 랜드마크 전달', () => {
    it('가상 좌표 랜드마크 전달 시 0~1 정규화된 랜드마크를 두 번째 인자로 전달한다', () => {
      const session = { handlePose: vi.fn() };
      mockContext.assaultSession = session;

      // 가상 해상도 1920x1080 기준 랜드마크
      const virtualLandmarks = [
        { x: 960, y: 540, z: 0, visibility: 0.9 },
        { x: 480, y: 270, z: -0.1, visibility: 0.8 },
      ];

      const handled = handler.handlePose(virtualLandmarks, mockContext, 0.016);
      expect(handled).toBe(true);
      expect(session.handlePose).toHaveBeenCalledTimes(1);

      const [firstArg, secondArg, thirdArg] = session.handlePose.mock.calls[0];
      expect(firstArg).toBe(virtualLandmarks);
      expect(thirdArg).toBe(0.016);

      // 정규화 랜드마크(0~1 범위) 검증 (undefined가 아니어야 함)
      expect(secondArg).toBeDefined();
      expect(Array.isArray(secondArg)).toBe(true);
      expect(secondArg.length).toBe(2);
      expect(secondArg[0].x).toBeCloseTo(960 / 1920, 4); // 0.5
      expect(secondArg[0].y).toBeCloseTo(540 / 1080, 4); // 0.5
      expect(secondArg[1].x).toBeCloseTo(480 / 1920, 4); // 0.25
      expect(secondArg[1].y).toBeCloseTo(270 / 1080, 4); // 0.25
    });

    it('이미 정규화된 0~1 랜드마크 전달 시 그대로 정규화 좌표로 유지된다', () => {
      const session = { handlePose: vi.fn() };
      mockContext.assaultSession = session;

      const normalizedLandmarks = [
        { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
      ];

      handler.handlePose(normalizedLandmarks, mockContext, 0.016);
      const [, secondArg] = session.handlePose.mock.calls[0];
      expect(secondArg).toBeDefined();
      expect(secondArg[0].x).toBeCloseTo(0.3, 4);
      expect(secondArg[0].y).toBeCloseTo(0.4, 4);
    });

    it('명시적 normalizedLandmarks가 인자로 전달되면 우선 사용한다', () => {
      const session = { handlePose: vi.fn() };
      mockContext.assaultSession = session;

      const virtual = [{ x: 960, y: 540, z: 0, visibility: 0.9 }];
      const explicit = [{ x: 0.77, y: 0.88, z: 0, visibility: 0.9 }];

      handler.handlePose(virtual, mockContext, 0.016, explicit);
      const [, secondArg] = session.handlePose.mock.calls[0];
      expect(secondArg).toBe(explicit);
    });
  });

  describe('2. 어설트 세션 WireHelper 및 펀치 어댑터 연동', () => {
    it('handlePose를 통해 펀치 어댑터 update가 프레임당 1회 호출된다', () => {
      const eventBus = new EventBus();
      const battle = new BattleState(100);
      const boss = new BossController(1);
      const stateMachine = new StateMachine('MENU_MAIN');
      const sessionLifecycle = new SessionLifecycle();
      const questionBank = new QuestionBank();
      questionBank.loadRecords([
        {
          id: 'q1',
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈 기초',
          subLevelTitle: '한 자리 덧셈',
          questionText: '1 + 2 = ?',
          choices: [3, 4],
          correctAnswer: 3,
          correctIndex: 0,
          answerEval: '1+2=3',
          difficulty: 'easy',
          questionTemplate: '',
          wrongEval: '',
          varA: '',
          varB: '',
          varC: '',
          varD: '',
          shapeCode: '',
        } as any,
      ]);

      const host: any = {
        eventBus,
        battle,
        boss,
        get bossController() { return boss; },
        speech: { speak: vi.fn(), cancel: vi.fn() },
        stateMachine,
        sessionLifecycle,
        questionBank,
        sessionContext: { setMode: vi.fn(), setActive: vi.fn() },
        motionIntentBus: { setPhase: vi.fn() },
        beatCoordinator: { pause: vi.fn() },
        engine: { pauseGame: vi.fn() },
        mainSceneContext: { state: { screenMode: 'game', isPaused: false } },
        goToMenu: vi.fn(),
        enableAssaultFinale: false,
        currentChapter: 1,
        selectedSubLevel: 1,
      };

      const wireHelper = new AssaultSessionWireHelper(host);
      const assaultSession = wireHelper.assembleAssaultSession();

      const updateSpy = vi.spyOn(assaultSession.punchAdapter, 'update');
      mockContext.assaultSession = assaultSession;

      // 33개 랜드마크 생성 (가상 좌표계 1920x1080)
      const virtualLandmarks = Array.from({ length: 33 }, () => ({
        x: 960,
        y: 540,
        z: 0,
        visibility: 0.9,
      }));

      handler.handlePose(virtualLandmarks, mockContext, 0.016);

      // punchAdapter.update가 1회 호출되어야 함 (이전에는 undefined 전달로 0회 호출되었음)
      expect(updateSpy).toHaveBeenCalledTimes(1);
      const updateArg = updateSpy.mock.calls[0][0];
      expect(updateArg).toBeDefined();
      expect(updateArg?.landmarks).toBeDefined();
      expect(updateArg!.landmarks!.length).toBe(33);
      expect(updateArg!.landmarks![0].x).toBeCloseTo(0.5, 4);
      expect(updateArg!.landmarks![0].y).toBeCloseTo(0.5, 4);
    });
  });

  describe('3. 미러링 1회 적용 원칙 (DOC-14 §8.1)', () => {
    it('PoseManager 미러 설정(mirror: true) 시 정규화 좌표에서 좌우가 이중 반전되지 않는다', () => {
      const session = { handlePose: vi.fn() };
      mockContext.assaultSession = session;

      const poseManager = new PoseManager({
        virtualWidth: 1920,
        virtualHeight: 1080,
        mirror: true,
      });

      // 왼쪽 손목(15번)이 화면 왼쪽(x=0.2)에 있는 raw 랜드마크 주입
      const rawLandmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));
      rawLandmarks[POSE_LANDMARKS.LEFT_WRIST] = {
        x: 0.2, // 카메라 원본에서 0.2
        y: 0.5,
        z: 0,
        visibility: 0.9,
      };

      poseManager.setLandmarks(rawLandmarks);
      mockContext.poseManager = poseManager;

      // PoseManager의 virtualLandmarks: mirror=true 이므로 x = (1 - 0.2) * 1920 = 1536
      const virtualLandmarks = [...poseManager.virtualLandmarks];
      expect(virtualLandmarks[POSE_LANDMARKS.LEFT_WRIST].x).toBeCloseTo(0.8 * 1920, 1);

      handler.handlePose(virtualLandmarks, mockContext, 0.016);

      const [, secondArg] = session.handlePose.mock.calls[0];
      expect(secondArg).toBeDefined();
      // 정규화 좌표는 0.8 (1회 미러링 적용값)이어야 하며, 0.2로 이중 반전되지 않아야 함
      expect(secondArg[POSE_LANDMARKS.LEFT_WRIST].x).toBeCloseTo(0.8, 4);
    });

    it('PoseManager 비미러 설정(mirror: false) 시 원본 x 좌표가 유지된다', () => {
      const session = { handlePose: vi.fn() };
      mockContext.assaultSession = session;

      const poseManager = new PoseManager({
        virtualWidth: 1920,
        virtualHeight: 1080,
        mirror: false,
      });

      const rawLandmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));
      rawLandmarks[POSE_LANDMARKS.LEFT_WRIST] = {
        x: 0.2,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      };

      poseManager.setLandmarks(rawLandmarks);
      mockContext.poseManager = poseManager;

      const virtualLandmarks = [...poseManager.virtualLandmarks];
      expect(virtualLandmarks[POSE_LANDMARKS.LEFT_WRIST].x).toBeCloseTo(0.2 * 1920, 1);

      handler.handlePose(virtualLandmarks, mockContext, 0.016);

      const [, secondArg] = session.handlePose.mock.calls[0];
      expect(secondArg).toBeDefined();
      expect(secondArg[POSE_LANDMARKS.LEFT_WRIST].x).toBeCloseTo(0.2, 4);
    });
  });

  describe('4. Legacy 모드 격리', () => {
    it('legacy 모드에서는 SceneMotionCoordinator에서 assaultHandler.handlePose를 호출하지 않는다 (0회)', () => {
      const coordinator = new SceneMotionCoordinator();
      const assaultHandler = { handlePose: vi.fn() };

      const legacyCtx: any = {
        canvasManager: { virtualWidth: 1920, virtualHeight: 1080 },
        poseManager: {
          hasPose: true,
          virtualLandmarks: Array.from({ length: 33 }, () => ({ x: 960, y: 540, z: 0, visibility: 0.9 })),
        },
        state: { screenMode: 'game', gamePhase: 'running', totalSteps: 0, totalJumps: 0 },
        stateMachine: { currentState: 'PLAYING' },
        skeletonAnimation: { update: vi.fn() },
        stickmanRenderer: { update: vi.fn() },
        skeletonEffect: { recordJointPositions: vi.fn() },
      };

      coordinator.process(0.016, legacyCtx, {
        isAssaultMode: false, // legacy 모드
        assaultHandler,
      });

      expect(assaultHandler.handlePose).toHaveBeenCalledTimes(0);
    });
  });
});
