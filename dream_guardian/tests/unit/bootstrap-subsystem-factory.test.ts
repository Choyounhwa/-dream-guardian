import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BootstrapSubsystemFactory,
  type BootstrapSubsystems,
  type BootstrapSubsystemFactoryOptions,
  createFallbackCanvas,
} from '../../src/core/bootstrap/BootstrapSubsystemFactory.js';
import { CanvasManager } from '../../src/render/CanvasManager.js';
import { CameraLayer } from '../../src/render/CameraLayer.js';
import { PoseManager } from '../../src/motion/PoseManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import type { IAvatarRenderer } from '../../src/skeleton/IAvatarRenderer.js';
import { SFXSynth } from '../../src/audio/SFXSynth.js';

describe('BootstrapSubsystemFactory (#618 / [REFACTOR-CORE-003])', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createFallbackCanvas();
  });

  it('기본 옵션으로 40여 개 핵심 서브시스템 및 렌더러/검출기 인스턴스를 정상 생성해야 한다', () => {
    const options: BootstrapSubsystemFactoryOptions = { canvas };
    const subsystems: BootstrapSubsystems = BootstrapSubsystemFactory.create(options);

    // 1. 렌더 & 카메라 & 포즈
    expect(subsystems.canvasManager).toBeInstanceOf(CanvasManager);
    expect(subsystems.cameraLayer).toBeInstanceOf(CameraLayer);
    expect(subsystems.poseManager).toBeInstanceOf(PoseManager);
    expect(subsystems.boneRenderer).toBeDefined();
    expect(subsystems.jointRenderer).toBeDefined();
    expect(subsystems.skeletonAnimation).toBeDefined();
    expect(subsystems.skeletonEffect).toBeDefined();
    expect(subsystems.stickmanRenderer).toBeDefined();

    // 2. 게임 코어 & 전투 & 문제
    expect(subsystems.questionBank).toBeInstanceOf(QuestionBank);
    expect(subsystems.speech).toBeDefined();
    expect(subsystems.eventBus).toBeInstanceOf(EventBus);
    expect(subsystems.battle).toBeInstanceOf(BattleState);
    expect(subsystems.boss).toBeInstanceOf(BossController);
    expect(subsystems.guardian).toBeInstanceOf(GuardianSystem);

    // 3. 렌더러 계층
    expect(subsystems.hudLayer).toBeDefined();
    expect(subsystems.menuRenderer).toBeDefined();
    expect(subsystems.resultRenderer).toBeDefined();
    expect(subsystems.bossRenderer).toBeDefined();
    expect(subsystems.dreamGrid).toBeDefined();
    expect(subsystems.runningMatRenderer).toBeDefined();
    expect(subsystems.effectManager).toBeDefined();
    expect(subsystems.answerSelectionRenderer).toBeDefined();
    expect(subsystems.questionRenderer).toBeDefined();
    expect(subsystems.beatHUDRenderer).toBeDefined();
    expect(subsystems.presentationAdapter).toBeDefined();
    expect(subsystems.starNoteRenderer).toBeDefined();
    expect(subsystems.bossClimaxRenderer).toBeDefined();
    expect(subsystems.dialogueOverlayRenderer).toBeDefined();
    expect(subsystems.gestureFeedbackOverlay).toBeDefined();
    expect(subsystems.readyPositionRenderer).toBeDefined();

    // 4. 모션 검출기 및 입력 계층
    expect(subsystems.runDetector).toBeDefined();
    expect(subsystems.jumpDetector).toBeDefined();
    expect(subsystems.calibrationHelper).toBeDefined();
    expect(subsystems.locomotionDetectors).toBeDefined();
    expect(subsystems.locomotionDetectors.run).toBe(subsystems.runDetector);
    expect(typeof subsystems.getActiveLocomotionDetector).toBe('function');
    expect(subsystems.getActiveLocomotionDetector()).toBe(subsystems.runDetector);
    expect(subsystems.answerSelector).toBeDefined();
    expect(subsystems.motionIntentBus).toBeDefined();
    expect(subsystems.armReachAnswerSelector).toBeDefined();
    expect(subsystems.menuInput).toBeDefined();
    expect(subsystems.xGestureDetector).toBeDefined();
    expect(subsystems.footKeynoteDetector).toBeDefined();
    expect(subsystems.footKeynoteInput).toBeDefined();
    expect(subsystems.starCollectionInput).toBeDefined();

    // 5. 오디오 계층
    expect(subsystems.sfx).toBeDefined();
    expect(subsystems.bandSynth).toBeDefined();
    expect(subsystems.stageBgm).toBeDefined();
    expect(subsystems.bgmManager).toBeDefined();

    // 6. UI 모달 및 오버레이
    expect(subsystems.tutorial).toBeDefined();
    expect(subsystems.bottomBar).toBeDefined();
    expect(subsystems.settingsModal).toBeDefined();
    expect(subsystems.locomotionModal).toBeDefined();
    expect(subsystems.pauseModal).toBeDefined();

    // 7. 서비스 및 수명주기 관리자
    expect(subsystems.transitionManager).toBeDefined();
    expect(subsystems.sessionLifecycle).toBeDefined();
    expect(subsystems.kneeFramingValidator).toBeDefined();
    expect(subsystems.kneeFramingGuideRenderer).toBeDefined();
    expect(subsystems.starNoteScheduler).toBeDefined();
    expect(subsystems.contentLoadService).toBeDefined();
    expect(subsystems.contentProvider).toBeDefined();
    expect(subsystems.uiPresentationLoadService).toBeDefined();
  });

  it('사용자 정의 avatarRenderer, sfx, eventBus 등 옵션 오버라이드를 올바르게 바인딩해야 한다', () => {
    const mockAvatarRenderer: IAvatarRenderer = {
      render: vi.fn(),
      update: vi.fn(),
    } as unknown as IAvatarRenderer;

    const customEventBus = new EventBus();
    const customSfx = new SFXSynth();

    const subsystems = BootstrapSubsystemFactory.create({
      canvas,
      avatarRenderer: mockAvatarRenderer,
      eventBus: customEventBus,
      sfx: customSfx,
      bpm: 140,
    });

    expect(subsystems.stickmanRenderer).toBe(mockAvatarRenderer);
    expect(subsystems.eventBus).toBe(customEventBus);
    expect(subsystems.sfx).toBe(customSfx);
    expect(subsystems.starNoteScheduler.timeline.spb).toBeCloseTo(60 / 140, 4);
  });

  it('SettingsModal 이벤트와 CameraLayer, BGM, Speech 간의 바인딩이 정상 연동되어야 한다', () => {
    const subsystems = BootstrapSubsystemFactory.create({ canvas });
    const { settingsModal, cameraLayer } = subsystems;

    expect(cameraLayer.renderVideo).toBe(settingsModal.renderVideoEnabled);

    // renderVideo 변경 핸들러 트리거
    settingsModal.onRenderVideoChange?.(false);
    expect(cameraLayer.renderVideo).toBe(false);

    settingsModal.onRenderVideoChange?.(true);
    expect(cameraLayer.renderVideo).toBe(true);
  });

  it('LocomotionModal 모드 변경 시 getActiveLocomotionDetector가 올바른 검출기를 반환해야 한다', () => {
    const subsystems = BootstrapSubsystemFactory.create({ canvas });
    const { locomotionModal, locomotionDetectors, getActiveLocomotionDetector } = subsystems;

    // 기본 모드는 run
    expect(getActiveLocomotionDetector()).toBe(locomotionDetectors.run);

    // 모드 변경
    locomotionModal.selectMode('hip_bounce');
    expect(getActiveLocomotionDetector()).toBe(locomotionDetectors.hip_bounce);

    locomotionModal.selectMode('hip_sway');
    expect(getActiveLocomotionDetector()).toBe(locomotionDetectors.hip_sway);

    locomotionModal.selectMode('arm_cross');
    expect(getActiveLocomotionDetector()).toBe(locomotionDetectors.arm_cross);
  });

  it('인스턴스 팩토리 클래스 new BootstrapSubsystemFactory().create() 호출도 정상 동작해야 한다', () => {
    const factory = new BootstrapSubsystemFactory();
    const subsystems = factory.create({ canvas });

    expect(subsystems.canvasManager).toBeInstanceOf(CanvasManager);
    expect(subsystems.eventBus).toBeInstanceOf(EventBus);
  });
});
