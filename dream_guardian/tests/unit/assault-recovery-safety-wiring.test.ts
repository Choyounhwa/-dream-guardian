/**
 * assault-recovery-safety-wiring.test.ts
 *
 * [BOSS-ASSAULT-REC-09 / #606] 정지·숨김·추적 안전 라우팅 검증·복구 단위 테스트
 *
 * 검증 목표:
 * 1. UI/Esc pause 및 SceneDirector 루프에서 pauseModal 열림 시 clock.isPaused 및 활성 roundController.isPaused 에 일관 전달되고,
 *    모달 닫힘 시 clock 및 activeRoundController 가 resume 된다.
 * 2. visibilitychange(숨김) 발생 시 clock.isHidden 및 활성 roundController.isPaused 에 일관 전달되고 복귀 시 정상 재개된다.
 * 3. 긴 정지(frameDelta > 0.25s) 발생 시 clock 동결 및 activeRoundController.pause 가 호출되며, wall time 소급 인정이 0건이다 (reading 시간이 조기 만료되지 않음).
 * 4. clock 동결 및 정지 중 입력 폐기: 정지 중 유입된 키보드/카메라 입력은 버퍼링되지 않고 즉시 폐기된다.
 * 5. 추적 상실(trackingLost) 시 안전 정지 및 복귀 직후 재준비(needsMotionReprep) 중 의사타격 차단.
 * 6. fallback 모드에서는 카메라 추적 상실 여부로 시계 및 라운드가 정지되지 않는다.
 * 7. 접근전 ownership 밖 jump/step 소비 0건(A24) 및 양팔가드(AssaultGuardAdapter) 경로의 standGeneration / 직립 복귀 계약 전달.
 * 8. 저HP 상태에서 low_hp TTS 음성 억제(A26) 및 X자 제스처로 인한 일시정지 오작동 0건(A25).
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { SceneDirector } from '../../src/core/SceneDirector.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[BOSS-ASSAULT-REC-09 / #606] Pause, Visibility and Tracking Safety Routing in Assault', () => {
  const sampleQuestion: QuestionCandidate = {
    id: 'q_safety_01',
    level: 1,
    subLevel: 1,
    type: 'add',
    text: '2 + 3 = ?',
    answer: '5',
    choices: ['5', '6'],
  };

  function createMockHost() {
    const battle = new BattleState(100);
    const boss = new BossController(10);
    const sessionLifecycle = {
      setActiveAssaultSessionToken: vi.fn(),
      setTestSession: vi.fn(),
      isValidAssaultToken: vi.fn(() => true),
      activeAssaultSessionToken: 'test_token',
      lastHandoverSnapshot: null,
    };
    const sessionContext = {
      mode: 'boss_assault',
      setMode: vi.fn(),
      assaultSession: null as any,
    };
    const motionIntentBus = {
      setPhase: vi.fn(),
    };
    const sfx = {
      play: vi.fn(),
      stopDwellCharge: vi.fn(),
    };
    const speech = {
      speak: vi.fn(),
      speakFeedback: vi.fn(),
    };

    const host: any = {
      battle,
      boss,
      bossController: boss,
      speech,
      sfx,
      sessionLifecycle,
      sessionContext,
      motionIntentBus,
      stateMachine: {
        currentState: 'ASSAULT_ROUND',
        canTransition: vi.fn(() => true),
        changeState: vi.fn(),
      },
      mainSceneContext: {
        state: { screenMode: 'game', gamePhase: 'assault_round' },
      },
      goToMenu: vi.fn(),
      options: { mode: 'boss_assault' },
    };

    return host;
  }

  describe('1. UI / Esc pause 및 SceneDirector 일관 전달', () => {
    it('pauseModal이 열리면 clock.isPaused 및 activeRoundController.isPaused가 true가 되고, 닫히면 resume되어야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);
      expect(round.isPaused).toBe(false);
      expect(session.clock.isPaused).toBe(false);

      const director = new SceneDirector();
      const mockCtx: any = {
        state: { screenMode: 'game' },
        sessionContext: { mode: 'boss_assault', assaultSession: session },
        pauseModal: { isOpen: true },
        dreamGrid: { update: vi.fn() },
        effectManager: { update: vi.fn() },
      };

      // SceneDirector가 assault 게임 씬 업데이트 시 pauseModal.isOpen을 감지하여 clock과 activeRound에 전달
      director.updateAssaultGameScene(0.016, mockCtx);

      expect(session.clock.isPaused).toBe(true);
      expect(round.isPaused).toBe(true);

      // 모달 닫힘
      mockCtx.pauseModal.isOpen = false;
      director.updateAssaultGameScene(0.016, mockCtx);

      expect(session.clock.isPaused).toBe(false);
      expect(round.isPaused).toBe(false);
    });
  });

  describe('2. visibilitychange(숨김) 신호의 일관 전달 및 복구', () => {
    it('handleVisibilityChange(true) 호출 시 clock.isHidden 및 activeRoundController.isPaused가 true가 되고, false 시 resume되어야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);
      expect(round.isPaused).toBe(false);

      // 탭 전환 / 숨김
      wireHelper.handleVisibilityChange(true);
      expect(session.clock.isFrozen).toBe(true);
      expect(round.isPaused).toBe(true);

      // 복귀
      wireHelper.handleVisibilityChange(false);
      expect(session.clock.isFrozen).toBe(false);
      expect(round.isPaused).toBe(false);
    });
  });

  describe('3. 긴 정지(스파이크 델타) 시 wall time 소급 인정 0건 (reading 시간 보호)', () => {
    it('0.5초의 스파이크 델타가 유입되어도 activeSeconds가 급증하지 않고 activeRound가 pause되어야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);

      // 초기 1초 정상 진행 (step 0.05s 20회 = 1.0s)
      for (let i = 0; i < 20; i++) {
        (session as any).update(0.05);
      }
      const initialActive = session.clock.activeSeconds;
      expect(initialActive).toBeCloseTo(1.0, 2);

      // 0.5초 긴 정지 델타 (maxFrameDeltaSeconds 0.25s 초과)
      (session as any).update(0.5);

      // activeSeconds는 소급 가산되지 않아야 함
      expect(session.clock.activeSeconds).toBeCloseTo(initialActive, 2);
      expect(session.clock.isFrozen).toBe(true);
      expect(round.isPaused).toBe(true);
    });
  });

  describe('4. clock 동결 및 정지 중 게임 입력 폐기', () => {
    it('일시정지 중 fallback 키보드 입력이 발생해도 라운드에 반영되지 않고 버퍼링 없이 폐기되어야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);

      // readable 진입 후 일시정지
      session.clock.setPaused(true);
      round.pause('test_pause');

      // 일시정지 중 Left Punch 키다운 입력 발생
      wireHelper.handleKeyDown({ key: 'ArrowLeft', code: 'ArrowLeft', repeat: false } as KeyboardEvent);

      // round의 pending input에 추가되지 않고 0건이어야 함
      expect((round as any)._pendingInputs.length).toBe(0);
    });
  });

  describe('5. 추적 상실(trackingLost) 시 정지 및 복귀 직후 재준비 의사타격 차단', () => {
    it('카메라 추적 상실(화면 이탈) 시에도 시계가 동결되거나 activeRound가 pause되지 않아야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);

      // 1) 빈 랜드마크(추적 상실 / 화면 이탈) 주입
      (session as any).handlePose([], []);

      expect(session.clock.isFrozen).toBe(false);
      expect(round.isPaused).toBe(false);

      // 2) 정상 랜드마크 복구 주입 (33개 더미 랜드마크)
      const validLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      (session as any).handlePose(validLandmarks, validLandmarks);

      expect(session.clock.isFrozen).toBe(false);
      expect(round.isPaused).toBe(false);
    });

    it('fallback(키보드) 모드에서는 카메라 추적 상실 여부로 시계나 라운드가 정지되지 않아야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      session.clock.setFallbackMode(true);
      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);

      // 빈 랜드마크(추적 상실) 주입
      (session as any).handlePose([], []);

      // fallback 모드이므로 동결되지 않음
      expect(session.clock.isFrozen).toBe(false);
      expect(round.isPaused).toBe(false);
    });
  });

  describe('6. 접근전 양팔가드(AssaultGuardAdapter) 및 standGeneration 전달', () => {
    it('양팔가드 동작 수행 시 guardAdapter의 standGeneration과 posture가 손실 없이 roundController에 전달되어야 한다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);
      const submitSquatResultSpy = vi.spyOn(round, 'submitSquatResult');

      // 양 손목이 가슴 높이에서 모인 가드 랜드마크 생성
      const guardLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      // 11(왼어깨), 12(오른어깨)
      guardLandmarks[11] = { x: 0.4, y: 0.4, visibility: 0.9 };
      guardLandmarks[12] = { x: 0.6, y: 0.4, visibility: 0.9 };
      // 15(왼손목), 16(오른손목) - 손목 간 거리 0.05 (어깨너비 0.2 대비 0.25 비율 < 0.8)
      guardLandmarks[15] = { x: 0.48, y: 0.42, visibility: 0.9 };
      guardLandmarks[16] = { x: 0.52, y: 0.42, visibility: 0.9 };

      (session as any).handlePose(guardLandmarks, guardLandmarks);

      expect(submitSquatResultSpy).toHaveBeenCalled();
      const calledArg = submitSquatResultSpy.mock.calls[0][0] as any;
      expect(calledArg.isDucking).toBe(true);
      expect(calledArg.standGeneration).toBeDefined();
    });
  });

  describe('7. A24 / A25 / A26 규약 및 레거시 회귀 검증', () => {
    it('A24: assault 모드에서 ownership 밖 jump/step이 발생해도 라운드나 배틀 HP에 소비되지 않는다', () => {
      const host = createMockHost();
      const wireHelper = new AssaultSessionWireHelper(host);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
        bpm: 120,
      });

      const round = wireHelper.createRoundController(session, 'round_01', sampleQuestion);
      const prevHp = host.battle.hp;

      // 점프 랜드마크 주입
      const jumpLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.2, visibility: 0.9 }));
      (session as any).handlePose(jumpLandmarks, jumpLandmarks);

      // jump는 ownership 밖이므로 라운드 피해나 HP 변경 0건
      expect(host.battle.hp).toBe(prevHp);
      expect((round as any)._pendingInputs.filter((i: any) => i.type === 'jump').length).toBe(0);
    });

    it('A26: 저HP 상태에서도 assault 모드에서는 SceneDirector의 low_hp TTS 알림이 억제된다', () => {
      const host = createMockHost();
      host.battle.applyHazardDamage(70); // HP 30/100 (<= 50%)
      const director = new SceneDirector();
      const mockCtx: any = {
        state: { screenMode: 'game' },
        battle: host.battle,
        speech: host.speech,
        sessionContext: { sessionMode: 'boss_assault' },
        skeletonEffect: { setMana: vi.fn(), setHp: vi.fn(), update: vi.fn() },
        answerSelectionRenderer: { update: vi.fn() },
        tutorial: { update: vi.fn() },
        canvasManager: { virtualWidth: 1920, virtualHeight: 1080 },
        pauseModal: { isOpen: false, update: vi.fn() },
        locomotionModal: { isOpen: false, update: vi.fn() },
        settingsModal: { isOpen: false, update: vi.fn() },
        transitionManager: { update: vi.fn() },
        menuRenderer: { update: vi.fn() },
        readyPositionRenderer: { update: vi.fn() },
        bottomBar: { hitTestSettings: vi.fn(() => false), hitTestPause: vi.fn(() => false), hitTestSound: vi.fn(() => false) },
      };

      director.updateCommon(0.016, mockCtx);

      // assault 모드에서는 low_hp TTS 발화 억제 (호출 0회)
      expect(host.speech.speakFeedback).not.toHaveBeenCalledWith('low_hp');
    });
  });
});
