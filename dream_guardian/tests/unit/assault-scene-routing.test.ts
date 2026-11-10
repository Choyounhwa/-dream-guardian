import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

/**
 * [BOSS-ASSAULT-23 / #525] 프레임·입력·표시 배타 라우팅 단위 테스트
 * (assault-scene-routing.test.ts)
 */

function createMockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    translate: vi.fn(),
    scale: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
  };
  return {
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

const sampleQuestions: QuestionCandidate[] = [
  {
    level: 1,
    subLevel: 1,
    questionText: '5 + 2 = ?',
    correctAnswer: 7,
    wrongAnswer: 8,
    choices: [7, 8],
  },
];

describe('[BOSS-ASSAULT-23 / #525] 프레임·입력·표시 배타 라우팅', () => {
  let mockCanvas: any;
  let originalWindow: any;
  let originalDocument: any;
  let originalEvent: any;
  let originalKeyboardEvent: any;
  let mockDocumentListeners: Record<string, any[]>;
  let mockDoc: any;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
    mockDocumentListeners = {};

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalEvent = (globalThis as any).Event;
    originalKeyboardEvent = (globalThis as any).KeyboardEvent;

    class FakeEvent {
      public type: string;
      constructor(type: string) {
        this.type = type;
      }
    }

    class FakeKeyboardEvent extends FakeEvent {
      public key: string;
      public code: string;
      public repeat: boolean;
      constructor(type: string, init?: { key?: string; code?: string; repeat?: boolean }) {
        super(type);
        this.key = init?.key ?? '';
        this.code = init?.code ?? '';
        this.repeat = init?.repeat ?? false;
      }
    }

    (globalThis as any).Event = FakeEvent;
    (globalThis as any).KeyboardEvent = FakeKeyboardEvent;

    mockDoc = {
      hidden: false,
      getElementById: vi.fn((id: string) => (id === 'game-canvas' ? mockCanvas : null)),
      addEventListener: vi.fn((type: string, fn: any) => {
        mockDocumentListeners[type] = mockDocumentListeners[type] || [];
        mockDocumentListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockDocumentListeners[type]) {
          mockDocumentListeners[type] = mockDocumentListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockDocumentListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Event = originalEvent;
    (globalThis as any).KeyboardEvent = originalKeyboardEvent;
    vi.restoreAllMocks();
  });

  describe('1. 프레임 배타적 업데이트 (Exclusive Frame Update)', () => {
    it('assault 모드 활성화 시 assaultSession.update만 1회 실행되고 legacy update 컨트롤러는 0회 실행된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const sessionUpdateSpy = vi.fn();
      (session as any).update = sessionUpdateSpy;

      const beatUpdateSpy = vi.spyOn(app.beatCoordinator, 'update');
      const bossFeverUpdateSpy = vi.spyOn(app.bossFeverController, 'update');
      const bossHazardUpdateSpy = vi.spyOn(app.bossHazardController, 'update');
      const phaseAHazardUpdateSpy = vi.spyOn(app.phaseAHazardController, 'update');
      const starNoteUpdateSpy = vi.spyOn(app.starNoteScheduler, 'update');
      const hudLayerUpdateSpy = vi.spyOn(app.hudLayer, 'update');

      app.sceneDirector.updateGameScene(0.016, app.mainSceneContext);

      // assaultSession update 1회 호출
      expect(sessionUpdateSpy).toHaveBeenCalledTimes(1);
      expect(sessionUpdateSpy).toHaveBeenCalledWith(0.016, app.mainSceneContext);

      // legacy update 컨트롤러 호출 0회
      expect(beatUpdateSpy).toHaveBeenCalledTimes(0);
      expect(bossFeverUpdateSpy).toHaveBeenCalledTimes(0);
      expect(bossHazardUpdateSpy).toHaveBeenCalledTimes(0);
      expect(phaseAHazardUpdateSpy).toHaveBeenCalledTimes(0);
      expect(starNoteUpdateSpy).toHaveBeenCalledTimes(0);
      expect(hudLayerUpdateSpy).toHaveBeenCalledTimes(0);

      app.dispose();
    });

    it('assault 모드에서 플레이어 HP가 0이 되어도 legacy showResult(false)를 중복 호출하지 않는다 (DEC-B1)', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const showResultSpy = vi.spyOn(app.mainSceneContext.actions, 'showResult');

      // 플레이어 HP 0 설정
      app.battle.applyHazardDamage(100);
      expect(app.battle.isAlive).toBe(false);

      app.sceneDirector.updateGameScene(0.016, app.mainSceneContext);

      // DEC-B1: 단일 종료 권위 원칙에 따라 SceneDirector에서 showResult(false)를 직접 호출하지 않음
      expect(showResultSpy).toHaveBeenCalledTimes(0);

      app.dispose();
    });
  });

  describe('2. 음성 및 제스처 억제 (Suppression of low_hp & X-gesture)', () => {
    it('assault 모드에서는 HP가 50% 이하라도 low_hp TTS 피드백을 발화하지 않는다 (DEC-B2)', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const speakFeedbackSpy = vi.spyOn(app.speech, 'speakFeedback');

      // HP 30%로 감량
      app.battle.applyHazardDamage(70);
      expect(app.battle.hp).toBe(30);

      // screenMode 'game'으로 설정
      (app.mainSceneContext.state as any).screenMode = 'game';

      app.sceneDirector.updateCommon(0.016, app.mainSceneContext);

      // DEC-B2: low_hp 음성 억제 (시각 경고 대체)
      expect(speakFeedbackSpy).toHaveBeenCalledTimes(0);

      app.dispose();
    });

    it('legacy 모드에서는 HP가 50% 이하일 때 low_hp TTS 피드백을 발화한다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'legacy',
      });
      await app.init();

      const speakFeedbackSpy = vi.spyOn(app.speech, 'speakFeedback');

      // HP 30%로 감량
      app.battle.applyHazardDamage(70);
      expect(app.battle.hp).toBe(30);

      // screenMode 'game'으로 설정
      (app.mainSceneContext.state as any).screenMode = 'game';

      app.sceneDirector.updateCommon(0.016, app.mainSceneContext);

      expect(speakFeedbackSpy).toHaveBeenCalledWith('low_hp');

      app.dispose();
    });

    it('assault 모드에서는 X자 제스처가 감지되어도 pauseModal.toggle을 호출하지 않는다 (DEC-B4)', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const pauseToggleSpy = vi.spyOn(app.pauseModal, 'toggle');
      (app.mainSceneContext.state as any).screenMode = 'game';

      // XGestureDetector가 감지 트리거되도록 스파이
      vi.spyOn(app.xGestureDetector, 'update').mockReturnValue({ triggered: true } as any);

      // 가상 랜드마크 주입
      (app.poseManager as any)._hasPose = true;
      (app.poseManager as any)._virtualLandmarks = Array.from({ length: 25 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));

      app.sceneDirector.updateCommon(0.016, app.mainSceneContext);

      // DEC-B4: X자 일시정지 제스처 억제
      expect(pauseToggleSpy).toHaveBeenCalledTimes(0);

      app.dispose();
    });
  });

  describe('3. 입력 배타적 라우팅 (Input Exclusive Routing)', () => {
    it('assault 모드 시 키보드 입력이 assault 세션 어댑터에 1회 전달되고 legacy 컨트롤러에는 0회 전달된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const handleKeyDownSpy = vi.spyOn(session.fallbackAdapter, 'handleKeyDown');
      const beatConfirmSpy = vi.spyOn(app.beatCoordinator, 'confirmAnswerByFallback');
      const footKeyboardSpy = vi.spyOn(app.footKeynoteInput, 'fromKeyboard');

      // '1' 키 이벤트 발화 (선택지 1번 폴백 키)
      const event1 = new (globalThis as any).KeyboardEvent('keydown', { key: '1', code: 'Digit1' });
      mockDoc.dispatchEvent(event1);

      // assault fallbackAdapter handleKeyDown 1회 호출
      expect(handleKeyDownSpy).toHaveBeenCalledTimes(1);

      // legacy beatCoordinator 및 footKeynote는 호출 0회
      expect(beatConfirmSpy).toHaveBeenCalledTimes(0);
      expect(footKeyboardSpy).toHaveBeenCalledTimes(0);

      app.dispose();
    });

    it('assault 모드 시 Space 키 입력으로 legacy totalSteps가 증가하지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const initialSteps = (app.mainSceneContext.state as any).totalSteps ?? 0;
      const recordStepSpy = vi.spyOn(app.beatCoordinator, 'recordStep');

      const spaceEvent = new (globalThis as any).KeyboardEvent('keydown', { key: ' ', code: 'Space' });
      mockDoc.dispatchEvent(spaceEvent);

      expect(recordStepSpy).toHaveBeenCalledTimes(0);
      expect((app.mainSceneContext.state as any).totalSteps ?? 0).toBe(initialSteps);

      app.dispose();
    });

    it('assault 모드 시 포즈 랜드마크가 assault 세션 handlePose로 전달된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const handlePoseSpy = vi.fn();
      (session as any).handlePose = handlePoseSpy;

      const fakeLandmarks = Array.from({ length: 25 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (app.mainSceneContext.state as any).screenMode = 'game';
      (app.poseManager as any)._rawLandmarks = fakeLandmarks;
      (app.poseManager as any)._virtualLandmarks = fakeLandmarks;

      app.sceneDirector.updateCommon(0.016, app.mainSceneContext);

      expect(handlePoseSpy).toHaveBeenCalledTimes(1);

      app.dispose();
    });
  });

  describe('4. visibilitychange 이벤트 전달 및 정지 계약 (Visibility Change & Clock Contract)', () => {
    it('visibilitychange 이벤트 발생 시 clockAdapter.handleVisibilityChange(hidden)이 호출된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const setHiddenSpy = vi.spyOn(session.clock, 'setHidden');

      // 탭 숨김 (hidden = true 시뮬레이션)
      mockDoc.hidden = true;
      mockDoc.dispatchEvent(new (globalThis as any).Event('visibilitychange'));

      expect(setHiddenSpy).toHaveBeenCalledWith(true);
      expect(session.clock.isFrozen).toBe(true);

      // 탭 복귀 (hidden = false 시뮬레이션)
      mockDoc.hidden = false;
      mockDoc.dispatchEvent(new (globalThis as any).Event('visibilitychange'));

      expect(setHiddenSpy).toHaveBeenCalledWith(false);

      app.dispose();
    });

    it('app.dispose 호출 후 visibilitychange 리스너가 제거되어 clockAdapter에 신호가 가지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const setHiddenSpy = vi.spyOn(session.clock, 'setHidden');
      app.dispose();

      mockDoc.hidden = true;
      mockDoc.dispatchEvent(new (globalThis as any).Event('visibilitychange'));

      expect(setHiddenSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('5. 표시 및 HUD 배타적 렌더링 (Exclusive Rendering)', () => {
    it('assault 모드 시 renderGameScene에서 assaultSession.hud.render가 1회 실행되고 legacy HUD는 0회 실행된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      const mockHudRender = vi.spyOn(session.hud, 'render');
      const legacyHudRender = vi.spyOn(app.hudLayer, 'render');
      const beatHudRender = vi.spyOn(app.beatHUDRenderer, 'render');

      app.sceneDirector.renderGameScene(app.mainSceneContext);

      // assault HUD 렌더 1회
      expect(mockHudRender).toHaveBeenCalledTimes(1);

      // legacy HUD 렌더 0회
      expect(legacyHudRender).toHaveBeenCalledTimes(0);
      expect(beatHudRender).toHaveBeenCalledTimes(0);

      app.dispose();
    });

    it('legacy 모드 시 legacy HUD가 렌더링되고 assault HUD는 0회 실행된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'legacy',
      });
      await app.init();

      const legacyHudRender = vi.spyOn(app.hudLayer, 'render');

      app.sceneDirector.renderGameScene(app.mainSceneContext);

      expect(legacyHudRender).toHaveBeenCalledTimes(1);

      app.dispose();
    });
  });

  describe('6. IntentBus ASSAULT_ROUND 페이즈 계약 (DEC-A2 / #543)', () => {
    it('assembleAssaultSession 호출 시 motionIntentBus의 phase가 ASSAULT_ROUND로 설정된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      expect(app.motionIntentBus.currentPhase).not.toBe('ASSAULT_ROUND');

      app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      expect(app.motionIntentBus.currentPhase).toBe('ASSAULT_ROUND');

      app.dispose();
    });

    it('AppBootstrap 생성 시 mode: "boss_assault"인 경우 즉시 ASSAULT_ROUND로 설정된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      expect(app.motionIntentBus.currentPhase).toBe('ASSAULT_ROUND');

      app.dispose();
    });
  });
});
